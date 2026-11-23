/* Наставник — ИИ-агент на чертеже (docs/TUTOR.md). Маршруты кабинета /api/tutor/* (вошедший студент) и
   /api/admin/tutor (владелец). Порог → память → агент (модель ⇄ инструменты над знаниями ядра) → сверщик → журнал.
   register(A, D, deps) — A: маршруты с сессией, D: админ; deps = {store, now, http, fail, body, json, limit, cfg, iamToken,
   askCreate(user, {text, src, where}) → id, log}. Таблицы: tutor (память студента по варианту), tutorlog (журнал вызовов). */
'use strict';
const P=require('./pack'), POL=require('./policy'), VF=require('./verify'), T=require('./tools'), A_=require('./agent'), LLM=require('./llm'), PR=require('./prompts');

const SONNET='anthropic/claude-sonnet-5-5', HAIKU='anthropic/claude-haiku-5-5';
function fromEnv(env){ env=env||process.env; const key=env.PROXYAPI_KEY||'', folder=env.YC_FOLDER_ID||env.EYES_FOLDER||'';
  const ru=env.TUTOR_RU_MODEL?{yandex:true,url:env.TUTOR_RU_URL||LLM.YA_URL,model:env.TUTOR_RU_MODEL.replace('{folder}',folder),folder}:null;
  const m=(v,d)=>({model:LLM.pxModel(v||d),url:env.TUTOR_URL||LLM.PX_URL});
  return {on:env.TUTOR!=='off'&&!!(key||ru),key,main:m(env.TUTOR_MODEL,SONNET),light:m(env.TUTOR_LIGHT_MODEL,HAIKU),eyes:m(env.TUTOR_EYES_MODEL,SONNET),ru,
    modeDefault:env.TUTOR_MODE_DEFAULT==='explain'?'explain':'coach',tools:env.TUTOR_TOOLS!=='off',cache:env.TUTOR_CACHE!=='off',dayRub:+env.TUTOR_DAY_RUB||1500,userDayRub:+env.TUTOR_USER_DAY_RUB||40,rate:+env.TUTOR_RATE||110}; }

