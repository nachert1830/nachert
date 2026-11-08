/* Облачная функция сканера: код доступа, CORS, ограничения, ответ модели. Сеть не нужна (запрос к ProxyAPI подменён). */
'use strict';
const test=require('node:test'), assert=require('node:assert');
const HASH='8597945dc29b346cc24b673434bd664f04a4e2741bd9b374d2e787193aea818f';   /* sha256 нормализованного кода доступа */
process.env.SCAN_CODE_SHA256=HASH; process.env.PROXYAPI_KEY='секрет-ключ-proxyapi';
const F=require('../scan/index.js');
const IMG='data:image/jpeg;base64,'+Buffer.from('фото').toString('base64');
const OK='https://nachert1830.ru';
const ev=(method,o)=>Object.assign({httpMethod:method,headers:{origin:OK}},o||{});
const body=o=>JSON.stringify(Object.assign({img:IMG,w:800,h:600,mode:'layout'},o||{}));
const fake=(log,text)=>async(url,init)=>{ const b=JSON.parse(init.body); log.push({url,b,auth:init.headers.authorization}); return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:text||'{"rot":0,"drawings":[]}'},finish_reason:'stop'}],usage:{prompt_tokens:1000,completion_tokens:500}})}; };
/* сценарии ниже писались под связку «Opus оцифровывает, Sonnet — вторая/запасная»: задаём её явно (по умолчанию теперь наоборот — тест «модели по умолчанию») */
test.beforeEach(()=>{ F._reset(); process.env.SCAN_DIGIT_MODEL='opus'; process.env.SCAN_CHECK_MODEL='sonnet'; });
test('модели по умолчанию: оцифровка — Sonnet, вторая оцифровка (crop2, режим «максимальная») — Opus',async()=>{ const log=[]; F._setFetch(fake(log)); const h={origin:OK,'x-scan-code':'виктория'};
  delete process.env.SCAN_DIGIT_MODEL; delete process.env.SCAN_CHECK_MODEL;
  await F.handler(ev('POST',{headers:h,body:body({mode:'crop'})})); await F.handler(ev('POST',{headers:h,body:body({mode:'crop2'})}));
  assert.deepEqual(log.map(x=>x.b.model),['anthropic/claude-sonnet-5-5','anthropic/claude-opus-5-5']); });

test('код доступа: «виктория» в любом регистре и с ё/е подходит, другой — 401',()=>{ assert.equal(F.sha('Виктория'),HASH); assert.equal(F.sha(' ВИКТОРИЯ '),HASH); assert.notEqual(F.sha('виктория1'),HASH); });
test('код с кириллицей приходит из браузера закодированным (в заголовке кириллицы быть не может)',async()=>{ F._setFetch(fake([]));
  const r=await F.handler(ev('GET',{headers:{origin:OK,'x-scan-code':encodeURIComponent('Виктория')}})); assert.equal(r.statusCode,200); assert.equal(JSON.parse(r.body).codeOk,true);
  const bad=await F.handler(ev('GET',{headers:{origin:OK,'x-scan-code':'%E0%A4%A'}})); assert.equal(bad.statusCode,401); });
test('OPTIONS: сайту — 204 и заголовки CORS; чужому адресу — 403',async()=>{
  const a=await F.handler(ev('OPTIONS')); assert.equal(a.statusCode,204); assert.equal(a.headers['access-control-allow-origin'],OK); assert.match(a.headers['access-control-allow-headers'],/x-scan-code/);
  const b=await F.handler({httpMethod:'OPTIONS',headers:{origin:'https://evil.example'}}); assert.equal(b.statusCode,403); assert.equal(b.headers['access-control-allow-origin'],undefined); });
test('GET без кода — жива ли функция; с неверным кодом — 401; с верным — статус',async()=>{
  const a=await F.handler(ev('GET')); assert.equal(a.statusCode,200); assert.equal(JSON.parse(a.body).codeNeeded,true); assert.equal(JSON.parse(a.body).codeOk,undefined);
  const b=await F.handler(ev('GET',{headers:{origin:OK,'x-scan-code':'не тот'}})); assert.equal(b.statusCode,401);
  const c=await F.handler(ev('GET',{headers:{origin:OK,'X-Scan-Code':'Виктория'}})); assert.equal(c.statusCode,200); assert.equal(JSON.parse(c.body).codeOk,true); });
