/* ═══════════ Выпрямление: фото → лист в мм ═══════════
   1. Страница: самая большая светлая область (порог Оцу по уменьшенному V), её четырёхугольник — вершины
      выпуклой оболочки с наибольшей площадью. Угол поворота телефона любой: стороны сопоставляются с листом
      по длине (длинная — высота страницы), верх/низ — по рамке и «дано» (шаг 3 пробует оба).
   2. Рамка: напечатанный прямоугольник рядом с ожидаемым местом — по каждой стороне ищется тёмная линия
      поперёк, точки — МНК-прямые, их пересечения — углы рамки. Гомография по углам рамки (лист → фото).
   3. «Дано»: напечатанные ось x, a″, a′, кружки A″, A′ и линия связи. Сначала сдвиг ±25 мм (раскладка тетради
      может отличаться от модели в lab/sheets.js), затем уточнение всех 8 параметров гомографии: точки шаблона
      «дано» притягиваются к ближайшей печатной линии (карта расстояний, усечённая на 1,2 мм), Гаусс — Ньютон.
   Отказ — если страница не найдена, лист снят слишком мелко (< 3 px/мм) или «дано» совпало плохо. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('./'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const IMG=lab('img'), {gray,H,sample}=IMG, CL=lab('clean'), {SHEETS,toPage}=lab('sheets');
const v2={sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],add:(a,b)=>[a[0]+b[0],a[1]+b[1]],mul:(a,k)=>[a[0]*k,a[1]*k],dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),
  cross:(a,b)=>a[0]*b[1]-a[1]*b[0],dot:(a,b)=>a[0]*b[0]+a[1]*b[1],unit:a=>{ const l=Math.hypot(a[0],a[1])||1; return [a[0]/l,a[1]/l]; }};

/* ── 1. страница ── */
function otsu(g){ const h=new Array(256).fill(0); g.a.forEach(v=>h[Math.max(0,Math.min(255,Math.round(v*255)))]++);
  const N=g.a.length; let sum=0; for(let i=0;i<256;i++) sum+=i*h[i]; let sB=0,wB=0,best=0,th=128;
  for(let i=0;i<256;i++){ wB+=h[i]; if(!wB) continue; const wF=N-wB; if(!wF) break; sB+=i*h[i]; const mB=sB/wB, mF=(sum-sB)/wF, v=wB*wF*(mB-mF)**2; if(v>best){ best=v; th=i; } }
  return th/255; }
function hull(P){ P=P.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]); const lo=[],up=[];
  for(const p of P){ while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0) lo.pop(); lo.push(p); }
  for(let i=P.length-1;i>=0;i--){ const p=P[i]; while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up); }
function area(q){ let s=0; for(let i=0;i<q.length;i++){ const a=q[i], b=q[(i+1)%q.length]; s+=a[0]*b[1]-a[1]*b[0]; } return Math.abs(s)/2; }
function findPage(V){ const f=4, w=Math.floor(V.w/f), h=Math.floor(V.h/f), s=gray(w,h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let m=0; for(let j=0;j<f;j++) for(let i=0;i<f;i++) m+=V.a[(y*f+j)*V.w+x*f+i]; s.a[y*w+x]=m/(f*f); }
  const th=otsu(s), lab0=new Int32Array(w*h).fill(-1); let best=null;
  for(let i=0;i<w*h;i++){ if(lab0[i]>=0||s.a[i]<th) continue; const st=[i], pts=[]; lab0[i]=i; let n=0;
    while(st.length){ const j=st.pop(), x=j%w, y=(j/w)|0; n++; pts.push([x,y]);
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{ const xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=w||yy>=h) return; const k=yy*w+xx; if(lab0[k]<0&&s.a[k]>=th){ lab0[k]=i; st.push(k); } }); }
    if(!best||n>best.n) best={n,pts}; }
  if(!best||best.n<0.08*w*h) return null;
  const hl=hull(best.pts); if(hl.length<4) return null;
  /* четыре вершины оболочки с наибольшей площадью (оболочку прореживаем до ≤ 40 точек) */
  const step=Math.max(1,Math.ceil(hl.length/40)), C=hl.filter((_,i)=>i%step===0); let q=null, A0=0;
  for(let a=0;a<C.length;a++) for(let b=a+1;b<C.length;b++) for(let c=b+1;c<C.length;c++) for(let d=c+1;d<C.length;d++){ const qq=[C[a],C[b],C[c],C[d]], A=area(qq); if(A>A0){ A0=A; q=qq; } }
  const fill=best.n/A0; return {quad:q.map(p=>[(p[0]+0.5)*f,(p[1]+0.5)*f]),fill,frac:best.n/(w*h)}; }

