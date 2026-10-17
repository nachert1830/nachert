/* Клуб Начерта — личный кабинет тестировщика. Без сборки и зависимостей; логика — в lib/*.js (общая с сервером).
   Прогресс живёт в localStorage под теми же ключами nch2_*, что на основном сайте, и синхронизируется с аккаунтом (lib/sync.js).
   CSP запрещает встроенные скрипты и стили: обработчики — через data-act, ширины полос — через el.style после отрисовки. */
(function(){
'use strict';
const CAL=ClubCalendar, PL=ClubPlan, SRS=ClubSRS, BKT=ClubBKT, SYNC=ClubSync, REM=ClubReminder, SCAN=ClubScanner, FEAT=ClubFeatures;
const VER='club-1.0';
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
const ext=(href,text,cls)=>`<a class="${cls||'btn sm'}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text} ↗</a>`;
const flag=f=>!!(ME&&ME.flags&&ME.flags[f]);
const plural=(n,a,b,c)=>{ const m10=n%10,m100=n%100; return m10===1&&m100!==11?a:m10>=2&&m10<=4&&(m100<12||m100>14)?b:c; };
function fbBtn(f){ return `<button class="fb" type="button" data-act="fb" data-f="${esc(f)}" aria-label="Отзыв о функции">Отзыв</button>`; }
function card(f,title,inner,why,tag){ return `<section class="card" data-feature="${esc(f)}"><div class="ch"><${tag||'h2'}>${title}</${tag||'h2'}>${fbBtn(f)}</div>${inner}${why?`<p class="why">${why}</p>`:''}</section>`; }
function tagOf(e){ return `<span class="tag ${e.kind}">${esc(e.short)}</span>`; }
function topicTitle(id){ if(!CORE) return id; const t=CORE.topics.find(x=>x.id===id); if(t) return t.title; const s=BKT.IKG_SKILLS.find(x=>x.id===id); return s?s.title:id; }
const taskBy=n=>CORE&&CORE.tasks.find(t=>t.n===+n);
function nextRk(subj,horizon){ const t=dayNum(); return events().filter(e=>e.kind==='rk'&&(!subj||e.subj===subj)&&CAL.toDay(e.date)>=t&&CAL.toDay(e.date)-t<=(horizon||14))[0]||null; }
function focusTopics(){ const e=nextRk('ng',21); return e&&CORE?(CORE.rkTopics[e.n]||[]):[]; }

/* оценки навыков: наблюдения клуба + последние самооценки из очереди основного сайта (если этой попытки в клубе не было) */
function skillEvents(){ const ev=LS.get(K.ev,[]), rep=LS.get(K.rep,{}), club=new Set(ev.filter(e=>e.task).map(e=>e.task+'@'+Math.floor(e.t/864e5)));
  const fromRep=BKT.fromRep(rep,n=>{ const t=taskBy(n); return t&&t.topic; }).filter(e=>!club.has(e.task+'@'+Math.floor(e.t/864e5)));
  return BKT.merge(ev,fromRep); }
const estimate=()=>BKT.estimate(skillEvents());

/* ── вход ── */
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=()=>rej(new Error('Не загрузился '+src)); document.head.appendChild(s); }); }
function telegramAuth(){ return new Promise(async(res,rej)=>{
  if(CFG.devTelegram){ openSheet(`<h2>Вход через Telegram — эмуляция</h2><p class="mut">Локальная эмуляция: настоящего Telegram здесь нет, сервер подписывает данные тестовым токеном бота. В облаке на этом месте — окно Telegram.</p>
      <label class="f" for="dtid">Telegram id</label><input id="dtid" type="text" inputmode="numeric" value="1000002"><p class="mut">1000001 — владелец клуба (админ).</p>
      <label class="f" for="dtn">Имя</label><input id="dtn" type="text" value="Тестировщик"><div class="row"><button class="btn pri grow" id="dtgo" type="button">Войти</button><button class="btn" data-close type="button">Отмена</button></div>`,
      bg=>{ $('#dtgo',bg).addEventListener('click',async()=>{ try{ const r=await fetch('/dev/tg-sign?id='+encodeURIComponent($('#dtid',bg).value)+'&first_name='+encodeURIComponent($('#dtn',bg).value)); const d=await r.json(); closeSheet(); res(d); }catch(e){ rej(e); } }); });
    return; }
  try{ if(!window.Telegram||!Telegram.Login) await loadScript('https://telegram.org/js/telegram-widget.js?22'); }catch(e){ return rej(new Error('Не удалось загрузить вход Telegram. Проверьте сеть.')); }
  Telegram.Login.auth({bot_id:CFG.botId,request_access:'write',lang:'ru'},data=>{ if(!data) rej(new Error('Вход отменён')); else res(data); }); }); }

async function afterLogin(r){ ME=Object.assign({},ME||{},{csrf:r.csrf}); const local=SYNC.readLocal(localStorage), had=Object.keys(local.data).length;
  await loadMe(); const ok=await syncNow();
  try{ sessionStorage.removeItem('club_invite'); }catch(e){}
  if(r.isNew&&had&&ok) toast('Прогресс с этого устройства перенесён в аккаунт'); else if(r.isNew) toast('Добро пожаловать в клуб!');
  if(r.isNew) LS.device('nch2_club_onboard',1);
  location.hash='#/'; route(); }
async function loadMe(){ const m=await api('GET','/api/me'); ME=m; const c=Object.assign({},m); delete c.csrf; LS.device(K.me,c); return m; }

function consentBlock(){ return `<div class="consent">
  <label class="chk"><input type="checkbox" id="cTerms"> <span>Принимаю <a href="legal/terms.html" target="_blank" rel="noopener">пользовательское соглашение</a> и <a href="legal/privacy.html" target="_blank" rel="noopener">политику обработки персональных данных</a>.</span></label>
  <label class="chk"><input type="checkbox" id="cPd"> <span>Даю <a href="legal/consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a> (отдельный документ).</span></label>
  <label class="chk"><input type="checkbox" id="cPhotos"> <span>Разрешаю использовать мои фото чертежей для улучшения проверки. <small>Необязательно, можно изменить в настройках.</small></span></label>
  <p class="draft">Документы — черновики, их проверит юрист.</p></div>`; }
const consentVal=()=>({terms:!!($('#cTerms')||{}).checked,pd:!!($('#cPd')||{}).checked,photos:!!($('#cPhotos')||{}).checked});
function loginButtons(withConsent){ return `${CFG.botId?`<button class="btn tg wide" type="button" data-act="tg" ${withConsent?'data-need="1"':''}>Войти через Telegram</button>`:''}
  ${CFG.mail?`<div class="or">или по почте</div><form id="mailForm" class="stack" novalidate>
    ${withConsent?'<div><label class="f" for="mName">Как к вам обращаться</label><input id="mName" type="text" autocomplete="given-name" maxlength="60"></div>':''}
    <div><label class="f" for="mEmail">Почта</label><input id="mEmail" type="email" autocomplete="email" inputmode="email" required></div>
    <button class="btn wide" type="submit">Прислать ссылку для входа</button><p class="mut">Ссылка действует 15 минут и срабатывает один раз. Адрес мы не храним — только отпечаток для входа.</p></form>`:''}
  <div id="authMsg" aria-live="polite"></div>`; }
function bindLogin(withConsent){ const f=$('#mailForm'); if(f) f.addEventListener('submit',async e=>{ e.preventDefault(); const msg=$('#authMsg');
  const c=consentVal(); if(withConsent&&!(c.terms&&c.pd)){ msg.innerHTML='<p class="note bad">Отметьте соглашение и согласие на обработку данных.</p>'; return; }
  try{ const r=await api('POST','/api/auth/email/start',{email:$('#mEmail').value,name:withConsent?$('#mName').value:undefined,invite:getInvite(),consent:withConsent?c:undefined});
    msg.innerHTML=`<p class="note ok">${esc(r.msg)}</p>${CFG.devTelegram?'<p class="mut">Эмуляция: письмо — на <a href="/dev/outbox" target="_blank">/dev/outbox</a>.</p>':''}`; }
  catch(err){ msg.innerHTML=`<p class="note bad">${esc(err.message)}</p>`; } }); }
