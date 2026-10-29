/* Глаза сканера: фото чертежа → модель со зрением → подписи точек условия (JSON). Меряет и выносит вердикт не она,
   а сканер в браузере (lab/dz/eyes.js): по её подсказке он находит точки на линиях с точностью до долей мм.
   Модель — любая с OpenAI-совместимым /chat/completions и картинками (image_url). По умолчанию — Yandex AI Studio:
   ключ не нужен, функция ходит с IAM-токеном своего сервисного аккаунта (роль ai.languageModels.user).
     EYES_URL    — адрес /chat/completions (по умолчанию Yandex AI Studio)
     EYES_MODEL  — модель; {folder} заменяется на каталог (по умолчанию gpt://{folder}/qwen2.5-vl-32b-instruct)
     EYES_FOLDER — каталог Yandex Cloud (по умолчанию — каталог функции)
     EYES_KEY    — ключ API, если модель не в Yandex Cloud (тогда Authorization: Bearer <ключ>); EYES_AUTH=Api-Key — «Api-Key <ключ>»
     EYES_FOREIGN — 0: модель в России, хоть и не в Yandex Cloud (согласие на отправку за рубеж не нужно); по умолчанию зарубежная — всё, что не Yandex
     PROXYAPI_KEY, EYES_BEST_MODEL — лучшая модель через ProxyAPI (proxyapi.ru, оплата в рублях; модель зарубежная): основная,
                   если студент согласился. Адрес — единый OpenAI-совместимый api.proxyapi.ru/v1/chat/completions, имя модели —
                   с вендором: anthropic/claude-opus-5-5 (имя в духе OpenRouter, anthropic/claude-opus-5.5, тоже принимается)
     EYES_BEST_FOR=admin — лучшая модель только для владельца (тестовый стенд: адрес виден в журналах, баланс ProxyAPI не для всех);
     EYES_BEST_DEFAULT=1 — для тех, кому она доступна, — без отметки «лист мой» (владелец тестирует своими листами)
                   отправить фото; Qwen в Yandex — запасной и без согласия (askAny)
   Фото никуда не сохраняется: только запрос к модели. */
'use strict';
const DEF_URL='https://llm.api.cloud.yandex.net/v1/chat/completions', DEF_MODEL='gpt://{folder}/qwen2.5-vl-32b-instruct', PX_URL='https://api.proxyapi.ru/v1/chat/completions';
/* OpenRouter — только для замеров в lab/dz (ключ OPENROUTER_API_KEY); кабинет ходит к зарубежным моделям через ProxyAPI */
const OR_URL='https://openrouter.ai/api/v1/chat/completions';
/* лучшая модель по замеру (REPORT.md, 7к); EYES_BEST_MODEL — другая, EYES_BEST_MODEL=off — не подключать */
const BEST_MODEL='anthropic/claude-opus-5-5';
/* оцифровка чертежа целиком (mode: 'digit'): модель выписывает точки, отрезки и записанные ответы, мозг сканера проверяет
   по ним (lab/dz/eyes.js prepareDigit). Замер 7м: Sonnet 5.5 — точки ≈ 0,4 мм, линии 91–100 % в 1 мм, $0,01 за чертёж.
   EYES_DIGIT_MODEL — другая модель, off — не подключать */
const DIGIT_MODEL='anthropic/claude-sonnet-5-5';
const DIGIT_PROMPT=`Ты — оцифровщик чертежей. На фото — лист ДЗ №3 по начертательной геометрии (эпюр Монжа, пирамида SABC): один
или несколько отдельных чертежей, у каждого своя ось x и своя копия пирамиды. Лист может быть повёрнут. Координаты — в пикселях
ЭТОГО фото: начало — левый верхний угол, x вправо, y вниз, целые числа. Ничего не оценивай — только перепиши, что начерчено.
Выпиши построчно, без пояснений и без markdown, для КАЖДОГО чертежа:
D <часть: 1 — высота (одна замена плоскостей), 2 — угол граней (две замены), 3 — истинный вид ABC (вращение вокруг h или f),
  4 — угол SA с основанием (вращение плоскости); 0 — только условие или не понять> — строка начинает чертёж;
T <x> <y> <текст> — каждая записанная надпись этого чертежа как написано (H=28, φ=25°, h″∥X, n′⊥h′ …);
P <подпись> <x> <y> — каждая подписанная точка: подпись как на чертеже (A″, B′, S₄, A₀, 1″ …) и где сама точка, не текст;
S <x1> <y1> <x2> <y2> — каждый прямой отрезок чертежа от конца до конца: рёбра, оси, тонкие линии связи и построения;
  штриховой (невидимый) — с буквой d в конце: S <x1> <y1> <x2> <y2> d. Отрезок, прерванный точкой, можно дать одним.
Дуги, клетки бумаги, рамку и бланк не пиши. Не выдумывай: чего не видно — не пиши.`;   /* замер 29.10 (6 листов): часть опознана 12 из 14, неверно 0, ложных 0, $0,031 за лист */

