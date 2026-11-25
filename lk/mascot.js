/* ═══ Лука — маскот наставника (docs/TUTOR.md, раздел 2а) ═══
   Рисунок кодом: SVG + один общий requestAnimationFrame, без библиотек и картинок. Пингвин Лука в шарфе (утверждён 23.11.2026):
   ходит вперевалку, лицо поворачивается за взглядом, хохолок и шарф качаются от движения, обводит точку карандашом в ласте.
   «Мозг» (Base) — состояния, выражения, ходьба, прыжки, моргание, взгляд, частицы; персонаж (Penguin) — рисунок и позы.
   Наряд — scarf (по умолчанию) · helmet · glasses: self.MASCOT_OUTFIT или {outfit}.

   self.MASCOT:
     avatar(host,{sleepAfter,full,char,outfit}) → живая аватарка (full — во весь рост) во всю площадь host (кнопка наставника, шапка окна, плашка на чертеже):
                                  m.play(state[,ms]) · m.talk(ms) · m.idle() · m.state · m.onPoke
                                  состояния: idle hello think study talk point oops happy giggle sad sleep
     tour(box,getTargets,{mood}) → маскот выходит на чертёж (box — контейнер чертежа), по очереди подходит к точкам,
                                  обводит каждую окружностью и показывает на последнюю, потом отходит в угол;
                                  уже стоит на этом чертеже — идёт к новым точкам с места.
                                  getTargets() → [{x,y,r}] в пикселях от левого верхнего угла box; вызывается снова
                                  при изменении размера. mood:'oops' — сначала пугается (на фото нашлась ошибка).
     untour(instant)            → уходит с чертежа (машет и уходит за край), окружности гаснут.
     stage(host,{scale,x,y})    → свободный маскот на большой сцене (игровые страницы): {m,svg,fx,act,over,resize()}
     pose(name,{выражение},{dur,jump,over}) → своё состояние для play(name) (щекотка, «буп», волчок…);
                                  m.amp — рот по громкости, m.turn — поворот вокруг себя, выражения cross (глаза в кучку), squint (> <)
     state()                    → для тестов: {avatars, tour:{targets, rings, done, state}|null}
   Учитывает prefers-reduced-motion: без ходьбы и прыжков, окружности появляются сразу. */
