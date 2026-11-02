/* ═══════════ Конвейер оцифровки листа (общий для lk/scan/ и кабинета lk/) ═══════════
   Фото → раскладка (где чертежи, поворот) → оцифровка каждого чертежа моделью → уточнение линий по карандашу
   (lab/dz/refine.js) → привязка к условию варианта (lab/dz/sheetlib.js) → копия в мм листа.
   SCANPIPE.LIBS            — модули сканера, порядок как в lab/dz/worker.js (грузить до run);
   SCANPIPE.load(v)         — подгрузить их по одному (кабинет: по требованию, не при открытии);
   SCANPIPE.create(o)       — {cloud: адрес облачной функции | '', api: адрес беты (lab/dz/beta-server.js), code, pass}
     .status()              → ответ сервера о готовности;
     .run(file, {dz, variant}, step) → {out, bmp}; step(id, текст, 'run'|'done'|'err') — ход работы для страницы.
   Формат out — как у кнопки «Скачать JSON» беты: {name, size, layout, drawings:[{part, box, rot, mm, circles, fit, txt, pts, segs, stats}], cost, calls, seconds}. */
(function(){
'use strict';
const LIBS=['/core/dz.js','/core/dz-variants.js','/lab/img.js','/lab/clean.js','/lab/font.js','/lab/sheets.js','/lab/rectify.js','/lab/lines.js',
 '/lab/dz/sheet.js','/lab/dz/locate.js','/lab/dz/digitize.js','/lab/dz/model.js','/lab/dz/model3.js','/lab/dz/calib.js','/lab/dz/check2.js','/lab/dz/check3.js','/lab/dz/explain2.js','/lab/dz/report2.js','/lab/dz/check.js','/lab/dz/grid.js','/lab/dz/given.js','/lab/dz/explain3d.js','/lab/dz/report3d.js','/lab/dz/paper.js','/lab/dz/gridsheet.js','/lab/dz/series.js','/lab/dz/refine.js','/lab/dz/eyes.js','/lab/dz/layout.js','/lab/dz/sheetlib.js','/lk/scan/merge.js'];

let loading=null;
function load(v){ if(self.LAB&&self.LAB.sheetlib&&self.LAB.layout&&self.LAB.refine&&self.SCANMERGE) return Promise.resolve();
  if(loading) return loading;
  loading=LIBS.reduce((p,src)=>p.then(()=>new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src+'?v='+(v||'lk1'); s.async=false;
    s.onload=res; s.onerror=()=>rej(new Error('не загрузился модуль сканера '+src)); document.head.appendChild(s); })),Promise.resolve());
  loading.catch(()=>{ loading=null; }); return loading; }

function scaled(bmp,side){ const k=Math.min(1,side/Math.max(bmp.width,bmp.height)), c=document.createElement('canvas'); c.width=Math.round(bmp.width*k); c.height=Math.round(bmp.height*k); c.getContext('2d').drawImage(bmp,0,0,c.width,c.height); return {c,k}; }
/* вырезка чертежа: рамка + поле, поворот по часовой на rot, длинная сторона ≤ side; A — (u,v) вырезки → (x,y) фото (как lab/dz/tools/crop.py) */
function cut(bmp,box,rot,pad,side){ const W=bmp.width,H=bmp.height, X0=Math.max(0,Math.round(box[0]-pad)), Y0=Math.max(0,Math.round(box[1]-pad)), X1=Math.min(W,Math.round(box[2]+pad)), Y1=Math.min(H,Math.round(box[3]+pad)), cw=X1-X0, ch=Y1-Y0;
  const sw=(rot===90||rot===270)?ch:cw, sh=(rot===90||rot===270)?cw:ch, r=document.createElement('canvas'); r.width=sw; r.height=sh; const g=r.getContext('2d');
  if(rot===90){ g.translate(ch,0); g.rotate(Math.PI/2); } else if(rot===180){ g.translate(cw,ch); g.rotate(Math.PI); } else if(rot===270){ g.translate(0,cw); g.rotate(-Math.PI/2); }
  g.drawImage(bmp,X0,Y0,cw,ch,0,0,cw,ch); const k=Math.min(1,side/Math.max(sw,sh)), c=document.createElement('canvas'); c.width=Math.round(sw*k); c.height=Math.round(sh*k); c.getContext('2d').drawImage(r,0,0,c.width,c.height);
  const M={0:[1,0,0,0,1,0],90:[0,1,0,-1,0,ch],180:[-1,0,cw,0,-1,ch],270:[0,-1,cw,1,0,0]}[rot], A=[M[0]/k,M[1]/k,M[2]+X0,M[3]/k,M[4]/k,M[5]+Y0];
  const cg=c.getContext('2d'), im=cg.getImageData(0,0,c.width,c.height), d=im.data, gray=new Float32Array(c.width*c.height);
  /* серый кадр: карандашный чертёж цвета не несёт, а запрос становится меньше на треть — ProxyAPI оценивает цену по размеру запроса в байтах и отклоняет крупные */
  for(let i=0;i<gray.length;i++){ const v=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2]; gray[i]=v; d[i*4]=d[i*4+1]=d[i*4+2]=v; } cg.putImageData(im,0,0);
  return {c,w:c.width,h:c.height,A,k,gray}; }
