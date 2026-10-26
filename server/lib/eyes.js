/* Глаза сканера: фото чертежа → модель со зрением → подписи точек условия (JSON). Меряет и выносит вердикт не она,
   а сканер в браузере (lab/dz/eyes.js): по её подсказке он находит точки на линиях с точностью до долей мм.
   Модель — любая с OpenAI-совместимым /chat/completions и картинками (image_url). По умолчанию — Yandex AI Studio:
   ключ не нужен, функция ходит с IAM-токеном своего сервисного аккаунта (роль ai.languageModels.user).
     EYES_URL    — адрес /chat/completions (по умолчанию Yandex AI Studio)
     EYES_MODEL  — модель; {folder} заменяется на каталог (по умолчанию gpt://{folder}/qwen2.5-vl-32b-instruct)
     EYES_FOLDER — каталог Yandex Cloud (по умолчанию — каталог функции)
     EYES_KEY    — ключ API, если модель не в Yandex Cloud (тогда Authorization: Bearer <ключ>); EYES_AUTH=Api-Key — «Api-Key <ключ>»
   Фото никуда не сохраняется: только запрос к модели. */
'use strict';
const DEF_URL='https://llm.api.cloud.yandex.net/v1/chat/completions', DEF_MODEL='gpt://{folder}/qwen2.5-vl-32b-instruct';

const PROMPT=`Ты — глаза сканера домашних заданий по начертательной геометрии (эпюр Монжа). Ничего не оценивай и не решай —
только найди на фото подписанные точки ЗАДАННОЙ фигуры (условия задачи) и скажи, где они.
На фото — лист ДЗ или один его чертёж крупно. ДЗ №2: пирамида, призма или куб — заданы точки из таблицы варианта
(A, B, C, E, F, K). ДЗ №3: пирамида SABC (точки A, B, C, S); на одном листе обычно четыре чертежа — 1) высота пирамиды,
2) угол между гранью SAB и основанием, 3) истинный вид основания ABC, 4) угол между ребром SA и основанием.
Для КАЖДОГО отдельного чертежа (у каждого своя ось x и своя копия заданной фигуры) верни:
- part: для ДЗ №3 — какая это часть (1, 2, 3 или 4), если понятно по построению или подписи; иначе null;
- box: прямоугольник чертежа в пикселях фото [x0, y0, x1, y1];
- pts: точки заданной фигуры и начало координат, в пикселях фото (x вправо, y вниз, начало — левый верхний угол):
  "A''", "B''" … — фронтальные проекции (над осью x), "A'", "B'" … — горизонтальные (под осью x), "O" — пересечение
  оси x с осью z/y. Координата — сама точка (кружок или место, где сходятся рёбра), а не буква подписи.
Не выдумывай: если точку не видно или подпись не читается — не включай её. Точки построения (A1, A4, B1', 1', 3'' и т. п.)
и точки ответа не включай. Если на листе написан номер варианта — верни его в n.
Ответ — только JSON без пояснений:
{"dz": 3, "n": 7, "drawings": [{"part": 4, "box": [x0, y0, x1, y1], "pts": {"A''": [x, y], "A'": [x, y], "O": [x, y]}}]}`;

function eyesFromEnv(env){ env=env||process.env; const folder=env.EYES_FOLDER||env.YC_FOLDER_ID||'';
  const model=(env.EYES_MODEL||DEF_MODEL).replace('{folder}',folder), url=env.EYES_URL||DEF_URL, yandex=/\.yandex\.net\//.test(url);
  return {url,model,folder,key:env.EYES_KEY||'',auth:env.EYES_AUTH||'Bearer',yandex,opts:opts(env.EYES_OPTS),on:env.EYES!=='off'&&!!(env.EYES_KEY||yandex&&folder)}; }
/* EYES_OPTS — добавки к запросу модели (например, выключить рассуждение), JSON или base64 от JSON: в переменных функции
   Yandex Cloud запятая разделяет сами переменные, поэтому развёртывание пишет base64 */
function opts(v){ v=String(v||'').trim(); if(!v) return {}; try{ const o=JSON.parse(v[0]==='{'?v:Buffer.from(v,'base64').toString('utf8')); return o&&typeof o==='object'&&!Array.isArray(o)?o:{}; }catch(e){ return {}; } }
/* последний JSON-объект с drawings в тексте (ответ модели с рассуждением иногда остаётся только в ходе мысли) */
function lastJson(t){ t=String(t||''); for(let b=t.lastIndexOf('}');b>0;b=t.lastIndexOf('}',b-1))
  for(let a=t.lastIndexOf('{',b);a>=0;a=t.lastIndexOf('{',a-1)){ try{ const o=JSON.parse(t.slice(a,b+1)); if(o&&Array.isArray(o.drawings)) return t.slice(a,b+1); }catch(e){} if(b-a>20000) break; }
  return ''; }

