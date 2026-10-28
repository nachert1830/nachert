/* ═══════════ Съёмка как при проверке документа: живая камера → оценка кадра → автоснимок серии ═══════════
   Кадр видео уменьшается до ~480 px по длинной стороне и оценивается за миллисекунды:
   - лист: самая большая светлая область (порог Оцу), её доля в кадре и четыре угла (крайние точки по диагоналям);
     лист «не целиком» — если область длинно касается края кадра (кроме съёмки вплотную: лист в клетку можно снимать по частям);
   - наклон: разница противоположных сторон четырёхугольника (телефон не параллелен листу — дальний край меньше);
   - резкость: дисперсия лапласиана по листу, нормированная на яркость (смаз и расфокус её роняют);
   - блик: светлое пятно на листе поверх плавного хода света (или пересвет ≥ 0,97) — там графит бледнеет;
   - свет: средняя яркость листа;
   - устойчивость: насколько сдвинулись углы листа с прошлого кадра.
   Снимок — когда всё хорошо и кадр устойчив 0,4 с. Следующий — только после того, как телефон сдвинули (углы ушли
   на ≥ 3 % кадра): у другого ракурса другой блик и другой шум, поэтому кадры серии ошибаются независимо.
   analyze(rgba{width,height,data}, prev) → {ok, hints[] (мешают снимку), soft[] (советы), paper:{fill, quad, quadSmall, touch}, tilt, sharp, glare, light, motion}
   Capturer({shots, max, content}) — автомат съёмки: feed(analysis, now) → 'wait' | 'shot' | 'done-shot' | 'done'; more() — ещё кадр */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const LIM={fill:0.35,touch:0.12,tilt:0.18,sharp:0.002,glare:0.03,light:0.32,motion:0.012};
function small(im,maxSide){ const W=im.width, H=im.height, k=Math.max(1,Math.max(W,H)/(maxSide||480)), w=Math.floor(W/k), h=Math.floor(H/k), g=new Float32Array(w*h), d=im.data;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let s=0, n=0; const x0=Math.floor(x*k), y0=Math.floor(y*k), x1=Math.min(W,Math.floor((x+1)*k)), y1=Math.min(H,Math.floor((y+1)*k));
    for(let yy=y0;yy<y1;yy+=Math.max(1,(y1-y0)>>1)) for(let xx=x0;xx<x1;xx+=Math.max(1,(x1-x0)>>1)){ const i=(yy*W+xx)*4; s+=(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2])/255; n++; }
    g[y*w+x]=s/n; } return {w,h,a:g,k}; }
function solve6(A,b){ const n=b.length, M=A.map((r,i)=>r.concat([b[i]])); for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r; if(Math.abs(M[p][c])<1e-12) return null; [M[c],M[p]]=[M[p],M[c]];
    for(let r=0;r<n;r++){ if(r===c) continue; const f=M[r][c]/M[c][c]; for(let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; } } return M.map((r,i)=>r[n]/r[i]); }
function otsu(a){ const hist=new Float64Array(64); a.forEach(v=>{ hist[Math.min(63,Math.floor(v*64))]++; }); const n=a.length; let sum=0; for(let i=0;i<64;i++) sum+=i*hist[i];
  let sb=0, wb=0, best=0, th=32; for(let i=0;i<64;i++){ wb+=hist[i]; if(!wb) continue; const wf=n-wb; if(!wf) break; sb+=i*hist[i]; const mb=sb/wb, mf=(sum-sb)/wf, v=wb*wf*(mb-mf)**2; if(v>best){ best=v; th=i; } }
  return (th+0.5)/64; }
