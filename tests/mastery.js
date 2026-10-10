/* ═══════════ Мастерство (этап 1 ТЗ): модель повторения, забег, лента, серия, перенос, приватность ═══════════
   Запускается из run.js; отдельно: node tests/mastery.js
   (а) интервалы повторения на синтетических попытках; (б) миграция из тетради; (в) один сид — один состав забега;
   (г) код переноса: экспорт → импорт даёт то же состояние; (д) без согласия ни одного вызова ym(...);
   (е) новые страницы на 360 px без горизонтальной прокрутки и ошибок; (ж) лента: блоки по 5 одной темы, пауза после каждой 10-й;
   (з) заморозка серии расходуется за один пропущенный день и не расходуется в день с занятием.
   Плюс: забег проходится нажатиями до итогов. */
const FLAGS={mastery:true,review:true,feed:true,quests:true};
const ROUTES=['#/','#/run','#/review','#/feed','#/map','#/collection','#/week','#/sync','#/duel/12.47.5-abc/2s.1.110.Тест','#/run/1234','#/run/s.tl'];

async function masteryCheck(browser,URL){
  const bad=[], info=[], add=(name,rule,msg)=>bad.push({name,rule,msg:String(msg).slice(0,240)});
  const page=await browser.newPage({viewport:{width:360,height:740},deviceScaleFactor:1});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(800);
  /* (д) без согласия: перехватываем ym и проваливаем попытки — вызовов быть не должно */
  const ym=await page.evaluate(()=>{ localStorage.removeItem('nch2_ck'); let n=0; window.ym=function(){ n++; };
    for(let i=0;i<5;i++) MS.record({s:'tl',task:13,mode:'solve',ok:false,cat:'self',step:2});
    TRACK('step_fail',{task:1,step:1,cat:'x'}); return n; });
  if(ym) add('Мастерство','(д) приватность','без согласия вызван ym '+ym+' раз');
  await page.evaluate(F=>{ localStorage.clear(); localStorage.setItem('nch2_owner','true'); localStorage.setItem('nch2_flags',JSON.stringify(F)); localStorage.setItem('nch2_ck','"n"'); },FLAGS);
  await page.reload(); await page.waitForTimeout(1200);

  const R=await page.evaluate(async()=>{ const wipe=()=>{ localStorage.clear(); for(const k in MEM) delete MEM[k]; }; const out={}, save=()=>{ const o={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); o[k]=localStorage.getItem(k); } return o; }, load=o=>{ wipe(); Object.entries(o).forEach(([k,v])=>localStorage.setItem(k,v)); };
    const base=save();
    /* (а) интервалы при сплошь верных ответах в срок */
    { let c={lvl:0,S:MS.K.S0,D:MS.K.D0,last:null,due:null}, d=1000; const iv=[];
      for(let i=0;i<6;i++){ c=MS.step(c,{d,ok:true,hints:0,mode:'solve',s:'zz',task:1,seed:i+1},[]); iv.push(c.due-d); d=c.due; }
      out.iv=iv;
      /* ошибка сбрасывает стабильность, уверенная — до 1 дня */
      const w=MS.step(Object.assign({},c),{d,ok:false,hints:0,conf:0,mode:'solve'},[]), w1=MS.step(Object.assign({},c),{d,ok:false,hints:0,conf:1,mode:'solve'},[]);
      out.fail=[w.S<c.S, w1.S===1, w.D===Math.min(10,c.D+1)]; }
    /* (б) миграция: «решено сам» → 2, «разобрано» → 1 */
    { wipe(); ST.set('wb3',{13:2,17:1}); MS._day=20000; MS.migrate(true); out.mig=[MS.level('tl'),MS.level('mut'),MS.level('pt'),ST.get('srs',{}).tl&&ST.get('srs',{}).tl.due]; MS._day=null; }
    /* (в) сид → состав */
    { const a=MS.decode('12.47.5.63-k3f9'), b=MS.decode('12.47.5.63-k3f9'), c=MS.decode('1234'), d=MS.decode('1234'), e=MS.decode('99');
      out.seed=[JSON.stringify(a)===JSON.stringify(b), JSON.stringify(c)===JSON.stringify(d), c.ns.length>=4, JSON.stringify(c.ns)!==JSON.stringify(e.ns), a.ns.join()==='12,47,5,63'];
      const code=MS.newRun({rnd:777}); out.seed.push(JSON.stringify(MS.decode(code).ns)===JSON.stringify(MS.decode(code).ns), MS.decode(code).ns.length>=4&&MS.decode(code).ns.length<=6); }
    /* (г) перенос: экспорт → очистка → импорт */
    { wipe(); ST.set('wb3',{1:2,2:1,47:2}); ST.set('done',{1:true}); MS._day=20100;
      for(let i=0;i<30;i++) MS.record({s:i%2?'tl':'pt',task:i%2?13:1,mode:i%3?'solve':'feed',ok:i%4!==0,hints:i%5===0?1:0,conf:i%2,seed:i,ms:1000*i});
      MS._day=null; const snap=JSON.stringify(MS.snapshot()), code=await MS.exportCode();
      wipe(); await MS.importCode(code); out.sync=[JSON.stringify(MS.snapshot())===snap, code[0]];
      wipe(); await MS.importCode(location.origin+'/#/sync/'+code); out.sync.push(JSON.stringify(MS.snapshot())===snap); }
    /* (ж) лента: 10 карточек — пауза; блоки по 5 одного навыка */
    { wipe(); const P=MS.feedPlan(4242,30,true); let ok=true, cards=0;
      P.forEach((x,i)=>{ if(x.k==='pause'){ if(cards%10!==0||cards===0) ok=false; } else cards++; });
      const pauses=P.map((x,i)=>x.k==='pause'?i:-1).filter(i=>i>=0);
      const blocks=P.filter(x=>x.k==='card'); let same=true; for(let i=0;i<blocks.length;i+=5){ const b=blocks.slice(i,i+5); if(!b.every(x=>x.s===b[0].s)) same=false; }
      out.feed=[ok, JSON.stringify(pauses)==='[10,21,32]', same, cards===30]; }
    /* (з) серия: один пропуск — минус заморозка; день с занятием — заморозка цела */
    { wipe(); for(let d=100;d<107;d++) MS.streakOn(d); const s7=MS.streak();
      MS.streakOn(107); const same=MS.streak().freezes; MS.streakOn(107);
      const s8=MS.streak(); MS.streakOn(109); const s9=MS.streak(); MS.streakOn(112); const s10=MS.streak();
      out.streak=[s7.days===7&&s7.freezes===1, same===1&&s8.freezes===1, s9.days===9&&s9.freezes===0, s10.days===1]; }
    /* уровни: «Умею» — два самостоятельных решения, одно на новом варианте; «Освоено» — подтверждение через ≥3 дня */
    { wipe(); MS._day=30000; MS.record({s:'tl',task:13,mode:'solve',ok:true,seed:0}); const l2=MS.level('tl');
      MS.record({s:'tl',task:13,mode:'solve',ok:true,seed:55}); const l3=MS.level('tl');
      MS._day=30004; MS.record({s:'tl',task:15,mode:'solve',ok:true,seed:7}); const l4=MS.level('tl');
      MS._day=30004+MS.card('tl').due-30004; MS.record({s:'tl',task:15,mode:'solve',ok:false}); const l5=MS.level('tl'); MS._day=null;
      out.lvl=[l2,l3,l4,l5]; }
    /* каждая задача тетради — ровно в одном навыке */
    { const ns=WB3.tasks.map(t=>t.n).filter(n=>typeof n==='number'); out.cover=ns.filter(n=>MS.SKILLS.filter(s=>s.tasks.includes(n)).length!==1); }
    load(base); return out; });

  const ivOk=R.iv.length===6&&R.iv[0]===1&&R.iv[1]>=2&&R.iv[1]<=4&&R.iv[2]>=5&&R.iv[2]<=10&&R.iv[3]>=12&&R.iv[3]<=22&&R.iv[4]>=26&&R.iv[4]<=46&&R.iv[5]>R.iv[4];
  if(!ivOk) add('Мастерство','(а) интервалы повторения','ожидалось ≈ 1 → 3 → 7 → 16 → 35, получено '+R.iv.join(' → '));
  if(!R.fail.every(Boolean)) add('Мастерство','(а) ошибка в повторении',JSON.stringify(R.fail));
  if(JSON.stringify(R.mig.slice(0,3))!=='[2,1,0]'||R.mig[3]!==20000) add('Мастерство','(б) миграция из тетради',JSON.stringify(R.mig));
  if(!R.seed.every(Boolean)) add('Мастерство','(в) сид забега',JSON.stringify(R.seed));
  if(!R.sync.slice(0,1).concat(R.sync.slice(2)).every(Boolean)) add('Мастерство','(г) перенос прогресса',JSON.stringify(R.sync));
  if(!R.feed.every(Boolean)) add('Мастерство','(ж) лента',JSON.stringify(R.feed));
  if(!R.streak.every(Boolean)) add('Мастерство','(з) серия и заморозки',JSON.stringify(R.streak));
  if(JSON.stringify(R.lvl)!=='[2,3,4,3]') add('Мастерство','уровни 2 → 3 → 4 и падение на шаг',JSON.stringify(R.lvl));
  if(R.cover.length) add('Мастерство','навыки','задачи не в одном навыке: '+R.cover.join(', '));
  info.push('Мастерство: интервалы '+R.iv.join(' → ')+' дн., код переноса — '+(R.sync[1]==='z'?'deflate':'без сжатия'));

  /* (е) новые страницы на 360 px */
  for(const h of ROUTES){ const before=errs.length; await page.evaluate(h=>{ location.hash=h; },h); await page.waitForTimeout(h==='#/feed'||/^#\/run/.test(h)?2500:400);
    const st=await page.evaluate(()=>{ window.scrollTo(400,window.scrollY); const x=window.scrollX; window.scrollTo(0,window.scrollY);
      const f=document.getElementById('msFeed'); return {x,fx:f?f.scrollWidth-f.clientWidth:0,txt:(document.getElementById('view')||document.body).innerText.length,h:location.hash}; });
    if(errs.length>before) add(h,'(е) ошибка JS',errs.slice(before).join(' / '));
    if(st.x>0||st.fx>1) add(h,'(е) горизонтальная прокрутка','сдвиг '+st.x+' / лента '+st.fx);
    if(st.txt<40) add(h,'(е) пустая страница','текста '+st.txt); }
  /* лента в DOM: ровно 10 карточек до паузы */
  { await page.evaluate(()=>{ location.hash='#/feed'; }); await page.waitForTimeout(2500);
    const seq=await page.evaluate(()=>[...document.querySelectorAll('#msFeed > section')].map(e=>e.className==='fd-pause'?'P':'c').join(''));
    if(seq!=='cccccccccc'+'P') add('#/feed','(ж) лента в DOM',seq);
    const n=await page.evaluate(()=>{ document.querySelector('.fd-pause [data-more]').click(); return document.querySelectorAll('#msFeed > section').length; });
    if(n!==22) add('#/feed','(ж) «Ещё 10»','секций после нажатия: '+n);
    /* ответы на карточки записываются как попытки */
    const rec=await page.evaluate(()=>{ const before=ST.get('att',[]).length; document.querySelectorAll('#msFeed .fd-card').forEach(c=>{ const b=c.querySelector('.ms-opt:not(:disabled),[data-v]:not(:disabled)'); if(b) b.click(); }); return ST.get('att',[]).length-before; });
    if(rec<10) add('#/feed','ответы ленты → попытки','записано '+rec);
    info.push('Лента: '+n+' секций после «Ещё 10», ответов записано '+rec); }
  /* забег нажатиями: метод → уверенность → шаги / решение → итоги */
  { const before=errs.length; await page.evaluate(()=>{ location.hash='#/run/2.13.27.51-1'; }); await page.waitForTimeout(2500);
    await page.click('#msGo').catch(()=>{});
    let k=0; for(;k<400;k++){ const done=await page.evaluate(()=>{ const host=document.getElementById('msRun'); if(!host) return 'gone'; if(/Забег пройден/.test(host.innerText)) return 'end';
        const q=s=>[...host.querySelectorAll(s)].filter(b=>!b.disabled&&b.offsetParent!==null);
        const c=q('[data-c]'); if(c.length){ c[0].click(); return 'conf'; }
        const opt=q('.ms-opt'); if(opt.length){ opt[0].click(); return 'opt'; }
        const v=q('[data-v="1"]'); if(v.length){ v[0].click(); return 'self'; }
        const show=q('#msShow'); if(show.length){ show[0].click(); return 'show'; }
        const giv=q('.ms-stage .btn:not(.pri)').filter(b=>/Показать ошибку/.test(b.textContent)); if(giv.length){ giv[0].click(); return 'bug'; }
        const nx=q('.ms-stage .btn.pri'); if(nx.length){ nx[nx.length-1].click(); return 'next'; }
        return 'wait'; });
      if(done==='end'||done==='gone') break; await page.waitForTimeout(done==='wait'?300:40); }
    const end=await page.evaluate(()=>({t:(document.getElementById('msRun')||{}).innerText||'',n:ST.get('runs',[]).length,att:ST.get('att',[]).length}));
    if(!/Забег пройден/.test(end.t)) add('#/run','забег не доходит до итогов','шагов '+k);
    if(errs.length>before) add('#/run','ошибка JS в забеге',errs.slice(before).join(' / '));
    const x=await page.evaluate(()=>{ window.scrollTo(400,window.scrollY); return window.scrollX; }); if(x>0) add('#/run','(е) прокрутка на итогах',x);
    info.push('Забег: пройден нажатиями за '+k+' действий, попыток записано '+end.att); }
  await page.close();
  return {bad,info};
}
module.exports={masteryCheck};

if(require.main===module){ (async()=>{
  const http=require('http'), fs=require('fs'), path=require('path');
  let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const ROOT=path.join(__dirname,'..'), T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json'};
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const r=await masteryCheck(browser,'http://127.0.0.1:'+srv.address().port+'/');
  await browser.close(); srv.close(); console.log(r.info.join('\n'));
  if(r.bad.length){ console.log('\nОШИБКИ:\n- '+r.bad.map(o=>[o.name,o.rule,o.msg].join(' | ')).join('\n- ')); process.exit(1); } console.log('\nОшибок нет.');
})(); }
