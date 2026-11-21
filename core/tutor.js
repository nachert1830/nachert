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
/* приведение текста модели к виду чертежа — чтобы обход штрихами и двойниками не прошёл:
   ' ’ ` ´ ʹ → ′;  '' ” " ʺ → ″;  ^{\prime} → ′;  «K-штрих» → K′, «K два штриха» → K″; кириллические двойники латинских букв
   перед штрихом или индексом → латиница; полноширинные цифры → обычные; пробел между меткой и штрихом убираем */
const CYR2LAT={'А':'A','В':'B','С':'C','Е':'E','Н':'H','К':'K','М':'M','О':'O','Р':'P','Т':'T','Х':'X','а':'a','е':'e','о':'o','р':'p','с':'c','х':'x'};
function canonText(t){ let s=String(t||'');
  s=s.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFF10+48));
  s=s.replace(/\^\s*\{?\s*\\prime\\prime\s*\}?/g,'″').replace(/\^\s*\{?\s*\\prime\s*\}?/g,'′').replace(/\\prime/g,'′');
  s=s.replace(/''|”|"|ʺ|〃/g,'″').replace(/['’`´ʹ‘]/g,'′');
  s=s.replace(/(^|[^А-Яа-яЁё])(один|единиц\S*)\s*[-–—]?\s*штрих\S*/gi,'$11′').replace(/(^|[^А-Яа-яЁё])(два|двойк\S*)\s*[-–—]\s*штрих\S*/gi,'$12′');
  s=s.replace(/([A-Za-zА-ЯЁ0-9₀-₉])\s*[-–—]?\s*(?:два|двумя|2)\s*штрих\w*/gi,'$1″').replace(/([A-Za-zА-ЯЁ0-9₀-₉])\s*[-–—]?\s*(?:три|тремя|3)\s*штрих\w*/gi,'$1‴').replace(/([A-Za-zА-ЯЁ0-9₀-₉])\s*[-–—]?\s*(?:один\s*)?штрих\w*/gi,'$1′');
  s=s.replace(/([A-Za-zА-ЯЁ0-9₀-₉])\s+([′″‴])/g,'$1$2');
  s=s.replace(/(^|[^А-Яа-яЁё])([АВСЕНКМОРТХ])(?=[′″‴₀-₉\u2080-\u209c])/g,(m,a,b)=>a+CYR2LAT[b]);
  return s; }
/* числительные словами: от «четырёх» и выше — запрещены (числа подставляет интерфейс из ядра); «один, два, три» — можно */
const NUMWORD=new RegExp('(?<![А-Яа-яЁё])('+['четыре','четырёх','четырех','четырём','четырем','четырьмя','пять','пяти','пятью','шесть','шести','шестью','семь','семи','семью','восемь','восьми','восемью','девять','девяти','девятью','десять','десяти','десятью',
  'одиннадцат[ьи]','двенадцат[ьи]','тринадцат[ьи]','четырнадцат[ьи]','пятнадцат[ьи]','шестнадцат[ьи]','семнадцат[ьи]','восемнадцат[ьи]','девятнадцат[ьи]','двадцат[ьи]','тридцат[ьи]','сорок','сорока',
  'пятьдесят','пятидесяти','шестьдесят','шестидесяти','семьдесят','семидесяти','восемьдесят','восьмидесяти','девяносто','девяноста','сто','ста','двести','двухсот','триста','трёхсот','четыреста','четырёхсот',
  'пятьсот','шестьсот','семьсот','восемьсот','девятьсот','тысяч[аиуе]?','полтора','полторы'].join('|')+')(?![А-Яа-яЁё])','i');