test('POST без кода и с неверным кодом — 401, к модели не обращаемся',async()=>{ const log=[]; F._setFetch(fake(log));
  const a=await F.handler(ev('POST',{body:body()})); assert.equal(a.statusCode,401);
  const b=await F.handler(ev('POST',{headers:{origin:OK,'x-scan-code':'nope'},body:body()})); assert.equal(b.statusCode,401); assert.equal(log.length,0); });
test('перебор кода: после 10 неверных с одного адреса — 429, даже с верным',async()=>{ F._setFetch(fake([]));
  const h={origin:OK,'x-scan-code':'nope','x-forwarded-for':'1.2.3.4'}; for(let i=0;i<10;i++) await F.handler(ev('POST',{headers:h,body:body()}));
  const r=await F.handler(ev('POST',{headers:Object.assign({},h,{'x-scan-code':'виктория'}),body:body()})); assert.equal(r.statusCode,429);
  const other=await F.handler(ev('POST',{headers:{origin:OK,'x-scan-code':'виктория','x-forwarded-for':'5.6.7.8'},body:body()})); assert.equal(other.statusCode,200); });
test('верный код: раскладка и оцифровка идут в ProxyAPI с ключом из окружения; ключа в ответе нет',async()=>{ const log=[]; F._setFetch(fake(log,'P A″ 10 20'));
  const h={origin:OK,'x-scan-code':'виктория'}; const a=await F.handler(ev('POST',{headers:h,body:body()})); assert.equal(a.statusCode,200); assert.equal(a.headers['access-control-allow-origin'],OK);
  assert.equal(log[0].b.model,'anthropic/claude-haiku-5-5'); assert.match(log[0].url,/proxyapi\.ru/); assert.equal(log[0].auth,'Bearer секрет-ключ-proxyapi');
  const j=JSON.parse(a.body); assert.equal(j.ok,true); assert.ok(j.cost>0); assert.ok(!a.body.includes('секрет-ключ'));
  const c=await F.handler(ev('POST',{headers:h,body:body({mode:'crop'})})); assert.equal(c.statusCode,200); assert.equal(log[1].b.model,'anthropic/claude-opus-5-5');
  assert.equal(log[1].b.max_completion_tokens,9000,'Opus рассуждает в том же лимите — лимит ответа больше'); });
test('проверка тела: не JSON, чужой режим, не фото, размер — 400',async()=>{ F._setFetch(fake([])); const h={origin:OK,'x-scan-code':'виктория'};
  for(const b of ['не json',body({mode:'x'}),body({img:'http://x/y.jpg'}),body({w:50,h:50}),body({w:9000})]) assert.equal((await F.handler(ev('POST',{headers:h,body:b}))).statusCode,400); });
test('base64-тело (isBase64Encoded) читается',async()=>{ F._setFetch(fake([])); const r=await F.handler(ev('POST',{headers:{origin:OK,'x-scan-code':'виктория'},body:Buffer.from(body()).toString('base64'),isBase64Encoded:true})); assert.equal(r.statusCode,200); });
test('лимит запросов в час и расходов: 429',async()=>{ process.env.SCAN_HOURLY='2'; F._setFetch(fake([])); const h={origin:OK,'x-scan-code':'виктория'};
  assert.equal((await F.handler(ev('POST',{headers:h,body:body()}))).statusCode,200); assert.equal((await F.handler(ev('POST',{headers:h,body:body()}))).statusCode,200); assert.equal((await F.handler(ev('POST',{headers:h,body:body()}))).statusCode,429); delete process.env.SCAN_HOURLY;
  F._reset(); process.env.SCAN_LIMIT_USD='0.0001'; assert.equal((await F.handler(ev('POST',{headers:h,body:body()}))).statusCode,200); assert.equal((await F.handler(ev('POST',{headers:h,body:body()}))).statusCode,429); delete process.env.SCAN_LIMIT_USD; });
test('нет ключа ProxyAPI — 503',async()=>{ const k=process.env.PROXYAPI_KEY; delete process.env.PROXYAPI_KEY; const r=await F.handler(ev('POST',{headers:{origin:OK,'x-scan-code':'виктория'},body:body()})); process.env.PROXYAPI_KEY=k; assert.equal(r.statusCode,503); });

