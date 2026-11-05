/* ═══════════ Виды построения без подписей: ищем по геометрии, а не по буквам ═══════════
   Модель часто не подписывает точки построения (или подписывает «как привык студент»: D вместо B, ₄ вместо ‴), а линии
   построения в копии есть (отрезки, подтверждённые карандашом). Любая проекция, полученная заменой плоскостей, — это
   ортогональная проекция настоящей пирамиды в натуральную величину: p_i = R·X_i + t (R — две строки поворота, масштаб 1).
   Значит, вид построения можно узнать по форме: четыре вершины чертежа, которые с невязкой ≤ ~1 мм — проекция пирамиды
   варианта, и рёбра между ними начерчены. По найденному виду — результат: основание ребром (A, B, C на прямой) → H;
   ребро AB точкой → угол граней; треугольник ABC в истинную величину → истинный вид.
   Против совпадений (их много: на чертеже 30–80 вершин, у трёх точек любой проекции есть зеркальное направление взгляда
   с той же формой, через ось или линию связи проходят много вершин):
     — ребро «начерчено» (3), только если цепочка отрезков идёт от вершины до вершины (не дальше 3 мм за концы); «на линии» (1) —
       если вершины просто лежат на одной прямой (ось, линия связи); нужно ≥ 4 «рёбер» из 6; у «основания ребром» — прямая
       основания + все три ребра к S; подписанная буквой построения (не ″ и ′) вершина считается как ещё одно ребро;
     — вид не делит ни одной вершины с заданными проекциями (″ и ′ — по подписям и по найденным видам вдоль y и z);
     — цепочка замен: вид первой замены смотрит ⟂ z или ⟂ y (± 4°), вид второй — ⟂ взгляду найденного вида первой.
   Перебор: путь из двух начерченных линий (a–b–c) × 24 порядка букв → поза по трём точкам (явная формула) → предсказанная
   четвёртая вершина → МНК-поза по четырём (Гаусс — Ньютон) → невязка ≤ tol.
   Заданные проекции (″ и ′) — условие, а не построение: отбрасываются по направлению взгляда (вдоль y или z).
   Отдельно — тройки A, B, C с истинными длинами сторон и всеми тремя сторонами на отрезках (истинный вид вращением:
   там S не вращают, вид не является проекцией всей пирамиды).
   findViews(segs [[x1,y1,x2,y2]] мм, pts [[подпись,x,y]] мм или null (места точек — кандидаты в вершины; буквы — только как
     доп. свидетельство, o.labels = false — без них), data {A,B,C,S: [x,y,z]},
     o {tol (макс. невязка, мм; 1), strong/line (рёбер «начерчено»/«на линии»; 4/4), flatLine/flatStrong (основание ребром; 5/3),
        over (за конец ребра, мм; 3), tolS (до линии, мм; 0,6), dirTol (°; 4), chain (true), triples (true)})
   → [{kind:'edge'|'dih'|'true'|'view', pts:{A,B,C,S}, H?, dih?, sides?, rms, max, sup, strong, la, dir, level}] — по одному на вид;
     .stats {vertices, fits, ms}. Замер на синтетике и настоящих листах — lab/dz/REPORT.md, 7т; тест — lab/dz/test-views.js. */
