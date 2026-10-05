/* ═══════════ Полная проверка сайта перед публикацией ═══════════
   node tests/run.js            — всё (≈1–2 мин)
   node tests/run.js --quick    — без обхода всех страниц
   Код выхода 0 — ошибок нет; 1 — есть новые ошибки (их список выводится).
   Уже разобранные вручную случаи лежат в tests/baseline.json вместе с объяснением, почему это не ошибка. */
const http=require('http'), fs=require('fs'), path=require('path');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..'), QUICK=process.argv.includes('--quick');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.txt':'text/plain'};
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline.json'),'utf8')).accepted.map(a=>a.key);

function serve(){ return new Promise(res=>{ const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end('нет'); }
    r.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(srv)); }); }

(async()=>{
  const srv=await serve(), URL='http://127.0.0.1:'+srv.address().port+'/';
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const fail=[], info=[];
  const key=o=>[o.name,o.rule,o.msg].join(' | ');
  const report=(title,list)=>{ const fresh=list.filter(o=>!baseline.includes(key(o))); info.push(title+': '+list.length+' замечаний, новых '+fresh.length); fresh.forEach(o=>fail.push(title+' · '+key(o))); };

  /* 1–3. чертежи: 3D-проверка, отрисовка, мутации */
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(1500);
  for(const f of ['geometry','render','mutate','oracle']) await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')});
  report('Чертежи (3D-модель)', await page.evaluate(()=>GEOM_CHECK()));
  report('Отрисовка (подписи)', await page.evaluate(()=>RENDER_CHECK()));
  const mut=await page.evaluate(()=>MUTATE_CHECK({n:450,seed:11}));
  Object.entries(mut).forEach(([k,v])=>info.push('Мутации «'+k+'»: поймано '+v.поймано+' из '+v.всего));
  const ml=mut['линия связи'], ms=mut['подписи местами'];
  if(ml&&ml.поймано/ml.всего<0.95) fail.push('Проверка ослабла: разрыв линии связи ловится в '+Math.round(100*ml.поймано/ml.всего)+'% случаев');
  if(ms&&ms.поймано/ms.всего<0.93) fail.push('Проверка ослабла: перепутанные подписи ловятся в '+Math.round(100*ms.поймано/ms.всего)+'% случаев');

  /* 3б. оракул: ответы задач против условия, записанного геометрически; и проверка самого оракула */
  report('Оракул (ответы задач)', await page.evaluate(()=>ORACLE_CHECK()));
  const om=await page.evaluate(()=>ORACLE_MUTATE({per:4,seed:7}));
  info.push('Сдвиг точки ответа: ловит 3D-проверка '+om.геометрия+' из '+om.всего+', вместе с оракулом '+om.сОракулом+' из '+om.всего+' (задач с оракулом: '+(await page.evaluate(()=>ORACLE_SPECS.length))+')');
  if(om.сОракулом/om.всего<0.88) fail.push('Оракул ослаб: ловит '+Math.round(100*om.сОракулом/om.всего)+'% сдвигов ответа');

  /* 3в. случайные варианты: каждая задача заново строится на искажённых данных и проходит 3D-проверку и оракул */
  { const vpage=await browser.newPage(); await vpage.goto(URL); await vpage.waitForTimeout(1200);
    const N=QUICK?10:30, res=await require('./random-run.js').runVariants(vpage,N), list=[]; let deg=0;
    res.forEach(b=>{ Object.entries(b.bad).forEach(([k,v])=>{ const [n,rule]=k.split('|'); list.push({name:n,rule:'вариант: '+rule,msg:v[0].msg.slice(0,160)+' ('+v.length+' из '+N+')'}); });
      (b.info||[]).forEach(x=>{ const m=/вырожденных вариантов (\d+)/.exec(x); if(m) deg+=+m[1]; }); });
    const still=res.reduce((a,b)=>a.concat(b.still||[]),[]);
    info.push('Случайные варианты: '+N+' на задачу, вырожденных (без решения) отброшено '+deg+'; данные не числами — только на своих данных: '+(still.join(', ')||'нет'));
    report('Случайные варианты', list); await vpage.close(); }

  /* 4. теория */
  const th=require('./theory.js').run().map(o=>({name:'строка '+o.line,rule:o.fact,msg:o.text}));
  report('Теория',th.map(o=>({name:'теория',rule:o.rule,msg:o.msg})));

  /* 5. обход сайта: каждая страница на телефоне — без ошибок JS, без горизонтальной прокрутки, не пустая */
  if(!QUICK){
    const seen=new Set(), queue=['#/'], bad=[]; let n=0;
    while(queue.length&&n<700){ const h=queue.shift(); if(seen.has(h)) continue; seen.add(h); n++;
      const before=errs.length; await page.evaluate(h=>{ location.hash=h; },h); await page.waitForTimeout(60);
      const st=await page.evaluate(()=>({ w:document.documentElement.scrollWidth, iw:window.innerWidth, txt:(document.getElementById('view')||document.body).innerText.length,
        links:[...document.querySelectorAll('a[href^="#/"]')].map(a=>a.getAttribute('href')) }));
      if(errs.length>before) bad.push({name:h,rule:'ошибка JS',msg:errs.slice(before).join(' / ').slice(0,200)});
      if(st.w>st.iw+1) bad.push({name:h,rule:'горизонтальная прокрутка',msg:'ширина '+st.w+' при экране '+st.iw});
      if(st.txt<40) bad.push({name:h,rule:'пустая страница',msg:'текста '+st.txt+' символов'});
      st.links.forEach(l=>{ if(!seen.has(l)) queue.push(l); }); }
    info.push('Обход: страниц '+n);
    /* разбор каждой задачи до конца: «Дальше» до ответа */
    const tasks=await page.evaluate(()=>WB3.tasks.map(t=>t.n));
    for(const t of tasks){ const before=errs.length; await page.evaluate(n=>{ location.hash='#/ng/path/t'+n; },t); await page.waitForTimeout(80);
      for(let k=0;k<40;k++){ const b=await page.$('.pl-next,.pl-nextpart'); if(!b) break; await b.click().catch(()=>{}); await page.waitForTimeout(60); }
      const done=await page.$('.pl-done');
      if(errs.length>before) bad.push({name:'Задача №'+t,rule:'ошибка JS в разборе',msg:errs.slice(before).join(' / ').slice(0,200)});
      if(!done) bad.push({name:'Задача №'+t,rule:'разбор не доходит до ответа',msg:'нет кнопки «Готово»'}); }
    info.push('Задач пройдено до ответа: '+tasks.length);
    report('Сайт',bad);
  }
  await browser.close(); srv.close();
  console.log(info.join('\n'));
  if(fail.length){ console.log('\nНОВЫЕ ОШИБКИ ('+fail.length+'):\n- '+fail.join('\n- ')); process.exit(1); }
  console.log('\nОшибок нет.'); process.exit(0);
})().catch(e=>{ console.error(e); process.exit(2); });
