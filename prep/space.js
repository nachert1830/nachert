/* ═══════════ PREP · 3D к ключевым темам: тот же шаг в пространстве ═══════════
   Мир: x — как на эпюре (в темах с координатами X = −x), y — к зрителю, z — вверх. π₁ — плоскость z = 0 (y ≥ 0), π₂ — y = 0 (z ≥ 0).
   Роли — те же, что у элементов эпюра: 3D достраивается по шагам «Смотри». pr у точки — роли точек эпюра, в которые
   она проецируется на π₁ (h: (x, y)) и π₂ (f: (x, −z)); tests/prep.js сверяет это на каждой теме. */
(function(){
'use strict';
if(!self.PREP) return;
const T=PREP.TOPICS, F=PREP.frame3, P3=PREP.point3;
const seg=(a,b,c,role,o)=>Object.assign({t:'seg',a,b,c,role},o||{}), pt=(p,lab,pr,role,c)=>({t:'pt',p,lab,pr,role,c});
/* окружность: c — центр, n — нормаль; цвет храним в col (поле c занято центром) */
const ring=(c,n,r,col,role,o)=>Object.assign({t:'circ',c:col,role},o||{},{c0:c,n,r});
const lerp=(A,B,t)=>A.map((v,i)=>v+(B[i]-v)*t);
const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], mul3=(a,k)=>a.map(v=>v*k);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], nrm3=a=>{ const l=Math.hypot(...a); return a.map(v=>v/l); };
const extent=(pts,pad)=>{ const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]), zs=pts.map(p=>p[2]); return [Math.min(...xs)-pad,Math.max(...xs)+pad,Math.max(...ys,10)+pad,Math.max(...zs,10)+pad]; };
const cone=(cx,cy,R,H,role)=>{ const r=[]; for(let i=0;i<16;i++){ const a=i/16*2*Math.PI; r.push(seg([cx+R*Math.cos(a),cy+R*Math.sin(a),0],[cx,cy,H],'o',role,{w:.45})); } r.push(ring([cx,cy,0],[0,0,1],R,'o',role)); return r; };
const hemi=(cx,cy,R,role)=>{ const r=[]; for(let i=0;i<6;i++){ const z=R*i/6; r.push(ring([cx,cy,z],[0,0,1],Math.sqrt(R*R-z*z),'o',role,{w:i?.45:1})); }
  for(let i=0;i<12;i++){ const a=i/12*Math.PI*2, p=[]; for(let j=0;j<=16;j++){ const f=j/16*Math.PI/2; p.push([cx+R*Math.cos(f)*Math.cos(a),cy+R*Math.cos(f)*Math.sin(a),R*Math.sin(f)]); } r.push({t:'poly',p,c:'o',role,w:.45}); } return r; };

/* p1 · точка и её проекции: опускаем перпендикуляры на π₂ и π₁ */
T.p1.space=V=>{ const [x,y,z]=V.A, A=[-x,y,z], A2=[-x,0,z], A1=[-x,y,0], Ax=[-x,0,0];
  return [...F(-70,12,48,48),pt(A,'A',{h:'A1',f:'A2'},'',''),seg(A,A2,'lk','A2',{dash:true}),pt(A2,'A″',null,'A2','o'),seg(A,A1,'lk','A1',{dash:true}),pt(A1,'A′',null,'A1','o'),
    seg(A2,Ax,'lk','lk'),seg(A1,Ax,'lk','lk'),pt([0,0,0],'O',null,'','o')]; };

/* l4 · натуральная величина: в пространстве AB — гипотенуза треугольника с катетами «как A′B′» и Δz */
T.l4.space=V=>{ const {A,B}=V, lo=A[2]<B[2]?A:B, hi=A[2]<B[2]?B:A, Bs=[hi[0],hi[1],lo[2]], e=extent([A,B],12);
  return [...F(e[0],e[1],e[2],e[3]),seg(A,B,'o',''),seg([A[0],A[1],0],[B[0],B[1],0],'o',''),seg([A[0],0,A[2]],[B[0],0,B[2]],'o',''),
    ...[A,B].flatMap(p=>[seg(p,[p[0],p[1],0],'lk','',{dash:true}),seg(p,[p[0],0,p[2]],'lk','',{dash:true})]),
    seg(lo,Bs,'a','leg'),seg(Bs,hi,'a','leg'),pt(A,'A',{h:'A1',f:'A2'},'',''),pt(B,'B',{h:'B1',f:'B2'},'',''),seg(A,B,'crv','nv',{w:1.3})]; };