/* внутренность рамки: самая большая область без «чернил», не касающаяся края кадра (рамка — замкнутая тёмная
   граница; тени и свет на карте ink уже убраны) */
function findInner(ink,o){ o=o||{}; const f=4, w=Math.floor(ink.w/f), h=Math.floor(ink.h/f), m0=new Uint8Array(w*h), th=o.th||0.3;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let mx=0; for(let j=0;j<f;j++) for(let i=0;i<f;i++){ const v=ink.a[(y*f+j)*ink.w+x*f+i]; if(v>mx) mx=v; } m0[y*w+x]=mx>th?1:0; }
  /* o.close: рамка карандашом бывает с просветами — «чернила» расширяются на клетку, просветы закрываются */
  let m=m0; if(o.close){ m=new Uint8Array(w*h); for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let v=0; for(let j=-1;j<=1&&!v;j++) for(let i=-1;i<=1;i++){ const xx=x+i, yy=y+j; if(xx>=0&&yy>=0&&xx<w&&yy<h&&m0[yy*w+xx]){ v=1; break; } } m[y*w+x]=v; } }
  const lab0=new Int32Array(w*h).fill(-1); let best=null;
  for(let i=0;i<w*h;i++){ if(lab0[i]>=0||m[i]) continue; const st=[i], pts=[]; lab0[i]=i; let n=0, edge=false;
    while(st.length){ const j=st.pop(), x=j%w, y=(j/w)|0; n++; pts.push([x,y]); if(x===0||y===0||x===w-1||y===h-1) edge=true;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{ const xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=w||yy>=h) return; const k=yy*w+xx; if(lab0[k]<0&&!m[k]){ lab0[k]=i; st.push(k); } }); }
    if(!edge&&(!best||n>best.n)) best={n,pts}; }
  if(!best||best.n<0.05*w*h) return null;
  const hl=hull(best.pts); if(hl.length<4) return null;
  const step=Math.max(1,Math.ceil(hl.length/40)), C=hl.filter((_,i)=>i%step===0); let q=null, A0=0;
  for(let a=0;a<C.length;a++) for(let b=a+1;b<C.length;b++) for(let c=b+1;c<C.length;c++) for(let d=c+1;d<C.length;d++){ const qq=[C[a],C[b],C[c],C[d]], A=area(qq); if(A>A0){ A0=A; q=qq; } }
  return {quad:q.map(p=>[(p[0]+0.5)*f,(p[1]+0.5)*f]),fill:best.n/A0}; }
/* уточнить сторону четырёхугольника по перепаду яркости: точки края вдоль стороны → МНК-прямая */
function edgeLine(V,a,b,inside){ const d=v2.unit(v2.sub(b,a)), n=[-d[1],d[0]], sg=v2.dot(n,v2.sub(inside,a))>0?1:-1, L=v2.dist(a,b), pts=[];
  for(let t=0.1;t<=0.9;t+=0.02){ const c=v2.add(a,v2.mul(d,L*t)); let bestG=0, bestS=null;
    for(let s=-12;s<=12;s+=0.5){ const p1=v2.add(c,v2.mul(n,sg*(s-1))), p2=v2.add(c,v2.mul(n,sg*(s+1))), v1=sample(V,p1[0],p1[1]), v2_=sample(V,p2[0],p2[1]); if(v1==null||v2_==null) continue;
      const g=v2_-v1; if(g>bestG){ bestG=g; bestS=s; } }
    if(bestS!=null&&bestG>0.06) pts.push(v2.add(c,v2.mul(n,sg*bestS))); }
  return fitLine(pts); }
