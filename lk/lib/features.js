/* Функции кабинета и их режимы: on — всем, admin — только админам, off — никому. Владелец переключает в админке. */
(function(){ 'use strict';
const FEATURES=[{id:'calendar',t:'Сроки и группа',d:'on'},{id:'training',t:'Подготовка к РК',d:'on'},{id:'sync',t:'Синхронизация прогресса',d:'on'},
  {id:'reminders',t:'Напоминания в Telegram',d:'on'},{id:'scanner',t:'Сканер чертежей',d:'admin'}];
const MODES=['on','admin','off'], ids=FEATURES.map(f=>f.id);
function normalize(v){ v=v&&typeof v==='object'?v:{}; const o={}; FEATURES.forEach(f=>{ o[f.id]=MODES.includes(v[f.id])?v[f.id]:f.d; }); return o; }
function effective(fl,role){ const n=normalize(fl), o={}; ids.forEach(k=>{ o[k]=n[k]==='on'||(n[k]==='admin'&&role==='admin'); }); return o; }
const M={FEATURES,MODES,ids,normalize,effective};
if(typeof module!=='undefined'&&module.exports) module.exports=M; else self.LKFEAT=M;
})();
