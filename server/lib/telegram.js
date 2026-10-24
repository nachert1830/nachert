/* Telegram: бот клуба — вход (подтверждение в чате) и напоминания. Только Bot API; данные от браузера не принимаются. */
'use strict';
/* Bot API. dev — без сети: сообщения складываются в outbox (видно на /dev/outbox) */
function botClient(o){ const {token,fetchImpl=fetch,dev,outbox}=o;
  async function api(method,body){
    if(dev){ outbox&&outbox.push({to:'telegram',method,body,at:Date.now()}); if(body&&String(body.chat_id)==='403') return {ok:false,error_code:403,description:'Forbidden: bot can\'t initiate conversation'}; return {ok:true,result:{}}; }
    if(!token) return {ok:false,description:'бот не настроен'};
    /* из облака Telegram может не открываться: не ждём дольше 8 секунд, ошибку возвращаем как ответ, без токена в тексте */
    let r; try{ r=await fetchImpl('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)}); }
    catch(e){ return {ok:false,description:'нет связи с api.telegram.org ('+String(e&&e.cause&&e.cause.code||e&&e.name||'ошибка')+')'}; }
    try{ return await r.json(); }catch(e){ return {ok:false,error_code:r.status}; } }
  return {api,send:(chat,text,extra)=>api('sendMessage',Object.assign({chat_id:chat,text,disable_web_page_preview:true},extra||{}))}; }
module.exports={botClient};
