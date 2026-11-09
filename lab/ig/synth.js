/* ═══════════ Синтетические фото листа ИГ №4 с известной правдой ═══════════
   Лист рисуется из эталонного графа варианта (lab/ig/ref.js — чистовик сайта, разобранный в линии с типами), как студент:
     раскладка своя: виды сдвинуты (главный и сверху — по одной вертикали, главный и слева — по одной горизонтали, с дрожью руки);
     рука: каждая линия сдвинута целиком на доли мм, дрожь штриха, толщина и нажим свои; основная — толсто, штриховая — штрихи 2,5–5 мм,
       осевая — штрихпунктир 12–20 мм, тонкие (размеры, Ø, штриховка 45°) — тонко и бледнее; рамка и основная надпись;
     съёмка: lab/synth.js camera (перспектива, свет, тень, блик, расфокус, шум), поворот кадра на 90°/270° (лист снят «боком»).
   Ошибки (err) — правда о них в truth.err (вид, место на листе, линии):
     miss  — пропущена линия выреза K (на виде сверху или слева);
     extra — лишняя основная линия внутри вида (сверху или слева);
     type  — линия выреза K другим типом: невидимая начерчена видимой или наоборот;
     kshift — контур выреза K сдвинут на 3–5 мм (по x или по z) на всех видах: лист согласован сам с собой, но не с заданием.
   igSynth({n, seed, level, err, size, turn}) → {img, truth:{n, H (мм листа → px фото), graph (начерченное, мм листа), K (вершины K
     начерченной детали, мм детали), err, layout}}; mockAnswer(truth, s, R, o) → ответ «модели» (формат IG_PROMPT) в px её кадра.
   node lab/ig/synth.js --n=8 --seed=1 [--err=miss] --out=файл.png */
'use strict';
const fs=require('fs'), path=require('path');
const IMG=require('../img.js'), S=require('../synth.js'), font=require('../font.js'), DZS=require('../dz/synth.js');
const {rng}=IMG;
const PAGE={w:420,h:297}, FRAME=[20,5,415,292], TITLE=[230,237,415,292];
/* формат листа — как у чистовика варианта (А3, у крупных — А2): рамка 20/5/5/5 мм, основная надпись 185 × 55 в правом нижнем углу */
const fmtOf=sh=>({PAGE:{w:sh.w,h:sh.h},FRAME:[20,5,sh.w-5,sh.h-5],TITLE:[sh.w-190,sh.h-60,sh.w-5,sh.h-5]});
const REF=process.env.IGREF||path.join(__dirname,'ig4ref.json'), CACHE=path.join(__dirname,'..','private','igcache');
let REFS=null;
const refOf=n=>{ if(!REFS) REFS=JSON.parse(fs.readFileSync(REF,'utf8')).vars; return REFS[n]; };
const clone=o=>JSON.parse(JSON.stringify(o));
const plen=P=>{ let s=0; for(let i=1;i<P.length;i++) s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); return s; };
const mid=P=>{ const L=plen(P); let a=0; for(let i=1;i<P.length;i++){ const d=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); if(a+d>=L/2){ const t=(L/2-a)/(d||1); return [P[i-1][0]+(P[i][0]-P[i-1][0])*t,P[i-1][1]+(P[i][1]-P[i-1][1])*t]; } a+=d; } return P[0]; };

/* эталон для детали со сдвинутым вырезом K: строится тем же модулем сайта (≈ 25 с), кэш — lab/private/igcache */
function shiftedRef(n,d){ const key='k'+n+'_'+d.map(v=>v.toFixed(2)).join('_'), f=path.join(CACHE,key+'.json');
  if(fs.existsSync(f)) return JSON.parse(fs.readFileSync(f,'utf8'));
  const R=require('./ref.js'), M=require('./model4.js'), m=M.withK(n,M.kOf(n).map(P=>P.map(p=>[p[0]+d[0],p[1]+d[1]])));
  const g=R.refGraph(n,{model:m,key:'ig4-'+key}); fs.mkdirSync(CACHE,{recursive:true}); fs.writeFileSync(f,JSON.stringify(g)); return g; }

