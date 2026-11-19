/* ═══════════ PREP · темы блоков «Поверхности» и «Пересечения» (ДЗ №4, №5, РК3) ═══════════
   Эпюр: X — x (вправо), π₂ над осью: Y = −z, π₁ под осью: Y = y (y — к зрителю). Мм.
   Ловушки — из сверки с учебником Жирных и др. (Ж) и методичкой к ДЗ (М): одна типичная ошибка = одно отличие чертежа. */
(function(){
'use strict';
if(!self.PREP) return;
const rnd=(a,b)=>a+Math.random()*(b-a), sgn=()=>Math.random()<.5?-1:1, D=Math.PI/180;
const L=(role,c,x1,y1,x2,y2,o)=>Object.assign({t:'line',role,c,a:[x1,y1,x2,y2]},o||{});
const C=(role,c,cx,cy,r,o)=>Object.assign({t:'circ',role,c,a:[cx,cy,r]},o||{});
const Pt=(role,x,y,lab,side,o)=>Object.assign({t:'pt',role,a:[x,y],lab,side:side||1},o||{});
const Tx=(role,x,y,s,anchor)=>({t:'txt',role,c:'tx',a:[x,y],s,anchor});
const PL=(role,c,p,o)=>Object.assign({t:'poly',role,c,p},o||{});
function circInt(x1,y1,r1,x2,y2,r2){
  const dx=x2-x1,dy=y2-y1,d=Math.hypot(dx,dy); if(d>=r1+r2||d<=Math.abs(r1-r2)||d<1e-9) return null;
  const a=(r1*r1-r2*r2+d*d)/(2*d),k=Math.sqrt(Math.max(0,r1*r1-a*a)),mx=x1+a*dx/d,my=y1+a*dy/d,px=-dy/d,py=dx/d;
  return [[mx+px*k,my+py*k],[mx-px*k,my-py*k]];
}
/* прямая (P + t·u) ∩ окружность (c, r): параметры t */
function lineCirc(px,py,ux,uy,cx,cy,r){ const fx=px-cx,fy=py-cy,a=ux*ux+uy*uy,b=2*(fx*ux+fy*uy),c=fx*fx+fy*fy-r*r,d=b*b-4*a*c; if(d<0) return []; const s=Math.sqrt(d); return [(-b-s)/(2*a),(-b+s)/(2*a)]; }
/* пересечение прямых P1P2 и P3P4: [x, y, t (на 1-й), s (на 2-й)] */
function lineX(a,b){ const [x1,y1,x2,y2]=a,[x3,y3,x4,y4]=b, d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4); if(Math.abs(d)<1e-9) return null;
  const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d, s=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/d; return [x1+t*(x2-x1),y1+t*(y2-y1),t,s]; }
const far=(p,q,m)=>Math.hypot(p[0]-q[0],p[1]-q[1])>=m;
const ptOf=(S,role)=>{ const e=S.E.find(x=>x.role===role); return e?e.a:null; };
const box=(x0,y0,x1,y1)=>[x0,y0,x1-x0,y1-y0];

/* ══════ общие тела: полусфера на π₁ и прямой конус с вертикальной осью ══════ */
const rs=(V,h)=>Math.sqrt(Math.max(0,V.R*V.R-h*h)), rc=(V,h)=>V.Rc*(1-h/V.Hc);
function sphCone(){
  for(let tries=0;tries<500;tries++){
    const R=rnd(52,63),Ys=R+15,xc=rnd(.5,.78)*R,dy=sgn()*rnd(8,24),Rc=rnd(30,40),Hc=rnd(90,112);
    const V={R,Ys,xc,dy,yc:Ys+dy,Rc,Hc};
    const P=h=>circInt(0,V.Ys,rs(V,h),V.xc,V.yc,rc(V,h));
    if(!P(0)) continue;
    let hmax=0; for(let h=0;h<Math.min(R,Hc);h+=.25){ if(P(h)) hmax=h; else break; }
    if(hmax<24) continue;
    V.hmax=hmax; V.P=P;
    const b1=[],b2=[]; for(let i=0;i<=120;i++){ const h=hmax*i/120,p=P(h); if(!p) continue; b1.push([p[0][0],p[0][1],h]); b2.push([p[1][0],p[1][1],h]); }
    V.curve=b1.concat(b2.reverse());
    return V;
  }
  return null;
}
function sphConeBase(V){
  return [
    L('','cl',0,-V.R-5,0,4),L('','cl',V.xc,-V.Hc-5,V.xc,4),
    L('','cl',-V.R-5,V.Ys,V.R+5,V.Ys),L('','cl',0,V.Ys-V.R-5,0,V.Ys+V.R+5),
    L('','cl',V.xc-V.Rc-5,V.yc,V.xc+V.Rc+5,V.yc),L('','cl',V.xc,V.yc-V.Rc-5,V.xc,V.yc+V.Rc+5),
    PL('','o',Array.from({length:49},(_,i)=>{ const a=Math.PI*i/48; return [-V.R*Math.cos(a),-V.R*Math.sin(a)]; }).concat([[-V.R,0]])),
    PL('','o',[[V.xc-V.Rc,0],[V.xc,-V.Hc],[V.xc+V.Rc,0],[V.xc-V.Rc,0]]),
    C('','o',0,V.Ys,V.R),C('','o',V.xc,V.yc,V.Rc),Pt('',V.xc,V.yc,null,1,{c:'o',r:.8})];
}
const scBox=V=>box(-V.R-14,-Math.max(V.R,V.Hc)-12,Math.max(V.R,V.xc+V.Rc)+14,Math.max(V.Ys+V.R,V.yc+V.Rc)+10);

/* ── x3 · посредник — плоскость уровня ── */
PREP.topic('x3',{
  make:sphCone,
  watch:{V(){ const V=sphCone(); if(V) V._h=V.hmax*.42; return V; },steps:[
    {cap:'Проводим горизонтальную плоскость γ',roles:['sig']},
    {cap:'На π₂ сечения — отрезки',roles:['sig','chS','chC']},
    {cap:'На π₁ — окружности: радиус с отрезка',roles:['sig','chS','chC','cS','cC']},
    {cap:'Окружности пересеклись — точки 1′ и 2′',roles:['sig','chS','chC','cS','cC','p1h','p2h']},
    {cap:'Линии связи вверх — до f₀γ',roles:['sig','chS','chC','cS','cC','p1h','p2h','l1','l2','p1f','p2f']}]},
  scene(V,trap,hk){
    if(!V) return null;
    const h=hk!=null?hk:(V._h!=null?V._h:(V._h=V.hmax*rnd(.18,.8)));
    const r1=rs(V,h),r2=rc(V,h),xL=-V.R-8,xR=Math.max(V.R,V.xc+V.Rc)+8;
    let sig=L('sig','a',xL,-h,xR,-h), chS=L('chS','b',-r1,-h,r1,-h), chC=L('chC','c',V.xc-r2,-h,V.xc+r2,-h);
    let R1=r1,R2=r2,c1=[0,V.Ys],c2=[V.xc,V.yc],zf=()=>h;
    if(trap==='A') R1=V.R;
    if(trap==='B') R2=rc(V,Math.max(0,h-rnd(14,22)));
    if(trap==='O') c2=[V.xc,V.Ys];
    if(trap==='P'){ const xm=V.xc*.5,t=Math.tan(rnd(20,28)*D)*sgn(); zf=x=>h+(x-xm)*t; sig=L('sig','a',xL,-zf(xL),xR,-zf(xR));
      const seg=ins=>{ let a=null,b=null; for(let x=xL;x<=xR;x+=.1){ if(ins(x,zf(x))){ if(a==null) a=x; b=x; } } return a==null?null:[a,b]; };
      const s=seg((x,z)=>z>=0&&x*x+z*z<=V.R*V.R), c=seg((x,z)=>z>=0&&z<=V.Hc&&Math.abs(x-V.xc)<=rc(V,z)); if(!s||!c) return null;
      chS=L('chS','b',s[0],-zf(s[0]),s[1],-zf(s[1])); chC=L('chC','c',c[0],-zf(c[0]),c[1],-zf(c[1]));
      c1=[(s[0]+s[1])/2,V.Ys]; R1=(s[1]-s[0])/2; c2=[(c[0]+c[1])/2,V.yc]; R2=(c[1]-c[0])/2; }
    const P=circInt(c1[0],c1[1],R1,c2[0],c2[1],R2); if(!P) return null; P.sort((p,q)=>p[0]-q[0]);
    const fx=[P[0][0],P[1][0]], fz=[zf(P[0][0]),zf(P[1][0])];
    if(trap==='C'){ for(let i=0;i<2;i++){ if(Math.abs(fx[i])>=V.R) return null; fz[i]=Math.sqrt(V.R*V.R-fx[i]*fx[i]); } }
    if(trap==='F') fx[0]+=sgn()*rnd(9,13);
    const E=[sig,Tx('sig',xR-1,-zf(xR)-2.4,'f₀γ','end'),chS,chC,C('cS','b',c1[0],c1[1],R1),C('cC','c',c2[0],c2[1],R2),
      Pt('p1h',P[0][0],P[0][1],'1′',-1),Pt('p2h',P[1][0],P[1][1],'2′',1),
      L('l1','lk',P[0][0],P[0][1],fx[0],-fz[0]),L('l2','lk',P[1][0],P[1][1],fx[1],-fz[1]),
      Pt('p1f',fx[0],-fz[0],'1″',-1),Pt('p2f',fx[1],-fz[1],'2″',1)];
    const S={box:scBox(V),axis:0,base:sphConeBase(V),E,_h:h};
    if(trap==='D') S.E=E.filter(e=>!['p2h','l2','p2f'].includes(e.role));
    return S;
  },
  fair(V,k,ok,bad){
    const a=ptOf(ok,'p1h'),b=ptOf(ok,'p2h'); if(!far(a,b,16)||Math.abs(a[0]-b[0])<10||Math.min(a[1],b[1])<8) return false;
    if('ABOP'.includes(k)) return far(ptOf(bad,'p1h'),a,5)&&far(ptOf(bad,'p2h'),b,5);
    if(k==='C') return Math.min(-ptOf(bad,'p1f')[1],-ptOf(bad,'p2f')[1])-ok._h>=7;
    return true;
  },
  traps:{
    F:{b0:-1.6,say:'Линия связи ⟂ оси x',src:'Ж с. 22, 131',hl:['l1','p1f']},
    D:{b0:-.6,say:'Окружности пересекаются в двух точках',src:'Ж с. 115',hl:['p2h','l2','p2f']},
    P:{b0:-.1,say:'γ — плоскость уровня: только тогда окружности',src:'Ж с. 98, 115; М с. 18',hl:['sig','chS','chC','cS','cC','p1h','p2h','l1','l2','p1f','p2f']},
    C:{b0:.5,say:'Точки лежат на следе f₀γ, а не на очерке',src:'Ж с. 115; М с. 18–19',hl:['p1f','p2f','l1','l2']},
    O:{b0:.6,say:'Центр окружности — на оси поверхности',src:'Ж с. 88, 115; М с. 18',hl:['cC','p1h','p2h','l1','l2','p1f','p2f']},
    B:{b0:.9,say:'Радиус берут на уровне γ',src:'Ж с. 109; М с. 25',hl:['cC','p1h','p2h','l1','l2','p1f','p2f']},
    A:{b0:1.3,say:'Радиус сечения, а не шара',src:'Ж с. 115',hl:['cS','p1h','p2h','l1','l2','p1f','p2f']}}
});

/* ── x7 · соединение и видимость ── */
function vis2(V,p){ return p[1]>=V.Ys-1e-6&&p[1]>=V.yc-1e-6; }   /* на π₂ видна точка на передних половинах обеих поверхностей */
PREP.topic('x7',{
  /* вариант, где видимость зависит от обеих поверхностей (иначе ловушку «видна на одной» не показать) */
  make(){ let V=null; for(let t=0;t<40;t++){ V=sphCone(); if(!V) continue; const cnt=V.curve.filter(p=>(p[1]>=V.Ys)!==(p[1]>=V.Ys&&p[1]>=V.yc)).length; if(cnt>8) return V; } return V; },
  watch:{steps:[
    {cap:'Точки линии найдены — соединяем по порядку',roles:['ch']},
    {cap:'На π₂: видна, только если видна на обеих поверхностях',roles:['ch','cf']},
    {cap:'Видимость меняется на очерках',roles:['ch','cf','kp']}]},
  scene(V,trap){
    if(!V) return null;
    const c=V.curve.slice();   /* линия открыта: обе ветви выходят на основание (z = 0) */
    const vis=p=>trap==='V'?p[1]>=V.Ys:vis2(V,p);
    let pts2=c.map(p=>[p[0],-p[2],vis(p)]);
    /* точки смены видимости — на очерке */
    const ks=[]; for(let i=1;i<pts2.length;i++) if(pts2[i][2]!==pts2[i-1][2]) ks.push(i);
    if(trap==='S'&&ks.length){ const sh=Math.round(rnd(7,11))*sgn(); pts2=pts2.map((p,i)=>{ const j=((i+sh)%pts2.length+pts2.length)%pts2.length; return [p[0],p[1],pts2[j][2]]; }); }
    if(trap==='W') pts2=pts2.map(p=>[p[0],p[1],true]);
    const E=[];
    if(trap==='R'){ /* соединили не по порядку: соседние точки переставлены — петли */
      const sub=c.filter((_,i)=>i%8===0), z=sub.slice(); for(let i=1;i+1<z.length;i+=3){ const t=z[i]; z[i]=z[i+1]; z[i+1]=t; }
      E.push(PL('ch','crv',z.map(p=>[p[0],p[1]])));
    } else E.push(PL('ch','crv',c.map(p=>[p[0],p[1]])));
    let seg=[pts2[0]];
    for(let i=1;i<pts2.length;i++){ seg.push(pts2[i]); if(pts2[i][2]!==pts2[i-1][2]||i===pts2.length-1){ E.push(PL('cf','crv',seg.map(p=>[p[0],p[1]]),{dash:!seg[0][2]})); seg=[pts2[i]]; } }
    ks.forEach(i=>{ const p=c[i]; E.push(Pt('kp',p[0],-p[2],null,1,{c:'o',r:1.2})); });
    return {box:scBox(V),axis:0,base:sphConeBase(V),E,_ks:ks.length};
  },
  fair(V,k,ok,bad){ if(ok._ks<1) return false; if(k==='V'){ if(V.curve.filter(p=>(p[1]>=V.Ys)!==(p[1]>=V.Ys&&p[1]>=V.yc)).length<=8) return false; const a=JSON.stringify(ok.E.filter(e=>e.role==='cf').map(e=>e.dash)),b=JSON.stringify(bad.E.filter(e=>e.role==='cf').map(e=>e.dash)); return a!==b; } return true; },
  traps:{
    R:{b0:-1,say:'Точки соединяют по порядку, без петель',src:'Ж с. 104, 115; М с. 19',hl:['ch']},
    W:{b0:-.6,say:'Закрытый участок — штриховой',src:'Ж с. 101, 109; М с. 25',hl:['cf']},
    S:{b0:.4,say:'Видимость меняется только на очерке',src:'Ж с. 110, 115; М с. 25, 30',hl:['cf','kp']},
    V:{b0:.8,say:'Видна, только если видна на обеих поверхностях',src:'Ж с. 101, 115; М с. 30',hl:['cf','kp']}}
});

/* ══════ тело вращения с вертикальной осью: конус или полусфера ══════ */
function rev(){
  const kind=Math.random()<.5?'cone':'sph', R=rnd(42,55), H=rnd(80,100), Y0=R+14;
  const rAt=z=>kind==='cone'?R*(1-z/H):Math.sqrt(Math.max(0,R*R-z*z)), top=kind==='cone'?H:R;
  return {kind,R,H,Y0,rAt,top};
}
function revBase(V){
  const b=[L('','cl',0,-V.top-6,0,4),L('','cl',-V.R-5,V.Y0,V.R+5,V.Y0),L('','cl',0,V.Y0-V.R-5,0,V.Y0+V.R+5),C('','o',0,V.Y0,V.R)];
  if(V.kind==='cone'){ b.push(PL('','o',[[-V.R,0],[0,-V.H],[V.R,0],[-V.R,0]])); b.push(Pt('',0,V.Y0,null,1,{c:'o',r:.8})); }
  else b.push(PL('','o',Array.from({length:49},(_,i)=>{ const a=Math.PI*i/48; return [-V.R*Math.cos(a),-V.R*Math.sin(a)]; }).concat([[-V.R,0]])));
  return b;
}
const revBox=V=>box(-V.R-14,-V.top-12,V.R+14,V.Y0+V.R+10);

/* ── f3 · точка на поверхности вращения ── */
PREP.topic('f3',{
  make(){ const V=rev(); V.z=V.top*rnd(.2,.65); const r=V.rAt(V.z); V.th=rnd(28,152)*D*(Math.random()<.5?1:1); V.x=r*Math.cos(V.th); V.y=r*Math.sin(V.th); return V; },
  watch:{steps:[
    {cap:'Дана A″. Через неё — параллель: на π₂ это отрезок',roles:['par']},
    {cap:'На π₁ параллель — окружность. Радиус — с отрезка',roles:['par','cir']},
    {cap:'Линия связи вниз до окружности',roles:['par','cir','lk']},
    {cap:'A″ видна — значит, A на передней половине',roles:['par','cir','lk','A1']}]},
  scene(V,trap){
    let z=V.z, r=V.rAt(z), rp=r;
    if(trap==='Pz'){ z=Math.min(V.top*.85,Math.max(V.top*.08,z+sgn()*rnd(12,18))); r=rp=V.rAt(z); }
    if(trap==='Rb') r=V.R;
    if(trap==='Rx') r=Math.abs(V.x);
    let x2=V.x; if(trap==='Lk') x2=V.x+sgn()*rnd(9,13);
    if(Math.abs(x2)>r) return null;
    let y=Math.sqrt(Math.max(0,r*r-x2*x2)); if(trap==='Bk') y=-y;
    const E=[L('par','a',-rp,-z,rp,-z),C('cir','a',0,V.Y0,r),L('lk','lk',V.x,-V.z,x2,V.Y0+y),Pt('A1',x2,V.Y0+y,'A′',x2<0?-1:1)];
    return {box:revBox(V),axis:0,base:revBase(V).concat([Pt('',V.x,-V.z,'A″',V.x<0?-1:1,{c:'o'})]),E};
  },
  fair(V,k,ok,bad){ const a=ptOf(ok,'A1'),b=ptOf(bad,'A1'); return a[1]-V.Y0>6&&far(a,b,6)&&Math.abs(V.x)>4; },
  traps:{
    Lk:{b0:-1.5,say:'Линия связи ⟂ оси x',src:'Ж с. 22',hl:['lk','A1']},
    Rb:{b0:.2,say:'Радиус — с параллели через A″, не с основания',src:'Ж с. 88; М с. 25',hl:['cir','lk','A1']},
    Bk:{b0:.5,say:'A″ видна — A на передней половине',src:'Ж §11; М с. 25',hl:['lk','A1']},
    Pz:{b0:.6,say:'Параллель проводят через саму точку',src:'Ж с. 109; М с. 25',hl:['par','cir','lk','A1']},
    Rx:{b0:.8,say:'Радиус — от оси до очерка, а не до A″',src:'Ж с. 88',hl:['cir','lk','A1']}}
});

/* ── x1 · сечение проецирующей плоскостью (конус, фронтально-проецирующая α) ── */
PREP.topic('x1',{
  make(){
    for(let t=0;t<200;t++){
      const R=rnd(44,54),H=rnd(85,100),Y0=R+14,phi=rnd(18,34)*D*sgn(),x0=0,z0=H*rnd(.3,.45);
      const V={kind:'cone',R,H,Y0,top:H,rAt:z=>R*(1-z/H),phi,x0,z0}; V.zf=x=>z0+(x-x0)*Math.tan(phi);
      /* участок следа внутри очерка */
      let a=null,b=null; for(let x=-R;x<=R;x+=.1){ const z=V.zf(x); if(z>0&&z<H&&Math.abs(x)<=V.rAt(z)){ if(a==null) a=x; b=x; } }
      if(a==null||b-a<30) continue;
      V.xa=a; V.xb=b; V.xp=a+(b-a)*rnd(.3,.7); return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'α проецирующая: на π₂ сечение уже есть — это след f₀α',roles:[]},
    {cap:'Берём точку 2″ на следе. Через неё — параллель',roles:['p2f','par']},
    {cap:'На π₁ — окружность параллели',roles:['p2f','par','cir']},
    {cap:'Линия связи: две точки, 2′ и 3′',roles:['p2f','par','cir','lk','p2h','p3h']}]},
  scene(V,trap){
    if(!V) return null;
    const x=V.xp; let z=V.zf(x);
    if(trap==='Of') z+=sgn()*rnd(7,10);
    let r=V.rAt(z); const zc=z;
    if(trap==='Nb') r=V.rAt(Math.max(1,z+sgn()*rnd(12,18)));
    if(trap==='Rb') r=V.R;
    let xh=x; if(trap==='Lk') xh=x+sgn()*rnd(9,12);
    if(Math.abs(xh)>=r-1) return null;
    const y=Math.sqrt(r*r-xh*xh), rp=V.rAt(zc);
    const E=[Pt('p2f',x,-z,'2″≡3″',x<0?-1:1),L('par','a',-rp,-zc,rp,-zc),C('cir','a',0,V.Y0,r),L('lk','lk',x,-z,xh,V.Y0+y),
      Pt('p2h',xh,V.Y0+y,'2′',xh<0?-1:1),Pt('p3h',xh,V.Y0-y,'3′',xh<0?-1:1,{up:true})];
    const S={box:revBox(V),axis:0,base:revBase(V).concat([L('','o',-V.R-10,-V.zf(-V.R-10),V.R+10,-V.zf(V.R+10)),Tx('',V.R+9,-V.zf(V.R+10)-2.4,'f₀α','end')]),E};
    if(trap==='One') S.E=E.filter(e=>e.role!=='p3h');
    return S;
  },
  fair(V,k,ok,bad){ const a=ptOf(ok,'p2h'),b=ptOf(ok,'p3h'); if(!far(a,b,10)) return false; if(k==='One'||k==='Lk') return true; return far(ptOf(bad,'p2h'),a,5); },
  traps:{
    Lk:{b0:-1.5,say:'Линия связи ⟂ оси x',src:'Ж с. 22',hl:['lk','p2h','p3h']},
    One:{b0:-.4,say:'Параллель пересекается дважды: 2′ и 3′',src:'Ж с. 109',hl:['p3h']},
    Of:{b0:.3,say:'Точка сечения — на следе f₀α',src:'Ж с. 101, 109',hl:['p2f','par','cir','lk','p2h','p3h']},
    Rb:{b0:.4,say:'Радиус — с параллели через точку',src:'Ж с. 109; М с. 25',hl:['cir','lk','p2h','p3h']},
    Nb:{b0:.9,say:'Окружность — той же параллели, что и 2″',src:'Ж с. 109; М с. 25',hl:['cir','lk','p2h','p3h']}}
});

