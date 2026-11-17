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

const TYPES = ['strategy', 'goal', 'task', 'idea', 'noise'];
const STATUS = ['new', 'talk', 'ready', 'assigned', 'running', 'review', 'done', 'failed', 'archived'];
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

  const nodes = async () => (await store.scan('hqnodes')).filter(n => n.status !== 'archived').sort((a, b) => a.at - b.at);
  const getNode = async nid => { const n = await store.get('hqnodes', String(nid || '')); if (!n) fail(404, 'Нет такого узла.'); return n; };
  const save = n => store.put('hqnodes', n);
  /* узел для ответа: без длинных полей, кроме выбранного */
  const brief = n => ({id: n.id, type: n.type, title: n.title, text: n.text, parent: n.parent || null, status: n.status, kind: n.kind || null, level: n.level || null,
    model: n.model || null, at: n.at, rub: n.rub || 0, issue: n.issue || null, url: n.url || null, ready: !!n.ready, img: n.img || null});

  R['GET /api/hq'] = async () => {
    const [st, s, ns, ds] = await Promise.all([settings(), spent(), nodes(), store.scan('hqdumps')]);
    const models = RO.catalog(st);
    return {ok: true, settings: st, spent: s, models, roles: RO.ROLES, kinds: RO.KINDS, levels: RO.LEVELS, keys: {proxy: !!env.key, github: !!(env.ghToken && env.ghRepo)},
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
      (n.spec ? '\nТекущее ТЗ:\n' + JSON.stringify(n.spec) : '');
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
      const r = await ask(st, k, {system: P.WRITER, max: 8000, timeout: 55000, effort: kind === 'research' ? 'medium' : 'low', messages: [{role: 'user', content: spec}]});
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
    const bodyMd = spec + '\n\n---\nИсполнитель: **' + m.name + '** (`' + m.id + '`). Если тесты не пройдут — задача уйдёт сильнее: ' +
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
    n.rub = Math.round(((n.rub || 0) + r.rub) * 100) / 100; await save(n);
    return {ok: true, node: n, rub: r.rub, spent: await spent()};
  };

  /* 5. Статусы Цеха */
  R['POST /api/hq/sync'] = async () => {
    const run = (await nodes()).filter(n => n.issue && ['running', 'failed', 'review'].includes(n.status));
    const out = [];
    for (const n of run.slice(0, 15)) {
      const [i, cs] = await Promise.all([gh('/issues/' + n.issue), gh('/issues/' + n.issue + '/comments?per_page=50')]);
      const names = (i.labels || []).map(l => l.name || l);
      n.counted = n.counted || [];
      for (const c of cs) { const m = /<!-- hq:(\{[\s\S]*?\}) -->/.exec(c.body || ''); if (!m || n.counted.includes(c.id)) continue;
        try { const x = JSON.parse(m[1]); const rub = +x.rub || 0; await spend(rub); n.rub = Math.round(((n.rub || 0) + rub) * 100) / 100; if (x.pr) n.pr = String(x.pr).slice(0, 200); if (x.model) n.model = x.model; } catch (e) {}
        n.counted.push(c.id); }
      const last = cs.filter(c => !/^Перезапуск/.test(c.body || '')).slice(-1)[0];
      n.log = last ? clean((last.body || '').replace(/<!--[\s\S]*?-->/g, ''), 1500) : n.log;
      if (names.includes('готово')) n.status = 'done'; else if (names.includes('провал')) n.status = 'failed'; else if (names.includes('на-проверку')) n.status = 'review';
      await save(n); out.push(brief(n));
    }
    return {ok: true, nodes: out, spent: await spent()};
  };
  /* ответы — JSON в формате сервера клуба */
  Object.keys(R).forEach(k => { D[k] = async (req, S) => o.json(200, await R[k](req, S)); });
}

module.exports = {register};
