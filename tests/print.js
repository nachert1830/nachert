/* ═══════════ Печать листов: страниц ровно столько, сколько листов, фон белый в любой теме ═══════════
   Печать прямо со страницы листа (Ctrl+P или «Печать» в меню телефона) и из окна «Открыть для печати».
   Отдельно: node tests/print.js */
const LISTS=['#/ng2/17/list','#/ng3/21/list','#/ng4/13/list'];
async function printCheck(browser,URL){
  const bad=[];
  for(const theme of ['light','dark']) for(const h of LISTS){
    const ctx=await browser.newContext({viewport:{width:1400,height:1000},colorScheme:theme});
    const pg=await ctx.newPage(); await pg.addInitScript(t=>{ try{ localStorage.setItem('nch_theme',t); }catch(e){} },theme);
    await pg.goto(URL+h); await pg.waitForTimeout(1800);
    const n=await pg.evaluate(()=>document.querySelectorAll('.var-sheet svg').length);
    const name='Печать '+h+' ('+(theme==='dark'?'тёмная':'светлая')+' тема)';
    if(!n){ bad.push({name,rule:'лист не найден',msg:'на странице нет .var-sheet svg'}); await ctx.close(); continue; }
    await pg.emulateMedia({media:'print'}); await pg.waitForTimeout(600);   /* у фона страницы есть плавный переход */
    const bg=await pg.evaluate(()=>[getComputedStyle(document.documentElement).backgroundColor,getComputedStyle(document.body).backgroundColor]);
    if(bg.some(c=>!/rgba?\(255, 255, 255|rgba\(0, 0, 0, 0\)/.test(c))) bad.push({name,rule:'фон при печати не белый',msg:bg.join(' / ')});
    await pg.emulateMedia({media:null});   /* 'screen' здесь нельзя: page.pdf() печатал бы экранный вид */
    const pages=((await pg.pdf({preferCSSPageSize:true,printBackground:true})).toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
    if(pages!==n) bad.push({name,rule:'страниц не столько, сколько листов',msg:'листов '+n+', страниц PDF '+pages});
    if(theme==='light'){ const [w]=await Promise.all([ctx.waitForEvent('page'),pg.click('#varPrint')]); await w.waitForLoadState(); await w.waitForTimeout(500);
      const p2=((await w.pdf({preferCSSPageSize:true,printBackground:true})).toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
      if(p2!==1) bad.push({name:name+' · окно печати',rule:'страниц не столько, сколько листов',msg:'страниц PDF '+p2}); }
    await ctx.close();
  }
  return bad;
}
module.exports={printCheck};
if(require.main===module){ (async()=>{
  const http=require('http'),fs=require('fs'),path=require('path'); const {chromium}=require('playwright'); const ROOT=path.join(__dirname,'..');
  const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.woff2':'font/woff2'}[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1');
  await new Promise(r=>srv.on('listening',r)); const b=await chromium.launch(); const bad=await printCheck(b,'http://127.0.0.1:'+srv.address().port+'/');
  console.log(bad.length?bad.map(o=>o.name+' · '+o.rule+' · '+o.msg).join('\n'):'Печать: ошибок нет'); await b.close(); srv.close(); process.exit(bad.length?1:0); })(); }
