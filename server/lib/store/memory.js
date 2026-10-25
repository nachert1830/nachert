/* Хранилище для локальной эмуляции и тестов: таблицы в памяти, по желанию — с записью в JSON-файл.
   Интерфейс тот же, что у YDB (lib/store/ydb.js): get / put / update / del / scan / query / incr.
   Ключ: строка (поле id) или для таблиц с составным ключом — {h, r}. */
'use strict';
const fs=require('fs'), path=require('path');
const COMPOSITE=new Set(['loginlog']);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function memoryStore(file){
  let db={};
  if(file&&fs.existsSync(file)){ try{ db=JSON.parse(fs.readFileSync(file,'utf8')); }catch(e){ db={}; } }
  const T=t=>db[t]||(db[t]={});
  const K=(t,key)=>COMPOSITE.has(t)?key.h+'\u0000'+key.r:String(key);
  const KI=(t,item)=>COMPOSITE.has(t)?item.h+'\u0000'+item.r:String(item.id);
  const save=()=>{ if(!file) return; fs.mkdirSync(path.dirname(file),{recursive:true}); const tmp=file+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(db)); fs.renameSync(tmp,file); };
  const match=(item,cond)=>Object.keys(cond||{}).every(k=>(item[k]===undefined?null:item[k])===cond[k]);
  return {
    kind:'memory',
    async get(t,key){ return clone(T(t)[K(t,key)]||null); },
    /* opt.ifNotExists — записать, только если такого ключа нет; вернёт false, если есть */
    async put(t,item,opt){ const k=KI(t,item); if(opt&&opt.ifNotExists&&T(t)[k]) return false; T(t)[k]=clone(item); save(); return true; },
    /* opt.ifEq — {поле: значение}: обновить, только если совпадает (null — поля нет); вернёт новую запись или null */
    async update(t,key,set,opt){ const k=K(t,key), cur=T(t)[k]; if(!cur) return null; if(opt&&opt.ifEq&&!match(cur,opt.ifEq)) return null;
      Object.keys(set).forEach(f=>{ if(set[f]===undefined) delete cur[f]; else cur[f]=clone(set[f]); }); save(); return clone(cur); },
    async del(t,key){ delete T(t)[K(t,key)]; save(); },
    async scan(t,filter){ return Object.values(T(t)).map(clone).filter(x=>!filter||filter(x)); },
    async query(t,h,opt){ const out=Object.values(T(t)).filter(x=>x.h===h).map(clone).sort((a,b)=>a.r<b.r?-1:a.r>b.r?1:0); return opt&&opt.desc?out.reverse().slice(0,opt.limit||1e9):out.slice(0,(opt&&opt.limit)||1e9); },
    /* атомарный счётчик (лимиты запросов): создаёт запись с extra, если её нет */
    async incr(t,key,field,by,extra){ const k=String(key), cur=T(t)[k]||(T(t)[k]=Object.assign({id:k},clone(extra||{}),{[field]:0})); cur[field]=(cur[field]||0)+by; save(); return cur[field]; },
    _dump(){ return clone(db); }, _reset(){ db={}; save(); }
  };
}
module.exports={memoryStore,COMPOSITE};