const mapPt=(A,u,v)=>[A[0]*u+A[1]*v+A[2],A[3]*u+A[4]*v+A[5]];
const fmt=(a,d)=>isFinite(a)?a.toFixed(d==null?2:d).replace('.',','):'—';

/* один чертёж: ответ основной модели tA и, если есть, второй tB (тот же кадр) → копия (px фото и мм листа) и её качество.
   c = {W, H (фото), vSel, dzSel (вариант и задание), rot, d (рамка чертежа)} */
function digest(cr,tA,tB,c){ const L=self.LAB, LY=L.layout, SL=L.sheetlib, RF=L.refine, IMG=L.img, MG=self.SCANMERGE, d=c.d||{};
  const ppm0=Math.max(2,Math.min(c.W,c.H)/210*cr.k); let P=LY.parseDigit(tA), text=tA, mg=null;
  if(tB!=null){ let fA=null; try{ fA=SL.fitVariant(tA,c.vSel,c.dzSel); }catch(e){} mg=MG.merge(P,LY.parseDigit(tB),{ppm:fA&&fA.ppm?fA.ppm:ppm0}); P=mg.P; text=MG.toText(P); }
  let fit=null; try{ fit=SL.fitVariant(text,c.vSel,c.dzSel); }catch(e){}
  const rg=P.pts.length>=4?[Math.min(...P.pts.map(q=>q[1])),Math.min(...P.pts.map(q=>q[2])),Math.max(...P.pts.map(q=>q[1])),Math.max(...P.pts.map(q=>q[2]))]:null;
  const ppm=ppm0; let rf=RF.refine({w:cr.w,h:cr.h,a:cr.gray},P.segs,{circles:P.circles,findCircles:true,ppm:fit&&fit.ppm?fit.ppm:ppm,region:rg,points:P.pts.map(q=>[q[1],q[2]]),findCap:0.35});
  if(mg) rf=MG.keepB(rf,mg.nA,P.circles);   /* добавленное второй моделью без карандаша — вон */
  /* точки — на ближайший конец отрезка или пересечение (в радиусе 1 мм): копия геометрически согласована */
  const sp=RF.snapPoints(P.pts,rf.segs.map(q=>q.p),{ppm:fit&&fit.ppm?fit.ppm:ppm,radius:1}); P.pts=sp.map(q=>[q[0],q[1],q[2]]);
  let toMm=null; if(fit&&fit.M){ const Mi=IMG.H.inv(fit.M); toMm=(x,y)=>IMG.H.apply(Mi,[x,y]); } else if(fit&&fit.A){ const a=fit.A, det=a[0]*a[4]-a[1]*a[3]; if(Math.abs(det)>1e-9) toMm=(x,y)=>{ const X=x-a[2], Y=y-a[5]; return [(a[4]*X-a[1]*Y)/det,(-a[3]*X+a[0]*Y)/det]; }; }
  const mmCopy=toMm?{pts:P.pts.map(q=>[q[0]].concat(toMm(q[1],q[2]).map(v=>+v.toFixed(2)))),txt:P.txt.map(q=>toMm(q[0],q[1]).map(v=>+v.toFixed(2)).concat(q[2])),segs:rf.segs.map(q=>({p:toMm(q.p[0],q.p[1]).concat(toMm(q.p[2],q.p[3])).map(v=>+v.toFixed(2)),src:q.src,unverified:!!q.unverified,dash:!!q.dash}))}:null;
  const circles=(rf.circles||[]).map(c=>{ const poly=SL.arcPoints(c); return {src:c.src,unverified:!!c.unverified,dash:!!c.dash,full:!!c.full,c:[c.cx,c.cy,c.r].map(v=>+v.toFixed(2)),a:c.full?null:[+c.a1.toFixed(1),+c.a2.toFixed(1)],poly:poly.map(([u,v])=>mapPt(cr.A,u,v).map(t=>+t.toFixed(1))),mm:toMm?poly.map(([u,v])=>toMm(u,v).map(t=>+t.toFixed(2))):null}; });
  const dr={part:d.part,box:d.box,rot:c.rot,ppm:fit&&fit.ppm?fit.ppm/cr.k:ppm/cr.k,mm:mmCopy,circles,fit,txt:P.txt.map(q=>mapPt(cr.A,q[0],q[1]).concat(q[2])),pts:P.pts.map(q=>[q[0]].concat(mapPt(cr.A,q[1],q[2]))),segs:rf.segs.map(q=>({p:mapPt(cr.A,q.p[0],q.p[1]).concat(mapPt(cr.A,q.p[2],q.p[3])),src:q.src,unverified:!!q.unverified,dash:!!q.dash})),stats:Object.assign({model:P.segs.length,bad:P.bad,pts:P.pts.length},rf.stats)};
  if(mg) dr.merge=mg.info;
  return {dr,q:quality(fit,rf,P)}; }
