/* ═══ «Спроси автора» — вопросы и ответы внутри сайта ═══
   Страница #/ask (и старый адрес #/live): написать вопрос (можно с фото чертежа), «Мои вопросы», переписка #/ask/<id>.
   Писать может только вошедший: без входа вопрос сохраняется черновиком, вход — в кабинете (/lk/#/login, возврат сюда
   по lk_ret), после входа черновик уходит сам. Автор отвечает в пульте (me/, вкладка «Вопросы»).
   Сервер — API кабинета (window.CLUB_API, lk/config.js): /api/ask*, сессия — lk_tok (Authorization: Bearer).
   В шапке — кнопка «Спросить» с числом новых ответов; новый ответ, пока ты на другой странице, — всплывающая карточка.
   Сайт отрисовывает страницу раньше, чем грузится этот файл: он сам находит [data-ask-root] / [data-ask-home] и заполняет. */
(function(){
'use strict';
const API=String(self.CLUB_API||'').replace(/\/$/,'');
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const LS={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ v==null?localStorage.removeItem(k):localStorage.setItem(k,v); }catch(e){} } };
const SS={ get(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ v==null?sessionStorage.removeItem(k):sessionStorage.setItem(k,v); }catch(e){} } };
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tok=()=>LS.get('lk_tok')||'';
const MON=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
function when(t){ const d=new Date(t), n=new Date(), s=(n-d)/1000;
  if(s<60) return 'сейчас'; if(s<3600) return Math.floor(s/60)+' мин';
  const hm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  if(d.toDateString()===n.toDateString()) return hm;
  const y=new Date(n); y.setDate(n.getDate()-1); if(d.toDateString()===y.toDateString()) return 'вчера, '+hm;
  return d.getDate()+' '+MON[d.getMonth()]+(d.getFullYear()!==n.getFullYear()?' '+d.getFullYear():''); }
