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
/* камера внутри кабинета — на весь экран телефона: кабинет растягивает рамку сканера (lk/app.js fitLab) */
S.full=on=>{ try{ if(window.parent!==window) window.parent.postMessage({type:'nch-lab-full',on:!!on},location.origin); }catch(e){} };
const dark=()=>root.dataset.theme?root.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;
S.themeBtn=b=>{ if(!b) return; const sync=()=>{ b.innerHTML=I(dark()?'sun':'moon'); b.setAttribute('aria-label',dark()?'Светлая тема':'Тёмная тема'); };
  sync(); b.onclick=()=>{ const t=dark()?'light':'dark'; root.dataset.theme=t; try{ localStorage.setItem('nch2_theme',JSON.stringify(t)); }catch(e){} sync(); }; };

/* ── экраны: один на странице; «назад» браузера возвращает на старт ── */
let cur=null;
S.screen=id=>{ document.querySelectorAll('.scr').forEach(e=>{ e.hidden=e.id!==id; }); if(cur!==id){ cur=id; const e=$(id); if(e){ e.style.animation='none'; void e.offsetWidth; e.style.animation=''; } window.scrollTo({top:0}); } };
S.toast=(t,ms)=>{ const old=document.querySelector('.toast'); if(old) old.remove(); const d=document.createElement('div'); d.className='toast'; d.setAttribute('role','status'); d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(),ms||3200); };
S.vibrate=ms=>{ try{ navigator.vibrate&&navigator.vibrate(ms||25); }catch(e){} };

/* ── ИИ-зрение через кабинет: страница открыта в нём (тот же сайт), кабинет ходит в /api/eyes с токеном участника.
   Модель говорит только «где какой чертёж и какая часть»; меряет и решает сканер. Без кабинета, без сети или при сбое —
   свои глаза (поиск по линиям), сканер работает как обычно ── */
const PARENT=window.parent!==window?window.parent:null, aiWait={}; let aiSeq=0, aiCb=null; S.ai={on:false,model:''};
window.addEventListener('message',e=>{ const d=e.data; if(e.origin!==location.origin||!d) return;
  if(d.type==='nch-eyes-pong'){ S.ai.on=!!d.on; aiCb&&aiCb(S.ai.on); }
  if(d.type==='nch-eyes-r'&&aiWait[d.id]){ aiWait[d.id](d); delete aiWait[d.id]; } });
S.aiPing=cb=>{ aiCb=cb; if(PARENT) try{ PARENT.postMessage({type:'nch-eyes-ping'},location.origin); }catch(e){} };
/* снимок → JPEG, длинная сторона 1280 px (модели хватает, запрос лёгкий); consent — можно зарубежной модели */
S.askEyes=(img,dz,n,consent)=>{ if(!PARENT||!S.ai.on) return Promise.resolve({ok:false,error:'ИИ-зрение недоступно'});
  const W=img.width, H=img.height, k=Math.min(1,1280/Math.max(W,H)), c=document.createElement('canvas'); c.width=Math.round(W*k); c.height=Math.round(H*k);
  if(img.getContext) c.getContext('2d').drawImage(img,0,0,c.width,c.height); else { const t=document.createElement('canvas'); t.width=W; t.height=H; t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data.buffer||img.data),W,H),0,0); c.getContext('2d').drawImage(t,0,0,c.width,c.height); }
  const id=++aiSeq, url=c.toDataURL('image/jpeg',0.85);
  return new Promise(res=>{ const to=setTimeout(()=>{ delete aiWait[id]; res({ok:false,error:'модель не ответила за минуту'}); },65000);
    aiWait[id]=d=>{ clearTimeout(to); if(d.ok&&d.model) S.ai.model=d.model; res(Object.assign(d,{scale:k})); };
    PARENT.postMessage({type:'nch-eyes',id,img:url,w:c.width,h:c.height,dz,n,consent:!!consent},location.origin); }); };
