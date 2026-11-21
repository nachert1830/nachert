#!/usr/bin/env node
/* База знаний ИИ-тренера: kb/kb.json и kb/README.md.  node tools/kb-dump.js && node tools/kb-build.js
   Собирает в один файл, без ручного текста:
   - site   — весь учебный текст сайта (kb/site.json из tools/kb-dump.js);
   - topics — программы подготовки: начерт (kernel/prep.js + ловушки и разбор «Смотри» из prep/*.js) и инжа (kernel/prep-ig.js);
   - dz     — методики ДЗ (dz/ng|ig/N/method.js): суть, идея, план по шагам с «почему», ответ, самопроверка, ошибки, вопросы защиты,
              оформление листа, и какие темы программы нужны к этому ДЗ. */
'use strict';
const fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..'), R=p=>require(path.join(ROOT,p));
global.self=global;
R('kernel/prep.js'); R('prep/engine.js'); ['x','x-b','t','base','sm','more','rest','space'].forEach(f=>R('prep/'+f+'.js'));
const NG=self.PREPROG, PT=self.PREP.TOPICS, IG=R('kernel/prep-ig.js'); self.PREPIG=IG; R('prep/ig-conj.js'); R('prep/ig-plane.js');
const clean=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const topics=[];
NG.ALL.forEach(t=>{ const p=PT[t.id]||{};
  topics.push({id:t.id,subj:'ng',block:NG.MODS.find(m=>m.id===t.mod).t,t:t.t,new:t.new,pre:t.pre,src:t.src,wb:t.wb,rk1:t.rk1,rk2:t.rk2,rk3:t.rk3?1:undefined,dz:t.dz,
    course:NG.OWNER[t.id],
    watch:p.watch&&p.watch.steps?p.watch.steps.map(s=>clean(s.cap)):undefined,
    traps:p.traps?Object.entries(p.traps).map(([k,v])=>({k,say:clean(v.say),src:v.src,b0:v.b0})):[]}); });
IG.ALL.forEach(t=>{ const p=PT[t.id], W=p&&p.watch; let watch; if(W){ try{ if(W.V) W.V.call(p); watch=(W.steps||[]).map(s=>clean(s.cap)); }catch(e){} }
  topics.push({id:t.id,subj:'ig',watch,block:IG.MODS.find(m=>m.id===t.mod).t,t:t.t,new:t.new,pre:t.pre,dz:t.dz,ng:t.ng,gost:t.gost,look:t.look,q:t.q,wb:t.wb,
  cq:(t.cq||[]).map(n=>({n,q:IG.CQ[n][0],a:IG.CQ[n][1]})),gt:(t.gt||[]).map(k=>({k,t:IG.GT[k]})),
  course:IG.OWNER[t.id],traps:t.traps.map(s=>({say:s}))}); });
const dz=[];
const load=(dir,id)=>{ const f=path.join(ROOT,dir,'method.js'); if(!fs.existsSync(f)) return; let m=null;
  global.DZR={def:(k,o)=>{ if(o.method) m=o.method; }}; delete require.cache[f]; require(f); if(!m) return;
  const subj=id.slice(0,2), need=subj==='ng'?NG.need(id):IG.need(id);
  dz.push({id,subj,essence:clean(m.essence),idea:clean(m.idea),
    types:Object.entries(m.types||{}).map(([k,v])=>({type:k,idea:clean(v.idea),plan:(v.plan||[]).map(s=>({t:clean(s.t),d:clean(s.d),why:clean(s.why)})),answer:clean(v.answer),check:(v.check||[]).map(clean)})),
    mistakes:(m.mistakes||[]).map(clean),defense:(m.defense||[]).map(x=>({q:clean(x.q),a:clean(x.a)})),sheet:(m.sheet||[]).map(clean),
    topics:[...need]}); };
[1,2,3,4,5].forEach(n=>load('dz/ng/'+n,'ng'+n)); [1,2,3,4,5,6].forEach(n=>load('dz/ig/'+n,'ig'+n));
const site=JSON.parse(fs.readFileSync(path.join(ROOT,'kb/site.json'),'utf8'));
/* ДЗ 1 инжи: варианты как построения — шаги с подписями и найденные центры (числа — из ядра) */
const K1=R('core/conj.js'), V1=R('dz/ig/1/variants.js'), T1=R('dz/ig/1/topics.js');
const ig1={variants:V1.list.map(n=>{ const V=V1.V[n], r=K1.run(V); return {n,title:V.title,note:V.note,ok:r.ok,
  ops:r.ops.map(o=>({name:o.name,title:o.title,O:o.O&&o.O.map(v=>+v.toFixed(3)),R:o.R,T:o.T.map(t=>t.map(v=>+v.toFixed(3))),steps:o.steps.map(s=>s.cap)}))}; }),
  topics:Object.fromEntries(T1.ids.map(id=>[id,{traps:Object.values(T1.T[id].traps).map(t=>t.say)}]))};
