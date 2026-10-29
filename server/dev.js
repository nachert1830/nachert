/* Локальная эмуляция клуба: node server/dev.js  →  http://localhost:8787
   Без аккаунтов и ключей: бот эмулируется, база — файл server/.data/dev-db.json (или память с --memory).
   Тот же обработчик, что в облаке (lib/app.js), плюс служебные адреса /dev/* — их в облаке нет:
     POST /dev/bot-login {id, first_name, start} — «нажать Старт» у бота за участника; ответ — ссылка из кнопки «Войти в клуб»
     POST /dev/owner-login           — ссылка входа владельца, как от «node server/tools/login.js»
     /dev/ya/authorize, /dev/ya/token, /dev/ya/info — поддельный Яндекс ID (форма «войти как …» вместо oauth.yandex.ru)
     /dev/outbox                     — сообщения бота
     POST /dev/remind                — прогнать напоминания сейчас;  POST /dev/invite — новое приглашение
     POST /dev/clock {offsetMs}      — сдвиг часов сервера (только с --test)
   Ключи: --port=8787  --memory  --fresh (стереть файл базы)  --test  --quiet
          --site-port=8788 — ещё и «сайт» как GitHub Pages: http://localhost:8788/lk/ ходит в API на другом адресе (CORS, токен в заголовке)
   Владелец в эмуляции — Telegram id 1000001 (ADMIN_TG_IDS) или логин Яндекса owner (ADMIN_YA_LOGINS). */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto');
const {createApp}=require('./lib/app');
const {fromEvent}=require('./lib/http');
const {memoryStore}=require('./lib/store/memory');
const {botClient}=require('./lib/telegram');
const {devMail}=require('./lib/mail');
const C=require('./lib/crypto');
const {eyesFromEnv}=require('./lib/eyes');

const arg=(k,d)=>{ const a=process.argv.find(x=>x==='--'+k||x.startsWith('--'+k+'=')); return a?(a.includes('=')?a.split('=')[1]:true):d; };
const SITE=+arg('site-port',0)||0, PORT=+arg('port',process.env.PORT||8787), MEM=!!arg('memory'), TEST=!!arg('test'), QUIET=!!arg('quiet');
const DATA=path.join(__dirname,'.data'), DBF=path.join(DATA,'dev-db.json');
if(process.env.NODE_ENV==='production'){ console.error('dev.js — только для локальной эмуляции'); process.exit(1); }
if(arg('fresh')&&fs.existsSync(DBF)) fs.unlinkSync(DBF);

const BOT_TOKEN='1000000:DEV-local-emulation-not-a-secret';
if(!MEM) fs.mkdirSync(DATA,{recursive:true});
const origin='http://localhost:'+PORT, site=SITE?'http://localhost:'+SITE:null;
const cfg={dev:true,limitScale:TEST?20:1,openSignup:!arg('invites'),origin,secure:false,botToken:BOT_TOKEN,botName:'nachert_club_dev_bot',webhookSecret:'dev-webhook-secret',
  adminTg:['1000001'],mainUrl:process.env.MAIN_URL||'https://nachert1830.ru',week1:process.env.CLUB_WEEK1||'',
  yandex:{clientId:'dev-client',secret:'dev-secret',authUrl:origin+'/dev/ya/authorize',tokenUrl:origin+'/dev/ya/token',infoUrl:origin+'/dev/ya/info',revokeUrl:origin+'/dev/ya/revoke'},
  adminYa:['owner'],fronts:site?[origin,site]:[origin],frontUrl:site?site+'/lk/':origin+'/',
  /* как в облаке: официальный вход Telegram — только на «сайте» (у @BotFather один домен), на адресе функции — бот */
  tgLogin:{url:origin+'/dev/tg/auth',origins:site?[site]:[]},
};
const yaCodes=new Map();
const page=(r,html)=>{ r.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"}); r.end(html); };
const escH=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const outbox=[]; let offset=0;
const log=QUIET?{log(){},error:(...a)=>console.error(...a)}:console;
const store=memoryStore(MEM?null:DBF);
/* ИИ-зрение — как в облаке, из переменных EYES_URL, EYES_KEY, EYES_MODEL (по умолчанию выключено: нет ключа) */
const app=createApp({cfg,store,clock:()=>Date.now()+offset,log,bot:botClient({dev:true,outbox}),mail:devMail(outbox),eyes:eyesFromEnv(process.env)});

async function newInvite(label,days){ const code=C.token(16), t=Date.now()+offset;
  await store.put('invites',{id:C.sha256(code),label:label||'эмуляция',role:'member',createdAt:t,expiresAt:t+(days||14)*864e5,createdBy:'dev'});
  return {code,link:cfg.frontUrl+'#/invite/'+code}; }

function readBody(req){ return new Promise(res=>{ const ch=[]; let n=0; req.on('data',c=>{ n+=c.length; if(n<1e6) ch.push(c); }); req.on('end',()=>res(Buffer.concat(ch).toString('utf8'))); }); }
function send(r,status,obj){ r.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); r.end(JSON.stringify(obj)); }

