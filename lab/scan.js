/* ═══════════ Сканер: фото листа → вердикт ═══════════
   scan(img, {n}) — img как ImageData (RGBA). Конвейер, каждый этап — свой модуль со своим тестом:
     rectify (lab/rectify.js)   фото → лист в мм: рамка/край страницы, затем уточнение по напечатанному «дано»;
     clean   (lab/clean.js)     фон, тени, клетка → карта «карандаша» в мм чертежа;
     lines   (lab/lines.js)     отрезки, их тип (основная, тонкая, штриховая), точки-кружки;
     labels  (lab/labels.js)    подписи: readLabel(фрагмент) — шаблоны или внешняя модель (заглушка);
     interpret (lab/interpret.js) анализ через синтез: гипотезы = верные способы + ошибки библиотеки + «неизвестное».
   Ответ: {status:'verdict'|'refuse', reason, verdict, scene, rect, marks, stages}. Ложный вердикт хуже отказа:
   каждый этап может отказаться («не могу прочитать, переснимите») с причиной. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('./'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const has=n=>{ try{ return !!lab(n); }catch(e){ return false; } };

function scan(img,o){ o=o||{}; const n=o.n||47, t0=Date.now(), stages={};
  const refuse=(reason,extra)=>Object.assign({status:'refuse',reason,stages,ms:Date.now()-t0},extra||{});
  if(!has('rectify')) return refuse('сканер ещё не собран: нет этапа выпрямления');
  const rect=lab('rectify').rectify(img,{n}); stages.rectify=rect; if(!rect.ok) return refuse(rect.reason,{rect});
  if(!has('lines')) return refuse('нет этапа поиска линий',{rect});
  const ln=lab('lines').extract(img,rect,{n}); stages.lines=ln; if(!ln.ok) return refuse(ln.reason,{rect});
  const lb=has('labels')?lab('labels').attach(ln,rect,{n}):null; stages.labels=lb;
  if(!has('interpret')) return refuse('нет этапа интерпретации',{rect,scene:ln.scene});
  const it=lab('interpret').interpret(ln,lb,{n}); stages.interpret=it;
  if(!it.ok) return refuse(it.reason,{rect,scene:ln.scene});
  return {status:'verdict',verdict:it.verdict,scene:it.scene,rect,marks:it.marks,stages,ms:Date.now()-t0}; }

put('scan',{scan});
})();
