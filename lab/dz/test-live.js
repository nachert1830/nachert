/* ═══════════ Живая проверка сканера на сайте: кабинет → «Проверка» → ДЗ № 3 → фото листа → ответ (Chromium, Playwright) ═══════════
   NCH_LOGIN=<ссылка входа> node lab/dz/test-live.js [--site=https://nachert1830.ru] [--n=21] [--seed=1] [--err=a_dir] [--far=1] [--out=каталог]
   Ссылку входа владельца даёт node server/tools/login.js (нужен yc с правами в облаке) — так делает .github/workflows/scanner-live.yml.
   Лист — синтетический (quadsynth.js), поэтому его можно отправить и зарубежной модели (--far=1: отметка «лист мой»).
   Печатает: виден ли переключатель ИИ-зрения, запросы кабинета к /api/eyes (статус, модель, запасная ли), итог и карточки
   частей; снимки экрана — телефон 390 × 844. Код выхода 1 — модель не вызвана или ответа нет (и на каком шаге). */
'use strict';
const fs=require('fs'), path=require('path'), IMG=require('../img.js'), Q=require('./quadsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), SITE=(A.site||'https://nachert1830.ru').replace(/\/$/,''), n=+(A.n||21), OUT=A.out||'live-shots';
const LOGIN=process.env.NCH_LOGIN||A.login; fs.mkdirSync(OUT,{recursive:true});
const step=s=>console.log('· '+s), fail=s=>{ console.log('✖ НЕ РАБОТАЕТ: '+s); process.exitCode=1; };
(async()=>{ if(!LOGIN){ fail('нет ссылки входа (NCH_LOGIN)'); return; }
  const s=Q.sheet({n,seed:+(A.seed||1),err:A.err||undefined,size:[2250,3000]}), file=path.join(OUT,'sheet-v'+n+'.png'); fs.writeFileSync(file,IMG.encodePNG(s.img));
  step('лист: синтетический, вариант '+n+(A.err?', ошибка '+A.err:'')+', части '+s.truth.parts.map(p=>p.part+(p.built?'+':'-')).join(' '));
  const {chromium}=require('playwright'), br=await chromium.launch(), ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'ru-RU',timezoneId:'Europe/Moscow'});
  const pg=await ctx.newPage(), errs=[], calls=[]; pg.on('pageerror',e=>errs.push(e.message));
  /* запросы кабинета к модели: ответ сервера — {ok, text, model, fallback} или ошибка */
  pg.on('response',async r=>{ if(!/\/api\/eyes$/.test(r.url())) return; let j=null; try{ j=await r.json(); }catch(e){} calls.push({status:r.status(),model:j&&j.model,fallback:j&&j.fallback,error:j&&j.error,len:j&&j.text?j.text.length:0}); });
  const shot=async name=>{ await pg.screenshot({path:path.join(OUT,name+'.png')}); };
  try{
    await pg.goto(LOGIN); await pg.waitForSelector('#tabs:not([hidden])',{timeout:60000}); step('вход в кабинет: да');
    await pg.goto(SITE+'/lk/#/check'); await pg.waitForSelector('.tool8',{timeout:30000}); await pg.waitForTimeout(800); await shot('1-check');
    const tools=await pg.$$eval('.tool8 b',L=>L.map(e=>e.textContent)), k=tools.findIndex(t=>/ДЗ\s*№\s*3/.test(t)); step('«Проверка»: '+tools.join(' · '));
    if(k<0){ fail('шаг «Проверка»: нет карточки ДЗ № 3'); throw new Error('нет карточки'); } await pg.click('.tool8 >> nth='+k);
    const fr=await (await pg.waitForSelector('iframe.labf',{timeout:30000})).contentFrame(); await fr.waitForSelector('#start',{timeout:30000});
    await fr.fill('#n',String(n)); await fr.dispatchEvent('#n','input');
    const ai=await fr.waitForSelector('#aiRow:not([hidden])',{timeout:15000}).then(()=>true,()=>false); step('ИИ-зрение в сканере: '+(ai?'включено':'НЕ ВИДНО'));
    if(!ai){ await shot('2-start'); fail('шаг «ИИ-зрение» на странице ДЗ № 3: переключателя нет или он скрыт (на сайте прежняя версия сканера, или кабинет ответил, что модели нет)');
      /* запасной путь — страница «фото листа» (dz.html): на прежней версии сайта ИИ-зрение есть только там */
      await pg.goto(SITE+'/lk/#/check'); await pg.waitForSelector('.tool8'); const t2=await pg.$$eval('.tool8 b',L=>L.map(e=>e.textContent)), k2=t2.findIndex(t=>/фото листа/i.test(t));
      if(k2<0) throw new Error('нет карточки «фото листа»'); await pg.click('.tool8 >> nth='+k2); step('запасной путь: «'+t2[k2]+'»');
      const f2=await (await pg.waitForSelector('iframe.labf',{timeout:30000})).contentFrame(); await f2.waitForSelector('#file',{state:'attached',timeout:30000});
      if(await f2.$('#dz')) await f2.selectOption('#dz','3').catch(()=>{}); await f2.fill('#n',String(n)); await f2.dispatchEvent('#n','input');
      if(await f2.$('#paper')) await f2.selectOption('#paper','plain').catch(()=>{});
      /* «на моём листе — именно эти данные»: без отметки прежняя страница фото не берёт */
      await f2.evaluate(()=>{ const ok=document.getElementById('ok'); if(ok&&!ok.checked){ ok.checked=true; ok.dispatchEvent(new Event('change',{bubbles:true})); } });
      const ai2=await f2.waitForSelector('#aiRow:not([hidden])',{timeout:15000}).then(()=>true,()=>false); step('ИИ-зрение на странице «фото листа»: '+(ai2?'включено':'НЕ ВИДНО'));
      if(ai2&&A.far==='1'&&await f2.$('#aiFar')) await f2.check('#aiFar').catch(()=>{});
      /* прежняя страница при загрузке ставит вариант из профиля — номер и отметку «мои данные» — перед самой загрузкой */
      await pg.waitForTimeout(1500); await f2.fill('#n',String(n)); await f2.dispatchEvent('#n','input'); await f2.dispatchEvent('#n','change');
      if(await f2.$('#ok')) await f2.check('#ok',{force:true}).catch(()=>f2.evaluate(()=>{ const ok=document.getElementById('ok'); ok.checked=true; ok.dispatchEvent(new Event('change',{bubbles:true})); }));
      step('прежняя страница: вариант '+await f2.$eval('#n',e=>e.value)+', «мои данные» — '+await f2.evaluate(()=>{ const ok=document.getElementById('ok'); return ok?(ok.checked?'да':'нет'):'нет отметки'; }));
      await shot('2b-photo-start'); const t1=Date.now(); await f2.setInputFiles('#file',file);
      const got=await f2.waitForSelector('#vcard:not([hidden]), #scrResult:not([hidden]) .card',{timeout:480000}).then(()=>true,()=>false);
      if(!got){ const st=await f2.evaluate(()=>{ const e=document.getElementById('stage')||document.querySelector('#scrWait'); return e?e.innerText.replace(/\s+/g,' ').slice(0,300):'—'; }); await shot('x-photo-wait');
        calls.forEach((c,i)=>step('запрос к модели '+(i+1)+': HTTP '+c.status+(c.model?', модель '+c.model:'')+(c.error?', ошибка: '+c.error:'')));
        throw new Error('ответа нет за 8 мин; на странице: '+st+'; запросов к модели: '+calls.length); } await pg.waitForTimeout(800); await shot('4b-photo-result'); await pg.screenshot({path:path.join(OUT,'4b-photo-result-full.png'),fullPage:true});
      const v=await f2.evaluate(()=>{ const t=document.querySelector('#vtitle'), w=[...document.querySelectorAll('#vwhy li, #vwhy .card')].slice(0,8).map(e=>e.innerText.replace(/\s+/g,' ').slice(0,160)); return (t?t.textContent:'')+' | '+w.join(' | '); });
      step('ответ (прежняя страница) за '+Math.round((Date.now()-t1)/1000)+' с: '+v);
      calls.forEach((c,i)=>step('запрос к модели '+(i+1)+': HTTP '+c.status+(c.model?', модель '+c.model:'')+(c.fallback?' (запасная)':'')+(c.error?', ошибка: '+c.error:'')+(c.len?', ответ '+c.len+' знаков':'')));
      if(calls.some(c=>c.status===200&&c.model)) step('модель на сайте вызвана и ответила (через прежнюю страницу «фото листа»)'); else fail('шаг «ответ модели» на прежней странице: '+(calls.length?calls.map(c=>'HTTP '+c.status+(c.error?' — '+c.error:'')).join('; '):'запросов к /api/eyes не было'));
      await br.close(); return; }
    if(ai&&A.far==='1'){ await fr.check('#aiFar'); step('отметка «лист мой — можно зарубежной модели»: да (лист синтетический)'); }
    await pg.waitForTimeout(400); await shot('2-start');
    const t0=Date.now(); await fr.setInputFiles('#file2',file); await fr.waitForSelector('#scrWait:not([hidden])',{timeout:30000}); await pg.waitForTimeout(3000); await shot('3-wait');
    await fr.waitForSelector('#scrResult:not([hidden]) .card',{timeout:900000}); await pg.waitForTimeout(800); const dt=Math.round((Date.now()-t0)/1000);
    await shot('4-result'); await pg.screenshot({path:path.join(OUT,'4-result-full.png'),fullPage:true});
    const res=await fr.evaluate(()=>({h:(document.querySelector('#vtitle')||{}).textContent,note:[...document.querySelectorAll('#scrResult p.note')].map(e=>e.textContent).join(' '),
      cards:[...document.querySelectorAll('#vwhy .card')].map(c=>c.querySelector('h3').textContent+' — '+c.querySelector('.pill').textContent+': '+c.querySelector('.say').textContent)}));
    step('ответ за '+dt+' с: '+res.h); res.cards.forEach(c=>console.log('    '+c)); step('подпись: '+res.note);
    calls.forEach((c,i)=>step('запрос к модели '+(i+1)+': HTTP '+c.status+(c.model?', модель '+c.model:'')+(c.fallback?' (запасная — лучшая не ответила)':'')+(c.error?', ошибка: '+c.error:'')+(c.len?', ответ '+c.len+' знаков':'')));
    if(!calls.length) fail('шаг «запрос к модели»: кабинет не обращался к /api/eyes');
    else if(!calls.some(c=>c.status===200&&c.model)) fail('шаг «ответ модели»: '+calls.map(c=>'HTTP '+c.status+(c.error?' — '+c.error:'')).join('; '));
    else if(!/ИИ-зрение \(/.test(res.note)) fail('шаг «результат»: модель ответила, но в ответе страницы её нет');
    else step('ГОТОВО: модель вызвана, её ответ дошёл до мозга');
  }catch(e){ await shot('x-fail').catch(()=>{}); fail('сбой: '+String(e.message||e).split('\n')[0]); }
  if(errs.length) console.log('ошибки страницы: '+errs.join(' | '));
  await br.close(); })();
