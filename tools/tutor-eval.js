/* Наставник: замер на живой модели (нужен PROXYAPI_KEY). Сценарии — server/lib/tutor/eval.json.
   Тот же сервер кабинета, что в облаке (база в памяти), настоящие вызовы ProxyAPI. На каждый сценарий — новый студент с согласием.
   Меряет: сверка прошла с первого раза, нужный шаг показан на чертеже, ожидания по тексту, инструменты, время, цена.
   node tools/tutor-eval.js [--only=start,jailbreak] [--model=anthropic/claude-haiku-5-5] [--json=отчёт.json]
   node tools/tutor-eval.js --only=eyes — только глаза: проверочные фото листа (server/test/tutor-eyes, tools/tutor-eyes-make.js)
   Код выхода 1 — ниже норм (norms в eval.json). Без ключа — «пропущено», код 0. */
'use strict';
const fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
const {createApp}=require(ROOT+'/server/lib/app'), {memoryStore}=require(ROOT+'/server/lib/store/memory'), {botClient}=require(ROOT+'/server/lib/telegram');
const TUTOR=require(ROOT+'/server/lib/tutor'), SET=require(ROOT+'/server/lib/tutor/eval.json');
const arg=k=>{ const a=process.argv.find(x=>x.startsWith('--'+k+'=')); return a?a.slice(k.length+3):''; };

/* глаза: фото листа (server/test/tutor-eyes — делает tools/tutor-eyes-make.js) против эталона.
   bad — подсажена ошибка (точка смещена): попадание, если глаза назвали эту точку (и проекцию); ok — верный лист: находок быть не должно */
async function eyes(key){ const LLM=require(ROOT+'/server/lib/tutor/llm'), PR=require(ROOT+'/server/lib/tutor/prompts'), T=require(ROOT+'/server/lib/tutor/tools');
  const DIR=ROOT+'/server/test/tutor-eyes', CS=JSON.parse(fs.readFileSync(DIR+'/cases.json','utf8')).cases, cfg=TUTOR.fromEnv({PROXYAPI_KEY:key}), m=cfg.eyes;
  const img=f=>'data:image/jpeg;base64,'+fs.readFileSync(DIR+'/'+f).toString('base64'); let hit=0, view=0, seen=0, clean=0, kop=0, sec=0, errs=0; const rows=[];
  for(const c of CS) for(const kind of ['bad','ok']){ const t0=Date.now(); let j=null, err=null;
    try{ const r=await LLM.chat({key},m,{messages:[{role:'system',content:/^ng/.test(c.dz)?PR.EYES_NG:PR.EYES},{role:'user',content:[{type:'text',text:'Вариант '+c.n+'.'},
        {type:'image_url',image_url:{url:img(c.id+'-'+kind+'.jpg')}},{type:'image_url',image_url:{url:img(c.id+'-ref.jpg')}}]}],max:4000,temperature:0,timeout:60000});
      kop+=LLM.kopecks(m.model,r.usage,cfg.rate); j=TUTOR.parseJson(r.message.content); if(!j) err='не JSON ('+r.finish+'): '+String(r.message.content).slice(0,160); }
    catch(e){ err=e.message; }
    sec+=(Date.now()-t0)/1000; if(err){ errs++; console.log('✖ eyes '+c.id+' '+kind+': '+err); continue; }
    const F=(j.findings||[]).map(f=>({p:f.point==null?null:T.ptKey(f.point),view:f.view,problem:f.problem}));
    if(kind==='bad'){ const h=F.filter(f=>f.p===c.point); if(h.length) hit++; if(F.length) seen++; if(h.some(f=>f.view===c.view)) view++;
      console.log((h.length?'✓':'✖')+' eyes '+c.id+' с ошибкой ('+c.point+', '+c.coord+' '+(c.mm>0?'+':'')+c.mm+' мм): '+F.map(f=>(f.p||'—')+'/'+f.view+': '+String(f.problem).slice(0,70)).join(' | ')); }
    else { if(!F.length) clean++; console.log((F.length?'△':'✓')+' eyes '+c.id+' верный: '+(F.length?F.map(f=>(f.p||'—')+'/'+f.view+': '+String(f.problem).slice(0,70)).join(' | '):'находок нет')); }
    rows.push({id:c.id,kind,findings:F,overall:j.overall}); }
  const n=CS.length; console.log('\nГлаза: на листе с ошибкой что-то не так — '+seen+' из '+n+'; названа причина (подсаженная точка) — '+hit+' (на той же проекции — '+view+'); верный лист без находок — '+clean+' из '+n+'; сбоев '+errs+'; в среднем '+(sec/Math.max(1,2*n)).toFixed(1)+' с и '+(kop/100/Math.max(1,2*n)).toFixed(2)+' ₽ за фото');
  return {seen,hit,view,clean,n,errs,rows}; }

