/* Клуб как на nachert1830.ru/club/ (GitHub Pages) с API на другом адресе (функция в Yandex Cloud): node --test club/tests/site.test.js
   Поднимает node server/dev.js --site-port: «сайт» на одном порту, API на другом — CORS, токен в заголовке, CSP с адресом API.
   Вход через Яндекс ID (эмуляция oauth.yandex.ru) и через бота, привязка второго способа, синхронизация, выход. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {spawn}=require('child_process'), path=require('path'), fs=require('fs');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const PORT=8600+Math.floor(Math.random()*40)*2, API='http://localhost:'+PORT, SITE='http://localhost:'+(PORT+1), CLUB=SITE+'/club/';
let srv, browser;

test.before(async()=>{
  srv=spawn(process.execPath,[path.join(__dirname,'..','..','server','dev.js'),'--memory','--test','--quiet','--port='+PORT,'--site-port='+(PORT+1)],{stdio:['ignore','inherit','inherit','ipc']});
  await new Promise((res,rej)=>{ srv.on('message',m=>m.ready&&res()); srv.on('exit',c=>rej(new Error('dev.js завершился: '+c))); });
  browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
});
test.after(async()=>{ if(browser) await browser.close(); if(srv) srv.kill(); });

const dev=async(p,body)=>{ const r=await fetch(API+p,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined}); return r.json(); };
async function open(size){ const ctx=await browser.newContext(Object.assign({locale:'ru-RU',timezoneId:'Europe/Moscow'},size==='pc'?{viewport:{width:1366,height:860}}:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}));
  const page=await ctx.newPage(); page.errs=[]; page.on('pageerror',e=>page.errs.push(String(e)));
  page.on('console',m=>{ if(/Content Security Policy|Refused to|CORS/.test(m.text())) page.errs.push(m.text()); }); return {ctx,page}; }
/* «Войти с Яндекс ID» → форма эмуляции Яндекса → обратно на сайт → «Войти как …?» */
async function yandex(page,id,name,login,o){ o=o||{};
  await page.click('button[data-act="yaLogin"]'); await page.waitForSelector('#yaAllow');
  assert.ok(page.url().startsWith(API+'/dev/ya/authorize?'),'ушли на «Яндекс»');
  await page.fill('input[name=id]',String(id)); await page.fill('input[name=first_name]',name); await page.fill('input[name=login]',login||'tester');
  await page.click(o.deny?'#yaDeny':'#yaAllow'); if(o.deny||o.expectFail) return;
  await page.waitForSelector('button[data-act="redeem"]'); assert.ok(page.url().startsWith(CLUB),'вернулись на сайт: '+page.url());
  if(await page.$('#cTerms')){ await page.check('#cTerms'); await page.check('#cPd'); }
  await page.click('button[data-act="redeem"]'); }

test('сайт + Яндекс ID: владелец, приглашение тестировщику, вход тестировщика с компьютера; ни ошибок CSP, ни CORS',async()=>{
  const {ctx,page}=await open('pc'); await page.goto(CLUB); await page.waitForSelector('button[data-act="yaLogin"]');
  assert.ok(await page.$('button[data-act="tgLogin"]'),'и Telegram тоже');
  await yandex(page,5000001,'Андрей','owner'); await page.waitForSelector('text=Привет, Андрей');
  assert.match(await page.evaluate(()=>localStorage.getItem('club_tok')||''),/^[A-Za-z0-9_-]{40,}$/,'вход — токеном в localStorage сайта');
  assert.deepEqual(await ctx.cookies(API),[],'cookie на адрес API не ставится');
  await page.goto(CLUB+'#/admin'); await page.waitForSelector('#invL'); await page.fill('#invL','Аня, ИУ5'); await page.click('#invOut >> xpath=preceding-sibling::form//button[@type="submit"]');
  const link=(await page.waitForSelector('#invLink')).textContent().then(x=>x.trim());
  const L=await link; assert.ok(L.startsWith(CLUB+'#/invite/'),'ссылка-приглашение ведёт на сайт: '+L);
  assert.deepEqual(page.errs,[]); await ctx.close();

  const t=await open('phone'); await t.page.goto(L); await t.page.waitForSelector('text=Вас пригласили в клуб');
  await yandex(t.page,5000002,'Аня','anya'); await t.page.waitForSelector('text=Привет, Аня');
  await t.page.goto(CLUB+'#/settings'); await t.page.waitForSelector('text=Способы входа');
  assert.match(await t.page.textContent('.card:has-text("Способы входа")'),/Яндекс ID\s*привязан/);
  assert.deepEqual(t.page.errs,[]); await t.ctx.close();

  const s=await open('pc'); await s.page.goto(CLUB); await s.page.waitForSelector('button[data-act="yaLogin"]');
  await yandex(s.page,5000003,'Чужой','stranger',{expectFail:true}); await s.page.waitForSelector('text=Не получилось войти');
  assert.match(await s.page.textContent('#view'),/приглашени/); assert.equal(await s.page.isHidden('#tabs'),true);
  await yandex(s.page,5000003,'Чужой','stranger',{deny:true}); await s.page.waitForSelector('text=Вы отменили вход');
  assert.deepEqual(s.page.errs,[]); await s.ctx.close();
});

