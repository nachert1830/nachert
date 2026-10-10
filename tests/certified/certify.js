/* ═══════════ Сертификат задачи: обязательства O1–O9 ═══════════
   certify(task, {site}) → {n, ok, O:{O1…O9: {ok, detail}}}
   task — протокол задачи (см. t47.js): данные Γ (два независимых ввода), шаги с двумя исполнениями,
   условие Σ с решателем, ответ. site — то, что реально опубликовано (точки, прямые, текст ответа). */
const {q,V,roundSqrt}=require('./exact.js');
const {K3,K2,PR}=require('./kernels.js');
const SIN2_MIN=Math.sin(8*Math.PI/180)**2;     /* O6: пересечение на бумаге под углом острее 8° неточно */

function sameQ(a,b){ if(Array.isArray(a)) return Array.isArray(b)&&V.eq(a,b); return a.eq(b); }
function deepEqQ(a,b){ if(Array.isArray(a)) return Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>deepEqQ(x,b[i]));
  if(a&&typeof a==='object') return b&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>deepEqQ(a[k],b[k]));
  return q(a).eq(q(b)); }

/* выполнить протокол: оба ядра, сверка O1 на каждом шаге */
function execute(task,G){
  const k=q(task.k), M={}, E={}, steps=[]; let minSin2=1, minAt='';
  task.given3(M,G); task.given2(E,G,k);          /* ядро 2D получает только проекции данных */
  const meet0=K2.meet;
  for(const st of task.steps){
    const rec={id:st.id,title:st.title,ok:true,msg:[]};
    K2.meet=(L1,L2)=>{ const s=K2.sin2(L1,L2).num(); if(s<minSin2){ minSin2=s; minAt=st.title; } return meet0(L1,L2); };
    try{ st.do3(M,G); }catch(e){ rec.ok=false; rec.msg.push('ядро 3D: '+e.message); }
    try{ st.do2(E,k); }catch(e){ rec.ok=false; rec.msg.push('эпюр: '+e.message); }
    K2.meet=meet0;
    if(rec.ok) (st.claims||[]).forEach(([nm,kind])=>{
      if(kind==='scalar'){ if(!E[nm].eq(M[nm])) { rec.ok=false; rec.msg.push(nm+': на эпюре '+E[nm].num().toFixed(4)+', в пространстве '+M[nm].num().toFixed(4)); } return; }
      [['″',2],['′',1]].forEach(([mk,pl])=>{ const e=E[nm+mk]; if(!e) return;
        if(kind==='point'){ const p=PR[pl](M[nm],k); if(!V.eq(p,e)){ rec.ok=false; rec.msg.push(nm+mk+': на эпюре '+V.str(e)+', проекция точки пространства '+V.str(p)); } }
        if(kind==='line'){ const L=M[nm], d=PR['dir'+pl](L.d,k), pr={p:PR[pl](L.p,k),d};
          if(V.zero(d)){ if(!K2.on(pr.p,e)){ rec.ok=false; rec.msg.push(nm+mk+': прямая проецируется в точку, а на эпюре — прямая'); } }
          else if(!K2.same(pr,e)){ rec.ok=false; rec.msg.push(nm+mk+' на эпюре не совпадает с проекцией прямой '+nm); } } }); });
    steps.push(rec); }
  return {M,E,steps,minSin2,minAt};
}

