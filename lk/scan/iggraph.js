/* ═══════════ Чертёжное зрение: снимок листа ИГ → граф чертежа (ig-graph v1, мм листа) ═══════════
   Модель читает, код меряет (lab/ig/PLAN.md). Ответ модели (IG_PROMPT, server/lib/sheetprompts.js) — только кандидаты в px её кадра:
     FRAME — углы рамки листа, ROT — поворот, V — виды, S/L/C — линии с типом, H — штриховка.
   1. Рамка → гомография «мм листа → px фото»: каждая сторона рамки ищется по карандашу поперёк стороны модели (гребни, МНК-прямая
      с отбрасыванием выбросов), углы — пересечения прямых. Невязка — СКО гребней от своих прямых.
   2. Лист выпрямляется в растр PPM px/мм (по гомографии); дальше всё — в мм листа.
   3. Каждая линия модели притягивается к карандашу (lab/dz/refine.js: snap/snapCurve/snapCircle); без графита — в граф не идёт.
   4. Тип линии решает карандаш (ГОСТ 2.303): ритм вдоль линии — сплошная / штриховая (штрихи 1,5–8 мм) / штрихпунктирная (длинные
      штрихи и точки); толщина — интеграл тёмности поперёк, в долях толщины рамки (рамка — основная линия этого же листа).
      Короткая или неясная линия — тип модели с пониженной уверенностью.
   5. Пропущенное моделью: свободные гребни внутри видов → Хаф (refine.findMissing), штриховка исключена.
   build(gray, text, {s, sheet:{w,h}}) → {graph, H, raster, D, stats}; gray — {w,h,a} серого фото (0…1 или 0…255), s — px кадра модели на px фото. */
