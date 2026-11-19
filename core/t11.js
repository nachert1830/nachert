/* ═══════════ № 11 — следы прямой a и точка A, делящая отрезок между следами в отношении 1 : 3 ═══════════
   Пространство: H = a ∩ π₁ (z = 0), F = a ∩ π₂ (y = 0), A = F + ¼·(H − F) — по определению.
   Эпюр: H″ = a″ ∩ x, H′ — на линии связи на a′; F′ = a′ ∩ x, F″ — на линии связи на a″;
   A″ делит F″H″ в отношении 1 : 3 (теорема Фалеса), A′ — на линии связи на a′. */
(function(){
const need=n=>(typeof module!=='undefined'&&module.exports&&typeof require==='function')?require('./'+n+'.js'):self.CERT[n];
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CERT=self.CERT||{}; self.CERT[n]=v; if(v&&v.n) (self.CERT.tasks=self.CERT.tasks||{})[v.n]=v; } };
const {q,V}=need('exact');
const {K3,K2,PR}=need('kernels');
/* условие: две точки напечатанного участка прямой (как в коде сайта: доли 0,115 и 0,92 отрезка между следами (56; 0; 30) и (10; 20; 0)) */
const entry1={P1:['50.71','2.3','26.55'], P2:['13.68','18.4','2.4']}, entry2={P1:['50.71','2.3','26.55'], P2:['13.68','18.4','2.4']};
const O2=[q(0),q(0)], Z0=K3.plane([q(0),q(0),q(0)],[q(0),q(0),q(1)]), Y0=K3.plane([q(0),q(0),q(0)],[q(0),q(1),q(0)]);
const task={
  n:11, title:'Следы прямой и деление отрезка между ними в отношении 1 : 3', k:'3.2',
  entries:[entry1,entry2], gamma:e=>({P1:V.of(e.P1),P2:V.of(e.P2)}),
  fromSite(S,k){ const Q=x=>q(x), l2=S.lines['a″'].map(p=>p.map(Q)), l1=S.lines['a′'].map(p=>p.map(Q));
    const at=(L,u)=>L[0][1].add(L[1][1].sub(L[0][1]).mul(u.sub(L[0][0]).div(L[1][0].sub(L[0][0]))));
    const P=u=>[u.neg().div(k),at(l1,u).div(k),at(l2,u).neg().div(k)]; return {P1:P(l2[0][0]),P2:P(l2[1][0])}; },
  given3(M,G){ M.a=K3.line(G.P1,G.P2); },
  given2(E,G,k){ E['a″']=K2.line(PR[2](G.P1,k),PR[2](G.P2,k)); E['a′']=K2.line(PR[1](G.P1,k),PR[1](G.P2,k)); },
  steps:[
    { id:'H', title:'Горизонтальный след H',
      do3(M){ M.H=K3.meet(M.a,Z0); },
      do2(E){ E['H″']=K2.meet(E['a″'],K2.axisPar(O2)); E['H′']=K2.meet(K2.link(E['H″']),E['a′']); },
      claims:[['H','point']] },
    { id:'F', title:'Фронтальный след F',
      do3(M){ M.F=K3.meet(M.a,Y0); },
      do2(E){ E['F′']=K2.meet(E['a′'],K2.axisPar(O2)); E['F″']=K2.meet(K2.link(E['F′']),E['a″']); },
      claims:[['F','point']] },
    { id:'A', title:'Деление F″H″ в отношении 1 : 3 и точка A′',
      do3(M){ M.A=V.add(M.F,V.mul(V.sub(M.H,M.F),q('0.25'))); },
      do2(E){ E['A″']=K2.divide(E['F″'],E['H″'],1,3); E['A′']=K2.meet(K2.link(E['A″']),E['a′']); },
      claims:[['A','point']] },
  ],
  spec:{
    holds:(M)=>[['H ∈ a и z_H = 0',K3.on(M.H,M.a)&&M.H[2].isZero()],['F ∈ a и y_F = 0',K3.on(M.F,M.a)&&M.F[1].isZero()],
      ['A ∈ a',K3.on(M.A,M.a)],['FA : AH = 1 : 3',V.eq(V.mul(V.sub(M.A,M.F),q(3)),V.sub(M.H,M.A))]],
    /* решатель: параметр прямой P1 + t·d, t из z = 0 и из y = 0 — без проекций */
    solve:G=>{ const d=V.sub(G.P2,G.P1), H=V.add(G.P1,V.mul(d,G.P1[2].neg().div(d[2]))), F=V.add(G.P1,V.mul(d,G.P1[1].neg().div(d[1])));
      return {H,F,A:V.mul(V.add(V.mul(F,q(3)),H),q('0.25'))}; },
    unique:G=>{ const d=V.sub(G.P2,G.P1), ok=!d[1].isZero()&&!d[2].isZero(); return {ok,why:ok?'прямая общего положения: оба следа существуют и единственны':'прямая параллельна π₁ или π₂ — следа нет'}; },
  },
  site:{ points:{'H″':'H','H′':'H','F′':'F','F″':'F','A″':'A','A′':'A'}, lines:{'a″':'a','a′':'a'} },
  audit(M,S){ const out=[]; if(!/1\s*:\s*3/.test(S.ans||'')) out.push('в ответе нет отношения 1 : 3');
    (S.segs||[]).filter(s=>s.k==='hid').forEach(()=>out.push('штриховая линия, хотя закрывать нечем'));
    return {out:[...new Set(out)],what:'отношение в ответе проверено'}; },
  randomGamma(rnd){ const r=(lo,hi)=>q((Math.round((lo+(hi-lo)*rnd())*10)/10).toFixed(1));
    return {P1:[r(40,70),r(1,10),r(15,40)],P2:[r(5,30),r(12,30),r(1,10)]}; },
  faults:[
    {what:'A″ делит F″H″ в отношении 1 : 4 (забыли, что частей 1 + 3)', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='A'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ E['A″']=K2.divide(E['F″'],E['H″'],1,4); E['A′']=K2.meet(K2.link(E['A″']),E['a′']); }}); }},
    {what:'H′ взята на оси x (перепутаны проекции следа)', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='H'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ E['H″']=K2.meet(E['a″'],K2.axisPar(O2)); E['H′']=E['H″']; }}); }},
    {what:'опечатка при вводе: z точки P1 = 25,65', apply:T=>{ T.entries=[T.entries[0],JSON.parse(JSON.stringify(T.entries[1]))]; T.entries[1].P1[2]='25.65'; }},
    {what:'на чертеже A′ сдвинута на 2 ед.', site:S=>{ S.points['A′'][0]+=2; }},
  ],
};
put('t11',task);
})();
