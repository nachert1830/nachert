/* Тестовый клуб: тот же createApp, хранилище в памяти, управляемые часы, бот — в outbox.
   Вход через бота: start (сайт) → «Старт» и «Войти» в боте (обновления, как на вебхук) → poll (сайт). */
'use strict';
const {createApp}=require('../lib/app');
const {memoryStore}=require('../lib/store/memory');
const {botClient}=require('../lib/telegram');
function club(opt){ opt=opt||{};
  const clock={t:Date.parse('2026-10-17T10:00:00Z')}, outbox=[], store=memoryStore(null);
  const cfg=Object.assign({dev:false,origin:opt.secure?'https://club.nachert1830.ru':'http://localhost:8787',secure:!!opt.secure,botToken:'777000:TEST-token',botName:'club_bot',
    webhookSecret:'hook-secret',adminTg:['1000001'],mainUrl:'https://nachert1830.ru',week1:''},opt.cfg||{});
  const app=createApp({cfg,store,clock:()=>clock.t,log:{log(){},error:(...a)=>process.env.DEBUG&&console.error(...a)},bot:botClient({dev:true,outbox})});
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
  /* обновления Telegram так, как они приходят на вебхук (с секретом) */
  const hook=u=>call('POST','/api/tg/webhook',JSON.stringify(u),{headers:{'x-telegram-bot-api-secret-token':'hook-secret'},as:'telegram'});
  const startBot=(tok,id,name)=>hook({message:{from:{id:+id,first_name:name||'Тест'},chat:{id:+id},text:'/start l_'+tok}});
  const press=(tok,id,act)=>hook({callback_query:{id:'cb'+Math.random(),from:{id:+id},message:{chat:{id:+id},message_id:1},data:(act||'ok')+':'+app._loginId(tok)}});
  /* полный вход: o.invite, o.consent (по умолчанию — согласие дано), o.who — чья cookie */
  async function login(id,name,o){ o=o||{}; const consent=o.consent===undefined?CONSENT:o.consent;
    const s=await call('POST','/api/auth/bot/start',{invite:o.invite,consent},{as:o.who||'u'+id}); if(s.status!==200) return s;
    await startBot(s.data.token,id,name); await press(s.data.token,id,'ok');
    return call('POST','/api/auth/bot/poll',{token:s.data.token,consent:o.pollConsent},{as:o.who||'u'+id}); }
  async function invite(asWho){ const r=await call('POST','/api/admin/invites',{label:'тест',days:7},{as:asWho||'owner'}); return r.data.code; }
  async function owner(){ return login(1000001,'Владелец',{who:'owner'}); }
  async function member(id,who){ const code=await invite(); return login(id,'Участник',{invite:code,who:who||'m'+id}); }
  return {app,cfg,store,clock,outbox,call,hook,startBot,press,login,consent:CONSENT,invite,owner,member,jar}; }
const CONSENT={terms:true,pd:true,photos:false};
module.exports={club};