(function(){
'use strict';
const sub=(a,b)=>a.map((v,i)=>v-b[i]), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), nrm=a=>Math.sqrt(dot(a,a)), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const d2=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]), DEG=180/Math.PI, NM=['A','B','C','S'];
/* ── вершины: пересечения отрезков (в пределах отрезков + ext), близкие — одна; плюс места подписанных точек ── */
function vertices(segs,pts,o){ const ext=o.ext||1.5, mrg=o.merge||0.8;
  const L=segs.map(s=>{ const dx=s[2]-s[0], dy=s[3]-s[1], len=Math.hypot(dx,dy)||1; return {p:s,ux:dx/len,uy:dy/len,len}; }).filter(l=>l.len>=1.5);
  const raw=[]; for(let i=0;i<L.length;i++) for(let j=i+1;j<L.length;j++){ const a=L[i], b=L[j], den=a.ux*b.uy-a.uy*b.ux; if(Math.abs(den)<Math.sin(4/DEG)) continue;
    const t=((b.p[0]-a.p[0])*b.uy-(b.p[1]-a.p[1])*b.ux)/den, x=a.p[0]+a.ux*t, y=a.p[1]+a.uy*t, u=(x-b.p[0])*b.ux+(y-b.p[1])*b.uy;
    if(t<-ext||t>a.len+ext||u<-ext||u>b.len+ext) continue; raw.push([x,y]); }
  (pts||[]).forEach(q=>raw.push([q[1],q[2]]));
  /* слияние жадно (центр тяжести кластера): пересечения трёх линий в одной точке дают 3 кандидата в пределах дрожи руки */
  const V=[]; raw.forEach(p=>{ const v=V.find(v=>d2(v,p)<mrg); if(v){ v.s[0]+=p[0]; v.s[1]+=p[1]; v.n++; v[0]=v.s[0]/v.n; v[1]=v.s[1]/v.n; } else { const w=[p[0],p[1]]; w.s=[p[0],p[1]]; w.n=1; V.push(w); } });
  return {L,V}; }
/* ── ребро «начерчено»: цепочка отрезков вдоль u–v (без разрывов > 1,5 мм) покрывает ≥ 80 % [u,v] — «на линии» (1);
   и цепочка не уходит дальше E мм за концы — «ребро» (3). Различие главное против совпадений: ось, линия связи, длинная
   прямая уровня проходят через многие вершины, и по ним «начерчены» были бы рёбра любой четвёрки на одной прямой;
   ребро же студент чертит от вершины до вершины (на синтетике без этого — десятки ложных «видов» на одной части) ── */
function supportMatrix(L,V,o){ const tolS=o.tolS||0.6, E=o.over==null?3:o.over, N=V.length, on=V.map(v=>L.map((l,k)=>Math.abs((v[0]-l.p[0])*l.uy-(v[1]-l.p[1])*l.ux)<=tolS?k:-1).filter(k=>k>=0));
  const S=Array.from({length:N},()=>new Uint8Array(N));
  for(let i=0;i<N;i++){ S[i][i]=3; const si=new Set(on[i]); for(let j=i+1;j<N;j++){ const D=d2(V[i],V[j]); if(D<1.5){ S[i][j]=S[j][i]=3; continue; }
    const ux=(V[j][0]-V[i][0])/D, uy=(V[j][1]-V[i][1])/D, cs=on[j].filter(k=>si.has(k)&&Math.abs(L[k].ux*uy-L[k].uy*ux)<Math.sin(4/DEG)); if(!cs.length) continue;
    const iv=cs.map(k=>{ const l=L[k], a=(l.p[0]-V[i][0])*ux+(l.p[1]-V[i][1])*uy, b=(l.p[2]-V[i][0])*ux+(l.p[3]-V[i][1])*uy; return [Math.min(a,b),Math.max(a,b)]; }).sort((a,b)=>a[0]-b[0]);
    /* цепочки: соседние отрезки с зазором ≤ 1,5 мм — одна линия (точка на ребре делит его на два отрезка) */
    const ch=[]; iv.forEach(([a,b])=>{ const c=ch[ch.length-1]; if(c&&a<=c.hi+1.5){ c.cov+=Math.max(0,Math.min(b,D)-Math.max(a,c.hi,0)); c.hi=Math.max(c.hi,b); } else ch.push({lo:a,hi:b,cov:Math.max(0,Math.min(b,D)-Math.max(a,0))}); });
    let best=null; ch.forEach(c=>{ if(!best||c.cov>best.cov) best=c; }); if(best.cov<0.8*D) continue;
    S[i][j]=S[j][i]=best.lo>=-E&&best.hi<=D+E?3:1; } }
  return S; }
/* ── ортогональная проекция с масштабом 1: P (4 × 2) ≈ R·X + t ──
   Начало — аффинная проекция (8 уравнений, 8 неизвестных — точна всегда), её ближайшая ортонормированная (полярное разложение
   2 × 3: (A·Aᵀ)^(−½)·A), затем Гаусс — Ньютон по малому повороту. Масштаб не подгоняется: замена плоскостей его не меняет. */