/* владелец (или участник без отметок) входит впервые со страницы входа — согласие спрашивается здесь же, теми же данными Telegram */
function askConsent(auth){ openSheet(`<h2>Первый вход</h2><p class="mut">Перед созданием аккаунта примите документы.</p>${consentBlock()}<div id="caMsg"></div><div class="row"><button class="btn pri grow" id="caGo" type="button">Продолжить</button><button class="btn" data-close type="button">Отмена</button></div>`,
  bg=>{ $('#caGo',bg).addEventListener('click',async()=>{ const c=consentVal(); if(!(c.terms&&c.pd)){ $('#caMsg',bg).innerHTML='<p class="note bad">Отметьте соглашение и согласие.</p>'; return; }
    try{ const r=await api('POST','/api/auth/telegram',{auth,invite:getInvite(),consent:c}); closeSheet(); await afterLogin(r); }catch(e){ $('#caMsg',bg).innerHTML=`<p class="note bad">${esc(e.message)}</p>`; } }); }); }
const getInvite=()=>{ try{ return sessionStorage.getItem('club_invite')||undefined; }catch(e){ return undefined; } };

function loginView(){ render(`<div class="hero"><div class="logo" aria-hidden="true"></div><h1>Клуб Начерта</h1><p>Закрытое тестирование личного кабинета: календарь сдач ИКГ и начерта, обратный план, тренировка дня и карта навыков — на задачах тетради с <a href="${esc(mainUrl())}" rel="noopener">nachert1830.ru</a>.</p></div>
  <section class="card stack"><h2>Вход для участников</h2>${loginButtons(false)}<p class="note">Новых участников клуб принимает только по личной ссылке-приглашению от владельца.</p></section>
  <p class="mut"><a href="legal/terms.html">Соглашение</a> · <a href="legal/privacy.html">Персональные данные</a></p>`,'Вход'); bindLogin(false); }

async function inviteView(){ const code=getInvite(); let st={valid:false,why:'Нет приглашения.'};
  render('<p class="mut">Проверяю приглашение…</p>','Приглашение');
  try{ st=await api('GET','/api/invite/check?code='+encodeURIComponent(code||'')); }catch(e){ st={valid:false,why:e.message}; }
  if(!st.valid){ render(`<div class="hero"><div class="logo" aria-hidden="true"></div><h1>Приглашение не подходит</h1><p>${esc(st.why)}</p></div><section class="card stack"><p>Если вы уже участник — войдите как обычно.</p>${loginButtons(false)}</section>`,'Приглашение'); bindLogin(false); return; }
  render(`<div class="hero"><div class="logo" aria-hidden="true"></div><h1>Вас пригласили в клуб</h1><p>Клуб — закрытое тестирование нового кабинета Начерта. Мы храним минимум: имя, способ входа и прогресс; данные — в России (Yandex Cloud).</p></div>
    <section class="card stack"><h2>Регистрация</h2>${consentBlock()}${loginButtons(true)}</section>`,'Приглашение'); bindLogin(true); }

async function magicView(token,consent){ render('<p class="mut">Проверяю ссылку…</p>','Вход по ссылке');
  try{ const r=await api('POST','/api/auth/email/verify',{token,consent}); await afterLogin(r); }
  catch(e){ if(e.data&&e.data.needConsent&&!consent){ render(`<section class="card stack"><h2>Первый вход</h2><p class="mut">Перед созданием аккаунта примите документы.</p>${consentBlock()}<div id="caMsg"></div><button class="btn pri wide" type="button" id="caGo">Продолжить</button></section>`,'Вход по ссылке');
      $('#caGo').addEventListener('click',()=>{ const c=consentVal(); if(!(c.terms&&c.pd)){ $('#caMsg').innerHTML='<p class="note bad">Отметьте соглашение и согласие.</p>'; return; } magicView(token,c); }); return; } render(`<section class="card stack"><h2>Ссылка не сработала</h2><p class="note bad">${esc(e.message)}</p>${loginButtons(false)}</section>`,'Вход по ссылке'); bindLogin(false); } }

/* ── «Сегодня» ── */
function todayView(){ const t=today(), evs=CAL.upcoming(calSet(),week1(),t,4), wk=CAL.weekOf(week1(),t), done=doneMap();
  const steps=PL.todaySteps(events(),t,done,21), tr=trainingToday();
  const onboard=LS.get('nch2_club_onboard',0);
  const evList=evs.map(e=>`<li><a class="ev" href="#/event/${e.id}">${tagOf(e)}<span class="t"><b>${esc(e.title)}</b><small>${esc(CAL.human(e.date))}${e.custom?'':' · неделя '+e.week}</small></span><span class="in${e.inDays<=7?' soon':''}">${esc(CAL.inWords(e.inDays))}</span></a></li>`).join('');
  render(`<div class="stack">
    <div><h1>Привет, ${esc(ME.user.name)}</h1><p class="mut">${wk>=1&&wk<=17?'Идёт '+wk+'-я неделя семестра':wk<1?'Семестр начнётся '+esc(CAL.human(week1())):'Семестр по таблице закончился'} · ${esc(CAL.human(t))}</p></div>
    ${onboard?`<section class="card"><div class="ch"><h2>С чего начать</h2><button class="fb" data-act="onboardOff" type="button">Скрыть</button></div><ol class="lead"><li>Проверьте <a href="#/calendar">день занятий</a> по каждому предмету — от него считаются даты.</li><li>Есть прогресс на nachert1830.ru? Там в «Тренировке дня» — «Сохранить в файл», здесь — <a href="#/settings">Настройки → Перенести прогресс</a>.</li><li>Включите <a href="#/settings">напоминания</a>, если удобно.</li></ol></section>`:''}
    ${flag('calendar')?card('calendar','Ближайшее',evs.length?`<ul class="list">${evList}</ul>`:'<p class="mut">В таблице больше нет событий.</p>'):''}
    ${flag('plan')?card('plan','По плану сегодня',steps.length?`<ul class="steps">${steps.map(s=>stepLi(s,true)).join('')}</ul>`:'<p class="mut">На сегодня по обратному плану ничего. Хороший день для тренировки.</p>'):''}
    ${flag('training')?card('training','Тренировка дня',`<p class="lead">${tr.items.length?tr.items.length+' '+plural(tr.items.length,'задача','задачи','задач')+' · ≈ '+tr.minutes+' мин'+(tr.left?' · осталось '+tr.left:' · всё сделано'):'Повторять пока нечего — начните с карты навыков.'}</p><a class="btn pri wide" href="#/train">${tr.left?'Начать':'Открыть'}</a>`):''}
  </div>`,'Сегодня'); }

/* ── календарь ── */
function calendarView(){ const s=CAL.normSettings(calSet()), t=dayNum(), wkNow=CAL.weekOf(week1(),today());
  const wd=[1,2,3,4,5,6].map(d=>[d,['','понедельник','вторник','среда','четверг','пятница','суббота'][d]]);
  const ws=CAL.weeks(calSet(),week1(),17).map(w=>`<div class="wk${w.week===wkNow?' now':''}"><div class="n">${w.week}<small>${esc(CAL.human(w.start).replace(/^пн, /,''))}</small></div>
    <div class="es">${w.events.map(e=>`<a class="chip${CAL.toDay(e.date)<t?' past':''}" href="#/event/${e.id}">${tagOf(e)}${esc(e.subjTitle)}${e.custom?' · '+esc(CAL.human(e.date)):''}</a>`).join('')||'<small>—</small>'}</div></div>`).join('');
  render(`<div class="stack">
    ${card('calendar','Календарь сдач',`<p class="lead">Неделя в таблице — неделя крайнего срока. РК пишется один раз и только на своей неделе; М — закрытие модуля.</p>
      <div class="grid2">${['ikg','ng'].map(k=>`<div><label class="f" for="cd-${k}">Занятие по ${k==='ikg'?'ИКГ':'начерту'}</label><select id="cd-${k}" data-chg="classDay" data-s="${k}">${wd.map(([d,n])=>`<option value="${d}"${s.classDay[k]===d?' selected':''}>${n}</option>`).join('')}</select></div>`).join('')}</div>
      <p class="mut">От дня занятия считаются даты событий; точную дату РК можно поставить в самом событии. Неделя 1 начинается ${esc(CAL.human(week1()))} — дату задаёт владелец клуба.</p>
      <div class="row">${['ikg','ng'].map(k=>`<label class="chk"><input type="checkbox" data-chg="subj" data-s="${k}"${s.subjects.includes(k)?' checked':''}> ${k==='ikg'?'ИКГ':'Начерт'}</label>`).join('')}</div>`,
      '<b>Почему так:</b> срок, привязанный к конкретному дню, планируется точнее, чем «где-то на неделе», — а запас времени до него защищает от ошибки планирования (Buehler и др., 1994).')}
    <section class="card"><h2>Недели</h2>${ws}</section></div>`,'Календарь'); }

