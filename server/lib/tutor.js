/* ИИ-наставник на сервере (docs/TUTOR.md): вопрос студента о шаге задачи → модель Claude с инструментами → ответ,
   каждое утверждение которого о чертеже проверено геометрическим ядром (kernel/tutor-core.js — тот же файл, что в браузере).
   Модель говорит, ядро решает:
     • verify — модель спрашивает у ядра отношения на чертеже (на одной линии связи, лежит на, выше, ближе, ∥, ⟂…);
     • reply  — её ответ: фраза, вопрос, кнопки-варианты, действия на чертеже и утверждения (claims). Ядро проверяет всё:
       неверное утверждение, несуществующая точка или недопустимое действие → ответ возвращается модели с ошибкой,
       и она исправляет его (до 4 обращений). Студент видит только прошедшее проверку.
   Модель — через ProxyAPI (оплата в рублях, ключ PROXYAPI_KEY уже есть у сканера), родной Messages API Anthropic:
   https://api.proxyapi.ru/anthropic/v1/messages. Зависимостей нет — запрос обычным fetch.
     TUTOR=off             — выключить
     TUTOR_MODEL           — модель наставника (по умолчанию claude-opus-5-5)
     TUTOR_FAST_MODEL      — короткие ответы студента на вопрос наставника (по умолчанию claude-haiku-5-5)
     TUTOR_EFFORT          — глубина рассуждения: low (по умолчанию) | medium | high
     TUTOR_DAILY           — вопросов в день на студента (по умолчанию 40)
     TUTOR_DAY_USD         — бюджет на всех в день, $ (по умолчанию 15); превышен — наставник отвечает только подсказками ядра
     TUTOR_URL, TUTOR_KEY  — другой адрес и ключ (по умолчанию ProxyAPI и PROXYAPI_KEY)
   Ничего не хранится: ни вопрос, ни ответ (в журнал — только модель, число обращений, цена). */
'use strict';
const CORE=require('../../kernel/tutor-core.js');
const PX='https://api.proxyapi.ru/anthropic/v1/messages';
/* $ за 1 млн токенов: вход, выход (чтение кэша — 0,1 от входа, запись — 1,25) */
const PRICE={'claude-opus-5-5':[4,20],'claude-sonnet-5-5':[2,10],'claude-haiku-5-5':[0.1,0.5],'claude-fable-5-2':[8,40]};

function tutorFromEnv(env){ env=env||process.env; const key=env.TUTOR_KEY||env.PROXYAPI_KEY||'';
  return {on:env.TUTOR!=='off'&&!!key,url:env.TUTOR_URL||PX,key,model:env.TUTOR_MODEL||'claude-opus-5-5',fast:env.TUTOR_FAST_MODEL||'claude-haiku-5-5',
    effort:['low','medium','high'].includes(env.TUTOR_EFFORT)?env.TUTOR_EFFORT:'low',daily:+env.TUTOR_DAILY||40,dayUsd:+env.TUTOR_DAY_USD||15}; }

function cost(model,u){ const p=PRICE[model]||PRICE['claude-opus-5-5']; if(!u) return 0;
  return ((u.input_tokens||0)*p[0]+(u.cache_read_input_tokens||0)*p[0]*0.1+(u.cache_creation_input_tokens||0)*p[0]*1.25+(u.output_tokens||0)*p[1])/1e6; }

/* снимок шага пришёл из браузера: проверяем форму, чтобы ядро не упало на мусоре */
function clean(M){ if(!M||typeof M!=='object'||M.v!==1||typeof M.pts!=='object'||typeof M.lines!=='object'||typeof M.groups!=='object'||!Array.isArray(M.items)||!Array.isArray(M.steps)) return null;
  const okXY=q=>Array.isArray(q)&&q.length===2&&q.every(Number.isFinite);
  for(const p of Object.values(M.pts)) if(!p||!okXY(p.xy)) return null;
  if(!Number.isFinite(M.tol)||M.tol<=0||M.tol>10) return null;
  if(!Number.isInteger(M.k)||M.k<0||M.k>M.steps.length) return null;
  return M; }

const short=s=>String(s||'').replace(/\s+/g,' ').trim();
/* сообщение «Чертёж» — одно на шаг (кэшируется), затем разговор и вопрос */
function userContent(M,q){ const f=CORE.facts(M), hist=(Array.isArray(q.history)?q.history:[]).slice(-8)
    .map(h=>(h&&h.role==='assistant'?'Наставник: ':'Студент: ')+short(h&&h.text).slice(0,500)).filter(x=>x.length>12);
  return [{type:'text',text:'Чертёж (данные ядра сайта, это истина):\n'+JSON.stringify(f),cache_control:{type:'ephemeral'}},
    {type:'text',text:(hist.length?'Разговор до этого:\n'+hist.join('\n')+'\n\n':'')+'Ступень лестницы подсказок сейчас: '+(q.level|0)+'.\nСтудент: '+short(q.q).slice(0,600)}]; }