function analyze(im,prev){ const g=small(im,480), {w,h,a}=g, th=otsu(a), m=new Uint8Array(w*h); for(let i=0;i<w*h;i++) m[i]=a[i]>th?1:0;
  /* самая большая светлая область — лист */
  const lab=new Int32Array(w*h).fill(-1); let best=-1, bestN=0, comp=0; const st=[];
  for(let i=0;i<w*h;i++){ if(!m[i]||lab[i]>=0) continue; let n=0; st.push(i); lab[i]=comp;
    while(st.length){ const j=st.pop(); n++; const x=j%w, y=(j/w)|0; if(x>0&&m[j-1]&&lab[j-1]<0){ lab[j-1]=comp; st.push(j-1); } if(x<w-1&&m[j+1]&&lab[j+1]<0){ lab[j+1]=comp; st.push(j+1); }
      if(y>0&&m[j-w]&&lab[j-w]<0){ lab[j-w]=comp; st.push(j-w); } if(y<h-1&&m[j+w]&&lab[j+w]<0){ lab[j+w]=comp; st.push(j+w); } }
    if(n>bestN){ bestN=n; best=comp; } comp++; }
  const hints=[], out={hints,ok:false};
  if(best<0){ hints.push('не вижу листа — наведите камеру на лист'); return out; }
  /* углы: крайние точки по x+y и x−y; касание края кадра; яркость, блик, резкость — по листу */
  let c=[[1e9,0,0],[-1e9,0,0],[1e9,0,0],[-1e9,0,0]], touch=0, edge=0, sL=0, nL=0, sat=0;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=y*w+x; if(lab[i]!==best) continue; const s=x+y, d=x-y;
    if(s<c[0][0]) c[0]=[s,x,y]; if(s>c[1][0]) c[1]=[s,x,y]; if(d>c[3][0]) c[3]=[d,x,y]; if(d<c[2][0]) c[2]=[d,x,y];
    if(x===0||y===0||x===w-1||y===h-1) touch++; sL+=a[i]; nL++; if(a[i]>=0.97) sat++; }
  edge=2*(w+h);
  const quad=[[c[0][1],c[0][2]],[c[3][1],c[3][2]],[c[1][1],c[1][2]],[c[2][1],c[2][2]]];   /* ↖ ↗ ↘ ↙ */
  const L=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]), top=L(quad[0],quad[1]), bot=L(quad[3],quad[2]), lef=L(quad[0],quad[3]), rig=L(quad[1],quad[2]);
  const tilt=Math.max(Math.abs(top-bot)/Math.max(top,bot,1),Math.abs(lef-rig)/Math.max(lef,rig,1));
  /* резкость: |лапласиан|² по внутренности листа (без 3 px у края), нормировано на яркость² */
  let lap=0, nl=0; for(let y=3;y<h-3;y++) for(let x=3;x<w-3;x++){ const i=y*w+x; if(lab[i]!==best||lab[i-3]!==best||lab[i+3]!==best||lab[i-3*w]!==best||lab[i+3*w]!==best) continue;
    const v=4*a[i]-a[i-1]-a[i+1]-a[i-w]-a[i+w]; lap+=v*v; nl++; }
  /* блик — не пересвет до белого, а светлое пятно, где графит бледнеет: свет по листу меняется плавно (лампа сбоку,
     виньетка), блик — локально. Яркость по клеткам 12 × 12 px (верхняя четверть — бумага, не линии), гладкая
     поверхность второго порядка по ним (МНК, два прохода с отбросом), блик — клетки светлее её на ≥ 0,06 */
  const B=12, bw=Math.floor(w/B), bh=Math.floor(h/B), cells=[];
  for(let by=0;by<bh;by++) for(let bx=0;bx<bw;bx++){ const v=[]; for(let y=by*B;y<(by+1)*B;y+=2) for(let x=bx*B;x<(bx+1)*B;x+=2){ const i=y*w+x; if(lab[i]===best) v.push(a[i]); }
    if(v.length<(B*B/4)*0.8) continue; v.sort((p,q)=>p-q); cells.push({x:(bx+0.5)/bw-0.5,y:(by+0.5)/bh-0.5,v:v[Math.floor(v.length*0.75)]}); }
  let bump=0; if(cells.length>=12){ let use=cells;
    for(let it=0;it<2;it++){ const A6=[], b6=[]; use.forEach(c=>{ A6.push([1,c.x,c.y,c.x*c.x,c.x*c.y,c.y*c.y]); b6.push(c.v); });
      const AtA=Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>A6.reduce((s,r)=>s+r[i]*r[j],0)+(i===j?1e-6:0))), Atb=Array.from({length:6},(_,i)=>A6.reduce((s,r,k)=>s+r[i]*b6[k],0));
      const q=solve6(AtA,Atb); if(!q) break; const f=c=>q[0]+q[1]*c.x+q[2]*c.y+q[3]*c.x*c.x+q[4]*c.x*c.y+q[5]*c.y*c.y;
      cells.forEach(c=>{ c.r=c.v-f(c); }); const rs=use.map(c=>Math.abs(c.r)).sort((p,q)=>p-q), lim=Math.max(0.02,3*rs[rs.length>>1]); use=cells.filter(c=>Math.abs(c.r)<=lim); }
    bump=cells.filter(c=>c.r>=0.06).length/cells.length; }
  const light=sL/nL, sharp=nl?lap/nl/Math.max(0.05,light*light):0, glare=Math.max(sat/nL,bump), fill=bestN/(w*h), touchF=touch/edge;
  let motion=null; if(prev&&prev.paper){ const q0=prev.paper.quad; motion=quad.reduce((s,p,i)=>s+L(p,q0[i]),0)/4/Math.max(w,h); }
  const thumb=edges(g); let shift=null; if(prev&&prev.thumb) shift=shiftOf(prev.thumb,thumb);
  Object.assign(out,{paper:{fill,quad:quad.map(p=>[p[0]*g.k,p[1]*g.k]),quadSmall:quad,touch:touchF},tilt,sharp,glare,light,motion,size:[w,h],thumb,shift});
  /* подсказки — по одной главной причине за раз, в порядке «что исправить первым» */
  if(fill<LIM.fill) hints.push('подойдите ближе — лист занимает '+Math.round(fill*100)+' % кадра');
  else if(touchF>LIM.touch&&fill<0.6) hints.push('лист не целиком — отодвиньте телефон');
  if(light<LIM.light) hints.push('мало света — включите свет или подойдите к окну');
  /* блик — мягко: серия кадров его переживает (у каждого ракурса свой); снимать мешает только большой (> 15 % листа) */
  out.soft=[]; if(glare>0.15) hints.push('сильный блик на листе — наклоните телефон в сторону'); else if(glare>LIM.glare) out.soft.push('блик на листе — следующий кадр снимите под другим углом');
  if(tilt>LIM.tilt) hints.push('держите телефон параллельно листу');
  if(sharp<LIM.sharp) hints.push('нерезко — держите телефон неподвижно');
  out.ok=!hints.length; return out; }
