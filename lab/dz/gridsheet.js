/* ═══════════ Лист в клетку → проверка: весь путь ═══════════
   фото → сетка 5 мм (grid.js: узлы, карта искажений, плоский «скан» в мм, сетка стёрта) → линии (lines.js) →
   O по осям эпюра и калибровка по условию варианта (calib.js, только сдвиг: масштаб и направления даёт сетка) →
   заданное «как начерчено» (given.js: каждая проекция каждой точки) → эталонные ответы для данных варианта И для
   начерченных данных → построения частей (check3.js) по начерченным данным.
   Так разделяются две разные ошибки: «нанёс данные неточно» (числа отличаются от варианта, а построение верно для
   своего чертежа) и «ошибся в способе» (построение не сходится даже со своими точками).
   checkGridPhoto(img, {dz, n, answers:{H, dih, phi}}) → {ok, verdict, why[], grid, cal, given, ref, mine, parts}
   node lab/dz/gridsheet.js фото.png --dz=3 --n=7 [--part=a|b|c|d] [--H=28 --dih=81 --phi=25] */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const L=n=>isNode?require('./'+n+'.js'):self.LAB[{grid:'dzGrid',calib:'dzCalib',given:'dzGiven',check3:'dzCheck3',explain3d:'dzExplain3d'}[n]];
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
function checkGridPhoto(img,o){ o=o||{}; const dz=+o.dz||3, n=+o.n, gv=V.get(dz,n), t0=Date.now(), why=[];
  /* какая часть задачи на этом фото (студент часто снимает каждую отдельно): указана — или по введённому ответу */
  const A0=o.answers||{}, given1=['H','dih','phi'].filter(k=>A0[k]!=null&&!isNaN(A0[k])), part=o.part||(given1.length===1?{H:'a',dih:'b',phi:'d'}[given1[0]]:null);
  if(!gv) return {ok:false,verdict:'не могу проверить',why:['нет варианта '+n+' ДЗ №'+dz]};
  const G=L('grid'), g=G.findGrid(img); if(!g.ok) return {ok:false,verdict:'не могу прочитать',why:[g.reason+' — снимите лист целиком, сверху, при ровном свете'],grid:g};
  const sc=G.rectify(img,g,{ppm:8}), er=G.eraseGrid(sc), box=sc.box;
  const ex=LN.extract(er.img,{H:sc.H},{sheet:{O:[0,0],roi:box,given:()=>[]},maxIter:300}); if(!ex.ok) return {ok:false,verdict:'не могу прочитать',why:[ex.reason],grid:g};
  const dig={ok:true,origin:'page',O:[0,0],box,segs:ex.segs,map:ex.map}, C=L('calib');
  const cal=C.calibrate(dig,{},gv.id,gv.data,{range:box,np:2,cands:axesCands(ex.segs)});
  if(!cal.ok||cal.cover<0.45) return {ok:false,verdict:'не могу прочитать',why:['условие варианта '+n+' на листе не узнаётся ('+Math.round((cal.cover||0)*100)+' % фигуры на линиях) — проверьте номер варианта'],grid:g,cal,dig,scan:sc};
  /* заданное как начерчено */
  const mg=L('given').measureGiven(dig,cal,gv.id,gv.data), miss=Object.entries(mg.pts).filter(([l,p])=>p.src==='не найдена').map(([l])=>l);
  const drawnOk=Object.values(mg.drawn).every(p=>p.every(v=>v!=null));
  const res={ok:true,dz,n,id:gv.id,data:gv.data,grid:{nodes:g.found,rms:g.rms,hres:g.hres,ppm0:g.ppm0,dbg:g.dbg},scan:sc,erased:er,dig,cal,given:mg,ms:0};
  const ref=DZ.solve(gv.id,gv.data); res.ref=ref;
  why.push('условие варианта '+n+' на линиях: '+Math.round(cal.cover*100)+' %; сетка: '+g.found+' узлов, лист выпрямлен с точностью '+f1(g.rms/g.ppm0*10)+' сотых мм');
  /* «нанесено неточно» — отклонение ≥ 1,5 мм и ≥ 3σ замера этой точки (метку-кружок меряем грубее) */
  const big=mg.diff.filter(d=>d.sure);
  if(miss.length&&!(miss.every(l=>l[0]==='S'))) why.push('не нашёл на листе: '+miss.join(', '));
  if(big.length) why.push('данные нанесены неточно: '+big.map(d=>d.n+' '+d.c+' = '+f1(d.drawn)+' вместо '+d.was).join(', '));
  else if(drawnOk) why.push('все точки условия нанесены точно (каждая координата — в пределах 1,5 мм)');
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
  res.verdict=miss.length>2&&!ans.length?'не могу утверждать':ansBad?'ошибка':ansData||big.length?'ошибка в данных':ans.length?'верно':'данные нанесены верно';
  /* части, которых на фото нет, не показываем: на снимке одной части чужие «похожие» линии — не ответ */
  if(part&&res.parts) res.shown=[part]; else if(res.parts) res.shown=Object.keys(res.parts).filter(k=>k!=='vis'&&res.parts[k].st!=='не найдено');
  /* видимость рёбер на листе в клетку — замечание (на экзаменационных листах её часто не требуют) */
  if(res.parts&&res.parts.vis&&res.parts.vis.st==='ошибка') res.visNote='видимость: '+res.parts.vis.why.filter(w=>/должно быть/.test(w)).join('; ');
  res.part=part; res.why=why; res.ms=Date.now()-t0; return res; }
put('dzGridSheet',{checkGridPhoto,axesCands});
if(isNode&&require.main===module){ const a=Object.fromEntries(process.argv.slice(3).map(x=>x.replace(/^--/,'').split('='))), IMG=require('../img.js');
  const img=IMG.decodePNG(require('fs').readFileSync(process.argv[2])), r=checkGridPhoto(img,{dz:+(a.dz||3),n:+(a.n||1),part:a.part||null,answers:{H:a.H!=null?+a.H:null,dih:a.dih!=null?+a.dih:null,phi:a.phi!=null?+a.phi:null}});
  console.log('ДЗ №'+(a.dz||3)+', вариант '+(a.n||1)+': '+r.verdict.toUpperCase()+' ('+r.ms+' мс)'); r.why.forEach(w=>console.log('  — '+w));
  if(r.given) Object.entries(r.given.pts).forEach(([l,p])=>console.log('     '+l.padEnd(3)+' '+p.src.padEnd(14)+' ('+p.p.map(v=>v.toFixed(2)).join('; ')+') мм листа'));
  if(r.parts) (r.shown||[]).forEach(k=>{ const p=r.parts[k]; if(p) console.log('  часть '+k+': '+p.st+' — '+(p.why||[]).join('; ')); });
  if(r.visNote) console.log('  замечание — '+r.visNote); }
})();
