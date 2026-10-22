/* Клуб Начерта — личный кабинет тестировщика. Без сборки и зависимостей; логика — в lib/*.js (общая с сервером).
   Прогресс живёт в localStorage под теми же ключами nch2_*, что на основном сайте, и синхронизируется с аккаунтом (lib/sync.js).
   CSP запрещает встроенные скрипты и стили: обработчики — через data-act, ширины полос — через el.style после отрисовки. */
(function(){
'use strict';
const CAL=ClubCalendar, PL=ClubPlan, SRS=ClubSRS, BKT=ClubBKT, SYNC=ClubSync, REM=ClubReminder, SCAN=ClubScanner, FEAT=ClubFeatures;
const VER='club-1.1';
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const view=()=>$('#view');
const K={cal:'nch2_club_cal',done:'nch2_club_done',ii:'nch2_club_ii',ev:'nch2_club_ev',rep:'nch2_rep',train:'nch2_club_train',diag:'nch2_club_diag',mock:'nch2_club_mock',me:'nch2_club_me',seen:'nch2_club_seen'};
let CFG=null, ME=null, CORE=null, OFFLINE=false;

/* ── хранилище: любое изменение помечает ключ временем (для слияния) и ставит синхронизацию в очередь ── */
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return null; } };
const LS={
  get(k,d){ try{ const v=localStorage.getItem(k); if(v===null) return d; const p=JSON.parse(v); return p===null?d:p; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); if(SYNC.syncable(k)){ const mt=J(localStorage.getItem('nch2_club_mt'))||{}; mt[k]=Date.now(); localStorage.setItem('nch2_club_mt',JSON.stringify(mt)); markDirty(); } }catch(e){ toast('Хранилище браузера недоступно'); } },
  device(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
};

/* ── сеть ── */
async function api(method,path,body){
  const h={'Accept':'application/json'}; if(body!==undefined) h['Content-Type']='application/json'; if(ME&&ME.csrf&&method!=='GET') h['X-CSRF-Token']=ME.csrf;
  let r; try{ r=await fetch(path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',cache:'no-store'}); }
  catch(e){ const err=new Error('Нет сети'); err.offline=true; throw err; }
  let data={}; try{ data=await r.json(); }catch(e){}
  if(!r.ok){ const err=new Error(data.error||('Ошибка '+r.status)); err.status=r.status; err.data=data; if(r.status===401&&data.login&&ME){ ME=null; route(); } throw err; }
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
  n.className='net'+(off||syncErr?' off':''); n.textContent=!ME?'':off?'офлайн · сохранится позже':syncErr?'не сохранено':syncing?'сохраняю…':isDirty()?'есть несохранённое':lastSync?'сохранено':''; n.title=syncErr||''; }
addEventListener('online',()=>{ if(OFFLINE) boot(); else syncNow(); netState(); });
addEventListener('offline',netState);
setInterval(()=>{ if(isDirty()) syncNow(); },60e3);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden'&&isDirty()) syncNow(); });

/* ── общее ── */
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),3200); }
function paint(root){ $$('[data-w]',root).forEach(el=>{ el.style.width=Math.max(0,Math.min(100,+el.dataset.w))+'%'; }); }
function render(html,title){ const v=view(); v.innerHTML=html; paint(v); if(title) document.title=title+' · Клуб Начерта'; tabs(); netState(); }
function openSheet(html,onBind){ closeSheet(); const bg=document.createElement('div'); bg.className='sheet-bg'; bg.id='sheet';
  bg.innerHTML='<div class="sheet-p" role="dialog" aria-modal="true">'+html+'</div>'; document.body.appendChild(bg);
  bg.addEventListener('click',e=>{ if(e.target===bg||e.target.closest('[data-close]')) closeSheet(); }); paint(bg); const f=$('input,textarea,button',bg); if(f) f.focus(); if(onBind) onBind(bg); return bg; }
function closeSheet(){ const s=$('#sheet'); if(s) s.remove(); }
addEventListener('keydown',e=>{ if(e.key==='Escape') closeSheet(); });
const today=()=>CAL.browserToday(), dayNum=()=>CAL.toDay(today());
const week1=()=>(ME&&ME.week1)||(CFG&&CFG.week1)||CAL.DEFAULT_WEEK1;
const calSet=()=>LS.get(K.cal,{});
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
  plus:'<path d="M12 5v14M5 12h14"/>'
};
const ic=n=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||''}</svg>`;
function fbBtn(f){ return `<button class="fb" type="button" data-act="fb" data-f="${esc(f)}" aria-label="Отзыв о функции">${ic('fb')}Отзыв</button>`; }
function why(html){ return html?`<details class="why"><summary>Почему так</summary><p>${html}</p></details>`:''; }
/* карточка функции: значок, заголовок, кнопка «Отзыв», содержимое, «почему так» */
function card(f,title,inner,whyHtml,o){ o=o||{};
  return `<section class="card${o.navy?' navy':''}${o.tri?' tri':''}" data-feature="${esc(f)}"><div class="ch">${o.icon?`<span class="ico ${o.tone||''}">${ic(o.icon)}</span>`:''}<h2>${title}${o.sub?`<small>${o.sub}</small>`:''}</h2>${f?fbBtn(f):''}</div>${inner}${why(whyHtml)}</section>`; }
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

/* ── вход через бота ──
   1) «Войти через Telegram» → сервер даёт одноразовую ссылку на бота; 2) в Telegram — «Старт», затем «Войти»;
   3) страница раз в 2 секунды спрашивает сервер, подтверждён ли вход. Никаких окон Telegram на сайте, номер телефона не нужен. */
let LOGIN=null;
async function afterLogin(r){ LOGIN=null; ME=Object.assign({},ME||{},{csrf:r.csrf}); const local=SYNC.readLocal(localStorage), had=Object.keys(local.data).length;
  await loadMe(); const ok=await syncNow();
  try{ sessionStorage.removeItem('club_invite'); }catch(e){}
  if(r.isNew&&had&&ok) toast('Прогресс с этого устройства перенесён в аккаунт'); else if(r.isNew) toast('Добро пожаловать в клуб!');
  if(r.isNew) LS.device('nch2_club_onboard',1);
  location.hash='#/'; route(); }
async function loadMe(){ const m=await api('GET','/api/me'); ME=m; const c=Object.assign({},m); delete c.csrf; LS.device(K.me,c); return m; }
function consentBlock(){ return `<div class="consent">
  <label class="chk"><input type="checkbox" id="cTerms"><span>Принимаю <a href="legal/terms.html" target="_blank" rel="noopener">пользовательское соглашение</a> и <a href="legal/privacy.html" target="_blank" rel="noopener">политику обработки персональных данных</a></span></label>
  <label class="chk"><input type="checkbox" id="cPd"><span>Даю <a href="legal/consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a><small>Берём только Telegram id и имя</small></span></label>
  <label class="chk"><input type="checkbox" id="cPhotos"><span>Разрешаю использовать мои фото чертежей для улучшения проверки<small>Необязательно, можно изменить в настройках</small></span></label>