test('crop2 — вторая оцифровка Sonnet; model: opus | sonnet — явная модель (для замера); чужая модель — 400',async()=>{ const log=[]; F._setFetch(fake(log,'P A″ 10 20')); const h={origin:OK,'x-scan-code':'виктория'};
  assert.equal((await F.handler(ev('POST',{headers:h,body:body({mode:'crop2'})}))).statusCode,200); assert.equal(log[0].b.model,'anthropic/claude-sonnet-5-5'); assert.equal(log[0].b.max_completion_tokens,3000);
  assert.equal((await F.handler(ev('POST',{headers:h,body:body({mode:'crop',model:'sonnet'})}))).statusCode,200); assert.equal(log[1].b.model,'anthropic/claude-sonnet-5-5');
  assert.equal((await F.handler(ev('POST',{headers:h,body:body({mode:'crop',model:'fable'})}))).statusCode,400); assert.equal(log.length,2); });
test('Opus не ответил — тот же кадр Sonnet (fallback в ответе); баланса не хватает на Opus (402) — Sonnet; не хватает и на него — ошибка',async()=>{ const h={origin:OK,'x-scan-code':'виктория'};
  let log=[]; F._setFetch(async(url,init)=>{ const b=JSON.parse(init.body); log.push(b.model); if(/opus/.test(b.model)) return {ok:false,status:500,text:async()=>'{"error":{"message":"overloaded"}}'};
    return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'P A″ 1 2'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:10}})}; });
  const r=await F.handler(ev('POST',{headers:h,body:body({mode:'crop'})})), j=JSON.parse(r.body); assert.equal(r.statusCode,200); assert.deepEqual(log,['anthropic/claude-opus-5-5','anthropic/claude-sonnet-5-5']); assert.match(j.fallback,/opus/); assert.equal(j.model,'anthropic/claude-sonnet-5-5');
  log=[]; F._setFetch(async(url,init)=>{ log.push(JSON.parse(init.body).model); return {ok:false,status:402,text:async()=>'{"error":{"message":"Недостаточно средств"}}'}; });
  const p=await F.handler(ev('POST',{headers:h,body:body({mode:'crop'})})); assert.equal(p.statusCode,502); assert.deepEqual(log,['anthropic/claude-opus-5-5','anthropic/claude-sonnet-5-5']); assert.match(JSON.parse(p.body).error,/402/);
  log=[]; F._setFetch(async(url,init)=>{ const b=JSON.parse(init.body); log.push(b.model); if(/opus/.test(b.model)) return {ok:false,status:402,text:async()=>'{"error":{"message":"Insufficient balance to run this request"}}'};
    return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'P A″ 1 2'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:10}})}; });
  const q=await F.handler(ev('POST',{headers:h,body:body({mode:'crop'})})), k=JSON.parse(q.body); assert.equal(q.statusCode,200); assert.equal(k.model,'anthropic/claude-sonnet-5-5'); assert.match(k.fallback,/402/);
  log=[]; F._setFetch(async(url,init)=>{ log.push(JSON.parse(init.body).model); return {ok:false,status:401,text:async()=>'{"error":{"message":"bad key"}}'}; });
  await F.handler(ev('POST',{headers:h,body:body({mode:'crop'})})); assert.equal(log.length,1); });
test('модели — из переменных функции',async()=>{ const log=[]; F._setFetch(fake(log)); const h={origin:OK,'x-scan-code':'виктория'};
  process.env.SCAN_DIGIT_MODEL='sonnet'; process.env.SCAN_LAYOUT_MODEL='anthropic/claude-sonnet-5-5';
  await F.handler(ev('POST',{headers:h,body:body({mode:'crop'})})); await F.handler(ev('POST',{headers:h,body:body()})); delete process.env.SCAN_DIGIT_MODEL; delete process.env.SCAN_LAYOUT_MODEL;
  assert.deepEqual(log.map(x=>x.b.model),['anthropic/claude-sonnet-5-5','anthropic/claude-sonnet-5-5']); });
