/* ═══════════ «Евклид»: проверка построимости чертежа ═══════════
   Чертёж — это доказательство: каждый новый элемент должен получаться из уже построенных теми действиями,
   которые есть у чертёжника, — линейкой и циркулем. Проверка переводит рисунок в числа и проверяет каждое действие счётом:
     прямая   — через две известные точки; или через одну известную точку ∥ / ⟂ уже построенной прямой (в том числе
                оси x — горизонтальные и вертикальные линии связи); новая ось проекций — ∥ / ⟂ построенной прямой;
     точка    — пересечение двух построенных линий (прямая, окружность); или точка на построенной линии на известном
                расстоянии от известной точки или оси (перенос циркулем: длина нарисованного отрезка, координата точки,
                длина из условия);
     окружность, дуга — центр известен, радиус — длина, которую можно взять циркулем, или окружность проходит через
                известную точку;
     ⊾ (знак прямого угла) — угол действительно 90°; подпись угла с числом — это число и есть измеренный угол.
   «Дано» — аксиомы. Известные точки — подписанные точки, концы данных отрезков и пересечения уже построенных линий.
   Всё, что не выводится, — «взялось ниоткуда»: подогнанная точка, вспомогательная линия не в ту сторону, дуга не из того
   центра. Ровно эти ошибки не видны 3D-проверке (вспомогательные линии, дуги, точки без подписи).
   EUCLID_CHECK({tasks, extra}) → [{name, rule, msg, lvl}]. */
(function(){
const TP=0.012;                /* инцидентность, ед. чертежа (≈ 0,004 мм): чертежи посчитаны, а не нарисованы */
const TL=0.008;                /* равенство длин при переносе циркулем */
const TA=4e-5;                 /* ∥ и ⟂: |sin| угла */
const strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').trim();
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mul=(a,k)=>[a[0]*k,a[1]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1], crs=(a,b)=>a[0]*b[1]-a[1]*b[0], len=a=>Math.hypot(a[0],a[1]), d2=(a,b)=>len(sub(a,b));
const unit=a=>{ const l=len(a)||1; return [a[0]/l,a[1]/l]; };
const fin=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
const carrier=(a,b,src)=>({p:a,d:unit(sub(b,a)),a,b,src});
const offC=(p,c)=>Math.abs(crs(sub(p,c.p),c.d));
const meetCC=(c1,c2)=>{ const den=crs(c1.d,c2.d); if(Math.abs(den)<TA) return null; const t=crs(sub(c2.p,c1.p),c2.d)/den; return add(c1.p,mul(c1.d,t)); };
const meetCirc=(c,o)=>{ const w=sub(c.p,o.c), b=dot(w,c.d), q=dot(w,w)-o.r*o.r, D=b*b-q; if(D<-1e-6) return []; const s=Math.sqrt(Math.max(0,D)); return [add(c.p,mul(c.d,-b-s)),add(c.p,mul(c.d,-b+s))]; };
const meetOO=(a,b)=>{ const d=d2(a.c,b.c); if(d<1e-9||d>a.r+b.r+1e-6||d<Math.abs(a.r-b.r)-1e-6) return []; const x=(d*d+a.r*a.r-b.r*b.r)/(2*d), h=Math.sqrt(Math.max(0,a.r*a.r-x*x)), u=unit(sub(b.c,a.c)), m=add(a.c,mul(u,x)), v=[-u[1],u[0]]; return [add(m,mul(v,h)),add(m,mul(v,-h))]; };
/* дуга, нарисованная ломаной: все вершины на одном расстоянии от центра (центр — по трём точкам) */
function arcOf(ps){ if(!ps||ps.length<7) return null; const a=ps[0], b=ps[Math.floor(ps.length/2)], c=ps[ps.length-1];
  const D=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1])); if(Math.abs(D)<1e-9) return null;
  const s=p=>p[0]*p[0]+p[1]*p[1], cx=(s(a)*(b[1]-c[1])+s(b)*(c[1]-a[1])+s(c)*(a[1]-b[1]))/D, cy=(s(a)*(c[0]-b[0])+s(b)*(a[0]-c[0])+s(c)*(b[0]-a[0]))/D, r=Math.hypot(a[0]-cx,a[1]-cy);
  return ps.every(p=>Math.abs(Math.hypot(p[0]-cx,p[1]-cy)-r)<TP*2)?{c:[cx,cy],r}:null; }

