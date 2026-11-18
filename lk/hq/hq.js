/* Штаб владельца (nachert1830.ru/lk/hq/). Вход — тот же, что в кабинете (токен lk_tok), API — window.CLUB_API, маршруты /api/hq/*
   (server/lib/hq). Экраны: Диктовка → Карта (стратегия → цели → задачи, идеи, балабольство) → карточка задачи (продакт, диспетчер,
   исполнитель) → Задачи (статусы Цеха) → Сотрудники (кто на каком шаге, бюджет). Подробно — docs/HQ.md. */
(function () {
  'use strict';
  const API = String(window.CLUB_API || '').replace(/\/$/, '');
  const $ = id => document.getElementById(id), esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const tok = () => { try { return localStorage.getItem('lk_tok') || ''; } catch (e) { return ''; } };
  const TYPE = {strategy: 'Стратегия', goal: 'Цель', task: 'Задача', idea: 'Идея', noise: 'Балабольство'};
  const STATUS = {new: 'новая', talk: 'обсуждаем', ready: 'ТЗ готово', assigned: 'назначена', running: 'в работе', review: 'проверить', done: 'готово', failed: 'не вышло', rolled: 'откачено'};
  const ESTATUS = {draft: 'черновик', planning: 'пишет план', review: 'ждёт утверждения', running: 'идёт', paused: 'пауза', done: 'готов', failed: 'остановлен'};
  const S = {data: null, sel: null, node: null, tab: 'chat', last: '', feed: []};

  function req(method, path, body) {
    const h = {authorization: 'Bearer ' + tok()}; if (body) h['content-type'] = 'application/json';
    return fetch(API + path, {method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store'})
      .then(r => r.json().catch(() => ({})).then(j => { if (!r.ok) { const e = new Error(j.error || 'Ошибка ' + r.status); e.status = r.status; throw e; } return j; }));
  }
  const rub = v => (Math.round((+v || 0) * 100) / 100).toLocaleString('ru-RU') + ' ₽';
  const say = (id, t, err) => { const el = $(id); if (el) { el.textContent = t || ''; el.classList.toggle('err', !!err); } };
  const mName = k => { const m = S.data && S.data.models[k]; return m ? m.name : k || '—'; };
  function busy(btn, on, txt) { if (!btn) return; if (on) { btn.dataset.t = btn.textContent; btn.textContent = txt || '…'; btn.disabled = true; } else { btn.textContent = btn.dataset.t || btn.textContent; btn.disabled = false; } }
  function spent(v) { if (v == null || !S.data) return; S.data.spent = v; const b = S.data.settings.budgetRub || 0, f = b ? Math.min(1, v / b) : 0;
    $('bTxt').textContent = rub(v) + (b ? ' из ' + rub(b) : ''); $('bBar').style.width = Math.round(f * 100) + '%';
    $('budget').classList.toggle('warn', f >= .7 && f < 1); $('budget').classList.toggle('over', f >= 1); }

  /* ── загрузка и вход ── */
  function load() {
    if (!API) return gate('Сервер кабинета не настроен (lk/config.js).');
    if (!tok()) return gate('Войди в кабинет как владелец, потом вернись сюда. <a href="../#/login">Войти →</a>');
    return req('GET', '/api/hq').then(d => { S.data = d; $('gate').hidden = true; spent(d.spent); renderAll(); show(S.tab); })
      .catch(e => gate(e.status === 401 ? 'Сессия истекла. <a href="../#/login">Войти снова →</a>' : e.status === 403 ? 'Штаб — только для владельца.' : esc(e.message)));
  }
  function gate(html) { document.body.classList.remove('chat'); $('gate').hidden = false; $('gate').innerHTML = html; document.querySelectorAll('.view').forEach(v => { v.hidden = true; }); }
  function show(tab) { S.tab = tab; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'v-' + tab || !S.data; });
    try { localStorage.setItem('lk_hq_tab', tab); } catch (e) {}
    if (tab === 'map') requestAnimationFrame(links);
    document.body.classList.toggle('chat', tab === 'chat' && !!S.data);
    if (tab === 'chat') pull(true); }
  const toBottom = () => { const f = $('feed'); f.scrollTop = f.scrollHeight; };
  function renderAll() { fillModels(); renderDumps(); renderMap(); renderBoard(); renderStaff(); renderMem(); }

  function opts(filter, cur, extra) {
    const ms = S.data.models; return (extra || '') + Object.keys(ms).filter(k => filter(ms[k])).map(k => '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(ms[k].name) + '</option>').join(''); }
  const isText = m => !m.image && !m.stt, isImg = m => !!m.image;
  function fillModels() { const st = S.data.settings;
    $('anModel').innerHTML = opts(isText, st.roles.analyst); $('dPm').innerHTML = opts(isText, st.roles.product); }

  /* ── диктовка: браузер (живой текст) и файл (Стенограф) ── */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function dictate(btn, area, onState) {
    if (!SR) { btn.hidden = true; return null; }
    let rec = null, on = false, base = '';
    const start = () => { rec = new SR(); rec.lang = 'ru-RU'; rec.continuous = true; rec.interimResults = true; base = area.value;
      rec.onresult = e => { let fin = '', mid = ''; for (let i = 0; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t + ' '; else mid += t; }
        area.value = (base ? base.replace(/\s*$/, ' ') : '') + fin + mid; };
      rec.onend = () => { if (on) { base = area.value; try { start(); } catch (e) { stop(); } } };   /* браузер обрывает после паузы — продолжаем */
      rec.onerror = e => { if (e.error === 'not-allowed') { stop(); say('micHint', 'Нет доступа к микрофону', true); } };
      rec.start(); };
    const stop = () => { on = false; try { rec && rec.stop(); } catch (e) {} onState(false); };
    btn.onclick = () => { if (on) stop(); else { on = true; try { start(); onState(true); } catch (e) { on = false; } } };
    return {stop};
  }
  dictate($('mic'), $('mono'), on => { $('mic').classList.toggle('on', on); $('mic').setAttribute('aria-pressed', on); $('micTxt').textContent = on ? 'Стоп' : 'Говорить';
    say('micHint', on ? 'Слушаю… говори свободно, паузы не страшны' : ''); });
  dictate($('dMic'), $('dSay'), on => { $('dMic').textContent = on ? '⏹' : '🎙'; });
  if (!SR) say('micHint', 'В этом браузере нет живой диктовки — используй «Запись файлом» или клавиатуру.');

  /* запись файлом: куски по 4 минуты → Стенограф (ProxyAPI, распознавание речи) */
  function recorder(btn, area, hint, idle, busyTxt) {
    let mr = null, chunkT = null, on = false;
    btn.onclick = async () => {
      if (on) { on = false; clearTimeout(chunkT); mr && mr.state !== 'inactive' && mr.stop(); btn.classList.remove('on'); btn.textContent = idle; return; }
      if (!window.MediaRecorder) return say(hint, 'Запись в этом браузере недоступна', true);
      let stream; try { stream = await navigator.mediaDevices.getUserMedia({audio: true}); } catch (e) { return say(hint, 'Нет доступа к микрофону', true); }
      on = true; btn.classList.add('on'); btn.textContent = busyTxt;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
      const piece = () => { const parts = [], t0 = Date.now();
        mr = new MediaRecorder(stream, Object.assign({audioBitsPerSecond: 32000}, mime ? {mimeType: mime} : {}));
        mr.ondataavailable = e => e.data.size && parts.push(e.data);
        mr.onstop = () => { const blob = new Blob(parts, {type: mr.mimeType || 'audio/webm'}); if (on) piece(); else stream.getTracks().forEach(t => t.stop()); send(blob, (Date.now() - t0) / 1000); };
        mr.start(); chunkT = setTimeout(() => mr.state !== 'inactive' && mr.stop(), 4 * 60 * 1000); };
      piece(); say(hint, 'Пишу… Стенограф распознает кусками по 4 минуты');
    };
    function send(blob, sec) {
      const fr = new FileReader(); fr.onload = () => { const b64 = String(fr.result).split(',')[1] || ''; say(hint, 'Распознаю ' + Math.round(sec) + ' с…');
        req('POST', '/api/hq/listen', {b64, mime: blob.type, sec}).then(j => { area.value = (area.value ? area.value.replace(/\s*$/, '\n') : '') + j.text; spent(j.spent); say(hint, 'Распознано (' + rub(j.rub) + ')'); })
          .catch(e => say(hint, e.message, true)); };
      fr.readAsDataURL(blob);
    }
  }
  recorder($('rec'), $('mono'), 'micHint', '⏺ Запись файлом', '⏹ Остановить запись');
  recorder($('cRec'), $('say'), 'cHint', '⏺', '⏹');

  /* ── разговор: лента, Секретарь, кнопки ── */
  dictate($('cMic'), $('say'), on => { $('cMic').classList.toggle('on', on); $('cMic').setAttribute('aria-pressed', on); $('cMicTxt').textContent = on ? 'Стоп' : 'Говорить';
    say('cHint', on ? 'Слушаю…' : ''); });
  const tm = t => new Date(t).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
  function item(f) {
    const acts = (f.acts || []).map(a => '<button class="' + (a.main ? 'primary' : 'ghost') + '" data-op="' + esc(a.op) + '" data-a="' + esc(JSON.stringify(a.a || {})) + '">' + esc(a.l) + '</button>').join('');
    return '<div class="fi ' + f.who + (f.from === 'product' ? ' prod' : '') + '" data-fid="' + esc(f.id) + '">' +
      (f.who === 'hq' ? '<span class="who">' + (f.from === 'product' ? 'Продакт' : 'Штаб') + '</span>' : '') + esc(f.text) +
      (f.result ? '<div class="res">' + esc(f.result) + '</div>' : '') +
      (f.img ? '<img alt="" src="https://raw.githubusercontent.com/nachert1830/nachert/main/' + esc(f.img) + '">' : '') +
      ((f.links || []).length ? '<div class="lnk">' + f.links.map(l => '<a href="' + esc(l.u) + '" target="_blank" rel="noopener">' + esc(l.l) + ' ↗</a>').join('') + '</div>' : '') +
      (acts ? '<div class="acts">' + acts + '</div>' : '') + '<time>' + tm(f.at) + '</time></div>';
  }
  function drawFeed() {
    $('feed').innerHTML = S.feed.length ? S.feed.map(item).join('') : '<div class="feedEmpty"><b>Говори — Штаб разберётся</b>Мысли, планы, идеи — разложу по карте. Ответы на вопросы продакта, «запускай», «что там с задачами?», «откати» — тоже сюда.</div>';
    if (S.wait) $('feed').insertAdjacentHTML('beforeend', '<div class="fi hq wait">' + esc(S.wait) + '</div>');
  }
  function pull(scroll) {
    if (!S.data) return Promise.resolve();
    return req('GET', '/api/hq/feed' + (S.last ? '?after=' + encodeURIComponent(S.last) : '')).then(j => {
      if (j.feed.length) { S.feed = S.feed.concat(j.feed).slice(-300); S.last = j.feed[j.feed.length - 1].id; }
      spent(j.spent); if (j.feed.length || scroll) { drawFeed(); toBottom(); }
    }).catch(() => {});
  }
  function talk() {
    const text = $('say').value.trim(); if (!text || S.wait) return;
    $('say').value = ''; S.feed.push({id: 'tmp', who: 'me', text, at: Date.now()}); S.wait = 'Штаб думает…'; drawFeed(); toBottom();
    req('POST', '/api/hq/talk', {text}).then(() => {}).catch(e => { S.feed.push({id: 'tmp', who: 'hq', text: '⚠️ ' + e.message, at: Date.now()}); })
      .then(() => { S.feed = S.feed.filter(f => f.id !== 'tmp'); S.wait = null; return pull(true); }).then(() => reload().catch(() => {}));
  }
  $('cSend').onclick = talk;
  $('say').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); talk(); } };
  $('feed').addEventListener('click', e => {
    const b = e.target.closest('[data-op]'); if (!b) return; e.stopPropagation();
    const op = b.dataset.op, a = JSON.parse(b.dataset.a || '{}');
    if (op === 'map') return show('map');
    if (op === 'open') return openNode(a.id);
    if (op === 'rollback' && !confirm('Откатить выкатку? Сайт вернётся к состоянию до неё.')) return;
    if (op === 'epicreplan') { const t = prompt('Что поправить в плане? Главный инженер перепишет его с этим замечанием.'); if (t == null) return; a.text = t; }
    if (op === 'epicresume') { const t = prompt('Ответ или уточнение для Главного инженера (можно пусто):', ''); if (t == null) return; a.text = t; }
    if ((op === 'epicstop' || op === 'epiccancel') && !confirm(op === 'epicstop' ? 'Остановить эпик? Сделанное останется на сайте.' : 'Отменить эпик?')) return;
    b.disabled = true; S.wait = {discuss: 'Продакт думает…', run: 'Запускаю…', review: 'Ревизор проверяет…', split: 'Разбиваю…', mkepic: 'Отдаю Главному инженеру…', epicok: 'Запускаю эпик…'}[op] || '…'; drawFeed();
    req('POST', '/api/hq/act', {op, a}).catch(e => S.feed.push({id: 'tmp', who: 'hq', text: '⚠️ ' + e.message, at: Date.now()}))
      .then(() => { S.feed = S.feed.filter(f => f.id !== 'tmp'); S.wait = null; return pull(true); }).then(() => reload().catch(() => {}));
  });
  /* новое в ленте — раз в 15 с; задачи в Цехе — статус раз в минуту (смена статуса сама пишет в ленту) */
  setInterval(() => { if (!document.hidden && S.tab === 'chat' && !S.wait) pull(false); }, 15000);
  setInterval(() => { if (!document.hidden && S.data && S.data.nodes.some(n => n.status === 'running' || n.status === 'review' || n.type === 'epic' && n.status === 'planning')) req('POST', '/api/hq/sync', {}).then(() => pull(false)).catch(() => {}); }, 60000);

  /* ── разбор монолога ── */
  $('parse').onclick = () => {
    const text = $('mono').value.trim(); if (text.length < 20) return say('tMsg', 'Надиктуй хотя бы пару предложений', true);
    busy($('parse'), true, 'Аналитик думает…'); say('tMsg', '');
    req('POST', '/api/hq/dump', {text, model: $('anModel').value}).then(j => {
      $('mono').value = ''; spent(j.spent);
      const c = t => j.nodes.filter(n => n.type === t).length;
      $('lastDump').innerHTML = '<div class="dump"><b>Разобрано</b> · ' + esc(mName(j.dump.model)) + ' · ' + rub(j.rub) + '<div>' + esc(j.dump.summary) + '</div>' +
        '<div class="hint">стратегия ' + c('strategy') + ' · цели ' + c('goal') + ' · задачи ' + c('task') + ' · идеи ' + c('idea') + ' · балабольство ' + c('noise') + '</div>' +
        (j.dump.questions || []).map(q => '<div class="q">❓ ' + esc(q) + '</div>').join('') + '<div class="row"><button class="primary" data-go="map">Открыть карту →</button></div></div>';
      return reload();
    }).catch(e => say('tMsg', e.message, true)).then(() => busy($('parse'), false));
  };
  function renderDumps() {
    $('dumps').innerHTML = (S.data.dumps || []).map(d => '<div class="it"><span>' + esc(d.summary || 'без итога') + (d.questions && d.questions.length ? '<br><small>❓ ' + esc(d.questions.join(' · ')) + '</small>' : '') + '</span><small>' +
      new Date(d.at).toLocaleString('ru-RU', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) + ' · ' + rub(d.rub) + '</small></div>').join('') || '<div class="empty">Пока ничего. Нажми «Говорить» и расскажи, что задумал.</div>';
  }
  const reload = () => req('GET', '/api/hq').then(d => { S.data = d; spent(d.spent); renderAll(); if (S.sel) openNode(S.sel, true); });

  /* ── карта ── */
  function card(n) {
    const kids = S.data.nodes.filter(x => x.parent === n.id && x.status !== 'archived').length;
    return '<div class="node' + (S.sel === n.id ? ' sel' : '') + (n.type !== 'strategy' && !n.parent ? ' orphan' : '') + '" data-id="' + esc(n.id) + '" data-type="' + n.type + '" data-parent="' + esc(n.parent || '') + '">' +
      '<div class="t">' + esc(n.title) + '</div>' + (n.text ? '<div class="d">' + esc(n.text) + '</div>' : '') +
      '<div class="b">' + (n.type === 'task' ? '<span class="pill s-' + n.status + '">' + esc(STATUS[n.status] || n.status) + '</span>' : '') +
      (n.kind ? '<span class="pill">' + esc(S.data.kinds[n.kind]) + (n.level ? ' · ' + esc(S.data.levels[n.level]) : '') + '</span>' : '') +
      (n.model && n.type === 'task' ? '<span class="pill">' + esc(mName(n.model)) + '</span>' : '') +
      (kids && n.type !== 'task' ? '<span class="pill">' + kids + ' ↘</span>' : '') + (n.rub ? '<span class="pill cost">' + rub(n.rub) + '</span>' : '') + '</div></div>';
  }
  function renderMap() {
    const all = S.data.nodes, showDone = $('showDone').checked, byId = Object.fromEntries(all.map(n => [n.id, n]));
    const vis = n => showDone || n.status !== 'done';
    /* порядок: цели — под своими стратегиями, задачи — под своими целями (линии короче) */
    const order = t => all.filter(n => n.type === t && vis(n));
    const strat = order('strategy'), sIdx = Object.fromEntries(strat.map((n, i) => [n.id, i]));
    const goals = order('goal').sort((a, b) => (sIdx[a.parent] ?? 1e3) - (sIdx[b.parent] ?? 1e3)), gIdx = Object.fromEntries(goals.map((n, i) => [n.id, i]));
    const tasks = order('task').sort((a, b) => (gIdx[a.parent] ?? (byId[a.parent] ? 500 : 1e3)) - (gIdx[b.parent] ?? (byId[b.parent] ? 500 : 1e3)));
    const put = (col, list, empty) => { document.querySelector('.col[data-col=' + col + '] .stack').innerHTML = list.map(card).join('') || '<div class="empty">' + empty + '</div>'; };
    put('strategy', strat, 'Стратегия появится, когда расскажешь, куда идём'); put('goal', goals, 'Целей пока нет'); put('task', tasks, 'Задач пока нет');
    $('ideas').innerHTML = all.filter(n => n.type === 'idea').map(n => '<span class="chip" data-id="' + esc(n.id) + '" title="' + esc(n.text) + '">' + esc(n.title) + '</span>').join('') || '<span class="hint">—</span>';
    $('noise').innerHTML = all.filter(n => n.type === 'noise').slice(-40).map(n => '<span class="chip" data-id="' + esc(n.id) + '">' + esc(n.title) + '</span>').join('') || '<span class="hint">—</span>';
    if (S.tab === 'map') requestAnimationFrame(links);
  }
  /* линии родитель → ребёнок поверх сетки */
  function links() {
    const svg = $('links'), box = $('map').getBoundingClientRect(); if (!box.width) return;
    let h = ''; document.querySelectorAll('#map .node[data-parent]').forEach(el => {
      const p = el.dataset.parent && document.querySelector('#map .node[data-id="' + CSS.escape(el.dataset.parent) + '"]'); if (!p) return;
      const a = p.getBoundingClientRect(), b = el.getBoundingClientRect();
      const x1 = a.right - box.left, y1 = a.top + a.height / 2 - box.top, x2 = b.left - box.left, y2 = b.top + b.height / 2 - box.top, mx = (x1 + x2) / 2;
      const hot = S.sel && (S.sel === el.dataset.id || S.sel === el.dataset.parent);
      h += '<path' + (hot ? ' class="hot"' : '') + ' d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ',' + mx + ' ' + y2 + ',' + x2 + ' ' + y2 + '"/>'; });
    svg.innerHTML = h;
  }
  window.addEventListener('resize', () => S.tab === 'map' && links());
  $('showDone').onchange = renderMap;
  document.querySelectorAll('[data-add]').forEach(b => { b.onclick = () => {
    const t = prompt(TYPE[b.dataset.add] + ': заголовок'); if (!t) return;
    req('POST', '/api/hq/node', {op: 'add', type: b.dataset.add, title: t}).then(j => reload().then(() => openNode(j.node.id))).catch(e => alert(e.message)); }; });

  /* ── задачи: доска по статусам ── */
  const LANES = [['Обсуждаем', ['new', 'talk']], ['Готово к запуску', ['ready', 'assigned']], ['В работе', ['running']], ['Проверить', ['review']], ['Готово', ['done']], ['Не вышло', ['failed']]];
  function renderEpics() {
    const es = S.data.nodes.filter(n => n.type === 'epic');
    $('epics').innerHTML = es.map(e => { const ts = S.data.nodes.filter(n => n.epic === e.id).sort((a, b) => a.eorder - b.eorder), done = ts.filter(n => n.status === 'done').length;
      return '<div class="epic"><h4>🧭 ' + esc(e.title) + ' <span class="pill s-' + e.status + '">' + esc(ESTATUS[e.status] || e.status) + '</span>' +
        (ts.length ? '<span class="pill">' + done + ' / ' + ts.length + '</span>' : '') + '<span class="pill cost">' + rub(e.spentRub) + (e.budgetRub ? ' из ' + rub(e.budgetRub) : '') + '</span>' +
        (e.url ? '<a href="' + esc(e.url) + '" target="_blank" rel="noopener">план ↗</a>' : '') + '</h4>' +
        (ts.length ? '<div class="prog"><b style="width:' + Math.round(done / ts.length * 100) + '%"></b></div><div class="steps">' + ts.map(card).join('') + '</div>' : '<div class="hint">' + esc(e.text || '') + '</div>') + '</div>'; }).join('');
  }
  function renderBoard() {
    renderEpics();
    const ts = S.data.nodes.filter(n => n.type === 'task');
    $('board').innerHTML = LANES.map(([name, st]) => { const l = ts.filter(n => st.includes(n.status));
      return '<div class="lane"><h4>' + name + ' · ' + l.length + '</h4>' + l.map(card).join('') + '</div>'; }).join('');
    clearInterval(S.poll); if (ts.some(n => n.status === 'running')) S.poll = setInterval(() => sync(true), 60000);
  }
  function sync(quiet) {
    if (!quiet) { busy($('sync'), true, 'Спрашиваю Цех…'); say('sMsg', ''); }
    return req('POST', '/api/hq/sync', {}).then(j => { spent(j.spent); if (!quiet) say('sMsg', j.nodes.length ? 'Обновлено: ' + j.nodes.length : 'Задач в Цехе нет'); return reload(); })
      .catch(e => !quiet && say('sMsg', e.message, true)).then(() => !quiet && busy($('sync'), false));
  }
  $('sync').onclick = () => sync(false);

  /* ── карточка задачи ── */
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]'); if (go) return show(go.dataset.go);
    const t = e.target.closest('#tabs button'); if (t) return show(t.dataset.tab);
    const n = e.target.closest('.node[data-id], .chip[data-id]'); if (n) return openNode(n.dataset.id);
  });
  $('dClose').onclick = $('scrim').onclick = () => { $('drawer').hidden = $('scrim').hidden = true; S.sel = null; renderMap(); };
  function openNode(id, keep) {
    S.sel = id; $('drawer').hidden = $('scrim').hidden = false;
    if (!keep) { $('dChat').innerHTML = '<div class="hint">Загрузка…</div>'; say('dMsg', ''); $('dResult').innerHTML = ''; $('dSubs').innerHTML = ''; }
    req('GET', '/api/hq/node?id=' + encodeURIComponent(id)).then(j => { S.node = j.node; drawNode(); }).catch(e => say('dMsg', e.message, true));
    if (S.tab === 'map') { document.querySelectorAll('#map .node').forEach(el => el.classList.toggle('sel', el.dataset.id === id)); links(); }
  }
  function drawNode() {
    const n = S.node, d = S.data, task = n.type === 'task';
    $('dTitle').value = n.title; $('dText').value = n.text || '';
    $('dType').innerHTML = Object.keys(TYPE).map(k => '<option value="' + k + '"' + (k === n.type ? ' selected' : '') + '>' + TYPE[k] + '</option>').join('');
    const parents = d.nodes.filter(x => x.id !== n.id && (n.type === 'goal' ? x.type === 'strategy' : n.type === 'task' ? x.type === 'goal' || x.type === 'task' : x.type === 'strategy' || x.type === 'goal'));
    $('dParent').innerHTML = '<option value="">— без родителя —</option>' + parents.map(x => '<option value="' + esc(x.id) + '"' + (x.id === n.parent ? ' selected' : '') + '>' + esc(TYPE[x.type] + ': ' + x.title.slice(0, 40)) + '</option>').join('');
    $('dKind').innerHTML = '<option value="">вид?</option>' + Object.keys(d.kinds).map(k => '<option value="' + k + '"' + (k === n.kind ? ' selected' : '') + '>' + d.kinds[k] + '</option>').join('');
    $('dLevel').innerHTML = '<option value="">сложность?</option>' + Object.keys(d.levels).map(k => '<option value="' + k + '"' + (k === n.level ? ' selected' : '') + '>' + d.levels[k] + '</option>').join('');
    $('dKind').hidden = $('dLevel').hidden = !task;
    $('dStatus').textContent = STATUS[n.status] || n.status; $('dStatus').className = 'pill s-' + n.status; $('dCost').textContent = rub(n.rub);
    const sp = n.spec; $('dSpec').innerHTML = sp ? '<h5>ТЗ: ' + esc(sp.title) + (n.ready ? ' <span class="pill s-done">готово к запуску</span>' : '') + '</h5>' + (sp.what ? '<div>' + esc(sp.what) + '</div>' : '') +
      (sp.where ? '<div class="hint">Где: ' + esc(sp.where) + '</div>' : '') + (sp.done && sp.done.length ? '<b>Готово, когда:</b><ul>' + sp.done.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
      (sp.not && sp.not.length ? '<b>Не делать:</b><ul>' + sp.not.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') : '';
    $('dChat').innerHTML = (n.chat || []).map(m => '<div class="bub ' + m.r + '">' + esc(m.t) + (m.m ? '<small>' + esc(mName(m.m)) + '</small>' : '') + '</div>').join('') ||
      (task ? '<div class="hint">Нажми «Обсудить с продактом» — он задаст вопросы и напишет ТЗ. Можно сразу написать, что важно.</div>' : '');
    document.querySelector('.chatin').hidden = document.querySelector('.exec').hidden = !task;
    $('dEpic').hidden = !(task || n.type === 'goal') || !!n.epic;
    const kind = n.kind || 'code', cur = n.model || d.settings.staff[kind][n.level || 'medium'];
    $('dModel').innerHTML = opts(kind === 'image' ? isImg : isText, cur);
    $('dRun').textContent = n.issue || n.result || n.img ? '↻ Перезапустить' : '▶ Запустить';
    let r = '';
    if (n.issue) r += '<div class="result">Цех: <a href="' + esc(n.url) + '" target="_blank" rel="noopener">задача №' + n.issue + '</a>' + (n.pr ? ' · <a href="' + esc(n.pr) + '" target="_blank" rel="noopener">PR</a>' : '') + (n.log ? '\n\n' + esc(n.log) : '\n\nИсполнитель работает. Статус обновится сам раз в минуту.') + '</div>';
    if (n.img) r += '<div class="result"><img alt="" src="https://raw.githubusercontent.com/' + 'nachert1830/nachert/main/' + esc(n.img) + '"><div class="hint">' + esc(n.img) + '</div></div>';
    if (n.result) r += '<div class="result">' + esc(n.result) + '</div>';
    if (n.review) r += '<div class="result">Ревизор: ' + (n.review.ok ? '✅ соответствует ТЗ' : '⚠️ есть замечания') + (n.review.notes || []).map(x => '\n• ' + esc(x)).join('') + '</div>';
    if ((n.result || n.img) && n.status !== 'done') r += '<div class="row">' + (n.result ? '<button class="ghost" id="dRev">Ревизор, проверь</button>' : '') + '<button class="primary" id="dOk">Принять ✓</button></div>';
    $('dResult').innerHTML = r;
    if ($('dRev')) $('dRev').onclick = () => act($('dRev'), 'review', {id: n.id}, 'Проверяет…');
    if ($('dOk')) $('dOk').onclick = () => act($('dOk'), 'review', {id: n.id, accept: true});
  }
  function act(btn, what, body, txt) {
    busy(btn, true, txt); say('dMsg', '');
    return req('POST', '/api/hq/' + what, body).then(j => { if (j.spent != null) spent(j.spent); return j; })
      .then(j => reload().then(() => j)).catch(e => { say('dMsg', e.message, true); return null; }).then(j => { busy(btn, false); return j; });
  }
  const patch = b => req('POST', '/api/hq/node', Object.assign({id: S.node.id}, b)).then(() => reload()).catch(e => say('dMsg', e.message, true));
  $('dTitle').onchange = () => patch({title: $('dTitle').value}); $('dText').onchange = () => patch({text: $('dText').value});
  $('dType').onchange = () => patch({type: $('dType').value}); $('dParent').onchange = () => patch({parent: $('dParent').value || null});
  $('dKind').onchange = () => patch({kind: $('dKind').value}); $('dLevel').onchange = () => patch({level: $('dLevel').value});
  $('dModel').onchange = () => patch({model: $('dModel').value});
  $('dEpic').onclick = () => { if (!confirm('Сделать эпиком? Главный инженер изучит код и разобьёт цель на задачи — план придёт в «Разговор» на утверждение.')) return;
    req('POST', '/api/hq/act', {op: 'mkepic', a: {id: S.node.id}}).then(() => { $('dClose').onclick(); show('chat'); return reload(); }).catch(e => say('dMsg', e.message, true)); };
  $('dArch').onclick = () => { if (confirm('Убрать в архив?')) req('POST', '/api/hq/node', {id: S.node.id, op: 'archive'}).then(() => { $('dClose').onclick(); reload(); }); };
  $('dSend').onclick = () => { const text = $('dSay').value.trim();
    act($('dSend'), 'chat', {id: S.node.id, text, model: $('dPm').value}, 'Продакт думает…').then(j => { if (!j) return; $('dSay').value = '';
      $('dSubs').innerHTML = j.suggested && j.suggested.length ? '<div class="spec"><b>Продакт предлагает разбить:</b><ul>' + j.suggested.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul><button class="ghost" id="dSplit">Разбить на подзадачи</button></div>' : '';
      if ($('dSplit')) $('dSplit').onclick = () => act($('dSplit'), 'chat', {id: S.node.id, text: 'Разбей на подзадачи, как предложил.', split: true, model: $('dPm').value}, 'Разбиваю…'); }); };
  $('dSay').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('dSend').onclick(); };
  $('dAssign').onclick = () => act($('dAssign'), 'assign', {id: S.node.id}, 'Диспетчер оценивает…').then(j => j && say('dMsg', 'Диспетчер: ' + S.data.kinds[j.node.kind] + ', ' + S.data.levels[j.node.level] + ' → ' + mName(j.node.model) + '. ' + (j.why || '')));
  $('dRun').onclick = () => { const n = S.node, kind = n.kind || 'code';
    if (kind === 'code' && !confirm('Отправить в Цех? ТЗ станет публичной задачей на GitHub (без твоих монологов). Исполнитель: ' + mName($('dModel').value))) return;
    act($('dRun'), 'run', {id: n.id, model: $('dModel').value, restart: !!n.issue}, kind === 'code' ? 'Отправляю в Цех…' : kind === 'image' ? 'Рисует…' : 'Пишет…')
      .then(j => j && say('dMsg', kind === 'code' ? 'В Цехе: задача №' + j.node.issue + '. Статус обновляется раз в минуту.' : 'Готово' + (j.rub ? ' · ' + rub(j.rub) : ''))); };

  /* ── сотрудники ── */
  function renderStaff() {
    const d = S.data, st = d.settings;
    $('roles').innerHTML = Object.keys(d.roles).map(r => '<label>' + esc(d.roles[r].name) + ' — ' + esc(d.roles[r].step) + '<select data-role="' + r + '">' +
      opts(r === 'stenographer' ? m => !!m.stt : isText, st.roles[r]) + '</select></label>').join('');
    $('staffT').innerHTML = '<tr><th></th>' + Object.keys(d.levels).map(l => '<th>' + esc(d.levels[l]) + '</th>').join('') + '</tr>' +
      Object.keys(d.kinds).map(k => '<tr><th>' + esc(d.kinds[k]) + '</th>' + Object.keys(d.levels).map(l => '<td><select data-k="' + k + '" data-l="' + l + '">' + opts(k === 'image' ? isImg : isText, st.staff[k][l]) + '</select></td>').join('') + '</tr>').join('');
    $('budgetIn').value = st.budgetRub; $('rateIn').value = st.rate; $('autoIn').checked = !!st.autoMerge;
    $('keys').innerHTML = (d.keys.proxy ? '✅ ключ ProxyAPI на сервере' : '❌ нет ключа ProxyAPI (секрет PROXYAPI_KEY)') + ' · ' + (d.keys.github ? '✅ токен GitHub — Цех и картинки работают' : '❌ нет токена GitHub (секрет GH_HQ_TOKEN) — Цех и картинки недоступны');
    $('catT').innerHTML = '<tr><th>Сотрудник</th><th>Цена, $ за 1 млн токенов</th><th>Для чего</th></tr>' + Object.keys(d.models).map(k => { const m = d.models[k];
      const price = m.image ? '~$' + m.perImage + ' за картинку' : m.stt ? '~$' + m.perMin + ' за минуту' : m.in + ' / ' + m.out + (m.cache != null ? ' · кэш ' + m.cache : '');
      return '<tr><td><b>' + esc(m.name) + '</b><br><small>' + esc(m.id) + '</small> ' + (m.ok ? '<small class="ok">✓ проверена</small>' : '<small class="chk" title="Имя из каталога ProxyAPI, проверится первым вызовом">проверить</small>') +
        (d.settings.custom[k] ? ' <button class="ghost mini" data-del="' + esc(k) + '">убрать</button>' : '') + '</td><td>' + esc(price) + '</td><td>' + esc(m.about) + '</td></tr>'; }).join('');
  }
  function renderMem() {
    const m = (S.data.memory || []).map((x, i) => [x, i]).reverse();
    $('memList').innerHTML = m.map(([x, i]) => '<div class="mi ' + (x.kind === 'правило' ? 'r' : x.kind === 'урок' ? 'l' : 'd') + '"><b>' + esc(x.kind) + '</b><span>' + (x.kind === 'правило' ? '' : '«' + esc(x.title) + '»: ') + esc(x.text) + '</span><button class="ghost mini" data-mdel="' + i + '" title="Забыть">✕</button></div>').join('') || '<div class="hint">Пока пусто.</div>';
  }
  $('memAdd').onclick = () => { const t = $('memIn').value.trim(); if (!t) return; req('POST', '/api/hq/memory', {op: 'add', text: t}).then(j => { $('memIn').value = ''; S.data.memory = j.memory; renderMem(); }); };
  $('memList').onclick = e => { const b = e.target.closest('[data-mdel]'); if (b) req('POST', '/api/hq/memory', {op: 'del', i: +b.dataset.mdel}).then(j => { S.data.memory = j.memory; renderMem(); }); };
  $('saveS').onclick = () => { const st = {roles: {}, staff: {}, budgetRub: +$('budgetIn').value, rate: +$('rateIn').value, autoMerge: $('autoIn').checked};
    document.querySelectorAll('[data-role]').forEach(s => { st.roles[s.dataset.role] = s.value; });
    document.querySelectorAll('[data-k]').forEach(s => { (st.staff[s.dataset.k] = st.staff[s.dataset.k] || {})[s.dataset.l] = s.value; });
    busy($('saveS'), true); req('POST', '/api/hq/settings', {settings: st}).then(() => { say('stMsg', 'Сохранено'); return reload(); }).catch(e => say('stMsg', e.message, true)).then(() => busy($('saveS'), false)); };
  $('cAdd').onclick = () => { const k = $('cKey').value.trim().toLowerCase(), c = {}; c[k] = {id: $('cId').value.trim(), name: $('cName').value.trim(), image: $('cImg').value || undefined, in: +$('cIn').value, out: +$('cOut').value, perImage: $('cImg').value ? 0.05 : 0};
    req('POST', '/api/hq/settings', {settings: {custom: c}}).then(j => { if (!j.settings.custom[k]) throw new Error('Проверь ключ (латиница, 2–24 знака) и имя модели'); say('cMsg', 'Добавлено'); return reload(); }).catch(e => say('cMsg', e.message, true)); };
  $('catT').onclick = e => { const b = e.target.closest('[data-del]'); if (b) req('POST', '/api/hq/settings', {removeCustom: [b.dataset.del]}).then(reload); };

  try { const t = localStorage.getItem('lk_hq_tab'); if (t && $('v-' + t)) S.tab = t; } catch (e) {}
  load();
})();