/* текст сообщения: переносы строк и ссылки (адреса сайта #/… и http) */
function rich(s){ return esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)»])/g,'<a href="$1" target="_blank" rel="noopener">$1</a>')
  .replace(/(^|[\s(«])(#\/[\w\/-]+)/g,'$1<a href="$2">$2</a>').replace(/\n/g,'<br>'); }

/* ── запросы ── */
async function req(m,p,b){ const h={}; if(b) h['content-type']='application/json'; if(tok()) h.authorization='Bearer '+tok();
  let r; try{ r=await fetch(API+p,{method:m,headers:h,body:b?JSON.stringify(b):undefined,cache:'no-store'}); }
  catch(e){ const er=new Error('Нет связи с сервером. Проверь интернет и попробуй ещё раз.'); er.net=true; throw er; }
  const j=await r.json().catch(()=>({}));
  if(!r.ok){ if(r.status===401) LS.set('lk_tok',null); const e=new Error(j.error||('Ошибка '+r.status)); e.status=r.status; throw e; }
  return j; }

/* ── фото: сжать до ~1400 px и < 200 КБ ── */
function shrink(file){ return new Promise((ok,no)=>{ if(!/^image\//.test(file.type||'')) return no(new Error('Это не картинка'));
  const url=URL.createObjectURL(file), im=new Image();
  im.onload=()=>{ URL.revokeObjectURL(url); let W=im.naturalWidth, H=im.naturalHeight, k=Math.min(1,1400/Math.max(W,H));
    const cv=document.createElement('canvas'), cx=cv.getContext('2d');
    for(let i=0;i<8;i++){ cv.width=Math.max(1,Math.round(W*k)); cv.height=Math.max(1,Math.round(H*k)); cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); cx.drawImage(im,0,0,cv.width,cv.height);
      for(const q of [.8,.68,.56]){ const d=cv.toDataURL('image/jpeg',q); if(d.length<=270*1024) return ok(d); } k*=.78; }
    no(new Error('Фото слишком большое')); };
  im.onerror=()=>{ URL.revokeObjectURL(url); no(new Error('Фото не открылось')); }; im.src=url; }); }
const IMG={};   /* id → data-URL (фото из переписки) */
async function img(id){ if(IMG[id]) return IMG[id]; const j=await req('GET','/api/ask/img?id='+encodeURIComponent(id)); return IMG[id]=j.data; }

/* ── откуда спросили: адрес и заголовок страницы перед переходом на #/ask ── */
const FROM_K='nch2_ask_from';
function rememberFrom(){ const h=location.hash||'#/'; if(/^#\/(ask|live)(\/|$)/.test(h)) return;
  const t=String(document.title||'').replace(/\s*[·—-]\s*Начерт.*$/,'').trim();
  SS.set(FROM_K,JSON.stringify({src:h.slice(0,80),where:t.slice(0,60)})); }
function getFrom(){ try{ return JSON.parse(SS.get(FROM_K)||'null'); }catch(e){ return null; } }
document.addEventListener('click',e=>{ const a=e.target.closest&&e.target.closest('a[href^="#/ask"],a[href="#/live"],[data-ask-go]'); if(a) rememberFrom(); },true);

/* ── черновик (без входа — ждёт входа) ── */
const DRAFT_K='lk_ask_draft';
const draft=()=>{ try{ return JSON.parse(LS.get(DRAFT_K)||'null'); }catch(e){ return null; } };
const saveDraft=d=>{ try{ LS.set(DRAFT_K,d?JSON.stringify(d):null); }catch(e){ if(d&&d.img){ d.img=null; LS.set(DRAFT_K,JSON.stringify(d)); } } };

/* ── стили (токены сайта, светлая и тёмная тема) ── */
const css=document.createElement('style');
css.textContent=`
.ak{max-width:760px;margin:0 auto;padding:18px 16px 64px}
.ak-hero{text-align:center;padding:18px 0 14px}
.ak-hero h1{font:800 clamp(30px,6.4vw,46px)/1.05 var(--disp);margin:0;letter-spacing:-.02em;color:var(--ink)}
.ak-hero h1 span{color:var(--acc)}
.ak-hero p{margin:10px 0 0;color:var(--mut);font-size:16px}
.ak-box{position:relative;background:var(--surf);border:1.5px solid var(--line2);border-radius:22px;padding:14px 14px 12px;box-shadow:0 18px 40px -28px rgba(14,28,51,.45);transition:border-color .15s,box-shadow .15s}
.ak-box:focus-within{border-color:var(--acc);box-shadow:0 0 0 4px color-mix(in srgb,var(--acc) 16%,transparent),0 18px 40px -28px rgba(14,28,51,.45)}
.ak-box textarea{display:block;width:100%;min-height:96px;max-height:46vh;resize:none;border:0;outline:0;background:transparent;color:var(--ink);font:17px/1.5 var(--sans);padding:4px 4px 8px}
.ak-box textarea::placeholder{color:var(--mut2)}
.ak-box.sm textarea{min-height:46px}
.ak-ctx{display:inline-flex;align-items:center;gap:6px;max-width:100%;margin:0 0 8px;padding:5px 6px 5px 11px;border-radius:99px;background:var(--blue-s);color:var(--blue);font:600 13px var(--sans)}
.ak-ctx span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ak-ctx button,.ak-pv button{border:0;background:none;color:inherit;cursor:pointer;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:15px;line-height:1;flex:none}
.ak-ctx button:hover{background:color-mix(in srgb,var(--blue) 14%,transparent)}
.ak-row{display:flex;align-items:center;gap:8px}
.ak-att{display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 14px;border-radius:14px;border:1px solid var(--line2);background:var(--surf2);color:var(--ink2);font:600 14px var(--sans);cursor:pointer}
.ak-att:hover{border-color:var(--acc);color:var(--acc)}
.ak-att input{display:none}
.ak-sp{flex:1}
.ak-send{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 20px;border:0;border-radius:15px;background:var(--acc);color:#fff;font:800 16px var(--sans);cursor:pointer;box-shadow:0 4px 0 color-mix(in srgb,var(--acc) 62%,#000)}
.ak-send:active{transform:translateY(3px);box-shadow:0 1px 0 color-mix(in srgb,var(--acc) 62%,#000)}
.ak-send[disabled]{opacity:.55;cursor:default;transform:none}
.ak-pv{position:relative;display:inline-block;margin:0 0 10px}
.ak-pv img{display:block;max-height:120px;max-width:180px;border-radius:12px;border:1px solid var(--line)}
.ak-pv button{position:absolute;top:-8px;right:-8px;background:var(--ink);color:var(--paper);width:24px;height:24px}
.ak-err{color:var(--red);font-size:14px;margin:8px 4px 0;min-height:0}
.ak-hint{color:var(--mut);font-size:13px;margin:10px 4px 0;text-align:center}
.ak-h2{display:flex;align-items:center;gap:10px;font:800 20px var(--disp);margin:34px 0 12px;color:var(--ink)}
.ak-h2 small{font:600 13px var(--sans);color:var(--mut)}
.ak-list{display:grid;gap:10px}
.ak-it{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;padding:14px 16px;border-radius:18px;background:var(--surf);border:1px solid var(--line);color:var(--ink);text-decoration:none!important;transition:border-color .15s,transform .15s}
.ak-it:hover{border-color:var(--acc);transform:translateY(-1px)}
.ak-it b{font:700 16px/1.3 var(--sans);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ak-it p{grid-column:1/-1;margin:0;color:var(--mut);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ak-it time{color:var(--mut2);font-size:12.5px;white-space:nowrap}
.ak-it.new{border-color:var(--acc);background:linear-gradient(0deg,var(--blue-s),var(--blue-s)),var(--surf)}
.ak-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:99px;font:700 12px var(--sans);background:var(--surf2);color:var(--mut);vertical-align:2px;margin-left:8px}
.ak-pill.new{background:var(--acc);color:#fff}.ak-pill.ok{background:var(--green-s);color:var(--green)}
.ak-pill.new::before{content:'';width:7px;height:7px;border-radius:50%;background:#fff}
.ak-empty{padding:26px 16px;text-align:center;color:var(--mut);border:1.5px dashed var(--line2);border-radius:18px}
.ak-top{display:flex;align-items:center;gap:10px;margin:4px 0 14px}
.ak-back{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 14px 0 10px;border-radius:12px;background:var(--surf2);color:var(--ink2);font:600 14px var(--sans);text-decoration:none!important}
.ak-tt{font:800 clamp(20px,4.4vw,26px)/1.2 var(--disp);margin:0 0 6px;color:var(--ink);overflow-wrap:anywhere}
.ak-src{display:inline-block;margin:0 0 16px;color:var(--blue);font:600 13.5px var(--sans)}
.ak-chat{display:flex;flex-direction:column;gap:10px;margin:0 0 18px}
.ak-m{max-width:min(560px,86%);display:flex;flex-direction:column;gap:4px}
.ak-m.u{align-self:flex-end;align-items:flex-end}
.ak-m.a{align-self:flex-start}
.ak-bb{padding:11px 15px;border-radius:20px;font:16px/1.5 var(--sans);overflow-wrap:anywhere}
.ak-m.u .ak-bb{background:var(--acc);color:#fff;border-bottom-right-radius:6px}
.ak-m.u .ak-bb a{color:#fff;text-decoration:underline}
.ak-m.a .ak-bb{background:var(--surf);border:1px solid var(--line2);color:var(--ink);border-bottom-left-radius:6px}
.ak-who{display:flex;align-items:center;gap:7px;font:700 12.5px var(--sans);color:var(--mut)}
.ak-who i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(150deg,#1f47d6,#e8392b);color:#fff;font:800 11px var(--sans);font-style:normal}
.ak-m time{font-size:12px;color:var(--mut2);padding:0 6px}
.ak-ph{display:block;border:0;padding:0;background:var(--surf2);border-radius:16px;overflow:hidden;cursor:zoom-in;min-width:120px;min-height:80px}
.ak-ph img{display:block;max-width:min(320px,70vw);max-height:300px}
.ak-wait{align-self:center;color:var(--mut);font-size:13.5px;padding:6px 12px;border-radius:99px;background:var(--surf2)}
.ak-lb{position:fixed;inset:0;z-index:9999;background:rgba(5,10,25,.88);display:grid;place-items:center;padding:16px;cursor:zoom-out}
.ak-lb img{max-width:100%;max-height:100%;border-radius:10px;background:#fff}
.ak-gate{margin:14px 0 0;padding:16px;border-radius:18px;background:var(--blue-s);color:var(--ink);text-align:center}
.ak-gate b{display:block;font:800 18px var(--disp);margin-bottom:4px}
.ak-gate p{margin:0 0 12px;color:var(--ink2);font-size:14.5px}
.ak-gate a{display:inline-flex;align-items:center;justify-content:center;height:46px;padding:0 22px;border-radius:15px;background:var(--acc);color:#fff!important;font:800 16px var(--sans);text-decoration:none!important}
/* шапка: «Спросить» */
.akb{position:relative;display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 13px;border-radius:12px;border:1.5px solid var(--acc);color:var(--acc)!important;background:var(--surf);font:800 14px var(--sans);text-decoration:none!important;white-space:nowrap}
.akb:hover{background:var(--blue-s)}
.akb u{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:var(--red);color:#fff;font:800 11.5px/20px var(--sans);text-align:center;text-decoration:none;box-shadow:0 0 0 2px var(--surf)}
@media(max-width:440px){#hdr .hright:has(#akBtn) #theme{display:none}}
@media(max-width:620px){.akb span{display:none}.akb{width:var(--tap,40px);height:var(--tap,40px);padding:0;justify-content:center}}
/* главная: строка «Спроси автора» */
.akh{display:flex;align-items:center;gap:14px;margin:18px 0 0;padding:14px 14px 14px 18px;border-radius:22px;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;text-decoration:none!important;box-shadow:0 22px 44px -30px rgba(20,25,70,.8)}
.akh-t{flex:1;min-width:0}.akh-t b{display:block;font:800 19px/1.2 var(--disp)}.akh-t span{display:block;color:rgba(255,255,255,.8);font-size:14px;margin-top:3px}
.akh-go{flex:none;display:inline-flex;align-items:center;height:44px;padding:0 18px;border-radius:14px;background:#fff;color:var(--navy);font:800 15px var(--sans)}
/* всплывающая карточка «Автор ответил» */
.akt{position:fixed;left:50%;bottom:18px;transform:translate(-50%,20px);opacity:0;z-index:9000;display:flex;align-items:center;gap:12px;width:min(440px,calc(100% - 32px));padding:12px 12px 12px 16px;border-radius:18px;background:var(--surf);border:1.5px solid var(--acc);box-shadow:0 22px 50px -20px rgba(14,28,51,.55);color:var(--ink);transition:.25s;text-decoration:none!important}
.akt.on{transform:translate(-50%,0);opacity:1}
.akt div{flex:1;min-width:0}.akt b{display:block;font:800 15px var(--sans)}.akt span{display:block;color:var(--mut);font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.akt em{flex:none;font-style:normal;height:38px;padding:0 14px;border-radius:12px;background:var(--acc);color:#fff;font:800 14px/38px var(--sans)}
`;
document.head.appendChild(css);

/* ── состояние ── */
const S={threads:null,unread:0,seen:{},poll:0,cur:null,busy:false};
try{ S.seen=JSON.parse(LS.get('nch2_ask_seen')||'{}')||{}; }catch(e){}

/* ── шапка: кнопка «Спросить» и число новых ответов ── */
function header(){ const hr=$('#hdr .hright'); if(!hr) return; let a=$('#akBtn');
  if(!a){ a=document.createElement('a'); a.id='akBtn'; a.className='akb'; a.href='#/ask'; a.title='Спросить автора'; hr.insertBefore(a,hr.firstChild); }
  const n=S.unread; a.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.5"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/></svg><span>Спросить</span>'+(n?'<u>'+n+'</u>':'');
  a.setAttribute('aria-label',n?'Спросить автора — новых ответов: '+n:'Спросить автора'); }

/* ── опрос сервера: новые ответы ── */
async function refresh(quiet){ if(!API||!tok()) { S.threads=tok()?S.threads:null; S.unread=0; header(); return; }
  try{ const j=await req('GET','/api/ask'); const prev=S.threads; S.threads=j.threads; S.unread=j.unread; header();
    /* ответ пришёл, пока ты не на странице вопросов — карточка */
    if(prev&&!/^#\/(ask|live)/.test(location.hash)){ const fresh=j.threads.find(t=>t.unread&&t.last.from==='a'&&!(prev.find(p=>p.id===t.id&&p.unread>=t.unread))); if(fresh) pop(fresh); }
    paintList(); }
  catch(e){ if(e.status===401){ S.threads=null; S.unread=0; header(); paintAll(); } } }
function schedule(){ clearTimeout(S.poll); const fast=S.cur&&!document.hidden; S.poll=setTimeout(async()=>{ if(!document.hidden){ if(S.cur) await loadThread(S.cur,true); else await refresh(true); } schedule(); },fast?15e3:60e3); }
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ if(S.cur) loadThread(S.cur,true); else refresh(true); } schedule(); });
addEventListener('storage',e=>{ if(e.key==='lk_tok'){ refresh(); paintAll(); } });
function pop(t){ let el=$('#akToast'); if(!el){ el=document.createElement('a'); el.id='akToast'; el.className='akt'; document.body.appendChild(el); }
  el.href='#/ask/'+t.id; el.innerHTML='<div><b>Автор ответил</b><span>'+esc(t.last.text||'Фото')+'</span></div><em>Открыть</em>';
  requestAnimationFrame(()=>el.classList.add('on')); clearTimeout(pop.t); pop.t=setTimeout(()=>el.classList.remove('on'),9000);
  el.onclick=()=>el.classList.remove('on'); }

/* ── форма вопроса ── */
function composer(o){ /* o: {sm, ph, ctx, onSend(text,img)} */
  const box=document.createElement('form'); box.className='ak-box'+(o.sm?' sm':''); box.noValidate=true;
  box.innerHTML=(o.ctx?'<div class="ak-ctx" data-ctx><span>Про: '+esc(o.ctx.where||o.ctx.src)+'</span><button type="button" aria-label="Не про эту страницу" title="Не про эту страницу">×</button></div>':'')
    +'<div data-pv></div><label class="sr-only" for="'+(o.id||'akT')+'">'+esc(o.ph)+'</label><textarea id="'+(o.id||'akT')+'" placeholder="'+esc(o.ph)+'" maxlength="3000" rows="'+(o.sm?1:3)+'"></textarea>'
    +'<div class="ak-row"><label class="ak-att" title="Фото чертежа или условия"><input type="file" accept="image/*"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span>Фото</span></label>'
    +'<span class="ak-sp"></span><button class="ak-send" type="submit">'+esc(o.btn||'Отправить')+'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div><div class="ak-err" role="alert"></div>';
  const ta=$('textarea',box), fi=$('input[type=file]',box), pv=$('[data-pv]',box), err=$('.ak-err',box), btn=$('.ak-send',box);
  let pic=o.img||null, ctx=o.ctx||null;
  const grow=()=>{ ta.style.height='auto'; ta.style.height=Math.min(ta.scrollHeight+2,innerHeight*.46)+'px'; };
  const paintPic=()=>{ pv.innerHTML=pic?'<span class="ak-pv"><img alt="Фото к вопросу" src="'+pic+'"><button type="button" aria-label="Убрать фото">×</button></span>':''; const b=$('button',pv); if(b) b.onclick=()=>{ pic=null; paintPic(); }; };
  ta.value=o.text||''; paintPic(); setTimeout(grow,0);
  ta.addEventListener('input',()=>{ grow(); err.textContent=''; if(o.onType) o.onType(ta.value); });
  ta.addEventListener('keydown',e=>{ if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); box.requestSubmit?box.requestSubmit():btn.click(); } });
  fi.addEventListener('change',async()=>{ const f=fi.files&&fi.files[0]; fi.value=''; if(!f) return; err.textContent='Сжимаю фото…';
    try{ pic=await shrink(f); err.textContent=''; paintPic(); }catch(e){ err.textContent=e.message; } });
  const cx=$('[data-ctx] button',box); if(cx) cx.onclick=()=>{ ctx=null; $('[data-ctx]',box).remove(); SS.set(FROM_K,null); };
  box.addEventListener('submit',async e=>{ e.preventDefault(); const text=ta.value.trim(); if(text.length<2&&!pic){ err.textContent='Напиши вопрос — хотя бы пару слов.'; ta.focus(); return; }
    btn.disabled=true; err.textContent='';
    try{ await o.onSend(text,pic,ctx); ta.value=''; pic=null; paintPic(); grow(); }catch(ex){ err.textContent=ex.message; }
    btn.disabled=false; });
  box.focusText=()=>ta.focus({preventScroll:true});
  return box; }

