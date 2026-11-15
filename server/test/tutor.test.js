/* ИИ-наставник на сервере (server/lib/tutor.js, docs/TUTOR.md): модель говорит, ядро решает.
   Модель подменена: тест задаёт её ответы и проверяет, что неверное по чертежу до студента не доходит. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const CORE=require('../../kernel/tutor-core.js'), TUTOR=require('../lib/tutor');
const {club}=require('./helpers');

/* маленький эпюр: A и B, горизонталь h″, на шаге 1 строим точку 1 на h */
const part={given:[{t:'axis'},{t:'pt',at:[-50,-30],l:'A″'},{t:'pt',at:[-50,40],l:'A′'},{t:'pt',at:[-20,-60],l:'B″'},{t:'pt',at:[-20,10],l:'B′'},{t:'seg',a:[-80,-30],b:[0,-30],l:'h″',k:'main'}],
  steps:[{t:'Точка 1 на горизонтали',d:'Точка 1 лежит на h; 1″ на h″, 1′ — по линии связи.',why:'Принадлежность прямой: проекции точки на проекциях прямой.',add:[{t:'pt',at:[-35,-30],l:'1″',k:'res'},{t:'conn',a:[-35,-30],b:[-35,25]},{t:'pt',at:[-35,25],l:'1′',k:'res'}]}]};
const M=CORE.build(part,1,{n:1,title:'Тест',q:'Построить точку 1 на h'});
const cfg=TUTOR.tutorFromEnv({PROXYAPI_KEY:'test-key'});
const use=(name,input,id)=>({type:'tool_use',id:id||'tu_'+name+Math.random().toString(36).slice(2,6),name,input});
const msg=(content,usage)=>({ok:true,status:200,text:async()=>JSON.stringify({content,stop_reason:'tool_use',usage:usage||{input_tokens:1000,output_tokens:100}})});

test('ядро: отношения чертежа, подписи, действия',()=>{
  assert.equal(CORE.verify(M,{rel:'same_link',a:'1″',b:'1′'}).ok,true);
  assert.equal(CORE.verify(M,{rel:'same_link',a:'A″',b:'B′'}).ok,false);
  assert.equal(CORE.verify(M,{rel:'on',a:'1″',b:'h″'}).ok,true);
  assert.equal(CORE.verify(M,{rel:'higher',a:'B',b:'A'}).ok,true,'B″ выше A″ — B выше');
  assert.equal(CORE.verify(M,{rel:'closer',a:'A',b:'B'}).ok,true,'A′ дальше от оси — A ближе к зрителю');
  assert.equal(CORE.verify(M,{rel:'parallel_x',a:'h″'}).ok,true);
  assert.equal(CORE.verify(M,{rel:'on',a:'Z″',b:'h″'}).ok,null,'нет такой точки — не проверить');
  assert.deepEqual(CORE.guardText(M,'Смотри на 1″ и Z₇′'),['Z₇′']);
  assert.ok(CORE.reply(M,{say:'1″ на h″.',claims:[{rel:'on',a:'1″',b:'h″'}],show:[{do:'highlight',ids:['h″','1″']},{do:'link',p:'1″'}]}).ok);
  const bad=CORE.reply(M,{say:'A выше B.',claims:[{rel:'higher',a:'A',b:'B'}]}); assert.equal(bad.ok,false); assert.match(bad.errors[0],/НЕВЕРНО/);
  assert.equal(CORE.reply(M,{say:'ок',show:[{do:'highlight',ids:['Q″']}]}).ok,false,'подсветка несуществующего — отказ');
  assert.deepEqual(CORE.anchors(M,1),[],'1 строится на h″, подписанных точек на ней нет');
  const L0=CORE.ladder(M,0); assert.ok(L0.say.length>10); assert.equal(CORE.checkShow(M,L0.show).bad.length,0);
  const Mt=CORE.build(part,1,{mode:'try',hidden:true}); assert.equal(CORE.pickTarget(Mt),null,'у 1 нет второй проекции до шага — угадывать нечего');
  assert.equal(CORE.tapCheck(Mt,'1′',[-35,25]).ok,true);
  assert.equal(CORE.tapCheck(Mt,'1′',[-10,25]).kind,'where','1″ строится на этом же шаге — линию связи не с чем сверить: «не здесь» и подсказка, на чём лежит точка');
  const r=CORE.reply(Mt,{say:'Вот построение.',show:[{do:'reveal',ids:['1′']}]}); assert.equal(r.ok,false,'«Решаю сам»: шаг не раскрывать'); });

