/* Векторизатор прямых линий: любое фото чертежа → отрезки (px) + самопроверка «копия против фото». Без обучения.
   node lab/dz/textnet/vec.js фото.png [--out=каталог]  → <имя>-vec.svg, <имя>-vec.png (разбор), цифры
   1) линии-пиксели — blobs.lineMask (чернила на прямой цепочке); 2) Хаф по ним, пик → пиксели полосы ±1,5 px → участки без
   разрывов > gap → МНК по пикселям (точная прямая и концы); пиксели участка вычитаются из голосов; 3) самопроверка:
   полнота (линия-пиксели ≤ 2 px от отрезка), опора (доля длины отрезка на чернилах), невязка — картинкой. */
const IMG=require('../../img.js'), B=require('./blobs.js'), fs=require('fs');
const A=Object.fromEntries(process.argv.slice(3).map(s=>s.replace(/^--/,'').split('='))), GAP=+(A.gap||9), LMIN=+(A.lmin||36), VMIN=+(A.vmin||30);

function vectorize(im,o){ o=o||{}; const lmin=o.lmin||LMIN, gap=o.gap||GAP, vmin=o.vmin||VMIN, {w,h,d}=B.darkness(im), ink=new Uint8Array(w*h);
  for(let i=0;i<ink.length;i++) ink[i]=d[i]>(o.thr||0.07)?1:0;
  const ln=B.lineMask(ink,w,h,lmin), P=[]; for(let i=0;i<w*h;i++) if(ln[i]) P.push(i);
  const NA=360, D=Math.ceil(Math.hypot(w,h)), RO=2*D+1, acc=new Int32Array(NA*RO), cs=new Float64Array(NA), sn=new Float64Array(NA);
  for(let a=0;a<NA;a++){ const t=a*Math.PI/NA; cs[a]=Math.cos(t); sn[a]=Math.sin(t); }
  const alive=new Uint8Array(w*h), vote=(i,s)=>{ const x=i%w, y=(i-x)/w; for(let a=0;a<NA;a++){ const r=Math.round(x*cs[a]+y*sn[a])+D; acc[a*RO+r]+=s; } };
  P.forEach(i=>{ alive[i]=1; vote(i,1); });
  const segs=[]; for(let it=0;it<400;it++){
    let best=0, ba=0, br=0; for(let a=0;a<NA;a++) for(let r=1;r<RO-1;r++){ const v=acc[a*RO+r]+acc[a*RO+r-1]+acc[a*RO+r+1]; if(v>best){ best=v; ba=a; br=r; } }
    if(best<vmin*1.5) break; const nx=cs[ba], ny=sn[ba], rho=br-D, dx=-ny, dy=nx;
    const band=[]; P.forEach(i=>{ if(!alive[i]) return; const x=i%w, y=(i-x)/w; if(Math.abs(x*nx+y*ny-rho)<=1.6) band.push([x*dx+y*dy,i]); });
    band.sort((p,q)=>p[0]-q[0]); let run=[], runs=[]; band.forEach(b=>{ if(run.length&&b[0]-run[run.length-1][0]>gap){ runs.push(run); run=[]; } run.push(b); }); if(run.length) runs.push(run);
    let used=0; runs.forEach(r=>{ if(r.length<4||r[r.length-1][0]-r[0][0]<lmin) return;
      /* МНК-прямая по пикселям участка */ let mx=0,my=0; r.forEach(([,i])=>{ mx+=i%w; my+=Math.floor(i/w); }); mx/=r.length; my/=r.length; let sxx=0,syy=0,sxy=0; r.forEach(([,i])=>{ const x=i%w-mx, y=Math.floor(i/w)-my; sxx+=x*x; syy+=y*y; sxy+=x*y; });
      const th=0.5*Math.atan2(2*sxy,sxx-syy), ux=Math.cos(th), uy=Math.sin(th); let t0=1e9,t1=-1e9; r.forEach(([,i])=>{ const t=(i%w-mx)*ux+(Math.floor(i/w)-my)*uy; if(t<t0)t0=t; if(t>t1)t1=t; });
      segs.push({a:[mx+t0*ux,my+t0*uy],b:[mx+t1*ux,my+t1*uy],n:r.length}); r.forEach(([,i])=>{ if(alive[i]){ alive[i]=0; vote(i,-1); used++; } }); });
    if(!used){ for(let a=0;a<NA;a++) for(let r=Math.max(0,br-1);r<=Math.min(RO-1,br+1);r++) acc[a===ba?a*RO+r:0]=a===ba?0:acc[0]; if(!used) acc[ba*RO+br]=0,acc[ba*RO+br-1]=0,acc[ba*RO+br+1]=0; } }
  /* слияние дублей: толстая линия даёт 2–3 параллельных отрезка → один (по взвешенным концам), толщина = пикселей / длину */
  segs.sort((p,q)=>q.n-p.n); const M=[]; segs.forEach(s=>{ const L=Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]), ux=(s.b[0]-s.a[0])/L, uy=(s.b[1]-s.a[1])/L; let host=null;
    for(const m of M){ const ml=Math.hypot(m.b[0]-m.a[0],m.b[1]-m.a[1]), mx=(m.b[0]-m.a[0])/ml, my=(m.b[1]-m.a[1])/ml; if(Math.abs(ux*my-uy*mx)>0.026) continue;
      const nx=-my, ny=mx, d0=(s.a[0]-m.a[0])*nx+(s.a[1]-m.a[1])*ny, d1=(s.b[0]-m.a[0])*nx+(s.b[1]-m.a[1])*ny; if(Math.abs(d0)>3.2||Math.abs(d1)>3.2) continue;
      const t0=(s.a[0]-m.a[0])*mx+(s.a[1]-m.a[1])*my, t1=(s.b[0]-m.a[0])*mx+(s.b[1]-m.a[1])*my; if(Math.max(t0,t1)<-2||Math.min(t0,t1)>ml+2) continue; host=m; break; }
    if(!host){ M.push({a:s.a.slice(),b:s.b.slice(),n:s.n}); return; }
    const ml=Math.hypot(host.b[0]-host.a[0],host.b[1]-host.a[1]), mx=(host.b[0]-host.a[0])/ml, my=(host.b[1]-host.a[1])/ml, T=p=>(p[0]-host.a[0])*mx+(p[1]-host.a[1])*my;
    const ts=[0,ml,T(s.a),T(s.b)], lo=Math.min(...ts), hi=Math.max(...ts); host.a=[host.a[0]+mx*lo,host.a[1]+my*lo]; host.b=[host.a[0]+mx*(hi-lo),host.a[1]+my*(hi-lo)]; host.n+=s.n; });
  segs.length=0; M.forEach(m=>segs.push(m));
  /* самопроверка */
  const dil=B.dilate(ink,w,h,1), near=new Uint8Array(w*h);
  segs.forEach(s=>{ const L=Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]); let on=0,N=Math.max(2,Math.round(L)); for(let k=0;k<=N;k++){ const x=Math.round(s.a[0]+(s.b[0]-s.a[0])*k/N), y=Math.round(s.a[1]+(s.b[1]-s.a[1])*k/N); if(x>=0&&y>=0&&x<w&&y<h&&dil[y*w+x]) on++; } s.L=L; s.support=on/(N+1); s.width=+(s.n/L).toFixed(1);
    const ux=(s.b[0]-s.a[0])/L, uy=(s.b[1]-s.a[1])/L; for(let k=0;k<=N;k++){ const x=s.a[0]+ux*k*L/N, y=s.a[1]+uy*k*L/N; for(let oy=-2;oy<=2;oy++) for(let ox=-2;ox<=2;ox++){ const xx=Math.round(x)+ox, yy=Math.round(y)+oy; if(xx>=0&&yy>=0&&xx<w&&yy<h) near[yy*w+xx]=1; } } });
  let ex=0; P.forEach(i=>{ if(near[i]) ex++; });
  const lost=new Uint8Array(w*h); P.forEach(i=>{ if(!near[i]) lost[i]=1; });
  return {w,h,segs,recall:P.length?ex/P.length:1,lines:P.length,lost,ink,support:segs.length?segs.reduce((s,q)=>s+q.support*q.L,0)/segs.reduce((s,q)=>s+q.L,0):1}; }

