/* Конвейер листа: режимы layout/crop у server/lib/eyes.js и единство промптов сервера и браузера (lab/dz/layout.js). Не зависит от кабинета. */
'use strict';
const test=require('node:test'), assert=require('node:assert');
const E=require('../lib/eyes'), SP=require('../lib/sheetprompts'), LY=require('../../lab/dz/layout.js');
const IMG='data:image/jpeg;base64,'+Buffer.from('фото').toString('base64');
const fakeFetch=(log,text)=>async(url,init)=>{ const b=JSON.parse(init.body); log.push({url,b}); return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:text},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:50}})}; };

test('промпты сервера и браузера совпадают (одна копия смысла)',()=>{ assert.equal(SP.LAYOUT_PROMPT,LY.LAYOUT_PROMPT); assert.equal(SP.DIGIT_PROMPT,LY.DIGIT_PROMPT); });
test('настройки: раскладка — Haiku, оцифровка — Sonnet, оба через ProxyAPI; без ключа выключено',()=>{
  const c=E.eyesFromEnv({PROXYAPI_KEY:'k'}); assert.equal(c.layout.model,'anthropic/claude-haiku-5-5'); assert.equal(c.digit.model,'anthropic/claude-sonnet-5-5'); assert.match(c.layout.url,/proxyapi\.ru/);
  const d=E.eyesFromEnv({}); assert.equal(d.layout,null); assert.equal(E.eyesFromEnv({PROXYAPI_KEY:'k',EYES_LAYOUT_MODEL:'off'}).layout,null); });
test('askLayout: системный промпт раскладки, картинка, лимит ответа max_completion_tokens; без согласия — 403',async()=>{
  const c=E.eyesFromEnv({PROXYAPI_KEY:'k'}), log=[]; const r=await E.askLayout(c,{image:IMG,w:800,h:600,consent:true},{fetch:fakeFetch(log,'{"rot":0,"drawings":[]}')});
  assert.equal(r.text,'{"rot":0,"drawings":[]}'); const b=log[0].b; assert.equal(b.model,'anthropic/claude-haiku-5-5'); assert.equal(b.messages[0].content,SP.LAYOUT_PROMPT); assert.ok(b.max_completion_tokens>=1000&&!b.max_tokens);
  assert.equal(b.messages[1].content.find(x=>x.type==='image_url').image_url.url,IMG);
  await assert.rejects(()=>E.askLayout(c,{image:IMG,w:800,h:600,consent:false},{fetch:fakeFetch([],'x')}),e=>e.status===403); });
test('askCrop: промпт оцифровки одного чертежа, модель оцифровки; не подключена — 503',async()=>{
  const c=E.eyesFromEnv({PROXYAPI_KEY:'k'}), log=[]; await E.askCrop(c,{image:IMG,w:900,h:700,consent:true},{fetch:fakeFetch(log,'P A″ 10 20')});
  assert.equal(log[0].b.model,'anthropic/claude-sonnet-5-5'); assert.equal(log[0].b.messages[0].content,SP.DIGIT_PROMPT);
  await assert.rejects(()=>E.askCrop(E.eyesFromEnv({}),{image:IMG,w:900,h:700,consent:true},{fetch:fakeFetch([],'x')}),e=>e.status===503); });
test('разбор раскладки: рамки в px исходного фото, нечитаемое отбрасывается',()=>{
  const r=LY.parseLayout('```json\n{"rot":90,"drawings":[{"box":[10,20,300,400],"part":2},{"box":[1,1,2,2]},{"box":"x"}]}\n```',2,1000,1500); assert.equal(r.ok,true); assert.equal(r.rot,90); assert.equal(r.drawings.length,1); assert.deepEqual(r.drawings[0].box,[20,40,600,800]);
  assert.equal(LY.parseLayout('ничего',1,100,100).ok,false); });
test('разбор оцифровки: P, S (штриховой d), T; строки с нечисловыми координатами считаются нечитаемыми',()=>{
  const r=LY.parseDigit('P A″ 10 20\nS 1 2 3 4\nS 5 6 7 8 d\nS 1 2 x 4\nT 30 40 φ=25°'); assert.equal(r.pts.length,1); assert.equal(r.segs.length,2); assert.equal(r.segs[1][4],1); assert.equal(r.bad,1); assert.equal(r.txt[0][2],'φ=25°'); });