/* ── страница #/ask ── */
function loginUrl(){ return '/lk/#/login'; }
function goLogin(){ LS.set('lk_ret','/'+(location.hash||'#/ask')); location.href=loginUrl(); }
async function send(text,pic,ctx){
  if(!API) throw new Error('Вопросы сейчас недоступны.');
  if(!tok()){ saveDraft({text,img:pic,src:ctx&&ctx.src||'',where:ctx&&ctx.where||'',pending:1}); goLogin(); return; }
  const j=await req('POST','/api/ask',{text,img:pic||undefined,src:ctx&&ctx.src||'',where:ctx&&ctx.where||''});
  SS.set(FROM_K,null); saveDraft(null); S.threads=[j.thread].concat(S.threads||[]); location.hash='#/ask/'+j.thread.id; }

function mountHome(root){
  S.cur=null; const ctx=getFrom(), d=draft();
  root.innerHTML='<div class="ak"><section class="ak-hero"><h1>Спроси — разберём <span>по шагам</span></h1><p>Автор отвечает лично. Можно с фото чертежа.</p></section><div data-c></div><div data-gate></div><div data-list></div></div>';
  const c=composer({ph:'Что не получается?',btn:tok()?'Отправить':'Войти и отправить',ctx:d&&d.src?{src:d.src,where:d.where}:ctx,text:d&&d.text||'',img:d&&d.img||null,id:'akT',onSend:send,
    onType:v=>{ if(!tok()) saveDraft(Object.assign(draft()||{},{text:v,pending:0})); }});
  $('[data-c]',root).appendChild(c);
  paintGate(); paintList();
  if(!/Mobi|Android/i.test(navigator.userAgent)) setTimeout(()=>c.focusText(),50);
  /* вошёл после черновика — отправить сам */
  if(d&&d.pending&&tok()){ saveDraft(Object.assign(d,{pending:0})); $('[data-c] .ak-send',root).click(); }
}
function paintGate(){ const g=$('#view [data-ask-root] [data-gate]'); if(!g) return;
  g.innerHTML=API&&!tok()?'<p class="ak-hint">Чтобы отправить, войди — через Яндекс ID или почту. Ответ придёт сюда.</p>':!API?'<p class="ak-hint">Вопросы сейчас недоступны.</p>':''; }
