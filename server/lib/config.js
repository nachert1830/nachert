/* Настройки из переменных окружения (в Yandex Cloud — переменные функции и секреты Lockbox; список — club/DEPLOY.md).
   Боевой режим без обязательных настроек не запускается: лучше отказ, чем вход без проверки подписи. */
'use strict';
const list=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
function fromEnv(env){ env=env||process.env;
  const cfg={
    dev:false,
    origin:(env.ORIGIN||'').replace(/\/$/,''),
    botToken:env.TG_BOT_TOKEN||'',
    botName:env.TG_BOT_NAME||'',
    webhookSecret:env.TG_WEBHOOK_SECRET||'',
    adminTg:list(env.ADMIN_TG_IDS),
    ydb:{endpoint:env.YDB_DOCAPI_ENDPOINT||'',accessKeyId:env.YDB_KEY_ID||'',secretAccessKey:env.YDB_SECRET||'',prefix:env.YDB_TABLE_PREFIX||'club_'},
    mainUrl:(env.MAIN_URL||'https://nachert1830.ru').replace(/\/$/,''),
    week1:env.CLUB_WEEK1||'',
    /* Яндекс ID: ClientID — в переменной функции, Client secret — в Lockbox. Владелец по логину Яндекса (логин не хранится) */
    yandex:{clientId:env.YANDEX_CLIENT_ID||'',secret:env.YANDEX_CLIENT_SECRET||''},
    adminYa:list(env.ADMIN_YA_LOGINS).map(x=>x.toLowerCase()),
    /* сайты, с которых открывают клуб (nachert1830.ru/club/), и куда ведут ссылки входа */
    fronts:list(env.FRONT_ORIGINS),
    frontUrl:env.FRONT_URL||'',
    /* официальный вход Telegram работает только на сайте, указанном у @BotFather (/setdomain) */
    tgLogin:{url:'https://oauth.telegram.org/auth',origins:list(env.TG_LOGIN_ORIGINS||'https://nachert1830.ru')}
  };
  cfg.secure=/^https:\/\//.test(cfg.origin);
  cfg.fronts=[cfg.origin].concat(cfg.fronts.map(x=>x.replace(/\/$/,''))).filter((x,i,a)=>x&&a.indexOf(x)===i);
  cfg.frontUrl=cfg.frontUrl||cfg.origin+'/';
  const miss=[];
  if(!cfg.secure) miss.push('ORIGIN (https://…)');
  if(!cfg.ydb.endpoint||!cfg.ydb.accessKeyId||!cfg.ydb.secretAccessKey) miss.push('YDB_DOCAPI_ENDPOINT / YDB_KEY_ID / YDB_SECRET');
  if(!cfg.botToken||!cfg.botName) miss.push('TG_BOT_TOKEN и TG_BOT_NAME — вход через бота');
  if(!cfg.webhookSecret) miss.push('TG_WEBHOOK_SECRET');
  if(cfg.yandex.clientId&&!cfg.yandex.secret) miss.push('YANDEX_CLIENT_SECRET');
  if(cfg.fronts.some(x=>!/^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(x))) miss.push('FRONT_ORIGINS (https://сайт без пути)');
  if(!cfg.fronts.some(f=>cfg.frontUrl.startsWith(f+'/'))) miss.push('FRONT_URL (адрес на одном из FRONT_ORIGINS)');
  if(miss.length) throw new Error('Не заданы настройки: '+miss.join(', '));
  return cfg; }
module.exports={fromEnv,list};
