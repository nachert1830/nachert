/* Вход через бота и регистрация: только по приглашению; ссылку на вход бот присылает только в чат того, кто нажал «Старт»;
   вебхук без секрета не принимается; 10 минут; один раз; токен — только хешем. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {club}=require('./helpers');

test('без приглашения — отказ: бот не даёт ссылку на вход',async()=>{
  const c=club();
  const b=await c.startBot(555,'Чужой','login'); assert.equal(b.token,null); assert.match(b.text,/приглашени/);
  const fake=await c.startBot(556,'Чужой','i_'+'A'.repeat(22)); assert.equal(fake.token,null); assert.match(fake.text,/не найдено/);
  assert.equal((await c.call('GET','/api/me',undefined,{as:'u555'})).status,401);
});

test('вход через бота: приглашение одноразовое, участник потом входит без него, данных — минимум',async()=>{
  const c=club(); assert.equal((await c.owner()).status,200);
  const code=await c.invite();
  const noConsent=await c.login(600,'Аня',{invite:code,consent:null}); assert.equal(noConsent.status,400); assert.equal(noConsent.data.needConsent,true);
  const r=await c.login(600,'Аня',{invite:code}); assert.equal(r.status,200); assert.equal(r.data.isNew,true); assert.equal(r.data.user.role,'member'); assert.equal(r.data.user.name,'Аня');
  assert.equal((await c.login(601,'Боб',{invite:code})).status,403,'приглашение уже использовано');
  const again=await c.login(600,'Аня'); assert.equal(again.status,200); assert.equal(again.data.isNew,false);
  const u=await c.store.get('users',r.data.user.id);
  assert.deepEqual(Object.keys(u).sort(),['consent','createdAt','id','invite','lastLogin','method','name','reminders','role','tgId']);
  assert.equal(u.tgId,'600'); assert.equal(u.reminders.canWrite,true,'нажал «Старт» — бот может писать');
  const logs=await c.store.scan('loginlog'); assert.ok(logs.every(x=>!('ua' in x)),'строка браузера не хранится');
});

test('ссылку на вход получает только чат нажавшего «Старт»; «Войти как …?», один раз, 10 минут, токен — хешем',async()=>{
  const c=club(); await c.owner(); await c.member(700,'m700');
  const n=c.outbox.length; const b=await c.startBot(700,'Аня','login');
  assert.match(b.url,/^http:\/\/localhost:8787\/#\/tg\/[A-Za-z0-9_-]{32}$/);
  assert.ok(c.outbox.slice(n).every(x=>!x.body||String(x.body.chat_id)==='700'),'ссылка ушла только в чат нажавшего');
  assert.ok(!JSON.stringify(c.store._dump()).includes(b.token),'токен входа в базе не лежит');
  const peek=await c.call('POST','/api/auth/bot/redeem',{token:b.token},{as:'x'}); assert.deepEqual(peek.data,{name:'Аня',member:true});
  assert.equal((await c.call('GET','/api/me',undefined,{as:'x'})).status,401,'без нажатия «Войти» сессии нет');
  assert.equal((await c.call('POST','/api/auth/bot/redeem',{token:b.token,confirm:true},{as:'x'})).status,200);
  assert.equal((await c.call('POST','/api/auth/bot/redeem',{token:b.token,confirm:true},{as:'y'})).status,410,'второй раз этой ссылкой не войти');
  const late=await c.startBot(700,'Аня','login'); c.clock.t+=11*60e3;
  assert.equal((await c.call('POST','/api/auth/bot/redeem',{token:late.token,confirm:true},{as:'z'})).status,410,'через 10 минут — устарела');
  assert.equal((await c.call('POST','/api/auth/bot/redeem',{token:'x'.repeat(32),confirm:true},{as:'z'})).status,410,'выдуманная ссылка');
});

test('присланная кем-то ссылка на бота ничего не даёт присылающему',async()=>{
  /* злоумышленник не может начать вход «за» участника: ссылка t.me/<бот>?start=login одинакова для всех,
     а одноразовая ссылка на вход приходит только в чат того, кто нажал «Старт» */
  const c=club(); await c.owner(); await c.member(800,'victim');
  const before=c.outbox.length; await c.startBot(800,'Жертва','login');
  const toOthers=c.outbox.slice(before).filter(x=>x.body&&String(x.body.chat_id)!=='800'); assert.equal(toOthers.length,0);
  assert.equal((await c.call('POST','/api/auth/bot/start',{},{as:'attacker'})).status,404,'начать вход с сайта (старая схема) нельзя');
});

test('вебхук без секрета не принимается — подделать «Старт» нельзя',async()=>{
  const c=club(); await c.owner();
  for(const h of [{},{'x-telegram-bot-api-secret-token':'wrong'}]){
    const n=c.outbox.length;
    const r=await c.call('POST','/api/tg/webhook',JSON.stringify({message:{from:{id:1000001,first_name:'Владелец'},chat:{id:1000001},text:'/start login'}}),{headers:h,as:'evil'});
    assert.equal(r.status,403); assert.equal(c.outbox.length,n,'бот ничего не отправил'); }
});

test('владелец входит без приглашения; без отметок документов аккаунт не создаётся, ссылка не тратится',async()=>{
  const c=club(); const b=await c.startBot(1000001,'Андрей','login'); assert.ok(b.token);
  assert.deepEqual((await c.call('POST','/api/auth/bot/redeem',{token:b.token},{as:'o'})).data,{name:'Андрей',member:false});
  const a=await c.call('POST','/api/auth/bot/redeem',{token:b.token,confirm:true},{as:'o'}); assert.equal(a.status,400); assert.equal(a.data.needConsent,true);
  const ok=await c.call('POST','/api/auth/bot/redeem',{token:b.token,confirm:true,consent:c.consent},{as:'o'}); assert.equal(ok.status,200); assert.equal(ok.data.user.role,'admin');
});

