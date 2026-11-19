/* ═══════════ PREP · t7, t9, m5, m6, x5m, f4a, f4b ═══════════
   π₂ над осью (Y = −z), π₁ под осью (Y = y). Ж — учебник Жирных и др., М — методичка к ДЗ. */
(function(){
'use strict';
if(!self.PREP) return;
const rnd=(a,b)=>a+Math.random()*(b-a), sgn=()=>Math.random()<.5?-1:1, D=Math.PI/180;
const L=(role,c,x1,y1,x2,y2,o)=>Object.assign({t:'line',role,c,a:[x1,y1,x2,y2]},o||{});
const C=(role,c,cx,cy,r,o)=>Object.assign({t:'circ',role,c,a:[cx,cy,r]},o||{});
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
function lineCirc(px,py,ux,uy,cx,cy,r){ const fx=px-cx,fy=py-cy,a=ux*ux+uy*uy,b=2*(fx*ux+fy*uy),c=fx*fx+fy*fy-r*r,d=b*b-4*a*c; if(d<0) return []; const s=Math.sqrt(d); return [(-b-s)/(2*a),(-b+s)/(2*a)]; }
const foot=(P,Q,e)=>add(Q,mul(e,dot(sub(P,Q),e)));
function nproj(P,dist,Q,e){ const F=foot(P,Q,e); let n=sub(F,P); n=len(n)<1e-6?[-e[1],e[0]]:nrm(n); return add(F,mul(n,dist)); }
const axisAround=(Q,e,P,pad)=>{ const ts=P.map(p=>dot(sub(p,Q),e)); const a=Math.min(...ts)-pad, b=Math.max(...ts)+pad; return [Q[0]+e[0]*a,Q[1]+e[1]*a,Q[0]+e[0]*b,Q[1]+e[1]*b]; };
const arcPts=(O,P,Q,n)=>{ const a=Math.atan2(P[1]-O[1],P[0]-O[0]), r=len(sub(P,O)); let b=Math.atan2(Q[1]-O[1],Q[0]-O[0])-a; while(b>Math.PI) b-=2*Math.PI; while(b<-Math.PI) b+=2*Math.PI; return Array.from({length:n||20},(_,i)=>{ const t=a+b*i/((n||20)-1); return [O[0]+r*Math.cos(t),O[1]+r*Math.sin(t)]; }); };

/* ══ t7 · вращение вокруг проецирующей прямой i ⟂ π₁ (через A): B′ — по дуге с центром i′, B″ — по горизонтали ══ */
PREP.topic('t7',{
  make(){ for(;;){ const A=[rnd(-40,-20),rnd(15,40),rnd(10,25)], B=[rnd(0,30),rnd(15,45),rnd(30,50)]; if(Math.abs(B[1]-A[1])>10) return {A,B,dir:B[0]>A[0]?1:-1}; } },
  watch:{steps:[
    {cap:'Ось i ⟂ π₁ через A: i′ — точка, A неподвижна',roles:[]},
    {cap:'B′ — по дуге с центром i′ до A′B₁′ ∥ x',roles:['arc1','B1h']},
    {cap:'B″ — по горизонтали до линии связи: B₁″',roles:['arc1','B1h','tr2','lk','B1f']},
    {cap:'A″B₁″ — натуральная величина AB',roles:['arc1','B1h','tr2','lk','B1f','nv']}]},
  scene(V,trap){
    const {A,B,dir}=V, a1=h1(A), b1=h1(B), a2=f2(A), b2=f2(B);
    let r=len(sub(b1,a1)); if(trap==='Rr') r=len(sub(b2,a2));
    const B1h=[a1[0]+dir*r,a1[1]];
    let B1f=[B1h[0],b2[1]];
    if(trap==='Arc2'){ const r2=len(sub(b2,a2)), dx=B1h[0]-a2[0]; if(Math.abs(dx)>=r2) return null; B1f=[B1h[0],a2[1]-Math.sqrt(r2*r2-dx*dx)]; }
    if(trap==='Lk') B1f=[B1h[0]+sgn()*rnd(8,11),b2[1]];
    const E=[PL('arc1','a',arcPts(a1,b1,B1h,24).map((p,i,arr)=>trap==='Rr'&&i===0?p:p)),Pt('B1h',B1h[0],B1h[1],'B₁′',dir),
      L('tr2','lk',b2[0],b2[1],B1f[0],B1f[1]),L('lk','lk',B1h[0],B1h[1],B1f[0],B1f[1]),Pt('B1f',B1f[0],B1f[1],'B₁″',dir),L('nv','crv',a2[0],a2[1],B1f[0],B1f[1])];
    if(trap==='Rr') E[0]=PL('arc1','a',arcPts(a1,add(a1,mul(nrm(sub(b1,a1)),r)),B1h,24));
    if(trap==='Arc2') E[2]=PL('tr2','lk',arcPts(a2,b2,B1f,20));
    const base=[L('','o',...a2,...b2),L('','o',...a1,...b1),L('','lk',...a2,...a1),L('','lk',...b2,...b1),L('','cl',a2[0],a2[1]-12,a2[0],a1[1]+6),Tx('',a2[0]+1,a2[1]-12,'i″'),
      Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:1}),Pt('',b2[0],b2[1],'B″',1,{c:'o',r:1}),Pt('',a1[0],a1[1],'A′ ≡ i′',-1,{c:'o',r:1}),Pt('',b1[0],b1[1],'B′',1,{c:'o',r:1})];
    return {box:bbox([a2,b2,a1,b1,B1h,B1f,[a1[0]+dir*r,a1[1]-r],[a1[0]+dir*r,a1[1]+r],[-55,0],[55,0]]),axis:0,base,E};
  },
  fair(V,k,ok,bad){ return far(ptOf(ok,'B1f'),ptOf(bad,'B1f'),4)||far(ptOf(ok,'B1h'),ptOf(bad,'B1h'),4); },
  traps:{
    Lk:{b0:-1,say:'B₁″ — на линии связи с B₁′',src:'Ж с. 62',hl:['lk','B1f','nv','tr2']},
    Rr:{b0:.4,say:'Радиус на π₁ — |A′B′|, он не меняется',src:'Ж с. 62',hl:['arc1','B1h','lk','B1f','tr2','nv']},
    Arc2:{b0:.6,say:'На π₂ точка идёт по горизонтали, а не по дуге',src:'Ж с. 62',hl:['tr2','lk','B1f','nv']}}
});

