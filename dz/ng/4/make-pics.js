/* ═══════════ ДЗ №4 · картинки тел для галереи «Все тела в 3D» ═══════════
   Снимок того же окна 3D (TASK3D.snap — WebGL, прозрачный фон, WebP) для примера каждого чертежа-типа:
   img/ng4-3d-<тип>.webp — галерея #/ng4/3d.
   Перезапустить после правки тел (dz/ng/4/solver.js): node dz/ng/4/make-pics.js */
const fs=require('fs'), path=require('path'), http=require('http');
const ROOT=path.join(__dirname,'..','..','..'), OUT=path.join(ROOT,'img');
const TYPES={'4a1':3,'4a2':7,'4a3':13,'4b1':18,'4b2':21,'4b3':28};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css','.webmanifest':'application/json'};
(async()=>{
  const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); r.end(); return; }
    r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0);
  const port=srv.address().port, {chromium}=require('playwright'), b=await chromium.launch(), pg=await b.newPage();
  await pg.goto('http://localhost:'+port+'/#/dz'); await pg.waitForFunction(()=>window.DZR&&window.TASK3D&&TASK3D.snap,null,{timeout:30000});
  if(!fs.existsSync(OUT)) fs.mkdirSync(OUT);
  const shot=async(n,file,o)=>{ const url=await pg.evaluate(([n,o])=>TASK3D.snap(DZR.solve('ng4',n).task,640,400,Object.assign({type:'image/webp',q:0.86},o)),[n,o||{}]);
    if(!url) throw new Error('нет WebGL: снимок варианта '+n+' не получился');
    fs.writeFileSync(path.join(OUT,file),Buffer.from(url.split(',')[1],'base64')); console.log(file+' ← вариант '+n); };
  for(const [code,n] of Object.entries(TYPES)) await shot(n,'ng4-3d-'+code+'.webp');
  await b.close(); srv.close();
})().catch(e=>{ console.error(e); process.exit(1); });
