/* ═══════════ Извлечение линий: отрезки и их тип ═══════════
   Работает в мм чертежа: карта тёмности (lab/clean.js) выпрямляется по гомографии в область построения (8 px/мм).
   1. Гребни: гессиан гауссова сглаживания (σ ≈ 0,19 мм) — сила тонкой линии и её направление в каждом пикселе;
      широкие бледные следы (стёртые линии, тени) на этом масштабе отвечают слабо. Порог — от шума бумаги.
   2. Хаф с голосованием по направлению: пиксель-гребень голосует только за углы ±3° от своего направления.
      Пики по одному: пиксели у прямой → участки вдоль неё (разрыв > 2,5 мм — новый отрезок), прямая уточняется
      МНК по субпиксельным серединам гребня, пиксели снимаются, Хаф пересчитывается.
   3. Свойства отрезка: концы, длина, тёмность (контраст), «вес» (тёмность × ширина — основная линия тяжелее
      тонкой), заполненность (штриховая — с регулярными разрывами), σ — разброс середины гребня поперёк.
   Напечатанное «дано» известно из шаблона: его пиксели (и печатные подписи) исключаются до поиска.
   extract(img, rect, {n}) → {ok, segs:[…], scene, map}. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('./'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const IMG=lab('img'), CL=lab('clean'), {SHEETS,toPage}=lab('sheets'), font=lab('font');
const PPM=8;

/* производные гауссианы (раздельные свёртки) */
function kern(s,o){ const r=Math.ceil(3.5*s), k=new Float32Array(2*r+1); for(let i=-r;i<=r;i++){ const g=Math.exp(-i*i/(2*s*s));
    k[i+r]=o===0?g:o===1?-i/(s*s)*g:(i*i/(s*s)-1)/(s*s)*g; }
  if(o===0){ let S=0; k.forEach(v=>S+=v); for(let i=0;i<k.length;i++) k[i]/=S; } else { const n=1/(Math.sqrt(2*Math.PI)*s); for(let i=0;i<k.length;i++) k[i]*=n; } return k; }
function conv(g,kx,ky){ const {w,h}=g, t=new Float32Array(w*h), o=new Float32Array(w*h), rx=(kx.length-1)/2, ry=(ky.length-1)/2;
  for(let y=0;y<h;y++){ const row=y*w; for(let x=0;x<w;x++){ let v=0; for(let j=-rx;j<=rx;j++){ const xx=x+j<0?0:x+j>=w?w-1:x+j; v+=g.a[row+xx]*kx[j+rx]; } t[row+x]=v; } }
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let v=0; for(let j=-ry;j<=ry;j++){ const yy=y+j<0?0:y+j>=h?h-1:y+j; v+=t[yy*w+x]*ky[j+ry]; } o[y*w+x]=v; }
  return {w,h,a:o}; }
function ridges(g,s){ const k0=kern(s,0), k1=kern(s,1), k2=kern(s,2), xx=conv(g,k2,k0), yy=conv(g,k0,k2), xy=conv(g,k1,k1), n=g.w*g.h;
  const R=new Float32Array(n), nx=new Float32Array(n), ny=new Float32Array(n);
  for(let i=0;i<n;i++){ const a=xx.a[i], b=xy.a[i], c=yy.a[i], tr=(a+c)/2, d=Math.sqrt(((a-c)/2)**2+b*b), l1=tr-d; /* наименьшее собственное */
    if(l1<0){ R[i]=-l1*s*s; let vx=b, vy=l1-a; if(Math.abs(vx)+Math.abs(vy)<1e-12){ vx=l1-c; vy=b; } const L=Math.hypot(vx,vy)||1; nx[i]=vx/L; ny[i]=vy/L; } }
  return {R,nx,ny}; }

