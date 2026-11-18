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
