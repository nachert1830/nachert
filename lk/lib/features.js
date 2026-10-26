/* Функции клуба и их флаги. Режим флага: 'on' — всем, 'admin' — только админам (обкатка), 'off' — выключено.
   Список общий для клуба и сервера; режимы хранит сервер (админ-панель → «Функции»). */
(function(root,f){ if(typeof module==='object'&&module.exports) module.exports=f(); else root.ClubFeatures=f(); })(typeof self!=='undefined'?self:this,function(){
'use strict';
const FEATURES=[
  {id:'calendar',t:'Календарь сдач',def:'on'},
  {id:'plan',t:'Обратный план',def:'on'},
  {id:'training',t:'Тренировка дня',def:'on'},
  {id:'skills',t:'Карта навыков',def:'on'},
  {id:'sync',t:'Синхронизация прогресса',def:'on'},
  {id:'reminders',t:'Напоминания в Telegram',def:'on'},
  {id:'scanner',t:'Проверь решение по фото',def:'on'},
  {id:'normo',t:'Предпроверка листа ДЗ ИКГ',def:'on'}
];
const MODES=['on','admin','off'];
function effective(values,role){ const out={}; FEATURES.forEach(f=>{ const m=MODES.includes((values||{})[f.id])?values[f.id]:f.def; out[f.id]=m==='on'||(m==='admin'&&role==='admin'); }); return out; }
function normalize(values){ const out={}; FEATURES.forEach(f=>{ out[f.id]=MODES.includes((values||{})[f.id])?values[f.id]:f.def; }); return out; }
return {FEATURES,MODES,effective,normalize,ids:FEATURES.map(f=>f.id)};
});
