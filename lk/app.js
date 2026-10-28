/* Клуб Начерта — личный кабинет тестировщика. Без сборки и зависимостей; логика — в lib/*.js (общая с сервером).
   Прогресс живёт в localStorage под теми же ключами nch2_*, что на основном сайте, и синхронизируется с аккаунтом (lib/sync.js).
   CSP запрещает встроенные скрипты и стили: обработчики — через data-act, ширины полос — через el.style после отрисовки. */
(function(){
'use strict';
const CAL=ClubCalendar, PL=ClubPlan, SRS=ClubSRS, BKT=ClubBKT, SYNC=ClubSync, REM=ClubReminder, SCAN=ClubScanner, FEAT=ClubFeatures;
const VER='club-2.0';
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const view=()=>$('#view');
const K={cal:'nch2_club_cal',done:'nch2_club_done',ii:'nch2_club_ii',ev:'nch2_club_ev',rep:'nch2_rep',train:'nch2_club_train',diag:'nch2_club_diag',mock:'nch2_club_mock',me:'nch2_club_me',seen:'nch2_club_seen'};
let CFG=null, ME=null, CORE=null, OFFLINE=false;
/* API: на nachert1830.ru/lk/ — адрес функции в Yandex Cloud из config.js; со страницы на адресе функции — свой же сайт ('').
   Вход хранится токеном в localStorage и уходит заголовком Authorization (cookie на другой сайт браузеры не отправляют). */
const API=String(window.CLUB_API||'').replace(/\/$/,''), ON_MAIN=!!API;
const TOK={ get(){ try{ return localStorage.getItem('club_tok')||''; }catch(e){ return ''; } }, set(v){ try{ if(v) localStorage.setItem('club_tok',v); else localStorage.removeItem('club_tok'); }catch(e){} } };
/* адрес этой страницы для возврата после Яндекс ID: https://nachert1830.ru/lk/ или https://<функция>/ */
const pageUrl=()=>location.origin+location.pathname.replace(/index\.html$/,'');

/* ── хранилище: любое изменение помечает ключ временем (для слияния) и ставит синхронизацию в очередь ── */
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return null; } };
const LS={
  get(k,d){ try{ const v=localStorage.getItem(k); if(v===null) return d; const p=JSON.parse(v); return p===null?d:p; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); if(SYNC.syncable(k)){ const mt=J(localStorage.getItem('nch2_club_mt'))||{}; mt[k]=Date.now(); localStorage.setItem('nch2_club_mt',JSON.stringify(mt)); markDirty(); } }catch(e){ toast('Хранилище браузера недоступно'); } },
  device(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
};

/* ── сеть ── */
async function api(method,path,body){
  const h={'Accept':'application/json'}, tok=TOK.get(); if(body!==undefined) h['Content-Type']='application/json';
  if(tok) h['Authorization']='Bearer '+tok; else if(ME&&ME.csrf&&method!=='GET') h['X-CSRF-Token']=ME.csrf;
  let r; try{ r=await fetch(API+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),credentials:API?'omit':'same-origin',cache:'no-store'}); }
  catch(e){ const err=new Error('Нет сети'); err.offline=true; throw err; }
  let data={}; try{ data=await r.json(); }catch(e){}
  if(!r.ok){ const err=new Error(data.error||('Ошибка '+r.status)); err.status=r.status; err.data=data; if(r.status===401&&data.login){ TOK.set(''); if(ME){ ME=null; route(); } } throw err; }
  return data; }

/* ── синхронизация ── */
let syncTimer=null, syncing=false, localVer=0, lastSync=0, syncErr='';
function markDirty(){ localVer++; try{ localStorage.setItem('nch2_club_dirty','1'); }catch(e){} clearTimeout(syncTimer); syncTimer=setTimeout(syncNow,2000); netState(); }
const isDirty=()=>{ try{ return localStorage.getItem('nch2_club_dirty')==='1'; }catch(e){ return false; } };
async function syncNow(){
  if(!ME||!ME.flags||!ME.flags.sync||syncing||OFFLINE) { netState(); return false; }
  if(!navigator.onLine){ netState(); return false; }
  syncing=true; netState(); const v=localVer;
  try{ const r=await api('PUT','/api/progress',SYNC.readLocal(localStorage)); let st={data:r.data,mt:r.mt};
    if(localVer!==v) st=SYNC.merge(st,SYNC.readLocal(localStorage));
    SYNC.writeLocal(localStorage,st); if(localVer===v){ try{ localStorage.removeItem('nch2_club_dirty'); }catch(e){} }
    lastSync=Date.now(); syncErr=''; return true; }
  catch(e){ syncErr=e.offline?'':e.message; return false; }
  finally{ syncing=false; netState(); if(localVer!==v){ clearTimeout(syncTimer); syncTimer=setTimeout(syncNow,1500); } } }
function netState(){ const n=$('#net'); if(!n) return; const off=!navigator.onLine||OFFLINE;
  n.className='net'+(off||syncErr?' off':''); n.textContent=!ME?'':off?'офлайн · сохранится позже':syncErr?'не сохранено':syncing||(isDirty()&&ME.flags&&ME.flags.sync)?'сохраняю…':isDirty()?'есть несохранённое':lastSync?'сохранено':''; n.title=syncErr||''; }
addEventListener('online',()=>{ if(OFFLINE) boot(); else syncNow(); netState(); });
addEventListener('offline',netState);
setInterval(()=>{ if(isDirty()) syncNow(); },60e3);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden'&&isDirty()) syncNow(); });

/* ── что делаю: короткие события и «я сейчас здесь» — для живого пульта владельца (без содержимого решений и фото) ── */
let ACTQ=[], actTimer=null, lastBeat=0;
const curView=()=>(location.hash.replace(/^#\/?/,'').split('/')[0].replace(/[^a-z]/g,'').slice(0,12))||'today';
function track(type,d){ ACTQ.push({type,t:Date.now(),d:d||{}}); if(ACTQ.length>40) ACTQ=ACTQ.slice(-40); clearTimeout(actTimer); actTimer=setTimeout(beat,1200); }
async function beat(away){ if(!ME||OFFLINE||!navigator.onLine) return; const ev=ACTQ.splice(0,20); lastBeat=Date.now();
  try{ await api('POST','/api/act',{ev,view:curView(),away:away===true}); }catch(e){ if(!e.status) ACTQ=ev.concat(ACTQ); } }
setInterval(()=>{ if(document.visibilityState==='visible'&&Date.now()-lastBeat>40e3) beat(); },15e3);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') beat(true); else beat(); });

/* ── общее ── */
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),3200); }
function paint(root){ $$('[data-w]',root).forEach(el=>{ el.style.width=Math.max(0,Math.min(100,+el.dataset.w))+'%'; }); $$('[data-h]',root).forEach(el=>{ el.style.height=Math.max(2,Math.min(100,+el.dataset.h))+'%'; }); }
function render(html,title){ const v=view(); v.innerHTML=html; paint(v); if(title) document.title=title+' · Личный кабинет Начерта'; tabs(); netState(); }
function openSheet(html,onBind){ closeSheet(); const bg=document.createElement('div'); bg.className='sheet-bg'; bg.id='sheet';
  bg.innerHTML='<div class="sheet-p" role="dialog" aria-modal="true">'+html+'</div>'; document.body.appendChild(bg);
  bg.addEventListener('click',e=>{ if(e.target===bg||e.target.closest('[data-close]')) closeSheet(); }); paint(bg); const f=$('input,textarea,button',bg); if(f) f.focus(); if(onBind) onBind(bg); return bg; }
function closeSheet(){ const s=$('#sheet'); if(s) s.remove(); }
addEventListener('keydown',e=>{ if(e.key==='Escape') closeSheet(); });
const today=()=>CAL.browserToday(), dayNum=()=>CAL.toDay(today());
const week1=()=>(ME&&ME.week1)||(CFG&&CFG.week1)||CAL.DEFAULT_WEEK1;
/* справочник групп (data/groups.json): день занятия по каждому предмету и точные даты — по группе студента */
let GROUPS={groups:{}};
const myGroup=()=>(ME&&ME.user&&ME.user.group)||'';
/* «ИУ5-12Б» найдёт «ИУ5-12/6», если такая группа одна; «/4», «/6» в расписании — разные группы */
const gBase=g=>String(g||'').replace(/(\/\d)?[А-ЯЁA-Z]*$/,'');
const groupAlts=g=>Object.keys(GROUPS.groups||{}).filter(k=>gBase(k)===gBase(g));
const groupKey=()=>{ const g=myGroup(), G=GROUPS.groups||{}; if(!g) return ''; if(G[g]) return g; const c=groupAlts(g); return c.length===1?c[0]:''; };
const groupSched=()=>{ const k=groupKey(); return k?GROUPS.groups[k]:null; };
const okGroup=g=>/^[А-ЯЁA-Z]{1,6}\d{0,2}[А-ЯЁA-Z]?-[\d.]{1,5}(\/\d)?[А-ЯЁA-Z]{0,2}$/.test(g);
/* числитель — нечётные недели семестра, знаменатель — чётные */
const parity=wk=>wk%2?'чс':'зн';
const SUBJ_T={ikg:'ИКГ',ng:'Начерт'}, WD2=['','пн','вт','ср','чт','пт','сб','вс'];
const parT=p=>p==='чс'?'по числителям':p==='зн'?'по знаменателям':'';
/* ближайшее занятие группы с учётом числителя/знаменателя: {l, date, inDays} */
function nextLesson(){ const g=groupSched(); if(!g||!g.lessons) return null; const t0=dayNum(), now=new Date(), hm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  for(let i=0;i<15;i++){ const d=t0+i, ds=CAL.toStr(d), wd=CAL.weekday(d), wk=CAL.weekOf(week1(),ds);
    const ls=g.lessons.filter(l=>l.day===wd&&(!l.par||l.par===parity(wk))&&(i>0||l.t>=hm)).sort((a,b)=>a.t.localeCompare(b.t));
    if(ls.length) return {l:ls[0],date:ds,inDays:i}; } return null; }
const lessonLi=(l,hot)=>`<li class="${hot?'hot':''}"><b>${WD2[l.day]} ${esc(l.t.replace(/^0/,''))}</b><span><em class="sb ${l.subj}">${SUBJ_T[l.subj]}</em> ауд. ${esc(l.rooms.join(', '))}${l.par?' · '+parT(l.par):''}<small>${esc((l.who||[]).join(', '))}${l.unsure?' · сверьте с расписанием':''}</small></span></li>`;
const normGroup=g=>{ let x=String(g||'').toUpperCase().trim().replace(/[–—]/g,'-'); if(!x.includes('-')) x=x.replace(/[\s_]+/,'-'); return x.replace(/[\s_]+/g,''); };
const calSet=()=>{ const s=LS.get(K.cal,{}), g=groupSched(); if(!g) return s;
  const cd=Object.assign({},s.classDay); ['ikg','ng'].forEach(k=>{ if(g[k]&&g[k].day) cd[k]=g[k].day; });
  return Object.assign({},s,{classDay:cd,dates:Object.assign({},g.dates||{},s.dates||{})}); };
const events=()=>CAL.events(calSet(),week1());
const doneMap=()=>{ const m=LS.get(K.done,{}), o={}; Object.keys(m).forEach(k=>{ if(m[k]&&m[k].v) o[k]=true; }); return o; };
function setDone(key,v){ const m=LS.get(K.done,{}); m[key]={v:!!v,t:Date.now()}; LS.set(K.done,m); }
const mainUrl=h=>((ME&&ME.mainUrl)||(CFG&&CFG.mainUrl)||'https://nachert1830.ru')+'/'+(h||'');
const ext=(href,text,cls)=>`<a class="${cls||'btn sm'}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text} ${ic('ext')}</a>`;
const flag=f=>!!(ME&&ME.flags&&ME.flags[f]);
const plural=(n,a,b,c)=>{ const m10=n%10,m100=n%100; return m10===1&&m100!==11?a:m10>=2&&m10<=4&&(m100<12||m100>14)?b:c; };
const MON=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
function dparts(date){ const d=CAL.toDay(date), x=new Date(d*864e5); return {d:x.getUTCDate(),mon:MON[x.getUTCMonth()],wd:CAL.WD[CAL.weekday(d)]}; }

