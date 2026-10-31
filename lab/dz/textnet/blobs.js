/* Детектор «похоже на буквы» без обучения (нижняя планка для сети текста). Любое фото чертежа, любое задание.
   node lab/dz/textnet/blobs.js фото.png [--out=каталог] [--lmin=36] [--grow=3] [--thr=0.07]
   1) тёмность = 1 − яркость/фон (фон — по большим блокам: свет, цветная бумага, тень);
   2) линии: пиксель чернил, лежащий на прямой цепочке чернил длиннее lmin px хотя бы в одном из 12 направлений
      (чернила для цепочки раздуваются на 1 px: карандаш рвётся) — вычёркиваются;
   3) остаток (буквы, штрихи индексов, узлы) раздувается на grow px, связные пятна нужного размера — кружки.
   Размеры — в px снимка, но lmin и grow считаются от «размера буквы» s (≈ 10 px на 2,5 px/мм) — задаются ключами. */
const IMG=require('../../img.js'), fs=require('fs');
const A=Object.fromEntries(process.argv.slice(3).map(s=>s.replace(/^--/,'').split('='))), LMIN=+(A.lmin||36), GROW=+(A.grow||3), THR=+(A.thr||0.07);

function darkness(im){ const w=im.width, h=im.height, g=new Float32Array(w*h); for(let i=0;i<g.length;i++) g[i]=Math.min(im.data[4*i],im.data[4*i+1],im.data[4*i+2]);
  const B=Math.max(16,Math.round(Math.min(w,h)/14)), bw=Math.ceil(w/B), bh=Math.ceil(h/B), bg=new Float32Array(bw*bh);
  for(let by=0;by<bh;by++) for(let bx=0;bx<bw;bx++){ const v=[]; for(let y=by*B;y<Math.min(h,by*B+B);y++) for(let x=bx*B;x<Math.min(w,bx*B+B);x++) v.push(g[y*w+x]); v.sort((a,b)=>a-b); bg[by*bw+bx]=v[Math.floor(v.length*0.85)]||255; }
  const d=new Float32Array(w*h); for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const fx=Math.max(0,Math.min(bw-1,x/B-0.5)), fy=Math.max(0,Math.min(bh-1,y/B-0.5)), x0=Math.floor(fx), y0=Math.floor(fy), x1=Math.min(bw-1,x0+1), y1=Math.min(bh-1,y0+1), tx=fx-x0, ty=fy-y0;
    const b=(bg[y0*bw+x0]*(1-tx)+bg[y0*bw+x1]*tx)*(1-ty)+(bg[y1*bw+x0]*(1-tx)+bg[y1*bw+x1]*tx)*ty; d[y*w+x]=Math.max(0,1-g[y*w+x]/Math.max(40,b)); }
  return {w,h,d}; }
function dilate(m,w,h,r){ let o=m; for(let k=0;k<r;k++){ const n=new Uint8Array(w*h); for(let y=0;y<h;y++) for(let x=0;x<w;x++){ if(!o[y*w+x]) continue; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const xx=x+dx, yy=y+dy; if(xx>=0&&yy>=0&&xx<w&&yy<h) n[yy*w+xx]=1; } } o=n; } return o; }
const DIRS=[[1,0],[0,1],[1,1],[1,-1],[2,1],[1,2],[2,-1],[1,-2],[3,1],[1,3],[3,-1],[1,-3]];
function lineMask(ink,w,h,lmin){ const wide=dilate(ink,w,h,1), out=new Uint8Array(w*h), fw=new Uint16Array(w*h), bk=new Uint16Array(w*h);
  DIRS.forEach(([dx,dy])=>{ const len=Math.hypot(dx,dy); fw.fill(0); bk.fill(0);
    const ys=dy>=0?[0,h,1]:[h-1,-1,-1], xs=dx>=0?[0,w,1]:[w-1,-1,-1];
    for(let y=ys[0];y!==ys[1];y+=ys[2]) for(let x=xs[0];x!==xs[1];x+=xs[2]){ const i=y*w+x; if(!wide[i]) continue; const px=x-dx, py=y-dy; fw[i]=(px>=0&&py>=0&&px<w&&py<h?fw[py*w+px]:0)+1; }
    for(let y=ys[1]-ys[2];y!==ys[0]-ys[2];y-=ys[2]) for(let x=xs[1]-xs[2];x!==xs[0]-xs[2];x-=xs[2]){ const i=y*w+x; if(!wide[i]) continue; const px=x+dx, py=y+dy; bk[i]=(px>=0&&py>=0&&px<w&&py<h?bk[py*w+px]:0)+1; }
    for(let i=0;i<w*h;i++) if(ink[i]&&(fw[i]+bk[i]-1)*len>=lmin) out[i]=1; });
  return out; }
