/* ═══════════ Программа построения на листе ═══════════
   Решение задачи — последовательность действий линейкой, угольником и циркулем на эпюре (как в разборе сайта):
     {id:'h′', op:'perp', args:['a′','A′'], draw:{k:'thin', span:['A′','1′']}}
   Каждое действие создаёт объект с именем id (прямую, точку или число) из уже построенных. Одна и та же программа:
     • исполняется точно по «дано» → идеальный чертёж (сверяется с сертификатом core/t47.js, тест core/test.js);
     • исполняется «рукой» с шумом → синтетический лист (lab/synth.js);
     • подгоняется к линиям, найденным на фото, шаг за шагом → интерпретация (lab/interpret.js).
   Ошибка студента — операция над верной программой (заменить действие, убрать шаги), см. core/cp47.js.
   Объекты: прямая {p,d}, точка [u,v], число — Number. Всё в мм листа (core/model.js). */
(function(){
const need=n=>(typeof module!=='undefined'&&module.exports&&typeof require==='function')?require('./'+n+'.js'):((self.CORE&&self.CORE[n])||(self.CERT&&self.CERT[n]));
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CORE=self.CORE||{}; self.CORE[n]=v; } };
const {v2,L2}=need('model');

/* действия: что строится (kind) и как (f) */
const OPS={
  through:{kind:'line',f:(P,Q)=>L2.through(P,Q)},          /* прямая через две точки (линейка) */
  seg:{kind:'line',f:(P,Q)=>L2.through(P,Q)},              /* отрезок между точками — та же прямая, рисуется от P до Q */
  parAxis:{kind:'line',f:P=>L2.parAxis(P)},                /* ∥ оси x (рейсшина) */
  link:{kind:'line',f:P=>L2.link(P)},                      /* линия связи ⟂ оси x */
  perp:{kind:'line',f:(L,P)=>L2.perp(L,P)},                /* ⟂ прямой через точку (угольник) */
  par:{kind:'line',f:(L,P)=>L2.par(L,P)},
  meet:{kind:'point',f:(A,B)=>L2.meet(A,B)},               /* пересечение двух построенных линий */
  foot:{kind:'point',f:(P,L)=>L2.foot(P,L)},               /* основание перпендикуляра из точки */
  /* отложить от P перпендикулярно PQ длину s (циркуль), side = ±1 */
  perpOff:{kind:'point',f:(P,Q,s,side)=>{ const n=v2.perp(v2.unit(v2.sub(Q,P))); return v2.add(P,v2.mul(n,s*(side||1))); }},
  /* отложить от P вдоль луча P→Q длину s */
  along:{kind:'point',f:(P,Q,s)=>v2.add(P,v2.mul(v2.unit(v2.sub(Q,P)),s))},
  shiftU:{kind:'point',f:(P,s)=>[P[0]+s,P[1]]},
  dv:{kind:'num',f:(P,Q)=>Math.abs(P[1]-Q[1])},            /* разность отступов от оси (Δz на π₂, Δy на π₁) */
  du:{kind:'num',f:(P,Q)=>Math.abs(P[0]-Q[0])},
  absV:{kind:'num',f:P=>Math.abs(P[1])},                   /* отступ от оси (координата целиком) */
  dist:{kind:'num',f:(P,Q)=>v2.dist(P,Q)},
};

/* исполнить программу: E — построенные объекты; o.noise(step, value, E) → value («рука»); o.skip(step) → пропустить */
function exec(prog,given,o){ o=o||{}; const E=Object.assign({},given), miss=[];
  for(const st of prog.steps){ if(o.skip&&o.skip(st)) continue;
    const args=st.args.map(a=>typeof a==='string'?E[a]:a);
    if(args.some(a=>a==null)){ miss.push(st.id); continue; }
    let v=OPS[st.op].f(...args); if(v==null){ miss.push(st.id); continue; }
    if(o.noise) v=o.noise(st,v,E);
    E[st.id]=v; }
  return {E,miss}; }

/* чертёж исполненной программы: отрезки (по точкам span, с вылетом ext за крайние), точки с подписями, знаки ⊾.
   o.ext(step) → [вылет в начале, в конце], мм; o.show(step, part) → рисовать ли необязательное */
function draw(prog,E,o){ o=o||{}; const items=[];
  for(const st of prog.steps){ const d=st.draw; if(!d||E[st.id]==null) continue;
    if(o.show&&!o.show(st)) continue;
    const kind=OPS[st.op].kind;
    if(kind==='line'){ const L=E[st.id], span=(d.span||st.args.filter(a=>typeof a==='string'&&Array.isArray(E[a])&&E[a].length===2)).map(n=>E[n]).filter(Boolean);
      if(span.length<1) continue; const ts=span.map(P=>L2.t(P,L)); let t0=Math.min(...ts), t1=Math.max(...ts);
      const ex=st.op==='seg'?[0,0]:(o.ext?o.ext(st):[3,3]); t0-=ex[0]; t1+=ex[1];
      if(d.from==='first'){ t0=ts[0]; }
      const it={t:'seg',a:L2.at(L,t0),b:L2.at(L,t1),k:d.k||'thin',role:st.id,src:'hand',σ:0,conf:1};
      if(d.l) it.l=d.l; items.push(it); }
    if(kind==='point'){ const P=E[st.id];
      if(d.label!==false) items.push({t:'pt',at:P.slice(),l:d.l||st.id,role:st.id,src:'hand',σ:0,conf:1});
      if(d.sq){ const [l1,l2]=d.sq.map(n=>E[n]); if(l1&&l2) items.push({t:'sq',at:P.slice(),p1:L2.at(l1,L2.t(P,l1)+4),p2:L2.at(l2,L2.t(P,l2)+4),role:st.id+'⊾',src:'hand',σ:0,conf:1}); } } }
  return items; }

/* операции над программой — из них собираются ошибки */
const edit={
  clone:p=>Object.assign({},p,{steps:p.steps.map(s=>Object.assign({},s,{draw:s.draw&&Object.assign({},s.draw)}))}),
  /* заменить действие шага id (то, что студент сделал вместо верного) */
  replace:(p,id,ch)=>{ const q=edit.clone(p), s=q.steps.find(x=>x.id===id); if(!s) throw new Error('нет шага '+id); Object.assign(s,ch); return q; },
  /* шаги, которые студент мог сделать, а мог и не делать (на верный ответ они уже не влияют) */
  optional:(p,ids)=>{ const q=edit.clone(p); q.steps.forEach(s=>{ if(ids.includes(s.id)) s.opt=true; }); return q; },
  remove:(p,ids)=>{ const q=edit.clone(p); q.steps=q.steps.filter(s=>!ids.includes(s.id)); return q; },
  insertAfter:(p,id,steps)=>{ const q=edit.clone(p), i=q.steps.findIndex(x=>x.id===id); q.steps.splice(i+1,0,...steps.map(s=>Object.assign({},s))); return q; },
};

put('cp',{OPS,exec,draw,edit});
})();
