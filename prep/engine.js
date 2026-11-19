/* ═══════════ PREP: подготовка к ДЗ и РК — тема = смотри по шагам → дуэль двух карточек до освоения ═══════════
   Адреса: #/prep — программа курса (PREPROG, kernel/prep.js); #/prep/for/ng4 — темы к ДЗ №4; #/prep/<тема> — тема.
   Тема регистрируется PREP.topic(id, {watch, make, scene, traps, fair?}):
     make()            → V — случайные данные (каждая пара — новые числа: запомнить ответ нельзя, нужно понять принцип);
     scene(V, trap)    → {box:[x,y,w,h], axis, base:[эл.], E:[эл. с role]} или null; trap = null — верный шаг;
     traps             → {K:{b0, say, src, hl:[роли], step}} — одна типичная ошибка = одно отличие чертежа;
     watch             → {V?:()=>V, steps:[{cap, roles}]} — разбор по шагам на одном варианте;
     fair(V, trap)     → можно ли честно показать эту пару (отличие заметно, точки не слиплись).
   Элемент: {t:'line',a:[x1,y1,x2,y2]} {t:'circ',a:[cx,cy,r]} {t:'poly',p:[[x,y]…],z?} {t:'pt',a:[x,y],lab,side} {t:'txt',a:[x,y],s};
   цвет — класс c: o (очерк), ax, cl (осевая), a (посредник), b, c, d (сечения), lk (линия связи), ans (искомое), hid (штрих).
   Проверка знания (одинакова для всех тем):
   • рейтинги Эло студента θ и ловушки b; вероятность верного выбора из двух p = ½ + ½·σ(1,7·(θ − b)) — модель с угадыванием ½;
   • следующая ловушка — где p ближе к 0,85 (Wilson и др., Nature Communications, 2019); промах возвращает её через две пары;
   • знание — байесовское отслеживание (Corbett, Anderson, 1994): угадывание g зависит от ловушки (очевидную угадать легче —
     победа над ней весит меньше), медленный верный ответ весит вдвое меньше;
   • освоено: P(знает) ≥ 0,985, последние 4 ответа верны, не меньше 6 пар, побеждены все неочевидные ловушки (b₀ ≥ 0);
     повтор через 1 → 3 → 7 → 16 → 35 дней.
   Цвета экранов — токены --pp-* (ниже, привязаны к токенам сайта): новый дизайн меняет их в одном месте. */