const PROMPT=`Ты — глаза сканера домашних заданий по начертательной геометрии (эпюр Монжа). Ничего не оценивай и не решай —
только скажи, ГДЕ на фото каждый чертёж и КАКАЯ это часть задания. Всё измеряет и проверяет сканер по линиям.
На фото — лист ДЗ или один его чертёж крупно. ДЗ №3: пирамида SABC (точки A, B, C, S); на листе обычно четыре чертежа,
у каждого своя ось x и своя копия пирамиды. Часть узнаётся по построению:
 1 — высота пирамиды: ЗАМЕНА плоскостей проекций один раз (одна новая ось x₁ или x₁₄; основание ABC в новой проекции —
     отрезок, высота — перпендикуляр из S к нему);
 2 — угол между гранью SAB и основанием: ДВЕ замены (две новые оси, x₁ и x₂ или x₁₄ и x₄₅; ребро AB становится точкой,
     грани — отрезками, угол между ними);
 3 — истинный вид основания ABC: ВРАЩЕНИЕ треугольника вокруг горизонтали или фронтали (линия уровня h или f через
     вершину, дуги/перпендикуляры к ней, повёрнутые точки A₀ B₀ C₀ или A₁ B₁ C₁);
 4 — угол между ребром SA и основанием: ВРАЩЕНИЕ плоскости (дуги из центра вращения, повёрнутые точки S₀ / A₀, угол φ
     у ребра).
Только пирамида без построений (условие) — part: null. ДЗ №2: пирамида, призма или куб — part: null.
Для КАЖДОГО отдельного чертежа верни:
- box: ГЛАВНОЕ — прямоугольник этого чертежа в пикселях фото [x0, y0, x1, y1] (x вправо, y вниз, начало — левый
  верхний угол), плотно: ось x чертежа, обе проекции фигуры и все построения этой части (не весь лист и не соседний чертёж);
- part: 1, 2, 3 или 4 — по построению (или по подписи); не уверен — null. Неверная часть хуже, чем null;
- pts (по желанию): точки заданной фигуры в пикселях фото — "A''", "B''" … фронтальные (над осью x), "A'", "B'" …
  горизонтальные (под осью x), "O" — пересечение оси x с осью z/y. Не выдумывай: не видно — не включай.
Если на листе написан номер варианта — верни его в n.
Ответ — только JSON без пояснений:
{"dz": 3, "n": 7, "drawings": [{"box": [x0, y0, x1, y1], "part": 4, "pts": {"A''": [x, y], "A'": [x, y], "O": [x, y]}}]}`;

function eyesFromEnv(env){ env=env||process.env; const folder=env.EYES_FOLDER||env.YC_FOLDER_ID||'';
  const model=(env.EYES_MODEL||DEF_MODEL).replace('{folder}',folder), url=env.EYES_URL||DEF_URL, yandex=/\.yandex\.net\//.test(url), openrouter=/openrouter\.ai\//.test(url), proxyapi=/proxyapi\.ru\//.test(url);
  const key=env.EYES_KEY||(proxyapi?env.PROXYAPI_KEY:openrouter?env.OPENROUTER_API_KEY:'')||'', m=proxyapi?pxModel(model):model;
  const cfg={url,model:m,folder,key,auth:env.EYES_AUTH||'Bearer',yandex,openrouter,proxyapi,foreign:env.EYES_FOREIGN!=null?env.EYES_FOREIGN!=='0':!yandex,opts:Object.assign(openrouter?orOpts(m):proxyapi?pxOpts(m):{},opts(env.EYES_OPTS)),on:env.EYES!=='off'&&!!(key||yandex&&folder)};
  /* лучшая модель (замер — lab/dz/REPORT.md, 7к) через ProxyAPI: зарубежная — только с согласием на отправку фото
     (askAny); без согласия, без ключа или при сбое — модель выше (Qwen в Yandex AI Studio) */
  const bm=env.EYES_BEST_MODEL===undefined?BEST_MODEL:env.EYES_BEST_MODEL, bk=env.PROXYAPI_KEY||'';
  cfg.best=env.EYES!=='off'&&bm&&bk&&bm!=='off'?eyesFromEnv({EYES_URL:env.EYES_BEST_URL||PX_URL,EYES_MODEL:bm,PROXYAPI_KEY:bk,EYES_OPTS:env.EYES_BEST_OPTS,EYES_BEST_MODEL:'off'}):null;
  cfg.best=cfg.best&&cfg.best.on?cfg.best:null; cfg.on=cfg.on||!!cfg.best;
  /* оцифровщик (зарубежный, ProxyAPI): только с согласием, как лучшая модель */
  const dm=env.EYES_DIGIT_MODEL===undefined?DIGIT_MODEL:env.EYES_DIGIT_MODEL;
  cfg.digit=env.EYES!=='off'&&dm&&bk&&dm!=='off'&&!env.EYES_DIGIT_NESTED?eyesFromEnv({EYES_URL:PX_URL,EYES_MODEL:dm,PROXYAPI_KEY:bk,EYES_BEST_MODEL:'off',EYES_DIGIT_NESTED:'1'}):null;
  cfg.digit=cfg.digit&&cfg.digit.on?cfg.digit:null; cfg.on=cfg.on||!!cfg.digit;
  cfg.bestFor=env.EYES_BEST_FOR==='admin'?'admin':'all'; cfg.bestDefault=env.EYES_BEST_DEFAULT==='1';
  return cfg; }
