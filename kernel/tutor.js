/* ═══ TUTOR — ИИ-наставник в плеере разбора (docs/TUTOR.md) ═══
   Шторка под чертежом: открывается кнопкой «Не понимаю» на шаге (в «Смотрю» и в «Решаю сам»).
   Модель говорит, ядро решает, чертёж показывает:
     • первая реакция — сразу, без сети: лестница подсказок ядра (TUTORCORE.ladder) — подсветка опор шага и вопрос;
     • свободный вопрос — модели на сервере (/api/tutor, server/lib/tutor.js), если студент вошёл и согласился
       отправлять вопрос зарубежной модели; каждое её утверждение о чертеже ядро проверило до показа;
     • ответ появляется на чертеже (подсветка, линия связи, часть построения, показ по частям, 3D) и одной фразой в шторке;
     • «Решаю сам»: «Отметь, где будет 3′» — касание чертежа, ядро говорит, что не так (мимо линии связи / не на той линии).
   Плеер вызывает TUTOR.open(api) и после каждой отрисовки TUTOR.afterRender(api); api = {go, state, part, parts, t, root, render}.
   Модель знаний студента — ST 'tu_model' (синхронизируется с кабинетом вместе с остальным прогрессом). */
(function(){
'use strict';
const C=window.TUTORCORE; if(!C) return;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ v==null?localStorage.removeItem(k):localStorage.setItem(k,v); }catch(e){} } };
const STg=(k,d)=>{ try{ return window.ST?ST.get(k,d):(JSON.parse(LS.get('nch2_'+k)||'null')??d); }catch(e){ return d; } };
const STs=(k,v)=>{ try{ window.ST?ST.set(k,v):LS.set('nch2_'+k,JSON.stringify(v)); }catch(e){} };
const API=()=>String(self.CLUB_API||'').replace(/\/$/,''), tok=()=>LS.get('lk_tok')||'';
const MIS={link:'линии связи',hf:'горизонталь и фронталь',axis:'с какой оси брать координату',visibility:'видимость',mediator:'выбор посредника',belong:'принадлежность точки линии и поверхности',nv:'натуральная величина',rotate:'вращение и замена плоскостей',order:'порядок соединения точек',reading:'чтение чертежа'};
const HL='#e8392b';

/* ── снимок шага для ядра: те же элементы и в том же порядке, что у плеера ── */
function flat(part){ const a=[]; (part.given||[]).forEach(it=>{ if(it&&typeof it==='object') a.push(it); }); (part.steps||[]).forEach(s=>(s.add||[]).forEach(it=>{ if(it&&typeof it==='object') a.push(it); })); return a; }
function snap(pl){ const S=pl.state, part=pl.part(), k=S.k, hidden=S.mode==='try'&&k>0&&!S.shown[S.pi+':'+k];
  let h3=false; try{ h3=!!(window.TASK3D&&TASK3D.has(part)); }catch(e){}
  const t=pl.t; return C.build(part,k,{n:t.n,title:(/^\d/.test(String(t.n))?'Задача № ':'')+t.n,q:[t.q,part.q].filter(Boolean).join(' '),mode:S.mode,hidden,has3d:h3}); }
const keyOf=pl=>pl.state.pi+':'+pl.state.k+':'+pl.state.mode+':'+(pl.state.shown[pl.state.pi+':'+pl.state.k]?1:0);

/* ── состояние шторки (живёт в состоянии плеера: переживает перерисовки) ── */
function st(pl){ const S=pl.state; if(!S.tu||S.tu.key!==keyOf(pl)){ const M=snap(pl); S.tu={key:keyOf(pl),M,level:-1,msgs:[],show:[],busy:false,tap:null}; } return S.tu; }
function open(pl){ const T=st(pl); pl.state.help=true; pl.state.peek=false; if(T.level<0) step(pl,0,true); else pl.render(); }
function step(pl,level,first){ const T=st(pl), L=C.ladder(T.M,level); T.level=Math.max(T.level,L.level);
  T.msgs.push({who:'ai',say:L.say,ask:L.ask,level:L.level,src:'core'}); T.show=L.show; mark(pl,'lvl',L.level);
  const tp=L.show.find(a=>a.do==='tap'); T.tap=tp?tp.p:null;
  if(first) track(pl,'tutor_open'); pl.render(); }

