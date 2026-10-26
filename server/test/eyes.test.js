/* Глаза сканера: POST /api/eyes — только для вошедших, фото проверяется, ответ модели отдаётся как есть, фото не хранится. */
'use strict';
const test=require('node:test'), assert=require('node:assert');
const {club}=require('./helpers');
const {eyesFromEnv,pick,tune,ask,lastJson}=require('../lib/eyes');
const {testPng,PROBE_DOTS}=require('../tools/deploy');
const IMG='data:image/jpeg;base64,'+Buffer.from('фото').toString('base64');
const EYES={url:'https://llm.api.cloud.yandex.net/v1/chat/completions',model:'gpt://b1gtest/qwen2.5-vl-32b-instruct',folder:'b1gtest',key:'',auth:'Bearer',yandex:true,on:true};

test('настройки: Yandex AI Studio по умолчанию, ключ не нужен (IAM функции); без каталога и ключа — выключено',()=>{
  const a=eyesFromEnv({YC_FOLDER_ID:'b1gabc'}); assert.equal(a.on,true); assert.equal(a.model,'gpt://b1gabc/qwen2.5-vl-32b-instruct'); assert.equal(a.yandex,true);
  assert.equal(eyesFromEnv({}).on,false);
  const b=eyesFromEnv({EYES_URL:'https://example.com/v1/chat/completions',EYES_MODEL:'qwen-vl-max',EYES_KEY:'k'}); assert.equal(b.on,true); assert.equal(b.yandex,false);
  assert.equal(eyesFromEnv({YC_FOLDER_ID:'b1gabc',EYES:'off'}).on,false); });

test('без входа — 401; не настроено — 503',async()=>{
  const c=club({eyes:EYES,iam:'t1'}); const r=await c.call('POST','/api/eyes',{img:IMG,w:800,h:600}); assert.equal(r.status,401);
  const d=club(); await d.owner(); const r2=await d.call('POST','/api/eyes',{img:IMG,w:800,h:600},{as:'owner'}); assert.equal(r2.status,503); });

test('вошедший: фото → модель (IAM-токен, каталог, картинка) → текст ответа',async()=>{
  const c=club({eyes:EYES,iam:'iam-token-123'}); await c.owner(); let seen=null;
  c.ya.eyes=b=>{ seen=b; return {status:200,json:{choices:[{message:{content:'{"dz":3,"drawings":[{"part":4,"pts":{"A\'\'":[10,20]}}]}'}}]}}; };
  const r=await c.call('POST','/api/eyes',{img:IMG,w:800,h:600,dz:3,n:7},{as:'owner'});
  assert.equal(r.status,200); assert.equal(r.data.ok,true); assert.match(r.data.text,/"part":4/);
  const call=c.ya.calls.find(x=>x.url===EYES.url); assert.equal(call.headers.authorization,'Bearer iam-token-123'); assert.equal(call.headers['x-folder-id'],'b1gtest');
  assert.equal(seen.model,EYES.model); const u=seen.messages[1].content; assert.equal(u[1].image_url.url,IMG); assert.match(u[0].text,/ДЗ №3\. Вариант 7\. Размер фото: 800 × 600/);
  /* фото нигде не сохранилось */
  for(const t of ['users','progress','feedback','activity']){ const all=await c.store.scan(t); assert.ok(!JSON.stringify(all).includes(IMG.slice(30))); } });

test('не фото, неверный размер, слишком большое — 400/413; ошибка модели — 502 с причиной',async()=>{
  const c=club({eyes:EYES,iam:'t'}); await c.owner();
  assert.equal((await c.call('POST','/api/eyes',{img:'data:text/html;base64,PGI+',w:800,h:600},{as:'owner'})).status,400);
  assert.equal((await c.call('POST','/api/eyes',{img:IMG,w:50,h:600},{as:'owner'})).status,400);
  assert.equal((await c.call('POST','/api/eyes',{img:'data:image/jpeg;base64,'+'A'.repeat(3.2*1024*1024),w:800,h:600},{as:'owner'})).status,413);
  c.ya.eyes=()=>({status:429,json:{error:{message:'quota'}}}); const r=await c.call('POST','/api/eyes',{img:IMG,w:800,h:600},{as:'owner'});
  assert.equal(r.status,502); assert.match(r.data.error,/429.*quota/); });

test('лимит: не больше 40 фото в час на участника',async()=>{
  const c=club({eyes:EYES,iam:'t'}); await c.owner(); let last;
  for(let i=0;i<41;i++) last=await c.call('POST','/api/eyes',{img:IMG,w:800,h:600},{as:'owner'});
  assert.equal(last.status,429); });

