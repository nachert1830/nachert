/* ═══════════ Замер чертёжного зрения ИГ №4: граф → 3D → вердикт (lab/ig/PLAN.md) ═══════════
   node lab/ig/eval.js [--set=synth|real|all] [--quick=1] [--only=8] [--out=файл.json] [--png=папка]
   Синтетика (lab/ig/synth.js): варианты × {верный лист, miss, extra, type, kshift}; ответ модели — имитация по начерченному (без денег).
   Настоящие фото: lab/private/ig4real/vNN-*.jpg (NN — вариант); ответ модели — server/scan/index.js (режим igraph, ключ подставляет прокси),
     кэш по хэшу запроса — lab/private/ig4real/out/cache.json; --replay=1 — только кэш; --limit=$ — предел расходов замера.
   Меры: линии графа (полнота/точность в 1 мм, тип), рамка (мм), 3D (ошибка вершин K, мм), вердикт (верные виды → «верно»,
   ошибки → «ошибка» с местом в 3 мм… вид, ложные «ошибка» — должно быть 0). */
'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const IMG=require('../img.js'), SY=require('./synth.js'), IG=require('../../lk/scan/iggraph.js'), MT=require('./metrics.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>{ const [k,v]=s.replace(/^--/,'').split('='); return [k,v==null?'1':v]; }));
const pc=(a,b)=>b?Math.round(1000*a/b)/10+' %':'—', r2=v=>Math.round(v*100)/100;
const modelScale=im=>Math.min(1,1568/Math.max(im.width,im.height),Math.sqrt(1.15e6/(im.width*im.height)));
let CH=null; const chain=()=>CH||(CH=require('./chain.js'));

function synthCases(){ const vars=A.only?A.only.split(',').map(Number):A.quick?[8,1,12]:[1,2,4,6,8,9,12,15,16,25,26,29], errs=['ok','miss','extra','type','kshift'], C=[];
  vars.forEach((n,i)=>errs.forEach((e,j)=>C.push({name:'в'+n+' '+e,n,err:e==='ok'?null:e,seed:1000+n*10+j}))); return C; }

async function runSynth(){ const rows=[];
  for(const c of synthCases()){ const t0=Date.now(); let s;
    try{ s=SY.igSynth({n:c.n,seed:c.seed,err:c.err}); }catch(e){ console.log(c.name+': синтетика не построилась — '+e.message); continue; }
    if(c.err&&!s.truth.err){ console.log(c.name+': ошибку подсадить некуда — пропуск'); continue; }
    const k=modelScale(s.img), text=SY.mockAnswer(s.truth,k,IMG.rng(c.seed*7+1));
    const r=chain().run(s.img,text,{s:k,n:c.n,sheet:s.truth.graph.sheet});
    const row={name:c.name,n:c.n,err:c.err,ms:Date.now()-t0};
    if(!r.ok){ row.fail=r.why; rows.push(row); console.log(c.name+': ОТКАЗ — '+r.why); continue; }
    row.frame=frameErr(r.H,s.truth.H,s.truth.graph.sheet); row.lines=MT.lineMetrics(r.graph,s.truth.graph); row.stats=r.stats;
    if(r.fit) row.k3d={dev:kErr(r.fit.K,s.truth.K),fitDev:r.fit.dev};
    if(r.verdict) row.verdict=judge(r.verdict,s.truth);
    rows.push(row); if(A.v&&r.verdict) r.verdict.views.forEach(v=>{ if(v.st!=='верно') console.log('   '+v.id+' '+v.st+' ['+(v.alt||'')+' '+(v.altScore||'')+' '+JSON.stringify(v.bind||{})+']: '+v.why); });
    console.log(c.name.padEnd(12)+' рамка '+row.frame.toFixed(2)+' мм · линии '+row.lines.recall+'/'+row.lines.precision+' % тип '+row.lines.type+' %'+(row.k3d?' · K '+row.k3d.dev+' мм':'')+(row.verdict?' · '+row.verdict.line:'')+' · '+row.ms+' мс');
    if(A.png) dumpPng(A.png,c.name,r,s); }
  return rows; }

