/* Наставник: база знаний курса (server/lib/tutor/kb.json) — из того же поискового индекса, что поиск сайта (SEARCH.docs()):
   темы, уроки, теория РК (вопросы с ответами), теория ЕСКД, шпаргалки, задачи и ДЗ, тесты, инструменты. У каждой записи —
   адрес страницы на сайте (href), чтобы Лука мог открыть её студенту. Сервер ищет по базе сам (server/lib/tutor/kb.js),
   модель получает найденные отрывки инструментами search_course / read_page; числа из них — факты для сверщика.
   node tools/tutor-kb.js           — собрать и записать (≈ 20 с, браузер Playwright)
   node tools/tutor-kb.js --check   — только сравнить с файлом: код выхода 1, если тексты на сайте поменялись, а база — нет.
   Тот же снимок делает tests/tutor.js, поэтому забытая пересборка видна в проверке сайта. */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..'), OUT=path.join(ROOT,'server','lib','tutor','kb.json');
const TEXT_MAX=5000;

/* выполняется в браузере: страница сайта открыта, SEARCH загружен */
function snapshot(max){
  const clean=s=>String(s==null?'':s).replace(/\s+/g,' ').replace(/(\s*\.){2,}/g,'.').replace(/\s+([.,;:!?])/g,'$1').trim();
  const docs=SEARCH.docs().filter(d=>d&&d.key&&d.href&&/^#\//.test(d.href)).map(d=>{
    let text=(d.segs||[]).map(s=>{ const t=clean(s.t); return t?(s.l?clean(s.l)+': ':'')+t:''; }).filter(Boolean).join('\n');
    if(text.length>max) text=text.slice(0,max).replace(/\s\S*$/,'')+'…';
    return {key:String(d.key),type:String(d.type||''),title:clean(d.title),where:clean(d.where),href:String(d.href),
      kw:[...new Set((d.kw||[]).concat(d.sym||[]).map(clean).filter(x=>x&&x.length<80))].slice(0,24),text}; })
    .filter(d=>d.title&&(d.text||d.kw.length));
  docs.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  return {about:'База знаний наставника — поисковый индекс сайта (SEARCH.docs). Собирает tools/tutor-kb.js.',docs}; }

const stringify=kb=>'{"about":'+JSON.stringify(kb.about)+',"docs":[\n'+kb.docs.map(d=>JSON.stringify(d)).join(',\n')+'\n]}\n';
async function build(page){ await page.waitForFunction(()=>window.SEARCH&&SEARCH.docs,null,{timeout:30000}); return page.evaluate(snapshot,TEXT_MAX); }
module.exports={snapshot,build,stringify,OUT};

function serve(){ const TY={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'};
  const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':TY[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); });
  return new Promise(res=>srv.listen(0,'127.0.0.1',()=>res(srv))); }

if(require.main===module)(async()=>{
  let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const check=process.argv.includes('--check'), srv=await serve();
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage(), errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.route(u=>!u.href.startsWith('http://127.0.0.1:'+srv.address().port),r=>r.abort());
  await page.addInitScript(()=>{ try{ localStorage.setItem('nch-preview-ok','1'); }catch(e){} });
  await page.goto('http://127.0.0.1:'+srv.address().port+'/new/');
  const kb=await build(page), out=stringify(kb); let fail=0;
  if(kb.docs.length<200||errs.length){ console.error('✖ база знаний: записей '+kb.docs.length+(errs.length?'; ошибки JS: '+errs.join(' / '):'')); fail=1; }
  else if(check){ const cur=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8'):'';
    if(cur===out) console.log('База знаний наставника совпадает с сайтом ('+kb.docs.length+' записей).');
    else { console.error('✖ база знаний наставника устарела — тексты на сайте поменялись. Пересоберите: node tools/tutor-kb.js'); fail=1; } }
  else { fs.writeFileSync(OUT,out); console.log('Записан '+path.relative(ROOT,OUT)+': '+kb.docs.length+' записей, '+Math.round(out.length/1024)+' КБ'); }
  await browser.close(); srv.close(); process.exit(fail);
})().catch(e=>{ console.error(e); process.exit(1); });
