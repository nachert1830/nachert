/* Точки входа Yandex Cloud Functions (среда nodejs22, зависимостей нет).
   index.handler — HTTP: API Gateway → вся страница клуба и /api/* (спецификация шлюза — server/apigw.yaml).
   index.remind  — таймер каждые 15 минут: напоминания в Telegram и уборка просроченных записей. */
'use strict';
const {fromEnv}=require('./lib/config');
const {createApp}=require('./lib/app');
const {fromEvent}=require('./lib/http');
const {ydbStore}=require('./lib/store/ydb');
const {mailer}=require('./lib/mail');
const {botClient}=require('./lib/telegram');
let app=null;
function get(){ if(app) return app; const cfg=fromEnv(process.env);
  app=createApp({cfg,store:ydbStore(cfg.ydb),mail:mailer(cfg.mail),bot:botClient({token:cfg.botToken})}); return app; }
exports.handler=async(event)=>{ const req=fromEvent(event); if(req.method==='HEAD') req.method='GET'; return get().handle(req); };
exports.remind=async()=>{ const r=await get().remind(); console.log('напоминания',JSON.stringify(r)); return {statusCode:200,body:JSON.stringify(r)}; };
