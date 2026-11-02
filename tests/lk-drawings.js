/* ═══════════ Кабинет: сканер → «Мои чертежи» → доводка → 3D (lk/drawings/, lk/scan/pipeline.js) ═══════════
   1. Логика (Node): пример ДЗ №3 в.21 → 3D-точки по парам проекций совпадают с таблицей варианта; огрехи примера
      найдены (подпись без штриха, съехавшая S′, не подтверждённая линия) и исправляются; без привязки (px) —
      привязка к варианту вручную пересчитывает копию в мм; подписи A″/A′/A₂/A₁/«A''» разбираются одинаково.
   2. Кабинет в браузере: вкладка «Скан» → пример → копия → доводка («исправить всё») → 3D → разворот в эпюр; без ошибок JS.
   3. Настоящий конвейер сканера (pipeline.js + модули lab/) на синтетическом фото листа: облачная функция подменена
      (ответы модели — точки и отрезки чертежа в px кадра), лист привязывается к ДЗ №3 в.21, в 3D — пирамида SABC.
   node tests/lk-drawings.js — отдельно; в node tests/run.js — тот же прогон. */
const path=require('path'), ROOT=path.join(__dirname,'..');
const D=require(ROOT+'/lk/drawings/model.js'), DEMO=require(ROOT+'/lk/drawings/demo.js');
const LIB={variants:require(ROOT+'/core/dz-variants.js'),dz:require(ROOT+'/core/dz.js'),model:require(ROOT+'/lab/dz/model.js')};
const near=(P,Q,t)=>Math.hypot(P[0]-Q[0],P[1]-Q[1],P[2]-Q[2])<=t;

function logic(){ const bad=[], B=(rule,msg)=>bad.push({name:'Мои чертежи (логика)',rule,msg:String(msg)});
  const L=s=>{ const q=D.parseLabel(s); return q.name+':'+q.pr; };
  [['A″','A:f'],['A′','A:h'],["A''",'A:f'],["A'",'A:h'],['A2','A:f'],['A_1','A:h'],['S₂','S:f'],['1″','1:f'],['А″','A:f'],['A₁″','A₁:f'],['B1′','B₁:h'],['S₄','S:x']].forEach(([s,w])=>{ if(L(s)!==w) B('подпись «'+s+'»',L(s)+' вместо '+w); });
  const dr=D.fromScan(DEMO.make()).drawings[0];
  if(dr.dz!==3||dr.n!==21||dr.approx) B('привязка примера','dz '+dr.dz+', n '+dr.n+', approx '+dr.approx);
  const k=D.issues(dr,LIB).map(i=>i.k); ['nomark','unv','given'].forEach(x=>{ if(!k.includes(x)) B('огрех примера найден: '+x,k.join(',')); });
  D.issues(dr,LIB).filter(i=>i.fix&&['rename','snapGiven','align','addGiven'].includes(i.fix.k)).forEach(i=>D.apply(dr,i.fix)); D.apply(dr,{k:'unvDrop'});
  const left=D.issues(dr,LIB).filter(i=>i.lvl!=='info'); if(left.length) B('после исправлений замечаний нет',left.map(i=>i.t).join('; '));
  const sp=D.space(dr); Object.entries(DEMO.DATA).forEach(([n,P])=>{ if(!sp.pts[n]||!near(sp.pts[n].P,P,1)) B('3D-точка '+n+' по двум проекциям',sp.pts[n]?sp.pts[n].P.map(v=>v.toFixed(2)).join(', '):'нет'); });
  if(sp.edges.length!==6||sp.faces.length!==4) B('пирамида: 6 рёбер, 4 грани',sp.edges.length+' / '+sp.faces.length);
  if(!sp.edges.every(e=>e.both)) B('рёбра подтверждены обеими проекциями',sp.edges.filter(e=>!e.both).map(e=>e.a+e.b).join(','));
  const obj=D.toOBJ(dr); if((obj.match(/^v /gm)||[]).length!==4||(obj.match(/^f /gm)||[]).length!==4) B('OBJ: 4 вершины, 4 грани',obj.slice(0,200));
  if(!/^<svg[\s\S]*<\/svg>$/.test(D.toSVG(dr))) B('SVG копии','не SVG');
  const ref=D.reference(dr,LIB); if(!ref||ref.edges.length<6) B('эталон варианта',ref?ref.edges.length+' рёбер':'нет');
  /* без привязки: px фото → примерные мм; привязка вручную → точные */
  const o=DEMO.make(), d0=o.drawings[0]; d0.fit=null; d0.mm=null;
  const dp=D.fromScan(o).drawings[0]; if(!dp.approx) B('без привязки — примерный масштаб','approx = false');
  if(D.bindVariant(dp,LIB,3,5).ok) B('чужой вариант не привязывается','вариант 5 принят');
  const r=D.bindVariant(dp,LIB,3,21); if(!r.ok||r.rms>1.5) B('привязка к варианту вручную',r.why||('расхождение '+r.rms));
  const s2=D.space(dp); ['A','B'].forEach(n=>{ if(!s2.pts[n]||!near(s2.pts[n].P,DEMO.DATA[n],1.5)) B('после привязки 3D-точка '+n,s2.pts[n]?s2.pts[n].P.map(v=>v.toFixed(1)).join(', '):'нет'); });
  /* сдвиг начала O: 3D сдвигается только по x, фото-привязка — вместе с копией */
  const d3=D.fromScan(DEMO.make()).drawings[0], ph0=d3.ph.slice(), A0=D.space(d3).pts.A.P; D.setOrigin(d3,[10,0]); const A1=D.space(d3).pts.A.P;
  if(Math.abs(A1[0]-A0[0]-10)>1e-6||Math.abs(A1[1]-A0[1])>1e-6) B('начало O: сдвиг по x',A0+' → '+A1);
  const pA=d3.pts[0].at, px=[d3.ph[0]*pA[0]+d3.ph[1]*pA[1]+d3.ph[2],d3.ph[3]*pA[0]+d3.ph[4]*pA[1]+d3.ph[5]], px0=[ph0[0]*(pA[0]+10)+ph0[1]*pA[1]+ph0[2],ph0[3]*(pA[0]+10)+ph0[4]*pA[1]+ph0[5]];
  if(Math.hypot(px[0]-px0[0],px[1]-px0[1])>1e-6) B('начало O: фото под копией не съезжает',px+' / '+px0);
  return bad; }

