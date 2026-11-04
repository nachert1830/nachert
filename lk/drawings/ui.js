/* ═══════════ Кабинет: «Скан» → «Мои чертежи» → доводка → 3D ═══════════
   Вкладка «Скан» (центральная кнопка) — сканер листа: фото → lk/scan/pipeline.js (облачная функция, код доступа) →
   лист с чертежами (lk/drawings/model.js) → сохраняется в «Моих чертежах» (localStorage; фото — IndexedDB) →
   экран чертежа: «Копия» (правка: подписи, точки, отрезки, начало O, фото под копией), «Доводка» (что поправить,
   исправления в одно касание, привязка к варианту), «3D» (тело в углу Монжа, разворот в эпюр, эталон варианта, OBJ).
   Ничего не уходит на сервер, кроме кадров для оцифровки. */
(function(){
'use strict';
const D=self.DRAWINGS, $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f1=x=>isFinite(x)?(Math.round(x*10)/10).toString().replace('.',','):'—';
const ls={get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } },set:(k,v)=>{ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } }};
const KEY='lk_sheets';
const ICON={
  cam:'<svg class="i" viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 016.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0120 8.5v8a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 16.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>',
  back:'<svg class="i" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  more:'<svg class="i" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/></svg>',
  hand:'<svg class="i" viewBox="0 0 24 24"><path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-1.5v-6a1.5 1.5 0 013 0v6m0-.5V5.5a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-.5a6 6 0 01-4.6-2.2L4.3 14.6a1.5 1.5 0 012.2-2L8 14"/></svg>',
  pt:'<svg class="i" viewBox="0 0 24 24"><circle cx="9" cy="12" r="2.5" fill="currentColor"/><path d="M17 8v8M13 12h8"/></svg>',
  seg:'<svg class="i" viewBox="0 0 24 24"><path d="M4 18L15 7"/><circle cx="4" cy="18" r="1.8" fill="currentColor"/><circle cx="15" cy="7" r="1.8" fill="currentColor"/><path d="M19 3v6M16 6h6"/></svg>',
  o:'<svg class="i" viewBox="0 0 24 24"><path d="M2 12h20"/><circle cx="16" cy="12" r="3"/></svg>',
  undo:'<svg class="i" viewBox="0 0 24 24"><path d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3"/></svg>',
  ok:'<svg class="i" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  warn:'<svg class="i" viewBox="0 0 24 24"><path d="M12 4l9 16H3zM12 10v4M12 17.5v.5"/></svg>',
  cube:'<svg class="i" viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>'
};

/* ───── хранилище: листы — localStorage, фото — IndexedDB ───── */
let SHEETS=[]; try{ SHEETS=JSON.parse(ls.get(KEY)||'[]'); if(!Array.isArray(SHEETS)) SHEETS=[]; }catch(e){ SHEETS=[]; }
let saveT=0; function save(now){ clearTimeout(saveT); const go=()=>{ if(!ls.set(KEY,JSON.stringify(SHEETS))) toast('Память браузера заполнена — удалите старые листы'); }; if(now) go(); else saveT=setTimeout(go,250); }
const IDB={ db:null, open(){ if(this.db) return this.db; this.db=new Promise((res,rej)=>{ try{ const r=indexedDB.open('lk_scan',1); r.onupgradeneeded=()=>r.result.createObjectStore('photo'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }catch(e){ rej(e); } }); return this.db; },
  async put(k,v){ try{ const db=await this.open(); await new Promise((res,rej)=>{ const t=db.transaction('photo','readwrite'); t.objectStore('photo').put(v,k); t.oncomplete=res; t.onerror=()=>rej(t.error); }); }catch(e){} },
  async get(k){ try{ const db=await this.open(); return await new Promise(res=>{ const q=db.transaction('photo').objectStore('photo').get(k); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null); }); }catch(e){ return null; } },
  async del(k){ try{ const db=await this.open(); db.transaction('photo','readwrite').objectStore('photo').delete(k); }catch(e){} } };

/* эталон и привязка: core/dz.js, core/dz-variants.js, lab/dz/model.js (часть модулей сканера) */
let LIBP=null; function lib(){ if(self.CORE&&self.CORE.dzVariants&&self.LAB&&self.LAB.dzModel) return Promise.resolve(LIBO());
  if(!LIBP) LIBP=['/core/dz.js','/core/dz-variants.js','/lab/dz/model.js'].reduce((p,src)=>p.then(()=>self.CORE&&src.includes('dz-variants')&&self.CORE.dzVariants?0:new Promise(res=>{ const s=document.createElement('script'); s.src=src+'?v=lk1'; s.onload=res; s.onerror=res; document.head.appendChild(s); })),Promise.resolve()).then(LIBO);
  return LIBP; }
const LIBO=()=>self.CORE&&self.CORE.dzVariants?{variants:self.CORE.dzVariants,dz:self.CORE.dz,model:self.LAB&&self.LAB.dzModel}:null;
let LIB=null;

/* ───── тост (общий элемент кабинета) ───── */
let tt; function toast(t){ const el=$('#toast'); if(!el) return; el.textContent=t; el.classList.add('on'); clearTimeout(tt); tt=setTimeout(()=>el.classList.remove('on'),2200); }

