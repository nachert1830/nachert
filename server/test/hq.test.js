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
    mm0=/^\/issues\/(\d+)$/.exec(m[1]); if(mm0&&o.method==='PATCH'){ const i=n.issues[mm0[1]]; if(i&&b){ if(b.body!=null) i.body=b.body; if(b.labels) i.labels=b.labels.map(x=>({name:x})); if(b.state) i.state=b.state; } return {status:200,json:i}; }
    if(m[1]==='/issues'&&o.method==='POST'){ const num=200+Object.keys(n.issues).length; n.issues[num]={number:num,body:b.body,labels:b.labels.map(x=>({name:x})),state:'open'};
      return {status:201,json:{number:num,html_url:'https://github.com/nachert1830/nachert/issues/'+num}}; }
    if(/^\/issues\?labels=/.test(m[1])) return {status:200,json:n.alarms||[]};
    let mm=/^\/issues\/(\d+)\/labels$/.exec(m[1]); if(mm){ n.issues[mm[1]].labels.push(...b.labels.map(x=>({name:x}))); return {status:200,json:[]}; }
    mm=/^\/issues\/(\d+)\/comments/.exec(m[1]); if(mm) return {status:200,json:(n.commentsBy&&n.commentsBy[mm[1]])||n.comments||[]};
    if(/^\/actions\/workflows\/check\.yml\/runs/.test(m[1])) return {status:200,json:{workflow_runs:n.runs||[]}};
    if(m[1]==='/actions/workflows/check.yml/dispatches'){ n.dispatched=(n.dispatched||0)+1; return {status:204,json:{}}; }
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

/* ── эпики: главный инженер, план, планировщик ── */
const EPIC=require('../lib/hq/epic');
const T=(key,o)=>Object.assign({key,title:'Задача '+key,what:'сделать '+key,where:'me/index.html',done:['готово '+key],not:[],kind:'code',level:'simple',core:false,deps:[],test:'node tests/run.js --only=me'},o||{});
const PLAN=()=>({summary:'Панель здоровья в пульте',architecture:'данные запусков — сервер\nпанель — me/',tasks:[T('t1'),T('t2',{level:'medium',deps:['t1']}),T('t3',{core:true,level:'medium',deps:['t1']}),T('t4',{deps:['t2','t3']})],risks:['лимит API'],questions:['Показывать красные первыми?']});
const planComment=(id,plan,rub)=>({id,body:'🧭 План\n\n<!-- hq-plan -->\n```json\n'+JSON.stringify(plan)+'\n```\n<!-- /hq-plan -->\n<!-- hq:{"rub":'+(rub||12.5)+',"model":"opus"} -->'});
const nodesOf=async c=>(await c.call('GET','/api/hq',undefined,{as:'owner'})).data.nodes;
const feedOf=async c=>(await c.call('GET','/api/hq/feed',undefined,{as:'owner'})).data.feed;
const sync=c=>c.call('POST','/api/hq/sync',{},{as:'owner'});
const issueOf=(n,node)=>n.issues[node.issue];
/* задача в Цехе завершилась: метка и комментарий с отчётом */
function finish(n,node,ok,o){ o=o||{}; n.commentsBy=n.commentsBy||{}; const i=issueOf(n,node);
  n.commentsBy[node.issue]=[{id:1000+node.issue,body:(ok?'✅ Выкачено.\n\nОтчёт: '+(o.report||'сделал '+node.ekey):'❌ Не получилось: тесты красные в блоке me')+'\n<!-- hq:{"rub":'+(o.rub||1)+',"model":"deepseek"'+(ok?',"pr":"https://github.com/x/pull/'+node.issue+'"':'')+'} -->'}];
  i.labels=i.labels.filter(l=>!['готово','провал'].includes(l.name)).concat([{name:ok?'готово':'провал'}]); }