async function main(){ const key=process.env.PROXYAPI_KEY; if(!key){ console.log('Замер наставника пропущен: нет PROXYAPI_KEY.'); return 0; }
  if(arg('only')==='eyes'){ const r=await eyes(key); if(arg('json')) fs.writeFileSync(arg('json'),JSON.stringify(r,null,1)); return r.errs?1:0; }
  const env={PROXYAPI_KEY:key,TUTOR_USER_DAY_RUB:'1000',TUTOR_DAY_RUB:'5000',TUTOR_CACHE:process.argv.includes('--no-cache')?'off':''}; if(arg('model')) env.TUTOR_MODEL=arg('model');
  const only=arg('only')?arg('only').split(','):null, cases=SET.cases.filter(c=>!only||only.includes(c.id));
  const store=memoryStore(null), SITE='https://nachert1830.ru';
  const cfg={dev:true,origin:SITE,secure:false,botToken:'1:x',botName:'b',webhookSecret:'s',adminTg:['1'],mainUrl:SITE,week1:'',yandex:{clientId:'',secret:''},adminYa:[],fronts:[SITE],frontUrl:SITE+'/lk/',openSignup:true,tutor:TUTOR.fromEnv(env)};
  const app=createApp({cfg,store,log:{log(){},error:(...a)=>console.error('  ⚠',...a)},bot:botClient({dev:true,outbox:[]})});
  const call=async(tok,method,p,b)=>{ const r=await app.handle({method,path:p.split('?')[0],query:Object.fromEntries(new URLSearchParams(p.split('?')[1]||'')),headers:{origin:SITE,'content-type':'application/json',authorization:'Bearer '+tok},body:b?JSON.stringify(b):'',ip:'127.0.0.1',cookies:{}}); return {status:r.statusCode,data:JSON.parse(r.body||'{}')}; };
  async function student(i){ const act=await app.onUpdate({message:{from:{id:5000+i,first_name:'Студент'},chat:{id:5000+i},text:'/start login'}}), t=act.reply_markup.inline_keyboard[0][0].url.split('#/tg/')[1];
    const r=await app.handle({method:'POST',path:'/api/auth/bot/redeem',query:{},headers:{origin:SITE,'content-type':'application/json'},body:JSON.stringify({token:t,confirm:true,consent:{terms:true,pd:true}}),ip:'127.0.0.1',cookies:{}});
    const tok=JSON.parse(r.body).session; await call(tok,'POST','/api/me/profile',{ai:true}); return tok; }
  const rows=[]; let i=0;
  for(const c of cases){ const tok=await student(++i); const dz=c.dz||'ig4', vn=dz==='gen'?0:c.n; if(c.mode) await call(tok,'POST','/api/tutor/mode',{dz,n:c.n,mode:c.mode});
    let last=null, err=null; const turns=[];
    for(const text of c.turns){ const t0=Date.now(), r=await call(tok,'POST','/api/tutor/chat',{dz,n:dz==='gen'?undefined:c.n,step:c.step,text,page:c.page,sel:c.sel});
      if(r.status!==200){ err=r.status+' '+(r.data.error||''); break; } last=r.data; turns.push({ms:Date.now()-t0,rub:r.data.rub,verified:r.data.verified}); }
    const logs=(await store.scan('tutorlog')).filter(l=>l.n===vn&&(l.dz||'ig4')===dz).sort((a,b)=>a.ts-b.ts), tools=[...new Set(logs.slice(-c.turns.length).flatMap(l=>l.tools||[]))];
    const lastLog=logs[logs.length-1]||{}; await store.scan('tutorlog').then(L=>Promise.all(L.map(l=>store.del('tutorlog',l.id))));
    const e=c.expect||{}, chk={}, txt=last?last.reply:'';
    if(!err){
      chk.verifyFirst=!!(lastLog.verify&&lastLog.verify.first);
      if(e.show){ const a=(last.actions||[]).find(x=>x.t==='show'); chk.show=!!a&&a.step===e.show; }
      if(e.points){ const a=(last.actions||[]).find(x=>x.t==='show'); chk.points=!!a&&a.points.length>0; }
      if(e.tools) chk.tools=e.tools.some(t=>tools.includes(t));
      if(e.must) chk.must=e.must.every(r=>new RegExp(r,'i').test(txt));
      if(e.mustNot) chk.mustNot=!e.mustNot.some(r=>new RegExp(r,'i').test(txt));
      if(e.ask) chk.ask=(last.actions||[]).some(x=>x.t==='ask');
      if(e.open) chk.open=(last.actions||[]).some(x=>x.t==='open'&&(e.open===true||x.href===e.open)); }
    const ms=turns.reduce((s,t)=>s+t.ms,0)/Math.max(1,turns.length), rub=turns.reduce((s,t)=>s+(t.rub||0),0);
    const tk=logs.slice(-c.turns.length).reduce((a,l)=>{ const t=l.tokens||{}; a.in+=t.in||0; a.cached+=t.cached||0; a.out+=t.out||0; a.rounds+=l.rounds||0; return a; },{in:0,cached:0,out:0,rounds:0});
    rows.push({id:c.id,dz,n:c.n,err,chk,ms,rub,tk,tools,model:last&&last.model,reply:txt,cut:lastLog.verify&&lastLog.verify.violations});
    console.log((err?'✖':Object.values(chk).every(Boolean)?'✓':'△')+' '+c.id.padEnd(15)+' '+(err||Object.entries(chk).map(([k,v])=>(v?'+':'−')+k).join(' '))+
      '  '+(ms/1000).toFixed(1)+' с  '+rub.toFixed(2)+' ₽  круги '+tk.rounds+', токены '+tk.in+' (кэш '+tk.cached+') → '+tk.out+'  ['+tools.join(', ')+']\n    '+String(txt).replace(/\n/g,' ').slice(0,220)); }
  /* итог */
  const ok=rows.filter(r=>!r.err), rate=k=>{ const L=ok.filter(r=>k in r.chk); return L.length?L.filter(r=>r.chk[k]).length/L.length:1; };
  const mustL=ok.flatMap(r=>['must','mustNot','tools','ask','points','open'].filter(k=>k in r.chk).map(k=>r.chk[k]));
  const S={cases:rows.length,errors:rows.length-ok.length,verifyFirst:rate('verifyFirst'),showOk:(()=>{ const L=ok.filter(r=>'show' in r.chk); return L.length?L.filter(r=>r.chk.show).length/L.length:1; })(),
    mustOk:mustL.length?mustL.filter(Boolean).length/mustL.length:1,avgSec:ok.reduce((s,r)=>s+r.ms,0)/Math.max(1,ok.length)/1000,avgRub:ok.reduce((s,r)=>s+r.rub,0)/Math.max(1,ok.reduce((s,r)=>s+(SET.cases.find(c=>c.id===r.id).turns.length),0))};
  const TK=ok.reduce((a,r)=>{ a.in+=r.tk.in; a.cached+=r.tk.cached; a.rounds+=r.tk.rounds; return a; },{in:0,cached:0,rounds:0}); S.cachedShare=TK.in?TK.cached/TK.in:0; S.rounds=TK.rounds/Math.max(1,ok.length);
  const N=SET.norms, fails=[];
  if(S.errors) fails.push('сбоев '+S.errors); if(S.verifyFirst<N.verifyFirst) fails.push('сверка с первого раза '+Math.round(S.verifyFirst*100)+' % < '+N.verifyFirst*100+' %');
  if(S.showOk<N.showOk) fails.push('нужный шаг показан '+Math.round(S.showOk*100)+' %'); if(S.mustOk<N.mustOk) fails.push('ожидания по ответу '+Math.round(S.mustOk*100)+' %');
  if(S.avgSec>N.avgSec) fails.push('время '+S.avgSec.toFixed(1)+' с'); if(S.avgRub>N.avgRub) fails.push('цена реплики '+S.avgRub.toFixed(2)+' ₽');
  console.log('\nИтог: сценариев '+S.cases+', сбоев '+S.errors+'; сверка с первого раза '+Math.round(S.verifyFirst*100)+' %; шаг показан '+Math.round(S.showOk*100)+' %; ожидания '+Math.round(S.mustOk*100)+
    ' %; в среднем '+S.avgSec.toFixed(1)+' с и '+S.avgRub.toFixed(2)+' ₽ за реплику; кругов на сценарий '+S.rounds.toFixed(1)+', из кэша '+Math.round(S.cachedShare*100)+' % входа'+(fails.length?'\n✖ Ниже норм: '+fails.join('; '):'\n✓ В нормах.'));
  if(arg('json')) fs.writeFileSync(arg('json'),JSON.stringify({summary:S,norms:N,rows},null,1));
  return fails.length?1:0; }

main().then(code=>process.exit(code)).catch(e=>{ console.error(e); process.exit(1); });
