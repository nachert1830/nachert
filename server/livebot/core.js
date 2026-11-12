/* Бот записи на бесплатные онлайн-разборы (эфиры) — логика без сети.
   Отдельно от кабинета: свой токен, своё хранилище (JSON-файл), запуск — run.js (long polling, без вебхука и домена).
   Как развернуть — server/livebot/README.md; что это и зачем — docs/LIVE.md.

   Ученик: /start → выбор эфира кнопкой → «Записал». За 2 часа — напоминание, за 15 минут — ссылка на VK Встречи,
   после эфира — «Помогло?». Кнопка «Ссылка на эфир» отдаёт ссылку сама, если напоминание не дошло. /my, /delete.
   Владелец (ADMIN_IDS): /add, /link, /del, /list, /say — расписание и ссылка задаются командами, без правки кода.
   Число записавшихся видит только владелец (/list) — публичного счётчика нигде нет.

   Персональные данные — минимум: номер чата, имя из Telegram (как обращаться), откуда пришёл (site/form).
   Удаляются через 30 дней после эфира или сразу по /delete; от эфиров остаются только числа (записалось, помогло). */
'use strict';
const TZ_OFF=3*3600e3;                                   /* время эфиров — московское */
const MIN=60e3, H=60*MIN, DAY=24*H;
const KEEP=30*DAY, DEF_MIN=60;                          /* длительность эфира по умолчанию — 1 час */
const WD=['вс','пн','вт','ср','чт','пт','сб'];

const two=n=>String(n).padStart(2,'0');
const msk=t=>new Date(t+TZ_OFF);
const fmtDay=t=>{ const d=msk(t); return WD[d.getUTCDay()]+' '+two(d.getUTCDate())+'.'+two(d.getUTCMonth()+1); };
const fmtTime=t=>{ const d=msk(t); return two(d.getUTCHours())+':'+two(d.getUTCMinutes()); };
const fmtWhen=t=>fmtDay(t)+' в '+fmtTime(t);
/* «10.11 20:00» (год — ближайший будущий) → метка времени; неверно — null */
function parseWhen(dm,hm,now){ const a=/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/.exec(dm||''), b=/^(\d{1,2})[:.](\d{2})$/.exec(hm||''); if(!a||!b) return null;
  const d=+a[1], m=+a[2], hh=+b[1], mm=+b[2]; if(d<1||d>31||m<1||m>12||hh>23||mm>59) return null;
  let y=a[3]?+a[3]:msk(now).getUTCFullYear();
  const at=y=>Date.UTC(y,m-1,d,hh,mm)-TZ_OFF; let t=at(y);
  if(!a[3]&&t<now-DAY) t=at(y+1);
  return msk(t).getUTCDate()===d?t:null; }
const clean=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const okLink=s=>/^https:\/\/[^\s]{4,300}$/.test(s||'');
const DUR=s=>(s&&s.min||90)*MIN;                         /* у старых записей без min — 1,5 часа, как было */
const fmtDur=s=>{ const m=s&&s.min||90; return m===60?'1 час':m===90?'1,5 часа':m===120?'2 часа':m+' мин'; };

function emptyState(){ return {v:1,seq:0,sessions:[],users:{},offset:0}; }

