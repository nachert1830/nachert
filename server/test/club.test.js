/* Админ-панель, синхронизация прогресса, мои данные, отзывы, флаги, напоминания и бот, статика с CSP, YDB/SigV4. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {club}=require('./helpers');
const {sign}=require('../lib/sigv4');
const {marshal,unmarshal,ydbStore}=require('../lib/store/ydb');
const {fromEvent}=require('../lib/http');
const {fromEnv}=require('../lib/config');

test('админ: приглашения, роли, блокировка; участнику админка закрыта',async()=>{
  const c=club(); await c.owner(); await c.member(700,'m');
  assert.equal((await c.call('GET','/api/admin/overview',undefined,{as:'m'})).status,403);
  assert.equal((await c.call('POST','/api/admin/invites',{label:'x'},{as:'m'})).status,403);
  const inv=await c.call('POST','/api/admin/invites',{label:'Аня',days:3},{as:'owner'}); assert.match(inv.data.link,/#\/invite\/[A-Za-z0-9_-]{22}$/);
  const ov=await c.call('GET','/api/admin/overview',undefined,{as:'owner'}); assert.equal(ov.data.users.length,2);
  assert.ok(!JSON.stringify(ov.data).includes(inv.data.code),'код приглашения в списке не показывается');
  const h=ov.data.invites.find(i=>i.label==='Аня').h;
  assert.equal((await c.call('POST','/api/admin/invites/revoke',{h},{as:'owner'})).status,200);
  const r=await c.call('POST','/api/auth/telegram',{auth:c.tg(701,'Аня'),invite:inv.data.code,consent:c.consent},{as:'a'}); assert.equal(r.status,403); assert.match(r.data.error,/отозвано/);
  const late=await c.call('POST','/api/admin/invites',{label:'Поздно',days:1},{as:'owner'}); c.clock.t+=2*864e5;
  assert.match((await c.call('POST','/api/auth/telegram',{auth:c.tg(702,'Б'),invite:late.data.code,consent:c.consent},{as:'b'})).data.error,/Срок/);
  const mid=ov.data.users.find(u=>u.role==='member').id;
  assert.equal((await c.call('POST','/api/admin/users/role',{id:mid,role:'admin'},{as:'owner'})).status,200);
  assert.equal((await c.call('GET','/api/admin/overview',undefined,{as:'m'})).status,200,'новый админ видит панель');
  assert.equal((await c.call('POST','/api/admin/users/block',{id:mid,blocked:true},{as:'owner'})).status,200);
  assert.equal((await c.call('GET','/api/me',undefined,{as:'m'})).status,401,'заблокированный выброшен');
  assert.equal((await c.call('POST','/api/auth/telegram',{auth:c.tg(700,'Участник')},{as:'m2'})).status,403);
  const me=(await c.call('GET','/api/me',undefined,{as:'owner'})).data.user.id;
  assert.equal((await c.call('POST','/api/admin/users/role',{id:me,role:'member'},{as:'owner'})).status,409,'единственный админ не снимает с себя роль');
});

test('админ: флаги функций и дата начала недели 1',async()=>{
  const c=club(); await c.owner(); await c.member(710,'m');
  assert.equal((await c.call('GET','/api/me',undefined,{as:'m'})).data.week1,'2026-08-31');
  await c.call('POST','/api/admin/flags',{flags:{scanner:'admin',sync:'off',bogus:'on'}},{as:'owner'});
  const m=(await c.call('GET','/api/me',undefined,{as:'m'})).data, o=(await c.call('GET','/api/me',undefined,{as:'owner'})).data;
  assert.equal(m.flags.scanner,false); assert.equal(o.flags.scanner,true); assert.equal(m.flags.sync,false); assert.equal(m.flags.bogus,undefined);
  assert.equal((await c.call('PUT','/api/progress',{data:{}},{as:'m'})).status,403,'выключенная синхронизация закрыта и на сервере');
  assert.equal((await c.call('POST','/api/admin/settings',{week1:'2026-09-02'},{as:'owner'})).status,400,'не понедельник');
  await c.call('POST','/api/admin/settings',{week1:'2026-09-07'},{as:'owner'});
  assert.equal((await c.call('GET','/api/me',undefined,{as:'m'})).data.week1,'2026-09-07');
});

test('синхронизация: первый вход переносит локальный прогресс, второе устройство получает его, слияние по задачам',async()=>{
  const c=club(); await c.owner(); await c.member(720,'phone');
  assert.equal((await c.call('GET','/api/progress',undefined,{as:'phone'})).data.empty,true);
  const local={data:{nch2_rep:JSON.stringify({52:{b:1,d:20380,s:20370,l:20377,n:1,r:2}}),nch2_wb3:JSON.stringify({52:2}),nch2_ck:'"y"'},mt:{nch2_rep:1,nch2_wb3:1}};
  const p=await c.call('PUT','/api/progress',local,{as:'phone'}); assert.equal(p.status,200); assert.equal(p.data.rev,1); assert.ok(!('nch2_ck' in p.data.data),'ключи устройства не уходят');
  c.clock.t+=1000; await c.call('POST','/api/auth/telegram',{auth:c.tg(720,'Участник')},{as:'laptop'});
  const g=await c.call('GET','/api/progress',undefined,{as:'laptop'}); assert.equal(JSON.parse(g.data.data.nch2_rep)[52].b,1);
  const lap={data:{nch2_rep:JSON.stringify({52:{b:2,d:20390,s:20370,l:20383,n:2,r:2},9:{b:0,d:20384,s:20383,l:20383,n:1,r:0}})},mt:{nch2_rep:5}};
  await c.call('PUT','/api/progress',lap,{as:'laptop'});
  const ph=await c.call('PUT','/api/progress',local,{as:'phone'}); const rep=JSON.parse(ph.data.data.nch2_rep);
  assert.equal(rep[52].b,2,'старое с телефона не затирает новое с ноутбука'); assert.ok(rep[9]); assert.equal(ph.data.rev,3);
  assert.equal((await c.call('PUT','/api/progress',{data:{evil:'1'}},{as:'phone'})).status,400);
  assert.equal((await c.call('PUT','/api/progress',{data:{nch2_big:'x'.repeat(200*1024)}},{as:'phone'})).status,400,'ключ больше 128 КБ — отказ');
  assert.equal((await c.call('PUT','/api/progress',{data:{nch2_big:'x'.repeat(310*1024)}},{as:'phone'})).status,413,'запрос больше 300 КБ — отказ');
});

test('мои данные: выгрузка всего и удаление аккаунта',async()=>{
  const c=club(); await c.owner(); const r=await c.member(730,'u'); const id=r.data.user.id;
  await c.call('PUT','/api/progress',{data:{nch2_rep:'{}'}},{as:'u'});
  await c.call('POST','/api/feedback',{feature:'calendar',mood:'good',text:'удобно'},{as:'u'});
  const ex=await c.call('GET','/api/me/export',undefined,{as:'u'});
  assert.equal(ex.status,200); assert.match(ex.headers['Content-Disposition'],/attachment/);
  for(const k of ['user','identities','progress','sessions','loginLog','feedback']) assert.ok(k in ex.data,k);
  assert.equal(ex.data.user.telegramId,'730'); assert.equal(ex.data.feedback[0].text,'удобно'); assert.ok(!JSON.stringify(ex.data.sessions).match(/[0-9a-f]{64}/),'хеши сессий не выдаются');
  assert.equal((await c.call('POST','/api/me/delete',{confirm:'да'},{as:'u'})).status,400);
  const d=await c.call('POST','/api/me/delete',{confirm:'УДАЛИТЬ'},{as:'u'}); assert.equal(d.status,200); assert.match(d.setCookie,/Max-Age=0/);
  const dump=JSON.stringify(c.store._dump()); assert.ok(!dump.includes(id+'"')||!(await c.store.get('users',id)),'');
  assert.equal(await c.store.get('users',id),null); assert.equal(await c.store.get('progress',id),null); assert.equal(await c.store.get('identities','tg:730'),null);
  assert.equal((await c.store.scan('feedback',x=>x.userId===id)).length,0); assert.equal((await c.store.query('loginlog',id)).length,0);
  assert.equal((await c.call('POST','/api/auth/telegram',{auth:c.tg(730,'Снова')},{as:'u2'})).status,403,'после удаления — снова только по приглашению');
});

test('отзывы: на функцию, видны админу',async()=>{
  const c=club(); await c.owner(); await c.member(740,'u');
  assert.equal((await c.call('POST','/api/feedback',{feature:'training',text:''},{as:'u'})).status,400);
  await c.call('POST','/api/feedback',{feature:'training',mood:'unclear',text:'<b>не понял</b>'},{as:'u'});
  await c.call('POST','/api/feedback',{feature:'privacy',text:'Что вы обо мне храните?'},{as:'u'});
  const req=(await c.call('GET','/api/admin/overview',undefined,{as:'owner'})).data.feedback.find(f=>f.feature==='privacy');
  assert.equal((await c.call('POST','/api/admin/reply',{id:req.id,text:'Всё — в «Скачать мои данные»'},{as:'u'})).status,403,'отвечает только админ');
  const rp=await c.call('POST','/api/admin/reply',{id:req.id,text:'Всё — в «Скачать мои данные»'},{as:'owner'}); assert.equal(rp.data.telegram,true);
  assert.equal((await c.call('GET','/api/me/requests',undefined,{as:'u'})).data.requests[0].reply,'Всё — в «Скачать мои данные»');
  assert.ok(c.outbox.some(x=>x.body&&x.body.chat_id==='740'&&/Ответ владельца/.test(x.body.text)),'ответ ушёл в Telegram');
  const fb=(await c.call('GET','/api/admin/overview',undefined,{as:'owner'})).data.feedback.filter(f=>f.feature!=='privacy'); assert.equal(fb[0].feature,'training'); assert.equal(fb[0].text,'<b>не понял</b>','хранится как текст; экранирование — при выводе');
});

test('напоминания: нужен Telegram и согласие бота; раз в день во время студента, с паузой из бота',async()=>{
  const c=club(); await c.owner();
  const code=await c.invite(); await c.call('POST','/api/auth/email/start',{email:'e@x.ru',invite:code,consent:c.consent},{as:'e'});
  const tok=/#\/magic\/([A-Za-z0-9_-]+)/.exec(c.outbox.at(-1).text)[1]; await c.call('POST','/api/auth/email/verify',{token:tok},{as:'e'});
  assert.equal((await c.call('POST','/api/me/reminders',{enabled:true},{as:'e'})).data.needTelegram,true);
  await c.member(403,'blocked');
  const nb=await c.call('POST','/api/me/reminders',{enabled:true},{as:'blocked'}); assert.equal(nb.status,409); assert.equal(nb.data.needStart,true,'бот не может писать — просим нажать «Старт»');
  await c.member(750,'u');
  const on=await c.call('POST','/api/me/reminders',{enabled:true,time:'19:00',tz:'Europe/Moscow',quietFrom:'22:30',quietTo:'08:00'},{as:'u'}); assert.equal(on.status,200); assert.equal(on.data.reminders.enabled,true);
  assert.equal((await c.call('POST','/api/me/reminders',{tz:'Mars/Olympus'},{as:'u'})).status,400);
  /* у студента ближайший РК2 по начерту и задача на повтор */
  await c.call('PUT','/api/progress',{data:{nch2_rep:JSON.stringify({52:{b:1,d:20390,s:20380,l:20383,n:1}}),nch2_club_ii:JSON.stringify({'ng-rk-2':{when:'чт 18:00',where:'читалка',what:'задачи 52 и 57',t:1}})}},{as:'u'});
  const msgs=()=>c.outbox.filter(x=>x.to==='telegram'&&x.method==='sendMessage'&&x.body.chat_id==='750'&&x.body.reply_markup);
  c.clock.t=Date.parse('2026-10-30T12:00:00Z'); await c.app.remind(); assert.equal(msgs().length,0,'15:00 по Москве — рано');
  c.clock.t=Date.parse('2026-10-30T16:05:00Z'); await c.app.remind(); assert.equal(msgs().length,1,'19:05 — пора');
  const m=msgs()[0]; assert.match(m.body.text,/РК2 · ИКГ|ДЗ2 · Начерт|РК2 · Начерт/); assert.match(m.body.text,/На повтор: 1 задача/);
  assert.deepEqual(m.body.reply_markup.inline_keyboard[1][0],{text:'Пауза',callback_data:'pause'});
  c.clock.t+=15*60e3; await c.app.remind(); assert.equal(msgs().length,1,'не чаще раза в день');
  await c.call('POST','/api/tg/webhook',JSON.stringify({callback_query:{id:'q1',from:{id:750},data:'pause'}}),{headers:{'x-telegram-bot-api-secret-token':'hook-secret'}});
  c.clock.t=Date.parse('2026-10-31T16:05:00Z'); await c.app.remind(); assert.equal(msgs().length,1,'пауза из бота работает');
  await c.call('POST','/api/auth/telegram',{auth:c.tg(750,'Участник')},{as:'u'});   /* прошло больше 14 дней без входа — сессия истекла, входим снова */
  assert.equal((await c.call('GET','/api/me',undefined,{as:'u'})).data.reminders.paused,true);
  await c.call('POST','/api/me/reminders',{paused:false},{as:'u'});
  c.clock.t=Date.parse('2026-10-31T20:00:00Z'); await c.app.remind(); assert.equal(msgs().length,1,'23:00 — тихие часы и окно прошло');
  c.clock.t=Date.parse('2026-11-01T16:10:00Z'); await c.app.remind(); assert.equal(msgs().length,2,'после паузы — снова');
  assert.equal((await c.call('POST','/api/tg/webhook',JSON.stringify({message:{from:{id:750},text:'/stop'}}),{headers:{'x-telegram-bot-api-secret-token':'wrong'}})).status,403,'вебхук без секрета не принимается');
  c.clock.t=Date.parse('2026-12-28T10:00:00Z'); await c.member(760,'v'); await c.call('POST','/api/me/reminders',{enabled:true,time:'19:00'},{as:'v'});
  c.clock.t=Date.parse('2026-12-28T16:10:00Z'); await c.app.remind();
  assert.equal(c.outbox.filter(x=>x.body&&x.body.chat_id==='760'&&x.body.reply_markup).length,0,'дедлайнов нет и повторять нечего — не пишем');
});

