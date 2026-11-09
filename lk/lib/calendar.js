/* Календарь семестра для сервера (напоминания): тот же план, что TABLE в lk/app.js.
   Даты — строки ГГГГ-ММ-ДД, дни — число суток от 1970-01-01 (UTC). Срок без группы — понедельник недели. */
(function(){ 'use strict';
const DAY=864e5, DEFAULT_WEEK1='2026-08-31';
const TABLE=[['ikg','dz',1,4],['ikg','rk',1,5],['ikg','m',1,6],['ikg','dz',2,9],['ikg','rk',2,10],['ikg','m',2,11],['ikg','dz',3,14],['ikg','rk',3,15],['ikg','m',3,16],
             ['ng','dz',1,5],['ng','rk',1,6],['ng','m',1,7],['ng','dz',2,10],['ng','rk',2,11],['ng','m',2,12],['ng','dz',3,14],['ng','rk',3,15],['ng','m',3,16]];
const SUBJ={ikg:'ИКГ',ng:'Начерт'};
const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T00:00:00Z'));
const toDay=s=>Math.round(Date.parse(s+'T00:00:00Z')/DAY);
const toDate=d=>new Date(d*DAY).toISOString().slice(0,10);
const weekday=d=>((new Date(d*DAY).getUTCDay()+6)%7)+1;
/* cal: {group:{ikg:{day},ng:{day}}} — день пары по предмету (1 = пн); пусто — понедельник */
function events(cal,week1){ cal=cal&&typeof cal==='object'?cal:{}; const w1=toDay(isDate(week1)?week1:DEFAULT_WEEK1), g=cal.group||{};
  return TABLE.filter(r=>!cal.subjects||cal.subjects.indexOf(r[0])>=0).map(r=>{ const cd=g[r[0]]&&+g[r[0]].day||1, d=w1+7*(r[3]-1)+cd-1;
    return {id:r[0]+'-'+r[1]+r[2],subj:r[0],kind:r[1],n:r[2],week:r[3],day:d,date:toDate(d),title:(r[1]==='m'?'М':r[1]==='dz'?'ДЗ':'РК')+r[2]+' · '+SUBJ[r[0]]}; })
    .sort((a,b)=>a.day-b.day); }
const M={DEFAULT_WEEK1,DEFAULT:DEFAULT_WEEK1,TABLE,isDate,toDay,toDate,weekday,events};
if(typeof module!=='undefined'&&module.exports) module.exports=M; else self.LKCAL=M;
})();
