/* ═══════════ PREP · плоскость, прямая и плоскость, частное положение (РК1, ДЗ №1–3) ═══════════
   π₂ над осью (Y = −z), π₁ под осью (Y = y). Ж — учебник Жирных и др., М — методичка к ДЗ. */
(function(){
'use strict';
if(!self.PREP) return;
const rnd=(a,b)=>a+Math.random()*(b-a), sgn=()=>Math.random()<.5?-1:1, D=Math.PI/180;
const L=(role,c,x1,y1,x2,y2,o)=>Object.assign({t:'line',role,c,a:[x1,y1,x2,y2]},o||{});
const Pt=(role,x,y,lab,side,o)=>Object.assign({t:'pt',role,a:[x,y],lab,side:side||1},o||{});
const PL=(role,c,p,o)=>Object.assign({t:'poly',role,c,p},o||{});
const Tx=(role,x,y,s,anchor)=>({t:'txt',role,c:'tx',a:[x,y],s,anchor});
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mul=(a,k)=>[a[0]*k,a[1]*k], dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const len=a=>Math.hypot(a[0],a[1]), nrm=a=>{ const l=len(a); return [a[0]/l,a[1]/l]; }, rot=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
const far=(p,q,m)=>Math.hypot(p[0]-q[0],p[1]-q[1])>=m;
const ptOf=(S,role)=>{ const e=S.E.find(x=>x.role===role&&x.t==='pt'); return e?e.a:null; };
const f2=p=>[p[0],-p[2]], h1=p=>[p[0],p[1]];
const lerp=(A,B,t)=>A.map((v,i)=>v+(B[i]-v)*t);
function bbox(pts,m){ const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]); m=m||12; return [Math.min(...xs)-m,Math.min(...ys)-m,Math.max(...xs)-Math.min(...xs)+2*m,Math.max(...ys)-Math.min(...ys)+2*m]; }
function lineX(a,b){ const [x1,y1,x2,y2]=a,[x3,y3,x4,y4]=b, d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4); if(Math.abs(d)<1e-9) return null;
  const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d, s=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/d; return [x1+t*(x2-x1),y1+t*(y2-y1),t,s]; }
/* точка на отрезке PQ (3D) с заданным x */
const atX=(P,Q,x)=>lerp(P,Q,(x-P[0])/(Q[0]-P[0]));
function tri(){
  for(let t=0;t<400;t++){
    const A=[rnd(-48,-28),rnd(10,48),rnd(10,50)], B=[rnd(-8,10),rnd(10,48),rnd(10,50)], C=[rnd(28,48),rnd(10,48),rnd(10,50)];
    const ar1=Math.abs((B[0]-A[0])*(C[1]-A[1])-(C[0]-A[0])*(B[1]-A[1])), ar2=Math.abs((B[0]-A[0])*(C[2]-A[2])-(C[0]-A[0])*(B[2]-A[2]));
    if(ar1<450||ar2<450) continue; return {A,B,C};
  }
}
function triBase(V,skip){ const {A,B,C}=V, a2=f2(A),b2=f2(B),c2=f2(C),a1=h1(A),b1=h1(B),c1=h1(C); const r=[];
  r.push(PL('','o',[a2,b2,c2,a2]),PL('','o',[a1,b1,c1,a1]),L('','lk',a2[0],a2[1],a1[0],a1[1]),L('','lk',b2[0],b2[1],b1[0],b1[1]),L('','lk',c2[0],c2[1],c1[0],c1[1]),
    Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:.9}),Pt('',b2[0],b2[1],'B″',1,{c:'o',r:.9}),Pt('',c2[0],c2[1],'C″',1,{c:'o',r:.9}),
    Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:.9}),Pt('',b1[0],b1[1],'B′',1,{c:'o',r:.9}),Pt('',c1[0],c1[1],'C′',1,{c:'o',r:.9}));
  return r; }
const triPts=V=>['A','B','C'].flatMap(k=>[f2(V[k]),h1(V[k])]);
/* точка 1 на BC с той же высотой (для горизонтали через A) или той же глубиной (для фронтали) */
const onBC=(V,k,val)=>{ const {B,C}=V, t=(val-B[k])/(C[k]-B[k]); return t>0.05&&t<0.95?lerp(B,C,t):null; };