function labelsIn(t){ return [...new Set((canonText(t).match(LAB)||[]).map(norm))]; }
function numbersIn(t){ return (canonText(t).replace(/(\d)\s+(?=\d)/g,'$1').match(NUMRE)||[]).map(x=>x.replace(',','.')); }
/* маска секретов: метки, которые вводит шаг, → «…», числа шага убираются */
function mask(text,secret){ let s=String(text||'');
  (secret.labels||[]).slice().sort((a,b)=>b.length-a.length).forEach(l=>{ s=s.split(l).join('⋯'); s=s.split(norm(l)).join('⋯'); });
  (secret.numbers||[]).slice().sort((a,b)=>b.length-a.length).forEach(n=>{ s=s.replace(new RegExp('(?<![\\d,.A-Za-zА-Яа-я])'+n.replace(/[.,]/g,'[.,]')+'(?![\\d,.′″‴₀-₉\\u2080-\\u209c])','g'),'⋯'); });
  return s.replace(/(⋯\s*){2,}/g,'⋯ ').trim(); }   /* маска — «⋯»: не конец предложения, в отличие от «…» */
/* Р3 — «где действовать»: первое-второе предложение шага с замаскированными секретами */
const ACT=/(?<![А-Яа-яЁё])(строим|проводим|проведи|откладываем|отложи|достраиваем|достраивай|отмечаем|отметь|переносим|перенеси|находим|найди|соединяем|соедини|берём|бери|опускаем|опусти|делим|раздели|засекаем|продолжаем|измеряем|измерь|выбираем|выбери|поворачиваем|вращаем|пересекаем|ставим|штрихуем)/i;
function actionOf(step){
  const clean=x=>x.replace(/\s*\([^()]*⋯[^()]*\)/g,'').replace(/\s*\((?:\s*[−-]?\s*⋯\s*[;,]?)+\)/g,'').replace(/\s*[→=]\s*⋯(\s*[;,]\s*⋯)*/g,'').replace(/(⋯\s*[;,]\s*)+⋯/g,'⋯').replace(/\s+([.,;:])/g,'$1').trim();
  const S=sentences(mask(step.rungs['3']||'',step.secret)).map(clean).filter(x=>x.replace(/[⋯\s.,;:—-]/g,'').length>=12);
  /* «где действовать»: предложения с действием и не больше одной маски — в исходном порядке; иначе — первые подходящие */
  const ok=S.filter(x=>(x.match(/⋯/g)||[]).length<=1), act=ok.filter(x=>ACT.test(x));
  const pick=(act.length?act:ok).slice(0,2).join(' ').replace(/^[\s—–\-:;,.⋯]+/,'').replace(/^./,c=>c.toUpperCase());
  if(pick.replace(/⋯/g,'').length>=25) return pick;
  return 'Сделай это построение: '+step.goal.replace(/[.\s]+$/,'')+'. Начни с того, что для него уже есть на чертеже.'; }
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
  const raw=String(text||''), t=canonText(raw), errs=[], add=(code,msg)=>errs.push({code,msg});
  { const m=NUMWORD.exec(raw); if(m) add('numword','число словами: '+m[1]); }
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
  const pick=rung>=4&&c.neighbor?'Посмотри этот же шаг на соседнем варианте: '+c.neighbor.text.replace(/\s*$/,'').replace(/([^.!?…])$/,'$1.')+(c.neighbor.numbers?' Числа там: '+c.neighbor.numbers:''):rung>=3?A.R3:rung>=2?A.R2:rung>=1?A.R1:A.R0+' Что уже есть на чертеже для этого?';
  let s='', q=0; const src=String(pick||A.R0);
  for(const x of sentences(src)){ const qq=(x.match(/\?/g)||[]).length; if((s+' '+x).length>MAXLEN-1||q+qq>1) break; s=(s?s+' ':'')+x; q+=qq; }
  if(!s) s=src.slice(0,MAXLEN-1).replace(/\?/g,'.')+'…';
  if(!lint(s,c).ok) s=A.R0;   /* последний рубеж: цель шага не содержит секретов */
  return s; }
