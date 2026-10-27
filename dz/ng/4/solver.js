/* ═══════════ ДЗ №4 · решатель: линии пересечения поверхностей, все 30 вариантов ═══════════
   Тела каждого чертежа-типа строятся по размерам варианта (dz/ng/4/variants.js), линии пересечения и очерки считает
   ядро поверхностей (dz/ng/4/surf.js). Разбор идёт тем способом, который подходит паре тел: горизонтальные или
   фронтальные плоскости, концентрические или эксцентрические сферы, плоскости через вершину конуса.
   Посредники и точки на чертеже — те же, что дают числа: каждая точка лежит на обеих поверхностях (проверка — в cert).
   На чертеже-типе «вправо» — это уменьшение x (ось x эпюра направлена влево); главный центр — на расстоянии 100 мм
   от оси x (размер 100 на чертеже-типе). */
(function(){
const {F,H,S,seg,pt,conn,poly,ln,circ,axis,STEP,fmt,table,point}=NGLIB;
const Q=NG4S, {add,sub,mul,dot,cross,len,unit,dist}=Q;
const D2R=Math.PI/180, Y0=100;
const DU=[-1,0,0], DW=[0,1,0], DZ=[0,0,1];

/* ── тела чертежей-типов. M(u, w, z): u — вправо по листу, w — к зрителю, z — вверх; xs — абсцисса главного центра ── */
function bodiesOf(code,D,xs){
  const M=(u,w,z)=>[xs-u,Y0+w,z], uw=p=>[xs-p[0],p[1]-Y0], O=[];
  const disc=(c,e1,e2,r)=>Q.disc(c,e1,e2,r);
  const ring=(c,e1,e2,r,a0,a1,n)=>{ const o=[]; a0=a0||0; a1=a1==null?2*Math.PI:a1; n=n||96; for(let i=0;i<=n;i++){ const a=a0+(a1-a0)*i/n; o.push(add(c,add(mul(e1,r*Math.cos(a)),mul(e2,r*Math.sin(a))))); } return o; };
  const line=(a,b,n)=>{ const o=[]; n=n||40; for(let i=0;i<=n;i++) o.push(Q.lerp(a,b,i/n)); return o; };
  const vaxis=(u,w,z0,z1,r)=>[ {v:'F',p:[M(u,w,z0),M(u,w,z1)]}, {v:'H',p:[M(u-r,w,0),M(u+r,w,0)]}, {v:'H',p:[M(u,w-r,0),M(u,w+r,0)]} ];
  const yaxis=(u,z,w0,w1,r)=>[ {v:'F',p:[M(u-r,0,z),M(u+r,0,z)]}, {v:'F',p:[M(u,0,z-r),M(u,0,z+r)]}, {v:'H',p:[M(u,w0,z),M(u,w1,z)]} ];
  /* вертикальное тело вращения: ρ(z) */
  const inRev=(c,prof,z0,z1)=>p=>{ if(p[2]<z0-1e-9||p[2]>z1) return false; const [u,w]=uw(p); return Math.hypot(u-c[0],w-c[1])<prof(p[2]); };
  if(code==='4a1'){ const {Dk,Hk,Xk,Xc,Zc}=D, za=110-Hk, rk=z=>Dk/2*(z-za)/Hk;
    const T={id:'T',nom:'полутор',gen:'полутора',ins:'полутор',secz:'кривым четвёртого порядка',secy:'двум концентрическим окружностям',
      inside:p=>{ if(p[2]<0) return false; const [u,w]=uw(p); return Math.hypot(Math.hypot(u,p[2])-60,w)<40; },
      patches:[Q.torus(M(0,0,0),DW,60,40,[0,Math.PI],null,DU)],
      edges:[{only:'H',pts:ring(M(60,0,0),DU,DW,40)},{only:'H',pts:ring(M(-60,0,0),DU,DW,40)}],
      axes:[{v:'F',p:ring(M(0,0,0),DU,DZ,60,0,Math.PI,60)},{v:'F',p:[M(0,0,-6),M(0,0,108)]},{v:'H',p:[M(0,-48,0),M(0,48,0)]},{v:'H',p:[M(-60,-48,0),M(-60,48,0)]},{v:'H',p:[M(60,-48,0),M(60,48,0)]}]};
    const K={id:'K',nom:'конус',gen:'конуса',ins:'конус',secz:'окружности',secy:'гиперболе',
      inside:inRev([-Xk,0],rk,0,110),
      patches:[Q.cone(M(-Xk,0,0),DZ,rk(0),Dk/2,0,110), disc(M(-Xk,0,110),DU,DW,Dk/2)],
      edges:[{pts:ring(M(-Xk,0,110),DU,DW,Dk/2)},{only:'H',pts:ring(M(-Xk,0,0),DU,DW,rk(0))}],
      axes:vaxis(-Xk,0,za-4,115,Dk/2+4), apex:M(-Xk,0,za)};
    const C={id:'C',nom:'полуцилиндр',gen:'полуцилиндра',ins:'полуцилиндр',secz:'двум образующим',secy:'полуокружности, совпадающей с его проекцией на π₂',proj:'F',
      inside:p=>{ const [u,w]=uw(p); return Math.abs(w)<55&&p[2]>Zc&&Math.hypot(u-Xc,p[2]-Zc)<40; },
      patches:[Q.cylinder(M(Xc,-55,Zc),DW,40,0,110,[0,Math.PI],DU)].concat(Zc>0?[Q.plane(M(Xc,0,Zc),DU,DW,[-40,40],[-55,55])]:[]).concat([-55,55].map(w=>Q.plane(M(Xc,w,Zc),DU,DZ,[-40,40],[0,40]))),
      edges:[-55,55].map(w=>({pts:ring(M(Xc,w,Zc),DU,DZ,40,0,Math.PI,60)})).concat([-55,55].map(w=>({only:Zc>0?'FH':'H',pts:line(M(Xc-40,w,Zc),M(Xc+40,w,Zc))})),[-40,40].map(d=>({only:Zc>0?'FH':'H',pts:line(M(Xc+d,-55,Zc),M(Xc+d,55,Zc))}))),
      axes:yaxis(Xc,Zc,-60,60,44)};
    return {bodies:[T,K,C],pairs:[['T','C','y'],['T','K','ecc'],['K','C','z']],
      ecc:{T:{c:M(0,0,0)},K:{u:-Xk}},M,size:{u:[-Xk-Dk/2,Math.max(100,Xc+40)],z:110}}; }
  if(code==='4a2'){ const {Dk,dk,Xk,Yk,Xc,Yc}=D, rk=z=>Dk/2+(dk-Dk)/2*z/100, rf=Math.sqrt(80*80-60*60), sa=Math.asin(60/80);
    const Sph={id:'S',nom:'полусфера',gen:'полусферы',ins:'полусферу',secz:'окружности',secy:'окружности',
      inside:p=>{ const [u,w]=uw(p); return p[2]>=0&&Math.abs(w)<60&&Math.hypot(u,w,p[2])<80; },
      patches:[Q.sphere(M(0,0,0),80), ...[-60,60].map(w=>Q.plane(M(0,w,0),DU,DZ,[-80,80],[0,80]))],
      edges:[{only:'H',pts:ring(M(0,0,0),DU,DW,80,-sa,sa,40)},{only:'H',pts:ring(M(0,0,0),DU,DW,80,Math.PI-sa,Math.PI+sa,40)},
        ...[-60,60].map(w=>({pts:ring(M(0,w,0),DU,DZ,rf,0,Math.PI,72)})), ...[-60,60].map(w=>({only:'H',pts:line(M(-rf,w,0),M(rf,w,0))}))],
      axes:[{v:'F',p:[M(0,0,-6),M(0,0,88)]},{v:'H',p:[M(0,-68,0),M(0,68,0)]}]};
    const K={id:'K',nom:'усечённый конус',gen:'конуса',ins:'конус',secz:'окружности',secy:'гиперболе',
      inside:inRev([Xk,Yk],rk,0,100),
      patches:[Q.cone(M(Xk,Yk,0),DZ,Dk/2,dk/2,0,100), disc(M(Xk,Yk,100),DU,DW,dk/2)],
      edges:[{pts:ring(M(Xk,Yk,100),DU,DW,dk/2)},{only:'H',pts:ring(M(Xk,Yk,0),DU,DW,Dk/2)}],
      axes:vaxis(Xk,Yk,-5,105,Dk/2+4)};
    const C={id:'C',nom:'цилиндр',gen:'цилиндра',ins:'цилиндр',secz:'окружности, совпадающей с его проекцией на π₁',secy:'двум образующим',proj:'H',
      inside:inRev([-Xc,Yc],()=>30,0,100),
      patches:[Q.cylinder(M(-Xc,Yc,0),DZ,30,0,100), disc(M(-Xc,Yc,100),DU,DW,30)],
      edges:[{pts:ring(M(-Xc,Yc,100),DU,DW,30)},{only:'H',pts:ring(M(-Xc,Yc,0),DU,DW,30)}],
      axes:vaxis(-Xc,Yc,-5,105,34)};
    return {bodies:[Sph,K,C],pairs:[['S','C','z'],['S','K','z'],['K','C','z']],M,size:{u:[Math.min(-80,-Xc-30),Math.max(80,Xk+Dk/2)],z:100}}; }
  if(code==='4a3'){ const {Dk,phi,alpha,beta}=D, rb=125*Math.tan(30*D2R), f=phi*D2R, d=[Math.cos(f),0,Math.sin(f)], Ap=M(rb,0,0);
    const ta=Math.tan(alpha*D2R), tb=Math.tan(beta*D2R), ua=55*ta/(ta+tb), za=ua*tb, rn=t=>Dk/2*t/150, Bc=add(Ap,mul(d,150));
    const e2=unit(cross(DW,d));
    const K={id:'K',nom:'конус',gen:'конуса',ins:'конус',secz:'окружности',secy:'гиперболе',
      inside:inRev([0,0],z=>rb*(125-z)/125,0,125),
      patches:[Q.cone(M(0,0,0),DZ,rb,0,0,125)],
      edges:[{only:'H',pts:ring(M(0,0,0),DU,DW,rb)}],
      axes:vaxis(0,0,-5,129,rb+6), apex:M(0,0,125)};
    const N={id:'N',nom:'наклонный конус',gen:'наклонного конуса',ins:'наклонный конус',secz:'эллипсу',secy:'гиперболе',
      inside:p=>{ const q=sub(p,Ap), t=dot(q,d); if(t<=0||t>=150) return false; return len(sub(q,mul(d,t)))<rn(t); },
      patches:[Q.cone(Ap,d,0,Dk/2,0,150), disc(Bc,DW,e2,Dk/2)],
      edges:[{pts:ring(Bc,DW,e2,Dk/2)}],
      axes:[{v:'F',p:[sub(Ap,mul(d,6)),add(Bc,mul(d,10))]},{v:'H',p:[sub(Ap,mul(d,6)),add(Bc,mul(d,10))]}], apex:Ap};
    const inTri=(u,z)=>z>0&&z<u*tb&&z<(55-u)*ta;
    const top=M(ua,0,za);
    const P={id:'P',nom:'призма',gen:'призмы',ins:'призму',secz:'двум прямым',secy:'треугольнику',proj:'F',
      inside:p=>{ const [u,w]=uw(p); return Math.abs(w)<80&&inTri(u,p[2]); },
      patches:[Q.plane(M(0,-80,0),DW,unit(sub(top,M(0,0,0))),[0,160],[0,Math.hypot(ua,za)]), Q.plane(M(55,-80,0),DW,unit(sub(top,M(55,0,0))),[0,160],[0,Math.hypot(55-ua,za)]),
        ...[-80,80].map(w=>Q.plane(M(0,w,0),DU,DZ,[0,55],[0,za]))],
      edges:[{pts:line(M(ua,-80,za),M(ua,80,za))},{only:'H',pts:line(M(0,-80,0),M(0,80,0))},{only:'H',pts:line(M(55,-80,0),M(55,80,0))},
        ...[-80,80].flatMap(w=>[{pts:line(M(0,w,0),M(ua,w,za))},{pts:line(M(55,w,0),M(ua,w,za))},{only:'H',pts:line(M(0,w,0),M(55,w,0))}])],
      axes:[]};
    return {bodies:[K,N,P],pairs:[['K','N','sph'],['K','P','z'],['N','P','pa']],sphC:M(0,0,rb*Math.tan(f)),apex:Ap,M,
      size:{u:[Math.min(-rb,-150*Math.cos(f)+rb-Dk/2),rb],z:125}}; }
  if(code==='4b1'){ const {Dp,Xp,Yp,Xt,Yt}=D, rp=Dp/2, s3=Math.sqrt(3)/2;
    const V=[[-Xp,Yp+rp],[-Xp-rp*s3,Yp-rp/2],[-Xp+rp*s3,Yp-rp/2]], fm=Math.acos(20/60);
    const Sph={id:'S',nom:'полусфера',gen:'полусферы',ins:'полусферу',secz:'окружности',secy:'окружности',
      inside:p=>{ const [u,w]=uw(p); return p[2]>=0&&Math.hypot(u,w,p[2])<75; },
      patches:[Q.sphere(M(0,0,0),75)], edges:[{only:'H',pts:ring(M(0,0,0),DU,DW,75)}],
      axes:[{v:'F',p:[M(0,0,-6),M(0,0,83)]},{v:'H',p:[M(0,-83,0),M(0,83,0)]},{v:'H',p:[M(-83,0,0),M(83,0,0)]}]};
    const side=(a,b)=>{ const A=M(a[0],a[1],0), Bv=M(b[0],b[1],0); return Q.plane(A,unit(sub(Bv,A)),DZ,[0,dist(A,Bv)],[0,95]); };
    const inTri=(u,w)=>{ for(let i=0;i<3;i++){ const a=V[i], b=V[(i+1)%3], c=V[(i+2)%3], cr=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]); if(cr(a,b,[u,w])*cr(a,b,c)<=0) return false; } return true; };
    const P={id:'P',nom:'призма',gen:'призмы',ins:'призму',secz:'треугольнику, совпадающему с её проекцией на π₁',secy:'двум вертикальным прямым',proj:'H',
      inside:p=>{ if(p[2]<0||p[2]>95) return false; const [u,w]=uw(p); return inTri(u,w); },
      patches:[side(V[0],V[1]),side(V[1],V[2]),side(V[2],V[0]), Q.plane(M(-Xp,Yp,95),DU,DW,[-rp,rp],[-rp,rp])],
      edges:V.flatMap((a,i)=>{ const b=V[(i+1)%3]; return [{pts:line(M(a[0],a[1],0),M(a[0],a[1],95))},{pts:line(M(a[0],a[1],95),M(b[0],b[1],95))},{only:'H',pts:line(M(a[0],a[1],0),M(b[0],b[1],0))}]; }),
      axes:[{v:'F',p:[M(-Xp,Yp,-6),M(-Xp,Yp,103)]},{v:'H',p:[M(-Xp-rp-6,Yp,0),M(-Xp+rp+6,Yp,0)]},{v:'H',p:[M(-Xp,Yp-rp-6,0),M(-Xp,Yp+rp+6,0)]}], tri:V};
    const L={id:'L',nom:'тор',gen:'тора',ins:'тор',secz:'кривой',secy:'окружности',
      inside:p=>{ const [u,w]=uw(p), h=w-Yt; return Math.hypot(Math.hypot(u-Xt,p[2]-45)+20,h)<60; },
      patches:[Q.torus(M(Xt,Yt,45),DW,-20,60,null,[-fm,fm],DU)], edges:[],
      axes:yaxis(Xt,45,Yt-64,Yt+64,48)};
    return {bodies:[Sph,P,L],pairs:[['S','P','z'],['S','L','y'],['P','L','y']],M,size:{u:[Math.min(-75,-Xp-rp),Math.max(75,Xt+40)],z:95}}; }
  if(code==='4b2'){ const {Dt,Rt,Xt,Dc,Xc,Zc}=D, a=Rt-Dt/2, bm=Math.asin(40/Rt), re=Math.sqrt(Rt*Rt-1600)-a, ct=1/Math.tan(60*D2R);
    const Bt={id:'B',nom:'тор',gen:'тора',ins:'тор',secz:'кривой (строят по параллелям тора)',secy:'кривой',
      inside:p=>{ const [u,w]=uw(p), h=u+Xt; if(Math.abs(h)>=40) return false; return Math.hypot(Math.hypot(w,p[2]-50)+a,h)<Rt; },
      patches:[Q.torus(M(-Xt,0,50),DU,-a,Rt,null,[-bm,bm],DW), ...[-40,40].map(h=>disc(M(-Xt+h,0,50),DW,DZ,re))],
      edges:[-40,40].map(h=>({pts:ring(M(-Xt+h,0,50),DW,DZ,re)})),
      axes:[{v:'F',p:[M(-Xt-48,0,50),M(-Xt+48,0,50)]},{v:'F',p:[M(-Xt,0,50-Dt/2-8),M(-Xt,0,50+Dt/2+8)]},{v:'H',p:[M(-Xt-48,0,0),M(-Xt+48,0,0)]},{v:'H',p:[M(-Xt,-Dt/2-8,0),M(-Xt,Dt/2+8,0)]}]};
    const ck=z=>[z*ct,0], rk=z=>60-z/4;
    const K={id:'K',nom:'наклонный конус',gen:'конуса',ins:'конус',secz:'окружности',secy:'кривой',
      inside:p=>{ if(p[2]<0||p[2]>120) return false; const [u,w]=uw(p), c=ck(p[2]); return Math.hypot(u-c[0],w-c[1])<rk(p[2]); },
      patches:[Q.oblique([xs,Y0],[-ct,0],60,30,0,120), disc(M(120*ct,0,120),DU,DW,30)],
      edges:[{pts:ring(M(120*ct,0,120),DU,DW,30)},{only:'H',pts:ring(M(0,0,0),DU,DW,60)}],
      axes:[{v:'F',p:[M(-6*ct,0,-6),M(128*ct,0,128)]},{v:'H',p:[M(-68,0,0),M(128*ct+38,0,0)]},{v:'H',p:[M(0,-68,0),M(0,68,0)]},{v:'H',p:[M(120*ct,-38,0),M(120*ct,38,0)]}]};
    const C={id:'C',nom:'цилиндр',gen:'цилиндра',ins:'цилиндр',secz:'двум образующим',secy:'окружности, совпадающей с его проекцией на π₂',proj:'F',
      inside:p=>{ const [u,w]=uw(p); return Math.abs(w)<65&&Math.hypot(u-Xc,p[2]-Zc)<Dc/2; },
      patches:[Q.cylinder(M(Xc,-65,Zc),DW,Dc/2,0,130,null,DU), ...[-65,65].map(w=>disc(M(Xc,w,Zc),DU,DZ,Dc/2))],
      edges:[-65,65].map(w=>({pts:ring(M(Xc,w,Zc),DU,DZ,Dc/2)})),
      axes:yaxis(Xc,Zc,-72,72,Dc/2+8)};
    return {bodies:[Bt,K,C],pairs:[['B','K','z'],['K','C','z'],['B','C','z']],M,size:{u:[Math.min(-60,-Xt-40),Math.max(120*ct+30,Xc+Dc/2)],z:120}}; }
  if(code==='4b3'){ const {Xc,Zc,alpha}=D, zc=Math.sqrt(80*80-25*25), ps0=Math.asin(zc/80), al=alpha*D2R, d=[-Math.cos(al),0,Math.sin(al)], O0=M(0,0,25), E=add(O0,mul(d,100));
    const prof=z=>z<zc?100-Math.sqrt(Math.max(0,6400-(z-zc)**2)):20;
    const e2=unit(cross(DW,d));
    const R={id:'R',nom:'раструб',gen:'раструба',ins:'раструб',secz:'окружности',secy:'кривой',
      inside:inRev([0,0],prof,0,120),
      patches:[Q.revolve(M(0,0,0),DZ,b=>[100-80*Math.cos(b),zc-80*Math.sin(b)],[0,ps0],(rho,h)=>80-Math.hypot(rho-100,h-zc)), Q.cylinder(M(0,0,zc),DZ,20,0,120-zc), disc(M(0,0,120),DU,DW,20)],
      edges:[{pts:ring(M(0,0,120),DU,DW,20)},{only:'H',pts:ring(M(0,0,0),DU,DW,75)}],
      axes:vaxis(0,0,-5,125,81)};
    const N={id:'N',nom:'наклонный цилиндр',gen:'наклонного цилиндра',ins:'наклонный цилиндр',secz:'эллипсу',secy:'кривой',
      inside:p=>{ const q=sub(p,O0), t=dot(q,d); return t>0&&t<100&&len(sub(q,mul(d,t)))<25; },
      patches:[Q.cylinder(O0,d,25,0,100,null,DW), disc(E,DW,e2,25)],
      edges:[{pts:ring(E,DW,e2,25)}],
      axes:[{v:'F',p:[O0,add(E,mul(d,10))]},{v:'H',p:[O0,add(E,mul(d,10))]}]};
    const C={id:'C',nom:'цилиндр',gen:'цилиндра',ins:'цилиндр',secz:'двум образующим',secy:'окружности, совпадающей с его проекцией на π₂',proj:'F',
      inside:p=>{ const [u,w]=uw(p); return Math.abs(w)<70&&Math.hypot(u+Xc,p[2]-Zc)<30; },
      patches:[Q.cylinder(M(-Xc,-70,Zc),DW,30,0,140,null,DU), ...[-70,70].map(w=>disc(M(-Xc,w,Zc),DU,DZ,30))],
      edges:[-70,70].map(w=>({pts:ring(M(-Xc,w,Zc),DU,DZ,30)})),
      axes:yaxis(-Xc,Zc,-74,74,36)};
    return {bodies:[R,N,C],pairs:[['R','N','sph'],['R','C','z'],['N','C','z']],sphC:O0,M,size:{u:[Math.min(-75,-Xc-30),Math.max(75,100*Math.cos(al)+25)],z:120}}; }
  throw new Error('нет типа '+code); }

