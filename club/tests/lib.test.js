/* Логика клуба на фиксированных датах: календарь, обратный план, интервалы, BKT, слияние прогресса, напоминания.
   node --test club/tests/lib.test.js */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const CAL=require('../lib/calendar.js'), PL=require('../lib/plan.js'), SRS=require('../lib/srs.js'), BKT=require('../lib/bkt.js'), SYNC=require('../lib/sync.js'), REM=require('../lib/reminder.js'), FEAT=require('../lib/features.js'), SCAN=require('../lib/scanner.js');
const W1='2026-08-31';
const ev=(id,s)=>CAL.events(s||{},W1).find(e=>e.id===id);
const brief=steps=>steps.map(s=>s.k.replace(/^mix-.*/,'mix')+'@'+s.date);

test('календарь: недели из таблицы владельца, неделя 1 — 2026-08-31 (понедельник)',()=>{
  assert.equal(CAL.weekday(CAL.toDay(W1)),1);
  const all=CAL.events({},W1); assert.equal(all.length,18);
  const want={'ikg-dz-1':4,'ikg-rk-1':5,'ikg-m-1':6,'ikg-dz-2':9,'ikg-rk-2':10,'ikg-m-2':11,'ikg-dz-3':14,'ikg-rk-3':15,'ikg-m-3':16,
    'ng-dz-1':5,'ng-rk-1':6,'ng-m-1':7,'ng-dz-2':10,'ng-rk-2':11,'ng-m-2':12,'ng-dz-3':14,'ng-rk-3':15,'ng-m-3':16};
  for(const [id,w] of Object.entries(want)) assert.equal(ev(id).week,w,id);
  assert.equal(ev('ikg-dz-1').date,'2026-09-21'); assert.equal(ev('ng-rk-1').date,'2026-10-05');
  assert.equal(ev('ng-rk-2').date,'2026-11-09'); assert.equal(ev('ng-rk-2').start,'2026-11-09'); assert.equal(ev('ng-rk-2').end,'2026-11-15');
  assert.equal(ev('ng-m-3').date,'2026-12-14');
  assert.equal(CAL.weekOf(W1,'2026-10-17'),7);
});
test('календарь: день занятия и точная дата — только внутри недели события',()=>{
  assert.equal(ev('ng-rk-2',{classDay:{ng:3}}).date,'2026-11-11');
  assert.equal(ev('ikg-rk-2',{classDay:{ng:3}}).date,'2026-11-02');
  const c=ev('ng-rk-2',{dates:{'ng-rk-2':'2026-11-13'}}); assert.equal(c.date,'2026-11-13'); assert.equal(c.custom,true);
  const out=ev('ng-rk-2',{dates:{'ng-rk-2':'2026-11-20'}}); assert.equal(out.date,'2026-11-09'); assert.equal(out.custom,false);
  assert.equal(CAL.events({week1:'2026-09-01'},W1)[0].date,'2026-09-21','неделя 1 не с понедельника — игнорируется');
  assert.equal(ev('ng-rk-1',{week1:'2026-09-07'}).date,'2026-10-12','week1 студента важнее клубного');
  assert.equal(CAL.events({subjects:['ng']},W1).length,9);
});
test('календарь: ближайшие события на 2026-10-17',()=>{
  const u=CAL.upcoming({},W1,'2026-10-17',3);
  assert.deepEqual(u.map(e=>[e.id,e.inDays]),[['ikg-dz-2',9],['ikg-rk-2',16],['ng-dz-2',16]]);
  assert.equal(CAL.inWords(1),'завтра'); assert.equal(CAL.inWords(21),'через 21 день'); assert.equal(CAL.inWords(3),'через 3 дня');
  assert.equal(CAL.human('2026-11-09'),'пн, 9 ноя');
});

