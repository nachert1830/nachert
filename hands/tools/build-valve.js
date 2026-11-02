#!/usr/bin/env node
/* Вентиль угловой запорный — сборочная единица для голограммы: hands/valve-data.js.
   Запуск из корня репозитория: node hands/tools/build-valve.js

   Устройство (мм; z — ось шпинделя, вверх; вход среды — снизу, выход — вбок, вдоль +x):
     поз. 1  корпус: бочка, нижний (входной) и боковой (выходной) фланцы, верхний фланец под крышку;
             внутри — входной канал, конус и седло, камера клапана, выходной канал;
     поз. 2  крышка: фланец и горловина с резьбой под шпиндель и камерой сальника;
     поз. 3  прокладка;  поз. 4 шпиндель с трапецеидальной резьбой (своя сетка — в IG3 резьбы нет);
     поз. 5  клапан (тарелка);  поз. 6 набивка сальника;  поз. 7 нажимная втулка;  поз. 8 накидная гайка;
     поз. 9  маховик со спицами;  поз. 10 гайка маховика;  поз. 11 шпильки (4);  поз. 12 гайки шпилек (4).
   Для каждой детали: сетка, рёбра, поверхности вращения (для очерка), правило штриховки в разрезе по ГОСТ 2.306
   (у смежных деталей — разный наклон/шаг; тонкая прокладка — сплошь; неметалл — сеткой) и признак «не рассекать»
   (ГОСТ 2.305: валы, шпиндели, шпильки, гайки в продольном разрезе показывают нерассечёнными), шаги разборки
   и роль в механизме (что поднимается/вращается, когда открывают вентиль). */
const fs = require('fs'), path = require('path');
const { loadIG3, simplify, Q, i16, i8, flat } = require('./common.js');
const { IG3 } = loadIG3(), P = IG3.P;
const { cyl, cone, box, ngon, hcyl, U, S, I } = P;
const holes = (n, d, D, z0, z1, a0) => P.holes(n, d, D, z0, z1, a0);
const at4 = (R, a0 = 45) => [0, 1, 2, 3].map(k => { const a = (a0 + 90 * k) * Math.PI / 180; return [R * Math.cos(a), R * Math.sin(a)]; });

/* ── трапецеидальная резьба: виток трапеции вокруг оси z, своя сетка и рёбра (вершины гребня и впадины) ── */
function thread({ r0, r1, z0, z1, pitch, seg = 64 }) {
  const w0 = pitch * 0.36, w1 = pitch * 0.14, prof = [[r0, -w0], [r1, -w1], [r1, w1], [r0, w0]];
  const turns = (z1 - z0 - 2 * w0) / pitch, N = Math.ceil(turns * seg), pos = [], nrm = [], lines = [];
  const pt = (k, i) => { const a = i / seg * 2 * Math.PI, zc = z0 + w0 + pitch * i / seg, [r, dz] = prof[k]; return [r * Math.cos(a), r * Math.sin(a), zc + dz]; };
  const tri = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    pos.push(...a, ...b, ...c); nrm.push(...n, ...n, ...n); };
  for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) { const a = pt(k, i), b = pt(k + 1, i), c = pt(k + 1, i + 1), d = pt(k, i + 1); tri(a, c, b); tri(a, d, c); }
  for (const i of [0, N]) { const q = [0, 1, 2, 3].map(k => pt(k, i)); if (i === 0) { tri(q[0], q[1], q[2]); tri(q[0], q[2], q[3]); } else { tri(q[0], q[2], q[1]); tri(q[0], q[3], q[2]); } }
  for (let k = 0; k < 4; k++) for (let i = 0; i < N; i++) lines.push(pt(k, i), pt(k, i + 1));     /* винтовые линии гребня и впадины */
  return { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), lines };
}

/* ── детали ── */
const Rst = 38;                                                   /* окружность шпилек */
const body = S(U(cyl(30, -58, 46), cyl(48, -70, -58), hcyl('x', 26, [0, 16], 0, 78), hcyl('x', 48, [0, 16], 78, 90), cyl(46, 38, 48)),
  cyl(16, -71, -16), cone(16, 12, -16.01, -10), cyl(12, -10.01, -3.99), cyl(24, -4, 49), hcyl('x', 15, [0, 16], 10, 91),
  ...holes(4, 10, 80, -71, -57, 45), ...holes(4, 10.4, 2 * Rst, 30, 49, 45), hcyl('x', 5, [0, 54], 77, 91), hcyl('x', 5, [0, -22], 77, 91));