/* дуга сферы на π₂ (центр c, радиус r) — только около нужных точек P, как чертят от руки */
function sarc(c,r,P){ const A=(P||[]).map(p=>Math.atan2(p[2]-c[2],-(p[0]-c[0]))); if(!A.length) A.push(Math.PI/2);
  A.sort((a,b)=>a-b); let lo=A[0], hi=A[A.length-1]; if(hi-lo>Math.PI){ /* через ±180° */ const B=A.map(a=>a<0?a+2*Math.PI:a).sort((a,b)=>a-b); lo=B[0]; hi=B[B.length-1]; }
  const pad=Math.min(0.35,22/r); lo-=pad; hi+=pad; const o=[], N=Math.max(8,Math.ceil((hi-lo)*r/3));
  for(let i=0;i<=N;i++){ const t=lo+(hi-lo)*i/N; o.push(F([c[0]-r*Math.cos(t),c[1],c[2]+r*Math.sin(t)])); } return poly(o,'aux'); }
/* ── посредники ── */
function family(kind,G,sc){ const box=sc.box(), xl=box[3]+5, xr=box[0]-5;
  const sub0=['₁','₂','₃','₄','₅','₆','₇','₈','₉'];
  if(kind==='z') return {kind,view:'H',name:'горизонтальная плоскость уровня',
    through:p=>({z:p[2]}), t:p=>p[2], at:t=>({z:t}), g:a=>p=>p[2]-a.z,
    draw:(a,l)=>[ln(F([xl,0,a.z]),F([xr,0,a.z]),'aux',l,'ne',0,0)], txt:a=>'z = '+fmt(a.z)};
  if(kind==='y') return {kind,view:'F',name:'фронтальная плоскость уровня',
    through:p=>({y:p[1]}), t:p=>p[1], at:t=>({y:t}), g:a=>p=>p[1]-a.y,
    draw:(a,l)=>[ln(H([xl,a.y,0]),H([xr,a.y,0]),'aux',l,'ne',0,0)], txt:a=>'y = '+fmt(a.y)};
  if(kind==='sph'){ const c=G.sphC; return {kind,view:'F',name:'сфера с центром в точке пересечения осей',c,
    through:p=>({r:dist(p,c)}), t:p=>dist(p,c), at:t=>({r:t}), g:a=>p=>dist(p,c)-a.r,
    draw:(a,l,P)=>[sarc(c,a.r,P)], txt:a=>'R = '+fmt(a.r)}; }
  if(kind==='ecc'){ const T=G.ecc.T.c, uk=G.ecc.K.u, M=G.M;
    /* меридиан тора под углом θ: окружность R40 с центром Cθ на окружности центров; сфера через неё — с центром на
       касательной к окружности центров в Cθ (перпендикуляр к плоскости меридиана); берём центр на оси конуса */
    const th=p=>Math.atan2(p[2]-T[2],-(p[0]-T[0])), at=t=>{ const s=(60*Math.cos(t)-uk)/Math.sin(t), c=M(uk,0,60*Math.sin(t)+s*Math.cos(t)); return {th:t,c,ct:M(60*Math.cos(t),0,60*Math.sin(t)),r:Math.hypot(s,40)}; };
    return {kind,view:'F',name:'эксцентрическая сфера',
      through:p=>at(th(p)), t:th, at, g:a=>p=>dist(p,a.c)-a.r,
      ok:a=>a.r<=140&&a.c[2]>-30, draw:(a,l,P)=>[sarc(a.c,a.r,P), pt(F(a.c),'','ne','aux',{r:1.6}), seg(F(a.c),F(a.ct),'aux'), seg(F(add(T,[-Math.cos(a.th)*16,0,Math.sin(a.th)*16])),F(add(T,[-Math.cos(a.th)*104,0,Math.sin(a.th)*104])),'aux')], txt:a=>'R = '+fmt(a.r)}; }
  if(kind==='pa'){ const Ap=G.apex, th=p=>Math.atan2(p[2]-Ap[2],p[0]-Ap[0]);
    const nrm=t=>unit(cross(DW,[Math.cos(t),0,Math.sin(t)]));
    return {kind,view:'H',name:'фронтально-проецирующая плоскость через вершину S',
      through:p=>({th:th(p)}), t:th, at:t=>({th:t}), g:a=>{ const n=nrm(a.th); return p=>dot(sub(p,Ap),n); },
      draw:(a,l)=>[ln(F(Ap),F(add(Ap,[Math.cos(a.th)*200,0,Math.sin(a.th)*200])),'aux',l,'ne',0,0)], txt:a=>'угол '+fmt(a.th/D2R)+'°'}; }
  throw new Error('нет посредника '+kind); }