/* сдвиг по содержимому кадра (съёмка вблизи: лист во весь кадр, его углы не двигаются): контуры кадра 64 px по длинной
   стороне, сдвиг — лучшее совмещение двух таких картинок (± 12 px, средняя |разность|); совместить не удалось (в кадре
   другое) — сдвиг 1. shiftOf → доля кадра */
function edges(g){ const k=Math.max(g.w,g.h)/64, w=Math.max(8,Math.round(g.w/k)), h=Math.max(8,Math.round(g.h/k)), b=new Float32Array(w*h), e=new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let s=0, n=0; for(let yy=Math.floor(y*k);yy<Math.min(g.h,Math.floor((y+1)*k));yy++) for(let xx=Math.floor(x*k);xx<Math.min(g.w,Math.floor((x+1)*k));xx++){ s+=g.a[yy*g.w+xx]; n++; } b[y*w+x]=n?s/n:0; }
  let m=0; for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){ const i=y*w+x, v=Math.hypot(b[i+1]-b[i-1],b[i+w]-b[i-w]); e[i]=v; m+=v; } m/=(w-2)*(h-2)||1;
  return {w,h,e,m}; }
function shiftOf(A,B){ if(!A||!B||A.w!==B.w||A.h!==B.h) return 1; const {w,h}=A, R=12; let best=null, at0=null;
  for(let dy=-R;dy<=R;dy++) for(let dx=-R;dx<=R;dx++){ let s=0, n=0; for(let y=Math.max(1,1-dy);y<Math.min(h-1,h-1-dy);y+=2) for(let x=Math.max(1,1-dx);x<Math.min(w-1,w-1-dx);x+=2){ s+=Math.abs(A.e[y*w+x]-B.e[(y+dy)*w+x+dx]); n++; }
    if(n<50) continue; const v=s/n; if(!dx&&!dy) at0=v; if(!best||v<best.v) best={v,dx,dy}; }
  const m=(A.m+B.m)/2||1e-6; if(!best||best.v>1.2*m) return 1;            /* совместить не удалось — в кадре другое */
  return Math.hypot(best.dx,best.dy)/Math.max(w,h); }
/* автомат: ждёт хороший устойчивый кадр; после снимка — ждёт сдвига ракурса, потом снова хорошего */
/* o.content — съёмка вблизи: устойчивость и «телефон сдвинули» — по содержимому кадра, а не по углам листа */
function Capturer(o){ o=o||{}; let want=o.shots||3; const hold=o.hold||400, max=o.max||5; let n=0, goodSince=null, lastShotQuad=null, lastThumb=null, needMove=false, prevA=null, bestSharp=0;
  return { get n(){ return n; }, get want(){ return want; },
    /* вывод серии не устоялся — ещё кадр (до max) */
    more(){ if(want<max){ want++; return true; } return false; },
    /* резкость — относительно лучшего кадра сеанса (у чистого А3 она ниже, чем у листа в клетку): ≥ 60 % лучшего */
    feed(A,now){ if(n>=want) return 'done'; if(A.paper) bestSharp=Math.max(bestSharp,A.sharp); A.soft=A.soft||[];
      if(A.ok&&A.sharp<0.6*bestSharp){ A.ok=false; A.hints.push('нерезко — держите телефон неподвижно, дайте камере навестись'); }
      const stable=A.ok&&A.motion!=null&&A.motion<LIM.motion&&(!o.content||A.shift!=null&&A.shift<LIM.motion); prevA=A;
      if(needMove&&o.content&&lastThumb){ if(shiftOf(lastThumb,A.thumb)>=0.03) needMove=false; }
      else if(needMove&&A.paper&&lastShotQuad){ const L=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]), mv=A.paper.quadSmall.reduce((s,p,i)=>s+L(p,lastShotQuad[i]),0)/4/Math.max(...A.size); if(mv>=0.03) needMove=false; }
      if(!stable||needMove){ goodSince=null; return 'wait'; }
      if(goodSince==null) goodSince=now; if(now-goodSince<hold) return 'wait';
      n++; goodSince=null; needMove=true; lastShotQuad=A.paper.quadSmall; lastThumb=A.thumb; return n>=want?'done-shot':'shot'; },
    hint(A){ if(n>=want) return 'готово'; if(!A.ok) return A.hints[0]; if(needMove) return 'кадр '+n+' из '+want+' снят — чуть сдвиньте телефон (другой угол — другой блик)'; return (A.soft&&A.soft[0])||'держите так…'; } }; }
put('dzCapture',{analyze,Capturer,LIM,otsu,shiftOf});
})();
