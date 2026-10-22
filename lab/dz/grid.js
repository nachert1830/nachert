/* ═══════════ Клетчатая бумага: сетка → плоский «скан» листа в мм ═══════════
   Чертёж от руки на листе в клетку (тетрадь, экзаменационный лист). Рамки и штампа нет, зато есть сетка 5 мм —
   сотни опорных узлов с известными координатами. По ним снимок выпрямляется точнее, чем по рамке: перспектива,
   наклон телефона и даже изогнутый, неровно лежащий лист уходят в карту «узел (i, j) → px».
   1. Карта тёмности (lab/clean.js); тонкие тёмные линии — тёмность минус размытая (σ 3 px).
   2. Хаф по всем направлениям: два семейства прямых сетки (самые острые пики, второе — около первого + 90°),
      шаг — автокорреляция профиля.
   3. Узлы — ростом от центра снимка: положение узла предсказывается по уже найденным соседям (линейное
      продолжение: лист может гнуться, но плавно), затем уточняется двумя одномерными поисками — где линия сетки
      каждого семейства проходит у предсказания (сумма тёмности вдоль короткого отрезка линии). Поиск — в окне
      ±0,22 клетки: линия чертежа, параллельная сетке, дальше не уводит. Узел без линии — пропуск.
   4. Карта мм листа → px: билинейно по ячейке из четырёх найденных узлов; где узла нет — по гомографии ближайших.
   5. «Скан»: снимок, пересчитанный в мм листа (ppm px/мм); сетка на нём — ровно по кратным 5 мм, её легко стереть.
   findGrid(img) → {ok, cell, ppm0 (px/мм снимка), nodes, rms (гладкость сетки, px), map(u,v) → px, box (мм), dbg}
   rectify(img, g, {ppm}) → {img, box, ppm, H (мм листа → px скана)};  eraseGrid(scan) → скан без сетки. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('../'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const IMG=lab('img'), CL=lab('clean'), H=IMG.H;

/* карта «тонкие тёмные линии» полного разрешения */
function lineMap(img){ const ink=CL.ink(img).ink, b=IMG.blur(ink,3), n=ink.w*ink.h, r=IMG.gray(ink.w,ink.h);
  for(let i=0;i<n;i++) r.a[i]=Math.max(0,ink.a[i]-b.a[i]); return {r,ink}; }
