/* Сумма просмотров сайта: Яндекс Метрика + Google Analytics 4 → views.json (его читает счётчик на сайте).
   Запускается по расписанию из .github/workflows/views.yml. Без внешних зависимостей.
   Переменные окружения (секреты репозитория):
     YM_ID          — номер счётчика Метрики (по умолчанию 113262916)
     YM_TOKEN       — OAuth-токен Метрики (необязательно, если статистика счётчика открыта)
     GA_PROPERTY    — числовой ID ресурса GA4 (по умолчанию 558507876 — ресурс сайта)
     GA_SA_JSON     — JSON-ключ сервисного аккаунта с ролью «Читатель» в этом ресурсе
   Источник без настроек пропускается; если не удалось получить ни одного числа — файл не трогаем. */
const fs=require('fs'), crypto=require('crypto');
const out=require('path').join(__dirname,'..','..','views.json');
async function yandex(){ const id=process.env.YM_ID||'113262916', h=process.env.YM_TOKEN?{Authorization:'OAuth '+process.env.YM_TOKEN}:{};
  const r=await fetch('https://api-metrika.yandex.net/stat/v1/data?ids='+id+'&metrics=ym:s:pageviews&date1=2024-01-01&date2=today&accuracy=full',{headers:h});
  if(!r.ok) throw new Error('Метрика: '+r.status); const j=await r.json(); return Math.round(+j.totals[0]); }
async function google(){ const prop=process.env.GA_PROPERTY||'558507876', key=process.env.GA_SA_JSON;   /* ресурс GA4 сайта */ if(!prop||!key) return null;
  const sa=JSON.parse(key), now=Math.floor(Date.now()/1000), b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const head=b64({alg:'RS256',typ:'JWT'}), body=b64({iss:sa.client_email,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const sig=crypto.createSign('RSA-SHA256').update(head+'.'+body).sign(sa.private_key).toString('base64url');
  const t=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion='+head+'.'+body+'.'+sig});
  if(!t.ok) throw new Error('Google токен: '+t.status); const tok=(await t.json()).access_token;
  const r=await fetch('https://analyticsdata.googleapis.com/v1beta/properties/'+prop+':runReport',{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},
    body:JSON.stringify({dateRanges:[{startDate:'2024-01-01',endDate:'today'}],metrics:[{name:'screenPageViews'}]})});
  if(!r.ok) throw new Error('GA4: '+r.status); const j=await r.json(); return Math.round(+((j.rows&&j.rows[0]&&j.rows[0].metricValues[0].value)||0)); }
(async()=>{ const got={};
  for(const [k,f] of [['yandex',yandex],['google',google]]){ try{ const v=await f(); if(v!=null) got[k]=v; }catch(e){ console.log(String(e.message||e)); } }
  if(!Object.keys(got).length){ console.log('нет данных — views.json не меняю'); return; }
  let old={}; try{ old=JSON.parse(fs.readFileSync(out,'utf8')); }catch(e){}
  /* источник, который сейчас не ответил, берём из прошлого файла — сумма не проваливается */
  const parts=Object.assign({},old.parts||{},got), pageviews=Object.values(parts).reduce((a,b)=>a+b,0);
  fs.writeFileSync(out,JSON.stringify({pageviews,parts})+'\n'); console.log('views.json:',pageviews,parts); })();
