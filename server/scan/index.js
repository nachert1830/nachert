/* ═══════════ Сканер листа: облачная функция (Yandex Cloud Functions, вызов по адресу, без шлюза) ═══════════
   Страница nachert1830.ru/lk/scan/ присылает сюда кадры чертежей; функция добавляет ключ ProxyAPI (из окружения функции — в страницу он
   не попадает) и возвращает ответ модели. Режимы: layout (где чертежи) и crop (оцифровка одного чертежа), как server/lib/eyes.js.
   Доступ — по коду: заголовок x-scan-code, сверка по SHA-256 (SCAN_CODE_SHA256; личный код владельца — OWNER_CODE_SHA256, он же открывает me/), перебор кода ограничен (10 неудач за 10 минут на адрес).
   Браузер: CORS только для SCAN_ORIGINS (по умолчанию nachert1830.ru). Расход ограничен: SCAN_LIMIT_USD на экземпляр функции и
   SCAN_HOURLY запросов в час — это страховка, а не бухгалтерия (счётчики живут, пока жив экземпляр); баланс ProxyAPI — главный предел.
   Модели (переменные функции; по умолчанию — Sonnet: по замерам lab/dz/REPORT.md 7о и 7у Opus не точнее, а дороже в 3–4 раза):
     SCAN_DIGIT_MODEL — оцифровка чертежа (crop), по умолчанию Claude Sonnet 5.5; сбой или пустой ответ — тот же кадр второй модели;
     SCAN_CHECK_MODEL — вторая, независимая оцифровка (crop2), по умолчанию Claude Opus 5.5 (только режим «максимальная»): страница просит её, только если
       первая слабая (не привязалась к варианту, много линий без карандаша), и сливает ответы — что настоящее, решает карандаш;
     SCAN_LAYOUT_MODEL — раскладка листа (layout), по умолчанию Claude Haiku 5.5.
   Тело может назвать модель явно: model: 'opus' | 'sonnet' (только они — для замера A/B, lab/dz/scan-ab.js).
   Запасной поставщик — OpenRouter (OPENROUTER_API_KEY, необязательный): ProxyAPI отказал по деньгам или лимиту (402 «Insufficient balance» /
   «API Key budget exceeded», 429 «Too many requests» — так сканер лежал часами у всех студентов) — тот же запрос той же модели идёт в
   OpenRouter (имя с точкой: anthropic/claude-opus-5.5), в оставшееся время функции; в ответе provider: 'openrouter' и причина в fallback.
   Ключ (401/403) — не деньги: в OpenRouter не идём. Последний такой отказ ProxyAPI виден только владельцу (GET с кодом владельца:
   provider.proxyapi.lastError/at) — пульт me/ покажет «баланс ProxyAPI кончился». Без OPENROUTER_API_KEY — как раньше (ошибка).
   Фото не сохраняется и не пишется в журнал. Развёртывание: .github/workflows/scan-deploy.yml. Вызов — по адресу функции БЕЗ ?integration=raw (в raw-режиме функция получает только тело запроса: ни заголовков, ни метода, ни статуса ответа). */
'use strict';
const crypto=require('crypto');
const EY=(()=>{ try{ return require('./eyes.js'); }catch(e){ return require('../lib/eyes.js'); } })();
const SPR=(()=>{ try{ return require('./sheetprompts.js'); }catch(e){ return require('../lib/sheetprompts.js'); } })();
let doFetch=(...a)=>fetch(...a);
const ORIGINS=()=>(process.env.SCAN_ORIGINS||'https://nachert1830.ru,https://www.nachert1830.ru').split(',').map(s=>s.trim()).filter(Boolean);
const norm=s=>String(s||'').trim().toLowerCase().replace(/ё/g,'е'), sha=s=>crypto.createHash('sha256').update(norm(s)).digest('hex');
/* $ за токен (цены Anthropic: Haiku 5.5 — 0,1/0,5, Sonnet 5.5 — 2/10, Opus 5.5 — 4/20 за млн); ProxyAPI считает в рублях со своей наценкой —
   это страховка лимита, не бухгалтерия. Неизвестная модель — по Opus (сверху) */
