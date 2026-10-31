/* Голограмма варианта 5: сборка страницы — камера и MediaPipe, жесты, мышь/касания, рендер, HUD, звук, запись.
   Логика жестов — в gestures.js (чистая, с тестами), рисование — holo.js и hud.js. */
import DATA from './v5.js';
import { createHolo } from './holo.js';
import { createHud } from './hud.js';
import { createController, HOME } from './gestures.js';
import { sound } from './sound.js';

const $ = id => document.getElementById(id);
const showErr = m => { const e = $('err'); e.textContent = m; e.style.display = m ? 'block' : 'none'; };
const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const reduced = () => RM.matches;

/* ── 3D ── */
let holo = null;
try { holo = createHolo($('gl'), DATA); } catch (e) { console.error(e); }
if (!holo) showErr('WebGL недоступен — голограмма не покажется.');
const hud = createHud($('hud'));
const ctl = createController({ reducedMotion: reduced() });
RM.addEventListener && RM.addEventListener('change', () => { ctl.reduced = reduced(); });
const view = ctl.view;
let frame = null, dirty = true, info = '', helpDim = false;
const store = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} };
const load = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };

/* ── отрисовка: каждый кадр, пока что-то движется или идёт камера (мерцание); иначе — по изменению ── */
let camOn = false, lastDraw = 0;
function render(t) {
  const moving = ctl.tick(t) || manual.anim();
  if (!holo) return;
  /* только «фон» (мерцание голограммы) — не чаще 30 кадров/с: меньше нагрузка, процессор остаётся распознаванию */
  const ambient = !reduced() && holo.mode === 'holo';
  if (dirty || moving || (ambient && t - lastDraw > 31)) {
    lastDraw = t;
    holo.draw(view, t, { reduced: reduced() });
    hud.draw({ frame: camOn || feedOn ? frame : null, view, holo, t, reduced: reduced(), info });
    /* подсказка уходит, когда мешает: идёт жест или деталь разобрана (слева — выноски) */
    const dim = view.explode > 0.02 || (frame && frame.mode !== 'idle' && (camOn || feedOn));
    if (dim !== helpDim) { helpDim = dim; $('help').classList.toggle('dim', dim); }
    dirty = false;
  }
}
function loop(t) { render(t); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
if (holo) holo.scan(performance.now() + 200);

/* ── режим: голограмма / чертёж ── */
function setMode(m) { holo && holo.setMode(m); $('mode').textContent = m === 'draft' ? '◑ Голограмма' : '◐ Чертёж'; $('mode').setAttribute('aria-pressed', m === 'draft'); store('hands.mode', m); dirty = true; }
$('mode').onclick = () => setMode(holo && holo.mode === 'draft' ? 'holo' : 'draft');
setMode(load('hands.mode') === 'draft' ? 'draft' : 'holo');

/* ── звук ── */
function setSound(v) { sound.set(v); $('snd').textContent = v ? '🔊' : '🔇'; $('snd').classList.toggle('on', v); $('snd').setAttribute('aria-pressed', v); store('hands.snd', v ? '1' : undefined); }
$('snd').onclick = () => setSound(!sound.on);
if (load('hands.snd') === '1') { $('snd').textContent = '🔊'; }       /* звук включится по первому нажатию — так требует браузер */

/* ── жесты: общий вход для камеры, повтора записи и тестов ── */
let feedOn = false;
function onHands(hands, t) {
  frame = ctl.update(hands, t);
  sound.play(frame.events);
  frame.events.forEach(e => { if (e.type === 'reset' && holo) holo.scan(t); });
  const st = $('st'), md = $('md');
  const n = frame.hands.filter(h => h.present).length;
  st.textContent = !n ? 'руки не видно' : frame.hands.some(h => h.present && h.ignored) ? 'рука у края кадра — ближе к центру' : n === 1 ? 'вижу руку' : 'вижу обе руки';
  st.className = 'chip' + (n ? ' act' : '');
  md.textContent = frame.label || '';
  dirty = true;
  return frame;
}
/* отладка и автотесты: __feed([[21 точка], …], t) — как кадр камеры */
window.__feed = (hands, t) => { feedOn = true; const f = onHands(hands, t == null ? performance.now() : t); render(t == null ? performance.now() : t); return f; };
window.__camInfo = () => info;
window.__app = { view, ctl, holo, HOME, render: t => { dirty = true; render(t); },   /* принудительно: для тестов и снимков */ get frame() { return frame; } };

/* ── мышь и касания (жесты рук им не мешают) ── */
const cv = $('gl'), pts = new Map();
const manual = (() => {
  let g = null, vel = { y: 0, p: 0 }, tween = null;
  const stop = () => { tween = null; };
  return {
    down(e) {
      ctl.stopMotion(); stop(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.classList.add('drag');
      const pan = e.button === 2 || e.shiftKey;
      if (pts.size === 1) g = { m: pan ? 'pan' : 'rot', x: e.clientX, y: e.clientY, t: performance.now() };
      else if (pts.size === 2) { const a = [...pts.values()]; g = { m: 'pinch', d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), cx: (a[0].x + a[1].x) / 2, cy: (a[0].y + a[1].y) / 2 }; }
    },
    move(e) {
      if (!pts.has(e.pointerId) || !g) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const H = cv.clientHeight || 1;
      if (g.m === 'pinch' && pts.size >= 2) { const a = [...pts.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), cx = (a[0].x + a[1].x) / 2, cy = (a[0].y + a[1].y) / 2;
        if (g.d > 10) view.zoom = Math.max(0.5, Math.min(5, view.zoom * d / g.d));
        view.panX -= (cx - g.cx) / H / view.zoom; view.panY += (cy - g.cy) / H / view.zoom; Object.assign(g, { d, cx, cy }); dirty = true; return; }
      if (pts.size !== 1) return;
      const dx = e.clientX - g.x, dy = e.clientY - g.y, now = performance.now(); g.x = e.clientX; g.y = e.clientY;
      if (g.m === 'pan') { view.panX -= dx / H / view.zoom; view.panY += dy / H / view.zoom; }
      else { view.yaw -= dx * 0.009; view.pit = Math.max(ctl.cfg.pitMin, Math.min(ctl.cfg.pitMax, view.pit + dy * 0.009));
        const k = Math.max(1, now - g.t); vel = { y: 0.7 * vel.y + 0.3 * (-dx * 0.009 / k), p: 0.7 * vel.p + 0.3 * (dy * 0.009 / k) }; }
      g.t = now; dirty = true;
    },
    up(e) {
      if (!pts.delete(e.pointerId)) return; if (pts.size) return; cv.classList.remove('drag');
      if (g && g.m === 'rot' && performance.now() - g.t < 70 && Math.hypot(vel.y, vel.p) > 0.0004 && !reduced()) ctl.fling = { vy: vel.y, vp: vel.p };
      g = null; vel = { y: 0, p: 0 };
    },
    explodeTo(to) { const from = view.explode, t0 = performance.now(), ms = reduced() ? 0 : 900 * Math.abs(to - from) + 1; tween = { from, to, t0, ms }; },
    anim() { if (!tween) return false; const u = Math.min(1, (performance.now() - tween.t0) / tween.ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      view.explode = tween.from + (tween.to - tween.from) * e; if (u >= 1) tween = null; return true; }
  };
})();
cv.addEventListener('pointerdown', manual.down); cv.addEventListener('pointermove', manual.move);
cv.addEventListener('pointerup', manual.up); cv.addEventListener('pointercancel', manual.up);
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { e.preventDefault(); ctl.stopMotion();
  if (e.altKey) view.explode = Math.max(0, Math.min(1, view.explode - e.deltaY * 0.0015));
  else view.zoom = Math.max(0.5, Math.min(5, view.zoom * Math.exp(-e.deltaY * 0.0015))); dirty = true; }, { passive: false });
cv.addEventListener('dblclick', () => { ctl.reset(performance.now()); holo && holo.scan(performance.now()); });
addEventListener('resize', () => { dirty = true; });
addEventListener('keydown', e => {
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'e' || k === 'у') manual.explodeTo(view.explode > 0.5 ? 0 : 1);
  else if (k === 'r' || k === 'к' || k === 'escape') { ctl.reset(performance.now()); holo && holo.scan(performance.now()); }
  else if (k === 'h' || k === 'р') $('mode').click();
  else if (k === 's' || k === 'ы') $('snd').click();
  else if (k === 'c' || k === 'с') $('go').click();
  else if (k === 'z' || k === 'я') $('rec').click();
  else return;
  dirty = true;
});

