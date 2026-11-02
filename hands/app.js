/* Голограмма варианта 5: сборка страницы — камера и MediaPipe, жесты, мышь/касания, рендер, HUD, звук, запись.
   Логика жестов — в gestures.js (чистая, с тестами), рисование — holo.js и hud.js. */
import DATA from './v5.js';
import { createHolo } from './holo.js';
import { createHud } from './hud.js';
import { createController, HOME, VIEWS } from './gestures.js';
import { sound } from './sound.js';
import { createCoach } from './coach.js';

const $ = id => document.getElementById(id);
/* кнопка панели: иконка + подпись */
const tool = (id, icon, text) => { const b = document.getElementById(id); b.querySelector('i').textContent = icon; b.querySelector('span').textContent = text; };
const showErr = m => { const e = $('err'); e.textContent = m; e.style.display = m ? 'block' : 'none'; };
const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const reduced = () => RM.matches;

/* ── 3D ── */
let holo = null;
const gpuName = (() => { try { const g = document.createElement('canvas').getContext('webgl'), x = g && g.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : (g ? g.getParameter(g.RENDERER) : 'нет WebGL'); } catch (_) { return '?'; } })();
/* слабая графика: встроенная Intel HD/UHD (без Iris) — Chrome сам помечает MSAA на ней как «неприемлемо медленный»;
   программный рендер (SwiftShader, llvmpipe, Microsoft Basic Render) — тем более. Для них: без MSAA, разрешение 80 %,
   3D не чаще 30 кадров/с, распознавание рук — сначала на процессоре (видеокарта и так занята голограммой) */
const SOFT = /swiftshader|llvmpipe|basic render|software/i.test(gpuName);
const WEAK = SOFT || (/intel/i.test(gpuName) && /(uhd|hd) graphics/i.test(gpuName) && !/iris/i.test(gpuName));
try { holo = createHolo($('gl'), DATA, { antialias: !WEAK, scale: WEAK ? 0.8 : 1 }); } catch (e) { console.error(e); }
if (SOFT) setTimeout(() => showErr('Браузер рисует 3D без видеокарты (программно) — будет медленно.\nВключи «Использовать аппаратное ускорение» в настройках браузера и перезапусти его.'), 400);
if (!holo) showErr('WebGL недоступен — голограмма не покажется.');
const hud = createHud($('hud'));
const ctl = createController({ reducedMotion: reduced() });
RM.addEventListener && RM.addEventListener('change', () => { ctl.reduced = reduced(); });
const view = ctl.view;
let frame = null, dirty = true, info = '', helpDim = false;
const store = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} };
const load = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };

/* ── отрисовка: каждый кадр, пока что-то движется или идёт камера (мерцание); иначе — по изменению ── */
let camOn = false, lastDraw = 0, lastT = 0;
/* показанный вид плавно догоняет вид контроллера каждый кадр экрана (экспонента, τ = 40 мс):
   руки распознаются 15–30 раз в секунду, а экран — 60; без этого деталь двигалась бы ступеньками */
