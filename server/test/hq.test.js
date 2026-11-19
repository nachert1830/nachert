/* Штаб владельца: монолог → карта → ТЗ → диспетчер → исполнение; бюджет; только для админа */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {club}=require('./helpers');
const RO=require('../lib/hq/roster');

function net(){ const n={calls:[],replies:[],issues:{},labels:[]};
  n.fn=async(url,o)=>{ let mm0; const b=o&&o.body?JSON.parse(o.body):null; n.calls.push({url,body:b,method:o&&o.method});
    if(url==='https://api.proxyapi.ru/v1/chat/completions'){ const r=n.replies.shift(); if(!r) return {status:500,json:{error:{message:'нет ответа'}}};
      return {status:200,json:{choices:[{message:{content:typeof r==='string'?r:JSON.stringify(r)},finish_reason:'stop'}],usage:{prompt_tokens:10000,completion_tokens:2000}}}; }
    const m=/^https:\/\/api\.github\.com\/repos\/nachert1830\/nachert(\/.*)$/.exec(url); if(!m) return null;
    mm0=/^\/issues\/(\d+)$/.exec(m[1]); if(mm0&&o.method==='PATCH'){ return {status:200,json:n.issues[mm0[1]]}; }
    if(m[1]==='/issues'&&o.method==='POST'){ const num=200+Object.keys(n.issues).length; n.issues[num]={number:num,body:b.body,labels:b.labels.map(x=>({name:x})),state:'open'};
      return {status:201,json:{number:num,html_url:'https://github.com/nachert1830/nachert/issues/'+num}}; }
    if(/^\/issues\?labels=/.test(m[1])) return {status:200,json:n.alarms||[]};
    let mm=/^\/issues\/(\d+)\/labels$/.exec(m[1]); if(mm){ n.issues[mm[1]].labels.push(...b.labels.map(x=>({name:x}))); return {status:200,json:[]}; }
    mm=/^\/issues\/(\d+)\/comments/.exec(m[1]); if(mm) return {status:200,json:n.comments||[]};
    mm=/^\/issues\/(\d+)$/.exec(m[1]); if(mm) return {status:200,json:n.issues[mm[1]]};
    return {status:404,json:{}}; };
  return n; }

async function setup(o){ const n=net(); const c=club({net:n.fn,cfg:{hq:Object.assign({key:'px-key',ghToken:'gh',ghRepo:'nachert1830/nachert'},o||{})}}); await c.owner(); return {c,n}; }

test('Штаб: только владелец', async()=>{ const {c}=await setup(); await c.member(2002);
  assert.equal((await c.call('GET','/api/hq',undefined,{as:'m2002'})).status,403);
  const r=await c.call('GET','/api/hq',undefined,{as:'owner'}); assert.equal(r.status,200);
  assert.equal(r.data.settings.roles.analyst,'flash'); assert.equal(r.data.settings.staff.code.complex,'opus'); assert.equal(r.data.keys.proxy,true); });