/* ═════ Вкладка «Скан» ═════ */
const root=$('#v-check'); if(!root) return;
root.innerHTML=`
  <div class="card scan-hero">
    <svg class="art" viewBox="0 0 150 150" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 34V22a6 6 0 016-6h12M114 16h12a6 6 0 016 6v12M132 116v12a6 6 0 01-6 6h-12M36 134H24a6 6 0 01-6-6v-12" stroke="#fff" stroke-width="5"/>
      <path d="M34 75h82" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-dasharray="6 4"/>
      <path d="M48 62l28-28 26 20zM48 92l28 26 26-30z" stroke="#fff" stroke-width="3"/><path d="M48 62v30M76 34v84M102 54v34" stroke="#9cc1ff" stroke-width="1.5" stroke-dasharray="3 3"/></g></svg>
    <h2>Сканер чертежей</h2>
    <p>Фото листа с эпюром → цифровая копия в мм → доводка → 3D.</p>
    <div class="sh-btns">
      <label class="btn white" for="scCam">${ICON.cam}Сканировать</label>
      <label class="btn ghost" for="scPick">Из галереи</label>
    </div>
    <input type="file" id="scCam" accept="image/*" capture="environment" hidden>
    <input type="file" id="scPick" accept="image/*" hidden>
    <button class="lnk" id="scDemo" type="button">Попробовать на примере — без камеры</button>
  </div>
  <div class="card" id="scProg" hidden><b id="scProgT" style="font:600 17px var(--disp)">Сканирую лист…</b><ul class="sc-steps" id="scSteps"></ul><div id="scProgA" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"></div></div>
  <details class="card sc-set" id="scSet"><summary>Настройки сканера</summary>
    <div class="fl">
      <label>Задание<select class="sc-in" id="scDz"><option value="auto">Узнать само</option><option value="2">ДЗ №2</option><option value="3">ДЗ №3</option></select></label>
      <label>Вариант<input class="sc-in" id="scVar" inputmode="numeric" placeholder="авто" autocomplete="off"></label>
      <label style="grid-column:1/-1">Точность<select class="sc-in" id="scPrec"><option value="max">Максимальная: Opus + Sonnet, две независимые оцифровки</option><option value="auto">Экономная: вторая модель — только при сомнениях</option><option value="fast">Быстро: одна модель</option></select></label>
      <label style="grid-column:1/-1">Код доступа к сканеру<input class="sc-in" id="scCode" type="password" autocomplete="off" placeholder="выдаёт преподаватель или автор сайта"></label>
    </div>
    <p class="note" style="margin:10px 0 0">Кадры чертежей отправляются модели Claude (через ProxyAPI) только для оцифровки и не сохраняются. Копии и фото хранятся в этом браузере.</p>
  </details>
  <div class="wk" id="myHead">Мои чертежи</div>
  <div class="mylist" id="myList"></div>
  <div class="card how"><h2 style="margin:0">Как это работает</h2><ol>
    <li><span><b>Сфотографируйте лист</b> сверху, целиком и ровно, при хорошем свете. Можно несколько чертежей на листе.</span></li>
    <li><span><b>Сканер оцифрует</b> каждый чертёж: точки с подписями, линии, дуги — в миллиметрах, и сам узнает вариант ДЗ.</span></li>
    <li><span><b>Доведите копию</b>: «Доводка» покажет разрывы линий связи, точки без пары, сомнительные линии — и исправит в одно касание.</span></li>
    <li><span><b>Посмотрите в 3D</b>: по двум проекциям восстанавливается тело. Покрутите его и разверните обратно в эпюр.</span></li>
  </ol></div>`;

const CLOUD=String(self.SCAN_API||'').trim();
let CODE=ls.get('scanCode')||'';
$('#scCode').value=CODE; $('#scCode').addEventListener('change',()=>{ CODE=$('#scCode').value.trim(); ls.set('scanCode',CODE); });
$('#scVar').value=ls.get('lk_scanVar')||''; $('#scVar').addEventListener('change',()=>ls.set('lk_scanVar',$('#scVar').value.trim()));
$('#scPrec').value=ls.get('lk_scanPrec')||'max';   /* замер lab/dz/REPORT.md 7о: две модели — точки на 20 % точнее */ $('#scPrec').addEventListener('change',()=>ls.set('lk_scanPrec',$('#scPrec').value));
$('#scDz').value=ls.get('lk_scanDz')||'auto'; $('#scDz').addEventListener('change',()=>ls.set('lk_scanDz',$('#scDz').value));

const steps=new Map();
function step(id,text,state){ let li=steps.get(id); if(!li){ li=document.createElement('li'); steps.set(id,li); $('#scSteps').appendChild(li); } li.textContent=text; li.className=state||'run'; }
function progStart(t){ steps.clear(); $('#scSteps').innerHTML=''; $('#scProgA').innerHTML=''; $('#scProgT').textContent=t; $('#scProg').hidden=false; $('#scProg').scrollIntoView({block:'nearest',behavior:'smooth'}); }
let busy=false;
async function scan(file){ if(!file||busy) return;
  if(!CLOUD){ progStart('Сканер сейчас недоступен'); step('x','Адрес сервера сканера не задан. Попробуйте пример — он работает без сервера.','err'); return; }
  if(!CODE){ $('#scSet').open=true; $('#scCode').focus(); progStart('Нужен код доступа'); step('x','Введите код доступа в «Настройках сканера» и выберите фото ещё раз.','err'); return; }
  busy=true; progStart('Сканирую лист…');
  try{ step('lib','Загружаю сканер…'); await self.SCANPIPE.load('lk4'); step('lib','Сканер загружен','done');
    const pipe=self.SCANPIPE.create({cloud:CLOUD,code:CODE});
    const {out,bmp}=await pipe.run(file,{dz:$('#scDz').value,variant:$('#scVar').value,precision:$('#scPrec').value},step);
    const ok=out.drawings.filter(d=>d&&d.segs&&d.segs.length);
    if(!ok.length){ $('#scProgT').textContent='Чертежи не распознались'; step('x','Ни один чертёж не оцифрован. Снимите ближе и ровнее, без тени.','err'); return; }
    const photo=thumb(bmp,1600), sh=D.fromScan(out,{name:sheetName(out)}); sh.photoK=photo.k;
    await IDB.put(sh.id,photo.url); sh.thumb=thumb(bmp,160).url;
    SHEETS.unshift(sh); save(true); renderList();
    $('#scProgT').textContent='Готово: '+sh.drawings.length+' '+plural(sh.drawings.length,'чертёж','чертежа','чертежей');
    $('#scProgA').innerHTML='<button class="btn sm" id="scOpen">Открыть копию</button>'; $('#scOpen').onclick=()=>openSheet(sh.id);
    openSheet(sh.id); }
  catch(e){ $('#scProgT').textContent='Не получилось'; step('x',/401|Неверный код/.test(e.message)?'Неверный код доступа. Проверьте его в «Настройках сканера».':'Сбой: '+e.message,'err'); }
  finally{ busy=false; } }
function sheetName(out){ const d=new Date(), f=(out.drawings||[]).find(x=>x&&x.fit&&x.fit.rmsMm!=null); return (f&&f.fit?'ДЗ №'+f.fit.dz+', вариант '+f.fit.n:'Лист')+' · '+d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0'); }
function thumb(bmp,side){ const k=Math.min(1,side/Math.max(bmp.width,bmp.height)), c=document.createElement('canvas'); c.width=Math.round(bmp.width*k); c.height=Math.round(bmp.height*k); c.getContext('2d').drawImage(bmp,0,0,c.width,c.height); return {url:c.toDataURL('image/jpeg',0.78),k}; }
const plural=(n,a,b,c)=>{ const m=n%10, h=n%100; return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c; };
['#scCam','#scPick'].forEach(s=>$(s).addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; scan(f); }));
/* «Сканировать» — живой сканер (lk/scan/live.js): видео, контур листа, автоснимок в полном разрешении, ровный лист.
   Камеры в браузере нет (или отказ) — системная камера, как раньше */
