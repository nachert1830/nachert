/* Вход через бота и регистрация: только по приглашению; подтвердить может только тот, кто нажал «Старт»;
   вебхук без секрета не принимается; 10 минут; один раз; токен — только хешем. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {club}=require('./helpers');

test('без приглашения — отказ',async()=>{
  const c=club();
  const r=await c.login(555,'Чужой'); assert.equal(r.status,403); assert.equal(r.data.needInvite,true);
  assert.equal((await c.call('GET','/api/me',undefined,{as:'u555'})).status,401);
  const fake=await c.call('POST','/api/auth/bot/start',{invite:'A'.repeat(22),consent:c.consent}); assert.equal(fake.status,403); assert.match(fake.data.error,/не найдено/);
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

test('чужое подтверждение, «Это не я», просрочка и повтор отклоняются; токен в базе только хешем',async()=>{
  const c=club(); await c.owner(); const code=await c.invite();
  const s=await c.call('POST','/api/auth/bot/start',{invite:code,consent:c.consent},{as:'victim'}); const tok=s.data.token;
  assert.match(s.data.link,/^https:\/\/t\.me\/club_bot\?start=l_[A-Za-z0-9_-]{32}$/);
  assert.ok(!JSON.stringify(c.store._dump()).includes(tok),'токен входа в базе не лежит');
  assert.equal((await c.call('POST','/api/auth/bot/poll',{token:tok},{as:'victim'})).data.status,'pending');
  await c.startBot(tok,700,'Аня');
  assert.equal((await c.call('POST','/api/auth/bot/poll',{token:tok},{as:'victim'})).data.status,'asked');
  await c.press(tok,701,'ok');   /* кнопку нажимает другой человек — не засчитывается */
  assert.equal((await c.call('POST','/api/auth/bot/poll',{token:tok},{as:'victim'})).data.status,'asked');
  await c.startBot(tok,701,'Злоумышленник');   /* второй «Старт» по той же ссылке не перехватывает вход */
  await c.press(tok,701,'ok'); assert.equal((await c.call('POST','/api/auth/bot/poll',{token:tok},{as:'victim'})).data.status,'asked');
  await c.press(tok,700,'no');
  const d=await c.call('POST','/api/auth/bot/poll',{token:tok},{as:'victim'}); assert.equal(d.status,403); assert.equal(d.data.denied,true);
  const s2=await c.call('POST','/api/auth/bot/start',{invite:code,consent:c.consent},{as:'v2'}); await c.startBot(s2.data.token,700,'Аня'); await c.press(s2.data.token,700,'ok');
  const ok=await c.call('POST','/api/auth/bot/poll',{token:s2.data.token},{as:'v2'}); assert.equal(ok.status,200);
  const rep=await c.call('POST','/api/auth/bot/poll',{token:s2.data.token},{as:'v3'}); assert.equal(rep.status,410,'второй раз этим входом не войти');
  const s3=await c.call('POST','/api/auth/bot/start',{},{as:'late'}); c.clock.t+=11*60e3; await c.startBot(s3.data.token,700,'Аня');
  assert.ok(c.outbox.some(x=>x.body&&/устарела/.test(x.body.text||'')),'бот говорит, что ссылка устарела');
  assert.equal((await c.call('POST','/api/auth/bot/poll',{token:s3.data.token},{as:'late'})).status,410);
  assert.equal((await c.call('POST','/api/auth/bot/poll',{token:'x'.repeat(32)},{as:'late'})).status,410,'выдуманный токен');
});

test('вебхук без секрета не принимается — подделать «Старт» и «Войти» нельзя',async()=>{
  const c=club(); await c.owner(); const code=await c.invite();
  const s=await c.call('POST','/api/auth/bot/start',{invite:code,consent:c.consent},{as:'x'});
  for(const h of [{},{'x-telegram-bot-api-secret-token':'wrong'}]){
    const r=await c.call('POST','/api/tg/webhook',JSON.stringify({message:{from:{id:1000001},text:'/start l_'+s.data.token}}),{headers:h,as:'evil'}); assert.equal(r.status,403); }
  assert.equal((await c.call('POST','/api/auth/bot/poll',{token:s.data.token},{as:'x'})).data.status,'pending');
});

test('владелец входит без приглашения; согласие спрашивается, не тратя подтверждённый вход',async()=>{
  const c=club(); const s=await c.call('POST','/api/auth/bot/start',{},{as:'o'}); await c.startBot(s.data.token,1000001,'Андрей'); await c.press(s.data.token,1000001,'ok');
  const a=await c.call('POST','/api/auth/bot/poll',{token:s.data.token},{as:'o'}); assert.equal(a.status,400); assert.equal(a.data.needConsent,true);
  const b=await c.call('POST','/api/auth/bot/poll',{token:s.data.token,consent:c.consent},{as:'o'}); assert.equal(b.status,200); assert.equal(b.data.user.role,'admin');
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
  const c=club(); await c.owner();
  assert.equal((await c.call('POST','/api/me/profile',{name:'Х'},{as:'owner',csrf:false})).status,403);
  assert.equal((await c.call('POST','/api/me/profile',{name:'Х'},{as:'owner',headers:{origin:'https://evil.example'}})).status,403);
  assert.equal((await c.call('POST','/api/me/profile',{name:'Х'},{as:'owner',headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await c.call('POST','/api/auth/bot/start',{},{as:'z',headers:{origin:'https://evil.example'}})).status,403,'начать вход с чужого сайта');
  assert.equal((await c.call('POST','/api/me/profile','name=x',{as:'owner',headers:{'content-type':'application/x-www-form-urlencoded'}})).status,415,'форма с чужого сайта');
  assert.equal((await c.call('POST','/api/me/profile',{name:'Андрей'},{as:'owner'})).status,200);
});

test('лимит запросов на вход',async()=>{
  const c=club(); let last;
  for(let i=0;i<21;i++) last=await c.call('POST','/api/auth/bot/start',{},{ip:'10.9.9.9'});
  assert.equal(last.status,429); assert.ok(+last.headers['Retry-After']>0);
  assert.equal((await c.call('POST','/api/auth/bot/start',{},{ip:'10.8.0.1'})).status,200,'другой адрес — свой лимит');
});

test('журнал входов: успехи и отказы, IP усечён',async()=>{
  const c=club(); await c.owner(); await c.login(9,'Х',{who:'x'});
  const all=await c.store.scan('loginlog'); assert.ok(all.some(x=>x.ok&&x.method==='telegram'));
  const bad=all.find(x=>!x.ok); assert.equal(bad.ip,'10.1.2.0'); assert.match(bad.reason,/приглашени/);
  assert.equal((await c.call('GET','/api/me/logins',undefined,{as:'owner'})).data.logins.length,1);
});
