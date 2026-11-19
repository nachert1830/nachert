#!/usr/bin/env node
/* Подготовка (#/prep): программа, карточки дуэлей, модель освоения, экраны.  node tests/prep.js [--n=300]
   1. Программа (kernel/prep.js): каждая задача тетради, вопрос РК1, тип РК2 и ДЗ закрыты темой; темы опираются только на
      темы раньше по порядку; у каждой темы есть что закрывать; идеи не повторяются.
   2. Карточки (prep/*.js): для каждой темы и ловушки — сотни случайных пар. Проверка независима от кода построения:
      точка восстанавливается по двум проекциям и проверяется в пространстве (лежит на обеих поверхностях, на плоскости,
      линия связи ⟂ оси x, видимость — по положению точки относительно половин поверхностей).
      Верная карточка проходит все правила; неверная проваливает хотя бы одно; элементы вне «отличия» ловушки (hl) совпадают.
   3. Модель освоения (Эло + правило 85 % + BKT): «знает» (92 % верно) осваивает в среднем ≤ 15 пар; «угадывает» (50 %) получает
      ложное «освоено» реже чем в 1 % из 10 000 прогонов.
   4. Экраны в браузере: программа, каждая тема («Смотри» до конца, дуэль, ответ), ДЗ №4 — карточка подготовки и «Решаю сам». */
'use strict';
const fs=require('fs'), path=require('path'), http=require('http');
const ROOT=path.join(__dirname,'..');
const N=+((process.argv.find(a=>a.startsWith('--n='))||'').slice(4)||300);
global.self=global;
require(path.join(ROOT,'kernel/prep.js')); require(path.join(ROOT,'prep/engine.js')); require(path.join(ROOT,'prep/x.js'));
const G=self.PREPROG, PREP=self.PREP;
const fails=[], info=[];
const bad=(s)=>fails.push(s);

/* ── 1. программа ── */
{ const A=G.audit();
  if(A.wb.length!==89) bad('программа: не закрыты задачи тетради '+Array.from({length:89},(_,i)=>i+1).filter(n=>!A.wb.includes(n)).join(', '));
  if(A.rk1.length!==G.RK1.length) bad('программа: не закрыты вопросы РК1 '+G.RK1.filter(n=>!A.rk1.includes(n)).join(', '));
  if(A.rk2.length!==Object.keys(G.RK2).length) bad('программа: не закрыты типы РК2');
  if(A.dz.length!==5) bad('программа: не закрыты ДЗ');
  if(A.badOrder.length) bad('программа: тема опирается на более позднюю или несуществующую: '+A.badOrder.join(', '));
  if(A.orphan.length) bad('программа: темы ничего не закрывают: '+A.orphan.join(', '));
  if(A.dupNew.length) bad('программа: повтор идеи: '+A.dupNew.join(', '));
  for(const id of Object.keys(PREP.TOPICS)) if(!G.BY[id]) bad('тема '+id+' не из программы');
  info.push(`Программа: ${G.ALL.length} тем, тетрадь ${A.wb.length}/89, РК1 ${A.rk1.length}/${G.RK1.length}, РК2 ${A.rk2.length}/9, ДЗ ${A.dz.length}/5`); }

/* ── 2. независимые геометрические правила по темам ── */
const E=(S,r)=>S.E.filter(e=>e.role===r);
const P=(S,r)=>{ const e=S.E.find(x=>x.role===r&&x.t==='pt'); return e?e.a:null; };
const TOL=.35;
const rsph=(R,z)=>Math.sqrt(Math.max(0,R*R-z*z));
function segsCross(p){ let n=0; for(let i=0;i+1<p.length;i++) for(let j=i+2;j+1<p.length;j++){ if(i===0&&j+1===p.length-1) continue;
  const [a,b,c,d]=[p[i],p[i+1],p[j],p[j+1]], o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));
  if(o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0) n++; } return n; }
