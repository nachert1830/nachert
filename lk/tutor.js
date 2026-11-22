/* ═══ Наставник — ИИ-агент на чертеже (docs/TUTOR.md) ═══
   Окно на странице варианта ИГ ДЗ №4 (#/ig4/<n>; прежний адрес #/ig/dz/4/<n> переадресуется): разговор с наставником; его ответы управляют чертежом —
   открывают нужный шаг плеера решения и подсвечивают точки (IG4S.player). Фото листа (📷) уходит вместе с эталоном —
   видом решения варианта со всеми номерами точек (IG4S.svg → JPEG), глаза наставника сравнивают их.
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

/* ── где мы: вариант ДЗ №4 ── */
function here(){ const m=/^#\/(?:ig4|ig\/dz\/4)\/(\d{1,2})(?:[/?]|$)/.exec(location.hash||''); return m?{dz:'ig4',n:+m[1]}:null; }

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
/* ── эталон для глаз: вид решения варианта со всеми номерами точек ── */
async function reference(n){ if(!window.IG4S||!window.DZR) return '';
  const model=DZR.get('ig4').part(n), PL=IG4S.plan(model); let i=PL.ST.findIndex(s=>s.id==='aa2'); if(i<0) i=PL.ST.length-2;
  let s=IG4S.svg(model,PL,i,{hidePast:false,allNums:true});
  s=s.replace(/^<svg([^>]*)>/,(m,a)=>'<svg xmlns="http://www.w3.org/2000/svg"'+a.replace(/\sclass="[^"]*"/,'')+'><style>.igs-k{font:italic 600 24px "Times New Roman",serif;paint-order:stroke;stroke:#fff;stroke-width:4px}</style>');
  const vb=/viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(s), W=vb?+vb[1]:900, H=vb?+vb[2]:900, k=1400/Math.max(W,H);
  const url=URL.createObjectURL(new Blob([s],{type:'image/svg+xml'}));
  try{ const im=await new Promise((ok,no)=>{ const x=new Image(); x.onload=()=>ok(x); x.onerror=()=>no(new Error('эталон')); x.src=url; });
    const cv=document.createElement('canvas'); cv.width=Math.round(W*k); cv.height=Math.round(H*k); const cx=cv.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); cx.drawImage(im,0,0,cv.width,cv.height);
    return cv.toDataURL('image/jpeg',.8); }
  finally{ URL.revokeObjectURL(url); } }

/* ── чертёж: открыть плеер шагов варианта n и выполнить действие наставника ── */
async function player(n){ const ok=()=>{ const P=window.IG4S&&IG4S.player; return P&&P.model&&+P.model.n===n&&$('#igbPic')&&document.contains($('#igbPic'))?P:null; };
  if(ok()) return ok();
  const show=$('#igShow'); if(show&&show.offsetParent!==null) show.click();
  const tab=await until(()=>$('.igx-tabs button[data-t=steps]'),6000); if(tab&&tab.getAttribute('aria-selected')!=='true') tab.click();
  return until(()=>ok()&&$('#igbPic svg')&&ok(),60000); }
async function act(a){ const w=here(); if(!a||!w) return;
  if(a.t==='show'){ const P=await player(w.n); if(!P) return; P.go(a.step); if(a.points&&a.points.length){ await sleep(60); P.highlight(a.points); }
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
.tu[hidden]{display:none}
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
function render(){ const w=S.w, st=S.st; $('[data-sub]',box).textContent=w?'ИГ · ДЗ №4 · вариант '+w.n:'';
  box.querySelectorAll('[data-mode]').forEach(b=>{ const on=st&&st.mode===b.dataset.mode; b.classList.toggle('on',!!on); b.setAttribute('aria-selected',String(!!on)); });
  $('[data-foot]',box).hidden=!(st&&st.ready); $('.tu-mode',box).hidden=!(st&&st.ready);
  if(!tok()){ body.innerHTML='<div class="tu-gate"><b>Войди, и начнём</b><p>Наставник помнит, где ты застрял, и ведёт по шагам твоего варианта. Вход — тот же, что в личном кабинете.</p><a class="tu-btn" href="/lk/#/login" data-login>Войти</a></div>'; return; }
  if(!st){ body.innerHTML='<div class="tu-wait"><i></i>Открываю…</div>'; return; }
  if(!st.on){ body.innerHTML='<div class="tu-gate"><b>Наставник скоро появится</b><p>Пока его не подключили. Вопрос можно задать автору.</p><a class="tu-btn" href="#/ask">Спросить автора</a></div>'; return; }
  if(!st.consent&&!st.ru){ body.innerHTML=`<div class="tu-gate"><b>Наставник работает на модели Claude</b><p>Это зарубежная модель (Anthropic, через ProxyAPI). Ей уходит только текст твоего вопроса, номер варианта и, если ты сам пришлёшь, фото листа. Имя, почта, группа и другие данные о тебе — не уходят. Фото не хранится.</p><button class="tu-btn" data-consent>Согласен, начать</button></div>`; return; }
  let h=''; if(!st.msgs.length) h+=`<div class="tu-hi"><b>Привет! Я твой наставник по ДЗ №4.</b><p>Спроси, где застрял, — открою нужный шаг на чертеже и подсвечу точки. В режиме «Наставник» сначала подсказываю, решение — когда попробуешь сам. Пришли фото листа 📷 — найду, где ошибка.</p></div><div class="tu-sug">${SUG.map(s=>'<button class="tu-chip" data-sug>'+esc(s)+'</button>').join('')}</div>`;
  st.msgs.forEach((m,i)=>{ if(m.from==='u') h+=`<div class="tu-m u"><div class="tu-bb">${m.photo?'📷 ':''}${esc(m.text||'Фото листа')}</div></div>`;
    else { const acts=(m.actions||[]).map((a,j)=>a.t==='show'?`<button class="tu-chip" data-act="${i}:${j}">Шаг ${a.step} на чертеже${a.points&&a.points.length?' · точки '+a.points.join(', '):''} ↗</button>`:a.t==='ask'?`<a class="tu-chip" href="#/ask/${esc(a.id)}">Вопрос автору ↗</a>`:'').join('');
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
  if(!S.st||!S.w||S.w.n!==here().n) load(); else render(); setTimeout(()=>{ if(innerWidth>=760) inp.focus(); },50); }
function close(peek){ S.open=false; box.hidden=true; fab.hidden=!here(); if(peek&&!fab.querySelector('u')) fab.insertAdjacentHTML('beforeend','<u></u>'); }
function route(){ const w=here(); if(!w){ box.hidden=true; fab.hidden=true; return; } fab.hidden=S.open; if(S.w&&S.w.n!==w.n){ S.st=null; S.w=w; if(S.open) load(); } }
addEventListener('hashchange',route);
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();

async function send(text){ const w=here(); if(!w||S.busy||!S.st||!S.st.ready) return; text=String(text==null?inp.value:text).trim(); if(!text&&!S.photo) return;
  const P=window.IG4S&&IG4S.player, step=P&&P.model&&+P.model.n===w.n?P.current():null, photo=S.photo;
  S.busy=true; S.busyPhoto=!!photo; S.err=''; S.st.msgs.push({from:'u',text,photo:!!photo}); inp.value=''; S.photo=null; render();
  try{ let ref=''; if(photo){ try{ ref=await reference(w.n); }catch(e){ ref=''; } }
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
  if(t.matches('[data-login]')){ e.preventDefault(); LS.set('lk_ret','/'+(location.hash||'')); location.href='/lk/#/login'; return; }
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
