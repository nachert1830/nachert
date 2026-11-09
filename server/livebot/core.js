/* Бот записи на бесплатные онлайн-разборы (эфиры) — логика без сети.
   Отдельно от кабинета: свой токен, своё хранилище (JSON-файл), запуск — run.js (long polling, без вебхука и домена).
   Как развернуть — server/livebot/README.md; что это и зачем — docs/LIVE.md.

   Ученик: /start → выбор эфира кнопкой → «Записал». За 2 часа — напоминание, за 15 минут — ссылка на Телемост,
   после эфира — «Помогло?». Кнопка «Ссылка на эфир» отдаёт ссылку сама, если напоминание не дошло. /my, /delete.
   Владелец (ADMIN_IDS): /add, /link, /del, /list, /say — расписание и ссылка задаются командами, без правки кода.
   Число записавшихся видит только владелец (/list) — публичного счётчика нигде нет.

   Персональные данные — минимум: номер чата, имя из Telegram (как обращаться), откуда пришёл (site/form).
   Удаляются через 30 дней после эфира или сразу по /delete; от эфиров остаются только числа (записалось, помогло). */
'use strict';
const TZ_OFF=3*3600e3;                                   /* время эфиров — московское */
const MIN=60e3, H=60*MIN, DAY=24*H;
const KEEP=30*DAY, DUR=90*MIN;
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

function emptyState(){ return {v:1,seq:0,sessions:[],users:{},offset:0}; }

