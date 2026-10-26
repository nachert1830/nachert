/* Обратный план к событию календаря. Методика — club/README.md, раздел «Обратный план».
   РК (день D):  D−10 диагностика → D−9…D−3 слабые темы вперемешку → D−2 пробный РК на время → D−1 лёгкое повторение → D.
   ДЗ (срок D):  этапы от выдачи (≈ D−21) до D с запасом в 1–2 дня; если начинаешь поздно — этапы сжимаются, а не исчезают.
   М (день D):   D−7 сверка «что сдано», D−3 долги, D закрытие.
   Если шаг уже прошёл и не сделан, а время есть, он переносится на сегодня (сокращённый план), а не молча пропадает.
   done — множество ключей сделанных шагов ('ng-rk-2:diag'). Модуль общий для клуба и сервера (напоминания). */
(function(root,f){ if(typeof module==='object'&&module.exports) module.exports=f(require('./calendar.js')); else root.ClubPlan=f(root.ClubCalendar); })(typeof self!=='undefined'?self:this,function(C){
'use strict';
const {toDay,toStr}=C;
const isDone=(done,k)=>!!(done&&(done instanceof Set?done.has(k):done[k]));

const RK_STEPS={
  diag:{title:'Диагностика',min:30,what:'По одной задаче каждой темы РК — без подсказок и разбора. Цель — узнать, что тренировать, а не получить оценку.'},
  mix:{title:'Слабые темы вперемешку',min:20,what:'Каждый день 2–3 задачи из слабых тем, разных типов подряд: на РК способ надо выбрать самому.'},
  mock:{title:'Пробный РК на время',min:60,what:'Билет целиком, с таймером, без подсказок. Потом — сверка и разбор ошибок.'},
  light:{title:'Лёгкое повторение',min:15,what:'Ключевые правила и 1–2 знакомые задачи. Новых тем не начинать, лечь спать вовремя.'}
};
const DZ_STAGES={
  ng:[['read','Условие и способ',.15,'Прочитать все задачи ДЗ и для каждой записать способ решения одной фразой. Вопросы — на ближайшее занятие.'],
      ['draft','Построения на черновике',.45,'По одной-две задачи в день, тонкими линиями. Каждое построение — с проверкой по линиям связи.'],
      ['clean','Чистовик',.25,'Обводка, обозначения, видимость. Ответы — в том виде, как требует кафедра.'],
      ['check','Сверка',.15,'Пройти каждую задачу в режиме «Решаю сам» или по разбору похожей задачи; исправить найденное.']],
  ikg:[['read','Вариант и эскиз',.15,'Разобрать деталь: виды, разрез, что видно и что скрыто. Эскиз от руки.'],
       ['draft','Черновик тонкими линиями',.40,'Виды в проекционной связи, оси, линии построения.'],
       ['clean','Обводка, разрез, размеры',.30,'Типы и толщины линий, штриховка, размеры, основная надпись.'],
       ['check','Предпроверка по ГОСТ',.15,'Проверить лист по ГОСТ: «Предпроверка листа ДЗ ИКГ» в личном кабинете или самопроверка по списку.']]
};

function step(ev,key,day,o){ return Object.assign({key:ev.id+':'+key,k:key,date:toStr(day),day},o); }

function rkPlan(ev,today,done){ const D=toDay(ev.date), t=toDay(today), out=[];
  if(t>D) return {steps:[],over:true,late:false};
  let late=false, diag=D-10;
  const diagDone=isDone(done,ev.id+':diag');
  if(!diagDone&&diag<t&&t<=D-3){ diag=t; late=true; }          /* не успел вовремя — диагностика сегодня, остальное сдвигается */
  if(diag>=t||diagDone) out.push(step(ev,'diag',Math.min(diag,D-3),RK_STEPS.diag));
  const mixFrom=Math.max(Math.min(diag,D-3)+1,t), mixTo=D-3;
  for(let d=mixFrom;d<=mixTo;d++) out.push(step(ev,'mix-'+toStr(d),d,Object.assign({group:'mix'},RK_STEPS.mix)));
  if(D-2>=t) out.push(step(ev,'mock',D-2,RK_STEPS.mock));
  if(D-1>=t) out.push(step(ev,'light',D-1,RK_STEPS.light));
  out.push(step(ev,'event',D,{title:ev.title,min:0,what:'День РК. РК пишется один раз — только на этой неделе.',event:true}));
  return {steps:mark(out,t,done),over:false,late}; }

/* ДЗ: окно от выдачи до срока; запас — последний день(и) перед сдачей; при позднем старте этапы сжимаются пропорционально */
function dzPlan(ev,today,done,opts){ const D=toDay(ev.date), t=toDay(today), issued=D-((opts&&opts.window)||21);
  if(t>D) return {steps:[],over:true,late:false};
  const from=Math.max(issued,t), avail=D-from;                 /* дней на работу до дня сдачи (день сдачи не считаем) */
  const buffer=avail>=10?2:avail>=4?1:0, work=Math.max(0,avail-buffer);
  const st=DZ_STAGES[ev.subj]||DZ_STAGES.ng, out=[];
  if(work>0){ let cur=from; const n=st.length;
    /* каждому этапу не меньше дня, пока дней хватает; остаток — по долям */
    const len=st.map(s=>Math.max(1,Math.round(s[2]*work)));
    while(len.reduce((a,b)=>a+b,0)>work){ const i=len.indexOf(Math.max(...len)); if(len[i]<=1) break; len[i]--; }
    while(len.reduce((a,b)=>a+b,0)<work) len[1]++;
    for(let i=0;i<n;i++){ if(cur>=from+work) { /* дней меньше, чем этапов: оставшиеся этапы — в последний рабочий день */
        out.push(step(ev,st[i][0],from+work-1,{title:st[i][1],what:st[i][3],from:toStr(from+work-1),to:toStr(from+work-1),min:45,squeezed:true})); continue; }
      const a=cur, b=Math.min(cur+len[i]-1,from+work-1); cur=b+1;
      out.push(step(ev,st[i][0],a,{title:st[i][1],what:st[i][3],from:toStr(a),to:toStr(b),min:45})); } }
  else st.forEach(s=>out.push(step(ev,s[0],t,{title:s[1],what:s[3],from:toStr(t),to:toStr(t),min:30,squeezed:true})));
  for(let d=D-buffer;d<D;d++) out.push(step(ev,'buffer-'+toStr(d),d,{title:'Запас',what:'День без плана: на непредвиденное. Работа почти всегда занимает больше, чем кажется.',min:0,buffer:true}));
  out.push(step(ev,'event',D,{title:ev.title,min:0,what:'Крайний срок сдачи на этой неделе.',event:true}));
  return {steps:mark(out,t,done),over:false,late:issued<t&&avail<14,issued:toStr(issued)}; }

function mPlan(ev,today,done){ const D=toDay(ev.date), t=toDay(today), out=[];
  if(t>D) return {steps:[],over:true,late:false};
  const a=Math.max(D-7,t);
  if(t<=D-4) out.push(step(ev,'check',a,{title:'Что закрыто',min:15,what:'Сверить: ДЗ сдано и принято, РК написан, замечания исправлены. Записать, что осталось.'}));
  if(D-3>=t) out.push(step(ev,'debts',D-3,{title:'Долги',min:45,what:'Закрыть то, что осталось: исправления по замечаниям, пересдача, подписи.'}));
  out.push(step(ev,'event',D,{title:ev.title,min:0,what:'Закрытие модуля на этой неделе.',event:true}));
  return {steps:mark(out,t,done),over:false,late:false}; }

function mark(steps,t,done){ return steps.map(s=>Object.assign(s,{done:isDone(done,s.key),when:s.day<t?'past':s.day===t?'today':'future'})); }

function plan(ev,today,done,opts){ return ev.kind==='rk'?rkPlan(ev,today,done):ev.kind==='dz'?dzPlan(ev,today,done,opts):mPlan(ev,today,done); }

/* что по плану сегодня по всем ближайшим событиям (для «Сегодня» и напоминаний) */
function todaySteps(evs,today,done,horizon){ const t=toDay(today), out=[];
  evs.filter(e=>toDay(e.date)>=t&&toDay(e.date)-t<=(horizon||21)).forEach(e=>{
    plan(e,today,done).steps.forEach(s=>{ if(s.event&&s.day===t) out.push(Object.assign({ev:e},s));
      else if(!s.event&&!s.buffer&&!s.done&&(s.day===t||(s.from&&toDay(s.from)<=t&&toDay(s.to)>=t))) out.push(Object.assign({ev:e},s)); }); });
  return out; }

return {plan,rkPlan,dzPlan,mPlan,todaySteps,RK_STEPS,DZ_STAGES};
});
