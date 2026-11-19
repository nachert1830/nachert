/* ═══════════ № 25 — следы плоскости, заданной горизонталью h и фронталью f ═══════════
   Пространство: α = (K, h, f); h₀α = α ∩ π₁, f₀α = α ∩ π₂, Xα = α ∩ x — по определению.
   Эпюр: F′ₕ = h′ ∩ x, F″ₕ на h″; H″f = f″ ∩ x, H′f на f′; f₀α ∥ f″ через F″ₕ до оси x (Xα); h₀α ∥ h′ через H′f. */
(function(){
const need=n=>(typeof module!=='undefined'&&module.exports&&typeof require==='function')?require('./'+n+'.js'):self.CERT[n];
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CERT=self.CERT||{}; self.CERT[n]=v; if(v&&v.n) (self.CERT.tasks=self.CERT.tasks||{})[v.n]=v; } };
const {q,V}=need('exact');
const {K3,K2,PR}=need('kernels');
/* условие: K = 1,3·(54; 22; 33,7); h — горизонталь (направление x : y = 1 : 1), f — фронталь (x : z = 0,95 : 1) — как в коде сайта */
const entry1={K:['70.2','28.6','43.81'], h:['1','1','0'], f:['0.95','0','1']}, entry2={K:['70.2','28.6','43.81'], h:['1','1','0'], f:['0.95','0','1']};
const O2=[q(0),q(0)], O3=[q(0),q(0),q(0)], Z0=K3.plane(O3,[q(0),q(0),q(1)]), Y0=K3.plane(O3,[q(0),q(1),q(0)]), XA=K3.lineDir(O3,[q(1),q(0),q(0)]);
const task={
  n:25, title:'Следы плоскости, заданной горизонталью и фронталью', k:'3.2',
  entries:[entry1,entry2], gamma:e=>({K:V.of(e.K),hd:V.of(e.h),fd:V.of(e.f)}),
  fromSite(S,k){ const Q=x=>q(x), K2p=S.points['K″'].map(Q), K1p=S.points['K′'].map(Q), K=[K2p[0].neg().div(k),K1p[1].div(k),K2p[1].neg().div(k)];
    const h1=S.lines['h′'].map(p=>p.map(Q)), f2=S.lines['f″'].map(p=>p.map(Q));
    const hd=[h1[1][0].sub(h1[0][0]).neg(),h1[1][1].sub(h1[0][1]),q(0)], fd=[f2[1][0].sub(f2[0][0]).neg(),q(0),f2[1][1].sub(f2[0][1]).neg()];
    return {K,hd,fd}; },
  given3(M,G){ M.K=G.K; M.h=K3.lineDir(G.K,G.hd); M.f=K3.lineDir(G.K,G.fd); M.alpha=K3.plane(G.K,V.cross(G.hd,G.fd)); },
  given2(E,G,k){ E['K″']=PR[2](G.K,k); E['K′']=PR[1](G.K,k);
    E['h″']=K2.line(E['K″'],V.add(E['K″'],PR.dir2(G.hd,k))); E['h′']=K2.line(E['K′'],V.add(E['K′'],PR.dir1(G.hd,k)));
    E['f″']=K2.line(E['K″'],V.add(E['K″'],PR.dir2(G.fd,k))); E['f′']=K2.line(E['K′'],V.add(E['K′'],PR.dir1(G.fd,k))); },
  steps:[
    { id:'Fh', title:'Фронтальный след горизонтали',
      do3(M){ M.Fh=K3.meet(M.h,Y0); },
      do2(E){ E['Fh′']=K2.meet(E['h′'],K2.axisPar(O2)); E['Fh″']=K2.meet(K2.link(E['Fh′']),E['h″']); },
      claims:[['Fh','point']] },
    { id:'Hf', title:'Горизонтальный след фронтали',
      do3(M){ M.Hf=K3.meet(M.f,Z0); },
      do2(E){ E['Hf″']=K2.meet(E['f″'],K2.axisPar(O2)); E['Hf′']=K2.meet(K2.link(E['Hf″']),E['f′']); },
      claims:[['Hf','point']] },
    { id:'f0', title:'f₀α ∥ f″ через F″ₕ и точка схода Xα',
      do3(M){ M.f0=K3.lineDir(M.Fh,M.f.d); M.X=K3.meet(XA,M.alpha); },
      do2(E){ E['f0″']=K2.par(E['f″'],E['Fh″']); E['X″']=K2.meet(E['f0″'],K2.axisPar(O2)); E['X′']=E['X″']; },
      claims:[['f0','line'],['X','point']] },
    { id:'h0', title:'h₀α ∥ h′ через H′f',
      do3(M){ M.h0=K3.lineDir(M.Hf,M.h.d); },
      do2(E){ E['h0′']=K2.par(E['h′'],E['Hf′']); if(!K2.on(E['X′'],E['h0′'])) throw new Error('h₀α не проходит через Xα'); },
      claims:[['h0','line']] },
  ],
  spec:{
    holds:(M)=>[['F_h ∈ h, y = 0',K3.on(M.Fh,M.h)&&M.Fh[1].isZero()],['H_f ∈ f, z = 0',K3.on(M.Hf,M.f)&&M.Hf[2].isZero()],
      ['Xα ∈ α и на оси x',K3.inPlane(M.X,M.alpha)&&M.X[1].isZero()&&M.X[2].isZero()],
      ['f₀α ⊂ α ∩ π₂',K3.inPlane(M.f0.p,M.alpha)&&M.f0.p[1].isZero()&&M.f0.d[1].isZero()&&V.dot(M.f0.d,M.alpha.n).isZero()],
      ['h₀α ⊂ α ∩ π₁',K3.inPlane(M.h0.p,M.alpha)&&M.h0.p[2].isZero()&&M.h0.d[2].isZero()&&V.dot(M.h0.d,M.alpha.n).isZero()]],
    /* решатель: уравнение плоскости n·(P − K) = 0 при y = z = 0 — без горизонталей и фронталей */
    solve:G=>{ const n=V.cross(G.hd,G.fd); return {X:[V.dot(n,G.K).div(n[0]),q(0),q(0)]}; },
    unique:G=>{ const n=V.cross(G.hd,G.fd), ok=!n[0].isZero()&&!n[1].isZero()&&!n[2].isZero(); return {ok,why:ok?'плоскость общего положения: оба следа существуют и сходятся в единственной точке оси x':'плоскость частного положения'}; },
  },
  site:{ points:{'K″':'K','K′':'K','F′ₕ':'Fh','F″ₕ':'Fh','H″f':'Hf','H′f':'Hf','Xα':'X'}, lines:{'h″':'h','h′':'h','f″':'f','f′':'f','f₀α':['f0',2],'h₀α':['h0',1]} },
  audit(M,S){ const out=[]; if(!/Xα/.test(S.ans||'')) out.push('в ответе нет точки схода Xα');
    (S.segs||[]).filter(s=>s.k==='hid').forEach(()=>out.push('штриховая линия, хотя закрывать нечем'));
    return {out:[...new Set(out)],what:'точка схода в ответе'}; },
  randomGamma(rnd){ const r=(lo,hi)=>q((Math.round((lo+(hi-lo)*rnd())*10)/10).toFixed(1));
    return {K:[r(30,80),r(10,40),r(15,50)],hd:[q(1),r(0.4,2.5),q(0)],fd:[r(0.3,2),q(0),q(1)]}; },
  faults:[
    {what:'f₀α проведена ∥ h″ (перепутаны горизонталь и фронталь)', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='f0'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ E['f0″']=K2.par(E['h″'],E['Fh″']); E['X″']=K2.meet(E['f0″'],K2.axisPar(O2)); E['X′']=E['X″']; }}); }},
    {what:'F″ₕ взята на оси x (след горизонтали — не та проекция)', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='Fh'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ E['Fh′']=K2.meet(E['h′'],K2.axisPar(O2)); E['Fh″']=E['Fh′']; }}); }},
    {what:'опечатка при вводе: z точки K = 34,81', apply:T=>{ T.entries=[T.entries[0],JSON.parse(JSON.stringify(T.entries[1]))]; T.entries[1].K[2]='34.81'; }},
    {what:'на чертеже Xα сдвинута на 3 ед. по оси x', site:S=>{ S.points['Xα'][0]+=3; }},
  ],
};
put('t25',task);
})();
