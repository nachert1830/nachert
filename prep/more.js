/* ═══════════ PREP · следы плоскости (s4), фигура по условиям (m8), натуральный вид двумя заменами (t5) ═══════════
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
const v3=(a,b)=>[b[0]-a[0],b[1]-a[1],b[2]-a[2]], dt3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cr3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function bbox(pts,m){ const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]); m=m||12; return [Math.min(...xs)-m,Math.min(...ys)-m,Math.max(...xs)-Math.min(...xs)+2*m,Math.max(...ys)-Math.min(...ys)+2*m]; }
function lineX(a,b){ const [x1,y1,x2,y2]=a,[x3,y3,x4,y4]=b, d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4); if(Math.abs(d)<1e-9) return null;
  const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d, s=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/d; return [x1+t*(x2-x1),y1+t*(y2-y1),t,s]; }
const foot=(P,Q,e)=>add(Q,mul(e,dot(sub(P,Q),e)));
function nproj(P,dist,Q,e){ const F=foot(P,Q,e); let n=sub(F,P); n=len(n)<1e-6?[-e[1],e[0]]:nrm(n); return add(F,mul(n,dist)); }
const axisAround=(Q,e,P,pad)=>{ const ts=P.map(p=>dot(sub(p,Q),e)); const a=Math.min(...ts)-pad, b=Math.max(...ts)+pad; return [Q[0]+e[0]*a,Q[1]+e[1]*a,Q[0]+e[0]*b,Q[1]+e[1]*b]; };

/* ══ s4 · следы плоскости: h₀α — через горизонтальные проекции H′ следов прямых, f₀α — через F″; встречаются в Xα на оси x ══ */
PREP.topic('s4',{
  make(){
    for(let t=0;t<300;t++){
      const X=[rnd(30,48),0,0], a=rnd(200,235)*D, b=rnd(125,160)*D;    /* следы уходят влево: h₀α вниз, f₀α вверх */
      const dh=[Math.cos(a),-Math.sin(a),0], df=[Math.cos(b),0,Math.sin(b)];   /* в пространстве: h — y > 0, f — z > 0 */
      const H=s=>[X[0]+dh[0]*s,X[1]+dh[1]*s,0], F=s=>[X[0]+df[0]*s,0,X[2]+df[2]*s];
      if(dh[1]<.2||df[2]<.3) continue;
      const lines=[[H(rnd(35,50)),F(rnd(15,25))],[H(rnd(15,25)),F(rnd(40,55))]];
      return {X,dh,df,lines};
    }
  },
  watch:{steps:[
    {cap:'Следы прямых a и b: H — на π₁, F — на π₂',roles:['Ha1','Hb1','Fa2','Fb2']},
    {cap:'h₀α — через H′ обеих прямых',roles:['Ha1','Hb1','Fa2','Fb2','h0','h0t']},
    {cap:'f₀α — через F″ обеих прямых. Следы встретились на оси x',roles:['Ha1','Hb1','Fa2','Fb2','h0','h0t','f0','f0t','X']}]},
  scene(V,trap){
    const [a,b]=V.lines, Ha=a[0],Fa=a[1],Hb=b[0],Fb=b[1];
    let ha1=h1(Ha), hb1=h1(Hb), fa2=f2(Fa), fb2=f2(Fb);
    if(trap==='Lk'){ hb1=add(hb1,mul(nrm(sub(h1(Fb),hb1)),sgn()*rnd(8,11))); }
    /* h₀α — через H′ (продлеваем до оси), f₀α — через F″ */
    const X1=lineX([...ha1,...hb1],[-200,0,200,0]); if(!X1) return null;
    let fpts=[fa2,fb2]; if(trap==='Xm'){ fpts=fpts.map(p=>[p[0]+sgn()*0+rnd(7,10),p[1]]); }
    const X2=lineX([...fpts[0],...fpts[1]],[-200,0,200,0]); if(!X2) return null;
    let h0=[X1[0],X1[1],...(dot(sub(ha1,[X1[0],0]),[1,0])<dot(sub(hb1,[X1[0],0]),[1,0])?ha1:hb1)];
    const ext=(P,Q,k)=>[Q[0]+(Q[0]-P[0])*k,Q[1]+(Q[1]-P[1])*k];
    const hFar=[ha1,hb1].sort((p,q)=>Math.hypot(q[0]-X1[0],q[1])-Math.hypot(p[0]-X1[0],p[1]))[0], fFar=fpts.slice().sort((p,q)=>Math.hypot(q[0]-X2[0],q[1])-Math.hypot(p[0]-X2[0],p[1]))[0];
    const hE=ext([X1[0],0],hFar,.15), fE=ext([X2[0],0],fFar,.15);
    const E=[Pt('Ha1',ha1[0],ha1[1],'H′ₐ',-1,{c:'o'}),Pt('Hb1',hb1[0],hb1[1],'H′ᵦ',-1,{c:'o'}),Pt('Fa2',fa2[0],fa2[1],'F″ₐ',-1,{c:'o'}),Pt('Fb2',fb2[0],fb2[1],'F″ᵦ',-1,{c:'o'}),
      L('h0','a',X1[0],0,hE[0],hE[1]),Tx('h0t',hE[0]-1,hE[1]+4,'h₀α','end'),L('f0','c',X2[0],0,fE[0],fE[1]),Tx('f0t',fE[0]-1,fE[1]-1.5,'f₀α','end'),Pt('X',X2[0],0,'Xα',1,{c:'o',up:false})];
    const base=[];
    for(const [Hh,Ff,nm] of [[Ha,Fa,'a'],[Hb,Fb,'b']]){ const H2=[Hh[0],0], H1=h1(Hh), F2=f2(Ff), F1=[Ff[0],0];
      base.push(L('','d',H2[0],H2[1],F2[0],F2[1]),L('','d',H1[0],H1[1],F1[0],F1[1]),L('','lk',H2[0],0,H1[0],H1[1]),L('','lk',F1[0],0,F2[0],F2[1]),Tx('',F2[0]-1.5,F2[1]-2,nm+'″','end'),Tx('',H1[0]-1.5,H1[1]+4.5,nm+'′','end')); }
    const b2=bbox([ha1,hb1,fa2,fb2,hE,fE,[X1[0],0],[X2[0]+6,0],[-60,0]]); if(b2[2]>230||b2[3]>240) return null;
    return {box:b2,axis:0,base,E};
  },
  fair(V,k,ok,bad){ return true; },
  traps:{
    Lk:{b0:-.8,say:'H′ — на линии связи со своей H″ на оси',src:'Ж с. 41, 46',hl:['Hb1','h0','h0t']},
    Xm:{b0:.4,say:'Следы плоскости пересекаются на оси x — в одной точке Xα',src:'Ж с. 41',hl:['Fa2','Fb2','f0','f0t','X']}}
});