const bonnet = S(U(cyl(46, 50, 60), cyl(20, 60, 98)), cyl(9.6, 49, 99), cyl(15, 82, 99), ...holes(4, 11, 2 * Rst, 49, 61, 45));
const gasket = S(cyl(46, 48, 50), cyl(24.5, 47, 51), ...holes(4, 11, 2 * Rst, 47, 51, 45));
const spindle = U(cyl(8, -3, 112), box(12, 12, 112, 124), cyl(5, 124, 136));
const plug = S(U(cone(10, 11.8, -8, -4), cyl(17, -4, 4)), cyl(8.1, -3.5, 4.1));
const packing = S(cyl(15, 82, 92), cyl(8.2, 81, 93));
const gland = S(U(cyl(14.8, 92, 101), cyl(19, 99, 103)), cyl(8.4, 91, 104));
const gnut = S(ngon(6, 50, 90, 107), cyl(20.2, 89, 103), cyl(8.6, 102, 108));
const spokes = [0, 120, 240].map(d => { const a = d * Math.PI / 180; return box(42, 8, 115, 121, { x: 33 * Math.cos(a), y: 33 * Math.sin(a), a: d }); });
const wheel = S(U(cyl(13, 111, 125), S(cyl(62, 114, 122), cyl(53, 113, 123)), ...spokes), box(12.2, 12.2, 110, 126));
const hnut = S(ngon(6, 17, 125, 133), cyl(5.1, 124, 134));
const studs = U(...holes(4, 10, 2 * Rst, 32, 72, 45));
const snuts = U(...at4(Rst).map(([x, y]) => S(ngon(6, 17, 60, 68, { x, y }), cyl(5.1, 59, 69, { x, y }))));

/* поверхности вращения для очерка: ['z', cx, cy, r0, r1, z0, z1] — вдоль оси z; ['x', cy, cz, r, x0, x1] — вдоль x */
const zc = (r0, r1, z0, z1, x = 0, y = 0) => ['z', x, y, r0, r1, z0, z1];
const PARTS = [
  { id: 'body', pos: 1, name: 'Корпус', mat: 'СЧ 20', tree: body, hatch: { a: 45, step: 3.2 },
    surf: [zc(30, 30, -58, 38), zc(48, 48, -70, -58), zc(46, 46, 38, 48), ['x', 0, 16, 26, 30, 78], ['x', 0, 16, 48, 78, 90]], ex: [] },
  { id: 'bonnet', pos: 2, name: 'Крышка', mat: 'СЧ 20', tree: bonnet, hatch: { a: -45, step: 3.2 }, surf: [zc(46, 46, 50, 60), zc(20, 20, 60, 98)],
    ex: [{ s: 6, d: [0, 0, 55] }] },
  { id: 'gasket', pos: 3, name: 'Прокладка', mat: 'паронит', tree: gasket, hatch: { solid: true }, surf: [zc(46, 46, 48, 50)], ex: [{ s: 8, d: [0, 0, 22] }] },
  { id: 'spindle', pos: 4, name: 'Шпиндель', mat: 'сталь 20Х13, резьба Tr 19×4', tree: spindle, nocut: true, kin: 'rot',
    thread: { r0: 8, r1: 9.5, z0: 62, z1: 82, pitch: 4 }, surf: [zc(8, 8, -3, 112), zc(5, 5, 124, 136)], ex: [{ s: 6, d: [0, 0, 55] }, { s: 7, d: [-125, 0, 0] }] },
  { id: 'plug', pos: 5, name: 'Клапан', mat: 'латунь ЛС59-1', tree: plug, hatch: { a: 45, step: 1.8 }, kin: 'lift', surf: [zc(17, 17, -4, 4)],
    ex: [{ s: 6, d: [0, 0, 55] }, { s: 7, d: [-125, 0, 0] }, { s: 8, d: [0, 0, -30] }] },
  { id: 'packing', pos: 6, name: 'Набивка сальника', mat: 'графитовый шнур', tree: packing, hatch: { a: 45, step: 2, net: true }, surf: [zc(15, 15, 82, 92)], ex: [{ s: 4, d: [0, 0, 78] }] },
  { id: 'gland', pos: 7, name: 'Нажимная втулка', mat: 'Ст3', tree: gland, hatch: { a: 45, step: 2.2 }, surf: [zc(14.8, 14.8, 92, 99), zc(19, 19, 99, 103)], ex: [{ s: 3, d: [0, 0, 98] }] },
  { id: 'gnut', pos: 8, name: 'Накидная гайка', mat: 'Ст3', tree: gnut, hatch: { a: -45, step: 2.2 }, surf: [], ex: [{ s: 2, d: [0, 0, 122] }] },
  { id: 'wheel', pos: 9, name: 'Маховик', mat: 'СЧ 15', tree: wheel, hatch: { a: 45, step: 3.2 }, kin: 'rot', surf: [zc(13, 13, 111, 125), zc(62, 62, 114, 122), zc(53, 53, 114, 122)], ex: [{ s: 1, d: [0, 0, 165] }] },
  { id: 'hnut', pos: 10, name: 'Гайка М10', mat: 'Ст3', tree: hnut, nocut: true, kin: 'rot', surf: [], ex: [{ s: 0, d: [0, 0, 200] }] },
  { id: 'studs', pos: 11, name: 'Шпилька М10 (4 шт.)', mat: 'сталь 35', tree: studs, nocut: true, surf: at4(Rst).map(([x, y]) => zc(5, 5, 32, 72, x, y)), ex: [{ s: 9, d: [0, 0, 40] }] },
  { id: 'snuts', pos: 12, name: 'Гайка М10 (4 шт.)', mat: 'Ст3', tree: snuts, nocut: true, surf: [], ex: [{ s: 5, d: [0, 0, 62] }] }
];

