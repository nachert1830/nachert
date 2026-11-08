/* ═══════════ Сканер кабинета на синтетических листах ДЗ №4: кривые, привязка к варианту, проверка линий пересечения ═══════════
   node lab/dz/scan4.js [--ns=1,7,13,18,22,28] [--err=1] [--dz=auto|4] [--prec=fast|max] [--level=normal] [--png=папка]
   Лист — lab/dz/synth4.js (правда «что начерчено» — точная), путь — тот же, что у студента: lk/scan/pipeline.js run в Chromium.
   Модель подменена ответом по правде с погрешностью модели (synth4.mockAnswer: точки ± 0,4 мм, кривые 5–14 точек ± 0,8 мм) —
   без денег; настоящая модель — lab/dz/scan-real.js.
   Меры: кривые — после притяжки к карандашу против начерченного (мм, по снимку), и сырой ответ «модели» для сравнения;
   привязка — вариант среди 30 и невязка очерков; проверка — вердикт lk/scan/verify4.js на верном и на ошибочном листе. */
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..','..'), A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const IMG=require('../img.js'), SY=require('./synth4.js'), B4=require('../../lk/scan/bind4.js');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
const f2=x=>x==null||!isFinite(x)?'—':x.toFixed(2).replace('.',','), med=a=>{ a=a.filter(isFinite).sort((x,y)=>x-y); return a.length?a[a.length>>1]:NaN; }, q95=a=>{ a=a.filter(isFinite).sort((x,y)=>x-y); return a.length?a[Math.floor(0.95*(a.length-1))]:NaN; };
const dPoly=(p,P)=>{ let m=1e9; for(let i=1;i<P.length;i++){ const a=P[i-1], b=P[i], dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy||1e-9, t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L)); m=Math.min(m,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)); } return m; };