/* ══ s1 · положения плоскости: проецирующая — одна проекция в прямую; уровня — ещё и ∥ x ══ */
const PT={hp:'горизонтально-проецирующая',fp:'фронтально-проецирующая',hl:'горизонтальная (∥ π₁)',fl:'фронтальная (∥ π₂)'};
function planeOf(kind){ const xs=[rnd(-45,-25),rnd(-8,8),rnd(25,45)], a=rnd(15,40), b=rnd(-.5,.5);
  const P=xs.map(x=>[x,rnd(10,48),rnd(10,48)]);
  if(kind==='hp') P.forEach(p=>p[1]=a+b*p[0]); if(kind==='fp') P.forEach(p=>p[2]=a+b*p[0]);
  if(kind==='hl'){ const z=rnd(15,40); P.forEach(p=>p[2]=z); } if(kind==='fl'){ const y=rnd(15,40); P.forEach(p=>p[1]=y); }
  return P; }
PREP.topic('s1',{
  make(){ const kinds=Object.keys(PT), kind=kinds[Math.random()*4|0], tw={hp:'fp',fp:'hp',hl:'fl',fl:'hl'}[kind]; return {kind,P:planeOf(kind),W:planeOf(tw)}; },
  watch:{steps:[{cap:'Положение плоскости — по её проекциям',roles:['t2','t1']}]},
  scene(V,trap){ const P=trap==='Sw'?V.W:V.P, p2=P.map(f2), p1=P.map(h1);
    const E=[PL('t2','o',p2.concat([p2[0]])),PL('t1','o',p1.concat([p1[0]]))];
    const base=P.map((p,i)=>L('','lk',p2[i][0],p2[i][1],p1[i][0],p1[i][1])).concat([Tx('',-55,-56,PT[V.kind])]);
    return {box:bbox(p2.concat(p1,[[-58,-58],[50,0]])),axis:0,base,E}; },
  traps:{Sw:{b0:.2,say:'Проецирующая — в прямую на той плоскости, которой ⟂; уровня — вторая проекция ∥ x',src:'Ж §15',hl:['t2','t1']}}
});

/* ══ s2 · точка в плоскости: через неё — прямая плоскости (A1), K′ — по линии связи на A′1′ ══ */
PREP.topic('s2',{
  make(){ for(let i=0;i<80;i++){ const V=tri(); const u=rnd(.3,.7), P1=lerp(V.B,V.C,u), K=lerp(V.A,P1,rnd(.35,.7)); V.K=K; if(this.scene(V,null)) return V; } return null; },
  watch:{steps:[{cap:'Через A″ и K″ — прямая до B″C″: точка 1″',roles:['a1f','p1f']},{cap:'1′ — по линии связи на B′C′; прямая A′1′',roles:['a1f','p1f','l1','p1h','a1h']},{cap:'K′ — на линии связи, на A′1′',roles:['a1f','p1f','l1','p1h','a1h','lk','K1']}]},
  scene(V,trap){ const {A,B,C,K}=V, a2=f2(A), k2=f2(K);
    const X=lineX([a2[0],a2[1],k2[0],k2[1]],[...f2(B),...f2(C)]); if(!X||X[3]<0||X[3]>1) return null; const p2=[X[0],X[1]];
    const side=trap==='Ed'?[A,C]:[B,C]; const P=atX(side[0],side[1],p2[0]); const tt=(p2[0]-side[0][0])/(side[1][0]-side[0][0]); if(tt<0||tt>1) return null; const p1=h1(P);
    let line=[h1(A),p1]; if(trap==='Ln') line=[h1(A),h1(B)];
    let kx=k2[0]; if(trap==='Lk') kx+=sgn()*rnd(8,11);
    const w=(kx-line[0][0])/(line[1][0]-line[0][0]); const k1=[kx,line[0][1]+(line[1][1]-line[0][1])*w];
    const E=[L('a1f','a',a2[0],a2[1],p2[0],p2[1]),Pt('p1f',p2[0],p2[1],'1″',1,{c:'o'}),L('l1','lk',p2[0],p2[1],p1[0],p1[1]),Pt('p1h',p1[0],p1[1],'1′',1,{c:'o'}),
      L('a1h','a',line[0][0],line[0][1],(trap==='Ln'?line[1]:p1)[0],(trap==='Ln'?line[1]:p1)[1]),L('lk','lk',k2[0],k2[1],k1[0],k1[1]),Pt('K1',k1[0],k1[1],'K′',-1)];
    return {box:bbox(triPts(V).concat([k2,k1,[-55,0],[55,0]])),axis:0,base:triBase(V).concat([Pt('',k2[0],k2[1],'K″',-1,{c:'o'})]),E}; },
  fair(V,k,ok,bad){ return far(ptOf(ok,'K1'),ptOf(bad,'K1'),4); },
  traps:{
    Lk:{b0:-1.2,say:'K′ — на линии связи с K″',src:'Ж §16',hl:['lk','K1']},
    Ln:{b0:.2,say:'K′ — на прямой A′1′, через которую строили',src:'Ж §16',hl:['a1h','lk','K1']},
    Ed:{b0:.6,say:'1′ — на той же стороне B′C′, не на A′C′',src:'Ж §16',hl:['l1','p1h','a1h','lk','K1']}}
});

