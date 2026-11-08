/* ═══════════ Притяжка оцифровки к карандашу: ответ модели × настоящие линии на снимке ═══════════
   Модель даёт отрезки грубо и «поправляет» кривое построение до правильного, а то и теряет бледную линию.
   Этот шаг работает в пикселях того же снимка, что видела модель, и ничего не знает ни о задании, ни о листе:
     1. карта тёмности: фон по большому окну минус серое, сглаженное σ ≈ 1 px; порог — от шума бумаги (MAD);
     2. каждый отрезок модели: поперёк него ищется гребень (максимум тёмности), по гребням — прямая МНК
        с отбрасыванием выбросов, 3 прохода с сужением окна; концы подрезаются/продлеваются по чернилам;
        «чернила» = доля длины, где под прямой действительно есть карандаш;
     3. чернила < inkMin — отрезка на бумаге нет (выдумка или «как надо»): отбрасывается;
     4. линии, которые модель не нашла: гребни, не занятые уточнёнными отрезками, → Хаф → прямые длиннее minLen мм.
   refine(gray {w,h,a}, segs [[x1,y1,x2,y2,dash?]], {ppm, find, ...}) → {segs:[{p:[x1,y1,x2,y2], src:'model'|'found', ink, moved}], dropped:[…], stats}
   Ничего не решает про «верно/неверно»: только копирует, что есть на бумаге. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=v=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB.refine=v; } };

function boxBlur(a,w,h,r){ /* среднее по окну (2r+1)², через интегральное изображение */
  const W=w+1, S=new Float64Array(W*(h+1));
  for(let y=0;y<h;y++){ let row=0; for(let x=0;x<w;x++){ row+=a[y*w+x]; S[(y+1)*W+x+1]=S[y*W+x+1]+row; } }
  const o=new Float32Array(w*h);
  for(let y=0;y<h;y++){ const y0=Math.max(0,y-r), y1=Math.min(h,y+r+1); for(let x=0;x<w;x++){ const x0=Math.max(0,x-r), x1=Math.min(w,x+r+1);
    o[y*w+x]=(S[y1*W+x1]-S[y0*W+x1]-S[y1*W+x0]+S[y0*W+x0])/((x1-x0)*(y1-y0)); } }
  return o; }
function gauss(a,w,h,s){ const r=Math.ceil(3*s), k=new Float32Array(2*r+1); let S=0; for(let i=-r;i<=r;i++){ k[i+r]=Math.exp(-i*i/(2*s*s)); S+=k[i+r]; } for(let i=0;i<k.length;i++) k[i]/=S;
  const t=new Float32Array(w*h), o=new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let v=0; for(let i=-r;i<=r;i++){ const X=Math.min(w-1,Math.max(0,x+i)); v+=a[y*w+X]*k[i+r]; } t[y*w+x]=v; }
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let v=0; for(let i=-r;i<=r;i++){ const Y=Math.min(h-1,Math.max(0,y+i)); v+=t[Y*w+x]*k[i+r]; } o[y*w+x]=v; }
  return o; }
/* тёмность: насколько пиксель темнее окружающей бумаги (0 — бумага), в уровнях серого; thr — порог «это карандаш» */
function darkness(g,o){ const {w,h,a}=g, big=Math.max(6,Math.round((o.ppm||7)*1.6));
  /* фон — по окну ≈ 3 мм: карандашная линия (0,3–0,5 мм) в среднее почти не попадает, а свет и тень плавные */
  const bg=boxBlur(a,w,h,big), d=new Float32Array(w*h); for(let i=0;i<d.length;i++) d[i]=o.relative===false?Math.max(0,bg[i]-a[i]):Math.max(0,bg[i]-a[i])/Math.max(25,bg[i])*200;   /* относительно местного фона: в тени бледный карандаш слабее по уровням серого, но так же заметен */
  const G=gauss(d,w,h,o.sigma||1.0), v=Array.from(G.filter((_,i)=>i%7===0)).sort((x,y)=>x-y), med=v[v.length>>1], mad=v[Math.floor(v.length*0.75)]-med;
  /* шум бумаги: верхний квартиль гладкой карты, порог — несколько таких */
  const thr=Math.max(1.2,med+(o.k||5)*Math.max(mad,0.15));
  return {G,thr,w,h}; }
const bil=(a,w,h,x,y)=>{ const x0=Math.floor(x), y0=Math.floor(y); if(x0<0||y0<0||x0>=w-1||y0>=h-1) return 0; const fx=x-x0, fy=y-y0, i=y0*w+x0;
  return (a[i]*(1-fx)+a[i+1]*fx)*(1-fy)+(a[i+w]*(1-fx)+a[i+w+1]*fx)*fy; };

/* прямая по взвешенным точкам (полная МНК): точка на прямой и направление */
function tls(P){ let W=0,mx=0,my=0; P.forEach(c=>{ W+=c.w; mx+=c.w*c.x; my+=c.w*c.y; }); if(W<=0) return null; mx/=W; my/=W;
  let sxx=0,syy=0,sxy=0; P.forEach(c=>{ const dx=c.x-mx, dy=c.y-my; sxx+=c.w*dx*dx; syy+=c.w*dy*dy; sxy+=c.w*dx*dy; });
  const th=0.5*Math.atan2(2*sxy,sxx-syy); return {x:mx,y:my,dx:Math.cos(th),dy:Math.sin(th)}; }

