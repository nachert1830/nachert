/* Запуск бота эфиров на своём сервере (VPS): long polling — бот сам забирает обновления у Telegram,
   поэтому не нужны ни домен, ни SSL, ни вебхук. Зависимостей нет, нужен только Node.js 20+.
     LIVEBOT_TOKEN=…  LIVEBOT_ADMINS=123456789  node server/livebot/run.js
   Необязательно: LIVEBOT_DATA — файл данных (по умолчанию server/livebot/.data/live.json),
   LIVEBOT_SITE — адрес сайта для ссылок, TG_API — другой адрес Bot API (свой прокси), по умолчанию https://api.telegram.org.
   Подробно — README.md рядом. */
'use strict';
const fs=require('fs'), path=require('path');
const {createLiveBot,emptyState}=require('./core');
const TOKEN=process.env.LIVEBOT_TOKEN||'', ADMINS=String(process.env.LIVEBOT_ADMINS||'').split(/[,\s]+/).filter(Boolean);
const FILE=process.env.LIVEBOT_DATA||path.join(__dirname,'.data','live.json');
const BASE=(process.env.TG_API||'https://api.telegram.org').replace(/\/$/,'');
if(!/^\d+:[\w-]{30,}$/.test(TOKEN)){ console.error('Нет LIVEBOT_TOKEN (токен от @BotFather).'); process.exit(1); }
if(!ADMINS.length) console.warn('LIVEBOT_ADMINS пуст — команды владельца (/add, /link, /list) никому не доступны.');

/* файл данных: атомарная запись (tmp → rename), права только владельцу */
const load=()=>{ try{ return JSON.parse(fs.readFileSync(FILE,'utf8')); }catch(e){ return null; } };
const save=st=>{ fs.mkdirSync(path.dirname(FILE),{recursive:true,mode:0o700}); const tmp=FILE+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(st),{mode:0o600}); fs.renameSync(tmp,FILE); };

async function api(method,body,timeoutMs){
  try{ const r=await fetch(BASE+'/bot'+TOKEN+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(timeoutMs||15000)});
    const j=await r.json().catch(()=>({ok:false,error_code:r.status}));
    if(j.error_code===429&&j.parameters&&j.parameters.retry_after){ await new Promise(f=>setTimeout(f,j.parameters.retry_after*1000)); return api(method,body,timeoutMs); }
    return j; }
  catch(e){ return {ok:false,description:'нет связи с Telegram ('+(e&&e.cause&&e.cause.code||e&&e.name||'ошибка')+')'}; } }

const bot=createLiveBot({api,load,save,admins:ADMINS,site:process.env.LIVEBOT_SITE||'https://nachert1830.ru',log:(...a)=>console.log(new Date().toISOString(),...a)});
/* одна очередь: обновления и таймер не пересекаются (данные — один файл) */
let chain=Promise.resolve(); const q=fn=>(chain=chain.then(fn).catch(e=>console.error(new Date().toISOString(),'ошибка:',e&&e.stack||e)));

(async()=>{
  const me=await api('getMe'); if(!me.ok){ console.error('Telegram не ответил на getMe:',me.description||me.error_code); process.exit(1); }
  await api('deleteWebhook',{drop_pending_updates:false});
  console.log('Бот @'+me.result.username+' запущен. Данные:',FILE);
  setInterval(()=>q(()=>bot.tick()),60e3); q(()=>bot.tick());
  let offset=(load()||{}).offset||0;
  for(;;){ const r=await api('getUpdates',{offset,timeout:50,allowed_updates:['message','callback_query']},65000);
    if(!r.ok){ console.error(new Date().toISOString(),'getUpdates:',r.description||r.error_code); await new Promise(f=>setTimeout(f,5000)); continue; }
    for(const u of r.result||[]){ offset=u.update_id+1; await q(async()=>{ await bot.onUpdate(u); const st=load()||emptyState(); st.offset=offset; save(st); }); } }
})();
