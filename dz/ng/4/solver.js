/* ═══════════ ДЗ №4 · решение: линии пересечения поверхностей (разборы на данных примера; решатель вариантов — в работе) ═══════════ */
(function(){
const {dataTable, onVariant, HW, F, H, P, v3, S, seg, pt, conn, txt, note, dim, sq, ang, tick, circ, ell, poly, curve, ln, vec, point, seg3, poly3, axis, G, nvOnH, nvOnF, table, DEG, r1, r2, fmt, f2, U, D2, add2, sub2, mul2, angV, lineNormalAngle, planeAngles, distPlane, polyVis, edgeItems, rub, hideGiven, compPts, ladder, STEP, dot2, newView, connect, along, lvlLines, hidSpans, lineVis, lThru, gammaFor, gamTxt, gamTrace, gamLine, gamCross, facesOf, prismFaces}=NGLIB;
/* ДЗ №4а · свой вариант · линии пересечения: усечённая сфера (полусфера), усечённый конус и цилиндр на π₁.
   Все поверхности — вращения с вертикальными осями (плоскости y=const — вертикальные), поэтому
   секущие горизонтальные плоскости z=const дают в сечениях окружности/прямые: кривые считаем точно. */
HW.calc[4] = (function(){
  const Dk=130,dk=50,Xk=35,Yk=15,Xc=40,Yc=40;              // свой вариант (того же типа)
  const R=80, cut=60, Hh=100, Dc=60;                        // размеры рисунка: Ø160 сферы, срез ±60 (размер 120), высота 100, Ø60 цилиндра
  const xs=90, ys=100;                                      // центр сферы: x=90 (по рисунку не задан, берём любое), y=100 (размер 100 от оси x)
  const cone={c:[xs-Xk,ys+Yk],r0:Dk/2,r1:dk/2}, cyl={c:[xs+Xc,ys+Yc],r:Dc/2}, rc=z=>cone.r0+(cone.r1-cone.r0)*z/Hh;
  const hyp=(x,y)=>Math.hypot(x,y);
  const BODY={
    hemi:p=>p[2]>=0&&hyp(hyp(p[0]-xs,p[1]-ys),p[2])<R-1e-4&&Math.abs(p[1]-ys)<cut-1e-4,
    cone:p=>p[2]>=0&&p[2]<Hh&&hyp(p[0]-cone.c[0],p[1]-cone.c[1])<rc(p[2])-1e-4,
    cyl :p=>p[2]>=0&&p[2]<Hh&&hyp(p[0]-cyl.c[0],p[1]-cyl.c[1])<cyl.r-1e-4 };
  const SURF={
    sph :{body:'hemi',zmax:R,  sec:z=>({t:'c',c:[xs,ys],r:Math.sqrt(Math.max(0,R*R-z*z))}), ok:p=>Math.abs(p[1]-ys)<=cut+1e-6},
    cone:{body:'cone',zmax:Hh, sec:z=>({t:'c',c:cone.c,r:rc(z)}), ok:()=>true},
    cyl :{body:'cyl', zmax:Hh, sec:z=>({t:'c',c:cyl.c,r:cyl.r}), ok:()=>true},
    pF  :{body:'hemi',zmax:R,  sec:z=>({t:'l',y:ys+cut}), ok:p=>(p[0]-xs)**2+(p[1]-ys)**2+p[2]**2<=R*R+1e-6} };
  /* пересечение двух сечений → [минус, плюс] (точки [x,y] или null) */
  const inter=(a,b)=>{
    if(a.t==='l'&&b.t==='c'){ const t=a; a=b; b=t; }
    if(a.t==='c'&&b.t==='l'){ const dy=b.y-a.c[1]; if(Math.abs(dy)>a.r) return null; const hx=Math.sqrt(a.r*a.r-dy*dy); return [[a.c[0]-hx,b.y],[a.c[0]+hx,b.y]]; }
    const dx=b.c[0]-a.c[0], dy=b.c[1]-a.c[1], d=hyp(dx,dy); if(d<1e-9||d>a.r+b.r||d<Math.abs(a.r-b.r)) return null;
    const aa=(d*d+a.r*a.r-b.r*b.r)/(2*d), h=Math.sqrt(Math.max(0,a.r*a.r-aa*aa)), mx=a.c[0]+dx*aa/d, my=a.c[1]+dy*aa/d;
    return [[mx+dy/d*h,my-dx/d*h],[mx-dy/d*h,my+dx/d*h]]; };
  const exists=(s1,s2,z)=>z>=0&&z<=Math.min(s1.zmax,s2.zmax)&&!!inter(s1.sec(z),s2.sec(z));
  /* кривая пересечения двух поверхностей: 3D-ломаная (минус-ветвь вверх, плюс-ветвь вниз) */
  function curveOf(n1,n2,N){ const s1=SURF[n1], s2=SURF[n2], zM=Math.min(s1.zmax,s2.zmax); N=N||260;
    let lo=null,hi=null; for(let z=0;z<=zM+1e-9;z+=0.25){ if(exists(s1,s2,z)){ if(lo===null) lo=z; hi=z; } }
    if(lo===null) return null;
    const refine=(a,b)=>{ for(let k=0;k<40;k++){ const m=(a+b)/2; if(exists(s1,s2,m)) a=m; else b=m; } return a; };
    if(lo>0) lo=(()=>{ let a=lo-0.25,b=lo; for(let k=0;k<40;k++){ const m=(a+b)/2; if(exists(s1,s2,m)) b=m; else a=m; } return b; })();
    if(hi<zM-1e-9) hi=refine(hi,hi+0.25);
    const mi=[],pl=[];
    for(let i=0;i<=N;i++){ const u=i/N, z=lo+(hi-lo)*(1-Math.cos(Math.PI*u))/2; const q=inter(s1.sec(z),s2.sec(z)); if(!q) continue;
      mi.push([q[0][0],q[0][1],z]); pl.push([q[1][0],q[1][1],z]); }
    return { n1,n2,zlo:lo,zhi:hi, pts:mi.concat(pl.reverse()), own:[s1.body,s2.body],
      ok:p=>s1.ok(p)&&s2.ok(p) }; }
  /* контурные линии (3D-ломаные) */
  const arcC=(c,r,a0,a1,z,n)=>{ const o=[]; for(let i=0;i<=n;i++){ const a=a0+(a1-a0)*i/n; o.push([c[0]+r*Math.cos(a),c[1]+r*Math.sin(a),z]); } return o; };
  const rf=Math.sqrt(R*R-cut*cut), sa=Math.asin(cut/R);
  const FEAT=[
    {own:'hemi',v:'H',pts:arcC([xs,ys],R,-sa,sa,0,60)},  {own:'hemi',v:'H',pts:arcC([xs,ys],R,Math.PI-sa,Math.PI+sa,0,60)},
    {own:'hemi',v:'F',pts:(()=>{ const o=[]; for(let i=0;i<=90;i++){ const a=Math.PI*i/90; o.push([xs+R*Math.cos(a),ys,R*Math.sin(a)]); } return o; })()},
    /* кромка среза (полуокружность в плоскости y = const): на π₂ — дуга, на π₁ — отрезок; видимость сверху проверяем по самой кромке, а не по её основанию z = 0 */
    ...[-cut,cut].map(dy=>({own:'hemi',v:'FH',pts:(()=>{ const o=[]; for(let i=0;i<=60;i++){ const a=Math.PI*i/60; o.push([xs+rf*Math.cos(a),ys+dy,rf*Math.sin(a)]); } return o; })()})),
    {own:'cone',v:'F',pts:[[cone.c[0]-cone.r0,cone.c[1],0],[cone.c[0]-cone.r1,cone.c[1],Hh]]},
    {own:'cone',v:'F',pts:[[cone.c[0]+cone.r0,cone.c[1],0],[cone.c[0]+cone.r1,cone.c[1],Hh]]},
    {own:'cone',v:'H',pts:arcC(cone.c,cone.r0,0,2*Math.PI,0,120)},
    {own:'cone',v:'FH',pts:arcC(cone.c,cone.r1,0,2*Math.PI,Hh,80)},
    {own:'cyl',v:'F',pts:[[cyl.c[0]-cyl.r,cyl.c[1],0],[cyl.c[0]-cyl.r,cyl.c[1],Hh]]},
    {own:'cyl',v:'F',pts:[[cyl.c[0]+cyl.r,cyl.c[1],0],[cyl.c[0]+cyl.r,cyl.c[1],Hh]]},
    {own:'cyl',v:'H',pts:arcC(cyl.c,cyl.r,0,2*Math.PI,0,100)},
    {own:'cyl',v:'FH',pts:arcC(cyl.c,cyl.r,0,2*Math.PI,Hh,100)} ];
  /* подразбиваем длинные прямые */
  FEAT.forEach(f=>{ if(f.pts.length===2){ const a=f.pts[0],b=f.pts[1],o=[]; for(let i=0;i<=80;i++) o.push(v3.lerp(a,b,i/80)); f.pts=o; } });
  const buried=(p,own)=>{ const q=[p[0],p[1],p[2]+1e-3]; return Object.keys(BODY).some(k=>!own.includes(k)&&BODY[k](q)); };
  /* луч к наблюдателю: шаг 0.5 мм, луч обрывается, как только вышел за габарит тел (дальше закрывать нечему) */
  let KEYS=null, YM=0, ZM=0;
  const hid=(p,dir)=>{ if(!KEYS){ KEYS=Object.keys(BODY); YM=-1e9; ZM=-1e9; FEAT.forEach(f=>f.pts.forEach(q=>{ if(q[1]>YM) YM=q[1]; if(q[2]>ZM) ZM=q[2]; })); }
    const lim=(dir[1]?YM-p[1]:ZM-p[2])+0.5;
    for(let s=0.05;s<=lim;s+=0.5){ const q=[p[0]+dir[0]*s,p[1]+dir[1]*s,p[2]+dir[2]*s]; for(const k of KEYS) if(BODY[k](q)) return true; } return false; };
  const DIR={F:[0,1,0],H:[0,0,1]};
  /* ломаная → сегменты {a,b,vis} для вида */
  function segsOf(pts,own,view,okFn){ const out=[]; let prev=null;
    pts.forEach(p=>{ const valid=(!okFn||okFn(p))&&!buried(p,own); const cur=valid?{p,vis:!hid(p,DIR[view])}:null;
      if(prev&&cur&&v3.dist(prev.p,cur.p)<8) out.push({a:prev.p,b:cur.p,vis:prev.vis&&cur.vis}); prev=cur; });
    return out; }
  const CV={};
  [['sph','cyl'],['sph','cone'],['cone','cyl'],['pF','cone'],['pF','cyl']].forEach(([a,b])=>{ const c=curveOf(a,b); if(c) CV[a+'-'+b]=c; });
  /* самопроверка утверждений текста: линия конус∩цилиндр целиком внутри полусферы; передняя грань режет конус и цилиндр */
  if(!CV['cone-cyl']||!CV['cone-cyl'].pts.every(p=>BODY.hemi([p[0],p[1],Math.max(p[2],1e-3)]))) throw new Error('ДЗ4а: конус∩цилиндр выходит из полусферы');
  if(!CV['pF-cone']||!CV['pF-cyl']) throw new Error('ДЗ4а: грань среза не режет конус/цилиндр');
  const curves={};
  Object.keys(CV).forEach(k=>{ const c=CV[k]; curves[k]={zlo:c.zlo,zhi:c.zhi,pts:c.pts,F:segsOf(c.pts,c.own,'F',c.ok),H:segsOf(c.pts,c.own,'H',c.ok),
     validN:c.pts.filter(p=>c.ok(p)&&!buried(p,c.own)).length}; });
  const edges={F:[],H:[]};
  FEAT.forEach(f=>{ ['F','H'].forEach(v=>{ if(f.v.includes(v)) edges[v].push(...segsOf(f.pts,[f.own],v)); }); });
  /* точки на вспомогательной плоскости z0 (для шага-образца) */
  /* концы линии сфера∩цилиндр: на π₁ (z = 0) и на передней грани среза y = ys + cut */
  const faceCyl=[-1,1].map(sg=>{ const dy=ys+cut-cyl.c[1]; if(Math.abs(dy)>cyl.r) return null; const x=cyl.c[0]+sg*Math.sqrt(cyl.r*cyl.r-dy*dy), q=R*R-(x-xs)**2-cut*cut;
    return q>=0?[x,ys+cut,Math.sqrt(q)]:null; }).filter(Boolean);
  const z0=25, onPlane={};
  [['sph','cone'],['sph','cyl'],['cone','cyl']].forEach(([a,b])=>{ const q=inter(SURF[a].sec(z0),SURF[b].sec(z0)); if(q) onPlane[a+'-'+b]=q.map(x=>[x[0],x[1],z0]); });
  return {Dk,dk,Xk,Yk,Xc,Yc,R,cut,Hh,Dc,xs,ys,cone,cyl,rc,curves,edges,FEAT,z0,onPlane,SURF,BODY,inter,faceCyl,
    sections:z=>({sph:SURF.sph.sec(z),cone:SURF.cone.sec(z),cyl:SURF.cyl.sec(z)})};
})();

HW.tasks[4] = (function(){
  const c=HW.calc[4];
  const polyOf=(segs,view,kVis,kHid)=>{ const f=view==='F'?F:H, out=[]; let cur=null;
    segs.forEach(s=>{ const k=s.vis?kVis:kHid; if(cur&&cur.k===k&&D2(cur.last,f(s.a))<0.01){ cur.p.push(f(s.b)); cur.last=f(s.b); }
      else { cur={k,p:[f(s.a),f(s.b)],last:f(s.b)}; out.push(cur); } });
    return out.map(o=>poly(o.p,o.k)); };
  const polyAll=(pts,view,k)=>poly(pts.map(view==='F'?F:H),k);
  const ghost=[ ...c.FEAT.flatMap(f=>[ ...(f.v.includes('F')?[polyAll(f.pts,'F','ghost')]:[]), ...(f.v.includes('H')?[polyAll(f.pts,'H','ghost')]:[]) ]),
    seg(F([c.xs+c.R+70,0,0]),F([c.xs-c.R-70,0,0]),'ghost') ];
  const given=[ axis(), ...ghost ];
  const crv=(key,kv,kh)=>{ const q=c.curves[key]; return q? [ ...polyOf(q.F,'F',kv,kh), ...polyOf(q.H,'H',kv,kh) ] : []; };
  const z0=c.z0, sec=c.sections(z0);
  const circH=(s,k)=>circ(H([c.xs*0+ (s.c[0]), s.c[1], 0]),s.r*S,k);
  const hline=ln(F([c.xs+c.R+40,0,z0]),F([c.xs-c.R-40,0,z0]),'aux','Σ','ne',10,10);
  const op=c.onPlane;
  const ptsOnPlane=Object.keys(op).flatMap((k,i)=>op[k].flatMap((p,j)=>{ const cf=SURFS_OK(k,p); return cf? [ pt(H(p),'','ne','res',{r:2.2}), pt(F(p),'','ne','res',{r:2.2}), conn(H(p),F(p)) ] : []; }));
  function SURFS_OK(k,p){ const [a,b]=k.split('-'); return c.SURF[a].ok(p)&&c.SURF[b].ok(p)&&!Object.keys(c.BODY).some(n=>n!==c.SURF[a].body&&n!==c.SURF[b].body&&c.BODY[n]([p[0],p[1],p[2]+1e-3])); }
  const cnt=k=>c.curves[k]?c.curves[k].validN:0;
  const steps=[
   STEP('Читаем условие и выбираем метод',{check:'Назови для каждой пары тел посредник и объясни, почему он даёт окружности или прямые.',
     hint:'Сколько тел и какие у них оси? Что особенного у цилиндра на виде сверху?',
     principle:'Три тела с вертикальными осями стоят на π₁: полусфера (с двумя срезами плоскостями y = const), усечённый конус и цилиндр. Линии пересечения строим способом секущих горизонтальных плоскостей: каждая даёт окружности, общие точки которых — точки линии (урок: поверхности, задачи 73–74, 89).',
     step:'Записываем размеры своего варианта и замечаем: цилиндр ⟂ π₁ → любая линия на нём проецируется на π₁ в его окружность (проецирующая поверхность).',
     full:`Ø160 (R = 80), срез ±60 от центра, высота цилиндра и конуса 100; D<sub>к</sub> = ${c.Dk}, d<sub>к</sub> = ${c.dk}, X<sub>к</sub> = ${c.Xk}, Y<sub>к</sub> = ${c.Yk}, X<sub>ц</sub> = ${c.Xc}, Y<sub>ц</sub> = ${c.Yc}.<br>Допущение: по рисунку ось конуса правее и ближе к зрителю от центра сферы (на X<sub>к</sub> и Y<sub>к</sub>), ось цилиндра левее и ближе (X<sub>ц</sub>, Y<sub>ц</sub>); центр сферы на расстоянии 100 мм от оси x (x центра выбран произвольно — взаимное положение тел от него не зависит).`},
     []),
   STEP('Секущая плоскость Σ: окружности сечений',{check:'Радиус каждой окружности взят с очерка тела на π₂ на высоте плоскости Σ.',
     hint:'Какие линии даёт горизонтальная плоскость в сечении сферы, конуса, цилиндра?',
     principle:'Поверхность вращения с вертикальной осью рассекается горизонтальной плоскостью по окружности, которая на π₁ видна без искажения (урок: поверхности, задача 70).',
     step:`Проводим на π₂ горизонтальную Σ (z = ${z0}). На π₁ строим три окружности: сферы (r = ${fmt(sec.sph.r)}), конуса (r = ${fmt(sec.cone.r)}), цилиндра (r = ${fmt(sec.cyl.r)}).`,
     full:`r<sub>сф</sub> = √(80² − ${z0}²) = ${fmt(sec.sph.r)}; r<sub>к</sub> = ${fmt(c.Dk/2)} − ${fmt((c.Dk-c.dk)/2)}·${z0}/100 = ${fmt(sec.cone.r)}; r<sub>ц</sub> = 30.`},
     [ hline, circH(sec.sph,'aux'), circH(sec.cone,'aux'), circH(sec.cyl,'aux') ]),
   STEP('Точки линий пересечения на Σ',{check:'Каждая точка лежит на двух окружностях сразу; её фронтальная проекция — на следе Σ.',
     hint:'Точки, общие двум поверхностям, лежат сразу на двух окружностях.',
     principle:'Общие точки окружностей двух поверхностей в одной плоскости — точки линии пересечения (метод секущих плоскостей). Перенос на π₂ — по линии связи на след Σ.',
     step:'Находим на π₁ точки пересечения окружностей попарно, переносим на след Σ на π₂. Точки, которые не принадлежат реальной поверхности (вне среза ±60) или спрятаны внутри третьего тела, отбрасываем.',
     full:Object.keys(op).map(k=>`${({'sph-cyl':'сфера ∩ цилиндр','sph-cone':'сфера ∩ конус','cone-cyl':'конус ∩ цилиндр'})[k]}: ${op[k].map(p=>'('+fmt(p[0])+'; '+fmt(p[1])+')').join(' и ')}`).join('<br>')},
     [ ...ptsOnPlane ]),
   STEP('Линия «цилиндр ∩ сфера»',{check:'На π₁ линия совпадает с окружностью цилиндра — проецирующей поверхности.',
     hint:'Начни с цилиндра: на π₁ линия на нём — дуга его окружности. Останется найти высоту z.',
     principle:'Точка цилиндра на окружности π₁ имеет известное расстояние ρ от центра сферы; её высота z = √(R² − ρ²) — это «параллель» сферы через точку (урок: точки на поверхности, задача 68).',
     step:'Для ряда точек окружности цилиндра (в пределах сферы и среза) находим z из уравнения сферы, строим на π₂ плавную кривую, соединяя точки по порядку. Невидимые участки — штрихом.',
     full:`Линия начинается на π₁ (z = 0), поднимается до верхней точки z = ${fmt(c.curves['sph-cyl']?c.curves['sph-cyl'].zhi:0)} мм и обрывается на передней грани среза y = ${c.ys+c.cut}: там цилиндр выходит из сферы, конец линии — точка (${c.faceCyl.map(p=>fmt(p[0])+'; '+fmt(p[1])+'; '+fmt(p[2])).join(') и (')}) на высоте z ≈ ${c.faceCyl.length?fmt(c.faceCyl[0][2]):'—'} мм; дальше линия переходит в прямую «грань ∩ цилиндр». Часть окружности цилиндра с y > ${c.ys+c.cut} лежит вне усечённой сферы. Точек в расчёте: ${cnt('sph-cyl')}.`},
     [ ...crv('sph-cyl','res','resd') ]),
   STEP('Линия «конус ∩ сфера»',{check:'Кривая проходит через все найденные точки по порядку, без изломов.',
     hint:'Возьми несколько горизонтальных плоскостей между z = 0 и верхней точкой. Где окружности сферы и конуса пересекаются?',
     principle:'Для каждой Σ: окружность сферы ∩ окружность конуса — две точки. Высоту верхней (предельной) точки находим, когда окружности касаются (урок: линии пересечения, задача 74).',
     step:'Повторяем для серии плоскостей, строим на π₁ и π₂ кривую через точки. Характерные точки — основание (z = 0), самая высокая точка (окружности касаются), точки на очерках.',
     full:`z<sub>max</sub> = ${fmt(c.curves['sph-cone']?c.curves['sph-cone'].zhi:0)} мм. Точек в расчёте: ${cnt('sph-cone')}.`},
     [ ...crv('sph-cone','res','resd') ]),
   STEP('Линия «конус ∩ цилиндр»',{check:'На π₁ линия — на окружности цилиндра; на π₂ — по высотам точек.',
     hint:'Цилиндр и конус — оба вертикальные. Окружности пересекаются, пока сумма радиусов больше расстояния между осями. А видна ли эта линия на чертеже?',
     principle:'Условие пересечения окружностей: |r₁ − r₂| ≤ d ≤ r₁ + r₂. У конуса r уменьшается с высотой, поэтому линия кончается на высоте, где r<sub>к</sub> + 30 = d (окружности касаются снаружи). Линия, лежащая внутри третьего тела, на чертеже отсутствует.',
     step:'Строим линию так же (точки на Σ, серия плоскостей). Затем проверяем её положение: она вся оказывается внутри полусферы — значит, это не линия на поверхности составного тела, и на готовом чертеже её нет. Показываем тонким штрихом только для контроля.',
     full:`d = √(${fmt(c.Xk+c.Xc)}² + ${fmt(c.Yc-c.Yk)}²) = ${fmt(Math.hypot(c.Xk+c.Xc,c.Yc-c.Yk))} мм; z<sub>max</sub> = (${fmt(c.Dk/2)} − (d − 30))/${fmt((c.Dk-c.dk)/200)} = ${fmt(c.curves['cone-cyl']?c.curves['cone-cyl'].zhi:0)} мм. Проверка: все расчётные точки (${c.curves['cone-cyl']?c.curves['cone-cyl'].pts.length:0}) лежат внутри полусферы.`},
     [ polyAll(c.curves['cone-cyl'].pts,'F','auxd'), polyAll(c.curves['cone-cyl'].pts,'H','auxd') ]),
   STEP('Линии на плоскости среза',{check:'На плоскости среза линии сечения — дуги окружностей в натуральную величину на π₂.',
     hint:'Срезы сферы — плоские грани y = const. Их тоже пересекают конус и цилиндр.',
     principle:'Плоскость уровня (фронтальная) пересекает поверхности вращения по кривым, видимым на π₂ в натуральную величину; на π₁ они — отрезки прямой y = const.',
     step:'Переднюю грань (y = 160) пересекают конус и цилиндр: строим эти линии тем же способом плоскостей z = const; на π₁ они ложатся на след грани.',
     full:`Линии на грани y = 160: конус — ${cnt('pF-cone')?'есть':'нет'} (расчётных точек: ${cnt('pF-cone')}), цилиндр — ${cnt('pF-cyl')?'есть':'нет'} (расчётных точек: ${cnt('pF-cyl')}).`},
     [ ...crv('pF-cone','res','resd'), ...crv('pF-cyl','res','resd') ]),
   STEP('Очерки и видимость',{check:'Внутри соседнего тела контуров нет; видимость каждого участка — по обеим поверхностям.',
     hint:'Убери из контуров всё, что лежит внутри других тел, а невидимое — штрихом.',
     principle:'Ребро (очерк) тела остаётся на чертеже, только если оно на границе объединения тел; невидимое оформляют штрихом (урок 4, видимость по конкурирующим точкам).',
     step:'Обводим контуры тел: удаляем участки внутри других тел, остальные — сплошной (видимые) или штриховой (невидимые) линией. Основные линии: толстая чёрная; линии пересечения — красные.',
     full:'Видимость определена лучом от наблюдателя (сверху — вдоль −z, спереди — вдоль −y) по всем трём телам.'},
     [ ...polyOf(c.edges.F,'F','main','hid'), ...polyOf(c.edges.H,'H','main','hid') ])
  ];
  return { n:4, q:'<b>ДЗ №4а · разбор на своём варианте.</b> Построить проекции линий пересечения заданных поверхностей: полусферы Ø160 (срез ±60), усечённого конуса D<sub>к</sub> = '+HW.calc[4].Dk+', d<sub>к</sub> = '+HW.calc[4].dk+' и цилиндра Ø60; высота конуса и цилиндра 100 мм.',
    data: table(['D<sub>к</sub>','d<sub>к</sub>','X<sub>к</sub>','Y<sub>к</sub>','X<sub>ц</sub>','Y<sub>ц</sub>'],[[c.Dk,c.dk,c.Xk,c.Yk,c.Xc,c.Yc]])+'<p class="hw-dim">Центр сферы — на расстоянии 100 мм от оси x; сфера усечена фронтальными плоскостями на расстоянии 60 мм от центра.</p>',
    intro:'Три тела на плоскости π₁. Кривые считаем точно: секущие горизонтальные плоскости дают окружности, а по точкам строим линии. Допущения о чтении рисунка — в шаге 1.',
    given, steps,
    ans:'Линии пересечения (красные, невидимые участки — штрихом): цилиндр ∩ сфера, конус ∩ сфера, линии на передней грани среза y = 160 (грань ∩ конус — кривая, грань ∩ цилиндр — прямая). Линия конус ∩ цилиндр целиком внутри полусферы — на чертеже её нет (тонкий синий штрих — только контроль).' };
})();

/* ДЗ №4б · свой вариант того же типа, что варианты 26–30: полусфера Ø150 на π₁, соосный с ней вертикальный цилиндр Ø40,
   наклонный цилиндр Ø50 (ось через центр сферы под углом α к π₁, во фронтальной плоскости симметрии) и цилиндр Ø60, ось ⟂ π₂.
   Соосные поверхности вращения пересекаются по окружностям (плоскости ⟂ общей оси) — две линии строятся сразу.
   Цилиндр ⟂ π₂ — фронтально-проецирующий: на π₂ линия лежит на его окружности; y находим горизонтальными плоскостями:
   сфера → окружность r(z) = √(R² − z²), цилиндр → образующие ∥ y. Все точки проверяются подстановкой в уравнения поверхностей. */
HW.calc['4b'] = (function(){
  const xo=95, yo=95, R=75;                          // полусфера: центр O на π₁, R = 75 (Ø150)
  const r1=20, h1=120;                               // вертикальный цилиндр Ø40, соосный со сферой, высота 120
  const al=30, r2=25, t0=50, t2=100;                 // наклонный цилиндр Ø50: ось из O под α = 30° вправо-вверх, торец на расстоянии 100 от O
  const xc=xo+40, zc=30, rc=30, y1=yo-75, y2=yo+75;  // цилиндр Ø60 ⟂ π₂, лежит на π₁: ось x = xo + 40 (X ц), z = 30 (Z ц), длина 150
  const O=[xo,yo,0], ca=Math.cos(al*Math.PI/180), sa=Math.sin(al*Math.PI/180);
  const u=[-ca,0,sa], w=[sa,0,ca];                    // ось наклонного цилиндра (x на эпюре растёт влево — цилиндр уходит вправо) и нормаль к ней во фронтальной плоскости
  const ax=t=>[xo+u[0]*t,yo,u[2]*t];
  const rz=z=>Math.sqrt(Math.max(0,R*R-z*z));
  /* линия 1: сфера ∩ вертикальный цилиндр — окружность на высоте z₁ */
  const z1=Math.sqrt(R*R-r1*r1);
  const L1=[]; for(let i=0;i<=120;i++){ const a=2*Math.PI*i/120; L1.push([xo+r1*Math.cos(a),yo+r1*Math.sin(a),z1]); }
  /* линия 2: сфера ∩ наклонный цилиндр — окружность в плоскости ⟂ оси на расстоянии d₂ от O */
  const d2=Math.sqrt(R*R-r2*r2), C2=ax(d2);
  const L2=[]; for(let i=0;i<=160;i++){ const a=2*Math.PI*i/160; L2.push([C2[0]+r2*(w[0]*Math.cos(a)),yo+r2*Math.sin(a),C2[2]+r2*(w[2]*Math.cos(a))]); }
  const L2top=[C2[0]+r2*w[0],yo,C2[2]+r2*w[2]], L2bot=[C2[0]-r2*w[0],yo,C2[2]-r2*w[2]], L2f=[C2[0],yo+r2,C2[2]], L2b=[C2[0],yo-r2,C2[2]];
  /* линия 3: сфера ∩ цилиндр ⟂ π₂ */
  const onCyl=th=>[xc+rc*Math.cos(th), zc+rc*Math.sin(th)];
  const D=th=>{ const [x,z]=onCyl(th); return rz(z)**2-(x-xo)**2; };        // (y − y₀)² для точки окружности цилиндра
  const bis=(a,b)=>{ for(let k=0;k<60;k++){ const m=(a+b)/2; if((D(a)>=0)===(D(m)>=0)) a=m; else b=m; } return (a+b)/2; };
  let ch=0; for(let i=0;i<720;i++){ const a=i/720*2*Math.PI, b=(i+1)/720*2*Math.PI; if((D(a)>=0)!==(D(b)>=0)) ch++; }
  if(ch!==2) throw new Error('ДЗ4б: цилиндр ⟂ π₂ должен врезаться в сферу одной дугой, смен знака: '+ch);
  if(D(Math.PI)<0||D(0)>=0) throw new Error('ДЗ4б: нарушено расположение цилиндра ⟂ π₂');
  const tha=bis(0,Math.PI), thb=bis(Math.PI,2*Math.PI);              // концы дуги внутри сферы: верхний θa ∈ (0, π), нижний θb ∈ (π, 2π)
  const ptAt=(th,sg)=>{ const [x,z]=onCyl(th); return [x,yo+sg*Math.sqrt(Math.max(0,D(th))),z]; };
  const N=300, fr=[], bk=[];
  for(let i=0;i<=N;i++){ const q=i/N, th=tha+(thb-tha)*(1-Math.cos(Math.PI*q))/2; fr.push(ptAt(th,1)); bk.push(ptAt(th,-1)); }
  const L3=fr.concat(bk.slice().reverse());
  /* самопроверка: точки на обеих поверхностях */
  const onS=p=>Math.abs(Math.hypot(p[0]-xo,p[1]-yo,p[2])-R);
  const err=(m)=>{ throw new Error('ДЗ4б: '+m); };
  L1.forEach(p=>{ if(onS(p)>1e-6||Math.abs(Math.hypot(p[0]-xo,p[1]-yo)-r1)>1e-6) err('линия 1 не на поверхностях'); });
  L2.forEach(p=>{ const q=[p[0]-xo,p[1]-yo,p[2]], t=q[0]*u[0]+q[2]*u[2], rr=Math.hypot(q[0]-u[0]*t,q[1],q[2]-u[2]*t); if(onS(p)>1e-6||Math.abs(rr-r2)>1e-6||t<t0||t>t2) err('линия 2 не на поверхностях'); });
  L3.forEach(p=>{ if(onS(p)>1e-6||Math.abs(Math.hypot(p[0]-xc,p[2]-zc)-rc)>1e-6||p[1]<y1||p[1]>y2) err('линия 3 не на поверхностях'); });
  if(zc+rc>=z1) err('цилиндр Ø60 не должен встречать цилиндр Ø40 вне сферы'); if(zc-rc<0) err('цилиндр Ø60 уходит под π₁');
  if(t0*sa-r2*ca<=0) err('наклонный цилиндр уходит под π₁'); if(Math.hypot(t0,r2)>=R) err('нижний торец наклонного цилиндра должен быть внутри сферы');
  /* опорные точки линии 3 */
  const K1=ptAt(tha,0), K2=ptAt(thb,0);                                 // на главном меридиане сферы (очерк на π₂)
  const TOP=[ptAt(Math.PI/2,1),ptAt(Math.PI/2,-1)], BOT=[ptAt(1.5*Math.PI,1),ptAt(1.5*Math.PI,-1)];
  const CYL=[ptAt(Math.PI,1),ptAt(Math.PI,-1)];                         // на очерковых образующих цилиндра на π₁ (z = z ц)
  if(D(Math.PI/2)<0||D(1.5*Math.PI)<0) err('высшая/низшая образующие цилиндра должны пересекать сферу');
  const LV=[zc+rc*0.6,zc-rc*0.6].map(z=>{ const dx=Math.sqrt(rc*rc-(z-zc)**2); const xs=[xc-dx,xc+dx];
    return {z,r:rz(z),x:xs,pts:xs.flatMap(x=>{ const q=rz(z)**2-(x-xo)**2; return q>=0?[[x,yo+Math.sqrt(q),z],[x,yo-Math.sqrt(q),z]]:[]; })}; });
  /* тела: видимость лучом и удаление контуров внутри соседнего тела */
  const BODY={ sph:p=>p[2]>=0&&Math.hypot(p[0]-xo,p[1]-yo,p[2])<R-1e-4,
               c1:p=>p[2]>=0&&p[2]<h1&&Math.hypot(p[0]-xo,p[1]-yo)<r1-1e-4,
               c2:p=>{ const q=[p[0]-xo,p[1]-yo,p[2]], t=q[0]*u[0]+q[2]*u[2]; return t>t0&&t<t2&&Math.hypot(q[0]-u[0]*t,q[1],q[2]-u[2]*t)<r2-1e-4; },
               c3:p=>p[1]>y1&&p[1]<y2&&Math.hypot(p[0]-xc,p[2]-zc)<rc-1e-4 };
  const buried=(p,own)=>Object.keys(BODY).some(k=>!own.includes(k)&&BODY[k](p));
  /* луч к наблюдателю: шаг 0.5 мм, луч обрывается, как только вышел за габарит тел (дальше закрывать нечему) */
  let KEYS=null, YM=0, ZM=0;
  const hid=(p,dir)=>{ if(!KEYS){ KEYS=Object.keys(BODY); YM=-1e9; ZM=-1e9; FEAT.forEach(f=>f.pts.forEach(q=>{ if(q[1]>YM) YM=q[1]; if(q[2]>ZM) ZM=q[2]; })); }
    const lim=(dir[1]?YM-p[1]:ZM-p[2])+0.5;
    for(let s=0.05;s<=lim;s+=0.5){ const q=[p[0]+dir[0]*s,p[1]+dir[1]*s,p[2]+dir[2]*s]; for(const k of KEYS) if(BODY[k](q)) return true; } return false; };
  const DIR={F:[0,1,0],H:[0,0,1]};
  function segsOf(pts,own,view){ const out=[]; let prev=null;
    pts.forEach(p=>{ const cur=buried(p,own)?null:{p,vis:!hid(p,DIR[view])};
      if(prev&&cur&&v3.dist(prev.p,cur.p)<8) out.push({a:prev.p,b:cur.p,vis:prev.vis&&cur.vis}); prev=cur; });
    return out; }
  const line=(a,b,n)=>{ const o=[]; for(let i=0;i<=n;i++) o.push(v3.lerp(a,b,i/n)); return o; };
  const arc=(n,f)=>{ const o=[]; for(let i=0;i<=n;i++) o.push(f(i/n)); return o; };
  const g2=(sg,t)=>[xo+u[0]*t+sg*r2*w[0],yo,u[2]*t+sg*r2*w[2]];            // очерковые образующие наклонного цилиндра на π₂
  const FEAT=[
    {own:'sph',v:'F',pts:arc(180,q=>[xo+R*Math.cos(Math.PI*q),yo,R*Math.sin(Math.PI*q)])},
    {own:'sph',v:'H',pts:arc(240,q=>[xo+R*Math.cos(2*Math.PI*q),yo+R*Math.sin(2*Math.PI*q),0])},
    {own:'c1',v:'F',pts:line([xo-r1,yo,0],[xo-r1,yo,h1],120)}, {own:'c1',v:'F',pts:line([xo+r1,yo,0],[xo+r1,yo,h1],120)},
    {own:'c1',v:'F',pts:line([xo-r1,yo,h1],[xo+r1,yo,h1],20)},
    {own:'c1',v:'H',pts:arc(120,q=>[xo+r1*Math.cos(2*Math.PI*q),yo+r1*Math.sin(2*Math.PI*q),h1])},
    {own:'c2',v:'F',pts:line(g2(1,t0),g2(1,t2),100)}, {own:'c2',v:'F',pts:line(g2(-1,t0),g2(-1,t2),100)}, {own:'c2',v:'F',pts:line(g2(-1,t2),g2(1,t2),25)},
    {own:'c2',v:'H',pts:line([ax(t0)[0],yo+r2,ax(t0)[2]],[ax(t2)[0],yo+r2,ax(t2)[2]],100)}, {own:'c2',v:'H',pts:line([ax(t0)[0],yo-r2,ax(t0)[2]],[ax(t2)[0],yo-r2,ax(t2)[2]],100)},
    {own:'c2',v:'H',pts:arc(120,q=>{ const a=2*Math.PI*q, c=ax(t2); return [c[0]+r2*w[0]*Math.cos(a),yo+r2*Math.sin(a),c[2]+r2*w[2]*Math.cos(a)]; })},
    {own:'c3',v:'F',pts:arc(160,q=>[xc+rc*Math.cos(2*Math.PI*q),y2,zc+rc*Math.sin(2*Math.PI*q)])},
    {own:'c3',v:'H',pts:line([xc-rc,y1,zc],[xc-rc,y2,zc],200)}, {own:'c3',v:'H',pts:line([xc+rc,y1,zc],[xc+rc,y2,zc],200)},
    ...[y1,y2].map(y=>({own:'c3',v:'H',pts:arc(40,q=>{ const x=xc-rc+2*rc*q; return [x,y,zc+Math.sqrt(Math.max(0,rc*rc-(x-xc)**2))]; })})) ];
  const edges={F:[],H:[]};
  FEAT.forEach(f=>['F','H'].forEach(v=>{ if(f.v.includes(v)) edges[v].push(...segsOf(f.pts,[f.own],v)); }));
  const curves={ L1H:segsOf(L1,['sph','c1'],'H'), L1F:segsOf(L1,['sph','c1'],'F'), L2H:segsOf(L2,['sph','c2'],'H'), L2F:segsOf(L2,['sph','c2'],'F'),
                 L3H:segsOf(L3,['sph','c3'],'H'), L3F:segsOf(L3,['sph','c3'],'F') };
  /* видимость сверху: на линии 3 видны точки верхней половины цилиндра Ø60, вне закрытия вертикальным цилиндром */
  if(curves.L3H.some(s=>s.vis&&s.a[2]<zc-0.5&&s.b[2]<zc-0.5)) err('видимость линии 3 на π₁');
  if(curves.L1H.some(s=>!s.vis)) err('линия 1 сверху видна целиком');
  return {xo,yo,R,r1,h1,al,r2,t0,t2,xc,zc,rc,y1,y2,O,u,w,ax,rz,z1,d2,C2,L2top,L2bot,L2f,L2b,tha,thb,fr,bk,K1,K2,TOP,BOT,CYL,LV,edges,FEAT,curves};
})();

HW.tasks['4b'] = (function(){
  const c=HW.calc['4b'];
  const polyOf=(segs,view,kVis,kHid)=>{ const f=view==='F'?F:H, out=[]; let cur=null;
    segs.forEach(s=>{ const k=s.vis?kVis:kHid; if(cur&&cur.k===k&&D2(cur.last,f(s.a))<0.01){ cur.p.push(f(s.b)); cur.last=f(s.b); }
      else { cur={k,p:[f(s.a),f(s.b)],last:f(s.b)}; out.push(cur); } });
    return out.map(o=>poly(o.p,o.k)); };
  const ghost=[ ...c.FEAT.flatMap(f=>[ ...(f.v.includes('F')?[poly(f.pts.map(F),'ghost')]:[]), ...(f.v.includes('H')?[poly(f.pts.map(H),'ghost')]:[]) ]),
    seg(F([c.xo-c.R,0,0]),F([c.xo+c.R,0,0]),'ghost') ];
  const axF=(p,q)=>seg(F(p),F(q),'thin');
  const given=[ axis(), ...ghost, pt(F(c.O),'O″','s',null,{r:1.6}), pt(H(c.O),'O′','ne',null,{r:1.6}),
    axF([c.xo,c.yo,-6],[c.xo,c.yo,c.h1+8]), axF(c.ax(-8),c.ax(c.t2+10)), axF([c.xc+c.rc+8,0,c.zc],[c.xc-c.rc-8,0,c.zc]), axF([c.xc,0,c.zc+c.rc+8],[c.xc,0,c.zc-c.rc-8]) ];
  const hl=(z,lab)=>ln(F([c.xo+c.R+15,0,z]),F([c.xc-c.rc-25,0,z]),'aux',lab,'ne',6,6);
  const cH=(z,k)=>circ(H([c.xo,c.yo,0]),c.rz(z)*S,k);
  const genH=(x,k)=>seg(H([x,c.y1,0]),H([x,c.y2,0]),k);
  const pair=(a,b,n1,n2,k)=>[ conn(F(a),H(a)), conn(F(b),H(b)), pt(F(a),n1+'″≡'+n2+'″','ne',k), pt(H(a),n1+'′','ne',k), pt(H(b),n2+'′','se',k) ];
  const [T1,T2]=c.TOP, [B1,B2]=c.BOT, [C1,C2]=c.CYL;
  const ell=c.L2;
  const steps=[
   STEP('Анализ: какие поверхности соосны, какая проецирующая',{check:'Найди соосные пары: у них линия — окружность, её не строят по точкам.',
     hint:'Через какую точку проходят оси обоих цилиндров Ø40 и Ø50? А куда направлена ось цилиндра Ø60?',
     principle:'Оси вертикального цилиндра Ø40 и наклонного цилиндра Ø50 проходят через центр сферы O. Поверхности вращения с общей осью (соосные) пересекаются по <b>окружностям</b>, плоскости которых ⟂ оси. Если ось ∥ плоскости проекций, такая окружность проецируется на неё в отрезок. Цилиндр Ø60 с осью ⟂ π₂ — фронтально-проецирующий: на π₂ его линия пересечения со сферой лежит на его окружности.',
     step:'Получается три линии пересечения: сфера ∩ цилиндр Ø40 и сфера ∩ цилиндр Ø50 — окружности, сфера ∩ цилиндр Ø60 — пространственная кривая, которую строим по точкам.',
     full:`Сфера: центр O(${c.xo}; ${c.yo}; 0), R = ${c.R}, z ≥ 0. Цилиндр Ø${2*c.r1}: ось через O ⟂ π₁, высота ${c.h1}. Цилиндр Ø${2*c.r2}: ось через O во фронтальной плоскости симметрии под α = ${c.al}° к π₁, торец на расстоянии ${c.t2} от O. Цилиндр Ø${2*c.rc}: ось ⟂ π₂ на x = ${c.xc}, z = ${c.zc}, длина ${c.y2-c.y1}.`},
     []),
   STEP('Сфера ∩ цилиндр Ø40 — окружность',{check:'Окружность лежит в плоскости ⟂ оси; на π₂ она отрезок между точками пересечения очерков.',
     hint:'На какой высоте окружность цилиндра радиуса 20 лежит на сфере радиуса 75?',
     principle:'Общая ось вертикальна, значит линия — горизонтальная окружность: на π₂ это отрезок ∥ x, на π₁ она совпадает с окружностью цилиндра.',
     step:`На π₂ отрезок между точками, где очерковые образующие цилиндра встречают главный меридиан сферы. Высота z₁ = √(R² − r²) = √(${c.R}² − ${c.r1}²) ≈ ${fmt(c.z1)} мм. На π₁ линия совпадает с окружностью Ø${2*c.r1} и видна целиком.`,
     full:'Окружность лежит в горизонтальной плоскости z = '+fmt(c.z1)+' — на π₁ без искажения, на π₂ — в отрезок.'},
     [ ...polyOf(c.curves.L1F.filter(q=>q.vis),'F','res','resd'), ...polyOf(c.curves.L1H,'H','res','resd') ]),
   STEP('Сфера ∩ цилиндр Ø50 — окружность',{check:'То же: отрезок на π₂ между точками пересечения очерков сферы и цилиндра.',
     hint:'Ось цилиндра ∥ π₂. Во что на π₂ проецируется окружность, плоскость которой ⟂ этой оси?',
     principle:'Общая ось наклонного цилиндра и сферы лежит во фронтальной плоскости, поэтому окружность пересечения ⟂ π₂: на π₂ — отрезок ⟂ проекции оси, на π₁ — эллипс.',
     step:`На π₂ соединяем точки 7″ и 8″ — пересечения очерковых образующих цилиндра с меридианом сферы; центр окружности C на оси на расстоянии √(${c.R}² − ${c.r2}²) ≈ ${fmt(c.d2)} мм от O. На π₁ — эллипс с центром C′: большая полуось ∥ y и равна ${c.r2} мм (точки 9′ и 10′), малая — 7′C′ = ${c.r2}·sin ${c.al}° ≈ ${fmt(c.r2*Math.sin(c.al*Math.PI/180))} мм.`,
     full:`C(${fmt(c.C2[0])}; ${fmt(c.C2[1])}; ${fmt(c.C2[2])}). Видимость эллипса на π₁ определяем по тому, закрыт ли участок цилиндром сверху.`},
     [ ...point('7',c.L2top,{k:'res',l2:'ne',l1:'n'}), ...point('8',c.L2bot,{k:'res',l2:'sw',l1:'s'}),
       conn(F(c.C2),H(c.L2f)), pt(H(c.L2f),'9′','s','res'), pt(H(c.L2b),'10′','n','res'),
       ...polyOf(c.curves.L2F.filter(q=>q.vis),'F','res','resd'), ...polyOf(c.curves.L2H,'H','res','resd') ]),
   STEP('Сфера ∩ цилиндр Ø60: проекция на π₂ уже есть',{check:'На π₂ линия совпадает с окружностью цилиндра — его вырожденной проекцией.',
     hint:'Во что проецируется на π₂ любая линия на цилиндре с осью ⟂ π₂?',
     principle:'Цилиндр Ø60 фронтально-проецирующий: его поверхность на π₂ — окружность. Значит, фронтальная проекция линии — дуга этой окружности внутри очерка сферы. Остаётся найти y каждой точки.',
     step:'Вспомогательные плоскости — горизонтальные: сферу z = const режет по окружности радиуса √(R² − z²) (на π₁ — без искажения), цилиндр — по образующим ∥ y. Их пересечения на π₁ — точки кривой.',
     full:`На уровне z: y = ${c.yo} ± √(R² − z² − (x − ${c.xo})²).`},
     [ poly(c.fr.map(F),'res') ]),
   STEP('Опорные точки K₁, K₂ на очерке сферы',{check:'Опорные точки лежат на главном меридиане сферы — их проекции на очерке.',
     hint:'Где дуга цилиндра встречает очерк сферы на π₂?',
     principle:'Очерк сферы на π₂ — главный меридиан во фронтальной плоскости y = y<sub>O</sub>. Точки дуги на нём принадлежат линии и лежат на π₁ на горизонтали через O′.',
     step:'K₁″ и K₂″ — пересечения окружности цилиндра с очерком сферы. По линиям связи — на прямую y = y<sub>O</sub> на π₁: K₁′, K₂′. В них передняя ветвь линии переходит в заднюю.',
     full:`K₁(${fmt(c.K1[0])}; ${fmt(c.K1[1])}; ${fmt(c.K1[2])}), K₂(${fmt(c.K2[0])}; ${fmt(c.K2[1])}; ${fmt(c.K2[2])}).`},
     [ ln(H([c.xc+c.rc+10,c.yo,0]),H([c.xo-10,c.yo,0]),'aux',null,null,0,0), ...[[c.K1,'K₁','nw'],[c.K2,'K₂','sw']].flatMap(([p,n,l])=>point(n,p,{k:'res',l2:l,l1:'ne'})) ]),
   STEP('Высшие и низшие точки',{check:'Между высшей и низшей точками кривая не поднимается выше и не опускается ниже — проверь по всем найденным точкам.',
     hint:'Самая высокая и самая низкая образующие цилиндра — какие точки кривой они дают?',
     principle:'Верхняя и нижняя образующие цилиндра Ø60 дают высшие и низшие точки линии. Для каждой — горизонтальная плоскость через неё: окружность сферы ∩ образующая.',
     step:`Плоскость Σ₁: z = ${fmt(c.zc+c.rc)}, окружность сферы r = ${fmt(c.rz(c.zc+c.rc))}, образующая x = ${c.xc} → точки 1 (спереди) и 2 (сзади). Плоскость Σ₂: z = ${fmt(c.zc-c.rc)}, r = ${fmt(c.rz(c.zc-c.rc))} → точки 3 и 4.`,
     full:`1(${fmt(T1[0])}; ${fmt(T1[1])}; ${fmt(T1[2])}), 3(${fmt(B1[0])}; ${fmt(B1[1])}; ${fmt(B1[2])}); 2 и 4 симметричны им относительно y = ${c.yo}.`},
     [ hl(c.zc+c.rc,'Σ₁'), hl(c.zc-c.rc,'Σ₂'), cH(c.zc+c.rc,'aux'), cH(c.zc-c.rc,'aux'), genH(c.xc,'aux'), ...pair(T1,T2,'1','2','res'), ...pair(B1,B2,'3','4','res') ]),
   STEP('Точки на очерке цилиндра — граница видимости',{check:'В этих точках линия меняет видимость на π₁.',
     hint:'Сверху цилиндр Ø60 закрывает часть кривой. По какой его образующей проходит граница?',
     principle:'Очерк цилиндра на π₁ — крайние образующие на уровне оси (z = z<sub>ц</sub>). Точки линии на них отделяют видимую сверху часть (верхняя половина цилиндра) от невидимой.',
     step:`Плоскость Σ₃: z = ${c.zc} (через ось цилиндра), окружность сферы r = ${fmt(c.rz(c.zc))}, образующая x = ${c.xc-c.rc} → точки 5 и 6. Вторая образующая x = ${c.xc+c.rc} лежит вне сферы.`,
     full:`5(${fmt(C1[0])}; ${fmt(C1[1])}; ${fmt(C1[2])}), 6 — симметрично.`},
     [ hl(c.zc,'Σ₃'), cH(c.zc,'aux'), genH(c.xc-c.rc,'aux'), ...pair(C1,C2,'5','6','res') ]),
   STEP('Промежуточные точки',{check:'Каждая промежуточная точка — на параллели сферы и на образующей цилиндра одновременно.',
     hint:'Хватит ли этих точек для плавной кривой?',
     principle:'Ещё несколько горизонтальных плоскостей между опорными. Каждая даёт до четырёх точек: две образующие цилиндра × передняя и задняя ветви.',
     step:`Плоскости z = ${c.LV.map(l=>fmt(l.z)).join(' и z = ')}: окружности сферы r = ${c.LV.map(l=>fmt(l.r)).join(' и ')}.`,
     full:c.LV.map(l=>`z = ${fmt(l.z)}: `+l.pts.map(p=>'('+fmt(p[0])+'; '+fmt(p[1])+')').join(', ')).join('<br>')},
     [ ...c.LV.flatMap(l=>[ hl(l.z,null), cH(l.z,'aux'), ...l.x.map(x=>genH(x,'aux')), ...l.pts.flatMap(p=>[ conn(F(p),H(p)), pt(H(p),'','ne','res',{r:2.2}), pt(F(p),'','ne','res',{r:2.2}) ]) ]) ]),
   STEP('Соединяем и определяем видимость',{check:'Кривая замкнута и плавная; невидимая часть — штриховой.',
     hint:'В каком порядке соединять точки и какая часть кривой видна сверху?',
     principle:'Точки соединяем в порядке обхода дуги на π₂: передняя ветвь от K₁ через 1, 5, 3 к K₂, затем задняя. На π₁ видна часть на верхней половине цилиндра (выше точек 5, 6), остальное — штрихом.',
     step:'Проводим плавную замкнутую кривую на π₁. На π₂ передняя и задняя ветви совпадают с дугой окружности цилиндра.',
     full:'Видимость проверена лучом от наблюдателя: сверху — вдоль −z, спереди — вдоль −y.'},
     [ ...polyOf(c.curves.L3H,'H','res','resd'), ...polyOf(c.curves.L3F.filter(q=>q.vis),'F','res','resd') ]),
   STEP('Обводка очерков',{check:'Очерки, ушедшие внутрь соседнего тела, удалены.',
     hint:'Какие контуры теперь лишние, а какие закрыты?',
     principle:'Контур тела остаётся только там, где он на границе объединения тел. Невидимые участки — штриховые.',
     step:'Очерк сферы внутри цилиндров удаляем, очерковые образующие цилиндров внутри сферы — тоже. Закрытые участки — штрихом.',
     full:'Очерки обведены по расчёту: участок контура внутри соседнего тела убран, закрытый — штрихом.'},
     [ ...polyOf(c.edges.F,'F','main','hid'), ...polyOf(c.edges.H,'H','main','hid'), seg(F([c.xo-c.R,0,0]),F([c.xo+c.R,0,0]),'main') ])
  ];
  return { n:'4б', q:'<b>ДЗ №4б · разбор на своём варианте.</b> Построить проекции линий пересечения заданных поверхностей: полусферы Ø150, вертикального цилиндра Ø40, наклонного цилиндра Ø50 и цилиндра Ø60, ось которого ⟂ π₂.',
    data: table(['','X ц','Z ц','α'],[['Наш вариант',c.xc-c.xo,c.zc,c.al+'°']])+'<p class="hw-dim">Полусфера Ø'+(2*c.R)+' стоит на π₁, центр на расстоянии '+c.yo+' мм от оси x. Цилиндр Ø'+(2*c.r1)+' соосен со сферой, высота '+c.h1+'. Ось цилиндра Ø'+(2*c.r2)+' проходит через центр сферы под углом α к π₁, длина '+c.t2+' от центра. Цилиндр Ø'+(2*c.rc)+' длиной '+(c.y2-c.y1)+': ось ⟂ π₂, смещена на X ц влево и на Z ц вверх.</p>',
    intro:'Тот же тип, что варианты 26–30. Две линии — окружности (соосные поверхности), третью строим по точкам горизонтальными плоскостями.',
    given, steps,
    ans:'Сфера ∩ цилиндр Ø40 — горизонтальная окружность (на π₂ отрезок, на π₁ совпадает с окружностью цилиндра). Сфера ∩ цилиндр Ø50 — окружность ⟂ оси (на π₂ отрезок 7″8″, на π₁ эллипс). Сфера ∩ цилиндр Ø60 — замкнутая кривая: на π₂ дуга окружности цилиндра между K₁″ и K₂″, на π₁ замкнутая кривая, участок ниже оси цилиндра невидим.' };
})();

/* ── ДЗ №4: разобранные примеры (4а — тип 6–10, 4б — тип 26–30); решатель вариантов по размерам — в работе ── */
DZR.def('ng4',{ examples:{'4a2':()=>HW.tasks[4],'4b3':()=>HW.tasks['4b']} });
})();
