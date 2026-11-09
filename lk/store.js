/* ═══ Кабинет: хранилище прогресса ═══
   Всё, что студент делает в кабинете и на сайте, лежит в localStorage этого браузера:
     lk_*   — кабинет: профиль (lk_profile), отметки сдач (lk_done), шаги к РК (lk_prep), дни занятий (lk_days), чертежи (lk_sheets);
     nch2_* — основной сайт: последняя страница (nch2_last), пройденные уроки (nch2_done), повторение задач (nch2_rep),
              пробные РК (nch2_exams), вариант ДЗ (nch2_dzvar), тема (nch2_theme) …
   Кабинет и сайт на одном домене — читают друг друга напрямую.

   LKS.snapshot() / LKS.restore() — весь прогресс одним объектом: копия файлом сейчас и синхронизация с сервером потом.
   LKS.sync — вход и синхронизация между устройствами; включается, когда задан window.LK_API (адрес API кабинета). */
(function(){
'use strict';
var PFX=['lk_','nch2_'], SKIP={lk_sync:1};
function raw(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function put(k,v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k,v); return true; }catch(e){ return false; } }
function get(k,d){ var v=raw(k); if(v==null) return d; try{ var j=JSON.parse(v); return j==null?d:j; }catch(e){ return d; } }
function set(k,v){ var ok=put(k,v==null?null:JSON.stringify(v)); emit(k); return ok; }
var subs=[]; function emit(k){ subs.forEach(function(f){ try{ f(k); }catch(e){} }); }
function onChange(f){ subs.push(f); }
addEventListener('storage',function(e){ if(e.key&&PFX.some(function(p){ return e.key.indexOf(p)===0; })) emit(e.key); });

/* ── профиль ── */
function profile(){
  var p=get('lk_profile',null);
  if(!p||typeof p!=='object'){ p={}; var g=raw('lk_group'); if(g) p.group=g; }   /* прежний кабинет хранил только группу */
  if(!p.variant){ var v=siteVariant(); if(v) p.variant=v; }
  return p;
}
function saveProfile(p){ p.updated=Date.now(); if(!p.created) p.created=Date.now(); set('lk_profile',p); put('lk_group',p.group||null); if(p.variant) setSiteVariant(p.variant); }
/* вариант ДЗ — общий с сайтом: «Открой свой вариант» на сайте подставит его сам (те же ключи, что dzSetVar в index.html) */
function siteVariant(){ var n=0; try{ n=+get('nch2_dzvar',0)||0; if(!n){ var o=get('nch2_dzmine',{})||{}; n=+o.ng||+o.ig||+(raw('nch2_igvar')||0); } }catch(e){} return n>=1&&n<=30?n:0; }
function setSiteVariant(n){ n=n>=1&&n<=30?+n:0; put('nch2_dzvar',String(n)); ['nch2_igvar','nch2_hwvar_2','nch2_hwvar_3'].forEach(function(k){ put(k,n?String(n):null); }); put('nch2_dzmine',null); }

/* ── дни занятий: для серии ── */
function today(){ return Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/864e5); }
function markDay(){ var a=get('lk_days',[]); if(!Array.isArray(a)) a=[]; var t=today(); if(a[a.length-1]!==t){ a.push(t); set('lk_days',a.slice(-200)); } }
function activeDays(){
  var s={}, a=get('lk_days',[]); (Array.isArray(a)?a:[]).forEach(function(d){ s[d]=1; });
  var rep=get('nch2_rep',{})||{}; Object.keys(rep).forEach(function(k){ var o=rep[k]; if(o&&o.l) s[o.l]=1; if(o&&o.s) s[o.s]=1; });
  (get('nch2_exams',[])||[]).forEach(function(e){ if(e&&e.ts) s[Math.floor((e.ts-new Date(e.ts).getTimezoneOffset()*60000)/864e5)]=1; });
  ['lk_done','lk_prep'].forEach(function(k){ var o=get(k,{})||{}; Object.keys(o).forEach(function(i){ var v=o[i]; (typeof v==='object'&&v?Object.keys(v).map(function(j){ return v[j]; }):[v]).forEach(function(ts){ if(typeof ts==='number'&&ts>1e12) s[Math.floor((ts-new Date(ts).getTimezoneOffset()*60000)/864e5)]=1; }); }); });
  return s;
}
function streak(){ var s=activeDays(), t=today(), d=s[t]?t:t-1, n=0; while(s[d]){ n++; d--; } return {n:n,today:!!s[t],days:s}; }