(function(){
'use strict';
const NS='http://www.w3.org/2000/svg';
const TOPICS={};
const KEY='nch_prep';
const DAY=864e5, SPACING=[1,3,7,16,35];

/* ───────── хранение: только в этом браузере ───────── */
const store={
  all(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ return {}; } },
  get(id){ return this.all()[id]||null; },
  set(id,v){ try{ const a=this.all(); a[id]=v; localStorage.setItem(KEY,JSON.stringify(a)); }catch(e){} }
};
function status(id){ const s=store.get(id); if(!s||!s.mast) return s&&s.n?'started':'new';
  const due=s.mast+SPACING[Math.min(SPACING.length-1,Math.max(0,(s.lvl||1)-1))]*DAY; return Date.now()>=due?'due':'done'; }

/* ───────── модель знания ───────── */
const sig=x=>1/(1+Math.exp(-x));
function Model(topic,saved){
  const K=Object.keys(topic.traps);
  const M={th:0,b:{},pL:.1,n:0,beat:{},miss:{},queue:[],last:null,log:[]};
  K.forEach(k=>{ M.b[k]=topic.traps[k].b0; M.beat[k]=0; M.miss[k]=0; });
  /* повтор: стартуем ближе к прошлому уровню, но тему всё равно нужно подтвердить */
  if(saved&&saved.mast){ M.th=Math.min(1,saved.th||0); M.pL=.5; }
  const pc=k=>.5+.5*sig(1.7*(M.th-M.b[k]));
  const guess=k=>Math.min(.78,Math.max(.5,.5+.14*(-topic.traps[k].b0)));
  M.pc=pc;
  M.next=function(){
    const due=M.queue.findIndex(q=>q.at<=M.n&&(q.k!==M.last||K.length===1));
    if(due>=0) return M.queue.splice(due,1)[0].k;
    let cand=K.filter(k=>k!==M.last); if(!cand.length) cand=K.slice();   /* у темы одна ловушка — повторяем её на новых числах */
    if(M.pL>=.85){ const need=cand.filter(k=>topic.traps[k].b0>=0&&!M.beat[k]); if(need.length) return need[Math.random()*need.length|0]; }
    const w=cand.map(k=>Math.exp(-Math.pow((pc(k)-.85)/.07,2))*(M.beat[k]?1:1.8)+.02);
    let r=Math.random()*w.reduce((a,b)=>a+b,0); for(let i=0;i<cand.length;i++){ r-=w[i]; if(r<=0) return cand[i]; } return cand[0];
  };
  M.answer=function(k,ok,ms){
    const p=pc(k), Kf=Math.max(.35,1.2/Math.sqrt(1+M.n)), o=ok?1:0;
    M.th+=Kf*(o-p)*2; M.b[k]-=.35*(o-p);
    const g=guess(k), s=.1, T=.02, L=M.pL;
    let post=ok?L*(1-s)/(L*(1-s)+(1-L)*g):L*s/(L*s+(1-L)*(1-g));
    if(ok&&ms>15000) post=(post+L)/2;
    M.pL=post+(1-post)*T; M.n++;
    if(ok) M.beat[k]++; else { M.miss[k]++; M.queue.push({k,at:M.n+2}); }
    M.log.push({k,ok,p:Math.round(p*100),pL:Math.round(M.pL*100)});
  };
  /* освоено: P(знает) ≥ 0,985, последние 4 ответа верны, не меньше 6 пар и побеждены все неочевидные ловушки
     (моделирование tests/prep.js на каждой теме: «знает» — 14–16 пар, «угадывает» — ложное «освоено» около 1 % в худшей теме, 0,2 % в среднем) */
  M.mastered=()=>M.pL>=.985&&M.n>=6&&M.log.slice(-4).length===4&&M.log.slice(-4).every(x=>x.ok)&&K.filter(k=>topic.traps[k].b0>=0).every(k=>M.beat[k]>0);
  return M;
}

/* ───────── чертёж ───────── */
const el=(tag,at,par)=>{ const e=document.createElementNS(NS,tag); for(const k in at) if(at[k]!=null) e.setAttribute(k,at[k]); if(par) par.appendChild(e); return e; };
const fmt=v=>Math.round(v*100)/100;
function shape(e,g,cls){
  let n;
  if(e.t==='line') n=el('line',{x1:fmt(e.a[0]),y1:fmt(e.a[1]),x2:fmt(e.a[2]),y2:fmt(e.a[3])},g);
  else if(e.t==='circ') n=el('circle',{cx:fmt(e.a[0]),cy:fmt(e.a[1]),r:fmt(e.a[2])},g);
  else if(e.t==='poly') n=el(e.z?'polygon':'polyline',{points:e.p.map(q=>fmt(q[0])+','+fmt(q[1])).join(' ')},g);
  else if(e.t==='pt') n=el('circle',{cx:fmt(e.a[0]),cy:fmt(e.a[1]),r:e.r||1.5},g);
  else if(e.t==='txt'){ n=el('text',{x:fmt(e.a[0]),y:fmt(e.a[1]),'text-anchor':e.anchor||'start'},g); n.textContent=e.s; }
  if(!n) return null;
  n.setAttribute('class',(cls||'')+' '+(e.t==='pt'?'pt '+(e.c||'ans'):(e.c||'o'))+(e.dash?' hid':''));
  return n;
}
function label(e,g){ if(e.t!=='pt'||!e.lab) return null;
  const side=e.side||1, up=e.up!=null?e.up:e.a[1]<0;
  const t=el('text',{x:fmt(e.a[0]+(side<0?-2.6:2.6)),y:fmt(e.a[1]+(up?-2.8:7.4)),'text-anchor':side<0?'end':'start'},g);
  /* «A^IV» — римский индекс новой плоскости надстрочно, как в учебнике */
  if(e.lab.includes('^')){ e.lab.split(/(\^[IVX]+)/).filter(Boolean).forEach(part=>{ const sup=part[0]==='^';
      const ts=el('tspan',sup?{dy:'-2.4','font-size':'4.6'}:{dy:t.childNodes.length&&t.lastChild.dataset.sup?'2.4':'0'},t); ts.textContent=sup?part.slice(1):part; if(sup) ts.dataset.sup=1; }); }
  else t.textContent=e.lab; return t; }
/* scene → svg; show — какие роли видны (null — все); anim — роли, которые появляются по очереди */
function draw(svg,S,show,anim){
  svg.innerHTML=''; svg.setAttribute('viewBox',S.box.join(' ')); svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  const b=S.box, gg=el('g',{class:'pp-grid'},svg);
  for(let x=Math.ceil(b[0]/5)*5;x<b[0]+b[2];x+=5) el('line',{x1:x,y1:b[1],x2:x,y2:b[1]+b[3]},gg);
  for(let y=Math.ceil(b[1]/5)*5;y<b[1]+b[3];y+=5) el('line',{x1:b[0],y1:y,x2:b[0]+b[2],y2:y},gg);
  if(S.axis!=null){ el('line',{class:'ax',x1:b[0]+2,y1:S.axis,x2:b[0]+b[2]-2,y2:S.axis},svg); const t=el('text',{class:'small',x:b[0]+b[2]-7,y:S.axis-2.2},svg); t.textContent='x'; }
  const base=el('g',{},svg); (S.base||[]).forEach(e=>{ shape(e,base); label(e,base); });
  const g=el('g',{},svg), lab=el('g',{},svg); let k=0;
  for(const e of S.E){
    if(show&&!show.includes(e.role)) continue;
    const n=shape(e,g); if(!n) continue; n.dataset.role=e.role;
    const t=label(e,lab); if(t) t.dataset.role=e.role;
    if(anim&&anim.includes(e.role)){
      const d=(k++)*.16;
      if(e.t==='pt'||e.t==='txt') n.classList.add('pop'); else { n.setAttribute('pathLength','1'); n.classList.add('draw'); }
      n.style.animationDelay=d+'s'; if(t){ t.classList.add('fade'); t.style.animationDelay=d+.1+'s'; }
    }
  }
  return svg;
}
/* подсветка отличия: на неверной — красным, на верной — зелёным, на неверной ещё и «как надо» пунктиром */
function mark(svgBad,svgOk,Sok,roles){
  roles.forEach(r=>{ svgBad.querySelectorAll(`[data-role="${r}"]`).forEach(n=>n.classList.add('hl-bad')); svgOk.querySelectorAll(`[data-role="${r}"]`).forEach(n=>n.classList.add('hl-ok')); });
  const g=el('g',{},svgBad);
  Sok.E.filter(e=>roles.includes(e.role)&&e.t!=='txt').forEach(e=>{ const n=shape(Object.assign({},e,{c:'ghost',dash:false}),g); if(n){ n.setAttribute('class','ghost'); if(e.t==='pt') n.setAttribute('r',2.6); } });
}

/* ───────── пара для дуэли ───────── */
function pair(topic,k){
  for(let t=0;t<120;t++){
    const V=topic.make.call(topic); if(!V) continue; const ok=topic.scene(V,null), bad=topic.scene(V,k);
    if(!ok||!bad) continue;
    if(topic.fair&&!topic.fair(V,k,ok,bad)) continue;
    return {V,ok,bad};
  }
  return null;
}

/* ───────── экраны ───────── */
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const P=()=>self.PREPROG;
function dotCls(id){ const st=status(id); return TOPICS[id]?st:'soon'; }
function viewProgram(v,forKey){
  const G=P(), need=forKey?G.need(forKey):null, A=G.audit();
  const ready=G.ALL.filter(t=>TOPICS[t.id]).length;
  const label={ng1:'ДЗ 1',ng2:'ДЗ 2',ng3:'ДЗ 3',ng4:'ДЗ 4',ng5:'ДЗ 5',rk1:'РК1',rk2:'РК2',rk3:'РК3'};
  const chips=[['','Всё']].concat(Object.keys(label).map(k=>[k,label[k]]));
  v.innerHTML=`<div class="wrap page pp"><div class="pp-head"><h1>Подготовка по начерту</h1>
    <p class="pp-sub">${G.ALL.length} тем. В каждой одна новая идея: смотришь по шагам, потом выбираешь верный чертёж из двух.</p></div>
    <div class="pp-proof"><span><b>${A.wb.length}/89</b> задач тетради</span><span><b>${A.rk1.length}/${G.RK1.length}</b> вопросов РК1</span><span><b>${A.rk2.length}/9</b> типов РК2</span><span><b>${ready}</b> тем готово</span></div>
    <nav class="pp-chips" aria-label="Что сдаёшь">${chips.map(([k,s])=>`<a href="#/prep${k?'/for/'+k:''}" class="${(forKey||'')===k?'on':''}">${s}</a>`).join('')}</nav>
    ${need?`<p class="pp-need">${need.size} тем к ${label[forKey]||''} · освоено ${[...need].filter(id=>status(id)==='done').length}</p>`:''}
    <div class="pp-map ${need?'dim':''}">${G.MODS.map(m=>`<section><h2>${esc(m.t)} <small>${m.k}</small></h2>
      ${m.T.map(t=>{ const c=dotCls(t.id), hit=need&&need.has(t.id);
        const tag=c==='done'?'✓':c==='due'?'повтор':c==='started'?'начата':c==='soon'?'скоро':'';
        return `<a class="pp-st ${c} ${hit?'hit':''}" href="#/prep/${t.id}"><span class="pp-dot"></span><span class="pp-tt">${esc(t.t)}<small>${esc(t.new)}</small></span>${tag?`<span class="pp-tag ${c}">${tag}</span>`:''}</a>`; }).join('')}
      ${m.gate?`<div class="pp-gate">${m.gate.map(([c,s])=>`<span class="${c}">${s}</span>`).join('')}</div>`:''}</section>`).join('')}</div></div>`;
  return forKey?'Подготовка к '+(label[forKey]||''):'Подготовка';
}

function viewTopic(v,id){
  const G=P(), T=G.BY[id], topic=TOPICS[id];
  if(!T){ v.innerHTML='<div class="wrap page"><div class="box warn">Такой темы нет. <a href="#/prep">Вся программа</a></div></div>'; return 'Подготовка'; }
  if(!topic){
    v.innerHTML=`<div class="wrap page pp"><a class="pp-back" href="#/prep">← Программа</a><h1>${esc(T.t)}</h1><p class="pp-new">${esc(T.new)}</p>
      <div class="box">Эту тему ещё собираем. Источник: ${esc(T.src||'—')}.</div>
      ${T.pre.length?`<p class="pp-sub">Опирается на: ${T.pre.map(p=>`<a href="#/prep/${p}">${esc(G.BY[p].t)}</a>`).join(', ')}</p>`:''}</div>`;
    return T.t;
  }
  const saved=store.get(id);
  document.body.classList.add('inplayer');
  v.innerHTML=`<div class="pp pp-topic"><div class="pp-bar"><a class="pp-back" href="#/prep" aria-label="К программе">←</a>
    <div class="pp-ttl"><b>${esc(T.t)}</b><small>${esc(T.new)}</small></div><div class="pp-seg" role="tablist"><button data-ph="watch">Смотри</button><button data-ph="duel">Проверка</button></div></div>
    <div class="pp-stage" id="ppStage"></div></div>`;
  const stage=v.querySelector('#ppStage'), seg=v.querySelector('.pp-seg');
  const setPh=ph=>{ seg.querySelectorAll('button').forEach(b=>{ b.classList.toggle('on',b.dataset.ph===ph); b.setAttribute('aria-selected',b.dataset.ph===ph); });
    if(ph==='watch') watch(stage,topic,T,()=>setPh('duel')); else duel(stage,topic,T,saved,()=>setPh('watch')); };
  seg.onclick=e=>{ const b=e.target.closest('button'); if(b) setPh(b.dataset.ph); };
  setPh(saved&&saved.n?'duel':'watch');
  return T.t;
}

/* «Смотри»: шаги на одном варианте, новое на каждом шаге рисуется по очереди */
/* ───────── 3D: та же сцена в пространстве (topic.space) ─────────
   Примитивы (мир: x — вправо, y — к зрителю, z — вверх): {t:'seg',a,b}, {t:'circ',c0 (центр),n,r}, {t:'poly',p}, {t:'quad',p} (плоскость,
   полупрозрачно), {t:'pt',p,lab,pr:{h,f}}; цвет — класс c, как на эпюре; role — как у элементов эпюра (шаги «Смотри»).
   pr — роли точек эпюра, которыми эта точка проецируется на π₁ (h) и π₂ (f): tests/prep.js сверяет 3D с эпюром. */
const COLV={o:'--pp-draw-ink',a:'--pp-a',b:'--pp-b',c:'--pp-c',d:'--pp-d',lk:'--pp-thin',ans:'--pp-ans',crv:'--pp-ans',ax:'--pp-thin',cl:'--pp-thin'};
const PLANE={p1:'rgba(214,190,130,.16)',p2:'rgba(120,170,230,.14)',a:'rgba(37,87,214,.10)',b:'rgba(11,143,132,.10)',c:'rgba(212,120,10,.10)',d:'rgba(138,63,252,.10)'};
function draw3D(cv,prims,show,st){
  const dpr=Math.min(2,window.devicePixelRatio||1), w=cv.clientWidth||300, h=cv.clientHeight||300;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){ cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); }
  const ctx=cv.getContext('2d'), W=cv.width, H=cv.height, cs=getComputedStyle(cv), col=c=>(cs.getPropertyValue(COLV[c]||'--pp-draw-ink')||'#1b2230').trim();
  const vis=prims.filter(q=>!q.role||!show||show.includes(q.role));
  const all=[]; prims.forEach(q=>{ if(q.a) all.push(q.a,q.b); if(q.p&&q.t!=='pt') all.push(...q.p); if(q.t==='pt') all.push(q.p); if(q.t==='circ'){ all.push(q.c0.map(v=>v+q.r),q.c0.map(v=>v-q.r)); } });
  const mn=[0,1,2].map(k=>Math.min(...all.map(p=>p[k]))), mx=[0,1,2].map(k=>Math.max(...all.map(p=>p[k]))), c0=mn.map((v,k)=>(v+mx[k])/2);
  const R=Math.max(1,Math.hypot(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])/2), sc=Math.min(W,H)/(2.15*R);
  const cy=Math.cos(st.yaw), sy=Math.sin(st.yaw), cp=Math.cos(st.pitch), sp=Math.sin(st.pitch);
  const P=p=>{ const x=p[0]-c0[0], y=p[1]-c0[1], z=p[2]-c0[2], xr=x*cy+y*sy, yr=-x*sy+y*cy; return [W/2+sc*xr, H/2-sc*(z*cp-yr*sp), yr*cp+z*sp]; };
  ctx.clearRect(0,0,W,H); ctx.lineCap='round'; ctx.lineJoin='round';
  const path=pts=>{ ctx.beginPath(); pts.forEach((p,k)=>{ const q=P(p); k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); }); };
  const ring=q=>{ const n=q.n, l=Math.hypot(...n), u=n.map(v=>v/l), a=Math.abs(u[0])<.9?[1,0,0]:[0,1,0];
    let e1=[u[1]*a[2]-u[2]*a[1],u[2]*a[0]-u[0]*a[2],u[0]*a[1]-u[1]*a[0]]; const l1=Math.hypot(...e1); e1=e1.map(v=>v/l1); const e2=[u[1]*e1[2]-u[2]*e1[1],u[2]*e1[0]-u[0]*e1[2],u[0]*e1[1]-u[1]*e1[0]];
    return Array.from({length:65},(_,k)=>{ const t=k/64*2*Math.PI; return q.c0.map((v,m)=>v+q.r*(Math.cos(t)*e1[m]+Math.sin(t)*e2[m])); }); };
  /* плоскости — от дальних к ближним */
  vis.filter(q=>q.t==='quad').map(q=>({q,d:q.p.reduce((s,p)=>s+P(p)[2],0)/q.p.length})).sort((a,b)=>a.d-b.d).forEach(({q})=>{
    path(q.p); ctx.closePath(); ctx.fillStyle=PLANE[q.c]||PLANE.a; ctx.fill(); ctx.strokeStyle='rgba(90,100,120,.35)'; ctx.lineWidth=1*dpr; ctx.stroke(); });
  for(const q of vis){ if(q.t==='quad'||q.t==='pt') continue;
    ctx.strokeStyle=col(q.c||'o'); ctx.lineWidth=(q.c==='o'?1.6:q.c==='lk'||q.c==='ax'?1:2.2)*dpr*(q.w||1); ctx.setLineDash(q.dash?[5*dpr,4*dpr]:[]);
    if(q.t==='seg') path([q.a,q.b]); else if(q.t==='poly') path(q.p); else if(q.t==='circ') path(ring(q)); ctx.stroke(); }
  ctx.setLineDash([]); ctx.font=`italic ${13*dpr}px NchGost, NchSerif, serif`;
  for(const q of vis.filter(q=>q.t==='pt')){ const s=P(q.p); ctx.beginPath(); ctx.arc(s[0],s[1],(q.r||3.4)*dpr,0,7); ctx.fillStyle=col(q.c||'ans'); ctx.fill(); ctx.lineWidth=1.5*dpr; ctx.strokeStyle='#fff'; ctx.stroke();
    if(q.lab){ ctx.lineWidth=3*dpr; ctx.strokeStyle='#fff'; ctx.strokeText(q.lab,s[0]+5*dpr,s[1]-5*dpr); ctx.fillStyle=col('o'); ctx.fillText(q.lab,s[0]+5*dpr,s[1]-5*dpr); } }
}
/* плоскости проекций π₁ (y ≥ 0) и π₂ (z ≥ 0) и ось x — рамка сцены */
function frame3(x0,x1,y1,z1){ return [{t:'quad',c:'p1',p:[[x0,0,0],[x1,0,0],[x1,y1,0],[x0,y1,0]]},{t:'quad',c:'p2',p:[[x0,0,0],[x1,0,0],[x1,0,z1],[x0,0,z1]]},{t:'seg',c:'ax',a:[x0,0,0],b:[x1,0,0]}]; }
/* точка с проекциями: падающие линии на π₁ и π₂ */
function point3(p,role,lab,pr,c){ return [{t:'seg',c:'lk',a:p,b:[p[0],p[1],0],role,dash:true},{t:'seg',c:'lk',a:p,b:[p[0],0,p[2]],role,dash:true},{t:'pt',p,lab,pr,role,c}]; }