test('статика: CSP и заголовки безопасности, только разрешённые файлы',async()=>{
  const c=club({secure:true});
  const r=await c.call('GET','/'); assert.equal(r.status,200); assert.match(r.headers['Content-Security-Policy'],/frame-ancestors 'none'/); assert.match(r.headers['Content-Security-Policy'],/script-src 'self' https:\/\/telegram\.org/);
  assert.doesNotMatch(r.headers['Content-Security-Policy'],/unsafe-inline|unsafe-eval/);
  assert.equal(r.headers['X-Frame-Options'],'DENY'); assert.match(r.headers['Strict-Transport-Security'],/max-age/);
  for(const p of ['/../server/lib/app.js','/tools/build-core.js','/tests/lib.test.js','/README.md','/DEPLOY.md','/lib/../../server/index.js','/core/samples/index.json']) assert.equal((await c.call('GET',p)).status,404,p);
  assert.equal((await c.call('GET','/core/tasks.json')).status,200); assert.equal((await c.call('GET','/legal/privacy.html')).status,200);
  const api=await c.call('GET','/api/config'); assert.equal(api.headers['Cache-Control'],'no-store'); assert.equal(api.data.botId,'777000');
});

test('событие Yandex Cloud Functions → запрос (payload 1.0 и 0.1)',()=>{
  const a=fromEvent({httpMethod:'POST',path:'/api/me',headers:{Cookie:'club_sid=abc; x=1','X-Csrf-Token':'t'},body:Buffer.from('{"a":1}').toString('base64'),isBase64Encoded:true,requestContext:{identity:{sourceIp:'1.2.3.4'}}});
  assert.deepEqual([a.method,a.path,a.cookies.club_sid,a.headers['x-csrf-token'],a.body,a.ip],['POST','/api/me','abc','t','{"a":1}','1.2.3.4']);
  const b=fromEvent({httpMethod:'GET',path:'/{proxy+}',url:'/api/config?x=1',headers:{}}); assert.equal(b.path,'/api/config');
});

