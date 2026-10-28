/* ═══════════ Сканер ДЗ — общий интерфейс страниц lab/cam.html и lab/dz.html ═══════════
   Только экран: тема, экраны, ожидание с этапами, результат (лист с чертежами и карточки частей), примеры, фото/PDF.
   Проверку делает поток lab/dz/worker-ui.js (это lab/dz/worker.js и отметки этапов); его ответ — как есть:
   verdict, why, drawings[{title, verdict, why, ex, svg, fig}], eyesPts[{v, fig, O, box}]. */
(function(){
const S=self.SCAN={};
const $=S.$=id=>document.getElementById(id);
const esc=S.esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f1=S.f1=x=>(Math.round(x*10)/10).toString().replace('.',',');

/* ── иконки (линии 24 × 24) ── */
const P={
  cam:'<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.4-2h7l1.4 2h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="4"/>',
  up:'<path d="M12 16V4M7 9l5-5 5 5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/>',
  ok:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', bad:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', q:'<path d="M9.2 9a2.9 2.9 0 1 1 4.1 2.6c-.8.4-1.3 1.1-1.3 2v.4"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>', sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', down:'<path d="M6 9l6 6 6-6"/>', pin:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  redo:'<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>', sheet:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>', back:'<path d="M15 5l-7 7 7 7"/>',
  glare:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  far:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1"/>', tilt:'<path d="M4 18L12 6l8 12z"/><path d="M12 11v3"/>',
  blur:'<path d="M3 12h3M18 12h3M8 7h8M8 17h8M6 12h12"/>', light:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  hold:'<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/>', play:'<path d="M7 5v14l12-7z"/>', file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'
};
const I=S.icon=(k,cls)=>'<svg class="i'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(P[k]||'')+'</svg>';
S.fillIcons=root=>(root||document).querySelectorAll('[data-i]').forEach(e=>{ if(!e.firstElementChild||e.firstElementChild.tagName!=='svg') e.insertAdjacentHTML('afterbegin',I(e.dataset.i)); });

/* ── тема (как у сайта: nch2_theme) и встраивание в кабинет ── */
const root=document.documentElement;
try{ const t=JSON.parse(localStorage.getItem('nch2_theme')); if(t==='light'||t==='dark') root.dataset.theme=t; }catch(e){}
try{ if(window.self!==window.top) root.classList.add('embed'); }catch(e){ root.classList.add('embed'); }
const dark=()=>root.dataset.theme?root.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
S.themeBtn=b=>{ if(!b) return; const sync=()=>{ b.innerHTML=I(dark()?'sun':'moon'); b.setAttribute('aria-label',dark()?'Светлая тема':'Тёмная тема'); };
  sync(); b.onclick=()=>{ const t=dark()?'light':'dark'; root.dataset.theme=t; try{ localStorage.setItem('nch2_theme',JSON.stringify(t)); }catch(e){} sync(); }; };

/* ── экраны: один на странице; «назад» браузера возвращает на старт ── */
let cur=null;
S.screen=id=>{ document.querySelectorAll('.scr').forEach(e=>{ e.hidden=e.id!==id; }); if(cur!==id){ cur=id; const e=$(id); if(e){ e.style.animation='none'; void e.offsetWidth; e.style.animation=''; } window.scrollTo({top:0}); } };
S.toast=(t,ms)=>{ const old=document.querySelector('.toast'); if(old) old.remove(); const d=document.createElement('div'); d.className='toast'; d.setAttribute('role','status'); d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(),ms||3200); };
S.vibrate=ms=>{ try{ navigator.vibrate&&navigator.vibrate(ms||25); }catch(e){} };

/* ── вердикт → тон: ok — верно, bad — ошибка, calm — не могу утверждать (спокойно, это просьба, а не поломка) ── */
const tone=S.tone=v=>/^(верно|ответы верны|данные нанесены верно|другое решение)/.test(v||'')?'ok':/ошибка|не тот вариант/.test(v||'')?'bad':'calm';
const PART={a:'Высота пирамиды',b:'Угол между гранями SAB и ABC',c:'Истинный вид треугольника ABC',d:'Угол SA с основанием'};
const PNUM={a:'1',b:'2',c:'3',d:'4'}, NUMP={'1':'a','2':'b','3':'c','4':'d'};
S.PART=PART;
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;

/* причины «часть N: статус — пояснение» → по частям */
function partsFromWhy(why){ const out={}; (why||[]).forEach(w=>{ const m=/^часть (\d): (верно|ошибка|не могу утверждать|ошибка в данных)\s*—?\s*(.*)$/.exec(w); if(m&&NUMP[m[1]]) out[NUMP[m[1]]]={st:m[2],why:m[3]?[m[3]]:[]}; }); return out; }
/* шаг построения со статусом «ошибка» — где именно */
const badStep=ex=>ex&&ex.steps?ex.steps.findIndex(s=>s.status==='bad'):-1;

/* одна фраза и просьба для карточки чертежа */
function phrase(d){ const t=tone(d.verdict), ps=d.parts||{}, ks=Object.keys(ps).filter(k=>PART[k]);
  const okK=ks.filter(k=>ps[k].st==='верно'), badK=ks.filter(k=>/ошибка/.test(ps[k].st));
  const clean=s=>String(s||'').replace(/\s*\([^)]*\)\s*$/,'').replace(/;.*$/,'');
  if(t==='ok'){ const k=d.part||okK[0]; return {say:k?(k!==d.part?PART[k]+' — построено верно':'Построено верно')+(ps[k]&&ps[k].why[0]?': '+clean(ps[k].why[0])+'.':'.'):'Построение сходится с условием варианта.'}; }
  if(t==='bad'){ const k=badK[0]||d.part, j=badStep(d.ex); let where=null;
    if(j>=0){ const s=d.ex.steps[j]; where='Шаг '+(j+1)+' — '+s.name+': '+s.msg; }
    else if(k&&ps[k]&&ps[k].why[0]) where=cap(ps[k].why[0]);
    else if(/ошибка в данных/.test(d.verdict)) where=cap((d.why||[]).find(w=>/вместо|не там/.test(w))||'условие нанесено не по данным варианта');
    return {say:/данных/.test(d.verdict)?'Условие нанесено не по данным варианта.':k&&k!==d.part?PART[k]+': в построении ошибка.':'В построении ошибка.',where}; }
  /* не могу утверждать: какая часть — не опознана или построение не сошлось уверенно */
  const all=(d.why||[]).join(' '), small=/мелко|px\/мм|ближе/.test(all), read=d.verdict==='не могу прочитать'||d.verdict==='не снят';
  if(d.verdict==='не снят') return {say:'Этот чертёж ещё не снят.',ask:'Поднесите телефон к нему — он займёт весь кадр.'};
  const none=ks.length&&ks.every(k=>/^не нашёл/.test(ps[k].why[0]||''));
  if(none) return {say:'Вижу условие, но построения на нём не нашёл — возможно, чертёж не дочерчен.',ask:'Если он закончен — снимите его ближе, чтобы занял весь кадр.'};
  return {say:read?'Не разобрал линии на этом снимке.':ks.length?'Вижу построение, но уверенно сказать не могу.':'Не понял, какая это часть задания.',
    ask:small?'Снимите этот чертёж ближе — чтобы он занял весь кадр.':read?'Переснимите при ровном свете, без блика — чертёж целиком в кадре.':'Переснимите этот чертёж крупно и ровно — тогда проверю каждую линию.'}; }

