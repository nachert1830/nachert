/* Режим эфира #/live/show (LIVESHOW): «РК2 за 9 шагов» — 9 задач RK9 в формате А/Б/В; раздел «Способ вращения» (#/ng/rot).
   1) ответы на слайдах пересчитываются независимо — по координатам из условия, без кода построения
      (угол между прямыми, угол наклона плоскости, расстояния, двугранный угол);
   2) каждая задача сама сверяет построенный чертёж с пространством (флаг ok: натуральная величина, точки после обратного перехода,
      равные стороны построенных фигур, общий перпендикуляр);
   3) все шаги всех задач проходятся стрелкой без ошибок, у каждого шага задачи — чертёж и строчка «На чертеже»;
   4) подписи на чертеже не налезают друг на друга и не обрезаны краем (экран 1600×900);
   5) карточка эфира на главной: ближайший эфир и перенос (PROMO.next); 6) раздел «Вращение».
   Отдельно: node tests/live.js */
'use strict';
const sub=(a,b)=>a.map((v,i)=>v-b[i]), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), len=a=>Math.hypot(...a);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], unit=a=>a.map(v=>v/len(a));
const fm=v=>(Math.round(v*10)/10).toFixed(1).replace('.',',');
const deg=x=>x*180/Math.PI, angV=(u,v)=>deg(Math.acos(Math.max(-1,Math.min(1,dot(unit(u),unit(v))))));
/* условия — те же числа, что в RK9 (index.html); ответы считаем по определению */
function expected(){ const E={};
  { const K=[54,44,2],L=[94,10,50],M=[14,12,46], a=angV(sub(L,K),sub(M,K)); E.ang='φ = '+fm(Math.min(a,180-a)<a?a:a)+'°'; }
  { const A=[92,12,12],B=[52,48,46],C=[18,14,28], n=unit(crs(sub(B,A),sub(C,A))); E.incl='α = '+fm(deg(Math.acos(Math.abs(n[2]))))+'°'; }
  { const A=[96,10,14],B=[40,42,44],C=[75,4,40],D=[15,40,14], n=crs(sub(B,A),sub(D,C)); E.dll='d = '+fm(Math.abs(dot(sub(C,A),n))/len(n))+' мм'; }
  { const A=[92,40,12],B=[54,8,36],C=[16,30,18],S=[46,52,58], n=unit(crs(sub(B,A),sub(C,A))); E.dpp='d = '+fm(Math.abs(dot(sub(S,A),n)))+' мм'; }
  { const A=[94,14,12],B=[30,36,40],C=[70,52,48],D=[48,4,52], e=unit(sub(B,A)), pr=X=>{ const w=sub(X,A); return sub(w,e.map(v=>v*dot(w,e))); }; E.dih='φ = '+fm(angV(pr(C),pr(D)))+'°'; }
  { const A=[95,12,12],B=[55,52,48],C=[20,18,26]; E.nv=[fm(len(sub(A,B))),fm(len(sub(B,C))),fm(len(sub(C,A)))]; }
  return E; }

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
  if(tasks.length!==9) add('эфир','задачи','ждали 9 задач, есть '+tasks.length);
  ['ang','incl','dll','dpp','dih'].forEach(id=>{ if(!ans(id).includes(E[id])) add('эфир: '+id,'ответ','ждали «'+E[id]+'», на слайде «'+ans(id)+'»'); });
  E.nv.forEach(x=>{ if(!ans('nv').includes(x)) add('эфир: nv','ответ','нет числа '+x+' в «'+ans('nv')+'»'); });
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
  /* раздел «Способ вращения» (#/ng/rot): 7 задач сверены с пространством, ответы пересчитаны независимо, все шаги проходятся */
  await page.goto(URL+'#/ng/rot'); await page.waitForTimeout(900);
  const rot=await page.evaluate(()=>{ const out=[], T=ROT.T; if(T.length!==7) out.push('задач '+T.length+', нужно 7');
    T.forEach(t=>{ if(t.ok!==true) out.push('задача «'+t.t+'»: чертёж не совпал с пространством'); });
    const D=Math.PI/180, sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], L=a=>Math.hypot(...a), num=s=>+String(s).replace(/[^0-9,]/g,' ').trim().split(/\s+/)[0].replace(',','.');
    /* независимо: угол наклона ABC к π₁ и плоскости (a, A) к π₂, расстояние между a ∥ b */
    const n1=cr(sub([70,50,50],[105,20,15]),sub([40,10,30],[105,20,15])), a1=Math.acos(Math.abs(n1[2])/L(n1))/D;
    const n2=cr(sub([105,45,15],[30,25,10]),sub([60,15,45],[30,25,10])), a2=Math.acos(Math.abs(n2[1])/L(n2))/D;
    const dd=[-42,38,-36], d4=L(cr(sub([60,6,60],[106,8,66]),dd))/L(dd);
    [[0,a1],[1,a2],[3,d4]].forEach(([i,v])=>{ if(Math.abs(num(T[i].ans)-v)>0.06) out.push('ответ задачи '+(i+1)+': '+T[i].ans+' ≠ '+v.toFixed(1)); });
    if(ROT.schemeH().ok!==true) out.push('схема «вокруг линии уровня» не совпала с пространством');
    return out; });
  rot.forEach(m=>add('вращение','сверка',m));
  for(let ti=0;ti<7;ti++){ await page.evaluate(i=>document.querySelectorAll('[data-rt-t]')[i].click(),ti);
    for(let k=0;k<14;k++){ const nb=await page.$('[data-rt-go="1"]:not([disabled])'); if(!nb) break; await nb.click(); } }
  if(!(await page.$('.rt-ans.show'))) add('вращение','ответ','после всех шагов ответ не показан');
  /* главная: справа — подсвеченная карточка «РК2 за 9 шагов» (раздел «Вращение» открывается из неё и по адресу #/ng/rot) */
  { await page.goto(URL); await page.waitForTimeout(800); if(!(await page.$('.hc-rk9[href="#/ng/rk2"]'))) add('главная','карточка','нет карточки «РК2 за 9 шагов»'); }
  /* ДЗ №3 «Как на листе»: пять задач пирамиды на всех 30 вариантах сходятся с пространством; страница варианта открывается */
  await page.goto(URL+'#/ng3/12/sheet'); await page.waitForTimeout(1200);
  const pyr=await page.evaluate(()=>{ const out=[], d=DZR.get?DZR.get('ng3'):null, V=(d&&d.V)||{};
    Object.keys(V).forEach(n=>{ try{ PYR(V[n]).forEach(t=>{ if(t.ok===false) out.push('вариант '+n+': задача «'+t.t+'» не сошлась'); }); }catch(e){ out.push('вариант '+n+': '+e.message); } });
    if(!Object.keys(V).length) out.push('нет данных вариантов ДЗ №3'); if(!document.querySelector('#dzSheetPl svg')) out.push('нет чертежа на странице варианта'); return out; });
  pyr.forEach(m=>add('ДЗ №3 как на листе','сверка',m));
  /* прямые углы доведены: у каждого знака ⊾ на каждом шаге обе стороны угла нарисованы видимыми линиями до самой вершины
     (раздел «Вращение», 9 задач РК2/эфира, ДЗ №3 на всех 30 вариантах) */
  const sqBad=await page.evaluate(()=>{ const s2=(a,b)=>[a[0]-b[0],a[1]-b[1]], l2=a=>Math.hypot(a[0],a[1]), u2=a=>{ const L=l2(a)||1; return [a[0]/L,a[1]/L]; }, dt=(a,b)=>a[0]*b[0]+a[1]*b[1];
    const covers=(segs,v,dir)=>segs.some(([p,q])=>{ const d=u2(s2(q,p)), L=l2(s2(q,p)); if(Math.abs(Math.abs(dt(d,dir))-1)>2e-3) return false;
      const t=dt(s2(v,p),d), off=l2(s2(s2(v,p),[d[0]*t,d[1]*t])); if(off>.15) return false; const reach=dt(d,dir)>0?L-t:t; return t>-.2&&t<L+.2&&reach>3; });
    const out=new Set(), chk=(name,t)=>{ const it=t.D.it, n=t.steps.length;
      for(let k=0;k<=n;k++){ const vis=it.filter(o=>o.st<=k&&(o.till==null||k<=o.till)), segs=vis.filter(o=>o.k==='seg'&&o.c!=='link').map(o=>[o.p,o.q]);
        vis.filter(o=>o.k==='sq').forEach(o=>['p','q'].forEach(w=>{ if(!covers(segs,o.v,u2(s2(o[w],o.v)))) out.add(name+': знак прямого угла без стороны (шаг '+k+')'); })); } };
    ROT.T.forEach(t=>chk('вращение '+t.n,t)); RK9.T.forEach(t=>chk('РК2 '+t.n,t));
    const V=(DZR.get('ng3')||{}).V||{}; Object.keys(V).forEach(nv=>PYR(V[nv]).forEach(t=>chk('ДЗ №3 в.'+nv+' задача '+t.n,t)));
    return [...out]; });
  sqBad.forEach(m=>add('чертёж','прямой угол',m));
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
