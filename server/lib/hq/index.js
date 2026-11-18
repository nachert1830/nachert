/* Штаб владельца — конвейер «мысль → задача → исполнитель → сайт». Только для админа (маршруты D в lib/app.js).
   1. Диктовка → POST /api/hq/dump: Аналитик раскладывает монолог на стратегию, цели, задачи, идеи и балабольство (узлы карты).
   2. POST /api/hq/chat: Продакт обсуждает задачу с владельцем и пишет ТЗ.
   3. POST /api/hq/assign: Диспетчер оценивает вид и сложность → исполнитель из штатного расписания (владелец может сменить).
   4. POST /api/hq/run: текст и исследование — пишет модель здесь же; картинка — генератор, файл кладётся в репозиторий (img/hq/);
      код — Issue с метками «цех» и «исп:<модель>» → Цех (.github/workflows/hq-work.yml): ветка, тесты, эскалация, PR, выкатка.
   5. POST /api/hq/sync: статусы задач Цеха и их стоимость из комментариев (<!-- hq:{…} -->).
   Хранение (закрыто, YDB): config/hq — настройки, config/hqspend-ГГГГ-ММ — траты месяца, hqdumps — монологи, hqnodes — узлы карты.
   В публичный GitHub уходит только утверждённое ТЗ задачи кода (без монолога). Подробно — docs/HQ.md. */
'use strict';
const crypto = require('crypto');
const RO = require('./roster'), P = require('./prompts'), L = require('./llm');

const TYPES = ['strategy', 'goal', 'task', 'idea', 'noise', 'question'];
const STATUS = ['new', 'talk', 'ready', 'assigned', 'running', 'review', 'done', 'failed', 'rolled', 'archived'];
const id = p => p + crypto.randomBytes(6).toString('base64url');
const clean = (s, n) => String(s == null ? '' : s).replace(/\u0000/g, '').trim().slice(0, n || 400);
const month = t => new Date(t).toISOString().slice(0, 7);