/* OpenRouter: модели с рассуждением (Gemini 3, GPT-5) — коротко, иначе ответ через минуту; usage.cost — цена запроса */
function orOpts(model){ return Object.assign({max_tokens:8000,usage:{include:true}},/gemini|gpt-5|\/o\d/.test(model)?{reasoning:{effort:'low'}}:{}); }
/* ProxyAPI (OpenAI-совместимый /chat/completions): только стандартные поля OpenAI — рассуждение коротко через reasoning_effort */
function pxOpts(model){ return Object.assign({max_tokens:8000},/gemini|gpt-5|\/o\d/.test(model)?{reasoning_effort:'low'}:{}); }
/* имя модели для ProxyAPI: у Claude версия через дефис (anthropic/claude-opus-5-5), а не через точку, как в OpenRouter */
function pxModel(model){ return /^anthropic\/claude-/.test(model)?model.replace(/(\d)\.(\d)/g,'$1-$2'):model; }
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
  if(cfg.openrouter) headers['x-title']='nachert scanner';   /* только OpenRouter: ProxyAPI заголовок не нужен */
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

/* askAny(cfg, q, o): лучшая модель (cfg.best), если q.consent (фото можно отправить за рубеж) и она есть; сбой — запасная
   (cfg, Qwen в Yandex). 35 с + 22 с — в пределах 60 с функции. Без согласия зарубежная модель не спрашивается никогда → {text, model, info, fallback?} */
async function askAny(cfg,q,o){ o=o||{}; const main=cfg.best&&q.consent?cfg.best:null, spare=cfg.foreign?null:cfg;
  if(main){ try{ return await ask(main,q,Object.assign({},o,{timeout:o.mainTimeout||35000})); }
    catch(e){ if(!spare||!spare.on||!(spare.key||o.token)) throw e; const r=await ask(spare,q,Object.assign({},o,{timeout:22000})); return Object.assign(r,{fallback:main.model+': '+e.message}); } }
  if(cfg.foreign&&!q.consent) throw Object.assign(new Error('Модель зрения — зарубежная: нужно согласие на отправку фото.'),{status:403});
  return ask(cfg,q,o); }

/* askDigit(cfg, {image, w, h, n, part, consent}) — оцифровка чертежа моделью (cfg.digit). Только с согласием: модель
   зарубежная. part — часть, которую выбрал студент (1–4): тогда только этот чертёж → {text, model, info} */
async function askDigit(cfg,q,o){ o=o||{}; if(!cfg.digit) throw Object.assign(new Error('Оцифровка моделью не подключена.'),{status:503});
  if(!q.consent) throw Object.assign(new Error('Оцифровка — зарубежной моделью: нужно согласие на отправку фото.'),{status:403});
  const text='Размер фото: '+q.w+' × '+q.h+' px.'+(q.n?' Вариант '+q.n+'.':'')+(q.part?' Нужна только часть '+q.part+': выпиши один этот чертёж (D '+q.part+').':'');
  return ask(cfg.digit,{image:q.image,w:q.w,h:q.h,system:DIGIT_PROMPT,text,opts:{max_tokens:6000}},Object.assign({},o,{timeout:o.timeout||55000})); }

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

module.exports={eyesFromEnv,ask,askAny,askDigit,DIGIT_MODEL,DIGIT_PROMPT,orOpts,pxOpts,pxModel,OR_URL,PX_URL,BEST_MODEL,pick,tune,lastJson,PROMPT,DEF_URL,DEF_MODEL,CANDIDATES,VARIANTS};