/* ── событие и обратный план ── */
function stepLi(s,withEv){ const range=s.from&&s.to&&s.from!==s.to?esc(CAL.human(s.from))+' – '+esc(CAL.human(s.to)):esc(CAL.human(s.date));
  const cls=[s.when==='today'?'today':'',s.done?'done':'',s.event?'ev-day':''].join(' ');
  if(s.days&&!s.key) return `<li class="${cls}"><span aria-hidden="true">↻</span><div class="st"><b>${esc(s.title)}</b><small>${range}${s.min?' · ≈ '+s.min+' мин в день':''}</small><div class="what">${esc(s.what)}</div></div></li>`;
  return `<li class="${cls}">${s.event||s.buffer?'<span aria-hidden="true">'+(s.event?'◆':'·')+'</span>':`<input type="checkbox" data-chg="step" data-k="${esc(s.key)}"${s.done?' checked':''} aria-label="Сделано: ${esc(s.title)}">`}
    <div class="st"><b>${withEv&&s.ev?esc(s.ev.short+' '+s.ev.subjTitle)+' · ':''}${esc(s.title)}</b><small>${range}${s.min?' · ≈ '+s.min+' мин':''}${s.squeezed?' · сжато':''}</small><div class="what">${esc(s.what)}</div>${withEv&&s.ev?`<a href="#/event/${s.ev.id}">к плану →</a>`:stepAction(s)}</div></li>`; }
/* ежедневные шаги «вперемешку» — одной строкой с диапазоном дат; отметка — за сегодняшний день */
function groupMix(steps){ const out=[]; let g=null;
  steps.forEach(s=>{ if(s.group!=='mix'){ g=null; out.push(s); return; }
    if(!g){ g=Object.assign({},s,{from:s.date,to:s.date,days:[s]}); out.push(g); } else { g.to=s.date; g.days.push(s); }
    if(s.when==='today'){ g.key=s.key; g.done=s.done; g.when='today'; } });
  out.forEach(x=>{ if(x.days){ if(x.when!=='today'){ x.key=null; x.done=x.days.every(d=>d.done); } x.title=x.title+(x.days.length>1?' · каждый день':''); } });
  return out; }
function stepAction(s){ const e=s.evObj; if(!e) return '';
  if(s.k==='diag') return `<a class="btn sm" href="#/event/${e.id}/diag">${s.done?'Результаты':'Начать диагностику'}</a>`;
  if(s.group==='mix'&&s.when==='today') return `<a class="btn sm" href="#/event/${e.id}/mix">Задачи на сегодня</a>`;
  if(s.k==='mock') return `<a class="btn sm" href="#/event/${e.id}/mock">Пробный РК</a>`;
  if(s.k==='light') return ext(mainUrl(e.subj==='ng'?'#/ng/cheat':'#/ig/theory'),'Шпаргалка на сайте');
  if(e.kind==='dz'&&s.k==='check'&&e.subj==='ikg'&&flag('normo')) return `<a class="btn sm" href="#/check">Предпроверка листа</a>`;
  if(e.kind==='dz'&&s.k==='read') return ext(mainUrl(e.subj==='ng'?'#/ng/hw':'#/ig/hw2'),'Разборы ДЗ на сайте');
  return ''; }
function eventView(id,sub){ const e=events().find(x=>x.id===id); if(!e){ render('<p class="note bad">Нет такого события.</p>'); return; }
  if(sub==='diag') return diagView(e); if(sub==='mix') return mixView(e); if(sub==='mock') return mockView(e);
  const p=PL.plan(e,today(),doneMap()); p.steps.forEach(s=>{ s.evObj=e; });
  const ii=LS.get(K.ii,{})[e.id]||{}, t=dayNum(), k=CAL.toDay(e.date)-t;
  render(`<div class="stack"><a href="#/calendar">← Календарь</a>
    <div class="row">${tagOf(e)}<h1 class="grow">${esc(e.title)}</h1></div>
    <p class="lead">${esc(e.kindFull)} · неделя ${e.week} (${esc(CAL.human(e.start))} – ${esc(CAL.human(e.end))}) · <b>${esc(CAL.human(e.date))}</b>, ${esc(CAL.inWords(k))}</p>
    <section class="card"><label class="f" for="evd">${e.kind==='rk'?'День РК в моей группе':e.kind==='dz'?'День сдачи в моей группе':'День закрытия модуля'}</label>
      <div class="row"><input id="evd" class="grow" type="date" min="${e.start}" max="${e.end}" value="${e.date}" data-chg="evDate" data-id="${e.id}">${e.custom?`<button class="btn sm" type="button" data-act="evDateReset" data-id="${e.id}">По дню занятия</button>`:''}</div>
      <p class="mut">Только внутри недели ${e.week}: ${e.kind==='rk'?'РК пишется один раз и только на этой неделе.':'крайний срок — на этой неделе.'}</p></section>
    ${flag('plan')?card('plan','Обратный план',p.over?'<p class="mut">Событие прошло.</p>':`${p.late?'<p class="note warn">План сокращён: времени меньше, чем нужно по полной схеме. Ничего не выброшено — шаги сдвинуты на ближайшие дни.</p>':''}<ul class="steps">${groupMix(p.steps).map(s=>stepLi(s,false)).join('')}</ul>`,
      e.kind==='rk'?'<b>Почему так:</b> диагностика показывает, что тренировать (проверка себя, Roediger, Karpicke, 2006); задачи вперемешку учат выбирать способ (Rohrer, Taylor, 2007); пробный РК на время переносит навык в формат экзамена; накануне — без новых тем, сон закрепляет выученное.'
      :e.kind==='dz'?'<b>Почему так:</b> большое задание, разбитое на этапы с датами, реже откладывается; запас перед сроком — защита от ошибки планирования (Buehler, Griffin, Ross, 1994).':'<b>Почему так:</b> сверка за неделю оставляет время исправить замечания до закрытия модуля.'):''}
    ${flag('plan')?card('plan','Мой план: когда — где — что',`<p class="lead">Сформулируйте одно конкретное намерение: «Если <i>когда</i>, <i>где</i>, то я <i>что</i>».</p>
      <form id="iiForm" data-id="${e.id}"><label class="f" for="iiW">Когда</label><input id="iiW" type="text" maxlength="60" placeholder="в четверг после пар, 17:30" value="${esc(ii.when||'')}">
      <label class="f" for="iiP">Где</label><input id="iiP" type="text" maxlength="60" placeholder="в читальном зале, 3-й этаж" value="${esc(ii.where||'')}">
      <label class="f" for="iiT">Что именно</label><input id="iiT" type="text" maxlength="120" placeholder="${e.kind==='rk'?'решаю задачи 52 и 57 без подсказок':'делаю черновик видов спереди и сверху'}" value="${esc(ii.what||'')}">
      <div class="row"><button class="btn pri" type="submit">Сохранить</button>${ii.what?'<button class="btn" type="button" data-act="iiClear" data-id="'+e.id+'">Очистить</button>':''}</div></form>
      ${ii.what?`<div class="ii"><small>Ваше намерение</small><q>Если ${esc(ii.when||'…')}${ii.where?', '+esc(ii.where):''}, то я ${esc(ii.what)}.</q></div>`:''}`,
      '<b>Почему так:</b> конкретный план «когда — где — что» заметно повышает шанс, что дело будет сделано (implementation intentions, Gollwitzer, Sheeran, 2006: метаанализ 94 исследований, d ≈ 0,65). Напоминание в Telegram покажет этот план.','h2'):''}
  </div>`,e.title);
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
  const body=e.subj==='ng'?d.items.map(x=>taskCard(+x,'diag:'+e.id,d.res[x])).join('')
    :`<p class="lead">Оцените честно, как уверенно вы делаете это на листе сейчас. Лучше — после одного задания тренажёра «Нормоконтроль» на сайте.</p><div class="row">${ext(mainUrl('#/ig/nk'),'Нормоконтроль: найди нарушение')}${ext(mainUrl('#/ig/learn'),'Уроки ИГ')}</div>
      <ul class="list">${d.items.map(s=>`<li><b>${esc(topicTitle(s))}</b><div class="seg" role="group">${[['2','уверенно'],['1','сомневаюсь'],['0','не умею']].map(([v,l])=>`<button type="button" data-act="ikgSelf" data-ev="${e.id}" data-s="${s}" data-v="${v}" class="${d.res[s]===+v?'on':''}">${l}</button>`).join('')}</div></li>`).join('')}</ul>`;
  render(`<div class="stack"><a href="#/event/${e.id}">← План ${esc(e.short)} · ${esc(e.subjTitle)}</a>
    ${card('plan','Диагностика · '+esc(e.short+' '+e.subjTitle),`<p class="lead">${e.subj==='ng'?'По одной задаче на тему РК. Решайте на бумаге без подсказок, затем отметьте результат честно — от этого зависит, что попадёт в тренировку.':''} Готово: ${n} из ${all}.</p><div class="bar"><i data-w="${all?n/all*100:0}"></i></div>`)}
    <div>${body}</div>${n===all?`<p class="note ok">Диагностика пройдена. Слабые темы — на <a href="#/skills">карте навыков</a>; они пойдут в план «вперемешку».</p>`:''}</div>`,'Диагностика'); }