/* ══ m5 · линия пересечения плоскости общего положения (ABC) с фронтально-проецирующей β: на π₂ она уже есть — на следе ══ */
PREP.topic('m5',{
  make(){ for(let t=0;t<300;t++){ const A=[rnd(-45,-28),rnd(10,45),rnd(8,20)], B=[rnd(-5,10),rnd(10,45),rnd(40,55)], Cc=[rnd(28,45),rnd(10,45),rnd(15,35)];
    const x0=rnd(-15,15), z0=rnd(25,35), ph=rnd(20,40)*D*sgn(); const V={A,B,C:Cc,x0,z0,ph}; if(this.scene(V,null)) return V; } return null; },
  watch:{steps:[{cap:'β ⟂ π₂: на π₂ линия пересечения лежит на следе f₀β — точки 1″, 2″',roles:['p1f','p2f']},{cap:'1′, 2′ — по линиям связи на тех же сторонах',roles:['p1f','p2f','l1','l2','p1h','p2h']},{cap:'1′2′ — горизонтальная проекция линии пересечения',roles:['p1f','p2f','l1','l2','p1h','p2h','s1']}]},
  scene(V,trap){ const {A,B,C}=V, zf=x=>V.z0+(x-V.x0)*Math.tan(V.ph), tr=[-60,-zf(-60),60,-zf(60)];
    const sides=[[A,B],[B,C],[C,A]], hits=[];
    for(const [P,Q] of sides){ const X=lineX(tr,[...f2(P),...f2(Q)]); if(X&&X[3]>=0&&X[3]<=1) hits.push({x:X[0],P,Q}); }
    if(hits.length!==2) return null; hits.sort((a,b)=>a.x-b.x);
    let pts=hits.map(hh=>{ const T=lerp(hh.P,hh.Q,(hh.x-hh.P[0])/(hh.Q[0]-hh.P[0])); return {f:f2(T),h:h1(T)}; });
    if(trap==='Wp'){ const o=sides.find(([P,Q])=>!hits.some(hh=>hh.P===P&&hh.Q===Q)); const xx=hits[1].x; if((xx-o[0][0])*(xx-o[1][0])>0) return null; const T=lerp(o[0],o[1],(xx-o[0][0])/(o[1][0]-o[0][0])); pts[1].h=h1(T); }
    if(trap==='Ln'){ const d=sgn()*rnd(6,9); pts=pts.map(q=>({f:[q.f[0],q.f[1]+d],h:q.h})); }   /* линия пересечения на π₂ — «своя», не на следе */
    if(trap==='Lk'){ const hh=hits[1], xs=hh.x+sgn()*rnd(7,10); if((xs-hh.P[0])*(xs-hh.Q[0])>0) return null; const T=lerp(hh.P,hh.Q,(xs-hh.P[0])/(hh.Q[0]-hh.P[0])); pts[1].h=h1(T); }
    const E=[Pt('p1f',...pts[0].f,'1″',-1,{c:'o'}),Pt('p2f',...pts[1].f,'2″',1,{c:'o'}),L('l1','lk',...pts[0].f,...pts[0].h),L('l2','lk',...pts[1].f,...pts[1].h),Pt('p1h',...pts[0].h,'1′',-1),Pt('p2h',...pts[1].h,'2′',1),L('s1','crv',...pts[0].h,...pts[1].h)];
    const a2=f2(A),b2=f2(B),c2=f2(C),a1=h1(A),b1=h1(B),c1=h1(C);
    const base=[PL('','o',[a2,b2,c2,a2]),PL('','o',[a1,b1,c1,a1]),L('','lk',...a2,...a1),L('','lk',...b2,...b1),L('','lk',...c2,...c1),L('','c',...tr),Tx('',56,-zf(56)-2,'f₀β','end'),
      Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:.9}),Pt('',b2[0],b2[1],'B″',1,{c:'o',r:.9}),Pt('',c2[0],c2[1],'C″',1,{c:'o',r:.9}),Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:.9}),Pt('',b1[0],b1[1],'B′',1,{c:'o',r:.9}),Pt('',c1[0],c1[1],'C′',1,{c:'o',r:.9})];
    const b=bbox([a2,b2,c2,a1,b1,c1,[-60,0],[60,0]]); return {box:b,axis:0,base,E}; },
  fair(V,k,ok,bad){ return far(ptOf(ok,'p2h'),ptOf(bad,'p2h'),4)||far(ptOf(ok,'p2f'),ptOf(bad,'p2f'),4); },
  traps:{
    Lk:{b0:-1,say:'2′ — на линии связи с 2″',src:'Ж §36',hl:['l2','p2h','s1']},
    Ln:{b0:.2,say:'На π₂ линия пересечения лежит на следе f₀β',src:'Ж с. 97, 104',hl:['p1f','p2f','l1','l2']},
    Wp:{b0:.5,say:'2′ — на той же стороне, на которой лежит 2″',src:'Ж §36',hl:['l2','p2h','s1']}}
});

