/* Проверка листа ДЗ в отдельном потоке (страница lab/dz.html): те же файлы, что в тестах Node.
   Вход: {img:{width,height,data}, dz, n}; выход: вердикт, причины и то, что нужно странице для рисования. */
importScripts(...['../../core/dz.js','../../core/dz-variants.js','../img.js','../clean.js','../font.js','../sheets.js','../rectify.js','../lines.js',
  'sheet.js','locate.js','digitize.js','model.js','model3.js','calib.js','check2.js','check3.js','explain2.js','report2.js','check.js','grid.js','given.js','explain3d.js','report3d.js','paper.js','gridsheet.js','series.js','eyes.js','cleaner/cleaner.js','closeup.js'].map(f=>f+((self.location&&self.location.search)||'')));
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
/* что понял мозг по каждой показанной части (check3 geo): мм чертежа и px снимка — чистый чертёж отдельно и поверх фото */
function consOf(g){ if(!g||!g.parts) return null; const out={}; let m=null; try{ if(g._grid&&g.given){ const O=g.given.O; m=p=>g._grid.map(p[0]+O[0],p[1]+O[1]); } }catch(e){}
  (g.shown||[]).forEach(k=>{ const p=g.parts[k]; if(!p||!p.geo) return; out[k]={st:p.st,geo:p.geo,px:m?p.geo.map(q=>q.t==='p'?Object.assign({},q,{p:m(q.p)}):Object.assign({},q,{a:m(q.a),b:m(q.b)})):null}; });
  return Object.keys(out).length?out:null; }
/* какая это часть: опознана построением (idPart — в том числе без уверенного вердикта) или сошлась одна */
const partOf=g=>g.idPart||(g.partGuess&&g.partGuess.length===1?g.partGuess[0]:null);
function gridOut(g){ const out={fig:figPx(g),cons:consOf(g),part:partOf(g),verdict:g.verdict,why:(g.why||[]).concat((g.shown||[]).map(k=>g.parts&&g.parts[k]?'часть '+({a:'1',b:'2',c:'3',d:'4'}[k])+': '+g.parts[k].st+' — '+(g.parts[k].why||[]).join('; '):null).filter(Boolean),g.visNote?['замечание — '+g.visNote]:[])};
  if(g.ex3d&&g.ex3d.steps.length&&g.dig){ out.ex={steps:g.ex3d.steps.map(s=>({k:s.k,name:s.name,status:s.status,msg:s.msg})),first:g.ex3d.first&&g.ex3d.first.k};
    try{ const segs=self.LAB.dzCalib.drawSegs(g.dig,{T:[g.given.O[0],g.given.O[1],0,0,0,0]}); out.svg=self.LAB.dzReport3d.svg({segs,data:g.given.drawn,ex:g.ex3d,why:(g.answers||[]).filter(a=>a.k==='phi').map(a=>a.msg.split('; на чертеже')[0])}); }catch(x){} }
  return out; }
/* свои глаза, без модели (ДЗ №3, лист без клеток): все копии фигуры условия на листе по линиям → каждый чертёж отдельно */
function ownEyes(img,dz,n,answers,part,t0,why0){ const EY=self.LAB.dzEyes; let own=null; try{ own=EY.findDrawings(img,{dz:3,n}); }catch(x){ return null; } if(!own||!own.ok) return null;
  let r=null; try{ r=EY.checkEyes(img,{dz:3,n,drawings:own.drawings},{dz:3,n,answers,part,grid:{ok:false,reason:'чистый лист'}}); }catch(x){ return null; } if(!r||!r.drawings.some(g=>g.ok)) return null;
  const PN={a:'1) высота',b:'2) угол граней',c:'3) истинный вид',d:'4) угол SA'}, drawings=r.drawings.map((g,i)=>Object.assign(gridOut(g),{title:'Чертёж '+(i+1)+(partOf(g)?' — '+PN[partOf(g)]:'')}));
  const eyesPts=r.drawings.map((g,j)=>{ let O=null; try{ if(g._grid&&g.given) O=g._grid.map(g.given.O[0],g.given.O[1]); }catch(x){} return {pts:{},v:g.verdict,fig:drawings[j].fig,O}; });
  return {verdict:r.verdict,why:['свои глаза (без ИИ-зрения): чертежей найдено по линиям — '+r.drawings.length].concat(r.why,why0||[]),drawings,eyesPts,stage:'свои глаза',ms:Date.now()-t0}; }
