/* ═══════════ PREP · темы x2, x6, x8, f1, f2 (ДЗ №4, №5, РК3) ═══════════
   Те же соглашения, что в prep/x.js: X — x, π₂: Y = −z, π₁: Y = Y0 + y. Ловушки — Ж (учебник Жирных и др.) и М (методичка к ДЗ). */
(function(){
'use strict';
if(!self.PREP) return;
const rnd=(a,b)=>a+Math.random()*(b-a), sgn=()=>Math.random()<.5?-1:1, D=Math.PI/180;
const L=(role,c,x1,y1,x2,y2,o)=>Object.assign({t:'line',role,c,a:[x1,y1,x2,y2]},o||{});
const C=(role,c,cx,cy,r,o)=>Object.assign({t:'circ',role,c,a:[cx,cy,r]},o||{});
const Pt=(role,x,y,lab,side,o)=>Object.assign({t:'pt',role,a:[x,y],lab,side:side||1},o||{});
const PL=(role,c,p,o)=>Object.assign({t:'poly',role,c,p},o||{});
const box=(x0,y0,x1,y1)=>[x0,y0,x1-x0,y1-y0];
const far=(p,q,m)=>Math.hypot(p[0]-q[0],p[1]-q[1])>=m;
const ptOf=(S,role)=>{ const e=S.E.find(x=>x.role===role&&x.t==='pt'); return e?e.a:null; };
function lineX(a,b){ const [x1,y1,x2,y2]=a,[x3,y3,x4,y4]=b, d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4); if(Math.abs(d)<1e-9) return null;
  const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d, s=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/d; return [x1+t*(x2-x1),y1+t*(y2-y1),t,s]; }
function lineCirc(px,py,ux,uy,cx,cy,r){ const fx=px-cx,fy=py-cy,a=ux*ux+uy*uy,b=2*(fx*ux+fy*uy),c=fx*fx+fy*fy-r*r,d=b*b-4*a*c; if(d<0) return []; const s=Math.sqrt(d); return [(-b-s)/(2*a),(-b+s)/(2*a)]; }
const inSeg=X=>X&&X[2]>=0&&X[2]<=1&&X[3]>=0&&X[3]<=1;
const coneBase=(V,ax,Y0)=>[PL('','o',[[ax-V.R,0],[ax,-V.H],[ax+V.R,0],[ax-V.R,0]]),C('','o',ax,Y0,V.R),L('','cl',ax,-V.H-6,ax,Y0+V.R+5),L('','cl',ax-V.R-5,Y0,ax+V.R+5,Y0),Pt('',ax,Y0,null,1,{c:'o',r:.8})];

/* ── x8 · прямая и конус: плоскость через прямую и вершину ── */
const p3=(P,Q,t)=>[P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t,P[2]+(Q[2]-P[2])*t];
PREP.topic('x8',{
  make(){
    for(let t=0;t<400;t++){
      const R=rnd(40,50),H=rnd(88,105),Y0=R+16, rAt=z=>R*(1-z/H);
      const on=(z,f)=>[rAt(z)*Math.cos(f),rAt(z)*Math.sin(f),z];
      const K1=on(H*rnd(.12,.5),rnd(25,80)*D), K2=on(H*rnd(.12,.5),rnd(100,155)*D);
      if(Math.hypot(K1[0]-K2[0],K1[1]-K2[1],K1[2]-K2[2])<26) continue;
      const A=p3(K1,K2,-rnd(.45,.7)), B=p3(K1,K2,1+rnd(.45,.7));
      if(A[2]<4||B[2]<4||A[2]>H-8||B[2]>H-8) continue;
      const V={R,H,Y0,A,B}; if(this.scene(V,null)) return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'Плоскость через AB и вершину S: прямые SA и SB',roles:['ab','abi','sa2','sb2','sa1','sb1']},
    {cap:'Где SA и SB пробивают основание — точки M и N',roles:['ab','abi','sa2','sb2','sa1','sb1','M','N']},
    {cap:'M′N′ — след плоскости. Он режет основание в P и Q',roles:['ab','abi','sa2','sb2','sa1','sb1','M','N','mn','P','Q']},
    {cap:'SP и SQ — сечение конуса этой плоскостью',roles:['ab','abi','sa2','sb2','sa1','sb1','M','N','mn','P','Q','g1','g2','g3','g4']},
    {cap:'AB ∩ образующие — точки входа и выхода',roles:['ab','abi','sa2','sb2','sa1','sb1','M','N','mn','P','Q','g1','g2','g3','g4','k1h','k2h','l1','l2','k1f','k2f']}]},
  scene(V,trap){
    const S=[0,0,V.H], A=V.A, B=V.B, Y0=V.Y0;
    const f=p=>[p[0],-p[2]], h=p=>[p[0],Y0+p[1]];
    /* точки, где SA и SB пробивают плоскость основания z = 0 */
    const pierce=P=>p3(S,P,V.H/(V.H-P[2]));
    let M=pierce(A), N=pierce(B);
    if(trap==='Tr'){ M=[A[0],A[1],0]; N=[B[0],B[1],0]; }   /* «след» взяли по горизонтальной проекции самой AB */
    const u=[N[0]-M[0],N[1]-M[1]], ts=lineCirc(M[0],M[1],u[0],u[1],0,0,V.R); if(ts.length<2) return null;
    const P=[M[0]+u[0]*ts[0],M[1]+u[1]*ts[0],0], Q=[M[0]+u[0]*ts[1],M[1]+u[1]*ts[1],0];
    /* точки на π₁: A′B′ ∩ S′P′ — высота по AB */
    const meet=G=>{ const X=lineX([A[0],A[1],B[0],B[1]],[0,0,G[0],G[1]]); if(!X||X[3]<0||X[3]>1) return null; return p3(A,B,X[2]); };
    let K=[meet(P),meet(Q)]; if(!K[0]||!K[1]) return null; K.sort((a,b)=>a[0]-b[0]);
    let kf=K.map(f), kh=K.map(h);
    if(trap==='Ko'){ /* K₁″ — там, где A″B″ пересекает очерк конуса */
      const a2=f(A), b2=f(B), side=K[0][0]<0?[[-V.R,0],[0,-V.H]]:[[V.R,0],[0,-V.H]];
      const X=lineX([a2[0],a2[1],b2[0],b2[1]],[side[0][0],side[0][1],side[1][0],side[1][1]]); if(!X||X[2]<0||X[2]>1||X[3]<0||X[3]>1) return null;
      const T=p3(A,B,X[2]); kf[0]=f(T); kh[0]=h(T); }
    let kx=kf[0][0]; if(trap==='Lk'){ kx+=sgn()*rnd(9,12); kf[0]=[kx,kf[0][1]]; }
    const a2=f(A),b2=f(B),a1=h(A),b1=h(B);
    /* AB: вне конуса видна, между точками — невидима (штрих) */
    const tOf=(p,a,b)=>((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/((b[0]-a[0])**2+(b[1]-a[1])**2);
    const piece=(a,b,p,q,dash)=>[L('ab','o',a[0],a[1],p[0],p[1]),L('abi','o',p[0],p[1],q[0],q[1],{dash:trap==='Vs'?false:true}),L('ab','o',q[0],q[1],b[0],b[1])];
    const s2=tOf(kf[0],a2,b2)<tOf(kf[1],a2,b2)?[kf[0],kf[1]]:[kf[1],kf[0]], s1=tOf(kh[0],a1,b1)<tOf(kh[1],a1,b1)?[kh[0],kh[1]]:[kh[1],kh[0]];
    const Sf=f(S), Sh=h(S), Mh=h(M), Nh=h(N), Ph=h(P), Qh=h(Q);
    const ext=(p,q,k)=>[q[0]+(q[0]-p[0])*k,q[1]+(q[1]-p[1])*k];
    const mnA=ext(Nh,Mh,.15), mnB=ext(Mh,Nh,.15);
    const E=[...piece(a2,b2,s2[0],s2[1]),...piece(a1,b1,s1[0],s1[1]),
      L('sa2','a',Sf[0],Sf[1],f(M)[0],f(M)[1]),L('sb2','a',Sf[0],Sf[1],f(N)[0],f(N)[1]),L('sa1','a',Sh[0],Sh[1],Mh[0],Mh[1]),L('sb1','a',Sh[0],Sh[1],Nh[0],Nh[1]),
      Pt('M',Mh[0],Mh[1],'M′',Mh[0]<0?-1:1,{c:'o'}),Pt('N',Nh[0],Nh[1],'N′',Nh[0]<0?-1:1,{c:'o'}),
      L('mn','a',mnA[0],mnA[1],mnB[0],mnB[1]),Pt('P',Ph[0],Ph[1],'P′',Ph[0]<0?-1:1,{c:'o'}),Pt('Q',Qh[0],Qh[1],'Q′',Qh[0]<0?-1:1,{c:'o'}),
      L('g1','c',Sf[0],Sf[1],f(P)[0],f(P)[1]),L('g2','c',Sf[0],Sf[1],f(Q)[0],f(Q)[1]),L('g3','c',Sh[0],Sh[1],Ph[0],Ph[1]),L('g4','c',Sh[0],Sh[1],Qh[0],Qh[1]),
      Pt('k1h',kh[0][0],kh[0][1],'K₁′',-1),Pt('k2h',kh[1][0],kh[1][1],'K₂′',1),L('l1','lk',kh[0][0],kh[0][1],kf[0][0],kf[0][1]),L('l2','lk',kh[1][0],kh[1][1],kf[1][0],kf[1][1]),
      Pt('k1f',kf[0][0],kf[0][1],'K₁″',-1),Pt('k2f',kf[1][0],kf[1][1],'K₂″',1)];
    const base=coneBase(V,0,Y0).concat([Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:1}),Pt('',b2[0],b2[1],'B″',1,{c:'o',r:1}),Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:1}),Pt('',b1[0],b1[1],'B′',1,{c:'o',r:1}),Pt('',0,-V.H,'S″',1,{c:'o',r:1})]);
    const xs=[-V.R,V.R,a2[0],b2[0],Mh[0],Nh[0]], ys=[-V.H,a2[1],b2[1],Y0+V.R,Mh[1],Nh[1],a1[1],b1[1]];
    const S2={box:box(Math.min(...xs)-12,Math.min(...ys)-10,Math.max(...xs)+12,Math.max(...ys)+10),axis:0,base,E,_K:K};
    if(Math.max(...xs)-Math.min(...xs)>220||Math.max(...ys)-Math.min(...ys)>280) return null;
    return S2;
  },
  fair(V,k,ok,bad){ const a=ptOf(ok,'k1h'),b=ptOf(ok,'k2h'); if(!far(a,b,12)) return false;
    if(k==='Tr'||k==='Ko') return far(ptOf(bad,'k1f'),ptOf(ok,'k1f'),5)||far(ptOf(bad,'k2f'),ptOf(ok,'k2f'),5);
    return true; },
  traps:{
    Lk:{b0:-1.5,say:'Линия связи ⟂ оси x',src:'Ж с. 22, 131',hl:['l1','k1f','ab','abi']},
    Vs:{b0:-.4,say:'Внутри конуса участок прямой невидим',src:'Ж с. 101, 131; М с. 26',hl:['abi']},
    Ko:{b0:.4,say:'Точка входа — на образующей сечения, не на очерке',src:'Ж с. 131; М с. 26',hl:['k1f','k1h','l1','ab','abi']},
    Tr:{b0:.8,say:'След — через точки, где SA и SB пробивают основание',src:'Ж с. 132–133; М с. 27',hl:['sa2','sb2','sa1','sb1','M','N','mn','P','Q','g1','g2','g3','g4','k1h','k2h','l1','l2','k1f','k2f','ab','abi']}}
});

