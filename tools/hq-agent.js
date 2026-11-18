#!/usr/bin/env node
/* Исполнитель Цеха (hq-work.yml): правит код по ТЗ из Issue и экономит токены.
   node tools/hq-agent.js --model <ключ> [--task файл]
   • Модель — из штата Штаба (server/lib/hq/roster.js) или из метки в Issue (<!-- hq-model:{…} --> — свои модели Штаба).
   • Claude — формат Anthropic Messages (/v1/messages) с кэшем: системный промпт и вся переписка помечаются cache_control,
     повторное чтение стоит ~5 % цены. Остальные — OpenAI-формат (/v1/chat/completions; DeepSeek и Gemini кэшируют сами).
   • Модели не отдаётся ни один файл целиком: карта модулей index.html с номерами строк, поиск, чтение кусками ≤ 200 строк,
     правка блоками SEARCH/REPLACE. Ответы инструментов обрезаются, шагов — не больше MAX_STEPS.
   • Стоимость пишется в /tmp/hq-cost.json (накапливается между попытками), ход работы — в stdout.
   Выход: 0 — правка сделана, 1 — не сделано. */
'use strict';
const fs = require('fs'), path = require('path');
const RO = require('../server/lib/hq/roster.js');

const ARG = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : ''; };
const KEY = process.env.PROXYAPI_KEY, PX = 'https://api.proxyapi.ru/v1';
const MAX_STEPS = +process.env.HQ_MAX_STEPS || 30, COST_FILE = process.env.HQ_COST_FILE || '/tmp/hq-cost.json';
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
const CLAUDE = /^anthropic\//.test(M.id);

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
    const h = /\/\*\s*═{3,}\s*([^═*]{2,80}?)\s*(═|\*\/|$)/.exec(l), w = /^\s*(window\.|const |var |let )([A-Z][A-Z0-9_]{1,20})\s*=/.exec(l);
    if (h) idx.push((i + 1) + ': ' + h[1].trim()); else if (w) idx.push((i + 1) + ': ' + w[1].trim() + ' ' + w[2]);
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

