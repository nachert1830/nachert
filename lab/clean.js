/* ═══════════ Очистка: свет, тени, клетка, текстура бумаги ═══════════
   «Тёмность» пикселя — наименьшая из тёмностей трёх каналов (у каждого свой фон): карандаш и печать темнят все три
   канала, а синяя клетка, красная ручка преподавателя, жёлтая бумага — только часть, и в наименьшей их почти нет.
   Фон (бумага при данном свете, с тенью и виньеткой) — максимум по блокам, сглаженный: линии тонкие и в максимум
   не попадают. ink = (фон − V) / фон, 0…1 — не зависит от яркости освещения и мягкой тени.
   warp — та же карта в мм листа по гомографии (лист → фото), с нужным числом пикселей на мм. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('./'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const {gray,blur,H,sample}=lab('img');

function value(im){ const n=im.width*im.height, g=gray(im.width,im.height), d=im.data;
  for(let i=0;i<n;i++){ const r=d[4*i], gg=d[4*i+1], b=d[4*i+2]; g.a[i]=(r>gg?(r>b?r:b):(gg>b?gg:b))/255; } return g; }
/* фон: максимум по блокам B×B, затем медиана 3×3 блоков (снимает блоки целиком на линии) и размытие */
function background(V,B){ B=B||16; const bw=Math.ceil(V.w/B), bh=Math.ceil(V.h/B), m=gray(bw,bh);
  for(let by=0;by<bh;by++) for(let bx=0;bx<bw;bx++){ let mx=0; const y1=Math.min(V.h,(by+1)*B), x1=Math.min(V.w,(bx+1)*B);
    for(let y=by*B;y<y1;y++){ const row=y*V.w; for(let x=bx*B;x<x1;x++) if(V.a[row+x]>mx) mx=V.a[row+x]; } m.a[by*bw+bx]=mx; }
  const md=gray(bw,bh); for(let y=0;y<bh;y++) for(let x=0;x<bw;x++){ const v=[]; for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++){ const xx=Math.max(0,Math.min(bw-1,x+i)), yy=Math.max(0,Math.min(bh-1,y+j)); v.push(m.a[yy*bw+xx]); }
    v.sort((a,b)=>a-b); md.a[y*bw+x]=v[4]; }
  const s=blur(md,1), bg=gray(V.w,V.h);
  for(let y=0;y<V.h;y++) for(let x=0;x<V.w;x++){ const fx=Math.max(0,Math.min(bw-1.001,(x+0.5)/B-0.5)), fy=Math.max(0,Math.min(bh-1.001,(y+0.5)/B-0.5));
    const x0=Math.floor(fx), y0=Math.floor(fy), ax=fx-x0, ay=fy-y0, i=y0*bw+x0;
    bg.a[y*V.w+x]=(s.a[i]*(1-ax)+s.a[i+1]*ax)*(1-ay)+(s.a[i+bw]*(1-ax)+s.a[i+bw+1]*ax)*ay; }
  return bg; }
/* тёмность по каждому каналу отдельно (свой фон у каждого), затем наименьшая: графит и печать темнят все три
   канала одинаково, синяя клетка — почти только красный, красная ручка — зелёный и синий */
function ink(im){ const n=im.width*im.height, d=im.data, V=value(im), o=gray(im.width,im.height); o.a.fill(1);
  for(let c=0;c<3;c++){ const C=gray(im.width,im.height); for(let i=0;i<n;i++) C.a[i]=d[4*i+c]/255;
    const bg=background(C,16); for(let i=0;i<n;i++){ const b=Math.max(0.05,bg.a[i]), v=Math.max(0,Math.min(1,(b-C.a[i])/b)); if(v<o.a[i]) o.a[i]=v; } }
  return {ink:o,V}; }
/* карта в мм: box = [x0, y0, x1, y1] (мм страницы), ppm — пикселей на мм; M — лист → фото (px) */
function warp(map,M,box,ppm){ const w=Math.round((box[2]-box[0])*ppm), h=Math.round((box[3]-box[1])*ppm), o=gray(w,h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const p=H.apply(M,[box[0]+(x+0.5)/ppm,box[1]+(y+0.5)/ppm]), v=sample(map,p[0]-0.5,p[1]-0.5); o.a[y*w+x]=v==null?0:v; }
  o.box=box; o.ppm=ppm; return o; }
/* шум бумаги: медиана тёмности и разброс (MAD) на чистых местах — порог «есть линия» считается от него */
function paperNoise(g){ const s=[]; for(let i=0;i<g.a.length;i+=7) s.push(g.a[i]); s.sort((a,b)=>a-b); const m=s[Math.floor(s.length/2)];
  const d=s.map(v=>Math.abs(v-m)).sort((a,b)=>a-b); return {median:m,mad:d[Math.floor(d.length/2)]*1.4826}; }

put('clean',{value,background,ink,warp,paperNoise});
})();
