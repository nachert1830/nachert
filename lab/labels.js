/* ═══════════ Подписи: найти, прочитать, привязать к точкам ═══════════
   1. Кандидаты: пятна тёмности в области построения, которые не объясняются найденными линиями (≥ 6 мм) и
      печатью: компоненты связности, слитые с соседями ближе 1 мм (буква + штрих + индекс), высотой 1,8…7 мм.
   2. readLabel(фрагмент, {expected}) → [{text, p}] — сменная реализация:
        READERS.templates — эталоны из штрихового шрифта (lab/font.js) с наклонами и нажимом, сравнение
          «фаской» (среднее расстояние между штрихами в обе стороны) — по умолчанию;
        READERS.model — внешняя мультимодальная модель через интерфейс-заглушку: без ключа не вызывается
          (LAB.labels.setModel({key, call}) — подключить; call(png, expected) → [{text, p}]).
      Ожидаемые подписи задаёт задача (что может стоять у точек), чтение — выбор из них или «не знаю».
   3. Привязка: каждой точке гипотезы (K′, K″, 1′, …) — ближайшее пятно в 1…8 мм с учётом прочитанного;
      interpret учитывает согласие подписей как слабое свидетельство (геометрия главнее). */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('./'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const font=lab('font'), {SHEETS}=lab('sheets');
const EXPECT={47:['K′','K″','1′','2′','1″','2″','A₀','K₀','h′','h″','f′','f″']};

/* ── 1. кандидаты ── */
function blobs(ln,o){ const {g,box,mask}=ln.map, {w,h}=g, PPM=g.ppm||8, SH=SHEETS[o.n||47];
  const dk=ln.segs.filter(s=>s.len>15).map(s=>s.dark).sort((a,b)=>a-b), ref=dk.length?dk[Math.floor(dk.length/2)]:0.3, th=Math.max(0.08,0.35*ref);
  /* линии — прочь: пиксели в 0,45 мм от отрезков длиннее 6 мм */
  const keep=new Uint8Array(w*h); for(let i=0;i<w*h;i++) keep[i]=g.a[i]>=th&&!mask[i]?1:0;
  ln.segs.filter(s=>s.len>=6&&!s.print).forEach(s=>{ const A=[(s.a[0]+SH.O[0]-box[0])*PPM,(s.a[1]+SH.O[1]-box[1])*PPM], B=[(s.b[0]+SH.O[0]-box[0])*PPM,(s.b[1]+SH.O[1]-box[1])*PPM], R=0.45*PPM;
    const dx=B[0]-A[0], dy=B[1]-A[1], L2=dx*dx+dy*dy||1e-9, x0=Math.max(0,Math.floor(Math.min(A[0],B[0])-R)), x1=Math.min(w-1,Math.ceil(Math.max(A[0],B[0])+R)), y0=Math.max(0,Math.floor(Math.min(A[1],B[1])-R)), y1=Math.min(h-1,Math.ceil(Math.max(A[1],B[1])+R));
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ const t=Math.max(0,Math.min(1,((x+0.5-A[0])*dx+(y+0.5-A[1])*dy)/L2)), ex=x+0.5-A[0]-t*dx, ey=y+0.5-A[1]-t*dy; if(ex*ex+ey*ey<=R*R) keep[y*w+x]=0; } });
  /* компоненты */
  const lab0=new Int32Array(w*h).fill(-1), comps=[];
  for(let i=0;i<w*h;i++){ if(!keep[i]||lab0[i]>=0) continue; const st=[i], px=[]; lab0[i]=comps.length;
    while(st.length){ const j=st.pop(); px.push(j); const x=j%w, y=(j/w)|0; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=w||yy>=h) continue; const k=yy*w+xx; if(keep[k]&&lab0[k]<0){ lab0[k]=comps.length; st.push(k); } } }
    if(px.length<6) { comps.push(null); continue; }
    let x0=1e9,y0=1e9,x1=-1,y1=-1; px.forEach(j=>{ const x=j%w, y=(j/w)|0; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; });
    comps.push({px,b:[x0,y0,x1,y1]}); }
  /* слить близкие (буква + штрих + индекс): зазор < 1 мм */
  let C=comps.filter(Boolean).map(c=>({px:c.px,b:c.b.slice()})); const gap=1.0*PPM;
  for(let changed=true;changed;){ changed=false;
    for(let i=0;i<C.length&&!changed;i++) for(let j=i+1;j<C.length&&!changed;j++){ const a=C[i].b, b=C[j].b;
      const dx=Math.max(0,Math.max(a[0],b[0])-Math.min(a[2],b[2])), dy=Math.max(0,Math.max(a[1],b[1])-Math.min(a[3],b[3]));
      if(dx<gap&&dy<gap&&Math.max(a[2],b[2])-Math.min(a[0],b[0])<10*PPM&&Math.max(a[3],b[3])-Math.min(a[1],b[1])<8*PPM){ C[i]={px:C[i].px.concat(C[j].px),b:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]}; C.splice(j,1); changed=true; } } }
  const mm=(x,y)=>[box[0]+x/PPM-SH.O[0],box[1]+y/PPM-SH.O[1]];
  return C.map(c=>{ const hh=(c.b[3]-c.b[1]+1)/PPM, ww=(c.b[2]-c.b[0]+1)/PPM; return {px:c.px,b:c.b,h:hh,w:ww,at:mm((c.b[0]+c.b[2]+1)/2,(c.b[1]+c.b[3]+1)/2),box:[...mm(c.b[0],c.b[1]),...mm(c.b[2]+1,c.b[3]+1)]}; })
    .filter(c=>c.h>=1.8&&c.h<=7&&c.w>=0.8&&c.w<=11)
    .map(c=>Object.assign(c,{frag:fragment(g,c,PPM)})); }