/* ══ s3 · горизонталь: h″ ∥ x, h′ — по точке на B′C′; фронталь: f′ ∥ x, f″ — по точке на B″C″ ══ */
PREP.topic('s3',{
  make(){ for(let i=0;i<80;i++){ const V=tri(); if(onBC(V,2,V.A[2])&&onBC(V,1,V.A[1])&&this.scene(V,null)) return V; } return null; },
  watch:{steps:[{cap:'Горизонталь: h″ ∥ x через A″ до B″C″ — точка 1″',roles:['h2','p1f']},{cap:'1′ на B′C′ — h′ = A′1′',roles:['h2','p1f','l1','p1h','h1']},{cap:'Фронталь: f′ ∥ x через A′, f″ = A″2″',roles:['h2','p1f','l1','p1h','h1','f1','p2h','l2','p2f','f2']}]},
  scene(V,trap){ const {A}=V; const P=onBC(V,2,A[2]), Q=onBC(V,1,A[1]); if(!P||!Q) return null;
    const a2=f2(A),a1=h1(A); let p2=f2(P), p1=h1(P), q1=h1(Q), q2=f2(Q);
    if(trap==='Sw'){ /* перепутали: провели h′ ∥ x (это фронталь) и назвали горизонталью */ p1=q1; p2=q2; }
    if(trap==='Pt'){ const W=atX(V.A,V.C,p2[0]); if((p2[0]-V.A[0])*(p2[0]-V.C[0])>0) return null; p1=h1(W); }
    const E=[L('h2','a',a2[0],a2[1],p2[0],p2[1]),Pt('p1f',p2[0],p2[1],'1″',1,{c:'o'}),L('l1','lk',p2[0],p2[1],p1[0],p1[1]),Pt('p1h',p1[0],p1[1],'1′',1,{c:'o'}),L('h1','a',a1[0],a1[1],p1[0],p1[1]),
      Tx('h2',p2[0]+1,p2[1]-1.5,'h″'),Tx('h1',p1[0]+1,p1[1]+4,'h′'),
      L('f1','c',a1[0],a1[1],q1[0],q1[1]),Pt('p2h',q1[0],q1[1],'2′',1,{c:'o'}),L('l2','lk',q1[0],q1[1],q2[0],q2[1]),Pt('p2f',q2[0],q2[1],'2″',1,{c:'o'}),L('f2','c',a2[0],a2[1],q2[0],q2[1])];
    return {box:bbox(triPts(V).concat([[-55,0],[55,0]])),axis:0,base:triBase(V),E}; },
  fair(V,k,ok,bad){ return far(ptOf(ok,'p1h'),ptOf(bad,'p1h'),4); },
  traps:{
    Pt:{b0:.2,say:'1′ — на той же стороне B′C′, что и 1″',src:'Ж §17',hl:['l1','p1h','h1']},
    Sw:{b0:.5,say:'У горизонтали параллельна оси x фронтальная проекция h″',src:'Ж §17, рис. 76–78',hl:['h2','p1f','l1','p1h','h1']}}
});

