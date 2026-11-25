/* ═══ Наставник Лука — ИИ-помощник по всему курсу и агент на чертеже (docs/TUTOR.md) ═══
   Лука есть на каждой странице копии /new/: вне варианта ДЗ (dz:'gen') — любой вопрос по курсу (теория, как строить,
   оформление, ГОСТ, РК): сервер ищет в базе знаний курса, отвечает по найденному и может открыть нужную страницу; знает,
   на какой странице студент и что он выделил («Спросить Луку» у выделенного текста). Голосом: вопрос — микрофоном
   (распознавание речи браузера), ответ — вслух (🔊). Сам подсказывает: застрял на шаге — «Спроси — покажу»; серия дней 🔥.
   На странице варианта ДЗ: ИГ №3, №4, №5, №6 (#/ig4/<n>; прежний адрес #/ig/dz/4/<n> переадресуется) и начерт №1–5 (#/ng2/<n>, #/ng3/<n>/b…).
   Разговор с наставником; его ответы управляют чертежом — открывают нужный шаг плеера решения и подсвечивают точки
   (ИГ — IG4S.player; начерт — плеер разбора сайта PLR: подзадача и шаг по id «p2s3», подписи точек на чертеже).
   Фото листа (📷) уходит вместе с эталоном: ИГ — вид решения со всеми номерами точек (IG4S.svg), начерт — черновик листа
   (SHEET.ng, построения в цвете) → JPEG; глаза наставника сравнивают их.
   Сервер — API кабинета (window.CLUB_API): /api/tutor/*, сессия lk_tok. Без адреса API окно не показывается.
   Маскот — пингвин Лука (lk/mascot.js, docs/TUTOR.md, раздел 2а): живая аватарка на кнопке и в шапке окна (думает, пока ждём
   модель, говорит, радуется 👍, грустит при ошибке, засыпает без дела); по действию «показать» выходит на чертёж, обводит точки
   и говорит главную мысль облачком; тап по подписи точки — «Рассказать про точку?». Телефон: окно — шторка в три положения
   (полоска · половина · весь экран), чертёж остаётся виден; Лука сидит у нижней панели вместо кнопки, его можно перетащить;
   чертёж приближается к точкам, пока Лука их обводит. Без lk/mascot.js всё работает по-старому, с буквой «Н».
   Для тестов: window.TUTOR — {open(), close(), send(text), act(action), state(), mascot()}. */
(function(){
'use strict';
const API=String(self.CLUB_API||'').replace(/\/$/,'');
if(!API&&!self.TUTOR_FORCE) return;
const $=(s,r)=>(r||document).querySelector(s);
const LS={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ v==null?localStorage.removeItem(k):localStorage.setItem(k,v); }catch(e){} } };
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tok=()=>LS.get('lk_tok')||'';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MC=()=>self.MASCOT||null;
const talkMs=t=>Math.max(900,Math.min(4200,String(t||'').length*28));
/* аватарка Луки в элементе el (без маскота — буква «Н») */
function av(el,opt){ const M=MC(); if(!el) return null; if(!M){ el.textContent='Н'; return null; } try{ return M.avatar(el,opt); }catch(e){ el.textContent='Н'; return null; } }
async function until(f,ms){ const t=Date.now(); for(;;){ let v=null; try{ v=f(); }catch(e){} if(v) return v; if(Date.now()-t>ms) return null; await sleep(120); } }

/* ── где мы: вариант ДЗ ── */
const DZN={ig3:'ИГ · ДЗ №3',ig5:'ИГ · ДЗ №5',ig6:'ИГ · ДЗ №6',ig4:'ИГ · ДЗ №4',ng1:'Начерт · ДЗ №1',ng2:'Начерт · ДЗ №2',ng3:'Начерт · ДЗ №3',ng4:'Начерт · ДЗ №4',ng5:'Начерт · ДЗ №5'};
function here(){ const h=location.hash||'';
  let m=/^#\/(?:ig4|ig\/dz\/4)\/(\d{1,2})(?:[/?]|$)/.exec(h); if(m) return {dz:'ig4',n:+m[1]};
  m=/^#\/(ng[1-5]|ig[356])\/(\d{1,2})(?:[/?]|$)/.exec(h); if(m&&+m[2]>=1&&+m[2]<=30) return {dz:m[1],n:+m[2]};
  return null; }
const isNg=w=>!!w&&/^ng/.test(w.dz);
/* вне варианта — разговор «о чём угодно» (одна память на студента) */
const GEN={dz:'gen',n:0}, cur=()=>here()||GEN, isGen=w=>!w||w.dz==='gen', wkey=w=>w?w.dz+':'+w.n:'', same=(a,b)=>wkey(a)===wkey(b);
/* где студент: адрес и заголовок страницы — серверу для ответа «про это» */
function pageTitle(){ if(document.documentElement.classList.contains('ns-on')) return 'Главная';
  for(const h of document.querySelectorAll('h1,h2')){ if(h.closest('.tu,#ns,.tu-fab')||!h.offsetParent) continue; const t=String(h.textContent||'').replace(/\s+/g,' ').trim(); if(t&&t.length<=120) return t; }
  return String(document.title||'').replace(/\s*[—|].*$/,'').slice(0,120); }
