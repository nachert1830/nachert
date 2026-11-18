#!/usr/bin/env node
/* Ревизор Цеха: сверяет изменения ветки с ТЗ. node tools/hq-review.js --model sonnet --task /tmp/hq-task.md --diff /tmp/hq.diff
   Печатает JSON {ok, notes}; стоимость добавляет в /tmp/hq-cost.json. Выход 0 — одобрено, 2 — замечания, 1 — сбой. */
'use strict';
const fs = require('fs'), RO = require('../server/lib/hq/roster.js');
const ARG = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : ''; };
const COST_FILE = process.env.HQ_COST_FILE || '/tmp/hq-cost.json';
const key = ARG('model') || 'sonnet', M = RO.model(null, key);
const task = fs.readFileSync(ARG('task'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
let diff = fs.readFileSync(ARG('diff'), 'utf8');
if (diff.length > 80000) diff = diff.slice(0, 80000) + '\n…[дифф обрезан]';

const SYSTEM = `Ты — ревизор Цеха сайта nachert1830.ru. Тебе дают ТЗ и дифф правки, автотесты уже прошли.
Проверь: сделано ли то, что требует ТЗ (каждый критерий «Готово, когда»); нет ли лишних изменений, удалённого чужого кода, заглушек, утёкших ключей, ломающих правок вне задачи.
Мелкие стилистические замечания не повод отклонять. Ответь ТОЛЬКО JSON: {"ok":true|false,"notes":["…"]}`;

(async () => {
  const r = await fetch('https://api.proxyapi.ru/v1/chat/completions', {method: 'POST',
    headers: {authorization: 'Bearer ' + process.env.PROXYAPI_KEY, 'content-type': 'application/json'},
    body: JSON.stringify({model: M.id, max_completion_tokens: 2000, messages: [{role: 'system', content: SYSTEM}, {role: 'user', content: 'ТЗ:\n' + task + '\n\nДИФФ:\n' + diff}]}),
    signal: AbortSignal.timeout(180000)});
  const t = await r.text(); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 200));
  const j = JSON.parse(t), text = j.choices[0].message.content || '';
  try { const c = JSON.parse(fs.readFileSync(COST_FILE, 'utf8')); c.rub = Math.round((c.rub + RO.cost(M, j.usage, 110)) * 100) / 100; fs.writeFileSync(COST_FILE, JSON.stringify(c)); } catch (e) {}
  const a = text.indexOf('{'), b = text.lastIndexOf('}'), v = JSON.parse(text.slice(a, b + 1));
  console.log(JSON.stringify(v)); process.exit(v.ok ? 0 : 2);
})().catch(e => { console.error(e.message); process.exit(1); });
