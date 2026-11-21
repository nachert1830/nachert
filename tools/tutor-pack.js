/* Наставник: пакет знаний ДЗ №4 по ИГ (server/lib/tutor/ig4.json) — из того же кода, что рисует решение на сайте.
   Для каждого из 30 вариантов — IG4S.tutor(n): шаги и точки с координатами из 3D-модели; плюс методика ДЗ (method.js).
   node tools/tutor-pack.js          — собрать и записать (≈ 1 мин, браузер Playwright)
   node tools/tutor-pack.js --check  — только сравнить с файлом: код выхода 1, если решение на сайте поменялось, а пакет нет
   Тот же снимок делает tests/tutor.js (выборочно), поэтому забытая пересборка видна в проверке сайта. */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..'), OUT=path.join(ROOT,'server','lib','tutor','ig4.json');

/* снимок в браузере: страница сайта уже открыта, DZR и IG4S загружены */
function snapshot(list){ /* выполняется в браузере */
  const txt=h=>String(h==null?'':h).replace(/<li>/g,'\n• ').replace(/<br\s*\/?>/g,'\n').replace(/<\/p>\s*<p>/g,'\n').replace(/<[^>]+>/g,'')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/[ \t]+\n/g,'\n').trim();
  const D=DZR.get('ig4'), M=D.method, T=M.types&&M.types.all||{};
  const method={essence:txt(M.essence),idea:txt(M.idea),plan:(T.plan||[]).map(p=>({t:txt(p.t),d:txt(p.d),why:txt(p.why)})),answer:txt(T.answer),
    check:(T.check||[]).map(txt),mistakes:(M.mistakes||[]).map(txt),defense:(M.defense||[]).map(q=>({q:txt(q.q),a:txt(q.a)})),sheet:(M.sheet||[]).map(txt)};
  const variants={};
  list.forEach(n=>{ const m=D.part(n); if(!m) return; const t=IG4S.tutor(m);
    variants[n]={title:t.title,note:txt(m.note||''),steps:t.steps.map(s=>({k:s.k,id:s.id,title:s.title,short:s.short,more:s.more,
      points:s.points.map(p=>({n:p.n,x:p.x,y:p.y,z:p.z,how:p.how}))}))}; });
  return {dz:'ig4',title:D.title,label:D.label,text:txt(D.text),method,variants}; }

function serve(){ return new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.js')?'text/javascript':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); }); }

/* пакет без даты и прочего шума: одинаковый код — одинаковый файл */
const stringify=o=>JSON.stringify(o,null,0).replace(/\},\{"k"/g,'},\n{"k"').replace(/\},"(\d+)":\{/g,'},\n"$1":{')+'\n';

async function build(page,list){ return page.evaluate(snapshot,list); }
module.exports={snapshot,build,OUT,stringify};

if(require.main===module)(async()=>{
  let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const check=process.argv.includes('--check'), srv=await serve();
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage(), errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/#/ig/dz/4/1'); await page.waitForFunction(()=>window.IG4S&&window.DZR&&DZR.get('ig4'),null,{timeout:30000});
  const pack=await build(page,Array.from({length:30},(_,i)=>i+1)); await browser.close(); srv.close();
  const n=Object.keys(pack.variants).length; if(n!==30||errs.length){ console.error('✖ собрано вариантов '+n+' из 30'+(errs.length?'; ошибки JS: '+errs.join(' / '):'')); process.exit(1); }
  const out=stringify(pack);
  if(check){ const cur=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8'):''; if(cur===out){ console.log('Пакет наставника совпадает с решением на сайте.'); return; }
    console.error('✖ Пакет наставника устарел: решение ДЗ №4 на сайте поменялось. Пересоберите: node tools/tutor-pack.js'); process.exit(1); }
  fs.mkdirSync(path.dirname(OUT),{recursive:true}); fs.writeFileSync(OUT,out);
  console.log('Записан '+path.relative(ROOT,OUT)+': 30 вариантов, '+Math.round(out.length/1024)+' КБ');
})().catch(e=>{ console.error(e); process.exit(1); });