test('Штаб: монолог → карта, цена, привязка к цели', async()=>{ const {c,n}=await setup();
  n.replies.push({summary:'Нужно больше студентов к сессии',strategy:[{key:'s1',title:'Стать главным сайтом по начерту',text:''}],
    goals:[{key:'g1',title:'1000 студентов в день к сессии',parent:'s1'}],
    tasks:[{key:'t1',title:'Сделать разбор ДЗ №4',parent:'g1',kind:'code',level:'complex'},{key:'t2',title:'Написать пост',parent:'g1',kind:'text',level:'simple'}],
    ideas:[{title:'Телеграм-канал'}],noise:['устал сегодня'],questions:['К какой дате?']});
  const r=await c.call('POST','/api/hq/dump',{text:'ну короче надо чтобы к сессии было больше студентов, сделать разбор ДЗ четыре и написать пост'},{as:'owner'});
  assert.equal(r.status,200,JSON.stringify(r.data)); assert.equal(r.data.nodes.length,6);
  const g=r.data.nodes.find(x=>x.type==='goal'), s=r.data.nodes.find(x=>x.type==='strategy'), t=r.data.nodes.find(x=>x.title==='Сделать разбор ДЗ №4');
  assert.equal(g.parent,s.id); assert.equal(t.parent,g.id); assert.equal(t.kind,'code');
  /* Gemini Flash: 10000 вх × 0.30 + 2000 вых × 2.5 = $0.008 × 110 = 0.88 ₽ */
  assert.equal(r.data.rub,0.88); assert.equal(r.data.spent,0.88);
  assert.equal(n.calls[0].body.model,'google/gemini-2.5-flash'); assert.equal(n.calls[0].body.max_completion_tokens,6000);
  /* второй монолог видит существующие цели */
  n.replies.push({summary:'',tasks:[{title:'Ускорить главную',parent:g.id,kind:'code',level:'simple'}]});
  const r2=await c.call('POST','/api/hq/dump',{text:'и ещё главную ускорить бы, она медленная, это к той же цели'},{as:'owner'});
  assert.equal(r2.data.nodes[0].parent,g.id); assert.match(n.calls[1].body.messages[1].content,new RegExp(g.id)); });

test('Штаб: продакт → диспетчер → Цех (Issue) → статус и стоимость', async()=>{ const {c,n}=await setup();
  const t=(await c.call('POST','/api/hq/node',{op:'add',type:'task',title:'Кнопка «Поделиться» на разборе'},{as:'owner'})).data.node;
  n.replies.push({reply:'Где кнопка: в шапке разбора или внизу?',spec:{title:'Кнопка «Поделиться»',what:'Добавить кнопку',done:['кнопка копирует ссылку']},ready:false});
  let r=await c.call('POST','/api/hq/chat',{id:t.id},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data)); assert.equal(r.data.node.status,'talk');
  assert.equal(n.calls[0].body.model,'anthropic/claude-sonnet-5-5');
  n.replies.push({reply:'Готово, ТЗ ниже.',spec:{title:'Кнопка «Поделиться» внизу разбора',what:'Добавить кнопку внизу',where:'плеер разбора',done:['кнопка копирует ссылку'],kind:'code',level:'simple'},ready:true});
  r=await c.call('POST','/api/hq/chat',{id:t.id,text:'внизу'},{as:'owner'}); assert.equal(r.data.node.status,'ready'); assert.equal(r.data.node.chat.length,3);
  n.replies.push({kind:'code',level:'simple',why:'одна кнопка'});
  r=await c.call('POST','/api/hq/assign',{id:t.id},{as:'owner'}); assert.equal(r.data.node.model,'deepseek'); assert.equal(n.calls[2].body.model,'anthropic/claude-haiku-5-5');
  /* владелец меняет исполнителя вручную и запускает */
  r=await c.call('POST','/api/hq/run',{id:t.id,model:'sonnet'},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  const iss=n.issues[r.data.node.issue]; assert.ok(iss); assert.match(iss.body,/Кнопка «Поделиться» внизу разбора/); assert.doesNotMatch(iss.body,/Где кнопка/,'переписка с продактом в публичный Issue не попадает');
  assert.deepEqual(iss.labels.map(l=>l.name).sort(),['автовыкатка','исп:sonnet','цех'].sort());
  /* Цех отчитался */
  n.comments=[{id:1,body:'✅ Выкачено. <!-- hq:{"rub":3.5,"model":"sonnet","pr":"https://github.com/x/pull/9"} -->'}]; iss.labels.push({name:'готово'}); iss.state='closed';
  const before=(await c.call('GET','/api/hq',undefined,{as:'owner'})).data.spent;
  r=await c.call('POST','/api/hq/sync',{},{as:'owner'}); assert.equal(r.data.nodes[0].status,'done'); assert.equal(Math.round((r.data.spent-before)*100)/100,3.5);
  r=await c.call('POST','/api/hq/sync',{},{as:'owner'}); assert.equal(Math.round((r.data.spent-before)*100)/100,3.5,'стоимость не считается дважды'); });

