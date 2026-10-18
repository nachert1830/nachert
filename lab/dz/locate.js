/* ═══════════ ДЗ: ориентация, рамка, основная надпись, эпюр, начало O, поле чертежа ═══════════
   1. Лист: внутренность рамки (замкнутая тёмная граница) или край страницы → четырёхугольник; пропорции — только
      книжный А3; углы сопоставляются при 4 поворотах снимка (телефон мог лежать боком).
   2. Рамка (рукой): стороны — МНК по середине карандашной линии рядом с ожидаемым местом (бумага по обе стороны).
   3. Рамка годится, только если все четыре её стороны прочерчены (≥ 75 % длины).
      Ориентация: основная надпись — внизу справа. Для каждого поворота ищем узор штампа (ГОСТ 2.104, форма 1:
      верхняя линия 185 мм, вертикали 55 мм, строки по 5 мм) там, где он должен быть, против того же узора в
      повёрнутом на 180° углу. Выигрывает поворот, где штамп есть; нет штампа ни там, ни там — отказ
      («лист должен лежать книжно, штамп внизу справа»).
   4. Уточнение: рамка + линии штампа на гребень (8 параметров гомографии).
   5. Эпюр: ось x — самая длинная почти горизонтальная прямая поля (не рамка, не штамп); ось z/y — почти вертикальная
      прямая через ось x, самая правая из длинных, правее которой почти нет чертежа. O = их пересечение. Нет оси z/y —
      O не задано (дальше — по таблице варианта: см. lab/dz/variant.js).
   6. Поле чертежа: рамка без штампа; чертёж — рамка вокруг найденных линий (+5 мм). Вырезается выпрямленным.
   locate(img) → {ok, reason, turn, H (мм страницы → px), frame, title, axis, zAxis, O, field, box, …} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('../'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const IMG=lab('img'), {H,sample}=IMG, CL=lab('clean'), RF=lab('rectify'), LN=lab('lines');
const DS=isNode?require('./sheet.js'):self.LAB.dzsheet;
const v2={add:(a,b)=>[a[0]+b[0],a[1]+b[1]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],mul:(a,k)=>[a[0]*k,a[1]*k],dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),unit:a=>{ const l=Math.hypot(a[0],a[1])||1; return [a[0]/l,a[1]/l]; }};
const SHEET={frame:DS.FRAME};

/* покрытие сторон рамки: доля точек (шаг 1 мм), где в ±1 мм поперёк есть линия */
function sideCover(ink,M,th){ const F=DS.FRAME, C=[[F[0],F[1]],[F[2],F[1]],[F[2],F[3]],[F[0],F[3]]];
  return [0,1,2,3].map(k=>{ const a=C[k], b=C[(k+1)%4], L=v2.dist(a,b); let on=0, n=0;
    for(let t=3;t<L-3;t+=1){ const p=[a[0]+(b[0]-a[0])*t/L,a[1]+(b[1]-a[1])*t/L]; let hit=false;
      for(let q=-1;q<=1&&!hit;q+=0.25){ const d=a[0]===b[0]?[q,0]:[0,q], Q=H.apply(M,v2.add(p,d)), v=sample(ink,Q[0]-0.5,Q[1]-0.5); if(v!=null&&v>th) hit=true; }
      n++; if(hit) on++; } return on/n; }); }
/* узор штампа: длинные линии на своих местах (верх 185 мм, левая и средняя вертикали по 55 мм) и строки по 5 мм в
   левой части. Каждая линия ищется со сдвигом концов ±7 мм (рука, неточная рамка), покрытие — доля точек, где поперёк ±0,6 мм есть линия.
   Чертёж в противоположном углу даёт отдельные длинные линии, но не весь узор сразу: берём среднее с минимумом */
