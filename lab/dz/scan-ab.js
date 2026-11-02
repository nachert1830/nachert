/* ═══════════ Сканер кабинета: какая связка моделей точнее — замер на листах с известной правдой ═══════════
   node lab/dz/scan-ab.js --url=<адрес функции> --code=<код доступа> [--sheets=21:1,9:12:a_dir] [--limit=0.6] [--out=scan-ab.json]
   node lab/dz/scan-ab.js --replay=scan-ab.json — пересчёт по сохранённым ответам моделей, без запросов и денег.
   node lab/dz/scan-ab.js --mock=1 — проверка самого замера без денег: функция-имитация отвечает правдой листа с шумом
     («Opus» — вся правда, «Sonnet» — без каждой третьей линии).
   Лист — синтетический ДЗ № 3 целиком (lab/dz/quadsynth.js: 4 чертежа, перспектива, бумага, ≈ 3,3 px/мм — как фото телефоном),
   правда построения известна. Путь — тот же, что у студента в кабинете: lk/scan/pipeline.js в Chromium (раскладка, резка,
   оцифровка, притяжка к карандашу, привязка к варианту) и живая облачная функция (ProxyAPI). На каждый чертёж — два ответа:
   Claude Opus 5.5 и Claude Sonnet 5.5 (тот же кадр); из них без новых запросов считаются связки:
     Sonnet · Opus · Opus + Sonnet (слияние, lk/scan/merge.js) · Авто (Opus; слабый — + Sonnet, как в кабинете).
   Меры — в мм листа против правды (lab/dz/digit-eval.js measure): отрезки — полнота и точность в 1 мм, точки — найдено и
   промах (медиана), привязка к варианту. Предел --limit $ — по оценке цены, которую возвращает функция. */
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..','..'), A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const Q=require('./quadsynth.js'), IMG=require('../img.js'), E=require('./digit-eval.js');
const LIMIT=+(A.limit||0.6), SHEETS=(A.sheets||'21:1,9:12:a_dir').split(',').map(s=>{ const [n,seed,err]=s.split(':'); return {n:+n,seed:+seed,err:err||undefined}; });
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
const pc=x=>x==null||!isFinite(x)?'—':Math.round(100*x)+' %', f2=x=>x==null||!isFinite(x)?'—':x.toFixed(2).replace('.',',');
const VARIANTS=['Sonnet','Opus','Opus + Sonnet','Авто'];
let MOCK=null;   /* имитация функции (--mock=1) */