/* притянуть один отрезок: [x1,y1,x2,y2] → {p, ink, moved, n} или null */
function snap(D,seg,o){ const {G,w,h}=D, thr=D.thr*(o.soft==null?0.6:o.soft), ppm=o.ppm||7; let [x1,y1,x2,y2]=seg; let L0=Math.hypot(x2-x1,y2-y1); if(L0<2) return null;
  let line={x:(x1+x2)/2,y:(y1+y2)/2,dx:(x2-x1)/L0,dy:(y2-y1)/L0}, R=(o.radius||2)*ppm, ext=0, pts=[];
  /* шаг 0: устойчивое выравнивание — положение обоих концов перебирается в окне ±R, оценка = сумма отклика вдоль ВСЕЙ линии × прайор
     (модель ошибается на доли мм: чем дальше от её ответа, тем меньше вес). Слабую линию рядом с сильной это не теряет */
  { const ux=(x2-x1)/L0, uy=(y2-y1)/L0, nx0=-uy, ny0=ux, step=Math.max(1,R/14), sig=Math.max(1.5,0.9*ppm), cap=5*D.thr, M=Math.max(8,Math.min(400,Math.round(L0/2))); let best=null, ids=[];
    for(let i=0;i<=M;i++){ const f=0.02+0.96*i/M; ids.push([x1+(x2-x1)*f,y1+(y2-y1)*f,f]); }
    for(let ta=-R;ta<=R;ta+=step) for(let tb=-R;tb<=R;tb+=step){ let sc=0; for(let q=0;q<ids.length;q++){ const f=ids[q][2], t=ta*(1-f)+tb*f; sc+=Math.min(cap,bil(G,w,h,ids[q][0]+nx0*t,ids[q][1]+ny0*t)); }   /* вклад точки ограничен: тёмная соседка не перетягивает, побеждает линия, непрерывная по всей длине */
      sc=sc/ids.length*Math.exp(-0.5*((ta/sig)*(ta/sig)+(tb/sig)*(tb/sig))*0.35); if(!best||sc>best.sc) best={sc,ta,tb}; }
    if(best&&best.sc>thr*0.8){ x1+=nx0*best.ta; y1+=ny0*best.ta; x2+=nx0*best.tb; y2+=ny0*best.tb; seg=[x1,y1,x2,y2].concat(seg.slice(4)); L0=Math.hypot(x2-x1,y2-y1); line={x:(x1+x2)/2,y:(y1+y2)/2,dx:(x2-x1)/L0,dy:(y2-y1)/L0}; R=Math.max(1.2*ppm*0.5,Math.min(R,1.0*ppm)); } }
  const s0=-L0/2*0.96, s1=L0/2*0.96;
  for(let it=0;it<4;it++){ pts=[]; const nx=-line.dy, ny=line.dx;
    for(let s=s0;s<=s1;s+=1){ const cx=line.x+line.dx*s, cy=line.y+line.dy*s; let best=-1, bt=0;
      let sc0=-1; for(let t=-R;t<=R;t+=0.5){ const v=bil(G,w,h,cx+nx*t,cy+ny*t), sc=v*(1-0.6*Math.abs(t)/R); if(sc>sc0){ sc0=sc; best=v; bt=t; } }   /* гребень выбирается с поправкой на близость к предсказанной прямой: соседний параллельный не перетянет */
      if(best>thr){ /* субпиксельно: парабола по трём точкам */
        const a=bil(G,w,h,cx+nx*(bt-0.5),cy+ny*(bt-0.5)), c=bil(G,w,h,cx+nx*(bt+0.5),cy+ny*(bt+0.5)), den=a-2*best+c, sub=den<-1e-6?0.5*(a-c)/den*0.5:0;
        pts.push({x:cx+nx*(bt+sub),y:cy+ny*(bt+sub),w:best,t:bt}); } }
    if(pts.length<Math.max(6,L0*0.2)) return {p:seg.slice(0,4),ink:pts.length/Math.max(1,(s1-s0)),moved:0,n:pts.length,lost:true};
    /* выбросы: сначала по расстоянию до прямой, потом по её МНК */
    let f=tls(pts), keep=pts; if(!f) return {p:seg.slice(0,4),ink:0,moved:0,n:pts.length,lost:true};
    for(let k=0;k<3;k++){ const nn=-f.dy, mm=f.dx, r=keep.map(c=>Math.abs((c.x-f.x)*nn+(c.y-f.y)*mm)); const s=r.slice().sort((a,b)=>a-b)[Math.floor(r.length*0.6)]||0.5, lim=Math.max(1.2,2.5*s);
      keep=keep.filter((c,i)=>r[i]<=lim); if(keep.length<6) break; const f2=tls(keep); if(!f2) break; f=f2; }
    if(keep.length<6) return {p:seg.slice(0,4),ink:keep.length/Math.max(1,(s1-s0)),moved:0,n:keep.length,lost:true};
    if(f.dx*line.dx+f.dy*line.dy<0){ f.dx=-f.dx; f.dy=-f.dy; }
    line=f; R=Math.max(1.2*ppm*0.5,R*0.5); pts=keep; }
  /* чернила вдоль уточнённой прямой: на каждом шаге вдоль s — есть ли гребень ближе 1,5 px; концы: по первому/последнему чернильному месту */
  const sOf=(x,y)=>(x-line.x)*line.dx+(y-line.y)*line.dy, nx=-line.dy, ny=line.dx, along=(s)=>{ const cx=line.x+line.dx*s, cy=line.y+line.dy*s; let m=0; for(let t=-1.5;t<=1.5;t+=0.5){ const v=bil(G,w,h,cx+nx*t,cy+ny*t); if(v>m) m=v; }
    /* локальный контраст: линия темнее соседних полос (±4…6 px) заметно, а не просто выше общего порога; в тени и на зерне порог плывёт, соседи — нет */
    const d1=Math.max(4,0.6*ppm), d2=Math.max(5,0.9*ppm), off=(bil(G,w,h,cx+nx*d2,cy+ny*d2)+bil(G,w,h,cx-nx*d2,cy-ny*d2)+bil(G,w,h,cx+nx*d1,cy+ny*d1)+bil(G,w,h,cx-nx*d1,cy-ny*d1))/4;   /* соседи — за шириной самой линии (≈ 0,5 мм), а не на её краю */ return m>thr*0.7&&m>off*1.6+thr*0.25; };
  const A=sOf(x1,y1), B=sOf(x2,y2), lo=Math.min(A,B), hi=Math.max(A,B), ink=[];
  for(let s=lo;s<=hi;s+=1) ink.push(along(s)?1:0);
  const frac=ink.reduce((a,b)=>a+b,0)/Math.max(1,ink.length);
  /* штриховая и обычная: допустим разрывы до 4 мм, концы — по крайним чернильным местам, продление до 2 мм */
  const gap=Math.round(4*ppm); let first=ink.indexOf(1), last=ink.lastIndexOf(1); if(first<0) return {p:seg.slice(0,4),ink:0,moved:0,n:pts.length,lost:true};
  let sLo=lo+first, sHi=lo+last; const maxExt=(o.extend==null?2:o.extend)*ppm;
  for(let e=1;e<=maxExt;e++){ if(along(sLo-1)) sLo-=1; else break; } for(let e=1;e<=maxExt;e++){ if(along(sHi+1)) sHi+=1; else break; }
  void gap;
  /* подрезка и продление концов — только у длинных отрезков и не больше 30 % длины с каждого края: короткий (< 20 мм) не трогаем,
     иначе шум в оценке чернил съедает его целиком */
  if(L0<20*ppm){ sLo=lo; sHi=hi; } else { const span=hi-lo; sLo=Math.min(sLo,lo+0.3*span); sHi=Math.max(sHi,hi-0.3*span); }
  const pa=[line.x+line.dx*sLo,line.y+line.dy*sLo], pb=[line.x+line.dx*sHi,line.y+line.dy*sHi];
  const orient=(x2-x1)*(pb[0]-pa[0])+(y2-y1)*(pb[1]-pa[1])<0; const p=orient?[pb[0],pb[1],pa[0],pa[1]]:[pa[0],pa[1],pb[0],pb[1]];
  const moved=Math.max(Math.hypot(p[0]-x1,p[1]-y1),Math.hypot(p[2]-x2,p[3]-y2));
  const dMid=Math.abs(((x1+x2)/2-line.x)*nx+((y1+y2)/2-line.y)*ny);
  return {p,ink:frac,moved,dMid,n:pts.length,len:Math.hypot(p[2]-p[0],p[3]-p[1])}; }

/* линии, которые модель не нашла: свободные гребни → Хаф → прямые */
function findMissing(D,used,o){ const {G,thr,w,h}=D, ppm=o.ppm||7, minLen=(o.minLen||12)*ppm, pts=[];
  const B=o.box||[0,0,w,h];
  for(let y=Math.max(1,Math.floor(B[1]));y<Math.min(h-1,B[3]);y+=1) for(let x=Math.max(1,Math.floor(B[0]));x<Math.min(w-1,B[2]);x+=1){ const v=G[y*w+x]; if(v<=thr*1.2||used[y*w+x]) continue;
    /* локальный максимум поперёк (хоть по одной из осей): гребень, а не заливка */
    if((v>=G[y*w+x-1]&&v>=G[y*w+x+1])||(v>=G[(y-1)*w+x]&&v>=G[(y+1)*w+x])) pts.push([x,y,v]); }
  const out=[]; if(pts.length<minLen) return out;
  const NA=360, diag=Math.hypot(w,h), NR=Math.ceil(2*diag), cs=new Float32Array(NA), sn=new Float32Array(NA); for(let i=0;i<NA;i++){ cs[i]=Math.cos(i*Math.PI/NA); sn[i]=Math.sin(i*Math.PI/NA); }
  let alive=new Uint8Array(pts.length).fill(1);
  for(let iter=0;iter<(o.maxFind||24);iter++){ const acc=new Float32Array(NA*NR);
    for(let k=0;k<pts.length;k++){ if(!alive[k]) continue; const [x,y]=pts[k]; for(let i=0;i<NA;i++){ const r=Math.round(x*cs[i]+y*sn[i]+diag); acc[i*NR+r]+=1; } }
    let bi=0,bv=0; for(let i=0;i<acc.length;i++) if(acc[i]>bv){ bv=acc[i]; bi=i; }
    if(bv<minLen*0.5) break; const th=Math.floor(bi/NR), rho=bi%NR-diag, nx=cs[th], ny=sn[th], dx=-ny, dy=nx;
    const near=[]; for(let k=0;k<pts.length;k++){ if(!alive[k]) continue; const [x,y]=pts[k]; if(Math.abs(x*nx+y*ny-rho)<=1.6) near.push(k); }
    near.sort((a,b)=>(pts[a][0]*dx+pts[a][1]*dy)-(pts[b][0]*dx+pts[b][1]*dy));
    /* участки вдоль прямой: разрыв > 4 мм — новый */
    let run=[near[0]]; const runs=[]; for(let i=1;i<near.length;i++){ const s=pts[near[i]][0]*dx+pts[near[i]][1]*dy, sp=pts[run[run.length-1]][0]*dx+pts[run[run.length-1]][1]*dy; if(s-sp>4*ppm){ runs.push(run); run=[]; } run.push(near[i]); } runs.push(run);
    let any=false;
    runs.forEach(r=>{ if(!r.length) return; const s0=pts[r[0]][0]*dx+pts[r[0]][1]*dy, s1=pts[r[r.length-1]][0]*dx+pts[r[r.length-1]][1]*dy, len=s1-s0;
      if(len>=minLen&&r.length>=len*0.55){ const f=tls(r.map(k=>({x:pts[k][0],y:pts[k][1],w:pts[k][2]}))); if(f){ const a=(pts[r[0]][0]-f.x)*f.dx+(pts[r[0]][1]-f.y)*f.dy, b=(pts[r[r.length-1]][0]-f.x)*f.dx+(pts[r[r.length-1]][1]-f.y)*f.dy;
        /* карандашная линия — один гребень на каждый шаг вдоль неё; заметно больше — полоса (край бумаги, тень, рамка), а не линия */
        if(r.length/len<=(o.maxInk||1.15)) out.push({p:[f.x+f.dx*a,f.y+f.dy*a,f.x+f.dx*b,f.y+f.dy*b],ink:r.length/len,src:'found',g:r.reduce((a,k)=>a+pts[k][2],0)/r.length}); any=true; r.forEach(k=>alive[k]=0); } } });
    if(!any){ near.forEach(k=>alive[k]=0); } }
  return out; }

