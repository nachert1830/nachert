/* ═══ «Связь» в копии /new/: Лука, нижнее меню, мини-панель «Сейчас делаешь», вход по коду ═══
   Лука — помощник и центр сайта. Облик вырос из «Огибающей» (docs/design-system/README.md, раздел 5): окружность из касательных,
   которая поворачивается в пространстве (в проекции — эллипс, задние касательные штрихом, как невидимые линии), — но живой
   и цветной: касательные переливаются его палитрой, за ним мягкое свечение, есть глаза — моргают и смотрят на палец и на поле.
   Состояния: idle (дышит), listen (печатаешь), think, speak, error, success. API: window.LUKA = {make, ask, state}. */
(function(){
'use strict';
const D=document, root=D.documentElement;
const $=(s,r)=>(r||D).querySelector(s), $$=(s,r)=>[...(r||D).querySelectorAll(s)];
const LS={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch(e){}}};
const SS={get(k){try{return sessionStorage.getItem(k);}catch(e){return null;}},set(k,v){try{sessionStorage.setItem(k,v);}catch(e){}}};
const J=(s,d)=>{try{return JSON.parse(s)??d;}catch(e){return d;}};
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};

/* ───────── Лука ───────── */
const Luka=(()=>{
  const all=new Set(); let raf=0, last=0, col={}, px=-1, py=-1;
  const hex=h=>{h=String(h||'').trim(); if(h[0]!=='#') return [128,128,128]; const n=parseInt(h.slice(1),16); return [n>>16&255,n>>8&255,n&255];};
  function recolor(){ const cs=getComputedStyle(root); ['ink-1','err','ok','luka-1','luka-2','luka-3','luka-4','surface-1'].forEach(k=>col[k]=hex(cs.getPropertyValue('--'+k)));
    col.glow=parseFloat(cs.getPropertyValue('--luka-glow'))||.25; all.forEach(o=>o.dirty=true); loop(); }
  const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
  const pal=t=>{ const P=[col['luka-1'],col['luka-2'],col['luka-3'],col['luka-4']]; t=((t%1)+1)%1*4; const i=Math.floor(t); return mix(P[i],P[(i+1)%4],t-i); };
  const T={
    idle:   {tilt:.5, spin:.22,len:.95,hue:.04,gap:0,happy:0,glow:1, eye:1},
    listen: {tilt:.85,spin:.5, len:.8, hue:.10,gap:0,happy:0,glow:1.25,eye:1},
    think:  {tilt:.8, spin:2.4,len:1.25,hue:.45,gap:0,happy:0,glow:1.5,eye:.7},
    speak:  {tilt:.35,spin:.8, len:1.0,hue:.18,gap:0,happy:0,glow:1.3,eye:1},
    error:  {tilt:.3, spin:.06,len:.9, hue:0,  gap:1,happy:0,glow:.7, eye:1,err:1},
    success:{tilt:.06,spin:.35,len:.3, hue:.12,gap:0,happy:1,glow:1.6,eye:1},
  };
  class L{
    constructor(cv,o={}){ this.cv=cv; this.c=cv.getContext('2d'); this.n=o.n||24; this.lw=o.lw||1.7; this.k=o.k||.27; this.eyes=o.eyes!==false;
      this.state='idle'; this.p={...T.idle,err:0}; this.ph=Math.random()*6; this.hp=Math.random(); this.pulse=0; this.sq=0; this.sqv=0; this.shake=0;
      this.lx=0; this.ly=0; this.tx=0; this.ty=0; this.blink=0; this.nextBlink=performance.now()+1500+Math.random()*3000; this.t0=performance.now();
      this.size(); all.add(this); cv.addEventListener('pointerdown',()=>this.tap()); if(!col['ink-1']) recolor(); loop(); }
    size(){ const r=this.cv.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,2); this.w=r.width||120; this.h=r.height||120;
      this.cv.width=Math.round(this.w*d); this.cv.height=Math.round(this.h*d); this.c.setTransform(d,0,0,d,0,0); this.dirty=true; }
    set(s){ if(!T[s]||this.state===s) return; this.state=s; this.dirty=true; clearTimeout(this.back);
      if(s==='error'){ this.shake=1; this.back=setTimeout(()=>this.set('idle'),1400); }
      if(s==='success'){ this.sqv+=2.4; this.back=setTimeout(()=>this.set('idle'),1800); }
      loop(); }
    kick(a=.35){ this.pulse=Math.min(1,this.pulse+a); this.dirty=true; loop(); }
    look(x,y){ this.tx=Math.max(-1,Math.min(1,x)); this.ty=Math.max(-1,Math.min(1,y)); loop(); }
    tap(){ this.sqv-=3.4; this.ph+=.5; this.blink=1; this.dirty=true; vib(6); loop(); }
    step(dt,now){ const t={err:0,...T[this.state]}, p=this.p, k=1-Math.exp(-dt/.28);
      for(const key in t) p[key]+=(t[key]-p[key])*k;
      const a=-520*this.sq-26*this.sqv; this.sqv+=a*dt; this.sq+=this.sqv*dt;          // пружина касания k 520, c 26
      this.pulse*=Math.exp(-dt/.15); this.shake*=Math.exp(-dt/.25);
      this.ph+=p.spin*dt; this.hp+=(.03+p.hue)*dt;
      // взгляд: за пальцем, если он рядом; печатаешь — вниз, на поле; думает — вверх
      if(this.state==='listen'){ this.tx=0; this.ty=.75; } else if(this.state==='think'){ this.tx=.5*Math.sin(now/500); this.ty=-.6; }
      else if(px>=0){ const r=this.cv.getBoundingClientRect(); const dx=px-(r.left+r.width/2), dy=py-(r.top+r.height/2), m=Math.hypot(dx,dy)||1, f=Math.min(1,m/240); this.tx=dx/m*f; this.ty=dy/m*f; }
      const kl=1-Math.exp(-dt/.12); this.lx+=(this.tx-this.lx)*kl; this.ly+=(this.ty-this.ly)*kl;
      // моргание: раз в 2.5–6 с, 140 мс
      if(now>this.nextBlink){ this.blink=1; this.nextBlink=now+2500+Math.random()*3500; }
      this.blink=Math.max(0,this.blink-dt/.14); }
    draw(now){ const c=this.c, w=this.w, h=this.h, p=this.p, t=(now-this.t0)/1000, rm=reduce();
      c.clearRect(0,0,w,h);
      const small=w<56, breath=rm?0:.03*Math.sin(t*2*Math.PI/4.2);
      const R=Math.min(w,h)*this.k*(1+breath+this.pulse*.07)*(1+this.sq*.07);
      const tilt=p.tilt+(rm?0:(this.state==='think'?.55*Math.sin(t*2*Math.PI/1.4):.06*Math.sin(t/3.1)));
      const yaw=rm?.25:.25+.2*Math.sin(t/5.3);
      const cx=w/2+(rm?0:this.shake*6*Math.sin(t*2*Math.PI*7)), cy=h/2;
      // свечение
      if(!small){ const g=c.createRadialGradient(cx,cy,R*.2,cx,cy,R*1.9), a=col.glow*p.glow*(p.err>.5?.6:1);
        const g1=p.err>.5?col.err:pal(this.hp), g2=p.err>.5?col.err:pal(this.hp+.5);
        g.addColorStop(0,`rgba(${g1},${(a*.9).toFixed(3)})`); g.addColorStop(.55,`rgba(${g2},${(a*.45).toFixed(3)})`); g.addColorStop(1,`rgba(${g2},0)`);
        c.fillStyle=g; c.beginPath(); c.arc(cx,cy,R*1.9,0,7); c.fill(); }
      const ca=Math.cos(tilt), sa=Math.sin(tilt), cb=Math.cos(yaw), sb=Math.sin(yaw);
      const pr=(x,y)=>{ const y1=y*ca, z1=y*sa; return [x*cb+z1*sb, y1, -x*sb+z1*cb]; };
      const L=R*(p.len+this.pulse*.25);
      for(let i=0;i<this.n;i++){
        const a=i/this.n*Math.PI*2+this.ph, x=R*Math.cos(a), y=R*Math.sin(a), dx=-Math.sin(a), dy=Math.cos(a);
        const P=pr(x,y), A=pr(x-dx*L,y-dy*L), B=pr(x+dx*L,y+dy*L), front=P[2]<=0;
        const g=Math.cos(a+Math.PI/2), gap=p.gap*Math.max(0,(g-.55)/.45);
        let al=(front?.95:.32)*(1-gap); if(al<.02) continue;
        let cc=pal(this.hp+i/this.n); if(p.err>0) cc=mix(cc,col.err,p.err);
        c.strokeStyle=`rgba(${cc},${al.toFixed(3)})`; c.lineWidth=front?this.lw:this.lw*.8;
        c.setLineDash(front||small?[]:[3,3]); c.beginPath(); c.moveTo(cx+A[0],cy+A[1]); c.lineTo(cx+B[0],cy+B[1]); c.stroke();
      }
      c.setLineDash([]);
      // глаза
      if(this.eyes){ const ink=col['ink-1'], ex=R*.3, ey=R*.02, ew=Math.max(1.6,R*.13), eh=Math.max(2,R*.27)*p.eye, ox=this.lx*R*.22, oy=this.ly*R*.18;
        c.fillStyle=c.strokeStyle=`rgb(${ink})`; c.lineCap='round';
        for(const s of [-1,1]){ const X=cx+s*ex+ox, Y=cy+ey+oy;
          if(p.happy>.5){ c.lineWidth=ew*.8; c.beginPath(); c.arc(X,Y+eh*.25,ew*1.1,Math.PI*1.15,Math.PI*1.85); c.stroke(); }
          else if(p.err>.5){ c.lineWidth=ew*.7; c.beginPath(); c.moveTo(X-ew*.9,Y); c.lineTo(X+ew*.9,Y); c.stroke(); }
          else { const hh=Math.max(ew*.35,eh*(1-this.blink)); c.beginPath(); c.ellipse(X,Y,ew/2,hh/2,0,0,7); c.fill(); } } }
      this.dirty=false; }
  }
  function loop(){ if(!raf){ last=performance.now(); raf=requestAnimationFrame(tick); } }
  function tick(now){ raf=0; const dt=Math.min(.05,(now-last)/1000); last=now; let any=false;
    for(const o of all){ if(!o.cv.isConnected){ all.delete(o); continue; } if(D.hidden) continue;
      o.step(dt,now);
      if(reduce()){ if(o.dirty||Math.abs(o.sqv)>.01||o.blink>0){ o.draw(now); any=true; } } else { o.draw(now); any=true; } }
    if(any||reduce()&&all.size) raf=requestAnimationFrame(tick); }
  D.addEventListener('visibilitychange',loop);
  addEventListener('pointermove',e=>{ px=e.clientX; py=e.clientY; },{passive:true});
  addEventListener('resize',()=>all.forEach(o=>o.size()));
  new MutationObserver(recolor).observe(root,{attributes:true,attributeFilter:['data-theme']});
  return {make:(cv,o)=>{ if(cv.__luka) return cv.__luka; return cv.__luka=new L(cv,o); }, recolor};
})();