/* штриховой и штрихпунктирный ритм: ломаная → куски по шаблону [вкл, выкл, вкл, выкл, …] мм */
function pattern(P,pat,phase){ const out=[]; let cur=null, k=0, left=pat[0]-(phase||0)%pat[0]; if(left<=0) left=pat[0];
  for(let i=1;i<P.length;i++){ let a=P[i-1]; const b=P[i]; let d=Math.hypot(b[0]-a[0],b[1]-a[1]);
    while(d>1e-9){ const s=Math.min(d,left), t=s/d, q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      if(k%2===0){ if(!cur){ cur=[a]; out.push(cur); } cur.push(q); } a=q; d-=s; left-=s;
      if(left<=1e-9){ k++; left=pat[k%pat.length]; if(k%2===1) cur=null; } } }
  return out.filter(c=>plen(c)>0.15); }
/* штриховка 45° многоугольника: секущие прямые x − y = c с шагом h, отрезки внутри (чёт-нечёт) */
function hatchLines(poly,h,ang){ const c=Math.cos(ang), s=Math.sin(ang), rot=p=>[p[0]*c+p[1]*s,-p[0]*s+p[1]*c], un=p=>[p[0]*c-p[1]*s,p[0]*s+p[1]*c], Q=poly.map(rot), out=[];
  const v0=Math.min(...Q.map(p=>p[1])), v1=Math.max(...Q.map(p=>p[1]));
  for(let v=Math.ceil(v0/h)*h+h*0.37;v<v1;v+=h){ const X=[]; for(let i=0;i<Q.length;i++){ const a=Q[i], b=Q[(i+1)%Q.length]; if((a[1]-v)*(b[1]-v)<0) X.push(a[0]+(b[0]-a[0])*(v-a[1])/(b[1]-a[1])); }
    X.sort((a,b)=>a-b); for(let i=0;i+1<X.length;i+=2) if(X[i+1]-X[i]>0.3) out.push([un([X[i],v]),un([X[i+1],v])]); }
  return out; }