const dSegPt=(p,s)=>{ const dx=s[2]-s[0], dy=s[3]-s[1], L=dx*dx+dy*dy||1e-9, t=Math.max(0,Math.min(1,((p[0]-s[0])*dx+(p[1]-s[1])*dy)/L)); return Math.hypot(p[0]-s[0]-t*dx,p[1]-s[1]-t*dy); };
function meanG(D,p){ const L=Math.hypot(p[2]-p[0],p[3]-p[1]), n=Math.max(2,Math.ceil(L)); let t=0; for(let k=0;k<=n;k++){ let m=0; const x=p[0]+(p[2]-p[0])*k/n, y=p[1]+(p[3]-p[1])*k/n; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const v=bil(D.G,D.w,D.h,x+dx,y+dy); if(v>m) m=v; } t+=m; } return t/(n+1); }

/* ═══ окружности и дуги ═══
   Формат модели: C <cx> <cy> <r> [d] — окружность; R <cx> <cy> <r> <a1> <a2> [d] — дуга от a1 до a2 по часовой стрелке на экране
   (углы в градусах, 0° — вправо, 90° — вниз, как на снимке; y вниз). d — штриховая.
   snapCircle(D, {cx,cy,r,a1,a2}, {ppm}) → уточнённая окружность/дуга по гребню карандаша: центр и радиус (спуск по сумме отклика вдоль
   всего кольца, с потолком вклада точки), углы дуги — по непрерывному куску чернил; ink — доля подтверждённого кольца.
   findCircles(D, usedMask, {ppm, box}) → окружности и дуги, которых модель не выписала: Хаф по центрам с направлением поперёк гребня
   (собственный вектор гессиана), затем радиус по гистограмме расстояний и проверка чернил по углам. */
const TAU=Math.PI*2, NB26=(()=>{ const a=[]; for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) for(let k=-1;k<=1;k++) if(i||j||k) a.push([i,j,k]); return a; })();   /* все сочетания сдвигов: в узкой долине «центр ↔ радиус» осевой спуск стоит */
function ringSamples(r){ return Math.max(24,Math.min(720,Math.ceil(TAU*r/1.5))); }
function ringScore(D,cx,cy,r,cap){ const n=ringSamples(r); let t=0; for(let k=0;k<n;k++){ const a=TAU*k/n; t+=Math.min(cap,bil(D.G,D.w,D.h,cx+r*Math.cos(a),cy+r*Math.sin(a))); } return t/n; }
/* чернила по углам: образец «заинкован», если кольцо заметно темнее своих соседей по радиусу (±d1, ±d2) */
function ringInk(D,cx,cy,r,ppm){ const n=ringSamples(r), d1=Math.max(4,0.6*ppm), d2=Math.max(5,0.9*ppm), thr=D.thr, ink=new Uint8Array(n);
  for(let k=0;k<n;k++){ const a=TAU*k/n, c=Math.cos(a), s=Math.sin(a); let m=0; for(let t=-1.5;t<=1.5;t+=0.5){ const v=bil(D.G,D.w,D.h,cx+(r+t)*c,cy+(r+t)*s); if(v>m) m=v; }
    const off=(bil(D.G,D.w,D.h,cx+(r+d2)*c,cy+(r+d2)*s)+bil(D.G,D.w,D.h,cx+(r-d2)*c,cy+(r-d2)*s)+bil(D.G,D.w,D.h,cx+(r+d1)*c,cy+(r+d1)*s)+bil(D.G,D.w,D.h,cx+(r-d1)*c,cy+(r-d1)*s))/4;
    ink[k]=(m>thr*1.2&&m>off*1.6+thr*0.25)?1:0; } return ink; }
/* самый длинный непрерывный кусок чернил по кругу (разрывы до gap образцов склеиваются): [старт, длина] в образцах */
function longestRun(ink,gap){ const n=ink.length; if(!n) return [0,0]; let on=0; for(let i=0;i<n;i++) on+=ink[i]; if(on===0) return [0,0]; if(on===n) return [0,n];
  let z=0; for(let i=0;i<n;i++) if(!ink[i]&&!ink[(i+1)%n]){ z=(i+1)%n; break; }
  const a=[]; for(let i=0;i<n;i++) a.push(ink[(z+i)%n]); let best=[0,0], st=-1, last=-1;
  for(let i=0;i<n;i++){ if(a[i]){ if(st<0) st=i; last=i; } else if(st>=0&&i-last>gap){ if(last-st+1>best[1]) best=[st,last-st+1]; st=-1; } }
  if(st>=0&&last-st+1>best[1]) best=[st,last-st+1]; return [(z+best[0])%n,best[1]]; }
function snapCircle(D,c,o){ o=o||{}; const ppm=o.ppm||7, cap=5*D.thr; let cx=c.cx, cy=c.cy, r=c.r; if(!(r>=3)) return null;
  const W=(o.radius||2)*ppm; if(!D.G2) D.G2=gauss(D.G,D.w,D.h,Math.max(2.5,0.5*ppm));   /* грубая карта: кольцо шириной 1–2 px при смещении на 10 px не даёт градиента — сначала спуск по сглаженной */
  const descend=(GG,capK,step0,stop)=>{ const E={G:GG,w:D.w,h:D.h}; let best=ringScore(E,cx,cy,r,cap*capK), step=step0;
    for(let it=0;it<120&&step>=stop;it++){ let imp=false; for(const [dx,dy,dr] of NB26){ const nx=cx+dx*step, ny=cy+dy*step, nr=r+dr*step;
        if(Math.hypot(nx-c.cx,ny-c.cy)>W||Math.abs(nr-c.r)>W||nr<3) continue; const sc=ringScore(E,nx,ny,nr,cap*capK)*(1-0.02*(Math.hypot(nx-c.cx,ny-c.cy)+Math.abs(nr-c.r))/W); if(sc>best+1e-7){ best=sc; cx=nx; cy=ny; r=nr; imp=true; } } if(!imp) step/=2; } return best; };
  descend(D.G2,0.4,Math.max(1.5,W/4),0.5); descend(D.G,1,1,0.25); const best=descend(D.G,5,0.5,0.1);   /* финал — с высоким потолком: оптимум на вершине гребня, а не на плоскости среза */
  const ink=ringInk(D,cx,cy,r,ppm), n=ink.length, gap=Math.max(2,Math.round(n*3*ppm/(TAU*r))), run=longestRun(ink,gap), on=ink.reduce((a,b)=>a+b,0);
  const res={cx,cy,r,ink:on/n,moved:Math.hypot(cx-c.cx,cy-c.cy)+Math.abs(r-c.r),score:best};
  if(run[1]>=n*0.92||(on>=n*0.85&&c.a1==null)){ res.full=true; res.a1=0; res.a2=360; res.span=360; res.inkRun=res.ink; return res; }
  let st=run[0], len=run[1];
  if(c.a1!=null){ /* модель дала дугу: берём тот кусок чернил, что содержит середину её дуги */
    const m=(((c.a1+((c.a2-c.a1+360)%360)/2)%360)+360)%360, k0=Math.round(m/360*n)%n, has=i=>ink[((i%n)+n)%n];
    if(has(k0)||has(k0+1)||has(k0-1)){ let R=k0, L=k0, g=0; for(let i=k0+1;i<k0+n;i++){ if(has(i)){ R=i; g=0; } else if(++g>gap) break; } g=0; for(let i=k0-1;i>k0-n&&i>R-n;i--){ if(has(i)){ L=i; g=0; } else if(++g>gap) break; } st=((L%n)+n)%n; len=R-L+1; } }
  { let c=0; for(let i=0;i<len;i++) c+=ink[(st+i)%n]; res.inkRun=len?c/len:0; }   /* доля чернил внутри самой дуги (ink — от полного кольца, у дуги он мал по определению) */
  res.span=len/n*360; res.a1=(st/n*360)%360; res.a2=(((st+len-1)/n*360)%360+360)%360; if(len>=n*0.92){ res.full=true; res.a1=0; res.a2=360; res.span=360; }
  return res; }

