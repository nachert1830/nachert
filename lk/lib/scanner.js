/* Место для сканера решений по фото.
   Интерфейс, который подключит модуль сканера из lab/ (в этом репозитории его пока нет):
     scan(photo, task) → Promise<{verdict, confidence, issues, note}>
       photo   — Blob/File изображения (обрабатывается на устройстве; на сервер не уходит, пока нет отдельного согласия на фото)
       task    — {n, topic, title} задача тетради
       verdict — 'ok' | 'error' | 'unknown';  confidence — 0..1;  issues — [{at:[x,y] доли кадра, msg, skill}]
   Подключение: ClubScanner.register(fn) — fn с той же сигнатурой. Пока модуля нет — заглушка честно отвечает 'unknown'. */
(function(root,f){ if(typeof module==='object'&&module.exports) module.exports=f(); else root.ClubScanner=f(); })(typeof self!=='undefined'?self:this,function(){
'use strict';
let impl=null;
const MAX_BYTES=12*1024*1024, TYPES=/^image\/(jpeg|png|webp|heic|heif)$/;
function check(photo){ if(!photo||typeof photo.size!=='number') return 'нет фото'; if(photo.size>MAX_BYTES) return 'фото больше 12 МБ';
  if(photo.type&&!TYPES.test(photo.type)) return 'нужен снимок JPEG, PNG, WEBP или HEIC'; return null; }
async function stub(photo,task){ return {verdict:'unknown',confidence:0,issues:[],stub:true,
  note:'Проверка по фото ещё не подключена. Сверь решение с разбором задачи №'+(task&&task.n)+' на основном сайте — режим «Решаю сам».'}; }
async function scan(photo,task){ const bad=check(photo); if(bad) return {verdict:'unknown',confidence:0,issues:[],error:bad};
  const r=await (impl||stub)(photo,task); const v=['ok','error','unknown'].includes(r&&r.verdict)?r.verdict:'unknown';
  return Object.assign({},r,{verdict:v,confidence:Math.max(0,Math.min(1,+(r&&r.confidence)||0)),issues:Array.isArray(r&&r.issues)?r.issues:[]}); }
function register(fn){ if(typeof fn!=='function') throw new Error('scan: нужна функция'); impl=fn; }
return {scan,register,check,connected:()=>!!impl};
});
