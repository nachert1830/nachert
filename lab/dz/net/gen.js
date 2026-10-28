/* Данные для сети глаз: синтетические листы ДЗ №3 с правдой, где каждая точка условия (A″ … S′ и начало O) каждого чертежа.
   node lab/dz/net/gen.js --seed=0 --count=40 --out=файл.bin
   Листы: чистый А3 с четырьмя чертежами (quadsynth, части а–г) и лист в клетку / чистый с одним чертежом (gsynth, часть г),
   все 30 вариантов, съёмка normal / hard (lab/synth.js: перспектива, свет, тень, шум, карандаш от руки), поворот телефона
   0/90/180/270°, камера от 12 до 2 Мп. Фото уменьшается до ≤ 3,2 px/мм листа (сеть видит лист целиком, мельче).
   Формат: 'NCHN', u32 N; затем N × (u16 w, u16 h, f32 px/мм, u16 k, k × (u8 точка, f32 x, f32 y), w·h u8 серого). */
const IMG=require('../../img.js'), fs=require('fs'), Q=require('../quadsynth.js'), GS=require('../gsynth.js'), M=require('../model.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), SEED=+(A.seed||0), COUNT=+(A.count||20), OUT=A.out||'eyes.bin', MAXP=+(A.ppm||3.2);
const NAMES=['A″','B″','C″','S″','A′','B′','C′','S′','O'], R=IMG.rng(SEED*977+29);
const sizes=[[2250,3000],[1800,2400],[1500,2000],[1200,1600],[900,1200]];
/* лист → {img, H (мм листа → px), pts: [[имя, мм]]} */
function make(i){ const lv=R()<0.35?'hard':'normal', sz=sizes[Math.floor(R()*sizes.length)], seed=SEED*1000+i+1, turn=Math.floor(R()*4), n=1+Math.floor(R()*30);
  if(R()<0.55){ const s=Q.sheet({n,seed,level:lv,turn,size:sz}); if(!s) return null; const pts=[];
    s.truth.parts.forEach(p=>Object.entries(p.pts).forEach(([l,m])=>pts.push([l,m]))); return {img:s.img,H:s.truth.H,pts}; }
  const s=GS.sheet({n,err:['ok','given','p3h','rad'][Math.floor(R()*4)],seed,level:lv,plain:R()<0.4,page:R()<0.6?'A4':'A3',noS:R()<0.1}); if(!s) return null;
  const O=s.truth.O, pts=[['O',O]]; M.given('3',s.truth.drawn||s.truth.data).pts.forEach(q=>{ if(!(s.truth.noS&&/^S/.test(q.l))) pts.push([q.l,[O[0]+q.at[0],O[1]+q.at[1]]]); });
  return {img:s.img,H:s.truth.H,pts}; }
const lum=im=>{ const a=new Float32Array(im.width*im.height); for(let i=0;i<a.length;i++) a[i]=0.299*im.data[4*i]+0.587*im.data[4*i+1]+0.114*im.data[4*i+2]; return {w:im.width,h:im.height,a}; };
const chunks=[]; let N=0;
for(let i=0;i<COUNT;i++){ const t0=Date.now(); let s=null; try{ s=make(i); }catch(e){ console.error('лист '+i+': '+e.message); } if(!s) continue;
  /* px/мм фото — по гомографии у середины листа */
  const c=IMG.H.apply(s.H,[100,140]), cu=IMG.H.apply(s.H,[110,140]), ppm=Math.hypot(cu[0]-c[0],cu[1]-c[1])/10, f=Math.max(1,ppm/MAXP);
  let g=lum(s.img); if(f>1.05) g=IMG.blur(g,0.45*f); const w=Math.floor(g.w/f), h=Math.floor(g.h/f), px=Buffer.alloc(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const v=IMG.sample(g,(x+0.5)*f-0.5,(y+0.5)*f-0.5); px[y*w+x]=v==null?255:Math.max(0,Math.min(255,Math.round(v))); }
  const P=s.pts.filter(([l])=>NAMES.includes(l)).map(([l,m])=>{ const q=IMG.H.apply(s.H,m); return [NAMES.indexOf(l),(q[0]+0.5)/f-0.5,(q[1]+0.5)/f-0.5]; }).filter(([,x,y])=>x>=0&&y>=0&&x<w&&y<h);
  const hd=Buffer.alloc(10+9*P.length); hd.writeUInt16LE(w,0); hd.writeUInt16LE(h,2); hd.writeFloatLE(ppm/f,4); hd.writeUInt16LE(P.length,8);
  P.forEach(([k,x,y],j)=>{ hd.writeUInt8(k,10+9*j); hd.writeFloatLE(x,11+9*j); hd.writeFloatLE(y,15+9*j); }); chunks.push(hd,px); N++;
  console.log('лист '+(i+1)+'/'+COUNT+': '+w+'×'+h+', '+(ppm/f).toFixed(2)+' px/мм, точек '+P.length+', '+((Date.now()-t0)/1000).toFixed(1)+' с'); }
const hd=Buffer.alloc(8); hd.write('NCHN',0); hd.writeUInt32LE(N,4); fs.writeFileSync(OUT,Buffer.concat([hd,...chunks])); console.log('записано '+N+' листов → '+OUT);