</div>`; }
const consentVal=root=>({terms:!!($('#cTerms',root)||{}).checked,pd:!!($('#cPd',root)||{}).checked,photos:!!($('#cPhotos',root)||{}).checked});
const getInvite=()=>{ try{ return sessionStorage.getItem('club_invite')||undefined; }catch(e){ return undefined; } };
function authIdle(){ return `<button class="btn white lg" type="button" data-act="botLogin"><span class="tgmark">${ic('tg')}</span>Войти через Telegram</button><div id="authMsg" aria-live="polite"></div>`; }
async function botLogin(needConsent){
  const box=$('#auth'), msg=$('#authMsg'); let consent;
  if(needConsent){ consent=consentVal(); if(!(consent.terms&&consent.pd)){ msg.innerHTML='<p class="note bad">Отметьте соглашение и согласие на обработку данных.</p>'; return; } }
  let s; try{ s=await api('POST','/api/auth/bot/start',{invite:getInvite(),consent}); }
  catch(e){ msg.innerHTML=`<p class="note bad">${esc(e.message)}</p>`; return; }
  /* срок — от часов этого устройства: часы телефона могут расходиться с сервером */
  const me={token:s.token,exp:Date.now()+(s.ttl||600e3),consent:null}; LOGIN=me;
  box.innerHTML=`<div class="wait"><ol><li class="on" id="w1"><span>Откройте бота <b>@${esc(s.bot)}</b> в Telegram</span></li><li id="w2"><span>Нажмите «Старт»</span></li><li id="w3"><span>В сообщении бота нажмите «Войти»</span></li></ol>
    <div class="row"><a class="btn white lg" href="${esc(s.link)}" target="_blank" rel="noopener noreferrer" id="openBot"><span class="tgmark">${ic('tg')}</span>Открыть бота</a><button class="btn ghost" type="button" data-act="loginCancel">Отмена</button></div>
    <div class="status"><span class="spin" aria-hidden="true"></span><span id="wst">Ждём подтверждения в Telegram…</span></div>
    <p class="lnk">Telegram на телефоне? Откройте там ссылку: <span id="wlink">${esc(s.link)}</span> <button class="btn sm ghost" type="button" data-act="copy" data-t="#wlink">Скопировать</button></p>
    ${CFG.devBot?`<div class="devbox"><b>Эмуляция бота</b> (только локально): нажать «Старт» и «Войти» за участника.<div class="grid2 reg"><input id="dvId" type="text" inputmode="numeric" value="1000002" aria-label="Telegram id"><input id="dvName" type="text" value="Тестировщик" aria-label="Имя"></div><div class="row reg"><button class="btn sm white" type="button" data-act="devBot">В боте: «Старт» и «Войти»</button></div><small>1000001 — владелец клуба.</small></div>`:''}
    </div><div id="authMsg" aria-live="polite"></div>`;
  pollLogin(me); }
async function pollLogin(me){
  while(LOGIN===me){
    if(Date.now()>me.exp+5000){ loginFail('Время на вход вышло. Нажмите «Войти через Telegram» ещё раз.'); return; }
    try{ const r=await api('POST','/api/auth/bot/poll',{token:me.token,consent:me.consent||undefined});
      if(LOGIN!==me) return;
      if(r.csrf){ $$('.wait li').forEach(l=>l.className='ok'); await afterLogin(r); return; }
      const st=$('#wst'); if(r.status==='asked'){ ['w1','w2'].forEach(i=>{ const l=$('#'+i); if(l) l.className='ok'; }); const l3=$('#w3'); if(l3) l3.className='on'; if(st) st.textContent='Осталось нажать «Войти» в сообщении бота'; } }
    catch(e){ if(LOGIN!==me) return;
      if(e.data&&e.data.needConsent){ askConsent(me); return; }
      if(!e.offline){ loginFail(e.message+(e.data&&e.data.needInvite?' Новых участников клуб принимает только по ссылке-приглашению.':'')); return; } }
    await new Promise(r=>setTimeout(r,2000)); } }
function loginFail(text){ LOGIN=null; const box=$('#auth'); if(!box) return; box.innerHTML=authIdle(); $('#authMsg').innerHTML=`<p class="note bad">${esc(text)}</p>`; }
/* владелец или участник без отметок входит со страницы входа — согласие спрашивается, подтверждённый вход не тратится */
function askConsent(me){ openSheet(`<h2>Первый вход</h2><p class="mut">Перед созданием аккаунта отметьте документы.</p>${consentBlock()}<div id="caMsg"></div><div class="row"><button class="btn pri grow" id="caGo" type="button">Продолжить</button><button class="btn" data-close type="button">Отмена</button></div>`,
  bg=>{ $('#caGo',bg).addEventListener('click',()=>{ const c=consentVal(bg); if(!(c.terms&&c.pd)){ $('#caMsg',bg).innerHTML='<p class="note bad">Отметьте соглашение и согласие.</p>'; return; }
    me.consent=c; closeSheet(); pollLogin(me); }); }); }
const FEATS=[['cal','','Календарь сдач','ДЗ, РК и закрытие модулей ИКГ и начерта — по неделям вашей группы'],['plan','red','Обратный план','От дня РК назад: диагностика, слабые темы, пробный РК'],
  ['train','green','Тренировка дня','15–20 минут: повтор по интервалам и задача вперемешку'],['skills','amber','Карта навыков','Что уже освоено и какие задачи решить дальше']];
function loginView(){ LOGIN=null; render(`<section class="hero"><span class="pill">Закрытое тестирование</span><h1>Клуб Начерта</h1>
  <p>Личный кабинет студента: сроки ДЗ и РК, план подготовки и тренировка — на задачах тетради с <a href="${esc(mainUrl())}" rel="noopener">nachert1830.ru</a>.</p>
  <div class="auth" id="auth">${authIdle()}</div><p class="mut">Новых участников клуб принимает только по личной ссылке-приглашению.</p></section>
  <div class="feats">${FEATS.map(([i,t,b,p])=>`<div class="feat"><span class="ico ${t}">${ic(i)}</span><b>${b}</b><p>${p}</p></div>`).join('')}</div>
  <p class="foot"><a href="legal/terms.html">Соглашение</a> · <a href="legal/privacy.html">Персональные данные</a> · <a href="legal/consent.html">Согласие</a></p>`,'Вход'); }
async function inviteView(){ const code=getInvite(); let st={valid:false,why:'Нет приглашения.'};
  render('<p class="mut">Проверяю приглашение…</p>','Приглашение');
  try{ st=await api('GET','/api/invite/check?code='+encodeURIComponent(code||'')); }catch(e){ st={valid:false,why:e.message}; }
  if(!st.valid){ render(`<section class="hero"><span class="pill red">Приглашение не подходит</span><h1>Клуб Начерта</h1><p>${esc(st.why)} Если вы уже участник — войдите как обычно.</p><div class="auth" id="auth">${authIdle()}</div></section>`,'Приглашение'); try{ sessionStorage.removeItem('club_invite'); }catch(e){} return; }
  render(`<section class="hero"><span class="pill">Личное приглашение</span><h1>Вас пригласили в клуб</h1>
    <p>Клуб — закрытое тестирование нового кабинета Начерта. Берём минимум: Telegram id и имя, плюс ваш прогресс. Данные — в России.</p>
    <div class="auth" id="auth"><div class="reg">${consentBlock()}</div><div class="row reg"><button class="btn white lg" type="button" data-act="botLogin" data-need="1"><span class="tgmark">${ic('tg')}</span>Войти через Telegram</button></div><div id="authMsg" aria-live="polite"></div></div></section>
  <div class="feats">${FEATS.map(([i,t,b,p])=>`<div class="feat"><span class="ico ${t}">${ic(i)}</span><b>${b}</b><p>${p}</p></div>`).join('')}</div>`,'Приглашение'); }

/* ── «Сегодня» ── */
function todayView(){ const t=today(), td=dayNum(), evs=CAL.upcoming(calSet(),week1(),t,5), wk=CAL.weekOf(week1(),t), done=doneMap();
  const steps=PL.todaySteps(events(),t,done,21), tr=trainingToday(), onboard=LS.get('nch2_club_onboard',0), next=evs[0], p=dparts(t);
  const wkText=wk>=1&&wk<=17?wk+'-я неделя':wk<1?'до семестра':'семестр закончился';
  render(`<section class="hero"><div class="hero-row"><div><span class="pill">${esc(wkText)} · ${esc(p.wd)}, ${p.d} ${esc(p.mon)}</span><h1>Привет, ${esc(ME.user.name)}</h1>
      <p>${next?'Ближайшее — '+esc(next.title)+', '+esc(CAL.human(next.date))+'.':'Событий в таблице больше нет.'} ${steps.length?'По плану сегодня — '+steps.length+' '+plural(steps.length,'шаг','шага','шагов')+'.':''}</p></div>
    ${next?`<div class="count"><b>${next.inDays}</b><span>${plural(next.inDays,'день','дня','дней')} до ${esc(next.short)} · ${esc(next.subjTitle)}</span></div>`:''}</div></section>
  ${onboard?`<section class="card tri"><div class="ch"><span class="ico">${ic('info')}</span><h2>С чего начать</h2><button class="fb" data-act="onboardOff" type="button">Скрыть</button></div><ol class="lead"><li>Укажите <a href="#/calendar">день занятий</a> по каждому предмету — от него считаются даты.</li><li>Есть прогресс на nachert1830.ru? Перенесите его: <a href="#/settings">Настройки → Перенести прогресс</a>.</li><li>Включите <a href="#/settings">напоминания</a> в Telegram, если удобно.</li></ol></section>`:''}
  <div class="grid"><div class="col">
    ${flag('training')?card('training','Тренировка дня',`<p class="lead">${tr.items.length?(tr.left?'Осталось '+tr.left+' из '+tr.items.length+' · ≈ '+tr.minutes+' мин':'На сегодня всё сделано'):'Повторять пока нечего — начните с карты навыков.'}</p>${tr.items.length&&tr.left?`<div class="bar"><i data-w="${(tr.items.length-tr.left)/tr.items.length*100}"></i></div>`:''}<div class="row reg"><a class="btn cta lg" href="#/train">${tr.left?'Начать тренировку':'Открыть'} ${ic('arrow')}</a></div>`,'',{icon:'train',tone:'green',sub:'повтор по интервалам + задача вперемешку'}):''}
    ${flag('plan')?card('plan','По плану сегодня',steps.length?`<ol class="todo">${steps.map(s=>`<li class="${s.done?'done':''}"><span class="dot">${s.event?'◆':ic('target')}</span><div class="st"><b>${esc(s.ev.short+' '+s.ev.subjTitle)} · ${esc(s.title)}</b><small>${s.min?'≈ '+s.min+' мин':''}</small><div class="what">${esc(s.what)}</div><a href="#/event/${s.ev.id}">К плану →</a></div></li>`).join('')}</ol>`:'<p>На сегодня по обратному плану ничего. Хороший день для тренировки.</p>','',{navy:true,icon:'plan'}):''}
  </div><div class="col">
    ${flag('calendar')?card('calendar','Ближайшее',evs.length?`<div class="evl">${evs.map(e=>evRow(e,td)).join('')}</div><div class="row reg"><a class="btn ghost sm" href="#/calendar">Весь календарь ${ic('arrow')}</a></div>`:'<p class="mut">В таблице больше нет событий.</p>','',{icon:'cal'}):''}
  </div></div>`,'Сегодня'); }

/* ── календарь ── */
function calendarView(){ const s=CAL.normSettings(calSet()), t=dayNum(), wkNow=CAL.weekOf(week1(),today());
  const wd=[1,2,3,4,5,6].map(d=>[d,['','понедельник','вторник','среда','четверг','пятница','суббота'][d]]);
  const ws=CAL.weeks(calSet(),week1(),17).map(w=>`<div class="wk${w.week===wkNow?' now':''}"><div class="n">${w.week}<small>${dparts(w.start).d} ${dparts(w.start).mon}</small>${w.week===wkNow?'<span class="nowtag">СЕЙЧАС</span>':''}</div>
    <div class="es">${w.events.map(e=>`<a class="chip${CAL.toDay(e.date)<t?' past':''}" href="#/event/${e.id}">${tagOf(e)}${esc(e.subjTitle)}${e.custom?' · '+esc(CAL.human(e.date)):''}</a>`).join('')||'<small>—</small>'}</div></div>`).join('');
  render(`${pageHead('Календарь сдач','Неделя в таблице — неделя крайнего срока. РК пишется один раз и только на своей неделе; М — закрытие модуля.')}
  <div class="grid"><div class="col">
    ${card('calendar','Моя группа',`<div class="grid2">${['ikg','ng'].map(k=>`<div><label class="f" for="cd-${k}">Занятие по ${k==='ikg'?'ИКГ':'начерту'}</label><select id="cd-${k}" data-chg="classDay" data-s="${k}">${wd.map(([d,n])=>`<option value="${d}"${s.classDay[k]===d?' selected':''}>${n}</option>`).join('')}</select></div>`).join('')}</div>
      <label class="f">Предметы</label><div class="grid2">${['ikg','ng'].map(k=>`<label class="chk"><input type="checkbox" data-chg="subj" data-s="${k}"${s.subjects.includes(k)?' checked':''}><span>${k==='ikg'?'ИКГ':'Начерт'}</span></label>`).join('')}</div>
      <p class="mut">От дня занятия считаются даты событий; точную дату РК можно поставить в самом событии. Неделя 1 начинается ${esc(CAL.human(week1()))}.</p>`,
      'срок, привязанный к конкретному дню, планируется точнее, чем «где-то на неделе», — а запас до него защищает от ошибки планирования (Buehler и др., 1994).',{icon:'user'})}
  </div><div class="col"><section class="card"><div class="ch"><span class="ico">${ic('cal')}</span><h2>Недели семестра</h2></div><div class="weeks">${ws}</div></section></div></div>`,'Календарь'); }

/* ── событие и обратный план ── */
function stepLi(s,i){ const range=s.from&&s.to&&s.from!==s.to?esc(CAL.human(s.from))+' – '+esc(CAL.human(s.to)):esc(CAL.human(s.date));
  const cls=[s.when==='today'?'today':'',s.done?'done':'',s.event?'ev-day':'',s.buffer?'buf':''].join(' ');
  const dot=s.event?'◆':s.buffer||(s.days&&!s.key)?'·':`${s.done?ic('check'):`<span class="nn">${i+1}</span>`}<input type="checkbox" data-chg="step" data-k="${esc(s.key)}"${s.done?' checked':''} aria-label="Отметить сделанным: ${esc(s.title)}" title="Отметить сделанным">`;
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
  if(e.kind==='dz'&&s.k==='check'&&e.subj==='ikg'&&flag('normo')) return `<a class="btn sm" href="#/check">Предпроверка листа</a>`;
  if(e.kind==='dz'&&s.k==='read') return ext(mainUrl(e.subj==='ng'?'#/ng/hw':'#/ig/hw2'),'Разборы ДЗ на сайте');
  return ''; }
function eventView(id,sub){ const e=events().find(x=>x.id===id); if(!e){ render('<p class="note bad">Нет такого события.</p>'); return; }
  if(sub==='diag') return diagView(e); if(sub==='mix') return mixView(e); if(sub==='mock') return mockView(e);
  const p=PL.plan(e,today(),doneMap()); p.steps.forEach(s=>{ s.evObj=e; });
  const ii=LS.get(K.ii,{})[e.id]||{}, t=dayNum(), k=CAL.toDay(e.date)-t, dp=dparts(e.date);
  render(`${pageHead(esc(e.title),'',['#/calendar','Календарь'])}
  <section class="hero"><div class="hero-row"><div><span class="pill${e.kind==='rk'?' red':''}">${esc(e.kindFull)} · неделя ${e.week}</span><h1>${dp.wd}, ${dp.d} ${dp.mon}</h1><p>Неделя ${e.week}: ${esc(CAL.human(e.start))} – ${esc(CAL.human(e.end))}. ${e.kind==='rk'?'РК пишется один раз и только на этой неделе.':'Крайний срок — на этой неделе.'}</p></div>
    <div class="count"><b>${k<0?'—':k}</b><span>${k<0?'событие прошло':plural(k,'день','дня','дней')+' осталось'}</span></div></div></section>
  <div class="grid"><div class="col">
    ${flag('plan')?card('plan','Обратный план',p.over?'<p class="mut">Событие прошло.</p>':`${p.late?'<p class="note warn">План сокращён: времени меньше, чем нужно по полной схеме. Ничего не выброшено — шаги сдвинуты на ближайшие дни.</p>':''}<p class="mut">Нажмите на кружок шага, чтобы отметить его сделанным.</p><ol class="steps">${groupMix(p.steps).map(stepLi).join('')}</ol>`,
      e.kind==='rk'?'диагностика показывает, что тренировать (проверка себя, Roediger, Karpicke, 2006); задачи вперемешку учат выбирать способ (Rohrer, Taylor, 2007); пробный РК на время переносит навык в формат экзамена; накануне — без новых тем, сон закрепляет выученное.'
      :e.kind==='dz'?'большое задание, разбитое на этапы с датами, реже откладывается; запас перед сроком — защита от ошибки планирования (Buehler, Griffin, Ross, 1994).':'сверка за неделю оставляет время исправить замечания до закрытия модуля.',{icon:'plan',tone:e.kind==='rk'?'red':e.kind==='m'?'green':''}):''}
  </div><div class="col">
    <section class="card"><div class="ch"><span class="ico">${ic('cal')}</span><h2>${e.kind==='rk'?'День РК в моей группе':e.kind==='dz'?'День сдачи в моей группе':'День закрытия модуля'}</h2></div>
      <div class="row"><input id="evd" class="grow" type="date" min="${e.start}" max="${e.end}" value="${e.date}" data-chg="evDate" data-id="${e.id}" aria-label="Дата события">${e.custom?`<button class="btn sm" type="button" data-act="evDateReset" data-id="${e.id}">По дню занятия</button>`:''}</div>
      <p class="mut">Можно выбрать только день внутри недели ${e.week}.</p></section>
    ${flag('plan')?card('plan','Когда — где — что',`<p class="mut">Одно конкретное намерение: «Если <i>когда</i>, <i>где</i>, то я <i>что</i>». Напоминание в Telegram покажет его.</p>
      <form id="iiForm" data-id="${e.id}"><label class="f" for="iiW">Когда</label><input id="iiW" type="text" maxlength="60" placeholder="в четверг после пар, 17:30" value="${esc(ii.when||'')}">
      <label class="f" for="iiP">Где</label><input id="iiP" type="text" maxlength="60" placeholder="в читальном зале, 3-й этаж" value="${esc(ii.where||'')}">
      <label class="f" for="iiT">Что именно</label><input id="iiT" type="text" maxlength="120" placeholder="${e.kind==='rk'?'решаю задачи 52 и 57 без подсказок':'делаю черновик видов спереди и сверху'}" value="${esc(ii.what||'')}">
      <div class="row reg"><button class="btn pri" type="submit">Сохранить</button>${ii.what?'<button class="btn ghost" type="button" data-act="iiClear" data-id="'+e.id+'">Очистить</button>':''}</div></form>
      ${ii.what?`<div class="ii"><span class="lbl">Ваше намерение</span><q>Если ${esc(ii.when||'…')}${ii.where?', '+esc(ii.where):''}, то я ${esc(ii.what)}.</q></div>`:''}`,
      'конкретный план «когда — где — что» заметно повышает шанс, что дело будет сделано (implementation intentions, Gollwitzer, Sheeran, 2006: метаанализ 94 исследований, d ≈ 0,65).',{icon:'target',tone:'red'}):''}
  </div></div>`,e.title);
  const f=$('#iiForm'); if(f) f.addEventListener('submit',ev=>{ ev.preventDefault(); const m=LS.get(K.ii,{}); m[e.id]={when:$('#iiW').value.trim(),where:$('#iiP').value.trim(),what:$('#iiT').value.trim(),t:Date.now()};
    if(!m[e.id].what){ toast('Напишите, что именно будете делать'); return; } LS.set(K.ii,m); toast('План сохранён'); eventView(e.id); }); }

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
    <div class="reg">${body}</div>${n===all?`<p class="note ok reg">Диагностика пройдена. Слабые темы — на <a href="#/skills">карте навыков</a>; они пойдут в план «вперемешку».</p>`:''}`,'Диагностика'); }