/* ── решение варианта ── */
function solve4(code,D){
  let G=bodiesOf(code,D,0); const sz=G.size, xs=sz.u[1]+18;
  G=bodiesOf(code,D,xs);
  const sc=Q.scene(G.bodies), B=sc.B;
  const cert=[], lines=[];
  /* характерные точки линии: концы, точки на очерках (смена видимости), высшая и низшая */
  const DIRS={F:[0,1,0],H:[0,0,1]};
  const inner=[], apart=[];
  G.pairs.forEach(([a,b,fk])=>{ const m=sc.meet(a,b); if(!m.lines.length){ (sc.meet(a,b,true).lines.length?inner:apart).push([a,b]); return; }
    if(m.check&&m.dev>0.35) cert.push('линия '+B[a].nom+' ∩ '+B[b].nom+': два независимых построения расходятся на '+m.dev.toFixed(2)+' мм');
    const fam=family(fk,G,sc), chars=[];
    const res=p=>Math.max(...[a,b].map(id=>Math.min(...B[id].patches.map(pc=>Math.abs(pc.f(p))))));
    m.lines.forEach((l,li)=>{ const P=l.pts, n=P.length;
      P.forEach(p=>{ const r=res(p); if(r>0.05) cert.push('точка линии '+B[a].nom+' ∩ '+B[b].nom+' не на поверхностях ('+r.toFixed(3)+' мм)'); });
      const add1=(p,why)=>{ const o=chars.find(c=>dist(c.p,p)<4); if(o){ if(!o.whys.includes(why)) o.whys.push(why); return; } chars.push({p,why,whys:[why]}); };
      if(!l.closed){ add1(P[0],'end'); add1(P[n-1],'end'); }
      [a,b].forEach(id=>['F','H'].forEach(v=>{ const pcs=B[id].patches; if(pcs.every(pc=>pc.plane)) return;
        const pc=p=>pcs.reduce((x,q)=>Math.abs(q.f(p))<Math.abs(x.f(p))?q:x);
        const sg=p=>{ const q=pc(p); return q.plane?NaN:dot(unit(Q.grad(q.f,p)),DIRS[v]); };
        const s=P.map(sg);
        if(Math.max(...s.filter(x=>!isNaN(x)).map(Math.abs),0)<1e-4) return;
        for(let i=1;i<n;i++) if(Math.abs(s[i])>1e-7&&Math.abs(s[i-1])>1e-7&&(s[i]<0)!==(s[i-1]<0)){ let lo=0,hi=1; const A=P[i-1], Bp=P[i], g=t=>sg(Q.lerp(A,Bp,t));
          const g0=s[i-1]; for(let k=0;k<30;k++){ const mid=(lo+hi)/2, gm=g(mid); if(isNaN(gm)) break; if((gm<0)===(g0<0)) lo=mid; else hi=mid; } add1(Q.lerp(A,Bp,(lo+hi)/2),'sil'+v+id); } }));
      let hi=0, lo=0; P.forEach((p,i)=>{ if(p[2]>P[hi][2]) hi=i; if(p[2]<P[lo][2]) lo=i; });
      add1(P[hi],'top'); add1(P[lo],'bot');
      /* переход линии с грани на грань (ребро тела); плавный стык (раструб → цилиндр) ребром не считаем */
      [a,b].forEach(id=>{ const pcs=B[id].patches; if(pcs.length<2) return; const near=p=>{ let k=0; pcs.forEach((q,j)=>{ if(Math.abs(q.f(p))<Math.abs(pcs[k].f(p))) k=j; }); return k; };
        const ix=P.map(near);
        for(let i=1;i<n;i++) if(ix[i]!==ix[i-1]){ const A=P[i-1], Bp=P[i]; let lo=0,hi=1; for(let k=0;k<24;k++){ const mid=(lo+hi)/2; if(near(Q.lerp(A,Bp,mid))===ix[i-1]) lo=mid; else hi=mid; }
          const q=Q.lerp(A,Bp,(lo+hi)/2), n1=unit(Q.grad(pcs[ix[i-1]].f,q)), n2=unit(Q.grad(pcs[ix[i]].f,q));
          if(Math.abs(dot(n1,n2))<0.996) add1(q,'edge'+id); } });
      /* крайние посредники: наименьшее и наибольшее значение параметра семейства внутри линии */
      if(fk==='y'||fk==='sph'){ const T=P.map(fam.t); let mn=0,mx=0; T.forEach((t,i)=>{ if(t<T[mn]) mn=i; if(t>T[mx]) mx=i; });
        [[mn,'fmin'],[mx,'fmax']].forEach(([i,w])=>{ if(l.closed||(i>0&&i<n-1)) add1(P[i],w+fk); }); } });
    lines.push({a,b,fk,fam,m,chars}); });
  return {G,sc,lines,cert,xs,inner,apart}; }