/* «Смотри»: шаги на одном варианте; новое на каждом шаге рисуется по очереди; если у темы есть пространство — переключатель «Эпюр | 3D» */
function watch(stage,topic,T,toDuel){
  const W=topic.watch; let V=null; for(let t=0;t<50&&!(V&&topic.scene(V,null));t++) V=W.V?W.V.call(topic):topic.make.call(topic); let i=0;
  const S=topic.scene(V,null), sp=topic.space?topic.space(V):null;
  stage.innerHTML=`<div class="pp-watch"><div class="pp-card big"><svg aria-label="Чертёж шага"></svg>${sp?'<canvas class="pp-3d" hidden aria-label="Шаг в пространстве"></canvas><div class="pp-vt" role="tablist"><button data-v="e" class="on">Эпюр</button><button data-v="3">3D</button></div>':''}</div>
    <div class="pp-panel"><p class="pp-cap" id="ppCap"></p><div class="pp-dots">${W.steps.map(()=>'<i></i>').join('')}</div>
    <div class="pp-row"><button class="pp-btn ghost" id="ppPrev" aria-label="Шаг назад">←</button><button class="pp-btn" id="ppNext">Дальше →</button></div></div></div>`;
  const svg=stage.querySelector('svg'), cap=stage.querySelector('#ppCap'), cv=stage.querySelector('canvas');
  const st={yaw:-.6,pitch:.42,mode:'e',idle:0,drag:null};
  const roles=()=>W.steps[i].roles;
  const paint3=()=>{ if(cv&&st.mode==='3') draw3D(cv,sp,roles(),st); };
  const show=()=>{ const s0=W.steps[i], prev=i?W.steps[i-1].roles:[];
    draw(svg,S,s0.roles,s0.roles.filter(r=>!prev.includes(r))); cap.textContent=s0.cap; paint3();
    stage.querySelectorAll('.pp-dots i').forEach((d,j)=>d.classList.toggle('on',j<=i));
    stage.querySelector('#ppPrev').disabled=!i; stage.querySelector('#ppNext').textContent=i===W.steps.length-1?'К проверке →':'Дальше →'; };
  if(cv){
    stage.querySelector('.pp-vt').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; st.mode=b.dataset.v;
      stage.querySelectorAll('.pp-vt button').forEach(x=>x.classList.toggle('on',x===b)); svg.hidden=st.mode==='3'; cv.hidden=st.mode!=='3'; paint3();
      try{ window.TRACK&&TRACK('prep_3d',{topic:T.id}); }catch(e){} };
    cv.style.touchAction='none';
    cv.addEventListener('pointerdown',e=>{ st.drag=[e.clientX,e.clientY,st.yaw,st.pitch]; try{ cv.setPointerCapture(e.pointerId); }catch(_){} });
    cv.addEventListener('pointermove',e=>{ if(!st.drag) return; st.yaw=st.drag[2]+(e.clientX-st.drag[0])*.01; st.pitch=Math.max(.05,Math.min(1.25,st.drag[3]+(e.clientY-st.drag[1])*.006)); st.idle=performance.now()+4000; paint3(); });
    cv.addEventListener('pointerup',()=>{ st.drag=null; });
    const rm=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
    const tick=t=>{ if(!cv.isConnected) return; if(st.mode==='3'&&!st.drag&&!rm&&t>st.idle){ st.yaw+=.004; paint3(); } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  stage.querySelector('#ppPrev').onclick=()=>{ if(i>0){ i--; show(); } };
  stage.querySelector('#ppNext').onclick=()=>{ if(i<W.steps.length-1){ i++; show(); } else toDuel(); };
  show();
}

/* «Проверка»: карточка сверху, панель с прогрессом посередине, карточка снизу (на широком экране — рядом) */
function duel(stage,topic,T,saved,toWatch){
  const M=Model(topic,saved), keys=Object.keys(topic.traps);
  stage.innerHTML=`<div class="pp-duel"><div class="pp-card" id="ppA" tabindex="0" role="button" aria-label="Первый чертёж"><svg></svg></div>
    <div class="pp-panel mid"><div class="pp-meter"><div class="pp-prog"><i id="ppBar"></i></div><span id="ppPct">0%</span></div>
      <div class="pp-deck" id="ppDeck" aria-label="Ловушки темы">${keys.map(k=>`<span data-k="${k}"></span>`).join('')}</div>
      <div class="pp-verd" id="ppVerd"><span class="pp-q">Где верно?</span></div></div>
    <div class="pp-card" id="ppB" tabindex="0" role="button" aria-label="Второй чертёж"><svg></svg></div></div>`;
  const A=stage.querySelector('#ppA'), B=stage.querySelector('#ppB'), verd=stage.querySelector('#ppVerd');
  let cur=null, locked=false;
  const meter=()=>{ const p=Math.round(Math.min(1,M.pL)*100); stage.querySelector('#ppBar').style.width=p+'%'; stage.querySelector('#ppPct').textContent=p+'%';
    stage.querySelectorAll('#ppDeck span').forEach(s=>{ s.classList.toggle('won',M.beat[s.dataset.k]>0); s.classList.toggle('hot',!M.beat[s.dataset.k]&&M.miss[s.dataset.k]>0); }); };
  const next=()=>{
    const k=M.next(); const pr=pair(topic,k); if(!pr){ M.last=k; return next(); }
    cur={k,pr,okTop:Math.random()<.5,t0:performance.now()}; M.last=k; locked=false;
    [A,B].forEach(c=>c.className='pp-card');
    draw(A.querySelector('svg'),cur.okTop?pr.ok:pr.bad); draw(B.querySelector('svg'),cur.okTop?pr.bad:pr.ok);
    verd.innerHTML='<span class="pp-q">Где верно?</span>';
  };
  const save=()=>{ const prev=store.get(T.id)||{}; const rec={n:(prev.n||0)+1,th:M.th,pL:M.pL,mast:prev.mast||0,lvl:prev.lvl||0,last:Date.now()};
    if(M.mastered()&&!M._saved){ M._saved=1; rec.mast=Date.now(); rec.lvl=(prev.lvl||0)+1; } store.set(T.id,rec); };
  const choose=top=>{
    if(locked||!cur) return; locked=true;
    const ok=top===cur.okTop, ms=performance.now()-cur.t0, tr=topic.traps[cur.k];
    M.answer(cur.k,ok,ms); save(); meter();
    try{ window.TRACK&&TRACK('prep_answer',{topic:T.id,trap:cur.k,ok:ok?1:0}); }catch(e){}
    const okC=cur.okTop?A:B, badC=cur.okTop?B:A; okC.classList.add('ok');
    if(ok){ badC.classList.add('dim'); draw(okC.querySelector('svg'),cur.pr.ok,null,cur.pr.ok.E.map(e=>e.role));
      verd.innerHTML='<span class="pp-ok">Верно</span>';
      try{ window.FX&&FX.buzz('tick'); }catch(e){}
      setTimeout(()=>{ if(M.mastered()) done(); else next(); },1300);
    } else { badC.classList.add('bad'); mark(badC.querySelector('svg'),okC.querySelector('svg'),cur.pr.ok,tr.hl);
      verd.innerHTML=`<span class="pp-bad">${esc(tr.say)}</span><button class="pp-btn" id="ppNx">Дальше →</button>`;
      try{ window.FX&&FX.buzz('error'); }catch(e){}
      const nx=verd.querySelector('#ppNx'); nx.onclick=next; try{ nx.focus({preventScroll:true}); }catch(e){} }
  };
  const done=()=>{
    try{ window.TRACK&&TRACK('prep_mastered',{topic:T.id,n:M.n}); }catch(e){}
    try{ window.FX&&FX.confetti(); }catch(e){}
    const G=P(), nextT=G.ALL[G.POS[T.id]+1];
    stage.innerHTML=`<div class="pp-done"><div class="pp-big">${M.n}</div><h2>Тема освоена</h2><p class="pp-sub">пар до уверенности · верно ${M.log.filter(x=>x.ok).length}</p>
      <div class="pp-deck">${keys.map(k=>`<span class="${M.beat[k]?'won':''}" title="${esc(topic.traps[k].say)}"></span>`).join('')}</div>
      <p class="pp-sub">Повторим через ${SPACING[Math.min(SPACING.length-1,((store.get(T.id)||{}).lvl||1)-1)]} дн. — так тема не забудется.</p>
      <div class="pp-row">${nextT?`<a class="pp-btn" href="#/prep/${nextT.id}">Дальше: ${esc(nextT.t)} →</a>`:''}<a class="pp-btn ghost" href="#/prep">Программа</a></div>
      <details class="pp-how"><summary>Почему система решила, что ты освоил</summary><table>${keys.map(k=>`<tr><td>${esc(topic.traps[k].say)}</td><td>${M.beat[k]} ✓</td><td>${M.miss[k]} ✗</td><td>${esc(topic.traps[k].src||'')}</td></tr>`).join('')}</table>
      <p>Пары подбирались так, чтобы шанс ответить верно был около 85 %. Угадывание в выборе из двух учтено: тема засчитана, когда вероятность «знает» стала выше 98,5 % и четыре последних ответа подряд верны.</p></details></div>`;
  };
  const key=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); choose(e.currentTarget===A); } };
  A.onclick=()=>choose(true); B.onclick=()=>choose(false); A.onkeydown=key; B.onkeydown=key;
  next(); meter();
}