test('сайт + Telegram: официальный вход, привязка Яндекс ID, прогресс общий с сайтом и в аккаунте, выход его не стирает',async()=>{
  const inv=await dev('/dev/invite',{label:'site'}); assert.ok(inv.link.startsWith(CLUB));
  const {ctx,page}=await open('phone'); await page.goto(SITE+'/club/'); await page.evaluate(()=>localStorage.setItem('nch2_rep',JSON.stringify({'1.1':{n:1,lvl:2,due:'2026-10-20'}})));
  await page.goto(inv.link); await page.waitForSelector('text=Вас пригласили в клуб');
  await page.click('button[data-act="tgLogin"]'); await page.waitForSelector('#tgAllow'); await page.fill('input[name=id]','6001'); await page.fill('input[name=first_name]','Боб');
  await page.click('#tgAllow'); await page.waitForSelector('text=Войти как Боб?'); await page.check('#cTerms'); await page.check('#cPd');
  await page.click('button[data-act="redeem"]'); await page.waitForSelector('text=Привет, Боб');
  await page.waitForFunction(()=>document.querySelector('#net')&&/сохранено/.test(document.querySelector('#net').textContent),null,{timeout:8000});
  await page.goto(CLUB+'#/settings'); await page.click('button[data-act="linkYa"]'); await page.waitForSelector('#yaAllow');
  await page.fill('input[name=id]','5000099'); await page.click('#yaAllow'); await page.waitForSelector('text=Яндекс ID привязан');
  assert.match(await page.textContent('.card:has-text("Способы входа")'),/Яндекс ID\s*привязан[\s\S]*Telegram\s*привязан/);
  page.on('dialog',d=>d.accept()); await page.click('button[data-act="logout"]'); await page.waitForSelector('button[data-act="yaLogin"]');
  assert.equal(await page.evaluate(()=>localStorage.getItem('club_tok')),null,'вход стёрт');
  assert.ok(await page.evaluate(()=>localStorage.getItem('nch2_rep')),'прогресс сайта на месте: он был до клуба');
  assert.deepEqual(page.errs,[]); await ctx.close();
  const b=await open('pc'); await b.page.goto(CLUB); await yandex(b.page,5000099,'Боб','bob'); await b.page.waitForSelector('text=Привет, Боб');
  assert.ok(await b.page.evaluate(()=>{ const r=JSON.parse(localStorage.getItem('nch2_rep')||'{}'); return !!r['1.1']; }),'вход через привязанный Яндекс ID — тот же аккаунт, прогресс приехал');
  assert.deepEqual(b.page.errs,[]); await b.ctx.close();
});

test('сайт + официальный вход Telegram: кнопка ведёт на «oauth.telegram.org», подтверждение → «Войти как …?»',async()=>{
  const inv=await dev('/dev/invite',{label:'tg'}); const {ctx,page}=await open('phone'); await page.goto(inv.link); await page.waitForSelector('text=Вас пригласили в клуб');
  assert.equal(await page.$('button[data-act="botLogin"]'),null,'на сайте Telegram — только официальный вход');
  await page.click('button[data-act="tgLogin"]'); await page.waitForSelector('#tgAllow'); assert.ok(page.url().startsWith(API+'/dev/tg/auth?'));
  await page.fill('input[name=id]','7007'); await page.fill('input[name=first_name]','Вера'); await page.click('#tgAllow');
  await page.waitForSelector('text=Войти как Вера?'); assert.equal(await page.evaluate(()=>location.hash),'#/','данные Telegram убраны из адресной строки');
  await page.check('#cTerms'); await page.check('#cPd'); await page.click('button[data-act="redeem"]'); await page.waitForSelector('text=Привет, Вера');
  assert.deepEqual(page.errs,[]); await ctx.close();
  const s=await open('pc'); await s.page.goto(CLUB); await s.page.click('button[data-act="tgLogin"]'); await s.page.waitForSelector('#tgAllow');
  await s.page.fill('input[name=id]','7008'); await s.page.click('#tgAllow'); await s.page.waitForSelector('text=Не получилось войти');
  assert.match(await s.page.textContent('#view'),/приглашени/,'без приглашения — понятный отказ'); await s.ctx.close();
});
