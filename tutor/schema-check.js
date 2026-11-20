/* Проверка JSON по схеме — то подмножество JSON Schema, которым записан tutor/passport.schema.json
   (type, required, properties, additionalProperties:false, items, enum, pattern, minItems, minimum, maximum, maxLength).
   check(value, schema) → [ошибки]. Без зависимостей: работает в Node и в браузере (self.SCHEMA_CHECK). */
(function(){
const tOf=v=>v===null?'null':Array.isArray(v)?'array':Number.isInteger(v)?'integer':typeof v;
function check(v,S,path,out){ path=path||'$'; out=out||[]; if(!S) return out;
  if(S.type){ const ts=[].concat(S.type), t=tOf(v); if(!ts.some(x=>x===t||(x==='number'&&(t==='integer'||t==='number')))){ out.push(path+': тип '+t+', нужен '+ts.join('|')); return out; } }
  if(S.enum&&!S.enum.some(e=>e===v)) out.push(path+': «'+v+'» не из '+JSON.stringify(S.enum));
  if(typeof v==='string'){ if(S.pattern&&!new RegExp(S.pattern,'u').test(v)) out.push(path+': «'+v+'» не по шаблону'); if(S.maxLength!=null&&[...v].length>S.maxLength) out.push(path+': длиннее '+S.maxLength); }
  if(typeof v==='number'){ if(S.minimum!=null&&v<S.minimum) out.push(path+': меньше '+S.minimum); if(S.maximum!=null&&v>S.maximum) out.push(path+': больше '+S.maximum); }
  if(Array.isArray(v)){ if(S.minItems!=null&&v.length<S.minItems) out.push(path+': элементов меньше '+S.minItems); if(S.items) v.forEach((x,i)=>check(x,S.items,path+'['+i+']',out)); }
  if(v&&typeof v==='object'&&!Array.isArray(v)){ (S.required||[]).forEach(k=>{ if(!(k in v)) out.push(path+': нет поля '+k); });
    const P=S.properties||{}; Object.keys(v).forEach(k=>{ if(P[k]) check(v[k],P[k],path+'.'+k,out); else if(S.additionalProperties===false) out.push(path+': лишнее поле '+k); }); }
  return out; }
const SCHEMA_CHECK={check};
if(typeof module!=='undefined'&&module.exports) module.exports=SCHEMA_CHECK; else self.SCHEMA_CHECK=SCHEMA_CHECK;
})();
