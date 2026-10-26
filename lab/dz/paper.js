/* ═══════════ Чистый лист: без рамки, без штампа, без клеток ═══════════
   Опор две: края бумаги и сама фигура условия.
   1. Края бумаги (findPaper): лист на столе — самая большая светлая область. Четыре стороны — прямые по её границе
      (грубо на уменьшенном снимке, затем на полном — по перепаду яркости, субпиксельно, с отбросом выбросов).
      Сторона должна быть видна на ≥ 50 % длины; угол может быть за кадром (до 6 %) — он находится пересечением
      сторон. Дальше — отказ: лист обрезан.
   2. Перспектива: стороны → гомография на прямоугольник 1 : √2 (А4 и А3 — одной пропорции). Какой это лист и как
      он повёрнут — неизвестно: лист принимается за А4 книжный, а масштаб (А4 или А3 = ×√2) и поворот на 180°
      проверяются гипотезами — фигура условия варианта (её размеры в мм известны) прикладывается к линиям листа.
   3. Масштаб — по размеру листа (свободный масштаб на грубом снимке «уезжал»), сдвиг — по фигуре условия; лист
      заново выпрямляется уже в настоящих мм — дальше тот же путь, что у листа в клетку (gridsheet.js).
   Изгиб бумаги без сетки не виден: погрешность замеров здесь честно больше (σ ≥ 0,5 мм).
   findPaper(img) → {ok, reason, quad:[↖,↗,↘,↙] px, dbg}
   preparePlain(img, {dz, n}) → {ok, reason, scan, dig, box, map(u,v)→px, origin, n, page:'A4'|'A3', flip, cover, why[]} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const L=n=>isNode?require('./'+n+'.js'):self.LAB[{grid:'dzGrid',calib:'dzCalib'}[n]];
const IMG=isNode?require('../img.js'):self.LAB.img, LN=isNode?require('../lines.js'):self.LAB.lines, V=isNode?require('../../core/dz-variants.js'):self.CORE.dzVariants;
const H=IMG.H, SQ2=Math.SQRT2;
const lum=(d,i)=>(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2])/255;
/* прямая по точкам: МНК с отбросом (> 2,5 σ, не меньше lim px), три прохода */
function robustLine(P,lim){ let Q=P; let ln=null;
  for(let it=0;it<4;it++){ if(Q.length<8) return null; const c=Q.reduce((m,p)=>[m[0]+p[0]/Q.length,m[1]+p[1]/Q.length],[0,0]); let xx=0,xy=0,yy=0;
    Q.forEach(p=>{ const a=p[0]-c[0], b=p[1]-c[1]; xx+=a*a; xy+=a*b; yy+=b*b; }); const t=0.5*Math.atan2(2*xy,xx-yy), e=[Math.cos(t),Math.sin(t)], n=[-e[1],e[0]];
    const r=Q.map(p=>Math.abs((p[0]-c[0])*n[0]+(p[1]-c[1])*n[1])), s=Math.sqrt(r.reduce((m,x)=>m+x*x,0)/r.length); ln={p:c,e,n,rms:s,n0:Q.length};
    const keep=Q.filter((p,i)=>r[i]<=Math.max(lim,2.5*s)); if(keep.length===Q.length) break; Q=keep; }
  return ln; }
