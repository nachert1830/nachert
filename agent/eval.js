/* ═══════════ Оценка агента: K вариантов × модели ═══════════
   node agent/eval.js                 — воспроизвести таблицу RESULTS.md из логов agent/logs/eval.jsonl: каждый
                                        записанный ответ модели заново проходит исполнитель и сертификат текущего кода
                                        (сеть не нужна; расхождения с логом печатаются и дают код выхода 1)
   node agent/eval.js --live          — новый прогон через OpenRouter (дописывает лог; уже сделанные пары пропускает)
   Параметры: --k=50 --seed=12345 (или --dev: DEV_SEED) --attempts=3 --models=a,b,c --log=файл --jobs=4
              --json=файл (все цифры одной записью)
   Контроль зануды (всегда, без сети): каждая ошибочная программа библиотеки core/cp47.js на каждом из K вариантов
   должна быть отвергнута, каждая верная — принята. */
const fs=require('fs'), path=require('path');
const V=require('./variants.js'), A=require('./agent.js'), PRM=require('./prompt.js'), P=require('./plan.js'), N=require('./nerd.js'), C=require('../core/cp47.js');

const arg=(k,d)=>{ const a=process.argv.find(x=>x==='--'+k||x.startsWith('--'+k+'=')); return a?(a.includes('=')?a.slice(k.length+3):true):d; };
const MODELS=['openai/gpt-5.4-mini','anthropic/claude-haiku-5.5','google/gemini-3.8-flash','deepseek/deepseek-v4.1-flash','meta-llama/llama-3.3-70b-instruct'];
const LIVE=!!arg('live',false), SEED=arg('dev',false)?V.DEV_SEED:+arg('seed',V.EVAL_SEED), K=+arg('k',50), MAXA=+arg('attempts',3);
const models=String(arg('models',MODELS.join(','))).split(',').filter(Boolean);
const LOG=path.resolve(arg('log',path.join(__dirname,'logs',SEED===V.EVAL_SEED?'eval.jsonl':'dev-'+SEED+'.jsonl')));
const JOBS=+arg('jobs',4);
const vs=V.variants(SEED,K);

/* независимая проверка выданного (не зануда): координаты K и |AK| против формулы cp47.truth в плавающей точке */
function truthOf(ans,v){ if(!ans) return null; const j=C.judge(ans,v.G);
  return {ok:j.dK<1e-6&&j.dNV<1e-6&&ans.text==='|AK| ≈ '+Math.round(j.AK)+' мм',dK:j.dK,dNV:j.dNV}; }