/* ответ потока (или серии по чертежам) → список чертежей для экрана */
S.fromWorker=r=>{ if(!r) return [];
  if(r.drawings&&r.drawings.length) return r.drawings.map((d,i)=>{ const e=(r.eyesPts||[])[i]||{}, ps=partsFromWhy(d.why), m=/—\s*(\d)\)/.exec(d.title||'');
    return {i,title:'Чертёж '+(i+1),part:m?NUMP[m[1]]:null,verdict:d.verdict,why:d.why||[],parts:ps,ex:d.ex,svg:d.svg,fig:d.fig||e.fig||null,O:e.O||null,box:e.box||null}; });
  /* один чертёж (лист в клетку или один крупный): сам ответ */
  const ps=partsFromWhy(r.why), shown=Object.keys(ps).filter(k=>ps[k].st==='верно');
  return [{i:0,title:'Чертёж',part:shown.length===1?shown[0]:null,verdict:r.verdict,why:r.why||[],parts:ps,ex:r.ex,svg:r.svg,fig:r.fig||null,O:null,box:null}]; };

/* итог съёмки по чертежам (closeup.js Session.result) + чертежи общего снимка → список чертежей для экрана */
S.fromSession=(R,ovd)=>R.map((r,j)=>({i:j,title:'Чертёж '+(j+1),sub:ovd[j].pos+' · снимков '+r.read+' из '+r.n,part:r.part,verdict:r.verdict,why:(r.why||[]).filter(Boolean),parts:r.parts,ex:null,svg:null,fig:null,quad:ovd[j].box}));

