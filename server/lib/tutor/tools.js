/* Наставник: инструменты агента. Каждый — выборка из знаний ядра (pack.js) через лесенку (policy.js) или действие:
   показать на чертеже, посмотреть фото, запомнить, передать автору. Всё, что инструмент вернул студенту-видимого
   (числа шага, открытого лесенкой), становится «фактом» — сверщик пропускает в ответе только факты.
   exec(name, args, ctx) → результат (JSON); ctx = {dz, n, mem, turn:{asked, facts, actions, tools, notes}, see, askAuthor} */
'use strict';
const P=require('./pack'), POL=require('./policy'), VF=require('./verify');

const fn=(name,description,properties,required)=>({type:'function',function:{name,description,parameters:{type:'object',properties:properties||{},required:required||[],additionalProperties:false}}});
const DEFS=[
  fn('variant_overview','Вариант студента: задание, подзадачи, список шагов (номер, название, сколько точек), ответ варианта (если открыт). Шаги уже есть в карточке — вызывай, когда нужны подзадачи или ответ.'),
  fn('get_step','Содержимое шага решения. depth: idea — какое правило работает; short — что делать на шаге; full — подробно, с точками и координатами. Сервер отдаёт не больше, чем открыто лесенкой (тогда denied: true и allowed).',
    {k:{type:'integer',description:'номер шага'},depth:{type:'string',enum:['idea','short','full']}},['k','depth']),
  fn('get_points','Точки по номерам или именам (9, A, K, A₁): на каком шаге строятся и каким способом; координаты — только если этот шаг открыт до full.',
    {nums:{type:'array',items:{type:['integer','string']},maxItems:20}},['nums']),
  fn('explain_method','Правило из методики ДЗ. topic: plan — идея и порядок решения (для ДЗ по начерту — по типу варианта студента); sheet — оформление листа. Только ИГ №4: edge — точка на ребре; T — на поверхности ⟂ π₁; L — на грани ⟂ π₃; P — через параллель; vis — смена видимости; section — разрезы; dims — размеры.',
    {topic:{type:'string',enum:['edge','T','L','P','vis','section','dims','sheet','plan']}},['topic']),
  fn('common_mistakes','Типичные ошибки этого ДЗ (с метками m1…) и самопроверка.'),
  fn('defense_questions','Вопросы защиты ДЗ с ответами — для подготовки к сдаче.'),
  fn('show_on_drawing','Показать студенту на чертеже: открыть шаг k плеера решения и подсветить точки. Шаг — если открыт хотя бы до short; точки — если до full.',
    {k:{type:'integer'},points:{type:'array',items:{type:['integer','string']},maxItems:24}},['k']),
  fn('look_at_photo','Сравнить фото листа студента (приложено к этому сообщению) с эталоном решения: расхождения с номерами точек.',
    {focus:{type:'string',description:'на что смотреть особенно (необязательно)'}}),
  fn('remember','Запомнить трудность студента на будущее: tag — метка ошибки из common_mistakes (m1…) или other; note — коротко.',
    {tag:{type:'string'},note:{type:'string',maxLength:140}},['tag','note']),
  fn('ask_author','Передать вопрос автору курса (человеку) — только если студент согласился. summary — суть вопроса и что уже обсудили.',
    {summary:{type:'string',maxLength:600}},['summary'])
];
const NAMES=DEFS.map(d=>d.function.name);

/* числа содержимого шага — факты (без служебных номеров k, n) */
function factsOfStep(o){ const f=[]; ['idea','short','more'].forEach(k=>{ if(o[k]) VF.numbersOf(o[k],f); });
  (o.points||[]).forEach(p=>VF.numbersOf([p.x,p.y,p.z],f)); return f; }