/* съёмка по чертежам (closeup.js): общий снимок запоминается здесь же — с ним сравнивается каждый снимок вблизи */
let OV=null, HINTS=null;
/* подсказка модели к общему снимку: её рамки (шкала — eyes.js rescale) → номер части у каждого найденного чертежа (начало O
   чертежа внутри рамки; две рамки с разными частями — без подсказки). Это только подсказка: часть утверждает мозг (gridsheet) */
function hintsOf(d){ if(!OV) return null; const EY=self.LAB.dzEyes, E=EY.parse(d.eyes); if(E.error) return null; const img=OV.img, sc=d.eyesScale||1;
  const rs=EY.rescale(E,{w:img.width*sc,h:img.height*sc,k:sc,W:img.width,H:img.height,model:d.eyesModel,dz:3,n:+d.n,own:OV.drawings});
  return OV.drawings.map(q=>{ const ps=[...new Set(rs.E.drawings.filter(e=>e.box&&e.part&&q.A[2]>=e.box[0]&&q.A[2]<=e.box[2]&&q.A[5]>=e.box[1]&&q.A[5]<=e.box[3]).map(e=>e.part))]; return ps.length===1?ps[0]:null; }); }
function closeMode(d){ const CU=self.LAB.dzCloseup, t0=Date.now();
  if(d.mode==='hints'){ HINTS=hintsOf(d); return {hints:HINTS||[]}; }
  if(d.mode==='overview'){ const r=CU.overview(d.img,{n:d.n,answers:d.answers}); OV=r.ok?{img:d.img,drawings:r.drawings}:null; HINTS=null;
    return {overview:r.ok?{ok:true,drawings:r.drawings.map(q=>({c:q.c,box:q.box,ppm:q.ppm,pos:q.pos,title:q.title,A:q.A})),frames:r.frames}:{ok:false,reason:r.reason},ms:Date.now()-t0}; }
  const r=CU.close(d.img,OV,{n:d.n,answers:d.answers,want:d.want,hints:HINTS}); return {close:r.ok?{ok:true,got:r.got}:{ok:false,reason:r.reason,ppm:r.ppm},want:d.want,ms:Date.now()-t0}; }
/* оцифровка моделью (Claude Sonnet, eyes.js parseDigit): каждый чертёж ответа → мозг по его линиям (gridsheet.js digit).
   Выбрана часть — только её чертёж. Ответы, которые студент ввёл сам, важнее прочитанных моделью. Ничего не сложилось —
   {digitFail}: страница проверит по линиям, как обычно */