/* ───────── спросить Луку: открыть свой вариант и окно наставника ───────── */
const TUTOR_DZ=/^(ng[1-5]|ig[3-6])$/;
function myVar(){ const n=+J(LS.get('nch2_dzvar'),0)||0; return n>=1&&n<=30?n:0; }
function target(){
  const l=J(LS.get('nch2_last'),null), m=l&&/^#\/((?:ng|ig)\d)\/(\d{1,2})(?:\/|$)/.exec(l.href||'');
  if(m&&TUTOR_DZ.test(m[1])) return {id:m[1],n:+m[2]};
  let id=null; try{ id=window.DZNEXT&&DZNEXT(); }catch(e){}
  return {id:id&&TUTOR_DZ.test(id)?id:null,n:myVar()};
}
function toast(t){ try{ if(window.FX&&FX.toast) return FX.toast(t); }catch(e){} const el=$('#toast'); if(el){ el.textContent=t; el.classList.add('on'); setTimeout(()=>el.classList.remove('on'),2600); } }
async function ask(q){
  q=String(q||'').trim(); const t=target();
  if(!window.TUTOR){ location.hash='#/ask'; toast('Лука пока не подключён — вопрос можно задать автору'); return; }
  if(!t.id){ location.hash='#/dz'; toast('Выбери ДЗ — и Лука разберёт его на твоём чертеже'); return; }
  if(!t.n){ location.hash='#/'+t.id; toast('Выбери свой вариант — Лука ответит по твоему чертежу'); return; }
  const h='#/'+t.id+'/'+t.n; if(!location.hash.startsWith(h)) location.hash=h;
  for(let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,100)); if($('.tu-fab')||$('.tu')) break; }
  try{ TUTOR.open(); }catch(e){}
  if(q){ setTimeout(()=>{ const inp=$('.tu [data-in]'); if(inp){ inp.value=q; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.focus(); } },120); }
}

