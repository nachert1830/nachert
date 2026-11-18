/* Страница сайта готова — вместо фиксированной паузы после перехода (tests/run.js и все проверки).
   Роутер отрисовал текущий адрес (CURH === location.hash, в том числе после перехода по # без перезагрузки),
   документ и шрифты загружены, прошли два кадра (смена страниц идёт через View Transition). */
module.exports=async function ready(page,timeout){
  await page.waitForFunction(()=>document.readyState==='complete'&&typeof CURH!=='undefined'&&CURH===(location.hash||'#/')&&(!document.fonts||document.fonts.status==='loaded'),null,{timeout:timeout||120000,polling:'raf'});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
};