/* ── x4 · проецирующая поверхность (цилиндр ⟂ π₁ и полусфера) ── */
PREP.topic('x4',{
  make(){
    for(let t=0;t<200;t++){
      const R=rnd(50,60),Ys=R+14,rq=rnd(14,20),xq=sgn()*rnd(.25,.45)*R,yq=Ys+sgn()*rnd(4,14),Hq=rnd(70,90);
      const th=rnd(0,360)*D, px=xq+rq*Math.cos(th), py=yq+rq*Math.sin(th), d=Math.hypot(px,py-Ys);
      if(d>R*.85||d<R*.25) continue;
      return {R,Ys,rq,xq,yq,Hq,px,py,d};
    }
    return null;
  },
  watch:{steps:[
    {cap:'Цилиндр ⟂ π₁: на π₁ линия уже лежит на его окружности',roles:['p1h']},
    {cap:'Через 1′ — параллель сферы: окружность с центром O′',roles:['p1h','cir']},
    {cap:'На π₂ эта параллель — отрезок своей длины',roles:['p1h','cir','par']},
    {cap:'Линия связи вверх до отрезка — точка 1″',roles:['p1h','cir','par','lk','p1f']}]},
  scene(V,trap){
    if(!V) return null;
    let r=V.d, cx=0, cy=V.Ys;
    if(trap==='Cq'){ r=V.rq; cx=V.xq; cy=V.yq; }
    if(trap==='Nb') r=Math.min(V.R-2,Math.max(4,V.d+sgn()*rnd(9,14)));
    let z=Math.sqrt(Math.max(0,V.R*V.R-r*r)); const zc=z;
    if(trap==='Ou') z=Math.sqrt(Math.max(0,V.R*V.R-V.px*V.px));
    let xf=V.px; if(trap==='Lk') xf=V.px+sgn()*rnd(9,12);
    const E=[Pt('p1h',V.px,V.py,'1′',V.px<V.xq?-1:1),C('cir','a',cx,cy,r),L('par','a',-r,-zc,r,-zc),L('lk','lk',V.px,V.py,xf,-z),Pt('p1f',xf,-z,'1″',V.px<V.xq?-1:1)];
    const base=[L('','cl',0,-V.R-5,0,4),L('','cl',-V.R-5,V.Ys,V.R+5,V.Ys),L('','cl',0,V.Ys-V.R-5,0,V.Ys+V.R+5),L('','cl',V.xq,-V.Hq-5,V.xq,V.yq+V.rq+5),
      PL('','o',Array.from({length:49},(_,i)=>{ const a=Math.PI*i/48; return [-V.R*Math.cos(a),-V.R*Math.sin(a)]; }).concat([[-V.R,0]])),C('','o',0,V.Ys,V.R),
      PL('','o',[[V.xq-V.rq,0],[V.xq-V.rq,-V.Hq],[V.xq+V.rq,-V.Hq],[V.xq+V.rq,0]]),C('','o',V.xq,V.yq,V.rq),Pt('',0,V.Ys,'O′',-1,{c:'o',r:.8})];
    return {box:box(-V.R-14,-Math.max(V.R,V.Hq)-12,V.R+14,V.Ys+V.R+10),axis:0,base,E};
  },
  fair(V,k,ok,bad){ const a=ptOf(ok,'p1f'),b=ptOf(bad,'p1f'); return -a[1]>6&&far(a,b,6); },
  traps:{
    Lk:{b0:-1.5,say:'Линия связи ⟂ оси x',src:'Ж с. 22',hl:['lk','p1f']},
    Ou:{b0:.4,say:'Точка — на отрезке параллели, не на очерке',src:'Ж с. 109; М с. 24–25',hl:['lk','p1f']},
    Cq:{b0:.8,say:'Параллель сферы — с центром на её оси',src:'Ж с. 88, 115; М с. 18',hl:['cir','par','lk','p1f']},
    Nb:{b0:.9,say:'Параллель проходит через саму точку 1′',src:'Ж с. 109; М с. 25',hl:['cir','par','lk','p1f']}}
});