/* ── x2 · опорные точки: в общей плоскости симметрии очерки пересекаются в точках линии ── */
PREP.topic('x2',{
  make(){
    for(let t=0;t<400;t++){
      const R=rnd(50,60),Ys=R+15,xc=rnd(.35,.6)*R,Rc=rnd(32,42),Hc=rnd(95,115);
      const V={R,Ys,xc,yc:Ys,Rc,Hc};
      const hit=(x0,x1)=>{ const u=[x1-x0,-Hc]; return lineCirc(x0,0,u[0],u[1],0,0,R).filter(t=>t>.03&&t<.97).map(t=>[x0+u[0]*t,u[1]*t]); };
      const lft=hit(V.xc-Rc,V.xc), rgt=hit(V.xc+Rc,V.xc);
      if(lft.length!==1||rgt.length!==1) continue;
      V.p1=lft[0]; V.p2=rgt[0];
      if(Math.abs(V.p1[1]-V.p2[1])<8||Math.abs(V.p1[0]-V.p2[0])<14) continue;
      return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'Оси в одной фронтальной плоскости — это общая плоскость симметрии',roles:[]},
    {cap:'Её линии на π₂ — очерки. Где очерки пересеклись — точки линии',roles:['p1f','p2f']},
    {cap:'На π₁ эти точки — на линии симметрии',roles:['p1f','p2f','l1','l2','p1h','p2h']}]},
  scene(V,trap){
    let p=[V.p1.slice(),V.p2.slice()];
    if(trap==='Ax'){ const z=Math.sqrt(V.R*V.R-V.xc*V.xc); p[0]=[V.xc,-z]; }
    const yh=[V.Ys,V.Ys]; if(trap==='Pl') yh[0]=V.Ys+sgn()*rnd(7,10);
    const xh=[p[0][0],p[1][0]]; if(trap==='Lk') xh[0]+=sgn()*rnd(9,12);
    const ord=p[0][0]<p[1][0]?[-1,1]:[1,-1];
    const E=[Pt('p1f',p[0][0],p[0][1],'1″',ord[0]),Pt('p2f',p[1][0],p[1][1],'2″',ord[1]),
      L('l1','lk',p[0][0],p[0][1],xh[0],yh[0]),L('l2','lk',p[1][0],p[1][1],xh[1],yh[1]),
      Pt('p1h',xh[0],yh[0],'1′',ord[0]),Pt('p2h',xh[1],yh[1],'2′',ord[1])];
    const base=[L('','cl',0,-V.R-5,0,4),L('','cl',V.xc,-V.Hc-5,V.xc,4),L('','cl',-V.R-6,V.Ys,Math.max(V.R,V.xc+V.Rc)+6,V.Ys),L('','cl',0,V.Ys-V.R-5,0,V.Ys+V.R+5),L('','cl',V.xc,V.Ys-V.Rc-5,V.xc,V.Ys+V.Rc+5),
      PL('','o',Array.from({length:49},(_,i)=>{ const a=Math.PI*i/48; return [-V.R*Math.cos(a),-V.R*Math.sin(a)]; }).concat([[-V.R,0]])),
      PL('','o',[[V.xc-V.Rc,0],[V.xc,-V.Hc],[V.xc+V.Rc,0],[V.xc-V.Rc,0]]),C('','o',0,V.Ys,V.R),C('','o',V.xc,V.Ys,V.Rc)];
    const S={box:box(-V.R-14,-V.Hc-12,Math.max(V.R,V.xc+V.Rc)+14,V.Ys+V.R+10),axis:0,base,E};
    if(trap==='One') S.E=E.filter(e=>!['p2f','l2','p2h'].includes(e.role));
    return S;
  },
  fair(V,k,ok,bad){ if(k==='Ax') return far(ptOf(ok,'p1f'),ptOf(bad,'p1f'),6); return true; },
  traps:{
    Lk:{b0:-1.5,say:'Линия связи ⟂ оси x',src:'Ж с. 22',hl:['l1','p1h']},
    One:{b0:-.2,say:'Очерки пересекаются в двух точках — обе опорные',src:'Ж с. 115; М с. 18, 25',hl:['p2f','l2','p2h']},
    Pl:{b0:.3,say:'Точка очерка на π₁ — на линии симметрии',src:'Ж с. 115; М с. 18',hl:['p1h','l1']},
    Ax:{b0:.6,say:'Опорная точка — на очерках, а не на оси',src:'Ж с. 115; М с. 18',hl:['p1f','l1','p1h']}}
});

