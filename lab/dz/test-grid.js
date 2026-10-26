/* Тест листа в клетку: node lab/dz/test-grid.js [--ns=1,...,30] [--per=1] [--level=normal] [--plain]
   --plain — чистый лист без рамки и клеток (нечётные варианты — А4, чётные — А3): опора — края бумаги и условие.
   Синтетические фото (lab/dz/gsynth.js): ДЗ №3 на клетчатом листе — заданное с ошибкой нанесения или без,
   построение г) верное или с ошибкой шага. Правда известна для каждой координаты и каждого шага.
   ЛОЖНОЕ: «нанесено неточно» про координату, которая нанесена верно (ошибка < 0,5 мм), или с замером дальше 1 мм от
   правды; «все точки точно» или вердикт «данные нанесены верно» при ошибке ≥ 2,5 мм; шаг г) «неверно» при отклонении < 1,5 или «верно» при ≥ 3;
   угол φ по чертежу дальше max(1,5°, 2σ замера) от правды. «Не нашёл» / «?» ложным не считается.
   --eyes — вместо сетки и краёв листа опора — «глаза» (eyes.js): подписанные точки условия от модели со зрением.
     Здесь глаза — правда с ошибками, как у настоящей модели (eyesfake.js): координаты ± 1,5 % кадра, 15 % подписей
     пропущено, в трети снимков две подписи перепутаны, иногда — лишняя «точка» в случайном месте. Номер варианта —
     не даётся (--eyes=n — даётся). --crop — снимок только чертежа: кадр обрезан по фигуре условия и построению (+ 3–12 %),
     краёв листа на нём нет. */