function mixView(e){ let items=[];
  if(e.subj==='ng'){ const rec=BKT.recommend(estimate(),CORE.tasks,LS.get(K.rep,{}),CORE.rkTopics[e.n]||[],3); items=rec.map(r=>r.tasks[0]).filter(Boolean); }
  render(`${pageHead('Слабые темы вперемешку',e.subj==='ng'?'Три задачи из самых слабых тем РК, разных типов подряд. Сначала определите способ, потом решайте.':'Тренажёр «Нормоконтроль» на сайте и предпроверка своего листа — по слабым группам правил.',['#/event/'+e.id,'План '+e.short+' · '+e.subjTitle])}
    <div>${e.subj==='ng'?items.map(n=>taskCard(n,'mix:'+e.id,null,'вперемешку')).join('')||'<p class="empty">Все темы РК освоены — повторяйте по тренировке дня.</p>':`<div class="row">${ext(mainUrl('#/ig/nk'),'Нормоконтроль','btn')}${flag('normo')?'<a class="btn pri" href="#/check">Предпроверка листа</a>':''}</div>`}</div>
    ${why('когда тип задачи заранее неизвестен, мозг учится главному для РК — выбирать способ (Rohrer, Dedrick, Stershic, 2015).')}`,'Вперемешку'); }