/* ── снимок всего прогресса ── */
function keys(){ var out=[]; try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&!SKIP[k]&&PFX.some(function(p){ return k.indexOf(p)===0; })) out.push(k); } }catch(e){} return out.sort(); }
function snapshot(){ var data={}; keys().forEach(function(k){ var v=raw(k); if(v!=null) data[k]=v; }); return {app:'nachert-lk',v:1,at:new Date().toISOString(),data:data}; }
function restore(snap,opt){
  if(!snap||snap.app!=='nachert-lk'||!snap.data||typeof snap.data!=='object') throw new Error('Это не копия кабинета Начерта');
  var n=0; if(opt&&opt.replace) keys().forEach(function(k){ put(k,null); });
  Object.keys(snap.data).forEach(function(k){ if(PFX.some(function(p){ return k.indexOf(p)===0; })&&typeof snap.data[k]==='string'&&put(k,snap.data[k])) n++; });
  emit('*'); return n;
}
function sizeKB(){ var s=0; keys().forEach(function(k){ s+=(raw(k)||'').length+k.length; }); return Math.round(s*2/1024); }
function download(name){
  var b=new Blob([JSON.stringify(snapshot())],{type:'application/json'}), a=document.createElement('a');
  a.href=URL.createObjectURL(b); a.download=name||('nachert-progress-'+new Date().toISOString().slice(0,10)+'.json');
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },500);
  set('lk_backup_at',Date.now());
}
function readFile(file){ return new Promise(function(ok,no){ var r=new FileReader(); r.onload=function(){ try{ ok(JSON.parse(String(r.result))); }catch(e){ no(new Error('Файл не читается — нужна копия, скачанная в кабинете')); } }; r.onerror=function(){ no(new Error('Файл не открылся')); }; r.readAsText(file); }); }

/* ── синхронизация с сервером кабинета ──
   Включается адресом API: window.LK_API = 'https://…' (файл lk/config.js). Без него кабинет работает в этом браузере.
   Формат на сервере: {data:{ключ:строка}, mt:{ключ:время правки}}; при слиянии побеждает более поздняя правка ключа. */
var sync=(function(){
  var API=(self.LK_API||'').replace(/\/$/,''), st={on:!!API,user:null,csrf:null,busy:false,at:get('lk_sync',{}).at||0,err:null}, mt=get('lk_sync',{}).mt||{};
  function req(m,p,b){ return fetch(API+p,{method:m,credentials:'include',headers:Object.assign({'content-type':'application/json'},st.csrf?{'x-csrf':st.csrf}:{}),body:b?JSON.stringify(b):undefined})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if(!r.ok){ var e=new Error(j.error||('Ошибка '+r.status)); e.status=r.status; throw e; } return j; }); }); }
  function save(){ put('lk_sync',JSON.stringify({at:st.at,mt:mt})); }
  onChange(function(k){ if(k&&k!=='*'&&k.indexOf('lk_sync')!==0) { mt[k]=Date.now(); save(); schedule(); } });
  var T=0; function schedule(){ if(!st.user) return; clearTimeout(T); T=setTimeout(push,2500); }
  function me(){ if(!API) return Promise.resolve(null); return req('GET','/api/me').then(function(j){ st.user=j.user; st.csrf=j.csrf; return j; }).catch(function(e){ st.user=null; if(e.status!==401) st.err=e.message; return null; }); }
  function pull(){ return req('GET','/api/progress').then(function(j){ var n=0; Object.keys(j.data||{}).forEach(function(k){ var their=(j.mt||{})[k]||0; if(their>(mt[k]||0)&&raw(k)!==j.data[k]){ put(k,j.data[k]); mt[k]=their; n++; } }); save(); if(n) emit('*'); return n; }); }
  function push(){ if(!st.user||st.busy) return Promise.resolve(); st.busy=true; var s=snapshot().data, m={}; Object.keys(s).forEach(function(k){ m[k]=mt[k]||0; });
    return req('PUT','/api/progress',{data:s,mt:m}).then(function(){ st.at=Date.now(); st.err=null; save(); }).catch(function(e){ st.err=e.message; }).then(function(){ st.busy=false; emit('lk_sync_state'); }); }
  function start(){ if(!API) return Promise.resolve(st); return me().then(function(u){ if(!u) return st; return pull().then(push).then(function(){ return st; }); }); }
  function login(kind){ if(!API) return; location.href=API+'/api/auth/'+kind+'/start?ret='+encodeURIComponent(location.href); }
  function logout(){ return req('POST','/api/auth/logout').then(function(){ st.user=null; emit('lk_sync_state'); }); }
  return {state:st,start:start,push:push,login:login,logout:logout};
})();

self.LKS={get:get,set:set,raw:raw,put:put,onChange:onChange,profile:profile,saveProfile:saveProfile,siteVariant:siteVariant,
  today:today,markDay:markDay,streak:streak,snapshot:snapshot,restore:restore,download:download,readFile:readFile,sizeKB:sizeKB,keys:keys,sync:sync};
})();
