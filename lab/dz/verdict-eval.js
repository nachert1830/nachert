/* ═══════════ Замер вердикта по частям: «верно» / «ошибка: где» / «не уверен» (lk/scan/verdict.js) ═══════════
   node lab/dz/verdict-eval.js [--set=synth|real|all] [--dz=3,4,5] [--labels=all|given] [--quick=1] [--out=файл.json]
   node lab/dz/verdict-eval.js --set=real [--dir=lab/private/dz45real] [--replay=1] [--limit=1.5] [--hint=0|1] [--only=v05] [--png=1]
   Путь — тот же, что у студента: lk/scan/pipeline.js run() в Chromium, по снимку на чертёж (single), задание выбрано (dz), вариант «авто».
   Синтетика (правда известна, ответ модели — имитация по начерченному с погрешностью модели, без денег):
     ДЗ №3 — lab/dz/quadsynth.js (часть листа = снимок), ошибки a_dir, a_d, b_dir, c_R, d_R; --labels=given — модель выписала
       только подписи точек условия (как часто на настоящих листах), all — все подписи построения;
     ДЗ №4 — lab/dz/synth4.js, ошибка — сдвиг 4 мм или искажение формы одной линии пересечения;
     ДЗ №5 — lab/dz/synth5.js, ошибки k_shift (точка пересечения сдвинута вдоль AB на 5 мм) и n_rot (нормаль повёрнута на 7°
       на одной проекции); верные — разные подписи (K/L, K₁/K₂, M/N) и касательная плоскость в ЛЮБОЙ из двух точек.
   Настоящие фото (lab/private, вне git): <dir>/vNN-dz4*.jpg, vNN-dz5*.jpg — NN вариант; ответы модели — через локальную копию облачной
   функции (server/scan/index.js, ключ ProxyAPI подставляет прокси), кэш по хэшу запроса в <dir>/out/cache.json (--replay=1 — только кэш).
     Правды нет: меры — привязка к своему варианту, вердикт по частям; «ошибка» на настоящем листе разбирается глазами
     (наложение копии и места ошибки — <dir>/out/*.png при --png=1).
   Меры синтетики: верная часть → «верно» (доля), ошибочная → «ошибка» с правильным местом (доля), ложных «ошибка» (должно быть 0). */
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto');
const ROOT=path.join(__dirname,'..','..'), A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const IMG=require('../img.js');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
const SET=A.set||'synth', DZS=(A.dz||'3,4,5').split(',').map(Number), QUICK=!!A.quick;
const pc=(a,b)=>b?Math.round(100*a/b)+' %':'—';

/* ── кадр снимка: часть листа (ДЗ №3) — вырезка по рамке части в px фото ── */
function cropImg(im,b){ const x0=Math.max(0,Math.floor(b[0])), y0=Math.max(0,Math.floor(b[1])), x1=Math.min(im.width,Math.ceil(b[2])), y1=Math.min(im.height,Math.ceil(b[3])), w=x1-x0, h=y1-y0, d=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++) d.set(im.data.subarray(((y+y0)*im.width+x0)*4,((y+y0)*im.width+x1)*4),y*w*4); return {img:{width:w,height:h,data:d},x0,y0}; }
const bboxPx=(P,pad)=>[Math.min(...P.map(p=>p[0]))-pad,Math.min(...P.map(p=>p[1]))-pad,Math.max(...P.map(p=>p[0]))+pad,Math.max(...P.map(p=>p[1]))+pad];

