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
  assert.match(r.last(ADMIN).text,/^Добавил: вт 10\.11 в 20:00 — РК2: типы задач, 1 час\./);

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

  await r.msg(ADMIN,'/list'); assert.match(r.last(ADMIN).reply_markup.inline_keyboard[0][0].text,/записалось 1/);
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
  await r.msg(ADMIN,'/who'); assert.match(r.last(ADMIN).text,/записаны 2:/);
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

test('меню владельца кнопками: добавить эфир (день → время → тема), ссылка, написать, отменить',async()=>{
  const r=rig(), kb=()=>r.last(ADMIN).reply_markup, btn=re=>{ const b=(kb().inline_keyboard||[]).flat().find(x=>re.test(x.text)); assert.ok(b,'нет кнопки '+re); return b.callback_data; };
  await r.msg(ADMIN,'/start'); assert.ok(kb().keyboard,'внизу — меню владельца'); assert.equal(kb().keyboard[1][1].text,'➕ Добавить эфир');
  await r.msg(ADMIN,'➕ Добавить эфир'); assert.match(r.last(ADMIN).text,/Какой день/);
  await r.tap(ADMIN,btn(/^Сегодня/)); assert.match(r.last(ADMIN).text,/Во сколько/);
  await r.tap(ADMIN,btn(/^20:00$/)); assert.match(r.last(ADMIN).text,/Тема эфира — вт 10\.11 в 20:00/);
  await r.tap(ADMIN,btn(/^РК2$/)); assert.match(r.last(ADMIN).text,/^Добавил: вт 10\.11 в 20:00 — РК2, 1 час\./);
  assert.equal(r.db().sessions.length,1);
  /* своё время и своя тема — текстом */
  await r.msg(ADMIN,'➕ Добавить эфир'); await r.tap(ADMIN,btn(/^Завтра/)); await r.tap(ADMIN,btn(/Другое время/));
  await r.msg(ADMIN,'25:99'); assert.match(r.last(ADMIN).text,/Не понял время/);
  await r.msg(ADMIN,'19:30'); await r.tap(ADMIN,btn(/Своя тема/)); await r.msg(ADMIN,'ДЗ 3: пирамида');
  assert.match(r.last(ADMIN).text,/^Добавил: ср 11\.11 в 19:30 — ДЗ 3: пирамида, 1 час\./);
  /* ученик видит оба, записывается */
  await r.msg(8,'/start'); assert.equal(r.last(8).reply_markup.inline_keyboard.length,2); await r.tap(8,'j:10112000');
  /* ссылка кнопкой: выбрать эфир → прислать */
  await r.msg(ADMIN,'🔗 Ссылка на эфир'); assert.match(r.last(ADMIN).text,/Для какого эфира/);
  await r.tap(ADMIN,btn(/вт 10\.11/)); await r.msg(ADMIN,'не ссылка'); assert.match(r.last(ADMIN).text,/Нужна ссылка/);
  await r.msg(ADMIN,'https://telemost.yandex.ru/j/555'); assert.match(r.last(ADMIN).text,/сохранена/); assert.equal(r.db().sessions[0].link,'https://telemost.yandex.ru/j/555');
  /* написать записанным: текст → подтверждение → отправка */
  await r.msg(ADMIN,'📣 Написать записанным'); await r.tap(ADMIN,btn(/вт 10\.11/)); await r.msg(ADMIN,'Начинаем через 5 минут!');
  assert.match(r.last(ADMIN).text,/Отправить 1 записанным/); assert.ok(!r.to(8).some(x=>/через 5 минут/.test(x.body.text)),'до подтверждения не отправляет');
  await r.tap(ADMIN,'a:M'); assert.match(r.last(8).text,/Начинаем через 5 минут!/); assert.match(r.last(ADMIN).text,/Отправил: 1 из 1/);
  /* эфиры → карточка → отменить с подтверждением */
  await r.msg(ADMIN,'📅 Эфиры'); await r.tap(ADMIN,btn(/ср 11\.11/)); assert.match(r.last(ADMIN).text,/Записалось: 0/);
  await r.tap(ADMIN,btn(/Отменить эфир/)); assert.equal(r.db().sessions.length,2,'без подтверждения не отменяет');
  await r.tap(ADMIN,btn(/Да, отменить/)); assert.equal(r.db().sessions.length,1);
  /* «Как видят ученики» и отмена ввода */
  await r.msg(ADMIN,'👀 Как видят ученики'); assert.match(r.last(ADMIN).text,/Выбери эфир/);
  await r.msg(ADMIN,'🔗 Ссылка на эфир'); assert.match(r.last(ADMIN).text,/Пришли ссылку/,'один эфир — сразу просит ссылку'); await r.tap(ADMIN,'a:c');
  await r.msg(ADMIN,'просто текст'); assert.match(r.last(ADMIN).text,/Выбери кнопку/);
});

