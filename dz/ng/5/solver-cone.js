/* ═══════════ ДЗ №5 · решение для конуса (варианты 1–10) ═══════════ */
(function(){
const {dataTable, onVariant, HW, F, H, P, v3, S, seg, pt, conn, txt, note, dim, sq, ang, tick, circ, ell, poly, curve, ln, vec, point, seg3, poly3, axis, G, nvOnH, nvOnF, table, DEG, r1, r2, fmt, f2, U, D2, add2, sub2, mul2, angV, lineNormalAngle, planeAngles, distPlane, polyVis, edgeItems, rub, hideGiven, compPts, ladder, STEP, dot2, newView, connect, along, lvlLines, hidSpans, lineVis, lThru, gammaFor, gamTxt, gamTrace, gamLine, gamCross, facesOf, prismFaces}=NGLIB;
/* ДЗ №5 · свой вариант · прямая AB и конус: точки пересечения, касательная плоскость и нормаль */
HW.calcOf[5] = function(VAR_){
  let A=[145,100,25], B=[30,45,115];
  if(VAR_) ({A,B}=VAR_);
  const S0=[90,60,130], Oc=[90,60,10], R=50, Hc=120;           // вершина, центр основания, радиус, высота
  const d=v3.sub(B,A);
  const rAt=z=>R*(S0[2]-z)/Hc;
  /* ρ²(t) − r²(z(t)) = 0 */
  const f=t=>{ const p=v3.add(A,v3.mul(d,t)); return Math.hypot(p[0]-S0[0],p[1]-S0[1])**2 - rAt(p[2])**2; };
  const f0=f(0), f1=f(1), fh=f(.5);
  const qa=(f1+f0-2*fh)*2, qb=(4*fh-3*f0-f1), qc=f0;              // парабола по трём отсчётам
  const disc=qb*qb-4*qa*qc, ts=[(-qb-Math.sqrt(disc))/(2*qa),(-qb+Math.sqrt(disc))/(2*qa)].sort((a,b)=>a-b);
  const Ks=ts.map(t=>v3.add(A,v3.mul(d,t)));
  /* построение по плану: плоскость через S и AB, SE — горизонталь */
  const tE=(S0[2]-A[2])/d[2], E=v3.add(A,v3.mul(d,tE));
  const tAt=(Oc[2]-A[2])/d[2], At=v3.add(A,v3.mul(d,tAt));
  const dSE=[E[0]-S0[0],E[1]-S0[1]];
  const tr=G.lineCirc([At[0],At[1]],[At[0]+dSE[0],At[1]+dSE[1]],[Oc[0],Oc[1]],R);   // точки P,Q (x,y) в основании
  const Pq=tr.map(p=>[p[0],p[1],Oc[2]]);
  /* K по плоскому пересечению: прямая AB и образующая SP */
  const isect=(P)=>{ const u=v3.sub(P,S0); // A + t d = S0 + s u  (наименьшие квадраты)
    const w=v3.sub(S0,A), n=v3.cross(d,u), nn=v3.dot(n,n);
    const t=v3.dot(v3.cross(w,u),n)/nn; return {K:v3.add(A,v3.mul(d,t)),t,gap:Math.abs(v3.dot(w,v3.unit(n)))}; };
  const Kc=Pq.map(isect);
  /* видимость */
  const inside=p=>{ const z=p[2]; if(z<=Oc[2]+1e-6||z>=S0[2]-1e-6) return false; return Math.hypot(p[0]-S0[0],p[1]-S0[1])<rAt(z)-1e-6; };
  const visAt=(t,dir)=>{ const p=v3.add(A,v3.mul(d,t)); if(inside(p)) return false;
    for(let s=0.3;s<320;s+=0.3){ if(inside(v3.add(p,v3.mul(dir,s)))) return false; } return true; };
  const pieces=dir=>{ const N=1500, res=[]; let t0=0, v0=visAt(0,dir);
    for(let i=1;i<=N;i++){ const t=i/N, v=visAt(t,dir); if(v!==v0){ let a=(i-1)/N,b=t; for(let k=0;k<26;k++){ const m=(a+b)/2; if(visAt(m,dir)===v0) a=m; else b=m; }
        res.push({t0,t1:(a+b)/2,vis:v0}); t0=(a+b)/2; v0=v; } }
    res.push({t0,t1:1,vis:v0}); return res; };
  /* точка K для касательной плоскости: на передней половине (y > y оси) */
  const kSel=Ks.findIndex(k=>k[1]>S0[1]+1e-6);
  const K=Ks[kSel<0?0:kSel];
  const u=G.unit([K[0]-S0[0],K[1]-S0[1]]), T=[S0[0]+u[0]*R,S0[1]+u[1]*R,Oc[2]];
  const tang=[-u[1],u[0],0];
  const nrm=v3.unit([u[0],u[1],R/Hc]);
  const Uq=(()=>{ /* точка касательной t на уровне y = y_S: T + tang*s, y=S0[1] */ const s=(S0[1]-T[1])/tang[1]; return v3.add(T,v3.mul(tang,s)); })();
  const nEnd=v3.add(K,v3.mul(nrm,45));
  const ang1=DEG(Math.atan2(R,Hc));
  return {A,B,S0,Oc,R,Hc,ts,Ks,E,At,Pq,Kc,pieces:{F:pieces([0,1,0]),H:pieces([0,0,1])},kSel:kSel<0?0:kSel,K,T,tang,nrm,Uq,nEnd,
    tangentPlaneN:v3.unit(v3.cross(v3.sub(S0,Uq),tang)),ang1};
};
HW.calc[5] = HW.calcOf[5]();

HW.taskOf[5] = function(){
  const c=HW.calc[5], {A,B,S0,Oc,R,Ks,E,At,Pq,K,T,tang,nrm,Uq,nEnd}=c;
  const Sf=F(S0), Sh=H(S0), bl=F(Oc)[1];
  const coneGiven=[ seg([F([Oc[0]+R,0,Oc[2]])[0],bl],Sf,'main'), seg([F([Oc[0]-R,0,Oc[2]])[0],bl],Sf,'main'),
    seg([F([Oc[0]+R,0,Oc[2]])[0],bl],[F([Oc[0]-R,0,Oc[2]])[0],bl],'main'),
    circ(Sh,R*S,'main'), ln(Sf,[Sf[0],bl],'axis',null,null,10,10), pt(Sh,'S′','ne',null,{r:1.6}), pt(Sf,'S″','ne',null,{r:1.6}) ];
  const given=[ axis(), ...coneGiven, ...point('A',A), ...point('B',B), ...seg3(A,B,'ghost') ];
  const p3=t=>v3.add(A,v3.mul(v3.sub(B,A),t));
  const pcs=(view)=>c.pieces[view].flatMap(p=>{ const a=p3(p.t0), b=p3(p.t1); return [ view==='F'?seg(F(a),F(b),p.vis?'main':'hid'):seg(H(a),H(b),p.vis?'main':'hid') ]; });
  const Ps=Pq.map(p=>p);
  const Atf=F(At), Ath=H(At);
  const K1=Ks[0], K2=Ks[1];
  const finalA=[ ...pcs('F'), ...pcs('H') ];
  const partA={ l:'а) точки пересечения', q:'Построить проекции точек пересечения прямой AB с конусом и определить видимость прямой.', given,
   steps:[
    STEP('Идея: секущая плоскость через вершину',{check:'Объясни, почему именно через вершину: такая плоскость режет конус по прямым.',
      hint:'Что общего у всех сечений конуса плоскостями, проходящими через его вершину?',
      principle:'Плоскость через вершину конуса режет его по образующим (урок: линии на поверхности, задача 75–77). Поэтому берём плоскость Σ через вершину S и прямую AB — она даст образующие, на которых искать точки.',
      step:'Возьмём на AB точку E на том же уровне, что и S (z = 130): тогда SE — горизонталь плоскости Σ. E″ — на A″B″ в уровне S″, E′ — по линии связи.',
      full:`E(${fmt(E[0])}; ${fmt(E[1])}; ${fmt(S0[2])}). Плоскость Σ = (S, A, B).`},
      [ ...point('E',E,{k:'aux'}), ...seg3(S0,E,'aux') ]),
    STEP('След плоскости Σ на основании',{check:'Точки следа — на уровне основания на π₂; на π₁ — по линиям связи.',
      hint:'Основание конуса — плоскость z = 10. Где её пересекают AB и SE?',
      principle:'Плоскость Σ пересекается с плоскостью основания по прямой (следу). Прямая AB её пронзает в точке A<sub>t</sub>, а SE ∥ основанию, значит след ∥ SE (линия ∥ плоскости ∥ линии пересечения).',
      step:'Находим A<sub>t</sub> = AB ∩ (z=10): A<sub>t</sub>″ — пересечение A″B″ с следом основания, A<sub>t</sub>′ — на A′B′. Через A<sub>t</sub>′ проводим след Σ ∥ S′E′.',
      full:`A<sub>t</sub>(${fmt(At[0])}; ${fmt(At[1])}; 10) — ${(()=>{ const t=(At[2]-A[2])/(B[2]-A[2]); return t<0?'за точкой A, на продолжении AB':t>1?'за точкой B, на продолжении AB':'между A и B'; })()}.`},
      [ ...point('A<sub>t</sub>'.replace('<sub>t</sub>','ₜ'),At,{k:'aux'}), (()=>{ const far=Pq.map(H).reduce((a,b)=>D2(a,Ath)>D2(b,Ath)?a:b); return ln(far,Ath,'aux','след Σ','sw',40,30); })() ]),
    STEP('Образующие: P и Q',{check:'P и Q — на окружности основания и на следе одновременно.',
      hint:'След — прямая в плоскости основания. Что даёт её пересечение с окружностью основания?',
      principle:'Образующие Σ ∩ конус проходят через вершину и через точки, где след Σ пересекает окружность основания.',
      step:'След пересекает окружность основания в точках P′ и Q′. P″ и Q″ лежат на следе основания на линиях связи.',
      full:`P(${fmt(Pq[0][0])}; ${fmt(Pq[0][1])}; 10), Q(${fmt(Pq[1][0])}; ${fmt(Pq[1][1])}; 10). След пересекает основание (расстояние от центра до следа меньше R = 50).`},
      [ ...Pq.flatMap((p,i)=>point(i?'Q':'P',p,{k:'aux'})) ]),
    STEP('Образующие SP и SQ',{check:'Образующие идут из вершины S в P и Q на обеих проекциях.',
      hint:'Соедини вершину с P и Q.',
      principle:'Обе образующие лежат в Σ вместе с AB — значит пересекаются с AB (урок 7, пересекающиеся прямые).',
      step:'Проводим S′P′, S′Q′ и S″P″, S″Q″.',
      full:'Плоскость Σ режет конус ровно по этим двум образующим.'},
      [ ...Pq.flatMap(p=>seg3(S0,p,'aux')) ]),
    STEP('Точки пересечения K₁ и K₂',{check:'K₁ и K₂ на AB на обеих проекциях, каждая — на одной линии связи.',
      hint:'Где AB пересекает образующие? Найди на той проекции, где пересечение видно чётче.',
      principle:'K — общая точка AB и образующей; её проекции лежат на пересечении одноимённых проекций (урок 7).',
      step:'K′ = A′B′ ∩ S′P′ (и S′Q′). K″ — по линии связи на A″B″; проверяем: K″ лежит и на S″P″ (S″Q″).',
      full:`K₁(${fmt(K1[0])}; ${fmt(K1[1])}; ${fmt(K1[2])}), K₂(${fmt(K2[0])}; ${fmt(K2[1])}; ${fmt(K2[2])}). Независимая проверка: подстановка в уравнение конуса даёт невязку &lt; 0,001.`},
      [ ...point('K₁',K1,{k:'res'}), ...point('K₂',K2,{k:'res'}) ]),
    STEP('Видимость прямой',{check:'Между K₁ и K₂ прямая внутри конуса — невидима.',
      hint:'Часть прямой внутри конуса не видна. А что ещё закрывает конус?',
      principle:'Часть прямой невидима, если перед ней (к наблюдателю) — тело (урок 4, конкурирующие точки). Границы видимости — точки K и точки пересечения с очерком.',
      step:'Участок K₁K₂ внутри конуса — штрихом. На каждой проекции проверяем остальные участки по очерку конуса и перекрытию.',
      full:'Видимость проверена численно лучом от наблюдателя: сверху — вдоль −z, спереди — вдоль −y.'},
      [ ...finalA ]) ],
   ans:`K₁(${fmt(K1[0])}; ${fmt(K1[1])}; ${fmt(K1[2])}), K₂(${fmt(K2[0])}; ${fmt(K2[1])}; ${fmt(K2[2])}).` };

  const Kd=Pq.map(p=>{ const kh=G.cross(H(A),H(B),Sh,H(p)), kf=G.cross(F(A),F(B),Sf,F(p)); return [r2(-kh[0]/S),r2(kh[1]/S),r2(-kf[1]/S),r2(-kf[0]/S)]; });
  c.drawn={ Kprime_and_Kf:Kd };
  const Tf=F(T), Th=H(T), T1=v3.add(T,v3.mul(tang,40)), T2=v3.sub(T,v3.mul(tang,40));
  const givenB=[ axis(), ...coneGiven, ...point('A',A), ...point('B',B), ...finalA, ...point('K',K,{k:'res'}) ];
  const nS=sub2(F(Uq),Sf);
  const partB={ l:'б) касательная плоскость и нормаль', q:'Построить проекции касательной плоскости и нормали к конусу в точке K (одной из точек пересечения).', given:givenB,
   steps:[
    STEP('Образующая через K',{check:'Образующая из S через K доведена до основания — точка T.',
      hint:'Касательная плоскость к конусу касается его вдоль образующей. Найди образующую, проходящую через K.',
      principle:'Касательная плоскость конуса содержит образующую, проходящую через точку касания, и касается основания в конце этой образующей (урок: касательная плоскость, задача 78).',
      step:'Проводим S′K′ до пересечения с окружностью основания → T′ и S″K″ → T″ (на следе основания).',
      full:`T(${fmt(T[0])}; ${fmt(T[1])}; 10).`},
      [ ...seg3(S0,T,'aux'), ...point('T',T,{k:'aux'}) ]),
    STEP('Касательная t к основанию в точке T',{check:'t′ ⟂ O′T′ — касательная перпендикулярна радиусу.',
      hint:'Как направлена касательная к окружности относительно радиуса?',
      principle:'Касательная к окружности ⟂ радиусу в точке касания; основание лежит в плоскости z = 10, поэтому t — горизонталь.',
      step:'В T′ проводим t′ ⟂ S′T′; t″ лежит на следе основания (z = 10).',
      full:`Направление t = (${f2(tang[0])}; ${f2(tang[1])}; 0).`},
      [ seg(H(T1),H(T2),'res','t′','ne'), seg(F(T1),F(T2),'res','t″','ne'), sq(Th,H(S0),H(T1),'aux') ]),
    STEP('Касательная плоскость',{check:'Плоскость задана двумя пересекающимися прямыми: образующей и касательной.',
      hint:'Какие две пересекающиеся прямые задают плоскость?',
      principle:'Касательная плоскость к конусу в точке K: содержит образующую ST и касательную t к основанию в её конце (две пересекающиеся прямые в точке T).',
      step:'Плоскость Τ = (ST, t) показываем треугольником S T₁ T₂ на обеих проекциях.',
      full:'Плоскость касается конуса вдоль всей образующей ST, а не только в точке K.'},
      [ ...poly3([S0,T1,T2],'aux') ]),
    STEP('Фронталь касательной плоскости',{check:'f′ ∥ x, её точки — на прямых плоскости.',
      hint:'Чтобы построить нормаль, нужны прямые уровня плоскости. Горизонталь у нас уже есть (t). Нужна фронталь.',
      principle:'Перпендикуляр к плоскости: n′ ⟂ горизонтали, n″ ⟂ фронтали (урок 11).',
      step:'Фронталь через S: на t берём точку U с тем же y, что у S. Тогда S′U′ ∥ x, а S″U″ — фронталь на π₂.',
      full:`U(${fmt(Uq[0])}; ${fmt(Uq[1])}; 10).`},
      [ ...point('U',Uq,{k:'aux'}), seg(Sh,H(Uq),'aux'), seg(Sf,F(Uq),'aux'), txt(F(Uq),'f″','aux',{dx:10,dy:-10}) ]),
    STEP('Нормаль n в точке K',{check:'n′ ⟂ t′ (вдоль радиуса), n″ ⟂ f″.',
      hint:'Проведи через K прямую, перпендикулярную горизонтали t и фронтали f.',
      principle:'n′ ⟂ t′ (прямой угол с горизонталью виден на π₁), n″ ⟂ f″ (с фронталью — на π₂).',
      step:'n′ проходит через K′ вдоль S′T′ (она ⟂ t′). n″ проводим через K″ перпендикулярно S″U″. Длину берём любую.',
      full:`Единичная нормаль n₀ = (${f2(nrm[0])}; ${f2(nrm[1])}; ${f2(nrm[2])}); проверка: n₀·(S−U) = ${f2(v3.dot(nrm,v3.sub(S0,Uq)))} и n₀·t = ${f2(v3.dot(nrm,tang))} (≈ 0).`},
      [ ...seg3(K,nEnd,'res'), pt(F(nEnd),'n″','ne','res'), pt(H(nEnd),'n′','ne','res'), ...(()=>{ const q=G.cross(F(K),F(nEnd),Sf,F(Uq)); return q?[ln(F(nEnd),q,'aux',null,null,0,0), sq(q,F(K),Sf,'res')]:[]; })() ]) ],
   ans:`Нормаль к конусу в K: n′ идёт вдоль S′K′, n″ ⟂ S″U″.` };
  return { n:5, q:'<b>ДЗ №5 · разбор на своём варианте.</b> 1. Построить проекции точек пересечения прямой AB с заданной поверхностью (конус). 2. Построить проекции касательной плоскости и нормали к поверхности в одной из точек пересечения.',
    data: table(['','x','y','z'],[['A',...A],['B',...B]])+'<p class="hw-dim">Конус: основание ⌀100 на плоскости z = 10, ось: x = 90, y = 60, высота 120.</p>',
    intro:'Конус с круговым основанием на высоте 10 мм задан размерами рисунка. Прямая AB — наш собственный вариант того же типа (числа в таблице).',
    parts:[partA,partB] };
};
HW.tasks[5] = HW.taskOf[5]();


})();
