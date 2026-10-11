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
    /* точка чертежа по любой подписи, в том числе без штриха (A₄, 1₄, Ā″) и в составной «A₅ ≡ B₅» */
    lab(n){ const it=items.find(i=>i&&i.t==='pt'&&i.at&&String(i.l==null?'':i.l).replace(/<[^>]+>/g,'').split(/\s*[≡=]\s*/).map(x=>x.trim()).includes(n)); if(!it) throw new Error('нет точки '+n); return it.at; },
    /* отрезок по подписи (точно или по началу подписи: «H.B.» найдёт «H.B. = 20 мм») */
    segL(l){ const it=items.find(i=>i&&(i.t==='seg'||i.t==='line')&&i.a&&i.b&&String(i.l==null?'':i.l).replace(/<[^>]+>/g,'').trim().startsWith(l)); if(!it) throw new Error('нет отрезка '+l); return [it.a,it.b]; },
    /* прямая в пространстве по двум подписанным проекциям-отрезкам (для подписей вида h″β, h′β) */
    lineFrom(l2,l1){ const [a2,b2]=H.segL(l2), [a1,b1]=H.segL(l1); const at=x=>{ const t2=(x-a2[0])/(b2[0]-a2[0]), t1=(x-a1[0])/(b1[0]-a1[0]); return [x,a1[1]+t1*(b1[1]-a1[1]),-(a2[1]+t2*(b2[1]-a2[1]))]; };
      const x0=Math.max(Math.min(a2[0],b2[0]),Math.min(a1[0],b1[0])); const p=at(x0), q=at(x0+20); return {p,d:unit(sub(q,p))}; },
    /* строки таблицы ответа: [[ячейка, …], …] */
    table(html){ return [...String(html||'').matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(r=>[...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c=>c[1].replace(/<[^>]+>/g,'').trim())); },
    /* окружности чертежа: центр, радиус, поле (по пометке F/H, иначе по знаку v) */
    circs(){ return items.filter(i=>i&&i.t==='circ'&&i.c).map(i=>({c:i.c,r:i.r,k:i.k||'main',pl:i.c._pl||(i.c[1]<0?2:1)})); },
    circAt(c,pl){ const all=H.circs().filter(o=>(!pl||o.pl===pl)&&H.d2(o.c,c)<2*E), m=all.filter(o=>o.k==='main'), cs=m.length?m:all.filter(o=>o.k==='res'); if(!cs.length) throw new Error('нет окружности в '+c.map(v=>v.toFixed(0))); return cs.sort((x,y)=>y.r-x.r)[0]; },
    /* кривая (curve/poly) по подписи */
    curveL(l){ const it=items.find(i=>i&&(i.t==='curve'||i.t==='poly')&&Array.isArray(i.p)&&String(i.l==null?'':i.l).replace(/<[^>]+>/g,'').trim()===l); if(!it) throw new Error('нет кривой '+l); return it.p; },
    /* касательная плоскость: прямые h, t (и f) проходят через A и лежат в одной плоскости; h — горизонталь, f — фронталь */
    tangent(A,what){ const hh=H.L('h'), tt=H.L('t'); H.on(A,hh,'A ∈ h'); H.on(A,tt,'A ∈ t'); H.perp(hh.d,zN,'h — горизонталь'); const n=unit(crs(hh.d,tt.d));
      let ff=null; try{ ff=H.L('f'); }catch(e){} if(ff){ H.on(A,ff,'A ∈ f'); H.perp(ff.d,n,'f в касательной плоскости'); H.perp(ff.d,yN,'f — фронталь'); }
      let nn=null; try{ nn=H.vecL('n″','n′'); }catch(e){} if(nn) H.par(nn.d,n,'нормаль n ⟂ касательной плоскости'); return {p:A,n}; },
    /* прямая по подписанным векторам/отрезкам двух проекций */
    vecL(l2,l1){ const g=l=>{ const it=items.find(i=>i&&(i.t==='vec'||i.t==='seg'||i.t==='line')&&i.a&&i.b&&String(i.l==null?'':i.l).replace(/<[^>]+>/g,'').trim()===l); if(!it) throw new Error('нет '+l); return [it.a,it.b]; };
      const [a2,b2]=g(l2), [a1,b1]=g(l1); const at=x=>{ const t2=(x-a2[0])/(b2[0]-a2[0]), t1=(x-a1[0])/(b1[0]-a1[0]); return [x,a1[1]+t1*(b1[1]-a1[1]),-(a2[1]+t2*(b2[1]-a2[1]))]; };
      const x0=a2[0], p=at(x0), q=at(x0+(b2[0]-a2[0])); return {p,d:unit(sub(q,p))}; },
    /* пересечения прямой со сферой (для полноты ответа) */
    lineSphere(L,O,R){ const w=sub(L.p,O), B=dot(w,L.d), C=dot(w,w)-R*R, D=B*B-C; if(D<0) return []; const s=Math.sqrt(D); return [-B-s,-B+s].map(t=>add(L.p,mul(L.d,t))); },
    num(s){ return parseFloat(String(s).replace('−','-').replace('+','').replace(',','.')); },
    d2(a,b){ return Math.hypot(a[0]-b[0],a[1]-b[1]); },
    /* взаимное положение прямых в пространстве */
    rel(L1,L2){ const c=crs(L1.d,L2.d); if(nrm(c)<0.01) return nrm(crs(sub(L2.p,L1.p),L1.d))<2*E?'совпадают':'параллельны';
      return Math.abs(dot(sub(L2.p,L1.p),c))/nrm(c)<2*E?'пересекаются':'скрещиваются'; },
    /* числа ответа в мм должны давать один масштаб px/мм с длинами чертежа: [[px, мм, «≈»?], …] */
    scaleOK(pairs,what){ /* «≈ 48 мм» значит 47,5 ≤ |AB|/k < 48,5: масштаб k существует, если интервалы для всех чисел пересекаются */
      let lo=0, hi=Infinity; pairs.forEach(([px,mm,ap])=>{ const w=ap?0.5:0.06; lo=Math.max(lo,px/(mm+w)); hi=Math.min(hi,mm>w?px/(mm-w):Infinity); });
      if(lo>hi*(1+1e-3)) fail(what+': нет одного масштаба, при котором все числа ('+pairs.map(p=>p[1]).join(', ')+' мм) верны'); },
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
/* таблица ответа (№ 1–3): координаты в мм и словесное положение — против чертежа */
const WHERE=[[/^I четверть/,c=>c.y>0&&c.z>0],[/^II четверть/,c=>c.y<0&&c.z>0],[/^III четверть/,c=>c.y<0&&c.z<0],[/^IV четверть/,c=>c.y>0&&c.z<0],
  [/π₂/,c=>c.y===0],[/π₁/,c=>c.z===0],[/ось x/,c=>c.y===0&&c.z===0],[/ось y/,c=>c.x===0&&c.z===0],
  [/^I октант/,c=>c.x>0&&c.y>0&&c.z>0],[/^II октант/,c=>c.x>0&&c.y<0&&c.z>0],[/^III октант/,c=>c.x>0&&c.y<0&&c.z<0],[/^IV октант/,c=>c.x>0&&c.y>0&&c.z<0],
  [/^V октант/,c=>c.x<0&&c.y>0&&c.z>0],[/^VI октант/,c=>c.x<0&&c.y<0&&c.z>0],[/^VII октант/,c=>c.x<0&&c.y<0&&c.z<0],[/^VIII октант/,c=>c.x<0&&c.y>0&&c.z<0]];
function tableCheck(h,t,col){ h.table(t.ans).slice(1).forEach(r=>{ const n=r[0]; if(!h.has(n)){ h.fail('нет точки '+n); return; } const P=h.P(n), mm=v=>Math.round(v/3.2*10)/10;
  const c={x:-mm(P[0]),y:mm(P[1]),z:mm(P[2])}; const sg=v=>Math.abs(v)<0.3?0:v; const cs={x:sg(c.x),y:sg(c.y),z:sg(c.z)};
  ['x','y','z'].forEach(k=>{ if(col[k]==null) return; const w=h.num(r[col[k]]); if(Math.abs(c[k]-w)>0.3) h.fail(n+': '+k+' в ответе '+r[col[k]]+', на чертеже '+c[k]); });
  const w=r[col.where]||'', rule=WHERE.find(([re])=>re.test(w)); if(rule&&!rule[1](cs)) h.fail(n+': «'+w+'» не соответствует координатам ('+cs.x+'; '+cs.y+'; '+cs.z+')'); }); }
/* № 17: что сказано в ответе — против положения прямых в пространстве */
function relCheck(h,p,L1,L2){ const r=h.rel(L1,L2), a=strip(p.ans); const said=/скрещива/.test(a)?'скрещиваются':/пересека|∩/.test(a)?'пересекаются':/∥|параллельн/.test(a)?'параллельны':'?';   /* «скрещиваются» — первым: «профильные проекции не параллельны» не про сами прямые */
  if(said!==r) h.fail('в ответе «'+said+'», а по чертежу прямые '+r); }
/* сфера: центр O, радиус — окружность вокруг O′; K, L — на a и на сфере; других пересечений нет */
function sphereLine(h){ const O=h.P('O'), R=h.circAt(h.pt2('O′'),1).r, a=h.L('a'), KL=['K','L'].map(n=>h.P(n));
  KL.forEach((X,i)=>{ h.on(X,a,'KL'[i]+' ∈ a'); h.eqLen(nrm(sub(X,O)),R,'KL'[i]+' на сфере'); });
  h.lineSphere(a,O,R).forEach(X=>{ if(!KL.some(Y=>nrm(sub(X,Y))<3*h.E)) h.fail('пропущена точка пересечения a со сферой'); }); }
/* угол φ из ответа (берётся число после «≈»: «φ = 90° − δ ≈ 36.4°») */
function angPhi(h,p,val){ const m=/φ[^≈]*≈\s*(\d+(?:[.,]\d+)?)\s*°/.exec(strip(p.ans)); if(!m){ h.fail('в ответе нет угла φ'); return; }
  const v=parseFloat(m[1].replace(',','.')), tol=/[.,]/.test(m[1])?0.06:0.51; if(Math.abs(v-val)>tol) h.fail('в ответе φ ≈ '+m[1]+'°, вычислено '+val.toFixed(2)+'°'); }
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
  /* ── задачи, у которых не было проверки ответа (добавлено вместе с сертификатами) ── */
  /* № 1–3: таблица ответа против чертежа: координаты и словесное расположение */
  1:(h,t)=>tableCheck(h,t,{y:2,z:3,where:1}),
  2:(h,t)=>{ tableCheck(h,t,{y:1,z:2,where:3});
    /* условие словами: «над/под горизонтальной … на расстоянии N мм», «за/перед фронтальной … N мм», «на фронтальной … на N мм выше», «на оси x» */
    String(t.q).replace(/<[^>]+>/g,'').split('•').slice(1).forEach(b=>{ const m=/точка\s+([A-Z])/.exec(b); if(!m) return; const P=h.P(m[1]), want={};
      let r; if((r=/над горизонтальной[^;]*?(\d+)\s*мм/.exec(b))) want.z=+r[1]; if((r=/под горизонтальной[^;]*?(\d+)\s*мм/.exec(b))) want.z=-r[1];
      if((r=/за фронтальной[^;]*?расстоянии\s*(\d+)\s*мм/.exec(b))) want.y=-r[1]; if((r=/перед фронтальной[^;]*?расстоянии\s*(\d+)\s*мм/.exec(b))) want.y=+r[1];
      if(/на фронтальной плоскости/.test(b)){ want.y=0; if((r=/на\s*(\d+)\s*мм\s*выше/.exec(b))) want.z=+r[1]; }
      if(/на оси проекций x|на оси x/.test(b)){ want.y=0; want.z=0; }
      Object.entries(want).forEach(([c,v])=>{ const got=P[c==='y'?1:2]/3.2; if(Math.abs(got-v)>0.3) h.fail(m[1]+': по условию '+c+' = '+v+' мм, на чертеже '+got.toFixed(1)); }); }); },
  3:(h,t)=>tableCheck(h,t,{x:1,y:2,z:3,where:4}),
  /* № 4: какие точки выше/ниже, перед/за, слева/справа, на плоскостях и осях — по чертежу */
  4:(h,t)=>{ const pts='ABCDEF'.split('').filter(n=>h.has(n)), c=n=>{ const P=h.P(n); return {x:-P[0],y:P[1],z:P[2]}; }, z0=v=>Math.abs(v)<2*h.E;
    const rule=[[/выше плоскости π₁/,n=>c(n).z>2*h.E],[/ниже плоскости π₁/,n=>c(n).z<-2*h.E],[/перед плоскостью π₂/,n=>c(n).y>2*h.E],[/за плоскостью π₂/,n=>c(n).y<-2*h.E],
      [/слева от плоскости π₃/,n=>c(n).x>2*h.E],[/справа от плоскости π₃/,n=>c(n).x<-2*h.E],[/на плоскостях проекций/,n=>[c(n).x,c(n).y,c(n).z].filter(z0).length===1],[/на осях/,n=>[c(n).x,c(n).y,c(n).z].filter(z0).length===2]];
    h.table(t.ans).slice(1).forEach(([w,list])=>{ const r=rule.find(([re])=>re.test(w)); if(!r) return; const said=new Set((list.match(/[A-F](?![a-zа-я])/g)||[])), truth=new Set(pts.filter(r[1]));
      if([...said].join()!==[...truth].sort().join()&&[...truth].some(n=>!said.has(n))||[...said].some(n=>!truth.has(n))) h.fail('«'+w+'»: в ответе '+[...said].join(', ')+', по чертежу '+[...truth].join(', ')); }); },
  /* № 7: найденная ось x даёт A(30; 22; 20) */
  7:(h,t)=>{ const m=/A\(\s*(\d+)\s*;\s*(\d+)\s*;\s*(\d+)\s*\)/.exec(strip(t.ans)); if(!m){ h.fail('в ответе нет координат A'); return; } const P=h.P('A');
    [[-P[0],m[1],'x'],[P[1],m[2],'y'],[P[2],m[3],'z']].forEach(([v,w,c])=>{ if(Math.abs(v/3.2-w)>0.6) h.fail('A: '+c+' в ответе '+w+', по чертежу '+(v/3.2).toFixed(1)); }); },
  /* № 17: заявленное взаимное положение прямых — против положения в пространстве */
  '17.1':(h,t,pi,p)=>relCheck(h,p,h.L('a'),h.L('b')),
  '17.2':(h,t,pi,p)=>{ const K2=h.pt2('K″'), c2=h.segL('c″'), d2=h.segL('d″'); const on=(P,[a,b])=>Math.abs((P[0]-a[0])*(b[1]-a[1])-(P[1]-a[1])*(b[0]-a[0]))/h.d2(a,b);
    if(on(K2,c2)>2*h.E||on(K2,d2)>2*h.E) h.fail('K″ не на пересечении c″ и d″');
    const u=sub(c2[1],c2[0]), w=sub(d2[1],d2[0]); if(Math.abs(u[0]*w[1]-u[1]*w[0])/(nrm(u)*nrm(w))<0.01) h.fail('c″ ∥ d″ — тогда прямые не пересекаются');
    if(!/пересека/.test(strip(p.ans))) h.fail('в ответе не сказано, что прямые пересекаются'); },
  '17.3':(h,t,pi,p)=>relCheck(h,p,h.L('e'),h.L('f')),
  '17.4':(h,t,pi,p)=>{ const k1=h.pt2('k′'), k=[k1[0],k1[1],0], l=h.L('l'); const kL={p:k,d:[0,0,1]}; relCheck(h,p,kL,l); h.perp(kL.d,l.d,'k ⟂ l'); },
  '17.5':(h,t,pi,p)=>relCheck(h,p,h.L('AB'),h.L('CD')),
  /* № 51: натуральная величина A₄B₄ = |AB|; на π₅ отрезок — точка */
  51:(h)=>{ const A=h.P('A'), B=h.P('B'); h.eqLen(h.d2(h.lab('A₄'),h.lab('B₄')),nrm(sub(B,A)),'|A₄B₄| = |AB|'); if(h.d2(h.lab('A₅'),h.lab('B₅'))>2*h.E) h.fail('A₅ и B₅ не совпадают'); },
  /* № 54: точки сечения — на рёбрах призмы и в α; натуральный вид 1₄…6₄ конгруэнтен сечению */
  54:(h)=>{ const al=h.planeT('α'), N=['1','2','3','4','5','6'], P=N.map(n=>h.P(n));
    P.forEach((X,i)=>h.inPl(X,al,N[i]+' ∈ α'));
    const hex=(h.M.polys.find(pl=>pl.p.length===6&&pl.p.every(q=>q[1]>0))||{}).p; if(!hex) h.fail('нет основания призмы на π₁');
    else N.forEach(n=>{ const q=h.pt2(n+'′'); if(!hex.some(v=>h.d2(v,q)<2*h.E)) h.fail(n+'′ не в вершине основания: точка не на ребре призмы'); });
    N.forEach((n,i)=>[1,2,3].forEach(j=>{ const m=N[(i+j)%6]; h.eqLen(h.d2(h.lab(n+'₄'),h.lab(m+'₄')),nrm(sub(h.P(m),h.P(n))),'|'+n+'₄'+m+'₄| = |'+n+m+'|'); })); },
  /* № 59: поворот вокруг i ⟂ π₂: y не меняется, радиус на π₂ тот же, Ā ∈ α; угол φ в ответе */
  59:(h,t)=>{ const A=h.P('A'), Ab=h.P('Ā'), i2=h.pt2('i″'); h.zero(Ab[1]-A[1],'при повороте вокруг i ⟂ π₂ глубина y не меняется');
    const a2=h.pt2('A″'), b2=h.pt2('Ā″'); h.eqLen(h.d2(b2,i2),h.d2(a2,i2),'радиус вращения'); h.inPl(Ab,h.planeT('α'),'Ā ∈ α');
    const u=sub(a2,i2), w=sub(b2,i2); h.ansAng(t.ans,'φ',deg(Math.acos(dot(u,w)/nrm(u)/nrm(w))),'угол поворота'); },
  /* № 60: поворот вокруг i ⟂ π₂ через B до положения ∥ π₁; истинный вид на π₁ */
  60:(h,t)=>{ const A=h.P('A'), B=h.P('B'), C=h.P('C'), Ab=h.P('Ā'), Cb=h.P('C̄'), b2=h.pt2('B″');
    h.zero(Ab[1]-A[1],'y(Ā) = y(A)'); h.zero(Cb[1]-C[1],'y(C̄) = y(C)'); h.eqLen(h.d2(h.pt2('Ā″'),b2),h.d2(h.pt2('A″'),b2),'радиус для A'); h.eqLen(h.d2(h.pt2('C̄″'),b2),h.d2(h.pt2('C″'),b2),'радиус для C');
    h.zero(Ab[2]-B[2],'Ā на уровне B (плоскость ∥ π₁)'); h.zero(Cb[2]-B[2],'C̄ на уровне B');
    const ab=h.d2(h.pt2('Ā′'),h.pt2('B′')), bc=h.d2(h.pt2('B′'),h.pt2('C̄′')), ca=h.d2(h.pt2('C̄′'),h.pt2('Ā′'));
    h.eqLen(ab,nrm(sub(B,A)),'|Ā′B′| = |AB|'); h.eqLen(bc,nrm(sub(C,B)),'|B′C̄′| = |BC|'); h.eqLen(ca,nrm(sub(A,C)),'|C̄′Ā′| = |CA|');
    const n=k=>{ const m=new RegExp('\\|'+k+'\\|\\s*≈\\s*(\\d+)').exec(strip(t.ans)); return m?+m[1]:null; };
    if(n('AB')&&n('BC')&&n('CA')) h.scaleOK([[ab,n('AB'),1],[bc,n('BC'),1],[ca,n('CA'),1]],'длины сторон в ответе'); },
  /* № 64: расстояние на чертеже = расстояние от A до b в пространстве */
  64:(h)=>{ const A=h.P('A'), b=h.L('b'); const [p,q]=h.segL('H.B.'); h.eqLen(h.d2(p,q),h.dPL(A,b),'натуральная величина расстояния');
    const [o1,o2]=h.segL('|OK|'); h.scaleOK([[h.d2(p,q),20,1],[h.d2(o1,o2),16,1]],'числа на чертеже'); },
  /* № 66: угол прямой a с плоскостью β */
  '66.1':(h,t,pi,p)=>angPhi(h,p,90-h.ang(h.L('a').d,h.planeT('β').n)),
  '66.2':(h,t,pi,p)=>angPhi(h,p,90-h.ang(h.L('a').d,h.planeT('β').n)),
  /* № 67: угол между плоскостями α (следы) и β (h, f) */
  67:(h,t)=>{ const al=h.planeT('α'), hb=h.lineFrom('h″β','h′β'), fb=h.lineFrom('f″β','f′β'); const nb=unit(crs(hb.d,fb.d));
    const a=h.ang(al.n,nb); const m=/острый угол[^≈]*≈\s*(\d+(?:[.,]\d+)?)\s*°/.exec(strip(t.ans)); if(!m){ h.fail('в ответе нет острого угла'); return; }
    if(Math.abs(parseFloat(m[1].replace(',','.'))-a)>0.06) h.fail('острый угол в ответе '+m[1]+'°, вычислено '+a.toFixed(2)+'°'); },
  /* № 75 а: конус (основание на π₁, вершина S над центром), прямая a ⟂ π₁ */
  '75.1':(h)=>{ const Sx=h.P('S'), K=h.P('K'), c=h.circAt(h.pt2('S′'),1), r=h.d2(h.pt2('K′'),h.pt2('S′'));
    h.eqLen(r,c.r*(1-K[2]/Sx[2]),'K на конусе: радиус параллели = R·(1 − z/h)'); if(h.d2(h.pt2('K′'),h.pt2('a′'))>2*h.E) h.fail('K ∉ a');
    const M2=h.lab('M″'); if(Math.abs(M2[1])>2*h.E||Math.abs(M2[0]-h.pt2('a′')[0])>2*h.E) h.fail('M — точка a на основании: M″ на оси x под a′'); },
  /* № 75 б: цилиндр ⟂ π₁ — точки на окружности и на кривой a; найдены все пересечения */
  '75.2':(h)=>{ const c=h.circs().filter(o=>o.pl===1&&o.k==='main').sort((x,y)=>y.r-x.r)[0]; const names=['K','L','M'].filter(n=>h.has(n));
    names.forEach(n=>h.eqLen(h.d2(h.pt2(n+'′'),c.c),c.r,n+' на цилиндре'));
    const a1=h.curveL('a′'); for(let i=0;i+1<a1.length;i++){ const f=t=>h.d2([a1[i][0]+(a1[i+1][0]-a1[i][0])*t,a1[i][1]+(a1[i+1][1]-a1[i][1])*t],c.c)-c.r;
      if(f(0)*f(1)<0){ let lo=0,hi=1; for(let j=0;j<40;j++){ const m=(lo+hi)/2; if(f(lo)*f(m)<=0) hi=m; else lo=m; } const X=[a1[i][0]+(a1[i+1][0]-a1[i][0])*lo,a1[i][1]+(a1[i+1][1]-a1[i][1])*lo];
        if(!names.some(n=>h.d2(h.pt2(n+'′'),X)<3*h.E)) h.fail('пропущена точка пересечения a′ с окружностью в ('+X.map(v=>v.toFixed(0)).join('; ')+')'); } } },
  /* № 75 в, 76: сфера — K, L на прямой и на сфере; других пересечений нет */
  '75.3':(h)=>sphereLine(h),
  '76.1':(h)=>sphereLine(h),
  '76.2':(h)=>sphereLine(h),
  /* № 77 б: конус S + основание на π₁; K1, K2 на a и на конусе */
  '77.2':(h)=>{ const Sx=h.P('S'), a=h.L('a'), c=h.circs().filter(o=>o.pl===1&&o.k==='main').sort((x,y)=>y.r-x.r)[0];
    ['K1','K2'].forEach(n=>{ const X=h.P(n); h.on(X,a,n+' ∈ a'); const t=Sx[2]/(Sx[2]-X[2]), P=add(Sx,mul(sub(X,Sx),t)); h.eqLen(h.d2([P[0],P[1]],c.c),c.r,n+' на конусе (образующая S'+n+' доходит до окружности основания)'); }); },
  /* № 78: касательная плоскость и нормаль */
  '78.1':(h)=>{ const A=h.P('A'), O=h.P('O'), c=h.circAt(h.pt2('O′'),1); h.eqLen(nrm(sub(A,O)),c.r,'A на сфере'); const tp=h.tangent(A); h.par(tp.n,sub(A,O),'касательная плоскость ⟂ OA'); },
  '78.2':(h)=>{ const A=h.P('A'), tp=h.tangent(A);
    const gens=h.M.segs.all.filter(s=>s.k==='main'&&s.a[1]<=1&&s.b[1]<=1&&Math.abs(s.a[0]-s.b[0])>5&&Math.abs(s.a[1]-s.b[1])>20).map(s=>unit([s.b[0]-s.a[0],0,-(s.b[1]-s.a[1])]));
    if(!gens.length){ h.fail('не найден очерк цилиндра на π₂'); return; } h.perp(tp.n,gens[0],'касательная плоскость содержит образующую'); },
  '78.3':(h)=>{ const A=h.P('A'), tp=h.tangent(A); h.inPl(h.P('S'),tp,'касательная плоскость конуса проходит через вершину S'); },
  '78.4':(h)=>{ const A=h.P('A'), T=h.P('T'), tp=h.tangent(A), n={p:A,d:tp.n}; const ax={p:T,d:zN};
    if(h.rel(n,ax)!=='пересекаются') h.fail('нормаль тора не пересекает ось вращения'); },
  /* № 81: прямые через A пересекают b и наклонены к α (y = const) под 45°; найдены оба решения */
  81:(h)=>{ const A=h.P('A'), b=h.L('b'), sols=[];
    /* 2 и 4 — точки на l = β ∩ α; решения — прямые A2 и A4: они пересекают b и наклонены к α под 45° */
    const lines=['2','4'].map(n=>({p:A,d:unit(sub(h.P(n),A)),n})); lines.forEach(L=>{ if(h.rel(L,b)!=='пересекаются') h.fail('A'+L.n+' не пересекает b'); h.eqA(90-h.ang(L.d,yN),45,'угол A'+L.n+' с α'); });
    const f=t=>{ const d=sub(add(b.p,mul(b.d,t)),A); return d[1]*d[1]-d[0]*d[0]-d[2]*d[2]; }; let pv=f(-400);
    for(let t=-400;t<=400;t+=0.5){ const v=f(t+0.5); if(pv*v<0){ let lo=t,hi=t+0.5; for(let j=0;j<50;j++){ const m=(lo+hi)/2; if(f(lo)*f(m)<=0) hi=m; else lo=m; } sols.push(add(b.p,mul(b.d,lo))); } pv=v; }
    sols.forEach(X=>{ if(!lines.some(L=>h.dPL(X,L)<3*h.E)) h.fail('пропущено решение: прямая через A и точку b ('+X.map(v=>v.toFixed(0)).join('; ')+')'); }); },
  /* № 83: B — ближайшая к A точка тора: AB проходит через центр трубки, |AB| совпадает с подписью */
  83:(h)=>{ const A=h.P('A'), B=h.P('B'), A1=h.P('A₁'), B1=h.P('B₁');
    const X0=(A1[0]**2-A[0]**2-A[1]**2)/(2*(A1[0]-A[0])); const rho=P=>Math.hypot(P[0]-X0,P[1]);
    h.zero(rho(B)-Math.abs(B1[0]-X0),'B₁ — поворот B вокруг оси тора'); h.zero(B[2]-B1[2],'B и B₁ на одной высоте'); h.zero(A1[1],'A₁ в плоскости главного меридиана'); h.zero(B1[1],'B₁ в плоскости главного меридиана');
    const C2=h.lab('C₁″'), a2=h.pt2('A₁″'), b2=h.pt2('B₁″'); if(Math.abs((b2[0]-C2[0])*(a2[1]-C2[1])-(b2[1]-C2[1])*(a2[0]-C2[0]))/h.d2(a2,C2)>2*h.E) h.fail('A₁, B₁ и центр трубки C₁ не на одной прямой — AB не нормаль');
    const [p,q]=h.segL('|AB|'); h.eqLen(h.d2(p,q),nrm(sub(B,A)),'отрезок |AB| на чертеже = |AB|'); },
  /* № 84: сфера с центром O касается конуса в точке A */
  84:(h)=>{ const O=h.P('O'), A=h.P('A'), c=h.circs().filter(o=>o.pl===1&&o.k==='main').sort((x,y)=>y.r-x.r)[0];
    const tri=h.M.polys.find(pl=>pl.p.length===3&&pl.p.every(q=>q[1]<=2*h.E)); if(!tri){ h.fail('нет очерка конуса'); return; } const apex=tri.p.reduce((m,q)=>q[1]<m[1]?q:m), H0=-apex[1];
    h.eqLen(h.d2(h.pt2('A′'),c.c),c.r*(1-A[2]/H0),'A на конусе');
    const u=sub(h.pt2('A′'),c.c), w=sub(h.pt2('O′'),c.c); if(Math.abs(u[0]*w[1]-u[1]*w[0])/(nrm(u)*nrm(w)+1e-9)>0.01) h.fail('A не в меридиане точки O');
    const Sx=[c.c[0],c.c[1],H0]; h.perp(sub(A,O),sub(A,Sx),'OA ⟂ образующей SA (касание)');
    const cs=h.circAt(h.pt2('O′'),1); h.eqLen(cs.r,nrm(sub(A,O)),'радиус сферы = |OA|'); const [p,q]=h.segL('R'); h.eqLen(h.d2(p,q),nrm(sub(A,O)),'отрезок R = |OA|'); },
  /* № 87: центр окружности радиуса 15 мм в α, касательной к обоим следам */
  87:(h)=>{ const O=h.P('O'), al=h.planeT('α'); h.inPl(O,al,'O ∈ α'); const [a,b]=h.segL('h₀α'), [c,d]=h.segL('f₀α');
    const hL={p:[a[0],a[1],0],d:unit([b[0]-a[0],b[1]-a[1],0])}, fL={p:[c[0],0,-c[1]],d:unit([d[0]-c[0],0,-(d[1]-c[1])])};
    h.eqLen(h.dPL(O,hL),15*3.2,'расстояние до h₀α = 15 мм'); h.eqLen(h.dPL(O,fL),15*3.2,'расстояние до f₀α = 15 мм'); },
  /* № 88: плоскость (S, A, B) касается конуса и параллельна a; второе решение A₂ тоже касательное */
  88:(h)=>{ const Sx=h.P('S'), A=h.P('A'), B=h.P('B'), a=h.L('a'), c=h.circAt(h.pt2('C′'),1); const pl=h.plane(Sx,A,B);
    h.perp(pl.n,a.d,'плоскость ∥ a'); h.zero(A[2],'A на основании'); h.eqLen(h.d2(h.pt2('A′'),c.c),c.r,'A′ на окружности основания');
    [['A′',h.pt2('A′')],['A₂′',h.lab('A₂′')]].forEach(([n,X])=>{ const u=sub(X,c.c), w=sub(X,h.pt2('B′')); if(Math.abs(u[0]*w[0]+u[1]*w[1])/(nrm(u)*nrm(w))>0.01) h.fail('B′'+n+' не касается окружности основания в '+n); h.eqLen(h.d2(X,c.c),c.r,n+' на окружности'); }); },
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
