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

/* ───────── курсы по этапам (prep/plans.js): PREP.plan(key, {subj, kind, n, label, title, go, stages:[{t, why, topics, learn, do}]}) ───────── */
const PLANS={}, PKEY='nch_prep_plan';
const mstore={ all(){ try{ return JSON.parse(localStorage.getItem(PKEY)||'{}')||{}; }catch(e){ return {}; } },
  set(a){ try{ localStorage.setItem(PKEY,JSON.stringify(a)); }catch(e){} } };
const manual=(k,i)=>!!((mstore.all()[k]||{})[i]);
function setManual(k,i,on){ const a=mstore.all(), o=a[k]||{}; if(on) o[i]=on===true?{t:Date.now(),by:'self'}:on; else delete o[i]; a[k]=o; mstore.set(a); }
const doneSt=id=>{ const s=status(id); return s==='done'||s==='due'; };
/* этап пройден: отмечен вручную или все его темы освоены (повтор по расписанию не отменяет освоения) */
function stDone(k,i){ const st=PLANS[k]&&PLANS[k].stages[i]; if(!st) return false; if(manual(k,i)) return true;
  const tp=(st.topics||[]).filter(id=>TOPICS[id]); return tp.length>0&&tp.every(doneSt); }
function planProg(k){ const p=PLANS[k]; if(!p) return {n:0,done:0,topics:0};
  const ids=new Set(p.stages.flatMap(s=>s.topics||[]));
  return {n:p.stages.length,done:p.stages.filter((s,i)=>stDone(k,i)).length,topics:ids.size}; }
const planTopics=k=>[...new Set((PLANS[k]?PLANS[k].stages:[]).flatMap(s=>s.topics||[]))];

/* ───────── экраны ───────── */
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const P=()=>self.PREPROG;
function dotCls(id){ const st=status(id); return TOPICS[id]?st:'soon'; }
const stTag=c=>c==='done'?'✓':c==='due'?'повтор':c==='started'?'начата':c==='soon'?'скоро':'';
/* строка темы: в курсе ссылка ведёт «внутрь курса» (#/prep/ng4/x3) */
const row=(t,ck)=>{ const c=dotCls(t.id), tag=stTag(c); return `<a class="pp-st ${c}" href="#/prep/${ck?ck+'/':''}${t.id}"><span class="pp-dot"></span><span class="pp-tt">${esc(t.t)}<small>${esc(t.new)}</small></span>${tag?`<span class="pp-tag ${c}">${tag}</span>`:''}</a>`; };
const doneOf=ids=>ids.filter(id=>status(id)==='done').length;
const pbar=(a,b)=>`<span class="pp-prog"><i style="width:${b?Math.round(a/b*100):0}%"></i></span>`;

/* #/prep — подготовка: выбор задания; каждое открывает только свой курс (по этапам — PLANS, prep/plans.js) */
/* основной сайт курсов по этапам не подключает (prep/plans.js — только в копии /new/): там прежний экран — курсы ДЗ по темам */
function viewHubCourses(v){
  const G=P(), dz=G.COURSES.filter(c=>c.kind==='dz'), rk=G.COURSES.filter(c=>c.kind==='rk');
  const cardC=c=>{ const all=c.own.concat(c.prev), d=doneOf(c.own);
    return `<a class="pp-cc" href="#/prep/${c.key}"><span class="pp-cck">${c.label}</span><b>${esc(c.title)}</b>
      <span class="pp-ccm">${c.own.length} ${c.own.length===1?'тема':c.own.length<5?'темы':'тем'}${c.prev.length?` · опирается на ${c.prev.length} из прошлых`:''}</span>${pbar(d,c.own.length)}<small>освоено ${d} из ${c.own.length}</small></a>`; };
  v.innerHTML=`<div class="wrap page pp"><div class="pp-head"><h1>Подготовка</h1>
    <p class="pp-sub">Выбери задание — откроется только то, что нужно для него.</p></div>
    <h2 class="pp-h2">Домашние задания по начерту</h2><div class="pp-ccs">${dz.map(cardC).join('')}</div>
    <h2 class="pp-h2">Рубежные контроли</h2><div class="pp-ccs">${rk.map(c=>`<div class="pp-cc later" aria-disabled="true"><span class="pp-cck">${c.label}</span><b>${esc(c.title)}</b><span class="pp-ccm">позже</span></div>`).join('')}</div>
    <p class="pp-sub"><a href="#/prep/all">Вся программа — ${G.ALL.length} тем по блокам →</a></p></div>`;
  return 'Подготовка';
}

/* что готовить сейчас — решает сайт, как учитель решает тему урока: ближайшее по сроку непройденное задание.
   Неделя семестра — от пн 31 авг 2026 (как RKS и «Мои ДЗ»). Начатый курс доводим до конца, пока его срок не прошёл.
   Сроки прошли у всех непройденных (или вне семестра) — по порядку программы. */
const W1=Date.UTC(2026,7,31);
function semWeek(){ const d=new Date(), t=Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()); return Math.floor((t-W1)/(7*DAY))+1; }
function autoKey(subj){
  const all=Object.keys(PLANS).filter(k=>!subj||PLANS[k].subj===subj);
  const ks=all.filter(k=>planProg(k).done<planProg(k).n); if(!ks.length) return all[0];
  const wk=semWeek(), lk=lastKey(), w=k=>PLANS[k].w||99;
  if(lk&&ks.includes(lk)&&w(lk)>=wk) return lk;
  const up=ks.filter(k=>w(k)>=wk).sort((a,b)=>w(a)-w(b)||(PLANS[a].kind==='rk')-(PLANS[b].kind==='rk'));
  return up[0]||ks[0];
}
function viewHub(v){
  if(!Object.keys(PLANS).length) return viewHubCourses(v);
  location.replace('#/prep/'+autoKey()+'/go'); return 'Подготовка';
}