/* ══ s5a · линия наибольшего наклона к π₁: m′ ⟂ h′ ══  s5b · угол α — в треугольнике на m′ с катетом Δz ══ */
function lnn(V,trap){
  const {A,B}=V, P=onBC(V,2,A[2]); if(!P) return null; const a1=h1(A), p1=h1(P), eh=nrm(sub(p1,a1));
  let d=[-eh[1],eh[0]]; if(trap==='Sd'){ const s=nrm(sub(h1(V.C),a1)); d=[-s[1],s[0]]; }
  const b1=h1(B); const X=lineX([b1[0],b1[1],b1[0]+d[0],b1[1]+d[1]],[a1[0],a1[1],p1[0],p1[1]]); if(!X) return null;
  const M1=[X[0],X[1]], tM=X[3]; if(tM<-.3||tM>1.3) return null;
  return {P,a1,p1,b1,M1,M2:[M1[0],-A[2]]};
}
PREP.topic('s5a',{
  make(){ for(let i=0;i<80;i++){ const V=tri(); if(V&&Math.abs(V.B[2]-V.A[2])>12&&this.scene(V,null)) return V; } return null; },
  watch:{steps:[{cap:'Горизонталь h плоскости',roles:['h2','h1']},{cap:'Из B′ — перпендикуляр к h′: m′. Прямой угол виден на π₁',roles:['h2','h1','m1','M1']},{cap:'M″ — на h″ по линии связи; m″ = B″M″',roles:['h2','h1','m1','M1','lm','M2','m2']}]},
  scene(V,trap){ const r=lnn(V,trap); if(!r) return null; const a2=f2(V.A), p2=f2(r.P), b2=f2(V.B);
    let M2=r.M2; if(trap==='Lk') M2=[r.M1[0]+sgn()*rnd(8,11),-V.A[2]];
    const E=[L('h2','a',a2[0],a2[1],p2[0],p2[1]),L('h1','a',r.a1[0],r.a1[1],r.p1[0],r.p1[1]),L('m1','d',r.b1[0],r.b1[1],r.M1[0],r.M1[1]),Pt('M1',r.M1[0],r.M1[1],'M′',1,{c:'o'}),
      L('lm','lk',r.M1[0],r.M1[1],M2[0],M2[1]),Pt('M2',M2[0],M2[1],'M″',1,{c:'o'}),L('m2','d',b2[0],b2[1],M2[0],M2[1])];
    return {box:bbox(triPts(V).concat([r.M1,M2,[-55,0],[55,0]])),axis:0,base:triBase(V),E}; },
  fair(V,k,ok,bad){ return far(ptOf(ok,'M1'),ptOf(bad,'M1'),4)||far(ptOf(ok,'M2'),ptOf(bad,'M2'),4); },
  traps:{
    Lk:{b0:-1.2,say:'M″ — на линии связи с M′',src:'Ж §17',hl:['lm','M2','m2']},
    Sd:{b0:.5,say:'m′ ⟂ горизонтали h′, а не стороне',src:'Ж §17, рис. 83–86',hl:['m1','M1','lm','M2','m2']}}
});
PREP.topic('s5b',{
  make(){ for(let i=0;i<80;i++){ const V=tri(); if(V&&Math.abs(V.B[2]-V.A[2])>12&&this.scene(V,null)) return V; } return null; },
  watch:{steps:[{cap:'Линия наибольшего наклона BM: m′ ⟂ h′',roles:['m1']},{cap:'На m′ — треугольник: катет Δz в B′',roles:['m1','leg','hyp']},{cap:'Угол при M′ — угол наклона плоскости к π₁',roles:['m1','leg','hyp','arc']}]},
  scene(V,trap){ const r=lnn(V,null); if(!r) return null;
    const u=nrm(sub(r.b1,r.M1)); let n=[-u[1],u[0]]; let dz=Math.abs(V.B[2]-V.A[2]); if(trap==='Dy') dz=Math.abs(V.B[1]-r.M1[1]);
    const B0=add(r.b1,mul(n,dz)), at=trap==='Ab'?B0:r.M1, p=trap==='Ab'?r.M1:r.b1, q=trap==='Ab'?r.b1:B0;
    const a0=Math.atan2(p[1]-at[1],p[0]-at[0]), a1=Math.atan2(q[1]-at[1],q[0]-at[0]); let d=a1-a0; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI;
    const arc=Array.from({length:13},(_,i)=>[at[0]+10*Math.cos(a0+d*i/12),at[1]+10*Math.sin(a0+d*i/12)]);
    const E=[L('m1','d',r.b1[0],r.b1[1],r.M1[0],r.M1[1]),L('leg','a',r.b1[0],r.b1[1],B0[0],B0[1]),L('hyp','crv',r.M1[0],r.M1[1],B0[0],B0[1]),PL('arc','c',arc),Tx('arc',at[0]+14*Math.cos(a0+d/2),at[1]+14*Math.sin(a0+d/2)+2,'α')];
    const base=triBase(V).concat([L('','a',...f2(V.A),...f2(r.P)),L('','a',...r.a1,...r.p1),Pt('',r.M1[0],r.M1[1],'M′',1,{c:'o'})]);
    return {box:bbox(triPts(V).concat([B0,[-55,0],[55,0]])),axis:0,base,E}; },
  fair(V,k){ if(k!=='Dy') return true; const r=lnn(V,null); return !!r&&Math.abs(Math.abs(V.B[2]-V.A[2])-Math.abs(V.B[1]-r.M1[1]))>5; },
  traps:{
    Ab:{b0:.1,say:'α — при M′, против катета Δz',src:'Ж с. 48',hl:['arc']},
    Dy:{b0:.6,say:'Катет — Δz (с π₂): угол к π₁',src:'Ж с. 48; М с. 8–9',hl:['leg','hyp','arc']}}
});

