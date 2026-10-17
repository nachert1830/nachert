/* Число просмотров на сайте → views.json (его читает счётчик на сайте). Запускается по расписанию из .github/workflows/views.yml.
   Без внешних зависимостей.

   Честный счёт без двойного учёта. Источники видят разных людей и считают в разных единицах:
     Метрика  — просмотры (каждое открытие страницы) тех, кто нажал «Согласен» в уведомлении о cookie;
     GC_OK    — GoatCounter-сайт только для согласившихся: визиты на страницу (повтор той же страницы за визит не считается);
     GC_CODE  — GoatCounter-сайт для всех, кроме нажавших «Нет» (без cookie): визиты на страницу.
   За день:  max(Метрика, GC_OK) + (GC_CODE − GC_OK).
     max — это одни и те же согласившиеся люди: берём бо́льшую из двух оценок (обычно Метрику, а в дни сбоев Яндекса — GoatCounter);
     разность — посетители, не нажимавшие «Согласен»: их видит только GoatCounter, ни с кем не пересекаются.
   Пока GC_OK не заведён (пусто в index.html): max(Метрика, GC_CODE) — тоже без двойного счёта.
   Каждое слагаемое — то, что действительно посчитано (визит на страницу ≤ просмотров), поэтому сумма не больше настоящей.

   GoatCounter отдаёт только накопленное число (/counter/TOTAL.json, открыто без ключа; без ?start= — из кэша до 4 часов,
   поэтому спрашиваем с ?start= до запуска счётчика: число то же, но свежее), поэтому прирост между запусками
   записывается в день запуска (по Москве). Метрика пересчитывается по дням за последние KEEP дней — она дописывает
   запоздавшие данные в свой день; более старые дни сворачиваются в base.
   Коды GoatCounter берутся из index.html (window.GC_CODE, window.GC_OK_CODE) — одно место настройки.
   Переменные окружения (секреты репозитория, необязательные):
     YM_ID     — номер счётчика Метрики (по умолчанию 113262916)
     YM_TOKEN  — OAuth-токен Метрики, если статистика счётчика закрыта */
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..','..'), out=path.join(root,'views.json');
const KEEP=30, GC_START='2026-10-12';   /* GoatCounter подключён 12.10.2026, до перехода на эту схему считал только согласившихся */
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const code=k=>{ const m=html.match(new RegExp('window\\.'+k+"\\s*=\\s*'([a-z0-9-]*)'")); return m?m[1]:''; };
const GC=code('GC_CODE'), GC_OK=code('GC_OK_CODE');
const msk=(t=Date.now())=>new Date(t+3*3600e3).toISOString().slice(0,10);
const addDay=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const view=x=>Math.max(x.ym||0,x.c||0)+(x.r||0);

async function ymDays(from,to){ const id=process.env.YM_ID||'113262916', h=process.env.YM_TOKEN?{Authorization:'OAuth '+process.env.YM_TOKEN}:{};
  const r=await fetch('https://api-metrika.yandex.net/stat/v1/data?ids='+id+'&metrics=ym:s:pageviews&dimensions=ym:s:date&sort=ym:s:date&limit=10000&accuracy=full&date1='+from+'&date2='+to,{headers:h});
  if(!r.ok) throw new Error('Метрика: '+r.status); const j=await r.json(), o={};
  (j.data||[]).forEach(row=>{ o[row.dimensions[0].name]=Math.round(+row.metrics[0]); }); return o; }
async function gcTotal(c){ if(!c) return null;
  const r=await fetch('https://'+c+'.goatcounter.com/counter/TOTAL.json?start=2026-01-01',{headers:{'Cache-Control':'no-cache'}});
  if(!r.ok) throw new Error('GoatCounter '+c+': '+r.status+(r.status>=400&&r.status<500?' (сайта с таким кодом нет или в его настройках не включено «Allow adding visitor counts on your website»)':''));
  const n=+String((await r.json()).count||'').replace(/\D/g,''); if(!Number.isFinite(n)) throw new Error('GoatCounter '+c+': нет числа'); return n; }
const tryGet=async(f,...a)=>{ try{ return await f(...a); }catch(e){ console.log(String(e.message||e)); return undefined; } };

(async()=>{
  let old={}; try{ old=JSON.parse(fs.readFileSync(out,'utf8')); }catch(e){}
  const today=msk(), s=old.base?old:{ base:null, days:{}, gc:{all:null,ok:null} };
  const from=s.base?addDay(s.base.upto,1):'2024-01-01';
  const [ym,all,ok]=await Promise.all([tryGet(ymDays,from,today),tryGet(gcTotal,GC),tryGet(gcTotal,GC_OK)]);

  if(!s.base){   /* первый запуск новой схемы */
    if(ym){ s.base={pv:0,upto:addDay(from,-1)}; }
    else { s.base={pv:Math.round(+(old.pageviews||0)),upto:today}; console.log('Метрика не ответила — беру прошлое число',s.base.pv); }
    /* до перехода GoatCounter считал тех же согласившихся, что и Метрика: прибавляем, только если он насчитал больше её */
    if(all!=null&&ym){ const y=Object.entries(ym).filter(([d])=>d>=GC_START).reduce((a,[,v])=>a+v,0);
      if(all>y){ s.base.pv+=all-y; console.log('GoatCounter до перехода больше Метрики на',all-y); } }
  }
  const day=d=>(s.days[d]=s.days[d]||{ym:null,c:0,r:0});
  if(ym) Object.entries(ym).forEach(([d,v])=>{ if(d>s.base.upto) day(d).ym=v; });

  /* прирост GoatCounter с прошлого запуска. Общий сайт не ответил — метки не трогаем, прирост попадёт в следующий запуск.
     Сайт согласившихся не ответил — его метку сбрасываем, а прирост общего сайта идёт как оценка согласившихся (в max, не в сумму). */
  if(all!=null){ const p=s.gc||{}, dAll=p.all!=null&&all>=p.all?all-p.all:0, okOn=ok!=null&&p.ok!=null&&ok>=p.ok;
    if(dAll||okOn){ const t=day(today);
      if(okOn){ const dOk=ok-p.ok; t.c+=dOk; t.r+=Math.max(0,dAll-dOk); } else t.c+=dAll; }
    s.gc={all,ok:ok==null?null:ok}; }

  /* дни старше KEEP — окончательные, сворачиваем */
  const edge=addDay(today,-KEEP);
  Object.keys(s.days).sort().forEach(d=>{ if(d<=edge){ s.base.pv+=view(s.days[d]); s.base.upto=d; delete s.days[d]; } });
  if(s.base.upto<edge) s.base.upto=edge;
  Object.keys(s.days).forEach(d=>{ if(d<=s.base.upto) delete s.days[d]; });

  const pageviews=s.base.pv+Object.values(s.days).reduce((a,x)=>a+view(x),0);
  const res={pageviews,day:today,base:s.base,days:Object.fromEntries(Object.keys(s.days).sort().map(d=>[d,s.days[d]])),gc:s.gc};
  if(ym==null&&all==null&&old.base){ console.log('нет данных — views.json не меняю'); return; }
  fs.writeFileSync(out,JSON.stringify(res)+'\n');
  console.log('views.json:',pageviews,'· сегодня',JSON.stringify(res.days[today]||{}),'· GoatCounter',JSON.stringify(s.gc)); })();
