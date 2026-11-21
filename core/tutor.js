/* ═══════════ Ядро ИИ-тренера: лестница подсказок, контекст для модели, линтер ответа ═══════════
   docs/AI-TUTOR-RESEARCH.md, §3–4. Принцип: ядро говорит правду, автомат управляет, модель только формулирует.
   Модели передаётся ровно то, что разрешает текущая ступень; каждый её ответ проходит линтер; при отказе — шаблон ступени.

   Данные шага (kb/tutor/<дз>.json, tools/tutor-make.js): goal, rungs {1 намёк, 2 почему, 3 шаг, 4 числа, 5 проверь},
   labels (метки на чертеже к началу шага), secret {labels — вводит шаг, numbers — числа шага}, topics.

   Ступени (§4.1): Р0 — вопрос о цели; Р1 — стратегия (rungs.1); Р2 — объект и правило (rungs.2); Р3 — где действовать
   (rungs.3 без секретов); Р4 — полное построение этого же шага на СОСЕДНЕМ варианте (свой вариант ученика тренер не решает
   ни на какой ступени). Секреты своего варианта модель не получает никогда — их видит только линтер.

   ladder.step(state, event) — детерминированный автомат: события open, act_ok, act_wrong (misc — ошибка из библиотеки),
   idle (секунды), ask (просьба о помощи), text (содержательная реплика). Ступень растёт только после попытки или паузы;
   ошибка из библиотеки ступень с первого раза не поднимает; Р4 — после двух ошибок на Р3 или просьбы после попытки.
   context(step, rung, {neighbor, cond}) — пакет для модели: цель, разрешённые ступени, словарь меток, разрешённые числа.
   lint(text, ctx) — {ok, errors}: длина, один вопрос, только метки из словаря, ни одной секретной метки, ни одного числа,
   кроме чисел условия, без «понятно?» и похвалы личности, без вопроса да/нет о положении искомого.
   fallback(step, rung, ctx) — шаблон ступени без модели (тот же текст, что прошёл линтер). Работает в Node и в браузере. */
