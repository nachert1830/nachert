/* Наставник: знания ДЗ из пакета (ig4.json — снимок IG4S.tutor(n) и методики, собирает tools/tutor-pack.js).
   Здесь ничего не вычисляется заново: только выборка того, что посчитало ядро сайта. */
'use strict';
const PACKS={ig4:require('./ig4.json')};

/* способ построения точки (поле how в steps.js) — словами методики */
const HOW={
  edge:'Точка на ребре тела: проводим линию связи от известной проекции до проекции этого ребра на другом виде.',
  T:'Точка на поверхности, перпендикулярной π₁ (на виде сверху эта поверхность — линия): сначала находим её на виде сверху (на линии поверхности), затем на виде слева — высота с главного вида, глубина — с вида сверху.',
  L:'Точка на грани, перпендикулярной π₃ (на виде слева грань — линия): горизонтальная линия связи от k″ до линии грани даёт k‴; глубину от оси вида слева откладываем от оси вида сверху и опускаем вертикальную линию связи от k″.',
  P:'Точка общего положения — через параллель: горизонтальная плоскость на высоте точки режет тело по простой линии (окружность, многоугольник); точка лежит на этой линии.',
  vis:'Точка смены видимости: ребро выреза внутри тела уходит под край выреза над ним — здесь линия меняется с видимой на невидимую. Глубина — как у точки над ней.'
};
const HOW_NAME={edge:'на ребре',T:'на поверхности ⟂ π₁',L:'на грани ⟂ π₃',P:'через параллель',vis:'смена видимости'};

/* идея шага — пункт плана методики, к которому относится шаг */
const STEP_PLAN={given:null,anal:null,axis:0,body:0,kP:[1,2],kLines:3,erase:3,secL:4,secV:[4,5],aa:4,aa2:[4,5],dims:6,sheet:5};

function pack(dz){ const p=PACKS[dz]; if(!p) return null; return p; }
function variant(dz,n){ const p=pack(dz); return p&&p.variants[n]||null; }

/* реестр точек варианта: номер → {n, x, y, z, how, k — первый шаг, где точка строится} */
const regCache=new Map();
function registry(dz,n){ const key=dz+':'+n; if(regCache.has(key)) return regCache.get(key); const v=variant(dz,n), R=new Map();
  if(v) v.steps.forEach(s=>s.points.forEach(p=>{ if(!R.has(p.n)) R.set(p.n,Object.assign({k:s.k},p)); }));
  regCache.set(key,R); return R; }

function idea(dz,st){ const p=pack(dz), m=p.method, i=STEP_PLAN[st.id];
  if(st.id==='given') return m.essence; if(st.id==='anal') return m.idea;
  const ix=i==null?[]:[].concat(i); return ix.map(j=>m.plan[j]).filter(Boolean).map(x=>x.t+': '+x.d+(x.why?' ('+x.why+')':'')).join('\n'); }

/* содержимое шага на глубине: title < idea < short < full */
const DEPTHS=['title','idea','short','full'];
function stepAt(dz,n,k,depth){ const v=variant(dz,n), st=v&&v.steps[k-1]; if(!st) return null; const d=DEPTHS.indexOf(depth);
  const o={k:st.k,id:st.id,title:st.title,depth:DEPTHS[Math.max(0,d)]};
  if(d>=1) o.idea=idea(dz,st);
  if(d>=2) o.short=st.short;
  if(d>=3){ o.more=st.more; o.points=st.points.map(p=>({n:p.n,x:p.x,y:p.y,z:p.z,how:p.how,how_name:HOW_NAME[p.how]||null})); }
  else if(st.points.length) o.points_count=st.points.length;
  return o; }

function overview(dz,n){ const p=pack(dz), v=variant(dz,n); if(!v) return null;
  return {dz,label:p.label,task:p.text,variant:+n,body:v.title,note:v.note||undefined,steps:v.steps.map(s=>({k:s.k,id:s.id,title:s.title,points:s.points.length||undefined}))}; }

/* типичные ошибки методики — с метками m1…m7 (ими наставник помечает трудности студента) */
function mistakes(dz){ const m=pack(dz).method; return {mistakes:m.mistakes.map((t,i)=>({tag:'m'+(i+1),text:t})),self_check:m.check}; }
const mistakeTags=dz=>pack(dz).method.mistakes.map((t,i)=>'m'+(i+1));

const TOPICS={plan:'порядок построения',section:'разрезы',dims:'размеры',sheet:'оформление листа'};
function method(dz,topic){ const m=pack(dz).method;
  if(HOW[topic]) return {topic,name:HOW_NAME[topic],rule:HOW[topic]};
  if(topic==='section') return {topic,rule:m.plan[4].d+'\n'+m.plan[5].d};
  if(topic==='dims') return {topic,rule:m.plan[6].d};
  if(topic==='sheet') return {topic,rule:m.sheet.join('\n')};
  return {topic:'plan',essence:m.essence,idea:m.idea,plan:m.plan.map((x,i)=>(i+1)+'. '+x.t+': '+x.d),answer:m.answer}; }

module.exports={pack,variant,registry,stepAt,overview,mistakes,mistakeTags,method,DEPTHS,HOW,HOW_NAME,TOPICS,dzList:Object.keys(PACKS)};