(function(){
'use strict';
if(self.MASCOT) return;
const NS='http://www.w3.org/2000/svg', INK='#1d2233', D2R=Math.PI/180;
const mq=(()=>{ try{ return matchMedia('(prefers-reduced-motion: reduce)'); }catch(e){ return null; } })();
const reduced=()=>!!(mq&&mq.matches);
const amp=()=>reduced()?.3:1;
let uid=0;
function el(tag,attrs,parent){ const e=document.createElementNS(NS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const f2=v=>(Math.round(v*100)/100).toString();
class Cancel extends Error{}

/* ── стили ── */
const css=document.createElement('style');
css.textContent=`
.mc-av{display:block;width:100%;height:100%;overflow:hidden}
.mc-tour{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:hidden;border-radius:inherit;transition:opacity .35s}
.mc-tour.out{opacity:0}
.mc-tour>svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden}
.mc-tour .mc-body{pointer-events:auto;cursor:pointer}
.mc-ring{fill:none;stroke:#e5484d;stroke-width:2.4;stroke-linecap:round;filter:drop-shadow(0 0 3px rgba(229,72,77,.35))}
.mc-tour .mc-hit{fill:transparent;pointer-events:all;cursor:pointer}
.mc-bub{position:absolute;left:0;top:0;z-index:2;max-width:min(280px,76%);display:grid;grid-template-columns:1fr auto;gap:6px 8px;align-items:start;padding:11px 8px 11px 14px;border-radius:18px;background:#fff;color:#15161a;box-shadow:0 18px 40px -16px rgba(8,10,20,.45),0 0 0 1px rgba(8,10,20,.06);font:500 14px/1.45 var(--sans,'Golos Text',system-ui,-apple-system,'Segoe UI',sans-serif);pointer-events:auto;opacity:0;transition:opacity .25s;will-change:transform}
.mc-bub.on{opacity:1;animation:mcIn .45s cubic-bezier(.2,.9,.25,1.2) both}
@keyframes mcIn{from{opacity:0;scale:.9}to{opacity:1;scale:1}}
.mc-bub::after{content:"";position:absolute;left:var(--tx,24px);bottom:-6px;width:12px;height:12px;margin-left:-6px;background:#fff;border-radius:0 0 3px 0;box-shadow:3px 3px 6px -3px rgba(8,10,20,.18);transform:rotate(45deg)}
.mc-bub.b::after{bottom:auto;top:-6px;transform:rotate(225deg)}
.mc-bub .mc-x{display:grid;place-items:center;width:24px;height:24px;margin:-3px 0 0;border:0;border-radius:50%;background:none;color:#8a8d98;cursor:pointer;transition:background .2s,color .2s}
.mc-bub .mc-x:hover{background:#f0f1f4;color:#15161a}
.mc-bub .mc-acts{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.mc-bub .mc-acts button{height:34px;padding:0 14px;border-radius:12px;border:0;background:#111113;color:#fff;font:600 13px var(--sans,system-ui);cursor:pointer;transition:transform .2s}
.mc-bub .mc-acts button:active{transform:scale(.96)}
.mc-bub .mc-acts button+button{background:#f0f1f4;color:#15161a}
.mc-dot{fill:var(--mc-ink,${INK})}
.mc-tour .mc-dot,.mc-tour .mc-z{paint-order:stroke;stroke:#fff;stroke-width:2.5px}
.mc-z{fill:var(--mc-ink,${INK});font:800 13px system-ui,sans-serif}
`;
(document.head||document.documentElement).appendChild(css);

/* ── лицо ── */
function makeFace(parent,o){
  const g=el('g',null,parent);
  const cheeks=[-1,1].map(s=>el('ellipse',{cx:s*o.cheekX,cy:o.cheekY,rx:o.er*.78,ry:o.er*.48,fill:'#ff6f8b',opacity:0},g));
  const eyes=[-1,1].map(s=>{ const eg=el('g',null,g), open=el('g',null,eg);
    el('ellipse',{rx:o.er*.84,ry:o.er,fill:'#fff',stroke:INK,'stroke-width':1.7},open);
    const pupil=el('g',null,open);
    el('ellipse',{rx:o.er*.5,ry:o.er*.57,fill:INK},pupil);
    el('circle',{cx:o.er*.17,cy:-o.er*.25,r:o.er*.2,fill:'#fff'},pupil);
    const closed=el('path',{fill:'none',stroke:INK,'stroke-width':2.3,'stroke-linecap':'round'},eg);
    return {s,eg,open,pupil,closed}; });
  const brows=[-1,1].map(s=>({s,p:el('path',{d:`M${-o.er*.62} 0Q0 ${-o.er*.32} ${o.er*.62} 0`,fill:'none',stroke:INK,'stroke-width':2,'stroke-linecap':'round'},g)}));
  const mouth=o.beak?null:el('path',{fill:'#7b2333',stroke:INK,'stroke-width':1.9,'stroke-linejoin':'round','stroke-linecap':'round'},g);
  return R=>{ const lid=clamp(R.lid,0,1), sq=R.squint>.5, shut=R.happy>.5||lid>.82||sq, r=o.er*.75;
    for(const e of eyes){
      e.eg.setAttribute('transform',`translate(${e.s*o.ex} ${o.ey}) scale(${f2(R.eye)})`);
      e.open.setAttribute('transform',`scale(1 ${f2(Math.max(.08,1-lid))})`);
      e.open.style.opacity=shut?0:1; e.closed.style.opacity=shut?1:0;
      e.closed.setAttribute('d',sq?(e.s<0?`M${-r} ${-r*.6}L${r*.55} 0L${-r} ${r*.6}`:`M${r} ${-r*.6}L${-r*.55} 0L${r} ${r*.6}`):R.happy>.5?`M${-r} ${r*.4}Q0 ${-r*1.1} ${r} ${r*.4}`:`M${-r} 0Q0 ${r*.7} ${r} 0`);
      e.pupil.setAttribute('transform',`translate(${f2(R.lx*o.er*.32-e.s*(R.cross||0)*o.er*.34)} ${f2(R.ly*o.er*.36+(R.cross||0)*o.er*.12)})`); }
    for(const b of brows) b.p.setAttribute('transform',`translate(${b.s*o.ex} ${f2(o.ey-o.er*R.eye-4-R.brow*3)}) rotate(${f2(b.s*R.worry*18)})`);
    for(const c of cheeks) c.setAttribute('opacity',f2(clamp(R.blush,0,1)*.55));
    if(!mouth) return;
    const op=clamp(R.mouth,0,1), s=R.smile, w=o.mw*(1-op*.22), cy=o.my-s*w*.22, d=s*w*.55;
    mouth.setAttribute('d',`M${f2(-w)} ${f2(cy)}Q0 ${f2(cy+d*.45)} ${f2(w)} ${f2(cy)}Q0 ${f2(cy+d+op*w*1.35)} ${f2(-w)} ${f2(cy)}Z`); };
}
/* руки: угол 0 — вниз, плюс — наружу от тела */
function makeArm(parent){
  const p=el('path',{fill:'none',stroke:INK,'stroke-width':2.7,'stroke-linecap':'round'},parent);
  const h=el('circle',{r:3.7,fill:'#fff',stroke:INK,'stroke-width':1.6},parent);
  return (sx,sy,a,len,side)=>{ const ex=sx+side*Math.sin(a*D2R)*len, ey=sy+Math.cos(a*D2R)*len, mx=(sx+ex)/2, my=(sy+ey)/2;
    const dx=ex-sx, dy=ey-sy, L=Math.hypot(dx,dy)||1;
    p.setAttribute('d',`M${sx} ${sy}Q${f2(mx-dy/L*3*side)} ${f2(my+dx/L*3*side)} ${f2(ex)} ${f2(ey)}`); h.setAttribute('cx',f2(ex)); h.setAttribute('cy',f2(ey)); };
}

/* ── выражения по состояниям ── */
const POSE={
  hello:{smile:1,mouth:.3,brow:.6,armR:150,blush:.6},
  think:{smile:-.05,mouth:.05,brow:.8,worry:.35,tilt:-6,armR:160,armL:18},
  study:{smile:.1,brow:.4,worry:.2,tilt:5,armR:150,armL:20},
  talk:{smile:.55,brow:.3,armR:45},
  point:{smile:.65,brow:.5,tilt:-4,armR:18,blush:.45},
  draw:{smile:.25,brow:-.2,worry:-.35,armL:35,armR:22},
  oops:{smile:-.7,mouth:.62,brow:.9,worry:1,eye:1.28,armL:72,armR:72,blush:0},
  happy:{smile:1,mouth:.55,happy:1,armL:155,armR:155,blush:.9,brow:.6},
  giggle:{smile:1,mouth:.35,happy:1,blush:1,armL:42,armR:42,tilt:5},
  sad:{smile:-.55,brow:.15,worry:.85,tilt:4,armL:6,armR:6,lid:.22,blush:0},
  sleep:{lid:1,smile:.15,tilt:7,armL:4,armR:4,blush:.45,brow:-.2}
};
const BASE={lid:0,mouth:0,smile:.35,brow:0,worry:0,tilt:0,armL:12,armR:12,blush:.3,eye:1,happy:0,cross:0,squint:0};
const OVER={};   /* накладки своих состояний (MASCOT.pose): (R,t,m)=>void */
const DUR={hello:1.9,oops:1.8,happy:1.7,giggle:1,sad:2.4,point:2.6};
const JUMP={hello:250,oops:330,happy:300,giggle:190};

/* ── общее для персонажей: состояния, выражения, ходьба, прыжки, моргание, взгляд, частицы ── */
class Base{
  constructor(svg,o){
    this.svg=svg; this.o=o; this.s=o.scale||1; this.av=!!o.avatar;
    this.pos={x:o.x||0,y:o.y||0}; this.prev={...this.pos};
    this.layer=o.layer||svg; this.over=o.over||svg;
    this.S={lx:0,ly:0,draw:0,...BASE}; this.T={...this.S};
    this.state='idle'; this.stateT=0; this.until=0; this.time=0; this.waits=[]; this.anims=[]; this.walk=null;
    this.jy=0; this.jv=0; this.sq=0; this.sqv=0; this.walkPhase=0; this.moving=false; this.wa=0; this.mvx=-1;
    this.blinkAt=rand(1,3); this.blinkT=-1; this.glanceAt=0; this.glance={x:0,y:0};
    this.talkUntil=0; this.lookAt=null; this.pointAt=null; this.drawOn=false; this.drawR=24; this.theta=0;
    this.parts=[]; this.zAt=0; this.sparkAt=0; this.autoSlept=false; this.seen=false; this.onPoke=null;
    this.vel=0;
    this.build();
    this.g.addEventListener('click',e=>{ if(this.onPoke) this.onPoke(e); });
  }
  /* ── управление ── */
  play(st,ms){ if(!POSE[st]&&st!=='idle') st='idle';
    this.state=st; this.stateT=this.time; this.autoSlept=false;
    this.until=ms?this.time+ms/1000:DUR[st]?this.time+DUR[st]:0;
    if(JUMP[st]) this.jump(JUMP[st]);
    if(st==='happy') this.burst(this.av?4:8);
    if(st==='giggle') this.burst(this.av?2:4);
    if(st==='oops'){ const h=this.headWorld(); this.spawn('drop',h.x+h.r*.95,h.y-h.r*.35); }
    if(st==='sleep') this.zAt=this.time+.4;
    return this; }
  idle(){ return this.play('idle'); }
  talk(ms){ this.talkUntil=this.time+ms/1000; return this; }
  jump(v){ v*=this.av?.42:1; if(reduced()) v*=.35; if(this.jy===0){ this.jv=-v; this.sqv+=Math.min(2.4,v/140); } }
  burst(n){ if(reduced()) return; const h=this.headWorld(); for(let i=0;i<n;i++) this.spawn('spark',h.x,h.y-h.r*.3); }
  sleep(ms){ return new Promise((res,rej)=>this.waits.push({at:this.time+ms/1000,res,rej})); }
  anim(ms,fn){ return new Promise((res,rej)=>this.anims.push({t0:this.time,dur:Math.max(.001,ms/1000),fn,res,rej})); }
  walkTo(x,y,speed){ return new Promise((res,rej)=>{ if(reduced()||Math.hypot(x-this.pos.x,y-this.pos.y)<.5){ this.pos.x=x; this.pos.y=y; res(); return; } this.walk={x,y,speed:speed||170,res,rej}; }); }
  cancel(){ const c=new Cancel(); for(const w of this.waits) w.rej(c); for(const a of this.anims) a.rej(c); this.waits=[]; this.anims=[]; if(this.walk){ this.walk.rej(c); this.walk=null; } }
  /* ── кадр ── */
  stateTargets(){ const T=this.T; Object.assign(T,BASE,POSE[this.state]||{}); T.draw=this.drawOn?1:0;
    if(this.pointAt){ const sh=this.shoulderWorld(), vx=this.pointAt.x-sh.x, vy=this.pointAt.y-sh.y; T.armL=Math.atan2(-vx,vy)/D2R-this.S.tilt; T.smile=.65; T.brow=.5; } }
  lookTargets(){ const T=this.T, h=this.headWorld(); let vx=0,vy=0,k=1;
    const aim=p=>{ vx=p.x-h.x; vy=p.y-h.y; const d=Math.hypot(vx,vy)||1; k=Math.min(1,d/(70*this.s)); vx/=d; vy/=d; };
    const st=this.state;
    if(this.drawOn) aim(this.tipWorld());
    else if(this.lookAt) aim(this.lookAt);
    else if(st==='think'){ vx=-.6; vy=-.8; }
    else if(st==='study'){ vx=.2; vy=.9; }
    else if(st==='sleep'||st==='sad'){ vx=0; vy=.35; }
    else if(this.moving){ vx=Math.sign(this.mvx)*.75; vy=.15; }
    else if(PTR.t&&performance.now()-PTR.t<4000){ const p=this.toLocal(PTR.x,PTR.y); if(p) aim(p); }
    else { if(this.time>this.glanceAt){ this.glanceAt=this.time+rand(1.4,3.4); this.glance=Math.random()<.4?{x:0,y:0}:{x:rand(-.7,.7),y:rand(-.5,.5)}; } vx=this.glance.x; vy=this.glance.y; }
    T.lx=clamp(vx*k,-1,1); T.ly=clamp(vy*k,-1,1); }
  toLocal(cx,cy){ const m=this.svg.getScreenCTM&&this.svg.getScreenCTM(); if(!m) return null; return new DOMPoint(cx,cy).matrixTransform(m.inverse()); }
  update(dt,vis){
    this.time+=dt; const t=this.time;
    for(const w of this.waits.slice()) if(t>=w.at){ this.waits.splice(this.waits.indexOf(w),1); w.res(); }
    for(const a of this.anims.slice()){ const p=clamp((t-a.t0)/a.dur,0,1); a.fn(p); if(p>=1){ this.anims.splice(this.anims.indexOf(a),1); a.res(); } }
    if(this.until&&t>=this.until){ this.until=0; this.state='idle'; }
    if(this.walk){ const w=this.walk, dx=w.x-this.pos.x, dy=w.y-this.pos.y, d=Math.hypot(dx,dy), step=w.speed*dt;
      if(d<=step){ this.pos.x=w.x; this.pos.y=w.y; this.walk=null; w.res(); } else { this.pos.x+=dx/d*step; this.pos.y+=dy/d*step; } }
    const mdx=this.pos.x-this.prev.x, mdy=this.pos.y-this.prev.y; this.vel=dt>0?mdx/dt:0; this.moving=Math.hypot(mdx,mdy)>.02; if(Math.abs(mdx)>.02) this.mvx=mdx;
    this.prev.x=this.pos.x; this.prev.y=this.pos.y;
    if(this.moving) this.walkPhase+=dt*11*Math.min(1.6,Math.max(.7,.55/this.s));
    this.wa+=((this.moving&&!this.drawOn?1:0)-this.wa)*(1-Math.exp(-dt*10));
    if(this.jv!==0||this.jy<0){ this.jv+=1500*dt; this.jy+=this.jv*dt; if(this.jy>=0){ this.jy=0; if(this.jv>0) this.sqv-=Math.min(3.4,this.jv/95); this.jv=0; } }
    this.sqv+=(-320*this.sq-15*this.sqv)*dt; this.sq+=this.sqv*dt;
    if(this.blinkT<0&&t>=this.blinkAt&&this.state!=='sleep'){ this.blinkT=0; this.blinkAt=t+(Math.random()<.2?.28:rand(2,5)); }
    let blink=0; if(this.blinkT>=0){ this.blinkT+=dt; blink=Math.sin(Math.PI*clamp(this.blinkT/.16,0,1)); if(this.blinkT>.16) this.blinkT=-1; }
    this.pose(dt);
    this.stateTargets(); this.lookTargets();
    const k=1-Math.exp(-dt*12), kl=1-Math.exp(-dt*16);
    for(const key in this.T) this.S[key]+=(this.T[key]-this.S[key])*(key==='lx'||key==='ly'?kl:k);
    if(!vis){ this.fx(dt,t,false); return; }
    const S=this.S, R={...S}, st=this.state, A=amp();
    const breath=Math.sin(t*(st==='sleep'?1.5:2.3))*A*(this.drawOn?0:1)*(st==='sleep'?2.2:1);
    R.sy=1+this.sq+breath*.013; R.sx=1-this.sq*.6-breath*.006; R.lid=Math.max(S.lid,blink);
    if(t<this.talkUntil){ const pause=Math.sin(t*7.3)+Math.sin(t*3.1)>1.25; if(!pause) R.mouth=Math.max(S.mouth,.12+.5*Math.abs(Math.sin(t*17))*(.65+.35*Math.sin(t*5.3))); }
    if(st==='hello') R.armR+=Math.sin(t*13)*24*A;
    if(st==='think') R.armR+=Math.sin(t*9)*6*A;
    if(st==='study') R.armR+=Math.sin(t*5)*5*A;
    if(st==='talk'||t<this.talkUntil){ R.armR+=Math.sin(t*3.1)*14*A; R.tilt+=Math.sin(t*2.3)*2*A; }
    if(st==='happy'||st==='giggle'){ R.armL+=Math.sin(t*11)*12*A; R.armR+=Math.sin(t*11+1)*12*A; R.tilt+=Math.sin(t*9)*3*A; }
    if(st==='oops') R.tilt+=Math.sin(t*40)*1.2*Math.max(0,1-(t-this.stateT)*1.5);
    if(this.wa>.01){ R.armL+=Math.sin(this.walkPhase)*22*this.wa; R.armR-=Math.sin(this.walkPhase)*22*this.wa; }
    if(this.amp>0) R.mouth=Math.max(R.mouth,clamp(this.amp,0,1));
    R.turn=this.turn||0;
    if(OVER[st]) OVER[st](R,t,this,A);
    this.render(R,t); this.fx(dt,t,true); if(this.onFrame) this.onFrame();
  }
  /* думающие точки и частицы (z, искры, капля) — в координатах сцены */
  fx(dt,t,vis){ const h=this.headWorld(), s=this.s, on=(this.state==='think'||this.state==='study')?1:0;
    if(vis) this.dots.forEach((d,i)=>{ const ph=(t*2.2-i*.35)%1.4;
      const dx=this.av?h.r*.3+i*6:h.r*.55+4*s+i*7*s, dy=this.av?-h.r+1-i*6:-h.r-3*s-i*6*s;   /* в аватарке — ближе к голове, не в скруглённый угол */
      d.setAttribute('cx',f2(h.x+dx)); d.setAttribute('cy',f2(h.y+dy+Math.sin(t*3+i)*1.2*s));
      d.setAttribute('opacity',f2(on*(.35+.65*Math.max(0,Math.sin(ph/1.4*Math.PI))))); });
    if(this.state==='sleep'&&t>this.zAt&&!reduced()){ this.zAt=t+1.2; this.spawn('z',h.x+h.r*.5,h.y-h.r*.6); }
    if(this.state==='happy'&&t>this.sparkAt&&!reduced()){ this.sparkAt=t+.5; this.spawn('spark',h.x+rand(-1.2,1.2)*h.r,h.y+rand(-1.2,.4)*h.r); }
    for(const q of this.parts.slice()){ q.age+=dt; const u=q.age/q.life;
      if(u>=1){ q.el.remove(); this.parts.splice(this.parts.indexOf(q),1); continue; }
      q.vx*=Math.pow(q.drag,dt*60); q.vy=q.vy*Math.pow(q.drag,dt*60)+q.g*dt; q.x+=q.vx*dt*s; q.y+=q.vy*dt*s;
      if(!vis) continue;
      let sc=1,o=1;
      if(q.kind==='z'){ sc=.6+u*.7; o=u<.2?u/.2:1-(u-.2)/.8; }
      if(q.kind==='spark') sc=(1-u)*q.sc;
      if(q.kind==='heart'||q.kind==='star'){ sc=q.sc*(u<.15?u/.15:1); o=u<.6?1:1-(u-.6)/.4; }
      if(q.kind==='drop') o=u<.15?u/.15:1-Math.max(0,(u-.6)/.4);
      q.el.setAttribute('transform',`translate(${f2(q.x)} ${f2(q.y)}) rotate(${f2(q.rot+q.age*q.spin)}) scale(${f2(sc*s)})`);
      q.el.setAttribute('opacity',f2(clamp(o,0,1))); } }
  spawn(kind,x,y){ let e,q;
    if(kind==='z'){ e=el('text',{class:'mc-z','text-anchor':'middle'},this.over); e.textContent=Math.random()<.5?'z':'Z'; q={vx:9,vy:-20,g:0,drag:1,life:2.4,spin:0,rot:-10}; }
    else if(kind==='spark'){ e=el('path',{d:'M0 -7Q1.2 -1.2 7 0Q1.2 1.2 0 7Q-1.2 1.2 -7 0Q-1.2 -1.2 0 -7Z',fill:Math.random()<.5?'#ffc23a':'#ff6a2a'},this.over); const a=rand(0,Math.PI*2), v=rand(50,110); q={vx:Math.cos(a)*v,vy:Math.sin(a)*v-30,g:60,drag:.94,life:rand(.6,1),spin:rand(-200,200),rot:rand(0,90),sc:rand(.7,1.2)}; }
    else if(kind==='heart'){ e=el('path',{d:'M0 6C-9 -1 -8 -8 -3.5 -8C-1.5 -8 0 -6.5 0 -5C0 -6.5 1.5 -8 3.5 -8C8 -8 9 -1 0 6Z',fill:'#ff5c86',stroke:INK,'stroke-width':1.2},this.over); q={vx:rand(-18,18),vy:rand(-55,-35),g:0,drag:.985,life:rand(1.2,1.8),spin:rand(-30,30),rot:rand(-15,15),sc:rand(.8,1.3)}; }
    else if(kind==='star'){ e=el('path',{d:'M0 -7L2 -2.2L7 -2.2L3 1L4.5 6L0 3L-4.5 6L-3 1L-7 -2.2L-2 -2.2Z',fill:'#ffd23f',stroke:INK,'stroke-width':1.1},this.over); const a=rand(0,Math.PI*2); q={vx:Math.cos(a)*40,vy:Math.sin(a)*14-10,g:0,drag:.97,life:rand(1,1.4),spin:rand(-200,200),rot:0,sc:rand(.7,1.1)}; }
    else { e=el('path',{d:'M0 -7Q5 0 0 5Q-5 0 0 -7Z',fill:'#7cc6ff',stroke:INK,'stroke-width':1.3},this.over); q={vx:0,vy:8,g:14,drag:1,life:1.8,spin:0,rot:0}; }
    e.setAttribute('opacity',0); Object.assign(q,{el:e,kind,x,y,age:0}); this.parts.push(q); }
}
/* ── Пингвин: круглый, ходит вперевалку; лицо поворачивается за взглядом, хохолок и шарф качаются от движения;
   обводит точку карандашом, зажатым в ласте (тело чуть тянется за грифелем). Наряд: scarf · helmet · glasses ── */
const NAVY='#26365a', NAVY_D='#18233d', BELLY='#fdfbf6', ORANGE='#ff9a3c';
const FLIP='M0 0C-6.5 3 -9 16 -5.5 30C-4 35 2 35.5 4 31C6.8 19 6.5 5 0 0Z';
class Penguin extends Base{
  build(){
    const o=this.outfit=['scarf','helmet','glasses'].includes(this.o.outfit)?this.o.outfit:'scarf';
    const g=this.g=el('g',{class:'mc-body'},this.layer), sw={stroke:INK,'stroke-width':2.1,'stroke-linejoin':'round'};
    this.flR=el('g',null,g); el('path',{d:FLIP,fill:NAVY,...sw},this.flR);
    this.flL=el('g',null,g); el('path',{d:FLIP,fill:NAVY,...sw},this.flL);
    this.feet=[-1,1].map(s=>{ const f=el('g',null,g); el('ellipse',{cx:s*11.5,cy:-3.2,rx:9.6,ry:4.8,fill:ORANGE,stroke:INK,'stroke-width':2},f);
      el('path',{d:`M${s*11.5+2.5} -1.2v-2.6M${s*11.5-2.5} -1.2v-2.6`,stroke:'#c96a1c','stroke-width':1.3,'stroke-linecap':'round'},f); return f; });
    el('path',{d:'M0 -97C22 -97 36 -75 36 -46C36 -18 22 -5 0 -5C-22 -5 -36 -18 -36 -46C-36 -75 -22 -97 0 -97Z',fill:NAVY,stroke:INK,'stroke-width':2.3},g);
    el('path',{d:'M15 -92C30 -84 36.5 -64 35.5 -46C34.5 -24 24 -9 6 -5.6C21 -14 28.5 -32 28.5 -50C28.5 -68 24 -82 15 -92Z',fill:NAVY_D,opacity:.55},g);
    el('ellipse',{cx:-18,cy:-80,rx:6.5,ry:3,fill:'#fff',opacity:.22,transform:'rotate(-38 -18 -80)'},g);
    el('path',{d:'M0 -58C16 -58 25 -43 25 -28C25 -14 14 -9 0 -9C-14 -9 -25 -14 -25 -28C-25 -43 -16 -58 0 -58Z',fill:BELLY},g);
    el('path',{d:'M-23.5 -20C-18 -12 18 -12 23.5 -20C20 -12.5 11 -9 0 -9C-11 -9 -20 -12.5 -23.5 -20Z',fill:'#e9e3d6'},g);
    if(o!=='helmet'){ this.tuft=el('g',null,g);
      el('path',{d:'M-1.5 -95.5Q-7 -104 -2 -109.5M1 -95.5Q2.5 -106 8.5 -107M0 -95.5Q-1.5 -101 -5.5 -103.5',fill:'none',stroke:NAVY,'stroke-width':3.2,'stroke-linecap':'round'},this.tuft); }
    this.faceG=el('g',null,g);
    el('path',{d:'M0 -55C-10 -49 -27 -55 -27 -70C-27 -82 -15 -87 -7 -81Q0 -77 7 -81C15 -87 27 -82 27 -70C27 -55 10 -49 0 -55Z',fill:BELLY},this.faceG);
    this.face=makeFace(this.faceG,{ex:10.5,ey:-70,er:7.4,my:0,mw:0,cheekX:18.5,cheekY:-60,beak:true});
    if(o==='glasses'){ for(const s of [-1,1]) el('circle',{cx:s*10.5,cy:-70,r:10.2,fill:'#bfe3ff','fill-opacity':.18,stroke:INK,'stroke-width':2.2},this.faceG);
      el('path',{d:'M-0.6 -71.5Q0 -73.5 0.6 -71.5M-20.7 -72L-27.5 -74.5M20.7 -72L27.5 -74.5',fill:'none',stroke:INK,'stroke-width':2,'stroke-linecap':'round'},this.faceG); }
    this.tongue=el('ellipse',{cx:-5.8,cy:-58.6,rx:2.3,ry:1.7,fill:'#ff7b95',stroke:INK,'stroke-width':1,opacity:0},this.faceG);
    this.beakLo=el('path',{fill:'#ff8a2a',stroke:INK,'stroke-width':1.8,'stroke-linejoin':'round'},this.faceG);
    el('path',{d:'M-7.5 -62Q0 -68.5 7.5 -62Q0 -59 -7.5 -62Z',fill:'#ffa64a',stroke:INK,'stroke-width':1.8,'stroke-linejoin':'round'},this.faceG);
    if(o==='scarf'){ this.tail=el('g',null,g);
      el('path',{d:'M-2.5 0L3.5 -0.5L7 19Q2.5 22 -1 19Z',fill:'#e8551c',stroke:INK,'stroke-width':1.8,'stroke-linejoin':'round'},this.tail);
      el('path',{d:'M0.5 0L6 0.5L4.5 17Q0 19.5 -2.5 16.5Z',fill:'#ff6a2a',stroke:INK,'stroke-width':1.8,'stroke-linejoin':'round',transform:'rotate(-14)'},this.tail);
      el('path',{d:'M-33.5 -56Q0 -46 33.5 -56L34.5 -47Q0 -37 -34.5 -47Z',fill:'#ff6a2a',stroke:INK,'stroke-width':2,'stroke-linejoin':'round'},g);
      el('path',{d:'M-24 -50.5L-21 -43.5M-12 -48.5L-10 -41.5M2 -47.5L2 -40.5',stroke:'#ffd2bd','stroke-width':1.6,'stroke-linecap':'round'},g);
      el('ellipse',{cx:15,cy:-46.5,rx:5,ry:4.2,fill:'#ff6a2a',stroke:INK,'stroke-width':1.8},g); }
    if(o==='helmet'){ el('path',{d:'M-23 -88C-23 -108 23 -108 23 -88Z',fill:'#ffc23a',...sw},g);
      el('path',{d:'M-5 -103.5L-4 -89M5 -103.5L4 -89',stroke:'#e09a12','stroke-width':2.2,'stroke-linecap':'round'},g);
      el('rect',{x:-29,y:-90,width:58,height:5.5,rx:2.75,fill:'#ffc23a',stroke:INK,'stroke-width':2},g); }
    /* карандаш — в координатах сцены, поверх тела */
    this.penG=el('g',{opacity:0},this.layer);
    const P=(c,cap)=>el('path',{fill:'none',stroke:c,'stroke-linecap':cap||'round'},this.penG);
    this.pInk=P(INK); this.pCol=P('#ffc23a'); this.pWood=P('#f3cf9f','butt'); this.pLead=P('#2b2f3a');
    this.dots=[0,1,2].map(i=>el('circle',{r:(2.1+i*1.15)*this.s,class:'mc-dot',opacity:0},this.over));
    this.tl=0; this.tv=0; this.ul=0; this.uv=0; this.fx_=0; this.fy_=0; this.drawC=null; this.tipW=null;
  }
  headWorld(){ const s=this.s; return {x:this.pos.x+this.fx_,y:this.pos.y+this.fy_+(this.jy-70)*s,r:30*s}; }
  shoulderWorld(){ const s=this.s; return {x:this.pos.x+this.fx_-31*s,y:this.pos.y+this.fy_+(this.jy-62)*s}; }
  tipWorld(){ return this.tipW||this.headWorld(); }
  canDraw(t,W,H){ const s=this.s; return t.y-78*s>=0&&t.x+110*s<=W&&t.y+42*s<=H&&t.x>=14*s; }
  /* обвести точку c окружностью: встаёт справа снизу (не загораживая точку), грифель — по кругу, тело тянется за ним */
  async drawCircle(c,rPx,ring){ const s=this.s, rl=clamp(rPx/s,12,34), rp=rl*s, L=2*Math.PI*rp;
    ring.setAttribute('d',circleD(c,rp)); ring.setAttribute('stroke-dasharray',f2(L)); ring.setAttribute('stroke-dashoffset',f2(L)); ring.style.opacity=0;
    this.drawR=rl; this.theta=0;
    await this.walkTo(c.x+72*s,c.y+34*s,150);
    this.drawC=c; this.state='draw'; this.drawOn=true; this.lookAt=null; await this.sleep(reduced()?60:480);
    await this.anim(reduced()?250:1700,p=>{ const e=ease(p); this.theta=e*Math.PI*2; ring.style.opacity=e>.002?1:0; ring.setAttribute('stroke-dashoffset',f2(L*(1-e))); });
    await this.sleep(150); this.drawOn=false; this.state='idle'; await this.sleep(reduced()?50:320); }
  pose(dt){ const t=this.time, A=amp(), s=this.s;
    /* пружины: хвосты шарфа и хохолок отстают от движения */
    const tg=clamp(-this.vel/(s*5),-45,45)+Math.sin(this.walkPhase)*12*this.wa+Math.sin(t*1.9)*3*A+this.jv*.025;
    this.tv+=((tg-this.tl)*80-this.tv*7)*dt; this.tl+=this.tv*dt;
    const tu=-this.S.tilt*1.3+Math.sin(t*2.6)*4*A+clamp(-this.vel/(s*9),-25,25)+this.jv*.035;
    this.uv+=((tu-this.ul)*120-this.uv*9)*dt; this.ul+=this.uv*dt;
    const m=clamp(this.S.draw,0,1);
    if(!this.drawOn&&m<.02) this.drawC=null;
    if(this.drawC){ const rp=this.drawR*s; this.tipW={x:this.drawC.x+rp*Math.cos(this.theta),y:this.drawC.y+rp*Math.sin(this.theta)};
      this.fx_=(this.tipW.x-this.drawC.x)*.4*m; this.fy_=(this.tipW.y-this.drawC.y)*.4*m; }
    else { this.tipW=null; this.fx_=0; this.fy_=0; } }
  pen(h,tip,m){ const s=this.s, dx=tip.x-h.x, dy=tip.y-h.y, d=Math.hypot(dx,dy)||1, ux=dx/d, uy=dy/d;
    const L=(e,x1,y1,x2,y2,w)=>{ e.setAttribute('d',`M${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}`); e.setAttribute('stroke-width',f2(w*s)); };
    const bx=h.x-ux*5*s, by=h.y-uy*5*s;
    L(this.pInk,bx,by,tip.x-ux*6*s,tip.y-uy*6*s,8); L(this.pCol,bx,by,tip.x-ux*6*s,tip.y-uy*6*s,5);
    L(this.pWood,tip.x-ux*6.5*s,tip.y-uy*6.5*s,tip.x-ux*1.8*s,tip.y-uy*1.8*s,4.2); L(this.pLead,tip.x-ux*2.2*s,tip.y-uy*2.2*s,tip.x,tip.y,2);
    this.penG.setAttribute('opacity',f2(m)); }
  render(R){ const s=this.s, ph=this.walkPhase, wa=this.wa, m=clamp(R.draw,0,1);
    const tilt=R.tilt+Math.sin(ph)*9*wa, bob=-Math.abs(Math.sin(ph))*3*wa, X=this.pos.x+this.fx_, Y=this.pos.y+this.fy_;
    this.g.setAttribute('transform',`translate(${f2(X)} ${f2(Y)}) scale(${f2(s)}) translate(0 ${f2(this.jy+bob)}) rotate(${f2(tilt)}) scale(${(R.sx*(R.turn?Math.cos(R.turn*Math.PI*2):1)).toFixed(4)} ${R.sy.toFixed(4)})`);
    let aL=R.armL, k=1;
    if(m>.01&&this.tipW){ const sh={x:X-31*s,y:Y+(this.jy-62)*s}, vx=this.tipW.x-sh.x, vy=this.tipW.y-sh.y, len=Math.hypot(vx,vy)/s;
      aL=lerp(aL,Math.atan2(-vx,vy)/D2R-tilt,m); k=lerp(1,clamp((len-8)/31,.55,1.05),m);
      const d=Math.hypot(vx,vy)||1; this.pen({x:sh.x+vx/d*31*k*s,y:sh.y+vy/d*31*k*s},this.tipW,m); }
    else this.penG.setAttribute('opacity',0);
    this.flL.setAttribute('transform',`translate(-31 -62) rotate(${f2(aL)}) scale(1 ${f2(k)})`);
    this.flR.setAttribute('transform',`translate(31 -62) rotate(${f2(-R.armR)}) scale(-1 1)`);
    this.feet.forEach((f,i)=>f.setAttribute('transform',`translate(0 ${f2(-Math.max(0,(i?-1:1)*Math.sin(ph))*4*wa)})`));
    this.faceG.setAttribute('transform',`translate(${f2(R.lx*2.6)} ${f2(R.ly*1.6)})`);
    if(this.tuft) this.tuft.setAttribute('transform',`rotate(${f2(this.ul)} 0 -95)`);
    if(this.tail) this.tail.setAttribute('transform',`translate(17 -45) rotate(${f2(this.tl*.8)})`);
    const o=clamp(R.mouth,0,1);
    this.beakLo.setAttribute('d',`M-6.5 -61.5Q0 ${f2(-59.5+o*5-R.smile*.6)} 6.5 -61.5Q0 ${f2(-56+o*9)} -6.5 -61.5Z`);
    this.tongue.setAttribute('opacity',f2(m*(this.state==='draw'?1:0)));
    this.face(R); }
}
const circleD=(c,r)=>`M${f2(c.x+r)} ${f2(c.y)}A${f2(r)} ${f2(r)} 0 1 1 ${f2(c.x-r)} ${f2(c.y)}A${f2(r)} ${f2(r)} 0 1 1 ${f2(c.x+r)} ${f2(c.y)}`;

/* персонажи: класс и рамка аватарки (голова крупно); по умолчанию — self.MASCOT_CHAR, наряд пингвина — self.MASCOT_OUTFIT */
const CHARS={penguin:{C:Penguin,vb:'-44 -122 88 88',full:'-56 -122 112 128',k:1.15}};   /* vb — голова крупно (аватарка), full — во весь рост; k — масштаб на чертеже */
const charOf=o=>CHARS[(o&&o.char)||self.MASCOT_CHAR||'penguin']||CHARS.penguin;
const outfitOf=o=>(o&&o.outfit)||self.MASCOT_OUTFIT||'scarf';
/* ── общий цикл, курсор, бездействие ── */
const REG=new Set(), PTR={x:0,y:0,t:0}; let raf=0, last=0, lastAct=performance.now();
function start(){ if(!raf&&!document.hidden){ last=performance.now(); raf=requestAnimationFrame(loop); } }
function loop(now){ raf=0; const dt=Math.min(.05,Math.max(0,(now-last)/1000)); last=now;
  for(const m of REG){ const host=m.svg.parentNode, con=m.svg.isConnected;
    if(con) m.seen=true; else { if(m.seen){ m.cancel(); REG.delete(m); } continue; }
    if(m.o.sleepAfter&&m.state==='idle'&&!m.until&&now-lastAct>m.o.sleepAfter){ m.play('sleep'); m.autoSlept=true; }
    m.update(dt,!!(host&&host.offsetParent)); }
  if(REG.size&&!document.hidden) raf=requestAnimationFrame(loop); }
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&REG.size) start(); });
function activity(e){ lastAct=performance.now(); if(e&&'clientX' in e){ PTR.x=e.clientX; PTR.y=e.clientY; PTR.t=lastAct; }
  for(const m of REG) if(m.autoSlept&&m.state==='sleep'){ m.autoSlept=false; m.play('hello',900); m.blinkAt=m.time+.5; } }
addEventListener('pointermove',activity,{passive:true}); addEventListener('pointerdown',activity,{passive:true}); addEventListener('keydown',()=>activity(),{passive:true});

/* ── аватарка ── */
function avatar(host,opt){ opt=opt||{}; host.textContent='';
  const K=charOf(opt), svg=el('svg',{viewBox:opt.full?K.full:K.vb,class:'mc-av','aria-hidden':'true',focusable:'false'}); host.appendChild(svg);
  const m=new K.C(svg,{scale:1,avatar:true,sleepAfter:opt.sleepAfter||0,outfit:outfitOf(opt)});
  REG.add(m); start(); return m; }

/* ── большая сцена: свободный маскот в host (1 единица = 1 px), для игровых страниц ──
   stage(host,{scale,x,y,char,outfit}) → {m,svg,fx,act,over,resize()}; m — тот же маскот: play, talk, walkTo, jump, burst, spawn,
   pos, amp (рот по громкости 0…1), turn (поворот вокруг себя 0…1) */
function stage(host,opt){ opt=opt||{}; const K=charOf(opt), W=Math.max(1,host.clientWidth), H=Math.max(1,host.clientHeight);
  const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,class:'mc-stage','aria-hidden':'true',focusable:'false',style:'position:absolute;inset:0;width:100%;height:100%;overflow:visible'}); host.appendChild(svg);
  const fx=el('g',null,svg), act=el('g',null,svg), over=el('g',null,svg);
  const m=new K.C(svg,{scale:opt.scale||1,x:opt.x==null?W/2:opt.x,y:opt.y==null?H-20:opt.y,layer:act,over,outfit:outfitOf(opt)}); REG.add(m); start();
  return {m,svg,fx,act,over,resize(){ const w=Math.max(1,host.clientWidth), h=Math.max(1,host.clientHeight); svg.setAttribute('viewBox',`0 0 ${w} ${h}`); return {W:w,H:h}; }}; }