function titleShape(ink,M,th,flip){ const T=DS.TITLE, c=[(DS.FRAME[0]+DS.FRAME[2])/2,(DS.FRAME[1]+DS.FRAME[3])/2], f=flip?p=>[2*c[0]-p[0],2*c[1]-p[1]]:p=>p;
  const cov=(a,b,d,e)=>{ const L=v2.dist(a,b), hz=a[1]===b[1]; let on=0, n=0;
    for(let t=1;t<L-1;t+=1){ const s=d+(e-d)*t/L, p=[a[0]+(b[0]-a[0])*t/L+(hz?0:s),a[1]+(b[1]-a[1])*t/L+(hz?s:0)]; let hit=false;
      for(let q=-0.6;q<=0.6&&!hit;q+=0.3){ const Q=H.apply(M,f(hz?[p[0],p[1]+q]:[p[0]+q,p[1]])), v=sample(ink,Q[0]-0.5,Q[1]-0.5); if(v!=null&&v>th) hit=true; }
      n++; if(hit) on++; } return on/n; };
  /* сдвиг концов линии независимо (±r мм): рука и неточная рамка дают и сдвиг, и наклон */
  const best=(a,b,r)=>{ let m=0; for(let d=-r;d<=r;d+=0.5) for(let e=d-2;e<=d+2;e+=0.5){ const v=cov(a,b,d,e); if(v>m) m=v; } return m; };
  const top=best([T[0],T[1]],[T[2],T[1]],7), left=best([T[0],T[1]],[T[0],T[3]],7), mid=best([T[0]+65,T[1]],[T[0]+65,T[3]],7);
  let rows=0; for(let y=T[1]+5;y<T[3];y+=5) rows+=best([T[0],y],[T[0]+65,y],1.5); rows/=10;
  const v=[top,left,mid,rows]; return {v,s:(v.reduce((x,y)=>x+y,0)/4+Math.min(...v))/2}; }
