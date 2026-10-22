/* ═══════════ ДЗ: калибровка по заданному — какой вариант начерчен, верно ли нанесены точки условия ═══════════
   Каждый студент чертит заданное своего варианта: точки (обе проекции), фигуру условия (ABC, EF, …). Их положение
   на листе известно точно (таблица варианта → мм от O). Это опорные точки, как на геодезической съёмке:
   1. Подгонка T: мм чертежа → мм листа (аффинное, 6 параметров) по карте гребней (lab/lines.js): точки фигуры условия
      через 0,5 мм должны лечь на линии. Цена — усечённое расстояние до ближайшей линии (≤ 2 мм: чужие линии и ошибки
      студента не тянут). Начало — найденное O (поиск ±8 × ±4 мм) или, если оси z/y нет, сдвиг вдоль оси x.
      Подгонка снимает и неточность рамки от руки (масштаб, перекос — доли процента).
   2. Покрытие: доля точек фигуры условия в 0,6 мм от линии. Мера «это мой вариант».
   3. Каждая точка условия отдельно: сдвиг её «звезды» (участки фигуры у точки, 3–15 мм от неё) — так видно,
      что студент неверно отложил, например, z точки C (C″ сдвинута, C′ на месте).
   4. Вариант: та же подгонка для всех 30 вариантов этого ДЗ. Названный вариант должен быть лучшим и с запасом;
      иначе — «проверьте номер варианта» (и какой похож).
   calibrate(dig, loc, id, data) → {ok, T, cover, rms, pts:[{l, shift, cover}]}; whichVariant(dig, loc, dz, n). */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('../'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const IMG=lab('img'), RF=lab('rectify');
const M=isNode?require('./model.js'):self.LAB.dzModel, VAR=isNode?require('../../core/dz-variants.js'):self.CORE.dzVariants;
const CAP=2;

/* карта расстояний до линий (мм) по карте гребней оцифровки; кэш на объекте карты */
function dmap(map){ if(map._D) return map._D; const g=map.g, w=g.w, h=g.h, a=new Float32Array(w*h), th=map.tR*0.6;
  for(let i=0;i<w*h;i++) a[i]=map.R[i]>=th?1:0;
  map._D=RF.distMap({a,w,h,ppm:g.ppm||8,box:map.box},0.5,CAP); return map._D; }
const at=(D,p)=>{ const v=IMG.sample(D,(p[0]-D.box[0])*D.ppm-0.5,(p[1]-D.box[1])*D.ppm-0.5); return v==null?CAP:v; };
/* точки фигуры условия через 0,5 мм (мм чертежа), с меткой проекции и отрезка */
function samples(id,data){ const g=M.given(id,data), out=[];
  g.segs.forEach(s=>{ const L=Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]), n=Math.max(2,Math.round(L/0.5));
    for(let i=0;i<=n;i++){ const t=i/n; out.push({m:[s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t],seg:s.n,pr:s.pr,da:t*L,db:(1-t)*L}); } });
  return {pts:g.pts,segs:g.segs,S:out}; }
/* T: m ↦ [ox + (1+a)·u + b·v, oy + c·u + (1+d)·v] */
const apply=(x,m)=>[x[0]+(1+x[2])*m[0]+x[3]*m[1],x[1]+x[4]*m[0]+(1+x[5])*m[1]];
function cost(D,S,x){ let s=0; for(const q of S){ const d=at(D,apply(x,q.m)); s+=d*d; } return s/S.length; }
function coverOf(D,S,x,tol){ let k=0; for(const q of S) if(at(D,apply(x,q.m))<=(tol||0.6)) k++; return S.length?k/S.length:0; }
/* Гаусс — Ньютон (Левенберг) по усечённому расстоянию; np = 2 (сдвиг) или 6 (аффинное) */
function fit(D,S,x0,np,iters){ let x=x0.slice(), f=cost(D,S,x), lam=1e-2; const eps=[0.05,0.05,0.0005,0.0005,0.0005,0.0005];
  for(let it=0;it<(iters||30);it++){ const A=Array.from({length:np},()=>new Array(np+1).fill(0)); let used=0;
    for(const q of S){ const p=apply(x,q.m), d=at(D,p); if(d>=CAP*0.98) continue; used++;
      const J=[]; for(let k=0;k<np;k++){ const xk=x.slice(); xk[k]+=eps[k]; J.push((at(D,apply(xk,q.m))-d)/eps[k]); }
      for(let a=0;a<np;a++){ for(let b=0;b<np;b++) A[a][b]+=J[a]*J[b]; A[a][np]-=J[a]*d; } }
    if(used<10) break; for(let a=0;a<np;a++) A[a][a]=A[a][a]*(1+lam)+(a>=2?50:1e-6);   /* аффинная часть — с притяжением к 1 (рамка почти верна) */
    const dx=IMG.solve(A); if(!dx) break; const xn=x.slice(); for(let k=0;k<np;k++) xn[k]+=dx[k]; const fn=cost(D,S,xn);
    if(fn<f){ x=xn; f=fn; lam=Math.max(1e-6,lam/3); if(Math.max(...dx.map(Math.abs))<1e-4) break; } else { lam*=10; if(lam>1e5) break; } }
  return {x,f}; }
