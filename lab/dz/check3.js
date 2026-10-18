/* ═══════════ ДЗ №3: проверка по фото — свободные выборы студента находятся, остальное предсказывается ═══════════
   а), б) — замена плоскостей. Новая ось — одна из прямых листа (оцифровка): для каждой прямой ℓ, проекции-основы
      (h′ или f″) и стороны откладывания предсказываются новые проекции A₄…S₄ (lib/dz/model3.js) и проверяется, что
      на листе есть линии связи к ним (⟂ ℓ) и рёбра пирамиды на π₄. Лучшая гипотеза — это построение студента.
      По направлению оси понятно, что это: ⟂ h′ (⟂ f″) — высота (а), ∥ A′B′ (A″B″) — первый шаг угла (б).
      Затем — по точкам: для каждой новой проекции перебор сдвига вдоль её линии связи (неверно отложенное
      расстояние), для оси — отклонение направления от нужного. б) второй шаг — так же, от проекций на π₄.
   в) вращение вокруг прямой уровня: перебор вида (h / f), уровня c и направления поворота; треугольник A₀B₀C₀
      и пути вершин ⟂ оси вращения. Потом — по вершинам: перебор радиуса (сдвиг вдоль пути).
   г) вращение плоскости (SA, n): перебор уровня горизонтали и направления; S₀A₀ и S₀Y₀ (n₀). Потом — радиус S.
   Вердикт по части: «верно» (всё на месте, отклонения в допуске 1,5 мм / 1,5°), «ошибка» (найдено уверенно и
   отклонение ≥ 3 мм / 3°), «не найдено» / «не могу утверждать». Лист — «верно», только если верны все четыре части
   и видимость заданной пирамиды.
   check3(dig, loc, cal, data) → {verdict, why[], parts:{a,b,c,d}} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const DZ=isNode?require('../../core/dz.js'):self.CORE.dz, M=isNode?require('./model.js'):self.LAB.dzModel, M3=isNode?require('./model3.js'):self.LAB.dzModel3;
const C=isNode?require('./calib.js'):self.LAB.dzCalib, K2=isNode?require('./check2.js'):self.LAB.dzCheck2;
const {v2,Fp,Hp}=M3, NM=M3.NAMES, TOL=1.5, BAD=3, ANG_BAD=5;   /* направление оси: ошибка — с 5° (по фото угол оси известен до ~1°) */
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');
const angDeg=(e,f)=>{ const c=Math.abs(v2.dot(v2.unit(e),v2.unit(f))); return Math.acos(Math.min(1,c))*180/Math.PI; };
/* отрезки чертежа (мм от O) из оцифровки: страница → чертёж обратным к T */
function drawSegs(dig,cal){ const T=cal.T, a=1+T[2], b=T[3], c=T[4], d=1+T[5], det=a*d-b*c, O=dig.O||[0,0];
  const inv=p=>{ const x=p[0]+O[0]-T[0], y=p[1]+O[1]-T[1]; return [(d*x-b*y)/det,(-c*x+a*y)/det]; };
  return dig.segs.map(s=>({a:inv(s.a),b:inv(s.b),len:s.len,k:s.k})); }
const cov=(D,T,segs)=>K2.cover(D,T,segs);
/* покрытие с допуском tol (тонкие длинные линии связи: направление от руки гуляет — 1 мм) */
function covT(D,T,segs,tol){ let k=0, n=0; segs.forEach(([a,b])=>{ const L=v2.len(v2.sub(b,a)); if(L<5) return; for(let s=2;s<=L-2;s+=0.5){ const p=v2.add(a,v2.mul(v2.sub(b,a),s/L)); n++; if(C.at(D,C.apply(T,p))<=tol) k++; } }); return n?k/n:0; }
/* «как начерчено»: каждую точку фигуры сдвигаем (±2 мм) туда, где её рёбра и линия связи лучше лежат на линиях листа —
   следующий шаг студент строит от начерченного, а не от точного */
function anchor(D,T,P,keep){ const Q=Object.assign({},P);
  for(let it=0;it<2;it++) NM.forEach(k=>{ const nb=NM.filter(o=>o!==k).map(o=>Q[o]).filter(o=>v2.len(v2.sub(o,Q[k]))>8), sc=X=>covT(D,T,nb.map(o=>[X,o]).concat(keep&&keep[k]?[[keep[k],X]]:[]),0.6);
    let best={X:Q[k],c:sc(Q[k])}; for(let dx=-2;dx<=2;dx+=0.25) for(let dy=-2;dy<=2;dy+=0.25){ const X=v2.add(P[k],[dx,dy]), c=sc(X); if(c>best.c+1e-9) best={X,c}; } Q[k]=best.X; });
  return Q; }