S.modelName=m=>String(m||'').replace(/^gpt:\/\/[^/]+\//,'').replace(/\/latest$/,'');

/* ── вердикт → тон: ok — верно, bad — ошибка, calm — не могу утверждать (спокойно, это просьба, а не поломка) ── */
const tone=S.tone=v=>/^(верно|ответы верны|данные нанесены верно|другое решение)/.test(v||'')?'ok':/ошибка|не тот вариант/.test(v||'')?'bad':'calm';
const PART={a:'Высота пирамиды',b:'Угол между гранями SAB и ABC',c:'Истинный вид треугольника ABC',d:'Угол SA с основанием'};
const PSHORT={a:'Высота',b:'Угол граней',c:'Истинный вид ABC',d:'Угол SA с основанием'};
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
  if(t==='ok'){ const k=d.part||okK[0]; return {say:k?PART[k]+' — построено верно'+(ps[k]&&ps[k].why[0]?': '+clean(ps[k].why[0])+'.':'.'):'Построение сходится с условием варианта.'}; }
  if(t==='bad'){ const k=badK[0]||d.part, j=badStep(d.ex); let where=null;
    if(j>=0){ const s=d.ex.steps[j]; where='Шаг '+(j+1)+' — '+s.name+': '+s.msg; }
    else if(k&&ps[k]&&ps[k].why[0]) where=cap(ps[k].why[0]);
    else if(/ошибка в данных/.test(d.verdict)) where=cap((d.why||[]).find(w=>/вместо|не там/.test(w))||'условие нанесено не по данным варианта');
    return {say:(k?PART[k]+': ':'')+(/данных/.test(d.verdict)?'условие нанесено с ошибкой.':'в построении ошибка.'),where}; }
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
    return {i,title:'Чертёж '+(i+1),part:d.part||(m?NUMP[m[1]]:null),verdict:d.verdict,why:d.why||[],parts:ps,ex:d.ex,svg:d.svg,fig:d.fig||e.fig||null,O:e.O||null,box:e.box||null,cons:d.cons||null}; });
  /* один чертёж (лист в клетку или один крупный): сам ответ */
  const ps=partsFromWhy(r.why), shown=Object.keys(ps).filter(k=>ps[k].st==='верно');
  return [{i:0,title:'Чертёж',part:shown.length===1?shown[0]:null,verdict:r.verdict,why:r.why||[],parts:ps,ex:r.ex,svg:r.svg,fig:r.fig||null,O:null,box:null,cons:r.cons||null}]; };

/* итог съёмки по чертежам (closeup.js Session.result) + чертежи общего снимка → список чертежей для экрана */
S.fromSession=(R,ovd)=>R.map((r,j)=>{ const A=ovd[j].A, m=A?p=>[A[0]*p[0]+A[1]*p[1]+A[2],A[3]*p[0]+A[4]*p[1]+A[5]]:null;
  /* что понял мозг на снимках вблизи (мм чертежа) → общий снимок: аффинное «мм условия → px» этого чертежа */
  const cons=r.geo?Object.fromEntries(Object.entries(r.geo).map(([k,g])=>[k,{st:r.parts[k]&&r.parts[k].st,geo:g,px:m?g.map(q=>q.t==='p'?Object.assign({},q,{p:m(q.p)}):Object.assign({},q,{a:m(q.a),b:m(q.b)})):null}])):null;
  return {i:j,title:'Чертёж '+(j+1),sub:ovd[j].pos+' · снимков '+r.read+' из '+r.n,part:r.part,verdict:r.verdict,why:(r.why||[]).filter(Boolean),parts:r.parts,ex:null,svg:null,fig:null,quad:ovd[j].box,cons}; });

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
const COL={ok:'#13a35f',bad:'#e0252c',calm:'#6f84ab'};
/* рамка чертежа на фото: из найденной фигуры (px) с полем, иначе — данная рамка */
function boxOf(d,W,H){ if(d.quad) return d.quad; let pts=null;
  if(d.fig&&d.fig.length) pts=[].concat(...d.fig); else if(d.box&&d.box.length===4&&typeof d.box[0]==='number') pts=[[d.box[0],d.box[1]],[d.box[2],d.box[3]]];
  if(!pts||!pts.length) return null; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; pts.forEach(p=>{ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); });
  const m=0.22*Math.max(x1-x0,y1-y0); x0=Math.max(0,x0-m); y0=Math.max(0,y0-m); x1=Math.min(W,x1+m); y1=Math.min(H,y1+m); return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]; }
function rrect(g,q,r){ const xs=q.map(p=>p[0]), ys=q.map(p=>p[1]), axis=Math.abs(q[0][1]-q[1][1])<1&&Math.abs(q[0][0]-q[3][0])<1;
  g.beginPath(); if(axis&&g.roundRect){ g.roundRect(Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),r); } else { q.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); } }
