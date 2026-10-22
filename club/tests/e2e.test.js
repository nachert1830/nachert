/* Сквозная проверка клуба в браузере на экране телефона (390 × 844): node --test club/tests/e2e.test.js
   Поднимает node server/dev.js --memory --test (эмуляция Telegram и почты) и проходит сценарии нажатиями. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {spawn}=require('child_process'), path=require('path'), fs=require('fs'), os=require('os');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const PORT=8700+Math.floor(Math.random()*90), URL='http://localhost:'+PORT;
const PHONE={viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'ru-RU',timezoneId:'Europe/Moscow'};
const SHOTS=process.env.CLUB_SHOTS||path.join(os.tmpdir(),'club-shots');
let srv, browser;

test.before(async()=>{
  srv=spawn(process.execPath,[path.join(__dirname,'..','..','server','dev.js'),'--memory','--test','--quiet','--port='+PORT],{stdio:['ignore','inherit','inherit','ipc']});
  await new Promise((res,rej)=>{ srv.on('message',m=>m.ready&&res()); srv.on('exit',c=>rej(new Error('dev.js завершился: '+c))); });
  browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  fs.mkdirSync(SHOTS,{recursive:true});
});
test.after(async()=>{ if(browser) await browser.close(); if(srv) srv.kill(); });

const dev=async(p,body)=>{ const r=await fetch(URL+p,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined}); return r.json(); };
async function phone(opt){ const ctx=await browser.newContext(Object.assign({},PHONE,opt||{})); const page=await ctx.newPage(); page.errs=[];
  page.on('pageerror',e=>page.errs.push(String(e))); page.on('console',m=>{ if(/Content Security Policy|Refused to/.test(m.text())) page.errs.push(m.text()); }); return {ctx,page}; }
/* вход через эмуляцию Telegram; consent — отметить документы (в форме приглашения или в окне первого входа) */
/* вход через бота: «Войти через Telegram» → в эмуляции бота «Старт» и «Войти» за участника.
   consent — отметить документы на странице приглашения; firstNoInvite — владелец впервые: согласие в окне */
async function botLogin(page,id,name,o){ o=o||{};
  if(o.consent){ await page.check('#cTerms'); await page.check('#cPd'); }
  await page.click('button[data-act="botLogin"]'); await page.waitForSelector('#dvId');
  await page.fill('#dvId',String(id)); await page.fill('#dvName',name||'Тест'); await page.click('button[data-act="devBot"]');
  if(o.firstNoInvite){ await page.waitForSelector('#caGo'); await page.check('#sheet #cTerms'); await page.check('#sheet #cPd'); await page.click('#caGo'); } }
async function join(page,id,name){ const inv=await dev('/dev/invite',{label:'e2e'}); await page.goto(inv.link); await page.waitForSelector('#cTerms'); await botLogin(page,id,name,{consent:true}); await page.waitForSelector('text=Привет'); }
const noHScroll=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);

test('без приглашения — отказ',async()=>{
  const {ctx,page}=await phone(); await page.goto(URL+'/'); await page.waitForSelector('text=Клуб Начерта');
  await botLogin(page,5551,'Чужой'); await page.waitForSelector('#authMsg .note.bad');
  assert.match(await page.textContent('#authMsg'),/приглашени/);
  assert.equal(await page.isHidden('#tabs'),true,'кабинет не открылся');
  const r=await page.evaluate(()=>fetch('/api/me').then(r=>r.status)); assert.equal(r,401);
  assert.deepEqual(page.errs,[]); await ctx.close();
});