/* ── x5 · концентрические сферы (конус ⟂ π₁ и наклонный цилиндр, оси пересекаются в O) — на π₂ ── */
function x5geo(V){
  const O=[0,-V.zO], u=[V.ux,V.uy], n=[-V.uy,V.ux], cr=[[V.R,0],[0,-V.H]], cl=[[-V.R,0],[0,-V.H]];
  /* окружность (центр на оси конуса) ∩ очерк: точки на образующей между основанием и вершиной */
  const onOutline=(line,c,Rr)=>{ const ux=line[1][0]-line[0][0], uy=line[1][1]-line[0][1];
    return lineCirc(line[0][0],line[0][1],ux,uy,c[0],c[1],Rr).filter(t=>t>0.02&&t<0.98).map(t=>[line[0][0]+t*ux,line[0][1]+t*uy]).sort((a,b)=>a[1]-b[1]); };
  /* сечение конуса сферой: горизонтальные отрезки (верхний и нижний) */
  const coneChords=Rr=>onOutline(cr,O,Rr).map(p=>[-p[0],p[1],p[0],p[1]]);
  const cylChord=Rr=>{ if(Rr<=V.rq+2) return null; const d=Math.sqrt(Rr*Rr-V.rq*V.rq), M=[O[0]+u[0]*d,O[1]+u[1]*d]; return {M,seg:[M[0]+n[0]*V.rq,M[1]+n[1]*V.rq,M[0]-n[0]*V.rq,M[1]-n[1]*V.rq]}; };
  return {O,u,n,cr,cl,onOutline,coneChords,cylChord};
}
const inSeg=X=>X&&X[2]>=0&&X[2]<=1&&X[3]>=0&&X[3]<=1;
PREP.topic('x5',{
  make(){
    for(let t=0;t<300;t++){
      const R=rnd(46,56),H=rnd(100,120),zO=H*rnd(.28,.45),psi=rnd(22,42)*D,rq=rnd(11,16),Lq=rnd(70,85);
      const V={R,H,zO,psi,rq,Lq,ux:Math.cos(psi),uy:-Math.sin(psi)};
      V.Rs=rnd(rq+8,Math.min(60,zO+30)); if(this.scene(V,null)) return V;
    }
    return null;
  },
  watch:{steps:[
    {cap:'Оси пересекаются в O — центр всех сфер',roles:['O']},
    {cap:'Сфера с центром O соосна обеим поверхностям',roles:['O','sph']},
    {cap:'Сечение конуса — отрезок ⟂ его оси',roles:['O','sph','chC']},
    {cap:'Сечение цилиндра — отрезок ⟂ его оси',roles:['O','sph','chC','chQ']},
    {cap:'Отрезки одной сферы пересеклись — точка 1″',roles:['O','sph','chC','chQ','K']}]},
  scene(V,trap){
    const g=x5geo(V), O=g.O, u=g.u, n=g.n, Rs=V.Rs;
    const q=g.cylChord(Rs); if(!q) return null;
    const cc=g.coneChords(Rs); if(!cc.length) return null;
    /* верный выбор: отрезок конуса, который пересекает отрезок цилиндра */
    const idx=cc.findIndex(c=>inSeg(lineX(c,q.seg))); if(idx<0) return null;
    let chC=cc[idx], chQ=q.seg;
    if(trap==='Dr'){ const c2=g.coneChords(Rs+sgn()*rnd(3.5,5)); if(!c2[idx]) return null; chC=c2[idx]; }
    if(trap==='Xh'){ /* отрезок цилиндра ⟂ оси x (вертикальный) через ту же середину — до очерков цилиндра */
      const M=q.M, P1=[O[0]+n[0]*V.rq,O[1]+n[1]*V.rq], P2=[O[0]-n[0]*V.rq,O[1]-n[1]*V.rq];
      const a=lineX([M[0],M[1]-1,M[0],M[1]+1],[P1[0],P1[1],P1[0]+u[0],P1[1]+u[1]]), b=lineX([M[0],M[1]-1,M[0],M[1]+1],[P2[0],P2[1],P2[0]+u[0],P2[1]+u[1]]);
      if(!a||!b) return null; chQ=[a[0],a[1],b[0],b[1]]; }
    const X=lineX(chC,chQ); if(!inSeg(X)) return null;
    let K=[X[0],X[1]];
    if(trap==='Ko'){ const Y=lineX(chQ,[g.cr[0][0],g.cr[0][1],g.cr[1][0],g.cr[1][1]]); if(!Y||Y[2]<0||Y[2]>1) return null; K=[Y[0],Y[1]]; }
    const end=[O[0]+u[0]*V.Lq,O[1]+u[1]*V.Lq];
    const base=[PL('','o',[[-V.R,0],[0,-V.H],[V.R,0],[-V.R,0]]),L('','cl',0,-V.H-6,0,4),
      L('','cl',O[0]-u[0]*6,O[1]-u[1]*6,end[0]+u[0]*6,end[1]+u[1]*6),
      L('','o',O[0]+n[0]*V.rq,O[1]+n[1]*V.rq,end[0]+n[0]*V.rq,end[1]+n[1]*V.rq),L('','o',O[0]-n[0]*V.rq,O[1]-n[1]*V.rq,end[0]-n[0]*V.rq,end[1]-n[1]*V.rq),
      L('','o',end[0]+n[0]*V.rq,end[1]+n[1]*V.rq,end[0]-n[0]*V.rq,end[1]-n[1]*V.rq),Pt('',O[0],O[1],'O″',-1,{c:'o'})];
    const E=[C('sph','a',O[0],O[1],Rs),L('chC','c',...chC),L('chQ','b',...chQ),Pt('K',K[0],K[1],'1″',1)];
    const xs=[-V.R,V.R,end[0]+V.rq,O[0]-Rs,O[0]+Rs], ys=[-V.H,0,end[1]-V.rq,O[1]-Rs,O[1]+Rs];
    return {box:box(Math.min(...xs)-10,Math.min(...ys)-10,Math.max(...xs)+10,Math.max(...ys)+8),axis:0,base,E};
  },
  fair(V,k,ok,bad){ const a=ptOf(ok,'K'),b=ptOf(bad,'K'); if(!far(a,b,4.5)) return false;
    if(k==='Ko'){ /* точка на очерке не должна случайно оказаться верной: глубоко внутри отрезка цилиндра */
      const n=[-V.uy,V.ux], t=b[0]*n[0]+(b[1]+V.zO)*n[1]; return Math.abs(t)<V.rq-3; }
    return true; },
  traps:{
    Ko:{b0:.3,say:'Точка — на пересечении отрезков, не на очерке',src:'М с. 20',hl:['K']},
    Xh:{b0:.2,say:'Сечение цилиндра — отрезок ⟂ его оси, а не оси x',src:'Ж с. 121; М с. 20',hl:['chQ','K']},
    Dr:{b0:.8,say:'Оба отрезка — от одной и той же сферы',src:'Ж с. 121; М с. 20',hl:['chC','K']}}
});

