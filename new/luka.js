/* ═══════════ Лука — ИИ-агент на чертеже (копия /new/) ═══════════
   Пингвин в левом нижнем углу чертежа. Нажал — облачко: готовые вопросы по текущему шагу и поле «спроси Луку».
   Отвечает в четыре ступени, от бесплатной к платной:
     1) кнопки — ответы собраны из данных шага (решатель: шаг, «почему так», намёк, числа, «проверь себя»; словарь терминов GLOSS;
        типичные ошибки методики ДЗ);
     2) свой вопрос — разборщик: нормализует текст, находит тип вопроса (почему / где / числа / ошибка / термин…), точки и номер шага,
        считает уверенность (0…1) по совпадению с ответами этого шага;
     3) уверенность средняя — «Ты про это?»: 2–3 ближайших вопроса кнопками;
     4) уверенность низкая — ИИ: наставник на сервере (/api/tutor/chat, режим explain — объясняет прямо, без наводящих вопросов),
        его ответы сверяются с решением. Вне ДЗ или без входа — честное «пока отвечаю по заготовкам».
   Вопросы, на которые не нашлось заготовки, копятся (localStorage luka_inbox, событие TRACK luka) — из них растут новые заготовки.
   Подключение: PLAYER.mount(…, {luka:{dz,n}|{task}}) — плеер сам ставит Луку на каждый шаг (LUKA.attach). */
(function(){
'use strict';
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const strip=h=>{const d=document.createElement('div');d.innerHTML=String(h||'');return (d.textContent||'').replace(/\s+/g,' ').trim();};
/* журнал для обучения Луки (server/lib/luka.js): без имени и аккаунта */
const toServer=o=>{try{const A=String(self.CLUB_API||'').replace(/\/$/,'');if(!A||!/^https:$/.test(location.protocol))return;
  fetch(A+'/api/luka/miss',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(o),keepalive:true,credentials:'omit'}).catch(()=>{});}catch(e){}};
const track=(ev,o)=>{try{window.TRACK&&TRACK('luka',Object.assign({ev},o||{}));}catch(e){}};

/* ── пингвин (эскиз; финального рисует аниматор) ── */
const PENG=`<svg class="lk-mz" viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="113" rx="30" ry="5" fill="rgba(0,0,0,.14)"/><g class="m-all"><g class="m-body">
 <ellipse cx="46" cy="108" rx="11" ry="5.5" fill="#f39a1e"/><ellipse cx="74" cy="108" rx="11" ry="5.5" fill="#f39a1e"/>
 <path class="m-arm l" d="M27 62c-11 9-14 24-7 33 4-9 8-18 12-27z" fill="#1d2638"/><path class="m-arm" d="M93 62c11 9 14 24 7 33-4-9-8-18-12-27z" fill="#1d2638"/>
 <path d="M60 18c27 0 39 29 39 57 0 23-16 35-39 35S21 98 21 75c0-28 12-57 39-57z" fill="#1d2638"/>
 <path d="M60 50c18 0 27 16 27 31 0 17-11 25-27 25S33 98 33 81c0-15 9-31 27-31z" fill="#fff"/>
 <path d="M36 61q24 13 48 0v6q-24 13-48 0z" fill="#e0262d"/><path d="M76 66l9 15-8 2-6-14z" fill="#c41e24"/>
 <g class="m-head"><ellipse cx="48" cy="42" rx="12" ry="12.5" fill="#fff"/><ellipse cx="72" cy="42" rx="12" ry="12.5" fill="#fff"/>
  <g class="m-eye"><ellipse cx="49.5" cy="42" rx="4.6" ry="5.2" fill="#141a26"/><circle cx="51.2" cy="40" r="1.6" fill="#fff"/></g>
  <g class="m-eye"><ellipse cx="70.5" cy="42" rx="4.6" ry="5.2" fill="#141a26"/><circle cx="72.2" cy="40" r="1.6" fill="#fff"/></g>
  <path d="M53 52q7-3 14 0l-7 9z" fill="#f6a21e" stroke="#f6a21e" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="38" cy="52" r="4.5" fill="#ff8a9a" opacity=".45"/><circle cx="82" cy="52" r="4.5" fill="#ff8a9a" opacity=".45"/></g></g></g></svg>`;
function react(el,cls,ms){if(!el)return;el.classList.remove('happy','sad','talk');void el.offsetWidth;el.classList.add(cls);clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove(cls),ms||1400);}

