/* ═══════════ Заданное «как начерчено»: где студент на самом деле поставил каждую точку условия ═══════════
   Калибровка (calib.js) отвечает, тот ли вариант на листе. Здесь — следующий вопрос: какие числа студент на самом
   деле нанёс. Каждая проекция каждой точки измеряется отдельно:
   1. вершина — пересечение начерченных рёбер фигуры условия, сходящихся в ней (ребро — прямая по отрезкам листа
      около предсказанного ребра: направление ±6°, поперёк ±2,5 мм); итерации: новые вершины → новые рёбра;
   2. вершина без рёбер (точку только отметили) — кружок-метка у предсказанного места (кольцо тёмности радиуса
      0,7–1,3 мм со светлой серединой, ≤ 6 мм от предсказания);
   3. начало O — пересечение осей: длинная горизонталь (ось x) и длинная вертикаль (ось z/y) у предсказанного O;
      нет осей — медиана по точкам.
   Отсюда «данные как начерчены»: x = O_u − u, z = O_v − v″, y = v′ − O_v; расхождение u″ и u′ — линия связи.
   Зачем: ответ студента можно пересчитать для ЕГО чертежа. Если построение верно для начерченной пирамиды, а
   число не совпало с эталоном, — ошибка не в способе, а в нанесении данных (и наоборот).
   measureGiven(dig, cal, id, data, {img}) → {O, pts:{A″:{p, src, n, d}}, drawn:{A:[x,y,z]}, diff:[…], link:[…]} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const M=isNode?require('./model.js'):self.LAB.dzModel, IMG=isNode?require('../img.js'):self.LAB.img;
const v2={sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],add:(a,b)=>[a[0]+b[0],a[1]+b[1]],mul:(a,k)=>[a[0]*k,a[1]*k],dot:(a,b)=>a[0]*b[0]+a[1]*b[1],cr:(a,b)=>a[0]*b[1]-a[1]*b[0],len:a=>Math.hypot(a[0],a[1])};
v2.unit=a=>{ const l=v2.len(a)||1; return [a[0]/l,a[1]/l]; }; v2.dist=(a,b)=>v2.len(v2.sub(a,b));
const ang=(e,f)=>Math.acos(Math.min(1,Math.abs(v2.dot(v2.unit(e),v2.unit(f)))))*180/Math.PI;
const apply=(T,m)=>[T[0]+(1+T[2])*m[0]+T[3]*m[1],T[1]+T[4]*m[0]+(1+T[5])*m[1]];
/* прямая по отрезкам: главная ось точек вдоль них */
function fitLine(ss){ const P=[]; ss.forEach(s=>{ const L=v2.dist(s.a,s.b), e=v2.unit(v2.sub(s.b,s.a)); for(let k=0;k<=L;k+=0.5) P.push(v2.add(s.a,v2.mul(e,k))); }); if(P.length<6) return null;
  const c=P.reduce((m,p)=>v2.add(m,v2.mul(p,1/P.length)),[0,0]); let xx=0,xy=0,yy=0; P.forEach(p=>{ const d=v2.sub(p,c); xx+=d[0]*d[0]; xy+=d[0]*d[1]; yy+=d[1]*d[1]; });
  const a=0.5*Math.atan2(2*xy,xx-yy), e=[Math.cos(a),Math.sin(a)], n=[-e[1],e[0]]; let r=0; P.forEach(p=>{ r+=v2.dot(v2.sub(p,c),n)**2; }); return {p:c,e,n,rms:Math.sqrt(r/P.length),len:P.length*0.5}; }
