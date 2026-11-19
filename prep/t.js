/* ═══════════ PREP · темы ДЗ №3: замена плоскостей, вращение вокруг прямой уровня, перпендикуляр к плоскости ═══════════
   Эпюр: π₂ над осью x (X = x, Y = −z), π₁ под осью (Y = y). Обозначения — как в учебнике Жирных и др. (Ж): первая замена —
   плоскость π₃, ось x₁, проекции A‴; вторая — π₄, ось x₂, проекции Aᴵⱽ; совмещённые при вращении — A₀ (М — методичка к ДЗ).
   Новая проекция: линия связи ⟂ новой оси, расстояние до неё — с заменяемой плоскости, по другую сторону оси. */
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
const foot=(P,Q,e)=>add(Q,mul(e,dot(sub(P,Q),e)));
/* новая проекция: от P (остающаяся проекция) — ⟂ оси (Q, e), на расстоянии dist по другую сторону */
function nproj(P,dist,Q,e){ const F=foot(P,Q,e); let n=sub(F,P); n=len(n)<1e-6?[-e[1],e[0]]:nrm(n); return add(F,mul(n,dist)); }
const f2=p=>[p[0],-p[2]], h1=p=>[p[0],p[1]];
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const far=(p,q,m)=>Math.hypot(p[0]-q[0],p[1]-q[1])>=m;
const ptOf=(S,role)=>{ const e=S.E.find(x=>x.role===role&&x.t==='pt'); return e?e.a:null; };
function bbox(pts,m){ const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]); m=m||12; return [Math.min(...xs)-m,Math.min(...ys)-m,Math.max(...xs)-Math.min(...xs)+2*m,Math.max(...ys)-Math.min(...ys)+2*m]; }
const tooBig=b=>b[2]>230||b[3]>300;
const axisSeg=(Q,e,a,b)=>[Q[0]+e[0]*a,Q[1]+e[1]*a,Q[0]+e[0]*b,Q[1]+e[1]*b];
/* ось через точки P[] — отрезок с запасом по краям */
function axisAround(Q,e,P,pad){ const ts=P.map(p=>dot(sub(p,Q),e)); return axisSeg(Q,e,Math.min(...ts)-pad,Math.max(...ts)+pad); }
const lab3=(n,k)=>n+(k===3?'‴':'^IV');
function segBase(A,B,nA,nB){ const a2=f2(A),b2=f2(B),a1=h1(A),b1=h1(B);
  return [L('','o',a2[0],a2[1],b2[0],b2[1]),L('','o',a1[0],a1[1],b1[0],b1[1]),L('','lk',a2[0],a2[1],a1[0],a1[1]),L('','lk',b2[0],b2[1],b1[0],b1[1]),
    Pt('',a2[0],a2[1],nA+'″',-1,{c:'o',r:1}),Pt('',b2[0],b2[1],nB+'″',1,{c:'o',r:1}),Pt('',a1[0],a1[1],nA+'′',-1,{c:'o',r:1}),Pt('',b1[0],b1[1],nB+'′',1,{c:'o',r:1})]; }

/* ══ t2 · первая замена: прямая общего положения → прямая уровня (x₁ ∥ A′B′) ══ */
function lineAB(){
  for(let t=0;t<300;t++){
    const A=[rnd(-50,-15),rnd(12,40),rnd(10,45)], B=[rnd(15,50),rnd(12,40),rnd(10,45)];
    if(Math.abs(A[1]-B[1])<10||Math.abs(A[2]-B[2])<12||len(sub(h1(A),h1(B)))<45) continue;
    return {A,B,off:rnd(10,14),off2:rnd(10,14)};
  }
}
function rep1(V){ const a1=h1(V.A), b1=h1(V.B), e=nrm(sub(b1,a1)); let n=[-e[1],e[0]]; if(n[1]<0) n=mul(n,-1); return {a1,b1,e,n,Q:add(a1,mul(n,V.off))}; }
PREP.topic('t2',{
  make:lineAB,
  watch:{steps:[
    {cap:'Новая ось x₁ ∥ A′B′: плоскость π₃ ∥ AB',roles:['x1','x1t']},
    {cap:'Линии связи от A′ и B′ — ⟂ x₁',roles:['x1','x1t','la','lb']},
    {cap:'Расстояние до x₁ — z: снимаем с π₂ (заменяемой)',roles:['x1','x1t','la','lb','A3','B3']},
    {cap:'A‴B‴ — натуральная величина AB',roles:['x1','x1t','la','lb','A3','B3','nv']}]},
  scene(V,trap){
    const R=rep1(V); let e=R.e, Q=R.Q;
    if(trap==='Ax') e=rot(e,sgn()*rnd(8,12)*D);
    let dA=V.A[2], dB=V.B[2]; if(trap==='Dy'){ dA=V.A[1]; dB=V.B[1]; }
    let A3=nproj(R.a1,dA,Q,e), B3=nproj(R.b1,dB,Q,e);
    if(trap==='Sd'){ const F=foot(R.b1,Q,e); B3=sub(F,mul(nrm(sub(F,R.b1)),dB)); }
    if(trap==='Pp'){ /* линии связи — вертикально, как к старой оси */
      const G=p=>{ const t=(p[0]-Q[0])/e[0]; return add(Q,mul(e,t)); }; const ga=G(R.a1), gb=G(R.b1); A3=add(ga,[0,dA]); B3=add(gb,[0,dB]); }
    const okA=nproj(R.a1,V.A[2],R.Q,R.e), okB=nproj(R.b1,V.B[2],R.Q,R.e), ax=axisAround(Q,e,[R.a1,R.b1,okA,okB],12);
    const E=[L('x1','a',...ax),Tx('x1t',ax[2]+1,ax[3]-1.5,'x₁'),L('la','lk',R.a1[0],R.a1[1],A3[0],A3[1]),L('lb','lk',R.b1[0],R.b1[1],B3[0],B3[1]),
      Pt('A3',A3[0],A3[1],'A‴',-1),Pt('B3',B3[0],B3[1],'B‴',1),L('nv','crv',A3[0],A3[1],B3[0],B3[1])];
    const base=segBase(V.A,V.B,'A','B'), pts=[f2(V.A),f2(V.B),R.a1,R.b1,A3,B3,[ax[0],ax[1]],[ax[2],ax[3]],[-60,0],[60,0]];
    const b=bbox(pts); if(tooBig(b)) return null;
    return {box:b,axis:0,base,E,_e:R.e,_Q:R.Q};
  },
  fair(V,k,ok,bad){ return far(ptOf(ok,'A3'),ptOf(bad,'A3'),4)||far(ptOf(ok,'B3'),ptOf(bad,'B3'),4); },
  traps:{
    Pp:{b0:-.3,say:'Новые линии связи ⟂ новой оси x₁',src:'Ж с. 52–53',hl:['la','lb','A3','B3','nv']},
    Ax:{b0:.2,say:'Ось x₁ ∥ A′B′ — тогда AB станет прямой уровня',src:'Ж с. 53',hl:['x1','x1t','la','lb','A3','B3','nv']},
    Sd:{b0:.4,say:'Все точки — по одну сторону от x₁: z одного знака',src:'Ж с. 53',hl:['lb','B3','nv']},
    Dy:{b0:.7,say:'Откладываем z с π₂ — с заменяемой плоскости, не y',src:'Ж с. 53',hl:['la','lb','A3','B3','nv']}}
});