test('кнопки владельца не работают у ученика',async()=>{
  const r=rig(); await r.msg(ADMIN,'/add 10.11 20:00 РК2');
  await r.tap(9,'a:X:10112000'); await r.tap(9,'a:add'); assert.equal(r.db().sessions.length,1);
  assert.ok(!r.to(9).some(x=>/Какой день/.test(x.body.text)));
  await r.msg(9,'📅 Эфиры'); assert.ok(r.out.some(x=>x.method==='forwardMessage'),'у ученика это просто текст — уходит владельцу вопросом');
});

test('расписание из файла: эфир появляется сам, длительность своя, отменённый не возвращается',async()=>{
  const clock={t:Date.parse('2026-11-09T23:30:00Z')}, out=[]; let db=null;                     /* вт 10.11, 02:30 по Москве */
  let sched=[{date:'2026-11-10',time:'20:00',min:60,topic:'РК2: разбор типов задач'},{date:'2026-11-08',time:'20:00',topic:'прошлый'},{date:'кривая',time:'20:00',topic:'x'}];
  const api=async(method,body)=>{ out.push({method,body}); return {ok:true}; };
  const bot=createLiveBot({api,load:()=>db&&JSON.parse(JSON.stringify(db)),save:s=>{ db=JSON.parse(JSON.stringify(s)); },now:()=>clock.t,admins:[ADMIN],schedule:()=>sched});
  const last=c=>out.filter(x=>x.method==='sendMessage'&&String(x.body.chat_id)===String(c)).pop().body;
  await bot.tick();
  assert.equal(db.sessions.length,1,'только будущий и корректный'); assert.equal(db.sessions[0].id,'10112000'); assert.equal(db.sessions[0].min,60);
  await bot.onUpdate({message:{message_id:1,chat:{id:3,type:'private'},from:{id:3,first_name:'Ваня'},text:'/start'}});
  assert.match(last(3).reply_markup.inline_keyboard[0][0].text,/вт 10\.11 · 20:00 · РК2: разбор типов задач/);
  await bot.onUpdate({callback_query:{id:'q',data:'j:10112000',from:{id:3},message:{chat:{id:3}}}});
  assert.match(last(3).text,/1 час онлайн в Телемосте/);
  await bot.tick(); assert.equal(db.sessions.length,1,'второй раз не дублирует');
  /* после конца часового эфира — «помогло?» (а не через 1,5 часа) */
  clock.t=Date.parse('2026-11-10T18:01:00Z'); await bot.tick(); assert.match(last(3).text,/Помогло\?/);
  /* владелец отменил — из расписания не вернётся */
  clock.t=Date.parse('2026-11-09T23:30:00Z'); sched=[{date:'2026-11-11',time:'20:00',topic:'РК2'}]; await bot.tick();
  await bot.onUpdate({callback_query:{id:'q',data:'a:X:11112000',from:{id:ADMIN},message:{chat:{id:ADMIN}}}});
  await bot.tick(); assert.ok(!db.sessions.some(s=>s.id==='11112000'));
  /* длительность — кнопкой: 1 час → 1,5 → 2 → 1 */
  await bot.onUpdate({callback_query:{id:'q',data:'a:u:10112000',from:{id:ADMIN},message:{chat:{id:ADMIN}}}});
  assert.equal(db.sessions.find(s=>s.id==='10112000').min,90);
});

test('счётчик: «Сколько придёт», уведомление владельцу о каждой записи и отмене',async()=>{
  const r=rig(); await r.msg(ADMIN,'/add 10.11 20:00 РК2');
  await r.msg(ADMIN,'👥 Сколько придёт'); assert.match(r.last(ADMIN).text,/вт 10\.11 · 20:00 · РК2 — 0/);
  await r.msg(11,'/start'); await r.tap(11,'j:10112000');
  assert.match(r.last(ADMIN).text,/➕ Имя11 записался на вт 10\.11 · 20:00 · РК2\nПридут: 1/);
  await r.tap(11,'j:10112000'); assert.equal(r.to(ADMIN).filter(x=>/➕/.test(x.body.text)).length,1,'повторное нажатие — без уведомления');
  await r.msg(12,'/start'); await r.tap(12,'j:10112000'); assert.match(r.last(ADMIN).text,/Придут: 2/);
  await r.tap(12,'c:10112000'); assert.match(r.last(ADMIN).text,/➖ Имя12 отменил запись.*\nПридут: 1/);
  await r.msg(ADMIN,'/count'); assert.match(r.last(ADMIN).text,/РК2 — 1 · ⚠️ нет ссылки/);
  await r.msg(ADMIN,'/start'); assert.equal(r.last(ADMIN).reply_markup.keyboard[0][0].text,'👥 Сколько придёт');
});
