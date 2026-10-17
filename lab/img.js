/* ═══════════ Изображения: общие для синтетики и сканера ═══════════
   Картинка — как ImageData браузера: {width, height, data: Uint8ClampedArray RGBA}. Так один и тот же код
   работает с canvas на телефоне и в Node (тесты, lab/eval.js). Серое — {w, h, a: Float32Array}.
   Гомография — 3×3 (массив из 9), точка листа (мм) → пиксель фото. */
(function(){
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };

const gray=(w,h,fill)=>{ const a=new Float32Array(w*h); if(fill) a.fill(fill); return {w,h,a}; };
const rgba=(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)});
/* яркость 0…1 и отдельно «синева» (b − r) — по ней отличается клетка/синие чернила от графита */
function toGray(im){ const n=im.width*im.height, g=gray(im.width,im.height), d=im.data;
  for(let i=0;i<n;i++) g.a[i]=(0.299*d[4*i]+0.587*d[4*i+1]+0.114*d[4*i+2])/255; return g; }
function chroma(im){ const n=im.width*im.height, g=gray(im.width,im.height), d=im.data;
  for(let i=0;i<n;i++) g.a[i]=(d[4*i+2]-(d[4*i]+d[4*i+1])/2)/255; return g; }
function grayToRGBA(g,lo,hi){ lo=lo==null?0:lo; hi=hi==null?1:hi; const im=rgba(g.w,g.h), d=im.data;
  for(let i=0;i<g.w*g.h;i++){ const v=Math.max(0,Math.min(255,(g.a[i]-lo)/(hi-lo)*255)); d[4*i]=d[4*i+1]=d[4*i+2]=v; d[4*i+3]=255; } return im; }

/* билинейная выборка (за краем — null) */
function sample(g,x,y){ const x0=Math.floor(x), y0=Math.floor(y); if(x0<0||y0<0||x0>=g.w-1||y0>=g.h-1) return null;
  const fx=x-x0, fy=y-y0, i=y0*g.w+x0, a=g.a;
  return (a[i]*(1-fx)+a[i+1]*fx)*(1-fy)+(a[i+g.w]*(1-fx)+a[i+g.w+1]*fx)*fy; }

/* размытие Гаусса (раздельное) */
function blur(g,s){ if(s<=0.05) return {w:g.w,h:g.h,a:g.a.slice()}; const r=Math.ceil(3*s), k=new Float32Array(2*r+1); let S=0;
  for(let i=-r;i<=r;i++){ k[i+r]=Math.exp(-i*i/(2*s*s)); S+=k[i+r]; } for(let i=0;i<k.length;i++) k[i]/=S;
  const {w,h}=g, t=new Float32Array(w*h), o=new Float32Array(w*h);
  for(let y=0;y<h;y++){ const row=y*w; for(let x=0;x<w;x++){ let v=0; for(let j=-r;j<=r;j++){ const xx=x+j<0?0:x+j>=w?w-1:x+j; v+=g.a[row+xx]*k[j+r]; } t[row+x]=v; } }
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let v=0; for(let j=-r;j<=r;j++){ const yy=y+j<0?0:y+j>=h?h-1:y+j; v+=t[yy*w+x]*k[j+r]; } o[y*w+x]=v; }
  return {w,h,a:o}; }
/* уменьшение в целое число раз (среднее) */
function shrink(g,f){ const w=Math.floor(g.w/f), h=Math.floor(g.h/f), o=gray(w,h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let s=0; for(let j=0;j<f;j++) for(let i=0;i<f;i++) s+=g.a[(y*f+j)*g.w+x*f+i]; o.a[y*w+x]=s/(f*f); } return o; }
/* фото → уменьшенное RGBA (телефон даёт 12 Мп — работаем с ≤ max пикселей по длинной стороне) */
function downscale(im,max){ const f=Math.max(1,Math.ceil(Math.max(im.width,im.height)/max)); if(f===1) return im;
  const w=Math.floor(im.width/f), h=Math.floor(im.height/f), o=rgba(w,h), d=im.data;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) for(let c=0;c<4;c++){ let s=0; for(let j=0;j<f;j++) for(let i=0;i<f;i++) s+=d[((y*f+j)*im.width+x*f+i)*4+c]; o.data[(y*w+x)*4+c]=s/(f*f); }
  o.scale=f; return o; }

