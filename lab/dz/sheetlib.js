/* ═══════════ Общее для конвейера листа (Node и браузер): привязка к условию варианта и чистая цифровая копия (SVG) ═══════════
   fitVariant(text, variant, dz) — точки, выписанные моделью (формат P/S), → задание и вариант, невязка в мм, перспектива;
     free — безосный эпюр: горизонтальная проекция сдвинута по линии связи на free мм против таблицы варианта;
   svgOf(out) — SVG-копия: подтверждённые линии сплошные, не подтверждённые — оранжевые пунктиром, найденные сверх модели — бледные. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const EY=isNode?require('./eyes.js'):self.LAB.dzEyes, V=isNode?require('../../core/dz-variants.js'):self.CORE.dzVariants;
/* привязка точек модели к условию: variant — номер или auto (перебор вариантов 1–30 заданий dz); лучший — больше согласных точек, при равенстве — меньше невязка */
/* одна подпись — несколько точек (модель выписала и условие, и точку построения с нечитаемым индексом: A″ и ещё A″): разбор
   оставил бы последнюю, и привязка падала или уходила к чужому варианту. Поэтому перебираются сочетания (до 64), лучшее — по
   числу согласных точек, затем по невязке; у результата pick — какие строки P выбраны (номера в тексте) */
function fitVariant(text,variant,dz){ const lines=String(text||'').split(/\r?\n/), byL=new Map();
  lines.forEach((l,i)=>{ const m=l.match(/^\s*P\s+(\S+)/); if(!m) return; if(!byL.has(m[1])) byL.set(m[1],[]); byL.get(m[1]).push(i); });
  const dup=[...byL.values()].filter(a=>a.length>1); if(!dup.length) return fit1(text,variant,dz);
  let combos=[[]]; dup.forEach(a=>{ combos=combos.flatMap(c=>a.map(i=>c.concat(i))); if(combos.length>64) combos=combos.slice(0,64); });
  const drop=new Set(dup.flat()); let best=null;
  combos.forEach(c=>{ const keep=new Set(c), t=lines.filter((l,i)=>!drop.has(i)||keep.has(i)).join('\n'), r=fit1(t,variant,dz); if(!r||r.rmsMm==null) return;
    if(!best||r.inl>best.inl||(r.inl===best.inl&&r.rmsMm<best.rmsMm)){ best=r; best.pick=c; } });
  return best||fit1(text,variant,dz); }
function fit1(text,variant,dz){ if(dz&&![2,3].includes(+dz)) return {inl:0,of:0,rmsMm:null};   /* ДЗ №4 — по очеркам тел (lk/scan/bind4.js), не по точкам */
  const dr=EY.parseDigit(text,1).drawings[0]; if(!dr) return null; let best=null;
  const dzs=dz?[+dz]:[2,3], ns=variant==='auto'?Array.from({length:30},(_,i)=>i+1):[+variant];
  dzs.forEach(d=>ns.forEach(n=>{ const gv=V.get(d,n); if(!gv) return; const PP0=EY.pairs(dr,gv.id,gv.data); let PP=PP0, b=PP.length>=4?EY.bindAffine(PP,{tol:3}):null, free=null;
    /* безосный эпюр: оси x на чертеже нет (или проекции раздвинуты по-своему) — расстояние между ″ и ′ по линии связи свободное.
       Тогда горизонтальная проекция сдвигается по линии связи на Δ (−40…40 мм); берётся, только если согласных точек больше и их ≥ 6 */
    { const PF=PP0.filter(q=>q.pr), nh=PF.filter(q=>q.pr==='h').length, nf=PF.length-nh;
      if(nh>=2&&nf>=2&&PF.length>=5&&(!b||b.inl.length<PF.length)){ const sh=dl=>PF.map(q=>q.pr==='h'?Object.assign({},q,{m:[q.m[0],q.m[1]+dl]}):q); let bf=null;
        const tryD=dl=>{ const P2=sh(dl), b2=EY.bindAffine(P2,{tol:3}); if(b2&&b2.inl.length>=4&&(!bf||b2.inl.length>bf.b.inl.length||(b2.inl.length===bf.b.inl.length&&b2.rms<bf.b.rms))) bf={b:b2,P:P2,dl}; };
        for(let dl=-40;dl<=40;dl+=2) tryD(dl); if(bf){ const c=bf.dl; for(let dl=c-1.75;dl<=c+1.75;dl+=0.25) tryD(dl); }
        /* лишний параметр: 4–5 точек он подгоняет к любому варианту — свободный сдвиг только при ≥ 6 согласных */
        if(bf&&bf.b.inl.length>=6&&(!b||bf.b.inl.length>b.inl.length)){ b=bf.b; PP=bf.P; free=+bf.dl.toFixed(2); } } }
    if(!b||b.inl.length<4) return;
    const r={dz:d,n,inl:b.inl.length,of:PP.length,rmsMm:b.rms/b.s,ppm:b.s,A:b.A,out:(b.out||[]).map(q=>q.l)}; if(free!=null) r.free=free;
    /* перспектива снимка: гомография по согласным точкам условия (как prepareDigit); без неё оси наклонены. Допуск 1,5 мм, нужно ≥ 4 точек */
    try{ const hb=EY.bindHom(PP,1.5*b.s); if(hb&&hb.inl.length>=4){ r.M=hb.M; r.hom={inl:hb.inl.length,rmsMm:hb.rms/b.s}; } }catch(e){} if(!best||r.inl>best.inl||(r.inl===best.inl&&r.rmsMm<best.rmsMm)) best=r; }));
  return best||{inl:0,of:0,rmsMm:null}; }