test('обратный план РК: D−10 диагностика, D−9…D−3 вперемешку, D−2 пробный, D−1 лёгкое повторение',()=>{
  const p=PL.plan(ev('ng-rk-2'),'2026-10-17',{});
  assert.equal(p.late,false);
  assert.deepEqual(brief(p.steps),['diag@2026-10-30','mix@2026-10-31','mix@2026-11-01','mix@2026-11-02','mix@2026-11-03','mix@2026-11-04','mix@2026-11-05','mix@2026-11-06','mock@2026-11-07','light@2026-11-08','event@2026-11-09']);
  assert.ok(p.steps.every(s=>s.when==='future'));
});
test('обратный план РК: поздний старт — диагностика сегодня, остальное сдвигается',()=>{
  const p=PL.plan(ev('ng-rk-2'),'2026-11-03',{});
  assert.equal(p.late,true);
  assert.deepEqual(brief(p.steps),['diag@2026-11-03','mix@2026-11-04','mix@2026-11-05','mix@2026-11-06','mock@2026-11-07','light@2026-11-08','event@2026-11-09']);
  const d=PL.plan(ev('ng-rk-2'),'2026-11-03',{'ng-rk-2:diag':true});
  assert.deepEqual(brief(d.steps),['diag@2026-10-30','mix@2026-11-03','mix@2026-11-04','mix@2026-11-05','mix@2026-11-06','mock@2026-11-07','light@2026-11-08','event@2026-11-09']);
  assert.equal(d.steps[0].done,true); assert.equal(d.steps[0].when,'past'); assert.equal(d.steps[1].when,'today');
  assert.deepEqual(brief(PL.plan(ev('ng-rk-2'),'2026-11-08',{}).steps),['light@2026-11-08','event@2026-11-09']);
  assert.equal(PL.plan(ev('ng-rk-2'),'2026-11-10',{}).over,true);
});
test('обратный план ДЗ: этапы с датами и запас перед сроком',()=>{
  const e=ev('ikg-dz-2'); assert.equal(e.date,'2026-10-26');
  const early=PL.plan(e,'2026-10-01',{});
  assert.deepEqual(early.steps.map(s=>s.k.replace(/^buffer-.*/,'buffer')+':'+(s.from||s.date)+'..'+(s.to||s.date)),
    ['read:2026-10-05..2026-10-07','draft:2026-10-08..2026-10-14','clean:2026-10-15..2026-10-20','check:2026-10-21..2026-10-23','buffer:2026-10-24..2026-10-24','buffer:2026-10-25..2026-10-25','event:2026-10-26..2026-10-26']);
  assert.equal(early.steps[3].title,'Предпроверка по ГОСТ');
  const late=PL.plan(e,'2026-10-17',{});
  assert.equal(late.late,true);
  assert.deepEqual(late.steps.map(s=>s.k.replace(/^buffer-.*/,'buffer')+':'+(s.from||s.date)+'..'+(s.to||s.date)),
    ['read:2026-10-17..2026-10-17','draft:2026-10-18..2026-10-21','clean:2026-10-22..2026-10-23','check:2026-10-24..2026-10-24','buffer:2026-10-25..2026-10-25','event:2026-10-26..2026-10-26']);
  const last=PL.plan(e,'2026-10-26',{});
  assert.equal(last.steps.filter(s=>s.squeezed).length,4); assert.equal(last.steps.at(-1).k,'event');
  assert.equal(PL.plan(ev('ng-dz-2'),'2026-10-17',{}).steps[0].title,'Условие и способ');
});
test('обратный план М: сверка за неделю, долги за 3 дня',()=>{
  const e=ev('ng-m-2'); assert.equal(e.date,'2026-11-16');
  assert.deepEqual(brief(PL.plan(e,'2026-10-17',{}).steps),['check@2026-11-09','debts@2026-11-13','event@2026-11-16']);
  assert.deepEqual(brief(PL.plan(e,'2026-11-14',{}).steps),['event@2026-11-16']);
});
test('что сегодня по плану',()=>{
  const evs=CAL.events({},W1), s=PL.todaySteps(evs,'2026-10-30',{});
  assert.ok(s.some(x=>x.key==='ng-rk-2:diag'),'диагностика к РК2 начерта');
  assert.ok(!PL.todaySteps(evs,'2026-10-30',{'ng-rk-2:diag':true}).some(x=>x.key==='ng-rk-2:diag'),'сделанное не показывается');
});