/* направления и шаг сетки: Хаф по уменьшенной карте */
function directions(r){ const F=2, s=IMG.shrink(r,F), w=s.w, h=s.h;
  const smp=[]; for(let i=0;i<w*h;i+=13) smp.push(s.a[i]); smp.sort((a,c)=>a-c); const thr=Math.max(0.005,smp[Math.floor(0.85*smp.length)]);
  const P=[]; for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const v=s.a[y*w+x]; if(v>thr) P.push(x,y,v); }
  if(P.length<3000) return null;
  const TH=900, dth=Math.PI/TH, R=Math.ceil(Math.hypot(w,h)), NR=2*R+1, acc=new Float32Array(TH*NR), cs=new Float64Array(TH), sn=new Float64Array(TH);
  for(let t=0;t<TH;t++){ cs[t]=Math.cos(t*dth); sn[t]=Math.sin(t*dth); }
  for(let k=0;k<P.length;k+=3){ const x=P[k], y=P[k+1], v=P[k+2]; for(let t=0;t<TH;t++) acc[t*NR+Math.round(x*cs[t]+y*sn[t])+R]+=v; }
  const sc=new Float64Array(TH); for(let t=0;t<TH;t++){ let q=0; for(let i=0;i<NR;i++){ const a=acc[t*NR+i]; q+=a*a; } sc[t]=q; }
  let t1=0; for(let t=1;t<TH;t++) if(sc[t]>sc[t1]) t1=t;
  let t2=-1; for(let d=-60;d<=60;d++){ const t=(t1+TH/2+d+TH)%TH; if(t2<0||sc[t]>sc[t2]) t2=t; }
  /* шаг — наименьший сдвиг с автокорреляцией ≥ 0,8 от лучшей: через линию корреляция бывает и выше (каждая вторая
     линия сетки ярче), и тогда «шаг» вышел бы двойным */
  /* шаг — по автокорреляции профиля без медленной составляющей (край листа, тень дают «ступеньку», и тогда
     корреляция высока при любом сдвиге); из пиков ≥ 0,8 лучшего — наименьший (через линию бывает и выше) */
  const period=tf=>{ const row0=acc.subarray(tf*NR,(tf+1)*NR), row=new Float64Array(NR), Wm=45; let acc0=0; const cs0=new Float64Array(NR+1); for(let i=0;i<NR;i++){ acc0+=row0[i]; cs0[i+1]=acc0; }
    for(let i=0;i<NR;i++){ const a=Math.max(0,i-Wm), b=Math.min(NR,i+Wm+1); row[i]=row0[i]-(cs0[b]-cs0[a])/(b-a); }
    let sp=0, bv=-Infinity; const ac=[];
    for(let l=6;l<90;l++){ let q=0; for(let i=0;i+l<NR;i++) q+=row[i]*row[i+l]; ac[l]=q; if(q>bv){ bv=q; sp=l; } }
    for(let l=7;l<sp;l++){ if(ac[l]>=0.8*bv&&ac[l]>=ac[l-1]&&ac[l]>=ac[l+1]){ sp=l; break; } }
    return sp*F; };
  /* нормали семейств → направления линий: e1 — «горизонтальные» линии сетки (вдоль них i растёт), e2 — «вертикальные» */
  const nA=[cs[t1],sn[t1]], nB=[cs[t2],sn[t2]], dA=[-nA[1],nA[0]], dB=[-nB[1],nB[0]];
  let e1=Math.abs(dA[0])>=Math.abs(dB[0])?dA:dB, e2=e1===dA?dB:dA; const firstIsA=e1===dA; const s1=e1===dA?period(t1):period(t2), s2=e1===dA?period(t2):period(t1);
  if(e1[0]<0) e1=[-e1[0],-e1[1]]; if(e2[1]<0) e2=[-e2[0],-e2[1]];
  /* клетка квадратная: шаги семейств равны (перспектива — до ~15 %) */
  let a1=s1, a2=s2; /* сильно разные — у одного семейства профиль размыт перспективой: клетка квадратная, берём шаг семейства с самым
     острым пиком Хафа (первого найденного), рост узлов дальше сам подстроит шаг */
  if(Math.max(a1,a2)/Math.min(a1,a2)>1.3){ const best=firstIsA?a1:a2; a1=a2=best;   /* шаг семейства t1 (самый острый пик Хафа) */ }
  return {e1,e2,sp:(a1+a2)/2,s1:a1,s2:a2,t1:t1*0.2,t2:t2*0.2}; }
/* тёмность вдоль отрезка линии сетки: центр c, направление линии e, сдвиг d по нормали nn, полудлина L */
function lineSum(r,c,e,nn,d,L){ let s=0; for(let t=-L;t<=L;t+=1){ const x=c[0]+e[0]*t+nn[0]*d, y=c[1]+e[1]*t+nn[1]*d, v=IMG.sample(r,x,y); if(v!=null) s+=v; } return s; }
/* где линия сетки у точки c: поиск сдвига по нормали в окне ±win px, парабола у максимума */
function snap(r,c,e,win,L){ const nn=[-e[1],e[0]], prof=[]; let bi=0;
  for(let d=-win;d<=win;d+=0.5){ const v=lineSum(r,c,e,nn,d,L); prof.push(v); if(v>prof[bi]) bi=prof.length-1; }
  if(bi===0||bi===prof.length-1) return null; const a=prof[bi-1], b=prof[bi], cc=prof[bi+1], den=a-2*b+cc, off=den<0?0.5*(a-cc)/den*0.5:0;
  const srt=prof.slice().sort((p,q)=>p-q), med=srt[srt.length>>1];
  return {d:-win+bi*0.5+off,v:b,contrast:b-med}; }