/* ── разбор: шаги, чертёж ── */
const SUB=n=>String(n).split('').map(c=>'₀₁₂₃₄₅₆₇₈₉'[+c]).join('');
function taskOf(code,D,n,label){
  const R=solve4(code,D), {G,sc,lines}=R, B=sc.B, box=sc.box();
  const pf=(pts,k)=>poly(pts.map(F),k), ph=(pts,k)=>poly(pts.map(H),k);
  const visPoly=(pts,v,kv,kh)=>sc.visRuns(pts,v).map(r=>poly(r.pts.map(v==='F'?F:H),r.vis?kv:kh));
  /* дано: оси тел, полные очерки (бледно), ось x */
  const ghost=[], axes=[];
  G.bodies.forEach(b=>{ const s1=Q.scene([b]);
    ['F','H'].forEach(v=>s1.outline(b.id,v,true).forEach(p=>{ if(v==='F'&&p.every(q=>q[2]<0.01)) return; ghost.push(poly(p.map(v==='F'?F:H),'ghost')); }));
    (b.axes||[]).forEach(a=>axes.push(poly(a.p.map(a.v==='F'?F:H),'axis'))); });
  const given=[axis(), ...G.bodies.map((b,i)=>({t:'mesh3',tris:meshOf(sc,b),col:BODYCOL[i]})), ...ghost, ...axes];
  /* опорные точки: подписи 1, 2, 3 … по всем линиям */
  let num=0, sig=0; const cx=(box[0]+box[3])/2, cy=(box[1]+box[4])/2;
  const la=p=>({l2:(p[0]>cx?'nw':'ne'),l1:(p[1]>cy?'sw':'nw')});
  const WHY={end:'конец линии: на ребре, основании или границе тела',top:'высшая точка',bot:'низшая точка',fminy:'самая дальняя от зрителя точка (крайняя фронтальная плоскость)',fmaxy:'самая близкая к зрителю точка (крайняя фронтальная плоскость)',
    fminsph:'наименьшая сфера-посредник',fmaxsph:'наибольшая сфера-посредник'};
  const why1=w=>WHY[w]||(/^edge/.test(w)?'на ребре '+B[w.slice(4)].gen:/^silF/.test(w)?'на очерке '+B[w.slice(4)].gen+' на π₂':/^silH/.test(w)?'на очерке '+B[w.slice(4)].gen+' на π₁':'');
  const whyOf=c=>c.whys.map(why1).join('; ');
  const co=p=>'('+fmt(p[0])+'; '+fmt(p[1])+'; '+fmt(p[2])+')';
  const steps=[];
  /* 1. анализ */
  const bl=G.bodies.map(b=>b.nom).join(', ');
  const pairTxt=lines.map(L=>`<b>${B[L.a].nom} ∩ ${B[L.b].nom}</b> — ${L.fam.name}`).join('; ');
  const nm2=([a,b])=>B[a].nom+' и '+B[b].nom, third=([a,b])=>G.bodies.find(x=>x.id!==a&&x.id!==b);
  const extra=(R.apart.length?' Не пересекаются: '+R.apart.map(nm2).join('; ')+'.':'')+R.inner.map(p=>` Линия «${B[p[0]].nom} ∩ ${B[p[1]].nom}» лежит целиком внутри тела «${third(p).nom}» — на поверхности составного тела её нет, на чертеже не строим.`).join('');
  steps.push(STEP('Анализ: тела, оси и посредники',{check:'Для каждой пары тел назван посредник и сказано, почему он даёт простые линии.',
    hint:'Какие оси вертикальны, какие ⟂ π₂? Есть ли проецирующие поверхности — у них одна проекция линии уже на чертеже?',
    principle:'Точку линии пересечения находят посредником — поверхностью, которая режет оба тела по простым линиям (окружностям, прямым). Общие точки этих линий принадлежат обоим телам.',
    step:`Тела: ${bl}. Посредники: ${pairTxt}.${extra}`,
    full:TYPE_TXT[code](D)},[]));
  lines.forEach(L=>{ const A=B[L.a], Bb=B[L.b], fam=L.fam, nm=A.nom+' ∩ '+Bb.nom;
    const charItems=[], charTxt=[];
    L.chars.sort((p,q)=>q.p[2]-p.p[2]).forEach(c=>{ num++; c.n=num; const aux=fam.through(c.p);
      if(!fam.ok||fam.ok(aux)) charItems.push(...fam.draw(aux,null,[c.p]));
      charItems.push(conn(F(c.p),H(c.p)));
      charTxt.push(`${num} ${co(c.p)} — ${whyOf(c,L)}; посредник: ${fam.txt(aux)}`); });
    /* подписи: совпавшие проекции — одной подписью «3″≡4″» (конкурирующие точки) */
    [['F','″'],['H','′']].forEach(([v,mk])=>{ const pr=v==='F'?F:H, grp=[];
      L.chars.forEach(c=>{ const q=pr(c.p), g=grp.find(x=>Math.hypot(x.q[0]-q[0],x.q[1]-q[1])<0.8*S); if(g) g.c.push(c); else grp.push({q,c:[c]}); });
      grp.forEach(g=>{ const l=la(g.c[0].p); charItems.push(pt(g.q,g.c.map(c=>c.n+mk).join('≡'),v==='F'?l.l2:l.l1,'res')); }); });
    const how=SECT[fam.kind](A,Bb,G);
    steps.push(STEP('Линия «'+nm+'»: опорные точки',{check:'Каждая опорная точка лежит на обеих поверхностях; обе её проекции — на одной линии связи.',
      hint:'С каких точек начать? С тех, где линия касается очерков тел, и с самой высокой и самой низкой.',
      principle:how,
      step:`Строим опорные точки ${L.chars.map(c=>c.n).join(', ')}: для каждой — свой посредник (${fam.name}) через точку. Точки на очерках важны: в них линия меняет видимость.`,
      full:charTxt.join('<br>')},charItems));
    /* промежуточные: 3 посредника между опорными */
    const ts=[].concat(...L.m.lines.map(l=>l.pts.map(fam.t))), t0=Math.min(...ts), t1=Math.max(...ts), ct=L.chars.map(c=>fam.t(c.p));
    const pick=[]; for(let k=1;k<=11;k++){ const t=t0+(t1-t0)*k/12; if(fam.ok&&!fam.ok(fam.at(t))) continue; pick.push({t,d:Math.min(...ct.map(x=>Math.abs(x-t)))}); }
    const sel=pick.sort((p,q)=>q.d-p.d).slice(0,3).sort((p,q)=>p.t-q.t);
    const midItems=[], midTxt=[];
    sel.forEach((s,k)=>{ const aux=fam.at(s.t), g=fam.g(aux), lab=fam.kind==='z'||fam.kind==='y'||fam.kind==='pa'?'Σ'+SUB(++sig):null;
      const got=[]; L.m.lines.forEach(l=>{ const P=l.pts; for(let i=1;i<P.length;i++){ const ga=g(P[i-1]), gb=g(P[i]); if((ga<0)!==(gb<0)){ let lo=0,hi=1; for(let it=0;it<30;it++){ const mm=(lo+hi)/2; if((g(Q.lerp(P[i-1],P[i],mm))<0)===(ga<0)) lo=mm; else hi=mm; } got.push(Q.lerp(P[i-1],P[i],(lo+hi)/2)); } } });
      midItems.push(...fam.draw(aux,lab,got));
      [L.a,L.b].forEach(id=>sc.section(id,g).forEach(p=>midItems.push(poly(p.map(fam.view==='F'?F:H),'aux'))));
      got.forEach(p=>midItems.push(conn(F(p),H(p)), pt(F(p),'','ne','res',{r:2.2}), pt(H(p),'','ne','res',{r:2.2})));
      midTxt.push(`${lab||'Посредник '+(k+1)} (${fam.txt(aux)}): ${got.length} ${got.length===1?'точка':got.length<5?'точки':'точек'}${got.length?' — '+got.map(co).join(', '):''}`); });
    steps.push(STEP('Линия «'+nm+'»: промежуточные точки',{check:'Сечения обоих тел построены одним и тем же посредником; точки — только там, где сечения пересекаются.',
      hint:'Между опорными точками кривую не провести — нужны ещё точки. Возьми посредники между ними.',
      principle:`Тот же способ: посредник режет ${A.ins} по ${fam.kind==='z'?A.secz:fam.kind==='y'?A.secy:'окружностям'}, ${Bb.ins} — по ${fam.kind==='z'?Bb.secz:fam.kind==='y'?Bb.secy:'окружностям'}${fam.kind==='pa'?' (плоскость через вершину режет конус по образующим, грань призмы ⟂ π₂ — по прямой ⟂ π₂)':''}. Сечения строим там, где они видны без искажения (${fam.view==='F'?'на π₂':'на π₁'}), точки переносим на другую проекцию по линиям связи.`,
      step:'Строим три посредника между опорными точками, сечения тел и их общие точки.',
      full:midTxt.join('<br>')},midItems));
    const crv=[], ntot=L.m.lines.length, zs=[].concat(...L.m.lines.map(l=>l.pts.map(p=>p[2])));
    L.m.lines.forEach(l=>{ crv.push(...visPoly(l.pts,'F','res','resd'), ...visPoly(l.pts,'H','res','resd')); });
    const vf=L.m.lines.some(l=>sc.visRuns(l.pts,'F').some(r=>!r.vis)), vh=L.m.lines.some(l=>sc.visRuns(l.pts,'H').some(r=>!r.vis));
    steps.push(STEP('Линия «'+nm+'»: соединяем и определяем видимость',{check:'Кривая плавная, проходит через все точки по порядку; видимые участки — сплошной, невидимые — штриховой.',
      hint:'В каком порядке соединять точки? И какая часть линии видна — та, что на видимых частях обеих поверхностей.',
      principle:'Точки соединяем в порядке, в каком они идут по поверхности (по параллелям, образующим). Участок линии видим, если он лежит на видимой части обеих поверхностей; видимость меняется в точках на очерках.',
      step:`Проводим ${ntot>1?ntot+' ветви линии':'линию'} плавно через опорные и промежуточные точки. ${vf?'На π₂ часть линии невидима — штрихом.':'На π₂ линия видима.'} ${vh?'На π₁ часть линии невидима — штрихом.':'На π₁ линия видима.'}`,
      full:`Линия ${L.m.lines.every(l=>l.closed)?'замкнутая':'разомкнутая'}${ntot>1?' (ветвей: '+ntot+')':''}; высота от ${fmt(Math.min(...zs))} до ${fmt(Math.max(...zs))} мм. Опорные точки: ${L.chars.map(c=>c.n).join(', ')}.`},crv)); });
  /* очерки с учётом видимости */
  const outl=[], ground=[];
  G.bodies.forEach(b=>['F','H'].forEach(v=>sc.outline(b.id,v).forEach(p=>{ if(v==='F'&&p.every(q=>q[2]<0.01)) return; if(v==='H'&&p.every(q=>q[2]<0.01)) ground.push(p); outl.push(...visPoly(p,v,'main','hid')); })));
  /* основание на π₂ — по следам тел на π₁ */
  const iv=ground.map(p=>[Math.min(...p.map(q=>q[0])),Math.max(...p.map(q=>q[0]))]).sort((a,b)=>a[0]-b[0]), mg=[];
  iv.forEach(x=>{ const l=mg[mg.length-1]; if(l&&x[0]<=l[1]+0.5) l[1]=Math.max(l[1],x[1]); else mg.push(x.slice()); });
  mg.forEach(x=>outl.push(seg(F([x[0],0,0]),F([x[1],0,0]),'main')));
  steps.push(STEP('Обводка очерков',{check:'Контуры внутри соседних тел удалены; закрытые участки — штриховые; оси — штрихпунктирные.',
    hint:'Тела слились в одно — какие контуры теперь внутри и пропадают?',
    principle:'Очерк остаётся только там, где он на поверхности составного тела. Участки, закрытые другими телами, — штриховой линией.',
    step:'Обводим очерки всех тел с учётом видимости: на π₂ взгляд спереди, на π₁ — сверху.',
    full:'Видимость каждой линии проверена лучом от точки к наблюдателю.'},outl));
  const rng=a=>a.length>2&&a[a.length-1]-a[0]===a.length-1?a[0]+'–'+a[a.length-1]:a.join(', ');
  const ans='построены линии пересечения: '+lines.map(L=>`${B[L.a].nom} ∩ ${B[L.b].nom} (точки ${rng(L.chars.map(c=>c.n))})`).join('; ')+'.';
  /* «Евклид» (линейка и циркуль на плоскости) здесь не судья: точки кривых получены из сечений тел, а не построением
     на листе. Их проверяет сертификат ядра — каждая точка на обеих поверхностях, линия совпала со второй, независимой
     сеткой (solve4 → cert) — и 3D-проверка проекций. */
  [given].concat(steps.map(s=>s.add)).forEach(a=>a.forEach(it=>{ if(!it) return; it._euclidSkip=true; if(it.t==='poly') it.open3d=true; }));
  const t=DZR.typeOf('ng4',n)||{};
  return {R, task:{n:label, q:'<b>'+label+'.</b> Построить проекции линий пересечения заданных поверхностей. Обозначить характерные точки линий пересечения.',
    data:table((t.cols||Object.keys(D)).map(k=>COLS[k]||k),[(t.cols||Object.keys(D)).map(k=>D[k])])+`<p class="hw-dim">${TYPE_TXT[code](D)}</p>`,
    intro:'Размеры — из таблицы варианта; тела, их оси и все точки посчитаны по этим числам. Каждая точка линии лежит на обеих поверхностях — это проверено.',
    given, steps, ans}}; }

