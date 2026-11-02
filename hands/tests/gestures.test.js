/* Автотесты жестов: node --test hands/tests/
   Синтетические руки (synth.js) → createController().update(hands, t) → проверяем вид, захваты, меню и события.
   Каждый жест — с пороговыми случаями: ±ε у порога, гистерезис, длительность чуть меньше/больше минимальной,
   низкая частота кадров, пропажа руки, вторая рука. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController, CFG, HOME, OneEuro, features, classify } from '../gestures.js';
import { hand, run, events } from './synth.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ожидалось ${b}±${eps}, получено ${a}`);
const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));
/* контроллер с подменяемой целью щипка: tg.v — что «под курсором» */
const mk = (o = {}) => { const tg = { v: null }; const c = createController(Object.assign({ target: () => tg.v, menu: () => MENU }, o)); c.tg = tg; return c; };
const MENU = [{ k: 'up', t: 'Вверх' }, { k: 'right', t: 'Вправо', sub: [{ k: 's0' }, { k: 's1' }, { k: 's2' }, { k: 's3' }] }, { k: 'down', t: 'Вниз' }, { k: 'left', t: 'Влево' }];
const P = (o = {}) => hand(Object.assign({ pose: 'pinch', gap: 0.1 }, o));
const I = (o = {}) => hand(Object.assign({ pose: 'idle' }, o));
const O = (o = {}) => hand(Object.assign({ pose: 'open' }, o));

/* ── щипок: порог, гистерезис, длительность, кадры ── */
test('щипок: чуть ниже порога включения — да, чуть выше — нет', () => {
  for (const [gap, on] of [[CFG.pinchOn - 0.02, true], [CFG.pinchOn + 0.02, false]]) {
    const c = mk(), fr = run(c, 0, 400, () => [P({ gap })]);
    assert.equal(events(fr, 'pinch-on').length > 0, on, 'gap ' + gap);
  }
});
test('щипок: гистерезис — включённый держится до pinchOff', () => {
  const c = mk();
  run(c, 0, 300, () => [P()]);
  let fr = run(c, 333, 900, () => [P({ gap: CFG.pinchOff - 0.03 })]);
  assert.equal(events(fr, 'pinch-off').length, 0, 'не должен отпуститься внутри зоны гистерезиса');
  fr = run(c, 933, 1400, () => [P({ gap: CFG.pinchOff + 0.03 })]);
  assert.equal(events(fr, 'pinch-off').length, 1);
});
test('щипок: короче holdOn — не засчитывается, дольше — засчитывается', () => {
  const f = len => t => [t >= 99 && t < 99 + len ? P() : I()];
  assert.equal(events(run(mk(), 0, 600, f(CFG.holdOn - 30)), 'pinch-on').length, 0);
  assert.equal(events(run(mk(), 0, 600, f(CFG.holdOn + 40)), 'pinch-on').length, 1);
});
test('7 кадров/с: щипок в одном кадре — выброс, в двух подряд — засчитан', () => {
  const dt = 143, one = mk(), two = mk();
  const e1 = events(run(one, 0, 1500, t => [t === 429 ? P() : I()], dt), 'pinch-on');
  const e2 = events(run(two, 0, 1500, t => [t === 429 || t === 572 ? P() : I()], dt), 'pinch-on');
  assert.equal(e1.length, 0, 'один кадр'); assert.equal(e2.length, 1, 'два кадра');
});
test('щипок: пропуск на 1–2 кадра (дрожь пальцев) не отпускает', () => {
  const c = mk(), fr = run(c, 0, 1200, t => [P({ gap: t > 500 && t < 560 ? 0.7 : 0.1 })]);
  assert.equal(events(fr, 'pinch-off').length, 0);
});
test('кулак — не щипок, хотя большой палец лежит на указательном', () => {
  const f = features(hand({ pose: 'fist' }));
  assert.ok(f.pinch < CFG.pinchOn, 'в кулаке кончики 4 и 8 рядом'); assert.equal(classify(f, 'none'), 'fist');
  assert.equal(events(run(mk(), 0, 800, () => [hand({ pose: 'fist' })]), 'pinch-on').length, 0);
});
test('быстрое (смазанное) движение: щипок не начинается, пока рука не замедлится', () => {
  const c = mk();
  run(c, 0, 300, () => [I({ cx: 0.3 })]);
  let fr = run(c, 333, 700, t => [P({ cx: 0.3 + (t - 333) * 0.0012 })]);           /* ~1,2 кадра/с ≈ 10 ладоней/с */
  assert.equal(events(fr, 'pinch-on').length, 0, 'на скорости');
  fr = run(c, 733, 1100, () => [P({ cx: 0.74 })]);
  assert.equal(events(fr, 'pinch-on').length, 1, 'остановилась — щипок');
});