function fitLine(pts){ if(pts.length<3) return null; for(let it=0;it<3;it++){ const n=pts.length, m=[pts.reduce((s,p)=>s+p[0],0)/n,pts.reduce((s,p)=>s+p[1],0)/n];
    let sxx=0,sxy=0,syy=0; pts.forEach(p=>{ const x=p[0]-m[0], y=p[1]-m[1]; sxx+=x*x; sxy+=x*y; syy+=y*y; });
    const ang=0.5*Math.atan2(2*sxy,sxx-syy), d=[Math.cos(ang),Math.sin(ang)], r=pts.map(p=>Math.abs(v2.cross(v2.sub(p,m),d))), med=r.slice().sort((a,b)=>a-b)[Math.floor(r.length/2)];
    const keep=pts.filter((p,i)=>r[i]<=Math.max(1.5,3*med)); if(keep.length===pts.length||keep.length<3) return {p:m,d,n:pts.length}; pts=keep; }
  const n=pts.length, m=[pts.reduce((s,p)=>s+p[0],0)/n,pts.reduce((s,p)=>s+p[1],0)/n]; let sxx=0,sxy=0,syy=0; pts.forEach(p=>{ const x=p[0]-m[0], y=p[1]-m[1]; sxx+=x*x; sxy+=x*y; syy+=y*y; });
  const ang=0.5*Math.atan2(2*sxy,sxx-syy); return {p:m,d:[Math.cos(ang),Math.sin(ang)],n}; }
const meet=(A,B)=>{ const den=v2.cross(A.d,B.d); if(Math.abs(den)<1e-9) return null; const t=v2.cross(v2.sub(B.p,A.p),B.d)/den; return v2.add(A.p,v2.mul(A.d,t)); };

/* ── 2. рамка: в мм листа ищем тёмную линию поперёк каждой стороны ── */
function findFrame(ink,M,SH,th){ th=th||0.25; const W=7, fr=SH.frame, C=[[fr[0],fr[1]],[fr[2],fr[1]],[fr[2],fr[3]],[fr[0],fr[3]]], sides=[];
  for(let k=0;k<4;k++){ const a=C[k], b=C[(k+1)%4], d=v2.unit(v2.sub(b,a)), n=[-d[1],d[0]], L=v2.dist(a,b), pts=[];
    for(let t=0.06;t<=0.94;t+=0.015){ const c=v2.add(a,v2.mul(d,L*t)); let best=0, bs=null;
      const prof=[]; for(let s=-W;s<=W;s+=0.1){ const P=H.apply(M,v2.add(c,v2.mul(n,s))), v=sample(ink,P[0]-0.5,P[1]-0.5); prof.push([s,v==null?1:v]); }
      /* линия рамки — тонкая тёмная полоса с бумагой по обе стороны (край страницы на тёмном столе — не рамка):
         из местных максимумов профиля берём самый тёмный, у которого в 1,3 мм по обе стороны — бумага */
      const at=s=>{ const i=Math.round((s+W)/0.1); return i<0||i>=prof.length?1:prof[i][1]; };
      for(let i=1;i<prof.length-1;i++){ const [s,v]=prof[i]; if(v<=th||v<prof[i-1][1]||v<prof[i+1][1]) continue; if(at(s+1.3)>0.5*v||at(s-1.3)>0.5*v) continue; if(v>best){ best=v; bs=s; } }
      if(bs==null) continue; let sw=0, ss=0; prof.forEach(([s,v])=>{ if(Math.abs(s-bs)<=0.7&&v>best*0.3){ sw+=v-best*0.3; ss+=(v-best*0.3)*s; } });
      pts.push(H.apply(M,v2.add(c,v2.mul(n,sw?ss/sw:bs)))); }
    const l=fitLine(pts); if(!l||l.n<20) return null; sides.push(l); }
  const Q=[3,0,1,2].map((j,k)=>meet(sides[j],sides[k])); if(Q.some(q=>!q)) return null;
  return {quad:Q,src:C}; }

/* ── 3. «дано»: шаблон — точки вдоль напечатанных линий и по кружкам ── */
function templatePts(SH){ const out=[];
  SH.given().forEach(it=>{ if(it.t==='seg'||it.t==='conn'){ const a=toPage(SH,it.a), b=toPage(SH,it.b), L=v2.dist(a,b), n=Math.ceil(L/0.6);
      for(let i=0;i<=n;i++){ const t=i/n, p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]; if(it.t==='conn'&&((L*t)%5.2)>4) continue; out.push({p,w:it.t==='conn'?0.5:1,role:it.role,thin:it.t==='conn'||it.k==='thin'}); } }
    if(it.t==='pt'){ const c=toPage(SH,it.at); for(let i=0;i<16;i++){ const a=i/16*2*Math.PI; out.push({p:[c[0]+0.75*Math.cos(a),c[1]+0.75*Math.sin(a)],w:1.5,role:it.role}); } } });
  return out; }
