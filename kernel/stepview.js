/* ═══════════ STEPVIEW: как показать шаг построения (docs/design-decisions.md, «Показ шага v11») ═══════════
   Работает в браузере (window.STEPVIEW) и в Node (require) — его берут плеер (PLAYER), тренер (tutor/) и тесты.
   Только показ: данные задачи не меняются, порядок и геометрия построений — как у автора.

   analyze(part, k) → разбор шага k (1…n) части задачи part ({given, steps:[{t,d,why,add}]}):
     beats   — подшаги: группы элементов шага по порядку построения, в каждой не больше MAX_ENT новых сущностей
               (сущность — точка или линия; две проекции A′ и A″ — одна сущность A); линии связи, знаки ⟂, подписи
               идут вместе с той сущностью, к которой ведут;
     у подшага: idx — номера элементов в step.add, ents — новые сущности, sup — опорные элементы (уже построенные точки
               и линии, от которых строится новое: их коротко подсвечиваем), rev — какие линии рисовать «от опоры»
               (элемент начинается в известной точке — линия вырастает из неё), cap — подпись подшага
               [{s:'текст'} | {l:'1′', g:'aux'|'res'|…}] — что именно сейчас появилось и откуда.
   names(items)  — точки с подписями: подпись → координаты (A′≡B′ даёт две подписи).
   lines(items)  — линии с именами: собственная подпись (h″, a′) или по концам (A′B′).
   Допуски — в единицах чертежа сайта (≈ мм), как у проверок tests/geometry.js. */
