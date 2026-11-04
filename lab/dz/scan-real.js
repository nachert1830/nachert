/* ═══════════ Сканер кабинета на настоящих фото листов (правды построения нет — есть таблица варианта) ═══════════
   node lab/dz/scan-real.js --dir=lab/private/dz3real --url=<адрес функции> --code=<код> [--prec=max|auto|fast] [--model=sonnet|opus] [--only=v12] [--limit=3]
   node lab/dz/scan-real.js --dir=lab/private/dz3real --replay=1 — без запросов: ответы модели берутся из кэша (<dir>/out/cache.json)
   Фото — <dir>/vNN-*.jpg (NN — вариант ДЗ №3 по штампу листа) или uNN-*.jpg (штамп не читается: вариант не известен, привязка не судится). Путь — тот же, что у студента: lk/scan/pipeline.js run() в Chromium,
   запросы к функции — из Node (как scan-ab.js); каждый ответ кэшируется по хэшу запроса: тот же кадр — тот же ответ, без денег.
   Меры без правды построения:
     привязка — чертёж привязался к ДЗ №3 и именно к варианту листа (не к чужому);
     невязка — СКО точек условия копии против таблицы варианта после подгонки (мм): сюда входит и рука студента (≈ 0,3–0,5 мм);
     подтверждено — доля линий копии, под которыми найден карандаш; точек — сколько подписанных точек в копии.
   В <dir>/out/ — наложение копии на фото (PNG) для глаз и сводка JSON. Фото и производные никуда не публикуются (lab/private — вне git). */
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto');
const ROOT=path.join(__dirname,'..','..'), A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const DIR=path.resolve(A.dir||path.join(ROOT,'lab/private/dz3real')), OUT=path.join(DIR,'out'), CACHE=path.join(OUT,'cache.json'), LIMIT=+(A.limit||3);
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
fs.mkdirSync(OUT,{recursive:true}); const cache=fs.existsSync(CACHE)?JSON.parse(fs.readFileSync(CACHE,'utf8')):{};
const f2=x=>x==null||!isFinite(x)?'—':x.toFixed(2).replace('.',','), med=a=>{ a=a.filter(isFinite).sort((x,y)=>x-y); return a.length?a[a.length>>1]:NaN; };