/* #/prep/ng4 — курс одного задания: свои темы по блокам + свёрнуто «нужно из прошлых» */
function viewCourse(v,ck){
  const G=P(), c=G.COURSE[ck]; if(!c) return viewHub(v);
  const d=doneOf(c.own), next=c.own.find(id=>TOPICS[id]&&status(id)!=='done'), pd=doneOf(c.prev), weak=c.prev.filter(id=>status(id)!=='done');
  const dzN=c.kind==='dz'?c.n:null;
  v.innerHTML=`<div class="wrap page pp"><a class="pp-back" href="#/prep">← Подготовка</a>
    <div class="pp-head"><h1>Подготовка к ${c.label}</h1><p class="pp-sub">${esc(c.title)} · ${c.own.length} ${c.own.length<5?'темы':'тем'}</p></div>
    <div class="pp-cbar">${pbar(d,c.own.length)}<span>освоено ${d} из ${c.own.length}</span></div>
    ${next?`<a class="pp-btn big" href="#/prep/${ck}/${next}">${d?'Продолжить':'Начать'}: ${esc(G.BY[next].t)} →</a>`:dzN?`<a class="pp-btn big" href="#/ng${dzN}">Все темы освоены — к своему варианту ДЗ №${dzN} →</a>`:''}
    <div class="pp-map">${c.blocks.map(b=>`<section><h2>${esc(b.t)}</h2>${b.ids.map(id=>row(G.BY[id],ck)).join('')}</section>`).join('')}</div>
    ${c.prev.length?`<details class="pp-prev"${weak.length&&weak.length<=4?' open':''}><summary>Нужно из прошлых заданий — ${c.prev.length}, освоено ${pd}${weak.length?` · не освоено ${weak.length}`:''}</summary>
      ${c.prevBy.map(g=>`<h3>${g.label}</h3>${g.ids.map(id=>row(G.BY[id],g.key)).join('')}`).join('')}</details>`:''}
    ${dzN?`<p class="pp-sub"><a href="#/ng${dzN}">Свой вариант ДЗ №${dzN} →</a> Решение открыто всегда; подготовка — чтобы решить самому.</p>`:''}</div>`;
  return 'Подготовка к '+c.label;
}

/* #/prep/all — вся программа по блокам (обзор) */
function viewAll(v){
  const G=P(), A=G.audit(), ready=G.ALL.filter(t=>TOPICS[t.id]).length;
  v.innerHTML=`<div class="wrap page pp"><a class="pp-back" href="#/prep">← Подготовка</a><div class="pp-head"><h1>Вся программа</h1>
    <p class="pp-sub">${G.ALL.length} тем по блокам. В каждой одна новая идея: смотришь по шагам, потом выбираешь верный чертёж из двух.</p></div>
    <div class="pp-proof"><span><b>${A.wb.length}/89</b> задач тетради</span><span><b>${A.rk1.length}/${G.RK1.length}</b> вопросов РК1</span><span><b>${A.rk2.length}/9</b> типов РК2</span><span><b>${ready}</b> тем готово</span></div>
    <div class="pp-map">${G.MODS.map(m=>`<section><h2>${esc(m.t)} <small>${m.k}</small></h2>${m.T.map(t=>row(t,'')+`<span class="pp-own">${G.COURSE[G.OWNER[t.id]].label}</span>`).join('')}</section>`).join('')}</div></div>`;
  return 'Вся программа';
}

function viewTopic(v,id,ck){
  const G=P(), T=G.BY[id], topic=TOPICS[id], back=ck&&(G.COURSE[ck]||PLANS[ck])?'#/prep/'+ck:'#/prep/all';
  if(!T){ v.innerHTML='<div class="wrap page"><div class="box warn">Такой темы нет. <a href="#/prep">Вся программа</a></div></div>'; return 'Подготовка'; }
  if(!topic){
    v.innerHTML=`<div class="wrap page pp"><a class="pp-back" href="${back}">← Назад</a><h1>${esc(T.t)}</h1><p class="pp-new">${esc(T.new)}</p>
      <div class="box">Эту тему ещё собираем. Источник: ${esc(T.src||'—')}.</div>
      ${T.pre.length?`<p class="pp-sub">Опирается на: ${T.pre.map(p=>`<a href="#/prep/${p}">${esc(G.BY[p].t)}</a>`).join(', ')}</p>`:''}</div>`;
    return T.t;
  }
  const saved=store.get(id);
  document.body.classList.add('inplayer');
  v.innerHTML=`<div class="pp pp-topic"><div class="pp-bar"><a class="pp-back" href="${back}" aria-label="${ck?'К курсу':'К программе'}">←</a>
    <div class="pp-ttl"><b>${esc(T.t)}</b><small>${esc(T.new)}</small></div><div class="pp-seg" role="tablist"${ck&&PLANS[ck]?' hidden':''}><button data-ph="watch">Смотри</button><button data-ph="duel">Проверка</button></div></div>
    <div class="pp-stage" id="ppStage"></div></div>`;
  const stage=v.querySelector('#ppStage'), seg=v.querySelector('.pp-seg');
  const setPh=ph=>{ seg.querySelectorAll('button').forEach(b=>{ b.classList.toggle('on',b.dataset.ph===ph); b.setAttribute('aria-selected',b.dataset.ph===ph); });
    if(ph==='watch') watch(stage,topic,T,()=>setPh('duel')); else duel(stage,topic,T,saved,()=>setPh('watch'),ck); };
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
function duel(stage,topic,T,saved,toWatch,ck){
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
    /* дальше — по своему курсу: следующая неосвоенная тема; курс пройден — к своему варианту */
    const G=P(), c=ck&&G.COURSE[ck], pl=ck&&PLANS[ck], pool=pl?planTopics(ck):c?c.own:G.ALL.map(t=>t.id), at=pool.indexOf(T.id);
    const nextId=pool.slice(at+1).concat(pool.slice(0,Math.max(0,at))).find(id=>TOPICS[id]&&status(id)!=='done'), nextT=nextId&&G.BY[nextId];
    const fin=pl&&!nextT?`<a class="pp-btn" href="#/prep/${ck}">Темы курса освоены — к этапам ${esc(pl.label)} →</a>`:c&&!nextT&&c.kind==='dz'?`<a class="pp-btn" href="#/ng${c.n}">Курс пройден — к своему варианту ${c.label} →</a>`:'';
    stage.innerHTML=`<div class="pp-done"><div class="pp-big">${M.n}</div><h2>Тема освоена</h2><p class="pp-sub">пар до уверенности · верно ${M.log.filter(x=>x.ok).length}</p>
      <div class="pp-deck">${keys.map(k=>`<span class="${M.beat[k]?'won':''}" title="${esc(topic.traps[k].say)}"></span>`).join('')}</div>
      <p class="pp-sub">Повторим через ${SPACING[Math.min(SPACING.length-1,((store.get(T.id)||{}).lvl||1)-1)]} дн. — так тема не забудется.</p>
      <div class="pp-row">${pl?`<a class="pp-btn" href="#/prep/${ck}/go">Дальше →</a>`:`${nextT?`<a class="pp-btn" href="#/prep/${c?ck+'/':''}${nextT.id}">Дальше: ${esc(nextT.t)} →</a>`:fin}<a class="pp-btn ghost" href="${c?'#/prep/'+ck:'#/prep/all'}">${c?'К курсу':'Программа'}</a>`}</div>
      <details class="pp-how"><summary>Почему система решила, что ты освоил</summary><table>${keys.map(k=>`<tr><td>${esc(topic.traps[k].say)}</td><td>${M.beat[k]} ✓</td><td>${M.miss[k]} ✗</td><td>${esc(topic.traps[k].src||'')}</td></tr>`).join('')}</table>
      <p>Пары подбирались так, чтобы шанс ответить верно был около 85 %. Угадывание в выборе из двух учтено: тема засчитана, когда вероятность «знает» стала выше 98,5 % и четыре последних ответа подряд верны.</p></details></div>`;
  };
  const key=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); choose(e.currentTarget===A); } };
  A.onclick=()=>choose(true); B.onclick=()=>choose(false); A.onkeydown=key; B.onkeydown=key;
  next(); meter();
}