const COLS={Dk:'D<sub>к</sub>',dk:'d<sub>к</sub>',Hk:'H<sub>к</sub>',Xk:'X<sub>к</sub>',Yk:'Y<sub>к</sub>',Xc:'X<sub>ц</sub>',Yc:'Y<sub>ц</sub>',Zc:'Z<sub>ц</sub>',Dc:'D<sub>ц</sub>',
  phi:'φ°',alpha:'α°',beta:'β°',Dp:'D<sub>п</sub>',Xp:'X<sub>п</sub>',Yp:'Y<sub>п</sub>',Dt:'D<sub>т</sub>',Rt:'R<sub>т</sub>',Xt:'X<sub>т</sub>',Yt:'Y<sub>т</sub>'};
/* 3D: поверхность составного тела — треугольники тех клеток сетки, центр которых на его поверхности */
const BODYCOL=['#c9b07a','#8fb0cf','#c99a8a'];
function meshOf(sc,b){ const out=[], r=q=>q.map(v=>Math.round(v*10)/10);
  b.patches.forEach(pc=>{ const na=pc.polar?24:pc.plane?10:24, nb=pc.polar?5:pc.plane?10:10, ua=i=>pc.A[0]+(pc.A[1]-pc.A[0])*i/na, ub=j=>pc.B[0]+(pc.B[1]-pc.B[0])*j/nb;
    const ok=(a,c)=>{ const p=pc.P(a,c); return sc.onBd(b,pc,p)&&!sc.buried(p,[b.id]); };
    const quad=(a0,a1,b0,b1)=>{ const p00=r(pc.P(a0,b0)), p10=r(pc.P(a1,b0)), p11=r(pc.P(a1,b1)), p01=r(pc.P(a0,b1)); out.push([p00,p10,p11],[p00,p11,p01]); };
    for(let i=0;i<na;i++) for(let j=0;j<nb;j++){ const a0=ua(i), a1=ua(i+1), b0=ub(j), b1=ub(j+1), e=1e-3;
      /* клетка целиком на поверхности — целиком; на границе — делим на 3 × 3 и берём части, центр которых на поверхности */
      const cs=[ok(a0+(a1-a0)*e,b0+(b1-b0)*e),ok(a1-(a1-a0)*e,b0+(b1-b0)*e),ok(a1-(a1-a0)*e,b1-(b1-b0)*e),ok(a0+(a1-a0)*e,b1-(b1-b0)*e),ok((a0+a1)/2,(b0+b1)/2)];
      if(cs.every(x=>x)){ quad(a0,a1,b0,b1); continue; } if(!cs.some(x=>x)) continue;
      for(let k=0;k<3;k++) for(let l=0;l<3;l++){ const s0=a0+(a1-a0)*k/3, s1=a0+(a1-a0)*(k+1)/3, t0=b0+(b1-b0)*l/3, t1=b0+(b1-b0)*(l+1)/3; if(ok((s0+s1)/2,(t0+t1)/2)) quad(s0,s1,t0,t1); } } });
  return out; }