/* ── синтетические случаи: {name, dz, n, img, mock(b) → текст, expect:{id: 'ok'|'err'}, place(part) → верно ли место} ── */
function synthCases(){ const C=[];
  if(DZS.includes(3)){ const Q=require('./quadsynth.js'), E=require('./digit-eval.js'), ERR={a:'1',b:'2',c:'3',d:'4'};
    const sheets=[[21,1],[9,2],[3,3],[14,4],[25,5],[7,6]].map(([n,seed])=>({n,seed})).concat([['a_dir',9],['a_d',12],['b_dir',14],['c_R',3],['d_R',25]].map(([err,n],i)=>({n,seed:40+i,err})));
    (QUICK?sheets.filter((s,i)=>i%3===0):sheets).forEach(sh=>{ const s=Q.sheet({n:sh.n,seed:sh.seed,err:sh.err,size:[1500,2000]}); if(!s) return;
      s.truth.parts.forEach((p,i)=>{ if(!p.built) return; const tr=E.truthOf(s,i,null,true), H=s.truth.H, corners=[[p.box[0],p.box[1]],[p.box[2],p.box[1]],[p.box[0],p.box[3]],[p.box[2],p.box[3]]].map(q=>IMG.H.apply(H,q));
        const cr=cropImg(s.img,bboxPx(corners,25)), map=(m,k)=>{ const q=IMG.H.apply(H,m); return [(q[0]-cr.x0)*k,(q[1]-cr.y0)*k]; };
        const id=ERR[p.part], bad=p.err&&p.affects!==false, R=IMG.rng(sh.seed*31+i);
        C.push({name:'ДЗ3 в'+sh.n+' ч.'+id+(bad?' ошибка '+p.err:''),dz:3,n:sh.n,img:cr.img,expect:{1:'skip',2:'skip',3:'skip',4:'skip',[id]:bad?'err':'ok'},
          mock:b=>{ const k=b.w/cr.img.width, f=v=>Math.round(v), j=()=>(R()-0.5)*1.2; const lab=l=>A.labels==='given'?/^[ABCS][″′]$/.test(l):true;
            return Object.entries(tr.pts).filter(([l])=>lab(l)).map(([l,q])=>{ const c=map(q,k); return 'P '+l+' '+f(c[0]+j())+' '+f(c[1]+j()); }).concat(tr.segs.map(([a,c])=>{ const x=map(a,k), y=map(c,k); return 'S '+[x[0]+j(),x[1]+j(),y[0]+j(),y[1]+j()].map(f).join(' '); })).join('\n'); },
          place:pt=>pt.id===id}); }); }); }
  if(DZS.includes(4)){ const SY=require('./synth4.js'); const ns=QUICK?[1,13,22]:[1,7,13,18,22,28];
    ns.forEach((n,i)=>[null,{line:i%2,proj:'both',kind:i%3===2?'shape':'shift',mm:i%3===2?25:4}].forEach((err,e)=>{ const S=SY.dz4Synth({n,seed:100+i+100*e,err}), tr=S.truth;
      const P=[].concat(...tr.drawn.outl.map(q=>q.p),...tr.drawn.curves.map(q=>q.p)).map(p=>IMG.H.apply(tr.H,[tr.O[0]+p[0],tr.O[1]+p[1]])), cr=cropImg(S.img,bboxPx(P,60));
      const c0=IMG.H.apply(tr.H,tr.O), c1=IMG.H.apply(tr.H,[tr.O[0]+10,tr.O[1]]), ppm=Math.hypot(c1[0]-c0[0],c1[1]-c0[1])/10, ref=require('../../lk/scan/dz4ref.json').v[n];
      const expect={}; ref.lines.forEach((L,li)=>expect[li+1]=err&&err.line===li?'err':'ok');
      C.push({name:'ДЗ4 в'+n+(err?' ошибка '+err.kind+' линии '+(err.line+1):''),dz:4,n,img:cr.img,expect,
        mock:b=>{ const k=b.w/cr.img.width, map=m=>{ const q=IMG.H.apply(tr.H,[tr.O[0]+m[0],tr.O[1]+m[1]]); return [(q[0]-cr.x0)*k,(q[1]-cr.y0)*k]; }; return SY.mockAnswer(tr,map,IMG.rng(n*7+e),{ppm:ppm*k}); },
        place:pt=>err&&pt.id===String(err.line+1)}); })); }
  if(DZS.includes(5)){ const SY=require('./synth5.js'); const ns=QUICK?[2,12,22]:[2,6,9,12,15,19,22,26,29];
    ns.forEach((n,i)=>[null,{kind:'k_shift',mm:5},{kind:'n_rot',deg:7}].forEach((err,e)=>{ if(err&&!QUICK&&i>=6) return; const S=SY.dz5Synth({n,seed:500+i+100*e,err}), tr=S.truth;
      const P=[].concat(tr.drawn.segs.map(s=>[s[0],s[1]]),tr.drawn.segs.map(s=>[s[2],s[3]]),...tr.drawn.circles.map(c=>c.P)).map(p=>IMG.H.apply(tr.H,[tr.O[0]+p[0],tr.O[1]+p[1]])), cr=cropImg(S.img,bboxPx(P,60));
      const c0=IMG.H.apply(tr.H,tr.O), c1=IMG.H.apply(tr.H,[tr.O[0]+10,tr.O[1]]), ppm=Math.hypot(c1[0]-c0[0],c1[1]-c0[1])/10;
      const wrongF=err&&err.kind==='k_shift'?tr.drawn.pts.find(q=>q[0]===tr.names[tr.ki]+'″'):null;
      C.push({name:'ДЗ5 в'+n+(err?' ошибка '+err.kind:''),dz:5,n,img:cr.img,expect:{1:err&&err.kind==='k_shift'?'err':'ok',2:err&&err.kind==='n_rot'?'err':err&&err.kind==='k_shift'?'skip':'ok'},
        mock:b=>{ const k=b.w/cr.img.width, map=m=>{ const q=IMG.H.apply(tr.H,[tr.O[0]+m[0],tr.O[1]+m[1]]); return [(q[0]-cr.x0)*k,(q[1]-cr.y0)*k]; }; return SY.mockAnswer(tr,map,IMG.rng(n*11+e),{ppm:ppm*k}); },
        place:pt=>{ if(!err) return false; if(err.kind==='k_shift') return pt.id==='1'&&(pt.at||[]).some(a=>a.v==='F'&&!a.want&&wrongF&&Math.hypot(a.p[0]-wrongF[1],a.p[1]-wrongF[2])<=3);
          return pt.id==='2'&&(pt.at||[]).some(a=>a.v===tr.rv); }}); })); }
  return C; }
