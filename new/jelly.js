/* Желе — тело ИИ-агента (копия /new/). Мягкое тело на canvas: контур из N точек на пружинах вокруг центра.
   Каждая точка тянется к радиусу целевой формы (круг, капля, квадрат, треугольник, прямая, точка), соседи сглаживают волну,
   толчки расходятся по контуру. Глаза следят за пальцем, моргают; настроение меняет прыжок, сплющивание и взгляд.
   JELLY.mount(canvas) → {poke(сила), mood('idle'|'listen'|'think'|'happy'|'sad'), shape(имя), look(x,y), destroy()} */
(function(){
'use strict';
var TAU=Math.PI*2, N=72;
var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* радиус формы по углу (1 — круг); формы звёздные относительно центра, поэтому перетекают друг в друга без разрывов */
var SHAPES={
  blob:function(){return 1;},
  drop:function(a){var s=Math.sin(a);return 1+0.32*Math.pow(Math.max(0,-s),3)-0.06*Math.max(0,s);},   /* вершина капли вверху */
  square:function(a){var c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a)),n=5;return 0.9*Math.pow(Math.pow(c,n)+Math.pow(s,n),-1/n);},
  tri:function(a){var k=TAU/3,b=((a+Math.PI/2)%k+k)%k-k/2;return 0.62/Math.cos(b);},
  line:function(a){var c=Math.cos(a),s=Math.sin(a);return 1/Math.sqrt(c*c/1.9+s*s/0.012);},
  point:function(){return 0.3;},
  plane:function(a){var c=Math.cos(a),s=Math.sin(a),x=c+0.55*s;return 1/Math.sqrt(x*x/1.25+s*s/0.16);}   /* «плоскость»: сплющенный наклонный параллелограмм */
};

