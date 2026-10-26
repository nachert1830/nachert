/* Группы, журнал действий и живой пульт владельца: кто в кабинете, что делает, где спотыкается. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {club}=require('./helpers');

test('группа: при регистрации и в профиле — только в формате расписания, видна владельцу',async()=>{
  const c=club({cfg:{openSignup:true}}); await c.owner();
  const y=await c.yandex({id:'9001',first_name:'Гоша'},{who:'g'}); assert.equal(y.status,200);
  assert.equal((await c.call('POST','/api/me/profile',{group:'иу5 11б'},{as:'g'})).status,200,'пробел вместо дефиса — тоже понимаем');
  assert.equal((await c.call('GET','/api/me',undefined,{as:'g'})).data.user.group,'ИУ5-11Б');
  assert.equal((await c.call('POST','/api/me/profile',{group:'привет мир'},{as:'g'})).status,400,'не группа — отказ');
  const ov=(await c.call('GET','/api/admin/overview',undefined,{as:'owner'})).data; assert.equal(ov.users.find(u=>u.name==='Гоша').group,'ИУ5-11Б');
});

test('живой пульт: онлайн, лента, задачи дня, «где спотыкаются», карточка участника; участнику — нельзя',async()=>{
  const c=club({cfg:{openSignup:true}}); await c.owner();
  await c.yandex({id:'9002',first_name:'Аня'},{who:'a'}); await c.call('POST','/api/me/profile',{group:'РК6-31Б'},{as:'a'});
  const r=await c.call('POST','/api/act',{view:'train',ev:[{type:'task',d:{n:12,v:0,ctx:'train'}},{type:'task',d:{n:12,v:2}},{type:'check',d:{k:'dz'}},{type:'hack',d:{}},{type:'task',d:{n:'<b>',evil:{x:1}}}]},{as:'a'});
  assert.equal(r.status,200);
  const L=(await c.call('GET','/api/admin/live',undefined,{as:'owner'})).data;
  assert.equal(L.kpi.online,1,'в кабинете сейчас — Аня'); assert.equal(L.kpi.newToday,2);
  const anya=L.online.find(x=>x.name==='Аня'); assert.ok(anya); assert.equal(anya.view,'train'); assert.equal(anya.group,'РК6-31Б');
  assert.equal(L.kpi.tasks,3); assert.equal(L.kpi.solved,1); assert.equal(L.kpi.checks,1);
  assert.ok(!L.feed.some(f=>f.type==='hack'),'неизвестные события не пишутся');
  assert.ok(L.feed.some(f=>f.type==='signup'&&f.name==='Аня'),'регистрация — в ленте');
  assert.deepEqual(L.hard[0],{n:12,total:2,bad:1,people:1});
  assert.ok(L.groups.some(g=>g.g==='РК6-31Б'&&g.users===1));
  assert.equal(L.hours.length,24);
  const id=L.online.find(x=>x.name==='Аня').id, U=(await c.call('GET','/api/admin/user?id='+id,undefined,{as:'owner'})).data;
  assert.equal(U.user.name,'Аня'); assert.equal(U.stats.tasks,3); assert.equal(U.stats.fail,1); assert.equal(U.stats.checks,1);
  assert.equal((await c.call('GET','/api/admin/live',undefined,{as:'a'})).status,403);
  c.clock.t+=3*60e3; const L2=(await c.call('GET','/api/admin/live',undefined,{as:'owner'})).data; assert.ok(!L2.online.some(x=>x.name==='Аня'),'через 3 минуты тишины — не онлайн');
  await c.call('POST','/api/act',{view:'check',away:true},{as:'a'});
  c.clock.t+=31*86400e3; await c.app.maintain(); assert.equal((await c.store.scan('activity')).length,0,'журнал старше 30 дней убирается');
});