/* ══ t3 · вторая замена: прямая уровня → проецирующая (x₂ ⟂ A‴B‴) ══ */
PREP.topic('t3',{
  make:lineAB,
  watch:{steps:[
    {cap:'A‴B‴ — натуральная величина. Новая ось x₂ ⟂ A‴B‴',roles:['x2','x2t']},
    {cap:'Линия связи — продолжение A‴B‴',roles:['x2','x2t','l4a','l4b']},
    {cap:'Расстояние — от A′ и B′ до x₁. Прямая стала точкой',roles:['x2','x2t','l4a','l4b','A4','B4']}]},
  scene(V,trap){
    const R=rep1(V), A3=nproj(R.a1,V.A[2],R.Q,R.e), B3=nproj(R.b1,V.B[2],R.Q,R.e), u=nrm(sub(B3,A3));
    let e2=[-u[1],u[0]]; if(trap==='X2a') e2=[-R.e[1],R.e[0]];
    const Q2=add(B3,mul(u,V.off2));
    let dA=V.off, dB=V.off; if(trap==='Dz'){ dA=V.A[2]; dB=V.B[2]; }
    let A4=nproj(A3,dA,Q2,e2), B4=nproj(B3,dB,Q2,e2);
    if(trap==='Ln'){ const F=foot(A3,Q2,e2); A4=add(F,mul(rot(nrm(sub(F,A3)),sgn()*rnd(22,28)*D),dA)); }
    const ax=axisAround(Q2,e2,[A3,B3,nproj(A3,V.off,Q2,e2),nproj(B3,V.off,Q2,e2)],14), same=!far(A4,B4,.5);
    const ax1=axisAround(R.Q,R.e,[R.a1,R.b1,A3,B3],10);
    const E=[L('x2','a',...ax),Tx('x2t',ax[2]+1,ax[3]+4,'x₂'),L('l4a','lk',A3[0],A3[1],A4[0],A4[1]),L('l4b','lk',B3[0],B3[1],B4[0],B4[1]),
      Pt('A4',A4[0],A4[1],same?'A^IV≡B^IV':'A^IV',1),Pt('B4',B4[0],B4[1],same?null:'B^IV',-1)];
    const base=segBase(V.A,V.B,'A','B').concat([L('','ax',...ax1),Tx('',ax1[2]+1,ax1[3]-1.5,'x₁'),L('','lk',R.a1[0],R.a1[1],A3[0],A3[1]),L('','lk',R.b1[0],R.b1[1],B3[0],B3[1]),
      L('','o',A3[0],A3[1],B3[0],B3[1]),Pt('',A3[0],A3[1],'A‴',-1,{c:'o',r:1}),Pt('',B3[0],B3[1],'B‴',1,{c:'o',r:1})]);
    const b=bbox([f2(V.A),f2(V.B),R.a1,R.b1,A3,B3,A4,B4,[ax[0],ax[1]],[ax[2],ax[3]],[-60,0],[60,0]]); if(tooBig(b)) return null;
    return {box:b,axis:0,base,E};
  },
  fair(V,k,ok,bad){ return far(ptOf(bad,'A4'),ptOf(bad,'B4'),4)||far(ptOf(ok,'A4'),ptOf(bad,'A4'),4); },
  traps:{
    Ln:{b0:-.2,say:'Линия связи — продолжение A‴B‴',src:'Ж с. 54',hl:['l4a','A4','B4']},
    Dz:{b0:.5,say:'Расстояние до x₂ — от A′ до x₁, не z',src:'Ж с. 54',hl:['l4a','l4b','A4','B4']},
    X2a:{b0:.7,say:'x₂ ⟂ A‴B‴ (натуральной величине), не A′B′',src:'Ж с. 54',hl:['x2','x2t','l4a','l4b','A4','B4']}}
});

