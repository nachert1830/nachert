/* Наставник: агентный цикл. Модель ⇄ инструменты (до 5 кругов) → сверщик → (один круг «перепиши») → вырезать
   несошедшееся. Сбой основной модели (402, 5xx, таймаут) — тот же ход на запасной. Всё в пределах deadline
   (функция живёт 60 с; ответ — не дольше 45 с).
   run(o) → {text, model, kop, rounds, verify:{first, repaired, cut, violations}, fallback?}
   o = {models:[основная, запасная], llm:{http,key,token}, messages, tools:true|false, ctx (для tools.exec), vctx (для сверки),
        deadline, rate} */
'use strict';
const LLM=require('./llm'), T=require('./tools'), VF=require('./verify'), PR=require('./prompts');
const MAX_ROUNDS=5;

async function converse(o,m,msgs){ let rounds=0, kop=0, nudged=false; const tk={in:0,out:0,cached:0}, addTk=u=>{ const t=LLM.tokens(u); tk.in+=t.in; tk.out+=t.out; tk.cached+=t.cached; };
  for(;;){ const left=o.deadline-Date.now(); if(left<4000) throw new LLM.ModelError('Не успел ответить вовремя.',504);
    const toolsOn=!!o.tools, more=rounds<MAX_ROUNDS;
    const r=await LLM.chat(o.llm,m,{messages:msgs,tools:toolsOn?T.DEFS:null,toolChoice:toolsOn&&!more?'none':'auto',max:900,timeout:Math.min(25000,left-1500),cache:o.cache,cacheSplit:o.cacheSplit});
    kop+=LLM.kopecks(m.model,r.usage,o.rate); addTk(r.usage); rounds++;
    const calls=toolsOn&&more?r.message.tool_calls:[];
    if(calls.length){ msgs.push({role:'assistant',content:r.message.content||null,tool_calls:calls.map((c,i)=>({id:c.id||('call_'+rounds+'_'+i),type:'function',function:{name:c.function.name,arguments:c.function.arguments||'{}'}}))});
      for(const [i,c] of calls.slice(0,6).entries()){ let args={}; try{ args=JSON.parse(c.function.arguments||'{}'); }catch(e){}
        const res=await T.exec(c.function.name,args,o.ctx); msgs.push({role:'tool',tool_call_id:c.id||('call_'+rounds+'_'+i),content:JSON.stringify(res).slice(0,12000)}); }
      /* лишние вызовы сверх шести — ответ «не выполнено», чтобы у каждого вызова был ответ */
      calls.slice(6).forEach((c,i)=>msgs.push({role:'tool',tool_call_id:c.id||('call_x_'+i),content:'{"error":"слишком много вызовов за раз"}'}));
      continue; }
    if(!r.message.content){ if(nudged) throw new LLM.ModelError('Модель вернула пустой ответ.',502); nudged=true; msgs.push({role:'user',content:'(Ответь студенту текстом.)'}); continue; }
    return {text:r.message.content,kop,rounds,model:m.model,msgs,tk}; } }

async function run(o){ const base=o.messages.slice(); let res=null, fallback=null, kop=0;
  for(let i=0;i<o.models.length&&!res;i++){ const m=o.models[i]; if(!m) continue;
    try{ res=await converse(o,m,base.slice()); }
    catch(e){ if(!(e instanceof LLM.ModelError)) throw e; fallback=(fallback?fallback+'; ':'')+m.model+': '+e.message;
      if(i===o.models.length-1||o.deadline-Date.now()<9000) throw Object.assign(e,{fallback}); } }
  kop+=res.kop; const model=o.models.find(m=>m&&m.model===res.model)||o.models[0];
  /* сверка */
  const v1=VF.check(res.text,o.vctx()); let text=res.text, repaired=false, cut=0, v=v1;
  if(!v1.ok&&o.deadline-Date.now()>6000){
    try{ const msgs=res.msgs.concat([{role:'assistant',content:res.text},{role:'user',content:PR.REPAIR.replace('{V}',VF.explain(v1.violations))}]);
      const r=await LLM.chat(o.llm,model,{messages:msgs,tools:o.tools?T.DEFS:null,toolChoice:'none',max:700,timeout:Math.min(15000,o.deadline-Date.now()-1500),cache:o.cache,cacheSplit:o.cacheSplit});
      kop+=LLM.kopecks(model.model,r.usage,o.rate); { const t=LLM.tokens(r.usage); res.tk.in+=t.in; res.tk.out+=t.out; res.tk.cached+=t.cached; }
      if(r.message.content){ const v2=VF.check(r.message.content,o.vctx()); text=r.message.content; v=v2; repaired=true; } }
    catch(e){ /* не успели переписать — режем исходный */ } }
  if(!v.ok){ const before=VF.sentences(text).length; text=VF.cut(text,v.violations); cut=before-VF.sentences(text).length; }
  if(!text.trim()) text='Давай разберём этот шаг вместе. Посмотри на шаг на чертеже и напиши, что уже получилось и где застрял — подскажу, что делать дальше.';
  return {text,model:res.model,kop,rounds:res.rounds,tokens:res.tk,fallback,verify:{first:v1.ok,repaired,cut,violations:v1.violations.slice(0,8).map(x=>({kind:x.kind,what:x.what}))}}; }

module.exports={run,converse,MAX_ROUNDS};