(async()=>{ const REPLAY=A.replay?JSON.parse(fs.readFileSync(A.replay,'utf8')):null;
  if(A.mock){ A.code='имитация'; A.url=await mockFunction(); }
  if(!REPLAY&&(!A.url||!A.code)){ console.log('нужны --url и --code (или --replay, --mock=1)'); process.exit(1); }
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const br=await chromium.launch(), pg=await br.newPage(); pg.on('pageerror',e=>console.log('ошибка страницы: '+e));
  /* запросы к функции — из Node с адресом сайта (функция пускает только nachert1830.ru), ответ — странице */
  let spent=0; const log=[];
  await pg.route(u=>A.url&&String(u).startsWith(A.url.replace(/[?&]integration=raw$/,'')),async r=>{ const q=r.request();
    if(q.method()==='OPTIONS') return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST'}});
    const b=JSON.parse(q.postData()||'{}');
    if(q.method()==='POST'&&spent>=LIMIT) return r.fulfill({status:429,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({ok:false,error:'предел замера $'+LIMIT+' исчерпан'})});
    const t0=Date.now(), resp=await fetch(q.url(),{method:q.method(),headers:{'content-type':'application/json','x-scan-code':encodeURIComponent(A.code),origin:'https://nachert1830.ru'},body:q.method()==='POST'?q.postData():undefined}), text=await resp.text();
    let j=null; try{ j=JSON.parse(text); }catch(e){} if(j&&j.cost) spent+=j.cost; log.push({mode:b.mode,model:j&&j.model,status:resp.status,ms:Date.now()-t0,cost:j&&j.cost,fallback:j&&j.fallback,err:j&&!j.ok?j.error:null});
    console.log('  '+(b.mode||q.method())+(b.model?' ['+b.model+']':'')+': HTTP '+resp.status+', '+((Date.now()-t0)/1000).toFixed(1)+' с'+(j&&j.model?', '+j.model:'')+(j&&j.cost?', ≈ $'+j.cost.toFixed(4):'')+(j&&j.fallback?', ЗАПАСНАЯ: '+j.fallback:'')+(j&&!j.ok?', '+j.error:'')+'; всего ≈ $'+spent.toFixed(3));
    return r.fulfill({status:resp.status,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:text}); });
  const base='http://127.0.0.1:'+srv.address().port; await pg.goto(base+'/lk/scan/'); await pg.waitForFunction(()=>self.SCANPIPE&&self.LAB&&self.LAB.sheetlib&&self.SCANMERGE,null,{timeout:60000});
  const all=[], raw=REPLAY?REPLAY.raw:[];
  for(const sh of SHEETS){ const s=Q.sheet({n:sh.n,seed:sh.seed,err:sh.err,size:[1500,2000]}); const name='ДЗ №3 в'+sh.n+(sh.err?', ошибка '+sh.err:'')+' (seed '+sh.seed+')';
    console.log('\n══ лист '+name+': '+s.truth.parts.map(p=>p.part+(p.built?'+':'-')).join(' '));
    const png='data:image/png;base64,'+IMG.encodePNG(s.img).toString('base64'), key=sh.n+':'+sh.seed+':'+(sh.err||'');
    const got=await pg.evaluate(async([png,url,saved])=>{ const im=new Image(); await new Promise(r=>{ im.onload=r; im.src=png; });
      const c=document.createElement('canvas'); c.width=im.width; c.height=im.height; c.getContext('2d').drawImage(im,0,0);
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.88)), bmp=await createImageBitmap(blob), W=bmp.width, H=bmp.height, P=SCANPIPE, L=self.LAB;
      const pipe=P.create({cloud:url||'https://x.invalid/',code:'—'});
      /* раскладка — как в кабинете */
      let layText=saved&&saved.layout; if(layText==null){ const sm=P.scaled(bmp,800); try{ layText=(await pipe.ask('layout',sm.c)).text; }catch(e){ layText=''; } }
      let lay=L.layout.parseLayout(layText,1/(Math.min(1,800/Math.max(W,H))),W,H); if(!lay.ok) lay={rot:0,drawings:[{box:[0,0,W,H],part:null}]};
      const out={layout:layText,drawings:[]};
      for(let i=0;i<lay.drawings.length;i++){ const d=lay.drawings[i], cr=P.cut(bmp,d.box,lay.rot,Math.max(40,0.05*Math.max(d.box[2]-d.box[0],d.box[3]-d.box[1])),1280), sv=saved&&saved.drawings[i]||{};
        const read=async m=>{ if(sv[m]!=null) return sv[m]; try{ return (await pipe.ask('crop',cr.c,{model:m})).text; }catch(e){ return null; } };
        const tO=await read('opus'), tS=await read('sonnet'), ctx={W,H,vSel:'auto',dzSel:null,rot:lay.rot,d}, V={};
        const res=R=>R&&{segs:R.dr.segs.map(q=>q.p),unv:R.dr.segs.map(q=>!!q.unverified),pts:R.dr.pts,fit:R.dr.fit&&R.dr.fit.rmsMm!=null?{dz:R.dr.fit.dz,n:R.dr.fit.n,rms:R.dr.fit.hom?R.dr.fit.hom.rmsMm:R.dr.fit.rmsMm}:null,q:R.q};
        const S=tS!=null?P.digest(cr,tS,null,ctx):null, O=tO!=null?P.digest(cr,tO,null,ctx):null, OS=tO!=null&&tS!=null?P.digest(cr,tO,tS,ctx):null;
        V['Sonnet']=res(S); V['Opus']=res(O); V['Opus + Sonnet']=res(OS); V['Авто']=res(O&&O.q.weak&&OS&&P.better(OS.q,O.q)?OS:O); V.autoSecond=!!(O&&O.q.weak);
        out.drawings.push({box:d.box,opus:tO,sonnet:tS,V}); }
      return out; },[png,REPLAY?null:A.url,REPLAY?(raw.find(r=>r.key===key)||null):null]);
    if(!REPLAY) raw.push({key,layout:got.layout,drawings:got.drawings.map(d=>({opus:d.opus,sonnet:d.sonnet}))});
    /* чертёж → часть листа (по рамке правды), меры — в мм листа */
    const Hi=IMG.H.inv(s.truth.H), toMM=p=>IMG.H.apply(Hi,p);
    got.drawings.forEach((d,i)=>{ const c=toMM([(d.box[0]+d.box[2])/2,(d.box[1]+d.box[3])/2]); let pi=-1, bd=1e9;
      s.truth.parts.forEach((p,k)=>{ const m=[(p.box[0]+p.box[2])/2,(p.box[1]+p.box[3])/2], e=Math.hypot(m[0]-c[0],m[1]-c[1]); if(e<bd){ bd=e; pi=k; } });
      const tr=E.truthOf(s,pi); console.log('  чертёж '+(i+1)+' → часть '+tr.part+(d.V.autoSecond?' (авто: слабый — вторая проверка)':''));
      VARIANTS.forEach(v=>{ const r=d.V[v]; if(!r){ all.push({sheet:name,part:tr.part,v,miss:true}); return; }
        const m=E.measure(tr,{pts:r.pts,segs:r.segs},toMM);
        all.push({sheet:name,part:tr.part,v,m,fit:r.fit,ok:r.fit&&r.fit.dz===3&&r.fit.n===sh.n});
        console.log('    '+v.padEnd(14)+' отрезки: полнота '+pc(m.rec1)+', точность '+pc(m.prec1)+' · точки '+m.found+' из '+m.nPts+', промах '+f2(m.med)+' мм'+(m.swap?', перепутано '+m.swap:'')+' · '+(r.fit?'в'+r.fit.n+', невязка '+f2(r.fit.rms)+' мм':'не привязан')); }); }); }
  await br.close(); srv.close(); if(MOCK) MOCK.close();
  /* итог по связкам: среднее по чертежам */
  const md=['## Сканер: какая связка моделей точнее (листы ДЗ №3 целиком, ≈ 3,3 px/мм)','','| связка | отрезки: полнота в 1 мм | точность в 1 мм | точки найдены | промах точек (медиана) | привязка к варианту |','|---|---|---|---|---|---|'];
  VARIANTS.forEach(v=>{ const R=all.filter(r=>r.v===v&&!r.miss); if(!R.length) return; const avg=f=>R.reduce((a,r)=>a+f(r),0)/R.length, med=a=>{ const t=a.filter(isFinite).sort((x,y)=>x-y); return t.length?t[t.length>>1]:NaN; };
    md.push('| '+v+' | '+pc(avg(r=>r.m.rec1))+' | '+pc(avg(r=>r.m.prec1))+' | '+R.reduce((a,r)=>a+r.m.found,0)+' из '+R.reduce((a,r)=>a+r.m.nPts,0)+' | '+f2(med(R.map(r=>r.m.med)))+' мм | '+R.filter(r=>r.ok).length+' из '+R.length+' |'); });
  md.push('','Запросов '+log.length+', потрачено ≈ $'+spent.toFixed(3)+' (оценка функции; ProxyAPI считает в рублях со своей наценкой)'+(log.some(l=>l.fallback)?'; запасная модель срабатывала '+log.filter(l=>l.fallback).length+' раз':'')+'.');
  console.log('\n'+md.join('\n')); if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md.join('\n')+'\n');
  fs.writeFileSync(A.out||'scan-ab.json',JSON.stringify({raw,rows:all,log,spent},null,1)); })().catch(e=>{ console.error(e); process.exit(1); });

