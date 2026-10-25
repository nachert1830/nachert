/* Точки входа Yandex Cloud Functions (среда nodejs22, зависимостей нет).
   index.handler — HTTP: API Gateway → вся страница клуба и /api/* (спецификация шлюза — server/apigw.yaml).
   index.remind  — таймер каждые 15 минут: напоминания в Telegram и уборка просроченных записей. */
'use strict';
const {fromEnv}=require('./lib/config');
const {createApp}=require('./lib/app');
const {fromEvent}=require('./lib/http');
const {ydbStore}=require('./lib/store/ydb');
const {botClient}=require('./lib/telegram');
const {postbox}=require('./lib/mail');
let app=null;
function get(){ if(app) return app; const cfg=fromEnv(process.env);
  app=createApp({cfg,store:ydbStore(cfg.ydb),bot:botClient({token:cfg.botToken}),
    mail:postbox({from:process.env.MAIL_FROM||'',accessKeyId:cfg.ydb.accessKeyId,secretAccessKey:cfg.ydb.secretAccessKey})}); return app; }
/* прямой вызов «yc serverless function invoke … --data {"club":"owner-login"}» → одноразовая ссылка входа владельца.
   Запросы через шлюз всегда приходят с httpMethod, поэтому из интернета сюда не попасть. */
exports.handler=async(event)=>{ if(event&&!event.httpMethod&&event.club==='owner-login') return get().ownerLink();
  const req=fromEvent(event); if(req.method==='HEAD') req.method='GET'; return get().handle(req); };
exports.remind=async()=>{ const r=await get().remind(); console.log('напоминания',JSON.stringify(r)); return {statusCode:200,body:JSON.stringify(r)}; };
