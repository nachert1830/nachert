/* ═══════════ Обложки ссылок и адреса без «#» ═══════════
   node dz/make-share.js
   Telegram, ВК и мессенджеры не видят то, что в адресе после «#», — по ссылке nachert1830.ru/#/ng4/13 они показывают
   обложку главной (и держат её в кэше). Поэтому у всего, чем делятся, есть настоящий адрес — маленькая страница со своим
   заголовком и обложкой, которая сразу открывает сайт на нужном месте (адрес = путь из «#», ?s= — хвост: шаг, лист, задача):
     /dz/  /ng/  /ig/  /epure/              → #/dz, #/ng, #/ig, #/epure
     /ng4/  /ng4/13/                        → ДЗ и вариант           (?s=list, ?s=b — чистовик, задача б) внутри варианта)
     /ng/tasks/48/  /ng/rk2/  /ng/path/     → задача тетради, РК, теория
     /ig/wb/12/                             → задание тетради ИГ
   Обложки 1200×630 (og.jpg — главная, остальные — og/): светлые, как у больших сервисов, — логотип, одно крупное слово,
   одна строка и чертёж; триколор снизу. Кнопки «Поделиться» отправляют эти адреса (SHAREURL в index.html — список путей
   там же). После правки названий ДЗ или задач тетради — перегенерировать. */
