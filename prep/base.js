/* ═══════════ PREP · база: точка, прямая, плоскость (РК1; на них стоят шаги всех ДЗ) ═══════════
   В темах с координатами — как в учебнике: ось x влево от O (X = −x), π₂ над осью (Y = −z), π₁ под осью (Y = y).
   Ж — учебник Жирных и др., М — методичка к ДЗ. */
(function(){
'use strict';
if(!self.PREP) return;
const rnd=(a,b)=>a+Math.random()*(b-a), sgn=()=>Math.random()<.5?-1:1, D=Math.PI/180, R5=v=>Math.round(v/5)*5;
const L=(role,c,x1,y1,x2,y2,o)=>Object.assign({t:'line',role,c,a:[x1,y1,x2,y2]},o||{});
const Pt=(role,x,y,lab,side,o)=>Object.assign({t:'pt',role,a:[x,y],lab,side:side||1},o||{});
const PL=(role,c,p,o)=>Object.assign({t:'poly',role,c,p},o||{});
const Tx=(role,x,y,s,anchor)=>({t:'txt',role,c:'tx',a:[x,y],s,anchor});
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mul=(a,k)=>[a[0]*k,a[1]*k], dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const len=a=>Math.hypot(a[0],a[1]), nrm=a=>{ const l=len(a); return [a[0]/l,a[1]/l]; }, rot=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
const far=(p,q,m)=>Math.hypot(p[0]-q[0],p[1]-q[1])>=m;
const ptOf=(S,role)=>{ const e=S.E.find(x=>x.role===role&&x.t==='pt'); return e?e.a:null; };
function bbox(pts,m){ const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]); m=m||12; return [Math.min(...xs)-m,Math.min(...ys)-m,Math.max(...xs)-Math.min(...xs)+2*m,Math.max(...ys)-Math.min(...ys)+2*m]; }
function lineX(a,b){ const [x1,y1,x2,y2]=a,[x3,y3,x4,y4]=b, d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4); if(Math.abs(d)<1e-9) return null;
  const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d, s=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/d; return [x1+t*(x2-x1),y1+t*(y2-y1),t,s]; }
/* проекции: в темах с координатами X = −x */
const F2=p=>[-p[0],-p[2]], H1=p=>[-p[0],p[1]];
const f2=p=>[p[0],-p[2]], h1=p=>[p[0],p[1]];
const axisO=(x0,x1)=>[Tx('',x0+1,-2,'x'),Pt('',0,0,'O',1,{c:'o',r:.8,up:false})];
const fmt=v=>String(Math.round(v)).replace('-','−');

/* ══ p1 · эпюр Монжа: A″ над осью на высоте z, A′ под осью на глубине y, обе — на одной линии связи ⟂ x ══ */
PREP.topic('p1',{
  make(){ return {A:[R5(rnd(15,55)),R5(rnd(10,40)),R5(rnd(10,40))]}; },
  watch:{steps:[
    {cap:'Фронтальная проекция A″ — на высоте z над осью x',roles:['A2']},
    {cap:'Горизонтальная проекция A′ — на глубине y под осью',roles:['A2','A1']},
    {cap:'Обе — на одной линии связи ⟂ x',roles:['A2','A1','lk']}]},
  scene(V,trap){
    const [x,y,z]=V.A; let a2=[-x,-z], a1=[-x,y], l2='A″', l1='A′';
    if(trap==='Yz'){ a2=[-x,-y]; a1=[-x,z]; }
    if(trap==='Sw'){ l2='A′'; l1='A″'; }
    if(trap==='Lk') a1=[-x+sgn()*rnd(8,11),y];
    const E=[Pt('A2',a2[0],a2[1],l2,1),Pt('A1',a1[0],a1[1],l1,1),L('lk','lk',a2[0],a2[1],a1[0],a1[1])];
    return {box:bbox([[-70,0],[12,0],a2,a1,[-70,-45],[-70,45]],8),axis:0,base:[...axisO(-70),Tx('',-68,-38,`A (${x}; ${y}; ${z})`)],E};
  },
  fair(V,k){ return k!=='Yz'||Math.abs(V.A[1]-V.A[2])>=8; },
  traps:{
    Lk:{b0:-1.5,say:'Проекции — на одной линии связи ⟂ x',src:'Ж §3',hl:['A1','lk']},
    Sw:{b0:-.2,say:'Над осью — фронтальная A″, под осью — горизонтальная A′',src:'Ж §3',hl:['A2','A1']},
    Yz:{b0:.4,say:'Высота A″ — z, глубина A′ — y',src:'Ж §4',hl:['A2','A1','lk']}}
});