const meet=(A,B)=>{ const d=A.e[0]*B.e[1]-A.e[1]*B.e[0]; if(Math.abs(d)<1e-9) return null; const w=[B.p[0]-A.p[0],B.p[1]-A.p[1]], t=(w[0]*B.e[1]-w[1]*B.e[0])/d; return [A.p[0]+A.e[0]*t,A.p[1]+A.e[1]*t]; };
function findPaper(img){ const W=img.width, Hh=img.height, d=img.data, dbg=[];
  /* 1. грубо: уменьшенный снимок, порог Оцу, самая большая светлая область */
  const k=Math.max(1,Math.max(W,Hh)/800), w=Math.floor(W/k), h=Math.floor(Hh/k), g=new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let s=0,n=0; for(let yy=Math.floor(y*k);yy<Math.min(Hh,Math.floor((y+1)*k));yy+=Math.max(1,Math.floor(k/2))) for(let xx=Math.floor(x*k);xx<Math.min(W,Math.floor((x+1)*k));xx+=Math.max(1,Math.floor(k/2))){ s+=lum(d,(yy*W+xx)*4); n++; } g[y*w+x]=s/n; }
  const hist=new Float64Array(64); g.forEach(v=>hist[Math.min(63,Math.floor(v*64))]++); let sum=0; for(let i=0;i<64;i++) sum+=i*hist[i];
  let sb=0,wb=0,bv=0,th=32; for(let i=0;i<64;i++){ wb+=hist[i]; if(!wb) continue; const wf=g.length-wb; if(!wf) break; sb+=i*hist[i]; const mb=sb/wb, mf=(sum-sb)/wf, v=wb*wf*(mb-mf)**2; if(v>bv){ bv=v; th=i; } }
  const thr=(th+0.5)/64, lab=new Int32Array(w*h).fill(-1); let best=-1,bestN=0,comp=0; const st=[];
  for(let i=0;i<w*h;i++){ if(g[i]<=thr||lab[i]>=0) continue; let n=0; st.push(i); lab[i]=comp;
    while(st.length){ const j=st.pop(); n++; const x=j%w, y=(j/w)|0; [[x>0,j-1],[x<w-1,j+1],[y>0,j-w],[y<h-1,j+w]].forEach(([ok,q])=>{ if(ok&&g[q]>thr&&lab[q]<0){ lab[q]=comp; st.push(q); } }); }
    if(n>bestN){ bestN=n; best=comp; } comp++; }
  if(best<0) return {ok:false,reason:'не вижу листа: снимите лист целиком на тёмном фоне (стол, ткань)',dbg};
  /* тень на листе: затенённая бумага темнее порога и выпадает. Край тени размыт — яркость меняется плавно; край
     бумаги резкий. Доращиваем лист от светлой части через плавные переходы (≤ 0,035 на пиксель уменьшенного снимка) */
  { const q=[]; for(let i=0;i<w*h;i++) if(lab[i]===best) q.push(i); let qi=0;
    while(qi<q.length){ const j=q[qi++], x=j%w, y=(j/w)|0; [[x>0,j-1],[x<w-1,j+1],[y>0,j-w],[y<h-1,j+w]].forEach(([ok,t])=>{ if(ok&&lab[t]!==best&&g[t]>0.18&&Math.abs(g[t]-g[j])<=0.035){ lab[t]=best; q.push(t); } }); }
    bestN=q.length; }
  if(bestN<0.15*w*h) return {ok:false,reason:'не вижу листа: снимите лист целиком на тёмном фоне (стол, ткань)',dbg};
  /* граница области; углы — крайние по x+y и x−y */
  const B=[]; let cs=[[1e9],[-1e9],[-1e9],[1e9]];   /* мин x+y, макс x−y, макс x+y, мин x−y */
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=y*w+x; if(lab[i]!==best) continue; const edge=x===0||y===0||x===w-1||y===h-1||lab[i-1]!==best||lab[i+1]!==best||lab[i-w]!==best||lab[i+w]!==best; if(!edge) continue;
    B.push([x,y,x===0||y===0||x===w-1||y===h-1]); const s=x+y, df=x-y; if(s<cs[0][0]) cs[0]=[s,x,y]; if(df>cs[1][0]) cs[1]=[df,x,y]; if(s>cs[2][0]) cs[2]=[s,x,y]; if(df<cs[3][0]) cs[3]=[df,x,y]; }
  const C0=cs.map(c=>[c[1],c[2]]);   /* ↖ ↗ ↘ ↙ */
  /* 2. стороны: точки границы у отрезка между углами (10–90 % длины, ≤ 4 % длины от него), прямая с отбросом */
  const sides=[];
  for(let s=0;s<4;s++){ const a=C0[s], b=C0[(s+1)%4], e=[b[0]-a[0],b[1]-a[1]], len=Math.hypot(...e), u=[e[0]/len,e[1]/len], n=[-u[1],u[0]];
    if(len<0.2*Math.min(w,h)) return {ok:false,reason:'край листа не найден — снимите лист целиком, сверху',dbg};
    const P=B.filter(p=>{ const t=(p[0]-a[0])*u[0]+(p[1]-a[1])*u[1], q=(p[0]-a[0])*n[0]+(p[1]-a[1])*n[1]; return t>0.1*len&&t<0.9*len&&Math.abs(q)<=0.04*len; });
    /* точки на краю кадра — не край листа (лист уходит за кадр): в подгонку не идут; видимой стороны — ≥ 50 % */
    const Pin=P.filter(p=>!p[2]), bins=new Uint8Array(50); Pin.forEach(p=>{ const t=((p[0]-a[0])*u[0]+(p[1]-a[1])*u[1])/len; bins[Math.min(49,Math.max(0,Math.floor(t*50)))]=1; }); let cov=0; for(let i=5;i<45;i++) cov+=bins[i]; cov/=40;
    dbg.push('сторона '+(s+1)+': у края кадра '+(P.length-Pin.length)+' из '+P.length+', видимая часть '+Math.round(cov*100)+' %');
    if(cov<0.5&&P.length-Pin.length>0.3*P.length) return {ok:false,reason:'лист не целиком: край листа уходит за край кадра — отодвиньте телефон',dbg};
    dbg.push('сторона '+(s+1)+' грубо: точек '+P.length+', видна на '+Math.round(cov*100)+' %, длина '+Math.round(len)+' px');
    if(cov<0.5) return {ok:false,reason:'край листа закрыт (рука, линейка, тень?) — уберите всё с края листа',dbg};
    const ln=robustLine(Pin.map(p=>[p[0],p[1]]),1.5); if(!ln) return {ok:false,reason:'край листа не прямой — расправьте лист',dbg}; sides.push(ln); }
  /* 3. точно — на полном снимке: поперёк стороны ищем перепад яркости (бумага → фон) с точностью до долей пикселя */
  const at=(x,y)=>{ const x0=Math.floor(x), y0=Math.floor(y); if(x0<0||y0<0||x0>=W-1||y0>=Hh-1) return null; const fx=x-x0, fy=y-y0, i=(y0*W+x0)*4;
    return (lum(d,i)*(1-fx)+lum(d,i+4)*fx)*(1-fy)+(lum(d,i+W*4)*(1-fx)+lum(d,i+W*4+4)*fx)*fy; };
  const cen=C0.reduce((m,p)=>[m[0]+p[0]*k/4,m[1]+p[1]*k/4],[0,0]), fine=[];
  for(let s=0;s<4;s++){ const sl=sides[s], c0=[sl.p[0]*k,sl.p[1]*k], e=sl.e; let n=sl.n; if((cen[0]-c0[0])*n[0]+(cen[1]-c0[1])*n[1]<0) n=[-n[0],-n[1]];   /* n — внутрь листа */
    const a=meet(sides[(s+3)%4],sl), b=meet(sl,sides[(s+1)%4]); if(!a||!b) return {ok:false,reason:'углы листа не найдены',dbg}; const A=[a[0]*k,a[1]*k], Bp=[b[0]*k,b[1]*k], len=Math.hypot(Bp[0]-A[0],Bp[1]-A[1]);
    const P=[], R=Math.max(6,2*k);
    for(let i=1;i<80;i++){ const t=0.08+0.84*i/80, p=[A[0]+(Bp[0]-A[0])*t,A[1]+(Bp[1]-A[1])*t]; let bestG=0, bo=null; const prof=[];
      for(let o=-R;o<=R;o+=0.5){ const v1=at(p[0]+n[0]*(o+1),p[1]+n[1]*(o+1)), v0=at(p[0]+n[0]*(o-1),p[1]+n[1]*(o-1)); prof.push(v1==null||v0==null?0:v1-v0); }
      prof.forEach((v,j)=>{ if(v>bestG){ bestG=v; bo=j; } }); if(bo==null||bestG<0.08||bo===0||bo===prof.length-1) continue;
      const y1=prof[bo-1], y2=prof[bo], y3=prof[bo+1], den=y1-2*y2+y3, off=den<0?0.5*(y1-y3)/den:0, o=-R+(bo+off)*0.5; P.push([p[0]+n[0]*o,p[1]+n[1]*o]); }
    if(P.length<30) return {ok:false,reason:'край листа нечёткий — больше света или тёмный фон под листом',dbg};
    const ln=robustLine(P,0.8); if(!ln) return {ok:false,reason:'край листа не прямой — расправьте лист',dbg}; fine.push(ln); dbg.push('сторона '+(s+1)+': '+ln.n0+' точек, СКО '+ln.rms.toFixed(2)+' px'); }
  const quad=[0,1,2,3].map(s=>meet(fine[(s+3)%4],fine[s]));
  if(quad.some(q=>!q||q[0]<-W*0.06||q[1]<-Hh*0.06||q[0]>W*1.06||q[1]>Hh*1.06)) return {ok:false,reason:'угол листа за краем кадра — отодвиньте телефон',dbg};
  return {ok:true,quad,sides:fine,dbg}; }