(function(){
'use strict';
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const IMG=isNode?require('../../lab/img.js'):self.LAB.img, RF=isNode?require('../../lab/dz/refine.js'):self.LAB.refine, HM=IMG.H;
const PPM=5, TYPES=['main','hidden','axis','thin','wavy','open'], TC={m:'main',h:'hidden',a:'axis',t:'thin',w:'wavy',o:'open'};
const r2=v=>Math.round(v*100)/100, plen=P=>{ let s=0; for(let i=1;i<P.length;i++) s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); return s; };
const bil=(a,w,h,x,y)=>{ const x0=Math.floor(x), y0=Math.floor(y); if(x0<0||y0<0||x0>=w-1||y0>=h-1) return 0; const fx=x-x0, fy=y-y0, i=y0*w+x0; return (a[i]*(1-fx)+a[i+1]*fx)*(1-fy)+(a[i+w]*(1-fx)+a[i+w+1]*fx)*fy; };

/* ── ответ модели ── */
function parseAnswer(t){ const o={frame:null,rot:0,views:[],lines:[],hatch:[]}; const num=s=>+String(s).replace(',','.');
  String(t||'').split(/\r?\n/).forEach(line=>{ const w=line.trim().split(/\s+/); if(!w[0]) return; const k=w[0].toUpperCase();
    if(k==='FRAME'&&w.length>=9){ const v=w.slice(1,9).map(num); if(v.every(isFinite)) o.frame=[[v[0],v[1]],[v[2],v[3]],[v[4],v[5]],[v[6],v[7]]]; }
    else if(k==='ROT') o.rot=num(w[1])||0;
    else if(k==='V'&&w.length>=6){ const b=w.slice(2,6).map(num); if(b.every(isFinite)) o.views.push({id:String(w[1]).toUpperCase(),box:b,kind:w[6]||''}); }
    else if(k==='S'&&w.length>=5){ const v=w.slice(1,5).map(num); if(v.every(isFinite)) o.lines.push({p:[[v[0],v[1]],[v[2],v[3]]],t:TC[w[5]]||'main'}); }
    else if(k==='L'){ const v=w.slice(1).filter(x=>/^-?\d/.test(x)).map(num), ty=TC[w[w.length-1]]||'main', P=[]; for(let i=0;i+1<v.length;i+=2) P.push([v[i],v[i+1]]); if(P.length>=2) o.lines.push({p:P,t:ty,curve:1}); }
    else if(k==='C'&&w.length>=4){ const v=w.slice(1,4).map(num); if(v.every(isFinite)) o.lines.push({c:v,t:TC[w[4]]||'thin'}); }
    else if(k==='H'){ const v=w.slice(1).map(num).filter(isFinite), P=[]; for(let i=0;i+1<v.length;i+=2) P.push([v[i],v[i+1]]); if(P.length>=3) o.hatch.push(P); } });
  return o; }

/* ── серое 0…1 из RGBA (браузер — ImageData) ── */
function grayOf(im){ if(im.a) return im; return IMG.toGray(im); }

/* ── 1. рамка: стороны по карандашу ──
   frame — углы рамки в px фото (по порядку листа: лев-верх, прав-верх, прав-низ, лев-низ), sheet {w,h}; рамка — 20/5/5/5 мм от края (ГОСТ 2.301).
   D — карта тёмности фото (refine.darkness). Поперёк каждой стороны ищется гребень в окне ±win мм (по масштабу модели) */
function frameRect(sheet){ return [20,5,sheet.w-5,sheet.h-5]; }
function rectify(D,frame,sheet,o,g){ o=o||{}; g=g||D.src; const F=frameRect(sheet), dst=[[F[0],F[1]],[F[2],F[1]],[F[2],F[3]],[F[0],F[3]]];
  let H=HM.fit(dst,frame); if(!H) return null;
  const sides=[], resid=[];
  for(let it=0;it<2;it++){ const ppm=Math.hypot(...[0,1].map(i=>HM.apply(H,[200,150])[i]-HM.apply(H,[201,150])[i])), win=(it?2:o.win||7)*ppm, L=[];
    for(let s=0;s<4;s++){ const A=dst[s], B=dst[(s+1)%4], len=Math.hypot(B[0]-A[0],B[1]-A[1]); let pts=[];
      for(let t=12;t<len-12;t+=2){ const q=[A[0]+(B[0]-A[0])*t/len,A[1]+(B[1]-A[1])*t/len], p=HM.apply(H,q), n0=[-(B[1]-A[1])/len,(B[0]-A[0])/len], p2=HM.apply(H,[q[0]+n0[0],q[1]+n0[1]]);
        let nx=p2[0]-p[0], ny=p2[1]-p[1]; const nl=Math.hypot(nx,ny)||1; nx/=nl; ny/=nl; let best=0, bt=0;
        /* гребень, а не край бумаги: по обе стороны линии (±1,2 мм) — бумага, примерно одной яркости (у края — стол или тень) */
        const cen=HM.apply(H,[sheet.w/2,sheet.h/2]), inw=Math.sign((cen[0]-p[0])*nx+(cen[1]-p[1])*ny)||1, paper=bil(g.a,g.w,g.h,p[0]+nx*inw*8*ppm,p[1]+ny*inw*8*ppm);   /* бумага — в 8 мм внутрь листа */
        const side=(d,sg)=>bil(g.a,g.w,g.h,p[0]+nx*(d+sg*1.2*ppm),p[1]+ny*(d+sg*1.2*ppm)), line=d=>{ const a=side(d,-1), b=side(d,1); return Math.min(a,b)>0.75*Math.max(a,b)&&Math.min(a,b)>0.8*paper; };
        for(let d=-win;d<=win;d+=0.5){ const v=bil(D.G,D.w,D.h,p[0]+nx*d,p[1]+ny*d)*(1-0.3*Math.abs(d)/win); if(v>best&&line(d)){ best=v; bt=d; } }
        if(best>D.thr) pts.push({x:p[0]+nx*bt+0.5,y:p[1]+ny*bt+0.5,w:1,bt:bt/ppm}); }   /* +0,5: индекс пикселя → координата от края (как у гомографии) */
      /* МНК-прямая с отбрасыванием: рамку пересекают линии видов, основной надписи и посторонние штрихи */
      /* сначала — самое частое смещение от прикидки (гистограмма по 0,5 мм): рамка — длинная линия, она даёт пик; чужие гребни разбросаны */
      { const hb=new Map(); pts.forEach(c=>{ const b=Math.round(c.bt*2); hb.set(b,(hb.get(b)||0)+1); }); let mb=0, mv=-1; hb.forEach((v,b)=>{ const t=v+(hb.get(b-1)||0)+(hb.get(b+1)||0); if(t>mv){ mv=t; mb=b; } }); pts=pts.filter(c=>Math.abs(c.bt*2-mb)<=2.5); }
      let f=tls(pts), keep=pts; for(let k=0;k<4&&f;k++){ const r=keep.map(c=>Math.abs((c.x-f.x)*-f.dy+(c.y-f.y)*f.dx)), m=r.slice().sort((a,b)=>a-b)[Math.floor(r.length*0.5)]||0.5, lim=Math.max(1.0,3*m); keep=keep.filter((c,i)=>r[i]<=lim); f=tls(keep); }
      if(!f||keep.length<10) return {H,ok:false,why:'сторона '+(s+1)+' рамки не найдена по карандашу',sides:L};
      if(o.debug) o.debug.push({s,it,pts:keep.map(c=>[c.x,c.y]),all:pts.length}); L.push(f); if(it) resid.push(Math.sqrt(keep.reduce((a,c)=>a+((c.x-f.x)*-f.dy+(c.y-f.y)*f.dx)**2,0)/keep.length)/ppm); }
    const C=[0,1,2,3].map(i=>meet(L[(i+3)%4],L[i])); if(C.some(c=>!c)) return {H,ok:false,why:'стороны рамки не пересеклись'};
    H=HM.fit(dst,C); sides.splice(0,4,...L); }
  return {H,ok:true,resid:r2(Math.max(...resid)),sides}; }
function tls(P){ let W=0,mx=0,my=0; P.forEach(c=>{ W+=c.w; mx+=c.w*c.x; my+=c.w*c.y; }); if(W<=0||P.length<2) return null; mx/=W; my/=W; let a=0,b=0,c=0;
  P.forEach(q=>{ const dx=q.x-mx, dy=q.y-my; a+=q.w*dx*dx; b+=q.w*dx*dy; c+=q.w*dy*dy; }); const th=0.5*Math.atan2(2*b,a-c); return {x:mx,y:my,dx:Math.cos(th),dy:Math.sin(th)}; }
function meet(a,b){ const den=a.dx*b.dy-a.dy*b.dx; if(Math.abs(den)<1e-6) return null; const t=((b.x-a.x)*b.dy-(b.y-a.y)*b.dx)/den; return [a.x+a.dx*t,a.y+a.dy*t]; }

/* ── 2. выпрямление: растр листа PPM px/мм, значения как у фото ── */
function warp(g,H,sheet,ppm){ ppm=ppm||PPM; const w=Math.round(sheet.w*ppm), h=Math.round(sheet.h*ppm), a=new Float32Array(w*h); let mx=0;
  for(let i=0;i<g.a.length;i+=97) if(g.a[i]>mx) mx=g.a[i]; const k=mx>1.5?1:255;   /* refine.darkness ждёт уровни 0…255 */
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const p=HM.apply(H,[(x+0.5)/ppm,(y+0.5)/ppm]); a[y*w+x]=(bil(g.a,g.w,g.h,p[0]-0.5,p[1]-0.5)||(mx>1.5?255:1))*k; }
  return {w,h,a,ppm}; }