function locate(img,o){ o=o||{}; const small=IMG.downscale(img,2100), f=small.scale||1, {ink,V}=CL.ink(small), pg=DS.A3, FR=DS.FRAME;   /* целый шаг уменьшения: 2000 px — как есть, 3000–4000 — вдвое */
  /* порог «чернила» — от тёмности самого листа: карандашная рамка бледнее печатной */
  const dk0=[]; for(let i=0;i<ink.a.length;i+=13) if(ink.a[i]>0.06) dk0.push(ink.a[i]); dk0.sort((a,b)=>a-b); const thI=Math.max(0.1,Math.min(0.3,(dk0[Math.floor(dk0.length*0.9)]||0.3)*0.5));
  const quads=[]; [{th:thI,close:true},{th:thI}].forEach(op=>{ const I=RF.findInner(ink,op); if(I) quads.push({q:I.quad,as:'frame'},{q:I.quad,as:'page'}); });   /* внутренность может оказаться и всей страницей (рамка бледная) */ const P=RF.findPage(V); if(P&&P.fill>0.85) quads.push({q:P.quad,as:'page'},{q:P.quad,as:'frame'});
  const HQ=frameHough(ink,thI); if(HQ) quads.unshift({q:HQ,as:'frame'});
  /* граница тени остаётся на карте тёмности тонкой линией и делит внутренность рамки надвое: добавляем объединения
     пар найденных четырёхугольников (крайние точки по диагоналям). Лишний кандидат безопасен — дальше его проверят
     рамка (все четыре стороны) и штамп */
  const qs=quads.filter(Q=>Q.as==='frame').map(Q=>Q.q), ext=pts=>{ const by=f=>pts.reduce((b,p)=>f(p)>f(b)?p:b); return [by(p=>-p[0]-p[1]),by(p=>p[0]-p[1]),by(p=>p[0]+p[1]),by(p=>-p[0]+p[1])]; };
  for(let i=0;i<qs.length;i++) for(let j=i+1;j<qs.length;j++){ const U=ext(qs[i].concat(qs[j])); quads.push({q:U,as:'frame'},{q:U,as:'page'}); }
  if(o.quads) o.quads.push(...quads);
  if(!quads.length) return {ok:false,reason:'не нашёл лист на фото: снимите лист целиком, на тёмном фоне'};
  const cand=[];
  quads.forEach(Q=>{ const q=Q.q, c0=[q.reduce((s,p)=>s+p[0],0)/4,q.reduce((s,p)=>s+p[1],0)/4], ord=q.slice().sort((a,b)=>Math.atan2(a[1]-c0[1],a[0]-c0[0])-Math.atan2(b[1]-c0[1],b[0]-c0[0]));
    const R=Q.as==='page'?[0,0,pg.w,pg.h]:FR, src=[[R[0],R[1]],[R[2],R[1]],[R[2],R[3]],[R[0],R[3]]];
    for(let r=0;r<4;r++){ const dst=[0,1,2,3].map(i=>ord[(i+r)%4]), sw=v2.dist(dst[0],dst[1])+v2.dist(dst[2],dst[3]), sh=v2.dist(dst[1],dst[2])+v2.dist(dst[3],dst[0]);
      const asp=Math.abs(Math.log((sh/sw)/((R[3]-R[1])/(R[2]-R[0])))); if(asp<0.3) cand.push({M:H.fit(src,dst),asp,r,as:Q.as}); } });
  if(!cand.length) return {ok:false,reason:'лист на фото не похож на А3, лежащий книжно (пропорции) — снимите лист целиком, сверху'};
  /* рамка, затем штамп; лучший кандидат — где штамп есть и рамка найдена */
  const dk=[]; for(let i=0;i<ink.a.length;i+=13) if(ink.a[i]>0.06) dk.push(ink.a[i]); dk.sort((a,b)=>a-b);
  const th=Math.max(0.1,Math.min(0.25,(dk[Math.floor(dk.length*0.9)]||0.3)*0.5));
  let best=null; const dbg=[];
  for(const c of cand){ const fr=RF.findFrame(ink,c.M,SHEET,th*0.6); if(!fr){ dbg.push(c.as+' r'+c.r+': рамки нет'); continue; }
    const M1=H.fit(fr.src,fr.quad);
    /* внутри рамки — бумага: на сетке 4 мм тёмных мест мало (узор скатерти, стол за краем листа дают много) */
    let dark=0, tot=0; for(let y=DS.FRAME[1]+2;y<DS.FRAME[3]-2;y+=4) for(let x=DS.FRAME[0]+2;x<DS.FRAME[2]-2;x+=4){ const P=H.apply(M1,[x,y]), v=sample(ink,P[0]-0.5,P[1]-0.5); tot++; if(v==null||v>0.15) dark++; }
    if(dark/tot>0.12){ dbg.push(c.as+' r'+c.r+': внутри рамки не бумага ('+Math.round(100*dark/tot)+' % тёмного)'); continue; }
    /* рамка: все четыре стороны прочерчены (иначе стороной взята строка штампа, ось или край тени) */
    const cov=sideCover(ink,M1,th*0.6); if(Math.min(...cov)<0.75){ dbg.push(c.as+' r'+c.r+': стороны рамки не прочерчены ('+cov.map(v=>v.toFixed(2)).join(' ')+')'); continue; }
    /* штамп: узор на месте против того же узора в противоположном углу (лист вверх ногами) */
    const A=titleShape(ink,M1,0.045,false), B=titleShape(ink,M1,0.045,true), ts={here:A.s,there:B.s,v:A.v,score:A.s-B.s};
    dbg.push(c.as+' r'+c.r+': стороны '+cov.map(v=>v.toFixed(2)).join(' ')+', штамп '+A.s.toFixed(2)+' против '+B.s.toFixed(2)+' (верх, левая, средняя, строки: '+A.v.map(v=>v.toFixed(2)).join(' ')+')');
    if(o.dump) o.dump.push({M1,c}); if(!best||ts.score>best.ts.score) best={M:M1,ts,c,fr}; }
  if(!best) return {ok:false,reason:'не нашёл рамку листа: проверьте, что лист целиком в кадре и рамка видна',dbg};
  if(best.ts.here<0.45||best.ts.score<0.25) return {ok:false,reason:'не нашёл основную надпись: лист должен лежать книжно, штамп — внизу справа',dbg};
  /* уточнение: рамка + линии штампа на гребень */
  const pts=[]; const F=[[FR[0],FR[1]],[FR[2],FR[1]],[FR[2],FR[3]],[FR[0],FR[3]]];
  for(let k=0;k<4;k++){ const a=F[k], b=F[(k+1)%4], L=v2.dist(a,b); for(let t=4;t<L-4;t+=1.5) pts.push({p:[a[0]+(b[0]-a[0])*t/L,a[1]+(b[1]-a[1])*t/L],w:1}); }
  DS.titleLines().forEach(([a,b])=>{ const L=v2.dist(a,b); for(let t=1;t<L-1;t+=1.5) pts.push({p:[a[0]+(b[0]-a[0])*t/L,a[1]+(b[1]-a[1])*t/L],w:0.5}); });
  const rr=RF.refineRidge(IMG.blur(ink,1),best.M,pts,F,20); let M=rr.M;
  /* поворот снимка: куда смотрит верх листа */
  const up=v2.sub(H.apply(M,[148,5]),H.apply(M,[148,415])), turn=(4-Math.round(((Math.atan2(-up[1],up[0])*180/Math.PI-90)%360+360)%360/90)%4)%4;   /* снимок повёрнут на turn·90° по часовой */
  const Mfull=f!==1?H.norm(H.mul([f,0,(f-1)/2,0,f,(f-1)/2,0,0,1],M)):M;
  const px=v2.dist(H.apply(Mfull,[150,200]),H.apply(Mfull,[151,200]));
  const res={ok:true,H:Mfull,Hi:H.inv(Mfull),turn,pxPerMm:px,title:best.ts,dbg,frame:F.map(p=>H.apply(Mfull,p))};
  if(px<3) return Object.assign(res,{ok:false,reason:'лист снят слишком мелко ('+px.toFixed(1)+' px на мм) — подойдите ближе'});
  /* эпюр в поле чертежа: тёмность поля в мм (4 px/мм) по полному фото */
  const FL=DS.FIELD, box=[FL[0]+2,FL[1]+2,FL[2]-2,FL[3]-2], fullInk=inkOf(img,Mfull,box), g=CL.warp(fullInk.ink,fullInk.M,box,4);
  Object.assign(res,axes(g,box));
  return res; }
