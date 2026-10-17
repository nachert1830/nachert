/* Письма со ссылкой для входа. Боевой режим — Yandex Cloud Postbox (API совместим с Amazon SES v2, подпись SigV4).
   dev — без сети: письмо кладётся в outbox (видно на /dev/outbox и в консоли). Адрес нигде не сохраняется. */
'use strict';
const {sign}=require('./sigv4');
function mailer(o){ const {dev,outbox,from,accessKeyId,secretAccessKey,endpoint='https://postbox.cloud.yandex.net',fetchImpl=fetch,log=console}=o;
  return async function send(to,subject,text){
    if(dev){ outbox&&outbox.push({to,subject,text,at:Date.now()}); log.log&&log.log('[почта, эмуляция] '+to+': '+subject+'\n'+text); return true; }
    if(!from||!accessKeyId||!secretAccessKey) throw new Error('почта не настроена');
    const url=endpoint.replace(/\/$/,'')+'/v2/email/outbound-emails';
    const body=JSON.stringify({FromEmailAddress:from,Destination:{ToAddresses:[to]},Content:{Simple:{Subject:{Data:subject,Charset:'UTF-8'},Body:{Text:{Data:text,Charset:'UTF-8'}}}}});
    const s=sign({method:'POST',url,headers:{'content-type':'application/json'},body},{accessKeyId,secretAccessKey,region:'ru-central1',service:'ses'});
    const r=await fetchImpl(url,{method:'POST',headers:s.headers,body});
    if(!r.ok) throw new Error('Postbox '+r.status+' '+(await r.text()).slice(0,200));
    return true; }; }
module.exports={mailer};
