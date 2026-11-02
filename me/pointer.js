/* Рука как мышь для всего пульта me/. Чистый модуль: ни DOM, ни камеры — только точки и время (тест — tests/me-pointer.js).
   Вход update(hands, t): hands — массив рук, рука — {lm:[21 точка {x,y} кадра 0..1, ДО зеркала]} или сам массив точек; t — мс.
   Выход — события для страницы:
     {type:'move', x, y}            курсор (доли экрана 0..1, уже в зеркале — как человек видит себя);
     {type:'down', x, y}            начало щипка — цель там, где был курсор за aimMs до смыкания пальцев (пока пальцы сходятся, кончик съезжает);
     {type:'drag', x, y, dx, dy}    ведём со щипком;
     {type:'up', x, y, tap}         разжал; tap — почти не двигал (это нажатие, а не перетаскивание);
     {type:'zoom', k}               щипок двумя руками: k > 1 — развели (приблизить), < 1 — свели;
     {type:'palm', p} / {type:'back'}  открытая ладонь: p — прогресс 0..1, через holdPalm мс — «назад».
   Пороги — как у голограммы hands/ (щипок |4−8| / ладонь с гистерезисом), чтобы рука вела себя одинаково везде. */
export const CFG = {
  pinchOn: 0.30, pinchOff: 0.48,   /* щипок: |большой−указательный| / |запястье−основание среднего| */
  openOn: 1.62,                    /* ладонь: все 4 пальца прямые (|кончик−запястье| / |пясть−запястье|) */
  smooth: 0.45,                    /* сглаживание курсора (доля нового положения за кадр) */
  aimMs: 150, histMs: 300,         /* цель щипка — положение курсора за aimMs до начала */
  tapPx: 0.025,                    /* сдвиг меньше этого (доля экрана) — нажатие */
  holdPalm: 1500,                  /* ладонь, мс — «назад» */
  edge: 0.03                       /* рука у самого края кадра не управляет */
};
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pts = h => (h && h.lm) || h;
export function pinchRatio(lm) { const palm = d(lm[0], lm[9]) || 1e-6; return d(lm[4], lm[8]) / palm; }
export function isOpen(lm) { const r = (tip, mcp) => d(lm[tip], lm[0]) / (d(lm[mcp], lm[0]) || 1e-6); return Math.min(r(8, 5), r(12, 9), r(16, 13), r(20, 17)) > CFG.openOn; }

export function createPointer(cfg) {
  const C = Object.assign({}, CFG, cfg || {});
  let cur = null, hist = [], pinched = false, start = null, last = null, moved = 0, zoomD = 0, palmT = 0, palmFired = false, pinch2 = false;
  function aim(t) { for (let i = hist.length - 1; i >= 0; i--) if (hist[i].t <= t - C.aimMs) return hist[i]; return hist[0] || cur; }
  function update(hands, t) {
    const ev = [], H = (hands || []).map(pts).filter(lm => lm && lm.length >= 21 && lm[8].x > C.edge && lm[8].x < 1 - C.edge && lm[8].y > C.edge && lm[8].y < 1 - C.edge);
    if (!H.length) { if (pinched) ev.push({ type: 'up', x: cur.x, y: cur.y, tap: false }); pinched = false; pinch2 = false; zoomD = 0; palmT = 0; palmFired = false; return ev; }
    /* две руки со щипком — зум */
    const pin = H.filter(lm => pinchRatio(lm) < (pinched || pinch2 ? C.pinchOff : C.pinchOn));
    if (pin.length >= 2) {
      if (pinched) { ev.push({ type: 'up', x: cur.x, y: cur.y, tap: false }); pinched = false; }
      const dd = d(pin[0][8], pin[1][8]); if (zoomD > 0 && dd > 0) ev.push({ type: 'zoom', k: dd / zoomD }); zoomD = dd; pinch2 = true; return ev;
    }
    zoomD = 0;
    if (pinch2) { if (pin.length) return ev; pinch2 = false; }   /* после зума — только свежий щипок */
    const lm = H[0], raw = { x: 1 - lm[8].x, y: lm[8].y };
    cur = cur ? { x: cur.x + (raw.x - cur.x) * C.smooth, y: cur.y + (raw.y - cur.y) * C.smooth } : raw;
    hist.push({ t, x: cur.x, y: cur.y }); while (hist.length && hist[0].t < t - C.histMs) hist.shift();
    const r = pinchRatio(lm);
    if (!pinched && r < C.pinchOn) { pinched = true; start = aim(t); last = start; moved = 0; ev.push({ type: 'down', x: start.x, y: start.y }); palmT = 0; return ev; }
    if (pinched && r > C.pinchOff) { pinched = false; ev.push({ type: 'up', x: last.x, y: last.y, tap: moved < C.tapPx }); return ev; }
    if (pinched) { const dx = cur.x - last.x, dy = cur.y - last.y; moved = Math.max(moved, Math.hypot(cur.x - start.x, cur.y - start.y)); last = { x: cur.x, y: cur.y };
      ev.push({ type: 'drag', x: cur.x, y: cur.y, dx, dy }); return ev; }
    ev.push({ type: 'move', x: cur.x, y: cur.y });
    if (isOpen(lm)) { if (!palmT) palmT = t; const p = Math.min(1, (t - palmT) / C.holdPalm); ev.push({ type: 'palm', p }); if (p >= 1 && !palmFired) { palmFired = true; ev.push({ type: 'back' }); } }
    else { if (palmT) ev.push({ type: 'palm', p: 0 }); palmT = 0; palmFired = false; }
    return ev;
  }
  return { update, get pinched() { return pinched; } };
}