/* ───────── карточка «Подготовка» на странице ДЗ ───────── */
function card(dz){
  const G=P(); if(!G) return '';
  const S=[...G.need(dz)], done=S.filter(id=>status(id)==='done').length, ready=S.filter(id=>TOPICS[id]).length;
  const first=S.map(id=>G.BY[id]).sort((a,b)=>G.POS[a.id]-G.POS[b.id]).find(t=>TOPICS[t.id]&&status(t.id)!=='done');
  const n=dz.slice(2);
  return `<a class="pp-dzcard" href="#/prep/for/${dz}"><span class="pp-dzk">Подготовка к ДЗ №${n}</span>
    <b>${done}/${S.length} тем освоено</b><span class="pp-prog"><i style="width:${Math.round(done/S.length*100)}%"></i></span>
    <small>${first?'Начни с темы «'+esc(first.t)+'»':ready<S.length?'Остальные темы скоро':'Всё готово — переходи к своему варианту'}</small></a>`;
}

function chip(dz){
  const G=P(); if(!G) return '';
  const S=[...G.need(dz)], done=S.filter(id=>status(id)==='done').length;
  return `<a class="pp-dzchip" href="#/prep/for/${dz}"><b>Подготовка к ДЗ №${dz.slice(2)}</b><span class="pp-prog"><i style="width:${Math.round(done/S.length*100)}%"></i></span><span>${done}/${S.length} →</span></a>`;
}
function view(v,r){
  if(!P()){ v.innerHTML='<div class="wrap page"><div class="box warn">Программа не загрузилась.</div></div>'; return 'Подготовка'; }
  if(r.tab==='for') return viewProgram(v,r.item||'');
  if(r.tab) return viewTopic(v,r.tab);
  return viewProgram(v,'');
}

