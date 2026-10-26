/* Данные для очистителя: пары «выпрямленное фото ↔ чистая правда, где лежит линия карандаша» с синтетических листов.
   node lab/dz/cleaner/gen.js --seed=0 --count=40 --out=файл.bin
   Листы — все виды, что видит сканер: ДЗ №3 с четырьмя чертежами (quadsynth), ДЗ №2 на А3 (vsynth), лист в клетку и чистый
   (gsynth); съёмка — от хорошей до плохой (LEVELS normal / hard), камера от 12 до 2 Мп (на листе от ~8 до ~3 px/мм).
   Патч 96 × 96 px в мм листа при 8 px/мм (иногда 5): вход — серое фото, правда — покрытие линией (0…1). Подписи, кружки,
   сетка печати и тени в правду не входят. Формат: заголовок 'NCHC', u32 N, u32 S, затем N × (S² входа + S² правды), u8. */
const IMG=require('../../img.js'), fs=require('fs'), Q=require('../quadsynth.js'), VS=require('../vsynth.js'), GS=require('../gsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), SEED=+(A.seed||0), COUNT=+(A.count||20), OUT=A.out||'part.bin', S=96, PER=+(A.per||120);
const R=IMG.rng(SEED*977+13);
const sizes=[[2250,3000],[1800,2400],[1500,2000],[1200,1600],[900,1200]];
function make(i){ const k=R(), lv=R()<0.35?'hard':'normal', sz=sizes[Math.floor(R()*sizes.length)], seed=SEED*1000+i+1, turn=Math.floor(R()*4);
  if(k<0.4){ const s=Q.sheet({n:1+Math.floor(R()*30),seed,level:lv,turn,size:sz,clean:true}); return s&&{img:s.img,H:s.truth.H,cl:s.truth.clean}; }
  if(k<0.65){ const errs=['ok','h','apex','vis','link']; const s=VS.sheet({dz:2,n:1+Math.floor(R()*30),err:errs[Math.floor(R()*errs.length)],seed,level:lv,turn,size:sz,clean:true}); return s&&{img:s.img,H:s.truth.H,cl:s.truth.clean}; }
  const plain=R()<0.5, s=GS.sheet({n:1+Math.floor(R()*30),err:['ok','given','p3h','rad'][Math.floor(R()*4)],seed,level:lv,plain,page:R()<0.5?'A4':'A3',size:plain?null:null,clean:true}); return s&&{img:s.img,H:s.truth.H,cl:s.truth.clean}; }
const lum=im=>{ const g=new Float32Array(im.width*im.height); for(let i=0;i<g.length;i++) g[i]=0.299*im.data[4*i]+0.587*im.data[4*i+1]+0.114*im.data[4*i+2]; return g; };
const bil=(a,w,h,x,y)=>{ const x0=Math.floor(x), y0=Math.floor(y); if(x0<0||y0<0||x0>=w-1||y0>=h-1) return null; const fx=x-x0, fy=y-y0, i=y0*w+x0; return (a[i]*(1-fx)+a[i+1]*fx)*(1-fy)+(a[i+w]*(1-fx)+a[i+w+1]*fx)*fy; };
const chunks=[]; let N=0;
for(let i=0;i<COUNT;i++){ const t0=Date.now(); let s=null; try{ s=make(i); }catch(e){ console.error('лист '+i+': '+e.message); } if(!s||!s.cl) continue;
  const g=lum(s.img), W=s.img.width, Hh=s.img.height, cl=s.cl, cpx=cl.px, pw=cl.w/cpx, ph=cl.h/cpx;
  /* где линии: точки чистой правды — центры половины патчей */
  const on=[]; for(let j=0;j<cl.a.length;j+=7) if(cl.a[j]>0.5) on.push(j);
  let got=0;
  for(let p=0;p<PER*3&&got<PER;p++){ const ppm=R()<0.75?8:5, span=S/ppm; let u0,v0;
    if(on.length&&R()<0.6){ const j=on[Math.floor(R()*on.length)]; u0=(j%cl.w)/cpx-span*R(); v0=Math.floor(j/cl.w)/cpx-span*R(); } else { u0=R()*(pw-span); v0=R()*(ph-span); }
    const inp=Buffer.alloc(S*S), tgt=Buffer.alloc(S*S); let bad=false;
    for(let y=0;y<S&&!bad;y++) for(let x=0;x<S;x++){ const u=u0+(x+0.5)/ppm, v=v0+(y+0.5)/ppm, q=IMG.H.apply(s.H,[u,v]), val=bil(g,W,Hh,q[0]-0.5,q[1]-0.5); if(val==null){ bad=true; break; }
      inp[y*S+x]=Math.round(val); const c=bil(cl.a,cl.w,cl.h,u*cpx-0.5,v*cpx-0.5); tgt[y*S+x]=Math.round(255*Math.min(1,c||0)); }
    if(bad) continue; chunks.push(inp,tgt); got++; N++; }
  console.log('лист '+(i+1)+'/'+COUNT+': патчей '+got+', '+((Date.now()-t0)/1000).toFixed(1)+' с'); }
const hd=Buffer.alloc(12); hd.write('NCHC',0); hd.writeUInt32LE(N,4); hd.writeUInt32LE(S,8); fs.writeFileSync(OUT,Buffer.concat([hd,...chunks])); console.log('записано '+N+' патчей → '+OUT);