/* своё состояние: pose(name,{выражение},{dur,jump,over:(R,t,m,amp)=>void}) */
function pose(name,p,o){ o=o||{}; POSE[name]=Object.assign({},p); if(o.dur) DUR[name]=o.dur; else delete DUR[name]; if(o.jump) JUMP[name]=o.jump; if(o.over) OVER[name]=o.over; }

/* ── выход на чертёж ──
   opt: mood:'oops' · say:{text,actions:[{label,fn}]} — облачко у маскота (после показа точки; ✕ — уйти) ·
   onClose() — нажали ✕ в облачке · onRing(i,t) — нажали на обведённую точку ·
   before() — async, до расчёта точек (приблизить чертёж) · after() — async, когда показал (вернуть масштаб) ·
   haptic — вибрация (Android) на каждую окружность и на «ой» */
let TOUR=null;
const buzz=p=>{ try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} };
function boxSize(box){ return {W:Math.max(1,box.clientWidth),H:Math.max(1,box.clientHeight)}; }
function tour(box,getTargets,opt){ opt=opt||{};
  /* уже стоит на этом чертеже — идёт к новым точкам с того же места, а не выходит из-за края заново */
  const was=TOUR&&TOUR.box===box&&TOUR.ov.isConnected?{x:TOUR.m.pos.x,y:TOUR.m.pos.y}:null;
  untour(true); if(!box) return null;
  if(getComputedStyle(box).position==='static') box.style.position='relative';
  const ov=document.createElement('div'); ov.className='mc-tour'; box.appendChild(ov);
  const {W,H}=boxSize(box), svg=el('svg',{viewBox:`0 0 ${W} ${H}`,focusable:'false','aria-hidden':'true'}); ov.appendChild(svg);
  const fx=el('g',null,svg), act=el('g',null,svg), over=el('g',null,svg);
  const K=charOf(opt), s=clamp(Math.min(W,H)/560,.34,.58)*K.k;
  const m=new (K.C)(svg,{scale:s,x:was?was.x:W+70*s,y:was?was.y:H-8,layer:act,over,outfit:outfitOf(opt),sleepAfter:90000});
  const T={id:++uid,box,ov,svg,fx,m,getTargets,opt,W,H,rings:[],hits:[],targets:[],done:false,bub:null,sayOn:false};
  TOUR=T; REG.add(m); start();
  m.onPoke=e=>{ e.stopPropagation(); if(T.done&&m.state!=='sleep') m.play('giggle'); };
  m.g.addEventListener('pointerdown',e=>e.stopPropagation());   /* чертёж не перехватывает касание (лист начерта двигается пальцем) */
  m.onFrame=()=>placeBubble(T);
  try{ T.ro=new ResizeObserver(()=>{ const z=boxSize(box); if(TOUR!==T) return; if(!ov.isConnected) return untour(true); if(Math.abs(z.W-T.W)>2||Math.abs(z.H-T.H)>2) settle(T); }); T.ro.observe(box); }catch(e){}
  try{ T.mo=new MutationObserver(ms=>{ if(TOUR!==T) return; if(!ov.isConnected) return untour(true);
      if(ms.some(x=>[...x.removedNodes].some(n=>n.nodeName&&n.nodeName.toLowerCase()==='svg'))) untour(true); });
    T.mo.observe(box,{childList:true}); }catch(e){}
  run(T).catch(e=>{ if(!(e instanceof Cancel)) console.error(e); });
  return T; }