test('модель ошиблась в геометрии — ядро вернуло ответ, она исправила; студент видит только проверенное',async()=>{
  const bodies=[]; let n=0;
  const fetch=async(url,o)=>{ assert.equal(url,TUTOR.PX); bodies.push(JSON.parse(o.body)); n++;
    if(n===1) return msg([{type:'thinking',thinking:'',signature:'s'},use('reply',{say:'A выше B, поэтому…',claims:[{rel:'higher',a:'A',b:'B'}]})]);
    if(n===2) return msg([use('verify',{claims:[{rel:'higher',a:'B',b:'A'},{rel:'on',a:'1″',b:'h″'}]})]);
    return msg([use('reply',{say:'B выше A. А 1″ — на h″: где тогда 1′?',ask:'Как найти 1′?',options:['По линии связи','Не знаю'],claims:[{rel:'higher',a:'B',b:'A'},{rel:'on',a:'1″',b:'h″'}],show:[{do:'highlight',ids:['h″','1″']},{do:'link',p:'1″'}],misconception:'reading',level:1})]); };
  const r=await TUTOR.ask(cfg,{ctx:M,q:'Почему A выше B?',history:[],level:0},{fetch});
  assert.equal(r.calls,3); assert.equal(r.fixed,1); assert.equal(r.model,'claude-opus-5-5');
  assert.match(r.say,/B выше A/); assert.equal(r.claims.length,2); assert.ok(r.claims.every(c=>c.ok===true));
  assert.deepEqual(r.show.map(a=>a.do),['highlight','link']); assert.equal(r.misconception,'reading'); assert.ok(r.usd>0);
  /* первый запрос: кэш промпта, инструменты, рассуждение коротко; данные чертежа — без координат */
  const b=bodies[0]; assert.equal(b.system[0].cache_control.type,'ephemeral'); assert.equal(b.tools[b.tools.length-1].cache_control.type,'ephemeral');
  assert.deepEqual(b.tools.map(t=>t.name),['verify','reply']); assert.equal(b.tool_choice.type,'auto'); assert.equal(b.output_config.effort,'low');
  assert.match(b.messages[0].content[0].text,/Чертёж/); assert.ok(!/"xy"/.test(b.messages[0].content[0].text),'координаты модели не отдаются');
  /* ошибка ядра ушла модели как результат инструмента, рассуждение передано обратно без изменений */
  const back=bodies[1].messages; assert.equal(back[1].role,'assistant'); assert.equal(back[1].content[0].type,'thinking');
  assert.equal(back[2].content[0].is_error,true); assert.match(back[2].content[0].content,/НЕВЕРНО/);
  assert.equal(JSON.parse(bodies[2].messages[4].content[0].content)[0].ok,true,'verify вернул ответ ядра'); });

test('выдуманная точка и запрет раскрывать шаг в «Решаю сам»; модель не справилась — подсказка ядра',async()=>{
  const fetch=async()=>msg([use('reply',{say:'Смотри на точку K₅″.'})]);
  const r=await TUTOR.ask(cfg,{ctx:M,q:'что делать',history:[],level:0},{fetch});
  assert.equal(r.model,'ядро'); assert.equal(r.calls,4); assert.equal(r.fixed,4); assert.ok(!/K₅″/.test(r.say)); assert.equal(r.author,true); });

