/* HUD поверх 3D: курсоры на кончиках пальцев, линия щипка, прицел кулака, кольцо-таймер сброса,
   шкала разбора, выносные подписи частей и строка состояния. Холст 2D, координаты — пиксели CSS.
   Руки приходят из gestures.js уже в зеркале, координаты кадра 0..1; удобная зона кадра (без полей)
   растягивается на всё окно — до краёв окна не нужно тянуться до краёв кадра. */

/* палитры: голограмма (тёмный фон) и чертёж (светлый фон) — HUD перекрашивается вместе со сценой */
const PAL = {
  holo: { CY: '#35e0ff', CY2: 'rgba(53,224,255,', AM: '#ffb547', OK: '#7dffb2', BAD: '#ff6b81', TXT: 'rgba(220,245,255,.8)' },
  draft: { CY: '#0b7fa6', CY2: 'rgba(11,110,150,', AM: '#c46a00', OK: '#138a4f', BAD: '#c8203c', TXT: 'rgba(25,35,50,.85)' }
};
let CY, CY2, AM, OK, BAD, TXT;
const usePal = k => ({ CY, CY2, AM, OK, BAD, TXT } = PAL[k] || PAL.holo);
usePal('holo');
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const TIPS = [4, 8, 12, 16, 20];
const INSET = 0.08;                                         /* поля кадра, которые не отображаются на окно */

/* подписи частей берутся из описания модели (model-*.js → labels):
     { z, r, side } — точка на оси детали и радиус до очерка (деталь «вариант 5»);
     { at: [x, y, z] } — точка на детали (сборка); сторона выноски у сборки чередуется по номерам позиций */
