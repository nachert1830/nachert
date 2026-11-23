/* ═══ Наставник — ИИ-агент на чертеже (docs/TUTOR.md) ═══
   Окно на странице варианта ДЗ: ИГ №3, №4, №5, №6 (#/ig4/<n>; прежний адрес #/ig/dz/4/<n> переадресуется) и начерт №1–5 (#/ng2/<n>, #/ng3/<n>/b…).
   Разговор с наставником; его ответы управляют чертежом — открывают нужный шаг плеера решения и подсвечивают точки
   (ИГ — IG4S.player; начерт — плеер разбора сайта PLR: подзадача и шаг по id «p2s3», подписи точек на чертеже).
   Фото листа (📷) уходит вместе с эталоном: ИГ — вид решения со всеми номерами точек (IG4S.svg), начерт — черновик листа
   (SHEET.ng, построения в цвете) → JPEG; глаза наставника сравнивают их.
   Сервер — API кабинета (window.CLUB_API): /api/tutor/*, сессия lk_tok. Без адреса API окно не показывается.
   Для тестов: window.TUTOR — {open(), close(), send(text), act(action), state()}. */
(function(){
'use strict';
const API=String(self.CLUB_API||'').replace(/\/$/,'');
if(!API&&!self.TUTOR_FORCE) return;
const $=(s,r)=>(r||document).querySelector(s);
const LS={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ v==null?localStorage.removeItem(k):localStorage.setItem(k,v); }catch(e){} } };
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tok=()=>LS.get('lk_tok')||'';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms){ const t=Date.now(); for(;;){ let v=null; try{ v=f(); }catch(e){} if(v) return v; if(Date.now()-t>ms) return null; await sleep(120); } }

/* ── где мы: вариант ДЗ ── */
const DZN={ig3:'ИГ · ДЗ №3',ig5:'ИГ · ДЗ №5',ig6:'ИГ · ДЗ №6',ig4:'ИГ · ДЗ №4',ng1:'Начерт · ДЗ №1',ng2:'Начерт · ДЗ №2',ng3:'Начерт · ДЗ №3',ng4:'Начерт · ДЗ №4',ng5:'Начерт · ДЗ №5'};
function here(){ const h=location.hash||'';
  let m=/^#\/(?:ig4|ig\/dz\/4)\/(\d{1,2})(?:[/?]|$)/.exec(h); if(m) return {dz:'ig4',n:+m[1]};
  m=/^#\/(ng[1-5]|ig[356])\/(\d{1,2})(?:[/?]|$)/.exec(h); if(m&&+m[2]>=1&&+m[2]<=30) return {dz:m[1],n:+m[2]};
  return null; }
const isNg=w=>!!w&&/^ng/.test(w.dz);
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
  box.querySelectorAll('.tu-say,.tu-note').forEach(e=>e.remove()); if(getComputedStyle(box).position==='static') box.style.position='relative';
  const B=box.getBoundingClientRect();
  if(a.say){ const d=document.createElement('div'); d.className='tu-say'; d.innerHTML='<i>Н</i><span>'+esc(a.say)+'</span><button type="button" aria-label="Убрать">✕</button>'; box.appendChild(d); }
  const used=[];
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
document.addEventListener('click',e=>{ const b=e.target.closest('.tu-say button'); if(b) b.parentNode.remove(); });

/* ── 3D: начерт — пространственная картина шага (TASK3D), ИГ — вкладка 3D-модели детали ── */
async function open3d(w,a){
  if(isNg(w)){ if(!window.TASK3D||!window.DZR) return; const m=/^p(\d+)s(\d+)$/.exec(a.id||''); let pi=0, k=a.step||0;
    if(m){ pi=+m[1]-1; k=+m[2]; } try{ TASK3D.open(DZR.solve(w.dz,w.n).task,pi,k); }catch(e){} return; }
  const show=$('#igShow'); if(show&&show.offsetParent!==null) show.click();
  const tab=await until(()=>$('.igx-tabs button[data-t="3d"]'),6000); if(tab){ tab.click(); setTimeout(()=>{ const t=$('.igx-tabs'); t&&t.scrollIntoView({behavior:'smooth',block:'start'}); },60); } }

async function act(a){ const w=here(); if(!a||!w) return;
  if(a.t==='3d'){ await open3d(w,a); if(innerWidth<760) close(true); return; }
  if(a.t==='show'&&isNg(w)){ const P=await ngPlayer(w); if(!P) return; const m=/^p(\d+)s(\d+)$/.exec(a.id||'');
    if(m){ P.state.pi=+m[1]-1; P.go(+m[2]); } else P.go(a.step);
    await sleep(80); if(a.points&&a.points.length) ngHighlight(a.points); onDrawing(w,a);
    if(innerWidth<760) close(true); return; }
  if(a.t==='show'){ const P=await player(w.n,w.dz); if(!P) return; P.go(a.step);
    await until(()=>{ const p=$('#igbPic'); return p&&p.querySelector('svg')&&!p.classList.contains('igx-ldh'); },8000); await sleep(60);
    if(a.points&&a.points.length) P.highlight(a.points); onDrawing(w,a);
    if(innerWidth<760) close(true); }
  if(a.t==='ask') location.hash='#/ask/'+encodeURIComponent(a.id); }

