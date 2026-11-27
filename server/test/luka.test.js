/* Лука (server/lib/luka.js): журнал вопросов без заготовки и 👎 — пишет любой посетитель (с лимитом), читает только ключ. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), crypto=require('crypto');
const {club}=require('./helpers');
const LUKA=require('../lib/luka');
const KEY='luka-test-key', SHA=crypto.createHash('sha256').update(KEY).digest('hex');

test('Лука: вопрос без заготовки пишется без входа, почта и телефон вырезаются; читать — только с ключом',async()=>{
  const c=club({cfg:{luka:LUKA.fromEnv({LUKA_KEY_SHA256:SHA})}});
  let r=await c.call('POST','/api/luka/miss',{src:'ng4:13:3',kind:'miss',q:'почему тут окружность, пиши на a@b.ru или +7 999 123-45-67',conf:22});
  assert.equal(r.status,200);
  r=await c.call('POST','/api/luka/miss',{src:'ng4:13:3',kind:'down',rid:'why'}); assert.equal(r.status,200);
  assert.equal((await c.call('POST','/api/luka/miss',{src:'плохо место!',q:'x y'})).status,400);
  assert.equal((await c.call('POST','/api/luka/miss',{src:'ng4:13:3',q:''})).status,400);
  assert.equal((await c.call('GET','/api/luka/inbox')).status,403);
  assert.equal((await c.call('GET','/api/luka/inbox',undefined,{headers:{'x-luka-key':'нет'}})).status,403);
  r=await c.call('GET','/api/luka/inbox?days=7',undefined,{headers:{'x-luka-key':KEY}});
  assert.equal(r.status,200); assert.equal(r.data.items.length,2);
  const m=r.data.items.find(x=>x.kind==='miss'); assert.match(m.q,/\[почта\]/); assert.match(m.q,/\[номер\]/); assert.doesNotMatch(m.q,/a@b\.ru|999/);
  assert.equal(m.src,'ng4:13:3'); assert.equal(m.conf,22);
});
test('Лука: ключ можно задать и самим паролем (LUKA_KEY)',async()=>{
  const c=club({cfg:{luka:LUKA.fromEnv({LUKA_KEY:KEY})}});
  assert.equal((await c.call('GET','/api/luka/inbox',undefined,{headers:{'x-luka-key':KEY}})).status,200);
});
test('Лука: без ключа на сервере журнал не читается никем; лимит записи по адресу',async()=>{
  const c=club({cfg:{luka:LUKA.fromEnv({})}});
  assert.equal((await c.call('GET','/api/luka/inbox',undefined,{headers:{'x-luka-key':''}})).status,403);
  let last=200; for(let i=0;i<602;i++) last=(await c.call('POST','/api/luka/miss',{src:'task:70:1',q:'вопрос '+i},{ip:'10.9.9.9'})).status;
  assert.equal(last,429);
});
