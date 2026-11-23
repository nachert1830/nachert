/* Командная строка исполнителя Цеха (tools/hq-agent.js): RUN — команда в копии репозитория, CI — конец лога упавших заданий.
   • RUN: bash -lc в корне копии, таймаут 10 мин (HQ_RUN_TIMEOUT — мс, для тестов), ответ — код выхода и последние 8000 символов вывода.
   • Окружение команды — без секретов: удаляется всё, в имени чего есть KEY, TOKEN, SECRET, PASSWORD, GH_, GITHUB_TOKEN (без учёта регистра);
     значения этих переменных, если вдруг попали в вывод, заменяются на ***.
   • Запреты проверяются до запуска (регулярные выражения по всей строке): сеть, git push/remote/config, sudo, rm -rf / и ~, npm publish,
     чтение ключей, запись в .github/workflows и tests/baseline.json, перенаправление в файлы вне репозитория (кроме /tmp).
   • Песочница (HQ_SANDBOX=1, так в Цехе): команда идёт в своих пространствах имён Linux — без сети (только loopback для
     локальных проверок) и со своим /proc, где не видно процесса исполнителя с ключами. Список запретов — второй слой:
     регулярные выражения обходятся (node -e умеет и сеть, и чтение /proc/<pid>/environ), изоляция — нет.
   • Реплики владельца (fromOwner): комментарий «💬 Владелец: …» принимается, только если его автор имеет права в
     репозитории (author_association OWNER / MEMBER / COLLABORATOR). Репозиторий публичный: начать комментарий так может любой.
   • CI: исполнитель сам ходит в GitHub API с токеном из своего окружения (модель токена не видит) — только чтение. */
'use strict';
const {spawn} = require('child_process'), path = require('path');

const OUT = 8000, CI_OUT = 6000;
const SECRET = /KEY|TOKEN|SECRET|PASSWORD|GH_|GITHUB_TOKEN/i;

function cleanEnv(env) {
  const o = {};
  for (const [k, v] of Object.entries(env || {})) if (!SECRET.test(k)) o[k] = v;
  return o;
}
/* значения секретов из окружения исполнителя — не длиннее 6 символов не трогаем (ложные совпадения) */
function redact(text, env) {
  let t = String(text || '');
  for (const [k, v] of Object.entries(env || {})) if (SECRET.test(k) && v && String(v).length > 6) {
    t = t.split(String(v)).join('***');
    const b = Buffer.from('x-access-token:' + v).toString('base64'); t = t.split(b).join('***');   /* git http.extraheader */
  }
  return t;
}