/* ══ s6 · достроить проекцию плоской фигуры: D″ — через точку пересечения диагоналей ══ */
PREP.topic('s6',{
  make(){ for(let i=0;i<120;i++){ const V=tri(); if(!V) continue; const {A,B,C}=V; const D3=lerp(lerp(A,C,rnd(.35,.65)),B,-rnd(.5,.9)); V.Dd=D3;
    if(D3[1]<6||D3[2]<6) continue; if(this.scene(V,null)) return V; } return null; },
  watch:{steps:[{cap:'Диагонали на π₁: K′ = A′C′ ∩ B′D′',roles:['dg1','dg2','K1']},{cap:'K″ — на A″C″ по линии связи',roles:['dg1','dg2','K1','lk','K2','dg3']},{cap:'B″K″ до линии связи D′ — точка D″',roles:['dg1','dg2','K1','lk','K2','dg3','dg4','D2']}]},
  scene(V,trap){ const {A,B,C,Dd}=V, a1=h1(A),b1=h1(B),c1=h1(C),d1=h1(Dd),a2=f2(A),b2=f2(B),c2=f2(C);
    const X=lineX([...a1,...c1],[...b1,...d1]); if(!X||X[2]<0||X[2]>1||X[3]<0||X[3]>1) return null; const K1=[X[0],X[1]];
    let K2=[K1[0],-(A[2]+(C[2]-A[2])*X[2])]; let D2;
    if(trap==='Pg'){ D2=add(a2,sub(c2,b2)); }   /* «достроили параллелограммом» */
    else { const Y=lineX([...b2,...K2],[d1[0],-100,d1[0],100]); D2=[Y[0],Y[1]]; }
    if(trap==='Lk'){ const Y=lineX([...b2,...K2],[d1[0]+sgn()*rnd(8,11),-100,d1[0]+0.001,100]); D2=[Y[0],Y[1]]; }
    const E=[L('dg1','a',...a1,...c1),L('dg2','a',...b1,...d1),Pt('K1',K1[0],K1[1],'K′',1,{c:'o'}),L('lk','lk',...K1,...K2),Pt('K2',K2[0],K2[1],'K″',1,{c:'o'}),L('dg3','a',...a2,...c2),L('dg4','a',...b2,...D2),Pt('D2',D2[0],D2[1],'D″',1)];
    const base=triBase(V).concat([L('','o',...a1,...d1),L('','o',...c1,...d1),Pt('',d1[0],d1[1],'D′',-1,{c:'o',r:.9}),L('','lk',d1[0],d1[1],d1[0],-5)]);
    return {box:bbox(triPts(V).concat([d1,D2,[-55,0],[55,0]])),axis:0,base,E}; },
  fair(V,k,ok,bad){ return far(ptOf(ok,'D2'),ptOf(bad,'D2'),4); },
  traps:{
    Lk:{b0:-1,say:'D″ — на линии связи с D′',src:'Ж §16',hl:['dg4','D2']},
    Pg:{b0:.5,say:'Фигура не параллелограмм — D″ через пересечение диагоналей',src:'Ж §16',hl:['dg4','D2']}}
});