/* ───────── проверки курса: методика ─────────
   • Замер до обучения (#/prep/<к>/pre) — по одной паре на этап. Попытка ответить до обучения улучшает усвоение,
     даже если ответ неверный (pretesting effect: Richland, Kornell, Kao, 2009; Kornell и др., 2009). Этапов не засчитывает.
   • Проверка этапа (#/prep/<к>/check<N>) — этап засчитывается только по проверке, а не по ощущению «понял»
     (иллюзия компетентности — Bjork, Dunlosky, Kornell, 2013). Темы этапа — 4 пары вперемешку, все верно (угадать — 1 из 16);
     у инжи — вопросы по ГОСТ; «Собери всё в план» — расставить шаги решения по порядку (воспроизведение процедуры).
   • Смешанная тренировка (#/prep/<к>/mix) — темы курса вперемешку (interleaving: Rohrer, Taylor, 2007; Brunmair, Richter, 2019):
     учит узнавать, какой приём нужен, а не только выполнять его. Она же — интервальный повтор: ошибка возвращает тему на повтор
     сегодня, верный ответ по теме, которой пора повториться, отодвигает следующий повтор (Cepeda и др., 2006).
   • «Объясни себе» на каждом этапе — сначала сказать своими словами, потом сверить (self-explanation: Chi и др., 1994;
     генерация до показа — Slamecka, Graf, 1978).
   • Больше трёх этапов за день — совет продолжить завтра: сон закрепляет выученное (Walker, Stickgold, 2004). */
const shuf=a=>{ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
/* последовательность тем без двух одинаковых подряд — чередование */
function interleave(ids,n){ const out=[]; let bag=[];
  while(out.length<n){ if(!bag.length) bag=shuf(ids); let i=bag.findIndex(id=>id!==out[out.length-1]); if(i<0) i=0; out.push(bag.splice(i,1)[0]); }
  return out; }
const trapFor=topic=>{ const ks=Object.keys(topic.traps), hard=ks.filter(k=>(topic.traps[k].b0||0)>=0); const pool=hard.length?hard:ks; return pool[Math.floor(Math.random()*pool.length)]; };
const today=()=>{ const d=new Date(); d.setHours(0,0,0,0); return +d; };
const stageStamp=v=>typeof v==='number'?v:v&&v.t||0;
function doneToday(){ const a=mstore.all(), t0=today(); let n=0; Object.keys(a).forEach(k=>{ if(/:/.test(k)) return; Object.values(a[k]||{}).forEach(v=>{ if(stageStamp(v)>=t0) n++; }); }); return n; }
const preOf=k=>(mstore.all()[k+':pre'])||null;
function setPre(k,o){ const a=mstore.all(); a[k+':pre']=o; mstore.set(a); }
/* интервальный повтор по результату смешанной тренировки */
function respace(id,ok){ const s=store.get(id); if(!s||!s.mast) return; const st=status(id);
  if(!ok){ store.set(id,Object.assign({},s,{mast:1,lvl:Math.max(1,(s.lvl||1)-1)})); }
  else if(st==='due'){ store.set(id,Object.assign({},s,{mast:Date.now(),lvl:(s.lvl||1)+1})); } }
const dueOf=k=>planTopics(k).filter(id=>status(id)==='due');

function shell(v,title,sub,back){
  document.body.classList.add('inplayer');
  v.innerHTML=`<div class="pp pp-topic"><div class="pp-bar"><a class="pp-back" href="${back}" aria-label="К курсу">←</a>
    <div class="pp-ttl"><b>${esc(title)}</b><small>${esc(sub)}</small></div><span class="pp-cnt" id="ppCnt"></span></div><div class="pp-stage" id="ppStage"></div></div>`;
  return v.querySelector('#ppStage');
}
function endScreen(v,html){ document.body.classList.remove('inplayer'); v.innerHTML=`<div class="wrap page pp"><div class="pp-gt">${html}</div></div>`; }

/* раунд дуэлей по списку тем: n пар, темы вперемешку; onEnd(log) */
function rounds(stage,ids,n,onEnd,onAns,blind){
  const seq=interleave(ids,n), log=[]; let i=0, cur=null, locked=false;
  const G=P();
  stage.innerHTML=`<div class="pp-duel"><div class="pp-card" id="ppA" tabindex="0" role="button" aria-label="Первый чертёж"><svg></svg></div>
    <div class="pp-panel mid"><div class="pp-meter"><div class="pp-prog"><i id="ppBar"></i></div><span id="ppPct"></span></div><span class="pp-tp" id="ppTp"></span>
      <div class="pp-verd" id="ppVerd"></div></div>
    <div class="pp-card" id="ppB" tabindex="0" role="button" aria-label="Второй чертёж"><svg></svg></div></div>`;
  const A=stage.querySelector('#ppA'), B=stage.querySelector('#ppB'), verd=stage.querySelector('#ppVerd'), cnt=document.getElementById('ppCnt');
  const next=()=>{ if(i>=seq.length) return onEnd(log);
    const id=seq[i], topic=TOPICS[id]; let k=trapFor(topic), pr=pair(topic,k);
    for(let t=0;!pr&&t<6;t++){ k=trapFor(topic); pr=pair(topic,k); }
    if(!pr){ i++; return next(); }
    cur={id,k,pr,okTop:Math.random()<.5}; locked=false; [A,B].forEach(c=>c.className='pp-card');
    draw(A.querySelector('svg'),cur.okTop?pr.ok:pr.bad); draw(B.querySelector('svg'),cur.okTop?pr.bad:pr.ok);
    stage.querySelector('#ppTp').textContent=blind?'Узнай, какой это приём, и найди верный чертёж':G.BY[id]?G.BY[id].t:'';
    stage.querySelector('#ppBar').style.width=Math.round(i/seq.length*100)+'%'; stage.querySelector('#ppPct').textContent=(i+1)+' / '+seq.length;
    if(cnt) cnt.textContent=log.filter(x=>x.ok).length+' ✓';
    verd.innerHTML='<span class="pp-q">Где верно?</span>'; };
  const choose=top=>{ if(locked||!cur) return; locked=true;
    const ok=top===cur.okTop, tr=TOPICS[cur.id].traps[cur.k]; if(blind) stage.querySelector('#ppTp').textContent='Тема: '+(G.BY[cur.id]?G.BY[cur.id].t:''); log.push({id:cur.id,k:cur.k,ok,say:tr.say}); i++; onAns&&onAns(cur.id,ok);
    try{ window.TRACK&&TRACK('prep_check',{topic:cur.id,trap:cur.k,ok:ok?1:0}); }catch(e){}
    const okC=cur.okTop?A:B, badC=cur.okTop?B:A; okC.classList.add('ok');
    if(ok){ badC.classList.add('dim'); verd.innerHTML='<span class="pp-ok">Верно</span>'; try{ window.FX&&FX.buzz('tick'); }catch(e){} setTimeout(next,900); }
    else { badC.classList.add('bad'); mark(badC.querySelector('svg'),okC.querySelector('svg'),cur.pr.ok,tr.hl);
      verd.innerHTML=`<span class="pp-bad">${esc(tr.say)}</span><button class="pp-btn" id="ppNx">Дальше →</button>`;
      try{ window.FX&&FX.buzz('error'); }catch(e){} const b=verd.querySelector('#ppNx'); b.onclick=next; try{ b.focus({preventScroll:true}); }catch(e){} } };
  const key=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); choose(e.currentTarget===A); } };
  A.onclick=()=>choose(true); B.onclick=()=>choose(false); A.onkeydown=key; B.onkeydown=key;
  next();
}