/* ══ t4 · плоскость → проецирующая: x₁ ⟂ горизонтали h′ ══ */
function tri(){
  for(let t=0;t<300;t++){
    const zs=[rnd(8,18),rnd(24,34),rnd(40,52)].sort(()=>Math.random()-.5);
    const A=[rnd(-45,-20),rnd(12,45),zs[1]], B=[rnd(-5,15),rnd(12,45),zs[0]], Cc=[rnd(25,50),rnd(12,45),zs[2]];
    const ar=Math.abs((B[0]-A[0])*(Cc[1]-A[1])-(Cc[0]-A[0])*(B[1]-A[1])); if(ar<500) continue;
    return {A,B,C:Cc,off:rnd(10,14)};
  }
}
function horiz(V){ /* горизонталь через A: точка 1 на BC на высоте A */
  const {A,B,C}=V, t=(A[2]-B[2])/(C[2]-B[2]); if(t<=0||t>=1) return null; const P=[B[0]+(C[0]-B[0])*t,B[1]+(C[1]-B[1])*t,A[2]]; return P; }
function triBase(V){ const {A,B,C}=V, a2=f2(A),b2=f2(B),c2=f2(C),a1=h1(A),b1=h1(B),c1=h1(C);
  return [PL('','o',[a2,b2,c2,a2]),PL('','o',[a1,b1,c1,a1]),L('','lk',a2[0],a2[1],a1[0],a1[1]),L('','lk',b2[0],b2[1],b1[0],b1[1]),L('','lk',c2[0],c2[1],c1[0],c1[1]),
    Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:.9}),Pt('',b2[0],b2[1],'B″',-1,{c:'o',r:.9}),Pt('',c2[0],c2[1],'C″',1,{c:'o',r:.9}),
    Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:.9}),Pt('',b1[0],b1[1],'B′',-1,{c:'o',r:.9}),Pt('',c1[0],c1[1],'C′',1,{c:'o',r:.9})]; }
PREP.topic('t4',{
  make(){ for(let i=0;i<50;i++){ const V=tri(); if(V&&horiz(V)&&this.scene(V,null)) return V; } return null; },
  watch:{steps:[
    {cap:'Горизонталь плоскости: h″ ∥ x, затем h′',roles:['h2','h1','p1f','p1h','l1']},
    {cap:'Новая ось x₁ ⟂ h′ — плоскость станет проецирующей',roles:['h2','h1','p1f','p1h','l1','x1','x1t']},
    {cap:'Линии связи ⟂ x₁, расстояния — z с π₂',roles:['h2','h1','p1f','p1h','l1','x1','x1t','la','lb','lc','A3','B3','C3']},
    {cap:'A‴, B‴, C‴ на одной прямой — плоскость видна прямой',roles:['h2','h1','p1f','p1h','l1','x1','x1t','la','lb','lc','A3','B3','C3','ln3']}]},
  scene(V,trap){
    const P=horiz(V); if(!P) return null;
    const a1=h1(V.A),b1=h1(V.B),c1=h1(V.C),p1=h1(P),p2=f2(P),a2=f2(V.A);
    const uh=nrm(sub(p1,a1)); let e=[-uh[1],uh[0]];
    if(trap==='Xs'){ const s=nrm(sub(b1,a1)); e=[-s[1],s[0]]; }
    const n=[e[1],-e[0]], pts=[a1,b1,c1], mx=Math.max(...pts.map(p=>dot(p,n)));
    const Q=add(mul(n,mx+V.off),mul(e,dot(a1,e)));   /* ось — за треугольником по нормали n */
    const z=[V.A[2],V.B[2],V.C[2]], dist=trap==='Dy'?[V.A[1],V.B[1],V.C[1]]:z;
    const N=pts.map((p,i)=>nproj(p,dist[i],Q,e));
    if(trap==='Lk'){ const F=foot(b1,Q,e); N[1]=add(F,mul(rot(nrm(sub(F,b1)),sgn()*rnd(20,26)*D),dist[1])); }
    const ax=axisAround(Q,e,pts.concat(pts.map((p,i)=>nproj(p,z[i],Q,e))),12);
    /* линия A‴B‴C‴ — по крайним точкам */
    const ts=N.map(p=>dot(p,e)), lo=N[ts.indexOf(Math.min(...ts))], hi=N[ts.indexOf(Math.max(...ts))];
    const E=[L('h2','a',a2[0],a2[1],p2[0],p2[1]),Pt('p1f',p2[0],p2[1],'1″',1,{c:'o'}),L('l1','lk',p2[0],p2[1],p1[0],p1[1]),Pt('p1h',p1[0],p1[1],'1′',1,{c:'o'}),L('h1','a',a1[0],a1[1],p1[0],p1[1]),
      L('x1','a',...ax),Tx('x1t',ax[2]+1,ax[3]-1.5,'x₁'),L('la','lk',a1[0],a1[1],N[0][0],N[0][1]),L('lb','lk',b1[0],b1[1],N[1][0],N[1][1]),L('lc','lk',c1[0],c1[1],N[2][0],N[2][1]),
      Pt('A3',N[0][0],N[0][1],'A‴',-1),Pt('B3',N[1][0],N[1][1],'B‴',-1),Pt('C3',N[2][0],N[2][1],'C‴',1),
      trap==='Xs'||trap==='Dy'||trap==='Lk'?PL('ln3','crv',[N[0],N[1],N[2],N[0]]):L('ln3','crv',lo[0],lo[1],hi[0],hi[1])];
    const b=bbox([f2(V.A),f2(V.B),f2(V.C),a1,b1,c1,...N,[ax[0],ax[1]],[ax[2],ax[3]],[-55,0],[55,0]]); if(tooBig(b)) return null;
    return {box:b,axis:0,base:triBase(V),E};
  },
  fair(V,k,ok,bad){ const N=['A3','B3','C3'].map(r=>ptOf(bad,r)); const ar=Math.abs((N[1][0]-N[0][0])*(N[2][1]-N[0][1])-(N[2][0]-N[0][0])*(N[1][1]-N[0][1]))/len(sub(N[2],N[0])); return ar>3.5; },
  traps:{
    Lk:{b0:-.3,say:'Линии связи ⟂ новой оси',src:'Ж с. 52, 55',hl:['lb','B3','ln3']},
    Xs:{b0:.4,say:'x₁ ⟂ горизонтали h′, а не стороне треугольника',src:'Ж с. 50, 55',hl:['x1','x1t','la','lb','lc','A3','B3','C3','ln3']},
    Dy:{b0:.7,say:'Расстояния — z с π₂, не y',src:'Ж с. 55',hl:['la','lb','lc','A3','B3','C3','ln3']}}
});

