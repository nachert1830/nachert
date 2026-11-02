/* Жесты рук → вид 3D-модели. Чистый модуль: ни DOM, ни камеры, ни WebGL — только точки и время.
   Его кормят и MediaPipe (app.js), и тесты (tests/gestures.test.js) синтетическими руками.

   Вход update(hands, t):
     hands — массив рук; рука — либо массив 21 точки {x, y, z?} (координаты кадра 0..1, ДО зеркала),
             либо {lm: [...21 точка], handed: 'Left'|'Right', score}.
     t     — время, мс (performance.now()).
   Выход — кадр: режим, подпись, руки для HUD, курсоры, захват (drag), меню, прогресс удержаний, события.
   Вид (yaw, pit, zoom, panX, panY) лежит в ctl.view; tick(t) докручивает инерцию и анимацию вида.

   Схема «наведи и щипни» — три позы (щипок, открытая ладонь, всё остальное), смысл щипка задаёт цель под курсором:
     курсор                       — точка у основания указательного (2·p5 + p9)/3: не съезжает при щипке;
                                    своя «медленная» фильтрация 1€ и зона залипания;
     щипок по кнопке              — нажатие НА ОТПУСКАНИЕ (≤ 800 мс, курсор ушёл < 40 px), иначе отмена;
     щипок по ползунку/маховику/ручке плоскости — захват: приложение двигает величину, пока пальцы сомкнуты;
     щипок по пустому месту       — сразу вращение (с инерцией после отпускания);
     щипок по детали              — 400 мс решают: повёл руку (> 0,025 кадра) — вращение,
                                    держишь на месте (< 0,015) — «взял деталь» (событие grab);
     два щипка                    — зум (расстояние) и сдвиг (середина) с мёртвыми зонами;
     открытая ладонь 500 мс       — радиальное меню у курсора: повёл к сектору — щипнул — выбрал;
                                    центр — «Сброс»; кулак, пропажа руки или 6 с без выбора — закрыть.
   Хлопок, щелчок, «лезвие», кулаки и руль убраны: на 15–30 кадрах/с с веб-камеры их не распознать надёжно.
   Защита от ложных срабатываний: гистерезис порогов; поза засчитывается, продержавшись ≥ holdOn мс И ≥ 2 кадров;
   щипок не засчитывается в кулаке и на быстром (смазанном) движении; рука у края кадра и далёкая рука не управляют;
   пропавшая на ≤ 250 мс рука держит состояние и продолжает без скачка; после двуручного жеста — только свежий щипок. */

export const CFG = {
  pinchOn: 0.30, pinchOff: 0.48,      /* щипок: |4−8| / размер ладони; гистерезис */
  idxCurl: 1.20,                      /* щипок — только если указательный не согнут в кулак: |8−0| / |5−0| */
  pinchSpeed: 2.0,                    /* размеров ладони в секунду: быстрее — кадр смазан, щипок не начинаем */
  fistOn: 1.20, fistOff: 1.36,        /* кулак: все 4 пальца согнуты — max(|кончик−запястье| / |пясть−запястье|) */
  openOn: 1.62, openOff: 1.50,        /* ладонь: все 4 пальца прямые — min(того же отношения) */
  thumbOut: 0.55, openWidth: 0.45,    /* ладонь: большой отведён (|4−5| / ладонь), ладонь к камере, не ребром (|5−17| / |0−9|) */
  holdOn: 60, holdOff: 100, minFrames: 2,   /* поза должна продержаться ≥ мс И ≥ кадров (на 7 кадрах/с — по кадрам) */
  edge: 0.035,                        /* доля кадра: центр ладони или кончики 4, 8 ближе к краю — рука не управляет */
  edgeWarn: 0.08,                     /* ближе к краю — предупреждение на экране */
  minPalm: 0.045, nearPalm: 0.065, farPalm: 0.35,   /* размер ладони в долях кадра: «далеко» (не управляет), «ближе», «дальше» */
  lostMs: 250,                        /* рука пропала из кадра на столько — держим её состояние (MediaPipe мигает) */
  matchMax: 0.15,                     /* дальше — это уже другая рука */
  rotGain: 4.2,                       /* рад на ширину кадра */
  panGain: 1.5,                       /* размеров детали на ширину кадра (делится на зум) */
  deadZone: 0.0012,                   /* смещение точки за кадр меньше этого — дрожь, не движение */
  flingMin: 0.0005, flingMax: 0.010,  /* рад/мс: медленнее — без инерции; быстрее — обрезаем */
  flingTau: 350,                      /* мс: постоянная затухания инерции (докрутка ≈ v·τ) */
  resetAnim: 650,
  zoomMin: 0.5, zoomMax: 5,
  pitMin: -0.2, pitMax: Math.PI / 2 - 1e-3,
  euro: { minCutoff: 4.0, beta: 10.0, dCutoff: 1.5 },        /* точки руки (вращение — быстрый отклик) */
  cursorEuro: { minCutoff: 0.8, beta: 14, dCutoff: 1.0 },    /* курсор: покой — сильное сглаживание, быстрое движение — без задержки */
  box: { x0: 0.27, x1: 0.73, y0: 0.30, y1: 0.74 },           /* рабочая зона кадра (в зеркале) → весь экран: кистью, локоть на столе */
  stick: 0.0045,                      /* доля экрана (~6 px на 1440): дрожь курсора внутри — не двигает его */
  aimMs: 80,                          /* цель щипка — где был курсор за столько до смыкания */
  holdMs: 400, moveOn: 0.025, holdStill: 0.015,   /* щипок по детали: удержание → «взять», движение → вращение */
  clickMs: 800, clickDrift: 0.028,    /* кнопка: нажатие на отпускание, если щипок ≤ 800 мс и курсор ушёл < 0,028 экрана (~40 px) */
  menuMs: 500, menuStill: 0.4,        /* ладонь держится 500 мс, рука медленнее 0,4 ладони/с — меню */
  menuR: 0.10, menuROff: 0.075,       /* доля экрана: отклонение курсора от центра меню — выбран сектор (с гистерезисом) */
  menuIdle: 6000,                     /* мс без движения в меню — закрыть */
  zoomDead: 0.04, panDead: 0.01, twoMin: 1.5,   /* два щипка: мёртвые зоны; руки ближе 1,5 ладони — заморозка */
  lowFps: 12                          /* ниже — упрощённый режим: без инерции, удержания на 30 % дольше */
};
/* стандартные виды: как VIEWS на сайте (главный — вдоль +y, слева — вдоль −x) */
export const VIEWS = [
  { k: 'front', t: 'Главный вид', yaw: 0, pit: 1e-4 },
  { k: 'top', t: 'Вид сверху', yaw: 0, pit: Math.PI / 2 - 1e-3 },
  { k: 'left', t: 'Вид слева', yaw: Math.PI / 2, pit: 1e-4 },
  { k: 'iso', t: 'Изометрия', yaw: -0.62, pit: 0.42 }
];
export const HOME = { yaw: -0.62, pit: 0.42, zoom: 1, panX: 0, panY: 0, explode: 0, open: 0 };

