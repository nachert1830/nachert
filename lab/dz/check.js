/* ═══════════ ДЗ: проверка листа по фото — весь путь ═══════════
   фото → лист (ориентация, рамка, штамп, оси, O: locate.js) → линии (digitize.js) → калибровка по заданному
   варианта (calib.js) → вариант и точки условия → ответ (check2.js для ДЗ №2, check3.js для ДЗ №3).
   Вердикты: «верно», «ошибка» (с причинами в числах), «другое решение», «не тот вариант» — уверенные;
   «не могу прочитать», «не могу утверждать», «ответ не найден» — отказ с причиной: ложный вердикт хуже отказа.
   checkSheet(img, {dz:2|3, n}) → {verdict, why[], stage, loc, dig, cal, ans} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const L=n=>isNode?require('./'+n+'.js'):self.LAB[{locate:'dzLocate',digitize:'dzDigitize',calib:'dzCalib',check2:'dzCheck2',check3:'dzCheck3'}[n]];
const V=isNode?require('../../core/dz-variants.js'):self.CORE.dzVariants;
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');
const COORD={f:['x','z'],h:['x','y']};
/* точка условия смещена: какая координата и на сколько (сдвиг проекции в мм чертежа: u = −x, v = −z | +y) */
function pointMsg(p,data){ const d=p.dir, [cu,cv]=COORD[p.pr], P=data[p.n], out=[];
  if(Math.abs(d[0])>1.5) out.push(cu+' = '+f1(P[0]-d[0])+' вместо '+P[0]);
  if(Math.abs(d[1])>1.5){ const i=cv==='z'?2:1, val=cv==='z'?P[2]-d[1]:P[1]+d[1]; out.push(cv+' = '+f1(val)+' вместо '+P[i]); }
  return 'точка '+p.l+' нанесена не по данным варианта: '+(out.length?out.join(', '):'сдвиг '+f1(p.shift)+' мм'); }
function checkSheet(img,o){ o=o||{}; const dz=+o.dz||2, n=+o.n, g=V.get(dz,n); if(!g) return {verdict:'не могу проверить',why:['нет варианта '+n+' ДЗ №'+dz],stage:'вариант'};
  const loc=L('locate').locate(img); if(!loc.ok) return {verdict:'не могу прочитать',why:[loc.reason],stage:'лист',loc};
  const dig=L('digitize').digitize(img,loc); if(!dig.ok) return {verdict:'не могу прочитать',why:[dig.reason],stage:'линии',loc,dig};
  const C=L('calib'), cal=C.calibrate(dig,loc,g.id,g.data), res={loc,dig,cal};
  /* точки условия: какая-то нанесена не по данным? Проверка гипотезами «координата c точки P с ошибкой δ» по всей
     фигуре условия (calib.givenErrors) — всегда: малая ошибка точки почти не портит общую калибровку, но ломает ответ */
  const ge=cal.ok?C.givenErrors(dig,cal,g.id,g.data):null;
  const bad=ge&&ge.ok?[ge.best]:[];
  const gmsg=h=>ge.coordSure?'у точки '+h.k+' координата '+h.c+' нанесена как ≈ '+f1(h.val)+' мм, а по варианту '+h.was+' мм (на листе: '+h.k+(h.c==='z'?'″':h.c==='y'?'′':'″ и '+h.k+'′')+')':'точка '+h.k+' нанесена не по данным варианта (сдвиг ≈ '+f1(Math.abs(h.d))+' мм; какая координата — по фото не различить)';
  if(!cal.ok||cal.cover<0.8){
    /* условие не узнаётся: не тот вариант? */
    const w=C.whichVariant(dig,loc,dz), best=w[0];
    if(best.n!==n&&best.cover>=0.85&&best.cover-w[1].cover>=0.15) return Object.assign(res,{verdict:'не тот вариант',why:['на листе, похоже, вариант '+best.n+' ('+Math.round(best.cover*100)+' % условия на линиях), а указан '+n+' ('+Math.round((cal.cover||0)*100)+' %). Проверьте номер варианта'],stage:'вариант',variants:w.slice(0,3)});
    if(bad.length&&cal.cover>=0.6) return Object.assign(res,{verdict:'ошибка',why:bad.map(gmsg).concat(['дальше построение идёт от неверно нанесённых данных']),stage:'условие'});
    return Object.assign(res,{verdict:'не могу прочитать',why:['условие варианта '+n+' на листе не узнаётся ('+Math.round((cal.cover||0)*100)+' % на линиях): проверьте номер варианта или переснимите'],stage:'вариант',variants:w.slice(0,3)}); }
  if(bad.length) return Object.assign(res,{verdict:'ошибка',why:bad.map(gmsg).concat(['дальше построение идёт от неверно нанесённых данных']),stage:'условие'});
  if(dz===3){ const a3=L('check3').check3(dig,loc,cal,g.data); return Object.assign(res,{verdict:a3.verdict,why:a3.why,stage:'ответ',ans:a3}); }
  const ans=L('check2').check2(dig,loc,cal,g.id,g.data);
  /* «ошибка в ответе» — только если условие нанесено чисто: иначе ошибка может идти от неточно нанесённой точки */
  if(ans.verdict==='ошибка'&&ge&&(ge.base<0.95||ge.best.cv-ge.base>=0.03)) return Object.assign(res,{verdict:'не могу утверждать',why:ans.why.concat(['но условие на листе нанесено неточно ('+Math.round(ge.base*100)+' % на линиях; похоже на смещение точки '+ge.best.k+') — проверьте данные варианта']),stage:'ответ',ans});
  return Object.assign(res,{verdict:ans.verdict,why:ans.why,stage:'ответ',ans}); }
put('dzCheck',{checkSheet,pointMsg});
})();