/* ── вызов модели и стоимость ── */
const cost = (() => { try { return JSON.parse(fs.readFileSync(COST_FILE, 'utf8')); } catch (e) { return {rub: 0, calls: 0, models: {}}; } })();
function account(u) {
  const usage = CLAUDE ? {prompt_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), completion_tokens: u.output_tokens || 0, cache_read_input_tokens: u.cache_read_input_tokens || 0} : u;
  /* запись в кэш Claude — +25 % к цене входа */
  const rub = RO.cost(M, usage, RATE) + (CLAUDE ? (u.cache_creation_input_tokens || 0) * (M.in || 0) * 0.25 / 1e6 * RATE : 0);
  cost.rub = Math.round((cost.rub + rub) * 100) / 100; cost.calls++; cost.models[key] = Math.round(((cost.models[key] || 0) + rub) * 100) / 100;
  fs.writeFileSync(COST_FILE, JSON.stringify(cost));
}
async function call(system, messages) {
  for (let i = 0; i < 3; i++) {
    try {
      let url, body;
      if (CLAUDE) {
        const msgs = messages.map((m, j) => ({role: m.role, content: [Object.assign({type: 'text', text: m.content}, j === messages.length - 1 ? {cache_control: {type: 'ephemeral'}} : {})]}));
        url = PX + '/messages'; body = {model: M.id, max_tokens: 8000, system: [{type: 'text', text: system, cache_control: {type: 'ephemeral'}}], messages: msgs};
      } else {
        url = PX + '/chat/completions'; body = {model: M.id, max_completion_tokens: 8000, messages: [{role: 'system', content: system}].concat(messages)};
        if (/gemini|gpt-5/.test(M.id)) body.reasoning_effort = 'low';
      }
      const r = await fetch(url, {method: 'POST', headers: {authorization: 'Bearer ' + KEY, 'content-type': 'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(240000)});
      const t = await r.text();
      if (!r.ok) { if (r.status === 402) throw Object.assign(new Error('ProxyAPI 402: ' + t.slice(0, 200)), {fatal: true}); throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 200)); }
      const j = JSON.parse(t);
      if (j.usage) account(j.usage);
      const text = CLAUDE ? (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('') : (j.choices[0].message.content || '');
      return String(text).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    } catch (e) { if (e.fatal || i === 2) throw e; console.error('повтор: ' + e.message); await new Promise(s => setTimeout(s, 3000 * (i + 1))); }
  }
}

const SYSTEM = `Ты — разработчик в Цехе сайта nachert1830.ru: учебный сайт по начертательной геометрии и инженерной графике. Сайт — один файл index.html (35 тыс. строк, без сборки), плюс личный кабинет lk/, облачные функции server/, данные ДЗ dz/ и ядро core/ kernel/. После твоей правки запустятся автотесты (tests/run.js): чертежи, страницы на телефоне, задачи до ответа.
Файлы большие — целиком их не читай. Работай по шагам; на каждом шаге — ОДНА команда, без пояснений вокруг:

GREP: выражение               — поиск по проекту (до 40 строк); «GREP: выражение в lk/» — только в папке
READ: путь начало конец       — строки файла, не больше 200 за раз
EDIT: путь                    — правка; дальше один или несколько блоков:
<<<<<<< SEARCH
точный старый код (без номеров строк, ровно как в файле; должен встречаться один раз)
=======
новый код
>>>>>>> REPLACE
DONE: что сделано (1–3 предложения)

Правила:
- Сначала найди место по оглавлению и GREP, прочитай его, потом правь. Правь минимально, не трогай лишнее, не переформатируй.
- Следуй стилю соседнего кода (модули window.ИМЯ, цвета — токены CSS). Тексты для студентов — по-русски, коротко.
- Новый файл: EDIT: путь и один блок с пустым SEARCH.
- Задача невыполнима или ТЗ противоречиво — ответь «DONE: НЕ СДЕЛАНО — причина».`;

(async () => {
  if (!KEY) { console.error('Нет PROXYAPI_KEY'); process.exit(1); }
  const spec = task.replace(/<!--[\s\S]*?-->/g, '').trim();
  const messages = [{role: 'user', content: 'ТЗ:\n' + spec + '\n\n' + map()}];
  let edits = 0;
  console.log('Исполнитель: ' + (M.name || key) + ' (' + M.id + ')' + (CLAUDE ? ', кэш Claude включён' : ''));
  for (let step = 1; step <= MAX_STEPS; step++) {
    const reply = await call(SYSTEM, messages);
    messages.push({role: 'assistant', content: reply || '(пусто)'});
    const head = (reply.split('\n').find(l => /^(GREP|READ|EDIT|DONE):/i.test(l.trim())) || reply.split('\n')[0] || '').trim();
    console.log('--- шаг ' + step + ': ' + head.slice(0, 140));
    let res;
    try {
      if (/^GREP:/i.test(head)) res = grep(head.replace(/^GREP:\s*/i, ''));
      else if (/^READ:/i.test(head)) res = read(head.replace(/^READ:\s*/i, ''));
      else if (/^EDIT:/i.test(head)) { res = edit(head, reply.slice(reply.indexOf(head))); if (res.startsWith('OK')) edits++; }
      else if (/^DONE:/i.test(head)) {
        fs.writeFileSync('/tmp/hq-done.txt', head.replace(/^DONE:\s*/i, ''));
        if (/НЕ СДЕЛАНО/i.test(head) || !edits) { console.error(head); process.exit(1); }
        console.log(head); console.log('Стоимость всего: ' + cost.rub + ' ₽'); return;
      } else res = 'Неверный формат. Ответь одной командой: GREP, READ, EDIT или DONE.';
    } catch (e) { res = 'ОШИБКА: ' + e.message; }
    if (step === MAX_STEPS - 3) res += '\n\n[осталось 3 шага — заканчивай правку и пиши DONE]';
    messages.push({role: 'user', content: String(res).slice(0, 12000)});
  }
  console.error('Лимит шагов исчерпан'); process.exit(edits ? 0 : 1);
})().catch(e => { console.error(e.message || e); process.exit(1); });
