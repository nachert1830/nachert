/* Логика кабинета для сервера: синхронизация, функции, календарь, напоминания. node --test lk/tests/lib.test.js */
'use strict';
const test=require('node:test'), assert=require('node:assert');
const SYNC=require('../lib/sync.js'), FEAT=require('../lib/features.js'), CAL=require('../lib/calendar.js'), REM=require('../lib/reminder.js'), SRS=require('../lib/srs.js');
test('синхронизация: ключи, устройство, слияние повторения по задачам',()=>{
  assert.equal(SYNC.validate({data:{lk_done:'{}'}}),null); assert.ok(SYNC.validate({data:{evil:'1'}})); assert.ok(SYNC.validate({data:{lk_x:'x'.repeat(130*1024)}}));
  const c=SYNC.clean({data:{lk_done:'{"a":1}',lk_tok:'t',nch2_theme:'"dark"'},mt:{lk_done:5}}); assert.deepEqual(Object.keys(c.data),['lk_done']);
  const m=SYNC.merge({data:{nch2_rep:JSON.stringify({1:{l:5,b:2}}),lk_done:'{"a":1}'},mt:{lk_done:10}},{data:{nch2_rep:JSON.stringify({1:{l:3,b:0},2:{l:1}}),lk_done:'{}'},mt:{lk_done:4}});
  const r=JSON.parse(m.data.nch2_rep); assert.equal(r[1].b,2); assert.ok(r[2]); assert.equal(m.data.lk_done,'{"a":1}','старое не затирает новое');
});
test('функции и режимы',()=>{ const f=FEAT.normalize({scanner:'admin',sync:'off'}); assert.equal(FEAT.effective(f,'member').scanner,false); assert.equal(FEAT.effective(f,'admin').scanner,true); assert.equal(FEAT.effective(f,'admin').sync,false); });
test('календарь и напоминание',()=>{ assert.equal(CAL.weekday(CAL.toDay('2026-08-31')),1);
  const ev=CAL.events({},'2026-08-31'); assert.equal(ev.length,18);
  assert.match(REM.compose({events:ev,today:'2026-10-30',done:{},dueCount:1}),/РК2 · ИКГ[\s\S]*На повтор: 1 задача/);
  assert.equal(REM.compose({events:ev,today:'2026-12-28',done:{},dueCount:0}),'');
  assert.equal(REM.decide({enabled:true,time:'19:00'},Date.parse('2026-10-30T16:05:00Z')).send,true);
  assert.equal(SRS.queue({1:{d:5},2:{d:9}},6).filter(x=>x.due).length,1); });