function igSynth(o){ o=o||{}; const n=o.n||8, R=rng(o.seed||1), lv=S.LEVELS[o.level||'normal'], errK=o.err||null;
  /* 1. что чертит студент: эталон варианта (или со сдвинутым K) */
  let shift=null, g;
  if(errK==='kshift'){ const m=R.r(3,5)*(R()<0.5?-1:1); shift=R()<0.5?[m,0]:[0,m]; g=clone(shiftedRef(n,shift)); } else g=clone(refOf(n));
  const {PAGE,FRAME,TITLE}=fmtOf(g.sheet);
  const base=refOf(n), Kd=(errK==='kshift'?g:base).model.K;
  /* 2. раскладка: виды сдвинуты, связи сохраняются с дрожью руки */
  const box=id=>{ const v=g.views.find(v=>v.id===id); return v&&v.box; };
  const ex=(id,c)=>{ const v=g.views.find(v=>v.id===id); const P=[].concat(...g.lines.filter(l=>l.view===id).map(l=>l.p)); return P.length?[Math.min(...P.map(p=>p[0])),Math.min(...P.map(p=>p[1])),Math.max(...P.map(p=>p[0])),Math.max(...P.map(p=>p[1]))]:v.box; };
  let T=null;
  for(let tr=0;tr<200;tr++){ const dx=R.r(-14,14), dy=R.r(-10,12), t={F:[dx,dy],T:[dx+R.n(0,0.2),dy+R.r(-6,10)],L:[dx+R.r(-10,14),dy+R.n(0,0.2)]};
    const ok=g.views.every(v=>{ const b=ex(v.id), d=t[v.id]; const q=[b[0]+d[0],b[1]+d[1],b[2]+d[0],b[3]+d[1]];
      return q[0]>FRAME[0]+4&&q[1]>FRAME[1]+4&&q[2]<FRAME[2]-4&&q[3]<FRAME[3]-4&&!(q[2]>TITLE[0]-3&&q[3]>TITLE[1]-3); });
    if(ok){ T=t; break; } }
  if(!T) T={F:[0,0],T:[0,0],L:[0,0]};
  const mv=(p,id)=>[p[0]+T[id][0],p[1]+T[id][1]];
  g.lines.forEach(l=>{ l.p=l.p.map(p=>mv(p,l.view)); }); g.hatch.forEach(h=>{ h.poly=h.poly.map(p=>mv(p,h.view)); });
  g.views.forEach(v=>{ v.box=[...mv([v.box[0],v.box[1]],v.id),...mv([v.box[2],v.box[3]],v.id)]; v.map=v.map.slice(); v.map[2]+=T[v.id][0]; v.map[5]+=T[v.id][1]; });
  /* 3. ошибка */
  let err=null; const lines=g.lines;
  const pickK=f=>{ const C=lines.filter(l=>l.k&&(l.view==='T'||l.view==='L')&&l.len>=8&&(!f||f(l))); return C.length?C[Math.floor(R()*C.length)]:null; };
  if(errK==='miss'){ const l=pickK(); if(l){ err={kind:'miss',view:l.view,at:mid(l.p),line:clone(l)}; lines.splice(lines.indexOf(l),1); } }
  if(errK==='type'){ const l=pickK(l=>l.type==='hidden')||pickK(l=>l.type==='main'); if(l){ const was=l.type; l.type=was==='main'?'hidden':'main'; err={kind:'type',view:l.view,at:mid(l.p),was,drawn:l.type,line:clone(l)}; } }
  if(errK==='extra'){ for(let tr=0;tr<300&&!err;tr++){ const id=R()<0.5?'T':'L', b=g.views.find(v=>v.id===id).box, L0=R.r(10,22), a=R()*Math.PI;
      const c=[R.r(b[0]+L0/2,b[2]-L0/2),R.r(b[1]+L0/2,b[3]-L0/2)], P=[[c[0]-L0/2*Math.cos(a),c[1]-L0/2*Math.sin(a)],[c[0]+L0/2*Math.cos(a),c[1]+L0/2*Math.sin(a)]];
      /* не ближе 3 мм к начерченным линиям вида — иначе «лишняя» неотличима от верной */
      const near=lines.filter(l=>l.view===id&&l.type!=='thin').some(l=>{ for(let k=0;k<=20;k++){ const q=[P[0][0]+(P[1][0]-P[0][0])*k/20,P[0][1]+(P[1][1]-P[0][1])*k/20]; for(let i=1;i<l.p.length;i++){ const A=l.p[i-1], B=l.p[i], dx=B[0]-A[0], dy=B[1]-A[1], LL=dx*dx+dy*dy||1e-9, t=Math.max(0,Math.min(1,((q[0]-A[0])*dx+(q[1]-A[1])*dy)/LL)); if(Math.hypot(q[0]-A[0]-t*dx,q[1]-A[1]-t*dy)<3) return true; } } return false; });
      if(near) continue; const l={type:'main',view:id,p:P,len:L0,extra:1}; lines.push(l); err={kind:'extra',view:id,at:c,line:clone(l)}; } }
  if(errK==='kshift') err={kind:'kshift',view:'F',shift,at:mid(lines.find(l=>l.view==='F'&&l.k).p)};
  /* 4. рука и лист */
  const sheet=new S.Sheet(PAGE.w,PAGE.h,o.res||6), k=R.r(...lv.hand);
  const g0=IMG.gray(sheet.w,sheet.h); for(let i=0;i<g0.a.length;i++) g0.a[i]=R(); const g1=IMG.blur(g0,0.8); sheet.grain=new Float32Array(sheet.w*sheet.h);
  for(let i=0;i<g1.a.length;i++) sheet.grain[i]=Math.max(0.35,Math.min(1,0.7+(g1.a[i]-0.5)*3.2));
  sheet.layer='pencil';
  const pen={dk:R.r(...lv.dark),thin:R.r(0.2,0.3),main:R.r(0.5,0.75)};
  const stroke=(P,w,dk)=>sheet.stroke(P,w,Math.min(0.95,dk),{wob:R.r(0.02,0.05),grain:true,press:true},R);
  const hidPat=[R.r(2.5,5),R.r(1,1.8)], axPat=[R.r(12,20),R.r(1.5,2.5),R.r(0.6,1.1),R.r(1.5,2.5)];
  for(let i=0;i<4;i++){ const c=[[FRAME[0],FRAME[1]],[FRAME[2],FRAME[1]],[FRAME[2],FRAME[3]],[FRAME[0],FRAME[3]]], a=c[i], b=c[(i+1)%4]; stroke([a,b],pen.main,pen.dk*1.1); }
  /* основная надпись: 185 × 55, графы — как ГОСТ 2.104 (упрощённо) */
  { const [x0,y0,x1,y1]=TITLE; stroke([[x0,y0],[x1,y0]],pen.main,pen.dk); stroke([[x0,y0],[x0,y1]],pen.main,pen.dk);
    let x=x0; [7,10,23,15,10].forEach(w=>{ x+=w; stroke([[x,y0],[x,y1]],pen.thin,pen.dk*0.9); }); for(let y=y0+5;y<y1;y+=5) stroke([[x0,y],[x0+65,y]],pen.thin,pen.dk*0.8);
    stroke([[x0+65,y0+15],[x1,y0+15]],pen.thin,pen.dk*0.9); stroke([[x0+65,y0+40],[x1,y0+40]],pen.thin,pen.dk*0.9); stroke([[x0+135,y0+15],[x0+135,y1]],pen.thin,pen.dk*0.9); }
  /* рука: сдвиг линии целиком; начерченное = правда графа */
  const handShift=()=>[R.n(0,0.12*k),R.n(0,0.12*k)];
  lines.forEach(l=>{ const d=handShift(); l.p=l.p.map(p=>[p[0]+d[0],p[1]+d[1]]); const P=l.p;
    if(l.type==='main') stroke(P,pen.main,pen.dk*1.15);
    else if(l.type==='hidden') pattern(P,hidPat,R()*3).forEach(q=>stroke(q,pen.thin*1.2,pen.dk*0.95));
    else if(l.type==='axis') pattern(P,axPat,R()*8).forEach(q=>stroke(q,pen.thin,pen.dk*0.8));
    else if(l.type==='open') stroke(P,pen.main*1.3,pen.dk*1.15);
    else stroke(P,pen.thin,pen.dk*(l.dim?0.7:0.8)); });
  const hs=R.r(2,3); g.hatch.forEach(h=>hatchLines(h.poly,hs,Math.PI/4).forEach(s=>stroke(s,pen.thin*0.9,pen.dk*0.7)));
  /* надписи: А–А над видом сверху, «А» у разомкнутых линий, номер варианта в основной надписи */
  const txt=(s,at,sz)=>{ s=s.split('').filter(c=>font.has(c)).join(''); if(s) sheet.text(s,at,sz,Math.min(0.95,pen.dk*1.05),R.r(0.22,0.32),{rot:R.n(0,0.04),shear:R.n(0.12,0.06),jit:0.02,grain:true},R); };
  lines.filter(l=>l.type==='open').forEach(l=>txt('A',[l.p[0][0]+R.r(-2,2),l.p[0][1]-R.r(5,8)],R.r(4,5)));
  const tb=g.views.find(v=>v.id==='T'); if(tb) txt('A-A',[(tb.box[0]+tb.box[2])/2-6,tb.box[1]-R.r(8,12)],5);
  txt(String(n),[TITLE[0]+120,TITLE[1]+48],6);
  /* 5. съёмка */
  const sz=o.size||[2000,1500], cam=S.camera(sheet,PAGE,R,lv,sz,{glare:0.15}), tk=o.turn!=null?o.turn:R.pick([0,1,3]), tr=DZS.turn(cam.im,tk);
  const H=IMG.H.norm(IMG.H.mul(tr.M,cam.M));
  /* правда: граф начерченного (без размеров — они не предмет первого запуска, но на листе есть) */
  g.lines.forEach((l,i)=>{ l.id=i; l.len=Math.round(plen(l.p)*100)/100; });
  return {img:tr.im,truth:{n,H,graph:g,K:Kd,err,layout:T,turn:tk,params:Object.assign(cam.params,{hand:k})}}; }

