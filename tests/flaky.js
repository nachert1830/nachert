#!/usr/bin/env node
/* Нестабильные тесты: один и тот же код проверен несколько раз (ночная проверка, .github/workflows/nightly.yml).
   node tests/flaky.js папка1 папка2 папка3 --plan=plan.json
   В каждой папке — результаты потоков одного повтора (part-*.json от tests/run.js --out). Для каждого блока сравниваются вердикты:
   набор новых ошибок блока (без чисел времени). Разный вердикт при одинаковом коде — ошибка «нестабильный тест».
   Код выхода: 0 — все повторы совпали и зелёные; 1 — есть нестабильные блоки или красный вердикт. */
'use strict';
const fs = require('fs'), path = require('path');
const {GROUPS, finish} = require('./run.js');
const dirs = process.argv.slice(2).filter(a => !a.startsWith('--')), planF = (process.argv.find(a => a.startsWith('--plan=')) || '').slice(7);
const plan = JSON.parse(fs.readFileSync(planF, 'utf8')), items = plan.shards.flat(2).map(id => ({g: id.split(':')[0], k: id.split(':').slice(1).join(':') || '*'}));
/* вердикт блока: строки ошибок, относящиеся к его элементам и итогу; числа секунд вычеркнуты */
const verdicts = dirs.map(d => { const results = [];
  for (const f of fs.readdirSync(d).filter(f => /\.json$/.test(f))) results.push(...JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')).results);
  const out = {};
  for (const g of GROUPS) { const want = items.filter(x => x.g === g); if (!want.length) continue;
    const R = finish(results.filter(r => r.g === g), want); out[g] = R.fail.map(s => s.replace(/\d+ с\b/g, '_ с')).sort(); }
  return out; });
const flaky = [], red = [];
for (const g of Object.keys(verdicts[0] || {})) {
  const v = verdicts.map(x => JSON.stringify(x[g] || []));
  if (new Set(v).size > 1) flaky.push(g + ': ' + verdicts.map((x, i) => 'повтор ' + (i + 1) + ' — ' + ((x[g] || []).length ? (x[g] || []).length + ' ошибок (' + (x[g] || [])[0].slice(0, 160) + ')' : 'зелёный')).join('; '));
  else if ((verdicts[0][g] || []).length) red.push(g + ': ' + verdicts[0][g].slice(0, 5).join(' | ').slice(0, 600));
}
console.log('Повторов: ' + dirs.length + ', блоков: ' + Object.keys(verdicts[0] || {}).length + '; нестабильных: ' + flaky.length + ', красных (стабильно): ' + red.length);
flaky.forEach(x => console.log('НЕСТАБИЛЬНЫЙ ТЕСТ · ' + x));
red.forEach(x => console.log('КРАСНЫЙ · ' + x));
process.exit(flaky.length || red.length ? 1 : 0);