/* куда пишет перенаправление или tee: всё вне репозитория, кроме /tmp и /dev/null, — запрещено */
function outside(target, root) {
  const t = String(target || '').replace(/^["']|["']$/g, '');
  if (!t || t.startsWith('&')) return false;
  if (/^\/dev\/(null|stdout|stderr)$/.test(t)) return false;
  if (t.startsWith('~') || t.startsWith('$')) return true;
  const p = path.resolve(root, t);
  if (p === '/tmp' || p.startsWith('/tmp/')) return false;
  return !(p === root || p.startsWith(root + path.sep));
}

const WRITE = /(>|\btee\b|\bsed\s+(-\w*\s+)*-i|\bperl\s+-\w*i|\b(cp|mv|rm|touch|truncate|dd|ln|install|chmod|patch)\b|writeFile|appendFile|createWriteStream|\bgit\s+(checkout|restore|apply|mv|rm|reset|stash)\b)/;
const RULES = [
  [/\bgit\s+(-\S+\s+)*push\b/, 'git push запрещён — PR делает Цех'],
  [/\bgit\s+(-\S+\s+)*remote\b/, 'git remote запрещён'],
  [/\bgit\s+(-\S+\s+)*config\b/, 'git config запрещён'],
  [/(^|[\s;&|(`])gh(\s|$)/, 'gh запрещён — для логов CI есть команда CI:'],
  [/\b(curl|wget)\b/, 'сеть запрещена (curl, wget)'],
  [/(^|[\s;&|(`])(nc|ncat|netcat)(\s|$)/, 'сеть запрещена (nc)'],
  [/\b(ssh|scp|sftp)\b/, 'ssh и scp запрещены'],
  [/\bsudo\b/, 'sudo запрещён'],
  [/\brm\s+(-\S+\s+)*(\/\*?|~\/?\*?)(?=$|[\s;&|)])/, 'rm -rf / и ~ запрещены'],
  [/\bnpm\s+(-\S+\s+)*publish\b/, 'npm publish запрещён'],
  [/\b(printenv|env|export|set|declare)\b[^;&\n]*(KEY|TOKEN|SECRET|PASSWORD|GH_)/i, 'вывод ключей запрещён'],
  [/\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD|GH_)\w*/i, 'обращение к ключам запрещено'],
  [/\/proc\/[^\s]*\/environ/, '/proc/*/environ запрещён'],
  [/(^|[\s'"=\/(])\.git\/(config|credentials)|\.git-credentials|extraheader/, 'настройки и ключи git закрыты'],
  [/(^|[\s'"=\/(])\.git\//, '.git/ закрыт (хуки git выполнились бы у Цеха с ключами)'],
  [/core\.hooksPath|GIT_CONFIG|GIT_DIR/i, 'настройки git закрыты'],
];

/* причина отказа или '' — команда разрешена */
function forbidden(cmd, root) {
  const c = String(cmd || '');
  if (!c.trim()) return 'пустая команда';
  for (const [re, why] of RULES) if (re.test(c)) return why;
  const w = c.replace(/\d*>&\d|&>\s*\/dev\/null|\d*>\s*\/dev\/null/g, '');
  if (/\.github\/workflows/.test(c) && WRITE.test(w)) return 'запись в .github/workflows запрещена';
  if (/tests\/baseline\.json/.test(c) && WRITE.test(w)) return 'запись в tests/baseline.json запрещена (тесты — судья)';
  for (const m of w.matchAll(/(?:^|[^<>&\d])\d?>>?\s*([^\s;&|)]+)/g)) if (outside(m[1], root)) return 'перенаправление вне репозитория запрещено (можно в /tmp): ' + m[1];
  for (const m of w.matchAll(/\btee\s+(?:-\S+\s+)*([^\s;&|)]+)/g)) if (outside(m[1], root)) return 'tee вне репозитория запрещён (можно в /tmp): ' + m[1];
  return '';
}

/* песочница: префикс команды или null, если изоляция недоступна (проверяется один раз) */
let SANDBOX;
function sandbox() {
  if (SANDBOX !== undefined) return SANDBOX;
  SANDBOX = null;
  if (process.env.HQ_SANDBOX !== '1') return SANDBOX;
  const {spawnSync} = require('child_process');
  const root = typeof process.getuid === 'function' && process.getuid() === 0;
  const uid = process.getuid(), gid = process.getgid();
  /* root нужен только для unshare; сама команда — снова от пользователя Цеха (setpriv), файлы остаются его */
  const pre = (root ? [] : ['sudo', '-n', '-E', 'env', 'PATH=' + (process.env.PATH || '/usr/bin:/bin')]).concat(['unshare', '--net', '--pid', '--fork', '--mount-proc', '--', 'sh', '-c',
    'ip link set lo up 2>/dev/null; exec setpriv --reuid=' + uid + ' --regid=' + gid + ' --init-groups -- bash -lc "$0"']);
  const probe = spawnSync(pre[0], pre.slice(1).concat(['node -e 0']), {stdio: 'ignore', timeout: 20000});   /* node должен находиться и внутри */
  if (probe.status === 0) SANDBOX = pre;
  else console.log('::warning::Песочница RUN недоступна (unshare) — команды идут только со списком запретов');
  return SANDBOX;
}

/* реплика владельца: текст начинается с «💬 Владелец:» И автор — с правами в репозитории */
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const fromOwner = c => !!c && /^💬 Владелец:/.test(c.body || '') && TRUSTED.has(String(c.author_association || '').toUpperCase());

/* команда для execFileSync в песочнице (если она есть): {file, args}; окружение передавать cleanEnv(process.env) */
function wrap(script) { const box = sandbox(); return box ? {file: box[0], args: box.slice(1).concat([script])} : {file: 'bash', args: ['-lc', script]}; }

/* run(cmd, {root, timeout, env, log}) → {code, out, text} — text уходит модели */
function run(cmd, o) {
  o = o || {};
  const root = o.root || process.cwd(), env = o.env || process.env, log = o.log || (s => console.log(s));
  const timeout = o.timeout || +process.env.HQ_RUN_TIMEOUT || 10 * 60000;
  log('--- RUN: ' + String(cmd).slice(0, 200));
  const why = forbidden(cmd, root);
  if (why) { log('    отказ: ' + why); return Promise.resolve({code: -1, out: '', text: 'ОТКАЗ: ' + why + '. Команда не выполнялась.'}); }
  return new Promise(res => {
    let buf = '', timed = false;
    const box = o.sandbox === false ? null : sandbox(), script = 'exec 2>&1\n' + cmd;
    const p = box ? spawn(box[0], box.slice(1).concat([script]), {cwd: root, env: cleanEnv(env), detached: true, stdio: ['ignore', 'pipe', 'pipe']})
      : spawn('bash', ['-lc', script], {cwd: root, env: cleanEnv(env), detached: true, stdio: ['ignore', 'pipe', 'pipe']});
    const add = d => { buf += d; if (buf.length > OUT * 4) buf = buf.slice(-OUT * 2); };
    p.stdout.on('data', add); p.stderr.on('data', add);
    const t = setTimeout(() => { timed = true; try { process.kill(-p.pid, 'SIGKILL'); } catch (e) { p.kill('SIGKILL'); } }, timeout);
    p.on('close', code => {
      clearTimeout(t);
      const c = timed ? 124 : code == null ? 1 : code;
      let out = redact(buf, env); if (out.length > OUT) out = '…[начало обрезано]\n' + out.slice(-OUT);
      log('    код выхода: ' + c + (timed ? ' (таймаут)' : ''));
      res({code: c, out, text: (timed ? 'ТАЙМАУТ ' + Math.round(timeout / 1000) + ' с — команда остановлена.\n' : '') + 'Код выхода: ' + c + '\n' + (out || '(вывода нет)')});
    });
  });
}

/* ci(номер запуска, {repo, token, api, http}) → текст: список заданий запуска и конец лога упавших */
async function ci(id, o) {
  o = o || {};
  const repo = o.repo || process.env.GITHUB_REPOSITORY, token = o.token || process.env.GH_TOKEN, api = o.api || process.env.HQ_GH_API || 'https://api.github.com';
  const http = o.http || fetch, n = String(id || '').trim().replace(/^.*\/runs\//, '').replace(/\D.*$/, '');
  if (!n) return 'Формат: CI: номер_запуска';
  if (!repo || !token) return 'CI недоступен: нет репозитория или токена у Цеха';
  const h = {authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'user-agent': 'hq-agent'};
  const r = await http(api + '/repos/' + repo + '/actions/runs/' + n + '/jobs?per_page=100', {headers: h});
  if (!r.ok) return 'GitHub ответил ' + r.status + ' на список заданий запуска ' + n;
  const jobs = ((await r.json()).jobs || []);
  const bad = jobs.filter(j => /failure|timed_out|cancelled/.test(j.conclusion || ''));
  let o2 = 'Запуск ' + n + ': ' + jobs.map(j => j.name + ' — ' + (j.conclusion || j.status)).join('; ');
  if (!bad.length) return o2 + '\nУпавших заданий нет.';
  for (const j of bad.slice(0, 3)) {
    const step = (j.steps || []).find(s => s.conclusion === 'failure');
    let log = '';
    try { const l = await http(api + '/repos/' + repo + '/actions/jobs/' + j.id + '/logs', {headers: h, redirect: 'follow'}); log = l.ok ? await l.text() : 'лог недоступен (' + l.status + ')'; }
    catch (e) { log = 'лог недоступен: ' + e.message; }
    log = redact(log.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /gm, ''), process.env);
    o2 += '\n\n=== ' + j.name + (step ? ' (шаг «' + step.name + '»)' : '') + ' ===\n' + (log.length > CI_OUT ? '…' + log.slice(-CI_OUT) : log);
  }
  return o2;
}

module.exports = {run, ci, forbidden, cleanEnv, redact, SECRET, fromOwner, sandbox, wrap, _resetSandbox: () => { SANDBOX = undefined; }};