/* начальный сдвиг: перебор по сетке 1 мм — максимум покрытия при допуске 1,2 мм */
function coarse(D,S,o0,ranges){ const sub=S.filter((q,i)=>i%3===0); let best=null;
  for(let dv=ranges.v[0];dv<=ranges.v[1];dv+=1) for(let du=ranges.u[0];du<=ranges.u[1];du+=1){ const x=[o0[0]+du,o0[1]+dv,0,0,0,0], c=coverOf(D,sub,x,1.2); if(!best||c>best.c) best={c,x}; }
  return best; }
function calibrate(dig,loc,id,data,o){ o=o||{}; const D=dmap(dig.map), {pts,segs,S}=samples(id,data);
  /* начало: найденное O; иначе — ось x (v = 0) и сдвиг вдоль неё по всему полю */
  let o0, ranges;
  if(o.range){ o0=[0,0]; ranges={u:[o.range[0],o.range[2]],v:[o.range[1],o.range[3]]}; }   /* лист в клетку: O ищется по всему полю */
  else if(loc.O){ o0=loc.O; ranges={u:[-8,8],v:[-4,4]}; }
  else { if(!loc.axis) return {ok:false,reason:'нет оси x — не к чему привязать чертёж'};
    const [A,B]=loc.axis, yAt=x=>A[1]+(B[1]-A[1])*(x-A[0])/((B[0]-A[0])||1); o0=[0,yAt(200)]; ranges={u:[25,292],v:[-4,4]}; }
  let c0=coarse(D,S,o0,ranges); if(!c0) return {ok:false,reason:'калибровка не сошлась'};
  /* кандидаты O (лист в клетку: пересечения длинных горизонталей и вертикалей — оси эпюра). Начало эпюра на
     пересечении осей — сильная подсказка: если такой кандидат объясняет фигуру почти так же (−0,06), берём его.
     Нужна там, где часть фигуры не начерчена (рёбра S только точками) и построения дают случайное покрытие */
  if(o.cands&&o.cands.length){ const sub=S.filter((q,i)=>i%3===0); let bc=null;
    o.cands.forEach(cn=>{ let b=null; for(let dv=-2;dv<=2;dv+=0.5) for(let du=-2;du<=2;du+=0.5){ const x=[cn[0]+du,cn[1]+dv,0,0,0,0], c=coverOf(D,sub,x,1.2); if(!b||c>b.c) b={c,x}; } if(!bc||b.c>bc.c) bc=b; });
    if(bc&&bc.c>=c0.c-0.06) c0=Object.assign(bc,{fromAxes:true}); }
  let r=fit(D,S,c0.x,2,15); r=fit(D,S,r.x,o.np||6,30);   /* лист в клетку: масштаб и направления известны по сетке — только сдвиг (np = 2) */
  const cover=coverOf(D,S,r.x,0.6), cover1=coverOf(D,S,r.x,1.0);
  /* каждая точка условия: сдвиг её «звезды» (своя подгонка сдвига по участкам фигуры у точки) */
  const per=pts.map(p=>{ const near=S.filter(q=>q.pr===p.pr&&segs.some(s=>s.n===q.seg&&((Math.hypot(s.a[0]-p.at[0],s.a[1]-p.at[1])<1e-6&&q.da>=3&&q.da<=15)||(Math.hypot(s.b[0]-p.at[0],s.b[1]-p.at[1])<1e-6&&q.db>=3&&q.db<=15))));
    if(near.length<12) return {l:p.l,n:p.n,pr:p.pr,shift:null,cover:null};
    /* сдвиг звезды — в мм чертежа: x = T + δ. Звезда не на месте (покрытие < 0,7) — поиск сдвига по сетке ±10 мм
       (студент мог ошибиться на 5–10 мм, Гаусс — Ньютон так далеко не дотянется), затем уточнение */
    const cover0=coverOf(D,near,r.x,0.6); let x0=r.x;
    if(cover0<0.7){ let best=null; for(let dv=-10;dv<=10;dv+=0.5) for(let du=-10;du<=10;du+=0.5){ const x=r.x.slice(); x[0]+=du; x[1]+=dv; const c=coverOf(D,near,x,0.8); if(!best||c>best.c) best={c,x}; } x0=best.x; }
    const rl=fit(D,near,x0,2,15), sh=[rl.x[0]-r.x[0],rl.x[1]-r.x[1]];
    return {l:p.l,n:p.n,pr:p.pr,shift:Math.hypot(sh[0],sh[1]),dir:sh,cover:coverOf(D,near,rl.x,0.6),cover0}; });
  const rms=Math.sqrt(r.f);
  return {ok:true,T:r.x,cover,cover1,rms,pts:per,O:apply(r.x,[0,0]),n:S.length,fromAxes:!!c0.fromAxes}; }
