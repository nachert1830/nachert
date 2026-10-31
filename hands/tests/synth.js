/* Синтетическая рука в формате MediaPipe: 21 точка {x, y, z}, координаты кадра 0..1 (до зеркала).
   Скелет строится в 3D (единица — расстояние запястье → пясть среднего пальца), пальцы сгибаются в суставах
   «в глубину», затем рука масштабируется, поворачивается в плоскости кадра и ставится в точку.
   hand({pose, gap, cx, cy, size, rot, noise, seed})
     pose  — 'open' | 'fist' | 'pinch' | 'idle'
     gap   — для pinch: расстояние между кончиками большого и указательного в размерах ладони (= отношение щипка)
     cx,cy — центр ладони В ЗЕРКАЛЕ (как человек видит себя на экране), доли кадра
     size  — размер ладони (запястье → пясть), доля кадра
     rot   — поворот в плоскости кадра, рад; noise — σ шума точек, доли кадра */

const MCP = { 5: [-0.30, 0.95], 9: [0, 1.0], 13: [0.25, 0.95], 17: [0.48, 0.85] };
const LEN = { 5: [0.45, 0.27, 0.22], 9: [0.50, 0.30, 0.23], 13: [0.46, 0.28, 0.22], 17: [0.36, 0.22, 0.20] };
const BEND = {
  open: [0, 0, 0], idle: [30, 40, 20], fist: [95, 95, 65], pinch: [35, 35, 20]
};

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); }; }
function gauss(r) { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function handLocal(pose = 'open', gap = 1.2, bendOver) {
  const P = new Array(21);
  P[0] = [0, 0, 0];
  const bend = bendOver || BEND[pose] || BEND.idle;
  for (const m of [5, 9, 13, 17]) {
    const [x, y] = MCP[m]; P[m] = [x, y, 0];
    const fb = pose === 'pinch' && m !== 5 ? BEND.idle : bend;        /* при щипке остальные пальцы расслаблены */
    let a = 0, p = [x, y, 0];
    for (let j = 0; j < 3; j++) { a += fb[j] * Math.PI / 180; const l = LEN[m][j];
      p = [p[0] + (x * 0.08) * l, p[1] + Math.cos(a) * l, p[2] - Math.sin(a) * l]; P[m + j + 1] = p; }
  }
  /* большой палец */
  P[1] = [-0.35, 0.2, 0]; P[2] = [-0.55, 0.42, 0];
  if (pose === 'pinch') {                        /* кончик ставим к кончику указательного на расстояние gap */
    const t8 = P[8], tip = [t8[0] - gap * 0.8, t8[1] - gap * 0.6, t8[2]];
    P[4] = tip; P[3] = [(P[2][0] + tip[0]) / 2 - 0.05, (P[2][1] + tip[1]) / 2, tip[2] / 2];
  } else if (pose === 'fist') {                  /* большой палец лежит на согнутых пальцах — касается указательного */
    P[3] = [-0.45, 0.62, -0.1]; P[4] = [-0.22, 0.72, -0.25];
  } else if (pose === 'open') {
    P[3] = [-0.78, 0.6, 0]; P[4] = [-0.95, 0.75, 0];
  } else { P[3] = [-0.62, 0.6, -0.05]; P[4] = [-0.6, 0.78, -0.1]; }
  return P;
}

/* центр ладони в локальных координатах — среднее 0, 5, 9, 13, 17 */
const LC = (() => { const P = handLocal('open'); const c = [0, 0]; [0, 5, 9, 13, 17].forEach(i => { c[0] += P[i][0] / 5; c[1] += P[i][1] / 5; }); return c; })();

export function hand(o = {}) {
  const { pose = 'open', gap = 1.2, cx = 0.5, cy = 0.55, size = 0.12, rot = 0, noise = 0, seed = 7, bend } = o;
  const P = handLocal(pose, gap, bend), r = rng(seed), c = Math.cos(rot), s = Math.sin(rot);
  return P.map(([x, y, z]) => {
    const lx = x - LC[0], ly = y - LC[1];
    /* локальная y — вверх по руке, в кадре вверх — это минус y */
    const X = (lx * c - ly * s) * size, Y = -(lx * s + ly * c) * size;
    const mx = cx + X, my = cy + Y;
    return { x: 1 - mx + (noise ? gauss(r) * noise : 0), y: my + (noise ? gauss(r) * noise : 0), z: z * size };
  });
}

/* прогон сценария: frames — функция t → массив рук; шаг dt мс; возвращает все кадры */
export function run(ctl, from, to, frames, dt = 33) {
  const out = [];
  for (let t = from; t <= to + 1e-9; t += dt) out.push(ctl.update(frames(t), t));
  return out;
}
export const events = (fr, type) => fr.flatMap(f => f.events).filter(e => !type || e.type === type);
