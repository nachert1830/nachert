/* Эталонные чертежи ДЗ №2 (2а–2в) и №3 с сайта → lab/dz/examples.json (мм, начало O, u = −x, v = −z | +y).
   node lab/dz/fetch-examples.js — нужен Chromium (как для tests/run.js). Это наш же контент: итоговые сцены разборов. */
const fs=require('fs'), http=require('http'), path=require('path');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..','..');
(async()=>{ const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'text/javascript'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const br=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}), pg=await br.newPage();
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/'); await pg.waitForTimeout(1500);
  const out=await pg.evaluate(()=>{ const S=L.S, strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').trim(), r={};
    ['2','2b','2c','3'].forEach(id=>{ const d=NGHW.get(id), t=d&&d.task; if(!t) return; const part=(t.parts&&t.parts.length)?t.parts[0]:t;
      const items=PLAYER.scene(part,(part.steps||[]).length).items.filter(Boolean).map(it=>{ const o={t:it.t,k:it.k||null,l:it.l?strip(it.l):null}, m=p=>p&&[+(p[0]/S).toFixed(3),+(p[1]/S).toFixed(3)];
        ['at','a','b','c','p1','p2'].forEach(f=>{ if(it[f]) o[f]=m(it[f]); }); if(it.r) o.r=+(it.r/S).toFixed(3); if(it.p) o.p=it.p.map(m); return o; });
      r[id]={title:strip(d.title),num:d.num,ex:d.ex?d.ex():null,items}; });
    return r; });
  fs.writeFileSync(path.join(__dirname,'examples.json'),JSON.stringify(out));
  Object.entries(out).forEach(([k,v])=>console.log(k,v.num,v.title,'элементов',v.items.length));
  await br.close(); srv.close(); })();
