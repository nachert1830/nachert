/* ═══════════ Вердикт по частям задания: «верно» / «ошибка: где и на сколько» / «не уверен: почему» ═══════════
   Один формат для ДЗ №3 (lk/scan/verify.js), №4 (verify4.js) и №5 (verify5.js) — его показывает кабинет (карточка в «Доводке»)
   и считает замер lab/dz/verdict-eval.js.
   Главное правило: ложное «ошибка» хуже молчания. «Ошибка» — только при доказательстве: величина или точка расходится с эталоном
   на ≥ 3 мм / 4° И привязка к варианту уверенная (ДЗ №3, №5: ≥ 4 точек условия, невязка ≤ 1 мм; ДЗ №4: очерки легли ≥ 85 %,
   невязка ≤ 0,45 мм). Иначе — «не уверен» с причиной и подсказкой. Способ построения не судится — только результат.
   of(dr) — по чертежу конвейера (dr.fit, dr.verify | dr.verify4 | dr.verify5) →
     {dz, n, verdict, why, parts:[{id, name, st, why, hint, got, want, d, unit, at:[{p:[u,v] мм листа, want?, seg?}]}], sure}
   Общий вердикт «верно» — только если верны все части. */
(function(){
'use strict';
const fmt=(x,d)=>x==null||!isFinite(x)?'—':(+x).toFixed(d==null?1:d).replace('.',',');
const rmsOf=f=>f?(f.hom&&f.hom.rmsMm!=null?f.hom.rmsMm:f.rmsMm):null;
/* привязка, при которой можно обвинять */
function sureFit(f){ if(!f||rmsOf(f)==null) return {sure:false,why:'чертёж не привязан к варианту'};
  const r=rmsOf(f);
  if(f.dz===4) return f.cover>=0.85&&r<=0.45?{sure:true}:{sure:false,why:'очерки тел легли на копию не точно (покрытие '+Math.round(100*(f.cover||0))+' %, невязка '+fmt(r,2)+' мм)'};
  if(f.dz===5) return f.cover>=0.8&&r<=0.6&&f.abCov>=0.7?{sure:true}:{sure:false,why:'очерк поверхности и прямая AB легли на копию не точно (покрытие '+Math.round(100*(f.cover||0))+' %, AB '+Math.round(100*(f.abCov||0))+' %, невязка '+fmt(r,2)+' мм)'};
  if(!(f.inl>=4)) return {sure:false,why:'мало точек условия ('+(f.inl||0)+')'};
  if(r>1) return {sure:false,why:'невязка привязки '+fmt(r,2)+' мм'};
  return {sure:true}; }
const fin=(dz,n,parts,sure,extra)=>{ const verdict=parts.some(p=>p.st==='ошибка')?'ошибка':parts.length&&parts.every(p=>p.st==='верно')?'верно':'не уверен';
  const bad=parts.filter(p=>p.st==='ошибка'), uns=parts.filter(p=>p.st==='не уверен');
  const why=verdict==='верно'?'все части верны':verdict==='ошибка'?'ошибка в '+(bad.length>1?'частях ':'части ')+bad.map(p=>p.id).join(', '):(uns.length?'не уверен в '+(uns.length>1?'частях ':'части ')+uns.map(p=>p.id).join(', '):'проверить нечего');
  return Object.assign({dz,n,verdict,why,parts,sure:sure.sure,sureWhy:sure.why||null},extra||{}); };
/* «ошибка» без уверенной привязки → «не уверен» с причиной */
const guard=(p,sure)=>{ if(p.st==='ошибка'&&!sure.sure){ p.st='не уверен'; p.why=p.why+' — но '+sure.why+', поэтому не утверждаю'; p.hint='снимите чертёж крупнее и ровнее, чтобы подписи точек условия читались'; } return p; };

/* ── ДЗ №3: части а — высота, б — угол граней, в — истинный вид ABC, г — угол SA ── */
const P3=[{id:'1',k:'H',name:'высота пирамиды',hint:'проверьте перенос расстояний (координат) на новую плоскость проекций — основание должно стать прямой'},
  {id:'2',k:'dih',name:'угол между гранью SAB и основанием',hint:'проверьте вторую замену плоскостей: ребро AB должно проецироваться в точку'},
  {id:'3',k:'true',name:'истинный вид основания ABC',hint:'проверьте вращение (или замену): основание должно стать параллельным плоскости проекций'},
  {id:'4',k:'phi',name:'угол между ребром SA и основанием',hint:'проверьте вращение ребра SA до положения прямой уровня'}];
const FAM=f=>f==='″'||f==='′'?'проекции '+f:'виде '+(f||'?');
function dz3(v,fit){ const sure=sureFit(fit), all=(v&&v.all)||(v&&v.found)||[], best={};
  all.forEach(f=>{ if(!best[f.k]||f.d<best[f.k].d) best[f.k]=f; });
  const parts=P3.map(q=>{ const f=best[q.k], p={id:q.id,name:q.name,st:'не уверен'};
    if(!f){ p.why='на копии не найдено вида, где это видно в натуральную величину'; p.hint='подпишите точки построения (A₄, B₄, S₄ …) и снимите чертёж крупнее'; return p; }
    const g=Array.isArray(f.got)?f.got:null, at=(f.at||[]).map(x=>({p:x}));
    Object.assign(p,{got:g?g.map(x=>+(+x).toFixed(1)):+(+f.got).toFixed(1),want:Array.isArray(f.want)?f.want.map(x=>+(+x).toFixed(1)):+(+f.want).toFixed(1),d:+(+f.d).toFixed(1),unit:f.unit,at,from:f.from});
    const val=g?'стороны '+g.map(x=>fmt(x)).join(' / ')+' мм, по варианту '+f.want.map(x=>fmt(x)).join(' / '):fmt(f.got)+' '+f.unit+', по варианту '+fmt(f.want)+' '+f.unit;
    if(f.st==='верно'){ p.st='верно'; p.why=val+' (на '+FAM(f.from)+')'; return p; }
    if(f.st==='расходится'&&!(q.k==='phi'&&f.weak)){ p.st='ошибка'; p.why=val+' — расходится на '+fmt(f.d)+' '+f.unit+' (на '+FAM(f.from)+')'; p.hint=q.hint; return guard(p,sure); }
    p.why=val+' — расхождение '+fmt(f.d)+' '+f.unit+': между «верно» и «ошибка», не утверждаю'; p.hint='начертите аккуратнее или снимите крупнее'; return p; });
  return fin(3,fit&&fit.n,parts,sure); }

/* ── ДЗ №4: каждая линия пересечения — своя часть ── */
const VW={F:'π₂',H:'π₁'};
function dz4(v,fit){ const sure=sureFit(fit);
  const parts=((v&&v.lines)||[]).map((L,i)=>{ const p={id:String(i+1),name:'линия пересечения '+L.pair,st:L.st==='расходится'?'ошибка':L.st==='верно'?'верно':'не уверен'};
    const pr=Object.entries(L.proj||{}).filter(([k,x])=>x.st!=='на очерке');
    if(p.st==='верно'){ p.why='совпадает с эталоном'+(pr.length?' ('+pr.map(([k,x])=>VW[k]+': '+Math.round(100*x.cov)+' %').join(', ')+')':''); }
    else if(p.st==='ошибка'){ const [k,x]=pr.find(([k,x])=>x.st==='расходится'); p.why='на '+VW[k]+' кривая ('+fmt(x.bad.len,0)+' мм) идёт в среднем в '+fmt(x.bad.mean)+' мм от эталона';
      Object.assign(p,{d:x.bad.mean,unit:'мм',at:x.bad.at?[{v:k,p:x.bad.at}]:[]}); p.hint='проверьте точки линии пересечения: каждая — на линии связи и на обоих телах (посредник: плоскость уровня или сфера)'; guard(p,sure); }
    else { const x=pr.map(([k,x])=>VW[k]+': '+x.why).join('; '); p.why=x||'линия не найдена'; p.hint='обведите линию пересечения лекалом поярче и снимите чертёж крупнее'; }
    return p; });
  return fin(4,fit&&fit.n,parts,sure); }

/* ── ДЗ №5: часть 1 — точки пересечения, часть 2 — касательная плоскость и нормаль ── */
function dz5(v,fit){ const sure=sureFit(fit); const parts=((v&&v.parts)||[]).map(p=>guard(Object.assign({},p,{at:(p.at||[]).map(a=>Object.assign({},a))}),sure));
  return fin(5,fit&&fit.n,parts,sure); }

function of(dr){ if(!dr||dr.error||!dr.fit) return null; const f=dr.fit;
  if(f.dz===3&&dr.verify) return dz3(dr.verify,f);
  if(f.dz===3) return fin(3,f.n,P3.map(q=>({id:q.id,name:q.name,st:'не уверен',why:'на копии не найдено вида, где это видно в натуральную величину',hint:'подпишите точки построения (A₄, B₄, S₄ …) и снимите чертёж крупнее'})),sureFit(f));
  if(f.dz===4&&dr.verify4) return dz4(dr.verify4,f);
  if(f.dz===5&&dr.verify5) return dz5(dr.verify5,f);
  return null; }
/* короткая строка для журнала и замера */
const line=V=>!V?'—':V.verdict+' ['+V.parts.map(p=>p.id+':'+(p.st==='верно'?'✓':p.st==='ошибка'?'✗':'?')).join(' ')+']';
const api={of,dz3,dz4,dz5,sureFit,line,P3};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else self.SCANVERDICT=api;
})();
