/* Тест: ориентация, рамка, ось x и начало O на синтетических листах ДЗ. node lab/dz/test-locate.js [--n=8] [--level=normal]
   Ориентация верна; ошибка углов рамки и O (мм, по фото); найдена ли ось z/y там, где её чертили; ложные O
   (найдено без оси или дальше 3 мм от верного) — их должно быть 0: отказ лучше ложного начала. */
const {dzSynth}=require('./synth.js'), {locate}=require('./locate.js'), IMG=require('../img.js'), DS=require('./sheet.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), N=+(A.n||8), LV=A.level||'normal';
let ok=0, orient=0, fe=[], oe=[], zFound=0, zDrawn=0, zFalse=0, oBad=0, ref=[];
for(let i=0;i<N;i++){ const id=['2','2b','2c','3'][i%4], s=dzSynth({id,seed:300+i,level:LV,turn:i%4}), t=s.truth, r=locate(s.img);
  if(!r.ok){ ref.push(i+': '+r.reason); continue; } ok++; if(r.turn===t.turn) orient++;
  const pxmm=r.pxPerMm, F=DS.FRAME, ideal=[[F[0],F[1]],[F[2],F[1]],[F[2],F[3]],[F[0],F[3]]];
  const dpx=(P,Q)=>Math.hypot(P[0]-Q[0],P[1]-Q[1]);
  fe.push(Math.max(...ideal.map((p,k)=>dpx(IMG.H.apply(r.H,p),IMG.H.apply(t.H,t.frame[k]))))/pxmm);
  if(t.zAxis) zDrawn++; if(r.O){ if(t.zAxis){ zFound++; oe.push(dpx(IMG.H.apply(r.H,r.O),IMG.H.apply(t.H,t.O))/pxmm); if(oe[oe.length-1]>3) oBad++; } else zFalse++; }
  console.log(i,id,'поворот',t.turn,'→',r.turn,'рамка',fe[fe.length-1].toFixed(2),'мм; O',r.O?(t.zAxis?oe[oe.length-1].toFixed(2)+' мм':'НАЙДЕНО, А ОСИ НЕТ'):(t.zAxis?'не найдено':'нет (и не чертили)'),'штамп',r.title.score.toFixed(2)); }
const md=a=>a.length?a.slice().sort((x,y)=>x-y)[a.length>>1].toFixed(2):'—', mx=a=>a.length?Math.max(...a).toFixed(2):'—';
console.log('ИТОГО ('+LV+'): найдено листов '+ok+' из '+N+', ориентация верна '+orient+' из '+ok+', рамка — медиана '+md(fe)+' / худшая '+mx(fe)+' мм, ось z/y найдена '+zFound+' из '+zDrawn+' (ложно — '+zFalse+'), O неверно (> 3 мм) — '+oBad+', O — медиана '+md(oe)+' / худшая '+mx(oe)+' мм');
ref.forEach(x=>console.log('  отказ '+x));
