/* Режим эфира #/live/show (LIVESHOW): разбор пирамиды SABC.
   1) ответы на слайдах пересчитываются независимо — по координатам вершин, без кода построения
      (высота — расстояние до плоскости, двугранный угол — по нормалям, стороны, радиус описанной окружности, угол ребра);
   2) каждая задача сама сверяет построенный чертёж с пространством (флаг ok: H′, H″ — основание перпендикуляра,
      K ≡ H, M — равноудалена от A, B, C и лежит в плоскости, C̄ — на расстоянии натурального радиуса);
   3) все шаги всех задач проходятся стрелкой без ошибок, у каждого шага задачи — чертёж и строчка «На чертеже»;
   4) подписи на чертеже не налезают друг на друга и не выходят за край (экран 1600×900);
   5) карточка эфира на главной: ближайший эфир и перенос (PROMO.next).
   Отдельно: node tests/live.js */
'use strict';
const P={A:[80,0,20],B:[0,30,30],C:[60,50,0],S:[40,35,50]};
const sub=(a,b)=>a.map((v,i)=>v-b[i]), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), len=a=>Math.hypot(...a);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], unit=a=>a.map(v=>v/len(a));
const fm=v=>(Math.round(v*10)/10).toFixed(1).replace('.',',');
function expected(){ const {A,B,C,S}=P, n=unit(crs(sub(B,A),sub(C,A))), H=Math.abs(dot(sub(S,A),n));
  const e=unit(sub(B,A)), pr=X=>{ const w=sub(X,A); return unit(sub(w,e.map(v=>v*dot(w,e)))); };      /* перпендикуляры к AB в гранях */
  const dih=Math.acos(dot(pr(C),pr(S)))*180/Math.PI;                                                   /* двугранный угол при AB */
  const a=len(sub(B,C)), b=len(sub(C,A)), c=len(sub(A,B)), s=(a+b+c)/2, R=a*b*c/(4*Math.sqrt(s*(s-a)*(s-b)*(s-c)));
  const phi=Math.asin(H/len(sub(S,A)))*180/Math.PI;
  return {h:'H = |S₄H₄| = '+fm(H)+' мм',dih:'φ = '+fm(dih)+'°',nv:[fm(c),fm(a),fm(b),fm(R)],phi:fm(phi)+'°'}; }