(function(){
const MAXLEN=320;
const THEORY=['0','1','2','3','30','45','60','90','120','180','360'];
/* метки чертежа: A′ B″ C‴ K₀ 1′ h″α π₁ x₁₄ D^IV; греческие плоскости α β γ … */
const LAB=/(?:[A-ZА-ЯЁ]|\d{1,2})[̄̅]?[₀-ₜ]*(?:\^?[IVX]{1,3})?[′″‴]|[A-ZА-ЯЁ][̄̅][₀-ₜ]*|[A-ZА-ЯЁ][₀-ₜ]+|[hfn][′″‴][₀-₉α-ω]*|π[₀-₉]+|x[₀-₉]+|[αβγδεσφψ](?:[₀-₉]+)?(?:[′″‴])?/g;
const NUMRE=/(?<![A-Za-zА-Яа-яЁё\u2080-\u209c′″‴^])-?\d+(?:[,.]\d+)?(?![′″‴])/g;
const norm=s=>String(s).replace(/\^/g,'');
const sentences=t=>String(t).split(/(?<=[.!?…])\s+/).filter(Boolean);
const PRAISE=/(?<![А-Яа-яЁё])(умниц|молод(ец|чина)|гений|талантлив)/i, UNDERSTOOD=/понятно\s*\?|ясно\s*\?/i;
const YESNO=/(?:^|\s)(не\s+\S+\s+ли|правда\s+ли|ведь|верно\s+ли|так\s+ли)(?![А-Яа-яЁё])/i;
function labelsIn(t){ return [...new Set((String(t).match(LAB)||[]).map(norm))]; }
function numbersIn(t){ return (String(t).match(NUMRE)||[]).map(x=>x.replace(',','.')); }
/* маска секретов: метки, которые вводит шаг, → «…», числа шага убираются */
function mask(text,secret){ let s=String(text||'');
  (secret.labels||[]).slice().sort((a,b)=>b.length-a.length).forEach(l=>{ s=s.split(l).join('…'); s=s.split(norm(l)).join('…'); });
  (secret.numbers||[]).slice().sort((a,b)=>b.length-a.length).forEach(n=>{ s=s.replace(new RegExp('(?<![\\d,.])'+n.replace(/[.,]/g,'[.,]')+'(?![\\d,.])','g'),'…'); });
  return s.replace(/(…\s*){2,}/g,'… ').trim(); }
/* Р3 — «где действовать»: первое-второе предложение шага с замаскированными секретами */
function actionOf(step){ const t=mask(step.rungs['3']||'',step.secret); return sentences(t).slice(0,2).join(' '); }
function context(step,rung,o){ o=o||{}; const R={};
  const given=new Set(numbersIn((o.cond||'')+' '+step.goal)); step=Object.assign({},step,{secret:{labels:step.secret.labels||[],numbers:(step.secret.numbers||[]).filter(x=>!given.has(x.replace(',','.')))}});
  R.R0='Цель шага: '+step.goal+'.';
  if(rung>=1&&step.rungs['1']) R.R1=mask(step.rungs['1'],step.secret);
  if(rung>=2&&step.rungs['2']) R.R2=mask(step.rungs['2'],step.secret);
  if(rung>=3) R.R3=actionOf(step);
  const neighbor=rung>=4&&o.neighbor?{id:o.neighbor.id,text:o.neighbor.rungs['3'],numbers:o.neighbor.rungs['4']||''}:null;
  /* разрешено: метки чертежа, метки цели и открытых ступеней (после маски); числа условия, цели, открытых ступеней и
     константы теории. Вычисленные числа шага и найденные точки (секрет) — никогда */
  const open=Object.values(R).join(' '), sn=new Set((step.secret.numbers||[]).map(x=>x.replace(',','.')));
  const nums=[...new Set(numbersIn((o.cond||'')+' '+open).concat(THEORY))].filter(x=>!sn.has(x));
  const sl=new Set((step.secret.labels||[]).map(norm)), labs=[...new Set(step.labels.concat(labelsIn(open)))].filter(l=>!sl.has(norm(l)));
  return {id:step.id,rung,goal:step.goal,allowed:R,neighbor,labels:labs,numbers:nums,
    secret:step.secret, topics:step.topics||[]}; }
function lint(text,ctx){
  const t=String(text||''), errs=[], add=(code,msg)=>errs.push({code,msg});
  if(!t.trim()) add('empty','пустой ответ');
  if(t.length>MAXLEN) add('long','длиннее '+MAXLEN+' символов');
  const q=(t.match(/\?/g)||[]).length; if(q>1) add('questions','больше одного вопроса');
  if(PRAISE.test(t)) add('praise','похвала личности');
  if(UNDERSTOOD.test(t)) add('understood','«понятно?» вместо вопроса по делу');
  const allowed=new Set((ctx.labels||[]).map(norm)), secret=new Set(((ctx.secret||{}).labels||[]).map(norm));
  const nb=ctx.neighbor?new Set(labelsIn(ctx.neighbor.text)):new Set();
  labelsIn(t).forEach(l=>{ if(secret.has(l)&&!(ctx.neighbor&&nb.has(l))) add('secret','секретная метка шага: '+l);
    else if(!allowed.has(l)&&!nb.has(l)&&!/^π|^x[₀-₉]|^[αβγδεσφψ]$/.test(l)) add('label','метки нет на чертеже: '+l); });
  const okNum=new Set((ctx.numbers||[]).map(x=>x.replace(',','.'))), secN=new Set(((ctx.secret||{}).numbers||[]).map(x=>x.replace(',','.')));
  numbersIn(t).forEach(n=>{ if(secN.has(n)&&!(ctx.neighbor)) return add('number','число шага (секрет): '+n); if(!okNum.has(n)&&!(ctx.neighbor&&numbersIn(ctx.neighbor.text+' '+ctx.neighbor.numbers).includes(n))) add('number','число в ответе: '+n); });
  sentences(t).filter(s=>s.includes('?')&&YESNO.test(s)).forEach(s=>{ if(labelsIn(s).some(l=>secret.has(l))||((ctx.secret||{}).numbers||[]).length) add('yesno','вопрос «да/нет» о положении искомого'); });
  return {ok:!errs.length,errors:errs};
}
/* шаблон ступени без модели — то, что гарантированно проходит линтер */
function fallback(step,rung,o){ const c=context(step,rung,o), A=c.allowed; step=Object.assign({},step,{secret:c.secret});
  const pick=rung>=4&&c.neighbor?'Посмотри этот же шаг на соседнем варианте: '+c.neighbor.text:rung>=3?A.R3:rung>=2?A.R2:rung>=1?A.R1:A.R0+' Что уже есть на чертеже для этого?';
  let s='', q=0; const src=String(pick||A.R0);
  for(const x of sentences(src)){ const qq=(x.match(/\?/g)||[]).length; if((s+' '+x).length>MAXLEN-1||q+qq>1) break; s=(s?s+' ':'')+x; q+=qq; }
  if(!s) s=src.slice(0,MAXLEN-1).replace(/\?/g,'.')+'…';
  if(!lint(s,c).ok) s=A.R0;   /* последний рубеж: цель шага не содержит секретов */
  return s; }
/* ── автомат лестницы (§4.1) ── */
const ladder={
  init(){ return {rung:-1,tries:0,errAt:0,idle:0,maxRung:-1,done:false,log:[]}; },
  step(s,ev){ s=Object.assign({},s,{log:s.log.concat([ev.t])}); const up=r=>{ s.rung=Math.min(4,r); s.errAt=0; s.idle=0; s.maxRung=Math.max(s.maxRung,s.rung); };
    if(s.done) return s;
    switch(ev.t){
      case 'open': return s;
      case 'act_ok': s.done=true; return s;
      case 'act_wrong': s.tries++;
        if(s.rung<0){ up(0); return s; }
        if(ev.misc&&!s.miscSeen){ s.miscSeen=1; s.move='feedback_incorrect'; return s; }   /* ошибку из библиотеки сначала показываем, ступень не растёт */
        if(s.rung===3){ s.errAt++; if(s.errAt>=2) up(4); return s; }
        up(s.rung+1); return s;
      case 'text': if(ev.attempt) s.tries++; return s;
      case 'idle': s.idle+=ev.sec||0; if(s.idle>=(s.rung<0?60:45)&&s.rung<3){ up(s.rung+1); } return s;
      case 'ask': if(s.rung<0){ up(0); return s; } if(!s.tries){ s.move='prompt_try'; return s; }   /* просьба без попытки — «попробуй сначала вот это» */
        if(s.rung===3){ up(4); return s; } up(s.rung+1); return s;
    }
    return s; } };
/* соседний вариант: тот же ДЗ, тот же шаг (часть и номер) в варианте того же типа — ближайший номер */
function neighborOf(D,step){ const m=/^(\w+)\.v(\d+)\.(.+)$/.exec(step.id); if(!m) return null; const n=+m[2], tail=m[3], me=D.variants.find(v=>v.n===n), kind=me&&me.kind;
  const vs=D.variants.filter(v=>v.n!==n&&v.steps&&v.steps.length&&(kind==null||v.kind===kind)).sort((a,b)=>Math.abs(a.n-n)-Math.abs(b.n-n)||a.n-b.n);
  for(const v of vs){ const s=v.steps.find(x=>x.id.endsWith('.'+tail)&&x.goal.split(' ')[0]===step.goal.split(' ')[0]); if(s) return s; }
  return null; }
/* ── проверка утверждений ученика по координатам варианта (начерт) ──
   claim: {rel:'on', p, a, b} — точка p на прямой ab; {rel:'link', a, b} — a и b на одной линии связи (⟂ оси x);
   {rel:'par'|'perp', a, b, c, d} — прямые ab и cd; {rel:'parx', a, b} — ab ∥ оси x.
   Ответ: {truth:true|false} или {hidden:true}, если в утверждении точка, которую шаг ещё не открыл ученику
   (да/нет о положении искомого — утечка: такой ответ тренер не даёт). Допуск — 1 единица чертежа, угол — 0,6°. */
const ORDER=k=>k==='g'?[0,0]:(m=>[+m[1],+m[2]])(/p(\d+)\.s(\d+)/.exec(k)||[0,999,999]);
function checkClaim(V,stepId,c){
  const at=(/\.p(\d+)\.s(\d+)$/.exec(stepId)||[]).slice(1).map(Number), P=V.P||{};
  const pt=l=>{ const q=P[l]||P[norm(l)]; if(!q) return null; const o=ORDER(q[2]); const open=!at.length||o[0]<at[0]||(o[0]===at[0]&&o[1]<at[1]); return {x:q[0],y:q[1],open}; };
  const L=['p','a','b','c','d'].filter(k=>c[k]).map(k=>[k,pt(c[k])]);
  if(L.some(([k,q])=>!q)) return {unknown:true,why:'такой точки на чертеже нет'};
  if(L.some(([k,q])=>!q.open)) return {hidden:true};
  const Q=Object.fromEntries(L), d=(u,v)=>[v.x-u.x,v.y-u.y], cr=(u,v)=>u[0]*v[1]-u[1]*v[0], dt=(u,v)=>u[0]*v[0]+u[1]*v[1], ln=u=>Math.hypot(u[0],u[1])||1e-9;
  const sinA=(u,v)=>Math.abs(cr(u,v))/ln(u)/ln(v), TOL=1, ANG=Math.sin(0.6*Math.PI/180);
  switch(c.rel){
    case 'on': { const u=d(Q.a,Q.b), w=d(Q.a,Q.p); return {truth:Math.abs(cr(u,w))/ln(u)<TOL}; }
    case 'link': return {truth:Math.abs(Q.a.x-Q.b.x)<TOL};
    case 'parx': return {truth:Math.abs(Q.a.y-Q.b.y)<TOL};
    case 'par': return {truth:sinA(d(Q.a,Q.b),d(Q.c,Q.d))<ANG};
    case 'perp': { const u=d(Q.a,Q.b), v=d(Q.c,Q.d); return {truth:Math.abs(dt(u,v))/ln(u)/ln(v)<ANG}; }
  }
  return {unknown:true,why:'неизвестное отношение'};
}
/* простой разбор фразы ученика (без модели): «K′ лежит на D′E′», «A′ и A″ на одной линии связи», «A′B′ ∥ x», «AB ⟂ CD» */
function parseClaim(text){ const t=String(text), L=labelsIn(t);
  if(/лини[а-яё]* связи/i.test(t)&&L.length>=2) return {rel:'link',a:L[0],b:L[1]};
  if(/(∥|паралл)[а-яё]*\s*(оси\s*)?x\b|∥\s*x|параллельн[а-яё]* ос/i.test(t)&&L.length>=2) return {rel:'parx',a:L[0],b:L[1]};
  if(/∥|паралл/i.test(t)&&L.length>=4) return {rel:'par',a:L[0],b:L[1],c:L[2],d:L[3]};
  if(/⟂|перпенд/i.test(t)&&L.length>=4) return {rel:'perp',a:L[0],b:L[1],c:L[2],d:L[3]};
  if(/(лежит|находится|принадлеж|\sна\s|∈)/i.test(t)&&L.length>=3) return {rel:'on',p:L[0],a:L[1],b:L[2]};
  return null; }
const api={context,lint,fallback,ladder,mask,labelsIn,numbersIn,actionOf,neighborOf,checkClaim,parseClaim,MAXLEN};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else (self.TUTOR=api);
})();
