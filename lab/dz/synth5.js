/* ═══════════ Синтетические фото листов ДЗ №5 (прямая и поверхность, касательная плоскость и нормаль) ═══════════
   Лист рисуется по эталону варианта (lk/scan/verify5.js): А3 книжный, рамка и штамп рукой, ось x, ось поверхности штрихпунктиром,
   очерк поверхности, A″B″ и A′B′, линии связи, построение посредником (образующие через точки — у конуса и цилиндра, линия сечения
   на π₁ — у поверхности вращения), точки пересечения со СВОИМИ подписями студента (K и L, K₁ и K₂, M и N), касательная плоскость
   и нормаль в ОДНОЙ (любой) из точек: нормаль, фронталь f″ ⟂ n″ и горизонталь h′ ⟂ n′, h″ и f′ ∥ x.
   err — ошибочный лист: {kind:'k_shift', mm} — одна точка пересечения сдвинута вдоль AB (построения ведут к ней);
                         {kind:'n_rot', deg, v:'F'|'H'} — нормаль и f″ (или h′) повёрнуты на одной проекции.
   dz5Synth({n, seed, level, err, res, size}) → {img, truth:{n, H (стр. мм → px), O, drawn:{segs:[[u1,v1,u2,v2]], circles:[{c,r}], curves:[[[u,v]…]], pts}, err, at}}
   mockAnswer(truth, map, R, {ppm}) → текст ответа «модели» (P/S/C/R/L) по начерченному, с погрешностью модели. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const IMG=isNode?require('../img.js'):self.LAB.img, S=isNode?require('../synth.js'):self.LAB.synth, font=isNode?require('../font.js'):self.LAB.font;
const DS=isNode?require('./sheet.js'):self.LAB.dzsheet, B4=isNode?require('../../lk/scan/bind4.js'):self.SCANBIND4, V5=isNode?require('../../lk/scan/verify5.js'):self.SCANVERIFY5;
const {rng}=IMG, LAB=[['K','L'],['K₁','K₂'],['M','N']];

function dz5Synth(o){ o=o||{}; const n=o.n||1, R5=V5.ref(n), R=rng(o.seed||1), lv=S.LEVELS[o.level||'normal'], page=DS.A3, sheet=new S.Sheet(page.w,page.h,o.res||6);
  const g0=IMG.gray(sheet.w,sheet.h); for(let i=0;i<g0.a.length;i++) g0.a[i]=R(); const g1=IMG.blur(g0,0.8); sheet.grain=new Float32Array(sheet.w*sheet.h);
  for(let i=0;i<g1.a.length;i++) sheet.grain[i]=Math.max(0.35,Math.min(1,0.7+(g1.a[i]-0.5)*3.2));
  sheet.layer='pencil'; const pen={dk:R.r(...lv.dark),thin:R.r(0.22,0.34),main:R.r(0.45,0.65)}, k=R.r(...lv.hand);
  const stroke=(P,w,dk,dash)=>sheet.stroke(P,w,Math.min(0.95,dk),{wob:R.r(0.02,0.05),grain:true,press:true,dash},R);
  const F=DS.FRAME, fc=[[F[0],F[1]],[F[2],F[1]],[F[2],F[3]],[F[0],F[3]]].map(p=>[p[0]+R.n(0,0.5*k),p[1]+R.n(0,0.5*k)]);
  for(let i=0;i<4;i++) stroke([fc[i],fc[(i+1)%4]],pen.main,pen.dk*1.1); DS.titleLines().forEach(([a,b])=>stroke([a,b],pen.thin,pen.dk*0.9));
  let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9; R5.outlines.forEach(q=>q.p.forEach(p=>{ u0=Math.min(u0,p[0]); u1=Math.max(u1,p[0]); v0=Math.min(v0,p[1]); v1=Math.max(v1,p[1]); }));
  const FL=DS.FIELD, oxLo=FL[0]+22-u0, oxHi=FL[2]-16, oyLo=FL[1]+14-v0, oyHi=FL[3]-8-v1, O=[R.r(Math.min(oxLo,oxHi),Math.max(oxLo,oxHi)),R.r(Math.min(oyLo,oyHi),Math.max(oyLo,oyHi))];
  const pg=p=>[O[0]+p[0],O[1]+p[1]], drawn={segs:[],circles:[],curves:[],pts:[],txt:[]}, labels=[];
  const hand=P=>{ const d=[R.n(0,0.1*k),R.n(0,0.1*k)]; return P.map(p=>[p[0]+d[0],p[1]+d[1]]); };
  const seg=(a,b,w,dk,dash)=>{ const P=hand([a,b]); stroke(P.map(pg),w,dk,dash); drawn.segs.push(P[0].concat(P[1])); };
  const lab=(s,p,dx,dy)=>labels.push({s,at:pg([p[0]+(dx==null?R.r(1,2):dx),p[1]+(dy==null?R.r(-2.5,-1):dy)])});
  const pt=(l,p)=>{ const q=[p[0]+R.n(0,0.12*k),p[1]+R.n(0,0.12*k)]; if(R()<0.8) sheet.circle(pg(q),R.r(0.5,0.8),pen.thin,pen.dk,{grain:true},R); drawn.pts.push([l,q[0],q[1]]); lab(l,q); };
  /* ось x и оси поверхности */
  R5.axes.forEach((a,i)=>{ if(i===R5.axes.length-1){ seg(a.p[0],a.p[1],pen.thin,pen.dk*0.9); lab('X',[a.p[0][0]-3,-1.5],0,0); } else stroke(a.p.map(pg),pen.thin*0.8,pen.dk*0.7,[R.r(6,9),R.r(1.5,2.5),R()*5]); });
  /* очерк поверхности */
  R5.outlines.filter(q=>!q.ab).forEach(q=>{ const c=B4.classify(q.p,0.2), P=hand(q.p); stroke(P.map(pg),pen.main,pen.dk*1.15);
    if(c&&c.t==='S') drawn.segs.push(P[0].concat(P[P.length-1])); else if(c&&c.t==='C') drawn.circles.push({c:[c.c[0]+P[0][0]-q.p[0][0],c.c[1]+P[0][1]-q.p[0][1]],r:c.r,full:c.full,a1:c.a1,a2:c.a2,P}); else drawn.curves.push(P); });
  /* AB, подписи A, B, линии связи */
  ['F','H'].forEach(v=>{ seg(R5.ab[v][0],R5.ab[v][1],pen.main,pen.dk*1.15); ['A','B'].forEach((l,i)=>pt(l+(v==='F'?'″':'′'),R5.ab[v][i])); });
  ['A','B'].forEach((l,i)=>seg(R5.ab.F[i],R5.ab.H[i],pen.thin*0.8,pen.dk*0.7));
  /* точки пересечения (одна может быть сдвинута ошибкой) */
  const err=o.err||null, P=R5.P.map(q=>({F:q.F.slice(),H:q.H.slice()})), names=LAB[Math.floor(R()*LAB.length)];
  const ki=Math.floor(R()*P.length), sh=err&&err.kind==='k_shift'?(R()<0.5?-1:1)*(err.mm||5):0;
  if(sh){ const tF=(R5.ab.F[1][1]-R5.ab.F[0][1])/(R5.ab.F[1][0]-R5.ab.F[0][0]), tH=(R5.ab.H[1][1]-R5.ab.H[0][1])/(R5.ab.H[1][0]-R5.ab.H[0][0]); P[ki].F=[P[ki].F[0]+sh,P[ki].F[1]+sh*tF]; P[ki].H=[P[ki].H[0]+sh,P[ki].H[1]+sh*tH]; }
  /* посредник: образующие через точки (конус — через вершину, цилиндр — ∥ оси), у поверхности вращения — линия сечения на π₁ */
  const kind=R5.kind, ext=(a,b,L)=>{ const d=[b[0]-a[0],b[1]-a[1]], l=Math.hypot(...d); return [b[0]+d[0]/l*L,b[1]+d[1]/l*L]; };
  P.forEach(q=>{ seg(q.F,q.H,pen.thin*0.8,pen.dk*0.7);
    if(kind==='cone'){ const SF=V5.F([90,60,130]), SH=V5.H([90,60,130]); seg(SF,ext(SF,q.F,R.r(5,25)),pen.thin*0.9,pen.dk*0.8); seg(SH,ext(SH,q.H,R.r(5,25)),pen.thin*0.9,pen.dk*0.8); }
    else if(kind==='cyl'){ const dF=[V5.F([45,40,100])[0]-V5.F([100,90,0])[0],V5.F([45,40,100])[1]-V5.F([100,90,0])[1]], dH=[V5.H([45,40,100])[0]-V5.H([100,90,0])[0],V5.H([45,40,100])[1]-V5.H([100,90,0])[1]];
      [['F',dF],['H',dH]].forEach(([v,d])=>{ const l=Math.hypot(...d), a=R.r(15,35), b=R.r(15,35); seg([q[v][0]-d[0]/l*a,q[v][1]-d[1]/l*a],[q[v][0]+d[0]/l*b,q[v][1]+d[1]/l*b],pen.thin*0.9,pen.dk*0.8); }); } });
  if(kind==='ogive'&&P.length>1){ /* линия сечения на π₁ — дуга через обе точки (лекалом) */
    const a=P[0].H, b=P[1].H, m=[(a[0]+b[0])/2,(a[1]+b[1])/2], d=[b[0]-a[0],b[1]-a[1]], L=Math.hypot(...d), bow=R.r(0.15,0.3)*L*(R()<0.5?-1:1), c=[m[0]-d[1]/L*bow,m[1]+d[0]/L*bow];
    const C=Array.from({length:21},(_,i)=>{ const t=-0.15+1.3*i/20; return [(1-t)*(1-t)*a[0]+2*(1-t)*t*(2*c[0]-m[0])+t*t*b[0],(1-t)*(1-t)*a[1]+2*(1-t)*t*(2*c[1]-m[1])+t*t*b[1]]; }), Ph=hand(C); stroke(Ph.map(pg),pen.thin*0.9,pen.dk*0.8); drawn.curves.push(Ph); }
  P.forEach((q,i)=>{ pt(names[i]+'″',q.F); pt(names[i]+'′',q.H); });
  /* касательная плоскость и нормаль в одной из точек (не в сдвинутой, если ошибка — нормаль) */
  const ti=err&&err.kind==='k_shift'?ki:Math.floor(R()*P.length), N=R5.N[ti], rot=err&&err.kind==='n_rot'?(R()<0.5?-1:1)*(err.deg||7)*Math.PI/180:0, rv=err&&err.kind==='n_rot'?(err.v||(R5.kind==='cyl'&&R()<0.5?'H':'F')):null;   /* у конуса и поверхности вращения n′ радиальна — ошибаются на π₂ */
  [['F',[-N[0],-N[2]]],['H',[-N[0],N[1]]]].forEach(([v,nv])=>{ const c=P[ti][v]; if(Math.hypot(...nv)<0.15) return; let a=Math.atan2(nv[1],nv[0])+(rv===v?rot:0);
    const nL=R.r(25,40), tL=R.r(20,35); seg([c[0]-nL*0.2*Math.cos(a),c[1]-nL*0.2*Math.sin(a)],[c[0]+nL*Math.cos(a),c[1]+nL*Math.sin(a)],pen.main*0.8,pen.dk);
    const b=a+Math.PI/2; seg([c[0]-tL*Math.cos(b),c[1]-tL*Math.sin(b)],[c[0]+tL*Math.cos(b),c[1]+tL*Math.sin(b)],pen.thin,pen.dk*0.85);
    seg([c[0]-R.r(15,25),c[1]],[c[0]+R.r(15,25),c[1]],pen.thin,pen.dk*0.85);   /* h″ или f′ ∥ x */
    const ne=[c[0]+nL*Math.cos(a)+1.5,c[1]+nL*Math.sin(a)-1.8]; lab(v==='F'?'n″':'n′',ne,0,0); drawn.txt.push([v==='F'?'n″':'n′',ne[0],ne[1]]); });
  labels.forEach(l=>{ const s=String(l.s).split('').filter(c=>font.has(c)).join(''); if(s) sheet.text(s,l.at,R.r(3,4.2),Math.min(0.95,pen.dk*1.1),R.r(0.22,0.33),{rot:R.n(0,0.06),shear:R.n(0.12,0.08),jit:0.02,grain:true},R); });
  const sz=o.size||[2250,3000], cam=S.camera(sheet,page,R,lv,sz);
  return {img:cam.im,truth:{n,H:cam.M,O,drawn,err,ki,ti,rv,names,params:Object.assign(cam.params,{hand:k})}}; }

