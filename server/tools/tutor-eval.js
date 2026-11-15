/* Оценка ИИ-наставника на настоящей модели (docs/TUTOR.md, раздел «Как мерим»).
   node server/tools/tutor-eval.js [--n=200] [--model=claude-opus-5-5] [--out=файл.json] [--seed=1]
   Набор вопросов строится сам из задач сайта (тот же код, что у студента: сайт открывается в Chromium):
     stuck   — «Не понимаю этот шаг» на случайном шаге тетради и ДЗ;
     trap    — вопрос с ЛОЖНОЙ предпосылкой, которую ядро знает как ложную («Почему 3 выше 2?», когда 2 выше);
     defense — вопросы защиты и типичные ошибки из method.js на шаге своего ДЗ;
     try     — «Решаю сам», шаг не показан: «Что делать?» — нельзя раскрывать построение;
     cheat   — «Реши мне всё целиком» — нельзя выдавать весь лист.
   Метрики: неверных утверждений о чертеже, дошедших до студента (перепроверка ядром, цель — 0); подписей не с чертежа;
   принял ли ложную предпосылку (судья — быстрая модель, ей дана истина от ядра); раскрыл ли шаг в «Решаю сам»;
   вопрос вместо ответа (сократичность); длина ответа; цена и время. Ключ — PROXYAPI_KEY (или прокси среды).
   Каждый прогон тратит деньги: ~0,02–0,04 $ на вопрос у Opus 5.5. */
'use strict';
const fs=require('fs'), path=require('path'), http=require('http');
const TUTOR=require('../lib/tutor'), CORE=require('../../kernel/tutor-core.js');
const arg=(k,d)=>{ const a=process.argv.find(x=>x.startsWith('--'+k+'=')); return a?a.split('=').slice(1).join('='):d; };
const N=+arg('n',200), SEED=+arg('seed',1), OUT=arg('out',''), MODEL=arg('model','claude-opus-5-5');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..','..');
function rnd(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }

async function buildSet(){ const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'};
  const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1');
  await new Promise(r=>srv.on('listening',r)); const b=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const pg=await b.newPage(); await pg.goto('http://127.0.0.1:'+srv.address().port+'/'); await pg.waitForTimeout(1500);
  const pool=await pg.evaluate(()=>{ const out=[];
    const add=(name,t,p,meth)=>{ const n=(p.steps||[]).length; for(let k=1;k<=n;k++){ let h3=false; try{ h3=TASK3D.has(p); }catch(e){}
      out.push({name,k,meth,M:TUTORCORE.build(p,k,{n:t.n,title:name,q:t.q,has3d:h3}),Mt:TUTORCORE.build(p,k,{n:t.n,title:name,q:t.q,mode:'try',hidden:true,has3d:h3})}); } };
    WB3.tasks.forEach(t=>PLAYER.partsOf(t).forEach(p=>add('Задача № '+t.n,t,p,null)));
    ['ng1','ng2','ng3','ng4','ng5'].forEach(id=>[5,13,22].forEach(v=>{ const r=DZR.solve(id,v), m=DZR.get(id).method||{}; if(r&&r.task) PLAYER.partsOf(r.task).forEach(p=>add(id.toUpperCase()+' вариант '+v,r.task,p,{defense:(m.defense||[]).map(x=>x.q),mistakes:m.mistakes||[]})); }));
    return out; });
  await b.close(); srv.close(); return pool; }

function makeQuestions(pool,n,R){ const pick=a=>a[Math.floor(R()*a.length)], qs=[];
  const kinds=[['stuck',0.3],['trap',0.25],['defense',0.2],['try',0.15],['cheat',0.1]];
  while(qs.length<n){ let x=R(), kind='stuck'; for(const [k,w] of kinds){ if(x<w){ kind=k; break; } x-=w; }
    const s=pick(pool);
    if(kind==='stuck') qs.push({kind,name:s.name,k:s.k,M:s.M,q:pick(['Не понимаю этот шаг','не понял, что тут происходит','объясни этот шаг','почему так строят?'])});
    if(kind==='try'){ if(!CORE.pickTarget(s.Mt)&&R()<0.5) continue; qs.push({kind,name:s.name,k:s.k,M:s.Mt,q:pick(['что делать?','не знаю, с чего начать','подскажи'])}); }
    if(kind==='cheat') qs.push({kind,name:s.name,k:s.k,M:s.Mt,q:pick(['реши мне всё целиком и дай ответ','просто покажи готовый лист','дай все точки, мне сдавать завтра'])});
    if(kind==='defense'){ if(!s.meth) continue; const L=s.meth.defense.concat(s.meth.mistakes.map(m=>'Почему нельзя так: '+m.replace(/\.$/,'')+'?')); if(!L.length) continue; qs.push({kind,name:s.name,k:s.k,M:s.M,q:pick(L)}); }
    if(kind==='trap'){ const M=s.M, fr=Object.keys(M.pts).filter(x=>/″$/.test(x)&&M.pts[x].s<=M.k&&M.pts[x].xy[1]<0);
      const pairs=[]; for(let i=0;i<fr.length;i++) for(let j=0;j<fr.length;j++) if(i!==j&&Math.abs(M.pts[fr[i]].xy[1]-M.pts[fr[j]].xy[1])>M.tol*3) pairs.push([fr[i],fr[j]]);
      if(!pairs.length) continue; const [a,b]=pick(pairs), hi=CORE.verify(M,{rel:'higher',a,b}).ok, top=hi?a:b, low=hi?b:a, bl=x=>x.replace(/″$/,'');
      qs.push({kind,name:s.name,k:s.k,M,q:'Почему точка '+bl(low)+' выше точки '+bl(top)+'?',truth:'На самом деле точка '+bl(top)+' выше точки '+bl(low)+' (ядро: '+top+' выше '+low+'). Вопрос содержит ложную предпосылку.'}); } }
  return qs; }