/* построение части поверх фото: у опознанного чертежа — понятое мозгом (geo, px снимка); иначе — найденная фигура условия */
const geoPx=d=>d.part&&d.cons&&d.cons[d.part]&&d.cons[d.part].px;
const toneOf=d=>d.part&&d.parts&&d.parts[d.part]?(d.parts[d.part].st==='верно'?'ok':d.parts[d.part].st==='ошибка'?'bad':'calm'):tone(d.verdict);
/* лист: фото, рамки чертежей цветом вердикта части, построение — поверх линий студента */
function paintSheet(cv,src,ds,o){ const W=src.width, H=src.height, k=Math.min(1,1600/Math.max(W,H)); cv.width=Math.round(W*k); cv.height=Math.round(H*k);
  const g=cv.getContext('2d'); g.drawImage(src,0,0,cv.width,cv.height); if(o.plain) return; const lw=Math.max(2,cv.width/360);
  ds.forEach(d=>{ const q=d._q; if(!q) return; const t=toneOf(d), Q=q.map(p=>[p[0]*k,p[1]*k]);
    g.save(); g.fillStyle='rgba(255,255,255,.18)'; rrect(g,Q,14*lw/2.5); g.fill();
    g.strokeStyle=COL[t]; g.lineWidth=lw*1.3; if(t==='calm') g.setLineDash([lw*4,lw*3]); rrect(g,Q,14*lw/2.5); g.stroke(); g.restore();
    const gp=geoPx(d); if(gp){ paintGeo(g,gp,k,0,0,lw*0.7); return; }
    if(d.fig){ g.save(); g.strokeStyle='rgba(111,132,171,.75)'; g.lineWidth=lw*0.6; g.lineCap='round'; g.lineJoin='round';
      d.fig.forEach(pl=>{ g.beginPath(); pl.forEach((p,i)=>i?g.lineTo(p[0]*k,p[1]*k):g.moveTo(p[0]*k,p[1]*k)); g.stroke(); }); g.restore(); } }); }
/* вырезка одного чертежа — для карточки: фото и построение части поверх */
function paintCrop(cv,src,d,part){ const q=d._q; if(!q) return false; const xs=q.map(p=>p[0]), ys=q.map(p=>p[1]), x0=Math.max(0,Math.min(...xs)), y0=Math.max(0,Math.min(...ys)), w=Math.min(src.width,Math.max(...xs))-x0, h=Math.min(src.height,Math.max(...ys))-y0;
  if(w<20||h<20) return false; const k=Math.min(2,900/w); cv.width=Math.round(w*k); cv.height=Math.round(h*k); const g=cv.getContext('2d'); g.drawImage(src,x0,y0,w,h,0,0,cv.width,cv.height);
  const gp=part&&d.cons&&d.cons[part]&&d.cons[part].px; if(gp) paintGeo(g,gp,k,x0,y0,Math.max(1.6,cv.width/380));
  else if(d.fig){ g.strokeStyle='rgba(70,110,200,.9)'; g.lineWidth=Math.max(2,cv.width/300); g.lineCap='round';
    d.fig.forEach(pl=>{ g.beginPath(); pl.forEach((p,i)=>i?g.lineTo((p[0]-x0)*k,(p[1]-y0)*k):g.moveTo((p[0]-x0)*k,(p[1]-y0)*k)); g.stroke(); }); } return true; }

/* сводка по листу */
function summary(ds){ const n={ok:0,bad:0,calm:0}; ds.forEach(d=>n[tone(d.verdict)]++); const N=ds.length, bad=ds.filter(d=>tone(d.verdict)==='bad').map(d=>d.i+1);
  const list=a=>a.length===1?String(a[0]):a.slice(0,-1).join(', ')+' и '+a[a.length-1];
  if(n.bad) return {t:'bad',h:N>1?'Ошибка в чертеже '+list(bad):'В построении ошибка',p:N>1?'Что не так — в карточке '+(bad.length>1?'каждого':'чертежа')+'. Остальное: '+(n.ok?'верно — '+n.ok:'')+(n.ok&&n.calm?', ':'')+(n.calm?'проверить не смог — '+n.calm:'')+'.':'Где именно — ниже.'};
  if(n.ok===N) return {t:'ok',h:N>1?'Все '+N+' '+plural(N,'чертёж','чертежа','чертежей')+' верно':'Верно',p:'Построения сходятся с условием варианта.'};
  if(n.ok) return {t:'calm',h:'Верно '+n.ok+' из '+N,p:'Ещё '+n.calm+' '+plural(n.calm,'чертёж','чертежа','чертежей')+' не смог проверить уверенно — переснимите '+(n.calm>1?'их':'его')+' ближе, и я досмотрю.'};
  return {t:'calm',h:'Пока не могу утверждать',p:'Линии видны, но уверенного вывода нет. Переснимите чертежи ближе — по одному, при ровном свете.'}; }