(function(){
const EPS=1.3, MAX_ENT=2;
const strip=x=>String(x==null?'':x).replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();
const near=(p,q,e)=>p&&q&&Math.hypot(p[0]-q[0],p[1]-q[1])<(e||EPS);
const MARK=/[′″‴]+$/;
/* имя сущности: «A″» → «A», «h₀γ» → «h₀γ», «1′» → «1»; у прямой с несколькими именами (a₁″≡fα″) — первое */
const ent=l=>strip(l).split(/\s*≡\s*/)[0].replace(MARK,'').replace(/[ⅠⅡⅢⅣⅤ]+$/,'');
const PRIM=new Set(['seg','line','ray','poly','curve','circ','arc','ell','vec']);
const ATT=new Set(['conn','hconn','ext','sq','tick','ang','txt','note','hatch','dim']);
function isPrim(it){ if(!it) return false; if(it.t==='pt') return !!strip(it.l); if(it.t==='dim'||it.t==='ang') return !!strip(it.l)&&it.k==='res'; return PRIM.has(it.t)&&it.k!=='paper'; }
function names(items){ const o={}; (items||[]).forEach(it=>{ if(it&&it.t==='pt'&&it.at&&it.l) strip(it.l).split(/\s*[≡=]\s*/).forEach(n=>{ n=n.trim(); if(n&&!o[n]) o[n]=it.at; }); }); return o; }
/* расстояние от точки до отрезка (t в [−δ, 1+δ]) и до прямой */
function dSeg(q,a,b,inf){ const dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy; if(L<1e-9) return Math.hypot(q[0]-a[0],q[1]-a[1]);
  let t=((q[0]-a[0])*dx+(q[1]-a[1])*dy)/L; if(!inf){ const d=4/Math.sqrt(L); if(t<-d||t>1+d) return 1e9; }
  return Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy); }
function segsOf(it){ if(!it) return []; if((it.t==='seg'||it.t==='line'||it.t==='ray'||it.t==='vec'||it.t==='conn'||it.t==='hconn'||it.t==='ext')&&it.a&&it.b) return [[it.a,it.b]];
  if((it.t==='poly'||it.t==='curve')&&it.p){ const s=[]; for(let i=1;i<it.p.length;i++) s.push([it.p[i-1],it.p[i]]); if(it.close&&it.p.length>2) s.push([it.p[it.p.length-1],it.p[0]]); return s; }
  if(it.t==='conn'&&it.p){ const s=[]; for(let i=1;i<it.p.length;i++) s.push([it.p[i-1],it.p[i]]); return s; }
  return []; }
function onItem(q,it){ if(it.t==='circ'&&it.c) return Math.abs(Math.hypot(q[0]-it.c[0],q[1]-it.c[1])-it.r)<EPS; return segsOf(it).some(([a,b])=>dSeg(q,a,b,it.t==='line')<EPS*0.75); }
/* имя линии: своя подпись или «A′B′» по подписанным концам */
function lineName(it,pts,more,txts){ const own=strip(it.l); if(own) return own.split(/\s*≡\s*/)[0];
  if((it.t==='poly'||it.t==='curve')&&it.p&&it.p.length>=3){ const nn=it.p.map(q=>Object.keys(pts).find(k=>near(pts[k],q))); const u=[...new Set(nn.filter(Boolean))];
    if(u.length>=3&&nn.filter(Boolean).length>=it.p.length-(it.close?0:1)) return u.join(''); }
  /* продолжение или обводка уже известной прямой — её имя */
  if(more&&more.__lines&&it.a&&it.b){ const L=more.__lines.find(o=>o.it!==it&&segsOf(o.it).length===1&&dSeg(it.a,...segsOf(o.it)[0],true)<EPS*0.75&&dSeg(it.b,...segsOf(o.it)[0],true)<EPS*0.75); if(L) return L.name; }
  /* подпись, поставленная рядом отдельным текстом (txt) того же шага */
  if(txts&&txts.length){ const c=txts.map(x=>({x,d:Math.min(...segsOf(it).map(([a,b])=>dSeg(x.at,a,b,false)))})).filter(o=>o.d<16).sort((a,b)=>a.d-b.d)[0]; if(c) return strip(c.x.s); }
  if(it.a&&it.b){ const n=p=>Object.keys(pts).find(k=>near(pts[k],p)); const A=n(it.a), B=n(it.b); if(A&&B&&A!==B) return A+B;
    /* без подписи и без подписанных концов — по двум подписанным точкам на ней (той же проекции): «1′2′» */
    const on=Object.keys(more||pts).filter(k=>k!=='__lines'&&k.length<=4&&onItem((more||pts)[k],it));
    const fld=k=>(/[′″‴₀-₉]$|[̄]/.exec(k)||[''])[0], m=on.length>=2?on.filter(k=>fld(k)===fld(on[0])):[]; if(m.length>=2) return m[0]+m[1]; }
  return ''; }
function lines(items){ const pts=names(items); return (items||[]).filter(it=>it&&PRIM.has(it.t)&&it.t!=='vec').map(it=>({it,name:lineName(it,pts)})).filter(o=>o.name); }
const KIND=it=>it.col?'mc':(it.k==='res'||it.k==='resd')?'res':(it.k==='grn'||it.k==='grnd')?'grn':(it.k==='aux'||it.k==='auxd'||it.k==='dim')?'aux':'ink';

/* ── разбор шага ── */
function analyze(part,k){
  const st=(part&&part.steps)||[], step=st[k-1]; if(!step) return null;
  const add=(step.add||[]).filter(Boolean), before=[].concat(part.given||[],...st.slice(0,k-1).map(s=>s.add||[])).filter(Boolean);
  const all=before.concat(add), P=names(all), known0=names(before);
  /* 1. новые сущности по порядку: точка с подписью или линия (с подписью или без) */
  const prim=[]; add.forEach((it,i)=>{ if(!isPrim(it)) return;
    const l=strip(it.l);
    if(it.t==='pt'){ const ns=l.split(/\s*[≡=]\s*/).map(s=>s.trim()).filter(Boolean); if(ns.every(n=>known0[n]&&near(known0[n],it.at))) return;   /* та же точка повторно (выделена цветом ответа) — не новая */
      prim.push({i,e:ent(l),kind:'pt'}); return; }
    /* обводка с видимостью: отрезок по уже построенной прямой (концы на ней) — все такие отрезки шага — одна сущность */
    if(it.a&&it.b&&(it.t==='seg'||it.t==='line')&&!l){ const on=lines(before).some(o=>segsOf(o.it).length===1&&o.it.t!=='conn'&&dSeg(it.a,...segsOf(o.it)[0],true)<EPS*0.75&&dSeg(it.b,...segsOf(o.it)[0],true)<EPS*0.75);
      if(on&&/^(main|hid|res|resd|thin|dash|paper|grn|grnd)$/.test(it.k||'main')){ prim.push({i,e:'@trace',kind:'tr'}); return; } }
    prim.push({i,e:l?ent(l):'#'+i,kind:'ln'}); });
  /* 2. к какой сущности относится вспомогательный элемент */
  const newPt=(p)=>{ for(const o of prim) if(o.kind==='pt'&&near(add[o.i].at,p)) return o; return null; };
  const anchor=new Array(add.length).fill(-1);
  prim.forEach((o,j)=>{ anchor[o.i]=j; });
  add.forEach((it,i)=>{ if(anchor[i]>=0) return; let o=null;
    if((it.t==='conn'||it.t==='hconn')&&it.a&&it.b){ const A=newPt(it.a), B=newPt(it.b);
      /* линия связи принадлежит точке, к которой ведёт: из известной точки — к новой */
      o=(A&&B)?(prim.indexOf(A)<prim.indexOf(B)?B:A):(A||B); }
    else if(it.t==='pt'&&it.at){ o=newPt(it.at); }
    else if(it.t==='sq'&&it.at){ const c=prim.filter(q=>q.kind==='ln'&&onItem(it.at,add[q.i])); o=c.length?c[c.length-1]:newPt(it.at); }
    else if(it.t==='ext'||it.t==='dim'||it.t==='tick'||it.t==='ang'){ const p=it.a||it.at; o=p?(newPt(p)||prim.slice().reverse().find(q=>q.kind==='ln'&&onItem(p,add[q.i]))):null; }
    if(o) anchor[i]=prim.indexOf(o);
    else { const nx=prim.findIndex(q=>q.i>i); anchor[i]=nx>=0?nx:prim.length-1; } });   /* иначе — к следующей сущности по порядку */
  /* 3. подшаги: подряд, не больше MAX_ENT сущностей */
  const beats=[]; let cur=null;
  prim.forEach((o,j)=>{ if(!cur||(!cur.ents.includes(o.e)&&cur.ents.length>=MAX_ENT)){ cur={prims:[],ents:[]}; beats.push(cur); }
    cur.prims.push(j); if(!cur.ents.includes(o.e)) cur.ents.push(o.e); });
  if(!beats.length) beats.push({prims:[],ents:[]});
  beats.forEach((b,bi)=>{ b.idx=add.map((_,i)=>i).filter(i=>b.prims.includes(anchor[i])||(anchor[i]<0&&bi===0)); });
  /* 4. опоры, направление роста, подпись — по порядку: известное = условие + прошлые шаги + прошлые подшаги */
  let known=before.slice();
  beats.forEach(b=>{
    const kp=names(known), kl=lines(known), its=b.idx.map(i=>add[i]);
    const sup=[], rev=[], cap=[], seen=new Set();
    const supPt=(n)=>{ if(!kp[n]||seen.has('p'+n)) return; seen.add('p'+n); sup.push({t:'pt',at:kp[n],l:n}); };
    const supLn=(o)=>{ if(seen.has('l'+o.name)) return; seen.add('l'+o.name); const s=segsOf(o.it)[0]; if(s) sup.push({t:'ln',a:s[0],b:s[1],l:o.name}); };
    const ptAt=(p,src)=>Object.keys(src).find(n=>near(src[n],p));
    its.forEach((it,j)=>{ const ii=b.idx[j];
      if((it.t==='conn'||it.t==='hconn'||it.t==='seg'||it.t==='line')&&it.a&&it.b){ const A=ptAt(it.a,kp), B=ptAt(it.b,kp);
        if(B&&!A) rev.push(ii); if(A) supPt(A); if(B&&it.t!=='conn'&&it.t!=='hconn') supPt(B); else if(B&&!A) supPt(B); } });
    /* подпись: что появилось и откуда */
    const lab=(l,it)=>Object.assign({l,g:KIND(it)},it&&it.col?{c:it.col}:{});
    let trDone=false;
    b.prims.forEach((j,n)=>{ const o=prim[j], it=add[o.i];
      if(o.kind==='tr'){ if(trDone) return; trDone=true; if(n) cap.push({s:'; '}); cap.push({s:'обводка с видимостью: сплошная — видна, штриховая — закрыта'}); return; }
      if(n) cap.push({s:'; '});
      const kn=names(known.concat(its.slice(0,its.indexOf(it)))), knl=lines(known.concat(its.slice(0,its.indexOf(it))));
      if(o.kind==='pt'){ const nm=strip(it.l).split(/\s*≡\s*/)[0];
        const via=knl.filter(L=>onItem(it.at,L.it)&&!near(L.it.a||[1e9,1e9],it.at)&&!near(L.it.b||[1e9,1e9],it.at)&&L.name!==nm).filter((L,i,a)=>a.findIndex(q=>q.name===L.name)===i);
        const conn=its.concat(known).find(c=>(c.t==='conn'||c.t==='hconn')&&c.a&&c.b&&(near(c.a,it.at)||near(c.b,it.at)));
        const from=conn&&ptAt(near(conn.a,it.at)?conn.b:conn.a,kn);
        cap.push(lab(nm,it));
        if(via.length>=2&&!from){ cap.push({s:' = '}); cap.push(lab(via[0].name,via[0].it)); cap.push({s:' ∩ '}); cap.push(lab(via[1].name,via[1].it)); supLn(via[0]); supLn(via[1]); }
        else if(from){ cap.push({s:' — линия связи из '}); cap.push(lab(from,{k:'ink'})); supPt(from); if(via.length){ cap.push({s:' до '}); cap.push(lab(via[0].name,via[0].it)); supLn(via[0]); } }
        else if(via.length===1){ cap.push({s:' на '}); cap.push(lab(via[0].name,via[0].it)); supLn(via[0]); }
      } else { const nm=lineName(it,names(known.concat(its)),Object.assign({__lines:knl},P),its.filter(q=>q.t==='txt'&&q.at&&strip(q.s)&&strip(q.s).length<=8)); const thr=Object.keys(kn).filter(n=>segsOf(it).length&&onItem(kn[n],it)).slice(0,3);
        if(nm){ cap.push({s:it.t==='curve'||it.t==='circ'||it.t==='arc'||it.t==='ell'?'':'прямая '}); cap.push(lab(nm,it)); } else cap.push({s:it.t==='circ'||it.t==='arc'?'окружность':'линия построения'});
        const sq=its.find(q=>q.t==='sq'&&q.at&&onItem(q.at,it));
        if(sq){ const other=knl.find(L=>L.it!==it&&onItem(sq.at,L.it)&&L.name!==nm); if(other){ cap.push({s:' ⟂ '}); cap.push(lab(other.name,other.it)); supLn(other); } }
        else if(it.a&&it.b&&Math.abs(it.a[1]-it.b[1])<0.6&&Math.abs(it.a[0]-it.b[0])>4&&/^[hf]/.test(nm)) cap.push({s:' ∥ x'});
        const thrN=thr.filter(n=>!(nm&&nm.includes(n)));
        if(thrN.length){ cap.push({s:' через '}); thrN.forEach((n,q)=>{ if(q) cap.push({s:', '}); cap.push(lab(n,{k:'ink'})); supPt(n); }); }
      } });
    b.sup=sup.slice(0,6); b.rev=rev; b.cap=cap;
    known=known.concat(its); });
  return {k,beats,prim:prim.map(o=>({i:o.i,e:o.e,kind:o.kind,l:strip(add[o.i].l)})),ents:[...new Set(prim.map(o=>o.e))]};
}
/* подпись подшага текстом (для тестов и тренера) */
const capText=cap=>(cap||[]).map(c=>c.l!=null?c.l:c.s).join('');

/* ── задачи на плоскость (часть 1 отчёта docs/REPORT-TUTOR-FOUNDATION.md): к ним применяются подшаги и подсветка опор ──
   тетрадь: раздел 3 «Плоскость» (23–30), 4 «Фигуры в плоскости» (31–34), 5 «Прямая и плоскость, две плоскости» (35–50),
   из раздела 6 и 11 — натуральная величина плоской фигуры, расстояние до плоскости, углы с плоскостью, двугранные углы;
   ДЗ по начерту: №1 (плоская фигура), №2 (прямая и плоскость), №3 (пирамида: грани в натуральную величину) */
const PLANE_WB=[23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,54,55,56,57,60,61,62,65,66,67,85,87];
const PLANE_DZ=['ng1','ng2','ng3'];
function isPlane(t){ if(!t) return false; if(t.dzId) return PLANE_DZ.includes(t.dzId); return PLANE_WB.includes(+t.n); }

const STEPVIEW={EPS,MAX_ENT,strip,ent,names,lines,lineName,onItem,segsOf,analyze,capText,isPrim,PLANE_WB,PLANE_DZ,isPlane};
if(typeof module!=='undefined'&&module.exports) module.exports=STEPVIEW; else self.STEPVIEW=STEPVIEW;
})();
