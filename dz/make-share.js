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
const ROOT=path.join(__dirname,'..'), SITE='http://nachert1830.ru', V='1';
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

/* обложка 1200×630: слева — что это, справа — чертёж на белой карточке */
function cover({k,t,sub,chips,pic,pic2}){ const F='/fonts/';
  const big=t.length>34?52:t.length>22?60:68;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:G;font-weight:400 800;src:url(${F}geologica-cyrillic.woff2) format('woff2');unicode-range:U+0400-045F}
@font-face{font-family:G;font-weight:400 800;src:url(${F}geologica-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2013-2014,U+2116}
@font-face{font-family:T;font-weight:400 700;src:url(${F}golos-text-cyrillic.woff2) format('woff2');unicode-range:U+0400-045F}
@font-face{font-family:T;font-weight:400 700;src:url(${F}golos-text-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+2013-2014,U+2116}
@font-face{font-family:M;font-weight:600;src:url(${F}ibm-plex-mono-cyrillic-600.woff2) format('woff2');unicode-range:U+0400-045F}
@font-face{font-family:M;font-weight:600;src:url(${F}ibm-plex-mono-latin-600.woff2) format('woff2');unicode-range:U+0000-00FF,U+2116}
html,body{margin:0}
body{width:1200px;height:630px;overflow:hidden;position:relative;color:#fff;font-family:T,sans-serif;
  background:radial-gradient(900px 520px at 92% -10%,rgba(37,99,235,.55),transparent 62%),linear-gradient(140deg,#071a4d 0,#0a2463 45%,#12357f 100%)}
.tri{position:absolute;left:0;right:0;bottom:0;height:14px;background:linear-gradient(90deg,#2f6ff0 0 40%,#fff 40% 60%,#e0252c 60% 100%)}
.l{position:absolute;left:72px;top:60px;width:${pic2?520:pic?600:1000}px}
.logo{display:flex;align-items:center;gap:16px;font:700 32px G}.logo img{width:60px;height:60px;border-radius:16px}
.k{margin-top:44px;font:600 21px M;letter-spacing:.07em;text-transform:uppercase;color:#ffb4ad}
h1{margin:14px 0 0;font:800 ${big}px/1.08 G;letter-spacing:-.5px}
p{margin:20px 0 0;font:500 27px/1.35 T;color:rgba(255,255,255,.86)}
.chips{position:absolute;left:72px;bottom:58px;display:flex;gap:12px}
.chip{padding:12px 20px;border-radius:14px;background:rgba(255,255,255,.13);font:700 22px T}.chip.red{background:#e0252c}
.r{position:absolute;right:70px;top:58px;bottom:72px;width:410px;background:#fff;border-radius:24px;box-shadow:0 34px 70px -24px rgba(0,0,0,.65);padding:16px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;transform:rotate(1.5deg)}
.r svg,.r img{max-width:100%;max-height:100%;display:block}
.r2{right:250px;top:110px;bottom:120px;width:300px;transform:rotate(-6deg);opacity:.96}
</style></head><body>
${pic2?`<div class="r r2">${pic2}</div>`:''}${pic?`<div class="r">${pic}</div>`:''}
<div class="l"><div class="logo"><img src="/icon-192.png" alt="">Начерт</div><div class="k">${esc(k)}</div><h1>${esc(t)}</h1><p>${esc(sub)}</p></div>
<div class="chips">${chips.map((c,i)=>`<span class="chip${i===0?' red':''}">${esc(c)}</span>`).join('')}</div><div class="tri"></div>
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
  await make('og.jpg',{k:'Начерт и инженерная графика',t:'Решение по шагам',sub:'ДЗ на твоём варианте, тетради, РК и 3D-модели',chips:['ДЗ на твоём варианте','89 задач','РК'],pic:pic(ig3),pic2:ng4.svg});
  await make('og/dz.jpg',{k:'Домашние задания',t:'Твой вариант — по шагам',sub:'Начерт и инженерная графика: разбор, 3D и лист А3 по ГОСТ',chips:['Впиши свой вариант','чистовик и черновик'],pic:pic(ig3),pic2:ng4.svg});
  await make('og/ng.jpg',{k:'Начерт',t:subjName.ng,sub:'ДЗ на твоём варианте, все задачи тетради, подготовка к РК и 3D-эпюр',chips:['ДЗ №1–5','89 задач','РК'],pic:ng4.svg});
  await make('og/ig.jpg',{k:'Инж. графика',t:subjName.ig,sub:'ДЗ на твоём варианте: деталь в 3D, построение по шагам и лист по ГОСТ',chips:['ДЗ №2–4','виды и разрезы','ЕСКД'],pic:pic(ig3)});
  for(const d of L) await make('og/'+d.id+'.jpg',{k:d.label+' · '+subjName[d.course],t:d.title,sub:'Твой вариант: разбор по шагам, 3D и лист А3 по ГОСТ',chips:['все '+d.count+' вариантов',d.course==='ng'?'чистовик и черновик':'деталь в 3D'],pic:pic(d)});
  await browser.close(); srv.close();

  /* страницы-адреса */
  const put=(rel,o)=>{ const dir=path.join(ROOT,rel); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'index.html'),stub(Object.assign({p:'/'+rel+'/'},o))); };
  put('dz',{hash:'dz',title:'Домашние задания — твой вариант по шагам',desc:'Начерт и инженерная графика: впиши свой вариант — разбор по шагам, 3D и лист А3 по ГОСТ.',img:'dz'});
  put('ng',{hash:'ng',title:'Начертательная геометрия по шагам',desc:'ДЗ на твоём варианте, решённая рабочая тетрадь, подготовка к РК и 3D-модель с эпюром.',img:'ng'});
  put('ig',{hash:'ig',title:'Инженерная графика по шагам',desc:'ДЗ на твоём варианте: деталь в 3D, построение видов и разрезов по шагам, лист по ГОСТ.',img:'ig'});
  for(const d of L){ const subj=d.course==='ng'?'по начерту':'по инженерной графике';
    put(d.id,{hash:d.id,title:d.label+' '+subj+' — '+d.title,desc:'Твой вариант: разбор по шагам, 3D и лист А3 по ГОСТ. Все '+d.count+' вариантов.',img:d.id});
    for(let n=1;n<=d.count;n++) put(d.id+'/'+n,{hash:d.id+'/'+n,title:d.label+' '+subj+', вариант '+n,desc:d.title+': разбор варианта '+n+' по шагам, 3D и лист А3 по ГОСТ.',img:d.id}); }
  console.log('страниц-адресов:',3+L.length*31);
})();
