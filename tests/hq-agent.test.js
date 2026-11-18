/* Командная строка исполнителя Цеха (tools/hq-run.js): запреты, окружение без секретов, таймаут, обрезка вывода, CI.
   node --test tests/hq-agent.test.js */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const SH = require('../tools/hq-run.js');
const ROOT = path.join(__dirname, '..');
const quiet = () => {};

test('RUN: запрещённые команды отклоняются до запуска', async () => {
  const bad = {
    'git push origin main': /git push/, 'git remote -v': /git remote/, 'git config user.name x': /git config/,
    'gh pr list': /gh/, 'curl https://example.com': /сеть/, 'wget https://example.com': /сеть/, 'echo hi | nc example.com 80': /сеть/,
    'ssh user@host': /ssh/, 'scp a host:b': /ssh/, 'sudo ls': /sudo/, 'rm -rf /': /rm -rf/, 'rm -rf ~': /rm -rf/, 'rm -rf ~/': /rm -rf/,
    'npm publish': /npm publish/, 'printenv PROXYAPI_KEY': /ключ/, 'env | grep TOKEN': /ключ/, 'echo $GH_TOKEN': /ключ/,
    'cat /proc/self/environ': /environ/, 'cat /proc/1/environ': /environ/, 'cat .git/config': /git/, 'grep -r extraheader .': /git/,
    'echo x > .github/workflows/check.yml': /workflows/, 'sed -i s/a/b/ .github/workflows/hq-work.yml': /workflows/,
    'echo {} > tests/baseline.json': /baseline/, 'cp /tmp/b.json tests/baseline.json': /baseline/,
    'echo x > /etc/passwd': /вне репозитория/, 'ls >> ../out.txt': /вне репозитория/, 'ls | tee /home/x.txt': /вне репозитория/
  };
  for (const [cmd, why] of Object.entries(bad)) {
    assert.match(SH.forbidden(cmd, ROOT), why, cmd);
    const r = await SH.run(cmd, {root: ROOT, log: quiet});
    assert.equal(r.code, -1, cmd); assert.match(r.text, /^ОТКАЗ/, cmd);
  }
});

test('RUN: разрешённые команды проходят', () => {
  for (const cmd of ['node tests/run.js --only=me', 'npm test', 'node --test tests/hq-agent.test.js', 'ls -la', 'cat README.md | head -5',
    'grep -rn hq tools/ | wc -l', 'find tools -name "*.js"', 'git status', 'git diff HEAD~1', 'git log --oneline -5', 'git show HEAD', 'git blame README.md',
    'sed -n 1,20p index.html', 'echo "x" > /tmp/t.js && node /tmp/t.js', 'node tests/run.js 2>&1 | tail -30', 'cat .github/workflows/check.yml',
    'cat tests/baseline.json | head', 'ls > /dev/null', 'printenv', 'echo hi > out.txt'])
    assert.equal(SH.forbidden(cmd, ROOT), '', cmd);
});

test('RUN: в окружении нет секретов, значения в выводе скрыты', async () => {
  const env = Object.assign({}, process.env, {PROXYAPI_KEY: 'px-secret-value-1', GH_TOKEN: 'ghs_secretvalue2', GITHUB_TOKEN: 'ghs_x3x3x3x3', MY_SECRET: 'zzzzzzzz',
    DB_PASSWORD: 'p4ssw0rd!', gh_hq: 'lowercase-gh', api_key: 'lower-key-777', SAFE_NAME: 'видно'});
  const r = await SH.run('printenv', {root: ROOT, env, log: quiet});
  assert.equal(r.code, 0, r.text);
  const names = r.out.split('\n').map(l => l.split('=')[0]).filter(Boolean);
  assert.ok(names.includes('SAFE_NAME'), 'обычные переменные остаются');
  for (const n of names) assert.doesNotMatch(n, /KEY|TOKEN|SECRET|PASSWORD|GH_|GITHUB_TOKEN/i, 'секрет в окружении: ' + n);
  assert.doesNotMatch(r.out, /px-secret-value-1|ghs_secretvalue2/);
  /* значение секрета, оказавшееся в файле, в вывод не попадает */
  const fs = require('fs'), f = '/tmp/hq-run-test-' + process.pid + '.txt'; fs.writeFileSync(f, 'ключ: px-secret-value-1\n');
  const r2 = await SH.run('cat ' + f, {root: ROOT, env, log: quiet}); fs.unlinkSync(f);
  assert.match(r2.out, /ключ: \*\*\*/);
});

