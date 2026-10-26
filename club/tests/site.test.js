/* Кабинет как на nachert1830.ru/club/ (GitHub Pages) с API на другом адресе (функция в Yandex Cloud): node --test club/tests/site.test.js
   Поднимает node server/dev.js --site-port: «сайт» на одном порту, API на другом — CORS, токен в заголовке, CSP с адресом API.
   Регистрация открыта: вход по почте (код), через Яндекс ID (эмуляция oauth.yandex.ru) и официальный вход Telegram (эмуляция). */
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
/* новому — «Добро пожаловать»: имя и две отметки */
async function onboard(page,name){ await page.waitForSelector('#onbF'); if(name) await page.fill('#onN',name); await page.fill('#onG','ИУ5-11Б'); await page.check('#cTerms'); await page.check('#cPd'); await page.click('#onbF button[type=submit]'); }
/* «Войти с Яндекс ID» → форма эмуляции Яндекса → обратно на сайт */
async function yandex(page,id,name,login,o){ o=o||{};
  await page.click('button[data-act="yaLogin"]'); await page.waitForSelector('#yaAllow');
  assert.ok(page.url().startsWith(API+'/dev/ya/authorize?'),'ушли на «Яндекс»');
  await page.fill('input[name=id]',String(id)); await page.fill('input[name=first_name]',name); await page.fill('input[name=login]',login||'tester');
  await page.click(o.deny?'#yaDeny':'#yaAllow'); if(o.deny) return;
  await page.waitForSelector('#onbF, #tabs:not([hidden])'); assert.ok(page.url().startsWith(CLUB),'вернулись на сайт: '+page.url());
  if(await page.$('#onbF')) await onboard(page); }
/* почта: адрес → код из письма (эмуляция — /dev/outbox) */
async function mail(page,addr){ await page.waitForSelector('#emA'); await page.fill('#emA',addr); await page.click('#mailF button[type=submit]'); await page.waitForSelector('#emC');
  const box=await dev('/dev/outbox'); const code=/(\d{6})/.exec(box.mail.filter(x=>x.to===addr.toLowerCase()).pop().subject)[1];
  await page.fill('#emC',code); await page.click('#codeF button[type=submit]'); await page.waitForSelector('#onbF, #tabs:not([hidden])'); }

test('регистрация по почте без приглашений: код, «Добро пожаловать», второй вход — сразу в кабинет',async()=>{
  const {ctx,page}=await open('phone'); await page.goto(CLUB); await page.waitForSelector('text=Вход в кабинет');
  assert.equal(await page.$('text=приглашени'),null,'ни слова о приглашениях');
  await mail(page,'Anna@Ex.ru'); await page.waitForSelector('text=Добро пожаловать'); assert.match(await page.textContent('.asub'),/an•••@ex\.ru/);
  await onboard(page,'Аня'); await page.waitForSelector('text=Привет, Аня');
  assert.match(await page.evaluate(()=>localStorage.getItem('club_tok')||''),/^[A-Za-z0-9_-]{40,}$/,'вход — токеном в localStorage сайта');
  assert.equal(await page.getAttribute('#tabs a:first-child','href'),'#/check','первая вкладка — проверка');
  page.on('dialog',d=>d.accept()); await page.goto(CLUB+'#/settings'); await page.click('button[data-act="logout"]'); await page.waitForSelector('#emA');
  await mail(page,'anna@ex.ru'); await page.waitForSelector('text=Привет, Аня'); assert.equal(await page.$('#onbF'),null,'участник — без экрана согласия');
  assert.deepEqual(page.errs,[]); await ctx.close();
});

test('Яндекс ID: владелец по логину, новый человек без приглашения, отмена; ни ошибок CSP, ни CORS',async()=>{
  const {ctx,page}=await open('pc'); await page.goto(CLUB); await page.waitForSelector('button[data-act="yaLogin"]');
  await yandex(page,5000001,'Андрей','owner'); await page.waitForSelector('text=Привет, Андрей');
  await page.goto(CLUB+'#/more'); await page.waitForSelector('text=Админ-панель');
  assert.deepEqual(await ctx.cookies(API),[],'cookie на адрес API не ставится'); assert.deepEqual(page.errs,[]); await ctx.close();
  const t=await open('phone'); await t.page.goto(CLUB); await yandex(t.page,5000002,'Боб','bob'); await t.page.waitForSelector('text=Привет, Боб');
  await t.page.goto(CLUB+'#/more'); assert.equal(await t.page.isVisible('text=Админ-панель'),false,'новый — участник, не админ');
  assert.deepEqual(t.page.errs,[]); await t.ctx.close();
  const s=await open('pc'); await s.page.goto(CLUB); await yandex(s.page,5000003,'Чужой','x',{deny:true}); await s.page.waitForSelector('text=Вы отменили вход');
  assert.deepEqual(s.page.errs,[]); await s.ctx.close();
});