/* вопросы с выбором (инжа — ГОСТ) и расстановка шагов по порядку */
function mcq(stage,qs,onEnd){
  const list=shuf(qs), log=[]; let i=0;
  const show=()=>{ if(i>=list.length) return onEnd(log);
    const q=list[i], order=shuf(q.o.map((t,j)=>j)); const cnt=document.getElementById('ppCnt'); if(cnt) cnt.textContent=(i+1)+' / '+list.length;
    stage.innerHTML=`<div class="pp-mcq"><p class="pp-mq">${esc(q.q)}</p><div class="pp-mo">${order.map(j=>`<button type="button" data-j="${j}">${esc(q.o[j])}</button>`).join('')}</div><div class="pp-verd" id="ppVerd"></div></div>`;
    stage.querySelectorAll('.pp-mo button').forEach(b=>b.onclick=()=>{ if(stage.querySelector('.pp-mo.locked')) return; stage.querySelector('.pp-mo').classList.add('locked');
      const j=+b.dataset.j, ok=j===q.a; log.push({ok,q:q.q,why:q.why});
      stage.querySelector(`[data-j="${q.a}"]`).classList.add('ok'); if(!ok) b.classList.add('bad');
      stage.querySelector('#ppVerd').innerHTML=`${ok?'<span class="pp-ok">Верно</span>':'<span class="pp-bad">Неверно</span>'}${q.why?`<p class="pp-mw">${esc(q.why)}</p>`:''}<button class="pp-btn" id="ppNx">Дальше →</button>`;
      stage.querySelector('#ppNx').onclick=()=>{ i++; show(); }; }); };
  show();
}
function orderTask(stage,steps,onEnd){
  let at=0, miss=0; const items=shuf(steps.map((t,i)=>({t,i})));
  stage.innerHTML=`<div class="pp-mcq"><p class="pp-mq">Нажимай шаги решения по порядку — от первого к последнему.</p><ol class="pp-ord" id="ppOrd"></ol>
    <div class="pp-mo pp-oo">${items.map(x=>`<button type="button" data-i="${x.i}">${esc(x.t)}</button>`).join('')}</div><div class="pp-verd" id="ppVerd"></div></div>`;
  const ol=stage.querySelector('#ppOrd'), verd=stage.querySelector('#ppVerd');
  stage.querySelectorAll('.pp-oo button').forEach(b=>b.onclick=()=>{ const i=+b.dataset.i;
    if(i===at){ b.remove(); ol.insertAdjacentHTML('beforeend',`<li>${esc(steps[i])}</li>`); at++; verd.innerHTML='';
      if(at===steps.length){ verd.innerHTML=`<span class="${miss<=1?'pp-ok':'pp-bad'}">${miss?'Ошибок: '+miss:'Без ошибок'}</span>`; setTimeout(()=>onEnd([{ok:miss<=1,miss}]),900); } }
    else { miss++; b.classList.add('bad'); setTimeout(()=>b.classList.remove('bad'),500); verd.innerHTML=`<span class="pp-bad">Не этот. Что нужно сделать сразу после «${esc(at?steps[at-1]:'начала')}»?</span>`; } });
}
/* шаги плана решения задания — из методики dz/<курс>/<№>/method.js (тип выбирается случайно: каждая попытка — новая) */
function planSteps(dzKey){ try{ const d=self.DZR&&DZR.list('ng').concat(DZR.list('ig')).find(x=>x.id===dzKey), T=d&&d.method&&d.method.types; if(!T) return null;
  const ks=Object.keys(T).filter(c=>T[c].plan&&T[c].plan.length>=4); if(!ks.length) return null;
  const c=ks[Math.floor(Math.random()*ks.length)], ty=(d.types||[]).find(x=>x.code===c);
  const cut=x=>{ x=String(x||'').replace(/<[^>]+>/g,'').split(/[.;—]\s/)[0].trim(); return x.length>70?x.slice(0,68).replace(/\s+\S*$/,'')+'…':x; };
  return {steps:T[c].plan.map(a=>{ const t=String(a.t).replace(/^\d+\.\s*/,''); return t.length<14&&a.d?t+': '+cut(a.d):t; }),name:ks.length>1&&ty?ty.name:''}; }catch(e){ return null; } }

function stageCheckKind(k,i){ const st=PLANS[k].stages[i]; if((st.topics||[]).some(id=>TOPICS[id])) return 'duel'; if(st.check&&st.check.length) return 'mcq'; if(st.order) return 'order'; return null; }
/* ───────── единый путь (#/prep/<к>/go): каждый следующий шаг выбирает сайт, у студента одна кнопка «Дальше» ─────────
   Порядок: замер (один раз) → повторение вперемешку (если подошли повторы, раз в день) → этапы по порядку:
   темы этапа до освоения → урок → задача тетради (реши сам, потом сверь) → «Объясни себе» → проверка этапа → следующий этап →
   в конце — свой вариант. Шаги «урок» и «задача» уводят на страницы сайта; вернуться в путь — плашка «Дальше» внизу. */
