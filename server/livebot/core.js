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
  const {api,load,save,now=()=>Date.now(),admins=[],site='https://nachert1830.ru',log=()=>{},schedule=()=>[]}=o;
  const isAdmin=id=>admins.map(String).includes(String(id));
  const S=()=>load()||emptyState();

  /* kb: массив — кнопки под сообщением; объект — готовый reply_markup (меню владельца внизу экрана) */
  async function send(chat,text,kb){ const r=await api('sendMessage',Object.assign({chat_id:chat,text,disable_web_page_preview:true},kb?{reply_markup:Array.isArray(kb)?{inline_keyboard:kb}:kb}:{}));
    if(r&&r.ok===false) log('не отправлено',chat,r.error_code||'',r.description||''); return r; }
  const upcoming=(st,t)=>st.sessions.filter(s=>s.start+DUR(s)>t).sort((a,b)=>a.start-b.start);
  const label=s=>fmtDay(s.start)+' · '+fmtTime(s.start)+' · '+s.topic;
  const subOf=(s,chat)=>s.subs&&s.subs[String(chat)];
  const linkOpen=(s,t)=>t>=s.start-30*MIN&&t<s.start+DUR(s);

  const NOTICE='Записываясь, ты разрешаешь боту хранить твоё имя в Telegram и номер чата — только чтобы прислать напоминание и ссылку. '+
    'Данные удаляются через 30 дней после эфира, /delete — сразу. Подробнее: '+site+'/#/live';
  function startText(st,t,chat){ const U=upcoming(st,t).slice(0,6);
    if(!U.length) return {text:'Привет! Здесь запись на бесплатные онлайн-разборы по начерталке.\n\nБлижайших эфиров пока нет — загляни чуть позже.',kb:null};
    return {text:'Привет! Здесь запись на бесплатные онлайн-разборы по начерталке: разбираем типы задач по шагам, можно спрашивать. Онлайн в Телемосте.\n\nВыбери эфир:\n\n'+NOTICE,
      kb:U.map(s=>[{text:(subOf(s,chat)?'✓ ':'')+label(s),callback_data:'j:'+s.id}])}; }
  const joinedKb=s=>[[{text:'Ссылка на эфир',callback_data:'l:'+s.id}],[{text:'Отменить запись',callback_data:'c:'+s.id}]];

  /* ── обновление от Telegram ── */
  async function onUpdate(u){
    const st=S(), t=now();
    if(u.callback_query){ const q=u.callback_query, from=q.from||{}, chat=(q.message&&q.message.chat&&q.message.chat.id)||from.id, [k,id,arg]=String(q.data||'').split(':');
      await api('answerCallbackQuery',{callback_query_id:q.id});
      if(k==='a'){ if(isAdmin(from.id)) await adminTap(st,t,chat,String(q.data).split(':').slice(1)); return; }
      const s=st.sessions.find(x=>x.id===id);
      if(!s){ await send(chat,'Этот эфир уже прошёл или отменён. /start — ближайшие.'); return; }
      if(k==='j'){
        if(s.start+DUR(s)<=t){ await send(chat,'Этот эфир уже закончился. /start — ближайшие.'); return; }
        s.subs=s.subs||{}; const was=!!subOf(s,chat);
        if(!was){ s.subs[String(chat)]={name:clean(from.first_name,40),at:t,src:(st.users[String(chat)]||{}).src||''}; s.n=(s.n||0)+1; }
        st.users[String(chat)]=Object.assign(st.users[String(chat)]||{},{seen:t}); save(st);
        const live=linkOpen(s,t)&&s.link;
        await send(chat,(was?'Ты уже записан':'Записал!')+' '+fmtWhen(s.start)+' — '+s.topic+'. '+fmtDur(s)+' онлайн в Телемосте.\n\n'+
          (live?'Эфир скоро или уже идёт — вот ссылка: '+s.link:'За 2 часа напомню, за 15 минут пришлю ссылку. Не пришла — нажми «Ссылка на эфир».')+
          '\n\nПриготовь листок и карандаш: будем чертить вместе.',joinedKb(s));
        return; }
      if(k==='l'){
        if(!subOf(s,chat)){ await send(chat,'Ты не записан на этот эфир. /start — записаться.'); return; }
        if(s.link&&linkOpen(s,t)){ await send(chat,'Ссылка на эфир '+fmtWhen(s.start)+': '+s.link); return; }
        await send(chat,s.start+DUR(s)<=t?'Эфир уже закончился.':'Ссылка появится за 30 минут до начала ('+fmtWhen(s.start)+'). За 15 минут пришлю её сам.'); return; }
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

    if(isAdmin(from.id)&&await adminText(st,t,chat,cmd,rest,text)!==false) return;
    if(cmd==='/start'){ const src=clean(rest[0],16).replace(/[^\w-]/g,'');
      const me=st.users[String(chat)]=Object.assign(st.users[String(chat)]||{},{seen:t}); if(src&&!me.src) me.src=src; save(st);
      const r=startText(st,t,chat); await send(chat,r.text,r.kb); return; }
    if(cmd==='/my'){ const mine=upcoming(st,t).filter(s=>subOf(s,chat));
      await send(chat,mine.length?'Твои записи:\n'+mine.map(s=>'• '+label(s)).join('\n'):'Записей нет. /start — выбрать эфир.',mine.length?mine.map(s=>[{text:'Ссылка: '+label(s),callback_data:'l:'+s.id}]):null); return; }
    if(cmd==='/delete'){ let n=0; st.sessions.forEach(s=>{ if(subOf(s,chat)){ delete s.subs[String(chat)]; s.n=Math.max(0,(s.n||1)-1); n++; } }); delete st.users[String(chat)]; save(st);
      await send(chat,'Удалил всё, что бот о тебе хранил'+(n?' (записей: '+n+')':'')+'. Напоминаний больше не будет.'); return; }

    if(cmd==='/help'||cmd.startsWith('/')){ await send(chat,'/start — записаться на эфир\n/my — мои записи и ссылка\n/delete — удалить мои данные'+(isAdmin(from.id)?'\n\nВладельцу: /admin':'')); return; }
    /* свободный текст — вопрос к эфиру: пересылаем владельцу (без хранения у бота) */
    if(text.length>1&&!isAdmin(from.id)){ for(const a of admins) await api('forwardMessage',{chat_id:a,from_chat_id:chat,message_id:m.message_id});
      await send(chat,'Передал вопрос — постараемся разобрать на эфире.'); }
  }

  /* ── владелец: меню кнопками внизу экрана + те же действия текстовыми командами ── */
  const B={list:'📅 Эфиры',add:'➕ Добавить эфир',link:'🔗 Ссылка на эфир',say:'📣 Написать записанным',student:'👀 Как видят ученики'};
  const MENU={keyboard:[[{text:B.list},{text:B.add}],[{text:B.link},{text:B.say}],[{text:B.student}]],resize_keyboard:true,is_persistent:true};
  const TOPICS=['РК2','ДЗ № 2–3'], TIMES=['18:00','19:00','20:00','21:00'];
  const CANCEL=[{text:'Отмена',callback_data:'a:c'}];
  const ymd=t=>{ const d=msk(t); return d.getUTCFullYear()+two(d.getUTCMonth()+1)+two(d.getUTCDate()); };
  const dmy=k=>k.slice(6,8)+'.'+k.slice(4,6)+'.'+k.slice(0,4);
  const wait=(st,chat,w)=>{ st.adm=st.adm||{}; if(w) st.adm[String(chat)]=w; else delete st.adm[String(chat)]; save(st); };
  const waiting=(st,chat)=>(st.adm||{})[String(chat)]||null;
  const subsN=s=>Object.keys(s.subs||{}).length;
  const pick=(st,t,act)=>upcoming(st,t).slice(0,8).map(s=>[{text:label(s)+' · '+subsN(s),callback_data:'a:'+act+':'+s.id}]);

  async function menu(chat,txt){ await send(chat,txt||'Меню владельца — кнопки внизу экрана.\n\n'+
    B.list+' — эфиры, кто записан, ссылка, отмена\n'+B.add+' — день → время → тема\n'+B.link+' — ссылка на Телемост\n'+B.say+' — сообщение всем, кто записан\n\n'+
    'Сколько записалось, видишь только ты.',MENU); }
  async function card(st,t,chat,s){ const n=subsN(s);
    await send(chat,label(s)+' · '+fmtDur(s)+'\nЗаписалось: '+(s.n||0)+(n!==(s.n||0)?' (сейчас записаны: '+n+')':'')+'\nСсылка: '+(s.link||'нет — нажми «Ссылка»')+(s.fb?'\nПомогло: '+s.fb.y+' · частично: '+s.fb.p+' · нет: '+s.fb.n:''),
      [[{text:'👥 Кто записан',callback_data:'a:w:'+s.id},{text:'🔗 Ссылка',callback_data:'a:l:'+s.id}],[{text:'📣 Написать',callback_data:'a:m:'+s.id},{text:'🗑 Отменить эфир',callback_data:'a:x:'+s.id}],[{text:'⏱ Длительность: '+fmtDur(s)+' (сменить)',callback_data:'a:u:'+s.id}]]); }
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
    await send(chat,'Добавил: '+fmtWhen(when)+' — '+topic+', '+fmtDur(s)+'.\nУченики уже видят его у бота. Ссылку на Телемост можно прислать сейчас или позже (за 15 минут до начала напомню).',
      [[{text:'🔗 Прислать ссылку',callback_data:'a:l:'+id}],[{text:'⏱ Длительность: '+fmtDur(s),callback_data:'a:u:'+id},{text:'➕ Ещё эфир',callback_data:'a:add'}]]); return s; }
  async function doLink(st,chat,s,url){
    if(!okLink(url)){ await send(chat,'Нужна ссылка вида https://telemost.yandex.ru/j/… — пришли ещё раз.',[CANCEL]); return; }
    s.link=url; wait(st,chat,null); await send(chat,'Ссылка для «'+label(s)+'» сохранена. Записанным уйдёт за 15 минут до начала.'); }
  async function doSay(st,chat,s,msg){ let n=0; const all=Object.keys(s.subs||{});
    for(const c of all){ const r=await send(c,msg); if(!r||r.ok!==false) n++; }
    wait(st,chat,null); await send(chat,'Отправил: '+n+' из '+all.length+(n<all.length?' (остальные заблокировали бота)':'')); }
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
  async function adminTap(st,t,chat,P){ const [act,x,y]=P, s=x&&st.sessions.find(z=>z.id===x);
    if(act==='c'){ wait(st,chat,null); await send(chat,'Отменил.'); return; }
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
    if(act==='l'){ wait(st,chat,{w:'link',sid:s.id}); await send(chat,'Пришли ссылку на Телемост для «'+label(s)+'»'+(s.link?'\n(сейчас: '+s.link+')':''),[CANCEL]); return; }
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
    if(text===B.add) return dayPicker(chat,t);
    if(text===B.link) return chooseOr(st,t,chat,'l','Для какого эфира ссылка?');
    if(text===B.say) return chooseOr(st,t,chat,'m','Кому написать?');
    if(text===B.student){ const r=startText(st,t,chat); await send(chat,'Так ученики видят /start:'); await send(chat,r.text,r.kb); return; }
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
    if(cmd==='/del'){ const s=st.sessions.find(x=>x.id===rest[0]); if(!s){ await send(chat,'Отменить эфир — «'+B.list+'» → эфир → «Отменить».'); return; } return doDel(st,t,chat,s); }
    if(cmd.startsWith('/')) return false;
    /* ответ на вопрос бота */
    const W=waiting(st,chat); if(!W) return menu(chat,'Не понял. Выбери кнопку внизу.');
    if(W.w==='time'){ const when=parseWhen(dmy(W.day),text,t); if(!when){ await send(chat,'Не понял время. Напиши так: 19:30',[CANCEL]); return; }
      wait(st,chat,{w:'topic',when}); await send(chat,'Тема эфира — '+fmtWhen(when)+'?',[TOPICS.map((p,i)=>({text:p,callback_data:'a:p:'+i})),[{text:'Своя тема',callback_data:'a:p:x'}],CANCEL]); return; }
    if(W.w==='topicText'){ const topic=clean(text,60); if(topic.length<2){ await send(chat,'Напиши тему словами.',[CANCEL]); return; } return doAdd(st,t,chat,W.when,topic); }
    const s=st.sessions.find(z=>z.id===W.sid); if(!s){ wait(st,chat,null); await send(chat,'Этого эфира уже нет.'); return; }
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
      const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date||''), when=m&&parseWhen(m[3]+'.'+m[2]+'.'+m[1],e.time,t), min=[30,45,60,90,120,150,180].includes(+e.min)?+e.min:DEF_MIN, topic=clean(e.topic,60);
      if(!when||!topic||when+min*MIN<=t) continue;
      const d=msk(when), id=two(d.getUTCDate())+two(d.getUTCMonth()+1)+two(d.getUTCHours())+two(d.getUTCMinutes());
      if(st.sessions.some(s=>s.id===id)||(st.gone||[]).includes(id)) continue;
      st.sessions.push({id,start:when,min,topic,link:okLink(e.link)?e.link:'',subs:{},n:0,sent:{},from:'schedule'}); changed=true; log('из расписания:',id,topic);
    }catch(err){ log('ошибка в расписании',err&&err.message); } }
    const mark=(s,k)=>{ s.sent=s.sent||{}; s.sent[k]=t; changed=true; };
    for(const s of st.sessions){ const subs=Object.keys(s.subs||{}); s.sent=s.sent||{};
      if(!s.sent.h2&&t>=s.start-2*H&&t<s.start-15*MIN){ mark(s,'h2');
        for(const c of subs){ await send(c,'Сегодня в '+fmtTime(s.start)+' — разбор: '+s.topic+'. За 15 минут пришлю ссылку. Приготовь листок и карандаш.',[[{text:'Отменить запись',callback_data:'c:'+s.id}]]); out.sent++; } }
      if(!s.sent.m15&&t>=s.start-15*MIN&&t<s.start+DUR(s)){
        if(s.link){ mark(s,'m15'); for(const c of subs){ await send(c,'Через 15 минут начинаем: '+s.topic+'.\nСсылка: '+s.link+'\n\nКамеру можно не включать, вопросы — в чат или голосом.'); out.sent++; } }
        else if(!s.sent.nolink){ mark(s,'nolink'); for(const a of admins) await send(a,'⚠️ До эфира '+label(s)+' 15 минут, а ссылки нет. Нажми и пришли ссылку:',[[{text:'🔗 Прислать ссылку',callback_data:'a:l:'+s.id}]]); } }
      if(!s.sent.after&&t>=s.start+DUR(s)){ mark(s,'after');
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
