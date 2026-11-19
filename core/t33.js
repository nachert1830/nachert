/* ═══════════ № 33 — квадрат ABCD: вершина A на прямой a, диагональ BD на фронтали b, K — точка пересечения диагоналей ═══════════
   Пространство: A = a ∩ (плоскость через K ⟂ b); C = 2K − A; B, D = K ± |AK|·b/|b| — по определению квадрата.
   Эпюр: b — фронталь, поэтому прямой угол AK ⟂ BD и длины на b видны на π₂ без искажения: A″ = a″ ∩ (⟂ b″ через K″), A′ на a′;
   C — симметрично A относительно K; |AK| — способом треугольника; B″, D″ — циркулем на b″ от K″; B′, D′ — линиями связи на b′.
   Длины выводят из рациональных чисел: B и D считаются точно в поле Q(√r) (core/exact.js, R2). */
(function(){
const need=n=>(typeof module!=='undefined'&&module.exports&&typeof require==='function')?require('./'+n+'.js'):self.CERT[n];
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CERT=self.CERT||{}; self.CERT[n]=v; if(v&&v.n) (self.CERT.tasks=self.CERT.tasks||{})[v.n]=v; } };
const {q,V,R2}=need('exact');
const {K3,K2,PR}=need('kernels');
/* условие — как в коде сайта: точки сняты с рисунка тетради в пикселях (масштаб 5 пикс/мм, начало O = (560; 632)) */
const entry=()=>({k:'5',O:['560','632'], a:[['143','348'],['325','280']], aY:['915','118','53','215'], b:{y:'808',z:['582','103','239','417'],px:['103','520']}, K:'323'});
const entry1=entry(), entry2=entry();
const task={
  n:33, title:'Квадрат с вершиной на прямой a и диагональю на фронтали b', k:'3.2',
  entries:[entry1,entry2],
  gamma:e=>{ const k=q(e.k), OX=q(e.O[0]), AY=q(e.O[1]), P3=(px,pyF,pyH)=>[OX.sub(px).div(k),pyH.sub(AY).div(k),AY.sub(pyF).div(k)];
    const aY=px=>q(e.aY[0]).add(px.sub(q(e.aY[1])).mul(q(e.aY[2])).div(q(e.aY[3]))), bZ=px=>q(e.b.z[0]).sub(px.sub(q(e.b.z[1])).mul(q(e.b.z[2])).div(q(e.b.z[3])));
    const a1=P3(q(e.a[0][0]),q(e.a[0][1]),aY(q(e.a[0][0]))), a2=P3(q(e.a[1][0]),q(e.a[1][1]),aY(q(e.a[1][0])));
    const yb=q(e.b.y), b1=P3(q(e.b.px[0]),bZ(q(e.b.px[0])),yb), b2=P3(q(e.b.px[1]),bZ(q(e.b.px[1])),yb), K=P3(q(e.K),bZ(q(e.K)),yb);
    return {a1,a2,b1,b2,K}; },
  fromSite(S,k){ const Q=x=>q(x), at=(L,u)=>L[0][1].add(L[1][1].sub(L[0][1]).mul(u.sub(L[0][0]).div(L[1][0].sub(L[0][0]))));
    const l2=S.lines['a″'].map(p=>p.map(Q)), l1=S.lines['a′'].map(p=>p.map(Q)), m2=S.lines['b″'].map(p=>p.map(Q)), m1=S.lines['b′'].map(p=>p.map(Q));
    const P=(L2,L1,u)=>[u.neg().div(k),at(L1,u).div(k),at(L2,u).neg().div(k)];
    const K2p=S.points['K″'].map(Q);
    /* K ∈ b по условию: берём её на b по абсциссе K″ (иначе погрешность записи чертежа выводит K с прямой) */
    return {a1:P(l2,l1,l2[0][0]),a2:P(l2,l1,l2[1][0]),b1:P(m2,m1,m2[0][0]),b2:P(m2,m1,m2[1][0]),K:P(m2,m1,K2p[0])}; },
  given3(M,G){ M.a=K3.line(G.a1,G.a2); M.b=K3.line(G.b1,G.b2); M.K=G.K; },
  given2(E,G,k){ ['a','b'].forEach(n=>{ E[n+'″']=K2.line(PR[2](G[n+'1'],k),PR[2](G[n+'2'],k)); E[n+'′']=K2.line(PR[1](G[n+'1'],k),PR[1](G[n+'2'],k)); });
    E['K″']=PR[2](G.K,k); E['K′']=PR[1](G.K,k); },
  steps:[
    { id:'A', title:'A″K″ ⟂ b″, A′ на a′',
      do3(M){ M.A=K3.meet(M.a,K3.plane(M.K,M.b.d)); },
      do2(E){ E['A″']=K2.meet(E['a″'],K2.perp(E['b″'],E['K″'])); E['A′']=K2.meet(K2.link(E['A″']),E['a′']); },
      claims:[['A','point']] },
    { id:'C', title:'C симметрична A относительно K',
      do3(M){ M.C=V.sub(V.mul(M.K,q(2)),M.A); },
      do2(E){ E['C″']=K2.reflect(E['A″'],E['K″']); E['C′']=K2.reflect(E['A′'],E['K′']); },
      claims:[['C','point']] },
    { id:'nv', title:'Натуральная величина |AK| способом треугольника',
      do3(M){ M.AK2=K3.dist2(M.A,M.K).mul(q('3.2')).mul(q('3.2')); },
      do2(E){ const dz=E['A″'][1].sub(E['K″'][1]); E.AK2=K2.dist2(E['A′'],E['K′']).add(dz.mul(dz)); },
      claims:[['AK2','scalar']] },
    { id:'BD', title:'B″, D″ циркулем на b″ (натуральная величина), B′, D′ на b′',
      do3(M){ const r=K3.dist2(M.A,M.K).div(V.dot(M.b.d,M.b.d)), t=R2.sqrt(r); M.B=V.add(M.K,V.mul(M.b.d,t)); M.D=V.add(M.K,V.mul(M.b.d,t.neg())); },
      do2(E){ E['B″']=K2.along(E['K″'],E['b″'],E.AK2,1); E['D″']=K2.along(E['K″'],E['b″'],E.AK2,-1);
        E['B′']=K2.meet(K2.link(E['B″']),E['b′']); E['D′']=K2.meet(K2.link(E['D″']),E['b′']); },
      claims:[['B','point'],['D','point']] },
  ],
  spec:{
    holds:(M)=>{ const d=(P,Q)=>K3.dist2(P,Q), s=d(M.A,M.B);
      return [['A ∈ a',K3.on(M.A,M.a)],['B, D ∈ b',K3.on(M.B,M.b)&&K3.on(M.D,M.b)],['K — середина AC и BD',V.eq(V.add(M.A,M.C),V.mul(M.K,q(2)))&&V.eq(V.add(M.B,M.D),V.mul(M.K,q(2)))],
        ['стороны равны',d(M.B,M.C).eq(s)&&d(M.C,M.D).eq(s)&&d(M.D,M.A).eq(s)],['AC ⟂ BD',V.dot(V.sub(M.C,M.A),V.sub(M.D,M.B)).isZero()],['|AC| = |BD|',d(M.A,M.C).eq(d(M.B,M.D))]]; },
    /* решатель: A = a(t), (A − K)·b = 0 — линейное уравнение; B, D = K ± s·b, s² = |AK|²/|b|² — без проекций */
    solve:G=>{ const ad=V.sub(G.a2,G.a1), bd=V.sub(G.b2,G.b1), t=V.dot(V.sub(G.K,G.a1),bd).div(V.dot(ad,bd)), A=V.add(G.a1,V.mul(ad,t));
      const sq=R2.sqrt(K3.dist2(A,G.K).div(V.dot(bd,bd))); return {A,C:V.sub(V.mul(G.K,q(2)),A),B:V.add(G.K,V.mul(bd,sq)),D:V.add(G.K,V.mul(bd,sq.neg()))}; },
    unique:G=>{ const ad=V.sub(G.a2,G.a1), bd=V.sub(G.b2,G.b1), ok=!V.dot(ad,bd).isZero(); return {ok,why:ok?'A единственна (a не ⟂ b); B и D — две точки b на расстоянии |AK| от K, имена — по направлению b':'a ⟂ b: A не определена'}; },
  },
  site:{ points:{'A″':'A','A′':'A','K″':'K','K′':'K','C″':'C','C′':'C','B″':'B','B′':'B','D″':'D','D′':'D'}, lines:{'a″':'a','a′':'a','b″':'b','b′':'b'} },
  audit(M,S,k){ const out=[]; const A1=S.points['A′'], K1=S.points['K′'], A0=S.points['A₀'];
    if(!A0) out.push('на сайте нет вершины A₀');
    else { const u=[K1[0]-A1[0],K1[1]-A1[1]], w=[A0[0]-A1[0],A0[1]-A1[1]], dz=M.A[2].sub(M.K[2]).mul(k).num();
      if(Math.abs(u[0]*w[0]+u[1]*w[1])>1e-6*Math.hypot(...u)*Math.hypot(...w)) out.push('катет A′A₀ не перпендикулярен A′K′');
      if(Math.abs(Math.hypot(...w)-Math.abs(dz))>1e-6*Math.max(1,Math.abs(dz))) out.push('катет A′A₀ = '+Math.hypot(...w).toFixed(3)+', а Δz·k = '+Math.abs(dz).toFixed(3)); }
    (S.segs||[]).filter(s=>s.k==='hid').forEach(()=>out.push('штриховая линия, хотя закрывать нечем'));
    return {out:[...new Set(out)],what:'катеты треугольника A′K′A₀ проверены'}; },
  randomGamma(rnd){ const r=(lo,hi)=>q((Math.round((lo+(hi-lo)*rnd())*10)/10).toFixed(1));
    const K=[r(30,60),r(20,40),r(20,40)], bd=[q(-1),q(0),r(0.2,1.5)], b1=V.sub(K,V.mul(bd,q(20))), b2=V.add(K,V.mul(bd,q(30)));
    const a1=[r(60,80),r(30,50),r(40,60)], a2=[r(5,25),r(30,50),r(40,70)];
    return {a1,a2,b1,b2,K}; },
  faults:[
    {what:'A″K″ проведена ⟂ a″, а не ⟂ b″', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='A'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ E['A″']=K2.foot(E['K″'],E['a″']); E['A′']=K2.meet(K2.link(E['A″']),E['a′']); }}); }},
    {what:'на b″ отложена проекция |A′K′| вместо натуральной величины', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='BD'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ const L=K2.dist2(E['A′'],E['K′']); E['B″']=K2.along(E['K″'],E['b″'],L,1); E['D″']=K2.along(E['K″'],E['b″'],L,-1); E['B′']=K2.meet(K2.link(E['B″']),E['b′']); E['D′']=K2.meet(K2.link(E['D″']),E['b′']); }}); }},
    {what:'опечатка при вводе: точка K на 330 пикс.', apply:T=>{ T.entries=[T.entries[0],Object.assign(entry(),{K:'330'})]; }},
    {what:'на чертеже D″ сдвинута на 2 ед.', site:S=>{ S.points['D″'][0]+=2; }},
  ],
};
put('t33',task);
})();
