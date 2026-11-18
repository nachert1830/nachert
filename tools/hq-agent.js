#!/usr/bin/env node
/* Исполнитель Цеха (hq-work.yml): правит код по ТЗ из Issue и экономит токены.
   node tools/hq-agent.js --model <ключ> [--task файл]
   • Модель — из штата Штаба (server/lib/hq/roster.js) или из метки в Issue (<!-- hq-model:{…} --> — свои модели Штаба).
   • Claude — формат Anthropic Messages (/v1/messages) с кэшем: системный промпт и вся переписка помечаются cache_control,
     повторное чтение стоит ~5 % цены. Остальные — OpenAI-формат (/v1/chat/completions; DeepSeek и Gemini кэшируют сами).
   • Модели не отдаётся ни один файл целиком: карта модулей index.html с номерами строк, поиск, чтение кусками ≤ 200 строк,
     правка блоками SEARCH/REPLACE. Ответы инструментов обрезаются, шагов — не больше MAX_STEPS.
   • Стоимость пишется в /tmp/hq-cost.json (накапливается между попытками), ход работы — в stdout.
   • Средние и сложные задачи — бригадой (--brigade, по умолчанию для Sonnet и Opus): Разведчик (Haiku) ищет и собирает пакет
     кода; Архитектор (выбранная модель) получает только пакет и пишет правки за 1–3 хода; Монтажник (DeepSeek) чинит правки,
     которые не легли на код. Дорогая модель не тратит ни рубля на поиск.
   • CHECK — исполнитель сам гоняет задетые блоки проверки (tests/impact.js → tests/run.js --quick --only) и чинит по выжимке ошибок.
   • SHOT #/адрес — скриншот страницы на телефоне; модель видит картинку (Claude, Gemini).
   Выход: 0 — правка сделана, 1 — не сделано. */
'use strict';
const fs = require('fs'), path = require('path');
const RO = require('../server/lib/hq/roster.js');

const ARG = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : ''; };
const KEY = process.env.PROXYAPI_KEY, PX = process.env.HQ_PX || 'https://api.proxyapi.ru/v1';
const MAX_STEPS = +process.env.HQ_MAX_STEPS || 30, COST_FILE = process.env.HQ_COST_FILE || '/tmp/hq-cost.json', DONE_FILE = process.env.HQ_DONE_FILE || '/tmp/hq-done.txt';
const ROOT = path.join(__dirname, '..');
const SKIP = /^(\.git|node_modules|ig[2-9]|ng[1-9]|og|fonts|img|app|\.github\/scripts)$/;
const TEXT = /\.(html|js|mjs|css|json|md|txt|svg|yml|yaml)$/i;

/* ── модель ── */
const task = fs.readFileSync(ARG('task') || '/tmp/hq-task.md', 'utf8');
let key = ARG('model') || 'deepseek', M = RO.model(null, key);
const mark = /<!-- hq-model:(\{[^\n]*?\}) -->/.exec(task);
if (mark) { try { const x = JSON.parse(mark[1]); if (x.key === key && x.id) M = Object.assign({}, M || {}, x); } catch (e) {} }
if (!M) { console.error('Нет такой модели в штате: ' + key); process.exit(1); }
const RATE = mark ? (JSON.parse(mark[1]).rate || 110) : 110;
const CLAUDE = /^anthropic\//.test(M.id), VISION = /^(anthropic|google)\//.test(M.id);
const BRIGADE = process.argv.includes('--brigade') || (!process.argv.includes('--solo') && /^(sonnet|opus|gpro)$/.test(key));