/* ══ m6 · расстояние от точки до горизонтали: перпендикуляр (прямой угол на π₁) + натуральная величина ══ */
PREP.topic('m6',{
  make(){ const zh=rnd(12,22), h0=[rnd(-45,-30),rnd(4,10),zh], h1p=[rnd(25,40),rnd(42,55),zh], Dp=[rnd(-12,12),rnd(55,64),rnd(38,52)]; return {h0,h1:h1p,Dp}; },
  watch:{steps:[{cap:'Перпендикуляр к h: прямой угол виден на π₁ — D′K′ ⟂ h′',roles:['dk1','K1','lk','K2','dk2']},{cap:'Натуральная величина DK: катет Δz в K′',roles:['dk1','K1','lk','K2','dk2','leg','hyp']},{cap:'Гипотенуза — расстояние от D до h',roles:['dk1','K1','lk','K2','dk2','leg','hyp','dt']}]},
  scene(V,trap){ const {h0,Dp}=V, H0=h1(h0), H1=h1(V.h1), e=nrm(sub(H1,H0)), d1=h1(Dp), d2=f2(Dp);
    let K1=add(H0,mul(e,dot(sub(d1,H0),e)));
    if(trap==='Wp'){ const t=(d1[0]-H0[0])/(H1[0]-H0[0]); K1=[d1[0],H0[1]+(H1[1]-H0[1])*t]; }
    const K2=[K1[0],-h0[2]], u=nrm(sub(K1,d1)), n=[-u[1],u[0]];
    let dz=Math.abs(Dp[2]-h0[2]); if(trap==='Dy') dz=Math.abs(Dp[1]-K1[1]);
    const T=add(K1,mul(n,dz));
    const E=[L('dk1','d',...d1,...K1),Pt('K1',K1[0],K1[1],'K′',1),L('lk','lk',...K1,...K2),Pt('K2',K2[0],K2[1],'K″',1),L('dk2','d',...d2,...K2),
      L('leg','a',...K1,...T),L('hyp','crv',...d1,...T),Tx('dt',(d1[0]+T[0])/2+2,(d1[1]+T[1])/2,'|DK|')];
    if(trap==='Pr'){ E.splice(5,3,L('leg','a',...K1,...K1),L('hyp','crv',...d1,...K1),Tx('dt',(d1[0]+K1[0])/2+2,(d1[1]+K1[1])/2,'|DK|')); }
    const base=[L('','a',H0[0],-h0[2],H1[0],-h0[2]),L('','a',...H0,...H1),Tx('',H1[0]+1,-h0[2]-1.5,'h″'),Tx('',H1[0]+1,H1[1]+4,'h′'),L('','lk',...d2,...d1),Pt('',d2[0],d2[1],'D″',-1,{c:'o',r:1}),Pt('',d1[0],d1[1],'D′',-1,{c:'o',r:1})];
    return {box:bbox([H0,H1,[H0[0],-h0[2]],d1,d2,T,K1,[-55,0],[55,0]]),axis:0,base,E}; },
  fair(V,k,ok,bad){ const a=ok.E.find(e=>e.role==='hyp').a, b=bad.E.find(e=>e.role==='hyp').a; return Math.abs(Math.hypot(a[2]-a[0],a[3]-a[1])-Math.hypot(b[2]-b[0],b[3]-b[1]))>2; },
  traps:{
    Pr:{b0:.1,say:'Расстояние — натуральная величина DK, не проекция D′K′',src:'Ж с. 34; М с. 4–5',hl:['leg','hyp','dt']},
    Wp:{b0:.4,say:'Прямой угол виден на π₁ (h ∥ π₁)',src:'Ж §12',hl:['dk1','K1','lk','K2','dk2','leg','hyp','dt']},
    Dy:{b0:.6,say:'Катет к D′K′ — Δz, не Δy',src:'Ж §10',hl:['leg','hyp','dt']}}
});

