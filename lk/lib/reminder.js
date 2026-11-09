/* Напоминания в Telegram: не чаще раза в день, в выбранное время (окно 3 часа), не в тихие часы. */
(function(){ 'use strict';
const CAL=typeof module!=='undefined'&&module.exports?require('./calendar.js'):self.LKCAL;
const HM=/^([01]\d|2[0-3]):[0-5]\d$/;
function validTz(tz){ try{ new Intl.DateTimeFormat('ru',{timeZone:tz}); return typeof tz==='string'&&tz.length<64; }catch(e){ return false; } }
function norm(r){ r=r&&typeof r==='object'?r:{}; return {enabled:!!r.enabled,paused:!!r.paused,time:HM.test(r.time)?r.time:'19:00',tz:validTz(r.tz)?r.tz:'Europe/Moscow',
  quietFrom:HM.test(r.quietFrom)?r.quietFrom:'22:30',quietTo:HM.test(r.quietTo)?r.quietTo:'08:00',lastSent:r.lastSent||null}; }
function local(t,tz){ const p={}; new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t)).forEach(x=>{ p[x.type]=x.value; });
  return {date:p.year+'-'+p.month+'-'+p.day,hm:p.hour+':'+p.minute}; }
const min=hm=>+hm.slice(0,2)*60+ +hm.slice(3);
function quiet(m,from,to){ const a=min(from), b=min(to); return a<b?(m>=a&&m<b):(m>=a||m<b); }
function decide(r,t){ const n=norm(r), L=local(t,n.tz), m=min(L.hm), s=min(n.time);
  if(!n.enabled) return {send:false,why:'выключены',date:L.date};
  if(n.paused) return {send:false,why:'пауза',date:L.date};
  if(r&&r.canWrite===false) return {send:false,why:'бот не может писать',date:L.date};
  if(n.lastSent===L.date) return {send:false,why:'сегодня уже было',date:L.date};
  if(quiet(m,n.quietFrom,n.quietTo)) return {send:false,why:'тихие часы',date:L.date};
  if(m<s) return {send:false,why:'рано',date:L.date};
  if(m>s+180) return {send:false,why:'окно прошло',date:L.date};
  return {send:true,why:'',date:L.date}; }
const plural=(n,a,b,c)=>{ const x=n%10,h=n%100; return x===1&&h!==11?a:x>=2&&x<=4&&(h<12||h>14)?b:c; };
/* текст: сроки на 14 дней вперёд (не отмеченные), план (ii: когда/где/что), задачи на повтор. Нечего сказать — '' */
function compose(o){ const today=CAL.toDay(o.today), done=o.done||{}, ii=o.ii||{}, lines=[];
  (o.events||[]).filter(e=>e.kind!=='m'&&!done[e.id]&&e.day>=today&&e.day-today<=14).slice(0,3).forEach(e=>{ const k=e.day-today;
    const w=k===0?'сегодня':k===1?'завтра':'через '+k+' '+plural(k,'день','дня','дней'); const p=ii[e.subj+'-'+e.kind+'-'+e.n];
    lines.push('• '+e.title+' — '+w+(p&&p.when?' · план: '+[p.when,p.where,p.what].filter(Boolean).join(', '):'')); });
  if(o.dueCount>0) lines.push('• На повтор: '+o.dueCount+' '+plural(o.dueCount,'задача','задачи','задач')+' — реши по памяти');
  return lines.length?'Начерт · на ближайшие дни\n'+lines.join('\n'):''; }
const M={norm,validTz,decide,compose,local};
if(typeof module!=='undefined'&&module.exports) module.exports=M; else self.LKREM=M;
})();
