/* ═══════════ Общее для конвейера листа (Node и браузер): привязка к условию варианта и чистая цифровая копия (SVG) ═══════════
   fitVariant(text, variant, dz) — точки, выписанные моделью (формат P/S), → задание и вариант, невязка в мм, перспектива;
   svgOf(out) — SVG-копия: подтверждённые линии сплошные, не подтверждённые — оранжевые пунктиром, найденные сверх модели — бледные. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const EY=isNode?require('./eyes.js'):self.LAB.dzEyes, V=isNode?require('../../core/dz-variants.js'):self.CORE.dzVariants;
/* привязка точек модели к условию: variant — номер или auto (перебор вариантов 1–30 заданий dz); лучший — больше согласных точек, при равенстве — меньше невязка */
function fitVariant(text,variant,dz){ const dr=EY.parseDigit(text,1).drawings[0]; if(!dr) return null; let best=null;
  const dzs=dz?[+dz]:[2,3], ns=variant==='auto'?Array.from({length:30},(_,i)=>i+1):[+variant];
  dzs.forEach(d=>ns.forEach(n=>{ const gv=V.get(d,n); if(!gv) return; const PP=EY.pairs(dr,gv.id,gv.data), b=PP.length>=4?EY.bindAffine(PP,{tol:3}):null; if(!b||b.inl.length<4) return;
    const r={dz:d,n,inl:b.inl.length,of:PP.length,rmsMm:b.rms/b.s,ppm:b.s,A:b.A,out:(b.out||[]).map(q=>q.l)};
    /* перспектива снимка: гомография по согласным точкам условия (как prepareDigit); без неё оси наклонены. Допуск 1,5 мм, нужно ≥ 4 точек */
    try{ const hb=EY.bindHom(PP,1.5*b.s); if(hb&&hb.inl.length>=4){ r.M=hb.M; r.hom={inl:hb.inl.length,rmsMm:hb.rms/b.s}; } }catch(e){} if(!best||r.inl>best.inl||(r.inl===best.inl&&r.rmsMm<best.rmsMm)) best=r; }));
  return best||{inl:0,of:0,rmsMm:null}; }

/* чистая цифровая копия: SVG без фото. Единицы — мм (если привязка к условию сошлась), иначе px чертежа в исходном фото */
function svgOf(out){ const items=out.drawings.filter(d=>d.segs).map(d=>{ const mm=d.mm&&d.mm.segs.length?d.mm:null; return {d,segs:mm?mm.segs:d.segs,pts:mm?mm.pts:d.pts,mm:!!mm}; });
  if(!items.length) return null; const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  items.forEach(it=>{ let a=1e9,b=1e9,c=-1e9,e=-1e9; it.segs.forEach(q=>{ [[q.p[0],q.p[1]],[q.p[2],q.p[3]]].forEach(([x,y])=>{ a=Math.min(a,x); b=Math.min(b,y); c=Math.max(c,x); e=Math.max(e,y); }); }); it.box=[a,b,c,e]; it.sc=it.mm?1:0.25; it.w=(c-a)*it.sc+20; it.h=(e-b)*it.sc+20; });
  const cols=items.length>1?2:1, colW=[], rowH=[]; items.forEach((it,i)=>{ const c=i%cols, r=Math.floor(i/cols); colW[c]=Math.max(colW[c]||0,it.w); rowH[r]=Math.max(rowH[r]||0,it.h+8); });
  const xs=[0], ys=[0]; colW.forEach((w,c)=>xs[c+1]=xs[c]+w); rowH.forEach((h,r)=>ys[r+1]=ys[r]+h);
  const g=items.map((it,i)=>{ const c=i%cols, r=Math.floor(i/cols), [a,b]=it.box, dx=xs[c]+10-a*it.sc, dy=ys[r]+16-b*it.sc, T=(x,y)=>[(x*it.sc+dx).toFixed(2),(y*it.sc+dy).toFixed(2)];
    const lines=it.segs.map(q=>{ const p1=T(q.p[0],q.p[1]), p2=T(q.p[2],q.p[3]), col=q.src==='found'?'#8aa4c8':q.unverified?'#e07b00':'#111', w=q.src==='found'?0.25:q.unverified?0.3:0.45, dash=q.dash?'1.6 1':(q.unverified?'2 1':'');
      return '<line x1="'+p1[0]+'" y1="'+p1[1]+'" x2="'+p2[0]+'" y2="'+p2[1]+'" stroke="'+col+'" stroke-width="'+w+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+' stroke-linecap="round"/>'; });
    const dots=it.pts.map(q=>{ const p=T(q[1],q[2]); return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="0.7" fill="#c0005a"/><text x="'+(+p[0]+1.1)+'" y="'+(+p[1]-1.1)+'" font-size="3" font-family="sans-serif" fill="#c0005a">'+esc(q[0])+'</text>'; });
    const f=it.d.fit, cap='чертёж '+(i+1)+(it.d.part?' · часть '+it.d.part:'')+(it.mm?' · мм':' · px×0,25')+(f&&f.rmsMm!=null?' · ДЗ №'+f.dz+' в.'+f.n+' · невязка '+(f.hom?f.hom.rmsMm:f.rmsMm).toFixed(2)+' мм'+(f.hom?' (перспектива учтена)':''):'');
    return '<g><text x="'+(xs[c]+10)+'" y="'+(ys[r]+8)+'" font-size="3.4" font-family="sans-serif" fill="#555">'+esc(cap)+'</text>'+lines.join('')+dots.join('')+'</g>'; });
  const W=xs[xs.length-1], H=ys[ys.length-1];
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W.toFixed(1)+' '+H.toFixed(1)+'" width="'+Math.round(W*4)+'" height="'+Math.round(H*4)+'"><rect width="100%" height="100%" fill="#fff"/>'+g.join('')+'</svg>'; }

const api={fitVariant,svgOf};
if(isNode) module.exports=api; else { self.LAB=self.LAB||{}; self.LAB.sheetlib=api; }
})();
