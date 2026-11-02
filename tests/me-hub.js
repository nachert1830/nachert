/* ═══════════ Пульт владельца me/: сканер + кабинет + 3D с жестами + сайт на одной странице ═══════════
   1. Логика руки (me/pointer.js, синтетические руки): курсор в зеркале, щипок = нажатие в точке до смыкания пальцев,
      перетаскивание, разжал почти на месте — нажатие, две руки — зум, ладонь 1,5 с — «назад».
   2. Страница в браузере (функция сканера подменена): без кода владельца разделы не грузятся; студенческий код — отказ;
      код владельца — пульт открыт, сканер кабинета получил код; пример из кабинета появляется в «Моих чертежах» сбоку,
      оттуда открывается в 3D; рука (синтетические события) крутит 3D и нажимает вкладки; повторный вход — без кода;
      голограмма выгружается, когда с неё ушли (камера свободна); на телефоне нет горизонтальной прокрутки; без ошибок JS.
   node tests/me-hub.js — отдельно; в node tests/run.js — тот же прогон. */
const path = require('path'), ROOT = path.join(__dirname, '..');

async function logic() {
  const bad = [], B = (rule, msg) => bad.push({ name: 'Пульт (рука)', rule, msg: String(msg) });
  const { createPointer, pinchRatio } = await import(path.join(ROOT, 'me/pointer.js'));
  /* рука: запястье (0) и основание среднего (9) на расстоянии 0,1; кончик указательного (8) в (x, y); большой (4) — на gap от него */
  const hand = (x, y, gap, open) => { const lm = Array.from({ length: 21 }, () => ({ x: x, y: y + 0.12 }));
    lm[0] = { x, y: y + 0.2 }; lm[9] = { x, y: y + 0.1 }; lm[5] = { x: x - 0.02, y: y + 0.12 }; lm[13] = { x: x + 0.02, y: y + 0.12 }; lm[17] = { x: x + 0.04, y: y + 0.13 };
    lm[8] = { x, y }; lm[4] = { x: x + gap, y };
    const tip = open ? 0 : 0.17; lm[12] = { x, y: y + tip }; lm[16] = { x: x + 0.02, y: y + tip }; lm[20] = { x: x + 0.04, y: y + tip }; if (!open) lm[8] = { x, y }; return { lm }; };
  if (Math.abs(pinchRatio(hand(0.5, 0.5, 0.02).lm) - 0.2) > 1e-9) B('щипок: |4−8| / ладонь', pinchRatio(hand(0.5, 0.5, 0.02).lm));
  let P = createPointer({ smooth: 1 }), t = 0, ev = [];
  const run = (h, dt) => { t += dt || 33; const e = P.update(h, t); ev.push(...e); return e; };
  run([hand(0.3, 0.4, 0.08)]);
  const mv = ev.find(e => e.type === 'move'); if (!mv || Math.abs(mv.x - 0.7) > 1e-9 || Math.abs(mv.y - 0.4) > 1e-9) B('курсор в зеркале', JSON.stringify(mv));
  for (let i = 0; i < 6; i++) run([hand(0.3, 0.4, 0.08)]);
  ev = []; run([hand(0.28, 0.4, 0.01)]);   /* пальцы сомкнулись, кончик съехал */
  const dn = ev.find(e => e.type === 'down'); if (!dn || Math.abs(dn.x - 0.7) > 1e-9) B('цель щипка — где был курсор до смыкания', JSON.stringify(dn));
  ev = []; run([hand(0.28, 0.4, 0.2)]); const up = ev.find(e => e.type === 'up'); if (!up || !up.tap) B('разжал на месте — нажатие', JSON.stringify(ev));
  ev = []; run([hand(0.3, 0.4, 0.01)]); for (let i = 1; i <= 5; i++) run([hand(0.3 - i * 0.04, 0.4, 0.01)]); run([hand(0.1, 0.4, 0.2)]);
  const dr = ev.filter(e => e.type === 'drag'), u2 = ev.find(e => e.type === 'up');
  if (dr.length < 4 || !dr.every(e => e.dx > 0)) B('щипок и вести — перетаскивание вправо (в зеркале)', JSON.stringify(dr.slice(0, 2)));
  if (!u2 || u2.tap) B('после перетаскивания — не нажатие', JSON.stringify(u2));
  ev = []; run([hand(0.4, 0.5, 0.01), hand(0.6, 0.5, 0.01)]); run([hand(0.35, 0.5, 0.01), hand(0.65, 0.5, 0.01)]);
  const z = ev.find(e => e.type === 'zoom'); if (!z || !(z.k > 1.4 && z.k < 1.6)) B('две руки развели — зум > 1', JSON.stringify(z));
  ev = []; run([hand(0.5, 0.5, 0.01)]); if (ev.some(e => e.type === 'down')) B('после зума — только свежий щипок', JSON.stringify(ev));
  P = createPointer(); ev = []; t = 0; for (let i = 0; i < 60; i++) run([hand(0.5, 0.5, 0.15, true)], 33);
  if (ev.filter(e => e.type === 'back').length !== 1) B('ладонь 1,5 с — «назад» один раз', ev.filter(e => e.type === 'back').length);
  ev = []; run([]); if (ev.length) B('рука пропала — ничего не нажимаем', JSON.stringify(ev));
  return bad;
}

