/* Тестовый клуб: тот же createApp, хранилище в памяти, управляемые часы, бот — в outbox.
   Вход через бота: «Старт» (обновление на вебхук) → ссылка из кнопки бота → redeem (браузер). */
'use strict';
const {createApp}=require('../lib/app');
const {memoryStore}=require('../lib/store/memory');
const {botClient}=require('../lib/telegram');
function club(opt){ opt=opt||{};
  const clock={t:Date.parse('2026-10-17T10:00:00Z')}, outbox=[], store=memoryStore(null);
  const cfg=Object.assign({dev:false,origin:opt.secure?'https://club.nachert1830.ru':'http://localhost:8787',secure:!!opt.secure,botToken:'777000:TEST-token',botName:'club_bot',
    webhookSecret:'hook-secret',adminTg:['1000001'],mainUrl:'https://nachert1830.ru',week1:'',
    yandex:{clientId:'ya-client',secret:'ya-secret'},adminYa:['owner.ya'],fronts:undefined,frontUrl:undefined},opt.cfg||{});
  cfg.fronts=cfg.fronts||[cfg.origin,'https://nachert1830.ru'];
  /* поддельный Яндекс ID: код → профиль; записывает, что у него спрашивали */
  const ya={codes:{},calls:[],down:false,eyes:null};
  async function yaFetch(url,o){ o=o||{}; ya.calls.push({url,body:o.body,auth:o.headers&&(o.headers.Authorization||o.headers.authorization),headers:o.headers});
    /* поддельная модель зрения: ответ задаёт тест (ya.eyes(body) → {status, json}) */
    if(opt.eyes&&url===opt.eyes.url){ const a=ya.eyes?ya.eyes(JSON.parse(o.body)):{status:200,json:{choices:[{message:{content:'{"drawings":[]}'}}]}}; return {ok:a.status<300,status:a.status,text:async()=>JSON.stringify(a.json),json:async()=>a.json}; }
    if(ya.down) throw new Error('нет сети');
    const res=(st,j)=>({ok:st<300,status:st,json:async()=>j});
    if(url==='https://oauth.yandex.ru/token'){ const b=new URLSearchParams(o.body);
      if(b.get('client_secret')!=='ya-secret'||!ya.codes[b.get('code')]) return res(400,{error:'invalid_grant'});
      const c=b.get('code'); return res(200,{access_token:'AT-'+c,token_type:'bearer'}); }
    if(url.startsWith('https://login.yandex.ru/info')){ const c=String(o.headers.Authorization||'').replace('OAuth AT-',''); const p=ya.codes[c];
      return p?res(200,Object.assign({client_id:'ya-client'},p)):res(401,{}); }
    if(url==='https://oauth.yandex.ru/revoke_token') return res(200,{status:'ok'});
    return res(404,{}); }
  const app=createApp({cfg,store,clock:()=>clock.t,log:{log(){},error:(...a)=>process.env.DEBUG&&console.error(...a)},bot:botClient({dev:true,outbox}),fetch:yaFetch,eyes:opt.eyes,iamToken:()=>opt.iam||''});
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
  /* «Старт» у бота → ссылка из кнопки «Войти в клуб», отправленной в чат этого id (или null, если бот отказал) */
  /* ответ бота приходит в ответе вебхуку: {method:'sendMessage', chat_id, text, reply_markup} */
  async function startBot(id,name,param){ const r=await hook({message:{from:{id:+id,first_name:name||'Тест'},chat:{id:+id},text:'/start'+(param?' '+param:'')}});
    const m=r.data||{}, k=m.reply_markup&&m.reply_markup.inline_keyboard, url=k&&k[0][0].url;
    return {url,token:url?url.split('#/tg/')[1]:null,text:m.text,chat:m.chat_id,method:m.method}; }
  /* полный вход: o.invite — код приглашения, o.consent (по умолчанию — согласие дано), o.who — чья cookie */
  async function login(id,name,o){ o=o||{}; const consent=o.consent===undefined?CONSENT:o.consent;
    const b=await startBot(id,name,o.invite?'i_'+o.invite:'login'); if(!b.token) return {status:403,data:{needInvite:true,error:b.text}};
    return call('POST','/api/auth/bot/redeem',{token:b.token,confirm:true,consent},{as:o.who||'u'+id}); }
  /* вход через Яндекс ID так, как его проходит браузер: start → (Яндекс) → callback → страница #/ya/<токен>/<s> → redeem */
  async function yandex(profile,o){ o=o||{}; const s=o.s||'clientstate-1234567890', ret=o.ret||cfg.origin+'/';
    const q=new URLSearchParams({ret,s}); if(o.invite) q.set('invite',o.invite); if(o.link) q.set('link',o.link);
    const st=await call('GET','/api/auth/yandex/start?'+q.toString(),undefined,{as:'browser'}); const loc=st.raw.headers&&st.raw.headers.Location;
    if(st.status!==302||!loc) return {step:'start',status:st.status,data:st.data};
    if(!loc.startsWith('https://oauth.yandex.ru/authorize?')) return {step:'start',location:loc};
    const state=new URL(loc).searchParams.get('state'), code='C'+Math.random().toString(36).slice(2); ya.codes[code]=profile;
    const cb=await call('GET','/api/auth/yandex/callback?'+new URLSearchParams(o.deny?{error:'access_denied',state}:{code,state}).toString(),undefined,{as:'browser'});
    const to=cb.raw.headers.Location, m=/#\/ya\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/.exec(to||'');
    if(!m) return {step:'callback',location:to,authorize:loc};
    if(o.noRedeem) return {step:'landing',token:m[1],cs:m[2],location:to,authorize:loc};
    const r=await call('POST','/api/auth/bot/redeem',{token:m[1],confirm:true,consent:o.consent===undefined?CONSENT:o.consent},{as:o.who||'ya'+profile.id});
    return Object.assign(r,{token:m[1],cs:m[2],location:to,authorize:loc}); }
  async function invite(asWho){ const r=await call('POST','/api/admin/invites',{label:'тест',days:7},{as:asWho||'owner'}); return r.data.code; }
  async function owner(){ return login(1000001,'Владелец',{who:'owner'}); }
  async function member(id,who){ const code=await invite(); return login(id,'Участник',{invite:code,who:who||'m'+id}); }
  return {app,cfg,store,clock,outbox,call,hook,startBot,login,consent:CONSENT,invite,owner,member,jar,ya,yandex}; }
const CONSENT={terms:true,pd:true,photos:false};
module.exports={club};