const igwb={questions:IG.CQ,tasks:IG.GT,courses:IG.COURSES.map(c=>({key:c.key,label:c.label,title:c.title,own:c.own,prev:c.prev}))};
const kb={igwb,ig1,about:'База знаний ИИ-тренера «Начерта». Собрана tools/kb-build.js из данных сайта; руками не править.',topics,dz,site};
fs.writeFileSync(path.join(ROOT,'kb/kb.json'),JSON.stringify(kb));
/* README со сводкой */
const n=(a,f)=>a.filter(f).length, cnt=(a,k)=>a.reduce((s,x)=>s+(x[k]||[]).length,0);
const ng=topics.filter(t=>t.subj==='ng'), ig=topics.filter(t=>t.subj==='ig');
const types={}; site.forEach(d=>{ const k=d.subj+' · '+d.type; types[k]=(types[k]||0)+1; });
const chars=JSON.stringify(kb).length;
const L=['# База знаний ИИ-тренера','',
 '> Собрана автоматически: `node tools/kb-dump.js && node tools/kb-build.js`. Руками не править — правь сайт и данные.','',
 `Объём: ${(chars/1e6).toFixed(1)} млн символов (\`kb/kb.json\`).`,'',
 '## Что внутри','','| Часть | Начерт | Инжа |','|---|---|---|',
 `| Темы программы подготовки | ${ng.length} | ${ig.length} |`,
 `| Ловушки (типичные ошибки по темам) | ${cnt(ng,'traps')} | ${cnt(ig,'traps')} |`,
 `| Разбор «Смотри» по шагам | ${cnt(ng,'watch')} шагов | ${cnt(ig,'watch')} шагов (темы на 3D-ядре — в браузере) |`,
 `| ДЗ с методикой | ${n(dz,d=>d.subj==='ng')} | ${n(dz,d=>d.subj==='ig')} |`,
 `| Шаги плана решения ДЗ (с «почему») | ${dz.filter(d=>d.subj==='ng').reduce((s,d)=>s+d.types.reduce((a,t)=>a+t.plan.length,0),0)} | ${dz.filter(d=>d.subj==='ig').reduce((s,d)=>s+d.types.reduce((a,t)=>a+t.plan.length,0),0)} |`,
 `| Ошибки в ДЗ | ${dz.filter(d=>d.subj==='ng').reduce((s,d)=>s+d.mistakes.length,0)} | ${dz.filter(d=>d.subj==='ig').reduce((s,d)=>s+d.mistakes.length,0)} |`,
 `| Вопросы защиты ДЗ с ответами | ${dz.filter(d=>d.subj==='ng').reduce((s,d)=>s+d.defense.length,0)} | ${dz.filter(d=>d.subj==='ig').reduce((s,d)=>s+d.defense.length,0)} |`,
 `| Документы сайта (уроки, задачи, теория, вопросы, разборы) | ${n(site,d=>d.subj==='ng')} | ${n(site,d=>d.subj==='ig')} |`,'',
 '## Документы сайта по типам','','| Предмет · тип | Документов |','|---|---|',...Object.entries(types).sort().map(([k,v])=>`| ${k} | ${v} |`),'',
 '## Структура `kb.json`','',
 '- `topics[]` — темы: `id`, `subj`, `block`, `t`, `new` (идея), `pre` (опора), `dz`, `course` (в каком мини-курсе), `traps[]`, у начерта — `watch[]`, `src`, `wb`, `rk1–3`; у инжи — `ng` (связь с начертом), `gost`, `look`, `q`.',
 '- `dz[]` — ДЗ: `essence`, `idea`, `types[].plan[]{t,d,why}`, `answer`, `check[]`, `mistakes[]`, `defense[]{q,a}`, `sheet[]`, `topics[]` (что нужно знать).',
 '- `site[]` — документы сайта: `key`, `type`, `subj`, `title`, `where`, `href`, `text[]`, `err` (ошибки из текста), `kw`, `sym`.','',
 '## Граф знаний с сертификатами (`kb/graph.json`)','',
 'Те же темы, ловушки и ДЗ 1 по инже — как граф с адресацией по содержимому: id узла — хеш его содержимого и id всего, на что он',
 'опирается; у фактов — сертификат ядра. `node tools/kb-graph.js` собирает, `--verify` заново исполняет ядро и сверяет каждый факт',
 'и корневой хеш. Тренер ссылается только на id узлов: подделанный или устаревший факт не пройдёт проверку.','',
 '## Чего в базе пока нет','',
 `- ДЗ 1 по инже (сопряжения): ${ig1.variants.length} вариантов из 30 — построения по шагам с числами ядра (\`ig1\`); остальные ждём.`,
 '- Задание №2 по инже — методики в формате `method.js` нет, в базу попали только описание и варианты из поискового индекса.',
 '- РК3 и экзамен — материалов нет.',
 '- Пошаговые данные для тренера (факты, секреты, лестница подсказок для каждого шага варианта) — следующий этап.'];
fs.writeFileSync(path.join(ROOT,'kb/README.md'),L.join('\n')+'\n');
console.log(L.slice(4,16).join('\n'));
