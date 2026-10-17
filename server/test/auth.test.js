/* Вход и регистрация: Telegram (подпись, свежесть, повтор), ссылка на почту (повтор, просрочка), только по приглашению. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {club}=require('./helpers');
const {verifyLogin,signLogin}=require('../lib/telegram');

test('Telegram: настоящая подпись принимается, поддельная — нет',()=>{
  const now=Date.parse('2026-10-17T10:00:00Z'), d={id:'42',first_name:'Аня',username:'anya',auth_date:String(now/1000-30)}; d.hash=signLogin(d,'1:T');
  assert.equal(verifyLogin(d,'1:T',now).ok,true);
  assert.equal(verifyLogin(Object.assign({},d,{hash:'0'.repeat(64)}),'1:T',now).reason,'подпись не сходится');
  assert.equal(verifyLogin(Object.assign({},d,{id:'43'}),'1:T',now).reason,'подпись не сходится','подменённый id');
  assert.equal(verifyLogin(d,'1:OTHER',now).reason,'подпись не сходится','подпись другого бота');
  const {hash,...noHash}=d; assert.equal(verifyLogin(noHash,'1:T',now).ok,false);
  const old={id:'42',first_name:'Аня',auth_date:String(now/1000-3600)}; old.hash=signLogin(old,'1:T'); assert.equal(verifyLogin(old,'1:T',now,600).reason,'данные входа устарели');
  const fut={id:'42',first_name:'Аня',auth_date:String(now/1000+600)}; fut.hash=signLogin(fut,'1:T'); assert.equal(verifyLogin(fut,'1:T',now).reason,'auth_date из будущего');
  assert.equal(verifyLogin(d,'',now).ok,false,'без токена бота вход закрыт');
});

test('без приглашения — отказ (Telegram и почта)',async()=>{
  const c=club();
  const r=await c.call('POST','/api/auth/telegram',{auth:c.tg(555,'Чужой'),consent:c.consent});
  assert.equal(r.status,403); assert.equal(r.data.needInvite,true);
  assert.equal((await c.call('GET','/api/me')).status,401);
  const e=await c.call('POST','/api/auth/email/start',{email:'stranger@example.com',consent:c.consent});
  assert.equal(e.status,200,'ответ одинаковый — по нему нельзя узнать, есть ли адрес'); assert.equal(c.outbox.filter(x=>x.to==='stranger@example.com').length,0,'письмо не отправлено');
  const fake=await c.call('POST','/api/auth/telegram',{auth:c.tg(556,'Чужой'),invite:'A'.repeat(22),consent:c.consent});
  assert.equal(fake.status,403); assert.match(fake.data.error,/не найдено/);
});

test('Telegram: поддельная подпись, устаревшие данные и повтор отклоняются; приглашение одноразовое',async()=>{
  const c=club(); assert.equal((await c.owner()).status,200);
  const code=await c.invite();
  const forged=c.tg(600,'Поддельный'); forged.first_name='Подмена';
  assert.equal((await c.call('POST','/api/auth/telegram',{auth:forged,invite:code,consent:c.consent},{as:'x'})).status,401);
  assert.equal((await c.call('POST','/api/auth/telegram',{auth:c.tg(600,'Старый',{token:'1:OTHER'}),invite:code,consent:c.consent},{as:'x'})).status,401,'подпись чужого бота');
  assert.equal((await c.call('POST','/api/auth/telegram',{auth:c.tg(600,'Старый',{age:3600}),invite:code,consent:c.consent},{as:'x'})).status,401,'auth_date старше 10 минут');
  const noConsent=await c.call('POST','/api/auth/telegram',{auth:c.tg(600,'Аня'),invite:code},{as:'x'}); assert.equal(noConsent.status,400); assert.equal(noConsent.data.needConsent,true);
  const ok=c.tg(600,'Аня'), r=await c.call('POST','/api/auth/telegram',{auth:ok,invite:code,consent:c.consent},{as:'a'});
  assert.equal(r.status,200); assert.equal(r.data.isNew,true); assert.equal(r.data.user.role,'member'); assert.equal(r.data.user.name,'Аня');
  const replay=await c.call('POST','/api/auth/telegram',{auth:ok,invite:code,consent:c.consent},{as:'b'}); assert.equal(replay.status,401); assert.match(replay.data.error,/уже использованы/);
  const second=await c.call('POST','/api/auth/telegram',{auth:c.tg(601,'Боб'),invite:code,consent:c.consent},{as:'b'}); assert.equal(second.status,403); assert.match(second.data.error,/уже использовано/);
  c.clock.t+=1000; const again=await c.call('POST','/api/auth/telegram',{auth:c.tg(600,'Аня')},{as:'c'}); assert.equal(again.status,200,'участник входит без приглашения'); assert.equal(again.data.isNew,false);
  const u=await c.store.get('users',r.data.user.id); assert.equal(u.tgId,'600'); assert.equal(u.username,undefined,'username не хранится'); assert.equal(u.consent.photos,false);
});

test('почта: ссылка на 15 минут, один раз; токен хранится только хешем; адрес не хранится',async()=>{
  const c=club(); await c.owner(); const code=await c.invite();
  const s=await c.call('POST','/api/auth/email/start',{email:'Student@Example.com ',name:'Маша',invite:code,consent:c.consent},{as:'x'}); assert.equal(s.status,200);
  const mail=c.outbox.find(x=>x.to==='student@example.com'); assert.ok(mail,'письмо ушло'); const tok=/#\/magic\/([A-Za-z0-9_-]+)/.exec(mail.text)[1];
  const dump=JSON.stringify(c.store._dump()); assert.ok(!dump.includes(tok),'токен в базе не лежит'); assert.ok(!/student@example\.com/i.test(dump),'адрес в базе не лежит');
  const v=await c.call('POST','/api/auth/email/verify',{token:tok},{as:'m'}); assert.equal(v.status,200); assert.equal(v.data.user.name,'Маша'); assert.equal(v.data.user.method,'email');
  const replay=await c.call('POST','/api/auth/email/verify',{token:tok},{as:'z'}); assert.equal(replay.status,400); assert.match(replay.data.error,/уже использована/);
  await c.call('POST','/api/auth/email/start',{email:'student@example.com'},{as:'y'});
  const tok2=/#\/magic\/([A-Za-z0-9_-]+)/.exec(c.outbox.filter(x=>x.to==='student@example.com').at(-1).text)[1];
  c.clock.t+=16*60e3; const exp=await c.call('POST','/api/auth/email/verify',{token:tok2},{as:'y'}); assert.equal(exp.status,400); assert.match(exp.data.error,/устарела/);
  assert.equal((await c.call('POST','/api/auth/email/verify',{token:'x'.repeat(43)},{as:'y'})).status,400,'выдуманная ссылка');
});

test('почта: владелец без приглашения; согласие спрашивается, не тратя ссылку',async()=>{
  const c=club(); await c.call('POST','/api/auth/email/start',{email:'owner@example.com'},{as:'o'});
  const tok=/#\/magic\/([A-Za-z0-9_-]+)/.exec(c.outbox.at(-1).text)[1];
  const a=await c.call('POST','/api/auth/email/verify',{token:tok},{as:'o'}); assert.equal(a.status,400); assert.equal(a.data.needConsent,true);
  const b=await c.call('POST','/api/auth/email/verify',{token:tok,consent:c.consent},{as:'o'}); assert.equal(b.status,200); assert.equal(b.data.user.role,'admin');
});

test('сессия: cookie HttpOnly, Secure, SameSite=Lax, __Host-; выход гасит сессию',async()=>{
  const c=club({secure:true}); const r=await c.owner();
  assert.match(r.setCookie,/^__Host-club_sid=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000$/);
  const tok=r.setCookie.split(';')[0].split('=')[1]; assert.ok(!JSON.stringify(c.store._dump()).includes(tok),'в базе — только хеш сессии');
  assert.equal((await c.call('GET','/api/me',undefined,{as:'owner'})).status,200);
  const cookie=c.jar.owner.cookie; await c.call('POST','/api/auth/logout',{},{as:'owner'});
  c.jar.owner={cookie,csrf:''}; assert.equal((await c.call('GET','/api/me',undefined,{as:'owner'})).status,401,'старая cookie не работает');
  c.clock.t+=1000; const r2=await c.owner(); assert.equal(r2.status,200);
  c.clock.t+=31*864e5; assert.equal((await c.call('GET','/api/me',undefined,{as:'owner'})).status,401,'сессия живёт не больше 30 дней');
});

test('CSRF и чужой сайт: без токена, с чужим Origin или Sec-Fetch-Site: cross-site — отказ',async()=>{
  const c=club(); await c.owner();
  assert.equal((await c.call('POST','/api/me/profile',{name:'Х'},{as:'owner',csrf:false})).status,403);
  assert.equal((await c.call('POST','/api/me/profile',{name:'Х'},{as:'owner',headers:{origin:'https://evil.example'}})).status,403);
  assert.equal((await c.call('POST','/api/me/profile',{name:'Х'},{as:'owner',headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await c.call('POST','/api/auth/telegram',{auth:c.tg(1000001,'В')},{as:'z',headers:{origin:'https://evil.example'}})).status,403,'вход с чужого сайта');
  assert.equal((await c.call('POST','/api/me/profile','name=x',{as:'owner',headers:{'content-type':'application/x-www-form-urlencoded'}})).status,415,'форма с чужого сайта');
  assert.equal((await c.call('POST','/api/me/profile',{name:'Андрей'},{as:'owner'})).status,200);
});

test('лимит запросов на вход',async()=>{
  const c=club(); let last;
  for(let i=0;i<21;i++) last=await c.call('POST','/api/auth/telegram',{auth:{id:'1',hash:'0'.repeat(64),auth_date:'1'}},{ip:'10.9.9.9'});
  assert.equal(last.status,429); assert.ok(+last.headers['Retry-After']>0);
  assert.equal((await c.call('POST','/api/auth/telegram',{auth:{id:'1',hash:'0'.repeat(64),auth_date:'1'}},{ip:'10.8.0.1'})).status,401,'другой адрес — свой лимит');
  for(let i=0;i<3;i++) await c.call('POST','/api/auth/email/start',{email:'a@b.ru'},{ip:'10.7.0.'+i});
  assert.equal((await c.call('POST','/api/auth/email/start',{email:'a@b.ru'},{ip:'10.6.0.1'})).status,429,'не больше 3 писем на адрес за 15 минут');
});

test('журнал входов: успехи и отказы, IP усечён',async()=>{
  const c=club(); await c.owner(); await c.call('POST','/api/auth/telegram',{auth:c.tg(9,'Х')},{ip:'192.168.44.55'});
  const all=await c.store.scan('loginlog'); assert.ok(all.some(x=>x.ok&&x.method==='telegram'));
  const bad=all.find(x=>!x.ok); assert.equal(bad.ip,'192.168.44.0'); assert.match(bad.reason,/приглашени/);
  const mine=await c.call('GET','/api/me/logins',undefined,{as:'owner'}); assert.equal(mine.data.logins.length,1);
});
