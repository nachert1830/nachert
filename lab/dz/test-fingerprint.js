/* Тест отпечатка построения: node lab/dz/test-fingerprint.js [--ns=1,...,30]
   «Одна работа» — тот же синтетический лист, снятый дважды (другой наклон, свет, блик).
   «Независимые» — тот же вариант и то же задание, другой студент (другая высота горизонтали h₁, своя рука, своё
   место на листе). Ложное: независимые → «похоже на одну работу». Одна работа → «совпадения не найдено» — промах. */
const GS=require('./gridsheet.js'), G=require('./gsynth.js'), FP=require('./fingerprint.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), NS=A.ns?A.ns.split(',').map(Number):Array.from({length:30},(_,i)=>i+1);
const same=[], indep=[]; let F=0; const rows=[];
for(const n of NS){ const a=G.sheet({n,err:'rad',seed:300+n,shots:2,glare:0.5}), b=G.sheet({n,err:'rad',seed:700+n}); if(!a||!b) continue;
  const ra=a.imgs.map(im=>GS.checkGridPhoto(im,{dz:3,n})), rb=GS.checkGridPhoto(b.img,{dz:3,n});
  const pa=ra.map(r=>FP.print(r,'3')), pb=FP.print(rb,'3');
  const s=FP.compare(pa[0],pa[1]), d=FP.compare(pa[0],pb);
  if(s.score!=null&&s.n>=60){ same.push(s.score); if(/не найдено/.test(s.verdict)) rows.push('промах: в'+n+' одна работа → «'+s.verdict+'»'); }
  if(d.score!=null&&d.n>=60){ indep.push(d.score); if(/одну работу/.test(d.verdict)){ F++; rows.push('ЛОЖНО: в'+n+' независимые → «'+d.verdict+'»'); } }
  console.log('в'+n,'одна работа:',s.score==null?'—':s.score.toFixed(2)+' (графит '+s.ink.toFixed(2)+', концы '+s.ends.toFixed(2)+', n '+s.n+')','| независимые:',d.score==null?'—':d.score.toFixed(2)+' (графит '+d.ink.toFixed(2)+', концы '+d.ends.toFixed(2)+', n '+d.n+')'); }
const st=a=>a.length?'мин '+Math.min(...a).toFixed(2)+', медиана '+a.slice().sort((x,y)=>x-y)[a.length>>1].toFixed(2)+', макс '+Math.max(...a).toFixed(2)+' ('+a.length+')':'—';
console.log('\nодна работа (два снимка):  '+st(same)); console.log('независимые (тот же вариант): '+st(indep)); console.log('одна работа узнана: '+same.filter(x=>x>=0.6).length+' из '+same.length+'; ложных (независимые → «одна работа»): '+F); rows.forEach(r=>console.log('  '+r));