function certify(task,opts){
  opts=opts||{}; const O={};
  /* O9 — два независимых ввода условия совпадают */
  const [e1,e2]=task.entries;
  O.O9={ok:deepEqQ(e1,e2),detail:deepEqQ(e1,e2)?'два ввода условия совпали':'вводы условия расходятся: '+diffEntries(e1,e2)};
  const G=task.gamma(e1);
  const run=execute(task,G);
  /* O1 — коммутативность по шагам */
  const bad=run.steps.filter(s=>!s.ok);
  O.O1={ok:!bad.length,detail:bad.length?bad.map(s=>'шаг «'+s.title+'»: '+s.msg.join('; ')).join(' | '):run.steps.length+' шагов: проекции 3D совпали с эпюром точно'};
  /* O2 — ответ удовлетворяет условию; O3 — совпадает с независимым решением, решение единственно */
  try{ const h=task.spec.holds(run.M,G), f=h.filter(x=>!x[1]); O.O2={ok:!f.length,detail:f.length?'не выполнено: '+f.map(x=>x[0]).join(', '):'выполнено: '+h.map(x=>x[0]).join(', ')}; }
  catch(e){ O.O2={ok:false,detail:'ответ не построен: '+e.message}; }
  try{ const s=task.spec.solve(G), u=task.spec.unique(G); const diff=Object.keys(s).filter(nm=>!run.M[nm]||!sameQ(run.M[nm],s[nm]));
    O.O3={ok:!diff.length&&u.ok,detail:(diff.length?'ответ построения не совпал с решением условия: '+diff.join(', ')+'. ':'ответ совпал с решением условия. ')+u.why}; }
  catch(e){ O.O3={ok:false,detail:'решатель: '+e.message}; }
  /* O6 — пересечения на эпюре не острее 8° */
  const deg=Math.asin(Math.sqrt(run.minSin2))*180/Math.PI;
  O.O6={ok:run.minSin2>=SIN2_MIN,detail:'самое острое пересечение на эпюре '+deg.toFixed(1)+'° («'+run.minAt+'»)'};
  /* O4, O5 — опубликованное совпадает с моделью */
  if(opts.site){ const k=q(task.k), S=opts.site, miss=[];
    Object.entries(task.site.points).forEach(([lab,nm])=>{ const pl=lab.endsWith('″')?2:1, s=S.points[lab];
      if(!s){ miss.push('на сайте нет '+lab); return; } const m=V.num(PR[pl](run.M[nm],k)), d=Math.hypot(s[0]-m[0],s[1]-m[1]);
      if(!(d<=1e-6*Math.max(1,Math.hypot(...m)))) miss.push(lab+' сдвинута на '+(isFinite(d)?d.toFixed(3):'∞ (не число)')+' ед. чертежа'); });
    Object.entries(task.site.lines||{}).forEach(([lab,v])=>{ const [nm,pl]=Array.isArray(v)?v:[v,lab.endsWith('″')?2:1], s=S.lines[lab]; if(!s){ miss.push('на сайте нет прямой '+lab); return; }
      const L=run.M[nm], p=V.num(PR[pl](L.p,k)), d=V.num(PR['dir'+pl](L.d,k)), n=Math.hypot(...d);
      s.forEach(e=>{ const off=Math.abs((e[0]-p[0])*d[1]-(e[1]-p[1])*d[0])/n; if(!(off<=1e-6*Math.max(1,Math.hypot(...e)))) miss.push('конец '+lab+' не на прямой '+nm+' ('+(isFinite(off)?off.toFixed(3):'не число')+')'); });
      /* прямая доведена до всех своих точек: каждая подписанная точка, которая по модели лежит на этой прямой, —
         в пределах нарисованного отрезка (иначе построение «пересечь с h″» на чертеже не выполнить) */
      /* нарисованные куски этой прямой: сама подписанная линия и любые отрезки, лежащие на ней (след f₀γ, совпадающий
         со стороной D″F″, автор дорисовывает только за треугольником — это законно) */
      const tp=e=>((e[0]-p[0])*d[0]+(e[1]-p[1])*d[1])/(n*n), offOf=e=>Math.abs((e[0]-p[0])*d[1]-(e[1]-p[1])*d[0])/n;
      const pieces=[[Math.min(...s.map(tp)),Math.max(...s.map(tp))]].concat((S.segs||[]).filter(g=>offOf(g.a)<1e-6*Math.max(1,n)&&offOf(g.b)<1e-6*Math.max(1,n)).map(g=>[Math.min(tp(g.a),tp(g.b)),Math.max(tp(g.a),tp(g.b))]));
      const lo=Math.min(...pieces.map(x=>x[0])), hi=Math.max(...pieces.map(x=>x[1]));
      Object.entries(task.site.points).forEach(([pl2,pn])=>{ const pp=pl2.endsWith('″')?2:1; if(pp!==pl||!run.M[pn]||!Array.isArray(run.M[pn])) return;
        if(!K3.on(run.M[pn],L)&&!(task.site.on&&task.site.on[pl2+'|'+lab])) return;
        const m=V.num(PR[pl](run.M[pn],k)), t=((m[0]-p[0])*d[0]+(m[1]-p[1])*d[1])/(n*n);
        if(!pieces.some(([u,v])=>t>=u-1e-9&&t<=v+1e-9)) miss.push(lab+' не доведена до своей точки '+pl2+' (не хватает '+(Math.min(Math.abs(t-lo),Math.abs(t-hi))*n).toFixed(1)+' ед.)'); }); });
    let extra=''; if(task.audit){ const r=task.audit(run.M,S,k); miss.push(...r.out); extra='; '+r.what; }
    O.O4={ok:!miss.length,detail:miss.length?miss.join('; '):Object.keys(task.site.points).length+' точек и '+Object.keys(task.site.lines||{}).length+' прямых опубликованного чертежа совпали с моделью'+extra};
    if(task.answer) try{ const v=task.answer.value(run.M), N=roundSqrt(v), m=task.answer.re.exec(S.ans||'');
      O.O5={ok:!!m&&+m[1]===N,detail:m?(+m[1]===N?task.answer.name+' ≈ '+N+' мм — доказано (√ округлено точно)':'в ответе '+m[1]+' мм, доказанное значение '+N+' мм'):'в тексте ответа нет '+task.answer.name}; }
    catch(e){ O.O5={ok:false,detail:e.message}; } }
  /* O7 — метод верен на любых допустимых данных, а не только на этих */
  if(task.randomGamma){ let ok=0, tot=0, fail=''; let seed=opts.seed||12345; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
    for(let i=0;i<(opts.variants||200);i++){ const g=task.randomGamma(rnd); tot++;
      try{ const r=execute(task,g), s=task.spec.solve(g); const good=r.steps.every(x=>x.ok)&&task.spec.holds(r.M,g).every(x=>x[1])&&Object.keys(s).every(nm=>sameQ(r.M[nm],s[nm]));
        if(good) ok++; else if(!fail) fail=(r.steps.find(x=>!x.ok)||{}).title||'условие'; }
      catch(e){ if(!fail) fail=e.message; } }
    O.O7={ok:ok===tot,detail:ok+' из '+tot+' случайных вариантов данных прошли O1–O3'+(fail?'; первый сбой: '+fail:'')}; }
  const ok=Object.values(O).every(o=>o.ok);
  return {n:task.n,ok,O};
}
function diffEntries(a,b,path){ path=path||''; if(Array.isArray(a)||(a&&typeof a==='object')){ for(const k of Object.keys(a)){ const r=diffEntries(a[k],b&&b[k],path+(Array.isArray(a)?'['+k+']':'.'+k)); if(r) return r; } return ''; }
  return q(a).eq(q(b))?'':path.replace(/^\./,'')+': '+a+' и '+b; }
module.exports={certify,execute};