function comps(m,w,h){ const lab=new Int32Array(w*h), out=[]; let n=0; const st=[];
  for(let s=0;s<w*h;s++){ if(!m[s]||lab[s]) continue; n++; lab[s]=n; st.length=0; st.push(s); let x0=1e9,y0=1e9,x1=-1,y1=-1,c=0;
    while(st.length){ const i=st.pop(), x=i%w, y=(i-x)/w; c++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=w||yy>=h) continue; const j=yy*w+xx; if(m[j]&&!lab[j]){ lab[j]=n; st.push(j); } } }
    out.push({x0,y0,x1,y1,c,id:n}); }
  return {lab,list:out}; }

function detect(im,o){ o=o||{}; const lmin=o.lmin||LMIN, grow=o.grow||GROW, thr=o.thr||THR, {w,h,d}=darkness(im);
  const ink=new Uint8Array(w*h); for(let i=0;i<ink.length;i++) ink[i]=d[i]>thr?1:0;
  const ln=lineMask(ink,w,h,lmin), rest=new Uint8Array(w*h); const lnw=dilate(ln,w,h,1); for(let i=0;i<rest.length;i++) rest[i]=ink[i]&&!lnw[i]?1:0;
  const big=dilate(rest,w,h,grow), {list}=comps(big,w,h), res=[];
  const s=Math.max(8,Math.min(w,h)/60);   // типичный размер буквы ≈ s px (≈ 12 px на фото 700 px)
  list.forEach(c=>{ const bw=c.x1-c.x0+1-2*grow, bh=c.y1-c.y0+1-2*grow; if(Math.max(bw,bh)<s*0.5||Math.max(bw,bh)>s*6||c.c<s*s*0.5) return;
    res.push({cx:(c.x0+c.x1)/2,cy:(c.y0+c.y1)/2,r:Math.max(bw,bh)/2+grow+2,bw,bh}); });
  return {w,h,circles:res,ink,lines:ln}; }

function draw(im,r,path){ const o={width:im.width,height:im.height,data:new Uint8ClampedArray(im.data)}, w=o.width, put=(x,y,c)=>{ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=o.width||y>=o.height) return; const i=(y*w+x)*4; o.data[i]=c[0]; o.data[i+1]=c[1]; o.data[i+2]=c[2]; };
  for(let i=0;i<r.lines.length;i++) if(r.lines[i]){ const x=i%w, y=(i-x)/w; put(x,y,[60,120,255]); }
  r.circles.forEach(c=>{ for(let a=0;a<6.283;a+=0.5/Math.max(4,c.r)){ put(c.cx+c.r*Math.cos(a),c.cy+c.r*Math.sin(a),[230,0,0]); put(c.cx+(c.r+1)*Math.cos(a),c.cy+(c.r+1)*Math.sin(a),[230,0,0]); } });
  fs.writeFileSync(path,IMG.encodePNG(o)); }

module.exports={detect,darkness,dilate,lineMask,comps};
if(require.main===module){ const f=process.argv[2], im=IMG.decodePNG(fs.readFileSync(f)), t0=Date.now(), r=detect(im);
  const out=(A.out||'.')+'/'+require('path').basename(f,'.png')+'-text.png'; draw(im,r,out); console.log(f+': '+im.width+'×'+im.height+', кружков '+r.circles.length+', '+(Date.now()-t0)+' мс → '+out); }