/* ask(cfg, {image: 'data:image/jpeg;base64,…', w, h, dz, n}, {fetch, token}) → {text, model} */
async function ask(cfg,q,o){ o=o||{}; const http=o.fetch||((...a)=>fetch(...a));
  const key=cfg.key||(o.token&&o.token()||''); if(!key) throw Object.assign(new Error('ИИ-зрение не настроено: нет ключа модели.'),{status:503});
  const headers={'content-type':'application/json',authorization:(cfg.key?cfg.auth:'Bearer')+' '+key};
  if(cfg.yandex&&cfg.folder) headers['x-folder-id']=cfg.folder;
  const hint=(q.dz?'ДЗ №'+q.dz+'. ':'')+(q.n?'Вариант '+q.n+'. ':'')+'Размер фото: '+q.w+' × '+q.h+' px.';
  const body=Object.assign({model:cfg.model,temperature:0,max_tokens:1500,messages:[{role:'system',content:q.system||PROMPT},
    {role:'user',content:[{type:'text',text:q.text||hint},{type:'image_url',image_url:{url:q.image}}]}]},cfg.opts||{},q.opts||{});
  const t0=Date.now(), r=await http(cfg.url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(o.timeout||45000)});
  const t=await r.text(); let j=null; try{ j=JSON.parse(t); }catch(e){}
  if(!r.ok) throw Object.assign(new Error('Модель зрения ответила ошибкой '+r.status+(j&&j.error?': '+String(j.error.message||j.error).slice(0,200):'')),{status:502});
  /* модели с рассуждением (Qwen3.x) возвращают ход мысли в <think>…</think> или отдельным полем — сканеру нужен только ответ;
     если на ответ не хватило лимита, JSON бывает только в ходе мысли */
  const c=j&&j.choices&&j.choices[0]||{}, m=c.message||{}, raw=m.content, think=String(m.reasoning_content||m.reasoning||'');
  let text=typeof raw==='string'?raw.replace(/<think>[\s\S]*?(<\/think>|$)/g,'').trim():'';
  if(!text) text=lastJson(think)||lastJson(typeof raw==='string'?raw:'');
  const info={finish:c.finish_reason||null,ms:Date.now()-t0,think:think.length+(typeof raw==='string'&&/<think>/.test(raw)?raw.length:0),usage:j&&j.usage||null};
  if(!text) throw Object.assign(new Error('Модель зрения вернула пустой ответ'+(info.finish==='length'?': не уложилась в лимит ответа (рассуждала '+info.think+' знаков)':'')+'.'),{status:502,info});
  return {text,model:cfg.model,info}; }

/* какая модель зрения в каталоге видит картинку: развёртывание (server/tools/deploy.js) пробует по очереди и подключает первую.
   Не все модели AI Studio есть в синхронном режиме (на остальные Yandex отвечает 400/403), а текстовая модель может ответить
   и без картинки — поэтому пробное фото с вопросом, на который без зрения не ответить: сколько на нём закрашенных кругов */
const CANDIDATES=['qwen3.6-35b-a3b/latest','aliceai-llm/latest','gemma-3-27b-it/latest','qwen2.5-vl-32b-instruct/latest'];
const PROBE={system:'Посмотри на картинку и ответь одним числом, без слов.',text:'Сколько чёрных закрашенных кругов на картинке?'};
/* pick(env, {image, count}, {fetch, token, more:[адреса моделей из списка каталога]}) → {model (адрес или null), tried:[{model, error}]};
   env.EYES_MODEL задан — пробуется только он */
async function pick(env,probe,o){ o=o||{}; const tried=[], seen=new Set();
  const models=env.EYES_MODEL?[env.EYES_MODEL]:CANDIDATES.map(m=>'gpt://{folder}/'+m).concat(o.more||[]);
  for(const m of models){ const cfg=eyesFromEnv(Object.assign({},env,{EYES_MODEL:m})); if(seen.has(cfg.model)) continue; seen.add(cfg.model);
    try{ const r=await ask(cfg,Object.assign({image:probe.image,w:256,h:256},PROBE),o), a=String(r.text);
      if(new RegExp('(^|\\D)'+probe.count+'(\\D|$)').test(a)) return {model:cfg.model,tried};
      tried.push({model:cfg.model,error:'не видит картинку: на «сколько кругов» ответила «'+a.slice(0,60)+'», а их '+probe.count}); }
    catch(e){ tried.push({model:cfg.model,error:e.message}); } }
  return {model:null,tried}; }

/* настройка запроса для выбранной модели: настоящий запрос сканера (полный PROMPT) с разными добавками, из тех, что вернули
   JSON, — самая быстрая. Модель с рассуждением без добавок может потратить весь лимит на ход мысли и вернуть пустой ответ */
const VARIANTS=[['без добавок',{}],['рассуждение выключено',{chat_template_kwargs:{enable_thinking:false}}],['рассуждение коротко',{reasoning_effort:'low'}],
  ['рассуждение выключено (2)',{reasoning_effort:'none'}],['лимит ответа больше',{max_tokens:8000}]];
async function tune(env,image,o){ const cfg=eyesFromEnv(env), res=[];
  for(const [name,add] of VARIANTS){ const t0=Date.now();
    try{ const r=await ask(cfg,{image,w:256,h:256,dz:3,opts:add},Object.assign({},o,{timeout:o&&o.timeout||45000}));
      let okJson=false; try{ okJson=Array.isArray(JSON.parse(r.text.slice(r.text.indexOf('{'),r.text.lastIndexOf('}')+1)).drawings); }catch(e){}
      res.push({name,opts:add,ok:okJson,ms:r.info.ms,think:r.info.think,note:(okJson?'JSON':'не JSON: «'+r.text.slice(0,50)+'»')+', конец: '+r.info.finish+', рассуждение: '+r.info.think+' зн.'}); }
    catch(e){ res.push({name,opts:add,ok:false,ms:Date.now()-t0,note:e.message.slice(0,160)}); } }
  const good=res.filter(x=>x.ok).sort((a,b)=>a.ms-b.ms)[0]||null;
  /* модель всё же рассуждает — на настоящем фото рассуждение длиннее пробного: лимит ответа с запасом */
  const best=good&&good.think>0?Object.assign({},good,{opts:Object.assign({max_tokens:8000},good.opts)}):good;
  return {best,results:res}; }

module.exports={eyesFromEnv,ask,pick,tune,lastJson,PROMPT,DEF_URL,DEF_MODEL,CANDIDATES,VARIANTS};
