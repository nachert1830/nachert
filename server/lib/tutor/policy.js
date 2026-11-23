/* Наставник: лесенка подсказок — права доступа к решению, а не просьба в промпте.
   Глубина шага k: title (0) < idea (1) < short (2) < full (3).
   Режим coach (по умолчанию): idea открыта сразу; каждая реплика, в которой наставник берёт шаг, — «просьба» по этому шагу (+1);
   фото листа — попытка (+1 ко всем шагам). Режим explain («Разбор»): всё открыто.
   Показать шаг на чертеже — с глубины short; подсветить точки — с full. Решение по умолчанию — docs/TUTOR.md, раздел 4. */
'use strict';
const P=require('./pack');
const MODES=['coach','explain'];

function allowed(mem,k){ if(mem.mode==='explain') return 3;
  const asks=(mem.asks&&mem.asks[k])||0, photo=mem.photo?1:0;
  return Math.min(3,1+asks+photo); }
const depthName=d=>P.DEPTHS[Math.max(0,Math.min(3,d))];
const depthIx=name=>Math.max(0,P.DEPTHS.indexOf(name));

/* наставник берёт шаг k в этой реплике: засчитать просьбу один раз за реплику */
function ask(mem,turn,k){ if(turn.asked.has(k)) return; turn.asked.add(k); mem.asks=mem.asks||{}; mem.asks[k]=(mem.asks[k]||0)+1; }
/* что открыто студенту: запоминаем самую большую глубину, до которой шаг показан (для сверки в следующих репликах) */
function open(mem,k,d){ mem.open=mem.open||{}; if((mem.open[k]||0)<d) mem.open[k]=d; }

/* для окна: какие шаги открыты и насколько */
function ladder(mem,steps){ return steps.map(s=>({k:s.k,allowed:depthName(allowed(mem,s.k)),opened:depthName((mem.open&&mem.open[s.k])||0)})); }

module.exports={MODES,allowed,ask,open,ladder,depthName,depthIx};
