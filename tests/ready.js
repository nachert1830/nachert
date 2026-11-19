/* Страница сайта готова — вместо фиксированной паузы после перехода (tests/run.js и все проверки).
   Роутер отрисовал текущий адрес (CURH === location.hash, в том числе после перехода по # без перезагрузки),
   смена страниц через View Transition закончилась (роутер рисует новую страницу внутри перехода — уже после смены адреса),
   документ и шрифты загружены, прокрутка к началу страницы закончилась.
   waitIn(page, fn, arg, timeout) — ждать условия опросом через page.evaluate. Не page.waitForFunction: в Playwright CI (1.47)
   он вычисляет условие строкой через eval, а политика безопасности сайта (CSP) eval запрещает. */
async function waitIn(page,fn,arg,timeout){ const until=Date.now()+(timeout||120000);
  for(;;){ let ok=false; try{ ok=await page.evaluate(fn,arg); }catch(e){ if(!/context was destroyed|navigation/i.test(String(e))) throw e; }
    if(ok) return true; if(Date.now()>until) throw new Error('ожидание условия: время вышло'); await new Promise(r=>setTimeout(r,30)); } }
async function ready(page,timeout){
  await waitIn(page,()=>document.readyState==='complete'&&typeof CURH!=='undefined'&&CURH===(location.hash||'#/')&&!(window.__vtN>0)&&(!document.fonts||document.fonts.status==='loaded'),null,timeout||120000);
  /* счётчик незаконченных переходов — для следующих переходов этой страницы */
  await page.evaluate(()=>{ if(document.startViewTransition&&!document.__vtWrapped){ const o=document.startViewTransition.bind(document); document.__vtWrapped=1;
    document.startViewTransition=cb=>{ window.__vtN=(window.__vtN||0)+1; const vt=o(cb); const done=()=>{ window.__vtN--; }; vt.finished.then(done,done); return vt; }; }
    /* прокрутка к началу страницы (может быть плавной) закончилась: положение не меняется три кадра подряд */
    return new Promise(r=>{ let last=-1, same=0, n=0; const f=()=>{ const y=window.scrollY; same=y===last?same+1:0; last=y; if(same>=3||++n>180) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); });
}
module.exports=ready; module.exports.waitIn=waitIn;