/* склейка массивов без spread (большие массивы переполняют стек) */
const cat = (...a) => { const o = new Float32Array(a.reduce((n, x) => n + x.length, 0)); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };

/* ── сборка данных ── */
const box3 = [[-62, -62, -70], [90, 62, 136]];
const t0 = Date.now(), out = { name: 'Вентиль угловой запорный', q: Q, box: box3, pitch: 4, lift: 14, parts: [] };
let wholePos = [], wholeNrm = [], wholeLines = [];
for (const p of PARTS) {
  const me = IG3.CSG.mesh(p.tree);
  let L = simplify(IG3.featLines({ tree: p.tree, box: box3 }));
  let pos = me.pos, nrm = me.nrm;
  if (p.thread) {                                                  /* резьба — своя сетка поверх стержня */
    const th = thread(p.thread);
    pos = cat(me.pos, th.pos); nrm = cat(me.nrm, th.nrm);
    L = L.concat(th.lines);
  }
  const fl = flat(L);
  const bb = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]]; for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { bb[0][k] = Math.min(bb[0][k], pos[i + k]); bb[1][k] = Math.max(bb[1][k], pos[i + k]); }
  out.parts.push({ id: p.id, pos: p.pos, name: p.name, mat: p.mat, hatch: p.hatch || null, nocut: !!p.nocut, kin: p.kin || null, ex: p.ex, surf: p.surf,
    anchor: [+bb[1][0].toFixed(1), 0, +((bb[0][2] + bb[1][2]) / 2).toFixed(1)],
    mesh: i16(pos), nrm: i8(nrm), count: pos.length / 3, lines: i16(fl) });
  wholePos.push(pos); wholeNrm.push(nrm); wholeLines.push(fl);
  console.log(`поз. ${String(p.pos).padStart(2)} ${p.name.padEnd(22)} треугольников ${pos.length / 9}, отрезков ${L.length / 2}`);
}
/* «всё целиком» (для эпюра) не храним — склеивается из деталей в браузере */
const js = '/* АВТОГЕНЕРАЦИЯ: node hands/tools/build-valve.js — не править руками. Вентиль угловой запорный: детали сборки,\n'
  + '   их сетки (int16 = мм × q, нормали int8 × 127, base64), рёбра, штриховка, разборка, механизм. */\n'
  + 'export default ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '../valve-data.js'), js);
console.log('hands/valve-data.js:', (js.length / 1024).toFixed(0), 'КБ за', ((Date.now() - t0) / 1000).toFixed(1), 'с');
