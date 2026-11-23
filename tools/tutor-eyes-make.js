/* Наставник: проверочные «фото листа» для замера глаз (tools/tutor-eval.js --only=eyes).
   Для каждого случая — три картинки в server/test/tutor-eyes/:
     <id>-ref.jpg   — эталон, как его рисует окно наставника (черновик листа SHEET.ng, построения в цвете);
     <id>-ok.jpg    — «фото» верного чистовика (поворот, перекос, бумага, тень, шум, размытие) — глаза не должны найти ошибок;
     <id>-bad.jpg   — «фото» чистовика с ошибкой студента: одна координата одной точки отложена не так (данные варианта
                       изменены до решения — весь чертёж построен от неверной точки, как у настоящего студента).
   cases.json — что подсажено: точка, на какой проекции видно (z → front, y → top), на сколько мм.
   node tools/tutor-eyes-make.js   (Playwright, ≈ 1 мин) */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..'), OUT=path.join(ROOT,'server','test','tutor-eyes');
const CASES=[
  {id:'ng1-4',dz:'ng1',n:4,pt:'A',ax:2,d:12},
  {id:'ng2-17',dz:'ng2',n:17,pt:'B',ax:2,d:12},
  {id:'ng3-3',dz:'ng3',n:3,pt:'S',ax:1,d:12},
  {id:'ng2-5',dz:'ng2',n:5,pt:'C',ax:1,d:-12}
];

/* в браузере: лист → JPEG; photo — «снято телефоном» */
async function render(o){ const {dz,n,mode,photo,mut}=o;
  let was=null, now=null; if(mut){ const V=DZR.get(dz).V[n]; V[mut.pt]=V[mut.pt].slice(); was=V[mut.pt][mut.ax]; V[mut.pt][mut.ax]+=mut.d; now=V[mut.pt][mut.ax]; }
  let s=SHEET.ng(DZR.solve(dz,n),DZR.meta(dz,n),mode).svg; if(!/xmlns=/.test(s)) s=s.replace(/^<svg/,'<svg xmlns="http://www.w3.org/2000/svg"');
  /* таблицу данных студент переписал верно — ошибся при построении: в ячейке — исходное число */
  if(mut){ const f=v=>String(v).replace('.',','); s=s.split('>'+f(now)+'<').join('>'+f(was)+'<'); }
  const vb=/viewBox="[\d.\s-]*?([\d.]+) ([\d.]+)"/.exec(s), W=vb?+vb[1]:900, H=vb?+vb[2]:1270, k=1400/Math.max(W,H);
  const url=URL.createObjectURL(new Blob([s],{type:'image/svg+xml'})), im=await new Promise((ok,no)=>{ const x=new Image(); x.onload=()=>ok(x); x.onerror=()=>no(new Error('svg')); x.src=url; });
  const cv=document.createElement('canvas'); cv.width=Math.round(W*k); cv.height=Math.round(H*k); const cx=cv.getContext('2d');
  cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); cx.drawImage(im,0,0,cv.width,cv.height); URL.revokeObjectURL(url);
  if(!photo) return cv.toDataURL('image/jpeg',.72);
  /* фото: стол, лист под углом, бумага теплее, тень от руки, шум, лёгкая расфокусировка */
  const P=document.createElement('canvas'); P.width=cv.width+160; P.height=cv.height+160; const g=P.getContext('2d');
  g.fillStyle='#5b5148'; g.fillRect(0,0,P.width,P.height);
  g.save(); g.translate(P.width/2,P.height/2); g.rotate(photo.rot*Math.PI/180); g.transform(1,photo.skew,0,1,0,0); g.scale(.93,.93);
  g.filter='blur(0.7px) sepia(0.25) brightness(0.96)'; g.drawImage(cv,-cv.width/2,-cv.height/2); g.restore(); g.filter='none';
  const sh=g.createLinearGradient(0,0,P.width,P.height); sh.addColorStop(0,'rgba(0,0,0,0)'); sh.addColorStop(.75,'rgba(0,0,0,.05)'); sh.addColorStop(1,'rgba(0,0,0,.28)'); g.fillStyle=sh; g.fillRect(0,0,P.width,P.height);
  const id=g.getImageData(0,0,P.width,P.height), d=id.data; let seed=photo.seed; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
  for(let i=0;i<d.length;i+=4){ const e=(rnd()-.5)*22; d[i]+=e; d[i+1]+=e; d[i+2]+=e; } g.putImageData(id,0,0);
  return P.toDataURL('image/jpeg',.62); }

function serve(){ return new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); }); }

(async()=>{ let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const srv=await serve(), U='http://127.0.0.1:'+srv.address().port, browser=await chromium.launch(); fs.mkdirSync(OUT,{recursive:true});
  const save=(f,data)=>fs.writeFileSync(path.join(OUT,f),Buffer.from(data.split(',')[1],'base64'));
  const meta=[];
  for(const [i,c] of CASES.entries()){
    for(const kind of ['ref','ok','bad']){ const p=await browser.newPage(); await p.route(u=>!u.href.startsWith(U),r=>r.abort());
      await p.goto(U+'/#/'+c.dz+'/'+c.n+'/list'); await p.waitForFunction(()=>window.DZR&&window.SHEET&&SHEET.ng,null,{timeout:30000});
      const img=await p.evaluate(render,{dz:c.dz,n:c.n,mode:kind==='ref'?'draft':'final',photo:kind==='ref'?null:{rot:kind==='ok'?-2.5+i:2+i*0.7,skew:kind==='ok'?0.03:-0.025,seed:7+i*13+(kind==='bad'?5:0)},
        mut:kind==='bad'?{pt:c.pt,ax:c.ax,d:c.d}:null});
      save(c.id+'-'+kind+'.jpg',img); await p.close(); }
    meta.push({id:c.id,dz:c.dz,n:c.n,point:c.pt,view:c.ax===2?'front':'top',coord:'xyz'[c.ax],mm:c.d});
    console.log(c.id+': '+['ref','ok','bad'].map(k=>k+' '+Math.round(fs.statSync(path.join(OUT,c.id+'-'+k+'.jpg')).size/1024)+' КБ').join(', ')); }
  fs.writeFileSync(path.join(OUT,'cases.json'),JSON.stringify({about:'Проверочные фото для замера глаз наставника: tools/tutor-eyes-make.js. bad — у точки point координата coord сдвинута на mm (видно на view).',cases:meta},null,1)+'\n');
  await browser.close(); srv.close(); })().catch(e=>{ console.error(e); process.exit(1); });