/* ── фильтр 1€ (Casiez, Roussel, Vogel, 2012): на медленном — сильное сглаживание, на быстром — малая задержка ── */
export class OneEuro {
  constructor(o) { this.o = o; this.x = null; this.dx = 0; this.t = 0; }
  static a(fc, dt) { const r = 2 * Math.PI * fc * dt; return r / (r + 1); }
  f(x, t) {
    if (this.x === null) { this.x = x; this.t = t; return x; }
    const dt = Math.max(1e-3, (t - this.t) / 1000); this.t = t;
    const d = (x - this.x) / dt; this.dx += OneEuro.a(this.o.dCutoff, dt) * (d - this.dx);
    const fc = this.o.minCutoff + this.o.beta * Math.abs(this.dx);
    this.x += OneEuro.a(fc, dt) * (x - this.x); return this.x;
  }
  reset() { this.x = null; this.dx = 0; }
}

const D2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const D3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, ((a.z || 0) - (b.z || 0)) * 0.5);   /* z у MediaPipe грубее — с весом ½ */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const FINGERS = [[8, 5], [12, 9], [16, 13], [20, 17]];     /* [кончик, пясть] указательного … мизинца */
const PALM = [0, 5, 9, 13, 17];
/* точка курсора — у основания указательного: при смыкании пальцев она почти не сдвигается (кончик съезжает на 3–5 % кадра) */
export const anchorOf = p => ({ x: (2 * p[5].x + p[9].x) / 3, y: (2 * p[5].y + p[9].y) / 3 });

/* признаки одной руки по сырым точкам */
export function features(lm, cfg = CFG) {
  const palm = (D2(lm[0], lm[5]) + D2(lm[0], lm[9]) + D2(lm[0], lm[13]) + D2(lm[0], lm[17])) / 4 || 1e-6;
  const curl = FINGERS.map(([t, m]) => D2(lm[t], lm[0]) / (D2(lm[m], lm[0]) || 1e-6));
  const pinch = D3(lm[4], lm[8]) / palm, thumb = D2(lm[4], lm[5]) / palm;
  /* ширина ладони к длине: ладонь к камере ~0,8; ребром — < 0,35 (пясти 5 и 17 сходятся в кадре) */
  const width = D2(lm[5], lm[17]) / (D2(lm[0], lm[9]) || 1e-6);
  const c = { x: 0, y: 0 }; PALM.forEach(i => { c.x += lm[i].x / 5; c.y += lm[i].y / 5; });
  const e = cfg.edge, out = p => p.x < e || p.x > 1 - e || p.y < e || p.y > 1 - e;
  const edge = out(c) || out(lm[4]) || out(lm[8]);
  return { palm, curl, cmax: Math.max(...curl), cmin: Math.min(...curl), pinch, thumb, width, c, edge, far: palm < cfg.minPalm, speed: 0 };
}

