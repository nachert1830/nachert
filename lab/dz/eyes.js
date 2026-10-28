/* ═══════════ Глаза и мозг: подписи нейросети → точная геометрия → ядро ═══════════
   «Глаза» — модель со зрением (на сервере кабинета, server/lib/eyes.js). Она говорит, ЧТО на фото и ПРИМЕРНО ГДЕ:
   какое ДЗ, сколько чертежей на листе, какая часть на каждом, где подписанные точки условия (A″, B′, …) и начало O.
   Её координаты грубые (± 1–3 % кадра), подписи она может перепутать. Мерить по ним нельзя — только начать.
   «Мозг» — наша геометрия и ядро:
   1. Привязка: точки условия варианта (их мм известны) ↔ точки глаз (px). Аффинное по трём точкам — перебор всех
      троек, лучшая — с наибольшим числом согласных точек (≤ 5 мм). Перепутанная подпись не согласна — выпадает.
      Зеркальное (det < 0) и невероятный масштаб отбрасываются. Согласных меньше 4 — отказ: «глаза не сходятся с условием».
   2. Чертёж выпрямляется по привязке, линии оцифровываются (lines.js), фигура условия подгоняется (calib.js),
      каждая точка условия измеряется по своим рёбрам (given.js).
   3. Уточнение: гомография «мм условия → мм листа» по измеренным точкам — перебором четвёрок, допуск 0,8 мм
      (неверно нанесённая точка выпадает и остаётся ошибкой нанесения, а не тянет перспективу). Два прохода.
   4. Дальше — тот же путь, что у листа в клетку и чистого листа (gridsheet.js): заданное как начерчено, построение
      частей, шаги, вердикт. Масштаб и перспективу здесь даёт сама фигура условия — σ замера не меньше 0,5 мм.
   Отказ на любом шаге — «не могу прочитать» с причиной. Глаза ничего не утверждают сами: вердикт — только по линиям.

   Формат глаз (ответ модели после разбора, parse()):
     {dz, n?, drawings:[{part?:'a'|'b'|'c'|'d', box?:[x0,y0,x1,y1] px, pts:{'A″':[x,y], 'A′':[x,y], …, 'O':[x,y]}}]}
   parse(text|obj) → тот же формат или {error}
   prepareEyes(img, drawing, {dz, n}) → {ok, reason, scan, dig, box, map, origin, n, why[], cands, fit}
   checkEyes(img, eyes, {dz, n, answers}) → {ok, verdict, drawings:[результат checkGridPhoto для каждого чертежа], why[]} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const L=n=>isNode?require('./'+n+'.js'):self.LAB[{grid:'dzGrid',calib:'dzCalib',given:'dzGiven',model:'dzModel',gridsheet:'dzGridSheet',check:'dzCheck',paper:'dzPaper'}[n]];
/* o.clean — очиститель карандаша (второй проход): передаётся в оцифровку */
const IMG=isNode?require('../img.js'):self.LAB.img, LN=isNode?require('../lines.js'):self.LAB.lines, V=isNode?require('../../core/dz-variants.js'):self.CORE.dzVariants;
const H=IMG.H;
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');

