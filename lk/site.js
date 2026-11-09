/* ═══ Сайт ↔ кабинет: персонализация основного сайта ═══
   Подключается в index.html сайта (после lk/lib/calendar.js). Работает только у тех, кто уже настроил кабинет
   (lk_profile.onb) — остальные видят сайт как раньше, ссылок на кабинет для них нет.
   Что делает:
     • шапка — значок кабинета с ближайшим сроком («ДЗ 3 · 22 дн»);
     • главная — личная плашка над карточками: имя, группа, вариант, ближайшее ДЗ/РК группы, «Мой вариант», «Сдал», «Кабинет»;
     • отметка «Сдал» пишется в lk_done — кабинет видит её сразу (тот же домен, а после входа — и на других устройствах). */
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
function nearest(){ const t=today(), D=J('lk_done',{})||{}, ev=events().filter(e=>e.kind!=='m'&&!isDone(e,D)&&e.day>=t);
  const dz=ev.find(e=>e.kind==='dz'), rk=ev.find(e=>e.kind==='rk'), hk=localStorage.getItem('lk_hotk');
  return (hk==='rk'?rk||dz:hk==='dz'?dz||rk:dz&&(!rk||dz.day<=rk.day)?dz:rk)||null; }
const lbl=e=>(e.kind==='dz'?'ДЗ ':'РК ')+e.n;
function linkOf(e){ if(e.kind==='rk') return PREP1[e.subj]; if(SITE_DZ[e.subj].indexOf(e.n)<0) return '/#/dz'; return '/#/'+(e.subj==='ikg'?'ig':'ng')+e.n+(variant()?'/'+variant():''); }
const initials=()=>P.name?String(P.name).trim().charAt(0).toUpperCase():(String(P.group||'').replace(/[^А-ЯA-Z]/g,'').slice(0,2)||'Я');

/* ── стили (токены сайта) ── */
const css=document.createElement('style');
css.textContent=`
.lkme{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 10px 0 4px;border-radius:18px;background:var(--surf);border:1px solid var(--line);color:var(--ink);text-decoration:none!important;font:700 13px var(--sans);white-space:nowrap}
.lkme i{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(150deg,#1f47d6,#4f8cff);color:#fff;font:800 13px var(--sans);font-style:normal}
.lkme b{font-weight:800}.lkme.hot b{color:var(--red)}
@media(max-width:620px){.lkme span{display:none}.lkme{padding:0 4px}}
.lkp{position:relative;overflow:hidden;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;margin:0 0 16px;padding:16px 18px;border-radius:24px;color:#fff;
  background:linear-gradient(140deg,#0c1f47 0%,#1a3a7c 55%,#2b5cc0 100%);box-shadow:0 22px 40px -26px rgba(12,31,71,.7)}
.lkp.hot{background:linear-gradient(140deg,#c4121d 0%,#e3242f 50%,#ff5a2a 100%)}.lkp.warm{background:linear-gradient(140deg,#a8361a 0%,#e0631f 55%,#f59a23 100%)}.lkp.ok{background:linear-gradient(145deg,#0b7a4b,#13a266 60%,#3fd08d)}
.lkp::before{content:"";position:absolute;inset:0;z-index:-1;background-image:linear-gradient(rgba(255,255,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.09) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:linear-gradient(115deg,#000 10%,transparent 70%);mask-image:linear-gradient(115deg,#000 10%,transparent 70%)}
.lkp-who{display:flex;align-items:center;gap:8px;font:700 12px var(--sans);letter-spacing:.06em;text-transform:uppercase;opacity:.9;margin-bottom:6px}
.lkp-who i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.22);font-style:normal;font-size:11px}
.lkp-t{font:800 26px/1.05 var(--disp,var(--sans));letter-spacing:-.02em}
.lkp-t small{font:600 15px var(--sans);letter-spacing:0;opacity:.9}
.lkp-s{font:600 14px/1.35 var(--sans);opacity:.92;margin-top:4px}
.lkp-c{text-align:right}.lkp-c b{display:block;font:800 52px/.9 var(--disp,var(--sans));letter-spacing:-.04em}.lkp-c span{font:600 13px var(--sans);opacity:.9}
.lkp-a{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}
.lkp-a a,.lkp-a button{display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:0 16px;border-radius:14px;font:800 14.5px var(--sans);text-decoration:none!important;cursor:pointer;border:0}
.lkp-a .w{background:#fff;color:#0a1636!important;box-shadow:0 3px 0 rgba(0,0,0,.2)}
.lkp-a .g{background:rgba(255,255,255,.18);color:#fff!important;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.3)}
.lkp-a .l{margin-left:auto;background:none;color:#fff!important;padding:0 4px;text-decoration:underline!important;text-underline-offset:3px;font-weight:700}
@media(max-width:520px){.lkp{padding:14px}.lkp-t{font-size:22px}.lkp-c b{font-size:42px}.lkp-a .l{margin-left:0}}
`;
document.head.appendChild(css);

