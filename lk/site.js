/* ═══ Сайт ↔ кабинет: персонализация основного сайта ═══
   Подключается в index.html сайта (после lk/lib/calendar.js). Работает только у тех, кто уже настроил кабинет
   (lk_profile.onb) — остальные видят сайт как раньше, ссылок на кабинет для них нет.
   Что делает:
     • шапка — значок «Кабинет»;
     • главная — две карточки как были: слева РК (карточка сайта), справа вместо фичи — своё ближайшее ДЗ с днями до срока
       по паре группы и «Мой вариант»; срока не знаем (нет группы, всё сдано) — справа остаётся фича. Сданное — из lk_done. */
(function(){
'use strict';
const J=(k,d)=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'null'); return v==null?d:v; }catch(e){ return d; } };
let P=J('lk_profile',null);
if(!P||!P.onb||!self.LKCAL) return;
const CAL=self.LKCAL, LK='/lk/', DAYMS=864e5;
const SUBJ={ikg:'ИКГ',ng:'Начерт'}, SUBJF={ikg:'Инженерная графика',ng:'Начертательная геометрия'};
const SITE_DZ={ng:[1,2,3,4,5],ikg:[2,3,4]}, PREP1={ng:'/#/ng/cheat',ikg:'/#/ig/learn'};
const MON=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'], WDN=['вс','пн','вт','ср','чт','пт','сб'];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const plural=(n,a,b,c)=>{ const m=n%10,h=n%100; return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c; };
const today=()=>{ const x=new Date(); return Math.round(Date.UTC(x.getFullYear(),x.getMonth(),x.getDate())/DAYMS); };
const human=d=>{ const x=new Date(d*DAYMS); return WDN[x.getUTCDay()]+', '+x.getUTCDate()+' '+MON[x.getUTCMonth()]; };
const inWords=k=>k===0?'сегодня':k===1?'завтра':k===2?'послезавтра':'через '+k+' '+plural(k,'день','дня','дней');
let G=null;   /* занятия группы из lk/data/groups.json */
const variant=()=>{ const v=+J('lk_profile',{}).variant||+J('nch2_dzvar',0)||0; return v>=1&&v<=30?v:0; };

function events(){ const g=G||{}, subs=['ikg','ng'].filter(k=>!G||g[k]);
  return CAL.events({group:{ikg:g.ikg,ng:g.ng},subjects:subs},CAL.DEFAULT_WEEK1).map(e=>Object.assign(e,{time:g[e.subj]&&g[e.subj].time||''})); }
function isDone(e,D){ return e.kind==='m'?!!(D[e.subj+'-dz'+e.n]&&D[e.subj+'-rk'+e.n]):!!D[e.id]; }
const lbl=e=>(e.kind==='dz'?'ДЗ ':'РК ')+e.n;
function linkOf(e){ if(e.kind==='rk') return PREP1[e.subj]; if(SITE_DZ[e.subj].indexOf(e.n)<0) return '/#/dz'; return '/#/'+(e.subj==='ikg'?'ig':'ng')+e.n+(variant()?'/'+variant():''); }
const initials=()=>P.name?String(P.name).trim().charAt(0).toUpperCase():(String(P.group||'').replace(/[^А-ЯA-Z]/g,'').slice(0,2)||'Я');

/* ── стили (токены сайта) ── */
const css=document.createElement('style');
css.textContent=`
.lkme{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 10px 0 4px;border-radius:18px;background:var(--surf);border:1px solid var(--line);color:var(--ink);text-decoration:none!important;font:700 13px var(--sans);white-space:nowrap}
.lkme i{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(150deg,#1f47d6,#4f8cff);color:#fff;font:800 13px var(--sans);font-style:normal}
@media(max-width:620px){.lkme span{display:none}.lkme{padding:0 4px}}
`;
document.head.appendChild(css);

/* ── шапка: значок кабинета ── */
function header(){ const hr=document.querySelector('#hdr .hright'); if(!hr) return; let a=document.getElementById('lkMe');
  if(!a){ a=document.createElement('a'); a.id='lkMe'; a.className='lkme'; a.href=LK; hr.insertBefore(a,hr.firstChild); }
  a.title='Личный кабинет'; a.innerHTML='<i>'+esc(initials())+'</i><span>Кабинет</span>'; }

/* ── главная: справа вместо фичи — своё ДЗ, если срок известен по группе ── */
function dzCard(){ const t=today(), D=J('lk_done',{})||{};
  if(!G) return '';   /* без группы срок ДЗ не знаем — остаётся фича */
  const e=events().find(x=>x.kind==='dz'&&!isDone(x,D)&&x.day>=t); if(!e) return '';
  const d=e.day-t, v=variant(), mine=v&&SITE_DZ[e.subj].indexOf(e.n)>=0, heat=d<=3?'rkh-hot':d<=7?'rkh-warm':'hc-3d';
  const pill=d<=3?'<span class="hc-pill live"><i></i>Горит</span>':d<=7?'<span class="hc-pill"><i></i>Скоро</span>':'<span class="hc-pill"><i></i>Моё ДЗ</span>';
  const cnt=d>=2?'<span class="hc-cnt"><b>'+d+'</b><small>'+plural(d,'день','дня','дней')+' до '+human(e.day)+'</small></span>':'<span class="hc-cnt word"><b>'+(d===1?'Завтра':'Сегодня')+'</b><small>'+human(e.day)+(e.time?' до '+esc(e.time.replace(/^0/,'')):'')+'</small></span>';
  return '<a class="hc hc-rk '+heat+'" id="lkDz" href="'+linkOf(e)+'" aria-label="'+lbl(e)+' по '+(e.subj==='ikg'?'инженерной графике':'начерту')+': '+inWords(d)+'">'
    +pill+'<span class="hc-t">ДЗ '+e.n+'</span><span class="hc-s">'+SUBJF[e.subj]+(mine?' · вариант '+v:'')+'</span>'+cnt
    +'<span class="hc-go">'+(mine?'Мой вариант':'Разбор')+' →</span></a>'; }
function home(){ const box=document.getElementById('rkHome'); if(!box) return; const html=dzCard(), cur=document.getElementById('lkDz');
  if(!html){ if(cur&&FEAT) cur.outerHTML=FEAT; return; }
  if(cur){ if(cur.outerHTML!==html) cur.outerHTML=html; return; }
  const f=box.querySelector('.hc-3d:not(#lkDz)'); if(!f) return; FEAT=f.outerHTML; f.outerHTML=html; }
let FEAT='';

function render(){ P=J('lk_profile',P)||P; try{ header(); home(); }catch(e){} }
/* сайт перерисовывает страницу при каждом переходе — после перерисовки вернуть плашку */
let q=0; const view=document.getElementById('view');
if(view) new MutationObserver(()=>{ if(!document.getElementById('lkDz')&&document.getElementById('rkHome')){ cancelAnimationFrame(q); q=requestAnimationFrame(home); } }).observe(view,{childList:true});
addEventListener('storage',e=>{ if(/^(lk_done|lk_profile|lk_hotk|nch2_dzvar)$/.test(e.key||'')) render(); });
render();
if(P.group) fetch('/lk/data/groups.json').then(r=>r.json()).then(j=>{ G=j.groups&&j.groups[P.group]||null; render(); }).catch(()=>{});
})();
