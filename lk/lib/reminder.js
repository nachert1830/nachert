/* Напоминания в Telegram: когда можно писать и что написать. Общий модуль: настройки показываются в клубе,
   решение принимает сервер (server/lib/reminders.js) по этим же функциям.
   Правила: не чаще 1 раза в день; не раньше выбранного времени и не позже чем через 3 часа после него (не догоняем ночью);
   тихие часы — никогда; пауза одной кнопкой; пишем, только если есть ближайший дедлайн (≤ 14 дней) или задачи на повтор.
   Текст — что сделать сегодня и сколько это займёт. Без серий, баллов, «ты пропустил» и сравнения с другими. */
(function(root,f){ if(typeof module==='object'&&module.exports) module.exports=f(require('./calendar.js'),require('./plan.js')); else root.ClubReminder=f(root.ClubCalendar,root.ClubPlan); })(typeof self!=='undefined'?self:this,function(C,PL){
'use strict';
const HM=/^([01]\d|2[0-3]):[0-5]\d$/, WINDOW_MIN=180, HORIZON=14;
const DEFAULTS={enabled:false,time:'19:00',quietFrom:'22:30',quietTo:'08:00',tz:'Europe/Moscow',paused:false};
const mins=hm=>{ const m=HM.exec(hm||''); return m?(+hm.slice(0,2))*60+(+hm.slice(3,5)):NaN; };
function validTz(tz){ if(typeof tz!=='string'||tz.length>64) return false; try{ new Intl.DateTimeFormat('en',{timeZone:tz}); return true; }catch(e){ return false; } }
function norm(s){ s=Object.assign({},DEFAULTS,s||{}); return {enabled:!!s.enabled,paused:!!s.paused,time:HM.test(s.time)?s.time:DEFAULTS.time,
  quietFrom:HM.test(s.quietFrom)?s.quietFrom:DEFAULTS.quietFrom,quietTo:HM.test(s.quietTo)?s.quietTo:DEFAULTS.quietTo,tz:validTz(s.tz)?s.tz:DEFAULTS.tz}; }
/* тихие часы могут переходить через полночь: 22:30–08:00 */
function inQuiet(hm,from,to){ const x=mins(hm), a=mins(from), b=mins(to); if(a===b) return false; return a<b?x>=a&&x<b:x>=a||x<b; }

function decide(r,nowMs){ const s=norm(r);
  if(!s.enabled) return {send:false,why:'выключены'}; if(s.paused) return {send:false,why:'пауза'}; if(r&&r.canWrite===false) return {send:false,why:'бот не может писать'};
  const L=C.localDate(nowMs,s.tz), x=mins(L.hm), t=mins(s.time);
  if(r&&r.lastSent===L.date) return {send:false,why:'сегодня уже было',date:L.date};
  if(x<t) return {send:false,why:'рано',date:L.date};
  if(x>=t+WINDOW_MIN) return {send:false,why:'окно прошло',date:L.date};
  if(inQuiet(L.hm,s.quietFrom,s.quietTo)) return {send:false,why:'тихие часы',date:L.date};
  return {send:true,date:L.date,hm:L.hm}; }

/* текст: ближайший дедлайн + шаг плана на сегодня + повтор; null — писать нечего */
function compose(o){ const {events,today,done,dueCount,ii}=o, t=C.toDay(today);
  const next=(events||[]).filter(e=>C.toDay(e.date)>=t).sort((a,b)=>C.toDay(a.date)-C.toDay(b.date))[0];
  const near=next&&C.toDay(next.date)-t<=HORIZON?next:null;
  if(!near&&!dueCount) return null;
  const lines=[];
  if(near){ const k=C.toDay(near.date)-t; lines.push((k===0?'Сегодня — ':'Ближайшее: ')+near.title+(k===0?'.':', '+C.human(near.date)+' ('+C.inWords(k)+').'));
    const steps=PL.todaySteps([near],today,done||{}).filter(s=>!s.event);
    if(steps.length){ const s=steps[0]; lines.push('По плану на сегодня: '+s.title.toLowerCase()+(s.min?' — около '+s.min+' мин.':'.')); }
    const mine=ii&&ii[near.id]; if(mine&&mine.what) lines.push('Твой план: '+[mine.when,mine.where].filter(Boolean).join(', ')+' — '+mine.what+'.'); }
  if(dueCount) lines.push('На повтор: '+dueCount+' '+(dueCount===1?'задача':dueCount<5?'задачи':'задач')+' (≈ '+Math.min(dueCount,3)*4+' мин).');
  lines.push('Если сегодня не до этого — это нормально, план подстроится.');
  return lines.join('\n'); }

return {DEFAULTS,HM,WINDOW_MIN,norm,inQuiet,decide,compose,validTz,mins};
});
