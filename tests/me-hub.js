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
    if (await page.evaluate(() => ME.cur) !== 'scan' || await page.$('.panes.split')) B('по умолчанию — сканер на весь экран', await page.evaluate(() => ME.cur));
    if (await page.evaluate(() => localStorage.getItem('scanCode')) !== OWNER) B('сканер кабинета получил код владельца', 'нет');
    /* пользователи: без сессии кабинета — подсказка войти; с сессией админа — счётчик из /api/admin/live */
    await page.evaluate(() => ME.side(true)); await page.waitForTimeout(200);
    if (!/войдите/i.test(await page.textContent('#users'))) B('пользователи без входа в кабинет — подсказка', await page.textContent('#users'));
    await ctx.route(/apigw\.yandexcloud\.net\/api\/admin\/live/, r => r.fulfill({ status: /Bearer adm/.test(r.request().headers().authorization || '') ? 200 : 403, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization' },
      body: JSON.stringify({ online: [{ name: 'Аня', group: 'ИУ5-11Б' }], kpi: { total: 42, online: 1, today: 5, week: 17, newToday: 2 } }) }));
    await page.evaluate(() => { localStorage.setItem('lk_tok', 'adm'); return ME.renderUsers(); });
    { const t = await page.textContent('#users'); if (!/всего:\s*42/.test(t) || !/онлайн:\s*1/.test(t) || !/Аня/.test(t)) B('пульт показывает, сколько авторизованных', t); }
    await page.evaluate(() => { localStorage.removeItem('lk_tok'); });
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
    { const g = await page.evaluate(() => { const f = document.querySelector('.pane[data-pane="holo"]').getBoundingClientRect(); return { w: f.width, side: getComputedStyle(document.getElementById('side')).display }; });
      if (g.w < 1280 - 2 || g.side !== 'none') B('голограмма — на весь экран, без боковой панели', JSON.stringify(g)); }
    await page.keyboard.press('Alt+1'); await page.waitForTimeout(200);
    if (await page.$eval('.pane[data-pane="holo"]', f => f.getAttribute('src')) !== 'about:blank') B('ушли с голограммы — выгружена (камера свободна)', 'осталась');
    /* «Отчёты» (Alt 6): карточки со ссылками на приватные документы, открываются в новой вкладке */
    await page.keyboard.press('Alt+6'); await page.waitForTimeout(200);
    { const n = await page.$$eval('.pane.rep.on .rep-it', a => a.filter(x => /^https:\/\/claude\.ai\//.test(x.href) && x.target === '_blank' && /noopener/.test(x.rel)).length);
      if (!n) B('«Отчёты» — список ссылок на приватные документы', 'пусто'); }
    await page.keyboard.press('Alt+1'); await page.waitForTimeout(200);
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

async function healthLogic() {
  const bad = [], B = (rule, msg) => bad.push({ name: 'Пульт (здоровье)', rule, msg: String(msg) });
  let H; try { H = await import(path.join(ROOT, 'me/health.js')); } catch (e) { B('импорт me/health.js', e.message); return bad; }
  const { REPO, WORKFLOW, LABEL, pickRuns, runningRun, pickIssues, fmtDur, fmtWhen } = H;
  if (!/^[\w.-]+\/[\w.-]+$/.test(REPO)) B('REPO — «владелец/репо»', REPO);
  if (WORKFLOW !== 'check.yml' || LABEL !== 'main-красный') B('WORKFLOW и LABEL', WORKFLOW + ' ' + LABEL);
  const T0 = Date.parse('2026-10-18T10:00:00Z');
  const run = (id, o) => Object.assign({ id, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success',
    run_started_at: new Date(T0 - id * 3600e3).toISOString(), updated_at: new Date(T0 - id * 3600e3 + id * 60e3 + 12e3).toISOString(),
    html_url: 'https://github.com/o/r/actions/runs/' + id, head_sha: 'abcdef0123456789' + id, display_title: 'Коммит ' + id + '\nподробности' }, o);
  const runs = [run(1, { event: 'pull_request' }), run(2, { conclusion: 'cancelled' }), run(3, { status: 'in_progress', conclusion: null }),
    run(4), run(5, { head_branch: 'dev' }), run(6, { conclusion: 'failure' }), run(7), run(8), run(9)];
  const got = pickRuns(runs);
  if (got.map(r => r.id).join() !== '4,6,7,8,9') B('pickRuns: 5 нужных по порядку', got.map(r => r.id).join());
  const r6 = got.find(r => r.id === 6) || {};
  if (r6.ok !== false || got[0].ok !== true) B('pickRuns: ok', JSON.stringify(got.map(r => r.ok)));
  if (r6.ms !== 6 * 60e3 + 12e3) B('pickRuns: ms = updated_at − начало', r6.ms);
  if (r6.sha !== 'abcdef0' || r6.title !== 'Коммит 6' || r6.url !== 'https://github.com/o/r/actions/runs/6' || r6.at !== runs[5].run_started_at) B('pickRuns: sha, title, url, at', JSON.stringify(r6));
  const c = pickRuns([run(1, { run_started_at: undefined, created_at: new Date(T0).toISOString(), updated_at: new Date(T0 + 5e3).toISOString(), display_title: undefined, head_commit: { message: 'Из коммита\nещё' } })])[0] || {};
  if (c.ms !== 5000 || c.title !== 'Из коммита') B('pickRuns: created_at и head_commit', JSON.stringify(c));
  if (pickRuns(runs, 2).length !== 2) B('pickRuns: n', pickRuns(runs, 2).length);
  if (!Array.isArray(pickRuns(undefined)) || pickRuns(undefined).length) B('pickRuns(undefined) — []', JSON.stringify(pickRuns(undefined)));
  const rr = runningRun(runs);
  if (!rr || rr.url !== runs[2].html_url || rr.at !== runs[2].run_started_at) B('runningRun: незавершённый', JSON.stringify(rr));
  if (runningRun(runs.filter(r => r.status === 'completed')) !== null || runningRun(undefined) !== null) B('runningRun: нет — null', 'не null');
  const iss = pickIssues([{ number: 7, title: 'main красный', html_url: 'https://github.com/o/r/issues/7' }, { number: 8, title: 'PR', html_url: 'u', pull_request: {} }]);
  if (JSON.stringify(iss) !== JSON.stringify([{ n: 7, title: 'main красный', url: 'https://github.com/o/r/issues/7' }])) B('pickIssues', JSON.stringify(iss));
  if (pickIssues(undefined).length !== 0) B('pickIssues(undefined) — []', 'не пусто');
  [[492000, '8 мин 12 с'], [45000, '45 с'], [3900000, '1 ч 5 мин'], [NaN, '—'], [-1, '—']].forEach(([ms, s]) => { if (fmtDur(ms) !== s) B('fmtDur(' + ms + ')', fmtDur(ms)); });
  const now = new Date(2026, 9, 18, 15, 30), today = new Date(2026, 9, 18, 9, 5).toISOString(), past = new Date(2026, 8, 3, 14, 7).toISOString();
  if (fmtWhen(today, now) !== '09:05') B('fmtWhen: сегодня — ЧЧ:ММ', fmtWhen(today, now));
  if (fmtWhen(past, now) !== '3.09 14:07') B('fmtWhen: другой день — Д.ММ ЧЧ:ММ', fmtWhen(past, now));
  // loadHealth с подменным fetch
  const { loadHealth, healthHtml } = H;
  if (typeof loadHealth !== 'function' || typeof healthHtml !== 'function') { B('экспорт loadHealth/healthHtml', typeof loadHealth + ' ' + typeof healthHtml); return bad; }
  const resp = (status, body, hdr = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: k => (k.toLowerCase() in hdr ? hdr[k.toLowerCase()] : null) }, json: async () => body });
  const calls = [], fake = (rs, is) => async (u, o) => { calls.push([u, o]); return /\/issues\?/.test(u) ? is : rs; };
  const okIss = [{ number: 7, title: 'main красный', html_url: 'https://github.com/o/r/issues/7' }, { number: 8, title: 'PR', html_url: 'u', pull_request: {} }];
  try {
    const d = await loadHealth(fake(resp(200, { workflow_runs: runs }), resp(200, okIss)), 'o/r');
    const urls = calls.map(c => c[0]);
    if (!urls.some(u => u.includes('workflows/check.yml/runs') && u.includes('branch=main'))) B('loadHealth: адрес запусков', urls.join(' '));
    if (!urls.some(u => u.includes(encodeURIComponent('main-красный')))) B('loadHealth: адрес задач с меткой', urls.join(' '));
    if (calls.length !== 2) B('loadHealth: два запроса', calls.length);
    if (calls.some(c => JSON.stringify((c[1] || {}).headers || {}).toLowerCase().includes('authorization'))) B('loadHealth: без authorization', JSON.stringify(calls.map(c => c[1])));
    if (!d.ok || !Array.isArray(d.runs) || d.runs.length !== 5 || !Array.isArray(d.issues) || d.issues.length !== 1) B('loadHealth: успех', JSON.stringify(d).slice(0, 300));
    const lim = await loadHealth(fake(resp(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(T0 / 1000) }), resp(200, [])), 'o/r');
    if (lim.ok !== false || !/Лимит/.test(lim.why || '') || lim.retryAt !== T0) B('loadHealth: 403 лимит', JSON.stringify(lim));
    const thr = await loadHealth(async () => { throw new Error('net'); }, 'o/r');
    if (thr.ok !== false || !/не отвечает/.test(thr.why || '')) B('loadHealth: исключение', JSON.stringify(thr));
    const nf = await loadHealth(fake(resp(404, {}), resp(404, {})), 'o/r');
    if (nf.ok !== false || !/не найден/.test(nf.why || '')) B('loadHealth: 404', JSON.stringify(nf));
    const oth = await loadHealth(fake(resp(500, {}), resp(200, [])), 'o/r');
    if (oth.ok !== false || !/500/.test(oth.why || '')) B('loadHealth: другой статус', JSON.stringify(oth));
  } catch (e) { B('loadHealth: прогон', e.message); }
  // healthHtml: экранирование и ссылки
  const XSS = '<img src=x onerror=alert(1)>';
  const hh = healthHtml({ ok: true, running: { at: today, url: 'https://github.com/o/r/actions/runs/3' },
    runs: [{ id: 1, ok: true, at: today, ms: 5000, url: 'https://github.com/o/r/actions/runs/1', sha: 'abc', title: XSS },
      { id: 2, ok: false, at: past, ms: 492000, url: 'javascript:alert(1)', sha: 'def', title: 'x' }],
    issues: [{ n: 7, title: XSS, url: 'https://github.com/o/r/issues/7' }, { n: 8, title: 't', url: 'javascript:alert(1)' }] }, now);
  if (hh.includes('<img')) B('healthHtml: экранирование', hh);
  if (/href="javascript:/i.test(hh) || (hh.match(/href="([^"]*)"/g) || []).some(m => !m.startsWith('href="https://github.com/'))) B('healthHtml: только github.com в href', hh);
  const as = hh.match(/<a\b[^>]*>/g) || [];
  if (!as.length || as.some(a => !a.includes('rel="noopener noreferrer"') || !a.includes('target="_blank"'))) B('healthHtml: rel и target у ссылок', as.join(' '));
  if (!hh.includes('hl-run ok') || !hh.includes('hl-run bad') || !hh.includes('class="hl-now"') || !hh.includes('шла 8 мин 12 с')) B('healthHtml: строки запусков', hh);
  const he = healthHtml({ ok: false, why: 'GitHub ответил <b>500</b>' }, now);
  if (!he.includes('class="hl-err"') || !he.includes('data-hrefresh') || he.includes('<b>500')) B('healthHtml: ошибка', he);
  const h0 = healthHtml({ ok: true, runs: [], issues: [] }, now);
  if (!h0.includes('Завершённых проверок main пока нет') || !h0.includes('Открытых задач нет')) B('healthHtml: пусто', h0);
  return bad;
}

async function runMe(browser, URL) { return (await logic()).concat(await healthLogic(), await ui(browser, URL)); }
module.exports = { runMe, logic, healthLogic };

if (require.main === module) { const http = require('http'), fs = require('fs');
  const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
  const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; const p = path.join(ROOT, f);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); })
    .listen(0, '127.0.0.1', async () => { const br = await chromium.launch(); const bad = await runMe(br, 'http://127.0.0.1:' + srv.address().port + '/'); await br.close(); srv.close();
      bad.forEach(b => console.log('✗ ' + b.name + ' · ' + b.rule + ': ' + b.msg)); console.log(bad.length ? 'Замечаний: ' + bad.length : 'Пульт: ошибок нет'); process.exit(bad.length ? 1 : 0); }); }