test('RUN: таймаут останавливает команду', async () => {
  const t0 = Date.now(), old = process.env.HQ_RUN_TIMEOUT; process.env.HQ_RUN_TIMEOUT = '700';
  try {
    const r = await SH.run('sleep 20; echo не дождались', {root: ROOT, log: quiet});
    assert.equal(r.code, 124); assert.match(r.text, /ТАЙМАУТ/); assert.doesNotMatch(r.out, /не дождались/);
    assert.ok(Date.now() - t0 < 5000, 'команда остановлена вовремя');
  } finally { if (old == null) delete process.env.HQ_RUN_TIMEOUT; else process.env.HQ_RUN_TIMEOUT = old; }
});

test('RUN: вывод обрезается до последних 8000 символов, код выхода и лог Цеха', async () => {
  const log = [];
  const r = await SH.run('for i in $(seq 1 3000); do echo "строка $i"; done; echo КОНЕЦ >&2; exit 3', {root: ROOT, log: s => log.push(s)});
  assert.equal(r.code, 3); assert.match(r.text, /^Код выхода: 3/);
  assert.ok(r.out.length <= 8000 + 30, 'длина ' + r.out.length); assert.match(r.out, /начало обрезано/);
  assert.match(r.out, /строка 3000\nКОНЕЦ/); assert.doesNotMatch(r.out, /строка 1\n/);
  assert.match(log[0], /^--- RUN: for i/); assert.match(log[1], /код выхода: 3/);
});

test('RUN: команда идёт в корне копии', async () => {
  const r = await SH.run('pwd; ls tools/hq-run.js', {root: ROOT, log: quiet});
  assert.equal(r.code, 0); assert.match(r.out, new RegExp(ROOT.replace(/[/.]/g, '\\$&'))); assert.match(r.out, /tools\/hq-run\.js/);
});

test('CI: упавшие задания запуска — конец лога, токен только в заголовке', async () => {
  const calls = [];
  const http = async (url, o) => { calls.push({url, h: o.headers});
    if (/\/runs\/77\/jobs/.test(url)) return {ok: true, status: 200, json: async () => ({jobs: [
      {id: 1, name: 'server', conclusion: 'success', steps: []},
      {id: 2, name: 'check (2)', conclusion: 'failure', steps: [{name: 'Проверка', conclusion: 'failure'}]}]})};
    if (/\/jobs\/2\/logs$/.test(url)) return {ok: true, status: 200, text: async () => '2026-11-18T10:00:00.000Z начало\n' + 'x'.repeat(9000) + '\n\x1b[31mНОВЫЕ ОШИБКИ: rk2\x1b[0m'};
    return {ok: false, status: 404};
  };
  const t = await SH.ci('https://github.com/o/r/actions/runs/77', {repo: 'o/r', token: 'tok', api: 'https://gh.test', http});
  assert.match(t, /server — success; check \(2\) — failure/); assert.match(t, /шаг «Проверка»/); assert.match(t, /НОВЫЕ ОШИБКИ: rk2$/);
  assert.ok(t.length < 6500); assert.doesNotMatch(t, /tok/);
  assert.equal(calls.length, 2); assert.equal(calls[0].h.authorization, 'Bearer tok');
  assert.match(await SH.ci('abc', {repo: 'o/r', token: 't', http}), /Формат/);
});

