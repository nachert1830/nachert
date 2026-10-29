/* API клуба. Одна функция обслуживает и API (/api/*), и статику клуба (club/), поэтому заголовки безопасности одни.
   createApp({cfg, store, clock, bot, log}) → {handle(req), remind(now), maintain(now)}.
   Безопасность (подробно — lk/README.md, раздел «Безопасность»):
   • регистрация только по одноразовому приглашению (или владелец из ADMIN_TG_IDS / ADMIN_YA_LOGINS);
   • вход через Яндекс ID (OAuth, код подтверждения обменивается на сервере; хранится только id и имя) или через бота;
   • вход через бота: участник нажимает «Старт» у бота, бот присылает в ЕГО чат кнопку с одноразовой ссылкой (10 минут, один раз,
     в базе — только SHA-256); входит тот браузер, где ссылку открыли. Telegram id — только из обновления на вебхук с секретом;
   • сессия — токен в заголовке Authorization (страница клуба на nachert1830.ru — другой сайт, cookie туда не дойдёт)
     или cookie HttpOnly, Secure, SameSite=Lax для страницы с адреса функции; в базе только SHA-256;
     CSRF — Origin из списка сайтов клуба, для cookie ещё токен в заголовке X-CSRF-Token;
   • лимиты запросов, журнал входов (IP усечён), выгрузка и удаление своих данных. */
'use strict';
const C=require('./crypto');
const LET=require('./letters');
const H=require('./http');
const FEAT=require('../../lk/lib/features.js');
const SYNC=require('../../lk/lib/sync.js');
const CAL=require('../../lk/lib/calendar.js');
const REM=require('../../lk/lib/reminder.js');
const SRS=require('../../lk/lib/srs.js');
const EYES=require('./eyes');

const DOCS_VERSION='2026-10-25';
const SESSION_DAYS=30, IDLE_DAYS=14, LOGIN_MIN=10, LOG_DAYS=90, ACT_DAYS=30, MAX_BODY=300*1024, EYES_BODY=3*1024*1024;
const DAY=864e5;

class HttpError extends Error{ constructor(status,msg,extra){ super(msg); this.status=status; this.extra=extra; } }
const fail=(s,m,x)=>{ throw new HttpError(s,m,x); };

function maskIp(ip){ ip=String(ip||''); if(/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/,'.0'); if(ip.includes(':')) return ip.split(':').slice(0,3).join(':')+'::/48'; return ''; }
/* учебная группа: «ИУ5-11Б», «рк6-31б» → «РК6-31Б»; пусто — не указана */
const cleanGroup=s=>{ let x=String(s||'').toUpperCase().trim().replace(/[–—]/g,'-'); if(!x.includes('-')) x=x.replace(/[\s_]+/,'-'); return x.replace(/[^А-ЯЁA-Z0-9.\/-]/g,'').slice(0,16); };
const cleanVariant=v=>{ const n=parseInt(v,10); return n>=1&&n<=40?n:0; };
const okGroup=g=>/^[А-ЯЁA-Z]{1,6}\d{0,2}[А-ЯЁA-Z]?-[\d.]{1,5}(\/\d)?[А-ЯЁA-Z]{0,2}$/.test(g);
const cleanName=s=>String(s||'').replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,60);