/* ── чистый чертёж: то, что понял мозг (check3 geo), — отдельно (SVG в мм чертежа) и поверх фото ──
   заданная пирамида — серым; построение части — синим (оси — штрихпунктир, линии связи — тонкие, ответ — толще);
   где у студента не так — красным, где должно быть — зелёным кружком */
const GEO_COL={ax:'#5d7bb5',lnk:'#8fa6cf',eg:'#2a5bd7',res:'#1a46c4',pt:'#1a46c4',bad:'#e0252c',good:'#13a35f'};
function figOf(n){ try{ const L=self.LAB, gv=self.CORE.dzVariants.get(3,+n); return L&&L.dzModel&&gv?L.dzModel.given(gv.id,gv.data).segs:null; }catch(e){ return null; } }
S.cleanSvg=(geo,fig)=>{ if(!geo||!geo.length) return '';
  const pts=geo.flatMap(q=>q.t==='p'?[q.p]:[q.a,q.b]).concat((fig||[]).flatMap(q=>[q.a,q.b]));
  const x0=Math.min(...pts.map(p=>p[0]))-6, x1=Math.max(...pts.map(p=>p[0]))+10, y0=Math.min(...pts.map(p=>p[1]))-6, y1=Math.max(...pts.map(p=>p[1]))+6, n2=v=>Math.round(v*100)/100;
  const o=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+n2(x0)+' '+n2(y0)+' '+n2(x1-x0)+' '+n2(y1-y0)+'" font-family="system-ui,sans-serif" role="img" aria-label="Построение, как его понял сканер">',
    '<rect x="'+n2(x0)+'" y="'+n2(y0)+'" width="'+n2(x1-x0)+'" height="'+n2(y1-y0)+'" fill="#fff"/>'];
  const ln=(a,b,c,w,da)=>o.push('<line x1="'+n2(a[0])+'" y1="'+n2(a[1])+'" x2="'+n2(b[0])+'" y2="'+n2(b[1])+'" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round"'+(da?' stroke-dasharray="'+da+'"':'')+'/>');
  (fig||[]).forEach(q=>ln(q.a,q.b,'#7d8696',q.k==='hid'?0.25:0.4,q.k==='hid'?'1.6 1':''));
  const W={ax:0.3,lnk:0.18,eg:0.35,res:0.6,bad:0.55,good:0.45}, DA={ax:'5 1.2 1 1.2',lnk:'1.2 0.9',good:'3 1.5'};
  geo.filter(q=>q.t==='l').forEach(q=>{ ln(q.a,q.b,GEO_COL[q.k]||GEO_COL.eg,W[q.k]||0.35,DA[q.k]); if(q.l) o.push('<text x="'+n2(q.b[0]+1)+'" y="'+n2(q.b[1]-1)+'" font-size="3.2" fill="'+(GEO_COL[q.k]||GEO_COL.ax)+'">'+esc(q.l)+'</text>'); });
  geo.filter(q=>q.t==='p').forEach(q=>{ const c=GEO_COL[q.k]||GEO_COL.pt; o.push('<circle cx="'+n2(q.p[0])+'" cy="'+n2(q.p[1])+'" r="'+(q.k==='pt'?0.9:1.5)+'" fill="'+(q.k==='pt'?c:'none')+'" stroke="'+c+'" stroke-width="0.5"/>');
    if(q.l) o.push('<text x="'+n2(q.p[0]+1.6)+'" y="'+n2(q.p[1]-1.4)+'" font-size="3.2" fill="'+c+'"'+(q.k==='bad'?' font-weight="700"':'')+'>'+esc(q.l)+'</text>'); });
  o.push('</svg>'); return o.join(''); };