/* ══ t9 · обратный ход: точку строим на натуральном виде и возвращаем — π₄ → π₃ → π₁ ══ */
function rep2(V){
  const {A,B,C}=V, P1=[A,B,C].map(h1), tt=(A[2]-B[2])/(C[2]-B[2]); if(tt<=.05||tt>=.95) return null;
  const H=[B[0]+(C[0]-B[0])*tt,B[1]+(C[1]-B[1])*tt], uh=nrm(sub(H,P1[0])), e=[-uh[1],uh[0]], n=[e[1],-e[0]], mx=Math.max(...P1.map(p=>dot(p,n)));
  const Q=add(mul(n,mx+V.off),mul(e,dot(P1[0],e))), P3=P1.map((p,i)=>nproj(p,[A,B,C][i][2],Q,e)), d1=P1.map(p=>Math.abs(dot(sub(p,Q),n)));
  const ts=P3.map(p=>dot(p,e)), lo=P3[ts.indexOf(Math.min(...ts))], hi=P3[ts.indexOf(Math.max(...ts))], e2=nrm(sub(hi,lo)), n2=[-e2[1],e2[0]], side=dot(sub(P1[0],lo),n2)>0?-1:1;
  const Q2=add(lo,mul(n2,side*V.off2)), P4=P3.map((p,i)=>nproj(p,d1[i],Q2,e2));
  return {P1,P3,P4,Q,e,n,Q2,e2,n2,lo,hi,d1};
}
function circum(a,b,c){ const d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1])), s=q=>q[0]*q[0]+q[1]*q[1];
  return [(s(a)*(b[1]-c[1])+s(b)*(c[1]-a[1])+s(c)*(a[1]-b[1]))/d,(s(a)*(c[0]-b[0])+s(b)*(a[0]-c[0])+s(c)*(b[0]-a[0]))/d]; }
