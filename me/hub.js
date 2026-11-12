/* Пульт владельца me/: сканер чертежей + кабинет («Мои чертежи», доводка, 3D) + голограмма с жестами + сайт — одна страница.
   Доступ: код владельца проверяет облачная функция сканера (GET ?owner=1, сверка с OWNER_CODE_SHA256 — server/scan/index.js);
   пока сервер не подтвердил, разделы не загружаются. Тот же код пульт отдаёт сканеру кабинета (localStorage scanCode, общий
   с lk/ — одна страница сайта), поэтому сканировать можно сразу.
   Разделы — страницы сайта в iframe того же адреса: они живут, пока открыт пульт (переключение не сбрасывает работу).
   «Руки» — одна камера на весь пульт: кончик указательного — курсор, щипок — нажатие, щипок и вести — перетаскивание
   (в 3D кабинета — вращение) или прокрутка, щипок двумя руками — зум, ладонь 1,5 с — «назад». Распознаёт воркер
   голограммы hands/detector.worker.js (MediaPipe в браузере, видео никуда не уходит), логика жестов — me/pointer.js. */
import { createPointer } from './pointer.js';

const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const API = self.SCAN_API || '';
const SRC = { lk: '../lk/', holo: '../hands/', site: '../' };
let toastT = 0;
function toast(t, ms) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms || 3200); }

/* ───────── вход: только код владельца, проверка на сервере ───────── */
async function verify(code) {
  if (!API) return { ok: false, why: 'Не задан адрес сканера (lk/scan/config.js).' };
  let r; try { r = await fetch(API + '?owner=1', { headers: { 'x-scan-code': encodeURIComponent(code) }, cache: 'no-store' }); }
  catch (e) { return { ok: false, why: 'Сервер не отвечает. Проверьте сеть и попробуйте ещё раз.', net: true }; }
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.owner === true) return { ok: true, info: j };
  if (r.status === 429) return { ok: false, why: j.error || 'Слишком много попыток. Подождите 10 минут.' };
  if (r.status === 401 || r.status === 403) return { ok: false, why: 'Это страница владельца. Код не подходит.', bad: true };
  return { ok: false, why: j.error || ('Сервер ответил ' + r.status) };
}
let INFO = null;
async function unlock(code, quiet) {
  const err = $('#lockErr'), btn = $('#enter'); btn.disabled = true; err.textContent = quiet ? 'Проверяю код…' : '';
  const v = await verify(code); btn.disabled = false;
  if (!v.ok) { err.textContent = v.why; if (v.bad) ls.set('ownerCode', null); $('#lock').hidden = false; $('#code').focus(); return; }
  ls.set('ownerCode', code); ls.set('scanCode', code);   /* сканер кабинета берёт код отсюда */
  INFO = v.info; err.textContent = ''; $('#lock').hidden = true; $('#hub').hidden = false; start();
}
$('#lockForm').addEventListener('submit', e => { e.preventDefault(); const c = $('#code').value.trim(); if (c) unlock(c); });
$('#lockBtn').addEventListener('click', () => { ls.set('ownerCode', null); stopHands(); location.replace(location.pathname); });

/* ───────── разделы ───────── */
const PANE_OF = { scan: 'lk', lk: 'lk', holo: 'holo', site: 'site' };
let cur = '', prevPane = '', split = false, splitUser = false, started = false;
const frame = p => $('.pane[data-pane="' + p + '"]');
function load(p) { const f = frame(p); if (!f.getAttribute('src') || f.getAttribute('src') === 'about:blank') { f.onload = () => patch(f); f.src = SRC[p]; } return f; }
function lkReady(f, ms) { return new Promise(res => { const t0 = Date.now(); (function poll() { let w = null; try { w = f.contentWindow; } catch (e) {}
  if (w && w.LKSCAN && w.document.readyState !== 'loading') return res(w); if (Date.now() - t0 > (ms || 15000)) return res(null); setTimeout(poll, 120); })(); }); }
async function lkTab(id) { const w = await lkReady(load('lk')); if (!w) return null; const t = w.document.querySelector('.tab[data-tab="' + id + '"]'); if (t) t.click(); return w; }