function targetsOf(T){ let ts=[]; try{ ts=(T.getTargets()||[]).filter(t=>t&&isFinite(t.x)&&isFinite(t.y)); }catch(e){} return ts.slice(0,3); }
function restSpot(T,t){ const m=T.m, s=m.s, W=T.W, H=T.H, top=140*s;
  if(!t) return {x:clamp(W-70*s,40*s,W-30*s),y:H-8};
  let x=t.x+28*s, y=t.y+112*s;
  if(y>H-6){ x=t.x+(t.x<W/2?78*s:-78*s); y=clamp(t.y+48*s,top,H-6); }
  return {x:clamp(x,30*s,W-30*s),y:clamp(y,top,H-6)}; }
/* показав, отходит в угол листа — не загораживать чертёж; угол — подальше от последней точки */
function corner(T,t){ const s=T.m.s, W=T.W, H=T.H; let x=W-40*s; if(t&&t.x>W-150*s&&t.y>H-170*s) x=40*s; return {x,y:H-6}; }
function ringFor(T,i,t){ const r=el('path',{class:'mc-ring'},T.fx); r.style.opacity=0; T.rings.push(r);
  if(T.opt.onRing){ const h=el('circle',{class:'mc-hit',cx:f2(t.x),cy:f2(t.y),r:f2(Math.max(22,(t.r||16)+10))},T.fx); T.hits.push(h);
    h.addEventListener('pointerdown',e=>e.stopPropagation()); h.addEventListener('click',e=>{ e.stopPropagation(); buzz(8); T.opt.onRing(i,t); }); }
  return r; }