/* ── 4. ритм и толщина вдоль линии (растр, px) ──
   ink[] — шаг 0,2 мм: гребень темнее порога и заметно темнее соседних полос; weight — интеграл тёмности поперёк (±1,2 мм) на чернильных местах */
function profile(D,P,ppm){ const st=0.2*ppm, ink=[], wts=[]; let carry=0;
  for(let i=1;i<P.length;i++){ const A=P[i-1], B=P[i], L=Math.hypot(B[0]-A[0],B[1]-A[1]); if(L<1e-6) continue; const u=[(B[0]-A[0])/L,(B[1]-A[1])/L], n=[-u[1],u[0]];
    for(let s=carry;s<=L;s+=st){ const c=[A[0]+u[0]*s,A[1]+u[1]*s]; let m=0; for(let t=-0.5*ppm;t<=0.5*ppm;t+=0.5){ const v=bil(D.G,D.w,D.h,c[0]+n[0]*t,c[1]+n[1]*t); if(v>m) m=v; }
      const d1=1.0*ppm, off=(bil(D.G,D.w,D.h,c[0]+n[0]*d1,c[1]+n[1]*d1)+bil(D.G,D.w,D.h,c[0]-n[0]*d1,c[1]-n[1]*d1))/2, on=m>D.thr*0.8&&m>off*1.5+D.thr*0.2; ink.push(on?1:0);
      if(on){ let sum=0; for(let t=-1.2*ppm;t<=1.2*ppm;t+=0.5) sum+=Math.max(0,bil(D.G,D.w,D.h,c[0]+n[0]*t,c[1]+n[1]*t)-off); wts.push(sum*0.5/ppm); } carry=s+st-L; } }
  return {ink,step:0.2,weight:wts.length?wts.sort((a,b)=>a-b)[wts.length>>1]:0}; }