const seenOf=k=>(mstore.all()[k+':seen'])||{};
function setSeen(k,key){ const a=mstore.all(), o=a[k+':seen']||{}; o[key]=Date.now(); a[k+':seen']=o; mstore.set(a); }
const TRAIL='nch_prep_trail';
function trail(k,hint){ try{ if(k){ sessionStorage.setItem(TRAIL,k); sessionStorage.setItem(TRAIL+'_h',hint||''); } else { sessionStorage.removeItem(TRAIL); sessionStorage.removeItem(TRAIL+'_h'); } }catch(e){} }
const trailHint=()=>{ try{ return sessionStorage.getItem(TRAIL+'_h')||''; }catch(e){ return ''; } };
const trailKey=()=>{ try{ return sessionStorage.getItem(TRAIL); }catch(e){ return null; } };
function lastKey(k){ const a=mstore.all(); if(k){ a._last=k; mstore.set(a); } return a._last; }
function nextStep(k){
  const p=PLANS[k], tps=planTopics(k).filter(id=>TOPICS[id]), sn=seenOf(k), a=mstore.all();
  if(!preOf(k)&&tps.length&&!p.stages.some((s,i)=>stDone(k,i))) return {kind:'pre',href:'#/prep/'+k+'/pre'};
  if(dueOf(k).length&&a[k+':mix']!==today()) return {kind:'mix',href:'#/prep/'+k+'/mix'};
  const i=p.stages.findIndex((s,j)=>!stDone(k,j)); if(i<0) return {kind:'final'};
  const st=p.stages[i], ck=stageCheckKind(k,i), ts=(st.topics||[]).filter(id=>TOPICS[id]);
  const learn=(st.learn||[]).slice(0,ts.length?1:ck?2:9), dos=(st.do||[]).slice(0,ck?1:9);
  for(const id of ts) if(!doneSt(id)) return {kind:'topic',i,id,href:'#/prep/'+k+'/'+id};
  for(let j=0;j<learn.length;j++) if(!sn[i+':l'+j]) return {kind:'learn',i,j,item:learn[j]};
  for(let j=0;j<dos.length;j++) if(!sn[i+':d'+j]) return {kind:'do',i,j,item:dos[j]};
  if(!sn[i+':e']) return {kind:'explain',i};
  if(ck) return {kind:'check',i,href:'#/prep/'+k+'/check'+(i+1)};
  return {kind:'mark',i};
}
function viewGo(v,k){
  const p=PLANS[k]; lastKey(k); trail(k,'');
  const s=nextStep(k), G=P(), g=planProg(k);
  if(s.href){ location.replace(s.href); return p.label; }
  const st=s.i!=null?p.stages[s.i]:null;
  const head=st?`<span class="pp-cck">${esc(p.label)} · этап ${s.i+1} из ${p.stages.length}</span><p class="pp-gst">${esc(st.t)}</p>`:`<span class="pp-cck">${esc(p.label)}</span>`;
  const screen=(body,btn,cls)=>{ document.body.classList.remove('inplayer'); v.innerHTML=`<div class="wrap page pp"><div class="pp-gt pp-go${cls?' '+cls:''}">${head}${body}<div class="pp-row pp-gb">${btn}</div>
    <div class="pp-cbar">${pbar(g.done,g.n)}<span>${g.done} из ${g.n}</span></div></div></div>`; };
  const isTask=it=>/^#\/(ng\/tasks|ig\/wb)\//.test(it[0]);
  /* теория и задача открываются сразу; что делать — на плашке внизу, «Дальше» возвращает в путь */
  if(s.kind==='learn'||s.kind==='do'){
    const it=s.item, task=s.kind==='do'&&isTask(it);
    setSeen(k,s.i+':'+(s.kind==='learn'?'l':'d')+s.j);
    trail(k,s.kind==='learn'?'Теория: прочитай и разбери примеры':task?'Задача: реши сам на бумаге, потом сверь с разбором':'Тренировка: пройди до конца');
    location.replace(it[0]); return p.label;
  }
  if(s.kind==='explain'){
    const tp=(st.topics||[]).filter(id=>G.BY[id]);
    const exp=[st.why||'',...tp.map(id=>G.BY[id].t+': '+G.BY[id].new)].filter(Boolean);
    screen(`<h1>Объясни себе</h1><p class="pp-sub">Скажи вслух: что делаем и зачем. Потом сверь.</p>
      <ul class="pp-sea" id="ppExp" hidden>${exp.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`,
      `<button type="button" class="pp-btn" id="ppSe">Сверить с ответом</button>`);
    const b=v.querySelector('#ppSe'); b.onclick=()=>{ if(v.querySelector('#ppExp').hidden){ v.querySelector('#ppExp').hidden=false; b.textContent='Дальше: проверка этапа →'; } else { setSeen(k,s.i+':e'); document.title=viewGo(v,k)+' · Начерт'; scrollTo(0,0); } };
    return p.label+' · объясни себе';
  }
  if(s.kind==='mark'){
    screen(`<h1>Готово?</h1>`,`<button type="button" class="pp-btn" id="ppMk">Сделал — дальше →</button>`);
    v.querySelector('#ppMk').onclick=()=>{ setManual(k,s.i,{t:Date.now(),by:'self'}); document.title=viewGo(v,k)+' · Начерт'; scrollTo(0,0); };
    return p.label;
  }
  trail(null);
  screen(`<h1>Подготовка пройдена</h1><p class="pp-sub">${p.kind==='dz'?'Теперь свой вариант — сам, на бумаге. Решение — только для сверки.':'Теперь — пробный билет на время.'}</p>`,
    `<a class="pp-btn" href="${p.go}">${p.kind==='dz'?'К своему варианту':'К пробному билету'} →</a>`,'fin');
  try{ window.FX&&FX.confetti(); }catch(e){}
  return p.label+' · подготовка пройдена';
}
/* плашка «Дальше» на страницах сайта, куда увёл путь (урок, задача тетради, билет) */
function bar(){
  let el=document.getElementById('ppTrail'); const k=trailKey(), h=location.hash||'';
  const show=k&&PLANS[k]&&!/^#\/prep(\/|$)/.test(h);
  if(!show){ if(el) el.remove(); return; }
  const p=PLANS[k], g=planProg(k), i=p.stages.findIndex((s,j)=>!stDone(k,j));
  if(!el){ el=document.createElement('div'); el.id='ppTrail'; document.body.appendChild(el); }
  const hint=trailHint();
  el.innerHTML=`<span><b>${hint?esc(hint):'Подготовка к '+esc(p.label)}</b><small>${esc(p.label)} · ${i>=0?'этап '+(i+1)+' из '+p.stages.length:'всё пройдено'}</small></span><a class="pp-btn" href="#/prep/${k}/go">Дальше →</a>`;
  css();
}
if(typeof window!=='undefined'&&window.addEventListener){ window.addEventListener('hashchange',()=>setTimeout(bar,0)); window.addEventListener('load',()=>setTimeout(bar,0)); }

