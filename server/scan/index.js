/* ═══════════ Сканер листа: облачная функция (Yandex Cloud Functions, вызов по адресу, без шлюза) ═══════════
   Страница nachert1830.ru/lk/scan/ присылает сюда кадры чертежей; функция добавляет ключ ProxyAPI (из окружения функции — в страницу он
   не попадает) и возвращает ответ модели. Режимы: layout (где чертежи) и crop (оцифровка одного чертежа), как server/lib/eyes.js.
   Доступ — по коду: заголовок x-scan-code, сверка по SHA-256 (SCAN_CODE_SHA256; личный код владельца — OWNER_CODE_SHA256, он же открывает me/), перебор кода ограничен (10 неудач за 10 минут на адрес).
   Браузер: CORS только для SCAN_ORIGINS (по умолчанию nachert1830.ru). Расход ограничен: SCAN_LIMIT_USD на экземпляр функции и
   SCAN_HOURLY запросов в час — это страховка, а не бухгалтерия (счётчики живут, пока жив экземпляр); баланс ProxyAPI — главный предел.
   Модели (переменные функции; по умолчанию — лучшая связка по замеру lab/dz/REPORT.md, «Opus + проверка Sonnet»):
     SCAN_DIGIT_MODEL — оцифровка чертежа (crop), по умолчанию Claude Opus 5.5; сбой или пустой ответ — тот же кадр Sonnet;
     SCAN_CHECK_MODEL — вторая, независимая оцифровка (crop2), по умолчанию Claude Sonnet 5.5: страница просит её, только если
       первая слабая (не привязалась к варианту, много линий без карандаша), и сливает ответы — что настоящее, решает карандаш;
     SCAN_LAYOUT_MODEL — раскладка листа (layout), по умолчанию Claude Haiku 5.5.
   Тело может назвать модель явно: model: 'opus' | 'sonnet' (только они — для замера A/B, lab/dz/scan-ab.js).
   Фото не сохраняется и не пишется в журнал. Развёртывание: .github/workflows/scan-deploy.yml. Вызов — по адресу функции БЕЗ ?integration=raw (в raw-режиме функция получает только тело запроса: ни заголовков, ни метода, ни статуса ответа). */
'use strict';
const crypto=require('crypto');
const EY=(()=>{ try{ return require('./eyes.js'); }catch(e){ return require('../lib/eyes.js'); } })();
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
const state={spent:0,hour:Date.now(),hourCalls:0,fails:new Map()};
const same=(a,b)=>{ a=Buffer.from(String(a)); b=Buffer.from(String(b)); return a.length===b.length&&crypto.timingSafeEqual(a,b); };
function reply(code,obj,origin){ const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
  if(origin){ h['access-control-allow-origin']=origin; h.vary='Origin'; } return {statusCode:code,headers:h,body:obj==null?'':JSON.stringify(obj)}; }
async function handler(event){ event=event||{}; const hd={}; Object.entries(event.headers||{}).forEach(([k,v])=>{ hd[k.toLowerCase()]=Array.isArray(v)?v[0]:v; });
  const method=String(event.httpMethod||event.requestContext&&event.requestContext.http&&event.requestContext.http.method||'GET').toUpperCase(), og=hd.origin||'', origin=ORIGINS().includes(og)?og:'';
  if(method==='OPTIONS'){ if(!origin) return reply(403,{ok:false,error:'Этот адрес страницы не разрешён'}); const r=reply(204,null,origin);
    Object.assign(r.headers,{'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-scan-code','access-control-max-age':'600'}); return r; }
  if(og&&!origin) return reply(403,{ok:false,error:'Этот адрес страницы не разрешён'});
  const ip=String(hd['x-forwarded-for']||hd['x-real-ip']||'?').split(',')[0].trim(), now=Date.now();
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
  if(method==='GET') return reply(200,{ok:true,scan:true,codeNeeded:true,codeOk:true,owner,spent:+state.spent.toFixed(3),limit:+(process.env.SCAN_LIMIT_USD||5)},origin);
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
  const env=process.env, digitM=model(b.model,env.SCAN_DIGIT_MODEL||MODELS.opus), checkM=model(env.SCAN_CHECK_MODEL,MODELS.sonnet), layoutM=model(env.SCAN_LAYOUT_MODEL,MODELS.haiku);
  const cfgOf=m=>EY.eyesFromEnv({PROXYAPI_KEY:key,EYES_BEST_MODEL:'off',EYES_DIGIT_MODEL:m,EYES_LAYOUT_MODEL:layoutM});
  const q={image:img,w,h,consent:true}, spend=r=>{ const u=(r&&r.info&&r.info.usage)||{}, pr=PRICE(r&&r.model), c=(u.prompt_tokens||0)*pr[0]+(u.completion_tokens||0)*pr[1]; state.spent+=c; return {c,u}; };
  const crop=(m,timeout)=>EY.askCrop(cfgOf(m),Object.assign({maxTokens:TOKENS(m)},q),{fetch:doFetch,timeout});
  const t0=Date.now(); let r, fallback=null;
  try{ if(mode==='layout') r=await EY.askLayout(cfgOf(digitM),q,{fetch:doFetch});
    else { const m=mode==='crop2'?checkM:digitM;
      try{ r=await crop(m,mode==='crop2'||m===checkM?55000:80000); }
      /* основная модель не ответила (сбой, пустой ответ, лимит ответа) — тот же кадр второй модели, в оставшееся время функции (120 с) */
      catch(e){ if(m===checkM||[401,402,403].includes(e.upstream)||e.status===403||Date.now()-t0>95000) throw e;   /* ключ, баланс ProxyAPI — второй модели не поможет */ fallback=m+': '+String(e.message||e).slice(0,120); r=await crop(checkM,Math.max(15000,110000-(Date.now()-t0))); } }
    const {c,u}=spend(r);
    return reply(200,{ok:true,text:r.text,model:r.model,mode,fallback,usage:{in:u.prompt_tokens||0,out:u.completion_tokens||0},cost:+c.toFixed(5)},origin); }
  catch(e){ const st=e&&e.status&&e.status<600?e.status:502; return reply(st,{ok:false,error:String(e&&e.message||'Модель не ответила').slice(0,200)},origin); } }
module.exports={handler,sha,_setFetch:f=>{ doFetch=f; },_reset:()=>{ state.spent=0; state.hour=Date.now(); state.hourCalls=0; state.fails.clear(); }};