const covOne=(D,T,a,b)=>{ const r=K2.segCover(D,T,a,b); return r?r.c:null; };
/* лучшие k рёбер из списка (студент чертит не все) */
const bestK=(D,T,segs,k)=>{ const c=segs.map(s=>covOne(D,T,s[0],s[1])).filter(x=>x!=null).sort((a,b)=>b-a); if(!c.length) return 0; const t=c.slice(0,k); return t.reduce((s,x)=>s+x,0)/t.length; };
const EDGES=[['A','B'],['B','C'],['C','A'],['S','A'],['S','B'],['S','C']];
/* гипотезы замены от прямых листа */
function replaceHyps(D,T,data,lines,from){ const out=[];
  lines.forEach(L=>{ (from?[from.base]:['h','f']).forEach(base=>[1,-1].forEach(side=>{
    const s=from?M3.second(data,from.s,L,side):M3.first(data,base,L,side), keep=k=>from?from.s.P[k]:(base==='h'?Hp(data[k]):Fp(data[k]));
    const conn=NM.map(k=>[keep(k),s.P[k]]).filter(([a,b])=>v2.len(v2.sub(a,b))>8);
    if(conn.length<3) return; const cc=covT(D,T,conn,1.0); if(cc<0.55) return;
    const fig=bestK(D,T,EDGES.map(([a,b])=>[s.P[a],s.P[b]]),3); out.push({L,base,side,s,cc,fig,score:0.6*cc+0.4*fig}); })); });
  out.sort((a,b)=>b.score-a.score);
  /* уточнение оси лучших гипотез: поворот ±3° и сдвиг ±1,5 мм — по линиям связи (направление оси по короткому
     отрезку оцифровки неточно на 1–2°, а от направления зависит вердикт) */
  out.slice(0,4).forEach(h=>{ const make=(L)=>from?M3.second(data,from.s,L,h.side):M3.first(data,h.base,L,h.side), keep=k=>from?from.s.P[k]:(h.base==='h'?Hp(data[k]):Fp(data[k]));
    /* цена: линии связи + сама начерченная ось (она и держит положение оси: связи ⟂ ей от сдвига почти не меняются) */
    const sc=L=>{ const s=make(L), ax=covOne(D,T,v2.add(L.p,v2.mul(L.e,h.L.t0||0)),v2.add(L.p,v2.mul(L.e,h.L.t1||30)))||0; return 0.5*covT(D,T,NM.map(k=>[keep(k),s.P[k]]).filter(([a,b])=>v2.len(v2.sub(a,b))>8),1.0)+0.5*ax; };
    let best={L:h.L,c:sc(h.L)}; const c0=v2.add(h.L.p,v2.mul(h.L.e,0));
    for(const [da,step] of [[3,0.25],[0.4,0.05]]) { const b0=best.L, ang0=Math.atan2(b0.e[1],b0.e[0]);
      for(let a=-da;a<=da+1e-9;a+=step) for(let o=-1.5;o<=1.5+1e-9;o+=da>1?0.25:0.05){ const an=ang0+a*Math.PI/180, e=[Math.cos(an),Math.sin(an)], L=M3.line(v2.add(b0.p,v2.mul(v2.perp(b0.e),o)),e), c=sc(L); if(c>best.c) best={L,c}; } }
    best.L.t0=h.L.t0; best.L.t1=h.L.t1; h.L=best.L; h.s=make(best.L); h.cc=best.c; });
  return out.sort((a,b)=>b.score-a.score); }
/* положение точки новой проекции по линиям, что из неё начерчены. Сдвиг δ (неверное расстояние, неверный радиус)
   идёт вдоль направления nu; рёбра почти вдоль nu (< 20°) о сдвиге не говорят — их не берём.
   ok   — каждое такое ребро лежит на месте (≥ 0,7 при δ = 0);
   bad  — уверенно: ≥ 2 ребра сходятся в одном сдвинутом месте (≥ 0,9, |δ| ≥ 3 мм), а на месте их нет (≤ 0,35);
   иначе — неясно (точку не подтверждаем и в ошибке не обвиняем), с подсказкой, куда сходятся линии. */