const IMG=require('../img.js'), GS=require('./gridsheet.js'), G=require('./gsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), PER=+(A.per||1), LV=A.level||'normal', PLAIN='plain' in A, EYES='eyes' in A, CROP='crop' in A;
const {rng}=IMG, M=require('./model.js');
/* глаза «как у модели» (eyesfake.js): правда + шум, пропуски, перепутанные и лишние подписи */
const EF=require('./eyesfake.js'), fakeEyes=(s,seed)=>EF.fake(s.img,s.truth.H,s.truth.O,'3',s.truth.drawn,seed);
/* кадр только чертежа: обрезка по фигуре и построению, без краёв листа */
function cropTo(s,E,seed){ const R=rng(seed*13+5), tr=s.truth, Hm=tr.H, P=p=>IMG.H.apply(Hm,[tr.O[0]+p[0],tr.O[1]+p[1]]);
  const g=M.given('3',tr.drawn), all=g.segs.flatMap(q=>[q.a,q.b]).concat([[0,0]]).concat(tr.progSegs?tr.progSegs.flatMap(q=>[q.a,q.b]):[]).map(P);
  let x0=Math.min(...all.map(p=>p[0])), y0=Math.min(...all.map(p=>p[1])), x1=Math.max(...all.map(p=>p[0])), y1=Math.max(...all.map(p=>p[1])); const mx=(x1-x0)*R.r(0.03,0.12), my=(y1-y0)*R.r(0.03,0.12);
  x0=Math.max(0,Math.floor(x0-mx)); y0=Math.max(0,Math.floor(y0-my)); x1=Math.min(s.img.width,Math.ceil(x1+mx)); y1=Math.min(s.img.height,Math.ceil(y1+my));
  const w=x1-x0, h=y1-y0, out=IMG.rgba(w,h), d=s.img.data; for(let y=0;y<h;y++) out.data.set(d.subarray(((y+y0)*s.img.width+x0)*4,((y+y0)*s.img.width+x1)*4),y*w*4);
  E.drawings.forEach(dr=>Object.keys(dr.pts).forEach(k=>{ dr.pts[k]=[dr.pts[k][0]-x0,dr.pts[k][1]-y0]; })); return out; }
const NS=A.ns?A.ns.split(',').map(Number):Array.from({length:30},(_,i)=>i+1);
const T={}, falses=[], errs=[]; const t=k=>T[k]=T[k]||{n:0,ok:0,bad:0,q:0,false:0};
for(const n of NS) for(const err of ['ok','given','p3h','rad']) for(let k=0;k<PER;k++){ const seed=300+k*41+n, s=G.sheet({n,err,seed,level:LV,plain:PLAIN,page:n%2?'A4':'A3'}); if(!s) continue; const tr=s.truth, t0=Date.now();
  let img=s.img, E=null; if(EYES){ E=fakeEyes(s,seed); if(CROP) img=cropTo(s,E,seed); }
  const r=EYES?GS.checkGridPhoto(img,{dz:3,n:A.eyes==='n'?n:0,eyes:E.drawings[0]}):GS.checkGridPhoto(s.img,{dz:3,n}), tag='в'+n+' '+err;
  if(EYES&&r.ok&&r.n!==n){ falses.push(tag+': вариант узнан как '+r.n); t('вариант').false++; continue; }
  if(!r.ok){ t('не прочитан').n++; console.log(tag,'не прочитан:',r.why.join('; ').slice(0,120)); continue; }
  /* данные */
  const claims=r.given.diff.filter(d=>d.sure), D=tr.drawn, V0=tr.data; let fl=0;
  claims.forEach(d=>{ const i='xyz'.indexOf(d.c), et=D[d.n][i]-V0[d.n][i], em=d.drawn-D[d.n][i]; errs.push(Math.abs(em));
    if(Math.abs(et)<0.5||Math.abs(em)>1){ fl++; falses.push(tag+': «'+d.n+' '+d.c+' = '+d.drawn.toFixed(1)+' вместо '+d.was+'», правда '+D[d.n][i].toFixed(1)); } });
  r.given.diff.forEach(d=>{ if(!d.sure){ const i='xyz'.indexOf(d.c); errs.push(Math.abs(d.drawn-D[d.n][i])); } });
  const wrongBig=tr.wrong&&Math.abs(tr.wrong.d)>=2.5, found=tr.wrong&&claims.some(d=>d.n===tr.wrong.k&&d.c===tr.wrong.c);
  if(wrongBig&&!claims.length&&r.why.some(w=>/все точки условия нанесены точно/.test(w))){ fl++; falses.push(tag+': «все точки точно», а '+tr.wrong.k+' '+tr.wrong.c+' сдвинута на '+tr.wrong.d.toFixed(1)); }
  if(wrongBig&&r.verdict==='данные нанесены верно'){ fl++; falses.push(tag+': вердикт «данные нанесены верно», а '+tr.wrong.k+' '+tr.wrong.c+' сдвинута на '+tr.wrong.d.toFixed(1)); }
  const td=t('данные '+(err==='given'?'с ошибкой':'верные')); td.n++; td.false+=fl; if(err==='given'){ if(found) td.ok++; else td.q++; } else if(!claims.length) td.ok++; else td.q++;
  /* г) по шагам */
  const ex=r.ex3d, pr=tr.prog;
  if(pr&&ex){ const truth={p3:pr.d3,rot:Math.abs(pr.dR)}; ex.steps.forEach(st=>{ if(!(st.k in truth)) return; const tv=truth[st.k], q=t('г) шаг '+st.k+' ('+err+')'); q.n++; if(st.status==='ok') q.ok++; else if(st.status==='bad') q.bad++; else q.q++;
      if(st.status==='bad'&&tv<1.5||st.status==='ok'&&tv>=3){ q.false++; falses.push(tag+': шаг '+st.k+' «'+st.status+'» ('+st.msg+'), правда '+tv.toFixed(1)); } });
    const ps=ex.steps.find(q=>q.k==='psi'), q=t('г) угол φ по чертежу'); q.n++; if(ps){ const d=Math.abs(ps.val.phi-pr.phi); if(d<=Math.max(1.5,2*(ps.val.spsi||0))) q.ok++; else { q.false++; falses.push(tag+': φ по чертежу '+ps.val.phi.toFixed(1)+', правда '+pr.phi.toFixed(1)); } } else q.q++; }
  console.log(tag.padEnd(12),r.verdict.padEnd(18),'заявлено:',claims.map(d=>d.n+d.c+(d.d>0?'+':'')+d.d.toFixed(1)).join(' ')||'—','| правда:',tr.wrong?tr.wrong.k+tr.wrong.c+(tr.wrong.d>0?'+':'')+tr.wrong.d.toFixed(1):'—',ex&&ex.steps.length?'| г): '+ex.steps.map(q=>q.k+':'+q.status).join(' '):'',(Date.now()-t0)+' мс'); }
console.log('\nИТОГО ('+LV+(PLAIN?', чистый лист':'')+(EYES?', глаза'+(CROP?', кадр — только чертёж':''):'')+'):'); let F=0; Object.entries(T).sort().forEach(([k,v])=>{ F+=v.false; console.log('  '+k.padEnd(28)+' n '+v.n+'  верно '+v.ok+(v.bad?'  неверно '+v.bad:'')+'  ?/не найдено '+v.q+'  ЛОЖНЫХ '+v.false); });
errs.sort((a,b)=>a-b); if(errs.length) console.log('замер координат точек условия: медиана '+errs[errs.length>>1].toFixed(2)+' мм, 90 % — '+errs[Math.floor(errs.length*0.9)].toFixed(2)+' мм, худший '+errs[errs.length-1].toFixed(2)+' мм ('+errs.length+' координат)');
console.log('ложных утверждений: '+F); falses.forEach(x=>console.log('  ЛОЖНО: '+x));