/* точка, ближайшая к нескольким прямым (МНК), и разброс */
function meetAll(Ls){ let a=0,b=0,c=0,d=0,e=0; Ls.forEach(L=>{ const n=L.n, w=L.w||1, k=v2.dot(n,L.p); a+=w*n[0]*n[0]; b+=w*n[0]*n[1]; c+=w*n[1]*n[1]; d+=w*n[0]*k; e+=w*n[1]*k; });
  const det=a*c-b*b; if(Math.abs(det)<1e-6) return null; const p=[(c*d-b*e)/det,(a*e-b*d)/det]; const res=Math.sqrt(Ls.reduce((s,L)=>s+v2.dot(v2.sub(p,L.p),L.n)**2,0)/Ls.length); return {p,res}; }
/* кружок-метка у точки c (мм листа) по карте тёмности оцифровки (g: мм листа, ppm) */
function ringNear(g,c,R){ const ppm=g.ppm, bx=g.box, thr=0.12; let best=null; const at=p=>IMG.sample(g,(p[0]-bx[0])*ppm-0.5,(p[1]-bx[1])*ppm-0.5)||0;
  for(let dy=-R;dy<=R;dy+=0.25) for(let dx=-R;dx<=R;dx+=0.25){ if(dx*dx+dy*dy>R*R) continue; const p=[c[0]+dx,c[1]+dy], c0=at(p);
    for(const r of [0.7,0.9,1.1,1.3]){ let k=0, ko=0, ring=0; for(let a=0;a<16;a++){ const t=a*Math.PI/8, v=at([p[0]+r*Math.cos(t),p[1]+r*Math.sin(t)]); ring+=v; if(v>thr) k++; if(at([p[0]+(r+0.9)*Math.cos(t),p[1]+(r+0.9)*Math.sin(t)])>thr) ko++; }
      ring/=16; if(k>=13&&ko<=7){ const s=k-ko-0.3*Math.hypot(dx,dy)+(c0<ring*0.7?1:0); if(!best||s>best.s) best={s,p,r}; } } }
  return best; }

/* узел у точки c: пересечения пар отрезков листа (угол ≥ 15°, точка — на обоих отрезках ±1,5 мм), кластеры 0,8 мм;
   узел — кластер с ≥ 3 разными отрезками (или ≥ 2, если среди них начерченное ребро L этой точки); ближайший к c из
   самых «многолинейных» */
function junctionNear(segs,c,R,L){ const near=segs.filter(s=>{ const d=v2.sub(s.b,s.a), l2=v2.dot(d,d)||1e-9, t=Math.max(0,Math.min(1,v2.dot(v2.sub(c,s.a),d)/l2)); return v2.dist(c,v2.add(s.a,v2.mul(d,t)))<=R+2; });
  const X=[]; const ext=(s,p)=>{ const d=v2.sub(s.b,s.a), l=v2.len(d), e=v2.mul(d,1/l), t=v2.dot(v2.sub(p,s.a),e); return t>=-1.5&&t<=l+1.5&&Math.abs(v2.cr(v2.sub(p,s.a),e))<0.6; };
  const onL=s=>L&&ang(v2.sub(s.b,s.a),L.e)<4&&Math.abs(v2.dot(v2.sub(s.a,L.p),L.n))<0.8&&Math.abs(v2.dot(v2.sub(s.b,L.p),L.n))<0.8;
  for(let i=0;i<near.length;i++) for(let j=i+1;j<near.length;j++){ const a=near[i], b=near[j], ea=v2.unit(v2.sub(a.b,a.a)), eb=v2.unit(v2.sub(b.b,b.a)); if(ang(ea,eb)<15) continue;
    const d=v2.cr(ea,eb), t=v2.cr(v2.sub(b.a,a.a),eb)/d, p=v2.add(a.a,v2.mul(ea,t)); if(v2.dist(p,c)>R||!ext(a,p)||!ext(b,p)) continue; X.push({p,s:[a,b]}); }
  const cl=[]; X.forEach(x=>{ const k=cl.find(k=>v2.dist(k.c,x.p)<=0.8); if(k){ k.x.push(x); k.c=v2.mul(k.x.reduce((m,y)=>v2.add(m,y.p),[0,0]),1/k.x.length); } else cl.push({c:x.p,x:[x]}); });
  const sc=cl.map(k=>{ const ss=new Set(); k.x.forEach(x=>x.s.forEach(s=>ss.add(s))); const withL=[...ss].some(onL); const res=Math.sqrt(k.x.reduce((m,x)=>m+v2.dist(x.p,k.c)**2,0)/k.x.length); return {p:k.c,n:ss.size,withL,res,d:v2.dist(k.c,c)}; })
    .filter(k=>k.n>=3||k.n>=2&&k.withL).sort((a,b)=>(b.withL-a.withL)||(b.n-a.n)||(a.d-b.d));
  /* соперник: такой же по силе узел в 0,8–4 мм — где именно точка, по листу не ясно (погрешность больше) */
  if(sc[0]){ const b=sc[0]; b.amb=sc.slice(1).some(k=>k.withL===b.withL&&k.n>=b.n-1&&v2.dist(k.p,b.p)>0.8&&v2.dist(k.p,b.p)<=4); }
  return sc[0]||null; }