function findGrid(img,o){ o=o||{}; const cell=o.cell||5, dbg=[], W=img.width, Hh=img.height;
  const {r}=lineMap(img), D=directions(r); if(!D) return {ok:false,reason:'на снимке не видно сетки клеток',dbg};
  dbg.push('семейства: '+D.t1.toFixed(1)+'° и '+D.t2.toFixed(1)+'°, шаг ≈ '+D.s1+' и '+D.s2+' px');
  const sp=D.sp, L=Math.round(0.38*sp), key=(i,j)=>i+','+j, N=new Map();
  /* затравка: самый контрастный узел у центра (поиск по обоим семействам в окне ±0,5 клетки) */
  let seed=null;
  for(let dy=-sp;dy<=sp;dy+=sp/2) for(let dx=-sp;dx<=sp;dx+=sp/2){ const c=[W/2+dx,Hh/2+dy], a=snap(r,c,D.e1,0.55*sp,L), b=snap(r,c,D.e2,0.55*sp,L); if(!a||!b) continue;
    const p=[c[0]+(-D.e1[1])*a.d+(-D.e2[1])*b.d,c[1]+D.e1[0]*a.d+D.e2[0]*b.d], sc=a.contrast+b.contrast; if(!seed||sc>seed.sc) seed={p,sc}; }
  if(!seed) return {ok:false,reason:'не нашёл узлов сетки',dbg};
  N.set(key(0,0),{i:0,j:0,p:seed.p,v:seed.sc});
  const typical=[seed.sc];
  /* рост: очередь кандидатов; предсказание — по соседям */
  const pred=(i,j)=>{ const g=(a,b)=>N.get(key(a,b)); const ps=[];
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([di,dj])=>{ const a=g(i-di,j-dj), b=g(i-2*di,j-2*dj); if(a&&b) ps.push([2*a.p[0]-b.p[0],2*a.p[1]-b.p[1]]);
      else if(a){ const e=di?D.e1:D.e2, s=di?D.s1:D.s2, sg=di||dj; ps.push([a.p[0]+e[0]*s*sg,a.p[1]+e[1]*s*sg]); } });
    if(!ps.length) return null; return [ps.reduce((m,p)=>m+p[0],0)/ps.length,ps.reduce((m,p)=>m+p[1],0)/ps.length]; };
  const locDir=(i,j,ax)=>{ const g=(a,b)=>N.get(key(a,b)); const A=ax?g(i,j-1):g(i-1,j), B=ax?g(i,j+1):g(i+1,j), C=ax?g(i,j-2):g(i-2,j);
    const e=ax?D.e2:D.e1; let v=null; if(A&&B) v=[B.p[0]-A.p[0],B.p[1]-A.p[1]]; else if(A&&C) v=[A.p[0]-C.p[0],A.p[1]-C.p[1]]; if(!v) return e; const l=Math.hypot(...v); return [v[0]/l,v[1]/l]; };
  const queue=[[1,0],[-1,0],[0,1],[0,-1]], seen=new Set([key(0,0)]); queue.forEach(q=>seen.add(key(...q)));
  const miss=new Map();
  while(queue.length){ const [i,j]=queue.shift(), c=pred(i,j); if(!c) continue; if(c[0]<L||c[1]<L||c[0]>W-L||c[1]>Hh-L) continue;
    const e1=locDir(i,j,0), e2=locDir(i,j,1), a=snap(r,c,e1,0.22*sp,L), b=snap(r,c,e2,0.22*sp,L);
    const tv=typical.slice().sort((p,q)=>p-q)[typical.length>>1];
    /* линия сетки: ровный и заметный пик в обоих семействах (≥ 30 % типичного узла) */
    if(a&&b&&a.contrast+b.contrast>=0.3*tv&&a.contrast>0.1*tv&&b.contrast>0.1*tv){ const n1=[-e1[1],e1[0]], n2=[-e2[1],e2[0]];
      /* пересечение двух найденных линий: c + n1·a.d — на линии семейства 1, c + n2·b.d — на линии семейства 2 */
      const P1=[c[0]+n1[0]*a.d,c[1]+n1[1]*a.d], P2=[c[0]+n2[0]*b.d,c[1]+n2[1]*b.d], dd=e1[0]*e2[1]-e1[1]*e2[0], w2=[P2[0]-P1[0],P2[1]-P1[1]], t=(w2[0]*e2[1]-w2[1]*e2[0])/dd;
      const p=[P1[0]+e1[0]*t,P1[1]+e1[1]*t]; N.set(key(i,j),{i,j,p,v:a.contrast+b.contrast}); if(typical.length<400) typical.push(a.contrast+b.contrast);
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([di,dj])=>{ const k=key(i+di,j+dj); if(!seen.has(k)){ seen.add(k); queue.push([i+di,j+dj]); } }); }
    else { /* пропуск: соседей не добавляем — рост обходит дыру с других сторон (под линией чертежа узел часто есть) */ miss.set(key(i,j),1); } }
  if(N.size<40) return {ok:false,reason:'сетка клеток не читается (узлов '+N.size+')',dbg};
  /* гладкость: узел против среднего его соседей (вторая разность); выбросы > 1,5 px — убираем, это сбой поиска */
  let rms=0, nr=0; const bad=[];
  N.forEach(q=>{ const g=(a,b)=>N.get(key(a,b)); const ps=[]; const L1=g(q.i-1,q.j), R1=g(q.i+1,q.j), U1=g(q.i,q.j-1), D1=g(q.i,q.j+1);
    if(L1&&R1) ps.push([(L1.p[0]+R1.p[0])/2,(L1.p[1]+R1.p[1])/2]); if(U1&&D1) ps.push([(U1.p[0]+D1.p[0])/2,(U1.p[1]+D1.p[1])/2]);
    if(!ps.length) return; const m=[ps.reduce((s,p)=>s+p[0],0)/ps.length,ps.reduce((s,p)=>s+p[1],0)/ps.length], e=Math.hypot(q.p[0]-m[0],q.p[1]-m[1]);
    if(e>1.5) bad.push(key(q.i,q.j)); else { rms+=e*e; nr++; } });
  bad.forEach(k=>N.delete(k)); rms=Math.sqrt(rms/Math.max(1,nr));
  /* сбой номера (рост «перескочил» на соседнюю линию — целая область сдвинута на клетку): лист гнётся плавно, на
     доли клетки, а сбой — ровно на клетку. Устойчивая гомография по всем узлам (итерации с отбросом > 0,3 клетки):
     узлы дальше 0,3 клетки от неё — сбой, их нет */
  let slip=0; { let keep=[...N.values()], Hr=null;
    for(let it=0;it<5;it++){ Hr=H.fit(keep.map(q=>[q.i*cell,q.j*cell]),keep.map(q=>q.p)); if(!Hr) break; const res=q=>{ const p=H.apply(Hr,[q.i*cell,q.j*cell]); return Math.hypot(p[0]-q.p[0],p[1]-q.p[1]); };
      const all=[...N.values()], lim=Math.max(0.3*sp,4*Math.sqrt(keep.reduce((m,q)=>m+res(q)**2,0)/keep.length)); keep=all.filter(q=>res(q)<=Math.min(lim,0.3*sp)); }
    /* отбрасываем, только если согласное большинство (иначе сбой — не «меньшинство», а сама сетка не та) */
    if(Hr&&keep.length>=Math.max(40,0.6*N.size)){ const ks=new Set(keep.map(q=>key(q.i,q.j))); [...N.keys()].forEach(k=>{ if(!ks.has(k)){ N.delete(k); slip++; } }); }
    else if(Hr) return {ok:false,reason:'сетка клеток читается неоднозначно (номера линий не сходятся) — переснимите ровнее',dbg}; }
  if(slip) dbg.push('сбой номера у '+slip+' узлов (сдвиг на клетку) — убраны');
  const all=[...N.values()], is=all.map(q=>q.i), js=all.map(q=>q.j), i0=Math.min(...is), i1=Math.max(...is), j0=Math.min(...js), j1=Math.max(...js);
  /* глобальная гомография — для мест без узлов и как проверка */
  const Hg=H.fit(all.map(q=>[q.i*cell,q.j*cell]),all.map(q=>q.p)); if(!Hg) return {ok:false,reason:'гомография по сетке не сошлась',dbg};
  const hres=Math.sqrt(all.reduce((s,q)=>{ const p=H.apply(Hg,[q.i*cell,q.j*cell]); return s+(p[0]-q.p[0])**2+(p[1]-q.p[1])**2; },0)/all.length);
  dbg.push('узлов '+N.size+' (отброшено '+bad.length+'), клеток '+(i1-i0)+' × '+(j1-j0)+'; гладкость '+rms.toFixed(2)+' px; одна гомография дала бы '+hres.toFixed(2)+' px');
  /* недостающие узлы в пределах найденных — по гомографии 12 ближайших найденных */
  /* у края сетки 12 ближайших узлов почти на одной прямой — гомография по ним плохо обусловлена поперёк; берём 40 */
  const near=(i,j)=>all.map(q=>({q,d:(q.i-i)**2+(q.j-j)**2})).sort((a,b)=>a.d-b.d).slice(0,40).map(x=>x.q);
  const node=(i,j)=>{ const q=N.get(key(i,j)); if(q) return q.p; const nb=near(i,j); if(nb.length<6) return H.apply(Hg,[i*cell,j*cell]);
    const Hl=H.fit(nb.map(q=>[q.i*cell,q.j*cell]),nb.map(q=>q.p)); const p=Hl?H.apply(Hl,[i*cell,j*cell]):H.apply(Hg,[i*cell,j*cell]); N.set(key(i,j),{i,j,p,fill:true}); return p; };
  /* мм листа → px: билинейно по ячейке */
  /* за сеткой (лист без клеток: печатный бланк, поля) — продолжение по ближайшим узлам, до 12 клеток */
  const map=(u,v)=>{ const x=u/cell, y=v/cell, i=Math.floor(x), j=Math.floor(y), fx=x-i, fy=y-j;
    if(i<i0-12||i>=i1+12||j<j0-12||j>=j1+12) return H.apply(Hg,[u,v]);
    const a=node(i,j), b=node(i+1,j), c=node(i,j+1), d=node(i+1,j+1);
    return [(a[0]*(1-fx)+b[0]*fx)*(1-fy)+(c[0]*(1-fx)+d[0]*fx)*fy,(a[1]*(1-fx)+b[1]*fx)*(1-fy)+(c[1]*(1-fx)+d[1]*fx)*fy]; };
  const c=map(0,0), c1=map(1,0), found=new Set(all.map(q=>key(q.i,q.j)));
  /* поле снимка в мм листа (через обратную глобальную гомографию), не дальше 12 клеток от сетки */
  const Hi=H.inv(Hg), cs=[[0,0],[W,0],[W,Hh],[0,Hh]].map(p=>H.apply(Hi,p)), lim=12*cell;
  const pbox=[Math.max(i0*cell-lim,Math.min(...cs.map(p=>p[0]))),Math.max(j0*cell-lim,Math.min(...cs.map(p=>p[1]))),Math.min(i1*cell+lim,Math.max(...cs.map(p=>p[0]))),Math.min(j1*cell+lim,Math.max(...cs.map(p=>p[1])))].map(v=>Math.round(v));
  return {ok:true,found,gridAt:(u,v)=>found.has(key(Math.round(u/cell),Math.round(v/cell))),photoBox:pbox,cell,ppm0:Math.hypot(c1[0]-c[0],c1[1]-c[1]),nodes:N.size-0,found:all.length,rms,hres,map,Hg,box:[i0*cell,j0*cell,i1*cell,j1*cell],dirs:D,dbg}; }

