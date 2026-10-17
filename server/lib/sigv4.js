/* AWS Signature V4 — им подписываются запросы к YDB Document API (совместим с DynamoDB) и к Yandex Cloud Postbox
   (совместим с Amazon SES v2) статическим ключом сервисного аккаунта. Без зависимостей; проверено тестовым вектором AWS. */
'use strict';
const crypto=require('crypto');
const H=s=>crypto.createHash('sha256').update(s).digest('hex');
const M=(k,s)=>crypto.createHmac('sha256',k).update(s).digest();
const enc=s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
function amzDate(ms){ return new Date(ms).toISOString().replace(/[:-]|\.\d{3}/g,''); }
/* req: {method, url, headers, body}; cred: {accessKeyId, secretAccessKey, region, service}; now — мс */
function sign(req,cred,now){
  const u=new URL(req.url), t=amzDate(now==null?Date.now():now), d=t.slice(0,8), body=req.body||'';
  const headers=Object.assign({},req.headers||{},{host:u.host,'x-amz-date':t});
  const names=Object.keys(headers).map(k=>k.toLowerCase()).sort();
  const lower={}; Object.keys(headers).forEach(k=>{ lower[k.toLowerCase()]=String(headers[k]).trim().replace(/\s+/g,' '); });
  const q=[...u.searchParams.entries()].map(([k,v])=>[enc(k),enc(v)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:1).map(x=>x.join('=')).join('&');
  const path=u.pathname.split('/').map(s=>enc(decodeURIComponent(s))).join('/')||'/';
  const creq=[req.method.toUpperCase(),path,q,names.map(n=>n+':'+lower[n]+'\n').join(''),names.join(';'),H(body)].join('\n');
  const scope=d+'/'+cred.region+'/'+cred.service+'/aws4_request';
  const sts=['AWS4-HMAC-SHA256',t,scope,H(creq)].join('\n');
  const key=M(M(M(M('AWS4'+cred.secretAccessKey,d),cred.region),cred.service),'aws4_request');
  const sig=crypto.createHmac('sha256',key).update(sts).digest('hex');
  const out=Object.assign({},req.headers||{},{'x-amz-date':t,Authorization:'AWS4-HMAC-SHA256 Credential='+cred.accessKeyId+'/'+scope+', SignedHeaders='+names.join(';')+', Signature='+sig});
  return {headers:out,canonical:creq,stringToSign:sts,signature:sig}; }
module.exports={sign,amzDate};