function mockView(e){ const m=LS.get(K.mock,{})[e.id]||{}, href=e.subj==='ng'?(e.n===2?'#/ng/rk2/mock':e.n===1?'#/ng/check':'#/ng/check/tickets'):'#/ig/nk';
  const left=m.start&&!m.end?Math.max(0,m.start+(m.min||90)*60e3-Date.now()):0;
  render(`${pageHead('Пробный РК на время','Билет целиком, без подсказок и разборов, с таймером. Потом — сверка и самооценка в тренировке.',['#/event/'+e.id,'План '+e.short+' · '+e.subjTitle])}
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
  let rep=LS.get(K.rep,{}); rep=SRS.rate(rep,n,v,d); LS.set(K.rep,rep);
  const evs=BKT.fromRating({id:'c'+now.toString(36)+n,t:now,task:n,topic:t.topic,rating:v,errors,symptoms:(CORE.symptoms||[]).filter(s=>symptoms.includes(s.id)),src:ctx.split(':')[0]});
  LS.set(K.ev,BKT.merge(LS.get(K.ev,[]),evs));
  if(ctx==='train'){ const tr=LS.get(K.train,{}); if(tr.day===d){ tr.res=tr.res||{}; tr.res[n]=v; LS.set(K.train,tr); } trainView(); }
  else if(ctx.startsWith('diag:')){ const id=ctx.slice(5), st=LS.get(K.diag,{}); if(st[id]){ st[id].res[n]=v; LS.set(K.diag,st); if(Object.keys(st[id].res).length>=st[id].items.length) setDone(id+':diag',true); }
    const e=events().find(x=>x.id===id); if(e) diagView(e); }
  else if(ctx.startsWith('mix:')){ toast('Сохранено'); const id=ctx.slice(4); const e=events().find(x=>x.id===id); if(e) mixView(e); }
  else skillsView(); }

/* ── тренировка дня ── */
function trainingToday(){ const d=dayNum(); let tr=LS.get(K.train,{});
  if(tr.day!==d||!Array.isArray(tr.items)){ if(!CORE) return {items:[],minutes:0,left:0};
    const est=estimate(), x=SRS.training(LS.get(K.rep,{}),d,CORE.tasks.filter(t=>t.topic),tp=>BKT.mastery(est,tp),focusTopics(),d);
    tr={day:d,items:x.items,minutes:x.minutes,res:{},later:x.later}; LS.set(K.train,tr); }
  const left=tr.items.filter(i=>tr.res==null||tr.res[i.n]==null).length; return Object.assign({},tr,{left}); }
function trainView(){ const tr=trainingToday(), f=focusTopics(), rk=nextRk('ng',21), r=tr.items.filter(i=>i.kind==='review').length;
  render(`<section class="hero"><div class="hero-row"><div><span class="pill">Тренировка дня · ≈ ${tr.minutes||0} мин</span><h1>${tr.items.length?(tr.left?'Осталось '+tr.left+' из '+tr.items.length:'На сегодня всё'):'Повторять пока нечего'}</h1>
    <p>${tr.items.length?[r?r+' '+plural(r,'задача','задачи','задач')+' на повтор по интервалам':'',tr.items.length-r?'одна задача вперемешку'+(rk&&f.length?' — из тем '+esc(rk.short)+' по начерту':''):''].filter(Boolean).join(' и ')+'.':'Начните с рекомендаций на карте навыков — задачи вернутся сюда по интервалам.'}${tr.later?' Ещё '+tr.later+' ждут завтра: больше трёх повторов в день — перегрузка.':''}</p></div>
    ${tr.items.length?`<div class="count"><b>${tr.items.length-tr.left}/${tr.items.length}</b><span>сделано сегодня</span></div>`:''}</div></section>
  <section class="card reg"><div class="ch"><span class="ico">${ic('info')}</span><h2>Как тренироваться<small>2 шага на задачу</small></h2>${fbBtn('training')}</div>
    <ol class="lead"><li>Откройте задачу на сайте в режиме «Решаю сам» и решите на бумаге.</li><li>Вернитесь и честно отметьте, как получилось.</li></ol>
    ${why('вспоминать, а не перечитывать (Roediger, Karpicke, 2006); возвращать задачу через растущие интервалы 1 → 3 → 7 → 16 → 35 дней (Cepeda и др., 2006); одна задача другого типа учит выбирать способ (Rohrer, Taylor, 2007). 15–20 минут в день лучше, чем вечер перед РК.')}</section>
  <div class="reg">${tr.items.map(i=>taskCard(i.n,'train',tr.res&&tr.res[i.n],i.kind==='review'?'повтор':'вперемешку')).join('')||`<div class="empty">${ic('train')}<p>Здесь появятся задачи. <a href="#/skills">Карта навыков →</a></p></div>`}</div>
  ${tr.items.length&&!tr.left?'<p class="note ok reg">Готово. Следующие задачи вернутся по интервалам.</p>':''}`,'Тренировка дня'); }

/* ── карта навыков ── */
function skillsView(){ const est=estimate(), rep=LS.get(K.rep,{}), f=focusTopics(), rec=BKT.recommend(est,CORE.tasks,rep,f,3);
  const all=[...new Set([].concat(CORE.rkTopics[1]||[],CORE.rkTopics[2]||[],CORE.rkTopics[3]||[]))];
  const cnt={master:0,mid:0,low:0}; all.forEach(s=>{ const o=est[s]; if(!o||!o.n) return; const lv=BKT.level(BKT.mastery(est,s),o.n).id; if(lv==='master') cnt.master++; else if(lv==='low') cnt.low++; else cnt.mid++; });
  const row=s=>{ const o=est[s]||{}, p=BKT.mastery(est,s), lv=BKT.level(p,o.n);
    return `<div class="sk"><div class="h"><b>${esc(topicTitle(s))}</b><span class="lv ${lv.id}">${esc(lv.t)}</span></div><div class="bar"><i class="${lv.id}" data-w="${Math.max(3,Math.round(p*100))}"></i></div><small>${o.n?'освоено на '+Math.round(p*100)+' % · наблюдений: '+o.n:'данных пока нет'}</small></div>`; };
  const seen=new Set();
  render(`<section class="hero"><span class="pill">Карта навыков · ${all.length} тем начерта</span><h1>Что уже получается</h1><p>Оценка обновляется после каждой самооценки в тренировке и диагностике.</p>
    <div class="stats reg"><div class="stat"><b>${cnt.master}</b><span>освоено</span></div><div class="stat"><b>${cnt.mid}</b><span>в процессе</span></div><div class="stat"><b>${cnt.low}</b><span>слабые места</span></div></div></section>
  <div class="grid"><div class="col">
    ${card('skills','Что тренировать',rec.length?`<ul class="rec">${rec.map(r=>`<li><b>${esc(topicTitle(r.skill))}</b> <span class="lv ${BKT.level(r.p,r.n).id}">${Math.round(r.p*100)} %</span><div class="row">${r.tasks.map(n=>ext(mainUrl('#/ng/tasks/'+n+'/try'),'№'+n)).join('')||'<small>Все задачи темы уже в повторении.</small>'}${r.tasks.length?`<button class="btn sm pri" type="button" data-act="addTrain" data-n="${r.tasks.join(',')}">${ic('plus')}В тренировку</button>`:''}</div></li>`).join('')}</ul>`:'<p class="mut">Все навыки освоены — повторяйте по интервалам.</p>',
      'каждая самооценка — наблюдение. Оценка — Bayesian Knowledge Tracing (Corbett, Anderson, 1995): вероятность «навык освоен» обновляется по формуле Байеса с учётом промаха (знал, но ошибся, 10 %) и угадывания (20 %); освоено — от 95 %. «С подсказкой» считается ошибкой, описка — нет. Отмеченные ошибки снижают оценку своего навыка, а не только темы задачи.',{icon:'target',tone:'red',sub:f.length?'сначала темы ближайшего РК':'самые слабые темы'})}
    <section class="card"><div class="ch"><span class="ico amber">${ic('sheet')}</span><h2>ИКГ · лист по ГОСТ<small>из предпроверки листов и диагностики</small></h2></div>${BKT.IKG_SKILLS.filter(s=>s.id!=='ikg-model'||est[s.id]).map(s=>row(s.id)).join('')}</section>
  </div><div class="col">
    ${[1,2,3].map(k=>`<section class="card"><div class="ch"><span class="ico">${ic('skills')}</span><h2>Начерт · РК${k}</h2></div>${(CORE.rkTopics[k]||[]).filter(s=>!seen.has(s)&&seen.add(s)).map(row).join('')||'<small>—</small>'}</section>`).join('')}
  </div></div>`,'Карта навыков'); }

/* ── проверка: фото и нормоконтроль ── */
function checkView(){
  render(`${pageHead('Проверка','Сверить своё решение и лист до сдачи.',['#/more','Ещё'])}
  <div class="grid"><div class="col">
    ${flag('normo')?card('normo','Предпроверка листа ДЗ ИКГ',`<p>Загрузите лист в формате SVG (экспорт из САПР) — нормоконтроль основного сайта проверит формат, рамку, основную надпись, линии, шрифт, виды и разрезы, штриховку и размеры.</p>
      <label class="f" for="nkF">Лист SVG</label><input id="nkF" type="file" accept=".svg,image/svg+xml">
      <div class="row reg"><button class="btn pri" type="button" data-act="normo">Проверить мой лист</button></div>
      <p class="mut reg">Или образцы ДЗ 2:</p><div class="samples"><button class="btn sm" type="button" data-act="normoSample" data-s="ig-v5-clean">верный лист</button><button class="btn sm" type="button" data-act="normoSample" data-s="ig-v8-thin">ошибка в линиях</button><button class="btn sm" type="button" data-act="normoSample" data-s="ig-v12-numline">ошибка в размерах</button></div>
      <div id="nkOut" aria-live="polite"></div>`,
      'привычка нормоконтролёра — пройти лист по списку правил до сдачи — переносится на свой лист и снимает «слепоту автора» (Metcalfe, 2017). Это предпроверка: она не заменяет преподавателя. Результат своего листа попадает в карту навыков ИКГ.',{icon:'sheet',tone:'amber',sub:'ГОСТ 2.301–2.307, 2.104'}):''}
  </div><div class="col">
    ${flag('scanner')?card('scanner','Проверь решение по фото',`<p class="note warn">Сканер ещё не подключён: сейчас здесь заглушка, которая честно отвечает «не знаю». Фото обрабатывается на устройстве и никуда не отправляется.</p>
      <label class="f" for="scN">Номер задачи</label><input id="scN" type="number" min="1" max="89" inputmode="numeric" placeholder="например, 52">
      <label class="f" for="scF">Фото решения</label><input id="scF" type="file" accept="image/*" capture="environment">
      <div class="row reg"><button class="btn pri" type="button" data-act="scan">Проверить</button></div><div id="scOut" aria-live="polite"></div>`,
      'быстрая обратная связь сразу после попытки полезнее отложенной (Hattie, Timperley, 2007). Подключение: <code>scan(фото, задача) → вердикт</code>, lib/scanner.js.',{icon:'scan'}):''}
  </div></div>
  ${!flag('scanner')&&!flag('normo')?'<p class="empty">Раздел сейчас выключен.</p>':''}`,'Проверка'); }

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
    if(own){ LS.set(K.ev,BKT.merge(LS.get(K.ev,[]),BKT.fromNormo({id:'n'+Date.now().toString(36),t:Date.now(),issues:r.issues}))); out.insertAdjacentHTML('beforeend','<p class="mut">Результат учтён в <a href="#/skills">карте навыков ИКГ</a>.</p>'); } }
  catch(e){ out.innerHTML=`<p class="note bad reg">Не получилось проверить: ${esc(e.message)}</p>`; } }

/* ── настройки ── */
function settingsView(){ const u=ME.user, r=ME.reminders||REM.DEFAULTS, tz=(()=>{ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone; }catch(e){ return 'Europe/Moscow'; } })();
  const tzs=[...new Set([r.tz,tz,'Europe/Moscow','Europe/Kaliningrad','Europe/Samara','Asia/Yekaterinburg','Asia/Omsk','Asia/Novosibirsk','Asia/Krasnoyarsk','Asia/Irkutsk','Asia/Vladivostok'].filter(Boolean))];
  render(`${pageHead('Настройки','',['#/more','Ещё'])}
  <div class="grid"><div class="col">
    <section class="card"><div class="ch"><span class="ico">${ic('user')}</span><h2>Профиль<small>${u.role==='admin'?'админ':'участник'} · вход через Telegram</small></h2></div>
      <label class="f" for="pName">Имя</label><div class="row"><input id="pName" class="grow" type="text" maxlength="60" value="${esc(u.name)}"><button class="btn" type="button" data-act="saveName">Сохранить</button></div>
      <label class="chk reg"><input type="checkbox" data-chg="photos"${u.photos?' checked':''}><span>Разрешаю использовать мои фото чертежей для улучшения проверки<small>Необязательно; сейчас фото никуда не отправляются</small></span></label></section>
    ${flag('reminders')?card('reminders','Напоминания в Telegram',`<p class="mut">Не чаще раза в день, в выбранное время, только когда близко дедлайн или есть задачи на повтор. Без серий и «ты пропустил».</p>
      <label class="chk"><input type="checkbox" id="rOn"${r.enabled?' checked':''}><span>Присылать напоминания</span></label>
      <div class="grid2"><div><label class="f" for="rTime">Время</label><input id="rTime" type="time" value="${esc(r.time)}"></div><div><label class="f" for="rTz">Часовой пояс</label><select id="rTz">${tzs.map(z=>`<option${z===r.tz?' selected':''}>${esc(z)}</option>`).join('')}</select></div>
      <div><label class="f" for="rQf">Тихие часы с</label><input id="rQf" type="time" value="${esc(r.quietFrom)}"></div><div><label class="f" for="rQt">до</label><input id="rQt" type="time" value="${esc(r.quietTo)}"></div></div>
      <div class="row reg"><button class="btn pri" type="button" data-act="saveRem">Сохранить</button>${r.enabled?`<button class="btn" type="button" data-act="pauseRem">${r.paused?'Снять с паузы':'Пауза'}</button>`:''}</div>
      ${r.paused?'<p class="note warn reg">Напоминания на паузе.</p>':''}<div id="remMsg" aria-live="polite"></div>`,
      'напоминание о конкретном шаге в выбранное время помогает начать; стыд и серии «не прерывай» вредят мотивации и вызывают избегание — их нет.',{icon:'bell',tone:'amber'}):''}
    ${flag('sync')?card('sync','Прогресс',`<p class="mut">Хранится на устройстве (работает без сети) и в аккаунте.${lastSync?' Сохранено в '+new Date(lastSync).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'.':''}</p>
      <div class="row"><button class="btn" type="button" data-act="syncNow">Сохранить сейчас</button></div>
      <h3 class="reg">Перенести прогресс с nachert1830.ru</h3><p class="mut">На сайте: «Тренировка дня» → внизу «Сохранить в файл». Здесь выберите этот файл:</p>
      <input id="impF" type="file" accept="application/json,.json"><div class="row reg"><button class="btn" type="button" data-act="import">Перенести</button></div>`,'',{icon:'train',tone:'green'}):''}
  </div><div class="col">
    <section class="card"><div class="ch"><span class="ico green">${ic('data')}</span><h2>Мои данные<small>хранятся в России, Yandex Cloud</small></h2></div>
      <div class="kv"><div><span>Telegram id и имя</span><span>для входа</span></div><div><span>Прогресс и планы</span><span>для кабинета</span></div><div><span>Журнал входов</span><span>90 дней</span></div></div>
      <div class="row reg"><button class="btn" type="button" data-act="export">Скачать мои данные</button><button class="btn" type="button" data-act="fb" data-f="privacy">Обращение к владельцу</button><button class="btn ghost" type="button" data-act="requests">Мои обращения</button></div><div id="reqOut"></div>
      <p class="mut reg"><a href="legal/terms.html">Соглашение</a> · <a href="legal/privacy.html">Политика ПД</a> · <a href="legal/consent.html">Согласие</a></p></section>
    <section class="card"><div class="ch"><span class="ico">${ic('shield')}</span><h2>Безопасность</h2></div><div class="row"><button class="btn" type="button" data-act="logins">Журнал входов</button><button class="btn" type="button" data-act="logoutAll">Выйти на всех устройствах</button></div><div id="logOut"></div></section>
    <section class="card"><div class="row"><button class="btn grow" type="button" data-act="logout">${ic('logout')}Выйти</button><button class="btn dan" type="button" data-act="delete">Удалить аккаунт</button></div></section>
  </div></div>`,'Настройки'); }

/* ── «Ещё» ── */
function moreView(){ const m=(href,icn,tone,t,s,extl)=>`<a href="${esc(href)}"${extl?' target="_blank" rel="noopener noreferrer"':''}><span class="ico ${tone}">${ic(icn)}</span><span>${t}<small>${s}</small></span>${ic(extl?'ext':'arrow')}</a>`;
  render(`${pageHead('Ещё')}<nav class="menu" aria-label="Разделы">
  ${flag('scanner')||flag('normo')?m('#/check','sheet','amber','Проверка','предпроверка листа ИКГ · решение по фото'):''}
  ${m('#/settings','user','','Настройки','профиль, напоминания, прогресс, мои данные')}
  ${ME.user.role==='admin'?m('#/admin','admin','red','Админ-панель','приглашения, участники, функции, отзывы'):''}
  ${m(mainUrl(),'book','green','Основной сайт','тетрадь, разборы, тренажёры',true)}
  ${m('#/about','info','','О клубе','что это и как оставить отзыв')}</nav>
  <div class="row reg"><button class="btn wide" type="button" data-act="fb" data-f="general">${ic('fb')}Общий отзыв о клубе</button></div>`,'Ещё'); }
function aboutView(){ render(`${pageHead('О клубе','',['#/more','Ещё'])}<section class="card tri"><p>Клуб — закрытое тестирование кабинета Начерта на тех же задачах тетради, что на сайте. Функции включаются по одной; у каждой есть кнопка «Отзыв» — туда всё, что мешает, непонятно или нравится.</p>
  <p>Методика — интервальное повторение, перемешивание задач, проверка себя и «Решаю сам»; в каждой функции под чертой «Почему так».</p><p class="mut">Версия ${VER}. Не официальный сервис МГТУ.</p></section>`,'О клубе'); }

/* ── админ-панель ── */
let ADMIN_TAB='invites';
async function adminView(){ if(ME.user.role!=='admin'){ render('<p class="note bad">Только для админа.</p>'); return; }
  render('<p class="mut">Загружаю…</p>','Админ-панель'); let D;
  try{ D=await api('GET','/api/admin/overview'); }catch(e){ render(`<p class="note bad">${esc(e.message)}</p>`); return; }
  const dt=ms=>ms?new Date(ms).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
  const names={}; D.users.forEach(u=>{ names[u.id]=u.name; });
  const tabs=[['invites','Приглашения'],['users','Участники · '+D.users.length],['flags','Функции'],['feedback','Отзывы · '+D.feedback.length],['logins','Входы'],['settings','Семестр']];
  const st=i=>i.revokedAt?'<span class="st-badge bad">отозвано</span>':i.usedAt?'<span class="st-badge ok">'+esc(names[i.usedBy]||'использовано')+'</span>':i.expiresAt<Date.now()?'<span class="st-badge">истекло</span>':'<span class="st-badge">до '+dt(i.expiresAt)+'</span>';
  const body={
    invites:`<form id="invForm"><div class="grid2"><div><label class="f" for="invL">Для кого</label><input id="invL" type="text" maxlength="60" placeholder="Аня, ИУ5"></div><div><label class="f" for="invD">Действует, дней</label><input id="invD" type="number" min="1" max="60" value="14"></div></div>
      <label class="chk reg"><input id="invA" type="checkbox"><span>Роль «админ»</span></label><div class="row reg"><button class="btn cta" type="submit">${ic('plus')}Создать приглашение</button></div></form><div id="invOut"></div>
      <div class="reg">${D.invites.map(i=>`<div class="urow"><div><b>${esc(i.label)}</b>${i.role==='admin'?' · админ':''}<small>${dt(i.createdAt)}</small></div><div class="row">${st(i)}${!i.usedAt&&!i.revokedAt?`<button class="btn sm dan" type="button" data-act="revoke" data-h="${i.h}">Отозвать</button>`:''}</div></div>`).join('')||'<p class="mut">Приглашений пока нет.</p>'}</div>`,
    users:D.users.map(u=>`<div class="urow"><div><b>${esc(u.name)}</b>${u.blocked?' <span class="st-badge bad">доступ закрыт</span>':''}<small>с ${dt(u.createdAt)} · вход ${dt(u.lastLogin)}${u.reminders?' · напоминания':''}${u.photos?' · фото: да':''}</small></div>
      <div class="row"><select data-chg="role" data-id="${u.id}" aria-label="Роль"><option value="member"${u.role==='member'?' selected':''}>участник</option><option value="admin"${u.role==='admin'?' selected':''}>админ</option></select>${u.id!==ME.user.id?`<button class="btn sm${u.blocked?'':' dan'}" type="button" data-act="block" data-id="${u.id}" data-b="${u.blocked?0:1}">${u.blocked?'Вернуть':'Закрыть'}</button>`:''}</div></div>`).join(''),
    flags:`<p class="mut">«Всем» — функция у всех; «Админам» — обкатка; «Выкл» — скрыта.</p>${D.features.map(f=>`<div class="urow"><b>${esc(f.t)}</b><div class="seg" role="group">${[['on','Всем'],['admin','Админам'],['off','Выкл']].map(([m,l])=>`<button type="button" data-act="flag" data-f="${f.id}" data-m="${m}" class="${D.flags[f.id]===m?'on':''}">${l}</button>`).join('')}</div></div>`).join('')}`,
    feedback:D.feedback.length?`<ul class="list">${D.feedback.map(f=>`<li><b>${esc(f.feature==='privacy'?'Обращение к владельцу':(D.features.find(x=>x.id===f.feature)||{t:'Общее'}).t)}</b> ${f.mood?'<span class="lv">'+({good:'полезно',unclear:'непонятно',bad:'мешает'})[f.mood]+'</span>':''}<p>${esc(f.text)}</p><small>${esc(f.name)} · ${dt(f.ts)}</small>${f.feature==='privacy'?(f.reply?`<p class="note ok reg">Ответ (${dt(f.replyAt)}): ${esc(f.reply)}</p>`:`<div class="row reg"><button class="btn sm pri" type="button" data-act="reply" data-id="${esc(f.id)}">Ответить</button></div>`):''}</li>`).join('')}</ul>`:'<p class="empty">Отзывов пока нет.</p>',
    logins:D.logins.map(l=>`<div class="urow"><div><b>${esc(l.user?names[l.user]||'удалён':'—')}</b><small>${dt(l.ts)} · ${esc(l.ip)}${l.reason?' · '+esc(l.reason):''}</small></div><span class="st-badge ${l.ok?'ok':'bad'}">${l.ok?'вход':'отказ'}</span></div>`).join('')||'<p class="mut">Пусто.</p>',
    settings:`<label class="f" for="w1">Понедельник недели 1</label><div class="row"><input id="w1" class="grow" type="date" value="${esc(D.settings.week1)}"><button class="btn pri" type="button" data-act="saveWeek1">Сохранить</button></div><p class="mut">По умолчанию 31.08.2026 — сверьте с расписанием МГТУ. От этой даты считаются все недели календаря.</p>`};
  render(`${pageHead('Админ-панель','',['#/more','Ещё'])}<div class="seg" role="tablist">${tabs.map(([k,l])=>`<button type="button" role="tab" data-act="atab" data-t="${k}" class="${ADMIN_TAB===k?'on':''}">${l}</button>`).join('')}</div>
    <section class="card reg">${body[ADMIN_TAB]}</section>`,'Админ-панель');
  const f=$('#invForm'); if(f) f.addEventListener('submit',async e=>{ e.preventDefault();
    try{ const r=await api('POST','/api/admin/invites',{label:$('#invL').value,days:+$('#invD').value,role:$('#invA').checked?'admin':'member'});
      await adminView(); $('#invOut').innerHTML=`<div class="note ok reg"><b>Приглашение создано.</b> Ссылка показывается один раз — скопируйте и отправьте лично:<span class="code" id="invLink">${esc(r.link)}</span><button class="btn sm pri" type="button" data-act="copy" data-t="#invLink">Скопировать</button></div>`; }
    catch(err){ toast(err.message); } }); }

/* ── отзыв ── */
function feedback(f){ const name=f==='general'?'клуб в целом':(FEAT.FEATURES.find(x=>x.id===f)||{t:f}).t;
  openSheet(`${f==='privacy'?'<h2>Обращение к владельцу</h2><p class="mut">Вопрос, претензия или запрос по персональным данным. Ответ — в течение 10 рабочих дней: в «Настройки» → «Мои обращения» и в Telegram.</p>':`<h2>Отзыв: ${esc(name)}</h2><p class="mut">Что полезно, что мешает, что непонятно. Видит только владелец клуба.</p>`}
    <div class="seg reg" role="group" id="fbMood">${[['good','Полезно'],['unclear','Непонятно'],['bad','Мешает']].map(([m,l])=>`<button type="button" data-m="${m}">${l}</button>`).join('')}</div>
    <label class="f" for="fbT">Подробнее</label><textarea id="fbT" maxlength="2000"></textarea><div class="row reg"><button class="btn pri grow" id="fbGo" type="button">Отправить</button><button class="btn" data-close type="button">Отмена</button></div>`,
    bg=>{ let mood=null; $('#fbMood',bg).addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; mood=b.dataset.m; $$('#fbMood button',bg).forEach(x=>x.classList.toggle('on',x===b)); });
      $('#fbGo',bg).addEventListener('click',async()=>{ try{ await api('POST','/api/feedback',{feature:f,mood,text:$('#fbT',bg).value,ver:VER}); closeSheet(); toast('Спасибо! Отзыв отправлен'); }catch(e){ toast(e.message); } }); }); }

/* ── действия ── */
const ACT={
  fb:el=>feedback(el.dataset.f),
  onboardOff:()=>{ LS.device('nch2_club_onboard'); todayView(); },
  botLogin:el=>botLogin(!!el.dataset.need),
  loginCancel:()=>{ LOGIN=null; const box=$('#auth'); if(box) box.innerHTML=authIdle(); },
  devBot:async()=>{ if(!LOGIN) return; await fetch('/dev/bot-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:LOGIN.token,id:$('#dvId').value,first_name:$('#dvName').value})}); },
  qmore:el=>{ const q=$('.q',el.closest('.task')); q.classList.toggle('open'); el.textContent=q.classList.contains('open')?'Свернуть':'Условие целиком'; },
  rate:el=>{ const t=el.closest('.task'), v=+el.dataset.v; if(v===2) saveRating(t,2,[],[]); else { $$('.rate .btn',t).forEach(b=>b.classList.toggle('on',b===el)); errorPicker(t,v); } },
  rateSave:el=>{ const t=el.closest('.task'); saveRating(t,+el.dataset.v,$$('.errs [data-e].on',t).map(b=>b.dataset.e),$$('.errs [data-sym].on',t).map(b=>b.dataset.sym)); },
  ikgSelf:el=>{ const id=el.dataset.ev, s=el.dataset.s, v=+el.dataset.v, st=LS.get(K.diag,{}); if(!st[id]) return; st[id].res[s]=v; LS.set(K.diag,st);
    LS.set(K.ev,BKT.merge(LS.get(K.ev,[]).filter(e=>e.id!=='self:'+id+':'+s),[{id:'self:'+id+':'+s,t:Date.now(),skills:[s],ok:v===2,src:'self'}]));
    if(Object.keys(st[id].res).length>=st[id].items.length) setDone(id+':diag',true); const e=events().find(x=>x.id===id); if(e) diagView(e); },
  addTrain:el=>{ let rep=LS.get(K.rep,{}); const d=dayNum(); el.dataset.n.split(',').forEach(n=>{ if(!rep[n]) rep=Object.assign({},rep,{[n]:{b:0,d:d,s:d,l:d,n:0}}); }); LS.set(K.rep,rep);
    const tr=LS.get(K.train,{}); if(tr.day===d){ delete tr.day; LS.set(K.train,tr); } toast('Добавлено — задачи в тренировке дня'); },
  evDateReset:el=>{ const s=calSet(); s.dates=s.dates||{}; delete s.dates[el.dataset.id]; LS.set(K.cal,s); eventView(el.dataset.id); },
  iiClear:el=>{ const m=LS.get(K.ii,{}); m[el.dataset.id]={when:'',where:'',what:'',t:Date.now()}; LS.set(K.ii,m); eventView(el.dataset.id); },
  mockStart:el=>{ const m=LS.get(K.mock,{}); m[el.dataset.id]={start:Date.now(),min:90}; LS.set(K.mock,m); const e=events().find(x=>x.id===el.dataset.id); mockView(e); },
  mockEnd:el=>{ const m=LS.get(K.mock,{}); m[el.dataset.id]=Object.assign({},m[el.dataset.id],{end:Date.now()}); LS.set(K.mock,m); setDone(el.dataset.id+':mock',true); toast('Пробный РК отмечен'); const e=events().find(x=>x.id===el.dataset.id); mockView(e); },
  scan:async()=>{ const n=+$('#scN').value, f=$('#scF').files[0], out=$('#scOut'); const t=taskBy(n);
    if(!t){ out.innerHTML='<p class="note bad reg">Укажите номер задачи тетради (1–89).</p>'; return; }
    if(!f){ out.innerHTML='<p class="note bad reg">Выберите фото.</p>'; return; }
    const r=await SCAN.scan(f,{n,topic:t.topic}); const url=URL.createObjectURL(f);
    out.innerHTML=`<img class="photo" src="${url}" alt="Фото решения"><p class="note ${r.verdict==='ok'?'ok':r.verdict==='error'?'bad':'warn'} reg">${r.error?esc(r.error):r.verdict==='unknown'?'Не знаю: '+esc(r.note||''):r.verdict==='ok'?'Похоже на верное решение.':'Есть расхождения.'}</p>`; },
  normo:async()=>{ const f=$('#nkF').files[0]; if(!f){ $('#nkOut').innerHTML='<p class="note bad reg">Выберите SVG-файл листа.</p>'; return; }
    if(f.size>8*1024*1024){ $('#nkOut').innerHTML='<p class="note bad reg">Файл больше 8 МБ.</p>'; return; } runNormo(await f.text(),true,'Ваш лист'); },
  normoSample:async el=>{ try{ const r=await fetch('core/samples/'+el.dataset.s+'.svg'); runNormo(await r.text(),false,'Образец «'+el.textContent+'»'); }catch(e){ toast('Нет сети'); } },
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
  export:async()=>{ try{ const r=await fetch('/api/me/export',{credentials:'same-origin'}); if(!r.ok) throw new Error('Не получилось'); const b=await r.blob(), u=URL.createObjectURL(b), a=document.createElement('a');
    a.href=u; a.download='nachert-club-my-data.json'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(u); a.remove(); },1500); }catch(e){ toast(e.message); } },
  delete:()=>openSheet(`<h2>Удалить аккаунт</h2><p>Удалятся имя, Telegram id, прогресс в аккаунте, настройки, отзывы и журнал входов. Это нельзя отменить. Перед удалением можно <button class="btn sm" type="button" data-act="export">скачать свои данные</button>.</p>
    <label class="f" for="delC">Введите слово УДАЛИТЬ</label><input id="delC" type="text" autocomplete="off"><div class="row reg"><button class="btn dan grow" id="delGo" type="button">Удалить навсегда</button><button class="btn" data-close type="button">Отмена</button></div>`,
    bg=>{ $('#delGo',bg).addEventListener('click',async()=>{ try{ await api('POST','/api/me/delete',{confirm:$('#delC',bg).value.trim()}); closeSheet(); wipeLocal(); ME=null; toast('Аккаунт удалён'); location.hash='#/'; route(); }catch(e){ toast(e.message); } }); }),
  copy:async el=>{ const t=$(el.dataset.t).textContent; try{ await navigator.clipboard.writeText(t); toast('Скопировано'); }catch(e){ toast('Выделите и скопируйте вручную'); } },
  requests:async()=>{ try{ const r=await api('GET','/api/me/requests'); $('#reqOut').innerHTML=r.requests.length?`<ul class="list reg">${r.requests.map(q=>`<li>${esc(q.text)}<br><small>${new Date(q.ts).toLocaleString('ru-RU')}</small>${q.reply?`<p class="note ok reg">Ответ: ${esc(q.reply)}</p>`:'<p class="mut">Ответа пока нет.</p>'}</li>`).join('')}</ul>`:'<p class="mut reg">Обращений нет.</p>'; }catch(e){ toast(e.message); } },
  reply:el=>openSheet(`<h2>Ответ на обращение</h2><p class="mut">Участник увидит ответ в «Мои обращения» и получит его в Telegram.</p><textarea id="rpT" maxlength="2000"></textarea><div class="row reg"><button class="btn pri grow" id="rpGo" type="button">Отправить</button><button class="btn" data-close type="button">Отмена</button></div>`,
    bg=>{ $('#rpGo',bg).addEventListener('click',async()=>{ try{ const r=await api('POST','/api/admin/reply',{id:el.dataset.id,text:$('#rpT',bg).value}); closeSheet(); toast(r.telegram?'Ответ отправлен и в Telegram':'Ответ сохранён в клубе'); adminView(); }catch(e){ toast(e.message); } }); }),
  atab:el=>{ ADMIN_TAB=el.dataset.t; adminView(); },
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
document.addEventListener('change',e=>{ const el=e.target.closest('[data-chg]'); if(el&&CHG[el.dataset.chg]) CHG[el.dataset.chg](el,e); });
$('#theme').addEventListener('click',()=>{ const t=document.documentElement.dataset.theme==='dark'?'light':'dark'; document.documentElement.dataset.theme=t; LS.device('nch2_theme',t); });

function wipeLocal(){ try{ const ks=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(SYNC.syncable(k)||/^nch2_club_/.test(k)) ks.push(k); } ks.forEach(k=>localStorage.removeItem(k)); }catch(e){} }

/* ── маршруты ── */
function tabs(){ const t=$('#tabs'); t.hidden=!ME; if(!ME) return; const r=(location.hash.replace(/^#\/?/,'').split('/')[0])||'';
  $$('a',t).forEach(a=>{ a.hidden=!!a.dataset.f&&!flag(a.dataset.f); a.classList.toggle('on',a.dataset.r===r||(r==='event'&&a.dataset.r==='calendar')||(['check','settings','admin','about'].includes(r)&&a.dataset.r==='more')); }); }
function route(){ closeSheet(); const h=location.hash.replace(/^#\/?/,''), p=h.split('/');
  if(p[0]==='invite'&&p[1]){ try{ sessionStorage.setItem('club_invite',p[1]); }catch(e){} history.replaceState(null,'','#/join'); return route(); }
  if(!ME){ if(LOGIN&&$('#auth')) return; if(p[0]==='join'||getInvite()) return inviteView(); return loginView(); }
  if(!CORE){ render('<p class="mut">Загружаю задачи…</p>'); return; }
  view().focus({preventScroll:true}); scrollTo(0,0);
  switch(p[0]){
    case '': case 'join': return todayView();
    case 'calendar': return flag('calendar')?calendarView():todayView();
    case 'event': return eventView(p[1],p[2]);
    case 'train': return flag('training')?trainView():todayView();
    case 'skills': return flag('skills')?skillsView():todayView();
    case 'check': return checkView();
    case 'settings': return settingsView();
    case 'more': return moreView();
    case 'about': return aboutView();
    case 'admin': return adminView();
    default: return todayView(); } }
addEventListener('hashchange',route);

async function boot(){
  try{ CFG=await api('GET','/api/config'); LS.device('nch2_club_cfg',CFG); }catch(e){ CFG=LS.get('nch2_club_cfg',null); }
  if(!CFG){ render('<section class="card"><h2>Нет связи</h2><p>Клуб открывается впервые и без сети не может загрузиться. Подключитесь к интернету.</p></section>'); return; }
  try{ await loadMe(); OFFLINE=false; }
  catch(e){ if(e.offline){ const c=LS.get(K.me,null); if(c){ ME=c; OFFLINE=true; } } else ME=null; }
  try{ const r=await fetch('core/tasks.json'); CORE=await r.json(); }catch(e){ CORE=null; }
  route(); if(ME&&!OFFLINE) syncNow(); }
if('serviceWorker' in navigator&&location.protocol!=='file:') navigator.serviceWorker.register('sw.js').catch(()=>{});
boot();
window.CLUB={get me(){ return ME; },syncNow,sanitizeSvg,LS};
})();
