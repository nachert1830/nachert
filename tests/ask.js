/* ═══════════ «Спроси автора»: вопросы и ответы внутри сайта (lk/ask.js + пульт me/ + API кабинета /api/ask*) ═══════════
   Настоящий сервер кабинета (server/lib/app.js, база в памяти) и сайт на своих адресах (как GitHub Pages + облако, CORS):
   1) гость открыл ДЗ, нажал «Спросить» в шапке — форма помнит, про какую страницу вопрос; кнопка «Войти и отправить»;
   2) вошёл — черновик на месте; вопрос с фото уходит, открывается переписка;
   3) пульт владельца: число ждущих на вкладке «Вопросы», имя ученика, страница, фото; ответ — ждущих 0;
   4) ученик: в шапке — число новых ответов, в «Моих вопросах» — «Ответ», в переписке — ответ автора;
   5) телефон: без горизонтальной прокрутки, шапка помещается; главная — строка «Спроси автора»; без ошибок JS.
   node tests/ask.js — отдельно; в node tests/run.js — тот же прогон. */
const http = require('http'), fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
const { createApp } = require(ROOT + '/server/lib/app'), { memoryStore } = require(ROOT + '/server/lib/store/memory'), { botClient } = require(ROOT + '/server/lib/telegram'), { fromEvent } = require(ROOT + '/server/lib/http');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webmanifest': 'application/json', '.wasm': 'application/wasm' };
const listen = srv => new Promise(res => srv.listen(0, '127.0.0.1', () => res('http://127.0.0.1:' + srv.address().port)));