/* карта расстояний до «печатной» тёмности (двухпроходная, 8-связная) в мм; обрезана на cap */
function distMap(g,th,cap){ const {w,h}=g, D=new Float32Array(w*h), INF=1e9; for(let i=0;i<w*h;i++) D[i]=g.a[i]>=th?0:INF;
  const s2=Math.SQRT2; for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=y*w+x; let v=D[i]; if(x>0) v=Math.min(v,D[i-1]+1); if(y>0){ v=Math.min(v,D[i-w]+1); if(x>0) v=Math.min(v,D[i-w-1]+s2); if(x<w-1) v=Math.min(v,D[i-w+1]+s2); } D[i]=v; }
  for(let y=h-1;y>=0;y--) for(let x=w-1;x>=0;x--){ const i=y*w+x; let v=D[i]; if(x<w-1) v=Math.min(v,D[i+1]+1); if(y<h-1){ v=Math.min(v,D[i+w]+1); if(x<w-1) v=Math.min(v,D[i+w+1]+s2); if(x>0) v=Math.min(v,D[i+w-1]+s2); } D[i]=v; }
  const o=gray(w,h); for(let i=0;i<w*h;i++) o.a[i]=Math.min(cap,D[i]/g.ppm); o.box=g.box; o.ppm=g.ppm; return o; }
const at=(g,p)=>{ const v=sample(g,(p[0]-g.box[0])*g.ppm-0.5,(p[1]-g.box[1])*g.ppm-0.5); return v==null?null:v; };

/* подгонка: M = M0 ∘ (поправка T: 8 параметров у точек листа около центра c) — Гаусс — Ньютон по усечённым расстояниям */
function refine(ink,M0,tpl,box,c,iters){ /* работаем в мм листа, предварительно выпрямленном по M0 */
  const ppm=6, g=CL.warp(ink,M0,box,ppm), th=Math.max(0.3,thresholdPrint(g)), D=distMap(g,th,1.2);
  const P=tpl.map(t=>t.p), W=tpl.map(t=>t.w);
  /* поправка: p' = T(p) — проективная около c, параметры — смещения четырёх опорных точек (±25 мм от c) */
  const ctrl=[[-25,-25],[25,-25],[25,25],[-25,25]].map(d=>v2.add(c,d));
  const Tof=x=>H.fit(ctrl,ctrl.map((q,i)=>[q[0]+x[2*i],q[1]+x[2*i+1]]));
  const cost=x=>{ const T=Tof(x); let s=0, n=0; for(let i=0;i<P.length;i++){ const q=H.apply(T,P[i]), d=at(D,q); const dd=d==null?1.2:d; s+=W[i]*dd*dd; n+=W[i]; } return s/n; };
  let x=new Array(8).fill(0), f=cost(x), lam=1e-3;
  for(let it=0;it<(iters||25);it++){ const T=Tof(x), r=[], J=[]; const eps=0.05;
    const Ts=[]; for(let k=0;k<8;k++){ const xk=x.slice(); xk[k]+=eps; Ts.push(Tof(xk)); }
    for(let i=0;i<P.length;i++){ const q=H.apply(T,P[i]), d=at(D,q); if(d==null||d>=1.19) continue; const w=Math.sqrt(W[i]);
      r.push(w*d); J.push(Ts.map(Tk=>{ const dk=at(D,H.apply(Tk,P[i])); return w*((dk==null?1.2:dk)-d)/eps; })); }
    if(r.length<20) break;
    const A=Array.from({length:8},()=>new Array(9).fill(0)); for(let i=0;i<r.length;i++) for(let a=0;a<8;a++){ for(let b=0;b<8;b++) A[a][b]+=J[i][a]*J[i][b]; A[a][8]-=J[i][a]*r[i]; }
    for(let a=0;a<8;a++) A[a][a]=A[a][a]*(1+lam)+1e-4;
    const dx=IMG.solve(A); if(!dx) break; const xn=x.map((v,k)=>v+dx[k]), fn=cost(xn);
    if(fn<f){ x=xn; f=fn; lam=Math.max(1e-6,lam/3); if(Math.max(...dx.map(Math.abs))<0.005) break; } else { lam*=10; if(lam>1e4) break; } }
  const T=Tof(x); return {M:H.norm(H.mul(M0,T)),cost:f,g,D,th}; }