/* чистая цифровая копия: SVG без фото. Единицы — мм (если привязка к условию сошлась), иначе px чертежа в исходном фото */
/* точки дуги/окружности в пикселях чертежа (угол растёт по часовой стрелке на экране, y вниз); перспективу даёт отображение каждой точки */
function arcPoints(c,n){ n=n||72; const full=c.full||c.a1==null, a0=full?0:c.a1, L=full?360:((c.a2-c.a1+360)%360)||360, m=Math.max(8,Math.round(n*L/360)), out=[];
  for(let i=0;i<=m;i++){ const a=(a0+L*i/m)*Math.PI/180; out.push([c.cx+c.r*Math.cos(a),c.cy+c.r*Math.sin(a)]); } return out; }
function svgOf(out){ const items=out.drawings.filter(d=>d.segs).map(d=>{ const mm=d.mm&&d.mm.segs.length?d.mm:null; return {d,segs:mm?mm.segs:d.segs,pts:mm?mm.pts:d.pts,txt:mm&&mm.txt?mm.txt:(d.txt||[]),mm:!!mm,circles:(d.circles||[]).concat(d.curves||[]).map(c=>({c,poly:mm&&c.mm?c.mm:c.poly}))}; });   /* кривые (ДЗ №4) — ломаные, как дуги */
  if(!items.length) return null; const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  items.forEach(it=>{ let a=1e9,b=1e9,c=-1e9,e=-1e9; it.segs.forEach(q=>{ [[q.p[0],q.p[1]],[q.p[2],q.p[3]]].forEach(([x,y])=>{ a=Math.min(a,x); b=Math.min(b,y); c=Math.max(c,x); e=Math.max(e,y); }); }); it.circles.forEach(k=>(k.poly||[]).forEach(([x,y])=>{ a=Math.min(a,x); b=Math.min(b,y); c=Math.max(c,x); e=Math.max(e,y); })); it.pts.forEach(q=>{ a=Math.min(a,q[1]); b=Math.min(b,q[2]); c=Math.max(c,q[1]); e=Math.max(e,q[2]); }); it.box=[a,b,c,e]; it.sc=it.mm?1:0.25; it.w=(c-a)*it.sc+20; it.h=(e-b)*it.sc+20; });
  const cols=items.length>1?2:1, colW=[], rowH=[]; items.forEach((it,i)=>{ const c=i%cols, r=Math.floor(i/cols); colW[c]=Math.max(colW[c]||0,it.w); rowH[r]=Math.max(rowH[r]||0,it.h+8); });
  const xs=[0], ys=[0]; colW.forEach((w,c)=>xs[c+1]=xs[c]+w); rowH.forEach((h,r)=>ys[r+1]=ys[r]+h);
  const g=items.map((it,i)=>{ const c=i%cols, r=Math.floor(i/cols), [a,b]=it.box, dx=xs[c]+10-a*it.sc, dy=ys[r]+16-b*it.sc, T=(x,y)=>[(x*it.sc+dx).toFixed(2),(y*it.sc+dy).toFixed(2)];
    const lines=it.segs.map(q=>{ const p1=T(q.p[0],q.p[1]), p2=T(q.p[2],q.p[3]), col=q.src==='found'?'#8aa4c8':q.unverified?'#e07b00':'#111', w=q.src==='found'?0.25:q.unverified?0.3:0.45, dash=q.dash?'1.6 1':(q.unverified?'2 1':'');
      return '<line x1="'+p1[0]+'" y1="'+p1[1]+'" x2="'+p2[0]+'" y2="'+p2[1]+'" stroke="'+col+'" stroke-width="'+w+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+' stroke-linecap="round"/>'; });
    const arcs=it.circles.filter(k=>k.poly&&k.poly.length>1).map(k=>{ const q=k.c, col=q.src==='found'?'#8aa4c8':q.unverified?'#e07b00':'#111', w=q.src==='found'?0.25:q.unverified?0.3:0.45, dash=q.dash?'1.6 1':(q.unverified?'2 1':''), pts=k.poly.map(([x,y])=>T(x,y).join(',')).join(' ');
      return '<polyline fill="none" points="'+pts+'" stroke="'+col+'" stroke-width="'+w+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+' stroke-linecap="round" stroke-linejoin="round"/>'; });
    /* подписи точек и надписи — крупно и читаемо на телефоне: кегль от размера чертежа, белая обводка поверх линий */
    const fs=Math.max(2.8,0.03*Math.max(it.w,it.h)), halo=' stroke="#fff" stroke-width="'+(fs*0.28).toFixed(2)+'" paint-order="stroke" stroke-linejoin="round"';
    const dots=it.pts.map(q=>{ const p=T(q[1],q[2]); return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(fs*0.2).toFixed(2)+'" fill="#c0005a"/><text x="'+(+p[0]+fs*0.35).toFixed(2)+'" y="'+(+p[1]-fs*0.3).toFixed(2)+'" font-size="'+fs.toFixed(2)+'" font-weight="600" font-family="sans-serif" fill="#a1004a"'+halo+'>'+esc(q[0])+'</text>'; })
      .concat(it.txt.map(q=>{ const p=T(q[0],q[1]); return '<text x="'+p[0]+'" y="'+p[1]+'" font-size="'+(fs*0.78).toFixed(2)+'" font-style="italic" font-family="sans-serif" fill="#44505f"'+halo+'>'+esc(String(q[2]).slice(0,40))+'</text>'; }));
    const f=it.d.fit, cap='чертёж '+(i+1)+(it.d.part?' · часть '+it.d.part:'')+(it.mm?' · мм':' · px×0,25')+(f&&f.rmsMm!=null?' · ДЗ №'+f.dz+' в.'+f.n+' · невязка '+(f.hom?f.hom.rmsMm:f.rmsMm).toFixed(2)+' мм'+(f.hom?' (перспектива учтена)':''):'');
    return '<g><text x="'+(xs[c]+10)+'" y="'+(ys[r]+8)+'" font-size="3.4" font-family="sans-serif" fill="#555">'+esc(cap)+'</text>'+lines.join('')+arcs.join('')+dots.join('')+'</g>'; });
  const W=xs[xs.length-1], H=ys[ys.length-1];
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W.toFixed(1)+' '+H.toFixed(1)+'" width="'+Math.round(W*4)+'" height="'+Math.round(H*4)+'"><rect width="100%" height="100%" fill="#fff"/>'+g.join('')+'</svg>'; }

const api={fitVariant,svgOf,arcPoints};
if(isNode) module.exports=api; else { self.LAB=self.LAB||{}; self.LAB.sheetlib=api; }
})();
