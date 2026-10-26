/* ═══════════ Очиститель карандаша: выпрямленное фото → чистые линии (наша нейросеть, без библиотек) ═══════════
   Маленькая U-Net (lab/dz/cleaner/train.py), обучена на синтетических листах, где правда известна: где лежит линия
   карандаша — без подписей, кружков, сетки печати, теней и бликов. Работает на скане в мм листа (8 px/мм) по кускам
   256 × 256 с перекрытием 24 px (поле зрения сети — 16 px), так что памяти нужно немного и в телефоне.
   Выход — то же изображение, где линия чёрная на белом: дальше обычный путь (lines.js) находит отрезки на чистом.
   load(json) → net; run(net, img(RGBA), {tile}) → {img(RGBA), p:Float32Array (вероятность линии)} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const flat=a=>Float32Array.from(a.flat(Infinity));
function load(j){ const W=j.w, g=k=>flat(W[k]), net={};
  ['e1','e2a','e2b','e3a','e3b','out'].forEach(k=>{ net[k]={w:g(k+'.weight'),b:g(k+'.bias'),co:W[k+'.weight'].length,ci:W[k+'.weight'][0].length}; });
  ['u2','u1'].forEach(k=>{ net[k]={dw:g(k+'.dw.weight'),db:g(k+'.dw.bias'),pw:g(k+'.pw.weight'),pb:g(k+'.pw.bias'),ci:W[k+'.dw.weight'].length,co:W[k+'.pw.weight'].length}; });
  return net; }
/* свёртка 3×3 (нули за краем) + ReLU: x — [ci][h][w] */
function conv3(x,ci,h,w,L,relu){ const co=L.co, o=new Float32Array(co*h*w), hw=h*w;
  for(let c=0;c<co;c++){ const oo=c*hw; o.fill(L.b[c],oo,oo+hw);
    for(let i=0;i<ci;i++){ const k=L.w.subarray((c*ci+i)*9,(c*ci+i)*9+9), xi=i*hw;
      for(let y=0;y<h;y++){ const y0=y>0, y2=y<h-1, r=xi+y*w, ro=oo+y*w;
        for(let xx=0;xx<w;xx++){ const x0=xx>0, x2=xx<w-1, p=r+xx; let s=k[4]*x[p];
          if(y0){ const q=p-w; s+=k[1]*x[q]; if(x0) s+=k[0]*x[q-1]; if(x2) s+=k[2]*x[q+1]; }
          if(x0) s+=k[3]*x[p-1]; if(x2) s+=k[5]*x[p+1];
          if(y2){ const q=p+w; s+=k[7]*x[q]; if(x0) s+=k[6]*x[q-1]; if(x2) s+=k[8]*x[q+1]; }
          o[ro+xx]+=s; } } }
    if(relu) for(let p=oo;p<oo+hw;p++) if(o[p]<0) o[p]=0; }
  return o; }
/* поканальная 3×3 + точечная 1×1 + ReLU */
function sep(x,ci,h,w,L){ const hw=h*w, d=new Float32Array(ci*hw);
  for(let i=0;i<ci;i++){ const one={co:1,b:[L.db[i]],w:L.dw.subarray(i*9,i*9+9)}; d.set(conv3(x.subarray(i*hw,(i+1)*hw),1,h,w,one,false),i*hw); }
  const co=L.co, o=new Float32Array(co*hw);
  for(let c=0;c<co;c++){ const oo=c*hw; o.fill(L.pb[c],oo,oo+hw); for(let i=0;i<ci;i++){ const k=L.pw[c*ci+i], di=i*hw; for(let p=0;p<hw;p++) o[oo+p]+=k*d[di+p]; }
    for(let p=oo;p<oo+hw;p++) if(o[p]<0) o[p]=0; }
  return o; }
function pool(x,c,h,w){ const h2=h>>1, w2=w>>1, o=new Float32Array(c*h2*w2);
  for(let i=0;i<c;i++) for(let y=0;y<h2;y++) for(let xx=0;xx<w2;xx++){ const p=i*h*w+2*y*w+2*xx; o[i*h2*w2+y*w2+xx]=Math.max(x[p],x[p+1],x[p+w],x[p+w+1]); }
  return o; }