const http=require('http'), fs=require('fs'), path=require('path');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..'), SITE='http://nachert1830.ru', V='3';
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* страница-адрес: свой заголовок и обложка для превью, сразу переход на сайт */
function stub({p,hash,title,desc,img}){ const url=SITE+p;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Начерт</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="Начерт"><meta property="og:type" content="website"><meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og/${img}.jpg?v=${V}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0a2463">
<script>(function(){ var s=new URLSearchParams(location.search).get('s'); location.replace('/#/${hash}'+(s&&/^[a-z0-9\\/-]{1,20}$/i.test(s)?'/'+s:'')); })();</script>
<style>body{font:16px system-ui,sans-serif;background:#fff;color:#0a2463;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#1a5ae0}</style></head>
<body><p><a href="/#/${hash}">${esc(title)} — открыть</a></p></body></html>
`; }

/* эпюр для обложек задач тетради: проекции отрезка AB и треугольник его натуральной величины */
const EPURE=`<svg viewBox="0 0 360 360" width="340" height="340" xmlns="http://www.w3.org/2000/svg" font-family="Arial" font-weight="700">
<line x1="20" y1="180" x2="340" y2="180" stroke="#0a2463" stroke-width="3"/><text x="22" y="170" font-size="22" fill="#0a2463">x</text>
<line x1="90" y1="60" x2="90" y2="285" stroke="#1a5ae0" stroke-width="2.5" stroke-dasharray="8 7"/><line x1="270" y1="115" x2="270" y2="235" stroke="#1a5ae0" stroke-width="2.5" stroke-dasharray="8 7"/>
<line x1="90" y1="60" x2="270" y2="115" stroke="#0a2463" stroke-width="6" stroke-linecap="round"/>
<path d="M90 285 L270 235 L300 290 Z" fill="rgba(224,37,44,.12)" stroke="#e0252c" stroke-width="4" stroke-linejoin="round"/>
<line x1="90" y1="285" x2="270" y2="235" stroke="#0a2463" stroke-width="6" stroke-linecap="round"/>
<circle cx="90" cy="60" r="10" fill="#1a5ae0"/><circle cx="270" cy="115" r="10" fill="#e0252c"/><circle cx="90" cy="285" r="10" fill="#1a5ae0"/><circle cx="270" cy="235" r="10" fill="#e0252c"/>
<text x="56" y="52" font-size="26" fill="#1a5ae0">A″</text><text x="282" y="112" font-size="26" fill="#e0252c">B″</text><text x="54" y="318" font-size="26" fill="#1a5ae0">A′</text><text x="280" y="228" font-size="26" fill="#e0252c">B′</text>
<text x="160" y="320" font-size="24" fill="#e0252c">|AB|</text></svg>`;

/* обложка 1200×630 — коротко и крупно, светлая: логотип, одно большое слово, одна строка, чертёж. Мелкого текста нет:
   в ленте мессенджера превью маленькое, читается только крупное */
function cover({t,sub,pic,pic2}){ const F='/fonts/', big=t.length>12?96:t.length>7?120:150;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:G;font-weight:400 800;src:url(${F}geologica-cyrillic.woff2) format('woff2');unicode-range:U+0400-045F}
@font-face{font-family:G;font-weight:400 800;src:url(${F}geologica-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2013-2014,U+2116}
@font-face{font-family:T;font-weight:400 700;src:url(${F}golos-text-cyrillic.woff2) format('woff2');unicode-range:U+0400-045F}
@font-face{font-family:T;font-weight:400 700;src:url(${F}golos-text-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2013-2014,U+2116}
html,body{margin:0}
body{width:1200px;height:630px;overflow:hidden;position:relative;color:#0a2463;font-family:T,sans-serif;
  background:radial-gradient(700px 520px at 88% 30%,#c9dbff 0,rgba(201,219,255,0) 70%),linear-gradient(135deg,#ffffff 0%,#f2f6ff 50%,#e4edff 100%)}
.tri{position:absolute;left:0;right:0;bottom:0;height:18px;background:linear-gradient(90deg,#0a2463 0 40%,#ffffff 40% 60%,#e0252c 60% 100%);box-shadow:0 -1px 0 #d5e0f2}
.logo{position:absolute;left:72px;top:60px;display:flex;align-items:center;gap:18px;font:800 40px G;color:#0a2463}.logo img{width:72px;height:72px;border-radius:18px;box-shadow:0 8px 18px -8px rgba(26,90,224,.6)}
.l{position:absolute;left:72px;bottom:100px;width:${pic2?560:pic?620:1000}px}
h1{margin:0;font:800 ${big}px/1 G;letter-spacing:-2px;white-space:pre-line;color:#0a2463}
p{margin:22px 0 0;font:700 44px/1.15 T;color:#e0252c}
.r{position:absolute;right:70px;top:54px;bottom:72px;width:400px;background:#fff;border-radius:28px;border:1px solid #dbe4ef;box-shadow:0 40px 70px -30px rgba(10,36,99,.45);padding:18px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;transform:rotate(2deg)}
.r svg,.r img{max-width:100%;max-height:100%;display:block}
.r2{right:250px;top:110px;bottom:124px;width:300px;transform:rotate(-6deg);box-shadow:0 30px 50px -30px rgba(10,36,99,.4)}
</style></head><body>
${pic2?`<div class="r r2">${pic2}</div>`:''}${pic?`<div class="r">${pic}</div>`:''}
<div class="logo"><img src="/icon-192.png" alt="">Начерт</div>
<div class="l"><h1>${esc(t)}</h1>${sub?`<p>${esc(sub)}</p>`:''}</div><div class="tri"></div>
</body></html>`; }

let COVER='';
(async()=>{
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ if(q.url.startsWith('/__cover')){ r.writeHead(200,{'Content-Type':TYPES['.html']}); return r.end(COVER); } let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const base='http://127.0.0.1:'+srv.address().port;
  const browser=await chromium.launch();
  const site=await browser.newPage({viewport:{width:600,height:900}});
  await site.goto(base+'/#/'); await site.waitForTimeout(1500);
  /* что знает сайт: ДЗ (названия, чертёж для обложки), задачи тетрадей */
  const L=await site.evaluate(()=>DZR.list().map(d=>{ let svg='';
    if(d.course==='ng'){ try{ const n=DZR.numbers(d.id)[0], r=DZR.solve(d.id,n); svg=SHEET.ng(r,DZR.meta(d.id,n),'draft').svg.replace(/width="297mm" height="420mm"/,'width="378" height="534"'); }catch(e){} }
    return {id:d.id,course:d.course,num:d.num,label:d.label,title:d.title,count:d.V?Object.keys(d.V).length:(d.count||30),svg}; }));
  const T=await site.evaluate(()=>WB3.tasks.map(t=>t.n).filter(n=>typeof n==='number').sort((a,b)=>a-b));
  const W=await site.evaluate(()=>(window.IG_WB||[]).map(t=>{ let svg=''; try{ svg=IGUI.sheetSVG(t,'','','','given'); }catch(e){} return {n:t.n,title:t.title,fig:t.fig,svg}; }));
  const pic=d=>d.course==='ng'?d.svg:`<img src="${d.id==='ig2'?'/ig/v05.jpg':'/dz/ig/'+d.num+'/img/v01.jpg'}">`;
  const shot=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  fs.mkdirSync(path.join(ROOT,'og'),{recursive:true});
  const make=async(file,o)=>{ COVER=cover(o); await shot.goto(base+'/__cover?'+file,{waitUntil:'load'}); await shot.evaluate(()=>document.fonts.ready); await shot.waitForTimeout(120);
    fs.mkdirSync(path.dirname(path.join(ROOT,file)),{recursive:true}); await shot.screenshot({path:path.join(ROOT,file),type:'jpeg',quality:86}); };
  const ng4=L.find(d=>d.id==='ng4')||L[0], ig3=L.find(d=>d.id==='ig3')||L.find(d=>d.course==='ig');
  await make('og.jpg',{t:'По шагам',sub:'начерт и инж. графика',pic:pic(ig3),pic2:ng4.svg});
  await make('og/dz.jpg',{t:'Твой\nвариант',sub:'ДЗ по шагам',pic:pic(ig3),pic2:ng4.svg});
  await make('og/ng.jpg',{t:'Начерт',sub:'по шагам',pic:ng4.svg});
  await make('og/ig.jpg',{t:'Инжа',sub:'инженерная графика',pic:pic(ig3)});
  await make('og/rk.jpg',{t:'РК',sub:'билеты и пробный РК',pic:EPURE});
  await make('og/path.jpg',{t:'Теория',sub:'уроки с картинками',pic:EPURE});
  await make('og/epure.jpg',{t:'3D-эпюр',sub:'двигай точку — чертёж строится',pic:EPURE});
  for(const d of L) await make('og/'+d.id+'.jpg',{t:'ДЗ '+d.num,sub:d.course==='ng'?'начерт':'инж. графика',pic:pic(d)});
  for(const n of T) await make('og/t/'+n+'.jpg',{t:'Задача '+n,sub:'тетрадь по начерту',pic:EPURE});
  for(const w of W) await make('og/w/'+w.n+'.jpg',{t:'Задание '+w.n,sub:'тетрадь по инже',pic:w.svg});
  console.log('обложек:',7+L.length+T.length+W.length);
  await browser.close(); srv.close();

  /* страницы-адреса */
  const put=(rel,o)=>{ const dir=path.join(ROOT,rel); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'index.html'),stub(Object.assign({p:'/'+rel+'/',hash:rel},o))); };
  put('dz',{title:'Домашние задания по шагам',desc:'Впиши свой вариант — разбор, 3D и лист А3.',img:'dz'});
  put('ng',{title:'Начерт по шагам',desc:'ДЗ, тетрадь, РК и 3D-эпюр.',img:'ng'});
  put('ig',{title:'Инженерная графика по шагам',desc:'ДЗ, тетрадь и теория ЕСКД.',img:'ig'});
  put('ng/rk2',{title:'Подготовка к РК по начерту',desc:'Билеты, вопросы и пробный РК.',img:'rk'});
  put('ng/path',{title:'Теория по начерту',desc:'Короткие уроки с картинками.',img:'path'});
  put('epure',{title:'3D-модель и эпюр',desc:'Двигай точку — эпюр строится сам.',img:'epure'});
  for(const d of L){ const subj=d.course==='ng'?'по начерту':'по инже';
    put(d.id,{title:'ДЗ '+d.num+' '+subj,desc:d.title+'. Твой вариант по шагам.',img:d.id});
    for(let n=1;n<=d.count;n++) put(d.id+'/'+n,{title:'ДЗ '+d.num+' '+subj+' · вариант '+n,desc:'Разбор по шагам, 3D и лист А3.',img:d.id}); }
  for(const n of T) put('ng/tasks/'+n,{title:'Задача №'+n+' по начерту',desc:'Решение по шагам — чертёж растёт на глазах.',img:'t/'+n});
  for(const w of W) put('ig/wb/'+w.n,{title:'Задание '+w.n+' по инже · рис. '+w.fig,desc:w.title+'. Решение по шагам и 3D.',img:'w/'+w.n});
  console.log('страниц-адресов:',6+L.length*31+T.length+W.length);
})();
