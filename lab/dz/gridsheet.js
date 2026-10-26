/* ═══════════ Лист в клетку → проверка: весь путь ═══════════
   фото → сетка 5 мм (grid.js: узлы, карта искажений, плоский «скан» в мм, сетка стёрта) → линии (lines.js) →
   O по осям эпюра и калибровка по условию варианта (calib.js, только сдвиг: масштаб и направления даёт сетка) →
   заданное «как начерчено» (given.js: каждая проекция каждой точки) → эталонные ответы для данных варианта И для
   начерченных данных → построения частей (check3.js) по начерченным данным.
   Так разделяются две разные ошибки: «нанёс данные неточно» (числа отличаются от варианта, а построение верно для
   своего чертежа) и «ошибся в способе» (построение не сходится даже со своими точками).
   checkGridPhoto(img, {dz, n (0 — узнать по чертежу), answers:{H, dih, phi}}) → {ok, verdict, why[], n, grid, cal, given, ref, mine, parts}
   node lab/dz/gridsheet.js фото.png --dz=3 --n=7 [--part=a|b|c|d] [--H=28 --dih=81 --phi=25] */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const L=n=>isNode?require('./'+n+'.js'):self.LAB[{grid:'dzGrid',calib:'dzCalib',given:'dzGiven',check3:'dzCheck3',explain3d:'dzExplain3d',paper:'dzPaper',eyes:'dzEyes'}[n]];
const LN=isNode?require('../lines.js'):self.LAB.lines, DZ=isNode?require('../../core/dz.js'):self.CORE.dz, V=isNode?require('../../core/dz-variants.js'):self.CORE.dzVariants;
const f1=x=>(Math.round(x*10)/10).toString().replace('.',','), deg=x=>f1(x)+'°';
const ANS={H:{name:'высота пирамиды',u:' мм',tol:1.5},dih:{name:'угол между гранью SAB и основанием',u:'°',tol:1.5},phi:{name:'угол между ребром SA и основанием',u:'°',tol:1.5}};
/* оси эпюра — кандидаты O: пересечения длинных горизонталей и вертикалей */
function axesCands(segs){ const len=s=>Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]), dir=s=>Math.abs(Math.atan2(s.b[1]-s.a[1],s.b[0]-s.a[0])*180/Math.PI);
  /* ось рвётся подписями и построениями: коллинеарные куски (±0,6 мм) — одна прямая, длина — по охвату */
  const merge=(ss,k)=>{ const G=[]; ss.sort((a,b)=>len(b)-len(a)).forEach(s=>{ const c=(s.a[k]+s.b[k])/2, lo=Math.min(s.a[1-k],s.b[1-k]), hi=Math.max(s.a[1-k],s.b[1-k]); const g=G.find(g=>Math.abs(g.c-c)<=0.6);
      if(g){ g.lo=Math.min(g.lo,lo); g.hi=Math.max(g.hi,hi); g.ink+=len(s); } else G.push({c,lo,hi,ink:len(s)}); }); return G.map(g=>Object.assign(g,{L:g.hi-g.lo})); };
  const hor=merge(segs.filter(s=>len(s)>=8&&(dir(s)<=1||dir(s)>=179)),1).filter(g=>g.L>=50&&g.ink>=0.5*g.L).sort((a,b)=>b.ink-a.ink).slice(0,10);
  const ver=merge(segs.filter(s=>len(s)>=8&&Math.abs(dir(s)-90)<=1.5),0).filter(g=>g.L>=40&&g.ink>=0.5*g.L).sort((a,b)=>b.ink-a.ink).slice(0,10);
  const out=[]; hor.forEach(h=>ver.forEach(v=>out.push([v.c,h.c]))); return out; }
