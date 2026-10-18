/* Тест проверки ДЗ №3 по фото: node lab/dz/test-check3.js [--per=1] [--level=normal] [--ns=1,5,9,...]
   Синтетические листы настоящих вариантов (lab/dz/vsynth3.js): заданная пирамида и четыре построения на одном листе,
   верные и с ошибками (ось не ⟂ / не ∥, не то расстояние на π₄, не тот радиус, видимость, условие, чужой вариант).
   Ложный вердикт — уверенный вердикт не тот или с неверной причиной. Отказ («не могу …») ложным не считается. */
const CK=require('./check.js'), VS=require('./vsynth3.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), PER=+(A.per||1), LV=A.level||'normal';
const NS=A.ns?A.ns.split(',').map(Number):Array.from({length:30},(_,i)=>i+1);
const SURE=new Set(['верно','ошибка','не тот вариант']), tally={}, falseV=[];
for(const n of NS) for(const err of ['ok'].concat(VS.ERRS)) for(let k=0;k<PER;k++){ const seed=200+k*37+n;
  const s=VS.sheet({n,err,seed,level:LV,turn:(n+k)%4}); if(!s) continue; const t=s.truth, t0=Date.now();
  const R=CK.checkSheet(s.img,{dz:3,n}), verdict=R.verdict, W=R.why.join(' '), P=t.parts;
  const diag={a_dir:/а\) высота: ось x.. не перпендикулярна/,a_d:P.a&&P.a.wrong?new RegExp('а\\) высота: для '+P.a.wrong+'₄'):null,b_dir:/x₄₅ не перпендикулярна/,c_R:P.c&&P.c.wrong?new RegExp('радиус вращения точки '+P.c.wrong):/радиус/,d_R:/радиус вращения S/,
    vis:t.flipped?new RegExp('ребро '+t.flipped+' заданной'):null,given:t.wrongPt?new RegExp('точк[аи] '+t.wrongPt.split(' ')[0]):null}[err];
  const diagOk=verdict!=='ошибка'||!diag||diag.test(W), ok=verdict===t.expect&&diagOk, isFalse=SURE.has(verdict)&&!ok;
  const key=err; tally[key]=tally[key]||{n:0,ok:0,refuse:0,false:0}; tally[key].n++; if(ok) tally[key].ok++; else if(isFalse) tally[key].false++; else tally[key].refuse++;
  if(isFalse) falseV.push('в'+n+' '+err+': ждали «'+t.expect+'»'+(t.wrongPt?' ('+t.wrongPt+')':'')+(t.flipped?' ('+t.flipped+')':'')+(P.a&&P.a.wrong?' (a: '+P.a.wrong+')':'')+(P.c&&P.c.wrong?' (c: '+P.c.wrong+')':'')+', вышло «'+verdict+'»'+(verdict===t.expect?' с неверной причиной':'')+' — '+W);
  console.log('в'+n,err.padEnd(7),'ждём',t.expect.padEnd(14),'→',verdict.padEnd(18),(Date.now()-t0)+' мс',W.slice(0,150)); }
console.log('\nИТОГО ('+LV+'):'); let N=0, OK=0, F=0;
Object.entries(tally).forEach(([k,v])=>{ N+=v.n; OK+=v.ok; F+=v.false; console.log('  '+k.padEnd(8)+' листов '+v.n+', верный вердикт '+v.ok+', отказ '+v.refuse+', ЛОЖНЫЙ '+v.false); });
console.log('листов '+N+', верный вердикт '+OK+' ('+Math.round(100*OK/N)+' %), ложных вердиктов '+F);
falseV.forEach(x=>console.log('  ЛОЖНЫЙ: '+x));