test('Штаб: текст пишет модель сразу; лимит бюджета', async()=>{ const {c,n}=await setup();
  await c.call('POST','/api/hq/settings',{settings:{budgetRub:1}},{as:'owner'});
  const t=(await c.call('POST','/api/hq/node',{op:'add',type:'task',title:'Пост про РК2'},{as:'owner'})).data.node;
  await c.call('POST','/api/hq/node',{id:t.id,kind:'text',level:'complex'},{as:'owner'});
  n.replies.push('# Пост\nтекст\nГотово: да');
  let r=await c.call('POST','/api/hq/run',{id:t.id},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data)); assert.equal(r.data.node.status,'review'); assert.match(r.data.node.result,/Пост/);
  /* Sonnet: 10000×2 + 2000×10 = $0.04 × 110 = 4.4 ₽ — лимит 1 ₽ превышен, следующий вызов запрещён */
  assert.equal(r.data.rub,4.4);
  r=await c.call('POST','/api/hq/run',{id:t.id},{as:'owner'}); assert.equal(r.status,402); assert.match(r.data.error,/Лимит месяца/); });

test('Штаб: длинная диктовка файлом → текст', async()=>{ const n=net(); let got=null;
  const c=club({net:async(url,o)=>{ if(url==='https://api.proxyapi.ru/v1/audio/transcriptions'){ got=o.body; return {status:200,json:{text:'привет это монолог'}}; } return n.fn(url,o); },cfg:{hq:{key:'k'}}}); await c.owner();
  const r=await c.call('POST','/api/hq/listen',{b64:Buffer.from('audio').toString('base64'),mime:'audio/webm',sec:60},{as:'owner'});
  assert.equal(r.status,200,JSON.stringify(r.data)); assert.equal(r.data.text,'привет это монолог'); assert.equal(got.get('model'),'openai/gpt-4o-transcribe'); assert.equal(got.get('language'),'ru'); });

test('Штаб: свои модели и настройки проверяются', ()=>{
  const s=RO.settings({roles:{analyst:'nope',product:'opus'},custom:{'my-ds':{id:'deepseek/deepseek-r2',in:1,out:2}},staff:{code:{simple:'my-ds'}},budgetRub:-5});
  assert.equal(s.roles.analyst,'flash'); assert.equal(s.roles.product,'opus'); assert.equal(s.staff.code.simple,'my-ds'); assert.equal(s.budgetRub,1000);
  assert.equal(RO.cost(RO.MODELS.opus,{prompt_tokens:1e6,completion_tokens:0,prompt_tokens_details:{cached_tokens:9e5}},100),58); });