/* рамка по Хафу: четыре самые длинные прямые, попарно почти параллельные и почти перпендикулярные, с пропорциями
   рамки А3 (410 : 272) — не зависит от того, виден ли край листа и где тень */
function frameHough(ink,th){ const f=2, w=Math.floor(ink.w/f), h=Math.floor(ink.h/f), a=new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let m=0; for(let j=0;j<f;j++) for(let i=0;i<f;i++){ const v=ink.a[(y*f+j)*ink.w+x*f+i]; if(v>m) m=v; } a[y*w+x]=m>=th*0.6?m:0; }
  /* только тонкие линии: в 4 px по обе стороны (по горизонтали или по вертикали) — бумага. Край листа на столе,
     тень и стол — не линии */
  const b=new Float32Array(w*h), at=(x,y)=>x<0||y<0||x>=w||y>=h?1:a[y*w+x];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const v=a[y*w+x]; if(!v) continue; const lo=0.4*v; if((at(x-4,y)<lo&&at(x+4,y)<lo)||(at(x,y-4)<lo&&at(x,y+4)<lo)) b[y*w+x]=v; }
  a.set(b);
  const TH=360, dth=Math.PI/TH, rmax=Math.hypot(w,h), NR=Math.ceil(2*rmax)+1, acc=new Float32Array(TH*NR), cs=[], sn=[]; for(let t=0;t<TH;t++){ cs.push(Math.cos(t*dth)); sn.push(Math.sin(t*dth)); }
  for(let y=0;y<h;y+=1) for(let x=0;x<w;x+=1){ const v=a[y*w+x]; if(!v) continue; for(let t=0;t<TH;t++){ const r=Math.round(x*cs[t]+y*sn[t]+rmax); acc[t*NR+r]+=v; } }
  /* пики с подавлением соседей */
  const peaks=[]; for(let k=0;k<16;k++){ let b=0, bi=-1; for(let i=0;i<acc.length;i++) if(acc[i]>b){ b=acc[i]; bi=i; } if(bi<0||b<=0) break;
    const t=Math.floor(bi/NR), r=bi%NR; peaks.push({t,r:r-rmax,v:b});
    for(let dt=-6;dt<=6;dt++) for(let dr=-12;dr<=12;dr++){ const tt=(t+dt+TH)%TH, rr=dt+t<0||dt+t>=TH?NR-1-(r+dr):r+dr; if(rr>=0&&rr<NR) acc[tt*NR+rr]=0; } }
  /* покрытие прямой: доля точек на отрезке между двумя другими прямыми, где есть чернила */
  const L=p=>({n:[cs[p.t],sn[p.t]],rho:p.r}), meet=(A,B)=>{ const d=A.n[0]*B.n[1]-A.n[1]*B.n[0]; if(Math.abs(d)<1e-6) return null; return [(A.rho*B.n[1]-B.rho*A.n[1])/d,(A.n[0]*B.rho-B.n[0]*A.rho)/d]; };
  const cover=(P,Q)=>{ const n=Math.max(10,Math.round(Math.hypot(Q[0]-P[0],Q[1]-P[1])/2)); let k=0; for(let i=0;i<=n;i++){ const x=Math.round(P[0]+(Q[0]-P[0])*i/n), y=Math.round(P[1]+(Q[1]-P[1])*i/n); let on=false;
      for(let d=-2;d<=2&&!on;d++) for(let e=-2;e<=2;e++){ const xx=x+d, yy=y+e; if(xx>=0&&yy>=0&&xx<w&&yy<h&&a[yy*w+xx]){ on=true; break; } } if(on) k++; } return k/(n+1); };
  const ang=(p,q)=>{ let d=Math.abs(p.t-q.t)*0.5; if(d>90) d=180-d; return d; };
  let best=null;
  for(let i=0;i<peaks.length;i++) for(let j=i+1;j<peaks.length;j++){ if(ang(peaks[i],peaks[j])>6) continue;
    for(let k=0;k<peaks.length;k++) for(let l=k+1;l<peaks.length;l++){ if(k===i||k===j||l===i||l===j) continue; if(ang(peaks[k],peaks[l])>6||Math.abs(ang(peaks[i],peaks[k])-90)>12) continue;
      const A=L(peaks[i]), B=L(peaks[j]), C=L(peaks[k]), D=L(peaks[l]); const Q=[meet(A,C),meet(C,B),meet(B,D),meet(D,A)]; if(Q.some(q=>!q)) continue;
      const s1=(Math.hypot(Q[0][0]-Q[1][0],Q[0][1]-Q[1][1])+Math.hypot(Q[2][0]-Q[3][0],Q[2][1]-Q[3][1]))/2, s2=(Math.hypot(Q[1][0]-Q[2][0],Q[1][1]-Q[2][1])+Math.hypot(Q[3][0]-Q[0][0],Q[3][1]-Q[0][1]))/2;
      const asp=Math.max(s1,s2)/Math.min(s1,s2); if(Math.abs(Math.log(asp/(410/272)))>0.18||Math.min(s1,s2)<0.3*Math.min(w,h)) continue;
      const cv=[0,1,2,3].map(m=>cover(Q[m],Q[(m+1)%4])); if(Math.min(...cv)<0.6) continue; const sc=cv.reduce((x,y)=>x+y,0)*Math.min(s1,s2);
      if(!best||sc>best.sc) best={sc,Q}; } }
  return best?best.Q.map(p=>[(p[0]+0.5)*f,(p[1]+0.5)*f]):null; }
