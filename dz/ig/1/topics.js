/* ═══════════ Теория сопряжений в виде данных: темы g5–g13 программы PREPIG ═══════════
   Тема — не текст, а построение: make(rnd) → случайные исходные; build(p) → кадры [{cap, els}] (элементы core/conj.js);
   traps — та же задача с одной типичной ошибкой: build(p) → неверные кадры, say — одна фраза, hl — роли, которые отличаются.
   judge(p, frames) — независимая проверка результата определением (касание, гладкость, замкнутость): верный кадр проходит,
   ловушка — нет. Так «Смотри» (кадры по шагам) и «Проверка» (дуэль верного и неверного чертежа) строятся из одних данных,
   и ни одна картинка не нарисована руками. */
(function(){
const NODE=typeof module!=='undefined'&&module.exports;
const K=NODE?require('../../../core/conj.js'):self.CONJ, {E}=K;
const r1=x=>Math.round(x);
const ok=(x,y,e=1e-6)=>Math.abs(x-y)<e;
/* результат построения: последняя дуга/касательная — проверяем определением */
const tangentToLine=(L,O,R)=>ok(Math.abs(K.crs(L.d,K.sub(O,L.p))),R);
const tangentToCircle=(C,O,R,m)=>ok(K.dist(O,C.c),m==='ext'?R+C.r:m==='enc'?R-C.r:C.r-R);
const T={};

/* g5 — деление окружности на 6 (радиусом) и на 5 (построением) */
T.g5={make:rnd=>({R:r1(25+rnd()*15),n:rnd()<0.5?6:5}),
  build(p,{wrongR}={}){ const C=K.circ([0,0],p.R), F=[]; F.push({cap:'Окружность и её оси',els:[E.circle(C,'given'),E.seg([-p.R-4,0],[p.R+4,0],'aux'),E.seg([0,-p.R-4],[0,p.R+4],'aux')]});
    let pts=[];
    if(p.n===6){ const s=wrongR?p.R*0.93:p.R; let a=Math.PI/2; pts=[[0,p.R]];
      for(let i=1;i<6;i++){ const P=pts[i-1], cand=K.xCC(K.circ(P,s),C).sort((u,v)=>Math.atan2(v[1],v[0])-Math.atan2(u[1],u[0])); /* по часовой от верхней */
        const nx=cand.find(q=>K.dist(q,pts[Math.max(0,i-2)])>1e-6&&(i<2||K.dist(q,pts[i-2])>1e-6))||cand[0]; pts.push(nx); }
      F.push({cap:'Раствор циркуля = R: засечки по окружности от верхней точки',els:pts.map((q,i)=>E.circle(K.circ(q,s),'locus')).slice(0,3).concat(pts.map((q,i)=>E.pt(q,'tan',String(i+1))))}); }
    else { const A=[0,p.R], B=[p.R,0], M=[p.R/2,0], N=[-(Math.hypot(p.R/2,p.R)-p.R/2),0], a=K.dist(A,N)*(wrongR?0.95:1);
      F.push({cap:'Середина M правого радиуса',els:[E.pt(M,'center','M')]});
      F.push({cap:'Дуга из M радиусом MA — до горизонтальной оси: точка N',els:[E.circle(K.circ(M,K.dist(M,A)),'locus'),E.pt(N,'center','N')]});
      pts=[A]; for(let i=1;i<5;i++){ const q=K.xCC(K.circ(pts[i-1],a),C).sort((u,v)=>u[0]-v[0]); pts.push(i<3?q[0]:q[q.length-1]); }
      /* обход: от A засечками радиусом AN по кругу */
      pts=[A]; let ang=Math.PI/2; const step=2*Math.asin(a/(2*p.R)); for(let i=1;i<5;i++){ ang+=step; pts.push([p.R*Math.cos(ang),p.R*Math.sin(ang)]); }
      F.push({cap:'AN — сторона пятиугольника: засечки по окружности',els:[E.seg(A,N,'aux')].concat(pts.map((q,i)=>E.pt(q,'tan',String(i+1))))}); }
    F.push({cap:p.n===6?'Соединяем через одну — треугольник, подряд — шестиугольник':'Соединяем — правильный пятиугольник',
      els:pts.map((q,i)=>E.seg(q,pts[(i+1)%pts.length],'result'))});
    return {F,pts,C}; },
  judge:(p,r)=>{ const s=r.pts.map((q,i)=>K.dist(q,r.pts[(i+1)%r.pts.length])); return s.every(x=>ok(x,s[0],1e-6)); },
  traps:{R:{say:'Раствор циркуля не равен радиусу — многоугольник не замыкается',build:p=>T.g5.build(p,{wrongR:1}),hl:['tan','result']}}};

/* g6 — ГМТ центров: окружности радиуса R, касающиеся прямой, — центры на параллели; касающиеся окружности — на R ± r */
T.g6={make:rnd=>({R:r1(8+rnd()*6),r:r1(12+rnd()*10)}),
  build(p,{wrong}={}){ const L=K.lineDir([-50,0],[1,0]), C=K.circ([0,0],p.r), F=[];
    const d=wrong?p.R*1.6:p.R, xs=[-36,-24,-12];
    F.push({cap:'Прямая и окружность — данные',els:[E.line(L,'given'),E.circle(K.circ([40,-0],p.r),'given')]});
    F.push({cap:`Круги R${p.R}, касающиеся прямой`,els:xs.map(x=>E.circle(K.circ([x,p.R],p.R),'aux')).concat(xs.map(x=>E.pt([x,p.R],'center')))});
    F.push({cap:'Их центры — на параллели на расстоянии R',els:[E.line(K.offset(L,d,1),'locus')]});
    const cs=[0,1,2].map(i=>{ const a=0.5+i*0.6; return [40+(p.r+p.R)*Math.cos(a),(p.r+p.R)*Math.sin(a)]; });
    F.push({cap:'Касающиеся окружности снаружи — центры на окружности R + r',els:cs.map(c=>E.circle(K.circ(c,p.R),'aux')).concat([E.circle(K.circ([40,0],wrong?p.r+p.R*0.6:p.r+p.R),'locus')])});
    return {F,L,d}; },
  judge:(p,r)=>ok(r.d,p.R),
  traps:{D:{say:'Параллель проведена не на расстоянии R — центры на ней не дают касания',build:p=>T.g6.build(p,{wrong:1}),hl:['locus']}}};

/* g7 — точка касания: перпендикуляр из центра к прямой; на линии центров для двух окружностей */
T.g7={make:rnd=>({R:r1(10+rnd()*8),a:(rnd()-0.5)*0.6}),
  build(p,{wrong}={}){ const L=K.lineDir([-40,-20],[Math.cos(p.a),Math.sin(p.a)]), O=K.add(K.foot(L,[0,0]),K.mul(K.perp(L.d),p.R));
    const T1=wrong?K.add(K.foot(L,O),K.mul(L.d,p.R*0.45)):K.foot(L,O), F=[];
    F.push({cap:'Прямая и центр дуги O',els:[E.line(L,'given'),E.pt(O,'center','O')]});
    F.push({cap:'Перпендикуляр из O к прямой — точка касания',els:[E.seg(O,T1,'aux'),E.pt(T1,'tan','T')]});
    const C2=K.circ(K.add(O,[p.R+14,6]),14), u=K.unit(K.sub(C2.c,O)), T2=wrong?K.add(O,K.mul(K.unit(K.add(u,[0,0.4])),p.R)):K.add(O,K.mul(u,p.R));
    F.push({cap:'Две окружности: точка касания — на линии центров',els:[E.circle(C2,'given'),E.seg(O,C2.c,'aux'),E.pt(T2,'tan','T₂')]});
    F.push({cap:'Дуга — от точки касания до точки касания',els:[E.arc(O,p.R,T1,T2,false,'result')]});
    return {F,L,O,T1,T2,C2}; },
  judge:(p,r)=>ok(K.dot(K.sub(r.T1,r.O),r.L.d),0)&&ok(Math.abs(K.crs(K.sub(r.T2,r.O),K.sub(r.C2.c,r.O))),0),
  traps:{F:{say:'Точку касания взяли «на глаз», не перпендикуляром — на стыке излом',build:p=>T.g7.build(p,{wrong:1}),hl:['tan','aux']}}};

/* g8 — касательная из точки к окружности */
T.g8={make:rnd=>({r:r1(12+rnd()*10),d:r1(45+rnd()*20),k:rnd()<0.5?1:-1}),
  build(p,{wrong}={}){ const C=K.circ([0,0],p.r), P=[p.d,0], F=[{cap:'Окружность и точка A вне её',els:[E.circle(C,'given'),E.pt(P,'given','A')]}];
    if(wrong){ const G=K.circ(P,p.d), T=K.xCC(G,C).filter(q=>q[1]*p.k>0)[0]||[0,p.r*p.k];
      F.push({cap:'Вспомогательная окружность радиусом OA',els:[E.circle(G,'locus')]}); F.push({cap:'Касательная',els:[E.pt(T,'tan','T'),E.seg(P,T,'result')]}); return {F,P,T,C}; }
    const t=K.tangentPC(P,C,[0,p.r*p.k]); t.steps.forEach(s=>F.push({cap:s.cap,els:s.els})); return {F,P,T:t.T[0],C}; },
  judge:(p,r)=>ok(K.dot(K.sub(r.T,r.P),K.sub(r.T,r.C.c)),0,1e-6)&&ok(K.dist(r.T,r.C.c),r.C.r),
  traps:{D:{say:'Вспомогательная окружность — радиусом OA, а нужно на OA как на диаметре',build:p=>T.g8.build(p,{wrong:1}),hl:['locus','tan','result']}}};

/* g9 — общая касательная двух окружностей: внешняя (R − r) и внутренняя (R + r) */
T.g9={make:rnd=>({R:r1(16+rnd()*8),r:r1(7+rnd()*6),d:r1(55+rnd()*15),k:rnd()<0.5?'outer':'inner'}),
  build(p,{wrong}={}){ const A=K.circ([0,0],p.R), B=K.circ([p.d,0],p.r), F=[{cap:'Две окружности',els:[E.circle(A,'given'),E.circle(B,'given')]}];
    const kind=wrong?(p.k==='outer'?'inner':'outer'):p.k, t=K.tangentCC(A,B,kind,[0,p.R]);
    t.steps.forEach(s=>F.push({cap:s.cap,els:s.els})); return {F,T:t.T,A,B,kind}; },
  /* внешняя — центры по одну сторону касательной, внутренняя — по разные */
  judge:(p,r)=>{ const d=K.sub(r.T[1],r.T[0]), s1=Math.sign(K.crs(d,K.sub(r.A.c,r.T[0]))), s2=Math.sign(K.crs(d,K.sub(r.B.c,r.T[0]))); return (s1===s2)===(p.k==='outer'); },
  traps:{K:{say:'Перепутали: для внешней касательной — R − r, для внутренней — R + r',build:p=>T.g9.build(p,{wrong:1}),hl:['locus','tan','result']}}};

/* g10 — сопряжение двух прямых */
T.g10={make:rnd=>({R:r1(10+rnd()*10),a:0.6+rnd()*1.6}),
  build(p,{wrong}={}){ const L1=K.lineDir([-50,0],[1,0]), L2=K.lineDir([0,0],[Math.cos(p.a),Math.sin(p.a)]);
    const f=K.filletLL(L1,L2,p.R,1,-1,[10,p.R]), F=[{cap:'Две прямые и радиус R'+p.R,els:[E.line(L1,'given'),E.line(L2,'given')]}];
    f.steps.forEach(s=>F.push({cap:s.cap,els:s.els}));
    const T2=wrong?K.add(f.T[1],K.mul(L2.d,p.R*1.1)):f.T[1];
    F.push({cap:'Дуга от точки касания до точки касания',els:[E.arc(f.O,p.R,f.T[0],T2,true,'result')]}); return {F,O:f.O,L1,L2,T2}; },
  judge:(p,r)=>tangentToLine(r.L1,r.O,p.R)&&tangentToLine(r.L2,r.O,p.R)&&ok(K.dist(r.T2,r.O),p.R),
  traps:{T:{say:'Дугу довели «до глаза», без перпендикуляра — не та точка касания',build:p=>T.g10.build(p,{wrong:1}),hl:['result']}}};

/* g11 — сопряжение прямой и окружности: внешнее (R + r) и внутреннее (R − r) */
T.g11={make:rnd=>({R:r1(12+rnd()*8),r:r1(8+rnd()*6),m:rnd()<0.5?'ext':'enc',h:r1(14+rnd()*8)}),
  build(p,{wrong}={}){ const m=p.m==='enc'&&p.R<=p.r?'ext':p.m, L=K.lineDir([-60,0],[1,0]), C=K.circ([10,p.h+p.r*(m==='enc'?-0.2:1)],p.r);
    const use=wrong?(m==='ext'?'enc':'ext'):m; let f; try{ f=K.filletLC(L,C,m==='enc'?Math.max(p.R,p.r+6):p.R,1,use,[0,p.R]); }catch(e){ return null; }
    const F=[{cap:'Прямая, окружность и радиус R',els:[E.line(L,'given'),E.circle(C,'given')]}];
    f.steps.forEach(s=>F.push({cap:s.cap,els:s.els})); F.push({cap:'Дуга сопряжения',els:[E.arc(f.O,f.R,f.T[0],f.T[1],use!=='ext','result')]});
    return {F,f,m,use,C}; },
  judge:(p,r)=>!!r&&ok(K.dist(r.f.O,r.C.c),r.m==='ext'?r.f.R+r.C.r:r.f.R-r.C.r),
  traps:{S:{say:'Перепутан знак: внешнее — R + r, внутреннее — R − r',build:p=>T.g11.build(p,{wrong:1}),hl:['locus','center','tan','result']}}};

/* g12 — сопряжение двух окружностей: внешнее, внутреннее, смешанное */
T.g12={make:rnd=>({r1:r1(10+rnd()*6),r2:r1(8+rnd()*6),d:r1(48+rnd()*12),m:['ext','enc','mix'][Math.floor(rnd()*3)]}),
  build(p,{wrong}={}){ const A=K.circ([0,0],p.r1), B=K.circ([p.d,0],p.r2);
    const M={ext:['ext','ext',14],enc:['enc','enc',p.d],mix:['enc','ext',Math.round(p.d*0.75)]}[p.m], W={ext:['enc','enc',M[2]+p.d],enc:['ext','ext',M[2]],mix:['ext','enc',M[2]]}[p.m];
    const [m1,m2,R]=wrong?W:M; let f; try{ f=K.filletCC(A,B,R,m1,m2,[p.d/2,40]); }catch(e){ return null; }
    const F=[{cap:'Две окружности и радиус R'+r1(R),els:[E.circle(A,'given'),E.circle(B,'given')]}];
    f.steps.forEach(s=>F.push({cap:s.cap,els:s.els})); F.push({cap:'Дуга сопряжения',els:[E.arc(f.O,R,f.T[0],f.T[1],!(m1==='ext'&&m2==='ext'),'result')]});
    return {F,O:f.O,R,A,B,want:M.slice(0,2)}; },
  judge:(p,r)=>{ if(!r) return false; const d=(m,C)=>m==='ext'?r.R+C.r:r.R-C.r; return ok(K.dist(r.O,r.A.c),d(r.want[0],r.A))&&ok(K.dist(r.O,r.B.c),d(r.want[1],r.B)); },
  traps:{M:{say:'Перепутали вид сопряжения: внешнее — R + r, внутреннее — R − r, смешанное — по одному каждого',build:p=>T.g12.build(p,{wrong:1}),hl:['locus','center','tan','result']}}};

/* g13 — контур с сопряжениями: весь вариант по шагам (берём вариант задания) */
T.g13={make:rnd=>({n:1}),
  build(p,{wrong}={}){ const IG1=NODE?require('./variants.js'):self.IG1, V=JSON.parse(JSON.stringify(IG1.V[p.n]));
    const R=K.run(V), F=R.ops.flatMap(o=>o.steps.map(s=>({cap:o.title+' · '+s.cap,els:s.els})));
    let C=R.contours[0];
    if(wrong){ const i=C.findIndex(q=>q.arc&&q.arc.r<15); C=C.map((q,j)=>j===i?Object.assign({},q,{arc:{c:q.arc.c,r:q.arc.r+6}}):q); }   /* дугу обвели не тем раствором циркуля */
    F.push({cap:'Обводка: дуги от точки касания до точки касания, потом прямые',els:C.map(q=>q.seg?E.seg(q.seg[0],q.seg[1],'result'):E.arc(q.arc.c,q.arc.r,q.from,q.to,q.ccw,'result'))});
    return {F,R,bad:K.checkContour(C)}; },
  judge:(p,r)=>r.R.ok&&!r.bad.length,
  traps:{R:{say:'Дугу сопряжения обвели не тем радиусом — на стыках ступеньки',build:p=>T.g13.build(p,{wrong:1}),hl:['result']}}};

const api={T,ids:Object.keys(T)};
if(NODE) module.exports=api; else self.IG1T=api;
})();