function findCircles(D,used,o){ o=o||{}; const {G,thr,w,h}=D, ppm=o.ppm||7, rmin=(o.rmin||4)*ppm, rmax=(o.rmax||70)*ppm, B=o.box||[0,0,w,h], out=[];
  const gxx=(x,y)=>G[y*w+x+1]-2*G[y*w+x]+G[y*w+x-1], gyy=(x,y)=>G[(y+1)*w+x]-2*G[y*w+x]+G[(y-1)*w+x], gxy=(x,y)=>(G[(y+1)*w+x+1]-G[(y+1)*w+x-1]-G[(y-1)*w+x+1]+G[(y-1)*w+x-1])/4;
  const pts=[]; for(let y=Math.max(2,Math.floor(B[1]));y<Math.min(h-2,B[3]);y++) for(let x=Math.max(2,Math.floor(B[0]));x<Math.min(w-2,B[2]);x++){ const v=G[y*w+x]; if(v<=thr*1.2||(used&&used[y*w+x])) continue;
    const a=gxx(x,y), d=gyy(x,y), b=gxy(x,y), tr=a+d, det=a*d-b*b, disc=Math.sqrt(Math.max(0,tr*tr/4-det)), l1=tr/2-disc; if(l1>-thr*0.15) continue;   /* гребень: сильная отрицательная кривизна поперёк */
    let nx=b, ny=l1-a; const L=Math.hypot(nx,ny); if(L<1e-9){ nx=1; ny=0; } else { nx/=L; ny/=L; } pts.push([x,y,nx,ny,v]); }
  if(pts.length<40) return out;
  const cell=Math.max(2,ppm*0.6), CW=Math.ceil(w/cell), CH=Math.ceil(h/cell), acc=new Float32Array(CW*CH), rstep=Math.max(1,ppm*0.4);
  pts.forEach(([x,y,nx,ny])=>{ for(let r=rmin;r<=rmax;r+=rstep) for(const sg of [1,-1]){ const cx=x+sg*nx*r, cy=y+sg*ny*r; if(cx<0||cy<0||cx>=w||cy>=h) continue; acc[Math.floor(cy/cell)*CW+Math.floor(cx/cell)]+=1/Math.sqrt(r); } });   /* 1/√r: большие окружности не забивают малые */
  for(let it=0;it<(o.maxFind||6);it++){ let bi=-1,bv=0; for(let i=0;i<acc.length;i++) if(acc[i]>bv){ bv=acc[i]; bi=i; } if(bi<0||bv<2.5) break;
    const ccx=(bi%CW+0.5)*cell, ccy=(Math.floor(bi/CW)+0.5)*cell;
    for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){ const X=bi%CW+dx, Y=Math.floor(bi/CW)+dy; if(X>=0&&Y>=0&&X<CW&&Y<CH) acc[Y*CW+X]=0; }
    /* радиус по гистограмме расстояний от центра до гребневых точек, нормаль которых смотрит на центр */
    const hist=new Map(), hs=Math.max(1,ppm*0.3); pts.forEach(([x,y,nx,ny])=>{ const dx=x-ccx, dy=y-ccy, r=Math.hypot(dx,dy); if(r<rmin||r>rmax) return; if(Math.abs((dx*nx+dy*ny)/r)<0.85) return; const k=Math.round(r/hs); hist.set(k,(hist.get(k)||0)+1); });
    let rb=0,rv=0; hist.forEach((v,k)=>{ const sm=v+(hist.get(k-1)||0)+(hist.get(k+1)||0); if(sm>rv){ rv=sm; rb=k; } }); const r0=rb*hs; if(!r0||rv<Math.max(25,0.25*TAU*r0/1.5)) continue;
    const sn=snapCircle(D,{cx:ccx,cy:ccy,r:r0},{ppm,radius:o.snapRadius||1.5}); if(!sn) continue; const span=sn.span||0; if(span<(o.minSpan||70)||(sn.inkRun||0)<0.7) continue;
    if(out.some(c=>Math.hypot(c.cx-sn.cx,c.cy-sn.cy)<1.5*ppm&&Math.abs(c.r-sn.r)<1.5*ppm)) continue;
    if(span/180*Math.PI*sn.r<(o.minArc||10)*ppm) continue;   /* дуга короче 10 мм — это штрихи, а не окружность */
    /* дубль: дуга лежит на уже принятой окружности (другой центр и радиус, но те же пиксели) */
    { const cnt=24; let a0=sn.full?0:sn.a1, L=sn.full?360:((sn.a2-sn.a1+360)%360); const on=(q)=>{ let k=0; for(let i=0;i<cnt;i++){ const an=(a0+L*i/(cnt-1))*Math.PI/180, px=sn.cx+sn.r*Math.cos(an), py=sn.cy+sn.r*Math.sin(an); if(Math.abs(Math.hypot(px-q.cx,py-q.cy)-q.r)<=0.8*ppm) k++; } return k/cnt; };
      if(out.some(q=>on(q)>=0.7)) continue; }
    out.push({cx:sn.cx,cy:sn.cy,r:sn.r,a1:sn.a1,a2:sn.a2,full:!!sn.full,ink:sn.full?sn.ink:sn.inkRun,span,src:'found'}); }
  return out; }

/* ═══ лекальные кривые (ДЗ №4: линии пересечения поверхностей, эллипсы) ═══
   Формат модели: L x1 y1 x2 y2 … [d] — ломаная по ≥ 5 точкам на кривой. Модель ставит их с промахом 0,5–2 мм и «скругляет»
   по-своему, поэтому кривая сначала прорежается в ровный шаг (≈ 0,7 мм), затем 3 прохода с сужением окна (2 → 1 → 0,5 мм):
   каждая точка ищет гребень тёмности поперёк кривой (нормаль — по соседям), с поправкой на близость к прежнему месту
   (соседняя параллельная линия не перетянет); сдвиги поперёк — медиана по 5 соседям и среднее по 3 (выброс у пересечения
   с другой линией не ломает кривую), где гребня нет — сдвиг по соседям. Концы: без чернил — подрезаются (не больше 35 %
   длины с каждого края), чернила продолжаются — кривая доводится по гребню до 2 мм. ink — доля длины, где под кривой
   карандаш (как у отрезков: темнее соседних полос). Ничего не выпрямляет и не сглаживает сверх шага: копирует, что нарисовано.
   snapCurve(D, {p:[[x,y]…]}, {ppm, radius, step}) → {p, ink, moved (средний сдвиг, px), n} | null */
function polyLen(P){ let s=0; for(let i=1;i<P.length;i++) s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); return s; }
function resample(P,step){ const L=polyLen(P); if(L<1e-6) return P.slice(0,1); const n=Math.max(2,Math.round(L/step)+1), out=[]; let i=1, acc=0, prev=P[0];
  for(let k=0;k<n;k++){ const s=L*k/(n-1); while(i<P.length-1&&acc+Math.hypot(P[i][0]-prev[0],P[i][1]-prev[1])<s){ acc+=Math.hypot(P[i][0]-prev[0],P[i][1]-prev[1]); prev=P[i]; i++; }
    const b=P[i], l=Math.hypot(b[0]-prev[0],b[1]-prev[1])||1e-9, t=Math.max(0,Math.min(1,(s-acc)/l)); out.push([prev[0]+(b[0]-prev[0])*t,prev[1]+(b[1]-prev[1])*t]); }
  return out; }
