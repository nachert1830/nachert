/* Проверка листа ДЗ в отдельном потоке (страница lab/dz.html): те же файлы, что в тестах Node.
   Вход: {img:{width,height,data}, dz, n}; выход: вердикт, причины и то, что нужно странице для рисования. */
importScripts('../../core/dz.js','../../core/dz-variants.js','../img.js','../clean.js','../font.js','../sheets.js','../rectify.js','../lines.js',
  'sheet.js','locate.js','digitize.js','model.js','model3.js','calib.js','check2.js','check3.js','explain2.js','report2.js','check.js','grid.js','given.js','explain3d.js','report3d.js','gridsheet.js','series.js');
/* кадр серии (lab/cam.html): только данные для голосования (series.js) и разбор в пикселях этого снимка */
function frame(img,dz,n,answers,part){ const g=self.LAB.dzGridSheet.checkGridPhoto(img,{dz,n,answers,part});
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
self.onmessage=e=>{ const {img,dz,n,paper,answers,part,mode}=e.data, t0=Date.now(); let r;
  if(mode==='frame'){ try{ self.postMessage({frame:frame(img,dz,n,answers,part),ms:Date.now()-t0}); }catch(err){ self.postMessage({error:String(err&&err.stack||err)}); } return; }
  /* лист в клетку: сетка вместо рамки (gridsheet.js) — свой ответ странице */
  if(paper==='grid'){ try{ const g=self.LAB.dzGridSheet.checkGridPhoto(img,{dz,n,answers,part}); const out={verdict:g.verdict,why:(g.why||[]).concat((g.shown||[]).map(k=>g.parts&&g.parts[k]?'часть '+({a:'1',b:'2',c:'3',d:'4'}[k])+': '+g.parts[k].st+' — '+(g.parts[k].why||[]).join('; '):null).filter(Boolean),g.visNote?['замечание — '+g.visNote]:[]),stage:'клетка',ms:Date.now()-t0};
      if(g.ex3d&&g.ex3d.steps.length&&g.dig){ out.ex={steps:g.ex3d.steps.map(s=>({k:s.k,name:s.name,status:s.status,msg:s.msg})),first:g.ex3d.first&&g.ex3d.first.k};
        try{ const segs=self.LAB.dzCalib.drawSegs(g.dig,{T:[g.given.O[0],g.given.O[1],0,0,0,0]}); out.svg=self.LAB.dzReport3d.svg({segs,data:g.given.drawn,ex:g.ex3d,why:(g.answers||[]).filter(a=>a.k==='phi').map(a=>a.msg.split('; на чертеже')[0])}); }catch(x){} }
      self.postMessage(out); }catch(err){ self.postMessage({error:String(err&&err.stack||err)}); } return; }
  try{ r=self.LAB.dzCheck.checkSheet(img,{dz,n}); }catch(err){ self.postMessage({error:String(err&&err.stack||err)}); return; }
  const out={verdict:r.verdict,why:r.why,stage:r.stage,ms:Date.now()-t0,variants:r.variants||null};
  if(r.loc&&r.loc.ok) Object.assign(out,{H:r.loc.H,turn:r.loc.turn,pxPerMm:r.loc.pxPerMm,O:r.loc.O,axis:r.loc.axis});
  if(r.dig&&r.dig.ok) Object.assign(out,{box:r.dig.box,digO:r.dig.O,segs:r.dig.segs.map(s=>({a:s.a,b:s.b,k:s.k}))});
  if(r.cal&&r.cal.ok) Object.assign(out,{T:r.cal.T,cover:r.cal.cover,rms:r.cal.rms});
  if(r.ans){ if(r.ans.cur) out.cur=r.ans.cur; if(r.ans.parts) out.parts=Object.fromEntries(Object.entries(r.ans.parts).map(([k,p])=>[k,{st:p.st,why:p.why}])); if(r.ans.edges) out.edges=r.ans.edges; }
  /* разбор по шагам (ДЗ №2а) и картинка разбора — SVG в мм чертежа */
  if(r.ex){ out.ex={steps:r.ex.steps.map(s=>({k:s.k,name:s.name,status:s.status,msg:s.msg})),first:r.ex.first&&r.ex.first.k};
    try{ out.svg=self.LAB.dzReport2.svg({data:self.CORE.dzVariants.get(dz,n).data,segs:self.LAB.dzCalib.drawSegs(r.dig,r.cal),cur:r.ans.cur,ex:r.ex,verdict:r.verdict,why:r.why}); }catch(e){} }
  self.postMessage(out); };