/* ритм → сплошная / штриховая / штрихпунктирная (по длинам штрихов и промежутков, мм) */
function rhythm(pr){ const k=pr.ink, st=pr.step, total=k.length*st, runs=[]; let cur=k[0], len=0;
  for(let i=0;i<k.length;i++){ if(k[i]===cur) len++; else { runs.push([cur,len*st]); cur=k[i]; len=1; } } runs.push([cur,len*st]);
  /* дрожь гребня — промежутки короче 0,5 мм не в счёт (склеиваем) */
  const R=[]; runs.forEach(r=>{ if(r[0]===0&&r[1]<0.5&&R.length){ R[R.length-1][1]+=r[1]; return; } if(R.length&&R[R.length-1][0]===r[0]) R[R.length-1][1]+=r[1]; else R.push(r.slice()); });
  while(R.length&&R[0][0]===0) R.shift(); while(R.length&&R[R.length-1][0]===0) R.pop();
  const on=R.filter(r=>r[0]).map(r=>r[1]), off=R.filter(r=>!r[0]).map(r=>r[1]), frac=on.reduce((a,b)=>a+b,0)/Math.max(total,1e-9), med=a=>a.length?a.slice().sort((x,y)=>x-y)[a.length>>1]:0;
  const span=R.reduce((a,r)=>a+r[1],0), res={frac:r2(frac),on:on.length,medOn:r2(med(on)),medOff:r2(med(off)),span:r2(span),pat:'unclear'};
  if(total<4||on.length===0){ res.pat=frac<0.2?'none':'unclear'; return res; }
  const gaps=off.filter(g=>g>=0.5&&g<=3.5).length, bigGap=off.filter(g=>g>3.5).length, longs=on.filter(x=>x>=7).length, dots=on.filter(x=>x<=1.8).length;
  if(frac<0.25) res.pat='none';
  else if(frac>=0.88&&gaps<=Math.max(1,total/25)) res.pat='solid';
  else if(longs>=1&&dots>=1&&dots+longs>=on.length*0.7&&total>=14) res.pat='dashdot';
  else if(on.length>=3&&med(on)>=1.2&&med(on)<=8.5&&gaps>=Math.max(2,on.length*0.6)&&bigGap<=Math.max(1,on.length*0.2)) res.pat='dashed';
  else if(frac>=0.8) res.pat='solid';
  return res; }

/* тип по карандашу + подсказка модели → {type, conf, why} */
function decideType(mt,rh,w,wMain,len){ const rel=wMain>0?w/wMain:null;
  if(rh.pat==='dashed') return {type:mt==='axis'&&len>=14?'axis':'hidden',conf:mt==='hidden'?0.95:0.8,why:'штрихи '+rh.medOn+'/'+rh.medOff+' мм'};
  if(rh.pat==='dashdot') return {type:'axis',conf:mt==='axis'?0.95:0.8,why:'штрихпунктир'};
  if(rh.pat==='solid'){ if(mt==='wavy'||mt==='open') return {type:mt,conf:0.8,why:'сплошная, по модели '+mt};
    if(mt==='hidden'||mt==='axis'){ /* модель видит штрих, карандаш — сплошную: короткая — тип модели, длинная — сплошная */ if(len<10) return {type:mt,conf:0.4,why:'коротко, тип модели'}; }
    if(rel!=null&&rel>=0.62) return {type:'main',conf:mt==='main'?0.95:0.75,why:'толщина '+r2(rel)+' рамки'};
    if(rel!=null&&rel<=0.42) return {type:'thin',conf:mt==='thin'?0.9:0.7,why:'толщина '+r2(rel)+' рамки'};
    return {type:mt==='main'||mt==='thin'?mt:'main',conf:0.5,why:'толщина между основной и тонкой ('+(rel==null?'—':r2(rel))+')'}; }
  return {type:mt,conf:0.4,why:'ритм неясен ('+rh.pat+'), тип модели'}; }