/* ── картинка: ImageData / canvas / img → canvas ── */
S.toCanvas=(src,long)=>{ const W=src.naturalWidth||src.videoWidth||src.width, H=src.naturalHeight||src.videoHeight||src.height, k=Math.min(1,(long||1e9)/Math.max(W,H)), c=document.createElement('canvas');
  c.width=Math.round(W*k); c.height=Math.round(H*k); const g=c.getContext('2d');
  if(src.data&&!src.getContext){ const t=document.createElement('canvas'); t.width=W; t.height=H; t.getContext('2d').putImageData(src instanceof ImageData?src:new ImageData(new Uint8ClampedArray(src.data),W,H),0,0); g.drawImage(t,0,0,c.width,c.height); }
  else g.drawImage(src,0,0,c.width,c.height); return c; };
S.imageData=c=>{ const d=c.getContext('2d').getImageData(0,0,c.width,c.height); return {width:c.width,height:c.height,data:d.data}; };

/* файл (фото или PDF) → canvas, длинная сторона ≤ long. PDF — первая страница, через pdf.js (только при выборе PDF) */
const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfLib=null;
function loadPdfJs(){ if(pdfLib) return pdfLib; pdfLib=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=PDFJS+'pdf.min.js'; s.onload=()=>{ self.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js'; res(self.pdfjsLib); }; s.onerror=()=>{ pdfLib=null; rej(new Error('PDF открывается только с интернетом — сохраните страницу как фото')); }; document.head.appendChild(s); }); return pdfLib; }
S.fileToCanvas=async(f,long)=>{ long=long||3000;
  if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){ const lib=await loadPdfJs(), doc=await lib.getDocument({data:await f.arrayBuffer()}).promise, pg=await doc.getPage(1), v0=pg.getViewport({scale:1}), k=long/Math.max(v0.width,v0.height), v=pg.getViewport({scale:k});
    const c=document.createElement('canvas'); c.width=Math.round(v.width); c.height=Math.round(v.height); const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); await pg.render({canvasContext:g,viewport:v}).promise; return c; }
  if(self.createImageBitmap){ try{ const b=await createImageBitmap(f,{imageOrientation:'from-image'}); return S.toCanvas(b,long); }catch(e){} }
  return new Promise((res,rej)=>{ const u=URL.createObjectURL(f), im=new Image(); im.onload=()=>{ URL.revokeObjectURL(u); res(S.toCanvas(im,long)); }; im.onerror=()=>rej(new Error('не открывается как картинка')); im.src=u; }); };
/* перетаскивание файла на зону и на всю страницу */
S.dropZone=(el,onFile)=>{ if(!el) return; const over=on=>el.classList.toggle('over',on);
  ['dragenter','dragover'].forEach(t=>document.addEventListener(t,e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){ e.preventDefault(); over(true); } }));
  ['dragleave','drop'].forEach(t=>document.addEventListener(t,e=>{ if(t==='dragleave'&&e.relatedTarget) return; over(false); }));
  document.addEventListener('drop',e=>{ if(!e.dataTransfer||!e.dataTransfer.files.length) return; e.preventDefault(); onFile(e.dataTransfer.files[0]); }); };

