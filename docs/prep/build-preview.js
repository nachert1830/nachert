/* Предпросмотр подготовки одной страницей (для просмотра вне сайта): node docs/prep/build-preview.js [файл.html] */
const fs=require('fs'), R='/home/user/nachert/';
const files=['kernel/prep.js','prep/engine.js','prep/x.js','prep/x-b.js','prep/t.js','prep/base.js','prep/sm.js','prep/more.js','prep/rest.js','prep/space.js','prep/plans.js'];
const js=files.map(f=>'/* '+f+' */\n'+fs.readFileSync(R+f,'utf8').replace(/<\/script/gi,'<\\/script')).join('\n');
const osi=fs.readFileSync(R+'fonts/osifont-italic.woff2').toString('base64'), ser=fs.readFileSync(R+'fonts/liberation-serif-italic.woff2').toString('base64');
const router=`(function(){
  var v=document.getElementById('view');
  function go(h){ document.body.classList.remove('inplayer'); var p=h.replace(/^#\\/?/,'').split('/').filter(Boolean); var t=PREP.view(v,{s:'prep',tab:p[1]||null,item:p[2]||null}); document.title=(t||'Подготовка')+' · Начерт'; window.scrollTo(0,0); }
  document.addEventListener('click',function(e){ var a=e.target.closest('a[href^="#/prep"]'); if(!a) return; e.preventDefault(); go(a.getAttribute('href')); });
  go('#/prep');
})();`;
const css=`@font-face{font-family:'NchGost';src:url(data:font/woff2;base64,${osi}) format('woff2')}
@font-face{font-family:'NchSerif';font-style:italic;src:url(data:font/woff2;base64,${ser}) format('woff2')}
/* Раскладка — как на сайте (#/prep): программа списком, тема на весь экран. Токены — как у сайта. */
:root{--paper:#f7f8fb;--surf:#ffffff;--surf2:#f3f5fa;--ink:#121a3f;--ink2:#2e3961;--mut:#5c6688;--line:#e1e5ef;--acc:#1f3fbf}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--paper:#0e131b;--surf:#161d28;--surf2:#1c2533;--ink:#e8ecf3;--ink2:#c9d1de;--mut:#9aa5b6;--line:#263040;--acc:#5b8cff;color-scheme:dark}}
:root[data-theme=dark]{--paper:#0e131b;--surf:#161d28;--surf2:#1c2533;--ink:#e8ecf3;--ink2:#c9d1de;--mut:#9aa5b6;--line:#263040;--acc:#5b8cff;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.4 'Golos Text',system-ui,sans-serif}
#view{min-height:100%;outline:none}
.wrap.page{max-width:760px;margin:0 auto;padding-block:16px 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
body.inplayer{overflow:hidden}
body.inplayer #view{height:100%}
.box{background:var(--surf);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
h1{font-size:clamp(24px,5vw,32px);margin:0;line-height:1.1}
a{color:var(--acc)}`;
const html=`<title>Подготовка по начерту</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap">
<style>
${css}
</style>
<div id="view" tabindex="-1"></div>
<script>
${js}
</script>
<script>
${router}
</script>`;
fs.writeFileSync(process.argv[2]||'prep-preview.html',html); console.log((html.length/1024).toFixed(0)+' КБ');
