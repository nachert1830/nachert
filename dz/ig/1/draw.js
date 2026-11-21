/* ═══════════ ДЗ 1 · Сопряжения: чертёж по шагам и лист А4 (SVG) ═══════════
   IG1D.steps(n) → [{cap, svg}] — построение варианта шаг за шагом: оси и центры → данные окружности → каждое сопряжение
   (ГМТ центров → центр → точки касания) → обводка. IG1D.sheet(n) — готовый лист А4 с рамкой и основной надписью.
   Цвета построений — роли из core/conj.js: ГМТ — синий пунктир, центр — красный, точки касания — зелёные, обводка — чёрная основная. */
(function(){
const NODE=typeof module!=='undefined'&&module.exports;
const K=NODE?require('../../../core/conj.js'):self.CONJ, IG1=NODE?require('./variants.js'):self.IG1;
const W=210, H=297, OX=60, OY=170;                       /* лист А4 и точка разметки (60*, 170*) */
const X=x=>+(OX+x).toFixed(3), Y=y=>+(H-OY-y).toFixed(3);
const COL={given:'#5b6677',axis:'#c0392b',locus:'#2f6fdb',aux:'#7d8aa0',center:'#d6336c',tan:'#1f9d55',result:'#111',ghost:'#d5dbe3'};
const fmt=v=>String(Math.round(v*10)/10).replace('.',',');
function arcPath(c,r,a,b,ccw){
  const an=p=>Math.atan2(p[1]-c[1],p[0]-c[0]); let s=ccw?an(b)-an(a):an(a)-an(b); while(s<=1e-9) s+=2*Math.PI;
  if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6) s=2*Math.PI;
  if(s>=2*Math.PI-1e-6){ const m=[2*c[0]-a[0],2*c[1]-a[1]]; return `M${X(a[0])} ${Y(a[1])}A${r} ${r} 0 1 ${ccw?0:1} ${X(m[0])} ${Y(m[1])}A${r} ${r} 0 1 ${ccw?0:1} ${X(a[0])} ${Y(a[1])}`; }
  return `M${X(a[0])} ${Y(a[1])}A${r} ${r} 0 ${s>Math.PI?1:0} ${ccw?0:1} ${X(b[0])} ${Y(b[1])}`;
}
const piecePath=p=>p.seg?`M${X(p.seg[0][0])} ${Y(p.seg[0][1])}L${X(p.seg[1][0])} ${Y(p.seg[1][1])}`:arcPath(p.arc.c,p.arc.r,p.from,p.to,p.ccw);
const contourPath=C=>C.map(piecePath).join('');
/* элемент шага → SVG; ghost — элементы прошлых шагов бледнее */
function el(e,ghost){
  const col=ghost?COL.ghost:COL[e.role]||'#555', w=e.role==='result'?0.8:ghost?0.25:0.4, dash=e.role==='locus'?' stroke-dasharray="3 1.5"':'';
  if(e.t==='pt'){ const r=e.role==='center'?1.6:1.3; return `<circle cx="${X(e.at[0])}" cy="${Y(e.at[1])}" r="${ghost?0.5:r}" fill="${col}"/>`+
    (e.l&&!ghost?`<text x="${X(e.at[0])+1.4}" y="${Y(e.at[1])-1.4}" font-size="5" fill="${col}" font-style="italic">${e.l}</text>`:''); }
  if(e.t==='circle') return `<circle cx="${X(e.c[0])}" cy="${Y(e.c[1])}" r="${e.r}" fill="none" stroke="${col}" stroke-width="${w}"${dash}/>`;
  if(e.t==='seg') return `<line x1="${X(e.a[0])}" y1="${Y(e.a[1])}" x2="${X(e.b[0])}" y2="${Y(e.b[1])}" stroke="${col}" stroke-width="${w}"${dash}/>`;
  if(e.t==='line'){ const a=K.add(e.p,K.mul(e.d,-400)), b=K.add(e.p,K.mul(e.d,400)); return `<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" stroke="${col}" stroke-width="${w}"${dash}/>`; }
  return '';
}
/* центровые линии: штрихпунктир, выходят за окружность на 3 мм; у окружности меньше Ø12 — сплошные тонкие (ГОСТ 2.303) */
function cross(x,y,r){ const e=r+3, st=2*r<12?'':' stroke-dasharray="8 1.5 1 1.5"';
  return `<path d="M${X(x-e)} ${Y(y)}H${X(x+e)}M${X(x)} ${Y(y-e)}V${Y(y+e)}" stroke="${COL.axis}" stroke-width="0.2"${st}/>`; }
function axes(V,R){
  const cs=[]; const seen=new Set(); const addC=(c,r)=>{ const k=c.map(v=>v.toFixed(2)).join(); if(seen.has(k)){ const o=cs.find(z=>z.k===k); o.r=Math.max(o.r,r); return; } seen.add(k); cs.push({k,c,r}); };
  Object.values(V.given).forEach(g=>{ if(g.c) addC(g.c,g.r); }); (V.draw.holes||[]).forEach(h=>addC([h[0],h[1]],h[2]/2)); (V.draw.rings||[]).forEach(h=>addC([h[0],h[1]],h[2]/2));
  return cs.map(z=>cross(z.c[0],z.c[1],z.r)).join('')+(V.draw.pitch||[]).map(p=>`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="${p[2]/2}" fill="none" stroke="${COL.axis}" stroke-width="0.2" stroke-dasharray="8 1.5 1 1.5"/>`).join('');
}
const holes=(V,w)=>(V.draw.holes||[]).concat(V.draw.rings||[]).map(h=>`<circle cx="${X(h[0])}" cy="${Y(h[1])}" r="${h[2]/2}" fill="none" stroke="${COL.result}" stroke-width="${w}"/>`).join('');
const frame=()=>`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="#999" stroke-width="0.2"/><rect x="20" y="5" width="${W-25}" height="${H-10}" fill="none" stroke="#111" stroke-width="0.6"/>`;
/* видимая область: габарит детали + поле */
function box(R,V){ let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; const P=(x,y,r=0)=>{ x0=Math.min(x0,x-r); x1=Math.max(x1,x+r); y0=Math.min(y0,y-r); y1=Math.max(y1,y+r); };
  Object.values(V.given).forEach(g=>g.c&&P(g.c[0],g.c[1],g.r)); R.ops.forEach(o=>{ if(o.O) P(o.O[0],o.O[1],o.R); });
  return [X(x0)-12,Y(y1)-12,x1-x0+24,y1-y0+24]; }
const wrap=(vb,body)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(v=>+v.toFixed(2)).join(' ')}" font-family="osifont, 'Liberation Serif', serif">${body}</svg>`;
function steps(n){
  const V=IG1.V[n], R=K.run(V), vb=box(R,V), out=[]; let ghost='';
  const givenEls=Object.entries(V.given).map(([k,g])=>g.c?K.E.circle(g,'given'):K.E.line(g,'given'));
  out.push({cap:'Оси и центры: от точки разметки откладываем положения всех центров',svg:wrap(vb,axes(V,R))});
  const base=axes(V,R)+givenEls.map(e=>el(e)).join('');
  out.push({cap:'Данные окружности и прямые — тонко',svg:wrap(vb,base)});
  ghost=base;
  for(const o of R.ops){ let cur='';
    o.steps.forEach((s,i)=>{ cur+=s.els.map(e=>el(e)).join(''); out.push({op:o.name,cap:(o.title?o.title+' · ':'')+s.cap,svg:wrap(vb,ghost+cur)}); });
    ghost+=o.steps.flatMap(s=>s.els).map(e=>el(e,true)).join(''); }
  const fin=R.contours.map(C=>`<path d="${contourPath(C)}" fill="none" stroke="${COL.result}" stroke-width="0.7" stroke-linejoin="round"/>`).join('');
  out.push({cap:'Обводка: сначала дуги, потом прямые — от точки касания до точки касания',svg:wrap(vb,ghost+fin+holes(V,0.7))});
  return out;
}
function sheet(n,{constr=true}={}){
  const V=IG1.V[n], R=K.run(V);
  const cons=constr?R.ops.flatMap(o=>o.steps.flatMap(s=>s.els)).filter(e=>e.role==='center'||e.role==='tan').map(e=>el(Object.assign({},e,{l:''}),true)).join(''):'';
  const fin=R.contours.map(C=>`<path d="${contourPath(C)}" fill="none" stroke="#111" stroke-width="0.7" stroke-linejoin="round"/>`).join('');
  const lab=`<line x1="20" y1="${H-50}" x2="${W-5}" y2="${H-50}" stroke="#111" stroke-width="0.6"/>`+
    `<text x="40" y="${H-30}" font-size="5" font-style="italic">Фамилия И.О.   Группа ........   Вариант №${n}</text>`;
  return wrap([0,0,W,H],frame()+axes(V,R)+cons+fin+holes(V,0.7)+lab);
}
const api={steps,sheet,arcPath};
if(NODE) module.exports=api; else self.IG1D=api;
})();