function mixView(e){ let items=[];
  if(e.subj==='ng'){ const rec=BKT.recommend(estimate(),CORE.tasks,LS.get(K.rep,{}),CORE.rkTopics[e.n]||[],3); items=rec.map(r=>r.tasks[0]).filter(Boolean); }
  render(`<div class="stack"><a href="#/event/${e.id}">← План ${esc(e.short)} · ${esc(e.subjTitle)}</a>
    ${card('plan','Слабые темы вперемешку',`<p class="lead">${e.subj==='ng'?'Три задачи из самых слабых тем РК, разных типов подряд. Сначала определите способ, потом решайте.':'Тренажёр «Нормоконтроль» на сайте и предпроверка своего листа — по слабым группам правил.'}</p>`,'<b>Почему так:</b> когда тип задачи заранее неизвестен, мозг учится главному для РК — выбирать способ (Rohrer, Dedrick, Stershic, 2015).')}
    <div>${e.subj==='ng'?items.map(n=>taskCard(n,'mix:'+e.id)).join('')||'<p class="mut">Все темы РК освоены — повторяйте по тренировке дня.</p>':`<div class="row">${ext(mainUrl('#/ig/nk'),'Нормоконтроль','btn')}${flag('normo')?'<a class="btn" href="#/check">Предпроверка листа</a>':''}</div>`}</div></div>`,'Вперемешку'); }
function mockView(e){ const m=LS.get(K.mock,{})[e.id]||{}, href=e.subj==='ng'?(e.n===2?'#/ng/rk2/mock':e.n===1?'#/ng/check':'#/ng/check/tickets'):'#/ig/nk';
  const left=m.start&&!m.end?Math.max(0,m.start+(m.min||90)*60e3-Date.now()):0;
  render(`<div class="stack"><a href="#/event/${e.id}">← План ${esc(e.short)} · ${esc(e.subjTitle)}</a>
    ${card('plan','Пробный РК на время',`<p class="lead">Билет целиком, без подсказок и разборов, с таймером. Потом — сверка и самооценка в тренировке.</p>
      <div class="row">${ext(mainUrl(href),e.subj==='ng'?'Билет на сайте':'Тренажёр на сайте','btn')}</div>
      <div class="big" id="mockT">${m.end?'Готово':m.start?fmtLeft(left):'90:00'}</div>
      <div class="row">${!m.start||m.end?`<button class="btn pri" type="button" data-act="mockStart" data-id="${e.id}">${m.end?'Ещё раз':'Начать'} — 90 минут</button>`:`<button class="btn pri" type="button" data-act="mockEnd" data-id="${e.id}">Закончил</button>`}</div>`,
      '<b>Почему так:</b> пробный экзамен в тех же условиях — время, без подсказок — лучше всего показывает готовность и снижает тревогу на настоящем (эффект проверки и переноса на формат).')}</div>`,'Пробный РК');
  if(m.start&&!m.end){ const tick=()=>{ const el=$('#mockT'); if(!el) return; el.textContent=fmtLeft(Math.max(0,m.start+(m.min||90)*60e3-Date.now())); setTimeout(tick,1000); }; tick(); } }
const fmtLeft=ms=>{ const s=Math.round(ms/1000); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };

/* ── задача тетради с самооценкой ── */
function taskCard(n,ctx,res,extra){ const t=taskBy(n); if(!t) return '';
  const rep=LS.get(K.rep,{})[n], done=res!=null;
  return `<div class="task${done?' done':''}" data-n="${n}" data-ctx="${esc(ctx)}">
    <div class="k">Задача №${n} · ${esc(topicTitle(t.topic))}${extra?' · '+esc(extra):''}${rep&&rep.n?' · ступень '+(rep.b+1):''}</div>
    <div class="q">${t.q}</div>
    <div class="row">${ext(mainUrl('#/ng/tasks/'+n+'/try'),'Решаю сам — на сайте')}<button class="btn sm" type="button" data-act="qmore">Условие целиком</button></div>
    ${done?`<p class="note ${res===2?'ok':''}">${['Не смог — задача вернётся завтра.','С подсказкой — вернётся через пару дней.','Решил сам — интервал растёт.'][res]}</p>`
    :`<div class="rate" role="group" aria-label="Как получилось?"><button class="btn" type="button" data-act="rate" data-v="2">Решил сам</button><button class="btn" type="button" data-act="rate" data-v="1">С подсказкой</button><button class="btn" type="button" data-act="rate" data-v="0">Не смог</button></div>`}
  </div>`; }
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
function trainView(){ const tr=trainingToday(), f=focusTopics(), rk=nextRk('ng',21);
  render(`<div class="stack">${card('training','Тренировка дня',`<p class="lead">${tr.items.length?'≈ '+tr.minutes+' минут: '+(()=>{ const r=tr.items.filter(i=>i.kind==='review').length, m=tr.items.length-r; return [r?r+' '+plural(r,'задача','задачи','задач')+' на повтор по интервалам':'',m?'одна задача вперемешку':''].filter(Boolean).join(' и '); })()+'.':'Повторять пока нечего. Начните с задачи вперемешку или с рекомендаций на карте навыков.'}${tr.later?' Ещё '+tr.later+' ждут: больше трёх повторов в день — перегрузка.':''}</p>
      ${rk&&f.length?`<p class="mut">Задача вперемешку — из тем ближайшего ${esc(rk.short)} по начерту (${esc(CAL.human(rk.date))}).</p>`:''}
      <ol class="mut"><li>Откройте задачу на сайте в режиме «Решаю сам», решите на бумаге.</li><li>Вернитесь и отметьте честно, как получилось.</li></ol>`,
      '<b>Почему так:</b> вспоминать, а не перечитывать (Roediger, Karpicke, 2006); возвращать задачу через растущие интервалы 1 → 3 → 7 → 16 → 35 дней (Cepeda и др., 2006); одна задача другого типа учит выбирать способ (Rohrer, Taylor, 2007). 15–20 минут в день лучше, чем вечер перед РК.')}
    <div>${tr.items.map(i=>taskCard(i.n,'train',tr.res&&tr.res[i.n],i.kind==='review'?'повтор':'вперемешку')).join('')}</div>
    ${tr.items.length&&!tr.left?'<p class="note ok">На сегодня всё. Следующие задачи вернутся по интервалам.</p>':''}</div>`,'Тренировка дня'); }