function camera(){ if(self.LIVESCAN&&self.LIVESCAN.supported()&&!busy){ self.LIVESCAN.open({onShot:f=>scan(f)}); return; } $('#scCam').click(); }
$('label[for="scCam"]').addEventListener('click',e=>{ if(self.LIVESCAN&&self.LIVESCAN.supported()){ e.preventDefault(); camera(); } });
$('#scDemo').addEventListener('click',()=>{ const sh=D.fromScan(self.DRAWINGS_DEMO.make(),{name:'Пример · ДЗ №3, вариант 21'}); sh.demo=true; SHEETS.unshift(sh); save(true); renderList(); openSheet(sh.id); });

function sheetState(sh){ const r=sh.drawings.map(dr=>D.ready(dr)), k=sh.drawings.reduce((a,dr)=>a+D.issues(dr,LIB).filter(i=>i.lvl!=='info').length,0); return {ready:r.filter(Boolean).length,k}; }
function renderList(){ const box=$('#myList'); $('#myHead').textContent='Мои чертежи'+(SHEETS.length?' · '+SHEETS.length:'');
  if(!SHEETS.length){ box.innerHTML='<div class="card empty">Пока пусто. Отсканируйте лист — копия появится здесь.</div>'; return; }
  box.innerHTML=SHEETS.map(sh=>{ const st=sheetState(sh), d=new Date(sh.created), dr=sh.drawings[0];
    const th=sh.thumb?'<img alt="" src="'+sh.thumb+'">':dr?D.toSVG(dr):'';
    return '<button class="my" data-open="'+sh.id+'"><span class="th">'+th+'</span><span class="m"><b>'+esc(sh.name)+'</b><small>'+d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0')+' · '+sh.drawings.length+' '+plural(sh.drawings.length,'чертёж','чертежа','чертежей')+'</small>'
      +'<span class="tags">'+(st.ready?'<span class="tag ok">3D готово'+(sh.drawings.length>1?': '+st.ready:'')+'</span>':'<span class="tag">3D пока нет</span>')+(st.k?'<span class="tag warn">доводка: '+st.k+'</span>':'<span class="tag ok">доведено</span>')+(sh.demo?'<span class="tag acc">пример</span>':'')+'</span></span></button>'; }).join(''); }
$('#myList').addEventListener('click',e=>{ const b=e.target.closest('[data-open]'); if(b) openSheet(b.getAttribute('data-open')); });

/* ═════ Экран чертежа ═════ */
const dv=document.createElement('div'); dv.className='dv'; dv.id='dv'; dv.setAttribute('role','dialog'); dv.setAttribute('aria-modal','true');
dv.innerHTML=`
  <div class="dv-top"><button class="icon-btn" id="dvBack" aria-label="Назад">${ICON.back}</button><input class="dv-name" id="dvName" aria-label="Название листа"><button class="icon-btn" id="dvMore" aria-label="Ещё">${ICON.more}</button></div>
  <div class="dv-sub" id="dvParts"></div>
  <div class="seg3" role="tablist"><button data-p="copy" class="on">Копия</button><button data-p="fix">Доводка <span class="cnt" id="dvCnt"></span></button><button data-p="3d">3D</button></div>
  <div class="dv-body">
    <section class="dv-pane on" id="pCopy">
      <div class="ed" id="ed"><svg id="edSvg" xmlns="http://www.w3.org/2000/svg"></svg><div class="hint" id="edHint" hidden></div>
        <div class="ed-fit"><button id="edPhoto" title="Фото под копией" aria-label="Фото под копией" hidden style="width:auto;padding:0 10px">Фото</button><button id="edFit" title="Весь чертёж">⤢</button></div></div>
      <div class="ed-tools" id="edTools">
        <button class="tool on" data-tool="sel">${ICON.hand}Выбор</button>
        <button class="tool" data-tool="pt">${ICON.pt}Точка</button>
        <button class="tool" data-tool="seg">${ICON.seg}Отрезок</button>
        <button class="tool" data-tool="o">${ICON.o}Начало O</button>
        <button class="tool" id="edUndo">${ICON.undo}Отменить</button>
      </div>
      <div class="ed-panel" id="edPanel"></div>
    </section>
    <section class="dv-pane" id="pFix"><div class="dv-scroll" id="fixList"></div></section>
    <section class="dv-pane v3" id="p3d">
      <div class="v3wrap"><canvas id="v3c" aria-label="3D-модель по чертежу"></canvas>
        <div class="v3views" id="v3views"><button data-v="iso" class="on">Изометрия</button><button data-v="front">Спереди</button><button data-v="top">Сверху</button><button data-v="side">Слева</button></div>
        <div class="v3cap" id="v3cap">Крутите пальцем · щипок — масштаб · двойное касание — исходный вид</div></div>
      <div class="v3ctl" id="v3ctl"></div>
    </section>
  </div>`;
document.body.appendChild(dv);
const menu=document.createElement('div'); menu.className='sheet menu'; menu.id='dvMenu'; menu.innerHTML='<div class="sheet-in"><h2 id="mTitle">Лист</h2><div style="display:grid;gap:8px" id="mItems"></div><button class="btn sec" id="mX">Закрыть</button></div>'; document.body.appendChild(menu);
menu.addEventListener('click',e=>{ if(e.target===menu||e.target.id==='mX') menu.classList.remove('on'); });

let SH=null, DR=null, PANE='copy', undo=[], sel=null, tool='sel', segA=null, view=null, PHOTO=null, showPhoto=false, V3=null, unfolded=false;
const cur=()=>DR;
function openSheet(id,di){ SH=SHEETS.find(s=>s.id===id); if(!SH) return; DR=SH.drawings[di||0]; undo=[]; sel=null; tool='sel'; segA=null; view=null; unfolded=false; PHOTO=null; showPhoto=false;
  $('#dvName').value=SH.name; dv.classList.add('on'); document.body.style.overflow='hidden'; history.pushState({dv:1},'','#scan/d');
  renderParts(); setTool('sel'); $('#edPhoto').hidden=true; $('#edPhoto').classList.remove('on'); pane('copy');
  IDB.get(SH.id).then(u=>{ if(!SH||SH.id!==id||!u) return; const im=new Image(); im.onload=()=>{ PHOTO={url:u,w:im.width,h:im.height}; $('#edPhoto').hidden=!DR||!DR.ph; renderEd(); }; im.src=u; });
  lib().then(L=>{ LIB=L; if(SH&&SH.id===id){ renderFix(); renderCount(); if(PANE==='3d') render3d(); } }); }
