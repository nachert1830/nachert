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
  /* постановка подписанных точек (lab/dz/refine.js placePoints): на перекрёсток линий по МНК, обе догадки моделей — кандидаты */
  { const RF=require(ROOT+'/lab/dz/refine.js'), MG=require(ROOT+'/lk/scan/merge.js'), ppm=5;
    const segs=[[50,100,150,100],[100,40,100,160],[60,60,140,140],[40,300,200,300],[100,250,100,320]];   /* три линии через (100, 100); две — через (100, 300) */
    const r=RF.placePoints([['A″',103,98],['B′',104,302],['C″',120,180],['D′',140,301.5],['E″',100+4.5*ppm,100]],segs,{ppm});
    const at=l=>r.find(q=>q[0]===l), d=(q,x,y)=>Math.hypot(q[1]-x,q[2]-y);
    if(d(at('A″'),100,100)>0.05||at('A″')[4]!==3) B('точка — на перекрёсток трёх линий (МНК)',at('A″').slice(1).map(v=>+v.toFixed(2)).join(', '));
    if(d(at('B′'),100,300)>0.05||at('B′')[4]!==2) B('точка — на перекрёсток двух линий',at('B′').slice(1).map(v=>+v.toFixed(2)).join(', '));
    if(d(at('C″'),120,180)>1e-9) B('точка вдали от линий не трогается',at('C″').join(', '));
    if(Math.abs(at('D′')[2]-300)>0.05||Math.abs(at('D′')[1]-140)>0.05) B('точка у одной линии — поперёк на неё, вдоль не трогается',at('D′').join(', '));
    if(d(at('E″'),100,100)<1) B('дальний перекрёсток (4,5 мм) без догадки рядом не берётся',at('E″').join(', '));
    const r2=RF.placePoints([['E″',100+4.5*ppm,100]],segs,{ppm,alts:new Map([['E″',[[100+4.5*ppm,100],[101,99]]]])});
    if(d(r2[0],100,100)>0.05) B('догадка второй модели у перекрёстка — точка на нём',r2[0].join(', '));
    const m=MG.merge({pts:[['A″',10,10]],segs:[]},{pts:[['A″',30,10],["B'",5,5]],segs:[]},{ppm});
    if(!m.alts.get('A″')||m.alts.get('A″').length!==2||m.P.pts.find(q=>q[0]==='A″')[1]!==10) B('слияние: при споре моделей остаётся первая, обе догадки — в alts',JSON.stringify([...m.alts]));
    /* штрихи: A″ дважды и нет A′ — верхняя ″, нижняя ′; есть обе подписи — не трогать */
    const fp=MG.fixPrimes([['A″',10,50],['A″',12,90],['B″',30,40],['B′',30,80],['B″',60,20]]);
    if(fp.pts[0][0]!=='A″'||fp.pts[1][0]!=='A′'||fp.fixed.join()!=='A'||fp.pts[4][0]!=='B″') B('одинаковые подписи двух проекций → ″ сверху, ′ снизу',JSON.stringify(fp));
    /* привязка к варианту (lab/dz/sheetlib.js): лишняя точка с той же подписью; безосный эпюр (′ сдвинуты на 7 мм) */
    const SL=require(ROOT+'/lab/dz/sheetlib.js'), gv=LIB.variants.get(3,18), G=LIB.model.given(gv.id,gv.data).pts, k=4;
    const txt=(dl,extra)=>G.map(q=>'P '+q.l+' '+Math.round((100+q.at[0]*k)*10)/10+' '+Math.round((300+(q.at[1]+(q.pr==='h'?dl:0))*k)*10)/10).concat(extra||[]).join('\n');
    const f0=SL.fitVariant(txt(0),'auto',3), f1=SL.fitVariant(txt(-7),'auto',3), f2=SL.fitVariant(txt(0,['P A″ 40 40']),'auto',3);
    if(!f0||f0.n!==18||f0.inl!==8||f0.free!=null) B('привязка: вариант 18 по 8 точкам, без сдвига',JSON.stringify(f0&&{n:f0.n,inl:f0.inl,free:f0.free}));
    if(!f1||f1.n!==18||f1.inl!==8||Math.abs(f1.free+7)>0.3) B('безосный эпюр: горизонтальная проекция ближе на 7 мм — вариант 18, сдвиг −7',JSON.stringify(f1&&{n:f1.n,inl:f1.inl,free:f1.free}));
    if(!f2||f2.n!==18||f2.inl!==8) B('повтор подписи (точка построения тоже «A″») — привязка по верной',JSON.stringify(f2&&{n:f2.n,inl:f2.inl}));
    /* точки условия без подписей: пирамида варианта среди вершин линий, ′ сдвинуты на 6 мм, масштаб на 8 % меньше */
    const sc=k*0.92, P=q=>[100+q.at[0]*sc,300+(q.at[1]+(q.pr==='h'?-6:0))*sc], by=Object.fromEntries(G.map(q=>[q.l,P(q)])), E=[];
    ['A','B','C','S'].forEach(a=>['B','C','S'].forEach(b=>{ if(a<b) ['″','′'].forEach(p=>E.push(by[a+p].concat(by[b+p]))); }));
    ['A','B','C','S'].forEach(a=>{ const f=by[a+'″'], h=by[a+'′']; E.push([f[0],f[1]-20,h[0],h[1]+20]); });
    const mg=RF.matchGiven(E,G.map(q=>({l:q.l,pr:q.pr,at:q.at})),{ppm:k}), me=mg?Math.max(...mg.pts.map(([l,x,y])=>Math.hypot(x-by[l][0],y-by[l][1]))):null;
    /* проверка по результату (lk/scan/verify.js): эталон в.14 — как у мозга сканера (H 29,3 мм, угол граней 54,1°, угол SA 35°) */
    { const VF=require(ROOT+'/lk/scan/verify.js'), r=VF.ref(LIB.variants.get(3,14).data);
      if(Math.abs(r.H-29.3)>0.05||Math.abs(r.dih-54.1)>0.05||Math.abs(r.phi-35)>0.05) B('эталон варианта 14 (H, угол граней, угол SA)',[r.H,r.dih,r.phi].map(v=>v.toFixed(2)).join(', '));
      const fam=(h,suf)=>[['A'+suf,0,0],['B'+suf,40,0],['C'+suf,70,0],['S'+suf,30,-h]], a=VF.verify(fam(r.H,'‴'),LIB.variants.get(3,14).data), b=VF.verify(fam(r.H+4,'₄'),LIB.variants.get(3,14).data);
      if(a.verdict!=='верно'||a.found[0].k!=='H') B('высота по проекции «основание ребром» (подписи ‴) — верно',JSON.stringify(a.found));
      if(b.verdict!=='расходится с эталоном') B('высота на 4 мм больше (подписи ₄) — расходится',b.verdict);
      const t=[['A⁗',0,0],['B⁗',r.sides.AB,0]], ang=Math.acos((r.sides.AB**2+r.sides.CA**2-r.sides.BC**2)/(2*r.sides.AB*r.sides.CA)); t.push(['C⁗',r.sides.CA*Math.cos(ang),r.sides.CA*Math.sin(ang)]);
      const c=VF.verify(t,LIB.variants.get(3,14).data), d=VF.verify(t.map(q=>q[0]==='C⁗'?[q[0],q[1]+4,q[2]]:q),LIB.variants.get(3,14).data);
      if(c.verdict!=='верно') B('истинный вид ABC (подписи ⁗) — верно',c.verdict);
      if(d.verdict==='расходится с эталоном') B('истинный вид с неверной стороной — «не уверен», не обвинение',d.verdict);
      if(VF.verify([['A″',0,0],['B″',40,0],['C″',70,0],['S″',30,-r.H]],LIB.variants.get(3,14).data).found.length) B('проекции ″ и ′ — не результат построения','нашлось');
      /* вид построения как проекция пирамиды: точный произвольный вид (подписи ⁗) — «верно»; S сдвинута на 8 мм — не «верно» */
      const D=LIB.variants.get(3,14).data, th=0.7, ph=1.1, R=[[Math.cos(th),Math.sin(th),0],[-Math.sin(th)*Math.cos(ph),Math.cos(th)*Math.cos(ph),Math.sin(ph)]], pr=x=>[R[0][0]*x[0]+R[0][1]*x[1]+R[0][2]*x[2]+12,R[1][0]*x[0]+R[1][1]*x[1]+R[1][2]*x[2]-30];
      const vw=['A','B','C','S'].map(k=>[k+'⁗'].concat(pr(D[k]))), g1=VF.verify(vw,D).found.find(f=>/^view:/.test(f.k)), g2=VF.verify(vw.map(q=>q[0]==='S⁗'?[q[0],q[1]+8,q[2]]:q),D).found.find(f=>/^view:/.test(f.k));
      if(!g1||g1.st!=='верно'||g1.got>0.05) B('вид построения — точная проекция пирамиды → верно',JSON.stringify(g1));
      if(g2&&g2.st==='верно') B('вид с точкой S не на месте (8 мм) — не «верно»',JSON.stringify(g2)); }
    if(!mg||mg.inl!==8||me>0.5||Math.abs(mg.shift+6)>0.6) B('точки условия по форме (без подписей): 8 из 8, сдвиг проекций −6 мм',JSON.stringify(mg&&{inl:mg.inl,shift:mg.shift,maxErr:me}));
  }
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
  /* ответ — в px кадра модели: вырезка (рамка + поле) у страницы увеличивается для модели (SCANPIPE.VIEW), масштаб — по ширине присланного кадра */
  const CW=box[2]-box[0]+2*pad, inFrame=(t,w)=>{ const k=w/CW; return String(t).split('\n').map(l=>{ const a=l.split(' '), idx=a[0]==='P'?[2,3]:a[0]==='S'?[1,2,3,4]:[]; idx.forEach(i=>{ a[i]=String(Math.round(+a[i]*k*10)/10); }); return a.join(' '); }).join('\n'); };
  let closeAns=null;   /* 3ж: снимки вблизи — ответ по кадру (какой снимок — по пропорциям кадра модели) */
  await pg.route(/functions\.yandexcloud\.net/,async r=>{ const q=r.request(); if(q.method()==='GET') return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"scan":true,"codeOk":true}'});
    const b=JSON.parse(q.postData()||'{}'); calls[b.mode]=(calls[b.mode]||0)+1;
    const k=800/2000, t=b.mode==='layout'?JSON.stringify({rot:0,drawings:[{box:box.map(v=>Math.round(v*k)),part:1}]}):closeAns?closeAns(b):inFrame(ans[b.mode],b.w);
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
  /* 3д. кадр модели и полпикселя: ответ из увеличенного кадра → px вырезки; линия на canvas (координаты от края пикселя) после
     притяжки к карандашу лежит там, где нарисована, — без сдвига на полпикселя */
  { const t=await pg.evaluate(()=>{ const P=SCANPIPE, st=P.scaleText('P A″ 10 20\nS 1 2 3 4 d\nR 10 10 5 30 60\nC 2 4 6\nT 8 9 φ=25°',2);
      const c=document.createElement('canvas'); c.width=700; c.height=500; const g=c.getContext('2d'); g.fillStyle='#f4f2ec'; g.fillRect(0,0,700,500); g.strokeStyle='#333'; g.lineWidth=2.4;
      const L=[[60,120,640,120],[60,380,640,380],[150,40,150,460],[550,40,550,460],[150,120,550,380]]; L.forEach(q=>{ g.beginPath(); g.moveTo(q[0],q[1]); g.lineTo(q[2],q[3]); g.stroke(); });
      const cr=P.cut(c,[60,40,640,460],0,40,2000,P.VIEW), s=cr.m.s, off=(x,y)=>[(x-cr.A[2])*s,(y-cr.A[5])*s];
      const txt=['P A″ 150 120','P B″ 550 120','P A′ 150 380','P B′ 550 380'].map(l=>{ const a=l.split(' '), q=off(+a[2]+1.2,+a[3]-1.1); return a[0]+' '+a[1]+' '+q.join(' '); })
        .concat(L.map(q=>{ const a=off(q[0]+1,q[1]+1.3), b=off(q[2]-0.8,q[3]+1.2); return 'S '+a.concat(b).join(' '); })).join('\n');
      const R=P.digest(cr,txt,null,{W:700,H:500,vSel:'auto',dzSel:null,rot:0,d:{box:[60,40,640,460]}});
      const h=R.dr.segs.filter(q=>Math.abs(q.p[1]-q.p[3])<1).map(q=>(q.p[1]+q.p[3])/2), v=R.dr.segs.filter(q=>Math.abs(q.p[0]-q.p[2])<1).map(q=>(q.p[0]+q.p[2])/2);
      return {st,s,h,v,pts:R.dr.pts}; });
    if(t.st!=='P A″ 20 40\nS 2 4 6 8 d\nR 20 20 10 30 60\nC 4 8 12\nT 16 18 φ=25°') B('ответ из кадра модели → px вырезки (углы дуг не масштабируются)',JSON.stringify(t.st));
    if(!(t.s>1.2)) B('мелкий чертёж увеличен для модели','масштаб '+t.s);
    const eh=t.h.map(y=>Math.min(Math.abs(y-120),Math.abs(y-380))), ev=t.v.map(x=>Math.min(Math.abs(x-150),Math.abs(x-550)));
    if(t.h.length<2||t.v.length<2||Math.max(...eh,...ev)>0.25) B('линии после притяжки — на месте, без сдвига на полпикселя','горизонтали '+t.h.map(v=>v.toFixed(2))+'; вертикали '+t.v.map(v=>v.toFixed(2)));
    const ex={'A″':[150,120],'B″':[550,120],'A′':[150,380],'B′':[550,380]}, ep=t.pts.map(q=>ex[q[0]]?Math.hypot(q[1]-ex[q[0]][0],q[2]-ex[q[0]][1]):0);
    if(t.pts.length!==4||Math.max(...ep)>0.3) B('точки — на перекрёстках нарисованных линий','промах, px: '+ep.map(v=>v.toFixed(2)).join(', '));
    /* голос листа: три чертежа за вариант 18 — победитель с масштабом листа; один чертёж ничего не решает */
    const sv=await pg.evaluate(()=>{ const f=(n,inl,rms,ppm)=>({fit:{dz:3,n,inl,rmsMm:rms},ppm}); return [SCANPIPE.sheetVariant([f(17,4,0.2,2.4),f(18,8,0.4,2.4),f(18,8,0.3,2.7),f(18,8,0.3,2.7)]),SCANPIPE.sheetVariant([f(5,8,0.4,2.5),f(8,4,0.1,2.5),{error:'x'}])]; });
    if(!sv[0]||sv[0].n!==18||Math.abs(sv[0].ppm-2.7)>1e-9||sv[1]!==null) B('голос листа: вариант большинства и масштаб; один чертёж — не голос',JSON.stringify(sv)); }
  /* 3е. живой сканер (lk/scan/live.js) без камеры: лист на столе под углом — углы уточняются до пикселей, ровный лист без стола */
  { const t=await pg.evaluate(async()=>{ if(!self.LIVESCAN) return {err:'нет LIVESCAN'}; await LIVESCAN.load();
      const c=document.createElement('canvas'); c.width=1200; c.height=1600; const g=c.getContext('2d'); g.fillStyle='#5a4030'; g.fillRect(0,0,1200,1600);
      const Q=[[180,230],[1010,150],[1080,1420],[230,1500]]; g.fillStyle='#eeeeea'; g.beginPath(); Q.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.fill();
      g.strokeStyle='#333'; g.lineWidth=3; g.beginPath(); g.moveTo(400,600); g.lineTo(800,900); g.stroke();
      const rough=Q.map((p,i)=>[p[0]+[14,-12,-15,10][i],p[1]+[12,15,-11,-14][i]]), r=LIVESCAN.refineQuad(c,rough), err=Math.max(...r.map((p,i)=>Math.hypot(p[0]-Q[i][0],p[1]-Q[i][1])));
      const f=LIVESCAN.rectify(c,LIVESCAN.sheetQuad(c,rough),1000), d=f.getContext('2d').getImageData(0,0,f.width,f.height).data; let dark=0; for(let i=0;i<d.length;i+=4*7) if(d[i]<160&&d[i]-d[i+2]>25) dark++;
      return {err,w:f.width,h:f.height,brown:dark}; });
    if(t.err&&typeof t.err==='string') B('живой сканер загрузился',t.err);
    else { if(!(t.err<=3)) B('живой сканер: углы листа уточнены до пикселей (≤ 3 px на 1600)','промах угла '+t.err.toFixed(1)+' px');
      if(!(t.h>t.w&&t.h<=1000)) B('живой сканер: ровный лист нужного размера',t.w+'×'+t.h); if(t.brown>40) B('живой сканер: на ровном листе нет стола','тёмно-бурых точек '+t.brown); } }
  /* 3г. «быстро»: одна модель, даже если слабая */
  { Object.assign(calls,{layout:0,crop:0,crop2:0}); await scanOnce('fast'); if(calls.crop2!==0) B('быстро: без второй проверки',JSON.stringify(calls)); ans.crop=text; ans.crop2=text; }
  /* 3ж. «чертёж за чертежом» (pipeline.runMany): два снимка вблизи, на каждом — чертёж во весь кадр (9 и 8 px/мм, разные
     пропорции); раскладки нет, оба чертежа — к в.21, один лист, у второго чертежа — свой снимок под копией */
  { const SH=[{W:1500,H:2000,s:9,o:[1100,1000]},{W:1800,H:1400,s:8,o:[1200,700]}], P=(c,u,v)=>[u*c.s+c.o[0],v*c.s+c.o[1]];
    const txtOf=c=>dm.mm.pts.map(q=>'P '+q[0]+' '+P(c,q[1],q[2]).map(Math.round).join(' ')).concat(dm.mm.segs.filter(s=>s.src!=='found').map(s=>'S '+P(c,s.p[0],s.p[1]).concat(P(c,s.p[2],s.p[3])).map(Math.round).join(' ')+(s.dash?' d':''))).join('\n');
    closeAns=b=>{ const c=SH.slice().sort((x,y)=>Math.abs(x.W/x.H-b.w/b.h)-Math.abs(y.W/y.H-b.w/b.h))[0]; return inFrame(txtOf(c),b.w*CW/c.W); };   /* вырезка — весь снимок */
    const shots=SH.map(c=>({W:c.W,H:c.H,segs:dm.mm.segs.filter(s=>!s.unverified).map(s=>({a:P(c,s.p[0],s.p[1]),b:P(c,s.p[2],s.p[3]),dash:s.dash}))}));
    Object.assign(calls,{layout:0,crop:0,crop2:0});
    const r=await pg.evaluate(async shots=>{ localStorage.setItem('lk_scanPrec','fast'); document.getElementById('scPrec').value='fast'; const n0=LKSCAN.list().length;
      const files=await Promise.all(shots.map(async(s,i)=>{ const c=document.createElement('canvas'); c.width=s.W; c.height=s.H; const g=c.getContext('2d'); g.fillStyle='#f4f2ec'; g.fillRect(0,0,s.W,s.H); g.strokeStyle='#3a3a3a'; g.lineWidth=3.5; g.lineCap='round';
        s.segs.forEach(q=>{ g.setLineDash(q.dash?[24,12]:[]); g.beginPath(); g.moveTo(q.a[0],q.a[1]); g.lineTo(q.b[0],q.b[1]); g.stroke(); });
        return new File([await new Promise(r=>c.toBlob(r,'image/jpeg',0.9))],'чертёж-'+(i+1)+'.jpg',{type:'image/jpeg'}); }));
      await LKSCAN.scanMany(files); const sh=LKSCAN.list()[0]; if(LKSCAN.list().length!==n0+1) return {err:document.getElementById('scSteps').textContent};
      document.querySelector('#dvParts [data-di="1"]').click(); await new Promise(r=>setTimeout(r,500));
      const one=await SCANPIPE.create({cloud:self.SCAN_API,code:'тест'}).run(files[1],{single:true,precision:'fast'});
      return {n:sh.drawings.length,v:sh.drawings.map(d=>d.dz+':'+d.n),photo:sh.drawings.map(d=>d.photo),ks:(sh.photoKs||[]).length,ph:sh.drawings.map(d=>!!d.ph),cur:LKSCAN.dr.photo,btn:!document.getElementById('edPhoto').hidden,
        one:{n:one.out.drawings.length,box:one.out.drawings[0].box,fit:one.out.drawings[0].fit&&one.out.drawings[0].fit.n,single:one.out.layout.single}}; },shots);
    closeAns=null; await pg.evaluate(()=>{ localStorage.setItem('lk_scanPrec','auto'); document.getElementById('scPrec').value='auto'; });
    if(r.err) B('чертёж за чертежом: лист сохранён',r.err.slice(0,240));
    else { if(calls.layout!==0) B('чертёж за чертежом: без запроса раскладки',JSON.stringify(calls));
      if(calls.crop!==3) B('чертёж за чертежом: по запросу на снимок (2 + 1 для run single)',JSON.stringify(calls));
      if(r.n!==2||r.v.join()!=='3:21,3:21') B('чертёж за чертежом: два чертежа, оба к ДЗ №3 в.21',r.n+' · '+r.v.join(' '));
      if(r.photo.join()!=='0,1'||r.ks!==2) B('чертёж за чертежом: у чертежа — номер своего снимка, у листа — масштабы двух миниатюр',r.photo.join()+' · '+r.ks);
      if(!r.ph.every(Boolean)||r.cur!==1||!r.btn) B('чертёж за чертежом: «фото под копией» у второго чертежа — его снимок',JSON.stringify({ph:r.ph,cur:r.cur,btn:r.btn}));
      if(r.one.n!==1||r.one.box.join()!=='0,0,1800,1400'||r.one.fit!==21||!r.one.single) B('run(single): один чертёж во весь кадр без раскладки',JSON.stringify(r.one)); }
    await pg.evaluate(()=>{ const b=document.getElementById('dvBack'); if(document.getElementById('dv').classList.contains('on')) b.click(); }); await pg.waitForTimeout(200); }
  /* бета-страница lk/scan/ — на том же конвейере; её результат уходит в «Мои чертежи» кабинета */
  const bp=await browser.newPage(); const be=[]; bp.on('pageerror',e=>be.push(String(e)));
  await bp.route(/functions\.yandexcloud\.net/,async r=>{ const q=r.request(); if(q.method()==='GET') return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"scan":true}'});
    const b=JSON.parse(q.postData()||'{}'), t=b.mode==='layout'?JSON.stringify({rot:0,drawings:[{box:box.map(v=>Math.round(v*0.4)),part:1}]}):inFrame(text,b.w);
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
