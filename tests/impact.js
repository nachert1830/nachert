#!/usr/bin/env node
/* Карта влияния: какие блоки проверки задеты правкой (как test impact analysis в больших компаниях).
   node tests/impact.js [база]   — база по умолчанию origin/main; сравнивается рабочее дерево (коммиты + несохранённое)
                                   с точкой ответвления от базы (merge-base), переименования — как «удалён + добавлен».
   Печатает JSON: {all, groups:[…], server, docsOnly, why:[…]}; с --only — строку для tests/run.js --only=… («all», «none» или блоки).
   Правила (таблица RULES ниже, первое совпадение):
   • «none» — ТОЛЬКО если изменены одни документы (*.md, docs/**). Любой другой файл ведёт хотя бы к одному блоку.
   • файл, которого нет в таблице, — полная проверка. Не уверен — проверяй всё.
   • каждый файл, который читают проверки или загружает сайт, привязан к блокам, которые его читают:
     это проверяет tests/impact.test.js — по всем файлам репозитория и по зависимостям каждого блока run.js.
   В index.html правка относится к модулю, в котором лежит строка: последний заголовок «═══» или объявление window.ИМЯ / const ИМЯ выше неё. */
'use strict';
const {execSync} = require('child_process'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DEPS = require('./deps.js');
/* тесты сервера (server/npm test, tests/hq-agent.test.js) и всё, что они читают */
let _srv = null;
const serverReads = f => { if (!_srv) { const roots = [];
    const walk = d => { for (const x of fs.readdirSync(path.join(ROOT, d), {withFileTypes: true})) { const r = d + '/' + x.name; if (x.isDirectory()) walk(r); else if (/\.test\.js$/.test(x.name)) roots.push(r); } };
    ['server/test', 'lk/tests'].forEach(d => { if (fs.existsSync(path.join(ROOT, d))) walk(d); }); roots.push('tests/hq-agent.test.js');
    _srv = DEPS.closure(roots); }
  return _srv.has(f); };

/* Блоки index.html: smoke — только открыть главную без ошибок JS (выполняется в любой выборочной проверке). */
const CRAWL = 'crawl';
/* файлы проверок → свой блок (tests/impact.test.js сверяет с зависимостями блоков в run.js) */
const TESTS = {geometry: ['core', 'dzvar'], render: ['core'], mutate: ['core'], oracle: ['core'], euclid: ['core', 'dzvar', 'adequacy', 'variants'], arith: ['core', 'dzvar', 'adequacy', 'variants'],
  dz: ['core', 'dzvar', 'variants'], 'dz-run': ['dzvar', 'variants'], 'variants-run': ['variants'], provenance: ['prov', 'adequacy'], 'provenance-run': ['prov'], adequacy: ['adequacy'],
  random: ['random', 'gym', 'adequacy'], 'random-run': ['random', 'adequacy'], 'gen-check': ['gym'], gym: ['gym'], rk2: ['rk2'], rkp: ['rkp'], live: ['live'], rkg: ['rkg'],
  'ig4-steps': ['ig4'], normo: ['normo'], 'normo-model': ['normo'], 'normo-run': ['normo'], 'normo-mutate': ['normo'], 'lk-drawings': ['lk'], 'me-hub': ['me'], print: ['print'],
  colors: ['colors'], ask: ['ask'], theory: ['theory'], 'false-positives': ['core']};
/* модули index.html → блоки (неизвестный модуль — всё) */
const MODS = [[/^RKP\b/, ['rkp']], [/^RK2\b|^RKG\b/, ['rk2', 'rkg']], [/^LIVE/, ['live']], [/^IGL\b/, ['points']], [/^IGS\b/, ['igs', 'normo']],
  [/^(IGNK|IGREAD)\b/, ['normo']], [/^HWCHECK\b/, ['ng3', 'dzvar']], [/^(GEN|GYM)\b/, ['gym']], [/^(TRACK|VIEWS_PROBE)\b/, ['track']],
  [/^(IG3|IG_VARS|IG_WB)\b/, ['normo', 'igs', 'points', 'rkg']], [/^(DZR|NGLIB|SHEET|NGHW)\b/, ['dzvar', 'variants', 'normo', 'print']],
  [/^(TASK3D|DAY3D|SPACE|SURF3|SURFLAB|LABS)\b/, ['gym', 'crawl']], [/^(LEARN|TOPICS|SYMPTOMS|GLOSS)\b/, ['theory', 'crawl']]];

/* Таблица правил: [шаблон пути, что запускать, почему]. Что запускать: 'DOC' — документ (ничего), 'ALL' — всё,
   {g:[блоки], server:true} — блоки tests/run.js и/или тесты сервера (server/npm test + tests/hq-agent.test.js).
   Порядок важен: первое совпадение. Последнее правило — «всё». */
const NG_DZ = ['core', 'dzvar', 'variants', 'print', 'ng3', 'live', CRAWL];
const IG_DZ = ['normo', 'igs', 'points', 'rkg', 'ig4', 'print', CRAWL];
const KERNEL = ['core', 'dzvar', 'variants', 'cert', 'normo', 'ig4', 'live', 'print', 'igs', 'ng3', CRAWL];
const RULES = [
  [/\.md$/i, 'DOC', 'документ'],
  [/^docs\//, 'DOC', 'документ'],
  /* сама проверка */
  [/^tests\/(run\.js|impact\.js|impact\.test\.js|baseline\.json|shards\.js)$/, 'ALL', 'сама проверка'],
  [/^\.github\/workflows\/(check|nightly)\.yml$/, 'ALL', 'сама проверка'],
  [/^node_modules\//, 'ALL', 'пакеты, которыми пользуются проверки (acorn)'],
  [/^tests\/timings\.json$/, {g: ['smoke']}, 'замеры времени — только раскладка потоков'],
  [/^tests\/hq-agent\.test\.js$/, {server: true}, 'тест исполнителя Цеха'],
  [/^tests\/variants-baseline\.json$/, {g: ['variants']}, 'разобранные совпадения вариантов'],
  [/^tests\/certified\//, {g: ['cert', 'adequacy']}, 'сертификаты (их читает и adequacy)'],
  [/^tests\/flaky\.js$/, {g: ['smoke']}, 'ночной прогон (нестабильные тесты)'],
  [/^tests\/[\w-]+\.js$/, f => { const m = /^tests\/([\w-]+)\.js$/.exec(f), g = new Set([...(TESTS[m[1]] || []), ...DEPS.groupsReading(f)]);
    return {g: g.size ? [...g] : ['smoke']}; }, 'файл проверки (блоки, которые его подключают)'],
  /* сайт */
  [/^index\.html$/, 'INDEX', 'модуль index.html'],
  [/^dz\/ng\//, {g: NG_DZ}, 'ДЗ по начерту: решатели, данные, методики (загружает index.html)'],
  [/^dz\/ig\//, {g: IG_DZ}, 'ДЗ по ИГ: модели, листы, шаги (загружает index.html)'],
  [/^dz\//, {g: [...NG_DZ, ...IG_DZ]}, 'общее для ДЗ'],
  [/^kernel\//, {g: KERNEL}, 'ядро ДЗ (реестр DZR, листы SHEET; загружает index.html)'],
  [/^core\//, {g: ['core', 'dzvar', 'variants', 'cert', 'adequacy', 'lk']}, 'ядро: сертификаты, расшифровка ДЗ, модель'],
  [/^lk\/hq\//, {server: true}, 'Штаб — тесты сервера'],
  [/^lk\/tests\//, {server: true}, 'тесты библиотек кабинета (в server/npm test)'],
  [/^lk\/lib\//, {g: ['ask', 'lk', 'live', CRAWL], server: true}, 'библиотеки кабинета (календарь загружает index.html; тесты — lk/tests)'],
  [/^lk\/(site|ask|config)\.js$/, {g: ['ask', 'lk', 'me', 'live', CRAWL], server: true}, 'подключён к сайту'],
  [/^lk\/data\//, {g: ['ask', 'lk', 'me', CRAWL], server: true}, 'данные кабинета (группы загружает index.html)'],
  [/^lk\/(scan|drawings)\//, {g: ['lk', 'me'], server: true}, 'сканер и «Мои чертежи»'],
  [/^lk\//, {g: ['lk', 'me', 'ask'], server: true}, 'кабинет'],
  [/^(me|hands)\//, {g: ['me', 'ask']}, 'пульт владельца'],
  [/^tools\/hq-/, {server: true}, 'Цех — тесты исполнителя'],
  [/^server\/lib\/hq\/|^server\/test\/hq/, {server: true}, 'Штаб — тесты сервера'],
  [/^server\//, {g: ['ask', 'lk'], server: true}, 'сервер (его использует «Спроси автора»)'],
  [/^lab\/dz\//, {g: ['lk'], server: true}, 'лаборатория ДЗ: восстановление по проекциям (читают lk-drawings и тесты сервера)'],
  [/^lab\//, {g: ['smoke']}, 'страницы лаборатории: не загружаются сайтом и проверками'],
  [/^\.github\//, {g: ['smoke']}, 'другие задания GitHub (не проверка сайта)'],
  [/^(ceo\/|ceo-deploy\.yml$|index\.js$|eyes-eval\.json$|robots\.txt$|CNAME$|\.gitignore$|\.nojekyll$)/, {g: ['smoke']}, 'вне сайта: функция ceo, настройки хостинга'],
  [/^views\.json$/, {g: ['track', CRAWL]}, 'загружает index.html'],
  [/^(sw\.js|404\.html|manifest\.webmanifest|fonts\/|img\/|og\/|app\/|(ig|ng)\d?\/|club\/|epure\/|joke\/|rk\/|[\w-]+\.(png|jpg))/, {g: [CRAWL]}, 'страницы и файлы сайта'],
  [/./, 'ALL', 'нет в карте влияния'],
];

const ruleOf = f => { for (const r of RULES) if (r[0].test(f)) { const v = typeof r[1] === 'function' ? r[1](f) : r[1]; if (v) return {to: v, why: r[2], re: r[0]}; } return null; };

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

/* impact(files, {indexLines}) — чистая функция: список путей → {all, groups, server, docsOnly, why}.
   indexLines — номера изменённых строк index.html (если index.html в списке); не дано — index.html целиком → всё. */
function impact(files, opts) {
  opts = opts || {};
  const out = {all: false, groups: new Set(), server: false, why: []};
  const add = (why, g, server) => { (g || []).forEach(x => out.groups.add(x)); if (server) out.server = true;
    out.why.push(why + ' → ' + ([...(g || []), ...(server ? ['тесты сервера'] : [])].join(', ') || '—')); };
  const ALL = why => { out.all = true; out.server = true; out.why.push(why + ' → всё'); };
  let docs = 0;
  for (const f of files) {
    const r = ruleOf(f);
    if (r.to === 'DOC') { docs++; out.why.push(f + ' (документ) → —'); continue; }
    if (r.to === 'ALL') { ALL(f + ' (' + r.why + ')'); continue; }
    if (r.to === 'INDEX') {
      const lines = opts.indexLines;
      if (!lines || !lines.length) { ALL('index.html (строки не известны)'); continue; }
      const mods = indexModules(lines);
      if (mods.includes('СТИЛИ')) add('index.html: стили', ['core', 'crawl', 'print']);
      for (const m of mods.filter(x => x !== 'СТИЛИ')) { const x = MODS.find(([re]) => re.test(m)); if (x) add('index.html: ' + m, [...x[1], 'theory', 'crawl']); else ALL('index.html: общий код (' + m + ')'); }
      continue;
    }
    /* правило — нижняя граница; к нему добавляются блоки, которые читают файл по коду проверок (tests/deps.js) */
    const auto = DEPS.groupsReading(f).filter(g => !(r.to.g || []).includes(g)), srv = !r.to.server && serverReads(f);
    add(f + ' (' + r.why + ')', r.to.g, r.to.server);
    if (auto.length || srv) add(f + ' (читают проверки)', auto, srv);
  }
  if (!files.length) out.why.push('изменений нет');
  const docsOnly = files.length > 0 && docs === files.length;
  /* страховка: не-документ не может дать «ничего» */
  if (!out.all && !out.groups.size && !out.server && files.length && !docsOnly) out.groups.add('smoke');
  return {all: out.all, groups: out.all ? [] : [...out.groups].sort(), server: out.server, docsOnly, why: out.why};
}

function changedFiles(base) {
  const sh = c => execSync(c, {cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore']});
  let mb = base; try { mb = sh('git merge-base ' + base + ' HEAD').trim() || base; } catch (e) {}
  const files = sh('git diff --no-renames --name-only -z ' + mb).split('\0').filter(Boolean)
    .concat(sh('git ls-files --others --exclude-standard -z').split('\0').filter(Boolean));
  let indexLines = [];
  if (files.includes('index.html')) { const d = sh('git diff --no-renames -U0 ' + mb + ' -- index.html');
    for (const m of d.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) { const a = +m[1], n = m[2] == null ? 1 : +m[2]; for (let i = 0; i < Math.max(1, n); i++) indexLines.push(a + i); } }
  return {files: [...new Set(files)], indexLines};
}

module.exports = {impact, ruleOf, RULES, TESTS, MODS, indexModules, changedFiles};

if (require.main === module) {
  const base = process.argv.slice(2).find(a => !a.startsWith('--')) || 'origin/main';
  let res;
  try { const c = changedFiles(base); res = impact(c.files, {indexLines: c.indexLines}); }
  catch (e) { res = {all: true, groups: [], server: true, docsOnly: false, why: ['нет базы ' + base + ' для сравнения → всё']}; }
  if (process.argv.includes('--only')) console.log(res.all ? 'all' : res.groups.length ? res.groups.join(',') : 'none');
  else if (process.argv.includes('--server')) console.log(res.server ? '1' : '0');
  else console.log(JSON.stringify(res, null, 1));
}