function closeSheet(){ dv.classList.remove('on'); document.body.style.overflow=''; SH=null; DR=null; renderList(); }
$('#dvBack').onclick=()=>{ if(history.state&&history.state.dv) history.back(); else closeSheet(); };
addEventListener('popstate',()=>{ if(dv.classList.contains('on')) closeSheet(); });
document.addEventListener('keydown',e=>{ if(e.key!=='Escape'||!dv.classList.contains('on')) return; if(menu.classList.contains('on')) menu.classList.remove('on'); else if(!/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||'')) $('#dvBack').click(); });
$('#dvName').addEventListener('change',()=>{ if(!SH) return; SH.name=$('#dvName').value.trim()||SH.name; save(); });
function renderParts(){ const b=$('#dvParts'); if(SH.drawings.length<2){ b.innerHTML=''; b.style.display='none'; return; } b.style.display='';
  b.innerHTML=SH.drawings.map((d,i)=>'<button class="chipb'+(d===DR?' on':'')+'" data-di="'+i+'">'+esc(d.name||('Чертёж '+(i+1)))+(D.ready(d)?' · 3D':'')+'</button>').join(''); }
$('#dvParts').addEventListener('click',e=>{ const b=e.target.closest('[data-di]'); if(!b) return; DR=SH.drawings[+b.getAttribute('data-di')]; undo=[]; sel=null; view=null; unfolded=false; renderParts(); $('#edPhoto').hidden=!PHOTO||!DR.ph; pane(PANE); });
$$('.seg3 button',dv).forEach(b=>b.addEventListener('click',()=>pane(b.getAttribute('data-p'))));
function pane(p){ PANE=p; $$('.seg3 button',dv).forEach(b=>b.classList.toggle('on',b.getAttribute('data-p')===p));
  $('#pCopy').classList.toggle('on',p==='copy'); $('#pFix').classList.toggle('on',p==='fix'); $('#p3d').classList.toggle('on',p==='3d');
  if(p==='copy'){ renderEd(); renderPanel(); } if(p==='fix') renderFix(); if(p==='3d') render3d(); renderCount(); }
function renderCount(){ if(!DR) return; const n=D.issues(DR,LIB).filter(i=>i.lvl!=='info').length, c=$('#dvCnt'); c.textContent=n?n:'✓'; c.classList.toggle('ok',!n); }
function changed(){ save(); renderCount(); renderParts(); }
function snap(){ undo.push(JSON.stringify(DR)); if(undo.length>40) undo.shift(); }
$('#edUndo').onclick=()=>{ if(!undo.length){ toast('Нечего отменять'); return; } const o=JSON.parse(undo.pop()); Object.keys(DR).forEach(k=>delete DR[k]); Object.assign(DR,o); sel=null; renderEd(); renderPanel(); changed(); };

/* меню листа */
$('#dvMore').onclick=()=>{ if(!SH) return; $('#mTitle').textContent=SH.name;
  const it=[['svg','Скачать чистую копию (SVG)'],['obj','Скачать 3D-модель (OBJ)'],['png','Картинка 3D (PNG)'],['json','Скачать данные (JSON)'],['del','Удалить лист']];
  $('#mItems').innerHTML=it.map(([k,t])=>'<button class="mi'+(k==='del'?' red':'')+'" data-m="'+k+'">'+t+'</button>').join(''); menu.classList.add('on'); };
$('#mItems').addEventListener('click',e=>{ const b=e.target.closest('[data-m]'); if(!b||!SH) return; const k=b.getAttribute('data-m'), base=(SH.name+' '+(DR.name||'')).replace(/№\s*/g,'N').replace(/[\\/:*?"<>|·]+/g,' ').replace(/\s+/g,' ').trim();
  if(k==='svg') dl(base+'.svg','image/svg+xml',D.toSVG(DR));
  if(k==='obj') dl(base+'.obj','text/plain',D.toOBJ(DR));
  if(k==='json') dl(base+'.json','application/json',JSON.stringify(DR,null,1));
  if(k==='png'){ pane('3d'); setTimeout(()=>{ const a=document.createElement('a'); a.href=V3.png(); a.download=base+'.png'; a.click(); },350); }
  if(k==='del'){ if(!confirm('Удалить «'+SH.name+'» вместе с копиями?')) return; IDB.del(SH.id); SHEETS=SHEETS.filter(s=>s!==SH); save(true); menu.classList.remove('on'); $('#dvBack').click(); return; }
  menu.classList.remove('on'); });
function dl(name,type,text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),3000); }

/* ═════ Копия: редактор ═════ */
const svg=$('#edSvg'), ed=$('#ed');
const NS='http://www.w3.org/2000/svg';
function fit(){ const b=D.bounds(DR), w=Math.max(30,b[2]-b[0]), h=Math.max(30,b[3]-b[1]), r=ed.getBoundingClientRect(), ar=(r.width||360)/(r.height||300), m=0.08;
  let W=w*(1+2*m), H=h*(1+2*m); if(W/H<ar) W=H*ar; else H=W/ar; view={x:(b[0]+b[2])/2-W/2,y:(b[1]+b[3])/2-H/2,w:W,h:H}; }