function createLiveBot(o){
  const {api,load,save,now=()=>Date.now(),admins=[],site='https://nachert1830.ru',log=()=>{},schedule=()=>[],welcome=false,startClosed=false}=o;   /* startClosed — запись закрыта, пока владелец её не откроет */   /* welcome — есть картинка-приветствие (run.js загрузит её сам) */
  const isAdmin=id=>admins.map(String).includes(String(id));
  const S=()=>load()||emptyState();

  /* kb: массив — кнопки под сообщением; объект — готовый reply_markup (меню владельца внизу экрана) */
  async function send(chat,text,kb){ const r=await api('sendMessage',Object.assign({chat_id:chat,text,disable_web_page_preview:true},kb?{reply_markup:Array.isArray(kb)?{inline_keyboard:kb}:kb}:{}));
    if(r&&r.ok===false) log('не отправлено',chat,r.error_code||'',r.description||''); return r; }
  const upcoming=(st,t)=>st.sessions.filter(s=>s.start+DUR(s)>t).sort((a,b)=>a.start-b.start);
  const label=s=>fmtDay(s.start)+' · '+fmtTime(s.start)+' · '+s.topic;
  const subOf=(s,chat)=>s.subs&&s.subs[String(chat)];
  const linkOpen=(s,t)=>t>=s.start-30*MIN&&t<s.start+DUR(s);
  /* эфир по номеру; после переноса старый номер (кнопки в старых сообщениях) ведёт на тот же эфир */
  const byId=(st,id)=>st.sessions.find(x=>x.id===id)||st.sessions.find(x=>(x.was||[]).includes(id));
  const idOf=when=>{ const d=msk(when); return two(d.getUTCDate())+two(d.getUTCMonth()+1)+two(d.getUTCHours())+two(d.getUTCMinutes()); };

  const NOTICE='Бот хранит только твоё имя, чат и вопросы — чтобы ответить. /delete — удалить.';
  /* запись на эфиры: открыта/закрыта — переключает владелец кнопкой; закрыта — /start предлагает задать вопрос */
  const isOpen=st=>st.open!=null?!!st.open:!startClosed;
  /* откуда пришёл вопрос (параметр /start с сайта): q-rk2-ang → «РК2 за 9 шагов, тема „Угол между прямыми“» */
  const TOP={ang:'Угол между прямыми',incl:'Угол наклона плоскости',nv:'Натуральная величина',bis:'Биссектриса',dll:'Расстояние между прямыми',dpp:'Расстояние до плоскости',dih:'Угол между плоскостями',tri:'Треугольник на прямой',sq:'Квадрат на прямой'};
  const srcName=src=>{ const m=/^q-?(rk2|rot|live|dz3|site|home)?-?([a-z0-9]*)$/.exec(src||''); if(!m) return '';
    const [,w,x]=m; return w==='rk2'?'РК2 за 9 шагов'+(TOP[x]?', тема «'+TOP[x]+'»':''):w==='rot'?'Способ вращения':w==='dz3'?'ДЗ №3'+(x?', вариант '+x:''):w==='live'?'страница эфиров':'сайт'; };
  const LINKS='«РК2 за 9 шагов» — все типы задач билета по шагам 👉 '+site+'/#/ng/rk2\nСпособ вращения 👉 '+site+'/#/ng/rot';
  const ASK='Напиши свой вопрос одним сообщением — можно с фото чертежа или скриншотом. Отвечу здесь же, в этом чате.';
  /* «сегодня в 20:00» / «завтра в 20:00» / «чт 12.11 в 20:00» — по Москве */
  const when=(s,t)=>{ const d=Math.round((Date.UTC(msk(s.start).getUTCFullYear(),msk(s.start).getUTCMonth(),msk(s.start).getUTCDate())-Date.UTC(msk(t).getUTCFullYear(),msk(t).getUTCMonth(),msk(t).getUTCDate()))/DAY);
    return (d===0?'сегодня в ':d===1?'завтра в ':fmtDay(s.start)+' в ')+fmtTime(s.start); };
  const cap=x=>x.charAt(0).toUpperCase()+x.slice(1);
  function startText(st,t,chat){ const U=upcoming(st,t).slice(0,6);
    if(!isOpen(st)) return {text:'Привет! Эфиров пока нет — запись закрыта.\n\nЕсть вопрос по начерту — задай его здесь, отвечу лично.\n\nВесь материал с эфиров — на сайте:\n'+LINKS+'\n\n'+NOTICE,kb:[[{text:'❓ Задать вопрос',callback_data:'q:'}]],closed:true};
    if(!U.length) return {text:'Привет! Эфиров пока не будет.\n\nВесь материал с эфира — на сайте: «РК2 за 9 шагов», каждый тип задачи билета решён по шагам, как на листе 👉 '+site+'/#/ng/rk2\nСпособ вращения подробно 👉 '+site+'/#/ng/rot',kb:null};
    const f=U[0], live=f.start<=t, me=!!subOf(f,chat);
    const top=me?{text:'🔗 Ссылка на эфир',callback_data:'l:'+f.id}:{text:'✅ Я приду',callback_data:'j:'+f.id};
    const more=U.slice(1,4).map(s=>({text:(subOf(s,chat)?'✓ ':'')+fmtDay(s.start),callback_data:'j:'+s.id}));
    return {text:'Бесплатный разбор РК2 в VK Встречах.\n\n'+(live?'🔴 Эфир идёт — ':'📅 ')+cap(when(f,t))+' МСК'+(me?'\n✅ Ты записан — ссылку пришлю за 15 минут.':'')+
      '\n\n'+NOTICE,
      kb:[[top]].concat(more.length?[more]:[])}; }
  /* приветствие: с картинкой, если она есть (file_id запоминаем после первой загрузки); не вышло — просто текстом */
  async function sendStart(st,t,chat){ const r=startText(st,t,chat);
    if(welcome&&!r.closed){ const res=await api('sendPhoto',Object.assign({chat_id:chat,photo:st.wid||{upload:true},caption:r.text},r.kb?{reply_markup:{inline_keyboard:r.kb}}:{}));
      if(res&&res.ok){ const ph=res.result&&res.result.photo; if(!st.wid&&ph&&ph.length){ st.wid=ph[ph.length-1].file_id; save(st); } return; }
      if(st.wid){ delete st.wid; save(st); } log('картинка-приветствие не отправилась',res&&res.description||''); }
    await send(chat,r.text,r.kb); }
  const joinedKb=s=>[[{text:'🔗 Ссылка',callback_data:'l:'+s.id},{text:'Отменить',callback_data:'c:'+s.id}]];

  /* ── обновление от Telegram ── */
  async function onUpdate(u){
    const st=S(), t=now();
    if(u.callback_query){ const q=u.callback_query, from=q.from||{}, chat=(q.message&&q.message.chat&&q.message.chat.id)||from.id, [k,id,arg]=String(q.data||'').split(':');
      await api('answerCallbackQuery',{callback_query_id:q.id});
      if(k==='a'){ if(isAdmin(from.id)) await adminTap(st,t,chat,String(q.data).split(':').slice(1)); return; }
      if(k==='q'){ askMode(st,chat,'',t); await send(chat,ASK); return; }
      if(k==='j'&&!isOpen(st)){ await send(chat,'Запись на эфиры пока закрыта. Есть вопрос — задай его здесь, отвечу лично.\n\n'+LINKS,[[{text:'❓ Задать вопрос',callback_data:'q:'}]]); return; }
      const s=byId(st,id);
      if(!s){ await send(chat,'Этого эфира уже нет. /start — ближайшие.'); return; }
      if(k==='j'){
        if(s.start+DUR(s)<=t){ await send(chat,'Эфир уже закончился. /start — ближайшие.'); return; }
        s.subs=s.subs||{}; const was=!!subOf(s,chat);
        if(!was){ s.subs[String(chat)]={name:clean(from.first_name,40),at:t,src:(st.users[String(chat)]||{}).src||''}; s.n=(s.n||0)+1; }
        st.users[String(chat)]=Object.assign(st.users[String(chat)]||{},{seen:t}); save(st);
        if(!was) for(const a of admins) if(String(a)!==String(chat)) await send(a,'➕ '+(clean(from.first_name,40)||'Кто-то')+' · '+fmtDay(s.start)+' '+fmtTime(s.start)+' · всего '+Object.keys(s.subs).length);
        const live=linkOpen(s,t)&&s.link;
        await send(chat,(live?'Ссылка на эфир 👉 '+s.link:(was?'Ты уже записан ✅':'Готово, ты записан ✅')+'\n'+cap(when(s,t))+' МСК. Ссылку пришлю за 15 минут.'),joinedKb(s));
        return; }
      if(k==='l'){
        if(!subOf(s,chat)){ await send(chat,'Ты не записан. /start — записаться.'); return; }
        if(s.link&&linkOpen(s,t)){ await send(chat,'👉 '+s.link); return; }
        await send(chat,s.start+DUR(s)<=t?'Эфир уже закончился.':'Ссылка придёт за 15 минут до начала.'); return; }
      if(k==='c'){
        if(subOf(s,chat)){ const nm=s.subs[String(chat)].name; delete s.subs[String(chat)]; s.n=Math.max(0,(s.n||1)-1); save(st);
          for(const a of admins) if(String(a)!==String(chat)) await send(a,'➖ '+(nm||'Кто-то')+' · '+fmtDay(s.start)+' '+fmtTime(s.start)+' · всего '+Object.keys(s.subs).length); }
        await send(chat,'Запись отменена. Передумаешь — /start.'); return; }
      if(k==='f'&&['y','p','n'].includes(arg)){
        const sub=subOf(s,chat); if(sub&&!sub.fb){ sub.fb=arg; s.fb=s.fb||{y:0,p:0,n:0}; s.fb[arg]++; save(st); }
        await send(chat,arg==='y'?'Спасибо! Закрепи сам: '+site+'/#/ng/rk2':'Спасибо! Напиши, что осталось непонятным — разберём.');
        return; }
      return; }

    const m=u.message; if(!m||!m.chat||m.chat.type!=='private') return;
    const body=typeof m.text==='string'?m.text:typeof m.caption==='string'?m.caption:'', media=typeof m.text!=='string';
    if(!body&&!media) return;
    const chat=m.chat.id, from=m.from||{}, text=body.trim(), [cmd0,...rest]=(media?'':text).split(/\s+/), cmd=(cmd0||'').replace(/@\w+$/,'').toLowerCase();

    /* владелец: ответ на вопрос — свайпом «Ответить» на сообщение с вопросом, или после кнопки «✍️ Ответить» */
    if(isAdmin(from.id)){ const qa=m.reply_to_message&&findQ(st,x=>(x.amid||[]).includes(m.reply_to_message.message_id)), W=waiting(st,chat);
      const target=qa||(W&&W.w==='ans'&&findQ(st,x=>x.id===W.qid));
      const menuBtn=!media&&(Object.values(B).includes(text)||/^🔒|^🔓/.test(text));   /* нажатая кнопка меню — не ответ */
      if(target&&!(cmd&&cmd.startsWith('/'))&&!menuBtn){ if(!qa) wait(st,chat,null); return answer(st,t,chat,target,m); }
      if(menuBtn&&W&&W.w==='ans') wait(st,chat,null);
      if(media){ await send(chat,'Чтобы ответить на вопрос с фото — нажми «✍️ Ответить» у вопроса или ответь на него свайпом.'); return; }
      if(await adminText(st,t,chat,cmd,rest,text)!==false) return; }
    if(cmd==='/start'){ const src=clean(rest[0],32).replace(/[^\w-]/g,'');
      const me=st.users[String(chat)]=Object.assign(st.users[String(chat)]||{},{seen:t}); if(src&&!me.src) me.src=src; save(st);
      if(/^q/.test(src)){ askMode(st,chat,src,t); await send(chat,'Привет! '+(srcName(src)?'Вопрос по разделу: '+srcName(src)+'.\n\n':'')+ASK); return; }
      return sendStart(st,t,chat); }
    if(cmd==='/my'){ const mine=upcoming(st,t).filter(s=>subOf(s,chat));
      await send(chat,mine.length?'Твои записи:\n'+mine.map(s=>'• '+label(s)).join('\n'):'Записей нет. /start — записаться.',mine.length?mine.map(s=>[{text:'Ссылка: '+label(s),callback_data:'l:'+s.id}]):null); return; }
    if(cmd==='/delete'){ let n=0; st.sessions.forEach(s=>{ if(subOf(s,chat)){ delete s.subs[String(chat)]; s.n=Math.max(0,(s.n||1)-1); n++; } }); delete st.users[String(chat)]; st.qs=(st.qs||[]).filter(x=>String(x.chat)!==String(chat)); save(st);
      await send(chat,'Удалил твои данные. Напоминаний не будет.'); return; }

    if(cmd==='/ask'){ askMode(st,chat,'',t); await send(chat,ASK); return; }
    if(cmd==='/help'||cmd.startsWith('/')){ await send(chat,'/ask — задать вопрос\n/start — начало\n/delete — удалить мои данные'); return; }
    /* любое сообщение ученика (текст, фото, файл) — вопрос: сохраняем, владельцу — карточка вопроса с кнопкой «Ответить» */
    if(!isAdmin(from.id)&&(media||text.length>1)) return question(st,t,chat,from,m,text,media);
  }

  /* ── вопросы ── */
  const findQ=(st,f)=>(st.qs||[]).find(f);
  function askMode(st,chat,src,t){ const me=st.users[String(chat)]=Object.assign(st.users[String(chat)]||{},{seen:t}); me.ask=src||me.ask||''; save(st); }
  async function question(st,t,chat,from,m,text,media){
    const me=st.users[String(chat)]=Object.assign(st.users[String(chat)]||{},{seen:t}), src=me.ask||me.src||'';
    st.qseq=(st.qseq||0)+1; const q={id:st.qseq,chat,name:clean(from.first_name,40)||'',src,text:clean(text,600),at:t,amid:[]};
    st.qs=(st.qs||[]).concat(q).slice(-300); save(st);
    const head='❓ Вопрос №'+q.id+' · '+(q.name||'без имени')+(srcName(src)?' · '+srcName(src):'')+'\n\n'+(q.text||(media?'(фото / файл — ниже)':''))+'\n\n↩️ Ответь на это сообщение свайпом — ответ уйдёт ученику.';
    for(const a of admins){ const r=await send(a,head,[[{text:'✍️ Ответить',callback_data:'a:qa:'+q.id},{text:'✓ Без ответа',callback_data:'a:qd:'+q.id}]]);
      if(r&&r.result&&r.result.message_id) q.amid.push(r.result.message_id);
      if(media){ const f=await api('forwardMessage',{chat_id:a,from_chat_id:chat,message_id:m.message_id}); if(f&&f.result&&f.result.message_id) q.amid.push(f.result.message_id); } }
    save(st);
    await send(chat,'Получил вопрос ✅ Отвечу здесь же — обычно в течение дня.\n\nПока можно посмотреть разборы на сайте:\n'+LINKS); }
  async function answer(st,t,admin,q,m){
    const r1=await send(q.chat,'💬 Ответ на твой вопрос'+(q.text?' «'+q.text.slice(0,80)+(q.text.length>80?'…':'')+'»':'')+':');
    const r2=await api('copyMessage',{chat_id:q.chat,from_chat_id:admin,message_id:m.message_id});
    const ok=!(r1&&r1.ok===false)&&!(r2&&r2.ok===false);
    if(ok){ q.ans=t; q.n=(q.n||0)+1; save(st); }
    await send(admin,ok?'Отправил ответ на вопрос №'+q.id+' ✅'+(q.n>1?' (ещё одно сообщение)':''):'Не дошло: ученик заблокировал бота или удалил чат.'); }
  async function questions(st,t,chat){ const Q=(st.qs||[]).filter(x=>!x.ans&&!x.skip).slice(-10), all=(st.qs||[]).length;
    if(!Q.length){ await send(chat,'Новых вопросов нет ✅'+(all?' Всего было: '+all+'.':'')+'\n\nКогда ученик пишет боту, вопрос приходит сюда — ответь на него свайпом «Ответить».'); return; }
    await send(chat,'❓ Без ответа: '+Q.length+(all>Q.length?' (всего вопросов '+all+')':'')+'\nНажми «Ответить» — и следующим сообщением напиши ответ.');
    for(const q of Q){ const r=await send(chat,'№'+q.id+' · '+(q.name||'без имени')+' · '+fmtDay(q.at)+' '+fmtTime(q.at)+(srcName(q.src)?' · '+srcName(q.src):'')+'\n\n'+(q.text||'(фото / файл)'),[[{text:'✍️ Ответить',callback_data:'a:qa:'+q.id},{text:'✓ Без ответа',callback_data:'a:qd:'+q.id}]]);
      if(r&&r.result&&r.result.message_id){ q.amid=(q.amid||[]).concat(r.result.message_id).slice(-6); } }
    save(st); }

  /* ── владелец: меню кнопками внизу экрана + те же действия текстовыми командами ── */
  const B={count:'👥 Кто придёт',add:'➕ Эфир',link:'🔗 Ссылка',say:'📣 Написать',list:'📅 Эфиры',student:'👀 Как видят ученики',qs:'❓ Вопросы',all:'📣 Всем ученикам'};
  /* меню внизу экрана: вопросы и «как видят» — сверху; запись — переключатель с текущим состоянием */
  const regBtn=st=>isOpen(st)?'🔓 Запись открыта · закрыть':'🔒 Запись закрыта · открыть';
  const MENUof=st=>({keyboard:[[{text:B.qs},{text:B.student}],[{text:regBtn(st)},{text:B.all}],[{text:B.count},{text:B.add},{text:B.link}]],resize_keyboard:true,is_persistent:true});
  const TOPICS=['РК2','ДЗ № 2–3'], TIMES=['18:00','19:00','20:00','21:00'];
  const CANCEL=[{text:'Отмена',callback_data:'a:c'}];
  const ymd=t=>{ const d=msk(t); return d.getUTCFullYear()+two(d.getUTCMonth()+1)+two(d.getUTCDate()); };
  const dmy=k=>k.slice(6,8)+'.'+k.slice(4,6)+'.'+k.slice(0,4);
  const wait=(st,chat,w)=>{ st.adm=st.adm||{}; if(w) st.adm[String(chat)]=w; else delete st.adm[String(chat)]; save(st); };
  const waiting=(st,chat)=>(st.adm||{})[String(chat)]||null;
  const subsN=s=>Object.keys(s.subs||{}).length;
  const pick=(st,t,act)=>upcoming(st,t).slice(0,8).map(s=>[{text:label(s)+' · '+subsN(s),callback_data:'a:'+act+':'+s.id}]);

  async function menu(chat,txt,st0){ const MENU=MENUof(st0||S()); await send(chat,txt||'Меню внизу 👇\n'+B.qs+' — вопросы учеников (ответить: свайп «Ответить» на вопрос)\n'+B.student+' — что видит ученик в боте\n🔒/🔓 — закрыть или открыть запись на эфиры\n'+B.all+' — сообщение всем, кто писал боту\n'+B.count+' / '+B.add+' / '+B.link+' — эфиры',MENU); }
  async function card(st,t,chat,s){ const W=Object.values(s.subs||{});
    await send(chat,label(s)+' · '+fmtDur(s)+'\nЗаписались ('+W.length+'): '+(W.map(w=>w.name||'без имени').join(', ')||'пока никого')+'\nСсылка: '+(s.link||'нет')+(s.fb?'\nПомогло: '+s.fb.y+' · частично: '+s.fb.p+' · нет: '+s.fb.n:''),
      [[{text:'🔗 Ссылка',callback_data:'a:l:'+s.id},{text:'📣 Написать',callback_data:'a:m:'+s.id}],[{text:'⏰ Перенести',callback_data:'a:v:'+s.id},{text:'⏱ '+fmtDur(s),callback_data:'a:u:'+s.id}],[{text:'🗑 Отменить',callback_data:'a:x:'+s.id}]]); }

  async function list(st,t,chat){ const U=upcoming(st,t), P=st.sessions.filter(s=>s.start+DUR(s)<=t).sort((a,b)=>b.start-a.start).slice(0,5);
    if(!U.length&&!P.length){ await send(chat,'Эфиров пока нет.',[[{text:B.add,callback_data:'a:add'}]]); return; }
    await send(chat,(U.length?'Ближайшие (нажми — подробности):':'Ближайших нет.')+(P.length?'\n\nПрошедшие:\n'+P.map(s=>'◦ '+label(s)+' — записалось '+(s.n||0)+(s.fb?', помогло '+s.fb.y+' из '+(s.fb.y+s.fb.p+s.fb.n):'')).join('\n'):''),
      U.slice(0,8).map(s=>[{text:label(s)+' · записалось '+(s.n||0)+(s.link?'':' · без ссылки'),callback_data:'a:s:'+s.id}]).concat([[{text:B.add,callback_data:'a:add'}]])); }
  async function dayPicker(chat,t){ const D=[]; for(let i=0;i<8;i++) D.push(t+i*DAY);
    const row=[]; D.forEach((d,i)=>{ if(i%2===0) row.push([]); row[row.length-1].push({text:(i===0?'Сегодня, ':i===1?'Завтра, ':'')+fmtDay(d),callback_data:'a:d:'+ymd(d)}); });
    await send(chat,'Какой день?',row.concat([CANCEL])); }
  async function doAdd(st,t,chat,when,topic){
    if(when<t-MIN){ await send(chat,'Это время уже прошло: '+fmtWhen(when)); return null; }
    const d=msk(when), id=two(d.getUTCDate())+two(d.getUTCMonth()+1)+two(d.getUTCHours())+two(d.getUTCMinutes());
    if(st.sessions.some(s=>s.id===id)){ await send(chat,'Эфир '+fmtWhen(when)+' уже есть.'); return null; }
    const s={id,start:when,min:DEF_MIN,topic,link:'',subs:{},n:0,sent:{}}; st.sessions.push(s); st.gone=(st.gone||[]).filter(x=>x!==id); wait(st,chat,null);
    await send(chat,'Добавил: '+fmtWhen(when)+' — '+topic+', '+fmtDur(s)+'.',
      [[{text:'🔗 Прислать ссылку',callback_data:'a:l:'+id}],[{text:'⏱ Длительность: '+fmtDur(s),callback_data:'a:u:'+id},{text:'➕ Ещё эфир',callback_data:'a:add'}]]); return s; }
  async function doLink(st,chat,s,url){
    if(!okLink(url)){ await send(chat,'Нужна ссылка вида https://vk.com/call/join/… — пришли ещё раз.',[CANCEL]); return; }
    s.link=url; wait(st,chat,null); await send(chat,'Ссылка для «'+label(s)+'» сохранена. Записанным уйдёт за 15 минут до начала.'); }
  async function doSay(st,chat,s,msg){ let n=0; const all=Object.keys(s.subs||{});
    for(const c of all){ const r=await send(c,msg); if(!r||r.ok!==false) n++; }
    wait(st,chat,null); await send(chat,'Отправил: '+n+' из '+all.length+(n<all.length?' (остальные заблокировали бота)':'')); }
  /* перенос эфира на другое время: записи сохраняются, напоминания отправятся заново по новому времени,
     записанным — сообщение о переносе. chat — кто перенёс (владелец) или null (по расписанию). */
  async function doMove(st,t,chat,s,to){
    if(to<t-MIN){ if(chat) await send(chat,'Это время уже прошло: '+fmtWhen(to)); return null; }
    const nid=idOf(to), old=s.start, oid=s.id;
    if(nid===oid){ if(chat) await send(chat,'Эфир и так '+fmtWhen(to)+'.'); return null; }
    const other=st.sessions.find(x=>x.id===nid&&x!==s);
    if(other){ /* на новое время уже есть эфир — сливаем записи в него */
      other.subs=Object.assign({},s.subs||{},other.subs||{}); other.n=Object.keys(other.subs).length; other.was=(other.was||[]).concat(oid,s.was||[]);
      if(!other.link&&s.link) other.link=s.link; st.sessions=st.sessions.filter(x=>x!==s); s=other; }
    else { s.id=nid; s.start=to; s.sent={}; s.was=(s.was||[]).concat(oid); }
    st.gone=(st.gone||[]).filter(x=>x!==nid).concat(oid).slice(-50); if(chat) wait(st,chat,null); save(st);
    const subs=Object.keys(s.subs||{}), sameDay=fmtDay(old)===fmtDay(to);
    const msg='⏰ Эфир перенесли: '+(sameDay?'':'с '+fmtWhen(old)+' ')+(sameDay?when(s,t)+' МСК (вместо '+fmtTime(old)+')':'на '+when(s,t)+' МСК')+'.\nТы записан — ссылку пришлю за 15 минут. Не получается — нажми «Отменить».';
    let n=0; for(const c of subs){ const r=await send(c,msg,joinedKb(s)); if(!r||r.ok!==false) n++; }
    const rep='⏰ Перенёс: '+fmtWhen(old)+' → '+fmtWhen(to)+'. Записанным ('+subs.length+') отправил сообщение'+(n<subs.length?' ('+n+' дошло)':'')+'.';
    if(chat) await send(chat,rep); else for(const a of admins) await send(a,rep+' (по расписанию)');
    log('перенос:',oid,'→',s.id,'записаны',subs.length); return s; }
  async function doDel(st,t,chat,s){
    if(s.start+DUR(s)>t) for(const c of Object.keys(s.subs||{})) await send(c,'Эфир '+fmtWhen(s.start)+' отменён. Извини! /start — ближайшие.');
    st.sessions=st.sessions.filter(x=>x!==s); st.gone=(st.gone||[]).concat(s.id).slice(-50); wait(st,chat,null); await send(chat,'Отменил: '+label(s)); }
  async function who(chat,s){ const W=Object.values(s.subs||{});
    await send(chat,label(s)+' — записаны '+W.length+':\n'+(W.map(w=>'• '+(w.name||'без имени')+(w.src?' ('+w.src+')':'')).join('\n')||'пока никого')); }
  async function chooseOr(st,t,chat,act,ask){ const U=upcoming(st,t);
    if(!U.length){ await send(chat,'Ближайших эфиров нет.',[[{text:B.add,callback_data:'a:add'}]]); return; }
    if(U.length===1) return adminTap(st,t,chat,[act,U[0].id]);
    await send(chat,ask,pick(st,t,act).concat([CANCEL])); }

  /* нажатие кнопки владельца: a:<действие>:<параметры> */
  async function adminTap(st,t,chat,P){ const [act,x,y]=P, s=x&&byId(st,x);
    if(act==='c'){ wait(st,chat,null); await send(chat,'Отменил.'); return; }
    if(act==='qa'){ const q=findQ(st,z=>String(z.id)===String(x)); if(!q){ await send(chat,'Этого вопроса уже нет.'); return; }
      wait(st,chat,{w:'ans',qid:q.id}); await send(chat,'Напиши ответ для '+(q.name||'ученика')+' (вопрос №'+q.id+') — текст, фото или файл. Отправлю как есть.',[CANCEL]); return; }
    if(act==='qd'){ const q=findQ(st,z=>String(z.id)===String(x)); if(q){ q.skip=t; save(st); } await send(chat,'Ок, вопрос №'+x+' убран из «без ответа».'); return; }
    if(act==='AL'){ const W=waiting(st,chat); if(!W||W.w!=='allok'){ await send(chat,'Нечего отправлять.'); return; }
      let n=0; const U=Object.keys(st.users).filter(c=>!isAdmin(c)); for(const c of U){ const r=await send(c,W.text); if(!r||r.ok!==false) n++; }
      wait(st,chat,null); await send(chat,'Отправил: '+n+' из '+U.length+(n<U.length?' (остальные заблокировали бота)':'')); return; }
    if(act==='add') return dayPicker(chat,t);
    if(act==='d'&&/^\d{8}$/.test(x||'')){ const row=TIMES.map(h=>({text:h,callback_data:'a:t:'+x+':'+h.replace(':','')}));
      await send(chat,'Во сколько? (по Москве) — '+dmy(x),[row.slice(0,2),row.slice(2),[{text:'Другое время',callback_data:'a:dt:'+x}],CANCEL]); return; }
    if(act==='dt'&&/^\d{8}$/.test(x||'')){ wait(st,chat,{w:'time',day:x}); await send(chat,'Напиши время, например 19:30',[CANCEL]); return; }
    if(act==='t'&&/^\d{8}$/.test(x||'')&&/^\d{4}$/.test(y||'')){ const when=parseWhen(dmy(x),y.slice(0,2)+':'+y.slice(2),t); if(!when) return;
      wait(st,chat,{w:'topic',when}); await send(chat,'Тема эфира — '+fmtWhen(when)+'?',[TOPICS.map((p,i)=>({text:p,callback_data:'a:p:'+i})),[{text:'Своя тема',callback_data:'a:p:x'}],CANCEL]); return; }
    if(act==='p'){ const W=waiting(st,chat); if(!W||!W.when){ await send(chat,'Начни заново: '+B.add); return; }
      if(x==='x'){ wait(st,chat,{w:'topicText',when:W.when}); await send(chat,'Напиши тему, например «РК2: углы и расстояния»',[CANCEL]); return; }
      const topic=TOPICS[+x]; if(topic) await doAdd(st,t,chat,W.when,topic); return; }
    if(act==='M'){ const W=waiting(st,chat), to=W&&st.sessions.find(z=>z.id===W.sid); if(!W||W.w!=='sayok'||!to){ await send(chat,'Нечего отправлять.'); return; } return doSay(st,chat,to,W.text); }
    if(!s){ await send(chat,'Этого эфира уже нет.'); return; }
    if(act==='s') return card(st,t,chat,s);
    if(act==='u'){ const L=[60,90,120], i=L.indexOf(s.min||90); s.min=L[(i+1)%L.length]; save(st); await send(chat,'Длительность «'+label(s)+'»: '+fmtDur(s)+'.'); return card(st,t,chat,s); }
    if(act==='w') return who(chat,s);
    if(act==='v'){ wait(st,chat,{w:'move',sid:s.id}); await send(chat,'На когда перенести «'+label(s)+'»? Напиши время (тот же день), например 18:00, или день и время: 12.11 18:00.\nЗаписанным придёт сообщение о переносе.',[CANCEL]); return; }
    if(act==='l'){ wait(st,chat,{w:'link',sid:s.id}); await send(chat,'Пришли ссылку на VK Встречи для «'+label(s)+'»'+(s.link?'\n(сейчас: '+s.link+')':''),[CANCEL]); return; }
    if(act==='m'){ if(!subsN(s)){ await send(chat,'На «'+label(s)+'» пока никто не записан.'); return; }
      wait(st,chat,{w:'say',sid:s.id}); await send(chat,'Напиши сообщение — получат все записанные на «'+label(s)+'» ('+subsN(s)+')',[CANCEL]); return; }
    if(act==='x'){ await send(chat,'Отменить «'+label(s)+'»?'+(subsN(s)?' Записанным ('+subsN(s)+') придёт сообщение об отмене.':''),[[{text:'Да, отменить',callback_data:'a:X:'+s.id}],CANCEL]); return; }
    if(act==='X') return doDel(st,t,chat,s);
  }

  /* текст от владельца: кнопки меню, ответы на вопросы бота, текстовые команды. false — не владельческое (дальше как ученик) */
  async function adminText(st,t,chat,cmd,rest,text){
    if(cmd==='/start'||cmd==='/admin'||cmd==='/menu') return menu(chat);
    if(cmd==='/cancel'){ wait(st,chat,null); return menu(chat,'Отменил.'); }
    if(text===B.list||cmd==='/list') return list(st,t,chat);
    if(text===B.qs||cmd==='/q') return questions(st,t,chat);
    if(/^🔒|^🔓/.test(text)||cmd==='/open'||cmd==='/close'){ st.open=cmd==='/open'?true:cmd==='/close'?false:!isOpen(st); save(st);
      return menu(chat,isOpen(st)?'🔓 Запись на эфиры открыта: ученики на /start видят ближайший эфир и кнопку «Я приду».':'🔒 Запись закрыта: ученики на /start видят «Эфиров пока нет», ссылки на сайт и кнопку «Задать вопрос».',st); }
    if(text===B.all){ wait(st,chat,{w:'all'}); await send(chat,'Напиши сообщение — получат все, кто писал боту ('+Object.keys(st.users).filter(c=>!isAdmin(c)).length+').',[CANCEL]); return; }
    if(text===B.count||text==='👥 Сколько придёт'||cmd==='/count'){ const U=upcoming(st,t);
      if(!U.length){ await send(chat,'Ближайших эфиров нет.',[[{text:B.add,callback_data:'a:add'}]]); return; }
      await send(chat,'👥 Записались:\n'+U.slice(0,6).map(s=>fmtDay(s.start)+' '+fmtTime(s.start)+' — '+subsN(s)+(s.link?'':' · нет ссылки')).join('\n')+'\n\nНажми на день — кто записан и действия.',
        U.slice(0,6).map(s=>[{text:fmtDay(s.start)+' '+fmtTime(s.start)+' · '+subsN(s),callback_data:'a:s:'+s.id}])); return; }
    if(text===B.add) return dayPicker(chat,t);
    if(text===B.link) return chooseOr(st,t,chat,'l','Для какого эфира ссылка?');
    if(text===B.say) return chooseOr(st,t,chat,'m','Кому написать?');
    if(text===B.student||cmd==='/preview'){ await send(chat,'👀 Так ученик видит бота, если просто откроет его (/start)'+(isOpen(st)?' — запись открыта':' — запись закрыта')+':');
      await sendStart(st,t,chat);
      await send(chat,'👀 А так — если нажмёт «Задать вопрос» на сайте (кнопки есть в каждой теме РК2, во «Вращении» и внизу каждой страницы):');
      await send(chat,'Привет! Вопрос по разделу: РК2 за 9 шагов, тема «Угол между прямыми».\n\n'+ASK);
      await send(chat,'👀 После вопроса ученик получает:');
      await send(chat,'Получил вопрос ✅ Отвечу здесь же — обычно в течение дня.\n\nПока можно посмотреть разборы на сайте:\n'+LINKS);
      await send(chat,'👀 Твой ответ придёт ему так: «💬 Ответ на твой вопрос «…»:» и следом — твоё сообщение как есть (текст, фото, файл).'); return; }
    const find=id=>id?st.sessions.find(s=>s.id===id):upcoming(st,t)[0];
    if(cmd==='/add'){ if(!rest.length) return dayPicker(chat,t);
      const when=parseWhen(rest[0],rest[1],t), topic=clean(rest.slice(2).join(' '),60);
      if(!when||!topic){ await send(chat,'Формат: /add 10.11 20:00 РК2 — или кнопка «'+B.add+'»'); return; }
      return doAdd(st,t,chat,when,topic); }
    if(cmd==='/link'){ if(!rest.length) return chooseOr(st,t,chat,'l','Для какого эфира ссылка?');
      const hasId=rest.length>1, s=find(hasId?rest[0]:null); if(!s){ await send(chat,'Нет такого эфира.'); return; } return doLink(st,chat,s,hasId?rest[1]:rest[0]); }
    if(cmd==='/who'){ const s=find(rest[0]); if(!s){ await send(chat,'Нет такого эфира.'); return; } return who(chat,s); }
    if(cmd==='/say'){ const s=st.sessions.find(x=>x.id===rest[0]), msg=clean((s?rest.slice(1):rest).join(' '),1000), to=s||upcoming(st,t)[0];
      if(!to||!msg){ await send(chat,'Формат: /say текст — или кнопка «'+B.say+'»'); return; } return doSay(st,chat,to,msg); }
    if(cmd==='/move'){ /* /move 18:00 — ближайший эфир на 18:00 того же дня; /move 12.11 18:00; /move <номер> 12.11 18:00 */
      const hasId=rest.length===3||(rest.length===2&&/^\d{8}$/.test(rest[0])), s=hasId?byId(st,rest[0]):upcoming(st,t)[0], a=hasId?rest.slice(1):rest;
      if(!s){ await send(chat,'Нет такого эфира.'); return; }
      const to=a.length===1?parseWhen(fmtDay(s.start).split(' ')[1],a[0],t):parseWhen(a[0],a[1],t);
      if(!to){ await send(chat,'Формат: /move 18:00 — ближайший эфир на 18:00; /move 12.11 18:00 — на другой день.'); return; }
      return doMove(st,t,chat,s,to); }
    if(cmd==='/del'){ const s=st.sessions.find(x=>x.id===rest[0]); if(!s){ await send(chat,'Отменить эфир — «'+B.list+'» → эфир → «Отменить».'); return; } return doDel(st,t,chat,s); }
    if(cmd.startsWith('/')) return false;
    /* ответ на вопрос бота */
    const W=waiting(st,chat); if(!W) return menu(chat,'Не понял. Выбери кнопку внизу.');
    if(W.w==='time'){ const when=parseWhen(dmy(W.day),text,t); if(!when){ await send(chat,'Не понял время. Напиши так: 19:30',[CANCEL]); return; }
      wait(st,chat,{w:'topic',when}); await send(chat,'Тема эфира — '+fmtWhen(when)+'?',[TOPICS.map((p,i)=>({text:p,callback_data:'a:p:'+i})),[{text:'Своя тема',callback_data:'a:p:x'}],CANCEL]); return; }
    if(W.w==='all'){ const msg=clean(text,1500); if(msg.length<2){ await send(chat,'Напиши текст сообщения.',[CANCEL]); return; } wait(st,chat,{w:'allok',text:msg});
      await send(chat,'Отправить всем, кто писал боту ('+Object.keys(st.users).filter(c=>!isAdmin(c)).length+')?\n\n'+msg,[[{text:'📣 Отправить всем',callback_data:'a:AL'}],CANCEL]); return; }
    if(W.w==='topicText'){ const topic=clean(text,60); if(topic.length<2){ await send(chat,'Напиши тему словами.',[CANCEL]); return; } return doAdd(st,t,chat,W.when,topic); }
    const s=byId(st,W.sid); if(!s){ wait(st,chat,null); await send(chat,'Этого эфира уже нет.'); return; }
    if(W.w==='move'){ const a=text.split(/\s+/), to=a.length===1?parseWhen(fmtDay(s.start).split(' ')[1],a[0],t):parseWhen(a[0],a[1],t);
      if(!to){ await send(chat,'Не понял. Напиши так: 18:00 или 12.11 18:00',[CANCEL]); return; } return doMove(st,t,chat,s,to); }
    if(W.w==='link') return doLink(st,chat,s,text);
    if(W.w==='say'){ const msg=clean(text,1000); wait(st,chat,{w:'sayok',sid:s.id,text:msg});
      await send(chat,'Отправить '+subsN(s)+' записанным на «'+label(s)+'»?\n\n'+msg,[[{text:'📣 Отправить',callback_data:'a:M'}],CANCEL]); return; }
    wait(st,chat,null); return menu(chat);
  }

  /* ── таймер (раз в минуту): напоминания, ссылка, «помогло?», уборка ── */
  async function tick(){
    const st=S(), t=now(); let changed=false; const out={sent:0};
    /* расписание из файла (schedule.json): добавить эфиры, которых ещё нет; отменённые владельцем не возвращаются */
    for(const e of (schedule()||[])){ try{
      /* разовое сообщение: notice — его номер (отправляется один раз), to: "cancelled" — тем, кому ушла отмена (если таких не записано — всем, кто писал боту),
         "all" — всем; ask: true — кнопка «Задать вопрос» */
      if(e.notice){ const id=String(e.notice); st.sentNotes=st.sentNotes||[]; if(st.sentNotes.includes(id)) continue;
        const txt=clean(e.text,1500); if(!txt) continue; st.sentNotes.push(id); changed=true;
        const U=(e.to==='cancelled'&&(st.cxl||[]).length?st.cxl:Object.keys(st.users)).filter(c=>!isAdmin(c)); let n=0;
        for(const c of [...new Set(U.map(String))]){ const r=await send(c,txt,e.ask?[[{text:'❓ Задать вопрос',callback_data:'q:'}]]:null); if(!r||r.ok!==false) n++; out.sent++; }
        for(const a of admins) await send(a,'📣 Разослал сообщение «'+id+'»: '+n+' из '+U.length+'.');
        log('разовое сообщение',id,n); continue; }
      const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date||''), when=m&&parseWhen(m[3]+'.'+m[2]+'.'+m[1],e.time,t), min=[30,45,60,90,120,150,180].includes(+e.min)?+e.min:DEF_MIN, topic=clean(e.topic,60);
      if(!when||!topic||when+min*MIN<=t) continue;
      const id=idOf(when);
      /* отмена: cancel — эфира не будет. Записанным — note (один раз), эфир убирается и из расписания больше не вернётся */
      if(e.cancel){ const s0=st.sessions.find(s=>s.id===id);
        if(s0){ const note=clean(e.note,900)||('Эфир '+fmtWhen(s0.start)+' отменён.');
          for(const c of Object.keys(s0.subs||{})){ await send(c,note); out.sent++; st.cxl=[...new Set((st.cxl||[]).concat(String(c)))]; }
          for(const a of admins) await send(a,'🗑 По расписанию отменён эфир '+label(s0)+'. Записанным ('+Object.keys(s0.subs||{}).length+') отправил сообщение.');
          st.sessions=st.sessions.filter(x=>x!==s0); log('отмена по расписанию:',id); }
        if(!(st.gone||[]).includes(id)){ st.gone=(st.gone||[]).concat(id).slice(-50); changed=true; }
        changed=true; continue; }
      /* перенос: moved_from — прежнее время того же дня. Эфир на прежнее время переезжает со всеми записями, записанным — сообщение */
      const was=e.moved_from&&parseWhen(m[3]+'.'+m[2]+'.'+m[1],e.moved_from,t), wid=was&&idOf(was), prev=wid&&st.sessions.find(s=>s.id===wid);
      if(prev&&!st.sessions.some(s=>s.id===id&&s!==prev)&&!(st.gone||[]).includes(id)){ await doMove(st,t,null,prev,when); changed=true; continue; }
      if(st.sessions.some(s=>s.id===id)||(st.gone||[]).includes(id)) continue;
      st.sessions.push({id,start:when,min,topic,link:okLink(e.link)?e.link:'',subs:{},n:0,sent:{},from:'schedule'}); changed=true; log('из расписания:',id,topic);
    }catch(err){ log('ошибка в расписании',err&&err.message); } }
    const mark=(s,k)=>{ s.sent=s.sent||{}; s.sent[k]=t; changed=true; };
    for(const s of st.sessions){ const subs=Object.keys(s.subs||{}); s.sent=s.sent||{};
      if(!s.sent.h2&&t>=s.start-2*H&&t<s.start-15*MIN){ mark(s,'h2');
        for(const c of subs){ await send(c,'Сегодня в '+fmtTime(s.start)+' МСК разбор РК2. Ссылка придёт за 15 минут.'); out.sent++; } }
      if(!s.sent.m15&&t>=s.start-15*MIN&&t<s.start+DUR(s)){
        if(s.link){ mark(s,'m15'); for(const c of subs){ await send(c,'Начинаем через 15 минут 👉 '+s.link); out.sent++; } }
        else if(!s.sent.nolink){ mark(s,'nolink'); for(const a of admins) await send(a,'⚠️ До эфира '+label(s)+' 15 минут, а ссылки нет. Нажми и пришли ссылку:',[[{text:'🔗 Прислать ссылку',callback_data:'a:l:'+s.id}]]); } }
      if(!s.sent.after&&t>=s.start+DUR(s)){ mark(s,'after');
        for(const c of subs) if(!s.subs[c].fb){ await send(c,'Помогло?',[[{text:'Да',callback_data:'f:'+s.id+':y'},{text:'Частично',callback_data:'f:'+s.id+':p'},{text:'Нет',callback_data:'f:'+s.id+':n'}]]); out.sent++; } }
      /* через 30 дней — только числа, без людей */
      if(t>s.start+KEEP&&s.subs&&Object.keys(s.subs).length){ s.subs={}; s.link=''; changed=true; } }
    const before=st.sessions.length; st.sessions=st.sessions.filter(s=>t<s.start+180*DAY); if(st.sessions.length!==before) changed=true;
    { const n0=(st.qs||[]).length; st.qs=(st.qs||[]).filter(q=>t-q.at<KEEP); if(st.qs.length!==n0) changed=true; }
    Object.keys(st.users).forEach(c=>{ if(t-(st.users[c].seen||0)>KEEP&&!st.sessions.some(s=>subOf(s,c))){ delete st.users[c]; changed=true; } });
    if(changed) save(st);
    return out; }

  return {onUpdate,tick};
}
module.exports={createLiveBot,emptyState,parseWhen,fmtWhen};
