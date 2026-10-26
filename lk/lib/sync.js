/* Синхронизация прогресса: localStorage (ключи nch2_*, как на основном сайте) ↔ аккаунт.
   Состояние — {data:{ключ: строка JSON}, mt:{ключ: время изменения, мс}}. Слияние одно и то же на устройстве и на сервере,
   поэтому конфликтов нет: сервер сливает присланное со своим и возвращает итог, устройство сливает итог со своими новыми правками.
   Слияние коммутативно: merge(a,b) = merge(b,a).
   • nch2_rep — по каждой задаче берётся запись с более поздней попыткой (l), затем с большим числом попыток (n);
   • nch2_club_ev — журнал наблюдений навыков: объединение по id;
   • nch2_club_done, nch2_club_ii — по каждому подключу запись с большим t;
   • nch2_wb3 — по каждой задаче максимум (1 — разбор просмотрен, 2 — решено в «Решаю сам»);
   • остальное — целиком, последняя запись по mt.
   Ключи устройства (согласие на cookie основного сайта, счётчики, тема) не синхронизируются. */
(function(root,f){ if(typeof module==='object'&&module.exports) module.exports=f(require('./bkt.js')); else root.ClubSync=f(root.ClubBKT); })(typeof self!=='undefined'?self:this,function(BKT){
'use strict';
const KEY_RE=/^(nch2_[A-Za-z0-9_]{1,48}|plpos)$/;
const DEVICE=new Set(['nch2_ck','nch2_vw','nch2_views','nch2_pilot','nch2_theme','nch2_club_mt','nch2_club_dirty','nch2_club_base','nch2_club_me','nch2_club_cfg','nch2_club_onboard']);
const LIMIT_TOTAL=256*1024, LIMIT_KEY=128*1024;
const syncable=k=>KEY_RE.test(k)&&!DEVICE.has(k);
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return undefined; } };
const S=v=>JSON.stringify(v);
const cmp=(x,y)=>x<y?-1:x>y?1:0;

function pickLWW(va,ta,vb,tb){ if((ta||0)!==(tb||0)) return (ta||0)>(tb||0)?[va,ta]:[vb,tb]; return cmp(String(va),String(vb))>=0?[va,ta]:[vb,tb]; }
function objMerge(a,b,pick){ const out={}; new Set(Object.keys(a).concat(Object.keys(b))).forEach(k=>{ out[k]=k in a?(k in b?pick(a[k],b[k]):a[k]):b[k]; }); return out; }
const repPick=(x,y)=>{ const c=(x.l||0)-(y.l||0)||(x.n||0)-(y.n||0)||(x.d||0)-(y.d||0)||cmp(S(x),S(y)); return c>=0?x:y; };
const tPick=(x,y)=>{ const c=((x&&x.t)||0)-((y&&y.t)||0)||cmp(S(x),S(y)); return c>=0?x:y; };
const SPECIAL={
  nch2_rep:(a,b)=>objMerge(a,b,repPick),
  nch2_club_done:(a,b)=>objMerge(a,b,tPick),
  nch2_club_ii:(a,b)=>objMerge(a,b,tPick),
  nch2_wb3:(a,b)=>objMerge(a,b,(x,y)=>Math.max(+x||0,+y||0)),
  nch2_club_ev:(a,b)=>BKT.merge(Array.isArray(a)?a:[],Array.isArray(b)?b:[])
};
const isObj=v=>v&&typeof v==='object';

function mergeKey(k,va,ta,vb,tb){
  if(va===undefined) return [vb,tb]; if(vb===undefined) return [va,ta];
  if(va===vb) return [va,Math.max(ta||0,tb||0)];
  const f=SPECIAL[k];
  if(f){ const pa=J(va), pb=J(vb); const ok=k==='nch2_club_ev'?Array.isArray(pa)&&Array.isArray(pb):isObj(pa)&&isObj(pb)&&!Array.isArray(pa)&&!Array.isArray(pb);
    if(ok) return [S(f(pa,pb)),Math.max(ta||0,tb||0)]; }
  return pickLWW(va,ta,vb,tb); }

function merge(a,b){ a=a||{}; b=b||{}; const da=a.data||{}, db=b.data||{}, ma=a.mt||{}, mb=b.mt||{}, data={}, mt={};
  new Set(Object.keys(da).concat(Object.keys(db))).forEach(k=>{ if(!syncable(k)) return;
    const [v,t]=mergeKey(k,da[k],ma[k],db[k],mb[k]); if(v!==undefined){ data[k]=v; if(t) mt[k]=t; } });
  return {data,mt}; }

/* проверка присланного на сервере: только свои ключи, строки, лимиты размера */
function validate(st){ if(!st||typeof st!=='object'||!st.data||typeof st.data!=='object'||Array.isArray(st.data)) return 'нет данных';
  let total=0; for(const k of Object.keys(st.data)){ const v=st.data[k];
    if(!KEY_RE.test(k)) return 'недопустимый ключ'; if(typeof v!=='string') return 'значение не строка'; if(v.length>LIMIT_KEY) return 'слишком большое значение';
    total+=k.length+v.length; }
  if(total>LIMIT_TOTAL) return 'слишком много данных';
  if(st.mt!=null){ if(typeof st.mt!=='object'||Array.isArray(st.mt)) return 'неверные метки'; for(const k of Object.keys(st.mt)) if(!KEY_RE.test(k)||typeof st.mt[k]!=='number'||!isFinite(st.mt[k])) return 'неверные метки'; }
  return null; }
function clean(st){ const data={}, mt={}; Object.keys(st.data||{}).forEach(k=>{ if(syncable(k)){ data[k]=st.data[k]; if(st.mt&&typeof st.mt[k]==='number') mt[k]=st.mt[k]; } }); return {data,mt}; }
function size(st){ return Object.keys(st.data||{}).reduce((s,k)=>s+k.length+String(st.data[k]).length,0); }

/* браузер: собрать локальное состояние и записать итог обратно */
function readLocal(ls){ const data={}; let mt={}; try{ mt=J(ls.getItem('nch2_club_mt')||'{}')||{}; for(let i=0;i<ls.length;i++){ const k=ls.key(i); if(syncable(k)) data[k]=ls.getItem(k); } }catch(e){} return {data,mt}; }
function writeLocal(ls,st){ try{ Object.keys(st.data).forEach(k=>{ if(ls.getItem(k)!==st.data[k]) ls.setItem(k,st.data[k]); }); ls.setItem('nch2_club_mt',S(st.mt||{})); }catch(e){} }

return {KEY_RE,DEVICE,LIMIT_TOTAL,syncable,merge,mergeKey,validate,clean,size,readLocal,writeLocal};
});
