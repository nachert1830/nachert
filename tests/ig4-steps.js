/* ═══════════ ДЗ №4 по ИГ: решение по шагам — у каждой линии происхождение (dz/ig/4/steps.js) ═══════════
   Покрытие: каждый отрезок итогового вида слева, линий выреза K на виде сверху, фигур профильного разреза и разреза А–А
   имеет шаг, где его концы построены — точка с линиями связи (кривая — концы и точки на ней). Норма — 100 %.
   Состав шагов: анализ, ось и габарит, тело по рёбрам, точки K на трёх видах, линия выреза, профильный разрез, А–А,
   размеры, лист. Подписи шага не налезают друг на друга. Плеер проходится кнопками без ошибок JS (вариант 7).
   node tests/ig4-steps.js [--only=7,18]   — отдельно (все 30 вариантов, ≈ 2 мин) */
const NEED=['given','anal','axis','body','kF','kT','kL','kLines','secL','aa','aa2','dims','sheet'];
async function ig4StepsCheck(page,URL,opt){ opt=opt||{}; const bad=[], add=(n,r,m)=>bad.push({name:'ДЗ 4 · шаги · в. '+n,rule:r,msg:m});
  const errs=[], onErr=e=>errs.push(String(e)); page.on('pageerror',onErr);
  await page.goto(URL+'#/ig/dz/4/7'); await page.waitForTimeout(1500);
  const list=opt.only||Array.from({length:30},(_,i)=>i+1);
  for(const n of list){
    const r=await page.evaluate(n=>{ try{ const m=DZR.get('ig4').part(n), c=IG4S.coverage(m), PL=IG4S.plan(m), lab=[];
        /* подписи: рамки текста на каждом шаге не пересекаются (приблизительно, по длине строки) */
        PL.ST.forEach((s,i)=>{ if(s.sheet) return; const svg=IG4S.svg(m,PL,i,{}), T=[...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" class="igs-k"[^>]*>([^<]*)</g)].map(x=>({x:+x[1],y:+x[2],w:x[3].length*11,t:x[3]}));
          for(let a=0;a<T.length;a++) for(let b=a+1;b<T.length;b++){ const A=T[a], B=T[b], ox=Math.min(A.x+A.w,B.x+B.w)-Math.max(A.x,B.x), oy=Math.min(A.y,B.y)-Math.max(A.y-16,B.y-16); if(ox>4&&oy>4) lab.push(s.id+': '+A.t+' / '+B.t); } });
        return {c,ids:PL.ST.map(s=>s.id),lab}; }catch(e){ return {err:e.message}; } },n);
    if(r.err){ add(n,'ошибка',r.err); continue; }
    if(r.c.ok<r.c.all) add(n,'покрытие < 100 %',r.c.ok+' из '+r.c.all+': '+r.c.miss.slice(0,3).join(' | '));
    NEED.forEach(id=>{ if(!r.ids.includes(id)) add(n,'нет шага',id); });
    if(r.lab.length) add(n,'подписи налезают',r.lab.slice(0,4).join('; '));
  }
  /* плеер: «Показать решение» → «По шагам» → все шаги кнопкой, «Прошлые шаги», «Все номера» */
  { const before=errs.length; await page.goto(URL+'#/ig/dz/4/7'); await page.waitForTimeout(1200);
    await page.click('#igShow'); await page.waitForTimeout(300); await page.click('button[data-t=steps]');
    await page.waitForSelector('#igbPic svg',{timeout:60000});
    let k=0; for(;k<40;k++){ const dis=await page.$eval('#igbNext',b=>b.disabled); if(dis) break; await page.click('#igbNext'); await page.waitForTimeout(80); }
    const N=await page.$$eval('.igb-nums button',b=>b.length); if(k+1!==N) add(7,'плеер','пройдено '+(k+1)+' шагов из '+N);
    await page.click('.igb-nums button[data-k="6"]'); await page.click('#ig4Past'); await page.click('#ig4All'); await page.waitForTimeout(100);
    if(!await page.$('#igbPic svg')) add(7,'плеер','нет рисунка после переключателей');
    await page.click('#ig4Past'); if(errs.length>before) add(7,'ошибка JS',errs.slice(before).join(' / ')); }
  page.off('pageerror',onErr); return bad; }
module.exports={ig4StepsCheck};
if(require.main===module)(async()=>{
  const http=require('http'), fs=require('fs'), path=require('path'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const ROOT=path.join(__dirname,'..'), only=(process.argv.find(a=>a.startsWith('--only='))||'').slice(7);
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.js')?'text/javascript':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage({viewport:{width:1400,height:1000}});
  const bad=await ig4StepsCheck(page,'http://127.0.0.1:'+srv.address().port+'/',{only:only?only.split(',').map(Number):null});
  bad.forEach(b=>console.log(b.name+' | '+b.rule+' | '+b.msg)); console.log('ДЗ 4 · шаги: замечаний '+bad.length);
  await browser.close(); srv.close(); process.exit(bad.length?1:0);
})();