function register(D, o) {
  const R = {};
  const {store, fail, body} = o, now = o.now || Date.now, http = o.http || ((...a) => fetch(...a)), env = o.env || {};

  async function settings() { const c = await store.get('config', 'hq'); return RO.settings(c && c.v); }
  async function spent() { const c = await store.get('config', 'hqspend-' + month(now())); return Math.round(((c && c.rub) || 0) * 100) / 100; }
  async function spend(rub) { if (rub > 0) await store.incr('config', 'hqspend-' + month(now()), 'rub', Math.round(rub * 100) / 100, {}); }
  async function guard(st) { const s = await spent(); if (st.budgetRub && s >= st.budgetRub) fail(402, 'Лимит месяца исчерпан: потрачено ' + s + ' ₽ из ' + st.budgetRub + ' ₽. Поднимите лимит в «Сотрудниках».'); }
  function key() { if (!env.key) fail(503, 'На сервере не задан ключ ProxyAPI (PROXYAPI_KEY).'); return env.key; }
  function pick(st, k) { const m = RO.model(st, k); if (!m) fail(400, 'Нет такой модели: ' + k); return m; }

  /* один вызов сотрудника: бюджет → модель → стоимость */
  async function ask(st, k, q) {
    await guard(st); const m = pick(st, k);
    let r; try { r = await L.chat({key: key(), http}, m, q); } catch (e) { fail(e.status || 502, e.message); }
    const rub = RO.cost(m, r.usage, st.rate); await spend(rub);
    return Object.assign(r, {model: k, rub});
  }
  const askJson = async (st, k, q) => { const r = await ask(st, k, q); try { r.data = L.json(r.text); } catch (e) { fail(502, RO.model(st, k).name + ' ответил не в формате JSON — попробуйте ещё раз или смените сотрудника.'); } return r; };

  async function gh(path, opt) {
    if (!env.ghToken || !env.ghRepo) fail(503, 'На сервере не задан токен GitHub (GH_HQ_TOKEN) — Цех и картинки недоступны.');
    const r = await http('https://api.github.com/repos/' + env.ghRepo + path, Object.assign({}, opt, {headers: {authorization: 'Bearer ' + env.ghToken,
      accept: 'application/vnd.github+json', 'user-agent': 'nachert-hq', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json'}}));
    const t = await r.text(); if (!r.ok) fail(502, 'GitHub ' + r.status + ': ' + t.slice(0, 160)); return t ? JSON.parse(t) : {};
  }

  /* ── память Штаба: правила владельца («запомни: …») — всегда; уроки (провалы, откаты, замечания ревизора) и сделанное —
     по похожести на задачу. Подмешивается в ТЗ Цеха и в разговор с продактом: без вызовов моделей, по совпадению слов. */
  const words = t => new Set(String(t || '').toLowerCase().replace(/ё/g, 'е').match(/[a-zа-я0-9]{4,}/g) || []);
  async function memory() { const m = await store.get('config', 'hqmemory'); return (m && m.items) || []; }
  async function memAdd(kind, title, text) {
    const items = await memory(); items.push({at: now(), kind, title: clean(title, 120), text: clean(text, 600)});
    const rules = items.filter(x => x.kind === 'правило'), rest = items.filter(x => x.kind !== 'правило').slice(-200);
    await store.put('config', {id: 'hqmemory', items: rules.slice(-30).concat(rest)});
  }
  async function memFor(text, n) {
    const items = await memory(), w = words(text);
    const scored = items.filter(x => x.kind !== 'правило').map(x => { let k = 0; words(x.title + ' ' + x.text).forEach(t => { if (w.has(t)) k++; }); return [k, x]; })
      .filter(([k]) => k >= 2).sort((a, b) => b[0] - a[0] || b[1].at - a[1].at).slice(0, n || 6).map(([, x]) => x);
    const rules = items.filter(x => x.kind === 'правило');
    if (!rules.length && !scored.length) return '';
    return (rules.length ? '\n## Правила владельца\n' + rules.map(x => '- ' + x.text).join('\n') : '') +
      (scored.length ? '\n## Уроки прошлых задач\n' + scored.map(x => '- [' + x.kind + '] «' + x.title + '»: ' + x.text).join('\n') : '');
  }
  R['POST /api/hq/memory'] = async req => { const b = body(req);
    if (b.op === 'add') await memAdd(b.kind === 'урок' ? 'урок' : 'правило', b.title || 'правило', b.text);
    if (b.op === 'del') { const items = await memory(); items.splice(+b.i, 1); await store.put('config', {id: 'hqmemory', items}); }
    return {ok: true, memory: await memory()}; };

  const nodes = async () => (await store.scan('hqnodes')).filter(n => n.status !== 'archived').sort((a, b) => a.at - b.at);
  const getNode = async nid => { const n = await store.get('hqnodes', String(nid || '')); if (!n) fail(404, 'Нет такого узла.'); return n; };
  const save = n => store.put('hqnodes', n);
  /* узел для ответа: без длинных полей, кроме выбранного */
  const brief = n => ({id: n.id, type: n.type, title: n.title, text: n.text, parent: n.parent || null, status: n.status, kind: n.kind || null, level: n.level || null,
    model: n.model || null, at: n.at, rub: n.rub || 0, issue: n.issue || null, url: n.url || null, ready: !!n.ready, img: n.img || null});

  R['GET /api/hq'] = async () => {
    const [st, s, ns, ds, mem] = await Promise.all([settings(), spent(), nodes(), store.scan('hqdumps'), memory()]);
    const models = RO.catalog(st);
    return {ok: true, settings: st, spent: s, models, roles: RO.ROLES, kinds: RO.KINDS, levels: RO.LEVELS, keys: {proxy: !!env.key, github: !!(env.ghToken && env.ghRepo)}, memory: mem,
      nodes: ns.map(brief), dumps: ds.sort((a, b) => b.at - a.at).slice(0, 30).map(d => ({id: d.id, at: d.at, summary: d.summary, rub: d.rub, model: d.model, questions: d.questions || [], len: (d.text || '').length}))};
  };
  R['GET /api/hq/node'] = async req => ({ok: true, node: await getNode(req.query && req.query.id)});
  R['GET /api/hq/dump'] = async req => { const d = await store.get('hqdumps', String((req.query && req.query.id) || '')); if (!d) fail(404, 'Нет такой записи.'); return {ok: true, dump: d}; };

  R['POST /api/hq/settings'] = async req => {
    const b = body(req), cur = await settings();
    const next = RO.settings(Object.assign({}, cur, b.settings || {}, {custom: Object.assign({}, cur.custom, (b.settings && b.settings.custom) || {})}));
    (b.removeCustom || []).forEach(k => { delete next.custom[k]; });
    await store.put('config', {id: 'hq', v: next}); return {ok: true, settings: RO.settings(next)};
  };

  /* 0. Стенограф: длинная диктовка файлом (до ~3 МБ за кусок; браузер режет запись на куски) */
  R['POST /api/hq/listen'] = async req => {
    const b = body(req, 3.2 * 1024 * 1024), st = await settings();
    if (typeof b.b64 !== 'string' || b.b64.length < 8 || !/^[A-Za-z0-9+\/=]+$/.test(b.b64)) fail(400, 'Нет записи.');
    await guard(st); const k = b.model || st.roles.stenographer, m = pick(st, k); if (!m.stt) fail(400, m.name + ' не распознаёт речь.');
    let r; try { r = await L.speech({key: key(), http}, m, {b64: b.b64, mime: clean(b.mime, 60)}); } catch (e) { fail(e.status || 502, e.message); }
    const rub = Math.round((m.perMin || 0) * Math.max(1, (+b.sec || 60) / 60) * st.rate * 100) / 100; await spend(rub);
    return {ok: true, text: r.text, rub, spent: await spent()};
  };

  /* 1. Аналитик */
  R['POST /api/hq/dump'] = async req => {
    const b = body(req), text = clean(b.text, 60000), st = await settings();
    if (text.length < 20) fail(400, 'Надиктуйте подробнее — хотя бы пару предложений.');
    const ns = await nodes(), have = ns.filter(n => n.type === 'strategy' || n.type === 'goal').map(n => n.id + ' [' + n.type + '] ' + n.title).join('\n') || 'ничего';
    const k = b.model || st.roles.analyst;
    const r = await askJson(st, k, {system: P.ANALYST, max: 6000, timeout: 55000,
      messages: [{role: 'user', content: 'Уже есть:\n' + have + '\n\nМонолог:\n' + text}]});
    const a = r.data || {}, t = now(), did = id('d'), map = {}, made = [];
    const ids = new Set(ns.map(n => n.id));
    const ref = p => p == null ? null : map[p] || (ids.has(p) ? p : null);
    const add = (type, x, parent) => { const n = {id: id(type[0]), type, title: clean(x.title || x, 120), text: clean(x.text, 2000), parent: parent || null,
      status: 'new', at: t + made.length, dumpId: did, kind: RO.KINDS[x.kind] ? x.kind : null, level: RO.LEVELS[x.level] ? x.level : null, chat: []};
      if (!n.title) return null; if (x.key) map[x.key] = n.id; made.push(n); return n; };
    (a.strategy || []).slice(0, 10).forEach(x => add('strategy', x));
    (a.goals || []).slice(0, 30).forEach(x => add('goal', x, ref(x.parent)));
    (a.tasks || []).slice(0, 60).forEach(x => add('task', x, ref(x.parent)));
    (a.ideas || []).slice(0, 30).forEach(x => add('idea', x));
    (a.noise || []).slice(0, 30).forEach(x => add('noise', {title: x}));
    for (const n of made) await save(n);
    const d = {id: did, at: t, text, summary: clean(a.summary, 600), questions: (a.questions || []).slice(0, 3).map(q => clean(q, 300)), model: k, rub: r.rub, made: made.map(n => n.id)};
    await store.put('hqdumps', d);
    return {ok: true, dump: Object.assign({}, d, {text: undefined}), nodes: made.map(brief), rub: r.rub, spent: await spent()};
  };

  /* ручная правка карты: добавить, переименовать, перевесить, сменить тип, в архив */
  R['POST /api/hq/node'] = async req => {
    const b = body(req);
    if (b.op === 'add') { const type = TYPES.includes(b.type) ? b.type : 'task';
      const n = {id: id(type[0]), type, title: clean(b.title, 120), text: clean(b.text, 4000), parent: b.parent || null, status: 'new', at: now(), chat: []};
      if (!n.title) fail(400, 'Нужен заголовок.'); await save(n); return {ok: true, node: brief(n)}; }
    const n = await getNode(b.id);
    if (b.op === 'archive') { n.status = 'archived'; await save(n); return {ok: true}; }
    if (b.title != null) n.title = clean(b.title, 120) || n.title;
    if (b.text != null) n.text = clean(b.text, 4000);
    if (b.type && TYPES.includes(b.type)) n.type = b.type;
    if (b.parent !== undefined) n.parent = b.parent && b.parent !== n.id ? String(b.parent) : null;
    if (b.status && STATUS.includes(b.status)) n.status = b.status;
    if (b.kind && RO.KINDS[b.kind]) n.kind = b.kind;
    if (b.level && RO.LEVELS[b.level]) n.level = b.level;
    if (b.model !== undefined) { if (b.model && !RO.model(await settings(), b.model)) fail(400, 'Нет такой модели.'); n.model = b.model || null; }
    await save(n); return {ok: true, node: brief(n)};
  };

  /* 2. Продакт: диалог по задаче → ТЗ */
  R['POST /api/hq/chat'] = async req => {
    const b = body(req), n = await getNode(b.id), st = await settings(), text = clean(b.text, 4000);
    const all = await nodes(), byId = Object.fromEntries(all.map(x => [x.id, x]));
    const chain = []; for (let p = byId[n.parent], i = 0; p && i < 4; p = byId[p.parent], i++) chain.push('[' + p.type + '] ' + p.title + (p.text ? ' — ' + p.text : ''));
    const ctx = 'Задача: ' + n.title + (n.text ? '\n' + n.text : '') + (chain.length ? '\nВыше по карте:\n' + chain.join('\n') : '') +
      (n.spec ? '\nТекущее ТЗ:\n' + JSON.stringify(n.spec) : '') + await memFor(n.title + ' ' + (n.text || ''), 4);
    const hist = (n.chat || []).slice(-12).map(m => ({role: m.r === 'u' ? 'user' : 'assistant', content: m.t}));
    const first = !hist.length;
    const msgs = [{role: 'user', content: ctx + '\n\n' + (text || (first ? 'Сформулируй ТЗ; спроси, если что-то неясно.' : 'Продолжай.'))}];
    const r = await askJson(st, b.model || st.roles.product, {system: P.PRODUCT, max: 3000, messages: hist.length ? [{role: 'user', content: ctx}, {role: 'assistant', content: 'Понял задачу.'}].concat(hist, [{role: 'user', content: text || 'Продолжай.'}]) : msgs});
    const a = r.data || {};
    n.chat = (n.chat || []).concat(text ? [{r: 'u', t: text, at: now()}] : [], [{r: 'a', t: clean(a.reply, 3000) || 'ТЗ обновлено.', at: now(), m: r.model}]).slice(-40);
    if (a.spec && typeof a.spec === 'object') { const s = a.spec;
      n.spec = {title: clean(s.title, 120) || n.title, what: clean(s.what, 3000), where: clean(s.where, 300), done: (s.done || []).slice(0, 12).map(x => clean(x, 300)), not: (s.not || []).slice(0, 8).map(x => clean(x, 300))};
      if (RO.KINDS[s.kind]) n.kind = s.kind; if (RO.LEVELS[s.level]) n.level = s.level; }
    n.ready = !!a.ready; if (['new', 'talk'].includes(n.status)) n.status = n.ready ? 'ready' : 'talk';
    n.rub = Math.round(((n.rub || 0) + r.rub) * 100) / 100;
    const subs = [];
    for (const x of (a.subtasks || []).slice(0, 8)) { if (!b.split) break; const s = {id: id('t'), type: 'task', title: clean(x.title, 120), text: clean(x.text, 2000), parent: n.id, status: 'new', at: now() + subs.length, chat: []}; if (s.title) { await save(s); subs.push(brief(s)); } }
    await save(n);
    return {ok: true, node: n, subtasks: subs, suggested: b.split ? [] : (a.subtasks || []).slice(0, 8).map(x => clean(x.title, 120)), rub: r.rub, spent: await spent()};
  };

  /* 3. Диспетчер */
  R['POST /api/hq/assign'] = async req => {
    const b = body(req), n = await getNode(b.id), st = await settings();
    let kind = n.kind, level = n.level, why = 'вид и сложность заданы вручную', rub = 0;
    if (b.ask !== false || !kind || !level) {
      const r = await askJson(st, st.roles.dispatcher, {system: P.DISPATCHER, max: 400, messages: [{role: 'user', content: P.specText(n.spec) || n.title + '\n' + (n.text || '')}]});
      if (RO.KINDS[r.data.kind]) kind = r.data.kind; if (RO.LEVELS[r.data.level]) level = r.data.level; why = clean(r.data.why, 300); rub = r.rub; }
    kind = kind || 'code'; level = level || 'medium';
    n.kind = kind; n.level = level; n.model = st.staff[kind][level]; n.why = why; n.status = 'assigned';
    n.rub = Math.round(((n.rub || 0) + rub) * 100) / 100; await save(n);
    return {ok: true, node: brief(n), why, rub, spent: await spent()};
  };

  /* 4. Исполнение */
  R['POST /api/hq/run'] = async req => {
    const b = body(req), n = await getNode(b.id), st = await settings();
    if (b.model) { pick(st, b.model); n.model = b.model; }
    const kind = n.kind || 'code', k = n.model || st.staff[kind][n.level || 'medium'], m = pick(st, k);
    const spec = P.specText(n.spec) || ('# ' + n.title + (n.text ? '\n\n' + n.text : ''));
    if (kind === 'text' || kind === 'research') {
      const r = await ask(st, k, {system: P.WRITER, max: 8000, timeout: 55000, effort: kind === 'research' ? 'medium' : 'low', messages: [{role: 'user', content: spec + await memFor(spec, 4)}]});
      n.result = clean(r.text, 60000); n.status = 'review'; n.rub = Math.round(((n.rub || 0) + r.rub) * 100) / 100; n.model = k; await save(n);
      return {ok: true, node: n, rub: r.rub, spent: await spent()};
    }
    if (kind === 'image') {
      await guard(st); if (!m.image) fail(400, m.name + ' не рисует картинки — выберите генератор картинок.');
      let r; try { r = await L.image({key: key(), http}, m, (n.spec && n.spec.what) || n.title + '. ' + (n.text || '')); } catch (e) { fail(e.status || 502, e.message); }
      const rub = Math.round((m.perImage || 0) * st.rate * 100) / 100; await spend(rub);
      const path = 'img/hq/' + n.id + '-' + Date.now().toString(36) + '.png';
      await gh('/contents/' + path, {method: 'PUT', body: JSON.stringify({message: 'Штаб: картинка «' + n.title.slice(0, 60) + '»', content: r.b64})});
      n.img = path; n.status = 'review'; n.model = k; n.rub = Math.round(((n.rub || 0) + rub) * 100) / 100; await save(n);
      return {ok: true, node: n, rub, spent: await spent()};
    }
    /* код → Цех */
    await guard(st);
    const labels = ['цех', 'исп:' + k].concat(st.autoMerge ? ['автовыкатка'] : []);
    const mem = await memFor(spec, 6);
    const bodyMd = spec + (mem ? '\n' + mem : '') + '\n\n---\nИсполнитель: **' + m.name + '** (`' + m.id + '`). Если тесты не пройдут — задача уйдёт сильнее: ' +
      (RO.ESCALATE[k] ? RO.model(st, RO.ESCALATE[k]).name : 'дальше некому, сообщу владельцу') + '.\n<!-- hq-node:' + n.id + ' -->' +
      '\n<!-- hq-model:' + JSON.stringify({key: k, id: m.id, name: m.name, in: m.in, out: m.out, cache: m.cache, rate: st.rate}) + ' -->';
    if (n.issue && b.restart) {
      await gh('/issues/' + n.issue + '/comments', {method: 'POST', body: JSON.stringify({body: 'Перезапуск: исполнитель **' + m.name + '**.'})});
      await gh('/issues/' + n.issue, {method: 'PATCH', body: JSON.stringify({state: 'open', body: bodyMd, labels: labels.filter(x => x !== 'цех')})});
      await gh('/issues/' + n.issue + '/labels', {method: 'POST', body: JSON.stringify({labels: ['цех']})});
    } else {
      const i = await gh('/issues', {method: 'POST', body: JSON.stringify({title: (n.spec && n.spec.title || n.title).slice(0, 120), body: bodyMd, labels: labels.filter(x => x !== 'цех')})});
      /* метку «цех» — отдельным шагом: workflow запускается на labeled и видит уже готовое описание */
      await gh('/issues/' + i.number + '/labels', {method: 'POST', body: JSON.stringify({labels: ['цех']})});
      n.issue = i.number; n.url = i.html_url;
    }
    n.status = 'running'; n.model = k; n.counted = n.counted || []; await save(n);
    return {ok: true, node: brief(n), spent: await spent()};
  };

  /* 4б. Ревизор: проверка текста или картинки по ТЗ (для кода — в Цехе) */
  R['POST /api/hq/review'] = async req => {
    const b = body(req), n = await getNode(b.id), st = await settings();
    if (b.accept) { n.status = 'done'; await save(n); return {ok: true, node: brief(n)}; }
    if (!n.result) fail(400, 'Нечего проверять.');
    const r = await askJson(st, st.roles.reviewer, {system: P.REVIEWER, max: 1500, messages: [{role: 'user', content: 'ТЗ:\n' + P.specText(n.spec) + '\n\nРезультат:\n' + n.result}]});
    n.review = {ok: !!r.data.ok, notes: (r.data.notes || []).slice(0, 10).map(x => clean(x, 300)), m: r.model};
    if (!n.review.ok && n.review.notes.length) await memAdd('урок', n.title, 'ревизор: ' + n.review.notes.join('; ').slice(0, 400));
    n.rub = Math.round(((n.rub || 0) + r.rub) * 100) / 100; await save(n);
    return {ok: true, node: n, rub: r.rub, spent: await spent()};
  };

  /* 5. Статусы Цеха */
  R['POST /api/hq/sync'] = async () => {
    const run = (await nodes()).filter(n => n.issue && (['running', 'failed', 'review'].includes(n.status) || n.rollback || n.status === 'done' && n.pr && now() - (n.doneAt || 0) < 3 * 864e5));   /* выкаченные за 3 дня — вдруг автооткат */
    const out = [];
    for (const n of run.slice(0, 15)) {
      const [i, cs] = await Promise.all([gh('/issues/' + n.issue), gh('/issues/' + n.issue + '/comments?per_page=50')]);
      const names = (i.labels || []).map(l => l.name || l), was = n.status;
      n.counted = n.counted || [];
      for (const c of cs) { const m = /<!-- hq:(\{[\s\S]*?\}) -->/.exec(c.body || ''); if (!m || n.counted.includes(c.id)) continue;
        try { const x = JSON.parse(m[1]); const rub = +x.rub || 0; await spend(rub); n.rub = Math.round(((n.rub || 0) + rub) * 100) / 100; if (x.pr) n.pr = String(x.pr).slice(0, 200); if (x.model) n.model = x.model; } catch (e) {}
        n.counted.push(c.id); }
      const last = cs.filter(c => !/^Перезапуск/.test(c.body || '')).slice(-1)[0];
      n.log = last ? clean((last.body || '').replace(/<!--[\s\S]*?-->/g, ''), 1500) : n.log;
      if (n.type === 'question') { if (names.includes('ответ')) { const a = cs.filter(c => /<!-- hq-answer -->/.test(c.body || '')).slice(-1)[0]; n.result = a ? clean(a.body.replace(/<!--[\s\S]*?-->/g, ''), 8000) : n.log; n.status = 'done'; } else if (names.includes('провал')) n.status = 'failed'; }
      else if (names.includes('откачено')) { n.status = 'rolled'; n.rollback = null; }
      else if (n.rollback) {}
      else if (names.includes('готово')) n.status = 'done'; else if (names.includes('провал')) n.status = 'failed'; else if (names.includes('на-проверку')) n.status = 'review';
      if (n.status === 'done' && was !== 'done') n.doneAt = now();
      await save(n); out.push(brief(n));
      if (n.status !== was) await feedStatus(n);
    }
    await alarms();
    return {ok: true, nodes: out, spent: await spent()};
  };
  /* «Сайт просит»: красная полная проверка main (Issue «main-красный» из check.yml) → в ленту с кнопкой «Починить» — один раз на Issue */
  async function alarms() {
    if (!env.ghToken || !env.ghRepo) return;
    let list = []; try { list = await gh('/issues?labels=' + encodeURIComponent('main-красный') + '&state=open&per_page=5'); } catch (e) { return; }
    const seen = ((await store.get('config', 'hqseen')) || {ids: []}).ids;
    for (const i of list.filter(x => !x.pull_request && !seen.includes(x.number))) {
      await feed('hq', '🚨 Сайт просит: полная проверка main красная.\n' + clean((i.body || '').split('```')[1] || i.body, 600), {acts: [A('🛠 Починить', 'fixmain', {issue: i.number}, true)], links: [{l: 'подробно', u: i.html_url}]});
      seen.push(i.number); }
    await store.put('config', {id: 'hqseen', ids: seen.slice(-200)});
  }
  /* ── Разговор: лента, Секретарь, действия ─────────────────────────────────────────────────────────────────────────
     Владелец говорит в одну ленту. Секретарь (дешёвая модель) понимает, что сказано: новые мысли → Аналитик; ответ на вопрос
     продакта → Продакт этой задачи; «запускай» → Диспетчер и исполнитель; «что там» → статусы Цеха; «откати» → откат выкатки.
     Ответы Штаба — записи ленты с кнопками (op), кнопки идут в POST /api/hq/act. Лента — таблица hqfeed. */
  const inner = (k, b, q) => R[k]({body: JSON.stringify(b || {}), headers: {'content-type': 'application/json'}, query: q || {}});
  let seq = 0;
  async function feed(who, text, x) {
    const t = now(), f = Object.assign({id: 'f' + String(t).padStart(15, '0') + '-' + (seq++ % 1000).toString().padStart(3, '0'), at: t, who, text: clean(text, 4000)}, x || {});
    await store.put('hqfeed', f); return f;
  }
  const A = (l, op, a, main) => ({l, op, a: a || {}, main: !!main});
  /* оценка цены задачи кода до запуска: ~60 тыс. токенов входа (часть — из кэша) и ~8 тыс. выхода; это ориентир, не счёт */
  function estimate(st, k, kind) { const m = RO.model(st, k); if (!m) return 0;
    if (m.image) return Math.round(m.perImage * st.rate * 100) / 100;
    const [i, out] = kind === 'code' ? [60000, 8000] : [4000, 3000];
    return Math.round(((i * (m.in || 0) * (kind === 'code' ? 0.4 : 1)) + out * (m.out || 0)) / 1e6 * st.rate * 100) / 100; }
  const runActs = (st, n) => [A('▶ Запустить', 'run', {id: n.id}, true), A('Сменить исполнителя', 'open', {id: n.id})];
  async function feedReady(st, n) {
    const k = n.model || st.staff[n.kind || 'code'][n.level || 'medium'];
    return feed('hq', 'ТЗ готово: «' + (n.spec && n.spec.title || n.title) + '». ' + RO.KINDS[n.kind || 'code'] + ', ' + RO.LEVELS[n.level || 'medium'] +
      '. Исполнитель — ' + RO.model(st, k).name + ', оценка ~' + estimate(st, k, n.kind || 'code') + ' ₽.', {node: n.id, acts: runActs(st, n)});
  }
  async function feedStatus(n) {
    if (n.type === 'task') {
      if (n.status === 'failed') await memAdd('урок', n.title, 'не вышло (' + (n.model || '?') + '): ' + String(n.log || '').replace(/\s+/g, ' ').slice(0, 400));
      else if (n.status === 'rolled') await memAdd('урок', n.title, 'выкатку пришлось откатить — сломала сайт; ' + String(n.log || '').replace(/\s+/g, ' ').slice(0, 300));
      else if (n.status === 'done') await memAdd('сделано', n.title, (n.spec && n.spec.what ? n.spec.what.slice(0, 200) + '; ' : '') + 'исполнитель ' + (n.model || '?') + ', ' + (n.rub || 0) + ' ₽');
    }
    if (n.type === 'question') {
      if (n.status === 'done') return feed('hq', '💡 Ответ на «' + n.title + '»:\n' + (n.result || ''), {node: n.id, acts: [A('Сделать задачей', 'totask', {id: n.id}, true)], links: [n.url && {l: 'подробно', u: n.url}].filter(Boolean)});
      if (n.status === 'failed') return feed('hq', '❌ Не нашёл ответ на «' + n.title + '». ' + (n.log || ''), {node: n.id});
      return; }
    const T = {done: '✅ Готово: «' + n.title + '»' + (n.pr ? ' — на сайте.' : '.'), failed: '❌ Не получилось: «' + n.title + '». ' + (n.log ? n.log.split('\n')[0] : ''),
      review: '🔍 Проверь: «' + n.title + '».', rolled: '↩️ Откатил: «' + n.title + '». Сайт как до выкатки.', running: '⚙️ В работе: «' + n.title + '».'};
    if (!T[n.status]) return;
    const acts = n.status === 'failed' ? [A('↻ Перезапустить сильнее', 'run', {id: n.id, stronger: true}, true), A('Открыть', 'open', {id: n.id})]
      : n.status === 'done' && n.pr ? [A('↩️ Откатить', 'rollback', {id: n.id})] : n.status === 'review' ? [A('Принять ✓', 'accept', {id: n.id}, true), A('Открыть', 'open', {id: n.id})] : [];
    await feed('hq', T[n.status] + (n.rub ? ' Стоило ' + n.rub + ' ₽.' : ''), {node: n.id, acts, links: [n.url && {l: 'задача', u: n.url}, n.pr && {l: 'PR', u: n.pr}].filter(Boolean)});
  }

  R['GET /api/hq/feed'] = async req => {
    const after = String((req.query && req.query.after) || ''), all = await store.scan('hqfeed', f => !after || f.id > after);
    return {ok: true, feed: all.sort((a, b) => a.id < b.id ? -1 : 1).slice(-200), spent: await spent()};
  };

  /* действия кнопок и Секретаря: одно место, где шаги конвейера пишут в ленту */
  async function act(op, a) {
    const st = await settings();
    if (op === 'discuss') { const r = await inner('POST /api/hq/chat', {id: a.id, text: a.text || ''}); const n = r.node;
      await feed('hq', (n.chat || []).slice(-1)[0].t, {node: n.id, from: 'product', acts: r.suggested && r.suggested.length ? [A('Разбить на подзадачи', 'split', {id: n.id})] : []});
      if (n.ready) await feedReady(st, n); return r; }
    if (op === 'split') { const r = await inner('POST /api/hq/chat', {id: a.id, text: 'Разбей на подзадачи, как предложил.', split: true});
      await feed('hq', 'Разбил на ' + r.subtasks.length + ': ' + r.subtasks.map(x => '«' + x.title + '»').join(', ') + '.', {node: a.id, acts: r.subtasks.slice(0, 6).map(x => A('Обсудить «' + x.title.slice(0, 30) + '»', 'discuss', {id: x.id}))}); return r; }
    if (op === 'run') { let n = await getNode(a.id);
      if (a.stronger && n.model) { const up = RO.ESCALATE[n.model]; if (up) n.model = up; }
      if (!n.kind || !n.level || !n.model) { await inner('POST /api/hq/assign', {id: n.id, ask: !n.kind || !n.level}); n = await getNode(n.id); }
      const r = await inner('POST /api/hq/run', {id: n.id, model: a.model || n.model, restart: !!n.issue}); const m = RO.model(st, r.node.model);
      if ((n.kind || 'code') === 'code') await feed('hq', '⚙️ Отправил в Цех: «' + n.title + '». Исполнитель — ' + m.name + '. Напишу, когда будет готово.', {node: n.id, links: [{l: 'задача', u: r.node.url}]});
      else await feed('hq', (r.node.img ? '🖼 Нарисовал' : '📝 Написал') + ': «' + n.title + '» (' + m.name + ', ' + r.rub + ' ₽).', {node: n.id, img: r.node.img || null, result: r.node.result ? r.node.result.slice(0, 3000) : null,
        acts: [A('Принять ✓', 'accept', {id: n.id}, true), A('Ревизор, проверь', 'review', {id: n.id}), A('↻ Ещё раз', 'run', {id: n.id})]});
      return r; }
    if (op === 'review') { const r = await inner('POST /api/hq/review', {id: a.id}); const v = r.node.review;
      await feed('hq', 'Ревизор: ' + (v.ok ? '✅ соответствует ТЗ.' : '⚠️ ' + v.notes.join('; ')), {node: a.id, acts: [A('Принять ✓', 'accept', {id: a.id}, true)]}); return r; }
    if (op === 'accept') { const r = await inner('POST /api/hq/review', {id: a.id, accept: true}); await feed('hq', '✅ Принято: «' + r.node.title + '».', {node: a.id}); return r; }
    if (op === 'sync') { const r = await inner('POST /api/hq/sync', {}); if (!r.nodes.length) await feed('hq', 'В Цехе сейчас пусто.'); return r; }
    if (op === 'rollback') { const n = await getNode(a.id); if (!n.issue || !n.pr) fail(400, 'Откатывать нечего: задача ещё не выкатывалась.');
      await gh('/issues/' + n.issue + '/comments', {method: 'POST', body: JSON.stringify({body: 'Откат по просьбе владельца: ' + n.pr})});
      await gh('/issues/' + n.issue, {method: 'PATCH', body: JSON.stringify({state: 'open'})});
      await gh('/issues/' + n.issue + '/labels', {method: 'POST', body: JSON.stringify({labels: ['откат']})});
      n.rollback = now(); await save(n); await feed('hq', '↩️ Откатываю «' + n.title + '»: Цех вернёт сайт как было и прогонит тесты.', {node: n.id}); return {ok: true}; }
    if (op === 'ask') {   /* вопрос про код → исполнитель только читает (hq-work.yml, задание answer) */
      const k = a.model && RO.model(st, a.model) ? a.model : st.staff.research.medium, m = RO.model(st, k);
      const n = {id: id('q'), type: 'question', title: clean(a.text, 120), text: clean(a.text, 4000), status: 'running', at: now(), chat: [], model: k};
      const i = await gh('/issues', {method: 'POST', body: JSON.stringify({title: 'Вопрос: ' + n.title.slice(0, 100), body: n.text + '\n\n---\nОтвечает: **' + m.name + '** (только читает код).\n<!-- hq-node:' + n.id + ' -->\n<!-- hq-model:' + JSON.stringify({key: k, id: m.id, name: m.name, in: m.in, out: m.out, cache: m.cache, rate: st.rate}) + ' -->', labels: ['исп:' + k]})});
      await gh('/issues/' + i.number + '/labels', {method: 'POST', body: JSON.stringify({labels: ['вопрос']})});
      n.issue = i.number; n.url = i.html_url; n.counted = []; await save(n);
      await feed('hq', '🔎 Ищу ответ в коде (' + m.name + '). Напишу сюда, обычно 2–5 минут.', {node: n.id, links: [{l: 'вопрос', u: i.html_url}]}); return {ok: true, node: n}; }
    if (op === 'relay') {   /* реплика владельца по задаче в работе → комментарий в Issue; исполнитель читает их между шагами */
      const n = await getNode(a.id); if (!n.issue) fail(400, 'Задача не в Цехе.');
      await gh('/issues/' + n.issue + '/comments', {method: 'POST', body: JSON.stringify({body: '💬 Владелец: ' + clean(a.text, 2000)})});
      await feed('hq', 'Передал исполнителю «' + n.title + '» — учтёт на следующем шаге.', {node: n.id}); return {ok: true, node: n}; }
    if (op === 'totask') { const q = await getNode(a.id);
      const r = await inner('POST /api/hq/node', {op: 'add', type: 'task', title: q.title.replace(/^почему\s+/i, 'Починить: ').slice(0, 120), text: 'Вопрос: ' + q.text + '\n\nЧто нашлось в коде:\n' + (q.result || '').slice(0, 3000)});
      return act('discuss', {id: r.node.id}); }
    if (op === 'fixmain') { const i = await gh('/issues/' + (+a.issue));
      const r = await inner('POST /api/hq/node', {op: 'add', type: 'task', title: 'Починить красную проверку main', text: clean(i.body, 3800)});
      await inner('POST /api/hq/node', {id: r.node.id, kind: 'code', level: 'complex'});
      const n = await getNode(r.node.id); n.spec = {title: 'Починить красную проверку main', what: 'Полная проверка сайта на main красная. Найди причину по логу и исправь код (не тесты и не baseline, если ошибка настоящая).\n\n' + clean(i.body, 3000), where: 'по логу проверки', done: ['node tests/run.js на затронутых блоках зелёный'], not: ['не отключать и не ослаблять проверки']};
      n.ready = true; n.status = 'ready'; await save(n); await feedReady(st, n); return {ok: true, node: n}; }
    if (op === 'archive') { await inner('POST /api/hq/node', {id: a.id, op: 'archive'}); await feed('hq', 'Убрал в архив.', {node: a.id}); return {ok: true}; }
    fail(400, 'Нет такого действия.');
  }
  R['POST /api/hq/act'] = async req => { const b = body(req); const r = await act(String(b.op || ''), b.a || {}); return {ok: true, node: r && r.node ? brief(r.node) : null, spent: await spent()}; };

  /* Секретарь: одно высказывание владельца → что делать */
  R['POST /api/hq/talk'] = async req => {
    const b = body(req, 200 * 1024), text = clean(b.text, 60000), st = await settings();
    if (text.length < 2) fail(400, 'Скажи что-нибудь.');
    await feed('me', text);
    const ns = await nodes(), tasks = ns.filter(n => n.type === 'task');
    const line = n => n.id + ' «' + n.title + '»';
    const open = tasks.filter(n => n.status === 'talk' && (n.chat || []).length && n.chat[n.chat.length - 1].r === 'a').slice(-6).map(n => line(n) + ' — продакт спросил: ' + n.chat[n.chat.length - 1].t.slice(0, 300));
    const ready = tasks.filter(n => ['ready', 'assigned'].includes(n.status)).slice(-8).map(line);
    const running = tasks.filter(n => n.status === 'running').slice(-8).map(line);
    const review = tasks.filter(n => n.status === 'review').slice(-6).map(line);
    const done = tasks.filter(n => n.status === 'done' && n.pr).slice(-6).map(line);
    const other = tasks.filter(n => ['new', 'talk'].includes(n.status)).slice(-12).map(line);
    const lastF = (await store.scan('hqfeed', f => f.who === 'hq' && f.node)).sort((x, y) => x.id < y.id ? 1 : -1)[0];
    const cur = lastF && tasks.find(n => n.id === lastF.node);
    const state = ['Последняя задача в разговоре (к ней относятся «да», «давай», уточнения без названия задачи):\n' + (cur ? line(cur) + ' — статус: ' + cur.status : 'нет'), 'Ждут ответа владельца:\n' + (open.join('\n') || 'нет'), 'ТЗ готово, не запущены:\n' + (ready.join('\n') || 'нет'), 'В работе:\n' + (running.join('\n') || 'нет'),
      'Ждут проверки владельцем:\n' + (review.join('\n') || 'нет'), 'Выкачены (можно откатить):\n' + (done.join('\n') || 'нет'), 'Прочие задачи:\n' + (other.join('\n') || 'нет')].join('\n\n');
    let dec;
    if (text.length > 1500) dec = {intent: 'thoughts'};     /* длинный монолог — сразу Аналитику, Секретарь не нужен */
    else { const r = await askJson(st, b.model || st.roles.secretary, {system: P.SECRETARY, max: 600, messages: [{role: 'user', content: state + '\n\nВладелец сказал:\n' + text}]}); dec = r.data || {}; }
    const known = id => tasks.some(n => n.id === id);
    const say = async t => t && feed('hq', t);
    try {
      const running = id => tasks.some(n => n.id === id && n.status === 'running' && n.issue);
      if ((dec.intent === 'answer' || dec.intent === 'discuss') && running(dec.node)) { await act('relay', {id: dec.node, text: dec.text || text}); }
      else if (dec.intent === 'answer' && known(dec.node)) { await act('discuss', {id: dec.node, text: dec.text || text}); }
      else if (dec.intent === 'discuss' && known(dec.node)) { await act('discuss', {id: dec.node, text: dec.text || ''}); }
      else if (dec.intent === 'remember') { await memAdd('правило', 'правило', dec.text || text); await say('Запомнил: ' + (dec.text || text)); }
      else if (dec.intent === 'ask') { await act('ask', {text: dec.text || text, model: dec.model}); }
      else if (dec.intent === 'run' && known(dec.node)) { await say(dec.reply); await act('run', {id: dec.node, model: RO.model(st, dec.model) ? dec.model : undefined}); }
      else if (dec.intent === 'accept' && known(dec.node)) { await act('accept', {id: dec.node}); }
      else if (dec.intent === 'rollback' && known(dec.node)) { await act('rollback', {id: dec.node}); }
      else if (dec.intent === 'archive' && known(dec.node)) { await act('archive', {id: dec.node}); }
      else if (dec.intent === 'status') { await say(dec.reply); await act('sync', {}); }
      else if (dec.intent === 'reply') { await say(dec.reply || 'Понял.'); }
      else {
        const r = await inner('POST /api/hq/dump', {text}); const ts = r.nodes.filter(n => n.type === 'task');
        const c = t => r.nodes.filter(n => n.type === t).length;
        await feed('hq', (r.dump.summary ? r.dump.summary + '\n' : '') + 'Разложил: стратегия ' + c('strategy') + ', цели ' + c('goal') + ', задачи ' + ts.length + ', идеи ' + c('idea') + ', балабольство ' + c('noise') + '.' +
          (r.dump.questions.length ? '\n❓ ' + r.dump.questions.join('\n❓ ') : ''), {dump: r.dump.id, acts: [A('🗺 Карта', 'map', {})].concat(ts.slice(0, 6).map((n, i) => A('Обсудить «' + n.title.slice(0, 34) + '»', 'discuss', {id: n.id}, i === 0)))});
      }
    } catch (e) { await feed('hq', '⚠️ ' + (e.message || 'Ошибка')); if (!(e.status >= 400 && e.status < 500)) throw e; }
    return {ok: true, spent: await spent()};
  };

  /* ответы — JSON в формате сервера клуба */
  Object.keys(R).forEach(k => { D[k] = async (req, S) => o.json(200, await R[k](req, S)); });
}

module.exports = {register};