const PRICE=m=>/haiku-5/.test(m||'')?[0.1e-6,0.5e-6]:/haiku/.test(m||'')?[1e-6,5e-6]:/sonnet/.test(m||'')?[2e-6,10e-6]:[4e-6,20e-6];
const MODELS={opus:'anthropic/claude-opus-5-5',sonnet:'anthropic/claude-sonnet-5-5',haiku:'anthropic/claude-haiku-5-5'};
const model=(v,d)=>MODELS[v]||v||MODELS[d]||d;   /* opus | sonnet | haiku или полное имя */
/* лимит ответа: Opus 5.5 рассуждает всегда (рассуждение — в том же лимите); ProxyAPI заранее оценивает цену по лимиту, поэтому не больше нужного */
const TOKENS=m=>/opus|fable|mythos/.test(m)?9000:3000;
/* OpenRouter пишет версию Claude через точку (anthropic/claude-opus-5.5), ProxyAPI — через дефис (EY.pxModel — обратное) */
const orModel=m=>/^anthropic\/claude-/.test(m||'')?m.replace(/(\d)-(\d)/g,'$1.$2'):m;
/* отказ ProxyAPI по деньгам или лимиту (не по ключу): тогда есть смысл в OpenRouter; 401/403 — ключ, там то же не поможет */
const money=e=>!!e&&![401,403].includes(e.upstream)&&([402,429].includes(e.upstream)||/budget|balance|too many requests|insufficient|недостаточно средств/i.test(String(e.message||'')));
const state={spent:0,hour:Date.now(),hourCalls:0,fails:new Map(),sigHits:new Map(),px:{lastError:null,at:0,okAt:0}};
/* ── общее хранилище связи «телефон ↔ ноутбук»: таблица YDB (Document API) — общая для всех копий функции.
   Копий функции в облаке несколько, и запросы телефона и ноутбука попадают в разные — память одной копии другим не видна.
   YDB_DOCAPI_ENDPOINT / YDB_KEY_ID / YDB_SECRET (база кабинета club, таблица RELAY_TABLE) кладёт scan-deploy.yml;
   без них — память копии (тесты и локальный запуск). Записи: s:<канал> — ответ WebRTC, (руки идут потоком WebRTC, не через функцию). */
const SIGV=(()=>{ try{ return require('./sigv4.js'); }catch(e){ try{ return require('../lib/sigv4.js'); }catch(x){ return null; } } })();
const KV=(()=>{ const E=process.env; if(!E.YDB_DOCAPI_ENDPOINT||!E.YDB_KEY_ID||!E.YDB_SECRET||!SIGV) return null;
  const T=E.RELAY_TABLE||'nachert_relay', cred={accessKeyId:E.YDB_KEY_ID,secretAccessKey:E.YDB_SECRET,region:'ru-central1',service:'dynamodb'};
  async function call(op,body){ const b=JSON.stringify(body), req={method:'POST',url:E.YDB_DOCAPI_ENDPOINT,headers:{'content-type':'application/x-amz-json-1.0','x-amz-target':'DynamoDB_20120810.'+op},body:b};
    const sg=SIGV.sign(req,cred,Date.now()), r=await doFetch(E.YDB_DOCAPI_ENDPOINT,{method:'POST',headers:sg.headers,body:b}); const t=await r.text();
    if(!r.ok) throw new Error('YDB '+op+': '+r.status+' '+t.slice(0,200)); return t?JSON.parse(t):{}; }
  return { async get(id){ const j=await call('GetItem',{TableName:T,Key:{id:{S:id}},ConsistentRead:true}); return j.Item&&j.Item.v?JSON.parse(j.Item.v.S):null; },
    async put(id,v){ await call('PutItem',{TableName:T,Item:{id:{S:id},v:{S:JSON.stringify(v)}}}); } }; })();