/* ══ t6 · двугранный угол: ребро AB → точка, грани → прямые (π₁ и обе замены) ══ */
PREP.topic('t6',{
  make(){
    for(let t=0;t<400;t++){
      const A=[rnd(-40,-25),rnd(14,24),rnd(10,20)], B=[rnd(20,40),rnd(14,24),rnd(30,42)];
      const C=[rnd(-15,15),rnd(34,48),rnd(5,45)], Dd=[rnd(-15,15),rnd(2,10),rnd(5,45)];
      const V={A,B,C,D:Dd,off:rnd(9,12),off2:rnd(9,12)}; if(this.scene(V,null)) return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'Первая замена уже сделана: A‴B‴ — натуральная величина ребра',roles:[]},
    {cap:'x₂ ⟂ A‴B‴ — ребро станет точкой',roles:['x2','x2t']},
    {cap:'Линии связи ⟂ x₂, расстояния — от π₁-проекций до x₁',roles:['x2','x2t','l4a','l4b','l4c','l4d','A4','B4','C4','D4']},
    {cap:'Грани — прямые. Угол между ними — двугранный угол',roles:['x2','x2t','l4a','l4b','l4c','l4d','A4','B4','C4','D4','fC','fD','om']}]},
  scene(V,trap){
    const K=['A','B','C','D'], P1=K.map(k=>h1(V[k])), e=nrm(sub(P1[1],P1[0])); let n=[-e[1],e[0]];
    const sd=P1.map(p=>dot(sub(p,P1[0]),n)); if(Math.min(...sd)<0&&Math.max(...sd)>0){ /* все по одну сторону от оси: берём сторону, где нет точек */ }
    const mx=Math.max(...sd); const Q=add(P1[0],mul(n,mx+V.off));
    const P3=K.map((k,i)=>nproj(P1[i],V[k][2],Q,e));
    const d1=P1.map(p=>Math.abs(dot(sub(p,Q),n)));   /* расстояния от π₁-проекций до x₁ */
    const u=nrm(sub(P3[1],P3[0])); let e2=[-u[1],u[0]];
    if(trap==='X2f'){ const w=nrm(sub(P3[2],P3[0])); e2=[-w[1],w[0]]; }
    const n2=[e2[1],-e2[0]], s3=P3.map(p=>dot(p,n2)); const side=dot(sub(P3[1],P3[0]),n2)>=0?1:-1;
    const Q2=add(mul(n2,side>0?Math.max(...s3)+V.off2:Math.min(...s3)-V.off2),mul(e2,dot(P3[0],e2)));
    const dist=trap==='Dz'?K.map(k=>V[k][2]):d1;
    const P4=P3.map((p,i)=>nproj(p,dist[i],Q2,e2));
    if(trap==='Lk'){ const F=foot(P3[2],Q2,e2); P4[2]=add(F,mul(rot(nrm(sub(F,P3[2])),sgn()*rnd(20,26)*D),dist[2])); }
    const ax1=axisAround(Q,e,P1.concat(P3),8), ax2=axisAround(Q2,e2,P3.concat(P3.map((p,i)=>nproj(p,d1[i],Q2,e2))),10);
    /* дуга угла ω в Aᴵⱽ */
    const A4=P4[0], aC=Math.atan2(P4[2][1]-A4[1],P4[2][0]-A4[0]), aD=Math.atan2(P4[3][1]-A4[1],P4[3][0]-A4[0]);
    let da=aD-aC; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI;
    const arc=Array.from({length:17},(_,i)=>{ const a=aC+da*i/16; return [A4[0]+9*Math.cos(a),A4[1]+9*Math.sin(a)]; });
    const same=!far(P4[0],P4[1],.5);
    const E=[L('x2','a',...ax2),Tx('x2t',ax2[2]+1,ax2[3]+4,'x₂'),
      L('l4a','lk',P3[0][0],P3[0][1],P4[0][0],P4[0][1]),L('l4b','lk',P3[1][0],P3[1][1],P4[1][0],P4[1][1]),L('l4c','lk',P3[2][0],P3[2][1],P4[2][0],P4[2][1]),L('l4d','lk',P3[3][0],P3[3][1],P4[3][0],P4[3][1]),
      Pt('A4',P4[0][0],P4[0][1],same?'A^IV≡B^IV':'A^IV',-1),Pt('B4',P4[1][0],P4[1][1],same?null:'B^IV',1),Pt('C4',P4[2][0],P4[2][1],'C^IV',1),Pt('D4',P4[3][0],P4[3][1],'D^IV',1),
      L('fC','b',P4[0][0],P4[0][1],P4[2][0],P4[2][1]),L('fD','c',P4[0][0],P4[0][1],P4[3][0],P4[3][1]),PL('om','crv',arc)];
    const ed=(P,i,j,c)=>L('',c||'o',P[i][0],P[i][1],P[j][0],P[j][1]);
    const base=[ed(P1,0,1),ed(P1,0,2),ed(P1,1,2),ed(P1,0,3),ed(P1,1,3),L('','ax',...ax1),Tx('',ax1[2]+1,ax1[3]-1.5,'x₁'),
      ...P1.map((p,i)=>L('','lk',p[0],p[1],P3[i][0],P3[i][1])),ed(P3,0,1),ed(P3,0,2),ed(P3,1,2),ed(P3,0,3),ed(P3,1,3),
      ...K.map((k,i)=>Pt('',P1[i][0],P1[i][1],k+'′',i===1?1:-1,{c:'o',r:.9})),...K.map((k,i)=>Pt('',P3[i][0],P3[i][1],k+'‴',i===1?1:-1,{c:'o',r:.9}))];
    const b=bbox(P1.concat(P3,P4,[[ax2[0],ax2[1]],[ax2[2],ax2[3]]])); if(tooBig(b)) return null;
    if(!same&&!trap) return null;
    return {box:b,axis:null,base,E,_P1:P1,_Q:Q,_e:e};
  },
  fair(V,k,ok,bad){ return ['A4','B4','C4','D4'].some(r=>far(ptOf(ok,r),ptOf(bad,r),4)); },
  traps:{
    Lk:{b0:-.3,say:'Линии связи ⟂ x₂',src:'Ж с. 52, 56',hl:['l4c','C4','fC','om']},
    X2f:{b0:.5,say:'x₂ ⟂ ребру A‴B‴, а не грани',src:'М с. 42',hl:['x2','x2t','l4a','l4b','l4c','l4d','A4','B4','C4','D4','fC','fD','om']},
    Dz:{b0:.7,say:'Расстояние до x₂ — от проекции на π₁ до x₁',src:'Ж с. 54; М с. 42',hl:['l4a','l4b','l4c','l4d','A4','B4','C4','D4','fC','fD','om']}}
});