function px(){ const r=ed.getBoundingClientRect(); return view.w/(r.width||1); }   /* мм на пиксель экрана */
function toMm(e){ const r=ed.getBoundingClientRect(); return [view.x+(e.clientX-r.left)*view.w/r.width,view.y+(e.clientY-r.top)*view.h/r.height]; }
function renderEd(){ if(!DR||PANE!=='copy') return; if(!view) fit(); svg.setAttribute('viewBox',[view.x,view.y,view.w,view.h].join(' '));
  const k=px(), fs=13*k, L=[], sx=v=>v.toFixed(2);
  if(showPhoto&&PHOTO&&DR.ph){ const K=SH.photoK||1, A=D.inv(DR.ph.map((v,i)=>v*K)); /* мм → px миниатюры = K·(мм → px фото) */
    if(A) L.push('<image href="'+PHOTO.url+'" width="'+PHOTO.w+'" height="'+PHOTO.h+'" opacity="0.55" transform="matrix('+[A[0],A[3],A[1],A[4],A[2],A[5]].join(' ')+')" preserveAspectRatio="none"/>'); }
  L.push('<line x1="'+sx(view.x)+'" y1="0" x2="'+sx(view.x+view.w)+'" y2="0" stroke="#7d8aa3" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="10 3 2 3"/>');
  L.push('<circle cx="0" cy="0" r="'+sx(4*k)+'" fill="none" stroke="#7d8aa3" stroke-width="1.4" vector-effect="non-scaling-stroke"/><text x="'+sx(5*k)+'" y="'+sx(15*k)+'" font-size="'+sx(fs)+'" fill="#7d8aa3" font-weight="600">O</text>');
  const col=s=>s.unv?'#e07b00':s.src==='found'?'#8aa4c8':s.src==='hand'?'#1a5ae0':'#16181d';
  DR.arcs.forEach(c=>L.push('<polyline data-id="'+c.id+'" fill="none" points="'+c.poly.map(p=>sx(p[0])+','+sx(p[1])).join(' ')+'" stroke="'+(sel===c.id?'#e0252c':col(c))+'" stroke-width="'+(sel===c.id?3:1.6)+'" vector-effect="non-scaling-stroke"'+(c.dash?' stroke-dasharray="7 4"':c.unv?' stroke-dasharray="4 3"':'')+'/>'));
  DR.segs.forEach(s=>{ const w=sel===s.id?3.2:s.src==='found'?1:1.8; L.push('<line data-id="'+s.id+'" x1="'+sx(s.a[0])+'" y1="'+sx(s.a[1])+'" x2="'+sx(s.b[0])+'" y2="'+sx(s.b[1])+'" stroke="'+(sel===s.id?'#e0252c':col(s))+'" stroke-width="'+w+'" stroke-linecap="round" vector-effect="non-scaling-stroke"'+(s.dash?' stroke-dasharray="7 4"':s.unv?' stroke-dasharray="4 3"':'')+'/>'); });
  const sp=D.space(DR), in3=new Set(); Object.values(sp.pts).forEach(p=>{ in3.add(p.f); in3.add(p.h); });
  DR.pts.forEach(p=>{ const on=sel===p.id||segA&&segA.id===p.id; L.push('<circle cx="'+sx(p.at[0])+'" cy="'+sx(p.at[1])+'" r="'+sx((on?6:3.6)*k)+'" fill="'+(on?'#e0252c':in3.has(p.id)?'#c0005a':'#fff')+'" stroke="#c0005a" stroke-width="1.6" vector-effect="non-scaling-stroke"/>'
    +'<text x="'+sx(p.at[0]+5*k)+'" y="'+sx(p.at[1]-5*k)+'" font-size="'+sx(fs)+'" font-weight="600" font-style="italic" fill="#a1004a" stroke="#fbfaf6" stroke-width="'+sx(3*k)+'" paint-order="stroke">'+esc(p.l)+'</text>'); });
  if(segA&&!segA.id) L.push('<circle cx="'+sx(segA.at[0])+'" cy="'+sx(segA.at[1])+'" r="'+sx(5*k)+'" fill="#e0252c"/>');
  svg.innerHTML=L.join('');
  const hint=$('#edHint'), H={pt:'Коснитесь места, где поставить точку',seg:segA?'Коснитесь второго конца отрезка':'Коснитесь первого конца отрезка (у точки — притянется к ней)',o:'Коснитесь начала O — пересечения оси x с линией отсчёта'}[tool];
  hint.hidden=!H; if(H) hint.textContent=H; }
function nearest(m,maxPx){ const k=px(), R=(maxPx||14)*k; let best=null, bd=R;
  DR.pts.forEach(p=>{ const d=Math.hypot(p.at[0]-m[0],p.at[1]-m[1]); if(d<bd){ bd=d; best={t:'pt',o:p}; } });
  if(best) return best; bd=(maxPx?maxPx*0.7:10)*k;
  DR.segs.forEach(s=>{ const d=segDist(m,s.a,s.b); if(d<bd){ bd=d; best={t:'seg',o:s}; } });
  DR.arcs.forEach(c=>{ for(let i=1;i<c.poly.length;i++){ const d=segDist(m,c.poly[i-1],c.poly[i]); if(d<bd){ bd=d; best={t:'arc',o:c}; } } });
  return best; }
function segDist(p,a,b){ const dx=b[0]-a[0], dy=b[1]-a[1], l=dx*dx+dy*dy; let t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0; t=Math.max(0,Math.min(1,t)); return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); }
function snapEnd(m){ const n=nearest(m,16); if(n&&n.t==='pt') return {at:n.o.at.slice(),id:n.o.id};
  let best=null, bd=12*px(); DR.segs.forEach(s=>[s.a,s.b].forEach(p=>{ const d=Math.hypot(p[0]-m[0],p[1]-m[1]); if(d<bd){ bd=d; best=p; } })); return {at:best?best.slice():[Math.round(m[0]*10)/10,Math.round(m[1]*10)/10]}; }
function setTool(t){ tool=t; segA=null; $$('#edTools [data-tool]').forEach(b=>b.classList.toggle('on',b.getAttribute('data-tool')===t)); renderEd(); }
$('#edTools').addEventListener('click',e=>{ const b=e.target.closest('[data-tool]'); if(b) setTool(b.getAttribute('data-tool')); });
$('#edFit').onclick=()=>{ fit(); renderEd(); };
$('#edPhoto').onclick=()=>{ showPhoto=!showPhoto; $('#edPhoto').classList.toggle('on',showPhoto); renderEd(); };

/* жесты редактора: касание — выбор/действие инструмента; перетаскивание выбранной точки — сдвиг; иначе — панорама; два пальца — масштаб */
const P=new Map(); let drag=null, pinch=null, moved=false;
ed.addEventListener('pointerdown',e=>{ if(!DR) return; ed.setPointerCapture(e.pointerId); P.set(e.pointerId,[e.clientX,e.clientY]); moved=false;
  if(P.size===2){ const [a,b]=[...P.values()]; pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),v:Object.assign({},view),c:toMm({clientX:(a[0]+b[0])/2,clientY:(a[1]+b[1])/2})}; drag=null; return; }
  const m=toMm(e), n=tool==='sel'?nearest(m):null;
  drag=n&&n.t==='pt'&&n.o.id===sel?{t:'pt',o:n.o,start:m,at0:n.o.at.slice(),snap:false}:{t:'pan',x:e.clientX,y:e.clientY,v:Object.assign({},view)}; });