/* ── автомат лестницы (§4.1) ── */
const ladder={
  /* rk: true — режим перед РК: лестница сжата (Р0 → Р2 → Р4) */
  init(o){ return {rung:-1,tries:0,att:0,errAt:0,idle:0,maxRung:-1,done:false,misc:[],rk:!!(o&&o.rk),move:null,log:[]}; },
  step(s0,ev){ const s=Object.assign({},s0,{log:s0.log.concat([ev.t]),move:null,misc:s0.misc.slice()});
    const up=r=>{ if(s.rk&&r>=0) r=r<=0?0:r<=2?2:4; s.rung=Math.min(4,Math.max(s.rung,r)); s.errAt=0; s.idle=0; s.att=0; s.maxRung=Math.max(s.maxRung,s.rung); };
    const next=()=>up(s.rung<0?0:s.rk?(s.rung<2?2:4):s.rung+1);
    if(s.done) return s;
    switch(ev.t){
      case 'open': return s;
      case 'act_ok': s.done=true; s.idle=0;
        /* самообъяснение после верного шага, если брал Р2 и выше (§4.1) */
        s.move=s.maxRung>=2?'ask_self_explain':'feedback_correct'; return s;
      case 'act_wrong': s.tries++; s.att++; s.idle=0;
        if(s.rung<0){ up(0); s.move='pump'; return s; }
        if(ev.misc&&!s.misc.includes(ev.misc)){ s.misc.push(ev.misc); s.move='feedback_incorrect'; return s; }   /* каждую ошибку из библиотеки сначала показываем, ступень не растёт */
        if(s.rung===3){ s.errAt++; if(s.errAt>=2) up(4); s.move='hint'; return s; }
        next(); s.move='hint'; return s;
      case 'text': s.idle=0; if(ev.attempt){ s.tries++; s.att++; } return s;
      case 'idle': s.idle+=ev.sec||0; if(s.idle>=(s.rung<0?60:45)&&s.rung<3){ next(); s.move=s.rung===0?'pump':'hint'; } return s;
      case 'ask': s.idle=0;
        if(s.rung<0){ up(0); s.move='pump'; return s; }
        if(!s.att){ s.move='prompt_try'; return s; }   /* просьба без новой попытки — «попробуй сначала вот это» */
        next(); s.move='hint'; return s;
    }
    return s; },
  /* три шага подряд дошли до Р4 — вернуться к теме-опоре (граф программы): отдаём темы этих шагов */
  review(results){ const last=results.slice(-3); return last.length===3&&last.every(r=>r.maxRung>=4)?[...new Set(last.flatMap(r=>r.topics||[]))]:null; } };