/* сплайн Катмулла — Рома (центростремительный) через точки модели: между ними кривая, а не хорда */
function spline(P,k){ k=k||8; if(P.length<3) return P; const out=[P[0]], at=i=>P[Math.max(0,Math.min(P.length-1,i))];
  for(let i=0;i<P.length-1;i++){ const p0=at(i-1), p1=at(i), p2=at(i+1), p3=at(i+2), tj=(a,b)=>Math.max(1e-6,Math.sqrt(Math.hypot(b[0]-a[0],b[1]-a[1]))), t1=tj(p0,p1)+(i===0?1e-6:0), t2=t1+tj(p1,p2), t3=t2+tj(p2,p3), t0=0;
    for(let j=1;j<=k;j++){ const t=t1+(t2-t1)*j/k, L=(a,b,ta,tb)=>{ const f=(t-ta)/(tb-ta||1e-9); return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]; };
      const A1=i===0?L(p1,p1,t0,t1):L(p0,p1,t0,t1), A2=L(p1,p2,t1,t2), A3=i===P.length-2?L(p2,p2,t2,t3):L(p2,p3,t2,t3), B1=L(A1,A2,t0,t2), B2=L(A2,A3,t1,t3); out.push(L(B1,B2,t1,t2)); } }
  return out; }
const normals=P=>P.map((p,i)=>{ const a=P[Math.max(0,i-2)], b=P[Math.min(P.length-1,i+2)], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1; return [-dy/l,dx/l]; });
function median5(v,i){ const w=[]; for(let k=i-2;k<=i+2;k++) if(k>=0&&k<v.length&&v[k]!=null) w.push(v[k]); if(!w.length) return null; w.sort((a,b)=>a-b); return w[w.length>>1]; }
function snapCurve(D,c,o){ o=o||{}; const {G,w,h}=D, ppm=o.ppm||7, thr=D.thr*0.6, step=o.step||Math.max(2,0.7*ppm); if(!c||!c.p||c.p.length<2) return null;
  let P=resample(spline(c.p),step); if(P.length<5) return null; const P0=P.map(q=>q.slice()); let moved=0;
  if(!D.G2) D.G2=gauss(G,w,h,Math.max(2.5,0.5*ppm));
  /* первый проход — по сглаженной карте и в окне 3,5 мм: точки модели между собой соединены сплайном, но на крутом месте кривой он режет её на 2–3 мм */
  for(const [Rm,GG,th] of [[(o.radius||2)*1.75,D.G2,thr*0.35],[(o.radius||2),G,thr],[1,G,thr],[0.5,G,thr]]){ const R=Rm*ppm, N=normals(P), off=P.map((p,i)=>{ const [nx,ny]=N[i]; let best=-1, sc0=-1, bt=0;
      for(let t=-R;t<=R;t+=0.5){ const v=bil(GG,w,h,p[0]+nx*t,p[1]+ny*t), sc=v*(1-0.6*Math.abs(t)/R); if(sc>sc0){ sc0=sc; best=v; bt=t; } }
      if(best<=th) return null; const a=bil(GG,w,h,p[0]+nx*(bt-0.5),p[1]+ny*(bt-0.5)), b=bil(GG,w,h,p[0]+nx*(bt+0.5),p[1]+ny*(bt+0.5)), den=a-2*best+b; return bt+(den<-1e-6?0.25*(a-b)/den:0); });
    /* медиана по соседям — выбросы (пересечение с другой линией, соседняя кривая) уходят; пропуски — по соседям */
    let m=off.map((_,i)=>median5(off,i)); for(let i=0;i<m.length;i++) if(m[i]==null){ let a=i-1, b=i+1; while(a>=0&&m[a]==null) a--; while(b<m.length&&m[b]==null) b++; m[i]=a>=0&&b<m.length?(m[a]+m[b])/2:a>=0?m[a]:b<m.length?m[b]:0; }
    m=m.map((v,i)=>(v+(m[i-1]!=null?m[i-1]:v)+(m[i+1]!=null?m[i+1]:v))/3);
    P=P.map((p,i)=>[p[0]+N[i][0]*m[i],p[1]+N[i][1]*m[i]]); P=resample(P,step); }
  /* чернила поперёк итоговой кривой (как along() у отрезков) */
  const N=normals(P), d1=Math.max(4,0.6*ppm), d2=Math.max(5,0.9*ppm), inkAt=(p,n)=>{ let m=0; for(let t=-1.5;t<=1.5;t+=0.5){ const v=bil(G,w,h,p[0]+n[0]*t,p[1]+n[1]*t); if(v>m) m=v; }
    const offv=(bil(G,w,h,p[0]+n[0]*d2,p[1]+n[1]*d2)+bil(G,w,h,p[0]-n[0]*d2,p[1]-n[1]*d2)+bil(G,w,h,p[0]+n[0]*d1,p[1]+n[1]*d1)+bil(G,w,h,p[0]-n[0]*d1,p[1]-n[1]*d1))/4; return m>D.thr*0.7&&m>offv*1.6+D.thr*0.25; };
  let ink=P.map((p,i)=>inkAt(p,N[i])?1:0);
  /* концы без чернил — модель продлила кривую дальше нарисованного: подрезка (по 3 образца без чернил подряд считаются концом) */
  const cut=Math.floor(P.length*0.35); let a=0, b=P.length-1; while(a<cut&&!(ink[a]&&ink[a+1])) a++; while(b>P.length-1-cut&&!(ink[b]&&ink[b-1])) b--;
  if(b-a<4) return {p:P,ink:ink.reduce((s,v)=>s+v,0)/P.length,moved:0,n:P.length,lost:true};
  P=P.slice(a,b+1); ink=ink.slice(a,b+1);
  /* продление по гребню: до 2 мм за каждым концом, направление — по последним точкам, поворот не больше 25° */
  const ext=(o.extend==null?2:o.extend)*ppm, grow=(Q,rev)=>{ const add=[]; let p=Q[Q.length-1], q=Q[Math.max(0,Q.length-4)], dx=p[0]-q[0], dy=p[1]-q[1], l=Math.hypot(dx,dy)||1; const d0=[dx/l,dy/l]; let d=d0.slice();
    for(let s=step;s<=ext;s+=step){ const c0=[p[0]+d[0]*step,p[1]+d[1]*step], n=[-d[1],d[0]]; let best=-1,bt=0; for(let t=-0.4*ppm;t<=0.4*ppm;t+=0.5){ const v=bil(G,w,h,c0[0]+n[0]*t,c0[1]+n[1]*t); if(v>best){ best=v; bt=t; } }
      const np=[c0[0]+n[0]*bt,c0[1]+n[1]*bt]; if(!inkAt(np,n)) break; const nd=[np[0]-p[0],np[1]-p[1]], nl=Math.hypot(nd[0],nd[1])||1; d=[nd[0]/nl,nd[1]/nl]; if(d[0]*d0[0]+d[1]*d0[1]<Math.cos(25*Math.PI/180)) break; add.push(np); p=np; }
    return add; };
  const tail=grow(P), head=grow(P.slice().reverse()); P=head.reverse().concat(P,tail); const inkN=ink.reduce((s,v)=>s+v,0)+head.length+tail.length;
  { let k=0; for(const q of P0){ let m=1e9; for(let i=1;i<P.length;i++){ const A=P[i-1], B=P[i], dx=B[0]-A[0], dy=B[1]-A[1], L=dx*dx+dy*dy||1e-9, t=Math.max(0,Math.min(1,((q[0]-A[0])*dx+(q[1]-A[1])*dy)/L)); m=Math.min(m,Math.hypot(q[0]-A[0]-t*dx,q[1]-A[1]-t*dy)); } moved+=m; k++; } moved/=Math.max(1,k); }
  return {p:resample(P,step),ink:inkN/P.length,moved,n:P.length,len:polyLen(P)}; }

/* ═══ привязка подписанных точек к геометрии ═══
   Модель называет точку с погрешностью в доли миллиметра — в пикселях это 1–3 px. Настоящая точка чертежа — конец отрезка или пересечение двух линий.
   snapPoints(points [[подпись,x,y]], segs [[x1,y1,x2,y2]], {ppm, radius}) → [[подпись,x,y,moved]]: точка переносится на ближайший конец отрезка
   или пересечение двух отрезков в радиусе radius мм (по умолчанию 2); нет такого рядом — остаётся как есть. */
function segIntersect(a,b){ const d1x=a[2]-a[0], d1y=a[3]-a[1], d2x=b[2]-b[0], d2y=b[3]-b[1], den=d1x*d2y-d1y*d2x; if(Math.abs(den)<1e-9) return null;
  const t=((b[0]-a[0])*d2y-(b[1]-a[1])*d2x)/den, u=((b[0]-a[0])*d1y-(b[1]-a[1])*d1x)/den; return {t,u,x:a[0]+t*d1x,y:a[1]+t*d1y}; }
