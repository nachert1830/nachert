/* ═══════════ Путь студента в браузере: кабинет → «Проверка» → ДЗ № 3 → фото листа → результат (Chromium, Playwright) ═══════════
   node lab/dz/test-path.js [--n=9] [--seed=1] [--err=a_dir] [--eyes=mock] [--cpu=4] [--out=каталог снимков экрана] [--only=phone|desk]
   Поднимает server/dev.js (эмуляция кабинета, вход за участника) и «сайт» (lk/, lab/), входит, открывает lk/#/check,
   выбирает ДЗ № 3, смотрит пример, загружает синтетический лист (quadsynth.js) и ждёт результат. Снимки экрана —
   390 × 844 (телефон) и 1440 × 900 (ноутбук). --cpu=4 — замедление процессора ×4 (средний телефон), время — по этапам.
   --eyes=mock — ИИ-зрение кабинета отвечает заглушкой (рамки и номера частей из правды листа, как ответила бы хорошая
   модель): проверяет, что модель вызывается и её ответ доходит до мозга; это не замер модели. */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), {spawn}=require('child_process');
const IMG=require('../img.js'), Q=require('./quadsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), n=+(A.n||9), seed=+(A.seed||1), cpu=+(A.cpu||1);
const OUT=A.out||null; if(OUT) fs.mkdirSync(OUT,{recursive:true});
const ROOT=path.resolve(__dirname,'../..'), PORT=8600+Math.floor(Math.random()*80), SITE=PORT+100, URL='http://localhost:'+SITE;
const log=s=>console.log(s), sec=t=>((Date.now()-t)/1000).toFixed(1)+' с';

(async()=>{ const t0=Date.now(), s=Q.sheet({n,seed,err:A.err||undefined,size:[2250,3000]}), file=path.join(require('os').tmpdir(),'path-v'+n+'.png');
  fs.writeFileSync(file,IMG.encodePNG(s.img)); log('лист в'+n+(A.err?' ('+A.err+')':'')+': '+sec(t0)+'; части '+s.truth.parts.map(p=>p.part+(p.built?'+':'-')+(p.err?'!':'')).join(' '));
  /* заглушка модели: OpenAI-совместимый /chat/completions; рамки чертежей и части — из правды листа, в px присланного фото */
  let mock=null, calls=0;
  if(A.eyes==='mock'){ mock=http.createServer((q,r)=>{ let b=''; q.on('data',d=>b+=d).on('end',()=>{ calls++; let w=s.img.width;
      try{ const t=JSON.parse(b).messages[1].content[0].text, m=/(\d+) × (\d+) px/.exec(t); if(m) w=+m[1]; }catch(e){}
      const k=w/s.img.width, P=p=>IMG.H.apply(s.truth.H,p).map(v=>Math.round(v*k));
      const drawings=s.truth.parts.map(p=>{ const a=P([p.box[0],p.box[1]]), c=P([p.box[2],p.box[3]]); return {box:[Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.max(a[0],c[0]),Math.max(a[1],c[1])],part:p.built?' abcd'.indexOf(p.part):null}; });
      r.writeHead(200,{'content-type':'application/json'}); r.end(JSON.stringify({choices:[{message:{content:JSON.stringify({dz:3,n,drawings})},finish_reason:'stop'}]})); }); }).listen(0); }
  const env=Object.assign({},process.env,mock?{EYES_URL:'http://localhost:'+mock.address().port+'/v1/chat/completions',EYES_KEY:'mock',EYES_MODEL:'заглушка',EYES_FOREIGN:'0'}:{});
  const srv=spawn(process.execPath,[path.join(ROOT,'server/dev.js'),'--memory','--quiet','--port='+PORT,'--site-port='+SITE],{stdio:['ignore','inherit','inherit','ipc'],env});
  await new Promise((res,rej)=>{ srv.on('message',m=>m.ready&&res()); srv.on('exit',c=>rej(new Error('dev.js завершился: '+c))); });
  const {chromium}=require('playwright'), br=await chromium.launch();
  const VIEWS={phone:{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true},desk:{viewport:{width:1440,height:900}}};
  let fails=0;
  for(const [vn,vo] of Object.entries(VIEWS)){ if(A.only&&A.only!==vn) continue;
    const ctx=await br.newContext(Object.assign({locale:'ru-RU',timezoneId:'Europe/Moscow'},vo)), pg=await ctx.newPage(), errs=[];
    pg.on('pageerror',e=>errs.push(e.message)); ctx.on('page',p=>p.on('pageerror',e=>errs.push(e.message)));
    const shot=async(name,o)=>{ if(OUT) await pg.screenshot(Object.assign({path:path.join(OUT,vn+'-'+name+'.png')},o||{})); };
    /* вход за участника (эмуляция бота): ссылка из кнопки «Войти» → «Добро пожаловать» → вариант из профиля */
    const lr=await fetch('http://localhost:'+PORT+'/dev/bot-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:1000001,first_name:'Студент',start:'login'})}).then(r=>r.json());
    await pg.goto(lr.link); await pg.waitForSelector('#onbF, #tabs:not([hidden])');
    if(await pg.$('#onbF')){ if(await pg.$('#onG')) await pg.fill('#onG','ИУ5-11Б'); if(await pg.$('#onV')) await pg.selectOption('#onV',String(n)); await pg.check('#cTerms'); await pg.check('#cPd'); await pg.click('#onbF button[type=submit]'); await pg.waitForSelector('#tabs:not([hidden])'); }
    await pg.goto(URL+'/lk/#/check'); await pg.waitForSelector('.tool8'); await pg.waitForTimeout(300); await shot('1-check');
    /* ДЗ № 3 — первая карточка */
    const tools=await pg.$$eval('.tool8 b',L=>L.map(e=>e.textContent)); log('['+vn+'] «Проверка»: '+tools.join(' · '));
    await pg.click('.tool8 >> nth=0'); const fr=await (await pg.waitForSelector('iframe.labf')).contentFrame(); await fr.waitForSelector('#start'); await pg.waitForTimeout(800); await shot('2-start');
    log('['+vn+'] ИИ-зрение в сканере: '+await fr.evaluate(()=>SCAN.ai.on&&!document.getElementById('aiRow').hidden?'включено':'нет'));
    if(cpu>1){ const cdp=await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu}); }
    /* пример без камеры */
    if(await fr.$('#exList .ex')){ await fr.click('#exList .ex >> nth=0'); await fr.waitForSelector('#scrResult:not([hidden]) .card'); await pg.waitForTimeout(400); await shot('3-example');
      await fr.click('#newBtn'); await fr.waitForSelector('#scrStart:not([hidden])'); }
    /* фото листа: на телефоне — «Загрузить фото», на ноутбуке — зона перетаскивания (тот же input) */
    const t1=Date.now(); await fr.setInputFiles(vn==='phone'?'#file':'#file2',file);
    await fr.waitForSelector('#scrWait:not([hidden])'); await pg.waitForTimeout(1500); await shot('4-wait');
    await fr.waitForSelector('#scrResult:not([hidden]) .card',{timeout:900000}); const dt=Date.now()-t1; await pg.waitForTimeout(500);
    await shot('5-result'); await shot('5-result-full',{fullPage:true});
    const res=await fr.evaluate(()=>({h:document.querySelector('#vtitle')&&document.querySelector('#vtitle').textContent,cards:[...document.querySelectorAll('#vwhy .card')].map(c=>c.querySelector('h3').textContent+' — '+c.querySelector('.pill').textContent+': '+c.querySelector('.say').textContent),
      tech:(document.querySelector('details.tech pre')||{}).textContent||'',note:[...document.querySelectorAll('#scrResult p.note')].map(e=>e.textContent).join(' ')}));
    log('['+vn+'] результат за '+(dt/1000).toFixed(1)+' с'+(cpu>1?' (процессор ×'+cpu+')':'')+': '+res.h); res.cards.forEach(c=>log('   '+c)); log('   подпись: '+res.note);
    if(mock) log('   модель вызвана: '+calls+' раз; в ответе страницы: '+(/заглушка|ИИ-зрение/.test(res.tech)?'да':'нет'));
    /* подробности первой карточки — раскрыть и снять */
    const d0=await fr.$('#vwhy [data-act=more]'); if(d0){ await d0.click(); await pg.waitForTimeout(400); await shot('6-details',{fullPage:true}); }
    if(errs.length){ fails++; log('   ОШИБКИ СТРАНИЦЫ: '+errs.join(' | ')); }
    await ctx.close(); }
  await br.close(); srv.kill(); if(mock) mock.close(); log('всего: '+sec(t0)); process.exit(fails?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