function createApp(o){
  const {cfg,store}=o, now=()=>(o.clock?o.clock():Date.now()), log=o.log||console, http=o.fetch||((...a)=>fetch(...a));
  cfg.fronts=cfg.fronts||[cfg.origin]; cfg.frontUrl=cfg.frontUrl||cfg.origin+'/'; cfg.yandex=Object.assign({authUrl:'https://oauth.yandex.ru/authorize',tokenUrl:'https://oauth.yandex.ru/token',
    infoUrl:'https://login.yandex.ru/info?format=json',revokeUrl:'https://oauth.yandex.ru/revoke_token'},cfg.yandex||{}); cfg.adminYa=cfg.adminYa||[];
  const cookieName=cfg.secure?'__Host-club_sid':'club_sid';
  const isBootstrap=key=>key.startsWith('tg:')&&cfg.adminTg.includes(key.slice(3));

  /* ── конфигурация клуба ── */
  async function flagsRaw(){ const r=await store.get('config','flags'); return FEAT.normalize(r&&r.values); }
  async function settings(){ const r=await store.get('config','settings'); const w=r&&CAL.isDate(r.week1)?r.week1:(CAL.isDate(cfg.week1)?cfg.week1:CAL.DEFAULT_WEEK1); return {week1:w}; }

  /* ── лимиты запросов: фиксированное окно ── */
  async function limit(bucket,key,max,winSec){ const t=now(), w=Math.floor(t/1000/winSec);
    const n=await store.incr('ratelimit',bucket+':'+key+':'+w,'n',1,{exp:(w+1)*winSec*1000});
    if(n>max*(cfg.limitScale||1)) fail(429,'Слишком много попыток. Подождите немного и попробуйте снова.',{retry:Math.ceil(((w+1)*winSec*1000-t)/1000)}); }

  async function logLogin(req,userId,method,ok,reason){ const t=now();
    try{ await store.put('loginlog',{h:userId||'anon',r:new Date(t).toISOString()+'#'+C.token(4),ts:t,method,ok,reason:reason||'',ip:maskIp(req.ip)}); }catch(e){ log.error('loginlog',e); } }

  /* ── сессии ── */
  async function newSession(req,user){ const tok=C.token(32), csrf=C.token(24), t=now();
    await store.put('sessions',{id:C.sha256(tok),userId:user.id,csrf,createdAt:t,lastSeen:t,expiresAt:t+SESSION_DAYS*DAY});
    return {tok,cookie:H.cookie(cookieName,tok,{secure:cfg.secure,maxAge:SESSION_DAYS*86400}),csrf}; }
  /* токен — из заголовка Authorization: Bearer (страница на другом сайте) или из cookie */
  async function session(req){ const m=/^Bearer ([A-Za-z0-9_-]{20,64})$/.exec(req.headers.authorization||''), bearer=!!m, tok=m?m[1]:req.cookies[cookieName];
    if(!tok||!/^[A-Za-z0-9_-]{20,64}$/.test(tok)) return null;
    const h=C.sha256(tok), s=await store.get('sessions',h), t=now(); if(!s) return null;
    if(s.expiresAt<t||s.lastSeen+IDLE_DAYS*DAY<t){ await store.del('sessions',h); return null; }
    const u=await store.get('users',s.userId); if(!u||u.blocked){ await store.del('sessions',h); return null; }
    if(t-s.lastSeen>10*60e3){ await store.update('sessions',h,{lastSeen:t}); await store.update('users',u.id,{lastSeen:t}); }
    return {h,s,user:u,bearer}; }
  const clearCookie=()=>H.cookie(cookieName,'',{secure:cfg.secure,maxAge:0});

  /* ── приглашения ── */
  /* открытая регистрация (по умолчанию): приглашения не нужны — первый вход по почте или через Яндекс ID создаёт аккаунт */
  async function inviteState(h){ if(cfg.openSignup) return {ok:true,open:true};
    if(!h) return {ok:false,why:'Клуб закрытый: для регистрации нужно приглашение.'};
    const inv=await store.get('invites',h), t=now();
    if(!inv) return {ok:false,why:'Приглашение не найдено. Проверьте ссылку.'};
    if(inv.revokedAt) return {ok:false,why:'Приглашение отозвано.'};
    if(inv.multi){ if((inv.uses||0)>=inv.maxUses) return {ok:false,why:'По этой ссылке уже зарегистрировались все, кого приглашали.'}; }
    else if(inv.usedAt) return {ok:false,why:'Приглашение уже использовано.'};
    if(inv.expiresAt<t) return {ok:false,why:'Срок приглашения истёк.'};
    return {ok:true,inv}; }
  const inviteHash=code=>typeof code==='string'&&/^[A-Za-z0-9_-]{16,64}$/.test(code)?C.sha256(code):null;
  function consentOk(c){ return !!(c&&c.terms===true&&c.pd===true); }

  /* вход существующего участника или регистрация нового */
  async function enter(req,{key,method,name,tgId,invite,consent,boot,group,variant}){
    const ident=await store.get('identities',key); let user=ident?await store.get('users',ident.userId):null, isNew=false;
    if(user&&user.blocked){ await logLogin(req,user.id,method,false,'заблокирован'); fail(403,'Доступ к личному кабинету закрыт.'); }
    if(!user){
      boot=!!boot||isBootstrap(key);
      let st=null; if(!boot){ st=await inviteState(invite); if(!st.ok){ await logLogin(req,null,method,false,'без приглашения: '+st.why); fail(403,st.why,{needInvite:true}); } }
      if(!consentOk(consent)){ await logLogin(req,null,method,false,'нет согласия'); fail(400,'Для регистрации нужно принять соглашение и дать согласие на обработку данных.',{needConsent:true}); }
      const t=now(), id=C.id('u_');
      if(st&&st.inv&&st.inv.multi){ let ok=false; for(let i=0;i<5&&!ok;i++){ const cur=await store.get('invites',invite); if(!cur||cur.revokedAt||(cur.uses||0)>=cur.maxUses) break;
          ok=!!(await store.update('invites',invite,{uses:(cur.uses||0)+1,lastUsedAt:t},{ifEq:{uses:cur.uses||0}})); }
        if(!ok) fail(403,'По этой ссылке уже зарегистрировались все, кого приглашали.',{needInvite:true}); }
      else if(st&&st.inv){ const claimed=await store.update('invites',invite,{usedAt:t,usedBy:id},{ifEq:{usedAt:null,revokedAt:null}}); if(!claimed) fail(403,'Приглашение уже использовано.',{needInvite:true}); }
      user={id,name:cleanName(name)||'Участник',role:boot?'admin':(st&&st.inv&&st.inv.role==='admin'?'admin':'member'),method,createdAt:t,
        tgId:tgId||null,ya:key.startsWith('ya:'),em:key.startsWith('em:'),...(group&&okGroup(group)?{group}:{}),...(cleanVariant(variant)?{variant:cleanVariant(variant)}:{}),consent:{terms:DOCS_VERSION,pd:DOCS_VERSION,at:t,photos:!!consent.photos,photosAt:t},reminders:Object.assign(REM.norm({}),{canWrite:true}),invite:invite?invite.slice(0,12):null};
      if(!(await store.put('identities',{id:key,userId:id,type:method,createdAt:t},{ifNotExists:true}))) fail(409,'Этот вход уже привязан к другому участнику.');
      await store.put('users',user); isNew=true; }
    const ses=await newSession(req,user); await store.update('users',user.id,{lastLogin:now()}); await logLogin(req,user.id,method,true,isNew?'регистрация':''); await logAct(user.id,isNew?'signup':'login',{m:method});
    return {resp:H.json(200,{ok:true,isNew,user:publicUser(user),csrf:ses.csrf,session:ses.tok}),cookie:ses.cookie}; }
  const publicUser=u=>({id:u.id,name:u.name,group:u.group||'',variant:u.variant||0,role:u.role,method:u.method,telegram:!!u.tgId,yandex:!!u.ya,email:!!u.em,createdAt:u.createdAt,photos:!!(u.consent&&u.consent.photos)});

  /* ── проверки запроса ── */
  /* запрос — со страницы клуба: с адреса функции (тот же сайт) или с nachert1830.ru (список FRONT_ORIGINS, ответы с CORS) */
  function sameOrigin(req){ const org=req.headers.origin; if(!org||!cfg.fronts.includes(org)) return false;
    const sfs=req.headers['sec-fetch-site']; return org!==cfg.origin||!sfs||sfs==='same-origin'||sfs==='none'; }
  function body(req,max){ if(req.body.length>(max||MAX_BODY)) fail(413,'Слишком большой запрос.');
    if(!/^application\/json\b/i.test(req.headers['content-type']||'')) fail(415,'Нужен JSON.');
    try{ const b=JSON.parse(req.body||'{}'); if(!b||typeof b!=='object'||Array.isArray(b)) throw 0; return b; }catch(e){ fail(400,'Неверный JSON.'); } }

  /* ── обработчики ── */
  const R={};
  R['GET /api/config']=async()=>{ const s=await settings(); return H.json(200,{botId:(cfg.botToken.split(':')[0])||null,botName:cfg.botName||null,
    frontUrl:cfg.frontUrl,telegram:!!(cfg.dev||cfg.tgLoginOn),openSignup:!!cfg.openSignup,yandex:!!cfg.yandex.clientId,email:!!(o.mail&&o.mail.enabled),devBot:!!cfg.dev,tgLogin:cfg.botToken&&cfg.tgLogin&&cfg.tgLogin.origins.length?cfg.tgLogin:null,mainUrl:cfg.mainUrl,week1:s.week1,docs:DOCS_VERSION,features:FEAT.FEATURES.map(f=>({id:f.id,t:f.t}))}); };

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
      if(!st.ok) return say(from.id,'Это бот личного кабинета Начерта. '+(code?st.why:'Вход — по личной ссылке-приглашению.')); }
    const tok=C.token(24), name=cleanName(from.first_name)||'Участник';
    await store.put('botlogin',{id:loginId(tok),key,method:'telegram',name,invite:member?null:inv,exp:t+LOGIN_MIN*60e3,used:false,createdAt:t});
    return say(from.id,'Вход в личный кабинет Начерта.\n\nНажмите кнопку — откроется кабинет, и вы войдёте. Ссылка действует '+LOGIN_MIN+' минут и срабатывает один раз. Не пересылайте её: по ней можно войти в ваш аккаунт.',
      {reply_markup:{inline_keyboard:[[{text:'Войти в кабинет',url:cfg.frontUrl+'#/tg/'+tok}]]}}); }
  /* вход владельца без Telegram: ссылку выдаёт сама функция при прямом вызове из yc (server/tools/login.js).
     Вызвать функцию напрямую может только тот, у кого есть права в облаке, — шлюз передаёт ей лишь HTTP-запросы. */
  async function ownerLink(){ const owner=cfg.adminTg[0]; if(!owner) throw new Error('ADMIN_TG_IDS не задан');
    const ex=await store.get('identities','tg:'+owner), u=ex&&await store.get('users',ex.userId);
    const tok=C.token(24), t=now(), min=30;
    await store.put('botlogin',{id:loginId(tok),key:'tg:'+owner,method:'telegram',name:(u&&u.name)||'Владелец',invite:null,exp:t+min*60e3,used:false,createdAt:t,via:'owner'});
    return {link:cfg.frontUrl+'#/tg/'+tok,minutes:min}; }
  const say=(chat,text,extra)=>Object.assign({method:'sendMessage',chat_id:chat,text,disable_web_page_preview:true},extra||{});

  /* шаг 3: confirm=false — только узнать имя («Войти как …?»), confirm=true — войти */
  R['POST /api/auth/bot/redeem']=async(req)=>{ const b=body(req); await limit('login',maskIp(req.ip),30,600);
    const tok=String(b.token||''); if(!/^[A-Za-z0-9_-]{30,40}$/.test(tok)) fail(400,'Ссылка для входа неверная. Нажмите «Старт» у бота ещё раз.');
    const id=loginId(tok), r=await store.get('botlogin',id), t=now();
    if(!r||r.exp<t||r.kind){ await logLogin(req,null,'telegram',false,'ссылка устарела'); fail(410,'Ссылка для входа устарела. Нажмите «Старт» у бота ещё раз — придёт новая.',{expired:true}); }
    if(r.used){ await logLogin(req,null,'telegram',false,'повтор ссылки'); fail(410,'Эта ссылка уже использована. Нажмите «Старт» у бота ещё раз — придёт новая.',{expired:true}); }
    const key=r.key||'tg:'+r.tg, method=r.method||'telegram', member=!!(await store.get('identities',key));
    if(!b.confirm) return H.json(200,Object.assign({name:r.name,member,method},r.label?{label:r.label}:{}));
    const nm=cleanName(b.name);
    const consent=consentOk(b.consent)?{terms:true,pd:true,photos:!!b.consent.photos}:null;
    if(!member&&!consent) fail(400,'Для регистрации нужно принять соглашение и дать согласие на обработку данных.',{needConsent:true});
    if(!(await store.update('botlogin',id,{used:true,usedAt:t},{ifEq:{used:false}}))) fail(410,'Эта ссылка уже использована.',{expired:true});
    return enter(req,{key,method,name:nm||r.name,group:cleanGroup(b.group),variant:b.variant,tgId:key.startsWith('tg:')?key.slice(3):null,invite:r.invite,consent,boot:r.boot}); };

  /* ── официальный вход Telegram (oauth.telegram.org) ──
     Страница уходит на oauth.telegram.org/auth?bot_id=…&origin=…&return_to=<страница>; человек подтверждает вход в приложении
     Telegram (сообщение приходит от самого Telegram, не от нашего бота) и возвращается на <страница>#tgAuthResult=<данные>.
     Данные подписаны Telegram: HMAC-SHA256 с ключом SHA-256(токен бота) — проверяем подпись без запросов в Telegram.
     Свежесть — 10 минут, каждая подпись — один раз; дальше тот же экран «Войти как …?». Домен сайта задаётся у @BotFather (/setdomain). */
  const tgSecret=()=>require('crypto').createHash('sha256').update(cfg.botToken).digest();
  function tgVerify(d){ if(!d||typeof d!=='object'||Array.isArray(d)) return null;
    const keys=Object.keys(d).filter(k=>k!=='hash'); if(keys.length>12||!/^[0-9a-f]{64}$/.test(String(d.hash||''))) return null;
    if(keys.some(k=>!/^[a-z_]{1,20}$/.test(k)||!['string','number'].includes(typeof d[k])||String(d[k]).length>300)) return null;
    const dcs=keys.sort().map(k=>k+'='+d[k]).join('\n');
    if(!C.safeEqual(C.hmac(tgSecret(),dcs),String(d.hash))) return null;
    if(!/^\d{1,16}$/.test(String(d.id))||!/^\d{9,11}$/.test(String(d.auth_date))) return null;
    return {id:String(d.id),name:cleanName(d.first_name)||'Участник',at:+d.auth_date*1000,hash:String(d.hash)}; }
  R['POST /api/auth/telegram']=async(req)=>{ const b=body(req); await limit('login',maskIp(req.ip),30,600);
    if(!cfg.botToken) fail(404,'Вход через Telegram не настроен.');
    const v=tgVerify(b.data), t=now();
    if(!v){ await logLogin(req,null,'telegram',false,'подпись Telegram не сошлась'); fail(400,'Telegram не подтвердил вход. Попробуйте ещё раз.'); }
    if(v.at<t-LOGIN_MIN*60e3||v.at>t+60e3){ await logLogin(req,null,'telegram',false,'подтверждение устарело'); fail(410,'Подтверждение Telegram устарело. Нажмите «Войти через Telegram» ещё раз.',{expired:true}); }
    if(!(await store.put('botlogin',{id:C.sha256('tgauth:'+v.hash).slice(0,40),kind:'tgauth',exp:t+DAY,createdAt:t},{ifNotExists:true}))) fail(410,'Это подтверждение уже использовано. Нажмите «Войти через Telegram» ещё раз.',{expired:true});
    const key='tg:'+v.id, member=!!(await store.get('identities',key)), inv=member?null:inviteHash(b.invite);
    if(!member&&!isBootstrap(key)){ const st=await inviteState(inv); if(!st.ok){ await logLogin(req,null,'telegram',false,'без приглашения: '+st.why); fail(403,b.invite?st.why:'Регистрация сейчас закрыта.',{needInvite:true}); } }
    const tok=C.token(24);
    await store.put('botlogin',{id:loginId(tok),key,method:'telegram',name:v.name,invite:inv,exp:t+LOGIN_MIN*60e3,used:false,createdAt:t});
    return H.json(200,{token:tok}); };

  /* ── вход по почте: код из 6 цифр на 10 минут, 5 попыток ──
     Адрес почты не хранится: в базе только SHA-256 от него (ключ входа em:<хеш>) и хеш кода. Писать участнику потом нечем — и не нужно. */
  const mailer=o.mail||{enabled:false};
  const normEmail=e=>String(e||'').trim().toLowerCase();
  const okEmail=e=>e.length<=254&&/^[^\s@<>()",;:]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e);
  const emKey=e=>'em:'+C.sha256('email:'+e).slice(0,40), emRec=e=>C.sha256('emcode:'+e).slice(0,40);
  const maskEmail=e=>{ const [u,d]=e.split('@'); return (u.length<=2?u[0]+'•':u.slice(0,2)+'•••')+'@'+d; };
  R['POST /api/auth/email/start']=async(req)=>{ const b=body(req), e=normEmail(b.email);
    if(!mailer.enabled) fail(404,'Вход по почте пока не настроен.');
    if(!okEmail(e)) fail(400,'Проверьте адрес почты.');
    await limit('emip',maskIp(req.ip),10,600); await limit('emaddr',C.sha256(e).slice(0,24),5,3600);
    const key=emKey(e), member=!!(await store.get('identities',key)), inv=member?null:inviteHash(b.invite);
    if(!member){ const st=await inviteState(inv); if(!st.ok){ await logLogin(req,null,'email',false,'без приглашения: '+st.why); fail(403,b.invite?st.why:'Регистрация сейчас закрыта.',{needInvite:true}); } }
    const code=String(require('crypto').randomInt(0,1e6)).padStart(6,'0'), t=now();
    await store.put('botlogin',{id:emRec(e),kind:'emcode',code:C.sha256(code+':'+e),invite:inv,tries:0,exp:t+LOGIN_MIN*60e3,createdAt:t});
    const r=await mailer.send(Object.assign({to:e},LET.loginCode(code,LOGIN_MIN)));
    if(!r||!r.ok){ log.error('почта',r&&r.error); fail(502,'Не получилось отправить письмо. Попробуйте ещё раз через минуту.'); }
    return H.json(200,{ok:true,to:maskEmail(e),minutes:LOGIN_MIN}); };
  R['POST /api/auth/email/verify']=async(req)=>{ const b=body(req), e=normEmail(b.email), code=String(b.code||'').replace(/\D/g,''), t=now();
    await limit('emver',maskIp(req.ip),30,600);
    const r=okEmail(e)?await store.get('botlogin',emRec(e)):null;
    if(!r||r.kind!=='emcode'||r.exp<t) fail(410,'Код устарел. Запросите новый.',{expired:true});
    if(r.tries>=5) fail(429,'Слишком много попыток. Запросите новый код.',{expired:true});
    if(!(await store.update('botlogin',r.id,{tries:r.tries+1},{ifEq:{tries:r.tries}}))) fail(409,'Попробуйте ещё раз.');
    if(code.length!==6||!C.safeEqual(C.sha256(code+':'+e),r.code)){ await logLogin(req,null,'email',false,'неверный код'); fail(400,'Код не подошёл. Осталось попыток: '+(4-r.tries)+'.'); }
    await store.del('botlogin',r.id);
    const tok=C.token(24);
    await store.put('botlogin',{id:loginId(tok),key:emKey(e),method:'email',name:'Участник',label:maskEmail(e),invite:r.invite||null,exp:t+LOGIN_MIN*60e3,used:false,createdAt:t});
    return H.json(200,{token:tok}); };

  R['POST /api/tg/webhook']=async(req)=>{ if(!cfg.webhookSecret||!C.safeEqual(req.headers['x-telegram-bot-api-secret-token']||'',cfg.webhookSecret)) fail(403,'нет');
    let u={}; try{ u=JSON.parse(req.body||'{}'); }catch(e){} const act=await onUpdate(u); return H.json(200,act||{ok:true}); };

  /* ── вход через Яндекс ID (OAuth 2.0, код подтверждения) ──
     1) страница клуба уходит на /api/auth/yandex/start?ret=<страница>&s=<случайная строка из sessionStorage>[&invite|&link];
     2) сервер запоминает state (10 минут, один раз) и отправляет на oauth.yandex.ru;
     3) Яндекс возвращает на /api/auth/yandex/callback с кодом; сервер меняет код на токен (с Client secret), берёт id и имя,
        сразу отзывает токен Яндекса и отправляет на <страница>#/ya/<одноразовый вход>/<s>;
     4) страница сверяет s со своим sessionStorage (вход начат в этом же браузере) и показывает «Войти как …?».
     Хранится только Yandex id и имя; логин Яндекса — только для сравнения с ADMIN_YA_LOGINS, не сохраняется. */
  const stateId=st=>C.sha256('yastate:'+st).slice(0,40), linkId=code=>C.sha256('link:'+code).slice(0,40);
  const okRet=u=>typeof u==='string'&&(u===cfg.frontUrl||cfg.fronts.some(f=>u===f+'/'||u===f+'/lk/'||u===f+'/club/'));
  const back=(ret,frag)=>({statusCode:302,headers:{Location:ret+'#/'+frag,'Cache-Control':'no-store'},body:''});
  R['GET /api/auth/yandex/start']=async(req)=>{ const q=req.query||{};
    if(!cfg.yandex.clientId) fail(404,'Вход через Яндекс ID не настроен.');
    const ret=okRet(q.ret)?q.ret:cfg.frontUrl; if(!/^[A-Za-z0-9_-]{16,64}$/.test(q.s||'')) return back(ret,'oops/state');
    await limit('yastart',maskIp(req.ip),30,600);
    const t=now(), st=C.token(24), rec={id:stateId(st),kind:'yastate',ret,cs:q.s,exp:t+LOGIN_MIN*60e3,used:false,createdAt:t};
    if(q.link){ const l=/^[A-Za-z0-9_-]{20,40}$/.test(q.link)?await store.get('botlogin',linkId(q.link)):null;
      if(!l||l.kind!=='link'||l.used||l.exp<t||l.to!=='yandex') return back(ret,'oops/link'); rec.link=l.id; }
    else if(q.invite&&inviteHash(q.invite)) rec.invite=inviteHash(q.invite);
    await store.put('botlogin',rec);
    const u=new URL(cfg.yandex.authUrl); u.search=new URLSearchParams({response_type:'code',client_id:cfg.yandex.clientId,redirect_uri:cfg.origin+'/api/auth/yandex/callback',state:st,force_confirm:'no'}).toString();
    return {statusCode:302,headers:{Location:u.toString(),'Cache-Control':'no-store'},body:''}; };

  async function yandexProfile(code){
    const tr=await http(cfg.yandex.tokenUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(8000),
      body:new URLSearchParams({grant_type:'authorization_code',code,client_id:cfg.yandex.clientId,client_secret:cfg.yandex.secret}).toString()});
    const tj=await tr.json().catch(()=>({})); if(!tr.ok||!tj.access_token) throw new Error('token: '+tr.status+' '+(tj.error||''));
    const ir=await http(cfg.yandex.infoUrl,{headers:{Authorization:'OAuth '+tj.access_token},signal:AbortSignal.timeout(8000)});
    const p=await ir.json().catch(()=>({}));
    /* токен Яндекса больше не нужен — отзываем, не храним */
    http(cfg.yandex.revokeUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(5000),
      body:new URLSearchParams({access_token:tj.access_token,client_id:cfg.yandex.clientId,client_secret:cfg.yandex.secret}).toString()}).catch(()=>{});
    if(!ir.ok||!/^\d{1,20}$/.test(String(p.id||''))) throw new Error('info: '+ir.status);
    if(p.client_id&&p.client_id!==cfg.yandex.clientId) throw new Error('чужое приложение');
    return {id:String(p.id),name:cleanName(p.first_name||p.display_name||p.real_name)||'Участник',login:String(p.login||'').toLowerCase()}; }

  R['GET /api/auth/yandex/callback']=async(req)=>{ const q=req.query||{}, t=now();
    const rec=/^[A-Za-z0-9_-]{30,40}$/.test(q.state||'')?await store.get('botlogin',stateId(q.state)):null;
    if(!rec||rec.kind!=='yastate'||rec.exp<t||rec.used) return back(cfg.frontUrl,'oops/state');
    if(!(await store.update('botlogin',rec.id,{used:true,usedAt:t},{ifEq:{used:false}}))) return back(rec.ret,'oops/state');
    if(q.error||!q.code) return back(rec.ret,'oops/denied');
    let p; try{ p=await yandexProfile(String(q.code).slice(0,200)); }catch(e){ log.error('Яндекс ID',e&&e.message); await logLogin(req,null,'yandex',false,'Яндекс ID не ответил'); return back(rec.ret,'oops/fail'); }
    const key='ya:'+p.id;
    if(rec.link){ const l=await store.get('botlogin',rec.link);
      if(!l||l.used||l.exp<t||!(await store.update('botlogin',l.id,{used:true,usedAt:t},{ifEq:{used:false}}))) return back(rec.ret,'oops/link');
      const ex=await store.get('identities',key); if(ex&&ex.userId!==l.userId) return back(rec.ret,'oops/taken');
      return back(rec.ret,'link/'+(await linkOk(l.userId,key))+'/'+rec.cs); }
    const login=normLogin(p.login), member=!!(await store.get('identities',key)), boot=!!login&&cfg.adminYa.map(normLogin).includes(login);
    if(!member&&!boot){ const st=await inviteState(rec.invite); if(!st.ok){ await logLogin(req,null,'yandex',false,'без приглашения: '+st.why); return back(rec.ret,'oops/'+(rec.invite?'invite':'noinvite')); } }
    const tok=C.token(24);
    await store.put('botlogin',{id:loginId(tok),key,method:'yandex',name:p.name,invite:member?null:rec.invite||null,boot,exp:t+LOGIN_MIN*60e3,used:false,createdAt:t});
    return back(rec.ret,'ya/'+tok+'/'+rec.cs); };

  /* в логинах Яндекса точка и дефис — одно и то же */
  const normLogin=x=>String(x||'').toLowerCase().replace(/\./g,'-');
  /* ── второй способ входа: привязать Яндекс ID или Telegram к уже существующему аккаунту ──
     Код привязки (10 минут) → вход в Яндекс или «Старт» у бота → одноразовая ссылка #/link/<токен>, которую подтверждает
     только браузер, где открыт ТОТ ЖЕ аккаунт: присланная кем-то ссылка на привязку не подцепит ваш вход к чужому аккаунту. */
  const okId=tok=>C.sha256('linkok:'+tok).slice(0,40);
  async function linkOk(userId,key){ const tok=C.token(24), t=now();
    await store.put('botlogin',{id:okId(tok),kind:'linkok',userId,key,exp:t+LOGIN_MIN*60e3,used:false,createdAt:t}); return tok; }
  async function linkCode(S,to){ const code=C.token(18), t=now(); await limit('link',S.user.id,10,3600);
    await store.put('botlogin',{id:linkId(code),kind:'link',to,userId:S.user.id,exp:t+LOGIN_MIN*60e3,used:false,createdAt:t}); return code; }
  async function linkTelegram(from,code){ const t=now(), l=/^[A-Za-z0-9_-]{20,40}$/.test(code)?await store.get('botlogin',linkId(code)):null;
    if(!l||l.kind!=='link'||l.to!=='telegram'||l.used||l.exp<t) return say(from.id,'Ссылка для привязки устарела. Нажмите «Привязать Telegram» в профиле личного кабинета ещё раз.');
    const key='tg:'+from.id, ex=await store.get('identities',key);
    if(ex&&ex.userId!==l.userId) return say(from.id,'Этот Telegram уже привязан к другому аккаунту.');
    if(!(await store.update('botlogin',l.id,{used:true,usedAt:t},{ifEq:{used:false}}))) return say(from.id,'Ссылка уже использована.');
    const tok=await linkOk(l.userId,key);
    return say(from.id,'Привязка Telegram к личному кабинету. Нажмите кнопку — откроется кабинет, где вы вошли, и привязка завершится. Ссылка действует '+LOGIN_MIN+' минут.',
      {reply_markup:{inline_keyboard:[[{text:'Привязать к кабинету',url:cfg.frontUrl+'#/link/'+tok}]]}}); }

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
    if(b.group!=null){ const g=cleanGroup(b.group); if(g&&!okGroup(g)) fail(400,'Группа — как в расписании, например ИУ5-12/6.'); set.group=g; }
    if(b.variant!=null) set.variant=cleanVariant(b.variant);
    if(b.photos!=null) set.consent=Object.assign({},S.user.consent,{photos:b.photos===true,photosAt:now()});
    const u=await store.update('users',S.user.id,set); return H.json(200,{user:publicUser(u)}); };

  A['POST /api/me/reminders']=async(req,S)=>{ const fl=FEAT.effective(await flagsRaw(),S.user.role); if(!fl.reminders) fail(403,'Напоминания сейчас выключены.');
    const b=body(req), cur=S.user.reminders||{}, next=REM.norm(Object.assign({},cur,b));
    if(b.tz!=null&&!REM.validTz(b.tz)) fail(400,'Неизвестный часовой пояс.');
    if(b.enabled&&!S.user.tgId) fail(409,'Напоминания приходят в Telegram — сначала привяжите его: «Настройки» → «Способы входа».',{needTelegram:true});
    let canWrite=cur.canWrite;
    if(next.enabled&&(!cur.enabled||cur.canWrite===false)){ await limit('remtest',S.user.id,5,3600);
      const r=await o.bot.send(S.user.tgId,'Напоминания личного кабинета Начерта включены: не чаще раза в день, около '+next.time+', тихие часы '+next.quietFrom+'–'+next.quietTo+'. Пауза — /pause или в профиле личного кабинета.');
      canWrite=!!(r&&r.ok);
      if(!canWrite){ await store.update('users',S.user.id,{reminders:Object.assign({},cur,{canWrite:false})});
        fail(409,'Бот пока не может вам писать. Откройте бота и нажмите «Старт», затем включите напоминания ещё раз.',{needStart:true,bot:cfg.botName?'https://t.me/'+cfg.botName+'?start=remind':null}); } }
    const rec=Object.assign({},next,{canWrite:canWrite!==false,lastSent:cur.lastSent||null});
    await store.update('users',S.user.id,{reminders:rec}); return H.json(200,{reminders:REM.norm(rec)}); };

  A['POST /api/me/link']=async(req,S)=>{ const b=body(req);
    if(b.to==='telegram'){ if(S.user.tgId) fail(409,'Telegram уже привязан.'); if(!cfg.botName) fail(404,'Бот не настроен.');
      return H.json(200,{url:'https://t.me/'+cfg.botName+'?start=l_'+(await linkCode(S,'telegram'))}); }
    if(b.to==='yandex'){ if(S.user.ya) fail(409,'Яндекс ID уже привязан.'); if(!cfg.yandex.clientId) fail(404,'Вход через Яндекс ID не настроен.');
      if(!okRet(b.ret)||!/^[A-Za-z0-9_-]{16,64}$/.test(b.s||'')) fail(400,'Неверный адрес возврата.');
      return H.json(200,{url:cfg.origin+'/api/auth/yandex/start?'+new URLSearchParams({link:await linkCode(S,'yandex'),ret:b.ret,s:b.s}).toString()}); }
    if(b.to==='email'){ const e=normEmail(b.email); if(!mailer.enabled) fail(404,'Вход по почте пока не настроен.'); if(!okEmail(e)) fail(400,'Проверьте адрес почты.');
      await limit('link',S.user.id,10,3600); const ex=await store.get('identities',emKey(e)); if(ex&&ex.userId!==S.user.id) fail(409,'Эта почта уже привязана к другому аккаунту.');
      const code=String(require('crypto').randomInt(0,1e6)).padStart(6,'0'), t=now();
      await store.put('botlogin',{id:C.sha256('emlink:'+S.user.id+':'+e).slice(0,40),kind:'emlink',code:C.sha256(code+':'+e),tries:0,exp:t+LOGIN_MIN*60e3,createdAt:t});
      const r=await mailer.send(Object.assign({to:e},LET.linkCode(code,LOGIN_MIN)));
      if(!r||!r.ok) fail(502,'Не получилось отправить письмо. Попробуйте ещё раз через минуту.');
      return H.json(200,{to:maskEmail(e),minutes:LOGIN_MIN}); }
    fail(400,'Что привязать: telegram, yandex или email.'); };
  A['POST /api/me/link/email']=async(req,S)=>{ const b=body(req), e=normEmail(b.email), code=String(b.code||'').replace(/\D/g,''), t=now();
    const id=C.sha256('emlink:'+S.user.id+':'+e).slice(0,40), r=okEmail(e)?await store.get('botlogin',id):null;
    if(!r||r.kind!=='emlink'||r.exp<t) fail(410,'Код устарел. Запросите новый.');
    if(r.tries>=5) fail(429,'Слишком много попыток. Запросите новый код.');
    await store.update('botlogin',id,{tries:r.tries+1});
    if(code.length!==6||!C.safeEqual(C.sha256(code+':'+e),r.code)) fail(400,'Код не подошёл.');
    await store.del('botlogin',id);
    const ex=await store.get('identities',emKey(e)); if(ex&&ex.userId!==S.user.id) fail(409,'Эта почта уже привязана к другому аккаунту.');
    if(!ex) await store.put('identities',{id:emKey(e),userId:S.user.id,type:'email',createdAt:t},{ifNotExists:true});
    const u=await store.update('users',S.user.id,{em:true}); await logLogin(req,S.user.id,'email',true,'привязка почты');
    return H.json(200,{user:publicUser(u)}); };
  A['POST /api/me/link/confirm']=async(req,S)=>{ const b=body(req), tok=String(b.token||''), t=now();
    const r=/^[A-Za-z0-9_-]{30,40}$/.test(tok)?await store.get('botlogin',okId(tok)):null;
    if(!r||r.kind!=='linkok'||r.used||r.exp<t) fail(410,'Ссылка для привязки устарела. Нажмите «Привязать» в настройках ещё раз.');
    if(r.userId!==S.user.id) fail(403,'Эта ссылка привязки — для другого аккаунта. Привязка не выполнена.');
    const ex=await store.get('identities',r.key); if(ex&&ex.userId!==S.user.id) fail(409,'Этот вход уже привязан к другому аккаунту.');
    if(!(await store.update('botlogin',r.id,{used:true,usedAt:t},{ifEq:{used:false}}))) fail(410,'Ссылка уже использована.');
    const tg=r.key.startsWith('tg:');
    if(!ex) await store.put('identities',{id:r.key,userId:S.user.id,type:tg?'telegram':'yandex',createdAt:t},{ifNotExists:true});
    const u=await store.update('users',S.user.id,tg?{tgId:r.key.slice(3),reminders:Object.assign({},S.user.reminders||{},{canWrite:true})}:{ya:true});
    await logLogin(req,S.user.id,tg?'telegram':'yandex',true,'привязка');
    return H.json(200,{user:publicUser(u),linked:tg?'telegram':'yandex'}); };
  A['GET /api/me/logins']=async(req,S)=>{ const l=await store.query('loginlog',S.user.id,{desc:true,limit:50}); return H.json(200,{logins:l.map(x=>({ts:x.ts,method:x.method,ok:x.ok,reason:x.reason,ip:x.ip}))}); };

  A['GET /api/me/requests']=async(req,S)=>{ const l=await store.scan('feedback',x=>x.userId===S.user.id&&x.feature==='privacy');
    return H.json(200,{requests:l.sort((a,b)=>b.ts-a.ts).map(f=>({ts:f.ts,text:f.text,reply:f.reply||null,replyAt:f.replyAt||null}))}); };
  A['GET /api/me/export']=async(req,S)=>{ await limit('export',S.user.id,10,3600); const u=S.user;
    const [ids,prog,ses,logs,fb]=await Promise.all([store.scan('identities',x=>x.userId===u.id),store.get('progress',u.id),store.scan('sessions',x=>x.userId===u.id),
      store.query('loginlog',u.id),store.scan('feedback',x=>x.userId===u.id)]);
    const out={exportedAt:new Date(now()).toISOString(),about:'Все данные, которые личный кабинет Начерта хранит о вас (nachert1830.ru).',
      user:{id:u.id,name:u.name,group:u.group||null,variant:u.variant||null,role:u.role,method:u.method,telegramId:u.tgId||null,createdAt:u.createdAt,lastLogin:u.lastLogin||null,consent:u.consent,reminders:u.reminders,blocked:!!u.blocked},
      identities:ids.map(i=>({type:i.type,key:i.id,createdAt:i.createdAt})),
      progress:prog?{data:prog.data,updatedAt:prog.updatedAt}:null,
      sessions:ses.map(s=>({createdAt:s.createdAt,lastSeen:s.lastSeen,expiresAt:s.expiresAt,current:s.id===S.h})),
      loginLog:logs.map(x=>({ts:x.ts,method:x.method,ok:x.ok,reason:x.reason,ip:x.ip})),feedback:fb.map(f=>({ts:f.ts,feature:f.feature,mood:f.mood,text:f.text,reply:f.reply||null}))};
    return H.json(200,out,{'Content-Disposition':'attachment; filename="nachert-club-my-data.json"'}); };

  A['POST /api/me/delete']=async(req,S)=>{ const b=body(req); if(b.confirm!=='УДАЛИТЬ') fail(400,'Подтвердите удаление словом УДАЛИТЬ.');
    await removeUser(S.user.id); log.log&&log.log('аккаунт удалён',S.user.id); return {resp:H.json(200,{ok:true}),cookie:clearCookie()}; };

  /* глаза сканера: фото чертежа → модель со зрением → подписи точек (server/lib/eyes.js). Фото не сохраняется */
  A['POST /api/eyes']=async(req,S)=>{ const ec=o.eyes; if(!ec||!ec.on) fail(503,'ИИ-зрение пока не подключено.');
    const b=body(req,EYES_BODY), img=String(b.img||''); await limit('eyes',S.user.id,40,3600);
    if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/]+=*$/.test(img)) fail(400,'Нужно фото (JPEG, PNG или WebP).');
    const w=Math.round(+b.w)||0, h=Math.round(+b.h)||0; if(!(w>=200&&h>=200&&w<=4096&&h<=4096)) fail(400,'Размер фото — от 200 до 4096 px.');
    const dz=[1,2,3,4,5].includes(+b.dz)?+b.dz:null, n=cleanVariant(b.n)||null;
    /* consent — студент отметил, что лист его (или пример) и фото можно отправить зарубежной модели; без отметки — только Yandex */
    /* лучшая (зарубежная) модель: кому можно (EYES_BEST_FOR) и нужна ли отметка «лист мой» (EYES_BEST_DEFAULT — стенд владельца) */
    const mayBest=ec.bestFor!=='admin'||S.user.role==='admin', consent=mayBest&&(b.consent===true||ec.bestDefault);
    /* mode: 'digit' — оцифровка чертежа целиком (Sonnet): точки, отрезки, записанные ответы; part — часть, которую выбрал студент */
    const part=[1,2,3,4].includes(+b.part)?+b.part:null;
    try{ const r=b.mode==='digit'?await EYES.askDigit(ec,{image:img,w,h,n,part,consent},{fetch:http}):await EYES.askAny(ec,{image:img,w,h,dz,n,consent},{fetch:http,token:o.iamToken}); if(r.fallback) log.error('eyes',r.fallback);
      return H.json(200,{ok:true,text:r.text,model:r.model,fallback:!!r.fallback,mode:b.mode==='digit'?'digit':'eyes'}); }
    catch(e){ if(e instanceof HttpError) throw e; log.error('eyes',e&&e.message); fail(e&&e.status||502,e&&e.status?e.message:'Модель зрения не ответила. Попробуйте ещё раз.'); } };
  A['POST /api/feedback']=async(req,S)=>{ const b=body(req); await limit('fb',S.user.id,20,3600);
    const feature=FEAT.ids.includes(b.feature)||b.feature==='privacy'?b.feature:'general', mood=['good','unclear','bad'].includes(b.mood)?b.mood:null, text=String(b.text||'').replace(/\u0000/g,'').trim().slice(0,2000);
    if(!text&&!mood) fail(400,'Напишите пару слов или выберите оценку.');
    const t=now(); await store.put('feedback',{id:new Date(t).toISOString()+'#'+C.token(4),userId:S.user.id,name:S.user.name,feature,mood,text,ts:t,ver:String(b.ver||'').slice(0,20)});
    return H.json(200,{ok:true}); };

  /* — что делают участники: короткие события из кабинета и «я сейчас здесь» (для живого пульта владельца) — */
  const ACT_TYPES=new Set(['task','check','train','diag','mock','plan','skill','scan']), VIEWS=/^[a-z]{0,12}$/;
  const actClean=d=>{ const o={}; if(!d||typeof d!=='object') return o; for(const k of Object.keys(d).slice(0,6)){ if(!/^[a-z]{1,8}$/.test(k)) continue; const v=d[k];
    if(typeof v==='number'&&isFinite(v)) o[k]=Math.round(v*100)/100; else if(typeof v==='string') o[k]=v.replace(/[\u0000-\u001f]/g,'').slice(0,40); else if(typeof v==='boolean') o[k]=v; } return o; };
  async function logAct(userId,type,d,t){ t=t||now(); await store.put('activity',{id:t.toString(36)+C.token(4),userId,ts:t,type,d:d||{}}); }
  A['POST /api/act']=async(req,S)=>{ const b=body(req), t=now(), ev=Array.isArray(b.ev)?b.ev.slice(0,20):[];
    for(const e of ev){ if(!e||!ACT_TYPES.has(e.type)) continue; await logAct(S.user.id,e.type,actClean(e.d),Math.min(t,Math.max(t-DAY,+e.t||t))); }
    const v=VIEWS.test(String(b.view||''))?String(b.view||''):'', cur=S.user.live||{};
    if(!b.away&&(t-(cur.at||0)>30e3||cur.view!==v)) await store.update('users',S.user.id,{live:{at:t,view:v}});
    if(b.away) await store.update('users',S.user.id,{live:{at:0,view:v}});
    return H.json(200,{ok:true}); };

  /* — админ — */
  const D={};
  D['GET /api/admin/overview']=async()=>{ const [inv,us,fl,st,fb,lg]=await Promise.all([store.scan('invites'),store.scan('users'),flagsRaw(),settings(),store.scan('feedback'),store.scan('loginlog')]);
    const ids=await store.scan('identities'); const methods={}; ids.forEach(i=>{ (methods[i.userId]=methods[i.userId]||[]).push(i.type); });
    return H.json(200,{invites:inv.sort((a,b)=>b.createdAt-a.createdAt).map(i=>({h:i.id,label:i.label,role:i.role||'member',multi:!!i.multi,uses:i.uses||0,maxUses:i.maxUses||1,createdAt:i.createdAt,expiresAt:i.expiresAt,usedAt:i.usedAt||null,usedBy:i.usedBy||null,revokedAt:i.revokedAt||null})),
      users:us.sort((a,b)=>a.createdAt-b.createdAt).map(u=>({id:u.id,name:u.name,group:u.group||'',variant:u.variant||0,method:u.method,lastSeen:u.lastSeen||u.lastLogin||null,role:u.role,methods:methods[u.id]||[],createdAt:u.createdAt,lastLogin:u.lastLogin||null,blocked:!!u.blocked,reminders:!!(u.reminders&&u.reminders.enabled),photos:!!(u.consent&&u.consent.photos)})),
      flags:fl,modes:FEAT.MODES,features:FEAT.FEATURES,settings:st,
      feedback:fb.sort((a,b)=>b.ts-a.ts).slice(0,300).map(f=>({id:f.id,ts:f.ts,name:f.name,feature:f.feature,mood:f.mood,text:f.text,reply:f.reply||null,replyAt:f.replyAt||null})),
      logins:lg.sort((a,b)=>b.ts-a.ts).slice(0,200).map(x=>({ts:x.ts,user:x.h==='anon'?null:x.h,method:x.method,ok:x.ok,reason:x.reason,ip:x.ip}))}); };
  /* живой пульт: кто сейчас в кабинете и где, лента действий, итоги дня, часы активности, где спотыкаются */
  const mskDay=t=>new Date(t+3*3600e3).toISOString().slice(0,10);
  D['GET /api/admin/live']=async()=>{ const t=now(), [us,acts]=await Promise.all([store.scan('users'),store.scan('activity',x=>x.ts>t-7*DAY)]);
    const U={}; us.forEach(u=>{ U[u.id]=u; }); const td=mskDay(t), today=acts.filter(a=>mskDay(a.ts)===td), tasks=today.filter(a=>a.type==='task');
    const online=us.filter(u=>u.live&&u.live.at>t-120e3&&!u.blocked).sort((a,b)=>b.live.at-a.live.at).map(u=>({id:u.id,name:u.name,group:u.group||'',view:u.live.view||'',at:u.live.at}));
    const activeToday=new Set(today.map(a=>a.userId)); us.forEach(u=>{ if(u.lastSeen&&mskDay(u.lastSeen)===td) activeToday.add(u.id); });
    const hours=[...Array(24)].map((_,i)=>{ const from=t-(23-i)*3600e3-(t%3600e3), to=from+3600e3; return {h:new Date(from+3*3600e3).getUTCHours(),n:acts.filter(a=>a.ts>=from&&a.ts<to).length}; });
    const fails={}; acts.filter(a=>a.type==='task'&&a.d&&a.d.n).forEach(a=>{ const x=fails[a.d.n]||(fails[a.d.n]={n:a.d.n,total:0,bad:0,who:new Set()}); x.total++; if(a.d.v===0) x.bad++; x.who.add(a.userId); });
    const hard=Object.values(fails).filter(x=>x.bad).sort((a,b)=>b.bad-a.bad||b.total-a.total).slice(0,8).map(x=>({n:x.n,total:x.total,bad:x.bad,people:x.who.size}));
    const byG={}; today.forEach(a=>{ const g=(U[a.userId]&&U[a.userId].group)||'— без группы'; const x=byG[g]||(byG[g]={g,users:new Set(),acts:0}); x.users.add(a.userId); x.acts++; });
    const feed=acts.sort((a,b)=>b.ts-a.ts).slice(0,120).map(a=>({ts:a.ts,type:a.type,d:a.d||{},user:a.userId,name:(U[a.userId]&&U[a.userId].name)||'удалён',group:(U[a.userId]&&U[a.userId].group)||''}));
    return H.json(200,{now:t,online,feed,hours,hard,
      groups:Object.values(byG).map(x=>({g:x.g,users:x.users.size,acts:x.acts})).sort((a,b)=>b.users-a.users),
      kpi:{online:online.length,today:activeToday.size,tasks:tasks.length,solved:tasks.filter(a=>a.d&&a.d.v===2).length,checks:today.filter(a=>a.type==='check'||a.type==='scan').length,
        newToday:us.filter(u=>mskDay(u.createdAt)===td).length,total:us.length,week:new Set(acts.map(a=>a.userId)).size}}); };
  /* карточка участника: его действия и сводка прогресса (из синхронизированного localStorage) */
  D['GET /api/admin/user']=async(req)=>{ const id=String((req.query&&req.query.id)||''), u=await store.get('users',id); if(!u) fail(404,'Нет участника.');
    const [acts,p]=await Promise.all([store.scan('activity',x=>x.userId===id),store.get('progress',id)]), data=(p&&p.data)||{}, J=k=>{ try{ return JSON.parse(data[k]||'null'); }catch(e){ return null; } };
    const rep=J('nch2_rep')||{}, ev=J('nch2_club_ev')||[], done=J('nch2_club_done')||{}, tk=acts.filter(a=>a.type==='task');
    const due=SRS.queue(rep,CAL.toDay(mskDay(now()))).filter(x=>x.due).length, okEv=ev.filter(e=>e&&e.ok).length;
    return H.json(200,{user:{id:u.id,name:u.name,group:u.group||'',variant:u.variant||0,role:u.role,createdAt:u.createdAt,lastSeen:u.lastSeen||u.lastLogin||null,live:u.live&&u.live.at>now()-120e3?u.live:null},
      progress:{tasks:Object.keys(rep).length,due,skillObs:ev.length,skillOk:ev.length?Math.round(okEv/ev.length*100):null,done:Object.values(done).filter(x=>x&&x.v).length,syncedAt:p?p.updatedAt:null},
      stats:{tasks:tk.length,solved:tk.filter(a=>a.d&&a.d.v===2).length,hint:tk.filter(a=>a.d&&a.d.v===1).length,fail:tk.filter(a=>a.d&&a.d.v===0).length,checks:acts.filter(a=>a.type==='check'||a.type==='scan').length,days:new Set(acts.map(a=>mskDay(a.ts))).size},
      acts:acts.sort((a,b)=>b.ts-a.ts).slice(0,150).map(a=>({ts:a.ts,type:a.type,d:a.d||{}}))}); };
  D['POST /api/admin/invites']=async(req,S)=>{ const b=body(req), days=Math.max(1,Math.min(60,+b.days||14)), code=C.token(16), t=now(), h=C.sha256(code);
    const inv={id:h,label:cleanName(b.label)||'без подписи',role:b.role==='admin'?'admin':'member',createdAt:t,expiresAt:t+days*DAY,createdBy:S.user.id};
    /* публичная ссылка: одна на многих (друзья, группа) — до maxUses регистраций, роль всегда «участник» */
    if(b.multi===true){ inv.multi=true; inv.maxUses=Math.max(2,Math.min(500,+b.uses||50)); inv.uses=0; inv.role='member'; }
    await store.put('invites',inv); return H.json(200,{code,link:cfg.frontUrl+'#/invite/'+code,invite:{h,label:inv.label,expiresAt:inv.expiresAt,role:inv.role,multi:!!inv.multi,maxUses:inv.maxUses||1}}); };
  D['POST /api/admin/invites/revoke']=async(req)=>{ const b=body(req); if(!/^[0-9a-f]{64}$/.test(b.h||'')) fail(400,'Нет приглашения.');
    const cur=await store.get('invites',b.h); const r=cur&&(cur.multi?await store.update('invites',b.h,{revokedAt:now()}):await store.update('invites',b.h,{revokedAt:now()},{ifEq:{usedAt:null}}));
    if(!r) fail(409,'Приглашение уже использовано или не найдено.'); return H.json(200,{ok:true}); };
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
    if(u&&u.tgId){ const r=await o.bot.send(u.tgId,'Ответ Начерта на ваше обращение:\n\n'+text); tg=!!(r&&r.ok); }
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
    const ac=await store.scan('activity',x=>x.userId===id); for(const x of ac) await store.del('activity',x.id);
    await store.del('progress',id); await store.del('users',id); }

  /* ── бот: /start, /pause, /resume, /stop и кнопка «Пауза» ── */
  /* ответ на обновление возвращается действием {method, …} — Telegram выполнит его сам, из ответа на вебхук */
  async function onUpdate(u){ const msg=u.message, cb=u.callback_query, mcm=u.my_chat_member;
    const from=(msg&&msg.from)||(cb&&cb.from)||(mcm&&mcm.from); if(!from||!/^\d+$/.test(String(from.id))) return null;
    const ident=await store.get('identities','tg:'+from.id), user=ident?await store.get('users',ident.userId):null;
    const setR=async patch=>{ if(user) await store.update('users',user.id,{reminders:Object.assign({},user.reminders||{},patch)}); };
    if(mcm){ const st=mcm.new_chat_member&&mcm.new_chat_member.status; if(st==='kicked') await setR({canWrite:false}); if(st==='member') await setR({canWrite:true}); return null; }
    if(cb){ if(user&&cb.data==='pause'){ await setR({paused:true}); return {method:'answerCallbackQuery',callback_query_id:cb.id,text:'Напоминания на паузе. Вернуть — /resume или в личном кабинете.'}; }
      return {method:'answerCallbackQuery',callback_query_id:cb.id}; }
    const parts=String((msg&&msg.text)||'').trim().split(/\s+/), text=parts[0].replace(/@.*$/,'');
    if(text==='/start'&&/^l_/.test(parts[1]||'')) return linkTelegram(from,parts[1].slice(2));
    if((text==='/start'&&parts[1])||text==='/login'){ await setR({canWrite:true}); return botLoginLink(from,parts[1]); }
    if(!user) return text==='/start'?botLoginLink(from,null):null;
    if(text==='/start'){ await setR({canWrite:true}); return botLoginLink(from,null); }
    if(text==='/pause'){ await setR({paused:true}); return say(from.id,'Напоминания на паузе. Вернуть — /resume.'); }
    if(text==='/resume'){ await setR({paused:false,canWrite:true}); return say(from.id,'Напоминания снова включены.'); }
    if(text==='/stop'){ await setR({enabled:false}); return say(from.id,'Напоминания выключены. Включить снова — в личном кабинете, раздел «Профиль».'); }
    return null; }

  /* ── напоминания: запускается таймером каждые 15 минут ── */
  /* бот настраивается из облака: компьютер владельца может не видеть Telegram без VPN. Вебхук и команды — если ещё не те */
  async function ensureBot(){ if(!cfg.botToken||!cfg.webhookSecret||cfg.dev) return null;
    const url=cfg.origin+'/api/tg/webhook', info=await o.bot.api('getWebhookInfo',{}).catch(()=>null);
    if(info&&info.ok&&info.result&&info.result.url===url) return 'ok';
    const r=await o.bot.api('setWebhook',{url,secret_token:cfg.webhookSecret,allowed_updates:['message','callback_query','my_chat_member']}).catch(e=>({ok:false,description:e.message}));
    await o.bot.api('setMyCommands',{commands:[{command:'pause',description:'Поставить напоминания на паузу'},{command:'resume',description:'Снять с паузы'},{command:'login',description:'Войти в личный кабинет'},{command:'stop',description:'Выключить напоминания'}]}).catch(()=>{});
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
      const r=await o.bot.send(u.tgId,text,{reply_markup:{inline_keyboard:[[{text:'Открыть кабинет',url:cfg.frontUrl}],[{text:'Пауза',callback_data:'pause'}]]}});
      if(r&&r.ok) out.sent++; else if(r&&r.error_code===403) await store.update('users',u.id,{reminders:Object.assign({},u.reminders,{lastSent:d.date,canWrite:false})}); }
    await maintain(t); return out; }

  /* уборка: просроченные сессии, ссылки, лимиты, старый журнал входов */
  async function maintain(at){ const t=at||now();
    for(const [tb,f] of [['sessions',x=>x.expiresAt<t||x.lastSeen+IDLE_DAYS*DAY<t],['botlogin',x=>x.exp<t-DAY],['ratelimit',x=>x.exp<t],['remsent',x=>x.exp<t],['activity',x=>x.ts<t-ACT_DAYS*DAY]]){
      const old=await store.scan(tb,f); for(const x of old) await store.del(tb,x.id); }
    const logs=await store.scan('loginlog',x=>x.ts<t-LOG_DAYS*DAY); for(const x of logs) await store.del('loginlog',{h:x.h,r:x.r}); }

  /* ── маршрутизация ── */
  async function handle(req){ let res, cookie=null;
    try{
      const key=req.method+' '+req.path, isApi=req.path.startsWith('/api/');
      /* CORS: страница клуба на nachert1830.ru обращается к API на адресе функции; cookie не используются — токен в заголовке */
      if(isApi&&req.method==='OPTIONS'){ if(!cors(req)) fail(403,'Запрос с чужого сайта отклонён.');
        return finish({statusCode:204,headers:{'Access-Control-Allow-Methods':'GET, POST, PUT','Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Max-Age':'600'},body:''},null,req); }
      if(!isApi){ if(req.method!=='GET'&&req.method!=='HEAD') fail(405,'Метод не поддерживается.'); res=H.staticFile(req.path,req,cfg)||H.json(404,{error:'Не найдено.'}); return finish(res,null,req); }
      const mutating=!['GET','HEAD','OPTIONS'].includes(req.method);
      if(mutating&&key!=='POST /api/tg/webhook'&&!sameOrigin(req)) fail(403,'Запрос с чужого сайта отклонён.');
      let h=R[key], r;
      if(h) r=await h(req);
      else if(A[key]||D[key]){ const S=await session(req); if(!S) fail(401,'Нужно войти.',{login:true});
        if(mutating&&!S.bearer&&!C.safeEqual(req.headers['x-csrf-token']||'',S.s.csrf)) fail(403,'Сессия устарела: обновите страницу.',{csrf:true});
        await limit('api',S.user.id,300,300);
        if(D[key]&&S.user.role!=='admin') fail(403,'Только для админа.');
        r=await (A[key]||D[key])(req,S); }
      else fail(404,'Нет такого запроса.');
      if(r&&r.resp){ res=r.resp; cookie=r.cookie; } else res=r;
    }catch(e){ if(e instanceof HttpError){ res=H.json(e.status,Object.assign({error:e.message},e.extra||{}),e.status===429&&e.extra?{'Retry-After':String(e.extra.retry)}:{}); }
      else { log.error('ошибка',e&&e.stack||e); res=H.json(500,{error:'Что-то сломалось на сервере. Попробуйте позже.'}); } }
    return finish(res,cookie,req); }
  const cors=req=>{ const org=req.headers.origin; return org&&org!==cfg.origin&&cfg.fronts.includes(org)?org:null; };
  function finish(res,cookie,req){ res.headers=Object.assign(H.securityHeaders(cfg,false),res.headers||{});
    const org=req&&req.path.startsWith('/api/')&&cors(req);
    if(org){ Object.assign(res.headers,{'Access-Control-Allow-Origin':org,'Vary':'Origin','Access-Control-Expose-Headers':'Retry-After, Content-Disposition','Cross-Origin-Resource-Policy':'cross-origin'}); cookie=null; }
    if(cookie) res.multiValueHeaders={'Set-Cookie':[cookie]}; return res; }

  return {handle,remind,maintain,onUpdate,ensureBot,ownerLink,DOCS_VERSION,_loginId:loginId};
}
module.exports={createApp,maskIp,DOCS_VERSION};