function prepX(X){ const m=[0,1,2].map(k=>X.reduce((s,x)=>s+x[k],0)/X.length), Xc=X.map(x=>sub(x,m));
  const G=[[0,0,0],[0,0,0],[0,0,0]]; Xc.forEach(x=>{ for(let a=0;a<3;a++) for(let b=0;b<3;b++) G[a][b]+=x[a]*x[b]; }); const Gi=inv3(G);
  return {m,Xc,M:Xc.map(x=>[0,1,2].map(b=>x[0]*Gi[0][b]+x[1]*Gi[1][b]+x[2]*Gi[2][b]))}; }
function inv3(m){ const [a,b,c]=m[0], [d,e,f]=m[1], [g,h,i]=m[2], A=e*i-f*h, B=-(d*i-f*g), C=d*h-e*g, det=a*A+b*B+c*C;
  return [[A/det,-(b*i-c*h)/det,(b*f-c*e)/det],[B/det,(a*i-c*g)/det,-(a*f-c*d)/det],[C/det,-(a*h-b*g)/det,(a*e-b*d)/det]]; }
function rodr(w){ const t=nrm(w); if(t<1e-12) return [[1,0,0],[0,1,0],[0,0,1]]; const k=w.map(v=>v/t), c=Math.cos(t), s=Math.sin(t), C=1-c;
  return [[c+k[0]*k[0]*C,k[0]*k[1]*C-k[2]*s,k[0]*k[2]*C+k[1]*s],[k[1]*k[0]*C+k[2]*s,c+k[1]*k[1]*C,k[1]*k[2]*C-k[0]*s],[k[2]*k[0]*C-k[1]*s,k[2]*k[1]*C+k[0]*s,c+k[2]*k[2]*C]]; }
function projFit(PX,P){ const n=P.length, pm=[0,1].map(k=>P.reduce((s,p)=>s+p[k],0)/n), Pc=P.map(p=>[p[0]-pm[0],p[1]-pm[1]]), {Xc,M,m}=PX;
  const A=[0,1].map(r=>[0,1,2].map(c=>Pc.reduce((s,p,i)=>s+p[r]*M[i][c],0)));
  /* (A·Aᵀ)^(−½): 2 × 2 симметричная — собственные числа явно */
  const a=dot(A[0],A[0]), b=dot(A[0],A[1]), c=dot(A[1],A[1]), tr=a+c, dt=a*c-b*b; if(dt<=1e-9) return null; const s=Math.sqrt(dt), tt=Math.sqrt(tr+2*s);
  /* √(S) для 2 × 2: (S + √det·I)/√(tr + 2√det); обратная — через неё */
  const q=[[(a+s)/tt,b/tt],[b/tt,(c+s)/tt]], qd=q[0][0]*q[1][1]-q[0][1]*q[1][0], qi=[[q[1][1]/qd,-q[0][1]/qd],[-q[1][0]/qd,q[0][0]/qd]];
  let R=[0,1].map(r=>[0,1,2].map(k=>qi[r][0]*A[0][k]+qi[r][1]*A[1][k]));
  const res=()=>Xc.map((x,i)=>[Pc[i][0]-dot(R[0],x),Pc[i][1]-dot(R[1],x)]);
  for(let it=0;it<6;it++){ const e=res(), H=[[0,0,0],[0,0,0],[0,0,0]], g=[0,0,0];
    /* R(I + [w]×)·x = R·x + R·(w × x) = R·x + w·(x × r) по строке r → Якоби: x × r; шаг — МНК (JᵀJ)⁻¹·Jᵀ·e */
    Xc.forEach((x,i)=>[0,1].forEach(r=>{ const J=cross(x,R[r]); for(let p=0;p<3;p++){ g[p]+=J[p]*e[i][r]; for(let q2=0;q2<3;q2++) H[p][q2]+=J[p]*J[q2]; } }));
    for(let p=0;p<3;p++) H[p][p]+=1e-6; const Hi=inv3(H), w=[0,1,2].map(p=>Hi[p][0]*g[0]+Hi[p][1]*g[1]+Hi[p][2]*g[2]), Q=rodr(w);
    R=R.map(r=>[0,1,2].map(k=>r[0]*Q[0][k]+r[1]*Q[1][k]+r[2]*Q[2][k])); if(nrm(w)<1e-7) break; }
  const e=res(), r2=e.map(v=>Math.hypot(v[0],v[1])); return {R,dir:cross(R[0],R[1]),t:[pm[0]-dot(R[0],m),pm[1]-dot(R[1],m)],rms:Math.sqrt(r2.reduce((s,v)=>s+v*v,0)/n),max:Math.max(...r2),res:r2}; }