/* ══ m8 · фигура по условиям: «точка на прямой a, равноудалённая от A и B» = a ∩ (плоскость ⟂ AB через середину) ══ */
PREP.topic('m8',{
  make(){
    for(let t=0;t<300;t++){
      const A=[rnd(-45,-25),rnd(10,30),rnd(30,50)], B=[rnd(-10,10),rnd(30,50),rnd(8,22)], P=[rnd(5,25),rnd(5,20),rnd(5,20)], Q=[rnd(30,48),rnd(35,55),rnd(35,55)];
      const V={A,B,P,Q}; if(this.scene(V,null)) return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'Условие «|KA| = |KB|» — это плоскость μ ⟂ AB через середину M',roles:['M2','M1']},
    {cap:'μ задаём горизонталью и фронталью: h′ ⟂ A′B′, f″ ⟂ A″B″',roles:['M2','M1','h2','h1','f1','f2']},
    {cap:'Условие «K ∈ a» — вторая линия. Ответ — пересечение: K = a ∩ μ',roles:['M2','M1','h2','h1','f1','f2','K2','lk','K1']}]},
  scene(V,trap){
    const {A,B,P,Q}=V, M=[(A[0]+B[0])/2,(A[1]+B[1])/2,(A[2]+B[2])/2], ab=v3(A,B);
    /* плоскость μ: нормаль — AB (верная) */
    const hd2=[1,0], u1=nrm(sub(h1(B),h1(A))); const hd1=[-u1[1],u1[0]];
    const u2=nrm(sub(f2(B),f2(A))); let fd2=[-u2[1],u2[0]];
    if(trap==='Pf') fd2=rot(fd2,sgn()*rnd(14,20)*D);   /* f″ не ⟂ A″B″ — плоскость не ⟂ AB */
    /* нормаль плоскости по h и f: h = (h1x, h1y, 0), f = (f2x, 0, −f2y) */
    const hv=[hd1[0],hd1[1],0], fv=[fd2[0],0,-fd2[1]], n=cr3(hv,fv);
    const ad=v3(P,Q); let s=dt3(n,v3(P,M))/dt3(n,ad); let K=[P[0]+ad[0]*s,P[1]+ad[1]*s,P[2]+ad[2]*s];
    if(trap==='Pl'){ /* «плоское» мышление: K′ = a′ ∩ h′ (перпендикуляр к A′B′ на одной проекции) */
      const X=lineX([...h1(P),...h1(Q)],[...h1(M),h1(M)[0]+hd1[0],h1(M)[1]+hd1[1]]); if(!X) return null; s=X[2]; K=[P[0]+ad[0]*s,P[1]+ad[1]*s,P[2]+ad[2]*s]; }
    if(s<0.05||s>.95) return null;
    let k2=f2(K), k1=h1(K); if(trap==='Lk'){ const x=k1[0]+sgn()*rnd(8,11); k1=[x,P[1]+(Q[1]-P[1])*((x-P[0])/(Q[0]-P[0]))]; }
    const m2=f2(M), m1=h1(M), S=(c,d,r)=>[c[0]-d[0]*r,c[1]-d[1]*r,c[0]+d[0]*r,c[1]+d[1]*r];
    const E=[Pt('M2',m2[0],m2[1],'M″',1,{c:'o'}),Pt('M1',m1[0],m1[1],'M′',1,{c:'o'}),L('h2','a',...S(m2,hd2,20)),L('h1','a',...S(m1,hd1,22)),L('f1','c',...S(m1,[1,0],20)),L('f2','c',...S(m2,fd2,22)),
      Tx('h1',m1[0]+hd1[0]*22+1,m1[1]+hd1[1]*22+3,'h′'),Tx('f2',m2[0]+fd2[0]*22+1,m2[1]+fd2[1]*22-1,'f″'),
      Pt('K2',k2[0],k2[1],'K″',1),L('lk','lk',...k2,...k1),Pt('K1',k1[0],k1[1],'K′',1)];
    const a2=f2(A),b2=f2(B),a1=h1(A),b1=h1(B),p2=f2(P),q2=f2(Q),p1=h1(P),q1=h1(Q);
    const base=[L('','o',...a2,...b2),L('','o',...a1,...b1),L('','lk',...a2,...a1),L('','lk',...b2,...b1),Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:1}),Pt('',b2[0],b2[1],'B″',1,{c:'o',r:1}),Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:1}),Pt('',b1[0],b1[1],'B′',1,{c:'o',r:1}),
      L('','d',...p2,...q2),L('','d',...p1,...q1),Tx('',q2[0]+1,q2[1]-1.5,'a″'),Tx('',q1[0]+1,q1[1]+4,'a′'),Tx('',-55,-60,'K ∈ a,  |KA| = |KB|')];
    const b=bbox([a2,b2,a1,b1,p2,q2,p1,q1,[-58,-62],[55,0]]); if(b[2]>230||b[3]>240) return null;
    return {box:b,axis:0,base,E};
  },
  /* точка ловушки не должна случайно оказаться равноудалённой (прямая почти ∥ плоскости μ) */
  fair(V,k,ok,bad){ const K1=ptOf(bad,'K1'), K2=ptOf(bad,'K2'), K=[K1[0],K1[1],-K2[1]], d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);
    if(k!=='Lk'&&Math.abs(d(K,V.A)-d(K,V.B))<2) return false; return far(ptOf(ok,'K2'),K2,4)||far(ptOf(ok,'K1'),K1,4); },
  traps:{
    Lk:{b0:-.8,say:'K′ — на линии связи с K″',src:'Ж с. 22; М с. 43',hl:['lk','K1']},
    Pl:{b0:.3,say:'ГМТ — плоскость в пространстве, а не перпендикуляр на одной проекции',src:'М с. 6',hl:['K2','lk','K1']},
    Pf:{b0:.6,say:'μ ⟂ AB: f″ ⟂ A″B″ (прямой угол виден, f ∥ π₂)',src:'Ж с. 50–51; М с. 6',hl:['f2','K2','lk','K1']}}
});