function go(id, opt) {
  if (!PANE_OF[id]) id = 'scan';
  const p = PANE_OF[id], was = PANE_OF[cur] || '';
  if (was && was !== p) prevPane = was;
  split = splitUser && p !== 'holo';   /* голограмма — всегда на весь экран */
  if (prevPane === 'holo') prevPane = p === 'site' ? 'lk' : 'site';   /* и в «Рядом» её не ставим */
  cur = id; $$('.tab').forEach(b => { const on = b.getAttribute('data-go') === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  load(p);
  /* голограмма держит свою камеру: пока она на экране, руки пульта молчат; ушли с неё — выгружаем, камера свободна */
  const holoSeen = p === 'holo' || (split && prevPane === 'holo');
  if (!holoSeen && frame('holo').getAttribute('src') && frame('holo').getAttribute('src') !== 'about:blank') frame('holo').src = 'about:blank';
  if (holoSeen && HANDS.on) { stopHands(true); toast('У голограммы свои жесты — «Включить руки» внутри. Руки пульта вернутся, когда уйдёте с неё.', 4500); }
  if (!holoSeen && HANDS.resume) { HANDS.resume = false; startHands(); }
  layout();
  if (id === 'scan') lkTab('check'); else if (id === 'lk' && !(opt && opt.keep)) lkTab('home');
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
}
function layout() {
  const p = PANE_OF[cur], two = split && prevPane && prevPane !== p;
  $('#panes').classList.toggle('split', !!two);
  $('.stage').classList.toggle('full', p === 'holo');   /* на голограмме — без боковой панели, вся ширина ей */
  $$('.pane').forEach(f => { const n = f.getAttribute('data-pane'); f.classList.toggle('on', n === p); f.classList.toggle('prev', !!two && n === prevPane); });
  if (two) load(prevPane);
}
$$('.tab').forEach(b => b.addEventListener('click', () => go(b.getAttribute('data-go'))));
$('#splitBtn').addEventListener('click', () => { splitUser = !splitUser; $('#splitBtn').classList.toggle('on', splitUser); $('#splitBtn').setAttribute('aria-pressed', splitUser);
  if (splitUser && !prevPane) prevPane = PANE_OF[cur] === 'site' ? 'lk' : 'site'; go(cur, { keep: true }); });

/* ───────── «Мои чертежи» и сканер — сбоку ───────── */
function sheets() { try { const a = JSON.parse(ls.get('lk_sheets') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
function renderSide() {
  const S = sheets(), i = INFO || {};
  $('#stat').innerHTML = '<span>Код: <b>владелец</b> · сканер открыт</span>' + (i.limit ? '<span>Расход функции: <b>$' + (+i.spent || 0).toFixed(2) + '</b> из $' + i.limit + '</span>' : '')
    + '<span>Листов в этом браузере: <b>' + S.length + '</b></span><div class="row" style="display:flex;gap:6px"><button class="btn sm" data-act="scan">Сканировать</button><button class="btn sm" data-act="lk">Кабинет</button></div>';
  $('#sheets').innerHTML = S.length ? S.map(sh => { const d = new Date(sh.created || Date.now()), n = (sh.drawings || []).length;
    return '<div class="sheet"><b>' + esc(sh.name || 'Лист') + '</b><small>' + d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0') + ' · ' + n + ' ' + plural(n, 'чертёж', 'чертежа', 'чертежей') + (sh.demo ? ' · пример' : '') + '</small>'
      + '<div class="row"><button class="btn sm" data-open="' + esc(sh.id) + '" data-p="copy">Копия</button><button class="btn sm" data-open="' + esc(sh.id) + '" data-p="fix">Доводка</button><button class="btn sm" data-open="' + esc(sh.id) + '" data-p="3d">3D</button></div></div>'; }).join('')
    : '<p class="empty">Пока пусто. «Сканировать» — фото листа станет копией, доводкой и 3D.</p>';
}
$('#side').addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (a) { go(a.getAttribute('data-act')); return; }
  const b = e.target.closest('[data-open]'); if (!b) return;
  go('lk', { keep: true }); const w = await lkTab('check'); if (!w) { toast('Кабинет не загрузился'); return; }
  w.LKSCAN.open(b.getAttribute('data-open')); w.LKSCAN.pane(b.getAttribute('data-p'));
  if (innerWidth <= 900) side(false);
});
/* ───────── пользователи: сколько вошло в кабинет (API клуба, GET /api/admin/live — только для админа) ─────────
   Пульт берёт сессию кабинета этого браузера (localStorage lk_tok, общий с lk/): войти в «Кабинет» аккаунтом владельца. */
const CLUB = String(self.CLUB_API || '').replace(/\/$/, '');
let usersT = 0;
async function renderUsers() {
  const el = $('#users'); if (!el) return; clearTimeout(usersT);
  const tok = ls.get('lk_tok'), login = '<div class="row" style="display:flex;gap:6px"><button class="btn sm" data-act="lk">Войти в кабинет</button></div>';
  if (!CLUB) { el.innerHTML = '<span>Сервер кабинета не задан (lk/config.js).</span>'; return; }
  if (!tok) { el.innerHTML = '<span>Чтобы видеть пользователей, войдите в «Кабинет» аккаунтом владельца.</span>' + login; return; }
  let r, j = {};
  try { r = await fetch(CLUB + '/api/admin/live', { headers: { authorization: 'Bearer ' + tok }, cache: 'no-store' }); j = await r.json().catch(() => ({})); }
  catch (e) { el.innerHTML = '<span>Сервер кабинета не отвечает.</span>'; usersT = setTimeout(renderUsers, 60e3); return; }
  if (r.status === 401) { el.innerHTML = '<span>Сессия кабинета истекла — войдите снова.</span>' + login; return; }
  if (r.status === 403) { el.innerHTML = '<span>Этот аккаунт кабинета — не админ: счётчик видит только владелец.</span>'; return; }
  if (!r.ok || !j.kpi) { el.innerHTML = '<span>' + esc(j.error || ('Сервер ответил ' + r.status)) + '</span>'; usersT = setTimeout(renderUsers, 60e3); return; }
  const k = j.kpi, on = (j.online || []).slice(0, 8);
  el.innerHTML = '<span>Авторизованных всего: <b>' + k.total + '</b>' + (k.newToday ? ' · новых сегодня: <b>' + k.newToday + '</b>' : '') + '</span>'
    + '<span>Сейчас онлайн: <b>' + k.online + '</b> · сегодня: <b>' + k.today + '</b> · за неделю: <b>' + k.week + '</b></span>'
    + (on.length ? '<span>' + on.map(u => esc(u.name) + (u.group ? ' (' + esc(u.group) + ')' : '')).join(', ') + '</span>' : '');
  usersT = setTimeout(() => { if (!$('#side').hidden) renderUsers(); }, 60e3);
}
function side(on) { $('#side').hidden = !on; $('#sideBtn').classList.toggle('on', on); $('#sideBtn').setAttribute('aria-pressed', on); if (on) { renderSide(); renderUsers(); } ls.set('me_side', on ? '1' : '0'); }
$('#sideBtn').addEventListener('click', () => side($('#side').hidden));
addEventListener('storage', e => { if ($('#side').hidden) return; if (e.key === 'lk_sheets') renderSide(); if (e.key === 'lk_tok') renderUsers(); });   /* кабинет сохранил лист */

/* ───────── клавиши (и внутри разделов) ───────── */
function keys(e) {
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.code, map = { Digit1: 'scan', Digit2: 'lk', Digit3: 'holo', Digit4: 'site' };
  if (map[k]) { e.preventDefault(); go(map[k]); }
  else if (k === 'KeyD') { e.preventDefault(); side($('#side').hidden); }
  else if (k === 'KeyS') { e.preventDefault(); $('#splitBtn').click(); }
  else if (k === 'KeyG') { e.preventDefault(); $('#gestBtn').click(); }
}
addEventListener('keydown', keys);
/* в каждый раздел — те же клавиши; setPointerCapture — без ошибки для «руки» (у синтетического указателя нет захвата) */
function patch(f) { let w; try { w = f.contentWindow; if (!w || !w.document || w.__mePatched) return; } catch (e) { return; }
  w.__mePatched = true; w.addEventListener('keydown', keys);
  for (const m of ['setPointerCapture', 'releasePointerCapture']) { const o = w.Element.prototype[m]; w.Element.prototype[m] = function () { try { return o.apply(this, arguments); } catch (e) {} }; } }

/* ───────── руки на весь пульт ───────── */
const HANDS = { on: false, resume: false, stream: null, worker: null, busy: false, raf: 0, ptr: null, tgt: null, scroll: false };
const cursor = $('#cursor');
async function startHands() {
  if (HANDS.on) return; if (PANE_OF[cur] === 'holo') { toast('На голограмме — её собственные руки: кнопка «Включить руки» внутри.'); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Камера недоступна в этом браузере.'); return; }
  $('#gestBtn').textContent = '✋ Запуск…';
  try {
    HANDS.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    const v = $('#camv'); v.srcObject = HANDS.stream; await v.play(); v.hidden = false;
    const w = new Worker('../hands/detector.worker.js'); HANDS.worker = w;
    await new Promise((res, rej) => { w.onmessage = e => e.data.type === 'ready' ? res() : rej(new Error(e.data.error || 'модель рук не загрузилась')); w.onerror = ev => rej(new Error(ev.message || 'воркер')); w.postMessage({ type: 'init', delegate: 'GPU' }); });
    w.onmessage = e => { HANDS.busy = false; if (e.data.type === 'hands') act(HANDS.ptr.update(e.data.hands || [], e.data.t)); };
    HANDS.ptr = createPointer(); HANDS.on = true; cursor.hidden = false;
    $('#gestBtn').textContent = '✋ Руки вкл'; $('#gestBtn').classList.add('on'); $('#gestBtn').setAttribute('aria-pressed', 'true');
    toast('Указательный — курсор, щипок — нажать, щипок и вести — крутить или листать, две руки — зум, ладонь — назад.', 5000);
    loop();
  } catch (e) { stopHands(); toast('Руки не включились: ' + (e && e.message || e)); }
}
function stopHands(resume) {
  HANDS.resume = !!resume && HANDS.on; HANDS.on = false; cancelAnimationFrame(HANDS.raf);
  if (HANDS.tgt) fire('up', HANDS.tgt.x, HANDS.tgt.y); HANDS.tgt = null;
  if (HANDS.worker) { try { HANDS.worker.postMessage({ type: 'close' }); } catch (e) {} HANDS.worker.terminate(); HANDS.worker = null; }
  if (HANDS.stream) { HANDS.stream.getTracks().forEach(t => t.stop()); HANDS.stream = null; }
  $('#camv').hidden = true; cursor.hidden = true; HANDS.busy = false;
  $('#gestBtn').textContent = '✋ Руки'; $('#gestBtn').classList.remove('on'); $('#gestBtn').setAttribute('aria-pressed', 'false');
}
$('#gestBtn').addEventListener('click', () => HANDS.on ? stopHands() : startHands());
function loop() {
  if (!HANDS.on) return; HANDS.raf = requestAnimationFrame(loop);
  const v = $('#camv'); if (HANDS.busy || v.readyState < 2) return; HANDS.busy = true;
  createImageBitmap(v).then(bm => { if (!HANDS.worker) { bm.close(); return; } HANDS.worker.postMessage({ type: 'frame', bitmap: bm, t: performance.now() }, [bm]); }).catch(() => { HANDS.busy = false; });
}
/* элемент под точкой — сквозь iframe того же адреса; x, y — в координатах его окна */
function deepAt(x, y) {
  let doc = document, el = doc.elementFromPoint(x, y);
  while (el && el.tagName === 'IFRAME') { let d; try { d = el.contentDocument; } catch (e) { d = null; } if (!d) break; const r = el.getBoundingClientRect(); x -= r.left; y -= r.top; doc = d; el = d.elementFromPoint(x, y); }
  return el ? { el, x, y, win: doc.defaultView } : null;
}
function fire(kind, X, Y) {
  const t = HANDS.tgt; if (!t) return;
  const r = t.frameOff(), x = X - r.x, y = Y - r.y, W = t.win, base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: W };
  const P = (type, b) => { try { t.el.dispatchEvent(new W.PointerEvent(type, Object.assign({ pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, buttons: b }, base))); } catch (e) {} };
  const M = (type, b) => t.el.dispatchEvent(new W.MouseEvent(type, Object.assign({ button: 0, buttons: b }, base)));
  if (kind === 'down') { P('pointerdown', 1); M('mousedown', 1); }
  else if (kind === 'drag') { P('pointermove', 1); M('mousemove', 1); }
  else if (kind === 'up') { P('pointerup', 0); M('mouseup', 0); }
}
/* смещение окна раздела относительно пульта (для пересчёта координат на каждом кадре) */
function offsetOf(win) { let x = 0, y = 0, w = win; while (w && w !== window) { const f = w.frameElement; if (!f) break; const r = f.getBoundingClientRect(); x += r.left; y += r.top; w = w.parent; } return { x, y }; }
function scroller(el) { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = n.ownerDocument.defaultView.getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 2) return n; }
  return el.ownerDocument.scrollingElement; }
function act(evs) {
  const W = innerWidth, H = innerHeight;
  for (const e of evs) {
    if ('x' in e) { cursor.style.transform = 'translate(' + (e.x * W) + 'px,' + (e.y * H) + 'px)'; }
    if (e.type === 'palm') cursor.style.setProperty('--p', e.p);
    if (e.type === 'down') { cursor.classList.add('pin'); const X = e.x * W, Y = e.y * H, hit = deepAt(X, Y); if (!hit) continue;
      const drag = !!hit.el.closest('canvas,svg,input[type=range],[draggable=true]');
      HANDS.tgt = { el: hit.el, win: hit.win, x: X, y: Y, frameOff: () => offsetOf(hit.win), scroll: drag ? null : scroller(hit.el) };
      if (drag) fire('down', X, Y); }
    else if (e.type === 'drag' && HANDS.tgt) { const X = e.x * W, Y = e.y * H; HANDS.tgt.x = X; HANDS.tgt.y = Y;
      if (HANDS.tgt.scroll) HANDS.tgt.scroll.scrollBy(0, -e.dy * H * 1.6); else fire('drag', X, Y); }
    else if (e.type === 'up') { cursor.classList.remove('pin'); const t = HANDS.tgt; HANDS.tgt = null; if (!t) continue;
      if (!t.scroll) { HANDS.tgt = t; fire('up', t.x, t.y); HANDS.tgt = null; }
      if (e.tap) { const c = t.el.closest('button,a,label,summary,input,select,textarea,[role=button],[data-open],[tabindex]') || t.el; if (c.focus) c.focus({ preventScroll: true }); c.click(); } }
    else if (e.type === 'zoom') { const c = cursor.getBoundingClientRect(), hit = deepAt(c.left + c.width / 2, c.top + c.height / 2); if (!hit) continue;
      hit.el.dispatchEvent(new hit.win.WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: hit.x, clientY: hit.y, deltaY: -Math.log(e.k) / 0.0015, view: hit.win })); }
    else if (e.type === 'back') { cursor.style.setProperty('--p', 0); back(); }
  }
}
/* «назад»: закрыть открытое в разделе (Esc), а нечего закрывать — история раздела */
function back() { const f = frame(PANE_OF[cur]); let w; try { w = f.contentWindow; } catch (e) { return; } if (!w) return;
  const dv = w.document.querySelector('.dv.on,#dv.on'); if (dv) { w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return; }
  try { w.history.back(); } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (document.hidden && HANDS.on) stopHands(true); else if (!document.hidden && HANDS.resume) { HANDS.resume = false; startHands(); } });

/* ───────── старт ───────── */
function start() { if (started) return; started = true; side(ls.get('me_side') === '1' || (ls.get('me_side') == null && innerWidth > 900)); go((location.hash || '').slice(1) || 'scan'); }
addEventListener('hashchange', () => { const id = location.hash.slice(1); if (started && PANE_OF[id] && id !== cur) go(id); });
const saved = ls.get('ownerCode');
if (saved) unlock(saved, true); else $('#code').focus();
self.ME = { go, side, renderUsers, startHands, stopHands, act, deepAt, get cur() { return cur; } };   /* для проверки tests/me-hub.js */