/* ══ p2 · координаты — отрезки на чертеже: x — от O до линии связи, y — от оси до A′, z — от оси до A″ ══ */
PREP.topic('p2',{
  make(){ for(;;){ const A=[R5(rnd(20,55)),R5(rnd(10,40)),R5(rnd(10,40))]; if(Math.abs(A[1]-A[2])>=10) return {A}; } },
  watch:{steps:[
    {cap:'x — отрезок оси от O до линии связи (влево)',roles:['sx','tx']},
    {cap:'z — от оси вверх до A″',roles:['sx','tx','sz','tz','A2']},
    {cap:'y — от оси вниз до A′ (y > 0)',roles:['sx','tx','sz','tz','A2','sy','ty','A1']}]},
  scene(V,trap){
    const [x,y,z]=V.A; let tz='z', ty='y', xs=-x, ys=y;
    if(trap==='Yz'){ tz='y'; ty='z'; } if(trap==='Xr') xs=x; if(trap==='Up') ys=-y;
    const E=[L('sx','crv',0,0,xs,0),Tx('tx',xs/2,4,'x='+x),L('sz','b',-x,0,-x,-z),Tx('tz',-x+2,-z/2,tz+'='+z),Pt('A2',-x,-z,'A″',-1),
      L('sy','c',-x,0,-x,ys),Tx('ty',-x+2,ys/2+2,ty+'='+y),Pt('A1',-x,ys,'A′',-1)];
    return {box:bbox([[-70,0],[Math.max(12,xs+8),0],[-x,-z],[-x,ys],[-70,-45],[-70,45]],8),axis:0,base:[...axisO(-70),Pt('',-x,0,null,1,{c:'o',r:.7})],E};
  },
  fair(V,k){ return k!=='Up'||Math.abs(V.A[1]-V.A[2])>=8; },
  traps:{
    Xr:{b0:-.2,say:'x откладывают от O влево',src:'Ж §4',hl:['sx','tx']},
    Up:{b0:.1,say:'y > 0 откладывают вниз от оси — A′ под осью',src:'Ж с. 21–22',hl:['sy','ty','A1']},
    Yz:{b0:.3,say:'До A″ — z (высота), до A′ — y (глубина)',src:'Ж с. 21',hl:['tz','ty']}}
});

/* ══ p3 · третья проекция: A‴ на высоте z, справа от оси z на расстоянии y (через постоянную прямую 45°) ══ */
PREP.topic('p3',{
  make(){ for(;;){ const A=[R5(rnd(20,50)),R5(rnd(12,38)),R5(rnd(12,38))]; if(Math.abs(A[0]-A[1])>=10&&Math.abs(A[1]-A[2])>=8) return {A}; } },
  watch:{steps:[
    {cap:'От A′ — горизонтально до прямой 45°, потом вверх',roles:['l1','l2']},
    {cap:'От A″ — горизонтально вправо',roles:['l1','l2','l3']},
    {cap:'Пересечение — A‴: высота z, расстояние y от оси z',roles:['l1','l2','l3','A3']}]},
  scene(V,trap){
    const [x,y,z]=V.A, a2=[-x,-z], a1=[-x,y];
    let d=y, h=z; if(trap==='Dx') d=x; if(trap==='Hy') h=y;
    let side=1; if(trap==='Lf') side=-1;
    const A3=[side*d,-h];
    const E=[L('l1','lk',a1[0],a1[1],side*y,y),L('l2','lk',side*y,y,side*d,-h),L('l3','lk',a2[0],a2[1],A3[0],A3[1]),Pt('A3',A3[0],A3[1],'A‴',1)];
    const base=[Tx('',-68,-2,'x'),L('','ax',0,-50,0,50),Tx('',1.5,-47,'z'),Tx('',52,-2,'y'),Tx('',1.5,49,'y'),L('','cl',0,0,45,45),
      Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:1}),Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:1}),L('','lk',a2[0],a2[1],a1[0],a1[1])];
    return {box:bbox([[-70,-50],[55,50],A3,[side*d,y]],8),axis:0,base,E};
  },
  traps:{
    Lf:{b0:-.4,say:'A‴ — справа от оси z',src:'Ж §4',hl:['l1','l2','l3','A3']},
    Hy:{b0:.3,say:'Высота A‴ — та же z, что у A″',src:'Ж §4',hl:['l2','l3','A3']},
    Dx:{b0:.5,say:'От оси z до A‴ — y, а не x',src:'Ж §4',hl:['l2','l3','A3']}}
});

/* ══ p4 · четверти: знак y — где A′ относительно оси, знак z — где A″ ══ */
PREP.topic('p4',{
  make(){ const q=Math.random()*4|0, sy=q===1||q===2?-1:1, sz=q===2||q===3?-1:1; return {A:[R5(rnd(20,55)),sy*R5(rnd(12,38)),sz*R5(rnd(12,38))],q:q+1}; },
  watch:{steps:[
    {cap:'z > 0 — A″ над осью, z < 0 — под осью',roles:['A2']},
    {cap:'y > 0 — A′ под осью, y < 0 — над осью',roles:['A2','A1','lk']}]},
  scene(V,trap){
    const [x,y,z]=V.A; let a2=[-x,-z], a1=[-x,y];
    if(trap==='Sy') a1=[-x,-y]; if(trap==='Sz') a2=[-x,z]; if(trap==='Sb'){ a1=[-x,-y]; a2=[-x,z]; }
    if(trap==='Lk') a1=[-x+sgn()*rnd(8,11),y];
    const E=[Pt('A2',a2[0],a2[1],'A″',1),Pt('A1',a1[0],a1[1],'A′',1),L('lk','lk',a2[0],a2[1],a1[0],a1[1])];
    return {box:bbox([[-70,-45],[12,45],a2,a1],8),axis:0,base:[...axisO(-70),Tx('',-68,-38,`A (${x}; ${fmt(y)}; ${fmt(z)})`)],E};
  },
  traps:{
    Lk:{b0:-1.4,say:'Проекции — на одной линии связи ⟂ x',src:'Ж с. 22',hl:['A1','lk']},
    Sz:{b0:.2,say:'z < 0 — A″ под осью x',src:'Ж §3',hl:['A2','lk']},
    Sy:{b0:.4,say:'y < 0 — A′ над осью x',src:'Ж §3',hl:['A1','lk']},
    Sb:{b0:.6,say:'Знак z — где A″, знак y — где A′ (y > 0 — вниз)',src:'Ж с. 21–22',hl:['A2','A1','lk']}}
});