/* ── щипок по пустому месту: вращение и инерция ── */
test('вращение: щипок мимо целей и движение вправо/вниз — yaw уменьшается, pit растёт на rotGain × смещение', () => {
  const c = mk(), y0 = c.view.yaw, p0 = c.view.pit;
  run(c, 0, 300, () => [P({ cx: 0.4, cy: 0.5 })]);
  assert.equal(c.mode, 'rotate', 'по пустому месту вращение — сразу');
  run(c, 333, 1300, t => [P({ cx: lerp(0.4, 0.6, (t - 333) / 700), cy: lerp(0.5, 0.55, (t - 333) / 700) })]);
  run(c, 1333, 1800, () => [P({ cx: 0.6, cy: 0.55 })]);
  near(y0 - c.view.yaw, 0.2 * CFG.rotGain, 0.05, 'yaw');
  near(c.view.pit - p0, 0.05 * CFG.rotGain, 0.04, 'pit');
});
test('вращение: быстрый свайп и отпускание — инерция докручивает и затухает; щипок её ловит', () => {
  const c = mk();
  run(c, 0, 300, () => [P({ cx: 0.3 })]);
  run(c, 333, 600, t => [P({ cx: lerp(0.3, 0.6, (t - 333) / 267) })]);
  const fr = run(c, 633, 900, () => [I({ cx: 0.6 })]);
  assert.equal(events(fr, 'fling').length, 1, 'ждали инерцию');
  const y1 = c.view.yaw; c.tick(1000); assert.ok(c.view.yaw < y1 - 0.02, 'после отпускания модель ещё крутится');
  const fr2 = run(c, 1033, 1300, () => [P({ cx: 0.6 })]);
  assert.equal(events(fr2, 'catch').length, 1); assert.ok(!c.fling, 'щипок остановил инерцию');
});
test('вращение: медленное движение — без инерции; reduced motion — без инерции', () => {
  const c = mk();
  run(c, 0, 300, () => [P({ cx: 0.5 })]);
  run(c, 333, 2300, t => [P({ cx: lerp(0.5, 0.55, (t - 333) / 2000) })]);
  assert.equal(events(run(c, 2333, 2700, () => [I({ cx: 0.55 })]), 'fling').length, 0);
  const d = mk({ reducedMotion: true });
  run(d, 0, 300, () => [P({ cx: 0.3 })]); run(d, 333, 600, t => [P({ cx: lerp(0.3, 0.6, (t - 333) / 267) })]);
  assert.equal(events(run(d, 633, 900, () => [I({ cx: 0.6 })]), 'fling').length, 0);
});
test('7 кадров/с — упрощённый режим: без инерции', () => {
  const c = mk(), dt = 143;
  run(c, 0, 1000, () => [P({ cx: 0.3 })], dt);
  run(c, 1001, 1430, t => [P({ cx: lerp(0.3, 0.55, (t - 1001) / 429) })], dt);
  const fr = run(c, 1573, 2300, () => [I({ cx: 0.55 })], dt);
  assert.ok(fr[0].lowFps, 'режим включился'); assert.equal(events(fr, 'fling').length, 0);
});