/* ── карта навыков ── */
function skillsView(){ const est=estimate(), rep=LS.get(K.rep,{}), f=focusTopics(), rec=BKT.recommend(est,CORE.tasks,rep,f,3);
  const row=s=>{ const o=est[s]||{}, p=BKT.mastery(est,s), lv=BKT.level(p,o.n);
    return `<div class="sk"><div class="h"><b>${esc(topicTitle(s))}</b><span class="lv ${lv.id}">${esc(lv.t)}</span></div><div class="bar"><i class="${lv.id}" data-w="${Math.round(p*100)}"></i></div><small>${o.n?'P(освоено) = '+p.toFixed(2)+' · наблюдений: '+o.n:'данных пока нет — начальная оценка '+p.toFixed(2)}</small></div>`; };
  const groups=[1,2,3].map(k=>({k,tops:CORE.rkTopics[k]||[]}));
  const seen=new Set();
  render(`<div class="stack">
    ${card('skills','Что тренировать',rec.length?`<ul class="list">${rec.map(r=>`<li><b>${esc(topicTitle(r.skill))}</b> <small>P = ${r.p.toFixed(2)}</small><div class="row">${r.tasks.map(n=>ext(mainUrl('#/ng/tasks/'+n+'/try'),'№'+n)).join('')||'<small>Все задачи темы уже в повторении.</small>'}${r.tasks.length?`<button class="btn sm" type="button" data-act="addTrain" data-n="${r.tasks.join(',')}">В тренировку</button>`:''}</div></li>`).join('')}</ul>`:'<p class="mut">Все навыки освоены — повторяйте по интервалам.</p>',
      '<b>Как считается:</b> каждая самооценка — наблюдение. Оценка освоения — Bayesian Knowledge Tracing (Corbett, Anderson, 1995): вероятность «навык освоен» обновляется по формуле Байеса с учётом промаха (знал, но ошибся, 10 %) и угадывания (20 %); освоено — от 0,95. «С подсказкой» считается ошибкой, описка — нет. Отмеченные ошибки («перепутал проекции», «видимость»…) снижают оценку своего навыка, а не только темы задачи.')}
    ${groups.map(g=>`<section class="card"><h2>Начерт · РК${g.k}</h2>${g.tops.filter(s=>!seen.has(s)&&seen.add(s)).map(row).join('')||'<small>—</small>'}</section>`).join('')}
    <section class="card"><h2>ИКГ · лист по ГОСТ</h2>${BKT.IKG_SKILLS.filter(s=>s.id!=='ikg-model'||est[s.id]).map(s=>row(s.id)).join('')}<p class="mut">Данные — из предпроверки своих листов и самооценки в диагностике РК по ИКГ.</p></section>
  </div>`,'Карта навыков'); }

