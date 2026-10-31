/* Жесты рук → вид 3D-детали. Чистый модуль: ни DOM, ни камеры, ни WebGL — только точки и время.
   Его кормят и MediaPipe (app.js), и тесты (tests/gestures.test.js) синтетическими руками.

   Вход update(hands, t):
     hands — массив рук; рука — либо массив 21 точки {x, y, z?} (координаты кадра 0..1, ДО зеркала),
             либо {lm: [...21 точка], handed: 'Left'|'Right', score}.
     t     — время, мс (performance.now()).
   Выход — кадр: режим, подпись, руки для HUD (уже в зеркале, как видит себя человек), прогресс сброса, события.
   Вид (yaw, pit, zoom, panX, panY, explode) лежит в ctl.view; tick(t) докручивает инерцию и анимацию сброса.

   Жесты:
     щипок одной рукой            — вращение (с инерцией после отпускания);
     два щипка                    — зум (расстояние между руками);
     щипок + кулак второй рукой   — панорама (двигает рука со щипком);
     два кулака                   — «взять и разобрать»: развёл руки — деталь раскрылась, свёл — собралась;
     открытая ладонь 1,5 с        — сброс вида;
     кулак                        — «поймать» крутящуюся по инерции деталь.
   Защита от ложных срабатываний: гистерезис всех порогов, поза засчитывается, только продержавшись holdOn мс,
   и снимается, только пропав на holdOff мс; рука у края кадра и слишком далёкая рука не управляют;
   после двуручного жеста вращение начинается только со свежего щипка (иначе оставшаяся рука дёргает деталь). */

export const CFG = {
  pinchOn: 0.30, pinchOff: 0.48,      /* щипок: |4−8| / размер ладони; гистерезис */
  fistOn: 1.20, fistOff: 1.36,        /* кулак: все 4 пальца согнуты — max(|кончик−запястье| / |пясть−запястье|) */
  openOn: 1.62, openOff: 1.50,        /* ладонь: все 4 пальца прямые — min(того же отношения) */
  thumbOut: 0.55,                     /* ладонь: большой палец отведён — |4−5| / размер ладони */
  holdOn: 90, holdOff: 110,           /* мс: поза должна продержаться, чтобы включиться / выключиться */
  edge: 0.035,                        /* доля кадра: центр ладони или кончики 4, 8 ближе к краю — рука не управляет */
  minPalm: 0.045,                     /* размер ладони в долях кадра: меньше — рука слишком далеко */
  lostMs: 160,                        /* рука пропала из кадра на столько — держим её состояние (MediaPipe мигает) */
  matchMax: 0.30,                     /* дальше — это уже другая рука */
  rotGain: 4.2,                       /* рад на ширину кадра */
  panGain: 1.5,                       /* размеров детали на ширину кадра (делится на зум) */
  explodeSpan: 0.32,                  /* развести кулаки на столько (доля кадра) — деталь раскрыта полностью */
  deadZone: 0.0012,                   /* смещение точки за кадр меньше этого — дрожь, не движение */
  flingMin: 0.0005, flingMax: 0.010,  /* рад/мс: медленнее — без инерции; быстрее — обрезаем */
  flingTau: 320,                      /* мс: постоянная затухания инерции (докрутка ≈ v·τ) */
  resetMs: 1500, resetAnim: 650,
  zoomMin: 0.5, zoomMax: 5,
  pitMin: -0.2, pitMax: Math.PI / 2 - 1e-3,
  euro: { minCutoff: 1.4, beta: 2.5, dCutoff: 1.0 }   /* фильтр 1€ для точек (координаты 0..1, частоты в Гц) */
};
export const HOME = { yaw: -0.62, pit: 0.42, zoom: 1, panX: 0, panY: 0, explode: 0 };

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

/* признаки одной руки по сырым точкам */
export function features(lm, cfg = CFG) {
  const palm = (D2(lm[0], lm[5]) + D2(lm[0], lm[9]) + D2(lm[0], lm[13]) + D2(lm[0], lm[17])) / 4 || 1e-6;
  const curl = FINGERS.map(([t, m]) => D2(lm[t], lm[0]) / (D2(lm[m], lm[0]) || 1e-6));
  const pinch = D3(lm[4], lm[8]) / palm, thumb = D2(lm[4], lm[5]) / palm;
  const c = { x: 0, y: 0 }; PALM.forEach(i => { c.x += lm[i].x / 5; c.y += lm[i].y / 5; });
  const e = cfg.edge, out = p => p.x < e || p.x > 1 - e || p.y < e || p.y > 1 - e;
  const edge = out(c) || out(lm[4]) || out(lm[8]);
  return { palm, curl, cmax: Math.max(...curl), cmin: Math.min(...curl), pinch, thumb, c, edge, far: palm < cfg.minPalm };
}

