/* Локальная эмуляция клуба: node server/dev.js  →  http://localhost:8787
   Без аккаунтов и ключей: бот эмулируется, база — файл server/.data/dev-db.json (или память с --memory).
   Тот же обработчик, что в облаке (lib/app.js), плюс служебные адреса /dev/* — их в облаке нет:
     POST /dev/bot-login {id, first_name, start} — «нажать Старт» у бота за участника; ответ — ссылка из кнопки «Войти в клуб»
     POST /dev/owner-login           — ссылка входа владельца, как от «node server/tools/login.js»
     /dev/outbox                     — сообщения бота
     POST /dev/remind                — прогнать напоминания сейчас;  POST /dev/invite — новое приглашение
     POST /dev/clock {offsetMs}      — сдвиг часов сервера (только с --test)
   Ключи: --port=8787  --memory  --fresh (стереть файл базы)  --test  --quiet
   Владелец в эмуляции — Telegram id 1000001 (ADMIN_TG_IDS). */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto');
const {createApp}=require('./lib/app');
const {fromEvent}=require('./lib/http');
const {memoryStore}=require('./lib/store/memory');
const {botClient}=require('./lib/telegram');
const C=require('./lib/crypto');

const arg=(k,d)=>{ const a=process.argv.find(x=>x==='--'+k||x.startsWith('--'+k+'=')); return a?(a.includes('=')?a.split('=')[1]:true):d; };
const PORT=+arg('port',process.env.PORT||8787), MEM=!!arg('memory'), TEST=!!arg('test'), QUIET=!!arg('quiet');
const DATA=path.join(__dirname,'.data'), DBF=path.join(DATA,'dev-db.json');
if(process.env.NODE_ENV==='production'){ console.error('dev.js — только для локальной эмуляции'); process.exit(1); }
if(arg('fresh')&&fs.existsSync(DBF)) fs.unlinkSync(DBF);

const BOT_TOKEN='1000000:DEV-local-emulation-not-a-secret';
if(!MEM) fs.mkdirSync(DATA,{recursive:true});
const origin='http://localhost:'+PORT;
const cfg={dev:true,origin,secure:false,botToken:BOT_TOKEN,botName:'nachert_club_dev_bot',webhookSecret:'dev-webhook-secret',
  adminTg:['1000001'],mainUrl:process.env.MAIN_URL||'https://nachert1830.ru',week1:process.env.CLUB_WEEK1||''};
const outbox=[]; let offset=0;
const log=QUIET?{log(){},error:(...a)=>console.error(...a)}:console;
const store=memoryStore(MEM?null:DBF);
const app=createApp({cfg,store,clock:()=>Date.now()+offset,log,bot:botClient({dev:true,outbox})});

async function newInvite(label,days){ const code=C.token(16), t=Date.now()+offset;
  await store.put('invites',{id:C.sha256(code),label:label||'эмуляция',role:'member',createdAt:t,expiresAt:t+(days||14)*864e5,createdBy:'dev'});
  return {code,link:origin+'/#/invite/'+code}; }

function readBody(req){ return new Promise(res=>{ const ch=[]; let n=0; req.on('data',c=>{ n+=c.length; if(n<1e6) ch.push(c); }); req.on('end',()=>res(Buffer.concat(ch).toString('utf8'))); }); }
function send(r,status,obj){ r.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); r.end(JSON.stringify(obj)); }

