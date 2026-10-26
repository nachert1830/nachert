/* ═══════════ ДЗ: проверка листа по фото — весь путь ═══════════
   фото → лист (ориентация, рамка, штамп, оси, O: locate.js) → линии (digitize.js) → калибровка по заданному
   варианта (calib.js) → вариант и точки условия → ответ (check2.js для ДЗ №2, check3.js для ДЗ №3).
   Вердикты: «верно», «ошибка» (с причинами в числах), «другое решение», «не тот вариант» — уверенные;
   «не могу прочитать», «не могу утверждать», «ответ не найден» — отказ с причиной: ложный вердикт хуже отказа.
   checkSheet(img, {dz:2|3, n}) → {verdict, why[], stage, loc, dig, cal, ans} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const L=n=>isNode?require('./'+n+'.js'):self.LAB[{locate:'dzLocate',digitize:'dzDigitize',calib:'dzCalib',check2:'dzCheck2',check3:'dzCheck3',explain2:'dzExplain2',eyes:'dzEyes',gridsheet:'dzGridSheet'}[n]];
const V=isNode?require('../../core/dz-variants.js'):self.CORE.dzVariants;
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');
const COORD={f:['x','z'],h:['x','y']};
/* точка условия смещена: какая координата и на сколько (сдвиг проекции в мм чертежа: u = −x, v = −z | +y) */
function pointMsg(p,data){ const d=p.dir, [cu,cv]=COORD[p.pr], P=data[p.n], out=[];
  if(Math.abs(d[0])>1.5) out.push(cu+' = '+f1(P[0]-d[0])+' вместо '+P[0]);
  if(Math.abs(d[1])>1.5){ const i=cv==='z'?2:1, val=cv==='z'?P[2]-d[1]:P[1]+d[1]; out.push(cv+' = '+f1(val)+' вместо '+P[i]); }
  return 'точка '+p.l+' нанесена не по данным варианта: '+(out.length?out.join(', '):'сдвиг '+f1(p.shift)+' мм'); }
function checkSheet(img,o){ o=o||{}; const dz=+o.dz||2, n=+o.n, g=V.get(dz,n); if(!g) return {verdict:'не могу проверить',why:['нет варианта '+n+' ДЗ №'+dz],stage:'вариант'};
  /* o.eyes — чертёж от глаз (eyes.js): рамка и штамп не нужны, опора — сама фигура условия */
  let loc, dig, cal, pre=[]; const C=L('calib');
  if(o.eyes){ const pe=L('eyes').prepareEyes(img,o.eyes,{dz,n}); if(!pe.ok) return {verdict:'не могу прочитать',why:[pe.reason],stage:'глаза'};
    loc={ok:true,eyes:true,O:null,fit:pe.fit}; dig=pe.dig; const c=pe.origin; cal=C.calibrate(dig,{},g.id,g.data,{range:[c[0]-3,c[1]-3,c[0]+3,c[1]+3],cands:L('gridsheet').axesCands(dig.segs)}); pre=pe.why; }
  else { loc=L('locate').locate(img); if(!loc.ok) return {verdict:'не могу прочитать',why:[loc.reason],stage:'лист',loc};
    dig=L('digitize').digitize(img,loc); if(!dig.ok) return {verdict:'не могу прочитать',why:[dig.reason],stage:'линии',loc,dig};
    cal=C.calibrate(dig,loc,g.id,g.data); }
  const res={loc,dig,cal}, R0=checkFrom(img,o,dz,n,g,loc,dig,cal,res); if(pre.length) R0.why=pre.concat(R0.why);
  /* по глазам без уточнённой перспективы (мало точек условия на линиях — у призмы и куба их всего 4) привязка грубая,
     до 2–3 мм: тип линии и положение ответа так не меряются — вердикт не утверждаем */
  if(loc.eyes&&!loc.fit&&['верно','ошибка','другое решение'].includes(R0.verdict)){ R0.why.push('перспектива по фото не уточнена (мало точек условия на линиях) — вердикт «'+R0.verdict+'» не утверждаю; переснимите крупнее'); R0.verdict='не могу утверждать'; }
  return R0; }