/* ───────── нижнее меню: Тетрадь · ДЗ · Лука · РК · Теория ───────── */
const IC={
  wb:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  dz:'<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 14l2 2 4-4"/>',
  rk:'<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M10 2.5h4"/>',
  th:'<path d="M3 5.5c3-1 6-.6 9 1.4V20c-3-2-6-2.4-9-1.4zM21 5.5c-3-1-6-.6-9 1.4V20c3-2 6-2.4 9-1.4z"/>',
  learn:'<path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8z"/><path d="M4.5 8 12 12.5 19.5 8M12 12.5v8"/>',
};
function subj(){ const h=location.hash||''; if(/^#\/ig/.test(h)) return 'ig'; if(/^#\/ng/.test(h)) return 'ng'; return SS.get('sv_subj')||'ng'; }
function active(){ const h=location.hash||'#/';
  if(h==='#/'||h==='#'||h==='') return 'luka';
  if(/^#\/(ng\/tasks|ig\/wb)/.test(h)) return 'wb';
  if(/^#\/(dz|ng\d|ig\d)/.test(h)) return 'dz';
  if(/^#\/(ng\/rk2|rk)/.test(h)) return 'rk';
  if(/^#\/(ig\/learn|prep)/.test(h)) return 'learn';
  if(/^#\/(ng\/path|ig\/theory|ig\/path)/.test(h)) return 'th';
  return ''; }
let nav=null, tabLuka=null;
function buildNav(){
  const s=subj(); SS.set('sv_subj',s);
  const items=s==='ig'
    ?[['wb','Тетрадь','#/ig/wb'],['dz','ДЗ','#/dz'],['luka','Лука','#/'],['learn','Учиться','#/ig/learn'],['th','Теория','#/ig/theory']]
    :[['wb','Тетрадь','#/ng/tasks'],['dz','ДЗ','#/dz'],['luka','Лука','#/'],['rk','РК','#/ng/rk2'],['th','Теория','#/ng/path']];
  const key=s+items.map(x=>x[0]).join();
  if(!nav){ nav=D.createElement('nav'); nav.id='sv-nav'; nav.setAttribute('aria-label','Разделы'); D.body.appendChild(nav); }
  if(nav.dataset.key!==key){ nav.dataset.key=key;
    nav.innerHTML=items.map(([k,t,h])=>k==='luka'
      ?`<a href="${h}" class="luka-tab" data-k="luka" aria-label="Лука — главная"><canvas aria-hidden="true"></canvas><span>${t}</span></a>`
      :`<a href="${h}" data-k="${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg><span>${t}</span></a>`).join('');
    tabLuka=Luka.make($('canvas',nav),{n:12,lw:1.4,k:.25}); }
  const a=active(); $$('a',nav).forEach(x=>{ if(x.dataset.k===a) x.setAttribute('aria-current','page'); else x.removeAttribute('aria-current'); });
}

/* ───────── «Сейчас делаешь» ───────── */
let now=null;
function buildNow(){
  const l=J(LS.get('nch2_last'),null), h=location.hash||'#/';
  if(!now){ now=D.createElement('a'); now.id='sv-now'; now.hidden=true; D.body.appendChild(now);
    now.addEventListener('click',e=>{ if(e.target.closest('.x')){ e.preventDefault(); SS.set('sv_now_x',(J(LS.get('nch2_last'),{})||{}).href||'1'); now.hidden=true; } }); }
  const show=l&&l.href&&/^#\//.test(l.href)&&!h.startsWith(l.href)&&SS.get('sv_now_x')!==l.href&&!/^#\/(dz|prep)/.test(h);
  if(!show){ now.hidden=true; return; }
  now.href=l.href; now.setAttribute('aria-label','Продолжить: '+(l.label||''));
  now.innerHTML=`<span class="nb"><small>Продолжить</small><b>${String(l.label||'').replace(/</g,'&lt;')}</b></span><span class="go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"/></svg></span><button type="button" class="x" aria-label="Скрыть"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  now.hidden=false;
}

/* ───────── главная: оживить Луку в центре ───────── */
let homeL=null;
function enhance(){
  const cv=$('#lukaOrb');
  if(cv&&!cv.__luka){ homeL=Luka.make(cv,{n:24,lw:2.2,k:.3});
    const inp=$('#hsMount .sr-in');
    if(inp){ inp.addEventListener('focus',()=>homeL.set('listen')); inp.addEventListener('input',()=>{ homeL.set(inp.value?'listen':'idle'); homeL.kick(.4); });
      inp.addEventListener('blur',()=>setTimeout(()=>{ if(!inp.value) homeL.set('idle'); },150)); }
    const res=$('#srHres'); if(res) new MutationObserver(()=>lukaRow(res,inp)).observe(res,{childList:true});
    $$('[data-luka-ask]').forEach(b=>b.addEventListener('click',()=>{ homeL&&homeL.set('think'); setTimeout(()=>ask(b.dataset.lukaAsk),350); }));
  }
  const fab=$('.tu-fab'); if(fab&&!fab.__sv){ fab.__sv=1; fab.innerHTML='<canvas aria-hidden="true"></canvas>Спросить Луку'; fab.setAttribute('aria-label','Спросить Луку'); Luka.make($('canvas',fab),{n:12,lw:1.3,k:.25}); }
  const hb=$('.tu .tu-h b'); if(hb&&hb.textContent!=='Лука') hb.textContent='Лука';
  const hi=$('.tu .tu-hi b'); if(hi&&/наставник/i.test(hi.textContent)) hi.textContent=hi.textContent.replace(/Я твой наставник/i,'Я Лука, твой наставник');
}
/* первая строка результатов — «Спросить Луку», если это вопрос, а не номер */
function lukaRow(res,inp){
  const q=(inp&&inp.value||'').trim(); if(!q||/^\s*(№\s*)?\d+\s*$/.test(q)||res.querySelector('.sr-luka')) return;
  res.insertAdjacentHTML('afterbegin',`<section class="sr-g sr-q"><a class="sr-it sr-luka" href="#" role="option"><canvas aria-hidden="true"></canvas><span><b>Спросить Луку: «${q.replace(/[<&"]/g,'')}»</b><small>Разберёт на чертеже твоего варианта</small></span></a></section>`);
  const a=$('.sr-luka',res); Luka.make($('canvas',a),{n:12,lw:1.2,k:.25,eyes:true});
  a.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); homeL&&homeL.set('think'); setTimeout(()=>ask(q),350); });
}

/* ───────── вход по коду (занавеска копии, не защита) ───────── */
function gate(){
  if(LS.get('nch-preview-ok')==='1') return;
  const g=D.createElement('div'); g.id='sv-gate'; g.setAttribute('role','dialog'); g.setAttribute('aria-label','Вход в превью');
  g.innerHTML='<canvas aria-hidden="true"></canvas><h2>Новый Начерт</h2><p>Введи код</p><div class="pin" aria-live="polite"><i></i><i></i><i></i><i></i></div><div class="pad">'+
    [1,2,3,4,5,6,7,8,9].map(n=>`<button type="button" data-k="${n}">${n}</button>`).join('')+'<span></span><button type="button" data-k="0">0</button><button type="button" class="t" data-k="del">Стереть</button></div>';
  D.body.appendChild(g); const L=Luka.make($('canvas',g),{n:24,lw:1.8}); let v='';
  const pin=$('.pin',g), show=()=>$$('i',pin).forEach((d,i)=>d.classList.toggle('on',i<v.length));
  const key=k=>{ if(k==='del'){ v=v.slice(0,-1); show(); return; } if(v.length>=4) return; v+=k; show(); L.kick(.5); vib(6);
    if(v.length===4) setTimeout(()=>{ if(v==='1830'){ LS.set('nch-preview-ok','1'); L.set('success'); setTimeout(()=>g.remove(),500); } else { L.set('error'); pin.classList.remove('bad'); void pin.offsetWidth; pin.classList.add('bad'); vib([30,40,30]); v=''; show(); } },150); };
  g.addEventListener('click',e=>{ const b=e.target.closest('[data-k]'); if(b) key(b.dataset.k); });
  addEventListener('keydown',e=>{ if(!g.isConnected) return; if(/^\d$/.test(e.key)) key(e.key); else if(e.key==='Backspace') key('del'); });
}

/* ───────── сборка ───────── */
function sync(){ buildNav(); buildNow(); enhance(); }
function start(){
  gate(); sync();
  addEventListener('hashchange',()=>setTimeout(sync,0));
  const v=$('#view'); if(v) new MutationObserver(()=>enhance()).observe(v,{childList:true});
  new MutationObserver(()=>enhance()).observe(D.body,{childList:true});   // окно наставника появляется позже
}
if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',start); else start();
window.LUKA={make:Luka.make,ask,state:s=>{ homeL&&homeL.set(s); }};
})();