/* ══ вращение вокруг горизонтали h: m7a (точка), m7b (треугольник), t8 (угол между прямыми) ══ */
/* радиус — натуральная величина: катеты |O′B′| и Δz (разность высот точки и оси) */
function rotPt(P1,dz,h0,eh,o){ o=o||{};
  let tr=[-eh[1],eh[0]]; if(o.pt) tr=rot(tr,o.pt);
  /* центр O′ — пересечение траектории (через P1, направление tr) с h′ */
  const den=tr[0]*eh[1]-tr[1]*eh[0]; const w=sub(h0,P1), s=(w[0]*eh[1]-w[1]*eh[0])/den; const O=add(P1,mul(tr,s));
  const r1=len(sub(P1,O)), R=o.rp?r1:Math.hypot(r1,o.dz2!=null?o.dz2:dz);
  const dir=nrm(sub(P1,O)), nT=[-dir[1],dir[0]], T=add(P1,mul(nT,o.dz2!=null?o.dz2:dz));
  let side=o.side||-1; if(side==='auto'){ const a=add(O,mul(dir,R)), b=add(O,mul(dir,-R)); side=a[1]>=b[1]?1:-1; }
  const P0=add(O,mul(dir,side*R)), Rt=Math.hypot(r1,dz);
  return {O,P0,T,R,tr,side,Rt};
}
function arcPts(O,P,Q,n){ const a=Math.atan2(P[1]-O[1],P[0]-O[0]), r=len(sub(P,O)); let b=Math.atan2(Q[1]-O[1],Q[0]-O[0])-a; while(b>Math.PI) b-=2*Math.PI; while(b<-Math.PI) b+=2*Math.PI; return Array.from({length:n||20},(_,i)=>{ const t=a+b*i/((n||20)-1); return [O[0]+r*Math.cos(t),O[1]+r*Math.sin(t)]; }); }
PREP.topic('m7a',{
  make(){
    for(let t=0;t<300;t++){
      const zh=rnd(12,24), h0=[rnd(-45,-30),rnd(14,24)], h1p=[rnd(30,48),rnd(34,52)], B=[rnd(-10,15),rnd(2,14),zh+rnd(14,28)];
      const V={zh,h0,h1:h1p,B}; V.side=rotPt([B[0],B[1]],B[2]-zh,h0,nrm(sub(h1p,h0)),{side:'auto'}).side; if(this.scene(V,null)) return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'Ось — горизонталь h. B′ идёт по прямой ⟂ h′; центр — O′',roles:['tr','O']},
    {cap:'Радиус — натуральная величина: катеты O′B′ и Δz',roles:['tr','O','leg','hyp']},
    {cap:'Откладываем радиус по траектории — точка B₀',roles:['tr','O','leg','hyp','arc','B0']}]},
  scene(V,trap){
    const eh=nrm(sub(V.h1,V.h0)), B1=h1(V.B), dz=V.B[2]-V.zh;
    const o={side:V.side}; if(trap==='Pt') o.pt=sgn()*rnd(11,15)*D; if(trap==='Rp') o.rp=true; if(trap==='Dz') o.dz2=V.B[2];
    const r=rotPt(B1,dz,V.h0,eh,o);
    const trA=add(r.O,mul(r.tr,-(r.Rt+6))), trB=add(r.O,mul(r.tr,r.Rt+6));
    const E=[L('tr','lk',trA[0],trA[1],trB[0],trB[1]),Pt('O',r.O[0],r.O[1],'O′',1,{c:'o'}),
      ...(trap==='Rp'?[]:[L('leg','a',B1[0],B1[1],r.T[0],r.T[1]),L('hyp','a',r.O[0],r.O[1],r.T[0],r.T[1])]),
      PL('arc','a',arcPts(r.O,trap==='Rp'?B1:r.T,r.P0,24)),Pt('B0',r.P0[0],r.P0[1],'B₀',-1)];
    const b2=f2(V.B), H0=[V.h0[0],-V.zh], H1=[V.h1[0],-V.zh];
    const base=[L('','a',H0[0],H0[1],H1[0],H1[1]),L('','a',V.h0[0],V.h0[1],V.h1[0],V.h1[1]),Tx('',H1[0]+1,H1[1]-1.5,'h″'),Tx('',V.h1[0]+1,V.h1[1]+4,'h′'),
      L('','lk',b2[0],b2[1],B1[0],B1[1]),Pt('',b2[0],b2[1],'B″',1,{c:'o',r:1}),Pt('',B1[0],B1[1],'B′',1,{c:'o',r:1})];
    const b=bbox([H0,H1,V.h0,V.h1,b2,B1,r.P0,r.T,trA,trB,[-55,0],[55,0]]); if(tooBig(b)) return null;
    return {box:b,axis:0,base,E};
  },
  fair(V,k,ok,bad){ return far(ptOf(ok,'B0'),ptOf(bad,'B0'),5); },
  traps:{
    Pt:{b0:-.2,say:'Траектория точки ⟂ оси h′',src:'Ж с. 63–64',hl:['tr','O','leg','hyp','arc','B0']},
    Dz:{b0:.6,say:'Катет — разность высот точки и оси, а не z',src:'Ж с. 64; М с. 40',hl:['leg','hyp','arc','B0']},
    Rp:{b0:.8,say:'Радиус — натуральная величина, не проекция O′B′',src:'Ж с. 64',hl:['leg','hyp','arc','B0']}}
});