function paintList(){ const L=$('#view [data-ask-root] [data-list]'); if(!L) return;
  if(!tok()||!S.threads){ L.innerHTML=''; return; }
  if(!S.threads.length){ L.innerHTML=''; return; }
  L.innerHTML='<h2 class="ak-h2">Мои вопросы'+(S.unread?' <small>новых ответов: '+S.unread+'</small>':'')+'</h2><div class="ak-list">'+S.threads.map(t=>{
    const pill=t.unread?'<span class="ak-pill new">Ответ</span>':t.closed?'<span class="ak-pill">Закрыт</span>':t.waiting?'<span class="ak-pill">Ждёт ответа</span>':'<span class="ak-pill ok">Отвечено</span>';
    return '<a class="ak-it'+(t.unread?' new':'')+'" href="#/ask/'+esc(t.id)+'"><b>'+esc(t.title)+'</b><time>'+when(t.updatedAt)+'</time><p>'+(t.last.from==='a'?'Автор: ':'')+esc(t.last.text||'Фото')+pill+'</p></a>'; }).join('')+'</div>'; }

/* ── переписка #/ask/<id> ── */
async function loadThread(id,quiet){ try{ const j=await req('GET','/api/ask/t?id='+encodeURIComponent(id)); if(S.cur!==id) return;
    paintThread(j.thread); const t=(S.threads||[]).find(x=>x.id===id); if(t&&t.unread){ S.unread=Math.max(0,S.unread-t.unread); t.unread=0; header(); } }
  catch(e){ if(quiet) return; const ch=$('#view [data-ask-root] [data-chat]'); if(ch) ch.innerHTML='<div class="ak-empty">'+esc(e.status===404?'Такого вопроса нет.':e.message)+'</div>'; } }
