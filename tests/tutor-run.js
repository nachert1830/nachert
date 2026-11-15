/* Наставник в настоящем браузере (docs/TUTOR.md): node tests/tutor-run.js или из tests/run.js.
   Сценарии на пилотных задачах — ДЗ №4 вариант 13 и тетрадь № 70, экран телефона:
   «Не понимаю» → шторка с подсказкой ядра и подсветкой на чертеже; «Покажи на чертеже» — шаг по частям;
   «Решаю сам» → «Отметь, где будет точка»: касание мимо линии связи — диагноз и линия связи на чертеже, касание в точку — «верно»;
   свободный вопрос без входа — следующая ступень лестницы; ответ модели (подменённый сервер) — проверенные утверждения и подсветка. */
const fs=require('fs'), path=require('path');
async function run(browser,URL){ const fail=[], info=[];
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}); const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  const ok=(c,m)=>{ if(!c) fail.push('Наставник: '+m); };
  /* ДЗ №4, вариант 13, шаг 2 */
  await page.goto(URL+'#/ng4/13'); await page.waitForTimeout(1500);
  await page.click('.pl-main'); await page.click('.pl-main'); await page.waitForTimeout(300);
  if(await page.$('.pl-peek[aria-expanded="false"]')) await page.click('.pl-peek');
  await page.click('.pl-stuckbtn'); await page.waitForTimeout(700);
  ok(await page.$('.tu'),'ДЗ №4: «Не понимаю» не открыл шторку');
  const say=await page.evaluate(()=>(document.querySelector('.tu-log')||{}).innerText||''); ok(say.length>20,'ДЗ №4: пустая первая подсказка');
  ok(await page.evaluate(()=>document.querySelectorAll('.pl-paper svg .tu-ov').length>0),'ДЗ №4: подсказка не показана на чертеже');
  await page.click('.tu-l[data-l="2"]'); await page.waitForTimeout(400);
  ok(/посредник/.test(await page.evaluate(()=>(document.querySelector('.tu-cap')||{}).textContent||'')),'ДЗ №4: показ по частям не называет посредника');
  await page.click('.tu-x'); await page.waitForTimeout(200); ok(!(await page.$('.tu')),'ДЗ №4: шторка не закрылась');
  /* ответ модели: сервер подменён — ответ уже проверен ядром, шторка рисует его на чертеже */
  await page.evaluate(()=>{ self.CLUB_API='https://tutor-test.apigw.yandexcloud.net'; localStorage.setItem('lk_tok','t'.repeat(32)); localStorage.setItem('tu_consent','1'); });
  const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, content-type','access-control-allow-methods':'POST'};
  await page.route('https://tutor-test.apigw.yandexcloud.net/api/tutor',r=>r.request().method()==='OPTIONS'?r.fulfill({status:204,headers:CORS}):r.fulfill({status:200,contentType:'application/json',headers:CORS,
    body:JSON.stringify({say:'1″ и 5″ — пересечения очерков: их дала плоскость Φ.',ask:'Где тогда 1′?',options:['На Φ′','Где угодно'],show:[{do:'highlight',ids:['1″','5″']},{do:'link',p:'1″'}],claims:[{rel:'on',a:'1′',b:'Φ′',ok:true}],model:'claude-opus-5-5'})}));
  await page.click('.pl-stuckbtn'); await page.waitForTimeout(300);
  await page.fill('.tu-in input','Почему 1 и 5 плоскостью?'); await page.click('.tu-in .btn'); await page.waitForTimeout(900);
  const L=await page.evaluate(()=>({t:(document.querySelector('.tu-log')||{}).innerText||'',o:document.querySelectorAll('.tu-o').length,ov:document.querySelectorAll('.pl-paper svg .tu-ov').length,ok:!!document.querySelector('.tu-ok')}));
  ok(/плоскость Φ/.test(L.t)&&L.o===2&&L.ov>=2&&L.ok,'ответ модели не показан: '+JSON.stringify(L));
  await page.evaluate(()=>{ localStorage.removeItem('lk_tok'); localStorage.removeItem('tu_consent'); self.CLUB_API=''; });
  /* тетрадь № 70, «Решаю сам», шаг 3: отметить O₁′ */
  await page.goto(URL+'#/ng/tasks/70'); await page.waitForTimeout(1200);
  if(!(await page.$('.pl-mode[data-m="try"]'))){ await page.goto(URL+'#/ng/t/70'); await page.waitForTimeout(1200); }
  const has=await page.$('.pl-mode[data-m="try"]'); ok(has,'тетрадь № 70: нет плеера');
  if(has){ await page.click('.pl-mode[data-m="try"]'); await page.waitForTimeout(200);
    for(let i=0;i<3;i++){ await page.click('.pl-main'); await page.waitForTimeout(150); if(await page.$('.pl-reveal')&&i<2){ await page.click('.pl-reveal'); await page.waitForTimeout(150); } }
    if(await page.$('.pl-peek[aria-expanded="false"]')) await page.click('.pl-peek');
    const stuck=await page.$('.pl-stuckbtn'); ok(stuck,'тетрадь № 70: нет «Не понимаю» в «Решаю сам»');
    if(stuck){ await stuck.click(); await page.waitForTimeout(500);
      const tgt=await page.evaluate(()=>{ const T=document.querySelector('#view .pl')&&document.querySelector('.pl').closest('[id]'); const pl=[...document.querySelectorAll('*')].find(e=>e._pl); const S=pl&&pl._pl.state.tu; return S?{tap:S.tap,M:{pts:S.M.pts}}:null; });
      ok(tgt&&tgt.tap,'тетрадь № 70: наставник не просит отметить точку');
      if(tgt&&tgt.tap){ const P=tgt.M.pts[tgt.tap], Q=tgt.M.pts[tgt.tap.slice(0,-1)+(tgt.tap.endsWith('′')?'″':'′')];
        const scr=async xy=>page.evaluate(xy=>{ const svg=document.querySelector('.pl-paper svg.dwg'), probe=DRAW.svg({items:[{t:'pt',at:[0,0]}],fitTo:PLAYER.scene([...document.querySelectorAll('*')].find(e=>e._pl)._pl.part(),[...document.querySelectorAll('*')].find(e=>e._pl)._pl.state.k-1).fitTo}), m=/cx="([-\d.]+)" cy="([-\d.]+)"/.exec(probe);
          const p=svg.createSVGPoint(); p.x=xy[0]+(+m[1]); p.y=xy[1]+(+m[2]); const q=p.matrixTransform(svg.getScreenCTM()); return [q.x,q.y]; },xy);
        const off=await scr([P.xy[0]+40,P.xy[1]]); await page.mouse.click(off[0],off[1]); await page.waitForTimeout(500);
        const t1=await page.evaluate(()=>(document.querySelector('.tu-log')||{}).innerText||''); ok(/линии связи/.test(t1),'«отметь точку»: мимо линии связи — нет диагноза: '+t1.slice(-120));
        ok(await page.evaluate(()=>document.querySelectorAll('.pl-paper svg .tu-ov.tu-tmp').length>0),'«отметь точку»: линия связи не проведена');
        const on=await scr(P.xy); await page.mouse.click(on[0],on[1]); await page.waitForTimeout(500);
        const t2=await page.evaluate(()=>(document.querySelector('.tu-log')||{}).innerText||''); ok(/Верно/.test(t2),'«отметь точку»: верное место не принято: '+t2.slice(-120));
        const mdl=await page.evaluate(()=>JSON.parse(localStorage.getItem('nch2_tu_model')||'null')||(window.ST&&ST.get('tu_model',null))); ok(mdl&&mdl.tap&&mdl.tap.ok>=1&&mdl.mis&&mdl.mis.link>=1,'модель знаний не записала ошибку и успех'); }
      /* свободный вопрос без входа — следующая ступень лестницы */
      const n0=await page.evaluate(()=>document.querySelectorAll('.tu-m.ai').length); await page.fill('.tu-in input','почему?'); await page.click('.tu-in .btn'); await page.waitForTimeout(400);
      ok(await page.evaluate(n=>document.querySelectorAll('.tu-m.ai').length>n,n0),'вопрос без входа остался без ответа'); } }
  ok(!errs.length,'ошибки страницы: '+errs.slice(0,3).join(' | '));
  info.push('Наставник в браузере: ДЗ №4 в.13 и тетрадь № 70 — '+(fail.length?'ошибок '+fail.length:'шторка, чертёж, «отметь точку», ответ модели — работают'));
  await page.close(); return {fail,info}; }
module.exports={run};
if(require.main===module){ (async()=>{ const http=require('http'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const ROOT=path.join(__dirname,'..'), T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png'};
  const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1');
  await new Promise(r=>srv.on('listening',r)); const b=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const r=await run(b,'http://127.0.0.1:'+srv.address().port+'/'); r.info.forEach(x=>console.log(x)); r.fail.forEach(x=>console.log('✗ '+x)); await b.close(); srv.close(); process.exit(r.fail.length?1:0); })(); }