/* способ — для пары тел */
const SECT={
  z:(A,B)=>`Горизонтальная плоскость уровня (z = const) режет ${A.ins} по ${A.secz}, ${B.ins} — по ${B.secz}. На π₁ сечения видны без искажения: их общие точки — точки линии; на π₂ точки лежат на следе плоскости.${A.proj||B.proj?' '+projTxt(A.proj?A:B):''}`,
  y:(A,B)=>`Фронтальная плоскость уровня (y = const) режет ${A.ins} по ${A.secy}, ${B.ins} — по ${B.secy}. На π₂ сечения видны без искажения: их общие точки — точки линии; на π₁ точки лежат на следе плоскости.${A.proj||B.proj?' '+projTxt(A.proj?A:B):''}`,
  sph:(A,B)=>`Оси ${A.gen} и ${B.gen} пересекаются в точке O и лежат во фронтальной плоскости. Сфера с центром O соосна обоим телам и режет каждое по окружностям в плоскостях ⟂ осям; на π₂ эти окружности — отрезки. Общие точки отрезков — точки линии на π₂; на π₁ — по линиям связи на окружность сечения вертикального тела (способ концентрических сфер). Наименьшая сфера касается одного из тел.`,
  ecc:(A,B)=>`Ось конуса лежит в плоскости окружности центров тора, но не проходит через его ось — концентрические сферы не годятся. Берём меридиан тора (окружность в плоскости через ось тора, на π₂ — отрезок через центр тора) и сферу, на которой он лежит, с центром на оси конуса: эта сфера режет конус по горизонтальной окружности (на π₂ — отрезок). Пересечение двух отрезков на π₂ — точка линии (способ эксцентрических сфер); на π₁ — на окружности конуса.`,
  pa:(A,B)=>`Призма ⟂ π₂ — проецирующая: на π₂ линия лежит на сторонах треугольника. Для π₁ проводим через вершину S наклонного конуса фронтально-проецирующие плоскости (на π₂ — прямые через S″): плоскость режет конус по двум образующим, грань призмы — по прямой ⟂ π₂. Где они пересекаются — точка линии.` };
