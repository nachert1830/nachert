/* Трассировка происхождения на всех задачах: включает протяжку поля через построения G, заново выполняет
   каждый блок задач тетради (так у производных точек появляется поле), проверяет; ДЗ и типовые РК проверяются
   по прямым пометкам F/H. node tests/provenance-run.js — отдельный прогон. */
const fs=require('fs'), path=require('path');
const R=require('./random.js'), {isolate}=require('./random-run.js');
async function runProvenance(page){
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'provenance.js'),'utf8')});
  await page.evaluate(()=>{ PROV_INSTRUMENT(); window.PROV_STATS={pts:0,traced:0,segs:0,segTraced:0}; });
  const out=[];
  for(const b of R.blocks()){
    const r=await page.evaluate(src=>{
      const keep=WB3.tasks.slice(), old=new Set(keep); let added=[], err=null; window.__RVERR=[];
      try{ (0,eval)(src); added=WB3.tasks.filter(t=>!old.has(t)); }catch(e){ err=String(e&&e.message||e); }
      WB3.tasks.length=0; keep.forEach(t=>WB3.tasks.push(t));
      return err?[{name:'блок',rule:'сбой',msg:err,lvl:'ошибка'}]:PROV_CHECK({tasks:added}); },isolate(b.src));
    out.push(...r); }
  out.push(...await page.evaluate(()=>{ const r=[];
    try{ (typeof TK3!=='undefined'?TK3:[]).forEach(tk=>r.push(...PROV_CHECK({tasks:tk.tasks.map(t=>Object.assign({},t,{n:t.idx||t.key})),prefix:tk.title+' · '}))); }catch(e){}
    try{ ['1','2','3','4a','4b','5'].forEach(id=>{ const d=window.NGHW&&NGHW.get(id); if(d&&d.task) r.push(...PROV_CHECK({tasks:[Object.assign({},d.task,{n:id})],prefix:'ДЗ '})); }); }catch(e){}
    return r; }));
  const stats=await page.evaluate(()=>PROV_STATS);
  return {issues:out,stats};
}
module.exports={runProvenance};
if(require.main===module)(async()=>{
  const http=require('http'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const ROOT=path.join(__dirname,'..');
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined});
  const page=await browser.newPage(); await page.goto('http://127.0.0.1:'+srv.address().port+'/'); await page.waitForTimeout(1500);
  const {issues,stats}=await runProvenance(page);
  issues.forEach(o=>console.log(o.name+' | '+o.rule+' | '+o.msg));
  console.log('\nПроисхождение: точек с подписью '+stats.pts+', прослежено '+stats.traced+' ('+Math.round(100*stats.traced/Math.max(1,stats.pts))+'%); отрезков '+stats.segs+', прослежено '+stats.segTraced+' ('+Math.round(100*stats.segTraced/Math.max(1,stats.segs))+'%); замечаний '+issues.length);
  await browser.close(); srv.close();
})().catch(e=>{ console.error(e); process.exit(2); });
