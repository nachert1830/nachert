/* HUD поверх 3D: курсоры рук, кольцо приближения щипка, прогресс удержаний, радиальное меню, ручки секущей
   плоскости и маховика, мини-скелет руки, предупреждения (край кадра, далеко/близко, руки слишком близко),
   выносные подписи частей и строка состояния. Холст 2D, координаты — пиксели CSS.
   Курсоры приходят из gestures.js уже в долях экрана (рабочая зона кадра растянута на окно). */

/* палитры сайта: тёмная тема ('holo') и светлая ('draft') — HUD перекрашивается вместе со сценой.
   Синий — линии и курсор, красный — действие (щипок, захват, вынутый материал), BG — подложка плашек */
const PAL = {
  holo: { CY: '#4dd1ff', CY2: 'rgba(77,209,255,', AM: '#ff993d', OK: '#ff993d', BAD: '#ff7a6b', TXT: 'rgba(214,240,255,.88)', BG: 'rgba(2,14,28,.86)' },
  draft: { CY: '#1a5ae0', CY2: 'rgba(26,90,224,', AM: '#d9222a', OK: '#d9222a', BAD: '#d9222a', TXT: 'rgba(14,28,51,.8)', BG: 'rgba(255,255,255,.94)' }
};
let CY, CY2, AM, OK, BAD, TXT, BG;
const usePal = k => ({ CY, CY2, AM, OK, BAD, TXT, BG } = PAL[k] || PAL.holo);
usePal('holo');
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

/* подписи частей берутся из описания модели (model-*.js → labels):
     { z, r, side } — точка на оси детали и радиус до очерка (деталь «вариант 5»);
     { at: [x, y, z] } — точка на детали (сборка); сторона выноски у сборки чередуется по номерам позиций */
