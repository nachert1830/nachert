/* ═══════════ Живой сканер «чертёж за чертежом» на ненастоящей камере (ручной прогон, не CI) ═══════════
   Синтетический лист ДЗ №3 в.21 и его чертежи вблизи (lab/dz/quadsynth.js, closeup) → видео y4m (4:2:0, 10 кадров/с):
   лист целиком 3 с, потом каждый из четырёх чертежей вблизи по 2 с, по кругу. Chromium берёт его как камеру
   (--use-file-for-fake-video-capture), страница кабинета открывает LIVESCAN: автоснимок листа → «Снять каждый чертёж
   крупно» → четыре автоснимка вблизи (один — «Переснять последний») → «Распознать» → onShots(файлы, meta).
   В CI не входит: tests/run.js запускает Chromium без флагов камеры.
   node lab/live-closeup-smoke.js [папка снимков экрана, по умолчанию .live-smoke/ в корне] */
const path=require('path'), fs=require('fs'), http=require('http'), ROOT=path.join(__dirname,'..');
const Q=require('./dz/quadsynth.js'), CAP=require('./dz/capture.js');
const OUT=process.argv[2]||path.join(ROOT,'.live-smoke'); fs.mkdirSync(OUT,{recursive:true});
const W=540, H=720, FPS=10;
/* RGBA 1080 × 1440 → 540 × 720 (среднее 2 × 2) */
function half(im){ const w=im.width>>1, h=im.height>>1, d=new Uint8ClampedArray(w*h*4), s=im.data, sw=im.width;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) for(let c=0;c<4;c++){ const i=((2*y)*sw+2*x)*4+c; d[(y*w+x)*4+c]=(s[i]+s[i+4]+s[i+4*sw]+s[i+4*sw+4])/4; } return {width:w,height:h,data:d}; }
/* кадр y4m 4:2:0 (BT.601, полный диапазон — C420jpeg) */
function yuv(im){ const {width:w,height:h,data:d}=im, Y=Buffer.alloc(w*h), U=Buffer.alloc(w*h/4), V=Buffer.alloc(w*h/4);
  for(let i=0;i<w*h;i++) Y[i]=Math.round(0.299*d[4*i]+0.587*d[4*i+1]+0.114*d[4*i+2]);
  for(let y=0;y<h/2;y++) for(let x=0;x<w/2;x++){ let r=0,g=0,b=0; [[0,0],[1,0],[0,1],[1,1]].forEach(([dx,dy])=>{ const i=4*((2*y+dy)*w+2*x+dx); r+=d[i]; g+=d[i+1]; b+=d[i+2]; }); r/=4; g/=4; b/=4;
    U[y*w/2+x]=Math.max(0,Math.min(255,Math.round(128-0.168736*r-0.331264*g+0.5*b))); V[y*w/2+x]=Math.max(0,Math.min(255,Math.round(128+0.5*r-0.418688*g-0.081312*b))); }
  return Buffer.concat([Buffer.from('FRAME\n'),Y,U,V]); }
const s=Q.sheet({n:21,seed:1,size:[1080,1440],closeup:6,closeSize:[1080,1440]});
const sheet=half(s.img), views=s.views.slice(0,4).map(v=>half(v.img));
/* что видит оценка кадра (capture.analyze) — для отчёта: лист целиком не касается края, вблизи — касается */
[['лист',sheet]].concat(views.map((v,i)=>['чертёж '+(i+1),v])).forEach(([n,im])=>{ const A=CAP.analyze(im,null); console.log(n+': fill '+(A.paper?A.paper.fill.toFixed(2):'—')+', touch '+(A.paper?A.paper.touch.toFixed(2):'—')+', ok '+A.ok+(A.hints.length?' ('+A.hints[0]+')':'')); });
const vid=path.join(OUT,'closeup.y4m'), fd=fs.openSync(vid,'w'); fs.writeSync(fd,'YUV4MPEG2 W'+W+' H'+H+' F'+FPS+':1 Ip A1:1 C420jpeg\n');
const fS=yuv(sheet), fV=views.map(yuv); for(let i=0;i<3*FPS;i++) fs.writeSync(fd,fS); fV.forEach(f=>{ for(let i=0;i<2*FPS;i++) fs.writeSync(fd,f); }); fs.closeSync(fd);
console.log('видео: '+vid+' ('+((3+2*views.length))+' с по кругу)');

