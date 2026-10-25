/* Показ без настоящих фото: node lab/dz/demo2.js [--n=8] [--out=lab/dz/demo]
   Для варианта n ДЗ №2а — синтетические фото листов (lab/dz/vsynth.progSheet): верное построение и по одной ошибке
   на каждом шаге (n_dir, len, proj, beta, pick). Каждое «фото» проходит весь путь сканера (лист → линии → калибровка
   → ответ → разбор по шагам), результат — картинка разбора <out>/в<n>-<ошибка>.svg и сводка <out>/в<n>.md.
   Фото синтетические — их можно показывать; фото студентов сюда не попадают. */
const fs=require('fs'), path=require('path'), CK=require('./check.js'), C=require('./calib.js'), RP=require('./report2.js'), VS=require('./vsynth.js'), V=require('../../core/dz-variants.js'), IMG=require('../img.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), n=+(A.n||8), out=A.out||path.join(__dirname,'demo');
const WHAT={ok:'всё построено верно',n_dir:'n″ повёрнута на 6° (не ⟂ f″)',len:'на n отложено 70 мм вместо 80',proj:'80 мм отложено на проекции n′, а не на натуральной величине',beta:'прямая β ∥ AB в π₂ повёрнута на 5°',pick:'S поставлена в 6 мм от точки, где след пересекает EF'};
fs.mkdirSync(out,{recursive:true}); const md=['# ДЗ №2а, вариант '+n+': что видит сканер (синтетические фото)','','Команда: `node lab/dz/demo2.js --n='+n+'`. Ошибка на листе → вердикт сканера → первый неверный шаг.','','| что сделал «студент» | вердикт | разбор по шагам | первая ошибка | картинка |','|---|---|---|---|---|'];
for(const err of VS.PROG_ERRS){ let s=null, R=null, seed=0, ms=0;
  /* «фото» — до трёх снимков: если сканер не нашёл лист (тень, блик), как и студент, переснимаем; номер снимка — в сводке */
  for(let k=0;k<3;k++){ seed=500+n+k*101; s=VS.progSheet({n,err,seed,turn:k%4}); if(!s) break; const t0=Date.now(); R=CK.checkSheet(s.img,{dz:2,n}); ms=Date.now()-t0; if(R.stage!=='лист'&&R.stage!=='линии') break; }
  if(!s){ md.push('| '+WHAT[err]+' | лист не помещается в А3 | | | |'); continue; }
  if(A.png) fs.writeFileSync(path.join(out,'в'+n+'-'+err+'.png'),IMG.encodePNG(s.img));
  let ex=R.ex; if(!ex&&R.ans&&R.ans.cur) ex=require('./explain2.js').explain2(C.drawSegs(R.dig,R.cal),s.truth.data,R.ans.cur);
  const f='в'+n+'-'+err+'.svg'; if(R.cal&&R.cal.ok) fs.writeFileSync(path.join(out,f),RP.svg({data:s.truth.data,segs:C.drawSegs(R.dig,R.cal),cur:R.ans&&R.ans.cur,ex,verdict:R.verdict,why:R.why}));
  const steps=ex?ex.steps.map((x,i)=>(x.status==='ok'?'✓':x.status==='bad'?'✗':'?')+(i+1)).join(' '):'—';
  const q=x=>String(x).replace(/\|/g,'\\|');   /* |PR| в ячейке таблицы Markdown */
  md.push('| '+WHAT[err]+' (снимок '+seed+') | '+q(R.verdict+(R.why.length?': '+R.why.join('; '):''))+' | '+steps+' | '+q(ex&&ex.first?ex.first.msg:'—')+' | ['+f+']('+f+') |');
  console.log(err.padEnd(6),'снимок '+seed,R.verdict.padEnd(12),steps.padEnd(12),ex&&ex.first?ex.first.k:'-',ms+' мс'); }
fs.writeFileSync(path.join(out,'в'+n+'.md'),md.join('\n')+'\n'); console.log('→ '+out);
