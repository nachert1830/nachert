/* ═══════════ Копия сайта /new/ (новый дизайн): открывается без ошибок JS ═══════════
   Главная (новый дизайн), экран «ДЗ» колодой, вариант ИГ ДЗ №4 (чертёж и окно наставника), вариант начерта, Лука на главной
   (здоровается, открывается поверх главной, «Поиграй со мной») и площадка /new/luka/; телефон и компьютер;
   без горизонтальной прокрутки. Сеть наружу закрыта: API кабинета отвечает 401 (гость).
   node tests/new-copy.js — отдельно. */
const http = require('http'), fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
async function run() {
  const bad = [], B = (rule, msg) => bad.push({ name: 'Копия /new/', rule, msg: String(msg).slice(0, 400) });
  const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; const p = path.join(ROOT, f);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
  await new Promise(res => srv.listen(0, '127.0.0.1', res)); const base = 'http://127.0.0.1:' + srv.address().port;
  const { chromium, devices } = require('playwright'), br = await chromium.launch();
  try {
    for (const dev of [{ name: 'телефон', o: devices['iPhone 13'] }, { name: 'компьютер', o: { viewport: { width: 1366, height: 900 } } }]) {
      const ctx = await br.newContext(dev.o);
      await ctx.route(u => !u.href.startsWith(base), r => /apigw\.yandexcloud\.net/.test(r.request().url())
        ? r.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '{"error":"нужен вход"}' }) : r.abort());
      await ctx.addInitScript(() => { try { localStorage.setItem('nch-preview-ok', '1'); } catch (e) {} });
      const page = await ctx.newPage(), errs = [];
      page.on('pageerror', e => errs.push(e.message));
      const check = async (hash, sel, what) => {
        await page.goto(base + '/new/' + hash, { waitUntil: 'load' }); await page.waitForTimeout(1500);
        if (sel && !(await page.locator(sel + ' >> visible=true').count())) B(dev.name + ': ' + what, 'не видно ' + sel);
        const w = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (w > 1) B(dev.name + ': ' + what + ' — без горизонтальной прокрутки', w + ' px');
      };
      await check('', '#ns-gate[hidden], body', 'главная');
      if (await page.locator('#ns-gate').isVisible().catch(() => false)) B(dev.name + ': занавеска', 'видна после кода');
      await check('#/dz', '#nd-stage', 'экран «ДЗ» колодой');
      await check('#/ig4/7', 'svg', 'ИГ ДЗ №4, вариант 7');
      if (await page.locator('.tu-fab >> visible=true').count()) B(dev.name + ': наставник при окне согласия на статистику', 'кнопка видна и закрывает «Согласен»');
      await check('#/ng2/17', 'svg', 'начерт ДЗ №2, вариант 17');
      if (await page.locator('.tu-fab >> visible=true').count()) B(dev.name + ': Лука не поверх окна согласия на статистику (начерт)', 'кнопка видна на #/ng2/17');
      await page.evaluate(() => { const b = document.querySelector('.ckn [data-ck="n"]'); if (b) b.click(); });
      await check('#/ig4/7', '.tu-fab', 'ИГ ДЗ №4 — кнопка наставника (окно согласия закрыто)');
      /* Лука на главной: здоровается с новичком облачком, открывается поверх главной; гостю — «Войди» и «Поиграй со мной» → площадка /new/luka/ */
      await page.evaluate(() => { try { localStorage.removeItem('tu_hi'); } catch (e) {} });
      await check('', null, 'главная — Лука здоровается'); await page.waitForTimeout(4700);
      if (!(await page.locator('.tu-fab .tu-fb >> visible=true').count())) B(dev.name + ': Лука здоровается на главной', 'нет облачка у кнопки');
      await page.click('.tu-fab').catch(e => B(dev.name + ': кнопка Луки на главной нажимается', e.message.split('\n')[0]));
      await page.waitForSelector('.tu:not([hidden]) .tu-gate', { timeout: 5000 }).catch(() => B(dev.name + ': окно Луки на главной', 'не открылось'));
      if (!(await page.locator('.tu .tu-play >> visible=true').count())) B(dev.name + ': «Поиграй со мной» в окне Луки', 'нет ссылки');
      else { await page.click('.tu .tu-play'); await page.waitForURL(/\/new\/luka\/$/, { timeout: 5000 }).catch(() => B(dev.name + ': «Поиграй со мной» — площадка', page.url())); }
      if (!/\/new\/luka\/$/.test(page.url())) await page.goto(base + '/new/luka/', { waitUntil: 'load' });
      await page.waitForSelector('#stage .mc-body', { timeout: 8000 }).catch(() => B(dev.name + ': площадка с Лукой', 'нет Луки на сцене'));
      const n0 = await page.textContent('#sec-n').catch(() => '');
      const bb = await page.evaluate(() => { const r = document.querySelector('#stage .mc-body').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - r.height * .23 }; });
      await page.mouse.click(bb.x, bb.y); await page.waitForTimeout(700);
      const n1 = await page.textContent('#sec-n').catch(() => '');
      if (!/^1 из/.test(n1)) B(dev.name + ': касание живота — секрет «Щекотка»', n0 + ' → ' + n1);
      await page.fill('#say-in', 'Привет'); await page.press('#say-in', 'Enter'); await page.waitForTimeout(400);
      if (!/Привет/.test(await page.textContent('#bub').catch(() => ''))) B(dev.name + ': «Напиши — Лука повторит»', 'нет облачка');
      if (!(await page.locator('#t-mic >> visible=true').count())) B(dev.name + ': кнопка «Повтори» (микрофон)', 'не видна');
      { const w = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (w > 1) B(dev.name + ': площадка — без горизонтальной прокрутки', w + ' px'); }
      if (errs.length) B(dev.name + ': ошибки JS', errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally { await br.close(); srv.close(); }
  return bad;
}
module.exports = { run };
if (require.main === module) run().then(b => { b.forEach(x => console.log('✖', x.rule, '—', x.msg)); console.log(b.length ? 'Копия /new/: замечаний ' + b.length : 'Копия /new/: ошибок нет'); process.exit(b.length ? 1 : 0); });