/* имитация функции: раскладка — рамки частей листа, оцифровка — правда части в px вырезки (вырезка — как SCANPIPE.cut, без поворота) */
function mockFunction(){ const sheets=SHEETS.map(sh=>Q.sheet({n:sh.n,seed:sh.seed,err:sh.err,size:[1500,2000]})); let si=-1, crops=0, boxes=[], R=IMG.rng(5); const n=()=>(R()-0.5)*1.2;
  return new Promise(res=>{ const srv=http.createServer((q,r)=>{ let b=''; q.on('data',d=>b+=d).on('end',()=>{ const j=JSON.parse(b||'{}'), s=sheets[Math.max(0,si)], H=s&&s.truth.H, px=p=>IMG.H.apply(H,p);
      let text='';
      if(j.mode==='layout'){ si++; crops=0; const S=sheets[si], Hh=S.truth.H;
        const bx=S.truth.parts.map(p=>{ const c=[[p.box[0],p.box[1]],[p.box[2],p.box[1]],[p.box[0],p.box[3]],[p.box[2],p.box[3]]].map(v=>IMG.H.apply(Hh,v)); return [Math.min(...c.map(v=>v[0])),Math.min(...c.map(v=>v[1])),Math.max(...c.map(v=>v[0])),Math.max(...c.map(v=>v[1]))].map(v=>Math.round(v*0.4)); });
        boxes=bx.map(b=>b.map(v=>v/0.4));   /* вырезка — по тем же рамкам, что ушли в раскладку (как у страницы) */
        text=JSON.stringify({rot:0,drawings:bx.map((b,i)=>({box:b,part:i+1}))}); }
      else { const i=Math.floor(crops/2), sonnet=j.model==='sonnet'; crops++; const d=boxes[i], pad=Math.max(40,0.05*Math.max(d[2]-d[0],d[3]-d[1])), X0=Math.max(0,Math.round(d[0]-pad)), Y0=Math.max(0,Math.round(d[1]-pad)),
          X1=Math.min(1500,Math.round(d[2]+pad)), Y1=Math.min(2000,Math.round(d[3]+pad)), k=Math.min(1,1280/Math.max(X1-X0,Y1-Y0)), cp=m=>{ const p=px(m); return [Math.round((p[0]-X0)*k+n()),Math.round((p[1]-Y0)*k+n())]; };
        const tr=E.truthOf(s,i); text=Object.entries(tr.pts).map(([l,p])=>'P '+l+' '+cp(p).join(' ')).concat(tr.segs.filter((_,t)=>!sonnet||t%3).map(([a,b])=>'S '+cp(a).concat(cp(b)).join(' '))).join('\n'); }
      r.writeHead(200,{'content-type':'application/json'}); r.end(JSON.stringify({ok:true,text,model:j.model==='sonnet'?'anthropic/claude-sonnet-5-5':'anthropic/claude-opus-5-5',cost:0})); }); }).listen(0,'127.0.0.1',()=>{ MOCK=srv; res('http://127.0.0.1:'+srv.address().port+'/fn'); }); }); }
