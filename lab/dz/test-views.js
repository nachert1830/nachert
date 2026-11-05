/* ═══════════ Тест: виды построения без подписей (lk/scan/views.js) на синтетических листах ДЗ №3 ═══════════
   node lab/dz/test-views.js [--N=30] [--v=1] — листы quadsynth (варианты 1…30, свой seed), копия = «как начерчено» (truthOf drawn)
   без подписей точек (подписи не передаются вовсе: проверка только по линиям). Проверяется:
     часть а (замена, основание ребром) — найден вид «edge» и H по нему = эталону ± 1,5 мм;
     часть б (две замены, AB точкой) — найден вид «dih» и угол = эталону ± 2°;
     чужой вариант (не конгруэнтный своему: зеркальные пирамиды дают те же проекции) — ни одного вида ни в одной части;
     ошибки студента: a_dir (ось не ⟂ h′) — «edge» в части а нет; b_dir — «dih» в части б нет; a_d (не то расстояние) — «edge»
     с верным H нет, когда ошибка меняет ответ (неверная точка — конец прямой основания).
   Выход 1, если доля найденного ниже порога или есть ложные. Долго (≈ 15–20 мин: рисуются 4 листа на вариант), --N=8 — быстро. */
const Q=require('./quadsynth.js'), {truthOf}=require('./digit-eval.js'), W=require('../../lk/scan/views.js'), VF=require('../../lk/scan/verify.js'), V=require('../../core/dz-variants.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), N=+(A.N||30), VERB=A.v==='1';
const NM=['A','B','C','S'], dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
/* конгруэнтны (с точностью до зеркала) — те же длины всех шести рёбер при тех же буквах */
const congr=(d,e)=>NM.every((p,i)=>NM.every((q,j)=>j<=i||Math.abs(dist(d[p],d[q])-dist(e[p],e[q]))<1));
const wrongOf=n=>{ for(let k=1;k<30;k++){ const m=(n-1+k)%30+1; if(!congr(V.get(3,n).data,V.get(3,m).data)) return m; } return null; };
function run(s,i,data){ const t=truthOf(s,i,null,true), segs=t.segs.map(([a,b])=>[a[0],a[1],b[0],b[1]]), t0=Date.now(), r=W.findViews(segs,null,data); return {r,ms:Date.now()-t0,nseg:segs.length}; }
const st={a:[0,0],b:[0,0],fp:[0,0],fpWrong:[0,0],a_dir:[0,0],b_dir:[0,0],a_d:[0,0]}, ms=[]; let maxMs=0;
const okH=(r,R)=>r.some(v=>v.kind==='edge'&&Math.abs(v.H-R.H)<=1.5), okD=(r,R)=>r.some(v=>v.kind==='dih'&&Math.abs(v.dih-R.dih)<=2);
for(let n=1;n<=N;n++){ const s=Q.sheet({n,seed:n*7+1,size:[1500,2000]}); if(!s) continue; const R=VF.ref(s.truth.data), wn=wrongOf(n), wd=wn&&V.get(3,wn).data;
  s.truth.parts.forEach((p,i)=>{ const {r,ms:t,nseg}=run(s,i,s.truth.data); ms.push(t); maxMs=Math.max(maxMs,t);
    if(p.built&&p.part==='a'){ st.a[1]++; if(okH(r,R)) st.a[0]++; else if(VERB) console.log('в'+n+' а: нет H', r.map(v=>v.kind).join(',')); }
    if(p.built&&p.part==='b'){ st.b[1]++; if(okD(r,R)) st.b[0]++; else if(VERB) console.log('в'+n+' б: нет угла', r.map(v=>v.kind+(v.dih?v.dih.toFixed(1):'')).join(',')); }
    /* ложные своим вариантом: вид с результатом, который расходится с эталоном (H, угол) */
    st.fp[1]++; if(r.some(v=>v.kind==='edge'&&Math.abs(v.H-R.H)>1.5||v.kind==='dih'&&Math.abs(v.dih-R.dih)>2)){ st.fp[0]++; if(VERB) console.log('в'+n+' '+p.part+': расходится', JSON.stringify(r.map(v=>[v.kind,v.H,v.dih]))); }
    if(wd){ const w=run(s,i,wd).r; st.fpWrong[1]++; if(w.length){ st.fpWrong[0]++; if(VERB) console.log('в'+n+' '+p.part+' чужим в'+wn+':', w.map(v=>v.kind+' '+v.max.toFixed(2)).join(', ')); } } });
  for(const err of ['a_dir','b_dir','a_d']){ const se=Q.sheet({n,seed:n*7+1,size:[1500,2000],err}); if(!se) continue; const i=se.truth.parts.findIndex(p=>p.part===err[0]), p=se.truth.parts[i];
    if(!p.built||!p.err||(err==='a_d'&&!p.affects)) continue; const {r}=run(se,i,se.truth.data); st[err][1]++;
    const bad=err[0]==='a'?okH(r,R):okD(r,R); if(bad){ st[err][0]++; if(VERB) console.log('в'+n+' '+err+': подтверждено неверное', r.map(v=>v.kind+' '+v.max.toFixed(2)).join(', ')); } } }
const f=([a,b])=>a+' из '+b; ms.sort((a,b)=>a-b);
console.log('часть а — H найдена: '+f(st.a)+'; часть б — угол граней: '+f(st.b));
console.log('свой вариант, результат расходится с эталоном: '+f(st.fp)+'; чужой вариант — найден хоть один вид: '+f(st.fpWrong));
console.log('ошибки студента подтверждены как верные: a_dir '+f(st.a_dir)+', b_dir '+f(st.b_dir)+', a_d '+f(st.a_d));
console.log('время на чертёж: медиана '+ms[ms.length>>1]+' мс, наибольшее '+maxMs+' мс');
const ok=st.a[0]>=0.8*st.a[1]&&st.b[0]>=0.7*st.b[1]&&!st.fp[0]&&!st.fpWrong[0]&&!st.a_dir[0]&&!st.b_dir[0]&&!st.a_d[0]&&maxMs<300;
console.log(ok?'ok':'НЕ ПРОШЁЛ'); process.exit(ok?0:1);
