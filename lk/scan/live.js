/* ═══════════ Живой сканер листа: камера → лист в кадре → автоснимок → ровный лист ═══════════
   Как сканер документов в банковском приложении: видео с задней камеры, каждый кадр (≈ 10 в секунду, 480 px) оценивается
   на телефоне — где лист, наклон, резкость, блик, свет, устойчивость (lab/dz/capture.js analyze); на видео — контур листа
   и одна главная подсказка. Кадр хороший и устойчив 0,6 с — снимок сам (или кнопкой): полное разрешение сенсора
   (ImageCapture.takePhoto, если есть; иначе кадр видео до 4K), лист выпрямляется по четырём углам (гомография, билинейно) —
   ровный лист без стола и перспективы уходит в конвейер сканера (pipeline.js) как обычное фото. Фото никуда не уходит,
   пока студент не нажал «Распознать» (облачная функция — только кадры чертежей, как раньше).
   LIVESCAN.supported() → есть ли камера в этом браузере;
   После снимка листа — выбор: «Распознать лист» (onShot) или «Снять каждый чертёж крупно» — по снимку вблизи на чертёж (onShots).
   LIVESCAN.open({onShot(file, meta), onShots(files, meta), closeups, onClose()}) — открыть сканер поверх страницы; meta: {w, h, rectified, quality};
     onShots — снимки вблизи (по чертежу на снимке), meta: {sheet: файл ровного листа, sheetMeta, shots:[meta]}; closeups — сколько чертежей ждать (4);
   LIVESCAN.rectify(canvas, quad [[x,y]↖↗↘↙], maxSide) → canvas ровного листа (для тестов и «Из галереи»). */
(function(){
'use strict';
const need=['/lab/img.js','/lab/dz/capture.js'];
function load(v){ const miss=need.filter(s=>!(s==='/lab/img.js'?self.LAB&&self.LAB.img:self.LAB&&self.LAB.dzCapture));
  return miss.reduce((p,src)=>p.then(()=>new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src+'?v='+(v||'live1'); s.onload=res; s.onerror=()=>rej(new Error('не загрузился '+src)); document.head.appendChild(s); })),Promise.resolve()); }
const supported=()=>!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);

/* ровный лист: стороны — средние длины противоположных сторон четырёхугольника, длинная — не больше maxSide (и не больше,
   чем было пикселей на фото: увеличивать незачем); каждый пиксель — обратной гомографией, билинейно */
function rectify(src,quad,maxSide){ const H=self.LAB.img.H, L=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
  let W=(L(quad[0],quad[1])+L(quad[3],quad[2]))/2, Hh=(L(quad[0],quad[3])+L(quad[1],quad[2]))/2; const k=Math.min(1,(maxSide||3600)/Math.max(W,Hh)); W=Math.round(W*k); Hh=Math.round(Hh*k);
  const M=H.fit([[0,0],[W,0],[W,Hh],[0,Hh]],quad), sw=src.width, sh=src.height, sd=src.getContext('2d').getImageData(0,0,sw,sh).data;
  const out=document.createElement('canvas'); out.width=W; out.height=Hh; const og=out.getContext('2d'), im=og.createImageData(W,Hh), d=im.data;
  for(let y=0;y<Hh;y++){ for(let x=0;x<W;x++){ const X=x+0.5, Y=y+0.5, z=M[6]*X+M[7]*Y+M[8], u=(M[0]*X+M[1]*Y+M[2])/z-0.5, v=(M[3]*X+M[4]*Y+M[5])/z-0.5;
      const x0=Math.floor(u), y0=Math.floor(v), o=4*(y*W+x); if(x0<0||y0<0||x0>=sw-1||y0>=sh-1){ d[o]=d[o+1]=d[o+2]=255; d[o+3]=255; continue; }
      const fx=u-x0, fy=v-y0, i=4*(y0*sw+x0), j=i+4*sw;
      for(let c=0;c<3;c++) d[o+c]=(sd[i+c]*(1-fx)+sd[i+4+c]*fx)*(1-fy)+(sd[j+c]*(1-fx)+sd[j+4+c]*fx)*fy; d[o+3]=255; } }
  og.putImageData(im,0,0); return out; }