async function run(T){ const m=T.m, s=m.s;
  if(T.opt.before){ try{ await T.opt.before(); }catch(e){} if(TOUR!==T) return; }
  const ts=targetsOf(T); T.targets=ts;
  if(reduced()){ settle(T); return; }
  const first=ts[0], enter=restSpot(T,null);
  await m.walkTo(first?clamp(first.x+90*s,40*s,T.W-30*s):enter.x,first?clamp(first.y+60*s,140*s,T.H-6):enter.y,210);
  if(T.opt.mood==='oops'){ m.play('oops'); if(T.opt.haptic) buzz([30,40,30]); await m.sleep(1000); m.idle(); }
  for(const [i,t] of ts.entries()){ const ring=ringFor(T,i,t), r=Math.max(13,t.r||16);
    if(m.canDraw(t,T.W,T.H)) await m.drawCircle(t,r,ring);
    else { const sp=restSpot(T,t); await m.walkTo(sp.x,sp.y,190); m.pointAt=t; ring.setAttribute('d',circleD(t,r)); const L=2*Math.PI*r;
      ring.setAttribute('stroke-dasharray',f2(L)); await m.anim(700,p=>{ ring.style.opacity=1; ring.setAttribute('stroke-dashoffset',f2(L*(1-ease(p)))); }); m.pointAt=null; }
    if(T.opt.haptic) buzz(12); }
  const t=ts[ts.length-1], sp=restSpot(T,t);
  await m.walkTo(sp.x,sp.y,190);
  if(t){ m.pointAt=t; m.lookAt=t; m.play('point',99999); } else m.play('hello');
  showSay(T); m.talk(T.opt.say?Math.min(4000,String(T.opt.say.text||'').length*45):1500);
  await m.sleep(t?2600:1600);
  m.pointAt=null; m.lookAt=null; m.idle(); T.done=true;
  if(T.opt.after){ try{ await T.opt.after(); }catch(e){} if(TOUR!==T) return; relayout(T); }
  const c=corner(T,t); await m.walkTo(c.x,c.y,170);
  wander(T).catch(()=>{}); }