function viewQuiz(v,k,item){
  const p=PLANS[k], back='#/prep/'+k, G=P();
  const again=()=>{ document.title=viewQuiz(v,k,item)+' · Начерт'; try{ scrollTo(0,0); }catch(e){} };
  const fin=(html,re)=>{ endScreen(v,html+`<div class="pp-row pp-gb">${re?'<button type="button" class="pp-btn" id="ppAgain">Ещё раз →</button>':`<a class="pp-btn" href="${back}/go">Дальше →</a>`}</div>`);
    const b=v.querySelector('#ppAgain'); if(b) b.onclick=again; };
  const missed=log=>{ const m=log.filter(x=>!x.ok); return m.length?`<h2 class="pp-h2">Разбери ошибки</h2><ul class="pp-miss">${m.map(x=>`<li>${x.id&&G.BY[x.id]?`<b>${esc(G.BY[x.id].t)}</b>: `:''}${esc(x.say||x.why||x.q||'')}</li>`).join('')}</ul>`:''; };
  if(item==='pre'){
    const sts=p.stages.map((s,i)=>({i,id:(s.topics||[]).find(id=>TOPICS[id])})).filter(x=>x.id);
    if(!sts.length) return (location.hash=back,p.title);
    const stg=shell(v,'Замер: что ты уже знаешь','по паре на этап',back); const res={};
    rounds(stg,sts.map(x=>x.id),sts.length,log=>{ log.forEach(x=>{ const s=sts.find(y=>y.id===x.id); if(s) res[s.i]=x.ok?1:0; }); setPre(k,{t:Date.now(),r:res});
      const ok=log.filter(x=>x.ok).length;
      fin(`<span class="pp-cck">Замер · ${esc(p.label)}</span><h1>${ok} из ${log.length}</h1>
        <p class="pp-sub">Ошибки на замере — норма: так тема запомнится лучше.</p>`); });
    return 'Замер · '+p.label;
  }
  if(item==='mix'){
    let ids=planTopics(k).filter(id=>TOPICS[id]&&status(id)!=='new'); if(ids.length<2) ids=planTopics(k).filter(id=>TOPICS[id]);
    const due=dueOf(k), n=Math.min(12,Math.max(8,ids.length));
    const stg=shell(v,'Смешанная тренировка','темы курса вперемешку · '+n+' пар',back);
    const seqIds=due.length?due.concat(ids).filter((x,i,a)=>a.indexOf(x)===i):ids;
    rounds(stg,seqIds,n,log=>{ const ok=log.filter(x=>x.ok).length;
      fin(`<span class="pp-cck">Смешанная тренировка · ${esc(p.label)}</span><h1>${ok} из ${log.length}</h1>
        <p class="pp-sub">Темы с ошибками вернутся на повтор.</p>`); const a=mstore.all(); a[k+':mix']=today(); mstore.set(a); },(id,ok)=>respace(id,ok),true);
    return 'Смешанная тренировка · '+p.label;
  }
  const m=/^check(\d+)$/.exec(item||''), i=m?+m[1]-1:-1, st=p.stages[i];
  if(!st){ location.hash=back; return p.title; }
  const kind=stageCheckKind(k,i), head=`Проверка этапа ${i+1}`;
  const pass=log=>{ setManual(k,i,{t:Date.now(),by:'test'}); try{ window.TRACK&&TRACK('prep_stage',{plan:k,st:i+1,by:'test'}); }catch(e){} try{ window.FX&&FX.confetti(); }catch(e){}
    const nx=p.stages.findIndex((s,j)=>!stDone(k,j)), dt=doneToday();
    fin(`<span class="pp-cck">${esc(p.label)} · этап ${i+1}</span><h1>Этап пройден</h1><p class="pp-sub">${esc(st.t)}</p>
      ${dt>=3&&nx>=0?`<p class="pp-rest">На сегодня хватит — сон закрепит. Завтра продолжим.</p>`:''}
`); };
  const fail=(log,extra)=>fin(`<span class="pp-cck">${esc(p.label)} · этап ${i+1}</span><h1>Пока не засчитано</h1>
      <p class="pp-sub">${extra||''} Нужно всё верно.</p>${missed(log)}`,true);
  if(kind==='duel'){ const ids=st.topics.filter(id=>TOPICS[id]);
    rounds(shell(v,head,st.t,back),ids,4,log=>log.every(x=>x.ok)?pass(log):fail(log,`Верно ${log.filter(x=>x.ok).length} из ${log.length}.`)); }
  else if(kind==='mcq'){ mcq(shell(v,head,st.t,back),st.check,log=>log.every(x=>x.ok)?pass(log):fail(log,`Верно ${log.filter(x=>x.ok).length} из ${log.length}.`)); }
  else if(kind==='order'){ const ps=planSteps(st.order); if(!ps){ setManual(k,i,{t:Date.now(),by:'self'}); location.hash=back; return p.title; }
    orderTask(shell(v,head,'расставь шаги по порядку',back),ps.steps,log=>log[0].ok?pass(log):fail([],`Ошибок в порядке: ${log[0].miss}. Можно не больше одной.`)); }
  else { location.hash=back; return p.title; }
  return head+' · '+p.label;
}

/* ───────── карточка «Подготовка» на странице ДЗ и РК ───────── */
function cardCourse(dz){
  const G=P(); if(!G||!G.COURSE[dz]) return '';
  const c=G.COURSE[dz], d=doneOf(c.own), first=c.own.find(id=>TOPICS[id]&&status(id)!=='done');
  return `<a class="pp-dzcard" href="#/prep/${dz}"><span class="pp-dzk">Подготовка к ${c.label}</span>
    <b>${d}/${c.own.length} тем освоено</b>${pbar(d,c.own.length)}
    <small>${first?'Начни с темы «'+esc(G.BY[first].t)+'»':'Всё освоено — переходи к своему варианту'}</small></a>`;
}

function chipCourse(dz){
  const G=P(); if(!G||!G.COURSE[dz]) return '';
  const c=G.COURSE[dz], d=doneOf(c.own);
  return `<a class="pp-dzchip" href="#/prep/${dz}"><b>Подготовка к ${c.label}</b>${pbar(d,c.own.length)}<span>${d}/${c.own.length} →</span></a>`;
}

