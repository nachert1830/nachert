/* Тестовый клуб: тот же createApp, хранилище в памяти, управляемые часы, почта и бот — в outbox. */
'use strict';
const {createApp}=require('../lib/app');
const {memoryStore}=require('../lib/store/memory');
const {signLogin,botClient}=require('../lib/telegram');
const {mailer}=require('../lib/mail');
const BOT='777000:TEST-token';
function club(opt){ opt=opt||{};
  const clock={t:Date.parse('2026-10-17T10:00:00Z')}, outbox=[], store=memoryStore(null);
  const cfg=Object.assign({dev:false,origin:opt.secure?'https://club.nachert1830.ru':'http://localhost:8787',secure:!!opt.secure,secret:'x'.repeat(40),botToken:BOT,botName:'club_bot',
    webhookSecret:'hook-secret',tgMaxAge:600,adminTg:['1000001'],adminEmails:['owner@example.com'],mainUrl:'https://nachert1830.ru',week1:''},opt.cfg||{});
  const app=createApp({cfg,store,clock:()=>clock.t,log:{log(){},error:(...a)=>process.env.DEBUG&&console.error(...a)},mail:mailer({dev:true,outbox,log:{}}),bot:botClient({dev:true,outbox})});
  const jar={};
  async function call(method,path,body,o){ o=o||{}; const who=o.as||'default', c=jar[who]||(jar[who]={cookie:'',csrf:''});
    const headers=Object.assign({'content-type':'application/json',origin:cfg.origin,'user-agent':'test'},o.headers||{});
    if(c.csrf&&o.csrf!==false) headers['x-csrf-token']=c.csrf;
    const cookies={}; if(c.cookie&&o.cookie!==false){ const [k,v]=c.cookie.split('='); cookies[k]=v; }
    const q={}; const [p,qs]=path.split('?'); if(qs) new URLSearchParams(qs).forEach((v,k)=>{ q[k]=v; });
    const res=await app.handle({method,path:p,query:q,headers,body:body===undefined?'':typeof body==='string'?body:JSON.stringify(body),ip:o.ip||'10.1.2.3',cookies});
    const sc=res.multiValueHeaders&&res.multiValueHeaders['Set-Cookie']; let data=null; try{ data=JSON.parse(res.body); }catch(e){}
    if(sc){ const v=sc[0].split(';')[0]; if(/=$/.test(v)) delete jar[who]; else c.cookie=v; c.setCookie=sc[0]; }
    if(data&&typeof data.csrf==='string') (jar[who]||(jar[who]={})).csrf=data.csrf;
    return {status:res.statusCode,data,headers:res.headers,setCookie:sc&&sc[0],raw:res}; }
  function tg(id,name,o){ o=o||{}; const d={id:String(id),first_name:name||'Тест',auth_date:String(Math.floor(clock.t/1000)-(o.age||0))}; if(o.username) d.username=o.username; d.hash=signLogin(d,o.token||BOT); return d; }
  const consent={terms:true,pd:true,photos:false};
  async function invite(asWho){ const r=await call('POST','/api/admin/invites',{label:'тест',days:7},{as:asWho||'owner'}); return r.data.code; }
  async function owner(){ return call('POST','/api/auth/telegram',{auth:tg(1000001,'Владелец'),consent},{as:'owner'}); }
  async function member(id,who){ const code=await invite(); return call('POST','/api/auth/telegram',{auth:tg(id,'Участник'),invite:code,consent},{as:who||'m'+id}); }
  return {app,cfg,store,clock,outbox,call,tg,consent,invite,owner,member,jar}; }
module.exports={club,BOT};