/* ═══ разборщик своего вопроса ═══ */
const END=/(иями|ями|ами|ого|ему|ому|ыми|ими|ией|ия|ие|ий|ый|ой|ая|яя|ое|ее|ые|ие|ов|ев|ей|ам|ям|ах|ях|ом|ем|ую|юю|ешь|ет|ут|ют|ит|ат|ят|ть|ся|сь|а|я|о|е|ы|и|у|ю|ь)$/;
const stem=w=>{let s=w;for(let i=0;i<2&&s.length>4;i++){const t=s.replace(END,'');if(t===s||t.length<3)break;s=t;}return s;};
const STOP=new Set('и в во на а но не ни что это как так то же ли бы ты я мне у к с со по за из от до о об при для или да ну вот там тут где вообще просто'.split(' '));
function norm(text){const raw=String(text||'').toLowerCase().replace(/ё/g,'е');
  const toks0=raw.replace(/[^a-zа-я0-9′″'"₀-₉ⅰ-ⅻ]+/gi,' ').split(' ').filter(Boolean), toks=toks0.map(t=>(LIB.syn&&LIB.syn[t])||t);
  return {raw,toks,stems:toks.filter(t=>!STOP.has(t)).map(stem)};}
/* тип вопроса: корни слов → какой ответ нужен */
const INT={
  why:['почему','зачем','смысл','для чего','откуда','обоснова','с чего бы','логик','какой смысл'],
  what:['что дела','что тут','что здесь','как дела','как постро','как сдела','объясн','поясн','не поним','непонят','не понял','не поняла','не вдупля','что происход','что значит этот шаг','что вообще','как это'],
  show:['где','покаж','показ','найди','найти','на чертеж','какая точк','какую точк','какой точк','не вижу','подсвет'],
  nums:['скольк','числ','координат','размер','мм','радиус','расстоян','длин','высот','глубин','значени'],
  mistake:['ошиб','не сход','не получ','неправильн','не туда','криво','не так','косяк','не совпада','промах','переделы'],
  term:['что такое','что знач','это что','определени','термин','как называ','что за'],
  check:['провер','правильно ли','верно ли','так ли','как понять что'],
  next:['дальше','следующ','потом','что после'],
  hint:['с чего нач','подскаж','намек','намёк','застрял','не знаю как','с чего']};
function intents(n){const out={};for(const k in INT){let s=0;for(const w of INT[k]) if(n.raw.includes(w)) s=Math.max(s,w.length>5?1:.8);if(s)out[k]=s;}return out;}
const labelsIn=raw=>{const m=raw.match(/(?:^|[^a-zа-я])([a-zа-я]?\d{1,2}|[a-z][₀-₉0-9]?)(?=[′″'"]|\s|$|[,.?!])/gi)||[];return m.map(x=>x.replace(/^[^a-zа-я0-9]/i,'').toLowerCase());};

/* ── данные шага → ответы Луки ── */
function blocks(st){const o={what:'',why:'',hint:'',nums:'',check:''};if(!st)return o;
  if(/hw-ladder/.test(st.tbl||'')){const d=document.createElement('div');d.innerHTML=st.tbl;
    const g=c=>{const e=d.querySelector('details.'+c+'>div');return e?e.innerHTML:'';};
    o.what=g('l3');o.why=g('l2');o.hint=g('l1');o.nums=g('l4');o.check=g('l5');}
  else{o.what=st.d||'';o.why=st.why||'';if(st.tbl&&/<table/.test(st.tbl))o.nums=st.tbl;}
  return o;}
function replies(c){const st=c.st, b=blocks(st), R=[];const kw=s=>norm(strip(s)).stems;
  const add=(id,q,a,extra)=>{if(a)R.push(Object.assign({id,q,a,kw:kw(q+' '+a)},extra||{}));};
  if(c.k===0){add('what','Что тут дано?',c.intro||'Это условие: посмотри, что задано и что нужно найти. Жми «Начать» — пойдём по шагам.');
    add('next','С чего начнём?',c.first?('Первый шаг — <b>'+esc(c.first)+'</b>. Жми «Начать».'):'');}
  else{add('what','Что делаем?',(st.t?'<b>'+esc(st.t)+'.</b> ':'')+(b.what||''));
    add('why','Почему так?',b.why);
    add('show','Покажи на чертеже',c.newCount?'Подсветил то, что появилось на этом шаге'+(c.labels.length?': '+c.labels.slice(0,6).map(esc).join(', '):'')+'.':'',{act:'show'});
    add('nums','Покажи числа',b.nums);
    add('hint','С чего начать?',b.hint);
    add('check','Как проверить себя?',b.check);
    if(c.mistakes&&c.mistakes.length){const sk=new Set(kw((st&&st.t||'')+' '+b.what+' '+b.why));let best=null,bs=0;
      c.mistakes.forEach(m=>{const o=kw(m).filter(w=>w.length>3&&sk.has(w)).length;if(o>bs){bs=o;best=m;}});
      if(best)add('mistake','Где тут ошибаются?','Частая ошибка: '+best);}
    if(c.nextT)add('next','Что дальше?','Дальше — <b>'+esc(c.nextT)+'</b>.');}
  /* термины этого шага — из словаря сайта */
  try{const txt=strip((st&&st.t||'')+' '+b.what+' '+b.why);(window.GLOSS?GLOSS.find(txt,2):[]).forEach(t=>add('term:'+t.t,'Что такое «'+t.t.replace(/\s*\(.*\)$/,'')+'»?','<b>'+esc(t.t)+'.</b> '+t.d));}catch(e){}
  if(c.has3d)add('3d','Покажи в 3D','Открыл этот шаг в 3D — покрути пальцем, посмотри с разных сторон.',{act:'3d'});
  libFor(c.src||'').forEach(r=>R.push({id:'lib:'+r.id,q:r.q,a:r.a,intent:r.intent||'what',btn:r.btn===true,kw:kw(r.q+' '+r.a+' '+(r.kw||[]).join(' '))}));
  return R;}
/* уверенность: тип вопроса + совпадение слов + точки/шаг из вопроса */
function match(text,R,c){const n=norm(text), I=intents(n), labs=labelsIn(n.raw);
  /* термин спросили напрямую — словарь знает термины всего курса, не только этого шага */
  let gl=null;try{const f=window.GLOSS?GLOSS.find(text,1):[];if(f.length&&(I.term||n.stems.length<=4))gl=f[0];}catch(e){}
  /* сильная заготовка (библиотека или шаг) важнее словаря: «как получаются проекции точки» — развёрнутый ответ, а не определение */
  const pre=R.map(r=>({r,ov:r.kw.length?n.stems.filter(w=>w.length>2&&r.kw.includes(w)).length:0})).filter(x=>x.r.id.indexOf('lib:')===0&&x.ov>=2&&(!I.term||x.r.intent==='term')).sort((a,b)=>b.ov-a.ov)[0];
  if(pre)return {best:pre.r,alts:[],conf:.8,why:'lib'};
  if(gl){const id='term:'+gl.t;let r=R.find(x=>x.id===id);if(!r){r={id,q:'Что такое «'+gl.t+'»?',a:'<b>'+esc(gl.t)+'.</b> '+gl.d,kw:[]};}return {best:r,alts:[],conf:.9,why:'term'};}
  const sc=R.map(r=>{const base=r.intent||r.id.split(':')[0];let s=(I[base]||0)*.6;
    const ov=r.kw.length?n.stems.filter(w=>w.length>2&&r.kw.includes(w)).length:0;s+=Math.min(.35,ov*.09);
    if(labs.length&&(base==='show'||base==='what')&&labs.some(l=>c.labels.map(x=>x.toLowerCase()).includes(l)))s+=.25;
    return {r,s};}).sort((a,b)=>b.s-a.s);
  /* «не понимаю» без уточнений — объяснить шаг */
  if(!sc.length)return {best:null,alts:[],conf:0};
  /* покрытие: сколько слов вопроса мы вообще узнали (тип вопроса, слова шага, точки). Длинный вопрос про своё («у меня на листе
     съехало, препод ругается») с одним «почему» — не про этот шаг: уверенность режем, пусть отвечает ИИ */
  const known=new Set([].concat(...R.map(r=>r.kw)));
  const meaningful=n.stems.filter(w=>w.length>2), hit=meaningful.filter(w=>known.has(w)||Object.values(INT).some(L=>L.some(x=>x.startsWith(w)||w.startsWith(x.split(' ')[0])))).length;
  const cover=meaningful.length?hit/meaningful.length:1;
  const top=sc[0], gap=top.s-(sc[1]?sc[1].s:0);
  let conf=Math.max(0,Math.min(1,top.s+(gap>.25?.1:0)));
  if(meaningful.length>4&&cover<.5) conf*=cover+.2;
  return {best:top.r,alts:sc.slice(0,3).filter(x=>x.s>.05).map(x=>x.r),conf,intents:Object.keys(I)};}
const HI=.55, MID=.3;
/* ── библиотека заготовок (luka-lib.json): ответы на частые вопросы по местам (ДЗ:вариант:шаг, задача:шаг, * — везде) и синонимы.
   Её дописывает ежедневная сессия обучения по журналу /api/luka/inbox (docs/LUKA.md) ── */
let LIB={syn:{},replies:[]};
try{fetch(new URL('luka-lib.json',document.currentScript&&document.currentScript.src||location.href),{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{if(j)LIB=Object.assign({syn:{},replies:[]},j);}).catch(()=>{});}catch(e){}
const globRe=g=>new RegExp('^'+String(g).split('*').map(x=>x.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');
function libFor(src){return (LIB.replies||[]).filter(r=>[].concat(r.where||'*').some(w=>globRe(w).test(src)));}

/* ═══ ИИ (ступень 4): наставник на сервере ═══ */
const API=()=>String(self.CLUB_API||'').replace(/\/$/,'');
async function ai(c,text){const t=LS.get('lk_tok',null)||(()=>{try{return localStorage.getItem('lk_tok');}catch(e){return '';}})();
  if(!c.dz||!API())return {text:'Этот вопрос я пока не знаю. Записал его — скоро научусь. Попробуй спросить про шаг кнопками ниже.',miss:true};
  if(!t)return {text:'Свободные вопросы я разбираю после входа: <a href="../lk/#/login">войти</a>. Кнопки ниже работают и без входа.',login:true};
  try{const r=await fetch(API()+'/api/tutor/chat',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+t},cache:'no-store',
      body:JSON.stringify({dz:c.dz,n:c.v,text,step:c.gstep||null,mode:'explain'})});
    const j=await r.json().catch(()=>({}));
    if(r.status===401)return {text:'Сессия закончилась — <a href="../lk/#/login">войди снова</a>.',login:true};
    if(j.needAiConsent)return {consent:true};
    if(!r.ok)return {text:esc(j.error||'Не получилось ответить. Попробуй ещё раз.'),miss:true};
    return {text:esc(j.reply||'').replace(/\n/g,'<br>'),actions:j.actions||[],id:j.id,ai:true};}
  catch(e){return {text:'Нет связи. Проверь интернет и спроси ещё раз.',miss:true};}}
async function consent(){const t=(()=>{try{return localStorage.getItem('lk_tok');}catch(e){return '';}})();
  try{await fetch(API()+'/api/me/profile',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+t},body:JSON.stringify({ai:true})});return true;}catch(e){return false;}}

/* ═══ облачко ═══ */
let OPEN=null;   /* {paper, api, view} — одно облачко на странице */
function close(){if(OPEN){OPEN.el.remove();OPEN=null;}}
document.addEventListener('pointerdown',e=>{if(OPEN&&!OPEN.el.contains(e.target)&&!e.target.closest('.lk-b'))close();});
function ctxOf(api){const c=api.ctx();c.labels=c.labels||[];return c;}
function open(paper,api){close();const c=ctxOf(api), R=replies(c);
  const el=document.createElement('div');el.className='lk-w';el.setAttribute('role','dialog');el.setAttribute('aria-label','Лука');
  paper.appendChild(el);OPEN={el,paper,api,c,R,used:new Set(),more:false};
  say(c.k>0?'Шаг '+c.k+' из '+c.steps+'. Что непонятно?':'Привет, я Лука. Что непонятно?');react(paper.querySelector('.lk-b'),'happy',900);track('open',{src:c.src});}
function say(html,o){if(!OPEN)return;o=o||{};OPEN.go=o.go||null;const {el,R,used}=OPEN;
  const left=R.filter(r=>!used.has(r.id)&&(r.id.indexOf('lib:')!==0||r.btn)), show=OPEN.more?left:left.slice(0,3);
  el.innerHTML=`<div class="lk-h"><b>Лука</b><span>ИИ-агент</span><button type="button" class="lk-x" aria-label="Закрыть">×</button></div>
   <div class="lk-say${o.typing?' typing':''}">${o.typing?'<i></i><i></i><i></i>':html}</div>
   ${o.go?`<button type="button" class="lk-go" data-go="1">Покажи на чертеже</button>`:''}
   ${o.rate?`<div class="lk-rate" data-rid="${esc(o.rate)}"><button type="button" data-g="1" aria-label="Помогло">👍</button><button type="button" data-g="0" aria-label="Не помогло">👎</button></div>`:''}
   ${o.sugg&&o.sugg.length?`<div class="lk-sug"><span>Ты про это?</span>${o.sugg.map(r=>`<button type="button" data-q="${esc(r.id)}">${esc(r.q)}</button>`).join('')}<button type="button" data-ai="1">Нет, другое</button></div>`:''}
   ${o.consent?`<label class="lk-cons"><input type="checkbox" data-cons> Можно спросить ИИ (без имени)</label>`:''}
   ${o.typing||o.sugg||o.consent?'':`<div class="lk-q">${show.map(r=>`<button type="button" data-q="${esc(r.id)}">${esc(r.q)}</button>`).join('')}${!OPEN.more&&left.length>3?'<button type="button" class="more" data-more="1">ещё</button>':''}</div>`}
   <form class="lk-in"><input placeholder="Спроси Луку своими словами" aria-label="Вопрос Луке" maxlength="300"><button aria-label="Спросить">→</button></form>`;
  bindBubble();}
function bindBubble(){const {el}=OPEN;
  el.querySelector('.lk-x').onclick=close;
  el.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>answer(OPEN.R.find(r=>r.id===b.dataset.q)||null,'button'));
  const m=el.querySelector('[data-more]');if(m)m.onclick=()=>{OPEN.more=true;say(el.querySelector('.lk-say').innerHTML);};
  const gb=el.querySelector('[data-go]');if(gb)gb.onclick=()=>{const g=OPEN.go, api=OPEN.api;close();try{api.goGlobal(g.id,g.step);}catch(e){}};
  const a=el.querySelector('[data-ai]');if(a)a.onclick=()=>askAi(OPEN.lastText||'');
  const cs=el.querySelector('[data-cons]');if(cs)cs.onchange=async()=>{if(!cs.checked)return;cs.disabled=true;await consent();askAi(OPEN.lastText||'');};
  el.querySelectorAll('.lk-rate [data-g]').forEach(b=>b.onclick=()=>{const g=b.dataset.g==='1', rid=b.parentNode.dataset.rid;
    track('rate',{rid,good:g?1:0,src:OPEN.c.src});toServer({src:OPEN.c.src,kind:g?'up':'down',rid,q:g?'':(OPEN.lastText||'').slice(0,300)});const log=LS.get('luka_rate',[]);log.push({rid,g,src:OPEN.c.src,t:Date.now()});LS.set('luka_rate',log.slice(-200));
    b.parentNode.innerHTML=g?'<span class="lk-ok">Спасибо!</span>':'<span class="lk-ok">Понял, переделаю.</span> <a href="#/ask">Написать в поддержку</a>';react(OPEN.paper.querySelector('.lk-b'),g?'happy':'sad',1200);});
  /* «войти» — в настоящий кабинет; после входа кабинет вернёт на этот же чертёж (lk_ret, lk/app.js goRet) */
  el.querySelectorAll('a[href*="lk/#/login"]').forEach(x=>x.onclick=()=>{try{localStorage.setItem('lk_ret','/new/'+location.hash);}catch(e){}});
  const f=el.querySelector('.lk-in');f.onsubmit=e=>{e.preventDefault();const v=f.querySelector('input').value.trim();if(v)ask(v);};}
function answer(r,how){if(!OPEN||!r)return;OPEN.used.add(r.id);const pen=OPEN.paper.querySelector('.lk-b');
  if(r.act==='show')try{OPEN.api.show();}catch(e){}
  if(r.act==='3d'){const api=OPEN.api;setTimeout(()=>{try{api.open3d();}catch(e){}},600);}
  say('',{typing:true});react(pen,'talk',900);track('answer',{rid:r.id,how,src:OPEN.c.src});
  setTimeout(()=>say(r.a,{rate:r.id}),how==='button'?280:450);}
function ask(text){if(!OPEN)return;OPEN.lastText=text;const m=match(text,OPEN.R,OPEN.c);OPEN.lastConf=m.conf;
  track('ask',{conf:Math.round(m.conf*100),rid:m.best&&m.best.id||'',src:OPEN.c.src});
  if(m.best&&m.conf>=HI)return answer(m.best,'text');
  if(m.alts.length&&m.conf>=MID)return say('Я понял не до конца.',{sugg:m.alts});
  askAi(text);}
async function askAi(text){if(!OPEN)return;const c=OPEN.c, pen=OPEN.paper.querySelector('.lk-b');
  toServer({src:c.src,kind:'miss',q:text.slice(0,300),conf:Math.round((OPEN.lastConf||0)*100)});
  const inbox=LS.get('luka_inbox',[]);inbox.push({q:text.slice(0,300),src:c.src,k:c.k,t:Date.now()});LS.set('luka_inbox',inbox.slice(-100));
  say('',{typing:true});react(pen,'talk',3000);const r=await ai(c,text);if(!OPEN)return;
  if(r.consent)return say('Этот вопрос разберу через ИИ.',{consent:true});
  track('ai',{ok:r.ai?1:0,src:c.src});
  const go=r.ai&&(r.actions||[]).find(a=>a.t==='show'&&(a.step!=null||a.id));
  if(OPEN)say(r.text,{rate:r.ai?'ai:'+(r.id||''):'miss',go});}

/* ═══ подключение к чертежу ═══ */
function attach(paper,api){if(!paper||paper.querySelector('.lk-b'))return;
  const b=document.createElement('button');b.type='button';b.className='lk-b';b.setAttribute('aria-label','Лука — спросить про этот шаг');b.innerHTML=PENG;
  b.onclick=e=>{e.stopPropagation();if(OPEN&&OPEN.paper===paper){close();return;}open(paper,api);};paper.appendChild(b);}
self.LUKA={attach,close,_match:match,_replies:replies,_norm:norm};
/* чертежи, отрисованные до загрузки этого файла */
document.querySelectorAll('.pl-paper').forEach(p=>{if(p.__lk)attach(p,p.__lk);});
})();
