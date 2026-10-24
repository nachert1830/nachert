/* Хранилище в Yandex Database (serverless) через Document API — совместим с DynamoDB, запросы подписываются SigV4.
   Таблицы создаются один раз командами из club/DEPLOY.md. Ключ: id (строка), у loginlog — h (хеш-ключ) + r (ключ сортировки).
   Интерфейс тот же, что у lib/store/memory.js. */
'use strict';
const {sign}=require('../sigv4');
const {COMPOSITE}=require('./memory');

function marshal(v){ if(v===null||v===undefined) return {NULL:true}; if(typeof v==='string') return {S:v}; if(typeof v==='number') return {N:String(v)};
  if(typeof v==='boolean') return {BOOL:v}; if(Array.isArray(v)) return {L:v.map(marshal)};
  if(typeof v==='object'){ const M={}; Object.keys(v).forEach(k=>{ if(v[k]!==undefined) M[k]=marshal(v[k]); }); return {M}; } return {NULL:true}; }
function unmarshal(a){ if(!a) return undefined; if('S' in a) return a.S; if('N' in a) return Number(a.N); if('BOOL' in a) return a.BOOL; if('NULL' in a) return null;
  if('L' in a) return a.L.map(unmarshal); if('M' in a){ const o={}; Object.keys(a.M).forEach(k=>{ o[k]=unmarshal(a.M[k]); }); return o; } return undefined; }
const item=o=>marshal(o).M, unitem=m=>m?unmarshal({M:m}):null;

function ydbStore(o){
  const {endpoint,accessKeyId,secretAccessKey,prefix='club_',fetchImpl=fetch,now=()=>Date.now()}=o;
  const cred={accessKeyId,secretAccessKey,region:'ru-central1',service:'dynamodb'};
  const name=t=>prefix+t;
  const keyOf=(t,key)=>COMPOSITE.has(t)?{h:{S:key.h},r:{S:key.r}}:{id:{S:String(key)}};
  async function call(op,body){ const b=JSON.stringify(body);
    const req={method:'POST',url:endpoint,headers:{'content-type':'application/x-amz-json-1.0','x-amz-target':'DynamoDB_20120810.'+op},body:b};
    const s=sign(req,cred,now()); const r=await fetchImpl(endpoint,{method:'POST',headers:s.headers,body:b});
    const txt=await r.text(); let j={}; try{ j=txt?JSON.parse(txt):{}; }catch(e){}
    if(!r.ok){ const type=String(j.__type||'').split('#').pop(); const err=new Error('YDB '+op+': '+(type||r.status)+' '+(j.message||j.Message||'')); err.type=type; throw err; }
    return j; }
  const condFailed=e=>e&&/ConditionalCheckFailed/.test(e.type||e.message);
  return {
    kind:'ydb',
    async get(t,key){ const j=await call('GetItem',{TableName:name(t),Key:keyOf(t,key),ConsistentRead:true}); return unitem(j.Item); },
    async put(t,it,opt){ const body={TableName:name(t),Item:item(it)};
      if(opt&&opt.ifNotExists) body.ConditionExpression=COMPOSITE.has(t)?'attribute_not_exists(h)':'attribute_not_exists(id)';
      try{ await call('PutItem',body); return true; }catch(e){ if(condFailed(e)) return false; throw e; } },
    async update(t,key,set,opt){ const names={}, vals={}, sets=[], rems=[]; let i=0;
      Object.keys(set).forEach(f=>{ const n='#f'+i, v=':v'+i; i++; names[n]=f; if(set[f]===undefined) rems.push(n); else { vals[v]=marshal(set[f]); sets.push(n+' = '+v); } });
      const conds=[COMPOSITE.has(t)?'attribute_exists(h)':'attribute_exists(id)'];
      Object.keys((opt&&opt.ifEq)||{}).forEach(f=>{ const n='#c'+i, v=':c'+i; i++; names[n]=f; const want=opt.ifEq[f];
        if(want===null) conds.push('attribute_not_exists('+n+')'); else { vals[v]=marshal(want); conds.push(n+' = '+v); } });
      const body={TableName:name(t),Key:keyOf(t,key),UpdateExpression:[sets.length?'SET '+sets.join(', '):'',rems.length?'REMOVE '+rems.join(', '):''].join(' ').trim(),
        ConditionExpression:conds.join(' AND '),ExpressionAttributeNames:names,ReturnValues:'ALL_NEW'};
      if(Object.keys(vals).length) body.ExpressionAttributeValues=vals;
      try{ const j=await call('UpdateItem',body); return unitem(j.Attributes); }catch(e){ if(condFailed(e)) return null; throw e; } },
    async del(t,key){ await call('DeleteItem',{TableName:name(t),Key:keyOf(t,key)}); },
    async scan(t,filter){ const out=[]; let start;
      do{ const j=await call('Scan',Object.assign({TableName:name(t)},start?{ExclusiveStartKey:start}:{})); (j.Items||[]).forEach(m=>{ const x=unitem(m); if(!filter||filter(x)) out.push(x); }); start=j.LastEvaluatedKey; }while(start);
      return out; },
    async query(t,h,opt){ const out=[]; let start;
      do{ const j=await call('Query',Object.assign({TableName:name(t),KeyConditionExpression:'h = :h',ExpressionAttributeValues:{':h':{S:h}},ScanIndexForward:!(opt&&opt.desc)},opt&&opt.limit?{Limit:opt.limit}:{},start?{ExclusiveStartKey:start}:{}));
        (j.Items||[]).forEach(m=>out.push(unitem(m))); start=opt&&opt.limit&&out.length>=opt.limit?null:j.LastEvaluatedKey; }while(start);
      return opt&&opt.limit?out.slice(0,opt.limit):out; },
    async incr(t,key,field,by,extra){ const names={'#n':field}, vals={':by':{N:String(by)}}, sets=[]; let i=0;
      Object.keys(extra||{}).forEach(f=>{ const n='#e'+i, v=':e'+i; i++; names[n]=f; vals[v]=marshal(extra[f]); sets.push(n+' = if_not_exists('+n+', '+v+')'); });
      const j=await call('UpdateItem',{TableName:name(t),Key:keyOf(t,key),UpdateExpression:'ADD #n :by'+(sets.length?' SET '+sets.join(', '):''),ExpressionAttributeNames:names,ExpressionAttributeValues:vals,ReturnValues:'UPDATED_NEW'});
      return unmarshal(j.Attributes&&j.Attributes[field])||0; }
  };
}
module.exports={ydbStore,marshal,unmarshal};
