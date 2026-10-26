/* Проверка листа ДЗ в отдельном потоке (страница lab/dz.html): те же файлы, что в тестах Node.
   Вход: {img:{width,height,data}, dz, n}; выход: вердикт, причины и то, что нужно странице для рисования. */
importScripts('../../core/dz.js','../../core/dz-variants.js','../img.js','../clean.js','../font.js','../sheets.js','../rectify.js','../lines.js',
  'sheet.js','locate.js','digitize.js','model.js','model3.js','calib.js','check2.js','check3.js','explain2.js','report2.js','check.js','grid.js','given.js','explain3d.js','report3d.js','paper.js','gridsheet.js','series.js','eyes.js','cleaner/cleaner.js');
/* кадр серии (lab/cam.html): только данные для голосования (series.js) и разбор в пикселях этого снимка */
function frame(img,dz,n,answers,part,paper){ const g=self.LAB.dzGridSheet.checkGridPhoto(img,{dz,n,answers,part,paper:paper||'auto'});
  const fr={ok:!!g.ok,n:g.n,verdict:g.verdict,why:g.why||[],ms:g.ms,ref:g.ref,mine:g.mine,smine:g.smine,answers:g.answers||[],
    given:g.given?{diff:g.given.diff,link:g.given.link,O:g.given.O,drawn:g.given.drawn}:null,
    ex3d:g.ex3d?{steps:g.ex3d.steps.map(s=>({k:s.k,name:s.name,status:s.status,msg:s.msg,val:s.val&&{phi:s.val.phi,psi:s.val.psi,spsi:s.val.spsi,c:s.val.c}})),first:g.ex3d.first&&g.ex3d.first.k}:null};
  /* разбор поверх фото: мм чертежа → мм листа (+O) → px снимка (карта сетки); отрезок — ломаной через 2 мм (лист гнётся) */
  if(g.ok&&g._grid&&g.given){ const O=g.given.O, m=p=>g._grid.map(p[0]+O[0],p[1]+O[1]);
    const drawnPts=Object.fromEntries(Object.entries(g.given.pts).filter(([k,q])=>q.src!=='не найдена').map(([k,q])=>[k,[q.p[0]-O[0],q.p[1]-O[1]]]));
    const pr=self.LAB.dzReport3d.prims({data:g.given.drawn,truth:g.data,ex:g.ex3d,claims:g.given.diff.filter(d=>d.sure),drawnPts});
    const poly=(a,b)=>{ const N=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2)+1); return Array.from({length:N},(_,i)=>m([a[0]+(b[0]-a[0])*i/(N-1),a[1]+(b[1]-a[1])*i/(N-1)])); };
    fr.overlay=pr.map(q=>q.t==='dot'?Object.assign({},q,{p:m(q.p)}):Object.assign({},q,{pts:poly(q.a,q.b)})); }
  return fr; }
/* фигура условия там, где её нашёл мозг: отрезки в px снимка (мм чертежа → мм листа (+O) → px), ломаной через 3 мм */
function figPx(g){ try{ if(!g||!g.ok||!g._grid||!g.given) return null; const O=g.given.O, m=p=>g._grid.map(p[0]+O[0],p[1]+O[1]);
    return self.LAB.dzModel.given(g.id,g.data).segs.map(q=>{ const N=Math.max(2,Math.ceil(Math.hypot(q.b[0]-q.a[0],q.b[1]-q.a[1])/3)+1); return Array.from({length:N},(_,i)=>m([q.a[0]+(q.b[0]-q.a[0])*i/(N-1),q.a[1]+(q.b[1]-q.a[1])*i/(N-1)])); }); }catch(e){ return null; } }
