#!/usr/bin/env node
/* Проверка карты влияния tests/impact.js. node tests/impact.test.js — код выхода 0, если всё верно.
   1. Таблица «файл → ожидаемые блоки» (в том числе дыры, которые были: lab/dz, lk/hq, node_modules, переименование).
   2. Каждый файл репозитория попадает под правило таблицы или ведёт к полной проверке; «ничего» — только документы.
   3. Зависимости выводятся из кода, а не пишутся руками:
      • блоки tests/run.js: какие файлы проверок подключает каждый блок (require, addScriptTag) и всё, что они читают
        (require, readFileSync, пути-строки, страницы lk/, me/ и их скрипты) — каждый такой файл обязан вести к этому блоку;
      • тесты сервера (server/npm test, tests/hq-agent.test.js) и всё, что они читают, — к тестам сервера;
      • файлы, которые загружает index.html (script src, fetch), — к обходу страниц (crawl) и хотя бы одному блоку содержания.
   Документ, который читает сайт или проверка, — ошибка карты (его правка изменила бы поведение без проверки). */
'use strict';
const fs = require('fs'), path = require('path'), {execSync} = require('child_process');
const {impact, ruleOf, TESTS} = require('./impact.js');
const ROOT = path.join(__dirname, '..');
const bad = [];
const ok = (c, msg) => { if (!c) bad.push(msg); };