/* ── гомография ── */
const H={
  apply:(M,p)=>{ const z=M[6]*p[0]+M[7]*p[1]+M[8]; return [(M[0]*p[0]+M[1]*p[1]+M[2])/z,(M[3]*p[0]+M[4]*p[1]+M[5])/z]; },
  inv(M){ const [a,b,c,d,e,f,g,h,i]=M, A=e*i-f*h, B=-(d*i-f*g), C=d*h-e*g, D=-(b*i-c*h), E=a*i-c*g, F=-(a*h-b*g), G=b*f-c*e, Hh=-(a*f-c*d), I=a*e-b*d, det=a*A+b*B+c*C;
    return [A/det,D/det,G/det,B/det,E/det,Hh/det,C/det,F/det,I/det]; },
  mul:(A,B)=>{ const o=new Array(9); for(let r=0;r<3;r++) for(let c=0;c<3;c++){ o[3*r+c]=A[3*r]*B[c]+A[3*r+1]*B[3+c]+A[3*r+2]*B[6+c]; } return o; },
  norm:M=>M.map(v=>v/M[8]),
  /* по ≥ 4 парам точек (src → dst), МНК с h33 = 1, с нормировкой координат (Хартли) */
  fit(src,dst,wt){ const nrm=P=>{ const n=P.length, mx=P.reduce((s,p)=>s+p[0],0)/n, my=P.reduce((s,p)=>s+p[1],0)/n;
      const sd=Math.sqrt(P.reduce((s,p)=>s+(p[0]-mx)**2+(p[1]-my)**2,0)/n/2)||1; return [1/sd,0,-mx/sd,0,1/sd,-my/sd,0,0,1]; };
    const Ts=nrm(src), Td=nrm(dst), S=src.map(p=>H.apply(Ts,p)), D=dst.map(p=>H.apply(Td,p));
    const A=Array.from({length:8},()=>new Float64Array(9));
    S.forEach((p,k)=>{ const [x,y]=p, [u,v]=D[k], w=wt?wt[k]:1;
      [[x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]].forEach(r=>{ for(let i=0;i<8;i++){ for(let j=0;j<8;j++) A[i][j]+=w*r[i]*r[j]; A[i][8]+=w*r[i]*r[8]; } }); });
    const h=solve(A); if(!h) return null; const M=[...h,1];
    return H.norm(H.mul(H.inv(Td),H.mul(M,Ts))); },
};
/* Гаусс с выбором главного элемента: A — n×(n+1) */
function solve(A){ const n=A.length; A=A.map(r=>Array.from(r));
  for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(A[r][c])>Math.abs(A[p][c])) p=r; if(Math.abs(A[p][c])<1e-14) return null;
    [A[c],A[p]]=[A[p],A[c]]; for(let r=0;r<n;r++){ if(r===c) continue; const f=A[r][c]/A[c][c]; if(f) for(let k=c;k<=n;k++) A[r][k]-=f*A[c][k]; } }
  return A.map((r,i)=>r[n]/r[i]); }

/* ── PNG (Node: zlib; для отладки и отметок поверх фото) ── */
function crc32(buf){ let c, t=crc32.t; if(!t){ t=crc32.t=new Int32Array(256); for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; t[n]=c; } }
  c=-1; for(let i=0;i<buf.length;i++) c=t[(c^buf[i])&255]^(c>>>8); return (c^-1)>>>0; }
function encodePNG(im){ const zlib=require('zlib'), {width:w,height:h,data:d}=im, raw=Buffer.alloc((w*3+1)*h);
  for(let y=0;y<h;y++){ raw[y*(w*3+1)]=0; for(let x=0;x<w;x++) for(let c=0;c<3;c++) raw[y*(w*3+1)+1+x*3+c]=d[(y*w+x)*4+c]; }
  const chunk=(type,data)=>{ const len=Buffer.alloc(4); len.writeUInt32BE(data.length); const td=Buffer.concat([Buffer.from(type),data]), cr=Buffer.alloc(4); cr.writeUInt32BE(crc32(td)); return Buffer.concat([len,td,cr]); };
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=2; ihdr[10]=ihdr[11]=ihdr[12]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]); }
/* PNG → RGBA (8 бит, RGB/RGBA/серое, без чересстрочности) — для фото владельца, сохранённых как PNG */
function decodePNG(buf){ const zlib=require('zlib'); let p=8, w, h, bd, ct; const idat=[];
  while(p<buf.length){ const len=buf.readUInt32BE(p), type=buf.toString('ascii',p+4,p+8), data=buf.slice(p+8,p+8+len); p+=12+len;
    if(type==='IHDR'){ w=data.readUInt32BE(0); h=data.readUInt32BE(4); bd=data[8]; ct=data[9]; if(data[12]) throw new Error('PNG: чересстрочный не поддержан'); }
    if(type==='IDAT') idat.push(data); if(type==='IEND') break; }
  if(bd!==8) throw new Error('PNG: только 8 бит'); const ch={0:1,2:3,4:2,6:4}[ct]; if(!ch) throw new Error('PNG: палитра не поддержана');
  const raw=zlib.inflateSync(Buffer.concat(idat)), st=w*ch, out=rgba(w,h); let prev=new Uint8Array(st), cur=new Uint8Array(st);
  for(let y=0;y<h;y++){ const f=raw[y*(st+1)]; for(let x=0;x<st;x++){ const a=x>=ch?cur[x-ch]:0, b=prev[x], c=x>=ch?prev[x-ch]:0, r=raw[y*(st+1)+1+x];
      const pa=Math.abs(b-c), pb=Math.abs(a-c), pc=Math.abs(a+b-2*c);
      cur[x]=(r+[0,a,b,(a+b)>>1,pa<=pb&&pa<=pc?a:pb<=pc?b:c][f])&255; }
    for(let x=0;x<w;x++){ const o=(y*w+x)*4; if(ch>=3){ out.data[o]=cur[x*ch]; out.data[o+1]=cur[x*ch+1]; out.data[o+2]=cur[x*ch+2]; } else out.data[o]=out.data[o+1]=out.data[o+2]=cur[x*ch]; out.data[o+3]=255; }
    [prev,cur]=[cur,prev]; }
  return out; }

/* генератор случайных чисел с seed (тот же, что в tests/: Парк — Миллер) и нормальное распределение */
function rng(seed){ let s=(seed>>>0)%2147483647||1; const u=()=>((s=(s*16807)%2147483647)/2147483647); for(let i=0;i<5;i++) u();   /* разгон: соседние seed не дают соседних первых чисел */
  u.n=(m,sd)=>{ const a=u()||1e-12, b=u(); return (m||0)+(sd==null?1:sd)*Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b); };
  u.r=(lo,hi)=>lo+(hi-lo)*u(); u.pick=a=>a[Math.floor(u()*a.length)]; return u; }

put('img',{gray,rgba,toGray,chroma,grayToRGBA,sample,blur,shrink,downscale,H,solve,encodePNG,decodePNG,rng});
})();