/* ══ m1 · прямая ∥ плоскости: параллельна прямой этой плоскости (на обеих проекциях — одной и той же) ══ */
PREP.topic('m1',{
  make(){ for(let i=0;i<80;i++){ const V=tri(); if(!V) continue; V.Dp=[rnd(-15,15),rnd(48,60),rnd(52,62)]; V.u=rnd(.3,.7); if(this.scene(V,null)) return V; } return null; },
  watch:{steps:[{cap:'Прямая плоскости: A1, где 1 на BC',roles:['a1f','a1h','p1f','p1h']},{cap:'Через D: d″ ∥ A″1″ и d′ ∥ A′1′ — одна и та же прямая плоскости',roles:['a1f','a1h','p1f','p1h','d2','d1']}]},
  scene(V,trap){ const {A,B,C,Dp}=V, P=lerp(B,C,V.u), a2=f2(A),a1=h1(A),p2=f2(P),p1=h1(P),d2=f2(Dp),d1=h1(Dp);
    let u2=nrm(sub(p2,a2)), u1=nrm(sub(p1,a1)); if(trap==='Mx'){ u1=nrm(sub(h1(B),a1)); }
    const E=[L('a1f','a',...a2,...p2),L('a1h','a',...a1,...p1),Pt('p1f',p2[0],p2[1],'1″',1,{c:'o'}),Pt('p1h',p1[0],p1[1],'1′',1,{c:'o'}),
      L('d2','d',d2[0]-u2[0]*28,d2[1]-u2[1]*28,d2[0]+u2[0]*28,d2[1]+u2[1]*28),L('d1','d',d1[0]-u1[0]*28,d1[1]-u1[1]*28,d1[0]+u1[0]*28,d1[1]+u1[1]*28)];
    const base=triBase(V).concat([L('','lk',...d2,...d1),Pt('',d2[0],d2[1],'D″',-1,{c:'o',r:1}),Pt('',d1[0],d1[1],'D′',-1,{c:'o',r:1}),L('','lk',...p2,...p1)]);
    return {box:bbox(triPts(V).concat([d1,d2,[d1[0]+u1[0]*28,d1[1]+u1[1]*28],[d1[0]-u1[0]*28,d1[1]-u1[1]*28],[d2[0]-u2[0]*28,d2[1]-u2[1]*28],[d2[0]+u2[0]*28,d2[1]+u2[1]*28],[-55,0],[55,0]])),axis:0,base,E}; },
  fair(V,k,ok,bad){ const a=ok.E.find(e=>e.role==='d1').a, b=bad.E.find(e=>e.role==='d1').a; const ang=Math.abs(Math.atan2(a[3]-a[1],a[2]-a[0])-Math.atan2(b[3]-b[1],b[2]-b[0]))%Math.PI; return Math.min(ang,Math.PI-ang)>10*D; },
  traps:{Mx:{b0:.4,say:'d′ и d″ — параллельны проекциям одной и той же прямой плоскости',src:'Ж §18',hl:['d1']}}
});