PREP.topic('t9',{
  make(){ for(let i=0;i<300;i++){ const zs=[rnd(8,18),rnd(24,34),rnd(40,52)].sort(()=>Math.random()-.5);
    const V={A:[rnd(-40,-20),rnd(10,40),zs[1]],B:[rnd(-5,12),rnd(10,40),zs[0]],C:[rnd(22,42),rnd(10,40),zs[2]],off:rnd(8,11),off2:rnd(9,12)};
    if(this.scene(V,null)) return V; } return null; },
  watch:{steps:[{cap:'Центр описанной окружности строим на натуральном виде — Oᴵⱽ',roles:[]},{cap:'Обратно на π₃: линия связи ⟂ x₂ до прямой A‴B‴C‴',roles:['l3','O3']},{cap:'На π₁: ⟂ x₁, расстояние — от Oᴵⱽ до x₂',roles:['l3','O3','l1','O1']}]},
  scene(V,trap){ const r=rep2(V); if(!r) return null; const {P1,P3,P4,Q,e,n,Q2,e2,lo,hi}=r;
    const O4=circum(...P4), dO=Math.abs(dot(sub(O4,Q2),[-e2[1],e2[0]]));
    let O3=foot(O4,lo,e2); /* на прямой A‴B‴C‴, ⟂ x₂ — то же, что проекция на эту прямую */
    if(trap==='Lk'){ const F=foot(O4,Q2,e2); O3=add(F,mul(rot(nrm(sub(F,O4)),sgn()*rnd(30,40)*D),len(sub(foot(O4,lo,e2),F)))); const X=lineX([...lo,...hi],[...F,...O3]); if(!X) return null; O3=[X[0],X[1]]; }
    /* расстояние — со знаком: центр тупоугольного треугольника может лежать по другую сторону оси (вне фигуры) */
    const F2=foot(O4,Q2,e2), toP4=nrm(sub(P4[0],foot(P4[0],Q2,e2))); let sd=dot(sub(O4,F2),toP4);
    if(trap==='Dw') sd=Math.abs(dot(sub(O3,Q),n));
    const F1=foot(O3,Q,e), toP1=nrm(sub(P1[0],foot(P1[0],Q,e))), O1=add(F1,mul(toP1,trap==='Sd'?-sd:sd));
    const ax1=axisAround(Q,e,P1.concat(P3),8), ax2=axisAround(Q2,e2,P3.concat(P4),10);
    const E=[L('l3','lk',...O4,...O3),Pt('O3',...O3,'O‴',1),L('l1','lk',...O3,...O1),Pt('O1',...O1,'O′',1)];
    const base=[PL('','o',[P1[0],P1[1],P1[2],P1[0]]),L('','ax',...ax1),Tx('',ax1[2]+1,ax1[3]-1.5,'x₁'),L('','ax',...ax2),Tx('',ax2[2]+1,ax2[3]+4,'x₂'),...P1.map((p,i)=>L('','lk',...p,...P3[i])),L('','o',...lo,...hi),
      ...P3.map((p,i)=>L('','lk',...p,...P4[i])),PL('','crv',[P4[0],P4[1],P4[2],P4[0]]),C('','b',...O4,len(sub(P4[0],O4))),Pt('',...O4,'O^IV',1,{c:'o'}),
      ...['A','B','C'].map((k,i)=>Pt('',...P1[i],k+'′',-1,{c:'o',r:.9})),...['A','B','C'].map((k,i)=>Pt('',...P4[i],k+'^IV',-1,{c:'o',r:.9}))];
    const R=len(sub(P4[0],O4)); const b=bbox(P1.concat(P3,P4,[O1,[O4[0]-R,O4[1]-R],[O4[0]+R,O4[1]+R]])); if(b[2]>240||b[3]>300) return null;
    return {box:b,axis:null,base,E};
  },
  fair(V,k,ok,bad){ return far(ptOf(ok,'O1'),ptOf(bad,'O1'),4); },
  traps:{
    Lk:{b0:-.3,say:'Обратная линия связи ⟂ x₂',src:'Ж с. 52–53',hl:['l3','O3','l1','O1']},
    Dw:{b0:.6,say:'Расстояние до x₁ — от Oᴵⱽ до x₂, а не от O‴',src:'Ж с. 52–53; М с. 39–41',hl:['l1','O1']},
    Sd:{b0:.4,say:'Сторона от x₁ — та же, что у Oᴵⱽ относительно x₂ (со знаком)',src:'Ж с. 52–53',hl:['l1','O1']}}
});