/* стоит без дела — иногда прогуливается вдоль края листа и оглядывается */
async function wander(T){ const m=T.m, s=m.s;
  for(let i=0;i<40&&TOUR===T;i++){ await m.sleep(rand(6000,12000)); if(TOUR!==T||m.state!=='idle') continue;
    const base=corner(T,T.targets[T.targets.length-1]), x=clamp(base.x+rand(-1,1)*70*s,30*s,T.W-30*s);
    await m.walkTo(x,T.H-6,55+rand(0,25)); if(Math.random()<.35){ m.lookAt={x:rand(.2,.8)*T.W,y:rand(.2,.6)*T.H}; await m.sleep(1300); m.lookAt=null; } } }
/* точки заново после смены масштаба: окружности переставляются сразу */
function relayout(T){ const z=boxSize(T.box); T.W=z.W; T.H=z.H; T.svg.setAttribute('viewBox',`0 0 ${T.W} ${T.H}`);
  T.rings.forEach(r=>r.remove()); T.hits.forEach(h=>h.remove()); T.rings=[]; T.hits=[]; const ts=targetsOf(T); T.targets=ts;
  ts.forEach((t,i)=>{ const r=ringFor(T,i,t); r.setAttribute('d',circleD(t,Math.max(13,t.r||16))); r.style.opacity=1; }); }
