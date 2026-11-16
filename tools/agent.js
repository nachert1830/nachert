const fs = require('fs');
const path = require('path');

const BASE = 'https://api.proxyapi.ru/v1';
const MODEL = process.env.MODEL || 'deepseek/deepseek-v3.2'; // имя из каталога ProxyAPI
const MAX_STEPS = 15;
const IGNORE = new Set(['.git', 'node_modules', '.github']);
const TEXT = /\.(html|js|css|json|md|txt|svg|mjs)$/i;

// ---------- обзор проекта (строится автоматически) ----------
function listFiles(dir = '.', out = []) {
  for (const n of fs.readdirSync(dir)) {
    if (IGNORE.has(n)) continue;
    const p = path.join(dir, n);
    fs.statSync(p).isDirectory() ? listFiles(p, out) : out.push(p.replace(/^\.\//, ''));
  }
  return out;
}
function overview() {
  const files = listFiles().filter(f => TEXT.test(f));
  let o = 'ФАЙЛЫ (путь, строк):\n';
  for (const f of files) o += `${f}  ${fs.readFileSync(f, 'utf8').split('\n').length}\n`;
  // оглавление больших файлов: функции и id разделов
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    if (lines.length < 400) continue;
    const idx = [];
    lines.forEach((l, i) => {
      const m = l.match(/^\s*(?:async\s+)?function\s+([\w$]+)/) ||
                l.match(/<(?:section|main|nav|header|footer|div)[^>]*\sid="([^"]+)"/);
      if (m) idx.push(`${i + 1}:${m[1]}`);
    });
    o += `\nОГЛАВЛЕНИЕ ${f} (строка:имя), первые 300:\n${idx.slice(0, 300).join(' ')}\n`;
  }
  return o;
}

// ---------- инструменты ----------
function grep(pattern) {
  let re; try { re = new RegExp(pattern, 'i'); } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
  const res = [];
  for (const f of listFiles().filter(f => TEXT.test(f))) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (res.length < 40 && re.test(l)) res.push(`${f}:${i + 1}: ${l.trim().slice(0, 160)}`);
    });
  }
  return res.length ? res.join('\n') : 'Ничего не найдено';
}
function read(file, from, to) {
  if (!fs.existsSync(file)) return 'Файла нет: ' + file;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  from = Math.max(1, +from || 1);
  to = Math.min(lines.length, +to || from + 80, from + 200); // не больше 200 строк за раз
  return lines.slice(from - 1, to).map((l, i) => `${from + i}| ${l}`).join('\n');
}
function edit(file, text) {
  if (!fs.existsSync(file)) return 'ОШИБКА: файла нет: ' + file;
  let src = fs.readFileSync(file, 'utf8'), n = 0;
  const re = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  let m;
  while ((m = re.exec(text))) {
    const cnt = src.split(m[1]).length - 1;
    if (cnt !== 1) return `ОШИБКА: SEARCH найден ${cnt} раз, нужно ровно 1. Прочитай кусок снова и скопируй точно (без номеров строк).`;
    src = src.replace(m[1], () => m[2]); n++;
  }
  if (!n) return 'ОШИБКА: не найдено ни одного блока SEARCH/REPLACE';
  fs.writeFileSync(file, src);
  return `OK: применено блоков ${n}`;
}

// ---------- вызов модели ----------
async function llm(messages) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.PROXYAPI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, temperature: 0.1, messages }),
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return (await r.json()).choices[0].message.content.trim();
    } catch (e) { if (i === 2) throw e; await new Promise(s => setTimeout(s, 2000 * (i + 1))); }
  }
}

const SYSTEM = `Ты разработчик, который правит сайт. Файлы большие, целиком их читать нельзя.
Работай по шагам. На каждом шаге отвечай ОДНОЙ командой, без пояснений:

GREP: регулярное_выражение     (поиск по всему проекту)
READ: путь начало конец        (читать строки, максимум 200 за раз)
EDIT: путь                     (после этой строки идут блоки правки)
<<<<<<< SEARCH
точный старый код (без номеров строк, ровно как в файле)
=======
новый код
>>>>>>> REPLACE
DONE: краткое описание сделанного

Правила: сначала найди нужное место через GREP и оглавление, прочитай его через READ, затем делай EDIT.
Правь минимально, не трогай лишнее. SEARCH должен встречаться в файле ровно один раз.
Если задача невыполнима или неясна, ответь DONE: НЕ СДЕЛАНО и причина.`;

(async () => {
  const task = `${process.env.ISSUE_TITLE}\n\n${process.env.ISSUE_BODY || ''}`;
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `ЗАДАЧА:\n${task}\n\n${overview()}` },
  ];
  let edits = 0;

  for (let step = 1; step <= MAX_STEPS; step++) {
    const reply = await llm(messages);
    messages.push({ role: 'assistant', content: reply });
    console.log(`--- шаг ${step}: ${reply.split('\n')[0].slice(0, 120)}`);
    let result;

    if (/^GREP:/i.test(reply)) {
      result = grep(reply.split('\n')[0].replace(/^GREP:\s*/i, ''));
    } else if (/^READ:/i.test(reply)) {
      const [f, a, b] = reply.split('\n')[0].replace(/^READ:\s*/i, '').split(/\s+/);
      result = read(f, a, b);
    } else if (/^EDIT:/i.test(reply)) {
      const f = reply.split('\n')[0].replace(/^EDIT:\s*/i, '').trim();
      result = edit(f, reply);
      if (result.startsWith('OK')) edits++;
    } else if (/^DONE:/i.test(reply)) {
      if (/НЕ СДЕЛАНО/i.test(reply) || !edits) { console.error(reply); process.exit(1); }
      console.log(reply); return;
    } else {
      result = 'Неверный формат. Ответь одной командой: GREP, READ, EDIT или DONE.';
    }
    // чтобы переписка не раздувалась: длинные ответы инструментов обрезаем
    messages.push({ role: 'user', content: String(result).slice(0, 12000) });
  }
  console.error('Лимит шагов исчерпан');
  process.exit(edits ? 0 : 1); // если правка была, пусть тесты решают
})().catch(e => { console.error(e); process.exit(1); });