/* ══ x5m · теорема Монжа: конус и цилиндр описаны около одной сферы ⇒ линия — две плоские кривые: на π₂ — отрезки ══ */
PREP.topic('x5m',{
  make(){ for(let t=0;t<300;t++){ const r=rnd(18,24), zO=rnd(45,55), al=rnd(18,26)*D, ps=rnd(25,45)*D*sgn();
    const V={r,zO,al,ps,Sz:zO+r/Math.sin(al)}; if(this.scene(V,null)) return V; } return null; },
  watch:{steps:[{cap:'Конус и цилиндр касаются одной сферы',roles:[]},{cap:'Линия распадается на две плоские кривые ⟂ π₂',roles:['m1']},{cap:'На π₂ это отрезки через точки пересечения очерков',roles:['m1','m2']}]},
  scene(V,trap){ const O=[0,-V.zO], S=[0,-V.Sz], tA=Math.tan(V.al), u=[Math.cos(V.ps),-Math.sin(V.ps)], n=[-u[1],u[0]];
    /* очерки: конус — две образующие из S; цилиндр — две прямые на расстоянии r от оси */
    const cone=[[S,[S[0]-tA*(V.Sz),0]],[S,[S[0]+tA*(V.Sz),0]]];
    const cyl=[[add(O,mul(n,V.r)),u],[add(O,mul(n,-V.r)),u]];
    const P=[]; for(const [a,b] of cone) for(const [c,d] of cyl){ const X=lineX([...a,...b],[...c,c[0]+d[0],c[1]+d[1]]); if(!X||X[2]<0||X[2]>1) return null; P.push([X[0],X[1]]); }
    /* P: [конус-лев ∩ цил+, конус-лев ∩ цил−, конус-прав ∩ цил+, конус-прав ∩ цил−]; кривые — «крест-накрест» */
    let s1=[P[0],P[3]], s2=[P[1],P[2]]; if(trap==='Ad'){ s1=[P[0],P[1]]; s2=[P[2],P[3]]; }
    if(trap==='Ep') s1=[P[0],add(P[3],mul(u,sgn()*rnd(7,9)))];   /* конец — не в точке пересечения очерков */
    const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const E=[trap==='Cv'?PL('m1','crv',Array.from({length:17},(_,i)=>{ const t=i/16, p=lerp(s1[0],s1[1],t), k=Math.sin(Math.PI*t)*7; return add(p,mul(n,k)); })):L('m1','crv',...s1[0],...s1[1]),L('m2','crv',...s2[0],...s2[1])];
    const end=add(O,mul(u,70)), beg=add(O,mul(u,-70));
    const base=[L('','o',...cone[0][0],...cone[0][1]),L('','o',...cone[1][0],...cone[1][1]),L('','o',cone[0][1][0],0,cone[1][1][0],0),L('','cl',0,-V.Sz-6,0,4),
      L('','o',...add(beg,mul(n,V.r)),...add(end,mul(n,V.r))),L('','o',...add(beg,mul(n,-V.r)),...add(end,mul(n,-V.r))),L('','cl',...beg,...end),C('','cl',O[0],O[1],V.r),Pt('',0,-V.Sz,'S″',1,{c:'o',r:1}),Pt('',O[0],O[1],'O″',-1,{c:'o',r:.8})];
    const b=bbox([S,cone[0][1],cone[1][1],beg,end,add(beg,mul(n,V.r)),add(end,mul(n,-V.r))]); if(b[2]>240||b[3]>240) return null;
    return {box:b,axis:0,base,E,_P:P};
  },
  traps:{
    Cv:{b0:-.2,say:'Плоская кривая ⟂ π₂ проецируется в отрезок',src:'Ж §38.1, с. 125',hl:['m1']},
    Ad:{b0:.5,say:'Отрезки соединяют противоположные точки очерков — «крест-накрест»',src:'Ж §38.1, рис. 205–207',hl:['m1','m2']},
    Ep:{b0:.3,say:'Концы отрезков — точки пересечения очерков',src:'Ж §38.1, с. 125',hl:['m1']}}
});

