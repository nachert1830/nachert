#!/usr/bin/env node
/* Смоук-тест страницы в настоящем Chromium (Playwright): node hands/tests/smoke.js [папка-для-снимков]
   Сам поднимает статический сервер из корня репозитория. Проверяет:
     • страница грузится под своей CSP без ошибок, WebGL рисует деталь;
     • синтетические руки через window.__feed: вращение, курсор в главном окне, кнопка и ползунок щипком,
     маховик круговым движением, радиальное меню ладонью и сброс из его центра;
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
      const hud = document.getElementById('hud'), hr = hud.getBoundingClientRect(), B = A.ctl.cfg.box;
      /* курсор (доли экрана) ← рука: калибруем смещение точки курсора от центра ладони синтетической руки */
      feed([hand({ pose: 'idle', cx: 0.5, cy: 0.5 })], 20); const c0 = A.frame.hands[0].cursor;
      const at = (sx, sy) => ({ cx: 0.5 + (sx - c0.x) * (B.x1 - B.x0), cy: 0.5 + (sy - c0.y) * (B.y1 - B.y0) });
      const scr = (px, py) => at(px / hr.width, py / hr.height);
      const elAt = el => { const r = el.getBoundingClientRect(); return scr(r.left + r.width / 2 - hr.left, r.top + r.height / 2 - hr.top); };
      feed([], 12);
      /* вращение: щипок мимо панели и сразу ведём */
      const y0 = v.yaw;
      feed([hand({ pose: 'pinch', gap: 0.1, cx: 0.4 })], 6);
      for (let i = 0; i <= 15; i++) feed([hand({ pose: 'pinch', gap: 0.1, cx: 0.4 + 0.01 * i })]);
      out.rot = y0 - v.yaw; out.mode = A.frame.mode;
      /* курсор щипка — в главном окне: красный диск в точке курсора */
      const ctx = hud.getContext('2d'), h = A.frame.hands[0], dpr = hud.width / hud.clientWidth;
      const x = h.cursor.x * hud.clientWidth * dpr, y = h.cursor.y * hud.clientHeight * dpr;
      const d = ctx.getImageData(Math.round(x - 20), Math.round(y - 20), 40, 40).data; let red = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 120 && d[i + 3] > 100) red++;
      out.cursor = red;
      feed([hand({ pose: 'idle', cx: 0.55 })], 10); A.ctl.stopMotion(); feed([], 12);
      /* панель рукой: навести — щипнуть — (вести) — отпустить */
      const pinchAt = (tg, dx = 0, hold = 6) => {
        feed([hand({ pose: 'idle', cx: tg.cx, cy: tg.cy })], 15);
        feed([hand({ pose: 'pinch', gap: 0.1, cx: tg.cx, cy: tg.cy })], hold);
        for (let i = 1; i <= 10; i++) feed([hand({ pose: 'pinch', gap: 0.1, cx: tg.cx + dx * i / 10, cy: tg.cy })]);
        feed([hand({ pose: 'idle', cx: tg.cx + dx, cy: tg.cy })], 8);
      };
      const yaw1 = v.yaw;
      pinchAt(elAt(document.querySelector('.seg[data-g="cut"] button[data-v="front"]')));
      out.cut = A.cut && A.cut.kind; out.noRot = Math.abs(v.yaw - yaw1);
      pinchAt(elAt(document.querySelector('.seg[data-g="cut"] button[data-v=""]')));
      pinchAt(elAt(document.querySelector('.sl[data-k="explode"] .kn')), 0.2);
      out.explode = v.explode;
      feed([], 12); v.explode = 0; A.render(t);
      /* маховик: щипнуть обод и провести рукой 3/4 оборота против часовой */
      const M = A.holo.model;
      if (M.wheel) {
        A.ctl.reset(t, { yaw: 0, pit: 1.2, zoom: 1.6, panX: 0, panY: 0 }); A.ctl.tick(t + 2000); A.render(t + 2000);
        const o = A.holo.offset('wheel'), C = A.holo.project([M.wheel.c[0] + o[0], M.wheel.c[1] + o[1], M.wheel.c[2] + o[2]]), lb = M.labels.wheel.at;
        const R0 = A.holo.project([lb[0] + o[0], lb[1] + o[1], lb[2] + o[2]]), rr = Math.max(40, Math.hypot(R0[0] - C[0], R0[1] - C[1]) * 0.9), a0 = Math.atan2(-(R0[1] - C[1]), R0[0] - C[0]);
        const P = a => scr(C[0] + rr * Math.cos(a), C[1] - rr * Math.sin(a));
        const s0 = P(a0); feed([hand({ pose: 'idle', cx: s0.cx, cy: s0.cy })], 15); feed([hand({ pose: 'pinch', gap: 0.1, cx: s0.cx, cy: s0.cy })], 4);
        out.wheelMode = A.frame.drag && A.frame.drag.kind;
        for (let i = 1; i <= 24; i++) { const q = P(a0 + i / 24 * 1.5 * Math.PI); feed([hand({ pose: 'pinch', gap: 0.1, cx: q.cx, cy: q.cy })]); }
        out.open = v.open || 0; feed([hand({ pose: 'idle', cx: 0.5, cy: 0.5 })], 8);
      }
      feed([], 12);
      /* меню ладонью: 0,5 с — меню; щипок в центре — сброс; «Вернуть» — откатывает */
      feed([hand({ pose: 'open', cx: 0.5, cy: 0.5 })], 22); out.menu = !!A.frame.menu;
      feed([hand({ pose: 'pinch', gap: 0.1, cx: 0.5, cy: 0.5 })], 5); A.ctl.tick(t + 2000);
      out.after = { yaw: v.yaw, explode: v.explode, open: v.open || 0 };
      out.undo = !document.getElementById('undo').hidden;
      feed([hand({ pose: 'idle', cx: 0.5, cy: 0.5 })], 8);
      return out;
    });
    ok(res.rot > 0.4, `щипок + движение вращает (Δyaw = ${res.rot.toFixed(2)}, режим ${res.mode})`);
    ok(res.cursor > 10, `курсор щипка нарисован в главном окне (${res.cursor} пикс.)`);
    ok(res.cut === 'front' && res.noRot < 1e-3, `щипок по кнопке «Фронт.» включает разрез (на отпускание) и не вращает деталь (${res.cut}, Δyaw ${res.noRot.toFixed(3)})`);
    ok(res.explode > 0.5, `щипок по ползунку «Разбор» и ведение руки разбирают модель (${(res.explode * 100).toFixed(0)} %)`);
    if (res.wheelMode !== undefined) ok(res.wheelMode === 'wheel' && res.open > 0.1, `щипок по маховику и круговое движение открывают вентиль (${res.wheelMode}, ${(res.open * 100).toFixed(0)} %)`);
    ok(res.menu, 'открытая ладонь 0,5 с открывает радиальное меню');
    ok(Math.abs(res.after.yaw + 0.62) < 1e-3 && res.after.explode < 1e-3 && res.after.open < 1e-3 && res.undo, 'щипок в центре меню — сброс, появляется «Вернуть»');
    if (OUT) {
      await p.evaluate(async () => { const { hand } = await import('./tests/synth.js'); const A = window.__app; let t = 2e6;
        A.view.explode = 0.85; A.view.yaw = -0.3;
        for (let i = 0; i < 24; i++) { t += 33; window.__feed([hand({ pose: 'open', cx: 0.5, cy: 0.5 })], t); }
        for (let i = 0; i < 8; i++) { t += 33; window.__feed([hand({ pose: 'open', cx: 0.5 + i * 0.008, cy: 0.5 - i * 0.004 })], t); } });
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
