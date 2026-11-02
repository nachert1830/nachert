/* ═══════════ 3D по эпюру: тело в «углу Монжа» (canvas 2D, без библиотек) ═══════════
   Соглашения сайта: x — влево, y — к зрителю, z — вверх. П₂ — фронтальная плоскость y = 0, П₁ — горизонтальная z = 0,
   ось x — их пересечение, O — начало. Проекция ортогональная (как в начерталке).
   VIEW3D.create(canvas, o) → {set(scene), opt(k, v), view(name), unfold(t), redraw(), png()}
     scene = {pts:{A:{P:[x,y,z]}}, edges:[{a,b,both}], faces:[[A,B,C]], ref?:{pts, edges}}
     o.unfold — 0…1: П₁ поворачивается вокруг оси x вниз и ложится в П₂ — так из пространства получается эпюр.
   Видимость ребра — лучом к зрителю: закрыто гранью тела — штрихом (как на чертеже). */
(function(){
'use strict';
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],
  dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const VIEWS={iso:[35,24],front:[0,0],top:[0,90],side:[-90,0]};
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

function create(cv,o){ o=Object.assign({planes:true,proj:true,rays:true,ref:false,labels:true,unfold:0},o||{});
  let S={pts:{},edges:[],faces:[]}, az=VIEWS.iso[0], el=VIEWS.iso[1], zoom=1, raf=0, anim=null;
  const g=cv.getContext('2d');
  const css=(k,d)=>{ const v=getComputedStyle(cv).getPropertyValue(k).trim(); return v||d; };
  function cam(){ const a=az*Math.PI/180, e=el*Math.PI/180, c=[-Math.sin(a)*Math.cos(e),Math.cos(a)*Math.cos(e),Math.sin(e)], r=[-Math.cos(a),-Math.sin(a),0], u=cross(c,r); return {c,r,u}; }
  /* рамка сцены: тело, эталон и плоскости (П₁ — с учётом разворота), чтобы при развороте эпюр не уходил за край */
  function box(){ const P=Object.values(S.pts).map(p=>p.P).concat(o.ref&&S.ref?Object.values(S.ref.pts):[]); if(!P.length) P.push([40,30,30]);
    const lo=[0,1,2].map(k=>Math.min(0,...P.map(p=>p[k]))), hi=[0,1,2].map(k=>Math.max(0,...P.map(p=>p[k])));
    const pad=Math.max(10,0.15*Math.max(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]));
    return {lo:[lo[0]-pad,lo[1]<-1?lo[1]-pad:0,lo[2]<-1?lo[2]-pad:0],hi:[hi[0]+pad,hi[1]+pad,hi[2]+pad]}; }   /* под осью — только если тело правда там (не шум оцифровки) */
  function frame(B){ const pts=[], [x0,y0,z0]=B.lo, [x1,y1,z1]=B.hi;
    [x0,x1].forEach(x=>{ [Math.min(0,z0),z1].forEach(z=>pts.push([x,0,z])); [Math.min(0,y0),y1].forEach(y=>pts.push(onP1(x,y))); });
    Object.values(S.pts).forEach(p=>pts.push(p.P)); const lo=[0,1,2].map(k=>Math.min(...pts.map(p=>p[k]))), hi=[0,1,2].map(k=>Math.max(...pts.map(p=>p[k])));
    return {ctr:mul(add(lo,hi),0.5),ext:Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])*0.98}; }   /* диагональ: сцена влезает при любом повороте */
  /* точка на П₁ при развороте: (x, y, 0) → (x, y cos θ, −y sin θ) */
  const onP1=(x,y)=>{ const t=o.unfold*Math.PI/2; return [x,y*Math.cos(t),-y*Math.sin(t)]; };
  function size(){ const r=cv.getBoundingClientRect(), d=Math.min(2,self.devicePixelRatio||1), w=Math.max(1,Math.round(r.width*d)), h=Math.max(1,Math.round(r.height*d)); if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; } return {w,h,d}; }

  function draw(){ raf=0; const {w,h,d}=size(), C=cam(), B=box(), Fr=frame(B), ctr=Fr.ctr, ext=Fr.ext, top=o.top||0;
    const s=zoom*Math.min(w,h-top*d)/ext, X=P=>{ const q=sub(P,ctr); return [w/2+s*dot(q,C.r),(h+top*d)/2-s*dot(q,C.u),dot(q,C.c)]; };
    const col={bg:css('--v3-bg','#0b1530'),ink:css('--v3-ink','#e8eef8'),mut:css('--v3-mut','#8aa0c0'),p1:css('--v3-p1','rgba(95,209,145,.10)'),p2:css('--v3-p2','rgba(127,176,255,.10)'),pl:css('--v3-pl','rgba(160,190,230,.35)'),
      edge:css('--v3-edge','#ffffff'),face:css('--v3-face','rgba(37,99,235,.28)'),prj:css('--v3-prj','#7fb0ff'),prh:css('--v3-prh','#5fd191'),ray:css('--v3-ray','rgba(200,215,240,.45)'),ref:css('--v3-ref','#ff6b6b')};
    g.setTransform(1,0,0,1,0,0); g.fillStyle=col.bg; g.fillRect(0,0,w,h); g.lineCap='round'; g.lineJoin='round';
    const line=(a,b,c,lw,dash)=>{ const A=X(a), Bq=X(b); g.strokeStyle=c; g.lineWidth=lw*d; g.setLineDash(dash?dash.map(v=>v*d):[]); g.beginPath(); g.moveTo(A[0],A[1]); g.lineTo(Bq[0],Bq[1]); g.stroke(); g.setLineDash([]); };
    const poly=(ps,fill,stroke)=>{ g.beginPath(); ps.forEach((p,i)=>{ const q=X(p); i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]); }); g.closePath(); if(fill){ g.fillStyle=fill; g.fill(); } if(stroke){ g.strokeStyle=stroke; g.lineWidth=1*d; g.stroke(); } };
    const label=(P,t,c,sz,dx,dy)=>{ const q=X(P); g.font=(sz>=13?'600 ':'500 ')+Math.round(sz*d)+'px Golos Text,system-ui,sans-serif'; g.fillStyle=c; g.fillText(t,q[0]+(dx||6)*d,q[1]+(dy||-6)*d); };
    const dotAt=(P,c,r,hollow)=>{ const q=X(P); g.beginPath(); g.arc(q[0],q[1],r*d,0,7); if(hollow){ g.strokeStyle=c; g.lineWidth=1.5*d; g.stroke(); } else { g.fillStyle=c; g.fill(); } };
    const names=Object.keys(S.pts), P3=n=>S.pts[n].P;
    /* плоскости проекций */
    if(o.planes){ const [x0,y0,z0]=B.lo, [x1,y1,z1]=B.hi;
      const p2=[[x0,0,Math.min(0,z0)],[x1,0,Math.min(0,z0)],[x1,0,z1],[x0,0,z1]], p1=[onP1(x0,Math.min(0,y0)),onP1(x1,Math.min(0,y0)),onP1(x1,y1),onP1(x0,y1)];
      const back=[[p2,col.p2,'П₂',[x0,0,z1]],[p1,col.p1,'П₁',onP1(x0,y1)]].sort((a,b)=>X(a[0][2])[2]-X(b[0][2])[2]);
      back.forEach(([q,f,t,at])=>{ poly(q,f,col.pl); label(at,t,col.mut,13,6,16); });
      line([x0,0,0],[x1,0,0],col.mut,1.2); label([x0,0,0],'x',col.mut,14,-14,-6); dotAt([0,0,0],col.mut,2.5); label([0,0,0],'O',col.mut,13,-16,16); }
    /* проекции тела на плоскости и линии связи */
    if(o.proj){ const F=P=>[P[0],0,P[2]], H=P=>onP1(P[0],P[1]);
      S.edges.forEach(e=>{ if(!S.pts[e.a]||!S.pts[e.b]) return; line(F(P3(e.a)),F(P3(e.b)),col.prj,1.4); line(H(P3(e.a)),H(P3(e.b)),col.prh,1.4); });
      names.forEach(n=>{ const P=P3(n); dotAt(F(P),col.prj,2.2); dotAt(H(P),col.prh,2.2); if(o.labels){ label(F(P),n+'″',col.prj,11); label(H(P),n+'′',col.prh,11); }
        if(o.rays){ line(P,F(P),col.ray,0.8,[3,3]); line(P,H(P),col.ray,0.8,[3,3]); line(F(P),[P[0],0,0],col.ray,0.8,[1,3]); line(H(P),[P[0],0,0],col.ray,0.8,[1,3]); } }); }
    /* эталон по условию варианта */
    if(o.ref&&S.ref){ const R=S.ref.pts; S.ref.edges.forEach(([a,b])=>{ if(R[a]&&R[b]) line(R[a],R[b],col.ref,1.3,[6,4]); }); Object.entries(R).forEach(([n,P])=>{ dotAt(P,col.ref,4,true); }); }
    /* грани — от дальних к ближним */
    const faces=S.faces.filter(f=>f.every(n=>S.pts[n])).map(f=>({f,P:f.map(P3)})).map(q=>Object.assign(q,{z:q.P.reduce((a,p)=>a+X(p)[2],0)/q.P.length})).sort((a,b)=>a.z-b.z);
    g.globalAlpha=1-0.7*o.unfold;   /* в эпюре тело отступает: остаются проекции на плоскостях */
    faces.forEach(q=>poly(q.P,col.face,null));
    /* рёбра: видимость лучом к зрителю (вдоль c) — закрыто гранью, не содержащей ребро, → штрих */
    const hidden=(P,skip)=>faces.some(q=>{ if(skip(q.f)) return false; const A=q.P[0], n=cross(sub(q.P[1],A),sub(q.P[2],A)), den=dot(n,C.c); if(Math.abs(den)<1e-9) return false;
      const t=dot(n,sub(A,P))/den; if(t<=1e-3) return false; const Q=add(P,mul(C.c,t));
      for(let i=1;i+1<q.P.length;i++){ if(inTri(Q,A,q.P[i],q.P[i+1],n)) return true; } return false; });
    S.edges.forEach(e=>{ if(!S.pts[e.a]||!S.pts[e.b]) return; const a=P3(e.a), b=P3(e.b), skip=f=>f.includes(e.a)&&f.includes(e.b);
      const hid=[0.25,0.5,0.75].filter(t=>hidden(add(a,mul(sub(b,a),t)),skip)).length>=2;
      line(a,b,col.edge,e.both?2.6:1.4,hid?[7,5]:e.both?null:[2,4]); });
    names.forEach(n=>{ const P=P3(n); dotAt(P,col.edge,3.4); if(o.labels&&o.unfold<0.5) label(P,n,col.ink,15,7,-8); }); g.globalAlpha=1;
    if(!names.length){ g.fillStyle=col.mut; g.font=Math.round(15*d)+'px Golos Text,system-ui,sans-serif'; g.textAlign='center'; g.fillText('Нет точек с обеими проекциями',w/2,h/2); g.textAlign='left'; } }
  function inTri(Q,A,B,C,n){ const s=(p,q,r)=>dot(cross(sub(q,p),sub(r,p)),n); const a=s(A,B,Q), b=s(B,C,Q), c=s(C,A,Q), e=-1e-6*dot(n,n); return (a>=e&&b>=e&&c>=e)||(a<=-e&&b<=-e&&c<=-e); }
  const redraw=()=>{ if(!raf) raf=requestAnimationFrame(draw); };

  /* жесты: один палец — вращать, два — масштаб; колесо — масштаб; двойное касание — исходный вид */
  const ptr=new Map(); let pinch=0, lastTap=0;
  cv.style.touchAction='none';
  cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId,[e.clientX,e.clientY]); anim=null;
    if(ptr.size===2){ const [p,q]=[...ptr.values()]; pinch=Math.hypot(p[0]-q[0],p[1]-q[1]); }
    const t=Date.now(); if(ptr.size===1&&t-lastTap<300) view('iso'); lastTap=t; });
  cv.addEventListener('pointermove',e=>{ if(!ptr.has(e.pointerId)) return; const was=ptr.get(e.pointerId); ptr.set(e.pointerId,[e.clientX,e.clientY]);
    if(ptr.size===1){ az-=(e.clientX-was[0])*0.45; el=Math.max(-89,Math.min(90,el+(e.clientY-was[1])*0.45)); redraw(); }
    else if(ptr.size===2){ const [p,q]=[...ptr.values()], dd=Math.hypot(p[0]-q[0],p[1]-q[1]); if(pinch>0){ zoom=Math.max(0.4,Math.min(6,zoom*dd/pinch)); redraw(); } pinch=dd; } });
  const up=e=>{ ptr.delete(e.pointerId); if(ptr.size<2) pinch=0; };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{ e.preventDefault(); zoom=Math.max(0.4,Math.min(6,zoom*Math.exp(-e.deltaY*0.0015))); redraw(); },{passive:false});
  if(self.ResizeObserver) new ResizeObserver(redraw).observe(cv);

  /* плавный переход вида и разворота */
  function tween(to,ms){ const from={az,el,zoom,u:o.unfold}, t0=performance.now(); let da=((to.az-az)%360+540)%360-180; anim={};
    const me=anim; const step=t=>{ if(anim!==me) return; const k=ease(Math.min(1,(t-t0)/(ms||600)));
      az=from.az+da*k; if(to.el!=null) el=from.el+(to.el-from.el)*k; if(to.zoom!=null) zoom=from.zoom+(to.zoom-from.zoom)*k; if(to.u!=null) o.unfold=from.u+(to.u-from.u)*k; draw();
      if(k<1) requestAnimationFrame(step); else anim=null; };
    requestAnimationFrame(step); }
  function view(name){ const v=VIEWS[name]||VIEWS.iso; tween({az:v[0],el:v[1],zoom:1}); }
  function unfold(u,withView){ tween(Object.assign({u,az:withView?0:az,el:withView?0:el},{})); }

  return {set(sc){ S=Object.assign({pts:{},edges:[],faces:[]},sc); redraw(); },opt(k,v){ o[k]=v; redraw(); },get(k){ return o[k]; },view,unfold,redraw,
    png(){ draw(); return cv.toDataURL('image/png'); },state(){ return {az,el,zoom,unfold:o.unfold}; }}; }

self.VIEW3D={create,VIEWS};
})();