async function runAsk(browser) {
  const bad = [], B = (rule, msg) => bad.push({ name: 'Спроси автора', rule, msg: String(msg) }), errs = [];
  const store = memoryStore(null); let API = '', SITE = '';
  const apiSrv = http.createServer((q, r) => { let body = ''; q.on('data', c => body += c); q.on('end', async () => { const u = new URL(q.url, 'http://x'), headers = {};
    for (let i = 0; i < q.rawHeaders.length; i += 2) headers[q.rawHeaders[i]] = q.rawHeaders[i + 1];
    const res = await app.handle(fromEvent({ httpMethod: q.method, path: u.pathname, url: u.pathname + u.search, headers, queryStringParameters: Object.fromEntries(u.searchParams), body, isBase64Encoded: false, requestContext: { identity: { sourceIp: '127.0.0.1' } } }));
    r.writeHead(res.statusCode, res.headers); r.end(res.body); }); });
  const siteSrv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
    if (f === '/lk/config.js') { r.writeHead(200, { 'Content-Type': T['.js'] }); return r.end("window.CLUB_API='" + API + "';"); }
    if (f === '/lk/scan/config.js') { r.writeHead(200, { 'Content-Type': T['.js'] }); return r.end("self.SCAN_API='" + API + "/scan';"); }
    const p = path.join(ROOT, f); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    let b = fs.readFileSync(p); if (f === '/index.html') b = Buffer.from(b.toString().replace("connect-src 'self'", "connect-src 'self' " + API));   /* в облаке — *.apigw.yandexcloud.net */
    r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(b); });
  API = await listen(apiSrv); SITE = await listen(siteSrv);
  const cfg = { dev: true, origin: API, secure: false, botToken: '1:x', botName: 'b', webhookSecret: 's', adminTg: ['1000001'], mainUrl: SITE, week1: '', yandex: { clientId: '', secret: '' }, adminYa: [], fronts: [API, SITE], frontUrl: SITE + '/lk/', openSignup: true };
  const app = createApp({ cfg, store, log: { log() {}, error() {} }, bot: botClient({ dev: true, outbox: [] }) });
  /* сессии — как после входа (служебный вход эмуляции), сам вход проверяют server/test/*.test.js */
  async function session(id, name) { const act = await app.onUpdate({ message: { from: { id, first_name: name }, chat: { id }, text: '/start login' } });
    const t = act.reply_markup.inline_keyboard[0][0].url.split('#/tg/')[1];
    const res = await app.handle({ method: 'POST', path: '/api/auth/bot/redeem', query: {}, headers: { origin: SITE, 'content-type': 'application/json' }, body: JSON.stringify({ token: t, confirm: true, consent: { terms: true, pd: true } }), ip: '127.0.0.1', cookies: {} });
    return JSON.parse(res.body).session; }
  const watch = (p, who) => { p.on('pageerror', e => errs.push(who + ': ' + e.message)); };
  const ctxs = [];
  const page = async (o, who) => { const c = await browser.newContext(o); ctxs.push(c); await c.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort()); const p = await c.newPage(); watch(p, who); return p; };
  try {
    const own = await session(1000001, 'Автор'), st = await session(2002, 'Аня');
    /* 1) гость */
    const pg = await page({ viewport: { width: 1280, height: 860 } }, 'сайт');
    await pg.goto(SITE + '/#/ng3/8'); await pg.waitForSelector('#akBtn', { timeout: 15000 }); await pg.waitForTimeout(500);
    await pg.click('#akBtn'); await pg.waitForSelector('.ak-box');
    const ctxT = await pg.textContent('.ak-ctx').catch(() => ''); if (!/вариант 8|ng3/.test(ctxT)) B('форма помнит страницу вопроса', ctxT);
    if (!/Войти и отправить/.test(await pg.textContent('.ak-send'))) B('гость: «Войти и отправить»', await pg.textContent('.ak-send'));
    await pg.fill('#akT', 'Не понимаю, как найти натуральную величину ребра SA');
    await pg.click('.ak-send'); await pg.waitForURL(/\/lk\//, { timeout: 8000 }).catch(() => B('гость: отправка ведёт на вход', pg.url()));
    await pg.waitForLoadState('load'); await pg.waitForSelector('#lSheet.on', { timeout: 8000 }).catch(() => B('кабинет сразу открывает вход', 'нет'));
    if (await pg.evaluate(() => localStorage.getItem('lk_ret')) !== '/#/ask') B('после входа — назад к вопросу', await pg.evaluate(() => localStorage.getItem('lk_ret')));
    /* 2) вошёл: черновик уходит сам */
    await pg.evaluate(t => { localStorage.setItem('lk_tok', t); localStorage.removeItem('lk_ret'); }, st);
    await pg.goto(SITE + '/#/ask'); await pg.waitForSelector('.ak-chat .ak-m', { timeout: 10000 }).catch(() => B('после входа черновик отправлен сам', 'переписка не открылась'));
    if (!/натуральную величину/.test(await pg.textContent('[data-tt]').catch(() => ''))) B('заголовок переписки — первая строка вопроса', await pg.textContent('[data-tt]').catch(() => ''));
    await pg.fill('#akT2', 'Вот мой лист'); await pg.setInputFiles('#view .ak-att input', path.join(ROOT, 'og.jpg')); await pg.waitForSelector('.ak-pv img', { timeout: 5000 });
    await pg.click('#view [data-c2] .ak-send'); await pg.waitForSelector('.ak-ph img', { timeout: 8000 }).catch(() => B('фото в переписке', 'нет'));
    /* 3) пульт */
    const me = await page({ viewport: { width: 1280, height: 860 } }, 'пульт');
    await me.route(/\/scan\?owner=1/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, owner: true }) }));
    await me.goto(SITE + '/me/'); await me.evaluate(t => { localStorage.setItem('lk_tok', t); localStorage.setItem('ownerCode', 'код'); }, own);
    await me.goto(SITE + '/me/#ask'); await me.reload();
    await me.waitForSelector('#askBadge:not([hidden])', { timeout: 10000 }).catch(() => B('пульт: число ждущих на вкладке «Вопросы»', 'нет'));
    await me.waitForSelector('.qa-it', { timeout: 8000 }); await me.click('.qa-it'); await me.waitForSelector('#qaTxt');
    await me.waitForSelector('#qaMsgs img[src^="data:"]', { timeout: 5000 }).catch(() => B('пульт: фото ученика видно', 'нет'));
    const who = await me.textContent('.qa-hd .who'); if (!/Аня/.test(who) || !/вариант 8/.test(who)) B('пульт: кто и откуда спросил', who);
    await me.fill('#qaTxt', 'Замени π₂ на π₄ ∥ S′A′ — на π₄ ребро в натуральную величину.'); await me.click('#qaCp [type=submit]'); await me.waitForTimeout(700);
    if (!(await me.$('#askBadge[hidden]'))) B('пульт: после ответа ждущих нет', await me.textContent('#askBadge'));
    /* 4) ученик видит ответ */
    await pg.goto(SITE + '/#/ng/rk2'); await pg.waitForTimeout(300); await pg.evaluate(() => ASK.refresh());
    if (!/1/.test(await pg.textContent('#akBtn'))) B('шапка: число новых ответов', await pg.textContent('#akBtn'));
    await pg.click('#akBtn'); await pg.waitForSelector('.ak-it.new', { timeout: 5000 }).catch(() => B('«Мои вопросы»: пометка «Ответ»', 'нет'));
    await pg.click('.ak-it'); await pg.waitForSelector('.ak-m.a', { timeout: 8000 }).catch(() => B('переписка: ответ автора', 'нет'));
    if (!/π₄/.test(await pg.textContent('.ak-m.a .ak-bb').catch(() => ''))) B('ответ автора — текстом', 'нет');
    await pg.goto(SITE + '/#/'); await pg.waitForTimeout(300); if (/\d/.test(await pg.textContent('#akBtn'))) B('прочитал ответ — число пропало', await pg.textContent('#akBtn'));
    /* 5) телефон */
    const ph = await page({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }, 'телефон');
    for (const h of ['#/ask', '#/']) { await ph.goto(SITE + '/' + h); await ph.waitForSelector(h === '#/' ? '.akh' : '.ak-box', { timeout: 10000 }).catch(() => B('телефон ' + h, 'не отрисовалось')); await ph.waitForTimeout(300);
      const o = await ph.evaluate(() => [document.documentElement.scrollWidth - innerWidth, (h => h.scrollWidth - h.clientWidth)(document.querySelector('#hdr .hin'))]);
      if (o[0] > 0 || o[1] > 0) B('телефон ' + h + ': без прокрутки вбок, шапка помещается', JSON.stringify(o)); }
  } catch (e) { B('прогон', e.message); }
  errs.forEach(m => B('ошибка JS', m));
  for (const c of ctxs) await c.close().catch(() => {}); apiSrv.close(); siteSrv.close();
  return bad;
}
module.exports = { runAsk };

if (require.main === module) { let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
  (async () => { const br = await chromium.launch(); const bad = await runAsk(br); await br.close();
    bad.forEach(b => console.log('✗ ' + b.name + ' · ' + b.rule + ': ' + b.msg)); console.log(bad.length ? 'Замечаний: ' + bad.length : 'Спроси автора: ошибок нет'); process.exit(bad.length ? 1 : 0); })(); }
