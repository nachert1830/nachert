/* ═══════════ Картинки вариантов ИГ для списка «найди свой вариант» ═══════════
   node dz/ig/make-thumbs.js            — задания 3 и 4, все 30 вариантов
   node dz/ig/make-thumbs.js ig3 7 12   — только эти варианты
   Картинка — данные изображения варианта (главный вид и вид сверху), как в начале страницы варианта на сайте;
   сохраняется в dz/ig/<N>/img/vNN.jpg. На телефоне каждое изображение считается несколько секунд — поэтому для
   списка из 30 карточек они нарисованы заранее. После правки models.js — перегенерировать изменённые варианты. */
const http=require('http'), fs=require('fs'), path=require('path');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..','..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const arg=process.argv.slice(2), only=arg.filter(a=>/^ig\d$/.test(a)), nums=arg.filter(a=>/^\d+$/.test(a)).map(Number);

(async()=>{
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:600,height:2000},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:'+srv.address().port+'/#/ig/dz'); await page.waitForTimeout(1500);
  for(const id of only.length?only:['ig3','ig4']){
    const dir=path.join(ROOT,'dz','ig',id.slice(2),'img'); fs.mkdirSync(dir,{recursive:true});
    for(const n of nums.length?nums:Array.from({length:30},(_,i)=>i+1)){
      const ok=await page.evaluate(([id,n])=>{ const m=DZR.get(id).part(n); if(!m) return false;
        let b=document.getElementById('thumbBox'); if(!b){ b=document.createElement('div'); b.id='thumbBox'; b.style.cssText='position:fixed;left:0;top:0;width:480px;background:#fff;z-index:99999;padding:0'; document.body.appendChild(b); }
        b.innerHTML=IGUI.sheetSVG(m,'','','','given'); const s=b.querySelector('svg'); s.style.cssText='display:block;width:100%;height:auto'; return true; },[id,n]);
      if(!ok){ console.log(id,n,'— нет модели'); continue; }
      const f=path.join(dir,'v'+String(n).padStart(2,'0')+'.jpg');
      await page.locator('#thumbBox svg').screenshot({path:f,type:'jpeg',quality:78});
      console.log(path.relative(ROOT,f),fs.statSync(f).size); } }
  await browser.close(); srv.close();
})();