/* ───────── стили (токены --pp-* — точка входа нового дизайна) ───────── */
const CSS=`
.pp{--pp-bg:var(--paper,#f7f8fb);--pp-surf:var(--surf,#fff);--pp-ink:var(--ink,#121a3f);--pp-mut:var(--mut,#5c6688);--pp-line:var(--line,#e1e5ef);
 --pp-acc:var(--acc,#1f3fbf);--pp-ok:#14a05a;--pp-bad:#e0244e;--pp-dz:#d4780a;--pp-r:14px;
 --pp-a:#2557d6;--pp-b:#0b8f84;--pp-c:#d4780a;--pp-d:#8a3ffc;--pp-ans:#e0244e;--pp-paper:#fff;--pp-grid:#eef1f6;--pp-thin:#8a95a6;--pp-draw-ink:#1b2230}
.pp-head h1{margin:0}.pp-sub{color:var(--pp-mut);margin:6px 0}
.pp-proof{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;color:var(--pp-mut);margin:10px 0}.pp-proof b{color:var(--pp-ink);font-variant-numeric:tabular-nums}
.pp-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px;position:sticky;top:0;z-index:4;background:var(--pp-bg);padding:6px 0}
.pp-chips a{border:1px solid var(--pp-line);background:var(--pp-surf);color:var(--pp-ink);font-weight:600;font-size:13px;padding:6px 11px;border-radius:999px;text-decoration:none}
.pp-chips a.on{background:var(--pp-acc);border-color:var(--pp-acc);color:#fff}
.pp-need{font-size:13px;color:var(--pp-mut)}
.pp-map section{margin:14px 0 4px}.pp-map h2{font-size:18px;margin:0 0 4px}.pp-map h2 small{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--pp-mut);font-weight:600}
.pp-st{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:7px 4px 7px 0;color:var(--pp-ink);text-decoration:none;position:relative;border-radius:10px;transition:opacity .2s}
.pp-st::before{content:"";position:absolute;left:13px;top:0;bottom:0;width:3px;background:var(--pp-line)}
.pp-dot{position:relative;z-index:1;width:14px;height:14px;margin-left:7px;border-radius:50%;background:var(--pp-surf);border:3px solid var(--pp-acc)}
.pp-st.done .pp-dot{background:var(--pp-ok);border-color:var(--pp-ok)}.pp-st.due .pp-dot{border-color:var(--pp-dz)}.pp-st.soon .pp-dot{border-color:var(--pp-line)}
.pp-tt{font-weight:600;min-width:0}.pp-tt small{display:block;font-weight:400;font-size:13px;color:var(--pp-mut)}
.pp-tag{font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;border:1px solid var(--pp-line);color:var(--pp-mut);white-space:nowrap}
.pp-tag.done{background:var(--pp-ok);border-color:var(--pp-ok);color:#fff}.pp-tag.due{border-color:var(--pp-dz);color:var(--pp-dz)}
.pp-map.dim .pp-st{opacity:.28}.pp-map.dim .pp-st.hit{opacity:1}
.pp-gate{display:flex;gap:6px;flex-wrap:wrap;padding:8px 0 8px 36px}.pp-gate span{font-size:12px;font-weight:700;color:#fff;padding:3px 8px;border-radius:6px;background:var(--pp-dz)}
.pp-gate .rk{background:var(--pp-bad)}.pp-gate .later{background:var(--pp-mut)}
.pp-topic{max-width:1100px;margin:0 auto;height:100%;display:flex;flex-direction:column;box-sizing:border-box;padding:0 max(12px,env(safe-area-inset-right,0px)) 0 max(12px,env(safe-area-inset-left,0px))}
.pp-bar{flex:none;display:flex;align-items:center;gap:8px;padding:6px 0}
.pp-back{font-weight:700;text-decoration:none;color:var(--pp-ink);font-size:20px;padding:4px 8px}
.pp-ttl{flex:1;min-width:0}.pp-ttl b{display:block;font-size:15px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pp-ttl small{display:block;color:var(--pp-mut);font-size:12px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-seg{display:flex;gap:3px;background:var(--pp-surf);border:1px solid var(--pp-line);border-radius:999px;padding:3px}
.pp-seg button{border:0;background:none;color:var(--pp-mut);font-weight:600;font-size:13px;padding:6px 11px;border-radius:999px;cursor:pointer}
.pp-seg button.on{background:var(--pp-acc);color:#fff}
.pp-card{background:var(--pp-paper);border-radius:var(--pp-r);border:3px solid transparent;overflow:hidden;min-height:0;display:flex;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:border-color .2s,opacity .2s,transform .12s;box-shadow:0 1px 0 rgba(0,0,0,.04),0 8px 28px -14px rgba(20,30,50,.3)}
.pp-card:active{transform:scale(.99)}.pp-card svg{width:100%;height:100%;display:block}
.pp-card.ok{border-color:var(--pp-ok)}.pp-card.bad{border-color:var(--pp-bad)}.pp-card.dim{opacity:.5}
.pp-card:focus-visible,.pp-btn:focus-visible{outline:3px solid var(--pp-acc);outline-offset:2px}
.pp-stage{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto;padding-bottom:calc(8px + env(safe-area-inset-bottom,0px))}
.pp-watch{flex:1;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;gap:10px}
.pp-watch .pp-card{cursor:default;position:relative}
.pp-3d{width:100%;height:100%;display:block;background:var(--pp-paper)}
.pp-vt{position:absolute;right:8px;top:8px;display:flex;gap:2px;background:rgba(255,255,255,.92);border:1px solid #dfe3ec;border-radius:999px;padding:2px}
.pp-vt button{border:0;background:none;font-weight:700;font-size:12px;padding:5px 10px;border-radius:999px;color:#5c6688;cursor:pointer}
.pp-vt button.on{background:var(--pp-acc);color:#fff}
.pp-duel{flex:1;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto minmax(0,1fr);gap:8px}
@media (min-width:900px){.pp-duel{grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1fr) auto}.pp-duel .mid{grid-column:1/3;grid-row:2}}
.pp-panel{display:grid;gap:8px}
.pp-panel.mid{grid-template-columns:auto 1fr;align-items:center;gap:6px 12px;background:var(--pp-surf);border:1px solid var(--pp-line);border-radius:var(--pp-r);padding:8px 12px}
.pp-panel.mid .pp-verd{grid-column:1/3}
.pp-meter{display:flex;align-items:center;gap:8px;min-width:0}
.pp-prog{flex:1;display:block;height:8px;min-width:60px;border-radius:99px;background:var(--pp-line);overflow:hidden}
.pp-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--pp-acc),var(--pp-ok));border-radius:99px;transition:width .6s cubic-bezier(.2,.8,.2,1)}
#ppPct{font-weight:700;font-variant-numeric:tabular-nums;font-size:14px;min-width:3.2ch}
.pp-deck{display:flex;gap:5px;justify-content:flex-end}
.pp-deck span{width:16px;height:22px;border-radius:4px;border:1.5px solid var(--pp-line);background:var(--pp-surf);transition:transform .5s,background .3s}
.pp-deck span.won{background:var(--pp-ok);border-color:var(--pp-ok);transform:rotateY(180deg)}.pp-deck span.hot{border-color:var(--pp-bad)}
.pp-verd{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;min-height:40px;text-align:center}
.pp-q{font-weight:700;font-size:17px}.pp-ok{font-weight:700;color:var(--pp-ok);font-size:17px}.pp-bad{font-weight:700;color:var(--pp-bad);font-size:15px}
.pp-cap{font-weight:700;font-size:clamp(16px,3.6vw,20px);margin:0;text-align:center;min-height:1.3em;text-wrap:balance}
.pp-dots{display:flex;gap:6px;justify-content:center}.pp-dots i{width:8px;height:8px;border-radius:50%;background:var(--pp-line)}.pp-dots i.on{background:var(--pp-acc)}
.pp-row{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap}
.pp-btn{border:0;border-radius:12px;font-weight:700;font-size:15px;padding:12px 18px;cursor:pointer;background:var(--pp-acc);color:#fff;text-decoration:none;display:inline-block}
.pp-btn.ghost{background:var(--pp-surf);color:var(--pp-ink);border:1px solid var(--pp-line)}.pp-btn:disabled{opacity:.4}
.pp-done{flex:none;display:grid;gap:12px;justify-items:center;text-align:center;padding:20px 0}.pp-big{font-size:64px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.pp-done h2{margin:0}.pp-how{width:100%;max-width:640px;text-align:left;background:var(--pp-surf);border:1px solid var(--pp-line);border-radius:12px;padding:10px 14px;font-size:13px}
.pp-how table{width:100%;border-collapse:collapse;margin:8px 0}.pp-how td{padding:4px;border-bottom:1px solid var(--pp-line)}
.pp-new{font-weight:700;color:var(--pp-acc)}
.pp-dzcard{display:grid;gap:4px;padding:12px 14px;border-radius:var(--pp-r);background:var(--surf,#fff);border:2px solid var(--acc,#1f3fbf);color:var(--ink,#121a3f);text-decoration:none;margin:10px 0}
.pp-dzchip{display:flex;align-items:center;gap:10px;padding:6px 12px;margin:4px 0;border-radius:10px;background:var(--surf2,#f3f5fa);color:var(--ink,#121a3f);text-decoration:none;font-size:13px}
.pp-dzchip b{white-space:nowrap}.pp-dzchip .pp-prog{max-width:160px}.pp-dzchip span:last-child{color:var(--acc,#1f3fbf);font-weight:700;white-space:nowrap}
.pp-dzk{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--acc,#1f3fbf)}.pp-dzcard small{color:var(--mut,#5c6688)}
/* чертёж: бумага белая в обеих темах */
.pp svg .pp-grid line{stroke:var(--pp-grid);stroke-width:.3}
.pp svg .o{stroke:var(--pp-draw-ink);stroke-width:.85;fill:none;stroke-linecap:round;stroke-linejoin:round}
.pp svg .ax{stroke:var(--pp-thin);stroke-width:.4}
.pp svg .cl{stroke:var(--pp-thin);stroke-width:.35;fill:none;stroke-dasharray:6 1.6 1 1.6}
.pp svg .a{stroke:var(--pp-a);stroke-width:.75;fill:none}.pp svg .b{stroke:var(--pp-b);stroke-width:.95;fill:none}
.pp svg .c{stroke:var(--pp-c);stroke-width:.95;fill:none}.pp svg .d{stroke:var(--pp-d);stroke-width:.9;fill:none}
.pp svg .lk{stroke:#6b7686;stroke-width:.4;fill:none}.pp svg .crv{stroke:var(--pp-ans);stroke-width:.95;fill:none;stroke-linejoin:round}
.pp svg .hid{stroke-dasharray:2.4 1.4}
.pp svg .pt{fill:var(--pp-ans);stroke:#fff;stroke-width:.5}.pp svg .pt.o{fill:var(--pp-draw-ink)}
.pp svg text{font-family:"NchGost","NchSerif","Liberation Serif",serif;font-style:normal;fill:var(--pp-draw-ink);font-size:7px;paint-order:stroke;stroke:#fff;stroke-width:1.6px;stroke-linejoin:round}
.pp svg text.small{font-size:5.5px;fill:var(--pp-thin)}
.pp svg .draw{stroke-dasharray:1;stroke-dashoffset:1;animation:ppDraw .45s ease-out forwards}
.pp svg .hid.draw{stroke-dasharray:2.4 1.4;stroke-dashoffset:0;animation:ppFade .45s ease-out both}
.pp svg .pop{transform-box:fill-box;transform-origin:center;animation:ppPop .35s cubic-bezier(.3,1.6,.5,1) both}
.pp svg .fade{animation:ppFade .35s ease-out both}
.pp svg .hl-bad{stroke:var(--pp-bad)!important;animation:ppBlink .55s ease-in-out 5 alternate}.pp svg .pt.hl-bad{fill:var(--pp-bad)!important;stroke:#fff!important}
.pp svg .hl-ok{stroke:var(--pp-ok)!important;animation:ppBlink .55s ease-in-out 5 alternate}.pp svg .pt.hl-ok{fill:var(--pp-ok)!important;stroke:#fff!important}
.pp svg text.hl-bad{fill:var(--pp-bad);stroke:#fff!important}.pp svg text.hl-ok{fill:var(--pp-ok);stroke:#fff!important}
.pp svg .ghost{stroke:var(--pp-ok);stroke-dasharray:2 1.4;stroke-width:.9;fill:none;animation:ppBlink .55s ease-in-out 5 alternate}
@keyframes ppDraw{to{stroke-dashoffset:0}}@keyframes ppPop{from{transform:scale(0)}to{transform:scale(1)}}@keyframes ppFade{from{opacity:0}to{opacity:1}}@keyframes ppBlink{from{opacity:1}to{opacity:.15}}
@media (prefers-reduced-motion:reduce){.pp *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition:none!important}}
`;
function css(){ if(document.getElementById('ppCss')) return; const s=document.createElement('style'); s.id='ppCss'; s.textContent=CSS; document.head.appendChild(s); }
if(typeof document!=='undefined') css();

self.PREP={TOPICS,topic(id,o){ TOPICS[id]=Object.assign({id},o); return TOPICS[id]; },frame3,point3,draw3D,view,card,chip,status,Model,pair,draw,store};
})();
