/* Синхронизация прогресса: {data:{ключ:строка JSON}, mt:{ключ:время правки}}.
   Ключи — nch2_* (сайт) и lk_* (кабинет), кроме ключей устройства. Слияние: по ключу побеждает более поздняя правка;
   nch2_rep (повторение задач) сливается по задачам — у каждой задачи побеждает более поздняя попытка. */
(function(){ 'use strict';
const KEY=/^(nch2|lk)_[A-Za-z0-9_]{1,60}$/, LIMIT_KEY=128*1024, LIMIT_TOTAL=300*1024;
/* только этого устройства: тема, установка, служебное, большие фото-листы сканера */
const DEVICE=/^(nch2_(ck|theme|a2hs_done|th_seen|route|tab_.*|trmode)|lk_(sync.*|sheets|scanPrec|scan_on|backup_at|group|tok|hotk|cons|nudge_x))$/;
function validate(b){
  if(!b||typeof b!=='object'||!b.data||typeof b.data!=='object'||Array.isArray(b.data)) return 'нет данных';
  for(const k of Object.keys(b.data)){ if(!KEY.test(k)) return 'недопустимый ключ '+String(k).slice(0,40); const v=b.data[k];
    if(typeof v!=='string') return 'значение '+k+' — не строка'; if(v.length>LIMIT_KEY) return 'ключ '+k+' больше 128 КБ'; }
  if(b.mt!=null&&typeof b.mt!=='object') return 'неверные отметки времени';
  return null; }
function clean(b){ const data={}, mt={}; Object.keys(b.data||{}).forEach(k=>{ if(KEY.test(k)&&!DEVICE.test(k)&&typeof b.data[k]==='string'){ data[k]=b.data[k]; const t=+((b.mt||{})[k]); mt[k]=isFinite(t)&&t>0?t:0; } }); return {data,mt}; }
const J=s=>{ try{ const v=JSON.parse(s); return v&&typeof v==='object'?v:null; }catch(e){ return null; } };
function mergeRep(a,b){ const A=J(a)||{}, B=J(b)||{}, o=Object.assign({},A);
  Object.keys(B).forEach(k=>{ const x=A[k], y=B[k]; if(!x||!y||typeof x!=='object'){ o[k]=y||x; return; } o[k]=((y.l||0)>(x.l||0)||((y.l||0)===(x.l||0)&&(y.n||0)>=(x.n||0)))?y:x; });
  return JSON.stringify(o); }
function merge(cur,inc){ const data=Object.assign({},(cur&&cur.data)||{}), mt=Object.assign({},(cur&&cur.mt)||{});
  Object.keys(inc.data).forEach(k=>{ const ti=inc.mt[k]||0, tc=mt[k]||0;
    if(k==='nch2_rep'&&data[k]!=null){ data[k]=mergeRep(data[k],inc.data[k]); mt[k]=Math.max(ti,tc); return; }
    if(data[k]==null||ti>=tc){ data[k]=inc.data[k]; mt[k]=Math.max(ti,tc); } });
  return {data,mt}; }
function size(r){ let s=0; Object.keys((r&&r.data)||{}).forEach(k=>{ s+=k.length+String(r.data[k]).length; }); return s; }
const M={validate,clean,merge,size,LIMIT_KEY,LIMIT_TOTAL,DEVICE,KEY};
if(typeof module!=='undefined'&&module.exports) module.exports=M; else self.LKSYNCLIB=M;
})();