/* ── карта проекта: без содержимого файлов ── */
function walk(dir, out) {
  for (const n of fs.readdirSync(path.join(ROOT, dir)).sort()) {
    const rel = dir ? dir + '/' + n : n;
    if (SKIP.test(rel) || SKIP.test(n) || n.startsWith('.') && n !== '.github') continue;
    const st = fs.statSync(path.join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out); else if (TEXT.test(n)) out.push([rel, st.size]);
  }
  return out;
}
function map() {
  const files = walk('', []), dirs = {};
  files.forEach(([f, s]) => { const d = f.includes('/') ? f.split('/')[0] + '/' : f; (dirs[d] = dirs[d] || []).push([f, s]); });
  let o = 'ФАЙЛЫ ПРОЕКТА (папка: число файлов; файлы корня — с размером):\n';
  Object.keys(dirs).forEach(d => { o += d.endsWith('/') ? d + ' ' + dirs[d].length + ' файлов\n' : d + ' ' + Math.round(dirs[d][0][1] / 1024) + ' КБ\n'; });
  /* index.html — 35 тыс. строк: оглавление разделов стилей и модулей кода с номерами строк */
  const L = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n'), idx = [];
  L.forEach((l, i) => {
    const h = /\/\*\s*═{3,}\s*([^═*]{2,80}?)\s*(═|\*\/|$)/.exec(l), w = /^\s*window\.([A-Z][A-Z0-9_]{1,20})\s*=\s*(?:window\.\w+\s*\|\|\s*)?(?:\(\s*function|\(\s*\(\)\s*=>|\{|\[|function)/.exec(l) ||
      /^\s*(?:const|var) ([A-Z][A-Z0-9_]{2,20})\s*=\s*(?:\(\s*function\s*\(\s*\)|\{\s*tasks)/.exec(l);
    if (h) idx.push((i + 1) + ': ' + h[1].trim()); else if (w) idx.push((i + 1) + ': ' + w[1]);
  });
  o += '\nОГЛАВЛЕНИЕ index.html (' + L.length + ' строк; «строка: раздел»). Модули — window.ИМЯ, описание — docs/ARCHITECTURE.md:\n' + idx.join('\n');
  return o;
}

/* ── инструменты ── */
const inRoot = f => { const p = path.resolve(ROOT, String(f || '').trim()); if (!p.startsWith(ROOT + path.sep)) throw new Error('путь вне проекта'); return p; };
function grep(arg) {
  const m = /^(.*?)(?:\s+в\s+(\S+))?$/.exec(arg.trim()), pat = m[1], where = m[2] || '';
  let re; try { re = new RegExp(pat, 'i'); } catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
  const res = [];
  for (const [f] of walk('', [])) {
    if (where && !f.startsWith(where)) continue;
    const L = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
    for (let i = 0; i < L.length && res.length < 40; i++) if (re.test(L[i])) res.push(f + ':' + (i + 1) + ': ' + L[i].trim().slice(0, 160));
    if (res.length >= 40) { res.push('… больше 40 совпадений — уточни выражение или добавь «в папка/»'); break; }
  }
  return res.length ? res.join('\n') : 'Ничего не найдено';
}
function read(arg) {
  const [f, a, b] = arg.trim().split(/\s+/), p = inRoot(f);
  if (!fs.existsSync(p)) return 'Файла нет: ' + f;
  const L = fs.readFileSync(p, 'utf8').split('\n'), from = Math.max(1, +a || 1), to = Math.min(L.length, +b || from + 120, from + 199);
  return L.slice(from - 1, to).map((l, i) => (from + i) + '| ' + (l.length > 400 ? l.slice(0, 400) + ' …[строка обрезана]' : l)).join('\n') + (to < L.length ? '\n[всего строк: ' + L.length + ']' : '');
}
function edit(head, text) {
  const f = head.replace(/^EDIT:\s*/i, '').trim(), p = inRoot(f);
  const blocks = [...text.matchAll(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g)];
  if (!blocks.length) return 'ОШИБКА: нет блоков SEARCH/REPLACE';
  if (!fs.existsSync(p)) { if (blocks.length === 1 && blocks[0][1].trim() === '') { fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, blocks[0][2] + '\n'); return 'OK: создан ' + f; } return 'ОШИБКА: файла нет: ' + f + ' (новый файл — один блок с пустым SEARCH)'; }
  let src = fs.readFileSync(p, 'utf8');
  for (const [, a, b] of blocks) { const n = src.split(a).length - 1; if (n !== 1) return 'ОШИБКА: SEARCH найден ' + n + ' раз, нужно ровно 1 — прочитай место снова и скопируй точно, без номеров строк. Ни один блок не применён.'; }
  for (const [, a, b] of blocks) src = src.replace(a, () => b);
  fs.writeFileSync(p, src); return 'OK: применено блоков ' + blocks.length;
}

/* ── вызов модели и стоимость (любая модель штата: исполнитель, разведчик, монтажник) ── */
const cost = (() => { try { return JSON.parse(fs.readFileSync(COST_FILE, 'utf8')); } catch (e) { return {rub: 0, calls: 0, models: {}}; } })();
const isClaude = m => /^anthropic\//.test(m.id);
function account(k, m, u) {
  const cl = isClaude(m), usage = cl ? {prompt_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), completion_tokens: u.output_tokens || 0, cache_read_input_tokens: u.cache_read_input_tokens || 0} : u;
  /* запись в кэш Claude — +25 % к цене входа */
  const rub = RO.cost(m, usage, RATE) + (cl ? (u.cache_creation_input_tokens || 0) * (m.in || 0) * 0.25 / 1e6 * RATE : 0);
  cost.rub = Math.round((cost.rub + rub) * 100) / 100; cost.calls++; cost.models[k] = Math.round(((cost.models[k] || 0) + rub) * 100) / 100;
  fs.writeFileSync(COST_FILE, JSON.stringify(cost));
}
/* content сообщения — строка или [{text}|{image}] (скриншот) */
async function callAs(k, m, system, messages, o) {
  o = o || {};
  for (let i = 0; i < 3; i++) {
    try {
      let url, body;
      if (isClaude(m)) {
        const part = c => c.image ? {type: 'image', source: {type: 'base64', media_type: 'image/png', data: c.image}} : {type: 'text', text: c.text};
        const msgs = messages.map((x, j) => { const parts = (typeof x.content === 'string' ? [{text: x.content}] : x.content).map(part);
          if (j === messages.length - 1) parts[parts.length - 1].cache_control = {type: 'ephemeral'}; return {role: x.role, content: parts}; });
        url = PX + '/messages'; body = {model: m.id, max_tokens: o.max || 8000, system: [{type: 'text', text: system, cache_control: {type: 'ephemeral'}}], messages: msgs};
        if (o.effort) body.output_config = {effort: o.effort};
      } else {
        const part = c => c.image ? {type: 'image_url', image_url: {url: 'data:image/png;base64,' + c.image}} : {type: 'text', text: c.text};
        url = PX + '/chat/completions'; body = {model: m.id, max_completion_tokens: o.max || 8000, messages: [{role: 'system', content: system}].concat(messages.map(x => ({role: x.role, content: typeof x.content === 'string' ? x.content : x.content.map(part)})))};
        if (/gemini|gpt-5/.test(m.id)) body.reasoning_effort = 'low';
      }
      const r = await fetch(url, {method: 'POST', headers: {authorization: 'Bearer ' + KEY, 'content-type': 'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(300000)});
      const t = await r.text();
      if (!r.ok) {
        if (r.status === 402) throw Object.assign(new Error('ProxyAPI 402: ' + t.slice(0, 200)), {fatal: true});
        /* ProxyAPI может не принять output_config — повтор без него */
        if (r.status === 400 && body.output_config && /output_config|effort/i.test(t)) { delete o.effort; continue; }
        throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 200)); }
      const j = JSON.parse(t);
      if (j.usage) account(k, m, j.usage);
      const text = isClaude(m) ? (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('') : (j.choices[0].message.content || '');
      return String(text).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    } catch (e) { if (e.fatal || i === 2) throw e; console.error('повтор: ' + e.message); await new Promise(s => setTimeout(s, 3000 * (i + 1))); }
  }
}
const call = (system, messages, o) => callAs(key, M, system, messages, o);

/* ── проверка и глаза ── */
const {execSync} = require('child_process');
function check() {
  let only = 'all'; try { only = execSync('node tests/impact.js origin/main --only', {cwd: ROOT, encoding: 'utf8'}).trim(); } catch (e) {}
  if (only === 'none') return 'Проверка: правка не задевает сайт — проверять нечего. Можно DONE.';
  try { execSync('node tests/run.js --quick' + (only !== 'all' ? ' --only=' + only : ''), {cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 20 * 60000});
    return 'Проверка (' + only + '): ✅ ошибок нет.'; }
  catch (e) { const o = String(e.stdout || '') + String(e.stderr || ''), k = o.indexOf('НОВЫЕ ОШИБКИ');
    return 'Проверка (' + only + '): ❌\n' + (k >= 0 ? o.slice(k) : o.split('\n').slice(-30).join('\n')).slice(0, 4000); }
}
let srv = null;
async function shot(hash) {
  const {chromium} = require('playwright'), http = require('http');
  if (!srv) srv = await new Promise(res => { const s = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
    const p = path.join(ROOT, f); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, {'Content-Type': {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml'}[path.extname(p)] || 'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0, '127.0.0.1', () => res(s)); });
  const b = await chromium.launch({executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined}).catch(() => chromium.launch());
  try { const pg = await b.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 1}), errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto('http://127.0.0.1:' + srv.address().port + '/' + (String(hash || '').startsWith('#') ? hash : '#/')); await pg.waitForTimeout(1500);
    const png = (await pg.screenshot()).toString('base64');
    return {png, note: 'Скриншот ' + (hash || '#/') + ' на телефоне 390×844' + (errs.length ? '. Ошибки JS: ' + errs.slice(0, 3).join(' / ').slice(0, 400) : '. Ошибок JS нет.')}; }
  finally { await b.close(); }
}

/* ── реплики владельца на ходу: комментарии «💬 Владелец: …» в Issue задачи (Штаб → relay); читаются перед каждым шагом ── */
const ISSUE = process.env.HQ_ISSUE, GHT = process.env.GH_TOKEN, REPO = process.env.GITHUB_REPOSITORY; let seenC = null;
async function owner() {
  if (!ISSUE || !GHT || !REPO) return '';
  try { const r = await fetch('https://api.github.com/repos/' + REPO + '/issues/' + ISSUE + '/comments?per_page=100', {headers: {authorization: 'Bearer ' + GHT, accept: 'application/vnd.github+json', 'user-agent': 'hq-agent'}});
    const cs = (await r.json()).filter(c => /^💬 Владелец:/.test(c.body || ''));
    if (seenC === null) { seenC = new Set(cs.map(c => c.id)); return ''; }   /* старые — уже в ТЗ при запуске */
    const fresh = cs.filter(c => !seenC.has(c.id)); fresh.forEach(c => seenC.add(c.id));
    return fresh.map(c => c.body).join('\n'); } catch (e) { return ''; }
}
const withOwner = async messages => { const o = await owner(); if (o) { console.log('  реплика владельца: ' + o.slice(0, 120)); const last = messages[messages.length - 1];
  if (typeof last.content === 'string') last.content += '\n\n[ВЛАДЕЛЕЦ ПО ХОДУ РАБОТЫ — учти:]\n' + o; else last.content.push({text: '[ВЛАДЕЛЕЦ ПО ХОДУ РАБОТЫ — учти:]\n' + o}); } };

/* ── одиночный исполнитель (простые задачи, дешёвые модели) ── */
const SYSTEM = `Ты — разработчик в Цехе сайта nachert1830.ru: учебный сайт по начертательной геометрии и инженерной графике. Сайт — один файл index.html (35 тыс. строк, без сборки), плюс личный кабинет lk/, облачные функции server/, данные ДЗ dz/ и ядро core/ kernel/. Автотесты — tests/run.js.
Файлы большие — целиком их не читай. Работай по шагам; на каждом шаге — ОДНА команда, без пояснений вокруг:

GREP: выражение               — поиск по проекту (до 40 строк); «GREP: выражение в lk/» — только в папке
READ: путь начало конец       — строки файла, не больше 200 за раз
EDIT: путь                    — правка; дальше один или несколько блоков:
<<<<<<< SEARCH
точный старый код (без номеров строк, ровно как в файле; должен встречаться один раз)
=======
новый код
>>>>>>> REPLACE
CHECK                          — прогнать автотесты, задетые правкой (минуты); ответ — ошибки или «ошибок нет»
` + (VISION ? `SHOT: #/адрес              — скриншот страницы сайта на телефоне (ты увидишь картинку)
` : '') + `DONE: что сделано (1–3 предложения)

Правила:
- Сначала найди место по оглавлению и GREP, прочитай его, потом правь. Правь минимально, не трогай лишнее, не переформатируй.
- После правки — CHECK; ошибки — исправь. DONE — только после зелёного CHECK.` + (VISION ? ' Правка внешнего вида — посмотри SHOT.' : '') + `
- Следуй стилю соседнего кода (модули window.ИМЯ, цвета — токены CSS). Тексты для студентов — по-русски, коротко.
- Новый файл: EDIT: путь и один блок с пустым SEARCH.
- Задача невыполнима или ТЗ противоречиво — ответь «DONE: НЕ СДЕЛАНО — причина».`;

async function solo(spec) {
  const messages = [{role: 'user', content: 'ТЗ:\n' + spec + '\n\n' + map()}];
  let edits = 0, checked = false;
  console.log('Исполнитель: ' + (M.name || key) + ' (' + M.id + ')' + (CLAUDE ? ', кэш Claude включён' : ''));
  await owner();
  for (let step = 1; step <= MAX_STEPS; step++) {
    await withOwner(messages);
    const reply = await call(SYSTEM, messages);
    messages.push({role: 'assistant', content: reply || '(пусто)'});
    const head = (reply.split('\n').find(l => /^(GREP|READ|EDIT|CHECK|SHOT|DONE)\b:?/i.test(l.trim())) || reply.split('\n')[0] || '').trim();
    console.log('--- шаг ' + step + ': ' + head.slice(0, 140));
    let res;
    try {
      if (/^GREP:/i.test(head)) res = grep(head.replace(/^GREP:\s*/i, ''));
      else if (/^READ:/i.test(head)) res = read(head.replace(/^READ:\s*/i, ''));
      else if (/^EDIT:/i.test(head)) { res = edit(head, reply.slice(reply.indexOf(head))); if (res.startsWith('OK')) { edits++; checked = false; } }
      else if (/^CHECK/i.test(head)) { res = check(); checked = /✅|нечего/.test(res); console.log(res.split('\n')[0]); }
      else if (/^SHOT/i.test(head) && VISION) { const s = await shot(head.replace(/^SHOT:?\s*/i, '')); messages.push({role: 'user', content: [{text: s.note}, {image: s.png}]}); continue; }
      else if (/^DONE:/i.test(head)) {
        fs.writeFileSync(DONE_FILE, head.replace(/^DONE:\s*/i, ''));
        if (/НЕ СДЕЛАНО/i.test(head) || !edits) { console.error(head); return 1; }
        if (!checked && step < MAX_STEPS - 1) { res = 'Сначала CHECK: DONE — только после зелёной проверки.'; }
        else { console.log(head); return 0; }
      } else res = 'Неверный формат. Ответь одной командой: GREP, READ, EDIT, CHECK' + (VISION ? ', SHOT' : '') + ' или DONE.';
    } catch (e) { res = 'ОШИБКА: ' + e.message; }
    if (step === MAX_STEPS - 3) res += '\n\n[осталось 3 шага — заканчивай и пиши DONE]';
    messages.push({role: 'user', content: String(res).slice(0, 12000)});
  }
  console.error('Лимит шагов исчерпан'); return edits ? 0 : 1;
}

/* ── бригада: Разведчик → Архитектор → Монтажник ── */
const SCOUT = `Ты — разведчик в Цехе сайта nachert1830.ru. Ты НЕ правишь код. Твоя работа — найти всё, что нужно архитектору для ТЗ, и собрать пакет: точные места в файлах.
Команды (одна за шаг): GREP: выражение [в папка/] · READ: путь начало конец (≤ 200 строк) · NOTE: путь начало конец — зачем (добавить кусок в пакет) · PACK: краткая сводка (закончить).
Собирай только нужное: место правки с запасом 10–30 строк, функции, которые оно вызывает, похожий код рядом как образец стиля, связанные стили. Обычно 3–8 кусков, всего не больше 600 строк. Начни с оглавления.`;
const ARCH = `Ты — архитектор в Цехе сайта nachert1830.ru (учебный сайт по начертательной геометрии; index.html — 35 тыс. строк без сборки, lk/ — кабинет, server/ — функции; автотесты tests/run.js). Разведчик собрал пакет кода по ТЗ. Ты пишешь правки — точно и минимально, в стиле соседнего кода.
Ответ — один или несколько блоков, без пояснений вокруг:
EDIT: путь
<<<<<<< SEARCH
точный старый код из пакета (без номеров строк; должен встречаться в файле один раз)
=======
новый код
>>>>>>> REPLACE
Не хватает кода — вместо правок ответь строками «NEED: путь начало конец — зачем» (не больше 3). В конце правок — строка «DONE: что сделано». Невыполнимо — «DONE: НЕ СДЕЛАНО — причина».`;
const MASON = `Ты — монтажник. Блок правки SEARCH/REPLACE не лёг на файл: SEARCH не совпал с текстом. Тебе дают блок и настоящий кусок файла. Перепиши SEARCH так, чтобы он ТОЧНО совпадал с текстом файла (без номеров строк), а REPLACE — тот же смысл правки. Ответ — только исправленный блок EDIT в том же формате.`;

const cheap = k => [k, RO.model(null, k)];
/* где в файле то, что архитектор хотел заменить: первая строка SEARCH, иначе — самое редкое характерное слово из него */
function locate(f, sr) {
  const L = fs.readFileSync(inRoot(f), 'utf8').split('\n'), first = sr.split('\n').map(x => x.trim()).find(x => x.length > 3) || '';
  let i = first ? L.findIndex(l => l.includes(first)) : -1; if (i >= 0) return i + 1;
  const words = [...new Set((sr.match(/[\w$#.-]{5,}/g) || []))];
  let best = null; for (const w of words) { const hits = L.reduce((a, l, k) => (l.includes(w) && a.push(k), a), []); if (hits.length && (!best || hits.length < best.n)) best = {n: hits.length, k: hits[0]}; }
  return best ? best.k + 1 : 1;
}
async function brigade(spec) {
  const [sk, sm] = cheap('haiku'), [mk, mm] = cheap('deepseek');
  console.log('Бригада: разведчик ' + sm.name + ' → архитектор ' + (M.name || key) + ' → монтажник ' + mm.name);
  /* 1. разведка */
  const sMsgs = [{role: 'user', content: 'ТЗ:\n' + spec + '\n\n' + map()}], notes = []; let summary = '';
  for (let step = 1; step <= 25; step++) {
    const reply = await callAs(sk, sm, SCOUT, sMsgs, {max: 2000}); sMsgs.push({role: 'assistant', content: reply || '(пусто)'});
    const head = (reply.split('\n').find(l => /^(GREP|READ|NOTE|PACK):/i.test(l.trim())) || '').trim(); let res;
    try {
      if (/^GREP:/i.test(head)) res = grep(head.slice(5)); else if (/^READ:/i.test(head)) res = read(head.slice(5));
      else if (/^NOTE:/i.test(head)) { const m = /^NOTE:\s*(\S+)\s+(\d+)\s+(\d+)\s*(?:—|-)?\s*(.*)$/i.exec(head); if (m) { notes.push({f: m[1], a: +m[2], b: Math.min(+m[3], +m[2] + 250), why: m[4]}); res = 'В пакете: ' + notes.length; } else res = 'Формат: NOTE: путь начало конец — зачем'; }
      else if (/^PACK:/i.test(head)) { summary = head.slice(5).trim(); break; }
      else res = 'Одна команда: GREP, READ, NOTE или PACK.';
    } catch (e) { res = 'ОШИБКА: ' + e.message; }
    console.log('  разведчик ' + step + ': ' + head.slice(0, 120)); sMsgs.push({role: 'user', content: String(res).slice(0, 10000)});
  }
  if (!notes.length) { console.log('  разведчик ничего не собрал — работаю один'); return solo(spec); }
  const pack = () => notes.map(n => '### ' + n.f + ' ' + n.a + '–' + n.b + (n.why ? ' — ' + n.why : '') + '\n' + read(n.f + ' ' + n.a + ' ' + n.b)).join('\n\n');
  /* 2. архитектор (1–3 хода) → 3. монтаж и проверка (до 2 починок) */
  const aMsgs = [{role: 'user', content: 'ТЗ:\n' + spec + '\n\nСводка разведчика: ' + summary + '\n\nПАКЕТ:\n' + pack()}];
  let edits = 0, fixes = 0;
  await owner();
  for (let turn = 1; turn <= 6; turn++) {
    await withOwner(aMsgs);
    const reply = await call(ARCH, aMsgs, {max: 12000, effort: key === 'opus' ? 'medium' : undefined}); aMsgs.push({role: 'assistant', content: reply || '(пусто)'});
    const need = [...reply.matchAll(/^NEED:\s*(\S+)\s+(\d+)\s+(\d+)/gim)];
    if (need.length && !/^EDIT:/im.test(reply)) { aMsgs.push({role: 'user', content: need.slice(0, 3).map(m => '### ' + m[1] + ' ' + m[2] + '–' + m[3] + '\n' + read(m[1] + ' ' + m[2] + ' ' + m[3])).join('\n\n')}); console.log('  архитектор просит ещё ' + need.length); continue; }
    const done = (/^DONE:.*$/im.exec(reply) || [''])[0];
    if (/НЕ СДЕЛАНО/i.test(done)) { console.error(done); return 1; }
    /* монтаж: каждый EDIT отдельно; не лёг — монтажник по настоящему тексту файла */
    const parts = reply.split(/^(?=EDIT:)/m).filter(x => /^EDIT:/.test(x)), errs = [];
    for (const part of parts) {
      const head = part.split('\n')[0].trim(); let r = edit(head, part);
      if (!r.startsWith('OK')) {
        const f = head.slice(5).trim(), sr = (/<<<<<<< SEARCH\n([\s\S]*?)\n=======/.exec(part) || [, ''])[1], ln = locate(f, sr);
        const fixed = await callAs(mk, mm, MASON, [{role: 'user', content: 'БЛОК:\n' + part + '\n\nФАЙЛ ' + f + ' (кусок):\n' + read(f + ' ' + Math.max(1, ln - 40) + ' ' + (ln + 80))}], {max: 4000});
        r = edit(head, fixed.slice(Math.max(0, fixed.indexOf('EDIT:')))); console.log('  монтажник: ' + r);
      }
      if (r.startsWith('OK')) edits++; else errs.push(head + ': ' + r);
    }
    if (errs.length) { aMsgs.push({role: 'user', content: 'Не легли правки:\n' + errs.join('\n') + '\nПрочитай нужное через NEED или перепиши блоки точнее.'}); continue; }
    if (!edits) { aMsgs.push({role: 'user', content: 'Правок нет. Напиши блоки EDIT или DONE: НЕ СДЕЛАНО — причина.'}); continue; }
    const c = check(); console.log('  ' + c.split('\n')[0]);
    if (/✅|нечего/.test(c)) { fs.writeFileSync(DONE_FILE, done.replace(/^DONE:\s*/i, '') || 'сделано'); console.log(done); return 0; }
    if (++fixes > 2) { console.error('Проверка красная после 2 починок'); return 1; }
    aMsgs.push({role: 'user', content: c + '\n\nИсправь: блоки EDIT по текущему коду (NEED — если надо перечитать).'});
  }
  return edits ? 0 : 1;
}

/* ── вопрос про код: только читает (GREP, READ, SHOT), ответ со ссылками на файл:строку ── */
const ASK = `Ты — инженер, который знает код сайта nachert1830.ru (учебный сайт по начертательной геометрии; index.html — 35 тыс. строк без сборки, lk/ — кабинет, server/ — облачные функции, tests/ — проверки, .github/workflows/ — автоматика). Владелец задал вопрос. Найди ответ в коде; ничего не правь.
Команды (одна за шаг): GREP: выражение [в папка/] · READ: путь начало конец (≤ 200 строк)` + (VISION ? ' · SHOT: #/адрес (скриншот страницы на телефоне)' : '') + ` · ANSWER: ответ (закончить).
ANSWER — по-русски, простыми словами для владельца (он не программист): суть в 1–3 предложениях, затем где это в коде (файл:строка), и если что-то сломано — что предлагаешь сделать. До 15 строк.`;
async function answer(q) {
  const messages = [{role: 'user', content: 'ВОПРОС:\n' + q + '\n\n' + map()}];
  for (let step = 1; step <= 20; step++) {
    const reply = await call(ASK, messages, {max: 3000}); messages.push({role: 'assistant', content: reply || '(пусто)'});
    const head = (reply.split('\n').find(l => /^(GREP|READ|SHOT|ANSWER)\b:?/i.test(l.trim())) || '').trim(); console.log('--- шаг ' + step + ': ' + head.slice(0, 120));
    if (/^ANSWER:/i.test(head)) { fs.writeFileSync('/tmp/hq-answer.md', reply.slice(reply.indexOf(head) + 7).trim()); return 0; }
    let res; try {
      if (/^GREP:/i.test(head)) res = grep(head.slice(5)); else if (/^READ:/i.test(head)) res = read(head.slice(5));
      else if (/^SHOT/i.test(head) && VISION) { const sh = await shot(head.replace(/^SHOT:?\s*/i, '')); messages.push({role: 'user', content: [{text: sh.note}, {image: sh.png}]}); continue; }
      else res = 'Одна команда: GREP, READ' + (VISION ? ', SHOT' : '') + ' или ANSWER.';
    } catch (e) { res = 'ОШИБКА: ' + e.message; }
    if (step === 17) res += '\n\n[осталось 3 шага — пиши ANSWER]';
    messages.push({role: 'user', content: String(res).slice(0, 12000)});
  }
  return 1;
}

(async () => {
  if (!KEY) { console.error('Нет PROXYAPI_KEY'); process.exit(1); }
  const spec = task.replace(/<!--[\s\S]*?-->/g, '').trim();
  const code = process.argv.includes('--ask') ? await answer(spec) : BRIGADE ? await brigade(spec) : await solo(spec);
  console.log('Стоимость всего: ' + cost.rub + ' ₽ (' + Object.entries(cost.models).map(([k, v]) => k + ' ' + v).join(', ') + ')');
  if (srv) srv.close(); process.exit(code);
})().catch(e => { console.error(e.message || e); process.exit(1); });