function digitMode(d){ const EY=self.LAB.dzEyes, GS=self.LAB.dzGridSheet, t0=Date.now(), P=EY.parseDigit(d.digit,d.digitScale||1);
  if(P.error) return {digitFail:P.error};
  let ds=P.drawings; if(d.part){ const own=ds.filter(q=>q.part===d.part); ds=own.length?own:ds.length===1?ds:ds.filter(q=>!q.part); }
  if(!ds.length) return {digitFail:'модель не нашла чертёж части '+({a:1,b:2,c:3,d:4}[d.part])};
  /* один чертёж в двух ответах (запросы по частям идут отдельно): центры точек ближе 4 % кадра — оставить тот, где линий больше */
  { const c=q=>{ const P=Object.values(q.pts); return P.length?[P.reduce((s,p)=>s+p[0],0)/P.length,P.reduce((s,p)=>s+p[1],0)/P.length]:null; }, lim=0.04*Math.hypot(d.img.width,d.img.height), keep=[];
    ds.slice().sort((x,y)=>y.segs.length-x.segs.length).forEach(q=>{ const a=c(q); if(a&&keep.some(k=>{ const b=c(k); return b&&Math.hypot(a[0]-b[0],a[1]-b[1])<lim; })) return; keep.push(q); });
    ds=ds.filter(q=>keep.includes(q)); }
  const typed=Object.fromEntries(Object.entries(d.answers||{}).filter(([k,v])=>v!=null&&!isNaN(v)));
  const PN={a:'1) высота',b:'2) угол граней',c:'3) истинный вид',d:'4) угол SA'}, NM={H:'H',phi:'φ',dih:'угол граней'};
  const rs=ds.map(q=>{ const answers=Object.assign({},q.answers,typed); let g;
    try{ g=GS.checkGridPhoto(d.img,{dz:3,n:+d.n,answers,part:d.part||null,digit:q,eyes:{pts:q.pts},partHint:d.part?null:q.part,cleaner:false}); }catch(err){ g={ok:false,verdict:'не могу прочитать',why:['ошибка разбора: '+String(err&&err.message||err)]}; }
    const read=Object.entries(q.answers).filter(([k])=>typed[k]==null).map(([k,v])=>NM[k]+' = '+String(v).replace('.',','));
    if(read.length) g.why=(g.why||[]).concat(['модель прочитала на листе ответ: '+read.join(', ')+' — проверен']);
    return {g,q}; });
  if(!rs.some(x=>x.g.ok)) return {digitFail:rs.map(x=>(x.g.why||[])[0]).filter(Boolean).join('; ')||'оцифровка не сложилась'};
  const drawings=rs.map(({g,q},i)=>Object.assign(gridOut(g),{title:'Чертёж '+(i+1)+(d.part?' — '+PN[d.part]:partOf(g)?' — '+PN[partOf(g)]:q.part?' — '+PN[q.part]+' (по модели)':'')}));
  const eyesPts=rs.map(({g,q},j)=>{ let O=null; try{ if(g._grid&&g.given) O=g._grid.map(g.given.O[0],g.given.O[1]); }catch(x){}
    const xs=q.segs.flatMap(s=>[s.a,s.b]), box=xs.length?[Math.min(...xs.map(p=>p[0])),Math.min(...xs.map(p=>p[1])),Math.max(...xs.map(p=>p[0])),Math.max(...xs.map(p=>p[1]))]:null;
    return {pts:q.pts,box,v:g.verdict,fig:drawings[j].fig,O}; });
  const vs=rs.map(x=>x.g.verdict), verdict=vs.some(v=>v==='ошибка')?'ошибка':vs.some(v=>v==='ошибка в данных')?'ошибка в данных':vs.length&&vs.every(v=>v==='верно'||v==='данные нанесены верно')?'верно':'не могу утверждать';
  return {verdict,why:['оцифровка — '+String(d.digitModel||'модель').replace(/^anthropic\//,'')+': чертежей '+ds.length+(d.part?' (часть '+({a:1,b:2,c:3,d:4}[d.part])+')':'')].concat(rs.map(({g},i)=>'чертёж '+(i+1)+': '+g.verdict+(g.ok===false&&g.why&&g.why[0]?' — '+g.why[0]:''))),drawings,eyesPts,stage:'оцифровка',ms:Date.now()-t0}; }
self.onmessage=e=>{ const {img,dz,n,paper,answers,part,mode}=e.data, t0=Date.now(); let r;
  if(mode==='digit'){ try{ self.postMessage(digitMode(e.data)); }catch(err){ self.postMessage({digitFail:'сбой: '+String(err&&err.message||err)}); } return; }
  if(mode==='overview'||mode==='close'||mode==='hints'){ try{ self.postMessage(closeMode(e.data)); }catch(err){ self.postMessage({error:String(err&&err.stack||err),want:e.data.want,mode}); }
    /* пока студент подносит телефон — линии чертежей общего снимка для опознания (sameDrawing кэширует их) */
    if(mode==='overview'&&OV&&OV.drawings.length) setTimeout(()=>{ try{ self.LAB.dzEyes.sameDrawing({img:OV.img,A:OV.drawings[0].A},OV,{dz:3,n}); }catch(x){} },0); return; }
  if(mode==='frame'){ try{ self.postMessage({frame:frame(img,dz,n,answers,part,paper),ms:Date.now()-t0}); }catch(err){ self.postMessage({error:String(err&&err.stack||err)}); } return; }
  /* лист в клетку: сетка вместо рамки (gridsheet.js) — свой ответ странице */
  /* лист в клетку или чистый лист (края бумаги + условие): gridsheet.js; «в клетку» — с запасным чистым листом */
  if(paper==='grid'||paper==='plain'){ try{ const g=self.LAB.dzGridSheet.checkGridPhoto(img,{dz,n,answers,part,paper:paper==='plain'?'plain':'auto'}); const out=gridOut(g); if(e.data.eyesNote) out.why.push(e.data.eyesNote);
      /* не прочитал и сетки нет — свои глаза: может, на листе несколько чертежей */
      if(+dz===3&&+n&&(g.verdict==='не могу прочитать'||g.verdict==='не могу утверждать')&&g.paper!=='grid'&&!(g.grid&&g.grid.ok&&!g.grid.plain)){ const oe=ownEyes(img,dz,n,answers,part,t0,['обычный разбор листа: '+g.verdict].concat(e.data.eyesNote?[e.data.eyesNote]:[])); if(oe){ self.postMessage(oe); return; } }
      self.postMessage(Object.assign(out,{stage:'клетка',ms:Date.now()-t0})); }
    catch(err){ self.postMessage({error:String(err&&err.stack||err)}); } return; }
  /* глаза (модель со зрением в кабинете) прочитали подписи: каждый чертёж листа — отдельно, со своим O (eyes.js).
     Глаза не помогли (ничего не прочитано) — обычный путь, с их причиной в конце */
  if(e.data.eyes){ const EY=self.LAB.dzEyes, E=EY.parse(e.data.eyes); let note=null, ownNote=null;
    if(E.error) note='ИИ-зрение: '+E.error;
    else { /* шкала координат ответа — у каждой модели своя: px присланного фото, 0…1000 [x, y] (Qwen3), 0…1000 [y, x]
         (Gemini) — берётся та, где подписи складываются в условие и рамки накрывают чертежи, найденные по линиям (eyes.js rescale) */
      let own0=null, grid0; if(+dz===3&&+n){ try{ grid0=self.LAB.dzGrid.findGrid(img); }catch(x){} if(!(grid0&&grid0.ok)){ try{ const f=EY.findDrawings(img,{dz:3,n}); if(f.ok) own0=f.drawings; }catch(x){} } }
      const sc=e.data.eyesScale||1, rs=EY.rescale(E,{w:img.width*sc,h:img.height*sc,k:sc,W:img.width,H:img.height,model:e.data.eyesModel,dz:+dz,n:+n,own:own0});
      E.drawings=rs.E.drawings;
      /* ДЗ №3 на листе без клеток: свои глаза (поиск всех копий фигуры условия по линиям) + рамки модели */
      if(own0){ E.drawings=EY.mergeDrawings(own0,E.drawings); ownNote='свои глаза нашли чертежей по линиям: '+own0.length; }
      let r=null; try{ r=EY.checkEyes(img,E,{dz:+dz,n,answers,part,grid:grid0}); }catch(err){ note='ИИ-зрение: ошибка разбора — '+String(err&&err.message||err); }
      if(r&&r.drawings.some(g=>g.ok)){ const PN={a:'1) высота',b:'2) угол граней',c:'3) истинный вид',d:'4) угол SA'};
        const drawings=r.drawings.map((g,i)=>Object.assign(+dz===2?{verdict:g.verdict,why:g.why||[],ex:g.ex?{steps:g.ex.steps.map(s=>({k:s.k,name:s.name,status:s.status,msg:s.msg})),first:g.ex.first&&g.ex.first.k}:null}:gridOut(g),{title:'Чертёж '+(i+1)+(g.part?' — '+PN[g.part]:partOf(g)?' — '+PN[partOf(g)]:'')}));
        /* что увидели глаза — на фото (px снимка): точки с подписями и рамка каждого чертежа */
        const eyesPts=r.drawings.map((g,j)=>{ const d=E.drawings[g.index]||{}; let O=null; try{ if(g._grid&&g.given) O=g._grid.map(g.given.O[0],g.given.O[1]); }catch(x){} return {pts:d.pts||{},box:d.box,v:g.verdict,fig:drawings[j].fig,O}; });
        self.postMessage({verdict:r.verdict,why:['ИИ-зрение'+(e.data.eyesModel?' ('+String(e.data.eyesModel).replace(/^gpt:\/\/[^/]+\//,'')+', шкала '+rs.scale+')':'')+' нашло чертежей: '+r.drawings.length].concat(ownNote?[ownNote]:[],r.why),drawings,eyesPts,stage:'глаза',ms:Date.now()-t0}); return; }
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
