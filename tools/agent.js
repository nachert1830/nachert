const fs = require('fs');
const BASE = 'https://api.proxyapi.ru/v1';
const MODEL = 'deepseek/deepseek-v3.2';   // имя из каталога ProxyAPI

async function llm(system, user) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.PROXYAPI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, temperature: 0.2,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return (await r.json()).choices[0].message.content;
    } catch (e) { if (i === 2) throw e; await new Promise(s => setTimeout(s, 2000 * (i + 1))); }
  }
}

(async () => {
  const task = `${process.env.ISSUE_TITLE}\n${process.env.ISSUE_BODY}`;
  const map = fs.existsSync('repo_map.md') ? fs.readFileSync('repo_map.md', 'utf8') : '';

  // 1. Где править: файл и ключевые слова (по карте, без чтения кода)
  const where = JSON.parse((await llm(
    'Верни только JSON: {"file":"путь","keywords":["слово1","слово2"]}. Без пояснений.',
    `ЗАДАЧА:\n${task}\n\nКАРТА РЕПОЗИТОРИЯ:\n${map}`)).replace(/```json|```/g, '').trim());

  // 2. Вырезаем контекст вокруг найденных строк
  const lines = fs.readFileSync(where.file, 'utf8').split('\n');
  const hits = lines.map((l, i) => where.keywords.some(k => l.includes(k)) ? i : -1).filter(i => i >= 0).slice(0, 3);
  const ctx = hits.map(i => lines.slice(Math.max(0, i - 40), i + 40).join('\n')).join('\n/* ... */\n');

  // 3. Патч в формате SEARCH/REPLACE
  const patch = await llm(
    'Ты правишь код. Верни только блоки:\n<<<<<<< SEARCH\n(точный старый код)\n=======\n(новый код)\n>>>>>>> REPLACE\nSEARCH должен встречаться в коде ровно один раз.',
    `ЗАДАЧА:\n${task}\n\nКОД (${where.file}):\n${ctx}`);

  // 4. Применяем
  let src = fs.readFileSync(where.file, 'utf8'), n = 0;
  const re = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  let m;
  while ((m = re.exec(patch))) {
    if (src.split(m[1]).length - 1 !== 1) throw new Error('SEARCH найден не ровно 1 раз');
    src = src.replace(m[1], () => m[2]); n++;
  }
  if (!n) throw new Error('Патч пустой');
  fs.writeFileSync(where.file, src);
  console.log('Патч применён, блоков:', n);
})().catch(e => { console.error(e); process.exit(1); });
