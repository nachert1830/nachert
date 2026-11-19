#!/usr/bin/env node
/* Раскладка проверки по потокам CI по замеренному времени (tests/timings.json).
   node tests/shards.js [--only=a,b|all|none] [--shards=N|auto] [--jobs=K] [--target=сек] [--timings=файл] [--quick] [--out=plan.json]
   Единица работы — элемент блока (tests/run.js: блок задач, ДЗ, набор листов…; у мелких блоков — весь блок).
   Жадно (LPT): самый долгий элемент — в самый свободный «слот»; слотов N × K (K страниц браузера в потоке).
   Элементы одного блока в одном слоте идут подряд — страница сайта загружается один раз.
   --shards=auto — столько потоков, чтобы расчётное время потока было не больше --target (по умолчанию 240 с), не больше 8.
   Печатает план {shards:[[[элементы слота 1],[слота 2]…], …], est:[с на поток], total}; matrix — номера потоков для GitHub. */
'use strict';
const fs = require('fs'), path = require('path');
const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a == null ? null : a.slice(k.length + 3); };
const {GROUPS, elsOf} = require('./run.js');

/* время элемента: замер; нет замера — среднее по замеренным элементам блока, или DEFAULT */
const DEFAULT_MS = 20000;
function weights(groups, tm) {
  const out = [];
  for (const g of groups) {
    const els = elsOf(g), E = (tm.elements || {})[g] || {}, known = els.map(k => E[k]).filter(x => x > 0);
    const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : (tm.blocks && tm.blocks[g] ? tm.blocks[g] / els.length : DEFAULT_MS);
    els.forEach(k => out.push({id: k === '*' ? g : g + ':' + k, g, ms: E[k] > 0 ? E[k] : avg}));
  }
  return out;
}
function lpt(items, slots) {
  const S = Array.from({length: slots}, () => ({ms: 0, items: []}));
  for (const it of items.slice().sort((a, b) => b.ms - a.ms || (a.id < b.id ? -1 : 1))) { let m = S[0]; for (const s of S) if (s.ms < m.ms) m = s; m.items.push(it); m.ms += it.ms; }
  /* элементы одного блока — подряд (страница переиспользуется), долгие блоки — первыми */
  S.forEach(s => s.items.sort((a, b) => GROUPS.indexOf(a.g) - GROUPS.indexOf(b.g)));
  return S;
}
function plan(o) {
  const only = o.only == null || o.only === 'all' ? null : o.only === 'none' ? [] : o.only.split(',');
  const groups = GROUPS.filter(g => !only || only.includes(g)).filter(g => elsOf(g).length);
  const K = o.jobs || 3, items = weights(groups, o.timings || {}), total = items.reduce((a, b) => a + b.ms, 0);
  /* накладные расходы потока (браузер, страница) — в оценку */
  let N = o.shards;
  /* auto: добавляем поток, пока расчётное время выше цели и новый поток его сокращает (упор в один долгий элемент — не раздуваем) */
  if (!N || N === 'auto') { N = 1; let est = Math.max(0, ...lpt(items, K).map(s => s.ms));
    while (N < 8 && est > (o.target || 240) * 1000) { const e2 = Math.max(0, ...lpt(items, (N + 1) * K).map(s => s.ms)); if (e2 >= est * 0.97) break; N++; est = e2; } }
  N = Math.max(1, Math.min(+N, Math.max(1, Math.ceil(items.length / K))));
  const S = lpt(items, N * K), shards = [];
  for (let i = 0; i < N; i++) shards.push(S.slice(i * K, (i + 1) * K).map(s => s.items.map(x => x.id)).filter(x => x.length));
  const est = shards.map((_, i) => Math.round(Math.max(0, ...S.slice(i * K, (i + 1) * K).map(s => s.ms)) / 1000));
  return {groups, jobs: K, shards, est, total: Math.round(total / 1000), matrix: shards.map((_, i) => i)};
}
module.exports = {plan, lpt, weights};

if (require.main === module) {
  let tm = {}; try { tm = JSON.parse(fs.readFileSync(arg('timings') || path.join(__dirname, 'timings.json'), 'utf8')); } catch (e) {}
  const p = plan({only: arg('only'), shards: arg('shards') === 'auto' || !arg('shards') ? 'auto' : +arg('shards'), jobs: +(arg('jobs') || 3), target: +(arg('target') || 240), timings: tm});
  if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify(p, null, 1));
  console.log(JSON.stringify({shards: p.shards.length, est: p.est, total: p.total, matrix: p.matrix}));
}