/* маска напечатанного: линии «дано» (±0,45 мм), кружки, подписи — по шаблону, в мм страницы */
function printMask(SH,box,w,h){ const m=new Uint8Array(w*h), P=p=>[(p[0]-box[0])*PPM,(p[1]-box[1])*PPM];
  const segMask=(a,b,r)=>{ const A=P(a), B=P(b), R=r*PPM, x0=Math.max(0,Math.floor(Math.min(A[0],B[0])-R)), x1=Math.min(w-1,Math.ceil(Math.max(A[0],B[0])+R)), y0=Math.max(0,Math.floor(Math.min(A[1],B[1])-R)), y1=Math.min(h-1,Math.ceil(Math.max(A[1],B[1])+R));
    const dx=B[0]-A[0], dy=B[1]-A[1], L2=dx*dx+dy*dy||1e-9; for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ const t=Math.max(0,Math.min(1,((x+0.5-A[0])*dx+(y+0.5-A[1])*dy)/L2)), ex=x+0.5-A[0]-t*dx, ey=y+0.5-A[1]-t*dy; if(ex*ex+ey*ey<=R*R) m[y*w+x]=1; } };
  /* печатные подписи не маскируем: линия студента часто идёт прямо по букве (катет мимо «A′»); их штрихи короткие,
     а найденный отрезок, целиком лежащий на печатной букве, помечается print и не считается «лишним» */
  SH.given().forEach(it=>{ if(it.t==='seg'||it.t==='conn') segMask(toPage(SH,it.a),toPage(SH,it.b),0.35);
    if(it.t==='pt') segMask(toPage(SH,it.at),toPage(SH,it.at),1.1); });
  return m; }
/* штрихи печатных подписей (мм страницы) */
function printText(SH){ const out=[]; SH.given().forEach(it=>{ if(it.t!=='txt') return; font.layout(it.s,toPage(SH,it.at),it.size).strokes.forEach(pl=>{ for(let i=0;i<pl.length-1;i++) out.push([pl[i],pl[i+1]]); }); }); return out; }
const dSeg=(p,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy||1e-9, t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L)); return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); };