/* ── модель знаний: что студент понимает неверно ── */
function mark(pl,kind,v){ const m=STg('tu_model',{})||{}; m.mis=m.mis||{}; m.n=(m.n||0)+1;
  if(kind==='mis'&&MIS[v]) m.mis[v]=(m.mis[v]||0)+1;
  if(kind==='tap'){ m.tap=m.tap||{ok:0,bad:0}; m.tap[v?'ok':'bad']++; }
  if(kind==='lvl'){ const key=String(pl.t.n)+':'+pl.state.pi+':'+pl.state.k; m.steps=m.steps||{}; m.steps[key]=Math.max(m.steps[key]||0,v); const ks=Object.keys(m.steps); if(ks.length>200) delete m.steps[ks[0]]; }
  m.at=Date.now(); STs('tu_model',m); }
function weak(){ const m=STg('tu_model',{})||{}, e=Object.entries(m.mis||{}).sort((a,b)=>b[1]-a[1])[0]; return e&&e[1]>=2?{code:e[0],n:e[1],name:MIS[e[0]]}:null; }
function track(pl,ev){ try{ window.TRACK&&TRACK(ev,{task:String(pl.t.n),mode:pl.state.mode}); }catch(e){} }

/* ── шторка ── */
function html(pl){ const T=st(pl), can=!!(API()&&tok()), ok=LS.get('tu_consent')==='1', w=weak();
  const lad=C.LEVELS.map((l,i)=>(i===3&&!T.M.has3d)?'':`<button type="button" class="tu-l${i<=T.level?' on':''}" data-l="${i}" aria-pressed="${i<=T.level}">${esc(l)}</button>`).join('');
  const log=T.msgs.map((m,i)=>m.who==='me'?`<div class="tu-m me">${esc(m.text)}</div>`:
    `<div class="tu-m ai${m.err?' err':''}">${esc(m.say)}${m.ask?`<div class="tu-ask">${esc(m.ask)}</div>`:''}${(m.options||[]).length&&i===T.msgs.length-1?`<div class="tu-opts">${m.options.map(o=>`<button type="button" class="tu-o">${esc(o)}</button>`).join('')}</div>`:''}${m.checked?`<div class="tu-ok" title="${esc(m.checked.join('; '))}">✓ ядро проверило: ${m.checked.length} ${m.checked.length===1?'утверждение':m.checked.length<5?'утверждения':'утверждений'}</div>`:''}${m.author?'<button type="button" class="btn ghost tu-auth">Спросить автора</button>':''}</div>`).join('');
  return `<div class="tu" role="region" aria-label="Наставник">
    <div class="tu-h"><span class="tu-av" aria-hidden="true">А</span><span class="tu-who"><b>Ассистент Андрея</b><small>${T.tap?'коснись чертежа там, где будет '+esc(T.tap):'геометрию проверяет ядро сайта'}</small></span>
      ${voiceOK()?'<button type="button" class="tu-ic tu-mic" aria-label="Спросить голосом">🎙</button>':''}<button type="button" class="tu-ic tu-x" aria-label="Закрыть наставника">✕</button></div>
    <div class="tu-lad" role="group" aria-label="Лестница подсказок">${lad}</div>
    <div class="tu-log" aria-live="polite">${log}${T.busy?'<div class="tu-m ai tu-wait"><i></i><i></i><i></i></div>':''}</div>
    ${T.tap?`<div class="tu-tapbar"><b>Отметь на чертеже: ${esc(T.tap)}</b><button type="button" class="btn ghost tu-tapx">Не знаю</button></div>`:''}
    <form class="tu-in"><input type="text" maxlength="400" placeholder="${can?'Спроси про этот шаг…':'Ответь или спроси…'}" aria-label="Вопрос наставнику"><button type="submit" class="btn pri" aria-label="Отправить">→</button></form>
    ${can&&!ok?`<label class="tu-cons"><input type="checkbox" class="tu-cb"> Отправлять вопрос модели Claude (зарубежный сервис). Уходит только текст вопроса и шаг задачи — без имени и фото.</label>`:''}
    ${!can&&API()?`<div class="tu-note">Лестница подсказок работает и так. Свободные вопросы — после <a href="lk/#/login">входа</a>.</div>`:''}
    ${w?`<div class="tu-note">Слабое место: <b>${esc(w.name)}</b> (${w.n} раз). На нём и потренируемся.</div>`:''}
  </div>`; }