/* разобрать элемент чертежа на «действия» */
function acts(it){ const out=[]; if(!it||it._euclidSkip) return out;
  const C=(a,b)=>{ if(fin(a)&&fin(b)&&d2(a,b)>1) out.push({kind:'line',c:carrier(a,b,it),it}); };
  if((it.t==='seg'||it.t==='line'||it.t==='vec')&&it.k!=='paper') C(it.a,it.b);
  else if(it.t==='conn'){ if(it.p) for(let i=1;i<it.p.length;i++) C(it.p[i-1],it.p[i]); else C(it.a,it.b); }
  else if(it.t==='poly'&&Array.isArray(it.p)){ const o=arcOf(it.p); if(o) out.push({kind:'circ',o,ends:[it.p[0],it.p[it.p.length-1]],it});
    else if(it.p.length<=6){ for(let i=1;i<it.p.length;i++) C(it.p[i-1],it.p[i]); if(it.close) C(it.p[it.p.length-1],it.p[0]); }
    else if(it.p.every(fin)) out.push({kind:'curve',ps:it.close?it.p.concat([it.p[0]]):it.p.slice(),it}); }
  else if(it.t==='curve'&&Array.isArray(it.p)&&it.p.length>1&&it.p.every(fin)) out.push({kind:'curve',ps:it.p.slice(),it});
  else if(it.t==='ell'&&fin(it.c)&&it.rx>0&&it.ry>0){ const r=(it.rot||0)*Math.PI/180, cr=Math.cos(r), sr=Math.sin(r), ps=[]; for(let i=0;i<=96;i++){ const a=i/96*2*Math.PI, x=Math.cos(a)*it.rx, y=Math.sin(a)*it.ry; ps.push([it.c[0]+x*cr-y*sr,it.c[1]+x*sr+y*cr]); } out.push({kind:'curve',ps,it,ell:true}); }
  else if((it.t==='circ'||it.t==='arc')&&fin(it.c)&&it.r>0.5) out.push({kind:'circ',o:{c:it.c,r:it.r},it});
  else if(it.t==='pt'&&fin(it.at)) out.push({kind:'pt',p:it.at,it});
  else if(it.t==='sq'&&fin(it.at)&&fin(it.p1)&&fin(it.p2)) out.push({kind:'sq',it});
  else if(it.t==='ang'&&fin(it.at)&&fin(it.p1)&&fin(it.p2)) out.push({kind:'ang',it});
  return out; }

const isAxisLabel=l=>/^x[₀-₉0-9]*$/.test(strip(l));
const SC=()=>(window.L&&L.S)||3.2;

