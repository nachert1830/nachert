/* ═══════════ Сеть глаз: где на фото точки условия каждого чертежа (lab/dz/net/train.py → eyes.onnx) ═══════════
   Только подсказка, как рамка и подписи модели: сеть даёт кандидатов A″ … S′ и O, а чертёж из них собирает геометрия —
   фигура варианта (её мм известны) прикладывается подобием к парам пиков, точки, согласные с ним, — один чертёж.
   Дальше — как с глазами модели: checkEyes (привязка, поиск фигуры по линиям, замер, проверка). Вердикт — только наш.
   Запуск — ONNX Runtime Web 1.20.1 (браузер: jsDelivr; node: lab/dz/net/node_modules, npm ci).
   await dzNet.load(путь|байты) ; await dzNet.eyes(img, {dz:3, n}) → {ok, dz, n, drawings:[{pts:{A″:[x,y] px фото}, box, score}], peaks, ms} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const IMG=isNode?require('../../img.js'):self.LAB.img, M=isNode?require('../model.js'):self.LAB.dzModel, V=isNode?require('../../../core/dz-variants.js'):self.CORE.dzVariants;
const NAMES=['A″','B″','C″','S″','A′','B′','C′','S′','O'], STRIDE=4, LONG=640, ORT_URL='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
let ort=null, sess=null;
async function load(src){ if(!ort){ if(isNode) ort=require('onnxruntime-web'); else { if(!self.ort) importScripts(ORT_URL+'ort.wasm.min.js'); ort=self.ort; ort.env.wasm.wasmPaths=ORT_URL; }
    ort.env.wasm.numThreads=1; }
  const buf=typeof src==='string'&&isNode?require('fs').readFileSync(src):src; sess=await ort.InferenceSession.create(buf); return true; }
/* фото → вход: серое 0…1, длинная сторона 640 (сначала среднее по квадратам, затем билинейно), стороны кратны 32 (белым) */
function prep(img){ let g=IMG.toGray(img); const k=LONG/Math.max(g.w,g.h), f=Math.floor(1/k); if(f>=2) g=IMG.shrink(g,f);
  const W=Math.max(32,Math.round(img.width*k)), Hh=Math.max(32,Math.round(img.height*k)), Wp=Math.ceil(W/32)*32, Hp=Math.ceil(Hh/32)*32, x=new Float32Array(Wp*Hp).fill(1), sx=g.w/W, sy=g.h/Hh;
  for(let y=0;y<Hh;y++) for(let i=0;i<W;i++){ const v=IMG.sample(g,(i+0.5)*sx-0.5,(y+0.5)*sy-0.5); x[y*Wp+i]=v==null?1:v; }
  return {x,W:Wp,H:Hp,k:W/img.width}; }
/* пики карты: максимум 3×3 выше порога; центр — взвешенное среднее 3×3 (px входа) */
function peaks(hm,C,Hh,W,thr){ const out=[];
  for(let c=0;c<C;c++){ const o=c*Hh*W; for(let y=0;y<Hh;y++) for(let x=0;x<W;x++){ const v=hm[o+y*W+x]; if(v<=thr) continue; let mx=true, s=0, sx=0, sy=0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const yy=y+dy, xx=x+dx; if(yy<0||xx<0||yy>=Hh||xx>=W) continue; const u=hm[o+yy*W+xx]; if(u>v) mx=false; s+=u; sx+=u*xx; sy+=u*yy; }
      if(mx) out.push({c,l:NAMES[c],x:(sx/s+0.5)*STRIDE-0.5,y:(sy/s+0.5)*STRIDE-0.5,v}); } }
  /* на каждую точку — не больше 12 сильнейших пиков (чертежей на листе не больше 8) */
  const cnt=new Array(C).fill(0); return out.sort((a,b)=>b.v-a.v).filter(p=>cnt[p.c]++<12); }
/* чертежи из пиков: подобие «мм условия → px входа» по паре пиков разных точек; согласные точки (≤ 4 мм) — чертёж.
   Жадно: лучший по сумме уверенностей (не меньше 4 точек), его пики убираются, снова. Масштаб — 0,6…8 px входа на мм */
function group(P,fig,o){ o=o||{}; const out=[], left=P.slice(), MIN=o.min||4;
  for(let it=0;it<8;it++){ let best=null;
    for(let i=0;i<left.length;i++) for(let j=0;j<left.length;j++){ const a=left[i], b=left[j]; if(a.l===b.l||!fig[a.l]||!fig[b.l]) continue;
      const ma=fig[a.l], mb=fig[b.l], dm=[mb[0]-ma[0],mb[1]-ma[1]], dp=[b.x-a.x,b.y-a.y], L2=dm[0]*dm[0]+dm[1]*dm[1]; if(L2<100) continue;
      const c=(dp[0]*dm[0]+dp[1]*dm[1])/L2, s=(dp[1]*dm[0]-dp[0]*dm[1])/L2, k=Math.hypot(c,s); if(k<0.6||k>8) continue;
      const map=m=>[a.x+c*(m[0]-ma[0])-s*(m[1]-ma[1]),a.y+s*(m[0]-ma[0])+c*(m[1]-ma[1])], tol=Math.max(4*k,5), pick={}; let sc=0;
      for(const [l,m] of Object.entries(fig)){ const q=map(m); let bq=null, bd=tol; left.forEach(p=>{ if(p.l!==l) return; const d=Math.hypot(p.x-q[0],p.y-q[1]); if(d<bd){ bd=d; bq=p; } });
        if(bq){ pick[l]=bq; sc+=bq.v*(1-0.5*bd/tol); } }
      if(Object.keys(pick).length>=MIN&&(!best||sc>best.sc)) best={sc,pick,k}; }
    if(!best) break; out.push(best); Object.values(best.pick).forEach(p=>left.splice(left.indexOf(p),1)); }
  return out; }
async function eyes(img,o){ o=o||{}; const t0=Date.now(), dz=+o.dz||3, gv=V.get(dz,+o.n); if(!sess) return {ok:false,reason:'сеть не загружена'}; if(!gv) return {ok:false,reason:'нужен номер варианта'};
  const p=prep(img), r=await sess.run({img:new ort.Tensor('float32',p.x,[1,1,p.H,p.W])}), hm=r.hm.data, [,C,Hh,W]=r.hm.dims, P=peaks(hm,C,Hh,W,o.thr||0.3);
  const fig={O:[0,0]}; M.given(gv.id,gv.data).pts.forEach(q=>{ fig[q.l]=q.at; });
  const drawings=group(P,fig,o).map(g=>{ const pts={}; Object.entries(g.pick).forEach(([l,q])=>{ pts[l]=[(q.x+0.5)/p.k-0.5,(q.y+0.5)/p.k-0.5]; });
    /* рамка — фигура условия с запасом 30 мм (часть строят рядом с ней) */
    const xs=Object.values(pts).map(q=>q[0]), ys=Object.values(pts).map(q=>q[1]), pad=30*g.k/p.k;
    return {pts,box:[Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)+pad,Math.max(...ys)+pad],score:g.sc,part:null}; });
  return {ok:drawings.length>0,dz,n:+o.n,drawings,peaks:P.length,ms:Date.now()-t0,reason:drawings.length?null:'сеть не нашла чертежей'}; }
put('dzNet',{load,eyes,prep,peaks,group,NAMES});
})();