function afterRender(pl){ const S=pl.state; if(!S.help||!S.tu) { clearOv(pl); return; }
  const host=pl.root.querySelector('.tu-host'); if(!host) return; const T=st(pl);
  host.innerHTML=html(pl); bind(pl,host); drawOv(pl,T.show);
  const lg=host.querySelector('.tu-log'); if(lg) lg.scrollTop=lg.scrollHeight;
  /* последняя реплика — в поле зрения: окно пояснения прокручивается к ней (на телефоне оно невысокое) */
  /* после того как плеер пересчитал высоту окна (measure) — в следующем кадре */
  const toLast=()=>{ try{ const sc=pl.root.querySelector('.pl-scroll'), ai=host.querySelectorAll('.tu-m.ai'), last=ai[ai.length-1]||host.querySelector('.tu-log');
    if(sc&&last&&host.isConnected){ const r=last.getBoundingClientRect(), R=sc.getBoundingClientRect(); sc.scrollTop+=Math.max(0,Math.min(r.top-R.top-8,r.bottom-R.bottom+64)); } }catch(e){} };
  requestAnimationFrame(()=>requestAnimationFrame(toLast)); }

function bind(pl,host){ const T=st(pl), q=s=>host.querySelector(s);
  q('.tu-x').addEventListener('click',()=>close(pl));
  host.querySelectorAll('.tu-l').forEach(b=>b.addEventListener('click',()=>step(pl,+b.dataset.l)));
  host.querySelectorAll('.tu-o').forEach(b=>b.addEventListener('click',()=>send(pl,b.textContent)));
  const au=q('.tu-auth'); if(au) au.addEventListener('click',()=>toAuthor(pl));
  const cb=q('.tu-cb'); if(cb) cb.addEventListener('change',()=>{ LS.set('tu_consent',cb.checked?'1':null); });
  const tx=q('.tu-tapx'); if(tx) tx.addEventListener('click',()=>{ T.tap=null; step(pl,Math.min(4,T.level+1)); });
  q('.tu-in').addEventListener('submit',e=>{ e.preventDefault(); const i=q('.tu-in input'), v=i.value.trim(); if(!v) return; i.value=''; send(pl,v); });
  const mic=q('.tu-mic'); if(mic) mic.addEventListener('click',()=>listen(pl,mic));
  ['pointerdown','wheel','keydown'].forEach(ev=>host.addEventListener(ev,e=>e.stopPropagation())); }

/* ── вопрос студента: модель (если можно) или лестница ядра ── */
async function send(pl,text){ const T=st(pl); T.msgs.push({who:'me',text}); T.tap=null;
  const can=API()&&tok()&&LS.get('tu_consent')==='1';
  if(!can){ const lv=intent(text,T.level); step(pl,lv); return; }
  T.busy=true; pl.render();
  const hist=T.msgs.slice(-9,-1).map(m=>({role:m.who==='me'?'user':'assistant',text:m.who==='me'?m.text:[m.say,m.ask].filter(Boolean).join(' ')}));
  let r=null, err=null; const t0=Date.now();
  try{ const res=await fetch(API()+'/api/tutor',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+tok()},body:JSON.stringify({ctx:T.M,q:text,history:hist,level:T.level,consent:true}),cache:'no-store'});
    r=await res.json().catch(()=>({})); if(!res.ok){ err=r.error||('Ошибка '+res.status); if(res.status===401) LS.set('lk_tok',null); r=null; } }
  catch(e){ err='Нет связи с сервером.'; }
  if(st(pl)!==T) return;   /* студент ушёл на другой шаг */
  T.busy=false;
  if(!r){ const L=C.ladder(T.M,intent(text,T.level)); T.level=Math.max(T.level,L.level); T.msgs.push({who:'ai',say:(err?err+' Пока — подсказка ядра: ':'')+L.say,ask:L.ask,src:'core'}); T.show=L.show; pl.render(); return; }
  /* ответ уже проверен сервером; для чертежа ещё раз — тем же ядром здесь (то, что не проходит, не рисуем) */
  const sh=C.checkShow(T.M,r.show).ok, tp=sh.find(a=>a.do==='tap');
  T.msgs.push({who:'ai',say:r.say,ask:r.ask,options:r.options,checked:(r.claims||[]).map(c=>c.rel+'('+c.a+(c.b?', '+c.b:'')+')'),author:r.author,src:r.model,ms:Date.now()-t0});
  if(r.level!=null) T.level=Math.max(T.level,Math.min(4,r.level|0));
  if(r.misconception) mark(pl,'mis',r.misconception);
  T.show=sh; T.tap=tp?tp.p:null; pl.render(); speak(r.say+(r.ask?' '+r.ask:'')); }
