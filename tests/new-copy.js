/* ═══════════ Копия сайта /new/ (новый дизайн): открывается без ошибок JS ═══════════
   Главная (новый дизайн), экран «ДЗ» колодой, вариант ИГ ДЗ №4 (чертёж и окно наставника), вариант начерта, методичка задания
   (главы, свой тип, «Сразу решение», галочки и защита запоминаются, выбор варианта); телефон и компьютер;
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
      if (await page.locator('.tu-fab >> visible=true').count()) B(dev.name + ': наставник — только на ИГ ДЗ №4', 'кнопка видна на #/ng2/17');
      await page.evaluate(() => { const b = document.querySelector('.ckn [data-ck="n"]'); if (b) b.click(); });
      /* наставник в копии пока выключен (решение автора) — кнопки нет нигде */
      await check('#/ig4/7', 'svg', 'ИГ ДЗ №4 (окно согласия закрыто)');
      if (await page.locator('.tu-fab').count()) B(dev.name + ': наставник выключен', 'кнопка есть');
      /* методичка задания (new/method.js): страница ДЗ — методичка, решение своего варианта — в одно касание */
      await page.evaluate(() => { localStorage.removeItem('nch_mk'); dzSetVar(13); });
      await check('#/ng4', '.mk-doors', 'методичка ДЗ №4');
      { const r = await page.evaluate(() => { const d = DZR.get('ng4'), t = DZR.typeOf('ng4', 13);
          return { ch: [...document.querySelectorAll('.mk-ch')].map(x => x.dataset.k).join(','), sol: [...document.querySelectorAll('a.mk-door.b, .mk-dock a.mk-sol')].map(a => a.getAttribute('href')),
            steps: document.querySelectorAll('#mk-algo .mk-algo > li').length, want: d.method.types[t.code].plan.length,
            q: document.querySelectorAll('#mk-def .mk-dall details').length, wq: (d.method.defense || []).concat(d.method.types[t.code].defense || []).length }; });
        if (r.ch !== 'task,prep,idea,algo,ex,var,sheet,check,err,def' && r.ch !== 'task,prep,idea,algo,ex,var,sheet,err,def') B(dev.name + ': главы методички', r.ch);
        if (!r.sol.length || r.sol.some(h => h !== '#/ng4/13')) B(dev.name + ': «Сразу решение» ведёт не на свой вариант', r.sol.join(' '));
        if (r.steps !== r.want) B(dev.name + ': алгоритм — не только своего типа', r.steps + ' шагов, у типа ' + r.want);
        if (r.q !== r.wq) B(dev.name + ': защита — не все вопросы', r.q + ' из ' + r.wq); }
      /* шаг алгоритма отмечается и помнится; карточка защиты: «показать ответ» → «знал» */
      await page.evaluate(() => { document.querySelector('#mk-algo .mk-chk input').click(); document.querySelector('#mk-def [data-mkd=show]').click(); document.querySelector('#mk-def [data-mkd=yes]').click(); });
      await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1200);
      { const r = await page.evaluate(() => ({ on: !!document.querySelector('#mk-algo .mk-algo > li.done'), y: document.querySelectorAll('#mk-def .mk-dots i.y').length }));
        if (!r.on) B(dev.name + ': отметка шага алгоритма не запомнилась', ''); if (r.y !== 1) B(dev.name + ': ответ «знал» в защите не запомнился', r.y); }
      /* #/ng4/how — сразу глава «Алгоритм» */
      await page.goto(base + '/new/#/ng4/how', { waitUntil: 'load' }); await page.waitForTimeout(1500);
      { const t = await page.evaluate(() => Math.round(document.querySelector('#mk-algo').getBoundingClientRect().top)); if (t < -20 || t > 140) B(dev.name + ': #/ng4/how не открыл главу «Алгоритм»', 'верх главы ' + t + ' px'); }
      /* без варианта: «Сразу решение» просит выбрать номер; номер запоминается, методичка — под тип */
      await page.evaluate(() => dzSetVar(0)); await check('#/ng5', '.mk-doors', 'методичка ДЗ №5 без варианта');
      await page.evaluate(() => { document.querySelector('.mk-door.b[data-mkpick]').click(); document.querySelector('.mk-pickbox [data-mkv="12"]').click(); });
      await page.waitForTimeout(400);
      { const r = await page.evaluate(() => ({ v: dzVar(), h: (document.querySelector('a.mk-door.b') || { getAttribute: () => '' }).getAttribute('href') }));
        if (r.v !== 12 || r.h !== '#/ng5/12') B(dev.name + ': выбор варианта в методичке', JSON.stringify(r)); }
      /* разбор варианта начерта — только чертёж по шагам (решение автора): нет вкладок, плашки методички, «Смотрю / Решаю сам»,
         кнопки «▶ Поверхность»; «Не сходится с условием?» — внизу пояснения; колода «ДЗ» — методичка первой */
      await check('#/ng5/12', '.pl-paper svg', 'разбор варианта начерта');
      { const r = await page.evaluate(() => ({ pills: !!document.querySelector('.dzx-pills'), strip: !!document.querySelector('.mks'), modes: !!document.querySelector('.pl-modes'),
          form: !!document.querySelector('[data-z="form"]'), crep: !!document.querySelector('.pl-scroll .pl-foot .crep'), deck: window.dzDeckGo ? window.dzDeckGo(DZR.get('ng5')) : '' }));
        if (r.pills || r.strip || r.modes || r.form) B(dev.name + ': разбор варианта — лишнее над чертежом', JSON.stringify(r).slice(0, 200));
        if (!r.crep) B(dev.name + ': «Не сходится с условием?» внизу пояснения', 'нет');
        if (!/class="go" href="#\/ng5"/.test(r.deck) || !/href="#\/ng5\/12"/.test(r.deck)) B(dev.name + ': колода «ДЗ» — кнопки методички и решения', r.deck.slice(0, 200)); }
      /* Лука — ИИ-агент на чертеже (new/luka.js): на ДЗ №4–5 и задачах тетради с 68-й; облачко с вопросами по шагу; разборщик своего вопроса */
      await check('#/ng4/13', '.lk-b', 'Лука на ДЗ №4');
      { const r = await page.evaluate(async () => { document.querySelector('.pl-main').click(); await new Promise(f => setTimeout(f, 300)); document.querySelector('.pl-main').click(); await new Promise(f => setTimeout(f, 300));
          document.querySelector('.lk-b').click(); await new Promise(f => setTimeout(f, 200)); const w = document.querySelector('.lk-w'), q = w ? w.querySelectorAll('.lk-q button').length : 0;
          const inp = w && w.querySelector('.lk-in input'); if (inp) { inp.value = 'что такое линия связи'; w.querySelector('.lk-in').requestSubmit(); } await new Promise(f => setTimeout(f, 700));
          return { w: !!w, q, term: /Линия связи/.test((document.querySelector('.lk-say') || {}).textContent || '') }; });
        if (!r.w || r.q < 2) B(dev.name + ': Лука — облачко с вопросами по шагу', JSON.stringify(r)); if (!r.term) B(dev.name + ': Лука — «что такое линия связи» из словаря', JSON.stringify(r)); }
      await check('#/ng/tasks/70', '.lk-b', 'Лука на задаче 70 тетради');
      await check('#/ng/tasks/12', '.pl-paper', 'задача 12 тетради');
      if (await page.locator('.lk-b').count()) B(dev.name + ': Лука — только с 68-й задачи', 'есть на 12-й');
      await check('#/ig4', '.mk-doors', 'методичка ИГ ДЗ №4');
      await check('#/ig2', '.mk-doors', 'методичка ИГ ДЗ №2 (без методики)');
      await check('', '.mkh', 'главная — «Сдаётся скоро»');
      if (errs.length) B(dev.name + ': ошибки JS', errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally { await br.close(); srv.close(); }
  return bad;
}
module.exports = { run };
if (require.main === module) run().then(b => { b.forEach(x => console.log('✖', x.rule, '—', x.msg)); console.log(b.length ? 'Копия /new/: замечаний ' + b.length : 'Копия /new/: ошибок нет'); process.exit(b.length ? 1 : 0); });
