/* ═══════════ Две оцифровки одного чертежа → одна (кадр тот же, px вырезки) ═══════════
   Первая (A, Claude Opus) — основа. Вторая (B, другая модель — Sonnet) дополняет, а не голосует:
     точки — по подписи: есть у обеих и ближе 2 мм — среднее (две независимые оценки точнее одной); дальше — остаётся A
             (конфликт считается); есть только у B — добавляется;
     отрезки — B добавляется, если такого нет у A (тот же наклон ± 4°, оба конца в 1,5 мм от прямой A и перекрытие ≥ 60 %);
     окружности и дуги — так же по центру и радиусу (1,5 мм); надписи — без повторов.
   Что из добавленного настоящее, решает не модель, а карандаш: после притяжки (lab/dz/refine.js) добавленные B отрезки,
   под которыми нет графита («не подтверждено»), отбрасываются — keepB(rf, nA). Так вторая модель может только
   найти пропущенное первой, но не внести выдуманное.
   merge(PA, PB, {ppm}) — PA, PB: разбор lab/dz/layout.js parseDigit ({pts:[[подпись,x,y]], segs:[[x1,y1,x2,y2,d?]], circles, txt}) →
     {P (то же, объединённое), nA (отрезков A — первые в списке), info:{ptsAvg, ptsAdded, ptsConflict, segsAdded, circlesAdded}} */
(function(){
'use strict';
const lab=s=>String(s).trim().replace(/''|"|ʺ|〃/g,'″').replace(/['’ʹ`]/g,'′').replace(/\s+/g,'');
const len=s=>Math.hypot(s[2]-s[0],s[3]-s[1]);
function sameSeg(a,b,tol){ const L=len(a); if(L<1e-6||len(b)<1e-6) return false;
  const ux=(a[2]-a[0])/L, uy=(a[3]-a[1])/L, vx=(b[2]-b[0])/len(b), vy=(b[3]-b[1])/len(b);
  if(Math.abs(ux*vy-uy*vx)>Math.sin(4*Math.PI/180)) return false;
  const off=(x,y)=>Math.abs((x-a[0])*uy-(y-a[1])*ux), t=(x,y)=>(x-a[0])*ux+(y-a[1])*uy;
  if(off(b[0],b[1])>tol||off(b[2],b[3])>tol) return false;
  const t0=Math.min(t(b[0],b[1]),t(b[2],b[3])), t1=Math.max(t(b[0],b[1]),t(b[2],b[3])), ov=Math.max(0,Math.min(L+tol,t1)-Math.max(-tol,t0));
  return ov>=0.6*Math.max(1e-6,t1-t0); }
function merge(PA,PB,o){ o=o||{}; const ppm=o.ppm||5, info={ptsAvg:0,ptsAdded:0,ptsConflict:0,segsAdded:0,circlesAdded:0};
  const pts=PA.pts.map(q=>q.slice()), at=new Map(pts.map((q,i)=>[lab(q[0]),i]));
  (PB.pts||[]).forEach(q=>{ const k=lab(q[0]), i=at.get(k); if(i==null){ at.set(k,pts.length); pts.push(q.slice()); info.ptsAdded++; return; }
    const p=pts[i], d=Math.hypot(p[1]-q[1],p[2]-q[2]); if(d<=2*ppm){ p[1]=(p[1]+q[1])/2; p[2]=(p[2]+q[2])/2; info.ptsAvg++; } else info.ptsConflict++; });
  const segs=PA.segs.map(s=>s.slice()), nA=segs.length, tol=1.5*ppm;
  (PB.segs||[]).forEach(s=>{ if(len(s)<2*ppm) return; if(segs.some(t=>sameSeg(t,s,tol)||sameSeg(s,t,tol))) return; segs.push(s.slice()); info.segsAdded++; });
  const circles=(PA.circles||[]).map(c=>Object.assign({},c)), nCA=circles.length;
  (PB.circles||[]).forEach(c=>{ if(circles.some(m=>Math.hypot(m.cx-c.cx,m.cy-c.cy)<1.5*ppm&&Math.abs(m.r-c.r)<1.5*ppm)) return; circles.push(Object.assign({fromB:true},c)); info.circlesAdded++; });
  const seen=new Set((PA.txt||[]).map(t=>String(t[2]).trim())), txt=(PA.txt||[]).slice();
  (PB.txt||[]).forEach(t=>{ const k=String(t[2]).trim(); if(!seen.has(k)){ seen.add(k); txt.push(t); } });
  return {P:{pts,segs,circles,txt,bad:(PA.bad||0)+(PB.bad||0)},nA,nCA,info}; }
/* после притяжки: добавленное второй моделью без карандаша — вон (своё «не подтверждено» у первой модели остаётся — его решает студент) */
function keepB(rf,nA,B){ const segs=rf.segs.filter(q=>!(q.src==='model'&&q.i>=nA&&q.unverified)), dropped=rf.segs.length-segs.length;
  const fromB=(B||[]).filter(c=>c.fromB), circles=(rf.circles||[]).filter(c=>!(c.unverified&&c.src==='model'&&fromB.some(m=>Math.hypot(m.cx-c.cx,m.cy-c.cy)<Math.max(3,0.1*m.r))));
  return Object.assign({},rf,{segs,circles,stats:Object.assign({},rf.stats,{kept:rf.stats.kept-dropped,unverified:rf.stats.unverified-dropped,dropB:dropped})}); }
/* разбор → текст в формате ответа модели (P/S/C/R/T): привязке к варианту (sheetlib.fitVariant) нужен текст */
function toText(P){ const f=v=>String(Math.round(v*10)/10);
  return [].concat(P.pts.map(q=>'P '+q[0]+' '+f(q[1])+' '+f(q[2])),P.segs.map(s=>'S '+s.slice(0,4).map(f).join(' ')+(s[4]?' d':'')),
    (P.circles||[]).map(c=>(c.a1==null?'C ':'R ')+[c.cx,c.cy,c.r].map(f).join(' ')+(c.a1==null?'':' '+f(c.a1)+' '+f(c.a2))+(c.dash?' d':'')),
    (P.txt||[]).map(t=>'T '+f(t[0])+' '+f(t[1])+' '+t[2])).join('\n'); }
const api={merge,keepB,sameSeg,lab,toText};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else { self.SCANMERGE=api; }
})();
