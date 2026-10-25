/* Письма с кодом входа: Yandex Cloud Postbox (совместим с Amazon SES v2), подпись SigV4 статическим ключом сервисного
   аккаунта функции (роль postbox.sender). Адрес отправителя (MAIL_FROM) — на домене, подтверждённом в Postbox (DKIM).
   dev: письма складываются в outbox. */
'use strict';
const {sign}=require('./sigv4');
function postbox({from,accessKeyId,secretAccessKey,endpoint,fetchImpl}){ endpoint=(endpoint||'https://postbox.cloud.yandex.net').replace(/\/$/,''); fetchImpl=fetchImpl||fetch;
  return {enabled:!!from, async send({to,subject,text}){
    const body=JSON.stringify({FromEmailAddress:from,Destination:{ToAddresses:[to]},Content:{Simple:{Subject:{Data:subject,Charset:'UTF-8'},Body:{Text:{Data:text,Charset:'UTF-8'}}}}});
    const req={method:'POST',url:endpoint+'/v2/email/outbound-emails',headers:{'content-type':'application/json'},body};
    const s=sign(req,{accessKeyId,secretAccessKey,region:'ru-central1',service:'ses'});
    let r; try{ r=await fetchImpl(req.url,{method:'POST',headers:s.headers,body,signal:AbortSignal.timeout(8000)}); }catch(e){ return {ok:false,error:'нет связи с Postbox'}; }
    const t=await r.text().catch(()=>''); return r.ok?{ok:true}:{ok:false,error:'Postbox '+r.status+' '+t.slice(0,200)}; }}; }
function devMail(outbox){ return {enabled:true, async send(m){ outbox.push(Object.assign({to:'mail',at:Date.now()},m)); return {ok:true}; }}; }
module.exports={postbox,devMail};