/* синтетический «снимок»: чертёж примера карандашом на белом листе 1500 × 2000 (5 px/мм), без не подтверждённой линии */
async function ui(browser,URL){ const bad=[], B=(rule,msg)=>bad.push({name:'Мои чертежи (кабинет)',rule,msg:String(msg)});
  const pg=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto(URL+'lk/'); await pg.evaluate(()=>{ try{ localStorage.removeItem('lk_sheets'); }catch(e){} }); await pg.reload(); await pg.waitForTimeout(600);
  await pg.click('.tab[data-tab="check"]'); await pg.waitForSelector('#scDemo');
  await pg.click('#scDemo'); await pg.waitForSelector('#dv.on'); await pg.waitForTimeout(200);
  const n0=await pg.evaluate(()=>document.querySelectorAll('#edSvg circle').length); if(n0<8) B('копия нарисована','точек на копии '+n0);
  /* правка на копии: выбрать точку C и подписать C′ */
  const relabel=await pg.evaluate(()=>{ const p=LKSCAN.dr.pts.find(q=>q.l==='C'); return p&&p.id; });
  await pg.click('.seg3 [data-p="fix"]'); await pg.waitForSelector('[data-auto]'); await pg.click('[data-auto]'); await pg.waitForTimeout(150);
  const after=await pg.evaluate(id=>({l:(LKSCAN.dr.pts.find(q=>q.id===id)||{}).l,iss:DRAWINGS.issues(LKSCAN.dr).filter(i=>i.lvl!=='info').map(i=>i.k)}),relabel);
  if(after.l!=='C′') B('«Исправить всё»: подпись C → C′',after.l); if(after.iss.join()!=='unv') B('после «Исправить всё» остаётся только проверка линий',after.iss.join(','));
  await pg.click('.seg3 [data-p="3d"]'); await pg.waitForTimeout(400);
  const v=await pg.evaluate(()=>{ const c=document.getElementById('v3c'), g=c.getContext('2d'), d=g.getImageData(0,0,c.width,c.height).data; let n=0; for(let i=0;i<d.length;i+=4*7) if(d[i]+d[i+1]+d[i+2]>600) n++; return {w:c.width,h:c.height,n,rows:document.querySelectorAll('.ptab tr').length}; });
  if(v.w<200||v.h<200) B('3D: холст',v.w+'×'+v.h); if(v.n<50) B('3D: тело нарисовано','светлых пикселей '+v.n); if(v.rows!==5) B('3D: таблица точек A, B, C, S',v.rows-1+' строк');
  await pg.click('#v3Unf'); await pg.waitForTimeout(900); const st=await pg.evaluate(()=>LKSCAN.v3.state()); if(Math.abs(st.unfold-1)>1e-6||Math.abs(st.el)>1e-6) B('разворот в эпюр',JSON.stringify(st));
  await pg.click('#dvBack'); await pg.waitForTimeout(200);
  const li=await pg.evaluate(()=>document.querySelectorAll('#myList .my').length); if(li!==1) B('«Мои чертежи»: лист в списке',li);
  /* 3. настоящий конвейер на синтетическом фото, облако подменено */
  const o=DEMO.make(), dm=o.drawings[0], PX=(u,v)=>[u*5+700,v*5+800], box=[250,400,800,1200], pad=40, X0=box[0]-pad, Y0=box[1]-pad;
  const cp=(u,v)=>{ const p=PX(u,v); return [Math.round(p[0]-X0),Math.round(p[1]-Y0)]; };
  const text=dm.mm.pts.map(q=>'P '+q[0]+' '+cp(q[1],q[2]).join(' ')).concat(dm.mm.segs.filter(s=>s.src!=='found').map(s=>'S '+cp(s.p[0],s.p[1]).concat(cp(s.p[2],s.p[3])).join(' ')+(s.dash?' d':''))).join('\n');
  const calls={layout:0,crop:0,crop2:0}, ans={crop:text,crop2:text};
  await pg.route(/functions\.yandexcloud\.net/,async r=>{ const q=r.request(); if(q.method()==='GET') return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"scan":true,"codeOk":true}'});
    const b=JSON.parse(q.postData()||'{}'); calls[b.mode]=(calls[b.mode]||0)+1;
    const k=800/2000, t=b.mode==='layout'?JSON.stringify({rot:0,drawings:[{box:box.map(v=>Math.round(v*k)),part:1}]}):ans[b.mode];
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,text:t,mode:b.mode,cost:0})}); });
  await pg.evaluate(()=>{ localStorage.setItem('scanCode','тест'); }); await pg.reload(); await pg.waitForTimeout(500); await pg.click('.tab[data-tab="check"]');
  const segs=dm.mm.segs.filter(s=>!s.unverified).map(s=>({a:PX(s.p[0],s.p[1]),b:PX(s.p[2],s.p[3]),dash:s.dash}));
  const scanOnce=prec=>pg.evaluate(async([segs,prec])=>{ localStorage.setItem('lk_scanPrec',prec); document.getElementById('scPrec').value=prec; const c=document.createElement('canvas'); c.width=1500; c.height=2000; const g=c.getContext('2d'); g.fillStyle='#f4f2ec'; g.fillRect(0,0,1500,2000); g.strokeStyle='#3a3a3a'; g.lineWidth=3; g.lineCap='round';
      segs.forEach(s=>{ g.setLineDash(s.dash?[18,9]:[]); g.beginPath(); g.moveTo(s.a[0],s.a[1]); g.lineTo(s.b[0],s.b[1]); g.stroke(); });
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9)), f=new File([blob],'лист.jpg',{type:'image/jpeg'});
      await LKSCAN.scan(f); const dr=LKSCAN.dr; if(!dr) return {err:document.getElementById('scSteps').textContent};
      DRAWINGS.issues(dr).filter(i=>i.fix&&i.fix.k==='rename').forEach(i=>DRAWINGS.apply(dr,i.fix));   /* «C» без штриха → C′ */
      const sp=DRAWINGS.space(dr); return {dz:dr.dz,n:dr.n,rms:dr.rms,approx:dr.approx,pts:Object.fromEntries(Object.values(sp.pts).map(p=>[p.name,p.P])),edges:sp.edges.length,unv:dr.segs.filter(s=>s.unv).length,ph:!!dr.ph,photo:!!document.getElementById('edPhoto'),
        segs:dr.segs.map(s=>[(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2]),labels:dr.pts.map(p=>p.l),steps:document.getElementById('scSteps').textContent}; },[segs,prec]);
  const res=await scanOnce('auto');
  if(res.err) B('конвейер сканера на синтетическом фото',res.err.slice(0,240));
  else { if(res.dz!==3||res.n!==21) B('конвейер: привязка к ДЗ №3 в.21','ДЗ '+res.dz+' в.'+res.n);
    ['A','B','C','S'].forEach(n=>{ if(!res.pts[n]||!near(res.pts[n],DEMO.DATA[n],3)) B('конвейер: 3D-точка '+n,res.pts[n]?res.pts[n].map(v=>v.toFixed(1)).join(', '):'нет'); });
    if(res.edges!==6) B('конвейер: 6 рёбер пирамиды',res.edges); if(!res.ph) B('конвейер: привязка фото к копии','нет');
    if(calls.layout!==1||calls.crop!==1||calls.crop2!==0) B('конвейер: хорошая первая оцифровка — без второй проверки',JSON.stringify(calls)); }
  /* 3б. «максимальная точность»: первая модель пропустила рёбра SA и точку S′, вторая их нашла — и выдумала линию, которой на бумаге нет */
  { const fakeMm=[[-75,25],[-60,45]], fake='S '+cp(...fakeMm[0]).concat(cp(...fakeMm[1])).join(' '), sa=new Set(['S″','S′']);
    const lack=dm.mm.segs.filter(s=>s.src!=='found').filter(s=>{ const hit=q=>dm.mm.pts.some(p=>sa.has(p[0])&&Math.hypot(p[1]-q[0],p[2]-q[1])<0.6), A=dm.mm.pts.filter(p=>/^A/.test(p[0]));
      return hit([s.p[0],s.p[1]])&&A.some(p=>Math.hypot(p[1]-s.p[2],p[2]-s.p[3])<0.6)||hit([s.p[2],s.p[3]])&&A.some(p=>Math.hypot(p[1]-s.p[0],p[2]-s.p[1])<0.6); });
    const key=s=>'S '+cp(s.p[0],s.p[1]).concat(cp(s.p[2],s.p[3])).join(' '), miss=new Set(lack.map(key));
    ans.crop=text.split('\n').filter(l=>!miss.has(l.replace(/ d$/,''))&&!/^P S′ /.test(l)).join('\n'); ans.crop2=text+'\n'+fake;
    Object.assign(calls,{layout:0,crop:0,crop2:0}); const r=await scanOnce('max');
    if(r.err) B('две модели: конвейер',r.err.slice(0,240));
    else { if(lack.length!==2) B('две модели: в ответе первой модели нет рёбер SA','убрано '+lack.length);
      if(calls.crop2!==1) B('две модели: «максимальная» — вторая проверка',JSON.stringify(calls));
      if(!r.labels.includes('S′')) B('две модели: точку S′ добавила вторая модель',r.labels.join(' '));
      if(r.edges!==6) B('две модели: пирамида целиком (6 рёбер) — пропущенное первой нашла вторая',r.edges);
      const fm=[(fakeMm[0][0]+fakeMm[1][0])/2,(fakeMm[0][1]+fakeMm[1][1])/2]; if(r.segs.some(m=>Math.hypot(m[0]-fm[0],m[1]-fm[1])<3)) B('две модели: выдуманная второй моделью линия отброшена по карандашу','осталась');
      if(!/Sonnet|вторая модель добавила/.test(r.steps)&&!/добавила/.test(r.steps)) B('две модели: ход работы говорит о второй проверке',r.steps.slice(0,200)); } }
  /* 3в. «авто»: первая оцифровка слабая (не привязалась к варианту — мало точек условия) → вторая проверка сама */
  { ans.crop=text.split('\n').filter(l=>!/^P [BCS]/.test(l)).join('\n'); ans.crop2=text; Object.assign(calls,{layout:0,crop:0,crop2:0}); const r=await scanOnce('auto');
    if(r.err) B('авто: конвейер',r.err.slice(0,240));
    else { if(calls.crop2!==1) B('авто: слабая первая оцифровка → вторая проверка',JSON.stringify(calls)); if(r.dz!==3||r.n!==21) B('авто: после второй проверки — привязка к ДЗ №3 в.21','ДЗ '+r.dz+' в.'+r.n); } }
  /* 3г. «быстро»: одна модель, даже если слабая */
  { Object.assign(calls,{layout:0,crop:0,crop2:0}); await scanOnce('fast'); if(calls.crop2!==0) B('быстро: без второй проверки',JSON.stringify(calls)); ans.crop=text; ans.crop2=text; }
  /* бета-страница lk/scan/ — на том же конвейере; её результат уходит в «Мои чертежи» кабинета */
  const bp=await browser.newPage(); const be=[]; bp.on('pageerror',e=>be.push(String(e)));
  await bp.route(/functions\.yandexcloud\.net/,async r=>{ const q=r.request(); if(q.method()==='GET') return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"scan":true}'});
    const b=JSON.parse(q.postData()||'{}'), t=b.mode==='layout'?JSON.stringify({rot:0,drawings:[{box:box.map(v=>Math.round(v*0.4)),part:1}]}):text;
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,text:t,mode:b.mode,cost:0})}); });
  await bp.goto(URL+'lk/scan/'); await bp.evaluate(()=>localStorage.setItem('scanCode','тест')); await bp.reload(); await bp.waitForTimeout(800); const okb=await bp.evaluate(()=>!!(self.SCANPIPE&&self.LAB&&self.LAB.sheetlib&&self.LAB.refine&&window.__beta));
  if(!okb) B('бета-страница lk/scan/ загрузила конвейер','нет');
  else { const n0=await bp.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('lk_sheets')||'[]').length; }catch(e){ return 0; } });
    const got=await bp.evaluate(async segs=>{ const c=document.createElement('canvas'); c.width=1500; c.height=2000; const g=c.getContext('2d'); g.fillStyle='#f4f2ec'; g.fillRect(0,0,1500,2000); g.strokeStyle='#3a3a3a'; g.lineWidth=3;
        segs.forEach(s=>{ g.setLineDash(s.dash?[18,9]:[]); g.beginPath(); g.moveTo(s.a[0],s.a[1]); g.lineTo(s.b[0],s.b[1]); g.stroke(); });
        const f=new File([await new Promise(r=>c.toBlob(r,'image/jpeg',0.9))],'лист.jpg',{type:'image/jpeg'}); const R=await window.__beta.run(f); return R&&R.out&&R.out.drawings.length; },segs);
    if(got!==1) B('бета-страница: оцифровка синтетического фото',got);
    else { await Promise.all([bp.waitForNavigation(),bp.click('#toLk')]); await bp.waitForTimeout(600);
      const after=await bp.evaluate(()=>({n:document.querySelectorAll('#myList .my').length,on:document.getElementById('v-check').classList.contains('on'),hash:location.hash}));
      if(after.n!==n0+1||!after.on) B('бета → «Мои чертежи»: лист в кабинете, вкладка «Скан»',JSON.stringify(after)); } }
  be.forEach(e=>B('lk/scan/: ошибка JS',e.slice(0,200))); await bp.close();
  errs.forEach(e=>B('ошибка JS',e.slice(0,200))); await pg.close();
  return {bad,res}; }

async function runLk(browser,URL){ const a=logic(), b=await ui(browser,URL); return {bad:a.concat(b.bad),res:b.res}; }
module.exports={runLk,logic};

if(require.main===module){ const http=require('http'), fs=require('fs');
  const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
  let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); })
    .listen(0,'127.0.0.1',async()=>{ const br=await chromium.launch(); const {bad,res}=await runLk(br,'http://127.0.0.1:'+srv.address().port+'/'); await br.close(); srv.close();
      if(res&&!res.err) console.log('Конвейер на синтетическом фото: ДЗ №'+res.dz+' в.'+res.n+', невязка '+res.rms+' мм, рёбер '+res.edges+', не подтверждено линий '+res.unv);
      bad.forEach(b=>console.log('✗ '+b.name+' · '+b.rule+': '+b.msg)); console.log(bad.length?'Замечаний: '+bad.length:'Мои чертежи: ошибок нет'); process.exit(bad.length?1:0); }); }