const srv=http.createServer(async(q,r)=>{
  try{
    const u=new URL(q.url,origin), body=await readBody(q);
    if(q.headers.host!=='localhost:'+PORT){ r.writeHead(302,{Location:origin+u.pathname+u.search}); return r.end(); }
    if(u.pathname.startsWith('/dev/')){
      if(site&&q.headers.origin===site){ r.setHeader('Access-Control-Allow-Origin',site); r.setHeader('Access-Control-Allow-Headers','content-type'); if(q.method==='OPTIONS'){ r.writeHead(204); return r.end(); } }
      /* поддельный Яндекс ID: форма вместо oauth.yandex.ru, затем возврат на redirect_uri с кодом */
      if(u.pathname==='/dev/ya/authorize'){ const p=u.searchParams;
        if(p.get('client_id')!==cfg.yandex.clientId||p.get('redirect_uri')!==origin+'/api/auth/yandex/callback') return send(r,400,{error:'неверный client_id или redirect_uri'});
        return page(r,`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Яндекс ID (эмуляция)</title>
<body style="font:16px system-ui;max-width:420px;margin:40px auto;padding:0 16px"><h1 style="font-size:22px">Яндекс ID — эмуляция</h1><p>Войти в «Клуб Начерта» как:</p>
<form action="/dev/ya/approve" method="get"><input type="hidden" name="state" value="${escH(p.get('state')||'')}">
<p><label>Yandex id<br><input name="id" value="5000002"></label></p><p><label>Имя<br><input name="first_name" value="Тестировщик"></label></p>
<p><label>Логин (owner — владелец)<br><input name="login" value="tester"></label></p><p><button id="yaAllow">Разрешить</button> <button name="deny" value="1" id="yaDeny">Отказать</button></p></form>`); }
      /* поддельный oauth.telegram.org: форма → данные с подписью HMAC(SHA-256(токен бота)) → return_to#tgAuthResult=… */
      if(u.pathname==='/dev/tg/auth'){ const p=u.searchParams, ret=p.get('return_to')||'';
        if(p.get('bot_id')!==BOT_TOKEN.split(':')[0]||!cfg.tgLogin.origins.includes(p.get('origin'))||!ret.startsWith(p.get('origin')+'/')) return send(r,400,{error:'Bot domain invalid'});
        return page(r,`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Telegram (эмуляция)</title>
<body style="font:16px system-ui;max-width:420px;margin:40px auto;padding:0 16px"><h1 style="font-size:22px">Telegram — эмуляция</h1><p>Вход на сайт ${escH(p.get('origin'))} — подтверждение в приложении Telegram.</p>
<form action="/dev/tg/approve" method="get"><input type="hidden" name="return_to" value="${escH(ret)}"><input type="hidden" name="origin" value="${escH(p.get('origin'))}">
<p><label>Telegram id<br><input name="id" value="1000002"></label></p><p><label>Имя<br><input name="first_name" value="Тестировщик"></label></p><p><button id="tgAllow">Подтвердить</button></p></form>`); }
      if(u.pathname==='/dev/tg/approve'){ const p=u.searchParams, ret=p.get('return_to')||'';
        if(!cfg.tgLogin.origins.includes(p.get('origin'))||!ret.startsWith(p.get('origin')+'/')) return send(r,400,{error:'bad return_to'});
        const d={id:+(String(p.get('id')||'1000002').replace(/\D/g,'').slice(0,12)||1000002),first_name:p.get('first_name')||'Тестировщик',username:'dev_user',auth_date:Math.floor((Date.now()+offset)/1000)};
        const dcs=Object.keys(d).sort().map(k=>k+'='+d[k]).join('\n'); d.hash=crypto.createHmac('sha256',crypto.createHash('sha256').update(BOT_TOKEN).digest()).update(dcs).digest('hex');
        r.writeHead(302,{Location:ret.split('#')[0]+'#tgAuthResult='+Buffer.from(JSON.stringify(d)).toString('base64').replace(/=+$/,'')}); return r.end(); }
      if(u.pathname==='/dev/ya/approve'){ const p=u.searchParams, back=new URL(origin+'/api/auth/yandex/callback'); back.searchParams.set('state',p.get('state')||'');
        if(p.get('deny')) back.searchParams.set('error','access_denied');
        else { const code='dev'+C.token(8); yaCodes.set(code,{id:String(p.get('id')||'5000002').replace(/\D/g,'').slice(0,18)||'5000002',first_name:p.get('first_name')||'Тестировщик',login:p.get('login')||'tester'}); back.searchParams.set('code',code); }
        r.writeHead(302,{Location:back.toString()}); return r.end(); }
      if(u.pathname==='/dev/ya/token'&&q.method==='POST'){ const b=new URLSearchParams(body), prof=yaCodes.get(b.get('code'));
        if(b.get('client_secret')!==cfg.yandex.secret||!prof) return send(r,400,{error:'invalid_grant'}); yaCodes.delete(b.get('code'));
        const at='devAT'+C.token(8); yaCodes.set(at,prof); return send(r,200,{access_token:at,token_type:'bearer'}); }
      if(u.pathname==='/dev/ya/info'){ const prof=yaCodes.get(String(q.headers.authorization||'').replace(/^OAuth /,'')); return prof?send(r,200,Object.assign({client_id:cfg.yandex.clientId},prof)):send(r,401,{}); }
      if(u.pathname==='/dev/ya/revoke'&&q.method==='POST'){ yaCodes.delete(new URLSearchParams(body).get('access_token')); return send(r,200,{status:'ok'}); }
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

/* «сайт» как GitHub Pages: /lk/* — личный кабинет (/club/ — старый адрес, перенаправление); config.js указывает на API на другом адресе, в CSP — тот же адрес */
const ROOT=path.join(__dirname,'..'), TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const siteSrv=SITE?http.createServer((q,r)=>{ let p=decodeURIComponent(new URL(q.url,'http://x').pathname); if(p==='/lk'||p==='/club') { r.writeHead(301,{Location:p+'/'}); return r.end(); }
  if(p.endsWith('/')) p+='index.html'; if(!/^\/(lk|club|lab|core)\//.test(p)||p.includes('..')){ r.writeHead(404); return r.end('нет'); }
  if(p==='/lk/config.js'){ r.writeHead(200,{'Content-Type':TYPES['.js']}); return r.end("window.CLUB_API='"+origin+"';\n"); }
  const f=path.join(ROOT,p); if(!fs.existsSync(f)||!fs.statSync(f).isFile()){ r.writeHead(404); return r.end('нет'); }
  let b=fs.readFileSync(f); if(p==='/lk/index.html') b=Buffer.from(b.toString('utf8').replace(/connect-src [^;]*;/,"connect-src 'self' "+origin+";"));
  r.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-cache'}); r.end(b); }):null;
if(siteSrv) siteSrv.listen(SITE,'127.0.0.1');

srv.listen(PORT,'127.0.0.1',async()=>{
  if(!QUIET){ const inv=await newInvite('приглашение из консоли');
    console.log('\n  Клуб Начерта (локальная эмуляция): '+origin+'\n'+
      '  Владелец: «Войти через Telegram» → блок «Эмуляция бота», id 1000001\n'+
      '  Приглашение для тестировщика: '+inv.link+'\n'+
      (site?'  Как на сайте (GitHub Pages): '+site+'/lk/\n':'')+
      '  Яндекс ID: эмуляция, логин owner — владелец\n'+
      '  Сообщения бота: '+origin+'/dev/outbox\n'+
      '  База: '+(MEM?'в памяти':DBF)+'\n'); }
  if(!TEST) setInterval(()=>app.remind().catch(e=>console.error('напоминания',e)),60e3).unref();
  if(process.send) process.send({ready:true,port:PORT});
});
module.exports={srv};