test('официальный вход Telegram, привязка Яндекс ID и почты — аккаунт один; выход не стирает прогресс сайта',async()=>{
  const {ctx,page}=await open('phone'); await page.goto(CLUB); await page.evaluate(()=>localStorage.setItem('nch2_rep',JSON.stringify({'1.1':{n:1,lvl:2,due:'2026-10-20'}})));
  await page.goto(CLUB); await page.click('button[data-act="tgLogin"]'); await page.waitForSelector('#tgAllow'); assert.ok(page.url().startsWith(API+'/dev/tg/auth?'));
  await page.fill('input[name=id]','7007'); await page.fill('input[name=first_name]','Вера'); await page.click('#tgAllow');
  await onboard(page); await page.waitForSelector('text=Привет, Вера'); assert.equal(await page.evaluate(()=>location.hash),'#/','данные Telegram убраны из адреса');
  await page.waitForFunction(()=>/сохранено/.test((document.querySelector('#net')||{}).textContent||''),null,{timeout:8000});
  await page.goto(CLUB+'#/settings'); await page.click('button[data-act="linkYa"]'); await page.waitForSelector('#yaAllow');
  await page.fill('input[name=id]','5000099'); await page.click('#yaAllow'); await page.waitForSelector('text=Яндекс ID привязан');
  await page.click('button[data-act="linkMail"]'); await page.fill('#lmA','vera@ex.ru'); await page.click('#lmF button[type=submit]'); await page.waitForSelector('#lcC');
  const box=await dev('/dev/outbox'); const code=/(\d{6})/.exec(box.mail.filter(x=>x.to==='vera@ex.ru').pop().subject)[1];
  await page.fill('#lcC',code); await page.click('#lcF button[type=submit]'); await page.waitForSelector('text=Почта привязана');
  assert.match(await page.textContent('.card:has-text("Способы входа")'),/Яндекс ID\s*привязан[\s\S]*Почта\s*привязана[\s\S]*Telegram\s*привязан/);
  page.on('dialog',d=>d.accept()); await page.click('button[data-act="logout"]'); await page.waitForSelector('#emA');
  assert.equal(await page.evaluate(()=>localStorage.getItem('club_tok')),null,'вход стёрт');
  assert.ok(await page.evaluate(()=>localStorage.getItem('nch2_rep')),'прогресс сайта на месте: он был до кабинета');
  assert.deepEqual(page.errs,[]); await ctx.close();
  const b=await open('pc'); await b.page.goto(CLUB); await mail(b.page,'vera@ex.ru'); await b.page.waitForSelector('text=Привет, Вера');
  assert.ok(await b.page.evaluate(()=>!!JSON.parse(localStorage.getItem('nch2_rep')||'{}')['1.1']),'вход по привязанной почте — тот же аккаунт, прогресс приехал');
  assert.deepEqual(b.page.errs,[]); await b.ctx.close();
});

test('проверка чертежа: сканер открывается внутри кабинета',async()=>{
  const {ctx,page}=await open('phone'); await page.goto(CLUB); await mail(page,'scan@ex.ru'); await onboard(page,'Сканер'); await page.waitForSelector('text=Привет');
  await page.click('a.cta-check'); await page.waitForSelector('a.tool[href="#/check/dz"]'); await page.click('a.tool[href="#/check/dz"]');
  const fr=await (await page.waitForSelector('iframe.labf')).contentFrame(); await fr.waitForSelector('body'); assert.match(await fr.title(),/ДЗ/,'сканер ДЗ загрузился в кабинете');
  assert.deepEqual(page.errs,[]); await ctx.close();
});
