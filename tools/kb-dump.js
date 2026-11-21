#!/usr/bin/env node
/* Выгрузка всего учебного текста сайта в одну базу знаний для ИИ-тренера: kb/site.json.
   Источник — поисковый индекс сайта (SEARCH.docs(): уроки, задачи тетради, разборы ДЗ, вопросы РК, шпаргалка, темы, уроки ИГ),
   его собирает сам index.html, поэтому база всегда совпадает с тем, что видит студент.  node tools/kb-dump.js */
'use strict';
const fs=require('fs'), path=require('path'), http=require('http');
const ROOT=path.join(__dirname,'..');
(async()=>{
  const {chromium}=require('playwright');
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)){ r.writeHead(404); return r.end(); }
    const ext=path.extname(p); r.writeHead(200,{'content-type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css'}[ext]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,()=>res(s)); });
  const browser=await chromium.launch(); const page=await browser.newPage();
  page.on('pageerror',e=>console.error('pageerror',e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/#/`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.SEARCH&&window.SEARCH.docs,null,{timeout:60000});
  await page.waitForTimeout(3000);
  const docs=await page.evaluate(()=>{ SEARCH.rebuild(); return SEARCH.docs().map(d=>({key:d.key,type:d.type,subj:d.subj,label:d.label,title:d.title,where:d.where,href:d.href,
    kw:d.kw&&d.kw.length?d.kw:undefined,sym:d.sym&&d.sym.length?d.sym:undefined,topic:d.topic,
    text:(d.segs||[]).filter(s=>s.t).map(s=>(s.l?s.l+': ':'')+s.t),err:d.err||undefined})); });
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(ROOT,'kb/site.json'),JSON.stringify(docs,null,0).replace(/\},\{"key"/g,'},\n{"key"'));
  const by={}; docs.forEach(d=>{ const k=d.subj+' · '+d.type; by[k]=(by[k]||0)+1; });
  console.log('kb/site.json:',docs.length,'документов'); Object.entries(by).sort().forEach(([k,n])=>console.log('  ',k,n));
})().catch(e=>{ console.error(e); process.exit(1); });