function mount(cv,opt){
  opt=opt||{};
  var ctx=cv.getContext('2d'); if(!ctx) return null;
  var r=new Float32Array(N), v=new Float32Array(N), T=new Float32Array(N), tmp=new Float32Array(N);
  for(var i=0;i<N;i++){r[i]=0.2;T[i]=1;}
  var S={shape:'blob',mood:'idle',sx:1,sy:1,vsx:0,vsy:0,y:0,vy:0,lean:0,vlean:0,ex:0,ey:0,tx:0,ty:0,blink:0,nextBlink:1.5,t:0,until:0,mouth:0,
    hue:opt.hue||'blue',talk:0};
  var W=0,H=0,dpr=1,raf=0,last=0,vis=true,dead=false,lookAt=null;

  function size(){var b=cv.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);W=b.width;H=b.height;
    cv.width=Math.max(1,Math.round(W*dpr));cv.height=Math.max(1,Math.round(H*dpr));}
  function target(){var f=SHAPES[S.shape]||SHAPES.blob;for(var i=0;i<N;i++) T[i]=f(i/N*TAU);}
  target();

  /* шаг физики: пружина к форме + натяжение соседей + затухание */
  function step(dt){
    S.t+=dt;
    var k=S.mood==='think'?60:46, ten=S.shape==='line'||S.shape==='point'?30:22, damp=S.mood==='think'?4.2:5.4;
    var breath=1+0.022*Math.sin(S.t*2.1);
    for(var i=0;i<N;i++){var a=r[(i+N-1)%N],b=r[(i+1)%N];
      var wob=0;
      if(!RM){var ang=i/N*TAU;
        wob=0.012*Math.sin(ang*3+S.t*1.7)+0.008*Math.sin(ang*5-S.t*2.3);
        if(S.mood==='think') wob+=0.02*Math.sin(ang*7+S.t*9);
        if(S.mood==='listen') wob+=0.01*Math.sin(ang*4+S.t*6);}
      tmp[i]=k*(T[i]*breath+wob-r[i])+ten*(a+b-2*r[i])-damp*v[i];}
    for(i=0;i<N;i++){v[i]+=tmp[i]*dt;r[i]+=v[i]*dt;}
    /* сплющивание, прыжок, наклон — свои пружины */
    var gsy=S.mood==='sad'?0.84:S.mood==='happy'?1.04:1, gsx=S.mood==='sad'?1.12:1;
    S.vsx+=(70*(gsx-S.sx)-7*S.vsx)*dt;S.sx+=S.vsx*dt;
    S.vsy+=(70*(gsy-S.sy)-7*S.vsy)*dt;S.sy+=S.vsy*dt;
    S.vy+=(-60*S.y-5*S.vy)*dt;S.y+=S.vy*dt;
    if(S.mood==='happy'&&S.y>-0.01&&S.vy>=-0.05&&S.t<S.until){S.vy=-2.6;S.vsy-=3.5;S.vsx+=3;}
    S.vlean+=(40*(S.tlean||0)-6*S.vlean-40*S.lean)*dt;S.lean+=S.vlean*dt;
    if(S.until&&S.t>S.until&&S.mood!=='idle'&&S.mood!=='listen'){S.mood='idle';S.until=0;}
    /* глаза: к пальцу, при «думаю» — вверх, при «грустно» — вниз */
    var gx=0,gy=0;
    if(S.mood==='think'){gx=0.35*Math.sin(S.t*1.6);gy=-0.7;}
    else if(S.mood==='sad'){gx=0;gy=0.6;}
    else if(lookAt){var bb=cv.getBoundingClientRect(),cx=bb.left+bb.width/2,cy=bb.top+bb.height/2,dx=lookAt[0]-cx,dy=lookAt[1]-cy,d=Math.hypot(dx,dy)||1,m=Math.min(1,d/220);gx=dx/d*m;gy=dy/d*m;}
    else if(S.mood==='listen'){gy=0.75;gx=0.1;}
    else {gx=0.3*Math.sin(S.t*0.37);gy=0.15*Math.sin(S.t*0.23);}
    S.ex+=(gx-S.ex)*Math.min(1,dt*9);S.ey+=(gy-S.ey)*Math.min(1,dt*9);
    S.nextBlink-=dt;if(S.nextBlink<=0){S.blink=0.16;S.nextBlink=2.2+Math.random()*3.5;}
    if(S.blink>0) S.blink=Math.max(0,S.blink-dt);
    var gm=S.mood==='happy'?1:S.mood==='sad'?-0.8:S.mood==='think'?-0.1:0.35;S.mouth+=(gm-S.mouth)*Math.min(1,dt*6);
    if(S.talk>0) S.talk=Math.max(0,S.talk-dt);
  }

  var PAL={blue:['#9fd2ff','#3d8bff','#1b47c9','#0d2a8a'],red:['#ffc2b8','#ff6a55','#e0352b','#8c1610'],mint:['#c8fff0','#3fe0b8','#0fa37f','#05604a']};
  function draw(){
    var dark=document.documentElement.getAttribute('data-theme')==='dark';
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    var R=Math.min(W,H)*0.34, cx=W/2, cy=H*0.52+S.y*R*0.5, p=PAL[S.hue]||PAL.blue;
    /* тень на «полу» — меньше, когда желе в прыжке */
    var lift=Math.max(0,-S.y);
    ctx.save();ctx.translate(cx,H*0.52+R*1.06);ctx.scale(1,0.22);
    var sh=ctx.createRadialGradient(0,0,0,0,0,R*1.05);sh.addColorStop(0,dark?'rgba(0,0,0,.55)':'rgba(13,42,138,.28)');sh.addColorStop(1,'rgba(13,42,138,0)');
    ctx.fillStyle=sh;ctx.beginPath();ctx.arc(0,0,R*(1.05-0.35*Math.min(1,lift*2)),0,TAU);ctx.fill();ctx.restore();
    /* контур: точки → сглаженная кривая (Катмулл-Ром) */
    ctx.save();ctx.translate(cx,cy);ctx.rotate(S.lean*0.25);ctx.scale(S.sx,S.sy);
    var P=[];for(var i=0;i<N;i++){var a=i/N*TAU;P.push([Math.cos(a)*r[i]*R,Math.sin(a)*r[i]*R]);}
    function path(){ctx.beginPath();ctx.moveTo((P[0][0]+P[1][0])/2,(P[0][1]+P[1][1])/2);
      for(var i=1;i<=N;i++){var q=P[i%N],n=P[(i+1)%N];ctx.quadraticCurveTo(q[0],q[1],(q[0]+n[0])/2,(q[1]+n[1])/2);}ctx.closePath();}
    path();
    var g=ctx.createRadialGradient(-R*0.35,-R*0.45,R*0.05,0,0,R*1.25);
    g.addColorStop(0,p[0]);g.addColorStop(0.35,p[1]);g.addColorStop(0.8,p[2]);g.addColorStop(1,p[3]);
    ctx.fillStyle=g;ctx.fill();
    /* внутреннее свечение снизу — желе просвечивает */
    ctx.save();path();ctx.clip();
    var gl=ctx.createRadialGradient(R*0.2,R*0.9,0,R*0.2,R*0.9,R*0.9);gl.addColorStop(0,'rgba(255,255,255,.38)');gl.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gl;ctx.fillRect(-R*2,-R*2,R*4,R*4);
    /* блик */
    ctx.globalAlpha=0.85;ctx.fillStyle='rgba(255,255,255,.75)';ctx.beginPath();ctx.ellipse(-R*0.38,-R*0.5,R*0.2,R*0.1,-0.6,0,TAU);ctx.fill();
    ctx.globalAlpha=0.6;ctx.beginPath();ctx.arc(-R*0.1,-R*0.66,R*0.045,0,TAU);ctx.fill();
    ctx.restore();
    ctx.lineWidth=Math.max(1,R*0.018);ctx.strokeStyle='rgba(255,255,255,.35)';path();ctx.stroke();
    ctx.restore();
    /* лицо: прячется, когда желе стало прямой или точкой */
    var face=S.shape==='line'||S.shape==='point'?0:1; if(!face) return;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(S.lean*0.25);ctx.scale(S.sx,S.sy);
    var ex=S.ex*R*0.09, ey=S.ey*R*0.07, eyY=-R*0.06+ey, gap=R*0.27, ew=R*0.105, eh=R*0.14*(S.blink>0?0.12:1)*(S.mood==='happy'?0.9:1);
    for(var s=-1;s<=1;s+=2){var x=s*gap+ex;
      ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x,eyY,ew,eh,0,0,TAU);ctx.fill();
      if(S.blink<=0){ctx.fillStyle='#0b1a4a';ctx.beginPath();ctx.ellipse(x+S.ex*ew*0.38,eyY+S.ey*eh*0.38,ew*0.56,eh*0.56,0,0,TAU);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+S.ex*ew*0.38-ew*0.2,eyY+S.ey*eh*0.38-eh*0.22,ew*0.17,0,TAU);ctx.fill();}}
    /* рот: улыбка ↔ грусть; при ответе — «говорит» */
    var mw=R*0.16, my=R*0.2+ey*0.6, mc=S.mouth*R*0.09, open=S.talk>0?Math.abs(Math.sin(S.t*18))*R*0.06:0;
    ctx.strokeStyle='#0b1a4a';ctx.lineWidth=Math.max(1.5,R*0.045);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(ex-mw,my);ctx.quadraticCurveTo(ex,my+mc+open,ex+mw,my);
    if(open>0.5){ctx.quadraticCurveTo(ex,my-open*0.3,ex-mw,my);ctx.fillStyle='#0b1a4a';ctx.fill();}
    ctx.stroke();
    /* щёки при радости */
    if(S.mouth>0.5){ctx.globalAlpha=(S.mouth-0.5)*0.9;ctx.fillStyle='#ff7aa8';
      ctx.beginPath();ctx.ellipse(-gap-ew*0.5+ex,my-R*0.04,R*0.07,R*0.035,0,0,TAU);ctx.fill();
      ctx.beginPath();ctx.ellipse(gap+ew*0.5+ex,my-R*0.04,R*0.07,R*0.035,0,0,TAU);ctx.fill();ctx.globalAlpha=1;}
    ctx.restore();
  }
  function frame(t){raf=0;if(dead) return;var dt=Math.min(0.033,(t-(last||t))/1000);last=t;
    var n=RM?1:2;for(var i=0;i<n;i++) step(dt/n);draw();if(vis&&!document.hidden) raf=requestAnimationFrame(frame);}
  function kick(){if(!raf&&!dead){last=0;raf=requestAnimationFrame(frame);}}

  /* толчок: волна от точки контура (угол) или по всему телу */
  function poke(f,ang){f=f==null?1:f;
    if(ang==null) ang=Math.random()*TAU;
    for(var i=0;i<N;i++){var d=Math.abs(((i/N*TAU-ang)%TAU+TAU+Math.PI)%TAU-Math.PI);v[i]-=f*2.2*Math.exp(-d*d*3);}
    S.vsy+=f*1.2;S.vsx-=f*0.8;kick();}
  function mood(m,ms){S.mood=m;S.until=ms?S.t+ms/1000:0;if(m==='happy'){S.vy=-2.4;S.vsy-=3;S.talk=0.9;}if(m==='sad'){poke(0.6,-Math.PI/2);}kick();}
  function shape(s){if(!SHAPES[s]) return;S.shape=s;target();poke(0.4);kick();}
  function lean(x){S.tlean=x;}

  size();
  var ro=window.ResizeObserver?new ResizeObserver(function(){size();kick();}):null;if(ro) ro.observe(cv);
  var io=window.IntersectionObserver?new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis) kick();}):null;if(io) io.observe(cv);
  var onMove=function(e){lookAt=[e.clientX,e.clientY];clearTimeout(S.lt);S.lt=setTimeout(function(){lookAt=null;},2500);kick();};
  document.addEventListener('pointermove',onMove,{passive:true});
  var onVis=function(){if(!document.hidden) kick();};document.addEventListener('visibilitychange',onVis);
  /* ткнули — желе дрожит и радуется */
  cv.addEventListener('pointerdown',function(e){var b=cv.getBoundingClientRect(),a=Math.atan2(e.clientY-(b.top+b.height/2),e.clientX-(b.left+b.width/2));
    poke(1.3,a);if(S.mood==='idle') mood('happy',900);try{window.FX&&FX.buzz&&FX.buzz('light');}catch(_){}});
  /* появление: вырастает из точки */
  for(i=0;i<N;i++) r[i]=0.15;poke(0.2);kick();
  return {poke:poke,mood:mood,shape:shape,lean:lean,look:function(x,y){lookAt=x==null?null:[x,y];kick();},talk:function(s){S.talk=s||0.8;kick();},
    get state(){return {mood:S.mood,shape:S.shape};},
    destroy:function(){dead=true;if(raf) cancelAnimationFrame(raf);if(ro) ro.disconnect();if(io) io.disconnect();
      document.removeEventListener('pointermove',onMove);document.removeEventListener('visibilitychange',onVis);}};
}
window.JELLY={mount:mount,shapes:Object.keys(SHAPES)};
})();