ed.addEventListener('pointermove',e=>{ if(!P.has(e.pointerId)) return; const was=P.get(e.pointerId); P.set(e.pointerId,[e.clientX,e.clientY]); if(Math.hypot(e.clientX-was[0],e.clientY-was[1])>0.5) moved=moved||Math.hypot(e.clientX-was[0],e.clientY-was[1])>3;
  if(pinch&&P.size===2){ const [a,b]=[...P.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]), k=pinch.d/Math.max(d,1), w=Math.max(8,Math.min(2000,pinch.v.w*k)), h=w*pinch.v.h/pinch.v.w;
    view={x:pinch.c[0]-(pinch.c[0]-pinch.v.x)*w/pinch.v.w,y:pinch.c[1]-(pinch.c[1]-pinch.v.y)*h/pinch.v.h,w,h}; moved=true; renderEd(); return; }
  if(!drag) return;
  if(drag.t==='pan'){ const r=ed.getBoundingClientRect(); view.x=drag.v.x-(e.clientX-drag.x)*view.w/r.width; view.y=drag.v.y-(e.clientY-drag.y)*view.h/r.height; renderEd(); }
  else if(drag.t==='pt'&&moved){ if(!drag.snap){ snap(); drag.snap=true; } const m=toMm(e); D.movePoint(DR,drag.o.id,[drag.at0[0]+m[0]-drag.start[0],drag.at0[1]+m[1]-drag.start[1]]); renderEd(); } });   /* сдвиг на смещение пальца: точка не прыгает под него */
const pend=e=>{ const was=P.has(e.pointerId); P.delete(e.pointerId); if(P.size<2) pinch=null; if(!was) return;
  if(drag&&drag.t==='pt'&&drag.snap){ changed(); renderPanel(); drag=null; return; }
  if(!moved&&P.size===0) tap(toMm(e)); drag=null; };
ed.addEventListener('pointerup',pend); ed.addEventListener('pointercancel',e=>{ P.delete(e.pointerId); drag=null; pinch=null; });
ed.addEventListener('wheel',e=>{ if(!view) return; e.preventDefault(); const m=toMm(e), k=Math.exp(e.deltaY*0.0015), w=Math.max(8,Math.min(2000,view.w*k)), h=w*view.h/view.w; view={x:m[0]-(m[0]-view.x)*w/view.w,y:m[1]-(m[1]-view.y)*h/view.h,w,h}; renderEd(); },{passive:false});
function tap(m){ if(tool==='sel'){ const n=nearest(m); sel=n?n.o.id:null; renderEd(); renderPanel(); return; }
  if(tool==='pt'){ snap(); const s=snapEnd(m); const p=D.addPoint(DR,suggest(s.at),s.at); sel=p.id; setTool('sel'); changed(); renderPanel(true); return; }
  if(tool==='seg'){ const s=snapEnd(m); if(!segA){ segA=s; renderEd(); return; } if(Math.hypot(s.at[0]-segA.at[0],s.at[1]-segA.at[1])<0.5) return; snap(); const g=D.addSeg(DR,segA.at,s.at,false); segA=null; sel=g.id; changed(); renderEd(); renderPanel(); return; }
  if(tool==='o'){ snap(); const s=snapEnd(m), at=[s.at[0],s.at[1]]; D.setOrigin(DR,at); view.x-=at[0]; view.y-=at[1]; setTool('sel'); changed(); toast('Начало O перенесено, ось x — через него'); return; } }
/* подпись новой точки: над осью — ″, под осью — ′; буква — первая свободная */
function suggest(at){ const pr=at[1]>0?'′':'″', used=new Set(DR.pts.map(p=>p.l)); for(const c of 'ABCDEFKMNS123456789'){ if(!used.has(c+pr)) return c+pr; } return '?'+pr; }