/* иконки — линии 24×24, цвет берут от текста */
const IC={
  today:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>',
  cal:'<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  plan:'<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="18" r="2"/>',
  train:'<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  skills:'<path d="M4 20V11M10 20V5M16 20v-7M22 20H2"/>',
  more:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  tg:'<path d="M21.5 4.5 2.8 11.6c-.9.4-.9 1.4 0 1.7l4.7 1.5 1.8 5.6c.2.7 1 .9 1.5.4l2.6-2.4 4.9 3.6c.7.5 1.6.1 1.8-.7L23 5.8c.2-1-.6-1.7-1.5-1.3Z"/><path d="m7.5 14.8 10-7"/>',
  check:'<path d="m4 12.5 5 5L20 6.5"/>',
  bell:'<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  shield:'<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  data:'<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  doc:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  fb:'<path d="M4 5h16v11H9l-5 4z"/>',
  scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
  sheet:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M13 16h8M13 16V20M3 9h6v7H3"/>',
  admin:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  book:'<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  logout:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h11"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  pulse:'<path d="M3 12h4l3-8 4 16 3-8h4"/>'
};
const ic=n=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||''}</svg>`;
/* отзыв о функции — одной кнопкой в «Ещё», не на каждой карточке */
function fbBtn(f){ return ''; }
function why(html){ return ''; }
/* карточка функции: значок, заголовок, содержимое */
function card(f,title,inner,whyHtml,o){ o=o||{};
  /* без «Отзыв» и «Почему так» на каждой карточке: отзыв — в «Ещё», методика — в README */
  return `<section class="card${o.navy?' navy':''}" data-feature="${esc(f)}"><div class="ch">${o.icon?`<span class="ico ${o.tone||''}">${ic(o.icon)}</span>`:''}<h2>${title}${o.sub?`<small>${o.sub}</small>`:''}</h2></div>${inner}</section>`; }
function pageHead(title,lead,back){ return `<div class="ph">${back?`<a class="back" href="${back[0]}">${ic('back')}${esc(back[1])}</a>`:''}<h1>${title}</h1>${lead?`<p class="lead">${lead}</p>`:''}</div>`; }
function tagOf(e){ return `<span class="tag ${e.kind}">${esc(e.short)}</span>`; }
function topicTitle(id){ if(!CORE) return id; const t=CORE.topics.find(x=>x.id===id); if(t) return t.title; const s=BKT.IKG_SKILLS.find(x=>x.id===id); return s?s.title:id; }
const taskBy=n=>CORE&&CORE.tasks.find(t=>t.n===+n);
function nextRk(subj,horizon){ const t=dayNum(); return events().filter(e=>e.kind==='rk'&&(!subj||e.subj===subj)&&CAL.toDay(e.date)>=t&&CAL.toDay(e.date)-t<=(horizon||14))[0]||null; }
function focusTopics(){ const e=nextRk('ng',21); return e&&CORE?(CORE.rkTopics[e.n]||[]):[]; }
function evRow(e,t){ const p=dparts(e.date), k=CAL.toDay(e.date)-t;
  return `<a class="evr k-${e.kind}" href="#/event/${e.id}"><span class="dt"><b>${p.d}</b><small>${p.mon}</small></span><span class="t"><b>${esc(e.short+' · '+e.subjTitle)}</b><small>${esc(e.kindFull)} · ${p.wd}, неделя ${e.week}${e.custom?' · своя дата':''}</small></span><span class="in${k<=7?' soon':''}">${esc(CAL.inWords(k))}</span></a>`; }

/* оценки навыков: наблюдения клуба + последние самооценки из очереди основного сайта (если этой попытки в клубе не было) */
function skillEvents(){ const ev=LS.get(K.ev,[]), rep=LS.get(K.rep,{}), club=new Set(ev.filter(e=>e.task).map(e=>e.task+'@'+Math.floor(e.t/864e5)));
  const fromRep=BKT.fromRep(rep,n=>{ const t=taskBy(n); return t&&t.topic; }).filter(e=>!club.has(e.task+'@'+Math.floor(e.t/864e5)));
  return BKT.merge(ev,fromRep); }
const estimate=()=>BKT.estimate(skillEvents());

/* ── вход и регистрация — одно и то же ──
   Почта: адрес → код из 6 цифр → внутри. Яндекс ID: кнопка → oauth.yandex.ru → обратно на #/ya/<одноразовый вход>/<s>
   (s сверяется с sessionStorage этой вкладки). Участник входит сразу; новому — один экран: имя и согласие (152-ФЗ требует
   отдельного согласия на обработку данных), затем аккаунт создаётся. Отдельной страницы регистрации нет. */
async function afterLogin(r){ if(r.session) TOK.set(r.session); ME=Object.assign({},ME||{},{csrf:r.csrf}); const local=SYNC.readLocal(localStorage), had=Object.keys(local.data).length;
  await loadMe(); applyVariant(true); const ok=await syncNow();
  try{ sessionStorage.removeItem('club_invite'); }catch(e){}
  if(r.isNew&&had&&ok) toast('Прогресс с этого устройства перенесён в аккаунт'); else if(r.isNew) toast('Аккаунт создан. Добро пожаловать!');
  location.hash='#/'; route(); }
async function loadMe(){ const m=await api('GET','/api/me'); ME=m; const c=Object.assign({},m); delete c.csrf; LS.device(K.me,c); return m; }
const getInvite=()=>{ try{ return sessionStorage.getItem('club_invite')||undefined; }catch(e){ return undefined; } };
const botStart=()=>{ const c=getInvite(); return c&&/^[A-Za-z0-9_-]{16,62}$/.test(c)?'i_'+c:'login'; };
/* официальный вход Telegram — только на сайте, заданном у @BotFather (/setdomain) */
const tgOfficial=()=>!!(CFG&&CFG.tgLogin&&CFG.botId&&CFG.tgLogin.origins.some(o=>{ try{ return new URL(o).hostname.replace(/^www\./,'')===location.hostname.replace(/^www\./,''); }catch(e){ return false; } }));
const OOPS={state:'Вход устарел или начат в другой вкладке. Попробуйте ещё раз.',denied:'Вы отменили вход в Яндексе.',fail:'Яндекс ID сейчас не ответил. Попробуйте ещё раз через минуту.',
  noinvite:'Этого аккаунта ещё нет в кабинете.',invite:'Ссылка-приглашение не подходит.',link:'Ссылка для привязки устарела. Нажмите «Привязать» в настройках ещё раз.',taken:'Этот Яндекс ID уже привязан к другому аккаунту.'};
function yaState(){ const a=new Uint8Array(18); crypto.getRandomValues(a); const s=btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  try{ sessionStorage.setItem('club_ya_s',s); }catch(e){} return s; }
const legal=()=>`<p class="legal">Продолжая, вы соглашаетесь с <a href="legal/terms.html" target="_blank" rel="noopener">условиями</a> и <a href="legal/privacy.html" target="_blank" rel="noopener">политикой обработки данных</a>.</p>`;
const yaBtn=()=>`<button class="btn yabtn full" type="button" data-act="yaLogin"><span class="yamark" aria-hidden="true">Я</span>Войти с Яндекс ID</button>`;
/* способы входа: почта (поле сразу на странице) и Яндекс ID; Telegram — только если включён на сервере */
function authIdle(){ const ya=CFG&&CFG.yandex, tg=CFG&&CFG.telegram&&CFG.botName, off=tgOfficial(), em=CFG&&CFG.email;
  return `${em?`<form class="af" id="mailF" novalidate><label class="f" for="emA">Электронная почта</label>
      <input id="emA" class="inp" type="email" inputmode="email" autocomplete="email" required placeholder="name@example.ru">
      <button class="btn pri full" type="submit">Получить код</button></form>`:''}
    ${em&&(ya||tg)?'<div class="or"><span>или</span></div>':''}
    ${ya?yaBtn():''}${tg?`<button class="btn ghost full" type="button" data-act="${off?'tgLogin':'botLogin'}"><span class="tgmark">${ic('tg')}</span>Войти через Telegram</button>`:''}
    <div id="authMsg" aria-live="polite"></div>`; }
/* каркас страницы входа: карточка по центру, справа (на компьютере) — что внутри */
const FEATS=[['scan','red','Проверка чертежа по фото','сфотографировали лист — узнали, где ошибка'],['clock','','Занятия и сдачи вашей группы','аудитория, время, дни ДЗ и РК'],
  ['book','green','Мой вариант','ДЗ на сайте открываются сразу на нём'],['train','amber','Тренировка дня','15 минут на задачах тетради']];
function authShell(inner,o){ o=o||{};
  render(`<div class="authp"><section class="acard">${o.back?`<button class="aback" type="button" data-act="${o.back}">${ic('back')}Назад</button>`:''}
      <div class="abrand"><i aria-hidden="true"></i><span>Начерт<small>Личный кабинет</small></span></div>
      <h1>${o.title||'Вход'}</h1>${o.sub?`<p class="asub">${o.sub}</p>`:''}${o.err?`<p class="note bad">${esc(o.err)}</p>`:''}
      <div id="auth">${inner}</div>${o.noLegal?'':legal()}</section>
    ${o.side===false?'':`<aside class="aside"><h2>Для студентов МГТУ</h2><ul>${FEATS.map(([i,t,b,p])=>`<li><span class="ico ${t}">${ic(i)}</span><span><b>${b}</b><small>${p}</small></span></li>`).join('')}</ul></aside>`}</div>`,o.title||'Вход'); }
function loginView(err){ authShell(authIdle(),{title:'Вход в кабинет',sub:'Нет аккаунта — создадим при первом входе. Пароль не нужен.',err}); }
const varSelect=(id,v)=>`<select id="${id}" class="inp"><option value="0">—</option>${[...Array(30)].map((_,i)=>`<option value="${i+1}"${v===i+1?' selected':''}>${i+1}</option>`).join('')}</select>`;
/* почта, шаг 2: код из письма */
async function mailStart(email){ const msg=$('#authMsg');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ if(msg) msg.innerHTML='<p class="note bad">Проверьте адрес почты.</p>'; return; }
  const b=$('#mailF button[type=submit]'); if(b){ b.disabled=true; b.textContent='Отправляем…'; }
  try{ const r=await api('POST','/api/auth/email/start',{email,invite:getInvite()});
    authShell(`<form class="af" id="codeF" data-email="${esc(email)}" novalidate><label class="f" for="emC">Код из письма</label>
        <input id="emC" class="inp code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">
        <button class="btn pri full" type="submit">Войти</button></form>
        <p class="hint">Не пришло? Проверьте «Спам» или <button class="lnk" type="button" data-act="mailResend">отправьте код ещё раз</button>.</p><div id="authMsg" aria-live="polite"></div>`,
      {title:'Проверьте почту',sub:`Мы отправили код из 6 цифр на <b>${esc(r.to)}</b>. Он действует ${r.minutes} минут.`,back:'loginCancel',noLegal:true});
    $('#emC').focus(); }
  catch(x){ if(b){ b.disabled=false; b.textContent='Получить код'; } if(msg) msg.innerHTML=`<p class="note bad">${esc(x.message)}</p>`; } }
document.addEventListener('submit',async e=>{ const f=e.target;
  if(f.id==='mailF'){ e.preventDefault(); return mailStart($('#emA').value.trim()); }
  if(f.id==='codeF'){ e.preventDefault(); const code=$('#emC').value.replace(/\D/g,''), msg=$('#authMsg');
    if(code.length!==6){ msg.innerHTML='<p class="note bad">Код — 6 цифр из письма.</p>'; return; }
    const b=$('#codeF button[type=submit]'); b.disabled=true;
    try{ const v=await api('POST','/api/auth/email/verify',{email:f.dataset.email,code}); return landingView(v.token); }
    catch(x){ b.disabled=false; msg.innerHTML=`<p class="note bad">${esc(x.message)}</p>`; } }
  if(f.id==='profF'){ e.preventDefault(); return saveProfile(); }
  if(f.id==='grpF'){ e.preventDefault(); const g=normGroup($('#grpI').value); if(!okGroup(g)){ toast('Группа — как в расписании, например ИУ5-12/6'); return; }
    try{ const r=await api('POST','/api/me/profile',{group:g}); ME.user=r.user; LS.device(K.me,Object.assign({},ME,{csrf:undefined})); todayView(); toast('Группа сохранена'); }catch(x){ toast(x.message); } return; }
  /* привязка почты в настройках: адрес → код из письма */
  if(f.id==='lmF'){ e.preventDefault(); const email=$('#lmA').value.trim();
    try{ const r=await api('POST','/api/me/link',{to:'email',email}); $('#linkOut').innerHTML=`<form class="af reg" id="lcF" data-email="${esc(email)}" novalidate><label class="f" for="lcC">Код из письма на ${esc(r.to)}</label><input id="lcC" class="inp code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"><button class="btn pri" type="submit">Привязать</button></form><div id="lmMsg" aria-live="polite"></div>`; $('#lcC').focus(); }
    catch(x){ $('#lmMsg').innerHTML=`<p class="note bad">${esc(x.message)}</p>`; } return; }
  if(f.id==='lcF'){ e.preventDefault();
    try{ const r=await api('POST','/api/me/link/email',{email:f.dataset.email,code:$('#lcC').value}); ME.user=r.user; settingsView(); toast('Почта привязана'); }
    catch(x){ $('#lmMsg').innerHTML=`<p class="note bad">${esc(x.message)}</p>`; } return; }
  if(f.id==='onbF'){ e.preventDefault(); const msg=$('#authMsg'), terms=$('#cTerms').checked, pd=$('#cPd').checked, grp=normGroup($('#onG').value);
    if(!okGroup(grp)){ msg.innerHTML='<p class="note bad">Укажите группу как в расписании, например ИУ5-12/6 — по ней считаются занятия и даты.</p>'; $('#onG').focus(); return; }
    if(!terms||!pd){ msg.innerHTML='<p class="note bad">Отметьте обе галочки — без них аккаунт создать нельзя.</p>'; return; }
    const b=$('#onbF button[type=submit]'); b.disabled=true;
    try{ const r=await api('POST','/api/auth/bot/redeem',{token:LANDING,confirm:true,name:$('#onN').value.trim(),group:grp,variant:+$('#onV').value||undefined,consent:{terms,pd,photos:false}}); LANDING=null; await afterLogin(r); }
    catch(x){ b.disabled=false; msg.innerHTML=`<p class="note bad">${esc(x.message)}</p>`; } } });
function botSteps(){ const bot=CFG.botName||'', link='https://t.me/'+bot+'?start='+botStart();
  return `<div class="wait"><ol><li class="on"><span>Откройте бота <b>@${esc(bot)}</b> в Telegram</span></li><li><span>Нажмите «Старт»</span></li><li><span>Бот пришлёт кнопку <b>«Войти в кабинет»</b> — нажмите её</span></li></ol>
    <a class="btn pri full" href="${esc(link)}" target="_blank" rel="noopener noreferrer" id="openBot">Открыть бота</a><button class="btn ghost full" type="button" data-act="loginCancel">Назад</button>
    ${CFG.devBot?`<div class="devbox"><b>Эмуляция бота</b> (только локально): нажать «Старт» за участника.<div class="grid2 reg"><input id="dvId" type="text" inputmode="numeric" value="1000002" aria-label="Telegram id"><input id="dvName" type="text" value="Тестировщик" aria-label="Имя"></div><div class="row reg"><button class="btn sm" type="button" data-act="devBot">В боте: «Старт»</button></div><small>1000001 — владелец.</small></div>`:''}
    </div><div id="authMsg" aria-live="polite"></div>`; }
/* одноразовый вход (почта, Яндекс ID, бот): участник — сразу внутрь; новый — имя и согласие */
let LANDING=null;
async function landingView(tok){ LANDING=tok; authShell('<p class="mut">Входим…</p>',{title:'Вход',noLegal:true,side:false});
  let r; try{ r=await api('POST','/api/auth/bot/redeem',{token:tok}); }
  catch(e){ LANDING=null; return loginView(e.message); }
  if(r.member){ try{ const x=await api('POST','/api/auth/bot/redeem',{token:tok,confirm:true}); LANDING=null; return afterLogin(x); }catch(e){ LANDING=null; return loginView(e.message); } }
  const name=r.method==='email'?'':r.name;
  authShell(`<form class="af" id="onbF" novalidate><label class="f" for="onN">Как вас зовут</label>
      <input id="onN" class="inp" type="text" maxlength="60" autocomplete="given-name" placeholder="Имя" value="${esc(name&&name!=='Участник'?name:'')}">
      <div class="grid2 gv"><div><label class="f" for="onG">Группа</label><input id="onG" class="inp" type="text" maxlength="16" autocomplete="off" autocapitalize="characters" placeholder="ИУ5-12/6" list="grpList">${grpList()}</div>
      <div><label class="f" for="onV">Вариант</label>${varSelect('onV',0)}</div></div>
      <label class="chk"><input type="checkbox" id="cTerms"><span>Принимаю <a href="legal/terms.html" target="_blank" rel="noopener">пользовательское соглашение</a> и <a href="legal/privacy.html" target="_blank" rel="noopener">политику обработки данных</a></span></label>
      <label class="chk"><input type="checkbox" id="cPd"><span>Даю <a href="legal/consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a><small>${r.method==='email'?'Храним только хеш почты, без самого адреса':'Храним только id и имя'} — и ваш прогресс. Данные в России.</small></span></label>
      <button class="btn pri full" type="submit">Создать аккаунт</button></form><div id="authMsg" aria-live="polite"></div>`,
    {title:'Добро пожаловать!',sub:r.label?'Аккаунт для '+esc(r.label)+' ещё не создан — осталось одно действие.':'Осталось одно действие — и вы в кабинете.',back:'notMe',noLegal:true,side:false}); }
async function inviteView(err){ return loginView(err); }
const grpList=()=>`<datalist id="grpList">${Object.keys(GROUPS.groups||{}).sort().map(g=>`<option value="${esc(g)}">`).join('')}</datalist>`;

/* темы к событию — по таблице сдач: начерт — темы модуля (РК n), ИКГ — требования к листу по ГОСТ */
function eventTopics(e){ if(!CORE) return []; if(e.subj==='ng') return (CORE.rkTopics[e.n]||[]).map(id=>({id,t:topicTitle(id)}));
  return (BKT.IKG_SKILLS||[]).map(x=>({id:x.id,t:x.title})); }
/* ── вариант: один номер на все ДЗ (1–30). Сайт показывает «★ Мой вариант» по тем же ключам localStorage ── */
const myVariant=()=>(ME&&ME.user&&ME.user.variant)||0;
function applyVariant(force){ const v=myVariant(); if(!(v>=1&&v<=30)) return;
  try{ ['nch2_igvar','nch2_hwvar_2','nch2_hwvar_3'].forEach(k=>{ if(force||!localStorage.getItem(k)) localStorage.setItem(k,String(v)); }); }catch(e){} }
/* куда на сайте ведёт событие: ДЗ — сразу мой вариант в разделе ДЗ своего предмета (#/ng/dz/<ДЗ>/<вариант>, #/ig/dz/…) */
function siteLink(e){ const v=myVariant();
  if(e.kind==='dz'&&e.subj==='ikg'&&e.n===2) return {href:mainUrl('#/ig/hw2'+(v?'/'+v:'')),t:v?'Мой вариант '+v:'Варианты ДЗ 2'};
  if(e.kind==='dz'&&e.subj==='ikg') return {href:mainUrl('#/ig/dz/'+e.n+(v?'/'+v:'')),t:v?'Мой вариант '+v:'Задание №'+e.n};
  if(e.kind==='dz'&&e.subj==='ng') return {href:mainUrl('#/ng/dz/'+e.n+(v?'/'+v:'')),t:v?'Мой вариант '+v:'Разбор ДЗ '+e.n};
  return e.subj==='ng'?{href:mainUrl('#/ng/path'),t:'Теория на сайте'}:{href:mainUrl('#/ig/learn'),t:'Уроки на сайте'}; }
const firstName=n=>String(n||'').trim();
const initials=n=>esc(String(n||'?').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?');
const whenWord=(k,date)=>k===0?'Сегодня':k===1?'Завтра':esc(CAL.human(date));
/* ── главная: только то, что нужно сегодня — занятие, ближайшая сдача, план на сегодня, тренировка ── */
function lessonNow(nl){ const l=nl.l;
  return `<section class="lesson ${l.subj}"><div><span class="k">${whenWord(nl.inDays,nl.date)} · ${esc(l.t.replace(/^0/,''))}</span><b>${l.subj==='ng'?'Начертательная геометрия':'Инженерная графика'}</b>
    <small>ауд. ${esc(l.rooms.join(', '))}${(l.who||[]).length?' · '+esc(l.who.join(', ')):''}</small></div><span class="ico">${ic('clock')}</span></section>`; }
const groupAsk=()=>`<section class="card ask"><h2>Ваша группа</h2><p class="mut">По ней — занятия, аудитории и точные даты сдач.</p>
  <form class="af" id="grpF" novalidate><div class="row"><input id="grpI" class="inp grow" type="text" maxlength="16" autocapitalize="characters" list="grpList" placeholder="Например, ИУ5-12/6">${grpList()}<button class="btn pri" type="submit">Готово</button></div></form></section>`;
const groupPick=()=>`<section class="card ask"><h2>Уточните группу</h2><p class="mut">«/4», «/5», «/6» — срок обучения, это разные группы.</p><div class="row">${groupAlts(myGroup()).map(k=>`<button class="btn sm" type="button" data-act="pickGroup" data-g="${esc(k)}">${esc(k)}</button>`).join('')}</div></section>`;
/* «Сегодня» — главный экран кабинета. Одна главная карточка: ближайшая сдача с отсчётом дней (красная цифра — единственный
   красный на экране) и кнопкой «Готовиться». Ниже — шаги плана на сегодня, ближайшее занятие, мои ДЗ сразу на моём варианте
   и что дальше. Тренажёров здесь нет: в кабинет приходят готовиться к конкретной сдаче. */
function heroCard(e,td){ const k=CAL.toDay(e.date)-td, tp=eventTopics(e), L=siteLink(e);
  return `<section class="card dl hero8 k-${e.kind}" data-feature="calendar"><div class="dlh"><div><span class="tag ${e.kind}">${esc(e.short)}</span><b>${esc(e.subjTitle)}</b><small>${esc(e.kindFull)} · ${esc(CAL.human(e.date))}</small></div>
      <div class="cnt"><b>${k===0?'!':k}</b><small>${k===0?'сегодня':plural(k,'день','дня','дней')}</small></div></div>
    ${tp.length?`<p class="h8k">${e.kind==='rk'?'Что будет на РК':'Что проверят'}</p><div class="tchips">${tp.slice(0,4).map(x=>`<span class="tchip">${esc(x.t)}</span>`).join('')}${tp.length>4?`<a class="tchip more" href="#/event/${e.id}">ещё ${tp.length-4}</a>`:''}</div>`:''}
    <div class="row"><a class="btn pri" href="#/event/${e.id}">Готовиться по плану ${ic('arrow')}</a><a class="btn" href="${esc(L.href)}" target="_blank" rel="noopener noreferrer">${esc(L.t)} ${ic('ext')}</a></div></section>`; }
/* мои ДЗ: ближайшие сдачи ДЗ — ссылка сразу на мой вариант и проверка листа по фото */
function myHwCard(evs,td){ const hw=evs.filter(e=>e.kind==='dz').slice(0,3); if(!hw.length) return '';
  const chk=e=>e.subj==='ikg'?(flag('normo')?'#/check/normo':''):(flag('scanner')&&(e.n===2||e.n===3)?'#/check/dz':'');
  return `<section class="card myhw"><div class="sh"><h2>Мои ДЗ</h2><small>${myVariant()?'вариант '+myVariant():'<a href="#/me" data-act="editProfile">указать вариант</a>'}</small></div>
    <ul class="hwl">${hw.map(e=>{ const L=siteLink(e), k=CAL.toDay(e.date)-td, c=chk(e);
      return `<li><span class="hwt"><b>${esc(e.short+' · '+e.subjTitle)}</b><small>${esc(CAL.human(e.date))} · ${esc(CAL.inWords(k))}</small></span>
        <span class="hwa"><a class="btn sm" href="${esc(L.href)}" target="_blank" rel="noopener noreferrer">${esc(L.t)} ${ic('ext')}</a>${c?`<a class="btn sm ghost" href="${c}">${ic('scan')}Проверить</a>`:''}</span></li>`; }).join('')}</ul></section>`; }
function homeView(){ const t=today(), td=dayNum(), evs=CAL.upcoming(calSet(),week1(),t,8), next=evs.find(e=>e.kind!=='m')||evs[0], nl=nextLesson(), u=ME.user, v=myVariant(), done=doneMap();
  const amb=myGroup()&&!groupKey()&&groupAlts(myGroup()).length>1;
  const all=PL.todaySteps(events(),t,done,21), seen=new Set(), steps=all.filter(s=>{ if(s.event) return false; if(seen.has(s.ev.id)) return false; seen.add(s.ev.id); return true; }).slice(0,3);
  const rest=evs.filter(e=>e!==next&&e.kind!=='dz').slice(0,3);
  render(`<a class="hello" href="#/me"><span class="av">${initials(u.name)}</span><span><b>Привет, ${esc(firstName(u.name))}</b><small>${[groupKey()||myGroup(),v?'вариант '+v:''].filter(Boolean).map(esc).join(' · ')||'заполните профиль'}</small></span>${ic('arrow')}</a>
  ${!myGroup()?groupAsk():amb?groupPick():''}
  ${myGroup()&&!v?`<a class="nudge" href="#/me" data-act="editProfile">${ic('plus')}<span>Укажите вариант — ссылки на ДЗ откроются сразу на нём</span></a>`:''}
  ${next?heroCard(next,td):`<section class="card"><h2>Сдач впереди нет</h2><p class="mut">Семестр закончился или ещё не начался.</p></section>`}
  ${flag('plan')&&steps.length?card('plan','По плану сегодня',`<ul class="today">${steps.map(s=>`<li class="${s.done?'done':''}"><a href="#/event/${s.ev.id}"><span class="dot">${s.done?ic('check'):''}</span><span><b>${esc(s.ev.short+' '+s.ev.subjTitle)} · ${esc(s.title)}</b><small>${s.min?'≈ '+s.min+' мин':''}</small></span>${ic('arrow')}</a></li>`).join('')}</ul>`):''}
  ${nl?lessonNow(nl):''}
  ${myHwCard(evs,td)}
  ${rest.length?`<section class="card"><div class="sh"><h2>Дальше</h2><a href="#/calendar">Все сдачи</a></div><div class="evl">${rest.map(e=>evRow(e,td)).join('')}</div></section>`:''}`,'Сегодня'); }
const todayView=homeView;

/* ── календарь ── */
function calendarView(){ const s=CAL.normSettings(calSet()), t=dayNum(), wkNow=CAL.weekOf(week1(),today());
  const wd=[1,2,3,4,5,6].map(d=>[d,['','понедельник','вторник','среда','четверг','пятница','суббота'][d]]);
  const ws=CAL.weeks(calSet(),week1(),17).map(w=>`<div class="wk${w.week===wkNow?' now':''}"><div class="n">${w.week}<small>${dparts(w.start).d} ${dparts(w.start).mon}</small></div>
    <div class="es">${w.events.map(e=>`<a class="chip${CAL.toDay(e.date)<t?' past':''}" href="#/event/${e.id}">${tagOf(e)}${esc(e.subjTitle)}${e.custom?' · '+esc(CAL.human(e.date)):''}</a>`).join('')||'<small>—</small>'}</div></div>`).join('');
  render(`${pageHead('Сдачи семестра',groupSched()?'По расписанию группы '+esc(groupKey())+'. Неделя — неделя крайнего срока.':'Неделя — неделя крайнего срока; день — по вашим занятиям.')}
    ${groupSched()?'':card('calendar','Дни занятий',`${myGroup()?`<p class="mut">Группы ${esc(myGroup())} нет в расписании кафедры — укажите дни сами.</p>`:''}<div class="grid2">${['ikg','ng'].map(k=>`<div><label class="f" for="cd-${k}">${k==='ikg'?'ИКГ':'Начерт'}</label><select id="cd-${k}" data-chg="classDay" data-s="${k}">${wd.map(([d,n])=>`<option value="${d}"${s.classDay[k]===d?' selected':''}>${n}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="grid2 reg">${['ikg','ng'].map(k=>`<label class="chk"><input type="checkbox" data-chg="subj" data-s="${k}"${s.subjects.includes(k)?' checked':''}><span>${k==='ikg'?'ИКГ':'Начерт'}</span></label>`).join('')}</div>`)}
    <section class="card"><div class="weeks">${ws}</div></section>`,'Сдачи'); }

/* ── событие и обратный план ── */
function stepLi(s,i){ const range=s.from&&s.to&&s.from!==s.to?esc(CAL.human(s.from))+' – '+esc(CAL.human(s.to)):esc(CAL.human(s.date));
  const cls=[s.when==='today'?'today':'',s.done?'done':'',s.event?'ev-day':'',s.buffer?'buf':''].join(' ');
  const dot=s.event?'◆':s.buffer?'·':(s.days&&!s.key)?`<span class="nn">${i+1}</span>`:`${s.done?ic('check'):`<span class="nn">${i+1}</span>`}<input type="checkbox" data-chg="step" data-k="${esc(s.key)}"${s.done?' checked':''} aria-label="Отметить сделанным: ${esc(s.title)}" title="Отметить сделанным">`;
  return `<li class="${cls}"><span class="dot">${dot}</span><div class="st"><b>${esc(s.title)}</b><small>${range}${s.min?' · ≈ '+s.min+' мин'+(s.days?' в день':''):''}${s.squeezed?' · сжато':''}${s.when==='today'?' · сегодня':''}</small><div class="what">${esc(s.what)}</div>${stepAction(s)}</div></li>`; }
/* ежедневные шаги «вперемешку» — одной строкой с диапазоном дат; отметка — за сегодняшний день */
function groupMix(steps){ const out=[]; let g=null;
  steps.forEach(s=>{ if(s.group!=='mix'){ g=null; out.push(s); return; }
    if(!g){ g=Object.assign({},s,{from:s.date,to:s.date,days:[s]}); out.push(g); } else { g.to=s.date; g.days.push(s); }
    if(s.when==='today'){ g.key=s.key; g.done=s.done; g.when='today'; } });
  out.forEach(x=>{ if(x.days){ if(x.when!=='today'){ x.key=null; x.done=x.days.every(d=>d.done); } x.title=x.title+(x.days.length>1?' · каждый день':''); } });
  return out; }
function stepAction(s){ const e=s.evObj; if(!e) return '';
  if(s.k==='diag') return `<a class="btn sm${s.when==='today'?' cta':''}" href="#/event/${e.id}/diag">${s.done?'Результаты':'Начать диагностику'}</a>`;
  if(s.group==='mix'&&s.when==='today') return `<a class="btn sm cta" href="#/event/${e.id}/mix">Задачи на сегодня</a>`;
  if(s.k==='mock') return `<a class="btn sm" href="#/event/${e.id}/mock">Пробный РК</a>`;
  if(s.k==='light') return ext(mainUrl(e.subj==='ng'?'#/ng/cheat':'#/ig/theory'),'Шпаргалка на сайте');
  if(e.kind==='dz'&&s.k==='check'&&e.subj==='ikg'&&flag('normo')) return `<a class="btn sm" href="#/check/normo">Предпроверка листа</a>`;
  if(e.kind==='dz'&&s.k==='read') return ext(mainUrl(e.subj==='ng'?'#/ng/dz':'#/ig/dz'),'Разборы ДЗ на сайте');
  return ''; }
function eventView(id,sub){ const e=events().find(x=>x.id===id); if(!e){ render('<p class="note bad">Нет такого события.</p>'); return; }
  if(sub==='diag') return diagView(e); if(sub==='mix') return mixView(e); if(sub==='mock') return mockView(e);
  const p=PL.plan(e,today(),doneMap()); p.steps.forEach(s=>{ s.evObj=e; });
  const ii=LS.get(K.ii,{})[e.id]||{}, t=dayNum(), k=CAL.toDay(e.date)-t, dp=dparts(e.date);
  render(`${pageHead(esc(e.title),'',['#/calendar','Сдачи'])}
  <section class="hero"><div class="hero-row"><div><span class="pill${e.kind==='rk'?' red':''}">${esc(e.kindFull)} · неделя ${e.week}</span><h1>${dp.wd}, ${dp.d} ${dp.mon}</h1><p>Неделя ${e.week}: ${esc(CAL.human(e.start))} – ${esc(CAL.human(e.end))}. ${e.kind==='rk'?'РК пишется один раз и только на этой неделе.':'Крайний срок — на этой неделе.'}</p></div>
    <div class="count"><b>${k<0?'—':k}</b><span>${k<0?'событие прошло':plural(k,'день','дня','дней')+' осталось'}</span></div></div>
    <div class="row reg">${(L=>`<a class="btn sm onhero" href="${esc(L.href)}" target="_blank" rel="noopener noreferrer">${esc(L.t)} ${ic('ext')}</a>`)(siteLink(e))}</div></section>
  <div class="grid"><div class="col">
    ${flag('plan')?card('plan','Обратный план',p.over?'<p class="mut">Событие прошло.</p>':`${p.late?'<p class="note warn">План сокращён: времени меньше, чем нужно по полной схеме. Ничего не выброшено — шаги сдвинуты на ближайшие дни.</p>':''}<p class="mut">Нажмите на кружок шага, чтобы отметить его сделанным.</p><ol class="steps">${groupMix(p.steps).map(stepLi).join('')}</ol>`,
      e.kind==='rk'?'диагностика показывает, что тренировать (проверка себя, Roediger, Karpicke, 2006); задачи вперемешку учат выбирать способ (Rohrer, Taylor, 2007); пробный РК на время переносит навык в формат экзамена; накануне — без новых тем, сон закрепляет выученное.'
      :e.kind==='dz'?'большое задание, разбитое на этапы с датами, реже откладывается; запас перед сроком — защита от ошибки планирования (Buehler, Griffin, Ross, 1994).':'сверка за неделю оставляет время исправить замечания до закрытия модуля.',{icon:'plan',tone:e.kind==='rk'?'red':e.kind==='m'?'green':''}):''}
  </div><div class="col">
    <section class="card"><div class="ch"><span class="ico">${ic('cal')}</span><h2>${e.kind==='rk'?'День РК в моей группе':e.kind==='dz'?'День сдачи в моей группе':'День закрытия модуля'}</h2></div>
      <div class="row"><input id="evd" class="grow" type="date" min="${e.start}" max="${e.end}" value="${e.date}" data-chg="evDate" data-id="${e.id}" aria-label="Дата события">${e.custom?`<button class="btn sm" type="button" data-act="evDateReset" data-id="${e.id}">По дню занятия</button>`:''}</div>
      <p class="mut">Можно выбрать только день внутри недели ${e.week}.</p></section>
    ${flag('plan')?`<details class="card fold"${ii.what?' open':''}><summary><span class="ico red">${ic('target')}</span><b>Когда и где буду готовиться</b></summary><p class="mut">Одно конкретное намерение: «Если <i>когда</i>, <i>где</i>, то я <i>что</i>». Напоминание в Telegram покажет его.</p>
      <form id="iiForm" data-id="${e.id}"><label class="f" for="iiW">Когда</label><input id="iiW" type="text" maxlength="60" placeholder="в четверг после пар, 17:30" value="${esc(ii.when||'')}">
      <label class="f" for="iiP">Где</label><input id="iiP" type="text" maxlength="60" placeholder="в читальном зале, 3-й этаж" value="${esc(ii.where||'')}">
      <label class="f" for="iiT">Что именно</label><input id="iiT" type="text" maxlength="120" placeholder="${e.kind==='rk'?'решаю задачи 52 и 57 без подсказок':'делаю черновик видов спереди и сверху'}" value="${esc(ii.what||'')}">
      <div class="row reg"><button class="btn pri" type="submit">Сохранить</button>${ii.what?'<button class="btn ghost" type="button" data-act="iiClear" data-id="'+e.id+'">Очистить</button>':''}</div></form>
      ${ii.what?`<div class="ii"><span class="lbl">Ваше намерение</span><q>Если ${esc(ii.when||'…')}${ii.where?', '+esc(ii.where):''}, то я ${esc(ii.what)}.</q></div>`:''}</details>`:''}
  </div></div>`,e.title);
  const f=$('#iiForm'); if(f) f.addEventListener('submit',ev=>{ ev.preventDefault(); const m=LS.get(K.ii,{}); m[e.id]={when:$('#iiW').value.trim(),where:$('#iiP').value.trim(),what:$('#iiT').value.trim(),t:Date.now()};
    if(!m[e.id].what){ toast('Напишите, что именно будете делать'); return; } LS.set(K.ii,m); track('plan',{e:e.id}); toast('План сохранён'); eventView(e.id); }); }

/* диагностика к РК: по одной задаче на тему (начерт) или самооценка навыков листа (ИКГ) */
function diagItems(e){ const st=LS.get(K.diag,{}); if(st[e.id]&&st[e.id].items) return st[e.id];
  let items=[];
  if(e.subj==='ng'){ const est=estimate(), rep=LS.get(K.rep,{}), tops=(CORE.rkTopics[e.n]||[]).slice();
    tops.sort((a,b)=>BKT.mastery(est,a)-BKT.mastery(est,b)||a.localeCompare(b));
    items=tops.slice(0,6).map(tp=>{ const ts=CORE.tasks.filter(t=>t.topic===tp); return (ts.find(t=>!rep[t.n])||ts[0]).n; }); }
  else items=BKT.IKG_SKILLS.filter(s=>s.id!=='ikg-model').map(s=>s.id);
  st[e.id]={items,res:{},at:Date.now()}; LS.set(K.diag,st); return st[e.id]; }
function diagView(e){ const d=diagItems(e), n=Object.keys(d.res).length, all=d.items.length;
  const body=e.subj==='ng'?d.items.map(x=>taskCard(+x,'diag:'+e.id,d.res[x],'диагностика')).join('')
    :card('','Как уверенно вы делаете это на листе?',`<p class="mut">Честно, без оценки. Лучше — после одного задания тренажёра «Нормоконтроль» на сайте.</p><div class="row">${ext(mainUrl('#/ig/nk'),'Нормоконтроль')}${ext(mainUrl('#/ig/learn'),'Уроки ИГ')}</div>
      <ul class="list reg">${d.items.map(s=>`<li><b>${esc(topicTitle(s))}</b><div class="seg reg" role="group">${[['2','уверенно'],['1','сомневаюсь'],['0','не умею']].map(([v,l])=>`<button type="button" data-act="ikgSelf" data-ev="${e.id}" data-s="${s}" data-v="${v}" class="${d.res[s]===+v?'on':''}">${l}</button>`).join('')}</div></li>`).join('')}</ul>`,'',{icon:'sheet'});
  render(`${pageHead('Диагностика · '+esc(e.short+' '+e.subjTitle),e.subj==='ng'?'По одной задаче на тему РК. Решайте на бумаге без подсказок и отметьте результат честно — от этого зависит, что попадёт в тренировку.':'',['#/event/'+e.id,'План '+e.short+' · '+e.subjTitle])}
    <section class="card"><div class="row"><b class="grow">Готово: ${n} из ${all}</b>${n===all?'<span class="st-badge ok">пройдено</span>':''}</div><div class="bar"><i data-w="${all?n/all*100:0}"></i></div></section>
    <div class="reg">${body}</div>${n===all?`<p class="note ok reg">Диагностика пройдена. Слабые темы пойдут в план: <a href="#/event/${e.id}/mix">слабые темы вперемешку</a>.</p>`:''}`,'Диагностика'); }
function mixView(e){ let items=[];
  if(e.subj==='ng'){ const rec=BKT.recommend(estimate(),CORE.tasks,LS.get(K.rep,{}),CORE.rkTopics[e.n]||[],3); items=rec.map(r=>r.tasks[0]).filter(Boolean); }
  render(`${pageHead('Слабые темы вперемешку',e.subj==='ng'?'Три задачи из самых слабых тем РК, разных типов подряд. Сначала определите способ, потом решайте.':'Тренажёр «Нормоконтроль» на сайте и предпроверка своего листа — по слабым группам правил.',['#/event/'+e.id,'План '+e.short+' · '+e.subjTitle])}
    <div>${e.subj==='ng'?items.map(n=>taskCard(n,'mix:'+e.id,null,'вперемешку')).join('')||'<p class="empty">Все темы РК освоены — пройдите пробный РК на время.</p>':`<div class="row">${ext(mainUrl('#/ig/nk'),'Нормоконтроль','btn')}${flag('normo')?'<a class="btn pri" href="#/check/normo">Предпроверка листа</a>':''}</div>`}</div>
    ${why('когда тип задачи заранее неизвестен, мозг учится главному для РК — выбирать способ (Rohrer, Dedrick, Stershic, 2015).')}`,'Вперемешку'); }
function mockView(e){ const m=LS.get(K.mock,{})[e.id]||{}, href=e.subj==='ng'?(e.n===2?'#/ng/rk2/mock':e.n===1?'#/ng/check':'#/ng/check/tickets'):'#/ig/nk';
  const left=m.start&&!m.end?Math.max(0,m.start+(m.min||90)*60e3-Date.now()):0;
  render(`${pageHead('Пробный РК на время','Билет целиком, без подсказок и разборов, с таймером. Потом — сверка с разбором на сайте.',['#/event/'+e.id,'План '+e.short+' · '+e.subjTitle])}
    ${card('plan','Таймер',`<div class="row">${ext(mainUrl(href),e.subj==='ng'?'Билет на сайте':'Тренажёр на сайте','btn')}</div>
      <div class="big" id="mockT">${m.end?'Готово':m.start?fmtLeft(left):'90:00'}</div>
      <div class="row">${!m.start||m.end?`<button class="btn cta lg" type="button" data-act="mockStart" data-id="${e.id}">${m.end?'Ещё раз':'Начать'} — 90 минут</button>`:`<button class="btn pri lg" type="button" data-act="mockEnd" data-id="${e.id}">Закончил</button>`}</div>`,
      'пробный экзамен в тех же условиях — время, без подсказок — лучше всего показывает готовность и снижает тревогу на настоящем.',{icon:'clock',tone:'red'})}`,'Пробный РК');
  if(m.start&&!m.end){ const tick=()=>{ const el=$('#mockT'); if(!el) return; el.textContent=fmtLeft(Math.max(0,m.start+(m.min||90)*60e3-Date.now())); setTimeout(tick,1000); }; tick(); } }
const fmtLeft=ms=>{ const s=Math.round(ms/1000); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };

/* ── задача тетради с самооценкой ── */
function taskCard(n,ctx,res,extra){ const t=taskBy(n); if(!t) return '';
  const rep=LS.get(K.rep,{})[n], done=res!=null;
  return `<article class="task${done?' done':''}" data-n="${n}" data-ctx="${esc(ctx)}">
    <header><span class="num">№${n}</span><span class="tp">${esc(topicTitle(t.topic))}</span>${extra?`<span class="kind${extra==='вперемешку'?' mix':''}">${esc(extra)}${rep&&rep.n?' · ступень '+(rep.b+1):''}</span>`:''}</header>
    <div class="q">${t.q}</div>
    <div class="acts">${ext(mainUrl('#/ng/tasks/'+n+'/try'),'Решаю сам — на сайте','btn sm pri')}<button class="btn sm ghost" type="button" data-act="qmore">Условие целиком</button></div>
    ${done?`<p class="note ${res===2?'ok':res===1?'warn':''} reg">${['Не смог — задача вернётся завтра.','С подсказкой — вернётся через пару дней.','Решил сам — интервал растёт.'][res]}</p>`
    :`<div class="rate" role="group" aria-label="Как получилось?"><button class="btn r2" type="button" data-act="rate" data-v="2">Решил сам</button><button class="btn r1" type="button" data-act="rate" data-v="1">С подсказкой</button><button class="btn r0" type="button" data-act="rate" data-v="0">Не смог</button></div>`}
  </article>`; }
function errorPicker(el,v){ const t=taskBy(el.dataset.n), sym=(CORE.symptoms||[]).filter(s=>s.topic===t.topic);
  const box=document.createElement('div'); box.className='errs'; box.innerHTML='<p class="mut">Где споткнулись? Можно несколько — или сразу «Сохранить».</p>'+
    BKT.ERRORS.map(e=>`<button type="button" data-e="${e.id}">${esc(e.t)}</button>`).join('')+sym.map(s=>`<button type="button" data-sym="${esc(s.id)}">${esc(s.text)}</button>`).join('')+
    `<div class="row"><button class="btn sm pri" type="button" data-act="rateSave" data-v="${v}">Сохранить</button></div>`;
  const old=$('.errs',el); if(old) old.remove(); el.appendChild(box);
  box.addEventListener('click',e=>{ const b=e.target.closest('[data-e],[data-sym]'); if(b) b.classList.toggle('on'); }); }
function saveRating(el,v,errors,symptoms){ const n=+el.dataset.n, ctx=el.dataset.ctx, t=taskBy(n), d=dayNum(), now=Date.now();
  let rep=LS.get(K.rep,{}); rep=SRS.rate(rep,n,v,d); LS.set(K.rep,rep); track('task',{n,v,ctx:ctx.split(':')[0].slice(0,8)});
  const evs=BKT.fromRating({id:'c'+now.toString(36)+n,t:now,task:n,topic:t.topic,rating:v,errors,symptoms:(CORE.symptoms||[]).filter(s=>symptoms.includes(s.id)),src:ctx.split(':')[0]});
  LS.set(K.ev,BKT.merge(LS.get(K.ev,[]),evs));
  if(ctx.startsWith('diag:')){ const id=ctx.slice(5), st=LS.get(K.diag,{}); if(st[id]){ st[id].res[n]=v; LS.set(K.diag,st); if(Object.keys(st[id].res).length>=st[id].items.length) setDone(id+':diag',true); }
    const e=events().find(x=>x.id===id); if(e) diagView(e); }
  else if(ctx.startsWith('mix:')){ toast('Сохранено'); const id=ctx.slice(4); const e=events().find(x=>x.id===id); if(e) mixView(e); }
  else toast('Сохранено'); }

/* ── проверка: фото и нормоконтроль ── */
/* ── проверка чертежа — главный раздел ──
   Сканер (ветка лаборатории: lab/scan.html — задачи № 46, № 47; lab/dz.html — лист ДЗ №2–3) лежит рядом с клубом на сайте
   (/lab/) и открывается внутри кабинета. Фото обрабатывается на устройстве и никуда не отправляется. Правило сканера:
   ложный вердикт хуже отказа — «не уверен» он говорит прямо. */
/* Проверка: сначала «что у вас в руках» — крупные карточки простыми словами, потом три правила съёмки, потом сканер.
   Названия — по тому, что проверяет студент (ДЗ, задача тетради, лист из САПР), а не по устройству сканера. */
const LAB=[
  {id:'dz',src:'lab/dz.html',icon:'sheet',var:true,t:'ДЗ по начерту — фото листа',s:'ДЗ № 2 и № 3 · с ИИ-зрением — без рамки и штампа, все чертежи листа сразу',p:'Сфотографируйте лист или один чертёж крупно. С ИИ-зрением рамка, штамп и края листа не нужны: модель найдёт подписи точек и все чертежи листа, а сканер по линиям сверит построение с условием вашего варианта.'},
  {id:'cam',src:'lab/cam.html',icon:'scan',var:true,t:'ДЗ № 3 — камерой',s:'наведите камеру на лист — снимки она сделает сама',p:'Камера снимет 2–5 кадров с разных углов. Вывод — только если его подтверждают несколько снимков; разбор — прямо на фото.'},
  {id:'task',src:'lab/scan.html',icon:'doc',t:'Задача тетради № 46 или № 47',s:'фото решения — верно или где ошибка',p:'Вердикт с отметками прямо на фото и 3D-модель решения. Нет листа под рукой — попробуйте на примере.'}];
const labBase=()=>/\/lk\/(index\.html)?$/.test(location.pathname)?location.pathname.replace(/lk\/(index\.html)?$/,''):null;
/* вариант из профиля — сканеру сразу (?n=…): студенту не нужно вводить номер; нет варианта — сканер узнаёт его по чертежу */
const labSrc=L=>L.src+(L.var&&myVariant()?'?n='+myVariant():'');
/* ИИ-зрение сканера: страница сканера в рамке (тот же сайт) просит прочитать фото моделью — кабинет ходит в /api/eyes
   с токеном участника и отдаёт ответ обратно. Только своей рамке и только с этого сайта */
window.addEventListener('message',async e=>{ const d=e.data, f=document.querySelector('iframe.labf'); if(e.origin!==location.origin||!d||!f||e.source!==f.contentWindow) return;
  if(d.type==='nch-eyes-ping'){ e.source.postMessage({type:'nch-eyes-pong',on:!!ME},location.origin); return; }
  if(d.type!=='nch-eyes') return; let out;
  try{ const r=await api('POST','/api/eyes',{img:d.img,w:d.w,h:d.h,dz:d.dz,n:d.n}); out={ok:true,text:r.text,model:r.model}; }catch(err){ out={ok:false,error:err.message,status:err.status||0}; }
  e.source.postMessage(Object.assign({type:'nch-eyes-r',id:d.id},out),location.origin); });
const HOWTO=`<ol class="how8"><li><b>Чертёж крупно</b><span>с ИИ-зрением — лист или один чертёж, края не обязательны; без него — лист целиком</span></li><li><b>Ровный свет</b><span>без бликов и тени от телефона, телефон параллельно листу</span></li><li><b>Линии как на сдачу</b><span>обведены; сканер не уверен — так и скажет, переснимите ближе</span></li></ol>`;
function checkView(tool){ const base=labBase(), L=LAB.find(x=>x.id===tool);
  if(tool==='normo') return normoView();
  if(L&&base){ track('check',{k:tool}); const src=base+labSrc(L); render(`<div class="labbar"><a class="back" href="#/check">${ic('back')}Проверка</a><b>${esc(L.t)}</b><a class="btn sm ghost" href="${esc(src)}" target="_blank" rel="noopener">На весь экран ${ic('ext')}</a></div>
      <p class="labp">${esc(L.p)}${L.var&&myVariant()?` Вариант <b>${myVariant()}</b> — из профиля.`:''}</p>
      <iframe class="labf" src="${esc(src)}" title="${esc(L.t)}" allow="camera; fullscreen"></iframe>`,L.t); return; }
  const item=(href,icon,t,s,dis)=>`<a class="tool8" href="${href}"${dis?' aria-disabled="true"':''}><span class="ico">${ic(icon)}</span><span class="tt"><b>${esc(t)}</b><small>${esc(s)}</small></span>${ic('arrow')}</a>`;
  render(`${pageHead('Проверка чертежа','Решили на бумаге — сфотографируйте: сканер сверит построение с верным решением и покажет, где ошибка. Фото не сохраняется: его разбирает телефон, а с ИИ-зрением подписи на нём читает ещё модель в Yandex Cloud.')}
  <h2 class="q8">Что проверяем?</h2>
  <div class="tools8">${LAB.map(x=>item(base?'#/check/'+x.id:'#/check',x.icon,x.t,x.s,!base)).join('')}${flag('normo')?item('#/check/normo','sheet','Лист ИКГ из КОМПАС или другой САПР','файл SVG · формат, линии, шрифт, размеры по ГОСТ'):''}</div>
  ${base?'':`<p class="note warn">Сканер фото работает в кабинете на сайте. <a class="btn sm" href="https://nachert1830.ru/lk/#/check">Открыть на nachert1830.ru ${ic('ext')}</a></p>`}
  <section class="card"><h2>Как снять, чтобы сканер понял</h2>${HOWTO}</section>`,'Проверка'); }
function normoView(){ if(!flag('normo')) return checkView();
  render(`${pageHead('Лист ИКГ по ГОСТ','Загрузите лист из КОМПАС или другой САПР в SVG: формат, рамка, основная надпись, линии, шрифт, виды и разрезы, штриховка, размеры. Файл проверяется в браузере.',['#/check','Проверка'])}
  <section class="card" data-feature="normo"><h2>Ваш лист</h2>
    <label class="file reg"><input id="nkF" type="file" accept=".svg,image/svg+xml"><span class="btn sm">Выбрать файл</span><span class="fn">файл не выбран</span></label>
    <div class="row reg"><button class="btn pri" type="button" data-act="normo">Проверить мой лист</button></div>
    <p class="mut reg">Нет своего — посмотрите на образцах ДЗ 2:</p><div class="samples"><button class="btn sm" type="button" data-act="normoSample" data-s="ig-v5-clean">верный лист</button><button class="btn sm" type="button" data-act="normoSample" data-s="ig-v8-thin">ошибка в линиях</button><button class="btn sm" type="button" data-act="normoSample" data-s="ig-v12-numline">ошибка в размерах</button></div>
    <div id="nkOut" aria-live="polite"></div></section>`,'Лист ИКГ по ГОСТ'); }

/* SVG пользователя — без скриптов, обработчиков, внешних ссылок; style="…" переводится в атрибуты (CSP не пускает встроенные стили) */
const PRES=new Set(['stroke','stroke-width','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','stroke-opacity','fill','fill-opacity','fill-rule','opacity','font-size','font-family','font-style','font-weight','text-anchor','dominant-baseline','visibility','display','vector-effect','letter-spacing']);
function sanitizeSvg(str,depth){ depth=depth||0; if(depth>3) return '';
  /* style="…" прячем до разбора: иначе разбор строки сам упирается в CSP (style-src-attr) */
  str=String(str).replace(/(\s)style(\s*=\s*)(?=["'])/gi,'$1data-nch-style$2');
  const doc=new DOMParser().parseFromString(str,'image/svg+xml'), root=doc.documentElement;
  if(!root||root.nodeName.toLowerCase()!=='svg'||doc.querySelector('parsererror')) throw new Error('Это не SVG-файл');
  root.querySelectorAll('script,foreignObject,iframe,object,embed,audio,video,style,link,meta,animate,set,animateTransform,animateMotion').forEach(n=>n.remove());
  [root,...root.querySelectorAll('*')].forEach(el=>{ [...el.attributes].forEach(a=>{ const n=a.name.toLowerCase(), v=a.value;
    if(n.startsWith('on')) el.removeAttribute(a.name);
    else if(n==='href'||n==='xlink:href'){ if(/^data:image\/svg\+xml/i.test(v)&&el.localName==='image'){ const i=v.indexOf(','); let inner=v.slice(i+1); try{ inner=/;base64,/i.test(v.slice(0,i+1))?atob(inner):decodeURIComponent(inner); el.setAttribute(a.name,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(sanitizeSvg(inner,depth+1))); }catch(e){ el.removeAttribute(a.name); } }
      else if(!/^#/.test(v)&&!/^data:image\/(png|jpeg|webp);/i.test(v)) el.removeAttribute(a.name); }
    else if(n==='style'||n==='data-nch-style'){ v.split(';').forEach(d=>{ const i=d.indexOf(':'); if(i<0) return; const k=d.slice(0,i).trim().toLowerCase(), val=d.slice(i+1).trim(); if(PRES.has(k)&&!/url\(|expression|javascript:/i.test(val)&&!el.hasAttribute(k)) el.setAttribute(k,val); }); el.removeAttribute(a.name); } }); });
  return new XMLSerializer().serializeToString(root); }
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=()=>rej(new Error('Не загрузился '+src)); document.head.appendChild(s); }); }
async function runNormo(svgText,own,label){ const out=$('#nkOut'); out.innerHTML='<p class="mut reg">Проверяю лист…</p>';
  try{ if(!window.NORMO) await loadScript('core/normo.js'); try{ await document.fonts.load('italic 22px NchSerif','Ø120 Б–Б'); }catch(e){}
    const svg=sanitizeSvg(svgText), r=NORMO.check(svg,{}), vb=(/viewBox="([-\d.\s]+)"/.exec(svg)||[])[1], v=vb?vb.trim().split(/\s+/).map(Number):null;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    const by={}; r.issues.forEach((i,j)=>{ (by[i.gost]=by[i.gost]||[]).push(Object.assign({j:j+1},i)); });
    out.innerHTML=`<p class="note ${r.issues.length?'warn':'ok'} reg">${esc(label)}: ${r.issues.length?'замечаний — '+r.issues.length:'замечаний нет'}${r.fmt?' · формат '+esc(r.fmt):''}</p>
      <div class="sheetbox"><img src="${url}" alt="Проверенный лист">${v?`<svg class="ov" viewBox="${v.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${r.issues.filter(i=>i.at).map((i,j)=>`<circle cx="${v[0]+i.at[0]*r.k}" cy="${v[1]+i.at[1]*r.k}" r="${6*r.k}" fill="none" stroke="#d0342b" stroke-width="${1.2*r.k}"/><text x="${v[0]+i.at[0]*r.k+7*r.k}" y="${v[1]+i.at[1]*r.k-5*r.k}" fill="#d0342b" font-size="${5*r.k}" font-family="sans-serif">${j+1}</text>`).join('')}</svg>`:''}</div>
      ${Object.keys(by).map(g=>`<h3 class="reg">ГОСТ ${esc(g)}</h3><ul>${by[g].map(i=>`<li><b>${esc(i.rule)}</b> — ${esc(i.msg)}</li>`).join('')}</ul>`).join('')}`;
    track('scan',{k:'normo',iss:r.issues.length,own:!!own});
    if(own){ LS.set(K.ev,BKT.merge(LS.get(K.ev,[]),BKT.fromNormo({id:'n'+Date.now().toString(36),t:Date.now(),issues:r.issues}))); } }
  catch(e){ out.innerHTML=`<p class="note bad reg">Не получилось проверить: ${esc(e.message)}</p>`; } }

/* ── профиль: информация (имя, группа, вариант), расписание и короткий список настроек ── */
const rowLink=(href,icn,t,s,o)=>{ o=o||{}; return `<a class="rowl" href="${esc(href)}"${o.ext?' target="_blank" rel="noopener noreferrer"':''}${o.act?` data-act="${o.act}"`:''}><span class="ico ${o.tone||''}">${ic(icn)}</span><span><b>${t}</b>${s?`<small>${s}</small>`:''}</span>${ic(o.ext?'ext':'arrow')}</a>`; };
const isDark=()=>document.documentElement.dataset.theme==='dark';
function meView(sub){ if(sub==='login') return meLoginView(); if(sub==='data') return meDataView(); if(sub==='remind') return meRemindView();
  const u=ME.user, v=myVariant(), gk=groupKey(), g=groupSched(), wk=CAL.weekOf(week1(),today()), nl=nextLesson();
  const methods=[u.email?'почта':'',u.yandex?'Яндекс ID':'',u.telegram?'Telegram':''].filter(Boolean).join(', ');
  render(`<div class="prof"><span class="av xl">${initials(u.name)}</span><h1>${esc(u.name)}</h1>${u.role==='admin'?'<span class="tagadm">владелец</span>':''}</div>
    <section class="card info" data-feature="profile"><div class="sh"><h2>Информация</h2><button class="lnk" type="button" data-act="editProfile">Изменить</button></div>
      <dl class="kv2"><div><dt>Имя</dt><dd>${esc(u.name)}</dd></div><div><dt>Группа</dt><dd>${gk?esc(gk):u.group?esc(u.group)+' <small>нет в расписании</small>':'<button class="lnk" type="button" data-act="editProfile">указать</button>'}</dd></div><div><dt>Вариант</dt><dd>${v||'<button class="lnk" type="button" data-act="editProfile">указать</button>'}</dd></div></dl></section>
    ${g?`<section class="card"><div class="sh"><h2>Расписание</h2><small>${wk>=1&&wk<=17?wk+'-я неделя · '+(parity(wk)==='чс'?'числитель':'знаменатель'):''}</small></div><ul class="lessons">${g.lessons.map(l=>lessonLi(l,nl&&l===nl.l)).join('')}</ul></section>`:''}
    <nav class="rows card">
      ${flag('calendar')?rowLink('#/calendar','cal','Сдачи семестра','ДЗ, РК и модули по неделям'):''}
      ${rowLink('#/me/login','shield','Вход и безопасность',methods||'способы входа')}
      ${flag('reminders')&&CFG&&CFG.telegram?rowLink('#/me/remind','bell','Напоминания','в Telegram, раз в день',{tone:'amber'}):''}
      ${rowLink('#/me/data','data','Данные и прогресс','сохранение, перенос, документы',{tone:'green'})}
      <button class="rowl" type="button" data-act="theme"><span class="ico">${ic('moon')}</span><span><b>Тёмная тема</b></span><span class="sw${isDark()?' on':''}" aria-hidden="true"><i></i></span></button>
      ${rowLink(mainUrl(),'book','Сайт Начерта','разборы, тетрадь, тренажёры',{ext:true})}
    </nav>
    ${u.role==='admin'?`<nav class="rows card">${rowLink('#/boss','pulse','Пульт','кто сейчас в кабинете и что делает',{tone:'green'})}${rowLink('#/admin','admin','Админ-панель','участники, функции, отзывы, семестр',{tone:'red'})}</nav>`:''}
    <button class="btn ghost full reg" type="button" data-act="logout">${ic('logout')}Выйти</button>`,'Профиль'); }
function editProfile(){ const u=ME.user;
  openSheet(`<h2>Информация</h2><form class="af" id="profF" novalidate>
      <label class="f" for="pName">Имя</label><input id="pName" class="inp" type="text" maxlength="60" autocomplete="given-name" value="${esc(u.name)}">
      <div class="grid2 gv"><div><label class="f" for="pGroup">Группа</label><input id="pGroup" class="inp" type="text" maxlength="16" autocapitalize="characters" list="grpList" placeholder="ИУ5-12/6" value="${esc(groupKey()||u.group||'')}">${grpList()}</div>
      <div><label class="f" for="pVar">Вариант</label>${varSelect('pVar',myVariant())}</div></div>
      <p class="mut">Вариант — один на все ДЗ. На сайте ДЗ откроются сразу на нём.</p>
      <div class="row reg"><button class="btn pri grow" type="submit">Сохранить</button><button class="btn" data-close type="button">Отмена</button></div></form>`); }
async function saveProfile(){ const g=normGroup($('#pGroup').value), name=$('#pName').value.trim(), variant=+$('#pVar').value||0;
  if(!name){ toast('Имя не может быть пустым'); return; } if(g&&!okGroup(g)){ toast('Группа — как в расписании, например ИУ5-12/6'); return; }
  try{ const r=await api('POST','/api/me/profile',{name,group:g,variant}); ME.user=r.user; LS.device(K.me,Object.assign({},ME,{csrf:undefined})); applyVariant(true);
    if(variant) track('plan',{e:'variant'}); closeSheet(); toast('Сохранено'); route(); }catch(e){ toast(e.message); } }
function meLoginView(){ const u=ME.user;
  render(`${pageHead('Вход и безопасность','Аккаунт один — способов входа может быть несколько.',['#/me','Профиль'])}
    <section class="card"><div class="kv"><div><span>Почта</span><span>${u.email?'привязана':CFG&&CFG.email?'<button class="btn sm" type="button" data-act="linkMail">Привязать</button>':'—'}</span></div>
      <div><span>Яндекс ID</span><span>${u.yandex?'привязан':CFG&&CFG.yandex?'<button class="btn sm" type="button" data-act="linkYa">Привязать</button>':'—'}</span></div>
      ${CFG&&CFG.telegram||u.telegram?`<div><span>Telegram</span><span>${u.telegram?'привязан':CFG&&CFG.botName?'<button class="btn sm" type="button" data-act="linkTg">Привязать</button>':'—'}</span></div>`:''}</div><div id="linkOut"></div></section>
    <section class="card"><div class="row"><button class="btn" type="button" data-act="logins">Журнал входов</button><button class="btn" type="button" data-act="logoutAll">Выйти на всех устройствах</button></div><div id="logOut"></div></section>`,'Вход и безопасность'); }
function meRemindView(){ const u=ME.user, r=ME.reminders||REM.DEFAULTS, tz=(()=>{ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone; }catch(e){ return 'Europe/Moscow'; } })();
  const tzs=[...new Set([r.tz,tz,'Europe/Moscow','Europe/Kaliningrad','Europe/Samara','Asia/Yekaterinburg','Asia/Omsk','Asia/Novosibirsk','Asia/Krasnoyarsk','Asia/Irkutsk','Asia/Vladivostok'].filter(Boolean))];
  render(`${pageHead('Напоминания','Не чаще раза в день и только по делу: близко сдача или есть задачи на повтор.',['#/me','Профиль'])}
    <section class="card" data-feature="reminders">${!u.telegram?`<p>Напоминания приходят в Telegram. Сначала привяжите его в «Вход и безопасность».</p><div class="row reg"><a class="btn" href="#/me/login">Привязать Telegram</a></div>`:`
      <label class="chk"><input type="checkbox" id="rOn"${r.enabled?' checked':''}><span>Присылать напоминания</span></label>
      <div class="grid2"><div><label class="f" for="rTime">Время</label><input id="rTime" type="time" value="${esc(r.time)}"></div><div><label class="f" for="rTz">Часовой пояс</label><select id="rTz">${tzs.map(z=>`<option${z===r.tz?' selected':''}>${esc(z)}</option>`).join('')}</select></div>
      <div><label class="f" for="rQf">Тихие часы с</label><input id="rQf" type="time" value="${esc(r.quietFrom)}"></div><div><label class="f" for="rQt">до</label><input id="rQt" type="time" value="${esc(r.quietTo)}"></div></div>
      <div class="row reg"><button class="btn pri" type="button" data-act="saveRem">Сохранить</button>${r.enabled?`<button class="btn" type="button" data-act="pauseRem">${r.paused?'Снять с паузы':'Пауза'}</button>`:''}</div>
      ${r.paused?'<p class="note warn reg">Напоминания на паузе.</p>':''}<div id="remMsg" aria-live="polite"></div>`}</section>`,'Напоминания'); }
function meDataView(){ const u=ME.user;
  render(`${pageHead('Данные и прогресс','Хранятся на устройстве и в аккаунте, в России (Yandex Cloud).',['#/me','Профиль'])}
    ${flag('sync')?`<section class="card" data-feature="sync"><div class="sh"><h2>Прогресс</h2><small>${lastSync?'сохранено в '+new Date(lastSync).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):''}</small></div>
      <div class="row"><button class="btn" type="button" data-act="syncNow">Сохранить сейчас</button></div>
      <details class="fold in"><summary><b>Перенести прогресс с сайта</b></summary><p class="mut">На сайте: «Тренировка дня» → внизу «Сохранить в файл». Здесь выберите этот файл:</p>
      <label class="file"><input id="impF" type="file" accept="application/json,.json"><span class="btn sm">Выбрать файл</span><span class="fn">файл не выбран</span></label><div class="row reg"><button class="btn" type="button" data-act="import">Перенести</button></div></details></section>`:''}
    <section class="card"><div class="sh"><h2>Мои данные</h2></div>
      <div class="kv"><div><span>Для входа</span><span>хеш почты, id в Яндекс ID, имя</span></div><div><span>Для кабинета</span><span>группа, вариант, прогресс</span></div><div><span>Журнал входов</span><span>90 дней</span></div></div>
      <label class="chk reg"><input type="checkbox" data-chg="photos"${u.photos?' checked':''}><span>Можно использовать мои фото чертежей для улучшения проверки<small>Необязательно; сейчас фото никуда не отправляются</small></span></label>
      <div class="row reg"><button class="btn" type="button" data-act="export">Скачать мои данные</button><button class="btn" type="button" data-act="fb" data-f="privacy">Написать нам</button><button class="btn ghost" type="button" data-act="requests">Мои обращения</button></div><div id="reqOut"></div>
      <p class="mut reg"><a href="legal/terms.html">Соглашение</a> · <a href="legal/privacy.html">Политика</a> · <a href="legal/consent.html">Согласие</a></p></section>
    <button class="btn dan full" type="button" data-act="delete">Удалить аккаунт</button>`,'Данные'); }
/* перерисовать текущий раздел профиля (после привязки, напоминаний и т. п.) */
function settingsView(){ const p=location.hash.replace(/^#\/?/,'').split('/'); return meView(p[0]==='me'?p[1]:'login'); }

/* ── админ-панель ── */
let ADMIN_TAB='stats';
async function adminView(){ if(ME.user.role!=='admin'){ render('<p class="note bad">Только для админа.</p>'); return; }
  render('<p class="mut">Загружаю…</p>','Админ-панель'); let D;
  try{ D=await api('GET','/api/admin/overview'); }catch(e){ render(`<p class="note bad">${esc(e.message)}</p>`); return; }
  const dt=ms=>ms?new Date(ms).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
  const names={}; D.users.forEach(u=>{ names[u.id]=u.name; });
  const tabs=[['stats','Статистика'],['users','Участники · '+D.users.length],['flags','Функции'],['feedback','Отзывы · '+D.feedback.length],['logins','Входы'],['settings','Семестр']];
  const st=i=>i.revokedAt?'<span class="st-badge bad">отозвано</span>':i.multi?'<span class="st-badge'+(i.uses>=i.maxUses?'':' ok')+'">публичная · '+i.uses+' из '+i.maxUses+'</span>':i.usedAt?'<span class="st-badge ok">'+esc(names[i.usedBy]||'использовано')+'</span>':i.expiresAt<Date.now()?'<span class="st-badge">истекло</span>':'<span class="st-badge">до '+dt(i.expiresAt)+'</span>';
  /* учёт: сколько всего, кто пришёл недавно, кто активен, разбивка по группам и способам входа */
  const now=Date.now(), DAYMS=864e5, act=u=>(u.lastSeen||u.lastLogin||0)>now-7*DAYMS, byG={};
  D.users.forEach(u=>{ const g=u.group||'— без группы'; const x=byG[g]||(byG[g]={n:0,a:0,w:0}); x.n++; if(act(u)) x.a++; if(u.createdAt>now-7*DAYMS) x.w++; });
  const groupsSorted=Object.keys(byG).sort((a,b)=>byG[b].n-byG[a].n||a.localeCompare(b));
  const viaN=m=>D.users.filter(u=>(u.methods||[]).includes(m)).length;
  const reg7=D.users.filter(u=>u.createdAt>now-7*DAYMS).length, act7=D.users.filter(act).length, act1=D.users.filter(u=>(u.lastSeen||u.lastLogin||0)>now-DAYMS).length;
  const days=[...Array(14)].map((_,i)=>{ const d=new Date(now-(13-i)*DAYMS); const k=d.toISOString().slice(0,10); return {k,lab:d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0'),n:D.users.filter(u=>new Date(u.createdAt).toISOString().slice(0,10)===k).length}; });
  const maxD=Math.max(1,...days.map(d=>d.n));
  const body={
    stats:`<div class="kpis"><div><b>${D.users.length}</b><span>всего</span></div><div><b>${reg7}</b><span>новых за 7 дней</span></div><div><b>${act7}</b><span>заходили за 7 дней</span></div><div><b>${act1}</b><span>сегодня и вчера</span></div></div>
      <h3 class="reg">Регистрации за 14 дней</h3><div class="bars">${days.map(d=>`<div class="bc" title="${d.lab}: ${d.n}"><i data-h="${Math.round(d.n/maxD*100)}"></i><small>${d.lab.split('.')[0]}</small></div>`).join('')}</div>
      <h3 class="reg">По группам</h3><div class="tbl"><table><thead><tr><th>Группа</th><th>Всего</th><th>Активны 7 дн.</th><th>Новые 7 дн.</th></tr></thead><tbody>${groupsSorted.map(g=>`<tr><td>${esc(g)}</td><td>${byG[g].n}</td><td>${byG[g].a}</td><td>${byG[g].w}</td></tr>`).join('')||'<tr><td colspan="4">Пока никого</td></tr>'}</tbody></table></div>
      <p class="mut reg">Способ входа: почта — ${viaN('email')}, Яндекс ID — ${viaN('yandex')}${viaN('telegram')?', Telegram — '+viaN('telegram'):''}.</p>
      <div class="row reg"><button class="btn" type="button" data-act="usersCsv">Скачать список участников (CSV для Excel)</button></div>`,
    invites:`<form id="invForm"><div class="grid2"><div><label class="f" for="invL">Для кого</label><input id="invL" type="text" maxlength="60" placeholder="Аня, ИУ5"></div><div><label class="f" for="invD">Действует, дней</label><input id="invD" type="number" min="1" max="60" value="14"></div></div>
      <label class="chk reg"><input id="invM" type="checkbox"><span>Публичная ссылка — одна на многих<small>Для друзей и группы: по ней зарегистрируются до 50 человек. Отозвать можно в любой момент.</small></span></label><label class="chk reg"><input id="invA" type="checkbox"><span>Роль «админ»<small>только для личной ссылки</small></span></label><div class="row reg"><button class="btn cta" type="submit">${ic('plus')}Создать приглашение</button></div></form><div id="invOut"></div>
      <div class="reg">${D.invites.map(i=>`<div class="urow"><div><b>${esc(i.label)}</b>${i.role==='admin'?' · админ':''}<small>${dt(i.createdAt)}</small></div><div class="row">${st(i)}${!i.usedAt&&!i.revokedAt?`<button class="btn sm dan" type="button" data-act="revoke" data-h="${i.h}">Отозвать</button>`:''}</div></div>`).join('')||'<p class="mut">Приглашений пока нет.</p>'}</div>`,
    users:D.users.map(u=>`<div class="urow"><div><b>${esc(u.name)}</b>${u.group?` <span class="st-badge">${esc(u.group)}</span>`:''}${u.blocked?' <span class="st-badge bad">доступ закрыт</span>':''}<small>с ${dt(u.createdAt)} · вход ${dt(u.lastLogin)}${u.reminders?' · напоминания':''}${u.photos?' · фото: да':''}</small></div>
      <div class="row"><select data-chg="role" data-id="${u.id}" aria-label="Роль"><option value="member"${u.role==='member'?' selected':''}>участник</option><option value="admin"${u.role==='admin'?' selected':''}>админ</option></select>${u.id!==ME.user.id?`<button class="btn sm${u.blocked?'':' dan'}" type="button" data-act="block" data-id="${u.id}" data-b="${u.blocked?0:1}">${u.blocked?'Вернуть':'Закрыть'}</button>`:''}</div></div>`).join(''),
    flags:`<p class="mut">«Всем» — функция у всех; «Админам» — обкатка; «Выкл» — скрыта.</p>${D.features.map(f=>`<div class="urow"><b>${esc(f.t)}</b><div class="seg" role="group">${[['on','Всем'],['admin','Админам'],['off','Выкл']].map(([m,l])=>`<button type="button" data-act="flag" data-f="${f.id}" data-m="${m}" class="${D.flags[f.id]===m?'on':''}">${l}</button>`).join('')}</div></div>`).join('')}`,
    feedback:D.feedback.length?`<ul class="list">${D.feedback.map(f=>`<li><b>${esc(f.feature==='privacy'?'Обращение к владельцу':(D.features.find(x=>x.id===f.feature)||{t:'Общее'}).t)}</b> ${f.mood?'<span class="lv">'+({good:'полезно',unclear:'непонятно',bad:'мешает'})[f.mood]+'</span>':''}<p>${esc(f.text)}</p><small>${esc(f.name)} · ${dt(f.ts)}</small>${f.feature==='privacy'?(f.reply?`<p class="note ok reg">Ответ (${dt(f.replyAt)}): ${esc(f.reply)}</p>`:`<div class="row reg"><button class="btn sm pri" type="button" data-act="reply" data-id="${esc(f.id)}">Ответить</button></div>`):''}</li>`).join('')}</ul>`:'<p class="empty">Отзывов пока нет.</p>',
    logins:D.logins.map(l=>`<div class="urow"><div><b>${esc(l.user?names[l.user]||'удалён':'—')}</b><small>${dt(l.ts)} · ${esc(l.ip)}${l.reason?' · '+esc(l.reason):''}</small></div><span class="st-badge ${l.ok?'ok':'bad'}">${l.ok?'вход':'отказ'}</span></div>`).join('')||'<p class="mut">Пусто.</p>',
    settings:`<label class="f" for="w1">Понедельник недели 1</label><div class="row"><input id="w1" class="grow" type="date" value="${esc(D.settings.week1)}"><button class="btn pri" type="button" data-act="saveWeek1">Сохранить</button></div><p class="mut">По умолчанию 31.08.2026 — сверьте с расписанием МГТУ. От этой даты считаются все недели календаря.</p>`};
  render(`${pageHead('Админ-панель','',['#/me','Профиль'])}<div class="seg wrap" role="tablist">${tabs.map(([k,l])=>`<button type="button" role="tab" data-act="atab" data-t="${k}" class="${ADMIN_TAB===k?'on':''}">${l}</button>`).join('')}</div>
    <section class="card reg">${body[ADMIN_TAB]}</section>`,'Админ-панель');
  const f=$('#invForm'); if(f) f.addEventListener('submit',async e=>{ e.preventDefault();
    try{ const r=await api('POST','/api/admin/invites',{label:$('#invL').value,days:+$('#invD').value,role:$('#invA').checked?'admin':'member',multi:$('#invM').checked,uses:50});
      await adminView(); $('#invOut').innerHTML=`<div class="note ok reg"><b>Приглашение создано.</b> Ссылка показывается один раз — скопируйте и отправьте лично:<span class="code" id="invLink">${esc(r.link)}</span><button class="btn sm pri" type="button" data-act="copy" data-t="#invLink">Скопировать</button></div>`; }
    catch(err){ toast(err.message); } }); }

/* ── пульт владельца: живая картина — кто сейчас в кабинете, что делает и как получается; обновляется сам каждые 8 секунд ── */
let BOSS_T=null, BOSS_SEEN=0, BOSS_AT=0;
function bossStop(){ clearInterval(BOSS_T); BOSS_T=null; }
const VIEW_T={today:'на главной',check:'в проверке чертежа',progress:'смотрит прогресс',train:'на тренировке',skills:'в навыках',event:'готовится к сдаче',calendar:'смотрит сдачи',me:'в профиле',settings:'в профиле',admin:'в админке',boss:'на пульте'};
const ago=ts=>{ const s=Math.max(0,Math.round((Date.now()-ts)/1000)); return s<45?'только что':s<3600?Math.round(s/60)+' мин назад':s<86400?Math.round(s/3600)+' ч назад':new Date(ts).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}); };
function actText(a){ const d=a.d||{};
  switch(a.type){
    case 'task': { const L=[['bad','не смог'],['warn','с подсказкой'],['ok','сам']][d.v]; return L?`<span class="lv ${L[0]}">${L[1]}</span> задача №${esc(d.n)}${d.ctx==='train'?' · тренировка':d.ctx==='diag'?' · диагностика':''}`:'отметил задачу'; }
    case 'check': return 'открыл '+(d.k==='dz'?'сканер ДЗ':d.k==='task'?'проверку задачи по фото':'проверку');
    case 'scan': return `проверил лист по ГОСТ — <span class="lv ${d.iss?'warn':'ok'}">${d.iss?d.iss+' '+plural(d.iss,'замечание','замечания','замечаний'):'без замечаний'}</span>`;
    case 'mock': return d.s==='end'?'закончил пробный РК':'начал пробный РК (90 мин)';
    case 'plan': return 'составил план подготовки';
    case 'skill': return 'оценил себя по навыку ИКГ';
    case 'signup': return '<span class="lv ok">новый</span> зарегистрировался'+(d.m?' · '+({email:'почта',yandex:'Яндекс ID',telegram:'Telegram'})[d.m]:'');
    case 'login': return 'вошёл'+(d.m?' · '+({email:'почта',yandex:'Яндекс ID',telegram:'Telegram'})[d.m]:'');
    default: return esc(a.type); } }
const actIco={task:'train',check:'scan',scan:'scan',mock:'clock',plan:'cal',skill:'skills',signup:'user',login:'user'};
async function bossView(){ if(ME.user.role!=='admin'){ render('<p class="note bad">Только для владельца.</p>'); return; }
  if(!$('#boss')){ render(`<div id="boss" class="boss"><p class="mut">Подключаюсь к пульту…</p></div>`,'Пульт'); BOSS_SEEN=0; }
  let L; try{ L=await api('GET','/api/admin/live'); }catch(e){ const b=$('#boss'); if(b) b.innerHTML=`<p class="note bad">${esc(e.message)}</p>`; return; }
  const b=$('#boss'); if(!b||curView()!=='boss') return; BOSS_AT=Date.now();
  const k=L.kpi, rate=k.tasks?Math.round(k.solved/k.tasks*100):null, maxH=Math.max(1,...L.hours.map(h=>h.n)), first=!BOSS_SEEN;
  const tile=(v,l,s,cl)=>`<div class="bt${cl?' '+cl:''}"><b>${v}</b><span>${l}</span>${s?`<small>${s}</small>`:''}</div>`;
  const who=(id,n,g)=>`<button type="button" class="who" data-act="bossUser" data-id="${esc(id)}"><i>${initials(n)}</i><span><b>${esc(n)}</b>${g?`<small>${esc(g)}</small>`:''}</span></button>`;
  b.innerHTML=`<section class="bhero"><div><span class="live"><i></i>в эфире · <span id="bAgo">обновлено только что</span></span>
      <h1>${esc((ME.user.name||'').split(' ')[0]||'Босс')}, ${k.online?'сейчас в кабинете — '+k.online+' '+plural(k.online,'человек','человека','человек'):'сейчас в кабинете тихо'}</h1>
      <p>Сегодня заходили ${k.today} из ${k.total} · за неделю ${k.week}${k.newToday?' · новых сегодня: '+k.newToday:''}</p></div>
      <a class="btn sm" href="#/admin">Админ-панель</a></section>
    <div class="btiles">${tile(k.online,'онлайн','последние 2 минуты','on')}${tile(k.today,'активны сегодня',k.newToday?'+'+k.newToday+' новых':'')}${tile(k.tasks,'задач решали сегодня',rate==null?'':'сами — '+rate+'%')}${tile(k.checks,'проверок чертежей','сегодня')}</div>
    <div class="bgrid"><div>
      <section class="card"><h2>Сейчас в кабинете</h2>${L.online.length?`<ul class="olist">${L.online.map(o=>`<li>${who(o.id,o.name,o.group)}<span class="where">${esc(VIEW_T[o.view]||'в кабинете')}<small>${ago(o.at)}</small></span></li>`).join('')}</ul>`:'<p class="mut">Никого. Как только кто-то откроет кабинет — появится здесь.</p>'}</section>
      <section class="card reg"><h2>Лента</h2>${L.feed.length?`<ul class="feed">${L.feed.map(a=>`<li class="${!first&&a.ts>BOSS_SEEN?'new':''}"><span class="ico">${ic(actIco[a.type]||'info')}</span><div>${who(a.user,a.name,a.group)}<p>${actText(a)}</p></div><time>${ago(a.ts)}</time></li>`).join('')}</ul>`:'<p class="mut">Пока ничего не происходило.</p>'}</section>
    </div><div>
      <section class="card"><h2>Активность за 24 часа</h2><div class="bars hb">${L.hours.map(h=>`<div class="bc" title="${h.h}:00 — ${h.n}"><i data-h="${Math.round(h.n/maxH*100)}"></i><small>${h.h%3?'':h.h}</small></div>`).join('')}</div></section>
      <section class="card reg"><h2>Где спотыкаются</h2><p class="mut">Задачи, которые чаще всего «не смог» за 7 дней — кандидаты на разбор.</p>${L.hard.length?`<ul class="hard">${L.hard.map(x=>`<li><b>№${esc(x.n)}</b><span class="meter"><i data-w="${Math.round(x.bad/x.total*100)}"></i></span><small>${x.bad} из ${x.total} · ${x.people} ${plural(x.people,'человек','человека','человек')}</small></li>`).join('')}</ul>`:'<p class="mut">Пока никто не застрял.</p>'}</section>
      <section class="card reg"><h2>Группы сегодня</h2>${L.groups.length?`<div class="tbl"><table><thead><tr><th>Группа</th><th>Людей</th><th>Действий</th></tr></thead><tbody>${L.groups.map(g=>`<tr><td>${esc(g.g)}</td><td>${g.users}</td><td>${g.acts}</td></tr>`).join('')}</tbody></table></div>`:'<p class="mut">Сегодня ещё никого.</p>'}</section>
    </div></div>`;
  paint(b); BOSS_SEEN=L.feed.length?Math.max(BOSS_SEEN,L.feed[0].ts):BOSS_SEEN||1;
  if(!BOSS_T) BOSS_T=setInterval(()=>{ if(curView()!=='boss'){ bossStop(); return; } const a=$('#bAgo'); if(a) a.textContent='обновлено '+Math.round((Date.now()-BOSS_AT)/1000)+' с назад';
    if(document.visibilityState==='visible'&&Date.now()-BOSS_AT>8e3&&!$('#sheet')) bossView(); },1000); }
async function bossUser(id){ openSheet('<p class="mut">Загружаю…</p>'); let U;
  try{ U=await api('GET','/api/admin/user?id='+encodeURIComponent(id)); }catch(e){ openSheet(`<p class="note bad">${esc(e.message)}</p><div class="row reg"><button class="btn" data-close type="button">Закрыть</button></div>`); return; }
  const u=U.user, s=U.stats, p=U.progress, rate=s.tasks?Math.round(s.solved/s.tasks*100):null;
  openSheet(`<div class="uhead"><i>${initials(u.name)}</i><div><h2>${esc(u.name)}</h2><p class="mut">${u.group?esc(u.group)+' · ':''}${u.role==='admin'?'админ · ':''}с ${new Date(u.createdAt).toLocaleDateString('ru-RU')} · ${u.live?'<b class="okc">сейчас '+esc(VIEW_T[u.live.view]||'в кабинете')+'</b>':'был '+(u.lastSeen?ago(u.lastSeen):'—')}</p></div></div>
    <div class="btiles sm">${[[s.tasks,'задач отмечено'],[rate==null?'—':rate+'%','решил сам'],[s.checks,'проверок'],[s.days,'дней с действиями']].map(([v,l])=>`<div class="bt"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    <p class="mut reg">В повторении ${p.tasks} ${plural(p.tasks,'задача','задачи','задач')}, к повтору сегодня — ${p.due}. Навыки ИКГ: ${p.skillObs?p.skillOk+'% верных из '+p.skillObs:'нет данных'}. Отмечено шагов подготовки: ${p.done}.${p.syncedAt?' Прогресс сохранён '+ago(p.syncedAt)+'.':''}</p>
    <h3 class="reg">Что делал</h3>${U.acts.length?`<ul class="feed sm">${U.acts.map(a=>`<li><span class="ico">${ic(actIco[a.type]||'info')}</span><div><p>${actText(a)}</p></div><time>${new Date(a.ts).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time></li>`).join('')}</ul>`:'<p class="mut">Пока ничего.</p>'}
    <div class="row reg"><button class="btn" data-close type="button">Закрыть</button></div>`); }

/* ── отзыв ── */
function feedback(f){ const name=f==='general'?'личный кабинет':(FEAT.FEATURES.find(x=>x.id===f)||{t:f}).t;
  openSheet(`${f==='privacy'?'<h2>Написать нам</h2><p class="mut">Вопрос, предложение или запрос по персональным данным. Ответ — в течение 10 рабочих дней: «Профиль» → «Данные и прогресс» → «Мои обращения».</p>':`<h2>Отзыв: ${esc(name)}</h2><p class="mut">Что полезно, что мешает, что непонятно.</p>`}
    <div class="seg reg" role="group" id="fbMood">${[['good','Полезно'],['unclear','Непонятно'],['bad','Мешает']].map(([m,l])=>`<button type="button" data-m="${m}">${l}</button>`).join('')}</div>
    <label class="f" for="fbT">Подробнее</label><textarea id="fbT" maxlength="2000"></textarea><div class="row reg"><button class="btn pri grow" id="fbGo" type="button">Отправить</button><button class="btn" data-close type="button">Отмена</button></div>`,
    bg=>{ let mood=null; $('#fbMood',bg).addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; mood=b.dataset.m; $$('#fbMood button',bg).forEach(x=>x.classList.toggle('on',x===b)); });
      $('#fbGo',bg).addEventListener('click',async()=>{ try{ await api('POST','/api/feedback',{feature:f,mood,text:$('#fbT',bg).value,ver:VER}); closeSheet(); toast('Спасибо! Отзыв отправлен'); }catch(e){ toast(e.message); } }); }); }

