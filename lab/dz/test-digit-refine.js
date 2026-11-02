/* Встройка притяжки в сканер: prepareDigit с притяжкой и без неё на одном синтетическом чертеже.
   «Ответ модели» — правда с шумом ±3 px, плюс 2 выдуманных отрезка (на бумаге их нет) и один потерянный настоящий.
   Меры в мм листа (правда quadsynth): доля длины отрезков сканера, лежащая в 1 мм от правды (точность), и доля правды, покрытая
   отрезками сканера (полнота). Ожидание: с притяжкой точность и полнота не хуже, а выдуманные отрезки не остаются.
   node lab/dz/test-digit-refine.js [--seed=13] [--n=21] */
const IMG=require('../img.js'), Q=require('./quadsynth.js'), EY=require('./eyes.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), N=+(A.n||21), SEED=+(A.seed||13);
const s=Q.sheet({n:N,seed:SEED,closeup:8}), v=s.views[0], g=s.truth.parts[0], O=g.O, P=p=>[O[0]+p[0],O[1]+p[1]], toPx=q=>IMG.H.apply(v.H,q), Hi=IMG.H.inv(v.H), toMM=p=>IMG.H.apply(Hi,p);
const segs=g.items.filter(it=>(it.t==='seg'||it.t==='line'||it.t==='conn')&&it.a&&it.b).map(it=>[P(it.a),P(it.b)]).filter(([a,b])=>Math.hypot(b[0]-a[0],b[1]-a[1])>=3);
const pts={}; g.items.forEach(it=>{ if(it.t==='pt'&&it.l) pts[it.l]=P(it.at); });
const R=IMG.rng(11), nz=()=>(R()-0.5)*6, bb=g.box, rnd=(a,b)=>a+R()*(b-a);
const lost=segs.length>6?segs.length-3:0, kept=segs.filter((_,i)=>i!==lost);
const fake=[0,1].map(()=>{ const a=[rnd(bb[0]+10,bb[2]-10),rnd(bb[1]+10,bb[3]-10)], b=[a[0]+rnd(-50,50),a[1]+rnd(-50,50)]; return [a,b]; });
const text=Object.entries(pts).map(([l,q])=>{ const x=toPx(q); return 'P '+l+' '+Math.round(x[0]+nz())+' '+Math.round(x[1]+nz()); })
  .concat(kept.concat(fake).map(([a,b])=>{ const x=toPx(a), y=toPx(b); return 'S '+[x[0],x[1],y[0],y[1]].map(t=>Math.round(t+nz())).join(' '); })).join('\n');
const drawing=EY.parseDigit(text,1).drawings[0];
const dist=(p,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy, t=L?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L)):0; return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); };
function cover(X,Y,T){ let got=0, all=0; X.forEach(sg=>{ const L=Math.hypot(sg[1][0]-sg[0][0],sg[1][1]-sg[0][1]), n=Math.max(1,Math.ceil(L/0.5)); let k=0; for(let i=0;i<=n;i++){ const t=i/n, p=[sg[0][0]+t*(sg[1][0]-sg[0][0]),sg[0][1]+t*(sg[1][1]-sg[0][1])]; if(Y.some(y=>dist(p,y[0],y[1])<=T)) k++; } got+=k/(n+1)*L; all+=L; }); return all?got/all:0; }
const out={}; let fail=0;
[['без притяжки',{refine:false}],['с притяжкой',{}]].forEach(([name,o])=>{ const r=EY.prepareDigit(v.img,drawing,Object.assign({dz:3,n:N},o));
  if(!r.ok){ console.log(name+': НЕ СЛОЖИЛОСЬ — '+r.reason); fail++; return; }
  /* отрезки сканера — в мм поля чертежа; сверка с правдой — в мм листа через общий O: правда относительно O чертежа */
  const mine=r.dig.segs.map(q=>[[q.a[0]-r.origin[0],q.a[1]-r.origin[1]],[q.b[0]-r.origin[0],q.b[1]-r.origin[1]]]), truth=segs.map(([a,b])=>[[a[0]-O[0],a[1]-O[1]],[b[0]-O[0],b[1]-O[1]]]), truthSaid=kept.map(([a,b])=>[[a[0]-O[0],a[1]-O[1]],[b[0]-O[0],b[1]-O[1]]]);   /* полнота — только по тем, что «модель выписала»: потерянный отрезок не считаем, иначе случайный выдуманный его «покрывает» */
  if(A.debug) truthSaid.forEach((sg,i)=>{ const c=cover([sg],mine,1); if(c<0.95) console.log('    [~] '+name+': правда #'+i+' ('+sg[0].map(t=>t.toFixed(1))+')→('+sg[1].map(t=>t.toFixed(1))+') длина '+Math.hypot(sg[1][0]-sg[0][0],sg[1][1]-sg[0][1]).toFixed(1)+' мм, покрыто '+Math.round(c*100)+' %'); });
  const prec=cover(mine,truth,1), rec=cover(truthSaid,mine,1); out[name]={prec,rec,n:mine.length};
  console.log(name+': отрезков '+mine.length+' (правды '+truth.length+'); точность '+Math.round(prec*100)+' %, полнота '+Math.round(rec*100)+' %'+(r.why?r.why.filter(w=>/притяжка|отброшен отрезок/.test(w)).map(w=>'\n    '+w).join(''):'')); });
const a=out['без притяжки'], b=out['с притяжкой'];
if(a&&b){ const ok=b.prec>=a.prec-0.01&&b.rec>=a.rec-0.02; console.log(ok?'ОК: притяжка не ухудшает, точность '+Math.round(a.prec*100)+' → '+Math.round(b.prec*100)+' %, полнота '+Math.round(a.rec*100)+' → '+Math.round(b.rec*100)+' %':'ПЛОХО: притяжка ухудшила результат'); if(!ok) fail++; }
process.exit(fail?1:0);