/* ── камера и MediaPipe (всё локально: модель и wasm — в vendor/, видео никуда не уходит) ──
   Распознавание — в воркере (detector.worker.js): рендер голограммы идёт на своей частоте, даже если кадр
   распознаётся долго. Нет воркера (старый браузер) — то же самое в основном потоке.
   Делегат: сначала GPU; не создался или упал — CPU; оказался медленным (программный WebGL) — пробуем CPU. */
const vid = $('vid'), ov = $('ov'), octx = ov.getContext('2d');

function workerDetector() {
  let w = null, q = Promise.resolve(), pend = null;
  /* вызовы строго по очереди: ответ воркера всегда относится к последнему запросу */
  const call = (msg, tr) => (q = q.catch(() => {}).then(() => new Promise((res, rej) => { pend = { res, rej }; w.postMessage(msg, tr || []); })));
  return {
    kind: 'поток',
    async init(d) {
      if (!w) { w = new Worker('detector.worker.js');
        w.onmessage = e => { const p = pend; pend = null; if (!p) return; e.data.type === 'fail' || e.data.type === 'error' ? p.rej(new Error(e.data.error)) : p.res(e.data); };
        w.onerror = e => { const p = pend; pend = null; p && p.rej(new Error(e.message || 'воркер не запустился')); }; }
      return (await call({ type: 'init', delegate: d })).delegate;
    },
    async detect(v, t) { const bitmap = await createImageBitmap(v); return call({ type: 'frame', bitmap, t }, [bitmap]); },
    close() { if (w) { w.postMessage({ type: 'close' }); w.terminate(); w = null; } }
  };
}
function mainDetector() {
  let lm = null;
  return {
    kind: 'основной поток',
    async init(d) {
      const { FilesetResolver, HandLandmarker } = await import('./vendor/vision_bundle.mjs');
      const fs = await FilesetResolver.forVisionTasks('./vendor/wasm');
      const mk = dd => HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/hand_landmarker.task', delegate: dd }, runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5 });
      try { lm && lm.close(); } catch (_) {}
      try { lm = await mk(d); return d; } catch (e) { if (d !== 'GPU') throw e; lm = await mk('CPU'); return 'CPU'; }
    },
    async detect(v, t) { const t0 = performance.now(), r = lm.detectForVideo(v, t);
      return { ms: performance.now() - t0, hands: (r.landmarks || []).map((lm, i) => { const h = r.handedness && r.handedness[i] && r.handedness[i][0]; return { lm, handed: h ? h.categoryName : null, score: h ? h.score : 1 }; }) }; },
    close() { try { lm && lm.close(); } catch (_) {} lm = null; }
  };
}