/* качество копии: привязалась ли к условию варианта, невязка, доля линий, подтверждённых карандашом, сколько ответа модели не нашлось на бумаге */
function quality(fit,rf,P){ const bound=!!(fit&&fit.rmsMm!=null&&fit.inl>=4), rms=bound?(fit.hom?fit.hom.rmsMm:fit.rmsMm):null, st=rf.stats, kept=st.kept||0;
  const conf=kept?(kept-(st.unverified||0))/kept:0, drop=(st.dropped||0)/Math.max(1,st.model||0), why=[];
  if(!bound) why.push('не привязался к варианту'); else if(rms>0.8) why.push('невязка '+fmt(rms)+' мм');
  if(conf<0.9) why.push('без карандаша '+Math.round(100*(1-conf))+' % линий'); if(drop>0.15) why.push('не на бумаге '+Math.round(100*drop)+' % ответа');
  if(P.pts.length<6) why.push('мало точек');
  return {bound,inl:bound?fit.inl:0,rms,conf,drop,pts:P.pts.length,confirmed:kept-(st.unverified||0),weak:why.length>0,why}; }
/* слитая копия лучше, если не потеряла привязку к варианту и не ухудшила её */
function better(M,A){ if(A.bound&&(!M.bound||M.inl<A.inl||M.rms>A.rms+0.2)) return false; return M.bound||!A.bound; }