/* ══ p5 · конкурирующие точки: видна та, что ближе к глазу; невидимую — в скобках ══ */
PREP.topic('p5',{
  make(){ const kind=Math.random()<.5?'h':'f', x=rnd(-30,30), a=[x,rnd(10,40),rnd(10,40)], b=a.slice();
    if(kind==='h'){ b[2]=a[2]+sgn()*rnd(12,22); } else { b[1]=a[1]+sgn()*rnd(12,22); }
    if(b[1]<6||b[2]<6) return this.make(); return {kind,A:a,B:b}; },
  watch:{steps:[
    {cap:'A и B на одном проецирующем луче — эти проекции совпали',roles:['P']},
    {cap:'Другие проекции — разные: по ним видно, кто ближе к глазу',roles:['P','Q','R','lq','lr']}]},
  scene(V,trap){
    const {A,B,kind}=V; let top=kind==='h'?(A[2]>B[2]?'A':'B'):(A[1]>B[1]?'A':'B');
    if(trap==='Wr') top=top==='A'?'B':'A';
    const low=top==='A'?'B':'A', pr=kind==='h'?'′':'″', op=kind==='h'?'″':'′';
    const P0=kind==='h'?h1(A):f2(A); let qa=kind==='h'?f2(A):h1(A), qb=kind==='h'?f2(B):h1(B);
    if(trap==='Fr') qb=qa.slice();   /* «совпали» и другие проекции */
    const lab=trap==='Np'?`${top}${pr}≡${low}${pr}`:`${top}${pr}≡(${low}${pr})`;
    const E=[Pt('P',P0[0],P0[1],lab,1),Pt('Q',qa[0],qa[1],'A'+op,-1,{c:'o'}),Pt('R',qb[0],qb[1],'B'+op,1,{c:'o'}),L('lq','lk',...P0,...qa),L('lr','lk',...P0,...qb)];
    return {box:bbox([[-55,-50],[55,50]],6),axis:0,base:[],E,_top:top};
  },
  traps:{
    Np:{b0:-.3,say:'Невидимую из конкурирующих — в скобки',src:'Ж с. 29–30',hl:['P']},
    Wr:{b0:.3,say:'Видна точка ближе к глазу: на π₁ — выше, на π₂ — ближе',src:'Ж §11',hl:['P']},
    Fr:{b0:.5,say:'Совпадает только одна пара проекций — другие разные',src:'Ж с. 29',hl:['R','lr']}}
});

/* ══ l1 · положения прямой: горизонталь — h″ ∥ x; фронталь — f′ ∥ x; проецирующая — одна проекция в точку ══ */
const LT={h:'горизонталь h',f:'фронталь f',hp:'горизонтально-проецирующая',fp:'фронтально-проецирующая'};
function lineOf(kind){ const A=[rnd(-45,-15),rnd(10,40),rnd(10,40)], B=[rnd(15,45),rnd(10,40),rnd(10,40)];
  if(kind==='h') B[2]=A[2]; if(kind==='f') B[1]=A[1]; if(kind==='hp'){ B[0]=A[0]; B[1]=A[1]; B[2]=A[2]+sgn()*rnd(18,28); } if(kind==='fp'){ B[0]=A[0]; B[2]=A[2]; B[1]=A[1]+sgn()*rnd(18,28); }
  if(B[1]<5||B[2]<5) return lineOf(kind); return {A,B}; }