/* ── сборка графа ── */
function build(g0,text,o){ o=o||{}; const sheet=o.sheet||{w:420,h:297}, s=o.s||1, g=grayOf(g0), A=parseAnswer(text), stats={model:A.lines.length};
  const toPhoto=p=>[p[0]/s,p[1]/s];
  if(!A.frame) return {ok:false,why:'модель не нашла рамку листа',answer:A};
  const Dp=RF.darkness(gray255(g),{ppm:Math.max(2,Math.min(g.w,g.h)/sheet.h)}), rc=rectify(Dp,A.frame.map(toPhoto),sheet,o,g);
  if(!rc||!rc.ok) return {ok:false,why:rc?rc.why:'рамка не найдена',answer:A};
  const H=rc.H, Hi=HM.inv(H), ppm=o.ppm||PPM, ras=warp(g,H,sheet,ppm), D=RF.darkness(ras,{ppm}), toMM=p=>HM.apply(Hi,toPhoto(p)), toR=p=>[p[0]*ppm,p[1]*ppm], fromR=p=>[p[0]/ppm,p[1]/ppm];
  /* толщина основной линии этого листа — по рамке */
  const F=frameRect(sheet), fr=[[[F[0]+15,F[1]],[F[2]-15,F[1]]],[[F[2],F[1]+15],[F[2],F[3]-60]],[[F[0],F[1]+15],[F[0],F[3]-15]]].map(P=>profile(D,P.map(toR),ppm).weight).sort((a,b)=>a-b), wMain=fr[1];
  /* виды модели → рамки в мм листа */
  const views=A.views.map(v=>{ const c=[[v.box[0],v.box[1]],[v.box[2],v.box[1]],[v.box[2],v.box[3]],[v.box[0],v.box[3]]].map(toMM); return {id:v.id,kind:v.kind,box:[Math.min(...c.map(p=>p[0])),Math.min(...c.map(p=>p[1])),Math.max(...c.map(p=>p[0])),Math.max(...c.map(p=>p[1]))].map(r2)}; });
  const hatch=A.hatch.map(P=>P.map(toMM));
  const lines=[]; let dropped=0;
  const add=(P,mt,src,extra)=>{ const len=plen(P); if(len<1.5) return; const pr=profile(D,P.map(toR),ppm), rh=rhythm(pr), ty=decideType(mt,rh,pr.weight,wMain,len);
    if(rh.pat==='none'||rh.frac<0.3){ dropped++; return null; }
    const l=Object.assign({type:ty.type,p:P.map(q=>[r2(q[0]),r2(q[1])]),len:r2(len),conf:r2(ty.conf),src,ev:{ink:rh.frac,pat:rh.pat,w:r2(wMain?pr.weight/wMain:0),mt,why:ty.why}},extra||{}); lines.push(l); return l; };
  A.lines.forEach(m=>{
    if(m.c){ const c=toMM([m.c[0],m.c[1]]), e=toMM([m.c[0]+m.c[2],m.c[1]]), r=Math.hypot(e[0]-c[0],e[1]-c[1]), sc=RF.snapCircle(D,{cx:c[0]*ppm,cy:c[1]*ppm,r:r*ppm},{ppm});
      if(!sc||sc.ink<0.3){ dropped++; return; } const P=[]; for(let i=0;i<=72;i++) P.push([sc.cx/ppm+sc.r/ppm*Math.cos(i*Math.PI/36),sc.cy/ppm+sc.r/ppm*Math.sin(i*Math.PI/36)]);
      add(P,m.t,'model',{circ:[r2(sc.cx/ppm),r2(sc.cy/ppm),r2(sc.r/ppm)]}); return; }
    const P=m.p.map(toMM);
    if(m.curve&&P.length>2){ const sc=RF.snapCurve(D,{p:P.map(toR)},{ppm}); if(!sc||sc.lost){ dropped++; return; } add(dpS(sc.p.map(fromR),0.05),m.t,'model'); return; }
    const sn=RF.snap(D,[...toR(P[0]),...toR(P[P.length-1])],{ppm,radius:2}); if(!sn||sn.lost){ dropped++; return; }
    add([fromR([sn.p[0],sn.p[1]]),fromR([sn.p[2],sn.p[3]])],m.t,'model'); });
  /* дубли (модель выписала одну линию дважды, или две модели-линии притянулись к одной): короче — уходит */
  dedupe(lines);
  /* 5. пропущенное моделью — внутри видов; штриховка и уже найденное — заняты */
  const used=new Uint8Array(D.w*D.h), markP=(P,k)=>{ for(let j=1;j<P.length;j++){ const a=toR(P[j-1]), b=toR(P[j]), L=Math.hypot(b[0]-a[0],b[1]-a[1]), n=Math.ceil(L); for(let q=0;q<=n;q++){ const x=a[0]+(b[0]-a[0])*q/n, y=a[1]+(b[1]-a[1])*q/n; for(let dy=-k;dy<=k;dy++) for(let dx=-k;dx<=k;dx++){ const X=Math.round(x)+dx, Y=Math.round(y)+dy; if(X>=0&&Y>=0&&X<D.w&&Y<D.h) used[Y*D.w+X]=1; } } } };
  lines.forEach(l=>markP(l.p,3));
  hatch.forEach(P=>{ const b=[Math.min(...P.map(p=>p[0])),Math.min(...P.map(p=>p[1])),Math.max(...P.map(p=>p[0])),Math.max(...P.map(p=>p[1]))].map(v=>v*ppm);
    for(let y=Math.max(0,Math.floor(b[1]));y<Math.min(D.h,b[3]);y++) for(let x=Math.max(0,Math.floor(b[0]));x<Math.min(D.w,b[2]);x++) if(inPoly([x/ppm,y/ppm],P)) used[y*D.w+x]=1; });
  let found=0;
  if(o.find!==false) views.forEach(v=>{ const bx=[v.box[0]*ppm,v.box[1]*ppm,v.box[2]*ppm,v.box[3]*ppm];
    RF.findMissing(D,used,{ppm,minLen:o.minLen||6,box:bx,maxFind:30}).forEach(f=>{ const P=[fromR([f.p[0],f.p[1]]),fromR([f.p[2],f.p[3]])];
      /* штриховка, которую модель не обвела: короткие тонкие под 45° рядом с такими же — не линия чертежа */
      const l=add(P,'thin','found'); if(l){ found++; markP(l.p,3); } }); });
  dropHatchFamily(lines);
  /* вид каждой линии: рамка вида модели (+4 мм), иначе ближайшая в 15 мм */
  const boxD=(b,p)=>Math.hypot(Math.max(b[0]-p[0],0,p[0]-b[2]),Math.max(b[1]-p[1],0,p[1]-b[3]));
  lines.forEach((l,i)=>{ l.id=i; const m=midP(l.p); let best=null, bd=15; views.forEach(v=>{ const d=boxD(v.box,m); if(d<bd||(d===0&&best&&boxArea(v.box)<boxArea(views.find(x=>x.id===best).box))){ bd=d; best=v.id; } }); l.view=best; });
  views.forEach(v=>{ const P=[].concat(...lines.filter(l=>l.view===v.id&&(l.type==='main'||l.type==='hidden')).map(l=>l.p)); if(P.length) v.box=[Math.min(...P.map(p=>p[0])),Math.min(...P.map(p=>p[1])),Math.max(...P.map(p=>p[0])),Math.max(...P.map(p=>p[1]))].map(r2); });
  Object.assign(stats,{kept:lines.filter(l=>l.src==='model').length,found,dropped,frameResid:rc.resid,wMain:r2(wMain)});
  const graph={format:'ig-graph',v:1,src:'photo',sheet,views,links:[],lines,hatch:hatch.map(P=>({poly:P.map(p=>[r2(p[0]),r2(p[1])])}))};
  return {ok:true,graph,H,raster:ras,D,stats,answer:A}; }
