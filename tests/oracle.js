/* ═══════════ Оракул: независимая проверка ответа ═══════════
   Для каждой задачи записано коротко, ЧТО должно выполняться для ответа (условие задачи на языке
   геометрии), — не КАК его строить. Например, № 47: «K ∈ a и AK ⊥ a».
   Точки восстанавливаются в пространстве по проекциям на итоговом чертеже, условие проверяется
   линейной алгеброй. Если построение на чертеже неверно — условие не выполнится.
   Проверяется всё, что не зависит от масштаба (принадлежность, ∥, ⊥, равенство длин, отношения, углы),
   а также числа в ответе (углы) против вычисленных по 3D.
   ORACLE_CHECK({tasks}) → [{name, rule:'оракул', msg}], ORACLE_SPECS — список покрытых задач. */
(function(){
const sub=(a,b)=>a.map((v,i)=>v-b[i]), add=(a,b)=>a.map((v,i)=>v+b[i]), mul=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), nrm=a=>Math.hypot(...a), unit=a=>mul(a,1/nrm(a));
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const deg=r=>r*180/Math.PI, mid=(a,b)=>mul(add(a,b),.5);
const strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,'');

/* помощник для одной сцены (итоговый чертёж части задачи) */
function helper(items,fail){
  const M=GEOM_CHECK({modelOf:items});
  /* масштаб сцены для допусков: px на «единицу»; допуск ~0,4 мм в масштабе 3,2 px/мм */
  const E=1.6;
  const H={M,E,
    P(n){ const p=M.P3[n]; if(!p) throw new Error('нет точки '+n); return p; },
    has(n){ return !!M.P3[n]; },
    /* прямая: «AB» по точкам или «a» по проекциям a′, a″ */
    L(t){ if(M.L3[t]) return {p:M.L3[t].p,d:unit(sub(M.L3[t].q,M.L3[t].p))};
      const m=/^([A-ZА-Я0-9][₀-₉0-9]*)([A-ZА-Я0-9][₀-₉0-9]*)$/.exec(t); if(m&&M.P3[m[1]]&&M.P3[m[2]]) return {p:M.P3[m[1]],d:unit(sub(M.P3[m[2]],M.P3[m[1]]))};
      /* подпись вида «a″≡f″»: ищем проекции среди составных подписей */
      const seg2=k=>{ const o=(M.segs.all||[]).find(o=>o.l&&o.l.split(/\s*≡\s*/).includes(t+k)); return o&&[o.a,o.b]; };
      const s2=seg2('″'), s1=seg2('′'); if(s2&&s1&&Math.abs(s2[1][0]-s2[0][0])>1e-6&&Math.abs(s1[1][0]-s1[0][0])>1e-6){
        const at=x=>{ const t2=(x-s2[0][0])/(s2[1][0]-s2[0][0]), t1=(x-s1[0][0])/(s1[1][0]-s1[0][0]); return [x,s1[0][1]+t1*(s1[1][1]-s1[0][1]),-(s2[0][1]+t2*(s2[1][1]-s2[0][1]))]; };
        const x0=Math.max(Math.min(s2[0][0],s2[1][0]),Math.min(s1[0][0],s1[1][0])); const p=at(x0), q=at(x0+20); return {p,d:unit(sub(q,p))}; }
      throw new Error('нет прямой '+t); },
    /* 2D-проекция по подписи (для точек-проекций проецирующих прямых: c″) */
    pt2(n){ const a=M.pts[n]; if(!a) throw new Error('нет проекции '+n); return a[0]; },
    plane(A,B,C){ const n=unit(crs(sub(B,A),sub(C,A))); return {p:A,n}; },
    /* плоскость по двум прямым: пересекающимся — по направлениям, параллельным — по направлению и точке второй прямой */
    planeLL(L1,L2){ const c=crs(L1.d,L2.d); if(nrm(c)>0.05) return {p:L1.p,n:unit(c)}; return {p:L1.p,n:unit(crs(L1.d,sub(L2.p,L1.p)))}; },
    /* плоскость по следам h₀α (на π₁) и f₀α (на π₂) */
    planeT(g){ const h=M.lines['h₀'+g]||M.lines['h0'+g], f=M.lines['f₀'+g]||M.lines['f0'+g]; if(!h||!f) throw new Error('нет следов '+g);
      const [a,b]=h[0], [c,d]=f[0]; const A=[a[0],a[1],0], B=[b[0],b[1],0], C=[c[0],0,-c[1]], D=[d[0],0,-d[1]];
      const n=unit(crs(sub(B,A),sub(D,C))); return {p:A,n}; },
    dPL(P,L){ return nrm(crs(sub(P,L.p),L.d)); },
    dPP(P,Pl){ return Math.abs(dot(sub(P,Pl.p),Pl.n)); },
    ang(u,v){ const c=Math.abs(dot(unit(u),unit(v))); return deg(Math.acos(Math.min(1,c))); },
    angLP(L,Pl){ return 90-H.ang(L.d,Pl.n); },
    angPP(a,b){ return H.ang(a.n,b.n); },
    /* утверждения */
    on(P,L,what){ const d=H.dPL(P,L); if(d>2*E) fail(what+': точка не на прямой ('+d.toFixed(1)+' px)'); },
    inPl(P,Pl,what){ const d=H.dPP(P,Pl); if(d>2*E) fail(what+': точка не в плоскости ('+d.toFixed(1)+' px)'); },
    perp(u,v,what){ const a=H.ang(u,v); if(Math.abs(a-90)>0.6) fail(what+': угол '+a.toFixed(2)+'° вместо 90°'); },
    par(u,v,what){ const a=H.ang(u,v); if(a>0.6) fail(what+': угол '+a.toFixed(2)+'° вместо 0°'); },
    eqLen(a,b,what){ if(Math.abs(a-b)>Math.max(2*E,0.012*Math.max(a,b))) fail(what+': '+a.toFixed(1)+' ≠ '+b.toFixed(1)+' px'); },
    near(P,Q,what){ const d=nrm(sub(P,Q)); if(d>2*E) fail(what+': расхождение '+d.toFixed(1)+' px'); },
    eqA(a,b,what,tol){ if(Math.abs(a-b)>(tol||0.6)) fail(what+': '+a.toFixed(2)+'° ≠ '+b.toFixed(2)+'°'); },
    /* угол из текста ответа: «α ≈ 58°» → сравнить с вычисленным (допуск по числу знаков) */
    /* длина из текста ответа: «|AB| ≈ 57 мм» → сравнить с вычисленной (в мм; на чертеже 3,2 px = 1 мм) */
    ansLen(text,re,valPx,what){ const m=new RegExp(re+'\\s*(?:=|≈)\\s*(\\d+(?:[.,]\\d+)?)\\s*мм').exec(strip(text)); if(!m){ fail(what+': в ответе нет длины'); return; }
      const v=parseFloat(m[1].replace(',','.')), mm=valPx/3.2, tol=/[.,]/.test(m[1])?0.15:0.6; if(Math.abs(v-mm)>tol) fail(what+': в ответе '+m[1]+' мм, вычислено '+mm.toFixed(2)+' мм'); },
    zero(v,what){ if(Math.abs(v)>2*E) fail(what+' ('+v.toFixed(1)+' px)'); },
    ansAng(text,sym,val,what){ const re=new RegExp(sym+'\\s*(?:=|≈)\\s*(\\d+(?:[.,]\\d+)?)\\s*°'); const m=re.exec(strip(text)); if(!m){ fail(what+': в ответе нет '+sym); return; }
      const v=parseFloat(m[1].replace(',','.')), tol=/[.,]/.test(m[1])?0.06:0.51; if(Math.abs(v-val)>tol) fail(what+': в ответе '+sym+' = '+m[1]+'°, вычислено '+val.toFixed(2)+'°'); },
  };
  return H;
}
const yN=[0,1,0], zN=[0,0,1];
const S={
  11:(h)=>{ const F=h.P('F'), H_=h.P('H'), A=h.P('A'), a=h.L('a'); h.on(F,a,'F ∈ a'); h.on(H_,a,'H ∈ a');
    if(Math.abs(F[1])>2*h.E) h.fail('F в π₂: y_F ≠ 0'); if(Math.abs(H_[2])>2*h.E) h.fail('H в π₁: z_H ≠ 0');
    const t=dot(sub(A,F),sub(H_,F))/dot(sub(H_,F),sub(H_,F)); if(Math.abs(t-0.25)>0.01) h.fail('FA : AH = 1 : 3 — получилось t = '+t.toFixed(3)); },
  15:(h,t)=>{ const A=h.P('A'), B=h.P('B'); const be=h.ang(sub(B,A),yN); h.eqA(90-be,30,'угол AB с π₂ = 30°'); },
  16:(h)=>{ h.on(h.P('C'),h.L('AB'),'C ∈ AB'); },
  18:(h)=>{ const A=h.P('A'), K=h.P('K'); h.on(K,h.L('b'),'K ∈ b'); if(Math.abs(A[2]-K[2])>2*h.E) h.fail('AK — горизонталь: z_A ≠ z_K'); },
  19:(h)=>{ const K=h.P('K'), Mp=h.P('M'); h.on(K,h.L('b'),'K ∈ b'); h.par(sub(Mp,K),h.L('a').d,'KM ∥ a');
    const c2=h.pt2('c″'), m2=h.pt2('M″'); if(Math.hypot(c2[0]-m2[0],c2[1]-m2[1])>2*h.E) h.fail('M ∈ c: M″ не совпадает с c″'); },
  20:(h)=>{ const A=h.P('A'), K=h.P('K'), b=h.L('b'); h.on(K,b,'K ∈ b'); h.perp(sub(K,A),b.d,'AK ⊥ b'); },
  /* a ⟂ π₁ (a′ — точка): M = (a′; z из M″) */
  21:(h)=>{ const K=h.P('K'), b=h.L('b'), a1=h.pt2('a′'), m2=h.pt2('M″'); const Mp=[a1[0],a1[1],-m2[1]];
    if(Math.abs(m2[0]-a1[0])>2*h.E) h.fail('M ∈ a: M″ не на линии связи с a′'); h.on(K,b,'K ∈ b'); h.perp(sub(K,Mp),[0,0,1],'MK ⊥ a'); h.perp(sub(K,Mp),b.d,'MK ⊥ b'); },
  22:(h)=>{ const A=h.P('A'), C=h.P('C'), B=h.P('B'), D=h.P('D'); h.near(mid(A,C),mid(B,D),'середины AC и BD совпадают'); h.perp(sub(D,B),sub(C,A),'BD ⊥ AC');
    if(Math.abs(B[1])>2*h.E) h.fail('B ∈ π₂: y_B ≠ 0'); if(Math.abs(Math.abs(D[1])-Math.abs(D[2]))>2*h.E) h.fail('D равноудалена от π₁ и π₂: |y| ≠ |z|'); },
  27:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'); if(Math.abs(A[2]-B[2])>2*h.E) h.fail('AB ∥ π₁'); if(Math.abs(B[1]-C[1])>2*h.E) h.fail('BC ∥ π₂');
    h.eqLen(nrm(sub(B,A)),nrm(sub(C,B)),'|AB| = |BC|'); const al=h.planeT('α'); ['A','B','C'].forEach(n=>h.inPl(h.P(n),al,n+' ∈ α')); },
  30:(h,t,pi)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'); const pl=h.plane(A,B,C);
    if(pi===0) h.ansAng(t.ans,'α',h.ang(pl.n,zN),'угол плоскости с π₁'); else h.ansAng(t.ans,'β',h.ang(pl.n,yN),'угол плоскости с π₂'); },
  31:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), b=h.L('b'); h.on(B,b,'B ∈ b'); h.on(C,b,'C ∈ b'); h.perp(sub(A,B),sub(C,B),'∠B = 90°'); },
  32:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'); const ab=nrm(sub(B,A)), bc=nrm(sub(C,B)), ca=nrm(sub(A,C));
    h.eqLen(ab,bc,'|AB| = |BC|'); h.eqLen(bc,ca,'|BC| = |CA|'); h.eqA(h.ang(h.plane(A,B,C).n,yN),45,'угол плоскости с π₂ = 45°'); },
  33:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), D=h.P('D'), K=h.P('K'), a=h.L('a'), b=h.L('b');
    h.on(A,a,'A ∈ a'); h.on(B,b,'B ∈ b'); h.on(D,b,'D ∈ b'); h.near(mid(A,C),K,'K — середина AC'); h.near(mid(B,D),K,'K — середина BD');
    h.perp(sub(C,A),sub(D,B),'AC ⊥ BD'); h.eqLen(nrm(sub(C,A)),nrm(sub(D,B)),'|AC| = |BD|'); },
  34:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), D=h.P('D'), a=h.L('a');
    h.on(A,a,'A ∈ a'); h.on(D,a,'D ∈ a'); if(Math.abs(B[1])>2*h.E) h.fail('B ∈ π₂: y_B ≠ 0');
    h.perp(sub(B,A),sub(D,A),'∠A = 90°'); h.eqLen(nrm(sub(B,A)),nrm(sub(D,A)),'|AB| = |AD|'); h.near(add(B,sub(D,A)),C,'C = B + (D − A)');
    h.eqA(h.ang(h.plane(A,B,D).n,zN),45,'угол плоскости с π₁ = 45°'); },
  36:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'); h.perp(h.plane(A,B,C).n,h.L('a').d,'(ABC) ∥ a'); },
  40:(h)=>{ const A=h.P('A'), B=h.P('B'); h.perp(sub(B,A),h.L('a').d,'AB ⊥ a'); },
  41:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'); h.perp(h.plane(A,B,C).n,h.planeT('α').n,'(ABC) ⊥ α'); },
  42:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), b=h.L('b'); h.on(B,b,'B ∈ b'); h.on(C,b,'C ∈ b'); h.perp(sub(A,B),sub(C,B),'∠B = 90°'); h.eqLen(nrm(sub(A,B)),nrm(sub(C,B)),'|AB| = |BC|'); },
  43:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), K=h.P('K'), Sx=h.P('S'); const pl=h.plane(A,B,C); h.inPl(K,pl,'K ∈ (ABC)'); h.par(sub(Sx,K),pl.n,'SK ⊥ (ABC)'); },
  '45.3':(h)=>{ const K=h.P('K'), pl=h.plane(h.P('A'),h.P('B'),h.P('C')); h.on(K,h.L('a'),'K ∈ a'); h.inPl(K,pl,'K ∈ (ABC)'); },
  '45.2':(h)=>{ const K=h.P('K'); h.on(K,h.L('a'),'K ∈ a'); h.inPl(K,h.planeT('α'),'K ∈ α'); },
  46:(h)=>{ const pl=h.plane(h.P('A'),h.P('B'),h.P('C')), P5=h.P('5'), P6=h.P('6'); h.inPl(P5,pl,'5 ∈ (ABC)'); h.inPl(P6,pl,'6 ∈ (ABC)'); h.on(P5,h.L('DF'),'5 ∈ DF'); h.on(P6,h.L('EF'),'6 ∈ EF'); },
  47:(h)=>{ const A=h.P('A'), K=h.P('K'), a=h.L('a'); h.on(K,a,'K ∈ a'); h.perp(sub(K,A),a.d,'AK ⊥ a'); },
  48:(h)=>{ const A=h.P('A'), K=h.P('K'), a=h.L('a'), b=h.L('b'); h.on(A,a,'A ∈ a'); h.perp(sub(K,A),a.d,'AK ⊥ a'); h.perp(sub(K,A),b.d,'AK ⊥ b'); h.inPl(K,h.planeLL(b,a),'K в плоскости α ⊃ b, α ∥ a'); },
  49:(h)=>{ const A=h.P('A'), K=h.P('K'); h.on(K,h.L('c'),'K ∈ c'); h.perp(sub(K,A),h.planeLL(h.L('a'),h.L('b')).n,'AK ∥ (a, b)'); },
  50:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'); h.on(C,h.L('a'),'C ∈ a'); h.eqLen(nrm(sub(C,A)),nrm(sub(C,B)),'|CA| = |CB|'); },
  52:(h)=>{ const A=h.P('A'), K=h.P('K'), b=h.L('b'); h.on(K,b,'K ∈ b'); h.perp(sub(K,A),b.d,'AK ⊥ b'); },
  53:(h)=>{ const K=h.P('K'), E_=h.P('E'), AB=h.L('AB'), CD=h.L('CD'); h.on(K,AB,'K ∈ AB'); h.on(E_,CD,'E ∈ CD'); h.perp(sub(E_,K),AB.d,'KE ⊥ AB'); h.perp(sub(E_,K),CD.d,'KE ⊥ CD'); },
  55:(h)=>{ const A=h.P('A'), K=h.P('K'), pl=h.plane(h.P('B'),h.P('C'),h.P('D')); h.inPl(K,pl,'K ∈ (BCD)'); h.par(sub(K,A),pl.n,'AK ⊥ (BCD)'); },
  56:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), O=h.P('O'); h.inPl(O,h.plane(A,B,C),'O ∈ (ABC)');
    const dA=h.dPL(O,h.L('BC')), dB=h.dPL(O,h.L('CA')), dC=h.dPL(O,h.L('AB')); h.eqLen(dA,dB,'O равноудалена от BC и CA'); h.eqLen(dB,dC,'O равноудалена от CA и AB'); },
  57:(h,t)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), D=h.P('D'); const u=h.plane(A,B,C).n, v=h.plane(A,B,D).n;
    const e=unit(sub(B,A)), pc=sub(sub(C,A),mul(e,dot(sub(C,A),e))), pd=sub(sub(D,A),mul(e,dot(sub(D,A),e)));
    const phi=deg(Math.acos(dot(unit(pc),unit(pd)))); h.ansAng(t.ans,'α',phi,'двугранный угол'); },
  58:(h,t)=>{ const A=h.P('A'), B=h.P('B'); h.ansAng(t.ans,'α',90-h.ang(sub(B,A),zN),'угол AB с π₁'); },
  61:(h,t)=>{ h.ansAng(t.ans,'φ',h.ang(h.planeT('α').n,zN),'угол α с π₁'); },
  62:(h)=>{ const A=h.P('A'), B=h.P('B'); const a=h.L('a'), b=h.L('b'); h.eqA(h.ang(sub(B,A),a.d),h.ang(sub(B,A),b.d),'AB — биссектриса: углы с a и b'); },
  63:(h,t)=>{ const g=h.ang(h.L('a').d,h.L('b').d); h.ansAng(t.ans,'φ',g,'угол между a и b'); },
  65:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), O=h.P('O'); h.inPl(O,h.plane(A,B,C),'O ∈ (ABC)'); h.eqLen(nrm(sub(O,A)),nrm(sub(O,B)),'|OA| = |OB|'); h.eqLen(nrm(sub(O,B)),nrm(sub(O,C)),'|OB| = |OC|'); },
  79:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), D=h.P('D'); if(Math.abs(D[1])>2*h.E||Math.abs(D[2])>2*h.E) h.fail('D на оси x');
    h.perp(sub(B,A),sub(D,A),'∠A = 90°'); h.eqLen(nrm(sub(B,A)),nrm(sub(D,A)),'|AB| = |AD|'); h.near(add(B,sub(D,A)),C,'C = B + (D − A)'); },
  80:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), D=h.P('D'), O=h.P('O'); h.on(A,h.L('a'),'A ∈ a'); h.on(B,h.L('b'),'B ∈ b'); h.on(D,h.L('d'),'D ∈ d');
    h.par(sub(D,B),h.L('a').d,'BD ∥ a'); h.near(mid(B,D),O,'O — середина BD'); h.near(mid(A,C),O,'O — середина AC'); h.eqLen(nrm(sub(B,A)),nrm(sub(D,A)),'|AB| = |AD|'); },
  82:(h)=>{ const D=h.P('D'), K=h.P('K'), a=h.L('a'), b=h.L('AB'); h.on(D,a,'D ∈ a'); h.on(K,a,'K ∈ a'); h.eqLen(h.dPL(D,b),h.dPL(K,b),'D и K равноудалены от b'); },
  /* ── задачи 1–50, проверенные дополнительно ── */
  5:(h)=>{ const A=h.P('A'), B=h.P('B'); h.zero(B[2]-A[2]-48,'B выше A на 15 мм'); h.zero(A[1]-B[1]-32,'B ближе к π₂ на 10 мм'); },
  6:(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'); h.near(B,[A[0],A[1],-A[2]],'B симметрична A относительно π₁'); h.near(C,[-A[0],-A[1],-A[2]],'C симметрична A относительно O'); },
  8:(h)=>{ const A=h.P('A'); if(!(A[1]<0&&A[2]<0&&A[0]<0)) h.fail('A не в III октанте'); h.eqLen(Math.abs(A[0]),2*Math.abs(A[2]),'|x| : |z| = 2'); },
  9:(h,t)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'); h.zero(A[2]-B[2],'AB — горизонталь'); h.zero(B[1]-C[1],'BC — фронталь'); h.zero(A[0]-C[0],'AC — профильная');
    h.ansLen(t.ans,'\\|AB\\|',nrm(sub(B,A)),'|AB|'); h.ansLen(t.ans,'\\|BC\\|',nrm(sub(C,B)),'|BC|'); h.ansLen(t.ans,'\\|AC\\|',nrm(sub(C,A)),'|AC|');
    h.eqA(90-h.ang(sub(C,B),zN),50,'α для BC',0.6); h.eqA(90-h.ang(sub(C,A),yN),40,'β для AC',0.6); h.eqA(90-h.ang(sub(B,A),yN),45,'β для AB'); },
  '10.1':(h)=>{ h.zero(h.P('A')[2],'H ≡ A: z_A = 0'); h.zero(h.P('B')[1],'F ≡ B: y_B = 0'); },
  '10.2':(h)=>{ const C=h.P('C'); h.zero(C[1],'C на оси x (y)'); h.zero(C[2],'C на оси x (z)'); },
  '10.3':(h,t,pi,p)=>{ const E_=h.P('E'), F=h.P('F'), H_=h.P('H'); h.zero(E_[1]-F[1],'EF — фронталь'); h.zero(H_[2],'след H: z = 0'); h.on(H_,{p:E_,d:unit(sub(F,E_))},'H на прямой EF');
    h.ansLen(p.ans,'\\|EF\\|',nrm(sub(F,E_)),'|EF|'); h.ansAng(p.ans,'α',90-h.ang(sub(F,E_),zN),'α для EF'); },
  '10.4':(h,t,pi,p)=>{ const K=h.P('K'), L=h.P('L'), H_=h.P('H'); h.zero(K[0]-L[0],'KL ⟂ π₁ (x)'); h.zero(K[1]-L[1],'KL ⟂ π₁ (y)'); h.zero(H_[2],'след H: z = 0'); h.ansLen(p.ans,'\\|KL\\|',nrm(sub(K,L)),'|KL|'); },
  '10.5':(h,t,pi,p)=>{ const M_=h.P('M'), N=h.P('N'), F=h.P('F'); h.zero(M_[2]-N[2],'MN — горизонталь'); h.zero(F[1],'след F: y = 0'); h.on(F,{p:M_,d:unit(sub(N,M_))},'F на прямой MN');
    h.ansLen(p.ans,'\\|MN\\|',nrm(sub(N,M_)),'|MN|'); h.ansAng(p.ans,'β',90-h.ang(sub(N,M_),yN),'β для MN'); },
  12:(h,t)=>{ const F=h.P('F'), H_=h.P('H'); h.zero(F[1],'F ∈ π₂'); h.zero(H_[2],'H ∈ π₁'); h.ansLen(t.ans,'\\|FH\\|',nrm(sub(F,H_)),'|FH|'); },
  13:(h,t)=>{ const A=h.P('A'), B=h.P('B'), d=sub(B,A); h.ansLen(t.ans,'\\|AB\\|',nrm(d),'|AB|'); h.ansAng(t.ans,'π₁\\)',90-h.ang(d,zN),'α'); h.ansAng(t.ans,'π₂\\)',90-h.ang(d,yN),'β'); },
  14:(h)=>{ const A=h.P('A'), B=h.P('B'), N=h.P('N'); h.on(B,{p:A,d:unit(sub(N,A))},'B ∈ a'); h.eqLen(nrm(sub(B,A)),40*3.2,'|AB| = 40 мм'); },
  '23.1':(h)=>{ const pl=h.planeLL(h.L('a'),h.L('b')); ['A','B','C','1','2'].forEach(n=>h.inPl(h.P(n),pl,n+' в плоскости (a, b)')); h.on(h.P('C'),h.L('12'),'C ∈ 12'); },
  '23.2':(h)=>{ const al=h.planeT('α'); ['A','B','C'].forEach(n=>h.inPl(h.P(n),al,n+' ∈ α')); h.zero(h.P('A')[1],'A ∈ π₂'); h.zero(h.P('B')[2],'B ∈ π₁'); },
  '23.3':(h)=>{ const be=h.planeT('β'); ['A','B','C'].forEach(n=>h.inPl(h.P(n),be,n+' ∈ β')); h.perp(be.n,zN,'β ⟂ π₁'); },
  '24.1':(h)=>{ const pl=h.planeLL(h.L('a'),h.L('b')); ['A','1','2','3','4'].forEach(n=>h.inPl(h.P(n),pl,n+' в плоскости'));
    h.zero(h.P('1')[2]-h.P('A')[2],'h — горизонталь через A'); h.zero(h.P('2')[2]-h.P('A')[2],'h — горизонталь через A');
    h.zero(h.P('3')[1]-h.P('A')[1],'f — фронталь через A'); h.zero(h.P('4')[1]-h.P('A')[1],'f — фронталь через A'); },
  '24.2':(h)=>{ const al=h.planeT('α'); ['B','1','2'].forEach(n=>h.inPl(h.P(n),al,n+' ∈ α')); h.zero(h.P('1')[2]-h.P('B')[2],'h через B'); h.zero(h.P('2')[1]-h.P('B')[1],'f через B'); },
  '24.3':(h)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'); h.zero(A[2]-C[2],'h через C'); h.zero(B[2]-C[2],'h через C'); h.on(C,{p:A,d:unit(sub(B,A))},'C ∈ AB (h)'); },
  25:(h)=>{ const al=h.planeT('α'), hh=h.L('h'), ff=h.L('f'); h.perp(hh.d,al.n,'h ∥ α'); h.inPl(hh.p,al,'h ⊂ α'); h.perp(ff.d,al.n,'f ∥ α'); h.inPl(ff.p,al,'f ⊂ α'); },
  '26.1':(h)=>{ const al=h.planeT('α'); h.inPl(h.P('A'),al,'a ⊂ α (A)'); h.inPl(h.P('B'),al,'a ⊂ α (B)'); h.perp(al.n,zN,'α ⟂ π₁'); },
  '26.2':(h)=>{ const be=h.planeT('β'); h.inPl(h.P('A'),be,'b ⊂ β (A)'); h.inPl(h.P('B'),be,'b ⊂ β (B)'); h.perp(be.n,yN,'β ⟂ π₂'); },
  28:(h)=>{ const A=h.P('A'), K=h.P('K'), P1=h.P('1'), b=h.L('b'), c=h.L('c'); h.on(K,c,'K ∈ c'); h.on(P1,b,'1 ∈ b'); h.on(P1,{p:A,d:unit(sub(K,A))},'1 ∈ a'); h.par(b.d,c.d,'b ∥ c');
    h.inPl(A,h.planeLL(c,{p:K,d:unit(sub(A,K))}),'a, c, A в одной плоскости'); },
  29:(h)=>{ const K=h.P('K'), pl=h.planeLL(h.L('a'),h.L('b')); h.inPl(K,pl,'K в плоскости'); ['1','2','3','4'].forEach(n=>h.inPl(h.P(n),pl,n+' в плоскости'));
    h.zero(h.P('1')[2]-h.P('2')[2],'12 — горизонталь'); h.zero(h.P('3')[1]-h.P('4')[1],'34 — фронталь'); },
  35:(h)=>{ const pl=h.planeLL(h.L('a'),h.L('b')), A=h.P('A'), l=h.L('l'); h.on(A,l,'A ∈ l'); h.perp(l.d,zN,'l — горизонталь'); h.perp(l.d,pl.n,'l ∥ (a, b)'); },
  '37.1':(h)=>{ const pl=h.plane(h.P('B'),h.P('C'),h.P('D')), A=h.P('A'), m=h.L('m'), n=h.L('n'); h.on(A,m,'A ∈ m'); h.on(A,n,'A ∈ n'); h.perp(m.d,zN,'m — горизонталь'); h.perp(n.d,yN,'n — фронталь'); h.perp(m.d,pl.n,'m ∥ (BCD)'); h.perp(n.d,pl.n,'n ∥ (BCD)'); },
  '37.2':(h)=>{ const al=h.planeT('α'), be=h.planeT('β'); h.eqA(h.angPP(al,be),0,'β ∥ α'); h.inPl(h.P('A'),be,'A ∈ β'); },
  '38.1':(h)=>{ const A=h.P('A'), n=h.L('n'), a=h.L('a'), b=h.L('b'); h.par(a.d,b.d,'a ∥ b'); const pl=h.plane(a.p,add(a.p,mul(a.d,40)),b.p); h.on(A,n,'A ∈ n'); h.par(n.d,pl.n,'n ⟂ (a ∥ b)'); },
  '38.2':(h)=>{ const A=h.P('A'), n=h.L('n'), pl=h.plane(A,h.P('B'),h.P('C')); h.on(A,n,'A ∈ n'); h.par(n.d,pl.n,'n ⟂ (ABC)'); },
  '39.1':(h)=>{ const al=h.planeT('α'); h.par(al.n,h.L('h').d,'α ⟂ h'); h.inPl(h.P('A'),al,'A ∈ α'); },
  '39.2':(h)=>{ const A=h.P('A'), hh=h.L('h'), ff=h.L('f'), b=h.L('b'); h.on(A,hh,'A ∈ h'); h.on(A,ff,'A ∈ f'); h.perp(hh.d,zN,'h — горизонталь'); h.perp(ff.d,yN,'f — фронталь'); h.perp(hh.d,b.d,'h ⟂ b'); h.perp(ff.d,b.d,'f ⟂ b'); },
  '44.1':(h)=>{ const al=h.planeT('α'); h.inPl(h.P('1'),al,'1 ∈ α'); h.inPl(h.P('2'),al,'2 ∈ α'); h.on(h.P('1'),h.L('a'),'1 ∈ a'); h.on(h.P('2'),h.L('b'),'2 ∈ b'); },
  '44.2':(h)=>{ const P1=h.P('1'), P2=h.P('2'); h.zero(P1[2]-P2[2],'l — горизонталь (в α ∥ π₁)'); h.on(P1,h.L('a'),'1 ∈ a'); h.on(P2,h.L('b'),'2 ∈ b'); },
  '44.3':(h)=>{ const al=h.planeT('α'), be=h.planeT('β'), L_=h.P('L'), K=h.P('K'); [L_,K].forEach((P,i)=>{ h.inPl(P,al,(i?'K':'L')+' ∈ α'); h.inPl(P,be,(i?'K':'L')+' ∈ β'); }); h.zero(L_[1],'L ∈ π₂'); h.zero(K[2],'K ∈ π₁'); },
  '44.4':(h)=>{ const al=h.planeT('α'), pl=h.plane(h.P('A'),h.P('B'),h.P('C')); ['K','L'].forEach(n=>{ h.inPl(h.P(n),al,n+' ∈ α'); h.inPl(h.P(n),pl,n+' ∈ (ABC)'); }); },
  '45.1':(h)=>{ const K=h.P('K'), b=h.L('b'), c=h.L('c'), a1=h.pt2('a′'); h.par(b.d,c.d,'b ∥ c'); const pl=h.plane(b.p,add(b.p,mul(b.d,40)),c.p);
    if(Math.hypot(K[0]-a1[0],K[1]-a1[1])>2*h.E) h.fail('K ∈ a: K′ ≢ a′'); h.inPl(K,pl,'K ∈ (b ∥ c)'); },
  85:(h,t)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), D=h.P('D');
    const e=unit(sub(B,A)), pc=sub(sub(C,A),mul(e,dot(sub(C,A),e))), pd=sub(sub(D,A),mul(e,dot(sub(D,A),e)));
    h.ansAng(t.ans,'φ',deg(Math.acos(dot(unit(pc),unit(pd)))),'угол между плоскостями'); },
};
window.ORACLE_SPECS=Object.keys(S);
/* точки, из которых состоит ответ задачи (их называет спецификация) */
window.ORACLE_POINTS=k=>{ const f=S[k]; return f?[...new Set([...f.toString().matchAll(/h\.P\('([^']+)'\)/g)].map(m=>m[1]))]:[]; };
window.ORACLE_CHECK=function(opts){
  opts=opts||{}; const out=[]; const tasks=opts.tasks||WB3.tasks;
  tasks.forEach(t=>{ const parts=(t.parts&&t.parts.length)?t.parts:[t];
    parts.forEach((p,pi)=>{ const f=S[t.n+'.'+(pi+1)]||(parts.length===1||[30].includes(t.n)?S[t.n]:null); if(!f) return;
      const items=[].concat(p.given||t.given||[],...(p.steps||[]).map(s=>s.add||[]));
      const name='Задача №'+t.n+(parts.length>1?' п.'+(pi+1):'');
      const fail=msg=>out.push({name,rule:'оракул',msg,lvl:'ошибка'});
      try{ const h=helper(items,fail); h.fail=fail; f(h,t,pi,p); }catch(e){ out.push({name,rule:'оракул: нет данных',msg:String(e.message||e),lvl:'ошибка'}); } }); });
  return out;
};
})();

/* Проверка оракула: точка ответа сдвигается в пространстве (обе проекции согласованно — линии связи
   не рвутся). Считаем, сколько таких ошибок ловит обычная 3D-проверка и сколько — вместе с оракулом. */
window.ORACLE_MUTATE=function(opts){
  opts=opts||{}; let seed=opts.seed||7; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
  const res={всего:0,геометрия:0,сОракулом:0,пропуски:[]};
  const key=o=>o.rule+'|'+o.msg;
  WB3.tasks.forEach(t=>{ const parts=(t.parts&&t.parts.length)?t.parts:[t];
    parts.forEach((p,pi)=>{ const has=window.ORACLE_SPECS.includes(t.n+'.'+(pi+1))||(window.ORACLE_SPECS.includes(String(t.n))&&(parts.length===1||t.n===30)); if(!has) return;
      const items=[].concat(p.given||t.given||[],...(p.steps||[]).map(s=>s.add||[]));
      const given=new Set((p.given||t.given||[]).filter(i=>i&&i.t==='pt').map(i=>i.l));
      const ans=new Set(window.ORACLE_POINTS(window.ORACLE_SPECS.includes(t.n+'.'+(pi+1))?t.n+'.'+(pi+1):String(t.n)));
      const cand=[...new Set(items.filter(i=>i&&i.t==='pt'&&i.l&&/^[A-ZА-Я0-9][₀-₉0-9]*′$/.test(i.l)&&!given.has(i.l)).map(i=>i.l.slice(0,-1)))]
        .filter(n=>ans.has(n)).filter(n=>items.some(i=>i&&i.t==='pt'&&i.l===n+'″'));
      /* мутант подставляется в СВОЮ часть задачи: у многочастных задач (№ 10, 23, 24, 45…) оракул части 2 — не оракул части 1 */
      const asTask=X=>({tasks:[(t.parts&&t.parts.length)?Object.assign({},t,{parts:parts.map((q,qi)=>qi===pi?Object.assign({},q,{given:X,steps:[]}):q)}):Object.assign({},t,{parts:null,given:X,steps:[]})]});
      const one=asTask(items);
      const g0=new Set(GEOM_CHECK({items}).map(key)), o0=new Set(ORACLE_CHECK(one).map(key));
      for(let k=0;k<(opts.per||4)&&cand.length;k++){ const n=cand[Math.floor(rnd()*cand.length)], dx=(rnd()<.5?-1:1)*(3+rnd()*6), dy=(rnd()<.5?-1:1)*(3+rnd()*6);
        const it2=items.map(i=>{ if(!i||i.t!=='pt'||!i.at) return i; if(i.l===n+'′') return Object.assign({},i,{at:[i.at[0]+dx,i.at[1]+dy]}); if(i.l===n+'″') return Object.assign({},i,{at:[i.at[0]+dx,i.at[1]]}); return i; });
        res.всего++;
        const g=GEOM_CHECK({items:it2}).map(key).some(x=>!g0.has(x));
        const o=ORACLE_CHECK(asTask(it2)).map(key).some(x=>!o0.has(x));
        if(g) res.геометрия++; if(g||o) res.сОракулом++; else if(res.пропуски.length<10) res.пропуски.push('№'+t.n+(parts.length>1?'.'+(pi+1):'')+' '+n); } }); });
  return res;
};