test('боевые настройки: без обязательных переменных функция не стартует',()=>{
  assert.throws(()=>fromEnv({}),/ORIGIN/);
  assert.throws(()=>fromEnv({ORIGIN:'http://club.nachert1830.ru',SECRET_KEY:'x'.repeat(40)}),/ORIGIN/);
  const ok=fromEnv({ORIGIN:'https://club.nachert1830.ru',SECRET_KEY:'x'.repeat(40),YDB_DOCAPI_ENDPOINT:'https://docapi.example',YDB_KEY_ID:'k',YDB_SECRET:'s',TG_BOT_TOKEN:'1:x',TG_WEBHOOK_SECRET:'w',ADMIN_TG_IDS:'1, 2'});
  assert.equal(ok.secure,true); assert.deepEqual(ok.adminTg,['1','2']);
  assert.throws(()=>fromEnv({ORIGIN:'https://club.nachert1830.ru',SECRET_KEY:'x'.repeat(40),YDB_DOCAPI_ENDPOINT:'e',YDB_KEY_ID:'k',YDB_SECRET:'s',TG_BOT_TOKEN:'1:x'}),/TG_WEBHOOK_SECRET/);
});

test('SigV4: тестовый вектор AWS (get-vanilla)',()=>{
  const s=sign({method:'GET',url:'https://example.amazonaws.com/',headers:{}},{accessKeyId:'AKIDEXAMPLE',secretAccessKey:'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',region:'us-east-1',service:'service'},Date.parse('2015-08-30T12:36:00Z'));
  assert.equal(s.signature,'5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31');
});