/* ── щипок по детали: удержание — «взять», движение — вращение ── */
test('щипок по детали и удержание 400 мс на месте — grab и захват детали, без вращения', () => {
  const c = mk(); c.tg.v = { kind: 'part', id: 'wheel' };
  run(c, 0, 200, () => [I()]);
  let fr = run(c, 233, 560, () => [P()]);
  assert.equal(c.mode, 'pending'); assert.equal(events(fr, 'grab').length, 0, 'раньше 400 мс не берём');
  assert.ok(fr[fr.length - 1].holdP > 0.3 && fr[fr.length - 1].holdP < 1, 'прогресс удержания виден');
  fr = run(c, 593, 900, () => [P()]);
  assert.equal(events(fr, 'grab').length, 1); assert.equal(events(fr, 'drag-start')[0].kind, 'part');
  assert.equal(c.mode, 'drag'); assert.equal(c.view.yaw, HOME.yaw);
  fr = run(c, 933, 1200, t => [P({ cx: lerp(0.5, 0.6, (t - 933) / 200) })]);
  assert.ok(fr.some(f => f.drag && f.drag.dx > 0), 'drag отдаёт смещение курсора'); assert.equal(c.view.yaw, HOME.yaw, 'деталь тянем — модель не вращается');
  fr = run(c, 1233, 1500, () => [I({ cx: 0.6 })]);
  assert.equal(events(fr, 'drag-end').length, 1);
});
test('щипок по детали и сразу движение — вращение, деталь не берётся; смещение с начала не теряется', () => {
  const c = mk(); c.tg.v = { kind: 'part', id: 'body' };
  run(c, 0, 200, () => [I({ cx: 0.4 })]);
  run(c, 233, 330, () => [P({ cx: 0.4 })]);
  const fr = run(c, 363, 900, t => [P({ cx: lerp(0.4, 0.55, (t - 363) / 300) })]);
  assert.equal(events(fr, 'grab').length, 0); assert.equal(c.mode, 'rotate');
  run(c, 933, 1300, () => [P({ cx: 0.55 })]);
  near(HOME.yaw - c.view.yaw, 0.15 * CFG.rotGain, 0.06, 'yaw');
});
test('щипок по детали и отпускание до 400 мс — «тап», без вращения и захвата', () => {
  const c = mk(); c.tg.v = { kind: 'part', id: 'body' };
  run(c, 0, 200, () => [I()]); run(c, 233, 400, () => [P()]);
  const fr = run(c, 433, 700, () => [I()]);
  assert.equal(events(fr, 'tap').length, 1); assert.equal(events(fr, 'grab').length, 0); assert.equal(c.view.yaw, HOME.yaw);
});

/* ── кнопки: нажатие на отпускание ── */
test('кнопка: щипок и отпускание ≤ 800 мс на месте — ui-click; модель не вращается', () => {
  const c = mk(); c.tg.v = { kind: 'ui', el: 'btn' };
  run(c, 0, 200, () => [I()]);
  let fr = run(c, 233, 500, () => [P()]);
  assert.equal(events(fr, 'ui-down').length, 1); assert.equal(events(fr, 'ui-click').length, 0, 'на нажатие ещё не срабатывает');
  fr = run(c, 533, 800, () => [I()]);
  assert.equal(events(fr, 'ui-click').length, 1); assert.equal(events(fr, 'ui-click')[0].target.el, 'btn');
  assert.equal(c.view.yaw, HOME.yaw);
});
test('кнопка: держал дольше 800 мс или увёл курсор — отмена без нажатия', () => {
  const a = mk(); a.tg.v = { kind: 'ui' };
  run(a, 0, 200, () => [I()]); run(a, 233, 1300, () => [P()]);
  let fr = run(a, 1333, 1600, () => [I()]);
  assert.equal(events(fr, 'ui-click').length, 0); assert.equal(events(fr, 'ui-cancel').length, 1);
  const b = mk(); b.tg.v = { kind: 'ui' };
  run(b, 0, 200, () => [I({ cx: 0.5 })]); run(b, 233, 330, () => [P({ cx: 0.5 })]);
  run(b, 363, 600, t => [P({ cx: lerp(0.5, 0.56, (t - 363) / 200) })]);
  fr = run(b, 633, 900, () => [I({ cx: 0.56 })]);
  assert.equal(events(fr, 'ui-click').length, 0, 'курсор ушёл'); assert.equal(b.view.yaw, HOME.yaw);
});
test('ползунок: захват на щипке, смещение курсора идёт в drag, вторая рука не перехватывает', () => {
  const c = mk(); c.tg.v = { kind: 'slider', k: 'explode' };
  run(c, 0, 200, () => [I({ cx: 0.4 }), I({ cx: 0.75, seed: 3 })]);
  let fr = run(c, 233, 400, () => [P({ cx: 0.4 }), I({ cx: 0.75, seed: 3 })]);
  assert.equal(events(fr, 'drag-start').length, 1); assert.equal(events(fr, 'drag-start')[0].kind, 'slider');
  fr = run(c, 433, 800, t => [P({ cx: lerp(0.4, 0.5, (t - 433) / 300) }), P({ cx: 0.75, seed: 3 })]);
  const sum = fr.reduce((s, f) => s + (f.drag ? f.drag.dx : 0), 0);
  near(sum, 0.1 / (CFG.box.x1 - CFG.box.x0), 0.05, 'Σdx в долях экрана');
  assert.equal(c.mode, 'drag', 'вторая рука не превратила захват в зум'); assert.equal(c.view.zoom, 1);
});