let det = null, delegate = '', stream = null, running = false, busy = false, lastVideoT = -1, lastDet = 0;
let detMs = 0, detN = 0, gpuMs = 0, tried = false, fps = 0, fpsT = 0, fpsN = 0;
const rec = { on: false, frames: [], t0: 0 };

async function initDetector() {
  if (det) return;
  if (window.Worker && window.createImageBitmap && window.OffscreenCanvas) {
    const d = workerDetector();
    try { delegate = await d.init('GPU'); det = d; return; } catch (e) { console.warn('воркер распознавания не поднялся, работаю в основном потоке', e); d.close(); }
  }
  const d = mainDetector(); delegate = await d.init('GPU'); det = d;
}
/* медленный делегат → другой. Решаем между кадрами, по скользящему среднему без первых кадров
   (прогрев, компиляция шейдеров). GPU медленнее 45 мс → пробуем CPU; CPU оказался ещё медленнее → назад, один раз. */
async function adapt() {
  if (tried === true) return;
  if (!tried && detN >= (detMs > 150 ? 4 : 25)) {
    if (delegate === 'GPU' && detMs > 45) { tried = 'cpu'; gpuMs = detMs; delegate = await det.init('CPU'); detN = 0; } else tried = true;
  } else if (tried === 'cpu' && detN >= 12) {
    tried = true; if (delegate === 'CPU' && detMs > gpuMs * 1.1) { delegate = await det.init('GPU'); detN = 0; }
  }
}

