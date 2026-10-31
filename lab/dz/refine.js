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
function snap(D,seg,o){ const {G,w,h}=D, thr=D.thr*(o.soft==null?0.6:o.soft), ppm=o.ppm||7; let [x1,y1,x2,y2]=seg; const L0=Math.hypot(x2-x1,y2-y1); if(L0<2) return null;
  let line={x:(x1+x2)/2,y:(y1+y2)/2,dx:(x2-x1)/L0,dy:(y2-y1)/L0}, R=(o.radius||2.5)*ppm, ext=0, pts=[];
  const s0=-L0/2*0.96, s1=L0/2*0.96;
  for(let it=0;it<4;it++){ pts=[]; const nx=-line.dy, ny=line.dx;
    for(let s=s0;s<=s1;s+=1){ const cx=line.x+line.dx*s, cy=line.y+line.dy*s; let best=-1, bt=0;
      for(let t=-R;t<=R;t+=0.5){ const v=bil(G,w,h,cx+nx*t,cy+ny*t); if(v>best){ best=v; bt=t; } }
      if(best>thr){ /* субпиксельно: парабола по трём точкам */
        const a=bil(G,w,h,cx+nx*(bt-0.5),cy+ny*(bt-0.5)), c=bil(G,w,h,cx+nx*(bt+0.5),cy+ny*(bt+0.5)), den=a-2*best+c, sub=den<-1e-6?0.5*(a-c)/den*0.5:0;
        pts.push({x:cx+nx*(bt+sub),y:cy+ny*(bt+sub),w:best,t:bt}); } }
    if(pts.length<Math.max(6,L0*0.2)) return {p:seg.slice(0,4),ink:pts.length/Math.max(1,(s1-s0)),moved:0,n:pts.length,lost:true};
    /* выбросы: сначала по расстоянию до прямой, потом по её МНК */
    let f=tls(pts), keep=pts;
    for(let k=0;k<3;k++){ const nn=-f.dy, mm=f.dx, r=keep.map(c=>Math.abs((c.x-f.x)*nn+(c.y-f.y)*mm)); const s=r.slice().sort((a,b)=>a-b)[Math.floor(r.length*0.6)]||0.5, lim=Math.max(1.2,2.5*s);
      keep=keep.filter((c,i)=>r[i]<=lim); if(keep.length<6) break; f=tls(keep); }
    if(keep.length<6) return {p:seg.slice(0,4),ink:keep.length/Math.max(1,(s1-s0)),moved:0,n:keep.length,lost:true};
    if(f.dx*line.dx+f.dy*line.dy<0){ f.dx=-f.dx; f.dy=-f.dy; }
    line=f; R=Math.max(1.2*ppm*0.5,R*0.5); pts=keep; }
  /* чернила вдоль уточнённой прямой: на каждом шаге вдоль s — есть ли гребень ближе 1,5 px; концы: по первому/последнему чернильному месту */
  const sOf=(x,y)=>(x-line.x)*line.dx+(y-line.y)*line.dy, nx=-line.dy, ny=line.dx, along=(s)=>{ const cx=line.x+line.dx*s, cy=line.y+line.dy*s; let m=0; for(let t=-1.5;t<=1.5;t+=0.5){ const v=bil(G,w,h,cx+nx*t,cy+ny*t); if(v>m) m=v; }
    /* локальный контраст: линия темнее соседних полос (±4…6 px) заметно, а не просто выше общего порога; в тени и на зерне порог плывёт, соседи — нет */
    const off=(bil(G,w,h,cx+nx*5,cy+ny*5)+bil(G,w,h,cx-nx*5,cy-ny*5)+bil(G,w,h,cx+nx*4,cy+ny*4)+bil(G,w,h,cx-nx*4,cy-ny*4))/4; return m>thr*0.7&&m>off*1.6+thr*0.25; };
  const A=sOf(x1,y1), B=sOf(x2,y2), lo=Math.min(A,B), hi=Math.max(A,B), ink=[];
  for(let s=lo;s<=hi;s+=1) ink.push(along(s)?1:0);
  const frac=ink.reduce((a,b)=>a+b,0)/Math.max(1,ink.length);
  /* штриховая и обычная: допустим разрывы до 4 мм, концы — по крайним чернильным местам, продление до 2 мм */
  const gap=Math.round(4*ppm); let first=ink.indexOf(1), last=ink.lastIndexOf(1); if(first<0) return {p:seg.slice(0,4),ink:0,moved:0,n:pts.length,lost:true};
  let sLo=lo+first, sHi=lo+last; const maxExt=(o.extend==null?2:o.extend)*ppm;
  for(let e=1;e<=maxExt;e++){ if(along(sLo-1)) sLo-=1; else break; } for(let e=1;e<=maxExt;e++){ if(along(sHi+1)) sHi+=1; else break; }
  void gap;
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
  /* искать пропущенное только там, где модель видела чертёж: рамка оставленных отрезков + 6 мм (край бумаги, рамка листа, клетка — не чертёж) */
  let found=[]; if(o.find!==false&&res.length){ const pad=(o.pad==null?6:o.pad)*ppm; let bx;
    if(o.region) bx=[o.region[0]-pad,o.region[1]-pad,o.region[2]+pad,o.region[3]+pad];   /* region — рамка подписанных точек чертежа (px): оси идут через весь лист, а чертёж — нет */
    else { const xs=res.flatMap(r=>[r.p[0],r.p[2]]), ys=res.flatMap(r=>[r.p[1],r.p[3]]); bx=[Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)+pad,Math.max(...ys)+pad]; }
    found=findMissing(D,used,{ppm,minLen:o.minLen,maxFind:o.maxFind,box:bx});
    /* карандаш — слабый контраст; линейка, край стола, чужие предметы — в разы темнее проверенных линий */
    const ref=res.filter(r=>!r.unverified&&r.src==='model').map(r=>meanG(D,r.p)).sort((a,b)=>a-b), med=ref.length?ref[ref.length>>1]:0;
    if(med>0) found=found.filter(f=>meanG(D,f.p)<=(o.maxContrast||2.2)*med);
    /* линия построения связана с чертежом: хоть один конец у проверенного отрезка или у подписанной точки (штрихи текста висят отдельно) */
    const touch=res.filter(r=>!r.unverified).map(r=>r.p), tp=(o.points||[]), tol=(o.touch||3)*ppm;
    found=found.filter(f=>[[f.p[0],f.p[1]],[f.p[2],f.p[3]]].some(e=>touch.some(t=>dSegPt(e,t)<=tol)||tp.some(q=>Math.hypot(q[0]-e[0],q[1]-e[1])<=tol))); }
  /* слабый отрезок (чернил мало): выдумка модели («как надо»), если рядом найдена настоящая линия, заменяющая его; иначе — бледная настоящая, остаётся как есть */
  const near=(a,b)=>{ const ma=[(a[0]+a[2])/2,(a[1]+a[3])/2], mb=[(b[0]+b[2])/2,(b[1]+b[3])/2], d=Math.min(dSegPt(ma,b),dSegPt(mb,a)); let da=Math.abs(Math.atan2(a[3]-a[1],a[2]-a[0])-Math.atan2(b[3]-b[1],b[2]-b[0]))%Math.PI; da=Math.min(da,Math.PI-da)*180/Math.PI; return d<=(o.replaceDist||3)*ppm&&da<=(o.replaceAng||12); };
  weak.forEach(w=>{ if(w.drop&&found.some(f=>near(w.p,f.p))) dropped.push({p:w.p,ink:w.ink,why:'на бумаге нет, заменён найденной линией',i:w.i}); else res.push({p:w.p,src:'model',ink:w.ink,moved:0,unverified:true,dash:w.dash,i:w.i}); });
  return {segs:res.concat(found),dropped,stats:{model:segs.length,kept:res.length,unverified:res.filter(r=>r.unverified).length,reliable,dropped:dropped.length,found:found.length,thr:D.thr}}; }
put({refine,darkness,snap,findMissing});
})();