test('развёртывание: подключается первая модель, что видит пробное фото; текстовая (ответ без зрения) и недоступные — нет, с причиной',async()=>{
  const img=testPng(), png=Buffer.from(img.split(',')[1],'base64'); assert.equal(png.slice(1,4).toString(),'PNG'); assert.equal(png.readUInt32BE(16),256); assert.equal(PROBE_DOTS.length,4);
  const ans={'gpt://b1gf/qwen3.6-35b-a3b/latest':[200,'Кругов на картинке три.'],'gpt://b1gf/aliceai-llm/latest':[403,'Forbidden'],'gpt://b1gf/yandexgpt-5.1/latest':[200,'<think>их четыре</think>4']};
  const calls=[], http=async(url,o)=>{ const b=JSON.parse(o.body); calls.push({model:b.model,auth:o.headers.authorization,folder:o.headers['x-folder-id'],img:b.messages[1].content[1].image_url.url,q:b.messages[1].content[0].text});
    const [st,t]=ans[b.model]||[400,'Failed to get model'];
    return {ok:st===200,status:st,text:async()=>JSON.stringify(st===200?{choices:[{message:{content:t}}]}:{error:{message:t}})}; };
  const more=['gpt://b1gf/aliceai-llm/latest','gpt://b1gf/yandexgpt-5.1/latest','gpt://b1gf/yandexgpt/latest'];
  const r=await pick({EYES_FOLDER:'b1gf'},{image:img,count:4},{fetch:http,token:()=>'iam-1',more});
  assert.equal(r.model,'gpt://b1gf/yandexgpt-5.1/latest');
  assert.deepEqual(r.tried.map(t=>t.model),['gpt://b1gf/qwen3.6-35b-a3b/latest','gpt://b1gf/aliceai-llm/latest','gpt://b1gf/gemma-3-27b-it/latest','gpt://b1gf/qwen2.5-vl-32b-instruct/latest']);
  assert.match(r.tried[0].error,/не видит картинку.*три/); assert.match(r.tried[1].error,/403/); assert.match(r.tried[3].error,/400.*Failed to get model/);
  assert.equal(calls.length,5); assert.ok(calls.every(c=>c.auth==='Bearer iam-1'&&c.folder==='b1gf'&&c.img===img&&/кругов/.test(c.q)));
  /* задана своя модель — пробуется только она; никто не увидел — model: null */
  const none=await pick({EYES_FOLDER:'b1gf',EYES_MODEL:'gpt://{folder}/my-vl'},{image:img,count:4},{fetch:http,token:()=>'t',more});
  assert.equal(none.model,null); assert.deepEqual(none.tried.map(t=>t.model),['gpt://b1gf/my-vl']); });

test('модель с рассуждением: ход мысли убирается; пустой ответ — JSON из рассуждения или понятная причина; добавки EYES_OPTS (base64)',async()=>{
  const opts=Buffer.from(JSON.stringify({chat_template_kwargs:{enable_thinking:false}})).toString('base64url');
  const cfg=eyesFromEnv({EYES_FOLDER:'b1gf',EYES_MODEL:'gpt://{folder}/qwen3.6-35b-a3b/latest',EYES_OPTS:opts});
  assert.deepEqual(cfg.opts,{chat_template_kwargs:{enable_thinking:false}}); assert.deepEqual(eyesFromEnv({EYES_OPTS:'мусор'}).opts,{});
  let reply, sent; const http=async(u,o)=>{ sent=JSON.parse(o.body); return {ok:true,status:200,text:async()=>JSON.stringify(reply)}; };
  const msg=(m,f)=>({choices:[{message:m,finish_reason:f||'stop'}]});
  reply=msg({content:'<think>A\'\' где-то {x}</think>\n{"drawings":[]}'}); let r=await ask(cfg,{image:'data:,',w:256,h:256},{fetch:http,token:()=>'t'});
  assert.equal(r.text,'{"drawings":[]}'); assert.deepEqual(sent.chat_template_kwargs,{enable_thinking:false});
  reply=msg({content:'',reasoning_content:'думаю {не json} … итог: {"dz":3,"drawings":[{"pts":{"O":[1,2]}}]} проверю'},'length');
  r=await ask(cfg,{image:'data:,',w:256,h:256},{fetch:http,token:()=>'t'}); assert.equal(JSON.parse(r.text).drawings[0].pts.O[1],2);
  reply=msg({content:'',reasoning_content:'долго думаю без итога'},'length');
  await assert.rejects(ask(cfg,{image:'data:,',w:256,h:256},{fetch:http,token:()=>'t'}),/пустой ответ: не уложилась в лимит ответа \(рассуждала 21 знаков\)/);
  assert.equal(lastJson('a {"drawings":[1]} b {"x":1}'),'{"drawings":[1]}'); assert.equal(lastJson('нет'),''); });

test('развёртывание: настройка запроса — из вариантов, вернувших JSON, самый быстрый; рассуждает — лимит с запасом',async()=>{
  let clock=0; const real=Date.now; Date.now=()=>clock;
  try{ const http=async(u,o)=>{ const b=JSON.parse(o.body), off=b.chat_template_kwargs&&b.chat_template_kwargs.enable_thinking===false;
      if(b.reasoning_effort==='none') return {ok:false,status:400,text:async()=>JSON.stringify({error:{message:'unknown field reasoning_effort'}})};
      clock+=off?2000:b.reasoning_effort?9000:30000; const think=off?'':'долгое рассуждение';
      return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:b.max_tokens>1500||off||b.reasoning_effort?'{"drawings":[]}':'',reasoning_content:think}}]})}; };
    const t=await tune({EYES_FOLDER:'b1gf',EYES_MODEL:'gpt://{folder}/q'},'data:,',{fetch:http,token:()=>'t'});
    assert.equal(t.best.name,'рассуждение выключено'); assert.deepEqual(t.best.opts,{chat_template_kwargs:{enable_thinking:false}});
    assert.deepEqual(t.results.map(x=>x.ok),[false,true,true,false,true]); assert.match(t.results[3].note,/400.*reasoning_effort/);
    const t2=await tune({EYES_FOLDER:'b1gf',EYES_MODEL:'gpt://{folder}/q'},'data:,',{fetch:async(u,o)=>{ const b=JSON.parse(o.body); if(b.chat_template_kwargs||b.reasoning_effort) return http(u,{body:JSON.stringify({max_tokens:1500})}); return http(u,o); },token:()=>'t'});
    assert.ok(t2.best.opts.max_tokens===8000); }
  finally{ Date.now=real; } });
