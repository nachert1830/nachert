/* Общее для сборщиков геометрии (build-v5.js, build-valve.js): загрузка IG3 из models.js, склейка линий, упаковка. */
const vm = require('vm'), fs = require('fs'), path = require('path');

function loadIG3() {
  const ctx = { console, Math, Float32Array, Object, Array, Map, Set, performance, document: { createElement: () => ({ getContext: () => null }) } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../models.js'), 'utf8'), ctx);
  return ctx;
}

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

/* кодирование: координаты — int16 с шагом 1/Q мм, нормали — int8 */
const Q = 200;
const i16 = a => { const o = new Int16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.round(a[i] * Q); return Buffer.from(o.buffer).toString('base64'); };
const i8 = a => { const o = new Int8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.round(Math.max(-1, Math.min(1, a[i])) * 127); return Buffer.from(o.buffer).toString('base64'); };
const flat = L => { const o = new Float32Array(L.length * 3); L.forEach((p, k) => { o[3 * k] = p[0]; o[3 * k + 1] = p[1]; o[3 * k + 2] = p[2]; }); return o; };
const cen = pos => { let x = 0, y = 0, z = 0, n = pos.length / 3; for (let i = 0; i < pos.length; i += 3) { x += pos[i]; y += pos[i + 1]; z += pos[i + 2]; } return [x / n, y / n, z / n].map(v => +v.toFixed(2)); };

module.exports = { loadIG3, simplify, Q, i16, i8, flat, cen };
