/* Кольцо тетради (копия /new/): карточки с крупными номерами по кругу в 3D, листаются пальцем с инерцией и доводкой
   к ближайшей, колесом и стрелками. Карточек в DOM — не больше SLOTS (по кругу), номер на карточке меняется, когда она
   за спиной. Передняя карточка открывается касанием, боковая — сначала поворачивается вперёд.
   RING.mount(host, {items:[{n, href, col, sec, done, sub}], start, label}) → {go(i), destroy()} */
(function(){
'use strict';
var SLOTS=14, RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function mod(a,n){return ((a%n)+n)%n;}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

function mount(host,o){
  var items=o.items||[], n=items.length; if(!n){host.innerHTML='';return null;}
  var slots=Math.min(SLOTS,Math.max(n,8)), step=360/slots, pool=[];
  host.classList.add('rg');
  host.innerHTML='<div class="rg-stage" tabindex="0" role="group" aria-roledescription="карусель" aria-label="'+esc(o.label||'Задачи')+': листай влево и вправо">'+
    '<div class="rg-ring"></div></div>'+
    '<div class="rg-cap" aria-live="polite"><span class="rg-sec"></span></div>'+
    '<nav class="rg-sr" aria-label="'+esc(o.label||'Задачи')+' списком">'+items.map(function(it){return '<a href="'+it.href+'">'+esc(it.aria||('№ '+it.n))+'</a>';}).join('')+'</nav>';
  var stage=host.querySelector('.rg-stage'), ring=host.querySelector('.rg-ring'), sec=host.querySelector('.rg-sec');
  for(var k=0;k<slots;k++){var a=document.createElement('a');a.className='rg-c';a.draggable=false;a.tabIndex=-1;
    a.innerHTML='<span class="rg-f"><i class="rg-k"></i><b class="rg-n"></b><em class="rg-d" aria-hidden="true"></em></span><span class="rg-b" aria-hidden="true"></span>';
    ring.appendChild(a);pool.push({el:a,idx:null,f:a.firstChild,b:a.lastChild});}

  var p=o.start||0, vel=0, target=null, raf=0, R=0, cw=0, drag=null, moved=false, lastFront=-1;
  function layout(){var w=stage.clientWidth;cw=Math.max(96,Math.min(190,w*0.29));
    R=cw/2/Math.tan(Math.PI/slots)*1.08;host.style.setProperty('--cw',cw+'px');host.style.setProperty('--R',R+'px');}
  function fill(s,idx){var it=items[mod(idx,n)];s.idx=idx;var e=s.el;
    e.href=it.href;e.setAttribute('aria-label',it.aria||('№ '+it.n));e.dataset.col=it.col||'a';e.classList.toggle('done',!!it.done);
    e.querySelector('.rg-n').textContent=it.n;e.querySelector('.rg-k').textContent=it.sub||'';
    e.querySelector('.rg-d').textContent=it.done?'✓':'';}
  function render(){
    for(var k=0;k<slots;k++){var s=pool[k], idx=k+slots*Math.round((p-k)/slots);   /* ближайший к p номер, равный k по модулю */
      if(n<slots&&n>=8) idx=k+n*Math.round((p-k)/n);
      if(s.idx!==idx) fill(s,idx);
      var ang=(idx-p)*step, c=Math.cos(ang*Math.PI/180), front=Math.abs(idx-p)<0.5;
      s.el.style.transform='rotateY('+ang.toFixed(2)+'deg) translateZ('+R.toFixed(1)+'px)';
      s.el.style.setProperty('--lit',(0.55+0.45*Math.max(0,c)).toFixed(3));
      s.el.style.zIndex=Math.round(100+c*100);
      s.el.classList.toggle('front',front);s.el.tabIndex=front?0:-1;}
    var fi=mod(Math.round(p),n);
    if(fi!==lastFront){lastFront=fi;var it=items[fi];sec.textContent=it.sec||'';host.dataset.cur=fi;
      if(o.onFront) o.onFront(it,fi);
      if(drag||vel) try{window.FX&&FX.buzz&&FX.buzz('tick');}catch(e){}}
  }
  function loop(){raf=0;var dt=1/60;
    if(!drag){
      if(target!=null){var d=target-p;vel+=(d*120-vel*20)*dt;p+=vel*dt;if(Math.abs(d)<0.002&&Math.abs(vel)<0.01){p=target;vel=0;target=null;}}
      else if(Math.abs(vel)>0.02){p+=vel*dt;vel*=0.94;if(Math.abs(vel)<0.9) target=Math.round(p);}
      else if(Math.abs(p-Math.round(p))>0.001) target=Math.round(p);
    }
    render();
    if(drag||target!=null||Math.abs(vel)>0.02) raf=requestAnimationFrame(loop);}
  function kick(){if(!raf) raf=requestAnimationFrame(loop);}
  function go(i,instant){var t=Math.round(p)+((mod(i-Math.round(p),n)+n/2)%n-n/2);   /* короче по кругу */
    t=Math.round(t);if(instant||RM){p=t;vel=0;target=null;render();return;}target=t;kick();}
  function by(d){go(mod(Math.round(target!=null?target:p)+d,n));}

  /* палец и мышь */
  stage.addEventListener('pointerdown',function(e){if(e.button>0) return;drag={x:e.clientX,y:e.clientY,p0:p,t:performance.now(),lx:e.clientX,lt:performance.now(),v:0,id:e.pointerId,on:false};moved=false;target=null;vel=0;});
  stage.addEventListener('pointermove',function(e){if(!drag||e.pointerId!==drag.id) return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.on){if(Math.abs(dx)<6&&Math.abs(dy)<6) return;if(Math.abs(dy)>Math.abs(dx)){drag=null;return;}drag.on=true;moved=true;try{stage.setPointerCapture(e.pointerId);}catch(_){}}
    var per=cw*0.8, now=performance.now();p=drag.p0-dx/per;
    var dtt=Math.max(1,now-drag.lt);drag.v=0.7*drag.v+0.3*(-(e.clientX-drag.lx)/per)/(dtt/1000);drag.lx=e.clientX;drag.lt=now;kick();e.preventDefault();});
  function up(e){if(!drag) return;var d=drag;drag=null;if(d.on){vel=RM?0:Math.max(-40,Math.min(40,d.v));if(!vel) target=Math.round(p);kick();}}
  stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
  stage.addEventListener('click',function(e){var a=e.target.closest('.rg-c');if(moved){e.preventDefault();moved=false;return;}
    if(!a) return;var s=pool.find(function(x){return x.el===a;});if(!s) return;
    if(Math.abs(s.idx-p)>0.5){e.preventDefault();target=s.idx;kick();}});
  stage.addEventListener('wheel',function(e){var d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:(e.shiftKey?e.deltaY:0);if(!d) return;
    e.preventDefault();target=null;p+=d/(cw*0.9);clearTimeout(stage._w);stage._w=setTimeout(function(){target=Math.round(p);kick();},90);kick();},{passive:false});
  stage.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){e.preventDefault();by(1);}else if(e.key==='ArrowLeft'){e.preventDefault();by(-1);}
    else if(e.key==='Enter'){var f=pool.find(function(x){return x.el.classList.contains('front');});if(f){e.preventDefault();location.href=f.el.href;}}});
  var ro=window.ResizeObserver?new ResizeObserver(function(){layout();render();}):null;if(ro) ro.observe(stage);
  layout();
  /* появление: кольцо докручивается до своей карточки */
  if(!RM&&o.intro!==false){p=(o.start||0)-5;render();setTimeout(function(){target=o.start||0;kick();},120);} else {p=o.start||0;render();}
  return {go:go,by:by,get cur(){return mod(Math.round(p),n);},destroy:function(){if(raf) cancelAnimationFrame(raf);if(ro) ro.disconnect();}};
}
window.RING={mount:mount};
})();
