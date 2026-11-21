/* ═══════════ Ядро сопряжений (инжа, ДЗ 1): построения циркулем и линейкой + независимая проверка ═══════════
   Два исполнителя, как у ядра начерта:
   1) ПОСТРОИТЕЛЬ — делает ровно то, что студент на листе: ГМТ центров (параллель на R, концентрическая окружность R ± r,
      окружность на диаметре), их пересечение, точки касания. Каждое действие — шаг с чертежом (элементы с ролями).
   2) ПРОВЕРЯЮЩИЙ — не повторяет построение, а проверяет определение касания: расстояние от центра до прямой = R,
      расстояние между центрами = R ± r, точка касания лежит на обоих элементах, касательные направления на стыке совпадают.
   Контур варианта проверяется целиком: замкнут, на каждом стыке гладкий (G1), каждая дуга — своего радиуса.
   Ошибка переноса размеров с условия (не тот радиус, не та сторона) почти всегда ломает гладкость — её видно сразу.
   Единицы — мм; x вправо, y вверх. Окружность {c:[x,y], r}; прямая {p:[x,y], d:[dx,dy]} (d — единичный). */
(function(){
const EPS=1e-7;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], mul=(a,k)=>[a[0]*k,a[1]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1], crs=(a,b)=>a[0]*b[1]-a[1]*b[0], len=a=>Math.hypot(a[0],a[1]);
const unit=a=>{ const l=len(a); if(l<EPS) throw new Error('нулевой вектор'); return [a[0]/l,a[1]/l]; };
const perp=a=>[-a[1],a[0]], dist=(a,b)=>len(sub(a,b)), near=(a,b,e=1e-6)=>dist(a,b)<e;
const pick=(pts,hint)=>{ if(!pts.length) throw new Error('ГМТ не пересекаются: сопряжение с такими данными невозможно'); return hint?pts.slice().sort((a,b)=>dist(a,hint)-dist(b,hint))[0]:pts[0]; };
/* ── примитивы ── */
const line=(p,q)=>({p,d:unit(sub(q,p))});                 /* прямая через две точки */
const lineDir=(p,d)=>({p,d:unit(d)});
const circ=(c,r)=>({c,r});
const offset=(L,R,side)=>({p:add(L.p,mul(perp(L.d),R*side)),d:L.d});   /* side=+1 — слева от направления d */
const sideOf=(L,P)=>Math.sign(crs(L.d,sub(P,L.p)));
const foot=(L,P)=>add(L.p,mul(L.d,dot(sub(P,L.p),L.d)));
const distL=(L,P)=>Math.abs(crs(L.d,sub(P,L.p)));
function xLL(a,b){ const den=crs(a.d,b.d); if(Math.abs(den)<EPS) return []; const t=crs(sub(b.p,a.p),b.d)/den; return [add(a.p,mul(a.d,t))]; }
function xLC(L,C){ const f=foot(L,C.c), h=dist(f,C.c); if(h>C.r+EPS) return []; const s=Math.sqrt(Math.max(0,C.r*C.r-h*h)); return s<EPS?[f]:[add(f,mul(L.d,-s)),add(f,mul(L.d,s))]; }
function xCC(A,B){ const d=dist(A.c,B.c); if(d<EPS||d>A.r+B.r+EPS||d<Math.abs(A.r-B.r)-EPS) return [];
  const a=(A.r*A.r-B.r*B.r+d*d)/(2*d), h=Math.sqrt(Math.max(0,A.r*A.r-a*a)), u=unit(sub(B.c,A.c)), m=add(A.c,mul(u,a));
  return h<EPS?[m]:[add(m,mul(perp(u),h)),add(m,mul(perp(u),-h))]; }
/* ── шаги: элементы с ролями ──
   given — данное; axis — оси и центровые; locus — ГМТ центров (тонкая вспомогательная); aux — вспомогательное построение;
   center — найденный центр; tan — точка касания; result — обведённый элемент. */
const E={pt:(at,role,l)=>({t:'pt',at,role,l}),circle:(c,role,l)=>({t:'circle',c:c.c,r:c.r,role,l}),line:(L,role,l)=>({t:'line',p:L.p,d:L.d,role,l}),
  seg:(a,b,role,l)=>({t:'seg',a,b,role,l}),arc:(c,r,from,to,ccw,role,l)=>({t:'arc',c,r,from,to,ccw,role,l})};
/* режим касания дуги сопряжения радиуса R с окружностью C:
   'ext' — касаются внешне (|OC| = R + r), 'enc' — дуга охватывает окружность (|OC| = R − r), 'ins' — дуга внутри окружности (|OC| = r − R) */
const dOf=(m,R,r)=>m==='ext'?R+r:m==='enc'?R-r:r-R;
const tanPt=(O,C,m,R)=>{ const u=unit(sub(C.c,O)); return m==='ins'?add(O,mul(u,-R)):add(O,mul(u,R)); };
const MODE={ext:'внешнее',enc:'внутреннее (дуга охватывает)',ins:'внутреннее (дуга внутри)'};

/* ── построения: {O, T:[…], R, steps:[{cap, els}], checks:[…]} ── */
function filletLL(L1,L2,R,s1,s2,hint){
  const A=offset(L1,R,s1), B=offset(L2,R,s2), O=pick(xLL(A,B),hint), T1=foot(L1,O), T2=foot(L2,O);
  return {kind:'LL',O,R,T:[T1,T2],steps:[
    {cap:`Параллельно каждой прямой — на расстоянии R${R}`,els:[E.line(A,'locus'),E.line(B,'locus')]},
    {cap:'Параллели пересеклись — центр дуги O',els:[E.pt(O,'center','O')]},
    {cap:'Перпендикуляры из O — точки касания',els:[E.seg(O,T1,'aux'),E.seg(O,T2,'aux'),E.pt(T1,'tan','1'),E.pt(T2,'tan','2')]}],
    checks:[['dist(O, прямая 1) = R',distL(L1,O),R],['dist(O, прямая 2) = R',distL(L2,O),R]]};
}
function filletLC(L,C,R,s,m,hint){
  const A=offset(L,R,s), G=circ(C.c,dOf(m,R,C.r)), O=pick(xLC(A,G),hint), T1=foot(L,O), T2=tanPt(O,C,m,R);
  return {kind:'LC',O,R,T:[T1,T2],mode:m,steps:[
    {cap:`Параллельно прямой — на расстоянии R${R}`,els:[E.line(A,'locus')]},
    {cap:`Из центра окружности — дуга радиусом ${m==='ext'?`R + r = ${R}+${C.r}`:m==='enc'?`R − r = ${R}−${C.r}`:`r − R = ${C.r}−${R}`}`,els:[E.circle(G,'locus')]},
    {cap:'Пересечение — центр дуги O',els:[E.pt(O,'center','O')]},
    {cap:'Перпендикуляр к прямой и линия центров — точки касания',els:[E.seg(O,T1,'aux'),E.seg(O,m==='ins'?T2:C.c,'aux'),E.pt(T1,'tan','1'),E.pt(T2,'tan','2')]}],
    checks:[['dist(O, прямая) = R',distL(L,O),R],[`|O C| = ${m}`,dist(O,C.c),dOf(m,R,C.r)]]};
}
function filletCC(C1,C2,R,m1,m2,hint){
  const G1=circ(C1.c,dOf(m1,R,C1.r)), G2=circ(C2.c,dOf(m2,R,C2.r)), O=pick(xCC(G1,G2),hint), T1=tanPt(O,C1,m1,R), T2=tanPt(O,C2,m2,R);
  const cap=(m,r)=>m==='ext'?`R + r = ${R}+${r}`:m==='enc'?`R − r = ${R}−${r}`:`r − R = ${r}−${R}`;
  return {kind:'CC',O,R,T:[T1,T2],mode:[m1,m2],steps:[
    {cap:`Из центра первой окружности — дуга ${cap(m1,C1.r)}`,els:[E.circle(G1,'locus')]},
    {cap:`Из центра второй — дуга ${cap(m2,C2.r)}`,els:[E.circle(G2,'locus')]},
    {cap:'Дуги пересеклись — центр сопряжения O',els:[E.pt(O,'center','O')]},
    {cap:'Линии центров — точки касания',els:[E.seg(O,m1==='ins'?T1:C1.c,'aux'),E.seg(O,m2==='ins'?T2:C2.c,'aux'),E.pt(T1,'tan','1'),E.pt(T2,'tan','2')]}],
    checks:[[`|O C₁| = ${m1}`,dist(O,C1.c),dOf(m1,R,C1.r)],[`|O C₂| = ${m2}`,dist(O,C2.c),dOf(m2,R,C2.r)]]};
}
function tangentPC(P,C,hint){
  const M=mul(add(P,C.c),0.5), G=circ(M,dist(P,C.c)/2), T=pick(xCC(G,C),hint);
  return {kind:'PC',T:[T],line:line(P,T),steps:[
    {cap:'Соединяем точку с центром и делим отрезок пополам',els:[E.seg(P,C.c,'aux'),E.pt(M,'aux','M')]},
    {cap:'Окружность на этом отрезке как на диаметре',els:[E.circle(G,'locus')]},
    {cap:'Она пересекла окружность — точка касания',els:[E.pt(T,'tan','T')]},
    {cap:'Касательная через точку касания',els:[E.seg(P,T,'result')]}],
    checks:[['касательная ⟂ радиусу',dot(sub(T,P),sub(T,C.c)),0],['T на окружности',dist(T,C.c),C.r]]};
}
/* общая касательная: outer — внешняя, inner — внутренняя (окружности по разные стороны); hint — где примерно точка касания на C1 */
function tangentCC(C1,C2,kind,hint){
  const sw=C1.r<C2.r, A=sw?C2:C1, B=sw?C1:C2, ra=kind==='outer'?A.r-B.r:A.r+B.r;
  const G=circ(A.c,ra), M=mul(add(A.c,B.c),0.5), D=circ(M,dist(A.c,B.c)/2);
  let K=[]; if(ra<EPS){ const n=perp(unit(sub(B.c,A.c))); K=[add(A.c,n),add(A.c,mul(n,-1))].map(p=>p); }
  else K=xCC(G,D);
  const cand=K.map(k=>{ const u=ra<EPS?unit(sub(k,A.c)):unit(sub(k,A.c)), Ta=add(A.c,mul(u,A.r)), Tb=kind==='outer'?add(B.c,mul(u,B.r)):add(B.c,mul(u,-B.r)); return [Ta,Tb]; });
  const t1=c=>sw?c[1]:c[0];   /* подсказка — примерное положение точки касания на ПЕРВОЙ окружности */
  const best=hint?cand.slice().sort((a,b)=>dist(t1(a),hint)-dist(t1(b),hint))[0]:cand[0];
  if(!best) throw new Error('общей касательной нет');
  const [Ta,Tb]=best, T=sw?[Tb,Ta]:[Ta,Tb];
  return {kind:'CC-'+kind,T,line:line(T[0],T[1]),steps:[
    {cap:`Вспомогательная окружность из центра большей: ${kind==='outer'?'R − r':'R + r'} = ${+ra.toFixed(2)}`,els:[E.circle(G,'locus')]},
    {cap:'Окружность на отрезке центров как на диаметре — касательная к вспомогательной',els:[E.seg(A.c,B.c,'aux'),E.circle(D,'aux')]},
    {cap:'Радиус большей через найденную точку — точка касания на большей',els:[E.seg(A.c,Ta,'aux'),E.pt(Ta,'tan','1')]},
    {cap:`Параллельный радиус ${kind==='outer'?'меньшей в ту же сторону':'меньшей в обратную сторону'} — вторая точка`,els:[E.seg(B.c,Tb,'aux'),E.pt(Tb,'tan','2')]},
    {cap:'Касательная',els:[E.seg(Ta,Tb,'result')]}],
    checks:[['T₁T₂ ⟂ радиусу 1',dot(sub(T[1],T[0]),sub(T[0],C1.c)),0],['T₁T₂ ⟂ радиусу 2',dot(sub(T[1],T[0]),sub(T[1],C2.c)),0]]};
}
/* ── контур: замкнутая цепочка кусков {seg:[A,B]} | {arc:{c,r}, from, to, ccw} ── */
function tangentAt(piece,P,end){   /* единичный касательный вектор по ходу обхода в точке P */
  if(piece.seg) return unit(sub(piece.seg[1],piece.seg[0]));
  const r=unit(sub(P,piece.arc.c)); return piece.ccw?perp(r):mul(perp(r),-1);
}
function checkContour(pieces,eps=1e-6){
  const out=[];
  pieces.forEach((p,i)=>{ const q=pieces[(i+1)%pieces.length], a=p.seg?p.seg[1]:p.to, b=q.seg?q.seg[0]:q.from;
    if(!near(a,b,eps)) out.push({i,what:'разрыв контура',gap:dist(a,b)});
    else if(!p.corner){ const t1=tangentAt(p,a), t2=tangentAt(q,b); if(Math.abs(crs(t1,t2))>1e-5||dot(t1,t2)<0) out.push({i,what:'излом на стыке',deg:Math.atan2(crs(t1,t2),dot(t1,t2))*180/Math.PI}); }
    if(p.arc){ ['from','to'].forEach(k=>{ const e=Math.abs(dist(p[k],p.arc.c)-p.arc.r); if(e>eps) out.push({i,what:'точка не на дуге',err:e}); }); } });
  return out;
}
/* ── проверка построений: каждое требование «равно» с допуском 1e-7 мм ── */
function verify(cons){ return cons.checks.map(([what,a,b])=>({what,ok:Math.abs(a-b)<1e-7,err:a-b})); }

/* ── вариант: исполнение программы ──
   prog: {given:{имя: circ|line}, holes:[…], axes:[…], ops:[[имя, 'LL'|'LC'|'CC'|'PC'|'TT', аргументы…]], contour:[куски по именам]} */
function run(V){
  const S=Object.assign({},V.given), ops=[], steps=[];
  const ref=x=>typeof x==='string'?(x in S?S[x]:x.split('.').reduce((o,k)=>o&&o[k],S)):x;
  for(const op of V.ops){ const [name,kind,...a]=op; let c;
    if(kind==='LL') c=filletLL(ref(a[0]),ref(a[1]),a[2],a[3],a[4],a[5]);
    else if(kind==='LC') c=filletLC(ref(a[0]),ref(a[1]),a[2],a[3],a[4],a[5]);
    else if(kind==='CC') c=filletCC(ref(a[0]),ref(a[1]),a[2],a[3],a[4],a[5]);
    else if(kind==='PC') c=tangentPC(ref(a[0]),ref(a[1]),a[2]);
    else if(kind==='TT') c=tangentCC(ref(a[0]),ref(a[1]),a[2],a[3]);
    else throw new Error('неизвестное построение '+kind);
    c.name=name; c.title=op.title||V.titles&&V.titles[name]||''; S[name]=c; if(c.O) S[name+'.arc']=circ(c.O,c.R); ops.push(c); }
  const P=x=>{ if(Array.isArray(x)&&typeof x[0]==='number') return x;
    if(x&&x.xcc) return pick(xCC(ref(x.xcc[0]),ref(x.xcc[1])),x.hint);
    const [n,i]=x.split(':'); return S[n].T[+i]; };
  const mk=C=>C.map(k=>Object.assign(k.seg?{seg:[P(k.seg[0]),P(k.seg[1])]}:{arc:ref(k.arc),from:P(k.from),to:P(k.to),ccw:!!k.ccw},{corner:!!k.corner}));
  const contours=(V.contours||[V.contour]).map(mk), pieces=contours[0];
  const bad=[].concat(...contours.map((c,j)=>checkContour(c).map(b=>Object.assign(b,{contour:j})))), checks=ops.map(o=>({name:o.name,res:verify(o)}));
  return {S,ops,pieces,contours,bad,checks,ok:!bad.length&&checks.every(c=>c.res.every(r=>r.ok))};
}
const api={add,sub,mul,dot,crs,len,unit,perp,dist,line,lineDir,circ,offset,sideOf,foot,xLL,xLC,xCC,E,MODE,
  filletLL,filletLC,filletCC,tangentPC,tangentCC,checkContour,verify,run};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else { self.CONJ=api; }
})();
