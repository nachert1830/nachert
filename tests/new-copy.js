/* ═══════════ Копия сайта /new/ (новый дизайн): открывается без ошибок JS ═══════════
   Главная (новый дизайн), экран «ДЗ» колодой, вариант ИГ ДЗ №4 (чертёж и окно наставника), вариант начерта; телефон и компьютер;
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
      await check('', '#sv-gate[hidden], body', 'главная');
      if (await page.locator('#sv-gate').isVisible().catch(() => false)) B(dev.name + ': занавеска', 'видна после кода');
      await check('#/dz', '#nd-stage', 'экран «ДЗ» колодой');
      await check('#/ig4/7', 'svg', 'ИГ ДЗ №4, вариант 7');
      if (await page.locator('.tu-fab >> visible=true').count()) B(dev.name + ': наставник при окне согласия на статистику', 'кнопка видна и закрывает «Согласен»');
      await check('#/ng2/17', 'svg', 'начерт ДЗ №2, вариант 17');
      if (await page.locator('.tu-fab >> visible=true').count()) B(dev.name + ': наставник — только на ИГ ДЗ №4', 'кнопка видна на #/ng2/17');
      await page.evaluate(() => { const b = document.querySelector('.ckn [data-ck="n"]'); if (b) b.click(); });
      await check('#/ig4/7', '.tu-fab', 'ИГ ДЗ №4 — кнопка наставника (окно согласия закрыто)');
      if (errs.length) B(dev.name + ': ошибки JS', errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally { await br.close(); srv.close(); }
  return bad;
}
module.exports = { run };
if (require.main === module) run().then(b => { b.forEach(x => console.log('✖', x.rule, '—', x.msg)); console.log(b.length ? 'Копия /new/: замечаний ' + b.length : 'Копия /new/: ошибок нет'); process.exit(b.length ? 1 : 0); });
