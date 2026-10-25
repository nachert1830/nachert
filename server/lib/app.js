/* API клуба. Одна функция обслуживает и API (/api/*), и статику клуба (club/), поэтому заголовки безопасности одни.
   createApp({cfg, store, clock, bot, log}) → {handle(req), remind(now), maintain(now)}.
   Безопасность (подробно — club/README.md, раздел «Безопасность»):
   • регистрация только по одноразовому приглашению (или владелец из ADMIN_TG_IDS);
   • вход через бота: участник нажимает «Старт» у бота, бот присылает в ЕГО чат кнопку с одноразовой ссылкой (10 минут, один раз,
     в базе — только SHA-256); входит тот браузер, где ссылку открыли. Telegram id — только из обновления на вебхук с секретом;
   • сессия — cookie HttpOnly, Secure, SameSite=Lax; в базе только SHA-256; CSRF — Origin + токен в заголовке X-CSRF-Token;
   • лимиты запросов, журнал входов (IP усечён), выгрузка и удаление своих данных. */
'use strict';
const C=require('./crypto');
const H=require('./http');
const FEAT=require('../../club/lib/features.js');
const SYNC=require('../../club/lib/sync.js');
const CAL=require('../../club/lib/calendar.js');
const REM=require('../../club/lib/reminder.js');
const SRS=require('../../club/lib/srs.js');

const DOCS_VERSION='2026-10-22';
const SESSION_DAYS=30, IDLE_DAYS=14, LOGIN_MIN=10, LOG_DAYS=90, MAX_BODY=300*1024;
const DAY=864e5;

class HttpError extends Error{ constructor(status,msg,extra){ super(msg); this.status=status; this.extra=extra; } }
const fail=(s,m,x)=>{ throw new HttpError(s,m,x); };

function maskIp(ip){ ip=String(ip||''); if(/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/,'.0'); if(ip.includes(':')) return ip.split(':').slice(0,3).join(':')+'::/48'; return ''; }
const cleanName=s=>String(s||'').replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,60);