/* сырая поза с гистерезисом относительно текущей подтверждённой: none | fist | pinch | open | idle */
export function classify(f, cur, cfg = CFG) {
  if (f.edge || f.far) return 'none';
  if (f.cmax < (cur === 'fist' ? cfg.fistOff : cfg.fistOn)) return 'fist';          /* в кулаке большой палец лежит на указательном — это не щипок */
  if (f.pinch < (cur === 'pinch' ? cfg.pinchOff : cfg.pinchOn) && (cur === 'pinch' || (f.curl[0] > cfg.idxCurl && f.speed < cfg.pinchSpeed))) return 'pinch';
  if (f.cmin > (cur === 'open' ? cfg.openOff : cfg.openOn) && f.thumb > cfg.thumbOut && f.pinch > 0.9 && f.width > cfg.openWidth) return 'open';
  return 'idle';
}

const ACTIVE = new Set(['pinch']);
let NEXT_ID = 1;

/* opt.target(sx, sy) — что под курсором (доли экрана): null | { kind: 'ui' | 'slider' | 'wheel' | 'plane' | 'part', id?, ... }.
   opt.menu() — пункты корневого меню: [{ k, t, i?, sub?: [...] }]; сектора по часовой, первый — вверху. */
export function createController(opt = {}) {
  const cfg = Object.assign({}, CFG, opt.cfg || {});
  if (opt.cfg && opt.cfg.box) cfg.box = Object.assign({}, CFG.box, opt.cfg.box);
  const view = Object.assign({}, HOME, opt.view || {});
  const target = opt.target || (() => null);
  const menuRoot = opt.menu || (() => []);
  const ctl = { cfg, view, reduced: !!opt.reducedMotion, tracks: [], mode: 'idle', g: null, multiEnd: -1e9,
    fling: null, tween: null, lastT: 0, frame: null, viewIdx: 3, menu: null, arm: null, dtE: 33, prevUpd: 0 };

  const mkTrack = (d, t) => ({ id: NEXT_ID++, handed: d.handed, seen: t, pose: 'none', raw: 'none', cand: null, candT: 0, candN: 0, poseT: t,
    fx: Array.from({ length: 21 }, () => new OneEuro(cfg.euro)), fy: Array.from({ length: 21 }, () => new OneEuro(cfg.euro)),
    cx: new OneEuro(cfg.cursorEuro), cy: new OneEuro(cfg.cursorEuro), cur: null, hist: [], pts: null, f: null, c: d.f.c, speed: 0, present: true, rejoin: false });

  /* сопоставление найденных рук с прежними: по положению ладони (+ штраф за другую руку), а не по индексу —
     MediaPipe может поменять руки местами, а «левая/правая» у него путаются */
  function associate(dets, t) {
    const T = ctl.tracks, cost = (d, k) => D2(d.f.c, k.c) + (d.handed && k.handed && d.handed !== k.handed ? 0.05 : 0);
    let best = null;
    const go = (i, pp, used, c) => {
      if (i === dets.length) { if (!best || c < best.c) best = { p: pp.slice(), c }; return; }
      pp.push(null); go(i + 1, pp, used, c + cfg.matchMax); pp.pop();
      T.forEach((k, j) => { if (used.has(j)) return; const v = cost(dets[i], k); if (v > cfg.matchMax) return;
        used.add(j); pp.push(j); go(i + 1, pp, used, c + v); pp.pop(); used.delete(j); });
    };
    go(0, [], new Set(), 0);
    const used = new Set();
    dets.forEach((d, i) => { const k = best.p[i]; let tr;
      if (k === null || k === undefined) { tr = mkTrack(d, t); T.push(tr); }
      else {
        tr = T[k];
        const dt = Math.max(1, t - tr.seen) / 1000, sp = D2(d.f.c, tr.c) / dt / d.f.palm;    /* ладоней в секунду */
        tr.speed = tr.present ? 0.5 * tr.speed + 0.5 * sp : 0;
        tr.rejoin = !tr.present;                                                         /* вернулась после пропуска */
      }
      d.f.speed = tr.speed;
      used.add(tr); tr.seen = t; tr.lm = d.lm; tr.f = d.f; tr.c = d.f.c; if (d.handed) tr.handed = d.handed; tr.present = true; });
    T.forEach(tr => { if (!used.has(tr)) { tr.present = false; tr.rejoin = false; } });
    const gone = T.filter(tr => !tr.present && t - tr.seen >= cfg.lostMs);
    ctl.tracks = T.filter(tr => tr.present || t - tr.seen < cfg.lostMs);
    return gone;
  }

  /* подтверждение позы: новая поза должна продержаться holdOn (holdOff для снятия щипка) и ≥ minFrames кадров */
  function debounce(tr, t, ev) {
    const raw = tr.present ? classify(tr.f, tr.pose, cfg) : tr.pose;   /* пропавшая на миг рука держит позу */
    tr.raw = raw;
    if (!tr.present) return;
    if (raw === tr.pose) { tr.cand = null; tr.candN = 0; return; }
    if (tr.cand !== raw) { tr.cand = raw; tr.candT = t; tr.candN = 0; }
    tr.candN++;
    const need = (ACTIVE.has(tr.pose) ? cfg.holdOff : cfg.holdOn) * (ctl.lowFps ? 1.3 : 1);
    if (t - tr.candT >= need && tr.candN >= cfg.minFrames) {
      const was = tr.pose; tr.pose = raw; tr.poseT = t; tr.cand = null; tr.candN = 0;
      if (was === 'pinch') ev.push({ type: 'pinch-off', id: tr.id, t });
      if (raw === 'pinch') ev.push({ type: 'pinch-on', id: tr.id, t, aimT: tr.candT - cfg.aimMs });
      if (raw === 'fist') ev.push({ type: 'fist-on', id: tr.id, t });
    }
  }

  /* точки в зеркале (как человек видит себя), сглаженные 1€; курсор — своя медленная фильтрация + залипание */
  function smooth(tr, t) {
    if (!tr.present) return;
    tr.pts = tr.lm.map((p, i) => ({ x: tr.fx[i].f(1 - p.x, t), y: tr.fy[i].f(p.y, t) }));
    const c = { x: 0, y: 0 }; PALM.forEach(i => { c.x += tr.pts[i].x / 5; c.y += tr.pts[i].y / 5; }); tr.palmC = c;
    const raw = anchorOf(tr.lm), B = cfg.box;
    const ax = tr.cx.f(1 - raw.x, t), ay = tr.cy.f(raw.y, t);
    const s = { x: (ax - B.x0) / (B.x1 - B.x0), y: (ay - B.y0) / (B.y1 - B.y0) };
    /* залипание: курсор стоит, пока «настоящая» точка не ушла дальше stick; потом тянется за ней на поводке — без скачка.
       curU — без обрезки краем экрана: захваченный ползунок у края панели тянется и дальше края */
    if (!tr.curU || tr.rejoin) tr.curU = s;
    else { const d = D2(s, tr.curU); if (d > cfg.stick) { const k = (d - cfg.stick) / d; tr.curU = { x: tr.curU.x + (s.x - tr.curU.x) * k, y: tr.curU.y + (s.y - tr.curU.y) * k }; } }
    tr.cur = { x: clamp(tr.curU.x, 0, 1), y: clamp(tr.curU.y, 0, 1) };
    tr.hist.push({ t, x: tr.cur.x, y: tr.cur.y }); while (tr.hist.length > 2 && t - tr.hist[0].t > 400) tr.hist.shift();
    tr.anchorF = { x: ax, y: ay };
  }
  const aimOf = (tr, at) => { let a = tr.hist.length ? tr.hist[0] : tr.cur; for (const h of tr.hist) if (h.t <= at) a = h; else break; return a ? { x: a.x, y: a.y } : null; };

  const stable = tr => tr.present && tr.raw === tr.pose;     /* поза не «на выходе» — движение можно применять */
  const dz = v => (Math.abs(v) < cfg.deadZone ? 0 : v);
  const stopMotion = () => { ctl.fling = null; ctl.tween = null; };
  const byId = id => ctl.tracks.find(tr => tr.id === id);

  function setMode(mode, t, ev, g = null) {
    const prev = ctl.mode;
    if (['zoom'].includes(prev) && mode !== prev) ctl.multiEnd = t;
    ctl.mode = mode; ctl.g = g;
    if (mode !== prev) ev.push({ type: 'mode', mode, from: prev, t });
  }

  function endRotate(t, ev, released) {
    const g = ctl.g; if (!g || !released || ctl.reduced || ctl.lowFps) return;
    /* скорость — по отсчётам ДО отпускания: в момент размыкания пальцев точки прыгают */
    const S = g.hist, tEnd = g.relT || t;
    const ok = S.filter(s => s.t <= tEnd - 20 && s.t >= tEnd - 120);
    if (ok.length < 2) return;
    const a = ok[0], b = ok[ok.length - 1], dt = Math.max(1, b.t - a.t);
    let vy = (b.yaw - a.yaw) / dt, vp = (b.pit - a.pit) / dt; const sp = Math.hypot(vy, vp);
    if (sp < cfg.flingMin || tEnd - b.t > 90) return;
    if (sp > cfg.flingMax) { vy *= cfg.flingMax / sp; vp *= cfg.flingMax / sp; }
    ctl.fling = { vy, vp, t }; ev.push({ type: 'fling', vy, vp, t });
  }

  /* конец захвата/жеста: rel — пальцы разжаты на месте (а не рука пропала) */
  function finish(t, ev, rel) {
    const g = ctl.g, m = ctl.mode;
    if (m === 'rotate') endRotate(t, ev, rel);
    if (m === 'pending' && rel) ev.push({ type: 'tap', id: g.id, target: g.target, t });
    if (m === 'drag') {
      const tr = byId(g.id);
      if (g.target.kind === 'ui') {
        const drift = tr && tr.cur ? D2(tr.cur, g.start) : 1;
        if (rel && t - g.t0 <= cfg.clickMs && drift < cfg.clickDrift) ev.push({ type: 'ui-click', id: g.id, target: g.target, at: g.start, t });
        else ev.push({ type: 'ui-cancel', id: g.id, target: g.target, t });
      }
      ev.push({ type: 'drag-end', id: g.id, kind: g.target.kind, target: g.target, lost: !rel, t });
    }
    setMode('idle', t, ev);
  }

  /* ── меню: открыто у курсора, сектор — по направлению отклонения ── */
  function openMenu(tr, t, ev, items, level) {
    ctl.menu = { id: tr.id, x: tr.cur.x, y: tr.cur.y, items, level, sel: -1, t0: t, tMove: t, last: { x: tr.cur.x, y: tr.cur.y } };
    setMode('menu', t, ev, { id: tr.id });
    ev.push({ type: 'menu-open', level, t });
  }
  function menuSel(M, p) {
    const n = M.items.length, dx = p.x - M.x, dy = p.y - M.y, r = Math.hypot(dx, dy);
    if (!n) return -1;
    if (r < (M.sel >= 0 ? cfg.menuROff : cfg.menuR)) return -1;
    const a = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI), w = 2 * Math.PI / n;    /* 0 — вверх, по часовой */
    const k = Math.round(a / w) % n;
    if (M.sel >= 0 && M.sel !== k) {                         /* гистерезис по углу: 8° за границу сектора */
      let d = Math.abs(a - M.sel * w); d = Math.min(d, 2 * Math.PI - d);
      if (d < w / 2 + 0.14) return M.sel;
    }
    return k;
  }
  function menuPick(t, ev) {
    const M = ctl.menu, tr = byId(M.id);
    if (M.sel < 0) { ev.push({ type: 'menu', key: 'reset', t }); closeMenu(t, ev, true); return; }
    const it = M.items[M.sel];
    if (it.sub && it.sub.length) { openMenu(tr, t, ev, it.sub, (M.level || 0) + 1); ctl.menu.parent = it.k; return; }
    ev.push({ type: 'menu', key: it.k, parent: M.parent || null, t }); closeMenu(t, ev, true);
  }
  function closeMenu(t, ev, picked) {
    if (!ctl.menu) return;
    ctl.menu = null; if (!picked) ev.push({ type: 'menu-close', t });
    ctl.arm = null; ctl.lockT = ctl.lastT;                   /* ладонь, открывшая меню, не откроет его снова сразу: нужна заново показанная ладонь */
    setMode('idle', t, ev);
  }

  function update(hands, t) {
    const ev = [];
    tick(t);
    if (ctl.prevUpd) ctl.dtE = 0.85 * ctl.dtE + 0.15 * clamp(t - ctl.prevUpd, 1, 500);
    ctl.prevUpd = t; ctl.lowFps = 1000 / ctl.dtE < cfg.lowFps;
    const dets = (hands || []).map(h => { const lm = Array.isArray(h) ? h : (h.lm || h.landmarks); return { lm, handed: Array.isArray(h) ? null : h.handed, score: Array.isArray(h) ? 1 : (h.score == null ? 1 : h.score) }; })
      .filter(d => d.lm && d.lm.length >= 21 && d.score >= 0.5).slice(0, 2);
    dets.forEach(d => { d.f = features(d.lm, cfg); });
    const gone = associate(dets, t);
    ctl.tracks.forEach(tr => { debounce(tr, t, ev); smooth(tr, t); });
    const T = ctl.tracks, v = view, g0 = ctl.g;

    /* владелец жеста пропал дольше lostMs — жест кончается без инерции, значения остаются */
    if (g0 && gone.some(tr => tr.id === g0.id || (g0.ids && g0.ids.includes(tr.id)))) {
      if (ctl.mode === 'menu') closeMenu(t, ev, false);
      else if (ctl.mode === 'zoom') { const rest = T.find(tr => g0.ids.includes(tr.id) && tr.pose === 'pinch'); setMode(rest ? 'wait' : 'idle', t, ev); }
      else finish(t, ev, false);
    }
    if (ctl.arm && !byId(ctl.arm.id)) ctl.arm = null;

    /* ── щипки: начало ── */
    const pinsNow = () => T.filter(tr => tr.pose === 'pinch' && tr.present);
    for (const e of ev.filter(e => e.type === 'pinch-on')) {
      const tr = byId(e.id); if (!tr) continue;
      if (ctl.fling) { ctl.fling = null; ev.push({ type: 'catch', t }); }        /* щипок «ловит» крутящуюся деталь */
      if (ctl.mode === 'menu') { if (ctl.menu.id === tr.id) menuPick(t, ev); continue; }
      if (ctl.mode === 'drag' || ctl.mode === 'zoom' || ctl.mode === 'wait') { tr.ignored = true; continue; }   /* занято другой рукой */
      if ((ctl.mode === 'rotate' || ctl.mode === 'pending') && ctl.g.id !== tr.id) { startZoom(byId(ctl.g.id), tr, t, ev); continue; }
      const other = pinsNow().find(o => o.id !== tr.id && !o.ignored);
      if (other && t - other.poseT < 400) { startZoom(other, tr, t, ev); continue; }
      ctl.arm = null;
      const aim = aimOf(tr, e.aimT) || tr.cur, tg = aim ? target(aim.x, aim.y) : null;
      stopMotion();
      if (tg && ['ui', 'slider', 'wheel', 'plane'].includes(tg.kind)) {
        setMode('drag', t, ev, { id: tr.id, target: tg, t0: t, start: { x: aim.x, y: aim.y }, px: tr.curU.x, py: tr.curU.y });
        ev.push({ type: tg.kind === 'ui' ? 'ui-down' : 'drag-start', id: tr.id, kind: tg.kind, target: tg, at: aim, t });
      } else if (tg && tg.kind === 'part') {
        setMode('pending', t, ev, { id: tr.id, target: tg, t0: t, x: tr.palmC.x, y: tr.palmC.y, cur: { x: aim.x, y: aim.y } });
      } else startRotate(tr, t, ev);
    }
    function startRotate(tr, t, ev, from) {
      const at = from || tr.palmC;
      setMode('rotate', t, ev, { id: tr.id, x: at.x, y: at.y, hist: [{ t, yaw: v.yaw, pit: v.pit }], relT: 0 });
    }
    function startZoom(a, b, t, ev) {
      if (ctl.mode === 'rotate') ctl.fling = null;
      const d = D2(a.palmC, b.palmC), m = { x: (a.palmC.x + b.palmC.x) / 2, y: (a.palmC.y + b.palmC.y) / 2 };
      setMode('zoom', t, ev, { ids: [a.id, b.id], id: a.id, d0: Math.max(d, 0.02), z0: v.zoom, m0: m, zOn: false, pOn: false });
    }

    /* ── щипки: конец ── */
    for (const e of ev.filter(e => e.type === 'pinch-off')) {
      const tr = byId(e.id); if (tr) tr.ignored = false;
      if (!ctl.g) continue;
      if (ctl.mode === 'zoom' && ctl.g.ids.includes(e.id)) { const rest = pinsNow().some(o => ctl.g.ids.includes(o.id) && o.id !== e.id); setMode(rest ? 'wait' : 'idle', t, ev); continue; }
      if (ctl.mode === 'wait') continue;
      if (ctl.g.id === e.id && ['rotate', 'pending', 'drag'].includes(ctl.mode)) {
        if (ctl.mode === 'rotate' && !ctl.g.relT) ctl.g.relT = (tr && tr.candT) || t;
        finish(t, ev, !!(tr && tr.present));
      }
    }
    if (ctl.mode === 'wait' && !pinsNow().length) setMode('idle', t, ev);

    /* ── непрерывная часть ── */
    const g = ctl.g, own = g && byId(g.id);
    if (ctl.mode === 'pending' && own && own.present) {
      const hold = cfg.holdMs * (ctl.lowFps ? 1.3 : 1), moved = D2(own.palmC, g);
      if (moved > cfg.moveOn) startRotate(own, t, ev, { x: g.x, y: g.y });         /* повёл руку — это вращение; смещение с начала не теряем */
      else if (t - g.t0 >= hold) {
        if (moved < cfg.holdStill) {
          ev.push({ type: 'grab', id: own.id, target: g.target, t });
          setMode('drag', t, ev, { id: own.id, target: g.target, t0: t, start: g.cur, px: own.curU.x, py: own.curU.y });
          ev.push({ type: 'drag-start', id: own.id, kind: 'part', target: g.target, at: g.cur, t });
        } else startRotate(own, t, ev, { x: g.x, y: g.y });
      }
    }
    if (ctl.mode === 'rotate' && own) {
      const at = own.palmC;
      if (own.rejoin) { ctl.g.x = at.x; ctl.g.y = at.y; }                            /* вернулась после пропуска — без скачка */
      if (stable(own)) {
        const dx = dz(at.x - ctl.g.x), dy = dz(at.y - ctl.g.y);
        v.yaw -= dx * cfg.rotGain; v.pit = clamp(v.pit + dy * cfg.rotGain, cfg.pitMin, cfg.pitMax);
        if (dx) ctl.g.x = at.x; if (dy) ctl.g.y = at.y;
        ctl.g.hist.push({ t, yaw: v.yaw, pit: v.pit }); while (ctl.g.hist.length > 2 && t - ctl.g.hist[0].t > 300) ctl.g.hist.shift();
        ctl.g.relT = 0;
      } else if (!ctl.g.relT && own.present && own.cand && own.cand !== own.pose) ctl.g.relT = own.candT;   /* пальцы начали разжиматься */
    }
    let drag = null;
    if (ctl.mode === 'drag' && own) {
      if (own.rejoin || !own.present) { ctl.g.px = own.curU.x; ctl.g.py = own.curU.y; }
      drag = { id: own.id, kind: ctl.g.target.kind, target: ctl.g.target, t0: ctl.g.t0, start: ctl.g.start,
        x: own.curU.x, y: own.curU.y, px: ctl.g.px, py: ctl.g.py, dx: own.present ? own.curU.x - ctl.g.px : 0, dy: own.present ? own.curU.y - ctl.g.py : 0 };
      ctl.g.px = own.curU.x; ctl.g.py = own.curU.y;
    }
    let close = false;
    if (ctl.mode === 'zoom') {
      const [a, b] = ctl.g.ids.map(byId);
      if (a && b) {
        const d = D2(a.palmC, b.palmC), m = { x: (a.palmC.x + b.palmC.x) / 2, y: (a.palmC.y + b.palmC.y) / 2 }, pal = ((a.f ? a.f.palm : 0.1) + (b.f ? b.f.palm : 0.1)) / 2;
        close = d < cfg.twoMin * pal;
        if (a.rejoin || b.rejoin) { const zz = v.zoom; ctl.g.z0 = zz; ctl.g.d0 = Math.max(d, 0.02); ctl.g.m0 = m; ctl.g.pan0 = { x: v.panX, y: v.panY }; }
        if (!close && stable(a) && stable(b)) {
          const r = d / ctl.g.d0;
          if (!ctl.g.zOn && Math.abs(r - 1) > cfg.zoomDead) { ctl.g.zOn = true; ctl.g.d0 = d; ctl.g.z0 = v.zoom; }     /* мёртвая зона без скачка */
          else if (ctl.g.zOn) v.zoom = clamp(ctl.g.z0 * d / ctl.g.d0, cfg.zoomMin, cfg.zoomMax);
          const mx = m.x - ctl.g.m0.x, my = m.y - ctl.g.m0.y;
          if (!ctl.g.pOn && Math.hypot(mx, my) > cfg.panDead) { ctl.g.pOn = true; ctl.g.m0 = m; ctl.g.pan0 = { x: v.panX, y: v.panY }; }
          else if (ctl.g.pOn) { v.panX = ctl.g.pan0.x - mx * cfg.panGain / v.zoom; v.panY = ctl.g.pan0.y + my * cfg.panGain / v.zoom; }
        }
      }
    }

    /* ── меню ── */
    if (ctl.mode === 'menu') {
      const M = ctl.menu, tr = byId(M.id);
      if (!tr) closeMenu(t, ev, false);
      else if (tr.present && tr.pose === 'fist') closeMenu(t, ev, false);
      else if (tr.present && tr.cur) {
        if (D2(tr.cur, M.last) > 0.01) { M.last = { x: tr.cur.x, y: tr.cur.y }; M.tMove = t; }
        const s = menuSel(M, tr.cur); if (s !== M.sel) { M.sel = s; if (s >= 0) ev.push({ type: 'menu-sel', i: s, t }); }
        if (t - M.tMove > cfg.menuIdle) closeMenu(t, ev, false);
      }
    }
    /* ладонь → взвод меню: одна открытая неподвижная ладонь, никто не щиплет */
    if (ctl.mode === 'idle' || ctl.mode === 'arm') {
      const opens = T.filter(tr => tr.present && tr.pose === 'open' && !tr.ignored);
      const fresh = tr => tr.poseT > (ctl.lockT || -1e9) && t - (ctl.lockT || -1e9) > 800;
      const cand = !pinsNow().length && opens.find(tr => fresh(tr) && tr.speed < cfg.menuStill * 2.5);
      if (cand && (!ctl.arm || ctl.arm.id !== cand.id)) ctl.arm = { id: cand.id, t0: t };
      if (cand && ctl.arm) {
        if (cand.speed > cfg.menuStill) ctl.arm.t0 = Math.max(ctl.arm.t0, t - 0.5 * (t - ctl.arm.t0));     /* дёрнулась — откат прогресса наполовину */
        if (ctl.mode !== 'arm') setMode('arm', t, ev, { id: cand.id });
        if (t - ctl.arm.t0 >= cfg.menuMs * (ctl.lowFps ? 1.3 : 1)) openMenu(cand, t, ev, menuRoot(), 0);
      } else { ctl.arm = null; if (ctl.mode === 'arm') setMode('idle', t, ev); }
    }

    /* ── кадр для HUD ── */
    const armP = ctl.mode === 'arm' && ctl.arm ? clamp((t - ctl.arm.t0) / (cfg.menuMs * (ctl.lowFps ? 1.3 : 1)), 0, 1) : 0;
    const holdP = ctl.mode === 'pending' ? clamp((t - ctl.g.t0) / (cfg.holdMs * (ctl.lowFps ? 1.3 : 1)), 0, 1) : 0;
    const driver = id => !!(ctl.g && (ctl.g.id === id || (ctl.g.ids && ctl.g.ids.includes(id))));
    const lead = T.find(tr => driver(tr.id) && tr.present) || T.find(tr => tr.present && !(tr.f && (tr.f.edge || tr.f.far)));
    const label = LABEL[ctl.mode] ? LABEL[ctl.mode](v, ctl) : '';
    ctl.frame = {
      t, mode: ctl.mode, label, events: ev, drag, armP, holdP, close, lowFps: ctl.lowFps, fps: 1000 / ctl.dtE,
      lead: lead ? lead.id : null,
      menu: ctl.menu ? { x: ctl.menu.x, y: ctl.menu.y, items: ctl.menu.items, sel: ctl.menu.sel, level: ctl.menu.level, parent: ctl.menu.parent || null } : null,
      target: ctl.g && ctl.g.target ? ctl.g.target : null,
      hands: T.map(tr => {
        const f = tr.f, a = tr.anchorF, w = cfg.edgeWarn;
        const edgeDir = a ? (a.x < w ? 'l' : a.x > 1 - w ? 'r' : a.y < w ? 't' : a.y > 1 - w ? 'b' : '') : '';
        return { id: tr.id, handed: tr.handed, pose: tr.pose, raw: tr.raw, present: tr.present, pts: tr.pts, palmC: tr.palmC,
          cursor: tr.cur, captured: driver(tr.id) && ctl.mode === 'drag', busy: !!tr.ignored,
          ignored: !!(f && (f.edge || f.far)), why: f ? (f.edge ? 'край кадра' : f.far ? 'далеко' : '') : '',
          dist: f ? (f.palm < cfg.nearPalm ? 'near' : f.palm > cfg.farPalm ? 'far' : '') : '', edgeDir,
          pinchAmt: f ? clamp((0.7 - f.pinch) / (0.7 - cfg.pinchOn), 0, 1) : 0,
          drives: driver(tr.id) };
      })
    };
    return ctl.frame;
  }

  /* инерция и анимация вида; вызывать каждый кадр отрисовки (update зовёт сам) */
  function tick(t) {
    const dt = clamp(t - (ctl.lastT || t), 0, 5000); ctl.lastT = t;
    const v = view; let moving = false;
    if (ctl.fling && dt > 0) {
      /* точное решение v' = −v/τ: путь за dt = v·τ·(1 − e^(−dt/τ)) — не зависит от частоты кадров */
      const f = ctl.fling, k = Math.exp(-dt / cfg.flingTau), s = cfg.flingTau * (1 - k);
      v.yaw += f.vy * s; v.pit = clamp(v.pit + f.vp * s, cfg.pitMin, cfg.pitMax); f.vy *= k; f.vp *= k;
      if (Math.hypot(f.vy, f.vp) < 0.00004) ctl.fling = null; else moving = true;
    }
    if (ctl.tween) {
      const w = ctl.tween, u = clamp((t - w.t0) / w.ms, 0, 1), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      for (const k in w.to) v[k] = w.from[k] + (w.to[k] - w.from[k]) * e;
      if (u >= 1) ctl.tween = null; else moving = true;
    }
    return moving;
  }

  function resetView(t, to = HOME) {
    ctl.fling = null;
    const from = {}; for (const k in to) from[k] = view[k];
    let dy = to.yaw - view.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); from.yaw = to.yaw - dy;   /* кратчайший поворот */
    if (ctl.reduced) { Object.assign(view, to); ctl.tween = null; return; }
    ctl.tween = { from, to: Object.assign({}, to), t0: t, ms: cfg.resetAnim };
  }

  ctl.update = update; ctl.tick = tick; ctl.reset = resetView; ctl.stopMotion = stopMotion;
  ctl.busy = () => !!(ctl.fling || ctl.tween);
  ctl.closeMenu = () => { if (ctl.menu) { ctl.menu = null; ctl.mode = 'idle'; ctl.g = null; } };
  return ctl;
}

const LABEL = {
  rotate: () => 'вращение', zoom: v => 'зум ×' + v.zoom.toFixed(2), pending: () => 'держи — взять деталь · веди — вращать',
  drag: (v, c) => ({ slider: 'ползунок', wheel: 'маховик', plane: 'секущая плоскость', part: 'деталь', ui: '' })[c.g && c.g.target ? c.g.target.kind : ''] || '',
  arm: () => 'держи ладонь — меню', menu: () => 'веди к пункту и щипни · центр — сброс · кулак — закрыть',
  wait: () => 'отпусти и щипни снова', idle: () => ''
};