/* без модели: понять, какую ступень лестницы просят */
function intent(t,lv){ t=String(t).toLowerCase();
  if(/3d|3д|простран|объ[её]м|поверн/.test(t)) return 3;
  if(/весь|целиком|ответ|сдаюсь|покажи всё|полностью/.test(t)) return 4;
  if(/покажи|где|на чертеже|нарисуй/.test(t)) return 2;
  if(/почему|зачем|принцип/.test(t)) return 1;
  return Math.min(4,lv+1); }

function toAuthor(pl){ const T=st(pl), last=T.msgs.filter(m=>m.who==='me').slice(-1)[0];
  const text=(last?last.text+'\n\n':'')+'(Задача '+pl.t.n+', шаг '+pl.state.k+(T.M.step?': '+T.M.step.t:'')+')';
  try{ LS.set('lk_ask_draft',JSON.stringify({text,src:location.hash,where:'Задача '+pl.t.n,pending:0})); }catch(e){} location.hash='#/ask'; }

/* ── голос: браузерное распознавание и синтез речи (ru-RU), ничего не хранится ── */
const SR=self.SpeechRecognition||self.webkitSpeechRecognition;
const voiceOK=()=>!!SR;
let talk=false;
function listen(pl,btn){ try{ const r=new SR(); r.lang='ru-RU'; r.interimResults=false; r.maxAlternatives=1; btn.classList.add('on'); talk=true;
  r.onresult=e=>{ const v=e.results[0][0].transcript; if(v) send(pl,v); }; r.onend=()=>btn.classList.remove('on'); r.onerror=()=>btn.classList.remove('on'); r.start(); }catch(e){} }
function speak(t){ if(!talk||!self.speechSynthesis) return; try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(String(t).replace(/″/g,' два штриха').replace(/′/g,' штрих')); u.lang='ru-RU'; u.rate=1.05; speechSynthesis.speak(u); }catch(e){} }

/* ── чертёж: подсветка и временные построения тем же движком DRAW, в той же рамке ── */
function paperSvg(pl){ return pl.root.querySelector('.pl-paper svg.dwg'); }
function clearOv(pl){ const svg=paperSvg(pl); if(svg) svg.querySelectorAll('.tu-ov').forEach(g=>g.remove()); const p=pl.root.querySelector('.pl-paper'); if(p){ p.classList.remove('tu-tapmode'); const c=p.querySelector('.tu-cap'); if(c) c.remove(); } clearTimeout(pl._tuT); }
function frame(pl){ const S=pl.state, part=pl.part(), k=S.mode==='try'&&S.k>0&&!S.shown[S.pi+':'+S.k]?S.k-1:S.k;
  const sc=PLAYER.scene(part,k); /* сдвиг рамки: где на листе оказывается точка (0, 0) */
  const probe=DRAW.svg({items:[{t:'pt',at:[0,0]}],fitTo:sc.fitTo}), m=/cx="([-\d.]+)" cy="([-\d.]+)"/.exec(probe);
  return {fitTo:sc.fitTo,o:m?[+m[1],+m[2]]:[0,0]}; }
function inner(svgStr){ const a=svgStr.indexOf('</defs>'), b=svgStr.lastIndexOf('</svg>'); return a>0&&b>a?svgStr.slice(a+7,b):''; }
function itemsOf(pl,M,ids){ const A=flat(pl.part()), out=[];
  ids.forEach(id=>{ const e=C.el(M,id); if(!e) return;
    if(e.kind==='pt') out.push(A[e.o.item]); else e.o.items.forEach(i=>{ const it=A[i]; if(it&&(e.kind!=='grp'||it.t!=='pt'||it.l)) out.push(it); }); });
  return out.filter(Boolean); }