async function epicReady(c,n,plan){
  const r=await c.call('POST','/api/hq/act',{op:'epic',a:{text:'Панель «Здоровье сайта» в пульте'}},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  const e=(await nodesOf(c)).find(x=>x.type==='epic'); n.commentsBy=n.commentsBy||{}; n.commentsBy[e.issue]=[planComment(50,plan||PLAN())];
  await sync(c); return (await nodesOf(c)).find(x=>x.id===e.id); }
async function epicRunning(c,n,plan){ const e=await epicReady(c,n,plan);
  const r=await c.call('POST','/api/hq/act',{op:'epicok',a:{id:e.id}},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  const ns=await nodesOf(c); return {e:ns.find(x=>x.id===e.id),tasks:ns.filter(x=>x.epic===e.id).sort((a,b)=>a.eorder-b.eorder)}; }
const byKey=async(c,e)=>Object.fromEntries((await nodesOf(c)).filter(x=>x.epic===e.id).map(x=>[x.ekey,x]));

test('Эпик: Секретарь «epic» → эпик planning, Issue «эпик» без монолога владельца', async()=>{ const {c,n}=await setup();
  n.replies.push({intent:'epic',text:'Панель «Здоровье сайта» в пульте: последние 5 запусков проверки main',reply:'Это большая цель — отдаю Главному инженеру.'});
  const r=await c.call('POST','/api/hq/talk',{text:'ну короче блин устал, хочу в пульте панель здоровья сайта, последние запуски проверки main, ну ты понял'},{as:'owner'});
  assert.equal(r.status,200,JSON.stringify(r.data));
  const e=(await nodesOf(c)).find(x=>x.type==='epic'); assert.ok(e,'эпик создан'); assert.equal(e.status,'planning');
  const iss=n.issues[e.issue]; assert.ok(iss); assert.deepEqual(iss.labels.map(l=>l.name).sort(),['исп:opus','эпик'].sort());
  assert.match(iss.body,/Панель «Здоровье сайта»/); assert.doesNotMatch(iss.body,/ну короче|устал|ты понял/,'монолог владельца в публичный Issue не попадает');
  assert.match(iss.body,/hq-model:\{"key":"opus"/);
  const f=await feedOf(c); assert.match(f[f.length-1].text,/Главный инженер.*пишет план/);
  assert.equal(RO.ROLES.chief.def,'opus'); assert.equal((await c.call('GET','/api/hq',undefined,{as:'owner'})).data.settings.roles.chief,'opus'); });

test('Эпик: validatePlan — цикл, битый dep, нет test, > 30 % сложных, < 3 задач отклоняются; верный принимается', ()=>{
  assert.equal(EPIC.validatePlan(PLAN()).ok,true);
  const bad=(f,re)=>{ const p=PLAN(); f(p); const v=EPIC.validatePlan(p); assert.equal(v.ok,false); assert.ok(v.errors.some(x=>re.test(x)),v.errors.join(' | ')); };
  bad(p=>{ p.tasks[0].deps=['t4']; },/цикл/);
  bad(p=>{ p.tasks[1].deps=['t9']; },/несуществующей/);
  bad(p=>{ delete p.tasks[2].test; },/нет test/);
  bad(p=>{ p.tasks[0].done=[]; },/нет done/);
  bad(p=>{ p.tasks[3].where=''; },/нет where/);
  bad(p=>{ p.tasks[0].level='complex'; p.tasks[1].level='complex'; },/30 %/);
  bad(p=>{ p.tasks=p.tasks.slice(0,2); p.tasks[1].deps=['t1']; },/не меньше 3/);
  bad(p=>{ p.tasks=Array.from({length:31},(_,i)=>T('k'+i)); },/не больше 30/); });

test('Эпик: план из комментария → review, карточка с оценкой; «Утвердить» → running; задачи по одной по deps; блок эпика в ТЗ; ядро — Главный инженер; приёмка', async()=>{ const {c,n}=await setup();
  const e=await epicReady(c,n);
  assert.equal(e.status,'review');
  let f=await feedOf(c), card=f.find(x=>/План эпика/.test(x.text)); assert.ok(card,'карточка плана в ленте');
  assert.match(card.text,/Задачи \(4\)/); assert.match(card.text,/Оценка: ~[\d.]+ ₽, бюджет эпика с запасом — [\d.]+ ₽/); assert.match(card.text,/Claude Opus 5\.5, средняя, ядро \(после 1\)/); assert.match(card.text,/❓ Показывать красные/);
  assert.deepEqual(card.acts.map(a=>a.op),['epicok','epicreplan','epiccancel']);
  /* оценка: DeepSeek 1,11 + Sonnet 14,08 + Opus 28,16 (t3 — ядро: Opus, хоть и medium) + DeepSeek 1,11 = 44,46 ₽ × 1,5 */
  assert.equal(e.budgetRub,66.69);
  /* утвердить → первая задача в Цехе, остальные ждут */
  const r=await c.call('POST','/api/hq/act',{op:'epicok',a:card.acts[0].a},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  let k=await byKey(c,e); assert.equal((await nodesOf(c)).find(x=>x.id===e.id).status,'running');
  assert.equal(k.t1.status,'running'); assert.equal(k.t2.status,'ready'); assert.equal(k.t3.status,'ready');
  const b1=issueOf(n,k.t1).body; assert.match(b1,/## Эпик: /); assert.match(b1,/Что уже сделано: это первая задача/); assert.match(b1,/\*\*Проверка:\*\* node tests\/run\.js --only=me/);
  assert.ok(issueOf(n,k.t1).labels.some(l=>l.name==='исп:deepseek'));
  /* задача в работе — тик ничего не запускает */
  const before=Object.keys(n.issues).length; await sync(c); assert.equal(Object.keys(n.issues).length,before);
  /* t1 готова → следующая t2 (deps готовы), в её ТЗ — что уже сделано */
  finish(n,k.t1,true,{report:'добавил данные запусков в /api/health'}); await sync(c); k=await byKey(c,e);
  assert.equal(k.t1.status,'done'); assert.equal(k.t2.status,'running'); assert.equal(k.t4.status,'ready');
  assert.match(issueOf(n,k.t2).body,/Что уже сделано: \n- Задача t1: добавил данные запусков/); assert.ok(issueOf(n,k.t2).labels.some(l=>l.name==='исп:sonnet'));
  /* t2 готова → t3 «ядро» → исполнитель роли chief */
  finish(n,k.t2,true); await sync(c); k=await byKey(c,e); assert.equal(k.t3.status,'running'); assert.equal(k.t3.model,'opus'); assert.ok(issueOf(n,k.t3).labels.some(l=>l.name==='исп:opus'));
  finish(n,k.t3,true); await sync(c); k=await byKey(c,e); assert.equal(k.t4.status,'running');
  /* все готовы → полная проверка main ещё не прошла: Штаб её запрашивает и ждёт */
  finish(n,k.t4,true); await sync(c); assert.equal((await nodesOf(c)).find(x=>x.id===e.id).status,'running'); assert.equal(n.dispatched,1);
  /* проверка зелёная → Главный инженер сверяет → эпик готов, итог в ленте с ценой и PR */
  n.runs=[{id:9,status:'completed',conclusion:'success',created_at:new Date(c.clock.t).toISOString(),html_url:'https://github.com/x/actions/runs/9'}];
  n.replies.push({ok:true,summary:'В пульте есть панель здоровья сайта',missing:[]});
  await sync(c); const done=(await nodesOf(c)).find(x=>x.id===e.id); assert.equal(done.status,'done');
  f=await feedOf(c); const fin=f[f.length-1]; assert.match(fin.text,/🏁 Эпик «.*» готов/); assert.match(fin.text,/Стоило [\d.]+ ₽ \(план 12\.5/); assert.match(fin.text,/панель здоровья/);
  /* план 12,5 + задачи 4 × 1 + сверка Opus (10000 вх × 4 + 2000 вых × 20 = $0,08 × 110 = 8,8) */
  assert.equal(fin.links.length,4); assert.equal(done.spentRub,25.3);
  assert.equal(n.calls.filter(x=>x.url.includes('proxyapi')).length,1,'Opus на сервере — только приёмка (план — в Цехе)'); });

test('Эпик: провал → разбор Главного инженера → split с теми же deps; лимит разборов → пауза и вопрос', async()=>{ const {c,n}=await setup();
  const {e}=await epicRunning(c,n); let k=await byKey(c,e);
  finish(n,k.t1,true); await sync(c); k=await byKey(c,e); assert.equal(k.t2.status,'running');
  /* t2 провалилась → Главный инженер: split на 2 */
  n.replies.push({decision:'split',why:'задача слишком большая',tasks:[T('a',{title:'Данные панели'}),T('b',{title:'Вид панели',deps:['a']})]});
  finish(n,k.t2,false); await sync(c);
  const ns=(await nodesOf(c)).filter(x=>x.epic===e.id); k=Object.fromEntries(ns.map(x=>[x.ekey,x]));
  assert.ok(!k.t2,'разбитая задача — в архиве'); const a=k['t2.1'], b=k['t2.2']; assert.ok(a&&b,'две новые задачи');
  assert.ok(a.deps.includes(k.t1.id),'части сохраняют deps исходной'); assert.ok(b.deps.includes(a.id)&&b.deps.includes(k.t1.id));
  assert.ok(k.t4.deps.includes(a.id)&&k.t4.deps.includes(b.id),'кто ждал исходную — ждёт части');
  const chiefCall=n.calls.filter(x=>x.url.includes('proxyapi')).slice(-1)[0]; assert.equal(chiefCall.body.model,'anthropic/claude-opus-5-5'); assert.match(chiefCall.body.messages[0].content,/главный инженер/i);
  let f=await feedOf(c); assert.ok(f.some(x=>/Разбил на 2/.test(x.text)));
  /* следующий тик — первая часть; лимит: у неё уже 2 разбора → пауза и вопрос владельцу */
  await sync(c); k=await byKey(c,e); assert.equal(k['t2.1'].status,'running');
  await c.store.update('hqnodes',k['t2.1'].id,{fixes:2});
  finish(n,k['t2.1'],false); await sync(c);
  const ep=(await nodesOf(c)).find(x=>x.id===e.id); assert.equal(ep.status,'paused');
  f=await feedOf(c); const q=f[f.length-1]; assert.match(q.text,/Нужна твоя помощь/); assert.deepEqual(q.acts.map(x=>x.op),['epicresume','epicstop']);
  assert.equal(n.calls.filter(x=>x.url.includes('proxyapi')).length,1,'сверх лимита Главный инженер не вызывается');
  /* владелец отвечает → задача снова готова, эпик идёт */
  const r=await c.call('POST','/api/hq/act',{op:'epicresume',a:{id:e.id,text:'бери данные из check.yml'}},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  k=await byKey(c,e); assert.equal(k['t2.1'].status,'running'); assert.match(issueOf(n,k['t2.1']).body,/Ответ владельца: бери данные из check\.yml/); });

test('Эпик: лимит разборов на эпик и вопрос Главного инженера → пауза', async()=>{ const {c,n}=await setup();
  const {e}=await epicRunning(c,n); let k=await byKey(c,e);
  n.replies.push({decision:'ask',why:'неясно',question:'Брать данные из GitHub API или из Issue? (A/B)'});
  finish(n,k.t1,false); await sync(c);
  let ep=(await nodesOf(c)).find(x=>x.id===e.id); assert.equal(ep.status,'paused'); let f=await feedOf(c); assert.match(f[f.length-1].text,/Брать данные из GitHub API/);
  await c.call('POST','/api/hq/act',{op:'epicresume',a:{id:e.id,text:'A'}},{as:'owner'}); k=await byKey(c,e); assert.equal(k.t1.status,'running');
  await c.store.update('hqnodes',e.id,{fixes:5}); finish(n,k.t1,false); await sync(c);
  ep=(await nodesOf(c)).find(x=>x.id===e.id); assert.equal(ep.status,'paused'); f=await feedOf(c); assert.match(f[f.length-1].text,/разборов на эпик уже 5/);
  /* недопустимый переход отклоняется */
  assert.equal((await c.call('POST','/api/hq/act',{op:'epicok',a:{id:e.id}},{as:'owner'})).status,409); });

test('Эпик: бюджет исчерпан → пауза с кнопками «Добавить 50 %» и «Остановить»', async()=>{ const {c,n}=await setup();
  const {e}=await epicRunning(c,n); let k=await byKey(c,e);
  finish(n,k.t1,true,{rub:e.budgetRub+1}); await sync(c);
  let ep=(await nodesOf(c)).find(x=>x.id===e.id); assert.equal(ep.status,'paused'); k=await byKey(c,e); assert.equal(k.t2.status,'ready','дальше не запускает');
  const f=await feedOf(c), last=f[f.length-1]; assert.match(last.text,/бюджет эпика исчерпан/); assert.deepEqual(last.acts.map(x=>x.op),['epicbudget','epicstop']);
  /* +50 % — и снова идёт, пока потрачено меньше */
  await c.call('POST','/api/hq/act',{op:'epicbudget',a:last.acts[0].a},{as:'owner'});
  ep=(await nodesOf(c)).find(x=>x.id===e.id); assert.equal(ep.budgetRub,Math.round(e.budgetRub*1.5*100)/100);
  await c.call('POST','/api/hq/act',{op:'epicstop',a:{id:e.id}},{as:'owner'}).then(r=>assert.ok([200,409].includes(r.status))); });

test('Эпик: план с ошибками — пауза и вопрос; переплан — замечание в Issue', async()=>{ const {c,n}=await setup();
  const r=await c.call('POST','/api/hq/act',{op:'epic',a:{text:'Панель здоровья'}},{as:'owner'}); const e=r.data.node;
  n.commentsBy={[e.issue]:[{id:70,body:'⚠️ План не прошёл проверку дважды:\n- цикл в deps: t1 → t2 → t1\n<!-- hq-plan-fail --> <!-- hq:{"rub":20} -->'}]};
  await sync(c); let ep=(await nodesOf(c)).find(x=>x.id===e.id); assert.equal(ep.status,'paused');
  let f=await feedOf(c); assert.match(f[f.length-1].text,/дважды написал план с ошибками[\s\S]*цикл/);
  await c.call('POST','/api/hq/act',{op:'epicreplan',a:{id:e.id,text:'сделай без серверной части'}},{as:'owner'});
  ep=(await nodesOf(c)).find(x=>x.id===e.id); assert.equal(ep.status,'planning'); assert.match(n.issues[e.issue].body,/Замечание владельца к прошлому плану\nсделай без серверной части/); });

test('Эпик: таймер сервера (remind) двигает эпик без открытого ЛК', async()=>{ const {c,n}=await setup();
  const r=await c.call('POST','/api/hq/act',{op:'epic',a:{text:'Панель «Здоровье сайта» в пульте'}},{as:'owner'}); const e=r.data.node;
  n.commentsBy={[e.issue]:[planComment(50,PLAN())]};
  c.clock.t+=15*60e3; const out=await c.app.remind(); assert.ok(out.hq&&!out.hq.error,JSON.stringify(out.hq));
  assert.equal((await nodesOf(c)).find(x=>x.id===e.id).status,'review','план забран по таймеру');
  await c.call('POST','/api/hq/act',{op:'epicok',a:{id:e.id}},{as:'owner'}); let k=await byKey(c,e);
  finish(n,k.t1,true); c.clock.t+=15*60e3; await c.app.remind(); k=await byKey(c,e);
  assert.equal(k.t1.status,'done'); assert.equal(k.t2.status,'running','следующая задача запущена таймером'); });

/* ── сеанс с исполнителем ── */
test('Сеанс: Секретарь «session» → Issue «сеанс» с первой репликой; реплика → комментарий; ответ → лента с ценой; потолок → пауза', async()=>{ const {c,n}=await setup();
  n.replies.push({intent:'session',text:'Почему не печатается лист ДЗ 3? Давай разберёмся',reply:'Открываю сеанс.'});
  let r=await c.call('POST','/api/hq/talk',{text:'давай поработаем вместе: почему не печатается лист ДЗ 3? давай разберёмся'},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  const s=(await nodesOf(c)).find(x=>x.type==='session'); assert.ok(s,'сеанс создан'); assert.equal(s.status,'running'); assert.equal(s.model,'opus','по умолчанию — Главный инженер'); assert.equal(s.ceil,300);
  const iss=n.issues[s.issue]; assert.match(iss.body,/hq-session:\{"ceil":300\}/); assert.deepEqual(iss.labels.map(l=>l.name).sort(),['исп:opus','сеанс'].sort());
  const posts=()=>n.calls.filter(x=>x.method==='POST'&&new RegExp('/issues/'+s.issue+'/comments$').test(x.url)).map(x=>x.body.body);
  assert.equal(posts()[0],'💬 Владелец: Почему не печатается лист ДЗ 3? Давай разберёмся');
  /* метка «сеанс» ставится после первой реплики */
  const iLabel=n.calls.findIndex(x=>new RegExp('/issues/'+s.issue+'/labels$').test(x.url)), iFirst=n.calls.findIndex(x=>x.method==='POST'&&new RegExp('/issues/'+s.issue+'/comments$').test(x.url)); assert.ok(iFirst<iLabel);
  let f=await feedOf(c); assert.equal(f[f.length-1].acts[0].op,'opensession');
  /* реплика из вкладки «Сеанс» → комментарий в Issue; «Влей» и «Стоп» — тоже */
  r=await c.call('POST','/api/hq/session',{id:s.id,text:'и покажи строку'},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  await c.call('POST','/api/hq/session',{id:s.id,op:'merge'},{as:'owner'});
  assert.deepEqual(posts().slice(1),['💬 Владелец: и покажи строку','💬 Владелец: влей']);
  /* ответ исполнителя → в чате сеанса и в ленте с ценой хода и сеанса; цена считается один раз */
  n.commentsBy={[s.issue]:[{id:1,body:'💬 Владелец: Почему не печатается лист ДЗ 3?'},{id:2,body:'Лист ломает @page в index.html:1234.\n\n_Ход ~4.2 ₽ · сеанс ~4.2 ₽_\n<!-- hq-say --> <!-- hq:{"rub":4.2,"total":4.2,"pr":"https://github.com/x/pull/77"} -->'}]};
  const before=(await c.call('GET','/api/hq',undefined,{as:'owner'})).data.spent;
  r=await c.call('GET','/api/hq/session?id='+s.id,undefined,{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  assert.deepEqual(r.data.msgs.map(m=>m.who),['me','hq']); assert.equal(r.data.msgs[1].text,'Лист ломает @page в index.html:1234.'); assert.equal(r.data.node.rub,4.2); assert.equal(r.data.node.pr,'https://github.com/x/pull/77');
  await c.call('GET','/api/hq/session?id='+s.id,undefined,{as:'owner'}); assert.equal(Math.round(((await c.call('GET','/api/hq',undefined,{as:'owner'})).data.spent-before)*100)/100,4.2);
  f=await feedOf(c); assert.match(f[f.length-1].text,/Сеанс «.*»: Лист ломает @page[\s\S]*Ход ~4\.2 ₽, сеанс ~4\.2 ₽/); assert.equal(f.filter(x=>/Лист ломает/.test(x.text)).length,1);
  /* потолок: сеанс дороже 300 ₽ → пауза и вопрос; «продолжай» → снова идёт, потолок +50 % */
  n.commentsBy[s.issue].push({id:3,body:'Сделал правку.\n<!-- hq-say --> <!-- hq:{"rub":300,"total":304.2} -->'});
  r=await c.call('GET','/api/hq/session?id='+s.id,undefined,{as:'owner'}); assert.equal(r.data.node.status,'paused');
  f=await feedOf(c); assert.match(f[f.length-1].text,/потолок 300 ₽ исчерпан/);
  r=await c.call('POST','/api/hq/session',{id:s.id,text:'продолжай'},{as:'owner'}); assert.equal(r.data.node.status,'running'); assert.equal(r.data.node.ceil,450);
  /* итог сеанса → закрыт */
  n.commentsBy[s.issue].push({id:4,body:'Сеанс закрыт: 20 минут тишины. <!-- hq-say --> <!-- hq-session-end --> <!-- hq:{"rub":0,"total":304.2} -->'});
  await sync(c); assert.equal((await nodesOf(c)).find(x=>x.id===s.id).status,'done');
  assert.equal((await c.call('POST','/api/hq/session',{id:s.id,text:'ещё'},{as:'owner'})).status,409);
  /* только владелец */
  await c.member(4004); assert.equal((await c.call('GET','/api/hq/session?id='+s.id,undefined,{as:'m4004'})).status,403); });

test('Сеанс: кнопка «Сеанс» с выбором исполнителя и потолок из «Сотрудников»', async()=>{ const {c,n}=await setup();
  await c.call('POST','/api/hq/settings',{settings:{sessionRub:120}},{as:'owner'});
  const r=await c.call('POST','/api/hq/session',{text:'Посмотрим пульт',model:'sonnet'},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal(r.data.node.model,'sonnet'); assert.equal(r.data.node.ceil,120); assert.match(n.issues[r.data.node.issue].body,/"ceil":120/);
  const l=(await c.call('GET','/api/hq/session',undefined,{as:'owner'})).data.sessions; assert.equal(l.length,1); });

/* ── предпросмотр: задача ждёт «влить», ссылка и скриншоты в ленте ── */
test('Предпросмотр: на проверке — ссылка и «было → стало» в ленте; «Влить» и «Отклонить» → метки Цеху', async()=>{ const {c,n}=await setup();
  await c.call('POST','/api/hq/settings',{settings:{autoMerge:false}},{as:'owner'});
  const t=(await c.call('POST','/api/hq/node',{op:'add',type:'task',title:'Кнопка в пульте'},{as:'owner'})).data.node;
  await c.call('POST','/api/hq/node',{id:t.id,kind:'code',level:'simple'},{as:'owner'});
  let r=await c.call('POST','/api/hq/run',{id:t.id},{as:'owner'}); const num=r.data.node.issue, iss=n.issues[num];
  assert.ok(!iss.labels.some(l=>l.name==='автовыкатка'),'без автовыкатки');
  const raw='https://raw.githubusercontent.com/nachert1830/nachert/abc123/_preview/';
  n.commentsBy={[num]:[{id:9,body:'🔍 Готово, ждёт твоего решения.\n<!-- hq:'+JSON.stringify({rub:1.1,model:'deepseek',pr:'https://github.com/x/pull/5',preview:'https://raw.githack.com/nachert1830/nachert/preview/me/index.html',
    shots:[raw+'before-phone.png',raw+'after-phone.png','https://evil.example/x.png']})+' -->'}]};
  iss.labels.push({name:'на-проверку'});
  await sync(c);
  let f=await feedOf(c), card=f[f.length-1];
  assert.match(card.text,/Посмотри, как будет: «Кнопка в пульте»/); assert.deepEqual(card.acts.map(a=>a.op),['merge','reject','open']);
  assert.deepEqual(card.shots,[raw+'before-phone.png',raw+'after-phone.png'],'чужие адреса картинок отброшены');
  assert.equal(card.links[0].u,'https://raw.githack.com/nachert1830/nachert/preview/me/index.html');
  /* «Влить» → метка «влить» (вливает Цех, проверив PR) */
  r=await c.call('POST','/api/hq/act',{op:'merge',a:{id:t.id}},{as:'owner'}); assert.equal(r.status,200,JSON.stringify(r.data));
  assert.ok(iss.labels.some(l=>l.name==='влить'));
  /* Цех влил → готово */
  n.commentsBy[num].push({id:10,body:'✅ Выкачено на сайт по твоему «влить». <!-- hq:{"rub":0,"pr":"https://github.com/x/pull/5"} -->'}); iss.labels.push({name:'готово'});
  await sync(c); assert.equal((await nodesOf(c)).find(x=>x.id===t.id).status,'done');
  assert.equal((await c.call('POST','/api/hq/act',{op:'merge',a:{id:t.id}},{as:'owner'})).status,409,'второй раз — нечего');
  /* другая задача: «Отклонить» → метка, задача снова к обсуждению */
  const t2=(await c.call('POST','/api/hq/node',{op:'add',type:'task',title:'Другая'},{as:'owner'})).data.node;
  await c.call('POST','/api/hq/node',{id:t2.id,kind:'code',level:'simple'},{as:'owner'}); r=await c.call('POST','/api/hq/run',{id:t2.id},{as:'owner'});
  const n2=r.data.node.issue; n.commentsBy[n2]=[{id:20,body:'<!-- hq:{"rub":1,"pr":"https://github.com/x/pull/6"} -->'}]; n.issues[n2].labels.push({name:'на-проверку'}); await sync(c);
  await c.call('POST','/api/hq/act',{op:'reject',a:{id:t2.id}},{as:'owner'});
  assert.ok(n.issues[n2].labels.some(l=>l.name==='отклонить')); assert.equal((await nodesOf(c)).find(x=>x.id===t2.id).status,'ready'); });