/* ── два щипка: зум и сдвиг ── */
const two = (d, mx = 0.5, o = {}) => [P(Object.assign({ cx: mx - d / 2 }, o)), P(Object.assign({ cx: mx + d / 2, seed: 3 }, o))];
test('зум: развели руки вдвое — зум ×2 (с мёртвой зоной 4 %)', () => {
  const c = mk();
  run(c, 0, 300, () => two(0.3));
  assert.equal(c.mode, 'zoom');
  run(c, 333, 1000, t => two(lerp(0.3, 0.6, (t - 333) / 600)));
  run(c, 1033, 1400, () => two(0.6));
  near(c.view.zoom, 2 / 1.04, 0.12, 'zoom');
});
test('зум: дрожь в пределах мёртвой зоны — не меняет; пределы 0,5…5', () => {
  const c = mk();
  run(c, 0, 300, () => two(0.3)); run(c, 333, 800, t => two(0.3 + 0.006 * Math.sin(t / 50)));
  assert.equal(c.view.zoom, 1);
  run(c, 833, 1400, t => two(lerp(0.3, 0.6, (t - 833) / 400))); run(c, 1433, 2400, t => two(lerp(0.6, 0.06, (t - 1433) / 700)));
  assert.ok(c.view.zoom >= CFG.zoomMin - 1e-9);
});
test('сдвиг: обе руки со щипком ведут вместе — панорама; расстояние то же — зум не меняется', () => {
  const c = mk();
  run(c, 0, 300, () => two(0.3, 0.45)); run(c, 333, 1000, t => two(0.3, lerp(0.45, 0.55, (t - 333) / 600))); run(c, 1033, 1300, () => two(0.3, 0.55));
  assert.ok(c.view.panX < -0.05, 'panX ' + c.view.panX); near(c.view.zoom, 1, 0.01);
});
test('зум: руки ближе 1,5 ладони — заморозка и предупреждение', () => {
  const c = mk();
  run(c, 0, 300, () => two(0.4));
  const fr = run(c, 333, 900, t => two(lerp(0.4, 0.14, (t - 333) / 300)));
  assert.ok(fr[fr.length - 1].close, 'флаг «слишком близко»');
  const z = c.view.zoom; run(c, 933, 1200, () => two(0.12)); assert.equal(c.view.zoom, z);
});
test('после зума оставшийся щипок не вращает, пока не щипнуть заново; вторая рука в вращении — переход в зум', () => {
  const c = mk();
  run(c, 0, 300, () => two(0.3));
  run(c, 333, 600, () => [P({ cx: 0.35 }), I({ cx: 0.65, seed: 3 })]);
  assert.equal(c.mode, 'wait');
  const y = c.view.yaw; run(c, 633, 1100, t => [P({ cx: lerp(0.35, 0.5, (t - 633) / 400) })]); assert.equal(c.view.yaw, y);
  run(c, 1133, 1400, () => [I({ cx: 0.5 })]); run(c, 1433, 1700, () => [P({ cx: 0.5 })]);
  assert.equal(c.mode, 'rotate', 'свежий щипок вращает');
  run(c, 1733, 2000, () => [P({ cx: 0.5 }), P({ cx: 0.8, seed: 3 })]);
  assert.equal(c.mode, 'zoom');
});

