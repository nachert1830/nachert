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

/* подписи частей варианта 5: высота z на оси части, радиус (выноска начинается на очерке), сторона выноски
   (у пробок сторона выбирается по тому, где пробка на экране относительно детали) */
export const LABELS = {
  flange: { z: 12.5, r: 55, side: 1, s: 'Фланец Ø110', t: 'Фланец', d: 'цилиндр Ø110, высота 25' },
  cone: { z: 75, r: 34, side: -1, s: 'Конус Ø80→Ø60', t: 'Усечённый конус', d: 'Ø80 → Ø60, высота 95' },
  pyr: { z: 112, r: 12, side: 1, s: 'Пирамида-отверстие', t: 'Сквозное отверстие', d: 'правильная трёхгранная пирамида, вписана в Ø25 → Ø50' },
  hole0: { z: 0, r: 5, side: -1, s: '4 отв. Ø10', t: '4 отверстия Ø10', d: 'на окружности Ø95, через 90°' }
};

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const map = p => ({ x: (p.x - INSET) / (1 - 2 * INSET) * W, y: (p.y - INSET) / (1 - 2 * INSET) * H });

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight;
    const w = Math.round(W * dpr), h = Math.round(H * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const glow = (c, b) => { ctx.shadowColor = c; ctx.shadowBlur = b; };
  const ring = (x, y, r, c, lw, a0 = 0, a1 = Math.PI * 2) => { ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke(); };

  function drawHand(h, frame, t, reduced) {
    if (!h.pts) return;
    const P = h.pts.map(map), col = h.ignored ? BAD : h.pose === 'pinch' ? OK : h.pose === 'fist' ? AM : CY;
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
  function drawLabels(holo, view) {
    const k = Math.max(0, Math.min(1, (view.explode - 0.55) / 0.25)); if (k <= 0) return;
    const L = holo.layout(view.explode);
    ctx.save(); ctx.globalAlpha = k; ctx.font = '600 13px system-ui,sans-serif';
    const ppm = holo.pxPerMm(), mid = holo.project([0, 0, 60]), compact = W < 640;
    for (const id in LABELS) {
      const lb = LABELS[id], part = holo.parts.find(p => p.id === id); if (!part) continue;
      const o = id.startsWith('hole') ? L.hole : L[id], ax = id.startsWith('hole') ? [part.c[0], part.c[1]] : [0, 0];
      const c = holo.project([ax[0] + o[0], ax[1] + o[1], lb.z + o[2]]); if (!c) continue;
      let side = lb.side; if (part.role === 'plug' && mid && Math.abs(c[0] - mid[0]) > 20) side = Math.sign(c[0] - mid[0]);
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
  function drawFrame(view, info) {
    ctx.save(); ctx.strokeStyle = CY2 + '.35)'; ctx.lineWidth = 1.5; const m = 14, l = 26;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y); ctx.stroke(); });
    ctx.fillStyle = CY2 + '.7)'; ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace'; ctx.textAlign = 'left';
    const deg = r => ((r * 180 / Math.PI) % 360 + 360) % 360;
    ctx.fillText(`ВАРИАНТ 5   YAW ${deg(view.yaw).toFixed(0).padStart(3)}°  PIT ${(view.pit * 180 / Math.PI).toFixed(0).padStart(3)}°  ZOOM ×${view.zoom.toFixed(2)}`, 26, H - 24);
    if (info) { ctx.textAlign = 'right'; ctx.fillText(info, W - 26, H - 24); }
    ctx.restore();
  }

  function draw({ frame, view, holo, t, reduced, info, showLabels = true }) {
    usePal(holo.mode); size(); ctx.clearRect(0, 0, W, H);
    drawFrame(view, info);
    if (showLabels) drawLabels(holo, view);
    drawGauge(view, frame || { mode: '' });
    if (frame) frame.hands.forEach(h => drawHand(h, frame, t, reduced));
  }
  return { draw, map };
}
