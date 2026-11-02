/* «Угол Монжа»: три плоскости проекций вокруг детали и развёртка в эпюр.
   Плоскости (оси детали: z вверх, главный вид смотрит вдоль +y, вид слева — вдоль +x):
     П₁ — горизонтальная, z = −Z (под деталью);  П₂ — фронтальная, y = +Y (за деталью при главном виде);
     П₃ — профильная, x = +X (за деталью при виде слева). Угол — точка (X, Y, −Z).
   Проекции — рёбра детали и очерк тел вращения; видимость каждого кусочка — лучом к зрителю этой проекции
   (треугольники детали в сетке ячеек — тысячи лучей за миллисекунды). Невидимые рисуются штрихом.
   Развёртка u ∈ [0, 1]: П₁ поворачивается вниз вокруг линии П₁∩П₂, П₃ — вправо вокруг П₂∩П₃;
   при u = 1 всё в плоскости П₂: главный вид, под ним вид сверху, справа — вид слева (в проекционной связи). */

const G = 22;                                             /* отступ плоскостей от детали, мм */

export function createMonge(mesh, lines, surf, box) {
  const X = box[1][0] + G, Y = box[1][1] + G, Z = -(box[0][2] - G), TOP = box[1][2] + G, XL = box[0][0] - G, YL = box[0][1] - G;
  /* направления взгляда и как точка ложится на плоскость */
  const VIEWS = {
    p2: { d: [0, 1, 0], flat: p => [p[0], Y, p[2]], uv: p => [p[0], p[2]], dep: p => p[1] },
    p1: { d: [0, 0, -1], flat: p => [p[0], p[1], -Z], uv: p => [p[0], p[1]], dep: p => -p[2] },
    p3: { d: [1, 0, 0], flat: p => [X, p[1], p[2]], uv: p => [p[1], p[2]], dep: p => p[0] }
  };

  /* видимость: точка закрыта, если какой-то треугольник ближе к зрителю в той же точке проекции */
  function occluder(V) {
    const T = [], N = 48; let lo = [1e9, 1e9], hi = [-1e9, -1e9];
    for (let i = 0; i < mesh.length; i += 9) {
      const a = V.uv([mesh[i], mesh[i + 1], mesh[i + 2]]), b = V.uv([mesh[i + 3], mesh[i + 4], mesh[i + 5]]), c = V.uv([mesh[i + 6], mesh[i + 7], mesh[i + 8]]);
      const da = V.dep([mesh[i], mesh[i + 1], mesh[i + 2]]), db = V.dep([mesh[i + 3], mesh[i + 4], mesh[i + 5]]), dc = V.dep([mesh[i + 6], mesh[i + 7], mesh[i + 8]]);
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]); if (Math.abs(area) < 1e-6) continue;   /* грань ребром к зрителю */
      T.push({ a, b, c, da, db, dc, area });
      [a, b, c].forEach(q => { lo = [Math.min(lo[0], q[0]), Math.min(lo[1], q[1])]; hi = [Math.max(hi[0], q[0]), Math.max(hi[1], q[1])]; });
    }
    const sx = (hi[0] - lo[0]) / N + 1e-6, sy = (hi[1] - lo[1]) / N + 1e-6, cells = Array.from({ length: N * N }, () => []);
    const cell = (u, v) => [Math.min(N - 1, Math.max(0, Math.floor((u - lo[0]) / sx))), Math.min(N - 1, Math.max(0, Math.floor((v - lo[1]) / sy)))];
    T.forEach(t => { const [i0, j0] = cell(Math.min(t.a[0], t.b[0], t.c[0]), Math.min(t.a[1], t.b[1], t.c[1])), [i1, j1] = cell(Math.max(t.a[0], t.b[0], t.c[0]), Math.max(t.a[1], t.b[1], t.c[1]));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) cells[j * N + i].push(t); });
    return p => {
      const [u, v] = V.uv(p), d = V.dep(p); if (u < lo[0] || u > hi[0] || v < lo[1] || v > hi[1]) return false;
      const [i, j] = cell(u, v);
      for (const t of cells[j * N + i]) {
        const w0 = ((t.b[0] - u) * (t.c[1] - v) - (t.c[0] - u) * (t.b[1] - v)) / t.area, w1 = ((t.c[0] - u) * (t.a[1] - v) - (t.a[0] - u) * (t.c[1] - v)) / t.area, w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        if (w0 * t.da + w1 * t.db + w2 * t.dc < d - 0.25) return true;           /* грань ближе к зрителю — закрыто */
      }
      return false;
    };
  }

  /* очерк тел вращения для направления d (как в holo.js) */
  function sil(d) {
    const out = [], A = Math.hypot(d[0], d[1]); if (A < 1e-4) return out;
    surf.forEach(sf => {
      if (sf[0] === 'x') {                                              /* цилиндр вдоль x (патрубок): очерк — его контур на П₁ и П₂ */
        const [, cy, cz, r, x0, x1] = sf; if (Math.hypot(d[1], d[2]) < 1e-4) return;
        const p0 = Math.atan2(-d[1], d[2]);
        for (const ph of [p0, p0 + Math.PI]) { const co = Math.cos(ph), si = Math.sin(ph); out.push([x0, cy + r * co, cz + r * si], [x1, cy + r * co, cz + r * si]); }
        return;
      }
      const [, cx, cy, r0, r1, z0, z1] = sf; const k = (r0 - r1) / (z1 - z0), c = -k * d[2] / A; if (Math.abs(c) > 1) return;
      const al = Math.atan2(d[1], d[0]), ac = Math.acos(c);
      for (const ph of [al + ac, al - ac]) { const co = Math.cos(ph), si = Math.sin(ph); out.push([cx + r0 * co, cy + r0 * si, z0], [cx + r1 * co, cy + r1 * si, z1]); } });
    return out;
  }

  /* проекции: на каждую плоскость — видимые и невидимые отрезки (в мире, уже на плоскости) */
  const t0 = performance.now(), proj = {};
  for (const k in VIEWS) {
    const V = VIEWS[k], hid = occluder(V), vis = [], inv = [];
    const segs = []; for (let i = 0; i < lines.length; i += 6) segs.push([lines[i], lines[i + 1], lines[i + 2]], [lines[i + 3], lines[i + 4], lines[i + 5]]);
    sil(V.d).forEach(p => segs.push(p));
    for (let i = 0; i < segs.length; i += 2) {
      const A = segs[i], B = segs[i + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), n = Math.max(1, Math.ceil(L / 1.5));
      /* отрезок, идущий вдоль взгляда, проецируется в точку — пропускаем */
      const ua = V.uv(A), ub = V.uv(B); if (Math.hypot(ua[0] - ub[0], ua[1] - ub[1]) < 0.05) continue;
      let prev = A, prevH = hid(A);
      for (let s = 1; s <= n; s++) {
        const q = [A[0] + (B[0] - A[0]) * s / n, A[1] + (B[1] - A[1]) * s / n, A[2] + (B[2] - A[2]) * s / n], m = [(prev[0] + q[0]) / 2, (prev[1] + q[1]) / 2, (prev[2] + q[2]) / 2];
        const h = hid(m); (h ? inv : vis).push(V.flat(prev), V.flat(q)); prev = q; prevH = h;
      }
    }
    proj[k] = { vis, inv };
  }
  const ms = performance.now() - t0;

  /* развёртка: поворот точки на плоскости П₁ / П₃ в плоскость П₂ */
  function unfoldPt(k, p, u) {
    const th = u * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
    if (k === 'p1') { const r = p[1] - Y; return [p[0], Y + r * c, -Z + r * s]; }               /* вниз вокруг линии П₁∩П₂ */
    if (k === 'p3') { const r = Y - p[1]; return [X + r * s, Y - r * c, p[2]]; }               /* вправо вокруг линии П₂∩П₃ */
    return p;
  }
  /* рамки плоскостей (4 угла, на плоскости) */
  const FR = {
    p2: [[XL, Y, -Z], [X, Y, -Z], [X, Y, TOP], [XL, Y, TOP]],
    p1: [[XL, YL, -Z], [X, YL, -Z], [X, Y, -Z], [XL, Y, -Z]],
    p3: [[X, YL, -Z], [X, Y, -Z], [X, Y, TOP], [X, YL, TOP]]
  };
  return {
    ms, X, Y, Z, proj, frames: FR, unfoldPt,
    /* отрезки для отрисовки при развёртке u */
    segs(k, which, u) { const src = proj[k][which]; if (!u || k === 'p2') return src; return src.map(p => unfoldPt(k, p, u)); },
    frame(k, u) { return FR[k].map(p => unfoldPt(k, p, u)); },
    /* рамка эпюра после развёртки — для подгонки камеры */
    bounds(u) { const P = ['p1', 'p2', 'p3'].flatMap(k => this.frame(k, u)), lo = [0, 1, 2].map(i => Math.min(...P.map(p => p[i]))), hi = [0, 1, 2].map(i => Math.max(...P.map(p => p[i]))); return { lo, hi }; }
  };
}