const CHECK={
  /* точки линии сфера ∩ конус: по 1′ и 1″ — пространство */
  x3(V,S){ const v=[]; const pairs=[['p1h','p1f'],['p2h','p2f']].map(([h,f])=>[P(S,h),P(S,f)]).filter(q=>q[0]&&q[1]);
    if(pairs.length<2) v.push('две точки');
    for(const [h,f] of pairs){ if(Math.abs(h[0]-f[0])>TOL) { v.push('линия связи ⟂ x'); continue; }
      const x=h[0], y=h[1]-V.Ys, z=-f[1];
      if(Math.abs(Math.hypot(x,y,z)-V.R)>TOL) v.push('точка на сфере');
      if(Math.abs(Math.hypot(x-V.xc,h[1]-V.yc)-V.Rc*(1-z/V.Hc))>TOL) v.push('точка на конусе');
      if(Math.abs(z-S._h)>TOL) v.push('точка на плоскости γ'); }
    return v; },
  /* видимость на π₂: участок виден ⟺ его точки на передних половинах обеих поверхностей; на π₁ — без самопересечений */
  x7(V,S){ const v=[]; const ch=E(S,'ch')[0]; if(segsCross(ch.p)>0) v.push('кривая без петель');
    for(const e of E(S,'cf')){ if(e.p.length<4) continue; let wrong=0;
      for(let k=1;k<e.p.length-1;k++){ const m=e.p[k], q=V.curve.reduce((b,c)=>Math.hypot(c[0]-m[0],-c[2]-m[1])<Math.hypot(b[0]-m[0],-b[2]-m[1])?c:b);
        if((q[1]>=V.Ys-1e-6&&q[1]>=V.yc-1e-6)===!!e.dash) wrong++; }
      if(wrong>1) v.push('видимость участка'); }
    return v; },
  f3(V,S){ const v=[]; const A1=P(S,'A1'), A2=S.base.find(e=>e.lab==='A″').a; if(Math.abs(A1[0]-A2[0])>TOL) v.push('линия связи ⟂ x');
    const x=A1[0], y=A1[1]-V.Y0, z=-A2[1], r=V.kind==='cone'?V.R*(1-z/V.H):rsph(V.R,z);
    if(Math.abs(Math.hypot(x,y)-r)>TOL) v.push('точка на поверхности'); if(y<0) v.push('A″ видна — A спереди'); return v; },
  x1(V,S){ const v=[]; const f=P(S,'p2f'), hs=[P(S,'p2h'),P(S,'p3h')].filter(Boolean); if(hs.length<2) v.push('две точки');
    const z=-f[1]; if(Math.abs(z-V.zf(f[0]))>TOL) v.push('точка на следе f₀α');
    for(const h of hs){ if(Math.abs(h[0]-f[0])>TOL){ v.push('линия связи ⟂ x'); continue; } if(Math.abs(Math.hypot(h[0],h[1]-V.Y0)-V.R*(1-z/V.H))>TOL) v.push('точка на конусе'); }
    return v; },
  x4(V,S){ const v=[]; const h=P(S,'p1h'), f=P(S,'p1f'); if(Math.abs(h[0]-f[0])>TOL) v.push('линия связи ⟂ x');
    const x=h[0], y=h[1]-V.Ys, z=-f[1]; if(Math.abs(Math.hypot(x,y,z)-V.R)>TOL) v.push('точка на сфере');
    if(Math.abs(Math.hypot(h[0]-V.xq,h[1]-V.yq)-V.rq)>TOL) v.push('точка на цилиндре'); return v; },
  /* K″ — проекция общей точки: радиусы соосных сфер через сечение конуса и цилиндра на этом уровне равны */
  x5(V,S){ const v=[]; const K=P(S,'K'), z=-K[1], w=V.R*(1-z/V.H); if(Math.abs(K[0])>w+TOL) v.push('точка внутри конуса');
    const u=[V.ux,V.uy], n=[-V.uy,V.ux], d=[K[0],K[1]+V.zO], s=d[0]*u[0]+d[1]*u[1], t=d[0]*n[0]+d[1]*n[1];
    if(Math.abs(t)>V.rq+TOL) v.push('точка внутри цилиндра');
    /* точка конуса с этой фронтальной проекцией: x = K.x, y = ±√(w² − x²); на цилиндре: расстояние до оси = rq */
    const yy=Math.sqrt(Math.max(0,w*w-K[0]*K[0])); const ok=[yy,-yy].some(y=>Math.abs(Math.sqrt(t*t+y*y)-V.rq)<.6);
    if(!ok) v.push('точка на обеих поверхностях'); return v; },
  x9(V,S){ const v=[]; const O2=[0,-V.Zc], O1=[0,V.Yc], A2=[V.x,-(V.Zc+V.z)], A1=[V.x,V.Yc+V.y];
    const L=r=>E(S,r).find(e=>e.t==='line').a, onL=(l,p)=>Math.abs((l[2]-l[0])*(p[1]-l[1])-(l[3]-l[1])*(p[0]-l[0]))/Math.hypot(l[2]-l[0],l[3]-l[1])<TOL;
    const dir=l=>[l[2]-l[0],l[3]-l[1]], perp=(a,b)=>Math.abs(a[0]*b[0]+a[1]*b[1])/Math.hypot(...a)/Math.hypot(...b)<.01, horiz=l=>Math.abs(l[1]-l[3])<1e-6;
    if(!onL(L('n1'),O1)||!onL(L('n1'),A1)) v.push('n′ через O′ и A′'); if(!onL(L('n2'),O2)||!onL(L('n2'),A2)) v.push('n″ через O″ и A″');
    if(!horiz(L('h2'))) v.push('h″ ∥ x'); if(!perp(dir(L('h1')),dir(L('n1')))) v.push('h′ ⟂ n′');
    if(!horiz(L('f1'))) v.push('f′ ∥ x'); if(!perp(dir(L('f2')),dir(L('n2')))) v.push('f″ ⟂ n″'); return v; }
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const geo=e=>({t:e.t,a:e.a&&e.a.map(x=>Math.round(x*1e3)),p:e.p&&e.p.map(q=>q.map(x=>Math.round(x*1e3))),dash:!!e.dash});
for(const [id,T] of Object.entries(PREP.TOPICS)){
  if(!CHECK[id]){ bad(`тема ${id}: нет независимой проверки в tests/prep.js`); continue; }
  for(const k of Object.keys(T.traps)){
    let made=0, okFail=0, badPass=0, extra=0;
    for(let i=0;i<N;i++){
      const pr=PREP.pair(T,k); if(!pr) continue; made++;
      const vo=CHECK[id](pr.V,pr.ok), vb=CHECK[id](pr.V,pr.bad);
      if(vo.length){ okFail++; if(okFail<=2) bad(`${id}/${k}: верная карточка не проходит: ${vo.join(', ')}`); }
      if(!vb.length){ badPass++; if(badPass<=2) bad(`${id}/${k}: ловушка проходит все правила (не ошибка?)`); }
      /* отличие — только в элементах ловушки */
      const hl=new Set(T.traps[k].hl);
      const roles=new Set([...pr.ok.E,...pr.bad.E].map(e=>e.role).filter(r=>!hl.has(r)));
      for(const r of roles){ if(!same(E(pr.ok,r).map(geo),E(pr.bad,r).map(geo))){ extra++; if(extra<=1) bad(`${id}/${k}: отличается не только «${[...hl].join(', ')}», но и «${r}»`); } }
    }
    if(made<N*.5) bad(`${id}/${k}: честная пара нашлась только в ${made} из ${N} попыток`);
    info.push(`${id}/${k}: пар ${made}, верная не прошла ${okFail}, ловушка прошла ${badPass}, лишние отличия ${extra}`);
  }
  /* разбор по шагам: последний шаг показывает все роли верного чертежа */
  const W=T.watch; let V=null; for(let t=0;t<50&&!(V&&T.scene(V,null));t++) V=W.V?W.V.call(T):T.make.call(T);
  const S=T.scene(V,null), last=new Set(W.steps[W.steps.length-1].roles);
  const miss=[...new Set(S.E.map(e=>e.role))].filter(r=>!last.has(r)); if(miss.length) bad(`${id}: «Смотри» не показывает ${miss.join(', ')}`);
}

/* ── 3. модель освоения на смоделированных студентах ── */
{ const T=PREP.TOPICS.x3, runs=10000;
  const sim=(pRight,cap)=>{ const M=PREP.Model(T,null); for(let n=1;n<=cap;n++){ const k=M.next(); M.last=k; M.answer(k,Math.random()<pRight,4000); if(M.mastered()) return n; } return 0; };
  let sum=0, cnt=0; for(let i=0;i<2000;i++){ const n=sim(.92,60); if(n){ sum+=n; cnt++; } }
  const avg=sum/cnt; if(avg>15) bad(`модель: «знает» осваивает в среднем за ${avg.toFixed(1)} пар (> 15)`);
  let fake=0; for(let i=0;i<runs;i++) if(sim(.5,40)) fake++;
  if(fake/runs>=.01) bad(`модель: «угадывает» получает «освоено» в ${(fake/runs*100).toFixed(2)} % прогонов (≥ 1 %)`);
  info.push(`Модель: «знает» — в среднем ${avg.toFixed(1)} пар (освоили ${cnt} из 2000), «угадывает» — ложное «освоено» ${(fake/runs*100).toFixed(2)} %`); }

/* ── 4. экраны ── */
async function screens(){
  let chromium; try{ ({chromium}=require('playwright')); }catch(e){ info.push('Экраны: playwright не найден — пропущено'); return; }
  const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const U='http://127.0.0.1:'+srv.address().port+'/';
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage({viewport:{width:390,height:844}}); const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(U+'#/prep'); await page.waitForTimeout(1200);
  const st=await page.evaluate(()=>({n:document.querySelectorAll('.pp-st').length,ow:document.documentElement.scrollWidth>innerWidth}));
  if(st.n!==G_N) bad(`Экран программы: ${st.n} тем вместо ${G_N}`); if(st.ow) bad('Экран программы: горизонтальная прокрутка');
  for(const id of Object.keys(PREP.TOPICS)){
    await page.goto(U+'#/prep/'+id); await page.waitForTimeout(300);
    const r=await page.evaluate(async()=>{
      const wait=ms=>new Promise(f=>setTimeout(f,ms)); const q=s=>document.querySelector(s);
      q('[data-ph="watch"]').click(); await wait(50);
      for(let i=0;i<10;i++){ const b=q('#ppNext'); if(!b) return 'нет кнопки «Дальше»'; const last=/провер/.test(b.textContent); b.click(); await wait(30); if(last) break; }
      if(!q('#ppA')||!q('#ppB')) return 'нет карточек дуэли';
      const box=e=>e.getBoundingClientRect(), A=box(q('#ppA')), B=box(q('#ppB')), nav=q('.nav-bot');
      if(A.height<160||B.height<160) return 'карточки ниже 160 px';
      if(B.bottom>innerHeight+1) return 'нижняя карточка за краем экрана';
      if(nav&&getComputedStyle(nav).display!=='none') return 'нижнее меню сайта видно поверх дуэли';
      q('#ppA').click(); await wait(80);
      if(!q('#ppA').classList.contains('ok')&&!q('#ppA').classList.contains('bad')) return 'ответ не засчитан';
      return '';
    });
    if(r) bad(`Экран темы ${id}: ${r}`);
  }
  await page.goto(U+'#/ng4'); await page.waitForTimeout(1500);
  if(!await page.$('.pp-dzcard')) bad('ДЗ №4: нет карточки «Подготовка»');
  await page.evaluate(()=>{ const a=document.querySelector('[data-setvar="13"]'); a&&a.click(); }); await page.waitForTimeout(1800);
  const m=await page.evaluate(()=>{ const b=document.querySelector('.pl-mode.on'); return [b&&b.dataset.m,!!document.querySelector('.pp-dzchip')]; });
  if(m[0]!=='try') bad('ДЗ №4, свой вариант: открылся не в «Решаю сам»'); if(!m[1]) bad('ДЗ №4, свой вариант: нет строки подготовки');
  if(errs.length) bad('Ошибка JS: '+errs[0].slice(0,200));
  info.push(`Экраны: программа, ${Object.keys(PREP.TOPICS).length} тем, ДЗ №4`);
  await browser.close(); srv.close();
}
const G_N=G.ALL.length;
screens().then(()=>{
  info.forEach(s=>console.log('  '+s));
  if(fails.length){ console.log('\nПодготовка: замечаний '+fails.length); fails.forEach(s=>console.log('  ✗ '+s)); process.exit(1); }
  console.log('\nПодготовка: замечаний 0');
}).catch(e=>{ console.error(e); process.exit(1); });
