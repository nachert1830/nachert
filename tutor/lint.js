/* ═══════════ TUTOR_LINT: линтер утверждений и детектор секретов шага (docs/TUTOR.md, отчёт-исследование §3.5) ═══════════
   Детерминированный. Работает в браузере (self.TUTOR_LINT) и в Node (require).
   lint(text, passport, rung) → {ok, errors:[{code, msg, tok?}]}. rung — ступень лестницы 0…4 (4 — пример на соседнем варианте).
   Правила:
     LEN      — длина ≤ 320 символов;
     Q2       — не больше одного вопроса;
     LABEL    — каждая метка (A″, h′, π₁, γ, 1′…) — из словаря шага (passport.labels.*, общие обозначения);
     RUNG     — метка из словаря, но ещё не разрешена на этой ступени (новые точки шага — только с Р3);
     SECRET   — секретная метка (искомое, будущие шаги) до Р4;
     NUM      — число (кроме номеров-меток точек из словаря шага); UNIT — единицы «мм», «°», «градус»;
     REL      — утвердительное геометрическое отношение (∥, ⟂, ∈, пересекается, натуральная…) с метками шага, не подтверждённое
                разрешённым фактом той же ступени;
     YESNO    — да/нет-вопрос о гипотезе («правда ли…», «не… ли», «ведь…») с отношением — так ответ выпытывают по частям;
     ASK      — «понятно?»; PRAISE — похвала личности («умница», «гений»).
   Ложное срабатывание безопасно: тренер берёт более сухой шаблон. */
