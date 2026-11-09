/* ═══════════ Самопроверка агента без сети: node agent/selftest.js ═══════════
   1. Фальшивые генераторы: «отличник» (верная программа cp47) → решено с 1-й попытки; «лжец» (ошибки библиотеки) →
      честный отказ; «исправляющийся» (ошибка, затем верно) → решено после исправления; мусор (не JSON, чужие действия,
      числа вместо имён, ссылки вперёд, обрыв связи) → понятная ошибка, а не падение.
   2. Мутационный фаззинг зануды: случайные правки верных программ (замена действия, аргумента, стороны) — каждый
      мутант, принятый сертификатом, должен быть верен по независимой формуле cp47.truth. Иначе — дыра в зануде.
   3. Инвариант агента: ответ (answer) есть только при status = 'solved' и только с сертификатом. */
const V=require('./variants.js'), A=require('./agent.js'), P=require('./plan.js'), N=require('./nerd.js'), C=require('../core/cp47.js');
let fail=0; const ok=(c,m)=>{ if(!c){ fail++; console.log('  ✗ '+m); } return c; };
const planOf=(kid,nv,dropOpt)=>JSON.stringify({steps:C.program(kid,nv).steps.filter(s=>!dropOpt||!s.opt).map(s=>({id:s.id,op:s.op,args:s.args}))});
const fake=texts=>async(msgs,n)=>({text:typeof texts==='function'?texts(n,msgs):texts[Math.min(n,texts.length)-1],usage:{prompt:0,completion:0,cost:0},ms:0});
const vs=V.variants(V.EVAL_SEED,5);

(async()=>{
  console.log('1. Фальшивые генераторы');
  for(const v of vs){
    let r=await A.solve(v,{llm:fake([planOf('front','ok:1A+')])});
    ok(r.status==='solved'&&r.attempts.length===1,'отличник: '+r.status);
    ok(r.answer&&N.deliverable&&C.judge(r.answer,v.G).dK<1e-6,'отличник: ответ неверен');
    r=await A.solve(v,{llm:fake([planOf('foot1','ok:1A+',true),planOf('front','abs:2K-',true),planOf('12-swap','same:1A+',true)])});
    ok(r.status==='refused'&&!r.answer&&r.attempts.every(a=>a.stage==='certify'||a.stage==='exec'),'лжец: '+r.status+' '+r.attempts.map(a=>a.stage));
    r=await A.solve(v,{llm:fake([planOf('f-hpar','ok:2A+'),planOf('horiz','ok:2K-')])});
    ok(r.status==='solved'&&r.attempts.length===2&&r.attempts[0].stage==='certify','исправляющийся: '+r.status);
    /* сообщения обратной связи не раскрывают верный ответ */
    const fb=r.attempts[0].errors.join(' '), K=C.truth(v.G).K, Kf=[-K[0],-K[2]].map(x=>x.toFixed(3));
    ok(!fb.includes(Kf[0]+'; '+Kf[1]),'обратная связь раскрыла K″'); }
  const v=vs[0], junk=['','Не знаю.','{"steps":[{"id":"K″","op":"magic","args":[]}]}','{"steps":[{"id":"K″","op":"meet","args":["a″","h″"]}]}',
    '{"steps":[{"id":"h","op":"parAxis","args":[12.5]}]}','{"steps":[{"id":"A″","op":"parAxis","args":["A′"]}]}','{"steps":[{"id":"p","op":"meet","args":["a″","A″"]}]}',
    '```json\n{"steps":[{"id":"h″","op":"parAxis","args":["A″"]},{"id":"K″","op":"meet","args":["h″","x"]}]}\n```','[1,2,3]','{"steps":"нет"}'];
  for(const t of junk){ let r; try{ r=await A.solve(v,{llm:fake([t])}); }catch(e){ ok(false,'падение на «'+t.slice(0,30)+'»: '+e.message); continue; }
    ok(r.status==='refused'&&r.attempts[0].errors&&r.attempts[0].errors.length,'мусор «'+t.slice(0,30)+'»: нет текста ошибки'); }
  { const r=await A.solve(v,{llm:async()=>{ throw new Error('сеть упала'); }}); ok(r.status==='refused'&&r.reason.kind==='api','сбой API → отказ'); }
  console.log('  отличник, лжец, исправляющийся — на '+vs.length+' вариантах; мусор — '+junk.length+' видов: понятные ошибки, без падений');

  console.log('2. Мутационный фаззинг зануды');
  let seed=99; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647), pick=a=>a[Math.floor(rnd()*a.length)];
  const ops=Object.keys(P.SIG); let tried=0, ran=0, acc=0, accRight=0, accWrong=0, wrongRan=0, rejRight=0; const rejWhy={}; const t0=Date.now();
  const MUT=+(process.argv.find(a=>a.startsWith('--mutants='))||'=20000').split('=')[1];
  for(let it=0;it<MUT;it++){ const v=vs[it%vs.length], base=JSON.parse(planOf(pick(['front','horiz']),pick(Object.keys(C.NVOPT).filter(k=>C.NVOPT[k].ok))));
    const st=base.steps, edits=1+(rnd()<0.3?1:0);
    for(let e=0;e<edits;e++){ const k=Math.floor(rnd()*st.length), s=st[k], names=['A″','A′','a″','a′','x'].concat(st.slice(0,k).map(x=>x.id));
      const m=Math.floor(rnd()*4);
      if(m===0){ const alt=ops.filter(o=>P.SIG[o].args.length===P.SIG[s.op].args.length&&o!==s.op); if(alt.length) s.op=pick(alt); }
      else if(m===1){ const j=Math.floor(rnd()*s.args.length); if(typeof s.args[j]==='string') s.args[j]=pick(names); }
      else if(m===2){ const j=Math.floor(rnd()*st.length); if(j!==k){ const t=st[j]; st[j]=s; st[k]=t; } }
      else if(s.op==='perpOff') s.args[3]=-(s.args[3]||1); else if(s.args.length>=2&&typeof s.args[1]==='string'){ const t=s.args[0]; s.args[0]=s.args[1]; s.args[1]=t; } }
    tried++; const va=P.validate(base); if(!va.ok) continue; const ex=P.run(va.prog,C.given(v.G)); if(!ex.ok) continue; ran++;
    const j=C.judge(N.deliverable(ex.E),v.G), right=j.dK<1e-6&&j.dNV<1e-6; if(!right) wrongRan++;
    const c=N.check(v,va.prog,ex.E,{variants:0}); if(!c.ok){ if(right){ rejRight++; rejWhy[c.failed.join(',')]=(rejWhy[c.failed.join(',')]||0)+1; if(process.env.SHOW&&rejRight<6) console.log(c.O.O1.detail, JSON.stringify(va.prog.steps.slice(-6))); } continue; } acc++;
    if(right) accRight++; else { accWrong++; console.log('  ✗ принят неверный мутант: '+JSON.stringify(va.prog.steps)); } }
  ok(accWrong===0,'зануда принял неверных мутантов: '+accWrong);
  console.log('  мутантов '+tried+', исполнились '+ran+'; из них неверны по формуле '+wrongRan+' — сертификат отверг '+(wrongRan-accWrong)+'; '+
    'верных принято '+accRight+', верных по формуле, но отвергнутых '+rejRight+' ('+JSON.stringify(rejWhy)+') · '+((Date.now()-t0)/1000).toFixed(1)+' с');
  console.log(fail?'\nОШИБОК: '+fail:'\nАгент: ошибок нет.'); process.exit(fail?1:0);
})();
