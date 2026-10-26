/* Глаза для тестов: правда синтетического листа (где студент поставил точки условия, px) с ошибками, как у настоящей
   модели: координаты ± 1,5 % кадра, 15 % подписей пропущено, в трети снимков две подписи перепутаны, иногда — лишняя
   «точка» в случайном месте, начало O — в 70 % снимков. fake(img, H (мм листа → px), O (мм листа), id, data, seed). */
const IMG=require('../img.js'), M=require('./model.js');
function fake(img,Hm,O,id,data,seed){ const R=IMG.rng(seed*7+3), P=p=>IMG.H.apply(Hm,[O[0]+p[0],O[1]+p[1]]), W=img.width, Hh=img.height, sg=0.015*Math.max(W,Hh)/2.5;
  const g=M.given(id,data), pts={}; g.pts.forEach(q=>{ if(R()<0.15) return; const p=P(q.at); pts[q.l]=[p[0]+R.n(0,sg),p[1]+R.n(0,sg)]; });
  if(R()<0.7){ const p=P([0,0]); pts.O=[p[0]+R.n(0,sg),p[1]+R.n(0,sg)]; }
  const ks=Object.keys(pts).filter(k=>k!=='O'); if(R()<0.33&&ks.length>=2){ const a=ks[Math.floor(R()*ks.length)], b=ks.filter(k=>k!==a)[Math.floor(R()*(ks.length-1))]; [pts[a],pts[b]]=[pts[b],pts[a]]; }
  if(R()<0.2){ const ls=g.pts.map(q=>q.l).filter(l=>!pts[l]); if(ls.length) pts[ls[0]]=[R()*W,R()*Hh]; }
  return {drawings:[{part:null,box:null,pts}]}; }
module.exports={fake};
