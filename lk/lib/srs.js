/* Интервальное повторение задач и «Тренировка дня».
   Тот же алгоритм и тот же формат, что у LEARN на основном сайте (ключ nch2_rep), чтобы очередь продолжалась после переноса:
   ступени 1 → 3 → 7 → 16 → 35 дней; «Решил сам» — ступень выше, «С подсказкой» — та же ступень и половина интервала (не меньше 2 дней),
   «Не смог» — завтра. Не больше 3 задач на повтор в день. Тренировка дня = повтор по интервалам + одна задача вперемешку
   из другой темы (по слабым навыкам и ближайшему РК) — 15–20 минут. */
(function(root,f){ if(typeof module==='object'&&module.exports) module.exports=f(); else root.ClubSRS=f(); })(typeof self!=='undefined'?self:this,function(){
'use strict';
const IV=[1,3,7,16,35], PER_DAY=3, MIN_PER_TASK=4;   /* 3 повтора + 1 вперемешку ≈ 16 минут решения + 3 на самооценку */
const isNum=k=>/^\d+$/.test(String(k));

function seen(rep,key,day){ const k=String(key); if(rep[k]) return rep; const o=Object.assign({},rep); o[k]={b:0,d:day+1,s:day,l:day,n:0}; return o; }
function rate(rep,key,v,day){ const k=String(key), o=rep[k]?Object.assign({},rep[k]):{b:0,s:day,n:0,fresh:1};
  if(v===2){ o.b=o.fresh?1:Math.min(o.b+1,IV.length-1); o.d=day+IV[o.b]; }
  else if(v===1) o.d=day+Math.max(2,Math.round(IV[o.b]/2));
  else { o.b=0; o.d=day+1; }
  delete o.fresh; o.l=day; o.n=(o.n||0)+1; o.r=v; const out=Object.assign({},rep); out[k]=o; return out; }
function queue(rep,day,known){ return Object.keys(rep||{}).filter(k=>isNum(k)&&(!known||known(+k))).map(k=>Object.assign({k:+k},rep[k]))
  .sort((a,b)=>a.d-b.d||a.s-b.s).map(o=>Object.assign(o,{due:o.d<=day})); }

/* tasks — ядро [{n, topic}], mastery(topic) → 0..1 (BKT), focus — темы ближайшего РК (необязательно) */
function training(rep,day,tasks,mastery,focus,seed){
  const byN=new Map(tasks.map(t=>[t.n,t]));
  const due=queue(rep,day,n=>byN.has(n)).filter(o=>o.due);
  const doneToday=queue(rep,day,n=>byN.has(n)).filter(o=>o.n&&o.l===day&&o.d>day);
  const left=Math.max(0,PER_DAY-doneToday.length);
  const review=due.slice(0,left).map(o=>({n:o.k,kind:'review',stage:o.b,topic:(byN.get(o.k)||{}).topic}));
  /* одна задача вперемешку: тема не совпадает с темами повтора; сначала темы РК, затем слабые; задачи, которых ещё нет в очереди */
  const used=new Set(review.map(r=>r.topic)), inRep=new Set(Object.keys(rep||{}).map(Number));
  const rnd=mulberry(seed==null?day:seed);
  const cand=tasks.filter(t=>t.topic&&!used.has(t.topic)&&!inRep.has(t.n));
  const fset=new Set(focus||[]);
  const score=t=>(fset.size&&fset.has(t.topic)?0:1)+(mastery?mastery(t.topic):.5)+rnd()*.35;
  let mix=null; if(cand.length){ mix=cand.map(t=>({t,s:score(t)})).sort((a,b)=>a.s-b.s)[0].t; }
  const items=review.concat(mix?[{n:mix.n,kind:'mix',topic:mix.topic}]:[]);
  return {items,minutes:items.length*MIN_PER_TASK+(items.length?3:0),dueTotal:due.length,doneToday:doneToday.length,
    later:Math.max(0,due.length-review.length)}; }

function mulberry(a){ a=(a>>>0)||1; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

return {IV,PER_DAY,MIN_PER_TASK,seen,rate,queue,training,mulberry};
});