const shown = Object.assign({}, view), FOLLOW = ['yaw', 'pit', 'zoom', 'panX', 'panY', 'explode'];
function follow(t) {
  const dt = Math.min(100, Math.max(0, t - lastT)); lastT = t;
  let d = 0;
  FOLLOW.forEach(key => { let e = view[key] - shown[key]; const k = reduced() ? 1 : 1 - Math.exp(-dt / (key === 'explode' ? 50 : 16));
    if (key === 'zoom') { shown.zoom = Math.exp(Math.log(shown.zoom) + (Math.log(view.zoom) - Math.log(shown.zoom)) * k); d = Math.max(d, Math.abs(e) / view.zoom); return; }
    shown[key] += e * k; d = Math.max(d, Math.abs(e)); });
  if (d < 1e-4) FOLLOW.forEach(key => { shown[key] = view[key]; });
  return d >= 1e-4;
}
/* ── «Угол Монжа»: 0 — выкл, 1 — угол плоскостей вокруг детали, 2 — развёрнутый эпюр ── */
const MG = { stage: 0, a: 0, u: 0, ta: 0, tu: 0 };
function mongeTo(stage) {
  MG.stage = stage; MG.ta = stage ? 1 : 0; MG.tu = stage === 2 ? 1 : 0; cut = null;
  if (stage) manual.explodeTo(0);
  const T = stage === 1 ? { yaw: 0.72, pit: 0.5, zoom: 1, panX: 0, panY: 0 } : stage === 2 ? { yaw: 0, pit: 1e-4, zoom: 1, panX: 0, panY: 0 } : HOME;
  ctl.reset(performance.now(), Object.assign({}, T, stage ? {} : { explode: view.explode }));
  tool('mg', '📐', ['Эпюр', 'Развернуть', 'Выйти'][stage]); $('mg').classList.toggle('on', !!stage);
  sound.play([{ type: 'view' }]); dirty = true;
}
function mongeAnim(dt) {
  const k = reduced() ? 1 : 1 - Math.exp(-dt / 220); let mv = false;
  for (const [x, tx] of [['a', 'ta'], ['u', 'tu']]) { const e = MG[tx] - MG[x]; if (Math.abs(e) > 1e-3) { MG[x] += e * k; mv = true; } else MG[x] = MG[tx]; }
  return mv;
}
const mongeLabels = () => {
  const info = holo && holo.mongeInfo(); if (!info || MG.a < 0.3) return null;
  const N = { p1: 'П₁ — горизонтальная', p2: 'П₂ — фронтальная', p3: 'П₃ — профильная' };
  return Object.keys(N).map(k => { const f = info.frame(k, MG.u), q = holo.project(k === 'p1' ? f[0] : f[3]); return q && { x: q[0] + 6, y: q[1] + (k === 'p1' ? -8 : 16), text: N[k] }; }).filter(Boolean);
};

/* ── «Проверь себя»: покажи часть — указкой (задержать 0,9 с) или щелчком мыши ── */
const QUIZ = [
  { id: 'flange', q: 'Покажи фланец' }, { id: 'cone', q: 'Покажи усечённый конус' },
  { id: 'pyr', q: 'Покажи материал, вынутый сквозным пирамидальным отверстием' }, { id: 'holes', q: 'Покажи материал, вынутый отверстиями Ø10' }
];
const NAMES = { flange: 'фланец', cone: 'усечённый конус', pyr: 'пирамидальное отверстие', holes: 'отверстия Ø10' };
const quiz = { on: false, list: [], i: 0, score: 0, tries: 0, dwell: null, msg: '', msgT: 0 };
function quizStart() {
  mongeTo(0); cut = null; manual.explodeTo(1);
  quiz.on = true; quiz.list = QUIZ.slice().sort(() => Math.random() - 0.5); quiz.i = 0; quiz.score = 0; quiz.tries = 0; quiz.msg = ''; quizShow();
}
function quizAnswer(id, now) {
  if (!quiz.on || quiz.i >= quiz.list.length) return;
  const Q = quiz.list[quiz.i];
  if (id === Q.id) { if (!quiz.tries) quiz.score++; quiz.i++; quiz.tries = 0; quiz.msg = '✓ Верно!'; sound.play([{ type: 'view' }]); }
  else { quiz.tries++; quiz.msg = `✗ Это ${NAMES[id] || 'не то'}. Попробуй ещё`; sound.play([{ type: 'pinch-off' }]); }
  quiz.msgT = now; quizShow();
}
function quizShow() {
  const el = $('quiz'); el.hidden = !quiz.on; if (!quiz.on) return;
  const done = quiz.i >= quiz.list.length;
  el.innerHTML = done
    ? `<b>Результат: ${quiz.score} из ${quiz.list.length}</b><p>${quiz.score === quiz.list.length ? 'Отлично — деталь читаешь уверенно.' : 'Пройди ещё раз — с первой попытки засчитываются только верные ответы.'}</p><button type="button" id="qa">Ещё раз</button> <button type="button" id="qx">Закрыть</button>`
    : `<small>Проверь себя · ${quiz.i + 1} из ${quiz.list.length}</small><b>${quiz.list[quiz.i].q}</b><p>☝️ Наведи указательный палец и задержи — или щёлкни мышью.</p><p class="qm">${quiz.msg}</p><button type="button" id="qx">Закрыть</button>`;
  el.querySelector('#qx').onclick = () => { quiz.on = false; quizShow(); };
  const again = el.querySelector('#qa'); if (again) again.onclick = quizStart;
}
function quizDwell(now) {
  if (!quiz.on || !pointer || pointer.mouse || !pointer.hover) { if (quiz.dwell) quiz.dwell = null; return; }
  if (!quiz.dwell || quiz.dwell.id !== pointer.hover) quiz.dwell = { id: pointer.hover, t: now };
  pointer.dwell = Math.min(1, (now - quiz.dwell.t) / 900);
  if (pointer.dwell >= 1) { quizAnswer(pointer.hover, now); quiz.dwell = { id: '__', t: now }; }
}