const pageCtx=()=>({hash:/^#\/[\w\/\-.%]{0,120}$/.test(location.hash)?location.hash:'#/',title:pageTitle()});
/* плеер шагов ИГ: ДЗ №4 — IG4S.player, ДЗ №3, №5, №6 — IGUI.player (те же go, current, highlight) */
const igP=dz=>dz==='ig4'?(window.IG4S&&IG4S.player):(window.IGUI&&IGUI.player);
const igModel=(dz,n)=>{ try{ return DZR.get(dz).part(n); }catch(e){ return null; } };

/* ── запросы ── */
async function req(m,p,b){ const h={}; if(b) h['content-type']='application/json'; if(tok()) h.authorization='Bearer '+tok();
  let r; try{ r=await fetch(API+p,{method:m,headers:h,body:b?JSON.stringify(b):undefined,cache:'no-store'}); }
  catch(e){ const er=new Error('Нет связи с сервером. Проверь интернет и попробуй ещё раз.'); er.net=true; throw er; }
  const j=await r.json().catch(()=>({}));
  if(!r.ok){ if(r.status===401) LS.set('lk_tok',null); const e=new Error(j.error||('Ошибка '+r.status)); e.status=r.status; e.data=j; throw e; }
  return j; }

/* ── фото: ≤ 1600 px, JPEG ≤ 1,1 МБ ── */
function shrink(file){ return new Promise((ok,no)=>{ if(!/^image\//.test(file.type||'')) return no(new Error('Это не картинка'));
  const url=URL.createObjectURL(file), im=new Image();
  im.onload=()=>{ URL.revokeObjectURL(url); let W=im.naturalWidth, H=im.naturalHeight, k=Math.min(1,1600/Math.max(W,H)); const cv=document.createElement('canvas'), cx=cv.getContext('2d');
    for(let i=0;i<8;i++){ cv.width=Math.max(1,Math.round(W*k)); cv.height=Math.max(1,Math.round(H*k)); cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); cx.drawImage(im,0,0,cv.width,cv.height);
      for(const q of [.82,.7,.58]){ const d=cv.toDataURL('image/jpeg',q); if(d.length<=1100*1024) return ok(d); } k*=.8; }
    no(new Error('Фото слишком большое')); };
  im.onerror=()=>{ URL.revokeObjectURL(url); no(new Error('Фото не открылось')); }; im.src=url; }); }
/* ── эталон для глаз: ИГ — вид решения варианта со всеми номерами точек; начерт — черновик листа (построения в цвете) ── */
async function reference(n,dz){ dz=dz||'ig4'; if(!window.DZR) return ''; let s, W=900, H=900;
  if(dz==='ig4'){ if(!window.IG4S) return '';
    const model=DZR.get('ig4').part(n), PL=IG4S.plan(model); let i=PL.ST.findIndex(s=>s.id==='aa2'); if(i<0) i=PL.ST.length-2;
    s=IG4S.svg(model,PL,i,{hidePast:false,allNums:true});
    s=s.replace(/^<svg([^>]*)>/,(m,a)=>'<svg xmlns="http://www.w3.org/2000/svg"'+a.replace(/\sclass="[^"]*"/,'')+'><style>.igs-k{font:italic 600 24px "Times New Roman",serif;paint-order:stroke;stroke:#fff;stroke-width:4px}</style>');
    const vb=/viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(s); if(vb){ W=+vb[1]; H=+vb[2]; } }
  else if(/^ig/.test(dz)){ if(!window.IGUI||!IGUI.sheetSVG) return ''; s=IGUI.sheetSVG(igModel(dz,n),'','','');
    if(!/xmlns=/.test(s)) s=s.replace(/^<svg/,'<svg xmlns="http://www.w3.org/2000/svg"');
    const vb=/viewBox="[\d.\s-]*?([\d.]+) ([\d.]+)"/.exec(s); if(vb){ W=+vb[1]; H=+vb[2]; } }
  else { if(!window.SHEET||!SHEET.ng) return ''; s=SHEET.ng(DZR.solve(dz,n),DZR.meta(dz,n),'draft').svg;
    if(!/xmlns=/.test(s)) s=s.replace(/^<svg/,'<svg xmlns="http://www.w3.org/2000/svg"');
    const vb=/viewBox="[\d.\s-]*?([\d.]+) ([\d.]+)"/.exec(s); if(vb){ W=+vb[1]; H=+vb[2]; } }
  const k=1400/Math.max(W,H);
  const url=URL.createObjectURL(new Blob([s],{type:'image/svg+xml'}));
  try{ const im=await new Promise((ok,no)=>{ const x=new Image(); x.onload=()=>ok(x); x.onerror=()=>no(new Error('эталон')); x.src=url; });
    const cv=document.createElement('canvas'); cv.width=Math.round(W*k); cv.height=Math.round(H*k); const cx=cv.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); cx.drawImage(im,0,0,cv.width,cv.height);
    return cv.toDataURL('image/jpeg',.8); }
  finally{ URL.revokeObjectURL(url); } }

/* ── чертёж: открыть плеер шагов варианта n и выполнить действие наставника ── */
async function player(n,dz){ dz=dz||'ig4'; const ok=()=>{ const P=igP(dz); return P&&P.model&&(dz==='ig4'?+P.model.n===n:P.model===igModel(dz,n))&&$('#igbPic')&&document.contains($('#igbPic'))?P:null; };
  if(ok()) return ok();
  const show=$('#igShow'); if(show&&show.offsetParent!==null) show.click();
  const tab=await until(()=>$('.igx-tabs button[data-t=steps]'),6000); if(tab&&tab.getAttribute('aria-selected')!=='true') tab.click();
  return until(()=>ok()&&$('#igbPic svg')&&ok(),60000); }
/* начерт: плеер разбора варианта (PLR сайта) на странице #/ngN/n — подзадача pi и шаг k по id «p2s3» */
const plr=()=>{ try{ return typeof PLR!=='undefined'&&PLR&&PLR.state&&$('#dzPl .pl')&&document.contains($('#dzPl .pl'))?PLR:null; }catch(e){ return null; } };
async function ngPlayer(w){ const ok=()=>{ const h=here(); return h&&h.dz===w.dz&&h.n===w.n&&plr(); };
  if(ok()) return ok();
  const base='#/'+w.dz+'/'+w.n; if(!/^#\/ng\d\/\d+(?:\/[abvg])?$/.test(location.hash)) location.hash=base;   /* лист, черновик, «как решать» → разбор по шагам */
  return until(ok,20000); }
/* подсветить подписи точек на чертеже плеера: «A» → A″, A′, A‴; «1» → 1″, 1′ */
const ROM={'₄':'IV','₅':'V','₆':'VI','₇':'VII','₈':'VIII'};   /* новые плоскости на чертеже — римскими сверху: A₄ → A^IV */
function ngHighlight(points){ const want=new Set(); (points||[]).forEach(p=>{ p=String(p); want.add(p); want.add(p.replace(/[₄-₈]/g,c=>ROM[c])); }); if(!want.size) return;
  const svg=$('#dzPl svg.dwg'); if(!svg) return; svg.querySelectorAll('.tu-hl').forEach(x=>x.classList.remove('tu-hl'));
  svg.querySelectorAll('text').forEach(t=>{ const name=String(t.textContent||'').replace(/[″′‴'"]+/g,'').trim(); if(want.has(name)) t.classList.add('tu-hl'); }); }
/* номер шага по порядку (как у сервера) из подзадачи и шага плеера */
function ngStep(w){ const P=plr(), PL=typeof PLAYER!=='undefined'?PLAYER:null; if(!P||!PL||!window.DZR) return null; const S=P.state; if(!S.k) return null;
  try{ const parts=PL.partsOf(DZR.solve(w.dz,w.n).task); let k=0; for(let i=0;i<S.pi;i++) k+=(parts[i].steps||[]).length; return k+S.k; }catch(e){ return null; } }
/* ── ответ прямо на чертеже: плашка с главной мыслью (say) и выноски у подписей точек (notes) ── */
const ROMN={'₄':'IV','₅':'V','₆':'VI','₇':'VII','₈':'VIII'};
function labelsOf(w,svg,pt){ const want=String(pt), alt=want.replace(/[₄-₈]/g,c=>ROMN[c]);
  return [...svg.querySelectorAll('text')].filter(t=>{ const raw=String(t.textContent||'').trim();
    if(isNg(w)){ const nm=raw.replace(/[″′‴'"]+/g,'').trim(); return nm===want||nm===alt; }
    const m=/^(\d{1,3})[″′‴]$/.exec(raw); return !!m&&m[1]===want; }); }
function drawingBox(w){ return isNg(w)?$('#dzPl .pl-paper'):$('#igbPic'); }
function onDrawing(w,a){ const box=drawingBox(w), svg=box&&box.querySelector('svg'); if(!box||!svg) return;
  box.querySelectorAll('.tu-note').forEach(e=>e.remove()); if(getComputedStyle(box).position==='static') box.style.position='relative';
  const B=box.getBoundingClientRect();
  const used=[];
  /* узкий чертёж (телефон): выноски не расставляем — пояснение к точке Лука скажет по нажатию на обведённую точку */
  if(MC()&&B.width<560) return;
  (a.notes||[]).forEach(n=>{ const els=labelsOf(w,svg,n.point); if(!els.length) return; const r=els[0].getBoundingClientRect(); if(!r.width&&!r.height) return;
    /* подпись — как на чертеже: новые плоскости римскими сверху (A₄ → A^IV) */
    const nm=esc(String(n.point)).replace(/^(.*?)([₄-₈])$/,(m0,b0,c0)=>b0+'<sup>'+ROMN[c0]+'</sup>');
    const d=document.createElement('div'); d.className='tu-note'; d.innerHTML='<b>'+nm+'</b> '+esc(n.text); box.appendChild(d);
    const W=d.offsetWidth, H=d.offsetHeight; let x=r.right-B.left+8, y=r.top-B.top-H/2+r.height/2;
    if(x+W>B.width-4){ x=r.left-B.left-W-8; d.classList.add('l'); } x=Math.max(4,Math.min(x,B.width-W-4));
    /* не налезать на соседние выноски: сдвиг вниз, только если прямоугольники пересекаются */
    const hit=yy=>used.some(u=>x<u.x+u.w+4&&u.x<x+W+4&&yy<u.y+u.h+4&&u.y<yy+H+4);
    for(let i=0;i<8&&hit(y);i++) y+=H+4; y=Math.max(4,Math.min(y,B.height-H-4)); used.push({x,y,w:W,h:H});
    d.style.left=x+'px'; d.style.top=y+'px'; }); }

/* ── Лука выходит на чертёж: подходит к точкам (≤ 3), обводит каждую, показывает на последнюю и говорит главную мысль ── */
const isPhone=()=>innerWidth<760;
function pointRects(w,box,pts){ const svg=box.querySelector('svg'); if(!svg) return []; const B=box.getBoundingClientRect(), out=[];
  const vis=r=>(r.width||r.height)&&r.right>B.left&&r.left<B.right&&r.bottom>B.top&&r.top<B.bottom;
  for(const p of pts){ const r=labelsOf(w,svg,p).map(e=>e.getBoundingClientRect()).find(vis); if(r) out.push({r,p}); }
  /* ИГ №4 подсвечивает точки кружками, а не подписями */
  if(!out.length&&pts.length) [...svg.querySelectorAll('.tu-hl,circle[fill="#ffd23f"]')].map(e=>e.getBoundingClientRect()).filter(vis).slice(0,3).forEach((r,i)=>out.push({r,p:pts[i]}));
  return out; }
function tourOn(w,a,o){ const M=MC(), box=drawingBox(w); if(!M||!box||!box.querySelector('svg')) return;
  const pts=(a.points||[]).slice(0,3); let names=[];
  const targets=()=>{ const B=box.getBoundingClientRect(), rs=pointRects(w,box,pts); names=rs.map(x=>x.p);
    return rs.map(({r})=>({x:r.left+r.width/2-B.left-box.clientLeft,y:r.top+r.height/2-B.top-box.clientTop,r:Math.max(r.width,r.height)/2+7})); };
  const note=p=>(a.notes||[]).find(n=>String(n.point)===String(p));
  const Z=isPhone()&&pts.length?zoomer(w,box,pts):null;
  try{ M.tour(box,targets,{mood:o&&o.mood,haptic:isPhone(),say:a.say?{text:a.say}:null,
    onRing:(i)=>{ const p=names[i], n=note(p); M.say(n?ptLabel(p)+' — '+n.text:'Точка '+ptLabel(p)+(a.say?'. '+a.say:'')); },
    before:Z&&Z.zoom, after:Z&&Z.back}); }catch(e){} }
const ptLabel=p=>String(p).replace(/^(.*?)([₄-₈])$/,(m0,b0,c0)=>b0+ROMN[c0]);
/* телефон: приблизить чертёж к точкам, пока Лука их обводит, потом вернуть (лист начерта — тот же масштаб, что щипком: PLR.state.z) */
function zoomer(w,box,pts){ const svg=box.querySelector(isNg(w)?'svg.dwg':'svg'); if(!svg) return null; let set=null;
  const Zs=()=>{ try{ return isNg(w)&&PLR&&PLR.state&&PLR.state.z||null; }catch(e){ return null; } };
  const put=(tr,ms)=>{ svg.style.transition='transform '+ms+'ms cubic-bezier(.3,.8,.3,1)'; svg.style.transformOrigin='50% 50%'; svg.style.transform=tr; return sleep(ms+40).then(()=>{ svg.style.transition=''; }); };
  return {
    zoom:async()=>{ const Z=Zs(); if(Z&&Z.s>1.05) return; if(svg.style.transform) return;
      const rs=pointRects(w,box,pts).map(x=>x.r); if(!rs.length) return; const S=svg.getBoundingClientRect(), B=box.getBoundingClientRect();
      const l=Math.min(...rs.map(r=>r.left))-28, t=Math.min(...rs.map(r=>r.top))-28, rr=Math.max(...rs.map(r=>r.right))+28, bb=Math.max(...rs.map(r=>r.bottom))+28;
      const k=Math.min(2.4,B.width*.6/(rr-l),B.height*.6/(bb-t)); if(k<1.3) return;
      const cx=(l+rr)/2-(S.left+S.width/2), cy=(t+bb)/2-(S.top+S.height/2), mx=(k-1)*S.width/2, my=(k-1)*S.height/2;
      const x=Math.max(-mx,Math.min(mx,-k*cx)), y=Math.max(-my,Math.min(my,-k*cy)); set={k,x,y,tr:'translate('+x+'px,'+y+'px) scale('+k+')'};
      if(Z){ Z.s=k; Z.x=x; Z.y=y; box.classList.add('zoomed'); } await put(set.tr,560); },
    back:async()=>{ if(!set||!svg.isConnected) return; const Z=Zs();
      if(Z?(Math.abs(Z.s-set.k)>.01||Math.abs(Z.x-set.x)>1):svg.style.transform!==set.tr) return;   /* студент сам двигал чертёж — не трогаем */
      if(Z){ Z.s=1; Z.x=0; Z.y=0; box.classList.remove('zoomed'); } await put('',520); svg.style.transform=''; } }; }
/* телефон: чертёж должен быть виден над шторкой */
function drawingInView(w){ if(!isPhone()) return; const b=drawingBox(w); if(!b) return; const r=b.getBoundingClientRect(), top=box.hidden?innerHeight:box.getBoundingClientRect().top, hh=72;
  if(r.top<hh||r.bottom>top) scrollBy({top:r.top-hh-Math.max(0,(top-hh-r.height)/2),behavior:'smooth'}); }
/* тап по подписи точки на чертеже — Лука подходит: «Рассказать про точку 9′?» */
const ROMS={IV:'₄',V:'₅',VI:'₆',VII:'₇',VIII:'₈'};
function labelPoint(w,t){ const raw=String(t.textContent||'').trim();
  if(isNg(w)){ const m=/^([A-Z]|\d{1,2})([″′‴'"]*)(IV|V|VI|VII|VIII)?$/.exec(raw.replace(/\s+/g,'')); return m?{p:m[1]+(m[3]?ROMS[m[3]]:''),label:raw}:null; }
  const m=/^(\d{1,3})[″′‴]$/.exec(raw); return m?{p:+m[1],label:raw}:null; }
let tapQ=null;
document.addEventListener('pointerdown',e=>{ tapQ=null; const w=here(), M=MC(); if(!w||!M||!e.isPrimary) return; const b=drawingBox(w); if(!b||!b.contains(e.target)) return;
  const t=e.target.closest&&e.target.closest('text'); const svg=b.querySelector('svg'); if(!t||!svg||!svg.contains(t)) return;
  const q=labelPoint(w,t); if(q) tapQ={x:e.clientX,y:e.clientY,at:Date.now(),q,t}; },true);
document.addEventListener('pointerup',e=>{ const z=tapQ; tapQ=null; if(!z||Math.hypot(e.clientX-z.x,e.clientY-z.y)>10||Date.now()-z.at>600) return; askPoint(z.q,z.t); },true);
function askPoint(q,t){ const w=here(), M=MC(), b=w&&drawingBox(w); if(!M||!b||!t.isConnected) return;
  const st=M.state().tour; if(st&&st.say&&st.say.indexOf(q.label)>=0) return;   /* двойной тап (масштаб) — не спрашивать дважды */
  const B=b.getBoundingClientRect(), r=t.getBoundingClientRect(), tg={x:r.left+r.width/2-B.left-b.clientLeft,y:r.top+r.height/2-B.top-b.clientTop,r:Math.max(r.width,r.height)/2+7};
  M.tour(b,()=>{ const rr=t.isConnected?t.getBoundingClientRect():r, BB=b.getBoundingClientRect(); return [{x:rr.left+rr.width/2-BB.left-b.clientLeft,y:rr.top+rr.height/2-BB.top-b.clientTop,r:tg.r}]; },
    {haptic:isPhone(),say:{text:'Рассказать про точку '+q.label+'?',actions:[
      {label:'Да, расскажи',fn:()=>{ M.untour(); ask('Расскажи про точку '+q.label+': откуда она берётся и как её построить?'); }},
      {label:'Не надо',fn:()=>M.untour()}]}}); }
/* открыть окно и спросить (если ещё не вошёл или нет согласия — окно покажет, что сделать) */
async function ask(text){ open(); await until(()=>S.st&&!S.busy,8000); if(S.st&&S.st.ready) send(text); }

/* ── 3D: начерт — пространственная картина шага (TASK3D), ИГ — вкладка 3D-модели детали ── */
async function open3d(w,a){
  if(isNg(w)){ if(!window.TASK3D||!window.DZR) return; const m=/^p(\d+)s(\d+)$/.exec(a.id||''); let pi=0, k=a.step||0;
    if(m){ pi=+m[1]-1; k=+m[2]; } try{ TASK3D.open(DZR.solve(w.dz,w.n).task,pi,k); }catch(e){} return; }
  const show=$('#igShow'); if(show&&show.offsetParent!==null) show.click();
  const tab=await until(()=>$('.igx-tabs button[data-t="3d"]'),6000); if(tab){ tab.click(); setTimeout(()=>{ const t=$('.igx-tabs'); t&&t.scrollIntoView({behavior:'smooth',block:'start'}); },60); } }

async function act(a,o){
  /* открыть страницу курса: разговор остаётся тем же, пока студент не спросит снова (S.pin) */
  if(a&&a.t==='open'){ if(!/^#\/[\w\/\-.%]{0,120}$/.test(a.href||'')) return; S.pin=true; if(location.hash!==a.href) location.hash=a.href;
    if(isPhone()&&S.open) peek(); scrollTo({top:0,behavior:'smooth'}); if(hdrAv) hdrAv.play('point',1400); return; }
  const w=here(); if(!a||!w) return;
  if(a.t==='3d'){ await open3d(w,a); if(isPhone()) close(true); return; }
  if(a.t==='show'&&isNg(w)){ const P=await ngPlayer(w); if(!P) return; const m=/^p(\d+)s(\d+)$/.exec(a.id||'');
    if(m){ P.state.pi=+m[1]-1; P.go(+m[2]); } else P.go(a.step);
    await sleep(80); if(a.points&&a.points.length) ngHighlight(a.points); onDrawing(w,a);
    if(isPhone()){ peek(); drawingInView(w); await sleep(380); } tourOn(w,a,o); return; }
  if(a.t==='show'){ const P=await player(w.n,w.dz); if(!P) return; P.go(a.step);
    await until(()=>{ const p=$('#igbPic'); return p&&p.querySelector('svg')&&!p.classList.contains('igx-ldh'); },8000); await sleep(60);
    if(a.points&&a.points.length) P.highlight(a.points); onDrawing(w,a);
    if(isPhone()){ peek(); drawingInView(w); await sleep(380); } tourOn(w,a,o); }
  if(a.t==='ask') location.hash='#/ask/'+encodeURIComponent(a.id); }

/* ── стили (токены сайта, светлая и тёмная тема) ── */
const css=document.createElement('style');
css.textContent=`
/* ── Лука: токены (из токенов сайта — светлая и тёмная тема), один акцент — оранжевый шарф Луки ── */
.tu,.tu-fab,.tu-selask,.tu-note{--lk-bg:var(--paper,#fff);--lk-ink:var(--ink,#111113);--lk-mut:color-mix(in srgb,var(--lk-ink) 55%,var(--lk-bg));--lk-line:color-mix(in srgb,var(--lk-ink) 10%,transparent);--lk-soft:color-mix(in srgb,var(--lk-ink) 3.5%,var(--lk-bg));--lk-soft2:color-mix(in srgb,var(--lk-ink) 7%,var(--lk-bg));--lk-acc:#fa4b00;--lk-ok:#1f9d63;--lk-red:#e5484d;--lk-sans:var(--sans,'Golos Text',system-ui,-apple-system,'Segoe UI',sans-serif);--lk-disp:var(--disp,'Geologica',var(--sans,system-ui));--lk-face:radial-gradient(circle at 50% 36%,#f6f8ff,#d5e1ff 74%);--mc-ink:#1d2233}
.tu svg,.tu-fab svg,.tu-selask svg{flex:none}
/* ── кнопка ── */
.tu-fab{position:fixed;right:22px;bottom:calc(var(--tabh,64px) + 18px + env(safe-area-inset-bottom));z-index:330;display:inline-flex;align-items:center;gap:10px;height:54px;padding:0 10px 0 7px;border:0;border-radius:99px;background:var(--lk-ink);color:var(--lk-bg);font:600 15px/1 var(--lk-sans);letter-spacing:-.01em;cursor:pointer;box-shadow:0 18px 40px -16px rgba(8,10,20,.55),0 2px 6px -2px rgba(8,10,20,.3),inset 0 1px 0 rgba(255,255,255,.08);transition:transform .4s cubic-bezier(.2,.9,.25,1.25),box-shadow .4s;animation:tuFabIn .7s cubic-bezier(.2,.9,.25,1.15) both}
.tu-fab:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 24px 50px -18px rgba(8,10,20,.6),0 2px 6px -2px rgba(8,10,20,.3),inset 0 1px 0 rgba(255,255,255,.08)}
.tu-fab:active{transform:scale(.97)}
.tu-fab:focus-visible{outline:2px solid var(--lk-acc);outline-offset:3px}
.tu-fab i{position:relative;width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--lk-face);display:grid;place-items:center;color:#1f47d6;font:800 16px var(--lk-sans);font-style:normal}
.tu-fab .tu-fl{padding-right:4px}
.tu-fab kbd{font:600 11px/1 var(--lk-sans);padding:5px 7px;border-radius:8px;background:color-mix(in srgb,var(--lk-bg) 14%,transparent);color:color-mix(in srgb,var(--lk-bg) 70%,transparent)}
.tu-fab::after{content:"";position:absolute;inset:-5px;border-radius:inherit;border:1.5px solid var(--lk-acc);opacity:0;pointer-events:none;animation:tuGlow 7s 4s infinite}
.tu-fab u{position:absolute;top:3px;left:38px;width:11px;height:11px;border-radius:50%;background:var(--lk-acc);box-shadow:0 0 0 2.5px var(--lk-ink)}
@keyframes tuFabIn{from{opacity:0;transform:translateY(16px) scale(.9)}to{opacity:1;transform:none}}
@keyframes tuGlow{0%,82%,100%{opacity:0;transform:scale(.96)}88%{opacity:.55}96%{opacity:0;transform:scale(1.12)}}
@media (min-width:900px){.tu-fab{bottom:24px}}
.tu-fb{position:absolute;bottom:calc(100% + 12px);right:0;width:max-content;max-width:min(280px,76vw);padding:11px 14px;border-radius:18px 18px 5px 18px;background:color-mix(in srgb,var(--lk-ink) 94%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--lk-bg);font:500 13.5px/1.42 var(--lk-sans);letter-spacing:0;text-align:left;white-space:normal;box-shadow:0 18px 40px -16px rgba(8,10,20,.55);pointer-events:none;animation:tuNote .5s cubic-bezier(.2,.9,.25,1.2) both}
.tu-fab.l .tu-fb{right:auto;left:0;border-radius:18px 18px 18px 5px}
@keyframes tuNote{from{opacity:0;transform:translateY(8px) scale(.92)}to{opacity:1;transform:none}}
/* ── окно ── */
.tu{position:fixed;z-index:340;display:flex;flex-direction:column;background:var(--lk-bg);color:var(--lk-ink);font:400 15px/1.55 var(--lk-sans);border:1px solid var(--lk-line);box-shadow:0 40px 90px -30px rgba(8,10,20,.5),0 12px 28px -14px rgba(8,10,20,.26);overflow:hidden;isolation:isolate}
@media (min-width:760px){.tu{right:20px;bottom:20px;width:428px;height:min(760px,calc(100vh - 40px));border-radius:30px;transform-origin:calc(100% - 44px) calc(100% - 24px)}
  .tu.tu-in{animation:tuPop .55s cubic-bezier(.2,.9,.22,1.06) both}.tu.tu-out{animation:tuPopOut .22s cubic-bezier(.4,0,1,1) both}}
@keyframes tuPop{from{opacity:0;transform:translateY(22px) scale(.88);filter:blur(8px)}to{opacity:1;transform:none;filter:none}}
@keyframes tuPopOut{to{opacity:0;transform:translateY(14px) scale(.94);filter:blur(5px)}}
.tu.tu-in .tu-h,.tu.tu-in .tu-mode,.tu.tu-in .tu-b>*,.tu.tu-in .tu-f{animation:tuUp .6s cubic-bezier(.2,.8,.2,1) both}
.tu.tu-in .tu-h{animation-delay:.06s}.tu.tu-in .tu-mode{animation-delay:.1s}.tu.tu-in .tu-f{animation-delay:.2s}
.tu.tu-in .tu-b>:nth-child(1){animation-delay:.14s}.tu.tu-in .tu-b>:nth-child(2){animation-delay:.19s}.tu.tu-in .tu-b>:nth-child(3){animation-delay:.24s}.tu.tu-in .tu-b>:nth-child(n+4){animation-delay:.28s}
@keyframes tuUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.tu-h{display:flex;align-items:center;gap:12px;padding:16px 12px 14px 18px}
.tu-hav{position:relative;flex:none;width:44px;height:44px;cursor:pointer}
.tu-havi{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--lk-face);box-shadow:inset 0 0 0 1px rgba(255,255,255,.6);color:#1f47d6;font:800 18px var(--lk-sans)}
.tu-dot{position:absolute;right:0;bottom:1px;width:11px;height:11px;border-radius:50%;background:var(--lk-ok);box-shadow:0 0 0 2.5px var(--lk-bg);transition:background .3s}
.tu.busy .tu-dot{background:var(--lk-acc);animation:tuBeat 1s ease-in-out infinite alternate}
@keyframes tuBeat{from{transform:scale(.8)}to{transform:scale(1.15)}}
.tu-who{flex:1;min-width:0}
.tu-h b{display:flex;align-items:center;gap:8px;font:700 17px/1.15 var(--lk-disp);letter-spacing:-.02em}
.tu-h small{display:block;margin-top:3px;color:var(--lk-mut);font:500 12.5px/1.3 var(--lk-sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-streak{display:inline-flex;align-items:center;gap:3px;padding:3px 8px 3px 6px;border-radius:99px;background:color-mix(in srgb,var(--lk-acc) 12%,transparent);color:var(--lk-acc);font:700 11.5px/1 var(--lk-sans);letter-spacing:0}
.tu-ib{flex:none;width:38px;height:38px;border:0;border-radius:50%;background:transparent;color:var(--lk-mut);display:grid;place-items:center;cursor:pointer;transition:background .2s,color .2s,transform .2s}
.tu-ib:hover{background:var(--lk-soft2);color:var(--lk-ink)}
.tu-ib:active{transform:scale(.92)}
.tu-ib.on{background:var(--lk-ink);color:var(--lk-bg)}
.tu-ib:focus-visible,.tu-chip:focus-visible,.tu-sg:focus-visible,.tu-card:focus-visible,.tu-open:focus-visible,.tu-send:focus-visible,.tu-tool:focus-visible,.tu-btn:focus-visible{outline:2px solid var(--lk-acc);outline-offset:2px}
.tu-mode{display:flex;gap:2px;margin:0 18px 4px;padding:3px;border-radius:13px;background:var(--lk-soft2)}
.tu-mode button{flex:1;height:30px;border:0;border-radius:10px;background:none;color:var(--lk-mut);font:600 13px var(--lk-sans);cursor:pointer;transition:background .25s,color .25s,box-shadow .25s}
.tu-mode button.on{background:var(--lk-bg);color:var(--lk-ink);box-shadow:0 1px 2px rgba(0,0,0,.08),0 6px 14px -8px rgba(0,0,0,.25)}
.tu-b{flex:1;overflow-y:auto;padding:14px 18px 20px;display:flex;flex-direction:column;gap:20px;overscroll-behavior:contain;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 16px,#000 calc(100% - 12px),transparent);mask-image:linear-gradient(to bottom,transparent 0,#000 16px,#000 calc(100% - 12px),transparent)}
/* сообщения */
.tu-m{display:flex;flex-direction:column;gap:10px;min-width:0}
.tu-m.u{align-self:flex-end;align-items:flex-end;max-width:86%}
.tu-m.u .tu-bb{padding:10px 15px;border-radius:20px 20px 6px 20px;background:var(--lk-ink);color:var(--lk-bg);font-size:15px;line-height:1.45;overflow-wrap:anywhere}
.tu-m.t{align-self:stretch}
.tu-by{display:flex;align-items:center;gap:7px;color:var(--lk-mut);font:600 12px/1 var(--lk-sans);letter-spacing:.01em}
.tu-by i{width:7px;height:7px;border-radius:50%;background:var(--lk-acc)}
.tu-m.t .tu-bb{font-size:15.5px;line-height:1.62;letter-spacing:-.003em;overflow-wrap:anywhere}
.tu-m.t .tu-bb b{font-weight:650}
.tu-bb a.tu-st{color:inherit;font-weight:600;text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--lk-acc) 75%,transparent);text-decoration-thickness:2px;text-underline-offset:3px;cursor:pointer}
.tu-m.tu-new{animation:tuUp .45s cubic-bezier(.2,.8,.2,1) both}
.tu-w{animation:tuW .55s cubic-bezier(.2,.7,.2,1) both}
@keyframes tuW{from{opacity:0;filter:blur(5px)}to{opacity:1;filter:none}}
.tu-x{display:flex;flex-direction:column;align-items:stretch;gap:8px}
.tu-card,.tu-open{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px 10px 10px;border-radius:18px;border:1px solid var(--lk-line);background:var(--lk-soft);color:var(--lk-ink);font:600 14px/1.25 var(--lk-sans);text-align:left;text-decoration:none;cursor:pointer;transition:transform .25s cubic-bezier(.2,.9,.25,1.2),border-color .2s,background .2s,box-shadow .25s}
.tu-card:hover,.tu-open:hover{background:var(--lk-bg);border-color:color-mix(in srgb,var(--lk-ink) 20%,transparent);transform:translateY(-1px);box-shadow:0 10px 24px -16px rgba(8,10,20,.45)}
.tu-card:active,.tu-open:active{transform:scale(.985)}
.tu-card .ic,.tu-open .ic{flex:none;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:var(--lk-ink);color:var(--lk-bg)}
.tu-card .tx,.tu-open .tx{flex:1;min-width:0}
.tu-card small,.tu-open small{display:block;margin-top:3px;color:var(--lk-mut);font:500 12.5px/1.3 var(--lk-sans)}
.tu-card .go,.tu-open .go{color:var(--lk-mut);transition:transform .25s}
.tu-card:hover .go,.tu-open:hover .go{transform:translateX(2px);color:var(--lk-ink)}
.tu-meta{display:flex;align-items:center;gap:2px;min-height:28px;color:var(--lk-mut);font:500 12px var(--lk-sans)}
.tu-ok{display:inline-flex;align-items:center;gap:5px;margin-right:6px;color:var(--lk-ok);font-weight:600}
.tu-r{width:30px;height:30px;border:0;border-radius:50%;background:none;color:var(--lk-mut);display:grid;place-items:center;cursor:pointer;opacity:.7;transition:background .2s,color .2s,opacity .2s}
.tu-r:hover{opacity:1;background:var(--lk-soft2);color:var(--lk-ink)}.tu-r.on{opacity:1;color:var(--lk-ink);background:var(--lk-soft2)}
.tu-qr{display:flex;flex-wrap:wrap;gap:6px}
.tu-chip{display:inline-flex;align-items:center;height:34px;padding:0 14px;border-radius:99px;border:1px solid var(--lk-line);background:var(--lk-bg);color:var(--lk-ink);font:600 13px/1 var(--lk-sans);cursor:pointer;white-space:nowrap;transition:background .2s,border-color .2s,transform .2s}
.tu-chip:hover{background:var(--lk-soft2);border-color:color-mix(in srgb,var(--lk-ink) 18%,transparent)}
.tu-chip:active{transform:scale(.96)}
/* приветствие и экраны входа */
.tu-hi,.tu-gate{display:grid;justify-items:center;text-align:center;gap:8px;padding:12px 4px 0}
.tu-gate{margin:auto 0}
.tu-gav{display:block;width:108px;height:108px;margin-bottom:6px;border-radius:50%;overflow:hidden;background:var(--lk-face);box-shadow:0 22px 44px -24px rgba(31,71,214,.65),inset 0 0 0 1px rgba(255,255,255,.6)}
.tu-hi b,.tu-gate b{font:700 23px/1.15 var(--lk-disp);letter-spacing:-.025em}
.tu-hi p,.tu-gate p{margin:0;max-width:34ch;color:var(--lk-mut);font-size:14.5px;line-height:1.55}
.tu-gate p{text-align:center}
.tu-tip{display:inline-flex;align-items:center;gap:8px;margin-top:4px;padding:7px 12px;border-radius:99px;background:var(--lk-soft2);color:var(--lk-mut);font:500 12.5px var(--lk-sans)}
.tu-play{display:inline-flex;align-items:center;gap:7px;margin-top:6px;color:var(--lk-ink);font:600 13px var(--lk-sans);text-decoration:none;opacity:.8;transition:opacity .2s}
.tu-play:hover{opacity:1}
.tu-sug{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tu-sg{display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:12px;min-height:92px;padding:13px;border-radius:18px;border:1px solid var(--lk-line);background:var(--lk-soft);color:var(--lk-ink);font:600 13.5px/1.3 var(--lk-sans);text-align:left;cursor:pointer;transition:transform .25s cubic-bezier(.2,.9,.25,1.2),background .2s,border-color .2s,box-shadow .25s}
.tu-sg:hover{background:var(--lk-bg);border-color:color-mix(in srgb,var(--lk-ink) 18%,transparent);transform:translateY(-2px);box-shadow:0 12px 26px -18px rgba(8,10,20,.5)}
.tu-sg:active{transform:scale(.97)}
.tu-sg .ic{color:var(--lk-acc)}
.tu-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;min-width:220px;margin-top:8px;padding:0 24px;border:0;border-radius:16px;background:var(--lk-ink);color:var(--lk-bg)!important;font:650 15px var(--lk-sans);cursor:pointer;text-decoration:none!important;transition:transform .2s,box-shadow .25s;box-shadow:0 14px 30px -18px rgba(8,10,20,.6)}
.tu-btn:hover{transform:translateY(-1px)}.tu-btn:active{transform:scale(.97)}
/* думает */
.tu-wait{align-self:flex-start;display:flex;align-items:center;gap:10px;color:var(--lk-mut);font:500 13.5px var(--lk-sans)}
.tu-dots{display:inline-flex;gap:4px;padding:11px 13px;border-radius:16px;background:var(--lk-soft2)}
.tu-dots i{width:6px;height:6px;border-radius:50%;background:var(--lk-ink);animation:tuDots 1.3s ease-in-out infinite}
.tu-dots i:nth-child(2){animation-delay:.16s}.tu-dots i:nth-child(3){animation-delay:.32s}
@keyframes tuDots{0%,60%,100%{opacity:.18;transform:none}30%{opacity:.7;transform:translateY(-3px)}}
.tu-shim{background:linear-gradient(90deg,var(--lk-mut) 0%,var(--lk-ink) 45%,var(--lk-mut) 70%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:tuShim 2.2s linear infinite}
@keyframes tuShim{from{background-position:120% 0}to{background-position:-100% 0}}
.tu-err{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:16px;background:color-mix(in srgb,var(--lk-red) 8%,var(--lk-bg));color:color-mix(in srgb,var(--lk-red) 80%,var(--lk-ink));font-size:14px;line-height:1.45}
/* поле ввода */
.tu-f{padding:8px 14px 12px}
.tu-pv{display:flex;align-items:center;gap:10px;margin:0 2px 8px;color:var(--lk-mut);font:600 13px var(--lk-sans)}
.tu-pv img{width:48px;height:48px;object-fit:cover;border-radius:12px;border:1px solid var(--lk-line)}
.tu-pv span{flex:1}
.tu-comp{display:flex;flex-direction:column;gap:2px;padding:8px 8px 8px 16px;border-radius:24px;border:1px solid var(--lk-line);background:var(--lk-soft);transition:border-color .25s,box-shadow .25s,background .25s}
.tu-comp:focus-within{background:var(--lk-bg);border-color:color-mix(in srgb,var(--lk-ink) 26%,transparent);box-shadow:0 0 0 4px color-mix(in srgb,var(--lk-ink) 6%,transparent),0 12px 28px -20px rgba(8,10,20,.45)}
.tu-comp textarea{width:100%;min-height:26px;max-height:30vh;resize:none;border:0;outline:0;background:none;color:var(--lk-ink);font:400 15.5px/1.45 var(--lk-sans);padding:6px 0 2px}
.tu-comp textarea::placeholder{color:var(--lk-mut)}
.tu-tools{display:flex;align-items:center;gap:2px;margin-left:-8px}
.tu-tool{width:38px;height:38px;border:0;border-radius:50%;background:none;color:var(--lk-mut);display:grid;place-items:center;cursor:pointer;transition:background .2s,color .2s}
.tu-tool:hover{background:var(--lk-soft2);color:var(--lk-ink)}
.tu-att input{display:none}
.tu-mic.on{background:var(--lk-red);color:#fff;animation:tuRec 1.2s infinite}
@keyframes tuRec{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--lk-red) 45%,transparent)}100%{box-shadow:0 0 0 10px transparent}}
.tu-send{margin-left:auto;width:38px;height:38px;border:0;border-radius:50%;background:var(--lk-ink);color:var(--lk-bg);display:grid;place-items:center;cursor:pointer;transition:transform .25s cubic-bezier(.2,.9,.25,1.3),opacity .2s}
.tu-send:not([disabled]):hover{transform:scale(1.06)}.tu-send:not([disabled]):active{transform:scale(.92)}
.tu-send[disabled]{opacity:.22;cursor:default}
.tu-foot{display:flex;align-items:center;justify-content:center;gap:6px;margin:9px 0 0;color:var(--lk-mut);font:500 11.5px/1.3 var(--lk-sans);text-align:center}
/* телефон: парящая шторка в три положения */
@media (max-width:759px){
.tu{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));height:var(--tu-h,min(52vh,520px));max-height:calc(100vh - 48px);border-radius:28px;transition:height .38s cubic-bezier(.2,.9,.25,1)}
.tu.tu-in{animation:tuSheet .55s cubic-bezier(.2,.9,.22,1) both}.tu.tu-out{animation:tuSheetOut .24s cubic-bezier(.4,0,1,1) both}
.tu.drag{transition:none}
.tu-top{touch-action:none;cursor:grab}
.tu .tu-grab{display:block;width:38px;height:5px;margin:8px auto -4px;border-radius:99px;background:color-mix(in srgb,var(--lk-ink) 16%,transparent)}
.tu[data-snap=peek] .tu-mode,.tu[data-snap=peek] .tu-b,.tu[data-snap=peek] .tu-f{display:none!important}
.tu[data-snap=peek] .tu-pk{display:grid}
.tu-h{padding:14px 8px 12px 14px;gap:10px}
.tu-h .tu-ib{width:34px;height:34px}
.tu-hav{width:40px;height:40px}
.tu-sg{min-height:84px}
.tu-fab{width:62px;height:62px;padding:0;gap:0;border-radius:50%;justify-content:center;font-size:0;right:16px;bottom:calc(var(--tabh,64px) + 14px + env(safe-area-inset-bottom));touch-action:none}
.tu-fab:hover{transform:none}
.tu-fab i{width:54px;height:54px}
.tu-fab .tu-fl,.tu-fab kbd{display:none}
.tu-fab u{left:auto;right:2px;top:2px}
.tu-fab.drag{transition:none;transform:scale(1.06)}
}
@keyframes tuSheet{from{transform:translateY(calc(100% + 24px))}to{transform:none}}
@keyframes tuSheetOut{to{transform:translateY(calc(100% + 24px))}}
.tu-grab,.tu-pk{display:none}
.tu-pk{gap:10px;padding:0 16px 14px}
.tu-pkt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:500 14.5px/1.45 var(--lk-sans);color:var(--lk-ink);cursor:pointer}
.tu-pkt.w{display:flex;align-items:center;gap:10px}
.tu-pk .tu-qr{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}
.tu-pk .tu-qr::-webkit-scrollbar{display:none}
.tu[hidden],.tu-fab[hidden],.tu-mode[hidden],.tu-att[hidden],.tu-mic[hidden],.tu-ib[hidden],.tu-streak[hidden],.tu-pv[hidden]{display:none}
.tu.busy .tu-send{opacity:.22}
/* на чертеже */
svg .tu-hl{fill:#e5484d!important;font-weight:800!important;paint-order:stroke;stroke:rgba(229,72,77,.22);stroke-width:6px}
.tu-note{position:absolute;z-index:6;max-width:220px;padding:6px 10px;border-radius:12px;background:#fff;color:#15161a;font:500 12.5px/1.35 var(--lk-sans);box-shadow:0 10px 26px -12px rgba(8,10,20,.45),0 0 0 1px rgba(8,10,20,.06);pointer-events:none}
.tu-note b{color:#e5484d;font-weight:700}
/* «Спросить Луку» у выделенного */
.tu-selask{position:fixed;z-index:345;display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px 0 5px;border:0;border-radius:99px;background:var(--lk-ink);color:var(--lk-bg);font:600 13.5px/1 var(--lk-sans);box-shadow:0 16px 36px -14px rgba(8,10,20,.6),inset 0 1px 0 rgba(255,255,255,.08);cursor:pointer;transform:translate(-50%,0);animation:tuSel .35s cubic-bezier(.2,.9,.25,1.25) both}
.tu-selask i{width:30px;height:30px;border-radius:50%;overflow:hidden;background:var(--lk-face)}
.tu-selask[hidden]{display:none}
@keyframes tuSel{from{opacity:0;transform:translate(-50%,8px) scale(.9)}to{opacity:1;transform:translate(-50%,0)}}
body:has(.ckn) .tu-fab,body:has(#ns-gate:not([hidden])) .tu-fab,html.ns-on body:has(#ns-gate:not([hidden])) .tu,body:has(#ns.login) .tu-fab,body:has(#ns.howon) .tu-fab,body:has(#ns.login) .tu-selask{display:none}
/* главная нового дизайна (#ns) лежит поверх всего — Лука над ней (позже в DOM, тот же уровень) */
html.ns-on .tu-fab,html.ns-on .tu,html.ns-on .tu-selask{z-index:2147480000}
@media (prefers-reduced-motion:reduce){.tu,.tu *,.tu-fab,.tu-fab::after,.tu-selask,.tu-fb{animation:none!important;transition:none!important}}
`;
document.head.appendChild(css);

/* ── иконки (линейные, currentColor): никаких эмодзи в интерфейсе ── */
const IP={cam:'<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.3-2h6l1.3 2h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  vol:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  reset:'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.7h3.7"/>', close:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', send:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  book:'<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  pen:'<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M13.5 7.5l3 3"/>', cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  chat:'<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>', check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  up:'<path d="M7 11v9H4.5v-9zM7 11l3.6-6.4A1.9 1.9 0 0 1 14 5.7V10h4.8a2 2 0 0 1 2 2.3l-1.1 6A2 2 0 0 1 17.7 20H7"/>',
  down:'<path d="M7 13V4H4.5v9zM7 13l3.6 6.4a1.9 1.9 0 0 0 3.4-1.1V14h4.8a2 2 0 0 0 2-2.3l-1.1-6A2 2 0 0 0 17.7 4H7"/>',
  go:'<path d="M9.5 6l6 6-6 6"/>', arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', shield:'<path d="M12 3l7 3v5.5c0 4.3-3 7.9-7 9.5-4-1.6-7-5.2-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
  q:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01"/>', ruler:'<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>', target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01"/>',
  game:'<rect x="3" y="7" width="18" height="11" rx="5"/><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 14h.01"/>', warn:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  cursor:'<path d="M5 4l6 16 2.4-6.6L20 11z"/>'};
const ic=(n,z)=>'<svg viewBox="0 0 24 24" width="'+(z||20)+'" height="'+(z||20)+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IP[n]+'</svg>';
const flame=z=>'<svg viewBox="0 0 24 24" width="'+(z||12)+'" height="'+(z||12)+'" fill="currentColor" aria-hidden="true"><path d="M12 21.5c4 0 6.8-2.7 6.8-6.6 0-3.8-3-6.4-4.5-10-.5 2.5-1.9 3.9-3.5 4.7-.4-1.2-1.1-2.2-2.1-2.8-1 2.6-3.3 4.7-3.3 8.1 0 3.9 2.6 6.6 6.6 6.6z"/></svg>';
const KBD=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent||'')?'⌘K':'Ctrl K';

/* ── окно ── */
const S={open:false,busy:false,w:null,st:null,photo:null,err:'',cache:{},pin:false,sel:''};
const fab=document.createElement('button'); fab.className='tu-fab'; fab.type='button'; fab.hidden=true; fab.innerHTML='<i aria-hidden="true"></i><span class="tu-fl">Спросить Луку</span><kbd>'+KBD+'</kbd>'; fab.title='Спросить Луку ('+KBD+')'; fab.setAttribute('aria-label','Открыть наставника Луку');
const box=document.createElement('section'); box.className='tu'; box.hidden=true; box.setAttribute('role','dialog'); box.setAttribute('aria-label','Наставник Лука');
box.innerHTML=`<div class="tu-top" data-top><div class="tu-grab" aria-hidden="true"></div><div class="tu-h"><div class="tu-hav" title="Лука"><span class="tu-havi" data-hav aria-hidden="true"></span><i class="tu-dot" aria-hidden="true"></i></div><div class="tu-who"><b>Лука<span class="tu-streak" data-streak hidden></span></b><small data-sub></small></div><button class="tu-ib" data-voice title="Читать ответы вслух" aria-label="Читать ответы вслух" aria-pressed="false">${ic('mute')}</button><button class="tu-ib" data-menu title="Начать заново" aria-label="Начать заново">${ic('reset')}</button><button class="tu-ib" data-close title="Закрыть" aria-label="Закрыть">${ic('close')}</button></div><div class="tu-pk" data-pk></div></div>
<div class="tu-mode" role="tablist" aria-label="Режим"><button data-mode="coach" role="tab" title="Подсказки по шагам: сначала наводка, потом идея, потом решение">Наставник</button><button data-mode="explain" role="tab" title="Объясняет решение полностью — если уже пробовал сам или готовишься к защите">Разбор</button></div>
<div class="tu-b" data-body aria-live="polite"></div>
<div class="tu-f" data-foot><div class="tu-pv" data-pv hidden></div><div class="tu-comp"><textarea rows="1" data-in placeholder="Спроси про свой вариант…" aria-label="Вопрос Луке"></textarea><div class="tu-tools"><label class="tu-tool tu-att" title="Фото листа — Лука сравнит с решением" aria-label="Фото листа">${ic('cam')}<input type="file" accept="image/*" data-file></label><button type="button" class="tu-tool tu-mic" data-mic title="Спросить голосом" aria-label="Спросить голосом" hidden>${ic('mic')}</button><button class="tu-send" data-send aria-label="Отправить" disabled>${ic('send',18)}</button></div></div>
<div class="tu-foot" data-foottx>${ic('shield',13)}Каждое число сверено с решением и текстом курса</div></div>`;
const selB=document.createElement('button'); selB.type='button'; selB.className='tu-selask'; selB.hidden=true; selB.innerHTML='<i aria-hidden="true"></i>Спросить Луку'+ic('arrow',16);
/* главная нового дизайна (#ns) добавляется позже нас и с тем же z-index ложится сверху — переносим Луку в конец body, после неё */
const toTop=()=>{ const ns=document.getElementById('ns'); if(ns&&(fab.compareDocumentPosition(ns)&Node.DOCUMENT_POSITION_FOLLOWING)) [fab,box,selB].forEach(e=>document.body.appendChild(e)); };
let mounted=false; const mount=()=>{ if(mounted) return; mounted=true; document.body.appendChild(fab); document.body.appendChild(box); document.body.appendChild(selB); route(); hello();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',toTop); else setTimeout(toTop,0); };
const body=$('[data-body]',box), inp=$('[data-in]',box), pv=$('[data-pv]',box);
/* Лука на кнопке и в шапке окна; засыпают без дела, просыпаются от движения */
const fabAv=av(fab.querySelector('i'),{sleepAfter:90000});
const hdrAv=av($('[data-hav]',box),{sleepAfter:120000});
addEventListener('resize',()=>{ fabPlace(); if(S.open) snap(S.snap,true); });
if(hdrAv) hdrAv.onPoke=()=>hdrAv.play('giggle');
const say=(st,ms)=>{ if(hdrAv) hdrAv.play(st,ms); };

/* текст ответа: переносы, **жирный**, «шаг N» — ссылка, открывающая шаг на чертеже */
function rich(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^\p{L}])(шаг[\p{L}]*\s+(\d{1,2}))/giu,(m,a,t,k)=>a+'<a class="tu-st" data-step="'+k+'">'+t+'</a>').replace(/\n/g,'<br>'); }
const SUG=['С чего начать?','Не понимаю текущий шаг','Как найти точку на грани ⟂ π₃?','Готовлюсь к защите — спроси меня'];
const SUG_IG=['С чего начать?','Не понимаю текущий шаг','Как перенести точку на вид слева?','Готовлюсь к защите — спроси меня'];
const SUG_NG=['С чего начать?','Не понимаю текущий шаг','Какое правило здесь работает?','Готовлюсь к защите — спроси меня'];
const SUG_IC=['q','ruler','doc','target'];
const sugCards=list=>'<div class="tu-sug">'+list.map((q,k)=>'<button class="tu-sg" data-sug><span class="ic">'+ic(SUG_IC[k%4],18)+'</span><span>'+esc(q)+'</span></button>').join('')+'</div>';
const chips=list=>list.map(q=>'<button class="tu-chip" data-sug>'+esc(q)+'</button>').join('');
const gateH=(mood,title,text,btn)=>'<div class="tu-gate"><i class="tu-gav" data-mood="'+mood+'" aria-hidden="true"></i><b>'+title+'</b><p>'+text+'</p>'+(btn||'')+'</div>';
function card(i,j,a){ const at='data-act="'+i+':'+j+'"';
  if(a.t==='show') return '<button class="tu-card" '+at+'><span class="ic">'+ic('pen',18)+'</span><span class="tx">Шаг '+a.step+' на чертеже<small>'+(a.points&&a.points.length?'точки '+esc(a.points.join(', ')):'открыть шаг решения')+'</small></span><span class="go">'+ic('go',16)+'</span></button>';
  if(a.t==='3d') return '<button class="tu-card" '+at+'><span class="ic">'+ic('cube',18)+'</span><span class="tx">3D-модель<small>посмотреть в пространстве</small></span><span class="go">'+ic('go',16)+'</span></button>';
  if(a.t==='ask') return '<a class="tu-card" href="#/ask/'+esc(a.id)+'"><span class="ic">'+ic('chat',18)+'</span><span class="tx">Вопрос автору<small>ответ придёт на сайте</small></span><span class="go">'+ic('go',16)+'</span></a>';
  if(a.t==='open') return '<button class="tu-open" '+at+'><span class="ic">'+ic('book',18)+'</span><span class="tx">'+esc(a.title)+'<small>'+esc(a.why||a.where||'Открыть страницу курса')+'</small></span><span class="go">'+ic('go',16)+'</span></button>';
  return ''; }
function render(){ const w=S.w, st=S.st, g=isGen(w); $('[data-sub]',box).textContent=g?'Спроси о чём угодно':w?(DZN[w.dz]||'')+' · вариант '+w.n:'';
  $('.tu-att',box).hidden=g; inp.placeholder=g?'Спроси о чём угодно…':'Спроси про свой вариант…'; streakShow(); box.classList.toggle('busy',!!S.busy);
  box.querySelectorAll('[data-mode]').forEach(b=>{ const on=st&&st.mode===b.dataset.mode; b.classList.toggle('on',!!on); b.setAttribute('aria-selected',String(!!on)); });
  $('[data-foot]',box).hidden=!(st&&st.ready); $('.tu-mode',box).hidden=!(st&&st.ready)||g;
  if(!tok()){ body.innerHTML=gateH('hello','Войди, и начнём','Лука ответит на любой вопрос по курсу, помнит, где ты застрял, и ведёт по шагам твоего варианта прямо на чертеже. Вход — тот же, что в личном кабинете.','<a class="tu-btn" href="/lk/#/login" data-login>Войти</a>'+playLink()); gate(); return; }
  if(!st){ body.innerHTML='<div class="tu-wait"><span class="tu-dots"><i></i><i></i><i></i></span><span class="tu-shim">Открываю…</span></div>'; return; }
  if(!st.on){ body.innerHTML=gateH('sleep','Лука скоро появится','Пока его не подключили. Вопрос можно задать автору.','<a class="tu-btn" href="#/ask">Спросить автора</a>'); gate(); return; }
  if(!st.consent&&!st.ru){ body.innerHTML=gateH('hello','Лука работает на модели Claude','Это зарубежная модель (Anthropic, через ProxyAPI). Ей уходит только текст твоего вопроса, страница сайта или номер варианта, где ты спрашиваешь, выделенный тобой текст и, если ты сам пришлёшь, фото листа. Имя, почта, группа и другие данные о тебе — не уходят. Фото не хранится.','<button class="tu-btn" data-consent>Согласен, начать</button>'); gate(); return; }
  let h=''; if(!st.msgs.length) h+=g
    ?'<div class="tu-hi"><i class="tu-gav" data-mood="hello" aria-hidden="true"></i><b>Привет, я Лука</b><p>Спроси что угодно по начерту и черчению — найду в курсе, объясню своими словами и открою нужную страницу.</p><span class="tu-tip">'+ic('cursor',14)+'Выдели текст на странице — объясню его</span>'+playLink()+'</div>'+sugCards(sugGen())
    :'<div class="tu-hi"><i class="tu-gav" data-mood="hello" aria-hidden="true"></i><b>Привет, я Лука</b><p>Твой наставник по '+esc(String(DZN[w.dz]||'ДЗ').replace(/^.* · /,''))+'. Открою нужный шаг прямо на чертеже и обведу точки. Сначала подскажу, решение — когда попробуешь сам.</p><span class="tu-tip">'+ic('cam',14)+'Пришли фото листа — найду ошибку</span>'+playLink()+'</div>'+sugCards(isNg(w)?SUG_NG:w.dz==='ig4'?SUG:SUG_IG);
  const qr=i=>i===st.msgs.length-1&&!S.busy?'<div class="tu-qr" role="group" aria-label="Быстрые ответы">'+chips(g?QR_GEN:QR)+'</div>':'';
  st.msgs.forEach((m,i)=>{ const nw=S.fresh!=null&&i>=S.fresh?' tu-new':'';
    if(m.from==='u') h+='<div class="tu-m u'+nw+'"><div class="tu-bb">'+(m.photo?'<span style="display:inline-flex;vertical-align:-3px;margin-right:6px">'+ic('cam',16)+'</span>':'')+esc(m.text||'Фото листа')+'</div></div>';
    else { const acts=(m.actions||[]).map((a,j)=>card(i,j,a)).join('');
      const meta=(m.verified||m.id)?'<div class="tu-meta">'+(m.verified?'<span class="tu-ok" title="Все числа и номера сверены с точным решением и текстом курса">'+ic('check',14)+'сверено</span>':'')+(m.id?'<button class="tu-r'+(m.rate===1?' on':'')+'" data-rate="'+esc(m.id)+':1" aria-label="Полезно" title="Полезно">'+ic('up',15)+'</button><button class="tu-r'+(m.rate===0?' on':'')+'" data-rate="'+esc(m.id)+':0" aria-label="Не помогло" title="Не помогло">'+ic('down',15)+'</button>':'')+'</div>':'';
      h+='<div class="tu-m t'+nw+'"><div class="tu-by"><i></i>Лука</div><div class="tu-bb">'+rich(m.text)+'</div><div class="tu-x">'+acts+meta+'</div>'+qr(i)+'</div>'; } });
  if(S.busy) h+='<div class="tu-wait"><span class="tu-dots"><i></i><i></i><i></i></span><span class="tu-shim" data-wtx>'+esc(waitText())+'</span></div>';
  if(S.err) h+='<div class="tu-err">'+ic('warn',18)+'<span>'+esc(S.err)+'</span></div>';
  body.innerHTML=h;
  /* новый ответ Луки проявляется слово за словом (текст в DOM сразу целиком — для поиска и чтения с экрана) */
  const fresh=S.fresh!=null; if(fresh){ body.querySelectorAll('.tu-m.t.tu-new .tu-bb').forEach(reveal); S.fresh=null; }
  /* пустой разговор — приветствие сверху; иначе — к последнему сообщению (новое — плавно) */
  if(st.msgs.length){ if(fresh&&body.scrollTo) body.scrollTo({top:body.scrollHeight,behavior:'smooth'}); else body.scrollTop=body.scrollHeight; } else { body.scrollTop=0; gate(); }
  pv.hidden=!S.photo; pv.innerHTML=S.photo?'<img alt="" src="'+S.photo+'"><span>Фото листа</span><button class="tu-ib" data-unphoto aria-label="Убрать фото">'+ic('close',17)+'</button>':'';
  sendState();
  if(hdrAv){ const want=S.busyPhoto?'study':'think'; if(S.busy){ if(hdrAv.state!==want) hdrAv.play(want); } else if(hdrAv.state==='think'||hdrAv.state==='study') hdrAv.idle(); }
  renderPeek(); }
function sendState(){ $('[data-send]',box).disabled=S.busy||(!inp.value.trim()&&!S.photo); }
function reveal(el){ if(MC()&&MC().reduced&&MC().reduced()) return; let n=0;
  const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT), nodes=[]; while(tw.nextNode()) nodes.push(tw.currentNode);
  for(const t of nodes){ const parts=t.nodeValue.split(/(\s+)/); if(parts.length<2&&!t.nodeValue.trim()) continue; const f=document.createDocumentFragment();
    for(const p of parts){ if(!p) continue; if(/^\s+$/.test(p)||n>260){ f.appendChild(document.createTextNode(p)); continue; }
      const sp=document.createElement('span'); sp.className='tu-w'; sp.style.animationDelay=Math.min(n*22,1600)+'ms'; sp.textContent=p; f.appendChild(sp); n++; }
    t.parentNode.replaceChild(f,t); } }
/* что делает Лука, пока ждём ответ: то, что сервер действительно делает — думает, ищет, сверяет */
let waitT0=0, waitI=0;
function waitText(){ const s=(Date.now()-waitT0)/1000; if(S.busyPhoto) return s<6?'Смотрю на твой лист…':'Сравниваю с эталоном…';
  return s<3?'Думаю…':s<9?(isGen(S.w)?'Ищу ответ в курсе…':'Смотрю решение варианта…'):'Сверяю каждое число…'; }
/* быстрые ответы — без клавиатуры: лесенка подсказок идёт одними тапами */
const QR=['Понял, что дальше?','Ещё намёк','Почему так?','Покажи на чертеже','Проверь меня'];
const QR_GEN=['Объясни проще','Приведи пример','Проверь меня','Где это в ДЗ?','Ещё вопрос по теме'];
/* подсказки по странице: на главной — частые вопросы; на теме или теории — «про эту тему»; на задаче — «как начать» */
function sugGen(){ const h=location.hash||'';
  if(!h||h==='#'||h==='#/') return ['Что такое эпюр Монжа?','Как найти натуральную величину отрезка?','Как оформить основную надпись?','Как готовиться к РК?'];
  if(/^#\/(topic|ng\/path|ng\/cheat|ng\/learn|ig\/theory|ig\/learn|theory)/.test(h)) return ['Объясни эту тему проще','Приведи пример','Проверь меня по этой теме','Где это нужно в ДЗ?'];
  if(/task|quiz|check|ticket|rk/.test(h)) return ['С чего начать эту задачу?','Какое правило тут работает?','Типичные ошибки?','Проверь меня'];
  return ['Что такое конкурирующие точки?','Как построить линию пересечения плоскостей?','Разрез или сечение — в чём разница?','Как готовиться к РК?']; }
const playLink=()=>/^\/new\//.test(location.pathname)?'<a class="tu-play" href="'+location.pathname.replace(/\/new\/.*$/,'/new/')+'luka/">'+ic('game',16)+'Перемена? Поиграй со мной</a>':'';
/* полоска шторки (телефон): последняя реплика Луки и быстрые ответы */
function renderPeek(){ const pk=$('[data-pk]',box), st=S.st; if(!pk) return; let h='';
  if(S.busy) h='<div class="tu-pkt w" data-up><span class="tu-dots"><i></i><i></i><i></i></span><span class="tu-shim">'+esc(waitText())+'</span></div>';
  else { const m=st&&st.msgs&&[...st.msgs].reverse().find(x=>x.from==='t');
    h='<div class="tu-pkt" data-up>'+esc(m?String(m.text).replace(/\*\*/g,'').replace(/\s+/g,' '):isGen(S.w)?'Спроси Луку о чём угодно по курсу':'Спроси Луку про свой вариант')+'</div>';
    if(m&&st.ready) h+='<div class="tu-qr">'+chips(isGen(S.w)?QR_GEN:QR)+'</div>'; }
  pk.innerHTML=h; if(S.snap==='peek'&&isPhone()) snap('peek',true); }
/* большая аватарка на экранах входа и согласия */
function gate(){ const g=body.querySelector('.tu-gav'); if(!g) return; const m=av(g,{full:true}); if(m) m.play(g.dataset.mood||'hello'); }

async function load(){ const w=cur(); S.w=w; S.pin=false; S.st=null; S.err=''; render(); if(!tok()) return;
  try{ const st=await req('GET','/api/tutor/state?dz='+w.dz+(isGen(w)?'':'&n='+w.n)); st.ready=st.on&&(st.consent||st.ru); if(same(S.w,w)){ S.st=st; S.cache[wkey(w)]=st; } }
  catch(e){ if(same(S.w,w)) S.st={on:true,consent:true,ready:true,msgs:[],mode:'coach'}; S.err=e.message; }
  render(); }
function open(sn){ const was=S.open; S.open=true; clearTimeout(S.hideT); if(!was||box.classList.contains('tu-out')){ box.classList.remove('tu-out'); box.hidden=false; void box.offsetWidth; box.classList.add('tu-in'); clearTimeout(S.inT); S.inT=setTimeout(()=>box.classList.remove('tu-in'),900); } box.hidden=false; fab.hidden=true; const u=fab.querySelector('u'); if(u) u.remove(); fabNote('');
  if(isPhone()) snap(typeof sn==='string'?sn:(was&&S.snap!=='peek'?S.snap:'half'),!was);
  say(S.greeted?'giggle':'hello'); S.greeted=true;
  if(!S.st||!S.w||(!S.pin&&!same(S.w,cur()))) load(); else render(); setTimeout(()=>{ if(innerWidth>=760) inp.focus(); },50); }
function close(peek){ const was=S.open; S.open=false; S.pin=false; fab.hidden=false; speakStop(); box.classList.remove('tu-in');
  if(was&&!box.hidden&&!(MC()&&MC().reduced&&MC().reduced())){ box.classList.add('tu-out'); clearTimeout(S.hideT); S.hideT=setTimeout(()=>{ if(!S.open){ box.hidden=true; box.classList.remove('tu-out'); box.style.removeProperty('--tu-h'); } },230); }
  else { box.hidden=true; box.style.removeProperty('--tu-h'); } if(peek&&!fab.querySelector('u')) fab.insertAdjacentHTML('beforeend','<u></u>'); if(peek&&fabAv) fabAv.play('hello'); }
function route(){ const w=cur(); if(!here()){ const M=MC(); if(M) M.untour(true); } toTop();
  selB.hidden=true; fab.hidden=S.open; fabPlace();
  /* другая страница — другой разговор (вариант ДЗ или «о чём угодно»); открытую Лукой страницу разговор не меняет */
  if(S.w&&!same(S.w,w)&&!S.pin){ if(S.st) S.cache[wkey(S.w)]=S.st; S.w=w; S.st=S.cache[wkey(w)]||null; if(S.open){ if(S.st) render(); else load(); } } }

/* ── шторка (телефон): полоска · половина · весь экран; тянуть за верх, тап по полоске — половина ── */
S.snap='half';
function snapH(sn){ const full=Math.min(Math.round(innerHeight*.88),innerHeight-40);
  if(sn==='full') return full; if(sn==='half') return Math.min(full,Math.max(320,Math.round(innerHeight*.52)));
  return Math.min(full,$('[data-top]',box).offsetHeight+2); }
function snap(sn,instant){ S.snap=sn; box.dataset.snap=sn; if(!isPhone()){ box.style.removeProperty('--tu-h'); return; }
  if(instant) box.classList.add('drag'); box.style.setProperty('--tu-h',snapH(sn)+'px');
  if(instant) requestAnimationFrame(()=>requestAnimationFrame(()=>box.classList.remove('drag'))); }
function peek(){ if(!S.open) open('peek'); else snap('peek'); }
{ const top=$('[data-top]',box); let d=null;
  top.addEventListener('pointerdown',e=>{ if(!isPhone()||e.target.closest('button,a')) return; d={y:e.clientY,h:box.offsetHeight,t:performance.now(),moved:false}; try{ top.setPointerCapture(e.pointerId); }catch(_){} });
  top.addEventListener('pointermove',e=>{ if(!d) return; const dy=e.clientY-d.y; if(Math.abs(dy)>6) d.moved=true; if(!d.moved) return;
    if(S.snap==='peek'&&dy<0){ box.dataset.snap='half'; }   /* тянут вверх из полоски — показать разговор */
    box.classList.add('drag'); box.style.setProperty('--tu-h',Math.max(60,Math.min(snapH('full'),d.h-dy))+'px'); });
  const up=e=>{ if(!d) return; const q=d; d=null; box.classList.remove('drag');
    if(!q.moved) return;   /* тап — раскрывает обработчик click: иначе под пальцем окажется поле ввода и шторка уйдёт на весь экран */
    S.dragEnd=performance.now();
    const h=box.offsetHeight, v=(q.h-h)/Math.max(1,performance.now()-q.t)*1000, proj=h+v*.18;
    const pk=(box.dataset.snap='peek',snapH('peek')); box.dataset.snap=S.snap;
    if(proj<pk-50) return close(true);
    const c=[['peek',pk],['half',snapH('half')],['full',snapH('full')]].sort((a,b)=>Math.abs(a[1]-proj)-Math.abs(b[1]-proj))[0][0]; snap(c); };
  top.addEventListener('pointerup',up); top.addEventListener('pointercancel',up); }
box.addEventListener('click',e=>{ if(S.snap!=='peek'||!isPhone()||performance.now()-(S.dragEnd||0)<350) return;
  if(e.target.closest('[data-top]')&&!e.target.closest('button,a')) snap('half'); });

/* ── Лука вместо кнопки (телефон): перетаскивается к любому краю; ответ пришёл, а окно закрыто — машет и говорит облачком ── */
function fabPos(){ try{ return JSON.parse(LS.get('tu_fab')||'null'); }catch(e){ return null; } }
function fabPlace(){ if(!isPhone()){ fab.style.left=fab.style.right=fab.style.top=fab.style.bottom=''; fab.classList.remove('l'); return; }
  const p=fabPos(); if(!p) { fab.style.left=fab.style.right=fab.style.top=fab.style.bottom=''; fab.classList.remove('l'); return; }
  const y=Math.max(70,Math.min(innerHeight-150,p.y)); fab.style.top=y+'px'; fab.style.bottom='auto';
  if(p.side==='l'){ fab.style.left='6px'; fab.style.right='auto'; } else { fab.style.right='6px'; fab.style.left='auto'; } fab.classList.toggle('l',p.side==='l'); }
{ let d=null, dragged=false;
  fab.addEventListener('pointerdown',e=>{ dragged=false; if(!isPhone()) return; const r=fab.getBoundingClientRect(); d={x:e.clientX,y:e.clientY,ox:e.clientX-r.left,oy:e.clientY-r.top}; try{ fab.setPointerCapture(e.pointerId); }catch(_){} });
  fab.addEventListener('pointermove',e=>{ if(!d) return; if(!dragged&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<10) return;
    if(!dragged){ dragged=true; fab.classList.add('drag'); if(fabAv) fabAv.play('hello',99999); }
    fab.style.left=(e.clientX-d.ox)+'px'; fab.style.top=(e.clientY-d.oy)+'px'; fab.style.right='auto'; fab.style.bottom='auto'; });
  const up=e=>{ if(!d) return; d=null; fab.classList.remove('drag'); if(!dragged) return;
    const r=fab.getBoundingClientRect(); LS.set('tu_fab',JSON.stringify({side:r.left+r.width/2<innerWidth/2?'l':'r',y:Math.round(r.top)})); fabPlace(); if(fabAv) fabAv.play('giggle'); };
  fab.addEventListener('pointerup',up); fab.addEventListener('pointercancel',up);
  fab.addEventListener('click',e=>{ if(dragged){ e.stopImmediatePropagation(); e.preventDefault(); dragged=false; } },true); }
let fabNoteT=0;
function fabNote(t){ let b=fab.querySelector('.tu-fb'); clearTimeout(fabNoteT); if(!t){ if(b) b.remove(); return; }
  if(!b){ b=document.createElement('b'); b.className='tu-fb'; fab.appendChild(b); } const x=String(t).replace(/\*\*/g,'').replace(/\s+/g,' ');
  b.textContent=x.length>90?x.slice(0,88).replace(/\s\S*$/,'')+'…':x; if(fabAv) fabAv.play('hello').talk(2400); fabNoteT=setTimeout(()=>fabNote(''),9000); }

async function send(text){ if(S.busy) return; text=String(text==null?inp.value:text).trim(); if(!text&&!S.photo) return;
  /* студент перешёл на другую страницу (например, открытую Лукой) и спрашивает снова — разговор этой страницы */
  if(S.w&&!same(S.w,cur())){ S.pin=false; if(S.st) S.cache[wkey(S.w)]=S.st; S.w=cur(); S.st=S.cache[wkey(S.w)]||null; if(!S.st) await load(); }
  const w=S.w||cur(); if(!S.st||!S.st.ready) return;
  const g=isGen(w), step=g?null:stepOf(w), photo=g?null:S.photo, sel=S.sel; S.sel='';
  S.busy=true; S.busyPhoto=!!photo; S.err=''; S.st.msgs.push({from:'u',text,photo:!!photo}); S.fresh=S.st.msgs.length-1; inp.value=''; inp.style.height=''; S.photo=null; waitT0=Date.now();
  clearInterval(waitI); waitI=setInterval(()=>{ if(!S.busy) return clearInterval(waitI); box.querySelectorAll('[data-wtx],.tu-pkt.w .tu-shim').forEach(e=>{ e.textContent=waitText(); }); },1000); render();
  try{ let ref=''; if(photo){ try{ ref=await reference(w.n,w.dz); }catch(e){ ref=''; } }
    const r=await req('POST','/api/tutor/chat',{dz:w.dz,n:g?undefined:w.n,text,step,mode:S.st.mode,photo:photo||undefined,ref:ref||undefined,page:pageCtx(),sel:sel||undefined});
    dayMark();
    S.st.msgs.push({from:'t',text:r.reply,actions:r.actions||[],id:r.id,verified:r.verified,rate:null}); S.fresh=S.st.msgs.length-1; S.st.mode=r.mode||S.st.mode;
    S.busy=false; render();
    /* по фото нашлась точка с ошибкой — Лука пугается и идёт её обводить; иначе просто говорит */
    const found=!!photo&&(r.actions||[]).some(a=>a.t==='show'&&a.points&&a.points.length);
    if(hdrAv){ hdrAv.play(found?'oops':'talk',found?0:talkMs(r.reply)); hdrAv.talk(talkMs(r.reply)); }
    if(!S.open){ fabNote(r.reply); if(!fab.querySelector('u')) fab.insertAdjacentHTML('beforeend','<u></u>'); }
    if(S.voice) speak(r.reply);
    for(const a of r.actions||[]) await act(a,{mood:found?'oops':''}); }
  catch(e){ S.busy=false; S.err=e.message; say('sad'); if(e.data&&e.data.needAiConsent){ S.st.consent=false; S.st.ready=false; }
    if(photo&&!S.photo) S.photo=photo; render(); } }

/* ── события ── */
fab.addEventListener('click',open);
box.addEventListener('click',async e=>{ const t=e.target.closest('button,a'); if(!t) return;
  if(t.matches('[data-close]')) return close();
  if(t.matches('[data-voice]')){ S.voice=!S.voice; LS.set('tu_voice',S.voice?'1':null); voiceBtn(); if(!S.voice) speakStop(); else { const m=S.st&&[...(S.st.msgs||[])].reverse().find(x=>x.from==='t'); if(m) speak(m.text); } return; }
  if(t.matches('[data-mic]')) return mic();
  if(t.matches('[data-send]')) return send();
  if(t.matches('[data-sug]')) return send(t.textContent);
  if(t.matches('[data-unphoto]')){ S.photo=null; return render(); }
  if(t.matches('[data-login]')){ e.preventDefault(); LS.set('lk_ret',(/^\/new\//.test(location.pathname)?'/new/':'/')+(location.hash||'')); location.href='/lk/#/login'; return; }
  if(t.matches('[data-consent]')){ t.disabled=true; try{ await req('POST','/api/me/profile',{ai:true}); S.st.consent=true; S.st.ready=true; }catch(er){ S.err=er.message; } return render(); }
  if(t.matches('[data-mode]')){ if(!S.st||S.st.mode===t.dataset.mode) return; S.st.mode=t.dataset.mode; render();
    try{ await req('POST','/api/tutor/mode',{dz:S.w.dz,n:S.w.n,mode:t.dataset.mode}); }catch(er){ S.err=er.message; render(); } return; }
  if(t.matches('[data-menu]')){ if(!S.st||!S.st.msgs.length||!confirm('Начать разговор по этому варианту заново? Наставник забудет, что вы обсуждали.')) return;
    try{ await req('POST','/api/tutor/reset',{dz:S.w.dz,n:S.w.n}); S.st.msgs=[]; }catch(er){ S.err=er.message; } return render(); }
  if(t.matches('[data-act]')){ const [i,j]=t.dataset.act.split(':').map(Number), m=S.st.msgs[i]; return act(m&&m.actions[j]); }
  if(t.matches('[data-step]')){ e.preventDefault(); return act({t:'show',step:+t.dataset.step,points:[]}); }
  if(t.matches('[data-rate]')){ const [id,g]=[t.dataset.rate.slice(0,-2),t.dataset.rate.slice(-1)], m=S.st.msgs.find(x=>x.id===id); if(m) m.rate=+g; render(); say(g==='1'?'happy':'sad');
    try{ await req('POST','/api/tutor/rate',{id,good:g==='1'}); }catch(er){} } });
inp.addEventListener('focus',()=>{ if(isPhone()&&S.snap!=='full') snap('full'); });
inp.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){ e.preventDefault(); send(); } });
inp.addEventListener('input',()=>{ inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,innerHeight*.3)+'px'; sendState(); });
$('[data-file]',box).addEventListener('change',async e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return;
  try{ S.photo=await shrink(f); S.err=''; }catch(er){ S.err=er.message; } render(); });
/* ⌘K / Ctrl+K — позвать Луку с любой страницы (или спрятать) */
addEventListener('keydown',e=>{ if((e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&(e.key==='k'||e.key==='K'||e.key==='л'||e.key==='Л')){ e.preventDefault(); if(S.open) close(); else { open(); setTimeout(()=>inp.focus(),80); } } });
addEventListener('keydown',e=>{ if(e.key==='Escape'&&S.open) close(); });

/* ── голос: вопрос микрофоном (распознавание речи браузера) и ответы вслух ── */
const SR=self.SpeechRecognition||self.webkitSpeechRecognition, micB=$('[data-mic]',box); let rec=null;
if(SR) micB.hidden=false;
if(MC()&&MC().pose) MC().pose('listen',{smile:.4,brow:.8,tilt:10,armR:150,armL:15},{over:(R,t)=>{ R.armR+=Math.sin(t*3)*4; }});
function mic(){ if(!SR) return; if(rec){ try{ rec.stop(); }catch(e){} return; }
  const base=inp.value.trim(); let heard=false; rec=new SR(); rec.lang='ru-RU'; rec.interimResults=true; rec.continuous=false; rec.maxAlternatives=1;
  rec.onresult=e=>{ let txt=''; for(let i=0;i<e.results.length;i++) txt+=e.results[i][0].transcript; heard=!!txt.trim(); inp.value=(base?base+' ':'')+txt.trim(); inp.dispatchEvent(new Event('input')); };
  rec.onerror=e=>{ if(e.error==='not-allowed'||e.error==='service-not-allowed'){ S.err='Микрофон не разрешён — напиши вопрос текстом.'; render(); } };
  rec.onend=()=>{ rec=null; micB.classList.remove('on'); micB.setAttribute('aria-label','Спросить голосом'); if(hdrAv&&hdrAv.state==='listen') hdrAv.idle(); if(heard&&inp.value.trim()) send(); };
  try{ rec.start(); micB.classList.add('on'); micB.setAttribute('aria-label','Остановить запись'); if(hdrAv) hdrAv.play('listen',99999); speakStop(); }catch(e){ rec=null; } }
S.voice=LS.get('tu_voice')==='1';
function voiceBtn(){ const b=$('[data-voice]',box); b.innerHTML=ic(S.voice?'vol':'mute'); b.classList.toggle('on',!!S.voice); b.setAttribute('aria-pressed',String(!!S.voice)); b.hidden=!self.speechSynthesis; }
voiceBtn();
let talkI=0;
function speak(text){ const ss=self.speechSynthesis; if(!ss||typeof SpeechSynthesisUtterance==='undefined') return; speakStop();
  const t=String(text||'').replace(/\*\*/g,'').replace(/[″]/g,' два штриха').replace(/[′]/g,' штрих').replace(/[‴]/g,' три штриха').replace(/π₁/g,'пи один').replace(/π₂/g,'пи два').replace(/π₃/g,'пи три').slice(0,1200);
  const u=new SpeechSynthesisUtterance(t); u.lang='ru-RU'; const v=(ss.getVoices()||[]).find(x=>/^ru/i.test(x.lang)); if(v) u.voice=v; u.pitch=1.25; u.rate=1.05;
  u.onstart=()=>{ clearInterval(talkI); talkI=setInterval(()=>{ if(hdrAv) hdrAv.talk(500); if(fabAv&&!S.open) fabAv.talk(500); },400); };
  u.onend=u.onerror=()=>clearInterval(talkI); try{ ss.speak(u); }catch(e){} }
function speakStop(){ clearInterval(talkI); try{ if(self.speechSynthesis) speechSynthesis.cancel(); }catch(e){} }
try{ if(self.speechSynthesis){ speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged=()=>{ speechSynthesis.getVoices(); voiceBtn(); }; } }catch(e){}

/* ── «Спросить Луку» у выделенного текста: выдели непонятное на странице — объяснит именно его ── */
let selT=0;
document.addEventListener('selectionchange',()=>{ clearTimeout(selT); selT=setTimeout(selCheck,280); });
function selCheck(){ const s=getSelection&&getSelection(), t=s&&String(s).replace(/\s+/g,' ').trim();
  if(!t||t.length<3||t.length>400||!s.rangeCount){ selB.hidden=true; return; }
  const n=s.anchorNode&&(s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement);
  if(!n||n.closest('.tu,.tu-fab,.tu-selask,input,textarea,[contenteditable],.mc-tour')){ selB.hidden=true; return; }
  const r=s.getRangeAt(0).getBoundingClientRect(); if(!r.width&&!r.height){ selB.hidden=true; return; }
  const x=Math.max(90,Math.min(innerWidth-90,r.left+r.width/2)), below=r.top<70||isPhone();   /* на телефоне сверху — системное меню выделения */
  selB.style.left=x+'px'; selB.style.top=(below?Math.min(innerHeight-60,r.bottom+12):r.top-46)+'px'; selB.dataset.t=t;
  if(selB.hidden){ selB.hidden=false; if(!selB._av) selB._av=av(selB.querySelector('i')); if(selB._av) selB._av.play('hello',900); } }
addEventListener('scroll',()=>{ if(!selB.hidden) selCheck(); },{passive:true});
selB.addEventListener('pointerdown',e=>e.preventDefault());   /* не снимать выделение до клика */
selB.addEventListener('click',()=>{ const t=selB.dataset.t||''; selB.hidden=true; if(!t) return; S.sel=t; ask('Объясни: «'+(t.length>160?t.slice(0,158)+'…':t)+'»'); try{ getSelection().removeAllRanges(); }catch(e){} });

/* ── сам подсказывает: застрял на шаге варианта — «Спроси, покажу»; привет новичку; «я скучал» после перерыва ── */
function stepOf(w){ if(!w||isGen(w)) return null; const P=igP(w.dz); return isNg(w)?ngStep(w):P&&P.model&&(w.dz==='ig4'?+P.model.n===w.n:P.model===igModel(w.dz,w.n))?P.current():null; }
let nStep=null, nSince=0, lastUse=Date.now(); const nudged=new Set();
['pointerdown','keydown'].forEach(ev=>addEventListener(ev,()=>{ lastUse=Date.now(); },{passive:true}));
setInterval(()=>{ const w=here(); if(!w||S.open||S.busy||document.hidden||!mounted) return; const k=stepOf(w); if(k==null) return;
  if(k!==nStep){ nStep=k; nSince=Date.now(); return; }
  const key=wkey(w)+':'+k; if(Date.now()-nSince>150000&&Date.now()-lastUse<90000&&!nudged.has(key)){ nudged.add(key); fabNote('Застрял на шаге '+k+'? Спроси — покажу прямо на чертеже.'); } },15000);
/* серия дней с Лукой (как у тамагочи, но без наказаний): день считается, если студент спросил Луку */
const day=t=>new Date((t||Date.now())+3*3600e3).toISOString().slice(0,10);
function days(){ try{ const d=JSON.parse(LS.get('tu_days')||'[]'); return Array.isArray(d)?d:[]; }catch(e){ return []; } }
function streak(){ const d=days(); if(!d.length) return 0; let n=0, t=Date.now(); if(d[d.length-1]!==day(t)) t-=864e5; for(let i=d.length-1;i>=0;i--){ if(d[i]===day(t)){ n++; t-=864e5; } else break; } return n; }
function dayMark(){ const d=days(), td=day(); if(d[d.length-1]===td) return; d.push(td); LS.set('tu_days',JSON.stringify(d.slice(-60))); const n=streak(); streakShow(); if(n>=2&&hdrAv) setTimeout(()=>hdrAv.play('happy'),900); }
function streakShow(){ const el=$('[data-streak]',box), n=streak(); el.hidden=n<2; el.innerHTML=flame(12)+n; el.title=n+' '+(n%10===1&&n%100!==11?'день':n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'дня':'дней')+' подряд с Лукой'; }
function hello(){ const d=days(), last=d[d.length-1], gap=last?(Date.parse(day())-Date.parse(last))/864e5:0;
  setTimeout(()=>{ if(S.open||fab.hidden) return;
    if(!LS.get('tu_hi')){ LS.set('tu_hi','1'); fabNote('Привет! Я Лука. Спроси меня о чём угодно по начерту и черчению — объясню и покажу.'); }
    else if(gap>=3) fabNote('Привет! Я скучал. Продолжим?'); },4200); }
/* открыть Луку и спросить (если ещё не вошёл или нет согласия — окно покажет, что сделать) */

self.TUTOR={open,close,send,act,reference,state:()=>({open:S.open,busy:S.busy,w:S.w,st:S.st,err:S.err,snap:S.snap,pin:S.pin,voice:!!S.voice}),mascot:()=>{ const M=MC(); return M?Object.assign(M.state(),{fab:fabAv&&fabAv.state,head:hdrAv&&hdrAv.state}):null; }};
/* запуск — в самом конце: всё выше уже объявлено (скрипт с defer может застать документ готовым) */
addEventListener('hashchange',route);
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