(async()=>{ if(!A.replay&&(!A.url||!A.code)){ console.log('нужны --url и --code (или --replay=1)'); process.exit(1); }
  const files=fs.readdirSync(DIR).filter(f=>/^[vu]\d+.*\.(jpe?g|png)$/i.test(f)&&(!A.only||f.startsWith(A.only))).sort();
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const br=await chromium.launch(), pg=await br.newPage(); pg.on('pageerror',e=>console.log('ошибка страницы: '+e)); if(A.v) pg.on('console',m=>console.log('стр: '+m.text()));
  const FN='https://scan.invalid/fn'; let spent=0, calls=0, hits=0;
  await pg.route(u=>String(u).startsWith(FN),async r=>{ const q=r.request();
    if(q.method()==='OPTIONS') return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST'}});
    if(q.method()==='GET') return r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:'{"ok":true,"scan":true,"codeOk":true}'});
    const body=q.postData()||'', key=crypto.createHash('sha1').update(body).digest('hex');
    if(cache[key]){ hits++; return r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:cache[key]}); }
    if(A.replay) return r.fulfill({status:503,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({ok:false,error:'нет в кэше (--replay)'})});
    if(spent>=LIMIT) return r.fulfill({status:429,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({ok:false,error:'предел замера $'+LIMIT})});
    const resp=await fetch(A.url,{method:'POST',headers:{'content-type':'application/json','x-scan-code':encodeURIComponent(A.code),origin:'https://nachert1830.ru'},body}), text=await resp.text();
    let j=null; try{ j=JSON.parse(text); }catch(e){} calls++; if(j&&j.cost) spent+=j.cost;
    if(resp.ok&&j&&j.ok){ cache[key]=text; fs.writeFileSync(CACHE,JSON.stringify(cache)); }
    return r.fulfill({status:resp.status,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:text}); });
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/lk/scan/'); await pg.waitForFunction(()=>self.SCANPIPE&&self.LAB&&self.LAB.sheetlib&&self.SCANMERGE,null,{timeout:60000});
  const rows=[];
  for(const f of files){ const n=f[0]==='v'?+f.match(/^v(\d+)/)[1]:null, b64='data:image/jpeg;base64,'+fs.readFileSync(path.join(DIR,f)).toString('base64'); const t0=Date.now();
    const got=await pg.evaluate(async([b64,name,url,prec,model])=>{ const blob=await (await fetch(b64)).blob(), file=new File([blob],name,{type:'image/jpeg'});
      const pipe=SCANPIPE.create({cloud:url,code:'—'}), log=[];
      let R; try{ R=await pipe.run(file,Object.assign({dz:'3',variant:'auto',precision:prec,check:true},model?{model}:{}),(id,t,st)=>{ if(st) log.push(t); }); }catch(e){ return {err:e.message,log}; }
      const {out,bmp}=R, c=document.createElement('canvas'); c.width=bmp.width; c.height=bmp.height; const g=c.getContext('2d'); g.drawImage(bmp,0,0); g.fillStyle='rgba(255,255,255,0.45)'; g.fillRect(0,0,c.width,c.height);
      const lw=Math.max(1,c.width/700); g.lineWidth=lw;
      out.drawings.forEach(d=>{ if(!d||d.error) return; if(d.box){ g.strokeStyle='rgba(0,120,255,0.6)'; g.setLineDash([6,4]); g.strokeRect(d.box[0],d.box[1],d.box[2]-d.box[0],d.box[3]-d.box[1]); g.setLineDash([]); }
        d.segs.forEach(s=>{ g.strokeStyle=s.unverified?'rgba(230,120,0,0.9)':s.src==='found'?'rgba(150,0,200,0.85)':'rgba(0,160,40,0.9)'; g.beginPath(); g.moveTo(s.p[0],s.p[1]); g.lineTo(s.p[2],s.p[3]); g.stroke(); });
        (d.circles||[]).forEach(q=>{ g.strokeStyle='rgba(0,140,200,0.9)'; g.beginPath(); q.poly.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); });
        g.font=Math.round(lw*7)+'px sans-serif'; d.pts.forEach(p=>{ g.fillStyle='rgba(220,0,0,0.95)'; g.beginPath(); g.arc(p[1],p[2],lw*1.6,0,7); g.fill(); g.fillText(p[0],p[1]+lw*2,p[2]-lw*2); }); });
      return {png:c.toDataURL('image/png'),log,drawings:out.drawings.map(d=>d.error?{error:d.error}:{part:d.part,fit:d.fit&&d.fit.rmsMm!=null?{dz:d.fit.dz,n:d.fit.n,inl:d.fit.inl,rms:d.fit.hom?d.fit.hom.rmsMm:d.fit.rmsMm}:null,q:d.quality,stats:d.stats,reads:d.reads,nSeg:d.segs.length,nPts:d.pts.length,check:d.check||null,verify:d.verify||null,mm:d.mm?{pts:d.mm.pts,txt:d.mm.txt,segs:d.mm.segs.filter(q=>!q.unverified).map(q=>q.p)}:null}),cost:out.cost,calls:out.calls}; },[b64,f,FN,A.prec||'max',A.model||null]);
    if(got.err){ console.log(f+': ОШИБКА '+got.err); rows.push({f,n,err:got.err}); continue; }
    fs.writeFileSync(path.join(OUT,f.replace(/\.\w+$/,'')+'.png'),Buffer.from(got.png.split(',')[1],'base64'));
    const ds=got.drawings.filter(d=>!d.error);
    console.log(f+' (вариант '+(n==null?'?':n)+'): чертежей '+got.drawings.length+', '+((Date.now()-t0)/1000).toFixed(0)+' с');
    got.drawings.forEach((d,i)=>{ if(d.error){ console.log('   '+(i+1)+': ошибка '+d.error); return; }
      console.log('   '+(i+1)+': '+(d.fit?'ДЗ'+d.fit.dz+' в'+d.fit.n+(n==null?' (вариант листа не известен)':d.fit.n===n?'':' ← ЧУЖОЙ')+', невязка '+f2(d.fit.rms)+' мм, точек условия '+d.fit.inl:'не привязан')+' · точек '+d.nPts+', линий '+d.nSeg+', подтверждено '+Math.round(100*(d.q?d.q.conf:0))+' %'+(d.verify?' · ПО РЕЗУЛЬТАТУ: '+d.verify.verdict+' ('+d.verify.found.map(f=>f.k+' '+(Array.isArray(f.got)?f.got.join('/'):f.got)+' vs '+(Array.isArray(f.want)?f.want.join('/'):f.want)).join('; ')+')':'')+(d.check?' · ПРОВЕРКА: '+d.check.verdict+(d.check.partName?' (часть '+d.check.partName+')':'')+(d.check.why&&d.check.why[0]?' — '+d.check.why[0]:'')+' ['+d.check.ms+' мс]':'')+(d.stats&&d.stats.placed?' · на перекрёстке '+d.stats.placed.vertex+', на линии '+d.stats.placed.line+', свободных '+d.stats.placed.free:'')); });
    rows.push({f,n,drawings:got.drawings}); }
  await br.close(); srv.close();
  const D=rows.flatMap(r=>(r.drawings||[]).filter(d=>!d.error).map(d=>Object.assign({n:r.n},d))), ok=D.filter(d=>d.n!=null&&d.fit&&d.fit.dz===3&&d.fit.n===d.n), wrong=D.filter(d=>d.n!=null&&d.fit&&!(d.fit.dz===3&&d.fit.n===d.n)), known=D.filter(d=>d.n!=null);
  const pl=D.reduce((a,d)=>{ const p=d.stats&&d.stats.placed; if(p){ a.v+=p.vertex; a.l+=p.line; a.f+=p.free; } return a; },{v:0,l:0,f:0});
  const sum={sheets:rows.length,drawings:D.length,known:known.length,unbound:known.filter(d=>!d.fit).length,rmsAll:med(D.filter(d=>d.fit).map(d=>d.fit.rms)),bound:ok.length,wrong:wrong.length,rms:med(ok.map(d=>d.fit.rms)),conf:med(D.map(d=>d.q?d.q.conf:NaN)),pts:D.reduce((a,d)=>a+d.nPts,0),placed:pl,calls,cacheHits:hits,spent:+spent.toFixed(3)};
  console.log('\nЛистов '+sum.sheets+', чертежей '+sum.drawings+' (вариант известен у '+sum.known+'): привязано к своему варианту '+sum.bound+', к чужому '+sum.wrong+', не привязано '+sum.unbound+', невязка (медиана) '+f2(sum.rms)+' мм, подтверждено карандашом (медиана) '+Math.round(100*sum.conf)+' %; точек '+sum.pts+' (на перекрёстке '+pl.v+', на линии '+pl.l+', свободных '+pl.f+')');
  console.log('Запросов к модели '+calls+' (из кэша '+hits+'), ≈ $'+sum.spent);
  fs.writeFileSync(path.join(OUT,'summary'+(A.tag?'-'+A.tag:'')+'.json'),JSON.stringify({sum,rows},null,1)); })().catch(e=>{ console.error(e); process.exit(1); });
