/* ═══════════ Трассировка происхождения (обязательство O4, слой «по построению») ═══════════
   Идея: проверять не «похож ли рисунок на правильный», а «откуда взялась каждая точка рисунка».
   L.F(p) и L.H(p) уже помечают результат невидимыми полями: _3 — точка пространства, _pl — поле
   (2 — фронтальная проекция, 1 — горизонтальная). PROV_INSTRUMENT() дополнительно протягивает поле
   через плоские построения G (пересечение, перпендикуляр, отложить вдоль, основание, поворот…):
   результат наследует поле, если все исходные точки с одного поля.
   Дальше проверяется то, чего по готовому рисунку узнать нельзя:
     П1  подпись со штрихом стоит в точке своего поля: A′ — горизонтальная проекция, A″ — фронтальная;
     П2  A′ и A″ построены из точек с одной абсциссой x;
     П3  отрезок, прямая, многоугольник не соединяют фронтальное поле с горизонтальным
         (кроме вертикальной линии связи); подписанная прямая a″ / h′ — на своём поле;
     П4  линия связи соединяет две проекции одной и той же точки.
   PROV_CHECK({tasks}) → [{name, rule, msg, lvl}]; PROV_STATS — доля прослеживаемых точек и отрезков. */
(function(){
const MARK=/(′|″|‴)$/, PN={'′':1,'″':2}, PLN={1:'горизонтальной',2:'фронтальной'};
const strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();
const is2=a=>Array.isArray(a)&&a.length===2&&typeof a[0]==='number'&&isFinite(a[0])&&isFinite(a[1]);
const key=a=>Math.round(a[0]*20)+','+Math.round(a[1]*20);
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
/* расхождение проекций одной подписи. F не использует y, H не использует z, и в коде законно пишут F([x,0,z]),
   H([x,y,0]) или F([x,Yc,z]) для проецирующей прямой — по этим координатам намерение автора не восстановить.
   Надёжно сравнивается только x. Полная проверка «одна точка — две проекции» — в модели сертифицированного эпюра */
const gap=(f,h)=>Math.abs(f[0]-h[0]);
const tag=(r,pl)=>{ try{ Object.defineProperty(r,'_pl',{value:pl}); Object.defineProperty(r,'_d',{value:true}); }catch(e){} return r; };
/* точка, у которой обе проекции совпадают на чертеже (z = −y): поле по положению не определить — не судим */
const ambiguous=p3=>p3&&Math.abs(p3[2]+p3[1])<1e-6;

/* протянуть поле через плоские построения. Векторная алгебра (add, sub, mul) не помечается:
   вектор не принадлежит полю, а смешение «точка одного поля + направление другого» бывает законным */
window.PROV_INSTRUMENT=function(){
  if(window.__provOn) return; window.__provOn=true;
  const G=L.G;
  ['cross','atV','atU','perp','along','foot','rot','lerp','mid'].forEach(k=>{ const f=G[k]; if(typeof f!=='function') return;
    G[k]=function(){ const r=f.apply(this,arguments); if(!is2(r)) return r;
      const ps=new Set([].filter.call(arguments,a=>is2(a)&&a._pl).map(a=>a._pl));
      return ps.size===1?tag(r,[...ps][0]):r; }; });
  const lc=G.lineCirc; if(typeof lc==='function') G.lineCirc=function(a,b,c){ const r=lc.apply(this,arguments); const ps=new Set([a,b,c].filter(x=>is2(x)&&x._pl).map(x=>x._pl));
    if(ps.size===1&&Array.isArray(r)) r.forEach(q=>is2(q)&&tag(q,[...ps][0])); return r; };
};

window.PROV_STATS={pts:0,traced:0,segs:0,segTraced:0};
window.PROV_CHECK=function(opts){
  opts=opts||{}; const out=[], st=window.PROV_STATS;
  const tasks=opts.tasks||WB3.tasks;
  tasks.forEach(t=>{ const parts=(t.parts&&t.parts.length)?t.parts:[t];
    parts.forEach((p,pi)=>{
      const nm=(opts.prefix||'Задача №')+t.n+(parts.length>1?' п.'+(pi+1):'');
      const stages=[{nm:nm+' · дано',items:(p.given||t.given||[]).filter(Boolean)}].concat((p.steps||[]).map((s,k)=>({nm:nm+' · шаг '+(k+1),items:(s.add||[]).filter(Boolean)})));
      const all=[].concat(...stages.map(s=>s.items));
      /* указатель «положение → помеченные точки»: копии (.slice()) узнаются по координатам */
      const idx=new Map(); const reg=a=>{ if(is2(a)&&a._pl){ const k=key(a); if(!idx.has(k)) idx.set(k,[]); idx.get(k).push(a); } };
      all.forEach(it=>{ ['at','a','b','c'].forEach(f=>reg(it[f])); if(Array.isArray(it.p)) it.p.forEach(reg); });
      const src=a=>{ if(!is2(a)) return null; if(a._pl) return {pl:a._pl,p3:a._3||null};
        const c=idx.get(key(a))||[]; const s=new Set(c.map(x=>x._pl)); if(s.size!==1) return null;
        const w=c.find(x=>x._3); return {pl:c[0]._pl,p3:w?w._3:null}; };
      const seen=new Set();
      const add=(where,rule,msg)=>{ const k=rule+'|'+msg; if(seen.has(k)) return; seen.add(k); out.push({name:where,rule,msg,lvl:'ошибка'}); };
      /* при замене плоскостей проекций линии связи перпендикулярны новой оси (x₁₄, x₂₄…): косая линия связи законна,
         если на чертеже есть длинная прямая, которой она перпендикулярна */
      const longs=all.filter(o=>(o.t==='seg'||o.t==='line')&&is2(o.a)&&is2(o.b)&&Math.hypot(o.a[0]-o.b[0],o.a[1]-o.b[1])>40);
      const axisFor=c=>{ const u=[c.b[0]-c.a[0],c.b[1]-c.a[1]], lu=Math.hypot(...u); return longs.some(o=>{ const v=[o.b[0]-o.a[0],o.b[1]-o.a[1]];
        return Math.abs(u[0]*v[0]+u[1]*v[1])/(lu*Math.hypot(...v))<0.01; }); };
      const named={}, skipName=new Set();   /* «3″≡4″» — конкурирующие точки: пометка принадлежит одной из них */   /* подпись → точки пространства, из которых она построена */
      stages.forEach(S=>S.items.forEach(it=>{
        /* П1 */
        if(it.t==='pt'&&it.at&&it.l!=null){ const names=strip(it.l).split(/\s*[≡=]\s*/), combo=/[≡=]/.test(strip(it.l));
          names.forEach(l=>{ const m=MARK.exec(l); if(!m||m[1]==='‴') return;
          st.pts++; const q=src(it.at); if(!q) return; st.traced++;
          if(ambiguous(q.p3)) return;
          if(q.pl!==PN[m[1]]) add(S.nm,'проекция не на своём поле','«'+l+'» стоит в точке '+PLN[q.pl]+' проекции, а по штриху это '+PLN[PN[m[1]]]+' проекция');
          else if(q.p3&&!combo) (named[l]=named[l]||[]).push({p3:q.p3,where:S.nm});
          else if(combo) skipName.add(l.slice(0,-1)); }); }
        /* П3, П4 */
        /* П4б: линия связи вертикальна (π₁–π₂), горизонтальна (π₂–π₃) или перпендикулярна новой оси при замене плоскостей */
        if(it.t==='conn'&&is2(it.a)&&is2(it.b)&&Math.abs(it.a[0]-it.b[0])>0.5&&Math.abs(it.a[1]-it.b[1])>0.5&&!axisFor(it)) add(S.nm,'линия связи','линия связи идёт наискось ('+Math.abs(it.a[0]-it.b[0]).toFixed(1)+' по горизонтали, '+Math.abs(it.a[1]-it.b[1]).toFixed(1)+' по вертикали)');
        if((it.t==='seg'||it.t==='line'||it.t==='conn')&&is2(it.a)&&is2(it.b)){ st.segs++;
          const qa=src(it.a), qb=src(it.b); if(!qa||!qb) return; st.segTraced++;
          if(it.t==='conn'&&qa.pl===qb.pl&&!ambiguous(qa.p3)&&!ambiguous(qb.p3)){ add(S.nm,'линия связи','линия связи начинается и кончается на '+PLN[qa.pl]+' проекции — до второй проекции она не доходит'); return; }
          if(it.t==='conn'){ if(qa.pl!==qb.pl&&qa.p3&&qb.p3){ const f=qa.pl===2?qa.p3:qb.p3, h=qa.pl===2?qb.p3:qa.p3, g=gap(f,h);
              if(g>0.05) add(S.nm,'линия связи','линия связи соединяет проекции разных точек пространства (расхождение '+g.toFixed(2)+')'); } return; }
          if(qa.pl!==qb.pl){ if(Math.abs(it.a[0]-it.b[0])<0.5||ambiguous(qa.p3)||ambiguous(qb.p3)) return;
            add(S.nm,'отрезок между полями','отрезок '+(strip(it.l)?'«'+strip(it.l)+'» ':'')+'соединяет точку '+PLN[qa.pl]+' проекции с точкой '+PLN[qb.pl]); return; }
          const l=strip(it.l||''), m=/^[a-zа-яhf][₀-₉0-9]*[αβγδ]?(′|″)$/.exec(l);
          if(m&&PN[m[1]]!==qa.pl&&!ambiguous(qa.p3)&&!ambiguous(qb.p3)) add(S.nm,'прямая не на своём поле','«'+l+'» нарисована на '+PLN[qa.pl]+' проекции'); }
        if((it.t==='poly'||it.t==='hatch'||it.t==='curve')&&Array.isArray(it.p)){ const ps=new Set(it.p.map(src).filter(q=>q&&!ambiguous(q.p3)).map(q=>q.pl));
          if(ps.size>1) add(S.nm,'многоугольник между полями',({poly:'вершины многоугольника',hatch:'вершины штриховки',curve:'точки кривой'})[it.t]+' взяты с обеих проекций'); }
      }));
      /* П2 */
      Object.keys(named).forEach(l=>{ if(!l.endsWith('′')) return; const base=l.slice(0,-1), o=named[base+'″']; if(!o) return;
        if(skipName.has(base)) return;
        let best=Infinity; named[l].forEach(h=>o.forEach(f=>{ best=Math.min(best,gap(f.p3,h.p3)); }));
        if(best>0.05) add(nm,'проекции разных точек',base+'′ и '+base+'″ построены из разных точек пространства (расхождение '+best.toFixed(2)+' в координатах модели)'); });
    }); });
  return out;
};
})();