/* ── действия ── */
const ACT={
  fb:el=>feedback(el.dataset.f),
  editProfile:()=>editProfile(),
  theme:()=>{ const t=isDark()?'light':'dark'; document.documentElement.dataset.theme=t; LS.device('nch2_theme',t); const sw=$('.rowl .sw'); if(sw) sw.classList.toggle('on',t==='dark'); },
  botLogin:()=>{ const box=$('#auth'); if(box) box.innerHTML=botSteps(); },
  mailResend:()=>{ const f=$('#codeF'); if(f){ const em=f.dataset.email; loginView(); $('#emA').value=em; mailStart(em); } },
  tgLogin:()=>{ const q=new URLSearchParams({bot_id:CFG.botId,origin:location.origin,request_access:'write',return_to:pageUrl()}); location.href=CFG.tgLogin.url+'?'+q.toString(); },
  yaLogin:()=>{ const q=new URLSearchParams({ret:pageUrl(),s:yaState()}), c=getInvite(); if(c&&/^[A-Za-z0-9_-]{16,62}$/.test(c)) q.set('invite',c);
    location.href=(API||location.origin)+'/api/auth/yandex/start?'+q.toString(); },
  linkMail:()=>{ const box=$('#linkOut'); if(!box) return; box.innerHTML=`<form class="af reg" id="lmF" novalidate><label class="f" for="lmA">Почта</label><input id="lmA" class="inp" type="email" inputmode="email" autocomplete="email" placeholder="name@example.ru"><button class="btn pri" type="submit">Получить код</button></form><div id="lmMsg" aria-live="polite"></div>`; $('#lmA').focus(); },
  linkYa:async()=>{ try{ const r=await api('POST','/api/me/link',{to:'yandex',ret:pageUrl(),s:yaState()}); location.href=r.url; }catch(e){ toast(e.message); } },
  linkTg:async()=>{ try{ const r=await api('POST','/api/me/link',{to:'telegram'}); const box=$('#linkOut');
      if(box) box.innerHTML=`<p class="note">Откройте бота и нажмите «Старт», затем — кнопку «Привязать к кабинету» в ответе бота. <a class="btn sm" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Открыть бота</a> <button class="btn sm ghost" type="button" data-act="linkCheck">Готово, проверить</button></p>`; }
    catch(e){ toast(e.message); } },
  linkCheck:async()=>{ try{ await loadMe(); settingsView(); toast(ME.user.telegram?'Telegram привязан':'Пока не привязан — нажмите «Старт» у бота'); }catch(e){ toast(e.message); } },
  notMe:()=>{ LANDING=null; toast('Вход отменён'); loginView(); },
  loginCancel:()=>loginView(),
  devBot:async()=>{ const r=await (await fetch(API+'/dev/bot-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:$('#dvId').value,first_name:$('#dvName').value,start:botStart()})})).json();
    if(r.link) location.href=r.link; else $('#authMsg').innerHTML=`<p class="note bad">Бот ответил: ${esc(r.text)}</p>`; },
  qmore:el=>{ const q=$('.q',el.closest('.task')); q.classList.toggle('open'); el.textContent=q.classList.contains('open')?'Свернуть':'Условие целиком'; },
  rate:el=>{ const t=el.closest('.task'), v=+el.dataset.v; if(v===2) saveRating(t,2,[],[]); else { $$('.rate .btn',t).forEach(b=>b.classList.toggle('on',b===el)); errorPicker(t,v); } },
  rateSave:el=>{ const t=el.closest('.task'); saveRating(t,+el.dataset.v,$$('.errs [data-e].on',t).map(b=>b.dataset.e),$$('.errs [data-sym].on',t).map(b=>b.dataset.sym)); },
  ikgSelf:el=>{ const id=el.dataset.ev, s=el.dataset.s, v=+el.dataset.v, st=LS.get(K.diag,{}); if(!st[id]) return; st[id].res[s]=v; LS.set(K.diag,st); track('skill',{s,v});
    LS.set(K.ev,BKT.merge(LS.get(K.ev,[]).filter(e=>e.id!=='self:'+id+':'+s),[{id:'self:'+id+':'+s,t:Date.now(),skills:[s],ok:v===2,src:'self'}]));
    if(Object.keys(st[id].res).length>=st[id].items.length) setDone(id+':diag',true); const e=events().find(x=>x.id===id); if(e) diagView(e); },
  addTrain:el=>{ let rep=LS.get(K.rep,{}); const d=dayNum(); el.dataset.n.split(',').forEach(n=>{ if(!rep[n]) rep=Object.assign({},rep,{[n]:{b:0,d:d,s:d,l:d,n:0}}); }); LS.set(K.rep,rep);
    const tr=LS.get(K.train,{}); if(tr.day===d){ delete tr.day; LS.set(K.train,tr); } toast('Добавлено — задачи в тренировке дня'); },
  evDateReset:el=>{ const s=calSet(); s.dates=s.dates||{}; delete s.dates[el.dataset.id]; LS.set(K.cal,s); eventView(el.dataset.id); },
  iiClear:el=>{ const m=LS.get(K.ii,{}); m[el.dataset.id]={when:'',where:'',what:'',t:Date.now()}; LS.set(K.ii,m); eventView(el.dataset.id); },
  mockStart:el=>{ const m=LS.get(K.mock,{}); m[el.dataset.id]={start:Date.now(),min:90}; LS.set(K.mock,m); track('mock',{s:'start',e:el.dataset.id}); const e=events().find(x=>x.id===el.dataset.id); mockView(e); },
  mockEnd:el=>{ const m=LS.get(K.mock,{}); m[el.dataset.id]=Object.assign({},m[el.dataset.id],{end:Date.now()}); LS.set(K.mock,m); track('mock',{s:'end',e:el.dataset.id}); setDone(el.dataset.id+':mock',true); toast('Пробный РК отмечен'); const e=events().find(x=>x.id===el.dataset.id); mockView(e); },
  scan:async()=>{ const n=+$('#scN').value, f=$('#scF').files[0], out=$('#scOut'); const t=taskBy(n);
    if(!t){ out.innerHTML='<p class="note bad reg">Укажите номер задачи тетради (1–89).</p>'; return; }
    if(!f){ out.innerHTML='<p class="note bad reg">Выберите фото.</p>'; return; }
    const r=await SCAN.scan(f,{n,topic:t.topic}); const url=URL.createObjectURL(f);
    out.innerHTML=`<img class="photo" src="${url}" alt="Фото решения"><p class="note ${r.verdict==='ok'?'ok':r.verdict==='error'?'bad':'warn'} reg">${r.error?esc(r.error):r.verdict==='unknown'?'Не знаю: '+esc(r.note||''):r.verdict==='ok'?'Похоже на верное решение.':'Есть расхождения.'}</p>`; },
  normo:async()=>{ const f=$('#nkF').files[0]; if(!f){ $('#nkOut').innerHTML='<p class="note bad reg">Выберите SVG-файл листа.</p>'; return; }
    if(f.size>8*1024*1024){ $('#nkOut').innerHTML='<p class="note bad reg">Файл больше 8 МБ.</p>'; return; } runNormo(await f.text(),true,'Ваш лист'); },
  normoSample:async el=>{ try{ const r=await fetch('core/samples/'+el.dataset.s+'.svg'); runNormo(await r.text(),false,'Образец «'+el.textContent+'»'); }catch(e){ toast('Нет сети'); } },
  saveGroup:async()=>{ const g=normGroup($('#pGroup').value); if(g&&!okGroup(g)){ toast('Группа — как в расписании, например ИУ5-12/6'); return; }
    try{ const r=await api('POST','/api/me/profile',{group:g}); ME.user=r.user; settingsView(); toast(g?'Группа сохранена':'Группа убрана'); }catch(e){ toast(e.message); } },
  saveName:async()=>{ try{ const r=await api('POST','/api/me/profile',{name:$('#pName').value}); ME.user=r.user; toast('Сохранено'); }catch(e){ toast(e.message); } },
  saveRem:async()=>{ const b={enabled:$('#rOn').checked,time:$('#rTime').value,quietFrom:$('#rQf').value,quietTo:$('#rQt').value,tz:$('#rTz').value}; await saveRem(b); },
  pauseRem:async()=>{ await saveRem({paused:!(ME.reminders&&ME.reminders.paused)}); },
  syncNow:async()=>{ const ok=await syncNow(); toast(ok?'Сохранено':syncErr||'Нет сети — сохранится позже'); },
  import:()=>{ const f=$('#impF').files[0]; if(!f){ toast('Выберите файл'); return; } const rd=new FileReader();
    rd.onload=()=>{ const o=J(rd.result); if(!o||o.app!=='nachert'||!o.data||typeof o.data!=='object'){ toast('Это не файл прогресса Начерта'); return; }
      const file={data:{},mt:{}}; Object.keys(o.data).forEach(k=>{ if(SYNC.syncable(k)&&typeof o.data[k]==='string') file.data[k]=o.data[k]; });
      const merged=SYNC.merge(SYNC.readLocal(localStorage),file); const now=Date.now(); Object.keys(file.data).forEach(k=>{ merged.mt[k]=now; });
      SYNC.writeLocal(localStorage,merged); const tr=LS.get(K.train,{}); delete tr.day; LS.device(K.train,tr); markDirty();
      const reps=Object.keys(J(merged.data.nch2_rep||'{}')||{}).length; toast('Перенесено. Задач в повторении: '+reps); };
    rd.readAsText(f); },
  logins:async()=>{ try{ const r=await api('GET','/api/me/logins'); $('#logOut').innerHTML=`<div class="reg">${r.logins.map(l=>`<div class="urow"><div><b>${new Date(l.ts).toLocaleString('ru-RU')}</b><small>${esc(l.ip)}${l.reason?' · '+esc(l.reason):''}</small></div><span class="st-badge ${l.ok?'ok':'bad'}">${l.ok?'вход':'отказ'}</span></div>`).join('')}</div>`; }catch(e){ toast(e.message); } },
  logoutAll:async()=>{ if(!confirm('Выйти на всех устройствах, включая это?')) return; await syncNow(); try{ await api('POST','/api/auth/logout-all',{}); }catch(e){} wipeLocal(); ME=null; route(); },
  logout:async()=>{ if(isDirty()&&!(await syncNow())&&!confirm('Есть несохранённый прогресс, а сети нет. Выйти и потерять его на этом устройстве?')) return;
    try{ await api('POST','/api/auth/logout',{}); }catch(e){} wipeLocal(); ME=null; location.hash='#/'; route(); },
  export:async()=>{ try{ const tok=TOK.get(); const r=await fetch(API+'/api/me/export',tok?{headers:{Authorization:'Bearer '+tok},credentials:'omit'}:{credentials:'same-origin'}); if(!r.ok) throw new Error('Не получилось'); const b=await r.blob(), u=URL.createObjectURL(b), a=document.createElement('a');
    a.href=u; a.download='nachert-moi-dannye.json'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(u); a.remove(); },1500); }catch(e){ toast(e.message); } },
  delete:()=>openSheet(`<h2>Удалить аккаунт</h2><p>Удалятся имя, Telegram id, прогресс в аккаунте, настройки, отзывы и журнал входов. Это нельзя отменить. Перед удалением можно <button class="btn sm" type="button" data-act="export">скачать свои данные</button>.</p>
    <label class="f" for="delC">Введите слово УДАЛИТЬ</label><input id="delC" type="text" autocomplete="off"><div class="row reg"><button class="btn dan grow" id="delGo" type="button">Удалить навсегда</button><button class="btn" data-close type="button">Отмена</button></div>`,
    bg=>{ $('#delGo',bg).addEventListener('click',async()=>{ try{ await api('POST','/api/me/delete',{confirm:$('#delC',bg).value.trim()}); closeSheet(); wipeLocal(); ME=null; toast('Аккаунт удалён'); location.hash='#/'; route(); }catch(e){ toast(e.message); } }); }),
  copy:async el=>{ const t=$(el.dataset.t).textContent; try{ await navigator.clipboard.writeText(t); toast('Скопировано'); }catch(e){ toast('Выделите и скопируйте вручную'); } },
  requests:async()=>{ try{ const r=await api('GET','/api/me/requests'); $('#reqOut').innerHTML=r.requests.length?`<ul class="list reg">${r.requests.map(q=>`<li>${esc(q.text)}<br><small>${new Date(q.ts).toLocaleString('ru-RU')}</small>${q.reply?`<p class="note ok reg">Ответ: ${esc(q.reply)}</p>`:'<p class="mut">Ответа пока нет.</p>'}</li>`).join('')}</ul>`:'<p class="mut reg">Обращений нет.</p>'; }catch(e){ toast(e.message); } },
  reply:el=>openSheet(`<h2>Ответ на обращение</h2><p class="mut">Участник увидит ответ в «Мои обращения» и получит его в Telegram.</p><textarea id="rpT" maxlength="2000"></textarea><div class="row reg"><button class="btn pri grow" id="rpGo" type="button">Отправить</button><button class="btn" data-close type="button">Отмена</button></div>`,
    bg=>{ $('#rpGo',bg).addEventListener('click',async()=>{ try{ const r=await api('POST','/api/admin/reply',{id:el.dataset.id,text:$('#rpT',bg).value}); closeSheet(); toast(r.telegram?'Ответ отправлен и в Telegram':'Ответ сохранён в кабинете'); adminView(); }catch(e){ toast(e.message); } }); }),
  atab:el=>{ ADMIN_TAB=el.dataset.t; adminView(); },
  bossUser:el=>bossUser(el.dataset.id),
  pickGroup:async el=>{ try{ const r=await api('POST','/api/me/profile',{group:el.dataset.g}); ME.user=r.user; LS.device(K.me,ME); todayView(); toast('Группа '+el.dataset.g); }catch(e){ toast(e.message); } },
  /* список участников в CSV (Excel открывает с разделителем «;» и BOM) */
  usersCsv:async()=>{ try{ const D=await api('GET','/api/admin/overview'); const d=ms=>ms?new Date(ms).toLocaleString('ru-RU'):'';
      const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
      const rows=[['Имя','Группа','Роль','Способы входа','Зарегистрирован','Последний вход','Последняя активность','Напоминания','Доступ закрыт']].concat(D.users.map(u=>[u.name,u.group,u.role==='admin'?'админ':'участник',(u.methods||[]).join(', '),d(u.createdAt),d(u.lastLogin),d(u.lastSeen),u.reminders?'да':'',u.blocked?'да':'']));
      const blob=new Blob(['\ufeff'+rows.map(r=>r.map(q).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}), a=document.createElement('a');
      a.href=URL.createObjectURL(blob); a.download='nachert-uchastniki-'+today()+'.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); }
    catch(e){ toast(e.message); } },
  revoke:async el=>{ if(!confirm('Отозвать приглашение?')) return; try{ await api('POST','/api/admin/invites/revoke',{h:el.dataset.h}); adminView(); }catch(e){ toast(e.message); } },
  block:async el=>{ try{ await api('POST','/api/admin/users/block',{id:el.dataset.id,blocked:el.dataset.b==='1'}); adminView(); }catch(e){ toast(e.message); } },
  flag:async el=>{ try{ await api('POST','/api/admin/flags',{flags:{[el.dataset.f]:el.dataset.m}}); await loadMe(); adminView(); }catch(e){ toast(e.message); } },
  saveWeek1:async()=>{ try{ await api('POST','/api/admin/settings',{week1:$('#w1').value}); await loadMe(); toast('Сохранено'); }catch(e){ toast(e.message); } }
};
async function saveRem(b){ const m=$('#remMsg'); try{ const r=await api('POST','/api/me/reminders',b); ME.reminders=r.reminders; settingsView(); toast(r.reminders.enabled?(r.reminders.paused?'Напоминания на паузе':'Напоминания включены'):'Напоминания выключены'); }
  catch(e){ if(m) m.innerHTML=`<p class="note bad reg">${esc(e.message)}</p>${e.data&&e.data.bot?ext(e.data.bot,'Открыть бота','btn'):''}`; } }
const CHG={
  classDay:el=>{ const s=calSet(); s.classDay=Object.assign({},s.classDay,{[el.dataset.s]:+el.value}); LS.set(K.cal,s); calendarView(); },
  subj:el=>{ const s=CAL.normSettings(calSet()); const set=new Set(s.subjects); if(el.checked) set.add(el.dataset.s); else set.delete(el.dataset.s); const c=calSet(); c.subjects=[...set]; LS.set(K.cal,c); calendarView(); },
  evDate:el=>{ const s=calSet(); s.dates=Object.assign({},s.dates,{[el.dataset.id]:el.value}); LS.set(K.cal,s); eventView(el.dataset.id); },
  step:el=>{ setDone(el.dataset.k,el.checked); const li=el.closest('li'); li.classList.toggle('done',el.checked); const dot=el.closest('.dot'), c=dot.querySelector('svg'), nn=dot.querySelector('.nn'); if(el.checked&&!c){ if(nn) nn.hidden=true; dot.insertAdjacentHTML('afterbegin',ic('check')); } if(!el.checked&&c){ c.remove(); if(nn) nn.hidden=false; else dot.insertAdjacentHTML('afterbegin','<span class="nn">✓</span>'); } },
  photos:async el=>{ try{ const r=await api('POST','/api/me/profile',{photos:el.checked}); ME.user=r.user; toast(el.checked?'Разрешение на фото сохранено':'Разрешение на фото отозвано'); }catch(e){ el.checked=!el.checked; toast(e.message); } },
  role:async el=>{ try{ await api('POST','/api/admin/users/role',{id:el.dataset.id,role:el.value}); toast('Роль изменена'); }catch(e){ toast(e.message); adminView(); } }
};
document.addEventListener('click',e=>{ const el=e.target.closest('[data-act]'); if(el&&ACT[el.dataset.act]){ e.preventDefault(); ACT[el.dataset.act](el,e); } });
document.addEventListener('change',e=>{ const f=e.target.closest('.file input[type=file]'); if(f){ const n=f.parentNode.querySelector('.fn'); if(n) n.textContent=f.files&&f.files[0]?f.files[0].name:'файл не выбран'; }
  const el=e.target.closest('[data-chg]'); if(el&&CHG[el.dataset.chg]) CHG[el.dataset.chg](el,e); });


/* выход: стираем вход и данные клуба; на nachert1830.ru прогресс nch2_* общий с сайтом (он был и до клуба) — его не трогаем */
function wipeLocal(){ TOK.set(''); try{ const ks=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if((SYNC.syncable(k)&&!ON_MAIN)||/^nch2_club_/.test(k)) ks.push(k); } ks.forEach(k=>localStorage.removeItem(k)); }catch(e){} }

/* ── маршруты ── */
/* верхняя строка: неделя, дата, ближайшее событие, группа — на всех экранах кабинета */
function topbar(){ const b=$('#ub'); if(!b) return; b.hidden=!ME; if(!ME) return;
  const t=today(), wk=CAL.weekOf(week1(),t), p=dparts(t);
  b.innerHTML=`<div class="ubi"><span class="ubw">${wk>=1&&wk<=17?wk+'-я неделя':wk<1?'до семестра':'каникулы'}</span>${wk>=1&&wk<=17?`<span class="ubp">${parity(wk)==='чс'?'числитель':'знаменатель'}</span>`:''}<span class="ubd">${esc(p.wd)}, ${p.d} ${esc(p.mon)}</span></div>`; }
const TAB_OF={'':'',event:'calendar',calendar:'calendar',check:'check',me:'me',settings:'me',admin:'me',boss:'boss'};
function tabs(){ topbar(); const t=$('#tabs'); t.hidden=!ME; if(!ME) return; const r=TAB_OF[(location.hash.replace(/^#\/?/,'').split('/')[0])||'']; const av=$('#tav'); if(av) av.textContent=String(ME.user.name||'·').trim().slice(0,1).toUpperCase();
  $$('a',t).forEach(a=>{ a.hidden=(!!a.dataset.f&&!flag(a.dataset.f))||(a.dataset.admin!=null&&ME.user.role!=='admin'); a.classList.toggle('on',a.dataset.r===(r==null?'':r)); }); }
/* возврат с oauth.telegram.org: #tgAuthResult=<base64 JSON, подписанный Telegram> → сервер проверяет подпись → «Войти как …?» */
async function tgReturn(raw){ history.replaceState(null,'','#/'); let data=null;
  try{ data=JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((raw.length+3)%4))))); }catch(e){}
  if(!data||raw==='false') return loginView('Вход через Telegram отменён.');
  render('<p class="mut">Проверяю подтверждение Telegram…</p>','Вход');
  try{ const r=await api('POST','/api/auth/telegram',{data,invite:getInvite()}); return landingView(r.token); }
  catch(e){ return getInvite()?inviteView(e.message):loginView(e.message); } }