/* ошибка в нанесении условия — проверка гипотез «точка P, координата c нанесена с ошибкой δ» по всей фигуре условия:
   δ ∈ [−15, 15] мм через 0,5; покрытие фигуры (с перерисованными отрезками этой точки) при той же калибровке T.
   Шесть сильнейших гипотез проверяются с новой калибровкой (неверная точка могла перекосить T). Лучшая принимается,
   если |δ| ≥ 2 мм, покрытие ≥ 0,92, прирост к исходному ≥ 0,06, а лучшая гипотеза про другую точку слабее на ≥ 0,04 —
   иначе неоднозначно. Ошибка в x меняет обе проекции сразу. */
function givenErrors(dig,cal,id,data){ const D=dmap(dig.map), base=cal.cover, hyp=[];
  const pert=(k,c,d)=>{ const dd=JSON.parse(JSON.stringify(data)); dd[k][c]+=d; return dd; };
  /* 1) грубо: при текущей калибровке */
  Object.keys(data).forEach(k=>[0,1,2].forEach(c=>{ let best=null;
    for(let d=-15;d<=15;d+=0.5){ if(Math.abs(d)<2) continue; const cv=coverOf(D,samples(id,pert(k,c,d)).S,cal.T,0.6); if(!best||cv>best.cv) best={cv,d}; }
    hyp.push({k,c,d:best.d,cv0:best.cv}); }));
  hyp.sort((a,b)=>b.cv0-a.cv0);
  /* 2) сильнейшие гипотезы — с новой калибровкой: неверная точка могла перекосить T */
  const refit=dd=>{ const S=samples(id,dd).S; let r=fit(D,S,cal.T,2,10); r=fit(D,S,r.x,6,20); return {cv:coverOf(D,S,r.x,0.6),T:r.x}; };
  const top=hyp.slice(0,6).map(h=>{ let best=null; for(let d=h.d-3;d<=h.d+3;d+=0.5){ if(Math.abs(d)<2) continue; const r=refit(pert(h.k,h.c,d)); if(!best||r.cv>best.cv) best=Object.assign({d},r); }
    return {k:h.k,c:'xyz'[h.c],d:best.d,cv:best.cv,T:best.T,val:data[h.k][h.c]+best.d,was:data[h.k][h.c]}; });
  top.sort((a,b)=>b.cv-a.cv); const h=top[0], other=top.find(x=>x.k!==h.k), sameK=top.find(x=>x!==h&&x.k===h.k);
  const ok=h.cv>=0.92&&h.cv-base>=0.06&&(!other||h.cv-other.cv>=0.04);
  /* та же точка, другая координата — почти так же хорошо (точка сдвинута вдоль своего отрезка): координату не называем */
  const coordSure=!sameK||h.cv-sameK.cv>=0.03;
  return {base,best:h,second:other,ok,coordSure}; }
/* какой вариант начерчен: калибровка всех вариантов ДЗ, лучший и запас до второго */
function whichVariant(dig,loc,dz,o){ o=o||{}; const out=[];
  for(let n=1;n<=30;n++){ const g=VAR.get(dz,n), c=calibrate(dig,loc,g.id,g.data); out.push({n,id:g.id,cover:c.ok?c.cover:0}); }
  out.sort((a,b)=>b.cover-a.cover); return out; }
/* отрезки листа в мм чертежа (от O): страница → чертёж обратным к T */
function drawSegs(dig,cal){ const T=cal.T, a=1+T[2], b=T[3], c=T[4], d=1+T[5], det=a*d-b*c, O=dig.O||[0,0];
  const inv=p=>{ const x=p[0]+O[0]-T[0], y=p[1]+O[1]-T[1]; return [(d*x-b*y)/det,(-c*x+a*y)/det]; };
  return dig.segs.map(s=>({a:inv(s.a),b:inv(s.b),len:s.len,k:s.k})); }
put('dzCalib',{calibrate,whichVariant,givenErrors,apply,dmap,at,CAP,drawSegs});
})();
