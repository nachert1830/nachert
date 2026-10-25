/* Тест этапа линий на синтетике: node lab/test-lines.js [--level=normal] [--n=8]
   Найдена ли каждая нарисованная студентом линия (≤ 0,6 мм поперёк, перекрытие ≥ 60 % длины), лишние
   линии (не нарисованные: подписи, стёртое, шум), тип основная/тонкая. */
const {synth}=require('./synth.js'), {rectifyFull}=require('./scan.js'), Ln=require('./lines.js'), {v2,L2}=require('../core/model.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), LV=A.level||'normal', N=+(A.n||8);
const match=(s,t)=>{ const L=L2.through(t.a,t.b), len=v2.dist(t.a,t.b); if(len<1e-6) return 0; if(L2.dist(s.a,L)>0.6||L2.dist(s.b,L)>0.6) return 0;
  const u=[L2.t(s.a,L),L2.t(s.b,L)].sort((x,y)=>x-y), ov=Math.max(0,Math.min(u[1],len)-Math.max(u[0],0)); return ov/len; };
let tot={truth:0,found:0,det:0,extra:0,kOk:0,kN:0,ms:0}; const extras=[];
for(let i=0;i<N;i++){ const s=synth({seed:500+i,level:LV,kid:['front','horiz','foot1','h-par'][i%4],nvid:'ok:1A+'}), r=rectifyFull(s.img,47);
  if(!r.ok){ console.log(i,'выпрямление: отказ',r.reason); continue; }
  const t0=Date.now(), ln=Ln.extract(s.img,r,{n:47}); tot.ms+=Date.now()-t0; if(!ln.ok){ console.log(i,'линии: отказ',ln.reason); continue; }
  const T=s.truth.scene.items.filter(x=>x.t==='seg'&&x.src==='hand'&&v2.dist(x.a,x.b)>3.5);
  let found=0; const miss=[]; T.forEach(t=>{ const best=Math.max(0,...ln.segs.map(d=>match(d,t))); const tot2=ln.segs.filter(d=>match(d,t)>0).reduce((s2,d)=>s2+match(d,t),0);
    if(Math.min(1,tot2)>=0.6){ found++; const d=ln.segs.find(d=>match(d,t)===best); if(t.k==='main'||t.k==='thin'){ tot.kN++; if((d.k==='main')===(t.k==='main')) tot.kOk++; } } else miss.push(t.role+'('+t.k+','+v2.dist(t.a,t.b).toFixed(0)+'мм)'); });
  const ex=ln.segs.filter(d=>!T.some(t=>match(d,t)>0||(L2.dist(d.a,L2.through(t.a,t.b))<0.8&&L2.dist(d.b,L2.through(t.a,t.b))<0.8)));
  tot.truth+=T.length; tot.found+=found; tot.det+=ln.segs.length; tot.extra+=ex.length; ex.forEach(e=>extras.push(i+': '+e.len.toFixed(1)+'мм dark '+e.dark.toFixed(2)+' w '+e.weight.toFixed(3)+' at '+e.a.map(v=>v.toFixed(0))));
  console.log(i,s.truth.kid,'нарисовано',T.length,'найдено',found,'лишних',ex.length,miss.length?'пропущены: '+miss.join(', '):'',(Date.now()-t0)+' мс'); }
console.log('ИТОГО: найдено '+tot.found+' из '+tot.truth+' ('+Math.round(100*tot.found/tot.truth)+' %), лишних '+tot.extra+' из '+tot.det+', тип верен '+tot.kOk+' из '+tot.kN+', '+Math.round(tot.ms/N)+' мс на лист');
if(A.v) extras.forEach(e=>console.log('  лишняя '+e));
