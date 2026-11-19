#!/usr/bin/env node
/* Пороги ночной проверки (.github/workflows/nightly.yml).
   node tests/nightly-check.js adequacy файл.json — полный замер мутаций кода (tests/adequacy.js --out): пороги те же, что в tests/run.js
   node tests/nightly-check.js sizes            — полный перебор чисел на чертежах (MUTATE_SIZES) и с текстом, и только по чертежу */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const mode = process.argv[2];
/* пороги: не ниже, чем в run.js; доля мутаций кода — не ниже зафиксированной в tests/timings… нет: в docs/thesis.json (M.code.by.всего.euc) */
function thesisShare() { try { const t = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs/thesis.json'), 'utf8')).M.code.by['всего']; return t.euc / t.n; } catch (e) { return 0.72; } }
if (mode === 'adequacy') {
  const r = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), t = r.by['всего'], fh = r.by['F↔H'], ct = r.cby['всего'], bad = [];
  const pc = (a, n) => Math.round(1000 * a / n) / 10 + ' %';
  console.log('Мутации кода (полный замер): ' + t.euc + ' из ' + t.n + ' (' + pc(t.euc, t.n) + '); F↔H ' + (fh ? fh.all + '/' + fh.n : '—') + '; с сертификатом ' + (ct ? ct.cert + '/' + ct.n : '—'));
  if (fh && fh.all / fh.n < 0.75) bad.push('подмена поля F↔H ловится в ' + pc(fh.all, fh.n) + ' (порог 75 %)');
  if (ct && ct.cert / ct.n < 0.85) bad.push('в задачах с сертификатом ловится ' + pc(ct.cert, ct.n) + ' (порог 85 %)');
  const floor = thesisShare() - 0.03;   /* другая выборка мутантов (per=4, не 2): допуск на разброс выборки — 3 п. п. */
  if (t.euc / t.n < floor) bad.push('доля пойманных мутаций кода ' + pc(t.euc, t.n) + ' ниже зафиксированной (' + pc(floor + 0.03, 1) + ' − 3 п. п.)');
  (r.baseErr || []).forEach(e => bad.push('блок задач не выполняется: ' + e));
  bad.forEach(b => console.log('✗ ' + b)); process.exit(bad.length ? 1 : 0);
}
if (mode === 'sizes') (async () => {
  let chromium; try { ({chromium} = require('playwright')); } catch (e) { ({chromium} = require('/opt/node-tools/node_modules/playwright')); }
  const ROOT = path.join(__dirname, '..');
  const srv = await new Promise(res => { const s = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
    const p = path.join(ROOT, f); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, {'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0, '127.0.0.1', () => res(s)); });
  const browser = await chromium.launch({executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined});
  const page = await browser.newPage(); await page.goto('http://127.0.0.1:' + srv.address().port + '/');
  await require('./ready.js')(page);
  for (const f of ['geometry', 'mutate']) await page.addScriptTag({content: fs.readFileSync(path.join(__dirname, f + '.js'), 'utf8')});
  const a = await page.evaluate(() => MUTATE_SIZES()), b = await page.evaluate(() => MUTATE_SIZES({noText: true}));
  console.log('Числа на чертежах, с текстом задачи: ' + a.поймано + ' из ' + a.всего + (a.пропуски.length ? ' — пропуски: ' + a.пропуски.join('; ') : ''));
  console.log('только по чертежу (без текста): ' + b.поймано + ' из ' + b.всего + ' (справочно)');
  await browser.close(); srv.close();
  if (a.поймано / a.всего < 0.95) { console.log('✗ ниже порога 95 %'); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