/* отношение сторон листа по перспективе (не по чертежу): прямой угол бумаги и равные масштабы осей дают фокус и
   пропорцию. H0 — единичный квадрат → четырёхугольник (главная точка — центр кадра); f² = −(h11 h12 + h21 h22) /
   (h31 h32); пропорция a = |K⁻¹h2| / |K⁻¹h1|. Фокус телефона неизвестен — перебираем 0,6…1,6 размера кадра (и
   оценку, если она есть): у А4/А3 выходит 1,38–1,42, у листа в клетку 200 × 260 — 1,30 при любом */
function aspectOf(quad,W,Hh){ const c=[W/2,Hh/2], M=Math.max(W,Hh), Ls=[0,1,2,3].map(s=>Math.hypot(quad[(s+1)%4][0]-quad[s][0],quad[(s+1)%4][1]-quad[s][1])), tall=Ls[1]+Ls[3]>=Ls[0]+Ls[2];
  const q=(tall?quad:[quad[3],quad[0],quad[1],quad[2]]).map(p=>[p[0]-c[0],p[1]-c[1]]), H0=H.fit([[0,0],[1,0],[1,1],[0,1]],q); if(!H0) return null;
  const h1=[H0[0],H0[3],H0[6]], h2=[H0[1],H0[4],H0[7]], f2=-(h1[0]*h2[0]+h1[1]*h2[1])/(h1[2]*h2[2]), fs=[];
  for(let k=0.6;k<=1.6001;k+=0.1) fs.push(k*M); if(f2>0&&isFinite(f2)) fs.push(Math.sqrt(f2));
  const as=fs.map(f=>{ const n=v=>Math.hypot(v[0]/f,v[1]/f,v[2]); return n(h2)/n(h1); }); return {min:Math.min(...as),max:Math.max(...as),as}; }