/* фрагмент: тёмность в рамке пятна (+0,4 мм поля), только пиксели пятна */
function fragment(g,c,PPM){ const pad=Math.round(0.4*PPM), x0=c.b[0]-pad, y0=c.b[1]-pad, w=c.b[2]-c.b[0]+1+2*pad, h=c.b[3]-c.b[1]+1+2*pad, a=new Float32Array(w*h), set=new Set(c.px);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const X=x0+x, Y=y0+y; if(X<0||Y<0||X>=g.w||Y>=g.h) continue; const i=Y*g.w+X; if(set.has(i)) a[y*w+x]=g.a[i]; }
  return {w,h,a,ppm:PPM}; }

/* ── 2. чтение ── */
/* штрихи фрагмента: пиксели выше половины его максимума, в мм от левого верхнего угла */
function inkPts(f){ let mx=0; for(const v of f.a) if(v>mx) mx=v; const o=[]; for(let y=0;y<f.h;y++) for(let x=0;x<f.w;x++) if(f.a[y*f.w+x]>=0.45*mx) o.push([(x+0.5)/f.ppm,(y+0.5)/f.ppm]); return o; }
function norm(P){ if(!P.length) return P; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; P.forEach(p=>{ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); });
  const s=1/Math.max(1e-6,y1-y0); return P.map(p=>[(p[0]-x0)*s,(p[1]-y0)*s]); }
function chamfer(A,B){ const d=(P,Q)=>{ let s=0; P.forEach(p=>{ let m=1e9; for(const q of Q){ const v=(p[0]-q[0])**2+(p[1]-q[1])**2; if(v<m) m=v; } s+=Math.sqrt(m); }); return s/P.length; }; return (d(A,B)+d(B,A))/2; }
const TPL={};
function templates(text){ if(TPL[text]) return TPL[text]; const out=[];
  [-0.08,0.12,0.3].forEach(sh=>[-0.08,0,0.08].forEach(rot=>{ const lay=font.layout(text,[0,0],3,{shear:sh,rot}); const P=[]; lay.strokes.forEach(pl=>{ for(let i=0;i<pl.length-1;i++){ const a=pl[i], b=pl[i+1], n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/0.12)); for(let k=0;k<=n;k++) P.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]); } }); out.push(norm(P)); }));
  return TPL[text]=out; }