/* ══ f4a · поверхность с плоскостью параллелизма π₁: образующие горизонтальны (на π₂ ∥ x); каждая — между точками
   направляющих одной высоты: d₁ — фронтальная прямая, d₂ — дуга во фронтальной плоскости y = yq ══ */
PREP.topic('f4a',{
  make(){ const R=rnd(22,28), cx=rnd(15,25), cz=rnd(34,40); return {R,cx,cz,xa:rnd(-52,-44),xb:rnd(-34,-26),za:cz-R*.5-4,zb:cz+R*.5+4,y1:rnd(12,18),yq:rnd(32,40),n:5}; },
  watch:{steps:[
    {cap:'Направляющие: прямая d₁ и дуга d₂. Плоскость параллелизма — π₁',roles:[]},
    {cap:'Образующие ∥ π₁ — на π₂ горизонтальны, концы на одной высоте',roles:['g2']},
    {cap:'На π₁ — от d₁′ до d₂′ по линиям связи',roles:['g2','g1']}]},
  scene(V,trap){
    const x1=z=>V.xa+(V.xb-V.xa)*(z-V.za)/(V.zb-V.za), E=[];
    const pts=[]; for(let i=1;i<=V.n;i++){ const a=Math.PI*i/(V.n+1); pts.push([V.cx+V.R*Math.cos(a),V.cz+V.R*Math.sin(a)-V.R*.5]); }
    pts.forEach((p,i)=>{ let z1=p[1]; if(trap==='Hz'&&i===2) z1=p[1]+sgn()*rnd(6,9); E.push(L('g2','b',x1(z1),-z1,p[0],-p[1])); });
    pts.forEach((p,i)=>{ let q=[p[0],V.yq]; if(trap==='Wd'&&i===2) q=[p[0],V.y1]; let x0=x1(p[1]); if(trap==='Lk'&&i===2) x0+=sgn()*rnd(5,7); E.push(L('g1','c',x0,V.y1,...q)); });
    const arc=Array.from({length:25},(_,i)=>{ const a=Math.PI*i/24; return [V.cx+V.R*Math.cos(a),-(V.cz+V.R*Math.sin(a)-V.R*.5)]; });
    const base=[L('','o',V.xa,-V.za,V.xb,-V.zb),Tx('',V.xb+1,-V.zb-1,'d₁″'),PL('','o',arc),Tx('',V.cx+V.R+1,-(V.cz-V.R*.5),'d₂″'),
      L('','o',V.xa,V.y1,V.xb,V.y1),Tx('',V.xa-1,V.y1+1,'d₁′','end'),L('','o',V.cx-V.R-4,V.yq,V.cx+V.R+4,V.yq),Tx('',V.cx+V.R+5,V.yq+1,'d₂′')];
    return {box:bbox([[V.xa,-V.zb],[V.cx+V.R+10,-(V.cz+V.R)],[V.cx+V.R+10,V.yq+8]]),axis:0,base,E};
  },
  traps:{
    Hz:{b0:-.2,say:'Образующие ∥ π₁ — на π₂ параллельны оси x',src:'Ж с. 83, 92; М с. 12–13',hl:['g2']},
    Wd:{b0:.4,say:'Конец образующей — на своей направляющей d₂',src:'Ж с. 83; М с. 13',hl:['g1']},
    Lk:{b0:-.8,say:'Концы образующей на π₁ и π₂ — на одной линии связи',src:'Ж с. 83',hl:['g1']}}
});