/* ── сеанс (--session) на поддельном ProxyAPI и поддельном GitHub ── */
const http = require('http'), fs = require('fs'), os = require('os'), {spawn} = require('child_process');
/* один сервер: /v1/messages и /v1/chat/completions — ответы модели по очереди; /repos/o/r/… — Issue, PR, проверки */
function fake(o) {
  const st = {px: [], gh: [], comments: (o.comments || []).map((b, i) => ({id: i + 1, body: b})), next: 100, merged: false, replies: o.replies.slice(), queue: (o.queue || []).slice()};
  const srv = http.createServer((q, r) => { let b = ''; q.on('data', d => b += d).on('end', () => {
    const j = b ? JSON.parse(b) : null, send = (code, x) => { r.writeHead(code, {'content-type': 'application/json'}); r.end(JSON.stringify(x)); };
    if (q.url.startsWith('/v1/')) { st.px.push({url: q.url, body: j}); const haiku = /haiku/.test(j.model);
      const t = haiku && o.haiku ? o.haiku : st.replies.shift() || 'SAY: (ответы кончились)';
      return send(200, q.url.endsWith('/messages') ? {content: [{type: 'text', text: t}], usage: {input_tokens: o.inTok || 1000, output_tokens: 50}} : {choices: [{message: {content: t}}], usage: {prompt_tokens: 1000, completion_tokens: 50}}); }
    st.gh.push({method: q.method, url: q.url, body: j});
    if (/\/issues\/7\/comments/.test(q.url)) {
      if (q.method === 'POST') { st.comments.push({id: st.next++, body: j.body}); if (/hq-say/.test(j.body) && st.queue.length) st.comments.push({id: st.next++, body: '💬 Владелец: ' + st.queue.shift()}); return send(201, {}); }
      return send(200, /page=1/.test(q.url) ? st.comments : []); }
    if (/\/pulls\?state=open/.test(q.url)) return send(200, o.pulls || []);
    if (/\/check-runs/.test(q.url)) return send(200, {check_runs: o.checks || []});
    if (/\/pulls\/\d+\/merge$/.test(q.url)) { st.merged = true; return send(200, {merged: true}); }
    send(404, {message: 'нет'}); }); });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res({st, srv, port: srv.address().port})));
}
function agent(port, extra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-sess-')), taskF = path.join(dir, 'task.md'), costF = path.join(dir, 'cost.json');
  fs.writeFileSync(taskF, '# Сеанс: тест\n\nСеанс с владельцем.\n<!-- hq-session:{"ceil":' + ((extra && extra.ceil) || 300) + '} -->\n');
  const env = Object.assign({}, process.env, {PROXYAPI_KEY: 'px-test', HQ_PX: 'http://127.0.0.1:' + port + '/v1', HQ_GH_API: 'http://127.0.0.1:' + port, GH_TOKEN: 'gh-test-token',
    GITHUB_REPOSITORY: 'o/r', HQ_ISSUE: '7', HQ_POLL_MS: '40', HQ_IDLE_MS: '600', HQ_COST_FILE: costF, HQ_GIT_PUSH: '0'}, (extra && extra.env) || {});
  return new Promise(res => { let out = ''; const p = spawn(process.execPath, [path.join(ROOT, 'tools/hq-agent.js'), '--session', '--model', 'sonnet', '--task', taskF], {cwd: ROOT, env});
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); p.on('close', code => res({code, out})); });
}
const says = st => st.comments.filter(c => /<!-- hq-say -->/.test(c.body));

