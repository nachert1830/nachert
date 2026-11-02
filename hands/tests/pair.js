#!/usr/bin/env node
/* Сквозной тест «телефон — датчик рук»: node hands/tests/pair.js
   Две вкладки Chromium (поддельная камера): «ноутбук» (hands/) делает предложение, «телефон» (sensor.html#o=…)
   отвечает QR-кодом; QR с экрана «телефона» распознаём jsQR (как веб-камера ноутбука), канал WebRTC открывается,
   синтетические руки с «телефона» вращают деталь на «ноутбуке». */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0].split('#')[0]); if (f.endsWith('/')) f += 'index.html';
  const p = path.join(ROOT, f); if (!p.startsWith(ROOT) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

srv.listen(0, async () => {
  const base = `http://localhost:${srv.address().port}/hands/`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext(); await ctx.grantPermissions(['camera']);
  const L = await ctx.newPage(), P = await ctx.newPage(), errs = [];
  [L, P].forEach(pg => pg.on('pageerror', e => errs.push(e.message)));
  try {
    await L.goto(base); await L.waitForFunction(() => window.__app && window.__app.holo);
    const url = await L.evaluate(() => window.__app.pairing.start(document.getElementById('pairQr'), document.getElementById('pairVid'), { scan: false }));
    const code = decodeURIComponent(new URL(url).hash.slice(3));
    ok(/^1~/.test(code) && url.length < 600, `предложение в ссылке: ${url.length} символов`); console.log('     код:', code);
    await P.goto(url); await P.click('#start');
    await P.waitForFunction(() => !document.getElementById('qr').hidden, null, { timeout: 30000 });
    const qrPng = await P.evaluate(() => document.getElementById('qr').toDataURL());
    /* «веб-камера ноутбука» видит экран телефона: распознаём QR той же jsQR */
    const answer = await L.evaluate(async src => {
      await new Promise((res, rej) => { if (window.jsQR) return res(); const s = document.createElement('script'); s.src = 'vendor/qr/jsQR.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const im = new Image(); await new Promise(r => { im.onload = r; im.src = src; });
      const c = document.createElement('canvas'); c.width = im.width + 80; c.height = im.height + 80; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 40, 40);
      const r = window.jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height); return r && r.data;
    }, qrPng);
    ok(answer && /^1~/.test(answer), 'ответ телефона считан с QR-кода: ' + (answer ? answer.length + ' символов' : 'нет')); console.log('     ответ:', answer);
    await L.evaluate(a => window.__app.pairing.answer(a), answer);
    const open = await L.waitForFunction(() => window.__app.pairing.st.state === 'on', null, { timeout: 20000 }).then(() => true).catch(() => false);
    ok(open, 'канал WebRTC открыт');
    await P.waitForFunction(() => window.__sensor.dc && window.__sensor.dc.readyState === 'open', null, { timeout: 10000 });
    await P.evaluate(() => window.__sensor.pause());
    const y0 = await L.evaluate(() => window.__app.view.yaw);
    /* «телефон» шлёт синтетические руки: кулак ведёт вправо — деталь поворачивается */
    await P.evaluate(async () => {
      const { hand } = await import('./tests/synth.js'), { encodeHands } = await import('./link.js');
      for (let i = 0; i < 40; i++) { const cx = 0.35 + 0.006 * Math.max(0, i - 8);
        window.__sensor.dc.send(encodeHands([{ lm: hand({ pose: 'fist', cx }), handed: 'Right', score: 0.95 }], { ms: 20 })); await new Promise(r => setTimeout(r, 33)); }
    });
    await L.waitForTimeout(300);
    const r = await L.evaluate(() => ({ yaw: window.__app.view.yaw, st: window.__app.pairing.st, info: window.__camInfo() }));
    ok(y0 - r.yaw > 0.3, `руки с телефона вращают деталь (Δyaw = ${(y0 - r.yaw).toFixed(2)})`);
    ok(r.st.fps > 10, `поток точек: ${r.st.fps.toFixed(0)} кадр/с, сеть ${r.st.rtt.toFixed(0)} мс · «${r.info}»`);
    await P.evaluate(() => document.getElementById('stop').click()); await L.waitForTimeout(500);
    ok(await L.evaluate(() => window.__app.pairing.st.state === 'idle'), 'телефон отключился — ноутбук это заметил');
    ok(errs.length === 0, 'без ошибок на страницах' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  } catch (e) { ok(false, 'исключение: ' + e.message); }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} провал(ов)` : '\nвсё прошло'); process.exit(fails ? 1 : 0);
});