function render(t) {
  const dtR = Math.min(100, t - (render.t || t));
  const moving = ctl.tick(t) | manual.anim() | follow(t) | mongeAnim(dtR) | attract(dtR);
  render.t = t; quizDwell(t); if (pointer) pointer.quiz = quiz.on;          /* в «Проверь себя» подпись под пальцем выдала бы ответ */
  if (!holo) return;
  /* только «фон» (мерцание голограммы) — не чаще 30 кадров/с: меньше нагрузка, процессор остаётся распознаванию */
  const ambient = !reduced() && holo.mode === 'holo';
  /* слабая графика — не чаще 30 кадров/с: руки всё равно обновляются не чаще, а видеокарта вдвое свободнее */
  if ((dirty || moving || (ambient && t - lastDraw > 31)) && (!WEAK || t - lastDraw > 30)) {
    lastDraw = t;
    holo.draw(shown, t, { reduced: reduced(), clip: cut, hover: pointer && pointer.hover, monge: MG.a > 0.001 ? { a: MG.a, u: MG.u } : null });
    const handsMoving = hud.draw({ frame: camOn || feedOn ? frame : null, view: shown, holo, t, reduced: reduced(), info, pointer, section: cut && cutLabel(), planes: mongeLabels(), showLabels: !quiz.on && !MG.stage,
      inset: innerWidth <= 720 ? { l: 0, b: 64 } : { l: 76, b: 0 } });   /* панель инструментов: слева или снизу */   /* в тесте выноски выдали бы ответы */
    if (handsMoving) dirty = true;
    /* подсказка уходит, когда мешает: идёт жест или деталь разобрана (слева — выноски) */
    const dim = view.explode > 0.02 || MG.stage > 0 || quiz.on || coach.active || (frame && frame.mode !== 'idle' && (camOn || feedOn));
    if (dim !== helpDim) { helpDim = dim; $('help').classList.toggle('dim', dim); }
    if (!handsMoving) dirty = false;
  }
}
/* адаптивное разрешение: смотрим на интервал между кадрами браузера, пока картинка обновляется непрерывно.
   Не успеваем (> 24 мс, меньше ~40 кадров/с) — снижаем разрешение рендера на 20 %; есть запас 3 с подряд — поднимаем. */