/* лист → мм: книжный «А4» (210 × 297) — длинные стороны четырёхугольника идут вдоль высоты листа */
function pageHom(quad){ const Ls=[0,1,2,3].map(s=>Math.hypot(quad[(s+1)%4][0]-quad[s][0],quad[(s+1)%4][1]-quad[s][1]));
  const tall=Ls[1]+Ls[3]>=Ls[0]+Ls[2]; /* ↗→↘ и ↙→↖ длиннее — лист стоит книжно в кадре */
  const q=tall?quad:[quad[3],quad[0],quad[1],quad[2]];   /* лежит боком — поворот на 90° */
  return H.fit([[0,0],[210,0],[210,297],[0,297]],q); }
const scale=(data,s,flip)=>Object.fromEntries(Object.entries(data).map(([k,p])=>[k,p.map(v=>v*s*(flip?-1:1))]));
function preparePlain(img,o){ o=o||{}; const dz=+o.dz||3, why=[], P=findPaper(img); if(!P.ok) return {ok:false,reason:P.reason,dbg:P.dbg};
  /* пропорция листа — 1 : √2 (А4, А3), иначе лист растянется молча и все точки «съедут» на миллиметры */
  /* принят, если при каком-то правдоподобном фокусе (0,6…1,6 кадра) пропорция — 1,414 ± 3,5 % (синтетическая камера —
     не честная обскура и даёт до 2,5 %; лист в клетку 200 × 260 и Letter — 1,29–1,30, далеко) */
  const asp=aspectOf(P.quad,img.width,img.height); if(!asp||!asp.as.some(a=>Math.abs(a-SQ2)<=0.05)) return {ok:false,reason:'пропорции листа '+(asp?(((asp.min+asp.max)/2).toFixed(2).replace('.',',')):'?')+' : 1 — не А4/А3 (1,41 : 1). Если лист в клетку — снимите ближе, чтобы была видна сетка; другой формат пока не поддержан',dbg:P.dbg};
  const C=L('calib'), GS=isNode?require('./gridsheet.js'):self.LAB.dzGridSheet, Ha=pageHom(P.quad);
  /* 1. грубо: лист как А4, 5 px/мм — линии и кандидаты осей */
  const ga={map:(u,v)=>H.apply(Ha,[u,v]),box:[0,0,210,297]}, sa=L('grid').rectify(img,ga,{ppm:5,box:[0,0,210,297]});
  const exa=LN.extract(sa.img,{H:sa.H},{sheet:{O:[0,0],roi:sa.box,given:()=>[]},maxIter:300}); if(!exa.ok) return {ok:false,reason:exa.reason};
  const da={ok:true,origin:'page',O:[0,0],box:sa.box,segs:exa.segs,map:exa.map}, cands=GS.axesCands(exa.segs);
  /* 2. гипотезы: вариант (указан или все 30) × лист А4 / А3 × поворот 0 / 180° — быстро по осям, точно — три лучших */
  const ns=+o.n?[+o.n]:Array.from({length:30},(_,i)=>i+1), hyp=[];
  ns.forEach(n=>{ const gv=V.get(dz,n); if(!gv) return; [[1,'A4'],[1/SQ2,'A3']].forEach(([s,pg])=>[false,true].forEach(flip=>{ const dd=scale(gv.data,s,flip);
    const c=C.calibrate(da,{},gv.id,dd,{range:sa.box,np:2,cands,quick:cands.length>0}); hyp.push({n,id:gv.id,s,pg,flip,dd,cover:c.ok?c.cover:0}); })); });
  /* точно — три лучших; только сдвиг: масштаб даёт размер листа (края бумаги — до 0,1 мм на угол, А4 и А3 стандартны),
     а свободный масштаб на грубом снимке «уезжал» (на 3 %) и портил всё дальше */
  hyp.sort((a,b)=>b.cover-a.cover); hyp.slice(0,3).forEach(h=>{ const c=C.calibrate(da,{},h.id,h.dd,{range:sa.box,np:2,cands}); h.cal=c; h.cover=c.ok?c.cover:0; });
  hyp.sort((a,b)=>(b.cal?1:0)-(a.cal?1:0)||b.cover-a.cover); const b=hyp[0], b2=hyp.find(x=>x!==b&&(x.n!==b.n||x.pg!==b.pg||x.flip!==b.flip))||{cover:0};
  /* узнан: номер указан — гипотез 4 (лист × поворот), хватает 60 %; номер узнаётся среди 30 вариантов — 80 % */
  if(!b||!b.cal||b.cover<(+o.n?0.6:0.8)||b.cover-b2.cover<0.15) return {ok:false,reason:(+o.n?'условие варианта '+o.n+' на листе не узнаётся':'вариант по чертежу не узнаётся однозначно')+(b?' (лучшее: '+(+o.n?'':'вариант '+b.n+', ')+b.pg+(b.flip?', лист перевёрнут':'')+' — '+Math.round(b.cover*100)+' %)':'')+' — проверьте номер варианта или переснимите лист целиком',hyp:hyp.slice(0,4).map(h=>({n:h.n,pg:h.pg,flip:h.flip,cover:h.cover}))};
  /* 3. настоящие мм: p_a = t + K·(p_t − c), K = s·(±I). Лист заново выпрямляется так, что чертёж — в мм варианта */
  const T=b.cal.T, sg=b.flip?-1:1, K=[[b.s*sg,0],[0,b.s*sg]], det=K[0][0]*K[1][1], Ki=[[1/K[0][0],0],[0,1/K[1][1]]];
  const toT=p=>{ const q=[p[0]-T[0],p[1]-T[1]]; return [Ki[0][0]*q[0]+Ki[0][1]*q[1],Ki[1][0]*q[0]+Ki[1][1]*q[1]]; };
  const cor=[[0,0],[210,0],[210,297],[0,297]].map(toT), c=[-Math.min(...cor.map(p=>p[0])),-Math.min(...cor.map(p=>p[1]))];
  const box=[0,0,Math.ceil(Math.max(...cor.map(p=>p[0]))+c[0]),Math.ceil(Math.max(...cor.map(p=>p[1]))+c[1])];
  const map=(u,v)=>{ const q=[u-c[0],v-c[1]]; return H.apply(Ha,[T[0]+K[0][0]*q[0]+K[0][1]*q[1],T[1]+K[1][0]*q[0]+K[1][1]*q[1]]); };
  const sc=L('grid').rectify(img,{map,box},{ppm:8,box}), ex=LN.extract(sc.img,{H:sc.H},{sheet:{O:[0,0],roi:box,given:()=>[]},maxIter:300,clean:o.clean}); if(!ex.ok) return {ok:false,reason:ex.reason};
  const dig={ok:true,origin:'page',O:[0,0],box,segs:ex.segs,map:ex.map};
  /* проверка «это и правда А4/А3»: на точном скане фигура условия подгоняется с 6 параметрами — масштаб по осям
     и перекос должны быть в 1,5 %. Лист другой пропорции (в клетку 200 × 260, обрезанный, тетрадный) иначе молча
     растягивался бы до 1 : √2 — и точки «нанесены неточно» на миллиметры */
  { const gv=V.get(dz,b.n), c6=C.calibrate(dig,{},gv.id,gv.data,{range:box,np:6,cands:GS.axesCands(ex.segs)}), devOf=c=>{ const T6=c.T||[0,0,1,1,1,1]; return c.ok?Math.max(Math.abs(T6[2]),Math.abs(T6[5]),Math.abs(T6[3]),Math.abs(T6[4])):1; };
    let dev=devOf(c6);
    /* одна точка нанесена с ошибкой — она тянет подгонку (1–2 %): повтор без каждой точки по очереди; лист не той
       пропорции растянут при любом исключении */
    if(c6.ok&&dev>0.015){ const O6=c6.T; Object.keys(gv.data).forEach(k=>{ const ck=C.calibrate(dig,{},gv.id,gv.data,{range:[O6[0]-3,O6[1]-3,O6[0]+3,O6[1]+3],np:6,exclude:k}); dev=Math.min(dev,devOf(ck)); }); }
    if(!c6.ok||dev>0.015) return {ok:false,reason:'пропорции листа не как у А4/А3 (фигура условия растянута на '+(c6.ok?(dev*100).toFixed(1).replace('.',','):'?')+' %) — если лист в клетку, снимите ближе, чтобы сетка была видна; иначе снимите лист целиком'}; }
  why.push('лист без рамки и клеток: края бумаги → перспектива; по фигуре условия — '+b.pg+(b.flip?' (лист перевёрнут)':''));
  /* px снимка на мм у начала координат чертежа: на мелком фото (лист А3 с четырьмя чертежами целиком) замер грубее */
  const m0=map(c[0],c[1]), m1=map(c[0]+10,c[1]), m2=map(c[0],c[1]+10), ppmPhoto=(Math.hypot(m1[0]-m0[0],m1[1]-m0[1])+Math.hypot(m2[0]-m0[0],m2[1]-m0[1]))/20;
  return {ok:true,scan:sc,dig,box,map,origin:c,n:b.n,page:b.pg,flip:b.flip,cover:b.cover,second:b2.cover,why,cands:GS.axesCands(ex.segs),quad:P.quad,dbg:P.dbg,ppmPhoto}; }
put('dzPaper',{findPaper,preparePlain,pageHom,aspectOf});
})();