function createApp(o){
  const {cfg,store}=o, now=()=>(o.clock?o.clock():Date.now()), log=o.log||console;
  const cookieName=cfg.secure?'__Host-club_sid':'club_sid';
  const isBootstrap=key=>key.startsWith('tg:')&&cfg.adminTg.includes(key.slice(3));

  /* ── конфигурация клуба ── */
  async function flagsRaw(){ const r=await store.get('config','flags'); return FEAT.normalize(r&&r.values); }
  async function settings(){ const r=await store.get('config','settings'); const w=r&&CAL.isDate(r.week1)?r.week1:(CAL.isDate(cfg.week1)?cfg.week1:CAL.DEFAULT_WEEK1); return {week1:w}; }

  /* ── лимиты запросов: фиксированное окно ── */
  async function limit(bucket,key,max,winSec){ const t=now(), w=Math.floor(t/1000/winSec);
    const n=await store.incr('ratelimit',bucket+':'+key+':'+w,'n',1,{exp:(w+1)*winSec*1000});
    if(n>max) fail(429,'Слишком много попыток. Подождите немного и попробуйте снова.',{retry:Math.ceil(((w+1)*winSec*1000-t)/1000)}); }

  async function logLogin(req,userId,method,ok,reason){ const t=now();
    try{ await store.put('loginlog',{h:userId||'anon',r:new Date(t).toISOString()+'#'+C.token(4),ts:t,method,ok,reason:reason||'',ip:maskIp(req.ip)}); }catch(e){ log.error('loginlog',e); } }

  /* ── сессии ── */
  async function newSession(req,user){ const tok=C.token(32), csrf=C.token(24), t=now();
    await store.put('sessions',{id:C.sha256(tok),userId:user.id,csrf,createdAt:t,lastSeen:t,expiresAt:t+SESSION_DAYS*DAY});
    return {cookie:H.cookie(cookieName,tok,{secure:cfg.secure,maxAge:SESSION_DAYS*86400}),csrf}; }
  async function session(req){ const tok=req.cookies[cookieName]; if(!tok||!/^[A-Za-z0-9_-]{20,64}$/.test(tok)) return null;
    const h=C.sha256(tok), s=await store.get('sessions',h), t=now(); if(!s) return null;
    if(s.expiresAt<t||s.lastSeen+IDLE_DAYS*DAY<t){ await store.del('sessions',h); return null; }
    const u=await store.get('users',s.userId); if(!u||u.blocked){ await store.del('sessions',h); return null; }
    if(t-s.lastSeen>10*60e3) await store.update('sessions',h,{lastSeen:t});
    return {h,s,user:u}; }
  const clearCookie=()=>H.cookie(cookieName,'',{secure:cfg.secure,maxAge:0});

  /* ── приглашения ── */
  async function inviteState(h){ if(!h) return {ok:false,why:'Клуб закрытый: для регистрации нужно приглашение.'};
    const inv=await store.get('invites',h), t=now();
    if(!inv) return {ok:false,why:'Приглашение не найдено. Проверьте ссылку.'};
    if(inv.revokedAt) return {ok:false,why:'Приглашение отозвано.'};
    if(inv.usedAt) return {ok:false,why:'Приглашение уже использовано.'};
    if(inv.expiresAt<t) return {ok:false,why:'Срок приглашения истёк.'};
    return {ok:true,inv}; }
  const inviteHash=code=>typeof code==='string'&&/^[A-Za-z0-9_-]{16,64}$/.test(code)?C.sha256(code):null;
  function consentOk(c){ return !!(c&&c.terms===true&&c.pd===true); }

  /* вход существующего участника или регистрация нового */
  async function enter(req,{key,method,name,tgId,invite,consent}){
    const ident=await store.get('identities',key); let user=ident?await store.get('users',ident.userId):null, isNew=false;
    if(user&&user.blocked){ await logLogin(req,user.id,method,false,'заблокирован'); fail(403,'Доступ к клубу закрыт владельцем.'); }
    if(!user){
      const boot=isBootstrap(key);
      let st=null; if(!boot){ st=await inviteState(invite); if(!st.ok){ await logLogin(req,null,method,false,'без приглашения: '+st.why); fail(403,st.why,{needInvite:true}); } }
      if(!consentOk(consent)){ await logLogin(req,null,method,false,'нет согласия'); fail(400,'Для регистрации нужно принять соглашение и дать согласие на обработку данных.',{needConsent:true}); }
      const t=now(), id=C.id('u_');
      if(st){ const claimed=await store.update('invites',invite,{usedAt:t,usedBy:id},{ifEq:{usedAt:null,revokedAt:null}}); if(!claimed) fail(403,'Приглашение уже использовано.',{needInvite:true}); }
      user={id,name:cleanName(name)||'Участник',role:boot?'admin':(st&&st.inv.role==='admin'?'admin':'member'),method,createdAt:t,
        tgId:tgId||null,consent:{terms:DOCS_VERSION,pd:DOCS_VERSION,at:t,photos:!!consent.photos,photosAt:t},reminders:Object.assign(REM.norm({}),{canWrite:true}),invite:invite?invite.slice(0,12):null};
      if(!(await store.put('identities',{id:key,userId:id,type:method,createdAt:t},{ifNotExists:true}))) fail(409,'Этот вход уже привязан к другому участнику.');
      await store.put('users',user); isNew=true; }
    const ses=await newSession(req,user); await store.update('users',user.id,{lastLogin:now()}); await logLogin(req,user.id,method,true,isNew?'регистрация':'');
    return {resp:H.json(200,{ok:true,isNew,user:publicUser(user),csrf:ses.csrf}),cookie:ses.cookie}; }
  const publicUser=u=>({id:u.id,name:u.name,role:u.role,method:u.method,telegram:!!u.tgId,createdAt:u.createdAt,photos:!!(u.consent&&u.consent.photos)});

  /* ── проверки запроса ── */
  function sameOrigin(req){ const sfs=req.headers['sec-fetch-site']; if(sfs&&sfs!=='same-origin'&&sfs!=='none') return false; return req.headers.origin===cfg.origin; }
  function body(req){ if(req.body.length>MAX_BODY) fail(413,'Слишком большой запрос.');
    if(!/^application\/json\b/i.test(req.headers['content-type']||'')) fail(415,'Нужен JSON.');
    try{ const b=JSON.parse(req.body||'{}'); if(!b||typeof b!=='object'||Array.isArray(b)) throw 0; return b; }catch(e){ fail(400,'Неверный JSON.'); } }

  /* ── обработчики ── */
  const R={};
  R['GET /api/config']=async()=>{ const s=await settings(); return H.json(200,{botId:(cfg.botToken.split(':')[0])||null,botName:cfg.botName||null,
    devBot:!!cfg.dev,mainUrl:cfg.mainUrl,week1:s.week1,docs:DOCS_VERSION,features:FEAT.FEATURES.map(f=>({id:f.id,t:f.t}))}); };

  R['GET /api/invite/check']=async(req)=>{ await limit('inv',maskIp(req.ip),30,600); const st=await inviteState(inviteHash(req.query.code)); return H.json(200,{valid:st.ok,why:st.ok?'':st.why}); };

  /* ── вход через бота ──
     1) сайт ведёт на t.me/<бот>?start=login (или start=i_<код приглашения>);
     2) «Старт» приходит на вебхук (с секретом) — сервер знает Telegram id и присылает в этот чат кнопку «Войти в клуб»
        со ссылкой <клуб>/#/tg/<токен>: токен — 192 бита, в базе только SHA-256, 10 минут, один раз;
     3) по ссылке страница показывает «Войти как <имя>?» и после нажатия получает сессию.
     Ключ идёт из Telegram в браузер, который выбрал сам участник: присланная кем-то ссылка на бота ничего не даёт присылающему. */
  const loginId=tok=>C.sha256('login:'+tok).slice(0,40);
  /* ответ на «Старт» отдаётся прямо в ответе вебхуку (Telegram сам выполнит sendMessage): облаку не нужно ходить в api.telegram.org */
  async function botLoginLink(from,param){ const t=now(), key='tg:'+from.id;
    const member=await store.get('identities',key), code=/^i_[A-Za-z0-9_-]{16,62}$/.test(param||'')?param.slice(2):null, inv=code?inviteHash(code):null;
    if(!member&&!isBootstrap(key)){ const st=await inviteState(inv);
      if(!st.ok) return say(from.id,'Это бот закрытого клуба Начерта. '+(code?st.why:'Вход — по личной ссылке-приглашению.')); }
    const tok=C.token(24), name=cleanName(from.first_name)||'Участник';
    await store.put('botlogin',{id:loginId(tok),tg:String(from.id),name,invite:member?null:inv,exp:t+LOGIN_MIN*60e3,used:false,createdAt:t});
    return say(from.id,'Вход в клуб Начерта.\n\nНажмите кнопку — откроется клуб, и вы войдёте. Ссылка действует '+LOGIN_MIN+' минут и срабатывает один раз. Не пересылайте её: по ней можно войти в ваш аккаунт.',
      {reply_markup:{inline_keyboard:[[{text:'Войти в клуб',url:cfg.origin+'/#/tg/'+tok}]]}}); }
  /* вход владельца без Telegram: ссылку выдаёт сама функция при прямом вызове из yc (server/tools/login.js).
     Вызвать функцию напрямую может только тот, у кого есть права в облаке, — шлюз передаёт ей лишь HTTP-запросы. */
  async function ownerLink(){ const owner=cfg.adminTg[0]; if(!owner) throw new Error('ADMIN_TG_IDS не задан');
    const ex=await store.get('identities','tg:'+owner), u=ex&&await store.get('users',ex.userId);
    const tok=C.token(24), t=now(), min=30;
    await store.put('botlogin',{id:loginId(tok),tg:owner,name:(u&&u.name)||'Владелец',invite:null,exp:t+min*60e3,used:false,createdAt:t,via:'owner'});
    return {link:cfg.origin+'/#/tg/'+tok,minutes:min}; }
  const say=(chat,text,extra)=>Object.assign({method:'sendMessage',chat_id:chat,text,disable_web_page_preview:true},extra||{});

  /* шаг 3: confirm=false — только узнать имя («Войти как …?»), confirm=true — войти */
  R['POST /api/auth/bot/redeem']=async(req)=>{ const b=body(req); await limit('login',maskIp(req.ip),30,600);
    const tok=String(b.token||''); if(!/^[A-Za-z0-9_-]{30,40}$/.test(tok)) fail(400,'Ссылка для входа неверная. Нажмите «Старт» у бота ещё раз.');
    const id=loginId(tok), r=await store.get('botlogin',id), t=now();
    if(!r||r.exp<t){ await logLogin(req,null,'telegram',false,'ссылка устарела'); fail(410,'Ссылка для входа устарела. Нажмите «Старт» у бота ещё раз — придёт новая.',{expired:true}); }
    if(r.used){ await logLogin(req,null,'telegram',false,'повтор ссылки'); fail(410,'Эта ссылка уже использована. Нажмите «Старт» у бота ещё раз — придёт новая.',{expired:true}); }
    const key='tg:'+r.tg, member=!!(await store.get('identities',key));
    if(!b.confirm) return H.json(200,{name:r.name,member});
    const consent=consentOk(b.consent)?{terms:true,pd:true,photos:!!b.consent.photos}:null;
    if(!member&&!consent) fail(400,'Для регистрации нужно принять соглашение и дать согласие на обработку данных.',{needConsent:true});
    if(!(await store.update('botlogin',id,{used:true,usedAt:t},{ifEq:{used:false}}))) fail(410,'Эта ссылка уже использована.',{expired:true});
    return enter(req,{key,method:'telegram',name:r.name,tgId:r.tg,invite:r.invite,consent}); };

  R['POST /api/tg/webhook']=async(req)=>{ if(!cfg.webhookSecret||!C.safeEqual(req.headers['x-telegram-bot-api-secret-token']||'',cfg.webhookSecret)) fail(403,'нет');
    let u={}; try{ u=JSON.parse(req.body||'{}'); }catch(e){} const act=await onUpdate(u); return H.json(200,act||{ok:true}); };

  /* — с сессией — */
  const A={};
  A['GET /api/me']=async(req,S)=>{ const [fl,st]=await Promise.all([flagsRaw(),settings()]);
    return H.json(200,{user:publicUser(S.user),csrf:S.s.csrf,flags:FEAT.effective(fl,S.user.role),week1:st.week1,reminders:Object.assign(REM.norm(S.user.reminders),{canWrite:S.user.reminders&&S.user.reminders.canWrite!==false&&!!S.user.tgId}),
      botName:cfg.botName||null,mainUrl:cfg.mainUrl,docs:DOCS_VERSION}); };
  A['POST /api/auth/logout']=async(req,S)=>{ await store.del('sessions',S.h); return {resp:H.json(200,{ok:true}),cookie:clearCookie()}; };
  A['POST /api/auth/logout-all']=async(req,S)=>{ const all=await store.scan('sessions',x=>x.userId===S.user.id); for(const s of all) await store.del('sessions',s.id); return {resp:H.json(200,{ok:true,closed:all.length}),cookie:clearCookie()}; };

  A['GET /api/progress']=async(req,S)=>{ const p=await store.get('progress',S.user.id); return H.json(200,p?{data:p.data||{},mt:p.mt||{},rev:p.rev||0,updatedAt:p.updatedAt}:{data:{},mt:{},rev:0,empty:true}); };
  A['PUT /api/progress']=async(req,S)=>{ const fl=FEAT.effective(await flagsRaw(),S.user.role); if(!fl.sync) fail(403,'Синхронизация сейчас выключена.');
    await limit('sync',S.user.id,60,300); const b=body(req), bad=SYNC.validate(b); if(bad) fail(400,'Прогресс не принят: '+bad+'.');
    for(let i=0;i<3;i++){ const cur=await store.get('progress',S.user.id), merged=SYNC.merge(cur||{},SYNC.clean(b));
      if(SYNC.size(merged)>SYNC.LIMIT_TOTAL) fail(413,'Прогресс слишком большой.');
      const rev=((cur&&cur.rev)||0)+1, rec={id:S.user.id,data:merged.data,mt:merged.mt,rev,updatedAt:now()};
      const ok=cur?await store.update('progress',S.user.id,{data:rec.data,mt:rec.mt,rev,updatedAt:rec.updatedAt},{ifEq:{rev:cur.rev||0}}):await store.put('progress',rec,{ifNotExists:true});
      if(ok) return H.json(200,{data:rec.data,mt:rec.mt,rev}); }
    fail(409,'Прогресс меняется с другого устройства — попробуйте ещё раз.'); };

  A['POST /api/me/profile']=async(req,S)=>{ const b=body(req), set={};
    if(b.name!=null){ const n=cleanName(b.name); if(!n) fail(400,'Имя не может быть пустым.'); set.name=n; }
    if(b.photos!=null) set.consent=Object.assign({},S.user.consent,{photos:b.photos===true,photosAt:now()});
    const u=await store.update('users',S.user.id,set); return H.json(200,{user:publicUser(u)}); };

  A['POST /api/me/reminders']=async(req,S)=>{ const fl=FEAT.effective(await flagsRaw(),S.user.role); if(!fl.reminders) fail(403,'Напоминания сейчас выключены.');
    const b=body(req), cur=S.user.reminders||{}, next=REM.norm(Object.assign({},cur,b));
    if(b.tz!=null&&!REM.validTz(b.tz)) fail(400,'Неизвестный часовой пояс.');
    let canWrite=cur.canWrite;
    if(next.enabled&&(!cur.enabled||cur.canWrite===false)){ await limit('remtest',S.user.id,5,3600);
      const r=await o.bot.send(S.user.tgId,'Напоминания клуба Начерта включены: не чаще раза в день, около '+next.time+', тихие часы '+next.quietFrom+'–'+next.quietTo+'. Пауза — /pause или кнопка в клубе.');
      canWrite=!!(r&&r.ok);
      if(!canWrite){ await store.update('users',S.user.id,{reminders:Object.assign({},cur,{canWrite:false})});
        fail(409,'Бот пока не может вам писать. Откройте бота и нажмите «Старт», затем включите напоминания ещё раз.',{needStart:true,bot:cfg.botName?'https://t.me/'+cfg.botName+'?start=remind':null}); } }
    const rec=Object.assign({},next,{canWrite:canWrite!==false,lastSent:cur.lastSent||null});
    await store.update('users',S.user.id,{reminders:rec}); return H.json(200,{reminders:REM.norm(rec)}); };

  A['GET /api/me/logins']=async(req,S)=>{ const l=await store.query('loginlog',S.user.id,{desc:true,limit:50}); return H.json(200,{logins:l.map(x=>({ts:x.ts,method:x.method,ok:x.ok,reason:x.reason,ip:x.ip}))}); };

  A['GET /api/me/requests']=async(req,S)=>{ const l=await store.scan('feedback',x=>x.userId===S.user.id&&x.feature==='privacy');
    return H.json(200,{requests:l.sort((a,b)=>b.ts-a.ts).map(f=>({ts:f.ts,text:f.text,reply:f.reply||null,replyAt:f.replyAt||null}))}); };
  A['GET /api/me/export']=async(req,S)=>{ await limit('export',S.user.id,10,3600); const u=S.user;
    const [ids,prog,ses,logs,fb]=await Promise.all([store.scan('identities',x=>x.userId===u.id),store.get('progress',u.id),store.scan('sessions',x=>x.userId===u.id),
      store.query('loginlog',u.id),store.scan('feedback',x=>x.userId===u.id)]);
    const out={exportedAt:new Date(now()).toISOString(),about:'Все данные, которые клуб Начерта хранит о вас (club.nachert1830.ru).',
      user:{id:u.id,name:u.name,role:u.role,method:u.method,telegramId:u.tgId||null,createdAt:u.createdAt,lastLogin:u.lastLogin||null,consent:u.consent,reminders:u.reminders,blocked:!!u.blocked},
      identities:ids.map(i=>({type:i.type,key:i.id,createdAt:i.createdAt})),
      progress:prog?{data:prog.data,updatedAt:prog.updatedAt}:null,
      sessions:ses.map(s=>({createdAt:s.createdAt,lastSeen:s.lastSeen,expiresAt:s.expiresAt,current:s.id===S.h})),
      loginLog:logs.map(x=>({ts:x.ts,method:x.method,ok:x.ok,reason:x.reason,ip:x.ip})),feedback:fb.map(f=>({ts:f.ts,feature:f.feature,mood:f.mood,text:f.text,reply:f.reply||null}))};
    return H.json(200,out,{'Content-Disposition':'attachment; filename="nachert-club-my-data.json"'}); };

  A['POST /api/me/delete']=async(req,S)=>{ const b=body(req); if(b.confirm!=='УДАЛИТЬ') fail(400,'Подтвердите удаление словом УДАЛИТЬ.');
    await removeUser(S.user.id); log.log&&log.log('аккаунт удалён',S.user.id); return {resp:H.json(200,{ok:true}),cookie:clearCookie()}; };

  A['POST /api/feedback']=async(req,S)=>{ const b=body(req); await limit('fb',S.user.id,20,3600);
    const feature=FEAT.ids.includes(b.feature)||b.feature==='privacy'?b.feature:'general', mood=['good','unclear','bad'].includes(b.mood)?b.mood:null, text=String(b.text||'').replace(/\u0000/g,'').trim().slice(0,2000);
    if(!text&&!mood) fail(400,'Напишите пару слов или выберите оценку.');
    const t=now(); await store.put('feedback',{id:new Date(t).toISOString()+'#'+C.token(4),userId:S.user.id,name:S.user.name,feature,mood,text,ts:t,ver:String(b.ver||'').slice(0,20)});
    return H.json(200,{ok:true}); };

  /* — админ — */
  const D={};
  D['GET /api/admin/overview']=async()=>{ const [inv,us,fl,st,fb,lg]=await Promise.all([store.scan('invites'),store.scan('users'),flagsRaw(),settings(),store.scan('feedback'),store.scan('loginlog')]);
    const ids=await store.scan('identities'); const methods={}; ids.forEach(i=>{ (methods[i.userId]=methods[i.userId]||[]).push(i.type); });
    return H.json(200,{invites:inv.sort((a,b)=>b.createdAt-a.createdAt).map(i=>({h:i.id,label:i.label,role:i.role||'member',createdAt:i.createdAt,expiresAt:i.expiresAt,usedAt:i.usedAt||null,usedBy:i.usedBy||null,revokedAt:i.revokedAt||null})),
      users:us.sort((a,b)=>a.createdAt-b.createdAt).map(u=>({id:u.id,name:u.name,role:u.role,methods:methods[u.id]||[],createdAt:u.createdAt,lastLogin:u.lastLogin||null,blocked:!!u.blocked,reminders:!!(u.reminders&&u.reminders.enabled),photos:!!(u.consent&&u.consent.photos)})),
      flags:fl,modes:FEAT.MODES,features:FEAT.FEATURES,settings:st,
      feedback:fb.sort((a,b)=>b.ts-a.ts).slice(0,300).map(f=>({id:f.id,ts:f.ts,name:f.name,feature:f.feature,mood:f.mood,text:f.text,reply:f.reply||null,replyAt:f.replyAt||null})),
      logins:lg.sort((a,b)=>b.ts-a.ts).slice(0,200).map(x=>({ts:x.ts,user:x.h==='anon'?null:x.h,method:x.method,ok:x.ok,reason:x.reason,ip:x.ip}))}); };
  D['POST /api/admin/invites']=async(req,S)=>{ const b=body(req), days=Math.max(1,Math.min(60,+b.days||14)), code=C.token(16), t=now(), h=C.sha256(code);
    const inv={id:h,label:cleanName(b.label)||'без подписи',role:b.role==='admin'?'admin':'member',createdAt:t,expiresAt:t+days*DAY,createdBy:S.user.id};
    await store.put('invites',inv); return H.json(200,{code,link:cfg.origin+'/#/invite/'+code,invite:{h,label:inv.label,expiresAt:inv.expiresAt,role:inv.role}}); };
  D['POST /api/admin/invites/revoke']=async(req)=>{ const b=body(req); if(!/^[0-9a-f]{64}$/.test(b.h||'')) fail(400,'Нет приглашения.');
    const r=await store.update('invites',b.h,{revokedAt:now()},{ifEq:{usedAt:null}}); if(!r) fail(409,'Приглашение уже использовано или не найдено.'); return H.json(200,{ok:true}); };
  D['POST /api/admin/users/role']=async(req,S)=>{ const b=body(req); if(!['admin','member'].includes(b.role)) fail(400,'Роль: admin или member.');
    const u=await store.get('users',String(b.id||'')); if(!u) fail(404,'Нет участника.');
    if(u.id===S.user.id&&b.role!=='admin'){ const admins=await store.scan('users',x=>x.role==='admin'&&!x.blocked); if(admins.length<2) fail(409,'Нельзя снять с себя роль единственного админа.'); }
    await store.update('users',u.id,{role:b.role}); return H.json(200,{ok:true}); };
  D['POST /api/admin/users/block']=async(req,S)=>{ const b=body(req); const u=await store.get('users',String(b.id||'')); if(!u) fail(404,'Нет участника.');
    if(u.id===S.user.id) fail(409,'Нельзя заблокировать себя.'); await store.update('users',u.id,{blocked:b.blocked===true});
    if(b.blocked===true){ const all=await store.scan('sessions',x=>x.userId===u.id); for(const s of all) await store.del('sessions',s.id); }
    return H.json(200,{ok:true}); };
  /* ответ на обращение: виден участнику в клубе и уходит в Telegram, если он привязан */
  D['POST /api/admin/reply']=async(req)=>{ const b=body(req), text=String(b.text||'').replace(/\u0000/g,'').trim().slice(0,2000); if(!text) fail(400,'Пустой ответ.');
    const f=await store.get('feedback',String(b.id||'')); if(!f||f.feature!=='privacy') fail(404,'Нет такого обращения.');
    await store.update('feedback',f.id,{reply:text,replyAt:now()}); const u=await store.get('users',f.userId); let tg=false;
    if(u&&u.tgId){ const r=await o.bot.send(u.tgId,'Ответ владельца клуба Начерта на ваше обращение:\n\n'+text); tg=!!(r&&r.ok); }
    return H.json(200,{ok:true,telegram:tg}); };
  D['POST /api/admin/flags']=async(req)=>{ const b=body(req), cur=await flagsRaw();
    Object.keys(b.flags||{}).forEach(k=>{ if(FEAT.ids.includes(k)&&FEAT.MODES.includes(b.flags[k])) cur[k]=b.flags[k]; });
    await store.put('config',{id:'flags',values:cur}); return H.json(200,{flags:cur}); };
  D['POST /api/admin/settings']=async(req)=>{ const b=body(req);
    if(!CAL.isDate(b.week1)||CAL.weekday(CAL.toDay(b.week1))!==1) fail(400,'Дата начала недели 1 — понедельник в формате ГГГГ-ММ-ДД.');
    await store.put('config',{id:'settings',week1:b.week1}); return H.json(200,{settings:{week1:b.week1}}); };

  async function removeUser(id){
    for(const t of ['identities','sessions']){ const all=await store.scan(t,x=>x.userId===id); for(const x of all) await store.del(t,x.id); }
    const logs=await store.query('loginlog',id); for(const x of logs) await store.del('loginlog',{h:x.h,r:x.r});
    const fb=await store.scan('feedback',x=>x.userId===id); for(const x of fb) await store.del('feedback',x.id);
    const inv=await store.scan('invites',x=>x.usedBy===id); for(const x of inv) await store.update('invites',x.id,{usedBy:'удалён'});
    await store.del('progress',id); await store.del('users',id); }

  /* ── бот: /start, /pause, /resume, /stop и кнопка «Пауза» ── */
  /* ответ на обновление возвращается действием {method, …} — Telegram выполнит его сам, из ответа на вебхук */
  async function onUpdate(u){ const msg=u.message, cb=u.callback_query, mcm=u.my_chat_member;
    const from=(msg&&msg.from)||(cb&&cb.from)||(mcm&&mcm.from); if(!from||!/^\d+$/.test(String(from.id))) return null;
    const ident=await store.get('identities','tg:'+from.id), user=ident?await store.get('users',ident.userId):null;
    const setR=async patch=>{ if(user) await store.update('users',user.id,{reminders:Object.assign({},user.reminders||{},patch)}); };
    if(mcm){ const st=mcm.new_chat_member&&mcm.new_chat_member.status; if(st==='kicked') await setR({canWrite:false}); if(st==='member') await setR({canWrite:true}); return null; }
    if(cb){ if(user&&cb.data==='pause'){ await setR({paused:true}); return {method:'answerCallbackQuery',callback_query_id:cb.id,text:'Напоминания на паузе. Вернуть — /resume или в клубе.'}; }
      return {method:'answerCallbackQuery',callback_query_id:cb.id}; }
    const parts=String((msg&&msg.text)||'').trim().split(/\s+/), text=parts[0].replace(/@.*$/,'');
    if((text==='/start'&&parts[1])||text==='/login'){ await setR({canWrite:true}); return botLoginLink(from,parts[1]); }
    if(!user) return text==='/start'?botLoginLink(from,null):null;
    if(text==='/start'){ await setR({canWrite:true}); return botLoginLink(from,null); }
    if(text==='/pause'){ await setR({paused:true}); return say(from.id,'Напоминания на паузе. Вернуть — /resume.'); }
    if(text==='/resume'){ await setR({paused:false,canWrite:true}); return say(from.id,'Напоминания снова включены.'); }
    if(text==='/stop'){ await setR({enabled:false}); return say(from.id,'Напоминания выключены. Включить снова — в клубе, раздел «Настройки».'); }
    return null; }

  /* ── напоминания: запускается таймером каждые 15 минут ── */
  /* бот настраивается из облака: компьютер владельца может не видеть Telegram без VPN. Вебхук и команды — если ещё не те */
  async function ensureBot(){ if(!cfg.botToken||!cfg.webhookSecret||cfg.dev) return null;
    const url=cfg.origin+'/api/tg/webhook', info=await o.bot.api('getWebhookInfo',{}).catch(()=>null);
    if(info&&info.ok&&info.result&&info.result.url===url) return 'ok';
    const r=await o.bot.api('setWebhook',{url,secret_token:cfg.webhookSecret,allowed_updates:['message','callback_query','my_chat_member']}).catch(e=>({ok:false,description:e.message}));
    await o.bot.api('setMyCommands',{commands:[{command:'pause',description:'Поставить напоминания на паузу'},{command:'resume',description:'Снять с паузы'},{command:'login',description:'Войти в клуб'},{command:'stop',description:'Выключить напоминания'}]}).catch(()=>{});
    if(!r||!r.ok) log.error('вебхук бота не подключён',r&&r.description); return r&&r.ok?'set':'fail: '+String((r&&r.description)||'нет ответа').slice(0,200); }

  async function remind(at){ const t=at||now(), out={sent:0,skipped:{}};
    try{ out.bot=await ensureBot(); }catch(e){ log.error('бот',e&&e.message); }
    const fl=await flagsRaw(), st=await settings();
    const users=await store.scan('users',u=>u.reminders&&u.reminders.enabled&&u.tgId&&!u.blocked);
    for(const u of users){ if(!FEAT.effective(fl,u.role).reminders){ out.skipped['функция выключена']=(out.skipped['функция выключена']||0)+1; continue; }
      const d=REM.decide(u.reminders,t); if(!d.send){ out.skipped[d.why]=(out.skipped[d.why]||0)+1; continue; }
      const p=await store.get('progress',u.id), data=(p&&p.data)||{}, J=k=>{ try{ return JSON.parse(data[k]||'null'); }catch(e){ return null; } };
      const evs=CAL.events(J('nch2_club_cal')||{},st.week1), today=d.date;
      const due=SRS.queue(J('nch2_rep')||{},CAL.toDay(today)).filter(x=>x.due).length;
      const text=REM.compose({events:evs,today,done:J('nch2_club_done')||{},dueCount:due,ii:J('nch2_club_ii')||{}});
      if(!text){ out.skipped['писать нечего']=(out.skipped['писать нечего']||0)+1; continue; }
      /* одно напоминание в день даже при параллельных запусках: сначала занять день, потом писать */
      if(!(await store.put('remsent',{id:u.id+':'+d.date,exp:t+3*DAY},{ifNotExists:true}))) continue;
      await store.update('users',u.id,{reminders:Object.assign({},u.reminders,{lastSent:d.date})});
      const r=await o.bot.send(u.tgId,text,{reply_markup:{inline_keyboard:[[{text:'Открыть клуб',url:cfg.origin+'/'}],[{text:'Пауза',callback_data:'pause'}]]}});
      if(r&&r.ok) out.sent++; else if(r&&r.error_code===403) await store.update('users',u.id,{reminders:Object.assign({},u.reminders,{lastSent:d.date,canWrite:false})}); }
    await maintain(t); return out; }

  /* уборка: просроченные сессии, ссылки, лимиты, старый журнал входов */
  async function maintain(at){ const t=at||now();
    for(const [tb,f] of [['sessions',x=>x.expiresAt<t||x.lastSeen+IDLE_DAYS*DAY<t],['botlogin',x=>x.exp<t-DAY],['ratelimit',x=>x.exp<t],['remsent',x=>x.exp<t]]){
      const old=await store.scan(tb,f); for(const x of old) await store.del(tb,x.id); }
    const logs=await store.scan('loginlog',x=>x.ts<t-LOG_DAYS*DAY); for(const x of logs) await store.del('loginlog',{h:x.h,r:x.r}); }

  /* ── маршрутизация ── */
  async function handle(req){ let res, cookie=null;
    try{
      const key=req.method+' '+req.path, isApi=req.path.startsWith('/api/');
      if(!isApi){ if(req.method!=='GET'&&req.method!=='HEAD') fail(405,'Метод не поддерживается.'); res=H.staticFile(req.path,req,cfg)||H.json(404,{error:'Не найдено.'}); return finish(res); }
      const mutating=!['GET','HEAD','OPTIONS'].includes(req.method);
      if(mutating&&key!=='POST /api/tg/webhook'&&!sameOrigin(req)) fail(403,'Запрос с чужого сайта отклонён.');
      let h=R[key], r;
      if(h) r=await h(req);
      else if(A[key]||D[key]){ const S=await session(req); if(!S) fail(401,'Нужно войти.',{login:true});
        if(mutating&&!C.safeEqual(req.headers['x-csrf-token']||'',S.s.csrf)) fail(403,'Сессия устарела: обновите страницу.',{csrf:true});
        await limit('api',S.user.id,300,300);
        if(D[key]&&S.user.role!=='admin') fail(403,'Только для админа.');
        r=await (A[key]||D[key])(req,S); }
      else fail(404,'Нет такого запроса.');
      if(r&&r.resp){ res=r.resp; cookie=r.cookie; } else res=r;
    }catch(e){ if(e instanceof HttpError){ res=H.json(e.status,Object.assign({error:e.message},e.extra||{}),e.status===429&&e.extra?{'Retry-After':String(e.extra.retry)}:{}); }
      else { log.error('ошибка',e&&e.stack||e); res=H.json(500,{error:'Что-то сломалось на сервере. Попробуйте позже.'}); } }
    return finish(res,cookie); }
  function finish(res,cookie){ res.headers=Object.assign(H.securityHeaders(cfg,false),res.headers||{}); if(cookie) res.multiValueHeaders={'Set-Cookie':[cookie]}; return res; }

  return {handle,remind,maintain,onUpdate,ensureBot,ownerLink,DOCS_VERSION,_loginId:loginId};
}
module.exports={createApp,maskIp,DOCS_VERSION};