let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png'};
const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
  if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); })
  .listen(0,'127.0.0.1',async()=>{ const URL='http://127.0.0.1:'+srv.address().port+'/', bad=[], B=(r,m)=>{ bad.push(r+': '+m); console.log('✗ '+r+': '+m); };
    const br=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-video-capture='+vid]});
    const pg=await br.newPage({viewport:{width:390,height:844}}); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
    /* облако подменено: снимки вблизи уходят в кабинет (LKSCAN.scanMany → pipeline.runMany) — по запросу «crop» на снимок, без раскладки */
    const calls={}; await pg.route(/functions\.yandexcloud\.net/,r=>{ const q=r.request(); if(q.method()==='GET') return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
      const b=JSON.parse(q.postData()||'{}'); calls[b.mode]=(calls[b.mode]||0)+1; return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,text:'S 10 10 '+(b.w-10)+' '+(b.h-10),cost:0})}); });
    try{ await pg.goto(URL+'lk/'); await pg.waitForFunction(()=>!!self.LIVESCAN);
      await pg.evaluate(()=>{ window.__got=null; window.__lv=LIVESCAN.open({onShot:()=>{ window.__got={sheetOnly:true}; },onShots:(fs,m)=>{ window.__files=fs; window.__meta=m; window.__got={n:fs.length,files:fs.map(f=>({name:f.name,size:f.size,type:f.type})),meta:m.shots,sheet:!!m.sheet}; }}); });
      await pg.waitForSelector('.lv .res.on',{timeout:30000}); await pg.screenshot({path:path.join(OUT,'1-sheet.png')}); console.log('снимок листа: '+JSON.stringify(await pg.evaluate(()=>__lv.state.shot)));
      await pg.click('.lv [data-k="close"]'); await pg.evaluate(()=>{ window.__hints=[]; const t0=performance.now(); setInterval(()=>{ const h=document.querySelector('.lv .hint'); if(h) __hints.push(Math.round(performance.now()-t0)+' '+h.textContent); },300); }); await pg.waitForTimeout(1200); await pg.screenshot({path:path.join(OUT,'2-close.png')});
      await pg.waitForFunction(()=>__lv.state.shots.length>=1,null,{timeout:30000}); await pg.screenshot({path:path.join(OUT,'3-first.png')});
      await pg.click('.lv [data-k="undo"]'); const u=await pg.evaluate(()=>__lv.state.shots.length); if(u!==0) B('«Переснять последний»','снимков после отмены '+u);
      await pg.waitForSelector('.lv .rv.on',{timeout:90000}); await pg.screenshot({path:path.join(OUT,'4-review.png')});
      if(process.env.DEBUG) console.log((await pg.evaluate(()=>__hints)).join('\n')); await pg.click('.lv [data-k="send"]'); await pg.waitForTimeout(300); const got=await pg.evaluate(()=>window.__got); console.log('onShots: '+JSON.stringify(got));
      if(!got||got.n!==4) B('четыре снимка вблизи',JSON.stringify(got)); else { if(!got.sheet) B('лист целиком передан вместе со снимками','нет');
        if(got.meta.some(m=>!m.closeup||m.rectified)) B('снимки вблизи — без выпрямления',JSON.stringify(got.meta));
        await pg.evaluate(()=>{ const c=document.getElementById('scCode'); c.value='тест'; c.dispatchEvent(new Event('change')); document.getElementById('scPrec').value='fast'; });
        const st=await pg.evaluate(async()=>{ await LKSCAN.scanMany(__files,__meta); return document.getElementById('scSteps').textContent; });
        console.log('кабинет: '+JSON.stringify(calls)+' · '+st.slice(0,300)); if(calls.layout||calls.crop!==4) B('кабинет: по запросу на снимок, без раскладки',JSON.stringify(calls)); } }
    catch(e){ B('ход съёмки',e.message.split('\n')[0]); await pg.screenshot({path:path.join(OUT,'x-fail.png')}).catch(()=>{}); console.log('подсказка: '+await pg.evaluate(()=>{ const h=document.querySelector('.lv .hint'); return h&&h.textContent; }).catch(()=>'')); }
    errs.forEach(e=>B('ошибка JS',e.slice(0,200))); await br.close(); srv.close();
    console.log('снимки экрана: '+OUT); console.log(bad.length?'Замечаний: '+bad.length:'Живой сканер вблизи: ошибок нет'); process.exit(bad.length?1:0); });