/* ══ m3 · плоскость ⟂ прямой l через точку: h′ ⟂ l′ (h″ ∥ x), f″ ⟂ l″ (f′ ∥ x) ══ */
PREP.topic('m3',{
  make(){ for(;;){ const A=[rnd(-45,-25),rnd(10,30),rnd(10,25)], B=[rnd(-5,10),rnd(30,50),rnd(35,50)], K=[rnd(15,35),rnd(20,40),rnd(20,40)]; if(Math.abs(B[1]-A[1])>12&&Math.abs(B[2]-A[2])>12) return {A,B,K}; } },
  watch:{steps:[{cap:'Горизонталь плоскости: h″ ∥ x, h′ ⟂ l′',roles:['h2','h1']},{cap:'Фронталь: f′ ∥ x, f″ ⟂ l″',roles:['h2','h1','f1','f2']}]},
  scene(V,trap){ const {A,B,K}=V, l2=nrm(sub(f2(B),f2(A))), l1=nrm(sub(h1(B),h1(A))), k2=f2(K), k1=h1(K);
    let hd=[-l1[1],l1[0]], fd=[-l2[1],l2[0]];
    if(trap==='Hp') hd=rot(hd,sgn()*rnd(14,20)*D);
    if(trap==='Sw'){ fd=[1,0]; }   /* f″ провели ∥ x (как у горизонтали) */
    const S=(P,d,r)=>[P[0]-d[0]*r,P[1]-d[1]*r,P[0]+d[0]*r,P[1]+d[1]*r];
    const E=[L('h2','a',...S(k2,[1,0],24)),L('h1','a',...S(k1,hd,24)),L('f1','c',...S(k1,[1,0],24)),L('f2','c',...S(k2,fd,24)),Tx('h1',k1[0]+hd[0]*24+1,k1[1]+hd[1]*24+3,'h′'),Tx('f2',k2[0]+fd[0]*24+1,k2[1]+fd[1]*24-1,'f″')];
    const a2=f2(A),b2=f2(B),a1=h1(A),b1=h1(B);
    const base=[L('','d',...a2,...b2),L('','d',...a1,...b1),Tx('',b2[0]+1,b2[1]-1.5,'l″'),Tx('',b1[0]+1,b1[1]+4,'l′'),L('','lk',...k2,...k1),Pt('',k2[0],k2[1],'K″',-1,{c:'o',r:1}),Pt('',k1[0],k1[1],'K′',-1,{c:'o',r:1})];
    return {box:bbox([a2,b2,a1,b1,[k2[0]-26,k2[1]-26],[k2[0]+26,k2[1]+26],[k1[0]-26,k1[1]+26],[k1[0]+26,k1[1]-26],[-55,0],[55,0]]),axis:0,base,E}; },
  traps:{
    Hp:{b0:-.3,say:'h′ ⟂ l′ — проверь прямой угол',src:'Ж с. 50–51',hl:['h1']},
    Sw:{b0:.5,say:'У фронтали ∥ x — f′, а f″ ⟂ l″',src:'Ж с. 50–51',hl:['f2']}}
});

/* ══ m4 · точка встречи прямой с плоскостью: посредник γ ⊃ l, γ ⟂ π₁ (γ′ ≡ l′) ══ */
PREP.topic('m4',{
  make(){ for(let i=0;i<200;i++){ const V=tri(); if(!V) continue; const {A,B,C}=V, w=[rnd(.2,.6),rnd(.2,.6)]; if(w[0]+w[1]>.85) continue;
    const K=[A,B,C].reduce((s,P,j)=>{ const c=j===0?1-w[0]-w[1]:w[j-1]; return s.map((v,ii)=>v+P[ii]*c); },[0,0,0]);
    const d=[rnd(-1,1),rnd(-.8,.8),rnd(-1.2,1.2)], l=Math.hypot(...d), u=d.map(x=>x/l); if(Math.abs(u[0])<.35) continue;
    { const {A:a,B:b,C:c}=V, p=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], q=[c[0]-a[0],c[1]-a[1],c[2]-a[2]], n=[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
      if(Math.abs(n[0]*u[0]+n[1]*u[1]+n[2]*u[2])/Math.hypot(...n)<Math.sin(25*D)) continue; }   /* прямая не почти ∥ плоскости */
    const Dp=K.map((v,j)=>v-u[j]*rnd(30,40)), Ep=K.map((v,j)=>v+u[j]*rnd(30,40)); if(Dp[1]<4||Dp[2]<4||Ep[1]<4||Ep[2]<4) continue;
    V.K=K; V.Dp=Dp; V.Ep=Ep; if(this.scene(V,null)) return V; } return null; },
  watch:{steps:[{cap:'Прямую l заключаем в γ ⟂ π₁: γ′ ≡ l′',roles:['p1h','p2h']},{cap:'γ ∩ ABC — прямая 12: 1″ и 2″ по линиям связи',roles:['p1h','p2h','l1','l2','p1f','p2f','s12']},{cap:'K″ = l″ ∩ 1″2″, K′ — по линии связи на l′',roles:['p1h','p2h','l1','l2','p1f','p2f','s12','K2','lk','K1']}]},
  scene(V,trap){ const {A,B,C,K,Dp,Ep}=V, l1=[...h1(Dp),...h1(Ep)], l2=[...f2(Dp),...f2(Ep)];
    /* l′ пересекает стороны треугольника на π₁ — две точки */
    const sides=[[A,B],[B,C],[C,A]], hits=[];
    for(const [P,Q] of sides){ const X=lineX(l1,[...h1(P),...h1(Q)]); if(X&&X[3]>=0&&X[3]<=1) hits.push({x:X[0],P,Q}); }
    if(hits.length!==2) return null;
    let pts=hits.map(hh=>{ const T=atX(hh.P,hh.Q,hh.x); return {h:h1(T),f:f2(T)}; });
    if(trap==='Wp'){ const o=sides.find(([P,Q])=>!hits.some(hh=>hh.P===P&&hh.Q===Q)); const xx=hits[1].x; if((xx-o[0][0])*(xx-o[1][0])>0) return null; const T=atX(o[0],o[1],xx); pts[1].f=f2(T); }
    let K2; const X=lineX(l2,[...pts[0].f,...pts[1].f]); if(!X) return null; K2=[X[0],X[1]];
    if(trap==='Si'){ const Y=lineX(l2,[...f2(B),...f2(C)]); if(!Y||Y[3]<0||Y[3]>1) return null; K2=[Y[0],Y[1]]; }
    const s=(K2[0]-Dp[0])/(Ep[0]-Dp[0]); let K1=[K2[0],Dp[1]+(Ep[1]-Dp[1])*s];
    const E=[Pt('p1h',...pts[0].h,'1′',-1,{c:'o'}),Pt('p2h',...pts[1].h,'2′',1,{c:'o'}),L('l1','lk',...pts[0].h,...pts[0].f),L('l2','lk',...pts[1].h,...pts[1].f),
      Pt('p1f',...pts[0].f,'1″',-1,{c:'o'}),Pt('p2f',...pts[1].f,'2″',1,{c:'o'}),L('s12','a',...pts[0].f,...pts[1].f),Pt('K2',K2[0],K2[1],'K″',1),L('lk','lk',...K2,...K1),Pt('K1',K1[0],K1[1],'K′',1)];
    const base=triBase(V).concat([L('','d',...l2),L('','d',...l1),Tx('',l2[2]+1,l2[3]-1.5,'l″'),Tx('',l1[2]+1,l1[3]+4,'l′ ≡ γ′')]);
    return {box:bbox(triPts(V).concat([f2(Dp),f2(Ep),h1(Dp),h1(Ep),[-55,0],[55,0]])),axis:0,base,E}; },
  fair(V,k,ok,bad){ return far(ptOf(ok,'K2'),ptOf(bad,'K2'),4); },
  traps:{
    Si:{b0:.1,say:'K″ — на прямой 1″2″ посредника, а не на стороне треугольника',src:'Ж §35',hl:['K2','lk','K1']},
    Wp:{b0:.5,say:'2″ — на той стороне, где лежит 2′',src:'Ж §35',hl:['p2f','l2','s12','K2','lk','K1']}}
});