/* соседний вариант: тот же ДЗ, тот же шаг (часть и номер) в варианте того же типа — ближайший номер */
function neighborOf(D,step){ const m=/^(\w+)\.v(\d+)\.(.+)$/.exec(step.id); if(!m) return null; const n=+m[2], tail=m[3], me=D.variants.find(v=>v.n===n), kind=me&&me.kind;
  const vs=D.variants.filter(v=>v.n!==n&&v.steps&&v.steps.length&&(kind==null||v.kind===kind)).sort((a,b)=>Math.abs(a.n-n)-Math.abs(b.n-n)||a.n-b.n);
  for(const v of vs){ const s=v.steps.find(x=>x.id.endsWith('.'+tail)&&x.goal.split(' ')[0]===step.goal.split(' ')[0]); if(s) return s; }
  /* инжа: элементы у разных деталей в разном порядке — ищем тот же род элемента, потом ту же главную тему построения */
  const w=step.goal.split(' ')[0], main=(step.topics||[]).find(t=>!['v2','v3','v6','r1','r2'].includes(t));
  for(const v of vs){ const s=v.steps.find(x=>x.goal.split(' ')[0]===w); if(s) return s; }
  if(main) for(const v of vs){ const s=v.steps.find(x=>(x.topics||[]).includes(main)); if(s) return s; }
  const T0=step.topics||[]; for(const v of vs){ const s=v.steps.find(x=>(x.topics||[]).filter(t=>T0.includes(t)).length>=Math.min(2,T0.length)); if(s) return s; }
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
function parseClaim(text){ const t=canonText(text), L=labelsIn(t);
  if(/лини[а-яё]* связи/i.test(t)&&L.length>=2) return {rel:'link',a:L[0],b:L[1]};
  if(/(∥|паралл)[а-яё]*\s*(оси\s*)?x\b|∥\s*x|параллельн[а-яё]* ос/i.test(t)&&L.length>=2) return {rel:'parx',a:L[0],b:L[1]};
  if(/∥|паралл/i.test(t)&&L.length>=4) return {rel:'par',a:L[0],b:L[1],c:L[2],d:L[3]};
  if(/⟂|перпенд/i.test(t)&&L.length>=4) return {rel:'perp',a:L[0],b:L[1],c:L[2],d:L[3]};
  if(/(лежит|находится|принадлеж|\sна\s|∈)/i.test(t)&&L.length>=3) return {rel:'on',p:L[0],a:L[1],b:L[2]};
  return null; }
/* ── инжа: утверждения об элементе по базе «каждая линия» (core/ig-explain.js → explain) ──
   claim: {rel:'src', view, coord:'x'|'y'|'z', from:'F'|'T'} — откуда координата (способ); {rel:'given', view} — дан ли на виде;
   {rel:'hidden'|'curve', view} — есть ли невидимые / кривые линии (результат); {rel:'cut', view} — рассечён ли в разрезе;
   {rel:'hatch'} — штрихуется ли сам элемент в разрезе (отверстие — никогда, тело — да).
   result:true — утверждение о результате построения: тренер подтверждает его не раньше Р3. */
const VW={F:'F',T:'T',L:'L'};
function checkIG(ex,c){ if(!ex||!c) return {unknown:true};
  const b=ex.byView.find(x=>x.v===c.view);
  switch(c.rel){
    case 'given': return {truth:ex.given.includes(c.view)};
    case 'src': { if(!b) return {unknown:true,why:'на этом виде элемент не достраивают'}; const h=b.how||{}; const v=c.coord==='y'?(h.y?'T':null):h[c.coord]; return {truth:v===c.from}; }
    case 'hidden': return {truth:!!(b&&b.hidden),result:true};
    case 'curve': return {truth:!!(b&&b.curves),result:true};
    case 'cut': return {truth:ex.sections.some(x=>x.v===c.view)};
    case 'hatch': return {truth:ex.kind!=='отверстие'};
  }
  return {unknown:true}; }
function parseIGClaim(text){ const t=String(text).toLowerCase();
  const view=/главн/.test(t)?'F':/сверху/.test(t)?'T':/слева/.test(t)?'L':null;
  const sec=/фронтальн[а-яё]* разрез/.test(t)?'Fs':/профильн[а-яё]* разрез/.test(t)?'Ls':/(горизонтальн[а-яё]* разрез|а–а|а-а)/.test(t)?'Ts':null;
  if(/штрихуют|штрихуется|заштрих/.test(t)&&!/не штрих/.test(t)) return {rel:'hatch'};
  if(/высот[а-яё]*.*с главного/.test(t)) return {rel:'src',view:view==='F'?'L':view||'L',coord:'z',from:'F'};
  if(/глубин[а-яё]*.*с вида сверху/.test(t)) return {rel:'src',view:view==='T'?'L':view||'L',coord:'y',from:'T'};
  if(/(ширин|по ширине|положение по x).*с главного/.test(t)) return {rel:'src',view:view==='F'?'T':view||'T',coord:'x',from:'F'};
  if(sec&&/рассеч|попада|режет/.test(t)) return {rel:'cut',view:sec};
  if(view&&/невидим|штрихов[а-яё]* лини/.test(t)) return {rel:'hidden',view};
  if(view&&/крив|по точкам|эллипс|дуг/.test(t)) return {rel:'curve',view};
  if(view&&/(дан|задан)/.test(t)) return {rel:'given',view};
  return null; }
const api={checkIG,parseIGClaim,canonText,context,lint,fallback,ladder,mask,labelsIn,numbersIn,actionOf,neighborOf,checkClaim,parseClaim,MAXLEN};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else (self.TUTOR=api);
})();