PREP.topic('l1',{
  make(){ const kinds=Object.keys(LT), kind=kinds[Math.random()*4|0]; const o=lineOf(kind); o.kind=kind; const A=o.A;
    const sw={h:'f',f:'h',hp:'fp',fp:'hp'}[kind];
    /* «двойник»: та же A, признак другого типа */
    const W=A.slice(); if(sw==='h'){ W[0]=o.B[0]; W[1]=o.B[1]+sgn()*rnd(10,18); W[2]=A[2]; } else if(sw==='f'){ W[0]=o.B[0]; W[2]=o.B[2]+sgn()*rnd(10,18); W[1]=A[1]; } else if(sw==='hp'){ W[2]=A[2]+sgn()*rnd(18,28); } else { W[1]=A[1]+sgn()*rnd(18,28); }
    /* общего положения */
    const G=[o.B[0]||rnd(15,45),rnd(10,40),rnd(10,40)]; if(kind==='hp'||kind==='fp') G[0]=A[0]+rnd(20,35);
    if(Math.abs(G[1]-A[1])<8) G[1]=A[1]+12; if(Math.abs(G[2]-A[2])<8) G[2]=A[2]+12;
    /* «почти»: проекция-признак слегка наклонена или вместо точки — короткий отрезок */
    const T=o.B.slice(); const dx=o.B[0]-A[0];
    if(kind==='h') T[2]=A[2]+sgn()*Math.abs(dx)*Math.tan(rnd(9,13)*D); if(kind==='f') T[1]=A[1]+sgn()*Math.abs(dx)*Math.tan(rnd(9,13)*D);
    if(kind==='hp'){ T[0]=A[0]+sgn()*rnd(6,8); } if(kind==='fp'){ T[0]=A[0]+sgn()*rnd(6,8); }
    if([W,G,T].some(p=>p[1]<5||p[2]<5)) return this.make(); o.W=W; o.G=G; o.T=T; return o; },
  watch:{steps:[{cap:'Тип прямой — по её проекциям',roles:['ab2','ab1','B2','B1','lb']}]},
  scene(V,trap){
    const A=V.A, B=trap==='Sw'?V.W:trap==='Gn'?V.G:trap==='Tl'?V.T:V.B; const a2=f2(A),b2=f2(B),a1=h1(A),b1=h1(B);
    const E=[L('ab2','o',a2[0],a2[1],b2[0],b2[1]),L('ab1','o',a1[0],a1[1],b1[0],b1[1]),Pt('B2',b2[0],b2[1],'B″',1,{c:'o',r:1}),Pt('B1',b1[0],b1[1],'B′',1,{c:'o',r:1}),L('lb','lk',b2[0],b2[1],b1[0],b1[1])];
    const base=[Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:1}),Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:1}),L('','lk',a2[0],a2[1],a1[0],a1[1]),Tx('',-58,-50,LT[V.kind])];
    return {box:bbox([[-60,-55],[60,50],a2,b2,a1,b1],8),axis:0,base,E};
  },
  traps:{
    Gn:{b0:-.5,say:'Общего положения — ни одна проекция не ∥ x',src:'Ж с. 28',hl:['ab2','ab1','B2','B1','lb']},
    Sw:{b0:.2,say:'Горизонталь: h″ ∥ x. Фронталь: f′ ∥ x. Проецирующая — точка на той плоскости, которой ⟂',src:'Ж §7–8',hl:['ab2','ab1','B2','B1','lb']},
    Tl:{b0:.5,say:'Признак — точный: строго ∥ x или строго точка',src:'Ж с. 28–29',hl:['ab2','ab1','B2','B1','lb']}}
});

/* ══ l2 · точка на прямой делит обе проекции в одном отношении ══ */
PREP.topic('l2',{
  make(){ const A=[rnd(-45,-20),rnd(8,40),rnd(8,40)], B=[rnd(20,45),rnd(8,40),rnd(8,40)]; if(Math.abs(A[1]-B[1])<12||Math.abs(A[2]-B[2])<12) return this.make();
    const r=[[1,2],[2,1],[1,3],[3,1],[2,3]][Math.random()*5|0]; return {A,B,r}; },
  watch:{steps:[{cap:'AK : KB = m : n — на π₂ (делим отрезок по Фалесу)',roles:['K2']},{cap:'K′ — на линии связи; делит A′B′ в том же отношении',roles:['K2','lk','K1']}]},
  scene(V,trap){
    const {A,B,r}=V; let t=r[0]/(r[0]+r[1]); if(trap==='Hf') t=.5; if(trap==='Rv') t=r[1]/(r[0]+r[1]);
    const K=[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t];
    let k2=f2(K), k1=h1(K);
    if(trap==='Lk'){ const t2=t+sgn()*.13; k1=[A[0]+(B[0]-A[0])*t2,A[1]+(B[1]-A[1])*t2]; }
    const E=[Pt('K2',k2[0],k2[1],'K″',1),L('lk','lk',k2[0],k2[1],k1[0],k1[1]),Pt('K1',k1[0],k1[1],'K′',1)];
    const a2=f2(A),b2=f2(B),a1=h1(A),b1=h1(B);
    const base=[L('','o',a2[0],a2[1],b2[0],b2[1]),L('','o',a1[0],a1[1],b1[0],b1[1]),L('','lk',a2[0],a2[1],a1[0],a1[1]),L('','lk',b2[0],b2[1],b1[0],b1[1]),
      Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:1}),Pt('',b2[0],b2[1],'B″',1,{c:'o',r:1}),Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:1}),Pt('',b1[0],b1[1],'B′',1,{c:'o',r:1}),Tx('',-55,-50,`AK : KB = ${r[0]} : ${r[1]}`)];
    return {box:bbox([[-60,-55],[60,50],a2,b2,a1,b1],8),axis:0,base,E};
  },
  traps:{
    Lk:{b0:-.6,say:'K′ и K″ — на одной линии связи',src:'Ж §9',hl:['lk','K1']},
    Hf:{b0:.1,say:'Делим в заданном отношении, а не пополам',src:'Ж с. 33',hl:['K2','lk','K1']},
    Rv:{b0:.5,say:'AK : KB — считаем от A',src:'Ж §9',hl:['K2','lk','K1']}}
});