/* ── подписи: «A''», «A"», «A″», «А2» (кириллица), «a_1» → {n:'A', pr:'f'|'h'}; «O», «0» → начало ── */
const CYR={'А':'A','В':'B','С':'C','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','Т':'T','Х':'X','S':'S','Ѕ':'S'};
function label(s){ s=String(s||'').trim().replace(/[АВСЕКМНОРТХЅ]/g,ch=>CYR[ch]||ch).replace(/\s+/g,'');
  if(/^[O0Оo]$/.test(s)) return {n:'O',pr:null};
  const m=s.match(/^([A-Za-z])(?:_?([12])|(″|"|''|ʺ|〃)|(′|'|ʹ|’|`))?$/); if(!m) return null;
  const pr=m[2]?(m[2]==='2'?'f':'h'):m[3]?'f':m[4]?'h':null; if(!pr) return null;
  return {n:m[1].toUpperCase(),pr}; }
const key=q=>q.n==='O'?'O':q.n+(q.pr==='f'?'″':'′');
/* ответ модели: JSON (возможно, в ```…``` или с текстом вокруг) → проверенный формат */
function parse(x){ let o=x;
  if(typeof x==='string'){ const t=x.replace(/```(?:json)?/g,''), a=t.indexOf('{'), b=t.lastIndexOf('}'); if(a<0||b<a) return {error:'в ответе глаз нет JSON'};
    try{ o=JSON.parse(t.slice(a,b+1)); }catch(e){ return {error:'ответ глаз — не JSON: '+String(e.message||e)}; } }
  if(!o||typeof o!=='object') return {error:'пустой ответ глаз'};
  const num=v=>typeof v==='number'&&isFinite(v)?v:typeof v==='string'&&v.trim()&&isFinite(+v)?+v:null;
  const pt=p=>Array.isArray(p)&&p.length>=2&&num(p[0])!=null&&num(p[1])!=null?[num(p[0]),num(p[1])]:p&&typeof p==='object'&&num(p.x)!=null&&num(p.y)!=null?[num(p.x),num(p.y)]:null;
  const dr=Array.isArray(o.drawings)?o.drawings:o.pts||o.points?[o]:[];
  const drawings=dr.map(d=>{ const pts={}; let src=d.pts||d.points||{};
      /* точки — объектом {A″:[x,y]} или списком [{label:'A″', x, y} | {label, at:[x,y]}] */
      if(Array.isArray(src)) src=Object.fromEntries(src.map(q=>[q&&(q.label||q.l||q.name),q&&(q.at||q.p||q)]));
      Object.entries(src).forEach(([l,p])=>{ const q=label(l), P=pt(p); if(q&&P) pts[key(q)]=P; });
      const box=Array.isArray(d.box)&&d.box.length===4&&d.box.every(v=>num(v)!=null)?d.box.map(num):null;
      const part=/^[abcd]$/.test(String(d.part||''))?String(d.part):({'1':'a','2':'b','3':'c','4':'d'})[String(d.part||'')]||null;
      return {part,box,pts,scale:num(d.scale)}; }).filter(d=>Object.keys(d.pts).length);
  if(!drawings.length) return {error:'глаза не нашли на фото подписанных точек условия'};
  const dz=num(o.dz), n=num(o.n||o.variant);
  return {dz:dz&&dz>=1&&dz<=5?dz:null,n:n&&n>=1&&n<=30?Math.round(n):null,drawings}; }

/* ── привязка по глазам: мм условия (чертёж, от O) → px ── */
/* аффинное по 3 парам: px = A·m + t */
function aff3(M,P){ const [a,b,c]=M, [p,q,r]=P, d=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]); if(Math.abs(d)<1e-6) return null;
  const sol=k=>{ const u=(q[k]-p[k]), v=(r[k]-p[k]); const A0=(u*(c[1]-a[1])-v*(b[1]-a[1]))/d, A1=(v*(b[0]-a[0])-u*(c[0]-a[0]))/d; return [A0,A1,p[k]-A0*a[0]-A1*a[1]]; };
  const X=sol(0), Y=sol(1); return [X[0],X[1],X[2],Y[0],Y[1],Y[2]]; }
const affAt=(A,m)=>[A[0]*m[0]+A[1]*m[1]+A[2],A[3]*m[0]+A[4]*m[1]+A[5]];
/* МНК аффинного по парам */
function affLS(M,P){ const n=M.length; if(n<3) return null; const S=Array.from({length:3},()=>new Array(5).fill(0));
  M.forEach((m,i)=>{ const r=[m[0],m[1],1]; for(let a=0;a<3;a++){ for(let b=0;b<3;b++) S[a][b]+=r[a]*r[b]; S[a][3]+=r[a]*P[i][0]; S[a][4]+=r[a]*P[i][1]; } });
  const sv=k=>{ const A=S.map(r=>[r[0],r[1],r[2],r[3+k]]); for(let c=0;c<3;c++){ let p=c; for(let r=c+1;r<3;r++) if(Math.abs(A[r][c])>Math.abs(A[p][c])) p=r; if(Math.abs(A[p][c])<1e-9) return null; [A[c],A[p]]=[A[p],A[c]];
      for(let r=0;r<3;r++){ if(r===c) continue; const f=A[r][c]/A[c][c]; for(let j=c;j<4;j++) A[r][j]-=f*A[c][j]; } } return A.map((r,i)=>r[3]/r[i]); };
  const X=sv(0), Y=sv(1); return X&&Y?[X[0],X[1],X[2],Y[0],Y[1],Y[2]]:null; }
const detA=A=>A[0]*A[4]-A[1]*A[3];
/* пары «точка условия ↔ точка глаз» для варианта */
function pairs(drawing,id,data){ const g=L('model').given(id,data), out=[];
  g.pts.forEach(q=>{ const p=drawing.pts[q.l]; if(p) out.push({l:q.l,pr:q.pr,m:q.at,p}); });
  if(drawing.pts.O) out.push({l:'O',pr:null,m:[0,0],p:drawing.pts.O});
  return out; }
/* лучшая аффинная привязка: перебор троек, согласные — в 5 мм; px/мм — в 1,2…60 (фото целиком … макро) */
/* допуск — 5 мм, но не меньше 2,5 % кадра (o.px): глаза ошибаются в долях кадра, а лист целиком в кадре — это ~2 px/мм */
function bindAffine(P,o){ o=o||{}; const tol0=o.tol||5, px=o.px||0, sR=o.sRange||[1.2,60]; let best=null; const n=P.length;
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) for(let k=j+1;k<n;k++){ const A=aff3([P[i].m,P[j].m,P[k].m],[P[i].p,P[j].p,P[k].p]); if(!A) continue;
    const dt=detA(A); if(dt<=0) continue; const s=Math.sqrt(dt); if(s<sR[0]||s>sR[1]) continue; const tol=Math.max(tol0,px/s);
    /* перекос: оси чертежа на фото — почти перпендикулярны и почти одного масштаба (телефон над листом) */
    /* телефон над листом: наклон до ~30° сжимает одну ось не больше чем в 1,25 раза; сильнее — координаты глаз не в
       px этого фото (шкала 0…1000 у прямоугольного кадра) или подписи перепутаны */
    const ex=Math.hypot(A[0],A[3]), ey=Math.hypot(A[1],A[4]), cs=Math.abs(A[0]*A[1]+A[3]*A[4])/(ex*ey); if(ex/ey>1.25||ey/ex>1.25||cs>0.3) continue;
    const res=P.map(q=>{ const r=affAt(A,q.m); return Math.hypot(r[0]-q.p[0],r[1]-q.p[1])/s; }), inl=res.map(r=>r<=tol), ni=inl.filter(Boolean).length, sum=res.reduce((a,r,t)=>a+(inl[t]?r:tol),0);
    if(!best||ni>best.ni||ni===best.ni&&sum<best.sum) best={A,ni,sum,inl}; }
  if(!best) return null;
  /* МНК по согласным и повторный отбор */
  let inP=P.filter((q,t)=>best.inl[t]), A=affLS(inP.map(q=>q.m),inP.map(q=>q.p))||best.A;
  const tol=Math.max(tol0,px/Math.sqrt(Math.abs(detA(A))));
  for(let it=0;it<2;it++){ const s=Math.sqrt(Math.abs(detA(A))); inP=P.filter(q=>{ const r=affAt(A,q.m); return Math.hypot(r[0]-q.p[0],r[1]-q.p[1])/s<=tol; }); const A2=inP.length>=3?affLS(inP.map(q=>q.m),inP.map(q=>q.p)):null; if(A2&&detA(A2)>0) A=A2; }
  const s=Math.sqrt(detA(A)), res=inP.map(q=>{ const r=affAt(A,q.m); return Math.hypot(r[0]-q.p[0],r[1]-q.p[1])/s; });
  const ex=Math.hypot(A[0],A[3]), ey=Math.hypot(A[1],A[4]), aniso=Math.max(ex/ey,ey/ex)-1+Math.abs(A[0]*A[1]+A[3]*A[4])/(ex*ey);
  return {A,s,aniso,inl:inP,out:P.filter(q=>!inP.includes(q)),rms:Math.sqrt(res.reduce((a,r)=>a+r*r,0)/Math.max(1,res.length))}; }

/* ── уточнение: гомография мм условия → мм листа по измеренным точкам (перебор четвёрок, допуск tol) ── */
function bindHom(P,tol){ const n=P.length; if(n<4) return null; let best=null;
  const resOf=M=>P.map(q=>{ const r=H.apply(M,q.m); return Math.hypot(r[0]-q.p[0],r[1]-q.p[1]); });
  for(let a=0;a<n;a++) for(let b=a+1;b<n;b++) for(let c=b+1;c<n;c++) for(let d=c+1;d<n;d++){ const S=[P[a],P[b],P[c],P[d]], M=H.fit(S.map(q=>q.m),S.map(q=>q.p)); if(!M||M.some(v=>!isFinite(v))) continue;
    const r=resOf(M), ni=r.filter(x=>x<=tol).length, sum=r.reduce((s,x)=>s+Math.min(x,tol),0); if(!best||ni>best.ni||ni===best.ni&&sum<best.sum) best={M,ni,sum}; }
  if(!best||best.ni<5) return null;
  let M=best.M; for(let it=0;it<3;it++){ const r=resOf(M), I=P.filter((q,t)=>r[t]<=tol); const M2=I.length>=5?H.fit(I.map(q=>q.m),I.map(q=>q.p)):null; if(M2&&M2.every(v=>isFinite(v))) M=M2; }
  const r=resOf(M), I=P.filter((q,t)=>r[t]<=tol), rr=r.filter(x=>x<=tol);
  return {M,inl:I,out:P.filter((q,t)=>r[t]>tol),rms:Math.sqrt(rr.reduce((s,x)=>s+x*x,0)/Math.max(1,rr.length))}; }

/* ── затравка без доверия к подписям: подобие по медианам (Тейл — Сен) — масштаб и поворот по парам точек, сдвиг по
   точкам. Перепутанная подпись портит только свои пары, медиана её не замечает ── */
function seedSim(P){ if(P.length<3) return null; const sc=[], an=[];
  for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){ const dm=[P[j].m[0]-P[i].m[0],P[j].m[1]-P[i].m[1]], dp=[P[j].p[0]-P[i].p[0],P[j].p[1]-P[i].p[1]], lm=Math.hypot(...dm), lp=Math.hypot(...dp);
    if(lm<8||lp<4) continue; sc.push(lp/lm); let a=Math.atan2(dp[1],dp[0])-Math.atan2(dm[1],dm[0]); while(a>Math.PI) a-=2*Math.PI; while(a<-Math.PI) a+=2*Math.PI; an.push(a); }
  if(sc.length<3) return null; const md=a=>a.slice().sort((x,y)=>x-y)[a.length>>1], k=md(sc), th=md(an), c=Math.cos(th)*k, sn=Math.sin(th)*k;
  const tx=md(P.map(q=>q.p[0]-(c*q.m[0]-sn*q.m[1]))), ty=md(P.map(q=>q.p[1]-(sn*q.m[0]+c*q.m[1])));
  return [c,-sn,tx,sn,c,ty]; }
/* ── поиск фигуры условия по линиям (шаблон известен точно): у затравки A (мм условия → px) перебор сдвига ± 36 мм,
   поворота ± 16° и масштаба ×0,7…1,4 — где точки фигуры условия ложатся на линии фото (карта расстояний, допуск 1,2 мм).
   Глазам достаточно сказать «чертёж примерно тут»: промах в 2–3 см и перепутанные подписи поиск не сбивают.
   Возвращает уточнённое A и покрытие лучшего и второго (отдельного) положения — запас против чужой копии рядом ── */
function searchFigure(img,A,gv,o){ o=o||{}; const C=L('calib'), g=L('model').given(gv.id,gv.data), fig=g.segs.flatMap(q=>[q.a,q.b]).concat([[0,0]]);
  const R=o.r||36, F=[Math.min(...fig.map(p=>p[0]))-R-8,Math.min(...fig.map(p=>p[1]))-R-8,Math.max(...fig.map(p=>p[0]))+R+8,Math.max(...fig.map(p=>p[1]))+R+8];
  const cO=[-Math.floor(F[0]),-Math.floor(F[1])], box=[0,0,Math.ceil(F[2]-F[0]),Math.ceil(F[3]-F[1])];
  const dg=digitize(img,(u,v)=>affAt(A,[u-cO[0],v-cO[1]]),box,4,o.clean); if(!dg.ok) return null;
  const D=C.dmap(dg.dig.map), SA=C.samples(gv.id,gv.data).S.map(q=>q.m), at=p=>C.at(D,p);
  /* грубо — по ~80 точкам фигуры, сдвиг через 2 мм; точно — по каждой третьей (через 1,5 мм) у пяти лучших мест */
  const S0=SA.filter((q,i)=>i%Math.max(1,Math.round(SA.length/80))===0), S=SA.filter((q,i)=>i%3===0);
  const cov=(th,k,tx,ty,tol,SS)=>{ const c=Math.cos(th)*k, sn=Math.sin(th)*k; let n=0; for(const m of SS){ if(at([cO[0]+tx+c*m[0]-sn*m[1],cO[1]+ty+sn*m[0]+c*m[1]])<=tol) n++; } return n/SS.length; };
  const res=[]; const deg=Math.PI/180;
  /* o.th, o.lk — пределы поворота (°) и масштаба (шагов ×1,05): у своих глаз привязка уже точная — искать только рядом */
  const TH=o.th||16, LK=o.lk==null?7:o.lk;
  for(let th=-TH;th<=TH;th+=2) for(let lk=-LK;lk<=LK;lk++){ const k=Math.pow(1.05,lk);
    for(let ty=-R;ty<=R;ty+=2) for(let tx=-R;tx<=R;tx+=2){ const v=cov(th*deg,k,tx,ty,1.6,S0); if(v>=0.35) res.push({v,th,k,tx,ty}); } }
  res.sort((a,b)=>b.v-a.v); if(!res.length) return {A,cover:0,second:0,shift:0,rot:0,k:1};
  /* пять отдельных мест (не ближе 4 мм / 3°) — уточнение каждого, лучшее — найденное */
  const tops=[]; for(const q of res){ if(tops.every(t=>Math.hypot(t.tx-q.tx,t.ty-q.ty)>4||Math.abs(t.th-q.th)>3)) tops.push(q); if(tops.length>=5) break; }
  const fine=tops.map(b0=>{ let b=Object.assign({},b0,{v:cov(b0.th*deg,b0.k,b0.tx,b0.ty,1.2,S)});
    for(const [dth,dk,dt] of [[1,0.02,1],[0.5,0.01,0.5],[0.25,0.005,0.25]]){ let bb=b; for(let th=b.th-2*dth;th<=b.th+2*dth+1e-9;th+=dth) for(let k=b.k-2*dk;k<=b.k+2*dk+1e-9;k+=dk) for(let ty=b.ty-2*dt;ty<=b.ty+2*dt+1e-9;ty+=dt) for(let tx=b.tx-2*dt;tx<=b.tx+2*dt+1e-9;tx+=dt){ const v=cov(th*deg,k,tx,ty,1.2,S); if(v>bb.v) bb={v,th,k,tx,ty}; } b=bb; }
    return b; }).sort((a,b)=>b.v-a.v);
  const b=fine[0];
  /* второе положение — отдельное (дальше 6 мм или 5°) */
  const sec=fine.find(q=>Math.hypot(q.tx-b.tx,q.ty-b.ty)>6||Math.abs(q.th-b.th)>5)||{v:0};
  const c=Math.cos(b.th*deg)*b.k, sn=Math.sin(b.th*deg)*b.k, L2=[c,-sn,sn,c];
  /* A′(m) = A(t + k·R·m) */
  const An=[A[0]*L2[0]+A[1]*L2[2],A[0]*L2[1]+A[1]*L2[3],A[0]*b.tx+A[1]*b.ty+A[2],A[3]*L2[0]+A[4]*L2[2],A[3]*L2[1]+A[4]*L2[3],A[3]*b.tx+A[4]*b.ty+A[5]];
  return {A:An,cover:b.v,second:sec.v,shift:Math.hypot(b.tx,b.ty),rot:b.th,k:b.k}; }

/* ── свои глаза, без модели: край листа → лист выпрямлен (книжный А4, А3 — тот же лист ×√2) → перебор по всему листу,
   где лежат копии фигуры условия (ДЗ №3 — четыре чертежа, у каждого своя). Лист А4 или А3, перевёрнут или нет —
   гипотезы. Каждое найденное место (≥ 55 % фигуры на линиях, не ближе 40 мм к другому) — чертёж с готовой привязкой.
   findDrawings(img, {dz, n}) → {ok, reason, drawings:[{A (мм условия → px), cover}], page} ── */
function findDrawings(img,o){ o=o||{}; const dz=+o.dz||3, gv=V.get(dz,+o.n); if(!gv) return {ok:false,reason:'нужен номер варианта'};
  const PA=L('paper'), C=L('calib'), P=PA.findPaper(img);
  /* край листа есть — лист выпрямлен (А4 в мм; А3 — масштаб 1/√2); нет (лист обрезан, светлый фон) — сам кадр в «мм»:
     длинная сторона кадра = 420 мм, а настоящий масштаб и поворот телефона (0/90/180/270°) — гипотезы перебора */
  let Ha=P.ok?PA.pageHom(P.quad):null, raw=!Ha, box=[0,0,210,297];
  if(raw){ const s0=Math.max(img.width,img.height)/420; Ha=[s0,0,0,0,s0,0,0,0,1]; box=[0,0,Math.floor(img.width/s0),Math.floor(img.height/s0)]; }
  const dg=digitize(img,(u,v)=>H.apply(Ha,[u,v]),box,4,o.clean); if(!dg.ok) return {ok:false,reason:dg.reason};
  const D=C.dmap(dg.dig.map), SA=C.samples(gv.id,gv.data).S.map(q=>q.m), S0=SA.filter((q,i)=>i%Math.max(1,Math.round(SA.length/80))===0), S=SA.filter((q,i)=>i%3===0), at=p=>C.at(D,p), deg=Math.PI/180;
  const g=L('model').given(gv.id,gv.data), fig=g.segs.flatMap(q=>[q.a,q.b]).concat([[0,0]]), fx=[Math.min(...fig.map(p=>p[0])),Math.max(...fig.map(p=>p[0]))], fy=[Math.min(...fig.map(p=>p[1])),Math.max(...fig.map(p=>p[1]))];
  const cov=(th,k,tx,ty,tol,SS)=>{ const c=Math.cos(th)*k, sn=Math.sin(th)*k; let n=0; for(const m of SS){ if(at([tx+c*m[0]-sn*m[1],ty+sn*m[0]+c*m[1]])<=tol) n++; } return n/SS.length; };
  /* фон: точки рядом с фигурой (в 2,5…4 мм от её отрезков, где линий условия нет). У верного места там чаще пусто
     (только линии построений), а фигура, уменьшенная до «помещается куда угодно», лежит в гуще линий — фон тоже на
     линиях. Мера места — строгая минус фон */
  const dSeg=(p,q)=>{ const ax=q.b[0]-q.a[0], ay=q.b[1]-q.a[1], L2=ax*ax+ay*ay||1, t=Math.max(0,Math.min(1,((p[0]-q.a[0])*ax+(p[1]-q.a[1])*ay)/L2)); return Math.hypot(p[0]-q.a[0]-t*ax,p[1]-q.a[1]-t*ay); };
  const BG=[]; S.forEach(m=>[[3,0],[-3,0],[0,3],[0,-3]].forEach(([dx,dy])=>{ const p=[m[0]+dx,m[1]+dy]; if(g.segs.every(q=>dSeg(p,q)>=2.5)) BG.push(p); }));
  const BG0=BG.filter((p,i)=>i%Math.max(1,Math.round(BG.length/60))===0), bgOf=b=>BG.length?cov(b.th*deg,b.k,b.tx,b.ty,0.5*b.k,BG):0;
  const res=[], S1=raw?S0.filter((q,i)=>i%2===0):S0, step=raw?3:2;
  const hyps=raw?[].concat(...[0,90,180,270].map(fl=>Array.from({length:21},(_,i)=>[Math.pow(1.05,i-12),'кадр',fl]))):[].concat(...[[1,'A4'],[Math.SQRT1_2,'A3']].map(([s0,pg])=>[0,180].map(fl=>[s0,pg,fl])));
  for(const [s0,pg,flip] of hyps) for(let th=-4;th<=4;th+=(raw?4:2)) for(const kk of (raw?[1]:[0.95,1,1.05])){ const k=s0*kk, t=(flip+th)*deg;
    for(let ty=0;ty<=box[3];ty+=step) for(let tx=0;tx<=box[2];tx+=step){ const v=cov(t,k,tx,ty,Math.min(1.5,1.6*k),S1); if(v>=0.45) res.push({v,th:flip+th,k,tx,ty,pg}); } }
  /* в очередь мест — с поправкой на фон (иначе её заполняет фигура малого масштаба в гуще построений) */
  res.forEach(q=>{ q.v0=q.v; q.v=q.v-cov(q.th*deg,q.k,q.tx,q.ty,Math.min(1.5,1.6*q.k),BG0); });
  /* места: лучшее, затем следующее не ближе 40 мм; уточнение каждого. Две очереди — по покрытию и по покрытию за
     вычетом фона (на мелком настоящем фото линии толстые, фон у верного места тоже заметен) */
  const tops=[], pick=(key,N)=>{ let k0=0; for(const q of res.slice().sort((a,b)=>b[key]-a[key])){ if(tops.every(t=>Math.hypot(t.tx-q.tx,t.ty-q.ty)>=40*Math.min(t.k,q.k)||Math.abs(t.k/q.k-1)>0.1||Math.abs(t.th-q.th)>3)){ tops.push(q); if(++k0>=N) break; } } };
  pick('v',10); pick('v0',10); tops.forEach(q=>{ q.v=q.v0; });
  const found=tops.map(b0=>{ let b=Object.assign({},b0,{v:cov(b0.th*deg,b0.k,b0.tx,b0.ty,1.2*b0.k,S)});
    for(const [dth,dk,dt] of [[1,0.02,1],[0.5,0.01,0.5],[0.25,0.005,0.25]]){ let bb=b; for(let th=b.th-2*dth;th<=b.th+2*dth+1e-9;th+=dth) for(let k=b.k*(1-2*dk);k<=b.k*(1+2*dk)+1e-9;k+=b.k*dk) for(let ty=b.ty-2*dt;ty<=b.ty+2*dt+1e-9;ty+=dt) for(let tx=b.tx-2*dt;tx<=b.tx+2*dt+1e-9;tx+=dt){ const v=cov(th*deg,k,tx,ty,0.8*k,S); if(v>bb.v) bb={v,th,k,tx,ty,pg:b.pg}; } b=bb; }
    return b; });
  /* строгая мера: доля ВСЕХ точек фигуры в 0,5 мм настоящего листа (допуск / масштаб) — у верного места ~ 0,9…1,
     у случайного совпадения с построениями — заметно меньше */
  found.forEach(b=>{ b.strict=cov(b.th*deg,b.k,b.tx,b.ty,0.5*b.k,SA); b.bg=bgOf(b); });
  if(o.dbg) console.log('места:',tops.map((t,i)=>Math.round(t.v*100)+'→'+Math.round(found[i].v*100)+'/'+Math.round(found[i].strict*100)+'% фон '+Math.round(found[i].bg*100)+'% k'+found[i].k.toFixed(2)+' θ'+found[i].th+' ('+found[i].tx.toFixed(0)+','+found[i].ty.toFixed(0)+')').join(' | '));
  /* лист один: масштаб и поворот у всех чертежей общие — по лучшему (строгая мера), остальные должны совпасть (± 4 %, ± 3°) */
  const sc=b=>b.strict-b.bg, ok=found.filter(b=>b.strict>=0.6&&sc(b)>=0.3).sort((a,b)=>sc(b)-sc(a)); if(!ok.length){ found.length=0; }
  else { const r0=ok[0];
    /* второй этап: масштаб и поворот листа известны — по всему листу ищем все копии фигуры с ними (± 3 %, ± 2°) */
    const res2=[]; for(let th=r0.th-2;th<=r0.th+2;th+=1) for(const kk of [0.97,1,1.03]){ const k=r0.k*kk;
      for(let ty=0;ty<=box[3];ty+=1.5) for(let tx=0;tx<=box[2];tx+=1.5){ const v=cov(th*deg,k,tx,ty,Math.min(1.5,1.2*k),S0); if(v>=0.5) res2.push({v,th,k,tx,ty,pg:r0.pg}); } }
    res2.sort((a,b)=>b.v-a.v); const t2=[]; for(const q of res2){ if(t2.every(t=>Math.hypot(t.tx-q.tx,t.ty-q.ty)>=40*q.k)) t2.push(q); if(t2.length>=8) break; }
    const f2=t2.map(b0=>{ let b=b0; for(const dt of [0.5,0.25]){ let bb=Object.assign({},b,{v:cov(b.th*deg,b.k,b.tx,b.ty,0.8*b.k,S)}); for(let ty=b.ty-3*dt;ty<=b.ty+3*dt+1e-9;ty+=dt) for(let tx=b.tx-3*dt;tx<=b.tx+3*dt+1e-9;tx+=dt){ const v=cov(b.th*deg,b.k,tx,ty,0.8*b.k,S); if(v>bb.v) bb=Object.assign({},b,{v,tx,ty}); } b=bb; }
      b.strict=cov(b.th*deg,b.k,b.tx,b.ty,0.5*b.k,SA); b.bg=bgOf(b); return b; }).filter(b=>b.strict>=0.6&&sc(b)>=0.3);
    if(o.dbg) console.log('второй этап:',f2.map(b=>Math.round(b.strict*100)+'%/фон '+Math.round(b.bg*100)+'% ('+b.tx.toFixed(0)+','+b.ty.toFixed(0)+')').join(' | '));
    /* и найденное на первом этапе с другим масштабом (перспектива: чертёж ближе к камере крупнее на 10–15 %) */
    const all=f2.concat(ok).sort((a,b)=>sc(b)-sc(a)), uniq=[]; all.forEach(b=>{ if(uniq.every(u=>Math.hypot(u.tx-b.tx,u.ty-b.ty)>=40*Math.min(u.k,b.k))) uniq.push(b); });
    found.splice(0,found.length,...uniq); }
  /* лист один: А4 или А3 и поворот — по большинству найденного; чужие гипотезы отбрасываются */
  if(!found.length) return {ok:false,reason:'на листе не нашёл фигуру условия варианта '+o.n+(tops[0]?' (лучшее место — '+Math.round(tops[0].v*100)+' % на линиях)':'')};
  const key=b=>b.pg+':'+(Math.round((((b.th%360)+360)%360)/90)%4*90), cnt={}; found.forEach(b=>{ cnt[key(b)]=(cnt[key(b)]||0)+b.v; });
  const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0], keep=found.filter(b=>key(b)===best).sort((a,b)=>a.ty-b.ty||a.tx-b.tx);
  const drawings=keep.map(b=>{ const c=Math.cos(b.th*deg)*b.k, sn=Math.sin(b.th*deg)*b.k;
    /* A(m) = Ha(t + k·R·m) — гомография листа, линеаризованная у центра фигуры (дальше чертёж уточняется своей гомографией) */
    const m0=[(fx[0]+fx[1])/2,(fy[0]+fy[1])/2], q0=[b.tx+c*m0[0]-sn*m0[1],b.ty+sn*m0[0]+c*m0[1]], p0=H.apply(Ha,q0), e=1, pu=H.apply(Ha,[q0[0]+e,q0[1]]), pv=H.apply(Ha,[q0[0],q0[1]+e]);
    const J=[(pu[0]-p0[0])/e,(pv[0]-p0[0])/e,(pu[1]-p0[1])/e,(pv[1]-p0[1])/e], Lm=[J[0]*c+J[1]*sn,-J[0]*sn+J[1]*c,J[2]*c+J[3]*sn,-J[2]*sn+J[3]*c];
    return {A:[Lm[0],Lm[1],p0[0]-Lm[0]*m0[0]-Lm[1]*m0[1],Lm[2],Lm[3],p0[1]-Lm[2]*m0[0]-Lm[3]*m0[1]],cover:b.v,pts:{}}; });
  return {ok:true,drawings,page:raw?'без края листа':best.split(':')[0],turn:+best.split(':')[1]}; }

/* выпрямить поле чертежа по map и оцифровать */
function digitize(img,map,box,ppm,clean){ const G=L('grid'), sc=G.rectify(img,{map,box},{ppm,box}), ex=LN.extract(sc.img,{H:sc.H},{sheet:{O:[0,0],roi:box,given:()=>[]},maxIter:300,clean});
  if(!ex.ok) return {ok:false,reason:ex.reason}; return {ok:true,sc,dig:{ok:true,origin:'page',O:[0,0],box,segs:ex.segs,map:ex.map}}; }

/* ── один чертёж: глаза → привязка → уточнение → оцифровка в мм условия ── */
function prepareEyes(img,drawing,o){ o=o||{}; const dz=+o.dz||3, why=[], C=L('calib'), GV=L('given'), GS=L('gridsheet');
  /* вариант: указан — он; нет — все 30: по глазам выбираем, чьё условие лучше объясняет подписанные точки */
  const ns=+o.n?[+o.n]:Array.from({length:30},(_,i)=>i+1), hyp=[];
  /* привязка уже есть (свои глаза: findDrawings) — только уточнить поиском рядом */
  if(drawing.A&&+o.n){ const gv=V.get(dz,+o.n), A=drawing.A; hyp.push({n:+o.n,gv,P:[],b:{A,s:Math.sqrt(Math.abs(detA(A))),aniso:0,inl:[],out:[],rms:NaN,seed:true,own:true}}); }
  else ns.forEach(n=>{ const gv=V.get(dz,n); if(!gv) return; const P=pairs(drawing,gv.id,gv.data); let b=P.length>=4?bindAffine(P,{px:0.025*Math.max(img.width,img.height)}):null;
    /* подписи не складываются (глаза промахиваются на сантиметры, путают) — затравка по медианам, дальше решит поиск по линиям */
    if((!b||b.inl.length<4)&&P.length>=3){ const A0=seedSim(P); if(A0&&detA(A0)>0){ const s0=Math.sqrt(detA(A0)); if(s0>=1.2&&s0<=60) b={A:A0,s:s0,aniso:0,inl:[],out:[],rms:NaN,seed:true}; } }
    if(b) hyp.push({n,gv,P,b}); });
  hyp.sort((x,y)=>(x.b.seed?1:0)-(y.b.seed?1:0)||y.b.inl.length-x.b.inl.length||x.b.rms-y.b.rms);
  /* затравки по рамке чертежа: глаза обычно верно говорят, ГДЕ чертёж, но не где точки. Центр фигуры условия — в центре
     рамки, масштаб — по размеру рамки (чертёж с построениями шире фигуры), три масштаба ×0,7 / ×1 / ×1,4 */
  if(+o.n&&drawing.box&&drawing.box.every(isFinite)){ const gv=V.get(dz,+o.n), fig=L('model').given(gv.id,gv.data).segs.flatMap(q=>[q.a,q.b]).concat([[0,0]]);
    const fx=[Math.min(...fig.map(p=>p[0])),Math.max(...fig.map(p=>p[0]))], fy=[Math.min(...fig.map(p=>p[1])),Math.max(...fig.map(p=>p[1]))], [x0,y0,x1,y1]=drawing.box;
    const s0=Math.sqrt(Math.abs((x1-x0)*(y1-y0))/((fx[1]-fx[0]+50)*(fy[1]-fy[0]+40))), cx=(x0+x1)/2, cy=(y0+y1)/2, mx=(fx[0]+fx[1])/2, my=(fy[0]+fy[1])/2;
    if(s0>=1.2&&s0<=60) [1,0.7,1.4].forEach(k=>{ const sk=s0*k; hyp.push({n:+o.n,gv,P:pairs(drawing,gv.id,gv.data),b:{A:[sk,0,cx-sk*mx,0,sk,cy-sk*my],s:sk,aniso:0,inl:[],out:[],rms:NaN,seed:true,box:true}}); }); }
  /* поиск фигуры условия по линиям у затравки — для указанного варианта (все затравки, до первой уверенной находки)
     или трёх лучших по глазам */
  for(const hh of hyp.slice(0,+o.n?6:3)){ let sf=null; try{ sf=searchFigure(img,hh.b.A,hh.gv,hh.b.own?{clean:o.clean,r:6,th:4,lk:1}:{clean:o.clean}); }catch(e){}
    if(sf&&sf.cover>=0.55&&sf.cover-sf.second>=0.1){ hh.b=Object.assign({},hh.b,{A:sf.A,s:Math.sqrt(Math.abs(detA(sf.A))),found:sf,seed:false,inl:hh.b.inl.length>=4?hh.b.inl:hh.P});
      if(+o.n&&sf.cover>=0.7) break; }
    else if(hh.b.seed) hh.b.inl=[]; }
  hyp.sort((x,y)=>(y.b.found?y.b.found.cover:0)-(x.b.found?x.b.found.cover:0)||y.b.inl.length-x.b.inl.length);
  const h=hyp[0]; if(!h||!h.b.found&&h.b.inl.length<4) return {ok:false,reason:'точки, которые нашли глаза, не складываются в условие '+(+o.n?'варианта '+o.n:'ни одного варианта')+(h?' (согласны '+h.b.inl.length+' из '+h.P.length+')':'')+' — переснимите крупнее или укажите номер варианта'};
  /* без номера: второй вариант не должен объяснять глаза почти так же (иначе выбор — по линиям, ниже) */
  const rivals=+o.n?[]:hyp.slice(1,3).filter(x=>x.b.inl.length>=h.b.inl.length-1);
  const cand=[h].concat(rivals);
  if(h.b.found) why.push('фигура условия найдена по линиям у подсказки глаз: сдвиг '+f1(h.b.found.shift)+' мм, поворот '+f1(h.b.found.rot)+'°, масштаб ×'+h.b.found.k.toFixed(2)+'; на линиях '+Math.round(h.b.found.cover*100)+' % (другое положение — '+Math.round(h.b.found.second*100)+' %)');
  else if(h.b.out.length) why.push('глаза: не согласуются с условием и отброшены — '+h.b.out.map(q=>q.l).join(', '));
  /* поле чертежа (мм условия): рамка глаз (если есть) и фигура условия с запасом; не больше 360 × 300 */
  const run=c=>{ const {gv,b}=c, A=b.A, Ai=(()=>{ const d=detA(A); return [A[4]/d,-A[1]/d,-A[3]/d,A[0]/d]; })(), toM=p=>{ const q=[p[0]-A[2],p[1]-A[5]]; return [Ai[0]*q[0]+Ai[1]*q[1],Ai[2]*q[0]+Ai[3]*q[1]]; };
    const g=L('model').given(gv.id,gv.data), fig=g.segs.flatMap(s=>[s.a,s.b]).concat([[0,0]]);
    /* рамка глаз — она; нет — фигура условия ± 45 мм (построения частей ДЗ №3 — рядом с фигурой); не дальше кадра */
    const W=img.width, Hh=img.height, img4=[[0,0],[W,0],[W,Hh],[0,Hh]].map(toM), bb=P=>[Math.min(...P.map(p=>p[0])),Math.min(...P.map(p=>p[1])),Math.max(...P.map(p=>p[0])),Math.max(...P.map(p=>p[1]))];
    const F=bb(fig), I=bb(img4), Bx=drawing.box?bb(fig.concat([[drawing.box[0],drawing.box[1]],[drawing.box[2],drawing.box[1]],[drawing.box[2],drawing.box[3]],[drawing.box[0],drawing.box[3]]].map(toM))):[F[0]-45,F[1]-40,F[2]+45,F[3]+40];
    let u0=Math.max(Bx[0]-6,I[0],F[0]-120), v0=Math.max(Bx[1]-6,I[1],F[1]-100), u1=Math.min(Bx[2]+6,I[2],F[2]+120), v1=Math.min(Bx[3]+6,I[3],F[3]+100);
    if(u1-u0>360){ const m=(F[0]+F[2])/2; u0=m-180; u1=m+180; }
    if(v1-v0>300){ const m=(F[1]+F[3])/2; v0=m-150; v1=m+150; }
    const cO=[-Math.floor(u0),-Math.floor(v0)], box=[0,0,Math.ceil(u1-u0),Math.ceil(v1-v0)];
    /* мм листа (поле) → мм условия: m = Hm(q − c); px = A·m (сначала Hm = I, потом — уточнённая гомография) */
    let Hm=[1,0,0,0,1,0,0,0,1], last=null, fitInfo=null;
    const mapOf=Hm=>(u,v)=>affAt(A,H.apply(Hm,[u-cO[0],v-cO[1]]));
    for(let it=0;it<3;it++){ const ppm=it<2?5:8, dg=digitize(img,mapOf(Hm),box,ppm,o.clean); if(!dg.ok) return {ok:false,reason:dg.reason};
      const cands=GS.axesCands(dg.dig.segs), cal=C.calibrate(dg.dig,{},gv.id,gv.data,{range:[cO[0]-(it?3:10),cO[1]-(it?3:10),cO[0]+(it?3:10),cO[1]+(it?3:10)],np:6,cands});
      last={dg,cal,cands};
      if(!cal.ok||cal.cover<0.45){ if(it===0) return {ok:false,reason:'по подсказке глаз условие варианта '+c.n+' на линиях не нашлось ('+Math.round((cal.cover||0)*100)+' %) — переснимите крупнее, при ровном свете',cover:cal.cover||0}; break; }
      if(it===2) break;
      /* измерить точки условия и уточнить гомографию по ним (мм условия → мм поля) */
      const mg=GV.measureGiven(dg.dig,cal,gv.id,gv.data,{}), Pm=[];
      L('model').given(gv.id,gv.data).pts.forEach(q=>{ const m=mg.pts[q.l]; if(m&&m.src!=='не найдена'&&!m.unreliable&&!m.approx&&!m.amb) Pm.push({l:q.l,m:q.at,p:m.p}); });
      if(mg.Osrc&&mg.Osrc[0]!=='по точкам'&&mg.Osrc[1]!=='по точкам') Pm.push({l:'O',m:[0,0],p:mg.O});
      const hb=bindHom(Pm,it===0?1.5:0.8);
      if(!hb){ why.push('уточнение перспективы: мало надёжно измеренных точек ('+Pm.length+') — оставлена аффинная привязка'); break; }
      /* поле → мм условия: m = Hm(q − c); новая: m = Hm(Hc⁻¹(q − c) + …) — Hc: мм условия → мм поля (текущего) */
      /* сейчас px = A·Hm·(q − c); точка условия m измерена в поле в q = Hc(m). Новое поле — где m лежит в q′ = m + c:
         px = A·Hm·(Hc(q′ − c) − c), т. е. Hm′ = Hm·(−c)·Hc */
      const shi=[1,0,-cO[0],0,1,-cO[1],0,0,1]; Hm=H.norm(H.mul(Hm,H.mul(shi,hb.M)));
      fitInfo={n:hb.inl.length,of:Pm.length,rms:hb.rms,out:hb.out.map(q=>q.l)}; }
    return {ok:true,c,last,box,cO,map:mapOf(Hm),Hm,fit:fitInfo}; };
  /* кандидаты-варианты — по покрытию линиями; без номера нужен запас (как на чистом листе) */
  const runs=cand.map(run).filter(r=>r.ok).sort((x,y)=>y.last.cal.cover-x.last.cal.cover);
  if(!runs.length){ const r=run(h); return r.ok?r:{ok:false,reason:r.reason}; }
  const b=runs[0], b2=runs[1];
  if(!+o.n&&b2&&b.last.cal.cover-b2.last.cal.cover<0.15) return {ok:false,reason:'вариант по чертежу не узнаётся однозначно ('+runs.map(r=>r.c.n+' — '+Math.round(r.last.cal.cover*100)+' %').join(', ')+') — укажите номер варианта'};
  if(!+o.n&&b.last.cal.cover<0.8) return {ok:false,reason:'вариант по чертежу не узнаётся уверенно (лучший — '+b.c.n+', '+Math.round(b.last.cal.cover*100)+' %) — укажите номер варианта'};
  const s=b.c.b.s;
  why.push('глаза: '+b.c.b.inl.length+' точек условия согласны с вариантом '+b.c.n+' (масштаб фото '+f1(s)+' px/мм)'+(b.fit?'; перспектива уточнена по '+b.fit.n+' измеренным точкам, СКО '+f1(b.fit.rms)+' мм'+(b.fit.out.length?' (не по линиям условия: '+b.fit.out.join(', ')+')':''):''));
  if(s<4) why.push('фото мелкое ('+f1(s)+' px/мм; нужно от 6) — замеры грубее, часть утверждений не делается');
  const dg=b.last.dg;
  /* где глаза видели точки — в мм поля (обратно по привязке): сверка «нанесено неточно» (gridsheet.js) */
  const A=b.c.b.A, d=detA(A), Hmi=H.inv(b.Hm), eyesMm={};
  Object.entries(drawing.pts).forEach(([l,p])=>{ const q=[p[0]-A[2],p[1]-A[5]], m=[(A[4]*q[0]-A[1]*q[1])/d,(-A[3]*q[0]+A[0]*q[1])/d], f=H.apply(Hmi,m); eyesMm[l]=[f[0]+b.cO[0],f[1]+b.cO[1]]; });
  return {ok:true,scan:dg.sc,dig:dg.dig,box:b.box,map:b.map,origin:b.cO,n:b.c.n,eyesMm,cover:b.last.cal.cover,second:b2?b2.last.cal.cover:0,why,cands:b.last.cands,ppmPhoto:s,fit:b.fit,eyesOut:b.c.b.out.map(q=>q.l)}; }

/* ── лист в клетку: метрику даёт сетка (точнее), глаза — только где чертёж, его O и вариант ──
   gridEyes(g (сетка: мм листа → px), drawing, {dz, n, box}) → {ok, reason, n, cand:[n…], eyesMm, O (мм листа)} */
function gridEyes(g,drawing,o){ const dz=+o.dz||3, B=o.box, src=[], dst=[];
  /* обратная карта px → мм листа: гомография по узлам через 20 мм (для подсказки глаз хватает ± 1 мм) */
  for(let u=B[0];u<=B[2];u+=20) for(let v=B[1];v<=B[3];v+=20){ const p=g.map(u,v); if(p&&isFinite(p[0])) { src.push(p); dst.push([u,v]); } }
  const Hi=src.length>=4?H.fit(src,dst):null; if(!Hi) return {ok:false,reason:'сетка не даёт обратной карты'};
  const mm={}; Object.entries(drawing.pts).forEach(([l,p])=>{ mm[l]=H.apply(Hi,p); });
  const ns=+o.n?[+o.n]:Array.from({length:30},(_,i)=>i+1), hyp=[];
  ns.forEach(n=>{ const gv=V.get(dz,n); if(!gv) return; const P=pairs({pts:mm},gv.id,gv.data), b=P.length>=4?bindAffine(P,{tol:5,sRange:[0.8,1.25]}):null; if(b) hyp.push({n,b}); });
  hyp.sort((x,y)=>y.b.inl.length-x.b.inl.length||x.b.rms-y.b.rms); const h=hyp[0];
  if(!h||h.b.inl.length<4) return {ok:false,reason:'точки, которые нашли глаза, не складываются в условие '+(+o.n?'варианта '+o.n:'ни одного варианта')+' — переснимите крупнее или укажите номер варианта'};
  const cand=hyp.filter(x=>x.b.inl.length>=h.b.inl.length-1).slice(0,3).map(x=>x.n);
  return {ok:true,n:h.n,cand,eyesMm:mm,O:affAt(h.b.A,[0,0]),out:h.b.out.map(q=>q.l)}; }

/* свои глаза + модель: чертежи, найденные по линиям (точная привязка), и рамки модели, в которых своих нет (там модель
   увидела то, что поиск пропустил); номер части — от рамки модели, внутри которой лежит найденное начало O */
function mergeDrawings(own,eyes){ const out=(own||[]).map(d=>Object.assign({},d)), inBox=(b,p)=>b&&p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
  (eyes||[]).forEach(e=>{ const hit=out.filter(d=>d.A&&inBox(e.box,[d.A[2],d.A[5]])); if(hit.length) hit.forEach(d=>{ if(!d.part&&e.part) d.part=e.part; }); else out.push(e); });
  return out; }

/* ── весь лист: каждый чертёж — отдельно, со своим O ── */
function checkEyes(img,eyes,o){ o=o||{}; const E=eyes&&eyes.drawings?eyes:parse(eyes); if(E.error) return {ok:false,verdict:'не могу прочитать',why:[E.error],drawings:[]};
  const dz=+o.dz||E.dz||3, n=+o.n||E.n||0, GS=L('gridsheet'), t0=Date.now();
  /* сетка листа — одна на все чертежи: ищется один раз */
  if(dz===3&&o.grid===undefined){ try{ o=Object.assign({},o,{grid:L('grid').findGrid(img)}); }catch(e){} }
  /* ДЗ №2 — проверка ответа (check.js: вершина, рёбра, видимость, шаги 2а); ДЗ №3 — части и шаги (gridsheet.js) */
  const out=E.drawings.map((d,i)=>{ let r; try{ r=dz===2?Object.assign({ok:true},L('check').checkSheet(img,{dz,n,eyes:d})):GS.checkGridPhoto(img,Object.assign({},o,{dz,n,eyes:d,part:o.part||d.part||null}));
      if(dz===2&&r.verdict==='не могу прочитать') r.ok=false; }catch(e){ r={ok:false,verdict:'не могу прочитать',why:['ошибка разбора: '+String(e&&e.message||e)]}; }
    r.index=i; r.eyesPart=d.part; return r; });
  /* один чертёж дважды (у модели две рамки вокруг одной копии): начало O найдено в одном месте (≤ 8 мм) — второй отбрасывается */
  const Opx=r=>{ try{ return r&&r.ok&&r._grid&&r.given?r._grid.map(r.given.O[0],r.given.O[1]):null; }catch(e){ return null; } };
  out.forEach((r,i)=>{ const a=Opx(r); if(!a) return; const ppm=r.plain&&r.plain.ppmPhoto||4; for(let j=0;j<i;j++){ const b=Opx(out[j]); if(b&&!out[j].dup&&Math.hypot(a[0]-b[0],a[1]-b[1])<8*ppm){ r.dup=j; break; } } });
  const dups=out.filter(r=>r.dup!=null).length; for(let i=out.length-1;i>=0;i--) if(out[i].dup!=null) out.splice(i,1);
  /* каждая часть на листе — один раз: часть, построение которой сошлось («верно») на одном чертеже, на другом —
     чужие похожие линии; «ошибка» там по подсказке модели не утверждается (часть указал сам студент — утверждается) */
  if(dz===3&&!o.part){ const okP=new Set(); out.forEach(r=>(r.shown||[]).forEach(k=>{ if(r.parts&&r.parts[k]&&r.parts[k].st==='верно') okP.add(k); }));
    out.forEach(r=>{ if(!r.parts) return; Object.keys(r.parts).forEach(k=>{ if(k!=='vis'&&okP.has(k)&&r.parts[k].st==='ошибка'){ r.parts[k]=GS.unsurePart(r.parts[k],k); } }); }); }
  /* итог по листу: «ошибка» — если хоть один чертёж с уверенной ошибкой; «верно» — если все прочитанные верны и
     ни один не отказал; иначе — по чертежам */
  const vs=out.map(r=>r.verdict), bad=vs.some(v=>v==='ошибка'), data=vs.some(v=>v==='ошибка в данных'), allOk=vs.length&&vs.every(v=>v==='верно'||v==='данные нанесены верно');
  const verdict=bad?'ошибка':data?'ошибка в данных':allOk?'верно':vs.every(v=>v==='не могу прочитать')?'не могу прочитать':'не могу утверждать';
  const PN={a:'1) высота',b:'2) угол граней',c:'3) истинный вид',d:'4) угол SA'};
  const why=out.map((r,i)=>'чертёж '+(i+1)+(r.eyesPart?' ('+(PN[r.eyesPart]||r.eyesPart)+')':'')+': '+r.verdict+(r.ok===false&&r.why&&r.why[0]?' — '+r.why[0]:''));
  if(dups) why.push('у ИИ-зрения '+dups+' рамк'+(dups>1?'и':'а')+' вокруг уже найденного чертежа — не считаю дважды');
  return {ok:out.some(r=>r.ok),verdict,dz,n:out.find(r=>r.n)?out.find(r=>r.n).n:n,drawings:out,why,ms:Date.now()-t0}; }

put('dzEyes',{parse,label,prepareEyes,gridEyes,checkEyes,findDrawings,mergeDrawings,bindAffine,bindHom,pairs,seedSim,searchFigure});
})();
/* node lab/dz/eyes.js фото.png глаза.json [--n=9] — проверка фото по ответу глаз (JSON или текст ответа модели) */
if(typeof module!=='undefined'&&require.main===module){ const a=Object.fromEntries(process.argv.slice(4).map(x=>x.replace(/^--/,'').split('='))), fs=require('fs'), IMG=require('../img.js'), E=module.exports;
  const img=IMG.decodePNG(fs.readFileSync(process.argv[2])), r=E.checkEyes(img,fs.readFileSync(process.argv[3],'utf8'),{dz:+(a.dz||3),n:+(a.n||0),part:a.part||null});
  console.log('ИТОГ: '+r.verdict.toUpperCase()+' ('+r.ms+' мс)'); r.drawings.forEach((g,i)=>{ console.log('\nчертёж '+(i+1)+(g.eyesPart?' (часть '+g.eyesPart+')':'')+': '+g.verdict); (g.why||[]).forEach(w=>console.log('  — '+w));
    if(g.parts) (g.shown||[]).forEach(k=>{ const p=g.parts[k]; if(p) console.log('  часть '+k+': '+p.st+' — '+(p.why||[]).join('; ')); }); }); }