/* ── поток проверки: worker-ui.js шлёт этапы {progress, …} и итог ── */
S.worker=(onProgress,onDone)=>{ const w=new Worker('dz/worker-ui.js'); w.onmessage=e=>{ const m=e.data; if(m&&m.progress) onProgress&&onProgress(m); else onDone&&onDone(m); }; return w; };

/* ── ожидание: этапы с галочками, фото со «сканирующей» полосой, время ── */
S.Wait=function(o){ const el=$(o.el||'scrWait'); let t0=Date.now(), tm=null, steps=o.steps.map(s=>Object.assign({st:'todo'},s));
  el.innerHTML='<div class="wait"><div class="wait-photo" aria-hidden="true"></div><div><h2 id="wTitle">'+esc(o.title||'Проверяю лист')+'</h2><p class="hint" id="wSub">'+esc(o.sub||'Всё считается здесь, на устройстве. Можно не держать телефон над листом.')+'</p>'
    +'<ol class="steps" aria-live="polite"></ol><div class="bar" aria-hidden="true"><i></i></div><p class="note" id="wTime"></p>'+(o.cancel?'<div class="foot" style="margin-top:14px"><button class="btn ghost" id="wCancel">'+I('back')+'Отменить</button></div>':'')+'</div></div>';
  if(o.img){ const c=S.toCanvas(o.img,600); el.querySelector('.wait-photo').appendChild(c); }
  if(o.cancel) $('wCancel').onclick=o.cancel;
  const ol=el.querySelector('.steps'), bar=el.querySelector('.bar i');
  const draw=()=>{ ol.innerHTML=steps.map(s=>'<li class="'+(s.st==='done'?'done':s.st==='now'?'now':'')+'"><span class="st">'+(s.st==='done'?I('ok'):'')+'</span><span>'+esc(s.t)+'</span>'+(s.small?'<small>'+esc(s.small)+'</small>':'')+'</li>').join('');
    const d=steps.reduce((a,s)=>a+(s.st==='done'?1:s.st==='now'?0.5:0),0); bar.style.width=Math.round(100*d/steps.length)+'%'; };
  const tick=()=>{ const s=Math.round((Date.now()-t0)/1000); $('wTime')&&($('wTime').textContent=s<4?'':'Прошло '+(s>=60?Math.floor(s/60)+' мин '+(s%60)+' с':s+' с')+(s>40?' — на телефоне проверка листа может занять пару минут':'')); };
  tm=setInterval(tick,1000); draw();
  return { set(k,st,patch){ const s=steps.find(x=>x.k===k); if(!s) return; s.st=st; if(patch) Object.assign(s,patch);
      /* всё до текущего — сделано */ if(st==='now'||st==='done'){ const i=steps.indexOf(s); steps.forEach((x,j)=>{ if(j<i&&x.st!=='done') x.st='done'; }); } draw(); },
    title(t,sub){ if(t!=null) $('wTitle').textContent=t; if(sub!=null) $('wSub').textContent=sub; },
    stop(){ clearInterval(tm); } }; };
/* этапы потока → строки ожидания (общий порядок для фото листа) */
S.waitSteps=()=>[{k:'photo',t:'Фото готово'},{k:'sheet',t:'Ищу лист'},{k:'find',t:'Ищу чертежи на листе'},{k:'check',t:'Проверяю построения'},{k:'done',t:'Собираю результат'}];
S.onProgress=(W,m)=>{ if(m.progress==='sheet') W.set('sheet','now');
  if(m.progress==='find'){ W.set('sheet','done',{t:'Посмотрел лист целиком'}); W.set('find','now',{t:'Ищу чертежи на листе'}); }
  if(m.progress==='found') W.set('find','done',{t:m.count?'Нашёл '+m.count+' '+plural(m.count,'чертёж','чертежа','чертежей'):'Чертежей не нашёл'});
  if(m.progress==='check') W.set('check','now',{t:'Проверяю чертёж '+m.i+(m.count?' из '+m.count:''),small:m.count?m.i+'/'+m.count:''}); };
const plural=S.plural=(n,a,b,c)=>{ const m=n%10, h=n%100; return m===1&&h!==11?a:m>=2&&m<=4&&(h<10||h>=20)?b:c; };

