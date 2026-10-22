/* Тест листа в клетку: node lab/dz/test-grid.js [--ns=1,...,30] [--per=1] [--level=normal]
   Синтетические фото (lab/dz/gsynth.js): ДЗ №3 на клетчатом листе — заданное с ошибкой нанесения или без,
   построение г) верное или с ошибкой шага. Правда известна для каждой координаты и каждого шага.
   ЛОЖНОЕ: «нанесено неточно» про координату, которая нанесена верно (ошибка < 0,5 мм), или с замером дальше 1 мм от
   правды; «все точки точно» при ошибке ≥ 2,5 мм; шаг г) «неверно» при отклонении < 1,5 или «верно» при ≥ 3;
   угол φ по чертежу дальше max(1,5°, 2σ замера) от правды. «Не нашёл» / «?» ложным не считается. */
const IMG=require('../img.js'), GS=require('./gridsheet.js'), G=require('./gsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), PER=+(A.per||1), LV=A.level||'normal';
const NS=A.ns?A.ns.split(',').map(Number):Array.from({length:30},(_,i)=>i+1);
const T={}, falses=[], errs=[]; const t=k=>T[k]=T[k]||{n:0,ok:0,bad:0,q:0,false:0};
for(const n of NS) for(const err of ['ok','given','p3h','rad']) for(let k=0;k<PER;k++){ const seed=300+k*41+n, s=G.sheet({n,err,seed,level:LV}); if(!s) continue; const tr=s.truth, t0=Date.now();
  const r=GS.checkGridPhoto(s.img,{dz:3,n}), tag='в'+n+' '+err;
  if(!r.ok){ t('не прочитан').n++; console.log(tag,'не прочитан:',r.why.join('; ').slice(0,120)); continue; }
  /* данные */
  const claims=r.given.diff.filter(d=>d.sure), D=tr.drawn, V0=tr.data; let fl=0;
  claims.forEach(d=>{ const i='xyz'.indexOf(d.c), et=D[d.n][i]-V0[d.n][i], em=d.drawn-D[d.n][i]; errs.push(Math.abs(em));
    if(Math.abs(et)<0.5||Math.abs(em)>1){ fl++; falses.push(tag+': «'+d.n+' '+d.c+' = '+d.drawn.toFixed(1)+' вместо '+d.was+'», правда '+D[d.n][i].toFixed(1)); } });
  r.given.diff.forEach(d=>{ if(!d.sure){ const i='xyz'.indexOf(d.c); errs.push(Math.abs(d.drawn-D[d.n][i])); } });
  const wrongBig=tr.wrong&&Math.abs(tr.wrong.d)>=2.5, found=tr.wrong&&claims.some(d=>d.n===tr.wrong.k&&d.c===tr.wrong.c);
  if(wrongBig&&!claims.length&&r.why.some(w=>/все точки условия нанесены точно/.test(w))){ fl++; falses.push(tag+': «все точки точно», а '+tr.wrong.k+' '+tr.wrong.c+' сдвинута на '+tr.wrong.d.toFixed(1)); }
  const td=t('данные '+(err==='given'?'с ошибкой':'верные')); td.n++; td.false+=fl; if(err==='given'){ if(found) td.ok++; else td.q++; } else if(!claims.length) td.ok++; else td.q++;
  /* г) по шагам */
  const ex=r.ex3d, pr=tr.prog;
  if(pr&&ex){ const truth={p3:pr.d3,rot:Math.abs(pr.dR)}; ex.steps.forEach(st=>{ if(!(st.k in truth)) return; const tv=truth[st.k], q=t('г) шаг '+st.k+' ('+err+')'); q.n++; if(st.status==='ok') q.ok++; else if(st.status==='bad') q.bad++; else q.q++;
      if(st.status==='bad'&&tv<1.5||st.status==='ok'&&tv>=3){ q.false++; falses.push(tag+': шаг '+st.k+' «'+st.status+'» ('+st.msg+'), правда '+tv.toFixed(1)); } });
    const ps=ex.steps.find(q=>q.k==='psi'), q=t('г) угол φ по чертежу'); q.n++; if(ps){ const d=Math.abs(ps.val.phi-pr.phi); if(d<=Math.max(1.5,2*(ps.val.spsi||0))) q.ok++; else { q.false++; falses.push(tag+': φ по чертежу '+ps.val.phi.toFixed(1)+', правда '+pr.phi.toFixed(1)); } } else q.q++; }
  console.log(tag.padEnd(12),r.verdict.padEnd(18),'заявлено:',claims.map(d=>d.n+d.c+(d.d>0?'+':'')+d.d.toFixed(1)).join(' ')||'—','| правда:',tr.wrong?tr.wrong.k+tr.wrong.c+(tr.wrong.d>0?'+':'')+tr.wrong.d.toFixed(1):'—',ex&&ex.steps.length?'| г): '+ex.steps.map(q=>q.k+':'+q.status).join(' '):'',(Date.now()-t0)+' мс'); }
console.log('\nИТОГО ('+LV+'):'); let F=0; Object.entries(T).sort().forEach(([k,v])=>{ F+=v.false; console.log('  '+k.padEnd(28)+' n '+v.n+'  верно '+v.ok+(v.bad?'  неверно '+v.bad:'')+'  ?/не найдено '+v.q+'  ЛОЖНЫХ '+v.false); });
errs.sort((a,b)=>a-b); if(errs.length) console.log('замер координат точек условия: медиана '+errs[errs.length>>1].toFixed(2)+' мм, 90 % — '+errs[Math.floor(errs.length*0.9)].toFixed(2)+' мм, худший '+errs[errs.length-1].toFixed(2)+' мм ('+errs.length+' координат)');
console.log('ложных утверждений: '+F); falses.forEach(x=>console.log('  ЛОЖНО: '+x));