export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const shownPts = new Map(); let moving = false, seen = new Set();
  const map = p => ({ x: (p.x - INSET) / (1 - 2 * INSET) * W, y: (p.y - INSET) / (1 - 2 * INSET) * H });

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5); W = canvas.clientWidth; H = canvas.clientHeight;
    const w = Math.round(W * dpr), h = Math.round(H * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  /* shadowBlur в canvas 2D — отдельный проход размытия на каждую фигуру: на встроенной графике это десятки мс за кадр.
     Свечение HUD не нужно — оставлен вызов-заглушка, чтобы не трогать места рисования */
  const glow = () => {};
  const ring = (x, y, r, c, lw, a0 = 0, a1 = Math.PI * 2) => { ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke(); };

  function drawHand(h, frame, t, reduced) {
    if (!h.pts) return;
    /* курсоры между кадрами распознавания плавно догоняют руку (τ = 35 мс) — а не прыгают 15–30 раз в секунду */
    const tgt = h.pts.map(map), prev = shownPts.get(h.id), k = reduced || !prev ? 1 : 1 - Math.exp(-Math.min(100, t - (prev.t || t)) / 35);
    const P = prev ? tgt.map((q, i) => ({ x: prev.P[i].x + (q.x - prev.P[i].x) * k, y: prev.P[i].y + (q.y - prev.P[i].y) * k })) : tgt;
    shownPts.set(h.id, { P, t }); seen.add(h.id);
    if (P.some((q, i) => Math.abs(q.x - tgt[i].x) + Math.abs(q.y - tgt[i].y) > 0.5)) moving = true;
    const col = h.ignored ? BAD : h.pose === 'pinch' ? OK : h.pose === 'fist' ? AM : CY;
    const a = h.present ? 1 : 0.35;
    ctx.save(); ctx.globalAlpha = a;
    /* скелет — бледно */
    ctx.strokeStyle = h.ignored ? BAD : CY2 + '.28)'; ctx.lineWidth = 1.2; ctx.beginPath();
    BONES.forEach(([i, j]) => { ctx.moveTo(P[i].x, P[i].y); ctx.lineTo(P[j].x, P[j].y); }); ctx.stroke();
    /* курсоры на кончиках */
    glow(col, 10);
    TIPS.forEach(i => { const main = i === 4 || i === 8; ring(P[i].x, P[i].y, main ? 7 : 4, main ? col : CY2 + '.6)', main ? 2 : 1.2);
      if (main) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(P[i].x, P[i].y, 2, 0, 7); ctx.fill(); } });
    /* линия щипка: тем ярче, чем ближе пальцы; сомкнуты — сплошная, с кольцом захвата */
    const A = P[4], B = P[8], m = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    if (h.pose === 'pinch') {
      ctx.setLineDash([]); ctx.strokeStyle = OK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      ring(m.x, m.y, h.drives ? 15 : 11, OK, 2);
      if (h.drives && !reduced) { const k = (t / 900) % 1; ctx.globalAlpha = a * (1 - k); ring(m.x, m.y, 15 + 16 * k, OK, 1.5); ctx.globalAlpha = a; }
    } else if (h.pinchAmt > 0.05 && h.pose !== 'fist') {
      ctx.setLineDash([4, 5]); ctx.strokeStyle = CY2 + (0.25 + 0.6 * h.pinchAmt) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
    }
    /* кулак — шестигранный прицел вокруг ладони */
    const c = map(h.palmC), s = Math.hypot(P[0].x - P[9].x, P[0].y - P[9].y) * 0.9;
    if (h.pose === 'fist') {
      const rot = reduced ? 0 : t / 1400; ctx.strokeStyle = AM; ctx.lineWidth = h.drives ? 2.5 : 1.6; ctx.beginPath();
      for (let k = 0; k <= 6; k++) { const an = rot + k * Math.PI / 3, x = c.x + Math.cos(an) * s, y = c.y + Math.sin(an) * s; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      for (let k = 0; k < 6; k++) { const an = rot + k * Math.PI / 3 + Math.PI / 6; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(an) * s * 0.8, c.y + Math.sin(an) * s * 0.8); ctx.lineTo(c.x + Math.cos(an) * s * 1.05, c.y + Math.sin(an) * s * 1.05); ctx.stroke(); }
    }
    /* открытая ладонь — кольцо-таймер сброса */
    if (h.pose === 'open' || h.raw === 'open') {
      const R = s * 1.15; ring(c.x, c.y, R, CY2 + '.25)', 3);
      if (frame.mode === 'reset') {
        ring(c.x, c.y, R, CY, 4, -Math.PI / 2, -Math.PI / 2 + frame.resetP * Math.PI * 2);
        ctx.shadowBlur = 0; ctx.fillStyle = CY; ctx.font = '600 13px ui-monospace,SFMono-Regular,Menlo,monospace'; ctx.textAlign = 'center';
        ctx.fillText('СБРОС ' + Math.max(0, (1 - frame.resetP) * 1.5).toFixed(1) + ' с', c.x, c.y + R + 20);
      }
    }
    if (h.ignored) { ctx.shadowBlur = 0; ctx.fillStyle = BAD; ctx.font = '12px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('не управляет: ' + h.why, c.x, c.y - s * 1.4); }
    ctx.restore();
  }

  /* выносные подписи частей при разборе */
  /* сборка: выноски двумя колонками по бокам, как позиции на сборочном чертеже — в колонке подписи по высоте
     и раздвинуты, чтобы не налезали; деталь уходит в колонку той стороны, где она на экране */
  function drawCallouts(holo, k) {
    const LB = holo.model.labels || {}, mid = holo.project([0, 0, 0]), items = [];
    for (const id in LB) {
      const lb = LB[id], part = holo.parts.find(p => p.id === id); if (!part || !lb.at) continue;
      const o = holo.offset(id), c0 = holo.project([o[0], o[1], lb.at[2] + o[2]]); if (!c0) continue;
      const side = c0[0] >= (mid ? mid[0] : W / 2) ? 1 : -1;
      const p = holo.project([side * Math.abs(lb.at[0]) + o[0], lb.at[1] + o[1], lb.at[2] + o[2]]);
      items.push({ lb, side, p, y: p[1] });
    }
    ctx.save(); ctx.globalAlpha = k; ctx.font = '600 13px system-ui,sans-serif';
    for (const side of [-1, 1]) {
      const col = items.filter(i => i.side === side).sort((a, b) => a.y - b.y); if (!col.length) continue;
      const tw = Math.max(...col.map(i => ctx.measureText(i.lb.t).width));
      const edge = side > 0 ? Math.max(...col.map(i => i.p[0])) + 50 : Math.min(...col.map(i => i.p[0])) - 50;
      const x = side > 0 ? Math.min(edge, W - 44 - tw) : Math.max(edge, 8 + tw);
      let y = -1e9; col.forEach(i => { i.ty = Math.max(i.y, y + 22); y = i.ty; });
      const over = y - (H - 90); if (over > 0) col.forEach(i => { i.ty -= over; });          /* не уходим под нижнюю плашку */
      col.forEach(i => {
        ctx.strokeStyle = CY; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(i.p[0], i.p[1]); ctx.lineTo(x - side * 8, i.ty); ctx.stroke();
        ctx.fillStyle = CY; ctx.beginPath(); ctx.arc(i.p[0], i.p[1], 2.5, 0, 7); ctx.fill();
        ctx.textAlign = side > 0 ? 'left' : 'right'; ctx.fillStyle = CY; ctx.fillText(i.lb.t, x, i.ty + 4);
      });
    }
    ctx.restore();
  }

  function drawLabels(holo, view) {
    const k = Math.max(0, Math.min(1, (view.explode - 0.55) / 0.25)); if (k <= 0) return;
    if (holo.model.assembly) return drawCallouts(holo, k);
    const LB = holo.model.labels || {};
    ctx.save(); ctx.globalAlpha = k; ctx.font = '600 13px system-ui,sans-serif';
    const ppm = holo.pxPerMm(), mid = holo.project([0, 0, 60]), compact = W < 640 || holo.model.assembly;
    let n = 0;
    for (const key in LB) {
      const lb = LB[key], pid = lb.id || key, part = holo.parts.find(p => p.id === pid); if (!part) continue;
      const o = holo.offset(pid);
      let side = lb.side, c, rr = 0;
      if (lb.at) {                                                       /* сборка: точка на детали, стороны — по очереди */
        side = (n++ % 2) ? -1 : 1; const ax = side > 0 ? lb.at[0] : -lb.at[0];
        c = holo.project([ax + o[0], lb.at[1] + o[1], lb.at[2] + o[2]]);
      } else {
        const ax = pid.startsWith('hole') ? [part.c[0], part.c[1]] : [0, 0];
        c = holo.project([ax[0] + o[0], ax[1] + o[1], lb.z + o[2]]); rr = lb.r;
        if (part.role === 'plug' && mid && c && Math.abs(c[0] - mid[0]) > 20) side = Math.sign(c[0] - mid[0]);
      }
      if (!c) continue;
      lb.r = rr;
      /* не помещается — выноска на другую сторону; не помещается нигде (узкий экран) — текст прижимается к краю */
      const title = compact ? lb.s : lb.t, desc = compact ? '' : lb.d;        /* узкий экран — только короткое имя */
      ctx.font = '12px system-ui,sans-serif'; const tw = Math.max(ctx.measureText(desc).width, (ctx.font = '600 13px system-ui,sans-serif', ctx.measureText(title).width));
      const fits = sd => { const x0 = c[0] + sd * (lb.r * ppm + 64); return sd > 0 ? x0 + tw < W - 44 : x0 - tw > 8; };
      if (!fits(side) && fits(-side)) side = -side;
      const p = [c[0] + side * lb.r * ppm, c[1]];
      const col = part.role === 'plug' ? AM : CY, ex = p[0] + side * 40, ey = p[1] - 24;
      ctx.textAlign = side > 0 ? 'left' : 'right'; let tx = ex + side * 24;
      const tx0 = tx; if (side > 0) tx = Math.min(tx, W - 44 - tw); else tx = Math.max(tx, 8 + tw);
      /* выноска: от очерка части наискосок, затем горизонтально до текста; текст прижат к краю и наехал бы
         на линию — поднимаем его над концом выноски */
      const lift = tx !== tx0 ? -16 : 0, end = lift ? ex + side * 14 : tx - side * 6;
      glow(col, 8); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(ex, ey); ctx.lineTo(end, ey); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = col; ctx.font = '600 13px system-ui,sans-serif'; ctx.fillText(title, tx, ey + 4 + lift - (lift && desc ? 16 : 0));
      if (desc) { ctx.fillStyle = TXT; ctx.font = '12px system-ui,sans-serif'; ctx.fillText(desc, tx, ey + 20 + lift - (lift ? 16 : 0)); }
    }
    ctx.restore();
  }

  /* шкала разбора справа */
  function drawGauge(view, frame) {
    const e = view.explode; if (e < 0.005 && frame.mode !== 'explode') return;
    const x = W - 34, y0 = H * 0.25, y1 = H * 0.75;
    ctx.save(); ctx.strokeStyle = CY2 + '.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    for (let i = 0; i <= 4; i++) { const y = y1 - (y1 - y0) * i / 4; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke(); }
    glow(AM, 10); ctx.strokeStyle = AM; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y1 - (y1 - y0) * e); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = AM; ctx.font = '600 12px ui-monospace,Menlo,monospace'; ctx.textAlign = 'right';
    ctx.fillText('РАЗБОР ' + Math.round(e * 100) + '%', x + 10, y0 - 12); ctx.restore();
  }

  /* уголки рамки и показания */
  function drawFrame(view, info, inset) {
    const L0 = inset.l, B0 = H - inset.b;
    ctx.save(); ctx.strokeStyle = CY2 + '.35)'; ctx.lineWidth = 1.5; const m = 14, l = 26;
    [[L0 + m, m, 1, 1], [W - m, m, -1, 1], [L0 + m, B0 - m, 1, -1], [W - m, B0 - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y); ctx.stroke(); });
    ctx.fillStyle = CY2 + '.7)'; ctx.font = "500 11px Plex,ui-monospace,SFMono-Regular,Menlo,monospace"; ctx.textAlign = 'left';
    const deg = r => ((r * 180 / Math.PI) % 360 + 360) % 360;
    ctx.fillText(`YAW ${deg(view.yaw).toFixed(0).padStart(3)}°  PIT ${(view.pit * 180 / Math.PI).toFixed(0).padStart(3)}°  ZOOM ×${view.zoom.toFixed(2)}`, L0 + 26, B0 - 24);
    if (info) { ctx.textAlign = 'right'; ctx.fillText(info, W - 26, B0 - 24); }
    ctx.restore();
  }

  /* разовые эффекты: ударная волна хлопка, вспышка щелчка */
  const fx = [];
  function effect(type, x, y, t) { fx.push({ type, x, y, t0: t }); }
  function drawEffects(t, reduced) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i], u = (t - e.t0) / (e.type === 'shock' ? 700 : 450); if (u > 1 || u < 0) { if (u > 1) fx.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = 1 - u;
      if (e.type === 'shock') {
        const R = Math.max(W, H) * (reduced ? 0.15 : 0.08 + 0.55 * u);
        ring(e.x, e.y, R, CY, 3 * (1 - u) + 1); ring(e.x, e.y, R * 0.72, CY2 + '.6)', 1.5); ring(e.x, e.y, R * 0.45, AM, 1);
      } else {
        const R = 14 + 40 * u; ring(e.x, e.y, R, OK, 2);
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * R * 0.6, e.y + Math.sin(a) * R * 0.6); ctx.lineTo(e.x + Math.cos(a) * R, e.y + Math.sin(a) * R); ctx.strokeStyle = OK; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
      ctx.restore();
    }
    return fx.length > 0;
  }

  /* указка: прицел на кончике пальца, луч в деталь и подпись части под ним */
  function drawPointer(ptr, holo, t) {
    if (!ptr) return;
    const { x, y, hover } = ptr, col = hover ? OK : CY;
    ctx.save();
    if (!ptr.mouse) ring(x, y, 10, col, 2), ring(x, y, 3, col, 2);
    for (let k = 0; k < (ptr.mouse ? 0 : 4); k++) { const a = k * Math.PI / 2 + t / 900; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); ctx.lineTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); }
    if (ptr.dwell > 0) ring(x, y, 16, AM, 3, -Math.PI / 2, -Math.PI / 2 + ptr.dwell * Math.PI * 2);
    if (hover && !ptr.quiz) {
      const lb = (holo.model.labels || {})[hover]; if (lb) {
        const side = x > W - 260 ? -1 : 1, tx = x + side * 30;
        ctx.textAlign = side > 0 ? 'left' : 'right';
        ctx.font = '600 14px system-ui,sans-serif'; const w1 = ctx.measureText(lb.t).width; ctx.font = '12px system-ui,sans-serif'; const w2 = ctx.measureText(lb.d).width;
        const bw = Math.max(w1, w2) + 20, bx = side > 0 ? tx - 10 : tx - bw + 10;
        ctx.fillStyle = holo.mode === 'draft' ? 'rgba(255,255,255,.92)' : 'rgba(4,12,24,.88)'; ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(bx, y - 42, bw, 46); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col; ctx.font = '600 14px system-ui,sans-serif'; ctx.fillText(lb.t, tx, y - 22);
        ctx.fillStyle = TXT; ctx.font = '12px system-ui,sans-serif'; ctx.fillText(lb.d, tx, y - 6);
      }
    }
    ctx.restore();
  }

  /* разрез: подпись вверху по центру */
  function drawSection(sec) {
    if (!sec) return;
    ctx.save(); ctx.font = '600 13px ui-monospace,SFMono-Regular,Menlo,monospace'; ctx.textAlign = 'center';
    const text = sec.title.toUpperCase() + (sec.value ? '  ·  ' + sec.value : ''), w = ctx.measureText(text).width + 28;
    const Y = 52;                                                   /* вверху, под чипами: внизу — обучение и подсказка */
    ctx.fillStyle = 'rgba(4,12,24,.85)'; ctx.strokeStyle = CY; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(W / 2 - w / 2, Y, w, 28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = CY; ctx.fillText(text, W / 2, Y + 19);
    if (sec.hint) { ctx.font = '11px system-ui,sans-serif'; ctx.fillStyle = TXT; ctx.fillText(sec.hint, W / 2, Y + 44); }
    ctx.restore();
  }

  function drawPlanes(P) {
    if (!P) return; ctx.save(); ctx.font = '600 13px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = CY;
    P.forEach(q => ctx.fillText(q.text, q.x, q.y)); ctx.restore();
  }
  function draw({ frame, view, holo, t, reduced, info, showLabels = true, pointer = null, section = null, planes = null, inset = { l: 0, b: 0 } }) {
    usePal(holo.mode); size(); ctx.clearRect(0, 0, W, H);
    drawFrame(view, info, inset);
    if (showLabels) drawLabels(holo, view);
    drawGauge(view, frame || { mode: '' });
    drawSection(section); drawPlanes(planes);
    moving = false; seen = new Set();
    if (frame) frame.hands.forEach(h => drawHand(h, frame, t, reduced));
    for (const id of shownPts.keys()) if (!seen.has(id)) shownPts.delete(id);
    drawPointer(pointer, holo, t);
    if (drawEffects(t, reduced)) moving = true;
    return moving;                                                  /* true — курсоры ещё догоняют, нужен следующий кадр */
  }
  return { draw, map, effect };
}
