/* Бот записи на эфиры (server/livebot): запись, напоминания, ссылка, «помогло?», удаление данных, команды владельца. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {createLiveBot,parseWhen}=require('../livebot/core');

const ADMIN=500, MIN=60e3, H=60*MIN;
function rig(){ const clock={t:Date.parse('2026-11-10T09:00:00Z')}, out=[]; let db=null;   /* 12:00 по Москве, вт 10.11 */
  const api=async(method,body)=>{ out.push({method,body}); return body&&String(body.chat_id)==='403'?{ok:false,error_code:403}:{ok:true,result:{}}; };
  const bot=createLiveBot({api,load:()=>db&&JSON.parse(JSON.stringify(db)),save:s=>{ db=JSON.parse(JSON.stringify(s)); },now:()=>clock.t,admins:[ADMIN]});
  const msg=(from,text)=>bot.onUpdate({update_id:1,message:{message_id:7,chat:{id:from,type:'private'},from:{id:from,first_name:'Имя'+from},text}});
  const tap=(from,data)=>bot.onUpdate({update_id:2,callback_query:{id:'q',data,from:{id:from,first_name:'Имя'+from},message:{chat:{id:from}}}});
  const to=c=>out.filter(x=>x.method==='sendMessage'&&String(x.body.chat_id)===String(c));
  const last=c=>{ const L=to(c); return L.length?L[L.length-1].body:null; };
  return {clock,out,bot,msg,tap,to,last,db:()=>db}; }

test('время эфира: «10.11 20:00» — по Москве, год ближайший',()=>{
  const now=Date.parse('2026-11-10T09:00:00Z');
  assert.equal(parseWhen('10.11','20:00',now),Date.parse('2026-11-10T17:00:00Z'));
  assert.equal(parseWhen('31.02','20:00',now),null);
  assert.equal(parseWhen('10.11','25:00',now),null);
  assert.equal(parseWhen('05.01','19:30',now),Date.parse('2027-01-05T16:30:00Z'),'январь — уже следующий год');
});

test('путь ученика: запись → за 2 часа → за 15 минут ссылка → «помогло?»; число видит только владелец',async()=>{
  const r=rig();
  await r.msg(ADMIN,'/add 10.11 20:00 РК2: типы задач');
  assert.match(r.last(ADMIN).text,/Добавил: вт 10\.11 в 20:00 — РК2: типы задач \(id 10112000\)/);

  await r.msg(1,'/start site');
  const st=r.last(1); assert.match(st.text,/бесплатные онлайн-разборы/); assert.match(st.text,/удаляются через 30 дней/);
  assert.equal(st.reply_markup.inline_keyboard[0][0].callback_data,'j:10112000');
  assert.doesNotMatch(st.text,/записал(ось|ись)\s*\d/i,'ученик не видит, сколько записалось');
  await r.tap(1,'j:10112000');
  assert.match(r.last(1).text,/^Записал! вт 10\.11 в 20:00/);
  await r.tap(1,'j:10112000'); assert.match(r.last(1).text,/^Ты уже записан/);
  assert.equal(r.db().sessions[0].n,1,'повторное нажатие не удваивает');
  assert.equal(r.db().sessions[0].subs['1'].src,'site');

  await r.tap(1,'l:10112000'); assert.match(r.last(1).text,/Ссылка появится за 30 минут/);

  r.clock.t=Date.parse('2026-11-10T15:05:00Z'); await r.bot.tick();          /* 18:05 — за 2 часа */
  assert.match(r.last(1).text,/Сегодня в 20:00 — разбор/);
  const n=r.to(1).length; await r.bot.tick(); assert.equal(r.to(1).length,n,'дважды не напоминает');

  r.clock.t=Date.parse('2026-11-10T16:45:00Z'); await r.bot.tick();          /* 19:45, ссылки нет → тревога владельцу */
  assert.match(r.last(ADMIN).text,/ссылки нет/);
  assert.equal(r.to(1).length,n,'без ссылки ученику ничего');
  await r.msg(ADMIN,'/link https://telemost.yandex.ru/j/123');
  r.clock.t+=MIN; await r.bot.tick();
  assert.match(r.last(1).text,/Через 15 минут начинаем.*\nСсылка: https:\/\/telemost\.yandex\.ru\/j\/123/);
  await r.tap(1,'l:10112000'); assert.match(r.last(1).text,/https:\/\/telemost\.yandex\.ru\/j\/123/,'ссылка по кнопке — если напоминание не дошло');

  await r.msg(ADMIN,'/list'); assert.match(r.last(ADMIN).text,/записалось: 1/);
  await r.msg(1,'/list'); assert.doesNotMatch(r.last(1).text,/записалось/,'ученику /list недоступен');

  r.clock.t=Date.parse('2026-11-10T18:31:00Z'); await r.bot.tick();          /* после эфира */
  assert.match(r.last(1).text,/Помогло\?/);
  await r.tap(1,'f:10112000:y'); await r.tap(1,'f:10112000:n');
  assert.deepEqual(r.db().sessions[0].fb,{y:1,p:0,n:0},'один ответ на человека');

  r.clock.t+=31*24*H; await r.bot.tick();
  assert.deepEqual(r.db().sessions[0].subs,{},'через 30 дней людей нет');
  assert.equal(r.db().sessions[0].n,1,'числа остаются');
  assert.equal(r.db().users['1'],undefined);
});

