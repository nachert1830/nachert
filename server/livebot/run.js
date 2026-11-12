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

/* картинка-приветствие на /start: welcome.jpg (или .png) рядом с ботом; нет файла — приветствие текстом */
const WELCOME=process.env.LIVEBOT_WELCOME||['welcome.jpg','welcome.jpeg','welcome.png'].map(f=>path.join(__dirname,f)).find(f=>fs.existsSync(f))||'';
/* sendPhoto с {upload:true} — загрузка файла (multipart); дальше бот шлёт картинку по file_id */
function form(body){ const fd=new FormData();
  Object.entries(body).forEach(([k,v])=>{ if(k==='photo'&&v&&v.upload) fd.append('photo',new Blob([fs.readFileSync(WELCOME)]),path.basename(WELCOME)); else fd.append(k,typeof v==='object'?JSON.stringify(v):String(v)); });
  return fd; }
async function api(method,body,timeoutMs){
  try{ const up=body&&body.photo&&body.photo.upload;
    const r=await fetch(BASE+'/bot'+TOKEN+'/'+method,Object.assign({method:'POST',signal:AbortSignal.timeout(timeoutMs||(up?60000:15000))},up?{body:form(body)}:{headers:{'content-type':'application/json'},body:JSON.stringify(body||{})}));
    const j=await r.json().catch(()=>({ok:false,error_code:r.status}));
    if(j.error_code===429&&j.parameters&&j.parameters.retry_after){ await new Promise(f=>setTimeout(f,j.parameters.retry_after*1000)); return api(method,body,timeoutMs); }
    return j; }
  catch(e){ return {ok:false,description:'нет связи с Telegram ('+(e&&e.cause&&e.cause.code||e&&e.name||'ошибка')+')'}; } }

/* расписание эфиров из репозитория (schedule.json рядом): бот сам добавит эфиры, которых у него ещё нет.
   Поправил файл → на сервере та же команда установки (git pull + перезапуск). Добавлять можно и кнопками в боте. */
const SCHED=process.env.LIVEBOT_SCHEDULE||path.join(__dirname,'schedule.json');
const schedule=()=>{ try{ return JSON.parse(fs.readFileSync(SCHED,'utf8')); }catch(e){ return []; } };
const bot=createLiveBot({api,load,save,schedule,welcome:!!WELCOME,startClosed:process.env.LIVEBOT_OPEN!=='1',admins:ADMINS,site:process.env.LIVEBOT_SITE||'https://nachert1830.ru',log:(...a)=>console.log(new Date().toISOString(),...a)});
/* одна очередь: обновления и таймер не пересекаются (данные — один файл) */
let chain=Promise.resolve(); const q=fn=>(chain=chain.then(fn).catch(e=>console.error(new Date().toISOString(),'ошибка:',e&&e.stack||e)));

(async()=>{
  const me=await api('getMe'); if(!me.ok){ console.error('Telegram не ответил на getMe:',me.description||me.error_code); process.exit(1); }
  await api('deleteWebhook',{drop_pending_updates:false});
  console.log('Бот @'+me.result.username+' запущен. Данные:',FILE,WELCOME?'· приветствие: '+path.basename(WELCOME):'· приветствие без картинки (нет welcome.jpg)');
  setInterval(()=>q(()=>bot.tick()),60e3); q(()=>bot.tick());
  let offset=(load()||{}).offset||0;
  for(;;){ const r=await api('getUpdates',{offset,timeout:50,allowed_updates:['message','callback_query']},65000);
    if(!r.ok){ console.error(new Date().toISOString(),'getUpdates:',r.description||r.error_code); await new Promise(f=>setTimeout(f,5000)); continue; }
    for(const u of r.result||[]){ offset=u.update_id+1; await q(async()=>{ await bot.onUpdate(u); const st=load()||emptyState(); st.offset=offset; save(st); }); } }
})();