function extract(img,rect,o){ o=o||{}; const SH=SHEETS[o.n||47], roi=SH.roi, box=[toPage(SH,[roi[0],roi[1]])[0],toPage(SH,[roi[0],roi[1]])[1],toPage(SH,[roi[2],roi[3]])[0],toPage(SH,[roi[2],roi[3]])[1]];
  /* карта тёмности по полному фото — только в прямоугольнике, который покрывает область построения */
  let ink=rect.ink, M=rect.H; if(!ink){ const cs=[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]].map(p=>IMG.H.apply(rect.H,p));
    const x0=Math.max(0,Math.floor(Math.min(...cs.map(p=>p[0]))-20)), y0=Math.max(0,Math.floor(Math.min(...cs.map(p=>p[1]))-20)), x1=Math.min(img.width,Math.ceil(Math.max(...cs.map(p=>p[0]))+20)), y1=Math.min(img.height,Math.ceil(Math.max(...cs.map(p=>p[1]))+20));
    const cr=IMG.rgba(x1-x0,y1-y0); for(let y=y0;y<y1;y++) cr.data.set(img.data.subarray((y*img.width+x0)*4,(y*img.width+x1)*4),((y-y0)*(x1-x0))*4);
    ink=CL.ink(cr).ink; M=IMG.H.norm(IMG.H.mul([1,0,-x0,0,1,-y0,0,0,1],rect.H)); }
  const g=CL.warp(ink,M,box,PPM), {w,h}=g, n=w*h, mask=printMask(SH,box,w,h);
  const {R,nx,ny}=ridges(g,1.5);
  /* шум: распределение R на бумаге */
  const smp=[]; for(let i=0;i<n;i+=11) if(!mask[i]) smp.push(R[i]); smp.sort((a,b)=>a-b);
  const med=smp[Math.floor(smp.length/2)], mad=smp.map(v=>Math.abs(v-med)).sort((a,b)=>a-b)[Math.floor(smp.length/2)]*1.4826;
  const tR=Math.max(0.012,med+8*mad);
  /* середины гребня: пиксели выше порога и максимумы поперёк линии */
  const C=[]; for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){ const i=y*w+x; if(R[i]<tR||mask[i]) continue;
    const ax=nx[i], ay=ny[i], r1=bil(R,w,h,x+ax,y+ay), r2=bil(R,w,h,x-ax,y-ay); if(R[i]<r1||R[i]<r2) continue;
    /* субпиксельная середина: парабола по трём точкам поперёк */
    const den=r1-2*R[i]+r2, off=den<0?Math.max(-0.5,Math.min(0.5,0.5*(r1-r2)/-den*-1)):0;
    C.push({x:x+0.5+ax*off,y:y+0.5+ay*off,nx:ax,ny:ay,r:R[i],v:g.a[i],used:false}); }
  /* Хаф с направлением */
  const TH=360, dth=Math.PI/TH, rmax=Math.hypot(w,h), RS=1, NR=Math.ceil(2*rmax*RS)+1, cs=[], sn=[]; for(let t=0;t<TH;t++){ cs.push(Math.cos(t*dth)); sn.push(Math.sin(t*dth)); }
  const segs=[];
  for(let iter=0;iter<(o.maxIter||80);iter++){ const acc=new Float32Array(TH*NR); let best=0, bt=0, br=0;
    for(const c of C){ if(c.used) continue; let t0=Math.round((Math.atan2(c.ny,c.nx)+2*Math.PI)%Math.PI/dth)%TH;
      /* голос по ρ — треугольником на ±1 px: разброс середины гребня (дрожь, шум) не дробит пик */
      for(let d=-6;d<=6;d++){ const t=(t0+d+TH)%TH, rho=(c.x*cs[t]+c.y*sn[t]+rmax)*RS, ri=Math.floor(rho), fr=rho-ri, k=t*NR+ri;
        acc[k]+=c.r*(1-fr*0.5); acc[k+1]+=c.r*(0.5+fr*0.5); if(ri>0) acc[k-1]+=c.r*(0.5-fr*0.5); if(fr<0.5) acc[k+2]+=0; 
        if(acc[k]>best){ best=acc[k]; bt=t; br=ri; } if(acc[k+1]>best){ best=acc[k+1]; bt=t; br=ri+1; } } }
    if(best<tR*4*PPM){ if(o.dbg) o.dbg.push('стоп на '+iter); break; } if(o.dbg) o.dbg.push(iter+': '+(bt*180/TH).toFixed(1)+'° '+(br/RS-rmax).toFixed(0)+' '+best.toFixed(2));
    /* прямая пика → пиксели у неё → участки */
    const th=bt*dth, rho=br/RS-rmax; let L={n:[Math.cos(th),Math.sin(th)],rho};
    let pts=C.filter(c=>!c.used&&Math.abs(c.x*L.n[0]+c.y*L.n[1]-L.rho)<=1.6&&Math.abs(c.nx*L.n[0]+c.ny*L.n[1])>Math.cos(12*Math.PI/180));
    if(pts.length<8){ pts.forEach(c=>{ c.used=true; c.it=iter+'s'; }); continue; }
    for(let k=0;k<2;k++){ const f=fit(pts); if(!f) break; L=f; pts=C.filter(c=>!c.used&&Math.abs(c.x*L.n[0]+c.y*L.n[1]-L.rho)<=1.3&&Math.abs(c.nx*L.n[0]+c.ny*L.n[1])>Math.cos(12*Math.PI/180)); }
    if(pts.length<8){ pts.forEach(c=>{ c.used=true; c.it=iter+'s'; }); continue; }
    const d=[-L.n[1],L.n[0]]; pts.forEach(c=>c.t=c.x*d[0]+c.y*d[1]); pts.sort((a,b)=>a.t-b.t);
    let run=[pts[0]]; const runs=[]; for(let i=1;i<pts.length;i++){ if(pts[i].t-pts[i-1].t>2.5*PPM){ runs.push(run); run=[]; } run.push(pts[i]); } runs.push(run);
    pts.forEach(c=>{ c.used=true; c.it=iter; });
    if(o.watch){ const k=pts.filter(c=>Math.hypot(c.x-o.watch[0],c.y-o.watch[1])<o.watch[2]).length; if(k) o.dbg.push('итерация '+iter+': '+k+' px у точки; прямая '+(Math.atan2(L.n[1],L.n[0])*180/Math.PI).toFixed(1)+'°, участки '+runs.map(r=>((r[r.length-1].t-r[0].t)/PPM).toFixed(1)+'мм/'+r.length).join(',')); }
    runs.forEach(r=>{ const len=(r[r.length-1].t-r[0].t)/PPM; if(len<3.5||r.length<len*PPM*0.35) return; const f=fit(r)||L;
      const dd=[-f.n[1],f.n[0]], ts=r.map(c=>c.x*dd[0]+c.y*dd[1]), t0=Math.min(...ts), t1=Math.max(...ts), p0=f.n.map(v=>v*f.rho);
      const A=[p0[0]+dd[0]*t0,p0[1]+dd[1]*t0], B=[p0[0]+dd[0]*t1,p0[1]+dd[1]*t1];
      const res=r.map(c=>c.x*f.n[0]+c.y*f.n[1]-f.rho), sd=Math.sqrt(res.reduce((s,v)=>s+v*v,0)/r.length)/PPM;
      /* профиль поперёк в точках вдоль: заполненность (есть ли линия), тёмность и «вес» = площадь профиля, мм·тёмность;
         медиана по точкам — пересечения с другими линиями её не сдвигают */
      let cov=0; const ws=[], vs=[]; const K=Math.max(6,Math.round(len*2)); for(let k=0;k<=K;k++){ const p=[A[0]+(B[0]-A[0])*k/K,A[1]+(B[1]-A[1])*k/K];
        let s=0, mx=0, base=1; for(let q=-0.9*PPM;q<=0.9*PPM;q+=0.5){ const v=bil(g.a,w,h,p[0]+f.n[0]*q-0.5,p[1]+f.n[1]*q-0.5)||0; s+=v*0.5; if(v>mx) mx=v; if(Math.abs(q)>0.6*PPM&&v<base) base=v; }
        if(mx>0.06) cov++; ws.push((s-base*1.8*PPM)/PPM); vs.push(mx-base); }
      const mdn=a=>{ const t=a.slice().sort((x,y)=>x-y); return t[Math.floor(t.length/2)]; }, wsum=mdn(ws), vmax=mdn(vs);
      const mm=p=>[box[0]+p[0]/PPM,box[1]+p[1]/PPM];
      segs.push({a:mm(A),b:mm(B),len,n:r.length,str:r.reduce((s,c)=>s+c.r,0)/r.length,dark:vmax,weight:Math.max(1e-4,wsum),fill:cov/(K+1),sd}); }); }
  if(!segs.length) return {ok:false,reason:'на листе не нашлось построений (пусто или слишком бледно) — переснимите при хорошем свете'};
  /* тип: основная — тяжёлые (вес); штриховая — заполненность < 0,8 при регулярных разрывах (здесь — по заполненности) */
  const ws=segs.map(s=>s.weight).sort((a,b)=>a-b), split=twoMeans(ws.map(Math.log));
  segs.forEach(s=>{ s.k=s.fill<0.75?'hid':(split&&Math.log(s.weight)>split?'main':'thin'); s.conf=Math.min(1,s.str/(3*tR))*Math.min(1,s.len/10); s.σ=Math.max(0.1,s.sd); });
  const pt=printText(SH); segs.forEach(s=>{ s.print=s.len<=5&&[s.a,s.b,[(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2]].every(p=>pt.some(([a,b])=>dSeg(p,a,b)<0.6)); });
  /* сцена: мм чертежа */
  const dr=p=>[p[0]-SH.O[0],p[1]-SH.O[1]];
  const scene={units:'mm',items:SH.given().map(it=>Object.assign({},it)).concat(segs.map(s=>({t:'seg',a:dr(s.a),b:dr(s.b),k:s.k,σ:+s.σ.toFixed(3),conf:+s.conf.toFixed(3),src:'hand',w:+s.weight.toFixed(4)})))};
  return {ok:true,segs:segs.map(s=>Object.assign({},s,{a:dr(s.a),b:dr(s.b)})),scene,map:{g,box,mask,tR,C}}; }

