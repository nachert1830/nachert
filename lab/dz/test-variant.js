/* Тест узнавания варианта по чертежу (лист в клетку): node lab/dz/test-variant.js [--ns=1,...,30] [--level=normal]
   Номер варианта сканеру не сообщается (n = 0). Ложное — узнан не тот вариант. Отказ («не узнаётся однозначно —
   укажите номер») ложным не считается. Листы — синтетика gsynth.js: без ошибки и с ошибкой нанесения точки. */
const GS=require('./gridsheet.js'), G=require('./gsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), LV=A.level||'normal', NS=A.ns?A.ns.split(',').map(Number):Array.from({length:30},(_,i)=>i+1);
let N=0, ok=0, ref=0, F=0; const bad=[], ms=[];
for(const n of NS) for(const err of ['ok','given']){ const s=G.sheet({n,err,seed:500+n,level:LV}); if(!s) continue; const t0=Date.now(), r=GS.checkGridPhoto(s.img,{dz:3,n:0}); ms.push(Date.now()-t0); N++;
  if(r.ok&&r.n===n) ok++; else if(r.ok){ F++; bad.push('в'+n+' '+err+': узнан '+r.n); } else ref++;
  console.log(('в'+n+' '+err).padEnd(10),r.ok?'узнан '+r.n+(r.n===n?'':' — ЛОЖНО'):'отказ: '+r.why[0],(Date.now()-t0)+' мс'); }
console.log('\nлистов '+N+': узнан верно '+ok+', отказ '+ref+', ЛОЖНО '+F+'; время — медиана '+(ms.sort((a,b)=>a-b)[ms.length>>1]/1000).toFixed(1)+' с'); bad.forEach(b=>console.log('  ЛОЖНО: '+b));