/* ── результат: сводка, лист с чертежами, карточки ── */
const COL={ok:'#13a35f',bad:'#e0252c',calm:'#6f84ab'}, FIG='rgba(26,90,224,.9)';   /* фигура условия — всегда синяя: вердикт — рамка и номер */
/* рамка чертежа на фото: из найденной фигуры (px) с полем, иначе — данная рамка */
function boxOf(d,W,H){ if(d.quad){ const c=d.quad.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]); return d.quad.map(p=>[c[0]+(p[0]-c[0])*0.82,c[1]+(p[1]-c[1])*0.82]); } let pts=null;
  if(d.fig&&d.fig.length) pts=[].concat(...d.fig); else if(d.box&&d.box.length===4&&typeof d.box[0]==='number') pts=[[d.box[0],d.box[1]],[d.box[2],d.box[3]]];
  if(!pts||!pts.length) return null; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; pts.forEach(p=>{ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); });
  const m=0.22*Math.max(x1-x0,y1-y0); x0=Math.max(0,x0-m); y0=Math.max(0,y0-m); x1=Math.min(W,x1+m); y1=Math.min(H,y1+m); return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]; }
function rrect(g,q,r){ const xs=q.map(p=>p[0]), ys=q.map(p=>p[1]), axis=Math.abs(q[0][1]-q[1][1])<1&&Math.abs(q[0][0]-q[3][0])<1;
  g.beginPath(); if(axis&&g.roundRect){ g.roundRect(Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),r); } else { q.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); } }
/* лист: фото, рамки чертежей цветом вердикта, найденная фигура условия поверх линий студента */
function paintSheet(cv,src,ds,o){ const W=src.width, H=src.height, k=Math.min(1,1600/Math.max(W,H)); cv.width=Math.round(W*k); cv.height=Math.round(H*k);
  const g=cv.getContext('2d'); g.drawImage(src,0,0,cv.width,cv.height); if(o.plain) return; const lw=Math.max(2,cv.width/360);
  ds.forEach(d=>{ const q=d._q; if(!q) return; const t=tone(d.verdict), Q=q.map(p=>[p[0]*k,p[1]*k]);
    g.save(); g.fillStyle=t==='ok'?'rgba(19,163,95,.07)':t==='bad'?'rgba(224,37,44,.08)':'rgba(111,132,171,.08)'; rrect(g,Q,14*lw/2.5); g.fill();
    g.strokeStyle=COL[t]; g.lineWidth=lw*1.3; if(t==='calm') g.setLineDash([lw*4,lw*3]); rrect(g,Q,14*lw/2.5); g.stroke(); g.restore();
    if(d.fig){ g.save(); g.strokeStyle=FIG; g.lineWidth=lw; g.lineCap='round'; g.lineJoin='round';
      d.fig.forEach(pl=>{ g.beginPath(); pl.forEach((p,i)=>i?g.lineTo(p[0]*k,p[1]*k):g.moveTo(p[0]*k,p[1]*k)); g.stroke(); }); g.restore(); } }); }
/* вырезка одного чертежа — для карточки (где именно) */
function paintCrop(cv,src,d){ const q=d._q; if(!q) return false; const xs=q.map(p=>p[0]), ys=q.map(p=>p[1]), x0=Math.max(0,Math.min(...xs)), y0=Math.max(0,Math.min(...ys)), w=Math.min(src.width,Math.max(...xs))-x0, h=Math.min(src.height,Math.max(...ys))-y0;
  if(w<20||h<20) return false; const k=Math.min(2,900/w); cv.width=Math.round(w*k); cv.height=Math.round(h*k); const g=cv.getContext('2d'); g.drawImage(src,x0,y0,w,h,0,0,cv.width,cv.height);
  if(d.fig){ g.strokeStyle=FIG; g.lineWidth=Math.max(2,cv.width/300); g.lineCap='round';
    d.fig.forEach(pl=>{ g.beginPath(); pl.forEach((p,i)=>i?g.lineTo((p[0]-x0)*k,(p[1]-y0)*k):g.moveTo((p[0]-x0)*k,(p[1]-y0)*k)); g.stroke(); }); } return true; }

