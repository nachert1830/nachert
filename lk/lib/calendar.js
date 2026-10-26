/* Календарь сдач ИКГ и начерта.
   Неделя в таблице — неделя, на которой крайний срок: ДЗ сдаётся на этой неделе, РК пишется один раз и только на этой неделе,
   М — закрытие модуля. Точный день внутри недели зависит от группы: по умолчанию — день занятия по предмету
   (настройка «занятие в …»), студент может поставить точную дату события, но только внутри его недели.
   Даты — строки 'YYYY-MM-DD' (местная дата студента), дни — целые числа от 1970-01-01. Модуль общий для клуба и сервера. */
(function(root,f){ if(typeof module==='object'&&module.exports) module.exports=f(); else root.ClubCalendar=f(); })(typeof self!=='undefined'?self:this,function(){
'use strict';
const DEFAULT_WEEK1='2026-08-31';   /* понедельник недели 1 — владелец проверит по расписанию МГТУ */
const SUBJECTS={
  ikg:{id:'ikg',title:'ИКГ',full:'Инженерная и компьютерная графика'},
  ng:{id:'ng',title:'Начерт',full:'Начертательная геометрия'}
};
/* [предмет, тип, номер модуля, неделя] — из таблицы владельца */
const TABLE=[
  ['ikg','dz',1,4],['ikg','rk',1,5],['ikg','m',1,6],
  ['ikg','dz',2,9],['ikg','rk',2,10],['ikg','m',2,11],
  ['ikg','dz',3,14],['ikg','rk',3,15],['ikg','m',3,16],
  ['ng','dz',1,5],['ng','rk',1,6],['ng','m',1,7],
  ['ng','dz',2,10],['ng','rk',2,11],['ng','m',2,12],
  ['ng','dz',3,14],['ng','rk',3,15],['ng','m',3,16]
];
const KIND={dz:'ДЗ',rk:'РК',m:'М'};
const KIND_FULL={dz:'Домашнее задание',rk:'Рубежный контроль',m:'Закрытие модуля'};

const DAY=864e5;
function toDay(s){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||'')); if(!m) return NaN; return Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/DAY); }
function toStr(d){ const x=new Date(d*DAY); return x.getUTCFullYear()+'-'+String(x.getUTCMonth()+1).padStart(2,'0')+'-'+String(x.getUTCDate()).padStart(2,'0'); }
function isDate(s){ const d=toDay(s); return Number.isFinite(d)&&toStr(d)===s; }
/* день недели: 1 — понедельник … 7 — воскресенье */
function weekday(d){ return ((new Date(d*DAY).getUTCDay()+6)%7)+1; }
/* местная дата в часовом поясе (для сервера; в браузере — new Date() без зоны) */
function localDate(ms,tz){
  try{ const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz||'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
    const g=t=>(p.find(x=>x.type===t)||{}).value; return {date:g('year')+'-'+g('month')+'-'+g('day'),hm:g('hour')+':'+g('minute')}; }
  catch(e){ const x=new Date(ms+3*3600e3); return {date:x.toISOString().slice(0,10),hm:x.toISOString().slice(11,16)}; } }
function browserToday(now){ const x=now?new Date(now):new Date(); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); }

/* настройки студента: {week1, classDay:{ikg:1..7, ng:1..7}, dates:{eventId:'YYYY-MM-DD'}, subjects:['ikg','ng']} */
function normSettings(s){ s=s&&typeof s==='object'?s:{};
  const week1=isDate(s.week1)&&weekday(toDay(s.week1))===1?s.week1:null;
  const cd={}; Object.keys(SUBJECTS).forEach(k=>{ const v=+((s.classDay||{})[k]); cd[k]=v>=1&&v<=6?v:1; });
  const dates={}; Object.keys(s.dates||{}).forEach(k=>{ if(/^(ikg|ng)-(dz|rk|m)-[123]$/.test(k)&&isDate(s.dates[k])) dates[k]=s.dates[k]; });
  const subjects=Array.isArray(s.subjects)?s.subjects.filter(k=>SUBJECTS[k]):Object.keys(SUBJECTS);
  return {week1,classDay:cd,dates,subjects:subjects.length?subjects:Object.keys(SUBJECTS)}; }

function weekStart(week1,n){ return toDay(week1)+7*(n-1); }
function weekOf(week1,date){ const d=toDay(date)-toDay(week1); return Math.floor(d/7)+1; }

/* все события семестра; week1 — из настроек студента, иначе — из настроек клуба */
function events(settings,clubWeek1){
  const s=normSettings(settings), w1=s.week1||(isDate(clubWeek1)?clubWeek1:DEFAULT_WEEK1);
  return TABLE.filter(r=>s.subjects.includes(r[0])).map(([subj,kind,n,week])=>{
    const id=subj+'-'+kind+'-'+n, start=weekStart(w1,week), end=start+6;
    let target=start+(s.classDay[subj]-1), custom=false;
    if(s.dates[id]){ const d=toDay(s.dates[id]); if(d>=start&&d<=end){ target=d; custom=true; } }
    return {id,subj,kind,n,week,start:toStr(start),end:toStr(end),date:toStr(target),custom,
      title:(kind==='m'?'М'+n+' · закрытие модуля '+n:KIND[kind]+n)+' · '+SUBJECTS[subj].title,
      short:(kind==='m'?'М':KIND[kind])+n,kindFull:KIND_FULL[kind],subjTitle:SUBJECTS[subj].title};
  }).sort((a,b)=>toDay(a.date)-toDay(b.date)||a.subj.localeCompare(b.subj)); }

/* ближайшие события: ещё не прошедшие (день события включительно) */
function upcoming(settings,clubWeek1,today,limit){ const t=toDay(today);
  return events(settings,clubWeek1).filter(e=>toDay(e.date)>=t).map(e=>Object.assign(e,{inDays:toDay(e.date)-t})).slice(0,limit||99); }

/* сетка недель семестра: [{week, start, end, events:[…]}] */
function weeks(settings,clubWeek1,count){ const s=normSettings(settings), w1=s.week1||(isDate(clubWeek1)?clubWeek1:DEFAULT_WEEK1), ev=events(settings,clubWeek1), out=[];
  for(let n=1;n<=(count||17);n++){ const st=weekStart(w1,n); out.push({week:n,start:toStr(st),end:toStr(st+6),events:ev.filter(e=>e.week===n)}); }
  return out; }

const MONTHS=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const WD=['','пн','вт','ср','чт','пт','сб','вс'];
function human(date){ const d=toDay(date); if(!Number.isFinite(d)) return ''; const x=new Date(d*DAY); return WD[weekday(d)]+', '+x.getUTCDate()+' '+MONTHS[x.getUTCMonth()]; }
function inWords(k){ if(k===0) return 'сегодня'; if(k===1) return 'завтра'; if(k===2) return 'послезавтра'; if(k<0) return 'прошло';
  const m10=k%10, m100=k%100, w=m10===1&&m100!==11?'день':m10>=2&&m10<=4&&(m100<12||m100>14)?'дня':'дней'; return 'через '+k+' '+w; }

return {DEFAULT_WEEK1,SUBJECTS,TABLE,KIND,KIND_FULL,toDay,toStr,isDate,weekday,localDate,browserToday,normSettings,weekStart,weekOf,events,upcoming,weeks,human,inWords,WD};
});