const gray255=g=>{ let mx=0; for(let i=0;i<g.a.length;i+=97) if(g.a[i]>mx) mx=g.a[i]; if(mx>1.5) return g; const a=new Float32Array(g.a.length); for(let i=0;i<a.length;i++) a[i]=g.a[i]*255; return {w:g.w,h:g.h,a}; };
const boxArea=b=>(b[2]-b[0])*(b[3]-b[1]);
const midP=P=>{ const L=plen(P); let a=0; for(let i=1;i<P.length;i++){ const d=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); if(a+d>=L/2){ const t=(L/2-a)/(d||1); return [P[i-1][0]+(P[i][0]-P[i-1][0])*t,P[i-1][1]+(P[i][1]-P[i-1][1])*t]; } a+=d; } return P[0]; };
function inPoly(p,P){ let c=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ if(((P[i][1]>p[1])!==(P[j][1]>p[1]))&&(p[0]<(P[j][0]-P[i][0])*(p[1]-P[i][1])/(P[j][1]-P[i][1])+P[i][0])) c=!c; } return c; }
const dPL=(q,P)=>{ let m=1e9; for(let i=1;i<P.length;i++){ const A=P[i-1], B=P[i], dx=B[0]-A[0], dy=B[1]-A[1], L=dx*dx+dy*dy||1e-12, t=Math.max(0,Math.min(1,((q[0]-A[0])*dx+(q[1]-A[1])*dy)/L)); m=Math.min(m,Math.hypot(q[0]-A[0]-t*dx,q[1]-A[1]-t*dy)); } return m; };
function sampleP(P,st){ const out=[]; for(let i=1;i<P.length;i++){ const A=P[i-1], B=P[i], L=Math.hypot(B[0]-A[0],B[1]-A[1]), n=Math.max(1,Math.ceil(L/st)); for(let k=i>1?1:0;k<=n;k++) out.push([A[0]+(B[0]-A[0])*k/n,A[1]+(B[1]-A[1])*k/n]); } return out; }
/* дубли: линия, у которой 80 % точек ближе 0,6 мм к более длинной, — та же линия */
function dedupe(L){ L.sort((a,b)=>b.len-a.len); for(let i=L.length-1;i>=0;i--){ const S=sampleP(L[i].p,0.5); for(let j=0;j<i;j++){ if(S.filter(q=>dPL(q,L[j].p)<0.6).length>=0.8*S.length){ L.splice(i,1); break; } } } }
/* семейство штриховки: ≥ 3 тонких коротких параллельных линий под ~45° с шагом 1,5–4 мм */
function dropHatchFamily(L){ const H=L.filter(l=>l.src==='found'&&l.p.length===2&&l.len<40&&l.type!=='main'); const ang=l=>{ const a=Math.atan2(l.p[1][1]-l.p[0][1],l.p[1][0]-l.p[0][0])*180/Math.PI; return ((a%180)+180)%180; };
  H.forEach(l=>{ const a=ang(l); if(Math.abs(a-45)>12&&Math.abs(a-135)>12) return; const fam=H.filter(q=>q!==l&&Math.abs(ang(q)-a)<6&&dPL(midP(q.p),[l.p[0].map((v,i)=>v-(l.p[1][i]-l.p[0][i])*3),l.p[1].map((v,i)=>v+(l.p[1][i]-l.p[0][i])*3)])<8);
    if(fam.length>=2) l.hatchLine=1; });
  for(let i=L.length-1;i>=0;i--) if(L[i].hatchLine) L.splice(i,1); }
function dpS(P,e){ if(P.length<3) return P; const keep=new Uint8Array(P.length); keep[0]=keep[P.length-1]=1; const st=[[0,P.length-1]];
  while(st.length){ const [a,b]=st.pop(); let m=-1, md=e; for(let i=a+1;i<b;i++){ const d=dPL(P[i],[P[a],P[b]]); if(d>md){ md=d; m=i; } } if(m>0){ keep[m]=1; st.push([a,m],[m,b]); } }
  return P.filter((_,i)=>keep[i]); }

const api={build,parseAnswer,rectify,warp,profile,rhythm,decideType,frameRect,sampleP,dPL,midP,plen,inPoly,PPM,TYPES};
if(isNode) module.exports=api; else self.SCANIGRAPH=api;
})();