test('короткий ответ на вопрос наставника — быстрой моделью; сбой шлюза — повтор',async()=>{
  let n=0, models=[]; const fetch=async(u,o)=>{ n++; models.push(JSON.parse(o.body).model); if(n===1) return {ok:false,status:529,text:async()=>'{"error":{"message":"overloaded"}}'}; return msg([use('reply',{say:'Да, по линии связи.',claims:[{rel:'same_link',a:'1″',b:'1′'}]})]); };
  const r=await TUTOR.ask(cfg,{ctx:M,q:'по линии связи',history:[{role:'assistant',text:'Как найти 1′?'}],level:1},{fetch,retryMs:0});
  assert.equal(r.model,'claude-haiku-5-5'); assert.equal(n,2); assert.deepEqual(models,['claude-haiku-5-5','claude-haiku-5-5']); });

test('снимок шага с мусором — 400',async()=>{
  await assert.rejects(TUTOR.ask(cfg,{ctx:{v:1,pts:{A:{xy:['x',1]}}},q:'?'},{fetch:async()=>{ throw new Error('не звать'); }}),e=>e.status===400); });

test('/api/tutor: вход, согласие, лимит в день, бюджет в день',async()=>{
  const c=club({cfg:{openSignup:true},tutor:cfg}); let calls=0;
  c.ya.tutor=()=>{ calls++; return {status:200,json:{content:[use('reply',{say:'1″ на h″.',claims:[{rel:'on',a:'1″',b:'h″'}]})],stop_reason:'tool_use',usage:{input_tokens:3000,output_tokens:200}}}; };
  const body={ctx:M,q:'Где 1′?',history:[],level:0,consent:true};
  assert.equal((await c.call('POST','/api/tutor',body,{as:'nobody'})).status,401,'без входа — только подсказки ядра в браузере');
  await c.yandex({id:'8001',first_name:'Аня'},{who:'a'});
  assert.equal((await c.call('POST','/api/tutor',Object.assign({},body,{consent:false}),{as:'a'})).status,403,'без согласия — к зарубежной модели не идём');
  assert.equal(calls,0);
  const r=await c.call('POST','/api/tutor',body,{as:'a'}); assert.equal(r.status,200); assert.equal(r.data.say,'1″ на h″.'); assert.equal(r.data.claims[0].ok,true); assert.equal(calls,1);
  assert.equal((await c.call('POST','/api/tutor',Object.assign({},body,{ctx:{v:1}}),{as:'a'})).status,400);
  /* бюджет: дорогой ответ съедает дневной бюджет — дальше 429 */
  c.ya.tutor=()=>({status:200,json:{content:[use('reply',{say:'1″ на h″.'})],stop_reason:'tool_use',usage:{input_tokens:5e6,output_tokens:0}}});
  assert.equal((await c.call('POST','/api/tutor',body,{as:'a'})).status,200);
  const over=await c.call('POST','/api/tutor',body,{as:'a'}); assert.equal(over.status,429); assert.match(over.data.error,/подсказки ядра/);
  c.clock.t+=864e5; c.ya.tutor=()=>({status:200,json:{content:[use('reply',{say:'ок'})],stop_reason:'tool_use',usage:{input_tokens:10,output_tokens:1}}});
  assert.equal((await c.call('POST','/api/tutor',body,{as:'a'})).status,200,'назавтра — снова');
  const c2=club({cfg:{openSignup:true}}); await c2.yandex({id:'8002',first_name:'Боря'},{who:'b'});
  assert.equal((await c2.call('POST','/api/tutor',body,{as:'b'})).status,503,'не подключён — 503'); });

test('лимит вопросов в день на студента',async()=>{
  const c=club({cfg:{openSignup:true},tutor:Object.assign({},cfg,{daily:2})});
  c.ya.tutor=()=>({status:200,json:{content:[use('reply',{say:'ок'})],stop_reason:'tool_use',usage:{input_tokens:10,output_tokens:1}}});
  await c.yandex({id:'8003',first_name:'Вера'},{who:'v'}); const body={ctx:M,q:'?',consent:true};
  assert.equal((await c.call('POST','/api/tutor',body,{as:'v'})).status,200); assert.equal((await c.call('POST','/api/tutor',body,{as:'v'})).status,200);
  assert.equal((await c.call('POST','/api/tutor',body,{as:'v'})).status,429); });
