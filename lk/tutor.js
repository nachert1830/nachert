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
.tu-fab{position:fixed;right:18px;bottom:calc(var(--tabh,64px) + 16px + env(safe-area-inset-bottom));z-index:330;display:inline-flex;align-items:center;gap:9px;height:52px;padding:0 18px 0 8px;border:0;border-radius:99px;background:var(--ink,#15161a);color:var(--paper,#fff);font:800 15px var(--sans,system-ui);cursor:pointer;box-shadow:0 16px 34px -14px rgba(8,11,18,.7);transition:transform .2s}
.tu-fab:hover{transform:translateY(-2px)}
.tu-fab i{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:linear-gradient(150deg,#eef3ff,#cfdcff);color:#1f47d6;font:800 16px var(--sans,system-ui);font-style:normal;--mc-ink:#1d2233}
.tu-hav{flex:none;width:46px;height:46px;border-radius:15px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(150deg,#eef3ff,#cfdcff);color:#1f47d6;font:800 18px var(--sans,system-ui);cursor:pointer;--mc-ink:#1d2233}
.tu-gav{display:block;width:88px;height:88px;margin:0 auto 10px;border-radius:26px;overflow:hidden;background:linear-gradient(150deg,#eef3ff,#cfdcff);--mc-ink:#1d2233}
.tu-fab u{position:absolute;top:2px;right:4px;width:12px;height:12px;border-radius:50%;background:var(--red,#e8392b);box-shadow:0 0 0 2px var(--paper,#fff)}
@media (min-width:900px){.tu-fab{bottom:24px}}
.tu-gate .tu-play{display:inline-block;margin-top:12px;color:var(--blue,#1f47d6);font:700 14px var(--sans,system-ui);text-decoration:none;border-bottom:1.5px dotted currentColor}
.tu{position:fixed;z-index:340;display:flex;flex-direction:column;background:var(--paper,#fff);color:var(--ink,#15161a);font:15.5px/1.5 var(--sans,system-ui);box-shadow:0 24px 60px -20px rgba(8,11,18,.55);border:1px solid var(--line,#e3e6ec)}
@media (min-width:760px){.tu{right:16px;bottom:16px;width:410px;height:min(720px,calc(100vh - 32px));border-radius:24px}}
@media (max-width:759px){
.tu{left:0;right:0;bottom:0;height:var(--tu-h,min(52vh,520px));max-height:calc(100vh - 40px);border-radius:22px 22px 0 0;padding-bottom:env(safe-area-inset-bottom);transition:height .32s cubic-bezier(.2,.9,.25,1);overflow:hidden}
.tu.drag{transition:none}
.tu-top{touch-action:none;cursor:grab}
.tu .tu-grab{display:block;width:40px;height:5px;margin:8px auto 0;border-radius:99px;background:var(--line2,#d9dde5)}
.tu[data-snap=peek] .tu-mode,.tu[data-snap=peek] .tu-b,.tu[data-snap=peek] .tu-f{display:none!important}
.tu[data-snap=peek] .tu-pk{display:grid}
.tu[data-snap=peek] .tu-h{border-bottom:0;padding-bottom:4px}
.tu-fab{width:70px;height:80px;padding:0;gap:0;border-radius:0;background:none!important;box-shadow:none;font-size:0;right:6px;bottom:calc(var(--tabh,64px) + 2px + env(safe-area-inset-bottom));touch-action:none}
.tu-fab:hover{transform:none}
.tu-fab i{width:70px;height:80px;border-radius:0;background:none;filter:drop-shadow(0 6px 7px rgba(8,11,18,.28))}
.tu-fab u{top:8px;right:8px}
.tu-fab.drag{transition:none;opacity:.92}
}
.tu-grab,.tu-pk{display:none}
.tu-pk{gap:8px;padding:0 14px 12px}
.tu-pkt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:500 14.5px/1.4 var(--sans,system-ui);color:var(--ink,#15161a);cursor:pointer}
.tu-pkt.w{display:flex;align-items:center;gap:8px;color:var(--mut,#667)}
.tu-pkt.w i{width:8px;height:8px;border-radius:50%;background:var(--acc,#1f47d6);animation:tuP 1s infinite alternate}
.tu-qr{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -2px;padding:2px}
.tu-qr::-webkit-scrollbar{display:none}
.tu-b .tu-qr{flex-wrap:wrap;overflow:visible}
.tu-qr .tu-chip{flex:none;height:34px;font-size:13px}
.tu-fb{position:absolute;bottom:calc(100% + 6px);right:6px;width:max-content;max-width:min(250px,70vw);padding:8px 11px;border-radius:14px;background:#fff;color:#15161a;border:1.5px solid #15161a;font:600 13px/1.35 var(--sans,system-ui);text-align:left;box-shadow:0 10px 24px -12px rgba(8,11,18,.55);white-space:normal}
.tu-fab.l .tu-fb{right:auto;left:6px}
.tu-fb::after{content:"";position:absolute;bottom:-7px;right:24px;width:12px;height:12px;background:#fff;border-right:1.5px solid #15161a;border-bottom:1.5px solid #15161a;transform:rotate(45deg)}
.tu-fab.l .tu-fb::after{right:auto;left:24px}
.tu[hidden],.tu-fab[hidden],.tu-att[hidden],.tu-mic[hidden],.tu-ib[hidden],.tu-streak[hidden]{display:none}
svg .tu-hl{fill:#e5484d!important;font-weight:800!important;paint-order:stroke;stroke:rgba(229,72,77,.25);stroke-width:6px}
.tu-note{position:absolute;z-index:6;max-width:220px;padding:5px 9px;border-radius:10px;background:#fff;color:#15161a;border:1.5px solid #e5484d;font:600 12.5px/1.3 var(--sans,system-ui);box-shadow:0 6px 16px -8px rgba(8,11,18,.45);pointer-events:none}
.tu-note b{color:#e5484d}
body:has(.ckn) .tu-fab,body:has(#ns-gate:not([hidden])) .tu-fab,html.ns-on body:has(#ns-gate:not([hidden])) .tu,body:has(#ns.login) .tu-fab,body:has(#ns.howon) .tu-fab,body:has(#ns.login) .tu-selask{display:none}
/* главная нового дизайна (#ns) лежит поверх всего — Лука над ней (позже в DOM, тот же уровень) */
html.ns-on .tu-fab,html.ns-on .tu,html.ns-on .tu-selask{z-index:2147480000}
.tu-selask{position:fixed;z-index:345;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px 0 5px;border:0;border-radius:99px;background:var(--ink,#15161a);color:var(--paper,#fff);font:700 13.5px var(--sans,system-ui);box-shadow:0 10px 24px -10px rgba(8,11,18,.6);cursor:pointer;transform:translate(-50%,0);animation:tuIn .18s ease-out}
.tu-selask i{width:28px;height:28px;border-radius:50%;overflow:hidden;background:linear-gradient(150deg,#eef3ff,#cfdcff)}
.tu-selask[hidden]{display:none}
@keyframes tuIn{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}
.tu-mic{width:44px;height:44px;flex:none;border-radius:14px;border:1px solid var(--line2,#d9dde5);background:var(--surf2,#f1f3f7);display:grid;place-items:center;cursor:pointer;font-size:18px}
.tu-mic.on{background:#e5484d;border-color:#e5484d;color:#fff;animation:tuRec 1s infinite alternate}
@keyframes tuRec{from{box-shadow:0 0 0 0 rgba(229,72,77,.45)}to{box-shadow:0 0 0 7px rgba(229,72,77,0)}}
.tu-ib.on{background:var(--acc,#1f47d6);color:#fff}
.tu-streak{display:inline-flex;align-items:center;gap:2px;margin-left:6px;padding:1px 7px;border-radius:99px;background:color-mix(in srgb,#ff6a2a 14%,transparent);color:#d9480f;font:800 11.5px var(--sans,system-ui);vertical-align:1px}
.tu-open{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:14px;border:1px solid var(--line2,#d9dde5);background:var(--surf,#fff);color:var(--ink,#15161a);font:700 13.5px/1.25 var(--sans,system-ui);text-align:left;cursor:pointer;max-width:100%}
.tu-open small{display:block;color:var(--mut,#667);font:600 11.5px var(--sans,system-ui)}
.tu-open:hover{border-color:var(--acc,#1f47d6)}
.tu-h{display:flex;align-items:center;gap:10px;padding:12px 12px 10px 16px;border-bottom:1px solid var(--line,#e3e6ec)}
.tu-h b{font:800 17px/1.2 var(--disp,inherit)}.tu-h small{display:block;color:var(--mut,#667);font:600 12.5px var(--sans,system-ui)}
.tu-h .sp{flex:1}
.tu-ib{width:36px;height:36px;border:0;border-radius:12px;background:var(--surf2,#f1f3f7);color:var(--ink2,#334);cursor:pointer;font-size:17px;display:grid;place-items:center}
.tu-mode{display:flex;gap:4px;margin:10px 16px 0;padding:4px;border-radius:14px;background:var(--surf2,#f1f3f7)}
.tu-mode button{flex:1;height:32px;border:0;border-radius:10px;background:none;color:var(--mut,#667);font:700 13.5px var(--sans,system-ui);cursor:pointer}
.tu-mode button.on{background:var(--surf,#fff);color:var(--ink,#15161a);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.tu-b{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
.tu-m{max-width:88%;display:flex;flex-direction:column;gap:5px}
.tu-m.u{align-self:flex-end;align-items:flex-end}.tu-m.t{align-self:flex-start}
.tu-bb{padding:10px 14px;border-radius:18px;overflow-wrap:anywhere}
.tu-m.u .tu-bb{background:var(--acc,#1f47d6);color:#fff;border-bottom-right-radius:6px}
.tu-m.t .tu-bb{background:var(--surf,#fff);border:1px solid var(--line2,#d9dde5);border-bottom-left-radius:6px}
.tu-bb a.tu-st{color:var(--blue,#1f47d6);font-weight:700;text-decoration:none;border-bottom:1.5px dotted currentColor;cursor:pointer}
.tu-x{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font:600 12.5px var(--sans,system-ui);color:var(--mut,#667)}
.tu-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:99px;border:1px solid var(--line2,#d9dde5);background:var(--surf,#fff);color:var(--ink2,#334);font:700 12.5px var(--sans,system-ui);cursor:pointer}
.tu-chip:hover{border-color:var(--acc,#1f47d6);color:var(--acc,#1f47d6)}
.tu-ok{color:var(--green,#1a7f4b)}
.tu-r{border:0;background:none;cursor:pointer;font-size:15px;opacity:.55;padding:2px 4px}.tu-r.on,.tu-r:hover{opacity:1}
.tu-sug{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.tu-hi{padding:14px;border-radius:18px;background:var(--blue-s,#eef2ff);color:var(--ink,#15161a)}
.tu-hi b{display:block;font:800 16.5px var(--disp,inherit);margin-bottom:4px}
.tu-hi p{margin:0;color:var(--ink2,#334);font-size:14.5px}
.tu-hi .tu-play{display:inline-block;margin-top:8px;color:var(--blue,#1f47d6);font:700 14px var(--sans,system-ui);text-decoration:none;border-bottom:1.5px dotted currentColor}
.tu-gate{margin:auto 0;padding:18px;border-radius:18px;background:var(--blue-s,#eef2ff);text-align:center}
.tu-gate b{display:block;font:800 18px var(--disp,inherit);margin-bottom:6px}.tu-gate p{margin:0 0 12px;color:var(--ink2,#334);font-size:14.5px;text-align:left}
.tu-btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 20px;border:0;border-radius:14px;background:var(--acc,#1f47d6);color:#fff!important;font:800 15px var(--sans,system-ui);cursor:pointer;text-decoration:none!important}
.tu-wait{align-self:flex-start;display:flex;align-items:center;gap:8px;color:var(--mut,#667);font-size:13.5px;padding:8px 12px;border-radius:99px;background:var(--surf2,#f1f3f7)}
.tu-wait i{width:8px;height:8px;border-radius:50%;background:var(--acc,#1f47d6);animation:tuP 1s infinite alternate}
@keyframes tuP{from{opacity:.25}to{opacity:1}}
.tu-err{align-self:stretch;padding:10px 12px;border-radius:14px;background:color-mix(in srgb,var(--red,#e8392b) 10%,transparent);color:var(--red,#c9302c);font-size:14px}
.tu-f{border-top:1px solid var(--line,#e3e6ec);padding:10px 12px 12px}
.tu-pv{display:flex;align-items:center;gap:8px;margin:0 0 8px;font:600 13px var(--sans,system-ui);color:var(--mut,#667)}
.tu-pv img{height:44px;border-radius:8px;border:1px solid var(--line,#e3e6ec)}
.tu-row{display:flex;align-items:flex-end;gap:8px}
.tu-row textarea{flex:1;min-height:44px;max-height:30vh;resize:none;border:1.5px solid var(--line2,#d9dde5);border-radius:14px;padding:10px 12px;background:var(--surf,#fff);color:var(--ink,#15161a);font:15.5px/1.45 var(--sans,system-ui);outline:0}
.tu-row textarea:focus{border-color:var(--acc,#1f47d6)}
.tu-att{width:44px;height:44px;border-radius:14px;border:1px solid var(--line2,#d9dde5);background:var(--surf2,#f1f3f7);display:grid;place-items:center;cursor:pointer;font-size:19px}
.tu-att input{display:none}
.tu-send{width:44px;height:44px;border:0;border-radius:14px;background:var(--acc,#1f47d6);color:#fff;font:800 19px var(--sans,system-ui);cursor:pointer}
.tu-send[disabled]{opacity:.5;cursor:default}
.tu-foot{margin:6px 2px 0;color:var(--mut2,#99a);font-size:11.5px;text-align:center}
`;
document.head.appendChild(css);

/* ── окно ── */
const S={open:false,busy:false,w:null,st:null,photo:null,err:'',cache:{},pin:false,sel:''};
const fab=document.createElement('button'); fab.className='tu-fab'; fab.type='button'; fab.hidden=true; fab.innerHTML='<i aria-hidden="true"></i>Спросить Луку'; fab.setAttribute('aria-label','Открыть наставника Луку');
const box=document.createElement('section'); box.className='tu'; box.hidden=true; box.setAttribute('role','dialog'); box.setAttribute('aria-label','Наставник Лука');
box.innerHTML=`<div class="tu-top" data-top><div class="tu-grab" aria-hidden="true"></div><div class="tu-h"><div class="tu-hav" data-hav aria-hidden="true" title="Лука"></div><div><b>Лука<span class="tu-streak" data-streak hidden></span></b><small data-sub></small></div><span class="sp"></span><button class="tu-ib" data-voice title="Читать ответы вслух" aria-label="Читать ответы вслух" aria-pressed="false">🔈</button><button class="tu-ib" data-menu title="Начать заново" aria-label="Начать заново">↺</button><button class="tu-ib" data-close aria-label="Закрыть">✕</button></div><div class="tu-pk" data-pk></div></div>
<div class="tu-mode" role="tablist" aria-label="Режим"><button data-mode="coach" role="tab" title="Подсказки по шагам: сначала наводка, потом идея, потом решение">Наставник</button><button data-mode="explain" role="tab" title="Объясняет решение полностью — если уже пробовал сам или готовишься к защите">Разбор</button></div>
<div class="tu-b" data-body aria-live="polite"></div>
<div class="tu-f" data-foot><div class="tu-pv" data-pv hidden></div><div class="tu-row"><label class="tu-att" title="Фото листа — Лука сравнит с решением">📷<input type="file" accept="image/*" data-file></label><button type="button" class="tu-mic" data-mic title="Спросить голосом" aria-label="Спросить голосом" hidden>🎤</button><textarea rows="1" data-in placeholder="Спроси про свой вариант…" aria-label="Вопрос Луке"></textarea><button class="tu-send" data-send aria-label="Отправить">↑</button></div>
<div class="tu-foot" data-foottx>Лука сверяет каждое число с точным решением и текстом курса. Фото не хранится.</div></div>`;
const selB=document.createElement('button'); selB.type='button'; selB.className='tu-selask'; selB.hidden=true; selB.innerHTML='<i aria-hidden="true"></i>Спросить Луку';
/* главная нового дизайна (#ns) добавляется позже нас и с тем же z-index ложится сверху — переносим Луку в конец body, после неё */
const toTop=()=>{ const ns=document.getElementById('ns'); if(ns&&(fab.compareDocumentPosition(ns)&Node.DOCUMENT_POSITION_FOLLOWING)) [fab,box,selB].forEach(e=>document.body.appendChild(e)); };
let mounted=false; const mount=()=>{ if(mounted) return; mounted=true; document.body.appendChild(fab); document.body.appendChild(box); document.body.appendChild(selB); route(); hello();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',toTop); else setTimeout(toTop,0); };
const body=$('[data-body]',box), inp=$('[data-in]',box), pv=$('[data-pv]',box);
/* Лука на кнопке (на телефоне — во весь рост, вместо кнопки) и в шапке окна; засыпают без дела, просыпаются от движения */
let fabAv=av(fab.querySelector('i'),{sleepAfter:90000,full:isPhone()}), fabFull=isPhone();
const hdrAv=av($('[data-hav]',box),{sleepAfter:120000});
addEventListener('resize',()=>{ if(isPhone()!==fabFull&&MC()){ fabFull=isPhone(); fabAv=av(fab.querySelector('i'),{sleepAfter:90000,full:fabFull}); } fabPlace(); if(S.open) snap(S.snap,true); });
if(hdrAv) hdrAv.onPoke=()=>hdrAv.play('giggle');
const say=(st,ms)=>{ if(hdrAv) hdrAv.play(st,ms); };

/* текст ответа: переносы, **жирный**, «шаг N» — ссылка, открывающая шаг на чертеже */
function rich(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^\p{L}])(шаг[\p{L}]*\s+(\d{1,2}))/giu,(m,a,t,k)=>a+'<a class="tu-st" data-step="'+k+'">'+t+'</a>').replace(/\n/g,'<br>'); }
const SUG=['С чего начать?','Не понимаю текущий шаг','Как найти точку на грани ⟂ π₃?','Готовлюсь к защите — спроси меня'];
const SUG_IG=['С чего начать?','Не понимаю текущий шаг','Как перенести точку на вид слева?','Готовлюсь к защите — спроси меня'];
const SUG_NG=['С чего начать?','Не понимаю текущий шаг','Какое правило здесь работает?','Готовлюсь к защите — спроси меня'];
function render(){ const w=S.w, st=S.st, g=isGen(w); $('[data-sub]',box).textContent=g?'Спроси о чём угодно по курсу':w?(DZN[w.dz]||'')+' · вариант '+w.n:'';
  $('.tu-att',box).hidden=g; inp.placeholder=g?'Спроси что угодно: теория, построения, ГОСТ…':'Спроси про свой вариант…'; streakShow();
  box.querySelectorAll('[data-mode]').forEach(b=>{ const on=st&&st.mode===b.dataset.mode; b.classList.toggle('on',!!on); b.setAttribute('aria-selected',String(!!on)); });
  $('[data-foot]',box).hidden=!(st&&st.ready); $('.tu-mode',box).hidden=!(st&&st.ready)||g;
  if(!tok()){ body.innerHTML='<div class="tu-gate"><i class="tu-gav" data-mood="hello" aria-hidden="true"></i><b>Войди, и начнём</b><p>Наставник помнит, где ты застрял, и ведёт по шагам твоего варианта. Вход — тот же, что в личном кабинете.</p><a class="tu-btn" href="/lk/#/login" data-login>Войти</a>'+playLink()+'</div>'; gate(); return; }
  if(!st){ body.innerHTML='<div class="tu-wait"><i></i>Открываю…</div>'; return; }
  if(!st.on){ body.innerHTML='<div class="tu-gate"><i class="tu-gav" data-mood="sleep" aria-hidden="true"></i><b>Наставник скоро появится</b><p>Пока его не подключили. Вопрос можно задать автору.</p><a class="tu-btn" href="#/ask">Спросить автора</a></div>'; gate(); return; }
  if(!st.consent&&!st.ru){ body.innerHTML=`<div class="tu-gate"><i class="tu-gav" data-mood="hello" aria-hidden="true"></i><b>Наставник работает на модели Claude</b><p>Это зарубежная модель (Anthropic, через ProxyAPI). Ей уходит только текст твоего вопроса, номер варианта и, если ты сам пришлёшь, фото листа. Имя, почта, группа и другие данные о тебе — не уходят. Фото не хранится.</p><button class="tu-btn" data-consent>Согласен, начать</button></div>`; gate(); return; }
  let h=''; if(!st.msgs.length) h+=g?`<div class="tu-hi"><b>Привет! Я Лука.</b><p>Спрашивай что угодно: определения, как строить, почему так, оформление по ГОСТ, вопросы к РК. Найду в курсе, объясню своими словами и открою нужную страницу. Выдели текст на странице — объясню его. А на странице своего варианта ДЗ покажу решение прямо на чертеже.</p>${playLink()}</div><div class="tu-sug">${sugGen().map(s=>'<button class="tu-chip" data-sug>'+esc(s)+'</button>').join('')}</div>`
    :`<div class="tu-hi"><b>Привет! Я Лука, твой наставник по ${esc(String(DZN[w.dz]||'ДЗ').replace(/^.* · /,''))}.</b><p>Спроси, где застрял, — открою нужный шаг на чертеже и обведу точки. Ткни в подпись точки на чертеже — расскажу про неё. Спрашивай и теорию — найду в курсе. В режиме «Наставник» сначала подсказываю, решение — когда попробуешь сам. Пришли фото листа 📷 — найду, где ошибка.</p>${playLink()}</div><div class="tu-sug">${(isNg(w)?SUG_NG:w.dz==='ig4'?SUG:SUG_IG).map(s=>'<button class="tu-chip" data-sug>'+esc(s)+'</button>').join('')}</div>`;
  const qr=i=>i===st.msgs.length-1&&!S.busy?'<div class="tu-qr" role="group" aria-label="Быстрые ответы">'+(g?QR_GEN:QR).map(q=>'<button class="tu-chip" data-sug>'+esc(q)+'</button>').join('')+'</div>':'';
  st.msgs.forEach((m,i)=>{ if(m.from==='u') h+=`<div class="tu-m u"><div class="tu-bb">${m.photo?'📷 ':''}${esc(m.text||'Фото листа')}</div></div>`;
    else { const acts=(m.actions||[]).map((a,j)=>a.t==='show'?`<button class="tu-chip" data-act="${i}:${j}">Шаг ${a.step} на чертеже${a.points&&a.points.length?' · точки '+a.points.join(', '):''} ↗</button>`:a.t==='3d'?`<button class="tu-chip" data-act="${i}:${j}">3D-модель ↗</button>`:a.t==='ask'?`<a class="tu-chip" href="#/ask/${esc(a.id)}">Вопрос автору ↗</a>`
        :a.t==='open'?`<button class="tu-open" data-act="${i}:${j}"><span>📖</span><span>${esc(a.title)}<small>${esc(a.why||a.where||'Открыть страницу курса')}</small></span></button>`:'').join('');
      h+=`<div class="tu-m t"><div class="tu-bb">${rich(m.text)}</div><div class="tu-x">${acts}${m.verified?'<span class="tu-ok" title="Все числа и номера сверены с точным решением и текстом курса">✓ сверено</span>':''}${m.id?`<button class="tu-r${m.rate===1?' on':''}" data-rate="${esc(m.id)}:1" aria-label="Полезно">👍</button><button class="tu-r${m.rate===0?' on':''}" data-rate="${esc(m.id)}:0" aria-label="Не помогло">👎</button>`:''}</div>${qr(i)}</div>`; } });
  if(S.busy) h+='<div class="tu-wait"><i></i>'+(S.photo||S.busyPhoto?'Смотрю на лист и сверяю с решением…':'Думаю и сверяю с решением…')+'</div>';
  if(S.err) h+='<div class="tu-err">'+esc(S.err)+'</div>';
  body.innerHTML=h; body.scrollTop=body.scrollHeight;
  pv.hidden=!S.photo; pv.innerHTML=S.photo?'<img alt="" src="'+S.photo+'"><span>Фото листа</span><button class="tu-ib" data-unphoto aria-label="Убрать фото">✕</button>':'';
  $('[data-send]',box).disabled=S.busy;
  if(hdrAv){ const want=S.busyPhoto?'study':'think'; if(S.busy){ if(hdrAv.state!==want) hdrAv.play(want); } else if(hdrAv.state==='think'||hdrAv.state==='study') hdrAv.idle(); }
  renderPeek(); }
/* быстрые ответы — без клавиатуры: лесенка подсказок идёт одними тапами */
const QR=['Понял, что дальше?','Ещё намёк','Почему так?','Покажи на чертеже','Проверь меня'];
const QR_GEN=['Объясни проще','Приведи пример','Проверь меня','Где это в ДЗ?','Ещё вопрос по теме'];
/* подсказки по странице: на главной — частые вопросы; на теме или теории — «про эту тему»; на задаче — «как начать» */
function sugGen(){ const h=location.hash||'';
  if(!h||h==='#'||h==='#/') return ['Что такое эпюр Монжа?','Как найти натуральную величину отрезка?','Как оформить основную надпись?','Как готовиться к РК?'];
  if(/^#\/(topic|ng\/path|ng\/cheat|ng\/learn|ig\/theory|ig\/learn|theory)/.test(h)) return ['Объясни эту тему проще','Приведи пример','Проверь меня по этой теме','Где это нужно в ДЗ?'];
  if(/task|quiz|check|ticket|rk/.test(h)) return ['С чего начать эту задачу?','Какое правило тут работает?','Типичные ошибки?','Проверь меня'];
  return ['Что такое конкурирующие точки?','Как построить линию пересечения плоскостей?','Разрез или сечение — в чём разница?','Как готовиться к РК?']; }
const playLink=()=>/^\/new\//.test(location.pathname)?'<a class="tu-play" href="'+location.pathname.replace(/\/new\/.*$/,'/new/')+'luka/">Перемена? Поиграй со мной →</a>':'';
/* полоска шторки (телефон): последняя реплика Луки и быстрые ответы */
function renderPeek(){ const pk=$('[data-pk]',box), st=S.st; if(!pk) return; let h='';
  if(S.busy) h='<div class="tu-pkt w" data-up><i></i>Лука думает и сверяет с решением…</div>';
  else { const m=st&&st.msgs&&[...st.msgs].reverse().find(x=>x.from==='t');
    h='<div class="tu-pkt" data-up>'+esc(m?String(m.text).replace(/\*\*/g,'').replace(/\s+/g,' '):isGen(S.w)?'Спроси Луку о чём угодно по курсу':'Спроси Луку про свой вариант')+'</div>';
    if(m&&st.ready) h+='<div class="tu-qr">'+(isGen(S.w)?QR_GEN:QR).map(q=>'<button class="tu-chip" data-sug>'+esc(q)+'</button>').join('')+'</div>'; }
  pk.innerHTML=h; if(S.snap==='peek'&&isPhone()) snap('peek',true); }
/* большая аватарка на экранах входа и согласия */
function gate(){ const g=body.querySelector('.tu-gav'); const m=av(g); if(m) m.play(g.dataset.mood||'hello'); }

async function load(){ const w=cur(); S.w=w; S.pin=false; S.st=null; S.err=''; render(); if(!tok()) return;
  try{ const st=await req('GET','/api/tutor/state?dz='+w.dz+(isGen(w)?'':'&n='+w.n)); st.ready=st.on&&(st.consent||st.ru); if(same(S.w,w)){ S.st=st; S.cache[wkey(w)]=st; } }
  catch(e){ if(same(S.w,w)) S.st={on:true,consent:true,ready:true,msgs:[],mode:'coach'}; S.err=e.message; }
  render(); }
function open(sn){ const was=S.open; S.open=true; box.hidden=false; fab.hidden=true; const u=fab.querySelector('u'); if(u) u.remove(); fabNote('');
  if(isPhone()) snap(typeof sn==='string'?sn:(was&&S.snap!=='peek'?S.snap:'half'),!was);
  say(S.greeted?'giggle':'hello'); S.greeted=true;
  if(!S.st||!S.w||(!S.pin&&!same(S.w,cur()))) load(); else render(); setTimeout(()=>{ if(innerWidth>=760) inp.focus(); },50); }
function close(peek){ S.open=false; S.pin=false; box.hidden=true; box.style.removeProperty('--tu-h'); fab.hidden=false; speakStop(); if(peek&&!fab.querySelector('u')) fab.insertAdjacentHTML('beforeend','<u></u>'); if(peek&&fabAv) fabAv.play('hello'); }
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
  S.busy=true; S.busyPhoto=!!photo; S.err=''; S.st.msgs.push({from:'u',text,photo:!!photo}); inp.value=''; S.photo=null; render();
  try{ let ref=''; if(photo){ try{ ref=await reference(w.n,w.dz); }catch(e){ ref=''; } }
    const r=await req('POST','/api/tutor/chat',{dz:w.dz,n:g?undefined:w.n,text,step,mode:S.st.mode,photo:photo||undefined,ref:ref||undefined,page:pageCtx(),sel:sel||undefined});
    dayMark();
    S.st.msgs.push({from:'t',text:r.reply,actions:r.actions||[],id:r.id,verified:r.verified,rate:null}); S.st.mode=r.mode||S.st.mode;
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
inp.addEventListener('input',()=>{ inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,innerHeight*.3)+'px'; });
$('[data-file]',box).addEventListener('change',async e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return;
  try{ S.photo=await shrink(f); S.err=''; }catch(er){ S.err=er.message; } render(); });
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
function voiceBtn(){ const b=$('[data-voice]',box); b.textContent=S.voice?'🔊':'🔈'; b.classList.toggle('on',!!S.voice); b.setAttribute('aria-pressed',String(!!S.voice)); b.hidden=!self.speechSynthesis; }
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
function streakShow(){ const el=$('[data-streak]',box), n=streak(); el.hidden=n<2; el.textContent='🔥 '+n; el.title=n+' '+(n%10===1&&n%100!==11?'день':n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'дня':'дней')+' подряд с Лукой'; }
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
