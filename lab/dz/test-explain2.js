/* Тест разбора по шагам ДЗ №2а: node lab/dz/test-explain2.js [--per=1] [--ns=1,...,10] [--level=normal]
   Синтетические листы с построением (vsynth.progSheet: prog2a.js) — верные и с ошибкой на одном шаге: n_dir (n″ не ⟂ f″
   на 6°), len (|PR| = 70), proj (80 мм на проекции n′), beta (прямая β ∥ AB в π₂ повёрнута на 5°), pick (S в 6 мм от следа).
   Для каждого шага известна правда — отклонение, которое студент сделал на этом шаге относительно СВОЕГО предыдущего.
   ЛОЖНОЕ утверждение: шаг назван «неверно», а отклонение < 1,5 (мм или °), или «верно» при отклонении ≥ 3; неверно
   названный первый ошибочный шаг. «?» ложным не считается. Плюс листы vsynth.sheet с разбором сайта (верное построение,
   испорченный ответ): шаги 1–3 там верны — «неверно» на них ложное. */
const CK=require('./check.js'), C=require('./calib.js'), X=require('./explain2.js'), VS=require('./vsynth.js'), V=require('../../core/dz-variants.js'), DZ=require('../../core/dz.js'), {v3}=DZ;
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), PER=+(A.per||1), LV=A.level||'normal';
const NS=A.ns?A.ns.split(',').map(Number):[1,2,3,4,5,6,7,8,9,10];
const Fp=P=>[-P[0],-P[2]], d2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const tally={}, falses=[]; let firstOk=0, firstN=0;
const T=(k,f)=>{ tally[k]=tally[k]||{ok:0,bad:0,'?':0,false:0,n:0}; return tally[k]; };
function truthDev(t){ const s=t.prog, data=t.data, pl=DZ.plane(data.A,data.B,data.C), d=v3.sub(data.F,data.E), tR=(s.Rh-pl.sd(data.E))/v3.dot(pl.n,d), SR=v3.add(data.E,v3.mul(d,tR));
  return {n:t.err==='n_dir'?6:0, R:Math.abs(s.L-80), beta:d2(Fp(SR),Fp(s.Strace)), S:d2(Fp(s.S),Fp(s.Strace))}; }
function judge(tag,dev,e,R){ const order=['n','R','beta','S']; let tf=null; for(const k of order) if(dev[k]>=3){ tf=k; break; }
  e.steps.forEach(st=>{ const tv=dev[st.k], t=T(tag+' '+st.k); t.n++; t[st.status]++;
    const isF=st.status==='bad'&&tv<1.5||st.status==='ok'&&tv>=3; if(isF){ t.false++; falses.push(tag+' шаг '+st.k+': сказано «'+st.status+'» ('+st.msg+'), правда '+tv.toFixed(1)); } });
  const ef=e.first&&e.first.k; if(ef){ firstN++; if(ef===tf) firstOk++; else falses.push(tag+': первый неверный шаг назван '+ef+', правда '+tf); }
  return {tf,ef}; }
for(const n of NS) for(const err of VS.PROG_ERRS) for(let k=0;k<PER;k++){ const seed=200+k*37+n, s=VS.progSheet({n,err,seed,level:LV,turn:(n+k)%4}); if(!s) continue;
  const t=s.truth, t0=Date.now(), R=CK.checkSheet(s.img,{dz:2,n}), dev=truthDev(t);
  if(!R.ans||!R.cal||!R.cal.ok){ console.log('в'+n,err.padEnd(6),'не дошли до ответа:',R.verdict,R.why.join('; ').slice(0,100)); T('prog '+err+' (нет ответа)').n++; continue; }
  const e=X.explain2(C.drawSegs(R.dig,R.cal),t.data,R.ans.cur), j=judge('prog '+err,dev,e,R);
  console.log('в'+n,err.padEnd(6),'вердикт',R.verdict.padEnd(14),'шаги',e.steps.map(s=>s.k+':'+s.status).join(' '),'| первый',String(j.ef).padEnd(5),'правда',String(j.tf).padEnd(5),(Date.now()-t0)+' мс'); }
/* листы с разбором сайта: построение сайта верно, ответ — какой сделан */
if(!A.noref) for(const n of NS) for(const err of ['ok','h','link']){ const s=VS.sheet({dz:2,n,err,seed:300+n,level:LV,turn:n%4}); if(!s) continue; const t=s.truth;
  const R=CK.checkSheet(s.img,{dz:2,n}); if(!R.ans||!R.cal||!R.cal.ok) continue; const e=X.explain2(C.drawSegs(R.dig,R.cal),t.data,R.ans.cur);
  e.steps.forEach(st=>{ if(st.k==='S') return; const tt=T('сайт '+err+' '+st.k); tt.n++; tt[st.status]++; if(st.status==='bad'){ tt.false++; falses.push('сайт в'+n+' '+err+' шаг '+st.k+': «неверно» на верном построении ('+st.msg+')'); } });
  console.log('сайт в'+n,err.padEnd(5),'вердикт',R.verdict.padEnd(14),'шаги',e.steps.map(s=>s.k+':'+s.status).join(' ')); }
console.log('\nИТОГО ('+LV+'):'); let F=0;
Object.entries(tally).sort().forEach(([k,v])=>{ F+=v.false; console.log('  '+k.padEnd(22)+' n '+v.n+'  верно '+v.ok+'  неверно '+v.bad+'  ? '+v['?']+'  ЛОЖНЫХ '+v.false); });
console.log('первый неверный шаг назван '+firstN+' раз, из них верно '+firstOk+'; ложных утверждений '+F+(falses.length>F?' (+ '+(falses.length-F)+' о первом шаге)':''));
falses.forEach(x=>console.log('  ЛОЖНО: '+x));