/* ── меню ладонью ── */
const armOpen = (c, from = 0, o = {}) => run(c, from, from + 700, () => [O(o)]);
test('ладонь 400 мс — меню ещё нет, 500 мс — открылось; прогресс виден', () => {
  const c = mk();
  let fr = run(c, 0, 400, () => [O()]);
  assert.equal(events(fr, 'menu-open').length, 0); assert.ok(fr[fr.length - 1].armP > 0.5);
  fr = run(c, 433, 700, () => [O()]);
  assert.equal(events(fr, 'menu-open').length, 1); assert.equal(c.mode, 'menu'); assert.ok(fr[fr.length - 1].menu);
});
test('меню: щипок в центре — «сброс»; увёл вправо и щипнул — подменю, вниз и щипнул — пункт подменю', () => {
  const c = mk();
  armOpen(c);
  let fr = run(c, 733, 900, () => [P()]);
  assert.deepEqual(events(fr, 'menu').map(e => e.key), ['reset']); assert.equal(c.mode, 'idle');
  const d = mk();
  armOpen(d);
  run(d, 733, 1100, t => [O({ cx: lerp(0.5, 0.58, (t - 733) / 200) })]);
  assert.equal(d.frame.menu.sel, 1, 'сектор «вправо»');
  fr = run(d, 1133, 1300, () => [P({ cx: 0.58 })]);
  assert.equal(events(fr, 'menu-open').length, 1, 'подменю'); assert.equal(d.frame.menu.level, 1);
  run(d, 1333, 1500, () => [I({ cx: 0.58 })]);
  run(d, 1533, 1900, t => [I({ cx: 0.58, cy: lerp(0.55, 0.63, (t - 1533) / 200) })]);
  assert.equal(d.frame.menu.sel, 2, 'сектор «вниз»');
  fr = run(d, 1933, 2100, () => [P({ cx: 0.58, cy: 0.63 })]);
  assert.deepEqual(events(fr, 'menu').map(e => [e.key, e.parent]), [['s2', 'right']]);
});
test('меню: кулак закрывает; рука пропала дольше 250 мс — закрывается; сразу после выбора не открывается снова', () => {
  const a = mk(); armOpen(a);
  let fr = run(a, 733, 1000, () => [hand({ pose: 'fist' })]);
  assert.equal(events(fr, 'menu-close').length, 1); assert.equal(a.mode, 'idle');
  const b = mk(); armOpen(b);
  fr = run(b, 733, 1100, () => []);
  assert.equal(events(fr, 'menu-close').length, 1);
  const c = mk(); armOpen(c);
  run(c, 733, 900, () => [P()]);                                         /* выбрал «сброс» */
  fr = run(c, 933, 1500, () => [O()]);
  assert.equal(events(fr, 'menu-open').length, 0, 'та же ладонь сразу — не открывает');
});
test('меню не открывается, пока другая рука щиплет, и на взмахе', () => {
  const c = mk();
  const fr = run(c, 0, 1200, () => [O({ cx: 0.3 }), P({ cx: 0.75, seed: 3 })]);
  assert.equal(events(fr, 'menu-open').length, 0);
  const d = mk();
  const fr2 = run(d, 0, 1200, t => [O({ cx: 0.5 + 0.12 * Math.sin(t / 80) })]);
  assert.equal(events(fr2, 'menu-open').length, 0);
});