/* сводка по листу */
function summary(ds){ const n={ok:0,bad:0,calm:0}; ds.forEach(d=>n[tone(d.verdict)]++); const N=ds.length, bad=ds.filter(d=>tone(d.verdict)==='bad').map(d=>d.i+1);
  const list=a=>a.length===1?String(a[0]):a.slice(0,-1).join(', ')+' и '+a[a.length-1];
  if(n.bad) return {t:'bad',h:N>1?'Ошибка в чертеже '+list(bad):'В построении ошибка',p:N>1?[n.ok?'верно — '+n.ok:'',n.calm?'не смог проверить — '+n.calm:''].filter(Boolean).join(', ').replace(/^./,c=>c.toUpperCase())+(n.ok||n.calm?'. ':'')+'Где ошибка — в карточке ниже.':'Где именно — ниже.'};
  if(n.ok===N) return {t:'ok',h:N>1?'Все '+N+' '+plural(N,'чертёж','чертежа','чертежей')+' верно':'Верно',p:'Построения сходятся с условием варианта.'};
  if(n.ok) return {t:'calm',h:'Верно '+n.ok+' из '+N,p:'Ещё '+n.calm+' '+plural(n.calm,'чертёж','чертежа','чертежей')+' не смог проверить уверенно — переснимите '+(n.calm>1?'их':'его')+' ближе, и я досмотрю.'};
  return {t:'calm',h:'Пока не могу утверждать',p:'Линии видны, но уверенного вывода нет. Переснимите чертежи ближе — по одному, при ровном свете.'}; }