/* мгновенная раскладка: после изменения размера или без анимаций */
function settle(T){ const m=T.m; m.cancel(); relayout(T);
  const sp=corner(T,T.targets[T.targets.length-1]); m.pos.x=m.prev.x=sp.x; m.pos.y=m.prev.y=sp.y; m.drawOn=false; m.S.draw=0; m.pointAt=null; m.lookAt=null; m.idle(); T.done=true; showSay(T); }
/* облачко у маскота: текст, кнопки, ✕ */
function showSay(T,say){ if(say) T.opt.say=say; const sy=T.opt.say; if(!sy||!sy.text){ if(T.bub) T.bub.remove(); T.bub=null; return; }
  const b=T.bub||document.createElement('div'); b.className='mc-bub'; b.innerHTML='';
  const sp=document.createElement('span'); sp.textContent=sy.text; b.appendChild(sp);
  const x=document.createElement('button'); x.type='button'; x.className='mc-x'; x.setAttribute('aria-label','Убрать'); x.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>'; b.appendChild(x);
  x.addEventListener('click',e=>{ e.stopPropagation(); if(T.opt.onClose) T.opt.onClose(); untour(); });
  if(sy.actions&&sy.actions.length){ const r=document.createElement('div'); r.className='mc-acts';
    sy.actions.forEach(a=>{ const q=document.createElement('button'); q.type='button'; q.textContent=a.label; q.addEventListener('click',e=>{ e.stopPropagation(); buzz(8); a.fn(); }); r.appendChild(q); }); b.appendChild(r); }
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  if(!T.bub){ T.ov.appendChild(b); T.bub=b; requestAnimationFrame(()=>b.classList.add('on')); }
  T.m.talk(Math.min(4000,String(sy.text).length*45)); placeBubble(T); }