/* карта тёмности по полному фото, только в прямоугольнике box (мм страницы) */
function inkOf(img,M,box){ const cs=[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]].map(p=>H.apply(M,p));
  const x0=Math.max(0,Math.floor(Math.min(...cs.map(p=>p[0]))-20)), y0=Math.max(0,Math.floor(Math.min(...cs.map(p=>p[1]))-20)), x1=Math.min(img.width,Math.ceil(Math.max(...cs.map(p=>p[0]))+20)), y1=Math.min(img.height,Math.ceil(Math.max(...cs.map(p=>p[1]))+20));
  const cr=IMG.rgba(x1-x0,y1-y0); for(let y=y0;y<y1;y++) cr.data.set(img.data.subarray((y*img.width+x0)*4,(y*img.width+x1)*4),((y-y0)*(x1-x0))*4);
  return {ink:CL.ink(cr).ink,M:H.norm(H.mul([1,0,-x0,0,1,-y0,0,0,1],M))}; }

/* оси эпюра по карте поля g (мм страницы, ppm px/мм): гребни → длинные почти горизонтальные/вертикальные прямые */
function axes(g,box){ const ppm=g.ppm, R=LN.ridges(g,1.2).R, w=g.w, h=g.h;
  const s=[]; for(let i=0;i<w*h;i+=7) s.push(R[i]); s.sort((a,b)=>a-b); const med=s[s.length>>1], mad=s.map(v=>Math.abs(v-med)).sort((a,b)=>a-b)[s.length>>1]*1.4826, tR=Math.max(0.01,med+6*mad), tL=Math.max(0.005,med+3*mad);
  /* проекции «гребень выше порога» на строки и столбцы — с допуском наклона ±1,5° сканируем прямые */
  const lineScan=(horiz)=>{ const out=[]; const N=horiz?h:w, Lmax=horiz?w:h;
    for(const sl of [-0.026,-0.013,0,0.013,0.026]) for(let c=0;c<N;c++){ let run=0, best=0, bs=0, cur=0, gap=0;
      for(let t=0;t<Lmax;t++){ const x=horiz?t:Math.round(c+sl*t), y=horiz?Math.round(c+sl*t):t; if(x<0||y<0||x>=w||y>=h){ gap++; continue; }
        let on=false; for(let d=-1;d<=1;d++){ const xx=horiz?x:x+d, yy=horiz?y+d:y; if(xx>=0&&yy>=0&&xx<w&&yy<h&&R[yy*w+xx]>=tR){ on=true; break; } }
        if(on){ if(!run) cur=t; run=t-cur+1; gap=0; if(run>best){ best=run; bs=cur; } } else if(++gap>3*ppm){ run=0; } }
      if(best>=40*ppm) out.push({c,sl,len:best/ppm,from:bs/ppm}); }
    out.sort((a,b)=>b.len-a.len); const kept=[]; out.forEach(l=>{ if(!kept.some(k=>Math.abs(k.c+k.sl*(k.from+l.len/2)*ppm-(l.c+l.sl*(l.from+l.len/2)*ppm))<3*ppm)) kept.push(l); });
    /* продолжение прямой с порогом вдвое ниже: бледный конец оси в тени не должен её укоротить (иначе ось z/y
       «найдётся» на линии связи у ложного конца) */
    kept.forEach(l=>{ const on=t=>{ const x=horiz?t:Math.round(l.c+l.sl*t), y=horiz?Math.round(l.c+l.sl*t):t; for(let d=-1;d<=1;d++){ const xx=horiz?x:x+d, yy=horiz?y+d:y; if(xx>=0&&yy>=0&&xx<w&&yy<h&&R[yy*w+xx]>=tL) return true; } return false; };
      let a=Math.round(l.from*ppm), b=Math.round((l.from+l.len)*ppm);
      for(let t=b, gap=0;t<Lmax&&gap<=4*ppm;t++){ if(on(t)){ b=t; gap=0; } else gap++; }
      for(let t=a, gap=0;t>=0&&gap<=4*ppm;t--){ if(on(t)){ a=t; gap=0; } else gap++; }
      l.from=a/ppm; l.len=(b-a)/ppm; });
    return kept; };
  const mm=(horiz,l,t)=>{ const tt=t*ppm, p=horiz?[tt,l.c+l.sl*tt]:[l.c+l.sl*tt,tt]; return [box[0]+p[0]/ppm,box[1]+p[1]/ppm]; };
  const Hs=lineScan(true), Vs=lineScan(false);
  if(!Hs.length) return {axis:null,O:null,axisWhy:'не нашёл ось x (длинную горизонтальную линию)'};
  const ax=Hs[0], axA=mm(true,ax,ax.from), axB=mm(true,ax,ax.from+ax.len);
  /* ось z/y: вертикаль, пересекающая ось x, длиной ≥ 60 мм, выше и ниже оси — самая правая из таких */
  const cross=Vs.map(l=>{ const a=mm(false,l,l.from), b=mm(false,l,l.from+l.len); const yAx=axA[1]+(axB[1]-axA[1])*((a[0]-axA[0])/((axB[0]-axA[0])||1));
      return {l,a,b,above:yAx-a[1],below:b[1]-yAx,x:(a[0]+b[0])/2,yAx}; })
    .filter(c=>c.above>20&&c.below>20&&c.l.len>=60&&c.x>=axA[0]-5&&c.x<=axB[0]+5).sort((p,q)=>q.x-p.x);
  /* ось z/y — длинная вертикаль у правого конца оси x (ось x кончается на ней или чуть правее, ≤ 15 мм), правее
     неё оси x почти нет; линии связи стоят левее и ось x уходит за них. Ошибка в O проверится таблицей варианта */
  const z=cross.find(c=>c.l.len>=40&&axB[0]-c.x<=15&&axB[0]-c.x>=-3)||null;
  const O=z?[z.a[0]+(z.b[0]-z.a[0])*((z.yAx-z.a[1])/((z.b[1]-z.a[1])||1)),z.yAx]:null;
  return {axis:[axA,axB],zAxis:z?[z.a,z.b]:null,O,axisWhy:z?null:'ось z/y не найдена — начало O определится по таблице варианта'}; }

put('dzLocate',{locate,titleShape,axes,inkOf});
})();
