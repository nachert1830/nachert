/* ═══════════ Агент «гений + зануда» для № 47 ═══════════
   Генератор (LLM) предлагает план → исполнитель (core/cp.js) строит → зануда (core/certify.js) проверяет.
   При ошибке модель получает её текст и пробует снова, не больше maxAttempts раз (по умолчанию 3).
   Не прошёл сертификат за все попытки — «не решено» и причина. Ответ (deliverable) создаётся в одном месте —
   после c.ok сертификата; непроверенный ответ наружу не выходит.

   Один вариант из командной строки:
     node agent/agent.js --model=openai/gpt-5.4-mini [--seed=12345 --i=0 --attempts=3] */
const P=require('./plan.js'), N=require('./nerd.js'), {cone}=require('./exact-plan.js'), PR=require('./prompt.js'), C=require('../core/cp47.js');

async function solve(v,o){ const maxA=o.maxAttempts||3, llm=o.llm, given=C.given(v.G);
  const messages=[{role:'system',content:PR.SYSTEM},{role:'user',content:PR.first(v)}], attempts=[];
  for(let n=1;n<=maxA;n++){
    let r; try{ r=await llm(messages,n); }
    catch(e){ return finish(v,o,attempts,'refused',null,{kind:'api',text:'генератор недоступен: '+e.message}); }
    const at={n,text:r.text,finish:r.finish,usage:r.usage,ms:r.ms,raw_model:r.raw_model,provider:r.provider};
    attempts.push(at);
    const errs=step(v,r.text,given,at);
    if(!errs){ return finish(v,o,attempts,'solved',at._answer,null); }
    at.errors=errs;
    if(r.finish==='length') errs.unshift('ответ обрезан по длине — план должен быть короче');
    messages.push({role:'assistant',content:r.text||''},{role:'user',content:PR.retry(errs)}); }
  const last=attempts[attempts.length-1];
  return finish(v,o,attempts,'refused',null,{kind:last.stage,text:'за '+maxA+' попыт. сертификат не пройден; последняя ошибка ('+last.stage+'): '+(last.errors||[]).slice(0,3).join('; ')}); }

/* одна попытка: разбор → формат → исполнение → сертификат. null — принято; иначе тексты ошибок */
function step(v,text,given,at){
  const p=P.parse(text); if(!p.ok){ at.stage='parse'; return p.errors; }
  at.plan=p.plan;
  const va=P.validate(p.plan); if(!va.ok){ at.stage='validate'; return va.errors; }
  const ex=P.run(va.prog,given); if(!ex.ok){ at.stage='exec'; return ex.errors; }
  const live=cone(va.prog), unused=va.prog.steps.filter((s,i)=>!live[i]).map(s=>s.id); if(unused.length) at.unused=unused;   /* на ответ не влияют */
  /* кандидат — то, что выдал бы агент без зануды (в лог для аудита; пользователю не уходит) */
  at.candidate=N.deliverable(ex.E);
  const c=N.check(v,va.prog,ex.E); at.cert={ok:c.ok,failed:c.failed,O:c.O};
  if(!c.ok){ at.stage='certify'; return N.feedback(c,N.diagnose(v,va.prog)); }
  at.stage='ok'; Object.defineProperty(at,'_answer',{value:Object.assign(N.deliverable(ex.E),{certificate:Object.keys(c.O).join(' ')+' выполнены'}),enumerable:false});
  return null; }

function finish(v,o,attempts,status,answer,reason){ const sum=k=>attempts.reduce((s,a)=>s+((a.usage||{})[k]||0),0);
  return {variant:v.id,model:o.model,prompt:PR.PROMPT_VERSION,maxAttempts:o.maxAttempts||3,status,answer,reason,
    attempts,tokens:{prompt:sum('prompt'),completion:sum('completion'),reasoning:sum('reasoning')},cost:sum('cost')}; }

/* модель «id@effort» — тот же id с явным усилием рассуждений (low / medium / high), иначе — настройка OpenRouter по умолчанию */
function liveLLM(spec,opts){ const {chat}=require('./llm.js'), [model,effort]=spec.split('@');
  return msgs=>chat(model,msgs,Object.assign({seed:47},opts,effort?{reasoning:{effort}}:{})); }   /* temperature 0 и seed — насколько провайдер их соблюдает */

module.exports={solve,step,liveLLM};

if(require.main===module){ (async()=>{
  const arg=(k,d)=>{ const a=process.argv.find(x=>x.startsWith('--'+k+'=')); return a?a.slice(k.length+3):d; };
  const V=require('./variants.js'), seed=+arg('seed',V.EVAL_SEED), i=+arg('i',0), model=arg('model','openai/gpt-5.4-mini');
  const v=V.variants(seed,i+1)[i]; console.log(v.text+'\n');
  const r=await solve(v,{model,maxAttempts:+arg('attempts',3),llm:liveLLM(model)});
  r.attempts.forEach(a=>console.log('попытка '+a.n+': '+a.stage+(a.errors?'\n  '+a.errors.join('\n  '):'')));
  console.log('\n'+(r.status==='solved'?'РЕШЕНО: '+JSON.stringify(r.answer):'НЕ РЕШЕНО: '+r.reason.text)+'\nтокены '+JSON.stringify(r.tokens)+', $'+r.cost.toFixed(5));
})(); }