/* ── x9 · касательная плоскость и нормаль (сфера) ── */
PREP.topic('x9',{
  make(){ const R=rnd(32,40),Zc=R+rnd(8,14),Yc=R+rnd(18,24),a=rnd(25,65)*D*sgn(),b=rnd(20,55)*D;
    return {R,Zc,Yc,x:R*Math.cos(b)*Math.sin(a),y:R*Math.cos(b)*Math.cos(a),z:R*Math.sin(b)}; },
  watch:{steps:[
    {cap:'Нормаль к сфере идёт через центр: n′ через O′, n″ через O″',roles:['n1','n2']},
    {cap:'Горизонталь плоскости: h″ ∥ x, h′ ⟂ n′',roles:['n1','n2','h2','h1']},
    {cap:'Фронталь плоскости: f′ ∥ x, f″ ⟂ n″',roles:['n1','n2','h2','h1','f1','f2']}]},
  scene(V,trap){
    const O2=[0,-V.Zc], O1=[0,V.Yc], A2=[V.x,-(V.Zc+V.z)], A1=[V.x,V.Yc+V.y];
    const ext=(P,Q,a,b)=>{ const dx=Q[0]-P[0],dy=Q[1]-P[1],l=Math.hypot(dx,dy); return [P[0]-dx/l*a,P[1]-dy/l*a,Q[0]+dx/l*b,Q[1]+dy/l*b]; };
    let n1=ext(O1,A1,4,16), n2=ext(O2,A2,4,16);
    if(trap==='Nc'){ const ang=sgn()*rnd(14,20)*D, dx=A1[0]-O1[0], dy=A1[1]-O1[1], c=Math.cos(ang), s=Math.sin(ang); const Q=[A1[0]-(dx*c-dy*s),A1[1]-(dx*s+dy*c)]; n1=ext(Q,A1,4,16); }
    if(trap==='Nh') n2=[A2[0],A2[1]+V.R*.9,A2[0],A2[1]-16];
    const perp=(P,dir,len)=>{ const l=Math.hypot(dir[0],dir[1]), px=-dir[1]/l, py=dir[0]/l; return [P[0]-px*len,P[1]-py*len,P[0]+px*len,P[1]+py*len]; };
    const h2=[A2[0]-22,A2[1],A2[0]+22,A2[1]];
    const h1=trap==='Hb'?[A1[0]-22,A1[1],A1[0]+22,A1[1]]:perp(A1,[A1[0]-O1[0],A1[1]-O1[1]],22);
    const f1=[A1[0]-22,A1[1],A1[0]+22,A1[1]];
    const f2=trap==='Ff'?[A2[0]-22,A2[1],A2[0]+22,A2[1]]:perp(A2,[A2[0]-O2[0],A2[1]-O2[1]],22);
    if(trap==='Ff'&&Math.abs(A2[1]-O2[1])<4) return null;
    const E=[L('n2','d',...n2),L('n1','d',...n1),L('h2','a',...h2),L('h1','a',...h1),L('f1','c',...f1),L('f2','c',...f2),
      Tx('n2',n2[2]+1.5,n2[3],'n″'),Tx('n1',n1[2]+1.5,n1[3]+4,'n′'),Tx('h2',h2[2]+1,h2[3]-1.5,'h″'),Tx('h1',h1[2]+1,h1[3]+4,'h′'),Tx('f2',f2[2]+1,f2[3]-1.5,'f″'),Tx('f1',f1[0]-1,f1[1]+5,'f′','end')];
    const base=[C('','o',O2[0],O2[1],V.R),C('','o',O1[0],O1[1],V.R),L('','cl',-V.R-5,O2[1],V.R+5,O2[1]),L('','cl',0,O2[1]-V.R-5,0,4),L('','cl',-V.R-5,O1[1],V.R+5,O1[1]),L('','cl',0,-4,0,O1[1]+V.R+5),
      Pt('',O2[0],O2[1],'O″',-1,{c:'o',r:.9}),Pt('',O1[0],O1[1],'O′',-1,{c:'o',r:.9}),Pt('',A2[0],A2[1],'A″',A2[0]<0?-1:1,{c:'ans'}),Pt('',A1[0],A1[1],'A′',A1[0]<0?-1:1,{c:'ans'})];
    return {box:box(-V.R-30,-V.Zc-V.R-22,V.R+32,V.Yc+V.R+22),axis:0,base,E};
  },
  fair(V,k){ return Math.abs(V.x)>6; },
  traps:{
    Ff:{b0:-.3,say:'Фронталь: f′ ∥ x, f″ — наклонная',src:'Ж §17',hl:['f2']},
    Nc:{b0:.2,say:'Нормаль к сфере проходит через центр',src:'Ж с. 138; М с. 32',hl:['n1']},
    Hb:{b0:.3,say:'h′ ⟂ n′: прямой угол виден на π₁',src:'Ж с. 50, 137; М с. 32',hl:['h1']},
    Nh:{b0:.6,say:'n″ ⟂ f″, а не ⟂ h″',src:'Ж с. 50, 137; М с. 32',hl:['n2']}}
});
})();