/* s3 · горизонталь и фронталь плоскости: h ∥ π₁, f ∥ π₂ */
T.s3.space=function(V){ const {A,B,C}=V, onBC=(k,val)=>{ const t=(val-B[k])/(C[k]-B[k]); return lerp(B,C,t); }, Pp=onBC(2,A[2]), Q=onBC(1,A[1]), e=extent([A,B,C],10);
  return [...F(e[0],e[1],e[2],e[3]),{t:'poly',p:[A,B,C,A],c:'o',role:''},{t:'quad',p:[A,B,C,C],c:'a',role:''},
    seg(A,Pp,'a','h2',{w:1.3}),pt(Pp,'1',{h:'p1h',f:'p1f'},'p1f','o'),seg([A[0],A[1],0],[Pp[0],Pp[1],0],'a','h1'),seg([A[0],0,A[2]],[Pp[0],0,Pp[2]],'a','h2'),
    seg(A,Q,'c','f1',{w:1.3}),pt(Q,'2',{h:'p2h',f:'p2f'},'p2h','o'),seg([A[0],0,A[2]],[Q[0],0,Q[2]],'c','f2'),seg([A[0],A[1],0],[Q[0],Q[1],0],'c','f1')]; };

/* m4 · точка встречи: через l — вертикальная плоскость γ; γ ∩ ABC = 12; K = l ∩ 12 */
T.m4.space=function(V){ const {A,B,C,K,Dp,Ep}=V, e=extent([A,B,C,Dp,Ep],10);
  const hits=[]; for(const [P,Q] of [[A,B],[B,C],[C,A]]){ const d1=[Ep[0]-Dp[0],Ep[1]-Dp[1]], d2=[Q[0]-P[0],Q[1]-P[1]], den=d1[0]*d2[1]-d1[1]*d2[0]; if(Math.abs(den)<1e-9) continue;
    const s=((P[0]-Dp[0])*d2[1]-(P[1]-Dp[1])*d2[0])/den, u=((P[0]-Dp[0])*d1[1]-(P[1]-Dp[1])*d1[0])/den; if(u>=0&&u<=1) hits.push(lerp(P,Q,u)); }
  if(hits.length!==2) return [];   /* нумерация — по сторонам AB, BC, CA, как на эпюре */
  const top=Math.max(Dp[2],Ep[2],A[2],B[2],C[2])+6, g=[[Dp[0],Dp[1],0],[Ep[0],Ep[1],0],[Ep[0],Ep[1],top],[Dp[0],Dp[1],top]];
  return [...F(e[0],e[1],e[2],e[3]),{t:'poly',p:[A,B,C,A],c:'o',role:''},{t:'quad',p:[A,B,C,C],c:'b',role:''},seg(Dp,Ep,'d','',{w:1.2}),
    {t:'quad',p:g,c:'a',role:'p1h'},pt(hits[0],'1',{h:'p1h',f:'p1f'},'p1h','o'),pt(hits[1],'2',{h:'p2h',f:'p2f'},'p2h','o'),seg(hits[0],hits[1],'a','s12',{w:1.3}),
    ...P3(K,'K2','K',{h:'K1',f:'K2'})]; };

/* t2 · замена: π₃ ⟂ π₁ и ∥ AB; на π₃ отрезок виден в натуральную величину */
T.t2.space=function(V){ const {A,B}=V, a1=[A[0],A[1]], b1=[B[0],B[1]], l=Math.hypot(b1[0]-a1[0],b1[1]-a1[1]), u=[(b1[0]-a1[0])/l,(b1[1]-a1[1])/l]; let n=[-u[1],u[0]]; if(n[1]<0) n=n.map(v=>-v);
  const Q=[a1[0]+n[0]*V.off,a1[1]+n[1]*V.off], ft=(p,d)=>[Q[0]+u[0]*((p[0]-Q[0])*u[0]+(p[1]-Q[1])*u[1]),Q[1]+u[1]*((p[0]-Q[0])*u[0]+(p[1]-Q[1])*u[1]),d];
  const A3=ft(a1,A[2]), B3=ft(b1,B[2]), top=Math.max(A[2],B[2])+8, a0=ft(a1,0), b0=ft(b1,0), ext=(p,q,k)=>[q[0]+(q[0]-p[0])*k,q[1]+(q[1]-p[1])*k,q[2]];
  const q0=ext(b0,a0,.3), q1=ext(a0,b0,.3), e=extent([A,B,A3,B3],10);
  return [...F(e[0],e[1],Math.max(e[2],q0[1],q1[1])+4,e[3]),seg(A,B,'o',''),seg([A[0],A[1],0],[B[0],B[1],0],'o',''),pt(A,'A',{h:'A1',f:'A2'},'',''),pt(B,'B',{h:'B1',f:'B2'},'',''),
    {t:'quad',p:[q0,q1,[q1[0],q1[1],top],[q0[0],q0[1],top]],c:'a',role:'x1'},seg(q0,q1,'a','x1'),
    seg(A,A3,'lk','la',{dash:true}),seg(B,B3,'lk','lb',{dash:true}),pt(A3,'A‴',null,'A3'),pt(B3,'B‴',null,'B3'),seg(A3,B3,'crv','nv',{w:1.3})]; };