/* то же построение поверх фото (px снимка): g — 2d, k — масштаб холста, ox/oy — сдвиг (вырезка) */
function paintGeo(g,px,k,ox,oy,lw){ const P=p=>[(p[0]-(ox||0))*k,(p[1]-(oy||0))*k]; g.save(); g.lineCap='round';
  px.filter(q=>q.t==='l').forEach(q=>{ g.strokeStyle=GEO_COL[q.k]||GEO_COL.eg; g.globalAlpha=q.k==='lnk'?0.75:0.95; g.lineWidth=lw*(q.k==='res'||q.k==='bad'?1.25:q.k==='lnk'?0.5:0.8); g.setLineDash(q.k==='ax'?[lw*5,lw*2,lw,lw*2]:q.k==='lnk'?[lw*2,lw*1.6]:q.k==='good'?[lw*4,lw*2]:[]);
    g.beginPath(); g.moveTo(...P(q.a)); g.lineTo(...P(q.b)); g.stroke(); });
  g.setLineDash([]); g.globalAlpha=1; g.font='600 '+Math.round(lw*6)+'px system-ui,sans-serif';
  px.filter(q=>q.t==='p').forEach(q=>{ const c=GEO_COL[q.k]||GEO_COL.pt, p=P(q.p); g.strokeStyle=c; g.fillStyle=c; g.lineWidth=lw*0.9; g.beginPath(); g.arc(p[0],p[1],lw*(q.k==='pt'?1.4:2.6),0,7); q.k==='pt'?g.fill():g.stroke();
    if(q.l&&q.k!=='pt'){ g.lineWidth=lw*2; g.strokeStyle='rgba(255,255,255,.9)'; g.strokeText(q.l,p[0]+lw*3,p[1]-lw*3); g.fillText(q.l,p[0]+lw*3,p[1]-lw*3); } });
  g.restore(); }

/* ── ДЗ № 3: четыре части листа → четыре карточки. Часть — у чертежа, который мозг опознал по построению (или подтвердил
   подсказку модели); у неопознанного чертежа части нет — «не понял, какая это часть», вердикта по нему не придумываем ── */
const cut=s=>String(s||'').replace(/;.*$/,'').replace(/\s*\([^)]*\)\s*$/,'');
function partCards(ds){ const unk=ds.filter(d=>!d.part&&d.verdict!=='не снят'), free=unk.slice();
  return ['a','b','c','d'].map(k=>{ const d=ds.find(x=>x.part===k), p=d&&d.parts&&d.parts[k];
    if(d&&p){ const st=p.st==='верно'?'ok':p.st==='ошибка'?'bad':'calm', w=(p.why||[]).filter(Boolean);
      if(st==='ok') return {k,d,t:'ok',say:'Построено верно'+(w[0]?': '+cut(w[0])+'.':'.')};
      if(st==='bad'){ const j=badStep(d.ex); return {k,d,t:'bad',say:'В построении ошибка.',where:j>=0?'шаг '+(j+1)+' — '+d.ex.steps[j].name+': '+d.ex.steps[j].msg.split(/:\s/)[0]:cap(String(cut(w[0])||'смотрите разбор на чертеже').split(/:\s/)[0])}; }
      const small=/мелко|px\/мм|ближе/.test(w.join(' '));
      return {k,d,t:'calm',say:'Построение вижу, но не уверен: '+(small?'снимите ближе, во весь кадр.':'переснимите крупно, без блика.'),why1:w[0]}; }
    const g=free.shift();
    if(g) return {k,d:null,guess:g,t:'calm',say:'Не понял, какой чертёж — эта часть: снимите его крупно.'};
    const ns=ds.find(x=>x.verdict==='не снят');
    return {k,d:null,guess:ns||null,t:'calm',say:ns?'Ещё не снят — поднесите телефон к чертежу.':'Чертёж этой части не нашёл — снимите его крупно.'}; }); }
/* сводка по частям */
function partSummary(cs,ds){ const n={ok:0,bad:0,calm:0}; cs.forEach(c=>n[c.t]++); const nm=t=>cs.filter(c=>c.t===t).map(c=>PNUM[c.k]), list=a=>a.length===1?a[0]:a.slice(0,-1).join(', ')+' и '+a[a.length-1];
  const data=ds.find(d=>/ошибка в данных/.test(d.verdict));
  if(n.bad) return {t:'bad',h:'Ошибка в част'+(n.bad>1?'ях ':'и ')+list(nm('bad')),p:(n.ok?'Верно: '+list(nm('ok'))+'. ':'')+(n.calm?'Не могу утверждать: '+list(nm('calm'))+'.':'')};
  if(data) return {t:'bad',h:'Условие нанесено с ошибкой',p:cap(cut((data.why||[]).find(w=>/вместо|не там/.test(w))||'точки условия не по данным варианта'))};
  if(n.ok===4) return {t:'ok',h:'Все 4 части верно',p:'Построения сходятся с условием варианта.'};
  if(n.ok) return {t:'calm',h:'Верно: '+list(nm('ok')),p:'Остальное не могу утверждать — переснимите '+(n.calm>1?'эти чертежи':'этот чертёж')+' ближе.'};
  return {t:'calm',h:'Пока не могу утверждать',p:'Переснимите чертежи ближе — по одному, при ровном свете.'}; }