export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  /* радиус дуги не бывает отрицательным: в крошечном или скрытом окне (iframe пульта me/ при переключении) кольца сжимаются до нуля, а не роняют кадр */
  { const arc0 = ctx.arc.bind(ctx); ctx.arc = (x, y, r, a0, a1, ccw) => arc0(x, y, Math.max(0, r), a0, a1, ccw); }
  let W = 0, H = 0, dpr = 1, RW = 0, stark = false;                            /* RW — ширина правой панели: подписи туда не заходят */
  const shown = new Map(); let moving = false, seen = new Set();
  const map = p => ({ x: p.x * W, y: p.y * H });               /* курсор — доли экрана */

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5); W = canvas.clientWidth; H = canvas.clientHeight;
    const w = Math.round(W * dpr), h = Math.round(H * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  /* shadowBlur в canvas 2D — отдельный проход размытия на каждую фигуру: на встроенной графике это десятки мс за кадр.
     Свечение HUD не нужно — оставлен вызов-заглушка, чтобы не трогать места рисования */
  const glow = () => {};
  const ring = (x, y, r, c, lw, a0 = 0, a1 = Math.PI * 2) => { ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke(); };
  const text = (s, x, y, c, font = '600 12px system-ui,sans-serif', align = 'center') => { ctx.font = font; ctx.textAlign = align; ctx.fillStyle = c; ctx.fillText(s, x, y); };
  const plate = (s, x, y, c) => { ctx.font = '600 12px system-ui,sans-serif'; const w = ctx.measureText(s).width + 14; ctx.fillStyle = BG; ctx.fillRect(x - w / 2, y - 14, w, 20); text(s, x, y, c); };

  /* курсор между кадрами распознавания плавно догоняет руку (τ = 35 мс) — а не прыгает 15–30 раз в секунду */
  function follow(h, t, reduced) {
    const tgt = map(h.cursor), prev = shown.get(h.id), k = reduced || !prev ? 1 : 1 - Math.exp(-Math.min(100, t - (prev.t || t)) / 35);
    const P = prev ? { x: prev.P.x + (tgt.x - prev.P.x) * k, y: prev.P.y + (tgt.y - prev.P.y) * k } : tgt;
    shown.set(h.id, { P, t }); seen.add(h.id);
    if (Math.abs(P.x - tgt.x) + Math.abs(P.y - tgt.y) > 0.5) moving = true;
    return P;
  }

  /* курсор руки: кольцо сжимается по мере сближения пальцев; щипок — красный диск; захват — крупное кольцо */
  function drawHand(h, frame, t, reduced) {
    if (!h.cursor) return;
    const C = follow(h, t, reduced), pin = h.pose === 'pinch', a = h.present ? 1 : 0.45, lead = frame.lead === h.id;
    ctx.save(); ctx.globalAlpha = a;
    if (h.ignored) { ring(C.x, C.y, 12, BAD, 2); text('не управляет: ' + h.why, C.x, C.y - 22, BAD, '12px system-ui,sans-serif'); ctx.restore(); return; }
    const R0 = h.ui || h.captured ? 16 : 12, R = pin ? R0 : R0 - 6 * h.pinchAmt;
    ctx.globalAlpha = a * 0.6; ctx.fillStyle = BG; ctx.beginPath(); ctx.arc(C.x, C.y, R0 + 2, 0, 7); ctx.fill(); ctx.globalAlpha = a;
    ring(C.x, C.y, R, pin ? OK : h.busy ? CY2 + '.4)' : CY, 2.5);
    if (!pin && h.pinchAmt > 0.02) ring(C.x, C.y, R0 + 2, OK, 2, -Math.PI / 2, -Math.PI / 2 + h.pinchAmt * Math.PI * 2);
    ctx.fillStyle = pin ? OK : CY; ctx.beginPath(); ctx.arc(C.x, C.y, pin ? 7 : 3, 0, 7); ctx.fill();
    if (h.captured) ring(C.x, C.y, R0 + 6, OK, 1.5);
    if (stark) { const sp = reduced ? 0 : t / 700; for (let i = 0; i < 3; i++) { const a0 = sp + i * 2.094; ring(C.x, C.y, R0 + 10, pin ? OK : CY2 + '.7)', 1.5, a0, a0 + 0.9); }
      ctx.strokeStyle = CY2 + '.6)'; ctx.lineWidth = 1; ctx.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(C.x + dx * (R0 + 14), C.y + dy * (R0 + 14)); ctx.lineTo(C.x + dx * (R0 + 20), C.y + dy * (R0 + 20)); } ctx.stroke(); }
    if (pin && h.drives && frame.mode === 'rotate' && !reduced) { const k = (t / 900) % 1; ctx.globalAlpha = a * (1 - k); ring(C.x, C.y, 16 + 16 * k, OK, 1.5); ctx.globalAlpha = a; }
    /* удержания: щипок по детали (0,4 с — взять) и ладонь (0,5 с — меню) */
    if (lead && frame.holdP > 0) ring(C.x, C.y, 22, AM, 3.5, -Math.PI / 2, -Math.PI / 2 + frame.holdP * Math.PI * 2);
    if (lead && frame.armP > 0) { ring(C.x, C.y, 26, CY2 + '.25)', 3); ring(C.x, C.y, 26, CY, 4, -Math.PI / 2, -Math.PI / 2 + frame.armP * Math.PI * 2); text('МЕНЮ', C.x, C.y + 44, CY, '600 11px ui-monospace,Menlo,monospace'); }
    /* подпись: что сейчас под управлением, и предупреждения про расстояние */
    if (lead && frame.label && !frame.menu) plate(frame.label, C.x, C.y - 34, pin ? OK : CY);
    if (h.dist) plate(h.dist === 'near' ? 'ближе к камере' : 'дальше от камеры', C.x, C.y + (frame.armP > 0 ? 62 : 40), BAD);
    ctx.restore();
  }

  /* два щипка: линия между курсорами; руки слишком близко (MediaPipe теряет их при касании) — красная */
  function drawPair(frame) {
    if (frame.mode !== 'zoom') return;
    const hs = frame.hands.filter(h => h.drives && h.cursor && shown.has(h.id)); if (hs.length < 2) return;
    const [A, B] = hs.map(h => shown.get(h.id).P);
    ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = frame.close ? BAD : OK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
    if (frame.close) plate('не сводите руки ближе', (A.x + B.x) / 2, (A.y + B.y) / 2 - 12, BAD);
    ctx.restore();
  }

  /* радиальное меню у курсора: сектора по часовой, первый — вверху; центр — сброс */
  function drawMenu(M, t, reduced) {
    if (!M) return;
    const c = map(M), n = M.items.length, R1 = 54, R2 = 150, w = 2 * Math.PI / n;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i - 0.5) * w + 0.03, a1 = -Math.PI / 2 + (i + 0.5) * w - 0.03, on = i === M.sel;
      ctx.beginPath(); ctx.arc(c.x, c.y, R2, a0, a1); ctx.arc(c.x, c.y, R1, a1, a0, true); ctx.closePath();
      ctx.fillStyle = on ? OK : BG; ctx.globalAlpha = on ? 0.95 : 0.88; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = on ? OK : CY; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
      const am = -Math.PI / 2 + i * w, rx = c.x + Math.cos(am) * (R1 + R2) / 2, ry = c.y + Math.sin(am) * (R1 + R2) / 2, it = M.items[i];
      if (it.i) text(it.i, rx, ry - 4, on ? '#fff' : CY, '18px system-ui,sans-serif');
      text(it.t + (it.sub ? ' ▸' : ''), rx, ry + (it.i ? 16 : 5), on ? '#fff' : CY, '600 13px system-ui,sans-serif');
    }
    const ctr = M.sel < 0;
    ctx.beginPath(); ctx.arc(c.x, c.y, R1 - 6, 0, 7); ctx.fillStyle = BG; ctx.fill(); ring(c.x, c.y, R1 - 6, ctr ? OK : CY2 + '.5)', ctr ? 2 : 1);
    text('↺', c.x, c.y - 2, ctr ? OK : TXT, '16px system-ui,sans-serif'); text('Сброс', c.x, c.y + 14, ctr ? OK : TXT, '600 11px system-ui,sans-serif');
    if (stark) { const sp = reduced ? 0 : t / 2500; ctx.strokeStyle = CY2 + '.5)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 90; i++) { const a = sp + i * Math.PI / 45, l = i % 5 ? 4 : 9; ctx.moveTo(c.x + Math.cos(a) * (R2 + 8), c.y + Math.sin(a) * (R2 + 8)); ctx.lineTo(c.x + Math.cos(a) * (R2 + 8 + l), c.y + Math.sin(a) * (R2 + 8 + l)); }
      ctx.stroke(); ring(c.x, c.y, R2 + 24, AM, 2, -sp * 2, -sp * 2 + 0.5); ring(c.x, c.y, R2 + 24, AM, 2, -sp * 2 + Math.PI, -sp * 2 + Math.PI + 0.5); }
    text('веди к пункту и щипни · кулак — закрыть', c.x, c.y + R2 + (stark ? 44 : 22), TXT, '12px system-ui,sans-serif');
    ctx.restore();
  }

  /* ручки прямого управления: секущая плоскость (двойная стрелка вдоль оси) и маховик (дуга с процентом) */
  function drawHandles(Hd, t) {
    if (!Hd) return;
    ctx.save();
    if (Hd.plane) {
      const p = Hd.plane, L = Math.hypot(p.dir[0], p.dir[1]) || 1, ux = p.dir[0] / L, uy = p.dir[1] / L, r = p.active ? 17 : 14;
      ctx.fillStyle = BG; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); ring(p.x, p.y, r, AM, p.active ? 3 : 2);
      ctx.strokeStyle = AM; ctx.lineWidth = 2;
      for (const s of [1, -1]) { const ex = p.x + ux * s * (r + 16), ey = p.y + uy * s * (r + 16);
        ctx.beginPath(); ctx.moveTo(p.x + ux * s * (r + 2), p.y + uy * s * (r + 2)); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * s * 7 - uy * 5, ey - uy * s * 7 + ux * 5); ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * s * 7 + uy * 5, ey - uy * s * 7 - ux * 5); ctx.stroke(); }
      ctx.fillStyle = AM; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill();
    }
    if (Hd.wheel) {
      const q = Hd.wheel, R = 70;
      ring(q.x, q.y, R, CY2 + '.3)', 3); ring(q.x, q.y, R, AM, 4, -Math.PI / 2, -Math.PI / 2 - q.open * Math.PI * 2 + 1e-6);
      plate(q.active ? 'вентиль открыт ' + Math.round(q.open * 100) + ' %' : '🤏 щипни маховик и крути', q.x, q.y - R - 12, AM);
    }
    ctx.restore();
  }

  /* мини-скелет руки в углу (когда нет превью камеры — телефон, повтор): видит ли система руку и какую позу */
  function drawMini(frame, inset) {
    const w = 110, h = 82, x0 = W - RW - w - 14, y0 = H - (inset.b || 0) - h - 44;      /* справа внизу — там, где превью камеры */
    ctx.save(); ctx.fillStyle = BG; ctx.globalAlpha = 0.85; ctx.fillRect(x0, y0, w, h); ctx.globalAlpha = 1; ctx.strokeStyle = CY2 + '.4)'; ctx.lineWidth = 1; ctx.strokeRect(x0, y0, w, h);
    const any = frame.hands.some(q => q.present);
    if (!any) text('руки не видно', x0 + w / 2, y0 + h / 2 + 4, TXT, '11px system-ui,sans-serif');
    frame.hands.forEach(q => { if (!q.pts) return;
      ctx.strokeStyle = !q.present ? CY2 + '.3)' : q.ignored ? BAD : q.pose === 'pinch' ? OK : CY; ctx.lineWidth = 1.4; ctx.beginPath();
      BONES.forEach(([i, j]) => { ctx.moveTo(x0 + q.pts[i].x * w, y0 + q.pts[i].y * h); ctx.lineTo(x0 + q.pts[j].x * w, y0 + q.pts[j].y * h); }); ctx.stroke(); });
    ctx.restore();
  }

  /* рука у края кадра: полоса у той же стороны экрана */
  function drawEdges(frame) {
    const h = frame.hands.find(q => q.id === frame.lead && q.present); if (!h || !h.edgeDir) return;
    const d = h.edgeDir, g = d === 'l' ? ctx.createLinearGradient(0, 0, 60, 0) : d === 'r' ? ctx.createLinearGradient(W - RW, 0, W - RW - 60, 0) : d === 't' ? ctx.createLinearGradient(0, 0, 0, 60) : ctx.createLinearGradient(0, H, 0, H - 60);
    g.addColorStop(0, 'rgba(255,90,90,.45)'); g.addColorStop(1, 'rgba(255,90,90,0)');
    ctx.save(); ctx.fillStyle = g;
    if (d === 'l') ctx.fillRect(0, 0, 60, H); else if (d === 'r') ctx.fillRect(W - RW - 60, 0, 60, H); else if (d === 't') ctx.fillRect(0, 0, W, 60); else ctx.fillRect(0, H - 60, W, 60);
    const x = d === 'l' ? 90 : d === 'r' ? W - RW - 90 : (W - RW) / 2, y = d === 't' ? 80 : d === 'b' ? H - 80 : H / 2;
    plate('рука у края кадра', x, y, BAD); ctx.restore();
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
      const x = side > 0 ? Math.min(edge, W - RW - 44 - tw) : Math.max(edge, 8 + tw);
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
      const fits = sd => { const x0 = c[0] + sd * (lb.r * ppm + 64); return sd > 0 ? x0 + tw < W - RW - 44 : x0 - tw > 8; };
      if (!fits(side) && fits(-side)) side = -side;
      const p = [c[0] + side * lb.r * ppm, c[1]];
      const col = part.role === 'plug' ? AM : CY, ex = p[0] + side * 40, ey = p[1] - 24;
      ctx.textAlign = side > 0 ? 'left' : 'right'; let tx = ex + side * 24;
      const tx0 = tx; if (side > 0) tx = Math.min(tx, W - RW - 44 - tw); else tx = Math.max(tx, 8 + tw);
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

  /* ════ голографический стенд (тёмная тема): целеуказатель вокруг модели, лента азимута, шкала тангажа,
     телеметрия, захват детали, загрузка. В светлой теме («чертёж») ничего этого нет — там строгий лист. ════ */
  const MONO = "500 11px Plex,ui-monospace,SFMono-Regular,Menlo,monospace";
  const deg = r => ((r * 180 / Math.PI) % 360 + 360) % 360;
  const boot = { t0: null };
  const ease = u => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3);

  /* кольца вокруг модели: тонкая окружность, вращающиеся дуги, шкала с рисками через 5°, отметка азимута */
  function drawRings(view, holo, t, reduced, k) {
    const b = holo.box, c = holo.project([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2]); if (!c) return;
    const R = Math.min(Math.max(120, holo.pxPerMm() * Math.hypot(b[1][0] - b[0][0], b[1][1] - b[0][1], b[1][2] - b[0][2]) * 0.36), Math.min(W - RW, H) * 0.36) * (0.6 + 0.4 * k);
    const sp = reduced ? 0 : t / 1000;
    ctx.save(); ctx.globalAlpha = k;
    ring(c[0], c[1], R, CY2 + '.18)', 1);
    for (let i = 0; i < 3; i++) { const a = sp * 0.35 + i * 2.094; ring(c[0], c[1], R * 1.04, CY2 + '.55)', 2, a, a + 0.62); }
    for (let i = 0; i < 2; i++) { const a = -sp * 0.22 + i * Math.PI; ring(c[0], c[1], R * 1.10, AM, 1.5, a, a + 0.28); }
    ctx.strokeStyle = CY2 + '.35)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 72; i++) { const a = i * Math.PI / 36 - view.yaw, l = i % 6 ? 5 : 11, co = Math.cos(a), si = Math.sin(a);
      ctx.moveTo(c[0] + co * R * 1.16, c[1] + si * R * 1.16); ctx.lineTo(c[0] + co * (R * 1.16 + l), c[1] + si * (R * 1.16 + l)); }
    ctx.stroke();
    /* отметка «на зрителя» и подпись азимута */
    ctx.fillStyle = AM; ctx.beginPath(); ctx.moveTo(c[0], c[1] - R * 1.16 + 2); ctx.lineTo(c[0] - 6, c[1] - R * 1.16 - 9); ctx.lineTo(c[0] + 6, c[1] - R * 1.16 - 9); ctx.fill();
    text(`АЗ ${deg(view.yaw).toFixed(0).padStart(3, '0')}°`, c[0], c[1] - R * 1.16 - 16, AM, MONO);
    ctx.restore();
  }

  /* лента азимута сверху и шкала тангажа слева — как авиаприбор */
  function drawTapes(view, inset, frame) {
    const act = !!(frame && ['rotate', 'zoom'].includes(frame.mode));          /* приборы ярко — только когда модель крутят */
    const L0 = inset.l || 0, CX = L0 + (W - RW - L0) / 2, y = 64, half = 170, ppd = 2.2, yd = deg(view.yaw);
    ctx.save(); ctx.beginPath(); ctx.rect(CX - half, y - 4, half * 2, 30); ctx.clip();
    ctx.strokeStyle = CY2 + '.45)'; ctx.fillStyle = CY2 + '.75)'; ctx.font = MONO; ctx.textAlign = 'center'; ctx.lineWidth = 1; ctx.beginPath();
    for (let d = Math.floor(yd / 5) * 5 - 90; d <= yd + 90; d += 5) { const x = CX + (d - yd) * ppd; ctx.moveTo(x, y); ctx.lineTo(x, y + (d % 30 ? 5 : 10));
      if (d % 30 === 0) ctx.fillText(String(((d % 360) + 360) % 360).padStart(3, '0'), x, y + 22); }
    ctx.stroke(); ctx.restore();
    ctx.save(); const g = ctx.createLinearGradient(CX - half, 0, CX + half, 0); g.addColorStop(0, CY2 + '0)'); g.addColorStop(0.5, CY2 + '.5)'); g.addColorStop(1, CY2 + '0)');
    ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(CX - half, y); ctx.lineTo(CX + half, y); ctx.stroke();
    ctx.fillStyle = AM; ctx.beginPath(); ctx.moveTo(CX, y + 1); ctx.lineTo(CX - 5, y - 7); ctx.lineTo(CX + 5, y - 7); ctx.fill(); ctx.restore();
    /* тангаж */
    /* тангаж — справа, у панели (слева — карточка жестов) */
    const X = L0 + 34, CY0 = H / 2, ph = 150, pd = view.pit * 180 / Math.PI, pp = 2.4;
    ctx.save(); ctx.globalAlpha = act ? 1 : 0.4; ctx.beginPath(); ctx.rect(X - 4, CY0 - ph, 50, ph * 2); ctx.clip();
    ctx.strokeStyle = CY2 + '.45)'; ctx.fillStyle = CY2 + '.75)'; ctx.font = MONO; ctx.textAlign = 'left'; ctx.beginPath();
    for (let d = Math.floor(pd / 5) * 5 - 70; d <= pd + 70; d += 5) { const yy = CY0 - (d - pd) * pp; ctx.moveTo(X, yy); ctx.lineTo(X + (d % 15 ? 5 : 11), yy);
      if (d % 15 === 0) ctx.fillText((d > 0 ? '+' : '') + d, X + 14, yy + 4); }
    ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha = act ? 1 : 0.4; ctx.fillStyle = AM; ctx.beginPath(); ctx.moveTo(X - 2, CY0); ctx.lineTo(X - 10, CY0 - 5); ctx.lineTo(X - 10, CY0 + 5); ctx.fill();
    text('ТАНГАЖ', X + 4, CY0 - ph - 8, CY2 + '.7)', MONO, 'left'); ctx.restore();
  }

  /* телеметрия: блок слева внизу — числа и полосы */
  function drawTelemetry(view, frame, info, inset, holo, t) {
    if (W <= 820) return;   /* телефон: блок закрыл бы деталь */
    const x0 = (inset.l || 0) + 16, w = 236, rows = [
      ['АЗИМУТ', deg(view.yaw).toFixed(0) + '°', deg(view.yaw) / 360],
      ['ТАНГАЖ', (view.pit * 180 / Math.PI).toFixed(0) + '°', (view.pit + 0.2) / 1.77],
      ['МАСШТАБ', '×' + view.zoom.toFixed(2), Math.log(view.zoom / 0.5) / Math.log(10)],
      ['РАЗБОР', Math.round((view.explode || 0) * 100) + ' %', view.explode || 0]];
    if (holo.model.kin) rows.push(['ВЕНТИЛЬ', Math.round((view.open || 0) * 100) + ' %', view.open || 0]);
    const n = frame ? frame.hands.filter(h => h.present).length : 0;
    const h = 30 + rows.length * 19 + 22, y0 = H - (inset.b || 0) - h - 14;
    ctx.save(); ctx.fillStyle = BG; ctx.globalAlpha = 0.78; ctx.fillRect(x0, y0, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = CY2 + '.35)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
    ctx.fillStyle = CY; ctx.fillRect(x0, y0, 26, 2);
    text('ТЕЛЕМЕТРИЯ · ' + (holo.model.title || '').toUpperCase(), x0 + 10, y0 + 18, CY, MONO, 'left');
    rows.forEach(([k, v, u], i) => { const y = y0 + 38 + i * 19;
      text(k, x0 + 10, y, CY2 + '.7)', MONO, 'left'); text(v, x0 + 132, y, CY, MONO, 'right');
      ctx.fillStyle = CY2 + '.15)'; ctx.fillRect(x0 + 142, y - 7, 82, 5); ctx.fillStyle = CY; ctx.fillRect(x0 + 142, y - 7, 82 * Math.max(0, Math.min(1, u)), 5); });
    const on = (t / 600) % 2 < 1.4;
    ctx.fillStyle = n ? '#4dffb8' : AM; if (on) { ctx.beginPath(); ctx.arc(x0 + 14, y0 + h - 12, 3.5, 0, 7); ctx.fill(); }
    text(n ? `РУКИ: ${n} · ${frame && frame.fps ? frame.fps.toFixed(0) : '–'} КАДР/С` : 'РУКИ: ОЖИДАНИЕ', x0 + 24, y0 + h - 8, n ? '#4dffb8' : AM, MONO, 'left');
    if (info) text(info, W - RW - 26, H - (inset.b || 0) - 24, CY2 + '.6)', MONO, 'right');
    ctx.restore();
  }

  /* захват детали: скобки по экранной рамке детали, линия к карточке анализа (номер, имя, материал, габарит) */
  const lock = { id: null, t0: 0 };
  function drawLock(ptr, holo, t, reduced) {
    if (!ptr || !ptr.hover || ptr.quiz || ptr.named === false) { lock.id = null; return; }
    const id = ptr.hover, part = holo.parts.find(p => p.id === id) || holo.parts.find(p => holo.model.group && holo.model.group(p.id) === id); if (!part || !part.bb) return;
    if (lock.id !== id) { lock.id = id; lock.t0 = t; }
    const o = holo.offset(part.id), bb = part.bb, xs = [], ys = [];
    for (let i = 0; i < 8; i++) { const q = holo.project([bb[i & 1][0] + o[0], bb[(i >> 1) & 1][1] + o[1], bb[(i >> 2) & 1][2] + o[2]]); if (q) { xs.push(q[0]); ys.push(q[1]); } }
    if (!xs.length) return;
    const u = reduced ? 1 : ease((t - lock.t0) / 260), pad = 10 + 26 * (1 - u);
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad, L = Math.min(18, (x1 - x0) / 3, (y1 - y0) / 3);
    ctx.save(); ctx.strokeStyle = AM; ctx.lineWidth = 2; ctx.globalAlpha = 0.4 + 0.6 * u; ctx.beginPath();
    [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); });
    ctx.stroke();
    const lb = (holo.model.labels || {})[id] || {}, dp = (holo.model.data && holo.model.data.parts || []).find(p => p.id === part.id);
    const dims = [0, 1, 2].map(k => Math.round(bb[1][k] - bb[0][k]));
    const lines = [lb.t || id, 'МАТЕРИАЛ: ' + ((dp && dp.mat) || lb.d || '—'), `ГАБАРИТ: ${dims[0]}×${dims[1]}×${dims[2]} мм`];
    const side = x1 + 250 < W - RW ? 1 : -1, cx = side > 0 ? x1 + 40 : x0 - 40, cy = Math.max(70, y0 + 10), bw = 236, bh = 68;
    ctx.beginPath(); ctx.moveTo(side > 0 ? x1 : x0, y0 + 10); ctx.lineTo(cx, cy); ctx.lineTo(cx + side * 12, cy); ctx.lineWidth = 1; ctx.stroke();
    const bx = side > 0 ? cx + 12 : cx - 12 - bw;
    ctx.fillStyle = BG; ctx.globalAlpha = 0.9 * u; ctx.fillRect(bx, cy - 14, bw, bh); ctx.globalAlpha = u; ctx.strokeRect(bx + 0.5, cy - 13.5, bw - 1, bh - 1);
    ctx.fillStyle = AM; ctx.fillRect(bx, cy - 14, 4, bh);
    text('АНАЛИЗ ДЕТАЛИ', bx + 12, cy, AM, MONO, 'left');
    text(lines[0], bx + 12, cy + 18, '#fff', '600 13px system-ui,sans-serif', 'left');
    text(lines[1], bx + 12, cy + 34, TXT, MONO, 'left'); text(lines[2], bx + 12, cy + 48, TXT, MONO, 'left');
    ctx.restore();
  }

  /* загрузка: кольца разворачиваются, строки «печатаются» — 2,4 с при первом показе голограммы */
  function drawBoot(holo, t, reduced, inset) {
    if (reduced) return 1;
    if (boot.t0 == null) boot.t0 = t;
    const u = (t - boot.t0) / 2400; if (u >= 1) return 1;
    const CX = (inset.l || 0) + (W - RW - (inset.l || 0)) / 2, CY0 = H * 0.46, L = [
      'НАЧЕРТ // ГОЛОГРАФИЧЕСКИЙ СТЕНД', 'ЗАГРУЗКА МОДЕЛИ: ' + (holo.model.title || '').toUpperCase() + ' · ' + holo.parts.length + ' ДЕТ.',
      'КАЛИБРОВКА ПРОЕКТОРА ........ OK', 'ОТСЛЕЖИВАНИЕ РУК ............ ГОТОВО'];
    ctx.save(); ctx.globalAlpha = u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
    for (let i = 0; i < 3; i++) { const r = 40 + 90 * ease(u * 1.6 - i * 0.15); ring(CX, CY0, r, i === 1 ? AM : CY, 1.5, t / 400 + i, t / 400 + i + 4.2); }
    L.forEach((s, i) => { const k = Math.max(0, Math.min(1, u * 2.2 - i * 0.3)); if (k > 0) text(s.slice(0, Math.ceil(s.length * k)) + (k < 1 ? '▌' : ''), CX, CY0 + 150 + i * 18, i ? CY : AM, MONO); });
    ctx.restore();
    return ease(u / 0.6);
  }

  /* уголки рамки и показания */
  function drawFrame(view, info, inset, cornersOnly) {
    const L0 = inset.l, B0 = H - inset.b;
    ctx.save(); ctx.strokeStyle = CY2 + '.35)'; ctx.lineWidth = 1.5; const m = 14, l = 26;
    [[L0 + m, m, 1, 1], [W - RW - m, m, -1, 1], [L0 + m, B0 - m, 1, -1], [W - RW - m, B0 - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y); ctx.stroke(); });
    if (cornersOnly) { ctx.restore(); return; }
    ctx.fillStyle = CY2 + '.7)'; ctx.font = "500 11px Plex,ui-monospace,SFMono-Regular,Menlo,monospace"; ctx.textAlign = 'left';
    const deg = r => ((r * 180 / Math.PI) % 360 + 360) % 360;
    ctx.fillText(`YAW ${deg(view.yaw).toFixed(0).padStart(3)}°  PIT ${(view.pit * 180 / Math.PI).toFixed(0).padStart(3)}°  ZOOM ×${view.zoom.toFixed(2)}`, L0 + 26, B0 - 24);
    if (info) { ctx.textAlign = 'right'; ctx.fillText(info, W - RW - 26, B0 - 24); }
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

  /* наведение (рукой или мышью): подпись части под курсором; курсор руки рисует drawHand */
  function drawPointer(ptr, holo, t) {
    if (!ptr) return;
    const { x, y, hover } = ptr, col = hover ? OK : CY;
    ctx.save();
    if (hover && !ptr.quiz && ptr.named !== false) {
      const lb = (holo.model.labels || {})[hover]; if (lb) {
        const side = x > W - RW - 260 ? -1 : 1, tx = x + side * 30;
        ctx.textAlign = side > 0 ? 'left' : 'right';
        ctx.font = '600 14px system-ui,sans-serif'; const w1 = ctx.measureText(lb.t).width; ctx.font = '12px system-ui,sans-serif'; const w2 = ctx.measureText(lb.d).width;
        const bw = Math.max(w1, w2) + 20, bx = side > 0 ? tx - 10 : tx - bw + 10;
        ctx.fillStyle = BG; ctx.strokeStyle = col; ctx.lineWidth = 1;
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
    const text = sec.title.toUpperCase() + (sec.value ? '  ·  ' + sec.value : ''), w = ctx.measureText(text).width + 28, CX = (W - RW) / 2;
    const Y = 52;                                                   /* вверху, под чипами: внизу — обучение и подсказка */
    ctx.fillStyle = BG; ctx.strokeStyle = CY; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(CX - w / 2, Y, w, 28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = CY; ctx.fillText(text, CX, Y + 19);
    if (sec.hint) { ctx.font = '11px system-ui,sans-serif'; ctx.fillStyle = TXT; ctx.fillText(sec.hint, CX, Y + 44); }
    ctx.restore();
  }

  function drawPlanes(P) {
    if (!P) return; ctx.save(); ctx.font = '600 13px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = CY;
    P.forEach(q => ctx.fillText(q.text, q.x, q.y)); ctx.restore();
  }
  function draw({ frame, view, holo, t, reduced, info, showLabels = true, pointer = null, section = null, planes = null, handles = null, mini = false, inset = { l: 0, b: 0, r: 0 } }) {
    usePal(holo.mode); size(); ctx.clearRect(0, 0, W, H); RW = inset.r || 0; stark = holo.mode === 'holo';
    let bootK = 1;
    if (stark) { bootK = drawBoot(holo, t, reduced, inset); if (bootK < 1) moving = true; drawFrame(view, '', inset, true); drawRings(view, holo, t, reduced, bootK); drawTapes(view, inset, frame); drawTelemetry(view, frame, info, inset, holo, t); }
    else drawFrame(view, info, inset);
    if (showLabels) drawLabels(holo, view);
    drawSection(section); drawPlanes(planes); drawHandles(handles, t);
    seen = new Set();
    if (stark) drawLock(pointer, holo, t, reduced); else drawPointer(pointer, holo, t);
    if (frame) {
      drawEdges(frame); drawPair(frame);
      drawMenu(frame.menu, t, reduced);
      frame.hands.forEach(h => drawHand(h, frame, t, reduced));
      if (mini) drawMini(frame, inset);
    }
    for (const id of shown.keys()) if (!seen.has(id)) shown.delete(id);
    if (drawEffects(t, reduced)) moving = true;
    /* кольца и стрелки голограммы крутятся с «фоновой» перерисовкой (≤ 30 кадр/с, app.js) — отдельно кадры не просим */
    const mv = moving; moving = false;
    return mv;                                                  /* true — курсоры ещё догоняют, нужен следующий кадр */
  }
  return { draw, map, effect };
}
