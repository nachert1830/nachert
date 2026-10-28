/* ═══════════ Скорость разбора в браузере (Chromium, Playwright): общий снимок, снимки вблизи, фото листа ═══════════
   node lab/dz/test-speed.js [--n=21] [--seed=1] [--cpu=4] [--mode=close|upload]
   Синтетический лист (quadsynth.js): весь лист 2250 × 3000 и снимки вблизи 3000 × 4000. Код потока проверки (worker-ui.js)
   идёт в главном потоке страницы: замедление CPU в Chromium (--cpu=4 — «средний телефон») действует только на него, а
   на Web Worker — нет. Печатает время каждого этапа (поиск чертежей, опознание, привязка, проверка) и вердикт. */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), ROOT=path.resolve(__dirname,'../..'), IMG=require('../img.js'), Q=require('./quadsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), n=+(A.n||21), cpu=+(A.cpu||1), mode=A.mode||'close';
const s=Q.sheet({n,seed:+(A.seed||1),size:[2250,3000],closeup:8,closeShots:1,closeSize:[3000,4000]}), png=[IMG.encodePNG(s.img)].concat(s.views.map(v=>IMG.encodePNG(v.img)));
/* обёртки этапов — в том же потоке, что и проверка */
const BW=`importScripts('worker-ui.js'); (function(){ const L=self.LAB, W=(o,k,name)=>{ const f=o[k]; o[k]=function(){ const t=performance.now(), r=f.apply(this,arguments); self.postMessage({bench:name,ms:Math.round(performance.now()-t)}); return r; }; };
  W(L.dzEyes,'findDrawings','поиск чертежей'); W(L.dzEyes,'sameDrawing','опознание'); W(L.dzEyes,'prepareEyes','привязка'); W(L.dzCheck3,'check3','части'); })();`;
const srv=http.createServer((q,r)=>{ const u=decodeURIComponent(q.url.split('?')[0]);
  if(u==='/lab/dz/__speed.js'){ r.writeHead(200,{'content-type':'text/javascript'}); r.end(BW); return; }
  if(u.startsWith('/__img/')){ r.writeHead(200,{'content-type':'image/png'}); r.end(png[+u.slice(7)]); return; }
  if(u==='/__page'){ r.writeHead(200,{'content-type':'text/html'}); r.end('<!doctype html><title>скорость</title>'); return; }
  const f=path.join(ROOT,path.normalize(u)); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; }
  r.writeHead(200,{'content-type':'text/javascript'}); fs.createReadStream(f).pipe(r); }).listen(0);
(async()=>{ const {chromium}=require('playwright'), br=await chromium.launch(), pg=await br.newPage(); await pg.goto('http://localhost:'+srv.address().port+'/__page');
  if(cpu>1){ const cdp=await pg.context().newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu}); }
  const out=await pg.evaluate(async({n,mode})=>{ const load=async i=>{ const bm=await createImageBitmap(await (await fetch('/__img/'+i)).blob()), c=new OffscreenCanvas(bm.width,bm.height), g=c.getContext('2d'); g.drawImage(bm,0,0); return {width:c.width,height:c.height,data:g.getImageData(0,0,c.width,c.height).data}; };
    /* поток — здесь же: importScripts синхронно, сообщения — подписчикам */
    self.importScripts=(...f)=>f.forEach(x=>{ const r=new XMLHttpRequest(); r.open('GET',new URL(x,location.origin+'/lab/dz/').href,false); r.send(); (0,eval)(r.responseText); });
    let sub=null; self.postMessage=m=>sub&&sub(m); self.importScripts('__speed.js'); const on=self.onmessage, log=[];
    const run=msg=>new Promise(res=>{ const t=performance.now(); sub=m=>{ if(m.bench){ log.push(m.bench+' '+(m.ms/1000).toFixed(1)+' с'); return; } if(m.progress) return; res({m,s:(performance.now()-t)/1000}); }; setTimeout(()=>on({data:msg}),0); });
    if(mode==='upload'){ const r=await run({img:await load(0),dz:3,n,paper:'grid',answers:{},part:null}); return [{k:'фото листа',s:r.s,log:log.splice(0),v:(r.m.drawings||[]).map(d=>d.title+': '+d.verdict).join(' | ')||r.m.verdict}]; }
    const o=await run({mode:'overview',img:await load(0),dz:3,n,answers:{}}), res=[{k:'общий снимок',s:o.s,log:log.splice(0),v:o.m.overview&&o.m.overview.ok?'чертежей '+o.m.overview.drawings.length:'не прочитан'}];
    for(let j=0;j<4;j++){ const c=await run({mode:'close',want:j,img:await load(1+j),dz:3,n,answers:{}}); res.push({k:'снимок вблизи '+(j+1),s:c.s,log:log.splice(0),v:c.m.close&&c.m.close.ok?c.m.close.got.map(g=>g.frame.verdict).join(', '):c.m.close&&c.m.close.reason}); }
    return res; },{n,mode});
  out.forEach(x=>console.log(x.k+': '+x.s.toFixed(1)+' с'+(cpu>1?' (CPU ×'+cpu+')':'')+' — '+x.v+'\n    '+x.log.join(', ')));
  await br.close(); srv.close(); })().catch(e=>{ console.error(e); process.exit(1); });