function snapPoints(points,segs,o){ o=o||{}; const ppm=o.ppm||7, R=(o.radius||2)*ppm, ext=(o.extend==null?0.8:o.extend)*ppm; const cand=[];
  segs.forEach(s=>{ cand.push([s[0],s[1]],[s[2],s[3]]); });
  for(let i=0;i<segs.length;i++){ const a=segs[i], La=Math.hypot(a[2]-a[0],a[3]-a[1])||1; for(let j=i+1;j<segs.length;j++){ const b=segs[j], Lb=Math.hypot(b[2]-b[0],b[3]-b[1])||1, r=segIntersect(a,b); if(!r) continue;
      /* пересечение — на самих отрезках (с небольшим запасом: линии на бумаге заходят друг за друга или чуть не доходят) */
      if(r.t>=-ext/La&&r.t<=1+ext/La&&r.u>=-ext/Lb&&r.u<=1+ext/Lb) cand.push([r.x,r.y]); } }
  return points.map(([l,x,y])=>{ let best=null, bd=R; for(const c of cand){ const d=Math.hypot(c[0]-x,c[1]-y); if(d<bd){ bd=d; best=c; } } return best?[l,best[0],best[1],bd]:[l,x,y,0]; }); }

/* ═══ постановка подписанных точек на перекрёстки уточнённых линий (вместо «ближайший конец или пересечение») ═══
   Модель ставит точку с промахом 0,3–1 мм (иногда 2–4), а линии после притяжки к карандашу точны до ~0,15 мм поперёк. Вершина
   чертежа — место, где сходятся несколько линий (рёбра, линии связи, ось), поэтому:
     1. кандидаты — попарные пересечения уточнённых отрезков (с запасом ext за концами); опора кандидата — сколько линий
        проходит через него (ближе tol поперёк и в пределах отрезка + ext);
     2. для точки берутся все догадки (ответ основной модели, второй модели, их среднее): из кандидатов с опорой ≥ 2 в радиусе
        выбирается тот, у кого меньше «цена» = расстояние до ближайшей догадки − бонус за каждую линию сверх двух; дальний
        кандидат (до far мм) принимается, только если на нём сходятся ≥ 3 линии;
     3. положение — пересечение всех опорных линий по МНК (каждая линия — точна поперёк, поэтому три линии лучше двух);
     4. перекрёстка рядом нет — точка лишь сдвигается поперёк ближайшей линии на неё (вдоль линии модели верим), а на конце
        отрезка рядом — на конец.
   placePoints(points [[подпись,x,y]], segs [[x1,y1,x2,y2]] | [{p}], {ppm, alts: Map подпись → [[x,y],…], radius, far, tol}) →
     [[подпись, x, y, сдвиг px, опора (число линий; 1 — на линии, 0 — не тронута)]] */
/* вершины чертежа: перекрёстки уточнённых линий с опорой ≥ 2 (общее для placePoints и matchGiven) → {L, V:[{x,y,n}], along, perp, ext} */
function geomOf(segs,o){ const ppm=o.ppm||7, tol=(o.tol||0.4)*ppm, ext=(o.extend==null?1:o.extend)*ppm;
  const L=segs.map(s=>{ const p=s.p||s, dx=p[2]-p[0], dy=p[3]-p[1], len=Math.hypot(dx,dy)||1; return {p,ux:dx/len,uy:dy/len,len}; }).filter(l=>l.len>=1.5*ppm);
  const along=(l,x,y)=>(x-l.p[0])*l.ux+(y-l.p[1])*l.uy, perp=(l,x,y)=>(x-l.p[0])*l.uy-(y-l.p[1])*l.ux;
  const onLine=(l,x,y)=>{ const t=along(l,x,y); return Math.abs(perp(l,x,y))<=tol&&t>=-ext&&t<=l.len+ext; };
  /* опорные линии: попарно не почти параллельные (иначе это одна линия, нарисованная дважды) */
  const support=(x,y)=>{ const s=[]; L.forEach((l,i)=>{ if(onLine(l,x,y)&&!s.some(j=>Math.abs(L[j].ux*l.uy-L[j].uy*l.ux)<Math.sin(3*Math.PI/180))) s.push(i); }); return s; };
  const lsq=(ids,x0,y0)=>{ let a=0,b=0,c=0,r1=0,r2=0; ids.forEach(i=>{ const l=L[i], nx=l.uy, ny=-l.ux, d=nx*l.p[0]+ny*l.p[1]; a+=nx*nx; b+=nx*ny; c+=ny*ny; r1+=nx*d; r2+=ny*d; });
    const det=a*c-b*b; if(det<0.05*ids.length*ids.length*0.25) return [x0,y0]; return [(c*r1-b*r2)/det,(a*r2-b*r1)/det]; };
  const cand=[]; for(let i=0;i<L.length;i++) for(let j=i+1;j<L.length;j++){ const A=L[i], B=L[j], den=A.ux*B.uy-A.uy*B.ux; if(Math.abs(den)<Math.sin(3*Math.PI/180)) continue;
    const t=((B.p[0]-A.p[0])*B.uy-(B.p[1]-A.p[1])*B.ux)/den, x=A.p[0]+A.ux*t, y=A.p[1]+A.uy*t; if(!onLine(A,x,y)||!onLine(B,x,y)) continue;
    cand.push([x,y]); }
  /* кандидаты ближе tol — одна вершина: опора и МНК-положение считаются один раз */
  const V=[]; cand.forEach(([x,y])=>{ if(V.some(v=>Math.hypot(v.x0-x,v.y0-y)<tol)) return; const s=support(x,y); if(s.length<2) return; const q=lsq(s,x,y); V.push({x0:x,y0:y,x:q[0],y:q[1],n:s.length}); });
  return {L,V,along,perp,ext}; }
function placePoints(points,segs,o){ o=o||{}; const ppm=o.ppm||7, R=(o.radius||1.3)*ppm, FAR=(o.far||2.6)*ppm, alts=o.alts||new Map(), {L,V,along,perp,ext}=geomOf(segs,o);
  return points.map(([lb,x,y])=>{ const G=[[x,y]].concat(alts.get(lb)||[]);
    let best=null; V.forEach(v=>{ const d=Math.min(...G.map(g=>Math.hypot(g[0]-v.x,g[1]-v.y))); if(d>(v.n>=3?FAR:R)) return; const cost=d-0.45*ppm*Math.min(2,v.n-2); if(!best||cost<best.cost) best={v,cost,d}; });
    if(best) return [lb,best.v.x,best.v.y,Math.hypot(best.v.x-x,best.v.y-y),best.v.n];
    /* на одной линии: поперёк — на неё; у конца отрезка (в 0,8 мм) — на конец */
    let bl=null; L.forEach(l=>{ const t=along(l,x,y), e=Math.abs(perp(l,x,y)); if(e>0.7*ppm||t<-ext||t>l.len+ext) return; if(!bl||e<bl.e) bl={l,t,e}; });
    if(bl){ const l=bl.l, t=Math.abs(bl.t)<0.8*ppm?0:Math.abs(bl.t-l.len)<0.8*ppm?l.len:Math.max(0,Math.min(l.len,bl.t)), nx=l.p[0]+l.ux*t, ny=l.p[1]+l.uy*t; return [lb,nx,ny,Math.hypot(nx-x,ny-y),1]; }
    return [lb,x,y,0,0]; }); }

/* ═══ точки условия без подписей: форма заданной фигуры среди вершин чертежа ═══
   На мелком или бледном фото модель видит линии, но не читает подписи (или путает штрихи: ″ → ‴) — тогда к варианту не привязать.
   Если вариант уже известен (голос листа) и известен масштаб (px/мм соседних чертежей), заданные точки условия (мм чертежа)
   ищутся как фигура среди вершин (перекрёстков уточнённых линий):
     фронтальная проекция (pr 'f') — сдвиг по каждой паре «вершина ↔ точка», поворот ± 3°, масштаб ± 15 % (у чертежей одного
       листа px/мм расходятся до 14 %) — прикидка, затем подобие МНК по найденным парам; согласная точка — вершина ближе tol мм;
     горизонтальная (pr 'h') — та же фигура, но со свободным сдвигом вдоль линии связи: эпюр бывает безосный, и расстояние
       между проекциями — не по таблице варианта.
   Принимается, только если согласных ≥ minIn (6 из 8: случайно такая форма среди вершин не складывается), и другой кандидат
   (другое место) не так же хорош — иначе null: две копии пирамиды на чертеже — не угадывать.
   matchGiven(segs, G [{l, pr:'f'|'h', at:[x,y] мм}], {ppm — px/мм, tol, minIn}) → {pts:[[подпись,x,y]], inl, rmsMm, shift мм} | null */