async function pump() {
  if (!running) return;
  const now = performance.now();
  if (!busy && vid.readyState >= 2 && vid.currentTime !== lastVideoT && now - lastDet >= 30) {     /* ≤ 33 кадров/с; один кадр «в полёте» */
    lastVideoT = vid.currentTime; lastDet = now; busy = true;
    try {
      const r = await det.detect(vid, now);
      if (running) {
        detMs = detN <= 2 ? r.ms : 0.85 * detMs + 0.15 * r.ms; detN++;
        const hands = r.hands;
        if (rec.on) rec.frames.push({ t: Math.round(now - rec.t0), hands: hands.map(h => ({ handed: h.handed, score: +(+h.score).toFixed(3), lm: h.lm.map(p => [+p.x.toFixed(4), +p.y.toFixed(4), +(p.z || 0).toFixed(4)]) })) });
        onHands(hands, performance.now()); drawPreview(hands);
        fpsN++; const n2 = performance.now(); if (n2 - fpsT > 1000) { fps = fpsN * 1000 / (n2 - fpsT); fpsN = 0; fpsT = n2; }
        info = `${delegate} · ${det.kind} · ${fps.toFixed(0)} кадр/с · распознавание ${detMs.toFixed(0)} мс` + (rec.on ? ' · ● ЗАПИСЬ ' + rec.frames.length : '');
        await adapt();
      }
    } catch (e) {
      console.warn('кадр не распознан', e);
      if (delegate === 'GPU' && running) { delegate = await det.init('CPU').catch(() => delegate); detN = 0; tried = true; }
    }
    busy = false;
  }
  schedule();
}
const schedule = () => { if (!running) return; if (vid.requestVideoFrameCallback) vid.requestVideoFrameCallback(() => pump()); else requestAnimationFrame(() => pump()); };

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
function drawPreview(hands) {
  const w = ov.width = vid.videoWidth || 640, h = ov.height = vid.videoHeight || 480; octx.clearRect(0, 0, w, h);
  octx.strokeStyle = '#35e0ff'; octx.lineWidth = 2;
  hands.forEach(({ lm }) => { octx.beginPath(); BONES.forEach(([a, b]) => { octx.moveTo(lm[a].x * w, lm[a].y * h); octx.lineTo(lm[b].x * w, lm[b].y * h); }); octx.stroke(); });
}

async function start() {
  const b = $('go'); b.disabled = true; showErr(''); $('st').textContent = 'загружаю модель рук…';
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('браузер не даёт доступ к камере (нужен https или localhost)');
    await initDetector();
    $('st').textContent = 'жду камеру…';
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false });
    vid.srcObject = stream; await vid.play();
    $('cam').style.display = 'block'; running = true; camOn = true; fpsT = performance.now(); busy = false;
    b.textContent = '✋ Выключить руки'; b.classList.add('on'); b.disabled = false;
    $('st').textContent = 'руки не видно'; schedule();
  } catch (e) {
    console.error(e); b.disabled = false; $('st').textContent = 'камера выключена';
    showErr(e && e.name === 'NotAllowedError' ? 'Нет доступа к камере — разреши её в настройках браузера.' : e && e.name === 'NotFoundError' ? 'Камера не найдена.' : 'Не получилось запустить: ' + (e && e.message || e));
  }
}
function stop() {
  running = false; camOn = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
  $('cam').style.display = 'none'; $('go').textContent = '✋ Включить руки'; $('go').classList.remove('on');
  $('st').textContent = 'камера выключена'; $('st').className = 'chip'; $('md').textContent = ''; info = '';
  frame = ctl.update([], performance.now()); dirty = true;
}
$('go').onclick = () => { if (load('hands.snd') === '1' && !sound.on) setSound(true); running ? stop() : start(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && running) stop(); });

/* ── запись точек рук (для подбора порогов) и повтор ── */
$('rec').onclick = () => {
  if (!rec.on) { if (!running) { showErr('Сначала включи руки — записываются точки с камеры (видео не пишется).'); return; }
    rec.on = true; rec.frames = []; rec.t0 = performance.now(); $('rec').classList.add('on'); $('rec').setAttribute('aria-pressed', 'true'); return; }
  rec.on = false; $('rec').classList.remove('on'); $('rec').setAttribute('aria-pressed', 'false');
  const blob = new Blob([JSON.stringify({ v: 1, ua: navigator.userAgent, video: [vid.videoWidth, vid.videoHeight], delegate, frames: rec.frames })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hands-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
export function replay(rec) {
  const F = rec.frames || [], t0 = performance.now(); let i = 0; feedOn = true;
  const toHands = f => f.hands.map(h => ({ handed: h.handed, score: h.score, lm: h.lm.map(([x, y, z]) => ({ x, y, z })) }));
  const step = () => { const t = performance.now() - t0; while (i < F.length && F[i].t <= t) { onHands(toHands(F[i]), t0 + F[i].t); i++; }
    info = `повтор записи ${Math.min(i, F.length)}/${F.length}`; dirty = true; if (i < F.length) requestAnimationFrame(step); else { feedOn = false; onHands([], performance.now()); } };
  requestAnimationFrame(step);
}
$('replay').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { replay(JSON.parse(await f.text())); } catch (err) { showErr('Не читается запись: ' + err.message); } e.target.value = ''; };