/* ── шапка: значок кабинета ── */
function header(){ const hr=document.querySelector('#hdr .hright'); if(!hr) return; let a=document.getElementById('lkMe');
  if(!a){ a=document.createElement('a'); a.id='lkMe'; a.className='lkme'; a.href=LK; hr.insertBefore(a,hr.firstChild); }
  const e=nearest(), d=e?e.day-today():0;
  a.classList.toggle('hot',!!e&&d<=3); a.title='Личный кабинет'+(e?': '+lbl(e)+' · '+SUBJ[e.subj]+' — '+inWords(d):'');
  a.innerHTML='<i>'+esc(initials())+'</i><span>'+(e?'<b>'+lbl(e)+'</b> · '+(d===0?'сегодня':d===1?'завтра':d+' дн'):'Кабинет')+'</span>'; }

/* ── главная: личная плашка ── */
function card(){ const t=today(), e=nearest(), v=variant(), who=[P.name,P.group,v?'вариант '+v:''].filter(Boolean).map(esc).join(' · ');
  if(!e) return '<section class="lkp ok" id="lkp" aria-label="Мой кабинет"><div><div class="lkp-who"><i>'+esc(initials())+'</i>'+(who||'Мой кабинет')+'</div><div class="lkp-t">Всё сдано</div><div class="lkp-s">Несданного в семестре нет — можно повторить темы.</div></div><div></div>'
    +'<div class="lkp-a"><a class="w" href="/#/ng/learn">Тренировка дня →</a><a class="l" href="'+LK+'">Кабинет</a></div></section>';
  const d=e.day-t, hz=d<=3?'hot':d<=7?'warm':'', dz=e.kind==='dz', mine=dz&&v&&SITE_DZ[e.subj].indexOf(e.n)>=0;
  return '<section class="lkp '+hz+'" id="lkp" aria-label="Ближайший срок: '+lbl(e)+' '+SUBJF[e.subj]+'">'
    +'<div><div class="lkp-who"><i>'+esc(initials())+'</i>'+(who||'Мой кабинет')+'</div>'
    +'<div class="lkp-t">'+lbl(e)+' <small>· '+SUBJF[e.subj]+'</small></div>'
    +'<div class="lkp-s">'+(dz?'Сдать':'Написать')+' '+human(e.day)+(e.time?' до '+esc(e.time.replace(/^0/,'')):'')+(mine?' · твой вариант '+v:'')+'</div></div>'
    +'<div class="lkp-c">'+(d>=2?'<b>'+d+'</b><span>'+plural(d,'день','дня','дней')+'</span>':'<b style="font-size:30px">'+(d===1?'Завтра':'Сегодня')+'</b>')+'</div>'
    +'<div class="lkp-a"><a class="w" href="'+linkOf(e)+'">'+(mine?'Мой вариант':dz?'Разбор':'Готовиться')+' →</a>'
    +'<button type="button" class="g" data-lkdone="'+e.id+'">✓ '+(dz?'Сдал':'Написал')+'</button>'
    +'<a class="l" href="'+LK+'">Все сроки в кабинете</a></div></section>'; }
function home(){ const h=document.getElementById('v8h'); if(!h) return; const old=document.getElementById('lkp'), html=card();
  if(old){ if(old.outerHTML!==html) old.outerHTML=html; return; }
  const at=document.getElementById('rkHome')||h.firstChild; at.insertAdjacentHTML('beforebegin',html); }

function render(){ P=J('lk_profile',P)||P; try{ header(); home(); }catch(e){} }
document.addEventListener('click',ev=>{ const b=ev.target.closest('[data-lkdone]'); if(!b) return;
  const D=J('lk_done',{})||{}; D[b.getAttribute('data-lkdone')]=Date.now(); try{ localStorage.setItem('lk_done',JSON.stringify(D)); }catch(e){} render(); });
/* сайт перерисовывает страницу при каждом переходе — после перерисовки вернуть плашку */
let q=0; const view=document.getElementById('view');
if(view) new MutationObserver(()=>{ if(!document.getElementById('lkp')&&document.getElementById('v8h')){ cancelAnimationFrame(q); q=requestAnimationFrame(home); } }).observe(view,{childList:true});
addEventListener('storage',e=>{ if(/^(lk_done|lk_profile|lk_hotk|nch2_dzvar)$/.test(e.key||'')) render(); });
render();
if(P.group) fetch('/lk/data/groups.json').then(r=>r.json()).then(j=>{ G=j.groups&&j.groups[P.group]||null; render(); }).catch(()=>{});
})();