const mem=new Map();
const kvGet=async id=>{ if(KV) return KV.get(id); const v=mem.get(id); return v&&Date.now()-v.t0<180000?v.v:null; };
const kvPut=async(id,v)=>{ if(KV) return KV.put(id,v); if(mem.size>2000) mem.clear(); mem.set(id,{v,t0:Date.now()}); };
const sleepMs=ms=>new Promise(r=>setTimeout(r,ms));
function limitIp(ip,max){ const now=Date.now(), h=(state.sigHits.get(ip)||[]).filter(t=>now-t<60000); h.push(now); state.sigHits.set(ip,h); if(state.sigHits.size>2000) state.sigHits.clear(); return h.length>max; }

/* ── знакомство (?sig=<канал>): телефон кладёт ответ WebRTC (строка «1~…», ≤ 1 КБ), ноутбук забирает опросом. Без кода:
   ключи соединения одноразовые, канал — случайные 128 бит. Нужен без VPN: зарубежные брокеры заблокированы, функция — в России. */
async function signal(method,ch,body,ip,origin){
  if(!/^[0-9a-f]{32}$/.test(ch)) return reply(400,{ok:false,error:'канал'},origin);
  if(limitIp(ip,600)) return reply(429,{ok:false,error:'Слишком часто'},origin);
  if(method==='POST'){ let a=''; try{ a=String(JSON.parse(body||'{}').a||''); }catch(e){}
    if(!/^1~[A-Za-z0-9+\/=_~;,.:-]{20,1000}$/.test(a)) return reply(400,{ok:false,error:'ответ'},origin);
    await kvPut('s:'+ch,{a,t:Date.now()}); return reply(200,{ok:true},origin); }
  const v=await kvGet('s:'+ch); return reply(200,{ok:true,a:v&&Date.now()-v.t<180000?v.a:null},origin); }

const same=(a,b)=>{ a=Buffer.from(String(a)); b=Buffer.from(String(b)); return a.length===b.length&&crypto.timingSafeEqual(a,b); };
function reply(code,obj,origin){ const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
  if(origin){ h['access-control-allow-origin']=origin; h.vary='Origin'; } return {statusCode:code,headers:h,body:obj==null?'':JSON.stringify(obj)}; }