/* сырая поза с гистерезисом относительно текущей подтверждённой: none | fist | pinch | open | idle */
export function classify(f, cur, cfg = CFG) {
  if (f.edge || f.far) return 'none';
  if (f.cmax < (cur === 'fist' ? cfg.fistOff : cfg.fistOn)) return 'fist';          /* кулак важнее щипка: в кулаке большой палец касается указательного */
  if (f.pinch < (cur === 'pinch' ? cfg.pinchOff : cfg.pinchOn)) return 'pinch';
  if (f.cmin > (cur === 'open' ? cfg.openOff : cfg.openOn) && f.thumb > cfg.thumbOut && f.pinch > 0.9) return 'open';
  return 'idle';
}

const ACTIVE = new Set(['pinch', 'fist']);
let NEXT_ID = 1;

export function createController(opt = {}) {
  const cfg = Object.assign({}, CFG, opt.cfg || {});
  const view = Object.assign({}, HOME, opt.view || {});
  const ctl = { cfg, view, reduced: !!opt.reducedMotion, tracks: [], mode: 'idle', g: null, multiEnd: -1e9,
    fling: null, tween: null, openSince: 0, resetLock: false, lastT: 0, frame: null };

  const mkTrack = (d, t) => ({ id: NEXT_ID++, handed: d.handed, seen: t, pose: 'none', raw: 'none', cand: null, candT: 0, poseT: t,
    fx: Array.from({ length: 21 }, () => new OneEuro(cfg.euro)), fy: Array.from({ length: 21 }, () => new OneEuro(cfg.euro)), pts: null, f: null, c: d.f.c });

  /* сопоставление найденных рук с прежними: по положению ладони (+ штраф за другую руку), а не по индексу —
     MediaPipe может поменять руки местами между кадрами */
  function associate(dets, t) {
    const T = ctl.tracks, cost = (d, k) => D2(d.f.c, k.c) + (d.handed && k.handed && d.handed !== k.handed ? 0.15 : 0);
    /* все взаимно однозначные назначения: детекция i → трек k или «новая рука» (рук ≤ 2, вариантов мало) */
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
      if (k === null || k === undefined) { tr = mkTrack(d, t); T.push(tr); } else tr = T[k];
      used.add(tr); tr.seen = t; tr.lm = d.lm; tr.f = d.f; tr.c = d.f.c; if (d.handed) tr.handed = d.handed; tr.present = true; });
    T.forEach(tr => { if (!used.has(tr)) tr.present = false; });
    ctl.tracks = T.filter(tr => tr.present || t - tr.seen < cfg.lostMs);
  }

  /* подтверждение позы: новая поза должна продержаться holdOn (включение) или holdOff (снятие активной) */
  function debounce(tr, t, ev) {
    const raw = tr.present ? classify(tr.f, tr.pose, cfg) : tr.pose;   /* пропавшая на миг рука держит позу */
    tr.raw = raw;
    if (raw === tr.pose) { tr.cand = null; return; }
    if (tr.cand !== raw) { tr.cand = raw; tr.candT = t; }
    const need = ACTIVE.has(tr.pose) ? cfg.holdOff : cfg.holdOn;
    if (t - tr.candT >= need) {
      const was = tr.pose; tr.pose = raw; tr.poseT = t; tr.cand = null;
      if (was === 'pinch') ev.push({ type: 'pinch-off', id: tr.id, t });
      if (raw === 'pinch') ev.push({ type: 'pinch-on', id: tr.id, t });
      if (raw === 'fist') ev.push({ type: 'fist-on', id: tr.id, t });
    }
  }

  /* точки в зеркале (как в зеркале видит себя человек), сглаженные 1€ */
  function smooth(tr, t) {
    if (!tr.present) return;
    tr.pts = tr.lm.map((p, i) => ({ x: tr.fx[i].f(1 - p.x, t), y: tr.fy[i].f(p.y, t) }));
    tr.pin = { x: (tr.pts[4].x + tr.pts[8].x) / 2, y: (tr.pts[4].y + tr.pts[8].y) / 2 };
    const c = { x: 0, y: 0 }; PALM.forEach(i => { c.x += tr.pts[i].x / 5; c.y += tr.pts[i].y / 5; }); tr.palmC = c;
  }

  const stable = tr => tr.present && tr.raw === tr.pose;     /* поза не «на выходе» — движение можно применять */
  const dz = v => (Math.abs(v) < cfg.deadZone ? 0 : v);
  const stopMotion = () => { ctl.fling = null; ctl.tween = null; };

  function begin(mode, t, ev, p) {
    const prev = ctl.mode;
    if (prev === mode && ctl.g) return;
    /* конец прежнего жеста */
    if (prev === 'rotate' && ctl.g && mode !== 'rotate') endRotate(t, ev, ctl.g.released);
    if (['zoom', 'pan', 'explode'].includes(prev) && mode !== prev) ctl.multiEnd = t;
    if (prev === 'reset' && mode !== 'reset') ctl.openSince = 0;
    ctl.mode = mode; ctl.g = null;
    if (mode !== prev) ev.push({ type: 'mode', mode, from: prev, t });
    if (mode === 'idle' || mode === 'wait') return;
    if (mode !== 'reset') stopMotion();
    ctl.g = Object.assign({ t0: t }, p);
  }

  function endRotate(t, ev, released) {
    const g = ctl.g; if (!g || !released || ctl.reduced) return;
    /* скорость — по отсчётам ДО отпускания: в момент размыкания пальцев точка щипка прыгает */
    const S = g.hist, tEnd = g.relT || t;
    const ok = S.filter(s => s.t <= tEnd - 20 && s.t >= tEnd - 170);
    if (ok.length < 2) return;
    const a = ok[0], b = ok[ok.length - 1], dt = Math.max(1, b.t - a.t);
    let vy = (b.yaw - a.yaw) / dt, vp = (b.pit - a.pit) / dt; const sp = Math.hypot(vy, vp);
    if (sp < cfg.flingMin || tEnd - b.t > 90) return;
    if (sp > cfg.flingMax) { vy *= cfg.flingMax / sp; vp *= cfg.flingMax / sp; }
    ctl.fling = { vy, vp, t }; ev.push({ type: 'fling', vy, vp, t });
  }

  function update(hands, t) {
    const ev = [];
    tick(t);
    const dets = (hands || []).map(h => { const lm = Array.isArray(h) ? h : (h.lm || h.landmarks); return { lm, handed: Array.isArray(h) ? null : h.handed, score: Array.isArray(h) ? 1 : (h.score == null ? 1 : h.score) }; })
      .filter(d => d.lm && d.lm.length >= 21 && d.score >= 0.5).slice(0, 2);
    dets.forEach(d => { d.f = features(d.lm, cfg); });
    associate(dets, t);
    ctl.tracks.forEach(tr => { debounce(tr, t, ev); smooth(tr, t); });

    /* кулак «ловит» деталь: инерция останавливается */
    if (ev.some(e => e.type === 'fist-on') && ctl.fling) { ctl.fling = null; ev.push({ type: 'catch', t }); }
    const T = ctl.tracks, by = p => T.filter(tr => tr.pose === p);
    const pins = by('pinch'), fists = by('fist'), opens = by('open'), v = view;

    /* вращение кончается: щипок отпущен, а рука на месте — с инерцией; пропала или ушла к краю — без */
    if (ctl.mode === 'rotate' && ctl.g) { const h = T.find(tr => tr.id === ctl.g.id); ctl.g.released = !!(h && h.present && (h.pose === 'idle' || h.pose === 'open')); }   /* сжал в кулак — «поймал», без инерции */
    const multi = ['zoom', 'pan', 'explode'].includes(ctl.mode);

    /* выбор жеста */
    if (pins.length >= 2) {
      const d = D2(pins[0].pin, pins[1].pin);
      begin('zoom', t, ev, { d0: Math.max(d, 0.05), z0: v.zoom, ids: [pins[0].id, pins[1].id] });
      if (pins.every(stable)) v.zoom = clamp(ctl.g.z0 * Math.max(d, 0.01) / ctl.g.d0, cfg.zoomMin, cfg.zoomMax);
    } else if (pins.length === 1 && fists.length === 1) {
      const h = pins[0];
      begin('pan', t, ev, { x: h.pin.x, y: h.pin.y, id: h.id });
      if (stable(h) && stable(fists[0])) {
        const dx = dz(h.pin.x - ctl.g.x), dy = dz(h.pin.y - ctl.g.y);
        v.panX -= dx * cfg.panGain / v.zoom; v.panY += dy * cfg.panGain / v.zoom;
        if (dx) ctl.g.x = h.pin.x; if (dy) ctl.g.y = h.pin.y;
      }
    } else if (fists.length === 2) {
      const d = D2(fists[0].palmC, fists[1].palmC);
      begin('explode', t, ev, { d0: d, e0: v.explode });
      if (fists.every(stable)) {
        const e = clamp(ctl.g.e0 + (d - ctl.g.d0) / cfg.explodeSpan, 0, 1);
        const step = x => Math.floor(x * 4 + 1e-9);
        if (step(e) !== step(v.explode)) ev.push({ type: 'explode-step', e, t });
        v.explode = e;
      }
    } else if (pins.length === 1 && fists.length === 0) {
      const h = pins[0];
      if ((multi || h.poseT <= ctl.multiEnd) && ctl.mode !== 'rotate') begin('wait', t, ev);       /* щипок пережил двуручный жест — ждём свежий */
      else {
        begin('rotate', t, ev, { x: h.pin.x, y: h.pin.y, id: h.id, hist: [{ t, yaw: v.yaw, pit: v.pit }] });
        const g = ctl.g;
        if (stable(h)) {
          const dx = dz(h.pin.x - g.x), dy = dz(h.pin.y - g.y);
          v.yaw -= dx * cfg.rotGain; v.pit = clamp(v.pit + dy * cfg.rotGain, cfg.pitMin, cfg.pitMax);
          if (dx) g.x = h.pin.x; if (dy) g.y = h.pin.y;
          g.hist.push({ t, yaw: v.yaw, pit: v.pit }); while (g.hist.length > 2 && t - g.hist[0].t > 300) g.hist.shift();
          g.relT = 0;
        } else if (!g.relT && h.present && h.cand && h.cand !== 'pinch') g.relT = h.candT;   /* пальцы начали размыкаться */
      }
    } else if (opens.length >= 1 && pins.length === 0 && fists.length === 0) {
      if (ctl.resetLock) begin('idle', t, ev);
      else {
        if (ctl.mode !== 'reset') { begin('reset', t, ev, {}); ctl.openSince = t; }
        if (t - ctl.openSince >= cfg.resetMs) { resetView(t); ev.push({ type: 'reset', t }); ctl.resetLock = true; begin('idle', t, ev); }
      }
    } else begin('idle', t, ev);
    if (!opens.length) ctl.resetLock = false;

    const resetP = ctl.mode === 'reset' ? clamp((t - ctl.openSince) / cfg.resetMs, 0, 1) : 0;
    ctl.frame = {
      t, mode: ctl.mode, label: LABEL[ctl.mode] ? LABEL[ctl.mode](v) : '', resetP, events: ev,
      hands: T.map(tr => ({ id: tr.id, handed: tr.handed, pose: tr.pose, raw: tr.raw, present: tr.present, pts: tr.pts, pin: tr.pin, palmC: tr.palmC,
        ignored: !!(tr.f && (tr.f.edge || tr.f.far)), why: tr.f ? (tr.f.edge ? 'край кадра' : tr.f.far ? 'далеко' : '') : '',
        pinchAmt: tr.f ? clamp((cfg.pinchOff * 1.6 - tr.f.pinch) / (cfg.pinchOff * 1.6 - cfg.pinchOn), 0, 1) : 0,
        drives: !!(ctl.g && (ctl.g.id === tr.id || (ctl.g.ids && ctl.g.ids.includes(tr.id)) || (['explode', 'pan', 'zoom'].includes(ctl.mode) && ACTIVE.has(tr.pose)))) }))
    };
    return ctl.frame;
  }

  /* инерция и анимация сброса; вызывать каждый кадр отрисовки (update зовёт сам) */
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
  return ctl;
}

const LABEL = {
  rotate: () => 'вращение', zoom: v => 'зум ×' + v.zoom.toFixed(2), pan: () => 'панорама',
  explode: v => 'разбор ' + Math.round(v.explode * 100) + '%', reset: () => 'держи ладонь — сброс вида',
  wait: () => 'отпусти щипок и щипни снова', idle: () => ''
};