test('код владельца: открывает страницу me/ (GET ?owner=1) и сканирует; студенческий код на me/ — 403; без OWNER_CODE_SHA256 владельца нет',async()=>{ F._setFetch(fake([]));
  const q={owner:'1'}, get=(code,qs)=>F.handler(ev('GET',{headers:{origin:OK,'x-scan-code':encodeURIComponent(code)},queryStringParameters:qs}));
  delete process.env.OWNER_CODE_SHA256;
  assert.equal((await get('виктория',q)).statusCode,403,'владелец не задан — никто не владелец');
  process.env.OWNER_CODE_SHA256=F.sha('мой-личный-код');
  try{
    const a=await get('Мой-Личный-Код',q); assert.equal(a.statusCode,200); assert.equal(JSON.parse(a.body).owner,true);
    const s=await get('виктория',q); assert.equal(s.statusCode,403); assert.equal(JSON.parse(s.body).owner,false);
    const s2=await get('виктория'); assert.equal(s2.statusCode,200); assert.equal(JSON.parse(s2.body).owner,false,'студенту сканер открыт, но он не владелец');
    assert.equal((await get('чужой',q)).statusCode,401);
    const p=await F.handler(ev('POST',{headers:{origin:OK,'x-scan-code':encodeURIComponent('мой-личный-код')},body:body()})); assert.equal(p.statusCode,200,'код владельца сканирует');
    process.env.OWNER_CODE_SHA256=F.sha('виктория');
    assert.equal((await get('виктория',q)).statusCode,403,'код владельца = студенческому — владельца нет');
  } finally { delete process.env.OWNER_CODE_SHA256; } });
test('ретранслятор знакомства телефона и ноутбука (?sig=): без кода, только ответ «1~…», канал — 128 бит',async()=>{
  const ch='0123456789abcdef0123456789abcdef', A='1~uf~pwd+pwd/pwd+pwd/pwdpwd~AbC-_x~a~h,192.168.43.2,51234';
  const g=await F.handler(ev('GET',{queryStringParameters:{sig:ch}})); assert.equal(g.statusCode,200); assert.equal(JSON.parse(g.body).a,null);
  const p=await F.handler(ev('POST',{queryStringParameters:{sig:ch},body:JSON.stringify({a:A})})); assert.equal(p.statusCode,200);
  const g2=await F.handler(ev('GET',{queryStringParameters:{sig:ch}})); assert.equal(JSON.parse(g2.body).a,A); assert.equal(g2.headers['access-control-allow-origin'],OK);
  assert.equal((await F.handler(ev('POST',{queryStringParameters:{sig:ch},body:JSON.stringify({a:'<script>'})}))).statusCode,400);
  assert.equal((await F.handler(ev('GET',{queryStringParameters:{sig:'короткий'}}))).statusCode,400);
  assert.equal((await F.handler({httpMethod:'GET',headers:{origin:'https://evil.example'},queryStringParameters:{sig:ch}})).statusCode,403); });

/* запасной поставщик: ProxyAPI отказал по деньгам или лимиту — тот же запрос в OpenRouter (сеть подменена, настоящих запросов нет) */
const okJson=(text,usage)=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:text},finish_reason:'stop'}],usage:usage||{prompt_tokens:10,completion_tokens:10}})});
const pxFails=(log,status,msg)=>async(url,init)=>{ const b=JSON.parse(init.body); log.push({url,model:b.model,auth:init.headers.authorization,b});
  if(/proxyapi\.ru/.test(url)) return {ok:false,status,text:async()=>JSON.stringify({error:{message:msg}})};
  return okJson('P A″ 1 2',{prompt_tokens:10,completion_tokens:10,cost:0.0123}); };
const withOr=async fn=>{ process.env.OPENROUTER_API_KEY='секрет-ключ-openrouter'; try{ await fn(); } finally { delete process.env.OPENROUTER_API_KEY; } };
const H={origin:OK,'x-scan-code':'виктория'};
test('ProxyAPI 402 (баланс/бюджет) — тот же запрос той же модели в OpenRouter: 200, provider openrouter, причина в fallback, цена — из usage.cost',()=>withOr(async()=>{
  const log=[]; F._setFetch(pxFails(log,402,'API Key budget exceeded'));
  const r=await F.handler(ev('POST',{headers:H,body:body({mode:'crop'})})), j=JSON.parse(r.body); assert.equal(r.statusCode,200);
  assert.deepEqual(log.map(x=>[/openrouter\.ai/.test(x.url)?'or':'px',x.model]),[['px','anthropic/claude-opus-5-5'],['or','anthropic/claude-opus-5.5']]);
  assert.equal(log[1].auth,'Bearer секрет-ключ-openrouter'); assert.equal(log[1].b.max_tokens,9000,'лимит ответа Opus — тот же');
  assert.equal(j.provider,'openrouter'); assert.equal(j.model,'anthropic/claude-opus-5.5'); assert.match(j.fallback,/402.*budget.*OpenRouter/); assert.equal(j.cost,0.0123);
  assert.ok(!r.body.includes('секрет-ключ'));
  const l=[]; F._setFetch(pxFails(l,402,'Insufficient balance')); const a=await F.handler(ev('POST',{headers:H,body:body()})); assert.equal(a.statusCode,200);
  assert.equal(JSON.parse(a.body).provider,'openrouter'); assert.equal(l[1].model,'anthropic/claude-haiku-5.5','раскладка — Haiku и в OpenRouter');
  const l2=[]; F._setFetch(pxFails(l2,402,'Insufficient balance')); const c=await F.handler(ev('POST',{headers:H,body:body({mode:'crop2'})})); assert.equal(c.statusCode,200);
  assert.equal(l2[1].model,'anthropic/claude-sonnet-5.5'); }));
