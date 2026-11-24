#!/usr/bin/env node
/* Подготовка (#/prep): программа, карточки дуэлей, модель освоения, экраны.  node tests/prep.js [--n=300]
   1. Программа (kernel/prep.js): каждая задача тетради, вопрос РК1, тип РК2 и ДЗ закрыты темой; темы опираются только на
      темы раньше по порядку; у каждой темы есть что закрывать; идеи не повторяются.
   2. Карточки (prep/*.js): для каждой темы и ловушки — сотни случайных пар. Проверка независима от кода построения:
      точка восстанавливается по двум проекциям и проверяется в пространстве (лежит на обеих поверхностях, на плоскости,
      линия связи ⟂ оси x, видимость — по положению точки относительно половин поверхностей).
      Верная карточка проходит все правила; неверная проваливает хотя бы одно; элементы вне «отличия» ловушки (hl) совпадают.
   3. Модель освоения (Эло + правило 85 % + BKT): «знает» (92 % верно) осваивает в среднем ≤ 17 пар; «угадывает» (50 %) получает
      ложное «освоено» реже чем в 1 % из 10 000 прогонов, и на каждой теме — меньше 1,5 % из 4000 (с запасом на разброс).
   4. Экраны в браузере: программа, каждая тема («Смотри» до конца, дуэль, ответ), ДЗ №4 — карточка подготовки и «Решаю сам». */
'use strict';
const fs=require('fs'), path=require('path'), http=require('http');
const ROOT=path.join(__dirname,'..');
const N=+((process.argv.find(a=>a.startsWith('--n='))||'').slice(4)||300);
global.self=global;
require(path.join(ROOT,'kernel/prep.js')); require(path.join(ROOT,'prep/engine.js')); require(path.join(ROOT,'prep/x.js')); require(path.join(ROOT,'prep/x-b.js')); require(path.join(ROOT,'prep/t.js')); require(path.join(ROOT,'prep/base.js')); require(path.join(ROOT,'prep/sm.js')); require(path.join(ROOT,'prep/more.js')); require(path.join(ROOT,'prep/rest.js')); require(path.join(ROOT,'prep/space.js')); require(path.join(ROOT,'prep/plans.js'));
const G=self.PREPROG, PREP=self.PREP;
const fails=[], info=[];
const bad=(s)=>fails.push(s);

