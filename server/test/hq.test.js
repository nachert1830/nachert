/* Штаб владельца: монолог → карта → ТЗ → диспетчер → исполнение; бюджет; только для админа */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {club}=require('./helpers');
const RO=require('../lib/hq/roster');

function net(){ const n={calls:[],replies:[],issues:{},labels:[]};
  n.fn=async(url,o)=>{ const b=o&&o.body?JSON.parse(o.body):null; n.calls.push({url,body:b,method:o&&o.method});
    if(url==='https://api.proxyapi.ru/v1/chat/completions'){ const r=n.replies.shift(); if(!r) return {status:500,json:{error:{message:'нет ответа'}}};
      return {status:200,json:{choices:[{message:{content:typeof r==='string'?r:JSON.stringify(r)},finish_reason:'stop'}],usage:{prompt_tokens:10000,completion_tokens:2000}}}; }
    const m=/^https:\/\/api\.github\.com\/repos\/nachert1830\/nachert(\/.*)$/.exec(url); if(!m) return null;
    if(m[1]==='/issues'&&o.method==='POST'){ const num=200+Object.keys(n.issues).length; n.issues[num]={number:num,body:b.body,labels:b.labels.map(x=>({name:x})),state:'open'};
      return {status:201,json:{number:num,html_url:'https://github.com/nachert1830/nachert/issues/'+num}}; }
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
