/* Тест проверки ДЗ №2 по фото: node lab/dz/test-check2.js [--per=1] [--level=normal] [--ns=1,8,11,...] (по умолчанию — все 30 вариантов)
   Синтетические листы настоящих вариантов (lab/dz/vsynth.js): верные и с ошибками каждого вида. Для каждого листа —
   вердикт сканера против ожидаемого. Главная цифра — ЛОЖНЫЕ ВЕРДИКТЫ: «верно» на неверном листе или «ошибка» на
   верном (и любая уверенная ошибка не того рода). Отказ («не могу прочитать / утверждать») ложным не считается. */
const CK=require('./check.js'), V=require('../../core/dz-variants.js'), VS=require('./vsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), PER=+(A.per||1), LV=A.level||'normal';
const NS=A.ns?A.ns.split(',').map(Number):Array.from({length:30},(_,i)=>i+1);
const SURE=new Set(['верно','ошибка','другое решение','не тот вариант']);
const tally={}, falseV=[], rows=[];
for(const n of NS) for(const err of ['ok'].concat(VS.ERRS[V.get(2,n).id],VS.COMMON)) for(let k=0;k<PER;k++){ const seed=100+k*31+n;
  const s=VS.sheet({dz:2,n,err,seed,level:LV,turn:(n+k)%4}); if(!s) continue; const t=s.truth, t0=Date.now();
  const R=CK.checkSheet(s.img,{dz:2,n}), verdict=R.verdict, why=R.why;
  /* верный вердикт с неверной причиной — тоже ложный: проверяем, что причина названа та */
  const W=why.join(' '), diag={h:/высота/,apex:/равнобедрен/,D:/\|AD\|/,link:/линии связи/,vis:null,given:t.wrongPt?new RegExp('точки '+t.wrongPt.split(' ')[0]+' координата '+t.wrongPt.split(' ')[1]):/точк/}[err];
  const diagOk=verdict!=='ошибка'||(err==='vis'?W.includes('ребро '+t.flipped):!diag||diag.test(W));
  const exp=t.expect, ok=verdict===exp&&diagOk, sure=SURE.has(verdict);
  /* ложный: уверенный вердикт, не совпавший с ожидаемым */
  const isFalse=sure&&!ok;
  const key=t.id+' '+err; tally[key]=tally[key]||{n:0,ok:0,refuse:0,false:0}; tally[key].n++; if(ok) tally[key].ok++; else if(isFalse) tally[key].false++; else tally[key].refuse++;
  if(isFalse) falseV.push('в'+n+' '+err+': ждали «'+exp+'»'+(t.wrongPt?' ('+t.wrongPt+')':'')+(t.flipped?' ('+t.flipped+')':'')+', вышло «'+verdict+'»'+(verdict===exp?' с неверной причиной':'')+' — '+why.join('; '));
  console.log('в'+n,t.id,err.padEnd(7),'ждём',exp.padEnd(15),'→',verdict.padEnd(18),(Date.now()-t0)+' мс',why.join('; ').slice(0,140)); }
console.log('\nИТОГО ('+LV+'):'); let N=0, OK=0, F=0;
Object.entries(tally).forEach(([k,v])=>{ N+=v.n; OK+=v.ok; F+=v.false; console.log('  '+k.padEnd(12)+' листов '+v.n+', верный вердикт '+v.ok+', отказ '+v.refuse+', ЛОЖНЫЙ '+v.false); });
console.log('листов '+N+', верный вердикт '+OK+' ('+Math.round(100*OK/N)+' %), ложных вердиктов '+F);
falseV.forEach(x=>console.log('  ЛОЖНЫЙ: '+x));
