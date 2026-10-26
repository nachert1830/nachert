/* Глаза сканера: POST /api/eyes — только для вошедших, фото проверяется, ответ модели отдаётся как есть, фото не хранится. */
'use strict';
const test=require('node:test'), assert=require('node:assert');
const {club}=require('./helpers');
const {eyesFromEnv,pick}=require('../lib/eyes');
const {testPng}=require('../tools/deploy');
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

test('развёртывание: модель зрения подбирается — первая, что ответила на пробное фото; причины отказов остальных видны',async()=>{
  const img=testPng(), png=Buffer.from(img.split(',')[1],'base64'); assert.equal(png.slice(1,4).toString(),'PNG'); assert.equal(png.readUInt32BE(16),256);
  const calls=[], http=async(url,o)=>{ const b=JSON.parse(o.body); calls.push({url,model:b.model,auth:o.headers.authorization,folder:o.headers['x-folder-id'],img:b.messages[1].content[1].image_url.url});
    const ok=/qwen2\.5-vl-32b-instruct\/latest$/.test(b.model);
    return {ok,status:ok?200:400,text:async()=>JSON.stringify(ok?{choices:[{message:{content:'{"drawings":[]}'}}]}:{error:{message:'model not supported'}})}; };
  const r=await pick({EYES_FOLDER:'b1gf'},img,{fetch:http,token:()=>'iam-1'});
  assert.equal(r.model,'gpt://b1gf/qwen2.5-vl-32b-instruct/latest');
  assert.deepEqual(r.tried.map(t=>t.model),['gpt://b1gf/gemma-3-27b-it/latest','gpt://b1gf/gemma-3-27b-it']); assert.match(r.tried[0].error,/400.*model not supported/);
  assert.ok(calls.every(c=>c.auth==='Bearer iam-1'&&c.folder==='b1gf'&&c.img===img));
  /* задана своя модель — пробуется только она; никто не ответил — model: null */
  const none=await pick({EYES_FOLDER:'b1gf',EYES_MODEL:'gpt://{folder}/my-vl'},img,{fetch:http,token:()=>'t'});
  assert.equal(none.model,null); assert.deepEqual(none.tried.map(t=>t.model),['gpt://b1gf/my-vl']); });
