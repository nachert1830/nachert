/* Тестовая версия сайта: копия ветки stage, которую .github/workflows/pages.yml кладёт в секретную папку nachert1830.ru/<STAGE_PATH>/.
   Запуск: node .github/scripts/stage.js <папка копии> <короткий хеш коммита>. Без внешних зависимостей.

   Что меняется в копии (ветка stage в репозитории остаётся как есть):
   - все страницы закрыты от поисковиков (noindex), в заголовке вкладки — «ТЕСТ ·», на главной — плашка с коммитом;
   - Метрика, Google и GoatCounter вычеркнуты из CSP главной: тестовые заходы не попадают в статистику и в счётчик просмотров;
   - кэши service worker'ов — со своим префиксом stage-, чтобы тестовая версия и настоящая не стирали кэш друг друга
     (они на одном адресе nachert1830.ru, у них общее хранилище браузера). */
const fs=require('fs'), path=require('path');
const [dir,sha='']=process.argv.slice(2);
if(!dir||!fs.existsSync(path.join(dir,'index.html'))){ console.error('нет папки копии с index.html'); process.exit(1); }

const warn=m=>console.log('::warning::Тестовая версия: '+m);
function edit(rel,fn){ const f=path.join(dir,rel); if(!fs.existsSync(f)) return; const a=fs.readFileSync(f,'utf8'), b=fn(a,rel); if(b!==a) fs.writeFileSync(f,b); }
/* замена, которая обязана сработать: если код изменился и образца больше нет — предупреждение в журнале, а не молча */
function must(s,from,to,what){ if(!(typeof from==='string'?s.includes(from):from.test(s))){ warn(what+' — образец не найден, проверьте .github/scripts/stage.js'); return s; } return s.replace(from,to); }

function html(d){ const out=[]; for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name);
  if(e.isDirectory()){ if(e.name!=='.git'&&e.name!=='node_modules') out.push(...html(p)); } else if(e.name.endsWith('.html')) out.push(p); } return out; }

const ROBOTS='<meta name="robots" content="noindex,nofollow">';
for(const f of html(dir)) edit(path.relative(dir,f),s=>{
  s=/<meta name="robots"[^>]*>/.test(s)?s.replace(/<meta name="robots"[^>]*>/,ROBOTS):s.replace(/<head[^>]*>/i,m=>m+'\n'+ROBOTS);
  return s.replace(/<title>/i,'<title>ТЕСТ · ');
});

edit('index.html',s=>{
  s=must(s,/(<meta http-equiv="Content-Security-Policy" content=")([^"]*)/,(m,a,csp)=>a+csp.replace(/\s+(https?|wss):\/\/[^\s;]*(yandex|google|goatcounter)[^\s;]*/g,''),'CSP главной');
  /* плашка: не перехватывает нажатия и не мешает читать — маленькая, слева над нижним меню телефона */
  const badge='<div style="position:fixed;left:8px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:2147483647;pointer-events:none;font:600 11px/1 system-ui,sans-serif;'
    +'padding:5px 8px;border-radius:6px;background:#d91a52;color:#fff;opacity:.85">ТЕСТ'+(sha?' · '+sha.replace(/[^0-9a-f]/gi,''):'')+'</div>';
  return must(s,/<\/body>(?![\s\S]*<\/body>)/,badge+'\n</body>','плашка «ТЕСТ»');
});

edit('sw.js',s=>must(must(s,"const C='","const C='stage-",'кэш сайта'),'ks.filter(k=>k!==C)',"ks.filter(k=>k!==C&&k.startsWith('stage-'))",'очистка кэша сайта'));
edit('lk/sw.js',s=>must(must(s,"const C='","const C='stage-",'кэш кабинета'),'/^(lk|club)-/','/^stage-(lk|club)-/','очистка кэша кабинета'));

fs.rmSync(path.join(dir,'CNAME'),{force:true});
console.log('тестовая версия подготовлена'+(sha?' (коммит '+sha+')':''));