function checkGridPhoto(img,o){ o=o||{}; const dz=+o.dz||3, auto=!(+o.n), t0=Date.now(), why=[]; let n=+o.n||0, gv=auto?null:V.get(dz,n);
  /* какая часть задачи на этом фото (студент часто снимает каждую отдельно): указана — или по введённому ответу */
  const A0=o.answers||{}, given1=['H','dih','phi'].filter(k=>A0[k]!=null&&!isNaN(A0[k])), part=o.part||(given1.length===1?{H:'a',dih:'b',phi:'d'}[given1[0]]:null);
  if(!auto&&!gv) return {ok:false,verdict:'не могу проверить',why:['нет варианта '+n+' ДЗ №'+dz]};
  /* опора листа: сетка клеток (точнее всего) или — на чистом листе — края бумаги и сама фигура условия (paper.js).
     paper: 'grid' | 'plain' | 'auto' (по умолчанию: сетка, а если её нет — чистый лист) */
  const mode=o.paper||'auto', G=L('grid'), C=L('calib');
  /* o.eyes — один чертёж от глаз (eyes.js): точки условия с подписями, примерно; опора — сама фигура условия */
  let g=mode==='plain'?{ok:false,reason:'чистый лист'}:G.findGrid(img), sc, er, box, dig, cands, plain=null, vars=null, cal=null, eyesMm=null, eyesRange=null;
  if(g.ok){ sc=G.rectify(img,g,{ppm:8}); er=G.eraseGrid(sc); box=sc.box;
    const ex=LN.extract(er.img,{H:sc.H},{sheet:{O:[0,0],roi:box,given:()=>[]},maxIter:300}); if(!ex.ok) return {ok:false,verdict:'не могу прочитать',why:[ex.reason],grid:g};
    dig={ok:true,origin:'page',O:[0,0],box,segs:ex.segs,map:ex.map}; cands=axesCands(ex.segs);
    /* лист в клетку и глаза: метрика — сетка; глаза — где этот чертёж (его O) и какой вариант. Вариант без номера —
       три лучших по глазам, из них по линиям (покрытие ≥ 80 % и запас 15 пунктов — как без глаз) */
    if(o.eyes){ const ge=L('eyes').gridEyes(g,o.eyes,{dz,n:auto?0:n,box}); if(!ge.ok) return {ok:false,verdict:'не могу прочитать',why:[ge.reason],grid:g};
      eyesMm=ge.eyesMm; eyesRange=[ge.O[0]-8,ge.O[1]-8,ge.O[0]+8,ge.O[1]+8]; why.push('глаза: чертёж и его начало O — по подписям точек (сетка — мера)'+(ge.out.length?'; не согласуются с условием и отброшены — '+ge.out.join(', '):''));
      if(auto){ const vs=ge.cand.map(k=>{ const gk=V.get(dz,k), ck=C.calibrate(dig,{},gk.id,gk.data,{range:eyesRange,np:2,cands}); return {n:k,cover:ck.ok?ck.cover:0,cal:ck}; }).sort((a,b)=>b.cover-a.cover);
        const b=vs[0], b2=vs[1]||{cover:0}; if(!b||b.cover<0.8||b.cover-b2.cover<0.15) return {ok:false,verdict:'не могу прочитать',why:['вариант по чертежу не узнаётся однозначно ('+vs.map(v=>v.n+' — '+Math.round(v.cover*100)+' %').join(', ')+') — укажите номер варианта'],grid:g};
        n=b.n; gv=V.get(dz,n); cal=b.cal; why.push('вариант узнан по чертежу: '+n+' (условие на линиях '+Math.round(b.cover*100)+' %)'); } } }
  else if(mode==='grid') return {ok:false,verdict:'не могу прочитать',why:[g.reason+' — снимите лист целиком, сверху, при ровном свете'],grid:g};
  else { plain=o.eyes?L('eyes').prepareEyes(img,o.eyes,{dz,n:auto?0:n}):L('paper').preparePlain(img,{dz,n:auto?0:n}); if(plain.ok&&o.eyes) eyesMm=plain.eyesMm; if(!plain.ok) return {ok:false,verdict:'не могу прочитать',why:[plain.reason],grid:g,plain};
    sc=plain.scan; er={img:sc.img}; box=plain.box; dig=plain.dig; cands=plain.cands; why.push(...plain.why);
    if(auto){ n=plain.n; gv=V.get(dz,n); why.push('вариант узнан по чертежу: '+n+' (условие на линиях '+Math.round(plain.cover*100)+' %; ближайшая другая гипотеза — '+Math.round(plain.second*100)+' %)'); }
    /* карта и сводка «как у сетки»: мм листа → px снимка */
    g={ok:true,map:plain.map,found:0,cell:null,rms:0,ppm0:1,plain:true,eyes:!!o.eyes}; }
  /* вариант не указан — узнаём по чертежу: условие каждого из 30 вариантов прикладываем к линиям листа. Узнан, если
     лучший ложится на линии (≥ 80 %: настоящий даёт 90–100 %) и с запасом (≥ 15 пунктов) над вторым; иначе — просим
     указать номер. Было 60 %: быстрая оценка недооценила настоящий вариант, и чужой с 64 % прошёл за «узнанный» */
  if(auto&&!plain&&!cal){ vars=[]; for(let k=1;k<=30;k++){ const gk=V.get(dz,k); if(!gk) continue; const ck=C.calibrate(dig,{},gk.id,gk.data,{range:box,np:2,cands,quick:cands.length>0}); vars.push({n:k,cover:ck.ok?ck.cover:0}); }
    /* точно — три лучших по быстрой оценке (у быстрой O только на осях: вариант с недочерченной осью она недооценит) */
    vars.sort((a,b)=>b.cover-a.cover); vars.slice(0,3).forEach(v=>{ const gk=V.get(dz,v.n), ck=C.calibrate(dig,{},gk.id,gk.data,{range:box,np:2,cands}); v.cover=ck.ok?ck.cover:0; v.cal=ck; });
    vars.sort((a,b)=>(b.cal?1:0)-(a.cal?1:0)||b.cover-a.cover); const b=vars[0], b2=vars[1]||{cover:0};
    if(!b||b.cover<0.8||b.cover-b2.cover<0.15) return {ok:false,verdict:'не могу прочитать',why:['вариант по чертежу не узнаётся однозначно'+(b?' (похожи: '+vars.slice(0,3).map(v=>v.n+' — '+Math.round(v.cover*100)+' %').join(', ')+')':'')+' — укажите номер варианта'],variants:vars.slice(0,5).map(v=>({n:v.n,cover:v.cover})),grid:g,dig,scan:sc};
    n=b.n; gv=V.get(dz,n); why.push('вариант узнан по чертежу: '+n+' (условие на линиях '+Math.round(b.cover*100)+' %; ближайший другой — '+b2.n+': '+Math.round(b2.cover*100)+' %)'); cal=b.cal; }
  if(!cal) cal=C.calibrate(dig,{},gv.id,gv.data,{range:eyesRange||box,np:2,cands});
  if(!cal.ok||cal.cover<0.45) return {ok:false,verdict:'не могу прочитать',why:['условие варианта '+n+' на листе не узнаётся ('+Math.round((cal.cover||0)*100)+' % фигуры на линиях) — проверьте номер варианта'],grid:g,cal,dig,scan:sc};
  /* заданное как начерчено */
  /* чистый лист: изгиб бумаги не виден — погрешность каждой координаты не меньше 0,5 мм (СКО подгонки сюда не годится:
     в нём и точки, где линий нет вовсе — рёбра S не начерчены, штриховые) */
  /* по глазам на мелком фото (< 5 px/мм) замер грубее: σ не меньше 2,5 px */
  const sigFloor=plain?Math.max(0.5,plain.ppmPhoto?2.5/plain.ppmPhoto:0):0;
  const mg=L('given').measureGiven(dig,cal,gv.id,gv.data,{sigFloor}), miss=Object.entries(mg.pts).filter(([l,p])=>p.src==='не найдена').map(([l])=>l);
  const drawnOk=Object.values(mg.drawn).every(p=>p.every(v=>v!=null));
  const res={ok:true,dz,n,id:gv.id,data:gv.data,paper:o.eyes?'eyes':plain?'plain':'grid',plain:plain?{page:plain.page,flip:plain.flip,quad:plain.quad,fit:plain.fit,ppmPhoto:plain.ppmPhoto}:null,grid:plain?null:{nodes:g.found,cell:g.cell,rms:g.rms,hres:g.hres,ppm0:g.ppm0,dbg:g.dbg},scan:sc,erased:er,dig,cal,given:mg,ms:0};
  /* карта мм листа → px снимка (для разбора поверх фото) — не перечисляется: результат остаётся «данными» */
  Object.defineProperty(res,'_grid',{value:g,enumerable:false});
  const ref=DZ.solve(gv.id,gv.data); res.ref=ref;
  why.push('условие варианта '+n+' на линиях: '+Math.round(cal.cover*100)+' %; '+(plain?'подгонка условия — СКО '+f1(cal.rms||0)+' мм':'сетка: '+g.found+' узлов, лист выпрямлен с точностью '+f1(g.rms/g.ppm0*10)+' сотых мм'));
  /* «нанесено неточно» — отклонение ≥ 1,5 мм и ≥ 3σ замера этой точки (метку-кружок меряем грубее) */
  /* глаза против «нанесено неточно»: если глаза видят точку там, где она должна быть по варианту (ближе, чем
     найденная), найдена, скорее, чужая вершина (повёрнутая B₁′ рядом с B′) — об ошибке нанесения не утверждаем */
  if(eyesMm){ const Tc=cal.T, apT=m=>[Tc[0]+(1+Tc[2])*m[0]+Tc[3]*m[1],Tc[1]+Tc[4]*m[0]+(1+Tc[5])*m[1]];
    mg.diff.forEach(d=>{ if(!d.sure) return; const P=gv.data[d.n], ls=d.c==='x'?[d.n+'″',d.n+'′']:d.c==='y'?[d.n+'′']:[d.n+'″'];
      /* глаза этой точки не видели — может, её на этом чертеже нет вовсе (часть в) без S): найден чужой узел */
      const veto=ls.some(l=>!eyesMm[l])||ls.some(l=>{ const e=eyesMm[l], m=mg.pts[l]; if(!e||!m||m.src==='не найдена') return false; const ex=apT(l.endsWith('″')?[-P[0],-P[2]]:[-P[0],P[1]]);
        return Math.hypot(e[0]-ex[0],e[1]-ex[1])<Math.hypot(e[0]-m.p[0],e[1]-m.p[1]); });
      if(veto){ d.sure=false; d.eyesVeto=true; } });
    /* по глазам масштаб и перспективу даёт сама фигура условия: гомография по ней «впитывает» часть ошибки нанесения
       (крайняя точка, 2–3 мм). Поэтому — ошибка нанесения только от 3 мм, а «нанесено точно» не утверждаем */
    if(plain) mg.diff.forEach(d=>{ if(d.sure&&Math.abs(d.d)<3) d.sure=false; }); }
  const big=mg.diff.filter(d=>d.sure);
  if(miss.length&&!(miss.every(l=>l[0]==='S'))) why.push('не нашёл на листе: '+miss.join(', '));
  if(big.length) why.push('данные нанесены неточно: '+big.map(d=>d.n+' '+d.c+' = '+f1(d.drawn)+' вместо '+d.was).join(', '));
  /* «точно» — только если это видно: отклонение < 1,5 мм И замер не грубее ± 1 мм (иначе 0,8 мм при ± 2 мм —
     не «точно», а «не знаю») */
  else if(plain&&eyesMm) why.push('точность нанесения условия по такому фото не проверяется: масштаб и перспективу даёт сама фигура условия (ошибку от 3 мм сканер назвал бы); построение проверяется по начерченным точкам');
  else if(drawnOk&&mg.diff.every(d=>Math.abs(d.d)<1.5&&d.sg<=1)) why.push('все точки условия нанесены точно (каждая координата — в пределах 1,5 мм)');
  else if(drawnOk){ const un=mg.diff.filter(d=>Math.abs(d.d)>=1.5||d.sg>1); why.push('нанесение точек не подтверждаю: '+un.map(d=>d.n+' '+d.c+(Math.abs(d.d)>=1.5?' отклоняется на '+f1(Math.abs(d.d))+' мм при точности замера ± '+f1(d.sg)+' мм':' — замер грубый (± '+f1(d.sg)+' мм)')).join(', ')+' — переснимите ближе'); }
  const shs=Object.entries(mg.shift||{}).filter(([c,v])=>Math.abs(v)>=1.5); if(shs.length) why.push('весь чертёж сдвинут относительно '+shs.map(([c,v])=>(c==='x'?'оси z/y':'оси x')+' на '+f1(Math.abs(v))+' мм по '+c).join(' и ')+' — это перенос, на ответы не влияет');
  const badLink=mg.link.filter(l=>l.sure); if(badLink.length) why.push('линии связи: '+badLink.map(l=>l.n+'″ и '+l.n+'′ разошлись на '+f1(Math.abs(l.du))+' мм по x').join(', '));
  /* на снимке части в) пирамида может быть без S: построения ABC проверяем по начерченным A, B, C (S — из варианта, в в) не нужна) */
  if(!drawnOk&&gv.id==='3'&&['A','B','C'].every(k=>mg.drawn[k].every(v=>v!=null))){ const d2=Object.assign({},mg.drawn,{S:gv.data.S});
    try{ const cal2=Object.assign({},cal,{T:[mg.O[0],mg.O[1],0,0,0,0]}), a3=L('check3').check3(dig,{},cal2,d2); res.parts={c:a3.parts.c}; }catch(e){ res.partsErr=String(e); }
    const AB=Math.hypot(...[0,1,2].map(i=>mg.drawn.A[i]-mg.drawn.B[i])), BC=Math.hypot(...[0,1,2].map(i=>mg.drawn.B[i]-mg.drawn.C[i])), CA=Math.hypot(...[0,1,2].map(i=>mg.drawn.C[i]-mg.drawn.A[i]));
    why.push('S на этом фото не начерчена — для части в) не нужна; истинный вид ABC для начерченного треугольника: AB = '+f1(AB)+', BC = '+f1(BC)+', CA = '+f1(CA)+' мм (эталон '+f1(ref.AB)+', '+f1(ref.BC)+', '+f1(ref.CA)+')'); }
  if(drawnOk&&gv.id==='3'){ const mine=DZ.solve('3',mg.drawn); res.mine=mine;
    /* погрешность ответов для начерченной пирамиды: производные по каждой координате × её σ */
    const smine={}; Object.keys(ANS).forEach(k=>{ let q=0; Object.keys(mg.drawn).forEach(nm=>[0,1,2].forEach(i=>{ const sgm=mg.sig[nm][i]; if(!sgm) return; const d2=JSON.parse(JSON.stringify(mg.drawn)); d2[nm][i]+=0.5; const r2=DZ.solve('3',d2); q+=((r2[k]-mine[k])/0.5*sgm)**2; })); smine[k]=Math.sqrt(q); }); res.smine=smine;
    why.push('эталон для данных варианта: H = '+f1(ref.H)+' мм, угол SAB–ABC = '+deg(ref.dih)+', угол SA–ABC = '+deg(ref.phi));
    why.push('для пирамиды, как она начерчена на этом фото: H = '+f1(mine.H)+' ± '+f1(smine.H)+' мм, угол SAB–ABC = '+f1(mine.dih)+' ± '+deg(smine.dih)+', угол SA–ABC = '+f1(mine.phi)+' ± '+deg(smine.phi));
    /* ответы студента (вводит сам: подписи почерком сканер не читает) */
    const A=o.answers||{}; res.answers=[];
    Object.keys(ANS).forEach(k=>{ if(A[k]==null||isNaN(A[k])) return; const a=+A[k], dr=a-ref[k], dm=a-mine[k], spec=ANS[k], u=spec.u, sg=smine[k], spread=Math.abs(mine[k]-ref[k]);
      /* оценка — против эталона варианта (это и есть ответ задачи); причина — по начерченным данным:
         «данные» — если начерченная пирамида заметно другая (≥ допуска) и ответ с ней сходится; «построение» — если
         ответ не сходится и со своей пирамидой (дальше допуска + 2σ замера); иначе причину не утверждаем */
      let st, msg; const pts=big.map(d=>d.n+' '+d.c+' = '+f1(d.drawn)+' вместо '+d.was).join(', ');
      if(Math.abs(dr)<=spec.tol){ st='верно'; msg=spec.name+' '+f1(a)+u+' — верно (эталон '+f1(ref[k])+u+')'; }
      else if(spread>=spec.tol&&Math.abs(dm)<=spec.tol+2*sg){ st='данные'; msg=spec.name+' '+f1(a)+u+' — неверно (эталон '+f1(ref[k])+u+'), но для пирамиды, как она начерчена, ответ '+f1(mine[k])+' ± '+f1(sg)+u+' — с ним ваш сходится: способ верный, ошибка — в нанесении данных'+(pts?' ('+pts+')':''); }
      else if(Math.abs(dm)>spec.tol+2*sg){ st='построение'; msg=spec.name+' '+f1(a)+u+' — неверно (эталон '+f1(ref[k])+u+'); и для пирамиды, как она начерчена, должно быть '+f1(mine[k])+' ± '+f1(sg)+u+' — ошибка в построении или в замере'; }
      else { st='неверно'; msg=spec.name+' '+f1(a)+u+' — неверно на '+f1(Math.abs(dr))+u+' (эталон '+f1(ref[k])+u+'); для начерченной пирамиды '+f1(mine[k])+' ± '+f1(sg)+u+' — причина (данные или построение) в пределах точности фото не различается'; }
      res.answers.push({k,a,st,msg,ref:ref[k],mine:mine[k]}); why.push(msg); });
    /* построения частей — по начерченным данным (так ошибка нанесения не выдаётся за ошибку способа) */
    try{ const cal2=Object.assign({},cal,{T:[mg.O[0],mg.O[1],0,0,0,0]}), a3=L('check3').check3(dig,{},cal2,mg.drawn); res.parts=a3.parts; res.a3=a3; }catch(e){ res.partsErr=String(e); }
    /* г) по шагам начерченного построения (explain3d.js): от своей h₁ — к своим 3′, 4′ — к своему радиусу — к углу */
    try{ const segsD=C.drawSegs(dig,{T:[mg.O[0],mg.O[1],0,0,0,0]}).map(q=>({a:q.a,b:q.b,k:q.k})), ex=L('explain3d').explain3d(segsD,mg.drawn,{sig:mg.sig}); res.ex3d=ex;
      if(ex.steps.length&&ex.steps[0].status==='ok'){ const ps=ex.steps.find(q=>q.k==='psi');
        why.push('г) по шагам: '+ex.steps.map((q,i)=>(q.status==='ok'?'✓':q.status==='bad'?'✗':'?')+' '+(i+1)+'. '+q.msg).join('; '));
        if(ex.first) why.push('г) первая ошибка — шаг '+(ex.steps.indexOf(ex.first)+1)+' «'+ex.first.name+'»: '+ex.first.msg);
        if(ps&&res.parts&&res.parts.d&&res.parts.d.measured==null){ res.parts.d.measured=ps.val.phi; res.parts.d.mWhy='на чертеже φ = 90° − ψ = '+f1(ps.val.phi)+'° (ψ = '+f1(ps.val.psi)+'° при S̄′)'; } } }catch(e){ res.ex3dErr=String(e); }
    /* что начерчено в построении (замер по линиям листа) — где именно разошлось: построение или замер ответа */
    const PART={H:'a',dih:'b',phi:'d'};
    (res.answers||[]).forEach(x=>{ const pt=res.parts&&res.parts[PART[x.k]]; if(!pt||pt.measured==null) return; const m=pt.measured, spec=ANS[x.k], u=spec.u; x.measured=m;
      let w=pt.mWhy;
      if(Math.abs(m-x.mine)<=spec.tol+2*smine[x.k]&&Math.abs(x.a-m)>spec.tol) w+=' — построение верно, ошибка в замере итогового '+(u==='°'?'угла':'отрезка')+' (вы записали '+f1(x.a)+u+')';
      else if(Math.abs(x.a-m)<=spec.tol&&Math.abs(m-x.mine)>spec.tol+2*smine[x.k]) w+=' — записано то, что начерчено; расходится само построение (для вашей пирамиды '+f1(x.mine)+u+')';
      else if(Math.abs(m-x.mine)>spec.tol+2*smine[x.k]) w+=' — построение даёт '+f1(m)+u+' вместо '+f1(x.mine)+u+' (для вашей пирамиды), а записано '+f1(x.a)+u;
      x.msg+='; '+w; why.push(w); }); }
  /* итог: «ошибка» — только по измеренному (данные ≥ 1 мм от варианта или ответ вне допуска для обоих эталонов) */
  const ans=res.answers||[], ansBad=ans.some(a=>a.st==='построение'||a.st==='неверно'), ansData=ans.some(a=>a.st==='данные');
  const dataClean=!(plain&&eyesMm)&&mg.diff.length>0&&mg.diff.every(d=>Math.abs(d.d)<1.5&&d.sg<=1)&&(drawnOk||miss.every(l=>l[0]==='S'));
  /* первая ошибка в шагах г) — уже «ошибка», даже без записанного ответа (шаг неверен по линиям листа) */
  const stepBad=!!(res.ex3d&&res.ex3d.first&&res.ex3d.steps[0]&&res.ex3d.steps[0].status==='ok');
  /* показанная часть проверена по начерченным данным и верна (в) — истинный вид) — это «верно», даже если нанесение
     точек замером не подтверждено: построение сходится со своими же точками */
  const PSH=part?[part]:Object.keys(res.parts||{}).filter(k=>k!=='vis'&&res.parts[k].st!=='не найдено'), partOk=PSH.length>0&&PSH.every(k=>res.parts&&res.parts[k]&&res.parts[k].st==='верно');
  res.verdict=miss.length>2&&!ans.length&&!partOk?'не могу утверждать':ansBad||stepBad?'ошибка':ansData||big.length?'ошибка в данных':ans.length?'верно':dataClean?'данные нанесены верно':partOk?'верно':'не могу утверждать';
  /* части, которых на фото нет, не показываем: на снимке одной части чужие «похожие» линии — не ответ */
  if(part&&res.parts) res.shown=[part]; else if(res.parts) res.shown=Object.keys(res.parts).filter(k=>k!=='vis'&&res.parts[k].st!=='не найдено');
  /* видимость рёбер на листе в клетку — замечание (на экзаменационных листах её часто не требуют) */
  if(res.parts&&res.parts.vis&&res.parts.vis.st==='ошибка') res.visNote='видимость: '+res.parts.vis.why.filter(w=>/должно быть/.test(w)).join('; ');
  /* по глазам без уточнённой перспективы (чистый лист, мало точек условия на линиях) привязка грубая — не утверждаем */
  if(o.eyes&&plain&&!plain.fit&&['верно','ошибка','ошибка в данных','данные нанесены верно'].includes(res.verdict)){ why.push('перспектива по фото не уточнена (мало точек условия на линиях) — вердикт «'+res.verdict+'» не утверждаю; переснимите крупнее'); res.verdict='не могу утверждать'; }
  res.part=part; res.why=why; res.ms=Date.now()-t0; return res; }