async function ui(browser, URL) {
  const bad = [], B = (rule, msg) => bad.push({ name: 'Пульт (страница)', rule, msg: String(msg) });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const OWNER = 'мой-код', calls = []; let legacy = false;   /* legacy — функция старой версии: про ?owner=1 не знает, верному коду отвечает 200 без owner */
  await ctx.route(/functions\.yandexcloud\.net/, r => { const q = r.request(), code = decodeURIComponent(q.headers()['x-scan-code'] || ''), own = /owner=1/.test(q.url()); calls.push(code);
    const st = code === OWNER ? 200 : code === 'виктория' ? (own && !legacy ? 403 : 200) : 401;
    r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(st === 200 ? { ok: true, codeOk: true, owner: code === OWNER, spent: 0.12, limit: 5 } : { ok: false, error: 'нет' }) }); });
  try {
    await page.goto(URL + 'me/'); await page.waitForTimeout(300);
    const src0 = await page.$$eval('iframe', a => a.map(f => f.getAttribute('src')).filter(Boolean));
    if (!(await page.isVisible('#lock')) || (await page.isVisible('#hub')) || src0.length) B('без кода — только вход, разделы не грузятся', src0.join(','));
    await page.fill('#code', 'виктория'); await page.click('#enter'); await page.waitForTimeout(300);
    if (await page.isVisible('#hub')) B('студенческий код — отказ', 'пульт открылся');
    if (!/владельца/.test(await page.textContent('#lockErr'))) B('студенческий код — понятный отказ', await page.textContent('#lockErr'));
    legacy = true; await page.click('#enter'); await page.waitForTimeout(300); legacy = false;
    if (await page.isVisible('#hub')) B('старая функция без проверки владельца: студенческий код — всё равно отказ', 'пульт открылся');
    await page.fill('#code', OWNER); await page.click('#enter'); await page.waitForSelector('#hub:not([hidden])', { timeout: 5000 });
    const lk = page.frameLocator('.pane[data-pane="lk"]');
    await lk.locator('.tab[data-tab="check"].on').waitFor({ timeout: 15000 }).catch(() => B('вкладка «Скан» кабинета открыта', 'нет'));
    if (await page.evaluate(() => localStorage.getItem('scanCode')) !== OWNER) B('сканер кабинета получил код владельца', 'нет');
    /* пример из кабинета → «Мои чертежи» сбоку → 3D */
    await lk.locator('#scDemo').click(); await page.waitForTimeout(500);
    await lk.locator('#dvBack').click().catch(() => {}); await page.waitForTimeout(300);
    await page.waitForSelector('#sheets [data-p="3d"]', { timeout: 5000 }).catch(() => B('лист из кабинета — в «Моих чертежах» пульта', 'нет'));
    await page.click('#sheets [data-p="3d"]'); await page.waitForTimeout(800);
    if (!(await lk.locator('#dv.on #p3d.on').count())) B('из пульта — сразу в 3D листа', 'не открылось');
    /* рука: щипок и вести по 3D — вращение без ошибок; нажатие щипком на вкладку «Сайт» */
    const cv = await page.evaluate(() => { const f = document.querySelector('.pane[data-pane="lk"]'), c = f.contentDocument.querySelector('#v3c'), r = c.getBoundingClientRect(), o = f.getBoundingClientRect();
      return { x: (o.left + r.left + r.width / 2) / innerWidth, y: (o.top + r.top + r.height / 2) / innerHeight }; });
    const shot0 = await lk.locator('#v3c').screenshot();
    await page.evaluate(c => { ME.act([{ type: 'down', x: c.x, y: c.y }]); for (let i = 1; i <= 8; i++) ME.act([{ type: 'drag', x: c.x + i * 0.02, y: c.y, dx: 0.02, dy: 0 }]); ME.act([{ type: 'up', x: c.x + 0.16, y: c.y, tap: false }]); }, cv);
    await page.waitForTimeout(300);
    if (Buffer.compare(shot0, await lk.locator('#v3c').screenshot()) === 0) B('рука крутит 3D кабинета', 'картинка не изменилась');
    const tb = await page.$eval('.tab[data-go="site"]', b => { const r = b.getBoundingClientRect(); return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }; });
    await page.evaluate(c => ME.act([{ type: 'down', x: c.x, y: c.y }, { type: 'up', x: c.x, y: c.y, tap: true }]), tb);
    if (await page.evaluate(() => ME.cur) !== 'site') B('щипок по вкладке — нажатие', await page.evaluate(() => ME.cur));
    /* голограмма: открылась по Alt+3, ушли — выгружена */
    await page.keyboard.press('Alt+3'); await page.waitForTimeout(300);
    if (!/hands/.test(await page.$eval('.pane[data-pane="holo"]', f => f.getAttribute('src')))) B('Alt+3 — голограмма', 'не загрузилась');
    await page.keyboard.press('Alt+1'); await page.waitForTimeout(200);
    if (await page.$eval('.pane[data-pane="holo"]', f => f.getAttribute('src')) !== 'about:blank') B('ушли с голограммы — выгружена (камера свободна)', 'осталась');
    /* «Рядом»: два раздела */
    await page.click('#splitBtn'); await page.waitForTimeout(200);
    if ((await page.$$('.pane.on, .pane.prev')).length < 2 || !(await page.$('.panes.split'))) B('«Рядом» — два раздела', 'один');
    /* повторный вход — код уже есть, сервер проверяет снова */
    const n0 = calls.length; await page.reload(); await page.waitForSelector('#hub:not([hidden])', { timeout: 5000 }).catch(() => B('повторный вход без ввода кода', 'нет'));
    if (calls.length <= n0) B('при каждом входе код проверяет сервер', 'запроса не было');
    /* телефон */
    await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(300);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (ov > 0) B('телефон: без горизонтальной прокрутки', ov + ' px');
    /* выйти — код забыт */
    await page.evaluate(() => ME.side(false)); await page.setViewportSize({ width: 1280, height: 820 });
    await page.click('#lockBtn'); await page.waitForTimeout(300);
    if (await page.evaluate(() => localStorage.getItem('ownerCode')) || !(await page.isVisible('#lock'))) B('«Выйти» — код забыт', 'остался');
  } catch (e) { B('прогон', e.message); }
  errs.forEach(m => B('ошибка JS', m));
  await ctx.close(); return bad;
}

async function runMe(browser, URL) { return (await logic()).concat(await ui(browser, URL)); }
module.exports = { runMe, logic };

if (require.main === module) { const http = require('http'), fs = require('fs');
  const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
  const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; const p = path.join(ROOT, f);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); })
    .listen(0, '127.0.0.1', async () => { const br = await chromium.launch(); const bad = await runMe(br, 'http://127.0.0.1:' + srv.address().port + '/'); await br.close(); srv.close();
      bad.forEach(b => console.log('✗ ' + b.name + ' · ' + b.rule + ': ' + b.msg)); console.log(bad.length ? 'Замечаний: ' + bad.length : 'Пульт: ошибок нет'); process.exit(bad.length ? 1 : 0); }); }