function renderPanel(focus){ const box=$('#edPanel'); if(!DR) return;
  const o=sel&&(DR.pts.find(p=>p.id===sel)||DR.segs.find(s=>s.id===sel)||DR.arcs.find(s=>s.id===sel));
  if(!o){ const s=D.space(DR); box.innerHTML='<div class="ed-legend"><span><i style="background:var(--ink)"></i>подтверждено</span><span><i style="background:#e07b00"></i>не подтверждено</span><span><i style="background:#8aa4c8"></i>найдено сверх модели</span><span><i style="background:#1a5ae0"></i>добавлено вами</span></div>'
      +'<small>'+(DR.approx&&!DR.originSet?'Масштаб примерный: отметьте начало O или привяжите вариант в «Доводке». ':'')+'Коснитесь точки или линии, чтобы поправить. В 3D сейчас: точек '+Object.keys(s.pts).length+', рёбер '+s.edges.length+'.</small>'; return; }
  if(o.l!=null){ const L=D.parseLabel(o.l), s=D.space(DR).pts[L.name], in3=s&&(s.f===o.id||s.h===o.id);
    box.innerHTML='<div class="r"><input class="sc-in" id="pL" value="'+esc(o.l)+'" aria-label="Подпись точки" autocomplete="off" autocapitalize="characters"><button class="btn sm sec" data-mk="″">″</button><button class="btn sm sec" data-mk="′">′</button><button class="btn sm red" id="pDel">Удалить</button></div>'
      +'<small>u = '+f1(o.at[0])+', v = '+f1(o.at[1])+' мм от O · '+(L.pr==='f'?'фронтальная проекция':L.pr==='h'?'горизонтальная проекция':'проекция не указана — добавьте ″ или ′')+(in3?' · в 3D: x = '+f1(s.P[0])+', y = '+f1(s.P[1])+', z = '+f1(s.P[2]):'')+'. Перетащите точку, чтобы сдвинуть.</small>';
    const inp=$('#pL'); if(focus){ inp.focus(); inp.select(); }
    let snapped=false; const once=()=>{ if(!snapped){ snap(); snapped=true; } };
    inp.addEventListener('input',()=>{ once(); const v=inp.value.trim(); if(v){ o.l=v; renderEd(); changed(); } });
    inp.addEventListener('change',()=>renderPanel());
    $$('[data-mk]',box).forEach(b=>{ b.addEventListener('pointerdown',e=>e.preventDefault());   /* поле не теряет фокус — нажатие не съедается перерисовкой */
      b.onclick=()=>{ once(); const v=inp.value.trim()||o.l, n=D.parseLabel(v).name||v.replace(/[″′‴'"]+$/,''); o.l=n+b.getAttribute('data-mk'); changed(); renderEd(); renderPanel(); }; });
    $('#pDel').onclick=()=>{ snap(); D.remove(DR,o.id); sel=null; changed(); renderEd(); renderPanel(); }; return; }
  const isSeg=!!o.a, len=isSeg?Math.hypot(o.b[0]-o.a[0],o.b[1]-o.a[1]):0;
  box.innerHTML='<div class="r">'+(isSeg?'<button class="btn sm '+(o.dash?'sec':'')+'" data-k="main">Основная</button><button class="btn sm '+(o.dash?'':'sec')+'" data-k="dash">Штриховая</button>':'')+(o.unv?'<button class="btn sm" data-k="ok">Подтвердить</button>':'')+'<button class="btn sm red" data-k="del">Удалить</button></div>'
    +'<small>'+(isSeg?'Отрезок '+f1(len)+' мм':'Дуга')+(o.unv?' · модель видит линию, а карандаш под ней не нашёлся — проверьте по фото':o.src==='found'?' · найден по карандашу сверх того, что выписала модель':o.src==='hand'?' · добавлен вами':'')+'.</small>';
  $$('[data-k]',box).forEach(b=>b.onclick=()=>{ snap(); const k=b.getAttribute('data-k'); if(k==='main') o.dash=false; if(k==='dash') o.dash=true; if(k==='ok') o.unv=false; if(k==='del'){ D.remove(DR,o.id); sel=null; } changed(); renderEd(); renderPanel(); }); }

/* ═════ Доводка ═════ */
function renderFix(){ if(!DR||PANE!=='fix') return; const box=$('#fixList'), is=D.issues(DR,LIB), sp=D.space(DR), ok=D.ready(DR), big=is.filter(i=>i.lvl!=='info');
  let h='<div class="card"><div class="st '+(ok?'ok':'no')+'"><span class="big3">'+(ok?ICON.ok:ICON.warn)+'</span><span><b>'+(ok?(big.length?'3D уже можно смотреть':'Копия доведена'):'Пока не хватает для 3D')+'</b><br><small class="mut">'+(big.length?'Осталось поправить: '+big.length:'Замечаний нет')+'</small></span></div>'
    +'<div class="nums"><div><b>'+Object.keys(sp.pts).length+'</b><small>точек в 3D</small></div><div><b>'+sp.edges.length+'</b><small>рёбер</small></div><div><b>'+sp.faces.length+'</b><small>граней</small></div></div>'
    +(ok?'<button class="btn" style="width:100%;margin-top:12px" data-go3d>'+ICON.cube+'Смотреть в 3D</button>':'')+'</div>';
  /* проверка по результату — истинные величины копии против эталона варианта (на момент скана) */
  if(DR.verify&&DR.verify.found&&DR.verify.found.length){ const v=DR.verify, fm=x=>Array.isArray(x)?x.map(f1).join(' / '):f1(x);
    h+='<div class="card"><div class="st '+(v.verdict==='верно'?'ok':v.verdict==='расходится с эталоном'?'no':'')+'"><span class="big3">'+(v.verdict==='верно'?ICON.ok:ICON.warn)+'</span><span><b>Проверка по результату: '+esc(v.verdict)+'</b><br><small class="mut">'
      +v.found.map(f=>esc(f.what)+' — начерчено '+fm(f.got)+' '+f.unit+', по варианту '+fm(f.want)+' '+f.unit+' ('+esc(f.st)+', проекция '+esc(f.from)+')').join('; ')
      +(v.verdict==='расходится с эталоном'?'. Проверьте построение этой величины.':'')+'</small></span></div></div>'; }
  /* проверка построения — вердикт сканера (на момент скана) */
  if(DR.check){ const c=DR.check, cls=c.verdict==='верно'?'ok':c.verdict==='ошибка'?'no':'', ic=c.verdict==='верно'?ICON.ok:ICON.warn;
    h+='<div class="card"><div class="st '+cls+'"><span class="big3">'+ic+'</span><span><b>Проверка построения: '+esc(c.verdict)+'</b><br><small class="mut">'+(c.partName?'Часть '+esc(c.partName)+'. ':'')+esc((c.why||[]).join('. '))+(c.verdict==='не могу утверждать'?' Сканер говорит «ошибка», только когда уверен: доведите копию или снимите чертёж крупнее.':'')+'</small></span></div></div>'; }
  /* привязка к варианту */
  h+='<div class="card bind">'+(DR.dz&&DR.n?'<b>ДЗ №'+DR.dz+', вариант '+DR.n+'</b><small class="mut">'+(DR.rms!=null?'Точки условия совпали с таблицей варианта, расхождение '+f1(DR.rms)+' мм. ':'')+'Копия — в точных миллиметрах листа.</small>'
      :'<b>Вариант не определён</b><small class="mut">Укажите задание и вариант — копия пересчитается в точные мм по точкам условия, и «Доводка» сверит их с таблицей.</small>')
    +'<div class="r"><select class="sc-in" id="bDz" style="flex:1"><option value="3"'+(DR.dz==2?'':' selected')+'>ДЗ №3</option><option value="2"'+(DR.dz==2?' selected':'')+'>ДЗ №2</option></select><input class="sc-in" id="bN" inputmode="numeric" placeholder="вариант" style="flex:1" value="'+(DR.n||'')+'"><button class="btn sm" id="bGo">'+(DR.n?'Сменить':'Привязать')+'</button></div></div>';
  const auto=is.filter(i=>i.fix&&['rename','snapGiven','align','addGiven'].includes(i.fix.k));
  if(auto.length>1) h+='<button class="btn" data-auto>Исправить всё, что можно ('+auto.length+')</button>';
  is.forEach((i,ix)=>{ const fx=i.fix, btn=[];
    if(fx){ if(fx.k==='unv') btn.push('<button class="btn sm" data-fx="'+ix+'" data-v="unvOk">Подтвердить все</button><button class="btn sm sec" data-fx="'+ix+'" data-v="unvDrop">Убрать все</button>');
      else if(fx.k==='pickOrigin') btn.push('<button class="btn sm" data-fx="'+ix+'" data-v="pickOrigin">Отметить O на копии</button>');
      else btn.push('<button class="btn sm" data-fx="'+ix+'">'+({align:'Выровнять',snapGiven:'Поставить по условию',addGiven:'Добавить по условию',rename:'Подписать '+(fx.l||'')}[fx.k]||'Исправить')+'</button>'); }
    if(i.id) btn.push('<button class="btn sm sec" data-show="'+i.id+'">Показать</button>');
    h+='<div class="card iss '+i.lvl+'"><b>'+esc(i.t)+'</b><p>'+esc(i.d)+'</p>'+(btn.length?'<div class="r">'+btn.join('')+'</div>':'')+'</div>'; });
  if(!is.length) h+='<div class="card empty">Замечаний нет: каждая точка — в обеих проекциях, линии связи ровные, сомнительных линий нет.</div>';
  box.innerHTML=h;
  $$('[data-fx]',box).forEach(b=>b.onclick=()=>{ const i=is[+b.getAttribute('data-fx')], v=b.getAttribute('data-v');
    if(v==='pickOrigin'){ pane('copy'); setTool('o'); return; }
    snap(); D.apply(DR,v?{k:v}:i.fix); changed(); renderFix(); toast('Исправлено'); });
  $$('[data-show]',box).forEach(b=>b.onclick=()=>{ sel=b.getAttribute('data-show'); const p=DR.pts.find(q=>q.id===sel); pane('copy'); if(p&&view){ view.x=p.at[0]-view.w/2; view.y=p.at[1]-view.h/2; } renderEd(); renderPanel(); });
  const a=$('[data-auto]',box); if(a) a.onclick=()=>{ snap(); auto.forEach(i=>D.apply(DR,i.fix)); D.issues(DR,LIB).filter(i=>i.fix&&i.fix.k==='align').forEach(i=>D.apply(DR,i.fix)); changed(); renderFix(); toast('Исправлено: '+auto.length); };
  const g=$('[data-go3d]',box); if(g) g.onclick=()=>pane('3d');
  $('#bGo').onclick=async()=>{ const L=LIB||await lib(); if(!L){ toast('Таблица вариантов не загрузилась'); return; } snap(); const r=D.bindVariant(DR,L,$('#bDz').value,$('#bN').value);
    if(!r.ok){ undo.pop(); toast(r.why); return; } view=null; changed(); renderFix(); toast('Привязано: расхождение '+f1(r.rms)+' мм'); }; }

/* ═════ 3D ═════ */
function render3d(){ if(!DR||PANE!=='3d') return; if(!V3){ V3=self.VIEW3D.create($('#v3c'),{top:44}); $('#v3c').addEventListener('pointerdown',()=>$('#v3cap').classList.add('off'),{once:true}); }
  const sp=D.space(DR), ref=LIB?D.reference(DR,LIB):null; V3.set({pts:sp.pts,edges:sp.edges,faces:sp.faces,ref});
  const ready=Object.keys(sp.pts).length>0, o=k=>V3.get(k);
  const tg=(k,t)=>'<button class="chipb'+(o(k)?' on':'')+'" data-o="'+k+'">'+t+'</button>';
  let rows=Object.values(sp.pts).sort((a,b)=>a.name.localeCompare(b.name,'ru',{numeric:true})).map(p=>{ const R=ref&&ref.pts[p.name], dv=R?Math.hypot(p.P[0]-R[0],p.P[1]-R[1],p.P[2]-R[2]):null;
    return '<tr><td><b>'+esc(p.name)+'</b></td><td>'+f1(p.P[0])+'</td><td>'+f1(p.P[1])+'</td><td>'+f1(p.P[2])+'</td>'+(ref?'<td class="dev '+(dv==null?'':dv<1.5?'ok':dv<4?'warn':'bad')+'">'+(dv==null?'—':f1(dv))+'</td>':'')+'</tr>'; }).join('');
  $('#v3ctl').innerHTML=(ready?'':'<div class="card iss warn"><b>Нечего показать в 3D</b><p>Нужны точки с обеими проекциями: A″ и A′. Поправьте подписи на копии.</p><div class="r"><button class="btn sm" data-gofix>К доводке</button></div></div>')
    +'<button class="btn'+(unfolded?' sec':'')+'" id="v3Unf">'+(unfolded?'Собрать обратно в пространство':'Развернуть в эпюр')+'</button>'
    +'<div class="r">'+tg('planes','Плоскости')+tg('proj','Проекции')+tg('rays','Линии связи')+tg('labels','Подписи')+(ref?tg('ref','Эталон варианта'):'')+'</div>'
    +(rows?'<div class="card" style="padding:12px"><table class="ptab"><tr><th>Точка</th><th>x</th><th>y</th><th>z</th>'+(ref?'<th>Δ эталон</th>':'')+'</tr>'+rows+'</table><p class="note" style="margin:8px 0 0">мм; x — влево от O, y — к нам (от П₂), z — вверх (от П₁). Координаты — по двум проекциям'+(ref?'; Δ — до точки по условию и решению варианта '+ref.n:'')+(DR.approx&&!DR.originSet?'. Масштаб примерный.':'.')+'</p></div>':'')
    +'<div class="r"><button class="btn sm sec" data-ex="obj">Скачать OBJ</button><button class="btn sm sec" data-ex="png">Картинка PNG</button></div>';
  $('#v3Unf').onclick=()=>{ unfolded=!unfolded; V3.unfold(unfolded?1:0,unfolded); if(unfolded){ V3.opt('planes',true); V3.opt('proj',true); } $$('#v3views button').forEach(b=>b.classList.toggle('on',unfolded?b.getAttribute('data-v')==='front':false)); render3dCtl(); };
  $$('[data-o]',$('#v3ctl')).forEach(b=>b.onclick=()=>{ const k=b.getAttribute('data-o'); V3.opt(k,!V3.get(k)); b.classList.toggle('on',V3.get(k)); });
  $$('[data-ex]',$('#v3ctl')).forEach(b=>b.onclick=()=>{ const base=(SH.name+' '+(DR.name||'')).replace(/№\s*/g,'N').replace(/[\\/:*?"<>|·]+/g,' ').replace(/\s+/g,' ').trim(); if(b.getAttribute('data-ex')==='obj') dl(base+'.obj','text/plain',D.toOBJ(DR)); else { const a=document.createElement('a'); a.href=V3.png(); a.download=base+'.png'; a.click(); } });
  const gf=$('[data-gofix]',$('#v3ctl')); if(gf) gf.onclick=()=>pane('fix');
  setTimeout(()=>V3.redraw(),30); }
function render3dCtl(){ const b=$('#v3Unf'); if(b){ b.textContent=unfolded?'Собрать обратно в пространство':'Развернуть в эпюр'; b.classList.toggle('sec',unfolded); } }
$('#v3views').addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(!b||!V3) return; $$('#v3views button').forEach(x=>x.classList.toggle('on',x===b)); V3.view(b.getAttribute('data-v')); });

/* ═════ вход: кнопки кабинета ведут сюда ═════ */
document.addEventListener('click',e=>{ const b=e.target.closest('[data-scan]'); if(!b) return; e.preventDefault(); const t=document.querySelector('.tab[data-tab="check"]'); if(t) t.click(); if(b.getAttribute('data-scan')==='cam') camera(); });
/* адрес: #scan — открыта вкладка «Скан» (после перезагрузки и «назад» из чертежа возвращаемся сюда) */
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{ if(dv.classList.contains('on')) return; const on=t.getAttribute('data-tab')==='check'; if(on!==(location.hash==='#scan')) history.replaceState(history.state,'',on?'#scan':location.pathname+location.search); }));
if(/^#scan/.test(location.hash)){ if(location.hash!=='#scan') history.replaceState(null,'','#scan'); const t=document.querySelector('.tab[data-tab="check"]'); if(t) setTimeout(()=>t.click(),0); }
lib().then(L=>{ LIB=L; renderList(); });
renderList();
self.LKSCAN={open:openSheet,list:()=>SHEETS,scan,get dr(){ return DR; },get v3(){ return V3; },pane};
})();