function create(o){ o=o||{};
  const CLOUD=String(o.cloud||'').trim().replace(/[?&]integration=raw$/,'');   /* raw-режим Яндекса не отдаёт функции заголовки — адрес всегда без него */
  const API=String(o.api||'').replace(/\/+$/,'');
  const hdr=()=>CLOUD?{'content-type':'application/json','x-scan-code':encodeURIComponent(o.code||'')}:{'content-type':'application/json','x-beta-password':o.pass||''};
  async function status(){ const r=await fetch(CLOUD?CLOUD:API+'/api/status',CLOUD&&o.code?{headers:{'x-scan-code':encodeURIComponent(o.code)}}:undefined); const j=await r.json().catch(()=>null); return {http:r.status,j}; }
  async function ask(mode,canvas,extra){ const url=canvas.toDataURL('image/jpeg',0.8); let r;
    for(let attempt=0;;attempt++){ r=await fetch(CLOUD||API+'/api/eyes',{method:'POST',headers:hdr(),body:JSON.stringify(Object.assign({img:url,w:canvas.width,h:canvas.height,mode},extra||{}))});
      if(![429,500,502,503,504].includes(r.status)||attempt>=2) break; await new Promise(res=>setTimeout(res,2000*(attempt+1))); }   /* временный сбой облака или модели — до двух повторов */
    const raw=await r.text(); let j=null; try{ j=JSON.parse(raw); }catch(e){}
    /* откуда ошибка: ответ нашей функции (error), платформы Yandex Cloud (message) или не JSON; в конце — код ответа */
    if(!r.ok||!j||!j.ok){ const e=new Error(((j&&(j.error||j.message))||(raw?raw.replace(/\s+/g,' ').slice(0,120):'пустой ответ'))+' [HTTP '+r.status+(CLOUD?', облако':'')+']'); e.status=r.status; throw e; }
    return j; }

  async function run(file,sel,step){ sel=sel||{}; step=step||function(){};
    const L=self.LAB, LY=L.layout, SL=L.sheetlib, RF=L.refine, IMG=L.img; let cost=0, calls=0; const t0=Date.now();
    step('l','Читаю фото…'); const bmp=await createImageBitmap(file,{imageOrientation:'from-image'}); const W=bmp.width,H=bmp.height; step('l','Фото '+W+' × '+H+' px','done');
    step('lay','Нахожу чертежи на листе…'); const sm=scaled(bmp,800); let lay;
    try{ const j=await ask('layout',sm.c); cost+=j.cost||0; calls++; lay=LY.parseLayout(j.text,1/sm.k,W,H); }
    catch(e){ if(e.status===401||e.status===403) throw e; lay={ok:false,why:e.message}; }   /* неверный код — дальше идти незачем */
    if(!lay.ok){ step('lay','Раскладка не помогла ('+lay.why+') — лист как один чертёж','done'); lay={ok:true,rot:0,drawings:[{box:[0,0,W,H],part:null}]}; }
    else step('lay','Чертежей: '+lay.drawings.length+(lay.rot?', лист повёрнут на '+lay.rot+'°':'')+(lay.drawings.some(d=>d.part)?' (части '+lay.drawings.map(d=>d.part||'?').join(', ')+')':''),'done');
    const dzSel=sel.dz&&sel.dz!=='auto'?+sel.dz:null, vSel=/^\d+$/.test(String(sel.variant||'').trim())?String(sel.variant).trim():'auto';
    const out={name:String(file.name||'лист').replace(/\.[^.]+$/,''),size:[W,H],layout:{rot:lay.rot,n:lay.drawings.length},drawings:[]};
    const ctx0={W,H,vSel,dzSel,rot:lay.rot}, prec=sel.precision||'max', mname=m=>/opus/.test(m||'')?'Opus':/sonnet/.test(m||'')?'Sonnet':/haiku/.test(m||'')?'Haiku':(m||'?');
    const jobs=lay.drawings.map((d,i)=>async()=>{ const id='d'+i, nm='Чертёж '+(i+1); step(id,nm+': оцифровка…'); const cr=cut(bmp,d.box,lay.rot,Math.max(40,0.05*Math.max(d.box[2]-d.box[0],d.box[3]-d.box[1])),1280), ctx=Object.assign({d},ctx0);
      let jA; try{ jA=await ask('crop',cr.c,sel.model?{model:sel.model}:null); }catch(e){ step(id,nm+': '+e.message,'err'); return {part:d.part,box:d.box,error:e.message}; } cost+=jA.cost||0; calls++;
      const reads=[{mode:'crop',model:jA.model,fallback:jA.fallback||null,cost:jA.cost||0}];
      let R=digest(cr,jA.text,null,ctx);
      /* вторая, независимая оцифровка другой моделью — если первая слабая (или «максимальная точность»); сливаются, карандаш решает */
      if(!jA.fallback&&(prec==='max'||(prec==='auto'&&R.q.weak))){ step(id,nm+': вторая, независимая оцифровка другой моделью'+(R.q.why.length?' ('+R.q.why.join(', ')+')':'')+'…');
        try{ const jB=await ask('crop2',cr.c); cost+=jB.cost||0; calls++; reads.push({mode:'crop2',model:jB.model,cost:jB.cost||0});
          const M=digest(cr,jA.text,jB.text,ctx); if(better(M.q,R.q)){ R=M; } else R.dr.secondKept=false; }
        catch(e){ R.dr.secondError=e.message; } }
      const dr=R.dr, fit=dr.fit, mg=dr.merge; dr.reads=reads; dr.quality=R.q;
      step(id,nm+': '+reads.map(r=>mname(r.model)).join(' + ')+' — точек '+dr.stats.pts+', отрезков '+dr.stats.kept+(dr.circles.length?', окружностей и дуг '+dr.circles.length:'')
        +(mg?' (вторая модель добавила: линий '+Math.max(0,mg.segsAdded-(dr.stats.dropB||0))+', точек '+mg.ptsAdded+')':'')
        +(fit&&fit.rmsMm!=null?', привязка ДЗ №'+fit.dz+' в.'+fit.n+', невязка '+fmt(fit.hom?fit.hom.rmsMm:fit.rmsMm)+' мм':', к условию не привязался'),'done'); return dr; });
    /* до двух чертежей одновременно */
    const q=jobs.slice(); await Promise.all([0,1].map(async()=>{ while(q.length){ const job=q.shift(), idx=jobs.indexOf(job); out.drawings[idx]=await job(); } }));
    out.cost=+cost.toFixed(4); out.calls=calls; out.seconds=Math.round((Date.now()-t0)/1000); return {out,bmp}; }

  return {status,ask,run,cloud:CLOUD,api:API}; }

self.SCANPIPE={LIBS,load,create,scaled,cut,mapPt,digest,quality,better};
})();
