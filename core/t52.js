/* ═══════════ № 52 — перпендикуляр из точки A на прямую b способом замены плоскостей проекций ═══════════
   Пространство: K = b ∩ (плоскость через A ⟂ b) — по определению.
   Эпюр: ось x₁₄ ∥ b′; новые проекции C₄, D₄, A₄ — на линиях связи ⟂ x₁₄, высоты z переносятся циркулем с π₂;
   b₄ = C₄D₄ — натуральная величина, прямой угол виден: K₄ — основание перпендикуляра из A₄ на b₄;
   K′ = b′ ∩ (линия связи из K₄ ⟂ x₁₄), K″ — на b″ по вертикальной линии связи.
   Единичный вектор новой оси выводит из Q: проекции на π₄ считаются точно в поле Q(√r); K′ и K″ выходят рациональными. */
(function(){
const need=n=>(typeof module!=='undefined'&&module.exports&&typeof require==='function')?require('./'+n+'.js'):self.CERT[n];
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CERT=self.CERT||{}; self.CERT[n]=v; if(v&&v.n) (self.CERT.tasks=self.CERT.tasks||{})[v.n]=v; } };
const {q,V}=need('exact');
const {K3,K2,PR}=need('kernels');
const entry=()=>({A:['24.4','6.2','30.1'], C:['33.6','7.9','6.8'], D:['0','21.9','22.6']});
const entry1=entry(), entry2=entry();
const task={
  n:52, title:'Перпендикуляр из точки на прямую заменой плоскостей проекций', k:'4.8',   /* L.S = 3,2 × увеличение 1,5 */
  entries:[entry1,entry2], gamma:e=>({A:V.of(e.A),C:V.of(e.C),D:V.of(e.D)}),
  fromSite(S,k){ const Q=x=>q(x), P=n=>{ const a=S.points[n+'″'].map(Q), b=S.points[n+'′'].map(Q); return [a[0].neg().div(k),b[1].div(k),a[1].neg().div(k)]; }; return {A:P('A'),C:P('C'),D:P('D')}; },
  given3(M,G){ M.A=G.A; M.C=G.C; M.D=G.D; M.b=K3.line(G.C,G.D); },
  given2(E,G,k){ ['A','C','D'].forEach(n=>{ E[n+'″']=PR[2](G[n],k); E[n+'′']=PR[1](G[n],k); }); E['b″']=K2.line(E['C″'],E['D″']); E['b′']=K2.line(E['C′'],E['D′']); },
  steps:[
    { id:'x14', title:'Ось x₁₄ ∥ b′ и новые проекции C₄, D₄, A₄',
      do3(M){},
      do2(E){ E.x14=K2.par(E['b′'],E['C′']);   /* положение оси на ответ не влияет: берём её через C′ */
        ['C','D','A'].forEach(n=>{ const f=K2.foot(E[n+'′'],E.x14), l=K2.perp(E.x14,f), z=E[n+'″'][1]; E[n+'₄']=K2.along(f,l,z.mul(z),z.sign()<0?1:-1); }); },
      claims:[] },
    { id:'K4', title:'K₄ — основание перпендикуляра из A₄ на b₄',
      do3(M){ M.K=K3.meet(M.b,K3.plane(M.A,M.b.d)); M.AK=K3.line(M.A,M.K); },
      do2(E){ E['b₄']=K2.line(E['C₄'],E['D₄']); E['K₄']=K2.foot(E['A₄'],E['b₄']); },
      claims:[] },
    { id:'K', title:'K′ на b′ по линии связи из K₄, K″ на b″',
      do3(M){},
      do2(E){ E['K′']=K2.meet(K2.perp(E.x14,E['K₄']),E['b′']); E['K″']=K2.meet(K2.link(E['K′']),E['b″']);
        E['AK′']=K2.line(E['A′'],E['K′']); E['AK″']=K2.line(E['A″'],E['K″']); },
      claims:[['K','point'],['AK','line']] },
  ],
  spec:{
    holds:(M)=>[['K ∈ b',K3.on(M.K,M.b)],['AK ⟂ b',V.dot(V.sub(M.K,M.A),M.b.d).isZero()]],
    solve:G=>{ const d=V.sub(G.D,G.C), t=V.dot(V.sub(G.A,G.C),d).div(V.dot(d,d)); return {K:V.add(G.C,V.mul(d,t))}; },
    unique:G=>{ const d=V.sub(G.D,G.C), ok=!V.dot(d,d).isZero()&&!V.zero(V.cross(V.sub(G.A,G.C),d)); return {ok,why:ok?'решение единственно: уравнение для параметра K на b линейно, A ∉ b':'A ∈ b или b вырождена'}; },
  },
  site:{ points:{'A″':'A','A′':'A','C″':'C','C′':'C','D″':'D','D′':'D','K′':'K','K″':'K'}, lines:{'b″':'b','b′':'b','A′K′':'AK','A″K″':'AK'} },
  /* π₄ — не π₁/π₂: связи новой системы проверяются отношениями на опубликованном чертеже */
  audit(M,S,k){ const out=[], P=S.points, need=['C₄','D₄','A₄','K₄','C′','D′','A′','K′'];
    const miss=need.filter(n=>!P[n]); if(miss.length) return {out:['на сайте нет '+miss.join(', ')],what:''};
    const b=[P['D′'][0]-P['C′'][0],P['D′'][1]-P['C′'][1]], L=Math.hypot(...b), u=[b[0]/L,b[1]/L], s=[-u[1],u[0]], dot=(a,c)=>a[0]*c[0]+a[1]*c[1], sub=(a,c)=>[a[0]-c[0],a[1]-c[1]];
    const z={C:M.C[2].mul(k).num(),D:M.D[2].mul(k).num(),A:M.A[2].mul(k).num()}, tol=1e-6*Math.max(1,L);
    /* линии связи ⟂ x₁₄, высоты z от новой оси — одна и та же ось для всех точек */
    const off=['C','D','A'].map(n=>{ const w=sub(P[n+'₄'],P[n+'′']); if(Math.abs(dot(w,u))>tol) out.push('линия связи '+n+'′'+n+'₄ не ⟂ x₁₄'); return Math.abs(dot(P[n+'₄'],s))-z[n]; });
    const sgn=['C','D','A'].map(n=>Math.sign(dot(P[n+'₄'],s)));
    if(Math.max(...off)-Math.min(...off)>1e-5*Math.max(1,L)&&new Set(sgn).size===1) out.push('высоты на π₄ не равны z (C, D, A: расхождение '+(Math.max(...off)-Math.min(...off)).toFixed(3)+' ед.)');
    const c4=P['C₄'], d4=sub(P['D₄'],c4), w=sub(P['A₄'],P['K₄']);
    if(Math.abs(dot(w,d4))>1e-6*Math.hypot(...w)*Math.hypot(...d4)) out.push('A₄K₄ не ⟂ b₄');
    if(Math.abs(d4[0]*(P['K₄'][1]-c4[1])-d4[1]*(P['K₄'][0]-c4[0]))>1e-6*Math.hypot(...d4)*Math.max(1,L)) out.push('K₄ не на b₄');
    if(Math.abs(dot(sub(P['K₄'],P['K′']),u))>tol) out.push('линия связи K₄K′ не ⟂ x₁₄');
    (S.segs||[]).filter(g=>g.k==='hid').forEach(()=>out.push('штриховая линия, хотя закрывать нечем'));
    return {out:[...new Set(out)],what:'связи с π₄ (линии связи ⟂ x₁₄, высоты z, A₄K₄ ⟂ b₄) проверены'}; },
  randomGamma(rnd){ const r=(lo,hi)=>q((Math.round((lo+(hi-lo)*rnd())*10)/10).toFixed(1));
    return {A:[r(15,40),r(3,15),r(20,40)],C:[r(30,50),r(3,15),r(3,15)],D:[r(0,10),r(15,30),r(15,30)]}; },
  faults:[
    {what:'x₁₄ проведена ∥ b″ вместо b′', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='x14'), st=T.steps[i]; T.steps[i]=Object.assign({},st,{do2(E){ const b=E['b′']; E['b′']=E['b″']; try{ st.do2(E); } finally { E['b′']=b; } }}); }},
    {what:'K₄ — перпендикуляр из A′ на b′ (прямой угол на проекции искажён)', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='K'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ E['K′']=K2.foot(E['A′'],E['b′']); E['K″']=K2.meet(K2.link(E['K′']),E['b″']); E['AK′']=K2.line(E['A′'],E['K′']); E['AK″']=K2.line(E['A″'],E['K″']); }}); }},
    {what:'опечатка при вводе: z точки A = 31,0', apply:T=>{ T.entries=[T.entries[0],Object.assign(entry(),{A:['24.4','6.2','31.0']})]; }},
    {what:'на чертеже K″ сдвинута на 2 ед.', site:S=>{ S.points['K″'][1]+=2; }},
  ],
};
put('t52',task);
})();