test('YDB Document API: формат запросов и разбор ответов',async()=>{
  assert.deepEqual(unmarshal(marshal({a:'x',n:5,b:true,l:[1,'2'],m:{z:null}})),{a:'x',n:5,b:true,l:[1,'2'],m:{z:null}});
  const calls=[]; const fake=async(url,o)=>{ calls.push({target:o.headers['x-amz-target'],body:JSON.parse(o.body),auth:o.headers.Authorization});
    const op=o.headers['x-amz-target'].split('.')[1];
    if(op==='GetItem') return {ok:true,text:async()=>JSON.stringify({Item:{id:{S:'u1'},name:{S:'Аня'}}})};
    if(op==='PutItem') return {ok:false,status:400,text:async()=>JSON.stringify({__type:'com.amazonaws.dynamodb.v20120810#ConditionalCheckFailedException',message:'cond'})};
    if(op==='UpdateItem') return {ok:true,text:async()=>JSON.stringify({Attributes:{n:{N:'3'}}})};
    return {ok:true,text:async()=>'{}'}; };
  const st=ydbStore({endpoint:'https://docapi.serverless.yandexcloud.net/ru-central1/b1g/etn',accessKeyId:'k',secretAccessKey:'s',fetchImpl:fake,now:()=>Date.parse('2026-10-17T10:00:00Z')});
  assert.deepEqual(await st.get('users','u1'),{id:'u1',name:'Аня'});
  assert.equal(await st.put('identities',{id:'tg:1',userId:'u1'},{ifNotExists:true}),false,'условие не выполнено → false');
  assert.equal(await st.incr('ratelimit','k','n',1,{exp:5}),3);
  assert.equal(calls[0].body.TableName,'club_users'); assert.equal(calls[1].body.ConditionExpression,'attribute_not_exists(id)');
  assert.match(calls[2].body.UpdateExpression,/^ADD #n :by SET #e0 = if_not_exists\(#e0, :e0\)$/);
  assert.match(calls[0].auth,/^AWS4-HMAC-SHA256 Credential=k\/20261017\/ru-central1\/dynamodb\/aws4_request/);
});

test('скрипт развёртывания: архив функции — правильный zip без тестов и документации',()=>{
  const {zip,crc32,packageFiles}=require('../tools/deploy.js');
  assert.equal(crc32(Buffer.from('123456789')),0xCBF43926);
  const files=packageFiles(), names=files.map(f=>f[0]);
  assert.ok(names.includes('server/index.js')&&names.includes('club/index.html')&&names.includes('club/legal/consent.html'));
  assert.ok(!names.some(n=>/(^|\/)(test|tests|tools|\.data)\/|\.md$/.test(n)),'лишнее не попадает в пакет');
  const z=zip(files); assert.equal(z.readUInt32LE(0),0x04034b50); assert.equal(z.readUInt32LE(z.length-22),0x06054b50); assert.equal(z.readUInt16LE(z.length-12),files.length);
});
