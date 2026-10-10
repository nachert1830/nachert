/* ═══════════ № 46 — линия пересечения двух треугольников и их видимость ═══════════
   Ядро 3D: 5 = DF ∩ (ABC), 6 = EF ∩ (ABC) по определению; видимость — по точной глубине.
   Эпюр: способ сайта — фронтально-проецирующие посредники γ₁ ⊃ DF и γ₂ ⊃ EF, линии связи; видимость — по
   конкурирующим точкам 3/7 (π₂) и 8/9 (π₁). Решатель условия перебирает ВСЕ шесть сторон и находит, какие из них
   протыкают другой треугольник, — так проверяется и полнота («посредник через BC не нужен»).
   Отдельно: каждый видимый/штриховой участок опубликованного чертежа сверяется с точной видимостью. */
const {q,V}=require('./exact.js');
const {K3,K2,PR}=require('./kernels.js');

const entry1={A:['60.5','46.3','25.2'],B:['37.5','5.8','54.1'],C:['7.5','27.5','7.5'],D:['12.7','34.8','35.5'],E:['25.2','52.3','58.2'],F:['55.6','11.0','10.5']};
const entry2={A:['60.5','46.3','25.2'],B:['37.5','5.8','54.1'],C:['7.5','27.5','7.5'],D:['12.7','34.8','35.5'],E:['25.2','52.3','58.2'],F:['55.6','11.0','10.5']};
const NAMES=['A','B','C','D','E','F'];
const gamma=e=>{ const G={}; NAMES.forEach(n=>G[n]=V.of(e[n])); return G; };
const L3=(M,a,b)=>K3.line(M[a],M[b]), L2=(E,a,b,mk)=>K2.line(E[a+mk],E[b+mk]);

/* внутри треугольника (на плоскости, строго) и на отрезке */
const inside2=(p,t)=>{ const s=[[0,1],[1,2],[2,0]].map(([i,j])=>V.cross2(V.sub(t[j],t[i]),V.sub(p,t[i])).sign()); return s.every(x=>x>0)||s.every(x=>x<0); };
const onSeg3=(P,A,B)=>{ const d=V.sub(B,A), t=V.dot(V.sub(P,A),d).div(V.dot(d,d)); return K3.on(P,{p:A,d})&&t.sign()>=0&&t.cmp(1)<=0; };
const inTri3=(P,A,B,C)=>{ const n=V.cross(V.sub(B,A),V.sub(C,A)); if(!V.dot(V.sub(P,A),n).isZero()) return false;
  return [[A,B],[B,C],[C,A]].every(([u,v])=>V.dot(V.cross(V.sub(v,u),V.sub(P,u)),n).sign()>=0); };

/* глубина треугольника O в точке проекции X: π₂ — координата y, π₁ — z (больше — ближе к зрителю) */
function hiddenBy(X,O,pl){ const k=q(1); const pr=p=>PR[pl](p,k); if(!inside2(pr(X),O.map(pr))) return false;
  const n=V.cross(V.sub(O[1],O[0]),V.sub(O[2],O[0])), ax=pl===2?1:2, o=[0,1,2].filter(i=>i!==ax);
  const dep=O[0][ax].sub(n[o[0]].mul(X[o[0]].sub(O[0][o[0]])).add(n[o[1]].mul(X[o[1]].sub(O[0][o[1]]))).div(n[ax]));
  return dep.cmp(X[ax])>0; }