function svg(r){ return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+r.w+' '+r.h+'">'+r.segs.map(s=>'<line x1="'+s.a[0].toFixed(2)+'" y1="'+s.a[1].toFixed(2)+'" x2="'+s.b[0].toFixed(2)+'" y2="'+s.b[1].toFixed(2)+'" stroke="#000" stroke-width="1"/>').join('')+'</svg>'; }
function report(im,r,path){ const w=r.w, o={width:im.width,height:im.height,data:new Uint8ClampedArray(im.data)}, put=(x,y,c)=>{ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=r.w||y>=r.h) return; const i=(y*w+x)*4; o.data[i]=c[0]; o.data[i+1]=c[1]; o.data[i+2]=c[2]; };
  for(let i=0;i<r.lost.length;i++) if(r.lost[i]) put(i%w,Math.floor(i/w),[255,140,0]);
  r.segs.forEach(s=>{ const N=Math.ceil(s.L); for(let k=0;k<=N;k++) put(s.a[0]+(s.b[0]-s.a[0])*k/N,s.a[1]+(s.b[1]-s.a[1])*k/N,s.support>0.9?[0,150,255]:[230,0,200]); });
  fs.writeFileSync(path,IMG.encodePNG(o)); }
module.exports={vectorize,svg,report};
if(require.main===module){ const f=process.argv[2], im=IMG.decodePNG(fs.readFileSync(f)), t0=Date.now(), r=vectorize(im), base=(A.out||'.')+'/'+require('path').basename(f,'.png');
  fs.writeFileSync(base+'-vec.svg',svg(r)); report(im,r,base+'-vec.png');
  console.log(f+': отрезков '+r.segs.length+', полнота '+(100*r.recall).toFixed(0)+' % линия-пикселей, опора '+(100*r.support).toFixed(0)+' %, '+(Date.now()-t0)+' мс'); }