/* ── надёжность: край, расстояние, пропуски, перестановка ── */
test('рука у края кадра и далёкая рука не управляют', () => {
  const c = mk();
  let fr = run(c, 0, 600, () => [P({ cx: 0.02 })]);
  assert.equal(events(fr, 'pinch-on').length, 0); assert.ok(fr[fr.length - 1].hands[0].ignored);
  fr = run(mk(), 0, 600, () => [P({ size: 0.03 })]);
  assert.equal(events(fr, 'pinch-on').length, 0);
});
test('пропуск руки 200 мс во время вращения — продолжает без скачка; 400 мс — конец без инерции', () => {
  const c = mk();
  run(c, 0, 300, () => [P({ cx: 0.4 })]);
  run(c, 333, 600, t => [P({ cx: lerp(0.4, 0.45, (t - 333) / 267) })]);
  run(c, 633, 820, () => []);
  assert.equal(c.mode, 'rotate', 'держим');
  const y = c.view.yaw;
  run(c, 853, 900, () => [P({ cx: 0.5 })]);                              /* вернулась дальше — без скачка */
  near(c.view.yaw, y, 0.02, 'нет рывка');
  const fr = run(c, 933, 1500, () => []);
  assert.equal(c.mode, 'idle'); assert.equal(events(fr, 'fling').length, 0);
});
test('перестановка рук в массиве MediaPipe не путает треки', () => {
  const c = mk();
  const A = { cx: 0.3 }, B = { cx: 0.7, seed: 3 };
  run(c, 0, 300, t => (Math.floor(t / 33) % 2 ? [P(A), I(B)] : [I(B), P(A)]));
  assert.equal(c.tracks.length, 2); assert.equal(c.mode, 'rotate');
});
test('низкий score — рука отбрасывается', () => {
  const c = mk(), fr = run(c, 0, 400, () => [{ lm: P(), score: 0.3 }]);
  assert.equal(fr[fr.length - 1].hands.length, 0);
});

/* ── курсор ── */
test('курсор: доли экрана в пределах 0..1; рабочая зона растянута на экран', () => {
  const c = mk();
  run(c, 0, 400, () => [I({ cx: 0.5, cy: 0.52 })]);
  const a = c.frame.hands[0].cursor;
  run(c, 433, 900, () => [I({ cx: 0.6, cy: 0.52 })]);
  const b = c.frame.hands[0].cursor;
  near(b.x - a.x, 0.1 / (CFG.box.x1 - CFG.box.x0), 0.03, 'Δx экрана');
  for (const p of [a, b]) assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  run(c, 933, 1300, () => [I({ cx: 0.95 })]); assert.equal(c.frame.hands[0].cursor.x, 1, 'у края зоны — к краю экрана');
});
test('курсор: шум точек σ = 0,002 кадра — курсор в покое дрожит меньше 0,4 % экрана', () => {
  const c = mk(); let s = 1; const xs = [];
  run(c, 0, 600, () => [I({ noise: 0.002, seed: s++ })]);
  run(c, 633, 2000, () => [I({ noise: 0.002, seed: s++ })]).forEach(f => xs.push(f.hands[0].cursor.x));
  const m = xs.reduce((a, b) => a + b) / xs.length, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  assert.ok(sd < 0.004, 'σ курсора ' + sd.toFixed(4));
});
test('цель щипка — где был курсор до смыкания', () => {
  const seen = [];
  const c = createController({ target: (x, y) => { seen.push(x); return null; } });
  run(c, 0, 500, () => [I({ cx: 0.5 })]);
  const before = c.frame.hands[0].cursor.x;
  run(c, 533, 700, () => [P({ cx: 0.5 })]);
  near(seen[0], before, 0.005, 'aim');
});

/* ── фильтр ── */
test('фильтр 1€: постоянный сигнал не искажается, скачок догоняется', () => {
  const f = new OneEuro(CFG.euro); let v;
  for (let t = 0; t < 500; t += 33) v = f.f(0.5, t);
  near(v, 0.5, 1e-9);
  for (let t = 500; t < 1500; t += 33) v = f.f(0.7, t);
  near(v, 0.7, 0.005);
});
