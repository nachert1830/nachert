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
  return {url,model,folder,key:env.EYES_KEY||'',auth:env.EYES_AUTH||'Bearer',yandex,on:env.EYES!=='off'&&!!(env.EYES_KEY||yandex&&folder)}; }

/* ask(cfg, {image: 'data:image/jpeg;base64,…', w, h, dz, n}, {fetch, token}) → {text, model} */
async function ask(cfg,q,o){ o=o||{}; const http=o.fetch||((...a)=>fetch(...a));
  const key=cfg.key||(o.token&&o.token()||''); if(!key) throw Object.assign(new Error('ИИ-зрение не настроено: нет ключа модели.'),{status:503});
  const headers={'content-type':'application/json',authorization:(cfg.key?cfg.auth:'Bearer')+' '+key};
  if(cfg.yandex&&cfg.folder) headers['x-folder-id']=cfg.folder;
  const hint=(q.dz?'ДЗ №'+q.dz+'. ':'')+(q.n?'Вариант '+q.n+'. ':'')+'Размер фото: '+q.w+' × '+q.h+' px.';
  const body={model:cfg.model,temperature:0,max_tokens:1500,messages:[{role:'system',content:PROMPT},
    {role:'user',content:[{type:'text',text:hint},{type:'image_url',image_url:{url:q.image}}]}]};
  const r=await http(cfg.url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(o.timeout||45000)});
  const t=await r.text(); let j=null; try{ j=JSON.parse(t); }catch(e){}
  if(!r.ok) throw Object.assign(new Error('Модель зрения ответила ошибкой '+r.status+(j&&j.error?': '+String(j.error.message||j.error).slice(0,200):'')),{status:502});
  const text=j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
  if(typeof text!=='string'||!text) throw Object.assign(new Error('Модель зрения вернула пустой ответ.'),{status:502});
  return {text,model:cfg.model}; }

/* какая модель зрения в каталоге отвечает на запрос с картинкой: развёртывание (server/tools/deploy.js) пробует по очереди
   и подключает первую. Не все модели AI Studio доступны в синхронном режиме: на остальные Yandex отвечает 400/404 */
const CANDIDATES=['gemma-3-27b-it/latest','gemma-3-27b-it','qwen2.5-vl-32b-instruct/latest','qwen2.5-vl-32b-instruct'];
/* pick(env, image, {fetch, token}) → {model (адрес модели или null), tried:[{model, error}]}; env.EYES_MODEL задан — пробуется только он */
async function pick(env,image,o){ const tried=[], models=env.EYES_MODEL?[env.EYES_MODEL]:CANDIDATES.map(m=>'gpt://{folder}/'+m);
  for(const m of models){ const cfg=eyesFromEnv(Object.assign({},env,{EYES_MODEL:m}));
    try{ await ask(cfg,{image,w:256,h:256},o); return {model:cfg.model,tried}; }catch(e){ tried.push({model:cfg.model,error:e.message}); } }
  return {model:null,tried}; }

module.exports={eyesFromEnv,ask,pick,PROMPT,DEF_URL,DEF_MODEL,CANDIDATES};