function route(){ closeSheet(); const m=/^#tgAuthResult=([A-Za-z0-9+/=_%-]*)/.exec(location.hash); if(m){ if(!ME) return tgReturn(decodeURIComponent(m[1])); history.replaceState(null,'','#/'); }
  const h=location.hash.replace(/^#\/?/,''), p=h.split('/');
  /* ссылки-приглашения больше не нужны: регистрация открыта, старая ссылка ведёт на вход */
  if(p[0]==='invite'||p[0]==='join'){ history.replaceState(null,'','#/'); if(!ME) return loginView(); }
  if(p[0]==='tg'&&p[1]){ const tok=p[1]; history.replaceState(null,'','#/'); if(!ME) return landingView(tok); }
  if(p[0]==='ya'&&p[1]){ const tok=p[1], cs=p[2]; let mine=''; try{ mine=sessionStorage.getItem('club_ya_s')||''; sessionStorage.removeItem('club_ya_s'); }catch(e){}
    history.replaceState(null,'','#/'); if(!ME) return mine&&cs===mine?landingView(tok):loginView(OOPS.state); }
  if(p[0]==='oops'){ history.replaceState(null,'','#/'); if(!ME) return loginView(OOPS[p[1]]||'Не получилось войти.'); toast(OOPS[p[1]]||'Не получилось'); }
  /* привязка второго способа входа: подтверждает только этот браузер с тем же аккаунтом (сервер сверяет сессию) */
  if(p[0]==='link'&&p[1]){ const tok=p[1], cs=p[2]; let mine=''; if(cs){ try{ mine=sessionStorage.getItem('club_ya_s')||''; sessionStorage.removeItem('club_ya_s'); }catch(e){} }
    history.replaceState(null,'','#/me/login');
    if(cs&&cs!==mine){ if(!ME) return loginView(OOPS.state); toast(OOPS.state); return settingsView(); }
    if(!ME) return loginView('Чтобы привязать вход, сначала войдите в кабинет в этом браузере, затем откройте ссылку снова.');
    api('POST','/api/me/link/confirm',{token:tok}).then(r=>{ ME.user=r.user; settingsView(); toast(r.linked==='yandex'?'Яндекс ID привязан':'Telegram привязан'); })
      .catch(e=>{ settingsView(); const b=$('#linkOut'); if(b) b.innerHTML=`<p class="note bad">${esc(e.message)}</p>`; else toast(e.message); });
    return settingsView(); }
  if(!ME){ if(LANDING&&$('#auth')) return; return loginView(); }
  if(!CORE){ render('<p class="mut">Загружаю задачи…</p>'); return; }
  view().focus({preventScroll:true}); scrollTo(0,0); clearTimeout(actTimer); actTimer=setTimeout(beat,800); if(p[0]!=='boss') bossStop();
  switch(p[0]){
    case '': case 'join': return homeView();
    case 'calendar': return flag('calendar')?calendarView():homeView();
    case 'progress': case 'train': case 'skills': history.replaceState(null,'','#/'); return homeView();
    case 'me': return meView(p[1]);
    case 'event': return eventView(p[1],p[2]);
    case 'check': return checkView(p[1]);
    case 'settings': case 'more': case 'about': history.replaceState(null,'','#/me'); return meView();
    case 'admin': return adminView();
    case 'boss': return bossView();
    default: return todayView(); } }
addEventListener('hashchange',route);

async function boot(){
  try{ CFG=await api('GET','/api/config'); LS.device('nch2_club_cfg',CFG); }catch(e){ CFG=LS.get('nch2_club_cfg',null); }
  if(!CFG){ render('<section class="card"><h2>Нет связи</h2><p>Кабинет открывается впервые и без сети не может загрузиться. Подключитесь к интернету.</p></section>'); return; }
  try{ await loadMe(); OFFLINE=false; }
  catch(e){ if(e.offline){ const c=LS.get(K.me,null); if(c){ ME=c; OFFLINE=true; } } else ME=null; }
  try{ const r=await fetch('core/tasks.json'); CORE=await r.json(); }catch(e){ CORE=null; }
  try{ const r=await fetch('data/groups.json',{cache:'no-cache'}); GROUPS=await r.json(); }catch(e){}
  if(ME) applyVariant(false); route(); if(ME&&!OFFLINE) syncNow(); }
if('serviceWorker' in navigator&&location.protocol!=='file:') navigator.serviceWorker.register('sw.js').catch(()=>{});
boot();
window.CLUB={get me(){ return ME; },syncNow,sanitizeSvg,LS};
})();
