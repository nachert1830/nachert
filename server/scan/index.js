/* ═══════════ Сканер листа: облачная функция (Yandex Cloud Functions, вызов по адресу, без шлюза) ═══════════
   Страница nachert1830.ru/lk/scan/ присылает сюда кадры чертежей; функция добавляет ключ ProxyAPI (из окружения функции — в страницу он
   не попадает) и возвращает ответ модели. Режимы: layout (где чертежи) и crop (оцифровка одного чертежа), как server/lib/eyes.js.
   Доступ — по коду: заголовок x-scan-code, сверка по SHA-256 (SCAN_CODE_SHA256), перебор кода ограничен (10 неудач за 10 минут на адрес).
   Браузер: CORS только для SCAN_ORIGINS (по умолчанию nachert1830.ru). Расход ограничен: SCAN_LIMIT_USD на экземпляр функции и
   SCAN_HOURLY запросов в час — это страховка, а не бухгалтерия (счётчики живут, пока жив экземпляр); баланс ProxyAPI — главный предел.
   Фото не сохраняется и не пишется в журнал. Развёртывание: .github/workflows/scan-deploy.yml. Вызов — по адресу функции БЕЗ ?integration=raw (в raw-режиме функция получает только тело запроса: ни заголовков, ни метода, ни статуса ответа). */
'use strict';
const crypto=require('crypto');
const EY=(()=>{ try{ return require('./eyes.js'); }catch(e){ return require('../lib/eyes.js'); } })();
let doFetch=(...a)=>fetch(...a);
const ORIGINS=()=>(process.env.SCAN_ORIGINS||'https://nachert1830.ru,https://www.nachert1830.ru').split(',').map(s=>s.trim()).filter(Boolean);
const norm=s=>String(s||'').trim().toLowerCase().replace(/ё/g,'е'), sha=s=>crypto.createHash('sha256').update(norm(s)).digest('hex');
const PRICE=m=>/haiku/.test(m||'')?[1e-6,5e-6]:[3e-6,15e-6];   /* $ за токен: оценка сверху, ProxyAPI считает в рублях */
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
  if(!hash||!same(sha(code),hash)){ recent.push(now); state.fails.set(ip,recent); if(state.fails.size>500) state.fails.clear(); return reply(401,{ok:false,error:'Неверный код доступа'},origin); }
  if(method==='GET') return reply(200,{ok:true,scan:true,codeNeeded:true,codeOk:true,spent:+state.spent.toFixed(3),limit:+(process.env.SCAN_LIMIT_USD||5)},origin);
  if(method!=='POST') return reply(405,{ok:false,error:'Только GET и POST'},origin);
  const key=process.env.PROXYAPI_KEY||''; if(!key) return reply(503,{ok:false,error:'На сервере не задан ключ ProxyAPI'},origin);
  if(now-state.hour>3600000){ state.hour=now; state.hourCalls=0; }
  if(state.hourCalls>=(+process.env.SCAN_HOURLY||60)) return reply(429,{ok:false,error:'Лимит запросов в час исчерпан. Попробуйте позже.'},origin);
  if(state.spent>=(+process.env.SCAN_LIMIT_USD||5)) return reply(429,{ok:false,error:'Лимит расходов сканера исчерпан.'},origin);
  let b; try{ const raw=event.isBase64Encoded?Buffer.from(String(event.body||''),'base64').toString('utf8'):String(event.body||''); if(raw.length>4*1024*1024) throw 0; b=JSON.parse(raw); }catch(e){ return reply(400,{ok:false,error:'Нужен JSON до 4 МБ'},origin); }
  const img=String(b.img||''), w=Math.round(+b.w)||0, h=Math.round(+b.h)||0, mode=b.mode;
  if(!['layout','crop'].includes(mode)) return reply(400,{ok:false,error:'Режим: layout или crop'},origin);
  if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/]+=*$/.test(img)) return reply(400,{ok:false,error:'Нужно фото (JPEG, PNG или WebP)'},origin);
  if(!(w>=200&&h>=200&&w<=4096&&h<=4096)) return reply(400,{ok:false,error:'Размер кадра — от 200 до 4096 px'},origin);
  const cfg=EY.eyesFromEnv({PROXYAPI_KEY:key}); state.hourCalls++;
  try{ const q={image:img,w,h,consent:true}, r=mode==='layout'?await EY.askLayout(cfg,q,{fetch:doFetch}):await EY.askCrop(cfg,q,{fetch:doFetch});
    const u=(r.info&&r.info.usage)||{}, pr=PRICE(r.model), cost=(u.prompt_tokens||0)*pr[0]+(u.completion_tokens||0)*pr[1]; state.spent+=cost;
    return reply(200,{ok:true,text:r.text,model:r.model,mode,usage:{in:u.prompt_tokens||0,out:u.completion_tokens||0},cost:+cost.toFixed(5)},origin); }
  catch(e){ const st=e&&e.status&&e.status<600?e.status:502; return reply(st,{ok:false,error:String(e&&e.message||'Модель не ответила').slice(0,200)},origin); } }
module.exports={handler,sha,_setFetch:f=>{ doFetch=f; },_reset:()=>{ state.spent=0; state.hour=Date.now(); state.hourCalls=0; state.fails.clear(); }};