const task={
  n:46, title:'Пересечение треугольников ABC и DEF, видимость', k:'3.52',
  entries:[entry1,entry2], gamma,
  given3(M,G){ NAMES.forEach(n=>M[n]=G[n]); M.ABC=K3.plane3(G.A,G.B,G.C); },
  given2(E,G,k){ NAMES.forEach(n=>{ E[n+'″']=PR[2](G[n],k); E[n+'′']=PR[1](G[n],k); }); },
  steps:[
    { id:'g1', title:'Посредник γ₁ ⊃ DF: точки 1 и 2',
      do3(M){ M.g1=K3.frontProj(L3(M,'D','F')); M['1']=K3.meet(L3(M,'A','C'),M.g1); M['2']=K3.meet(L3(M,'B','C'),M.g1); },
      do2(E){ E['1″']=K2.meet(L2(E,'D','F','″'),L2(E,'A','C','″')); E['2″']=K2.meet(L2(E,'D','F','″'),L2(E,'B','C','″')); },
      claims:[['1','point'],['2','point']] },
    { id:'tr1', title:'Следы посредника γ₁',
      do3(M){ const X=K3.meet(L3(M,'D','F'),K3.plane([q(0),q(0),q(0)],[q(0),q(0),q(1)])); M.f0g1=L3(M,'D','F'); M.h0g1=K3.lineDir(X,V.cross(M.g1.n,[q(0),q(0),q(1)])); },
      do2(E){ E['h0g1′']=K2.link(K2.meet(L2(E,'D','F','″'),K2.axisPar([q(0),q(0)]))); }, claims:[['h0g1','line']] },
    { id:'p5', title:'Точка 5 = DF ∩ (ABC)',
      do3(M){ M['5']=K3.meet(L3(M,'D','F'),M.ABC); },
      do2(E){ E['1′']=K2.meet(K2.link(E['1″']),L2(E,'A','C','′')); E['2′']=K2.meet(K2.link(E['2″']),L2(E,'B','C','′'));
        E['5′']=K2.meet(K2.line(E['1′'],E['2′']),L2(E,'D','F','′')); E['5″']=K2.meet(K2.link(E['5′']),L2(E,'D','F','″')); },
      claims:[['1','point'],['2','point'],['5','point']] },
    { id:'g2', title:'Посредник γ₂ ⊃ EF: точки 3 и 4',
      do3(M){ M.g2=K3.frontProj(L3(M,'E','F')); M['3']=K3.meet(L3(M,'A','C'),M.g2); M['4']=K3.meet(L3(M,'B','C'),M.g2); },
      do2(E){ E['3″']=K2.meet(L2(E,'E','F','″'),L2(E,'A','C','″')); E['4″']=K2.meet(L2(E,'E','F','″'),L2(E,'B','C','″')); },
      claims:[['3','point'],['4','point']] },
    { id:'tr2', title:'Следы посредника γ₂',
      do3(M){ const X=K3.meet(L3(M,'E','F'),K3.plane([q(0),q(0),q(0)],[q(0),q(0),q(1)])); M.f0g2=L3(M,'E','F'); M.h0g2=K3.lineDir(X,V.cross(M.g2.n,[q(0),q(0),q(1)])); },
      do2(E){ E['h0g2′']=K2.link(K2.meet(L2(E,'E','F','″'),K2.axisPar([q(0),q(0)]))); }, claims:[['h0g2','line']] },
    { id:'p6', title:'Точка 6 = EF ∩ (ABC)',
      do3(M){ M['6']=K3.meet(L3(M,'E','F'),M.ABC); },
      do2(E){ E['3′']=K2.meet(K2.link(E['3″']),L2(E,'A','C','′')); E['4′']=K2.meet(K2.link(E['4″']),L2(E,'B','C','′'));
        E['6′']=K2.meet(K2.line(E['3′'],E['4′']),L2(E,'E','F','′')); E['6″']=K2.meet(K2.link(E['6′']),L2(E,'E','F','″')); },
      claims:[['3','point'],['4','point'],['6','point']] },
    { id:'v2', title:'Видимость на π₂ по конкурирующим точкам 3 и 7',
      /* 3D: точки AC и EF на одном луче зрения, перпендикулярном π₂; ближе та, у которой больше y */
      do3(M){ const g=K3.frontProj(L3(M,'E','F')), X3=K3.meet(L3(M,'A','C'),g), X7=K3.meet(L3(M,'E','F'),K3.frontProj(L3(M,'A','C')));
        M.vis2=q(X3[1].cmp(X7[1])); },
      /* эпюр: 3″ ≡ 7″ = A″C″ ∩ E″F″; на π₁ — та, что дальше от оси x (больше y′) */
      do2(E){ const X=K2.meet(L2(E,'A','C','″'),L2(E,'E','F','″')); E['7″']=X;
        const p3=K2.meet(K2.link(X),L2(E,'A','C','′')), p7=K2.meet(K2.link(X),L2(E,'E','F','′')); E['7′']=p7; E.vis2=q(p3[1].cmp(p7[1])); },
      claims:[['vis2','scalar']] },
    { id:'v1', title:'Видимость на π₁ по конкурирующим точкам 8 и 9',
      do3(M){ const X8=K3.meet(L3(M,'C','A'),K3.horizProj(L3(M,'F','D'))), X9=K3.meet(L3(M,'F','D'),K3.horizProj(L3(M,'C','A')));
        M.vis1=q(X9[2].cmp(X8[2])); },
      /* эпюр: 8′ ≡ 9′ = C′A′ ∩ F′D′; на π₂ выше та, у которой меньше v (ось v направлена вниз) */
      do2(E){ const X=K2.meet(L2(E,'C','A','′'),L2(E,'F','D','′'));
        const p8=K2.meet(K2.link(X),L2(E,'C','A','″')), p9=K2.meet(K2.link(X),L2(E,'F','D','″')); E.vis1=q(p8[1].cmp(p9[1])); },
      claims:[['vis1','scalar']] },
  ],
  spec:{
    holds:(M)=>[['5 ∈ DF',onSeg3(M['5'],M.D,M.F)],['5 ∈ △ABC',inTri3(M['5'],M.A,M.B,M.C)],['6 ∈ EF',onSeg3(M['6'],M.E,M.F)],['6 ∈ △ABC',inTri3(M['6'],M.A,M.B,M.C)]],
    /* решатель: все шесть сторон против плоскости другого треугольника; точки внутри обоих — концы линии пересечения */
    solve:G=>{ const T1=['A','B','C'], T2=['D','E','F'], pts=[];
      [[T1,T2],[T2,T1]].forEach(([S,O])=>[[0,1],[1,2],[2,0]].forEach(([i,j])=>{ const P=G[S[i]], Qp=G[S[j]], Pl=K3.plane3(G[O[0]],G[O[1]],G[O[2]]);
        let X; try{ X=K3.meet(K3.line(P,Qp),Pl); }catch(e){ return; }
        if(onSeg3(X,P,Qp)&&inTri3(X,G[O[0]],G[O[1]],G[O[2]])) pts.push({X,edge:S[i]+S[j]}); }));
      const r={}; const f=e=>pts.find(p=>p.edge===e||p.edge===e.split('').reverse().join(''));
      if(f('DF')) r['5']=f('DF').X; if(f('EF')) r['6']=f('EF').X; task._edges=pts.map(p=>p.edge); return r; },
    unique:()=>{ const e=task._edges||[]; const ok=e.length===2&&e.every(x=>/DF|FD|EF|FE/.test(x));
      return {ok,why:ok?'полнота: из шести сторон протыкают другой треугольник ровно DF и EF — посредник через BC действительно не нужен':'стороны, протыкающие другой треугольник: '+e.join(', ')}; },
  },
  site:{ points:{'1″':'1','2″':'2','1′':'1','2′':'2','5′':'5','5″':'5','3″':'3','4″':'4','3′':'3','4′':'4','6′':'6','6″':'6','A″':'A','A′':'A','B″':'B','B′':'B','C″':'C','C′':'C','D″':'D','D′':'D','E″':'E','E′':'E','F″':'F','F′':'F'},
    lines:{'f₀γ₁':['f0g1',2],'h₀γ₁':['h0g1',1],'f₀γ₂':['f0g2',2],'h₀γ₂':['h0g2',1]} },
  /* видимость опубликованного чертежа: каждый сплошной/штриховой участок стороны — против точной глубины */
  audit(M,S,k){ const out=[]; let n=0; const T1=['A','B','C'], T2=['D','E','F'];
    const edges=[]; [[T1,T2],[T2,T1]].forEach(([Tr,O])=>[[0,1],[1,2],[2,0]].forEach(([i,j])=>edges.push({a:Tr[i],b:Tr[j],O})));
    [2,1].forEach(pl=>{ (S.segs||[]).filter(s=>s.k==='main'||s.k==='hid').forEach(s=>{
      const ed=edges.find(e=>{ const A=V.num(PR[pl](M[e.a],k)), B=V.num(PR[pl](M[e.b],k)), d=[B[0]-A[0],B[1]-A[1]], L=Math.hypot(...d);
        return [s.a,s.b].every(p=>Math.abs((p[0]-A[0])*d[1]-(p[1]-A[1])*d[0])/L<1e-6*Math.max(1,L)); });
      if(!ed) return; const A=V.num(PR[pl](M[ed.a],k)), B=V.num(PR[pl](M[ed.b],k));
      const t=(([(s.a[0]+s.b[0])/2-A[0],(s.a[1]+s.b[1])/2-A[1]])).reduce((z,v,i)=>z+v*[B[0]-A[0],B[1]-A[1]][i],0)/((B[0]-A[0])**2+(B[1]-A[1])**2);
      if(t<=0||t>=1) return; n++;
      const X=V.add(M[ed.a],V.mul(V.sub(M[ed.b],M[ed.a]),q(t.toFixed(12)))), hid=hiddenBy(X,ed.O.map(c=>M[c]),pl);
      if(hid!==(s.k==='hid')) out.push(ed.a+ed.b+' на '+(pl===2?'π₂':'π₁')+' показана '+(s.k==='hid'?'штрихом, но этот участок виден':'сплошной, но этот участок закрыт треугольником '+ed.O.join(''))); }); });
    /* участки каждой стороны покрывают её ровно (без дыр, наложений и выходов за вершины), а стыки участков —
       это точки, где видимость действительно меняется: пересечения проекций со сторонами другого треугольника и с 56 */
    let worst=0; [2,1].forEach(pl=>edges.forEach(ed=>{ const A=V.num(PR[pl](M[ed.a],k)), B=V.num(PR[pl](M[ed.b],k)), d=[B[0]-A[0],B[1]-A[1]], L2=d[0]*d[0]+d[1]*d[1], L=Math.sqrt(L2);
      const tt=p=>((p[0]-A[0])*d[0]+(p[1]-A[1])*d[1])/L2;
      const pcs=(S.segs||[]).filter(s=>(s.k==='main'||s.k==='hid')&&[s.a,s.b].every(p=>Math.abs((p[0]-A[0])*d[1]-(p[1]-A[1])*d[0])/L<1e-6*Math.max(1,L))).map(s=>[tt(s.a),tt(s.b)].sort((x,y)=>x-y));
      if(!pcs.length) return; pcs.sort((x,y)=>x[0]-y[0]);
      const tol=1e-6; let at=0; pcs.forEach(([u,v])=>{ if(Math.abs(u-at)>tol) out.push(ed.a+ed.b+' на '+(pl===2?'π₂':'π₁')+': участки не стыкуются (разрыв или наложение на '+((u-at)*L).toFixed(2)+' ед.)'); at=v; });
      if(Math.abs(at-1)>tol) out.push(ed.a+ed.b+' на '+(pl===2?'π₂':'π₁')+': участки не доходят до вершины или выходят за неё');
      /* точные точки смены видимости */
      const cuts=[]; const P2=nm=>PR[pl](M[nm],k), Ln=(a,b)=>K2.line(a,b), me=K2.line(P2(ed.a),P2(ed.b));
      [[ed.O[0],ed.O[1]],[ed.O[1],ed.O[2]],[ed.O[2],ed.O[0]],['5','6']].forEach(([x,y])=>{ try{ const X=K2.meet(me,Ln(P2(x),P2(y))); cuts.push(tt(V.num(X))); }catch(e){} });
      pcs.slice(1).forEach(([u])=>{ const dmin=Math.min(...cuts.map(c=>Math.abs(c-u)))*L; worst=Math.max(worst,dmin); if(dmin>0.5) out.push(ed.a+ed.b+' на '+(pl===2?'π₂':'π₁')+': видимость меняется там, где ничего не пересекается ('+dmin.toFixed(2)+' ед. от ближайшей точки смены)'); }); }));
    return {out,what:n+' участков сторон проверены на видимость; стыки участков отстоят от точных точек смены видимости не больше чем на '+worst.toFixed(2)+' ед. чертежа'}; },
  randomGamma(rnd){ const G={}; NAMES.forEach(nm=>G[nm]=entry1[nm].map(v=>q((Math.round((+v+(rnd()-0.5)*3)*10)/10).toFixed(1)))); return G; },
  faults:[
    {what:'5′ взята на пересечении 1′2′ с E′F′ вместо D′F′', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='p5'), s=T.steps[i]; T.steps[i]=Object.assign({},s,{do2(E){ s.do2(E); E['5′']=K2.meet(K2.line(E['1′'],E['2′']),L2(E,'E','F','′')); E['5″']=K2.meet(K2.link(E['5′']),L2(E,'D','F','″')); }}); }},
    {what:'видимость на π₂ решена по высоте z, а не по глубине y (типичная путаница)', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='v2'), s=T.steps[i]; T.steps[i]=Object.assign({},s,{do2(E){ s.do2(E); const X=E['7″'];
      const p3=K2.meet(K2.link(X),L2(E,'A','C','″')), p7=K2.meet(K2.link(X),L2(E,'E','F','″')); E.vis2=q(p7[1].cmp(p3[1])).neg(); }}); }},
    {what:'на опубликованном π₂ один штриховой участок нарисован сплошным', site:S=>{ const s=S.segs.find(x=>x.k==='hid'); if(s) s.k='main'; }},
    {what:'на опубликованном π₁ один видимый участок нарисован штрихом', site:S=>{ const s=S.segs.slice().reverse().find(x=>x.k==='main'); if(s) s.k='hid'; }},
  ],
};
module.exports=task;