const perf = { last: 0, ema: 16, n: 0, t0: 0, good: 0 };
function adaptScale(t) {
  if (!holo) return;
  const dt = t - perf.last; perf.last = t;
  if (dt <= 0 || dt > 250) return;                             /* вкладка была в фоне */
  perf.ema = 0.9 * perf.ema + 0.1 * dt;
  if (t - perf.t0 < 1000) return; perf.t0 = t;
  if (perf.ema > 24 && holo.scale > 0.45) { holo.setScale(holo.scale * 0.8); perf.good = 0; dirty = true; }
  else if (perf.ema < 18 && holo.scale < 1 && ++perf.good >= 3) { holo.setScale(holo.scale * 1.15); perf.good = 0; dirty = true; }
}
window.__perf = () => ({ frameMs: +perf.ema.toFixed(1), scale: holo ? +holo.scale.toFixed(2) : 0 });
function loop(t) { render(t); adaptScale(t); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
if (holo) holo.scan(performance.now() + 200);

/* ── режим: голограмма / чертёж ── */
function setMode(m) { holo && holo.setMode(m); tool('mode', m === 'draft' ? '✨' : '📄', m === 'draft' ? 'Голограмма' : 'Чертёж'); $('mode').setAttribute('aria-pressed', m === 'draft'); store('hands.mode', m); dirty = true; }
$('mode').onclick = () => setMode(holo && holo.mode === 'draft' ? 'holo' : 'draft');
setMode(load('hands.mode') === 'draft' ? 'draft' : 'holo');

/* ── звук ── */
function setSound(v) { sound.set(v); tool('snd', v ? '🔊' : '🔇', 'Звук'); $('snd').classList.toggle('on', v); $('snd').setAttribute('aria-pressed', v); store('hands.snd', v ? '1' : undefined); }
$('snd').onclick = () => setSound(!sound.on);
if (load('hands.snd') === '1') tool('snd', '🔊', 'Звук');       /* звук включится по первому нажатию — так требует браузер */

/* ── жесты: общий вход для камеры, повтора записи и тестов ── */
let feedOn = false;
/* ── разрез и указка: экранные жесты → мир (нужна камера рендера) ──
   cut = { n, w, kind } — убираем dot(n, p) > w. Плоскость остаётся, когда ладонь ушла; убирает её сброс (ладонь 1,5 с, R, Esc). */
let cut = null, pointer = null;
const snapAxis = v => (Math.abs(v[0]) >= Math.abs(v[1]) ? [Math.sign(v[0]) || 1, 0, 0] : [0, Math.sign(v[1]) || 1, 0]);
function bladeToCut(b) {
  const c = holo && holo.camera(); if (!c) return;
  const S = hud.map(b), lin = (P0, P1, target, k) => { const a = holo.project(P0, c), q = holo.project(P1, c); const den = q[k] - a[k]; return Math.abs(den) < 15 ? null : (target - a[k]) / den; };
  if (b.kind === 'h') {                                   /* горизонтальный разрез: z по высоте ладони на экране; убираем верх */
    const u = lin([0, 0, 0], [0, 0, 100], S.y, 1); if (u == null) return;      /* смотрим строго сверху — высоту не задать */
    cut = { n: [0, 0, 1], w: u * 100, kind: 'h' };
  } else {                                                /* вертикальный: плоскость ⟂ оси детали, ближайшей к «вправо» на экране */
    const n = snapAxis(c.Rv), u = lin([0, 0, 0], n.map(v => v * 100), S.x, 0); if (u == null) return;
    let w = u * 100, nn = n;
    /* убираем ту половину, что ближе к зрителю — срез смотрит на нас */
    const toEye = nn[0] * -c.F[0] + nn[1] * -c.F[1], toRight = nn[0] * c.Rv[0] + nn[1] * c.Rv[1];
    if (Math.abs(toEye) > 0.05 ? toEye < 0 : toRight < 0) { nn = nn.map(v => -v); w = -w; }   /* срез ребром (главный вид) — убираем правую половину */
    cut = { n: nn, w, kind: Math.abs(n[1]) > 0.5 ? 'front' : 'profile' };
  }
}
const cutLabel = () => {
  const ax = Math.abs(cut.n[2]) > 0.5 ? 'z' : Math.abs(cut.n[1]) > 0.5 ? 'y' : 'x', val = cut.w * (cut.n[0] + cut.n[1] + cut.n[2]);
  return { title: cut.kind === 'h' ? 'горизонтальный разрез' : cut.kind === 'front' ? 'фронтальный разрез' : 'профильный разрез',
    value: `${ax} = ${val.toFixed(0)} мм`, hint: frame && frame.mode === 'section' ? '' : 'ладонь 1,5 с или R — убрать разрез' };
};
function onHands(hands, t) {
  frame = ctl.update(hands, t);
  sound.play(frame.events);
  coach.update(frame, view, frame.events, camOn || feedOn);
  frame.events.forEach(e => {
    if (e.type === 'reset') { holo && holo.scan(t); cut = null; if (MG.stage) mongeTo(0); }
    if (e.type === 'clap') {                               /* хлопок: деталь разлетается / собирается, по экрану — ударная волна */
      if (MG.stage) mongeTo(MG.stage === 1 ? 2 : 1); else manual.explodeTo(view.explode > 0.5 ? 0 : 1);
      const hs = frame.hands.filter(h => h.palmC), m = hs.length ? hs.reduce((a, h) => ({ x: a.x + h.palmC.x / hs.length, y: a.y + h.palmC.y / hs.length }), { x: 0, y: 0 }) : { x: 0.5, y: 0.5 };
      const S = hud.map(m); hud.effect('shock', S.x, S.y, performance.now());
    }
    if (e.type === 'snap') { const h = frame.hands.find(q => q.id === e.id); if (h && h.pts) { const S = hud.map(h.pts[12]); hud.effect('snap', S.x, S.y, performance.now()); } }
  });
  if (frame.blade) bladeToCut(frame.blade);
  if (frame.point && holo) { const S = hud.map(frame.point); pointer = { x: S.x, y: S.y, hover: holo.pick(S.x, S.y, cut) }; } else pointer = null;
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
window.__app = { shown, MG, mongeTo, quiz, quizStart, quizAnswer, view, ctl, holo, HOME, get cut() { return cut; }, set cut(c) { cut = c; dirty = true; }, get pointer() { return pointer; }, render: t => { dirty = true; lastDraw = -1e9; render(t); },   /* принудительно: для тестов и снимков */ get frame() { return frame; } };

/* ── приглашение и карточка жестов ── */
$('cta').onclick = () => $('go').click();
let helpOpen = load('hands.help') !== '0' && innerWidth > 720;          /* на телефоне карточка закрыла бы деталь — по кнопке */
const setHelp = v => { helpOpen = v; $('help').classList.toggle('closed', !v); $('helpBtn').setAttribute('aria-expanded', v); $('helpBtn').classList.toggle('on', v); store('hands.help', v ? undefined : '0'); dirty = true; };
$('helpBtn').onclick = () => setHelp(!helpOpen); $('helpX').onclick = () => setHelp(false);
setHelp(helpOpen);
/* меню «Ещё» закрывается по выбору пункта и по щелчку мимо */
$('more').addEventListener('click', e => { if (e.target.closest('.menu button')) $('more').open = false; });
document.addEventListener('pointerdown', e => { if (!e.target.closest('#more')) $('more').open = false; });

/* витрина: пока страницей не пользуются (камера выключена, 6 с без мыши и клавиш) — деталь медленно вращается */
let lastInput = performance.now();
['pointerdown', 'wheel', 'keydown'].forEach(t => addEventListener(t, () => { lastInput = performance.now(); }, { passive: true }));
function attract(dt) {
  if (camOn || feedOn || reduced() || quiz.on || MG.stage || ctl.busy() || performance.now() - lastInput < 6000) return false;
  view.yaw += dt * 0.00018; return true;
}

/* ── обучение и подсказка ── */
const coach = createCoach($('stage'), { store, load, onStep: () => sound.play([{ type: 'view' }]) });
$('tutor').onclick = () => coach.start();
$('mg').onclick = () => mongeTo((MG.stage + 1) % 3);
$('qz').onclick = () => (quiz.on ? (quiz.on = false, quizShow()) : quizStart());

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
cv.addEventListener('dblclick', () => { ctl.reset(performance.now()); holo && holo.scan(performance.now()); cut = null; });
/* мышь: наведение — та же подсветка части, что у указки пальцем */
cv.addEventListener('pointermove', e => { if (pts.size || (frame && frame.point)) return; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const hv = holo && holo.pick(x, y, cut); const nw = hv ? { x, y, hover: hv, mouse: true } : null; if ((nw && nw.hover) !== (pointer && pointer.hover)) dirty = true; pointer = nw; if (nw) dirty = true; });
cv.addEventListener('click', e => { if (!quiz.on) return; const r = cv.getBoundingClientRect(), id = holo && holo.pick(e.clientX - r.left, e.clientY - r.top, cut); if (id) quizAnswer(id, performance.now()); });
cv.addEventListener('pointerleave', () => { if (!(frame && frame.point)) { pointer = null; dirty = true; } });
addEventListener('resize', () => { dirty = true; });
addEventListener('keydown', e => {
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'e' || k === 'у') manual.explodeTo(view.explode > 0.5 ? 0 : 1);
  else if (k === 'r' || k === 'к' || k === 'escape') { ctl.reset(performance.now()); holo && holo.scan(performance.now()); cut = null; }
  else if (k === 'm' || k === 'ь') mongeTo((MG.stage + 1) % 3);
  else if (k === 'x' || k === 'ч') cut = cut ? null : { n: [0, -1, 0], w: 0, kind: 'front' };          /* фронтальный разрез по оси — для мыши */
  else if (k === 'v' || k === 'м') { const V = VIEWS[ctl.viewIdx = (ctl.viewIdx + 1) % VIEWS.length]; ctl.reset(performance.now(), { yaw: V.yaw, pit: V.pit, panX: 0, panY: 0 }); }
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
    async detect(v, t) {
      /* в поток — кадр 480 px по ширине: MediaPipe всё равно ужимает до 192–224 px, а копировать вдвое меньше */
      const w = 480, h = Math.round(w * (v.videoHeight || 480) / (v.videoWidth || 640));
      const bitmap = await createImageBitmap(v, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' });
      return call({ type: 'frame', bitmap, t }, [bitmap]); },
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
      const mk = dd => HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/hand_landmarker_lite.task', delegate: dd }, runningMode: 'VIDEO', numHands: 2,
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
  if (det) { const want = calibStart(); if (want !== delegate) { delegate = await det.init(want); detN = 0; } return; }
  if (window.Worker && window.createImageBitmap && window.OffscreenCanvas) {
    const d = workerDetector();
    try { delegate = await d.init(calibStart()); det = d; return; } catch (e) { console.warn('воркер распознавания не поднялся, работаю в основном потоке', e); d.close(); }
  }
  const d = mainDetector(); delegate = await d.init(calibStart()); det = d;
}
/* калибровка делегата на этой машине: 2,5 с на GPU и 2,5 с на CPU; берём, где лучше вместе и руки, и экран.
   На встроенной графике MediaPipe-GPU делит видеокарту с голограммой: руки быстрые, а экран дёргается —
   поэтому в оценке и время распознавания, и интервал кадров экрана. Выбор запоминается для этой видеокарты. */
const calib = { phase: '', t0: 0, res: {}, det: [], scr: [] };
const CAL_MS = 2500, calKey = 'hands.delegate.v3:' + gpuName;
function calibStart() {
  const saved = load(calKey);
  if (saved === 'GPU' || saved === 'CPU') { calib.phase = 'done'; calib.res.saved = saved; tried = false; return saved; }
  /* на слабой графике начинаем с CPU: если он хорош, GPU ещё проверим; порядок — ради первого впечатления */
  const first = WEAK ? 'CPU' : 'GPU';
  calib.phase = first; calib.t0 = 0; calib.det = []; calib.scr = []; return first;
}
async function adapt() {
  const now = performance.now();
  if (calib.phase === 'GPU' || calib.phase === 'CPU') {
    if (calib.phase !== delegate) { calib.phase = 'done'; return; }          /* делегат не создался — что есть, то есть */
    if (detN <= 3) return;                                                      /* прогрев */
    if (!calib.t0) calib.t0 = now;
    calib.det.push(detMs); calib.scr.push(perf.ema);
    if (now - calib.t0 < CAL_MS) return;
    const med = a => { const q = [...a].sort((x, y) => x - y); return q[q.length >> 1] || 0; };
    const r = { det: med(calib.det), scr: med(calib.scr) }; r.cost = Math.max(r.det, 33) + 1.5 * Math.max(0, r.scr - 17);
    calib.res[calib.phase] = r; calib.det = []; calib.scr = []; calib.t0 = 0;
    const other = calib.phase === 'GPU' ? 'CPU' : 'GPU';
    if (!calib.res[other]) { calib.phase = other; delegate = await det.init(other); detN = 0; if (delegate !== other) { calib.phase = 'done'; store(calKey, delegate); } return; }
    const best = calib.res.CPU.cost <= calib.res.GPU.cost ? 'CPU' : 'GPU';
    calib.phase = 'done'; store(calKey, best);
    if (best !== delegate) { delegate = await det.init(best); detN = 0; }
    return;
  }
  /* после калибровки — страховка: делегат вдруг стал очень медленным (> 150 мс) — другой, один раз */
  if (!tried && detN > 20 && detMs > 150) { tried = true; delegate = await det.init(delegate === 'GPU' ? 'CPU' : 'GPU'); detN = 0; }
}

/* ── что на самом деле тормозит: камера (мало кадров), распознавание (долго) или ничего ── */
const cam = { n: 0, t: 0, fps: 0, warned: false, t0: 0 };
function perfChip() {
  const now = performance.now(); if (now - cam.t > 900) { cam.fps = cam.n * 1000 / (now - cam.t); cam.n = 0; cam.t = now; }
  const el = $('pf'), calibrating = calib.phase === 'GPU' || calib.phase === 'CPU';
  el.hidden = !camOn;
  el.textContent = calibrating ? `калибровка ${calib.phase}…` : `камера ${cam.fps ? cam.fps.toFixed(0) : '?'} · руки ${fps.toFixed(0)}/с · ${detMs.toFixed(0)} мс`;
  const bad = !calibrating && (fps < 15 || (cam.fps && cam.fps < 20));
  el.className = 'chip perf' + (bad ? ' bad' : fps >= 24 ? ' good' : '');
  /* подсказка — один раз за включение, когда калибровка позади и прошло 4 с */
  if (!calibrating && !cam.warned && now - cam.t0 > 4000 && cam.fps) {
    if (cam.fps < 20) { cam.warned = true; showErr(`Камера отдаёт ${cam.fps.toFixed(0)} кадров/с — мало света: камера сама снижает частоту, чтобы дольше снимать кадр.\nВключи свет спереди (на лицо и руки) — жесты станут плавнее.`); setTimeout(() => showErr(''), 9000); }
    else if (fps < 15) { cam.warned = true; showErr(`Распознавание рук медленное: ${detMs.toFixed(0)} мс на кадр.\nПодключи зарядку (на батарее Windows режет процессор), закрой тяжёлые вкладки и запись экрана.`); setTimeout(() => showErr(''), 9000); }
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
        fpsN++; const n2 = performance.now(); if (n2 - fpsT > 1000) { fps = fpsN * 1000 / (n2 - fpsT); fpsN = 0; fpsT = n2; perfChip(); }
        info = (calib.phase === 'GPU' || calib.phase === 'CPU' ? `калибровка ${calib.phase}… · ` : '') + `${delegate} · ${det.kind} · руки ${fps.toFixed(0)} кадр/с, ${detMs.toFixed(0)} мс · экран ${(1000 / perf.ema).toFixed(0)} кадр/с` + (holo && holo.scale < 0.99 ? ` · разрешение ${Math.round(holo.scale * 100)}%` : '') + (rec.on ? ' · ● ЗАПИСЬ ' + rec.frames.length : '');
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
  const w = vid.videoWidth || 640, h = vid.videoHeight || 480;
  if (ov.width !== w || ov.height !== h) { ov.width = w; ov.height = h; }     /* присваивание размера пересоздаёт холст — только при смене */
  octx.clearRect(0, 0, w, h);
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
    cam.n = 0; cam.t = performance.now(); cam.warned = false; cam.t0 = performance.now();
    if (vid.requestVideoFrameCallback) { const tick = () => { if (!running) return; cam.n++; vid.requestVideoFrameCallback(tick); }; vid.requestVideoFrameCallback(tick); }
    tool('go', '✋', 'Выкл.'); b.classList.add('on'); b.disabled = false; $('cta').hidden = true;
    $('st').textContent = 'руки не видно'; schedule();
    if (coach.firstRun()) coach.start();
  } catch (e) {
    console.error(e); b.disabled = false; $('st').textContent = 'камера выключена';
    showErr(e && e.name === 'NotAllowedError' ? 'Нет доступа к камере — разреши её в настройках браузера.' : e && e.name === 'NotFoundError' ? 'Камера не найдена.' : 'Не получилось запустить: ' + (e && e.message || e));
  }
}
function stop() {
  running = false; camOn = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
  $('cam').style.display = 'none'; tool('go', '✋', 'Руки'); $('go').classList.remove('on'); $('cta').hidden = false;
  $('st').textContent = 'камера выключена'; $('st').className = 'chip'; $('md').textContent = ''; info = '';
  frame = ctl.update([], performance.now()); dirty = true;
}
$('go').onclick = () => { if (load('hands.snd') === '1' && !sound.on) setSound(true); running ? stop() : start(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && running) stop(); });

/* ── диагностика: один клик — отчёт в буфер обмена, чтобы прислать разработчику ── */
function report() {
  const c = $('gl');
  return ['Начерт · голограмма — диагностика', new Date().toISOString(),
    'браузер: ' + navigator.userAgent, 'видеокарта: ' + gpuName + (WEAK ? ' (профиль слабой графики)' : ''),
    `экран: ${innerWidth}×${innerHeight}, DPR ${devicePixelRatio}, холст ${c.width}×${c.height}, разрешение ${holo ? Math.round(holo.scale * 100) : '-'}%`,
    `кадр экрана: ${perf.ema.toFixed(1)} мс (${(1000 / perf.ema).toFixed(0)} кадр/с)`,
    `руки: ${camOn ? `${delegate}, ${det ? det.kind : '-'}, ${fps.toFixed(0)} кадр/с, распознавание ${detMs.toFixed(0)} мс` : 'камера выключена'}`,
    `камера: ${vid.videoWidth}×${vid.videoHeight}`, 'калибровка: ' + JSON.stringify(calib.res),
    `режим: ${holo ? holo.mode : '-'}, reduced-motion: ${reduced()}, ядер: ${navigator.hardwareConcurrency || '?'}`].join('\n');
}
$('diag').onclick = async () => {
  const txt = report();
  try { await navigator.clipboard.writeText(txt); $('diag').textContent = '✓ Скопировано — вставь в чат'; setTimeout(() => { $('diag').textContent = '📋 Диагностика скорости'; }, 2200); }
  catch (_) { showErr(txt); }
};

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