const covRaw=(D,T,a,b)=>{ const L=v2.len(v2.sub(b,a)), n=Math.max(2,Math.round(L/0.25)); let k=0; for(let i=0;i<=n;i++){ const p=v2.add(a,v2.mul(v2.sub(b,a),i/n)); if(C.at(D,C.apply(T,p))<=0.6) k++; } return k/(n+1); };
function pointEvidence(D,T,P,others,nu,from){ const inc=others.filter(o=>{ const d=v2.sub(o,P); return v2.len(d)>8&&angDeg(d,nu)>=20; });
  const at=Q=>inc.map(o=>covOne(D,T,Q,o)||0), mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  /* «на месте» — в пределах допуска ±1,5 мм (рука, ось, начерченная с дрожью, — студент меряет от неё) */
  let near={c:-1,each:null}, best={d:0,c:-1,each:null};
  for(let d=-12;d<=12;d+=0.25){ const e=at(v2.add(P,v2.mul(nu,d))), c=mean(e); if(Math.abs(d)<=TOL&&c>near.c) near={d,c,each:e}; if(c>best.c) best={d,c,each:e}; }
  if(inc.length&&near.each.every(c=>c>=0.7)) return {st:'ok',d:near.d,n:inc.length};
  /* подтверждение концом линии связи (пути вращения): до точки линия есть, за ней (1–4 мм) — пусто */
  if(from){ const u=v2.unit(v2.sub(P,from)); for(let d=-TOL;d<=TOL;d+=0.25){ const Q=v2.add(P,v2.mul(nu,d)), inn=covRaw(D,T,v2.sub(Q,v2.mul(u,4)),Q), out=covRaw(D,T,v2.add(Q,v2.mul(u,1)),v2.add(Q,v2.mul(u,4)));
    if(inn>=0.9&&out<=0.1) return {st:'ok',d,n:inc.length,byEnd:true}; } }
  if(!inc.length) return {st:'?',d:null,n:0};
  if(inc.length>=2&&Math.abs(best.d)>=BAD&&best.each.every(c=>c>=0.9)&&near.each.every(c=>c<=0.35)) return {st:'bad',d:best.d,n:inc.length};
  return {st:'?',d:Math.abs(best.d)>=2&&best.c-near.c>=0.15?best.d:null,n:inc.length}; }
/* все точки шага замены (или вращения): общий сдвиг всех точек — это положение оси, его вычитаем из подсказок */
function checkPoints(D,T,P,nu,othersOf,names,fromOf){ const r=(names||NM).map(k=>Object.assign({k},pointEvidence(D,T,P[k],othersOf(k).map(o=>P[o]),nu,fromOf&&fromOf(k))));
  return {bad:r.filter(x=>x.st==='bad'),unk:r.filter(x=>x.st==='?'),all:r}; }
/* прямые-кандидаты в оси: отрезки оцифровки ≥ 25 мм, не рёбра заданного и не ось x */
function axisLines(dig,cal,data){ const segs=drawSegs(dig,cal), g=M.given('3',data).segs, out=[];
  const onGiven=s=>g.some(q=>{ const L=M3.line(q.a,v2.sub(q.b,q.a)), d1=Math.abs(M3.sdist(s.a,L,v2.perp(L.e))), d2=Math.abs(M3.sdist(s.b,L,v2.perp(L.e))); return d1<1&&d2<1; });
  segs.filter(s=>s.len>=25).forEach(s=>{ if(Math.abs(s.a[1])<1.2&&Math.abs(s.b[1])<1.2) return; if(onGiven(s)) return; const L=M3.line(s.a,v2.sub(s.b,s.a));
    if(out.some(q=>angDeg(q.e,L.e)<1&&Math.abs(M3.sdist(s.a,q,v2.perp(q.e)))<1)) return; L.t0=0; L.t1=v2.len(v2.sub(s.b,s.a)); out.push(L); });
  return out; }