/* номер или имя точки из ответа модели → ключ реестра: «9» → 9; «A1», «A₁′» → «A₁» */
const SUB='₀₁₂₃₄₅₆₇₈₉';
function ptKey(x){ const t=String(x==null?'':x).trim().replace(/[″′‴'"]+/g,''); if(/^\d+$/.test(t)) return +t;
  return t.replace(/^([A-ZА-Яa-zа-я])(\d+)$/,(m,a,d)=>a.toUpperCase()+d.replace(/\d/g,c=>SUB[c])); }
const clampK=(ctx,k)=>{ const v=P.variant(ctx.dz,ctx.n); k=Math.round(+k); return v&&k>=1&&k<=v.steps.length?k:0; };

const H={
  variant_overview(a,ctx){ const o=P.overview(ctx.dz,ctx.n); VF.numbersOf(o.task,ctx.turn.facts); if(o.note) VF.numbersOf(o.note,ctx.turn.facts);
    const r=Object.assign({},o,{student_step:ctx.step||null,mode:ctx.mem.mode,ladder:POL.ladder(ctx.mem,o.steps).map(x=>x.k+':'+x.allowed).join(' ')});
    if(o.parts) VF.numbersOf(o.parts,ctx.turn.facts);
    /* ответ варианта — в «Разборе» или когда последний шаг уже открыт до full */
    const ans=P.answer(ctx.dz,ctx.n), last=o.steps.length;
    if(ans&&(ctx.mem.mode==='explain'||((ctx.mem.open||{})[last]||0)>=3)){ r.answer=ans; VF.numbersOf(ans,ctx.turn.facts); }
    else if(ans) r.answer='закрыто лесенкой: откроется в «Разборе» или после последнего шага';
    return r; },

  get_step(a,ctx){ const k=clampK(ctx,a.k); if(!k) return {error:'Нет такого шага. Шаги: 1–'+P.variant(ctx.dz,ctx.n).steps.length};
    POL.ask(ctx.mem,ctx.turn,k);
    const want=POL.depthIx(a.depth||'short'), can=POL.allowed(ctx.mem,k), d=Math.min(want,can), o=P.stepAt(ctx.dz,ctx.n,k,POL.depthName(d));
    POL.open(ctx.mem,k,d); ctx.turn.facts.push(...factsOfStep(o));
    if(want>can) Object.assign(o,{denied:true,allowed:POL.depthName(can),why:'Лесенка: студент ещё не пробовал сам. Дай наводку по тому, что открыто, и попроси попробовать (или прислать фото листа). Глубже откроется на следующей просьбе.'});
    return o; },

  get_points(a,ctx){ const R=P.registry(ctx.dz,ctx.n), out=[];
    (Array.isArray(a.nums)?a.nums:[]).slice(0,20).forEach(n=>{ const p=R.get(ptKey(n)); if(!p){ out.push({n,error:'нет такой точки в варианте'}); return; }
      const o={n:p.n,step:p.k,how:p.how,how_name:P.HOW_NAME[p.how]||null};
      if(POL.allowed(ctx.mem,p.k)>=3){ if(p.x!=null){ Object.assign(o,{x:p.x,y:p.y,z:p.z}); ctx.turn.facts.push(...VF.numbersOf([p.x,p.y,p.z])); } else o.coords='координаты этой точки в решении не записаны — бери из get_step(full)'; POL.open(ctx.mem,p.k,3); }
      else o.coords='закрыто лесенкой: шаг '+p.k+' ещё не открыт до full';
      out.push(o); });
    return {points:out}; },

  explain_method(a,ctx){ const r=P.method(ctx.dz,String(a.topic||'plan'),ctx.n); VF.numbersOf(r,ctx.turn.facts); return r; },
  common_mistakes(a,ctx){ const r=P.mistakes(ctx.dz,ctx.n); VF.numbersOf(r,ctx.turn.facts); return r; },
  defense_questions(a,ctx){ const r={questions:P.defense(ctx.dz,ctx.n)}; VF.numbersOf(r,ctx.turn.facts); return r; },

  show_on_drawing(a,ctx){ const k=clampK(ctx,a.k); if(!k) return {error:'Нет такого шага.'};
    const can=POL.allowed(ctx.mem,k); if(can<2) return {denied:true,why:'Шаг ещё закрыт лесенкой: сначала возьми его через get_step (short).'};
    const R=P.registry(ctx.dz,ctx.n), pts=(Array.isArray(a.points)?a.points:[]).map(ptKey).filter(n=>R.has(n)).slice(0,24);
    const shown=can>=3?pts:[]; POL.open(ctx.mem,k,Math.max(2,(ctx.mem.open&&ctx.mem.open[k])||0));
    ctx.turn.actions=ctx.turn.actions.filter(x=>x.t!=='show').concat([showAction(ctx.dz,ctx.n,k,shown)]);
    return {ok:true,step:k,highlighted:shown,note:pts.length&&!shown.length?'точки не подсвечены: шаг открыт только до short':undefined}; },

  async look_at_photo(a,ctx){ if(!ctx.photo) return {error:'К этому сообщению фото не приложено. Попроси студента нажать 📷 и прислать фото листа.'};
    if(!ctx.see) return {error:'Глаза не подключены.'};
    let r; try{ r=await ctx.see(String(a.focus||'').slice(0,200)); }catch(e){ return {error:'Не получилось посмотреть фото: '+String(e&&e.message||e).slice(0,160)}; }
    const R=P.registry(ctx.dz,ctx.n), found=(r.findings||[]).slice(0,12), ok=[], dropped=[];
    found.forEach(f=>{ const pt=f&&f.point!=null&&f.point!==''?ptKey(f.point):null; if(pt!=null&&!R.has(pt)){ dropped.push(pt); return; }
      ok.push({point:pt,view:['front','top','left','section','dims','other'].includes(f.view)?f.view:'other',problem:String(f.problem||'').slice(0,200)}); });
    ctx.mem.photo=true; ctx.turn.photoLooked=true;
    return {readable:r.readable!==false,findings:ok,overall:String(r.overall||'').slice(0,240),dropped:dropped.length?'отброшены находки с номерами точек, которых нет в варианте: '+dropped.join(', '):undefined}; },

  remember(a,ctx){ if((ctx.turn.notes||0)>=3) return {ok:false,why:'не больше 3 заметок за ответ'}; ctx.turn.notes=(ctx.turn.notes||0)+1;
    const tags=P.mistakeTags(ctx.dz,ctx.n), tag=tags.includes(a.tag)?a.tag:'other', note=String(a.note||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,140);
    const m=ctx.mem; m.mistakes=m.mistakes||{}; m.mistakes[tag]=(m.mistakes[tag]||0)+1; if(note){ m.notes=(m.notes||[]).concat([note]).slice(-12); }
    return {ok:true}; },

  async ask_author(a,ctx){ if(!ctx.askAuthor) return {error:'Передача автору недоступна.'}; if(ctx.turn.asked_author) return {ok:true,already:true};
    const s=String(a.summary||'').trim().slice(0,600); if(s.length<10) return {error:'Опиши вопрос подробнее.'};
    const id=await ctx.askAuthor(s); ctx.turn.asked_author=true; ctx.turn.actions.push({t:'ask',id}); return {ok:true,thread:id,note:'Вопрос передан автору; ответ придёт на сайте во «Вопросах».'}; }
};

async function exec(name,args,ctx){ ctx.turn.tools.push(name); if(!H[name]) return {error:'Нет такого инструмента: '+name};
  try{ return await H[name](args&&typeof args==='object'?args:{},ctx); }catch(e){ return {error:'Инструмент не сработал: '+String(e&&e.message||e).slice(0,160)}; } }

/* действие «показать на чертеже»: шаг k по порядку; у ДЗ по начерту с подзадачами — ещё id шага «p2s3» (подзадача 2, шаг 3 в ней) */
function showAction(dz,n,k,points){ const v=P.variant(dz,n), st=v&&v.steps[k-1], a={t:'show',step:k,points:points||[]};
  if(P.isNg(dz)&&st) a.id=st.id; return a; }

module.exports={DEFS,NAMES,exec,factsOfStep,ptKey,showAction};
