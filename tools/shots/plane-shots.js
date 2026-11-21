/* Скриншоты шагов задач на плоскость (часть 1 отчёта docs/REPORT-TUTOR-FOUNDATION.md).
   node tools/shots/plane-shots.js <папка> [tag]  — телефон 390×844 и ПК 1280×800, каждый шаг каждой задачи списка.
   Сервер — тот же, что в tests/run.js (статическая раздача корня репозитория). */
const {chromium}=require('playwright'), http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..','..'), OUT=process.argv[2]||'shots', TAG=process.argv[3]||'x';
const LIST=(process.env.SHOT_LIST||'ng/tasks/29,ng/tasks/38,ng/tasks/44,ng/tasks/45,ng/tasks/46,ng2/14').split(',');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.woff2':'font/woff2'};
function serve(){ return new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
  const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); }); }
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const srv=await serve(), U='http://127.0.0.1:'+srv.address().port+'/';
  const br=await chromium.launch();
  for(const [dev,vp] of [['phone',{width:390,height:844}],['pc',{width:1280,height:800}]]){
    const ctx=await br.newContext({viewport:vp,deviceScaleFactor:dev==='phone'?2:1}); const pg=await ctx.newPage(); await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
    await pg.goto(U); await pg.evaluate(()=>{ try{ localStorage.setItem('nch_cookie','no'); }catch(e){} });
    for(const r of LIST){
      await pg.evaluate(()=>{ try{ localStorage.removeItem('plpos'); }catch(e){} });
      await pg.goto(U+'#/'); await pg.waitForTimeout(300); await pg.goto(U+'#/'+r); await pg.waitForTimeout(1500);
      await pg.waitForSelector('.pl-main',{timeout:8000}).catch(()=>{});
      let k=0;
      for(;k<120;k++){
        await pg.waitForTimeout(1900);
        const f=path.join(OUT,TAG+'-'+r.replace(/\//g,'_')+'-c'+String(k).padStart(2,'0')+'-'+dev+'.png');
        await pg.screenshot({path:f});
        const b=await pg.$('.pl-main.pl-next'); if(!b) break; await b.click(); }
      console.log(dev,r,k,'кадров');
    }
    await ctx.close();
  }
  await br.close(); srv.close();
})();