/* ── x6 · эксцентрические сферы: тор (ось ⟂ π₂) и конус в общей плоскости симметрии — на π₂ ── */
PREP.topic('x6',{
  make(){
    for(let t=0;t<500;t++){
      const zO=rnd(55,70),Rc=rnd(38,46),rt=rnd(12,16),xa=sgn()*rnd(.55,.85)*Rc,Rb=rnd(30,40),Hk=rnd(100,125);
      const V={zO,Rc,rt,xa,Rb,Hk,th:rnd(25,155)*D}; if(this.scene(V,null)) return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'Меридиан тора — окружность; на π₂ отрезок через центр O″',roles:['mer']},
    {cap:'Перпендикуляр к плоскости меридиана через его центр',roles:['mer','tl']},
    {cap:'Он пересёк ось конуса — центр сферы O₁″',roles:['mer','tl','Q']},
    {cap:'Сфера через меридиан режет конус по окружности — отрезок',roles:['mer','tl','Q','sph','chC']},
    {cap:'Отрезки одной сферы пересеклись — точка 1″',roles:['mer','tl','Q','sph','chC','K']}]},
  scene(V,trap){
    const O=[0,-V.zO], e=[Math.cos(V.th),-Math.sin(V.th)], Cm=[O[0]+e[0]*V.Rc,O[1]+e[1]*V.Rc];
    let tdir=[-e[1],e[0]];
    if(trap==='Nt'){ const a=sgn()*rnd(15,22)*D, c=Math.cos(a), s=Math.sin(a); tdir=[tdir[0]*c-tdir[1]*s,tdir[0]*s+tdir[1]*c]; }
    if(Math.abs(tdir[0])<.2) return null;
    const sq=(V.xa-Cm[0])/tdir[0], Q=[V.xa,Cm[1]+sq*tdir[1]];
    let rho=Math.sqrt(sq*sq+V.rt*V.rt); if(trap==='Rr') rho+=sgn()*rnd(4,6);
    let me=e; if(trap==='Mr') me=[0,1];
    const mer=[Cm[0]-me[0]*V.rt,Cm[1]-me[1]*V.rt,Cm[0]+me[0]*V.rt,Cm[1]+me[1]*V.rt];
    /* сечение конуса сферой с центром на его оси — горизонтальные отрезки */
    const cr=[[V.xa+V.Rb,0],[V.xa,-V.Hk]], ux=cr[1][0]-cr[0][0], uy=cr[1][1]-cr[0][1];
    const cc=lineCirc(cr[0][0],cr[0][1],ux,uy,Q[0],Q[1],rho).filter(t=>t>.02&&t<.98).map(t=>{ const x=cr[0][0]+ux*t, y=cr[0][1]+uy*t; return [2*V.xa-x,y,x,y]; });
    /* отрезок конуса выбираем по верному меридиану; ловушка «меридиан не через центр» берёт тот же отрезок */
    const merOk=[Cm[0]-e[0]*V.rt,Cm[1]-e[1]*V.rt,Cm[0]+e[0]*V.rt,Cm[1]+e[1]*V.rt];
    const chC=cc.find(c=>inSeg(lineX(c,merOk))); if(!chC) return null;
    const X0=lineX(chC,mer); if(!inSeg(X0)) return null; let K=[X0[0],X0[1]];
    if(trap==='Ko'){ const side=K[0]<V.xa?[[V.xa-V.Rb,0],[V.xa,-V.Hk]]:cr; const X=lineX(mer,[side[0][0],side[0][1],side[1][0],side[1][1]]); if(!X||X[2]<.15||X[2]>.85) return null; K=[X[0],X[1]]; }
    const E=[L('mer','b',...mer),L('tl','a',Cm[0],Cm[1],Q[0],Q[1]),Pt('Q',Q[0],Q[1],'O₁″',V.xa>0?1:-1,{c:'o'}),C('sph','a',Q[0],Q[1],rho),L('chC','c',...chC),Pt('K',K[0],K[1],'1″',1)];
    const base=[C('','o',O[0],O[1],V.Rc+V.rt),C('','o',O[0],O[1],V.Rc-V.rt),C('','cl',O[0],O[1],V.Rc),Pt('',O[0],O[1],'O″',-1,{c:'o',r:.9}),
      L('','cl',O[0]-V.Rc-V.rt-5,O[1],O[0]+V.Rc+V.rt+5,O[1]),L('','cl',O[0],O[1]-V.Rc-V.rt-5,O[0],O[1]+V.Rc+V.rt+5),
      PL('','o',[[V.xa-V.Rb,0],[V.xa,-V.Hk],[V.xa+V.Rb,0],[V.xa-V.Rb,0]]),L('','cl',V.xa,-V.Hk-6,V.xa,4)];
    const xs=[-V.Rc-V.rt,V.Rc+V.rt,V.xa-V.Rb,V.xa+V.Rb,Q[0]-rho,Q[0]+rho], ys=[-V.Hk,O[1]-V.Rc-V.rt,O[1]+V.Rc+V.rt,0,Q[1]-rho,Q[1]+rho];
    if(Math.max(...xs)-Math.min(...xs)>240||Math.max(...ys)-Math.min(...ys)>260) return null;
    return {box:box(Math.min(...xs)-10,Math.min(...ys)-10,Math.max(...xs)+10,Math.max(...ys)+8),axis:0,base,E};
  },
  /* точка ловушки не должна случайно оказаться настоящей точкой линии (окружность конуса пересекает трубку тора дважды) */
  fair(V,k,ok,bad){ if(k==='Mr'&&Math.abs(Math.cos(V.th))<.45) return false; const K=ptOf(bad,'K');
    const z=-K[1], w=V.Rb*(1-z/V.Hk), dx=K[0]-V.xa; if(Math.abs(dx)<=w){ const y=Math.sqrt(w*w-dx*dx), ra=Math.hypot(K[0],K[1]+V.zO); if(Math.abs(Math.sqrt((ra-V.Rc)**2+y*y)-V.rt)<2) return false; }
    return far(ptOf(ok,'K'),K,4.5); },
  traps:{
    Ko:{b0:.3,say:'Точка — на пересечении отрезков, не на очерке',src:'Ж с. 122–123',hl:['K']},
    Mr:{b0:.4,say:'Меридиан на π₂ — отрезок через центр тора',src:'Ж с. 122; М с. 21',hl:['mer','K']},
    Rr:{b0:.6,say:'Сфера проходит через концы меридиана',src:'Ж с. 122–123',hl:['sph','chC','K']},
    Nt:{b0:.8,say:'Центр — на перпендикуляре к плоскости меридиана',src:'Ж с. 122; М с. 21',hl:['tl','Q','sph','chC','K']}}
});