/* m7a · вращение вокруг горизонтали: B идёт по окружности в плоскости ⟂ h, центр O на h, до уровня h */
T.m7a.space=function(V){ const h0=[V.h0[0],V.h0[1],V.zh], h1=[V.h1[0],V.h1[1],V.zh], eh=nrm3(sub3(h1,h0)), B=V.B, O=add3(h0,mul3(eh,dot3(sub3(B,h0),eh))), R=Math.hypot(...sub3(B,O));
  const d=[B[0]-O[0],B[1]-O[1]], l=Math.hypot(...d), side=V.side||-1, B0=[O[0]+d[0]/l*R*side,O[1]+d[1]/l*R*side,V.zh], e=extent([h0,h1,B,B0],10);
  return [...F(e[0],e[1],e[2],e[3]),seg(h0,h1,'a','',{w:1.3}),seg([h0[0],h0[1],0],[h1[0],h1[1],0],'a',''),pt(B,'B',null,'',''),...P3(O,'tr','O',{h:'O'},'o'),
    seg(O,B,'a','hyp'),ring(O,eh,R,'a','arc'),pt(B0,'B₀',{h:'B0'},'B0'),seg([B0[0],B0[1],0],B0,'lk','B0',{dash:true})]; };

/* f3 · точка на поверхности вращения: параллель — окружность в плоскости уровня, на π₁ без искажения */
T.f3.space=function(V){ const r=V.rAt(V.z), A=[V.x,V.y,V.z], surf=V.kind==='cone'?cone(0,V.Y0-V.Y0,V.R,V.H,''):hemi(0,0,V.R,'');
  const sh=p=>[p[0],p[1]+V.Y0,p[2]];   /* ось тела — над точкой (0, Y0) π₁ */
  const S=surf.map(q=>{ const o=Object.assign({},q); if(o.a){ o.a=sh(o.a); o.b=sh(o.b); } if(o.p) o.p=o.p.map(sh); if(o.c0) o.c0=sh(o.c0); return o; });
  const Aw=sh(A), e=extent([sh([-V.R,-V.R,0]),sh([V.R,V.R,V.top])],8);
  return [...F(e[0],e[1],e[2],e[3]),...S,ring(sh([0,0,V.z]),[0,0,1],r,'a','par',{w:1.4}),ring(sh([0,0,0]),[0,0,1],r,'a','cir',{dash:true}),
    ...P3(Aw,'A1','A',{h:'A1'})]; };

/* x1 · сечение конуса фронтально-проецирующей плоскостью α: на π₂ — след, параллель через точку даёт 2 и 3 */
T.x1.space=function(V){ const sh=p=>[p[0],p[1]+V.Y0,p[2]], S=cone(0,0,V.R,V.H,'').map(q=>{ const o=Object.assign({},q); if(o.a){ o.a=sh(o.a); o.b=sh(o.b); } if(o.c0) o.c0=sh(o.c0); return o; });
  const x=V.xp, z=V.zf(x), r=V.rAt(z), y=Math.sqrt(Math.max(0,r*r-x*x)), P2=sh([x,y,z]), P3w=sh([x,-y,z]);
  const sec=[]; for(let i=0;i<=72;i++){ const a=i/72*2*Math.PI; /* точка конуса в плоскости: z = zf(x) */ let lo=0, hi=V.H; for(let k=0;k<40;k++){ const m=(lo+hi)/2, rr=V.rAt(m), xx=rr*Math.cos(a), f=m-V.zf(xx); if(f>0) hi=m; else lo=m; } const rr=V.rAt(lo); sec.push(sh([rr*Math.cos(a),rr*Math.sin(a),lo])); }
  const xa=-V.R-10, xb=V.R+10, ya=V.Y0-V.R-8, yb=V.Y0+V.R+8, pl=[[xa,ya,V.zf(xa)],[xb,ya,V.zf(xb)],[xb,yb,V.zf(xb)],[xa,yb,V.zf(xa)]];
  const e=extent([[xa,ya,0],[xb,yb,V.H]],6);
  return [...F(e[0],e[1],e[2],e[3]),...S,{t:'quad',p:pl,c:'c',role:''},{t:'poly',p:sec,c:'crv',role:''},
    ring(sh([0,0,z]),[0,0,1],r,'a','par',{w:1.4}),pt(P2,'2',{h:'p2h',f:'p2f'},'p2h'),pt(P3w,'3',{h:'p3h',f:'p2f'},'p3h')]; };