/* ── 0. навыки к ДЗ и РК (prep/plans.js, копия /new/): у каждого ДЗ и РК начерта — навыки-темы с разбором и тестом, у инжи — разборы ── */
for(const c of G.COURSES){ if(!PREP.PLANS[c.key]) bad('нет навыков: '+c.label); }
for(const pl of Object.values(PREP.PLANS)){
  if(!pl.skills||pl.skills.length<3) bad(pl.key+': меньше трёх навыков');
  if(!(pl.w>0)) bad(pl.key+': нет недели срока');
  (pl.skills||[]).forEach((sk,i)=>{ const where=`${pl.key}, навык ${i+1}`;
    if(!sk.t) bad(where+': без названия');
    if(pl.subj==='ng'){ if(!G.BY[sk.topic]) bad(where+': нет темы '+sk.topic); else if(!PREP.TOPICS[sk.topic]) bad(where+': тема '+sk.topic+' без разбора и теста');
      else if(Object.keys(PREP.TOPICS[sk.topic].traps||{}).length<1) bad(where+': у темы нет ловушек для теста');
      const tk=(PREP.TASK||{})[sk.topic]; if(!tk||!tk.given||!tk.find) bad(where+': нет условия уровня (PREP.TASK.'+sk.topic+': что дано и что найти)'); }
    else if(!/^#\//.test(sk.see||'')) bad(where+': нет разбора'); }); }
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
  /* курсы: темы не повторяются, вместе — вся программа; всё, на что опирается тема курса, — в нём или в «нужно из прошлых» */
  { const own=G.COURSES.flatMap(c=>c.own); if(new Set(own).size!==own.length) bad('курсы: тема принадлежит двум курсам');
    if(own.length!==G.ALL.length) bad(`курсы: покрыто ${own.length} тем из ${G.ALL.length}`);
    for(const c of G.COURSES){ const has=new Set(c.own.concat(c.prev)); for(const id of c.own) for(const q of G.BY[id].pre) if(!has.has(q)) bad(`курс ${c.label}: тема ${id} опирается на ${q}, которой нет ни в курсе, ни в «нужно из прошлых»`);
      for(const id of c.prev) if(G.COURSES.indexOf(G.COURSE[G.OWNER[id]])>=G.COURSES.indexOf(c)) bad(`курс ${c.label}: «из прошлых» ${id} принадлежит не более раннему курсу`);
      if(c.kind==='dz') for(const id of c.own) if(!G.need(c.key).has(id)) bad(`курс ${c.label}: лишняя тема ${id}`); } }
  info.push(`Курсы: ${G.COURSES.map(c=>c.label+' '+c.own.length).join(', ')}`);
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
    if(!horiz(L('f1'))) v.push('f′ ∥ x'); if(!perp(dir(L('f2')),dir(L('n2')))) v.push('f″ ⟂ n″'); return v; },
  /* точки входа и выхода: на конусе и на AB; между ними прямая невидима */
  x8(V,S){ const v=[]; const A=V.A,B=V.B, onAB=p=>{ const d=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], w=[p[0]-A[0],p[1]-A[1],p[2]-A[2]], c=[d[1]*w[2]-d[2]*w[1],d[2]*w[0]-d[0]*w[2],d[0]*w[1]-d[1]*w[0]]; return Math.hypot(...c)/Math.hypot(...d)<TOL; };
    for(const [hh,ff] of [['k1h','k1f'],['k2h','k2f']]){ const h=P(S,hh), f=P(S,ff); if(!h||!f){ v.push('две точки'); continue; } if(Math.abs(h[0]-f[0])>TOL){ v.push('линия связи ⟂ x'); continue; }
      const q=[h[0],h[1]-V.Y0,-f[1]]; if(Math.abs(Math.hypot(q[0],q[1])-V.R*(1-q[2]/V.H))>TOL) v.push('точка на конусе'); if(!onAB(q)) v.push('точка на AB'); }
    const ins=E(S,'abi'); if(ins.length!==2||ins.some(e=>!e.dash)) v.push('внутренний участок — штрих'); return v; },
  x2(V,S){ const v=[]; for(const [ff,hh] of [['p1f','p1h'],['p2f','p2h']]){ const f=P(S,ff), h=P(S,hh); if(!f||!h){ v.push('обе точки очерков'); continue; }
      if(Math.abs(h[0]-f[0])>TOL){ v.push('линия связи ⟂ x'); continue; } const x=h[0], y=h[1]-V.Ys, z=-f[1];
      if(Math.abs(Math.hypot(x,y,z)-V.R)>TOL) v.push('точка на сфере'); if(Math.abs(Math.hypot(x-V.xc,y)-V.Rc*(1-z/V.Hc))>TOL) v.push('точка на конусе'); if(Math.abs(y)>TOL) v.push('в плоскости симметрии'); }
    return v; },
  /* K″ — проекция общей точки тора (ось ⟂ π₂ через O) и конуса: y из конуса, подставленный в уравнение тора */
  x6(V,S){ const v=[]; const K=P(S,'K'), z=-K[1], w=V.Rb*(1-z/V.Hk), dx=K[0]-V.xa; if(Math.abs(dx)>w+TOL){ v.push('точка внутри конуса'); return v; }
    const y=Math.sqrt(Math.max(0,w*w-dx*dx)), ra=Math.hypot(K[0],K[1]+V.zO); if(Math.abs((ra-V.Rc)**2+y*y-V.rt*V.rt)>2*V.rt*.6) v.push('точка на торе и конусе'); return v; },
  f2(V,S){ const v=[]; const Kh=P(S,'Kh'), K2=S.base.find(e=>e.lab==='K″').a; if(Math.abs(Kh[0]-K2[0])>TOL) v.push('линия связи ⟂ x');
    const q=[Kh[0],Kh[1]-V.Y0,-K2[1]], a=V.A,b=V.B,s=V.S, u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], w=[s[0]-a[0],s[1]-a[1],s[2]-a[2]], n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    if(Math.abs(n[0]*(q[0]-a[0])+n[1]*(q[1]-a[1])+n[2]*(q[2]-a[2]))/Math.hypot(...n)>TOL) v.push('точка в плоскости грани'); return v; },
  /* ── замена плоскостей и вращение: правила из определения, по данным варианта ── */
  t2(V,S){ const v=[]; const ax=L1(S,'x1'), e=un(ax), a1=[V.A[0],V.A[1]], b1=[V.B[0],V.B[1]], ab=un([a1[0],a1[1],b1[0],b1[1]]);
    if(Math.abs(cr(e,ab))>.003) v.push('x₁ ∥ A′B′');
    for(const [Q0,N,z] of [[a1,P(S,'A3'),V.A[2]],[b1,P(S,'B3'),V.B[2]]]){ if(!rep(Q0,N,ax,z)) v.push('новая проекция: ⟂ x₁, расстояние z, другая сторона'); }
    const A3=P(S,'A3'),B3=P(S,'B3'); if(Math.abs(Math.hypot(A3[0]-B3[0],A3[1]-B3[1])-Math.hypot(V.A[0]-V.B[0],V.A[1]-V.B[1],V.A[2]-V.B[2]))>TOL) v.push('A‴B‴ = |AB|'); return v; },
  t3(V,S){ const v=[]; const ax=L1(S,'x2'), A4=P(S,'A4'), B4=P(S,'B4'); if(Math.hypot(A4[0]-B4[0],A4[1]-B4[1])>.5) v.push('прямая — в точку');
    const A3=S.base.find(e=>e.lab==='A‴').a, B3=S.base.find(e=>e.lab==='B‴').a;
    if(!rep(A3,A4,ax,V.off)||!rep(B3,B4,ax,V.off)) v.push('⟂ x₂, расстояние — от A′ до x₁'); return v; },
  t4(V,S){ const v=[]; const ax=L1(S,'x1'), e=un(ax), N=['A3','B3','C3'].map(r=>P(S,r)), Pp=['A','B','C'].map(k=>[V[k][0],V[k][1]]);
    /* горизонталь плоскости ABC: направление на π₁ — где z постоянна */
    const {A,B,C}=V, u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], w=[C[0]-A[0],C[1]-A[1],C[2]-A[2]], hz=[u[0]*w[2]-u[2]*w[0], u[1]*w[2]-u[2]*w[1]];
    /* h ⟂ проекции нормали на π₁; x₁ ⟂ h ⇒ x₁ ∥ проекции нормали */
    const nz=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2]]; if(Math.abs(cr(e,[nz[0]/Math.hypot(...nz),nz[1]/Math.hypot(...nz)]))>.003) v.push('x₁ ⟂ h′');
    N.forEach((n,i)=>{ if(!rep(Pp[i],n,ax,V[['A','B','C'][i]][2])) v.push('⟂ x₁, расстояние z'); });
    const ar=Math.abs((N[1][0]-N[0][0])*(N[2][1]-N[0][1])-(N[2][0]-N[0][0])*(N[1][1]-N[0][1]))/Math.hypot(N[2][0]-N[0][0],N[2][1]-N[0][1]); if(ar>TOL) v.push('плоскость — прямая'); return v; },
  t6(V,S){ const v=[]; const A4=P(S,'A4'),B4=P(S,'B4'),C4=P(S,'C4'),D4=P(S,'D4'); if(Math.hypot(A4[0]-B4[0],A4[1]-B4[1])>.5) v.push('ребро — в точку');
    const {A,B,C,D:Dd}=V, ab=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], l=Math.hypot(...ab), k=ab.map(x=>x/l);
    const perp=P3=>{ const w=[P3[0]-A[0],P3[1]-A[1],P3[2]-A[2]], d=w[0]*k[0]+w[1]*k[1]+w[2]*k[2]; return [w[0]-d*k[0],w[1]-d*k[1],w[2]-d*k[2]]; };
    const c=perp(C), d=perp(Dd), true3=Math.acos(Math.max(-1,Math.min(1,(c[0]*d[0]+c[1]*d[1]+c[2]*d[2])/Math.hypot(...c)/Math.hypot(...d))));
    const g=[C4[0]-A4[0],C4[1]-A4[1]], h=[D4[0]-A4[0],D4[1]-A4[1]], ang=Math.acos(Math.max(-1,Math.min(1,(g[0]*h[0]+g[1]*h[1])/Math.hypot(...g)/Math.hypot(...h))));
    if(Math.abs(ang-true3)>1.2*Math.PI/180) v.push('угол на π₄ = двугранный угол');
    /* каждая точка: ⟂ x₂, расстояние — от π₁-проекции до x₁ (ось x₁ — как на чертеже: ∥ A′B′, за всеми точками) */
    const x1=S.base.find(e=>e.t==='line'&&e.c==='ax').a, x2=L1(S,'x2'), e1=un(x1), n1=[-e1[1],e1[0]];
    ['A','B','C','D'].forEach(k=>{ const p1=[V[k][0],V[k][1]], p3=S.base.find(e=>e.lab===k+'‴').a, p4=P(S,k+'4'), d=Math.abs((p1[0]-x1[0])*n1[0]+(p1[1]-x1[1])*n1[1]); if(!rep(p3,p4,x2,d)) v.push('⟂ x₂, расстояние с π₁'); });
    return v; },
  m7a(V,S){ const v=[]; const B1=[V.B[0],V.B[1]], eh=un([V.h0[0],V.h0[1],V.h1[0],V.h1[1]]), t=(B1[0]-V.h0[0])*eh[0]+(B1[1]-V.h0[1])*eh[1], O=[V.h0[0]+eh[0]*t,V.h0[1]+eh[1]*t];
    const R=Math.hypot(Math.hypot(B1[0]-O[0],B1[1]-O[1]),V.B[2]-V.zh), B0=P(S,'B0'), r=[B0[0]-O[0],B0[1]-O[1]];
    if(Math.abs(Math.hypot(...r)-R)>TOL) v.push('радиус — натуральная величина'); if(Math.abs(r[0]*eh[0]+r[1]*eh[1])>TOL) v.push('B₀ на траектории ⟂ h′'); return v; },
  m7b(V,S){ const v=[]; if(P(S,'A0')) v.push('A на оси неподвижна'); const A1=[V.A[0],V.A[1]], B0=P(S,'B0'), C0=P(S,'C0'), d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
    if(Math.abs(d(A1,B0)-d3(V.A,V.B))>.6||Math.abs(d(A1,C0)-d3(V.A,V.C))>.6||Math.abs(d(B0,C0)-d3(V.B,V.C))>.6) v.push('совмещённый треугольник = натуральная величина'); return v; },
  t8(V,S){ const v=[]; const K0=P(S,'K0'), m=[V.M[0],V.M[1]], n=[V.N[0],V.N[1]];
    const a2=Math.acos(((m[0]-K0[0])*(n[0]-K0[0])+(m[1]-K0[1])*(n[1]-K0[1]))/Math.hypot(m[0]-K0[0],m[1]-K0[1])/Math.hypot(n[0]-K0[0],n[1]-K0[1]));
    const u=[V.M[0]-V.K[0],V.M[1]-V.K[1],V.M[2]-V.K[2]], w=[V.N[0]-V.K[0],V.N[1]-V.K[1],V.N[2]-V.K[2]], a3=Math.acos((u[0]*w[0]+u[1]*w[1]+u[2]*w[2])/Math.hypot(...u)/Math.hypot(...w));
    if(Math.abs(a2-a3)>1.2*Math.PI/180) v.push('угол при K₀ = истинный угол');
    { const eh=un([m[0],m[1],n[0],n[1]]), k1=[V.K[0],V.K[1]], tt=(k1[0]-m[0])*eh[0]+(k1[1]-m[1])*eh[1], O=[m[0]+eh[0]*tt,m[1]+eh[1]*tt]; if(Math.abs((K0[0]-O[0])*eh[0]+(K0[1]-O[1])*eh[1])>TOL) v.push('K₀ на траектории ⟂ оси'); }
    const ph=E(S,'phi').find(e=>e.t==='poly').p[0]; if(Math.abs(Math.hypot(ph[0]-K0[0],ph[1]-K0[1])-10)>.5) v.push('угол меряют при K₀'); return v; },
  m2(V,S){ const v=[]; const {A,B,C,Dp}=V, u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], w=[C[0]-A[0],C[1]-A[1],C[2]-A[2]], nr=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    /* перпендикуляр: направление — нормаль плоскости; его проекции: (nx, ny) на π₁, (nx, −nz) на π₂ */
    const d1=un(L1(S,'n1')), d2=un(L1(S,'n2')), p1=[nr[0],nr[1]], p2=[nr[0],-nr[2]];
    if(Math.abs(cr(d1,[p1[0]/Math.hypot(...p1),p1[1]/Math.hypot(...p1)]))>.003) v.push('n′ ⟂ h′'); if(Math.abs(cr(d2,[p2[0]/Math.hypot(...p2),p2[1]/Math.hypot(...p2)]))>.003) v.push('n″ ⟂ f″'); return v; },
  /* ── база: точка, прямая ── */
  p1(V,S){ const v=[]; const [x,y,z]=V.A, A2=PL(S,'A″'), A1=PL(S,'A′'); if(!A2||!A1) return ['обе проекции'];
    if(Math.hypot(A2[0]+x,A2[1]+z)>TOL) v.push('A″: x влево, высота z'); if(Math.hypot(A1[0]+x,A1[1]-y)>TOL) v.push('A′: x влево, глубина y'); return v; },
  p2(V,S){ const v=[]; const [x]=V.A, sx=L1(S,'sx'); if(Math.abs(sx[2]+x)>TOL) v.push('x — влево от O');
    if(!/^z/.test(TX(S,'tz'))||!/^y/.test(TX(S,'ty'))) v.push('до A″ — z, до A′ — y'); const A1=P(S,'A1'); if(Math.abs(A1[1]-V.A[1])>TOL) v.push('y > 0 — A′ под осью'); return v; },
  p3(V,S){ const v=[]; const [,y,z]=V.A, A3=P(S,'A3'); if(Math.hypot(A3[0]-y,A3[1]+z)>TOL) v.push('A‴: справа от z на y, высота z'); return v; },
  p4(V,S){ return CHECK.p1(V,S); },
  p5(V,S){ const v=[]; const {A,B,kind}=V, top=kind==='h'?(A[2]>B[2]?'A':'B'):(A[1]>B[1]?'A':'B'); const lab=S.E.find(e=>e.role==='P').lab; if(lab[0]!==top) v.push('видна ближняя к глазу'); if(!/\(/.test(lab)) v.push('невидимая — в скобках');
    const q=P(S,'Q'), r=P(S,'R'), qa=kind==='h'?[A[0],-A[2]]:[A[0],A[1]], qb=kind==='h'?[B[0],-B[2]]:[B[0],B[1]]; if(Math.hypot(q[0]-qa[0],q[1]-qa[1])>TOL||Math.hypot(r[0]-qb[0],r[1]-qb[1])>TOL) v.push('другие проекции — на своих местах'); return v; },
  l1(V,S){ const a=L1(S,'ab2'), b=L1(S,'ab1'), eq=(u,w)=>Math.abs(u-w)<TOL;
    const ok={h:eq(a[1],a[3]),f:eq(b[1],b[3]),hp:eq(b[0],b[2])&&eq(b[1],b[3]),fp:eq(a[0],a[2])&&eq(a[1],a[3])}[V.kind]; return ok?[]:['признак типа прямой']; },
  l2(V,S){ const v=[]; const {A,B,r}=V, t=r[0]/(r[0]+r[1]), K2=P(S,'K2'), K1=P(S,'K1'); if(Math.abs(K2[0]-K1[0])>TOL) v.push('одна линия связи');
    const s2=(K2[0]-A[0])/(B[0]-A[0]); if(Math.abs(s2-t)>.01||Math.abs(-K2[1]-(A[2]+(B[2]-A[2])*s2))>TOL) v.push('K″ делит A″B″ в отношении');
    const s1=(K1[0]-A[0])/(B[0]-A[0]); if(Math.abs(K1[1]-(A[1]+(B[1]-A[1])*s1))>TOL) v.push('K′ на A′B′'); return v; },
  l3(V,S){ const v=[]; const {A,B}=V, at=t=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t];
    const tH=A[2]/(A[2]-B[2]), H=at(tH), tF=A[1]/(A[1]-B[1]), Fp=at(tF);
    if(Math.hypot(P(S,'H2')[0]-H[0],P(S,'H2')[1])>TOL||Math.hypot(P(S,'H1')[0]-H[0],P(S,'H1')[1]-H[1])>TOL) v.push('H: z = 0'); if(Math.hypot(P(S,'F1')[0]-Fp[0],P(S,'F1')[1])>TOL||Math.hypot(P(S,'F2')[0]-Fp[0],P(S,'F2')[1]+Fp[2])>TOL) v.push('F: y = 0'); return v; },
  l4(V,S){ const v=[]; const a1=[V.A[0],V.A[1]], b1=[V.B[0],V.B[1]], B0=P(S,'B0'); if(Math.abs(Math.hypot(B0[0]-a1[0],B0[1]-a1[1])-Math.hypot(V.A[0]-V.B[0],V.A[1]-V.B[1],V.A[2]-V.B[2]))>TOL) v.push('гипотенуза = |AB|');
    if(Math.abs((B0[0]-b1[0])*(b1[0]-a1[0])+(B0[1]-b1[1])*(b1[1]-a1[1]))/Math.hypot(b1[0]-a1[0],b1[1]-a1[1])>TOL) v.push('катет ⟂ A′B′'); return v; },
  l4u(V,S){ const v=[]; const a1=[V.A[0],V.A[1]], b1=[V.B[0],V.B[1]], lg=L1(S,'leg'); if(Math.hypot(lg[0]-b1[0],lg[1]-b1[1])>TOL||Math.abs(Math.hypot(lg[2]-lg[0],lg[3]-lg[1])-Math.abs(V.B[2]-V.A[2]))>TOL) v.push('треугольник на A′B′ с Δz');
    const c=arcC(E(S,'arc').find(e=>e.t==='poly').p); if(!c||Math.hypot(c[0]-a1[0],c[1]-a1[1])>.5) v.push('α — при A′'); return v; },
  l5(V,S){ const v=[]; const {A,B}=V, K1=P(S,'K1'), s=(K1[0]-A[0])/(B[0]-A[0]), K=[A[0]+(B[0]-A[0])*s,A[1]+(B[1]-A[1])*s,A[2]+(B[2]-A[2])*s];
    if(Math.abs(K1[1]-K[1])>TOL) v.push('K′ на A′B′'); if(Math.abs(Math.hypot(K[0]-A[0],K[1]-A[1],K[2]-A[2])-V.l)>TOL) v.push('|AK| = ℓ'); const K2=P(S,'K2'); if(Math.abs(K2[0]-K1[0])>TOL||Math.abs(-K2[1]-K[2])>TOL) v.push('K″ на линии связи, на A″B″'); return v; },
  l6(V,S){ const c2=L1(S,'cd2'), c1=L1(S,'cd1'), a2=[V.A[0],-V.A[2],V.B[0],-V.B[2]], a1=[V.A[0],V.A[1],V.B[0],V.B[1]], par=(p,q)=>Math.abs(cr(un(p),un(q)))<.003;
    if(V.kind==='p') return par(c2,a2)&&par(c1,a1)?[]:['параллельны обе проекции'];
    const K2=P(S,'K2'), K1=P(S,'K1'); return Math.abs(K2[0]-K1[0])>TOL?['пересечение — на одной линии связи']:[]; },
  l7(V,S){ const K1=P(S,'K1'), K2=P(S,'K2'); if(Math.abs(K1[0]-K2[0])>TOL) return ['линия связи']; const K=[K1[0],K1[1],V.h0[2]], d=[V.h1[0]-V.h0[0],V.h1[1]-V.h0[1],0], w=[K[0]-V.A[0],K[1]-V.A[1],K[2]-V.A[2]];
    return Math.abs(d[0]*w[0]+d[1]*w[1])/Math.hypot(...d)/Math.hypot(...w)>.01?['AK ⟂ h в пространстве']:[]; },
  /* ── плоскость, прямая и плоскость ── */
  s1(V,S){ const p2=E(S,'t2')[0].p, p1=E(S,'t1')[0].p, col=q=>Math.abs((q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[2][0]-q[0][0])*(q[1][1]-q[0][1]))<1, flat=q=>Math.abs(q[0][1]-q[1][1])<TOL&&Math.abs(q[0][1]-q[2][1])<TOL;
    /* проецирующая — прямая под углом к x (∥ x — это уже плоскость уровня) */
    const ok={hp:col(p1)&&!flat(p1),fp:col(p2)&&!flat(p2),hl:flat(p2),fl:flat(p1)}[V.kind]; return ok?[]:['признак положения плоскости']; },
  s2(V,S){ const v=[]; const K1=P(S,'K1'), K2=S.base.find(e=>e.lab==='K″').a; if(Math.abs(K1[0]-K2[0])>TOL) v.push('линия связи'); if(!inPl(V,[K1[0],K1[1],-K2[1]])) v.push('K в плоскости ABC'); return v; },
  s3(V,S){ const v=[]; const h2=L1(S,'h2'), f1=L1(S,'f1'); if(Math.abs(h2[1]-h2[3])>TOL) v.push('h″ ∥ x'); if(Math.abs(f1[1]-f1[3])>TOL) v.push('f′ ∥ x');
    const p1=P(S,'p1h'), p2=P(S,'p1f'), q1=P(S,'p2h'), q2=P(S,'p2f'); if(!onSeg3(V.B,V.C,[p1[0],p1[1],-p2[1]])) v.push('1 на BC'); if(!onSeg3(V.B,V.C,[q1[0],q1[1],-q2[1]])) v.push('2 на BC'); return v; },
  s5a(V,S){ const v=[]; const m=L1(S,'m1'), n=nrmPl(V), d=[m[2]-m[0],m[3]-m[1]]; if(Math.abs(d[0]*n[1]-d[1]*n[0])/Math.hypot(...d)/Math.hypot(n[0],n[1])>.003) v.push('m′ ⟂ h′');
    const M1=P(S,'M1'), M2=P(S,'M2'); if(Math.abs(M1[0]-M2[0])>TOL||Math.abs(-M2[1]-V.A[2])>TOL||!inPl(V,[M1[0],M1[1],-M2[1]])) v.push('M на горизонтали'); return v; },
  s5b(V,S){ const v=[]; const M1=S.base.find(e=>e.lab==='M′').a, b1=[V.B[0],V.B[1]], lg=L1(S,'leg'); if(Math.abs(Math.hypot(lg[2]-lg[0],lg[3]-lg[1])-Math.abs(V.B[2]-V.A[2]))>TOL) v.push('катет Δz');
    const c=arcC(E(S,'arc').find(e=>e.t==='poly').p); if(!c||Math.hypot(c[0]-M1[0],c[1]-M1[1])>.5) v.push('α при M′'); return v; },
  s6(V,S){ const D1=S.base.find(e=>e.lab==='D′').a, D2=P(S,'D2'); if(Math.abs(D1[0]-D2[0])>TOL) return ['линия связи']; return inPl(V,[D1[0],D1[1],-D2[1]])?[]:['D в плоскости ABC']; },
  m1(V,S){ const a=L1(S,'d1'), b=L1(S,'d2'); { const mid=q=>[(q[0]+q[2])/2,(q[1]+q[3])/2], m1=mid(a), m2=mid(b); if(Math.hypot(m1[0]-V.Dp[0],m1[1]-V.Dp[1])>TOL||Math.hypot(m2[0]-V.Dp[0],m2[1]+V.Dp[2])>TOL) return ['d проходит через D']; } const dir=[1,(a[3]-a[1])/(a[2]-a[0]),-(b[3]-b[1])/(b[2]-b[0])], n=nrmPl(V); return Math.abs(dir[0]*n[0]+dir[1]*n[1]+dir[2]*n[2])/Math.hypot(...dir)/Math.hypot(...n)>.01?['d ∥ плоскости']:[]; },
  m3(V,S){ const v=[]; const {A,B}=V, l=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], h1=L1(S,'h1'), h2=L1(S,'h2'), f1=L1(S,'f1'), f2=L1(S,'f2');
    if(Math.abs(h2[1]-h2[3])>TOL||Math.abs(f1[1]-f1[3])>TOL) v.push('h″ ∥ x, f′ ∥ x');
    const hd=[h1[2]-h1[0],h1[3]-h1[1],0], fd=[f2[2]-f2[0],0,-(f2[3]-f2[1])], dt=(a,b)=>Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/Math.hypot(...a)/Math.hypot(...b);
    if(dt(hd,l)>.01) v.push('h ⟂ l'); if(dt(fd,l)>.01) v.push('f ⟂ l'); return v; },
  m4(V,S){ const v=[]; const K1=P(S,'K1'), K2=P(S,'K2'); if(Math.abs(K1[0]-K2[0])>TOL) v.push('линия связи'); const K=[K1[0],K1[1],-K2[1]];
    if(!inPl(V,K)) v.push('K в плоскости'); if(!onSeg3(V.Dp,V.Ep,K)) v.push('K на прямой l'); return v; },
  t1(V,S){ const e=E(S,'nv').find(x=>x.t!=='txt'), d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
    if(e.t==='poly'){ const q=e.p; return Math.abs(d(q[0],q[1])-d3(V.A,V.B))>TOL||Math.abs(d(q[1],q[2])-d3(V.B,V.C))>TOL||Math.abs(d(q[0],q[2])-d3(V.A,V.C))>TOL?['отмечен натуральный вид']:[]; }
    const s=e.a; return Math.abs(Math.hypot(s[2]-s[0],s[3]-s[1])-d3(V.A,V.B))>TOL?['отмечена натуральная величина']:[]; },
  s4(V,S){ const v=[]; const n=[V.dh[1]*V.df[2]-V.dh[2]*V.df[1],V.dh[2]*V.df[0]-V.dh[0]*V.df[2],V.dh[0]*V.df[1]-V.dh[1]*V.df[0]], X=V.X;
    const inP=q=>Math.abs(n[0]*(q[0]-X[0])+n[1]*(q[1]-X[1])+n[2]*(q[2]-X[2]))/Math.hypot(...n)<TOL;
    const h=L1(S,'h0'), f=L1(S,'f0'); if(!inP([h[0],h[1],0])||!inP([h[2],h[3],0])) v.push('h₀α — горизонтальный след'); if(!inP([f[0],0,-f[1]])||!inP([f[2],0,-f[3]])) v.push('f₀α — фронтальный след');
    if(Math.abs(h[0]-f[0])>TOL) v.push('следы встречаются на оси x'); return v; },
  m8(V,S){ const v=[]; const K1=P(S,'K1'), K2=P(S,'K2'); if(Math.abs(K1[0]-K2[0])>TOL) v.push('линия связи'); const K=[K1[0],K1[1],-K2[1]];
    if(!onSeg3(V.P,V.Q,K)) v.push('K на прямой a'); if(Math.abs(d3(K,V.A)-d3(K,V.B))>TOL) v.push('|KA| = |KB|'); return v; },
  t5(V,S){ const v=[]; const A4=P(S,'A4'),B4=P(S,'B4'),C4=P(S,'C4'), d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
    if(Math.abs(d(A4,B4)-d3(V.A,V.B))>.6||Math.abs(d(A4,C4)-d3(V.A,V.C))>.6||Math.abs(d(B4,C4)-d3(V.B,V.C))>.6) v.push('натуральный вид = треугольник ABC'); return v; },
  t7(V,S){ const v=[]; const {A,B}=V, Bh=P(S,'B1h'), Bf=P(S,'B1f'); if(Math.abs(Bh[1]-A[1])>TOL||Math.abs(Math.hypot(Bh[0]-A[0],Bh[1]-A[1])-Math.hypot(B[0]-A[0],B[1]-A[1]))>TOL) v.push('B₁′: радиус |A′B′|, A′B₁′ ∥ x');
    if(Math.abs(Bf[0]-Bh[0])>TOL) v.push('линия связи'); if(Math.abs(-Bf[1]-B[2])>TOL) v.push('B₁″ на высоте B″'); return v; },
  m5(V,S){ const v=[]; const zf=x=>V.z0+(x-V.x0)*Math.tan(V.ph); for(const [f,h] of [['p1f','p1h'],['p2f','p2h']]){ const F=P(S,f), H=P(S,h); if(Math.abs(F[0]-H[0])>TOL){ v.push('линия связи'); continue; }
      const K=[H[0],H[1],-F[1]]; if(!inPl(V,K)) v.push('точка в плоскости ABC'); if(Math.abs(K[2]-zf(K[0]))>TOL) v.push('точка на β'); } return v; },
  m6(V,S){ const h=L1(S,'hyp'), D3=V.Dp, A3=V.h0, u=[V.h1[0]-A3[0],V.h1[1]-A3[1],0], w=[D3[0]-A3[0],D3[1]-A3[1],D3[2]-A3[2]], c=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]], dist=Math.hypot(...c)/Math.hypot(...u);
    return Math.abs(Math.hypot(h[2]-h[0],h[3]-h[1])-dist)>TOL?['гипотенуза = расстояние от D до h']:[]; },
  t9(V,S){ const {A,B,C}=V, ab=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], ac=[C[0]-A[0],C[1]-A[1],C[2]-A[2]], n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    const dd=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cx=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    /* центр описанной окружности ABC в пространстве */
    const t1=cx(n,ab), t2=cx(ac,n), k=1/(2*dd(n,n)); const O=[0,1,2].map(i=>A[i]+(dd(ac,ac)*t1[i]+dd(ab,ab)*t2[i])*k);
    const O1=P(S,'O1'); return Math.hypot(O1[0]-O[0],O1[1]-O[1])>.5?['O′ — проекция настоящего центра описанной окружности']:[]; },
  x5m(V,S){ const v=[]; const u=[Math.cos(V.ps),-Math.sin(V.ps)], n=[-u[1],u[0]], tA=Math.tan(V.al);
    for(const r of ['m1','m2']){ const e=E(S,r)[0], pts=e.t==='line'?[0.25,.5,.75].map(t=>[e.a[0]+(e.a[2]-e.a[0])*t,e.a[1]+(e.a[3]-e.a[1])*t]):[e.p[4],e.p[8],e.p[12]];
      for(const K of pts){ const z=-K[1], Rc=(V.Sz-z)*tA, yc=Rc*Rc-K[0]*K[0], d=[K[0],K[1]+V.zO], t=d[0]*n[0]+d[1]*n[1], yq=V.r*V.r-t*t;
        if(yc<-1||yq<-1||Math.abs(yc-yq)>3) { v.push('точка на обеих поверхностях'); break; } } } return v; },
  f4a(V,S){ const v=[]; const x1=z=>V.xa+(V.xb-V.xa)*(z-V.za)/(V.zb-V.za);
    E(S,'g2').forEach(e=>{ const a=e.a; if(Math.abs(a[1]-a[3])>TOL||Math.abs(a[0]-x1(-a[1]))>TOL) v.push('образующая ∥ π₁ между точками одной высоты'); });
    const g2=E(S,'g2'); E(S,'g1').forEach((e,i)=>{ if(Math.abs(e.a[3]-V.yq)>TOL) v.push('конец — на d₂′'); if(g2[i]&&Math.abs(e.a[0]-g2[i].a[0])>TOL) v.push('линия связи'); }); return v; },
  f4b(V,S){ const v=[]; E(S,'d2').forEach((e,k)=>{ if(Math.abs(-e.a[1]-V.p*k/V.n)>TOL) v.push('равные подъёмы'); });
    E(S,'d1').forEach((e,k)=>{ const a=2*Math.PI*k/V.n; if(Math.hypot(e.a[0]-V.R*Math.cos(a),e.a[1]-V.Y0-V.R*Math.sin(a))>TOL) v.push('равные части окружности'); });
    const hx=E(S,'hx')[0].p; hx.forEach((q,k)=>{ if(Math.abs(q[0]-V.R*Math.cos(2*Math.PI*k/V.n))>TOL||Math.abs(-q[1]-V.p*k/V.n)>TOL) v.push('точка k — на k-й линии связи и k-м уровне'); }); return [...new Set(v)]; },
  f1(V,S){ const v=[]; const b=E(S,'b1')[0]; if(b.t!=='circ'||Math.abs(b.a[2]-V.R)>TOL||Math.abs(b.a[0])>TOL) v.push('основание на π₁ — окружность радиуса R');
    const oL=E(S,'oL')[0].a, oR=E(S,'oR')[0].a; if(Math.abs(oL[0])>TOL||Math.abs(oR[0])>TOL) v.push('вершина на оси');
    if(Math.abs(oL[2]+V.R)>TOL||Math.abs(oR[2]-V.R)>TOL) v.push('очерк — крайние образующие'); return v; }
};
const PL=(S,lab)=>{ const e=S.E.find(x=>x.t==='pt'&&x.lab===lab); return e?e.a:null; }, TX=(S,r)=>(S.E.find(e=>e.role===r&&e.t==='txt')||{}).s||'';
const L1=(S,r)=>E(S,r).find(e=>e.t==='line').a, un=l=>{ const d=[l[2]-l[0],l[3]-l[1]], k=Math.hypot(...d); return [d[0]/k,d[1]/k]; }, cr=(a,b)=>a[0]*b[1]-a[1]*b[0];
/* центр дуги по трём её точкам */
const arcC=p=>{ const [a,b,c]=[p[0],p[p.length>>1],p[p.length-1]], d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1])); if(Math.abs(d)<1e-9) return null;
  const s=q=>q[0]*q[0]+q[1]*q[1]; return [(s(a)*(b[1]-c[1])+s(b)*(c[1]-a[1])+s(c)*(a[1]-b[1]))/d,(s(a)*(c[0]-b[0])+s(b)*(a[0]-c[0])+s(c)*(b[0]-a[0]))/d]; };
