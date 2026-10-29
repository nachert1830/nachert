/* Поток проверки для интерфейса сканера (lab/cam.html, lab/dz.html): ровно worker.js, плюс отметки этапов для экрана
   ожидания. Проверку не меняет: вызовы проходят насквозь, страница лишь узнаёт, что началось и сколько найдено.
   Сообщения этапов: {progress:'sheet'} — ищу лист; 'find' — ищу чертежи; 'found', count; 'check', i, count — проверяю i-й. */
importScripts('worker.js'+((self.location&&self.location.search)||''));
(function(){
  const post=m=>{ try{ self.postMessage(Object.assign({progress:m.k},m)); }catch(e){} };
  const GS=self.LAB.dzGridSheet, EY=self.LAB.dzEyes;
  let count=0, i=0;
  const gcp=GS.checkGridPhoto; GS.checkGridPhoto=function(img,o){ if(o&&o.eyes){ i++; post({k:'check',i,count}); } else post({k:'sheet'}); return gcp.apply(this,arguments); };
  const fd=EY.findDrawings; EY.findDrawings=function(img,o){ post({k:'find'}); const r=fd.apply(this,arguments); count=r&&r.ok?r.drawings.length:0; i=0; post({k:'found',count}); return r; };
  /* новый снимок — счёт заново */
  const on=self.onmessage; self.onmessage=function(e){ count=0; i=0; return on.apply(this,arguments); };
})();