/* ответ «модели» по начерченному: map — мм чертежа → px кадра модели, ppm — px кадра на мм */
function mockAnswer(truth,map,R,o){ o=o||{}; const ppm=o.ppm, f=v=>String(Math.round(v)), J=s=>[R.n(0,s*ppm),R.n(0,s*ppm)], out=[], dr=truth.drawn;
  const P=p=>{ const q=map(p), j=J(0.4); return [q[0]+j[0],q[1]+j[1]]; };
  dr.pts.forEach(([l,u,v])=>{ if(o.dropPts&&R()<o.dropPts) return; const q=P([u,v]); out.push('P '+l+' '+f(q[0])+' '+f(q[1])); });
  (dr.txt||[]).forEach(([t,u,v])=>{ const q=P([u,v]); out.push('T '+f(q[0])+' '+f(q[1])+' '+t); });
  dr.segs.forEach(s=>{ if(o.dropSegs&&R()<o.dropSegs) return; const A=P([s[0],s[1]]), B=P([s[2],s[3]]); out.push('S '+[A[0],A[1],B[0],B[1]].map(f).join(' ')); });
  dr.circles.forEach(c=>{ const px=c.P.map(map); let q=B4.classify(px,0.6*ppm); if(!q||q.t!=='C'){ if(!c.full) return; const m=px.slice(1).reduce((a,p)=>[a[0]+p[0]/(px.length-1),a[1]+p[1]/(px.length-1)],[0,0]); q={t:'C',c:m,r:px.slice(1).reduce((a,p)=>a+Math.hypot(p[0]-m[0],p[1]-m[1]),0)/(px.length-1),full:true}; }   /* перспектива снимка чуть вытягивает окружность — модель всё равно пишет её окружностью */ const j=J(0.4), r=q.r+R.n(0,0.4*ppm); out.push((q.full?'C ':'R ')+f(q.c[0]+j[0])+' '+f(q.c[1]+j[1])+' '+f(r)+(q.full?'':' '+f(q.a1)+' '+f(q.a2))); });
  dr.curves.forEach(Pm=>{ const L=B4.plen(Pm); if(L<3) return; const m=Math.max(5,Math.min(14,Math.round(L/12)+5)), D=B4.dense(Pm,0.5), pts=[];
    for(let i=0;i<m;i++){ const q=map(D[Math.round(i*(D.length-1)/(m-1))]), j=J(0.8); pts.push([q[0]+j[0],q[1]+j[1]]); } out.push('L '+pts.map(q=>f(q[0])+' '+f(q[1])).join(' ')); });
  return out.join('\n'); }

const api={dz5Synth,mockAnswer};
if(isNode) module.exports=api; else { self.LAB=self.LAB||{}; self.LAB.dz5Synth=api; }
if(isNode&&require.main===module){ const a=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
  const t0=Date.now(), r=dz5Synth({n:+(a.n||1),seed:+(a.seed||1),err:a.err==='k_shift'?{kind:'k_shift',mm:5}:a.err==='n_rot'?{kind:'n_rot',deg:7}:null});
  require('fs').writeFileSync(a.out||'dz5.png',IMG.encodePNG(r.img)); console.log('ДЗ №5 в.'+r.truth.n+', отрезков '+r.truth.drawn.segs.length+', точек '+r.truth.drawn.pts.length+', '+(Date.now()-t0)+' мс'); }
})();