/* ── ответ «модели» по начерченному (формат IG_PROMPT), в px кадра модели; s — px кадра модели на px фото ──
   погрешность «как у модели»: концы ± 0,45 мм поперёк и ± 0,8 мм вдоль, кривые — 6–14 точек ± 0,6 мм; ошибки модели:
   пропуск линии (4 %, короткой < 6 мм — 15 %), перепутанный тип (6 %), 2 выдуманные линии, размеры не выписывает (как просит промпт) */
function mockAnswer(truth,s,R,o){ o=o||{}; const H=truth.H, g=truth.graph, {FRAME}=fmtOf(g.sheet), map=p=>{ const q=IMG.H.apply(H,p); return [q[0]*s,q[1]*s]; }, f=v=>String(Math.round(v)), J=sd=>[R.n(0,sd),R.n(0,sd)];
  const ppm=Math.hypot(...[0,1].map(i=>map([200,150])[i]-map([201,150])[i]));   /* px кадра на мм листа */
  const out=[], TC={main:'m',hidden:'h',axis:'a',thin:'t',wavy:'w',open:'o'}, FLIP={main:'hidden',hidden:'main',axis:'thin',thin:'axis',wavy:'thin',open:'main'};
  const pr=o.err==null?1:o.err;
  const c=[[FRAME[0],FRAME[1]],[FRAME[2],FRAME[1]],[FRAME[2],FRAME[3]],[FRAME[0],FRAME[3]]].map(p=>{ const q=map(p), j=J(0.8*ppm); return [q[0]+j[0],q[1]+j[1]]; });
  out.push('FRAME '+c.map(q=>f(q[0])+' '+f(q[1])).join(' '));
  out.push('ROT '+[0,270,180,90][truth.turn||0]);
  g.views.forEach(v=>{ const b=v.box, a=map([b[0]-3+R.n(0,2),b[1]-3+R.n(0,2)]), z=map([b[2]+3+R.n(0,2),b[3]+3+R.n(0,2)]);
    out.push('V '+v.id+' '+[Math.min(a[0],z[0]),Math.min(a[1],z[1]),Math.max(a[0],z[0]),Math.max(a[1],z[1])].map(f).join(' ')); });
  g.lines.forEach(l=>{ if(l.dim) return; const L=plen(l.p); if(R()<pr*(L<6?0.15:0.04)) return; let t=l.type; if(R()<pr*0.06) t=FLIP[t];
    if(l.circ){ const cc=map([l.circ[0],l.circ[1]]), j=J(0.4*ppm); out.push('C '+f(cc[0]+j[0])+' '+f(cc[1]+j[1])+' '+f(l.circ[2]*ppm+R.n(0,0.4*ppm))+' '+TC[t]); return; }
    if(l.p.length===2){ const u=[(l.p[1][0]-l.p[0][0])/L,(l.p[1][1]-l.p[0][1])/L], e=[R.n(0,0.8),R.n(0,0.8)], P=[0,1].map(i=>{ const q=[l.p[i][0]+u[0]*e[i],l.p[i][1]+u[1]*e[i]], m=map(q), j=J(0.45*ppm); return [m[0]+j[0],m[1]+j[1]]; });
      out.push('S '+[P[0][0],P[0][1],P[1][0],P[1][1]].map(f).join(' ')+' '+TC[t]); return; }
    const m=Math.max(6,Math.min(14,Math.round(L/8)+4)), P=[]; let acc=0, D=[l.p[0]]; for(let i=1;i<l.p.length;i++){ const a=l.p[i-1], b=l.p[i], d=Math.hypot(b[0]-a[0],b[1]-a[1]), n2=Math.max(1,Math.ceil(d/0.5)); for(let q=1;q<=n2;q++) D.push([a[0]+(b[0]-a[0])*q/n2,a[1]+(b[1]-a[1])*q/n2]); acc+=d; }
    for(let i=0;i<m;i++){ const q=map(D[Math.round(i*(D.length-1)/(m-1))]), j=J(0.6*ppm); P.push([q[0]+j[0],q[1]+j[1]]); }
    out.push('L '+P.map(q=>f(q[0])+' '+f(q[1])).join(' ')+' '+TC[t]); });
  /* выдумка модели: отрезки, которых на бумаге нет («как надо» или шум) */
  for(let i=0;i<Math.round(2*pr);i++){ const v=g.views[Math.floor(R()*g.views.length)], b=v.box, a=[R.r(b[0],b[2]),R.r(b[1],b[3])], L0=R.r(8,20), an=R()*Math.PI, A=map(a), B=map([a[0]+L0*Math.cos(an),a[1]+L0*Math.sin(an)]); out.push('S '+[A[0],A[1],B[0],B[1]].map(f).join(' ')+' m'); }
  g.hatch.forEach(h=>{ if(h.poly.length<3) return; out.push('H '+h.poly.filter((_,i)=>i%Math.max(1,Math.floor(h.poly.length/12))===0).map(p=>{ const q=map(p), j=J(0.5*ppm); return f(q[0]+j[0])+' '+f(q[1]+j[1]); }).join(' ')); });
  return out.join('\n'); }

module.exports={igSynth,mockAnswer,pattern,hatchLines,refOf,shiftedRef,PAGE,FRAME,TITLE};
if(require.main===module){ const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
  const t0=Date.now(), r=igSynth({n:+(A.n||8),seed:+(A.seed||1),err:A.err||null,level:A.level||'normal'});
  fs.writeFileSync(A.out||'ig4.png',IMG.encodePNG(r.img)); console.log('ИГ №4 в.'+r.truth.n+', линий '+r.truth.graph.lines.length+', ошибка '+JSON.stringify(r.truth.err&&{kind:r.truth.err.kind,view:r.truth.err.view,at:r.truth.err.at})+', поворот '+r.truth.turn+', '+(Date.now()-t0)+' мс'); }