/* ══ f4b · винтовая линия: равные углы на π₁ ⇔ равные подъёмы на π₂ (шаг делим как окружность) ══ */
PREP.topic('f4b',{
  make(){ return {R:rnd(18,24),p:rnd(60,80),Y0:rnd(40,48),n:12}; },
  watch:{steps:[{cap:'Окружность на π₁ делим на 12 равных частей',roles:['d1']},{cap:'Шаг на π₂ делим на 12 равных частей',roles:['d1','d2']},{cap:'Точка k — на k-й линии связи и k-м уровне: гелиса',roles:['d1','d2','hx']}]},
  scene(V,trap){ const {R,p,Y0,n}=V, P1=[], P2=[];
    for(let k=0;k<=n;k++){ const a=2*Math.PI*(trap==='Ck'&&k>0&&k<n?Math.pow(k/n,1.3):k/n); let z=p*k/n; if(trap==='Uq'&&k>0&&k<n) z=p*Math.pow(k/n,1.35); P1.push([R*Math.cos(a),Y0+R*Math.sin(a)]); P2.push([R*Math.cos(a),-z]); }
    if(trap==='Lk'){ const k=3+(Math.random()*5|0); P2[k]=[P1[k+1][0],P2[k][1]]; }   /* точку снесли не со своей линии связи */
    const E=[...P1.map((q,k)=>Pt('d1',...q,null,1,{c:'o',r:.8})),...P2.map((q,k)=>L('d2','lk',-R-6,q[1],R+6,q[1])),PL('hx','crv',P2)];
    const base=[C('','o',0,Y0,R),L('','cl',0,-p-6,0,Y0+R+4),L('','o',-R,0,-R,-p),L('','o',R,0,R,-p),L('','cl',-R-4,Y0,R+4,Y0),Tx('',R+2,-p/2,'шаг p')];
    return {box:bbox([[-R-8,-p-8],[R+12,Y0+R+6]]),axis:0,base,E};
  },
  traps:{
    Lk:{b0:-.5,say:'Точка k — на k-й линии связи',src:'Ж с. 75',hl:['hx']},
    Ck:{b0:.1,say:'Окружность делят на равные части',src:'Ж с. 75, 92',hl:['d1','hx']},
    Uq:{b0:.2,say:'Равномерное вращение — равномерный подъём: шаг делят на равные части',src:'Ж с. 75, 92',hl:['d2','hx']}}
});
})();
