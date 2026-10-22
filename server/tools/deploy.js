/* Развёртывание клуба в Yandex Cloud одной командой (подробно, для новичка — club/DEPLOY.md).
     node server/tools/deploy.js
   Нужно заранее: Node.js, программа yc (уже выполнен «yc init»), бот от @BotFather и свой Telegram id.
   Скрипт спрашивает токен бота и Telegram id владельца и сам создаёт: сервисные аккаунты и роли, базу YDB и таблицы,
   секрет в Lockbox (ключи не пишутся ни в файлы, ни на экран), две функции, шлюз с адресом https://….apigw.yandexcloud.net,
   таймер напоминаний и вебхук бота. Повторный запуск безопасен: что уже есть — не пересоздаётся, код обновляется.
   Ключи:  --domain=club.nachert1830.ru   — адрес клуба, когда свой домен подключён к шлюзу (шаг «Свой адрес» в DEPLOY.md)
           --token=… --owner=…            — не спрашивать токен бота и Telegram id
           --new-token                    — заменить токен бота в секрете (например, после /revoke в BotFather) */
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
  if(sec&&sec.id){ const p=get(['lockbox','payload','get','--id',sec.id]); (p&&p.entries||[]).forEach(e=>{ payload[e.key]=e.text_value; }); }
  if(!token&&(!payload.TG_BOT_TOKEN||arg('new-token'))) token=await ask('Токен бота от @BotFather (вида 123456:ABC…): ',true);
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
    let u=clean(arg('bot'));
    for(let i=0;!okName(u)&&i<3;i++){ if(u||i) say('  «'+u+'» — не похоже на username бота. Он латиницей и кончается на «bot»; точный — в @BotFather → /mybots.');
      u=clean(await ask('Username бота (как в @BotFather → /mybots, например nachert_club_bot): ')); }
    if(!okName(u)) throw new Error('Не получилось прочитать username бота. Запустите так:  node server/tools/deploy.js --bot=имя_бота');
    me={username:u}; }
  if(!owner){ owner=process.env.CLUB_OWNER_TG||await ask('Ваш Telegram id (число; узнать — написать боту @userinfobot): '); }
  if(!/^\d{3,16}$/.test(owner)) throw new Error('Telegram id — это число, например 123456789.');

  step('Сервисные аккаунты и права');
  const sa={}; for(const k of ['fn','gw']){ sa[k]=get(['iam','service-account','get','--name',NAMES[k]])||yc(['iam','service-account','create','--name',NAMES[k]]); say('  '+NAMES[k]+': '+sa[k].id); }
  for(const [k,role] of [['fn','ydb.editor'],['fn','lockbox.payloadViewer'],['gw','functions.functionInvoker']])
    try{ yc(['resource-manager','folder','add-access-binding',folder,'--role',role,'--subject','serviceAccount:'+sa[k].id]); }catch(e){ if(!/already/i.test(e.message)) throw e; }

  step('База данных YDB (serverless, Россия)');
  let db=get(['ydb','database','get','--name',NAMES.db]);
  if(!db){ say('  создаю базу — это займёт пару минут'); db=yc(['ydb','database','create','--name',NAMES.db,'--serverless']); }
  for(let i=0;i<60&&db.status!=='RUNNING';i++){ await sleep(5000); db=yc(['ydb','database','get','--name',NAMES.db]); }
  if(db.status!=='RUNNING') throw new Error('База не запустилась: статус '+db.status);
  const endpoint=db.document_api_endpoint; say('  готово');

  step('Секреты в Lockbox');
  if(!payload.YDB_KEY_ID){ const k=yc(['iam','access-key','create','--service-account-id',sa.fn.id,'--description','club: YDB Document API']); payload.YDB_KEY_ID=k.access_key.key_id; payload.YDB_SECRET=k.secret; }
  payload.TG_WEBHOOK_SECRET=payload.TG_WEBHOOK_SECRET||crypto.randomBytes(32).toString('hex');
  const changed=payload.TG_BOT_TOKEN!==token; payload.TG_BOT_TOKEN=token;
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
  const env=['ORIGIN='+origin,'TG_BOT_NAME='+me.username,'ADMIN_TG_IDS='+owner,'YDB_DOCAPI_ENDPOINT='+endpoint,'MAIN_URL=https://nachert1830.ru'].join(',');
  const secrets=[]; ['TG_BOT_TOKEN','TG_WEBHOOK_SECRET','YDB_KEY_ID','YDB_SECRET'].forEach(k=>secrets.push('--secret','environment-variable='+k+',id='+secretId+',key='+k));
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
  try{ await telegram(token,'setWebhook',{url:origin+'/api/tg/webhook',secret_token:payload.TG_WEBHOOK_SECRET,allowed_updates:['message','callback_query','my_chat_member'],drop_pending_updates:true});
  await telegram(token,'setMyCommands',{commands:[{command:'pause',description:'Поставить напоминания на паузу'},{command:'resume',description:'Снять с паузы'},{command:'stop',description:'Выключить напоминания'}]});
  say('  готово'); }
  catch(e){ say('  с этого компьютера не получилось — клуб сделает это сам в течение 15 минут'); }

  step('Проверяю, что клуб отвечает');
  let ok=false; for(let i=0;i<10&&!ok;i++){ try{ const r=await fetch(origin+'/api/config'); ok=r.ok; }catch(e){} if(!ok) await sleep(3000); }
  say(ok?'  клуб работает':'  пока не отвечает — подождите минуту и откройте адрес ниже');

  say('\n════════════════════════════════════════════');
  say('Готово. Откройте: '+origin);
  say('«Войти через Telegram» → в чате с @'+me.username+' нажмите «Старт» и «Войти» — вы владелец (админ).');
  say('════════════════════════════════════════════');
}
if(require.main===module) main().catch(e=>{ console.error('\n✖ '+e.message+'\n\nЕсли непонятно, что делать, — пришлите этот текст Claude.'); process.exit(1); });
module.exports={zip,crc32,packageFiles};