function createLiveBot(o){
  const {api,load,save,now=()=>Date.now(),admins=[],site='https://nachert1830.ru',log=()=>{}}=o;
  const isAdmin=id=>admins.map(String).includes(String(id));
  const S=()=>load()||emptyState();

  async function send(chat,text,kb){ const r=await api('sendMessage',Object.assign({chat_id:chat,text,disable_web_page_preview:true},kb?{reply_markup:{inline_keyboard:kb}}:{}));
    if(r&&r.ok===false) log('не отправлено',chat,r.error_code||'',r.description||''); return r; }
  const upcoming=(st,t)=>st.sessions.filter(s=>s.start+DUR>t).sort((a,b)=>a.start-b.start);
  const label=s=>fmtDay(s.start)+' · '+fmtTime(s.start)+' · '+s.topic;
  const subOf=(s,chat)=>s.subs&&s.subs[String(chat)];
  const linkOpen=(s,t)=>t>=s.start-30*MIN&&t<s.start+DUR;

  const NOTICE='Записываясь, ты разрешаешь боту хранить твоё имя в Telegram и номер чата — только чтобы прислать напоминание и ссылку. '+
    'Данные удаляются через 30 дней после эфира, /delete — сразу. Подробнее: '+site+'/#/live';
  function startText(st,t,chat){ const U=upcoming(st,t).slice(0,6);
    if(!U.length) return {text:'Привет! Здесь запись на бесплатные онлайн-разборы по начерталке.\n\nБлижайших эфиров пока нет — загляни чуть позже.',kb:null};
    return {text:'Привет! Здесь запись на бесплатные онлайн-разборы по начерталке: разбираем типы задач по шагам, можно спрашивать. Онлайн в Телемосте, 1,5 часа.\n\nВыбери эфир:\n\n'+NOTICE,
      kb:U.map(s=>[{text:(subOf(s,chat)?'✓ ':'')+label(s),callback_data:'j:'+s.id}])}; }
  const joinedKb=s=>[[{text:'Ссылка на эфир',callback_data:'l:'+s.id}],[{text:'Отменить запись',callback_data:'c:'+s.id}]];

  /* ── обновление от Telegram ── */
  async function onUpdate(u){
    const st=S(), t=now();
    if(u.callback_query){ const q=u.callback_query, from=q.from||{}, chat=(q.message&&q.message.chat&&q.message.chat.id)||from.id, [k,id,arg]=String(q.data||'').split(':');
      await api('answerCallbackQuery',{callback_query_id:q.id});
      const s=st.sessions.find(x=>x.id===id);
      if(!s){ await send(chat,'Этот эфир уже прошёл или отменён. /start — ближайшие.'); return; }
      if(k==='j'){
        if(s.start+DUR<=t){ await send(chat,'Этот эфир уже закончился. /start — ближайшие.'); return; }
        s.subs=s.subs||{}; const was=!!subOf(s,chat);
        if(!was){ s.subs[String(chat)]={name:clean(from.first_name,40),at:t,src:(st.users[String(chat)]||{}).src||''}; s.n=(s.n||0)+1; }
        st.users[String(chat)]=Object.assign(st.users[String(chat)]||{},{seen:t}); save(st);
        const live=linkOpen(s,t)&&s.link;
        await send(chat,(was?'Ты уже записан':'Записал!')+' '+fmtWhen(s.start)+' — '+s.topic+'. Онлайн в Телемосте, 1,5 часа.\n\n'+
          (live?'Эфир скоро или уже идёт — вот ссылка: '+s.link:'За 2 часа напомню, за 15 минут пришлю ссылку. Не пришла — нажми «Ссылка на эфир».')+
          '\n\nПриготовь листок и карандаш: будем чертить вместе.',joinedKb(s));
        return; }
      if(k==='l'){
        if(!subOf(s,chat)){ await send(chat,'Ты не записан на этот эфир. /start — записаться.'); return; }
        if(s.link&&linkOpen(s,t)){ await send(chat,'Ссылка на эфир '+fmtWhen(s.start)+': '+s.link); return; }
        await send(chat,s.start+DUR<=t?'Эфир уже закончился.':'Ссылка появится за 30 минут до начала ('+fmtWhen(s.start)+'). За 15 минут пришлю её сам.'); return; }
      if(k==='c'){
        if(subOf(s,chat)){ delete s.subs[String(chat)]; s.n=Math.max(0,(s.n||1)-1); save(st); }
        await send(chat,'Отменил запись на '+fmtWhen(s.start)+'. Передумаешь — /start.'); return; }
      if(k==='f'&&['y','p','n'].includes(arg)){
        const sub=subOf(s,chat); if(sub&&!sub.fb){ sub.fb=arg; s.fb=s.fb||{y:0,p:0,n:0}; s.fb[arg]++; save(st); }
        await send(chat,arg==='y'?'Круто! Закрепи сам — задачи РК2 с проверкой по шагам: '+site+'/#/ng/rk2':
          'Спасибо, что честно. Напиши одним сообщением, что осталось непонятным, — разберём на следующем эфире. А пока — задачи с разбором по шагам: '+site+'/#/ng/rk2');
        return; }
      return; }

    const m=u.message; if(!m||!m.chat||m.chat.type!=='private'||typeof m.text!=='string') return;
    const chat=m.chat.id, from=m.from||{}, text=m.text.trim(), [cmd0,...rest]=text.split(/\s+/), cmd=cmd0.replace(/@\w+$/,'').toLowerCase();

    if(cmd==='/start'){ const src=clean(rest[0],16).replace(/[^\w-]/g,'');
      const me=st.users[String(chat)]=Object.assign(st.users[String(chat)]||{},{seen:t}); if(src&&!me.src) me.src=src; save(st);
      const r=startText(st,t,chat); await send(chat,r.text,r.kb); return; }
    if(cmd==='/my'){ const mine=upcoming(st,t).filter(s=>subOf(s,chat));
      await send(chat,mine.length?'Твои записи:\n'+mine.map(s=>'• '+label(s)).join('\n'):'Записей нет. /start — выбрать эфир.',mine.length?mine.map(s=>[{text:'Ссылка: '+label(s),callback_data:'l:'+s.id}]):null); return; }
    if(cmd==='/delete'){ let n=0; st.sessions.forEach(s=>{ if(subOf(s,chat)){ delete s.subs[String(chat)]; s.n=Math.max(0,(s.n||1)-1); n++; } }); delete st.users[String(chat)]; save(st);
      await send(chat,'Удалил всё, что бот о тебе хранил'+(n?' (записей: '+n+')':'')+'. Напоминаний больше не будет.'); return; }

    if(isAdmin(from.id)){ const A=await admin(st,t,chat,cmd,rest,text); if(A!==false) return; }
    if(cmd==='/help'||cmd.startsWith('/')){ await send(chat,'/start — записаться на эфир\n/my — мои записи и ссылка\n/delete — удалить мои данные'+(isAdmin(from.id)?'\n\nВладельцу: /admin':'')); return; }
    /* свободный текст — вопрос к эфиру: пересылаем владельцу (без хранения у бота) */
    if(text.length>1&&!isAdmin(from.id)){ for(const a of admins) await api('forwardMessage',{chat_id:a,from_chat_id:chat,message_id:m.message_id});
      await send(chat,'Передал вопрос — постараемся разобрать на эфире.'); }
  }

  /* ── команды владельца ── */
  async function admin(st,t,chat,cmd,rest,text){
    const find=id=>id?st.sessions.find(s=>s.id===id):upcoming(st,t)[0];
    if(cmd==='/admin'){ await send(chat,'Команды владельца:\n'+
      '/add 10.11 20:00 РК2 — добавить эфир (время московское)\n'+
      '/link https://telemost.yandex.ru/j/… — ссылка на ближайший эфир (или /link <id> <ссылка>)\n'+
      '/list — эфиры и сколько записалось (видишь только ты)\n'+
      '/who [id] — кто записан на ближайший\n'+
      '/say [id] текст — написать всем записанным на эфир\n'+
      '/del <id> — удалить эфир (записанным придёт «эфир отменён»)'); return; }
    if(cmd==='/add'){ const when=parseWhen(rest[0],rest[1],t), topic=clean(rest.slice(2).join(' '),60);
      if(!when||!topic){ await send(chat,'Формат: /add 10.11 20:00 РК2'); return; }
      if(when<t-MIN){ await send(chat,'Это время уже прошло: '+fmtWhen(when)); return; }
      const d=msk(when), id=two(d.getUTCDate())+two(d.getUTCMonth()+1)+two(d.getUTCHours())+two(d.getUTCMinutes());
      if(st.sessions.some(s=>s.id===id)){ await send(chat,'Эфир '+fmtWhen(when)+' уже есть (id '+id+').'); return; }
      st.sessions.push({id,start:when,topic,link:'',subs:{},n:0,sent:{}}); save(st);
      await send(chat,'Добавил: '+fmtWhen(when)+' — '+topic+' (id '+id+'). Ссылку на Телемост — командой /link.'); return; }
    if(cmd==='/link'){ const hasId=rest.length>1, s=find(hasId?rest[0]:null), url=hasId?rest[1]:rest[0];
      if(!s){ await send(chat,'Нет такого эфира. /list'); return; }
      if(!okLink(url)){ await send(chat,'Нужна ссылка вида https://telemost.yandex.ru/j/…'); return; }
      s.link=url; save(st); await send(chat,'Ссылка для '+label(s)+' сохранена. Записанным уйдёт за 15 минут до начала.'); return; }
    if(cmd==='/list'){ const L=st.sessions.slice().sort((a,b)=>a.start-b.start).slice(-12);
      await send(chat,L.length?L.map(s=>(s.start+DUR>t?'• ':'◦ ')+label(s)+' (id '+s.id+')\n   записалось: '+(s.n||0)+(s.link?'':' · ссылки нет')+(s.fb?' · помогло: '+s.fb.y+', частично: '+s.fb.p+', нет: '+s.fb.n:'')).join('\n'):'Эфиров нет. /add 10.11 20:00 РК2'); return; }
    if(cmd==='/who'){ const s=find(rest[0]); if(!s){ await send(chat,'Нет такого эфира.'); return; }
      const W=Object.values(s.subs||{}); await send(chat,label(s)+' — '+W.length+':\n'+(W.map(w=>'• '+(w.name||'без имени')+(w.src?' ('+w.src+')':'')).join('\n')||'пока никого')); return; }
    if(cmd==='/say'){ const s=st.sessions.find(x=>x.id===rest[0]), msg=clean((s?rest.slice(1):rest).join(' '),1000), to=s||upcoming(st,t)[0];
      if(!to||!msg){ await send(chat,'Формат: /say текст (или /say <id> текст)'); return; }
      let n=0; for(const c of Object.keys(to.subs||{})){ const r=await send(c,msg); if(!r||r.ok!==false) n++; }
      await send(chat,'Отправил: '+n+' из '+Object.keys(to.subs||{}).length); return; }
    if(cmd==='/del'){ const s=st.sessions.find(x=>x.id===rest[0]); if(!s){ await send(chat,'Формат: /del <id>, id — в /list'); return; }
      if(s.start+DUR>t) for(const c of Object.keys(s.subs||{})) await send(c,'Эфир '+fmtWhen(s.start)+' отменён. Извини! /start — ближайшие.');
      st.sessions=st.sessions.filter(x=>x!==s); save(st); await send(chat,'Удалил '+label(s)); return; }
    return false; }

  /* ── таймер (раз в минуту): напоминания, ссылка, «помогло?», уборка ── */
  async function tick(){
    const st=S(), t=now(); let changed=false; const out={sent:0};
    const mark=(s,k)=>{ s.sent=s.sent||{}; s.sent[k]=t; changed=true; };
    for(const s of st.sessions){ const subs=Object.keys(s.subs||{}); s.sent=s.sent||{};
      if(!s.sent.h2&&t>=s.start-2*H&&t<s.start-15*MIN){ mark(s,'h2');
        for(const c of subs){ await send(c,'Сегодня в '+fmtTime(s.start)+' — разбор: '+s.topic+'. За 15 минут пришлю ссылку. Приготовь листок и карандаш.',[[{text:'Отменить запись',callback_data:'c:'+s.id}]]); out.sent++; } }
      if(!s.sent.m15&&t>=s.start-15*MIN&&t<s.start+DUR){
        if(s.link){ mark(s,'m15'); for(const c of subs){ await send(c,'Через 15 минут начинаем: '+s.topic+'.\nСсылка: '+s.link+'\n\nКамеру можно не включать, вопросы — в чат или голосом.'); out.sent++; } }
        else if(!s.sent.nolink){ mark(s,'nolink'); for(const a of admins) await send(a,'⚠️ До эфира '+label(s)+' 15 минут, а ссылки нет. Пришли: /link https://telemost…'); } }
      if(!s.sent.after&&t>=s.start+DUR){ mark(s,'after');
        for(const c of subs) if(!s.subs[c].fb){ await send(c,'Спасибо, что был на эфире! Помогло?',[[{text:'Да',callback_data:'f:'+s.id+':y'},{text:'Частично',callback_data:'f:'+s.id+':p'},{text:'Нет',callback_data:'f:'+s.id+':n'}]]); out.sent++; } }
      /* через 30 дней — только числа, без людей */
      if(t>s.start+KEEP&&s.subs&&Object.keys(s.subs).length){ s.subs={}; s.link=''; changed=true; } }
    const before=st.sessions.length; st.sessions=st.sessions.filter(s=>t<s.start+180*DAY); if(st.sessions.length!==before) changed=true;
    Object.keys(st.users).forEach(c=>{ if(t-(st.users[c].seen||0)>KEEP&&!st.sessions.some(s=>subOf(s,c))){ delete st.users[c]; changed=true; } });
    if(changed) save(st);
    return out; }

  return {onUpdate,tick};
}
module.exports={createLiveBot,emptyState,parseWhen,fmtWhen};