/* редкая выборка точек (быстрее; форма сохраняется) */
const thin=(P,n)=>{ if(P.length<=n) return P; const st=P.length/n, o=[]; for(let i=0;i<n;i++) o.push(P[Math.floor(i*st)]); return o; };
/* штрихи (′, ″) — маленькие отдельные компоненты справа вверху от основной части; основа — всё остальное */
function split(frag){ const {w,h,a}=frag, lab0=new Int32Array(w*h).fill(-1), C=[];
  for(let i=0;i<w*h;i++){ if(a[i]<=0||lab0[i]>=0) continue; const st=[i], px=[]; lab0[i]=C.length;
    while(st.length){ const j=st.pop(); px.push(j); const x=j%w, y=(j/w)|0; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=w||yy>=h) continue; const k=yy*w+xx; if(a[k]>0&&lab0[k]<0){ lab0[k]=C.length; st.push(k); } } }
    let x0=1e9,y0=1e9,x1=-1,y1=-1; px.forEach(j=>{ const x=j%w, y=(j/w)|0; x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y); }); C.push({px,b:[x0,y0,x1,y1],n:px.length}); }
  if(!C.length) return {main:frag,marks:0};
  const M=C.reduce((m,c)=>c.n>m.n?c:m,C[0]), H=M.b[3]-M.b[1]+1;
  const marks=C.filter(c=>c!==M&&c.n<M.n*0.35&&(c.b[3]+c.b[1])/2<M.b[1]+H*0.45&&c.b[0]>=M.b[0]+(M.b[2]-M.b[0])*0.4&&(c.b[3]-c.b[1]+1)<H*0.6);
  const ma=new Float32Array(w*h), mk=new Set(marks.flatMap(c=>c.px)); for(let i=0;i<w*h;i++) if(a[i]>0&&!mk.has(i)) ma[i]=a[i];
  return {main:{w,h,a:ma,ppm:frag.ppm},marks:marks.length}; }
const BASE=t=>t.replace(/[′″]/g,''), MARKS=t=>(t.match(/′/g)||[]).length+2*(t.match(/″/g)||[]).length;
const READERS={
  templates:{ name:'шаблоны штрихового шрифта', read(frag,o){ const sp=split(frag), P=thin(norm(inkPts(sp.main)),160); if(P.length<8) return [];
      const ex=o.expected||[], bases=[...new Set(ex.map(BASE))];
      const db=Object.fromEntries(bases.map(b=>[b,Math.min(...templates(b).map(T=>chamfer(P,thin(T,160))))]));
      /* основа — по «фаске», штрихи — по счёту: совпал — ×1, не совпал — ×0,15 */
      const tau=0.03, sc=ex.map(t=>({text:t,d:db[BASE(t)],w:Math.exp(-db[BASE(t)]/tau)*(MARKS(t)===Math.min(2,sp.marks)?1:0.15)})).sort((a,b)=>b.w-a.w);
      const z=sc.reduce((s,x)=>s+x.w,0)+Math.exp(-0.14/tau);
      return sc.map(x=>({text:x.text,p:x.w/z,d:x.d,marks:sp.marks})); } },
  model:{ name:'внешняя мультимодальная модель (заглушка)', cfg:null, read(frag,o){ if(!this.cfg||!this.cfg.key||!this.cfg.call) return null; return this.cfg.call(frag,o.expected); } },
};
let READER='templates';
function readLabel(frag,o){ const r=READERS[READER].read(frag,o||{}); return r==null?READERS.templates.read(frag,o||{}):r; }

/* ── 3. найти и прочитать все подписи листа ── */
function attach(ln,rect,o){ o=o||{}; const n=o.n||47, ex=EXPECT[n]||[];
  const B=blobs(ln,{n}).slice(0,40);
  B.forEach(b=>{ b.read=readLabel(b.frag,{expected:ex}); b.best=b.read[0]||null; delete b.px; });
  return {blobs:B,reader:READERS[READER].name,expected:ex}; }
/* согласие подписей с точками гипотезы: Σ log-отношений «ожидаемая / лучшая другая» по ближайшим пятнам */
function agreement(lb,E,names){ if(!lb||!lb.blobs.length) return {ll:0,pairs:[]}; let ll=0; const pairs=[], used=new Set();
  names.forEach(nm=>{ const P=E[nm]; if(!Array.isArray(P)||P.length!==2) return; let best=null;
    lb.blobs.forEach((b,i)=>{ if(used.has(i)) return; const d=Math.hypot(b.at[0]-P[0],b.at[1]-P[1]); if(d<1||d>8) return; const r=b.read.find(x=>x.text===nm); if(!r) return; const s=Math.log(r.p+1e-3)-0.15*d; if(!best||s>best.s) best={i,s,d,r}; });
    if(!best) return; used.add(best.i); const other=lb.blobs[best.i].read.find(x=>x.text!==nm), lr=Math.max(-2,Math.min(2,Math.log((best.r.p+1e-3)/((other?other.p:0)+1e-3))));
    ll+=0.5*lr; pairs.push({name:nm,blob:best.i,p:best.r.p,d:best.d}); });
  return {ll,pairs}; }
function setModel(cfg){ READERS.model.cfg=cfg; READER=cfg&&cfg.key?'model':'templates'; }

put('labels',{attach,readLabel,blobs,agreement,setModel,READERS,EXPECT});
})();