/* ══ l3 · следы прямой: H — где z = 0 (H″ на оси x), F — где y = 0 (F′ на оси x) ══ */
PREP.topic('l3',{
  make(){ for(let t=0;t<200;t++){ const A=[rnd(-40,-10),rnd(10,35),rnd(25,45)], B=[rnd(10,40),rnd(30,50),rnd(8,20)];
    const tH=A[2]/(A[2]-B[2]), tF=A[1]/(A[1]-B[1]); if(tH>1.2&&tH<3&&tF<-.15&&tF>-2){ return {A,B,tH,tF}; } } return null; },
  watch:{steps:[{cap:'H″ — где A″B″ встречает ось x; H′ — по линии связи на A′B′',roles:['H2','lh','H1']},{cap:'F′ — где A′B′ встречает ось x; F″ — по линии связи на A″B″',roles:['H2','lh','H1','F1','lf','F2']}]},
  scene(V,trap){
    const {A,B}=V, at=t=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t], H=at(V.tH), Fp=at(V.tF);
    let H2=[H[0],0], H1=[H[0],H[1]], F1=[Fp[0],0], F2=[Fp[0],-Fp[2]];
    if(trap==='Sw'){ H1=[H[0],0]; H2=[H[0],-H[1]]; }
    if(trap==='Fs'){ F2=[Fp[0],0]; F1=[Fp[0],Fp[2]]; }
    if(trap==='Lk'){ const x=H[0]+sgn()*rnd(8,11), tt=(x-A[0])/(B[0]-A[0]); H1=[x,A[1]+(B[1]-A[1])*tt]; }
    const a2=f2(A),b2=f2(B),a1=h1(A),b1=h1(B);
    const ext2=[f2(at(V.tF-.15)),f2(at(V.tH+.15))], ext1=[h1(at(V.tF-.15)),h1(at(V.tH+.15))];
    const E=[Pt('H2',H2[0],H2[1],'H″',1,{up:false}),L('lh','lk',H2[0],H2[1],H1[0],H1[1]),Pt('H1',H1[0],H1[1],'H′',1),Pt('F1',F1[0],F1[1],'F′',-1,{up:true}),L('lf','lk',F1[0],F1[1],F2[0],F2[1]),Pt('F2',F2[0],F2[1],'F″',-1)];
    const base=[L('','o',ext2[0][0],ext2[0][1],ext2[1][0],ext2[1][1]),L('','o',ext1[0][0],ext1[0][1],ext1[1][0],ext1[1][1]),L('','lk',a2[0],a2[1],a1[0],a1[1]),L('','lk',b2[0],b2[1],b1[0],b1[1]),
      Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:1}),Pt('',b2[0],b2[1],'B″',1,{c:'o',r:1}),Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:1}),Pt('',b1[0],b1[1],'B′',1,{c:'o',r:1})];
    const b=bbox([ext2[0],ext2[1],ext1[0],ext1[1],H1,H2,F1,F2]); if(b[2]>220||b[3]>220) return null;
    return {box:b,axis:0,base,E};
  },
  traps:{
    Lk:{b0:-.8,say:'H′ — на линии связи с H″',src:'Ж §9',hl:['lh','H1']},
    Sw:{b0:.5,say:'Горизонтальный след: H″ на оси x, H′ — на A′B′',src:'Ж §9',hl:['H2','lh','H1']},
    Fs:{b0:.5,say:'Фронтальный след: F′ на оси x, F″ — на A″B″',src:'Ж с. 31',hl:['F1','lf','F2']}}
});

/* ══ l4 · натуральная величина отрезка: катеты — A′B′ и Δz ══ */
function segGen(){ for(;;){ const A=[rnd(-45,-20),rnd(8,30),rnd(8,25)], B=[rnd(20,45),rnd(25,45),rnd(30,50)]; if(Math.abs(B[2]-A[2])>14&&Math.abs(B[1]-A[1])>10) return {A,B}; } }
function segBase(A,B){ const a2=f2(A),b2=f2(B),a1=h1(A),b1=h1(B);
  return [L('','o',a2[0],a2[1],b2[0],b2[1]),L('','o',a1[0],a1[1],b1[0],b1[1]),L('','lk',a2[0],a2[1],a1[0],a1[1]),L('','lk',b2[0],b2[1],b1[0],b1[1]),
    Pt('A2',a2[0],a2[1],'A″',-1,{c:'o',r:1}),Pt('B2',b2[0],b2[1],'B″',1,{c:'o',r:1}),Pt('A1',a1[0],a1[1],'A′',-1,{c:'o',r:1}),Pt('B1',b1[0],b1[1],'B′',1,{c:'o',r:1})]; }
