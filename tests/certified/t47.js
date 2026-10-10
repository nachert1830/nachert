/* ═══════════ № 47 — расстояние от точки A до прямой a ═══════════
   Протокол построения в двух исполнениях: в пространстве (по определению) и на эпюре (как на сайте и на РК).
   Ядро 3D находит K прямо как a ∩ α, α ⟂ a через A. Эпюр идёт способом сайта: горизонталь и фронталь α,
   посредник γ ⊃ a, линия 1–2, точка K′, линия связи — K″. Сверка на каждом шаге доказывает, что этот способ
   приводит именно к основанию перпендикуляра. */
const {q,V}=require('./exact.js');
const {K3,K2,PR}=require('./kernels.js');

/* условие — два независимых ввода (строки, как в тетради). В прототипе второй ввод набран отдельно мной;
   в работе его делает второй человек по скану тетради */
const entry1={A:['9.2','10.7','10.5'], a:{y:['2.7','40.1','1.934'], z:['0.3','51.4','0.909']}};
const entry2={A:['9.2','10.7','10.5'], a:{y:['2.7','40.1','1.934'], z:['0.3','51.4','0.909']}};

/* a: y = y0 + (xy − x)·ky, z = z0 + (xz − x)·kz — та же запись, что в коде сайта */
const gamma=e=>{ const [y0,xy,ky]=e.a.y.map(q), [z0,xz,kz]=e.a.z.map(q);
  const aP=x=>{ x=q(x); return [x,y0.add(xy.sub(x).mul(ky)),z0.add(xz.sub(x).mul(kz))]; };
  return {A:V.of(e.A),aP}; };

