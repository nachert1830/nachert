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
/* SCAN_UPTO=lines (Node) — остановиться после этапа: замер «по этапам» для сообщений коммитов */
const UPTO=isNode&&process.env.SCAN_UPTO||'';
const ORDER=['rectify','lines','labels','interpret'];
const has=n=>{ if(UPTO&&ORDER.indexOf(n)>ORDER.indexOf(UPTO)) return false; try{ return !!lab(n); }catch(e){ return false; } };

/* выпрямление — по уменьшенной копии (≤ 1600 px), гомография — для полного фото (линии ищутся по нему) */
function rectifyFull(img,n){ const IMG=lab('img'), small=IMG.downscale(img,1600), f=small.scale||1;
  const rect=lab('rectify').rectify(small,{n,minPx:3/f});
  if(rect.H&&f!==1){ const S=[f,0,(f-1)/2,0,f,(f-1)/2,0,0,1]; rect.H=IMG.H.norm(IMG.H.mul(S,rect.H)); rect.Hi=IMG.H.inv(rect.H); rect.ink=null; rect.scale=f; if(rect.pxPerMm) rect.pxPerMm*=f; }
  return rect; }
function scan(img,o){ o=o||{}; const n=o.n||47, t0=Date.now(), stages={};
  const refuse=(reason,extra)=>Object.assign({status:'refuse',reason,stages,ms:Date.now()-t0},extra||{});
  if(!has('rectify')) return refuse('сканер ещё не собран: нет этапа выпрямления');
  const rect=rectifyFull(img,n); stages.rectify=rect; if(!rect.ok) return refuse(rect.reason,{rect});
  if(!has('lines')) return refuse('нет этапа поиска линий',{rect});
  const ln=lab('lines').extract(img,rect,{n}); stages.lines=ln; if(!ln.ok) return refuse(ln.reason,{rect});
  const lb=has('labels')?lab('labels').attach(ln,rect,{n}):null; stages.labels=lb;
  if(!has('interpret')) return refuse('нет этапа интерпретации',{rect,scene:ln.scene});
  const it=lab('interpret').interpret(ln,lb,{n}); stages.interpret=it;
  if(!it.ok) return refuse(it.reason,{rect,scene:ln.scene,unknown:!!it.unknown,extraInfo:it.extraInfo,bestH:it.bestH});
  return {status:'verdict',verdict:it.verdict,scene:it.scene,rect,marks:it.marks,stages,ms:Date.now()-t0}; }

put('scan',{scan,rectifyFull});
})();