/* ── f2 · точка на грани пирамиды: прямая через вершину ── */
PREP.topic('f2',{
  make(){
    for(let t=0;t<300;t++){
      const Y0=rnd(55,62), A=[-rnd(38,46),rnd(26,34),0], B=[rnd(34,44),rnd(22,32),0], Cc=[rnd(-8,10),-rnd(28,36),0], S=[rnd(-6,6),rnd(-4,4),rnd(70,85)];
      const u=rnd(.3,.7), tt=rnd(.35,.7), P1=[A[0]+(B[0]-A[0])*u,A[1]+(B[1]-A[1])*u,0], K=[S[0]+(P1[0]-S[0])*tt,S[1]+(P1[1]-S[1])*tt,S[2]*(1-tt)];
      const V={Y0,A,B,C:Cc,S,K}; if(this.scene(V,null)) return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'Дана K″ на грани SAB. Через S″ и K″ — прямая до ребра A″B″',roles:['s1f','p1f']},
    {cap:'Точку 1 переносим по линии связи на A′B′',roles:['s1f','p1f','l1','p1h']},
    {cap:'Прямая S′1′ лежит в той же грани',roles:['s1f','p1f','l1','p1h','s1h']},
    {cap:'Линия связи от K″ до S′1′ — точка K′',roles:['s1f','p1f','l1','p1h','s1h','lk','Kh']}]},
  scene(V,trap){
    const f=p=>[p[0],-p[2]], h=p=>[p[0],V.Y0+p[1]];
    const S2=f(V.S), K2=f(V.K), A2=f(V.A), B2=f(V.B);
    const X=lineX([S2[0],S2[1],K2[0],K2[1]],[A2[0],A2[1],B2[0],B2[1]]); if(!X||X[3]<0||X[3]>1) return null;
    const P1f=[X[0],X[1]];
    let edge=[V.A,V.B]; if(trap==='Ed') edge=[V.A,V.C];
    const eh=[h(edge[0]),h(edge[1])];
    if(Math.abs(eh[1][0]-eh[0][0])<1e-6) return null;
    const ue=(P1f[0]-eh[0][0])/(eh[1][0]-eh[0][0]); if(ue<0||ue>1) return null;
    const P1h=[P1f[0],eh[0][1]+(eh[1][1]-eh[0][1])*ue], Sh=h(V.S);
    let line=[Sh,P1h]; if(trap==='Ln') line=[Sh,h(V.A)];
    if(Math.abs(line[1][0]-line[0][0])<1e-6) return null;
    let kx=K2[0]; if(trap==='Lk') kx+=sgn()*rnd(9,12);
    const w=(kx-line[0][0])/(line[1][0]-line[0][0]); if(w<-.05||w>1.05) return null;
    const Kh=[kx,line[0][1]+(line[1][1]-line[0][1])*w];
    const E=[L('s1f','a',S2[0],S2[1],P1f[0],P1f[1]),Pt('p1f',P1f[0],P1f[1],'1″',1,{c:'o'}),L('l1','lk',P1f[0],P1f[1],P1h[0],P1h[1]),Pt('p1h',P1h[0],P1h[1],'1′',1,{c:'o'}),
      L('s1h','a',Sh[0],Sh[1],P1h[0],P1h[1]),L('lk','lk',K2[0],K2[1],Kh[0],Kh[1]),Pt('Kh',Kh[0],Kh[1],'K′',-1)];
    const C2=f(V.C), Ah=h(V.A), Bh=h(V.B), Ch=h(V.C);
    /* видимость рёбер: на π₂ ребро SC (за гранью SAB) — штрих, если C дальше; на π₁ все рёбра видны (вершина сверху) */
    const base=[L('','o',A2[0],A2[1],B2[0],B2[1]),L('','o',S2[0],S2[1],A2[0],A2[1]),L('','o',S2[0],S2[1],B2[0],B2[1]),L('','o',S2[0],S2[1],C2[0],C2[1],{dash:true}),
      L('','o',A2[0],A2[1],C2[0],C2[1]),L('','o',C2[0],C2[1],B2[0],B2[1]),
      PL('','o',[Ah,Bh,Ch,Ah]),L('','o',Sh[0],Sh[1],Ah[0],Ah[1]),L('','o',Sh[0],Sh[1],Bh[0],Bh[1]),L('','o',Sh[0],Sh[1],Ch[0],Ch[1]),
      Pt('',S2[0],S2[1],'S″',1,{c:'o',r:1}),Pt('',Sh[0],Sh[1],'S′',1,{c:'o',r:1}),Pt('',K2[0],K2[1],'K″',-1,{c:'o'}),
      Pt('',A2[0],A2[1],'A″',-1,{c:'o',r:.9,up:false}),Pt('',B2[0],B2[1],'B″',1,{c:'o',r:.9,up:false}),Pt('',Ah[0],Ah[1],'A′',-1,{c:'o',r:.9}),Pt('',Bh[0],Bh[1],'B′',1,{c:'o',r:.9}),Pt('',Ch[0],Ch[1],'C′',1,{c:'o',r:.9,up:true})];
    const xs=[V.A[0],V.B[0],V.C[0]], ys=[-V.S[2],V.Y0+Math.max(V.A[1],V.B[1]),V.Y0+V.C[1]];
    return {box:box(Math.min(...xs)-14,Math.min(...ys)-12,Math.max(...xs)+14,Math.max(...ys)+12),axis:0,base,E};
  },
  fair(V,k,ok,bad){ return far(ptOf(ok,'Kh'),ptOf(bad,'Kh'),5); },
  traps:{
    Lk:{b0:-1.5,say:'Линия связи ⟂ оси x',src:'Ж с. 22',hl:['lk','Kh']},
    Ln:{b0:.3,say:'K′ — на прямой S′1′, а не на ребре',src:'Ж с. 45, 95',hl:['s1h','lk','Kh']},
    Ed:{b0:.7,say:'1′ — на том же ребре A′B′',src:'Ж с. 45, 95',hl:['l1','p1h','s1h','lk','Kh']}}
});