function bil(a,w,h,x,y){ const x0=Math.floor(x), y0=Math.floor(y); if(x0<0||y0<0||x0>=w-1||y0>=h-1) return 0; const fx=x-x0, fy=y-y0, i=y0*w+x0; return (a[i]*(1-fx)+a[i+1]*fx)*(1-fy)+(a[i+w]*(1-fx)+a[i+w+1]*fx)*fy; }
/* МНК-прямая n·p = rho по точкам с весом r */
function fit(P){ let W=0,mx=0,my=0; P.forEach(c=>{ W+=c.r; mx+=c.r*c.x; my+=c.r*c.y; }); if(W<=0) return null; mx/=W; my/=W;
  let sxx=0,sxy=0,syy=0; P.forEach(c=>{ const x=c.x-mx, y=c.y-my; sxx+=c.r*x*x; sxy+=c.r*x*y; syy+=c.r*y*y; });
  const a=0.5*Math.atan2(2*sxy,sxx-syy), d=[Math.cos(a),Math.sin(a)], n=[-d[1],d[0]]; return {n,rho:n[0]*mx+n[1]*my}; }
/* порог двух групп (основная / тонкая): если разрыв заметен — середина между центрами, иначе null */
function twoMeans(v){ if(v.length<4) return null; let a=Math.min(...v), b=Math.max(...v); if(b-a<0.5) return null;
  for(let it=0;it<30;it++){ const m=(a+b)/2, A=v.filter(x=>x<=m), B=v.filter(x=>x>m); if(!A.length||!B.length) return null; a=A.reduce((s,x)=>s+x,0)/A.length; b=B.reduce((s,x)=>s+x,0)/B.length; }
  return b-a>0.45?(a+b)/2:null; }

put('lines',{extract,ridges,printMask,PPM});
})();
