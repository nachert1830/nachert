/* Зависимости проверок — выводятся из кода (для tests/impact.js и tests/impact.test.js).
   nodeDeps(файл)  — что читает node-файл: require, ROOT+'/…', строки-пути (от корня и от папки файла), имена проверок в списках f+'.js',
                     страницы ('lk/', 'me/') — их index.html.
   webDeps(файл)   — что загружает страница или браузерный модуль: src/href, import, new Worker, fetch.
   closure(корни)  — всё достижимое. index.html не раскрывается: это сайт целиком, его правка разбирается по модулям (impact.js).
   groupRoots()    — файлы проверок, которые подключает каждый блок tests/run.js (сегмент от on('блок') до следующего on('…')). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const exists = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function nodeDeps(file) {
  const src = fs.readFileSync(file, 'utf8'), dir = path.dirname(file), out = new Set(), pages = new Set();
  const tryAdd = (base, s) => { s = s.replace(/[?#].*$/, ''); if (!s || /^(https?:|node:|\/opt\/)/.test(s) || /^[.\/]+$/.test(s)) return false;
    for (const c of [s, s + '.js']) { const p = path.resolve(base, c.replace(/^\//, '')); if (p.startsWith(ROOT + path.sep) && exists(p) && !/node_modules/.test(p)) { out.add(rel(p)); return true; } }
    const d = path.resolve(base, s.replace(/^\//, '')); if (s.endsWith('/') && d.startsWith(ROOT + path.sep) && isDir(d) && exists(path.join(d, 'index.html'))) { pages.add(rel(path.join(d, 'index.html'))); return true; }
    return false; };
  for (const m of src.matchAll(/require\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) tryAdd(dir, m[1]);
  for (const m of src.matchAll(/require\(\s*ROOT\s*\+\s*['"`]([^'"`]+)['"`]/g)) tryAdd(ROOT, m[1]);
  for (const m of src.matchAll(/['"`]((?:\.\.?\/)*[\w@.-]+(?:\/[\w@.-]*)*)['"`]/g)) { const s = m[1]; if (!/[\/.]/.test(s)) continue; if (!tryAdd(ROOT, s)) tryAdd(dir, s); }
  if (/\+\s*['"]\.js['"]/.test(src)) for (const m of src.matchAll(/\[\s*((?:['"][\w-]+['"]\s*,?\s*)+)\]/g)) for (const w of m[1].match(/[\w-]+/g)) if (exists(path.join(dir, w + '.js'))) out.add(rel(path.join(dir, w + '.js')));
  /* require('./'+n+'.js') в tests/certified/run.js — модули задач из списка: все t*.js рядом */
  if (/require\(\s*['"]\.\/['"]\s*\+/.test(src)) for (const f of fs.readdirSync(dir)) if (/\.js$/.test(f)) out.add(rel(path.join(dir, f)));
  out.delete(rel(file));
  return {files: out, pages};
}

function webDeps(file) {
  const src = fs.readFileSync(file, 'utf8'), dir = path.dirname(file), out = new Set();
  const add = s => { s = s.replace(/[?#].*$/, ''); if (!s || /^(https?:|data:|\/\/|mailto:)/.test(s) || /['+$]/.test(s)) return; const p = path.resolve(dir, s); if (p.startsWith(ROOT) && exists(p)) out.add(rel(p)); };
  for (const m of src.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)) if (!/\.html?$|\/$/.test(m[1])) add(m[1]);
  for (const m of src.matchAll(/(?:from|import\(|new Worker\(|fetch\()\s*['"]([^'"]+)['"]/g)) add(m[1]);
  return out;
}

/* браузерные модули (ES-модули пульта и сканера) раскрываются через import; остальные .js — как node-файлы */
const isWeb = f => /\.html?$/.test(f) || /^(me|hands)\/.*\.m?js$/.test(f) || /^lk\/scan\/.*\.m?js$/.test(f);
function closure(roots) {
  const seen = new Set(), q = [...roots];
  while (q.length) { const f = q.shift(); if (seen.has(f)) continue; seen.add(f);
    if (f === 'index.html') continue;
    const p = path.join(ROOT, f); if (!exists(p)) continue;
    if (isWeb(f)) webDeps(p).forEach(x => q.push(x));
    if (/\.m?js$/.test(f)) { const d = nodeDeps(p); d.files.forEach(x => q.push(x)); d.pages.forEach(x => q.push(x)); } }
  return seen;
}

let _roots = null;
function groupRoots() {
  if (_roots) return _roots;
  const RUN = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8'), roots = {};
  /* сегмент блока: от конца предыдущего объявления B.x= до следующего — вместе со вспомогательными функциями перед блоком (corePage, dzPage…) */
  const marks = [...RUN.matchAll(/^B\.(\w+)=/gm)].map(m => ({g: m[1], at: m.index}));
  const tail = RUN.search(/\/\* ═══ план/);
  marks.forEach((m, i) => {
    const seg = RUN.slice(i ? RUN.indexOf('};\n', marks[i - 1].at) : m.at, i + 1 < marks.length ? marks[i + 1].at : (tail > 0 ? tail : RUN.length));
    const r = roots[m.g] = roots[m.g] || new Set();
    for (const x of seg.matchAll(/require\('\.\/([\w\/.-]+?)(?:\.js)?'\)/g)) r.add('tests/' + x[1] + '.js');
    for (const x of seg.matchAll(/\bT\('([\w-]+)'\)/g)) r.add('tests/' + x[1] + '.js');
    for (const x of seg.matchAll(/path\.join\(__dirname,\s*'([\w-]+)\.js'\)/g)) r.add('tests/' + x[1] + '.js');   /* проверка отдельным процессом (prep) */
    /* списки подключаемых проверок: ['geometry','euclid',…] и CORE_JS */
    for (const x of seg.matchAll(/\[\s*((?:'[\w-]+'\s*,?\s*)+)\]/g)) x[1].match(/[\w-]+/g).forEach(w => { if (exists(path.join(__dirname, w + '.js'))) r.add('tests/' + w + '.js'); });
    if (/CORE_JS/.test(seg)) { const cj = /const CORE_JS=\[([^\]]+)\]/.exec(RUN); if (cj) cj[1].match(/[\w-]+/g).forEach(w => r.add('tests/' + w + '.js')); }
    /* общие помощники run.js, которыми пользуется каждый блок */
    r.add('tests/ready.js');
  });
  return (_roots = roots);
}
/* блоки, которые читают файл (через подключённые проверки) */
let _rev = null;
function groupsReading(file) {
  if (!_rev) { _rev = {}; for (const [g, R] of Object.entries(groupRoots())) for (const f of closure([...R])) (_rev[f] = _rev[f] || new Set()).add(g); }
  return [...(_rev[file] || [])].sort();
}
module.exports = {nodeDeps, webDeps, closure, groupRoots, groupsReading, ROOT};
