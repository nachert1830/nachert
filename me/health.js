/* Здоровье сайта для пульта me/. Чистый модуль: ни DOM, ни fetch — только разбор ответов GitHub API и форматирование (тест — tests/me-hub.js, healthLogic).
   pickRuns(runs, n)  — последние n завершённых полных проверок main (успех/провал), новые первыми;
   runningRun(runs)   — идущая сейчас проверка main или null;
   pickIssues(list)   — открытые задачи (без PR);
   fmtDur(ms), fmtWhen(iso, now) — «8 мин 12 с», «14:05» / «3.09 14:05»;
   loadHealth(fetchFn, repo) — запросы к открытому GitHub API (fetch только при вызове);
   healthHtml(d, now)        — HTML панели, всё экранировано. */
export const REPO = (globalThis.GH_REPO || 'nachert1830/nachert');
export const WORKFLOW = 'check.yml';
export const LABEL = 'main-красный';

const isMain = r => r && r.head_branch === 'main' && r.event !== 'pull_request';

export function pickRuns(runs, n = 5) {
  if (!Array.isArray(runs)) return [];
  return runs.filter(r => isMain(r) && r.status === 'completed' && (r.conclusion === 'success' || r.conclusion === 'failure'))
    .slice(0, n).map(r => {
      const at = r.run_started_at || r.created_at;
      return { id: r.id, ok: r.conclusion === 'success', at, ms: Date.parse(r.updated_at) - Date.parse(at), url: r.html_url,
        sha: String(r.head_sha || '').slice(0, 7), title: String(r.display_title || (r.head_commit && r.head_commit.message) || '').split('\n')[0] };
    });
}

export function runningRun(runs) {
  const r = (Array.isArray(runs) ? runs : []).find(r => isMain(r) && r.status !== 'completed');
  return r ? { at: r.run_started_at || r.created_at, url: r.html_url } : null;
}

export function pickIssues(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(i => i && !i.pull_request).map(i => ({ n: Number(i.number), title: i.title, url: i.html_url }));
}

export function fmtDur(ms) {
  if (typeof ms !== 'number' || isNaN(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (ms < 60000) return s + ' с';
  if (ms < 3600000) return Math.floor(s / 60) + ' мин ' + (s % 60) + ' с';
  return Math.floor(s / 3600) + ' ч ' + Math.floor((s % 3600) / 60) + ' мин';
}

export function fmtWhen(iso, now = new Date()) {
  const d = new Date(iso), n = new Date(now), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return d.toDateString() === n.toDateString() ? hm : d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0') + ' ' + hm;
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = u => typeof u === 'string' && u.startsWith('https://github.com/');
const EXT = ' target="_blank" rel="noopener noreferrer"';

function httpErr(r, repo) {
  const h = k => (r.headers && typeof r.headers.get === 'function') ? r.headers.get(k) : null;
  if ((r.status === 403 || r.status === 429) && h('x-ratelimit-remaining') === '0') {
    const reset = Number(h('x-ratelimit-reset')) || Math.floor(Date.now() / 1000) + 3600;
    return { ok: false, why: 'Лимит запросов GitHub исчерпан (60 в час). Обновлю после ' + fmtWhen(new Date(reset * 1000).toISOString()), retryAt: reset * 1000 };
  }
  if (r.status === 404) return { ok: false, why: 'Репозиторий ' + repo + ' не найден или закрыт.' };
  return { ok: false, why: 'GitHub ответил ' + r.status };
}

export async function loadHealth(fetchFn = globalThis.fetch, repo = REPO) {
  const opts = () => ({ headers: { accept: 'application/vnd.github+json' }, cache: 'no-store' });
  const base = 'https://api.github.com/repos/' + repo;
  let r1, r2;
  try {
    [r1, r2] = await Promise.all([
      fetchFn(base + '/actions/workflows/' + WORKFLOW + '/runs?branch=main&per_page=30', opts()),
      fetchFn(base + '/issues?labels=' + encodeURIComponent(LABEL) + '&state=open&per_page=20', opts())]);
  } catch (e) { return { ok: false, why: 'GitHub не отвечает. Проверьте сеть.' }; }
  if (!r1 || !r1.ok) return httpErr(r1 || { status: 0 }, repo);
  if (!r2 || !r2.ok) return httpErr(r2 || { status: 0 }, repo);
  let j, list;
  try { [j, list] = await Promise.all([r1.json(), r2.json()]); }
  catch (e) { return { ok: false, why: 'GitHub не отвечает. Проверьте сеть.' }; }
  const wr = j && j.workflow_runs;
  return { ok: true, runs: pickRuns(wr), running: runningRun(wr), issues: pickIssues(list) };
}

export function healthHtml(d, now = new Date()) {
  d = d || {};
  let h = '<h2>Здоровье сайта</h2><button class="btn sm" data-hrefresh>Обновить</button>';
  if (d.ok === false) h += '<p class="hl-err">' + esc(d.why) + '</p>';
  if (d.running) h += '<p class="hl-now">Сейчас идёт проверка (начата ' + fmtWhen(d.running.at, now) + ')</p>';
  const runs = Array.isArray(d.runs) ? d.runs : [];
  runs.forEach(r => {
    h += '<div class="hl-run ' + (r.ok ? 'ok' : 'bad') + '">' + (r.ok ? '<b>✓ зелёная</b>' : '<b>✗ красная</b>')
      + '<time>' + fmtWhen(r.at, now) + '</time><span>шла ' + fmtDur(r.ms) + '</span>'
      + '<span>' + esc(r.sha) + ' · ' + esc(r.title) + '</span>'
      + (safeUrl(r.url) ? '<a class="btn sm" data-hlog href="' + esc(r.url) + '"' + EXT + '>Открыть лог</a>' : '') + '</div>';
  });
  if (d.ok && !runs.length) h += '<p class="empty">Завершённых проверок main пока нет</p>';
  h += '<h3>Задачи «main красный»</h3>';
  const iss = Array.isArray(d.issues) ? d.issues : [];
  if (iss.length) iss.forEach(i => {
    h += '<a class="hl-iss"' + (safeUrl(i.url) ? ' href="' + esc(i.url) + '"' : '') + EXT + '>#' + esc(i.n) + ' ' + esc(i.title) + '</a>';
  });
  else h += '<p class="empty">Открытых задач нет</p>';
  return h;
}
