/* Развёртывание клуба в Yandex Cloud одной командой (подробно, для новичка — club/DEPLOY.md).
     node server/tools/deploy.js
   Нужно заранее: Node.js, программа yc (уже выполнен «yc init»), бот от @BotFather и свой Telegram id.
   Скрипт спрашивает токен бота и Telegram id владельца и сам создаёт: сервисные аккаунты и роли, базу YDB и таблицы,
   секрет в Lockbox (ключи не пишутся ни в файлы, ни на экран), две функции, шлюз с адресом https://….apigw.yandexcloud.net,
   таймер напоминаний и вебхук бота. Повторный запуск безопасен: что уже есть — не пересоздаётся, код обновляется.
   Ключи:  --domain=club.nachert1830.ru   — адрес клуба, когда свой домен подключён к шлюзу (шаг «Свой адрес» в DEPLOY.md)
           --token=… --owner=…            — не спрашивать токен бота и Telegram id
           --new-token                    — заменить токен бота в секрете (например, после /revoke в BotFather)
           --write-front                  — записать адрес API в club/config.js и CSP club/index.html (для страницы на nachert1830.ru)
   В GitHub Actions (.github/workflows/club.yml) скрипт ничего не спрашивает: всё берёт из секретов репозитория и того, что уже есть в облаке.
     YANDEX_CLIENT_ID / YANDEX_CLIENT_SECRET — приложение на oauth.yandex.ru (вход через Яндекс ID)
     OWNER_YANDEX_LOGIN — логин Яндекса владельца (станет админом при первом входе), OWNER_TG_ID — Telegram id владельца (необязательно)
     FRONT_URL — куда ведут ссылки входа (по умолчанию nachert1830.ru/club/, если страница там уже есть, иначе адрес функции) */
'use strict';
const {execFileSync}=require('child_process'), fs=require('fs'), os=require('os'), path=require('path'), crypto=require('crypto'), zlib=require('zlib'), readline=require('readline');
const {sign}=require('../lib/sigv4');
const ROOT=path.join(__dirname,'..','..');
const arg=k=>{ const a=process.argv.find(x=>x==='--'+k||x.startsWith('--'+k+'=')); return a?(a.includes('=')?a.slice(a.indexOf('=')+1):true):null; };
const YC=process.env.YC_BIN||'yc';
const NAMES={fn:'club-fn',gw:'club-gw',db:'club',secret:'club-secrets',api:'nachert-club-api',remind:'nachert-club-remind',gateway:'nachert-club',trigger:'club-remind'};
const TABLES=['users','identities','invites','sessions','botlogin','progress','feedback','config','ratelimit','remsent'];

