/* ═══ Лука зовёт поиграть — приглашение на главной копии /new/ (docs/TUTOR.md, раздел 2б) ═══
   Через несколько секунд на главной из-за правого края выглядывает пингвин Лука (маскот наставника, lk/mascot.js),
   машет и говорит «Поиграй со мной!». Тап — площадка с Лукой (new/luka/). «✕» — прячется на сутки (localStorage luka_inv_off).
   Главная нового дизайна (#ns) лежит поверх всего (z-index 2147480000): Лука — на том же уровне, но позже в DOM, а пока
   открыт вход или «добавь иконку» (#ns.login, #ns.howon), прячется. Не показывается: не на главной, пока открыто окно согласия на статистику, при «меньше движения» — без выезда. */
(function(){
'use strict';
if(!self.MASCOT||!/^\/new\//.test(location.pathname)) return;
const LS={get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }};
const off=()=>Date.now()-(+LS.get('luka_inv_off')||0)<864e5;
const isHome=()=>{ const h=location.hash; return h===''||h==='#'||h==='#/'; };
const css=document.createElement('style');
css.textContent=`
.lki{position:fixed;right:max(8px,env(safe-area-inset-right,0px));bottom:calc(var(--tabh,0px) + 14px + env(safe-area-inset-bottom,0px));z-index:2147480000;display:flex;align-items:flex-end;gap:2px;transform:translateX(130%);transition:transform .6s cubic-bezier(.2,1.25,.4,1);pointer-events:none}
.lki.on{transform:none}
.lki button.p{pointer-events:auto;width:84px;height:96px;padding:0;border:0;background:none;cursor:pointer;filter:drop-shadow(0 8px 10px rgba(8,11,18,.28))}
.lki button.p i{display:block;width:100%;height:100%}
.lki .b{pointer-events:auto;position:relative;margin-bottom:56px;padding:9px 30px 9px 13px;border-radius:16px;background:#fff;color:#15161a;border:2px solid #15161a;font:700 14.5px/1.3 var(--sans,system-ui);box-shadow:0 10px 24px -14px rgba(0,0,0,.5);cursor:pointer;max-width:200px;opacity:0;transition:opacity .25s}
.lki .b.on{opacity:1}
.lki .b::after{content:"";position:absolute;right:-8px;bottom:14px;width:13px;height:13px;background:#fff;border-right:2px solid #15161a;border-top:2px solid #15161a;transform:rotate(45deg)}
.lki .b small{display:block;font:600 12px var(--sans,system-ui);color:#5c606b;margin-top:2px}
.lki .x{position:absolute;top:4px;right:6px;width:22px;height:22px;border:0;background:none;color:#15161a;opacity:.55;font:700 14px system-ui;cursor:pointer}
body:has(.ckn) .lki,body:has(.tu:not([hidden])) .lki,body:has(#ns.login) .lki,body:has(#ns.howon) .lki{display:none}
@media (prefers-reduced-motion: reduce){.lki{transition:none}}`;
document.head.appendChild(css);
const box=document.createElement('div'); box.className='lki'; box.setAttribute('role','complementary'); box.setAttribute('aria-label','Лука зовёт поиграть');
box.innerHTML='<div class="b" data-go>Поиграй со мной!<small>Тыкай, гладь, корми рыбкой</small><button type="button" class="x" aria-label="Не сейчас">✕</button></div><button type="button" class="p" data-go aria-label="Поиграть с Лукой"><i></i></button>';
const bub=box.querySelector('.b'); let av=null, shown=false, tick=0, bubT=0;
const url=location.pathname.replace(/\/new\/.*$/,'/new/')+'luka/';
function mount(){ if(box.isConnected) return; document.body.appendChild(box); av=MASCOT.avatar(box.querySelector('.p i'),{full:true,sleepAfter:120000}); }
function show(){ if(shown||off()||!isHome()) return; mount(); shown=true; requestAnimationFrame(()=>box.classList.add('on'));
  setTimeout(()=>{ if(!shown) return; av&&av.play('hello'); bub.classList.add('on'); clearTimeout(bubT); bubT=setTimeout(()=>bub.classList.remove('on'),7000); },650);
  clearInterval(tick); tick=setInterval(()=>{ if(!shown||!av||document.hidden) return; const r=Math.random();
    if(r<.4){ av.play('hello'); bub.classList.add('on'); clearTimeout(bubT); bubT=setTimeout(()=>bub.classList.remove('on'),4500); } else if(r<.7) av.play('giggle'); },22000); }
function hide(){ shown=false; box.classList.remove('on'); bub.classList.remove('on'); clearInterval(tick); }
box.addEventListener('click',e=>{ if(e.target.closest('.x')){ e.stopPropagation(); LS.set('luka_inv_off',String(Date.now())); av&&av.play('sad'); setTimeout(hide,500); return; }
  if(e.target.closest('[data-go]')){ av&&av.play('giggle'); setTimeout(()=>{ location.href=url; },380); } });
let t0=0; const route=()=>{ clearTimeout(t0); if(isHome()) t0=setTimeout(show,3500); else hide(); };
addEventListener('hashchange',route);
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',route); else route();
self.LUKA_INVITE={show,hide,state:()=>({shown,off:off()})};
})();