/* углы листа точнее: грубый четырёхугольник (по маске 480 px) → на кадре ≈ 1200 px вдоль каждой стороны ищется край бумаги
   поперёк стороны (наибольший перепад «светлая бумага → тёмный фон» в полосе ± 4 % кадра), по точкам края — прямая МНК
   с отбросом выбросов (пальцы, тень, загнутый угол), углы — пересечения соседних прямых. Не сошлось — грубые углы */
function refineQuad(src,quad){ const k=Math.min(1,1200/Math.max(src.width,src.height)), w=Math.round(src.width*k), h=Math.round(src.height*k), c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(src,0,0,w,h); const d=g.getImageData(0,0,w,h).data, a=new Float32Array(w*h); for(let i=0;i<w*h;i++) a[i]=0.299*d[4*i]+0.587*d[4*i+1]+0.114*d[4*i+2];
  const at=(x,y)=>{ const X=Math.round(x), Y=Math.round(y); return X<0||Y<0||X>=w||Y>=h?null:a[Y*w+X]; }, Q=quad.map(p=>[p[0]*k,p[1]*k]), cx=Q.reduce((s,p)=>s+p[0],0)/4, cy=Q.reduce((s,p)=>s+p[1],0)/4, band=0.04*Math.max(w,h);
  const lines=[]; for(let i=0;i<4;i++){ const A=Q[i], B=Q[(i+1)%4], L=Math.hypot(B[0]-A[0],B[1]-A[1]); if(L<20) return quad; let nx=-(B[1]-A[1])/L, ny=(B[0]-A[0])/L;
    if(nx*(cx-A[0])+ny*(cy-A[1])<0){ nx=-nx; ny=-ny; }   /* нормаль — внутрь листа */
    const P=[]; for(let t=0.08;t<=0.92;t+=0.01){ const px=A[0]+(B[0]-A[0])*t, py=A[1]+(B[1]-A[1])*t; let best=0, bs=null;
      for(let s=-band;s<=band;s+=0.5){ const i1=at(px+nx*(s+2),py+ny*(s+2)), o1=at(px+nx*(s-2),py+ny*(s-2)); if(i1==null||o1==null) continue; const gr=i1-o1; if(gr>best){ best=gr; bs=s; } }
      if(bs!=null&&best>12) P.push([px+nx*bs,py+ny*bs]); }
    if(P.length<10) return quad;
    let use=P, fit=null; for(let it=0;it<3;it++){ const n=use.length, mx=use.reduce((s,p)=>s+p[0],0)/n, my=use.reduce((s,p)=>s+p[1],0)/n; let sxx=0,syy=0,sxy=0; use.forEach(p=>{ sxx+=(p[0]-mx)**2; syy+=(p[1]-my)**2; sxy+=(p[0]-mx)*(p[1]-my); });
      const th=0.5*Math.atan2(2*sxy,sxx-syy); fit={x:mx,y:my,dx:Math.cos(th),dy:Math.sin(th)}; const r=P.map(p=>Math.abs((p[0]-fit.x)*fit.dy-(p[1]-fit.y)*fit.dx)), lim=Math.max(1.5,2.5*r.slice().sort((x,y)=>x-y)[r.length>>1]);
      use=P.filter((p,j)=>r[j]<=lim); if(use.length<10) return quad; }
    lines.push(fit); }
  const X=(p,q)=>{ const den=p.dx*q.dy-p.dy*q.dx; if(Math.abs(den)<0.2) return null; const t=((q.x-p.x)*q.dy-(q.y-p.y)*q.dx)/den; return [p.x+p.dx*t,p.y+p.dy*t]; };
  const out=[]; for(let i=0;i<4;i++){ const p=X(lines[(i+3)%4],lines[i]); if(!p) return quad; out.push([p[0]/k,p[1]/k]); }
  /* уточнённый угол дальше 6 % кадра от грубого — что-то не так (палец, второй лист): грубые углы */
  if(out.some((p,i)=>Math.hypot(p[0]-quad[i][0],p[1]-quad[i][1])>0.06*Math.max(src.width,src.height))) return quad;
  return out; }