function paintThread(t){ const R=$('#view [data-ask-root]'); if(!R) return;
  $('[data-tt]',R).textContent=t.title; const sr=$('[data-srcl]',R);
  if(t.src){ sr.hidden=false; sr.href=t.src; sr.textContent='Со страницы: '+(t.where||t.src); } else sr.hidden=true;
  const ch=$('[data-chat]',R), n=ch.children.length, atBottom=innerHeight+scrollY>=document.documentElement.scrollHeight-80, sig=t.msgs.map(m=>m.id).join()+'|'+t.closed;
  if(ch.dataset.sig===sig) return; ch.dataset.sig=sig;
  ch.innerHTML=t.msgs.map(m=>'<div class="ak-m '+(m.from==='a'?'a':'u')+'">'+(m.from==='a'?'<span class="ak-who"><i>А</i>Автор</span>':'')
    +(m.img?'<button type="button" class="ak-ph" data-img="'+esc(m.img)+'" aria-label="Открыть фото"></button>':'')
    +(m.text?'<div class="ak-bb">'+rich(m.text)+'</div>':'')+'<time>'+when(m.ts)+'</time></div>').join('')
    +(t.closed?'<div class="ak-wait">Вопрос закрыт. Напиши — и он откроется снова.</div>':t.waiting?'<div class="ak-wait">Автор увидит и ответит здесь</div>':'');
  $$('[data-img]',ch).forEach(async b=>{ try{ const d=await img(b.dataset.img); b.innerHTML='<img alt="Фото" src="'+d+'">'; }catch(e){ b.textContent='Фото не загрузилось'; } });
  if(n===0||atBottom) requestAnimationFrame(()=>{ const c=$('[data-c2]',R); if(c&&n) c.scrollIntoView({block:'end',behavior:'smooth'}); }); }