/* сбой шлюза (5xx, 529 — перегрузка) — ещё одна попытка */
async function call(cfg,model,body,o){ try{ return await call1(cfg,model,body,o); }catch(e){ if(!(e.upstream>=500)) throw e; await new Promise(r=>setTimeout(r,o.retryMs==null?800:o.retryMs)); return call1(cfg,model,body,o); } }
async function call1(cfg,model,body,o){ const http=o.fetch||((...a)=>fetch(...a));
  const r=await http(cfg.url,{method:'POST',headers:{'content-type':'application/json','anthropic-version':'2023-06-01','x-api-key':cfg.key,authorization:'Bearer '+cfg.key},
    body:JSON.stringify(Object.assign({model},body)),signal:AbortSignal.timeout(o.timeout||40000)});
  const t=await r.text(); let j=null; try{ j=JSON.parse(t); }catch(e){}
  if(!r.ok){ const why=j&&j.error&&(j.error.message||j.error); throw Object.assign(new Error('Модель ответила ошибкой '+r.status+(why?': '+String(why).slice(0,200):'')),{status:502,upstream:r.status}); }
  if(!j||!Array.isArray(j.content)) throw Object.assign(new Error('Модель вернула не то.'),{status:502});
  return j; }

/* ask(cfg, {ctx, q, history, level}, {fetch}) → {say, ask, options, show, claims, misconception, level, author, model, calls, fixed, usd} */
async function ask(cfg,q,o){ o=o||{}; const M=clean(q.ctx); if(!M) throw Object.assign(new Error('Не тот снимок шага.'),{status:400});
  const text=short(q.q); if(!text) throw Object.assign(new Error('Пустой вопрос.'),{status:400});
  const hist=Array.isArray(q.history)?q.history:[], last=hist[hist.length-1];
  /* короткий ответ на вопрос наставника — быстрой моделью; объяснение — сильной */
  const model=text.length<=40&&last&&last.role==='assistant'&&/\?/.test(String(last.text||''))&&cfg.fast?cfg.fast:cfg.model;
  const tools=CORE.TOOLS.map((t,i,a)=>i===a.length-1?Object.assign({},t,{cache_control:{type:'ephemeral'}}):t);
  const base={max_tokens:4000,system:[{type:'text',text:CORE.SYSTEM,cache_control:{type:'ephemeral'}}],tools,tool_choice:{type:'auto'},output_config:{effort:cfg.effort}};
  const messages=[{role:'user',content:userContent(M,q)}];
  let usd=0, fixed=0, calls=0;
  for(let round=0;round<4;round++){ const j=await call(cfg,model,Object.assign({messages},base),o); calls++; usd+=cost(model,j.usage);
    if(j.stop_reason==='refusal') break;
    const uses=j.content.filter(b=>b.type==='tool_use'), results=[]; let done=null;
    for(const u of uses){ const inp=u.input||{};
      if(u.name==='verify'){ const res=(Array.isArray(inp.claims)?inp.claims:[]).slice(0,10).map(c=>CORE.verify(M,c)); results.push({type:'tool_result',tool_use_id:u.id,content:JSON.stringify(res)}); continue; }
      if(u.name==='reply'){ const v=CORE.reply(M,inp);
        if(v.ok&&!done){ done=v.reply; results.push({type:'tool_result',tool_use_id:u.id,content:'показано'}); }
        else { if(!v.ok) fixed++; results.push({type:'tool_result',tool_use_id:u.id,is_error:true,content:'Ядро не пропустило ответ: '+v.errors.join('; ')+'. Исправь и вызови reply снова.'}); }
        continue; }
      results.push({type:'tool_result',tool_use_id:u.id,is_error:true,content:'нет такого инструмента'}); }
    if(done) return Object.assign(done,{model,calls,fixed,usd});
    if(!uses.length){ /* ответила текстом без reply: тоже через ядро */
      const t=j.content.filter(b=>b.type==='text').map(b=>b.text).join(' ').trim(); const v=CORE.reply(M,{say:t});
      if(t&&v.ok&&round>0) return Object.assign(v.reply,{model,calls,fixed,usd});
      messages.push({role:'assistant',content:j.content},{role:'user',content:[{type:'text',text:'Ответь студенту инструментом reply.'+(v.ok?'':' Ядро: '+v.errors.join('; '))}]}); continue; }
    messages.push({role:'assistant',content:j.content},{role:'user',content:results}); }
  /* модель не уложилась — подсказка ядра, честно помеченная */
  const L=CORE.ladder(M,Math.min(4,(q.level|0)+1));
  return {say:L.say,ask:L.ask,options:[],show:L.show,claims:[],misconception:'',level:L.level,author:true,model:'ядро',calls,fixed,usd}; }

module.exports={tutorFromEnv,ask,cost,clean,userContent,PX,PRICE};