function card(k){
  const p=PLANS[k]; if(!p) return Object.keys(PLANS).length?'':cardCourse(k);
  const g=planProg(k), nx=p.stages.findIndex((s,i)=>!stDone(k,i));
  return `<a class="pp-dzcard" href="#/prep/${k}/go"><span class="pp-dzk">Сначала — подготовка к ${esc(p.label)}</span>
    <b>${g.done}/${g.n} этапов пройдено</b>${pbar(g.done,g.n)}
    <small>${nx>=0?'Этап '+(nx+1)+': «'+esc(p.stages[nx].t)+'»':'Всё пройдено — решай свой вариант'}</small></a>`;
}
function chip(k){
  const p=PLANS[k]; if(!p) return Object.keys(PLANS).length?'':chipCourse(k);
  const g=planProg(k);
  return `<a class="pp-dzchip" href="#/prep/${k}/go"><b>Подготовка к ${esc(p.label)}</b>${pbar(g.done,g.n)}<span>${g.done}/${g.n} →</span></a>`;
}
/* Перед решением варианта — предложение пройти подготовку (мягкий вход: решение открывается одной кнопкой).
   Показывается, пока курс не пройден, раз за сеанс на задание; «Сразу к решению» запоминается до закрытия вкладки.
   Автоматические проверки (navigator.webdriver) его не видят, если не включить nch_prep_gate = 1. */
const SKEY='nch_prep_skip';
const skipped=k=>{ try{ return (JSON.parse(sessionStorage.getItem(SKEY)||'{}')||{})[k]; }catch(e){ return false; } };
function skip(k){ try{ const o=JSON.parse(sessionStorage.getItem(SKEY)||'{}')||{}; o[k]=1; sessionStorage.setItem(SKEY,JSON.stringify(o)); }catch(e){} }
function gate(v,k,go,what){
  const p=PLANS[k]; if(!p||skipped(k)) return false;
  try{ if(navigator.webdriver&&localStorage.getItem('nch_prep_gate')!=='1') return false; }catch(e){}
  const g=planProg(k); if(g.done===g.n) return false;
  const nx=p.stages.findIndex((s,i)=>!stDone(k,i));
  v.innerHTML=`<div class="wrap page pp pp-gate-pg"><div class="pp-gt"><span class="pp-cck">${esc(p.label)} · ${esc(what||'решение')}</span>
    <h1>Сначала — подготовка</h1>
    <p class="pp-sub">${g.n} ${g.n<5?'этапа':'этапов'} — и решишь сам.</p>
    <div class="pp-cbar">${pbar(g.done,g.n)}<span>${g.done} из ${g.n}</span></div>
    <div class="pp-row pp-gb"><a class="pp-btn big" href="#/prep/${k}/go">${g.done?'Продолжить':'Начать'} →</a></div>
    <p class="pp-skip"><button type="button" id="ppSkip">Сразу открыть решение</button></p></div></div>`;
  v.querySelector('#ppSkip').onclick=()=>{ skip(k); try{ window.TRACK&&TRACK('prep_gate_skip',{plan:k}); }catch(e){} go(); };
  try{ window.TRACK&&TRACK('prep_gate',{plan:k}); }catch(e){}
  return true;
}
/* адреса: #/prep — подготовка; #/prep/ng4 — курс ДЗ №4; #/prep/ng4/x3 — тема в курсе; #/prep/all — вся программа;
   #/prep/x3 — тема из программы; #/prep/for/ng4 — прежний адрес курса */
