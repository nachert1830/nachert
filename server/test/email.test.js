/* Вход по почте: код 6 цифр, 10 минут, 5 попыток, по приглашению; адрес почты не хранится. Публичная ссылка-приглашение. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {club}=require('./helpers');
const {createApp}=require('../lib/app');
function withMail(){ const c=club(), sent=[]; const app=createApp({cfg:c.cfg,store:c.store,clock:()=>c.clock.t,log:{log(){},error(){}},bot:{send:async()=>({ok:true}),api:async()=>({ok:true})},mail:{enabled:true,send:async m=>{ sent.push(m); return {ok:true}; }}});
  c.app.handle=app.handle; c.sent=sent; c.code=()=>/(\d{6})/.exec(sent[sent.length-1].subject)[1]; return c; }

test('почта: по приглашению — код, «Войти — an•••@…?», регистрация; адрес почты нигде не хранится',async()=>{
  const c=withMail(); await c.owner(); const code=await c.invite();
  assert.equal((await c.call('POST','/api/auth/email/start',{email:'Anna.Test@Example.ru'},{as:'a'})).status,403,'без приглашения — отказ');
  const st=await c.call('POST','/api/auth/email/start',{email:'Anna.Test@Example.ru',invite:code},{as:'a'}); assert.equal(st.status,200); assert.equal(st.data.to,'an•••@example.ru');
  assert.equal(c.sent.length,1); assert.equal(c.sent[0].to,'anna.test@example.ru');
  const bad=await c.call('POST','/api/auth/email/verify',{email:'anna.test@example.ru',code:'000000'},{as:'a'}); assert.equal(bad.status,400);
  const v=await c.call('POST','/api/auth/email/verify',{email:'anna.test@example.ru',code:c.code()},{as:'a'}); assert.equal(v.status,200);
  const peek=await c.call('POST','/api/auth/bot/redeem',{token:v.data.token},{as:'a'}); assert.equal(peek.data.method,'email'); assert.equal(peek.data.label,'an•••@example.ru');
  const r=await c.call('POST','/api/auth/bot/redeem',{token:v.data.token,confirm:true,consent:c.consent},{as:'a'}); assert.equal(r.status,200); assert.equal(r.data.isNew,true);
  const dump=JSON.stringify(c.store._dump?c.store._dump():await Promise.all(['users','identities','botlogin','loginlog'].map(t=>c.store.scan(t))));
  assert.ok(!/anna\.test|anna\.test@example/i.test(dump),'адреса почты в базе нет (только маска an•••@… на 10 минут в записи входа)');
  assert.equal((await c.call('POST','/api/auth/email/verify',{email:'anna.test@example.ru',code:c.code()},{as:'a'})).status,410,'код один раз');
  await c.call('POST','/api/auth/email/start',{email:'anna.test@example.ru'},{as:'a2'}); const again=await c.call('POST','/api/auth/email/verify',{email:'anna.test@example.ru',code:c.code()},{as:'a2'});
  assert.equal(again.status,200,'участник — без приглашения');
});

test('почта: 5 попыток, 10 минут, лимиты',async()=>{
  const c=withMail(); const code=await (async()=>{ await c.owner(); return c.invite(); })();
  await c.call('POST','/api/auth/email/start',{email:'b@ex.ru',invite:code},{as:'b'});
  for(let i=0;i<5;i++) assert.equal((await c.call('POST','/api/auth/email/verify',{email:'b@ex.ru',code:'111111'},{as:'b'})).status,400);
  assert.equal((await c.call('POST','/api/auth/email/verify',{email:'b@ex.ru',code:c.code()},{as:'b'})).status,429,'после 5 ошибок и верный код не принимается');
  await c.call('POST','/api/auth/email/start',{email:'b@ex.ru',invite:code},{as:'b'}); c.clock.t+=11*60e3;
  assert.equal((await c.call('POST','/api/auth/email/verify',{email:'b@ex.ru',code:c.code()},{as:'b'})).status,410);
  assert.equal((await c.call('POST','/api/auth/email/start',{email:'не почта',invite:code},{as:'b'})).status,400);
});

test('публичная ссылка: много регистраций до лимита, отзыв закрывает',async()=>{
  const c=club(); await c.owner();
  const r=await c.call('POST','/api/admin/invites',{label:'друзья',days:7,multi:true,uses:3},{as:'owner'}); assert.equal(r.data.invite.multi,true);
  for(const id of [501,502,503]) assert.equal((await c.login(id,'Друг',{invite:r.data.code})).status,200);
  assert.equal((await c.login(504,'Друг',{invite:r.data.code})).status,403,'лимит');
  const r2=await c.call('POST','/api/admin/invites',{label:'группа',days:7,multi:true,uses:10},{as:'owner'});
  assert.equal((await c.login(601,'А',{invite:r2.data.code})).status,200);
  assert.equal((await c.call('POST','/api/admin/invites/revoke',{h:r2.data.invite.h},{as:'owner'})).status,200);
  assert.equal((await c.login(602,'Б',{invite:r2.data.code})).status,403,'отозвана');
  const ov=await c.call('GET','/api/admin/overview',undefined,{as:'owner'}); const i=ov.data.invites.find(x=>x.label==='друзья'); assert.equal(i.uses,3); assert.equal(i.maxUses,3);
});