(function(){
const MAXLEN=320;
/* основы отношений → класс (как у фактов паспорта) */
const REL=[
  ['par',/параллел|∥/i], ['perp',/перпендикул|⟂|⊥|прям(ой|ым|ого)\s+угл/i], ['on',/принадлеж|∈|леж(ит|ат)\s+на|на\s+прямой|на\s+линии\s+связи/i],
  ['meet',/пересека|пересечени|∩/i], ['skew',/скрещива/i], ['nv',/натуральн|истинн/i], ['level',/горизонтал|фронтал|профильн|уровня/i],
  ['proj',/проецирующ/i], ['vis',/видим|невидим|закрыва|конкурир/i], ['coinc',/совпада|≡/i], ['eq',/равн[аоыя]|равен|=/i] ];
const GENERAL=['x','y','z','π₁','π₂','π₃','π₄','π₅','x₁₂','x₁₄','x₂₄','x₄₅','x₁₃','O'];
const isAtomStart=c=>/[A-Za-zα-ωΑ-Ω0-9]/.test(c);
const strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ');

/* словарь шага: все метки задачи (данные + все шаги) и что из них разрешено на ступени */
function dict(P){ const L=P.labels||{}; const uni=new Set([].concat(GENERAL,L.general||[],L.known||[],L.new||[],L.future||[],P.entities||[]));
  return {uni:[...uni].sort((a,b)=>b.length-a.length), secret:new Set([].concat((P.secrets&&P.secrets.labels)||[],(P.secrets&&P.secrets.entities)||[]))}; }
function allowedAt(P,rung){ const r=(P.rungs||[]).find(x=>x.k===rung)||(P.rungs||[])[Math.min(rung,(P.rungs||[]).length-1)]||{};
  return new Set([].concat(GENERAL,(P.labels&&P.labels.general)||[],r.labels||[])); }
/* разбор текста на метки: самое длинное совпадение со словарём задачи; остаток — неизвестная метка или число */
function tokens(text,P){ const D=dict(P), out=[]; const s=strip(text); let i=0;
  while(i<s.length){ const c=s[i];
    if(!isAtomStart(c)){ i++; continue; }
    if(i>0&&/[А-Яа-яЁё]/.test(s[i-1])&&/[A-Za-z]/.test(c)){ i++; continue; }
    let m=null; for(const u of D.uni){ if(u&&s.startsWith(u,i)){ const nx=s[i+u.length]||''; if(!/[A-Za-z0-9₀-₉]/.test(nx)||/[′″‴]$/.test(u)||/[A-Z]/.test(u)){ m=u; break; } } }
    if(m){ out.push({t:m,kind:'label',at:i}); i+=m.length; continue; }
    if(/[0-9]/.test(c)){ let j=i; while(j<s.length&&/[0-9.,]/.test(s[j])) j++; while(j>i&&/[.,]/.test(s[j-1])) j--; out.push({t:s.slice(i,j),kind:'num',at:i}); i=j; continue; }
    let j=i+1; while(j<s.length&&/[₀-₉ₐ-ₜ′″‴]/.test(s[j])) j++;
    out.push({t:s.slice(i,j),kind:'unk',at:i}); i=j; }
  return out; }
const sentences=s=>strip(s).split(/(?<=[.!?…])\s+|\n+/).map(x=>x.trim()).filter(Boolean);
function relsOf(s){ return REL.filter(([,re])=>re.test(s)).map(([k])=>k); }

function lint(text,P,rung){
  const errs=[], E=(code,msg,tok)=>errs.push(tok?{code,msg,tok}:{code,msg});
  const s=strip(text).trim(); rung=rung==null?0:rung;
  if(!s) E('EMPTY','пустая реплика');
  if(s.length>MAXLEN) E('LEN','длиннее '+MAXLEN+' символов ('+s.length+')');
  const S=sentences(s), Qs=S.filter(x=>/\?\s*$/.test(x)); if(Qs.length>1) E('Q2','больше одного вопроса ('+Qs.length+')');
  if(/понятно\s*\?|ясно\s*\?/i.test(s)) E('ASK','вопрос «понятно?» не проверяет понимание');
  if(/умниц|гени[йя]|молодец|ты\s+(очень\s+)?(умн|талантлив)/i.test(s)) E('PRAISE','хвалить действие, а не человека');
  if(/\bмм\b|°|градус|сантиметр|миллиметр/i.test(s)) E('UNIT','единицы измерения — признак числа ответа');
  if(/\d+[.,]\d+/.test(s)) E('NUM','дробное число');
  const D=dict(P), ok=allowedAt(P,rung), ents=new Set(P.entities||[]);
  const T=tokens(s,P);
  T.forEach(t=>{
    if(t.kind==='num'){ if(!(ents.has(t.t)&&!D.secret.has(t.t)&&ok.has(t.t))) E('NUM','число «'+t.t+'»',t.t); return; }
    if(t.kind==='unk'){ E('LABEL','метки «'+t.t+'» нет в словаре шага',t.t); return; }
    if(D.secret.has(t.t)&&rung<4){ E('SECRET','секрет шага «'+t.t+'» до Р4',t.t); return; }
    if(!ok.has(t.t)&&rung<4) E('RUNG','«'+t.t+'» не разрешена на Р'+rung,t.t); });
  /* отношения: утверждение с метками — только из разрешённых фактов этой ступени */
  const facts=(P.facts||[]).filter(f=>f.verified&&(f.rung==null||f.rung<=rung));
  S.forEach(x=>{ const q=/\?\s*$/.test(x), rs=relsOf(x);
    const labs=tokens(x,P).filter(t=>t.kind==='label'&&!GENERAL.includes(t.t)).map(t=>t.t);
    if(!rs.length&&!q) return;
    if(q){ if(/(^|\s)(правда\s+ли|верно\s+ли|так\s+ли|не\s+так\s+ли|ведь|да\s+или\s+нет)|(^|\s)не\s+[А-Яа-яЁё]+\s+ли(\s|$|\?)/i.test(x)&&labs.length) E('YESNO','да/нет-вопрос о гипотезе: «'+x.slice(0,60)+'»'); return; }
    if(!labs.length) return;   /* общее правило без меток («прямой угол проецируется без искажения, если…») — приём, не утверждение о чертеже */
    rs.forEach(r=>{ const cover=new Set(facts.filter(f=>f.rel===r).flatMap(f=>f.args.flatMap(a=>[a,a.replace(/[′″‴]+$/,'')].concat(tokens(a,P).filter(t=>t.kind==='label').map(t=>t.t))))); const miss=labs.filter(l=>!cover.has(l));
      if(miss.length) E('REL','утверждение «'+r+'» о '+miss.join(', ')+' не подтверждено фактом ядра'); }); });
  return {ok:!errs.length,errors:errs};
}
const TUTOR_LINT={lint,tokens,sentences,relsOf,REL,GENERAL,MAXLEN};
if(typeof module!=='undefined'&&module.exports) module.exports=TUTOR_LINT; else self.TUTOR_LINT=TUTOR_LINT;
})();