(async()=>{ const ns=(A.ns||'1,7,13,18,22,28').split(',').map(Number), cases=[];
  ns.forEach((n,i)=>{ cases.push({n,seed:100+i,err:null}); if(A.err!=='0') cases.push({n,seed:200+i,err:{line:i%2,proj:'both',kind:i%3===2?'shape':'shift',mm:i%3===2?25:4}}); });
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const br=await chromium.launch(), pg=await br.newPage(); pg.on('pageerror',e=>console.log('ошибка страницы: '+e));
  const FN='https://scan.invalid/fn'; let cur=null;
  await pg.route(u=>String(u).startsWith(FN),async r=>{ const q=r.request(), H={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
    if(q.method()!=='POST') return r.fulfill({status:200,headers:H,contentType:'application/json',body:'{"ok":true,"scan":true,"codeOk":true}'});
    const b=JSON.parse(q.postData()||'{}'), c=cur; let text;
    if(b.mode==='layout'){ const k=b.w/c.W; text=JSON.stringify({rot:0,drawings:[{box:c.box.map(v=>Math.round(v*k)),part:null}]}); }
    else { const bw=c.box[2]-c.box[0], bh=c.box[3]-c.box[1], pad=Math.max(40,0.05*Math.max(bw,bh)), X0=Math.max(0,Math.round(c.box[0]-pad)), Y0=Math.max(0,Math.round(c.box[1]-pad)), X1=Math.min(c.W,Math.round(c.box[2]+pad)), k=b.w/(X1-X0);
      const map=p=>{ const q=IMG.H.apply(c.H,[c.O[0]+p[0],c.O[1]+p[1]]); return [(q[0]-X0)*k,(q[1]-Y0)*k]; };
      text=SY.mockAnswer(c.truth,map,IMG.rng(c.seed*7+(b.mode==='crop2'?1:0)),{ppm:c.ppm*k}); c.raw=c.raw||{text,map,k,X0,Y0}; }
    return r.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({ok:true,text,mode:b.mode,cost:0})}); });
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/lk/scan/'); await pg.waitForFunction(()=>self.SCANPIPE&&self.LAB&&self.LAB.sheetlib&&self.SCANBIND4,null,{timeout:60000});
  const rows=[];
  for(const cs of cases){ const t0=Date.now(), S=SY.dz4Synth({n:cs.n,seed:cs.seed,err:cs.err,level:A.level||'normal'}), tr=S.truth;
    /* рамка чертежа на фото и px на мм (по правде) */
    const allP=[].concat(...tr.drawn.outl.map(q=>q.p),...tr.drawn.curves.map(q=>q.p)).map(p=>IMG.H.apply(tr.H,[tr.O[0]+p[0],tr.O[1]+p[1]]));
    const box=[Math.min(...allP.map(p=>p[0]))-30,Math.min(...allP.map(p=>p[1]))-30,Math.max(...allP.map(p=>p[0]))+30,Math.max(...allP.map(p=>p[1]))+30];
    const c0=IMG.H.apply(tr.H,tr.O), c1=IMG.H.apply(tr.H,[tr.O[0]+10,tr.O[1]]), ppm=Math.hypot(c1[0]-c0[0],c1[1]-c0[1])/10;
    cur={W:S.img.width,H:tr.H,O:tr.O,truth:tr,box,ppm,seed:cs.seed};
    const b64='data:image/png;base64,'+IMG.encodePNG(S.img).toString('base64');
    if(A.png){ fs.mkdirSync(A.png,{recursive:true}); fs.writeFileSync(path.join(A.png,'v'+cs.n+(cs.err?'-err':'')+'.png'),Buffer.from(b64.split(',')[1],'base64')); }
    const got=await pg.evaluate(async([b64,dz,prec])=>{ const blob=await (await fetch(b64)).blob(), file=new File([blob],'лист.png',{type:'image/png'});
      let R; try{ R=await SCANPIPE.create({cloud:'https://scan.invalid/fn',code:'—'}).run(file,{dz,variant:'auto',precision:prec}); }catch(e){ return {err:e.message}; }
      const d=R.out.drawings[0]; if(!d||d.error) return {err:d&&d.error||'нет чертежа'};
      return {fit:d.fit&&d.fit.rmsMm!=null?{dz:d.fit.dz,n:d.fit.n,rms:d.fit.hom?d.fit.hom.rmsMm:d.fit.rmsMm,cover:d.fit.cover,second:d.fit.second,inl:d.fit.inl,of:d.fit.of}:null,curves:(d.curves||[]).map(q=>({poly:q.poly,mm:q.mm,unv:q.unverified})),mmPts:d.mm&&d.mm.pts,mmSegs:d.mm&&d.mm.segs,mmArcs:(d.circles||[]).map(q=>q.mm),verify4:d.verify4||null,stats:d.stats}; },[b64,A.dz||'auto',A.prec||'fast']);
    if(got.err){ console.log('в.'+cs.n+(cs.err?' (ошибка)':'')+': ОШИБКА '+got.err); rows.push({cs,err:got.err}); continue; }
    /* кривые: точность по снимку — расстояние точек уточнённой кривой до начерченного (мм) */
    const truthPx=tr.drawn.curves.concat(tr.drawn.outl).map(q=>q.p.map(p=>IMG.H.apply(tr.H,[tr.O[0]+p[0],tr.O[1]+p[1]])));
    const near=p=>Math.min(...truthPx.map(P=>dPoly(p,P)))/ppm, ref=got.curves.filter(q=>!q.unv), eR=[].concat(...ref.map(q=>B4.dense(q.poly,ppm*0.5).map(near)));
    const raw=require('../../lab/dz/layout.js').parseDigit(cur.raw.text).curves.map(q=>q.p.map(p=>[p[0]/cur.raw.k+cur.raw.X0,p[1]/cur.raw.k+cur.raw.Y0])), eM=[].concat(...raw.map(P=>B4.dense(P,ppm*0.5).map(near)));
    /* покрытие начерченных линий пересечения уточнёнными кривыми (1 мм) */
    const tc=tr.drawn.curves.map(q=>q.p.map(p=>IMG.H.apply(tr.H,[tr.O[0]+p[0],tr.O[1]+p[1]]))), tcs=[].concat(...tc.map(P=>B4.dense(P,ppm))), cov=tcs.filter(p=>ref.some(q=>dPoly(p,q.poly)<=ppm)).length/Math.max(1,tcs.length);
    const v=got.verify4, row={cs,fit:got.fit,curves:{n:ref.length,unv:got.curves.length-ref.length,mean:eR.reduce((a,b)=>a+b,0)/Math.max(1,eR.length),p95:q95(eR),cov,rawMean:eM.reduce((a,b)=>a+b,0)/Math.max(1,eM.length),rawP95:q95(eM)},verdict:v&&v.verdict,lines:v&&v.lines.map(l=>({st:l.st,proj:Object.fromEntries(Object.entries(l.proj).map(([k,x])=>[k,x.st+(x.cov!=null?' '+Math.round(100*x.cov)+'%':'')]))})),chars:v&&v.chars,copy:A.out?{curves:got.curves.map(q=>q.mm),pts:got.mmPts,segs:got.mmSegs,arcs:got.mmArcs}:null,sec:(Date.now()-t0)/1000};
    rows.push(row);
    console.log('в.'+cs.n+(cs.err?' (ошибка: '+cs.err.kind+' линии '+(cs.err.line+1)+')':'')+': '+(got.fit?'ДЗ'+got.fit.dz+' в.'+got.fit.n+(got.fit.dz===4&&got.fit.n===cs.n?'':' ← ЧУЖОЙ')+', невязка '+f2(got.fit.rms)+' мм, покрытие очерков '+f2(got.fit.cover)+(got.fit.second?' (2-й в.'+got.fit.second.n+': '+f2(got.fit.second.cover)+')':''):'не привязан')
      +' · кривых '+ref.length+(row.curves.unv?' (+'+row.curves.unv+' без карандаша)':'')+', ошибка '+f2(row.curves.mean)+' мм (95 % ≤ '+f2(row.curves.p95)+'), у модели '+f2(row.curves.rawMean)+', покрытие '+Math.round(100*cov)+' %'
      +' · проверка: '+(v?v.verdict+' ['+row.lines.map(l=>l.st+' '+JSON.stringify(l.proj)).join(' | ')+'], точек '+v.chars.found+'/'+v.chars.of:'—')+' · '+row.sec.toFixed(0)+' с'); }
  await br.close(); srv.close();
  const ok=rows.filter(r=>!r.err), good=ok.filter(r=>!r.cs.err), bad=ok.filter(r=>r.cs.err), cnt=(L,v)=>L.filter(r=>r.verdict===v).length;
  const sum={sheets:rows.length,bound:ok.filter(r=>r.fit&&r.fit.dz===4&&r.fit.n===r.cs.n).length,wrong:ok.filter(r=>r.fit&&!(r.fit.dz===4&&r.fit.n===r.cs.n)).length,rms:med(ok.filter(r=>r.fit).map(r=>r.fit.rms)),
    curveMean:med(ok.map(r=>r.curves.mean)),curveP95:med(ok.map(r=>r.curves.p95)),rawMean:med(ok.map(r=>r.curves.rawMean)),cov:med(ok.map(r=>r.curves.cov)),
    good:{n:good.length,ok:cnt(good,'верно'),unsure:cnt(good,'не уверен'),bad:cnt(good,'расходится с эталоном')},err:{n:bad.length,ok:cnt(bad,'верно'),unsure:cnt(bad,'не уверен'),bad:cnt(bad,'расходится с эталоном')}};
  console.log('\nЛистов '+sum.sheets+': привязано к своему варианту '+sum.bound+', к чужому '+sum.wrong+', невязка (медиана) '+f2(sum.rms)+' мм; кривые после притяжки '+f2(sum.curveMean)+' мм (95 % ≤ '+f2(sum.curveP95)+'), у модели '+f2(sum.rawMean)+' мм, покрытие начерченного '+Math.round(100*sum.cov)+' %');
  console.log('Проверка: верные листы — верно '+sum.good.ok+', не уверен '+sum.good.unsure+', расходится '+sum.good.bad+' из '+sum.good.n+'; ошибочные — расходится '+sum.err.bad+', не уверен '+sum.err.unsure+', верно '+sum.err.ok+' из '+sum.err.n);
  if(A.out) fs.writeFileSync(A.out,JSON.stringify({sum,rows},null,1)); })().catch(e=>{ console.error(e); process.exit(1); });