/* основание ребром на чертеже: A, B, C на одной прямой → индексы крайней пары (средняя сторона «на линии» крайней) */
function flatBase(P){ const [A,B,C]=P, ab=d2(A,B), bc=d2(B,C), ca=d2(C,A), span=Math.max(ab,bc,ca), area=Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]))/2;
  if(span<10||2*area/span>1) return null; return ab>=bc&&ab>=ca?[0,1]:bc>=ca?[1,2]:[2,0]; }
/* ── что даёт найденный вид ── */
function classify(P,data,o){ const [A,B,C,S]=P, ab=d2(A,B), bc=d2(B,C), ca=d2(C,A), span=Math.max(ab,bc,ca), area=Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]))/2;
  const X=NM.map(k=>data[k]), tl=[nrm(sub(X[1],X[0])),nrm(sub(X[2],X[1])),nrm(sub(X[0],X[2]))], out={};
  if(ab<1.5){ const M=[(A[0]+B[0])/2,(A[1]+B[1])/2], vs=sub(S,M), vc=sub(C,M); out.kind='dih'; out.dih=Math.acos(Math.max(-1,Math.min(1,dot(vs,vc)/nrm(vs)/nrm(vc))))*DEG; }
  else if(span>10&&2*area/span<(o.flat||1)){ const [p,q]=ab>=bc&&ab>=ca?[A,B]:bc>=ca?[B,C]:[C,A], L=d2(p,q); out.kind='edge'; out.H=Math.abs((S[0]-p[0])*(q[1]-p[1])-(S[1]-p[1])*(q[0]-p[0]))/L; }
  else if(Math.max(Math.abs(ab-tl[0]),Math.abs(bc-tl[1]),Math.abs(ca-tl[2]))<=(o.tol||1)*1.5){ out.kind='true'; out.sides=[ab,bc,ca]; }
  else out.kind='view';
  return out; }
