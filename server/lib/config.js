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
    week1:env.CLUB_WEEK1||''
  };
  cfg.secure=/^https:\/\//.test(cfg.origin);
  const miss=[];
  if(!cfg.secure) miss.push('ORIGIN (https://…)');
  if(!cfg.ydb.endpoint||!cfg.ydb.accessKeyId||!cfg.ydb.secretAccessKey) miss.push('YDB_DOCAPI_ENDPOINT / YDB_KEY_ID / YDB_SECRET');
  if(!cfg.botToken||!cfg.botName) miss.push('TG_BOT_TOKEN и TG_BOT_NAME — вход через бота');
  if(!cfg.webhookSecret) miss.push('TG_WEBHOOK_SECRET');
  if(miss.length) throw new Error('Не заданы настройки: '+miss.join(', '));
  return cfg; }
module.exports={fromEnv,list};