/* ── проверка: фото и нормоконтроль ── */
function checkView(){
  render(`<div class="stack">
    ${flag('scanner')?card('scanner','Проверь решение по фото',`<p class="lead">Сфотографируйте решение задачи тетради — сканер сравнит его с верным построением.</p>
      <p class="note warn">Модуль сканера ещё не подключён: сейчас здесь заглушка, которая честно отвечает «не знаю». Фото обрабатывается на устройстве и никуда не отправляется.</p>
      <label class="f" for="scN">Номер задачи</label><input id="scN" type="number" min="1" max="89" inputmode="numeric" placeholder="например, 52">
      <label class="f" for="scF">Фото решения</label><input id="scF" type="file" accept="image/*" capture="environment">
      <div class="row"><button class="btn pri" type="button" data-act="scan">Проверить</button></div><div id="scOut" aria-live="polite"></div>`,
      '<b>Зачем:</b> быстрая обратная связь по своему решению сразу после попытки полезнее, чем отложенная (Hattie, Timperley, 2007). Интерфейс подключения: <code>scan(фото, задача) → вердикт</code>, см. lib/scanner.js.'):''}
    ${flag('normo')?card('normo','Предпроверка листа ДЗ ИКГ по ГОСТ',`<p class="lead">Загрузите лист в формате SVG (экспорт из САПР) — нормоконтроль основного сайта проверит формат, рамку, основную надпись, линии, шрифт, виды и разрезы, штриховку и размеры (ГОСТ 2.301–2.307, 2.104).</p>
      <label class="f" for="nkF">Лист SVG</label><input id="nkF" type="file" accept=".svg,image/svg+xml">
      <div class="row"><button class="btn pri" type="button" data-act="normo">Проверить мой лист</button></div>
      <p class="mut">Или попробуйте на образцах ДЗ 2: <button class="btn sm" type="button" data-act="normoSample" data-s="ig-v5-clean">верный лист</button> <button class="btn sm" type="button" data-act="normoSample" data-s="ig-v8-thin">с ошибкой в линиях</button> <button class="btn sm" type="button" data-act="normoSample" data-s="ig-v12-numline">с ошибкой в размерах</button></p>
      <div id="nkOut" aria-live="polite"></div>`,
      '<b>Почему так:</b> привычка нормоконтролёра — пройти лист по списку правил до сдачи — переносится на свой лист и снимает «слепоту автора» (Metcalfe, 2017). Это предпроверка: она не заменяет преподавателя и не проверяет то, чего нет в SVG (толщину карандаша на бумаге). Результат своего листа попадает в карту навыков ИКГ.'):''}
    ${!flag('scanner')&&!flag('normo')?'<p class="mut">Раздел сейчас выключен.</p>':''}</div>`,'Проверка'); }

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
async function runNormo(svgText,own,label){ const out=$('#nkOut'); out.innerHTML='<p class="mut">Проверяю лист…</p>';
  try{ if(!window.NORMO) await loadScript('core/normo.js'); try{ await document.fonts.load('italic 22px NchSerif','Ø120 Б–Б'); }catch(e){}
    const svg=sanitizeSvg(svgText), r=NORMO.check(svg,{}), vb=(/viewBox="([-\d.\s]+)"/.exec(svg)||[])[1], v=vb?vb.trim().split(/\s+/).map(Number):null;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    const by={}; r.issues.forEach((i,j)=>{ (by[i.gost]=by[i.gost]||[]).push(Object.assign({j:j+1},i)); });
    out.innerHTML=`<p class="note ${r.issues.length?'warn':'ok'}">${esc(label)}: ${r.issues.length?'замечаний — '+r.issues.length:'замечаний нет'}${r.fmt?' · формат '+esc(r.fmt):''}</p>
      <div class="sheetbox"><img src="${url}" alt="Проверенный лист">${v?`<svg class="ov" viewBox="${v.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${r.issues.filter(i=>i.at).map((i,j)=>`<circle cx="${v[0]+i.at[0]*r.k}" cy="${v[1]+i.at[1]*r.k}" r="${6*r.k}" fill="none" stroke="#d0342b" stroke-width="${1.2*r.k}"/><text x="${v[0]+i.at[0]*r.k+7*r.k}" y="${v[1]+i.at[1]*r.k-5*r.k}" fill="#d0342b" font-size="${5*r.k}" font-family="sans-serif">${j+1}</text>`).join('')}</svg>`:''}</div>
      ${Object.keys(by).map(g=>`<h3>ГОСТ ${esc(g)}</h3><ul>${by[g].map(i=>`<li><b>${esc(i.rule)}</b> — ${esc(i.msg)}</li>`).join('')}</ul>`).join('')}`;
    if(own){ LS.set(K.ev,BKT.merge(LS.get(K.ev,[]),BKT.fromNormo({id:'n'+Date.now().toString(36),t:Date.now(),issues:r.issues}))); out.insertAdjacentHTML('beforeend','<p class="mut">Результат учтён в <a href="#/skills">карте навыков ИКГ</a>.</p>'); } }
  catch(e){ out.innerHTML=`<p class="note bad">Не получилось проверить: ${esc(e.message)}</p>`; } }

/* ── настройки ── */
function settingsView(){ const u=ME.user, r=ME.reminders||REM.DEFAULTS, tz=(()=>{ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone; }catch(e){ return 'Europe/Moscow'; } })();
  const tzs=[...new Set([r.tz,tz,'Europe/Moscow','Europe/Kaliningrad','Europe/Samara','Asia/Yekaterinburg','Asia/Omsk','Asia/Novosibirsk','Asia/Krasnoyarsk','Asia/Irkutsk','Asia/Vladivostok'].filter(Boolean))];
  render(`<div class="stack"><h1>Настройки</h1>
    <section class="card"><h2>Профиль</h2><label class="f" for="pName">Имя</label><div class="row"><input id="pName" class="grow" type="text" maxlength="60" value="${esc(u.name)}"><button class="btn" type="button" data-act="saveName">Сохранить</button></div>
      <p class="mut">Вход: ${u.method==='telegram'?'Telegram':'почта'}${u.telegram&&u.method!=='telegram'?' · Telegram привязан':''} · роль: ${u.role==='admin'?'админ':'участник'}</p>
      <label class="chk"><input type="checkbox" data-chg="photos"${u.photos?' checked':''}> <span>Разрешаю использовать мои фото чертежей для улучшения проверки <small>(необязательно; сейчас фото никуда не отправляются)</small></span></label></section>
    ${flag('reminders')?card('reminders','Напоминания в Telegram',u.telegram?`<p class="lead">Не чаще раза в день, в выбранное время, только когда близко дедлайн или есть задачи на повтор. Без серий и «ты пропустил».</p>
      <label class="chk"><input type="checkbox" id="rOn"${r.enabled?' checked':''}> Присылать напоминания</label>
      <div class="grid2"><div><label class="f" for="rTime">Время</label><input id="rTime" type="time" value="${esc(r.time)}"></div><div><label class="f" for="rTz">Часовой пояс</label><select id="rTz">${tzs.map(z=>`<option${z===r.tz?' selected':''}>${esc(z)}</option>`).join('')}</select></div>
      <div><label class="f" for="rQf">Тихие часы с</label><input id="rQf" type="time" value="${esc(r.quietFrom)}"></div><div><label class="f" for="rQt">до</label><input id="rQt" type="time" value="${esc(r.quietTo)}"></div></div>
      <div class="row"><button class="btn pri" type="button" data-act="saveRem">Сохранить</button>${r.enabled?`<button class="btn" type="button" data-act="pauseRem">${r.paused?'Снять с паузы':'Пауза'}</button>`:''}</div>
      ${r.paused?'<p class="note warn">Напоминания на паузе.</p>':''}<div id="remMsg" aria-live="polite"></div>`
      :`<p class="lead">Напоминания приходят в Telegram. Привяжите Telegram к аккаунту:</p><button class="btn tg" type="button" data-act="linkTg">Привязать Telegram</button><div id="remMsg"></div>`,
      '<b>Почему так:</b> напоминание о конкретном шаге в выбранное время помогает начать; стыд и серии «не прерывай» вредят мотивации и вызывают избегание — их нет.'):''}
    ${flag('sync')?card('sync','Прогресс и синхронизация',`<p class="lead">Прогресс хранится на устройстве (работает офлайн) и в аккаунте. ${lastSync?'Последнее сохранение — '+new Date(lastSync).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'.':''}</p>
      <div class="row"><button class="btn" type="button" data-act="syncNow">Сохранить сейчас</button></div>
      <h3>Перенести прогресс с nachert1830.ru</h3><p class="mut">Клуб живёт на другом адресе, поэтому браузер не даёт ему прочитать прогресс основного сайта напрямую. На сайте: «Тренировка дня» → внизу «Сохранить в файл». Здесь — выберите этот файл:</p>
      <input id="impF" type="file" accept="application/json,.json"><div class="row"><button class="btn" type="button" data-act="import">Перенести</button></div>`):''}
    <section class="card"><h2>Безопасность</h2><div class="row"><button class="btn" type="button" data-act="logins">Журнал входов</button><button class="btn" type="button" data-act="logoutAll">Выйти на всех устройствах</button></div><div id="logOut"></div></section>
    <section class="card"><h2>Мои данные</h2><p class="mut">Храним: имя, способ входа, Telegram id (если входили через Telegram), отпечаток почты, прогресс, настройки напоминаний, отзывы и журнал входов (90 дней). Хранение — Yandex Cloud, Россия.</p>
      <div class="row"><button class="btn" type="button" data-act="export">Скачать мои данные</button><button class="btn dan" type="button" data-act="delete">Удалить аккаунт</button></div>
      <p class="mut"><a href="legal/terms.html">Соглашение</a> · <a href="legal/privacy.html">Политика ПД</a> · <a href="legal/consent.html">Согласие</a></p></section>
    <button class="btn wide" type="button" data-act="logout">Выйти</button></div>`,'Настройки'); }

/* ── «Ещё» ── */
function moreView(){ render(`<div class="stack"><h1>Ещё</h1><section class="card menu">
  ${flag('scanner')||flag('normo')?'<a href="#/check"><span>Проверка<small>решение по фото · предпроверка листа ИКГ</small></span>→</a>':''}
  <a href="#/settings"><span>Настройки<small>профиль, напоминания, перенос прогресса, мои данные</small></span>→</a>
  ${ME.user.role==='admin'?'<a href="#/admin"><span>Админ-панель<small>приглашения, участники, функции, отзывы</small></span>→</a>':''}
  <a href="${esc(mainUrl())}" target="_blank" rel="noopener noreferrer"><span>Основной сайт<small>тетрадь, разборы, тренажёры</small></span>↗</a>
  <a href="#/about"><span>О клубе<small>что это и как оставить отзыв</small></span>→</a></section>
  <button class="btn wide" type="button" data-act="fb" data-f="general">Общий отзыв о клубе</button></div>`,'Ещё'); }
function aboutView(){ render(`<div class="stack"><a href="#/more">← Ещё</a><h1>О клубе</h1><section class="card"><p>Клуб — закрытое тестирование кабинета Начерта на тех же задачах тетради, что на сайте. Функции включаются по одной; у каждой есть кнопка «Отзыв» — туда всё, что мешает, непонятно или нравится.</p>
  <p>Методика — интервальное повторение, перемешивание задач, проверка себя и «Решаю сам»; в каждой функции под чертой — почему она устроена так.</p><p class="mut">Версия ${VER}. Не официальный сервис МГТУ.</p></section></div>`,'О клубе'); }

/* ── админ-панель ── */
let ADMIN_TAB='invites';
async function adminView(){ if(ME.user.role!=='admin'){ render('<p class="note bad">Только для админа.</p>'); return; }
  render('<p class="mut">Загружаю…</p>','Админ-панель'); let D;
  try{ D=await api('GET','/api/admin/overview'); }catch(e){ render(`<p class="note bad">${esc(e.message)}</p>`); return; }
  const dt=ms=>ms?new Date(ms).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
  const names={}; D.users.forEach(u=>{ names[u.id]=u.name; });
  const tabs=[['invites','Приглашения'],['users','Участники'],['flags','Функции'],['feedback','Отзывы'],['logins','Входы'],['settings','Семестр']];
  const st=i=>i.revokedAt?'отозвано':i.usedAt?'использовано: '+esc(names[i.usedBy]||i.usedBy||''):i.expiresAt<Date.now()?'истекло':'действует до '+dt(i.expiresAt);
  const body={
    invites:`<form id="invForm" class="stack"><div class="grid2"><div><label class="f" for="invL">Для кого (подпись)</label><input id="invL" type="text" maxlength="60" placeholder="Аня, ИУ5"></div><div><label class="f" for="invD">Действует, дней</label><input id="invD" type="number" min="1" max="60" value="14"></div></div>
      <label class="chk"><input id="invA" type="checkbox"> роль «админ»</label><button class="btn pri" type="submit">Создать приглашение</button></form><div id="invOut"></div>
      <div class="scroll"><table class="tbl"><tr><th>Подпись</th><th>Статус</th><th></th></tr>${D.invites.map(i=>`<tr><td>${esc(i.label)}${i.role==='admin'?' · админ':''}<br><small>${dt(i.createdAt)}</small></td><td>${st(i)}</td><td>${!i.usedAt&&!i.revokedAt?`<button class="btn sm dan" type="button" data-act="revoke" data-h="${i.h}">Отозвать</button>`:''}</td></tr>`).join('')}</table></div>`,
    users:`<div class="scroll"><table class="tbl"><tr><th>Участник</th><th>Роль</th><th></th></tr>${D.users.map(u=>`<tr><td><b>${esc(u.name)}</b>${u.blocked?' · <span class="mut">заблокирован</span>':''}<br><small>${esc(u.methods.join(', '))} · с ${dt(u.createdAt)} · вход ${dt(u.lastLogin)}${u.reminders?' · напоминания':''}${u.photos?' · фото: да':''}</small></td>
      <td><select data-chg="role" data-id="${u.id}" aria-label="Роль"><option value="member"${u.role==='member'?' selected':''}>участник</option><option value="admin"${u.role==='admin'?' selected':''}>админ</option></select></td>
      <td>${u.id!==ME.user.id?`<button class="btn sm${u.blocked?'':' dan'}" type="button" data-act="block" data-id="${u.id}" data-b="${u.blocked?0:1}">${u.blocked?'Вернуть':'Закрыть доступ'}</button>`:''}</td></tr>`).join('')}</table></div>`,
    flags:`<p class="mut">«Всем» — функция у всех; «Админам» — обкатка; «Выкл» — скрыта.</p><ul class="list">${D.features.map(f=>`<li class="row"><span class="grow">${esc(f.t)}</span><div class="seg" role="group">${[['on','Всем'],['admin','Админам'],['off','Выкл']].map(([m,l])=>`<button type="button" data-act="flag" data-f="${f.id}" data-m="${m}" class="${D.flags[f.id]===m?'on':''}">${l}</button>`).join('')}</div></li>`).join('')}</ul>`,
    feedback:D.feedback.length?`<ul class="list">${D.feedback.map(f=>`<li><b>${esc((D.features.find(x=>x.id===f.feature)||{t:'Общее'}).t)}</b> ${f.mood?'<span class="lv">'+({good:'полезно',unclear:'непонятно',bad:'мешает'})[f.mood]+'</span>':''}<br>${esc(f.text)}<br><small>${esc(f.name)} · ${dt(f.ts)}</small></li>`).join('')}</ul>`:'<p class="mut">Отзывов пока нет.</p>',
    logins:`<div class="scroll"><table class="tbl"><tr><th>Когда</th><th>Кто</th><th>Итог</th></tr>${D.logins.map(l=>`<tr><td>${dt(l.ts)}</td><td>${esc(l.user?names[l.user]||'удалён':'—')}<br><small>${esc(l.method)} · ${esc(l.ip)}</small></td><td>${l.ok?'вход':'отказ'}<br><small>${esc(l.reason)}</small></td></tr>`).join('')}</table></div>`,
    settings:`<label class="f" for="w1">Понедельник недели 1</label><div class="row"><input id="w1" class="grow" type="date" value="${esc(D.settings.week1)}"><button class="btn pri" type="button" data-act="saveWeek1">Сохранить</button></div><p class="mut">По умолчанию 2026-08-31 — проверьте по расписанию МГТУ. От этой даты считаются все недели календаря.</p>`};
  render(`<div class="stack"><h1>Админ-панель</h1><div class="scroll"><div class="seg" role="tablist">${tabs.map(([k,l])=>`<button type="button" role="tab" data-act="atab" data-t="${k}" class="${ADMIN_TAB===k?'on':''}">${l}</button>`).join('')}</div></div>
    <section class="card">${body[ADMIN_TAB]}</section></div>`,'Админ-панель');
  const f=$('#invForm'); if(f) f.addEventListener('submit',async e=>{ e.preventDefault();
    try{ const r=await api('POST','/api/admin/invites',{label:$('#invL').value,days:+$('#invD').value,role:$('#invA').checked?'admin':'member'});
      await adminView(); $('#invOut').innerHTML=`<div class="note ok"><b>Приглашение создано.</b> Ссылка показывается один раз — скопируйте и отправьте лично:<span class="code" id="invLink">${esc(r.link)}</span><button class="btn sm" type="button" data-act="copy" data-t="#invLink">Скопировать</button></div>`; }
    catch(err){ toast(err.message); } }); }

/* ── отзыв ── */
function feedback(f){ const name=f==='general'?'клуб в целом':(FEAT.FEATURES.find(x=>x.id===f)||{t:f}).t;
  openSheet(`<h2>Отзыв: ${esc(name)}</h2><p class="mut">Что полезно, что мешает, что непонятно. Видит только владелец клуба.</p>
    <div class="seg" role="group" id="fbMood">${[['good','Полезно'],['unclear','Непонятно'],['bad','Мешает']].map(([m,l])=>`<button type="button" data-m="${m}">${l}</button>`).join('')}</div>
    <label class="f" for="fbT">Подробнее</label><textarea id="fbT" maxlength="2000"></textarea><div class="row"><button class="btn pri grow" id="fbGo" type="button">Отправить</button><button class="btn" data-close type="button">Отмена</button></div>`,
    bg=>{ let mood=null; $('#fbMood',bg).addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; mood=b.dataset.m; $$('#fbMood button',bg).forEach(x=>x.classList.toggle('on',x===b)); });
      $('#fbGo',bg).addEventListener('click',async()=>{ try{ await api('POST','/api/feedback',{feature:f,mood,text:$('#fbT',bg).value,ver:VER}); closeSheet(); toast('Спасибо! Отзыв отправлен'); }catch(e){ toast(e.message); } }); }); }

/* ── действия ── */
const ACT={
  fb:el=>feedback(el.dataset.f),
  onboardOff:()=>{ LS.device('nch2_club_onboard'); todayView(); },
  tg:async el=>{ const msg=$('#authMsg'); const c=el.dataset.need?consentVal():undefined;
    if(c&&!(c.terms&&c.pd)){ msg.innerHTML='<p class="note bad">Отметьте соглашение и согласие на обработку данных.</p>'; return; }
    let auth=null;
    try{ auth=await telegramAuth(); const r=await api('POST','/api/auth/telegram',{auth,invite:getInvite(),consent:c}); await afterLogin(r); }
    catch(e){ if(e.data&&e.data.needConsent&&auth) return askConsent(auth);
      if(msg) msg.innerHTML=`<p class="note bad">${esc(e.message)}${e.data&&e.data.needInvite?' Новых участников клуб принимает только по ссылке-приглашению.':''}</p>`; } },
  qmore:el=>{ const q=$('.q',el.closest('.task')); q.classList.toggle('open'); el.textContent=q.classList.contains('open')?'Свернуть':'Условие целиком'; },
  rate:el=>{ const t=el.closest('.task'), v=+el.dataset.v; if(v===2) saveRating(t,2,[],[]); else { $$('.rate .btn',t).forEach(b=>b.classList.toggle('pri',b===el)); errorPicker(t,v); } },
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
    if(!t){ out.innerHTML='<p class="note bad">Укажите номер задачи тетради (1–89).</p>'; return; }
    if(!f){ out.innerHTML='<p class="note bad">Выберите фото.</p>'; return; }
    const r=await SCAN.scan(f,{n,topic:t.topic}); const url=URL.createObjectURL(f);
    out.innerHTML=`<img class="photo" src="${url}" alt="Фото решения"><p class="note ${r.verdict==='ok'?'ok':r.verdict==='error'?'bad':'warn'}">${r.error?esc(r.error):r.verdict==='unknown'?'Не знаю: '+esc(r.note||''):r.verdict==='ok'?'Похоже на верное решение.':'Есть расхождения.'}</p>`; },
  normo:async()=>{ const f=$('#nkF').files[0]; if(!f){ $('#nkOut').innerHTML='<p class="note bad">Выберите SVG-файл листа.</p>'; return; }
    if(f.size>8*1024*1024){ $('#nkOut').innerHTML='<p class="note bad">Файл больше 8 МБ.</p>'; return; } runNormo(await f.text(),true,'Ваш лист'); },
  normoSample:async el=>{ try{ const r=await fetch('core/samples/'+el.dataset.s+'.svg'); runNormo(await r.text(),false,'Образец «'+el.textContent+'»'); }catch(e){ toast('Нет сети'); } },
  saveName:async()=>{ try{ const r=await api('POST','/api/me/profile',{name:$('#pName').value}); ME.user=r.user; toast('Сохранено'); }catch(e){ toast(e.message); } },
  saveRem:async()=>{ const b={enabled:$('#rOn').checked,time:$('#rTime').value,quietFrom:$('#rQf').value,quietTo:$('#rQt').value,tz:$('#rTz').value}; await saveRem(b); },
  pauseRem:async()=>{ await saveRem({paused:!(ME.reminders&&ME.reminders.paused)}); },
  linkTg:async()=>{ try{ const auth=await telegramAuth(); const r=await api('POST','/api/me/link/telegram',{auth}); ME.user=r.user; toast('Telegram привязан'); settingsView(); }catch(e){ $('#remMsg').innerHTML=`<p class="note bad">${esc(e.message)}</p>`; } },
  syncNow:async()=>{ const ok=await syncNow(); toast(ok?'Сохранено':syncErr||'Нет сети — сохранится позже'); },
  import:()=>{ const f=$('#impF').files[0]; if(!f){ toast('Выберите файл'); return; } const rd=new FileReader();
    rd.onload=()=>{ const o=J(rd.result); if(!o||o.app!=='nachert'||!o.data||typeof o.data!=='object'){ toast('Это не файл прогресса Начерта'); return; }
      const file={data:{},mt:{}}; Object.keys(o.data).forEach(k=>{ if(SYNC.syncable(k)&&typeof o.data[k]==='string') file.data[k]=o.data[k]; });
      const merged=SYNC.merge(SYNC.readLocal(localStorage),file); const now=Date.now(); Object.keys(file.data).forEach(k=>{ merged.mt[k]=now; });
      SYNC.writeLocal(localStorage,merged); const tr=LS.get(K.train,{}); delete tr.day; LS.device(K.train,tr); markDirty();
      const reps=Object.keys(J(merged.data.nch2_rep||'{}')||{}).length; toast('Перенесено. Задач в повторении: '+reps); };
    rd.readAsText(f); },
  logins:async()=>{ try{ const r=await api('GET','/api/me/logins'); $('#logOut').innerHTML=`<div class="scroll"><table class="tbl"><tr><th>Когда</th><th>Как</th><th>Итог</th></tr>${r.logins.map(l=>`<tr><td>${new Date(l.ts).toLocaleString('ru-RU')}</td><td>${esc(l.method)}<br><small>${esc(l.ip)} · ${esc(l.ua.slice(0,40))}</small></td><td>${l.ok?'вход':'отказ: '+esc(l.reason)}</td></tr>`).join('')}</table></div>`; }catch(e){ toast(e.message); } },
  logoutAll:async()=>{ if(!confirm('Выйти на всех устройствах, включая это?')) return; await syncNow(); try{ await api('POST','/api/auth/logout-all',{}); }catch(e){} wipeLocal(); ME=null; route(); },
  logout:async()=>{ if(isDirty()&&!(await syncNow())&&!confirm('Есть несохранённый прогресс, а сети нет. Выйти и потерять его на этом устройстве?')) return;
    try{ await api('POST','/api/auth/logout',{}); }catch(e){} wipeLocal(); ME=null; location.hash='#/'; route(); },
  export:async()=>{ try{ const r=await fetch('/api/me/export',{credentials:'same-origin'}); if(!r.ok) throw new Error('Не получилось'); const b=await r.blob(), u=URL.createObjectURL(b), a=document.createElement('a');
    a.href=u; a.download='nachert-club-my-data.json'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(u); a.remove(); },1500); }catch(e){ toast(e.message); } },
  delete:()=>openSheet(`<h2>Удалить аккаунт</h2><p>Удалятся имя, способы входа, прогресс в аккаунте, настройки, отзывы и журнал входов. Это нельзя отменить. Перед удалением можно <button class="btn sm" type="button" data-act="export">скачать свои данные</button>.</p>
    <label class="f" for="delC">Введите слово УДАЛИТЬ</label><input id="delC" type="text" autocomplete="off"><div class="row"><button class="btn dan grow" id="delGo" type="button">Удалить навсегда</button><button class="btn" data-close type="button">Отмена</button></div>`,
    bg=>{ $('#delGo',bg).addEventListener('click',async()=>{ try{ await api('POST','/api/me/delete',{confirm:$('#delC',bg).value.trim()}); closeSheet(); wipeLocal(); ME=null; toast('Аккаунт удалён'); location.hash='#/'; route(); }catch(e){ toast(e.message); } }); }),
  copy:async el=>{ const t=$(el.dataset.t).textContent; try{ await navigator.clipboard.writeText(t); toast('Скопировано'); }catch(e){ toast('Выделите и скопируйте вручную'); } },
  atab:el=>{ ADMIN_TAB=el.dataset.t; adminView(); },
  revoke:async el=>{ if(!confirm('Отозвать приглашение?')) return; try{ await api('POST','/api/admin/invites/revoke',{h:el.dataset.h}); adminView(); }catch(e){ toast(e.message); } },
  block:async el=>{ try{ await api('POST','/api/admin/users/block',{id:el.dataset.id,blocked:el.dataset.b==='1'}); adminView(); }catch(e){ toast(e.message); } },
  flag:async el=>{ try{ await api('POST','/api/admin/flags',{flags:{[el.dataset.f]:el.dataset.m}}); await loadMe(); adminView(); }catch(e){ toast(e.message); } },
  saveWeek1:async()=>{ try{ await api('POST','/api/admin/settings',{week1:$('#w1').value}); await loadMe(); toast('Сохранено'); }catch(e){ toast(e.message); } }
};
async function saveRem(b){ const m=$('#remMsg'); try{ const r=await api('POST','/api/me/reminders',b); ME.reminders=r.reminders; settingsView(); toast(r.reminders.enabled?(r.reminders.paused?'Напоминания на паузе':'Напоминания включены'):'Напоминания выключены'); }
  catch(e){ if(m) m.innerHTML=`<p class="note bad">${esc(e.message)}</p>${e.data&&e.data.bot?ext(e.data.bot,'Открыть бота','btn'):''}`; } }
const CHG={
  classDay:el=>{ const s=calSet(); s.classDay=Object.assign({},s.classDay,{[el.dataset.s]:+el.value}); LS.set(K.cal,s); calendarView(); },
  subj:el=>{ const s=CAL.normSettings(calSet()); const set=new Set(s.subjects); if(el.checked) set.add(el.dataset.s); else set.delete(el.dataset.s); const c=calSet(); c.subjects=[...set]; LS.set(K.cal,c); calendarView(); },
  evDate:el=>{ const s=calSet(); s.dates=Object.assign({},s.dates,{[el.dataset.id]:el.value}); LS.set(K.cal,s); eventView(el.dataset.id); },
  step:el=>{ setDone(el.dataset.k,el.checked); el.closest('li').classList.toggle('done',el.checked); },
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
  if(p[0]==='magic'&&p[1]){ const tok=p[1]; history.replaceState(null,'','#/'); return magicView(tok); }
  if(!ME){ if(p[0]==='join'||getInvite()) return inviteView(); return loginView(); }
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
