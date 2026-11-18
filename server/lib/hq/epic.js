/* Штаб: эпики — большая цель владельца, которую Главный инженер (роль chief, по умолчанию Opus) разбивает на 3–30 задач.
   Путь: цель → Issue «эпик» (Цех: Разведчик собирает код, Главный инженер пишет план JSON) → план в ленте → «Утвердить» →
   задачи по одной (каждая опирается на влитую предыдущую) → провал — разбор Главным инженером → все готовы — полная проверка main
   и приёмка → итог в ленте. Планировщик epicTick() идёт из POST /api/hq/sync и из таймера сервера (remind() раз в 15 минут).
   Узел эпика: {id, type:'epic', title, text, status, at, plan, budgetRub, spentRub, replans, log:[{at,text}], issue, url, planRub, chiefRub}.
   Задачи эпика — обычные узлы task с полями epic, ekey, deps (id предшественников), eorder (порядок плана), core. */
'use strict';
const RO = require('./roster'), P = require('./prompts');

/* статусы и единственно допустимые переходы (archived — «Отменить» из любого) */
const FLOW = {draft: ['planning'], planning: ['review', 'paused'], review: ['running', 'draft'], running: ['paused', 'done'], paused: ['running', 'failed', 'draft'], done: [], failed: []};
const MAX_TASK_FIX = 2, MAX_EPIC_FIX = 5;

const str = (s, n) => String(s == null ? '' : s).replace(/\u0000/g, '').trim().slice(0, n || 400);
const list = (a, k, n) => (Array.isArray(a) ? a : a ? [a] : []).map(x => str(x, n || 300)).filter(Boolean).slice(0, k || 12);

/* одна задача плана → чистый вид */
function normTask(t, i) {
  t = t && typeof t === 'object' ? t : {};
  return {key: str(t.key, 24) || 't' + (i + 1), title: str(t.title, 120), what: str(t.what, 4000), where: str(t.where, 400), done: list(t.done), not: list(t.not, 8),
    kind: RO.KINDS[t.kind] ? t.kind : 'code', level: RO.LEVELS[t.level] ? t.level : 'medium', core: t.core === true, deps: list(t.deps, 30, 24), test: str(t.test, 400)};
}

/* validatePlan(план) → {ok, errors[], plan} — план Главного инженера проверяется до показа владельцу */
function validatePlan(raw) {
  const errors = [], p = raw && typeof raw === 'object' ? raw : {};
  const tasks = (Array.isArray(p.tasks) ? p.tasks : []).map(normTask);
  const plan = {summary: str(p.summary, 1500), architecture: str(p.architecture, 2000), tasks, risks: list(p.risks, 8), questions: list(p.questions, 3)};
  if (tasks.length < 3) errors.push('задач ' + tasks.length + ' — нужно не меньше 3 (маленькую цель делай обычной задачей)');
  if (tasks.length > 30) errors.push('задач ' + tasks.length + ' — нужно не больше 30');
  const keys = new Set();
  tasks.forEach(t => {
    const name = '«' + (t.title || t.key) + '» (' + t.key + ')';
    if (keys.has(t.key)) errors.push('повторяется key ' + t.key); keys.add(t.key);
    if (!t.title) errors.push(t.key + ': нет title');
    if (!t.where) errors.push(name + ': нет where — где в коде делать');
    if (!t.done.length) errors.push(name + ': нет done — критериев готовности');
    if (!t.test) errors.push(name + ': нет test — какой проверкой подтверждается');
  });
  tasks.forEach(t => t.deps.forEach(d => { if (!keys.has(d)) errors.push('«' + t.title + '» (' + t.key + '): зависимость от несуществующей задачи ' + d); else if (d === t.key) errors.push(t.key + ' зависит сам от себя'); }));
  /* цикл в deps — поиском в глубину */
  const by = Object.fromEntries(tasks.map(t => [t.key, t])), mark = {};
  const dfs = (k, path) => { if (mark[k] === 2 || !by[k]) return null; if (mark[k] === 1) return path.slice(path.indexOf(k)).concat(k);
    mark[k] = 1; for (const d of by[k].deps) { const c = dfs(d, path.concat(k)); if (c) return c; } mark[k] = 2; return null; };
  for (const t of tasks) { const c = dfs(t.key, []); if (c) { errors.push('цикл в deps: ' + c.join(' → ')); break; } }
  const hard = tasks.filter(t => t.level === 'complex' || t.core).length;
  if (tasks.length && hard / tasks.length > 0.3) errors.push('сложных и «ядро» ' + hard + ' из ' + tasks.length + ' (' + Math.round(hard / tasks.length * 100) + ' %) — не больше 30 %: дели сложное на простые шаги');
  return {ok: !errors.length, errors, plan};
}