/* ── f1 · как образуется поверхность: конус вращения, очерк — крайние образующие ── */
PREP.topic('f1',{
  make(){ const R=rnd(36,48),H=rnd(75,95),Y0=R+rnd(16,22); return {R,H,Y0,g:rnd(40,70)*D*sgn()}; },
  watch:{steps:[
    {cap:'Образующая SA вращается вокруг оси i',roles:['g0']},
    {cap:'Её крайние положения на π₂ — очерк',roles:['g0','oL','oR']},
    {cap:'Основание — окружность: на π₂ отрезок, на π₁ окружность',roles:['g0','oL','oR','b2','b1']}]},
  scene(V,trap){
    let w=V.R; if(trap==='In') w=V.R*Math.cos(rnd(28,38)*D);
    let sx=0; if(trap==='Sh') sx=sgn()*rnd(8,12);
    const b1=trap==='Ec'?PL('b1','o',Array.from({length:65},(_,i)=>{ const a=2*Math.PI*i/64; return [V.R*Math.cos(a),V.Y0+V.R*.62*Math.sin(a)]; })):C('b1','o',0,V.Y0,V.R);
    const g=V.g;
    const E=[L('g0','a',sx,-V.H,V.R*Math.cos(g),0),L('oL','o',sx,-V.H,-w,0),L('oR','o',sx,-V.H,w,0),L('b2','o',-w,0,w,0),b1];
    const base=[L('','cl',0,-V.H-8,0,V.Y0+V.R+6),L('','cl',-V.R-6,V.Y0,V.R+6,V.Y0),Pt('',sx,-V.H,'S″',1,{c:'o',r:1}),Pt('',0,V.Y0,'S′',1,{c:'o',r:1})];
    return {box:box(-V.R-14,-V.H-12,V.R+14,V.Y0+V.R+10),axis:0,base,E};
  },
  traps:{
    Ec:{b0:-.6,say:'Ось ⟂ π₁ — основание на π₁ окружность',src:'Ж с. 87–88',hl:['b1']},
    Sh:{b0:.2,say:'Вершина — на оси: очерк симметричен',src:'Ж с. 87',hl:['g0','oL','oR']},
    In:{b0:.5,say:'Очерк — крайние образующие: ширина = диаметр основания',src:'Ж с. 78; М с. 12',hl:['oL','oR','b2']}}
});
})();