/* m7b · совмещение треугольника: A на оси, B — радиусом, C — через неподвижную точку 1 на BC */
PREP.topic('m7b',{
  make(){ for(let i=0;i<60;i++){ const V=tri(); if(!V) continue; const P=horiz(V); if(!P) continue; V.P=P; V.side=rotPt(h1(V.B),V.B[2]-V.A[2],h1(V.A),nrm(sub(h1(P),h1(V.A))),{side:'auto'}).side; if(this.scene(V,null)) return V; } return null; },
  watch:{steps:[
    {cap:'Ось — горизонталь A1: A и 1 неподвижны',roles:[]},
    {cap:'B₀ — радиусом в натуральную величину',roles:['tB','leg','hyp','arc','B0']},
    {cap:'Прямая B₀1 и траектория C ⟂ h′ — точка C₀',roles:['tB','leg','hyp','arc','B0','l1','tC','C0']},
    {cap:'Треугольник A′B₀C₀ — натуральная величина',roles:['tB','leg','hyp','arc','B0','l1','tC','C0','nv']}]},
  scene(V,trap){
    const a1=h1(V.A),b1=h1(V.B),c1=h1(V.C),p1=h1(V.P), eh=nrm(sub(p1,a1));
    const rB=rotPt(b1,V.B[2]-V.A[2],a1,eh,{side:V.side});
    let trC=[-eh[1],eh[0]]; if(trap==='Pt') trC=rot(trC,sgn()*rnd(11,15)*D);
    /* C₀ = (B₀1) ∩ траектория C */
    const d=sub(p1,rB.P0), den=d[0]*trC[1]-d[1]*trC[0]; if(Math.abs(den)<1e-6) return null;
    const w=sub(c1,rB.P0), s=(w[0]*trC[1]-w[1]*trC[0])/den; let C0=add(rB.P0,mul(d,s));
    if(trap==='Rc'){ /* «радиус — проекция O′C′»: тот же центр, та же сторона, но длина без Δz */ const rC=rotPt(c1,0,a1,eh,{rp:true,side:1}); const dir=nrm(sub(c1,rC.O)); const sd=Math.sign(dot(sub(C0,rC.O),dir))||1; C0=add(rC.O,mul(dir,sd*rC.R)); }
    let A0=a1; if(trap==='Am'){ const n=[-eh[1],eh[0]]; A0=add(a1,mul(n,sgn()*rnd(8,12))); }
    const tB=[add(rB.O,mul(rB.tr,-(rB.Rt+5))),add(rB.O,mul(rB.tr,rB.Rt+5))], tCa=add(c1,mul(trC,-40)), tCb=add(c1,mul(trC,40));
    const ext=add(p1,mul(sub(p1,rB.P0),.15));
    const E=[L('tB','lk',tB[0][0],tB[0][1],tB[1][0],tB[1][1]),L('leg','a',b1[0],b1[1],rB.T[0],rB.T[1]),L('hyp','a',rB.O[0],rB.O[1],rB.T[0],rB.T[1]),PL('arc','a',arcPts(rB.O,rB.T,rB.P0,24)),Pt('B0',rB.P0[0],rB.P0[1],'B₀',1),
      L('l1','a',rB.P0[0],rB.P0[1],ext[0],ext[1]),L('tC','lk',tCa[0],tCa[1],tCb[0],tCb[1]),Pt('C0',C0[0],C0[1],'C₀',1),PL('nv','crv',[A0,rB.P0,C0,A0])];
    if(trap==='Am') E.push(Pt('A0',A0[0],A0[1],'A₀',-1));
    const a2=f2(V.A),p2=f2(V.P);
    const base=triBase(V).concat([L('','a',a2[0],a2[1],p2[0],p2[1]),L('','a',a1[0],a1[1],p1[0],p1[1]),L('','lk',p2[0],p2[1],p1[0],p1[1]),Pt('',p1[0],p1[1],'1′',1,{c:'o'}),Pt('',p2[0],p2[1],'1″',1,{c:'o'})]);
    const b=bbox([a2,f2(V.B),f2(V.C),a1,b1,c1,rB.P0,C0,rB.T,[-55,0],[55,0]]); if(tooBig(b)) return null;
    return {box:b,axis:0,base,E};
  },
  fair(V,k,ok,bad){ if(k==='Am') return true; return far(ptOf(ok,'C0'),ptOf(bad,'C0'),5); },
  traps:{
    Am:{b0:-.4,say:'Точки на оси при вращении неподвижны',src:'Ж с. 64',hl:['nv','A0']},
    Pt:{b0:.2,say:'Траектория C тоже ⟂ h′',src:'Ж с. 63–64',hl:['tC','C0','nv']},
    Rc:{b0:.7,say:'C₀ — через неподвижную точку 1, а не радиусом-проекцией',src:'М с. 40–41',hl:['C0','nv']}}
});