function triNV(V,trap,mode){
  const {A,B}=V, a1=h1(A), b1=h1(B), u=nrm(sub(b1,a1)); let n=[-u[1],u[0]]; if(n[1]>0) n=mul(n,-1);   /* катет — в сторону от π₂ не важен; берём «вверх» к оси */
  let dz=Math.abs(B[2]-A[2]); if(trap==='Zb') dz=B[2]; if(trap==='Dy') dz=Math.abs(B[1]-A[1]);
  let nn=n; if(trap==='Np') nn=rot(n,sgn()*rnd(16,22)*D);
  const B0=add(b1,mul(nn,dz));
  return {a1,b1,B0};
}
PREP.topic('l4',{
  make:segGen,
  watch:{steps:[{cap:'На A′B′ — перпендикуляр в B′ длиной Δz (разность высот с π₂)',roles:['leg','B0']},{cap:'Гипотенуза A′B₀ — натуральная величина AB',roles:['leg','B0','nv']}]},
  scene(V,trap){ const t=triNV(V,trap);
    const E=[L('leg','a',t.b1[0],t.b1[1],t.B0[0],t.B0[1]),Pt('B0',t.B0[0],t.B0[1],'B₀',1),L('nv','crv',t.a1[0],t.a1[1],t.B0[0],t.B0[1]),Tx('',t.B0[0]+2,(t.b1[1]+t.B0[1])/2,'Δz')];
    E[3].role='leg';
    return {box:bbox([f2(V.A),f2(V.B),t.a1,t.b1,t.B0,[-55,0],[55,0]]),axis:0,base:segBase(V.A,V.B),E}; },
  fair(V,k,ok,bad){ return far(ptOf(ok,'B0'),ptOf(bad,'B0'),5); },
  traps:{
    Np:{b0:-.4,say:'Катет Δz — ⟂ проекции A′B′',src:'Ж §10, рис. 46',hl:['leg','B0','nv']},
    Zb:{b0:.4,say:'Катет — разность высот Δz, а не z точки',src:'Ж §10; М с. 6',hl:['leg','B0','nv']},
    Dy:{b0:.7,say:'К A′B′ — катет Δz (с π₂), не Δy',src:'Ж §10; М с. 6',hl:['leg','B0','nv']}}
});

/* ══ l4u · угол наклона к π₁ — в треугольнике на A′B′ при вершине A′ ══ */
PREP.topic('l4u',{
  make:segGen,
  watch:{steps:[{cap:'Треугольник на A′B′ с катетом Δz',roles:['leg','nv']},{cap:'Угол α к π₁ — при A′, между A′B′ и гипотенузой',roles:['leg','nv','arc']}]},
  scene(V,trap){
    let t; if(trap==='Fb'){ const a2=f2(V.A), b2=f2(V.B), u=nrm(sub(b2,a2)); let n=[-u[1],u[0]]; if(n[1]<0) n=mul(n,-1); const B0=add(b2,mul(n,Math.abs(V.B[1]-V.A[1]))); t={a1:a2,b1:b2,B0}; }
    else t=triNV(V,trap==='Dy'?'Dy':null);
    const at=trap==='Ab'?t.B0:t.a1, p=trap==='Ab'?t.a1:t.b1, q=trap==='Ab'?t.b1:t.B0;
    const a0=Math.atan2(p[1]-at[1],p[0]-at[0]), a1=Math.atan2(q[1]-at[1],q[0]-at[0]); let d=a1-a0; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI;
    const arc=Array.from({length:13},(_,i)=>[at[0]+12*Math.cos(a0+d*i/12),at[1]+12*Math.sin(a0+d*i/12)]);
    const E=[L('leg','a',t.b1[0],t.b1[1],t.B0[0],t.B0[1]),L('nv','crv',t.a1[0],t.a1[1],t.B0[0],t.B0[1]),PL('arc','c',arc),Tx('arc',at[0]+16*Math.cos(a0+d/2),at[1]+16*Math.sin(a0+d/2)+2,'α')];
    return {box:bbox([f2(V.A),f2(V.B),h1(V.A),h1(V.B),t.B0,[-55,0],[55,0]]),axis:0,base:segBase(V.A,V.B),E,_at:at};
  },
  fair(V,k){ return k!=='Dy'||Math.abs(Math.abs(V.B[2]-V.A[2])-Math.abs(V.B[1]-V.A[1]))>5; },
  traps:{
    Ab:{b0:.2,say:'α — при A′, против катета Δz',src:'Ж с. 35, рис. 47',hl:['arc']},
    Dy:{b0:.4,say:'Для α катет — Δz, не Δy',src:'Ж с. 34',hl:['leg','nv','arc']},
    Fb:{b0:.6,say:'α (к π₁) — на A′B′ с Δz; на A″B″ с Δy — это β',src:'Ж с. 35; М с. 7',hl:['leg','nv','arc']}}
});

