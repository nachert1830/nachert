/* Сборка ядра задач клуба из основного сайта — клуб работает на тех же задачах и темах, основной сайт не меняется.
   node club/tools/build-core.js            — пересобрать club/core/
   node club/tools/build-core.js --check    — только сверить (код выхода 1, если ядро устарело; запускается в тестах)
   Что берётся (index.html открывается в браузере, данные читаются из тех же объектов, что использует сайт):
     core/tasks.json   — задачи тетради (номер, раздел, РК, тема, условие), темы с типичными ошибками, симптомы «не понимаю…», разделы
     core/normo.js     — нормоконтроль листов ИГ (копия tests/normo.js) для «Предпроверки листа ДЗ ИКГ»
     core/fonts/       — шрифты интерфейса и чертёжный шрифт листа (SIL OFL 1.1, из fonts/)
     core/samples/     — образцы листов ДЗ 2 ИКГ: верный и с подсаженными нарушениями (тренажёр IGNK), с ожидаемым результатом */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..','..'), CORE=path.join(__dirname,'..','core'), CHECK=process.argv.includes('--check');
const FONTS=['golos-text-cyrillic','golos-text-latin','geologica-cyrillic','geologica-latin','liberation-serif-italic'];
const SAMPLES=[['ig-v5-clean',5,null],['ig-v8-thin',8,'thin'],['ig-v12-numline',12,'numline']];

function serve(){ return new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
  if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.woff2')?'font/woff2':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); }); }

async function extract(){
  const srv=await serve(), browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage(); await page.goto('http://127.0.0.1:'+srv.address().port+'/'); await page.waitForTimeout(1500);
  /* разделы тетради (SECS) живут внутри замыкания сайта — читаем литерал из исходника */
  const m=/const SECS=(\[[\s\S]*?\]);/.exec(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'));
  const SECS=m?Function('return '+m[1])():[]; if(!SECS.length) throw new Error('не нашёл SECS в index.html');
  const core=await page.evaluate((secs)=>{
    const rkOf={}; secs.forEach(s=>{ rkOf[s.id]=s.rk; });
    const topicOf=n=>{ const e=(TAGS.map||{})['ng-task:'+n]; return e&&e.topic&&TOPICS.get(e.topic)?e.topic:null; };
    const strip=h=>String(h||'').replace(/<(?!\/?(i|b|sub|sup|br)\b)[^>]*>/gi,'').replace(/\s+/g,' ').trim();
    const tasks=WB3.tasks.filter(t=>typeof t.n==='number').map(t=>({n:t.n,sec:t.sec,rk:rkOf[t.sec]||null,topic:topicOf(t.n),q:strip(t.q).slice(0,900),parts:(t.parts||[]).length}));
    /* РК2 на сайте включает параллельность и перпендикулярность (модули RK2) — их задачи тоже относятся к РК2 */
    const rk2extra=new Set(); (window.RK2&&RK2.MODS||[]).forEach(m=>(m.tasks||[]).forEach(n=>rk2extra.add(n)));
    const rkTopics={1:[],2:[],3:[]}; tasks.forEach(t=>{ if(!t.topic) return; const ks=new Set([t.rk]); if(rk2extra.has(t.n)) ks.add(2); ks.forEach(k=>{ if(rkTopics[k]&&!rkTopics[k].includes(t.topic)) rkTopics[k].push(t.topic); }); });
    const topics=TOPICS.list.filter(t=>t.subj!=='ig').map(t=>({id:t.id,title:t.title,why:strip(t.why).slice(0,400),build:strip((t.build||[])[0]).slice(0,300),mistakes:(t.mistakes||[]).map(strip).slice(0,4)}));
    const symptoms=(SYMPTOMS.list||[]).map(s=>({id:s.id,text:s.text,topic:s.topic}));
    return {source:'index.html',tasks,topics,symptoms,sections:secs.map(s=>({id:s.id,t:s.t,rk:s.rk})),rkTopics};
  },SECS);
  for(const f of ['normo.js']) await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'tests',f),'utf8')});
  await page.evaluate(()=>document.fonts&&document.fonts.load("italic 22px NchSerif","Ø120 Б–Б").catch(()=>{}));
  const samples=[];
  for(const [name,n,type] of SAMPLES){ const s=await page.evaluate(({n,type})=>{ let svg=type?IGNK.make(n,3,type).svg:IGS.sheet(n,'clean');
      /* лист на сайте берёт шрифт надписей из CSS страницы (классы igs-*, igl-*); образец должен быть самодостаточным, как экспорт из САПР */
      const host=document.createElement('div'); host.innerHTML=svg; document.body.appendChild(host);
      host.querySelectorAll('[class]').forEach(el=>{ const cs=getComputedStyle(el);
        if(el.localName==='text'||el.localName==='tspan') ['font-family','font-size','font-style','font-weight','fill'].forEach(k=>{ if(!el.hasAttribute(k)) el.setAttribute(k,cs.getPropertyValue(k)); });
        el.removeAttribute('class'); });
      svg=new XMLSerializer().serializeToString(host.querySelector('svg')); host.remove();
      const r=NORMO.check(svg,{});
      return {svg,issues:r.issues.map(i=>({gost:i.gost,rule:i.rule}))}; },{n,type});
    samples.push({name,variant:n,mutation:type,svg:s.svg,expect:s.issues}); }
  await browser.close(); srv.close(); return {core,samples}; }

function files(x){ const out={};
  out['tasks.json']=JSON.stringify(x.core)+'\n';
  out['normo.js']='/* копия tests/normo.js — собирается club/tools/build-core.js, руками не править */\n'+fs.readFileSync(path.join(ROOT,'tests','normo.js'),'utf8');
  FONTS.forEach(f=>{ out['fonts/'+f+'.woff2']=fs.readFileSync(path.join(ROOT,'fonts',f+'.woff2')); });
  x.samples.forEach(s=>{ out['samples/'+s.name+'.svg']=s.svg; });
  out['samples/index.json']=JSON.stringify(x.samples.map(s=>({name:s.name,variant:s.variant,mutation:s.mutation,expect:s.expect})),null,1)+'\n';
  return out; }

(async()=>{
  const x=await extract(), want=files(x); let stale=[];
  for(const [rel,buf] of Object.entries(want)){ const p=path.join(CORE,rel), b=Buffer.isBuffer(buf)?buf:Buffer.from(buf);
    const same=fs.existsSync(p)&&crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex')===crypto.createHash('sha1').update(b).digest('hex');
    if(!same){ stale.push(rel); if(!CHECK){ fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,b); } } }
  console.log((CHECK?'Сверка ядра: ':'Ядро собрано: ')+x.core.tasks.length+' задач, '+x.core.topics.length+' тем, '+x.samples.length+' образца листов'+(stale.length?(CHECK?' — устарело: ':' — обновлено: ')+stale.join(', '):' — без изменений'));
  x.samples.forEach(s=>console.log('  '+s.name+': замечаний '+s.expect.length+(s.expect.length?' ('+[...new Set(s.expect.map(i=>i.gost))].join(', ')+')':'')));
  process.exit(CHECK&&stale.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