/* блоки run.js */
const RUN = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const GROUPS = JSON.parse(/const GROUPS=(\[[^\]]+\])/.exec(RUN)[1].replace(/'/g, '"'));
const covers = (res, need) => res.all || need.every(g => g === 'server' ? res.server : res.groups.includes(g));
const show = r => r.all ? 'всё' : (r.groups.join(',') || '—') + (r.server ? ' +сервер' : '');

/* ── 1. таблица ── */
const CASES = [
  [['README.md'], 'none'], [['docs/THESIS.md'], 'none'], [['docs/thesis.json'], 'none'], [['tests/README.md', 'dz/README.md'], 'none'],
  [['tests/run.js'], 'all'], [['tests/impact.js'], 'all'], [['tests/impact.test.js'], 'all'], [['tests/baseline.json'], 'all'],
  [['.github/workflows/check.yml'], 'all'], [['.github/workflows/nightly.yml'], 'all'], [['node_modules/acorn/dist/acorn.js'], 'all'],
  [['совсем-новый-файл.xyz'], 'all'], [['index.html'], 'all'],
  [['tests/geometry.js'], ['core', 'dzvar']], [['tests/certified/t46.js'], ['cert', 'adequacy']], [['tests/random.js'], ['random', 'gym', 'adequacy']],
  [['tests/hq-agent.test.js'], ['server']], [['tests/variants-baseline.json'], ['variants']], [['tests/timings.json'], ['smoke']],
  [['dz/ng/2/solver.js'], ['core', 'dzvar', 'variants', 'print', 'crawl']], [['dz/ng/lib.js'], ['dzvar', 'variants', 'crawl']],
  [['dz/ig/4/steps.js'], ['ig4', 'normo', 'crawl']], [['dz/ig/5/models.js'], ['normo', 'print', 'crawl']],
  [['kernel/dz.js'], ['variants', 'dzvar', 'normo', 'ig4', 'live', 'crawl']], [['kernel/sheet.js'], ['variants', 'normo', 'print']],
  [['core/dz-variants.js'], ['variants', 'lk']], [['core/certify.js'], ['cert', 'adequacy']],
  [['lab/dz/model.js'], ['lk', 'server']], [['lab/dz/layout.js'], ['server']], [['lab/scan-demo/index.html'], ['smoke']],
  [['lk/hq/app.js'], ['server']], [['lk/lib/calendar.js'], ['crawl', 'server', 'live']], [['lk/tests/lib.test.js'], ['server']],
  [['lk/site.js'], ['crawl', 'ask']], [['lk/config.js'], ['me', 'ask']], [['lk/scan/pipeline.js'], ['lk', 'server']],
  [['me/hub.js'], ['me']], [['hands/link.js'], ['me']], [['server/lib/app.js'], ['ask', 'server']], [['server/tools/deploy.js'], ['server']],
  [['tools/hq-run.js'], ['server']], [['.github/workflows/club.yml'], ['smoke']], [['sw.js'], ['crawl']], [['views.json'], ['crawl']],
  [['og/ng2-17.jpg'], ['crawl']], [['ig4/7/index.html'], ['crawl']],
  [['README.md', 'tests/geometry.js'], ['core']],
  [['kernel/prep.js'], ['prep', 'crawl']], [['prep/engine.js'], ['prep', 'crawl']], [['tests/prep.js'], ['prep']], [['docs/prep/README.md'], 'none'],
];
for (const [files, want] of CASES) {
  const r = impact(files);
  if (want === 'none') ok(r.docsOnly && !r.all && !r.groups.length && !r.server, files.join(' + ') + ': ожидалось «ничего», получено ' + show(r));
  else if (want === 'all') ok(r.all, files.join(' + ') + ': ожидалась полная проверка, получено ' + show(r));
  else ok(covers(r, want), files.join(' + ') + ': ожидалось ⊇ ' + want.join(',') + ', получено ' + show(r));
}
/* index.html по строкам: модуль RKP → rkp; стили → core/crawl; неизвестный модуль → всё */
{ const L = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n');
  const at = re => L.findIndex(l => re.test(l)) + 2;
  const rkp = at(/^\s*window\.RKP\s*=/); if (rkp > 1) ok(covers(impact(['index.html'], {indexLines: [rkp]}), ['rkp']), 'index.html, модуль RKP: ожидалось ⊇ rkp');
  ok(covers(impact(['index.html'], {indexLines: [3]}), ['core', 'crawl']), 'index.html, стили: ожидалось ⊇ core, crawl'); }
/* переименование: старый путь — тоже правка (git diff --no-renames) */
ok(/--no-renames/.test(fs.readFileSync(path.join(__dirname, 'impact.js'), 'utf8')), 'impact.js: переименование должно давать и старый, и новый путь (--no-renames)');
/* блоки из правил существуют в run.js */
for (const f of ['dz/ng/1/a.js', 'dz/ig/2/a.js', 'kernel/a.js', 'core/a.js', 'lk/a.js', 'server/a.js', 'tests/timings.json', ...Object.keys(TESTS).map(t => 'tests/' + t + '.js')]) {
  const r = impact([f]); r.groups.forEach(g => ok(GROUPS.includes(g), f + ': блока «' + g + '» нет в GROUPS run.js')); }

/* ── 2. каждый файл репозитория ── */
const ALLFILES = execSync('git ls-files -z', {cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20}).split('\0').filter(Boolean);
const stat = {doc: 0, all: 0, rule: 0};
for (const f of ALLFILES) {
  const r = ruleOf(f), res = impact([f], {indexLines: [3]});
  if (!r) { bad.push(f + ': нет правила'); continue; }
  if (r.to === 'DOC') { stat.doc++; ok(/\.md$/i.test(f) || /^docs\//.test(f), f + ': «документ» — только *.md и docs/**'); continue; }
  if (res.all) { stat.all++; continue; }
  stat.rule++;
  ok(res.groups.length || res.server, f + ': не документ, а проверка не запускается');
}

/* ── 3. зависимости из кода ── */
const DEPS = require('./deps.js'), {closure, webDeps} = DEPS, exists = p => fs.existsSync(p);
/* 3а. блоки run.js: сегмент от on('g') до следующего on(' */
const roots = DEPS.groupRoots();
/* блок core подключает и файлы, загруженные на общую страницу до него (geometry, render, mutate, oracle, euclid, arith, dz) — они в сегменте */
let deps = 0;
for (const [g, R] of Object.entries(roots)) {
  for (const f of closure([...R].filter(f => exists(path.join(ROOT, f))))) {
    if (f === 'index.html') continue;   /* index.html — по строкам, общий код → всё */
    deps++; const res = impact([f], {indexLines: [3]}), r = ruleOf(f);
    if (r && r.to === 'DOC') { bad.push('блок ' + g + ' читает документ ' + f + ' — его правка прошла бы без проверки'); continue; }
    ok(covers(res, [g]), 'блок ' + g + ' читает ' + f + ', а правка этого файла его не запускает (получено ' + show(res) + ')');
  }
}
/* 3б. тесты сервера. Исключение: документы, которые исполнитель Цеха (tools/hq-agent.js) вставляет в текст задания модели как справку, —
   они не меняют поведения кода и вердиктов проверок */
const PROMPT_DOCS = new Set(['docs/ARCHITECTURE.md', 'tests/README.md']);
const SRV = ALLFILES.filter(f => /^server\/test\/.*\.test\.js$|^lk\/tests\/.*\.test\.js$|^tests\/hq-agent\.test\.js$/.test(f));
for (const f of closure(SRV)) { if (/^node_modules\//.test(f)) continue; deps++; const res = impact([f]), r = ruleOf(f);
  if (r && r.to === 'DOC') { if (!PROMPT_DOCS.has(f)) bad.push('тесты сервера читают документ ' + f); continue; }
  ok(res.server, 'тесты сервера читают ' + f + ', а правка этого файла их не запускает (получено ' + show(res) + ')'); }
/* 3в. index.html: скрипты, fetch — ведут к обходу страниц и блоку содержания */
for (const f of webDeps(path.join(ROOT, 'index.html'))) { deps++; const res = impact([f]), r = ruleOf(f);
  if (r && r.to === 'DOC') { bad.push('index.html загружает документ ' + f); continue; }
  ok(res.all || res.groups.includes('crawl') && res.groups.some(g => !['crawl', 'smoke'].includes(g)) || res.groups.includes('crawl') && /\.(png|jpe?g|svg|webp|ico|webmanifest|woff2?)$/.test(f),
    'index.html загружает ' + f + ': правка должна запускать обход страниц и блок содержания (получено ' + show(res) + ')'); }

console.log('Карта влияния: файлов ' + ALLFILES.length + ' (документов ' + stat.doc + ', по правилу ' + stat.rule + ', полная проверка ' + stat.all + '); случаев таблицы ' + CASES.length + '; зависимостей блоков проверено ' + deps);
if (bad.length) { console.log('\nОШИБКИ КАРТЫ ВЛИЯНИЯ (' + bad.length + '):\n- ' + [...new Set(bad)].slice(0, 60).join('\n- ')); process.exit(1); }
console.log('Ошибок нет.');