test('интервалы: тот же алгоритм, что на основном сайте (1 → 3 → 7 → 16 → 35)',()=>{
  let r=SRS.rate({},52,2,100); assert.deepEqual([r['52'].b,r['52'].d,r['52'].n],[1,103,1]);
  r=SRS.rate(r,52,2,103); assert.deepEqual([r['52'].b,r['52'].d],[2,110]);
  r=SRS.rate(r,52,1,110); assert.deepEqual([r['52'].b,r['52'].d],[2,114]);
  r=SRS.rate(r,52,0,114); assert.deepEqual([r['52'].b,r['52'].d],[0,115]);
  const s=SRS.seen({},7,100); assert.deepEqual(s['7'],{b:0,d:101,s:100,l:100,n:0});
});
test('тренировка дня: не больше 3 повторов + одна задача вперемешку из другой темы',()=>{
  const tasks=[{n:1,topic:'a'},{n:2,topic:'a'},{n:3,topic:'b'},{n:4,topic:'c'},{n:5,topic:'d'},{n:6,topic:'e'}];
  const rep={1:{b:1,d:99,s:90,l:96,n:1},3:{b:1,d:100,s:91,l:97,n:1},4:{b:0,d:98,s:92,l:97,n:1},5:{b:2,d:100,s:93,l:93,n:2}};
  const t=SRS.training(rep,100,tasks,()=>.5,[],1);
  assert.equal(t.items.filter(i=>i.kind==='review').length,3); assert.equal(t.later,1);
  const mix=t.items.find(i=>i.kind==='mix'); assert.ok(mix); assert.ok(!t.items.filter(i=>i.kind==='review').some(i=>i.topic===mix.topic)); assert.ok(!rep[mix.n]);
  assert.ok(t.minutes>=15&&t.minutes<=20,'15–20 минут: '+t.minutes);
  const f=SRS.training({},100,tasks,()=>.5,['e'],1); assert.equal(f.items[0].topic,'e','тема ближайшего РК — первой');
});

test('BKT: шаг по формуле Байеса и переход',()=>{
  assert.ok(Math.abs(BKT.step(.2,true)-0.585882)<1e-5);
  assert.ok(BKT.step(.5,false)<.5); assert.ok(BKT.step(.5,true)>.5);
  const ev=[...Array(8)].map((_,i)=>({id:'x'+i,t:i,skills:['metric'],ok:true}));
  const e=BKT.estimate(ev); assert.ok(e.metric.p>=BKT.MASTER,'8 верных подряд — освоено'); assert.equal(BKT.level(e.metric.p,8).id,'master');
});
test('BKT: ошибки → навыки; описка не штрафует; подсказка — ошибка',()=>{
  const a=BKT.fromRating({id:'r',t:1,task:52,topic:'replace-planes',rating:1,errors:['proj','vis']});
  assert.deepEqual(a.map(e=>[e.skills[0],e.ok]),[['replace-planes',false],['point-epure',false],['visibility',false]]);
  assert.equal(BKT.fromRating({id:'s',t:1,task:52,topic:'replace-planes',rating:0,errors:['calc']}).length,0);
  assert.deepEqual(BKT.fromRating({id:'g',t:1,task:52,topic:'replace-planes',rating:2}).map(e=>e.ok),[true]);
  const n=BKT.fromNormo({id:'n',t:1,issues:[{gost:'2.303'},{gost:'2.307'}]});
  assert.deepEqual(n.filter(e=>!e.ok).map(e=>e.skills[0]).sort(),['ikg-dims','ikg-lines']);
});
test('BKT: рекомендации — сначала темы ближайшего РК, затем самые слабые',()=>{
  const tasks=[{n:1,topic:'a'},{n:2,topic:'a'},{n:3,topic:'b'},{n:4,topic:'c'}];
  const est=BKT.estimate([{id:1,t:1,skills:['b'],ok:false},{id:2,t:2,skills:['c'],ok:true}]);
  assert.deepEqual(BKT.recommend(est,tasks,{},[],3).map(r=>r.skill),['b','a','c']);
  assert.equal(BKT.recommend(est,tasks,{},['c'],3)[0].skill,'c');
  assert.deepEqual(BKT.recommend(est,tasks,{1:{b:3}},[],1)[0].tasks,[3]);
});

test('синхронизация: слияние коммутативно, повтор задач — по задаче, журнал — объединение',()=>{
  const A={data:{nch2_rep:JSON.stringify({52:{b:2,d:110,l:103,n:2},7:{b:0,d:101,l:100,n:0}}),nch2_club_ev:JSON.stringify([{id:'a',t:1,skills:['x'],ok:true}]),nch2_theme:'"dark"',nch2_x:'1'},mt:{nch2_x:5}};
  const B={data:{nch2_rep:JSON.stringify({52:{b:1,d:103,l:100,n:1},9:{b:1,d:104,l:101,n:1}}),nch2_club_ev:JSON.stringify([{id:'b',t:2,skills:['x'],ok:false}]),nch2_x:'2'},mt:{nch2_x:9}};
  const m1=SYNC.merge(A,B), m2=SYNC.merge(B,A); assert.deepEqual(m1,m2);
  const rep=JSON.parse(m1.data.nch2_rep); assert.equal(rep[52].b,2); assert.ok(rep[7]&&rep[9]);
  assert.equal(JSON.parse(m1.data.nch2_club_ev).length,2); assert.equal(m1.data.nch2_x,'2'); assert.ok(!('nch2_theme' in m1.data),'тема — настройка устройства');
  const ii=SYNC.merge({data:{nch2_club_ii:JSON.stringify({e:{what:'старое',t:1}})}},{data:{nch2_club_ii:JSON.stringify({e:{what:'новое',t:2}})}});
  assert.equal(JSON.parse(ii.data.nch2_club_ii).e.what,'новое');
});
test('синхронизация: проверка присланного',()=>{
  assert.equal(SYNC.validate({data:{nch2_rep:'{}'}}),null);
  assert.ok(SYNC.validate({data:{'__proto__x':'1'}})); assert.ok(SYNC.validate({data:{evil:'1'}})); assert.ok(SYNC.validate({data:{nch2_a:5}}));
  assert.ok(SYNC.validate({data:{nch2_a:'x'.repeat(130*1024)}})); assert.ok(SYNC.validate({data:{nch2_a:'1'},mt:{nch2_a:'x'}}));
  assert.ok(SYNC.validate(null)); assert.ok(SYNC.validate({data:[]}));
});