function audit(name,part,out,textAll,condText){
  const stages=[part.given||[]].concat((part.steps||[]).map(s=>s.add||[]));
  const stText=[''].concat((part.steps||[]).map(s=>strip([s.t,s.d,s.why,s.tbl].join(' '))));
  const K=[], lines=[], circs=[], lens=new Set();
  /* у известной точки помнится поле: 1 — π₁ (A′), 2 — π₂ (A″), 3 — π₃ (A‴), 0 — не подписана */
  const fieldOf=l=>{ l=strip(l); const f=[/‴/.test(l)?3:0,/″/.test(l)?2:0,/′/.test(l)?1:0].filter(Boolean); return f.length===1?f[0]:0; };   /* «A″≡A′» — точка на оси, общая для полей */
  const addK=(p,f)=>{ if(!fin(p)) return; const q=K.find(q=>d2(p,q)<TP); if(q){ if(!q._f&&f) q._f=f; return; } const r=[p[0],p[1]]; r._f=f||0; K.push(r); };
  const known=p=>K.some(q=>d2(p,q)<TP);
  const S=SC();
  /* длины из условия и шагов: «80 мм», «|AB| = 52 мм» — их можно отложить циркулем (по масштабу чертежа) */
  const mmLens=[]; String(condText||'').replace(/(\d+(?:[.,]\d+)?)\s*мм/g,(m,v)=>{ mmLens.push(+v.replace(',','.')); return m; });
  /* масштабы: у задач чертёж бывает увеличен (×1,1 … ×1,5) — длины из текста переводятся во всех масштабах сайта */
  const scales=[1,1.1,1.2,1.25,1.3,1.4,1.5,1.6,1.8,2].map(k=>k*S);
  /* координаты из условия: «A(20; 30; 40)», таблица данных — по ним точку строят от начала координат на оси x */
  const coords=new Set([0]); String(textAll||'').replace(/\(([^()]{3,60})\)/g,(m,b)=>{ if(/;/.test(b)) b.split(';').forEach(v=>{ const x=+String(v).trim().replace('−','-').replace(',','.'); if(Number.isFinite(x)) coords.add(Math.abs(x)); }); return m; });
  String(textAll||'').replace(/<td>\s*(−?-?\d+(?:[.,]\d+)?)\s*<\/td>/g,(m,v)=>{ coords.add(Math.abs(+v.replace('−','-').replace(',','.'))); return m; });
  const angs=[30,45,60]; String(textAll||'').replace(/(\d+(?:[.,]\d+)?)\s*°/g,(m,v)=>{ const x=+v.replace(',','.'); angs.push(x,90-x,180-x); return m; });
  /* уровни, названные в тексте: «плоскости z = 58, 44, 30», «y = 25» — по ним проводят линии уровня */
  const levels=new Set(); String(textAll||'').replace(/[zyx]\s*=\s*((?:−?-?\d+(?:[.,]\d+)?(?:\s*(?:,|и)\s*)?)+)/g,(m,list)=>{ list.split(/\s*(?:,(?!\d)|и)\s*/).forEach(v=>{ const x=+String(v).trim().replace('−','-').replace(',','.'); if(Number.isFinite(x)) levels.add(Math.abs(x)); }); return m; });
  const levelKnown=v=>{ for(const c of levels) for(const k of scales) if(Math.abs(c*k-v)<TL) return true; return false; };
  const coordKnown=v=>{ for(const c of coords) for(const k of scales) if(Math.abs(c*k-v)<TL) return true; return false; };
  const lenKnown=(v,ctx)=>{ if(v<0.5) return false; for(const L of lens) if(Math.abs(L-v)<TL) return true;
    for(const m of mmLens) for(const k of scales) if(Math.abs(m*k-v)<TL) return true; return false; };
  /* поле линии: у подписанной — по подписи, иначе — по известным точкам на ней (все одного поля); у линии связи — нет */
  const lineField=c=>{ if(c.src&&(c.src.t==='conn'||c.src.t==='axis'||c.src.t==='axis3')) return 0; const fl=fieldOf(c.src&&c.src.l); if(fl) return fl;
    if(!c.a||!c.b) return 0; const L2=dot(sub(c.b,c.a),sub(c.b,c.a)), inSeg=p=>{ const t=dot(sub(p,c.a),sub(c.b,c.a))/L2; return t>-0.01&&t<1.01; };
    const fs=[...new Set(K.filter(p=>offC(p,c)<TP&&p._f&&inSeg(p)).map(p=>p._f))]; return fs.length===1?fs[0]:0; };   /* только точки на нарисованном участке */
  const addLines=c=>{ c._f=lineField(c); (typeof curves!=='undefined'?curves:[]).forEach(cv=>meetCurve(c,cv).forEach(p=>addK(p))); lines.forEach(o=>{ const X=meetCC(c,o); if(X&&Math.abs(X[0])<5e3&&Math.abs(X[1])<5e3) addK(X,c._f&&c._f===o._f?c._f:0); }); circs.forEach(o=>meetCirc(c,o).forEach(p=>addK(p))); lines.push(c); };
  /* кривые (очерки поверхностей, эллипсы, линии пересечения): точка на кривой — с допуском хорды ломаной */
  const TC=0.6, curves=[];
  const offCurve=(p,cv)=>{ let m=1e9; for(let i=1;i<cv.ps.length;i++){ const a=cv.ps[i-1], b=cv.ps[i], d=sub(b,a), L=dot(d,d); if(L<1e-12) continue; let t=dot(sub(p,a),d)/L; t=Math.max(0,Math.min(1,t)); m=Math.min(m,d2(p,add(a,mul(d,t)))); } return m; };
  const meetCurve=(c,cv)=>{ const out=[]; for(let i=1;i<cv.ps.length;i++){ const a=cv.ps[i-1], b=cv.ps[i]; const sa=crs(c.d,sub(a,c.p)), sb=crs(c.d,sub(b,c.p)); if(sa*sb>0||(sa===0&&sb===0)) continue; const t=sa/(sa-sb); out.push(add(a,mul(sub(b,a),t))); } return out; };
  const addCurve=cv=>{ lines.forEach(c=>meetCurve(c,cv).forEach(p=>addK(p))); curves.push(cv); cv.ps.forEach(p=>{ if(known(p)) return; }); };
  const addCirc=o=>{ lines.forEach(c=>meetCirc(c,o).forEach(p=>addK(p))); circs.forEach(q=>meetOO(o,q).forEach(p=>addK(p))); circs.push(o); addK(o.c); };
  /* длины, которые берут циркулем: отрезки между известными точками, нарисованные отрезки, расстояния известных точек до осей */
  const noteLens=()=>{ };
  const axisLines=[], segs=[], ratios=[], labPts=[], drawn=[];
  /* разность координат двух подписанных точек одного поля (катет Δz, Δy) — берётся циркулем между линиями уровня */
  const labNames=[];
  const notePt=a=>{ const l=strip(a.it.l); if(!l) return; labNames.push({p:a.p,l}); const f=/″/.test(l)?2:/′/.test(l)?1:0; if(!f) return;
    labPts.forEach(o=>{ if(o.f===f){ lens.add(Math.abs(o.p[1]-a.p[1])); lens.add(Math.abs(o.p[0]-a.p[0])); } }); labPts.push({p:a.p,f}); };
  const FREE=/произвольн|любую|любой|любая|любом|в любом месте|удобн/i;
  /* отношения деления на нарисованных отрезках: t известной точки между концами */
  const noteRatio=(a,b)=>{ const L=d2(a,b); if(L<2) return; K.forEach(q=>{ const c=carrier(a,b); if(offC(q,c)>=TP) return; const t=dot(sub(q,a),sub(b,a))/(L*L); if(t>0.02&&t<0.98) ratios.push(t,1-t); }); };
  stages.forEach((arr,si)=>{
    const A=[]; arr.forEach(it=>acts(it).forEach(a=>A.push(a)));
    /* ось, подписанная отдельным текстом у конца отрезка («x₁₄» рядом) — тоже ось */
    arr.filter(it=>it&&it.t==='txt'&&isAxisLabel(it.s)&&fin(it.at)).forEach(tx=>A.forEach(a=>{ if(a.kind==='line'&&(d2(a.c.a,tx.at)<TP||d2(a.c.b,tx.at)<TP)) a.c.src=Object.assign({},a.c.src,{l:strip(tx.s)}); }));
    if(si===0){   /* «дано» — аксиомы */
      if(arr.some(it=>it&&it.t==='axis')){ const c={p:[0,0],d:[1,0],src:{t:'axis'}}; addLines(c); axisLines.push(c); }
      if(arr.some(it=>it&&it.t==='axis3')){ [[1,0],[0,1]].forEach(d=>{ const c={p:[0,0],d,src:{t:'axis3'}}; addLines(c); axisLines.push(c); }); }
      A.forEach(a=>{ if(a.kind==='pt'){ addK(a.p,fieldOf(a.it.l)); notePt(a); } });
      A.forEach(a=>{ if(a.kind==='line'){ const f=fieldOf(a.c.src&&a.c.src.l); addK(a.c.a,f); addK(a.c.b,f); } });
      A.forEach(a=>{ if(a.kind==='line') addLines(a.c); if(a.kind==='circ'){ addCirc(a.o); lens.add(a.o.r); lens.add(2*a.o.r); } if(a.kind==='curve') addCurve(a); });
      A.forEach(a=>{ if(a.kind==='line'){ drawn.push(a.c); lens.add(d2(a.c.a,a.c.b)); segs.push([a.c.a,a.c.b]); } });
      A.forEach(a=>{ if(a.kind==='line') noteRatio(a.c.a,a.c.b); });
      K.forEach(p=>axisLines.forEach(x=>lens.add(offC(p,x))));
      return; }
    /* стадия шага: элементы, которые не удаётся вывести сразу, ждут — их может обосновать элемент того же шага */
    if(arr.some(it=>it&&it.t==='axis')&&!axisLines.length){ const c={p:[0,0],d:[1,0],src:{t:'axis'}}; addLines(c); axisLines.push(c); }
    let pend=A.filter(a=>a.kind==='line'||a.kind==='circ'||a.kind==='pt'||a.kind==='curve'), changed=true; const labCount0=labPts.length;
    const thru=c=>K.filter(p=>offC(p,c)<TP); if(window.__EUDBG&&name===window.__EUDBG[0]&&si===window.__EUDBG[1]) window.__EUK=K.map(p=>[p[0],p[1],p._f]);
    /* прямая через две известные точки — только если они одного поля: «прямая» A″–1′ соединяет разные чертежи (это не построение);
       поля соединяет только линия связи */
    const onAx=p=>axisLines.some(x=>offC(p,x)<TP);   /* точка на оси — общая для полей */
    const cross=(p,q)=>p._f&&q._f&&p._f!==q._f&&!onAx(p)&&!onAx(q);
    const okLine=c=>{ const r=okLine0(c); if(r&&window.__EUWHY) __EUWHY.push(name+' ш'+si+' '+strip(c.src&&c.src.l||'')+' ['+c.a.map(v=>v.toFixed(1))+'→'+c.b.map(v=>v.toFixed(1))+'] '+r); return !!r; };
    const okLine0=c=>{ const P=thru(c), link=c.src&&c.src.t==='conn'; if(P.length>=2&&P.some(p=>P.some(q=>d2(p,q)>1&&(link||!cross(p,q))))) return 'две точки';
      const dirOk=lines.some(o=>Math.abs(crs(o.d,c.d))<TA||Math.abs(dot(o.d,c.d))<TA)||Math.abs(c.d[0])<TA||Math.abs(c.d[1])<TA;
      if(P.length>=1&&dirOk) return 'точка и направление';
      /* параллельная построенной прямой на известном расстоянии (откладывают циркулем по перпендикуляру) */
      if(lines.some(o=>Math.abs(crs(o.d,c.d))<TA&&lenKnown(offC(o.p,c)))) return 'параллель на расстоянии';
      /* серединный перпендикуляр к нарисованному отрезку (середина строится циркулем) */
      if(segs.some(([a,b])=>{ const m=mul(add(a,b),0.5); return d2(a,b)>2&&offC(m,c)<TP&&Math.abs(dot(unit(sub(b,a)),c.d))<TA*5; })) return 'серединный перпендикуляр';
      /* биссектриса угла между двумя построенными прямыми, сходящимися в известной точке */
      if(P.some(q=>{ const Ls=lines.filter(o=>offC(q,o)<TP); for(let i=0;i<Ls.length;i++) for(let j=i+1;j<Ls.length;j++){ const u=Ls[i].d, v=Ls[j].d; if(Math.abs(crs(u,v))<1e-3) continue;
          const b1=unit(add(u,v)), b2=unit(sub(u,v)); if(Math.abs(crs(b1,c.d))<TA*5||Math.abs(crs(b2,c.d))<TA*5) return true; } return false; })) return 'биссектриса';
      /* через известную точку под заданным углом к построенной прямой (угол из условия или шагов, 30°/45°/60°) */
      if(P.length>=1&&lines.some(o=>{ const g=Math.acos(Math.min(1,Math.abs(dot(o.d,c.d))))*180/Math.PI; return angs.some(v=>Math.abs(v-g)<0.005); })) return 'угол';
      if(isAxisLabel(c.src&&c.src.l)&&dirOk) return 'ось';   /* новая ось проекций: положение свободное, направление — по построению */
      /* «проводим произвольную h″ ∥ x»: положение выбирает чертёжник, направление — по построению; шаг так и говорит */
      if((dirOk||P.length>=1)&&FREE.test(stText[si])) return 'произвольная';
      /* линия уровня на высоте (глубине), названной в тексте: горизонталь на π₂ / фронталь на π₁ */
      if(Math.abs(c.d[1])<TA&&axisLines.length&&levelKnown(Math.abs(c.p[1]))) return 'уровень из текста';
      /* горизонталь на π₂ (h″ ∥ x) и фронталь на π₁ (f′ ∥ x) проводят на любой высоте (глубине) — положение выбирает чертёжник */
      if(Math.abs(c.d[1])<TA&&/^[hf][₀-₉a-zα-ωₐ-ₜ]*[″′]$/.test(strip(c.src&&c.src.l||''))&&(/^h/.test(strip(c.src.l))?/″$/:/′$/).test(strip(c.src.l))) return 'линия уровня';
      /* касательная из известной точки к построенной окружности */
      if(P.length>=1&&circs.some(o=>Math.abs(offC(o.c,c)-o.r)<TP)) return 'касательная';
      return ''; };
    const okPt=p=>{ const r=okPt1(p); return r||(known(p)?'пересечение':''); };
    const okPt1=p=>{
      /* точка по координатам: обе координаты на чертеже — числа из условия (отложены от начала координат) */
      if(axisLines.length&&coordKnown(Math.abs(p[0]))&&coordKnown(Math.abs(p[1]))) return 'координаты';
      const on=lines.filter(c=>offC(p,c)<TP), onO=circs.filter(o=>Math.abs(d2(p,o.c)-o.r)<TP);
      /* точка, симметричная известной относительно построенной прямой (перпендикуляр и равный отрезок) */
      if(lines.some(c=>K.some(q=>{ const d=offC(q,c); if(d<1) return false; const sg=crs(c.d,sub(q,c.p))>0?1:-1, r=sub(q,mul([-c.d[1],c.d[0]],2*d*sg)); return d2(r,p)<TP; }))) return 'симметрия';
      /* параллельный перенос нарисованного отрезка: P = Q + (B − A) — «равные и параллельные отрезки» */
      if(segs.some(([a,b])=>K.some(q=>d2(add(q,sub(b,a)),p)<TP||d2(add(q,sub(a,b)),p)<TP))) return 'перенос';
      const onC=curves.filter(cv=>offCurve(p,cv)<TC);
      if(onC.length&&(on.length||onO.length)) return 'на кривой';   /* пересечение линии с кривой (ломаная — с допуском хорды) */
      if(onC.length&&FREE.test(stText[si])) return 'на кривой';
      if(on.length+onO.length===0) return '';
      /* перенос циркулем: расстояние от известной точки (на той же линии) или от оси — известная длина */
      if(on.some(c=>K.some(q=>offC(q,c)<TP&&lenKnown(d2(p,q))))) return 'на линии';
      /* отложить по той же прямой отрезок между двумя её известными точками (K′D′ = B′K′, равные части на луче) */
      if(on.some(c=>{ const P2=K.filter(q=>offC(q,c)<TP); return P2.some(q=>P2.some(a=>P2.some(b=>a!==b&&d2(a,b)>1&&Math.abs(d2(p,q)-d2(a,b))<TL))); })) return 'на линии';
      /* произвольная точка на построенной линии — если шаг так и говорит («произвольный луч», «любую точку») */
      if(FREE.test(stText[si])) return 'на линии';
      if(axisLines.some(x=>lenKnown(offC(p,x)))&&on.length) return 'на линии';
      /* деление в том же отношении (инвариант проецирования, Фалес): P на прямой известных A, B с тем же t, что у известной
         тройки на другой нарисованной прямой; середина — частный случай */
      if(on.some(c=>{ const P2=K.filter(q=>offC(q,c)<TP); for(const a of P2) for(const b of P2){ const L=d2(a,b); if(L<2) continue; const t=dot(sub(p,a),sub(b,a))/(L*L); if(t<=0.02||t>=0.98) continue;
          if(Math.abs(t-0.5)<1e-4) return 'на линии'; if(ratios.some(r=>Math.abs(r-t)<1e-4)) return 'на линии'; } return false; })) return 'на линии';
      return ''; };
    const okCirc=(o,ends)=>{
      /* окружность на отрезке как на диаметре: центр — середина двух известных точек, сама проходит через них */
      { const on=K.filter(q=>Math.abs(d2(q,o.c)-o.r)<TP); if(on.some(a=>on.some(b=>d2(mul(add(a,b),0.5),o.c)<TP&&Math.abs(d2(a,b)-2*o.r)<TP*2))) return true; }
      if(!known(o.c)&&!okPt1(o.c)) return false;   /* центр — известная или построенная точка */  if(K.some(q=>Math.abs(d2(q,o.c)-o.r)<TP)) return true; if(lenKnown(o.r)) return true;
      if(lines.some(c=>Math.abs(offC(o.c,c)-o.r)<TP)) return true;   /* касается построенной прямой (радиус — перпендикуляр из центра) */
      /* параллель поверхности вращения с вертикальной осью: центр — горизонтальная проекция оси (S′, O′, i′…), радиус снят
         на π₂ от оси (S″, O″…) до точки очерка по горизонтали */
      { const ax1=labNames.find(q=>d2(q.p,o.c)<TP&&/′$/.test(q.l)); if(ax1){ const base=ax1.l.replace(/′$/,'').split(/≡/)[0], ax2=labNames.find(q=>q.l.split(/≡/).some(x=>x===base+'″'));
        if(ax2&&K.some(q=>Math.abs(Math.abs(q[0]-ax2.p[0])-o.r)<TL)) return true; }
        /* то же без подписей: ось — вертикаль через центр; радиус — горизонтальное расстояние от точки на этой вертикали
           (на π₂, выше оси x) до известной точки на той же высоте (очерк) */
        if(K.some(a2=>Math.abs(a2[0]-o.c[0])<TP&&a2[1]<-TP&&K.some(q=>Math.abs(q[1]-a2[1])<TP&&Math.abs(Math.abs(q[0]-a2[0])-o.r)<TL))) return true;
        if(K.some(q=>q[1]<-TP&&Math.abs(Math.abs(q[0]-o.c[0])-o.r)<TL&&K.some(a2=>Math.abs(a2[0]-o.c[0])<TP&&a2[1]<-TP))) return true; }
      if(ends&&ends.some(e=>known(e))) return true;
      if(known(o.c)&&FREE.test(stText[si])) return true;   /* «сфера произвольного радиуса» с известным центром */
      return false; };
    while(changed){ changed=false;
      pend=pend.filter(a=>{ let ok=false;
        if(a.kind==='line') ok=okLine(a.c);
        else if(a.kind==='circ') ok=okCirc(a.o,a.ends);
        else if(a.kind==='curve'){ const on=K.filter(q=>offCurve(q,a)<TC); ok=on.length>=3&&on.some(p=>on.some(q=>d2(p,q)>4));
          /* кусок кривой (видимый/невидимый участок): две построенные точки на нём и концы — в построенных точках или на других кусках */
          if(!ok&&on.length>=1) ok=[a.ps[0],a.ps[a.ps.length-1]].every(e=>K.some(q=>d2(q,e)<TC)||curves.some(cv=>cv!==a&&offCurve(e,cv)<TC)||A.some(b=>b!==a&&b.kind==='curve'&&offCurve(e,b)<TC)); if(!ok&&a.ell) ok=known(a.it.c)&&on.length>=2;
          /* вырожденная кривая — проекция окружности на прямую: все её точки на построенной прямой между известными точками */
          if(!ok) ok=lines.some(c=>a.ps.every(q=>offC(q,c)<TP*3))&&on.length>=1;
          /* огибающая (очерк линейчатой поверхности): касается построенных образующих — шаг так и говорит */
          if(!ok&&/огибающ/i.test(stText[si])) ok=lines.filter(c=>a.ps.some(q=>offC(q,c)<TC)).length>=3; }
        else if(a.kind==='pt'){ ok=okPt(a.p); a.why=ok; }
        if(!ok) return true;
        if(a.kind==='line'){ drawn.push(a.c); addLines(a.c); lens.add(d2(a.c.a,a.c.b)); if(known(a.c.a)&&known(a.c.b)){ segs.push([a.c.a,a.c.b]); noteRatio(a.c.a,a.c.b); lens.add(d2(a.c.a,a.c.b)/2); }   /* половина отрезка — тоже циркулем */ /* конец отрезка — пересечение (поле — общее поле линий) или отложенная длина (поле не определено) */
          const endK=e=>{ const o=lines.find(o=>o!==a.c&&offC(e,o)<TP); if(known(e)||o) return {f:o&&o._f===a.c._f?a.c._f:0}; return K.some(q=>offC(q,a.c)<TP&&d2(q,e)>0.5&&lenKnown(d2(q,e)))?{f:0}:null; };
          { const ea=endK(a.c.a), eb=endK(a.c.b); if(ea) addK(a.c.a,ea.f); if(eb) addK(a.c.b,eb.f); } if(isAxisLabel(a.c.src&&a.c.src.l)){ axisLines.push(a.c); K.forEach(p=>lens.add(offC(p,a.c))); } }
        if(a.kind==='curve') addCurve(a);
        if(a.kind==='circ'){ addCirc(a.o); lens.add(a.o.r); if(a.ends) a.ends.forEach(p=>addK(p)); }
        if(a.kind==='pt'){ addK(a.p,fieldOf(a.it.l)); axisLines.forEach(x=>lens.add(offC(a.p,x))); notePt(a); }
        changed=true; return false; }); }
    const where=name+' · шаг '+si;
    /* точка стоит на нарисованном: пересечение — там, куда линии действительно доведены (две линии разных направлений
       или линия и окружность); точку на линии (перенос циркулем) — хотя бы одна нарисованная линия */
    const reach=p=>{ const ds=drawn.filter(c=>{ if(offC(p,c)>=TP) return false; const L=d2(c.a,c.b), t=dot(sub(p,c.a),sub(c.b,c.a))/(L*L), e=1.5/L; return t>-e&&t<1+e; });
      let n=0; const dirs=[]; ds.forEach(c=>{ if(!dirs.some(d=>Math.abs(crs(d,c.d))<1e-3)){ dirs.push(c.d); n++; } });
      return n+circs.filter(o=>Math.abs(d2(p,o.c)-o.r)<TP).length; };
    const labBefore=labPts.slice(0,labCount0);   /* подписанные точки прошлых шагов: совпавшая с ней точка — та же точка (O″ ≡ i″) */
    A.filter(a=>a.kind==='pt'&&a.why&&a.why!=='координаты'&&a.why!=='перенос'&&!pend.includes(a)&&!labBefore.some(o=>d2(o.p,a.p)<TP)&&!circs.some(o=>d2(o.c,a.p)<TP)).forEach(a=>{ const r=reach(a.p), l=strip(a.it.l);
      if(r<(a.why==='пересечение'?2:1)) out.push({name:where,rule:'построимость',msg:'точка'+(l?' '+l:' без подписи')+(r?': до неё доведена только одна линия':': ни одна нарисованная линия до неё не доведена'),lvl:'ошибка'}); });
    /* одна и та же точка дважды на одном шаге */
    { const ps=A.filter(a=>a.kind==='pt'); ps.forEach((a,i)=>{ if(ps.some((b,j)=>j<i&&d2(a.p,b.p)<TP&&strip(a.it.l)===strip(b.it.l))) out.push({name:where,rule:'построимость',msg:'точка'+(strip(a.it.l)?' '+strip(a.it.l):' без подписи')+' поставлена дважды',lvl:'ошибка'}); }); }
    /* засечка (дуга окружности): на ней лежит построенная точка — ради неё дугу и проводили */
    A.filter(a=>a.kind==='circ'&&a.it.t==='arc'&&!pend.includes(a)).forEach(a=>{ const it=a.it, lo=Math.min(it.a1,it.a2)-2, hi=Math.max(it.a1,it.a2)+2;
      const hit=K.some(q=>{ if(Math.abs(d2(q,it.c)-it.r)>=TP) return false; let g=Math.atan2(-(q[1]-it.c[1]),q[0]-it.c[0])*180/Math.PI; for(let k=-2;k<=2;k++){ const x=g+360*k; if(x>=lo&&x<=hi) return true; } return false; });
      if(!hit) out.push({name:where,rule:'построимость',msg:'дуга (засечка) не проходит ни через одну построенную точку',lvl:'ошибка'}); });
    /* размер: концы — в построенных точках или на выносных (перпендикуляр к размерной линии через известную точку) */
    arr.filter(it=>it&&it.t==='dim'&&fin(it.a)&&fin(it.b)&&d2(it.a,it.b)>1).forEach(it=>{ const u=unit(sub(it.b,it.a));
      const endOk=e=>known(e)||K.some(q=>d2(q,e)>TP&&Math.abs(dot(sub(q,e),u))<TP*2);
      if(!endOk(it.a)||!endOk(it.b)) out.push({name:where,rule:'построимость',msg:'размер '+strip(it.l)+': конец размерной линии не напротив построенной точки',lvl:'ошибка'}); });
    /* дуга циркуля начинается и кончается в построенных точках (иначе это дуга «не туда») */
    A.filter(a=>a.kind==='circ'&&a.ends&&!pend.includes(a)).forEach(a=>{ const bad=a.ends.filter(e=>!known(e));
      if(bad.length) out.push({name:where,rule:'построимость',msg:'дуга кончается не в построенной точке',lvl:'ошибка'}); });
    /* вспомогательная ломаная из многих точек — это дуга; если точки не на одной окружности, её не построить циркулем */
    /* (вспомогательная ломаная, не дуга, проверяется как кривая: через неё должны проходить построенные точки) */
    const nameAt=p=>{ const o=labNames.find(o=>d2(o.p,p)<TP); return o?o.l:'('+(p[0]/S).toFixed(1)+'; '+(p[1]/S).toFixed(1)+')'; };
    pend.forEach(a=>{ const it=a.it, l=strip(it.l||it.s||'')||(a.kind==='line'?nameAt(a.c.a)+'–'+nameAt(a.c.b):'');
      const what=a.kind==='curve'?'кривая'+(l?' '+l:'')+' ('+(it.k||'main')+') — через неё не проходят построенные точки':a.kind==='pt'?'точка'+(l?' '+l:' без подписи'):a.kind==='circ'?(it.t==='poly'?'дуга':it.t==='arc'?'дуга':'окружность')+(l?' '+l:''):(it.t==='conn'?'линия связи':it.t==='line'?'прямая':'отрезок')+(l?' '+l:'')+(it.k?' ('+it.k+')':'');
      out.push({name:where,rule:'построимость',msg:what+' не выводится из предыдущих построений',lvl:'ошибка'}); });
    /* знак угла стоит на двух построенных линиях, сходящихся в его вершине */
    const armOk=(at,p)=>{ const u=unit(sub(p,at)); return lines.some(c=>offC(at,c)<TP&&Math.abs(crs(c.d,u))<2e-3); };
    A.filter(a=>a.kind==='sq'||a.kind==='ang').forEach(a=>{ const it=a.it; if(!armOk(it.at,it.p1)||!armOk(it.at,it.p2)) out.push({name:where,rule:'построимость',msg:(a.kind==='sq'?'знак прямого угла':'знак угла')+' не на построенных линиях',lvl:'ошибка'}); });
    /* подпись линии («h″») у точки — у точки того же поля */
    arr.filter(it=>it&&it.t==='txt'&&fin(it.at)&&/^[a-zα-ω][₀-₉a-zα-ωₐ-ₜ]*[′″]$/.test(strip(it.s))).forEach(it=>{ const mk=strip(it.s).slice(-1);
      const hit=labPts.find(o=>d2(o.p,it.at)<TP); if(hit&&hit.f!==(mk==='″'?2:1)) out.push({name:where,rule:'подпись',msg:'подпись '+strip(it.s)+' стоит у точки другого поля',lvl:'ошибка'}); });
    /* ⊾ — прямой угол на самом деле; подпись угла — измеренный угол */
    A.forEach(a=>{ const it=a.it;
      if(a.kind==='sq'){ const u=unit(sub(it.p1,it.at)), v=unit(sub(it.p2,it.at)); if(Math.abs(dot(u,v))>2e-3) out.push({name:where,rule:'знак прямого угла',msg:'угол под знаком ⊾ равен '+(Math.acos(Math.max(-1,Math.min(1,dot(u,v))))*180/Math.PI).toFixed(2)+'°',lvl:'ошибка'}); }
      if(a.kind==='ang'){ const m=/(\d+(?:[.,]\d+)?)\s*°/.exec(strip(it.l)); if(!m) return; const u=unit(sub(it.p1,it.at)), v=unit(sub(it.p2,it.at)), g=Math.acos(Math.max(-1,Math.min(1,dot(u,v))))*180/Math.PI, val=+m[1].replace(',','.');
        const tol=/≈/.test(strip(it.l))?0.5:0.06; if(Math.abs(g-val)>tol&&Math.abs(180-g-val)>tol) out.push({name:where,rule:'подпись угла',msg:'подписано '+m[1]+'°, на чертеже '+g.toFixed(2)+'°',lvl:'ошибка'}); } });
  });
}