/* ── стили (токены сайта, светлая и тёмная тема) ── */
const css=document.createElement('style');
css.textContent=`
.tu-fab{position:fixed;right:18px;bottom:calc(var(--tabh,64px) + 16px + env(safe-area-inset-bottom));z-index:330;display:inline-flex;align-items:center;gap:9px;height:52px;padding:0 18px 0 8px;border:0;border-radius:99px;background:var(--ink,#15161a);color:var(--paper,#fff);font:800 15px var(--sans,system-ui);cursor:pointer;box-shadow:0 16px 34px -14px rgba(8,11,18,.7);transition:transform .2s}
.tu-fab:hover{transform:translateY(-2px)}
.tu-fab i{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(150deg,#1f47d6,#e8392b);color:#fff;font:800 16px var(--sans,system-ui);font-style:normal}
.tu-fab u{position:absolute;top:2px;right:4px;width:12px;height:12px;border-radius:50%;background:var(--red,#e8392b);box-shadow:0 0 0 2px var(--paper,#fff)}
@media (min-width:900px){.tu-fab{bottom:24px}}
.tu{position:fixed;z-index:340;display:flex;flex-direction:column;background:var(--paper,#fff);color:var(--ink,#15161a);font:15.5px/1.5 var(--sans,system-ui);box-shadow:0 24px 60px -20px rgba(8,11,18,.55);border:1px solid var(--line,#e3e6ec)}
@media (min-width:760px){.tu{right:16px;bottom:16px;width:410px;height:min(720px,calc(100vh - 32px));border-radius:24px}}
@media (max-width:759px){.tu{left:0;right:0;bottom:0;height:min(86vh,calc(100vh - 40px));border-radius:22px 22px 0 0;padding-bottom:env(safe-area-inset-bottom)}}
.tu[hidden],.tu-fab[hidden]{display:none}
svg .tu-hl{fill:#e5484d!important;font-weight:800!important;paint-order:stroke;stroke:rgba(229,72,77,.25);stroke-width:6px}
.tu-say{position:absolute;left:10px;right:10px;top:10px;z-index:6;display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:14px;background:var(--ink,#15161a);color:var(--paper,#fff);font:600 14px/1.35 var(--sans,system-ui);box-shadow:0 10px 26px -12px rgba(8,11,18,.6);pointer-events:auto}
.tu-say i{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#2f6bff,#e5484d);font:800 12px var(--sans,system-ui);font-style:normal}
.tu-say span{flex:1}.tu-say button{flex:none;border:0;background:none;color:inherit;opacity:.7;font:700 14px var(--sans,system-ui);cursor:pointer;padding:0 2px}
.tu-note{position:absolute;z-index:6;max-width:220px;padding:5px 9px;border-radius:10px;background:#fff;color:#15161a;border:1.5px solid #e5484d;font:600 12.5px/1.3 var(--sans,system-ui);box-shadow:0 6px 16px -8px rgba(8,11,18,.45);pointer-events:none}
.tu-note b{color:#e5484d}
body:has(.ckn) .tu-fab{display:none}
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
const S={open:false,busy:false,w:null,st:null,photo:null,err:''};
const fab=document.createElement('button'); fab.className='tu-fab'; fab.type='button'; fab.hidden=true; fab.innerHTML='<i>Н</i>Наставник'; fab.setAttribute('aria-label','Открыть наставника');
const box=document.createElement('section'); box.className='tu'; box.hidden=true; box.setAttribute('role','dialog'); box.setAttribute('aria-label','Наставник');
box.innerHTML=`<div class="tu-h"><div><b>Наставник</b><small data-sub></small></div><span class="sp"></span><button class="tu-ib" data-menu title="Начать заново" aria-label="Начать заново">↺</button><button class="tu-ib" data-close aria-label="Закрыть">✕</button></div>
<div class="tu-mode" role="tablist" aria-label="Режим"><button data-mode="coach" role="tab" title="Подсказки по шагам: сначала наводка, потом идея, потом решение">Наставник</button><button data-mode="explain" role="tab" title="Объясняет решение полностью — если уже пробовал сам или готовишься к защите">Разбор</button></div>
<div class="tu-b" data-body aria-live="polite"></div>
<div class="tu-f" data-foot><div class="tu-pv" data-pv hidden></div><div class="tu-row"><label class="tu-att" title="Фото листа — наставник сравнит с решением">📷<input type="file" accept="image/*" data-file></label><textarea rows="1" data-in placeholder="Спроси про свой вариант…" aria-label="Вопрос наставнику"></textarea><button class="tu-send" data-send aria-label="Отправить">↑</button></div>
<div class="tu-foot">Наставник проверяет каждое число по точному решению. Фото не хранится.</div></div>`;
let mounted=false; const mount=()=>{ if(mounted) return; mounted=true; document.body.appendChild(fab); document.body.appendChild(box); route(); };
const body=$('[data-body]',box), inp=$('[data-in]',box), pv=$('[data-pv]',box);

/* текст ответа: переносы, **жирный**, «шаг N» — ссылка, открывающая шаг на чертеже */
function rich(s){ return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^\p{L}])(шаг[\p{L}]*\s+(\d{1,2}))/giu,(m,a,t,k)=>a+'<a class="tu-st" data-step="'+k+'">'+t+'</a>').replace(/\n/g,'<br>'); }
const SUG=['С чего начать?','Не понимаю текущий шаг','Как найти точку на грани ⟂ π₃?','Готовлюсь к защите — спроси меня'];
const SUG_IG=['С чего начать?','Не понимаю текущий шаг','Как перенести точку на вид слева?','Готовлюсь к защите — спроси меня'];
const SUG_NG=['С чего начать?','Не понимаю текущий шаг','Какое правило здесь работает?','Готовлюсь к защите — спроси меня'];
function render(){ const w=S.w, st=S.st; $('[data-sub]',box).textContent=w?(DZN[w.dz]||'')+' · вариант '+w.n:'';
  box.querySelectorAll('[data-mode]').forEach(b=>{ const on=st&&st.mode===b.dataset.mode; b.classList.toggle('on',!!on); b.setAttribute('aria-selected',String(!!on)); });
  $('[data-foot]',box).hidden=!(st&&st.ready); $('.tu-mode',box).hidden=!(st&&st.ready);
  if(!tok()){ body.innerHTML='<div class="tu-gate"><b>Войди, и начнём</b><p>Наставник помнит, где ты застрял, и ведёт по шагам твоего варианта. Вход — тот же, что в личном кабинете.</p><a class="tu-btn" href="/lk/#/login" data-login>Войти</a></div>'; return; }
  if(!st){ body.innerHTML='<div class="tu-wait"><i></i>Открываю…</div>'; return; }
  if(!st.on){ body.innerHTML='<div class="tu-gate"><b>Наставник скоро появится</b><p>Пока его не подключили. Вопрос можно задать автору.</p><a class="tu-btn" href="#/ask">Спросить автора</a></div>'; return; }
  if(!st.consent&&!st.ru){ body.innerHTML=`<div class="tu-gate"><b>Наставник работает на модели Claude</b><p>Это зарубежная модель (Anthropic, через ProxyAPI). Ей уходит только текст твоего вопроса, номер варианта и, если ты сам пришлёшь, фото листа. Имя, почта, группа и другие данные о тебе — не уходят. Фото не хранится.</p><button class="tu-btn" data-consent>Согласен, начать</button></div>`; return; }
  let h=''; if(!st.msgs.length) h+=`<div class="tu-hi"><b>Привет! Я твой наставник по ${esc(String(DZN[w.dz]||'ДЗ').replace(/^.* · /,''))}.</b><p>Спроси, где застрял, — открою нужный шаг на чертеже и подсвечу точки. В режиме «Наставник» сначала подсказываю, решение — когда попробуешь сам. Пришли фото листа 📷 — найду, где ошибка.</p></div><div class="tu-sug">${(isNg(w)?SUG_NG:w.dz==='ig4'?SUG:SUG_IG).map(s=>'<button class="tu-chip" data-sug>'+esc(s)+'</button>').join('')}</div>`;
  st.msgs.forEach((m,i)=>{ if(m.from==='u') h+=`<div class="tu-m u"><div class="tu-bb">${m.photo?'📷 ':''}${esc(m.text||'Фото листа')}</div></div>`;
    else { const acts=(m.actions||[]).map((a,j)=>a.t==='show'?`<button class="tu-chip" data-act="${i}:${j}">Шаг ${a.step} на чертеже${a.points&&a.points.length?' · точки '+a.points.join(', '):''} ↗</button>`:a.t==='3d'?`<button class="tu-chip" data-act="${i}:${j}">3D-модель ↗</button>`:a.t==='ask'?`<a class="tu-chip" href="#/ask/${esc(a.id)}">Вопрос автору ↗</a>`:'').join('');
      h+=`<div class="tu-m t"><div class="tu-bb">${rich(m.text)}</div><div class="tu-x">${acts}${m.verified?'<span class="tu-ok" title="Все числа и номера сверены с точным решением">✓ сверено</span>':''}${m.id?`<button class="tu-r${m.rate===1?' on':''}" data-rate="${esc(m.id)}:1" aria-label="Полезно">👍</button><button class="tu-r${m.rate===0?' on':''}" data-rate="${esc(m.id)}:0" aria-label="Не помогло">👎</button>`:''}</div></div>`; } });
  if(S.busy) h+='<div class="tu-wait"><i></i>'+(S.photo||S.busyPhoto?'Смотрю на лист и сверяю с решением…':'Думаю и сверяю с решением…')+'</div>';
  if(S.err) h+='<div class="tu-err">'+esc(S.err)+'</div>';
  body.innerHTML=h; body.scrollTop=body.scrollHeight;
  pv.hidden=!S.photo; pv.innerHTML=S.photo?'<img alt="" src="'+S.photo+'"><span>Фото листа</span><button class="tu-ib" data-unphoto aria-label="Убрать фото">✕</button>':'';
  $('[data-send]',box).disabled=S.busy; }

async function load(){ const w=here(); if(!w) return; S.w=w; S.st=null; S.err=''; render(); if(!tok()) return;
  try{ const st=await req('GET','/api/tutor/state?dz='+w.dz+'&n='+w.n); st.ready=st.on&&(st.consent||st.ru); S.st=st; }
  catch(e){ S.st={on:true,consent:true,ready:true,msgs:[],mode:'coach'}; S.err=e.message; }
  render(); }
function open(){ if(!here()) return; S.open=true; box.hidden=false; fab.hidden=true; const u=fab.querySelector('u'); if(u) u.remove();
  if(!S.st||!S.w||S.w.n!==here().n||S.w.dz!==here().dz) load(); else render(); setTimeout(()=>{ if(innerWidth>=760) inp.focus(); },50); }
function close(peek){ S.open=false; box.hidden=true; fab.hidden=!here(); if(peek&&!fab.querySelector('u')) fab.insertAdjacentHTML('beforeend','<u></u>'); }
function route(){ const w=here(); if(!w){ box.hidden=true; fab.hidden=true; S.open=false; return; } fab.hidden=S.open; if(S.w&&(S.w.n!==w.n||S.w.dz!==w.dz)){ S.st=null; S.w=w; if(S.open) load(); } }
addEventListener('hashchange',route);
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();

async function send(text){ const w=here(); if(!w||S.busy||!S.st||!S.st.ready) return; text=String(text==null?inp.value:text).trim(); if(!text&&!S.photo) return;
  const P=igP(w.dz), step=isNg(w)?ngStep(w):P&&P.model&&(w.dz==='ig4'?+P.model.n===w.n:P.model===igModel(w.dz,w.n))?P.current():null, photo=S.photo;
  S.busy=true; S.busyPhoto=!!photo; S.err=''; S.st.msgs.push({from:'u',text,photo:!!photo}); inp.value=''; S.photo=null; render();
  try{ let ref=''; if(photo){ try{ ref=await reference(w.n,w.dz); }catch(e){ ref=''; } }
    const r=await req('POST','/api/tutor/chat',{dz:w.dz,n:w.n,text,step,mode:S.st.mode,photo:photo||undefined,ref:ref||undefined});
    S.st.msgs.push({from:'t',text:r.reply,actions:r.actions||[],id:r.id,verified:r.verified,rate:null}); S.st.mode=r.mode||S.st.mode;
    S.busy=false; render(); for(const a of r.actions||[]) await act(a); }
  catch(e){ S.busy=false; S.err=e.message; if(e.data&&e.data.needAiConsent){ S.st.consent=false; S.st.ready=false; }
    if(photo&&!S.photo) S.photo=photo; render(); } }

/* ── события ── */
fab.addEventListener('click',open);
box.addEventListener('click',async e=>{ const t=e.target.closest('button,a'); if(!t) return;
  if(t.matches('[data-close]')) return close();
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
  if(t.matches('[data-rate]')){ const [id,g]=[t.dataset.rate.slice(0,-2),t.dataset.rate.slice(-1)], m=S.st.msgs.find(x=>x.id===id); if(m) m.rate=+g; render();
    try{ await req('POST','/api/tutor/rate',{id,good:g==='1'}); }catch(er){} } });
inp.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){ e.preventDefault(); send(); } });
inp.addEventListener('input',()=>{ inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,innerHeight*.3)+'px'; });
$('[data-file]',box).addEventListener('change',async e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return;
  try{ S.photo=await shrink(f); S.err=''; }catch(er){ S.err=er.message; } render(); });
addEventListener('keydown',e=>{ if(e.key==='Escape'&&S.open) close(); });

self.TUTOR={open,close,send,act,reference,state:()=>({open:S.open,busy:S.busy,w:S.w,st:S.st,err:S.err})};
})();