/* ══ l5 · отрезок длины ℓ на прямой: натуральная величина вспомогательного отрезка, на ней — ℓ, обратно на проекцию ══ */
PREP.topic('l5',{
  make(){ const o=segGen(); o.l=R5(rnd(25,38)); const NV=Math.hypot(o.B[0]-o.A[0],o.B[1]-o.A[1],o.B[2]-o.A[2]); if(NV<o.l+12) return this.make(); return o; },
  watch:{steps:[{cap:'Натуральная величина A′B₀ — прямоугольным треугольником',roles:['leg','nv']},{cap:'На A′B₀ откладываем ℓ — точка K₀',roles:['leg','nv','K0']},{cap:'Из K₀ — ∥ катету до A′B′: K′, затем K″ по линии связи',roles:['leg','nv','K0','bk','K1','lk','K2']}]},
  scene(V,trap){ const t=triNV(V,null), u=nrm(sub(t.B0,t.a1)), K0=trap==='Fe'?add(t.B0,mul(u,-V.l)):add(t.a1,mul(u,V.l));
    let K1;
    if(trap==='Pr') K1=add(t.a1,mul(nrm(sub(t.b1,t.a1)),V.l));
    else { const X=lineX([K0[0],K0[1],K0[0]+(t.b1[0]-t.B0[0]),K0[1]+(t.b1[1]-t.B0[1])],[t.a1[0],t.a1[1],t.b1[0],t.b1[1]]); K1=[X[0],X[1]]; }
    const s=(K1[0]-V.A[0])/(V.B[0]-V.A[0]); let K2=[K1[0],-(V.A[2]+(V.B[2]-V.A[2])*s)];
    if(trap==='Lk'){ const x=K1[0]+sgn()*rnd(8,11), s2=(x-V.A[0])/(V.B[0]-V.A[0]); K2=[x,-(V.A[2]+(V.B[2]-V.A[2])*s2)]; }
    const E=[L('leg','a',t.b1[0],t.b1[1],t.B0[0],t.B0[1]),L('nv','a',t.a1[0],t.a1[1],t.B0[0],t.B0[1]),Pt('K0',K0[0],K0[1],'K₀',1,{c:'o'}),
      L('bk','lk',...(trap==='Pr'?[K1[0],K1[1]]:K0),K1[0],K1[1]),Pt('K1',K1[0],K1[1],'K′',1),L('lk','lk',K1[0],K1[1],K2[0],K2[1]),Pt('K2',K2[0],K2[1],'K″',1)];
    return {box:bbox([f2(V.A),f2(V.B),t.a1,t.b1,t.B0,[-58,-55],[55,0]]),axis:0,base:segBase(V.A,V.B).concat([Tx('',-55,-52,'AK = '+V.l+' мм')]),E}; },
  fair(V,k,ok,bad){ return far(ptOf(ok,'K1'),ptOf(bad,'K1'),4)||far(ptOf(ok,'K2'),ptOf(bad,'K2'),4); },
  traps:{
    Lk:{b0:-1,say:'K″ — на линии связи с K′',src:'Ж с. 22',hl:['lk','K2']},
    Fe:{b0:.3,say:'ℓ откладывают от A — от того конца, от которого задано',src:'Ж §10; М с. 6',hl:['K0','bk','K1','lk','K2']},
    Pr:{b0:.4,say:'Длину откладывают на натуральной величине, не на проекции',src:'Ж с. 34, 36; М с. 6',hl:['bk','K1','lk','K2']}}
});

/* ══ l6 · две прямые: пересекаются ⟺ точки пересечения проекций на одной линии связи ══ */
PREP.topic('l6',{
  make(){ for(;;){ const kind=Math.random()<.6?'x':'p', K=[rnd(-15,15),rnd(18,32),rnd(18,32)], u=[rnd(.6,1),rnd(-.6,.6),rnd(-.6,.6)], w=[rnd(-1,-.5),rnd(-.6,.6),rnd(.3,.8)];
    const P=(d,s,o)=>[K[0]+d[0]*s+(o?o[0]:0),K[1]+d[1]*s+(o?o[1]:0),K[2]+d[2]*s+(o?o[2]:0)];
    let o; if(kind==='x') o={kind,A:P(u,-30),B:P(u,30),C:P(w,-28),Dd:P(w,28),K}; else { const off=[rnd(-6,6),sgn()*rnd(12,16),sgn()*rnd(12,16)]; o={kind,A:P(u,-30),B:P(u,30),C:P(u,-26,off),Dd:P(u,26,off),K}; }
    if([o.A,o.B,o.C,o.Dd].every(p=>p[1]>4&&p[2]>4)) return o; } },
  watch:{steps:[{cap:'Вторая прямая b',roles:['cd2','cd1']},{cap:'Пересекаются: точки пересечения проекций — на одной линии связи. Параллельны: параллельны обе проекции',roles:['cd2','cd1','K2','K1','lk']}]},
  scene(V,trap){ const {A,B,C,Dd,kind}=V;
    if(kind==='x'&&trap==='Op') return null; if(kind==='p'&&(trap==='Sk'||trap==='Lk')) return null;
    let D2=Dd.slice(); if(trap==='Sk') D2=[Dd[0],Dd[1]+sgn()*rnd(10,14),Dd[2]]; if(trap==='Op') D2=[Dd[0],Dd[1],Dd[2]+sgn()*rnd(10,14)];
    const E=[L('cd2','c',...f2(C),...f2(D2)),L('cd1','c',...h1(C),...h1(D2))];
    if(kind==='x'){ const X2=lineX([...f2(A),...f2(B)],[...f2(C),...f2(D2)]), X1=lineX([...h1(A),...h1(B)],[...h1(C),...h1(D2)]);
      let k1=[X1[0],X1[1]]; if(trap==='Lk'){ const tt=X1[2]+sgn()*.14; k1=[A[0]+(B[0]-A[0])*tt,A[1]+(B[1]-A[1])*tt]; }
      E.push(Pt('K2',X2[0],X2[1],'K″',1),Pt('K1',k1[0],k1[1],'K′',1),L('lk','lk',X2[0],X2[1],k1[0],k1[1])); }
    const base=[L('','b',...f2(A),...f2(B)),L('','b',...h1(A),...h1(B)),Tx('',f2(B)[0]+1,f2(B)[1],'a″'),Tx('',h1(B)[0]+1,h1(B)[1]+3,'a′'),Tx('',f2(D2)[0]-1,f2(D2)[1]-1.5,'b″','end'),Tx('',-55,-52,kind==='x'?'a ∩ b = K':'a ∥ b')];
    return {box:bbox([f2(A),f2(B),f2(C),f2(D2),h1(A),h1(B),h1(C),h1(D2),[-58,-55],[55,0]]),axis:0,base,E}; },
  fair(V,k,ok,bad){ if(k==='Sk'){ const a=ptOf(bad,'K2'), b=ptOf(bad,'K1'); return Math.abs(a[0]-b[0])>4; } return true; },
  traps:{
    Lk:{b0:-.6,say:'K′ — на линии связи с K″',src:'Ж с. 37',hl:['K1','lk']},
    Sk:{b0:.3,say:'У скрещивающихся «точки пересечения» не на одной линии связи',src:'Ж §11',hl:['cd2','cd1','K2','K1','lk']},
    Op:{b0:.5,say:'Параллельные — параллельны обе проекции',src:'Ж с. 38',hl:['cd2','cd1']}}
});