function mountThread(root,id){ S.cur=id;
  root.innerHTML='<div class="ak"><div class="ak-top"><a class="ak-back" href="#/ask">← Мои вопросы</a></div><h1 class="ak-tt" data-tt>Загружаю…</h1><a class="ak-src" data-srcl hidden></a><div class="ak-chat" data-chat></div><div data-c2></div></div>';
  if(!tok()){ $('[data-tt]',root).textContent='Войди, чтобы открыть переписку'; $('[data-chat]',root).innerHTML='<div class="ak-gate"><b>Нужен вход</b><p>Переписка видна только тебе.</p><a href="'+loginUrl()+'" data-ask-login>Войти</a></div>'; return; }
  $('[data-c2]',root).appendChild(composer({sm:1,ph:'Уточнить…',btn:'Отправить',id:'akT2',onSend:async(text,pic)=>{
    const j=await req('POST','/api/ask/msg',{id,text,img:pic||undefined}); paintThread(j.thread); }}));
  loadThread(id); }

/* ── монтирование на страницах сайта ── */
function lightbox(src){ const d=document.createElement('div'); d.className='ak-lb'; d.innerHTML='<img alt="Фото" src="'+src+'">'; d.onclick=()=>d.remove();
  const k=e=>{ if(e.key==='Escape'){ d.remove(); removeEventListener('keydown',k); } }; addEventListener('keydown',k); document.body.appendChild(d); }