/* порядок плана с учётом deps: задачи по eorder, первая — та, у которой все deps готовы */
const byOrder = (a, b) => (a.eorder || 0) - (b.eorder || 0) || a.at - b.at;

/* план из комментария Цеха: JSON между <!-- hq-plan --> и <!-- /hq-plan --> (может быть в блоке ```json) */
function planFrom(body) {
  const m = /<!-- hq-plan -->([\s\S]*?)<!-- \/hq-plan -->/.exec(String(body || '')); if (!m) return null;
  const t = m[1].trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) { return {broken: true}; }
}

/* ctx — помощники Штаба из index.js: store, now, settings, askJson, gh, feed, A, inner, getNode, save, estimate, memFor, fail, id */
function epics(ctx) {
  const {store, now, settings, askJson, gh, feed, A, inner, getNode, save, estimate, memFor, fail, id} = ctx;
  const r2 = v => Math.round((+v || 0) * 100) / 100;

  function setStatus(e, s, why) {
    if (s !== 'archived' && !(FLOW[e.status] || []).includes(s)) fail(409, 'Эпик «' + e.title + '»: из «' + e.status + '» в «' + s + '» нельзя.');
    e.status = s; log(e, (why ? why + ' → ' : '') + s);
  }
  const log = (e, text) => { e.log = (e.log || []).concat({at: now(), text: str(text, 600)}).slice(-80); };
  const tasksOf = async e => (await store.scan('hqnodes', n => n.epic === e.id && n.type === 'task' && n.status !== 'archived')).sort(byOrder);
  const chiefKey = st => st.roles.chief || 'opus';
  const execOf = (st, t) => t.core ? chiefKey(st) : st.staff[t.kind || 'code'][t.level || 'medium'];
  const hqModel = (st, k) => { const m = RO.model(st, k); return '<!-- hq-model:' + JSON.stringify({key: k, id: m.id, name: m.name, in: m.in, out: m.out, cache: m.cache, rate: st.rate}) + ' -->'; };

  /* B2: новый эпик → сразу план (Issue в Цех). Монолог владельца в Issue не попадает: только цель и контекст. */
  async function create(o) {
    const e = {id: id('e'), type: 'epic', title: str(o.title, 120) || 'Эпик', text: str(o.text, 3000), status: 'draft', at: now(), parent: o.parent || null,
      plan: null, budgetRub: 0, spentRub: 0, planRub: 0, chiefRub: 0, replans: 0, fixes: 0, log: [], counted: [], chat: []};
    if (o.context) e.context = str(o.context, 3000);
    log(e, 'создан'); await save(e);
    await plan(e);
    return e;
  }
  async function issueBody(st, e, remark) {
    const k = chiefKey(st), m = RO.model(st, k), mem = await memFor(e.title + ' ' + e.text, 4);
    return '# Эпик: ' + e.title + '\n\n## Цель\n' + (e.text || e.title) + (e.context ? '\n\n## Контекст\n' + e.context : '') + (mem ? '\n' + mem : '') +
      (remark ? '\n\n## Замечание владельца к прошлому плану\n' + remark + (e.plan ? '\n\nПрошлый план (кратко): ' + e.plan.summary + '\n' + e.plan.tasks.map(t => '- ' + t.key + ' ' + t.title).join('\n') : '') : '') +
      '\n\n---\nГлавный инженер: **' + m.name + '** — план задачами (JSON) для Штаба.\n<!-- hq-node:' + e.id + ' -->\n' + hqModel(st, k);
  }
  async function plan(e, remark) {
    const st = await settings();
    setStatus(e, 'planning', remark ? 'переплан' : '');
    const body = await issueBody(st, e, remark), labels = ['исп:' + chiefKey(st)];
    if (e.issue) {
      await gh('/issues/' + e.issue, {method: 'PATCH', body: JSON.stringify({state: 'open', body, labels})});
    } else {
      const i = await gh('/issues', {method: 'POST', body: JSON.stringify({title: 'Эпик: ' + e.title.slice(0, 110), body, labels})});
      e.issue = i.number; e.url = i.html_url;
    }
    /* метка «эпик» — отдельным шагом: workflow запускается на labeled и видит готовое описание */
    await gh('/issues/' + e.issue + '/labels', {method: 'POST', body: JSON.stringify({labels: ['эпик']})});
    await save(e);
    await feed('hq', '🧭 Эпик «' + e.title + '»: Главный инженер (' + RO.model(st, chiefKey(st)).name + ') изучает код и пишет план. Обычно 5–15 минут.', {node: e.id, links: [{l: 'эпик', u: e.url}]});
  }

  /* B3: план из комментария Цеха → проверка → карточка в ленте (B4) */
  async function syncPlan(e) {
    const st = await settings(), cs = await gh('/issues/' + e.issue + '/comments?per_page=100');
    e.counted = e.counted || [];
    for (const c of cs) {
      if (e.counted.includes(c.id)) continue;
      const m = /<!-- hq:(\{[\s\S]*?\}) -->/.exec(c.body || '');
      if (m) { try { const x = JSON.parse(m[1]); e.planRub = r2((e.planRub || 0) + (+x.rub || 0)); await ctx.spend(+x.rub || 0); } catch (err) {} }
      e.counted.push(c.id);
      const raw = planFrom(c.body);
      if (raw) {
        const v = validatePlan(raw);
        if (!v.ok) { await planFailed(e, v.errors); return; }
        e.plan = v.plan;
        e.estimate = r2(v.plan.tasks.reduce((s, t) => s + estimate(st, execOf(st, t), t.kind), 0));
        e.budgetRub = r2(Math.max(e.estimate * 1.5, 1));
        setStatus(e, 'review', 'план готов'); await save(e); await feedPlan(st, e); return;
      }
      if (/<!-- hq-plan-fail -->/.test(c.body || '')) { await planFailed(e, [str(c.body.replace(/<!--[\s\S]*?-->/g, ''), 1500)]); return; }
    }
    await save(e);
  }
  async function planFailed(e, errors) {
    setStatus(e, 'paused', 'план не прошёл проверку дважды'); e.question = 'План не прошёл проверку: ' + errors.join('; ').slice(0, 800); await save(e);
    await feed('hq', '⏸ Эпик «' + e.title + '»: Главный инженер дважды написал план с ошибками:\n• ' + errors.slice(0, 8).join('\n• ') + '\nУточни цель и попроси переплан — или останови.',
      {node: e.id, acts: [A('✏️ Переплан', 'epicreplan', {id: e.id}, true), A('Остановить', 'epicstop', {id: e.id})], links: e.url ? [{l: 'эпик', u: e.url}] : []});
  }
  async function feedPlan(st, e) {
    const p = e.plan, idx = Object.fromEntries(p.tasks.map((t, i) => [t.key, i + 1]));
    const lines = p.tasks.map((t, i) => (i + 1) + '. ' + t.title + ' — ' + RO.model(st, execOf(st, t)).name + ', ' + RO.LEVELS[t.level] + (t.core ? ', ядро' : '') +
      (t.deps.length ? ' (после ' + t.deps.map(d => idx[d]).join(', ') + ')' : ''));
    const arch = p.architecture.split('\n').filter(Boolean).slice(0, 6).join('\n');
    await feed('hq', '🧭 План эпика «' + e.title + '»\n' + p.summary + (arch ? '\n\nАрхитектура:\n' + arch : '') + '\n\nЗадачи (' + p.tasks.length + '):\n' + lines.join('\n') +
      (p.questions.length ? '\n\n❓ ' + p.questions.join('\n❓ ') : '') + (p.risks.length ? '\n\nРиски: ' + p.risks.join('; ') : '') +
      '\n\nОценка: ~' + e.estimate + ' ₽, бюджет эпика с запасом — ' + e.budgetRub + ' ₽. План уже стоил ' + r2(e.planRub) + ' ₽.',
      {node: e.id, acts: [A('✅ Утвердить', 'epicok', {id: e.id}, true), A('✏️ Переплан', 'epicreplan', {id: e.id}), A('Отменить', 'epiccancel', {id: e.id})], links: e.url ? [{l: 'эпик', u: e.url}] : []});
  }

  /* B4: утверждение → задачи эпика (узлы task) → running → первый тик */
  async function approve(e) {
    if (e.status !== 'review' || !e.plan) fail(409, 'Утверждать нечего: плана ждёт только эпик на проверке.');
    const st = await settings(), keyId = {}, made = [];
    e.plan.tasks.forEach(t => { keyId[t.key] = id('t'); });
    e.plan.tasks.forEach((t, i) => {
      const n = {id: keyId[t.key], type: 'task', title: t.title, text: t.what.slice(0, 2000), parent: e.id, status: 'ready', ready: true, at: now() + i, chat: [],
        kind: t.kind, level: t.level, core: t.core, model: execOf(st, t), epic: e.id, ekey: t.key, eorder: i + 1, deps: t.deps.map(d => keyId[d]).filter(Boolean),
        spec: {title: t.title, what: t.what, where: t.where, done: t.done, not: t.not, test: t.test}};
      made.push(n);
    });
    for (const n of made) await save(n);
    setStatus(e, 'running', 'утверждён владельцем'); await save(e);
    await feed('hq', '✅ Эпик «' + e.title + '» утверждён: ' + made.length + ' задач, по одной. Пишу сюда о каждой.', {node: e.id});
    await tick();
    return e;
  }

  /* блок «Эпик» в ТЗ задачи: цель, архитектура кратко, что уже сделано */
  function epicBlock(e, tasks) {
    const done = tasks.filter(t => t.status === 'done');
    return '## Эпик: ' + e.title + '\nЦель: ' + (e.text || e.title).slice(0, 600) + '\nАрхитектура (кратко): ' + ((e.plan && e.plan.architecture) || '').split('\n').slice(0, 4).join(' ').slice(0, 700) +
      '\nЧто уже сделано: ' + (done.length ? '\n' + done.map(t => '- ' + t.title + ': ' + String(t.report || (t.log || '').split('\n')[0] || 'влито').replace(/\s+/g, ' ').slice(0, 160)).join('\n') : 'это первая задача эпика.');
  }

  async function pause(e, why, text, acts) {
    setStatus(e, 'paused', why); await save(e);
    await feed('hq', '⏸ Эпик «' + e.title + '»: ' + text, {node: e.id, acts: acts || [A('▶ Продолжить', 'epicresume', {id: e.id}, true), A('Остановить', 'epicstop', {id: e.id})]});
  }

  /* B5: один тик планировщика для каждого эпика в работе; плюс планы, которые ждут Цех */
  async function tick() {
    const all = await store.scan('hqnodes', n => n.type === 'epic');
    const out = [];
    for (const e of all.filter(x => x.status === 'planning' && x.issue)) { try { await syncPlan(e); } catch (err) { out.push(e.id + ': ' + err.message); } }
    for (const e0 of all.filter(x => x.status === 'running')) {
      const e = await getNode(e0.id);
      try { out.push(e.id + ': ' + await step(e)); } catch (err) { out.push(e.id + ': ' + err.message); if (err.status === 402) await pause(e, 'лимит месяца', err.message, [A('▶ Продолжить', 'epicresume', {id: e.id}, true)]); }
    }
    return out;
  }
  async function step(e) {
    const st = await settings(), tasks = await tasksOf(e);
    e.spentRub = r2((e.planRub || 0) + (e.chiefRub || 0) + tasks.reduce((s, t) => s + (t.rub || 0), 0));
    /* 1. бюджет */
    if (e.budgetRub && e.spentRub >= e.budgetRub) {
      await pause(e, 'бюджет', 'бюджет эпика исчерпан — потрачено ' + e.spentRub + ' ₽ из ' + e.budgetRub + ' ₽. Готово ' + tasks.filter(t => t.status === 'done').length + ' из ' + tasks.length + '.',
        [A('Добавить 50 %', 'epicbudget', {id: e.id}, true), A('Остановить', 'epicstop', {id: e.id})]);
      return 'бюджет';
    }
    /* 2. задачи — по одной */
    if (tasks.some(t => t.status === 'running')) { await save(e); return 'в работе'; }
    if (tasks.some(t => t.status === 'review')) { await save(e); return 'ждёт проверки владельца'; }
    /* 6–7. провал или откат → разбор Главным инженером */
    const bad = tasks.find(t => t.status === 'failed' || t.status === 'rolled');
    if (bad) return analyze(st, e, bad, tasks);
    /* 3. следующая по порядку плана, у которой все deps готовы */
    const done = new Set(tasks.filter(t => t.status === 'done').map(t => t.id)), ids = new Set(tasks.map(t => t.id));
    const next = tasks.find(t => ['new', 'ready', 'assigned'].includes(t.status) && (t.deps || []).every(d => done.has(d) || !ids.has(d)));
    if (!next) {
      if (tasks.length && tasks.every(t => t.status === 'done')) return accept(st, e, tasks);
      await pause(e, 'застрял', 'ни одну задачу нельзя запустить: ждут предшественников, которых нет. Посмотри план.'); return 'застрял';
    }
    /* 4–5. блок эпика в ТЗ, исполнитель по штату (ядро — Главный инженер), запуск обычным путём Цеха */
    next.spec = Object.assign({}, next.spec || {title: next.title, what: next.text}, {epic: epicBlock(e, tasks)});
    next.model = execOf(st, next); await save(next);
    const r = await inner('POST /api/hq/run', {id: next.id, model: next.model, restart: !!next.issue});
    const pos = tasks.indexOf(next) + 1;
    log(e, 'запущена ' + pos + '/' + tasks.length + ' «' + next.title + '»'); await save(e);
    await feed('hq', '⚙️ Эпик «' + e.title + '»: задача ' + pos + ' из ' + tasks.length + ' «' + next.title + '» → Цех, исполнитель ' + RO.model(st, next.model).name + (next.core ? ' (ядро)' : '') + '.',
      {node: next.id, links: r.node && r.node.url ? [{l: 'задача', u: r.node.url}] : []});
    return 'запущена ' + next.id;
  }

  /* B5.6: разбор провала: retry | split | reorder | ask; ≤ 2 на задачу, ≤ 5 на эпик */
  async function analyze(st, e, t, tasks) {
    t.fixes = t.fixes || 0;
    if (t.fixes >= MAX_TASK_FIX || (e.fixes || 0) >= MAX_EPIC_FIX) {
      e.askTask = t.id;
      await pause(e, 'лимит разборов', 'задача «' + t.title + '» не получилась ' + (t.fixes + 1) + ' раз' + ((e.fixes || 0) >= MAX_EPIC_FIX ? ', а разборов на эпик уже ' + e.fixes : '') +
        '. Нужна твоя помощь: уточни, что сделать, и нажми «Продолжить» — или останови эпик.' + (t.log ? '\nПоследнее: ' + t.log.split('\n')[0].slice(0, 300) : ''));
      return 'лимит разборов';
    }
    const k = chiefKey(st), logTail = String(t.log || '').slice(-3000);
    const r = await askJson(st, k, {system: P.CHIEF_FAIL, max: 6000, timeout: 55000,
      messages: [{role: 'user', content: 'Цель эпика: ' + e.title + '\n' + (e.text || '') + '\n\nАрхитектура: ' + ((e.plan && e.plan.architecture) || '') +
        '\n\nЗадачи эпика (key — статус — заголовок):\n' + tasks.map(x => x.ekey + ' — ' + x.status + ' — ' + x.title).join('\n') +
        '\n\nПровалилась (' + (t.status === 'rolled' ? 'откачена после выкатки' : 'тесты или исполнители') + '): ' + t.ekey + '\nТЗ:\n' + P.specText(t.spec) +
        '\n\nИсполнитель: ' + (t.model || '?') + '\nКонец лога попыток и замечания ревизора:\n' + (logTail || 'нет')}]});
    const d = r.data || {}; e.chiefRub = r2((e.chiefRub || 0) + r.rub); e.fixes = (e.fixes || 0) + 1; t.fixes++;
    const why = str(d.why, 400);
    if (d.decision === 'split' && Array.isArray(d.tasks) && d.tasks.length >= 2) {
      const parts = d.tasks.slice(0, 3).map(normTask), keyId = {}, made = [];
      parts.forEach(p => { keyId[p.key] = id('t'); });
      parts.forEach((p, i) => made.push({id: keyId[p.key], type: 'task', title: p.title || t.title + ' — часть ' + (i + 1), text: p.what.slice(0, 2000), parent: e.id, status: 'ready', ready: true,
        at: now() + i, chat: [], kind: p.kind, level: p.level, core: p.core, epic: e.id, ekey: t.ekey + '.' + (i + 1), eorder: (t.eorder || 0) + (i + 1) / 10, model: execOf(st, p),
        deps: (t.deps || []).concat(p.deps.map(x => keyId[x]).filter(Boolean)), spec: {title: p.title, what: p.what, where: p.where || (t.spec && t.spec.where) || '', done: p.done, not: p.not, test: p.test}}));
      for (const n of made) await save(n);
      /* кто ждал разбитую задачу — теперь ждёт все её части */
      for (const x of tasks) if ((x.deps || []).includes(t.id)) { x.deps = x.deps.filter(y => y !== t.id).concat(made.map(m => m.id)); await save(x); }
      t.status = 'archived'; await save(t);
      log(e, 'разбор «' + t.title + '»: split на ' + made.length + ' — ' + why); await save(e);
      await feed('hq', '🔧 Главный инженер разобрал провал «' + t.title + '»: ' + why + '\nРазбил на ' + made.length + ': ' + made.map(m => '«' + m.title + '»').join(', ') + '.', {node: e.id});
    } else if (d.decision === 'reorder' && tasks.find(x => x.ekey === str(d.first, 24) && x.id !== t.id && x.status !== 'done')) {
      const first = tasks.find(x => x.ekey === str(d.first, 24));
      t.deps = [...new Set((t.deps || []).concat(first.id))]; t.status = 'ready'; await save(t);
      log(e, 'разбор «' + t.title + '»: сначала ' + first.ekey + ' — ' + why); await save(e);
      await feed('hq', '🔧 Главный инженер: «' + t.title + '» — сначала нужна «' + first.title + '». ' + why, {node: e.id});
    } else if (d.decision === 'ask') {
      t.status = 'ready'; await save(t); e.askTask = t.id; e.question = str(d.question, 800);
      await pause(e, 'вопрос владельцу', 'Главный инженер спрашивает по задаче «' + t.title + '»:\n' + (e.question || why) + '\nОтветь кнопкой «Продолжить» (можно с текстом) — или останови.');
      return 'вопрос';
    } else {   /* retry (и всё непонятное) — уточнённое ТЗ, при необходимости исполнитель посильнее */
      if (d.spec && typeof d.spec === 'object') { const s = normTask(Object.assign({title: t.title, where: t.spec && t.spec.where, test: t.spec && t.spec.test}, d.spec));
        t.spec = {title: s.title, what: s.what || (t.spec && t.spec.what) || '', where: s.where, done: s.done.length ? s.done : (t.spec && t.spec.done) || [], not: s.not, test: s.test}; }
      const mk = str(d.model, 24); if (mk && RO.model(st, mk)) { t.model = mk; t.forced = mk; }
      t.status = 'ready'; await save(t);
      log(e, 'разбор «' + t.title + '»: retry' + (t.forced ? ' (' + t.forced + ')' : '') + ' — ' + why); await save(e);
      await feed('hq', '🔧 Главный инженер разобрал провал «' + t.title + '»: ' + why + '\nУточнил ТЗ' + (t.forced ? ', исполнитель — ' + RO.model(st, t.forced).name : '') + ', запускаю снова.', {node: e.id});
    }
    return 'разбор';
  }

  /* B6: приёмка — полная проверка main зелёная (не раньше последнего слияния) → Главный инженер сверяет цель → done */
  async function accept(st, e, tasks) {
    const lastDone = Math.max(...tasks.map(t => t.doneAt || 0));
    let run = null; try { run = ((await gh('/actions/workflows/check.yml/runs?branch=main&per_page=1')).workflow_runs || [])[0] || null; } catch (err) {}
    const runAt = run ? Date.parse(run.created_at) || 0 : 0;
    if (!run || runAt < lastDone - 60e3) {
      if (!e.checkAsked || now() - e.checkAsked > 3600e3) { e.checkAsked = now(); try { await gh('/actions/workflows/check.yml/dispatches', {method: 'POST', body: JSON.stringify({ref: 'main'})}); } catch (err) {} log(e, 'запросил полную проверку main'); }
      await save(e); return 'жду полную проверку main';
    }
    if (run.status !== 'completed') { await save(e); return 'полная проверка main идёт'; }
    if (run.conclusion !== 'success') {
      if (e.fixRun === run.id) { await save(e); return 'main красный, починка уже есть'; }
      e.fixRun = run.id;
      const n = {id: id('t'), type: 'task', title: 'Починить main после эпика', text: 'Полная проверка main красная', parent: e.id, status: 'ready', ready: true, at: now(), chat: [],
        kind: 'code', level: 'complex', core: false, epic: e.id, ekey: 'fix' + ((e.fixes || 0) + 1), eorder: Math.max(...tasks.map(t => t.eorder || 0)) + 1, deps: [], model: st.staff.code.complex,
        spec: {title: 'Починить main после эпика «' + e.title + '»', what: 'Полная проверка сайта на main красная после задач эпика. Найди причину по логу (команда CI: ' + run.id + ') и исправь код.',
          where: 'по логу проверки', done: ['полная проверка main зелёная'], not: ['не отключать и не ослаблять проверки, не править tests/baseline.json'], test: 'node tests/run.js — затронутые блоки'}};
      await save(n); log(e, 'main красный → задача «Починить main»'); await save(e);
      await feed('hq', '🚨 Эпик «' + e.title + '»: все задачи влиты, но полная проверка main красная. Добавил задачу «Починить main».', {node: e.id, links: run.html_url ? [{l: 'проверка', u: run.html_url}] : []});
      return 'починка main';
    }
    /* сверка критериев цели по отчётам задач — коротко, без чтения кода */
    let verdict = {ok: true, summary: '', missing: []};
    try {
      const r = await askJson(st, chiefKey(st), {system: P.CHIEF_ACCEPT, max: 1500, timeout: 55000, messages: [{role: 'user', content: 'Цель: ' + e.title + '\n' + (e.text || '') + '\n\nСделано:\n' +
        tasks.map(t => '- ' + t.title + ': ' + String(t.report || t.log || '').replace(/\s+/g, ' ').slice(0, 300)).join('\n')}]});
      e.chiefRub = r2((e.chiefRub || 0) + r.rub); verdict = Object.assign(verdict, r.data || {});
    } catch (err) { verdict.summary = 'сверку не провёл: ' + err.message; }
    e.spentRub = r2((e.planRub || 0) + (e.chiefRub || 0) + tasks.reduce((s, t) => s + (t.rub || 0), 0));
    e.verdict = {ok: verdict.ok !== false, summary: str(verdict.summary, 800), missing: list(verdict.missing, 6)};
    setStatus(e, 'done', 'приёмка'); e.doneAt = now(); await save(e);
    const prs = tasks.filter(t => t.pr).map((t, i) => ({l: 'PR ' + (i + 1), u: t.pr}));
    await feed('hq', '🏁 Эпик «' + e.title + '» готов.\n' + tasks.map(t => '✅ ' + t.title + ' — ' + (t.model || '?') + ', ' + r2(t.rub) + ' ₽').join('\n') +
      '\n\nСтоило ' + e.spentRub + ' ₽ (план ' + r2(e.planRub) + ', Главный инженер ' + r2(e.chiefRub) + ', задачи ' + r2(e.spentRub - (e.planRub || 0) - (e.chiefRub || 0)) + ') из бюджета ' + e.budgetRub + ' ₽.' +
      (e.verdict.summary ? '\nГлавный инженер: ' + e.verdict.summary : '') + (e.verdict.missing.length ? '\n⚠️ Не хватает: ' + e.verdict.missing.join('; ') : ''),
      {node: e.id, links: prs.slice(0, 30)});
    return 'готово';
  }

  /* кнопки ленты */
  async function act(op, a) {
    const e = await getNode(a.id); if (e.type !== 'epic') fail(400, 'Это не эпик.');
    if (op === 'epicok') return approve(e);
    if (op === 'epicreplan') {
      const remark = str(a.text, 2000);
      if (e.status === 'review' || e.status === 'paused') setStatus(e, 'draft', 'замечание владельца');
      else fail(409, 'Переплан — только для плана на проверке или эпика на паузе.');
      e.replans = (e.replans || 0) + 1; await plan(e, remark || 'перепиши план точнее'); return e;
    }
    if (op === 'epiccancel') { setStatus(e, 'archived', 'отменён владельцем'); await save(e); await feed('hq', 'Эпик «' + e.title + '» отменён.', {node: e.id}); return e; }
    if (op === 'epicbudget') { e.budgetRub = r2((e.budgetRub || 0) * 1.5); setStatus(e, 'running', 'бюджет +50 %'); await save(e);
      await feed('hq', 'Бюджет эпика «' + e.title + '» — ' + e.budgetRub + ' ₽. Продолжаю.', {node: e.id}); await tick(); return e; }
    if (op === 'epicstop') { setStatus(e, 'failed', 'остановлен владельцем'); await save(e); await feed('hq', '⏹ Эпик «' + e.title + '» остановлен. Сделанное осталось на сайте.', {node: e.id}); return e; }
    if (op === 'epicresume') {
      const ans = str(a.text, 2000);
      if (e.askTask) { const t = await store.get('hqnodes', e.askTask);
        if (t) { if (ans) t.spec = Object.assign({}, t.spec, {what: ((t.spec && t.spec.what) || '') + '\n\nОтвет владельца: ' + ans}); t.fixes = 0; if (['failed', 'rolled'].includes(t.status)) t.status = 'ready'; await save(t); } }
      if ((e.fixes || 0) >= MAX_EPIC_FIX) e.fixes = MAX_EPIC_FIX - 1;   /* владелец помог — ещё один разбор можно */
      e.askTask = null; e.question = null; setStatus(e, 'running', 'владелец: продолжить' + (ans ? ' — ' + ans.slice(0, 200) : '')); await save(e);
      await feed('hq', '▶ Эпик «' + e.title + '» продолжается.', {node: e.id}); await tick(); return e;
    }
    fail(400, 'Нет такого действия.');
  }

  return {create, tick, act, approve, syncPlan, epicBlock, FLOW};
}

module.exports = {validatePlan, planFrom, epics, FLOW, MAX_TASK_FIX, MAX_EPIC_FIX};