/* рамка: расхождение гомографий по углам и центру поля, мм листа */
function frameErr(H,Ht,sh){ const Hi=IMG.H.inv(Ht); let m=0; [[30,15],[sh.w-15,15],[sh.w-15,sh.h-15],[30,sh.h-15],[sh.w/2,sh.h/2]].forEach(p=>{ const q=IMG.H.apply(Hi,IMG.H.apply(H,p)); m=Math.max(m,Math.hypot(q[0]-p[0],q[1]-p[1])); }); return m; }
/* вершины K: подгонка против правды (мм детали) */
function kErr(K,T){ if(!K||!T) return null; let m=0; T.forEach((P,i)=>P.forEach((p,j)=>{ const q=K[i]&&K[i][j]; m=Math.max(m,q?Math.hypot(q[0]-p[0],q[1]-p[1]):99); })); return r2(m); }
/* вердикт против правды: по видам; место ошибки — ≤ 3 мм от подсаженной (kshift — ошибка на главном виде у выреза) */
function judge(V,T){ const e=T.err, out={views:{},falseErr:0,caught:null,line:''};
  V.views.forEach(v=>{ const bad=e&&(e.view===v.id||e.kind==='kshift'), st=v.st; out.views[v.id]={st,bad:!!bad};
    if(!bad&&st==='ошибка') out.falseErr++;
    if(bad&&e.view===v.id){ const near=(v.errors||[]).some(x=>Math.hypot(x.at[0]-e.at[0],x.at[1]-e.at[1])<=(e.kind==='kshift'?12:3)||(x.len&&x.p&&IG.dPL(e.at,x.p)<=3)); out.caught=st==='ошибка'&&(near||e.kind==='kshift'&&(v.errors||[]).some(x=>x.kind==='kshift')); out.caughtSt=st; } });
  if(e&&out.caught==null) out.caught=false;
  out.line=Object.entries(out.views).map(([k,v])=>k+':'+(v.st==='верно'?'✓':v.st==='ошибка'?'✗':'?')+(v.bad?'*':'')).join(' ')+(e?(out.caught?' поймана':' НЕ поймана'):'')+(out.falseErr?' ЛОЖНЫХ '+out.falseErr:'');
  return out; }

function dumpPng(dir,name,r,s){ fs.mkdirSync(dir,{recursive:true}); const SH=require('./show.js'), marks=[];
  if(r.verdict) r.verdict.views.forEach(v=>(v.errors||[]).forEach(x=>marks.push({p:x.at,st:'ошибка',t:v.id+': '+x.what})));
  if(s&&s.truth.err) marks.push({p:s.truth.err.at,st:'не уверен',t:'правда: '+s.truth.err.kind});
  fs.writeFileSync(path.join(dir,name.replace(/\s+/g,'_')+'.svg'),SH.toSVG(r.graph,{over:s&&s.truth.graph,marks})); }

function summary(rows){ const ok=rows.filter(r=>!r.fail), L=k=>ok.map(r=>r.lines[k]).filter(v=>v!=null), avg=a=>a.length?Math.round(10*a.reduce((x,y)=>x+y,0)/a.length)/10:null;
  const tl=ok.reduce((a,r)=>a+r.lines.tLen,0), rec=ok.reduce((a,r)=>a+r.lines.recall*r.lines.tLen/100,0), gl=ok.reduce((a,r)=>a+r.lines.gLen,0), pre=ok.reduce((a,r)=>a+r.lines.precision*r.lines.gLen/100,0);
  const ty=ok.reduce((a,r)=>a+r.lines.type*r.lines.recall*r.lines.tLen/1e4,0);
  const S={cases:rows.length,fail:rows.filter(r=>r.fail).length,frameMax:r2(Math.max(...ok.map(r=>r.frame))),frameMed:r2(ok.map(r=>r.frame).sort((a,b)=>a-b)[ok.length>>1]),
    recall:Math.round(1000*rec/tl)/10,precision:Math.round(1000*pre/gl)/10,type:Math.round(1000*ty/rec)/10,recallMin:Math.min(...L('recall')),precisionMin:Math.min(...L('precision'))};
  const kk=ok.filter(r=>r.k3d&&r.k3d.dev!=null); if(kk.length) Object.assign(S,{kMax:Math.max(...kk.map(r=>r.k3d.dev)),kMed:kk.map(r=>r.k3d.dev).sort((a,b)=>a-b)[kk.length>>1]});
  const vv=ok.filter(r=>r.verdict); if(vv.length){ const okViews=[].concat(...vv.map(r=>Object.values(r.verdict.views).filter(v=>!v.bad))), errs=vv.filter(r=>r.err);
    Object.assign(S,{viewsOk:okViews.length,viewsOkRight:okViews.filter(v=>v.st==='верно').length,errCases:errs.length,errCaught:errs.filter(r=>r.verdict.caught).length,falseErr:vv.reduce((a,r)=>a+r.verdict.falseErr,0)});
    const byK={}; errs.forEach(r=>{ const b=byK[r.err]||(byK[r.err]={n:0,caught:0}); b.n++; if(r.verdict.caught) b.caught++; }); S.byErr=byK; }
  return S; }

(async()=>{ const set=A.set||'synth'; let rows=[];
  if(set==='synth'||set==='all') rows=rows.concat(await runSynth());
  if(set==='real'||set==='all') rows=rows.concat(await require('./real.js').run(A));
  const S=summary(rows.filter(r=>!r.real)); console.log('\nИТОГ синтетики: '+JSON.stringify(S));
  if(A.out) fs.writeFileSync(A.out,JSON.stringify({at:new Date().toISOString(),summary:S,rows},null,1)); })();