function readLog(){ if(!fs.existsSync(LOG)) return [];
  return fs.readFileSync(LOG,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(r=>r.prompt===PRM.PROMPT_VERSION); }

/* модель, которая отвечает записанными текстами (воспроизведение) */
function replayLLM(rec){ return async(msgs,n)=>{ const a=rec.attempts[n-1]; if(!a) throw new Error(rec.reason&&rec.reason.text||'в логе нет попытки '+n);
  return {text:a.text,finish:a.finish,usage:a.usage,ms:a.ms,raw_model:a.raw_model,provider:a.provider}; }; }

async function pool(items,n,f){ let i=0; const run=async()=>{ while(i<items.length){ const k=i++; await f(items[k],k); } };
  await Promise.all(Array.from({length:Math.min(n,items.length)},run)); }

(async()=>{
  const log=readLog(), done=new Set(log.map(r=>r.model+'|'+r.variant)), t0=Date.now();
  if(LIVE){ fs.mkdirSync(path.dirname(LOG),{recursive:true});
    const todo=[]; models.forEach(m=>vs.forEach(v=>{ if(!done.has(m+'|'+v.id)) todo.push([m,v]); }));
    console.log('Живой прогон: '+todo.length+' пар (модель × вариант), лог '+path.relative(process.cwd(),LOG));
    let c=0;
    await pool(todo,JOBS,async([m,v])=>{ const r=await A.solve(v,{model:m,maxAttempts:MAXA,llm:A.liveLLM(m)});
      r.date=new Date().toISOString(); fs.appendFileSync(LOG,JSON.stringify(r)+'\n'); c++;
      process.stdout.write('  ['+c+'/'+todo.length+'] '+m+' '+v.id+': '+r.status+' за '+r.attempts.length+'\n'); }); }

  /* воспроизведение: каждый ответ модели из лога — заново через исполнитель и сертификат */
  const recs=readLog().filter(r=>models.includes(r.model)&&vs.some(v=>v.id===r.variant));
  let reAttempts=0; const mism=[];
  const out=[];
  for(const rec of recs){ const v=vs.find(x=>x.id===rec.variant);
    const r=await A.solve(v,{model:rec.model,maxAttempts:rec.maxAttempts,llm:replayLLM(rec)});
    r.attempts.forEach((a,k)=>{ reAttempts++; const b=rec.attempts[k]||{};
      if(a.stage!==b.stage||JSON.stringify(a.errors||null)!==JSON.stringify(b.errors||null)) mism.push(rec.model+' '+rec.variant+' попытка '+(k+1)+': в логе '+b.stage+', сейчас '+a.stage); });
    if(r.status!==rec.status) mism.push(rec.model+' '+rec.variant+': в логе '+rec.status+', сейчас '+r.status);
    r.truth=truthOf(r.answer,v);
    r.attempts.forEach(a=>{ a.truth=a.candidate?truthOf(a.candidate,v):null; });
    out.push(r); }

  /* таблица по моделям */
  const pct=(a,b)=>b?(100*a/b).toFixed(0)+' %':'—', rows=[], M={};
  models.forEach(m=>{ const rs=out.filter(r=>r.model===m); if(!rs.length) return;
    const n=rs.length, solved=rs.filter(r=>r.status==='solved'), first=solved.filter(r=>r.attempts.length===1);
    const api=rs.filter(r=>r.status==='refused'&&r.reason&&r.reason.kind==='api');
    const refused=rs.filter(r=>r.status==='refused');
    const wrong=solved.filter(r=>!r.truth||!r.truth.ok);
    const att=rs.flatMap(r=>r.attempts), execOk=att.filter(a=>a.stage==='certify'||a.stage==='ok'), lie=att.filter(a=>a.stage==='certify');
    const lieTrue=lie.filter(a=>a.truth&&a.truth.ok);         /* сертификат отверг то, что по независимой формуле верно */
    const tasksLie=rs.filter(r=>{ const a=r.attempts.find(x=>x.stage==='certify'||x.stage==='ok'); return a&&a.stage==='certify'; });
    const st=k=>att.filter(a=>a.stage===k).length;
    const m1={n,first:first.length,solved:solved.length,afterFix:solved.length-first.length,refused:refused.length,api:api.length,wrong:wrong.length,
      attempts:att.length,execOk:execOk.length,lie:lie.length,lieTrue:lieTrue.length,tasksLie:tasksLie.length,
      stages:{parse:st('parse'),validate:st('validate'),exec:st('exec'),certify:st('certify'),ok:st('ok')},
      avgAttempts:att.length/n,avgTokens:rs.reduce((s,r)=>s+r.tokens.prompt+r.tokens.completion,0)/n,avgCost:rs.reduce((s,r)=>s+r.cost,0)/n};
    M[m]=m1;
    rows.push('| '+m+' | '+n+' | '+pct(m1.first,n)+' | '+pct(m1.afterFix,n)+' ('+pct(m1.solved,n)+') | '+pct(m1.refused,n)+(api.length?' (сбой API '+api.length+')':'')+' | **'+pct(m1.wrong,n)+'** ('+m1.wrong+') | '+
      pct(m1.lie,m1.execOk)+' ('+m1.lie+' из '+m1.execOk+') | '+m1.avgAttempts.toFixed(2)+' | '+Math.round(m1.avgTokens)+' | $'+m1.avgCost.toFixed(4)+' |'); });
  console.log('\nВарианты: сид '+SEED+', K = '+K+', попыток не больше '+MAXA+'; записей в логе: '+out.length+', попыток переисполнено: '+reAttempts+', расхождений с логом: '+mism.length);
  mism.slice(0,10).forEach(s=>console.log('  ≠ '+s));
  if(rows.length){
    console.log('\n| Модель | Задач | Решено с 1-й попытки | Решено после исправлений (всего) | Честных отказов | Неверных ответов выдано | «Соврал бы без зануды»: план исполнился, сертификат отверг | Попыток на задачу | Токенов на задачу | Стоимость на задачу |');
    console.log('|---|---|---|---|---|---|---|---|---|---|'); rows.forEach(r=>console.log(r));
    console.log('\nГде остановилась каждая попытка (разбор / формат / исполнение / сертификат / принято):');
    Object.entries(M).forEach(([m,x])=>console.log('  '+m+': '+[x.stages.parse,x.stages.validate,x.stages.exec,x.stages.certify,x.stages.ok].join(' / ')+
      '; задач, где первый исполнившийся план был бы неверным ответом: '+x.tasksLie+'; сертификат отверг верное по независимой формуле: '+x.lieTrue)); }

  /* контроль зануды: библиотека ошибок core/cp47.js */
  const ctl={}, ctlOk={acc:0,tot:0}, noO7={acc:0,right:0,where:new Set()}; let ctlChecks=0;
  vs.forEach(v=>{ const g=C.given(v.G);
    C.hypotheses().forEach(h=>{ const full=C.program(h.kid,h.nvid);
      /* необязательные шаги (opt) на ответ не влияют; без них ошибочная программа доходит до сертификата */
      const plan={steps:full.steps.filter(s=>h.cls==='ok'||!s.opt).map(s=>({id:s.id,op:s.op,args:s.args}))};
      let res; const va=P.validate(plan);
      if(!va.ok) res='формат: '+va.errors[0].replace(/ \(.*$/,'');
      else { const ex=P.run(va.prog,g); if(!ex.ok) res='исполнение'; else { ctlChecks++;
        /* полный сертификат — как у агента; отдельно — без O7 (только этот вариант) и сверка с независимой формулой */
        const c=N.check(v,va.prog,ex.E); res=c.ok?'ПРИНЯТ':'сертификат: '+c.failed.join(',');
        if(h.cls!=='ok'&&c.failed.length===1&&c.failed[0]==='O7'){ const tr=truthOf(N.deliverable(ex.E),v); noO7.acc++; if(tr&&tr.ok){ noO7.right++; noO7.where.add(v.id); } } } }
      if(h.cls==='ok'){ ctlOk.tot++; if(res==='ПРИНЯТ') ctlOk.acc++; return; }
      const e=ctl[h.cls]=ctl[h.cls]||{tot:0,acc:0,by:{}}; e.tot++; if(res==='ПРИНЯТ') e.acc++; e.by[res]=(e.by[res]||0)+1; }); });
  const ctlTot=Object.values(ctl).reduce((s,e)=>s+e.tot,0), ctlAcc=Object.values(ctl).reduce((s,e)=>s+e.acc,0);
  console.log('\nКонтроль зануды на тех же '+K+' вариантах: ошибочных программ '+ctlTot+', принято '+ctlAcc+'; верных программ '+ctlOk.tot+', принято '+ctlOk.acc);
  console.log('| Ошибка (core/cp47.js) | Программ | Отвергнуто | Чем отвергнуто |\n|---|---|---|---|');
  Object.entries(ctl).forEach(([k,e])=>console.log('| '+k+' | '+e.tot+' | '+(e.tot-e.acc)+' | '+Object.entries(e.by).map(([r,c])=>r+' — '+c).join('; ')+' |'));
  console.log('Без O7 (только данные своего варианта) прошли бы '+noO7.acc+' ошибочных программ; из них верный ответ по независимой формуле дают '+noO7.right+
    (noO7.where.size?' (варианты '+[...noO7.where].join(', ')+': на этих данных ошибочный способ случайно совпадает с верным)':''));

  /* --examples: три случая из лога — (а) с первой попытки, (б) зануда поймал ошибку, агент исправился, (в) честный отказ */
  if(arg('examples',false)){ const pickEx=f=>out.find(f);
    const ex=[['а) решено с первой попытки',r=>r.status==='solved'&&r.attempts.length===1],
      ['б) LLM ошиблась, зануда поймал, агент исправился',r=>r.status==='solved'&&r.attempts.some(a=>a.stage==='certify')],
      ['в) честный отказ (план исполнялся, сертификат не принял)',r=>r.status==='refused'&&r.attempts.some(a=>a.stage==='certify')&&r.attempts.some(a=>a.truth&&!a.truth.ok)]];
    ex.forEach(([title,f])=>{ const r=pickEx(f); console.log('\n### '+title); if(!r){ console.log('нет в логе'); return; }
      const v=vs.find(x=>x.id===r.variant); console.log('Модель '+r.model+', вариант '+r.variant+'\n'+v.text.split('\n').slice(2,4).join('\n'));
      r.attempts.forEach(a=>{ const steps=a.plan&&Array.isArray(a.plan.steps)?a.plan.steps:[];
        console.log('Попытка '+a.n+' — '+a.stage+(steps.length?', шагов '+steps.length+': '+steps.map(s=>s&&s.id+'='+s.op+'('+(s.args||[]).join(',')+')').join('; '):''));
        if(a.candidate) console.log('  без зануды выдал бы: K″ = ('+a.candidate['K″'].map(x=>x.toFixed(2)).join('; ')+'), K′ = ('+a.candidate['K′'].map(x=>x.toFixed(2)).join('; ')+'), '+a.candidate.text+
          ' — по независимой формуле '+(a.truth&&a.truth.ok?'верно':'НЕВЕРНО (K сдвинута на '+a.truth.dK.toFixed(2)+' мм, |AK| — на '+a.truth.dNV.toFixed(2)+' мм)'));
        (a.errors||[]).slice(0,4).forEach(e=>console.log('  ошибка → модели: '+e)); });
      console.log('Итог: '+(r.status==='solved'?'выдано '+r.answer.text+' ('+r.answer.certificate+')':'«не решено»: '+r.reason.text.slice(0,300))); }); }

  const bad=mism.length||ctlAcc||noO7.acc!==noO7.right||ctlOk.acc!==ctlOk.tot||Object.values(M).some(x=>x.wrong);
  if(arg('json',false)) fs.writeFileSync(arg('json'),JSON.stringify({seed:SEED,K,maxAttempts:MAXA,models:M,control:{errors:ctl,accepted:ctlAcc,total:ctlTot,correct:ctlOk,noO7:{acc:noO7.acc,right:noO7.right,where:[...noO7.where]}},mismatches:mism.length,reAttempts},null,1));
  console.log('\n'+(bad?'ЕСТЬ НАРУШЕНИЯ (см. выше)':'Инвариант соблюдён: неверных ответов выдано 0, каждая ошибка библиотеки отвергнута, лог воспроизводится')+' · '+((Date.now()-t0)/1000).toFixed(0)+' с');
  process.exit(bad?1:0);
})();