function matchGiven(segs,G,o){ o=o||{}; const s0=o.ppm, tol=(o.tol||1.2)*s0, minIn=o.minIn||Math.min(6,G.length-1); if(!s0||G.length<4) return null;
  const {V}=geomOf(segs,{ppm:s0}); if(V.length<minIn) return null; const Gf=G.filter(g=>g.pr!=='h'), Gh=G.filter(g=>g.pr==='h'), hyp=[];
  /* ′ всегда ниже своей ″ (на линии связи): сдвиг не меньше −(наименьший зазор по таблице) + 2 мм — иначе проекции меняются местами */
  const base=l=>String(l).replace(/[″′]$/,''), gaps=Gh.map(h=>{ const f=Gf.find(q=>base(q.l)===base(h.l)); return f?h.at[1]-f.at[1]:null; }).filter(v=>v!=null), dlMin=gaps.length?-Math.min(...gaps)+2:-60;
  const near=(x,y,t,ban)=>{ let b=null, bd=t||tol; for(const w of V){ if(ban&&ban.has(w)) continue; const d=Math.hypot(w.x-x,w.y-y); if(d<bd){ bd=d; b=w; } } return b?{w:b,d:bd}:null; };
  /* подобие по парам (мм → px): x' = a·x − b·y + tx, y' = b·x + a·y + ty, МНК */
  const sim=P=>{ const n=P.length; let mx=0,my=0,px=0,py=0; P.forEach(([m,p])=>{ mx+=m[0]; my+=m[1]; px+=p[0]; py+=p[1]; }); mx/=n; my/=n; px/=n; py/=n;
    let sxx=0,sab=0,sba=0; P.forEach(([m,p])=>{ const u=m[0]-mx, v=m[1]-my, X=p[0]-px, Y=p[1]-py; sxx+=u*u+v*v; sab+=u*X+v*Y; sba+=u*Y-v*X; }); if(sxx<1e-9) return null;
    const a=sab/sxx, b=sba/sxx; return {a,b,tx:px-(a*mx-b*my),ty:py-(b*mx+a*my)}; };
  const ap=(T,m)=>[T.a*m[0]-T.b*m[1]+T.tx,T.b*m[0]+T.a*m[1]+T.ty];
  for(const dth of [-3,0,3]) for(const ks of [0.85,0.9,0.95,1,1.05,1.1,1.15]){ const th=dth*Math.PI/180, a0=Math.cos(th)*s0*ks, b0=Math.sin(th)*s0*ks, seen=new Set();
    V.forEach(v=>Gf.forEach(g=>{ let T={a:a0,b:b0,tx:0,ty:0}; const q0=ap(T,g.at); T.tx=v.x-q0[0]; T.ty=v.y-q0[1]; const key=Math.round(T.tx/tol)+','+Math.round(T.ty/tol); if(seen.has(key)) return; seen.add(key);
      /* фронтальная проекция: прикидка с допуском ×2 → подобие МНК по найденным парам → снова (масштаб сеткой с шагом 5 % — грубо: на 80 мм это 4 мм) */
      let mf=Gf.map(q=>{ const p=ap(T,q.at); return near(p[0],p[1],2*tol); });
      for(let it=0;it<2;it++){ const P=Gf.map((q,i)=>mf[i]?[q.at,[mf[i].w.x,mf[i].w.y]]:null).filter(Boolean); if(P.length<3) return; const T2=sim(P); if(!T2) return; const k=Math.hypot(T2.a,T2.b)/s0; if(k<0.8||k>1.2) return; T=T2; mf=Gf.map(q=>{ const p=ap(T,q.at); return near(p[0],p[1]); }); }
      const inf=mf.filter(Boolean).length; if(inf<Math.min(3,Gf.length)) return;
      /* горизонтальная проекция — та же фигура со свободным сдвигом вдоль линии связи (безосный эпюр) */
      /* вершины фронтальной проекции горизонтальной не достаются: иначе сдвиг «на z + y» кладёт A′ на A″, если у варианта таких точек две */
      const sc=Math.hypot(T.a,T.b), ux=-T.b/sc, uy=T.a/sc, HP=Gh.map(q=>ap(T,q.at)), ban=new Set(mf.filter(Boolean).map(q=>q.w)); let bh={inl:0,m:HP.map(()=>null),dl:0};
      const cands=new Set(); HP.forEach(q=>V.forEach(w=>{ if(ban.has(w)) return; const dx=w.x-q[0], dy=w.y-q[1], al=dx*ux+dy*uy, pe=Math.abs(dx*uy-dy*ux); if(pe<=tol&&Math.abs(al)<=60*s0&&al/sc>=dlMin) cands.add(Math.round(al/(0.25*s0))*0.25*s0); }));
      cands.forEach(dl=>{ const m=HP.map(q=>near(q[0]+ux*dl,q[1]+uy*dl,0,ban)), k=m.filter(Boolean).length; if(k>bh.inl||(k===bh.inl&&Math.abs(dl)<Math.abs(bh.dl))) bh={inl:k,m,dl}; });
      const m=mf.concat(bh.m), inl=inf+bh.inl; if(inl<minIn) return; const e2=m.reduce((acc,q)=>acc+(q?q.d*q.d:0),0);
      hyp.push({inl,rms:Math.sqrt(e2/inl),m:m.map(q=>q&&q.w),tx:T.tx,ty:T.ty,dl:bh.dl,sc}); })); }
  if(!hyp.length) return null; hyp.sort((a,b)=>b.inl-a.inl||a.rms-b.rms); const best=hyp[0], GG=Gf.concat(Gh);
  const rival=hyp.find(h=>Math.hypot(h.tx-best.tx,h.ty-best.ty)>3*tol); if(rival&&rival.inl>=best.inl) return null;
  return {pts:GG.map((g,i)=>best.m[i]?[g.l,best.m[i].x,best.m[i].y]:null).filter(Boolean),inl:best.inl,rmsMm:best.rms/s0,shift:+(best.dl/best.sc).toFixed(1)}; }

