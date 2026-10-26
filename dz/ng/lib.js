/* ═══════════ Начертательная геометрия · общие помощники разборов ДЗ ═══════════
   Числа считаются кодом, чертёж строится из тех же чисел. Пространство: x — влево от O, y — к зрителю, z — вверх (мм).
   Здесь — то, что нужно нескольким ДЗ: видимость рёбер многогранника (polyVis, compPts), прямые уровня плоскости
   (lvlLines), видимость прямой рядом с телом (lineVis), выбор плоскости-посредника γ ⊃ EF (gammaFor), замена плоскостей
   (newView), ступени подсказок шага (STEP: намёк → принцип → шаг → числа → проверка).
   Решения ДЗ (dz/ng/<номер>/solver.js) берут всё отсюда: const {…} = NGLIB. */
(function(){
/* ============================================================
   NG-HW · ядро: расчёты и помощники чертежа для ДЗ №1–5 (свои варианты)
   Всё решаем сами: числа считаются кодом (ниже), чертёж строится из тех же чисел.
   Пространство как в WBLIB: x — влево от O, y — к зрителю, z — вверх (мм).
   ============================================================ */
const HW = { calc:{}, tasks:{}, docs:{}, order:[], calcOf:{}, taskOf:{} };
const {F,H,P,v3,S,seg,pt,conn,txt,note,dim,sq,ang,tick,circ,ell,poly,curve,ln,vec,point,seg3,poly3,axis,G,nvOnH,nvOnF,table} = L;
const DEG = r => r*180/Math.PI;
const r1 = x => Math.round(x*10)/10;
const r2 = x => Math.round(x*100)/100;
const fmt = x => String(r1(x)).replace('.',',').replace('-','−');
const f2 = x => { const v=r2(x); return (v<0?'−':'')+String(Math.abs(v)).replace('.',','); };
const U = a => G.unit(a);
const D2 = (a,b) => G.dist(a,b);
const add2 = G.add, sub2 = G.sub, mul2 = G.mul;

/* угол между векторами, 0..180° */
const angV = (a,b) => DEG(Math.acos(Math.max(-1,Math.min(1,v3.dot(a,b)/(v3.len(a)*v3.len(b))))));
/* угол прямой (a→b) с плоскостью, заданной нормалью n */
const lineNormalAngle = (d,n) => DEG(Math.asin(Math.min(1,Math.abs(v3.dot(v3.unit(d),v3.unit(n))))));
const planeAngles = (A,B,C) => { const n=v3.unit(v3.normal(A,B,C));
  return {a1:DEG(Math.acos(Math.abs(n[2]))), a2:DEG(Math.acos(Math.abs(n[1]))), a3:DEG(Math.acos(Math.abs(n[0])))}; };

/* расстояние от точки до плоскости (ABC) */
const distPlane = (p,A,B,C) => Math.abs(v3.dot(v3.sub(p,A),v3.unit(v3.normal(A,B,C))));

/* ---- видимость рёбер выпуклого многогранника ----
   verts: {имя:[x,y,z]}, faces: [[имена...]...]. Вид спереди: наблюдатель на +y, сверху: на +z. */
function polyVis(verts,faces){
  const names=Object.keys(verts), c=[0,0,0];
  names.forEach(n=>{ c[0]+=verts[n][0]/names.length; c[1]+=verts[n][1]/names.length; c[2]+=verts[n][2]/names.length; });
  const fv=faces.map(f=>{ let n=v3.normal(verts[f[0]],verts[f[1]],verts[f[2]]);
    if(v3.dot(n,v3.sub(verts[f[0]],c))<0) n=v3.mul(n,-1); return {f,visF:n[1]>1e-9,visH:n[2]>1e-9}; });
  const edges={};
  fv.forEach(o=>{ for(let i=0;i<o.f.length;i++){ const a=o.f[i], b=o.f[(i+1)%o.f.length], k=[a,b].sort().join('');
    const e=edges[k]||(edges[k]={a,b,visF:false,visH:false}); e.visF=e.visF||o.visF; e.visH=e.visH||o.visH; } });
  return Object.values(edges);
}
/* рёбра в виде items; k — вид линии видимого ('main'|'res'|'grn'), невидимое — штриховое */
function edgeItems(verts,edges,k,only){
  const hid={main:'hid',res:'resd',grn:'grnd',aux:'auxd'}[k]||'hid', out=[]; only=only||'12';
  edges.forEach(e=>{ const a=verts[e.a], b=verts[e.b];
    if(only.includes('2')) out.push(seg(F(a),F(b),e.visF?k:hid));
    if(only.includes('1')) out.push(seg(H(a),H(b),e.visH?k:hid)); });
  return out;
}

/* стороны основания из условия нарисованы сплошными; если на ответе ребро невидимо — сначала стираем линию условия
   («ластик» цвета бумаги, концы чуть короче — точки в вершинах остаются), потом поверх ляжет штриховая */
const rub=(a,b)=>{ const d=U(sub2(b,a)), e=3.5; return seg(add2(a,mul2(d,e)),sub2(b,mul2(d,e)),'paper'); };
function hideGiven(verts,edges,base){ const out=[];
  edges.filter(e=>base.includes(e.a)&&base.includes(e.b)).forEach(e=>{ const a=verts[e.a], b=verts[e.b];
    if(!e.visF) out.push(rub(F(a),F(b))); if(!e.visH) out.push(rub(H(a),H(b))); });
  return out;
}
/* видимость по конкурирующим точкам — как принято в курсе (например: 5 ∈ AB, 6 ∈ A₁C₁, 5″ ≡ 6″, y₆ > y₅ ⇒ A₁C₁ закрывает AB на π₂).
   view 'F' — фронтально конкурирующие (одна точка на π₂, сравниваем y), 'H' — горизонтально (одна точка на π₁, сравниваем z).
   Ищем пару рёбер без общих вершин — видимое и невидимое, — проекции которых пересекаются подальше от концов.
   nb — номер точки на невидимом ребре, nf — на видимом. Возвращает {items, text} или null. */
function compPts(V,edges,view,nb,nf,la){
  const pr=view==='F'?F:H, vis=e=>view==='F'?e.visF:e.visH, cr=(p,q)=>p[0]*q[1]-p[1]*q[0];
  let best=null;
  edges.filter(vis).forEach(e=>edges.filter(g=>!vis(g)).forEach(g=>{ if([e.a,e.b].some(n=>n===g.a||n===g.b)) return;
    const a=pr(V[e.a]), r=sub2(pr(V[e.b]),a), c=pr(V[g.a]), s=sub2(pr(V[g.b]),c), den=cr(r,s); if(Math.abs(den)<1e-9) return;
    const q=sub2(c,a), t=cr(q,s)/den, u=cr(q,r)/den, m=Math.min(t,1-t,u,1-u); if(m<0.05) return;
    if(!best||m>best.m) best={m,e,g,t,u}; }));
  const pi=view==='F'?'π₂':'π₁';
  if(!best) return edges.some(e=>!vis(e))?null:{items:[],text:`На ${pi} невидимых рёбер нет.`};
  const {e,g,t,u}=best, Pf=v3.lerp(V[e.a],V[e.b],t), Pb=v3.lerp(V[g.a],V[g.b],u);
  /* имя ребра как принято в курсе: S первой, затем по алфавиту, A раньше A₁ */
  const rk=n=>(n[0]==='S'?'0':'1')+n, nm=(a,b,m)=>{ const [x,y]=rk(a)<=rk(b)?[a,b]:[b,a]; return x+(m||'')+y+(m||''); };
  const k=view==='F'?1:2, c=view==='F'?'y':'z', m1=view==='F'?'″':'′', m2=view==='F'?'′':'″', ef=nm(e.a,e.b), eb=nm(g.a,g.b), ebm=nm(g.a,g.b,m1);
  const at=pr(Pf), o1=view==='F'?H:F;
  const items=[ conn(at,o1(Pb)), conn(at,o1(Pf)), pt(at,nb+m1+'≡'+nf+m1,(la&&la[0])||'ne','aux'), pt(o1(Pb),nb+m2,(la&&la[1])||'w','aux'), pt(o1(Pf),nf+m2,(la&&la[2])||'e','aux') ];
  const text=`${nb} ∈ ${eb} и ${nf} ∈ ${ef}: ${nb}${m1} ≡ ${nf}${m1} — ${view==='F'?'фронтально':'горизонтально'} конкурирующие. ${c}<sub>${nf}</sub> = ${fmt(Pf[k])} > ${c}<sub>${nb}</sub> = ${fmt(Pb[k])}: точка ${nf} ${view==='F'?'ближе к наблюдателю':'выше'}, значит ${ef} закрывает ${eb} на ${pi} — ${ebm} штрихом.`;
  return {items,text,Pf,Pb,ef,eb};
}
/* ---- подсказки-лесенка: намёк → принцип → шаг → полный разбор ---- */
function ladder(o){
  const blk=(cls,ttl,body,open)=>body?`<details class="hw-l ${cls}"${open?' open':''}><summary>${ttl}</summary><div>${body}</div></details>`:'';
  const step=o.step&&o.rec?o.step+`<div class="hw-rec"><b>Запись:</b> ${o.rec}</div>`:o.step;
  return `<div class="hw-ladder">${blk('l1','1 · Намёк',o.hint)}${blk('l2','2 · Принцип',o.principle)}${blk('l3','3 · Шаг',step,true)}${blk('l4','4 · Полный разбор (числа)',o.full)}${blk('l5','5 · Проверь себя',o.check)}</div>`;
}
/* шаг плеера: t — заголовок, o — {hint,principle,step,full}, add — элементы чертежа */
const STEP = (t,o,add) => ({ t, d:'', why:'', tbl:ladder(o), add:add||[] });

/* ---- преобразование чертежа (2D, в плоскости чертежа) ----
   Новая ось: точка O (на оси), единичный e вдоль оси, nrm — единичная нормаль в сторону исходного вида.
   Изображение в новом виде: O + e·t − nrm·dep,  t=(pos−O)·e,  dep — расстояние до предыдущей плоскости (ед. чертежа). */
const dot2 = (a,b)=>a[0]*b[0]+a[1]*b[1];
function newView(O,e,nrm){
  return { O,e,nrm,
    t:pos=>dot2(sub2(pos,O),e),
    s:pos=>dot2(sub2(pos,O),nrm),          // расстояние до новой оси со стороны исходного вида
    at:(t,dep)=>add2(add2(O,mul2(e,t)),mul2(nrm,-dep)),
    img:(pos,dep)=>add2(add2(O,mul2(e,dot2(sub2(pos,O),e))),mul2(nrm,-dep)) };
}
/* линия связи, перпендикулярная оси, от pos до образа q */
const connect = (a,b)=>conn(a,b);

/* подпись-вектор длины L вдоль отрезка */
const along = (a,b,len)=>G.along(a,a,b,len);


/* ДЗ №2 · остальные типы: призма (равнобедренное основание, A на EF), куб (B на EF, AD на AK).
   Общие помощники: прямые уровня плоскости по трём точкам; видимость прямой рядом с выпуклым телом. */

/* горизонталь и фронталь плоскости (P,Q,R): через вершину со средней z (y) к точке на противоположной стороне */
function lvlLines(V,names){
  const pick=i=>{ const s=names.slice().sort((a,b)=>V[a][i]-V[b][i]), m=s[1], u=V[s[0]], w=V[s[2]];
    return {from:m, on:[s[0],s[2]], p:V[m], q:v3.lerp(u,w,(V[m][i]-u[i])/(w[i]-u[i]))}; };
  return {h:pick(2), f:pick(1)};
}
/* участки отрезка PQ, закрытые гранями (многоугольники в пространстве) от наблюдателя: спереди он на +y, сверху — на +z */
function hidSpans(P,Q,polys,view){
  const v=view==='F'?[0,1,0]:[0,0,1];
  const pl=polys.map(p=>{ const n=v3.normal(p[0],p[1],p[2]); return {p,n}; });
  const hitPoly=(x,o)=>{ const den=v3.dot(o.n,v); if(Math.abs(den)<1e-9) return false; const s=v3.dot(o.n,v3.sub(o.p[0],x))/den; if(s<1e-3) return false;
    const y=v3.add(x,v3.mul(v,s)), k=view==='F'?[0,2]:[0,1]; let sg=0;            /* точка внутри выпуклого многоугольника — по проекции на плоскость вида */
    for(let i=0;i<o.p.length;i++){ const a=o.p[i], b=o.p[(i+1)%o.p.length]; const c=(b[k[0]]-a[k[0]])*(y[k[1]]-a[k[1]])-(b[k[1]]-a[k[1]])*(y[k[0]]-a[k[0]]);
      if(Math.abs(c)<1e-6) return false; const t=Math.sign(c); if(sg&&t!==sg) return false; sg=t; } return true; };
  const hidden=x=>pl.some(o=>hitPoly(x,o));
  const N=400, out=[]; let prev=hidden(P), t0=0;
  for(let i=1;i<=N;i++){ const t=i/N, h=hidden(v3.lerp(P,Q,t)); if(h!==prev||i===N){
      let a=(i-1)/N, b=t; if(h!==prev) for(let k=0;k<30;k++){ const m=(a+b)/2; if(hidden(v3.lerp(P,Q,m))===prev) a=m; else b=m; }
      const te=(h!==prev)?(a+b)/2:1; if(prev) out.push([t0,te]); t0=te; prev=h; } }
  return out;
}
/* прямая условия, частично закрытая гранями: стираем сплошную на закрытых участках и проводим штриховую */
function lineVis(P,Q,polys){ const out=[];
  [['F',F],['H',H]].forEach(([vw,pr])=>hidSpans(P,Q,polys,vw).forEach(([a,b])=>{ const p=v3.lerp(P,Q,a), q=v3.lerp(P,Q,b);
    if(D2(pr(p),pr(q))<4) return; out.push(rub(pr(p),pr(q)), seg(pr(p),pr(q),'hid')); }));
  return out; }
/* прямая через несколько точек одной проекции (ℓ″ через 1″, 2″ и найденную точку): от крайней до крайней */
const lThru=(ps,l)=>{ let a=ps[0],b=ps[1],m=-1; ps.forEach(p=>ps.forEach(q=>{ const d=D2(p,q); if(d>m){ m=d; a=p; b=q; } })); return ln(a,b,'aux',l,'w',10,10); };
/* плоскость-посредник γ ⊃ EF для точки EF ∩ (плоскость, заданная двумя прямыми уровня lines = [{p,d},{p,d}]).
   Правило: γ ⟂ π₁ (след h₀γ ≡ E′F′), как в методике. Но если одна из прямых уровня ей параллельна или почти
   параллельна (угол меньше 8°: так бывает, когда EF — фронталь), точку на ней не получить — тогда γ ⟂ π₂ (f₀γ ≡ E″F″).
   Возвращает {pl:1|2, n — нормаль γ, P — точки γ ∩ прямых уровня, why — почему не π₁}. */
function gammaFor(E,Fp,lines){ const dE=v3.sub(Fp,E);
  const opt=pl=>{ const n=v3.cross(dE,pl===1?[0,0,1]:[0,1,0]); if(v3.len(n)<1e-9) return null; const nn=v3.unit(n);
    const q=Math.min(...lines.map(L=>Math.abs(v3.dot(nn,v3.unit(L.d))))); if(q<1e-6) return {pl,n:nn,q,P:null};
    return {pl,n:nn,q,P:lines.map(L=>v3.linePlane(L.p,v3.add(L.p,L.d),E,nn))}; };
  const a=opt(1), b=opt(2);
  if(a&&a.P&&(a.q>=0.14||!(b&&b.P&&b.q>a.q))) return Object.assign(a,{why:''});
  const fr=Math.abs(dE[1])<1e-9;
  return Object.assign(b,{why:fr?'EF — фронталь (y<sub>E</sub> = y<sub>F</sub>), горизонтально-проецирующая плоскость через неё сама фронтальная — фронталь искомой плоскости ей параллельна, и общей точки с ней нет':'горизонтально-проецирующая плоскость через EF почти параллельна одной из прямых уровня — точка пересечения ушла бы далеко за лист'}); }
/* тексты шага с посредником: o = {X — искомая точка, a, b — номера точек, la, lb — прямые уровня вида 'h<sub>β</sub>'} */
function gamTxt(g,o){ const p=g.pl===1, m1=p?'′':'″', m2=p?'″':'′', pi=p?'π₁':'π₂', tr=p?'h<sub>0γ</sub>':'f<sub>0γ</sub>', lv=(l,m)=>l.replace('<sub>',m+'<sub>');
  return { title:'γ ⟂ '+pi, pi, tr, m1, m2,
    set:`Заключаем EF в плоскость γ ⟂ ${pi}, задавая её следом ${tr} ≡ E${m1}F${m1}.`+(p?'':` <i>Почему γ ⟂ π₂, а не ⟂ π₁:</i> ${g.why}.`),
    pts:`${o.a}${m1} = E${m1}F${m1} ∩ ${lv(o.la,m1)}, ${o.b}${m1} = E${m1}F${m1} ∩ ${lv(o.lb,m1)}; ${o.a}${m2} — на ${lv(o.la,m2)}, ${o.b}${m2} — на ${lv(o.lb,m2)} по линиям связи.`,
    line:`ℓ${m1} ≡ ${tr} ≡ E${m1}F${m1}; ℓ${m2} проводим через ${o.a}${m2} и ${o.b}${m2}. <b>${o.X}${m2} = ℓ${m2} ∩ E${m2}F${m2}</b>, ${o.X}${m1} — на E${m1}F${m1} по линии связи.` }; }
/* чертёж посредника: след γ и линия ℓ через точки a, b и искомую X */
function gamTrace(g,E,Fp){ return g.pl===1?ln(H(E),H(Fp),'aux','h₀γ','e',10,10):ln(F(E),F(Fp),'aux','f₀γ','e',10,10); }
function gamLine(g,ps){ const q=ps.map(g.pl===1?F:H); let a=q[0],b=q[1],m=-1; q.forEach(p=>q.forEach(r=>{ const d=D2(p,r); if(d>m){ m=d; a=p; b=r; } })); return ln(a,b,'aux',g.pl===1?'ℓ″':'ℓ′','w',10,10); }
function gamCross(g,P,Q,E,Fp){ const pr=g.pl===1?F:H; return G.cross(pr(P),pr(Q),pr(E),pr(Fp)); }
const facesOf=(V,faces)=>faces.map(f=>f.map(n=>V[n]));
const prismFaces=[['A','B','C'],['A₁','B₁','C₁'],['A','B','B₁','A₁'],['B','C','C₁','B₁'],['C','A','A₁','C₁']];


/* ---- векторы в пространстве (мм) — для сертификатов: условие задачи на найденном ответе ---- */
const vu=(()=>{ const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const len=a=>Math.hypot(a[0],a[1],a[2]), dist=(a,b)=>len(sub(a,b)), unit=a=>mul(a,1/len(a));
  const offLine=(P,A,B)=>len(cross(sub(P,A),sub(B,A)))/dist(A,B);
  const plDist=(P,A,B,C)=>{ const n=cross(sub(B,A),sub(C,A)); return Math.abs(dot(sub(P,A),n))/len(n); };
  const deg=r=>r*180/Math.PI, near=(a,b,tol)=>Math.abs(a-b)<=(tol||1e-6);
  return {sub,add,mul,dot,cross,len,dist,unit,offLine,plDist,deg,near}; })();

/* таблица данных варианта — строка на точку (её читают и проверки) */
const dataTable=(D,names)=>table(['','x','y','z'],names.map(n=>[n,...D[n]]));

/* разбор варианта программой примера: HW.calcOf[key] (числа) → HW.taskOf[key] (шаги и чертёж) на данных D.
   Пример сайта при этом не меняется (HW.calc[key] восстанавливается). */
function onVariant(key,n,D,src,d){ const old=HW.calc[key]; let calc,task;
  try{ calc=HW.calc[key]=HW.calcOf[key](D); task=HW.taskOf[key](); } finally{ HW.calc[key]=old; }
  try{ WB3.ruDec(task); WB3.snap(task); }catch(e){}
  task.n=d.label+' · вариант '+n; task.q='<b>'+task.n+'.</b> '+src.text(n);
  task.intro='Данные — из таблицы задания, вариант '+n+'. Каждое число на чертеже и в тексте посчитано по этим данным; ответ проверен условием задачи.';
  return {calc,task}; }


self.NGLIB={vu, dataTable, onVariant, HW, F, H, P, v3, S, seg, pt, conn, txt, note, dim, sq, ang, tick, circ, ell, poly, curve, ln, vec, point, seg3, poly3, axis, G, nvOnH, nvOnF, table, DEG, r1, r2, fmt, f2, U, D2, add2, sub2, mul2, angV, lineNormalAngle, planeAngles, distPlane, polyVis, edgeItems, rub, hideGiven, compPts, ladder, STEP, dot2, newView, connect, along, lvlLines, hidSpans, lineVis, lThru, gammaFor, gamTxt, gamTrace, gamLine, gamCross, facesOf, prismFaces};
})();
