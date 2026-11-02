#!/usr/bin/env node
/* Сквозной тест «телефон — датчик рук»: node hands/tests/pair.js
   Две вкладки Chromium (поддельная камера) и мини-брокер MQTT по WebSocket в тестовом сервере (вместо публичного).
   Сценарий 1 «как с VPN»: прямого канала нет (из ссылки убрано предложение) — точки рук идут через брокер.
   Сценарий 2 «одна сеть»: связь через брокер, затем переход на прямой канал WebRTC.
   В обоих: QR-код ноутбука читается, «телефон» открывает ссылку и подключается сам, руки с него вращают деталь. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '../..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
const crypto = require('crypto');
/* ── мини-брокер MQTT 3.1.1 поверх WebSocket: CONNECT, SUBSCRIBE, PUBLISH (QoS 0), PINGREQ ── */
const subs = new Map();                                     /* тема → множество соединений */
function wsUpgrade(req, sock) {
  const key = req.headers['sec-websocket-key'], acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\nSec-WebSocket-Protocol: mqtt\r\n\r\n');
  const c = { sock, topics: new Set() }; let wbuf = Buffer.alloc(0), mbuf = Buffer.alloc(0);
  const frame = data => { const n = data.length, h = n < 126 ? Buffer.from([0x82, n]) : n < 65536 ? Buffer.from([0x82, 126, n >> 8, n & 255]) : null; if (h && !sock.destroyed) sock.write(Buffer.concat([h, data])); };
  c.send = frame;
  const mqtt = () => { for (;;) {
    if (mbuf.length < 2) return; let len = 0, mul = 1, i = 1, b;
    do { if (i >= mbuf.length) return; b = mbuf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
    if (mbuf.length < i + len) return; const pk = mbuf.subarray(0, i + len), type = mbuf[0] & 0xf0, body = mbuf.subarray(i, i + len); mbuf = mbuf.subarray(i + len);
    if (type === 0x10) frame(Buffer.from([0x20, 2, 0, 0]));
    else if (type === 0x80) { const pid = body.subarray(0, 2), tl = body.readUInt16BE(2), topic = body.subarray(4, 4 + tl).toString(); c.topics.add(topic);
      if (!subs.has(topic)) subs.set(topic, new Set()); subs.get(topic).add(c); frame(Buffer.from([0x90, 3, pid[0], pid[1], 0])); }
    else if (type === 0x30) { const tl = body.readUInt16BE(0), topic = body.subarray(2, 2 + tl).toString(); (subs.get(topic) || []).forEach(x => x.send(Buffer.from(pk))); }
    else if (type === 0xc0) frame(Buffer.from([0xd0, 0]));
    else if (type === 0xe0) sock.end();
  } };
  sock.on('data', d => { wbuf = Buffer.concat([wbuf, d]);
    for (;;) { if (wbuf.length < 2) return; let len = wbuf[1] & 127, off = 2; const op = wbuf[0] & 15;
      if (len === 126) { if (wbuf.length < 4) return; len = wbuf.readUInt16BE(2); off = 4; } else if (len === 127) { if (wbuf.length < 10) return; len = Number(wbuf.readBigUInt64BE(2)); off = 10; }
      if (wbuf.length < off + 4 + len) return; const mask = wbuf.subarray(off, off + 4), pl = Buffer.from(wbuf.subarray(off + 4, off + 4 + len)); wbuf = wbuf.subarray(off + 4 + len);
      for (let i = 0; i < pl.length; i++) pl[i] ^= mask[i & 3];
      if (op === 8) { sock.end(); return; } if (op === 2 || op === 0) { mbuf = Buffer.concat([mbuf, pl]); mqtt(); } } });
  const bye = () => c.topics.forEach(t => subs.get(t) && subs.get(t).delete(c)); sock.on('close', bye); sock.on('error', bye);
}
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0].split('#')[0]); if (f.endsWith('/')) f += 'index.html';
  const p = path.join(ROOT, f); if (!p.startsWith(ROOT) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

srv.on('upgrade', (req, sock) => { if (req.url === '/mqtt') wsUpgrade(req, sock); else sock.destroy(); });
srv.listen(0, async () => {
  const base = `http://localhost:${srv.address().port}/hands/`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext(); await ctx.grantPermissions(['camera']);
  const L = await ctx.newPage(), P = await ctx.newPage(), errs = [];
  [L, P].forEach(pg => pg.on('pageerror', e => errs.push(e.message)));
  try {
    await L.goto(base); await L.waitForFunction(() => window.__app && window.__app.holo);
    const broker = `ws://localhost:${srv.address().port}/mqtt`;
    for (const scen of ['vpn', 'lan']) {
      const P = await ctx.newPage(); P.on('pageerror', e => errs.push(e.message));
      let url = await L.evaluate(b => window.__app.pairing.start(document.getElementById('pairQr'), document.getElementById('pairVid'), { brokers: [b] }), broker);
      if (scen === 'vpn') {
        const qrText = await L.evaluate(async () => {
          await new Promise((res, rej) => { if (window.jsQR) return res(); const s = document.createElement('script'); s.src = 'vendor/qr/jsQR.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
          const c = document.getElementById('pairQr'), g = c.getContext('2d'); return (window.jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height) || {}).data;
        });
        ok(qrText === url && /&r=[0-9a-f]{32}/.test(url), `QR-код на ноутбуке читается (${url.length} символов) и содержит канал`);
        url = url.replace(/o=[^&]*&/, '');                         /* «VPN»: прямого канала не будет — только брокер */
      }
      await P.goto(url);
      const on = await L.waitForFunction(() => window.__app.pairing.st.state === 'on', null, { timeout: 60000 }).then(() => true).catch(() => false);
      if (scen === 'lan') await L.waitForFunction(() => window.__app.pairing.st.path === 'прямо', null, { timeout: 15000 }).catch(() => {});
      const path = await L.evaluate(() => window.__app.pairing.st.path);
      ok(on && path === (scen === 'vpn' ? 'интернет' : 'прямо'), `${scen === 'vpn' ? '«как с VPN»' : '«одна сеть»'}: подключился одним сканированием, путь — ${path || 'нет'}`);
      /* в контейнере видеокарта программная — прогрев модели на «телефоне» идёт ~10 с; ждём его */
      await L.waitForFunction(() => window.__app.pairing.st.log.some(t => /распознавание готово/.test(t)), null, { timeout: 90000 }).catch(() => {});
      await P.evaluate(() => window.__sensor.pause());
      const y0 = await L.evaluate(() => window.__app.view.yaw);
      await P.evaluate(async () => {
        const { hand } = await import('./tests/synth.js'), { encodeHands } = await import('./link.js');
        await new Promise(r => setTimeout(r, 300));
        for (let i = 0; i < 40; i++) { const cx = 0.35 + 0.006 * Math.max(0, i - 8);
          window.__sensor.send(encodeHands([{ lm: hand({ pose: 'fist', cx }), handed: 'Right', score: 0.95 }], { ms: 20 })); await new Promise(r => setTimeout(r, 33)); }
      });
      await L.waitForTimeout(400);
      const r = await L.evaluate(() => ({ yaw: window.__app.view.yaw, st: window.__app.pairing.st }));
      ok(y0 - r.yaw > 0.3, `  руки с телефона вращают деталь (Δyaw = ${(y0 - r.yaw).toFixed(2)}, ${r.st.fps.toFixed(0)} кадр/с)`);
      ok(r.st.log.some(t => /распознавание готово/.test(t)), '  распознавание на телефоне запустилось: ' + r.st.log.slice(-4).join(' | '));
      await P.evaluate(() => document.getElementById('stop').click());
      await L.waitForFunction(() => window.__app.pairing.st.state === 'idle', null, { timeout: 12000 }).catch(() => {});
      ok(await L.evaluate(() => window.__app.pairing.st.state === 'idle'), '  телефон остановлен — ноутбук это заметил');
      await P.close();
    }
    ok(errs.length === 0, 'без ошибок на страницах' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  } catch (e) { ok(false, 'исключение: ' + e.message); }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} провал(ов)` : '\nвсё прошло'); process.exit(fails ? 1 : 0);
});