const TEXT_MAX=2000, HIST=24, CTX_HIST=12, IMG_MAX=1600*1024, BODY_MAX=3.6*1024*1024, DEADLINE=45000, DAY=864e5;
const IMG_RE=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/]+=*$/;
const mskDay=t=>new Date(t+3*3600e3).toISOString().slice(0,10);
const cleanText=s=>String(s||'').replace(/\u0000/g,'').replace(/\r\n?/g,'\n').replace(/\n{4,}/g,'\n\n\n').trim().slice(0,TEXT_MAX);
const shortModel=m=>String(m||'').replace(/^anthropic\/claude-/,'').replace(/^gpt:\/\/[^/]+\//,'');

/* JSON из ответа глаз (модель иногда оборачивает в ```json … ```) */
function parseJson(t){ t=String(t||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,''); try{ return JSON.parse(t); }catch(e){}
  const a=t.indexOf('{'); for(let b=t.lastIndexOf('}');a>=0&&b>a;b=t.lastIndexOf('}',b-1)){ try{ return JSON.parse(t.slice(a,b+1)); }catch(e){} } return null; }

function register(A,D,deps){ const {store,now,fail,body,json,limit}=deps, cfg=()=>deps.cfg||{on:false};
  const memId=(u,dz,n)=>u+':'+dz+':'+n;
  function where(b,q){ const src=Object.assign({},q||{},b||{}), dz=String(src.dz||'ig4'), n=parseInt(src.n,10);
    if(!P.dzList.includes(dz)) fail(400,'Наставник пока работает в ДЗ №1–5 по начерту и ДЗ №3–6 по ИГ.');
    const v=P.variant(dz,n); if(!v) fail(400,'Нет такого варианта.'); return {dz,n,v}; }
  async function loadMem(S,dz,n){ const id=memId(S.user.id,dz,n), m=await store.get('tutor',id);
    return m||{id,userId:S.user.id,dz,n,msgs:[],asks:{},open:{},mistakes:{},notes:[],mode:cfg().modeDefault||'coach',photo:false,turns:0,kop:0,createdAt:now()}; }
  const consentAi=S=>!!(S.user.consent&&S.user.consent.ai);
  const kopKey=(who,t)=>'tutorkop:'+who+':'+mskDay(t);
  async function spent(who){ const r=await store.get('ratelimit',kopKey(who,now())); return r&&r.n||0; }
  async function spend(who,kop){ if(kop>0){ const t=now(); await store.incr('ratelimit',kopKey(who,t),'n',kop,{exp:t+2*DAY}); } }

  /* выжимка памяти для модели: где застревал, какие ошибки повторял */
  function memo(mem,dz){ const L=[], hard=Object.keys(mem.asks||{}).filter(k=>mem.asks[k]>=2).map(Number).sort((a,b)=>a-b);
    if(hard.length) L.push('много раз просил помощи на шагах '+hard.join(', '));
    const M=P.mistakes(dz,mem.n).mistakes, top=Object.entries(mem.mistakes||{}).sort((a,b)=>b[1]-a[1]).slice(0,3);
    top.forEach(([tag,c])=>{ const x=M.find(m=>m.tag===tag); L.push((x?x.text:'трудность')+(c>1?' (×'+c+')':'')); });
    (mem.notes||[]).slice(-3).forEach(n=>L.push('заметка: '+n));
    if(mem.photo) L.push('уже присылал фото своего листа');
    return L.join('; '); }
  /* факты, открытые студенту в прошлых репликах (шаги по глубине открытия) */
  function openFacts(mem,dz,n){ const f=[]; Object.keys(mem.open||{}).forEach(k=>{ const o=P.stepAt(dz,n,+k,POL.depthName(mem.open[k])); if(o) f.push(...T.factsOfStep(o)); });
    const ov=P.overview(dz,n); VF.numbersOf(ov.task,f); if(ov.note) VF.numbersOf(ov.note,f); return f; }
  const pubMsgs=mem=>(mem.msgs||[]).map(m=>({from:m.r==='u'?'u':'t',text:m.t,ts:m.ts,photo:!!m.ph,actions:m.act||[],id:m.id||null,verified:!!m.v,rate:m.rate==null?null:m.rate}));

  /* ── состояние окна ── */
  A['GET /api/tutor/state']=async(req,S)=>{ const c=cfg(), {dz,n,v}=where(null,req.query), mem=await loadMem(S,dz,n);
    return json(200,{on:!!c.on,consent:consentAi(S),ru:!!(c&&c.ru),mode:mem.mode,modeDefault:c.modeDefault||'coach',msgs:pubMsgs(mem),ladder:POL.ladder(mem,v.steps),
      left:Math.max(0,Math.round(((c.userDayRub||40)*100-await spent(S.user.id))/100))}); };
  A['POST /api/tutor/reset']=async(req,S)=>{ const {dz,n}=where(body(req)); await store.del('tutor',memId(S.user.id,dz,n)); return json(200,{ok:true}); };
  A['POST /api/tutor/mode']=async(req,S)=>{ const b=body(req), {dz,n,v}=where(b); if(!POL.MODES.includes(b.mode)) fail(400,'Режим: coach или explain.');
    const mem=await loadMem(S,dz,n); mem.mode=b.mode; mem.updatedAt=now(); await store.put('tutor',mem); return json(200,{mode:mem.mode,ladder:POL.ladder(mem,v.steps)}); };
  A['POST /api/tutor/rate']=async(req,S)=>{ const b=body(req), id=String(b.id||''), l=await store.get('tutorlog',id);
    if(!l||l.userId!==S.user.id) fail(404,'Нет такого ответа.'); const good=b.good===true?1:b.good===false?0:null;
    await store.update('tutorlog',id,{rate:good});
    const mem=await store.get('tutor',memId(S.user.id,l.dz,l.n)); if(mem){ const m=(mem.msgs||[]).find(x=>x.id===id); if(m){ m.rate=good; await store.update('tutor',mem.id,{msgs:mem.msgs}); } }
    return json(200,{ok:true}); };

  /* ── реплика ── */
  A['POST /api/tutor/chat']=async(req,S)=>{ const c=cfg(); if(!c.on) fail(503,'Наставник пока не подключён.');
    const b=body(req,BODY_MAX), {dz,n,v}=where(b), text=cleanText(b.text), uid=S.user.id, t0=Date.now();
    const photo=b.photo?String(b.photo):'', ref=b.ref?String(b.ref):'';
    if(photo&&(photo.length>IMG_MAX||!IMG_RE.test(photo))) fail(400,'Фото не подошло: нужен снимок JPEG до 1,2 МБ (сайт сжимает сам).');
    if(ref&&(ref.length>IMG_MAX||!IMG_RE.test(ref))) fail(400,'Эталон не подошёл.');
    if(!text&&!photo) fail(400,'Напиши вопрос или пришли фото листа.');
    /* согласие на зарубежную модель; без него — российская модель (без инструментов и без фото) */
    const foreign=consentAi(S)&&!!c.key, ru=!foreign&&c.ru?c.ru:null;
    if(!foreign&&!ru) fail(403,'Наставник работает на зарубежной модели (Claude). Чтобы начать, отметь согласие на отправку текста вопроса и фото листа — без имени и других данных о тебе.',{needAiConsent:true});
    if(photo&&!foreign) fail(403,'Фото листа смотрит зарубежная модель — нужна отметка согласия.',{needAiConsent:true});
    await limit('tutor',uid,30,3600); await limit('tutord',uid,120,86400); if(photo) await limit('tutorph',uid,12,86400);
    const [mine,all]=await Promise.all([spent(uid),spent('all')]);
    if(mine>=c.userDayRub*100) fail(429,'На сегодня лимит наставника исчерпан — продолжим завтра. Если срочно — спроси автора.',{budget:true});
    if(all>=c.dayRub*100) fail(503,'Наставник отдыхает до завтра: сегодня с ним занималось много студентов. Если срочно — спроси автора.',{budget:true});
    const mem=await loadMem(S,dz,n); if(POL.MODES.includes(b.mode)) mem.mode=b.mode;
    const step=Math.max(0,Math.min(v.steps.length,parseInt(b.step,10)||0))||null;
    if(photo) mem.photo=true;   /* фото — попытка: лесенка открывает на ступень больше */
    const turn={asked:new Set(),facts:[],actions:[],tools:[],notes:0,eyesKop:0}, before=openFacts(mem,dz,n);
    const llm={http:deps.http,key:c.key,token:deps.iamToken};
    const ctx={dz,n,mem,turn,step,photo:!!photo,
      see:photo?async focus=>{ if(!ref) throw new Error('нет эталона для сравнения — обнови страницу');
        const left=t0+DEADLINE-Date.now(); if(left<8000) throw new Error('не хватило времени');
        const r=await LLM.chat(llm,c.eyes,{messages:[{role:'system',content:P.isNg(dz)?PR.EYES_NG:PR.EYES},{role:'user',content:[{type:'text',text:'Вариант '+n+'.'+(focus?' Особенно: '+focus:'')},
          {type:'image_url',image_url:{url:photo}},{type:'image_url',image_url:{url:ref}}]}],max:4000,temperature:0,timeout:Math.min(30000,left-3000)});
        turn.eyesKop+=LLM.kopecks(c.eyes.model,r.usage,c.rate); const j=parseJson(r.message.content); if(!j) throw new Error('глаза ответили не по формату'); return j; }:null,
      askAuthor:deps.askCreate?s=>deps.askCreate(S.user,{text:'Вопрос от наставника ('+P.courseLabel(dz)+', вариант '+n+(step?', шаг '+step:'')+'):\n'+s,src:'#/'+dz+'/'+n,where:P.courseLabel(dz)+' · вариант '+n}):null};
    /* без инструментов (российская модель): открытое по текущему шагу — прямо в карточку */
    let inline=''; const bare=!!ru||c.tools===false;   /* «без рук»: российская модель или TUTOR_TOOLS=off */
    if(bare){ const k=step||mem.last||1; POL.ask(mem,turn,k); const d=POL.allowed(mem,k), o=P.stepAt(dz,n,k,POL.depthName(d)); POL.open(mem,k,d); turn.facts.push(...T.factsOfStep(o));
      if(d>=2) turn.actions.push(T.showAction(dz,n,k,d>=3?(o.points||[]).map(p=>p.n):[]));   /* без рук наставник всё равно показывает шаг */
      inline='Шаг '+o.k+' «'+o.title+'»'+(o.idea?'\nИдея: '+o.idea:'')+(o.short?'\nЧто делать: '+o.short:'')+(o.more?'\nПодробно: '+o.more:''); }
    const system=PR.SYSTEM+'\n\n'+PR.card({overview:P.overview(dz,n),ng:P.isNg(dz),mode:mem.mode,step,memo:memo(mem,dz),photo:!!photo,inline});
    const history=(mem.msgs||[]).slice(-CTX_HIST).map(m=>({role:m.r==='u'?'user':'assistant',content:m.t||(m.ph?'(фото листа)':'…')}));
    const messages=[{role:'system',content:system}].concat(history,[{role:'user',content:text||'Вот фото моего листа. Посмотри, что не так.'}]);
    const R=P.registry(dz,n), quoted=VF.numbersOf(text);
    const vctx=()=>({points:new Set(R.keys()),steps:v.steps.length,facts:before.concat(turn.facts),quoted});
    ctx.vctx=vctx;   /* надписи на чертеже сверяются тем же сверщиком */
    const cheap=all>=0.8*c.dayRub*100, models=ru?[ru]:cheap?[c.light]:[c.main,c.light];
    let res; try{ res=await A_.run({models,llm,messages,tools:!bare,ctx,vctx,deadline:t0+DEADLINE,rate:c.rate,cache:!!c.cache,cacheSplit:PR.SYSTEM.length}); }
    catch(e){ if(!(e instanceof LLM.ModelError)) throw e; deps.log&&deps.log.error&&deps.log.error('наставник',e.message,e.fallback||'');
      await store.put('tutorlog',{id:new Date(now()).toISOString()+'#'+require('crypto').randomBytes(3).toString('hex'),userId:uid,dz,n,ts:now(),ms:Date.now()-t0,error:String(e.message).slice(0,200),fallback:e.fallback||null,kop:turn.eyesKop});
      await spend(uid,turn.eyesKop); await spend('all',turn.eyesKop);
      fail(e.status===402?503:e.status===504?504:502,e.status===504?'Наставник не успел ответить — спроси ещё раз, покороче.':'Наставник сейчас не может ответить. Попробуй через минуту или спроси автора.'); }
    const kop=res.kop+turn.eyesKop, t=now(), id=new Date(t).toISOString()+'#'+require('crypto').randomBytes(3).toString('hex');
    const show=turn.actions.find(a=>a.t==='show'); if(show) mem.last=show.step; else if(step) mem.last=step;
    const verified=!!(res.verify.first||res.verify.repaired&&!res.verify.cut);
    mem.msgs=(mem.msgs||[]).concat([{r:'u',t:text,ph:photo?1:0,ts:t},{r:'a',t:res.text,ts:t,act:turn.actions,id,v:verified?1:0}]).slice(-HIST);
    mem.turns=(mem.turns||0)+1; mem.kop=(mem.kop||0)+kop; mem.updatedAt=t;
    await store.put('tutor',mem); await spend(uid,kop); await spend('all',kop);
    await store.put('tutorlog',{id,userId:uid,dz,n,ts:t,ms:Date.now()-t0,model:res.model,kop,rounds:res.rounds,tokens:res.tokens||null,tools:turn.tools,mode:mem.mode,photo:!!photo,ru:!!ru,
      verify:res.verify,fallback:res.fallback||null,rate:null});
    return json(200,{id,reply:res.text,actions:turn.actions,model:shortModel(res.model),mode:mem.mode,ladder:POL.ladder(mem,v.steps),
      verified,rub:Math.round(kop)/100,left:Math.max(0,Math.round((c.userDayRub*100-mine-kop)/100))}); };

  /* ── владельцу: как работает наставник ── */
  D['GET /api/admin/tutor']=async()=>{ const t=now(), logs=await store.scan('tutorlog',x=>x.ts>t-7*DAY), us=await store.scan('users'), U={}; us.forEach(u=>{ U[u.id]=u; });
    const td=mskDay(t), today=logs.filter(l=>mskDay(l.ts)===td), ok=logs.filter(l=>!l.error), sum=(L,f)=>L.reduce((s,x)=>s+(f(x)||0),0);
    const stat=L=>({turns:L.length,errors:L.filter(l=>l.error).length,rub:Math.round(sum(L,l=>l.kop))/100,users:new Set(L.map(l=>l.userId)).size,photos:L.filter(l=>l.photo).length});
    return json(200,{config:{on:!!cfg().on,model:shortModel(cfg().main&&cfg().main.model),light:shortModel(cfg().light&&cfg().light.model),ru:!!cfg().ru,mode:cfg().modeDefault,dayRub:cfg().dayRub,userDayRub:cfg().userDayRub},
      today:stat(today),week:stat(logs),
      verify:{first:ok.filter(l=>l.verify&&l.verify.first).length,repaired:ok.filter(l=>l.verify&&l.verify.repaired).length,cut:ok.filter(l=>l.verify&&l.verify.cut).length,total:ok.length},
      rate:{good:logs.filter(l=>l.rate===1).length,bad:logs.filter(l=>l.rate===0).length},
      ms:ok.length?Math.round(sum(ok,l=>l.ms)/ok.length):0,
      recent:logs.sort((a,b)=>b.ts-a.ts).slice(0,60).map(l=>({id:l.id,ts:l.ts,name:(U[l.userId]&&U[l.userId].name)||'удалён',dz:l.dz||'ig4',n:l.n,model:shortModel(l.model),ms:l.ms,rub:Math.round((l.kop||0))/100,
        tools:l.tools||[],verify:l.verify||null,rate:l.rate,error:l.error||null,photo:!!l.photo}))}); };
}

/* выгрузка и удаление своих данных */
async function exportOf(store,uid){ const [mems,logs]=await Promise.all([store.scan('tutor',x=>x.userId===uid),store.scan('tutorlog',x=>x.userId===uid)]);
  return {conversations:mems.map(m=>({dz:m.dz,variant:m.n,mode:m.mode,turns:m.turns,notes:m.notes||[],messages:(m.msgs||[]).map(x=>({from:x.r==='u'?'вы':'наставник',text:x.t,photo:!!x.ph,ts:x.ts}))})),
    calls:logs.map(l=>({ts:l.ts,dz:l.dz,variant:l.n,model:l.model||null,rub:Math.round(l.kop||0)/100,rate:l.rate==null?null:l.rate}))}; }
async function removeOf(store,uid){ for(const t of ['tutor','tutorlog']){ const all=await store.scan(t,x=>x.userId===uid); for(const x of all) await store.del(t,x.id); } }

module.exports={register,fromEnv,exportOf,removeOf,parseJson};