function measureGiven(dig,cal,id,data,o){ o=o||{}; const g=M.given(id,data), T=cal.T, segs=dig.segs.filter(s=>v2.dist(s.a,s.b)>=3);
  /* текущие положения проекций точек (мм листа) */
  const P={}; g.pts.forEach(q=>{ P[q.l]=apply(T,q.at); }); const P0=Object.assign({},P);
  const pl=(n,pr)=>n+(pr==='f'?'″':'′');
  let lines={};
  /* отрезок листа q годится ребру s: направление ±8°, поперёк ≤ 5 мм (вершина могла быть нанесена мимо), перекрытие
     с ребром; цена — дальний конец от прямой ребра (мм), иначе ∞ */
  const cost=(q,s)=>{ const A=P[pl(s.n[0],s.pr)], B=P[pl(s.n[1],s.pr)], L=v2.dist(A,B); if(L<6) return Infinity; const e=v2.unit(v2.sub(B,A)), n=[-e[1],e[0]];
    if(ang(v2.sub(q.b,q.a),e)>8) return Infinity; const da=v2.dot(v2.sub(q.a,A),n), db=v2.dot(v2.sub(q.b,A),n), c=Math.max(Math.abs(da),Math.abs(db)); if(c>5) return Infinity;
    const ta=v2.dot(v2.sub(q.a,A),e), tb=v2.dot(v2.sub(q.b,A),e), lo=Math.max(Math.min(ta,tb),-2), hi=Math.min(Math.max(ta,tb),L+2); return hi-lo>=0.5*Math.abs(tb-ta)?c:Infinity; };
  for(let it=0;it<4;it++){ lines={};
    /* один отрезок — одному ребру: соседние рёбра из вершины идут иногда под 2–3° (A″S″ и A″C″), и отрезок одного
       попадает в кандидаты другого. Отрезок, который заметно ближе (на 0,3 мм) к другому ребру, — не наш */
    const own=new Map(); segs.forEach(q=>{ let b=null; g.segs.forEach(s=>{ const c=cost(q,s); if(c<Infinity&&(!b||c<b.c)) b={s,c}; }); if(b) own.set(q,b); });
    g.segs.forEach(s=>{ const A=P[pl(s.n[0],s.pr)], B=P[pl(s.n[1],s.pr)], L=v2.dist(A,B); if(L<6) return; const e=v2.unit(v2.sub(B,A)), n=[-e[1],e[0]];
      /* кандидаты — отрезки, годные ребру и не чужие; группы коллинеарных — берём самую длинную по пролёту ребра */
      const cand=segs.filter(q=>{ const c=cost(q,s); if(c===Infinity) return false; const b=own.get(q); return !(b&&b.s!==s&&b.s.pr===s.pr&&b.c+0.3<c); });
      const groups=[]; cand.sort((p,q)=>v2.dist(q.a,q.b)-v2.dist(p.a,p.b)).forEach(q=>{ const qe=v2.unit(v2.sub(q.b,q.a)), qn=[-qe[1],qe[0]];
        const gp=groups.find(G=>ang(G.e,qe)<3&&Math.abs(v2.dot(v2.sub(q.a,G.p),G.n))<0.8&&Math.abs(v2.dot(v2.sub(q.b,G.p),G.n))<0.8); if(gp){ gp.ss.push(q); gp.L+=v2.dist(q.a,q.b); } else groups.push({p:q.a,e:qe,n:qn,ss:[q],L:v2.dist(q.a,q.b)}); });
      groups.sort((a,b)=>b.L-a.L); const G0=groups[0];
      /* вторая группа почти такой же длины на другом месте — какое из двух ребро, не различить */
      /* ребро начерчено, если группа покрывает ≥ 60 % его пролёта (объединение проекций отрезков) */
      const span=G=>{ const iv=G.ss.map(q=>[v2.dot(v2.sub(q.a,A),e),v2.dot(v2.sub(q.b,A),e)].sort((x,y)=>x-y)).map(([x,y])=>[Math.max(0,x),Math.min(L,y)]).filter(([x,y])=>y>x).sort((p,q)=>p[0]-q[0]);
        let tot=0, cx=-1e9, cy=-1e9; iv.forEach(([x,y])=>{ if(x>cy){ if(cy>cx) tot+=cy-cx; cx=x; cy=y; } else cy=Math.max(cy,y); }); if(cy>cx) tot+=cy-cx; return tot/L; };
      if(G0&&span(G0)>=0.6&&!(groups[1]&&groups[1].L>=0.8*G0.L&&Math.abs(v2.dot(v2.sub(groups[1].p,G0.p),G0.n))>1.5)){ const f=fitLine(G0.ss); if(f&&f.rms<0.6) lines[s.n+s.pr]={...f,w:Math.min(1,f.len/L),s}; } });
    let moved=0;
    g.pts.forEach(q=>{ const inc=g.segs.filter(s=>s.pr===q.pr&&s.n.includes(q.n)).map(s=>lines[s.n+s.pr]).filter(Boolean);
      let ok=[]; inc.forEach(L=>{ if(ok.every(M2=>ang(M2.e,L.e)>=15)) ok.push(L); });
      if(inc.length>=2&&ok.length>=2){ const m=meetAll(inc.filter(L=>inc.some(K=>K!==L&&ang(K.e,L.e)>=15))); if(m&&v2.dist(m.p,P0[q.l])<=10){ moved=Math.max(moved,v2.dist(m.p,P[q.l])); P[q.l]=m.p; } } });
    if(moved<0.02) break; }
  /* проверка рёбер: прямая ребра должна проходить через ОБЕ свои вершины (≤ 0,8 мм) — иначе это не ребро, а линия
     построения рядом (n″, h₁″, продолжение A″S″…), и вершину по ней не меряем. Две итерации: без ложных рёбер
     вершины уточняются, и проверка повторяется */
  /* по одному: вершины — заново из текущих рёбер; худшее ребро с невязкой > 0,8 мм — прочь; повтор */
  const recompute=()=>{ g.pts.forEach(q=>{ const inc=g.segs.filter(s=>s.pr===q.pr&&s.n.includes(q.n)).map(s=>lines[s.n+s.pr]).filter(Boolean); const strong=inc.filter(L=>inc.some(K=>K!==L&&ang(K.e,L.e)>=15));
      if(strong.length>=2){ const m=meetAll(strong); if(m&&v2.dist(m.p,P0[q.l])<=10) P[q.l]=m.p; } }); };
  /* проверка «без себя»: если у вершины есть ещё ≥ 2 прямые (≥ 15° между ними), вершина считается БЕЗ проверяемой
     прямой — иначе проверка круговая (вершину нашли по этой же прямой). Так ловится линия построения, подменившая
     ребро: горизонталь через B″ под 4° к A″B″ давала «A″» на пересечении с A″C″ в 5 мм от настоящей */
  const vertexWithout=(X,pr,L)=>{ const q=g.pts.find(t=>t.l===X); if(!q) return null; const inc=g.segs.filter(s=>s.pr===pr&&s.n.includes(q.n)).map(s=>lines[s.n+s.pr]).filter(M2=>M2&&M2!==L);
    /* без проверяемой прямой точка должна быть устойчивой: две другие прямые — под ≥ 25° (иначе пересечение ползёт
       вдоль биссектрисы на миллиметры, и честное ребро выглядит «далёким»); допуск — с учётом угла */
    const strong=inc.filter(M2=>inc.some(K=>K!==M2&&ang(K.e,M2.e)>=25)); if(strong.length<2) return null; const m=meetAll(strong); if(!m||v2.dist(m.p,P0[X])>10) return null;
    let amin=90; strong.forEach(a=>strong.forEach(b=>{ if(a!==b) amin=Math.min(amin,ang(a.e,b.e)); })); return {p:m.p,tol:0.8+0.25/Math.sin(amin*Math.PI/180)}; };
  for(let it=0;it<12;it++){ recompute(); let worst=null;
    Object.entries(lines).forEach(([k,L])=>{ const s=L.s, a=pl(s.n[0],s.pr), b=pl(s.n[1],s.pr), wa=vertexWithout(a,s.pr,L), wb=vertexWithout(b,s.pr,L);
      const ex=(W,X)=>{ const pt=W?W.p:P[X], tol=W?W.tol:0.8; return Math.abs(v2.dot(v2.sub(pt,L.p),L.n))-tol; }, r=Math.max(ex(wa,a),ex(wb,b)); if(r>0&&(!worst||r>worst.r)) worst={k,r}; });
    if(!worst) break; delete lines[worst.k]; }
  recompute();
  /* итог по каждой проекции: откуда положение */
  const out={};
  g.pts.forEach(q=>{ const inc=g.segs.filter(s=>s.pr===q.pr&&s.n.includes(q.n)).map(s=>lines[s.n+s.pr]).filter(Boolean);
    const strong=inc.filter(L=>inc.some(K=>K!==L&&ang(K.e,L.e)>=15));
    if(strong.length>=2){ const m=meetAll(strong); out[q.l]={p:m.p,src:'рёбра',n:strong.length,res:m.res}; return; }
    /* рёбер меньше двух: узел — где сходятся ≥ 3 линии листа (ребро, линии связи, построения через эту точку);
       с одним начерченным ребром — узел на нём. Кружок-метка — только подтверждение: буквы и цифры тоже «кольца» */
    const J=junctionNear(segs,P[q.l],4.5,inc[0]);
    if(J){ out[q.l]={p:J.p,src:inc.length?'узел на ребре':'узел линий',n:J.n,res:J.res,amb:J.amb}; return; }
    /* одинокая точка (ни рёбер, ни построений через неё) — по кружку-метке, с пометкой «≈» */
    const rg=o.map||dig.map&&dig.map.g, rn=rg?ringNear(rg,P[q.l],4.5):null;
    if(rn){ out[q.l]={p:rn.p,src:'метка',n:0,res:0.5,approx:true}; return; }
    out[q.l]={p:P[q.l],src:'не найдена',n:0,res:null}; });
  /* начало O: оси (длинные горизонталь и вертикаль у предсказанного O), иначе — медиана по точкам */
  const O0=apply(T,[0,0]);
  const hor=segs.filter(s=>v2.dist(s.a,s.b)>=40&&ang(v2.sub(s.b,s.a),[1,0])<=1.2&&Math.abs((s.a[1]+s.b[1])/2-O0[1])<=6);
  const ver=segs.filter(s=>v2.dist(s.a,s.b)>=40&&ang(v2.sub(s.b,s.a),[0,1])<=1.2&&Math.abs((s.a[0]+s.b[0])/2-O0[0])<=8);
  const wmean=(A,f)=>{ let s=0,w=0; A.forEach(x=>{ const L=v2.dist(x.a,x.b); s+=f(x)*L; w+=L; }); return w?s/w:null; };
  const xs=[], zs=[];
  g.pts.forEach(q=>{ const m=out[q.l]; if(!m||m.src==='не найдена') return; xs.push(m.p[0]+q.P[0]); zs.push(q.pr==='f'?m.p[1]+q.P[2]:m.p[1]-q.P[1]); });
  const med=a=>{ const t=a.slice().sort((x,y)=>x-y); return t.length?t[t.length>>1]:null; };
  /* ось — коллинеарные куски одной прямой (±0,6 мм), берём самую длинную; она должна согласоваться с точками
     (медиана x + u и т. п. — в 2 мм): рядом с осью z/y бывают длинные линии связи */
  const axis=(ss,k,ref)=>{ const G=[]; ss.forEach(s=>{ const c=(s.a[k]+s.b[k])/2, L=v2.dist(s.a,s.b), g=G.find(g=>Math.abs(g.c-c)<=0.6); if(g){ g.c=(g.c*g.L+c*L)/(g.L+L); g.L+=L; } else G.push({c,L}); });
    G.sort((a,b)=>b.L-a.L); let ok=G.filter(g=>ref==null||Math.abs(g.c-ref)<=2); if(!ok.length) return null;
    /* у оси бывает длинная линия связи построения в 1–2 мм (3″–3′): из длинных (≥ 40 % самой длинной) — ближайшая к O по точкам */
    if(ref!=null){ const Lm=ok[0].L, c0=ok.filter(g=>g.L>=0.4*Lm).sort((a,b)=>Math.abs(a.c-ref)-Math.abs(b.c-ref))[0]; ok=[c0].concat(ok.filter(g=>g!==c0)); }
    /* толстая ось от руки распадается на 2–3 параллельных куска в 1 мм: среднее по ним (вес — длина) */
    const near=ok.filter(g=>Math.abs(g.c-ok[0].c)<=1.2); return near.reduce((m,g)=>m+g.c*g.L,0)/near.reduce((m,g)=>m+g.L,0); };
  const mx=med(xs), mz=med(zs), Ouax=axis(ver,0,mx), Ovax=axis(hor,1,mz);
  const Ou=Ouax!=null?Ouax:mx, Ov=Ovax!=null?Ovax:mz;
  const O=[Ou,Ov], Osrc=[Ouax!=null?'ось z/y':'по точкам',Ovax!=null?'ось x':'по точкам'];
  /* данные как начерчены */
  const drawn={}, diff=[], link=[], sig={};
  /* вершина из двух прямых не имеет внутренней проверки (третья прямая через ту же точку) — σ вдвое больше; если её
     x расходится с другой проекцией, измеренной по ≥ 3 прямым, больше чем на 3σ — она ненадёжна (прямая построения
     подменила ребро): о ней ничего не утверждаем, x — по надёжной проекции */
  const sgOf=m=>m?m.src==='рёбра'?(m.n>=3?0.25:0.5):m.src.startsWith('узел')?(m.amb?1.5:1.0):1.0:null, weak=new Set();
  Object.keys(data).forEach(n=>{ const f=out[n+'″'], h=out[n+'′']; if(!f||!h||f.src==='не найдена'||h.src==='не найдена') return;
    const du=Math.abs(f.p[0]-h.p[0]), sF=sgOf(f), sH=sgOf(h), strong=m=>m.src==='рёбра'&&m.n>=3; if(du<=Math.max(1.5,3*Math.hypot(sF,sH))) return;
    if(strong(h)&&!strong(f)){ weak.add(n+'″'); f.unreliable=true; } else if(strong(f)&&!strong(h)){ weak.add(n+'′'); h.unreliable=true; }
    /* обе без проверки и расходятся — какая верна, неизвестно: обе ненадёжны */
    else if(!strong(f)&&!strong(h)){ weak.add(n+'″'); weak.add(n+'′'); f.unreliable=h.unreliable=true; } });
  Object.keys(data).forEach(n=>{ const f=out[n+'″'], h=out[n+'′'], F=f&&f.src!=='не найдена'?f.p:null, Hh=h&&h.src!=='не найдена'?h.p:null, wF=weak.has(n+'″'), wH=weak.has(n+'′');
    const both=wF&&wH, Fx=wF&&Hh&&!both?null:F, Hx=wH&&F&&!both?null:Hh;
    const x=Fx&&Hx?O[0]-(Fx[0]+Hx[0])/2:Fx?O[0]-Fx[0]:Hx?O[0]-Hx[0]:null, z=F?O[1]-F[1]:null, y=Hh?Hh[1]-O[1]:null;
    drawn[n]=[x,y,z];
    /* погрешность координаты (мм): пересечение ≥ 3 рёбер — 0,25, двух — 0,5; узел линий — 1,0 (косвенная мера),
       неоднозначный — 1,5; метка-кружок — 1,0; ненадёжная проекция (расходится с надёжной) — 3 */
    const fl=o.sigFloor||0, sF=F?Math.max(fl,wF?3:sgOf(f)):null, sH=Hh?Math.max(fl,wH?3:sgOf(h)):null, sFx=Fx?sF:null, sHx=Hx?sH:null;
    const sx=Fx&&Hx?Math.hypot(sFx,sHx)/2:Fx?sFx:Hx?sHx:null; sig[n]=[sx,sH,sF];
    if(F&&Hh) link.push({n,du:F[0]-Hh[0],sg:Math.hypot(sF,sH),sure:!wF&&!wH&&Math.abs(F[0]-Hh[0])>=Math.max(1.5,3*Math.hypot(sF,sH))});
    ['x','y','z'].forEach((c,i)=>{ const v=[x,y,z][i]; if(v==null) return; const d=v-data[n][i], sgm=sig[n][i]; diff.push({n,c,drawn:v,was:data[n][i],d,sg:sgm,sure:Math.abs(d)>=Math.max(1.5,3*sgm)}); }); });   /* «неточно» — с 1,5 мм: точность руки по клетке ~0,5 мм, замера — 0,1–0,3 */
  /* общий сдвиг по одной координате у ≥ 3 точек (в пределах ±0,6 мм друг от друга) — это перенос всего чертежа
     относительно оси (или ось найдена не там): на ответы не влияет, ошибкой нанесения не считается — вычитаем */
  const shift={};
  ['x','y','z'].forEach(c=>{ const D=diff.filter(d=>d.c===c); let best=[]; D.forEach(d=>{ const m=D.filter(e=>Math.abs(e.d-d.d)<=0.6); if(m.length>best.length) best=m; });
    if(best.length<3||best.length<0.75*D.length) return; const sh=best.reduce((m,d)=>m+d.d,0)/best.length; if(Math.abs(sh)<0.5) return; shift[c]=sh;
    D.forEach(d=>{ d.d-=sh; d.drawn-=sh; d.shift=sh; d.sure=Math.abs(d.d)>=Math.max(1.5,3*d.sg); }); });
  /* мало найденных точек — калибровка ненадёжна: о нанесении ничего не утверждаем */
  const nFound=Object.values(out).filter(p=>p.src!=='не найдена').length;
  if(nFound<Math.max(4,Math.ceil(0.75*g.pts.length))){ diff.forEach(d=>{ d.sure=false; }); link.forEach(l=>{ l.sure=false; }); }
  return {O,Osrc,pts:out,drawn,sig,diff,shift,link,nFound,lines:Object.keys(lines).length,edgeLines:lines}; }

put('dzGiven',{measureGiven,ringNear,junctionNear,fitLine,meetAll});
})();