test('Штаб: разговор — мысли → разбор в ленте; ответ продакту; «запускай» → Цех; статус и откат', async()=>{ const {c,n}=await setup();
  /* 1. мысли: Секретарь → thoughts → Аналитик */
  n.replies.push({intent:'thoughts'});
  n.replies.push({summary:'Нужна кнопка поделиться',tasks:[{key:'t1',title:'Кнопка «Поделиться»',kind:'code',level:'simple'}],noise:['ну короче']});
  let r=await c.call('POST','/api/hq/talk',{text:'ну короче нужна кнопка поделиться на разборах'},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  let f=(await c.call('GET','/api/hq/feed',undefined,{as:'owner'})).data.feed; assert.equal(f.length,2); assert.equal(f[0].who,'me'); assert.match(f[1].text,/задачи 1/);
  const disc=f[1].acts.find(a=>a.op==='discuss'); assert.ok(disc&&disc.main); assert.equal(n.calls[0].body.model,'anthropic/claude-haiku-5-5');
  /* 2. кнопка «Обсудить» → вопрос продакта в ленте */
  n.replies.push({reply:'Внизу или в шапке?',spec:{title:'Кнопка «Поделиться»',what:'кнопка'},ready:false});
  r=await c.call('POST','/api/hq/act',{op:'discuss',a:disc.a},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  /* 3. голосом ответ → Секретарь узнаёт, к какой задаче → продакт → ТЗ готово с кнопкой «Запустить» */
  n.replies.push({intent:'answer',node:disc.a.id,text:'внизу'});
  n.replies.push({reply:'Готово.',spec:{title:'Кнопка «Поделиться» внизу',what:'внизу',done:['копирует ссылку'],kind:'code',level:'simple'},ready:true});
  r=await c.call('POST','/api/hq/talk',{text:'внизу давай'},{as:'owner'}); assert.equal(r.status,200);
  assert.match(n.calls[n.calls.length-2].body.messages[1].content,new RegExp(disc.a.id),'Секретарь видит открытый вопрос и id задачи');
  f=(await c.call('GET','/api/hq/feed',undefined,{as:'owner'})).data.feed; const last=f[f.length-1];
  assert.match(last.text,/ТЗ готово.*DeepSeek V3\.2, оценка ~\d/); assert.equal(last.acts[0].op,'run');
  /* 4. «запускай» → диспетчер не нужен (вид и сложность из ТЗ) → Issue */
  n.replies.push({intent:'run',node:disc.a.id,reply:'Запускаю.'});
  r=await c.call('POST','/api/hq/talk',{text:'запускай'},{as:'owner'}); assert.equal(r.status,200);
  const num=Object.keys(n.issues)[0]; assert.ok(num,'Issue создан');
  f=(await c.call('GET','/api/hq/feed',undefined,{as:'owner'})).data.feed; assert.match(f[f.length-1].text,/Отправил в Цех/);
  /* 5. Цех выкатил → sync → «Готово» с кнопкой «Откатить» */
  n.comments=[{id:7,body:'✅ <!-- hq:{"rub":2,"model":"deepseek","pr":"https://github.com/x/pull/3"} -->'}]; n.issues[num].labels.push({name:'готово'});
  await c.call('POST','/api/hq/act',{op:'sync'},{as:'owner'});
  f=(await c.call('GET','/api/hq/feed',undefined,{as:'owner'})).data.feed; const done=f[f.length-1]; assert.match(done.text,/Готово.*на сайте/); assert.equal(done.acts[0].op,'rollback');
  /* 6. откат → метка «откат» на Issue */
  r=await c.call('POST','/api/hq/act',{op:'rollback',a:done.acts[0].a},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  assert.ok(n.issues[num].labels.some(l=>l.name==='откат'));
  /* лента — только владельцу; after — только новое */
  await c.member(3003); assert.equal((await c.call('GET','/api/hq/feed',undefined,{as:'m3003'})).status,403);
  const tail=(await c.call('GET','/api/hq/feed?after='+encodeURIComponent(f[f.length-2].id),undefined,{as:'owner'})).data.feed; assert.ok(tail.length>=2); });

test('Штаб: разговор — лимит бюджета пишется в ленту, а не роняет запрос', async()=>{ const {c,n}=await setup();
  await c.call('POST','/api/hq/settings',{settings:{budgetRub:0.01}},{as:'owner'});
  n.replies.push({intent:'thoughts'});
  const r=await c.call('POST','/api/hq/talk',{text:'хочу новую главную страницу'},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  const f=(await c.call('GET','/api/hq/feed',undefined,{as:'owner'})).data.feed; assert.match(f[f.length-1].text,/Лимит месяца/); });

test('Штаб: вопрос про код → исполнитель читает → ответ в ленте → «Сделать задачей»; реплика к задаче в работе; тревога main', async()=>{ const {c,n}=await setup();
  n.replies.push({intent:'ask',text:'почему не печатается лист ДЗ №3?'});
  let r=await c.call('POST','/api/hq/talk',{text:'слушай, а почему не печатается лист ДЗ 3?'},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  const num=Object.keys(n.issues)[0], iss=n.issues[num]; assert.deepEqual(iss.labels.map(l=>l.name).sort(),['вопрос','исп:gpro'].sort()); assert.match(iss.body,/только читает/);
  let f=(await c.call('GET','/api/hq/feed',undefined,{as:'owner'})).data.feed; assert.match(f[f.length-1].text,/Ищу ответ/);
  /* ответ пришёл */
  n.comments=[{id:11,body:'Печать ломает стиль @page в index.html:1234. <!-- hq-answer --> <!-- hq:{"rub":0.7} -->'}]; iss.labels.push({name:'ответ'});
  await c.call('POST','/api/hq/act',{op:'sync'},{as:'owner'});
  f=(await c.call('GET','/api/hq/feed',undefined,{as:'owner'})).data.feed; const ans=f[f.length-1];
  assert.match(ans.text,/Ответ.*@page/s); assert.equal(ans.acts[0].op,'totask');
  n.replies.push({reply:'Чинить стиль @page?',spec:{title:'Починить печать листа ДЗ №3',what:'стиль @page'},ready:false});
  r=await c.call('POST','/api/hq/act',{op:'totask',a:ans.acts[0].a},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  const task=(await c.call('GET','/api/hq',undefined,{as:'owner'})).data.nodes.find(x=>x.type==='task'); assert.match(task.title,/Починить/);
  /* задача в работе + реплика на ходу → комментарий в Issue */
  await c.call('POST','/api/hq/node',{id:task.id,kind:'code',level:'simple'},{as:'owner'});
  await c.call('POST','/api/hq/run',{id:task.id},{as:'owner'});
  const before=n.calls.filter(x=>/\/comments$/.test(x.url)&&x.method==='POST').length;
  n.replies.push({intent:'discuss',node:task.id,text:'и проверь в тёмной теме'});
  await c.call('POST','/api/hq/talk',{text:'и проверь в тёмной теме'},{as:'owner'});
  const posted=n.calls.filter(x=>/\/comments$/.test(x.url)&&x.method==='POST'); assert.equal(posted.length,before+1); assert.match(posted[posted.length-1].body.body,/💬 Владелец: и проверь в тёмной теме/);
  /* тревога: полная проверка main красная → один раз в ленте с «Починить» → ТЗ готово */
  n.alarms=[{number:77,body:'Полная проверка красная\n```\n- Пульт · телефон: прокрутка 40 px\n```',html_url:'https://github.com/x/issues/77'}];
  await c.call('POST','/api/hq/act',{op:'sync'},{as:'owner'}); await c.call('POST','/api/hq/act',{op:'sync'},{as:'owner'});
  f=(await c.call('GET','/api/hq/feed',undefined,{as:'owner'})).data.feed; const al=f.filter(x=>/Сайт просит/.test(x.text)); assert.equal(al.length,1); assert.match(al[0].text,/прокрутка 40 px/);
  r=await c.call('POST','/api/hq/act',{op:'fixmain',a:al[0].acts[0].a},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  f=(await c.call('GET','/api/hq/feed',undefined,{as:'owner'})).data.feed; assert.match(f[f.length-1].text,/ТЗ готово: «Починить красную проверку main».*Claude Opus 5\.5/s); });

test('Штаб: память — «запомни» → правило в каждом ТЗ; провал → урок для похожей задачи', async()=>{ const {c,n}=await setup();
  n.replies.push({intent:'remember',text:'тексты для студентов — на «ты»'});
  await c.call('POST','/api/hq/talk',{text:'запомни: тексты для студентов на ты'},{as:'owner'});
  let st=(await c.call('GET','/api/hq',undefined,{as:'owner'})).data; assert.equal(st.memory[0].kind,'правило');
  /* провал задачи «кнопка поделиться на разборе» → урок */
  const t=(await c.call('POST','/api/hq/node',{op:'add',type:'task',title:'Кнопка поделиться на разборе задачи'},{as:'owner'})).data.node;
  await c.call('POST','/api/hq/node',{id:t.id,kind:'code',level:'simple'},{as:'owner'});
  await c.call('POST','/api/hq/run',{id:t.id},{as:'owner'}); const n1=Object.keys(n.issues)[0];
  n.comments=[{id:5,body:'❌ Не получилось: плеер разбора перерисовывает шапку, кнопка пропадает <!-- hq:{"rub":1} -->'}]; n.issues[n1].labels.push({name:'провал'});
  await c.call('POST','/api/hq/act',{op:'sync'},{as:'owner'});
  st=(await c.call('GET','/api/hq',undefined,{as:'owner'})).data; assert.ok(st.memory.some(x=>x.kind==='урок'&&/плеер разбора/.test(x.text)));
  /* похожая задача → в ТЗ Цеха правило и урок; непохожая — только правило */
  const t2=(await c.call('POST','/api/hq/node',{op:'add',type:'task',title:'Кнопка копировать ссылку на разборе задачи'},{as:'owner'})).data.node;
  await c.call('POST','/api/hq/node',{id:t2.id,kind:'code',level:'simple'},{as:'owner'}); await c.call('POST','/api/hq/run',{id:t2.id},{as:'owner'});
  const b2=n.issues[Object.keys(n.issues)[1]].body; assert.match(b2,/Правила владельца[\s\S]*на «ты»/); assert.match(b2,/Уроки прошлых задач[\s\S]*плеер разбора/);
  const t3=(await c.call('POST','/api/hq/node',{op:'add',type:'task',title:'Новый шрифт заголовков'},{as:'owner'})).data.node;
  await c.call('POST','/api/hq/node',{id:t3.id,kind:'code',level:'simple'},{as:'owner'}); await c.call('POST','/api/hq/run',{id:t3.id},{as:'owner'});
  const b3=n.issues[Object.keys(n.issues)[2]].body; assert.match(b3,/на «ты»/); assert.doesNotMatch(b3,/Уроки прошлых задач/);
  /* удалить правило */
  const r=await c.call('POST','/api/hq/memory',{op:'del',i:0},{as:'owner'}); assert.ok(!r.data.memory.some(x=>x.kind==='правило')); });

test('Штаб: люди — все зарегистрированные, кто был сегодня и кто сейчас онлайн; только владельцу', async()=>{ const {c}=await setup();
  await c.member(4001,'a'); await c.member(4002,'b');
  /* «a» сейчас в кабинете (сигнал присутствия), «b» заходил 2 дня назад */
  const us=await c.store.scan('users'), A=us.find(u=>u.name&&u.id!==us.find(x=>x.role==='admin').id);
  c.clock.t+=3*864e5; const t=c.clock.t;   /* регистрация и вход были 3 дня назад */
  for(const u of us){ if(u.role==='admin') continue; if(u.id===A.id) await c.store.update('users',u.id,{live:{at:t-30e3,view:'#/ng/rk2'},lastSeen:t-30e3}); else await c.store.update('users',u.id,{lastSeen:t-2*864e5}); }
  const r=await c.call('GET','/api/hq/people',undefined,{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal(r.data.total,3); assert.equal(r.data.online,1);
  const a=r.data.people.find(p=>p.id===A.id); assert.equal(a.online,true); assert.equal(a.today,true); assert.equal(a.view,'#/ng/rk2');
  assert.equal(r.data.people[0].id,A.id,'онлайн — сверху');
  const b=r.data.people.find(p=>p.id!==A.id&&p.role!=='admin'); assert.equal(b.today,false); assert.equal(b.online,false); assert.ok(b.name);
  assert.equal((await c.call('GET','/api/hq/people',undefined,{as:'a'})).status,403); });
