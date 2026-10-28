/* ═══════════ Страница камеры по чертежам в настоящем браузере (lab/cam.html, Chromium через Playwright) ═══════════
   node lab/dz/test-cam.js [--n=9] [--seed=12] [--out=каталог для снимка экрана]
   Камера подменена холстом (getUserMedia → canvas.captureStream): тест показывает в «камере» синтетический лист
   (quadsynth.js: весь лист мелко, затем снимки каждого чертежа вблизи) и подносит «телефон» к тому чертежу, который
   просит страница (правда — по месту чертежа на листе). Проверяется весь путь: автоснимок, поток, опознание, серия,
   итог по чертежам. Печатает подсказки страницы, итог и время. */
const http=require('http'), fs=require('fs'), path=require('path'), IMG=require('../img.js'), Q=require('./quadsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), n=+(A.n||9), seed=+(A.seed||12);
const ROOT=path.resolve(__dirname,'../..');
(async()=>{ const t0=Date.now(), s=Q.sheet({n,seed,size:[1500,2000],closeup:8,closeShots:3,closeSize:[2250,3000]});
  const png=[IMG.encodePNG(s.img)].concat(s.views.map(v=>IMG.encodePNG(v.img)));
  console.log('лист в'+n+' построен: '+((Date.now()-t0)/1000).toFixed(0)+' с, снимков вблизи '+s.views.length);
  const srv=http.createServer((q,r)=>{ const u=decodeURIComponent(q.url.split('?')[0]);
    if(u.startsWith('/__img/')){ r.writeHead(200,{'content-type':'image/png'}); r.end(png[+u.slice(7)]); return; }
    const f=path.join(ROOT,path.normalize(u)); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; }
    r.writeHead(200,{'content-type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json'}[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(r); }).listen(0);
  const port=srv.address().port, {chromium}=require('playwright'), br=await chromium.launch(), pg=await br.newPage({viewport:{width:430,height:900}});
  pg.on('pageerror',e=>console.log('ОШИБКА СТРАНИЦЫ: '+e.message));
  /* камера — холст: тест рисует на нём нужный снимок, поток идёт с холста */
  /* холст постоянного размера (сенсор камеры): снимок вписан без искажения, вокруг тёмный стол */
  await pg.addInitScript(()=>{ const cv=document.createElement('canvas'); cv.width=3000; cv.height=3000; const ctx=cv.getContext('2d'); let img=null;
    const put=()=>{ ctx.fillStyle='#2a2622'; ctx.fillRect(0,0,cv.width,cv.height); if(img){ const k=Math.min(cv.width/img.width,cv.height/img.height), w=img.width*k, h=img.height*k; ctx.drawImage(img,(cv.width-w)/2,(cv.height-h)/2,w,h); } };
    setInterval(put,100);
    window.__show=url=>new Promise(res=>{ const im=new Image(); im.onload=()=>{ img=im; put(); res(); }; im.src=url; });
    navigator.mediaDevices.getUserMedia=async()=>cv.captureStream(10); });
  await pg.goto('http://localhost:'+port+'/lab/cam.html?n='+n); await pg.selectOption('#how','draw');
  await pg.evaluate(()=>window.__show('/__img/0')); await pg.click('#start');
  const hint=()=>pg.$eval('#hint',e=>e.textContent).catch(()=>''), phase=()=>pg.evaluate('D&&D.phase').catch(()=>null);
  const wait=async(f,ms)=>{ const t=Date.now(); while(Date.now()-t<ms){ if(await f()) return true; await pg.waitForTimeout(300); } return false; };
  if(!await wait(async()=>(await phase())==='close'||(await phase())==='done',240000)){ console.log('общий снимок не разобран: '+await hint()); await br.close(); srv.close(); process.exit(1); }
  /* правда: чертёж страницы j ↔ часть листа (начало O ближе всего к центру фигуры на снимке) */
  const cs=await pg.evaluate('D.ov.drawings.map(d=>d.c)'), fg=require('./model.js').given('3',s.truth.data).segs.flatMap(q=>[q.a,q.b]).concat([[0,0]]), m0=[(Math.min(...fg.map(p=>p[0]))+Math.max(...fg.map(p=>p[0])))/2,(Math.min(...fg.map(p=>p[1]))+Math.max(...fg.map(p=>p[1])))/2], G=s.truth.parts.map(p=>IMG.H.apply(s.truth.H,[p.O[0]+m0[0],p.O[1]+m0[1]])), who=cs.map(c=>{ let b=-1, bd=1e9; G.forEach((g,k)=>{ const d=Math.hypot(g[0]-c[0],g[1]-c[1]); if(d<bd){ bd=d; b=k; } }); return b; });
  console.log('страница нашла чертежей '+cs.length+' → части '+who.map(k=>'abcd'[k]).join(','));
  const used=[0,0,0,0]; let last='', steps=0;
  while(steps++<30&&(await phase())==='close'){ const h=await hint(), m=h.match(/^Чертёж (\d+) из/);
    if(h!==last){ console.log('  · '+h); last=h; }
    if(!m){ await pg.waitForTimeout(1000); continue; } const j=+m[1]-1, k=who[j];
    if(used[k]>=3){ console.log('  ракурсы чертежа '+(j+1)+' кончились'); break; }
    const shots0=await pg.evaluate('D.pend.reduce((a,b)=>a+b,0)+D.sess.fr.reduce((a,f)=>a+f.length,0)');
    await pg.evaluate(u=>window.__show(u),'/__img/'+(1+used[k]*4+k)); used[k]++;
    /* ждём снимок (страница просит другой чертёж или снимок ушёл в проверку); нет за 30 с — что мешает, и другой ракурс */
    const shot=await wait(async()=>(await phase())!=='close'||await pg.evaluate('D.pend.reduce((a,b)=>a+b,0)+D.sess.fr.reduce((a,f)=>a+f.length,0)')>shots0,30000);
    if(!shot) console.log('  снимок не сделан за 30 с: '+await hint()); }
  await wait(async()=>(await phase())==='done',600000);
  const v=await pg.$eval('#vtitle',e=>e.textContent), why=await pg.$$eval('#vwhy li',L=>L.map(e=>e.innerText.replace(/\s+/g,' '))), fr=await pg.$$eval('#frames div',L=>L.map(e=>e.textContent));
  console.log('ИТОГ страницы: '+v+'\n'+why.map(w=>'  '+w).join('\n')+'\n  снимки:\n'+fr.map(w=>'   '+w).join('\n'));
  if(A.out) await pg.screenshot({path:path.join(A.out,'cam-v'+n+'.png'),fullPage:true});
  console.log('время: '+((Date.now()-t0)/1000).toFixed(0)+' с, фаза: '+await phase());
  await br.close(); srv.close(); })().catch(e=>{ console.error(e); process.exit(1); });