test('ProxyAPI 429 (Too many requests) — OpenRouter; ProxyAPI ответил — provider proxyapi, OpenRouter не трогаем',()=>withOr(async()=>{
  const log=[]; F._setFetch(pxFails(log,429,'Too many requests'));
  const r=await F.handler(ev('POST',{headers:H,body:body({mode:'crop'})})); assert.equal(r.statusCode,200); assert.equal(JSON.parse(r.body).provider,'openrouter'); assert.match(log[1].url,/openrouter\.ai/);
  const l=[]; F._setFetch(fake(l,'P A″ 1 2')); const ok=await F.handler(ev('POST',{headers:H,body:body({mode:'crop'})})), j=JSON.parse(ok.body);
  assert.equal(j.provider,'proxyapi'); assert.equal(j.fallback,null); assert.equal(l.length,1); assert.match(l[0].url,/proxyapi\.ru/); }));
test('ProxyAPI 401/403 (ключ) — не деньги: в OpenRouter не идём',()=>withOr(async()=>{
  for(const st of [401,403]){ const log=[]; F._setFetch(pxFails(log,st,'API Key budget exceeded'));
    const r=await F.handler(ev('POST',{headers:H,body:body({mode:'crop'})})); assert.equal(r.statusCode,502); assert.equal(log.length,1); assert.ok(log.every(x=>/proxyapi\.ru/.test(x.url))); } }));
test('без OPENROUTER_API_KEY — как раньше: 402 на обеих моделях — ошибка, в OpenRouter не ходим',async()=>{ delete process.env.OPENROUTER_API_KEY;
  const log=[]; F._setFetch(pxFails(log,402,'Insufficient balance')); const r=await F.handler(ev('POST',{headers:H,body:body({mode:'crop'})}));
  assert.equal(r.statusCode,502); assert.match(JSON.parse(r.body).error,/402/); assert.deepEqual(log.map(x=>x.model),['anthropic/claude-opus-5-5','anthropic/claude-sonnet-5-5']); assert.ok(log.every(x=>/proxyapi\.ru/.test(x.url)));
  const l=[]; F._setFetch(pxFails(l,429,'Too many requests')); assert.equal((await F.handler(ev('POST',{headers:H,body:body()}))).statusCode,502); assert.equal(l.length,1); });
test('последний отказ ProxyAPI по деньгам — в статусе только владельцу (GET), студенту — нет',async()=>{ process.env.OWNER_CODE_SHA256=F.sha('мой-личный-код');
  try{ const get=code=>F.handler(ev('GET',{headers:{origin:OK,'x-scan-code':encodeURIComponent(code)}}));
    assert.equal(JSON.parse((await get('мой-личный-код')).body).provider.proxyapi.lastError,null);
    F._setFetch(pxFails([],402,'Insufficient balance to run this request')); const t=Date.now(); await F.handler(ev('POST',{headers:H,body:body()}));
    const o=await get('мой-личный-код'), j=JSON.parse(o.body); assert.equal(o.statusCode,200); assert.match(j.provider.proxyapi.lastError,/402.*Insufficient balance/); assert.ok(j.provider.proxyapi.at>=t); assert.equal(j.provider.openrouter,false);
    const s=await get('виктория'); assert.equal(s.statusCode,200); assert.equal(JSON.parse(s.body).provider,undefined); assert.ok(!s.body.includes('balance'));
  } finally { delete process.env.OWNER_CODE_SHA256; } });