function view(v,r){
  const G=P(); if(!G){ v.innerHTML='<div class="wrap page"><div class="box warn">Программа не загрузилась.</div></div>'; return 'Подготовка'; }
  if(r.tab==='all') return viewAll(v);
  const crs=k=>PLANS[k]?(location.replace('#/prep/'+k+'/go'),'Подготовка'):viewCourse(v,k);
  if(r.tab==='for') return G.COURSE[r.item]||PLANS[r.item]?crs(r.item):viewHub(v);
  if(r.tab&&(G.COURSE[r.tab]||PLANS[r.tab])) return r.item?(PLANS[r.tab]&&r.item==='go'?viewGo(v,r.tab):PLANS[r.tab]&&/^(check\d+|mix|pre)$/.test(r.item)?viewQuiz(v,r.tab,r.item):viewTopic(v,r.item,r.tab)):crs(r.tab);
  if(r.tab) return viewTopic(v,r.tab,null);
  return viewHub(v);
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
.pp-seg[hidden]{display:none}.pp-seg{display:flex;gap:3px;background:var(--pp-surf);border:1px solid var(--pp-line);border-radius:999px;padding:3px}
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
.pp-h2{font-size:18px;margin:18px 0 8px}
.pp-ccs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.pp-cc{display:grid;gap:4px;padding:14px;border-radius:var(--pp-r);background:var(--pp-surf);border:1px solid var(--pp-line);color:var(--pp-ink);text-decoration:none}
.pp-cc b{font-size:16px;line-height:1.25}.pp-cck{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--pp-acc)}
.pp-ccm{font-size:13px;color:var(--pp-mut)}.pp-cc small{color:var(--pp-mut)}.pp-cc.later{opacity:.55}.pp-cc.later .pp-cck{color:var(--pp-mut)}
.pp-cbar{display:flex;align-items:center;gap:10px;margin:6px 0 12px;font-size:13px;color:var(--pp-mut)}.pp-cbar .pp-prog{max-width:260px}
.pp-btn.big{display:block;text-align:center;margin:4px 0 8px}
.pp-prev{margin:16px 0;background:var(--pp-surf);border:1px solid var(--pp-line);border-radius:var(--pp-r);padding:10px 14px}
.pp-prev summary{cursor:pointer;font-weight:600}.pp-prev h3{font-size:13px;color:var(--pp-mut);margin:12px 0 2px;letter-spacing:.04em;text-transform:uppercase}
.pp-own{display:block;margin:-6px 0 4px 38px;font-size:11px;color:var(--pp-mut)}
.pp-dzchip{display:flex;align-items:center;gap:10px;padding:6px 12px;margin:4px 0;border-radius:10px;background:var(--surf2,#f3f5fa);color:var(--ink,#121a3f);text-decoration:none;font-size:13px}
.pp-dzchip b{white-space:nowrap}.pp-dzchip .pp-prog{max-width:160px}.pp-dzchip span:last-child{color:var(--acc,#1f3fbf);font-weight:700;white-space:nowrap}
.pp-dzk{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--acc,#1f3fbf)}.pp-dzcard small{color:var(--mut,#5c6688)}
.pp-cc.fin{border-color:var(--pp-ok)}
.pp-stgs{display:grid;gap:12px;margin:14px 0}
.pp-stg{background:var(--pp-surf);border:1px solid var(--pp-line);border-radius:var(--pp-r);padding:14px;scroll-margin-top:72px}
.pp-stg.now{border:2px solid var(--pp-acc)}.pp-stg.done{border-color:var(--pp-ok)}
.pp-stgh{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:start}
.pp-stgh b{font-size:16px;line-height:1.3;display:block}.pp-stgh p{margin:4px 0 0;font-size:14px;color:var(--pp-mut);line-height:1.4}
.pp-stgn{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:14px;background:var(--pp-bg);border:2px solid var(--pp-line);color:var(--pp-ink)}
.pp-stg.now .pp-stgn{border-color:var(--pp-acc);color:var(--pp-acc)}.pp-stg.done .pp-stgn{background:var(--pp-ok);border-color:var(--pp-ok);color:#fff}
.pp-stgb{margin:10px 0 0 44px}.pp-stgb h3{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--pp-mut);margin:0 0 4px}
.pp-lks{display:flex;flex-wrap:wrap;gap:6px}.pp-lks a{font-size:14px;padding:6px 10px;border-radius:10px;background:var(--pp-bg);border:1px solid var(--pp-line);color:var(--pp-ink);text-decoration:none;line-height:1.3}
.pp-mk{margin:12px 0 0 44px;border:1px dashed var(--pp-line);background:transparent;color:var(--pp-mut);border-radius:10px;padding:8px 12px;font:inherit;font-size:14px;cursor:pointer}
.pp-mk.on{border-style:solid;border-color:var(--pp-ok);color:var(--pp-ok);font-weight:700}
@media(max-width:480px){.pp-stgb,.pp-mk{margin-left:0}}
.pp-gt{max-width:620px;margin:16px auto;background:var(--pp-surf);border:2px solid var(--pp-acc);border-radius:20px;padding:20px 18px}
.pp-gt h1{margin:6px 0 8px}.pp-gb{margin:14px 0 4px;justify-content:flex-start}.pp-gl{margin:12px 0 16px;padding-left:22px;display:grid;gap:4px}.pp-gl li{font-size:15px}.pp-gl a{color:var(--pp-ink)}
.pp-gl li.done a{color:var(--pp-ok)}.pp-gl li.done::marker{color:var(--pp-ok)}.pp-gl li.now a{font-weight:700}
.pp-pre{display:inline-block;margin:4px 0 0;font-size:12px;font-weight:700;padding:2px 8px;border-radius:8px;background:rgba(20,160,90,.12);color:var(--pp-ok)}.pp-pre.bad{background:rgba(224,36,78,.10);color:var(--pp-bad)}
.pp-se p{margin:0 0 6px;font-size:14px;color:var(--pp-mut);line-height:1.4}
.pp-seb{border:1px solid var(--pp-line);background:var(--pp-bg);border-radius:10px;padding:7px 12px;font:inherit;font-size:14px;color:var(--pp-ink);cursor:pointer}
.pp-sea{margin:8px 0 0;padding-left:20px;font-size:14px;line-height:1.45}.pp-sea li{margin:2px 0}
.pp-chk{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.pp-chk small{flex-basis:100%;color:var(--pp-mut);font-size:13px}
.pp-note{font-size:14px;color:var(--pp-mut);margin:-2px 0 10px}
.pp-due{display:grid;gap:2px;padding:12px 14px;border-radius:var(--pp-r);background:rgba(212,120,10,.10);border:2px solid var(--pp-dz);color:var(--pp-ink);text-decoration:none;margin:8px 0}
.pp-due span{font-size:14px;color:var(--pp-mut)}.pp-due.calm{background:var(--pp-surf);border-color:var(--pp-line)}
.pp-rest{font-size:14px;padding:10px 12px;border-radius:12px;background:var(--pp-bg);border:1px solid var(--pp-line);line-height:1.45}
.pp-cnt{font-weight:700;font-size:14px;color:var(--pp-ok);white-space:nowrap}
.pp-tp{grid-column:1/3;text-align:center;font-size:13px;color:var(--pp-mut)}
.pp-mcq{max-width:640px;margin:0 auto;width:100%;padding:8px 2px;overflow:auto}
.pp-mq{font-size:18px;font-weight:700;line-height:1.35;margin:6px 0 14px}
.pp-mo{display:grid;gap:8px}.pp-mo button{text-align:left;font:inherit;font-size:16px;padding:12px 14px;border-radius:12px;border:2px solid var(--pp-line);background:var(--pp-surf);color:var(--pp-ink);cursor:pointer;transition:border-color .2s}
.pp-mo button.ok{border-color:var(--pp-ok);background:rgba(20,160,90,.08)}.pp-mo button.bad{border-color:var(--pp-bad);background:rgba(224,36,78,.06)}
.pp-mcq .pp-verd{flex-direction:column;margin-top:12px}.pp-mw{margin:0;font-size:14px;color:var(--pp-mut);text-align:left}
.pp-ord{margin:0 0 12px;padding-left:24px;display:grid;gap:4px}.pp-ord li{font-weight:600;color:var(--pp-ok)}
.pp-miss{padding-left:20px;display:grid;gap:4px;font-size:14px}
.pp-go h1{margin:4px 0 8px}.pp-gst{margin:2px 0 6px;font-weight:700;font-size:15px;color:var(--pp-mut)}
.pp-big2{font-size:18px;font-weight:700;line-height:1.35;margin:0 0 8px}
.pp-go .pp-cbar{margin-top:14px}.pp-out{text-align:center;margin-top:10px}.pp-out a{color:var(--pp-mut)}
.pp-go.fin{border-color:var(--pp-ok)}
.pp-all{margin:16px 0}.pp-all>summary{cursor:pointer;font-weight:700;padding:10px 0;color:var(--pp-mut)}
.pp-skip{text-align:center;margin:14px 0 0}.pp-skip button{border:0;background:none;color:var(--pp-mut);font:inherit;font-size:14px;text-decoration:underline;cursor:pointer;padding:6px}
#ppTrail{position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:900;display:flex;align-items:center;justify-content:space-between;gap:10px;
 padding:10px 10px 10px 16px;border-radius:16px;background:var(--surf,#fff);color:var(--ink,#121a3f);border:2px solid var(--acc,#1f3fbf);box-shadow:0 12px 30px -12px rgba(10,20,60,.45);max-width:560px;margin:0 auto}
#ppTrail span{display:grid;line-height:1.2;font-size:14px}#ppTrail small{color:var(--mut,#5c6688);font-size:12px}
#ppTrail .pp-btn{padding:10px 16px;white-space:nowrap;background:var(--acc,#1f3fbf);color:#fff;border-radius:12px;font-weight:700;text-decoration:none}
body.inplayer #ppTrail{bottom:calc(12px + env(safe-area-inset-bottom,0px))}
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

self.PREP={TOPICS,PLANS,autoKey,semWeek,plan(k,o){ PLANS[k]=Object.assign({key:k},o); return PLANS[k]; },planProg,stDone,gate,topic(id,o){ TOPICS[id]=Object.assign({id},o); return TOPICS[id]; },frame3,point3,draw3D,view,card,chip,status,Model,pair,draw,store};
})();