const projTxt=b=>`${b.nom[0].toUpperCase()+b.nom.slice(1)} — проецирующая поверхность: на ${b.proj==='F'?'π₂':'π₁'} линия совпадает с его вырожденной проекцией, строить остаётся только вторую проекцию.`;
const TYPE_TXT={
  '4a1':D=>`Полутор: окружность центров R60, труба Ø80, ось ⟂ π₂, центр на π₁. Конус: ось вертикальна, левее центра тора на X<sub>к</sub> = ${D.Xk}, основание Ø${D.Dk} на высоте 110, вершина на ${D.Hk} ниже основания. Полуцилиндр R40, ось ⟂ π₂ правее на X<sub>ц</sub> = ${D.Xc}, на высоте Z<sub>ц</sub> = ${D.Zc}, длина 110.`,
  '4a2':D=>`Полусфера Ø160 срезана фронтальными плоскостями (размер 120). Усечённый конус Ø${D.Dk}/Ø${D.dk}, высота 100: ось правее центра на X<sub>к</sub> = ${D.Xk}, ближе на Y<sub>к</sub> = ${D.Yk}. Цилиндр Ø60, высота 100: ось левее на X<sub>ц</sub> = ${D.Xc}, ближе на Y<sub>ц</sub> = ${D.Yc}.`,
  '4a3':D=>`Конус с углом 60° при вершине, высота 125. Наклонный конус: вершина — в правой точке основания первого, ось под φ = ${D.phi}° к π₁, длина 150, основание Ø${D.Dk}. Призма: основание 55 на π₁ справа от оси, углы граней α = ${D.alpha}° и β = ${D.beta}°, длина 160, рёбра ⟂ π₂.`,
  '4b1':D=>`Полусфера Ø150. Трёхгранная призма высотой 95 вписана в окружность Ø${D.Dp}, центр левее на X<sub>п</sub> = ${D.Xp} и ${D.Yp<0?'дальше':'ближе'} на ${Math.abs(D.Yp)} (Y<sub>п</sub> = ${D.Yp}). Тор («лимон»): дуга R60, наибольший диаметр Ø80, ось ⟂ π₂ на высоте 45, правее на X<sub>т</sub> = ${D.Xt}, Y<sub>т</sub> = ${D.Yt}.`,
  '4b2':D=>`Тор («бочка»): ось ∥ π₁ и π₂ на высоте 50, длина 80, наибольший диаметр Ø${D.Dt}, дуга образующей R${D.Rt}, центр левее на X<sub>т</sub> = ${D.Xt}. Наклонный конус: основание Ø120 на π₁, верх Ø60 на высоте 120, ось под 60° к π₁. Цилиндр Ø${D.Dc}: ось ⟂ π₂ правее на X<sub>ц</sub> = ${D.Xc}, на высоте Z<sub>ц</sub> = ${D.Zc}, длина 130.`,
  '4b3':D=>`Раструб: поверхность вращения, основание Ø150 на π₁, образующая — дуга R80, плавно переходит в цилиндр Ø40 высотой 120. Наклонный цилиндр Ø50: ось из точки на высоте 25 на оси раструба под α = ${D.alpha}° к π₁, длина 100. Цилиндр Ø60: ось ⟂ π₂ левее на X<sub>ц</sub> = ${D.Xc}, на высоте Z<sub>ц</sub> = ${D.Zc}, длина 140.`};