/* ══ t1 · частное положение: натуральная величина видна на той плоскости, которой отрезок параллелен ══ */
PREP.topic('t1',{
  make(){ const kind=Math.random()<.5?'h':'f', A=[rnd(-45,-20),rnd(10,40),rnd(10,40)], B=[rnd(20,45),rnd(10,40),rnd(10,40)];
    if(kind==='h') B[2]=A[2]; else B[1]=A[1]; if(Math.abs(kind==='h'?A[1]-B[1]:A[2]-B[2])<12) return this.make(); return {kind,A,B}; },
  watch:{steps:[{cap:'AB ∥ плоскости проекций — на ней натуральная величина',roles:['nv']}]},
  scene(V,trap){ const {A,B,kind}=V, a2=f2(A),b2=f2(B),a1=h1(A),b1=h1(B);
    let onH=kind==='h'; if(trap==='Wp') onH=!onH; const s=onH?[a1,b1]:[a2,b2];
    const E=[L('nv','crv',...s[0],...s[1]),Tx('nv',(s[0][0]+s[1][0])/2+2,(s[0][1]+s[1][1])/2+(onH?5:-2),'|AB|')];
    const base=[L('','o',...a2,...b2),L('','o',...a1,...b1),L('','lk',...a2,...a1),L('','lk',...b2,...b1),Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:1}),Pt('',b2[0],b2[1],'B″',1,{c:'o',r:1}),Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:1}),Pt('',b1[0],b1[1],'B′',1,{c:'o',r:1})];
    return {box:bbox([a2,b2,a1,b1,[-55,0],[55,0]]),axis:0,base,E}; },
  traps:{Wp:{b0:.1,say:'h ∥ π₁ — натуральная величина на π₁; f ∥ π₂ — на π₂',src:'Ж гл. IV, с. 52',hl:['nv']}}
});
})();