function findViews(segs,pts,data,o){ o=o||{}; const tol=o.tol||1, t0=Date.now();
  const {L,V}=vertices(segs||[],pts,o), N=V.length, S=supportMatrix(L,V,o), X=NM.map(k=>data[k]), PX=prepX(X), DX=X.map(a=>X.map(b=>nrm(sub(a,b))));
  const adj=V.map((_,i)=>{ const r=[]; for(let j=0;j<N;j++) if(S[i][j]) r.push(j); return r; }), adjS=V.map((_,i)=>{ const r=[]; for(let j=0;j<N;j++) if(S[i][j]===3) r.push(j); return r; });
  /* заданные проекции: взгляд вдоль y (″) или z (′) — условие, а не построение */
  const given=dir=>Math.abs(dir[1])>Math.cos(3/DEG)||Math.abs(dir[2])>Math.cos(3/DEG);
  const perms=[]; (function pm(a,r){ if(!r.length){ perms.push(a); return; } r.forEach((x,i)=>pm(a.concat(x),r.filter((_,j)=>j!==i))); })([],[0,1,2,3]);
  const seen=new Set(), found=[]; let nFit=0;
  /* вершины заданных проекций: найденные «виды» вдоль y и z + подписанные ″ и ′. Вид построения не делит с ними ни одной вершины —
     иначе это отражение заданной проекции: у трёх точек ″ есть второе направление взгляда с той же формой (зеркальное
     относительно их плоскости), и четвёртая вершина где-то рядом (конец линии связи) даёт ложный «вид» */
  /* буквы подписей построения у каждой вершины (ближе 1,5 мм; ″ и ′ — нет) */
  const lab=V.map(()=>new Set()); (pts||[]).forEach(q=>{ const l=String(q[0]).trim(); if(/[″′"']$/.test(l)) return; const m=l.match(/^([ABCSabcs])/); if(!m) return; V.forEach((v,i)=>{ if(d2(v,[q[1],q[2]])<1.5) lab[i].add(m[1].toUpperCase()); }); });
  const gv=new Set(); (pts||[]).forEach(q=>{ if(!/[″′"']$/.test(String(q[0]).trim())) return; V.forEach((v,i)=>{ if(d2(v,[q[1],q[2]])<1.5) gv.add(i); }); });
  /* путь v0–v1–v2 по начерченным линиям (≥ «на линии»), v3 — любая вершина. Любые 3 начерченных ребра из 6 содержат такой
     путь (путь из трёх, звезда, треугольник), порядок букв — все 24. Одно «ребро точкой» (v ≡ v′, только AB) — допускается.
     Принять: «основание ребром» — сторон основания на линии + рёбер ≥ flatLine, из них «рёбер» (3) ≥ flatStrong;
     иначе — «рёбер» ≥ strong и начерченных ≥ line */
  const oS=o.strong==null?4:o.strong, oL=o.line==null?4:o.line, fL=o.flatLine==null?5:o.flatLine, fS=o.flatStrong==null?3:o.flatStrong;
  /* поза по трём точкам (ортогональная, масштаб 1): в базисе плоскости тройки (e1, e2, нормаль e3) R = [M | c], M = [a b]·[u v]⁻¹
     (u, v — рёбра тройки в плоскости, a, b — на чертеже), c — из ортонормированности строк: c₁² = 1 − |M₁|², c₁·c₂ = −M₁·M₂
     (два решения — взгляд с одной и с другой стороны плоскости тройки). Четвёртая точка предсказана — ищем вершину рядом */
  perms.forEach(pr=>{ const [i0,i1,i2]=pr, u=sub(X[i1],X[i0]), v=sub(X[i2],X[i0]), e1=u.map(x=>x/nrm(u)), n3=cross(u,v), e3=n3.map(x=>x/nrm(n3)), e2=cross(e3,e1);
    const U=[[dot(u,e1),dot(v,e1)],[dot(u,e2),dot(v,e2)]], det=U[0][0]*U[1][1]-U[0][1]*U[1][0]; const w=sub(X[pr[3]],X[i0]); pr.t={Ui:[[U[1][1]/det,-U[0][1]/det],[-U[1][0]/det,U[0][0]/det]],we:[dot(w,e1),dot(w,e2),dot(w,e3)]}; });
  const OUT=[[0,0],[0,0],[0,0],[0,0]];
  const predict=(pr,p0,p1,p2)=>{ const U=pr.t.Ui, we=pr.t.we, ax=p1[0]-p0[0], ay=p1[1]-p0[1], bx=p2[0]-p0[0], by=p2[1]-p0[1];
    const m00=ax*U[0][0]+bx*U[1][0], m01=ax*U[0][1]+bx*U[1][1], m10=ay*U[0][0]+by*U[1][0], m11=ay*U[0][1]+by*U[1][1];
    const q1=1-m00*m00-m01*m01, q2=1-m10*m10-m11*m11, m12=m00*m10+m01*m11; if(q1<-0.15||q2<-0.15) return 0;
    /* шум руки: |Mᵢ| чуть больше 1 → cᵢ = 0. Лишнее уравнение тройки c₁·c₂ = −M₁·M₂ — проверка (с запасом на руку), им же знак c₂ */
    const c1=Math.sqrt(Math.max(0,q1)), c2=Math.sqrt(Math.max(0,q2)), bx0=p0[0]+m00*we[0]+m01*we[1], by0=p0[1]+m10*we[0]+m11*we[1]; let n=0;
    for(const sg of [1,-1]){ if(Math.abs(c1*c2*sg+m12)>0.1) continue; if(sg===-1&&c1*c2<0.02) continue;
      OUT[n][0]=bx0+c1*we[2]; OUT[n][1]=by0+sg*c2*we[2]; n++; OUT[n][0]=bx0-c1*we[2]; OUT[n][1]=by0-sg*c2*we[2]; n++; }
    return n; };
  /* ближайшая вершина к предсказанной (≤ 2·tol): сетка 4 мм */
  const G=new Map(), gk=(x,y)=>Math.floor(x/4)*100003+Math.floor(y/4); V.forEach((v,i)=>{ const k=gk(v[0],v[1]); if(!G.has(k)) G.set(k,[]); G.get(k).push(i); });
  const near=q=>{ let d=-1, bd=2*tol; const cx=Math.floor(q[0]/4), cy=Math.floor(q[1]/4); for(let x=cx-1;x<=cx+1;x++) for(let y=cy-1;y<=cy+1;y++){ const c=G.get(x*100003+y); if(c) c.forEach(k=>{ const e=d2(V[k],q); if(e<bd){ bd=e; d=k; } }); } return d; };
  /* путь a–b–c (c > a: путь c–b–a с обратным порядком букв — тот же набор); «точка» (A ≡ B) — только через предсказание */
  for(let a=0;a<N;a++) for(const b of adj[a]){ if(b===a) continue; const dab=d2(V[a],V[b]);
    for(const c of adj[b]){ if(c<=a||c===b) continue; const dbc=d2(V[b],V[c]), dac=d2(V[a],V[c]);
      for(const pr of perms){ if(dab>DX[pr[0]][pr[1]]+tol||dbc>DX[pr[1]][pr[2]]+tol||dac>DX[pr[0]][pr[2]]+tol) continue;
      const np=predict(pr,V[a],V[b],V[c]); for(let qi=0;qi<np;qi++){ const d=near(OUT[qi]); if(d<0) continue;
        const col=d===a&&pr[0]+pr[3]===1||d===b&&pr[1]+pr[3]===1||d===c&&pr[2]+pr[3]===1?1:0; if(!col&&(d===a||d===b||d===c)) continue; const vs=[a,b,c,d];
        const asg=[0,0,0,0]; pr.forEach((k,i)=>{ asg[k]=vs[i]; }); const key=asg.join(','); if(seen.has(key)) continue; seen.add(key);
        const P0=asg.map(i=>V[i]), fl=asg[0]!==asg[1]&&flatBase(P0);
        /* основание ребром: его прямую студент обычно продлевает за крайние точки — сторонам основания хватит «на линии»
           (если на линии крайняя пара), зато нужно больше рёбер (иначе любая ось с тремя вершинами + две линии к S) */
        let e1=0, e3=0; for(let i=0;i<4;i++) for(let j=i+1;j<4;j++){ const q=S[asg[i]][asg[j]]; if(q===3) e3++; if(q||fl&&j<3&&S[asg[fl[0]]][asg[fl[1]]]) e1++; }
        /* подписи построения (не ″ и ′) с той же буквой у вершины — тоже свидетельство (o.labels: копия часто без рёбер к S,
           но с подписями части точек вида; подписи не обязаны быть полными или верными по семейству) */
        let la=0; if(o.labels!==false) for(let k=0;k<4;k++) if(lab[asg[k]].has(NM[k])&&(k||asg[0]!==asg[1])) la++;
        if(fl?e1+la<fL||e3+la<fS:e3+la<oS||e1+la<oL) continue;
        nFit++; const f=projFit(PX,P0); if(!f||f.max>tol) continue; if(given(f.dir)){ asg.forEach(i=>gv.add(i)); continue; }
        found.push(Object.assign({pts:{A:P0[0].slice(0,2),B:P0[1].slice(0,2),C:P0[2].slice(0,2),S:P0[3].slice(0,2)},rms:f.rms,max:f.max,sup:e1,strong:e3,la,dir:f.dir,v:asg},classify(P0,data,o))); } } } }
  /* истинный вид основания тройкой (вращение: S не вращают): стороны = истинные длины, все три начерчены */
  const tl=[DX[0][1],DX[1][2],DX[2][0]], gp=(pts||[]).filter(q=>/[″′"']$/.test(String(q[0]).trim())).map(q=>[q[1],q[2]]);
  if(o.triples!==false) for(let a=0;a<N;a++) for(const b of adj[a]){ if(b===a||Math.abs(d2(V[a],V[b])-tl[0])>tol) continue;
    for(const c of adj[b]){ if(c===a||c===b||S[c][a]!==3||Math.abs(d2(V[b],V[c])-tl[1])>tol||Math.abs(d2(V[c],V[a])-tl[2])>tol) continue;
      const P=[V[a],V[b],V[c]]; if(gp.length&&P.every(p=>gp.some(g=>d2(g,p)<2))) continue;   /* заданная проекция, совпавшая с истинным видом */
      /* та же тройка уже в виде из четырёх точек — не повторяем */
      if(found.some(f=>f.v[0]===a&&f.v[1]===b&&f.v[2]===c)) continue;
      const e=Math.max(Math.abs(d2(V[a],V[b])-tl[0]),Math.abs(d2(V[b],V[c])-tl[1]),Math.abs(d2(V[c],V[a])-tl[2]));
      found.push({kind:'true',three:true,pts:{A:V[a].slice(0,2),B:V[b].slice(0,2),C:V[c].slice(0,2)},sides:P.map((p,i)=>d2(p,P[(i+1)%3])),rms:e,max:e,sup:3,v:[a,b,c]}); } }
  /* одно направление взгляда (± 3°, с точностью до знака) — один вид: оставляем лучший */
  /* цепочка замен: вид первой замены смотрит перпендикулярно z (новая плоскость ⟂ π₁) или y (⟂ π₂); вид второй — перпендикулярно
     взгляду какого-то вида первой замены из этого же чертежа. Направление взгляда случайной четвёрки — любое, так что это
     отсекает почти все совпадения (o.chain = false — не требовать; тройки истинного вида — вращение, к ним не относится) */
  const sA=Math.sin((o.dirTol||4)/DEG), f0=found.filter(f=>!f.v.some(i=>gv.has(i)));
  f0.forEach(f=>{ if(f.dir) f.level=Math.abs(f.dir[2])<sA||Math.abs(f.dir[1])<sA?1:0; });
  /* ребро AB точкой — только второй заменой (есть вид первой, ⟂ ему): у такого вида три разные точки, и «точкой» прикидывается
     любая вершина вида «основание ребром» (B₄ на прямой A₄B₄C₄ — под чужой вариант с той же парой расстояний: 4 из 120 на синтетике) */
  f0.forEach(f=>{ if(f.kind==='dih') f.level=0; });
  f0.forEach(f=>{ if(f.dir&&!f.level&&f0.some(g=>g!==f&&g.kind!=='dih'&&g.level===1&&!g.v.some(i=>f.v.includes(i))&&Math.abs(dot(f.dir,g.dir))<sA)) f.level=2; });
  const fin=f0.filter(f=>!f.dir||f.level||o.chain===false); fin.sort((p,q)=>p.max-q.max); const out=[];
  const cen=f=>{ const q=Object.values(f.pts); return [q.reduce((s,p)=>s+p[0],0)/q.length,q.reduce((s,p)=>s+p[1],0)/q.length]; };
  /* тот же вид — общие две вершины или то же направление взгляда (± 3°) на том же месте листа (центр ближе 8 мм) */
  fin.forEach(f=>{ if(out.some(g=>f.v.filter(i=>g.v.includes(i)).length>=2||f.dir&&g.dir&&Math.abs(dot(f.dir,g.dir))>Math.cos(3/DEG)&&d2(cen(f),cen(g))<8)) return; out.push(f); });
  out.stats={vertices:N,fits:nFit,ms:Date.now()-t0}; return out; }
const api={findViews,projFit,prepX,vertices,supportMatrix};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else { self.SCANVIEWS=api; }
})();