function check3(dig,loc,cal,data){ const D=C.dmap(dig.map), T=cal.T, r=DZ.solve('3',data), d=M3.dirs(data), why=[], parts={};
  const lines=axisLines(dig,cal,data);
  /* а), б) первый шаг: все гипотезы замены, по направлению оси — к своей части */
  const H1=replaceHyps(D,T,data,lines,null);
  const dirA=h=>angDeg(h.L.e,v2.perp(h.base==='h'?d.hH:d.fF)), dirB=h=>angDeg(h.L.e,h.base==='h'?d.ABh:d.ABf);
  const hA=H1.filter(h=>dirA(h)<15&&dirA(h)<=dirB(h))[0], hB=H1.filter(h=>dirB(h)<15&&dirB(h)<dirA(h))[0];
  /* а) высота */
  parts.a=(()=>{ if(!hA) return {st:'не найдено',why:['не нашёл замены плоскостей с осью ⟂ '+'h′ (или ⟂ f″) — построения высоты']};
    const s=hA.s, dv=dirA(hA), nm='x'+(hA.base==='h'?'₁₄':'₂₄'), lvl=hA.base==='h'?'горизонтали h′':'фронтали f″', out={st:'верно',why:[],H:r.H,base:hA.base};
    if(dv>=ANG_BAD) return {st:'ошибка',why:['ось '+nm+' не перпендикулярна '+lvl+' (отклонение '+f1(dv)+'°): основание ABC на π₄ не проецируется в прямую — высоту так не найти']};
    if(dv>TOL) out.st='не могу утверждать', out.why.push('ось '+nm+' ⟂ '+lvl+' с отклонением '+f1(dv)+'° — на грани допуска');
    /* каждая точка на π₄: отложено ли нужное расстояние (z — от h′, y — от f″) */
    /* о положении A₄, B₄, C₄ говорят только рёбра из S₄: прямая A₄B₄C₄ проходит через верные места всех трёх
       при любой ошибке студента в одной из них */
    const cp=checkPoints(D,T,s.P,s.nu,k=>k==='S'?['A','B','C']:['S'],null,k=>hA.base==='h'?Hp(data[k]):Fp(data[k]));
    cp.bad.forEach(ps=>{ const k=ps.k; out.st='ошибка'; out.why.push('для '+k+'₄ отложено ≈ '+f1((hA.base==='h'?data[k][2]:data[k][1])+ps.d)+' мм вместо '+(hA.base==='h'?'z = '+data[k][2]:'y = '+data[k][1])+' мм'); });
    if(out.st!=='ошибка'&&cp.unk.length){ out.st='не могу утверждать'; out.why.push('не подтвердил положение '+cp.unk.map(x=>x.k+'₄'+(x.d!=null?' (линии сходятся в ≈ '+f1(Math.abs(x.d))+' мм от нужного места — проверьте отложенное расстояние)':'')).join(', ')); }
    /* высота: перпендикуляр из S₄ на прямую A₄B₄C₄ */
    const ps=[s.P.A,s.P.B,s.P.C]; let far=[0,1]; for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) if(v2.len(v2.sub(ps[i],ps[j]))>v2.len(v2.sub(ps[far[0]],ps[far[1]]))) far=[i,j];
    const E=M3.line(ps[far[0]],v2.sub(ps[far[1]],ps[far[0]])), K=M3.foot(s.P.S,E), ch=covOne(D,T,s.P.S,K);
    if(out.st==='верно'&&(ch==null||ch<0.6)){ out.st='не могу утверждать'; out.why.push('не нашёл отрезка высоты S₄K₄ ⟂ A₄B₄C₄'); }
    if(out.st==='верно') out.why.push('высота H = '+f1(r.H)+' мм (S₄K₄ на π₄, ось '+nm+' ⟂ '+lvl+')');
    return out; })();
  /* б) двугранный угол: второй шаг от проекций на π₄ */
  parts.b=(()=>{ if(!hB) return {st:'не найдено',why:['не нашёл первой замены с осью ∥ A′B′ (или A″B″) — построения двугранного угла']};
    const dv1=dirB(hB), s1=hB.s, nm1='x'+(hB.base==='h'?'₁₄':'₂₄'), out={st:'верно',why:[],dih:r.dih};
    if(dv1>=ANG_BAD) return {st:'ошибка',why:['ось '+nm1+' не параллельна '+(hB.base==='h'?'A′B′':'A″B″')+' (отклонение '+f1(dv1)+'°): ребро AB на π₄ не в натуральную величину']};
    const cp1=checkPoints(D,T,s1.P,s1.nu,k=>NM.filter(o=>o!==k),null,k=>hB.base==='h'?Hp(data[k]):Fp(data[k]));
    cp1.bad.forEach(ps=>{ out.st='ошибка'; out.why.push('для '+ps.k+'₄ отложено расстояние с ошибкой ≈ '+f1(ps.d)+' мм'); });
    if(out.st!=='ошибка'&&cp1.unk.length){ out.st='не могу утверждать'; out.why.push('не подтвердил положение '+cp1.unk.map(x=>x.k+'₄'+(x.d!=null?' (≈ '+f1(Math.abs(x.d))+' мм от нужного)':'')).join(', ')+' на π₄'); }
    /* второй шаг — от начерченных A₄…S₄ */
    const s1a=Object.assign({},s1,{P:anchor(D,T,s1.P,Object.fromEntries(NM.map(k=>[k,hB.base==='h'?Hp(data[k]):Fp(data[k])])))});
    const H2=replaceHyps(D,T,data,lines.filter(L=>Math.abs(M3.sdist(L.p,hB.L,v2.perp(hB.L.e)))>1||angDeg(L.e,hB.L.e)>1),{base:hB.base,s:s1a}).map(h=>Object.assign(h,{fig:bestK(D,T,[[h.s.P.A,h.s.P.C],[h.s.P.A,h.s.P.S],[h.s.P.B,h.s.P.C],[h.s.P.B,h.s.P.S]],2)})).map(h=>Object.assign(h,{score:0.6*h.cc+0.4*h.fig})).sort((a,b)=>b.score-a.score);
    const ab=v2.unit(v2.sub(s1a.P.B,s1a.P.A)), h2=H2.filter(h=>angDeg(h.L.e,v2.perp(ab))<15)[0];
    if(!h2) return Object.assign(out,{st:out.st==='ошибка'?'ошибка':'не найдено',why:out.why.concat(['не нашёл второй замены (ось ⟂ A₄B₄)'])});
    const dv2=angDeg(h2.L.e,v2.perp(ab));
    if(dv2>=ANG_BAD) return {st:'ошибка',why:out.why.concat(['ось x₄₅ не перпендикулярна A₄B₄ (отклонение '+f1(dv2)+'°): ребро AB на π₅ не в точку, угол между гранями так не виден'])};
    if(dv2>TOL&&out.st==='верно') out.st='не могу утверждать', out.why.push('x₄₅ ⟂ A₄B₄ с отклонением '+f1(dv2)+'° — на грани допуска');
    const P5=h2.s.P, cA=covOne(D,T,P5.A,P5.C), cS=covOne(D,T,P5.A,P5.S);
    if(out.st==='верно'&&(cA==null||cS==null||cA<0.6||cS<0.6)){ out.st='не могу утверждать'; out.why.push('не нашёл следов граней A₅C₅ и A₅S₅ на π₅'); }
    if(out.st==='верно') out.why.push('двугранный угол при AB = '+f1(r.dih)+'° (на π₅ между A₅C₅ и A₅S₅)');
    return out; })();
  /* в) истинный вид ABC вращением вокруг прямой уровня */
  parts.c=(()=>{ let best=null; const zs=['A','B','C'].map(k=>data[k][2]), ys=['A','B','C'].map(k=>data[k][1]);
    for(const form of ['h','f']) for(const same of [true,false]){ const L=form==='h'?zs:ys, lo=Math.min(...L)-10, hi=Math.max(...L)+10;
      for(let c=lo;c<=hi;c+=0.25){ const t=M3.rotate(data,form,c,same); if(!t) continue; const P=t.P, pr=form==='h'?Hp:Fp;
        const tri=cov(D,T,[[P.A,P.B],[P.B,P.C],[P.C,P.A]]), paths=['A','B','C'].map(k=>[pr(data[k]),P[k]]).filter(([a,b])=>v2.len(v2.sub(a,b))>8), pc=paths.length?cov(D,T,paths):0;
        const sc=0.7*tri+0.3*pc; if(!best||sc>best.sc) best={sc,tri,pc,form,c,same,t}; } }
    if(!best||best.tri<0.6) return {st:'не найдено',why:['не нашёл истинного вида ABC (треугольника, повёрнутого вокруг прямой уровня)']};
    const out={st:'верно',why:[],form:best.form,c:best.c,P:best.t.P}, P=best.t.P, pr=best.form==='h'?Hp:Fp;
    ['A','B','C'].forEach(k=>{ const path=v2.sub(P[k],pr(data[k])); if(v2.len(path)<8) return; const ev=pointEvidence(D,T,P[k],['A','B','C'].filter(o=>o!==k).map(o=>P[o]),v2.unit(path),pr(data[k]));
      if(ev.st==='bad'){ out.st='ошибка'; out.why.push('радиус вращения точки '+k+' взят неверно: '+k+'₀ сдвинута на '+f1(ev.d)+' мм по пути вращения — истинный вид искажён'); }
      else if(ev.st==='?'&&out.st!=='ошибка'){ out.st='не могу утверждать'; out.why.push('не подтвердил положение '+k+'₀'+(ev.d!=null?' (≈ '+f1(Math.abs(ev.d))+' мм от нужного — проверьте радиус вращения)':'')); } });
    if(out.st==='верно'&&best.tri<0.75){ out.st='не могу утверждать'; out.why.push('треугольник истинного вида читается неуверенно'); }
    if(out.st==='верно') out.why.push('истинный вид: AB = '+f1(r.AB)+', BC = '+f1(r.BC)+', CA = '+f1(r.CA)+' мм (вращение вокруг '+(best.form==='h'?'горизонтали':'фронтали')+')');
    return out; })();
  /* г) угол SA с основанием */
  parts.d=(()=>{ let best=null; const zs=[data.S[2],data.A[2]], lo=Math.min(...zs)-15, hi=Math.max(...zs)+15;
    for(const same of [true,false]) for(let c=lo;c<=hi;c+=0.25){ const t=M3.sigma(data,c,same); if(!t) continue;
      const main=cov(D,T,[[t.S0,t.A0],[t.S0,t.Y0]]), path=v2.len(v2.sub(Hp(data.S),t.S0))>8?covOne(D,T,Hp(data.S),t.S0)||0:0, sc=0.75*main+0.25*path;
      if(!best||sc>best.sc) best={sc,main,c,same,t}; }
    if(!best||best.main<0.6) return {st:'не найдено',why:['не нашёл поворота плоскости (SA, n): прямых S₀A₀ и S₀n₀']};
    const out={st:'верно',why:[],phi:r.phi,t:best.t}, t=best.t, path=v2.sub(t.S0,M3.foot(t.S0,t.axis));
    if(v2.len(path)>8){ const ev=pointEvidence(D,T,t.S0,[t.A0,t.Y0],v2.unit(path),Hp(data.S));
      if(ev.st==='bad'){ out.st='ошибка'; out.why.push('радиус вращения S взят неверно: S₀ сдвинута на '+f1(ev.d)+' мм — угол φ искажён'); }
      else if(ev.st==='?'){ out.st='не могу утверждать'; out.why.push('не подтвердил положение S₀'+(ev.d!=null?' (≈ '+f1(Math.abs(ev.d))+' мм от нужного — проверьте радиус вращения S)':'')); } }
    if(out.st==='верно'&&best.main<0.75){ out.st='не могу утверждать'; out.why.push('прямые S₀A₀, S₀n₀ читаются неуверенно'); }
    if(out.st==='верно') out.why.push('угол SA с основанием φ = '+f1(r.phi)+'° (ψ = '+f1(90-r.phi)+'°, φ = 90° − ψ)');
    return out; })();
  /* линии найденных построений — для чтения видимости заданной пирамиды (их надо обходить: построение может лечь
     прямо на ребро — например, повёрнутый A₀B₀ почти на A″B″) */
  const pred=[]; const pushFig=(P,keep)=>{ NM.forEach(k=>{ if(P[k]&&keep&&keep[k]) pred.push([keep[k],P[k]]); }); EDGES.forEach(([a,b])=>{ if(P[a]&&P[b]) pred.push([P[a],P[b]]); }); };
  if(hA) pushFig(hA.s.P,Object.fromEntries(NM.map(k=>[k,hA.base==='h'?Hp(data[k]):Fp(data[k])])));
  if(hB) pushFig(hB.s.P,Object.fromEntries(NM.map(k=>[k,hB.base==='h'?Hp(data[k]):Fp(data[k])])));
  if(parts.c&&parts.c.P){ const P=parts.c.P, pr=parts.c.form==='h'?Hp:Fp; [['A','B'],['B','C'],['C','A']].forEach(([a,b])=>pred.push([P[a],P[b]])); ['A','B','C'].forEach(k=>pred.push([pr(data[k]),P[k]])); }
  if(parts.d&&parts.d.t){ const t=parts.d.t; pred.push([t.S0,t.A0],[t.S0,t.Y0],[Hp(data.S),t.S0]); }
  /* видимость заданной пирамиды */
  const S=M.solid('3',null,data), vis=[], allSegs=M.given('3',data).segs.map(s=>[s.a,s.b]), dsg=drawSegs(dig,cal);
  S.edges.forEach(e=>[['f',Fp,'″'],['h',Hp,'′']].forEach(([pr,P,mk])=>{ if(e[pr]==='?') return; const a=P(S.V[e.a]), b=P(S.V[e.b]), Le=M3.line(a,v2.sub(b,a)), len=v2.len(v2.sub(b,a)), nrm=v2.perp(Le.e);
    /* линии листа вдоль ребра, выходящие за его концы (ось, прямая уровня по ребру) — штрихи под ними не видны */
    const along=dsg.filter(q=>angDeg(v2.sub(q.b,q.a),Le.e)<2&&Math.abs(M3.sdist(q.a,Le,nrm))<0.8&&Math.abs(M3.sdist(q.b,Le,nrm))<0.8);
    if(along.some(q=>{ const t=[v2.dot(v2.sub(q.a,a),Le.e),v2.dot(v2.sub(q.b,a),Le.e)].sort((x,y)=>x-y); return t[1]>0&&t[0]<len&&(t[0]<-4||t[1]>len+4); })){ vis.push({e:e.a+e.b+mk,want:e[pr],got:'?'}); return; }
    /* рядом с ребром — другая почти параллельная линия (до 3 мм, угол < 6°), не совпадающая с ним: штрихи могли
       закрыться ею (повёрнутый треугольник, ось, прямая уровня) — тип линии не читаем */
    const nearPar=dsg.some(q=>{ if(v2.len(v2.sub(q.b,q.a))<8) return false; const an=angDeg(v2.sub(q.b,q.a),Le.e); if(an>=6) return false;
      const t=[v2.dot(v2.sub(q.a,a),Le.e),v2.dot(v2.sub(q.b,a),Le.e)]; if(Math.max(...t)<0||Math.min(...t)>len) return false;
      const d1=Math.abs(M3.sdist(q.a,Le,nrm)), d2=Math.abs(M3.sdist(q.b,Le,nrm)); return Math.max(d1,d2)<=3&&(an>2||Math.max(d1,d2)>1.2); });
    if(nearPar){ vis.push({e:e.a+e.b+mk,want:e[pr],got:'?'}); return; }
    const cross=dsg.filter(q=>angDeg(v2.sub(q.b,q.a),Le.e)>=2).map(q=>[q.a,q.b]);
    const ds=K2.dashes(dig.map,T,a,b,allSegs.filter(q=>!(v2.len(v2.sub(q[0],a))<1e-6&&v2.len(v2.sub(q[1],b))<1e-6)&&!(v2.len(v2.sub(q[0],b))<1e-6&&v2.len(v2.sub(q[1],a))<1e-6)).concat(cross,pred.filter(q=>v2.len(v2.sub(q[1],q[0]))>1)));
    vis.push({e:e.a+e.b+mk,want:e[pr],got:K2.lineType(ds)}); }));
  const badV=vis.filter(x=>x.got!=='?'&&x.got!==x.want), unkV=vis.filter(x=>x.got==='?');
  parts.vis={st:badV.length?'ошибка':unkV.length?'не могу утверждать':'верно',why:badV.map(x=>'ребро '+x.e+' заданной пирамиды должно быть '+(x.want==='vis'?'сплошным (видимым)':'штриховым (невидимым)')).concat(unkV.length?['не прочитал тип линии рёбер '+unkV.map(x=>x.e).join(', ')]:[])};
  const NAMES={a:'а) высота',b:'б) угол SAB — ABC',c:'в) истинный вид ABC',d:'г) угол SA с основанием',vis:'видимость пирамиды'};
  const sts=Object.values(parts).map(p=>p.st);
  const verdict=sts.includes('ошибка')?'ошибка':sts.every(s=>s==='верно')?'верно':'не могу утверждать';
  Object.entries(parts).forEach(([k,p])=>{ if(verdict==='ошибка'&&p.st!=='ошибка') return; p.why.forEach(w=>why.push(NAMES[k]+': '+w)); if(!p.why.length&&p.st!=='верно') why.push(NAMES[k]+': '+p.st); });
  return {verdict,why,parts,hyps:{a:hA&&{base:hA.base,score:hA.score},b:hB&&{base:hB.base,score:hB.score}}}; }
put('dzCheck3',{check3,axisLines,replaceHyps,pointEvidence});
})();