/* ══ t5 · вторая замена: плоскость (на π₃ — прямая) → плоскость уровня: x₂ ∥ A‴B‴C‴, натуральный вид ══ */
function rep1Tri(V){
  const {A,B,C}=V, P1=[A,B,C].map(h1);
  /* горизонталь через A: точка на BC той же высоты */
  const t=(A[2]-B[2])/(C[2]-B[2]); if(t<=.05||t>=.95) return null; const H=[B[0]+(C[0]-B[0])*t,B[1]+(C[1]-B[1])*t];
  const uh=nrm(sub(H,P1[0])), e=[-uh[1],uh[0]], n=[e[1],-e[0]], mx=Math.max(...P1.map(p=>dot(p,n)));
  const Q=add(mul(n,mx+V.off),mul(e,dot(P1[0],e)));
  const P3=P1.map((p,i)=>nproj(p,[A,B,C][i][2],Q,e)), d1=P1.map(p=>Math.abs(dot(sub(p,Q),n)));
  return {P1,P3,Q,e,n,d1};
}
PREP.topic('t5',{
  make(){
    for(let i=0;i<300;i++){
      const zs=[rnd(8,18),rnd(24,34),rnd(40,52)].sort(()=>Math.random()-.5);
      const V={A:[rnd(-40,-20),rnd(10,40),zs[1]],B:[rnd(-5,12),rnd(10,40),zs[0]],C:[rnd(22,42),rnd(10,40),zs[2]],off:rnd(8,11),off2:rnd(9,12)};
      if(this.scene(V,null)) return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'После первой замены плоскость — прямая A‴B‴C‴',roles:[]},
    {cap:'x₂ ∥ этой прямой: π₄ ∥ плоскости',roles:['x2','x2t']},
    {cap:'Линии связи ⟂ x₂, расстояния — от π₁-проекций до x₁',roles:['x2','x2t','la','lb','lc','A4','B4','C4']},
    {cap:'Aᴵⱽ Bᴵⱽ Cᴵⱽ — натуральный вид треугольника',roles:['x2','x2t','la','lb','lc','A4','B4','C4','nv']}]},
  scene(V,trap){
    const r=rep1Tri(V); if(!r) return null; const {P1,P3,Q,e,n,d1}=r;
    const ts=P3.map(p=>dot(p,e)), lo=P3[ts.indexOf(Math.min(...ts))], hi=P3[ts.indexOf(Math.max(...ts))];
    let e2=nrm(sub(hi,lo)); if(trap==='Ax') e2=rot(e2,sgn()*rnd(25,35)*D);
    const n2=[-e2[1],e2[0]], side=dot(sub(P1[0],lo),n2)>0?-1:1;   /* x₂ — по другую сторону от π₁-изображения */
    const Q2=add(lo,mul(n2,side*V.off2));
    const dist=trap==='Dz'?[V.A[2],V.B[2],V.C[2]]:d1;
    const P4=P3.map((p,i)=>nproj(p,dist[i],Q2,e2));
    if(trap==='Lk'){ const F=foot(P3[1],Q2,e2); P4[1]=add(F,mul(rot(nrm(sub(F,P3[1])),sgn()*rnd(20,26)*D),dist[1])); }
    const okP4=P3.map((p,i)=>nproj(p,d1[i],Q2,e2)), ax2=axisAround(Q2,e2,P3.concat(okP4),10), ax1=axisAround(Q,e,P1.concat(P3),8);
    const E=[L('x2','a',...ax2),Tx('x2t',ax2[2]+1,ax2[3]+4,'x₂'),L('la','lk',...P3[0],...P4[0]),L('lb','lk',...P3[1],...P4[1]),L('lc','lk',...P3[2],...P4[2]),
      Pt('A4',...P4[0],'A^IV',-1),Pt('B4',...P4[1],'B^IV',-1),Pt('C4',...P4[2],'C^IV',1),PL('nv','crv',[P4[0],P4[1],P4[2],P4[0]])];
    const base=[PL('','o',[P1[0],P1[1],P1[2],P1[0]]),L('','ax',...ax1),Tx('',ax1[2]+1,ax1[3]-1.5,'x₁'),...P1.map((p,i)=>L('','lk',...p,...P3[i])),L('','o',...lo,...hi),
      ...['A','B','C'].map((k,i)=>Pt('',...P1[i],k+'′',-1,{c:'o',r:.9})),...['A','B','C'].map((k,i)=>Pt('',...P3[i],k+'‴',i===2?1:-1,{c:'o',r:.9}))];
    const b=bbox(P1.concat(P3,P4,[[ax2[0],ax2[1]],[ax2[2],ax2[3]]])); if(b[2]>230||b[3]>300) return null;
    return {box:b,axis:null,base,E};
  },
  fair(V,k,ok,bad){ return ['A4','B4','C4'].some(r=>far(ptOf(ok,r),ptOf(bad,r),4)); },
  traps:{
    Lk:{b0:-.3,say:'Линии связи ⟂ x₂',src:'Ж с. 52, 56',hl:['lb','B4','nv']},
    Ax:{b0:.3,say:'x₂ ∥ вырожденной проекции плоскости',src:'Ж с. 55–56',hl:['x2','x2t','la','lb','lc','A4','B4','C4','nv']},
    Dz:{b0:.7,say:'Расстояние до x₂ — от проекций на π₁ до x₁, не z',src:'Ж с. 56',hl:['la','lb','lc','A4','B4','C4','nv']}}
});
})();