/* x3 · посредник — горизонтальная плоскость γ: режет сферу и конус по окружностям; их пересечение — точки линии */
T.x3.space=function(V){ const h=V._h!=null?V._h:V.hmax*.42, rs=Math.sqrt(V.R*V.R-h*h), rc=V.Rc*(1-h/V.Hc), P=V.P(h); if(!P) return [];
  const pts=P.slice().sort((a,b)=>a[0]-b[0]), e=extent([[-V.R,V.Ys-V.R,0],[Math.max(V.R,V.xc+V.Rc),V.Ys+V.R,Math.max(V.R,V.Hc)]],6);
  const S=[...hemi(0,V.Ys,V.R,''),...cone(V.xc,V.yc,V.Rc,V.Hc,'')];
  return [...F(e[0],e[1],e[2],e[3]),...S,{t:'quad',p:[[e[0],V.Ys-V.R-8,h],[e[1],V.Ys-V.R-8,h],[e[1],V.Ys+V.R+8,h],[e[0],V.Ys+V.R+8,h]],c:'a',role:'sig'},
    ring([0,V.Ys,h],[0,0,1],rs,'b','chS',{w:1.5}),ring([V.xc,V.yc,h],[0,0,1],rc,'c','chC',{w:1.5}),
    pt([pts[0][0],pts[0][1],h],'1',{h:'p1h',f:'p1f'},'p1h'),pt([pts[1][0],pts[1][1],h],'2',{h:'p2h',f:'p2f'},'p2h'),
    {t:'poly',p:V.curve.map(c=>[c[0],c[1],c[2]]),c:'crv',role:'p1f',w:.8}]; };

/* x8 · прямая и конус: плоскость через AB и вершину S режет конус по образующим SP, SQ */
T.x8.space=function(V){ const S=[0,0,V.H], A=V.A, B=V.B, sh=p=>[p[0],p[1]+V.Y0,p[2]], pierce=Pp=>lerp(S,Pp,V.H/(V.H-Pp[2]));
  const M=pierce(A), N=pierce(B), u=[N[0]-M[0],N[1]-M[1]], a=u[0]*u[0]+u[1]*u[1], bq=2*(M[0]*u[0]+M[1]*u[1]), cq=M[0]*M[0]+M[1]*M[1]-V.R*V.R, d=bq*bq-4*a*cq; if(d<0) return [];
  const t1=(-bq-Math.sqrt(d))/(2*a), t2=(-bq+Math.sqrt(d))/(2*a), Pp=[M[0]+u[0]*t1,M[1]+u[1]*t1,0], Q=[M[0]+u[0]*t2,M[1]+u[1]*t2,0];
  const meet=G=>{ /* AB ∩ SG в пространстве: точка AB, у которой проекция на π₁ лежит на S′G′ */ const dx=B[0]-A[0], dy=B[1]-A[1], den=dx*G[1]-dy*G[0]; const s=(G[0]*A[1]-G[1]*A[0])/den; return lerp(A,B,s); };
  const K=[meet(Pp),meet(Q)].sort((p,q)=>p[0]-q[0]), e=extent([sh([-V.R,-V.R,0]),sh([V.R,V.R,V.H]),sh(A),sh(B),sh(M),sh(N)],6);
  return [...F(e[0],e[1],e[2],e[3]),...cone(0,V.Y0,V.R,V.H,''),seg(sh(A),sh(B),'o','',{w:1.3}),pt(sh(A),'A',null,'',''),pt(sh(B),'B',null,'',''),
    seg(sh(S),sh(M),'a','sa2'),seg(sh(S),sh(N),'a','sb2'),pt(sh(M),'M',{h:'M'},'M','o'),pt(sh(N),'N',{h:'N'},'N','o'),{t:'quad',p:[sh(S),sh(M),sh(N),sh(N)],c:'a',role:'mn'},seg(sh(M),sh(N),'a','mn'),
    seg(sh(S),sh(Pp),'c','g1',{w:1.4}),seg(sh(S),sh(Q),'c','g2',{w:1.4}),pt(sh(K[0]),'K₁',{h:'k1h',f:'k1f'},'k1h'),pt(sh(K[1]),'K₂',{h:'k2h',f:'k2f'},'k2h')]; };
})();
