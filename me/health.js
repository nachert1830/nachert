/* Здоровье сайта для пульта me/. Чистый модуль: ни DOM, ни fetch — только разбор ответов GitHub API и форматирование (тест — tests/me-hub.js, healthLogic).
   pickRuns(runs, n)  — последние n завершённых полных проверок main (успех/провал), новые первыми;
   runningRun(runs)   — идущая сейчас проверка main или null;
   pickIssues(list)   — открытые задачи (без PR);
   fmtDur(ms), fmtWhen(iso, now) — «8 мин 12 с», «14:05» / «3.09 14:05». */
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