function refine(g,segs,o){ o=o||{}; const ppm=o.ppm||7, D=darkness(g,Object.assign({ppm},o)), res=[], dropped=[], inkMin=o.inkMin==null?0.45:o.inkMin;
  const snaps=segs.map((s,i)=>({s,i,r:snap(D,s,{ppm,radius:o.radius,extend:o.extend})}));
  /* фото надёжное, если большинство отрезков модели подтверждено карандашом: тогда отрезок без чернил — выдумка модели («как надо») и отбрасывается;
     на тёмном, смазанном фото бледные линии могут не проявиться — тогда отрезок остаётся как есть, с пометкой «не подтверждён» */
  const okN=snaps.filter(x=>x.r&&!x.r.lost&&x.r.ink>=inkMin).length, reliable=snaps.length?okN/snaps.length>=(o.reliable==null?0.8:o.reliable):false;
  const weak=[];
  snaps.forEach(({s,i,r})=>{ if(!r){ dropped.push({p:s.slice(0,4),why:'короткий',i}); return; }
    if(r.lost||r.ink<inkMin){ weak.push({p:s.slice(0,4),ink:r.ink,dash:!!s[4],i,drop:reliable}); return; }
    res.push({p:r.p,src:'model',ink:r.ink,moved:r.moved,dMid:r.dMid,dash:!!s[4],i}); });
  /* занято: пиксели у уже найденных отрезков (дальше 3 px от них — свободны) */
  const used=new Uint8Array(D.w*D.h), mark=p=>{ const L=Math.hypot(p[2]-p[0],p[3]-p[1]), n=Math.ceil(L); for(let k=0;k<=n;k++){ const x=p[0]+(p[2]-p[0])*k/n, y=p[1]+(p[3]-p[1])*k/n; for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){ const X=Math.round(x)+dx, Y=Math.round(y)+dy; if(X>=0&&Y>=0&&X<D.w&&Y<D.h) used[Y*D.w+X]=1; } } };
  res.forEach(r=>mark(r.p));
  /* кривые (L): по карандашу; без чернил — как отрезки: на надёжном фото выдумка отбрасывается, иначе «не подтверждена». Пиксели кривой заняты:
     Хаф не находит на ней прямых кусков, а поиск окружностей — дуг */
  const curves=[], droppedCurves=[];
  (o.curves||[]).forEach((c,i)=>{ const r=snapCurve(D,c,{ppm,radius:o.radius}); if(!r){ droppedCurves.push({p:c.p,why:'короткая',i}); return; }
    if(r.lost||r.ink<inkMin){ if(reliable&&r.ink<(o.emptyInk==null?0.12:o.emptyInk)){ droppedCurves.push({p:c.p,ink:r.ink,why:'на бумаге пусто',i}); return; }
      if(reliable&&r.ink<inkMin){ droppedCurves.push({p:c.p,ink:r.ink,why:'на бумаге нет',i}); return; }
      curves.push({p:c.p.map(q=>q.slice()),src:'model',ink:r.ink,moved:0,unverified:true,dash:!!c.dash,i,fromB:!!c.fromB}); return; }
    curves.push({p:r.p,src:'model',ink:r.ink,moved:r.moved,dash:!!c.dash,i,fromB:!!c.fromB}); });
  const markPoly=(P,M,k)=>{ for(let j=1;j<P.length;j++){ const a=P[j-1], b=P[j], L=Math.hypot(b[0]-a[0],b[1]-a[1]), n=Math.ceil(L); for(let q=0;q<=n;q++){ const x=a[0]+(b[0]-a[0])*q/n, y=a[1]+(b[1]-a[1])*q/n; for(let dy=-k;dy<=k;dy++) for(let dx=-k;dx<=k;dx++){ const X=Math.round(x)+dx, Y=Math.round(y)+dy; if(X>=0&&Y>=0&&X<D.w&&Y<D.h) M[Y*D.w+X]=1; } } } };
  curves.filter(c=>!c.unverified).forEach(c=>markPoly(c.p,used,3));
  /* искать пропущенное только там, где модель видела чертёж: рамка оставленных отрезков + 6 мм (край бумаги, рамка листа, клетка — не чертёж) */
  let found=[]; if(o.find!==false&&res.length){ const pad=(o.pad==null?6:o.pad)*ppm; let bx;
    if(o.region) bx=[o.region[0]-pad,o.region[1]-pad,o.region[2]+pad,o.region[3]+pad];   /* region — рамка подписанных точек чертежа (px): оси идут через весь лист, а чертёж — нет */
    else { const xs=res.flatMap(r=>[r.p[0],r.p[2]]), ys=res.flatMap(r=>[r.p[1],r.p[3]]); bx=[Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)+pad,Math.max(...ys)+pad]; }
    found=findMissing(D,used,{ppm,minLen:o.minLen,maxFind:o.maxFind,box:bx});
    /* найденное — добавка, а не основа копии: не больше доли от отрезков модели (плотные чертежи дают много случайных гребней); лучшие — длинные и чистые */
    { const cap=Math.max(3,Math.floor((o.findCap==null?0.35:o.findCap)*segs.length)); if(o.findCap!==0&&found.length>cap) found=found.map(f=>({f,sc:Math.hypot(f.p[2]-f.p[0],f.p[3]-f.p[1])*Math.min(1,f.ink)})).sort((a,b)=>b.sc-a.sc).slice(0,cap).map(x=>x.f); }
    /* карандаш — слабый контраст; линейка, край стола, чужие предметы — в разы темнее проверенных линий */
    const ref=res.filter(r=>!r.unverified&&r.src==='model').map(r=>meanG(D,r.p)).sort((a,b)=>a-b), med=ref.length?ref[ref.length>>1]:0;
    if(med>0) found=found.filter(f=>meanG(D,f.p)<=(o.maxContrast||2.2)*med);
    /* линия построения связана с чертежом: хоть один конец — у подписанной точки или у КОНЦА проверенного отрезка (построение
       начинается и кончается в точках). «Где-то на отрезке» мало: на бумаге в клетку линия клетки пересекает чертёж и проходила
       бы (настоящее фото 05.11: две клетки внизу листа стали «линиями чертежа»); штрихи текста висят отдельно */
    const vs=res.filter(r=>!r.unverified).map(r=>r.p), tol=(o.touch||3)*ppm, ends=vs.flatMap(p=>[[p[0],p[1]],[p[2],p[3]]]).concat(o.points||[]);
    /* и пересечения проверенных отрезков: линия построения часто кончается на пересечении, а не в подписанной точке */
    for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++){ const r=segIntersect(vs[i],vs[j]); if(r&&r.t>=-0.02&&r.t<=1.02&&r.u>=-0.02&&r.u<=1.02) ends.push([r.x,r.y]); }
    found=found.filter(f=>[[f.p[0],f.p[1]],[f.p[2],f.p[3]]].some(e=>ends.some(q=>Math.hypot(q[0]-e[0],q[1]-e[1])<=tol))); }
  /* слабый отрезок (чернил мало): выдумка модели («как надо»), если рядом найдена настоящая линия, заменяющая его; иначе — бледная настоящая, остаётся как есть */
  const near=(a,b)=>{ const ma=[(a[0]+a[2])/2,(a[1]+a[3])/2], mb=[(b[0]+b[2])/2,(b[1]+b[3])/2], d=Math.min(dSegPt(ma,b),dSegPt(mb,a)); let da=Math.abs(Math.atan2(a[3]-a[1],a[2]-a[0])-Math.atan2(b[3]-b[1],b[2]-b[0]))%Math.PI; da=Math.min(da,Math.PI-da)*180/Math.PI; return d<=(o.replaceDist||3)*ppm&&da<=(o.replaceAng||12); };
  weak.forEach(w=>{ if(w.drop&&(w.ink<(o.emptyInk==null?0.12:o.emptyInk)||found.some(f=>near(w.p,f.p)))) dropped.push({p:w.p,ink:w.ink,why:w.ink<(o.emptyInk==null?0.12:o.emptyInk)?'на бумаге пусто':'на бумаге нет, заменён найденной линией',i:w.i}); else res.push({p:w.p,src:'model',ink:w.ink,moved:0,unverified:true,dash:w.dash,i:w.i}); });
  /* окружности и дуги: ответ модели уточняется по карандашу; пропущенные — Хафом (o.findCircles) */
  const circ=[], droppedC=[];
  (o.circles||[]).forEach(c=>{ const r=snapCircle(D,c,{ppm,radius:o.radius}); if(!r){ droppedC.push(c); return; }
    const q=r.full?r.ink:(r.inkRun||0); if(q<0.3||(r.span||0)<20){ droppedC.push(Object.assign({ink:q,why:'на бумаге нет'},c)); return; }
    circ.push({cx:r.cx,cy:r.cy,r:r.r,a1:r.a1,a2:r.a2,full:!!r.full,span:r.span,ink:r.ink,src:'model',dash:!!c.dash,unverified:q<0.55}); });
  if(o.findCircles){ const usedC=new Uint8Array(D.w*D.h); curves.filter(c=>!c.unverified).forEach(c=>markPoly(c.p,usedC,2)); res.forEach(r=>{ const L=Math.hypot(r.p[2]-r.p[0],r.p[3]-r.p[1]), n=Math.ceil(L); for(let k=0;k<=n;k++){ const x=r.p[0]+(r.p[2]-r.p[0])*k/n, y=r.p[1]+(r.p[3]-r.p[1])*k/n; for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){ const X=Math.round(x)+dx, Y=Math.round(y)+dy; if(X>=0&&Y>=0&&X<D.w&&Y<D.h) usedC[Y*D.w+X]=1; } } });
    findCircles(D,usedC,{ppm,box:o.region?[o.region[0]-6*ppm,o.region[1]-6*ppm,o.region[2]+6*ppm,o.region[3]+6*ppm]:null,maxFind:o.maxFindCircles}).forEach(c=>{ if(!circ.some(m=>Math.hypot(m.cx-c.cx,m.cy-c.cy)<1.5*ppm&&Math.abs(m.r-c.r)<1.5*ppm)) circ.push(c); }); }
  return {segs:res.concat(found),circles:circ,droppedCircles:droppedC,curves,droppedCurves,dropped,stats:{model:segs.length,kept:res.length,unverified:res.filter(r=>r.unverified).length,reliable,dropped:dropped.length,found:found.length,thr:D.thr,curves:curves.length,curvesUnv:curves.filter(c=>c.unverified).length,curvesDropped:droppedCurves.length}}; }
put({refine,darkness,snap,findMissing,snapCircle,findCircles,ringInk,snapPoints,placePoints,matchGiven,snapCurve,resample,polyLen});
})();
