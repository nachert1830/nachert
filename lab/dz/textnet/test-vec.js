/* Точность векторизатора на синтетике (правда известна): найденные отрезки против отрезков построения в мм.
   node lab/dz/textnet/test-vec.js [--n=4] [--size=1500,2000] [--level=normal]
   «найдено» — доля длины отрезков правды (≥ 8 мм), лежащая ≤ tol мм от какого-либо найденного отрезка; «лишних» — доля длины найденных,
   у которых в 1 мм нет правды (в правду входят и тонкие линии связи, оси; текст отрезками не бывает). */
const IMG=require('../../img.js'), Q=require('../quadsynth.js'), V=require('./vec.js');
const TOL0=0;const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), N=+(A.n||4), SZ=(A.size||'1500,2000').split(',').map(Number), LV=A.level||'normal', TOL=+(A.tol||0.8);
const dseg=(p,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], L2=dx*dx+dy*dy, t=L2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2)):0; return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); };
let TL=0,TF=0,DL=0,DX=0,ds=[]; for(let i=0;i<N;i++){ const s=Q.sheet({n:1+(i*7)%30,seed:100+i,level:LV,turn:0,size:SZ}); if(!s){ console.log('лист '+i+': нет'); continue; }
  const c=IMG.H.apply(s.truth.H,[100,140]), cu=IMG.H.apply(s.truth.H,[110,140]), ppm=Math.hypot(cu[0]-c[0],cu[1]-c[1])/10, im=s.img, t0=Date.now(), r=V.vectorize(im,{thr:+(A.thr||0.07),lmin:+(A.lmin||36),gap:+(A.gap||9)});
  const truth=[]; s.truth.parts.forEach(p=>p.items.forEach(it=>{ if(it.t==='seg'||it.t==='conn'){ const a=IMG.H.apply(s.truth.H,[p.O[0]+it.a[0],p.O[1]+it.a[1]]), b=IMG.H.apply(s.truth.H,[p.O[0]+it.b[0],p.O[1]+it.b[1]]); truth.push([a,b]); } }));
  let tl=0,tf=0; truth.forEach(([a,b])=>{ const L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<8*ppm) return; const K=Math.round(L/2); for(let k=0;k<=K;k++){ const p=[a[0]+(b[0]-a[0])*k/K,a[1]+(b[1]-a[1])*k/K]; const d=Math.min(...r.segs.map(g=>dseg(p,g.a,g.b))); tl+=L/(K+1); if(d<=TOL*ppm){ tf+=L/(K+1); ds.push(d/ppm); } } });
  /* только внутри чертежей: рамка листа, штамп и стол — настоящие линии, но не построение */
  const bb=truth.reduce((q,[a,b])=>[Math.min(q[0],a[0],b[0]),Math.min(q[1],a[1],b[1]),Math.max(q[2],a[0],b[0]),Math.max(q[3],a[1],b[1])],[1e9,1e9,-1e9,-1e9]), pad=12*ppm;
  const inDr=g=>{ const m=[(g.a[0]+g.b[0])/2,(g.a[1]+g.b[1])/2]; return truth.some(([a,b])=>dseg(m,a,b)<25*ppm); };
  let dl=0,dx=0; r.segs.filter(inDr).forEach(g=>{ const L=g.L, K=Math.round(L/2); for(let k=0;k<=K;k++){ const p=[g.a[0]+(g.b[0]-g.a[0])*k/K,g.a[1]+(g.b[1]-g.a[1])*k/K]; const d=Math.min(...truth.map(([a,b])=>dseg(p,a,b))); dl+=L/(K+1); if(d>1.0*ppm) dx+=L/(K+1); } });
  TL+=tl; TF+=tf; DL+=dl; DX+=dx; console.log('лист '+(i+1)+': '+ppm.toFixed(1)+' px/мм, отрезков '+r.segs.length+' (правда '+truth.length+'), найдено '+(100*tf/tl).toFixed(0)+' %, лишних '+(100*dx/dl).toFixed(0)+' %, '+((Date.now()-t0)/1000).toFixed(1)+' с'); }
ds.sort((a,b)=>a-b); console.log('ИТОГО: найдено '+(100*TF/TL).toFixed(1)+' % длины правды (≤ '+TOL+' мм; рука в синтетике дрожит ≈ 0,45 мм), лишних '+(100*DX/DL).toFixed(1)+' % длины найденного; отклонение найденных, медиана '+(ds[Math.floor(ds.length/2)]||0).toFixed(2)+' мм, 90 % — '+(ds[Math.floor(ds.length*0.9)]||0).toFixed(2)+' мм');
