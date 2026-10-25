/* Тест серии кадров: node lab/dz/test-series.js [--ns=1,...,30] [--shots=3] [--level=normal] [--glare=0.5]
   Один синтетический лист в клетку (gsynth.js) снят shots раз: другой наклон, свет, блик. Сравниваются
   «один кадр» (каждый кадр серии — отдельно) и «серия» (series.js: голосование кадров, σ по разбросу).
   Ложное — как в test-grid.js: «нанесено неточно» про верную координату (< 0,5 мм) или с замером дальше 1 мм от
   правды; «все точки точно» или вердикт «данные нанесены верно» при ошибке ≥ 2,5 мм; шаг г) «неверно» при отклонении < 1,5 / «верно» при ≥ 3;
   φ по чертежу дальше max(1,5°, 2σ) от правды. Ещё — «последовательно»: кадры добавляются, пока series.enough. */
const GS=require('./gridsheet.js'), G=require('./gsynth.js'), SR=require('./series.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), LV=A.level||'normal', K=+(A.shots||3), GL=A.glare!=null?+A.glare:0.5;
const NS=A.ns?A.ns.split(',').map(Number):Array.from({length:30},(_,i)=>i+1);
const T={}, falses=[], t=(m,k)=>{ T[m]=T[m]||{}; return T[m][k]=T[m][k]||{n:0,ok:0,bad:0,q:0,false:0}; }, used=[];
/* одна оценка: diff — заявления о данных, steps — шаги г), why — тексты */
function judge(mode,tag,o,tr){ const claims=o.diff.filter(d=>d.sure), D=tr.drawn, V0=tr.data; let fl=0;
  claims.forEach(d=>{ const i='xyz'.indexOf(d.c), et=D[d.n][i]-V0[d.n][i], em=d.drawn-D[d.n][i]; if(Math.abs(et)<0.5||Math.abs(em)>1){ fl++; falses.push(mode+' '+tag+': «'+d.n+' '+d.c+' = '+d.drawn.toFixed(1)+' вместо '+d.was+'», правда '+D[d.n][i].toFixed(1)); } });
  const wrongBig=tr.wrong&&Math.abs(tr.wrong.d)>=2.5, found=tr.wrong&&claims.some(d=>d.n===tr.wrong.k&&d.c===tr.wrong.c);
  if(wrongBig&&!claims.length&&o.why.some(w=>/все точки условия нанесены точно/.test(w))){ fl++; falses.push(mode+' '+tag+': «все точки точно», а '+tr.wrong.k+' '+tr.wrong.c+' сдвинута на '+tr.wrong.d.toFixed(1)); }
  if(wrongBig&&o.verdict==='данные нанесены верно'){ fl++; falses.push(mode+' '+tag+': вердикт «данные нанесены верно», а '+tr.wrong.k+' '+tr.wrong.c+' сдвинута на '+tr.wrong.d.toFixed(1)); }
  const td=t(mode,'данные '+(tr.err==='given'?'с ошибкой':'верные')); td.n++; td.false+=fl; if(tr.err==='given'){ if(found) td.ok++; else td.q++; } else if(!claims.length) td.ok++; else td.q++;
  const pr=tr.prog; if(pr&&o.steps){ const truth={p3:pr.d3,rot:Math.abs(pr.dR)};
    o.steps.forEach(st=>{ if(!(st.k in truth)) return; const tv=truth[st.k], q=t(mode,'г) шаг '+st.k+' ('+tr.err+')'); q.n++; if(st.status==='ok') q.ok++; else if(st.status==='bad') q.bad++; else q.q++;
      if(st.status==='bad'&&tv<1.5||st.status==='ok'&&tv>=3){ q.false++; falses.push(mode+' '+tag+': шаг '+st.k+' «'+st.status+'», правда '+tv.toFixed(1)); } });
    const ps=o.steps.find(q=>q.k==='psi'), q=t(mode,'г) угол φ по чертежу'); q.n++;
    if(ps&&ps.status==='ok'&&ps.val){ const d=Math.abs(ps.val.phi-pr.phi); if(d<=Math.max(1.5,2*(ps.val.spsi||0))) q.ok++; else { q.false++; falses.push(mode+' '+tag+': φ по чертежу '+ps.val.phi.toFixed(1)+', правда '+pr.phi.toFixed(1)); } } else q.q++; } }
const asOne=r=>({verdict:r.verdict,diff:r.given.diff,why:r.why,steps:r.ex3d&&r.ex3d.steps&&r.ex3d.steps.length?r.ex3d.steps:null});
for(const n of NS) for(const err of ['ok','given','p3h','rad']){ const s=G.sheet({n,err,seed:300+n,level:LV,shots:K,glare:GL}); if(!s) continue; const tr=s.truth, tag='в'+n+' '+err, t0=Date.now();
  const rs=s.imgs.map(im=>GS.checkGridPhoto(im,{dz:3,n}));
  rs.forEach((r,i)=>{ if(!r.ok){ t('один кадр','не прочитан').n++; return; } judge('один кадр',tag+' к'+(i+1),asOne(r),tr); });
  const S=SR.combine(rs);
  if(!S.ok||S.frames.read<2) t('серия','не прочитана (< 2 кадров)').n++; else judge('серия',tag,{verdict:S.verdict,diff:S.given.diff,why:S.why,steps:S.steps},tr);
  /* последовательно: кадры по одному, пока вывод не устоялся */
  let m=1, Q=null; for(;m<=rs.length;m++){ Q=SR.combine(rs.slice(0,m)); if(m>=2&&SR.enough(Q,rs.length)) break; } m=Math.min(m,rs.length); used.push(m);
  if(!Q.ok||Q.frames.read<2) t('последовательно','не прочитана (< 2 кадров)').n++; else judge('последовательно',tag,{verdict:Q.verdict,diff:Q.given.diff,why:Q.why,steps:Q.steps},tr);
  console.log(tag.padEnd(12),'кадры:',rs.map(r=>r.ok?r.verdict:'—').join(' | ').padEnd(70),'→ серия:',S.verdict,S.conflicts.length?'(расходятся: '+S.conflicts.length+')':'','| кадров по порядку:',m,(Date.now()-t0)+' мс'); }
console.log('\nИТОГО ('+LV+', кадров в серии '+K+', блик '+GL+'):'); const F={};
Object.entries(T).forEach(([m,cat])=>{ console.log(' '+m+':'); F[m]=0; Object.entries(cat).sort().forEach(([k,v])=>{ F[m]+=v.false; console.log('   '+k.padEnd(28)+' n '+v.n+'  верно '+v.ok+(v.bad?'  неверно '+v.bad:'')+'  ?/не найдено '+v.q+'  ЛОЖНЫХ '+v.false); }); });
if(used.length) console.log('кадров нужно по порядку: '+[2,3,4,5].map(m=>m+' — '+used.filter(x=>x===m).length).join(', '));
console.log('ложных утверждений: '+Object.entries(F).map(([m,f])=>m+' '+f).join(', ')); falses.forEach(x=>console.log('  ЛОЖНО: '+x));