async function liveCheck(page,URL){
  const out=[], add=(name,rule,msg)=>out.push({name,rule,msg});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.setViewportSize({width:1600,height:900});
  await page.goto(URL+'#/live/show'); await page.waitForTimeout(1200);
  const tasks=await page.evaluate(()=>LIVESHOW._tasks.map(t=>({id:t.id,ok:t.ok,ans:t.ans,n:t.steps.length,v:t.steps.every(s=>s.v&&s.t&&s.s)})));
  const E=expected();
  tasks.forEach(t=>{ if(t.ok===false) add('эфир: задача '+t.id,'сверка с пространством','построенный чертёж не совпал с пространством');
    if(!t.v) add('эфир: задача '+t.id,'шаги','у шага нет заголовка, пояснения или строчки «На чертеже»'); });
  const ans=id=>(tasks.find(t=>t.id===id)||{}).ans||'';
  if(!ans('h').includes(E.h)) add('эфир: высота','ответ','ждали «'+E.h+'», на слайде «'+ans('h')+'»');
  if(!ans('dih').includes(E.dih)) add('эфир: угол граней','ответ','ждали «'+E.dih+'», на слайде «'+ans('dih')+'»');
  E.nv.forEach(x=>{ if(!ans('nv').includes(x)) add('эфир: истинный вид','ответ','нет числа '+x+' в «'+ans('nv')+'»'); });
  if(!ans('phi').endsWith(E.phi)) add('эфир: угол SA','ответ','ждали φ = '+E.phi+', на слайде «'+ans('phi')+'»');
  /* все слайды стрелкой: на каждом шаге задачи — чертёж, подписи не налезают и не выходят за край */
  const total=await page.evaluate(()=>{ const S=LIVESHOW._state(); return S.slides.reduce((n,s)=>n+(s.n||0)+1,0); });
  for(let i=0;i<total;i++){
    const r=await page.evaluate(()=>{ const S=LIVESHOW._state(), sl=S.slides[S.i], res={where:(sl.task?sl.task.id:sl.kind)+' · шаг '+S.k,bad:[]};
      if(sl.kind!=='task') return res;
      const svg=document.querySelector('[data-lx-ep] svg'); if(!svg){ res.bad.push('нет чертежа'); return res; }
      const box=svg.getBoundingClientRect(), T=[...svg.querySelectorAll('text')].map(t=>({s:t.textContent,b:t.getBoundingClientRect()}));
      /* при приближении часть чертежа за кадром — подпись целиком за краем не в счёт, обрезанная — ошибка */
      const inside=b=>b.right>box.left&&b.left<box.right&&b.bottom>box.top&&b.top<box.bottom;
      T.forEach(t=>{ if(inside(t.b)&&(t.b.left<box.left-1||t.b.right>box.right+1||t.b.top<box.top-1||t.b.bottom>box.bottom+1)) res.bad.push('подпись «'+t.s+'» обрезана краем'); });
      for(let i=0;i<T.length;i++) for(let j=i+1;j<T.length;j++){ const a=T[i].b, b=T[j].b, w=Math.min(a.right,b.right)-Math.max(a.left,b.left), h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
        if(w>3&&h>3) res.bad.push('подписи «'+T[i].s+'» и «'+T[j].s+'» налезают'); }
      if(S.k>0&&S.k<=sl.task.steps.length&&!document.querySelector('.lx-v li.now')) res.bad.push('нет строчки «На чертеже»');
      return res; });
    r.bad.forEach(b=>add('эфир: '+r.where,'чертёж',b));
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(30);
  }
  /* клавиши 0–6 и выход */
  await page.keyboard.press('3'); const j=await page.evaluate(()=>{ const S=LIVESHOW._state(); return S.slides[S.i].task&&S.slides[S.i].task.n; });
  if(j!==3) add('эфир','клавиши','клавиша 3 открыла не задачу 3');
  /* карточка на главной: ближайший эфир и перенос */
  const pm=await page.evaluate(()=>[PROMO.next(Date.parse('2026-11-10T19:30:00Z')),PROMO.next(Date.parse('2026-11-11T15:30:00Z')),PROMO.next(Date.parse('2026-11-11T16:30:00Z'))]);
  if(!pm[0]||pm[0].rel!=='завтра'||pm[0].time!=='18:00'||pm[0].moved!=='20:00') add('карточка эфира','перенос','10.11 вечером ближайший — завтра в 18:00 (перенос с 20:00): '+JSON.stringify(pm[0]));
  if(!pm[1]||!pm[1].live) add('карточка эфира','идёт','11.11 в 18:30 эфир идёт: '+JSON.stringify(pm[1]));
  if(!pm[2]||pm[2].day!=='2026-11-12') add('карточка эфира','после','после эфира 11.11 ближайший — 12.11: '+JSON.stringify(pm[2]));
  /* раздел «Вращение» (#/ng/rot): задачи сверены с пространством, «Покрути сам» доходит до цели, шаги проходятся без ошибок */
  await page.goto(URL+'#/ng/rot'); await page.waitForTimeout(900);
  const rot=await page.evaluate(()=>{ const out=[]; ROT.T.forEach(t=>{ if(t.ok!==true) out.push('задача «'+t.t+'»: чертёж не совпал с пространством'); });
    Object.entries(ROT.MODES).forEach(([k,M])=>{ const m=M.miss(M.at(M.target)); if(!(m<0.6)) out.push('«Покрути сам» ('+k+'): в цели осталось '+m.toFixed(2)+'°'); });
    if(Math.abs(ROT.MODES.i.miss(ROT.MODES.i.at(0))-0)<1) out.push('«Покрути сам» (i): цель достигнута уже без поворота');
    return out; });
  rot.forEach(m=>add('вращение','сверка',m));
  for(let ti=0;ti<3;ti++){ await page.evaluate(i=>document.querySelectorAll('[data-epx-t]')[i].click(),ti);
    for(let k=0;k<14;k++){ const nb=await page.$('[data-epx-go="1"]:not([disabled])'); if(!nb) break; await nb.click(); } }
  if(!(await page.$('.hc-rot'))){ await page.goto(URL); await page.waitForTimeout(800); if(!(await page.$('.hc-rot'))) add('главная','карточка','нет карточки «Способ вращения»'); }
  errs.forEach(e=>add('эфир','ошибка JS',e));
  return out; }
module.exports={liveCheck};

if(require.main===module){ (async()=>{
  const http=require('http'), fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
  let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1');
  await new Promise(f=>srv.on('listening',f));
  const b=await chromium.launch(), page=await b.newPage();
  const out=await liveCheck(page,'http://127.0.0.1:'+srv.address().port+'/');
  out.forEach(o=>console.log([o.name,o.rule,o.msg].join(' | '))); console.log(out.length?'замечаний: '+out.length:'режим эфира: всё верно');
  await b.close(); srv.close(); process.exit(out.length?1:0); })(); }
