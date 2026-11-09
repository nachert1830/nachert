/* ═══════════ ДЗ №5 по результату: точки пересечения прямой AB с поверхностью, касательная плоскость и нормаль ═══════════
   Эталон считается здесь же (без решателя сайта): данные 30 вариантов — копия dz/ng/5/variants.js (тест следит, что совпадают),
   поверхность одна на тип: 1–10 конус, 11–20 наклонный цилиндр, 21–30 поверхность вращения (дуга R120).
   Мм листа — как у ДЗ №4 (lk/scan/dz4ref.json): начало O на оси x справа, X″ = (−x, −z), X′ = (−x, y), y листа вниз.
   ref(n) → {n, kind, A, B, K:[3D], P:[{F, H}], N:[3D нормаль], outlines:[{v, p}], axes, ab:{F, H}, cross:{F:[…], H:[…]}}
     cross — где проекция AB пересекает очерк поверхности (там студенты ставят конкурирующие точки видимости — не ответ);
   refs() → {n: ref} всех 30 (для привязки lk/scan/bind4.js: очерки + AB — «очерки» варианта);
   verify(copy {pts:[[подпись,u,v]], segs:[{p:[u1,v1,u2,v2], unv}], arcs:[{poly, unv}], curves:[{p, unv}]}, ref, o) →
     {verdict, parts:[{id, name, st:'верно'|'ошибка'|'не уверен', why, got, want, d, unit, at:{v, p}, hint}]}
   Способ построения не судится: посредник (плоскость через вершину, ∥ образующим, фронтально-проецирующая), свои подписи
   (K, M, L, 1, 2 …) — всё равно. Судится результат:
     часть 1 — точки на AB: верно, если у каждой точки эталона есть подписанная точка копии (≤ 1,5 мм) хотя бы на одной проекции,
       а на другой — тоже точка или линия построения через это место; ошибка — только если студент отметил СВОЮ точку на AB в обеих
       проекциях (одна подпись, одна линия связи ± 1,5 мм), она ≥ 3 мм от эталонной, не у концов A, B и не там, где AB пересекает
       очерк, а у эталонной точки рядом ничего не отмечено;
     часть 2 — касательная плоскость и нормаль в ЛЮБОЙ из двух точек: на каждой проекции нормаль и касательная плоскость дают пару
       перпендикулярных направлений (n″ ⟂ f″, n′ ⟂ h′), оба известны из эталона. Верно — через точку на обеих проекциях проходит
       линия этого направления (≤ 2°). Ошибка — через точку начерчена пара перпендикулярных линий (студент строил нормаль), она
       повёрнута на ≥ 4° и линии верного направления там нет (на другой проекции — верно или тоже повёрнуто). Линии связи (вертикаль), горизонтали (h″, f′ ∥ x) и сама AB
       в улики не идут: они проходят через точку при любом решении.
   o.weak — привязка неточная: «ошибка» не говорится (только «не уверен»). */