document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('.ak-ph img'); if(b){ e.preventDefault(); lightbox(b.src); return; }
  const l=e.target.closest&&e.target.closest('[data-ask-login]'); if(l){ e.preventDefault(); goLogin(); } });
function paintAll(){ const R=$('#view [data-ask-root]:not([data-m])'); if(R){ R.setAttribute('data-m','1'); const id=R.getAttribute('data-ask-root'); if(id) mountThread(R,id); else mountHome(R); schedule(); }
  const r2=$('#view [data-ask-root][data-m]'); if(!r2) S.cur=null;
  const H=$('#view [data-ask-home]:not([data-m])'); if(H){ H.setAttribute('data-m','1');
    H.innerHTML='<a class="akh" href="#/ask"><span class="akh-t"><b>Застрял? Спроси автора</b><span>Ответ — по шагам, прямо на сайте</span></span><span class="akh-go">Спросить →</span></a>'; }
  header(); }
const view=$('#view'); if(view) new MutationObserver(()=>{ if($('#view [data-ask-root]:not([data-m]),#view [data-ask-home]:not([data-m])')||(!$('#view [data-ask-root]')&&S.cur)) paintAll(); }).observe(view,{childList:true,subtree:true});
/* страница перерисовалась целиком (форма открыта заново) — #/ask без входа: убрать «Мои вопросы» */
const inited=()=>{ paintAll(); refresh(true).then(()=>{ paintGate(); }); schedule(); };
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inited); else inited();
self.ASK={refresh,state:S,_shrink:shrink};
})();