/* ══ l7 · прямой угол виден на той проекции, где его сторона — линия уровня ══ */
PREP.topic('l7',{
  make(){ const zh=rnd(14,26), h0=[rnd(-45,-25),rnd(8,20),zh], h1p=[rnd(20,45),rnd(30,45),zh], A=[rnd(-15,15),rnd(42,55),rnd(35,50)]; return {h0,h1:h1p,A}; },
  watch:{steps:[{cap:'h ∥ π₁ — прямой угол с h виден на π₁: A′K′ ⟂ h′',roles:['ak1','K1']},{cap:'K″ — по линии связи на h″; A″K″ — не ⟂ h″',roles:['ak1','K1','lk','K2','ak2']}]},
  scene(V,trap){ const a1=h1(V.A), a2=f2(V.A), H0=h1(V.h0), H1=h1(V.h1), e=nrm(sub(H1,H0));
    let K1=add(H0,mul(e,dot(sub(a1,H0),e)));
    if(trap==='Wp'){ K1=[a1[0],H0[1]+(H1[1]-H0[1])*((a1[0]-H0[0])/(H1[0]-H0[0]))]; }
    if(trap==='Ob'){ const e2=rot([-e[1],e[0]],sgn()*rnd(16,22)*D); const X=lineX([a1[0],a1[1],a1[0]+e2[0],a1[1]+e2[1]],[H0[0],H0[1],H1[0],H1[1]]); K1=[X[0],X[1]]; }
    let K2=[K1[0],-V.h0[2]]; if(trap==='Lk') K2=[K1[0]+sgn()*rnd(8,11),-V.h0[2]];
    const E=[L('ak1','d',a1[0],a1[1],K1[0],K1[1]),Pt('K1',K1[0],K1[1],'K′',1),L('lk','lk',K1[0],K1[1],K2[0],K2[1]),Pt('K2',K2[0],K2[1],'K″',1),L('ak2','d',a2[0],a2[1],K2[0],K2[1])];
    const base=[L('','a',H0[0],-V.h0[2],H1[0],-V.h0[2]),L('','a',H0[0],H0[1],H1[0],H1[1]),Tx('',H1[0]+1,-V.h0[2]-1.5,'h″'),Tx('',H1[0]+1,H1[1]+4,'h′'),L('','lk',a2[0],a2[1],a1[0],a1[1]),Pt('',a2[0],a2[1],'A″',-1,{c:'o',r:1}),Pt('',a1[0],a1[1],'A′',-1,{c:'o',r:1}),Tx('',-55,-56,'AK ⟂ h')];
    return {box:bbox([H0,H1,a1,a2,[H0[0],-V.h0[2]],[-58,-58],[55,0]]),axis:0,base,E}; },
  fair(V,k,ok,bad){ return far(ptOf(ok,'K1'),ptOf(bad,'K1'),4)||far(ptOf(ok,'K2'),ptOf(bad,'K2'),4); },
  traps:{
    Lk:{b0:-1,say:'K″ — на линии связи с K′',src:'Ж с. 22',hl:['lk','K2','ak2']},
    Ob:{b0:-.3,say:'A′K′ ⟂ h′ — проверь угол',src:'Ж §12',hl:['ak1','K1','lk','K2','ak2']},
    Wp:{b0:.6,say:'Прямой угол виден на π₁ (h ∥ π₁), а не на π₂',src:'Ж §12',hl:['ak1','K1','lk','K2','ak2']}}
});

})();