function placeBubble(T){ const b=T.bub; if(!b) return; const h=T.m.headWorld(), W=T.W, bw=b.offsetWidth, bh=b.offsetHeight;
  const right=h.x<W*.55; let x=right?h.x+h.r*.55:h.x-h.r*.55-bw; x=clamp(x,6,W-bw-6);
  let y=h.y-h.r-bh-6; const below=y<6; if(below) y=Math.min(T.H-bh-6,h.y+h.r+8);
  b.classList.toggle('r',right); b.classList.toggle('b',below);
  b.style.transform=`translate(${Math.round(x)}px,${Math.round(Math.max(6,y))}px)`;
  b.style.setProperty('--tx',Math.round(clamp(h.x-x,14,bw-14))+'px'); }
function untour(instant){ const T=TOUR; if(!T) return; TOUR=null; try{ T.ro&&T.ro.disconnect(); T.mo&&T.mo.disconnect(); }catch(e){}
  const m=T.m; m.cancel(); if(T.bub) T.bub.classList.remove('on');
  const gone=()=>{ T.ov.remove(); REG.delete(m); };
  if(instant||reduced()||!T.ov.isConnected) return gone();
  (async()=>{ m.drawOn=false; m.pointAt=null; m.lookAt=null; m.play('hello'); await m.sleep(650);
    const out=m.pos.x>T.W/2?T.W+80*m.s:-80*m.s; T.ov.classList.add('out'); await m.walkTo(out,m.pos.y,260); gone(); })().catch(()=>gone()); }
/* поменять облачко текущего выхода (нажали на окружность — пояснение к точке) */
function say(text,actions){ const T=TOUR; if(!T||!T.ov.isConnected) return false; showSay(T,{text,actions}); if(T.done&&T.m.state==='idle') T.m.play('talk',1600); return true; }

self.MASCOT={avatar,tour,untour,say,stage,pose,reduced,chars:Object.keys(CHARS),
  state:()=>({avatars:[...REG].filter(m=>m.av&&m.svg.isConnected).map(m=>m.state),tour:TOUR?{targets:TOUR.targets.length,rings:TOUR.rings.filter(r=>r.isConnected&&r.style.opacity!=='0').length,done:TOUR.done,state:TOUR.m.state,box:TOUR.box,say:TOUR.bub&&TOUR.bub.isConnected?TOUR.bub.querySelector('span').textContent:''}:null})};
})();