const say=s=>console.log(s), step=s=>console.log('\n▶ '+s);
/* сеть до облака бывает нестабильной (VPN, Wi-Fi общежития): при сетевой ошибке — до 3 попыток с паузой */
const NET_RE=/DeadlineExceeded|deadline exceeded|connection refused|connection reset|no such host|i\/o timeout|Unavailable|handshake|EOF/i;
function yc(args,o){ o=o||{}; let last='';
  for(let attempt=1;attempt<=3;attempt++){
    try{ const out=execFileSync(YC,args.concat(o.json===false?[]:['--format','json']),{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024,timeout:180000});
      return o.json===false?out.trim():(out.trim()?JSON.parse(out):{}); }
    catch(e){ if(o.soft) return null; last=String(e.stderr||e.message).trim();
      if(!NET_RE.test(last)||attempt===3) break;
      say('  нет ответа от облака, пробую ещё раз ('+(attempt+1)+' из 3)…'); execFileSync(process.execPath,['-e','setTimeout(()=>{},8000)']); } }
  throw new Error('Команда yc '+args.filter(a=>!/^\[\{/.test(a)).join(' ')+' не выполнилась:\n'+last); }
/* «нет такого ресурса» → null; любая другая ошибка (сеть, права) — остановка с понятным текстом, а не попытка создать заново */
function get(args){ try{ return yc(args); }catch(e){ if(/not found|NotFound/i.test(e.message)) return null; throw e; } }
const NET=NET_RE;
function ask(q,hidden){ return new Promise(res=>{ const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  if(hidden){ rl._writeToOutput=s=>{ if(s.includes(q)) rl.output.write(s); else rl.output.write('*'); }; }
  rl.question(q,a=>{ rl.close(); if(hidden) process.stdout.write('\n'); res(a.trim()); }); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const CI=!!process.env.GITHUB_ACTIONS, E=k=>String(process.env[k]||'').trim();
/* в GitHub Actions спрашивать некого: нет значения — понятная ошибка со списком, что добавить в секреты */
const need=(what,how)=>{ throw new Error(what+' не задан. '+how); };
const SITE_FRONT='https://nachert1830.ru/club/', SITE_ORIGIN='https://nachert1830.ru';
/* https у сайта на GitHub Pages бывает без сертификата для своего домена — тогда ссылки входа ведут на http:// */
async function siteProbe(){ try{ const r=await fetch(SITE_FRONT+'config.js',{cache:'no-store',signal:AbortSignal.timeout(10000)}); const t=await r.text(); return {ok:r.ok&&/CLUB_API/.test(t),text:r.ok?'страница на сайте отвечает по https':'страница на сайте: HTTP '+r.status}; }
  catch(e){ return {ok:false,text:'https у сайта не работает: '+String(e&&e.cause&&e.cause.code||e&&e.message||e)}; } }
/* переменные текущей версии функции: что владелец задал при прошлом развёртывании (Telegram id владельца, имя бота, Яндекс ID) */
function currentEnv(){ const v=get(['serverless','function','version','get-by-tag','--function-name',NAMES.api,'--tag','$latest']); return (v&&v.environment)||{}; }

/* zip без зависимостей: deflate из zlib + CRC-32 */
const CRC=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; } return t; })();
const crc32=b=>{ let c=0xFFFFFFFF; for(const x of b) c=CRC[(c^x)&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
function zip(files){ const parts=[], cdir=[]; let off=0;
  for(const [name,data] of files){ const nm=Buffer.from(name,'utf8'), z=zlib.deflateRawSync(data), crc=crc32(data);
    const h=Buffer.alloc(30); h.writeUInt32LE(0x04034b50,0); h.writeUInt16LE(20,4); h.writeUInt16LE(0x0800,6); h.writeUInt16LE(8,8); h.writeUInt32LE(0,10);
    h.writeUInt32LE(crc,14); h.writeUInt32LE(z.length,18); h.writeUInt32LE(data.length,22); h.writeUInt16LE(nm.length,26); h.writeUInt16LE(0,28);
    parts.push(h,nm,z);
    const c=Buffer.alloc(46); c.writeUInt32LE(0x02014b50,0); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt16LE(0x0800,8); c.writeUInt16LE(8,10); c.writeUInt32LE(0,12);
    c.writeUInt32LE(crc,16); c.writeUInt32LE(z.length,20); c.writeUInt32LE(data.length,24); c.writeUInt16LE(nm.length,28); c.writeUInt32LE(off,42);
    cdir.push(c,nm); off+=30+nm.length+z.length; }
  const cd=Buffer.concat(cdir), e=Buffer.alloc(22); e.writeUInt32LE(0x06054b50,0); e.writeUInt16LE(files.length,8); e.writeUInt16LE(files.length,10); e.writeUInt32LE(cd.length,12); e.writeUInt32LE(off,16);
  return Buffer.concat(parts.concat([cd,e])); }
/* пакет функции: server/ и club/ без тестов, инструментов, документации и локальной базы */
function packageFiles(){ const out=[];
  const walk=(dir,rel)=>{ for(const f of fs.readdirSync(dir).sort()){ const p=path.join(dir,f), r=rel?rel+'/'+f:f;
    if(/^(\.data|\.deploy|test|tests|tools|node_modules)$/.test(f)||/\.md$/.test(f)||f.startsWith('.')) continue;
    if(fs.statSync(p).isDirectory()) walk(p,r); else out.push([r,fs.readFileSync(p)]); } };
  walk(path.join(ROOT,'server'),'server'); walk(path.join(ROOT,'club'),'club'); return out; }

/* YDB Document API — создание таблиц */
async function docapi(endpoint,cred,op,body){ const b=JSON.stringify(body);
  const req={method:'POST',url:endpoint,headers:{'content-type':'application/x-amz-json-1.0','x-amz-target':'DynamoDB_20120810.'+op},body:b};
  const s=sign(req,Object.assign({region:'ru-central1',service:'dynamodb'},cred)); const r=await fetch(endpoint,{method:'POST',headers:s.headers,body:b});
  const t=await r.text(); if(!r.ok) throw new Error('YDB '+op+': '+r.status+' '+t.slice(0,300)); return t?JSON.parse(t):{}; }
async function telegram(token,method,body){ const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});
  const j=await r.json().catch(()=>({})); if(!j.ok) throw new Error('Telegram '+method+': '+(j.description||r.status)); return j.result; }

/* одноразовая ссылка входа владельца: функция выдаёт её только при прямом вызове из yc (нужны права в облаке) */
function ownerLink(fnId){ try{ const out=yc(['serverless','function','invoke',fnId?'--id':'--name',fnId||NAMES.api,'--data',JSON.stringify({club:'owner-login'})],{json:false});
  const m=out.match(/https:\/\/[^\s"]+\/#\/tg\/[A-Za-z0-9_-]{30,40}/); return m?m[0]:null; }catch(e){ return null; } }
/* страница на nachert1830.ru (GitHub Pages) не знает адрес функции: пишем его в club/config.js и в connect-src CSP club/index.html */
function writeFront(origin){ const cf=path.join(ROOT,'club','config.js'), ix=path.join(ROOT,'club','index.html');
  const c=fs.readFileSync(cf,'utf8').replace(/window\.CLUB_API='[^']*'/,"window.CLUB_API='"+origin+"'");
  const h=fs.readFileSync(ix,'utf8').replace(/connect-src 'self'[^;]*;/,"connect-src 'self' "+origin+";");
  fs.writeFileSync(cf,c); fs.writeFileSync(ix,h); say('  адрес API для страницы на сайте: '+origin); }
/* Yandex Postbox (API как у Amazon SES v2): запросы подписываются SigV4 статическим ключом */
const MAIL_DOMAIN='nachert1830.ru', DKIM_SEL='club';
async function pbCall(cred,method,pathq,body){ const url='https://postbox.cloud.yandex.net'+pathq, b=body?JSON.stringify(body):'';
  const s=sign({method,url,headers:body?{'content-type':'application/json'}:{},body:b},Object.assign({region:'ru-central1',service:'ses'},cred));
  const r=await fetch(url,{method,headers:s.headers,body:body?b:undefined,signal:AbortSignal.timeout(20000)}); const t=await r.text(); let j={}; try{ j=JSON.parse(t); }catch(e){}
  return {status:r.status,ok:r.ok,j,t}; }
/* домен для писем: при первом запуске — создать в Postbox с ключом DKIM (ключ генерируется здесь, закрытая часть уходит
   только в Postbox), открытая часть — в сейф, чтобы печатать DNS-запись, пока домен не подтверждён. Подтверждён — вход по почте включается */
async function txtHas(name,needle){ try{ const r=await require('dns').promises.resolveTxt(name); return r.some(x=>x.join('').includes(needle)); }catch(e){ return false; } }
function newDkim(sel){ const kp=crypto.generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'der'},privateKeyEncoding:{type:'pkcs8',format:'der'}});
  return {sel,priv:kp.privateKey.toString('base64'),pub:kp.publicKey.toString('base64')}; }
/* домен для писем в Postbox с ключом DKIM. Ключ создаётся здесь и хранится в сейфе Lockbox (закрытая часть никуда не выводится):
   если Postbox проверил DNS раньше, чем запись появилась (статус FAILED), — когда запись видна, проверка запускается заново
   тем же ключом. Подтверждён — вход по почте включается. */
async function postboxSetup(payload){ let k=null, from='';
  const say2=(sel,pub)=>{ say('    имя (поддомен): '+sel+'._domainkey'); say('    тип: TXT'); say('    значение: v=DKIM1; k=rsa; p='+pub); };
  try{ k=yc(['iam','access-key','create','--service-account-id',E('YC_SA_ID'),'--description','club deploy: Postbox (временный, удаляется сразу)']);
    const cred={accessKeyId:k.access_key.key_id,secretAccessKey:k.secret};
    let g=null; for(let i=0;i<8;i++){ g=await pbCall(cred,'GET','/v2/email/identities/'+MAIL_DOMAIN); if(g.status!==403&&g.status!==401) break; await sleep(4000); }
    const keep=d=>{ payload.POSTBOX_DKIM_SELECTOR=d.sel; payload.POSTBOX_DKIM_PRIVATE=d.priv; payload.POSTBOX_DKIM_PUBLIC=d.pub; };
    if(g.status===404){ const d=newDkim('nachert');
      const c=await pbCall(cred,'POST','/v2/email/identities',{EmailIdentity:MAIL_DOMAIN,DkimSigningAttributes:{DomainSigningSelector:d.sel,DomainSigningPrivateKey:d.priv}});
      if(!c.ok) throw new Error('создать домен не получилось: '+c.status+' '+c.t.slice(0,300));
      keep(d); say('  домен '+MAIL_DOMAIN+' добавлен в Postbox'); g=await pbCall(cred,'GET','/v2/email/identities/'+MAIL_DOMAIN); }
    if(!g.ok) throw new Error('Postbox ответил '+g.status+' '+g.t.slice(0,300));
    let dk=(g.j.DkimAttributes&&g.j.DkimAttributes.Status)||'?';
    if(g.j.VerifiedForSendingStatus===true){ from='noreply@'+MAIL_DOMAIN; say('  домен подтверждён — вход по почте включён (отправитель '+from+')'); return from; }
    const sel=payload.POSTBOX_DKIM_SELECTOR||DKIM_SEL, seen=await txtHas(sel+'._domainkey.'+MAIL_DOMAIN,payload.POSTBOX_DKIM_PUBLIC.slice(-40));
    /* перепроверка DKIM в Postbox — тот же запрос без ключа (так велит сам Postbox) */
    if(dk==='FAILED'&&seen){ const r=await pbCall(cred,'PUT','/v2/email/identities/'+MAIL_DOMAIN+'/dkim/signing',{SigningAttributesOrigin:'EXTERNAL'}); say(r.ok?'  запись в DNS видна — проверка домена в Postbox запущена заново, подтверждение обычно за минуты':'  перезапуск проверки не удался: '+r.status+' '+r.t.slice(0,200)); }
    else say('  домен ждёт подтверждения (DKIM: '+dk+(seen?', запись в DNS видна':', записи в DNS пока не видно')+'). TXT-запись у регистратора:');
    if(!seen) say2(sel,payload.POSTBOX_DKIM_PUBLIC); }
  catch(e){ say('  Postbox: '+e.message); }
  finally{ if(k) try{ yc(['iam','access-key','delete','--id',k.access_key.id],{json:false}); }catch(e){ say('  временный ключ не удалился: '+e.message.split('\n')[0]); } }
  return from; }

async function main(){
  say('Развёртывание клуба Начерта в Yandex Cloud.\nВсё создаётся в каталоге, выбранном в «yc init». Повторный запуск безопасен.');
  step('Проверяю программу yc');
  const folder=yc(['config','get','folder-id'],{json:false});
  if(!/^[a-z0-9]{20}$/.test(folder)) throw new Error('Не выбран каталог. Выполните «yc init» и выберите облако и каталог.');
  say('  каталог: '+folder);
  try{ yc(['resource-manager','folder','get',folder]); }
  catch(e){ if(NET.test(e.message)) throw new Error('Программа yc не может связаться с Yandex Cloud (нет ответа от серверов облака).\n'+
      'Обычно мешает VPN или прокси: выключите VPN, закройте программы-обходчики блокировок и запустите скрипт снова.\n'+
      'Если не помогло — антивирус с «проверкой HTTPS» (Kaspersky, ESET) или сеть общежития/вуза: попробуйте раздать интернет с телефона.\n'+
      'Проверка связи: команда  yc resource-manager folder list  должна вывести таблицу с вашим каталогом.\n\nТекст ошибки yc:\n'+e.message.split('\n').slice(1).filter(l=>!/x-(request|client-trace)-id|trace file|cloud support/i.test(l)).join('\n').trim());
    throw e; }

  /* токен бота и Telegram id владельца */
  let token=arg('token'), owner=arg('owner');
  const sec=get(['lockbox','secret','get','--name',NAMES.secret]);
  let payload={};
  /* аккаунту развёртывания из GitHub (роль admin) читать содержимое секрета разрешает отдельная роль — выдаём её сами и повторяем */
  const readPayload=id=>{ try{ return get(['lockbox','payload','get','--id',id]); }
    catch(e){ if(!/PermissionDenied|permission/i.test(e.message)||!E('YC_SA_ID')) throw e;
      say('  выдаю аккаунту развёртывания право читать секрет (lockbox.payloadViewer)…');
      try{ yc(['resource-manager','folder','add-access-binding',folder,'--role','lockbox.payloadViewer','--subject','serviceAccount:'+E('YC_SA_ID')]); }catch(x){ if(!/already/i.test(x.message)) throw x; }
      for(let i=0;i<12;i++){ execFileSync(process.execPath,['-e','setTimeout(()=>{},10000)']); try{ return get(['lockbox','payload','get','--id',id]); }catch(x){ if(i===11) throw x; } } } };
  if(sec&&sec.id){ const p=readPayload(sec.id); (p&&p.entries||[]).forEach(e=>{ payload[e.key]=e.text_value; }); }
  const prev=currentEnv();
  if(!token&&E('TG_BOT_TOKEN')) token=E('TG_BOT_TOKEN');   /* новый токен из секрета GitHub заменяет старый в сейфе */
  if(!token&&(!payload.TG_BOT_TOKEN||arg('new-token'))) token=CI?need('Токен бота','Добавьте секрет TG_BOT_TOKEN в GitHub (Settings → Secrets and variables → Actions).'):await ask('Токен бота от @BotFather (вида 123456:ABC…): ',true);
  token=token||payload.TG_BOT_TOKEN;
  if(!/^\d{5,12}:[A-Za-z0-9_-]{30,}$/.test(token||'')) throw new Error('Это не похоже на токен бота. Он выглядит так: 1234567890:AAH…');
  step('Проверяю бота');
  /* Telegram с этого компьютера может не открываться (без VPN), а облако — не открываться с VPN. Компьютеру Telegram не обязателен:
     вебхук и команды бота настроит сам клуб из облака (server/lib/app.js → ensureBot) */
  let me=null; try{ me=await telegram(token,'getMe'); say('  бот: @'+me.username); }
  catch(e){ if(/Unauthorized|Not Found/i.test(e.message)) throw new Error('Telegram не принял токен — проверьте, что скопировали его целиком из @BotFather.');
    say('  Telegram с этого компьютера не открывается — это нормально, бота настроит сам клуб из облака.');
    /* принимаем «@имя», «t.me/имя», «https://t.me/имя»; при ошибке спрашиваем ещё раз */
    const clean=x=>String(x||'').trim().replace(/^(https?:\/\/)?(t\.me|telegram\.me)\//i,'').replace(/^@/,'').replace(/[\s\/]+$/,'');
    const okName=x=>/^[A-Za-z][A-Za-z0-9_]{3,30}bot$/i.test(x);
    let u=clean(arg('bot')||prev.TG_BOT_NAME);
    for(let i=0;!okName(u)&&i<3;i++){ if(u||i) say('  «'+u+'» — не похоже на username бота. Он латиницей и кончается на «bot»; точный — в @BotFather → /mybots.');
      if(CI) break; u=clean(await ask('Username бота (как в @BotFather → /mybots, например nachert_club_bot): ')); }
    if(!okName(u)) throw new Error('Не получилось прочитать username бота. Запустите так:  node server/tools/deploy.js --bot=имя_бота');
    me={username:u}; }
  owner=owner||E('OWNER_TG_ID')||E('CLUB_OWNER_TG')||prev.ADMIN_TG_IDS||'';
  const yaOwner=(E('OWNER_YANDEX_LOGIN')||prev.ADMIN_YA_LOGINS||'').toLowerCase().replace(/@yandex\.ru$|@ya\.ru$/,'');
  if(!owner&&!yaOwner){ if(CI) need('Владелец клуба','Добавьте секрет OWNER_YANDEX_LOGIN (логин Яндекса владельца) в GitHub.'); owner=await ask('Ваш Telegram id (число; узнать — написать боту @userinfobot): '); }
  if(owner&&!/^\d{3,16}(,\d{3,16})*$/.test(owner)) throw new Error('Telegram id — это число, например 123456789.');
  if(yaOwner&&!/^[a-z0-9][a-z0-9.-]{0,40}(,[a-z0-9][a-z0-9.-]{0,40})*$/.test(yaOwner)) throw new Error('OWNER_YANDEX_LOGIN — логин Яндекса латиницей (то, что до @yandex.ru).');
  const yaId=E('YANDEX_CLIENT_ID')||prev.YANDEX_CLIENT_ID||'';
  if(yaId&&!/^[0-9a-f]{32}$/.test(yaId)) throw new Error('YANDEX_CLIENT_ID — это ClientID приложения на oauth.yandex.ru: 32 символа 0–9 и a–f.');

  step('Сервисные аккаунты и права');
  const sa={}; for(const k of ['fn','gw']){ sa[k]=get(['iam','service-account','get','--name',NAMES[k]])||yc(['iam','service-account','create','--name',NAMES[k]]); say('  '+NAMES[k]+': '+sa[k].id); }
  for(const [k,role] of [['fn','ydb.editor'],['fn','lockbox.payloadViewer'],['fn','postbox.sender'],['gw','functions.functionInvoker']])
    try{ yc(['resource-manager','folder','add-access-binding',folder,'--role',role,'--subject','serviceAccount:'+sa[k].id]); }catch(e){ if(!/already/i.test(e.message)) throw e; }

  step('База данных YDB (serverless, Россия)');
  let db=get(['ydb','database','get','--name',NAMES.db]);
  if(!db){ say('  создаю базу — это займёт пару минут'); db=yc(['ydb','database','create','--name',NAMES.db,'--serverless']); }
  for(let i=0;i<60&&db.status!=='RUNNING';i++){ await sleep(5000); db=yc(['ydb','database','get','--name',NAMES.db]); }
  if(db.status!=='RUNNING') throw new Error('База не запустилась: статус '+db.status);
  const endpoint=db.document_api_endpoint; say('  готово');

  step('Почта (Yandex Postbox)');
  const payloadBefore=JSON.stringify(payload);
  let mailFrom=E('MAIL_FROM')||'';
  if(CI&&E('YC_SA_ID')&&!mailFrom) mailFrom=await postboxSetup(payload);
  if(!mailFrom&&!CI) mailFrom=prev.MAIL_FROM||'';
  if(!mailFrom) say('  вход по почте пока выключен');

  step('Секреты в Lockbox');
  if(!payload.YDB_KEY_ID){ const k=yc(['iam','access-key','create','--service-account-id',sa.fn.id,'--description','club: YDB Document API']); payload.YDB_KEY_ID=k.access_key.key_id; payload.YDB_SECRET=k.secret; }
  payload.TG_WEBHOOK_SECRET=payload.TG_WEBHOOK_SECRET||crypto.randomBytes(32).toString('hex');
  const before=JSON.stringify(payload); payload.TG_BOT_TOKEN=token;
  if(E('YANDEX_CLIENT_SECRET')) payload.YANDEX_CLIENT_SECRET=E('YANDEX_CLIENT_SECRET');
  if(yaId&&!payload.YANDEX_CLIENT_SECRET) need('YANDEX_CLIENT_SECRET','Добавьте секрет YANDEX_CLIENT_SECRET (Client secret приложения на oauth.yandex.ru) в GitHub.');
  const changed=JSON.stringify(payload)!==before||JSON.stringify(payload)!==payloadBefore;
  const entries=JSON.stringify(Object.keys(payload).sort().map(k=>({key:k,text_value:payload[k]})));
  let secretId=sec&&sec.id;
  if(!secretId) secretId=yc(['lockbox','secret','create','--name',NAMES.secret,'--description','Клуб Начерта','--payload',entries]).id;
  else if(changed||!sec.current_version) yc(['lockbox','secret','add-version','--id',secretId,'--payload',entries]);
  say('  секрет '+NAMES.secret+': '+secretId+' (значения не показываются)');

  step('Таблицы');
  const cred={accessKeyId:payload.YDB_KEY_ID,secretAccessKey:payload.YDB_SECRET};
  let have=[]; for(let i=0;i<12;i++){ try{ have=(await docapi(endpoint,cred,'ListTables',{})).TableNames||[]; break; }catch(e){ if(i===11) throw e; await sleep(5000); } }   /* новый ключ начинает работать не сразу */
  for(const t of TABLES.concat(['loginlog'])){ const name='club_'+t; if(have.includes(name)) continue;
    const comp=t==='loginlog';
    await docapi(endpoint,cred,'CreateTable',{TableName:name,AttributeDefinitions:comp?[{AttributeName:'h',AttributeType:'S'},{AttributeName:'r',AttributeType:'S'}]:[{AttributeName:'id',AttributeType:'S'}],
      KeySchema:comp?[{AttributeName:'h',KeyType:'HASH'},{AttributeName:'r',KeyType:'RANGE'}]:[{AttributeName:'id',KeyType:'HASH'}]});
    say('  создана '+name); }
  say('  таблиц: '+(TABLES.length+1));

  step('Функции');
  const fn={}; for(const k of ['api','remind']) fn[k]=get(['serverless','function','get','--name',NAMES[k]])||yc(['serverless','function','create','--name',NAMES[k]]);

  step('Шлюз (адрес клуба)');
  const spec=fs.readFileSync(path.join(ROOT,'server','apigw.yaml'),'utf8').replace(/\$\{FUNCTION_ID\}/g,fn.api.id).replace(/\$\{SA_ID\}/g,sa.gw.id);
  const specFile=path.join(os.tmpdir(),'club-apigw.yaml'); fs.writeFileSync(specFile,spec);
  let gw=get(['serverless','api-gateway','get','--name',NAMES.gateway]);
  gw=gw?yc(['serverless','api-gateway','update','--name',NAMES.gateway,'--spec',specFile]):yc(['serverless','api-gateway','create','--name',NAMES.gateway,'--spec',specFile]);
  const domain=arg('domain')||gw.domain; const origin='https://'+domain; say('  '+origin);

  step('Код функций');
  const files=packageFiles(), z=zip(files), zf=path.join(os.tmpdir(),'club-'+Date.now()+'.zip'); fs.writeFileSync(zf,z);
  say('  пакет: '+files.length+' файлов, '+Math.round(z.length/1024)+' КБ');
  /* куда ведут ссылки входа: страница на nachert1830.ru, если она уже опубликована, иначе — адрес функции */
  /* страница клуба опубликована вместе с сайтом (папка club/ в main) — ссылки входа и приглашений ведут туда */
  const probe=await siteProbe(), front=E('FRONT_URL')||(probe.ok?SITE_FRONT:SITE_FRONT.replace('https://','http://'));
  say('  страница клуба: '+front+' ('+probe.text+')');
  if(!probe.ok) say('::warning::У nachert1830.ru не работает HTTPS (нет сертификата для домена). GitHub → Settings → Pages → Custom domain → Enforce HTTPS (DEPLOY.md). Пока ссылки ведут на http://');
  const envs={ORIGIN:origin,TG_BOT_NAME:me.username,ADMIN_TG_IDS:owner,ADMIN_YA_LOGINS:yaOwner,YANDEX_CLIENT_ID:yaId,FRONT_ORIGINS:SITE_ORIGIN+' http://nachert1830.ru',FRONT_URL:front,
    YDB_DOCAPI_ENDPOINT:endpoint,MAIN_URL:'https://nachert1830.ru',
    /* вход по почте: адрес отправителя на домене, подтверждённом в Postbox (DEPLOY.md, «Вход по почте») */
    MAIL_FROM:mailFrom};
  const env=Object.keys(envs).filter(k=>envs[k]).map(k=>k+'='+envs[k]).join(',');
  const secrets=[]; ['TG_BOT_TOKEN','TG_WEBHOOK_SECRET','YDB_KEY_ID','YDB_SECRET','YANDEX_CLIENT_SECRET'].filter(k=>payload[k]).forEach(k=>secrets.push('--secret','environment-variable='+k+',id='+secretId+',key='+k));
  for(const [k,entry,timeout] of [['api','server/index.handler','10s'],['remind','server/index.remind','120s']]){
    yc(['serverless','function','version','create','--function-id',fn[k].id,'--runtime','nodejs22','--entrypoint',entry,'--memory','256m','--execution-timeout',timeout,
      '--service-account-id',sa.fn.id,'--source-path',zf,'--environment',env].concat(secrets)); say('  '+NAMES[k]+': новая версия'); }
  /* сразу запустить функцию напоминаний: она подключает вебхук бота из облака, если с компьютера не получилось */
  try{ yc(['serverless','function','invoke','--id',fn.remind.id],{json:false}); }catch(e){}
  fs.unlinkSync(zf);

  step('Таймер напоминаний (каждые 15 минут)');
  if(!get(['serverless','trigger','get','--name',NAMES.trigger]))
    yc(['serverless','trigger','create','timer','--name',NAMES.trigger,'--cron-expression','0/15 * ? * * *','--invoke-function-id',fn.remind.id,'--invoke-function-service-account-id',sa.gw.id]);
  say('  готово');

  step('Бот: вебхук и команды');
  /* что Telegram видел до этого: куда шлёт, сколько ждёт доставки, последняя ошибка доставки (без токена и секрета) */
  const hook=origin+'/api/tg/webhook';
  try{ const w=await telegram(token,'getWebhookInfo',{}); const ago=w.last_error_date?Math.round((Date.now()/1000-w.last_error_date)/60)+' мин назад':'';
    say('  до настройки: вебхук '+(w.url===hook?'на клуб':w.url?'на другой адрес':'не задан')+', ждут доставки: '+(w.pending_update_count||0)+
      ', последняя ошибка: '+(w.last_error_message?w.last_error_message+' ('+ago+')':'нет')); }catch(e){}
  try{ await telegram(token,'setWebhook',{url:origin+'/api/tg/webhook',secret_token:payload.TG_WEBHOOK_SECRET,allowed_updates:['message','callback_query','my_chat_member'],drop_pending_updates:true});
  /* серверы Telegram не достают до Yandex Cloud — бот не отвечает. Описание бота показывает сам Telegram, без нашего сервера:
     пусть человек сразу видит, что писать сюда не нужно, а вход — на сайте (официальный вход Telegram) */
  await telegram(token,'deleteMyCommands',{});
  await telegram(token,'setMyDescription',{description:'Это бот клуба Начерта. Писать ему не нужно — он не отвечает.\n\nВход в клуб — на странице клуба кнопкой «Войти через Telegram»: подтверждение придёт от официального аккаунта Telegram.'});
  await telegram(token,'setMyShortDescription',{short_description:'Писать сюда не нужно. Вход в клуб — на сайте, кнопкой «Войти через Telegram».'});
  say('  готово'); }
  catch(e){ say('  с этого компьютера не получилось — клуб сделает это сам в течение 15 минут'); }
  /* самопроверка: «Старт» от несуществующего участника так, как его шлёт Telegram (с секретом) — клуб должен ответить отказом */
  try{ const r=await fetch(hook,{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':payload.TG_WEBHOOK_SECRET},
      body:JSON.stringify({update_id:1,message:{message_id:1,date:Math.floor(Date.now()/1000),from:{id:1,is_bot:false,first_name:'Проверка'},chat:{id:1,type:'private'},text:'/start'}})});
    const j=await r.json().catch(()=>({})); say('  самопроверка вебхука: HTTP '+r.status+(j.method?', ответ бота: '+j.method+' «'+String(j.text||'').slice(0,40)+'…»':', ответа бота нет'));
    const bad=await fetch(hook,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}); say('  без секрета: HTTP '+bad.status+(bad.status===403?' (правильно — отказ)':' (ОШИБКА: должен быть отказ)')); }
  catch(e){ say('  самопроверка вебхука не удалась: '+e.message); }

  step('Проверяю, что клуб отвечает');
  let ok=false; for(let i=0;i<10&&!ok;i++){ try{ const r=await fetch(origin+'/api/config'); ok=r.ok; }catch(e){} if(!ok) await sleep(3000); }
  say(ok?'  клуб работает':'  пока не отвечает — подождите минуту и откройте адрес ниже');

  if(arg('write-front')) writeFront(origin);
  say('\n════════════════════════════════════════════');
  say('Готово. Клуб: '+front+(front!==origin+'/'?'  (API: '+origin+')':''));
  if(yaId) say('Яндекс ID: в приложении на oauth.yandex.ru должен быть Redirect URI  '+origin+'/api/auth/yandex/callback');
  if(CI){ say('Войти: откройте клуб → «Войти с Яндекс ID»'+(yaOwner?' (владелец — логин '+yaOwner.split(',')[0].replace(/^(.{2}).*$/,'$1…')+')':'')+' или по почте (когда домен подтверждён).'); say('════════════════════════════════════════════'); return; }
  const link=ownerLink(fn.api.id);
  say(link?'\nВаша ссылка для входа (владелец, админ). Действует 30 минут и срабатывает один раз — никому не пересылайте:\n\n  '+link+'\n':
    '\nСсылку для входа выдаст команда:  node server/tools/login.js');
  say('Новая ссылка в любой момент:  node server/tools/login.js');
  say('════════════════════════════════════════════');
}
if(require.main===module) main().catch(e=>{ console.error('\n✖ '+e.message+'\n\nЕсли непонятно, что делать, — пришлите этот текст Claude.'); process.exit(1); });
module.exports={zip,crc32,packageFiles,ownerLink};