/* «скан»: снимок в мм листа, ppm px/мм; белое там, где сетки нет */
function rectify(img,g,o){ o=o||{}; const ppm=o.ppm||10, box=o.box||g.photoBox||g.box, w=Math.round((box[2]-box[0])*ppm), h=Math.round((box[3]-box[1])*ppm), out=IMG.rgba(w,h), d=img.data, W=img.width, Hh=img.height;
  for(let y=0;y<h;y++){ const v=box[1]+(y+0.5)/ppm; for(let x=0;x<w;x++){ const u=box[0]+(x+0.5)/ppm, p=g.map(u,v), X=p[0]-0.5, Y=p[1]-0.5, x0=Math.floor(X), y0=Math.floor(Y), o4=(y*w+x)*4;
    out.data[o4+3]=255; if(x0<0||y0<0||x0>=W-1||y0>=Hh-1){ out.data[o4]=out.data[o4+1]=out.data[o4+2]=255; continue; } const fx=X-x0, fy=Y-y0;
    for(let ch=0;ch<3;ch++){ const i00=(y0*W+x0)*4+ch, a=d[i00], b=d[i00+4], c=d[i00+W*4], e=d[i00+W*4+4]; out.data[o4+ch]=Math.round((a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+e*fx)*fy); } } }
  return {img:out,box,ppm,gridAt:g.gridAt,H:[ppm,0,-box[0]*ppm,0,ppm,-box[1]*ppm,0,0,1]}; }