/* тонкая подгонка: точки шаблона (рамка и «дано») — на гребень (середину) печатной линии прямо на фото.
   Параметры — смещения (px) изображений четырёх углов рамки; невязка r = g_max − g(M p), якобиан —
   градиент слегка размытой карты тёмности × производная положения точки по параметрам. Рамка держит перспективу
   всего листа, «дано» — положение чертежа (шаблон «дано» уже сдвинут на найденный сдвиг). */
function refineRidge(inkB,M0,pts,ctrl,iters){ const g=inkB, base=ctrl.map(p=>H.apply(M0,p)), Mof=x=>H.fit(ctrl,base.map((q,i)=>[q[0]+x[2*i],q[1]+x[2*i+1]]));
  const S=(q)=>sample(g,q[0]-0.5,q[1]-0.5), grad=q=>{ const a1=S([q[0]+1,q[1]]), a2=S([q[0]-1,q[1]]), b1=S([q[0],q[1]+1]), b2=S([q[0],q[1]-1]); return a1==null||a2==null||b1==null||b2==null?null:[(a1-a2)/2,(b1-b2)/2]; };
  const vals=pts.map(t=>S(H.apply(M0,t.p))||0).sort((a,b)=>a-b), gmax=vals[Math.floor(vals.length*0.9)]||0.5;
  const cost=x=>{ const M=Mof(x); let s=0; pts.forEach(t=>{ const v=S(H.apply(M,t.p)); s+=t.w*Math.min(gmax,gmax-(v==null?0:v))**2; }); return s; };
  let x=new Array(8).fill(0), f=cost(x), lam=1e-2, used=0;
  for(let it=0;it<(iters||20);it++){ const M=Mof(x), Ms=[]; for(let k=0;k<8;k++){ const xk=x.slice(); xk[k]+=0.05; Ms.push(Mof(xk)); }
    const A=Array.from({length:8},()=>new Array(9).fill(0)); used=0;
    pts.forEach(t=>{ const q=H.apply(M,t.p), v=S(q); if(v==null||v<0.35*gmax) return; const gr=grad(q); if(!gr) return; used++;
      const r=gmax-v, J=Ms.map(Mk=>{ const qk=H.apply(Mk,t.p); return -(gr[0]*(qk[0]-q[0])+gr[1]*(qk[1]-q[1]))/0.05; });
      for(let a=0;a<8;a++){ for(let b=0;b<8;b++) A[a][b]+=t.w*J[a]*J[b]; A[a][8]-=t.w*J[a]*r; } });
    if(used<30) break; for(let a=0;a<8;a++) A[a][a]=A[a][a]*(1+lam)+1e-6;
    const dx=IMG.solve(A); if(!dx) break; const xn=x.map((v,k)=>v+dx[k]), fn=cost(xn);
    if(fn<f){ x=xn; f=fn; lam=Math.max(1e-5,lam/3); if(Math.max(...dx.map(Math.abs))<0.01) break; } else { lam*=8; if(lam>1e4) break; } }
  return {M:H.norm(Mof(x)),used}; }
/* порог «печать»: верхняя часть распределения тёмности (печать темнее карандаша) */
function thresholdPrint(g){ const s=[]; for(let i=0;i<g.a.length;i+=3) if(g.a[i]>0.15) s.push(g.a[i]); if(s.length<50) return 0.4; s.sort((a,b)=>a-b); return s[Math.floor(s.length*0.55)]*0.8; }
/* сдвиг ±R мм (сетка 1 мм, затем 0,25 мм): максимум доли точек шаблона на печатной линии */
function shiftSearch(ink,M0,tpl,box,R){ const ppm=3, g=CL.warp(ink,M0,[box[0]-R,box[1]-R,box[2]+R,box[3]+R],ppm), th=Math.max(0.25,thresholdPrint(g)), D=distMap(g,th,2);
  const score=(dx,dy)=>{ let s=0, n=0; for(const t of tpl){ const d=at(D,[t.p[0]+dx,t.p[1]+dy]); s+=t.w*(d==null?2:Math.min(2,d)); n+=t.w; } return s/n; };
  let best=[0,0], bv=score(0,0); for(let dy=-R;dy<=R;dy+=1) for(let dx=-R;dx<=R;dx+=1){ const v=score(dx,dy); if(v<bv){ bv=v; best=[dx,dy]; } }
  const b0=best.slice(); for(let dy=-1;dy<=1;dy+=0.25) for(let dx=-1;dx<=1;dx+=0.25){ const v=score(b0[0]+dx,b0[1]+dy); if(v<bv){ bv=v; best=[b0[0]+dx,b0[1]+dy]; } }
  return {shift:best,score:bv}; }