(function(){
'use strict';
const V={
  1:{A:[155,45,125], B:[20,115,20]},   2:{A:[145,50,115], B:[40,105,35]},   3:{A:[150,55,120], B:[40,100,20]},
  4:{A:[170,45,140], B:[25,105,5]},    5:{A:[145,50,115], B:[35,115,15]},   6:{A:[160,115,20], B:[25,45,125]},
  7:{A:[140,105,35], B:[35,50,115]},   8:{A:[140,100,20], B:[30,55,120]},   9:{A:[155,105,5],  B:[10,45,140]},
  10:{A:[145,115,15], B:[35,50,115]},
  11:{A:[115,40,105], B:[30,150,0]},   12:{A:[110,45,95],  B:[35,140,5]},   13:{A:[125,50,80],  B:[50,130,15]},
  14:{A:[120,55,75],  B:[30,150,0]},   15:{A:[135,55,65],  B:[45,135,10]},  16:{A:[130,60,65],  B:[40,140,5]},
  17:{A:[110,35,110], B:[10,155,0]},   18:{A:[105,40,105], B:[20,145,10]},  19:{A:[120,45,90],  B:[40,125,25]},
  20:{A:[115,50,85],  B:[10,155,0]},
  21:{A:[140,110,20], B:[0,100,100]},  22:{A:[130,10,105], B:[10,120,35]},  23:{A:[150,100,25], B:[10,90,105]},
  24:{A:[125,130,110],B:[0,30,30]},    25:{A:[140,30,30],  B:[10,125,105]}, 26:{A:[120,130,90], B:[0,10,20]},
  27:{A:[145,10,20],  B:[20,130,90]},  28:{A:[135,90,105], B:[10,95,35]},   29:{A:[130,120,35], B:[0,20,110]},
  30:{A:[140,100,100],B:[0,110,20]} };
const kindOf=n=>n<=10?'cone':n<=20?'cyl':'ogive';
const NAME={cone:'конус',cyl:'наклонный цилиндр',ogive:'поверхность вращения'};
const F=p=>[-p[0],-p[2]], H=p=>[-p[0],p[1]], DEG=180/Math.PI;
/* поверхности: f(p) = 0 на поверхности (знак — внутри < 0), область по z */
const SURF={
  cone:{f:p=>Math.hypot(p[0]-90,p[1]-60)-50*(130-p[2])/120,z:[10,130]},
  cyl:{f:p=>{ const t=p[2]/100; return Math.hypot(p[0]-(100-55*t),p[1]-(90-50*t))-35; },z:[0,100]},
  ogive:{f:p=>(Math.hypot(p[0]-70,p[1]-70)+60)**2+p[2]**2-14400,z:[0,Math.sqrt(14400-3600)]} };
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function roots(g,lo,hi,N){ const out=[]; let a=lo, fa=g(a); for(let i=1;i<=N;i++){ const b=lo+(hi-lo)*i/N, fb=g(b);
    if(isFinite(fa)&&isFinite(fb)&&fa*fb<0){ let x=a,y=b,fx=fa; for(let k=0;k<60;k++){ const m=(x+y)/2, fm=g(m); if(fx*fm<=0) y=m; else { x=m; fx=fm; } } out.push((x+y)/2); } a=b; fa=fb; } return out; }
const grad=(f,p)=>{ const e=1e-4; return [0,1,2].map(i=>{ const a=p.slice(), b=p.slice(); a[i]+=e; b[i]-=e; return (f(a)-f(b))/(2*e); }); };
const unit=v=>{ const l=Math.hypot(...v); return v.map(x=>x/l); };
const circ=(c,r,n)=>Array.from({length:(n||96)+1},(_,i)=>{ const a=2*Math.PI*i/(n||96); return [c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)]; });
/* очерки поверхности типа (мм листа) */
function outlinesOf(kind){ const o=[], ax=[];
  if(kind==='cone'){ const S=F([90,60,130]), L=F([40,60,10]), R=F([140,60,10]); o.push({v:'F',p:[L,S]},{v:'F',p:[S,R]},{v:'F',p:[L,R]},{v:'H',p:circ(H([90,60,0]),50)}); ax.push({v:'F',p:[F([90,0,0]),F([90,0,140])]}); }
  else if(kind==='cyl'){ const b1=F([65,0,0]), b2=F([135,0,0]), t1=F([10,0,100]), t2=F([80,0,100]); o.push({v:'F',p:[b1,b2]},{v:'F',p:[t1,t2]},{v:'F',p:[b1,t1]},{v:'F',p:[b2,t2]});
    const c1=H([100,90,0]), c2=H([45,40,100]), d=unit([c2[0]-c1[0],c2[1]-c1[1]]), nr=[-d[1]*35,d[0]*35];
    o.push({v:'H',p:circ(c1,35)},{v:'H',p:circ(c2,35)},{v:'H',p:[[c1[0]+nr[0],c1[1]+nr[1]],[c2[0]+nr[0],c2[1]+nr[1]]]},{v:'H',p:[[c1[0]-nr[0],c1[1]-nr[1]],[c2[0]-nr[0],c2[1]-nr[1]]]}); ax.push({v:'F',p:[F([100,0,0]),F([45,0,100])]}); }
  else { const zt=Math.sqrt(10800), side=k=>Array.from({length:41},(_,i)=>{ const z=zt*i/40, r=Math.sqrt(14400-z*z)-60; return F([70+k*r,0,z]); });
    o.push({v:'F',p:side(1)},{v:'F',p:side(-1)},{v:'F',p:[F([10,0,0]),F([130,0,0])]},{v:'H',p:circ(H([70,70,0]),60)}); ax.push({v:'F',p:[F([70,0,0]),F([70,0,110])]}); }
  ax.push({v:'F',p:[[-190,0],[8,0]]}); return {o,ax}; }
/* пересечения отрезка a–b с ломаной P (мм листа) */
function segCross(a,b,P){ const out=[]; for(let i=1;i<P.length;i++){ const c=P[i-1], d=P[i], r=[b[0]-a[0],b[1]-a[1]], s=[d[0]-c[0],d[1]-c[1]], den=r[0]*s[1]-r[1]*s[0]; if(Math.abs(den)<1e-12) continue;
    const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den, u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den; if(t>=-0.3&&t<=1.3&&u>=0&&u<=1) out.push([a[0]+r[0]*t,a[1]+r[1]*t]); } return out; }
const CACHE={};
function ref(n){ n=+n; if(CACHE[n]) return CACHE[n]; const D=V[n]; if(!D) return null; const kind=kindOf(n), S=SURF[kind], A=D.A, B=D.B;
  const g=s=>{ const p=lerp(A,B,s); return p[2]<S.z[0]-1e-9||p[2]>S.z[1]+1e-9?NaN:S.f(p); };
  const ss=roots(g,-0.6,1.6,6000), K=ss.map(s=>lerp(A,B,s)), N=K.map(k=>unit(grad(S.f,k)));
  const {o,ax}=outlinesOf(kind), ab={F:[F(A),F(B)],H:[H(A),H(B)]}, cross={F:[],H:[]};
  o.forEach(q=>cross[q.v].push(...segCross(ab[q.v][0],ab[q.v][1],q.p)));
  const r={n,kind,name:NAME[kind],A,B,s:ss,K,P:K.map(k=>({F:F(k),H:H(k)})),N,outlines:o.concat([{v:'F',p:ab.F,ab:true},{v:'H',p:ab.H,ab:true}]),axes:ax,ab,cross};
  CACHE[n]=r; return r; }
function refs(){ const o={}; for(let n=1;n<=30;n++) o[n]=ref(n); return o; }

/* ── проверка ── */
const d2=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
const lineDist=(p,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy)||1e-9; return {d:Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/L,t:((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(L*L),L}; };
const angOf=(a,b)=>((Math.atan2(-(b[1]-a[1]),b[0]-a[0])*DEG)%180+180)%180;   /* к оси x, как на бумаге (y вверх), 0…180 */
const adiff=(a,b)=>{ const d=Math.abs(a-b)%180; return Math.min(d,180-d); };
const base=l=>String(l).replace(/[″′'"‴⁗₀-₉0-9^]+$/,'').replace(/[″′'"‴]/g,'').trim().toUpperCase();
const fmt=(x,d)=>(+x).toFixed(d==null?1:d).replace('.',',');
const PROJ={F:'π₂ (фронтальной)',H:'π₁ (горизонтальной)'}, PRIME={F:'″',H:'′'};
function verify(copy,R,o){ o=o||{}; const pts=(copy.pts||[]).map(q=>({l:String(q[0]),p:[q[1],q[2]]}));
  /* линии копии (с карандашом): отрезки — как есть; дуги и кривые — ломаными (через точку они тоже «проходят») */
  const segs=(copy.segs||[]).filter(s=>!s.unv).map(s=>[[s.p[0],s.p[1]],[s.p[2],s.p[3]]]);
  const polys=[].concat((copy.arcs||[]).filter(c=>!c.unv).map(c=>c.poly||c.p),(copy.curves||[]).filter(c=>!c.unv).map(c=>c.p||c.poly)).filter(P=>P&&P.length>1);
  const pieces=segs.concat([].concat(...polys.map(P=>P.slice(1).map((q,i)=>[P[i],q]))));
  const onAB=(p,v)=>{ const [a,b]=R.ab[v], q=lineDist(p,a,b); return q.d<=1.2&&q.t>=-0.15&&q.t<=1.15; };
  const abAng={F:angOf(...R.ab.F),H:angOf(...R.ab.H)};
  /* линии через точку X (≤ 0,8 мм от прямой отрезка, X внутри отрезка с запасом 1,5 мм), длиной ≥ 8 мм */
  const through=(X,minL)=>segs.filter(([a,b])=>{ const q=lineDist(X,a,b); return q.L>=(minL||8)&&q.d<=0.8&&q.t*q.L>=-1.5&&(q.t-1)*q.L<=1.5; }).map(([a,b])=>({a,b,ang:angOf(a,b),L:d2(a,b)}));
  const crossed=(X,v)=>pieces.some(([a,b])=>{ const q=lineDist(X,a,b); return q.d<=0.7&&q.t*q.L>=-0.7&&(q.t-1)*q.L<=0.7&&adiff(angOf(a,b),abAng[v])>5; });
  const parts=[], weak=!!o.weak;
  /* подписи нормали (n″, n′, n): точка P или надпись T — у конца линии нормали */
  const nLab=pts.filter(q=>/^n/i.test(q.l)&&!/^n\d/i.test(q.l)).map(q=>q.p).concat((copy.txt||[]).filter(t=>/^\s*n\s*[″′'"]?\s*$/i.test(String(t[2]))).map(t=>[t[0],t[1]]));
  const labeledN=l=>nLab.some(p=>{ const q=lineDist(p,l.a,l.b); return q.d<=4&&q.t*q.L>=-6&&(q.t-1)*q.L<=6; });
  /* ── часть 1: точки пересечения ── */
  { const st=R.P.map((P,i)=>{ const m={}; ['F','H'].forEach(v=>{ m[v]=pts.some(q=>d2(q.p,P[v])<=1.5)?'mark':crossed(P[v],v)?'line':null; }); return m; });
    const okK=st.map(m=>(m.F==='mark'&&m.H)||(m.H==='mark'&&m.F));
    const lab=i=>R.P.length>1?'K'+'₁₂'[i]:'K';
    /* точки студента на AB, которые ни с чем в эталоне не совпали (пара по линии связи с одной подписью) */
    const near=(p,v)=>R.P.some(P=>d2(p,P[v])<3)||d2(p,R.ab[v][0])<3||d2(p,R.ab[v][1])<3||R.cross[v].some(c=>d2(p,c)<2);
    const own=[]; pts.filter(q=>onAB(q.p,'F')&&!near(q.p,'F')).forEach(qf=>{ const b=base(qf.l); if(!b||/^[AB]$/.test(b)) return;
      const qh=pts.find(q=>q!==qf&&onAB(q.p,'H')&&!near(q.p,'H')&&base(q.l)===b&&Math.abs(q.p[0]-qf.p[0])<=1.5); if(qh) own.push({l:b,F:qf.p,H:qh.p}); });
    let part={id:'1',name:'точки пересечения AB с поверхностью',st:'не уверен'};
    if(!R.P.length) part.why='по варианту прямая не пересекает поверхность — проверить нечего';
    else if(okK.every(Boolean)){ part.st='верно'; part.why='обе точки на месте'+(R.P.length>1?' ('+R.P.map((P,i)=>lab(i)+': x = '+fmt(-P.F[0])).join(', ')+' мм)':''); part.at=R.P.map(P=>({v:'F',p:P.F})); }
    else { const miss=R.P.map((P,i)=>i).filter(i=>st[i].F!=='mark'&&st[i].H!=='mark'), wrong=[];
      own.forEach(w=>{ let bi=-1, bd=1e9; R.P.forEach((P,i)=>{ const d=Math.abs(w.F[0]-P.F[0]); if(d<bd){ bd=d; bi=i; } }); if(bi>=0&&miss.includes(bi)&&bd>=3) wrong.push({w,i:bi,d:bd}); });
      if(wrong.length&&!weak){ const e=wrong.sort((a,b)=>b.d-a.d)[0], P=R.P[e.i], dir=e.w.F[0]<P.F[0]?'левее':'правее';
        Object.assign(part,{st:'ошибка',got:+(-e.w.F[0]).toFixed(1),want:+(-P.F[0]).toFixed(1),d:+e.d.toFixed(1),unit:'мм',at:[{v:'F',p:e.w.F},{v:'H',p:e.w.H},{v:'F',p:P.F,want:true},{v:'H',p:P.H,want:true}],
          why:'точка '+e.w.l+' стоит на '+fmt(e.d)+' мм '+dir+', чем точка пересечения по варианту (x = '+fmt(-e.w.F[0])+' вместо '+fmt(-P.F[0])+' мм)',
          hint:'проверьте посредник: линия сечения поверхности посредником должна пересечь AB именно там, где точка'}); }
      else { const found=okK.filter(Boolean).length;
        /* точка студента рядом, но дальше допуска «верно»: 1,5–3 мм — не верно и не ошибка */
        const near=R.P.map((P,i)=>{ if(okK[i]) return null; let m=null; ['F','H'].forEach(v=>pts.forEach(q=>{ const d=d2(q.p,P[v]); if(d>1.5&&d<3&&onAB(q.p,v)&&(!m||d<m.d)) m={d,l:q.l,v,i}; })); return m; }).filter(Boolean)[0];
        if(near&&!wrong.length){ part.why='точка '+near.l+' стоит в '+fmt(near.d)+' мм от точки пересечения по варианту — между «верно» (до 1,5 мм) и «ошибкой» (от 3 мм)'; part.at=[{v:near.v,p:R.P[near.i][near.v],want:true}]; part.hint='проверьте эту точку по линии связи и посреднику; снимите чертёж крупнее'; }
        else { part.why=wrong.length?'точка на AB стоит не там, где по варианту, но привязка к варианту неточная — не утверждаю'
          :found?'найдена только одна точка из '+R.P.length+' — вторая не отмечена или не видна на снимке':'точки пересечения не найдены на копии (не подписаны или не видны)';
        part.hint='подпишите точки пересечения (K, M) на обеих проекциях и снимите чертёж крупнее'; } } }
    parts.push(part); }
  /* ── часть 2: касательная плоскость и нормаль ── */
  { const part={id:'2',name:'касательная плоскость и нормаль',st:'не уверен'};
    const conf={F:[0,90,abAng.F],H:[0,90,abAng.H]};
    /* очерк поверхности через точку — не улика: точка на очерковой образующей, и касательная плоскость там проецирующая при любом решении */
    const outl={F:[],H:[]}; R.outlines.filter(q=>!q.ab).forEach(q=>outl[q.v].push(q.p));
    const dPoly=(p,P)=>{ let m=1e9; for(let i=1;i<P.length;i++){ const q=lineDist(p,P[i-1],P[i]); const t=Math.max(0,Math.min(1,q.t)); m=Math.min(m,d2(p,[P[i-1][0]+(P[i][0]-P[i-1][0])*t,P[i-1][1]+(P[i][1]-P[i-1][1])*t])); } return m; };
    /* сама AB проходит через точку при любом решении — не улика никогда */
    const onAbLine=(l,v)=>adiff(l.ang,abAng[v])<=2&&lineDist([(l.a[0]+l.b[0])/2,(l.a[1]+l.b[1])/2],R.ab[v][0],R.ab[v][1]).d<=1;
    const onOutline=(l,v)=>[0.15,0.5,0.85].every(t=>{ const p=[l.a[0]+(l.b[0]-l.a[0])*t,l.a[1]+(l.b[1]-l.a[1])*t]; return outl[v].some(P=>dPoly(p,P)<=1); });
    const cand=R.P.map((P,i)=>{ const out={i,views:{}}; ['F','H'].forEach(v=>{ const nv=v==='F'?[-R.N[i][0],-R.N[i][2]]:[-R.N[i][0],R.N[i][1]], ln=Math.hypot(...nv);
        const want=ln<0.15?null:angOf([0,0],nv);   /* нормаль почти ⟂ плоскости проекций — направление не определено */
        const L=through(P[v],8).filter(l=>!onOutline(l,v)&&!onAbLine(l,v)).filter(l=>!conf[v].some(c=>adiff(l.ang,c)<=3&&(want==null||Math.min(adiff(want,c),adiff(want+90,c))>=6)));
        const m=want==null?null:L.map(l=>({l,d:Math.min(adiff(l.ang,want),adiff(l.ang,want+90))}));
        const pair=[]; L.forEach((a,x)=>L.forEach((b,y)=>{ if(y>x&&Math.abs(adiff(a.ang,b.ang)-90)<=2.5) pair.push([a,b]); }));
        if(want!=null) pair.sort((p,q)=>Math.max(...p.map(l=>Math.min(adiff(l.ang,want),adiff(l.ang,want+90))))-Math.max(...q.map(l=>Math.min(adiff(l.ang,want),adiff(l.ang,want+90)))));
        /* у конуса и поверхности вращения нормаль на π₁ всегда радиальна (проходит через центр основания), а образующая через K′ — тоже:
           совпадение на π₁ ничего не доказывает (trivial) — «верно» судится по π₂ */
        const nl=want==null?null:L.filter(labeledN).map(l=>({l,d:adiff(l.ang,want)})).sort((x,y)=>x.d-y.d)[0]||null;   /* подписанная нормаль — сверяется с n, а не с n или ⟂ */
        out.views[v]={want,nl,lines:L.length,best:m&&m.length?m.reduce((a,b)=>a.d<=b.d?a:b):null,pair:pair[0]||null,trivial:v==='H'&&(R.kind==='cone'||R.kind==='ogive')}; }); return out; });
    /* допуск «верно» 3° (рука и снимок: 1 мм на 20 мм линии ≈ 3°), «ошибка» — от 4°. Одна линия через точку совпадает с одним из двух
       направлений случайно в ≈ 7 % случаев — поэтому «верно» только при подтверждении: пара n ⟂ (f″ или h′) совпала, или совпала подписанная
       нормаль, или совпадение на обеих (не тривиальных) проекциях */
    const OKD=3, viewOk=x=>x.want==null||x.trivial||(x.best&&x.best.d<=OKD), real=x=>!x.trivial&&x.want!=null&&x.best&&x.best.d<=OKD;
    const pairOk=x=>!x.trivial&&x.want!=null&&x.pair&&x.pair.every(l=>Math.min(adiff(l.ang,x.want),adiff(l.ang,x.want+90))<=OKD), nlOk=x=>!x.trivial&&x.nl&&x.nl.d<=OKD;
    const strong=c=>{ const F=c.views.F, H=c.views.H; return pairOk(F)||pairOk(H)||nlOk(F)||nlOk(H)||(real(F)&&real(H)); };
    const good=cand.find(c=>viewOk(c.views.F)&&viewOk(c.views.H)&&(real(c.views.F)||real(c.views.H))&&strong(c));
    const soft=!good&&cand.find(c=>viewOk(c.views.F)&&viewOk(c.views.H)&&(real(c.views.F)||real(c.views.H)));
    if(!R.P.length) part.why='точек пересечения нет — касательную плоскость строить негде';
    else if(good){ part.st='верно'; part.why='нормаль и касательная плоскость в точке '+(R.P.length>1?'K'+'₁₂'[good.i]:'K')+' — по направлениям варианта (на обеих проекциях)'; part.at=[{v:'F',p:R.P[good.i].F},{v:'H',p:R.P[good.i].H}]; }
    else { /* точка, у которой студент строил больше всего */
      const c=cand.slice().sort((a,b)=>(b.views.F.lines+b.views.H.lines)-(a.views.F.lines+a.views.H.lines))[0], VF=c&&c.views.F, VH=c&&c.views.H;
      const bad=v=>{ const x=c.views[v]; return x.want!=null&&x.best&&x.best.d>=4; }, pairV=['F','H'].find(v=>c&&c.views[v].pair&&bad(v));
      const nlV=c&&['F','H'].find(v=>{ const x=c.views[v]; return !x.trivial&&x.nl&&x.nl.d>=4&&!(x.best&&x.best.d<=OKD&&adiff(x.best.l.ang,x.want)<=OKD); });
      if(nlV&&!weak){ const x=c.views[nlV], l=x.nl.l;
        Object.assign(part,{st:'ошибка',got:+l.ang.toFixed(1),want:+x.want.toFixed(1),d:+x.nl.d.toFixed(1),unit:'°',at:[{v:nlV,p:R.P[c.i][nlV]},{v:nlV,seg:[l.a,l.b]}],
          why:'нормаль n'+PRIME[nlV]+' на проекции '+PROJ[nlV]+' идёт под '+fmt(l.ang)+'° к оси x, по варианту — под '+fmt(x.want)+'° (расходится на '+fmt(x.nl.d)+'°)',
          hint:nlV==='F'?'проверьте фронталь касательной плоскости: n″ ⟂ f″':'проверьте горизонталь касательной плоскости: n′ ⟂ h′'}); }
      else if(c&&pairV&&!(c.views[pairV].best&&c.views[pairV].best.d<=OKD)&&(bad(pairV==='F'?'H':'F')||viewOk(c.views[pairV==='F'?'H':'F']))&&!weak){ const v=pairV, x=c.views[v], pr=x.pair, dd=pr.map(l=>Math.min(adiff(l.ang,x.want),adiff(l.ang,x.want+90))), l=pr[dd[0]>=dd[1]?1:0];
        const nearN=adiff(l.ang,x.want)<=adiff(l.ang,x.want+90), want=nearN?x.want:(x.want+90)%180;
        Object.assign(part,{st:'ошибка',got:+l.ang.toFixed(1),want:+want.toFixed(1),d:+Math.min(...dd).toFixed(1),unit:'°',at:[{v,p:R.P[c.i][v]},{v,seg:[l.a,l.b]}],
          why:'на проекции '+PROJ[v]+' пара перпендикулярных линий через точку повёрнута на '+fmt(Math.min(...dd))+'°: линия под '+fmt(l.ang)+'° к оси x, по варианту '+(nearN?'нормаль':'касательная плоскость')+' идёт под '+fmt(want)+'°',
          hint:v==='F'?'проверьте фронталь касательной плоскости: n″ ⟂ f″':'проверьте горизонталь касательной плоскости: n′ ⟂ h′'}); }
      else if(soft){ const x=real(soft.views.F)?soft.views.F:soft.views.H; part.why='через точку '+(R.P.length>1?'K'+'₁₂'[soft.i]:'K')+' идёт линия по направлению варианта ('+fmt(x.best.l.ang)+'°), но подтвердить нечем: нет второй, перпендикулярной ей, и подписи n';
        part.hint='подпишите нормаль n (n″, n′) и начертите фронталь f″ или горизонталь h′ касательной плоскости'; }
      else { const any=c&&(VF.lines||VH.lines); part.why=!any?'через точки пересечения не найдено линий касательной плоскости и нормали':'линии через точку есть, но направление нормали подтвердить не удалось'+(c&&(bad('F')||bad('H'))&&weak?' (привязка неточная)':'');
        part.hint='подпишите нормаль n и прямые касательной плоскости (h, f или t), снимите чертёж крупнее'; } }
    if(o.debug) part.debug=cand.map(c=>({i:c.i,views:Object.fromEntries(Object.entries(c.views).map(([k,x])=>[k,{want:x.want,lines:x.lines,best:x.best&&{ang:x.best.l.ang,d:x.best.d},nl:x.nl&&x.nl.d,pair:x.pair&&x.pair.map(l=>l.ang),trivial:x.trivial}]))}));
    parts.push(part); }
  const verdict=parts.some(p=>p.st==='ошибка')?'ошибка':parts.every(p=>p.st==='верно')?'верно':'не уверен';
  return {verdict,parts,abCov:+abCover(copy,R).toFixed(3)}; }

/* прямая AB на копии: доля длины A″B″ и A′B′, у которой ближе 1 мм есть линия копии (вариант внутри типа отличается только AB) */
function abCover(copy,R){ const P=[].concat((copy.segs||[]).filter(s=>!s.unv).map(s=>[[s.p[0],s.p[1]],[s.p[2],s.p[3]]]));
  let k=0, t=0; ['F','H'].forEach(v=>{ const [a,b]=R.ab[v], L=d2(a,b), m=Math.max(2,Math.ceil(L)); for(let i=0;i<=m;i++){ const q=[a[0]+(b[0]-a[0])*i/m,a[1]+(b[1]-a[1])*i/m]; t++;
      if(P.some(([c,d])=>{ const r=lineDist(q,c,d); return r.d<=1&&r.t*r.L>=-1&&(r.t-1)*r.L<=1; })) k++; } }); return t?k/t:0; }
/* вариант внутри типа поверхности (очерки у всех вариантов типа одни, привязка по ним уже дала мм листа): по покрытию AB и подписям
   A″ B″ A′ B′ (≤ 3 мм). → {n, cov, labels, second} */
function pickVariant(copy,kind){ const pts=(copy.pts||[]).map(q=>({l:base(q[0]),pr:/′|'/.test(q[0])&&!/″|"/.test(q[0])?'H':/″|"/.test(q[0])?'F':null,p:[q[1],q[2]]}));
  const sc=[]; for(let n=1;n<=30;n++){ if(kindOf(n)!==kind) continue; const R=ref(n), cov=abCover(copy,R); let lab=0;
    pts.forEach(q=>{ if(!/^[AB]$/.test(q.l)||!q.pr) return; const want=R.ab[q.pr][q.l==='A'?0:1]; if(d2(q.p,want)<=3) lab++; });
    sc.push({n,cov:+cov.toFixed(3),labels:lab,score:cov+0.25*lab}); }
  sc.sort((a,b)=>b.score-a.score); return sc.length?Object.assign({},sc[0],{second:sc[1]||null}):null; }

const api={V,kindOf,ref,refs,verify,abCover,pickVariant,angOf,adiff,base,F,H};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else self.SCANVERIFY5=api;
})();
