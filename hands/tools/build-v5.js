#!/usr/bin/env node
/* Готовит геометрию варианта 5 для голограммы: hands/v5.js.
   Деталь берётся из того же дерева IG3, что и на сайте (hands/models.js ← index.html), и режется на части:
     • тела — дети верхнего объединения U(…), к каждому применены ВСЕ вырезы: фланец и усечённый конус;
     • «пробки» — вынутый материал: вырез ∩ тело (пирамидальное отверстие, 4 отверстия во фланце).
   Для каждой части — сетка (CSG.mesh) и рёбра (featLines). Рёбра на сайте считаются ~0,6 с на часть,
   поэтому здесь, заранее; на странице остаётся только раскодировать.
   Запуск из корня репозитория: node hands/tools/extract-models.js && node hands/tools/build-v5.js */
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { console, Math, Float32Array, Object, Array, Map, Set, performance, document: { createElement: () => ({ getContext: () => null }) } };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../models.js'), 'utf8'), ctx);
const { IG3, IG_VARS } = ctx;
const N = 5, M = IG_VARS[N], T = M.tree, P = IG3.P;
if (T.t !== 's' || T.a.t !== 'u' || T.a.k.length !== 2) { console.error('дерево варианта 5 не похоже на S(U(фланец, конус), …вырезы)'); process.exit(1); }
const [flange, cone] = T.a.k, cuts = T.k, body = T.a;
const pyr = cuts.find(c => c.t === 'npyr'), holes = cuts.filter(c => c.t === 'cyl');
if (!pyr || holes.length !== 4) { console.error('ожидались пирамидальное отверстие и 4 отверстия'); process.exit(1); }

/* части: id, дерево, роль (тело/пробка), гладкие поверхности для очерка (ось z): [cx, cy, r0, r1, z0, z1] */
const parts = [
  { id: 'flange', role: 'body', tree: P.S(flange, ...cuts), surf: [[0, 0, flange.r, flange.r, flange.z0, flange.z1], ...holes.map(h => [h.x, h.y, h.r, h.r, flange.z0, flange.z1])] },
  { id: 'cone', role: 'body', tree: P.S(cone, ...cuts), surf: [[0, 0, cone.r0, cone.r1, cone.z0, cone.z1]] },
  { id: 'pyr', role: 'plug', tree: P.I(pyr, body), surf: [] },
  ...holes.map((h, i) => ({ id: 'hole' + i, role: 'plug', tree: P.I(h, flange), surf: [[h.x, h.y, h.r, h.r, flange.z0, flange.z1]] }))
];

/* кодирование: координаты — int16 с шагом 1/200 мм (±163 мм), нормали — int8 */
const Q = 200;
const i16 = a => { const o = new Int16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.round(a[i] * Q); return Buffer.from(o.buffer).toString('base64'); };
const i8 = a => { const o = new Int8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.round(Math.max(-1, Math.min(1, a[i])) * 127); return Buffer.from(o.buffer).toString('base64'); };
/* склейка рёбер: featLines отдаёт мелкие отрезки по ~0,7 мм; соединяем их в цепочки и выкидываем точки,
   лежащие на прямой (отклонение < 0,02 мм) — линий на GPU в разы меньше, вид тот же */
function simplify(L) {
  const key = p => p.map(v => Math.round(v * 1e3)).join(','), adj = new Map(), segs = [];
  for (let i = 0; i < L.length; i += 2) { const a = key(L[i]), b = key(L[i + 1]); if (a === b) continue; const s = { a, b, p: L[i], q: L[i + 1], used: false }; segs.push(s);
    for (const k of [a, b]) { if (!adj.has(k)) adj.set(k, []); adj.get(k).push(s); } }
  const out = [], dev = (a, b, c) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], l = Math.hypot(...ac) || 1e-9;
    const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]; return Math.hypot(...cr) / l; };
  const walk = (s, from) => { const pts = []; let cur = s, k = from; while (cur && !cur.used) { cur.used = true; const fwd = cur.a === k; pts.push(fwd ? cur.q : cur.p); k = fwd ? cur.b : cur.a;
      const nx = adj.get(k).filter(t => !t.used); cur = adj.get(k).length === 2 ? nx[0] : null; } return pts; };
  for (const s of segs) { if (s.used) continue; s.used = true;
    const fw = walk(adj.get(s.b).length === 2 ? adj.get(s.b).find(t => t !== s) : null, s.b), bw = walk(adj.get(s.a).length === 2 ? adj.get(s.a).find(t => t !== s) : null, s.a);
    const chain = [...bw.reverse(), s.p, s.q, ...fw], keep = [chain[0]];
    for (let i = 1; i < chain.length - 1; i++) { const a = keep[keep.length - 1]; if (dev(a, chain[i], chain[i + 1]) > 0.02 || Math.hypot(chain[i][0] - a[0], chain[i][1] - a[1], chain[i][2] - a[2]) > 40) keep.push(chain[i]); }
    keep.push(chain[chain.length - 1]); for (let i = 0; i < keep.length - 1; i++) out.push(keep[i], keep[i + 1]); }
  return out;
}
const flat = L => { const o = new Float32Array(L.length * 3); L.forEach((p, k) => { o[3 * k] = p[0]; o[3 * k + 1] = p[1]; o[3 * k + 2] = p[2]; }); return o; };
const cen = pos => { let x = 0, y = 0, z = 0, n = pos.length / 3; for (let i = 0; i < pos.length; i += 3) { x += pos[i]; y += pos[i + 1]; z += pos[i + 2]; } return [x / n, y / n, z / n].map(v => +v.toFixed(2)); };

const t0 = Date.now(), out = { n: N, q: Q, box: M.box, parts: [] };
const whole = { tree: T, box: M.box }, wm = IG3.CSG.mesh(T), wl = simplify(IG3.featLines(whole));
out.whole = { pos: i16(wm.pos), nrm: i8(wm.nrm), count: wm.count, lines: i16(flat(wl)) };
for (const p of parts) {
  const me = IG3.CSG.mesh(p.tree), L = simplify(IG3.featLines({ tree: p.tree, box: M.box }));
  out.parts.push({ id: p.id, role: p.role, c: cen(me.pos), surf: p.surf.map(s => s.map(v => +v.toFixed(4))), pos: i16(me.pos), nrm: i8(me.nrm), count: me.count, lines: i16(flat(L)) });
  console.log(p.id.padEnd(6), 'треугольников', me.count / 3, 'отрезков рёбер', L.length / 2);
}
const js = '/* АВТОГЕНЕРАЦИЯ: node hands/tools/build-v5.js — не править руками. Геометрия варианта 5 (дерево IG3 с сайта),\n'
  + '   разрезанная на части для «разбора». Координаты — int16 (мм × q), нормали — int8 (× 127), base64. */\n'
  + 'export default ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '../v5.js'), js);
console.log('hands/v5.js:', (js.length / 1024).toFixed(0), 'КБ за', ((Date.now() - t0) / 1000).toFixed(1), 'с');