/* кривые поверхности (сечения, развёртки, пересечения поверхностей): кривые строятся по точкам, и правила для них
   (точка на образующей, на параллели, на очерке) ещё не записаны — эти задачи «Евклид» пока не проверяет */
window.EUCLID_TODO=[74,77];
window.EUCLID_CHECK=function(opts){ opts=opts||{}; const out=[];
  const TX=o=>[o&&o.q,o&&o.intro,o&&o.ans,o&&o.note,o&&o.data].concat(((o&&o.steps)||[]).map(s=>[s.t,s.d,s.why,s.tbl].join(' '))).filter(x=>typeof x==='string').join(' ');
  const run=(name,t)=>{ try{ PLAYER.partsOf(t).forEach((p,pi)=>{ try{ window.LINEFIX&&LINEFIX(p); window.DMARK&&DMARK(p); }catch(e){} audit(name+(pi?' п.'+(pi+1):''),p,out,TX(t)+' '+TX(p),[t.q,t.data,p.q].filter(x=>typeof x==='string').join(' ')); }); }catch(e){ out.push({name,rule:'сбой проверки',msg:String(e&&e.stack||e).slice(0,200),lvl:'ошибка'}); } };
  (opts.tasks||WB3.tasks.filter(t=>opts.all||!EUCLID_TODO.includes(t.n))).forEach(t=>run('Задача №'+t.n,t));
  if(!opts.tasks||opts.dz) (opts.dz||['2','2b','2c','3']).forEach(id=>{ const d=(opts.get||(i=>window.NGHW&&NGHW.get(i)))(id); if(d&&d.task) run('ДЗ '+id,d.task); });
  return out; };
})();