/* доля точек шаблона на печатной линии (≤ 0,35 мм) и СКО отклонения — мера качества выпрямления */
function fitQuality(D,tpl,M){ let on=0, n=0, s=0; for(const t of tpl){ const d=at(D,t.p); n++; if(d!=null&&d<=0.35){ on++; s+=d*d; } } return {on:on/n,rms:Math.sqrt(s/Math.max(1,on))}; }

function rectify(img,o){ o=o||{}; const SH=SHEETS[o.n||47], pg=SH&&SH.page; if(!SH) return {ok:false,reason:'нет шаблона листа для задачи №'+o.n};
  const {ink,V}=CL.ink(img), fr0=SH.frame;
  /* четырёхугольники-кандидаты: внутренность рамки и край страницы; углы сопоставляем с рамкой и со страницей
     при четырёх поворотах — отбор по пропорциям, затем рамка уточняется, верх/низ решает «дано» */
  const quads=[]; const I=findInner(ink); if(I) quads.push({q:I.quad,as:'frame'}); const P=findPage(V); if(P&&P.fill>0.9) quads.push({q:P.quad,as:'page'},{q:P.quad,as:'frame'});
  if(!quads.length) return {ok:false,reason:'не нашёл лист на фото: снимите страницу целиком'};
  const cand=[];
  quads.forEach(Q=>{ const q=Q.q, c0=[q.reduce((s,p)=>s+p[0],0)/4,q.reduce((s,p)=>s+p[1],0)/4], ord=q.slice().sort((a,b)=>Math.atan2(a[1]-c0[1],a[0]-c0[0])-Math.atan2(b[1]-c0[1],b[0]-c0[0]));
    const R=Q.as==='page'?[0,0,pg.w,pg.h]:fr0, src=[[R[0],R[1]],[R[2],R[1]],[R[2],R[3]],[R[0],R[3]]];
    for(let r=0;r<4;r++){ const dst=[0,1,2,3].map(i=>ord[(i+r)%4]), sw=v2.dist(dst[0],dst[1])+v2.dist(dst[2],dst[3]), sh=v2.dist(dst[1],dst[2])+v2.dist(dst[3],dst[0]);
      const asp=Math.abs(Math.log((sh/sw)/((R[3]-R[1])/(R[2]-R[0])))); if(asp<0.25) cand.push({M:H.fit(src,dst),asp,r,as:Q.as}); } });
  if(!cand.length) return {ok:false,reason:'лист на фото не похож на страницу задачи (пропорции) — снимите страницу целиком, сверху'};
  /* рамка симметрична: верх/низ решает «дано» (у перевёрнутого листа шаблон не совпадёт) */
  const tpl=templatePts(SH), xs=tpl.map(t=>t.p[0]), ys=tpl.map(t=>t.p[1]), box=[Math.min(...xs)-4,Math.min(...ys)-4,Math.max(...xs)+4,Math.max(...ys)+4];
  const fpts=[], F=[[fr0[0],fr0[1]],[fr0[2],fr0[1]],[fr0[2],fr0[3]],[fr0[0],fr0[3]]];
  for(let k=0;k<4;k++){ const a=F[k], b=F[(k+1)%4], L=v2.dist(a,b); for(let t=4;t<L-4;t+=1) fpts.push({p:[a[0]+(b[0]-a[0])*t/L,a[1]+(b[1]-a[1])*t/L],w:1}); }
  const inkB=IMG.blur(ink,1);
  /* каждый кандидат — до конца: рамка → сдвиг «дано» → общая подгонка → доля точек «дано» на печатной линии */
  let best=null, sawFrame=false;
  for(const c of cand){ const fr=findFrame(ink,c.M,SH); if(o.dbg) o.dbg.push(c.as+' r'+c.r+' asp '+c.asp.toFixed(3)+' рамка '+!!fr); if(!fr) continue; sawFrame=true; const M1=H.fit(fr.src,fr.quad);
    const sh=shiftSearch(ink,M1,tpl,box,25), Tsh=[1,0,sh.shift[0],0,1,sh.shift[1],0,0,1], M2=H.norm(H.mul(M1,Tsh));
    const cc=[(box[0]+box[2])/2,(box[1]+box[3])/2], rf0=refine(ink,M2,tpl,box,cc,30);
    /* сдвиг «дано» относительно рамки (раскладка тетради) — к шаблону; общая подгонка рамка + «дано» */
    const s0=sh.shift.map((v,i)=>v+(H.apply(H.inv(M1),H.apply(rf0.M,cc))[i]-cc[i]-v)), Ts=[1,0,s0[0],0,1,s0[1],0,0,1];
    const gpts=tpl.map(t=>({p:[t.p[0]+s0[0],t.p[1]+s0[1]],w:2*t.w,thin:t.thin}));
    const rr=refineRidge(inkB,M1,fpts.concat(gpts),F,25), Mf=H.norm(H.mul(rr.M,Ts));
    /* качество: доля точек «дано» на печатной линии — тёмность ≥ половины типичной тёмности рамки (той же краски) */
    const frameInk=fpts.map(t=>sample(inkB,...H.apply(rr.M,t.p).map(v=>v-0.5))||0).sort((a,b)=>a-b), ref=frameInk[Math.floor(frameInk.length/2)];
    /* тонкая печать (ось, линия связи) после расфокуса бледнее толстой рамки — для неё порог ниже */
    const onG=gpts.filter(t=>t.w>=1).map(t=>(sample(inkB,...H.apply(rr.M,t.p).map(v=>v-0.5))||0)>=(t.thin?0.25:0.45)*ref), q={on:onG.filter(Boolean).length/onG.length,ref};
    if(o.dbg) o.dbg.push('  сдвиг '+sh.shift+' score '+sh.score.toFixed(3)+' качество '+q.on.toFixed(3));
    if(!best||q.on>best.q.on+0.02||(Math.abs(q.on-best.q.on)<=0.02&&sh.score<best.sh.score)) best={M:M1,Mf,sh:{shift:s0,score:sh.score},q,r:c.r,fr}; }
  if(!best) return {ok:false,reason:sawFrame?'не нашёл напечатанное условие':'не нашёл рамку листа: проверьте, что вся страница в кадре и в фокусе'};
  /* масштаб съёмки: пикселей на мм в центре чертежа */
  const c=toPage(SH,[(SH.roi[0]+SH.roi[2])/2,(SH.roi[1]+SH.roi[3])/2]), px=v2.dist(H.apply(best.Mf,c),H.apply(best.Mf,[c[0]+1,c[1]]));
  if(px<(o.minPx||3)) return {ok:false,reason:'лист снят слишком мелко ('+(px*3/(o.minPx||3)).toFixed(1)+' px на мм) — подойдите ближе'};
  const sh=best.sh, rf={M:best.Mf}, q2=best.q;
  if(q2.on<0.8) return {ok:false,reason:'напечатанное условие совпало плохо ('+Math.round(q2.on*100)+' % точек) — это задача №'+SH.n+'? Переснимите без бликов и теней',H:rf.M,quality:q2};
  return {ok:true,H:rf.M,Hi:H.inv(rf.M),page:P,frame:best,shift:sh.shift,quality:q2,pxPerMm:px,ink,sheet:SH}; }
function frameQuality(ink,M,SH){ const fr=SH.frame; let s=0, n=0; for(let t=0;t<=1;t+=0.01){ [[fr[0]+(fr[2]-fr[0])*t,fr[1]],[fr[0]+(fr[2]-fr[0])*t,fr[3]],[fr[0],fr[1]+(fr[3]-fr[1])*t],[fr[2],fr[1]+(fr[3]-fr[1])*t]].forEach(p=>{ const P=H.apply(M,p), v=sample(ink,P[0]-0.5,P[1]-0.5); if(v!=null){ s+=v; n++; } }); } return n?s/n:0; }

put('rectify',{rectify,findPage,findInner,findFrame,refineRidge,templatePts,distMap,refine,fitLine});
})();