/* стереть сетку на скане: линия сетки — ровно по кратным клетке; пиксель в полосе ±half мм, не темнее типичной
   линии сетки в своём квадрате 4 × 4 клетки (×1,35 + запас), становится фоном бумаги. Линия чертежа, идущая по
   линии сетки, темнее её и остаётся; бледная — может пропасть, поэтому по линиям сетки ничего не утверждаем без
   второго подтверждения (это делает калибровка по всей фигуре) */
function eraseGrid(sc,o){ o=o||{}; const {img,box,ppm}=sc, W=img.width, Hh=img.height, cell=o.cell||5, half=o.half||0.6, NB=12, out=IMG.rgba(W,Hh); out.data.set(img.data);
  const ink=CL.ink(img).ink.a, dist=new Float32Array(W*Hh);
  for(let y=0;y<Hh;y++){ const v=box[1]+(y+0.5)/ppm, fv=Math.abs(v/cell-Math.round(v/cell))*cell; for(let x=0;x<W;x++){ const u=box[0]+(x+0.5)/ppm, fu=Math.abs(u/cell-Math.round(u/cell))*cell; dist[y*W+x]=Math.min(fu,fv); } }
  /* профиль линии сетки поперёк (тёмность от расстояния до линии, шаг 0,05 мм) — медиана в квадрате 4 × 4 клетки:
     линия чертежа занимает малую долю пикселей квадрата и медиану не сдвигает */
  const BS=Math.round(cell*4*ppm), bw=Math.ceil(W/BS), bh=Math.ceil(Hh/BS), bins=Array.from({length:bw*bh*NB},()=>[]);
  for(let y=0;y<Hh;y+=1) for(let x=0;x<W;x+=1){ const i=y*W+x, k=Math.floor(dist[i]/half*NB); if(k>=NB) continue; const bl=((y/BS)|0)*bw+((x/BS)|0); if((x+y)%2===0) bins[bl*NB+k].push(ink[i]); }
  const prof=new Float32Array(bw*bh*NB), md=a=>{ if(a.length<15) return null; a.sort((p,q)=>p-q); return a[Math.floor(a.length*0.8)]; };
  const glob=new Float32Array(NB); for(let k=0;k<NB;k++){ const all=[]; for(let bl=0;bl<bw*bh;bl++) if(bins[bl*NB+k].length) all.push(md(bins[bl*NB+k].slice())); const v=all.filter(x=>x!=null).sort((p,q)=>p-q); glob[k]=v.length?v[v.length>>1]:0; }
  for(let bl=0;bl<bw*bh;bl++) for(let k=0;k<NB;k++){ const v=md(bins[bl*NB+k]); prof[bl*NB+k]=v==null?glob[k]:v; }
  /* заливка полосы линии сетки по краям полосы (поперёк линии, линейно): линия чертежа, пересекающая сетку,
     тёмная по обе стороны полосы — заливка тёмная, разрыва нет; бумага — светлая. Сначала вертикальные полосы
     (вне узлов), затем горизонтальные — по уже залитому (в узле края горизонтальной полосы лежат на залитой
     вертикальной). Пиксель много темнее профиля сетки (линия чертежа идёт по линии сетки — ось x часто так) остаётся */
  const hw=half+0.08, src=new Uint8ClampedArray(img.data), cur=out.data; let er=0;
  const inkAt=p=>{ const x=Math.max(0,Math.min(W-1,Math.round(p[0]))), y=Math.max(0,Math.min(Hh-1,Math.round(p[1]))); let m=0; for(let d=-1;d<=1;d++){ const xx=Math.max(0,Math.min(W-1,x+d)), yy=Math.max(0,Math.min(Hh-1,y+d)); m=Math.max(m,inkP[y*W+xx],inkP[yy*W+x]); } return m; };
  /* линия чертежа, идущая ПО линии сетки (связь при x кратном 5, ось, h₁ на уровне клетки): вдоль каждой линии сетки
     тёмность её середины сравнивается с её же фоном (25-я процентиль по всей линии: линия чертежа редко занимает больше её половины) — где темнее на 25 % + 0,06 подряд
     ≥ 2,5 мм, там линия чертежа: полосу не трогаем */
  const keepM=new Uint8Array(W*Hh), win=Math.max(W,Hh), minRun=Math.round(2.5*ppm), hb=Math.round(half*ppm);
  const along=(vertical)=>{ const k0=Math.ceil((vertical?box[0]:box[1])/cell), k1=Math.floor((vertical?box[2]:box[3])/cell), N=vertical?Hh:W;
    for(let k=k0;k<=k1;k++){ const c=Math.round((k*cell-(vertical?box[0]:box[1]))*ppm-0.5); if(c<2||c>(vertical?W:Hh)-3) continue; const d=new Float32Array(N);
      /* средняя тёмность поперёк ±2 px: печатная линия сетки тонкая, карандашная — шире; по ширине они и различаются */
      for(let t=0;t<N;t++){ let m=0; for(let o=-2;o<=2;o++){ const x=vertical?c+o:t, y=vertical?t:c+o; if(x>=0&&y>=0&&x<W&&y<Hh) m+=ink[y*W+x]; } d[t]=m/5; }
      /* сглаживание вдоль линии (±4 px): зерно карандаша рвёт порог попиксельно */
      { const sm=new Float32Array(N); let acc=0; for(let t=0;t<N;t++){ acc+=d[t]; if(t>=9) acc-=d[t-9]; sm[Math.max(0,t-4)]=acc/Math.min(t+1,9); } d.set(sm); }
      const base=new Float32Array(N); for(let b0=0;b0<N;b0+=win){ const seg=Array.from(d.subarray(b0,Math.min(N,b0+win))).sort((p,q)=>p-q), v=seg[Math.floor(seg.length*0.25)]||0; for(let t=b0;t<Math.min(N,b0+win);t++) base[t]=v; }
      let run=0; for(let t=0;t<=N;t++){ const on=t<N&&d[t]>=base[t]*1.25+0.06; if(on){ run++; continue; } if(run>=minRun) for(let q=t-run;q<t;q++) for(let o=-hb;o<=hb;o++){ const x=vertical?c+o:q, y=vertical?q:c+o; if(x>=0&&y>=0&&x<W&&y<Hh) keepM[y*W+x]=1; } run=0; } } };
  along(true); along(false);
  const keep=(i,x,y)=>{ if(keepM[i]) return true; const k=Math.floor(dist[i]/half*NB); if(k>=NB) return true; const gl=prof[(((y/BS)|0)*bw+((x/BS)|0))*NB+k]; return ink[i]>gl*1.35+0.08; };
  const px=(D,x,y,ch)=>{ x=Math.max(0,Math.min(W-1,x)); y=Math.max(0,Math.min(Hh-1,y)); const X0=Math.floor(x), f=x-X0, X1=Math.min(W-1,X0+1); const Y=Math.round(y); return D[(Y*W+X0)*4+ch]*(1-f)+D[(Y*W+X1)*4+ch]*f; };
  const py=(D,x,y,ch)=>{ x=Math.max(0,Math.min(W-1,x)); y=Math.max(0,Math.min(Hh-1,y)); const Y0=Math.floor(y), f=y-Y0, Y1=Math.min(Hh-1,Y0+1); const X=Math.round(x); return D[(Y0*W+X)*4+ch]*(1-f)+D[(Y1*W+X)*4+ch]*f; };
  let inkP=ink;
  for(let pass=0;pass<2;pass++){ const S=pass?new Uint8ClampedArray(cur):src; if(pass) inkP=CL.ink(out).ink.a;   /* края горизонтальных полос — по уже очищенным вертикальным */
    for(let y=0;y<Hh;y++){ const v=box[1]+(y+0.5)/ppm, nv=Math.round(v/cell)*cell, fv=Math.abs(v-nv);
      for(let x=0;x<W;x++){ const i=y*W+x, u=box[0]+(x+0.5)/ppm, nu=Math.round(u/cell)*cell, fu=Math.abs(u-nu);
        if(pass===0&&!(fu<=half&&fv>half)) continue; if(pass===1&&!(fv<=half)) continue; if(sc.gridAt&&!sc.gridAt(u,v)) continue;   /* где сетки нет (бланк, поля) — ничего не стираем */ if(!(fu<=half&&fv<=half)&&keep(i,x,y)) continue;   /* в узле сетка темнее вдвое — правило «темнее сетки» не годится */
        /* пересечение с линией чертежа: по обе стороны полосы темно — пиксель не трогаем (иначе на линии разрыв,
           и сплошная читается штриховой) */
        { const a=pass===0?[(nu-hw-box[0])*ppm-0.5,y]:[x,(nv-hw-box[1])*ppm-0.5], b=pass===0?[(nu+hw-box[0])*ppm-0.5,y]:[x,(nv+hw-box[1])*ppm-0.5];
          const ia=inkAt(a), ib=inkAt(b), halo=prof[(((y/BS)|0)*bw+((x/BS)|0))*NB+NB-1]; if(Math.min(ia,ib)>Math.max(halo*1.5+0.1,0.4*ink[i])) continue; }
        if(pass===0){ const xa=(nu-hw-box[0])*ppm-0.5, xb=(nu+hw-box[0])*ppm-0.5, t=(x-xa)/(xb-xa); for(let ch=0;ch<3;ch++) cur[4*i+ch]=Math.round(px(S,xa,y,ch)*(1-t)+px(S,xb,y,ch)*t); }
        else { const ya=(nv-hw-box[1])*ppm-0.5, yb=(nv+hw-box[1])*ppm-0.5, t=(y-ya)/(yb-ya); for(let ch=0;ch<3;ch++) cur[4*i+ch]=Math.round(py(S,x,ya,ch)*(1-t)+py(S,x,yb,ch)*t); }
        er++; } } }
  return Object.assign({},sc,{img:out,erased:er,gridLevel:Math.max(...glob)}); }

put('dzGrid',{findGrid,rectify,eraseGrid,lineMap});
if(isNode&&require.main===module){ const fs=require('fs'), f=process.argv[2], im=IMG.decodePNG(fs.readFileSync(f)), t0=Date.now(), g=findGrid(im);
  console.log(f,g.ok?'сетка: узлов '+g.found+', '+g.ppm0.toFixed(2)+' px/мм, гладкость '+g.rms.toFixed(2)+' px':'нет: '+g.reason,(Date.now()-t0)+' мс'); g.dbg.forEach(d=>console.log('  '+d));
  if(g.ok&&process.argv[3]){ const sc=rectify(im,g,{ppm:8}), e=eraseGrid(sc); fs.writeFileSync(process.argv[3],IMG.encodePNG(sc.img)); if(process.argv[4]) fs.writeFileSync(process.argv[4],IMG.encodePNG(e.img)); console.log('  скан',sc.img.width+'×'+sc.img.height,'стёрто px',e.erased,'тёмность сетки',e.gridLevel.toFixed(3),(Date.now()-t0)+' мс'); } }
})();