const nrmPl=V=>{ const {A,B,C}=V, u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], w=[C[0]-A[0],C[1]-A[1],C[2]-A[2]]; return [u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]; };
const inPl=(V,K)=>{ const n=nrmPl(V), A=V.A; return Math.abs(n[0]*(K[0]-A[0])+n[1]*(K[1]-A[1])+n[2]*(K[2]-A[2]))/Math.hypot(...n)<TOL; };
const onSeg3=(P,Q,K)=>{ const d=[Q[0]-P[0],Q[1]-P[1],Q[2]-P[2]], w=[K[0]-P[0],K[1]-P[1],K[2]-P[2]], c=[d[1]*w[2]-d[2]*w[1],d[2]*w[0]-d[0]*w[2],d[0]*w[1]-d[1]*w[0]]; return Math.hypot(...c)/Math.hypot(...d)<TOL; };
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
/* новая проекция N от P: линия связи ⟂ оси, расстояние до оси = dist, по другую сторону от P */
function rep(P,N,ax,dist){ const e=un(ax), nn=[-e[1],e[0]], sp=(P[0]-ax[0])*nn[0]+(P[1]-ax[1])*nn[1], sn=(N[0]-ax[0])*nn[0]+(N[1]-ax[1])*nn[1];
  const along=((N[0]-P[0])*e[0]+(N[1]-P[1])*e[1]); return Math.abs(along)<TOL&&Math.abs(Math.abs(sn)-dist)<TOL&&sp*sn<0; }
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const geo=e=>({t:e.t,a:e.a&&e.a.map(x=>Math.round(x*1e3)),p:e.p&&e.p.map(q=>q.map(x=>Math.round(x*1e3))),dash:!!e.dash});
for(const [id,T] of Object.entries(PREP.TOPICS)){
  if(!CHECK[id]){ bad(`тема ${id}: нет независимой проверки в tests/prep.js`); continue; }
  if(Object.keys(T.traps).length<3) bad(`тема ${id}: меньше трёх ловушек`);
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

/* ── 2б. 3D: каждая точка пространства с pr проецируется ровно в свою точку эпюра (на 50 вариантах) ── */
{ let n3=0; for(const [id,T] of Object.entries(PREP.TOPICS)){ if(!T.space) continue; n3++; let bad3=0, chk=0;
    for(let i=0;i<50;i++){ const V=(T.watch.V?T.watch.V.call(T):T.make.call(T)); if(!V) continue; const S=T.scene(V,null); if(!S) continue; const pr=T.space(V);
      if(!pr.length){ bad3++; continue; }
      for(const q of pr.filter(q=>q.t==='pt'&&q.pr)){ for(const [k,role] of Object.entries(q.pr)){ const e=S.E.concat(S.base).find(x=>x.t==='pt'&&x.role===role); if(!e){ bad3++; if(bad3<=2) bad(`3D ${id}: на эпюре нет точки «${role}»`); continue; } chk++;
        const want=k==='h'?[q.p[0],q.p[1]]:[q.p[0],-q.p[2]]; if(Math.hypot(e.a[0]-want[0],e.a[1]-want[1])>TOL){ bad3++; if(bad3<=2) bad(`3D ${id}: точка ${q.lab||role} на ${k==='h'?'π₁':'π₂'} не совпала с эпюром (${e.a.map(v=>v.toFixed(1))} ≠ ${want.map(v=>v.toFixed(1))})`); } } }
      /* роли 3D — те же, что у шагов «Смотри» */
      const steps=new Set(T.watch.steps.flatMap(s=>s.roles)); pr.filter(q=>q.role&&!steps.has(q.role)).slice(0,1).forEach(q=>bad(`3D ${id}: роль «${q.role}» не встречается в шагах «Смотри»`)); }
    if(!chk) bad(`3D ${id}: нет ни одной точки, сверенной с эпюром`); }
  info.push(`3D: тем со сценой ${n3}; каждая точка с привязкой сверена с эпюром на 50 вариантах`); }

/* ── 3. модель освоения на смоделированных студентах ── */
{ for(const id of Object.keys(PREP.TOPICS)){ const T=PREP.TOPICS[id], M=PREP.Model(T,null); try{ for(let i=0;i<30;i++){ const k=M.next(); if(!T.traps[k]) throw new Error('выбрана несуществующая ловушка «'+k+'»'); M.last=k; M.answer(k,i%5!==0,3000); } }catch(e){ bad(`модель, тема ${id}: ${e.message}`); } } }
{ const T=PREP.TOPICS.x3, runs=10000;
  const sim=(pRight,cap)=>{ const M=PREP.Model(T,null); for(let n=1;n<=cap;n++){ const k=M.next(); M.last=k; M.answer(k,Math.random()<pRight,4000); if(M.mastered()) return n; } return 0; };
  let sum=0, cnt=0; for(let i=0;i<2000;i++){ const n=sim(.92,60); if(n){ sum+=n; cnt++; } }
  const avg=sum/cnt; if(avg>17) bad(`модель: «знает» осваивает в среднем за ${avg.toFixed(1)} пар (> 17)`);
  let fake=0; for(let i=0;i<runs;i++) if(sim(.5,40)) fake++;
  if(fake/runs>=.01) bad(`модель: «угадывает» получает «освоено» в ${(fake/runs*100).toFixed(2)} % прогонов (≥ 1 %)`);
  /* то же на каждой теме: у тем разное число ловушек и разная их сложность */
  let worst=['',0]; for(const [id,TT] of Object.entries(PREP.TOPICS)){ let f=0; const n=4000; for(let i=0;i<n;i++){ const M=PREP.Model(TT,null); for(let j=1;j<=40;j++){ const k=M.next(); M.last=k; M.answer(k,Math.random()<.5,4000); if(M.mastered()){ f++; break; } } }
    if(f/n>worst[1]) worst=[id,f/n]; if(f/n>=.015) bad(`модель, тема ${id}: «угадывает» получает «освоено» в ${(f/n*100).toFixed(2)} %`); }
  info.push(`Модель по темам: худшая — ${worst[0]}, ложное «освоено» ${(worst[1]*100).toFixed(2)} %`);
  info.push(`Модель: «знает» — в среднем ${avg.toFixed(1)} пар (освоили ${cnt} из 2000), «угадывает» — ложное «освоено» ${(fake/runs*100).toFixed(2)} %`); }

/* ── 4. экраны ── */
async function screens(){
  let chromium; try{ ({chromium}=require('playwright')); }catch(e){ info.push('Экраны: playwright не найден — пропущено'); return; }
  const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const U='http://127.0.0.1:'+srv.address().port+'/';
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage({viewport:{width:390,height:844}}); await page.addInitScript(()=>{ try{ localStorage.setItem('nch-preview-ok','1'); }catch(e){} }); const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(U+'#/prep'); await page.waitForTimeout(1200);
  const hub=await page.evaluate(()=>({cards:[...document.querySelectorAll('a.pp-cc')].map(a=>a.getAttribute('href')),rows:document.querySelectorAll('.pp-st').length,ow:document.documentElement.scrollWidth>innerWidth}));
  if(hub.cards.join()!==['ng1','ng2','ng3','ng4','ng5'].map(k=>'#/prep/'+k).join()) bad('Подготовка: карточки ДЗ — '+hub.cards.join(', ')); if(hub.rows) bad('Подготовка: на первом экране не должно быть списка тем'); if(hub.ow) bad('Подготовка: горизонтальная прокрутка');
  /* курс показывает только свои темы (и свёрнуто — из прошлых), ссылки — внутрь курса */
  for(const c of G.COURSES.filter(c=>c.kind==='dz')){
    await page.goto(U+'#/prep/'+c.key); await page.waitForTimeout(200);
    const r=await page.evaluate(()=>({main:[...document.querySelectorAll('.pp-map .pp-st')].map(a=>a.getAttribute('href')),prev:[...document.querySelectorAll('.pp-prev .pp-st')].map(a=>a.getAttribute('href')),ow:document.documentElement.scrollWidth>innerWidth}));
    const want=c.own.map(id=>'#/prep/'+c.key+'/'+id); if(r.main.join()!==want.join()) bad(`Курс ${c.label}: показаны не ровно свои темы (${r.main.length} из ${want.length})`);
    const wantP=c.prevBy.flatMap(g=>g.ids.map(id=>'#/prep/'+g.key+'/'+id)); if(r.prev.join()!==wantP.join()) bad(`Курс ${c.label}: «нужно из прошлых» не совпадает`); if(r.ow) bad(`Курс ${c.label}: горизонтальная прокрутка`); }
  /* тема внутри курса: «назад» — к курсу */
  { const c=G.COURSE.ng4; await page.goto(U+'#/prep/ng4/'+c.own[0]); await page.waitForTimeout(200); const back=await page.evaluate(()=>{ const a=document.querySelector('.pp-back'); return a&&a.getAttribute('href'); }); if(back!=='#/prep/ng4') bad('Тема в курсе: «назад» ведёт не к курсу, а на '+back); }
  await page.goto(U+'#/prep/all'); await page.waitForTimeout(300);
  const st=await page.evaluate(()=>({n:document.querySelectorAll('.pp-st').length,ow:document.documentElement.scrollWidth>innerWidth}));
  if(st.n!==G_N) bad(`Вся программа: ${st.n} тем вместо ${G_N}`); if(st.ow) bad('Вся программа: горизонтальная прокрутка');
  for(const id of Object.keys(PREP.TOPICS)){
    await page.goto(U+'#/prep/'+id); await page.waitForTimeout(300);
    const r=await page.evaluate(async()=>{
      const wait=ms=>new Promise(f=>setTimeout(f,ms)); const q=s=>document.querySelector(s);
      q('[data-ph="watch"]').click(); await wait(50);
      { const sv=q('.pp-watch svg'); if(!sv||sv.clientWidth<100||sv.clientHeight<100) return 'чертёж разбора не виден (ширина '+(sv?sv.clientWidth:0)+')'; }
      for(let i=0;i<10;i++){ const b=q('#ppNext'); if(!b) return 'нет кнопки «Дальше»'; const last=/провер/.test(b.textContent);
        if(last){ const v3=q('.pp-vt [data-v="3"]'); if(v3){ v3.click(); await wait(80); const cv=q('canvas.pp-3d'); if(!cv||cv.hidden) return '3D не открылось';
          const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data; let n=0; for(let k=3;k<d.length;k+=40) if(d[k]>0) n++; if(n<200) return '3D пустое'; q('.pp-vt [data-v="e"]').click(); await wait(20); } }
        b.click(); await wait(30); if(last) break; }
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
  /* основной сайт: курсов по этапам и экрана перед решением нет */
  await page.goto(U+'#/prep'); await page.waitForTimeout(500);
  if(await page.$('.pp-stg')||await page.evaluate(()=>!!window.PREP&&Object.keys(PREP.PLANS).length)) bad('Основной сайт: курсы по этапам видны (они только в копии /new/)');
  /* навыки — только в копии /new/ (основной сайт подключает прежние курсы по темам, выше) */
  const PK=Object.keys(PREP.PLANS), UN=U+'new/';
  const hash=()=>page.evaluate(()=>location.hash);
  /* #/prep — карта предмета у зоны задания, которое выбрал сайт */
  await page.evaluate(()=>{ localStorage.removeItem('nch_prep_plan'); sessionStorage.clear(); });
  await page.goto(UN+'#/prep'); await page.waitForTimeout(1500);
  { const want=await page.evaluate(()=>PREP.autoKey()), h=await hash();
    if(h!=='#/prep/'+want) bad('Копия /new/: #/prep не открыл карту '+want+' ('+h+')'); if(!await page.$('.wd')) bad('Копия /new/: нет карты'); }
  /* карта начерта: все задания семестра зонами, в зоне — уровни по порядку и само задание в конце */
  await page.goto(UN+'#/prep/ng2'); await page.waitForTimeout(900);
  { const m=await page.evaluate(()=>{ const zs=PREPW.zonesOf('ng'); return {zs:zs.length,signs:document.querySelectorAll('.wd-sign').length,boss:document.querySelectorAll('.wd-n.boss').length,
      lv:[...document.querySelectorAll('.wd-n[data-k="ng2"]:not(.boss)')].map(x=>x.classList.contains('cur')?'c':x.classList.contains('done')?'d':'l').join(''),cat:!!document.querySelector('#wdCat'),ow:document.documentElement.scrollWidth>innerWidth}; });
    const n=PREP.PLANS.ng2.skills.length;
    if(m.signs!==m.zs||m.boss!==m.zs) bad('Карта начерта: зон '+m.zs+', табличек '+m.signs+', заданий '+m.boss);
    if(m.lv!=='c'+'l'.repeat(n-1)) bad('Карта, зона ДЗ №2: уровни '+m.lv); if(!m.cat) bad('Карта: нет персонажа на текущем уровне'); if(m.ow) bad('Карта: горизонтальная прокрутка'); }
  /* уровень начерта: карточка уровня → условие → разбор по шагам → итог разбора → правила теста → 6 пар → итог со звёздами → карта */
  await page.click('.wd-n.cur[data-k="ng2"]'); await page.waitForTimeout(500);
  { if(await hash()!=='#/prep/ng2') bad('Уровень 1 ДЗ №2: нажатие сразу увело с карты ('+await hash()+') — нужна карточка уровня');
    const sh=await page.evaluate(()=>{ const s=document.querySelector('.wd-sh'); return s&&{h:(s.querySelector('h2')||{}).textContent,route:s.querySelectorAll('.wd-shr li').length,start:!!s.querySelector('#wdStart')}; });
    if(!sh) bad('Карта: нет карточки уровня'); else { if(sh.h!==PREP.PLANS.ng2.skills[0].t) bad('Карточка уровня: не тот навык — '+sh.h); if(sh.route!==3) bad('Карточка уровня: маршрут не из 3 этапов'); if(!sh.start) bad('Карточка уровня: нет кнопки «Начать»'); }
    await page.click('#wdStart'); await page.waitForTimeout(700);
    const want='#/prep/ng2/'+PREP.PLANS.ng2.skills[0].topic; if(await hash()!==want) bad('Уровень 1 ДЗ №2: открылся не уровень ('+await hash()+')');
    const cond=await page.evaluate(()=>({on:(document.querySelector('#wlSteps li.on')||{}).textContent||'',find:!!document.querySelector('.wl-task .find'),svg:(()=>{ const s=document.querySelector('.wl-card svg'); return s?s.clientHeight:0; })(),go:!!document.querySelector('#wlGo')}));
    if(!/Условие/.test(cond.on)) bad('Уровень: первым не «Условие» ('+cond.on+')'); if(!cond.find) bad('Условие: нет «Найти»'); if(cond.svg<150) bad('Условие: чертёж не виден'); if(!cond.go) bad('Условие: нет кнопки к разбору');
    if(cond.go) await page.click('#wlGo'); await page.waitForTimeout(300);
    if(!/Разбор/.test(await page.evaluate(()=>(document.querySelector('#wlSteps li.on')||{}).textContent||''))) bad('Разбор: этап не отмечен');
    if(await page.$('#wlGoal')){ await page.click('#wlGoal'); await page.waitForTimeout(150); if(await page.evaluate(()=>document.querySelector('#wlGiven').hidden)) bad('Разбор: «Условие» не открывается'); await page.click('#wlGoal'); } else bad('Разбор: нельзя посмотреть условие');
    for(let i=0;i<25;i++){ const b=await page.$('#ppNext'); if(!b) break; await b.click(); await page.waitForTimeout(120); }
    if(!await page.$('.wl-split.recap #wlTest')) bad('Разбор: после шагов нет итога с кнопкой «К тесту»'); else { await page.click('#wlTest'); await page.waitForTimeout(700); }
    if(await hash()!=='#/prep/ng2/test1') bad('Уровень 1 ДЗ №2: после разбора — не тест ('+await hash()+')');
    if(!await page.$('#wlStart')) bad('Тест: нет правил перед первой парой'); else await page.click('#wlStart');
    await page.waitForTimeout(300);
    if(await page.$$eval('#wdPips i',x=>x.length)!==6) bad('Тест уровня: не 6 пар');
    for(let i=0;i<6;i++){ await page.waitForSelector('#ppA:not(.ok):not(.bad):not(.dim)',{timeout:5000}).catch(()=>{}); await page.click('#ppA'); await page.waitForTimeout(150); const nx=await page.$('#ppNx'); if(nx) await nx.click(); else await page.waitForTimeout(1000); }
    await page.waitForTimeout(500);
    const r=await page.evaluate(()=>({h1:(document.querySelector('.wd-rc h1')||{}).textContent||'',on:document.querySelectorAll('.wd-big svg.on').length,pips:document.querySelectorAll('.wd-pips.res i').length,done:(JSON.parse(localStorage.getItem('nch_prep_plan')||'{}').ng2||{})[0]||null}));
    if(!/^(Идеально!|Уровень пройден|Почти!)$/.test(r.h1)) bad('Тест уровня: нет итога ('+r.h1+')');
    if(r.pips!==6) bad('Итог уровня: не показаны все 6 пар');
    if((r.h1!=='Почти!')!==!!r.done) bad('Тест уровня: итог и отметка не совпадают');
    if(r.done&&r.on!==r.done.stars) bad('Итог уровня: звёзд на экране '+r.on+', записано '+r.done.stars);
    await page.click('#wdGo'); await page.waitForTimeout(1000);
    if(r.done){ if(await hash()!=='#/prep/ng2') bad('Уровень пройден: кнопка ведёт не на карту');
      const st=await page.evaluate(()=>[...document.querySelectorAll('.wd-n[data-k="ng2"]')].slice(0,2).map(x=>x.className).join(' | '));
      if(!/done/.test(st.split('|')[0])||!/cur/.test(st.split('|')[1])) bad('Карта после уровня 1: '+st);
      await page.waitForTimeout(2600); const nh=await page.evaluate(()=>{ const s=document.querySelector('.wd-sh h2'); return s&&s.textContent; });
      if(nh!==PREP.PLANS.ng2.skills[1].t) bad('После «Дальше»: не открылась карточка следующего уровня ('+nh+')'); }
    else { if(await hash()!=='#/prep/ng2/'+PREP.PLANS.ng2.skills[0].topic) bad('Почти: кнопка ведёт не на разбор того же уровня');
      else if(!/Разбор/.test(await page.evaluate(()=>(document.querySelector('#wlSteps li.on')||{}).textContent||''))) bad('Почти: открылось не на разборе'); } }
  /* закрытый уровень и задание — тоже карточка: почему закрыто и что сделать */
  await page.evaluate(()=>{ localStorage.removeItem('nch_prep_plan'); sessionStorage.clear(); });
  await page.goto(UN+'#/prep/ng2'); await page.waitForTimeout(900);
  await page.evaluate(()=>document.querySelector('.wd-n[data-k="ng2"][data-i="2"]').click()); await page.waitForTimeout(400);
  if(!await page.$('.wd-sh .wd-shlock')||await page.$('.wd-sh #wdStart')) bad('Закрытый уровень: карточка без объяснения или с кнопкой входа');
  await page.evaluate(()=>document.querySelector('.wd-shx').click()); await page.waitForTimeout(300);
  await page.evaluate(()=>document.querySelector('.wd-n.boss[data-k="ng2"]').click()); await page.waitForTimeout(400);
  if(await page.$$eval('.wd-sh .wd-shl li',x=>x.length)!==PREP.PLANS.ng2.skills.length) bad('Карточка задания: нет списка навыков');
  /* уровень инжи: разбор на странице сайта → плашка «К тесту» → тест: фрагменты листа, ошибка видна (пиксели различаются) */
  await page.evaluate(()=>{ localStorage.removeItem('nch_prep_plan'); sessionStorage.clear(); });
  await page.goto(UN+'#/prep/ig4'); await page.waitForTimeout(900);
  await page.click('.wd-n.cur[data-k="ig4"]'); await page.waitForTimeout(500); if(!await page.$('.wd-sh #wdStart')) bad('Уровень ИГ: нет карточки уровня'); else await page.click('#wdStart'); await page.waitForTimeout(1000);
  { if(/^#\/prep\//.test(await hash())) bad('Уровень ИГ: не открыл разбор');
    const tr=await page.$('#ppTrail .pp-btn'); if(!tr) bad('Уровень ИГ: нет плашки «К тесту»'); else { await tr.click(); await page.waitForTimeout(1500); }
    if(await hash()!=='#/prep/ig4/test1') bad('Уровень ИГ: плашка ведёт не на тест ('+await hash()+')');
    if(!await page.$('#wlStart')) bad('Тест ИГ: нет правил перед первой парой'); else { await page.click('#wlStart'); await page.waitForTimeout(800); }
    const ok=await page.evaluate(()=>!!document.querySelector('#ppA svg image, #ppA svg path')&&!!document.querySelector('#ppB svg image, #ppB svg path')); if(!ok) bad('Тест ИГ: фрагменты листа не показаны'); }
  { const fair=await page.evaluate(async()=>{ const img=s=>new Promise(ok=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ok(null);
        i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s.replace(/<svg /,'<svg width="360" height="288" '+(/xmlns=/.test(s.slice(0,400))?'':'xmlns="http://www.w3.org/2000/svg" ')+(/xmlns:xlink/.test(s.slice(0,400))?'':'xmlns:xlink="http://www.w3.org/1999/xlink" '))); });
      const px=async s=>{ const i=await img(s); if(!i) return null; const c=document.createElement('canvas'); c.width=360; c.height=288; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,360,288); x.drawImage(i,0,0,360,288); return x.getImageData(0,0,360,288).data; };
      const types=[...new Set(Object.values(PREP.PLANS).flatMap(p=>p.skills.flatMap(s=>s.nk||[])))], bad=[]; let sd=7; const R=()=>{ sd=(sd*16807)%2147483647; return sd/2147483647; };
      for(const t of types) for(let k=0;k<4;k++){ const pr=PREPW.igPair([t],R); if(!pr){ bad.push(t+': пара не построилась'); continue; } const a=await px(pr.ok), b=await px(pr.bad); if(!a||!b){ bad.push(t+': не рисуется'); continue; }
        let n=0; for(let i=0;i<a.length;i+=4) if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>90) n++; if(n<60) bad.push(t+': разница почти не видна ('+n+' px)'); }
      return {types,bad}; });
    if(fair.types.length<4) bad('Тест ИГ: мало типов ошибок — '+fair.types.join(', ')); fair.bad.forEach(x=>bad('Тест ИГ: '+x)); }
  /* все уровни задания пройдены — открывается само задание */
  await page.evaluate(()=>{ const o={}; PREP.PLANS.ig4.skills.forEach((s,i)=>o[i]={t:1,stars:3}); localStorage.setItem('nch_prep_plan',JSON.stringify({ig4:o})); });
  await page.goto(UN+'#/prep/ig5'); await page.waitForTimeout(400); await page.goto(UN+'#/prep/ig4'); await page.waitForTimeout(900);
  if(!await page.$('a.wd-n.boss.cur[href="#/ig4"]')) bad('Карта инжи: после всех уровней ДЗ №4 не открылось');
  /* перед решением варианта — предложение пройти подготовку, «Сразу открыть решение» */
  await page.evaluate(()=>{ localStorage.setItem('nch_prep_gate','1'); localStorage.removeItem('nch_prep_plan'); sessionStorage.clear(); });
  for(const h of ['#/ng2/17','#/ig4/7']){ await page.goto(UN+h); await page.waitForTimeout(1500);
    if(!await page.$('#ppSkip')){ bad(h+': нет предложения пройти подготовку'); continue; }
    await page.click('#ppSkip'); await page.waitForTimeout(2500);
    if(await page.$('#ppSkip')) bad(h+': «Посмотреть решение» не открыло решение');
    if(!await page.$('.pp-dzchip')) bad(h+': у решения нет строки подготовки'); }
  await page.evaluate(()=>localStorage.removeItem('nch_prep_gate'));
  /* главная копии: первым — «Учиться», ведёт в путь задания, которое выбрал сайт */
  await page.goto(UN+'#/'); await page.waitForTimeout(1800);
  { const r=await page.evaluate(()=>{ const a=document.querySelector('#ns-home .lrn'), first=document.querySelector('#ns-home a, #ns-home button'); return {h:a&&a.getAttribute('href'),first:a&&a===first,want:'#/prep/'+PREP.autoKey()}; });
    if(r.h!==r.want) bad('Главная копии: «Учиться» ведёт на '+r.h+' вместо '+r.want); else if(!r.first) bad('Главная копии: «Учиться» не первое'); }
  await page.evaluate(()=>{ localStorage.removeItem('nch_prep_plan'); sessionStorage.clear(); });
  if(errs.length) bad('Ошибка JS: '+errs[0].slice(0,200));
  info.push(`Экраны: программа, ${Object.keys(PREP.TOPICS).length} тем, ДЗ №4; копия /new/ — ${Object.keys(PREP.PLANS).length} заданий с навыками`);
  await browser.close(); srv.close();
}
const G_N=G.ALL.length;
screens().then(()=>{
  info.forEach(s=>console.log('  '+s));
  if(fails.length){ console.log('\nПодготовка: замечаний '+fails.length); fails.forEach(s=>console.log('  ✗ '+s)); process.exit(1); }
  console.log('\nПодготовка: замечаний 0');
}).catch(e=>{ console.error(e); process.exit(1); });
