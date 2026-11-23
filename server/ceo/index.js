/* Облачная функция nachert-ceo (Yandex Cloud, вызов по адресу без ?integration=raw).
   Страница nachert1830.ru/ceo/ шлёт сюда идею; функция проверяет код (SHA-256 в CEO_CODE_SHA256), создаёт Issue в GitHub
   с метками «ceo» и «в работу» (это запускает цех company-work.yml) и отдаёт список задач со статусами.
   Токен GitHub (GH_TOKEN) живёт только в окружении функции, в страницу не попадает. */
'use strict';
const crypto = require('crypto');
let doFetch = (...a) => fetch(...a);
const norm = s => String(s || '').trim().toLowerCase().replace(/ё/g, 'е');
const sha = s => crypto.createHash('sha256').update(norm(s)).digest('hex');
const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const ORIGINS = () => (process.env.CEO_ORIGINS || 'https://nachert1830.ru,https://www.nachert1830.ru').split(',').map(s => s.trim()).filter(Boolean);
const fails = new Map();

function reply(code, obj, origin) {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (origin) { h['access-control-allow-origin'] = origin; h.vary = 'Origin'; }
  return { statusCode: code, headers: h, body: obj == null ? '' : JSON.stringify(obj) };
}

async function gh(path, opts) {
  const E = process.env;
  const r = await doFetch('https://api.github.com/repos/' + E.GH_REPO + path, Object.assign({}, opts, {
    headers: { authorization: 'Bearer ' + E.GH_TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'nachert-ceo', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' }
  }));
  const t = await r.text();
  if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + t.slice(0, 160));
  return t ? JSON.parse(t) : {};
}

async function handler(event) {
  event = event || {};
  const hd = {};
  Object.entries(event.headers || {}).forEach(([k, v]) => { hd[k.toLowerCase()] = Array.isArray(v) ? v[0] : v; });
  const method = String(event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || 'GET').toUpperCase();
  const og = hd.origin || '', origin = ORIGINS().includes(og) ? og : '';
  if (method === 'OPTIONS') {
    if (!origin) return reply(403, { ok: false, error: 'Адрес не разрешён' });
    const r = reply(204, null, origin);
    Object.assign(r.headers, { 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-ceo-code', 'access-control-max-age': '600' });
    return r;
  }
  if (og && !origin) return reply(403, { ok: false, error: 'Адрес не разрешён' });

  const code = (v => { try { return decodeURIComponent(v); } catch (e) { return v; } })(String(hd['x-ceo-code'] || ''));
  if (method === 'GET' && !code) return reply(200, { ok: true, ceo: true, codeNeeded: true }, origin);

  const ip = /* адрес — от шлюза (requestContext); X-Forwarded-For задаёт сам клиент, по нему счётчик перебора обходится сменой заголовка */
    String((event.requestContext && event.requestContext.identity && event.requestContext.identity.sourceIp) || String(hd['x-forwarded-for'] || hd['x-real-ip'] || '?').split(',').pop()).trim(), now = Date.now();
  const recent = (fails.get(ip) || []).filter(t => now - t < 600000);
  if (recent.length >= 10) return reply(429, { ok: false, error: 'Слишком много неверных кодов. Подождите 10 минут.' }, origin);
  const hash = process.env.CEO_CODE_SHA256 || '';
  if (!hash || !code || !same(sha(code), hash)) {
    recent.push(now); fails.set(ip, recent); if (fails.size > 500) fails.clear();
    return reply(401, { ok: false, error: 'Неверный код' }, origin);
  }
  if (!process.env.GH_TOKEN || !process.env.GH_REPO) return reply(503, { ok: false, error: 'На сервере не задан токен GitHub' }, origin);

  try {
    if (method === 'GET') {
      const list = await gh('/issues?labels=ceo&state=all&per_page=30', { method: 'GET' });
      const items = list.filter(i => !i.pull_request).map(i => ({ n: i.number, t: i.title, done: i.state === 'closed', url: i.html_url, at: i.created_at, c: i.comments }));
      return reply(200, { ok: true, codeOk: true, items }, origin);
    }
    if (method !== 'POST') return reply(405, { ok: false, error: 'Только GET и POST' }, origin);
    let b; try { const raw = event.isBase64Encoded ? Buffer.from(String(event.body || ''), 'base64').toString('utf8') : String(event.body || ''); b = JSON.parse(raw); } catch (e) { return reply(400, { ok: false, error: 'Нужен JSON' }, origin); }
    const text = String(b.text || '').trim().slice(0, 4000);
    if (text.length < 5) return reply(400, { ok: false, error: 'Опишите идею подробнее' }, origin);
    const title = text.replace(/\s+/g, ' ').slice(0, 80);
    const i = await gh('/issues', { method: 'POST', body: JSON.stringify({ title, body: text, labels: ['ceo', 'в работу'] }) });
    return reply(200, { ok: true, n: i.number, url: i.html_url }, origin);
  } catch (e) {
    return reply(502, { ok: false, error: String(e && e.message || 'Ошибка').slice(0, 200) }, origin);
  }
}
module.exports = { handler, sha, _setFetch: f => { doFetch = f; } };