const task={
  n:47, title:'Расстояние от точки A до прямой a',
  k:'4.16',                                    /* L.S = 3,2 ед./мм × увеличение 1,3 */
  entries:[entry1,entry2], gamma,
  given3(M,G){ M.A=G.A; M.a=K3.line(G.aP(0),G.aP(1)); },
  given2(E,G,k){ E['A″']=PR[2](G.A,k); E['A′']=PR[1](G.A,k);
    E['a″']=K2.line(PR[2](G.aP(0),k),PR[2](G.aP(1),k)); E['a′']=K2.line(PR[1](G.aP(0),k),PR[1](G.aP(1),k)); },
  steps:[
    { id:'h', title:'Горизонталь h плоскости α ⟂ a',
      do3(M){ M.alpha=K3.plane(M.A,M.a.d); M.h=K3.horizontal(M.alpha,M.A); },
      do2(E){ E['h″']=K2.axisPar(E['A″']); E['h′']=K2.perp(E['a′'],E['A′']); },
      claims:[['h','line']] },
    { id:'f', title:'Фронталь f плоскости α',
      do3(M){ M.f=K3.frontal(M.alpha,M.A); },
      do2(E){ E['f′']=K2.axisPar(E['A′']); E['f″']=K2.perp(E['a″'],E['A″']); },
      claims:[['f','line']] },
    { id:'gamma', title:'Посредник γ ⊃ a: точки 1 и 2',
      do3(M){ M.gamma=K3.frontProj(M.a); M['1']=K3.meet(M.h,M.gamma); M['2']=K3.meet(M.f,M.gamma); },
      do2(E){ E['1″']=K2.meet(E['a″'],E['h″']); E['2″']=K2.meet(E['a″'],E['f″']); },
      claims:[['1','point'],['2','point']] },
    /* следы посредника: f₀γ ≡ a″; h₀γ — прямая γ ∩ π₁, на π₁ перпендикулярна оси x */
    { id:'traces', title:'Следы посредника γ',
      do3(M){ const X=K3.meet(M.a,K3.plane([q(0),q(0),q(0)],[q(0),q(0),q(1)])); M.h0g=K3.lineDir(X,V.cross(M.gamma.n,[q(0),q(0),q(1)])); },
      do2(E){ const X=K2.meet(E['a″'],K2.axisPar([q(0),q(0)])); E['h0g′']=K2.link(X); },
      claims:[] },
    { id:'K', title:'Линия γ ∩ α и точка K',
      do3(M){ M.K=K3.meet(M.a,M.alpha); },                        /* по определению, без 1 и 2 */
      do2(E){ E['1′']=K2.meet(K2.link(E['1″']),E['h′']); E['2′']=K2.meet(K2.link(E['2″']),E['f′']);
        E['K′']=K2.meet(K2.line(E['1′'],E['2′']),E['a′']); E['K″']=K2.meet(K2.link(E['K′']),E['a″']); },
      claims:[['1','point'],['2','point'],['K','point']] },
    { id:'nv', title:'Натуральная величина |AK| способом треугольника',
      do3(M){ M.AK2=K3.dist2(M.A,M.K).mul(q('4.16')).mul(q('4.16')); },
      do2(E){ const dz=E['A″'][1].sub(E['K″'][1]);                /* второй катет: Δz снят циркулем с π₂ */
        E.AK2=K2.dist2(E['A′'],E['K′']).add(dz.mul(dz)); },
      claims:[['AK2','scalar']] },
  ],
  /* условие задачи на языке геометрии — независимо от способа */
  spec:{
    holds:(M,G)=>[['K ∈ a',K3.on(M.K,M.a)],['AK ⟂ a',V.dot(V.sub(M.K,M.A),M.a.d).isZero()]],
    /* решатель: K = a(t), t* = (A − P₀)·d / d·d — проекция вектора, ни одной плоскости */
    solve:G=>{ const P0=G.aP(0), d=V.sub(G.aP(1),P0), t=V.dot(V.sub(G.A,P0),d).div(V.dot(d,d)); return {K:V.add(P0,V.mul(d,t))}; },
    unique:G=>{ const d=V.sub(G.aP(1),G.aP(0)), dd=V.dot(d,d); return {ok:dd.sign()>0,why:dd.sign()>0?'решение единственно: уравнение для t линейно, коэффициент d·d > 0':'прямая a вырождена'}; },
  },
  answer:{name:'|AK|', value:M=>K3.dist2(M.A,M.K), re:/\|AK\|\s*≈\s*(\d+)\s*мм/},
  site:{ points:{'A″':'A','A′':'A','1″':'1','2″':'2','1′':'1','2′':'2','K′':'K','K″':'K'},
    lines:{'a″':'a','a′':'a','h″':'h','h′':'h','f″':'f','f′':'f','f₀γ':['a',2],'h₀γ':['h0g',1]} },
  /* то, что не сводится к совпадению точек: треугольник натуральной величины и видимость */
  audit(M,S,k){ const out=[]; const A1=S.points['A′'], K1=S.points['K′'], A0=S.points['A₀'];
    if(!A0) out.push('на сайте нет вершины A₀');
    else { const u=[K1[0]-A1[0],K1[1]-A1[1]], w=[A0[0]-A1[0],A0[1]-A1[1]], dz=M.A[2].sub(M.K[2]).mul(k).num();
      if(Math.abs(u[0]*w[0]+u[1]*w[1])>1e-6*Math.hypot(...u)*Math.hypot(...w)) out.push('катет A′A₀ не перпендикулярен A′K′');
      if(Math.abs(Math.hypot(...w)-Math.abs(dz))>1e-6*Math.max(1,Math.abs(dz))) out.push('катет A′A₀ = '+Math.hypot(...w).toFixed(3)+', а Δz·k = '+Math.abs(dz).toFixed(3)); }
    /* в сцене одни прямые: закрыть что-либо нечем, невидимых линий быть не может */
    (S.segs||[]).filter(s=>s.k==='hid').forEach(()=>out.push('штриховая линия, хотя в задаче нет непрозрачных поверхностей'));
    return {out:[...new Set(out)],what:'катеты треугольника A′K′A₀ и видимость проверены'}; },
  /* O7: любые допустимые данные — точка и прямая общего положения */
  randomGamma(rnd){ const r=(lo,hi)=>q((Math.round((lo+(hi-lo)*rnd())*10)/10).toFixed(1));
    const A=[r(5,60),r(5,50),r(5,50)], P=[r(5,60),r(5,50),r(5,50)], d=[q(1),r(0.3,2.5),r(0.3,2.5)].map((v,i)=>i&&rnd()<.5?v.neg():v);
    return {A,aP:x=>{ x=q(x); return V.add(P,V.mul(d,x)); }}; },
  /* подсаженные ошибки — каждая типична для человека, пишущего разбор */
  faults:[
    {what:'h′ проведена ∥ a′ вместо ⟂ a′', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='h'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ E['h″']=K2.axisPar(E['A″']); E['h′']=K2.par(E['a′'],E['A′']); }}); }},
    {what:'K′ — перпендикуляр из A′ прямо на a′ (частая ошибка: прямой угол на проекции искажён)', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='K'), s=T.steps[i]; T.steps[i]=Object.assign({},s,{do2(E){ s.do2(E); E['K′']=K2.foot(E['A′'],E['a′']); E['K″']=K2.meet(K2.link(E['K′']),E['a″']); }}); }},
    {what:'в натуральной величине забыт второй катет Δz', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='nv'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ E.AK2=K2.dist2(E['A′'],E['K′']); }}); }},
    {what:'опечатка при вводе условия: z точки A = 15,0 во втором вводе', apply:T=>{ T.entries=[T.entries[0],JSON.parse(JSON.stringify(T.entries[1]))]; T.entries[1].A[2]='15.0'; }},
    {what:'на опубликованном чертеже K″ сдвинута на 3 ед. вдоль линии связи', site:S=>{ S.points['K″'][1]+=3; }},
    {what:'в тексте ответа число на 1 мм меньше доказанного', site:S=>{ S.ans=S.ans.replace(/(\|AK\|\s*≈\s*)(\d+)/,(m,a,b)=>a+(+b-1)); }},
  ],
};
module.exports=task;