test('Сеанс: реплика владельца → GREP → SAY с ценой хода; тишина → итог и выход', async () => {
  const f = await fake({comments: ['💬 Владелец: где живёт командная строка исполнителя?'], replies: ['GREP: forbidden\\(cmd в tools/', 'SAY: В tools/hq-run.js — функция forbidden проверяет команды.']});
  try {
    const r = await agent(f.port); assert.equal(r.code, 0, r.out);
    const s = says(f.st); assert.equal(s.length, 2, 'ответ и итог');
    assert.match(s[0].body, /^В tools\/hq-run\.js/); assert.match(s[0].body, /Ход ~[\d.]+ ₽ · сеанс ~[\d.]+ ₽/); assert.match(s[0].body, /<!-- hq:\{"rub":[\d.]+,"total":[\d.]+/);
    assert.match(s[1].body, /Сеанс закрыт: 20 минут тишины/); assert.match(s[1].body, /hq-session-end/);
    /* второй вызов модели видит результат GREP; Claude — через /v1/messages с кэшем системного промпта (в нём карта проекта) */
    const second = f.st.px[1]; assert.equal(second.url, '/v1/messages'); assert.match(JSON.stringify(second.body.messages), /tools\/hq-run\.js:\d+/);
    assert.equal(second.body.system[0].cache_control.type, 'ephemeral'); assert.match(second.body.system[0].text, /ОГЛАВЛЕНИЕ index\.html/);
    assert.doesNotMatch(JSON.stringify(f.st.px), /gh-test-token|px-test/, 'ключи модели не видит');
  } finally { f.srv.close(); }
});

test('Сеанс: MERGE без «влей» — отказ; «влей» при красной проверке — отказ, PR не вливается', async () => {
  const pulls = [{number: 5, html_url: 'https://github.com/o/r/pull/5', head: {sha: 'abc'}}];
  let f = await fake({comments: ['💬 Владелец: посмотри PR'], replies: ['MERGE', 'SAY: Без твоего «влей» не вливаю.'], pulls, checks: [{name: 'check (1)', status: 'completed', conclusion: 'success'}]});
  try { const r = await agent(f.port); assert.equal(r.code, 0, r.out); assert.equal(f.st.merged, false); assert.match(JSON.stringify(f.st.px[1].body.messages), /ОТКАЗ: владелец в этом сеансе не писал «влей»/); }
  finally { f.srv.close(); }
  f = await fake({comments: ['💬 Владелец: влей'], replies: ['MERGE', 'SAY: Проверка красная — не вливаю.'], pulls, checks: [{name: 'check (2)', status: 'completed', conclusion: 'failure', html_url: 'https://github.com/o/r/actions/runs/9/job/1'}]});
  try { const r = await agent(f.port); assert.equal(r.code, 0, r.out); assert.equal(f.st.merged, false, 'красная проверка — не вливаем');
    assert.match(JSON.stringify(f.st.px[1].body.messages), /ОТКАЗ: проверка PR красная: check \(2\) — failure/); }
  finally { f.srv.close(); }
  /* «влей» и зелёная проверка — вливает */
  f = await fake({comments: ['💬 Владелец: влей'], replies: ['MERGE', 'SAY: Влито.'], pulls, checks: [{name: 'check (1)', status: 'completed', conclusion: 'success'}, {name: 'server', status: 'completed', conclusion: 'skipped'}]});
  try { const r = await agent(f.port); assert.equal(r.code, 0, r.out); assert.equal(f.st.merged, true); assert.ok(f.st.gh.some(x => x.method === 'PUT' && /\/pulls\/5\/merge$/.test(x.url))); }
  finally { f.srv.close(); }
});

test('Сеанс: история больше порога — старые ходы заменяются сводкой Haiku', async () => {
  const f = await fake({comments: ['💬 Владелец: первое'], queue: ['второе', 'третье'], inTok: 5000, haiku: 'Сводка: смотрели hq-run.js, решили ничего не менять.',
    replies: ['GREP: forbidden в tools/', 'SAY: раз', 'READ: tools/hq-run.js 1 5', 'SAY: два', 'SAY: три']});
  try {
    const r = await agent(f.port, {env: {HQ_COMPRESS_TOKENS: '3000'}}); assert.equal(r.code, 0, r.out);
    const hk = f.st.px.filter(x => /haiku/.test(x.body.model)); assert.ok(hk.length >= 1, 'Haiku вызван для сводки'); assert.match(JSON.stringify(hk[0].body), /сжимаешь историю/);
    const after = f.st.px.filter(x => !/haiku/.test(x.body.model)).slice(-1)[0]; assert.match(JSON.stringify(after.body.messages[0]), /СВОДКА ПРОШЛЫХ ХОДОВ СЕАНСА/);
    assert.match(r.out, /история сжата/); assert.equal(says(f.st).length, 4);
  } finally { f.srv.close(); }
});

test('Сеанс: потолок цены — пауза и вопрос; «стоп» — выход', async () => {
  const f = await fake({comments: ['💬 Владелец: начни'], queue: ['стоп'], replies: ['SAY: начал']});
  try { const r = await agent(f.port, {ceil: 0.01}); assert.equal(r.code, 0, r.out);
    assert.ok(f.st.comments.some(c => /Потолок сеанса 0\.01 ₽ исчерпан/.test(c.body))); assert.match(f.st.comments[f.st.comments.length - 1].body, /Сеанс закрыт: владелец сказал «стоп»/); }
  finally { f.srv.close(); }
});

test('Предпросмотр: страница из ТЗ и адрес на ветке preview', () => {
  const P = require('../tools/hq-preview.js');
  assert.equal(P.pageOf('Кнопка внизу разбора #/ng3/8, без лишнего'), '#/ng3/8');
  assert.equal(P.pageOf('Панель в пульте me/ — вкладка «Здоровье»'), 'me/');
  assert.equal(P.pageOf('Поменять шрифт'), '#/');
  assert.equal(P.pageUrl('https://raw.githack.com/o/r/preview', '#/ng3/8'), 'https://raw.githack.com/o/r/preview/index.html#/ng3/8');
  assert.equal(P.pageUrl('https://preview.nachert1830.ru/', 'me/'), 'https://preview.nachert1830.ru/me/index.html');
  assert.equal(P.pageUrl('https://p.ru', 'lk/#/ask'), 'https://p.ru/lk/index.html#/ask');
});
