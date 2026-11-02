#!/usr/bin/env node
/* Смоук-тест страницы в настоящем Chromium (Playwright): node hands/tests/smoke.js [папка-для-снимков]
   Сам поднимает статический сервер из корня репозитория. Проверяет:
     • страница грузится под своей CSP без ошибок, WebGL рисует деталь;
     • синтетические руки через window.__feed: вращение, курсоры HUD в главном окне, разбор двумя кулаками, сброс ладонью;
     • MediaPipe (wasm, самохост) создаётся под этой CSP — CPU-делегат — и распознаёт кадр (пустой — 0 рук). */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '../..'), OUT = process.argv[2];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.png': 'image/png' };

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
  const p = path.join(ROOT, f); if (!p.startsWith(ROOT) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

srv.listen(0, async () => {
  const url = `http://localhost:${srv.address().port}/hands/`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if ((m.type() === 'error' && !/^(INFO|I\d{4}|W\d{4}):?/.test(m.text())) || /WebGL: INVALID/.test(m.text())) errs.push(m.text());   /* MediaPipe пишет служебное INFO в console.error */ });
  try {
    await p.goto(url); await p.waitForFunction(() => window.__app && window.__app.holo, null, { timeout: 15000 }); await p.waitForTimeout(500);
    ok(errs.length === 0, 'страница без ошибок' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    const lit = await p.evaluate(() => { const c = document.getElementById('gl'), g = c.getContext('webgl'); window.__app.render(performance.now()); const w = c.width, h = c.height, px = new Uint8Array(4);   /* в той же задаче, что и отрисовка */
      g.readPixels(w >> 1, h >> 1, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); return [...px]; });
    ok(Math.max(...lit.slice(0, 3)) < 240 && lit[2] > 60, 'в центре кадра — деталь, а не фон (пиксель ' + lit.join(',') + ')');

    /* жесты синтетическими руками — тем же генератором, что в node-тестах */
    const res = await p.evaluate(async () => {
      const { hand } = await import('./tests/synth.js');
      const A = window.__app, v = A.view, out = {}; let t = 1e6;
      const feed = (h, n = 1) => { for (let i = 0; i < n; i++) { t += 33; window.__feed(h, t); } };
      const y0 = v.yaw;
      feed([hand({ pose: 'pinch', gap: 0.1, cx: 0.4 })], 8);
      for (let i = 0; i <= 15; i++) feed([hand({ pose: 'pinch', gap: 0.1, cx: 0.4 + 0.01 * i })]);
      out.rot = y0 - v.yaw; out.mode = A.frame.mode;
      /* курсор щипка — в главном окне, а не только в превью камеры: ищем красный пиксель (щипок) у кончика указательного */
      const hud = document.getElementById('hud'), ctx = hud.getContext('2d'), h = A.frame.hands[0], dpr = hud.width / hud.clientWidth;
      const x = ((h.cursor.x - 0.08) / 0.84) * hud.clientWidth * dpr, y = ((h.cursor.y - 0.08) / 0.84) * hud.clientHeight * dpr;
      const d = ctx.getImageData(Math.round(x - 30), Math.round(y - 30), 60, 60).data; let red = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 120 && d[i + 3] > 100) red++;
      out.cursor = red;
      feed([hand({ pose: 'idle', cx: 0.55 })], 10); A.ctl.stopMotion();
      /* панель рукой: курсор (кончик указательного) — на элемент, щипок — нажать / тянуть */
      const hr = hud.getBoundingClientRect(), toFrame = el => { const r = el.getBoundingClientRect(); return { x: 0.08 + (r.left + r.width / 2 - hr.left) / hr.width * 0.84, y: 0.08 + (r.top + r.height / 2 - hr.top) / hr.height * 0.84 }; };
      feed([hand({ pose: 'pinch', gap: 0.9, cx: 0.5, cy: 0.5 })], 3); const c0 = A.frame.hands[0].cursor, off = { x: c0.x - 0.5, y: c0.y - 0.5 };
      const pinchAt = (tg, dx = 0) => {
        feed([hand({ pose: 'pinch', gap: 0.9, cx: tg.x - off.x, cy: tg.y - off.y })], 10);
        feed([hand({ pose: 'pinch', gap: 0.1, cx: tg.x - off.x, cy: tg.y - off.y })], 6);
        for (let i = 1; i <= 10; i++) feed([hand({ pose: 'pinch', gap: 0.1, cx: tg.x - off.x + dx * i / 10, cy: tg.y - off.y })]);
        feed([hand({ pose: 'pinch', gap: 0.9, cx: tg.x - off.x + dx, cy: tg.y - off.y })], 8);
      };
      feed([], 12);
      const yaw1 = v.yaw;
      pinchAt(toFrame(document.querySelector('.seg[data-g="cut"] button[data-v="front"]')));
      out.cut = A.cut && A.cut.kind; out.noRot = Math.abs(v.yaw - yaw1);
      pinchAt(toFrame(document.querySelector('.sl[data-k="explode"] .kn')), 0.2);
      out.explode = v.explode;
      feed([], 12);
      /* сброс ладонью */
      feed([hand({ pose: 'open' })], 55); out.resetEv = true; A.ctl.tick(t + 2000);
      out.after = { yaw: v.yaw, explode: v.explode };
      return out;
    });
    ok(res.rot > 0.4, `щипок + движение вращает (Δyaw = ${res.rot.toFixed(2)}, режим ${res.mode})`);
    ok(res.cursor > 10, `курсор щипка нарисован в главном окне (${res.cursor} пикс.)`);
    ok(res.cut === 'front' && res.noRot < 1e-3, `щипок по кнопке «Фронт.» включает разрез и не вращает деталь (${res.cut}, Δyaw ${res.noRot.toFixed(3)})`);
    ok(res.explode > 0.5, `щипок по ползунку «Разбор» и ведение руки разбирают модель (${(res.explode * 100).toFixed(0)} %)`);
    ok(Math.abs(res.after.yaw + 0.62) < 1e-3 && res.after.explode < 1e-3, 'открытая ладонь 1,5 с возвращает вид');
    if (OUT) {
      await p.evaluate(async () => { const { hand } = await import('./tests/synth.js'); const A = window.__app; let t = 2e6;
        A.view.explode = 0.85; A.view.yaw = -0.3;
        for (let i = 0; i < 6; i++) { t += 33; window.__feed([hand({ pose: 'pinch', gap: 0.12, cx: 0.66, cy: 0.42, rot: -0.3 }), hand({ pose: 'open', cx: 0.3, cy: 0.5, rot: 0.25, seed: 3 })], t); } });
      await p.waitForTimeout(150); await p.screenshot({ path: path.join(OUT, 'hands-hud.png') });
    }

    /* MediaPipe под CSP страницы: wasm + модель из vendor/, CPU-делегат (в CI нет GPU) */
    const mp = await p.evaluate(async () => {
      const { FilesetResolver, HandLandmarker } = await import('./vendor/vision_bundle.mjs');
      const fs = await FilesetResolver.forVisionTasks('./vendor/wasm');
      const lm = await HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/hand_landmarker.task', delegate: 'CPU' }, runningMode: 'IMAGE', numHands: 2 });
      const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').fillRect(0, 0, 320, 240);
      const t0 = performance.now(), r = lm.detect(c); return { n: r.landmarks.length, ms: performance.now() - t0 };
    }).catch(e => ({ err: String(e) }));
    ok(!mp.err && mp.n === 0, 'MediaPipe запускается под CSP страницы' + (mp.err ? ': ' + mp.err : ` (кадр за ${mp.ms.toFixed(0)} мс, рук: ${mp.n})`));
    /* конвейер камеры целиком: кнопка → getUserMedia (поддельная камера Chromium) → MediaPipe (GPU → откат на CPU) → цикл распознавания */
    const cp = await b.newPage({ viewport: { width: 1280, height: 800 } });
    cp.on('pageerror', e => errs.push(e.message));
    await cp.goto(url); await cp.waitForFunction(() => window.__app && window.__app.holo);
    await cp.click('#go');
    const camOk = await cp.waitForFunction(() => document.getElementById('go').classList.contains('on'), null, { timeout: 60000 }).then(() => true).catch(() => false);
    await cp.waitForFunction(() => /кадр\/с/.test(window.__camInfo && window.__camInfo() || ''), null, { timeout: 120000 }).catch(() => {});   /* первый кадр: загрузка wasm и модели, прогрев */
    const camState = await cp.evaluate(() => ({ btn: document.getElementById('go').textContent, err: document.getElementById('err').textContent, info: window.__camInfo && window.__camInfo() }));
    ok(camOk && /кадр\/с/.test(camState.info || ''), 'камера и цикл распознавания запускаются: ' + (camState.info || camState.err || camState.btn));
    await cp.click('#go'); await cp.waitForTimeout(200);
    ok(!(await cp.evaluate(() => document.getElementById('go').classList.contains('on'))) && await cp.isVisible('#cta'), 'камера выключается, снова видно приглашение');
    ok(errs.length === 0, 'по ходу проверки — без ошибок в консоли' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  } catch (e) { ok(false, 'исключение: ' + e.message); }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} провал(ов)` : '\nвсё прошло'); process.exit(fails ? 1 : 0);
});
