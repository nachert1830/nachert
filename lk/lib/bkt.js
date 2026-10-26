/* Карта навыков: ошибки → навыки, оценка освоения по Bayesian Knowledge Tracing (Corbett, Anderson, 1995).
   Навык начерта = тема тетради (те же темы, что на основном сайте); навык ИКГ = группа правил ГОСТ из нормоконтроля.
   Наблюдение — событие {id, t, skills, ok}: «решил сам» — верно; «с подсказкой» и «не смог» — неверно (подсказка в BKT считается
   ошибкой, как в ASSISTments); ошибка «вычисления/описка» — промах (slip), навык не штрафуется.
   P(L) после наблюдения: апостериорная по формуле Байеса с вероятностями промаха S и угадывания G, затем переход T.
   Освоено — P(L) ≥ 0,95 (порог Корбетта–Андерсона). События только дописываются, поэтому синхронизация — объединение по id. */
(function(root,f){ if(typeof module==='object'&&module.exports) module.exports=f(); else root.ClubBKT=f(); })(typeof self!=='undefined'?self:this,function(){
'use strict';
const P={L0:.2,T:.12,S:.1,G:.2}, MASTER=.95, MAX_EVENTS=1500;
/* общие ошибки, которые студент отмечает после «с подсказкой» / «не смог» */
const ERRORS=[
  {id:'proj',t:'перепутал проекции, линии связи',skills:['point-epure']},
  {id:'method',t:'не понял, каким способом решать',skills:['@topic']},
  {id:'tl',t:'натуральная величина, углы наклона',skills:['true-length']},
  {id:'level',t:'горизонталь и фронталь плоскости',skills:['plane-inplane']},
  {id:'vis',t:'видимость',skills:['visibility']},
  {id:'perp',t:'прямой угол, перпендикуляр',skills:['perp-theorem','perpendicular']},
  {id:'transform',t:'замена плоскостей, вращение',skills:['replace-planes','rotation']},
  {id:'calc',t:'вычисления, измерения, описка',skills:[]}
];
/* навыки ИКГ — группы правил нормоконтроля (tests/normo.js): номер ГОСТ → навык */
const IKG_SKILLS=[
  {id:'ikg-format',title:'Формат, рамка, основная надпись',gost:['2.301','2.104']},
  {id:'ikg-lines',title:'Типы и толщины линий',gost:['2.303']},
  {id:'ikg-font',title:'Шрифт и надписи',gost:['2.304']},
  {id:'ikg-views',title:'Виды, разрезы, проекционная связь',gost:['2.305']},
  {id:'ikg-hatch',title:'Штриховка',gost:['2.306']},
  {id:'ikg-dims',title:'Размеры',gost:['2.307','2.302']},
  {id:'ikg-model',title:'Соответствие детали',gost:['модель']}
];
function ikgSkillOf(gost){ const g=String(gost||''); const s=IKG_SKILLS.find(x=>x.gost.some(p=>g.indexOf(p)===0)); return s?s.id:'ikg-model'; }

function step(p,ok,prm){ const q=prm||P;
  const post=ok?p*(1-q.S)/(p*(1-q.S)+(1-p)*q.G):p*q.S/(p*q.S+(1-p)*(1-q.G));
  return post+(1-post)*q.T; }

/* events → {skill:{p, n, ok, last}} */
function estimate(events,params){ const out={};
  (events||[]).slice().sort((a,b)=>a.t-b.t||String(a.id).localeCompare(String(b.id))).forEach(e=>{
    if(e.ok!==true&&e.ok!==false) return;
    (e.skills||[]).forEach(s=>{ const o=out[s]||(out[s]={p:(params&&params[s]&&params[s].L0)||P.L0,n:0,ok:0,last:0});
      o.p=step(o.p,e.ok,params&&params[s]); o.n++; if(e.ok) o.ok++; o.last=Math.max(o.last,e.t||0); }); });
  return out; }
function mastery(est,skill){ const o=est[skill]; return o?o.p:P.L0; }
function level(p,n){ if(!n) return {id:'none',t:'нет данных'}; if(p>=MASTER) return {id:'master',t:'освоено'}; if(p>=.7) return {id:'near',t:'почти'}; if(p>=.4) return {id:'mid',t:'в процессе'}; return {id:'low',t:'слабое место'}; }

/* событие из самооценки задачи: rating 2/1/0, errors — id из ERRORS или симптомов ядра ({id, topic}) */
function fromRating(o){ const {id,t,task,topic,rating,errors,symptoms,src}=o, ev=[];
  const errs=(errors||[]).map(x=>ERRORS.find(e=>e.id===x)).filter(Boolean), slipOnly=rating<2&&errs.length&&errs.every(e=>e.id==='calc')&&!(symptoms||[]).length;
  if(topic&&!slipOnly) ev.push({id:id+':t',t,task,skills:[topic],ok:rating===2,src:src||'train'});
  if(rating<2){ const extra=new Set();
    errs.forEach(e=>e.skills.forEach(s=>{ const k=s==='@topic'?topic:s; if(k&&k!==topic) extra.add(k); }));
    (symptoms||[]).forEach(s=>{ if(s.topic&&s.topic!==topic) extra.add(s.topic); });
    [...extra].forEach((s,i)=>ev.push({id:id+':e'+i,t,task,skills:[s],ok:false,src:src||'train'})); }
  return ev; }

/* события из нормоконтроля листа: по каждой группе правил — была ли в ней ошибка */
function fromNormo(o){ const {id,t,issues}=o, bad=new Set((issues||[]).map(i=>ikgSkillOf(i.gost)));
  return IKG_SKILLS.filter(s=>s.id!=='ikg-model'||bad.has('ikg-model')).map(s=>({id:id+':'+s.id,t,skills:[s.id],ok:!bad.has(s.id),src:'normo'})); }

/* начальные наблюдения из очереди повторения основного сайта (nch2_rep: r — последняя самооценка) */
function fromRep(rep,topicOf){ const ev=[]; Object.keys(rep||{}).forEach(k=>{ const o=rep[k], tp=topicOf(+k); if(!tp||!o||!o.n||o.r==null) return;
  ev.push({id:'rep:'+k+':'+o.l,t:(o.l||0)*864e5,task:+k,skills:[tp],ok:o.r===2,src:'rep'}); }); return ev; }

function merge(a,b){ const m=new Map(); (a||[]).concat(b||[]).forEach(e=>{ if(e&&e.id!=null&&!m.has(String(e.id))) m.set(String(e.id),e); });
  return [...m.values()].sort((x,y)=>x.t-y.t).slice(-MAX_EVENTS); }

/* рекомендации: самые слабые навыки (сначала темы ближайшего РК) → задачи тетради этой темы, которых ещё нет в повторении */
function recommend(est,tasks,rep,focus,count){ const by={}; tasks.forEach(t=>{ if(t.topic) (by[t.topic]=by[t.topic]||[]).push(t); });
  const fs=new Set(focus||[]);
  const skills=Object.keys(by).map(s=>({s,p:mastery(est,s),n:(est[s]||{}).n||0})).filter(x=>x.p<MASTER)
    .sort((a,b)=>(fs.size?(fs.has(a.s)?0:1)-(fs.has(b.s)?0:1):0)||a.p-b.p||a.s.localeCompare(b.s)).slice(0,count||3);
  return skills.map(x=>({skill:x.s,p:x.p,n:x.n,tasks:by[x.s].filter(t=>!(rep||{})[t.n]||(rep[t.n].b||0)<2).slice(0,2).map(t=>t.n)})); }

return {P,MASTER,ERRORS,IKG_SKILLS,ikgSkillOf,step,estimate,mastery,level,fromRating,fromNormo,fromRep,merge,recommend};
});