const srv=http.createServer(async(q,r)=>{
  try{
    const u=new URL(q.url,origin), body=await readBody(q);
    if(q.headers.host!=='localhost:'+PORT){ r.writeHead(302,{Location:origin+u.pathname+u.search}); return r.end(); }
    if(u.pathname.startsWith('/dev/')){
      if(u.pathname==='/dev/owner-login'&&q.method==='POST') return send(r,200,await app.ownerLink());
      if(u.pathname==='/dev/bot-login'&&q.method==='POST'){ let b={}; try{ b=JSON.parse(body||'{}'); }catch(e){}
        /* как будто участник нажал «Старт» у бота: start=<param>; в ответ — ссылка из кнопки «Войти в клуб» (или текст отказа) */
        const id=String(b.id||'1000002').replace(/\D/g,'').slice(0,12)||'1000002', from={id:+id,first_name:String(b.first_name||'Тестировщик').slice(0,40)};
        const act=await app.onUpdate({message:{from,chat:{id:+id},text:'/start '+String(b.start||'login').slice(0,64)}})||{}; if(act.method) outbox.push({to:'telegram',method:act.method,body:act,at:Date.now()});
        const k=act.reply_markup&&act.reply_markup.inline_keyboard; return send(r,200,{link:k?k[0][0].url:null,text:act.text||''}); }
      if(u.pathname==='/dev/outbox') return send(r,200,{mail:outbox.filter(x=>x.to!=='telegram'),telegram:outbox.filter(x=>x.to==='telegram')});
      if(u.pathname==='/dev/remind'&&q.method==='POST') return send(r,200,await app.remind());
      if(u.pathname==='/dev/invite'&&q.method==='POST'){ let b={}; try{ b=JSON.parse(body||'{}'); }catch(e){} return send(r,200,await newInvite(b.label,b.days)); }
      if(u.pathname==='/dev/clock'&&q.method==='POST'&&TEST){ const b=JSON.parse(body||'{}'); if(typeof b.now==='number') offset=b.now-Date.now(); else offset=+b.offsetMs||0; return send(r,200,{now:Date.now()+offset}); }
      if(u.pathname==='/dev/reset'&&q.method==='POST'&&TEST){ store._reset(); outbox.length=0; offset=0; return send(r,200,{ok:true}); }
      if(u.pathname==='/dev/webhook'&&q.method==='POST'){ const res=await app.handle({method:'POST',path:'/api/tg/webhook',query:{},headers:{'x-telegram-bot-api-secret-token':cfg.webhookSecret,'content-type':'application/json'},body,ip:'127.0.0.1',cookies:{}}); return send(r,res.statusCode,JSON.parse(res.body)); }
      return send(r,404,{error:'нет такого служебного адреса'}); }
    const headers={}; for(let i=0;i<q.rawHeaders.length;i+=2) headers[q.rawHeaders[i]]=q.rawHeaders[i+1];
    const ev={httpMethod:q.method,path:u.pathname,url:u.pathname+u.search,headers,queryStringParameters:Object.fromEntries(u.searchParams),body,isBase64Encoded:false,
      requestContext:{identity:{sourceIp:(q.socket.remoteAddress||'').replace(/^::ffff:/,'')}}};
    const req=fromEvent(ev); if(req.method==='HEAD') req.method='GET';
    const res=await app.handle(req);
    const h=Object.assign({},res.headers); if(res.multiValueHeaders&&res.multiValueHeaders['Set-Cookie']) h['Set-Cookie']=res.multiValueHeaders['Set-Cookie'];
    r.writeHead(res.statusCode,h); r.end(res.isBase64Encoded?Buffer.from(res.body,'base64'):res.body);
  }catch(e){ console.error(e); if(!r.headersSent) send(r,500,{error:String(e.message)}); }
});

srv.listen(PORT,'127.0.0.1',async()=>{
  if(!QUIET){ const inv=await newInvite('приглашение из консоли');
    console.log('\n  Клуб Начерта (локальная эмуляция): '+origin+'\n'+
      '  Владелец: «Войти через Telegram» → блок «Эмуляция бота», id 1000001\n'+
      '  Приглашение для тестировщика: '+inv.link+'\n'+
      '  Сообщения бота: '+origin+'/dev/outbox\n'+
      '  База: '+(MEM?'в памяти':DBF)+'\n'); }
  if(!TEST) setInterval(()=>app.remind().catch(e=>console.error('напоминания',e)),60e3).unref();
  if(process.send) process.send({ready:true,port:PORT});
});
module.exports={srv};
