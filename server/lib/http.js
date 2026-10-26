/* HTTP: событие Yandex Cloud Functions (через API Gateway) → запрос; ответы, cookie, заголовки безопасности, статика клуба. */
'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const CLUB=path.join(__dirname,'..','..','lk');

function header(h,name){ if(!h) return undefined; const n=name.toLowerCase(); for(const k of Object.keys(h)) if(k.toLowerCase()===n) return Array.isArray(h[k])?h[k][0]:h[k]; return undefined; }
function parseCookies(s){ const out={}; String(s||'').split(/;\s*/).forEach(p=>{ const i=p.indexOf('='); if(i>0){ const k=p.slice(0,i).trim(); if(!(k in out)) try{ out[k]=decodeURIComponent(p.slice(i+1).trim()); }catch(e){} } }); return out; }

/* payload_format_version 1.0 (path — настоящий путь) и 0.1 (url — настоящий путь, path — шаблон) */
function fromEvent(ev){
  const headers={}; Object.keys(ev.headers||{}).forEach(k=>{ headers[k.toLowerCase()]=String(ev.headers[k]); });
  Object.keys(ev.multiValueHeaders||{}).forEach(k=>{ const v=ev.multiValueHeaders[k]; if(!(k.toLowerCase() in headers)&&Array.isArray(v)) headers[k.toLowerCase()]=v.join(', '); });
  let p=ev.url||ev.path||'/'; try{ p=new URL(p,'http://x').pathname; }catch(e){ p='/'; }
  if(/[{}]/.test(ev.path||'')&&ev.url) p=new URL(ev.url,'http://x').pathname;
  let body=ev.body||''; if(ev.isBase64Encoded&&body) body=Buffer.from(body,'base64').toString('utf8');
  const ip=(ev.requestContext&&ev.requestContext.identity&&ev.requestContext.identity.sourceIp)||'0.0.0.0';
  return {method:String(ev.httpMethod||'GET').toUpperCase(),path:p,query:ev.queryStringParameters||{},headers,body,ip,cookies:parseCookies(headers.cookie)}; }

function securityHeaders(cfg,isHtml){ const h={
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Cross-Origin-Opener-Policy':'same-origin-allow-popups','Cross-Origin-Resource-Policy':'same-origin',
  'Permissions-Policy':'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'};
  if(cfg.secure) h['Strict-Transport-Security']='max-age=31536000; includeSubDomains';
  if(isHtml) h['Content-Security-Policy']=CSP;
  return h; }
const CSP=["default-src 'none'","script-src 'self'","style-src 'self'","img-src 'self' data: blob:","font-src 'self'","connect-src 'self'",
  "form-action 'self'","base-uri 'none'","frame-ancestors 'none'","manifest-src 'self'","worker-src 'self'","frame-src 'self'","object-src 'none'"].join('; ');

function json(status,obj,extra){ return {statusCode:status,headers:Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},extra||{}),body:JSON.stringify(obj)}; }
function cookie(name,value,o){ const p=[name+'='+encodeURIComponent(value),'Path=/','HttpOnly','SameSite=Lax']; if(o.secure) p.push('Secure'); if(o.maxAge!=null) p.push('Max-Age='+o.maxAge); return p.join('; '); }

const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'};
const PUBLIC=/^\/(index\.html|app\.css|app\.js|theme\.js|sw\.js|manifest\.webmanifest|icon\.svg|(lib|legal)\/[a-z0-9-]+\.(js|html|css)|core\/[a-z0-9-]+\.(js|json)|data\/[a-z0-9-]+\.json|core\/fonts\/[a-z0-9-]+\.woff2|core\/samples\/[a-z0-9-]+\.svg)$/;
const cache=new Map();
function staticFile(p,req,cfg){
  if(p==='/'||/^\/(invite|magic)\//.test(p)) p='/index.html';
  /* config.js: со страницы на адресе функции API — свой же сайт; на nachert1830.ru лежит файл с адресом функции */
  if(p==='/config.js') return {statusCode:200,headers:Object.assign({'Content-Type':TYPES['.js'],'Cache-Control':'no-cache'},securityHeaders(cfg,false)),body:"window.CLUB_API='';\n"};
  if(!PUBLIC.test(p)) return null;
  const f=path.join(CLUB,p); if(!f.startsWith(CLUB+path.sep)) return null;
  let c=cache.get(f); if(!c||cfg.dev){ if(!fs.existsSync(f)) return null; const b=fs.readFileSync(f); c={b,etag:'"'+crypto.createHash('sha1').update(b).digest('base64url').slice(0,16)+'"'}; cache.set(f,c); }
  const ext=path.extname(f), html=ext==='.html';
  const h=Object.assign({'Content-Type':TYPES[ext]||'application/octet-stream','Cache-Control':'no-cache',ETag:c.etag},securityHeaders(cfg,html));
  if(p==='/sw.js') h['Service-Worker-Allowed']='/';
  if(header(req.headers,'if-none-match')===c.etag) return {statusCode:304,headers:h,body:''};
  const bin=!/^(text|application\/(json|manifest)|image\/svg)/.test(h['Content-Type']);
  return {statusCode:200,headers:h,body:bin?c.b.toString('base64'):c.b.toString('utf8'),isBase64Encoded:bin}; }

module.exports={fromEvent,header,parseCookies,securityHeaders,json,cookie,staticFile,CSP,CLUB};