test('приглашение → вход через Telegram → все разделы на телефоне, светлая и тёмная тема',async()=>{
  const {ctx,page}=await phone(); const inv=await dev('/dev/invite',{label:'e2e'});
  await page.goto(inv.link); await page.waitForSelector('text=Вас пригласили в клуб');
  assert.equal(await page.evaluate(()=>location.hash),'#/join','код приглашения убран из адресной строки');
  await page.click('button[data-act="botLogin"]');
  await page.waitForSelector('#authMsg .note.bad'); assert.match(await page.textContent('#authMsg'),/соглашение/,'без согласия — нельзя');
  await botLogin(page,2001,'Аня',{consent:true}); await page.waitForSelector('text=Привет, Аня');
  for(const r of ['','calendar','event/ng-rk-2','event/ikg-dz-2','event/ng-rk-2/diag','event/ng-rk-2/mock','train','skills','check','settings','more','about']){
    await page.goto(URL+'/#/'+r); await page.waitForTimeout(250);
    assert.ok(await noHScroll(page),'горизонтальная прокрутка: #/'+r);
    for(const th of ['light','dark']){ await page.evaluate(t=>{ document.documentElement.dataset.theme=t; },th); await page.screenshot({path:path.join(SHOTS,(r||'today').replace(/\//g,'_')+'-'+th+'.png'),fullPage:true}); } }
  await page.evaluate(()=>{ document.documentElement.dataset.theme='light'; }); await page.click('#theme');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(10, 15, 34)','тёмная тема — цвета основного сайта');
  assert.equal(await page.evaluate(()=>localStorage.getItem('nch2_theme')),'"dark"','тот же ключ темы, что на основном сайте');
  assert.equal(await page.isVisible('a[href="#/admin"]'),false); await page.goto(URL+'/#/more'); assert.equal(await page.isVisible('text=Админ-панель'),false,'участник админку не видит');
  const cookies=await ctx.cookies(); const sid=cookies.find(c=>c.name==='club_sid'); assert.ok(sid&&sid.httpOnly&&sid.sameSite==='Lax');
  assert.deepEqual(page.errs,[]); await ctx.close();
});

test('вход через бота: «Это не я» и просрочка отклоняются, на компьютере — без окон Telegram',async()=>{
  const {ctx,page}=await phone({viewport:{width:1366,height:900},isMobile:false,hasTouch:false}); await page.goto(URL+'/');
  await page.click('button[data-act="botLogin"]'); await page.waitForSelector('#openBot');
  assert.match(await page.getAttribute('#openBot','href'),/^https:\/\/t\.me\/nachert_club_dev_bot\?start=l_[A-Za-z0-9_-]{32}$/,'ссылка на бота, а не окно Telegram на сайте');
  const tok=(await page.getAttribute('#openBot','href')).split('l_')[1];
  await dev('/dev/bot-login',{token:tok,id:1000001,deny:true});
  await page.waitForSelector('#authMsg .note.bad'); assert.match(await page.textContent('#authMsg'),/отклон/);
  await page.click('button[data-act="botLogin"]'); await page.waitForSelector('#openBot');
  await dev('/dev/clock',{offsetMs:11*60e3}); await page.waitForSelector('#authMsg .note.bad',{timeout:10000}); assert.match(await page.textContent('#authMsg'),/вышло|использован/);
  await dev('/dev/clock',{offsetMs:0});
  assert.ok(await page.isVisible('.tabs')===false||await page.isHidden('#tabs'),'не вошли');
  assert.deepEqual(page.errs,[]); await ctx.close();
});

test('синхронизация: прогресс с устройства — в аккаунт при первом входе, второе устройство его получает, офлайн',async()=>{
  const a=await phone(); await a.page.goto(URL+'/'); await a.page.waitForSelector('text=Клуб Начерта');
  /* на устройстве уже есть прогресс в формате основного сайта (как после переноса файлом) */
  await a.page.evaluate(()=>{ localStorage.setItem('nch2_rep',JSON.stringify({52:{b:1,d:1,s:1,l:1,n:1,r:2},17:{b:0,d:1,s:1,l:1,n:1,r:0}})); localStorage.setItem('nch2_wb3',JSON.stringify({52:2})); });
  await join(a.page,3001,'Синх'); await a.page.waitForSelector('text=Прогресс с этого устройства перенесён в аккаунт');
  const srvRep=await a.page.evaluate(()=>fetch('/api/progress').then(r=>r.json()).then(j=>JSON.parse(j.data.nch2_rep)));
  assert.equal(srvRep[52].b,1); assert.equal(srvRep[17].n,1);
  const b=await phone(); await b.page.goto(URL+'/'); await botLogin(b.page,3001,'Синх'); await b.page.waitForSelector('text=Привет');
  await b.page.waitForFunction(()=>!!localStorage.getItem('nch2_rep')&&JSON.parse(localStorage.getItem('nch2_rep'))[52]);
  await b.page.goto(URL+'/#/train'); await b.page.waitForSelector('.task .rate');
  assert.equal(await b.page.locator('.task').count(),3,'2 на повтор + 1 вперемешку');
  await b.ctx.setOffline(true);
  const n=await b.page.getAttribute('.task:has(.rate)','data-n'); await b.page.click('.task:has(.rate) button[data-v="2"]');
  await b.page.waitForFunction(()=>/офлайн/.test(document.querySelector('#net').textContent));
  await b.ctx.setOffline(false); await b.page.evaluate(()=>dispatchEvent(new Event('online')));
  await b.page.waitForFunction(()=>document.querySelector('#net').textContent==='сохранено',null,{timeout:10000});
  const after=await a.page.evaluate(()=>fetch('/api/progress').then(r=>r.json()).then(j=>JSON.parse(j.data.nch2_rep)));
  assert.equal(after[n].n,2,'оценка, сделанная офлайн, дошла до аккаунта');
  const ev=await a.page.evaluate(()=>fetch('/api/progress').then(r=>r.json()).then(j=>JSON.parse(j.data.nch2_club_ev||'[]')));
  assert.ok(ev.some(e=>e.task===+n&&e.ok===true),'и наблюдение для карты навыков');
  for(const x of [a,b]){ assert.deepEqual(x.page.errs,[]); await x.ctx.close(); }
});

test('перенос файлом с основного сайта (формат «Сохранить в файл»)',async()=>{
  const {ctx,page}=await phone(); await join(page,3101,'Файл');
  const f=path.join(os.tmpdir(),'nachert-progress-e2e.json');
  fs.writeFileSync(f,JSON.stringify({app:'nachert',v:1,at:'2026-10-10T10:00:00Z',data:{nch2_rep:JSON.stringify({60:{b:2,d:1,s:1,l:1,n:3,r:2}}),nch2_ck:'"y"'}}));
  await page.goto(URL+'/#/settings'); await page.setInputFiles('#impF',f); await page.click('button[data-act="import"]');
  await page.waitForSelector('text=Задач в повторении: 1');
  await page.waitForFunction(()=>document.querySelector('#net').textContent==='сохранено',null,{timeout:10000});
  const rep=await page.evaluate(()=>fetch('/api/progress').then(r=>r.json()).then(j=>j.data));
  assert.equal(JSON.parse(rep.nch2_rep)[60].b,2); assert.equal(rep.nch2_ck,undefined,'согласие на cookie основного сайта не переносится');
  assert.deepEqual(page.errs,[]); await ctx.close();
});

test('календарь и обратный план на фиксированной дате (30.10.2026)',async()=>{
  const {ctx,page}=await phone(); await page.clock.install({time:new Date('2026-10-30T10:00:00+03:00')});
  await join(page,4001,'План');
  assert.match(await page.textContent('#view'),/9-я неделя · пт, 30 окт/);
  assert.match(await page.textContent('[data-feature="plan"]'),/РК2 Начерт · Диагностика/);
  assert.match(await page.textContent('[data-feature="calendar"]'),/РК2 · ИКГ[\s\S]*через 3 дня/);
  await page.goto(URL+'/#/event/ng-rk-2'); await page.waitForSelector('text=Обратный план');
  assert.equal(await page.inputValue('#evd'),'2026-11-09');
  const steps=await page.$$eval('.steps li .st small',e=>e.map(x=>x.textContent));
  assert.match(steps[0],/пт, 30 окт/); assert.match(steps[1],/сб, 31 окт – пт, 6 ноя/); assert.match(steps[2],/сб, 7 ноя/); assert.match(steps[3],/вс, 8 ноя/); assert.match(steps[4],/пн, 9 ноя/);
  await page.goto(URL+'/#/calendar'); await page.selectOption('#cd-ng','3'); await page.goto(URL+'/#/event/ng-rk-2'); await page.waitForSelector('#evd');
  assert.equal(await page.inputValue('#evd'),'2026-11-11','занятие по начерту в среду — РК в среду');
  await page.fill('#evd','2026-11-13'); await page.dispatchEvent('#evd','change'); await page.waitForTimeout(200);
  assert.match(await page.textContent('.steps'),/ср, 11 ноя/,'пробный РК — за 2 дня до 13 ноября');
  await page.fill('#iiW','в четверг, 17:30'); await page.fill('#iiP','читальный зал'); await page.fill('#iiT','решаю задачи 52 и 57'); await page.click('#iiForm button[type=submit]');
  await page.waitForSelector('text=Если в четверг, 17:30, читальный зал, то я решаю задачи 52 и 57.');
  await page.goto(URL+'/#/event/ng-rk-2/diag'); await page.waitForSelector('.task');
  const k=await page.locator('.task').count(); assert.ok(k>=3&&k<=6,'диагностика: по задаче на тему, '+k);
  for(let i=0;i<k;i++){ await page.click('.task:has(.rate) button[data-v="1"]'); await page.click('.task .errs button[data-e="proj"]'); await page.click('.task .errs button[data-act="rateSave"]'); }
  await page.waitForSelector('text=Диагностика пройдена');
  await page.goto(URL+'/#/skills'); await page.waitForSelector('text=Что тренировать');
  assert.match(await page.textContent('#view'),/Точка на эпюре Монжа[\s\S]*слабое место/,'ошибка «перепутал проекции» снизила навык эпюра');
  assert.deepEqual(page.errs,[]); await ctx.close();
});

test('админ: приглашение, отзыв приглашения, флаги, отзывы тестировщиков',async()=>{
  const {ctx,page}=await phone(); await page.goto(URL+'/'); await botLogin(page,1000001,'Владелец',{firstNoInvite:true}); await page.waitForSelector('text=Привет, Владелец');
  await page.click('[data-feature="calendar"] button[data-act="fb"]'); await page.click('#fbMood button[data-m="good"]'); await page.fill('#fbT','Календарь понятный'); await page.click('#fbGo'); await page.waitForSelector('text=Спасибо');
  await page.goto(URL+'/#/admin'); await page.waitForSelector('#invForm');
  await page.fill('#invL','Петя, ИУ7'); await page.click('#invForm button[type=submit]'); await page.waitForSelector('#invLink');
  const link=await page.textContent('#invLink'); assert.match(link,/#\/invite\/[A-Za-z0-9_-]{22}$/);
  page.once('dialog',d=>d.accept()); await page.click('.urow:has-text("Петя, ИУ7") button[data-act="revoke"]'); await page.waitForSelector('.urow:has-text("Петя, ИУ7"):has-text("отозвано")');
  const p=await phone(); await p.page.goto(link); await p.page.waitForSelector('text=Приглашение не подходит'); assert.match(await p.page.textContent('#view'),/отозвано/); await p.ctx.close();
  await page.click('button[data-act="atab"][data-t="flags"]'); await page.click('button[data-act="flag"][data-f="scanner"][data-m="off"]'); await page.waitForTimeout(300);
  await page.goto(URL+'/#/check'); assert.equal(await page.isVisible('text=Проверь решение по фото'),false,'выключенная функция скрыта');
  await page.goto(URL+'/#/admin'); await page.click('button[data-act="atab"][data-t="flags"]'); await page.click('button[data-act="flag"][data-f="scanner"][data-m="on"]');
  await page.click('button[data-act="atab"][data-t="feedback"]'); await page.waitForSelector('text=Календарь понятный');
  assert.ok(await noHScroll(page)); assert.deepEqual(page.errs,[]); await ctx.close();
});

test('проверка: предпроверка листа ИКГ по ГОСТ и заглушка сканера; вредный SVG обезврежен',async()=>{
  const {ctx,page}=await phone(); await join(page,5001,'Лист');
  await page.goto(URL+'/#/check'); await page.click('button[data-s="ig-v5-clean"]'); await page.waitForSelector('#nkOut .note.ok',{timeout:30000});
  assert.match(await page.textContent('#nkOut'),/замечаний нет/);
  await page.click('button[data-s="ig-v8-thin"]'); await page.waitForSelector('#nkOut .note.warn',{timeout:30000});
  assert.match(await page.textContent('#nkOut'),/ГОСТ 2\.303/);
  const evil=path.join(os.tmpdir(),'evil.svg'); let alerted=false; page.on('dialog',d=>{ alerted=true; d.dismiss(); });
  fs.writeFileSync(evil,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 297" width="420mm" height="297mm"><script>alert(1)</script><image href="x" onerror="alert(2)"/><rect x="5" y="5" width="410" height="287" style="stroke:#000;stroke-width:0.7;fill:none" onclick="alert(3)"/></svg>');
  await page.setInputFiles('#nkF',evil); await page.click('button[data-act="normo"]'); await page.waitForSelector('#nkOut .note',{timeout:30000});
  const clean=await page.evaluate(()=>CLUB.sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script><rect onclick="y" style="stroke-width:2;background:url(javascript:z)"/><image href="https://evil/x.png"/></svg>'));
  assert.doesNotMatch(clean,/script|onclick|javascript|https:\/\/evil/); assert.match(clean,/stroke-width="2"/);
  assert.equal(alerted,false,'скрипты из SVG не выполнились');
  await page.fill('#scN','52'); await page.setInputFiles('#scF',{name:'p.jpg',mimeType:'image/jpeg',buffer:Buffer.from([0xff,0xd8,0xff,0xd9])});
  await page.click('button[data-act="scan"]'); await page.waitForSelector('#scOut .note'); assert.match(await page.textContent('#scOut'),/Не знаю/);
  assert.deepEqual(page.errs.filter(e=>!/evil|x\.png|ERR_/.test(e)),[]); await ctx.close();
});

test('офлайн: кабинет открывается без сети после первого входа',async()=>{
  const {ctx,page}=await phone(); await join(page,6001,'Офлайн');
  await page.evaluate(()=>navigator.serviceWorker.ready); await page.reload(); await page.waitForSelector('text=Привет, Офлайн'); await page.waitForTimeout(300);
  await ctx.setOffline(true); await page.reload(); await page.waitForSelector('text=Привет, Офлайн',{timeout:10000});
  assert.match(await page.textContent('#net'),/офлайн/);
  await page.goto(URL+'/#/calendar'); await page.waitForSelector('text=Недели');
  await ctx.setOffline(false); await ctx.close();
});

test('выход и удаление аккаунта стирают данные с устройства',async()=>{
  const {ctx,page}=await phone(); await join(page,7001,'Удаляюсь');
  await page.goto(URL+'/#/settings'); await page.click('button[data-act="delete"]'); await page.fill('#delC','УДАЛИТЬ'); await page.click('#delGo');
  await page.waitForSelector('text=Клуб Начерта');
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/^nch2_(rep|club_(ev|cal|done|ii))/.test(k)).length),0);
  await botLogin(page,7001,'Удаляюсь'); await page.waitForSelector('#authMsg .note.bad'); assert.match(await page.textContent('#authMsg'),/приглашени/);
  assert.deepEqual(page.errs,[]); await ctx.close();
});