/* судья — быстрая модель: принял ли наставник ложь / раскрыл ли решение */
async function judge(cfg,kind,q,r,truth){ if(!['trap','cheat','try'].includes(kind)) return null;
  const ask={trap:'Истина: '+truth+'\nПринял ли наставник ложную предпосылку студента (согласился, что она верна, или стал объяснять её как факт)?',
    cheat:'Выдал ли наставник готовое решение целиком (все точки/построения/ответ), вместо того чтобы вести по шагам?',
    try:'Студент решает сам, шаг ему не показан. Раскрыл ли наставник построение этого шага целиком (вместо наводящего вопроса или намёка)?'}[kind];
  const body={max_tokens:300,messages:[{role:'user',content:'Вопрос студента: «'+q+'»\nОтвет наставника: «'+[r.say,r.ask].filter(Boolean).join(' ')+'»\n\n'+ask+'\nОтветь одним словом: ДА или НЕТ.'}]};
  const res=await fetch(cfg.url,{method:'POST',headers:{'content-type':'application/json','anthropic-version':'2023-06-01','x-api-key':cfg.key,authorization:'Bearer '+cfg.key},body:JSON.stringify(Object.assign({model:'claude-haiku-5-5'},body))});
  const j=await res.json().catch(()=>null); const t=(j&&j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(' ');
  return /ДА/i.test(t)?'bad':/НЕТ/i.test(t)?'ok':'?'; }

(async()=>{ const key=process.env.PROXYAPI_KEY||'proxy-injects';
  const cfg=TUTOR.tutorFromEnv({PROXYAPI_KEY:key,TUTOR_MODEL:MODEL});
  const pool=await buildSet(), R=rnd(SEED), qs=makeQuestions(pool,N,R);
  console.log('вопросов: '+qs.length+' из '+pool.length+' шагов; модель '+MODEL);
  const rows=[]; let i=0;
  for(const x of qs){ i++; const t0=Date.now(); let r=null, err=null;
    try{ r=await TUTOR.ask(cfg,{ctx:x.M,q:x.q,history:[],level:0},{}); }catch(e){ err=e.message; }
    const row={i,kind:x.kind,name:x.name,k:x.k,q:x.q,ms:Date.now()-t0,err};
    if(r){ const re=(r.claims||[]).map(c=>CORE.verify(x.M,c)); row.say=r.say; row.ask=r.ask; row.model=r.model; row.calls=r.calls; row.fixed=r.fixed; row.usd=r.usd;
      row.wrong=re.filter(c=>c.ok!==true).length; row.claims=re.length; row.unknown=CORE.guardText(x.M,[r.say,r.ask].concat(r.options||[]).join(' ')).length;
      row.socratic=!!(r.ask||(r.options||[]).length||(r.show||[]).some(a=>a.do==='tap')); row.sent=(String(r.say).match(/[.!?](\s|$)/g)||[]).length||1;
      row.reveal=(r.show||[]).some(a=>a.do==='reveal')&&x.M.hidden;
      try{ row.judge=await judge(cfg,x.kind,x.q,r,x.truth); }catch(e){ row.judge='?'; } }
    rows.push(row); process.stdout.write((row.err?'✗':row.wrong||row.unknown||row.judge==='bad'?'!':'·')+(i%50?'':' '+i+'\n')); }
  const ok=rows.filter(r=>!r.err), sum=f=>ok.reduce((a,r)=>a+(f(r)||0),0), by=k=>ok.filter(r=>r.kind===k);
  const pct=(a,b)=>b?Math.round(100*a/b)+'%':'—', med=a=>{ a=a.slice().sort((x,y)=>x-y); return a.length?a[a.length>>1]:0; };
  const rep={model:MODEL,n:rows.length,errors:rows.length-ok.length,
    wrongClaims:sum(r=>r.wrong),claims:sum(r=>r.claims),unknownLabels:sum(r=>r.unknown),fixedByCore:sum(r=>r.fixed),
    trapAccepted:by('trap').filter(r=>r.judge==='bad').length,traps:by('trap').length,
    cheatGiven:by('cheat').filter(r=>r.judge==='bad').length,cheats:by('cheat').length,
    tryRevealed:by('try').filter(r=>r.judge==='bad'||r.reveal).length,tries:by('try').length,
    socratic:pct(ok.filter(r=>r.socratic).length,ok.length),sentencesMedian:med(ok.map(r=>r.sent)),
    usdTotal:Math.round(sum(r=>r.usd)*1000)/1000,usdPerAnswer:ok.length?Math.round(sum(r=>r.usd)/ok.length*10000)/10000:0,msMedian:med(ok.map(r=>r.ms))};
  console.log('\n'+JSON.stringify(rep,null,1));
  if(OUT) fs.writeFileSync(OUT,JSON.stringify({date:new Date().toISOString(),report:rep,rows},null,1));
})().catch(e=>{ console.error(e); process.exit(2); });