/* t8 · угол между пересекающимися прямыми: плоскость угла вращаем вокруг её горизонтали */
PREP.topic('t8',{
  make(){
    for(let t=0;t<300;t++){
      const zh=rnd(10,18), M=[rnd(-45,-28),rnd(30,48),zh], N=[rnd(28,45),rnd(30,48),zh], K=[rnd(-10,10),rnd(4,14),zh+rnd(18,32)];
      const V={M,N,K}; V.side=rotPt([K[0],K[1]],K[2]-zh,[M[0],M[1]],nrm(sub([N[0],N[1]],[M[0],M[1]])),{side:'auto'}).side; if(this.scene(V,null)) return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'MN — горизонталь плоскости угла: ось вращения',roles:[]},
    {cap:'K′ идёт ⟂ M′N′, радиус — натуральная величина',roles:['tr','leg','hyp','arc','K0']},
    {cap:'Угол M K₀ N — истинный угол между прямыми',roles:['tr','leg','hyp','arc','K0','a0','b0','phi']}]},
  scene(V,trap){
    const m1=h1(V.M),n1=h1(V.N),k1=h1(V.K), eh=nrm(sub(n1,m1));
    const o={side:V.side}; if(trap==='Rp') o.rp=true; if(trap==='Pt') o.pt=sgn()*rnd(22,28)*D;
    const r=rotPt(k1,V.K[2]-V.M[2],m1,eh,o); let K0=r.P0;
    const at=trap==='Ka'?k1:K0;
    const am=Math.atan2(m1[1]-at[1],m1[0]-at[0]), an=Math.atan2(n1[1]-at[1],n1[0]-at[0]); let da=an-am; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI;
    const phi=Array.from({length:17},(_,i)=>{ const a=am+da*i/16; return [at[0]+10*Math.cos(a),at[1]+10*Math.sin(a)]; });
    const tA=add(r.O,mul(r.tr,-(r.Rt+6))), tB=add(r.O,mul(r.tr,r.Rt+6));
    const E=[L('tr','lk',tA[0],tA[1],tB[0],tB[1]),...(trap==='Rp'?[]:[L('leg','a',k1[0],k1[1],r.T[0],r.T[1]),L('hyp','a',r.O[0],r.O[1],r.T[0],r.T[1])]),
      PL('arc','a',arcPts(r.O,trap==='Rp'?k1:r.T,K0,24)),Pt('K0',K0[0],K0[1],'K₀',1),L('a0','b',K0[0],K0[1],m1[0],m1[1]),L('b0','c',K0[0],K0[1],n1[0],n1[1]),PL('phi','crv',phi),Tx('phi',at[0]+(Math.cos(am+da/2))*14,at[1]+(Math.sin(am+da/2))*14+2,'φ')];
    const m2=f2(V.M),n2=f2(V.N),k2=f2(V.K);
    const base=[L('','o',k2[0],k2[1],m2[0],m2[1]),L('','o',k2[0],k2[1],n2[0],n2[1]),L('','o',k1[0],k1[1],m1[0],m1[1]),L('','o',k1[0],k1[1],n1[0],n1[1]),
      L('','a',m2[0],m2[1],n2[0],n2[1]),L('','a',m1[0],m1[1],n1[0],n1[1]),L('','lk',k2[0],k2[1],k1[0],k1[1]),L('','lk',m2[0],m2[1],m1[0],m1[1]),L('','lk',n2[0],n2[1],n1[0],n1[1]),
      Pt('',k2[0],k2[1],'K″',1,{c:'o',r:1}),Pt('',k1[0],k1[1],'K′',1,{c:'o',r:1}),Pt('',m1[0],m1[1],'M′',-1,{c:'o',r:1}),Pt('',n1[0],n1[1],'N′',1,{c:'o',r:1}),Pt('',m2[0],m2[1],'M″',-1,{c:'o',r:1}),Pt('',n2[0],n2[1],'N″',1,{c:'o',r:1})];
    const b=bbox([m2,n2,k2,m1,n1,k1,K0,r.T,tA,tB,[-55,0],[55,0]]); if(tooBig(b)) return null;
    return {box:b,axis:0,base,E,_K0:K0};
  },
  fair(V,k,ok,bad){ if(k==='Ka') return true; return far(ptOf(ok,'K0'),ptOf(bad,'K0'),5); },
  traps:{
    Ka:{b0:-.2,say:'Угол на проекции искажён — меряем при K₀',src:'Ж с. 28, 62',hl:['phi','a0','b0']},
    Pt:{b0:.3,say:'Траектория K ⟂ оси M′N′',src:'Ж с. 63',hl:['tr','leg','hyp','arc','K0','a0','b0','phi']},
    Rp:{b0:.8,say:'Радиус — натуральная величина, не проекция',src:'Ж с. 64',hl:['leg','hyp','arc','K0','a0','b0','phi']}}
});