function drawOv(pl,show){ clearOv(pl); const svg=paperSvg(pl); if(!svg||!show||!show.length) return; const T=st(pl), M=T.M;
  let F; try{ F=frame(pl); }catch(e){ return; }
  const box=M.box, put=(items,cls)=>{ if(!items.length) return; const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','tu-ov '+cls);
    g.innerHTML=inner(DRAW.svg({items:items.map(it=>Object.assign({},it,{_g:'tu'})),fitTo:F.fitTo})); svg.appendChild(g); return g; };
  const pt=id=>M.pts[id];
  show.forEach(a=>{
    if(a.do==='highlight') put(itemsOf(pl,M,a.ids).map(it=>Object.assign({},it,{col:it.col||HL,k:it.t==='pt'?'res':it.k})),'tu-hl');
    if(a.do==='reveal') put(itemsOf(pl,M,a.ids),'tu-rv');
    if(a.do==='link'){ const p=pt(a.p); if(p) put([{t:'seg',a:[p.xy[0],box[1]-4],b:[p.xy[0],box[3]+4],k:'aux',col:HL}],'tu-tmp'); }
    if(a.do==='segment'){ const p=pt(a.a), q=pt(a.b); if(p&&q) put([{t:'seg',a:p.xy,b:q.xy,k:'aux',col:HL}],'tu-tmp'); }
    if(a.do==='replay') replay(pl,put);
    if(a.do==='3d') setTimeout(()=>{ try{ TASK3D.open(pl.t,pl.state.pi,pl.state.k); }catch(e){} },350);
    if(a.do==='goto') setTimeout(()=>pl.go(a.k),400);
    if(a.do==='tap') tapMode(pl,F,a.p); }); }
/* показ шага по частям: группа за группой (посредник, его сечения, линии связи, точки) с подписью */
function replay(pl,put){ const T=st(pl), M=T.M, G=Object.values(M.groups).filter(g=>g.s===M.k), paper=pl.root.querySelector('.pl-paper'); if(!G.length||!paper) return;
  const cap=document.createElement('div'); cap.className='tu-cap'; paper.appendChild(cap); let i=0;
  const next=()=>{ const svg=paperSvg(pl); if(!svg||st(pl)!==T) return; svg.querySelectorAll('.tu-ov.tu-rp').forEach(g=>g.remove());
    if(i>=G.length){ cap.textContent='✓ '+G.length+' '+(G.length<5?'части':'частей')+' — весь шаг'; pl._tuT=setTimeout(()=>{ cap.remove(); },1800); return; }
    const g=G[i], lb=(g.hits&&g.hits.length?['→ '+g.hits.slice(0,4).join(', ')]:g.labels.slice(0,4)); cap.textContent=(i+1)+' / '+G.length+' · '+g.name+(lb.length?': '+lb.join(', '):'');
    const el=put(itemsOf(pl,M,[g.id]).map(it=>Object.assign({},it,{col:g.col||HL})),'tu-hl tu-rp');
    try{ el&&window.DRAWIN&&DRAWIN(el.querySelectorAll('line,path,polyline,circle'),90); }catch(e){}
    i++; pl._tuT=setTimeout(next,1500); };
  next(); }
/* «Отметь, где будет точка»: касание → координаты чертежа → диагноз ядра */
function tapMode(pl,F,id){ const paper=pl.root.querySelector('.pl-paper'), svg=paperSvg(pl); if(!paper||!svg) return; paper.classList.add('tu-tapmode');
  const T=st(pl);
  const on=e=>{ if(e.target.closest('.pl-zoom,.tu-cap')) return; const S=paperSvg(pl); if(!S||st(pl)!==T||T.tap!==id) return;
    const ctm=S.getScreenCTM(); if(!ctm) return; const P=S.createSVGPoint(); P.x=e.clientX; P.y=e.clientY; const q=P.matrixTransform(ctm.inverse());
    const xy=[q.x-F.o[0],q.y-F.o[1]], r=C.tapCheck(T.M,id,xy);
    mark(pl,'tap',r.ok); if(r.misconception) mark(pl,'mis',r.misconception);
    T.msgs.push({who:'me',text:'(отметил точку на чертеже)'}); T.msgs.push({who:'ai',say:r.say,src:'core'}); T.tap=r.ok?null:id; T.show=(r.show||[]).concat(r.ok?[]:[{do:'tap',p:id}]);
    paper.removeEventListener('click',on,true); pl.render();
    const svg2=paperSvg(pl); if(svg2){ const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','tu-ov tu-mine');
      g.innerHTML=`<circle cx="${q.x}" cy="${q.y}" r="4.5" fill="none" stroke="${r.ok?'#13804e':HL}" stroke-width="2"/><circle cx="${q.x}" cy="${q.y}" r="1.4" fill="${r.ok?'#13804e':HL}"/>`; svg2.appendChild(g); } };
  paper.addEventListener('click',on,true); }

function close(pl){ pl.state.help=false; clearOv(pl); pl.render(); }
window.TUTOR={open,afterRender,close,snap,_st:st};
})();