/* ×2 ближайшим к размеру (h, w) и склейка с пропуском */
function upcat(x,c,h2,w2,skip,cs,h,w){ const hw=h*w, o=new Float32Array((c+cs)*hw);
  for(let i=0;i<c;i++) for(let y=0;y<h;y++){ const yy=Math.min(h2-1,y>>1); for(let xx=0;xx<w;xx++) o[i*hw+y*w+xx]=x[i*h2*w2+yy*w2+Math.min(w2-1,xx>>1)]; }
  o.set(skip,c*hw); return o; }
/* сеть на куске: x — [1][h][w] (h, w кратны 4) → логит [h][w] */
function forward(N,x,h,w){ const e1=conv3(x,1,h,w,N.e1,true), h1=h>>1, w1=w>>1, h2=h>>2, w2=w>>2;
  const e2=conv3(conv3(pool(e1,8,h,w),8,h1,w1,N.e2a,true),16,h1,w1,N.e2b,true);
  const e3=conv3(conv3(pool(e2,16,h1,w1),16,h2,w2,N.e3a,true),32,h2,w2,N.e3b,true);
  const d2=sep(upcat(e3,32,h2,w2,e2,16,h1,w1),48,h1,w1,N.u2), d1=sep(upcat(d2,16,h1,w1,e1,8,h,w),24,h,w,N.u1);
  const o=new Float32Array(h*w), k=N.out.w, b=N.out.b[0]; for(let p=0;p<h*w;p++){ let s=b; for(let i=0;i<8;i++) s+=k[i]*d1[i*h*w+p]; o[p]=s; } return o; }
function run(N,img,o){ o=o||{}; const W=img.width, Hh=img.height, T=o.tile||256, M=24, P=new Float32Array(W*Hh), d=img.data;
  for(let ty=0;ty<Hh;ty+=T) for(let tx=0;tx<W;tx+=T){ const x0=Math.max(0,tx-M), y0=Math.max(0,ty-M), x1=Math.min(W,tx+T+M), y1=Math.min(Hh,ty+T+M);
    const w=(x1-x0+3)&~3, h=(y1-y0+3)&~3, x=new Float32Array(w*h);
    for(let y=0;y<h;y++) for(let xx=0;xx<w;xx++){ const X=Math.min(W-1,x0+xx), Y=Math.min(Hh-1,y0+y), i=(Y*W+X)*4; x[y*w+xx]=(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2])/255; }
    const lo=forward(N,x,h,w);
    for(let y=ty;y<Math.min(Hh,ty+T);y++) for(let xx=tx;xx<Math.min(W,tx+T);xx++) P[y*W+xx]=1/(1+Math.exp(-lo[(y-y0)*w+(xx-x0)])); }
  const out={width:W,height:Hh,data:new Uint8ClampedArray(W*Hh*4)};
  for(let i=0;i<W*Hh;i++){ const v=Math.round(255*(1-P[i])); out.data[4*i]=out.data[4*i+1]=out.data[4*i+2]=v; out.data[4*i+3]=255; }
  return {img:out,p:P}; }
/* веса — lab/dz/cleaner/weights.json: в Node — с диска, в потоке страницы — синхронно с сайта; нет файла — null */
let NET; function get(){ if(NET!==undefined) return NET; NET=null;
  try{ if(isNode){ const f=require('path').join(__dirname,'weights.json'); if(require('fs').existsSync(f)) NET=load(JSON.parse(require('fs').readFileSync(f,'utf8'))); }
    else { const x=new XMLHttpRequest(); x.open('GET',(self.LAB&&self.LAB.cleanerUrl)||'cleaner/weights.json',false); x.send(); if(x.status===200) NET=load(JSON.parse(x.responseText)); } }catch(e){ NET=null; }
  return NET; }
/* функция для lines.js (o.clean): RGBA → RGBA с чистыми линиями */
const hook=()=>{ const N=get(); return N?(im=>run(N,im).img):null; };
put('dzCleaner',{load,run,forward,get,hook});
})();