test('напоминания: раз в день, в своё время, тихие часы, пауза',()=>{
  const r={enabled:true,time:'19:00',quietFrom:'22:30',quietTo:'08:00',tz:'Europe/Moscow',canWrite:true};
  const at=s=>Date.parse(s);
  assert.equal(REM.decide(r,at('2026-10-17T16:30:00Z')).send,true,'19:30 по Москве');
  assert.equal(REM.decide(r,at('2026-10-17T15:00:00Z')).why,'рано');
  assert.equal(REM.decide(Object.assign({},r,{lastSent:'2026-10-17'}),at('2026-10-17T16:30:00Z')).why,'сегодня уже было');
  assert.equal(REM.decide(Object.assign({},r,{time:'23:00'}),at('2026-10-17T20:10:00Z')).why,'тихие часы');
  assert.equal(REM.decide(r,at('2026-10-17T19:30:00Z')).why,'окно прошло','22:30 — позже 3 часов после 19:00');
  assert.equal(REM.decide(Object.assign({},r,{paused:true}),at('2026-10-17T16:30:00Z')).why,'пауза');
  assert.equal(REM.decide(Object.assign({},r,{tz:'Asia/Vladivostok'}),at('2026-10-17T09:30:00Z')).send,true,'19:30 во Владивостоке');
  assert.ok(REM.inQuiet('23:00','22:30','08:00')&&REM.inQuiet('07:59','22:30','08:00')&&!REM.inQuiet('08:00','22:30','08:00'));
});
test('напоминания: текст привязан к ближайшему дедлайну, без стыда; нечего сказать — не пишем',()=>{
  const evs=CAL.events({},W1);
  const t=REM.compose({events:evs,today:'2026-10-30',done:{},dueCount:2,ii:{'ng-rk-2':{when:'чт 18:00',where:'читалка',what:'задачи 52 и 57'}}});
  assert.match(t,/Ближайшее: РК2 · ИКГ, пн, 2 ноя \(через 3 дня\)/); assert.match(t,/На повтор: 2 задачи/);
  const rk=REM.compose({events:evs.filter(e=>e.id==='ng-rk-2'),today:'2026-10-30',done:{},dueCount:0,ii:{'ng-rk-2':{when:'чт 18:00',where:'читалка',what:'задачи 52 и 57'}}});
  assert.match(rk,/диагностика/); assert.match(rk,/Твой план: чт 18:00, читалка — задачи 52 и 57/);
  assert.doesNotMatch(t+rk,/пропустил|позор|серия|стрик|отста/i);
  assert.equal(REM.compose({events:evs,today:'2026-12-20',done:{},dueCount:0}),null);
});
test('флаги функций и заглушка сканера',async()=>{
  const e=FEAT.effective({scanner:'admin',normo:'off'},'member'); assert.equal(e.scanner,false); assert.equal(e.normo,false); assert.equal(e.calendar,true);
  assert.equal(FEAT.effective({scanner:'admin'},'admin').scanner,true);
  const r=await SCAN.scan({size:1000,type:'image/jpeg'},{n:52}); assert.equal(r.verdict,'unknown'); assert.equal(r.stub,true);
  SCAN.register(async()=>({verdict:'ok',confidence:2})); const r2=await SCAN.scan({size:10,type:'image/png'},{n:1}); assert.deepEqual([r2.verdict,r2.confidence],['ok',1]);
  assert.match((await SCAN.scan({size:99e6,type:'image/png'},{n:1})).error,/12 МБ/);
});
