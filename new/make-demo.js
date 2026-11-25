/* Демо копии /new/ одной страницей (артефакт, чтобы смотреть и править вместе с владельцем):
   новая главная (shell.*) и колода «ДЗ» (dzdeck.*) + нижняя панель оригинала (Тетрадь · ДЗ · Главная · РК · Теория).
   Данные ДЗ, «Путь к сдаче» и панель с её стилями снимаются с живой копии в браузере, поэтому демо совпадает с /new/.
   В демо открываются только «Главная» и «ДЗ»; остальные адреса — подсказка.
   Запуск: node new/make-demo.js <выходной.html>   (нужен Playwright) */
const {chromium} = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = process.argv[2] || path.join(ROOT, 'new-demo.html');
const MIME = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

(async () => {
  const srv = await new Promise(res => { const s = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
    const p = path.join(ROOT, f); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': MIME[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); }).listen(0, '127.0.0.1', () => res(s)); });
  const b = await chromium.launch(); const ctx = await b.newContext({viewport: {width: 390, height: 844}});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('nch-preview-ok', '1'); } catch (e) {} });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:' + srv.address().port + '/new/#/', {waitUntil: 'load'}); await p.waitForTimeout(1500);
  const X = await p.evaluate(() => {
    const nav = document.getElementById('navBot'), els = [nav, ...nav.querySelectorAll('*')];
    const hit = sel => { const s = sel.replace(/::?(before|after|hover|active|focus-visible|focus|placeholder)\b/g, '').replace(/:not\(\)/g, ''); try { return els.some(e => e.matches(s || '*')); } catch (e) { return false; } };
    const out = [];
    const walk = (rules, wrap) => { for (const r of rules) {
      if (r.type === 1) { const sels = r.selectorText.split(',').map(x => x.trim()).filter(x => /nav|nv|nvh|\.ns\b|\.nl\b|soon/.test(x) && hit(x));
        if (sels.length) out.push(wrap(sels.join(',') + '{' + r.style.cssText + '}')); }
      else if (r.type === 4) walk(r.cssRules, t => wrap('@media ' + r.conditionText + '{' + t + '}'));
    } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules, t => t); } catch (e) {} }
    const css = out.join('\n'), vars = {}, cs = getComputedStyle(document.documentElement);
    const need = new Set(css.match(/--[\w-]+/g) || []); let grew = true;
    while (grew) { grew = false; for (const v of [...need]) { const val = cs.getPropertyValue(v).trim(); if (val && !(v in vars)) { vars[v] = val; (val.match(/--[\w-]+/g) || []).forEach(x => { if (!need.has(x)) { need.add(x); grew = true; } }); } } }
    const list = DZR.list().map(d => ({id: d.id, course: d.course, num: d.num, title: d.title, method: !!d.method}));
    const has = {}; list.forEach(d => { has[d.id] = []; for (let n = 1; n <= 30; n++) if (DZR.has(d.id, n)) has[d.id].push(n); });
    const paths = {}; list.forEach(d => { try { paths[d.id] = window.dzPath(DZR.get(d.id)); } catch (e) {} });
    return {nav: nav.outerHTML, css, vars, list, has, paths};
  });
  await b.close(); srv.close();

  /* адреса сайта → маленький роутер демо (в артефакте адрес страницы не меняем) */
  const route = js => js.replace(/location\.hash=([^;]+);/g, '__R.go($1);').replace(/location\.hash/g, '__R.h').replace(/location\.href=url;/g, '__R.go("#/login");');
  const shellJs = route(read('new/shell.js')), deckJs = route(read('new/dzdeck.js'));
  const root = ':root{' + Object.entries(X.vars).map(([k, v]) => k + ':' + v).join(';') + '}';

  const html = `<title>Новый Начерт</title>
<meta name="description" content="Демо копии /new/: новая главная и колода ДЗ, нижняя панель оригинала">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800;900&family=Geologica:wght@400;600;700&display=swap">
<style>
${root}
:root{color-scheme:light;--tabh:64px;--tap:44px;--sans:'Golos Text',system-ui,-apple-system,'Segoe UI',sans-serif;--disp:'Geologica','Golos Text',system-ui,sans-serif}
html,body{height:100%;margin:0;background:#e9e9ec;font-family:var(--sans)}
/* ── стили копии ── */
${read('new/shell.css')}
${read('new/dzdeck.css')}
/* ── нижняя панель оригинала ── */
${X.css}
/* ── рамка демо: на широком экране — телефон посередине, на узком — во весь экран.
   transform у рамки делает её «экраном» для всех fixed-слоёв внутри ── */
#ph{position:fixed;inset:0;transform:translateZ(0);overflow:hidden;background:#fff}
@media(min-width:620px) and (min-height:700px){#ph{inset:auto;left:50%;top:50%;width:390px;height:min(844px,calc(100% - 40px));translate:-50% -50%;border-radius:44px;box-shadow:0 0 0 10px #111113,0 30px 80px -20px rgba(0,0,0,.45)}}
#ns-gate{display:none!important}
/* копия прячет всё рядом с колодой (body > :not(#nd)) — рамка демо должна остаться видимой */
html.nd-on body > #ph#ph#ph{visibility:visible!important}
#ph .nav-bot{display:grid!important;position:absolute!important;z-index:2147480050!important;visibility:visible!important}
html.nd-on #ph #nd .tabs{display:none!important}
#ph #nd .det,#ph #nd .sheet{padding-bottom:calc(var(--tabh) + 24px)}
#ph #ns .view{padding-bottom:calc(var(--tabh) + 28px)!important}
#ph #ns .sheet,#ph #ns .how{bottom:calc(var(--tabh) + 8px)!important}
#dm-toast{position:absolute;left:16px;right:16px;bottom:calc(var(--tabh) + 14px);z-index:2147480060;padding:12px 16px;border-radius:16px;background:#111113;color:#fff;font:600 14px/1.35 var(--sans);text-align:center;opacity:0;translate:0 10px;transition:opacity .2s,translate .2s;pointer-events:none}
#dm-toast.on{opacity:1;translate:0 0}
</style>
<div id="ph">${X.nav}<div id="dm-toast" role="status" aria-live="polite"></div></div>
<script>
/* роутер демо: «Главная» (#/) и «ДЗ» (#/dz) — настоящие экраны копии, остальное — подсказка */
window.__R={h:'#/',go:function(h){h=String(h||'#/').replace(/^.*#/,'#');if(h==='#'||h==='')h='#/';
  if(h==='#/'||/^#\\/dz\\/?$/.test(h)){if(h!==this.h){this.h=h;window.dispatchEvent(new Event('hashchange'));}paintNav();return;}
  toast(h==='#/login'?'Вход — в настоящей копии /new/':'Это раздел сайта — в демо открываются «Главная» и «ДЗ»');}};
function toast(t){var el=document.getElementById('dm-toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(function(){el.classList.remove('on');},1800);}
function paintNav(){var dz=__R.h!=='#/';document.querySelectorAll('#navBot a.nv').forEach(function(a){var h=a.getAttribute('href')||'',on=dz?/^#\\/dz/.test(h):h==='#/';a.classList.toggle('on',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');if(!/^(#|\\.?\\/?#)/.test(h)&&!/^\\/?[a-z]/i.test(h))return;e.preventDefault();__R.go(h.indexOf('#')>=0?h.slice(h.indexOf('#')):'#/x');},true);
/* данные ДЗ — сняты с копии */
var DATA=${JSON.stringify({list: X.list, has: X.has, paths: X.paths})};
window.DZR={list:function(){return DATA.list;},has:function(id,n){return (DATA.has[id]||[]).indexOf(n)>=0;}};
window.dzPath=function(d){return DATA.paths[d.id]||null;};
var VAR=0;window.dzVar=function(){return VAR;};window.dzSetVar=function(n){VAR=n;};
</script>
<script>
${shellJs}
</script>
<script>
${deckJs}
</script>
<script>
/* слои копии — внутрь рамки телефона */
(function(){var ph=document.getElementById('ph');['ns','nd'].forEach(function(id){var el=document.getElementById(id);if(el)ph.insertBefore(el,ph.firstChild);});paintNav();})();
</script>
`;
  fs.writeFileSync(OUT, html);
  console.log(OUT, (html.length / 1024).toFixed(0) + ' КБ, ДЗ: ' + X.list.length + ', правил панели: ' + X.css.split('\n').length);
})();