/* полный экран результата. o: {el, src (canvas), ds, variant, demo, onReshoot(i), onNew, extra (html), tech} */
/* рисунок разбора потока (report3d.js) — по шагам части 4; у других частей ДЗ № 3 его не показываем */
const svgOk=d=>!!d.svg&&(!d.part||d.part==='d');
S.renderResult=o=>{ const el=$(o.el||'scrResult'), ds=o.ds, src=o.src, Sm=summary(ds);
  ds.forEach(d=>{ d._q=src?boxOf(d,src.width,src.height):null; });
  const pinOf=d=>{ const q=d._q; if(!q) return null; return q.reduce((a,p)=>p[0]+p[1]<a[0]+a[1]?p:a); };
  const ic=t=>I(t==='ok'?'ok':t==='bad'?'bad':'q'), word=t=>t==='ok'?'Верно':t==='bad'?'Ошибка':'Не могу утверждать';
  el.innerHTML=(o.demo?'<div class="demo-badge">'+I('play')+' Пример · '+esc(o.demo)+'</div>':'')
    +'<div class="res"><div class="col-a">'
    +'<div class="sum '+Sm.t+'"><div class="big">'+ic(Sm.t)+'</div><div><h1 id="vtitle">'+esc(Sm.h)+'</h1><p>'+esc(Sm.p)+'</p>'+(o.variant?'<p class="note" style="margin-top:4px">ДЗ № '+(o.dz||3)+' · вариант '+esc(o.variant)+'</p>':'')+'</div></div>'
    +(src?'<div class="sheet" style="margin-top:14px" id="sheetBox"><div class="lay-tog"><button class="btn sm" id="layBtn" aria-pressed="true">Только фото</button></div><canvas id="sheetCv" role="img" aria-label="Фото листа: чертежи отмечены номерами и цветом вердикта"></canvas><div class="pins" id="pins"></div>'
      +'<div class="sheet-cap"><span><i></i>синее — фигура условия, найденная на ваших линиях</span><span><b style="color:#13a35f">■</b> верно</span><span><b style="color:#e0252c">■</b> ошибка</span><span><b style="color:#6f84ab">■</b> не могу утверждать</span></div></div>':'')
    +(o.extra||'')+'</div>'
    +'<div class="col-b"><ol class="cards" id="vwhy" style="list-style:none;margin:0;padding:0">'+ds.map(d=>{ const t=tone(d.verdict), ph=phrase(d), stepsH=d.ex&&d.ex.steps&&d.ex.steps.length>1||d.ex&&d.ex.steps&&d.ex.steps[0]&&d.ex.steps[0].status!=='?'?d.ex.steps:null;
      return '<li class="card '+t+'" id="card'+d.i+'" data-i="'+d.i+'"><div class="card-h"><span class="num">'+(ds.length>1?d.i+1:ic(t))+'</span><div style="min-width:0"><h3>'+esc(d.part?PNUM[d.part]+'. '+PART[d.part]:d.title)+'</h3>'+(d.part&&ds.length>1?'<div class="sub">'+esc(d.title+(d.sub?' · '+d.sub:''))+'</div>':d.sub?'<div class="sub">'+esc(d.sub)+'</div>':'')+'</div><span class="pill">'+ic(t)+word(t)+'</span></div>'
        +'<p class="say">'+esc(ph.say)+'</p>'
        +(ph.where?'<div class="where">'+I('pin')+'<div><b>Где:</b> '+esc(ph.where)+'</div></div>':'')
        +(ph.ask?'<div class="ask">'+I('cam')+'<div>'+esc(ph.ask)+'</div></div>':'')
        +(t==='bad'&&src&&d._q?'<div class="crop"><canvas data-crop="'+d.i+'" data-now="1" role="img" aria-label="Чертёж '+(d.i+1)+' на фото"></canvas></div>':'')
        +(t==='bad'&&svgOk(d)?'<div class="svgbox" aria-label="Разбор: красное — как у вас, зелёное — как надо">'+d.svg.replace(/width="\d+(\.\d+)?" height="\d+(\.\d+)?"/,'')+'</div><p class="note">Разбор: красное — как у вас, зелёное — как надо.</p>':'')
        +'<div class="acts">'+(o.onReshoot?'<button class="btn '+(t==='calm'?'pri':'')+' sm" data-act="reshoot">'+I('redo')+'Переснять этот чертёж</button>':'')+(src&&d._q&&ds.length>1?'<button class="btn ghost sm" data-act="show">'+I('pin')+'На листе</button>':'')+'</div>'
        +'<details class="why"><summary>Почему '+I('down')+'</summary>'
          +(stepsH?'<div class="ksteps">'+stepsH.map((s,j)=>'<div class="'+(s.status==='ok'?'ok':s.status==='bad'?'bad':'ref')+'"><i>'+(s.status==='ok'?'✓':s.status==='bad'?'✕':'?')+'</i><span>'+esc(s.name)+' — '+esc(s.msg)+'</span></div>').join('')+'</div>':'')
          +'<ul>'+(d.why||[]).filter(Boolean).map(w=>'<li>'+esc(cap(w))+'</li>').join('')+'</ul>'
          +(src&&d._q&&t!=='bad'?'<div class="crop"><canvas data-crop="'+d.i+'"></canvas></div>':'')
          +(t!=='bad'&&svgOk(d)?'<div class="svgbox">'+d.svg.replace(/width="\d+(\.\d+)?" height="\d+(\.\d+)?"/,'')+'</div>':'')+'</details>'
        +'</li>'; }).join('')+'</ol>'
    +'<div class="foot" style="margin-top:16px">'+(o.onNew?'<button class="btn pri" id="newBtn">'+I('cam')+'Новый лист</button>':'')+(o.onRerun?'<button class="btn" id="rerunBtn">'+I('redo')+'Проверить заново</button>':'')+'</div>'
    +(o.note?'<p class="note">'+esc(o.note)+'</p>':'')
    +'<details class="tech"><summary>Технические подробности</summary><div id="frames">'+(o.log||[]).map(l=>'<div>'+esc(l)+'</div>').join('')+'</div><pre>'+esc(o.tech||'')+'</pre></details>'
    +'</div></div>';
  /* лист и номера */
  let plain=false; const cv=$('sheetCv');
  const paint=()=>{ if(!cv) return; paintSheet(cv,src,ds,{plain}); const pins=$('pins'); pins.innerHTML=plain?'':ds.map(d=>{ const p=pinOf(d); if(!p) return ''; const t=tone(d.verdict);
      return '<button class="pin '+t+'" data-i="'+d.i+'" style="left:'+(100*Math.max(0.04,Math.min(0.96,p[0]/src.width)))+'%;top:'+(100*Math.max(0.03,Math.min(0.97,p[1]/src.height)))+'%;animation-delay:'+(d.i*70)+'ms" aria-label="Чертёж '+(d.i+1)+': '+word(t)+'">'+(ds.length>1?d.i+1:'')+'</button>'; }).join(''); };
  paint();
  if($('layBtn')) $('layBtn').onclick=()=>{ plain=!plain; $('layBtn').textContent=plain?'Показать разбор':'Только фото'; $('layBtn').setAttribute('aria-pressed',String(!plain)); paint(); };
  const hl=(i,on)=>{ const c=$('card'+i), p=el.querySelector('.pin[data-i="'+i+'"]'); c&&c.classList.toggle('hl',on); p&&p.classList.toggle('hl',on); };
  el.onclick=e=>{ const pin=e.target.closest('.pin'); if(pin){ const c=$('card'+pin.dataset.i); c.scrollIntoView({behavior:'smooth',block:'center'}); hl(+pin.dataset.i,true); setTimeout(()=>hl(+pin.dataset.i,false),1400); return; }
    const b=e.target.closest('[data-act]'); if(!b) return; const i=+b.closest('.card').dataset.i;
    if(b.dataset.act==='reshoot') o.onReshoot(i);
    if(b.dataset.act==='show'){ $('sheetBox').scrollIntoView({behavior:'smooth',block:'start'}); hl(i,true); setTimeout(()=>hl(i,false),1600); } };
  el.querySelectorAll('.card').forEach(c=>{ c.onmouseenter=()=>hl(+c.dataset.i,true); c.onmouseleave=()=>hl(+c.dataset.i,false); });
  el.querySelectorAll('canvas[data-now]').forEach(c=>{ if(!paintCrop(c,src,ds[+c.dataset.crop])) c.parentNode.remove(); });
  el.querySelectorAll('details.why').forEach(dt=>dt.addEventListener('toggle',()=>{ const c=dt.querySelector('canvas[data-crop]'); if(dt.open&&c&&!c.width) { if(!paintCrop(c,src,ds[+c.dataset.crop])) c.parentNode.remove(); } }));
  if($('newBtn')) $('newBtn').onclick=o.onNew; if($('rerunBtn')) $('rerunBtn').onclick=o.onRerun;
  S.screen(el.id); };

