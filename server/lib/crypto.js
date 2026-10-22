/* Токены и хеши. Все одноразовые токены (сессии, входы через бота, приглашения) хранятся только как SHA-256. */
'use strict';
const crypto=require('crypto');
const token=(bytes=32)=>crypto.randomBytes(bytes).toString('base64url');
const sha256=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const hmac=(key,s,enc='hex')=>crypto.createHmac('sha256',key).update(String(s)).digest(enc);
function safeEqual(a,b){ const x=Buffer.from(String(a)), y=Buffer.from(String(b)); if(x.length!==y.length){ crypto.timingSafeEqual(x,x); return false; } return crypto.timingSafeEqual(x,y); }
const id=(prefix='')=>prefix+crypto.randomBytes(9).toString('base64url');
module.exports={token,sha256,hmac,safeEqual,id};
