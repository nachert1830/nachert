/* ═══════════ METOD: методический слой копии сайта (m/) ═══════════
   Что делает (обоснования — m/README.md):
   1. Модель знаний одна на всё: задачи тетради привязаны к 53 темам программы (PREPROG.wb), тема освоена, когда пройдены
      четыре шага — разобранный пример, «найди ошибку» (PREP), задача решена самостоятельно, повтор по интервалам.
   2. Плеер разбора (точки подключения — m/fork.py):
      • «Смотрю» — перед каждым шагом вопрос «что дальше?» из трёх вариантов (предсказание, эффект генерации);
        «Почему» открывается после того, как студент объяснил шаг себе (самообъяснение);
      • «Решаю сам» — шаг проверяется по частям: выбрать действие из трёх, затем коснуться чертежа там, где окажется новая
        точка (пошаговая проверка); построение показывается только после попытки;
      • оценка в конце считается по фактам (верные действия и точки), а не по самооценке, и задаёт интервал повтора;
      • режим по уровню: новая задача новой темы — разобранный пример, дальше — «Решаю сам» (эффект обратной экспертности).
   Хранится только в браузере: localStorage 'nch_m'. */
(function(){
'use strict';
const KEY='nch_m';
const load=()=>{ try{ return JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ return {}; } };
const save=o=>{ try{ localStorage.setItem(KEY,JSON.stringify(o)); }catch(e){} };
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const strip=h=>String(h||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const norm=s=>strip(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const isNum=k=>/^\d+$/.test(String(k));
const plural=(n,a,b,c)=>{ const m=n%10,h=n%100; return (m===1&&h!==11)?a:(m>=2&&m<=4&&(h<12||h>14))?b:c; };
const track=(n,p)=>{ try{ window.TRACK&&TRACK(n,p); }catch(e){} };
const G=()=>self.PREPROG||null;
const pref=(k,d)=>{ const p=load().pref||{}; return k in p?p[k]:d; };
const setPref=(k,v)=>{ const o=load(); o.pref=o.pref||{}; o.pref[k]=v; save(o); };
function hash(s){ let h=2166136261; s=String(s); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

/* ───────── модель: задачи ───────── */
function rec(key){ return (load().t||{})[String(key)]||null; }
function record(key,ev){
  const o=load(); o.t=o.t||{}; key=String(key);
  const r=o.t[key]||{runs:0,watch:0,try:0,best:-1};
  r.runs++; r[ev.mode]=(r[ev.mode]||0)+1; r.last=Date.now();
  if(ev.mode==='try'&&ev.rate!=null){ r.best=Math.max(r.best,ev.rate); r.rate=ev.rate; }
  if(ev.pN) r.pred=[ev.pOk,ev.pN];
  o.t[key]=r; o.log=(o.log||[]).concat([{k:key,m:ev.mode,r:ev.rate,d:Date.now()}]).slice(-400); save(o);
  track('m_done',{mode:ev.mode,task:key,rate:ev.rate==null?'':String(ev.rate)});
}
/* прогресс, накопленный на основном сайте до методички: задача дочитана до ответа (ST 'wb3') */
function legacySeen(n){ try{ return ((window.ST&&ST.get('wb3',{}))||{})[n]>=1; }catch(e){ return false; } }

/* ───────── модель: темы ───────── */
function topicsOf(n){ const g=G(); return g?g.ALL.filter(t=>(t.wb||[]).includes(+n)):[]; }
function prepStatus(id){ try{ return window.PREP&&PREP.TOPICS[id]?PREP.status(id):'none'; }catch(e){ return 'none'; } }
function stages(t){
  const wb=t.wb||[];
  const ex=wb.some(n=>{ const r=rec(n); return (r&&r.runs>0)||legacySeen(n); });
  const ps=prepStatus(t.id), tr=ps==='none'?null:(ps==='done'||ps==='due');
  const self=wb.some(n=>{ const r=rec(n); return r&&r.best>=1; });
  const due=ps==='due'||wb.some(n=>{ try{ return LEARN.dueList().some(o=>String(o.k)===String(n)); }catch(e){ return false; } });
  const done=ex&&(tr!==false)&&self;
  return {ex,tr,self,due,done,started:ex||ps==='started'||tr||self};
}
function pickTask(t,avoid){ const wb=(t.wb||[]).filter(n=>n!==avoid); return wb.find(n=>{ const r=rec(n); return !(r&&r.runs>0)&&!legacySeen(n); })||wb[0]||avoid||null; }
function selfTask(t){ const ex=(t.wb||[]).find(n=>{ const r=rec(n); return (r&&r.runs>0)||legacySeen(n); })||(t.wb||[])[0];
  const other=(t.wb||[]).filter(n=>n!==ex); return other.find(n=>{ const r=rec(n); return !(r&&r.best>=1); })||other[0]||ex; }
function genTask(t){ try{ const ok=GEN.list(); return (t.wb||[]).find(n=>ok.includes(n))||null; }catch(e){ return null; } }
const genHref=n=>'#/ng/check/gym/var/'+n+'-'+(1000+Math.floor(Math.random()*9000));

/* режим разбора по уровню: первая встреча с темой — разобранный пример, дальше — «Решаю сам» */
function modeFor(t,opt){
  const key=t&&t.n; if(!isNum(key)) return null;
  const r=rec(key); if((r&&r.runs>0)||legacySeen(key)) return 'try';
  const tps=topicsOf(key); if(tps.length&&tps.every(tp=>stages(tp).ex)) return 'try';
  return 'watch';
}

/* ───────── плеер ───────── */
const WM=new WeakMap();
function attach(c){
  const S=c.S, t=c.t;
  const X=()=>{ let x=WM.get(S.shown); if(!x){ x={plan:{},tap:{},pred:{},why:{},saved:0,rate:null}; WM.set(S.shown,x); } return x; };
  const K=(pi,k)=>pi+':'+k;
  const OPT=new WeakMap(), TGT=new WeakMap();
  /* три действия на выбор: верное + два других шага той же задачи (ближайшие следующие — правдоподобны, но рано) */
  function opts(p,k){
    let m=OPT.get(p); if(!m){ m={}; OPT.set(p,m); } if(k in m) return m[k];
    const st=p.steps||[], cur=strip((st[k-1]||{}).t); if(!cur){ return m[k]=null; }
    const seen=new Set([norm(cur)]), pool=[];
    const add=(s,d)=>{ const tt=strip(s&&s.t), n=norm(tt); if(!tt||seen.has(n)||tt.length>140) return; seen.add(n); pool.push({t:tt,d}); };
    st.forEach((s,i)=>{ if(i>k-1) add(s,i-(k-1)); });
    st.forEach((s,i)=>{ if(i<k-1) add(s,(k-1)-i+50); });
    c.S&&(c.t.parts||[]).forEach(q=>(q.steps||[]).forEach(s=>add(s,100)));
    if(pool.length<2) return m[k]=null;
    pool.sort((a,b)=>a.d-b.d);
    const list=[{t:cur,ok:1}].concat(pool.slice(0,2).map(o=>({t:o.t,ok:0})));
    const r=hash(String(t.n)+':'+k)%3; [list[0],list[r]]=[list[r],list[0]];
    return m[k]=list;
  }
  /* точка, которую студент ставит касанием: новая подписанная точка шага (искомая — в первую очередь) */
  function target(p,k){
    let m=TGT.get(p); if(!m){ m={}; TGT.set(p,m); } if(k in m) return m[k];
    if(p._fig) return m[k]=null;
    const st=p.steps||[], s=st[k-1]; if(!s) return m[k]=null;
    const prev=new Set(); (p.given||[]).concat(...st.slice(0,k-1).map(q=>q.add||[])).forEach(it=>{ if(it&&it.t==='pt'&&it.l) String(it.l).split('≡').forEach(l=>prev.add(l.trim())); });
    const cs=(s.add||[]).filter(it=>it&&it.t==='pt'&&it.l&&Array.isArray(it.at)&&!it.nodot&&!String(it.l).split('≡').some(l=>prev.has(l.trim())));
    if(!cs.length) return m[k]=null;
    const pk=cs.find(it=>it.k==='res')||cs[cs.length-1];
    let xy=null; try{ const h=c.svgOf({items:[{t:'pt',at:pk.at}],fitTo:c.scene(p,k).fitTo}); const q=/<circle[^>]*\bcx="([-\d.]+)"[^>]*\bcy="([-\d.]+)"/.exec(h); if(q) xy=[+q[1],+q[2]]; }catch(e){}
    /* задачи тетради (WB3, модуль L) — 3,2 единицы чертежа на мм тетради; у других чертежей масштаб неизвестен — расстояние без мм */
    const mmS=isNum(t.n)?3.2:0;
    return m[k]=xy?{l:String(pk.l).split('≡')[0].trim(),xy,mmS}:null;
  }
  function pend(k){ return S.mode==='watch'&&pref('pred',true)&&!X().pred[K(S.pi,k)]&&!!opts(c.part(),k); }
  const btns=(list,kind)=>'<div class="mx-opts">'+list.map((o,i)=>`<button type="button" class="mx-opt" data-mx="${kind}" data-i="${i}">${esc(o.t)}</button>`).join('')+'</div>';
  function card(p,k,pi){
    const x=X(), key=K(pi,k), n=(p.steps||[]).length, o=opts(p,k), st=p.steps[k-1]||{};
    if(S.mode==='watch'){ if(!o) return null;
      return `<div class="pl-kicker">Шаг ${k} из ${n} · предскажи</div><div class="pl-title">Как думаешь, что дальше?</div>
        <div class="pl-text muted">Выбери, потом увидишь построение. Шаг, который ты угадал заранее, запоминается лучше, чем просто увиденный.</div>
        ${btns(o,'pred')}<div class="mx-row"><button type="button" class="mx-link" data-mx="skip">Просто показать</button><button type="button" class="mx-link" data-mx="off">Не спрашивать</button></div>`; }
    const pl=x.plan[key];
    if(!pl){ if(!o) return null;
      return `<div class="pl-kicker">Шаг ${k} из ${n} · твой ход</div><div class="pl-title">Что сделать на этом шаге?</div>
        <div class="pl-text muted">Подумай над чертежом, потом выбери. Не знаешь — честно нажми «Не знаю»: шаг покажем, а задача вернётся на повтор раньше.</div>
        ${btns(o,'plan')}<div class="mx-row"><button type="button" class="mx-link" data-mx="plan" data-i="-1">Не знаю</button></div>`; }
    const fb=pl.idk?`<div class="mx-fb no">Следующий шаг — вот он. Построй его на бумаге.</div>`:pl.ok?`<div class="mx-fb ok">✓ Верно, это следующий шаг.</div>`:`<div class="mx-fb no">Нет: «${esc(pl.pick)}» — не сейчас. Следующий шаг — этот.</div>`;
    const tg=target(p,k), tp=x.tap[key];
    if(tg&&!tp) return `<div class="pl-kicker">Шаг ${k} из ${n} · твой ход</div><div class="pl-title">${st.t||''}</div>${fb}
      <div class="pl-text">Построй на бумаге. Потом коснись чертежа там, где окажется точка <b class="mx-pt">${esc(tg.l)}</b>.</div>
      <div class="mx-tapcue" aria-hidden="true">◎ Коснись чертежа</div>
      <div class="mx-row"><button type="button" class="mx-link" data-mx="tapskip">Не могу — показать построение</button></div>`;
    const tf=!tp?'':tp.skip?'':tp.ok?`<div class="mx-fb ok">✓ Точка ${esc(tg.l)} на месте${tp.d!=null?' (ошибка '+fmt(tp.d)+' мм)':''}.</div>`:`<div class="mx-fb no">Мимо${far(tp.d)}. Сверь своё построение с правильным: твоя отметка — красная, верное место — в зелёном кольце.</div>`;
    return `<div class="pl-kicker">Шаг ${k} из ${n} · твой ход</div><div class="pl-title">${st.t||''}</div>${fb}${tf}
      <div class="pl-text muted">${tg?'':'Дострой шаг на бумаге, потом сверься.'}</div>
      <div class="pl-tryb"><button type="button" class="btn pri" data-mx="reveal">Сверить с построением</button></div>`;
  }
  const fmt=d=>d<10?d.toFixed(1).replace('.',','):String(Math.round(d));
  const far=d=>d==null?'':(' на '+fmt(d)+' мм');
  function why(k,pi,html){
    if(X().why[K(pi,k)]) return `<div class="pl-why"><span>Почему</span>${html}</div>`;
    return `<div class="pl-why mx-why"><span>Почему</span><div class="mx-whyq">Сначала объясни себе одной фразой: зачем этот шаг и почему он работает. Потом сверься.</div><button type="button" class="btn ghost sm" data-mx="why">Объяснил — сверить</button></div>`;
  }
  function badge(k,pi){
    const x=X(), key=K(pi,k), b=[];
    const pr=x.pred[key]; if(pr&&!pr.skip) b.push(pr.ok?'<i class="ok">✓ угадал шаг</i>':'<i class="no">шаг был другим</i>');
    const pl=x.plan[key]; if(pl) b.push(pl.ok?'<i class="ok">✓ действие</i>':'<i class="no">действие: '+(pl.idk?'не знал':'другое')+'</i>');
    const tp=x.tap[key]; if(tp) b.push(tp.skip?'<i class="no">точка: не поставил</i>':tp.ok?'<i class="ok">✓ точка</i>':'<i class="no">точка: мимо'+far(tp.d)+'</i>');
    return b.length?'<div class="mx-badge">'+b.join('')+'</div>':'';
  }
  function bind(){
    const root=c.root, x=X(), key=K(S.pi,S.k), p=c.part();
    root.querySelectorAll('[data-mx]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const a=b.dataset.mx, i=+b.dataset.i, o=opts(p,S.k)||[];
      if(a==='pred'){ x.pred[key]={ok:!!(o[i]&&o[i].ok),pick:o[i]&&o[i].t}; S.shown[key]=1; }
      else if(a==='skip'){ x.pred[key]={skip:1}; S.shown[key]=1; }
      else if(a==='off'){ setPref('pred',false); S.shown[key]=1; }
      else if(a==='plan'){ x.plan[key]=i<0?{idk:1}:{ok:!!(o[i]&&o[i].ok),pick:o[i]&&o[i].t}; }
      else if(a==='tapskip'){ x.tap[key]={skip:1}; S.shown[key]=1; }
      else if(a==='reveal'){ S.shown[key]=1; }
      else if(a==='why'){ x.why[key]=1; }
      try{ window.FX&&FX.buzz(8); }catch(_){}
      c.render(); }));
    const paper=root.querySelector('.pl-paper'), svg=paper&&paper.querySelector('svg.dwg'); if(!svg) return;
    const tg=target(p,S.k), tp=x.tap[key], hid=c.hidden(S.k);
    /* режим касания: студент ставит точку */
    if(S.mode==='try'&&hid&&x.plan[key]&&tg&&!tp){
      paper.classList.add('mx-tap'); let d0=null;
      paper.addEventListener('pointerdown',e=>{ d0=[e.clientX,e.clientY]; },true);
      paper.addEventListener('click',e=>{ if(e.target.closest('.pl-zoom,.pl-ask3d,button')) return; if(d0&&Math.hypot(e.clientX-d0[0],e.clientY-d0[1])>10) return;
        const q=toVB(svg,e.clientX,e.clientY); if(!q) return; const u=Math.hypot(q[0]-tg.xy[0],q[1]-tg.xy[1]), vb=svg.viewBox.baseVal;
        /* допуск: 3 % чертежа, но не меньше подушечки пальца (≈ 22 px экрана) */
        const tol=Math.max(0.03*Math.max(vb.width,vb.height),22/q[2]), d=tg.mmS?u/tg.mmS:null;
        x.tap[key]={ok:u<=tol,d,at:[q[0],q[1]]}; try{ window.FX&&FX.buzz(d<=tol?'success':'error'); }catch(_){} c.render(); });
    }
    /* отметка студента и верное место — на чертеже */
    if(tp&&tp.at&&tg){ const NS='http://www.w3.org/2000/svg', g=document.createElementNS(NS,'g'); g.setAttribute('class','mx-marks'+(tp.ok?' ok':''));
      let s=''; if(!hid) s+=`<line x1="${tp.at[0]}" y1="${tp.at[1]}" x2="${tg.xy[0]}" y2="${tg.xy[1]}" class="mx-ln"/><circle cx="${tg.xy[0]}" cy="${tg.xy[1]}" r="6" class="mx-ring"/>`;
      s+=`<circle cx="${tp.at[0]}" cy="${tp.at[1]}" r="3.4" class="mx-you"/>`; g.innerHTML=s; svg.appendChild(g); }
  }
  function toVB(svg,cx,cy){ const r=svg.getBoundingClientRect(), vb=svg.viewBox.baseVal; if(!r.width||!vb||!vb.width) return null;
    const s=Math.min(r.width/vb.width,r.height/vb.height), ox=(r.width-vb.width*s)/2, oy=(r.height-vb.height*s)/2;
    return [vb.x+(cx-r.left-ox)/s, vb.y+(cy-r.top-oy)/s, s]; }
  function counts(){ const x=X(), v=o=>Object.values(o);
    const pr=v(x.pred).filter(a=>!a.skip), pl=v(x.plan), tp=v(x.tap);
    return {pOk:pr.filter(a=>a.ok).length,pN:pr.length,aOk:pl.filter(a=>a.ok).length,aN:pl.length,tOk:tp.filter(a=>a.ok).length,tN:tp.length,hints:Object.keys(S.hint||{}).length}; }
  /* оценка по фактам: доля верных действий и точек; подсказки старой лесенки — минус */
  function autoRate(){ const x=X(); if(S.mode!=='try') return; if(x.rate!=null){ S.rated=x.rate; return; }
    const q=counts(), tot=q.aN+q.tN+q.hints; if(!tot) return;
    const f=(q.aOk+q.tOk)/tot, v=f>=0.8?2:f>=0.45?1:0; x.rate=v; S.rated=v;
    try{ c.opt.rep&&c.opt.rep.rate(v,{hints:q.hints}); }catch(e){} }
  function summary(){
    const x=X(); if(S.mode==='try') autoRate();
    const q=counts(), n=t.n, num=isNum(n);
    if(!x.saved){ x.saved=1; record(n,{mode:S.mode,rate:S.mode==='try'?x.rate:null,pOk:q.pOk,pN:q.pN}); }
    const lines=[];
    if(S.mode==='watch'){ if(q.pN) lines.push(`Предсказал ${q.pOk} из ${q.pN} ${plural(q.pN,'шага','шагов','шагов')}.`); }
    else { if(q.aN) lines.push(`Верное действие: ${q.aOk} из ${q.aN}.`); if(q.tN) lines.push(`Точки поставлены точно: ${q.tOk} из ${q.tN}.`);
      if(x.rate!=null) lines.push('<b>'+['Пока не вышло — задача вернётся завтра.','Получилось с ошибками — повтор через пару дней.','Решил сам — повтор через несколько дней.'][x.rate]+'</b>'); }
    const nx=[];
    if(num){ if(S.mode==='watch') nx.push(`<a class="btn pri" href="#/ng/tasks/${n}/try">Теперь реши сам →</a>`);
      const gt=(()=>{ try{ return GEN.list().includes(+n); }catch(e){ return false; } })(); if(S.mode==='try'&&gt) nx.push(`<a class="btn" href="${genHref(n)}">Та же задача на новых числах</a>`);
      topicsOf(n).slice(0,2).forEach(tp=>nx.push(`<a class="btn" href="#/m/${tp.id}">Тема: ${esc(tp.t)}</a>`)); }
    if(!lines.length&&!nx.length) return '';
    return `<div class="mx-sum">${lines.length?'<div class="mx-sumt">'+lines.join(' ')+'</div>':''}${nx.length?'<div class="mx-sumb">'+nx.join('')+'</div>':''}</div>`;
  }
  return {pend,card,why,badge,bind,autoRate,summary};
}

/* ───────── экраны ───────── */
const STG=[
  ['ex','Разбери пример','Разобранный пример — лучший старт для новичка: с предсказанием каждого шага и объяснением «почему».'],
  ['tr','Найди ошибку','Два чертежа, в одном — типичная ошибка. Каждый раз новые числа: запомнить ответ нельзя, нужно понять принцип.'],
  ['self','Реши сам','Другая задача той же темы. Сайт проверяет каждый шаг: действие и точку на чертеже.'],
  ['due','Повтори','Через 1, 3, 7, 16 и 35 дней. Повтор с промежутками держит навык до РК, зубрёжка за вечер — нет.']];
function dots(s){ return '<span class="mx-dots">'+[s.ex,s.tr!==false,s.self,s.done&&!s.due].map((on,i)=>`<i class="${on?(i===1&&s.tr===null?'na':'on'):''}"></i>`).join('')+'</span>'; }
function stLabel(s){ return s.done?(s.due?'<span class="mx-st due">повторить</span>':'<span class="mx-st ok">освоено</span>'):s.started?'<span class="mx-st go">начато</span>':''; }
function nextTopic(){ const g=G(); if(!g) return null; return g.ALL.find(t=>!stages(t).done)||null; }
function dueTopics(){ const g=G(); return g?g.ALL.filter(t=>{ const s=stages(t); return s.done&&s.due; }):[]; }
function nextStage(t){ const s=stages(t); if(!s.ex) return {k:'ex',href:'#/ng/tasks/'+pickTask(t),label:'Разобрать пример'};
  if(s.tr===false) return {k:'tr',href:'#/prep/'+t.id,label:'Найти ошибку'};
  if(!s.self) return {k:'self',href:'#/ng/tasks/'+selfTask(t)+'/try',label:'Решить самому'};
  return {k:'due',href:'#/prep/'+t.id,label:'Повторить'}; }

function viewHome(v){
  const g=G(); if(!g){ v.innerHTML='<div class="wrap page"><div class="box warn">Программа не загрузилась.</div></div>'; return 'Методичка'; }
  const all=g.ALL, done=all.filter(t=>stages(t).done).length, nt=nextTopic(), due=dueTopics();
  let rep=[]; try{ rep=LEARN.dueList().slice(0,3); }catch(e){}
  const today=[];
  due.slice(0,3).forEach(t=>today.push(`<a class="mx-todo" href="#/prep/${t.id}"><b>Повтор темы</b><span>${esc(t.t)}</span></a>`));
  rep.forEach(o=>{ if(isNum(o.k)) today.push(`<a class="mx-todo" href="#/ng/tasks/${o.k}/try"><b>Реши по памяти</b><span>Задача №${o.k}</span></a>`); });
  const ns=nt&&nextStage(nt);
  const courses=(g.COURSES||[]).filter(c=>c.kind==='dz').map(c=>{ const need=c.need||[], d=need.filter(id=>stages(g.BY[id]).done).length;
    return `<a class="mx-course" href="#/m/dz/${c.key}"><b>${esc(c.label)}</b><span>${d} из ${need.length}</span><i style="--p:${need.length?Math.round(100*d/need.length):0}%"></i></a>`; }).join('');
  const mods=g.MODS.map(m=>`<section class="mx-mod"><h2>${esc(m.t)} <small>${esc(m.k||'')}</small></h2><div class="mx-list">${m.T.map(t=>{ const s=stages(t), i=g.POS[t.id]+1;
      return `<a class="mx-trow${t===nt?' next':''}" href="#/m/${t.id}"><span class="mx-n">${i}</span><span class="mx-tt"><b>${esc(t.t)}</b><small>${esc(t.new)}</small></span>${stLabel(s)}${dots(s)}</a>`; }).join('')}</div></section>`).join('');
  v.innerHTML=`<div class="wrap page mx">
    <header class="mx-hero"><div class="mx-kick">Начертательная геометрия · МГТУ им. Н.Э. Баумана</div><h1>Методичка</h1>
      <p>${all.length} ${plural(all.length,'тема','темы','тем')} курса по порядку. В каждой теме четыре шага: <b>разбери пример → найди ошибку → реши сам → повтори</b>. Сайт проверяет твои ответы и сам решает, когда вернуть тему.</p>
      <div class="mx-prog"><div class="mx-bar"><i style="width:${Math.round(100*done/all.length)}%"></i></div><span>Освоено ${done} из ${all.length}</span></div></header>
    <section class="mx-today"><h2>Сегодня</h2>
      ${nt?`<a class="mx-next" href="${ns.href}"><span class="mx-kick">${stages(nt).started?'Продолжить':'Следующая тема'} · ${g.POS[nt.id]+1} из ${all.length}</span><b>${esc(nt.t)}</b><span>${esc(nt.new)}</span><em>${esc(ns.label)} →</em></a>`:'<div class="mx-next done"><b>Все темы освоены</b><span>Остались повторы — они ниже.</span></div>'}
      ${today.length?'<div class="mx-todos">'+today.join('')+'</div>':''}</section>
    ${courses?`<section><h2>Перед домашним заданием</h2><p class="mx-mut">Только темы, на которых стоит это ДЗ, и всё, на что они опираются.</p><div class="mx-courses">${courses}</div></section>`:''}
    ${mods}
    <details class="mx-how"><summary>Почему методичка устроена так</summary>${HOW}</details>
    <p class="mx-mut mx-foot"><a href="#/home">Прежняя главная</a> · <a href="#/ng/tasks">Все задачи тетради</a> · <a href="#/dz">ДЗ</a></p></div>`;
  return 'Методичка';
}
const HOW=`<ul>
 <li><b>Разобранный пример, потом задача</b> (Sweller, Cooper, 1985; Renkl, Atkinson, 2003): новичку пример полезнее задачи. Поэтому первая задача темы открывается в «Смотрю», следующие — в «Решаю сам».</li>
 <li><b>Подсказки убираются по уровню</b> (Kalyuga, 2003, эффект обратной экспертности): тому, кто уже умеет, готовый разбор мешает.</li>
 <li><b>Предсказание и самообъяснение</b> (Slamecka, Graf, 1978; Chi и др., 1989): перед шагом ты выбираешь, что дальше, а «почему» открывается после того, как объяснил себе сам.</li>
 <li><b>Проверка каждого шага</b> (VanLehn, 2011): системы, которые проверяют шаги решения, почти догоняют живого репетитора, а проверка только ответа даёт втрое меньше. Здесь ты выбираешь действие и ставишь точку на чертеже.</li>
 <li><b>Оценка по фактам, а не по ощущению</b> (Dunlosky, Rawson, 2012): после лёгкого повторения студенты переоценивают себя. Интервал повтора задают твои ответы.</li>
 <li><b>Подсказка только после попытки</b> (Aleven и др., 2003; Baker и др., 2004): иначе подсказки прокликивают до ответа.</li>
 <li><b>Интервальное повторение и перемешивание</b> (Cepeda и др., 2006; Rohrer, Taylor, 2007): темы возвращаются через 1, 3, 7, 16 и 35 дней, задачи на новых числах.</li></ul>`;

function viewTopic(v,id){
  const g=G(), t=g&&g.BY[id]; if(!t) return viewHome(v);
  const s=stages(t), i=g.POS[id]+1, ex=pickTask(t), sf=selfTask(t), gt=genTask(t), nst=nextStage(t).k;
  const pre=(t.pre||[]).map(pid=>{ const q=g.BY[pid]; return q?`<a class="mx-chip${stages(q).done?' ok':''}" href="#/m/${pid}">${esc(q.t)}</a>`:''; }).join('');
  const ps=prepStatus(id);
  const card=(k,body,href,btn,on)=>{ const st=STG.find(x=>x[0]===k), n=STG.indexOf(st)+1;
    return `<div class="mx-stage${on?' on':''}${nst===k&&!s.done?' cur':''}"><div class="mx-sn">${on?'✓':n}</div><div class="mx-sb"><h3>${st[1]}</h3><p>${st[2]}</p>${body||''}${href?`<a class="btn${nst===k?' pri':''}" href="${href}">${btn}</a>`:''}</div></div>`; };
  const tasks=(t.wb||[]).map(n=>{ const r=rec(n), st=r&&r.best>=1?'ok':(r&&r.runs>0)||legacySeen(n)?'go':''; return `<a class="mx-chip ${st}" href="#/ng/tasks/${n}">№${n}</a>`; }).join('');
  const where=[(t.dz||[]).map(d=>'ДЗ №'+String(d).replace(/\D/g,'')).join(', '),t.rk1&&t.rk1.length?'РК1 — '+t.rk1.length+' '+plural(t.rk1.length,'вопрос','вопроса','вопросов'):'',t.rk2&&t.rk2.length?'РК2':'',t.rk3?'РК3':''].filter(Boolean).join(' · ');
  const prevT=g.ALL[g.POS[id]-1], nextT=g.ALL[g.POS[id]+1];
  v.innerHTML=`<div class="wrap page mx">
    <nav class="mx-crumbs"><a href="#/m">← Методичка</a></nav>
    <header class="mx-thead"><div class="mx-kick">Тема ${i} из ${g.ALL.length} · ${esc((g.MODS.find(m=>m.T.includes(t))||{}).t||'')}</div><h1>${esc(t.t)}</h1>
      <p class="mx-idea"><span>Новая идея</span>${esc(t.new)}</p>${stLabel(s)}
      ${pre?`<div class="mx-pre"><span>Опирается на</span>${pre}</div>`:''}</header>
    <div class="mx-stages">
      ${card('ex','',ex?'#/ng/tasks/'+ex:'',ex?'Разобрать задачу №'+ex:'',s.ex)}
      ${s.tr===null?'':card('tr',ps==='started'?'<p class="mx-mut">Начато — продолжай до «освоено».</p>':'','#/prep/'+id,ps==='started'?'Продолжить':'Начать',s.tr)}
      ${card('self','',sf?'#/ng/tasks/'+sf+'/try':'',sf?'Решить задачу №'+sf:'',s.self)}
      ${card('due',s.done?(s.due?'<p class="mx-st due">Пора повторить</p>':'<p class="mx-mut">Тема вернётся сама — в «Сегодня» на главной методички.</p>'):'<p class="mx-mut">Откроется, когда пройдены первые три шага.</p>',s.done?'#/prep/'+id:'',s.due?'Повторить':'Повторить заранее',s.done&&!s.due)}
    </div>
    ${gt?`<p class="mx-gen"><a href="${genHref(gt)}">Задача №${gt} на новых числах</a> — ответ не запомнить, только решить.</p>`:''}
    <section class="mx-meta">${tasks?`<div><span>Задачи тетради</span>${tasks}</div>`:''}${where?`<div><span>Где пригодится</span>${esc(where)}</div>`:''}${t.src?`<div><span>Учебник</span>${esc(t.src)}</div>`:''}</section>
    <nav class="mx-pn">${prevT?`<a href="#/m/${prevT.id}">← ${esc(prevT.t)}</a>`:'<span></span>'}${nextT?`<a href="#/m/${nextT.id}">${esc(nextT.t)} →</a>`:''}</nav></div>`;
  return t.t+' · Методичка';
}

function viewCourse(v,key){
  const g=G(), c=g&&g.COURSE[key]; if(!c) return viewHome(v);
  const need=(c.need||[]).map(id=>g.BY[id]), nt=need.find(t=>!stages(t).done), d=need.length-need.filter(t=>!stages(t).done).length;
  v.innerHTML=`<div class="wrap page mx"><nav class="mx-crumbs"><a href="#/m">← Методичка</a></nav>
    <header class="mx-thead"><div class="mx-kick">Подготовка к домашнему заданию</div><h1>${esc(c.label)}</h1>
      <div class="mx-prog"><div class="mx-bar"><i style="width:${need.length?Math.round(100*d/need.length):0}%"></i></div><span>Освоено ${d} из ${need.length}</span></div></header>
    ${nt?`<a class="mx-next" href="${nextStage(nt).href}"><span class="mx-kick">Следующая тема</span><b>${esc(nt.t)}</b><span>${esc(nt.new)}</span><em>${esc(nextStage(nt).label)} →</em></a>`:`<a class="mx-next" href="#/${key}"><b>Всё готово</b><span>Можно браться за своё ДЗ.</span><em>К моему варианту →</em></a>`}
    <div class="mx-list">${need.map(t=>{ const s=stages(t); return `<a class="mx-trow${t===nt?' next':''}" href="#/m/${t.id}"><span class="mx-n">${g.POS[t.id]+1}</span><span class="mx-tt"><b>${esc(t.t)}</b><small>${esc(t.new)}</small></span>${stLabel(s)}${dots(s)}</a>`; }).join('')}</div>
    <p class="mx-mut mx-foot"><a href="#/${key}">Мой вариант ${esc(c.label)}</a> — решение открыто, но сначала попробуй сам.</p></div>`;
  return c.label+' · Методичка';
}

function view(v,r){ r=r||{}; if(r.tab==='dz') return viewCourse(v,r.item); if(r.tab) return viewTopic(v,r.tab); return viewHome(v); }

self.METOD={attach,modeFor,view,stages,topicsOf,record,rec};
})();