/* ответ странице по листу в клетку / чистому листу / чертежу от глаз: вердикт, причины, части, шаги г), картинка разбора */
function gridOut(g){ const out={fig:figPx(g),verdict:g.verdict,why:(g.why||[]).concat((g.shown||[]).map(k=>g.parts&&g.parts[k]?'часть '+({a:'1',b:'2',c:'3',d:'4'}[k])+': '+g.parts[k].st+' — '+(g.parts[k].why||[]).join('; '):null).filter(Boolean),g.visNote?['замечание — '+g.visNote]:[])};
  if(g.ex3d&&g.ex3d.steps.length&&g.dig){ out.ex={steps:g.ex3d.steps.map(s=>({k:s.k,name:s.name,status:s.status,msg:s.msg})),first:g.ex3d.first&&g.ex3d.first.k};
    try{ const segs=self.LAB.dzCalib.drawSegs(g.dig,{T:[g.given.O[0],g.given.O[1],0,0,0,0]}); out.svg=self.LAB.dzReport3d.svg({segs,data:g.given.drawn,ex:g.ex3d,why:(g.answers||[]).filter(a=>a.k==='phi').map(a=>a.msg.split('; на чертеже')[0])}); }catch(x){} }
  return out; }
self.onmessage=e=>{ const {img,dz,n,paper,answers,part,mode}=e.data, t0=Date.now(); let r;
  if(mode==='frame'){ try{ self.postMessage({frame:frame(img,dz,n,answers,part,paper),ms:Date.now()-t0}); }catch(err){ self.postMessage({error:String(err&&err.stack||err)}); } return; }
  /* лист в клетку: сетка вместо рамки (gridsheet.js) — свой ответ странице */
  /* лист в клетку или чистый лист (края бумаги + условие): gridsheet.js; «в клетку» — с запасным чистым листом */
  if(paper==='grid'||paper==='plain'){ try{ const g=self.LAB.dzGridSheet.checkGridPhoto(img,{dz,n,answers,part,paper:paper==='plain'?'plain':'auto'}); const out=gridOut(g); if(e.data.eyesNote) out.why.push(e.data.eyesNote); self.postMessage(Object.assign(out,{stage:'клетка',ms:Date.now()-t0})); }
    catch(err){ self.postMessage({error:String(err&&err.stack||err)}); } return; }
  /* глаза (модель со зрением в кабинете) прочитали подписи: каждый чертёж листа — отдельно, со своим O (eyes.js).
     Глаза не помогли (ничего не прочитано) — обычный путь, с их причиной в конце */
  if(e.data.eyes){ const EY=self.LAB.dzEyes, E=EY.parse(e.data.eyes), k=1/(e.data.eyesScale||1); let note=null;
    if(E.error) note='ИИ-зрение: '+E.error;
    else { const E0=JSON.parse(JSON.stringify(E)); E.drawings.forEach(d=>{ Object.keys(d.pts).forEach(l=>{ d.pts[l]=[d.pts[l][0]*k,d.pts[l][1]*k]; }); if(d.box) d.box=d.box.map(v=>v*k); });
      /* часть моделей (Qwen-VL прошлых версий) даёт координаты в шкале 0…1000, а не в px. Все координаты ≤ 1000 —
         обе шкалы: берётся та, где привязка к условию честнее (больше согласных точек, меньше искажения осей) */
      const all=[].concat(...E0.drawings.map(d=>Object.values(d.pts)));
      if(all.length&&all.every(p=>p[0]<=1000&&p[1]<=1000)&&+n){ const W=img.width/1000, Hh=img.height/1000, E2=JSON.parse(JSON.stringify(E0)), gv=self.CORE.dzVariants.get(+dz,+n);
        E2.drawings.forEach(d=>{ Object.keys(d.pts).forEach(l=>{ d.pts[l]=[d.pts[l][0]*W,d.pts[l][1]*Hh]; }); if(d.box) d.box=[d.box[0]*W,d.box[1]*Hh,d.box[2]*W,d.box[3]*Hh]; });
        const score=EE=>EE.drawings.reduce((m,d)=>{ const b=gv?EY.bindAffine(EY.pairs(d,gv.id,gv.data),{px:0.025*Math.max(img.width,img.height)}):null; return m+(b?b.inl.length-3*b.aniso:0); },0);
        if(gv&&score(E2)>score(E)) E.drawings=E2.drawings; }
      let r=null; try{ r=EY.checkEyes(img,E,{dz:+dz,n,answers,part}); }catch(err){ note='ИИ-зрение: ошибка разбора — '+String(err&&err.message||err); }
      if(r&&r.drawings.some(g=>g.ok)){ const PN={a:'1) высота',b:'2) угол граней',c:'3) истинный вид',d:'4) угол SA'};
        const drawings=r.drawings.map((g,i)=>Object.assign(+dz===2?{verdict:g.verdict,why:g.why||[],ex:g.ex?{steps:g.ex.steps.map(s=>({k:s.k,name:s.name,status:s.status,msg:s.msg})),first:g.ex.first&&g.ex.first.k}:null}:gridOut(g),{title:'Чертёж '+(i+1)+(g.part||g.eyesPart?' — '+PN[g.part||g.eyesPart]:'')}));
        /* что увидели глаза — на фото (px снимка): точки с подписями и рамка каждого чертежа */
        const eyesPts=E.drawings.map((d,i)=>({pts:d.pts,box:d.box,v:r.drawings[i].verdict,fig:drawings[i].fig}));
        self.postMessage({verdict:r.verdict,why:['ИИ-зрение нашло чертежей: '+r.drawings.length].concat(r.why),drawings,eyesPts,stage:'глаза',ms:Date.now()-t0}); return; }
      if(r) note='ИИ-зрение: '+r.why.join('; '); }
    self.onmessage({data:Object.assign({},e.data,{eyes:null,eyesNote:note})}); return; }
  try{ r=self.LAB.dzCheck.checkSheet(img,{dz,n}); }catch(err){ self.postMessage({error:String(err&&err.stack||err)}); return; }
  /* рамки и штампа нет (лист без оформления) — ДЗ №3 проверяем по сетке или по краям бумаги, как «лист в клетку» */
  if(+dz===3&&r.verdict==='не могу прочитать'&&r.stage==='лист'){ self.onmessage({data:Object.assign({},e.data,{paper:'grid'})}); return; }
  const out={verdict:r.verdict,why:r.why.concat(e.data.eyesNote?[e.data.eyesNote]:[]),stage:r.stage,ms:Date.now()-t0,variants:r.variants||null};
  if(r.loc&&r.loc.ok) Object.assign(out,{H:r.loc.H,turn:r.loc.turn,pxPerMm:r.loc.pxPerMm,O:r.loc.O,axis:r.loc.axis});
  if(r.dig&&r.dig.ok) Object.assign(out,{box:r.dig.box,digO:r.dig.O,segs:r.dig.segs.map(s=>({a:s.a,b:s.b,k:s.k}))});
  if(r.cal&&r.cal.ok) Object.assign(out,{T:r.cal.T,cover:r.cal.cover,rms:r.cal.rms});
  if(r.ans){ if(r.ans.cur) out.cur=r.ans.cur; if(r.ans.parts) out.parts=Object.fromEntries(Object.entries(r.ans.parts).map(([k,p])=>[k,{st:p.st,why:p.why}])); if(r.ans.edges) out.edges=r.ans.edges; }
  /* разбор по шагам (ДЗ №2а) и картинка разбора — SVG в мм чертежа */
  if(r.ex){ out.ex={steps:r.ex.steps.map(s=>({k:s.k,name:s.name,status:s.status,msg:s.msg})),first:r.ex.first&&r.ex.first.k};
    try{ out.svg=self.LAB.dzReport2.svg({data:self.CORE.dzVariants.get(dz,n).data,segs:self.LAB.dzCalib.drawSegs(r.dig,r.cal),cur:r.ans.cur,ex:r.ex,verdict:r.verdict,why:r.why}); }catch(e){} }
  self.postMessage(out); };
