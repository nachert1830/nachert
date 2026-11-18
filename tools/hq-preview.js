#!/usr/bin/env node
/* Предпросмотр задачи Цеха: скриншоты страницы «как будет» (и «как было») на телефоне и компьютере.
   node tools/hq-preview.js --root <папка сайта> --page <#/адрес | me/ | lk/…> --out <путь без расширения>
   Пишет <out>-phone.png (390×844) и <out>-desktop.png (1280×800). Сайт отдаётся локальным сервером из --root — без сети.
   Ссылку на живой предпросмотр строит pageUrl(база, страница): ветка preview, которую Цех обновляет перед твоим «влить». */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');

/* страница из ТЗ: первый «#/адрес» или «me/…», «lk/…»; по умолчанию — главная */
function pageOf(text) {
  const m = /(#\/[A-Za-z0-9_\/-]+)|(?:^|[\s(«"'`])((?:me|lk)\/[A-Za-z0-9_\/#-]*)/.exec(String(text || ''));
  return m ? (m[1] || m[2]) : '#/';
}
/* адрес страницы на предпросмотре: база — https://preview.nachert1830.ru или https://raw.githack.com/<репо>/preview */
function pageUrl(base, page) {
  base = String(base || '').replace(/\/+$/, ''); page = page || '#/';
  if (page.startsWith('#')) return base + '/index.html' + page;
  const [p, h] = page.split('#'), file = p.endsWith('/') ? p + 'index.html' : p;
  return base + '/' + file + (h != null ? '#' + h : '');
}

async function shots(root, page, out) {
  const {chromium} = require('playwright');
  const srv = await new Promise(res => { const s = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
    const p = path.join(root, f); if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, {'Content-Type': {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2'}[path.extname(p)] || 'application/octet-stream'});
    fs.createReadStream(p).pipe(r); }).listen(0, '127.0.0.1', () => res(s)); });
  const b = await chromium.launch({executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined}).catch(() => chromium.launch());
  const url = pageUrl('http://127.0.0.1:' + srv.address().port, page), errs = [];
  try {
    for (const [name, vp] of [['phone', {width: 390, height: 844}], ['desktop', {width: 1280, height: 800}]]) {
      const pg = await b.newPage({viewport: vp, deviceScaleFactor: 1}); pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
      await pg.goto(url).catch(e => errs.push(e.message)); await pg.waitForTimeout(1500);
      await pg.screenshot({path: out + '-' + name + '.png'}); await pg.close();
    }
  } finally { await b.close(); srv.close(); }
  return errs;
}

if (require.main === module) {
  const A = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : ''; };
  shots(path.resolve(A('root') || '.'), A('page') || '#/', A('out') || '/tmp/shot')
    .then(errs => { if (errs.length) console.log('Ошибки JS: ' + errs.slice(0, 3).join(' / ')); })
    .catch(e => { console.error('Скриншоты не вышли: ' + e.message); process.exit(1); });
}
module.exports = {pageOf, pageUrl, shots};
