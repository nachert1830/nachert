#!/usr/bin/env node
/* Разбор записи с камеры (кнопка «● Запись» на странице) — для подбора порогов по реальным рукам.
   node hands/tools/replay-report.js запись.json [--cfg '{"pinchOn":0.28}']
   Печатает:
     • распределения признаков по кадрам: отношение щипка, сгиб пальцев (max/min), большой палец, размер ладони, доля кадров у края;
       для щипка — «долину» между пиками (там и должен лежать порог) и где сейчас pinchOn/pinchOff;
     • ленту: смена жестов и события (через тот же контроллер, что на странице);
     • дребезг: щипок включился и выключился быстрее 250 мс, смены жеста быстрее 200 мс, пропуски детекции. */
import fs from 'node:fs';
import { createController, features, CFG } from '../gestures.js';

const file = process.argv[2];
if (!file) { console.error('укажи файл записи: node hands/tools/replay-report.js hands-….json'); process.exit(1); }
const ci = process.argv.indexOf('--cfg'), over = ci > 0 ? JSON.parse(process.argv[ci + 1]) : {};
const rec = JSON.parse(fs.readFileSync(file, 'utf8')), F = rec.frames || [];
const cfg = Object.assign({}, CFG, over);
const toHands = f => f.hands.map(h => ({ handed: h.handed, score: h.score, lm: h.lm.map(([x, y, z]) => ({ x, y, z })) }));
console.log(`запись: ${F.length} кадров, ${((F.at(-1)?.t || 0) / 1000).toFixed(1)} с, видео ${rec.video?.join('×')}, делегат ${rec.delegate}`);
if (Object.keys(over).length) console.log('пороги изменены:', JSON.stringify(over));

/* ── признаки ── */
const S = { pinch: [], cmax: [], cmin: [], thumb: [], palm: [] }; let edge = 0, far = 0, nh = 0;
F.forEach(f => f.hands.forEach(h => { const ft = features(h.lm.map(([x, y, z]) => ({ x, y, z })), cfg); nh++;
  if (ft.cmax >= cfg.fistOn) S.pinch.push(ft.pinch);   /* кулак не в счёт: в нём большой палец лежит на указательном */
   S.cmax.push(ft.cmax); S.cmin.push(ft.cmin); S.thumb.push(ft.thumb); S.palm.push(ft.palm); if (ft.edge) edge++; if (ft.far) far++; }));
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const hist = (a, lo, hi, n = 24, marks = {}) => {
  const b = new Array(n).fill(0); a.forEach(v => { const i = Math.floor((v - lo) / (hi - lo) * n); if (i >= 0 && i < n) b[i]++; });
  const mx = Math.max(1, ...b); return b.map((c, i) => { const x = lo + (hi - lo) * (i + 0.5) / n, m = Object.entries(marks).filter(([, v]) => Math.min(n - 1, Math.floor((v - lo) / (hi - lo) * n)) === i).map(([k]) => k).join(',');
    return `  ${x.toFixed(2).padStart(5)} ${'█'.repeat(Math.round(c / mx * 40)).padEnd(40)} ${String(c).padStart(4)} ${m ? '← ' + m : ''}`; }).join('\n'); };
console.log(`\nруки: ${nh} наблюдений, у края кадра ${(edge / Math.max(1, nh) * 100).toFixed(1)} %, слишком далеко ${(far / Math.max(1, nh) * 100).toFixed(1)} %`);
console.log(`размер ладони: медиана ${q(S.palm, 0.5).toFixed(3)} (порог «далеко» ${cfg.minPalm})`);
console.log('\nотношение щипка |4−8| / ладонь (без кадров с кулаком):'); console.log(hist(S.pinch, 0, 1.4, 28, { pinchOn: cfg.pinchOn, pinchOff: cfg.pinchOff }));
/* долина: минимум гистограммы между пиком «сомкнуто» (< 0,35) и пиком «разомкнуто» */
{ const n = 56, b = new Array(n).fill(0); S.pinch.forEach(v => { const i = Math.floor(v / 1.4 * n); if (i >= 0 && i < n) b[i]++; });
  let lo = 0; for (let i = 1; i < n * 0.25; i++) if (b[i] > b[lo]) lo = i;
  let hi = Math.floor(n * 0.3); for (let i = hi; i < n; i++) if (b[i] > b[hi]) hi = i;
  /* самый длинный участок минимальной высоты между пиками — его середина */
  let m = Infinity; for (let i = lo; i <= hi; i++) m = Math.min(m, b[i]);
  let best = [lo, lo], run = null; for (let i = lo; i <= hi + 1; i++) { if (i <= hi && b[i] <= m) { run = run || [i, i]; run[1] = i; } else if (run) { if (run[1] - run[0] > best[1] - best[0]) best = run; run = null; } }
  const val = ((best[0] + best[1]) / 2 + 0.5) * 1.4 / n; console.log(`  долина между «сомкнуто» и «разомкнуто» ≈ ${val.toFixed(2)} — порог включения ставь чуть ниже, выключения — чуть выше`); }
console.log('\nсгиб пальцев, max по 4 пальцам (кулак — ниже fistOn):'); console.log(hist(S.cmax, 0.5, 2.3, 24, { fistOn: cfg.fistOn, fistOff: cfg.fistOff }));
console.log('\nсгиб пальцев, min по 4 пальцам (ладонь — выше openOn):'); console.log(hist(S.cmin, 0.5, 2.3, 24, { openOn: cfg.openOn, openOff: cfg.openOff }));

/* ── лента через контроллер ── */
const ctl = createController({ cfg: over }); let mode = 'idle', modeT = 0, gaps = 0, prevT = 0;
const on = new Map(), chatter = [], flips = [];
console.log('\nлента:');
F.forEach(f => { if (prevT && f.t - prevT > 120) gaps++; prevT = f.t;
  const fr = ctl.update(toHands(f), f.t);
  fr.events.forEach(e => {
    if (e.type === 'pinch-on') on.set(e.id, e.t);
    if (e.type === 'pinch-off' && on.has(e.id) && e.t - on.get(e.id) < 250) chatter.push(e.t);
    if (e.type === 'mode') { if (e.t - modeT < 200 && mode !== 'idle') flips.push(`${(e.t / 1000).toFixed(2)} с: ${e.from}→${e.mode}`); mode = e.mode; modeT = e.t;
      console.log(`  ${(e.t / 1000).toFixed(2).padStart(7)} с  ${e.from.padEnd(8)} → ${e.mode}`); }
    if (['fling', 'reset'].includes(e.type)) console.log(`  ${(e.t / 1000).toFixed(2).padStart(7)} с  · ${e.type}`);
  }); });
console.log(`\nдребезг: коротких щипков (< 250 мс) — ${chatter.length}, быстрых смен жеста (< 200 мс) — ${flips.length}, пропусков детекции > 120 мс — ${gaps}`);
flips.slice(0, 10).forEach(s => console.log('  ' + s));
console.log(`итог вида: yaw ${ctl.view.yaw.toFixed(2)}, pit ${ctl.view.pit.toFixed(2)}, zoom ${ctl.view.zoom.toFixed(2)}, разбор ${(ctl.view.explode * 100).toFixed(0)} %`);