/* ── реестр ── */
const EX={'4a1':3,'4a2':7,'4a3':13,'4b1':18,'4b2':21,'4b3':28}, CACHE={};
function solveN(n){ if(CACHE[n]) return CACHE[n]; const d=DZR.get('ng4'), t=DZR.typeOf('ng4',n), D=d.V[n];
  const r=taskOf(t.code,D,n,d.label+' · вариант '+n); try{ WB3.ruDec(r.task); }catch(e){}
  const L=r.R.lines, answers={lines:L.map(x=>({pair:r.R.G.bodies.find(b=>b.id===x.a).nom+' ∩ '+r.R.G.bodies.find(b=>b.id===x.b).nom,branches:x.m.lines.length,closed:x.m.lines.map(l=>l.closed),
    chars:x.chars.map(c=>({n:c.n,p:c.p.map(v=>Math.round(v*10)/10),why:c.why})),dev:x.m.dev}))};
  return CACHE[n]={task:r.task,answers,cert:r.R.cert}; }
DZR.def('ng4',{
  examples:Object.fromEntries(Object.entries(EX).map(([k,n])=>[k,()=>{ const r=solveN(n), t=Object.assign({},r.task); t.n='ДЗ №4 · пример (вариант '+n+')'; return t; }])),
  solve(n){ const r=solveN(n); return {task:r.task,answers:r.answers,cert:r.cert}; },
  _solve4:solve4 });
})();
