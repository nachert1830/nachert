/* ═══════════ Меры графа против правды (мм листа) ═══════════
   lineMetrics(graph, truth, {tol}) — линии чертежа (без размерных и выносных — они не предмет первого запуска):
     полнота — доля длины правды, у которой в tol мм есть линия графа; точность — доля длины графа, у которой в tol мм есть линия правды
       (линии графа у размерных линий правды не считаются ни верными, ни лишними); тип — на совпавшей длине тип графа = тип правды.
   Всё по длине (образцы через 0,5 мм), по типам — отдельно. */
'use strict';
const IG=require('../../lk/scan/iggraph.js');
function grid(L,cell){ const M=new Map(); L.forEach((l,i)=>{ for(let j=1;j<l.p.length;j++){ const a=l.p[j-1], b=l.p[j], x0=Math.floor(Math.min(a[0],b[0])/cell)-1, x1=Math.floor(Math.max(a[0],b[0])/cell)+1, y0=Math.floor(Math.min(a[1],b[1])/cell)-1, y1=Math.floor(Math.max(a[1],b[1])/cell)+1;
  for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++){ const k=x+','+y; if(!M.has(k)) M.set(k,new Set()); M.get(k).add(i); } } });
  return q=>{ const s=M.get(Math.floor(q[0]/cell)+','+Math.floor(q[1]/cell)); return s?[...s].map(i=>L[i]):[]; }; }
function nearest(q,cand,f){ let best=null, bd=1e9; cand.forEach(l=>{ if(f&&!f(l)) return; const d=IG.dPL(q,l.p); if(d<bd){ bd=d; best=l; } }); return {l:best,d:bd}; }
const KEEP=l=>!l.dim;
/* тип — по четырём линиям задачи (ГОСТ 2.303): основная (и разомкнутая — тоже толстая), штриховая, штрихпунктирная, тонкая (и волнистая) */
const CLS=t=>t==='open'?'main':t==='wavy'?'thin':t;
function lineMetrics(G,T,o){ o=o||{}; const tol=o.tol||1, TL=T.lines.filter(KEEP), dims=T.lines.filter(l=>l.dim), GL=G.lines, gq=grid(GL,4), tq=grid(TL,4), dq=grid(dims,4);
  const by={}, B=t=>by[t]||(by[t]={tLen:0,hit:0,typeOk:0,gLen:0,gHit:0});
  let tLen=0, hit=0, typeOk=0;
  TL.forEach(l=>{ const S=IG.sampleP(l.p,0.5); S.forEach(q=>{ tLen+=0.5; B(l.type).tLen+=0.5; const n=nearest(q,gq(q)); if(n.d<=tol){ hit+=0.5; B(l.type).hit+=0.5;
      /* линии правды совпадают местами (ось по ребру, волнистая у оси): верен тип любой из них в 0,6 мм */
      const ok=CLS(n.l.type)===CLS(l.type)||tq(q).some(t=>CLS(t.type)===CLS(n.l.type)&&IG.dPL(q,t.p)<=0.6); if(ok){ typeOk+=0.5; B(l.type).typeOk+=0.5; } } }); });
  let gLen=0, gHit=0; const extra=[];
  GL.forEach(l=>{ const S=IG.sampleP(l.p,0.5); let bad=0; S.forEach(q=>{ const n=nearest(q,tq(q)); if(n.d<=tol){ gLen+=0.5; gHit+=0.5; B(l.type).gLen+=0.5; B(l.type).gHit+=0.5; return; } if(nearest(q,dq(q)).d<=tol) return; gLen+=0.5; B(l.type).gLen+=0.5; bad+=0.5; }); if(bad>=3) extra.push({id:l.id,type:l.type,len:bad,src:l.src,at:IG.midP(l.p)}); });
  const pc=(a,b)=>b?Math.round(1000*a/b)/10:null;
  return {recall:pc(hit,tLen),precision:pc(gHit,gLen),type:pc(typeOk,hit),tLen:Math.round(tLen),gLen:Math.round(gLen),by:Object.fromEntries(Object.entries(by).map(([k,v])=>[k,{recall:pc(v.hit,v.tLen),precision:pc(v.gHit,v.gLen),type:pc(v.typeOk,v.hit),len:Math.round(v.tLen)}])),extra};
}
module.exports={lineMetrics,grid,nearest};
