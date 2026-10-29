/* ═══════════ Обложки ссылок и адреса без «#» ═══════════
   node dz/make-share.js
   Telegram, ВК и мессенджеры не видят то, что в адресе после «#», — по ссылке nachert1830.ru/#/ng4/13 они показывают
   обложку главной. Поэтому у раздела ДЗ, у каждого ДЗ и каждого варианта есть настоящий адрес — маленькая страница со
   своим заголовком и обложкой, которая сразу открывает сайт на нужном месте:
     /dz/  /ng/  /ig/            → #/dz, #/ng, #/ig
     /ng4/  /ng4/13/             → #/ng4, #/ng4/13       (?s=list, ?s=b — чистовик, задача б) внутри варианта)
   Обложки 1200×630 — og/*.jpg (og.jpg — главная): тёмно-синий фон, триколор снизу, справа — чертёж этого ДЗ
   (у начерта — черновик листа варианта 1, у ИГ — изображение варианта из задания).
   Кнопки «Поделиться» отправляют эти адреса (SHAREURL в index.html). После правки названий ДЗ — перегенерировать. */
const http=require('http'), fs=require('fs'), path=require('path');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..'), SITE='http://nachert1830.ru', V='2';
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
<style>body{font:16px system-ui,sans-serif;background:#0a2463;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#fff}</style></head>
<body><p><a href="/#/${hash}">${esc(title)} — открыть</a></p></body></html>
`; }

/* обложка 1200×630 — коротко и крупно: логотип, одно большое слово, одна строка, чертёж. Мелкого текста нет:
   в ленте мессенджера превью маленькое, читается только крупное */
function cover({t,sub,pic,pic2}){ const F='/fonts/', big=t.length>12?96:t.length>7?120:150;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:G;font-weight:400 800;src:url(${F}geologica-cyrillic.woff2) format('woff2');unicode-range:U+0400-045F}
@font-face{font-family:G;font-weight:400 800;src:url(${F}geologica-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2013-2014,U+2116}
@font-face{font-family:T;font-weight:400 700;src:url(${F}golos-text-cyrillic.woff2) format('woff2');unicode-range:U+0400-045F}
@font-face{font-family:T;font-weight:400 700;src:url(${F}golos-text-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2013-2014,U+2116}
html,body{margin:0}
body{width:1200px;height:630px;overflow:hidden;position:relative;color:#fff;font-family:T,sans-serif;
  background:radial-gradient(900px 520px at 92% -10%,rgba(37,99,235,.55),transparent 62%),linear-gradient(140deg,#071a4d 0,#0a2463 45%,#12357f 100%)}
.tri{position:absolute;left:0;right:0;bottom:0;height:16px;background:linear-gradient(90deg,#2f6ff0 0 40%,#fff 40% 60%,#e0252c 60% 100%)}
.logo{position:absolute;left:72px;top:60px;display:flex;align-items:center;gap:18px;font:700 40px G}.logo img{width:72px;height:72px;border-radius:18px}
.l{position:absolute;left:72px;bottom:96px;width:${pic2?560:pic?620:1000}px}
h1{margin:0;font:800 ${big}px/1 G;letter-spacing:-1.5px;white-space:pre-line}
p{margin:22px 0 0;font:700 42px/1.2 T;color:#ffb4ad}
.r{position:absolute;right:70px;top:54px;bottom:70px;width:400px;background:#fff;border-radius:26px;box-shadow:0 34px 70px -24px rgba(0,0,0,.65);padding:16px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;transform:rotate(2deg)}
.r svg,.r img{max-width:100%;max-height:100%;display:block}
.r2{right:250px;top:110px;bottom:120px;width:300px;transform:rotate(-6deg)}
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
  /* что знает сайт: ДЗ, их названия, чертёж для обложки */
  const L=await site.evaluate(()=>DZR.list().map(d=>{ let svg='';
    if(d.course==='ng'){ try{ const n=DZR.numbers(d.id)[0], r=DZR.solve(d.id,n); svg=SHEET.ng(r,DZR.meta(d.id,n),'draft').svg.replace(/width="297mm" height="420mm"/,'width="378" height="534"'); }catch(e){} }
    return {id:d.id,course:d.course,num:d.num,label:d.label,title:d.title,count:d.V?Object.keys(d.V).length:(d.count||30),svg}; }));
  const pic=d=>d.course==='ng'?d.svg:`<img src="${d.id==='ig2'?'/ig/v05.jpg':'/dz/ig/'+d.num+'/img/v01.jpg'}">`;
  const subjName={ng:'Начертательная геометрия',ig:'Инженерная графика'};
  const shot=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  fs.mkdirSync(path.join(ROOT,'og'),{recursive:true});
  const make=async(file,o)=>{ COVER=cover(o); await shot.goto(base+'/__cover?'+file,{waitUntil:'load'}); await shot.evaluate(()=>document.fonts.ready); await shot.waitForTimeout(200);
    await shot.screenshot({path:path.join(ROOT,file),type:'jpeg',quality:86}); console.log(file,fs.statSync(path.join(ROOT,file)).size); };
  const ng4=L.find(d=>d.id==='ng4')||L[0], ig3=L.find(d=>d.id==='ig3')||L.find(d=>d.course==='ig');
  await make('og.jpg',{t:'По шагам',sub:'начерт и инж. графика',pic:pic(ig3),pic2:ng4.svg});
  await make('og/dz.jpg',{t:'Твой\nвариант',sub:'ДЗ по шагам',pic:pic(ig3),pic2:ng4.svg});
  await make('og/ng.jpg',{t:'Начерт',sub:'по шагам',pic:ng4.svg});
  await make('og/ig.jpg',{t:'Инжа',sub:'инженерная графика',pic:pic(ig3)});
  for(const d of L) await make('og/'+d.id+'.jpg',{t:'ДЗ '+d.num,sub:d.course==='ng'?'начерт':'инж. графика',pic:pic(d)});
  await browser.close(); srv.close();

  /* страницы-адреса */
  const put=(rel,o)=>{ const dir=path.join(ROOT,rel); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'index.html'),stub(Object.assign({p:'/'+rel+'/'},o))); };
  put('dz',{hash:'dz',title:'Домашние задания по шагам',desc:'Впиши свой вариант — разбор, 3D и лист А3.',img:'dz'});
  put('ng',{hash:'ng',title:'Начерт по шагам',desc:'ДЗ, тетрадь, РК и 3D-эпюр.',img:'ng'});
  put('ig',{hash:'ig',title:'Инженерная графика по шагам',desc:'ДЗ, тетрадь и теория ЕСКД.',img:'ig'});
  for(const d of L){ const subj=d.course==='ng'?'по начерту':'по инже';
    put(d.id,{hash:d.id,title:'ДЗ '+d.num+' '+subj,desc:d.title+'. Твой вариант по шагам.',img:d.id});
    for(let n=1;n<=d.count;n++) put(d.id+'/'+n,{hash:d.id+'/'+n,title:'ДЗ '+d.num+' '+subj+' · вариант '+n,desc:'Разбор по шагам, 3D и лист А3.',img:d.id}); }
  console.log('страниц-адресов:',3+L.length*31);
})();