put('dzGridSheet',{checkGridPhoto,axesCands});
if(isNode&&require.main===module){ const a=Object.fromEntries(process.argv.slice(3).map(x=>x.replace(/^--/,'').split('='))), IMG=require('../img.js');
  const img=IMG.decodePNG(require('fs').readFileSync(process.argv[2])), r=checkGridPhoto(img,{dz:+(a.dz||3),n:+(a.n||1),part:a.part||null,answers:{H:a.H!=null?+a.H:null,dih:a.dih!=null?+a.dih:null,phi:a.phi!=null?+a.phi:null}});
  console.log('ДЗ №'+(a.dz||3)+', вариант '+(a.n||1)+': '+r.verdict.toUpperCase()+' ('+r.ms+' мс)'); r.why.forEach(w=>console.log('  — '+w));
  if(r.given) Object.entries(r.given.pts).forEach(([l,p])=>console.log('     '+l.padEnd(3)+' '+p.src.padEnd(14)+' ('+p.p.map(v=>v.toFixed(2)).join('; ')+') мм листа'));
  if(r.parts) (r.shown||[]).forEach(k=>{ const p=r.parts[k]; if(p) console.log('  часть '+k+': '+p.st+' — '+(p.why||[]).join('; ')); });
  if(r.visNote) console.log('  замечание — '+r.visNote); }
})();