/* ══ m2 · перпендикуляр к плоскости: n′ ⟂ h′, n″ ⟂ f″ ══ */
PREP.topic('m2',{
  make(){ for(let i=0;i<80;i++){ const V=tri(); if(!V) continue; V.Dp=[rnd(-20,20),rnd(50,62),rnd(50,62)]; if(this.scene(V,null)) return V; } return null; },
  watch:{steps:[
    {cap:'В плоскости — горизонталь h и фронталь f',roles:['h2','h1','f1','f2']},
    {cap:'n′ ⟂ h′: прямой угол виден, h ∥ π₁',roles:['h2','h1','f1','f2','n1']},
    {cap:'n″ ⟂ f″: f ∥ π₂',roles:['h2','h1','f1','f2','n1','n2']}]},
  scene(V,trap){
    const {A,B,C}=V, P=horiz(V); if(!P) return null;
    /* фронталь через A: точка 2 на BC с тем же y */
    const t=(A[1]-B[1])/(C[1]-B[1]); if(t<=0||t>=1) return null; const F=[B[0]+(C[0]-B[0])*t,A[1],B[2]+(C[2]-B[2])*t];
    const a1=h1(A),a2=f2(A),p1=h1(P),p2=f2(P),q1=h1(F),q2=f2(F), d1=h1(V.Dp), d2=f2(V.Dp);
    const uh=nrm(sub(p1,a1)), uf=nrm(sub(q2,a2));
    let n1d=[-uh[1],uh[0]], n2d=[-uf[1],uf[0]];
    if(trap==='Hs'){ const s=nrm(sub(h1(B),a1)); n1d=[-s[1],s[0]]; }
    if(trap==='Nh') n2d=[0,1];
    if(trap==='Nf') n1d=[0,1];
    const seg=(P0,d,a,b)=>[P0[0]+d[0]*a,P0[1]+d[1]*a,P0[0]+d[0]*b,P0[1]+d[1]*b];
    const E=[L('h2','a',a2[0],a2[1],p2[0],p2[1]),L('h1','a',a1[0],a1[1],p1[0],p1[1]),L('f1','c',a1[0],a1[1],q1[0],q1[1]),L('f2','c',a2[0],a2[1],q2[0],q2[1]),
      Tx('h1',p1[0]+1,p1[1]+4,'h′'),Tx('f2',q2[0]+1,q2[1]-1.5,'f″'),
      L('n1','d',...seg(d1,n1d,-30,30)),L('n2','d',...seg(d2,n2d,-30,30)),Tx('n1',d1[0]+n1d[0]*30+1,d1[1]+n1d[1]*30+3,'n′'),Tx('n2',d2[0]+n2d[0]*30+1,d2[1]+n2d[1]*30-1,'n″')];
    const base=triBase(V).concat([L('','lk',d2[0],d2[1],d1[0],d1[1]),Pt('',d2[0],d2[1],'D″',-1,{c:'o',r:1}),Pt('',d1[0],d1[1],'D′',-1,{c:'o',r:1})]);
    const b=bbox([a2,f2(B),f2(C),a1,h1(B),h1(C),d1,d2,[d1[0]+n1d[0]*30,d1[1]+n1d[1]*30],[d1[0]-n1d[0]*30,d1[1]-n1d[1]*30],[d2[0]+n2d[0]*30,d2[1]+n2d[1]*30],[d2[0]-n2d[0]*30,d2[1]-n2d[1]*30],[-55,0],[55,0]]); if(tooBig(b)) return null;
    return {box:b,axis:0,base,E,_F:F,_P:P};
  },
  fair(V,k,ok,bad){ const L0=ok.E.find(e=>e.role===(k==='Nh'?'n2':'n1')).a, L1=bad.E.find(e=>e.role===(k==='Nh'?'n2':'n1')).a;
    const a0=Math.atan2(L0[3]-L0[1],L0[2]-L0[0]), a1=Math.atan2(L1[3]-L1[1],L1[2]-L1[0]); let d=Math.abs(a0-a1)%Math.PI; d=Math.min(d,Math.PI-d); return d>12*D; },
  traps:{
    Nf:{b0:-.2,say:'n′ ⟂ h′, а не ⟂ f′',src:'Ж с. 50',hl:['n1']},
    Hs:{b0:.4,say:'n′ ⟂ горизонтали, а не стороне треугольника',src:'Ж с. 50; М с. 32',hl:['n1']},
    Nh:{b0:.6,say:'n″ ⟂ f″, а не ⟂ h″',src:'Ж с. 50, 137',hl:['n2']}}
});
})();