function realCases(){ const dir=path.resolve(A.dir||path.join(ROOT,'lab/private/dz45real')); if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f=>/^v\d+-dz[345]\w*\.(jpe?g|png)$/i.test(f)&&(!A.only||f.startsWith(A.only))).sort().map(f=>{ const m=f.match(/^v(\d+)-dz(\d)/); return {name:f,file:path.join(dir,f),dz:+m[2],n:+m[1],real:true,dir}; }).filter(c=>DZS.includes(c.dz)); }

(async()=>{ const cases=(SET==='synth'||SET==='all'?synthCases():[]).concat(SET==='real'||SET==='all'?realCases():[]).filter(c=>!A.only||c.real||c.name.includes(A.only));
  console.log('случаев '+cases.length);
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const br=await chromium.launch(), pg=await br.newPage(); pg.on('pageerror',e=>console.log('ошибка страницы: '+e));
  /* настоящая модель: локальная копия облачной функции (ключ ProxyAPI подставляет прокси окружения) */
  let FNH=null, spent=0, calls=0, hits=0; const CODE='замер-вердикта';
  if(cases.some(c=>c.real)){ process.env.SCAN_CODE_SHA256=require('../../server/scan/index.js').sha(CODE); process.env.PROXYAPI_KEY=process.env.PROXYAPI_KEY||'sk-proxy-injected'; process.env.SCAN_LIMIT_USD='50'; process.env.SCAN_HOURLY='1000'; FNH=require('../../server/scan/index.js').handler; }
  const cacheF=c=>path.join(c.dir,'out','cache.json'), caches={};
  const FN='https://scan.invalid/fn'; let cur=null;
  await pg.route(u=>String(u).startsWith(FN),async r=>{ const q=r.request(), Hd={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
    if(q.method()!=='POST') return r.fulfill({status:200,headers:Hd,contentType:'application/json',body:'{"ok":true,"scan":true,"codeOk":true}'});
    const body=q.postData()||'', b=JSON.parse(body);
    if(cur.real){ const key=crypto.createHash('sha1').update(body).digest('hex'), cf=cacheF(cur); const C=caches[cf]||(caches[cf]=fs.existsSync(cf)?JSON.parse(fs.readFileSync(cf,'utf8')):{});
      if(C[key]){ hits++; return r.fulfill({status:200,headers:Hd,contentType:'application/json',body:C[key]}); }
      if(A.replay) return r.fulfill({status:503,headers:Hd,contentType:'application/json',body:'{"ok":false,"error":"нет в кэше (--replay)"}'});
      if(spent>=+(A.limit||1.5)) return r.fulfill({status:429,headers:Hd,contentType:'application/json',body:'{"ok":false,"error":"предел замера"}'});
      const res=await FNH({httpMethod:'POST',headers:{'x-scan-code':encodeURIComponent(CODE),'content-type':'application/json'},body}); let j=null; try{ j=JSON.parse(res.body); }catch(e){}
      calls++; if(j&&j.cost) spent+=j.cost; if(res.statusCode===200&&j&&j.ok){ C[key]=res.body; fs.mkdirSync(path.dirname(cf),{recursive:true}); fs.writeFileSync(cf,JSON.stringify(C)); }
      else console.log('  функция: '+res.statusCode+' '+(j&&j.error));
      return r.fulfill({status:res.statusCode,headers:Hd,contentType:'application/json',body:res.body}); }
    const text=b.mode==='layout'?'{"rot":0,"drawings":[]}':cur.mock(b); return r.fulfill({status:200,headers:Hd,contentType:'application/json',body:JSON.stringify({ok:true,text,mode:b.mode,cost:0})}); });
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/lk/scan/'); await pg.waitForFunction(()=>self.SCANPIPE&&self.LAB&&self.LAB.sheetlib&&self.SCANBIND4&&self.SCANVERDICT,null,{timeout:60000});
  const rows=[];
  for(const c of cases){ cur=c; const t0=Date.now();
    const b64=c.real?'data:image/jpeg;base64,'+fs.readFileSync(c.file).toString('base64'):'data:image/png;base64,'+IMG.encodePNG(c.img).toString('base64');
    const got=await pg.evaluate(async([b64,dz,hint,png])=>{ const blob=await (await fetch(b64)).blob(), file=new File([blob],'снимок',{type:blob.type});
      let R; try{ R=await SCANPIPE.create({cloud:'https://scan.invalid/fn',code:'—'}).run(file,{dz:String(dz),variant:'auto',precision:'fast',single:true,hint}); }catch(e){ return {err:e.message}; }
      const d=R.out.drawings[0]; if(!d||d.error) return {err:d&&d.error||'нет чертежа'};
      let pic=null; if(png){ const bmp=R.bmp, cv=document.createElement('canvas'); cv.width=bmp.width; cv.height=bmp.height; const g=cv.getContext('2d'); g.drawImage(bmp,0,0); g.fillStyle='rgba(255,255,255,0.4)'; g.fillRect(0,0,cv.width,cv.height); const lw=Math.max(1,cv.width/600); g.lineWidth=lw;
        d.segs.forEach(s=>{ g.strokeStyle=s.unverified?'rgba(230,120,0,0.8)':'rgba(0,150,40,0.85)'; g.beginPath(); g.moveTo(s.p[0],s.p[1]); g.lineTo(s.p[2],s.p[3]); g.stroke(); });
        (d.circles||[]).concat(d.curves||[]).forEach(q=>{ g.strokeStyle='rgba(0,120,220,0.85)'; g.beginPath(); q.poly.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); });
        g.font=Math.round(lw*8)+'px sans-serif'; d.pts.forEach(p=>{ g.fillStyle='rgba(200,0,0,0.95)'; g.beginPath(); g.arc(p[1],p[2],lw*1.8,0,7); g.fill(); g.fillText(p[0],p[1]+lw*2,p[2]-lw*2); });
        if(d.verdict&&d.fit&&d.fit.M){ const L=self.LAB.img, M=d.fit.M; (d.verdict.parts||[]).forEach(pt=>(pt.at||[]).forEach(a=>{ if(!a.p) return; const q=L.H.apply(M,a.p); g.strokeStyle=pt.st==='ошибка'?(a.want?'rgba(0,120,255,0.9)':'rgba(255,0,0,0.9)'):'rgba(0,160,0,0.7)'; g.lineWidth=lw*2; g.beginPath(); g.arc(q[0],q[1],lw*9,0,7); g.stroke(); })); }
        pic=cv.toDataURL('image/png'); }
      return {fit:d.fit&&d.fit.rmsMm!=null?{dz:d.fit.dz,n:d.fit.n,rms:d.fit.hom?d.fit.hom.rmsMm:d.fit.rmsMm,inl:d.fit.inl,cover:d.fit.cover,abCov:d.fit.abCov,pick:d.fit.pick}:null,mm:d.mm?{pts:d.mm.pts,txt:d.mm.txt,segs:d.mm.segs.filter(q=>!q.unverified).map(q=>q.p)}:null,try5:d.try5||null,verdict:d.verdict||null,stats:{pts:d.pts.length,segs:d.segs.length,curves:(d.curves||[]).length,circles:(d.circles||[]).length,cu:(d.circles||[]).map(c=>(c.unverified?'u':'v')+Math.round(c.c[2])),s:d.stats},pic}; },[b64,c.dz,A.hint==='0'?false:true,!!(c.real&&A.png)]);
    const row={name:c.name,dz:c.dz,n:c.n,real:!!c.real,err:got.err||null,mm:A.dump?got.mm:undefined,fit:got.fit||null,verdict:got.verdict,stats:got.stats,sec:(Date.now()-t0)/1000}; rows.push(row);
    if(got.pic){ fs.mkdirSync(path.join(c.dir,'out'),{recursive:true}); fs.writeFileSync(path.join(c.dir,'out',c.name.replace(/\.\w+$/,'')+'.png'),Buffer.from(got.pic.split(',')[1],'base64')); }
    if(!c.real&&got.verdict){ row.parts=got.verdict.parts.map(pt=>{ const e=c.expect[pt.id]||'skip'; return {id:pt.id,st:pt.st,expect:e,place:e==='err'&&pt.st==='ошибка'?!!c.place(pt):null,why:pt.why}; }); }
    const V=got.verdict, own=got.fit&&got.fit.dz===c.dz&&got.fit.n===c.n;
    console.log(c.name+': '+(got.err?'ОШИБКА '+got.err:(got.fit?'ДЗ'+got.fit.dz+' в'+got.fit.n+(own?'':' ← ЧУЖОЙ')+', невязка '+(got.fit.rms!=null?got.fit.rms.toFixed(2):'—')+(A.v?' cover '+got.fit.cover+' AB '+got.fit.abCov+' pick '+JSON.stringify(got.fit.pick):''):'не привязан'+(got.try5?' (ДЗ №5: '+JSON.stringify(got.try5)+')':''))+' · '+(V?V.verdict+' · '+V.parts.map(p=>p.id+':'+p.st+(p.st!=='верно'?' ('+p.why+')':'')).join(' | '):'вердикта нет'))+(A.v?' '+JSON.stringify(got.stats):'')+' · '+row.sec.toFixed(0)+' с'); }
  await br.close(); srv.close();
  /* ── сводка ── */
  const md=[]; const S=rows.filter(r=>!r.real);
  if(S.length){ md.push('| синтетика | частей верных | из них «верно» | «не уверен» | ложных «ошибка» | ошибочных частей | поймано «ошибка» с местом | без места | пропущено |','|---|---|---|---|---|---|---|---|---|');
    DZS.forEach(dz=>{ const P=[].concat(...S.filter(r=>r.dz===dz).map(r=>r.parts||[])), ok=P.filter(p=>p.expect==='ok'), er=P.filter(p=>p.expect==='err'), un=S.filter(r=>r.dz===dz&&!r.parts).length;
      if(!P.length&&!un) return; md.push('| ДЗ №'+dz+(dz===3?' (подписи: '+(A.labels||'all')+')':'')+' | '+ok.length+' | '+ok.filter(p=>p.st==='верно').length+' ('+pc(ok.filter(p=>p.st==='верно').length,ok.length)+') | '+ok.filter(p=>p.st==='не уверен').length+' | **'+ok.filter(p=>p.st==='ошибка').length+'** | '+er.length+' | '+er.filter(p=>p.place).length+' ('+pc(er.filter(p=>p.place).length,er.length)+') | '+er.filter(p=>p.st==='ошибка'&&!p.place).length+' | '+er.filter(p=>p.st!=='ошибка').length+(un?' (без вердикта чертежей: '+un+')':'')+' |'); }); }
  const Rr=rows.filter(r=>r.real);
  if(Rr.length){ md.push('','| настоящие фото | чертежей | свой вариант | чужой | не привязан | частей | «верно» | «не уверен» | «ошибка» |','|---|---|---|---|---|---|---|---|---|');
    DZS.forEach(dz=>{ const X=Rr.filter(r=>r.dz===dz); if(!X.length) return; const P=[].concat(...X.map(r=>r.verdict&&r.verdict.parts||[]));
      md.push('| ДЗ №'+dz+' | '+X.length+' | '+X.filter(r=>r.fit&&r.fit.dz===dz&&r.fit.n===r.n).length+' | '+X.filter(r=>r.fit&&!(r.fit.dz===dz&&r.fit.n===r.n)).length+' | '+X.filter(r=>!r.fit).length+' | '+P.length+' | '+P.filter(p=>p.st==='верно').length+' | '+P.filter(p=>p.st==='не уверен').length+' | '+P.filter(p=>p.st==='ошибка').length+' |'); });
    md.push('','Запросов к модели '+calls+' (из кэша '+hits+'), ≈ $'+spent.toFixed(3)+'.'); }
  console.log('\n'+md.join('\n')); if(A.out) fs.writeFileSync(A.out,JSON.stringify({rows,md},null,1)); })().catch(e=>{ console.error(e); process.exit(1); });
