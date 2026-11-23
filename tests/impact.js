#!/usr/bin/env node
/* Карта влияния: какие блоки проверки задеты правкой (как test impact analysis в больших компаниях).
   node tests/impact.js [база]   — база по умолчанию origin/main; сравнивается рабочее дерево (коммиты + несохранённое)
   Печатает JSON: {all, groups:[…], server, why:[…]}; с --only — строку для tests/run.js --only=… (или «all», или «none»).
   Правило: не уверен — проверяй всё. Общий код (оболочка, чертёж, плеер, стили, ядро) → полная проверка.
   В index.html правка относится к модулю, в котором лежит строка: последний заголовок «═══» или объявление window.ИМЯ / const ИМЯ выше неё. */
'use strict';
const {execSync} = require('child_process'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const base = process.argv.slice(2).find(a => !a.startsWith('--')) || 'origin/main';
const sh = c => execSync(c, {cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20});

const out = {all: false, groups: new Set(), server: false, why: []};
const add = (why, ...g) => { if (g.includes('normo')) g = g.concat('normom', 'normow');   /* нормоконтроль и его проверка — вместе */
  g.forEach(x => out.groups.add(x)); out.why.push(why + ' → ' + (g.join(', ') || '—')); };
const ALL = why => { out.all = true; out.why.push(why + ' → всё'); };

/* файлы проверок → свой блок */
const TESTS = {geometry: ['core', 'dzvar'], render: ['core'], mutate: ['core'], oracle: ['core'], euclid: ['core', 'dzvar'], arith: ['core', 'dzvar'], dz: ['core', 'dzvar'],
  'dz-run': ['dzvar'], 'variants-run': ['variants'], provenance: ['prov'], 'provenance-run': ['prov'], adequacy: ['adequacy'], random: ['random', 'gym'], 'random-run': ['random'],
  'gen-check': ['gym'], gym: ['gym'], rk2: ['rk2'], rkp: ['rkp'], live: ['live'], rkg: ['rkg'], 'ig4-steps': ['ig4'], normo: ['normo'], 'normo-model': ['normo'], 'normo-run': ['normo'],
  'normo-mutate': ['normom', 'normow'], 'lk-drawings': ['lk'], 'me-hub': ['me'], print: ['print'], colors: ['colors'], ask: ['ask'], tutor: ['tutor'], theory: ['theory']};
/* модули index.html → блоки (неизвестный модуль — всё) */
const MODS = [[/^RKP\b/, ['rkp']], [/^RK2\b|^RKG\b/, ['rk2', 'rkg']], [/^LIVE/, ['live']], [/^IGL\b/, ['points']], [/^IGS\b/, ['igs', 'normo']],
  [/^(IGNK|IGREAD)\b/, ['normo']], [/^HWCHECK\b/, ['ng3', 'dzvar']], [/^(GEN|GYM)\b/, ['gym']], [/^(TRACK|VIEWS_PROBE)\b/, ['track']],
  [/^(IG3|IG_VARS|IG_WB)\b/, ['normo', 'igs', 'points', 'rkg']], [/^(DZR|NGLIB|SHEET|NGHW)\b/, ['dzvar', 'variants', 'normo', 'print']],
  [/^(TASK3D|DAY3D|SPACE|SURF3|SURFLAB|LABS)\b/, ['gym', 'crawl']], [/^(LEARN|TOPICS|SYMPTOMS|GLOSS)\b/, ['theory', 'crawl']]];

function indexModules(changed) {
  const L = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n'), marks = [];
  let firstScript = L.findIndex(l => /<script\b/.test(l)); if (firstScript < 0) firstScript = L.length;
  L.forEach((l, i) => { const h = /\/\*\s*═{3,}\s*([^═*]{2,80}?)\s*(═|\*\/|$)/.exec(l), w = /^\s*window\.([A-Z][A-Z0-9_]{1,20})\s*=\s*(?:window\.\w+\s*\|\|\s*)?(?:\(\s*function|\(\s*\(\)\s*=>|\{|\[|function)/.exec(l) ||
      /^\s*(?:const|var) ([A-Z][A-Z0-9_]{2,20})\s*=\s*(?:\(\s*function\s*\(\s*\)|\{\s*tasks)/.exec(l);
    if (w) marks.push([i + 1, w[1]]); else if (h && i > firstScript) marks.push([i + 1, '«' + h[1].trim() + '»']); });
  const hit = new Set();
  for (const ln of changed) {
    if (ln <= firstScript + 1) { hit.add('СТИЛИ'); continue; }
    let m = null; for (const x of marks) { if (x[0] <= ln) m = x[1]; else break; } hit.add(m || '?');
  }
  return [...hit];
}

let files;
try { files = sh('git diff --name-only ' + base).split('\n').filter(Boolean).concat(sh('git ls-files --others --exclude-standard').split('\n').filter(Boolean)); }
catch (e) { ALL('нет базы ' + base + ' для сравнения'); files = []; }
files = [...new Set(files)].filter(f => !/^node_modules\//.test(f));
if (!files.length && !out.all) out.why.push('изменений нет');

for (const f of files) {
  const tm = /^tests\/([\w-]+)\.js$/.exec(f);
  if (f === 'index.html') {
    const d = sh('git diff -U0 ' + base + ' -- index.html'), lines = [];
    for (const m of d.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) { const a = +m[1], n = m[2] == null ? 1 : +m[2]; for (let i = 0; i < Math.max(1, n); i++) lines.push(a + i); }
    const mods = indexModules(lines);
    if (mods.includes('СТИЛИ')) add('index.html: стили', 'core', 'crawl', 'print');
    for (const m of mods.filter(x => x !== 'СТИЛИ')) { const r = MODS.find(([re]) => re.test(m)); if (r) add('index.html: ' + m, ...r[1], 'theory', 'crawl'); else ALL('index.html: общий код (' + m + ')'); }
  }
  else if (tm && TESTS[tm[1]]) add(f, ...TESTS[tm[1]]);
  else if (/^tests\/certified\//.test(f)) add(f, 'cert');
  else if (/^tests\/(run\.js|impact\.js|baseline\.json)$/.test(f) || f === '.github/workflows/check.yml') ALL(f + ' (сама проверка)');
  else if (/^(me|hands)\//.test(f)) add(f, 'me');
  else if (/^lk\/hq\//.test(f)) add(f + ' (Штаб — проверяют тесты сервера)');
  else if (/^lk\/(site|ask)\.js$/.test(f)) add(f + ' (подключён к сайту)', 'ask', 'lk', 'crawl');
  else if (f === 'lk/tutor.js' || f === 'lk/mascot.js') add(f + ' (наставник и его маскот)', 'tutor', 'newcopy', 'crawl');
  else if (/^tools\/tutor-/.test(f)) add(f + ' (наставник: пакет знаний и замер)', 'tutor');
  else if (/^server\/lib\/tutor\/|^server\/test\/tutor/.test(f)) { out.server = true; add(f + ' (наставник — тесты сервера)', 'tutor'); }
  else if (/^lk\/(scan|drawings)\//.test(f)) add(f, 'lk', 'me');
  else if (/^lk\//.test(f)) add(f, 'lk', 'me', 'ask');
  else if (/^tools\/hq-|^tests\/hq-agent\.test\.js$/.test(f)) { out.server = true; add(f + ' (Цех — тесты исполнителя в задании server)'); }
  else if (/^server\/lib\/hq\/|^server\/test\/hq/.test(f)) { out.server = true; add(f + ' (тесты сервера)'); }
  else if (/^server\//.test(f)) { out.server = true; add(f + ' (тесты сервера)', 'ask', 'lk'); }
  else if (/^dz\/ig\/4\//.test(f)) add(f, 'ig4', 'normo', 'tutor');   /* решение ДЗ 4 — знания наставника (ig4.json) */
  else if (/^dz\/ig\//.test(f)) add(f, 'normo', 'igs', 'print');
  else if (/^dz\//.test(f)) add(f, 'dzvar', 'variants', 'core');
  else if (/^(core|kernel)\//.test(f)) add(f, 'variants', 'cert', 'dzvar', 'core', 'normo');
  else if (/\.md$|^docs\/|^\.github\/(workflows|scripts)\/|^tools\/hq-|^ceo\/|^lab\/|^server\/tools\/|^(robots\.txt|CNAME|\.gitignore|views\.json|eyes-eval\.json|ceo-deploy\.yml|index\.js|\.nojekyll)$/.test(f)) add(f + ' (сайт не затронут)');
  else if (/^(sw\.js|404\.html|manifest\.webmanifest|fonts\/|img\/|og\/|app\/|(ig|ng)\d?\/|club\/|epure\/|joke\/|rk\/|[\w-]+\.(png|jpg))/.test(f)) add(f, 'crawl');
  else ALL(f + ' (нет в карте влияния)');
}

const groups = out.all ? [] : [...out.groups];
if (process.argv.includes('--only')) console.log(out.all ? 'all' : groups.length ? groups.join(',') : 'none');
else console.log(JSON.stringify({all: out.all, groups, server: out.server, why: out.why}, null, 1));