/* углы для выпрямления: уточнённые и на 0,5 % внутрь листа — край бумаги найден до пикселя, а полоска стола не нужна */
function sheetQuad(src,quad){ const qr=refineQuad(src,quad), c=[qr.reduce((s,p)=>s+p[0],0)/4,qr.reduce((s,p)=>s+p[1],0)/4]; return qr.map(p=>[c[0]+(p[0]-c[0])*0.995,c[1]+(p[1]-c[1])*0.995]); }

/* снимок вблизи — не больше CLOSE_SIDE px: конвейер режет чертёж до 2000 px (pipeline.CUT_SIDE), больше ему не нужно, а 12 Мп × 4
   снимка — сотни мегабайт памяти телефона. Снимаем всё равно в полном разрешении сенсора и уменьшаем сглаживанием — так
   чётче, чем кадр видео */
const CLOSE_SIDE=2400;
function fitSide(src,side){ const k=Math.min(1,side/Math.max(src.width,src.height)); if(k===1) return src; const c=document.createElement('canvas'); c.width=Math.round(src.width*k); c.height=Math.round(src.height*k);
  const g=c.getContext('2d'); g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high'; g.drawImage(src,0,0,c.width,c.height); return c; }
const plural=(n,a,b,c)=>{ const m=n%10, h=n%100; return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c; };

const CSS=`.lv{position:fixed;inset:0;z-index:9999;background:#000;color:#fff;font:500 15px/1.35 system-ui,sans-serif;display:flex;flex-direction:column;touch-action:none}
.lv video,.lv canvas.ov{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.lv .tp{position:absolute;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top) + 12px) 16px 12px;display:flex;gap:10px;align-items:center;background:linear-gradient(#000a,#0000)}
.lv .tp b{flex:1;font-weight:700;font-size:16px}.lv button{font:inherit;color:inherit;border:0;cursor:pointer}
.lv.close .tp b{font-size:15px;font-weight:600}
.lv .x{width:40px;height:40px;border-radius:50%;background:#fff2;font-size:22px;line-height:40px;flex:none}
.lv .hint{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 132px);max-width:calc(100% - 32px);padding:10px 16px;border-radius:999px;background:#000b;text-align:center;transition:background .2s}
.lv .hint.ok{background:#1a7f3ccc}
.lv .bt{position:absolute;left:0;right:0;bottom:0;padding:16px 16px calc(env(safe-area-inset-bottom) + 22px);display:flex;align-items:center;justify-content:center;gap:28px;background:linear-gradient(#0000,#000a)}
.lv .sh{width:78px;height:78px;border-radius:50%;background:#fff;box-shadow:0 0 0 5px #fff5;position:relative}
.lv .sh svg{position:absolute;inset:-9px;width:96px;height:96px;transform:rotate(-90deg)}
.lv .sm{width:48px;height:48px;border-radius:50%;background:#fff2;font-size:13px}
.lv .sm[aria-pressed="true"]{background:#ffd34d;color:#000}
.lv .fl{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s}
.lv .res,.lv .rv{position:absolute;inset:0;background:#0b0f1a;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px;overflow:auto}
.lv .res.on,.lv .rv.on{display:flex}.lv .res img{max-width:100%;max-height:56vh;border-radius:10px;box-shadow:0 10px 40px #000}
.lv .lvrow{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}.lv .lvb{padding:13px 20px;border-radius:14px;background:rgba(255,255,255,.14)!important;color:#fff!important;font-weight:700;border:0!important}.lv .lvb.pri{background:#2a62ff!important}
.lv .lvb:disabled{opacity:.45;cursor:default}
.lv .q{font-size:13px;opacity:.8;text-align:center;max-width:520px}
.lv .cb{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 64px);display:none;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:0 16px}
.lv.close .cb{display:flex}.lv .cb .lvb{padding:9px 14px;border-radius:12px;font-size:14px;background:#000a!important}
.lv .cb .n{padding:8px 12px;border-radius:999px;background:#000a;font-weight:700}
.lv .th{display:flex;gap:6px}.lv .th img{width:40px;height:40px;object-fit:cover;border-radius:6px;border:2px solid #fff8}
.lv .rv .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;width:100%;max-width:560px}
.lv .rv .grid figure{margin:0;position:relative}.lv .rv .grid img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:10px;display:block}
.lv .rv .grid figcaption{position:absolute;left:6px;top:6px;padding:2px 8px;border-radius:999px;background:#000b;font-size:13px}`;

/* «чертёж за чертежом» (после снимка листа): снимок листа целиком даёт ≈ 2,6–4 px/мм — модель не читает мелкие подписи точек
   построения (A‴, A₄), а раскладка листа одним запросом путает рамки. Вблизи (≥ 8 px/мм на чертёж) — и то и другое лучше
   (замер на 20 листах студентов). Автоснимок вблизи: углов листа в кадре нет — устойчивость по сдвигу содержимого кадра
   (capture.shiftOf, как Capturer в режиме content); кадр — не весь лист (лист касается края или занимает ≥ 85 % кадра);
   следующий — только когда телефон перевели с прошлого снимка (содержимое сдвинулось на ≥ 3 % кадра).
   Снимок вблизи НЕ выпрямляется: края листа в кадр не попадают, а «самая светлая область» вблизи — это весь видимый лист,
   упёртый в края кадра, — выпрямление по ней исказило бы чертёж. Небольшой наклон телефона снимает привязка к условию
   варианта (sheetlib.fitVariant: гомография по точкам условия) */
const SHIFT_MOVED=0.03;
function open(o){ o=o||{};
  if(!document.getElementById('lvCss')){ const s=document.createElement('style'); s.id='lvCss'; s.textContent=CSS; document.head.appendChild(s); }
  const root=document.createElement('div'); root.className='lv'; root.setAttribute('role','dialog'); root.setAttribute('aria-label','Сканер листа');
  root.innerHTML='<video playsinline muted autoplay></video><canvas class="ov"></canvas><div class="fl"></div>'
    +'<div class="tp"><b>Наведите камеру на лист</b><button class="x" aria-label="Закрыть">×</button></div>'
    +'<div class="cb"><span class="n">0 из 4</span><span class="th"></span><button class="lvb" data-k="undo" disabled>Переснять последний</button><button class="lvb pri" data-k="done" disabled>Готово</button></div>'
    +'<div class="hint" aria-live="polite">Включаю камеру…</div>'
    +'<div class="bt"><button class="sm" data-k="torch" aria-pressed="false" hidden>Свет</button><button class="sh" aria-label="Снять сейчас"><svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="44" fill="none" stroke="#2a62ff" stroke-width="6" stroke-dasharray="276.5" stroke-dashoffset="276.5" stroke-linecap="round"/></svg></button><button class="sm" data-k="auto" aria-pressed="true">Авто</button></div>'
    +'<div class="res"><img alt="Ровный лист"><div class="q"></div><div class="lvrow"><button class="lvb" data-k="again">Переснять</button><button class="lvb'+(o.onShots?'':' pri')+'" data-k="use">Распознать лист</button></div>'
    +(o.onShots?'<div class="lvrow"><button class="lvb pri" data-k="close">Снять каждый чертёж крупно (точнее)</button></div><div class="q">Крупно — по снимку на чертёж: мелкие подписи точек (A‴, A₄) читаются, ни один чертёж не пропадёт. Дольше на минуту.</div>':'')+'</div>'
    +'<div class="rv"><b class="rvt">Снято чертежей: 0</b><div class="grid"></div><div class="lvrow"><button class="lvb" data-k="undo2">Переснять последний</button><button class="lvb" data-k="more">Ещё чертёж</button><button class="lvb pri" data-k="send">Распознать</button></div></div>';
  document.body.appendChild(root); const $=s=>root.querySelector(s), video=$('video'), ov=$('canvas.ov'), hintEl=$('.hint'), ring=$('.sh circle');
  let stream=null, track=null, raf=0, stop=false, prev=null, goodSince=null, auto=true, busy=false, last=null, shot=null;
  /* «чертёж за чертежом»: mode 'close', want — сколько чертежей (у ДЗ №3 — 4 части), shots — снятые, from — контуры кадра, с которого надо уйти */
  let mode='sheet', want=Math.max(1,o.closeups||4), shots=[], from=null, moved=true;
  const close=()=>{ stop=true; cancelAnimationFrame(raf); if(stream) stream.getTracks().forEach(t=>t.stop()); shots.forEach(s=>URL.revokeObjectURL(s.url)); root.remove(); document.removeEventListener('keydown',esc); if(o.onClose) o.onClose(); };
  const esc=e=>{ if(e.key==='Escape') close(); }; document.addEventListener('keydown',esc);
  $('.x').onclick=close;
  $('[data-k="auto"]').onclick=e=>{ auto=!auto; e.currentTarget.setAttribute('aria-pressed',String(auto)); goodSince=null; };
  $('[data-k="torch"]').onclick=async e=>{ const on=e.currentTarget.getAttribute('aria-pressed')!=='true'; try{ await track.applyConstraints({advanced:[{torch:on}]}); e.currentTarget.setAttribute('aria-pressed',String(on)); }catch(err){} };
  $('.sh').onclick=()=>mode==='close'?takeClose(true):take(true);
  const resume=()=>{ busy=false; goodSince=null; last=null; loop(); };
  $('[data-k="again"]').onclick=()=>{ $('.res').classList.remove('on'); shot=null; resume(); };
  $('[data-k="use"]').onclick=()=>{ if(!shot) return; const s=shot; close(); if(o.onShot) o.onShot(s.file,s.meta); };
  /* лист снят — дальше каждый чертёж вблизи; первый снимок вблизи — только когда телефон ушёл с общего плана */
  $('[data-k="close"]')&&($('[data-k="close"]').onclick=()=>{ mode='close'; root.classList.add('close'); from=shot&&shot.thumb||null; moved=!from; $('.res').classList.remove('on'); bar(); resume(); });
  const undo=()=>{ const s=shots.pop(); if(s) URL.revokeObjectURL(s.url); from=shots.length?shots[shots.length-1].thumb:(shot&&shot.thumb)||null; moved=true;   /* переснимают тот же чертёж — с него уходить не нужно */
    $('.rv').classList.remove('on'); bar(); resume(); };
  $('[data-k="undo"]').onclick=undo; $('[data-k="undo2"]').onclick=undo;
  $('[data-k="more"]').onclick=()=>{ want=shots.length+1; $('.rv').classList.remove('on'); bar(); resume(); };
  const finish=()=>{ if(!shots.length) return; const fs=shots.map(s=>s.file), meta={sheet:shot?shot.file:null,sheetMeta:shot?shot.meta:null,shots:shots.map(s=>s.meta)}; close(); if(o.onShots) o.onShots(fs,meta); };
  $('[data-k="done"]').onclick=finish; $('[data-k="send"]').onclick=finish;
  const hint=(t,ok)=>{ hintEl.textContent=t; hintEl.classList.toggle('ok',!!ok); };
  const title=t=>{ $('.tp b').textContent=t; };
  /* счётчик, миниатюры, кнопки и заголовок режима «чертёж за чертежом» */
  function bar(){ const k=shots.length; $('.cb .n').textContent=k+' из '+want; $('.cb .th').innerHTML=shots.slice(-4).map(s=>'<img alt="" src="'+s.url+'">').join('');
    $('[data-k="undo"]').disabled=!k; $('[data-k="done"]').disabled=!k; $('[data-k="done"]').textContent=k?'Готово ('+k+')':'Готово';
    title('Чертёж '+Math.min(k+1,want)+' из '+want+': поднесите телефон, чтобы чертёж занял весь кадр'); }
  function review(){ busy=true; cancelAnimationFrame(raf); const k=shots.length;
    $('.rvt').textContent='Снято '+k+' '+plural(k,'чертёж','чертежа','чертежей');
    $('.rv .grid').innerHTML=shots.map((s,i)=>'<figure><img alt="Чертёж '+(i+1)+'" src="'+s.url+'"><figcaption>'+(i+1)+'</figcaption></figure>').join('');
    $('[data-k="send"]').textContent='Распознать '+k+' '+plural(k,'чертёж','чертежа','чертежей'); $('.rv').classList.add('on'); }

  /* кадр видео → его RGBA 480 px (для оценки) */
  const probe=document.createElement('canvas'), pg=probe.getContext('2d',{willReadFrequently:true});
  function frame(){ const vw=video.videoWidth, vh=video.videoHeight; if(!vw) return null; const k=480/Math.max(vw,vh); probe.width=Math.round(vw*k); probe.height=Math.round(vh*k);
    pg.drawImage(video,0,0,probe.width,probe.height); return {im:pg.getImageData(0,0,probe.width,probe.height),k}; }
  /* контур листа на видео (видео — object-fit: cover); вблизи — рамка кадра цвета готовности */
  function draw(A,k,good,progress){ const r=root.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio||1); ov.width=r.width*dpr; ov.height=r.height*dpr; const g=ov.getContext('2d'); g.clearRect(0,0,ov.width,ov.height);
    ring.style.strokeDashoffset=String(276.5*(1-progress));
    if(mode==='close'){ const m=18*dpr, w=ov.width-2*m; g.lineWidth=4*dpr; g.strokeStyle=good?'#3ddc84':'#ffd34d'; g.setLineDash([18*dpr,12*dpr]); g.strokeRect(m,120*dpr,w,ov.height-120*dpr-170*dpr);   /* между счётчиком сверху и кнопкой снизу */ g.setLineDash([]); return; }
    if(!A||!A.paper) return; const vw=video.videoWidth, vh=video.videoHeight, s=Math.max(r.width/vw,r.height/vh)*dpr, ox=(ov.width-vw*s)/2, oy=(ov.height-vh*s)/2;
    const pts=A.paper.quad.map(p=>[ox+p[0]/k*s,oy+p[1]/k*s]);   /* quad — в px кадра оценки (480): ÷ k → px видео */
    g.lineWidth=4*dpr; g.lineJoin='round'; g.strokeStyle=good?'#3ddc84':'#ffd34d'; g.fillStyle=good?'rgba(61,220,132,.16)':'rgba(255,211,77,.10)';
    g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.fill(); g.stroke();
    /* уголки, как у сканера документов */
    g.lineWidth=7*dpr; g.strokeStyle='#fff'; pts.forEach((p,i)=>{ const a=pts[(i+3)%4], b=pts[(i+1)%4], u=t=>[p[0]+(t[0]-p[0])*0.12,p[1]+(t[1]-p[1])*0.12]; const pa=u(a), pb=u(b); g.beginPath(); g.moveTo(pa[0],pa[1]); g.lineTo(p[0],p[1]); g.lineTo(pb[0],pb[1]); g.stroke(); }); }
  const HOLD=600;
  /* вблизи: годен ли кадр → [готов, подсказка] */
  function closeState(A){ const C=self.LAB.dzCapture, LIM=C.LIM;
    if(!A.paper) return [false,'Не вижу листа — наведите камеру на чертёж'];
    if(A.light<LIM.light) return [false,'Мало света — включите свет или подойдите к окну'];
    if(A.paper.touch<0.05&&A.paper.fill<0.85) return [false,'Весь лист в кадре — поднесите телефон ближе к чертежу'];
    /* кадр видео другого размера, чем при снимке (снимок в полном разрешении перестраивает поток камеры), — контуры несравнимы
       (shiftOf дал бы «другое»): точкой отсчёта становится текущий кадр */
    if(!moved&&from&&A.thumb&&(from.w!==A.thumb.w||from.h!==A.thumb.h)) from=A.thumb;
    if(!moved&&from&&A.thumb){ if(C.shiftOf(from,A.thumb)>=SHIFT_MOVED) moved=true; else return [false,shots.length?'Этот чертёж уже снят — наведите на следующий':'Поднесите телефон к первому чертежу']; }
    if(A.shift==null||A.shift>=LIM.motion) return [false,'Держите телефон неподвижно…'];
    /* блик — совет, не запрет (как Capturer в режиме content): на синтетике и у настоящих листов под лампой «сильный» блик бывает
       почти во всём кадре, и автоснимок не случился бы никогда; нечитаемый снимок — «Переснять последний» */
    if(A.glare>0.15) return [true,'Блик на листе — лучше чуть наклонить телефон'+(auto?'; снимаю':'')];
    return [true,auto?'Чертёж в кадре — не двигайтесь, снимаю':'Готово к снимку — нажмите кнопку']; }
  function loop(){ if(stop||busy) return; raf=requestAnimationFrame(loop); const now=performance.now(); if(last&&now-last<90) return; last=now;
    const f=frame(); if(!f) return; let A; try{ A=self.LAB.dzCapture.analyze(f.im,prev); }catch(e){ return; } prev=A;
    if(mode==='close'){ const [ok,t]=closeState(A); if(ok){ if(goodSince==null) goodSince=now; } else goodSince=null;
      const progress=goodSince==null?0:Math.min(1,(now-goodSince)/HOLD); draw(A,f.k,ok,auto?progress:0); hint(t,ok); if(auto&&progress>=1) takeClose(false); return; }
    /* «целиком» при съёмке листа — обязательно; наклон допускаем больше (выпрямим), но не сильный: дальний край мелкий */
    const ok=A.ok&&A.paper&&A.paper.touch<0.05, stable=ok&&A.motion!=null&&A.motion<0.012;
    if(stable){ if(goodSince==null) goodSince=now; } else goodSince=null;
    const progress=goodSince==null?0:Math.min(1,(now-goodSince)/HOLD);
    draw(A,f.k,ok,auto?progress:0);
    if(!A.paper) hint('Не вижу листа — наведите камеру на лист целиком');
    else if(!A.ok) hint(A.hints[0][0].toUpperCase()+A.hints[0].slice(1));
    else if(A.paper.touch>=0.05) hint('Лист касается края кадра — отодвиньте телефон');
    else if(!stable) hint('Держите телефон неподвижно…');
    else hint(auto?'Отлично, не двигайтесь — снимаю':'Готово к снимку — нажмите кнопку',true);
    if(auto&&progress>=1) take(false); }
  /* кадр в полном разрешении сенсора — ImageCapture (Android Chrome); снимок другого размера, чем видео (другие пропорции), — кадр видео */
  async function grab(){ const vw=video.videoWidth, vh=video.videoHeight, src=document.createElement('canvas'); let bmp=null;
    if(self.ImageCapture&&track){ try{ const blob=await new ImageCapture(track).takePhoto(); bmp=await createImageBitmap(blob,{imageOrientation:'from-image'}); }catch(e){ bmp=null; } }
    if(bmp&&Math.abs(bmp.width/bmp.height-vw/vh)<0.03){ src.width=bmp.width; src.height=bmp.height; src.getContext('2d').drawImage(bmp,0,0); }
    else { src.width=vw; src.height=vh; src.getContext('2d').drawImage(video,0,0); }
    return {src,vw,vh}; }
  const flash=()=>{ const fl=$('.fl'); fl.style.opacity='0.85'; setTimeout(()=>{ fl.style.opacity='0'; },120); };
  async function take(manual){ if(busy) return; const A=prev; if(!A||!A.paper){ hint('Не вижу листа — наведите камеру на лист целиком'); return; } busy=true; cancelAnimationFrame(raf);
    flash(); hint('Снимаю в полном разрешении…',true);
    try{ const {src,vw,vh}=await grab();
      const sx=src.width/vw, quad=A.paper.quad.map(p=>[p[0]/(480/Math.max(vw,vh))*sx,p[1]/(480/Math.max(vw,vh))*sx]);
      const q2=sheetQuad(src,quad);
      const flat=rectify(src,q2,4096), blob=await new Promise(r=>flat.toBlob(r,'image/jpeg',0.92));
      const file=new File([blob],'лист-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.jpg',{type:'image/jpeg'});
      const pxmm=Math.max(flat.width,flat.height)/420;   /* лист А3: 420 мм по длинной стороне */
      shot={file,thumb:A.thumb,meta:{w:flat.width,h:flat.height,rectified:true,manual,source:[src.width,src.height],pxmm:+pxmm.toFixed(1),quality:{sharp:+A.sharp.toFixed(4),glare:+A.glare.toFixed(3),tilt:+A.tilt.toFixed(3),light:+A.light.toFixed(2)}}};
      $('.res img').src=URL.createObjectURL(blob);
      $('.res .q').textContent='Лист выпрямлен: '+flat.width+' × '+flat.height+' px (≈ '+pxmm.toFixed(1).replace('.',',')+' px/мм для А3) · снято с '+src.width+' × '+src.height;
      $('.res').classList.add('on'); }
    catch(e){ hint('Не получилось снять: '+e.message); busy=false; loop(); } }
  /* снимок вблизи: полное разрешение → не больше CLOSE_SIDE, без выпрямления (см. выше) */
  async function takeClose(manual){ if(busy) return; const A=prev; busy=true; cancelAnimationFrame(raf); flash(); hint('Снимаю чертёж '+(shots.length+1)+'…',true);
    try{ const {src}=await grab(), c=fitSide(src,CLOSE_SIDE), blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.92));
      const k=shots.length+1, file=new File([blob],'чертёж-'+k+'-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.jpg',{type:'image/jpeg'});
      shots.push({file,url:URL.createObjectURL(blob),thumb:A&&A.thumb||null,meta:{w:c.width,h:c.height,rectified:false,manual,closeup:true,source:[src.width,src.height],quality:A&&A.paper?{fill:+A.paper.fill.toFixed(2),glare:+A.glare.toFixed(3),light:+A.light.toFixed(2)}:null}});
      from=A&&A.thumb||null; moved=!from; bar();
      if(shots.length>=want) review(); else resume(); }
    catch(e){ hint('Не получилось снять: '+e.message); resume(); } }
  (async()=>{ try{ await load();
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:3840},height:{ideal:2160}}});
      if(stop){ stream.getTracks().forEach(t=>t.stop()); return; } video.srcObject=stream; track=stream.getVideoTracks()[0];
      try{ const cap=track.getCapabilities&&track.getCapabilities(); if(cap&&cap.torch) $('[data-k="torch"]').hidden=false;
        if(cap&&cap.focusMode&&cap.focusMode.includes('continuous')) await track.applyConstraints({advanced:[{focusMode:'continuous'}]}); }catch(e){}
      await video.play().catch(()=>{}); hint('Наведите камеру на лист целиком'); loop(); }
    catch(e){ hint(/Permission|NotAllowed/i.test(e.name+e.message)?'Нет доступа к камере — разрешите его в настройках браузера':'Камера недоступна: '+e.message); } })();
  return {close,get state(){ return {busy,mode,shot:shot&&shot.meta,shots:shots.map(s=>s.meta),want}; }}; }
self.LIVESCAN={open,supported,rectify,refineQuad,sheetQuad,load};
})();