function checkFrom(img,o,dz,n,g,loc,dig,cal,res){ const C=L('calib');
  /* точки условия: какая-то нанесена не по данным? Проверка гипотезами «координата c точки P с ошибкой δ» по всей
     фигуре условия (calib.givenErrors) — всегда: малая ошибка точки почти не портит общую калибровку, но ломает ответ */
  const ge=cal.ok?C.givenErrors(dig,cal,g.id,g.data):null;
  /* по глазам гомография по фигуре условия «впитывает» часть ошибки нанесения: только явные (≥ 3 мм) */
  const bad=ge&&ge.ok&&(!loc.eyes||Math.abs(ge.best.d)>=3)?[ge.best]:[];
  const gmsg=h=>ge.coordSure?'у точки '+h.k+' координата '+h.c+' нанесена как ≈ '+f1(h.val)+' мм, а по варианту '+h.was+' мм (на листе: '+h.k+(h.c==='z'?'″':h.c==='y'?'′':'″ и '+h.k+'′')+')':'точка '+h.k+' нанесена не по данным варианта (сдвиг ≈ '+f1(Math.abs(h.d))+' мм; какая координата — по фото не различить)';
  if(!cal.ok||cal.cover<0.8){
    /* условие не узнаётся: не тот вариант? */
    if(loc.eyes) return Object.assign(res,{verdict:'не могу прочитать',why:['условие варианта '+n+' на линиях — '+Math.round((cal.cover||0)*100)+' %: мало для проверки — переснимите крупнее'],stage:'условие'});
    const w=C.whichVariant(dig,loc,dz), best=w[0];
    if(best.n!==n&&best.cover>=0.85&&best.cover-w[1].cover>=0.15) return Object.assign(res,{verdict:'не тот вариант',why:['на листе, похоже, вариант '+best.n+' ('+Math.round(best.cover*100)+' % условия на линиях), а указан '+n+' ('+Math.round((cal.cover||0)*100)+' %). Проверьте номер варианта'],stage:'вариант',variants:w.slice(0,3)});
    if(bad.length&&cal.cover>=0.6) return Object.assign(res,{verdict:'ошибка',why:bad.map(gmsg).concat(['дальше построение идёт от неверно нанесённых данных']),stage:'условие'});
    return Object.assign(res,{verdict:'не могу прочитать',why:['условие варианта '+n+' на листе не узнаётся ('+Math.round((cal.cover||0)*100)+' % на линиях): проверьте номер варианта или переснимите'],stage:'вариант',variants:w.slice(0,3)}); }
  if(bad.length) return Object.assign(res,{verdict:'ошибка',why:bad.map(gmsg).concat(['дальше построение идёт от неверно нанесённых данных']),stage:'условие'});
  if(dz===3){ const a3=L('check3').check3(dig,loc,cal,g.data);
    /* как в ДЗ №2: ошибка в построении — только при чисто нанесённом условии */
    if(a3.verdict==='ошибка'&&ge&&(ge.base<0.95||ge.best.cv-ge.base>=0.03)) return Object.assign(res,{verdict:'не могу утверждать',why:a3.why.concat(['но условие на листе нанесено неточно ('+Math.round(ge.base*100)+' % на линиях; похоже на смещение точки '+ge.best.k+') — проверьте данные варианта']),stage:'ответ',ans:a3});
    return Object.assign(res,{verdict:a3.verdict,why:a3.why,stage:'ответ',ans:a3}); }
  const ans=L('check2').check2(dig,loc,cal,g.id,g.data);
  /* «ошибка в ответе» — только если условие нанесено чисто: иначе ошибка может идти от неточно нанесённой точки */
  if(ans.verdict==='ошибка'&&ge&&(ge.base<0.95||ge.best.cv-ge.base>=0.03)) return Object.assign(res,{verdict:'не могу утверждать',why:ans.why.concat(['но условие на листе нанесено неточно ('+Math.round(ge.base*100)+' % на линиях; похоже на смещение точки '+ge.best.k+') — проверьте данные варианта']),stage:'ответ',ans});
  /* ошибка в ответе 2а — где она в построении: первый неверный шаг (explain2.js; только измеренное, иначе молчим) */
  if((ans.verdict==='ошибка'||ans.verdict==='верно')&&g.id==='2'&&ans.cur){ const ex=L('explain2').explain2(C.drawSegs(dig,cal),g.data,ans.cur), i=ex.first?ex.steps.indexOf(ex.first):-1, why=ans.why.slice();
    if(ans.verdict==='ошибка'&&ex.first){ const before=ex.steps.slice(0,i), ok=before.map((s,k)=>s.status==='ok'?k+1:0).filter(Boolean), unsure=before.map((s,k)=>s.status!=='ok'?k+1:0).filter(Boolean);
      const lst=a=>a.length>1?'шаги '+a.join(', '):'шаг '+a[0];
      why.push('где ошибка: шаг '+(i+1)+' «'+ex.first.name+'» — '+ex.first.msg+(before.length?' ('+[ok.length?lst(ok)+' — верно':'',unsure.length?lst(unsure)+' — на границе точности':''].filter(Boolean).join('; ')+')':'')); }
    /* ответ в допуске, а шаг построения измеренно неверен (например, n не ⟂ ABC на 6°, а высота вышла 79,6) — замечание, вердикт тот же */
    if(ans.verdict==='верно') ex.steps.filter(s=>s.status==='bad').forEach(s=>why.push('замечание к построению: шаг '+(ex.steps.indexOf(s)+1)+' «'+s.name+'» — '+s.msg+'; ответ всё же в допуске'));
    return Object.assign(res,{verdict:ans.verdict,why,stage:'ответ',ans,ex}); }
  return Object.assign(res,{verdict:ans.verdict,why:ans.why,stage:'ответ',ans}); }
put('dzCheck',{checkSheet,pointMsg});
/* node lab/dz/check.js фото.png --dz=2 --n=8 — вердикт по настоящему фото (фото студентов — только в lab/private/) */
if(isNode&&require.main===module){ const a=Object.fromEntries(process.argv.slice(3).map(x=>x.replace(/^--/,'').split('='))), IMG=require('../img.js');
  const img=IMG.decodePNG(require('fs').readFileSync(process.argv[2])), t0=Date.now(), r=checkSheet(img,{dz:+(a.dz||2),n:+(a.n||1)});
  console.log('ДЗ №'+(a.dz||2)+', вариант '+(a.n||1)+': '+r.verdict.toUpperCase()+' ('+(Date.now()-t0)+' мс)'); r.why.forEach(w=>console.log('  — '+w));
  if(r.cal&&r.cal.ok) console.log('  условие варианта на линиях листа: '+Math.round(r.cal.cover*100)+' %, СКО '+r.cal.rms.toFixed(2)+' мм'); }
})();