/* полный экран результата. o: {el, src (canvas), ds, variant, dz, demo, onReshoot(i), onNew, onRerun, note, log, tech}.
   ДЗ № 3 — четыре карточки частей (одна фраза, подробности под «Подробнее»); иначе — карточки чертежей */
S.renderResult=o=>{ const el=$(o.el||'scrResult'), ds=o.ds, src=o.src, byPart=(o.dz||3)===3&&!o.whole;
  ds.forEach(d=>{ d._q=src?boxOf(d,src.width,src.height):null; });
  const cs=byPart?partCards(ds):null, Sm=byPart?partSummary(cs,ds):summary(ds), fig=byPart?figOf(o.variant):null;
  const pinOf=d=>{ const q=d._q; if(!q) return null; return [Math.min(...q.map(p=>p[0])),Math.min(...q.map(p=>p[1]))]; };
  const ic=t=>I(t==='ok'?'ok':t==='bad'?'bad':'q'), word=t=>t==='ok'?'Верно':t==='bad'?'Ошибка':'Не могу утверждать';
  const card=c=>{ const d=c.d, geo=d&&d.cons&&d.cons[c.k], svg=geo?S.cleanSvg(geo.geo,fig):'', tgt=d||c.guess;
    return '<li class="card pc '+c.t+'" id="pcard'+c.k+'" data-k="'+c.k+'"'+(tgt?' data-i="'+tgt.i+'"':'')+'><div class="card-h"><span class="num">'+PNUM[c.k]+'</span><h3 title="'+esc(PART[c.k])+'">'+esc(PSHORT[c.k])+'</h3><span class="pill">'+ic(c.t)+word(c.t)+'</span></div>'
      +'<p class="say">'+esc(c.say)+'</p>'+(c.where?'<div class="where">'+I('pin')+'<div>'+esc(c.where)+'</div></div>':'')+(c.ask?'<p class="ask1">'+esc(c.ask)+'</p>':'')
      +'<div class="acts">'+(d?'<button class="lnk" data-act="more" aria-expanded="false">'+I('down')+'Подробнее</button>':'')+(o.onReshoot&&tgt&&c.t!=='ok'?'<button class="btn '+(c.t==='calm'?'pri':'ghost')+' sm" data-act="reshoot" aria-label="Переснять этот чертёж">'+I('redo')+'Переснять<span class="lg">этот чертёж</span></button>':'')+'</div>'
      +(d?'<div class="more" hidden>'
        +(svg?'<figure class="clean">'+svg+'<figcaption>Как понял построение сканер'+(geo.geo.some(q=>q.k==='bad')?': <b style="color:#e0252c">красное</b> — у вас, <b style="color:#13a35f">зелёное</b> — где должно быть':'')+'. Серое — заданная пирамида.</figcaption></figure>':'')
        +(src&&d._q?'<div class="crop"><canvas data-crop="'+d.i+'" data-k="'+c.k+'"></canvas><p class="note">'+esc(d.title)+(d.sub?' · '+esc(d.sub):'')+' — на фото</p></div>':'')
        +(c.k==='d'&&d.ex&&d.ex.steps&&d.ex.steps.length?'<div class="ksteps">'+d.ex.steps.map(s=>'<div class="'+(s.status==='ok'?'ok':s.status==='bad'?'bad':'ref')+'"><i>'+(s.status==='ok'?'✓':s.status==='bad'?'✕':'?')+'</i><span>'+esc(s.name)+' — '+esc(s.msg)+'</span></div>').join('')+'</div>':'')
        +'<ul>'+(d.parts[c.k].why||[]).filter(Boolean).map(w=>'<li>'+esc(cap(w))+'</li>').join('')+'</ul>'+(o.onReshoot&&c.t==='ok'?'<div><button class="btn ghost sm" data-act="reshoot">'+I('redo')+'Переснять этот чертёж</button></div>':'')+'</div>':'')+'</li>'; };
  const dcard=d=>{ const t=tone(d.verdict), ph=phrase(d), stepsH=d.ex&&d.ex.steps&&d.ex.steps.length>1||d.ex&&d.ex.steps&&d.ex.steps[0]&&d.ex.steps[0].status!=='?'?d.ex.steps:null;
    return '<li class="card '+t+'" id="card'+d.i+'" data-i="'+d.i+'"><div class="card-h"><span class="num">'+(ds.length>1?d.i+1:ic(t))+'</span><div style="min-width:0"><h3>'+esc(d.title)+'</h3>'+(d.sub?'<div class="sub">'+esc(d.sub)+'</div>':'')+'</div><span class="pill">'+ic(t)+word(t)+'</span></div>'
      +'<p class="say">'+esc(ph.say)+'</p>'+(ph.where?'<div class="where">'+I('pin')+'<div><b>Где:</b> '+esc(ph.where)+'</div></div>':'')+(ph.ask?'<p class="ask1">'+esc(ph.ask)+'</p>':'')
      +(t==='bad'&&d.svg?'<div class="svgbox" aria-label="Разбор: красное — как у вас, зелёное — как надо">'+d.svg.replace(/width="\d+(\.\d+)?" height="\d+(\.\d+)?"/,'')+'</div>':'')
      +'<div class="acts">'+'<button class="btn ghost sm" data-act="more" aria-expanded="false">'+I('down')+'Подробнее</button>'+(o.onReshoot?'<button class="btn '+(t==='calm'?'pri':'ghost')+' sm" data-act="reshoot">'+I('redo')+'Переснять</button>':'')+'</div>'
      +'<div class="more" hidden>'+(stepsH?'<div class="ksteps">'+stepsH.map(s=>'<div class="'+(s.status==='ok'?'ok':s.status==='bad'?'bad':'ref')+'"><i>'+(s.status==='ok'?'✓':s.status==='bad'?'✕':'?')+'</i><span>'+esc(s.name)+' — '+esc(s.msg)+'</span></div>').join('')+'</div>':'')
        +'<ul>'+(d.why||[]).filter(Boolean).map(w=>'<li>'+esc(cap(w))+'</li>').join('')+'</ul>'+(src&&d._q?'<div class="crop"><canvas data-crop="'+d.i+'"></canvas></div>':'')+(t!=='bad'&&d.svg?'<div class="svgbox">'+d.svg.replace(/width="\d+(\.\d+)?" height="\d+(\.\d+)?"/,'')+'</div>':'')+'</div></li>'; };
  el.innerHTML=(o.demo?'<div class="demo-badge">'+I('play')+' Пример · '+esc(o.demo)+'</div>':'')
    +'<div class="res"><div class="col-b">'
    +'<div class="sum '+Sm.t+'"><div class="big">'+ic(Sm.t)+'</div><div><h1 id="vtitle">'+esc(Sm.h)+'</h1><p>'+esc(Sm.p)+(o.variant?' <span class="note">ДЗ № '+(o.dz||3)+' · вариант '+esc(o.variant)+'</span>':'')+'</p></div></div>'
    +'<ol class="cards" id="vwhy">'+(byPart?cs.map(card):ds.map(dcard)).join('')+'</ol>'
    +'<div class="foot">'+(o.onNew?'<button class="btn pri" id="newBtn">'+I('cam')+'Новый лист</button>':'')+(o.onRerun?'<button class="btn" id="rerunBtn">'+I('redo')+'Проверить заново</button>':'')+'</div></div>'
    +'<div class="col-a">'+(src?'<div class="sheet" id="sheetBox"><div class="lay-tog"><button class="btn sm" id="layBtn" aria-pressed="true">Только фото</button></div><canvas id="sheetCv" role="img" aria-label="Фото листа: чертежи отмечены номером части и цветом вердикта"></canvas><div class="pins" id="pins"></div>'
      +'<div class="sheet-cap"><span><b style="color:'+GEO_COL.res+'">—</b> построение, как его понял сканер</span><span><b style="color:#e0252c">■</b> ошибка</span><span><b style="color:#13a35f">■</b> верно</span><span><b style="color:#6f84ab">▫</b> не могу утверждать</span></div></div>':'')
    +(o.extra||'')
    +(o.note?'<p class="note">'+esc(o.note)+'</p>':'')
    +'<details class="tech"><summary>Технические подробности</summary><div id="frames">'+(o.log||[]).map(l=>'<div>'+esc(l)+'</div>').join('')+'</div><pre>'+esc(o.tech||'')+'</pre></details></div></div>';
  /* лист: номера — часть (1–4) или «?» */
  let plain=false; const cv=$('sheetCv');
  const paint=()=>{ if(!cv) return; paintSheet(cv,src,ds,{plain}); const pins=$('pins'); pins.innerHTML=plain?'':ds.map(d=>{ const p=pinOf(d); if(!p) return ''; const t=byPart?(d.part&&d.parts&&d.parts[d.part]?(d.parts[d.part].st==='верно'?'ok':d.parts[d.part].st==='ошибка'?'bad':'calm'):'calm'):tone(d.verdict);
      return '<button class="pin '+t+'" data-i="'+d.i+'" style="left:'+(100*Math.max(0.04,Math.min(0.96,p[0]/src.width)))+'%;top:'+(100*Math.max(0.03,Math.min(0.97,p[1]/src.height)))+'%;animation-delay:'+(d.i*70)+'ms" aria-label="'+esc(d.title)+': '+(byPart?(d.part?'часть '+PNUM[d.part]:'часть не опознана'):word(t))+'">'+(byPart?(d.part?PNUM[d.part]:'?'):ds.length>1?d.i+1:'')+'</button>'; }).join(''); };
  paint();
  if($('layBtn')) $('layBtn').onclick=()=>{ plain=!plain; $('layBtn').textContent=plain?'Показать разбор':'Только фото'; $('layBtn').setAttribute('aria-pressed',String(!plain)); paint(); };
  const cardOf=i=>byPart?el.querySelector('.card[data-i="'+i+'"]'):$('card'+i);
  const hl=(i,on)=>{ const c=cardOf(i), p=el.querySelector('.pin[data-i="'+i+'"]'); c&&c.classList.toggle('hl',on); p&&p.classList.toggle('hl',on); };
  el.onclick=e=>{ const pin=e.target.closest('.pin'); if(pin){ const c=cardOf(pin.dataset.i); if(c){ c.scrollIntoView({behavior:'smooth',block:'center'}); hl(+pin.dataset.i,true); setTimeout(()=>hl(+pin.dataset.i,false),1400); } return; }
    const b=e.target.closest('[data-act]'); if(!b) return; const c=b.closest('.card');
    if(b.dataset.act==='reshoot') o.onReshoot(+c.dataset.i);
    if(b.dataset.act==='more'){ const m=c.querySelector('.more'), on=m.hidden; m.hidden=!on; b.setAttribute('aria-expanded',String(on)); b.classList.toggle('open',on);
      const cc=m.querySelector('canvas[data-crop]'); if(on&&cc&&!cc.dataset.done){ cc.dataset.done='1'; if(!paintCrop(cc,src,ds[+cc.dataset.crop],cc.dataset.k)) cc.parentNode.remove(); } } };
  el.querySelectorAll('.card[data-i]').forEach(c=>{ c.onmouseenter=()=>hl(+c.dataset.i,true); c.onmouseleave=()=>hl(+c.dataset.i,false); });
  if($('newBtn')) $('newBtn').onclick=o.onNew; if($('rerunBtn')) $('rerunBtn').onclick=o.onRerun;
  S.screen(el.id); };

/* ── примеры: синтетические листы (lab/dz/quadsynth.js), проверенные этим же сканером заранее (lab/scan-demo/make.js) ── */
S.examples=async()=>{ try{ const r=await fetch('scan-demo/index.json'); return r.ok?await r.json():[]; }catch(e){ return []; } };
S.renderExamples=(el,list,onPick)=>{ if(!el) return; if(!list.length){ el.closest('[data-examples]')&&(el.closest('[data-examples]').hidden=true); return; }
  el.innerHTML=list.map((x,i)=>'<button class="ex" data-i="'+i+'"><img src="scan-demo/'+esc(x.thumb||x.img)+'" alt="" loading="lazy" width="300" height="400"><b>'+esc(x.name)+'</b><small><span class="dot '+(x.tone==='bad'?'bad':x.tone==='calm'?'calm':'')+'"></span>'+esc(x.note)+'</small></button>').join('');
  el.onclick=e=>{ const b=e.target.closest('.ex'); if(b) onPick(list[+b.dataset.i]); }; };
S.loadExample=async x=>{ const [r,im]=await Promise.all([fetch('scan-demo/'+x.json).then(r=>r.json()),new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src='scan-demo/'+x.img; })]);
  return {r,src:S.toCanvas(im)}; };
})();
