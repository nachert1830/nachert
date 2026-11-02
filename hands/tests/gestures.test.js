/* Автотесты жестов: node --test hands/tests/
   Синтетические руки (synth.js) → createController().update(hands, t) → проверяем вид и события.
   Каждый жест — с пороговыми случаями: ±ε у порога, гистерезис, длительность чуть меньше/больше минимальной. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController, CFG, HOME, OneEuro } from '../gestures.js';
import { hand, run, events } from './synth.js';

const DT = 33;                                           /* ≈ 30 кадров/с, как у камеры */
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ожидалось ${b}±${eps}, получено ${a}`);
const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));
const ctlNew = (o) => createController(o);

/* ── щипок: порог, гистерезис, минимальная длительность ── */
test('щипок: чуть ниже порога включения — да, чуть выше — нет', () => {
  for (const [gap, on] of [[CFG.pinchOn - 0.02, true], [CFG.pinchOn + 0.02, false]]) {
    const c = ctlNew(), fr = run(c, 0, 400, () => [hand({ pose: 'pinch', gap })]);
    assert.equal(events(fr, 'pinch-on').length > 0, on, 'gap ' + gap);
  }
});
test('щипок: гистерезис — включённый держится до pinchOff', () => {
  const c = ctlNew();
  run(c, 0, 300, () => [hand({ pose: 'pinch', gap: 0.1 })]);
  let fr = run(c, 333, 900, () => [hand({ pose: 'pinch', gap: CFG.pinchOff - 0.03 })]);    /* выше pinchOn, но ниже pinchOff */
  assert.equal(events(fr, 'pinch-off').length, 0, 'не должен отпуститься внутри зоны гистерезиса');
  fr = run(c, 933, 1400, () => [hand({ pose: 'pinch', gap: CFG.pinchOff + 0.03 })]);
  assert.equal(events(fr, 'pinch-off').length, 1);
});
test('щипок: короче holdOn — не засчитывается, дольше — засчитывается', () => {
  const short = ctlNew(), long = ctlNew();
  const f = len => t => [hand({ pose: t >= 99 && t < 99 + len ? 'pinch' : 'idle', gap: 0.1 })];
  assert.equal(events(run(short, 0, 600, f(CFG.holdOn - 30)), 'pinch-on').length, 0);
  assert.equal(events(run(long, 0, 600, f(CFG.holdOn + 40)), 'pinch-on').length, 1);
});
test('щипок: пропуск на 1–2 кадра (дрожь пальцев) не отпускает', () => {
  const c = ctlNew();
  const fr = run(c, 0, 1200, t => [hand({ pose: 'pinch', gap: t > 500 && t < 560 ? 0.7 : 0.1 })]);
  assert.equal(events(fr, 'pinch-off').length, 0);
});

/* ── вращение и инерция ── */
test('вращение: щипок и движение вправо/вниз — yaw уменьшается, pit растёт на rotGain × смещение', () => {
  const c = ctlNew(), y0 = c.view.yaw, p0 = c.view.pit;
  run(c, 0, 300, () => [hand({ pose: 'pinch', gap: 0.1, cx: 0.4, cy: 0.5 })]);
  run(c, 333, 1300, t => [hand({ pose: 'pinch', gap: 0.1, cx: lerp(0.4, 0.6, (t - 333) / 700), cy: lerp(0.5, 0.55, (t - 333) / 700) })]);
  run(c, 1333, 1800, () => [hand({ pose: 'pinch', gap: 0.1, cx: 0.6, cy: 0.55 })]);     /* постоять: фильтр догонит */
  near(y0 - c.view.yaw, 0.2 * CFG.rotGain, 0.05, 'yaw');
  near(c.view.pit - p0, 0.05 * CFG.rotGain, 0.04, 'pit');
  assert.equal(c.frame.mode, 'rotate');
});
test('вращение: быстрый свайп и отпускание — инерция докручивает и затухает', () => {
  const c = ctlNew();
  run(c, 0, 300, () => [hand({ pose: 'pinch', gap: 0.1, cx: 0.3 })]);
  run(c, 333, 600, t => [hand({ pose: 'pinch', gap: 0.1, cx: lerp(0.3, 0.6, (t - 333) / 267) })]);   /* ~1,1 кадра/с */
  const fr = run(c, 633, 900, () => [hand({ pose: 'idle', cx: 0.6 })]);
  assert.equal(events(fr, 'fling').length, 1, 'ждали инерцию');
  const y1 = c.view.yaw; c.tick(1100); const y2 = c.view.yaw; c.tick(3000); c.tick(6000);
  assert.ok(y2 < y1 - 0.05, 'после отпускания модель ещё крутится');
  assert.ok(!c.fling, 'инерция затухла');
});
test('кулак ловит деталь: инерция останавливается; щипок → кулак — без инерции', () => {
  const c = ctlNew();
  run(c, 0, 300, () => [hand({ pose: 'pinch', gap: 0.1, cx: 0.3 })]);
  run(c, 333, 600, t => [hand({ pose: 'pinch', gap: 0.1, cx: lerp(0.3, 0.6, (t - 333) / 267) })]);
  let fr = run(c, 633, 800, () => [hand({ pose: 'idle', cx: 0.6 })]);
  assert.equal(events(fr, 'fling').length, 1);
  fr = run(c, 833, 1200, () => [hand({ pose: 'fist', cx: 0.6 })]);
  assert.equal(events(fr, 'catch').length, 1); assert.ok(!c.fling);
  const y = c.view.yaw; c.tick(2000); assert.equal(c.view.yaw, y, 'после «поимки» не крутится');
  /* щипок сразу в кулак */
  const d = ctlNew();
  run(d, 0, 300, () => [hand({ pose: 'pinch', gap: 0.1, cx: 0.3 })]);
  run(d, 333, 600, t => [hand({ pose: 'pinch', gap: 0.1, cx: lerp(0.3, 0.6, (t - 333) / 267) })]);
  assert.equal(events(run(d, 633, 900, () => [hand({ pose: 'fist', cx: 0.6 })]), 'fling').length, 0);
});
test('вращение: медленное движение — без инерции; сглаживание не даёт рывка при размыкании пальцев', () => {
  const c = ctlNew();
  run(c, 0, 300, () => [hand({ pose: 'pinch', gap: 0.1, cx: 0.5 })]);
  run(c, 333, 2300, t => [hand({ pose: 'pinch', gap: 0.1, cx: lerp(0.5, 0.55, (t - 333) / 2000) })]);
  const y1 = c.view.yaw;
  /* пальцы размыкаются: кончик большого уходит — точка щипка смещается, вид не должен прыгнуть */
  const fr = run(c, 2333, 2700, t => [hand({ pose: 'pinch', gap: lerp(0.1, 0.9, (t - 2333) / 150), cx: 0.55 })]);
  assert.equal(events(fr, 'fling').length, 0);
  near(c.view.yaw, y1, 0.03, 'рывок при отпускании');
});
test('prefers-reduced-motion: инерции нет, сброс без анимации', () => {
  const c = ctlNew({ reducedMotion: true });
  run(c, 0, 300, () => [hand({ pose: 'pinch', gap: 0.1, cx: 0.3 })]);
  run(c, 333, 600, t => [hand({ pose: 'pinch', gap: 0.1, cx: lerp(0.3, 0.6, (t - 333) / 267) })]);
  const fr = run(c, 633, 900, () => [hand({ pose: 'idle', cx: 0.6 })]);
  assert.equal(events(fr, 'fling').length, 0);
  run(c, 933, 2600, () => [hand({ pose: 'open', cx: 0.6 })]);
  assert.deepEqual({ ...c.view }, { ...HOME });
});

/* ── зум ── */
test('зум: два щипка, расстояние 0,3 → 0,45 — зум ×1,5; верхний предел', () => {
  const c = ctlNew(), two = d => [hand({ pose: 'pinch', gap: 0.1, cx: 0.5 - d / 2 }), hand({ pose: 'pinch', gap: 0.1, cx: 0.5 + d / 2, seed: 3 })];
  run(c, 0, 300, () => two(0.3));
  run(c, 333, 1000, t => two(lerp(0.3, 0.45, (t - 333) / 500)));
  run(c, 1033, 1500, () => two(0.45));
  near(c.view.zoom, 1.5, 0.06, 'zoom');
  run(c, 1533, 2500, t => two(lerp(0.45, 0.95, (t - 1533) / 500)));
  assert.ok(c.view.zoom <= CFG.zoomMax);
  assert.equal(c.view.yaw, HOME.yaw, 'зум не вращает');
});
test('зум → одна рука: оставшийся щипок НЕ вращает, пока не щипнуть заново', () => {
  const c = ctlNew(), two = (d, x2) => [hand({ pose: 'pinch', gap: 0.1, cx: 0.35 }), hand({ pose: x2, gap: 0.1, cx: 0.35 + d, seed: 3 })];
  run(c, 0, 400, () => two(0.3, 'pinch'));
  run(c, 433, 800, () => two(0.3, 'idle'));                                    /* правая отпустила */
  run(c, 833, 1500, t => [hand({ pose: 'pinch', gap: 0.1, cx: lerp(0.35, 0.55, (t - 833) / 600) })]);
  assert.equal(c.view.yaw, HOME.yaw, 'вращения быть не должно');
  assert.equal(c.frame.mode, 'wait');
  run(c, 1533, 1800, () => [hand({ pose: 'idle', cx: 0.55 })]);               /* отпустил */
  run(c, 1833, 2600, t => [hand({ pose: 'pinch', gap: 0.1, cx: lerp(0.55, 0.45, (t - 2033) / 400) })]);
  assert.ok(c.view.yaw > HOME.yaw + 0.2, 'свежий щипок вращает');
});

/* ── панорама: щипок + кулак ── */
test('панорама: щипок одной рукой + кулак другой; вращения нет', () => {
  const c = ctlNew(), f = x => [hand({ pose: 'pinch', gap: 0.1, cx: x, cy: 0.5 }), hand({ pose: 'fist', cx: 0.75, seed: 3 })];
  run(c, 0, 300, () => f(0.3));
  run(c, 333, 1000, t => f(lerp(0.3, 0.45, (t - 333) / 500)));
  run(c, 1033, 1400, () => f(0.45));
  assert.equal(c.frame.mode, 'pan');
  near(c.view.panX, -0.15 * CFG.panGain, 0.03, 'panX');
  near(c.view.yaw, HOME.yaw, 1e-9, 'yaw');
});

/* ── разбор: два кулака ── */
test('разбор: развести кулаки на половину explodeSpan — 50 %; свести — 0; пределы 0..1', () => {
  const c = ctlNew(), f = d => [hand({ pose: 'fist', cx: 0.5 - d / 2 }), hand({ pose: 'fist', cx: 0.5 + d / 2, seed: 3 })];
  run(c, 0, 300, () => f(0.2));
  run(c, 333, 900, t => f(lerp(0.2, 0.2 + CFG.explodeSpan / 2, (t - 333) / 400)));
  run(c, 933, 1300, () => f(0.2 + CFG.explodeSpan / 2));
  near(c.view.explode, 0.5, 0.04, 'explode');
  assert.equal(c.frame.mode, 'explode');
  run(c, 1333, 2200, t => f(lerp(0.2 + CFG.explodeSpan / 2, 0.9, (t - 1333) / 400)));
  assert.equal(c.view.explode, 1);
  run(c, 2233, 3200, t => f(lerp(0.9, 0.12, (t - 2233) / 500)));
  assert.equal(c.view.explode, 0);
});
test('разбор держится после того, как руки отпустили', () => {
  const c = ctlNew(), f = d => [hand({ pose: 'fist', cx: 0.5 - d / 2 }), hand({ pose: 'fist', cx: 0.5 + d / 2, seed: 3 })];
  run(c, 0, 300, () => f(0.2)); run(c, 333, 900, t => f(lerp(0.2, 0.5, (t - 333) / 400)));
  const e = c.view.explode; run(c, 933, 1500, () => [hand({ pose: 'idle', cx: 0.35 }), hand({ pose: 'idle', cx: 0.65, seed: 3 })]);
  assert.equal(c.view.explode, e); assert.ok(e > 0.8);
});
test('кулак не путается со щипком (большой палец лежит на указательном)', () => {
  const c = ctlNew(), fr = run(c, 0, 800, () => [hand({ pose: 'fist' })]);
  assert.equal(events(fr, 'pinch-on').length, 0);
  assert.equal(c.frame.hands[0].pose, 'fist');
});

/* ── сброс ── */
test('сброс: ладонь 1,4 с — нет, 1,5 с — да; прогресс для индикатора; один раз за жест', () => {
  const c = ctlNew(); c.view.yaw = 2; c.view.zoom = 3; c.view.explode = 0.7;
  let fr = run(c, 0, 1400 + CFG.holdOn, () => [hand({ pose: 'open' })]);
  assert.equal(events(fr, 'reset').length, 0);
  assert.ok(fr[fr.length - 1].resetP > 0.85 && fr[fr.length - 1].resetP < 1, 'индикатор почти полон');
  fr = run(c, 1400 + CFG.holdOn + DT, 4000, () => [hand({ pose: 'open' })]);
  assert.equal(events(fr, 'reset').length, 1, 'ровно один сброс за жест');
  c.tick(4000 + CFG.resetAnim + 10);
  near(c.view.yaw, HOME.yaw, 1e-6); near(c.view.zoom, 1, 1e-6); near(c.view.explode, 0, 1e-6);
});
test('сброс: ладонь опустили раньше — прогресс обнуляется', () => {
  const c = ctlNew();
  run(c, 0, 1000, () => [hand({ pose: 'open' })]);
  run(c, 1033, 1300, () => [hand({ pose: 'idle' })]);
  const fr = run(c, 1333, 2500, () => [hand({ pose: 'open' })]);
  assert.equal(events(fr, 'reset').length, 0);
});
test('сброс не срабатывает, пока другая рука щиплет', () => {
  const c = ctlNew(), fr = run(c, 0, 2500, () => [hand({ pose: 'open', cx: 0.3 }), hand({ pose: 'pinch', gap: 0.1, cx: 0.7, seed: 3 })]);
  assert.equal(events(fr, 'reset').length, 0);
});

/* ── защита от ложных срабатываний ── */
test('рука у края кадра не управляет; на 2 % дальше от края — управляет', () => {
  for (const [cx, ok] of [[CFG.edge * 0.4, false], [0.1, true]]) {
    const c = ctlNew();
    run(c, 0, 300, () => [hand({ pose: 'pinch', gap: 0.1, cx, size: 0.08 })]);
    run(c, 333, 900, t => [hand({ pose: 'pinch', gap: 0.1, cx, cy: lerp(0.5, 0.65, (t - 333) / 400), size: 0.08 })]);
    assert.equal(c.view.pit !== HOME.pit, ok, 'cx=' + cx);
  }
});
test('рука ушла к краю во время вращения — вращение кончается без инерции', () => {
  const c = ctlNew();
  run(c, 0, 300, () => [hand({ pose: 'pinch', gap: 0.1, cx: 0.6 })]);
  const fr = run(c, 333, 900, t => [hand({ pose: 'pinch', gap: 0.1, cx: lerp(0.6, 0.995, (t - 333) / 200) })]);
  assert.equal(events(fr, 'fling').length, 0);
  assert.notEqual(c.frame.mode, 'rotate');
});
test('слишком далёкая (маленькая) рука не управляет', () => {
  const c = ctlNew(), fr = run(c, 0, 800, () => [hand({ pose: 'pinch', gap: 0.1, size: CFG.minPalm * 0.7 })]);
  assert.equal(events(fr, 'pinch-on').length, 0);
});
test('MediaPipe поменял руки местами в массиве — жест не сбивается', () => {
  const c = ctlNew(), A = () => hand({ pose: 'pinch', gap: 0.1, cx: 0.3 }), B = () => hand({ pose: 'idle', cx: 0.7, seed: 3 });
  const fr = run(c, 0, 1500, t => (Math.floor(t / 66) % 2 ? [A(), B()] : [B(), A()]));
  assert.equal(events(fr, 'pinch-on').length, 1); assert.equal(events(fr, 'pinch-off').length, 0);
  assert.equal(c.tracks.length, 2);
});
test('рука пропала на 100 мс — жест продолжается; на 400 мс — кончается', () => {
  const c = ctlNew(), P = x => [hand({ pose: 'pinch', gap: 0.1, cx: x })];
  run(c, 0, 300, () => P(0.5));
  let fr = run(c, 333, 433, () => []);
  assert.equal(c.frame.mode, 'rotate'); assert.equal(events(fr, 'pinch-off').length, 0);
  run(c, 466, 600, () => P(0.5));
  fr = run(c, 633, 1100, () => []);
  assert.equal(c.frame.mode, 'idle'); assert.equal(events(fr, 'fling').length, 0);
});
test('дрожь точек (σ = 0,002) на неподвижном щипке почти не крутит деталь', () => {
  const c = ctlNew();
  run(c, 0, 4000, t => [hand({ pose: 'pinch', gap: 0.1, noise: 0.002, seed: 1 + Math.round(t) })]);
  near(c.view.yaw, HOME.yaw, 0.02, 'yaw'); near(c.view.pit, HOME.pit, 0.02, 'pit');
});
test('неуверенная детекция (score < 0,5) игнорируется', () => {
  const c = ctlNew(), fr = run(c, 0, 600, () => [{ lm: hand({ pose: 'pinch', gap: 0.1 }), handed: 'Right', score: 0.3 }]);
  assert.equal(events(fr, 'pinch-on').length, 0);
});
test('фильтр 1€: покой сглаживается, быстрый ход догоняется без большой задержки', () => {
  const f = new OneEuro(CFG.euro); let t = 0, y = 0;
  for (let i = 0; i < 60; i++) { t += DT; y = f.f(0.5 + (i % 2 ? 0.003 : -0.003), t); }
  near(y, 0.5, 0.0015, 'дрожь');
  for (let i = 0; i < 10; i++) { t += DT; y = f.f(0.5 + 0.05 * (i + 1), t); }   /* 1,5 кадра/с */
  assert.ok(Math.abs(y - 1.0) < 0.12, 'отставание ' + (1 - y).toFixed(3));
});

/* ── новые жесты: щелчок, хлопок, лезвие, указка ── */
import { VIEWS } from '../gestures.js';

test('щелчок: взвод ≥ holdOn и быстрый отлёт среднего — следующий стандартный вид', () => {
  const c = ctlNew();
  run(c, 0, 300, () => [hand({ pose: 'snap' })]);
  const fr = run(c, 333, 900, () => [hand({ pose: 'snapped' })]);
  assert.equal(events(fr, 'snap').length, 1);
  assert.equal(events(fr, 'view')[0].view, VIEWS[0].k, 'первый щелчок — главный вид');
  c.tick(5000); near(c.view.yaw, 0, 1e-6); near(c.view.pit, 1e-4, 1e-6);
  assert.equal(fr[1].label, 'Главный вид', 'подпись вида всплывает');
  run(c, 933, 1300, () => [hand({ pose: 'snap' })]); run(c, 1333, 1600, () => [hand({ pose: 'snapped' })]);
  c.tick(9000); near(c.view.pit, Math.PI / 2 - 1e-3, 1e-6, 'второй — вид сверху');
});
test('щелчок: медленное размыкание — не щелчок; короткий взвод — не щелчок', () => {
  const slow = ctlNew();
  run(slow, 0, 300, () => [hand({ pose: 'snap' })]);
  /* средний отходит плавно: точки 400 мс перетекают от «взвода» к «после щелчка» */
  const A = hand({ pose: 'snap' }), B = hand({ pose: 'snapped' }), mix = u => A.map((p, i) => ({ x: lerp(p.x, B[i].x, u), y: lerp(p.y, B[i].y, u), z: lerp(p.z, B[i].z, u) }));
  let fr = run(slow, 333, 900, t => [mix((t - 333) / 400)]);
  assert.equal(events(fr, 'snap').length, 0);
  const short = ctlNew();
  fr = run(short, 0, 600, t => [hand({ pose: t < 33 ? 'snap' : 'snapped' })]);
  assert.equal(events(fr, 'snap').length, 0);
});
test('щелчок не путается со щипком: большой + указательный вращают, а не переключают вид', () => {
  const c = ctlNew();
  run(c, 0, 300, () => [hand({ pose: 'pinch', gap: 0.1 })]);
  const fr = run(c, 333, 700, () => [hand({ pose: 'open' })]);
  assert.equal(events(fr, 'snap').length, 0);
});

const pair = (d, pose = 'open') => [hand({ pose, cx: 0.5 - d / 2, rot: -0.3 }), hand({ pose, cx: 0.5 + d / 2, rot: 0.3, seed: 3 })];
test('хлопок: ладони быстро сошлись — событие clap; один раз за cooldown', () => {
  const c = ctlNew();
  run(c, 0, 300, () => pair(0.55));
  const fr = run(c, 333, 600, t => pair(lerp(0.55, 0.12, (t - 333) / 200)));
  assert.equal(events(fr, 'clap').length, 1);
  const fr2 = run(c, 633, 900, t => pair(lerp(0.12, 0.5, (t - 633) / 200)));
  assert.equal(events(fr2, 'clap').length, 0, 'разведение — не хлопок');
});
test('хлопок не запускает сброс: открытые после хлопка ладони не возвращают вид', () => {
  const c = ctlNew(); c.view.yaw = 1;
  run(c, 0, 300, () => pair(0.55));
  run(c, 333, 600, t => pair(lerp(0.55, 0.12, (t - 333) / 200)));
  const fr = run(c, 633, 3000, () => pair(0.25));
  assert.equal(events(fr, 'reset').length, 0); assert.equal(c.view.yaw, 1);
});
test('хлопок: MediaPipe потерял руки в момент касания — всё равно хлопок', () => {
  const c = ctlNew();
  run(c, 0, 300, () => pair(0.55));
  run(c, 333, 466, t => pair(lerp(0.55, 0.2, (t - 333) / 133)));
  const fr = run(c, 499, 700, () => []);
  assert.equal(events(fr, 'clap').length, 1);
});
test('хлопок: медленно свести руки — не хлопок; два кулака — не хлопок (это разбор)', () => {
  const c = ctlNew();
  run(c, 0, 300, () => pair(0.55));
  let fr = run(c, 333, 2400, t => pair(lerp(0.55, 0.12, (t - 333) / 2000)));
  assert.equal(events(fr, 'clap').length, 0, 'медленно');
  const f = ctlNew();
  run(f, 0, 300, () => pair(0.55, 'fist'));
  fr = run(f, 333, 600, t => pair(lerp(0.55, 0.12, (t - 333) / 200), 'fist'));
  assert.equal(events(fr, 'clap').length, 0, 'кулаки');
});

test('лезвие: ребро ладони — режим section; горизонтально — h, вертикально — v; положение — центр ладони', () => {
  const c = ctlNew();
  let fr = run(c, 0, 300, () => [hand({ pose: 'blade', rot: Math.PI / 2, cy: 0.4 })]);
  const f = fr[fr.length - 1];
  assert.equal(f.mode, 'section'); assert.equal(f.blade.kind, 'h'); near(f.blade.y, 0.4, 0.03);
  fr = run(c, 333, 700, () => [hand({ pose: 'blade', rot: 0, cx: 0.3 })]);
  assert.equal(fr[fr.length - 1].blade.kind, 'v'); near(fr[fr.length - 1].blade.x, 0.3, 0.03);
});
test('лезвие не включает сброс (ладонь ребром ≠ открытая ладонь)', () => {
  const c = ctlNew(); c.view.yaw = 1;
  const fr = run(c, 0, 2500, () => [hand({ pose: 'blade', rot: Math.PI / 2 })]);
  assert.equal(events(fr, 'reset').length, 0); assert.equal(c.view.yaw, 1);
});
test('указка: вытянутый указательный — режим point, точка — кончик указательного; не вращает', () => {
  const c = ctlNew(), fr = run(c, 0, 600, t => [hand({ pose: 'point', cx: lerp(0.4, 0.6, t / 600) })]);
  const f = fr[fr.length - 1];
  assert.equal(f.mode, 'point'); assert.ok(f.point && f.point.y < 0.5, 'кончик выше ладони');
  assert.equal(c.view.yaw, HOME.yaw);
  assert.equal(events(fr, 'pinch-on').length, 0);
});
