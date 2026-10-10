/* ═══════════ Сертифицированный эпюр: прогон сертификатов ═══════════
   node tests/certified/run.js            — сертификаты задач против опубликованного сайта
   node tests/certified/run.js --faults   — то же + показ: какие подсаженные ошибки какое обязательство ловит */
const fs=require('fs'), path=require('path');
const {certify}=require('./certify.js');
const TASKS=[require('./t47.js'),require('./t46.js')];

/* опубликованный чертёж и ответ — со страницы (то, что видит студент) */
async function siteData(page,n){ return page.evaluate(n=>{
  const t=WB3.get(n), parts=(t.parts&&t.parts.length)?t.parts:[t], p=parts[0];
  const items=[].concat(p.given||t.given||[],...(p.steps||[]).map(s=>s.add||[])).filter(Boolean);
  const strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').trim();
  const points={}, lines={}, segs=[];
  items.forEach(it=>{ if(it.t==='pt'&&it.at&&it.l) strip(it.l).split(/\s*≡\s*/).forEach(l=>{ if(!points[l]) points[l]=it.at.slice(); });
    if((it.t==='seg'||it.t==='line')&&it.a&&it.b&&it.l){ const l=strip(it.l); (lines[l]=lines[l]||[]).push(it.a.slice(),it.b.slice()); }
    if(it.t==='seg'&&it.a&&it.b) segs.push({a:it.a.slice(),b:it.b.slice(),k:it.k||'main'}); });
  return {points,lines,segs,ans:strip(t.ans)}; },n); }

async function runCertificates(page,opts){ opts=opts||{}; const out=[];
  for(const T of TASKS){ const site=page?await siteData(page,T.n):null; out.push(certify(T,{site,variants:opts.variants||200})); }
  return out; }

const clone=T=>Object.assign({},T,{steps:T.steps.slice(),entries:T.entries.slice()});

module.exports={runCertificates,siteData,TASKS,clone};

if(require.main===module)(async()=>{
  const http=require('http'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const ROOT=path.join(__dirname,'..','..');
  const srv=await new Promise(res=>{ const s=http.createServer((qq,r)=>{ let f=decodeURIComponent(qq.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined});
  const page=await browser.newPage(); await page.goto('http://127.0.0.1:'+srv.address().port+'/'); await page.waitForTimeout(1500);
  const show=c=>{ console.log('Задача №'+c.n+': '+(c.ok?'СЕРТИФИКАТ ВЫДАН':'НЕ ПРОШЛА'));
    Object.entries(c.O).forEach(([k,o])=>console.log('  '+k+' '+(o.ok?'✓':'✗')+' '+o.detail)); };
  (await runCertificates(page)).forEach(show);
  if(process.argv.includes('--faults')){
    console.log('\nПодсаженные ошибки:');
    for(const T of TASKS){ const site0=await siteData(page,T.n); console.log('Задача №'+T.n+':');
      for(const f of (T.faults||[])){ const t=clone(T); if(f.apply) f.apply(t); const site=JSON.parse(JSON.stringify(site0)); if(f.site) f.site(site);
        const c=certify(t,{site,variants:60}); const failed=Object.entries(c.O).filter(([k,o])=>!o.ok);
        console.log('• '+f.what+'\n    '+(failed.length?'поймано: '+failed.map(([k,o])=>k+' — '+o.detail).join('\n            '):'НЕ ПОЙМАНО')); } } }
  await browser.close(); srv.close();
})().catch(e=>{ console.error(e); process.exit(2); });
