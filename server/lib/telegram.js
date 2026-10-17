/* Telegram: проверка данных Telegram Login и бот для напоминаний.
   Проверка входа (core.telegram.org/widgets/login#checking-authorization):
     data_check_string — все поля, кроме hash, «ключ=значение», по алфавиту, через \n;
     secret = SHA-256(токен бота); hash = HMAC-SHA-256(data_check_string, secret) в hex — сравнение за постоянное время.
   Плюс свежесть auth_date (по умолчанию не старше 10 минут и не из будущего) и защита от повтора — в app.js. */
'use strict';
const crypto=require('crypto');
const {safeEqual}=require('./crypto');
const FIELD=/^[a-z_]{1,32}$/;
function checkString(data){ return Object.keys(data).filter(k=>k!=='hash').sort().map(k=>k+'='+data[k]).join('\n'); }
function signLogin(data,botToken){ const secret=crypto.createHash('sha256').update(botToken).digest(); return crypto.createHmac('sha256',secret).update(checkString(data)).digest('hex'); }
/* → {ok:true, user:{id, name}} | {ok:false, reason} */
function verifyLogin(raw,botToken,nowMs,maxAgeSec){
  if(!botToken) return {ok:false,reason:'вход через Telegram не настроен'};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) return {ok:false,reason:'нет данных'};
  const keys=Object.keys(raw); if(keys.length>12) return {ok:false,reason:'лишние поля'};
  const data={}; for(const k of keys){ const v=raw[k]; if(!FIELD.test(k)) return {ok:false,reason:'неверное поле'};
    if(typeof v!=='string'&&typeof v!=='number') return {ok:false,reason:'неверное значение'}; const s=String(v); if(s.length>512) return {ok:false,reason:'слишком длинно'}; data[k]=s; }
  if(!/^[0-9a-f]{64}$/.test(data.hash||'')) return {ok:false,reason:'нет подписи'};
  if(!/^\d{1,16}$/.test(data.id||'')) return {ok:false,reason:'нет id'};
  if(!/^\d{1,12}$/.test(data.auth_date||'')) return {ok:false,reason:'нет auth_date'};
  if(!safeEqual(signLogin(data,botToken),data.hash)) return {ok:false,reason:'подпись не сходится'};
  const age=nowMs/1000-(+data.auth_date);
  if(age>(maxAgeSec||600)) return {ok:false,reason:'данные входа устарели'};
  if(age<-60) return {ok:false,reason:'auth_date из будущего'};
  const name=[data.first_name,data.last_name].filter(Boolean).join(' ').slice(0,80)||'Участник';
  return {ok:true,user:{id:data.id,name},hash:data.hash}; }

/* Bot API. dev — без сети: сообщения складываются в outbox (видно на /dev/outbox) */
function botClient(o){ const {token,fetchImpl=fetch,dev,outbox}=o;
  async function api(method,body){
    if(dev){ outbox&&outbox.push({to:'telegram',method,body,at:Date.now()}); if(body&&String(body.chat_id)==='403') return {ok:false,error_code:403,description:'Forbidden: bot can\'t initiate conversation'}; return {ok:true,result:{}}; }
    if(!token) return {ok:false,description:'бот не настроен'};
    const r=await fetchImpl('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    try{ return await r.json(); }catch(e){ return {ok:false,error_code:r.status}; } }
  return {api,send:(chat,text,extra)=>api('sendMessage',Object.assign({chat_id:chat,text,disable_web_page_preview:true},extra||{}))}; }
module.exports={verifyLogin,signLogin,checkString,botClient};