/* ── примеры: синтетические листы (lab/dz/quadsynth.js), проверенные этим же сканером заранее (lab/scan-demo/make.js) ── */
/* загружаются сразу со страницей — дальше показ не зависит от сети */
const EX={};
const exGet=x=>EX[x.json]||(EX[x.json]=Promise.all([fetch('scan-demo/'+x.json).then(r=>r.json()),new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src='scan-demo/'+x.img; })]).catch(e=>{ delete EX[x.json]; throw e; }));
S.examples=async()=>{ try{ const r=await fetch('scan-demo/index.json'), list=r.ok?await r.json():[]; list.forEach(x=>exGet(x).catch(()=>{})); return list; }catch(e){ return []; } };
S.renderExamples=(el,list,onPick)=>{ if(!el) return; if(!list.length){ el.closest('[data-examples]')&&(el.closest('[data-examples]').hidden=true); return; }
  el.innerHTML=list.map((x,i)=>'<button class="ex" data-i="'+i+'"><img src="scan-demo/'+esc(x.thumb||x.img)+'" alt="" loading="lazy" width="300" height="400"><b>'+esc(x.name)+'</b><small><span class="dot '+(x.tone==='bad'?'bad':x.tone==='calm'?'calm':'')+'"></span>'+esc(x.note)+'</small></button>').join('');
  el.onclick=e=>{ const b=e.target.closest('.ex'); if(b) onPick(list[+b.dataset.i]); }; };
S.loadExample=async x=>{ const [r,im]=await exGet(x); return {r:JSON.parse(JSON.stringify(r)),src:S.toCanvas(im)}; };
})();
