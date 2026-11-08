/* ═══════════ Эталон ДЗ №4 для сканера: линии пересечения и очерки тел 30 вариантов → lk/scan/dz4ref.json ═══════════
   Решатель ДЗ №4 (dz/ng/4/solver.js) живёт в странице сайта (нужны глобалы lib.js), поэтому эталон считается в Chromium:
   корневая страница, DZR.get('ng4').scanRef(n) для n = 1…30. Сканер и проверка (lk/scan/verify4.js) берут готовый файл —
   не грузят решатель и ядро поверхностей.
   node lab/dz/dz4ref.js [--only=1,7] */
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..','..'), A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
(async()=>{ const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const br=await chromium.launch(), pg=await br.newPage(); pg.on('pageerror',e=>console.log('ошибка страницы: '+e));
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/'); await pg.waitForFunction(()=>self.DZR&&DZR.get('ng4')&&DZR.get('ng4').scanRef,null,{timeout:60000});
  const ns=A.only?A.only.split(',').map(Number):Array.from({length:30},(_,i)=>i+1), out={};
  for(const n of ns){ const t0=Date.now(); out[n]=await pg.evaluate(n=>DZR.get('ng4').scanRef(n),n);
    const r=out[n]; console.log('в.'+n+' ('+r.code+'): линий '+r.lines.length+', ветвей '+r.lines.reduce((a,l)=>a+l.branches.length,0)+', точек '+r.lines.reduce((a,l)=>a+l.chars.length,0)+', очерков '+r.outlines.length+', '+((Date.now()-t0)/1000).toFixed(1)+' с'); }
  await br.close(); srv.close();
  const F=path.join(ROOT,'lk/scan/dz4ref.json'), prev=A.only&&fs.existsSync(F)?JSON.parse(fs.readFileSync(F,'utf8')):{};
  const all=Object.assign(prev.v||{},out), J=JSON.stringify({about:'ДЗ №4: эталон для сканера (lab/dz/dz4ref.js); мм эпюра от O, X″ = (−x, −z), X′ = (−x, y)',v:all});
  fs.writeFileSync(F,J); console.log('→ lk/scan/dz4ref.json, '+(J.length/1024).toFixed(0)+' КБ'); })().catch(e=>{ console.error(e); process.exit(1); });
