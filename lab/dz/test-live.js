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
    const first=await pg.$eval('.tool8 b',e=>e.textContent); step('«Проверка», первая карточка: '+first); await pg.click('.tool8 >> nth=0');
    const fr=await (await pg.waitForSelector('iframe.labf',{timeout:30000})).contentFrame(); await fr.waitForSelector('#start',{timeout:30000});
    await fr.fill('#n',String(n)); await fr.dispatchEvent('#n','input');
    const ai=await fr.waitForSelector('#aiRow:not([hidden])',{timeout:15000}).then(()=>true,()=>false); step('ИИ-зрение в сканере: '+(ai?'включено':'НЕ ВИДНО'));
    if(!ai){ await shot('2-start'); fail('шаг «ИИ-зрение»: переключатель скрыт — кабинет ответил, что модели нет (/api/eyes не настроен) или страница не в кабинете'); }
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