test('/delete стирает всё о человеке; отмена записи; закончившийся эфир не записывает',async()=>{
  const r=rig(); await r.msg(ADMIN,'/add 10.11 20:00 РК2'); await r.msg(ADMIN,'/add 11.11 20:00 РК2');
  await r.msg(2,'/start'); await r.tap(2,'j:10112000'); await r.tap(2,'j:11112000');
  await r.tap(2,'c:11112000'); assert.match(r.last(2).text,/Отменил/); assert.equal(r.db().sessions[1].n,0);
  await r.msg(2,'/delete'); assert.match(r.last(2).text,/Удалил всё/);
  assert.ok(r.db().sessions.every(s=>!s.subs['2'])); assert.equal(r.db().users['2'],undefined);
  r.clock.t=Date.parse('2026-11-10T19:00:00Z'); await r.tap(3,'j:10112000'); assert.match(r.last(3).text,/закончился/);
});

test('владелец: неверные команды, /say, /who, /del с оповещением; чужой не может',async()=>{
  const r=rig();
  await r.msg(ADMIN,'/add 99.11 20:00 РК2'); assert.match(r.last(ADMIN).text,/Формат/);
  await r.msg(ADMIN,'/add 10.11 10:00 РК2'); assert.match(r.last(ADMIN).text,/уже прошло/);
  await r.msg(ADMIN,'/add 10.11 20:00 РК2');
  await r.msg(ADMIN,'/link http://evil'); assert.match(r.last(ADMIN).text,/Нужна ссылка/);
  await r.msg(7,'/add 10.11 21:00 ДЗ'); assert.equal(r.db().sessions.length,1,'не владелец — не добавляет');
  await r.msg(4,'/start'); await r.tap(4,'j:10112000'); await r.msg(403,'/start'); await r.tap(403,'j:10112000');
  await r.msg(ADMIN,'/who'); assert.match(r.last(ADMIN).text,/— 2:/);
  await r.msg(ADMIN,'/say Начинаем через 5 минут'); assert.match(r.last(4).text,/Начинаем через 5 минут/); assert.match(r.last(ADMIN).text,/Отправил: 1 из 2/,'заблокировавший бота не считается');
  await r.msg(ADMIN,'/del 10112000'); assert.match(r.last(4).text,/отменён/); assert.equal(r.db().sessions.length,0);
});

test('вопрос текстом пересылается владельцу; служебные символы в теме вычищаются',async()=>{
  const r=rig(); await r.msg(ADMIN,'/add 10.11 20:00 РК2\u0000\u0007 тема');
  assert.equal(r.db().sessions[0].topic,'РК2 тема');
  await r.msg(5,'А как найти угол между плоскостями?');
  assert.ok(r.out.some(x=>x.method==='forwardMessage'&&x.body.chat_id===ADMIN&&x.body.from_chat_id===5));
  assert.match(r.last(5).text,/Передал вопрос/);
});