test('сессия: cookie HttpOnly, Secure, SameSite=Lax, __Host-; выход гасит сессию',async()=>{
  const c=club({secure:true}); const r=await c.owner();
  assert.match(r.setCookie,/^__Host-club_sid=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000$/);
  const tok=r.setCookie.split(';')[0].split('=')[1]; assert.ok(!JSON.stringify(c.store._dump()).includes(tok),'в базе — только хеш сессии');
  assert.equal((await c.call('GET','/api/me',undefined,{as:'owner'})).status,200);
  const cookie=c.jar.owner.cookie; await c.call('POST','/api/auth/logout',{},{as:'owner'});
  c.jar.owner={cookie,csrf:''}; assert.equal((await c.call('GET','/api/me',undefined,{as:'owner'})).status,401,'старая cookie не работает');
  assert.equal((await c.owner()).status,200);
  c.clock.t+=31*864e5; assert.equal((await c.call('GET','/api/me',undefined,{as:'owner'})).status,401,'сессия живёт не больше 30 дней');
});

test('CSRF и чужой сайт: без токена, с чужим Origin или Sec-Fetch-Site: cross-site — отказ',async()=>{
  const c=club(); await c.owner(); const b=await c.startBot(1000001,'В','login');
  assert.equal((await c.call('POST','/api/me/profile',{name:'Х'},{as:'owner',csrf:false})).status,403);
  assert.equal((await c.call('POST','/api/me/profile',{name:'Х'},{as:'owner',headers:{origin:'https://evil.example'}})).status,403);
  assert.equal((await c.call('POST','/api/me/profile',{name:'Х'},{as:'owner',headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await c.call('POST','/api/auth/bot/redeem',{token:b.token,confirm:true},{as:'z',headers:{origin:'https://evil.example'}})).status,403,'войти по ссылке с чужого сайта');
  assert.equal((await c.call('POST','/api/me/profile','name=x',{as:'owner',headers:{'content-type':'application/x-www-form-urlencoded'}})).status,415,'форма с чужого сайта');
  assert.equal((await c.call('POST','/api/me/profile',{name:'Андрей'},{as:'owner'})).status,200);
});

test('лимит запросов на вход',async()=>{
  const c=club(); let last;
  for(let i=0;i<31;i++) last=await c.call('POST','/api/auth/bot/redeem',{token:'x'.repeat(32)},{ip:'10.9.9.9'});
  assert.equal(last.status,429); assert.ok(+last.headers['Retry-After']>0);
  assert.equal((await c.call('POST','/api/auth/bot/redeem',{token:'x'.repeat(32)},{ip:'10.8.0.1'})).status,410,'другой адрес — свой лимит');
});

test('журнал входов: успехи и отказы, IP усечён',async()=>{
  const c=club(); await c.owner(); await c.call('POST','/api/auth/bot/redeem',{token:'y'.repeat(32),confirm:true},{ip:'192.168.44.55'});
  const all=await c.store.scan('loginlog'); assert.ok(all.some(x=>x.ok&&x.method==='telegram'));
  const bad=all.find(x=>!x.ok); assert.equal(bad.ip,'192.168.44.0'); assert.match(bad.reason,/устарела/);
  assert.equal((await c.call('GET','/api/me/logins',undefined,{as:'owner'})).data.logins.length,1);
});

test('вход владельца без Telegram: ссылку выдаёт только прямой вызов функции, не шлюз; один раз, 30 минут',async()=>{
  const c=club();
  const o=await c.app.ownerLink(); assert.match(o.link,/^http:\/\/localhost:8787\/#\/tg\/[A-Za-z0-9_-]{32}$/); assert.equal(o.minutes,30);
  const token=o.link.split('#/tg/')[1];
  const peek=await c.call('POST','/api/auth/bot/redeem',{token},{as:'owner'}); assert.equal(peek.status,200); assert.equal(peek.data.member,false);
  const r=await c.call('POST','/api/auth/bot/redeem',{token,confirm:true,consent:c.consent},{as:'owner'}); assert.equal(r.status,200); assert.equal(r.data.user.role,'admin');
  assert.equal((await c.call('POST','/api/auth/bot/redeem',{token,confirm:true},{as:'x'})).status,410,'второй раз не срабатывает');
  const o2=await c.app.ownerLink(); c.clock.t+=31*60e3;
  assert.equal((await c.call('POST','/api/auth/bot/redeem',{token:o2.link.split('#/tg/')[1],confirm:true},{as:'y'})).status,410,'через 30 минут устарела');
  const fresh=await c.app.ownerLink(); const again=await c.call('POST','/api/auth/bot/redeem',{token:fresh.link.split('#/tg/')[1],confirm:true},{as:'z'});
  assert.equal(again.status,200); assert.equal(again.data.user.name,'Владелец'); assert.equal(again.data.isNew,false);
  /* index.handler: событие шлюза всегда с httpMethod — даже с полем club ссылку не получить */
  const idx=require('fs').readFileSync(require('path').join(__dirname,'..','index.js'),'utf8');
  assert.match(idx,/!event\.httpMethod&&event\.club==='owner-login'/);
});