async function handler(event){ event=event||{}; const hd={}; Object.entries(event.headers||{}).forEach(([k,v])=>{ hd[k.toLowerCase()]=Array.isArray(v)?v[0]:v; });
  const method=String(event.httpMethod||event.requestContext&&event.requestContext.http&&event.requestContext.http.method||'GET').toUpperCase(), og=hd.origin||'', origin=ORIGINS().includes(og)?og:'';
  if(method==='OPTIONS'){ if(!origin) return reply(403,{ok:false,error:'Этот адрес страницы не разрешён'}); const r=reply(204,null,origin);
    Object.assign(r.headers,{'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-scan-code','access-control-max-age':'600'}); return r; }
  if(og&&!origin) return reply(403,{ok:false,error:'Этот адрес страницы не разрешён'});
  const ip=String(hd['x-forwarded-for']||hd['x-real-ip']||'?').split(',')[0].trim(), now=Date.now();
  const sigCh=event.queryStringParameters&&event.queryStringParameters.sig;
  if(sigCh!=null&&(method==='GET'||method==='POST')){ const raw=event.isBase64Encoded?Buffer.from(String(event.body||''),'base64').toString('utf8'):String(event.body||''); return signal(method,String(sigCh),raw.slice(0,4096),ip,origin); }
  const code=(v=>{ try{ return decodeURIComponent(v); }catch(e){ return v; } })(String(hd['x-scan-code']||'')), hash=process.env.SCAN_CODE_SHA256||'';
  /* GET без кода — «жива ли функция и нужен ли код» (код не проверяется, статистику не отдаём) */
  if(method==='GET'&&!code) return reply(200,{ok:true,scan:true,codeNeeded:true},origin);
  const f=state.fails.get(ip)||[]; const recent=f.filter(t=>now-t<600000); if(recent.length>=10) return reply(429,{ok:false,error:'Слишком много неверных кодов. Подождите 10 минут.'},origin);
  /* код владельца (OWNER_CODE_SHA256) — второй, личный код: открывает страницу владельца me/ и тоже даёт сканировать */
  /* код владельца, совпавший со студенческим, не действует: иначе пульт открылся бы всем студентам */
  const ownerHash=process.env.OWNER_CODE_SHA256||'', owner=!!code&&!!ownerHash&&ownerHash!==hash&&same(sha(code),ownerHash);
  if(!owner&&(!hash||!same(sha(code),hash))){ recent.push(now); state.fails.set(ip,recent); if(state.fails.size>500) state.fails.clear(); return reply(401,{ok:false,error:'Неверный код доступа'},origin); }
  /* GET ?owner=1 — вход на страницу владельца: студенческий код здесь не годится (403) */
  const wantOwner=String((event.queryStringParameters&&event.queryStringParameters.owner)||'')==='1';
  if(method==='GET'&&wantOwner&&!owner) return reply(403,{ok:false,owner:false,error:'Эта страница только для владельца'},origin);
  /* provider — только владельцу: студентам незачем знать про баланс ProxyAPI */
  if(method==='GET') return reply(200,Object.assign({ok:true,scan:true,codeNeeded:true,codeOk:true,owner,spent:+state.spent.toFixed(3),limit:+(process.env.SCAN_LIMIT_USD||5)},
    owner?{provider:{proxyapi:{lastError:state.px.lastError,at:state.px.at||null,okAt:state.px.okAt||null},openrouter:!!process.env.OPENROUTER_API_KEY}}:{}),origin);
  if(method!=='POST') return reply(405,{ok:false,error:'Только GET и POST'},origin);
  const key=process.env.PROXYAPI_KEY||''; if(!key) return reply(503,{ok:false,error:'На сервере не задан ключ ProxyAPI'},origin);
  if(now-state.hour>3600000){ state.hour=now; state.hourCalls=0; }
  if(state.hourCalls>=(+process.env.SCAN_HOURLY||60)) return reply(429,{ok:false,error:'Лимит запросов в час исчерпан. Попробуйте позже.'},origin);
  if(state.spent>=(+process.env.SCAN_LIMIT_USD||5)) return reply(429,{ok:false,error:'Лимит расходов сканера исчерпан.'},origin);
  let b; try{ const raw=event.isBase64Encoded?Buffer.from(String(event.body||''),'base64').toString('utf8'):String(event.body||''); if(raw.length>4*1024*1024) throw 0; b=JSON.parse(raw); }catch(e){ return reply(400,{ok:false,error:'Нужен JSON до 4 МБ'},origin); }
  const img=String(b.img||''), w=Math.round(+b.w)||0, h=Math.round(+b.h)||0, mode=b.mode;
  if(!['layout','crop','crop2'].includes(mode)) return reply(400,{ok:false,error:'Режим: layout, crop или crop2'},origin);
  if(b.model!=null&&!['opus','sonnet'].includes(b.model)) return reply(400,{ok:false,error:'Модель: opus или sonnet'},origin);
  if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/]+=*$/.test(img)) return reply(400,{ok:false,error:'Нужно фото (JPEG, PNG или WebP)'},origin);
  if(!(w>=200&&h>=200&&w<=4096&&h<=4096)) return reply(400,{ok:false,error:'Размер кадра — от 200 до 4096 px'},origin);
  state.hourCalls++;
  const env=process.env, digitM=model(b.model,env.SCAN_DIGIT_MODEL||MODELS.sonnet), checkM=model(env.SCAN_CHECK_MODEL,MODELS.opus), layoutM=model(env.SCAN_LAYOUT_MODEL,MODELS.haiku);
  const cfgOf=m=>EY.eyesFromEnv({PROXYAPI_KEY:key,EYES_BEST_MODEL:'off',EYES_DIGIT_MODEL:m,EYES_LAYOUT_MODEL:layoutM});
  /* OpenRouter сам считает цену в $ (usage.cost) — она точнее нашей оценки по PRICE */
  /* условие задачи (ДЗ и вариант, если выбраны или уже узнаны): только номера — текст подсказки собирает сервер (sheetprompts.taskHint) */
  const tk=b.task&&typeof b.task==='object'?b.task:null, hint=mode!=='layout'&&tk&&[3,4,5].includes(+tk.dz)?SPR.taskHint(+tk.dz,tk.n):'';
  const q={image:img,w,h,consent:true,hint}, spend=r=>{ const u=(r&&r.info&&r.info.usage)||{}, pr=PRICE(r&&r.model), c=typeof u.cost==='number'?u.cost:(u.prompt_tokens||0)*pr[0]+(u.completion_tokens||0)*pr[1]; state.spent+=c; return {c,u}; };
  const orKey=env.OPENROUTER_API_KEY||'', orCfg=m=>{ const c=EY.eyesFromEnv({EYES_URL:EY.OR_URL,EYES_MODEL:orModel(m),OPENROUTER_API_KEY:orKey,EYES_BEST_MODEL:'off',EYES_DIGIT_MODEL:'off',EYES_LAYOUT_MODEL:'off'}); return Object.assign(c,{digit:c,layout:c}); };
  const one=(c,m,timeout)=>mode==='layout'?EY.askLayout(c,q,{fetch:doFetch,timeout}):EY.askCrop(c,Object.assign({maxTokens:TOKENS(m)},q),{fetch:doFetch,timeout});
  /* ProxyAPI; отказ по деньгам/лимиту — запоминаем (для пульта владельца) и, если есть ключ, тот же запрос в OpenRouter: отказ приходит
     сразу, поэтому OpenRouter получает почти всё время попытки, но не больше остатка функции (110 с из 120) */
  const ask=async(m,timeout)=>{ const s=Date.now();
    try{ const r=await one(cfgOf(m),m,timeout); state.px.okAt=Date.now(); return r; }
    catch(e){ if(!money(e)) throw e; const why=String(e.message||e).replace(/^Модель зрения ответила ошибкой /,'').slice(0,160); state.px.lastError=why; state.px.at=Date.now();
      const left=Math.min(timeout-(Date.now()-s),110000-(Date.now()-t0)); if(!orKey||left<10000) throw e;
      return Object.assign(await one(orCfg(m),m,left),{provider:'openrouter',pxWhy:why}); } };
  const t0=Date.now(); let r, fallback=null;
  try{ if(mode==='layout') r=await ask(layoutM,40000);
    else { const m=mode==='crop2'?checkM:digitM;
      try{ r=await ask(m,mode==='crop2'||m===checkM?55000:80000); }
      /* основная модель не ответила (сбой, пустой ответ, лимит ответа) — тот же кадр второй модели, в оставшееся время функции (120 с) */
      /* ключ (401/403) — второй модели не поможет; 402 — ProxyAPI заранее оценивает цену запроса по лимиту ответа и отказывает,
         если оценка больше остатка баланса: у Opus (9000 токенов) она в разы больше, чем у Sonnet, — тот же кадр Sonnet ещё может пройти */
      catch(e){ if(m===checkM||[401,403].includes(e.upstream)||e.status===403||Date.now()-t0>95000) throw e; fallback=m+': '+String(e.message||e).slice(0,120); r=await ask(checkM,Math.max(15000,110000-(Date.now()-t0))); } }
    const {c,u}=spend(r), provider=r.provider||'proxyapi'; if(provider==='openrouter') fallback=(fallback?fallback+'; ':'')+'ProxyAPI: '+r.pxWhy+' — ответил OpenRouter';
    return reply(200,{ok:true,text:r.text,model:r.model,mode,provider,fallback,usage:{in:u.prompt_tokens||0,out:u.completion_tokens||0},cost:+c.toFixed(5)},origin); }
  catch(e){ const st=e&&e.status&&e.status<600?e.status:502; return reply(st,{ok:false,error:String(e&&e.message||'Модель не ответила').slice(0,200)},origin); } }
module.exports={handler,sha,_setFetch:f=>{ doFetch=f; },_reset:()=>{ mem.clear(); state.sigHits.clear(); state.spent=0; state.hour=Date.now(); state.hourCalls=0; state.fails.clear(); state.px={lastError:null,at:0,okAt:0}; }};
