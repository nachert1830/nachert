/* ═══════════ Полная проверка сайта перед публикацией ═══════════
   node tests/run.js                 — всё; блоки — параллельно на нескольких страницах браузера (--jobs=K, по умолчанию по числу ядер, не больше 4)
   node tests/run.js --quick         — быстрая: без обхода всех страниц и без мутаций кода, варианты — выборкой
   node tests/run.js --only=rkp,me   — только эти блоки (какие задеты правкой — node tests/impact.js; список блоков — GROUPS ниже)
   Потоки CI (.github/workflows/check.yml): node tests/shards.js раскладывает работу по потокам по замеренному времени
   (tests/timings.json); поток выполняет свою часть — node tests/run.js --items=…/--plan=plan.json --shard=i --out=part.json,
   итог считает node tests/run.js --merge=папка --plan=plan.json (пороги, отчёт, код выхода, замеры времени).
   Тяжёлые блоки состоят из элементов (блок задач, ДЗ, набор листов…): элементы можно выполнять в разных потоках,
   итог блока собирается из них в том же порядке — результат тот же, что у последовательного прогона.
   --timings=файл — записать замеры времени блоков и элементов (после полной проверки main — tests/timings.json).
   Код выхода 0 — ошибок нет; 1 — есть новые ошибки (их список выводится); 2 — сбой самой проверки.
   Уже разобранные вручную случаи лежат в tests/baseline.json вместе с объяснением, почему это не ошибка. */
const http=require('http'), fs=require('fs'), path=require('path'), os=require('os');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..'), ARGV=process.argv.slice(2), QUICK=ARGV.includes('--quick');
const arg=k=>{ const a=ARGV.find(x=>x.startsWith('--'+k+'=')); return a==null?null:a.slice(k.length+3); };
/* блоки проверки: --only=a,b — только они (выборочная проверка Цеха и PR; полная — на main после слияния). smoke — главная открывается без ошибок JS */
const GROUPS=['smoke','core','dzvar','variants','prov','cert','adequacy','random','gym','rk2','rkp','live','rkg','ig4','igs','normo','points','ng3','track','lk','me','print','colors','ask','theory','crawl'];
const ONLY=(a=>a?new Set(a.split(',').map(x=>x.trim()).filter(Boolean)):null)(arg('only'));
if(require.main===module&&ONLY){ const bad=[...ONLY].filter(g=>!GROUPS.includes(g)); if(bad.length){ console.error('Нет таких блоков: '+bad.join(', ')+'. Есть: '+GROUPS.join(', ')); process.exit(2); } }
const JSONOUT=arg('json')||'', TIMINGS=arg('timings')||'';
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.txt':'text/plain'};
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline.json'),'utf8')).accepted.map(a=>a.key);
const T=f=>fs.readFileSync(path.join(__dirname,f+'.js'),'utf8');
const VIEW={phone:{width:390,height:844}};

function serve(){ return new Promise(res=>{ const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end('нет'); }
    r.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(srv)); }); }

/* страница сайта готова: роутер отрисовал адрес, документ и шрифты загружены (вместо фиксированной паузы 1,2–1,5 с) */
const ready=require('./ready.js');

/* ═══ блоки: els(QUICK) — элементы; el(c, ключ) — выполнить элемент (c.info/c.fail/c.report/c.M, возврат — данные для finish);
       finish(c, данные по ключам) — итог блока из всех элементов (пороги, отчёт). Без els — один элемент '*'. ═══ */
const B={};
B.smoke={el:async c=>{ const p=await c.page('main'); if(p.__errs.length) c.fail('Главная · ошибка JS при открытии · '+p.__errs[0].slice(0,200)); }};

/* 1–3. чертежи: 3D-проверка, отрисовка, мутации; оракул; «Евклид», арифметика, ДЗ-оракул */
const CORE_JS=['geometry','render','mutate','oracle','euclid','arith','dz'];
const corePage=async c=>{ const p=await c.page('core'); if(!p.__core){ for(const f of CORE_JS) await p.addScriptTag({content:T(f)}); p.__core=1; } return p; };
B.core={els:()=>['geom','render','mutate','sizes','oracle','omut','euclid','arith','dz'], el:async(c,k)=>{ const p=await corePage(c);
  if(k==='geom') return {r:await p.evaluate(()=>GEOM_CHECK())};
  if(k==='render') return {r:await p.evaluate(()=>RENDER_CHECK())};
  if(k==='mutate') return {r:await p.evaluate(()=>MUTATE_CHECK({n:450,seed:11}))};
  if(k==='sizes') return {r:await p.evaluate(()=>MUTATE_SIZES())};
  if(k==='oracle') return {r:await p.evaluate(()=>ORACLE_CHECK())};
  if(k==='omut') return {r:await p.evaluate(()=>ORACLE_MUTATE({per:4,seed:7})), specs:await p.evaluate(()=>ORACLE_SPECS.length)};
  if(k==='euclid') return {r:await p.evaluate(()=>EUCLID_CHECK()), n:await p.evaluate(()=>WB3.tasks.filter(t=>!EUCLID_TODO.includes(t.n)).length), todo:await p.evaluate(()=>EUCLID_TODO.join(', №'))};
  if(k==='arith') return {r:await p.evaluate(()=>ARITH_CHECK())};
  if(k==='dz') return {r:await p.evaluate(()=>DZ_CHECK())}; },
 finish:(c,D)=>{ const {info,fail,M}=c;
  c.report('Чертежи (3D-модель)',D.geom.r); c.report('Отрисовка (подписи)',D.render.r);
  const mut=D.mutate.r; Object.entries(mut).forEach(([k,v])=>info('Мутации «'+k+'»: поймано '+v.поймано+' из '+v.всего)); M.mutate=mut;
  const ml=mut['линия связи'], ms=mut['подписи местами'];
  if(ml&&ml.поймано/ml.всего<0.95) fail('Проверка ослабла: разрыв линии связи ловится в '+Math.round(100*ml.поймано/ml.всего)+'% случаев');
  if(ms&&ms.поймано/ms.всего<0.93) fail('Проверка ослабла: перепутанные подписи ловятся в '+Math.round(100*ms.поймано/ms.всего)+'% случаев');
  const msz=D.sizes.r; M.sizes={caught:msz.поймано,total:msz.всего}; info('Числа на чертежах (перебор): поймано '+msz.поймано+' из '+msz.всего+(msz.пропуски.length?' — пропуски: '+msz.пропуски.slice(0,5).join('; '):''));
  if(msz.поймано/msz.всего<0.95) fail('Проверка ослабла: неверное число на чертеже ловится в '+Math.round(100*msz.поймано/msz.всего)+'% случаев');
  c.report('Оракул (ответы задач)',D.oracle.r);
  const om=D.omut.r; M.answer={geom:om.геометрия,oracle:om.сОракулом,total:om.всего}; info('Сдвиг точки ответа: ловит 3D-проверка '+om.геометрия+' из '+om.всего+', вместе с оракулом '+om.сОракулом+' из '+om.всего+' (задач с оракулом: '+D.omut.specs+')');
  if(om.сОракулом/om.всего<0.85) fail('Оракул ослаб: ловит '+Math.round(100*om.сОракулом/om.всего)+'% сдвигов ответа');
  c.report('Построимость («Евклид»)',D.euclid.r);
  info('«Евклид»: проверено задач '+D.euclid.n+' из 89 и ДЗ №2 (2а–2в), №3'+(D.euclid.todo?'; кривые поверхности — в работе: №'+D.euclid.todo:''));
  c.report('Арифметика в тексте',D.arith.r); c.report('ДЗ-оракул (ДЗ №2, №3)',D.dz.r); }};

/* 3б+. ДЗ №2 и №3 на случайных вариантах; мутации кода ДЗ */
const dzPage=async c=>{ const p=await c.page('dzvar'); if(!p.__dz){ for(const f of ['geometry','euclid','arith','dz']) await p.addScriptTag({content:T(f)}); p.__dz=1; } return p; };
B.dzvar={els:q=>q?['var']:['var','mut'], el:async(c,k)=>{ const p=await dzPage(c), DR=require('./dz-run.js');
  if(k==='var'){ const N=QUICK?10:40, v=await DR.runDzVariants(p,N);
    c.M.dzVar={n:N,checked:v.checked,skipped:v.skipped,bad:Object.keys(v.bad).length}; c.info('ДЗ №2 и №3 на случайных вариантах: '+N+' × 4 разбора, проверено '+v.checked+', вырожденных отброшено '+v.skipped);
    Object.entries(v.bad).forEach(([k,list])=>c.fail('ДЗ, случайные варианты · '+k+': '+list.length+' вар. — '+list[0])); }
  else { const m=await DR.runDzMutations(p,{per:12}), t=m.by['всего']||{n:0,geo:0,all:0};
    c.M.dzMut=m; c.info('ДЗ, мутации кода: 3D-проверка ловит '+t.geo+' из '+t.n+', с ДЗ-оракулом, «Евклидом» и арифметикой — '+t.all+' из '+t.n);
    if(t.n&&t.all/t.n<0.85) c.fail('Проверка ДЗ ослабла: мутации кода ДЗ ловятся в '+Math.round(100*t.all/t.n)+'% случаев'); } }};

/* 3б″. все варианты заданий (dz/): решатели строят разбор каждого, и он проходит те же проверки, что примеры. Элемент — ДЗ */
const VAR_IDS=()=>fs.readdirSync(path.join(ROOT,'dz/ng')).filter(d=>/^\d+$/.test(d)).sort((a,b)=>a-b).map(d=>'ng'+d);
B.variants={els:()=>VAR_IDS(), el:async(c,k)=>{ const VR=require('./variants-run.js'), p=await c.page('variants'); if(!p.__v){ await VR.loadAll(p); p.__v=1; }
  /* какие ДЗ реестр отдаёт на проверку вариантов (не ИГ — их проверяет normo-run): все они должны быть элементами */
  const ids=await p.evaluate(()=>DZR.list().map(d=>d.id).filter(d=>!DZR.get(d).part&&DZR.numbers(d).length));
  if(!ids.includes(k)) return {checked:0,list:[],ids};
  return Object.assign(await VR.runVariants(p,{only:[k]}),{ids}); },
 finish:(c,D)=>{ const VR=require('./variants-run.js'); let checked=0, list=VR.dataCheck();
  /* ДЗ, которые реестр знает, а элементы не покрыли, — ошибка раскладки */
  VAR_IDS().forEach(k=>{ checked+=D[k].checked; list=list.concat(D[k].list); });
  const reg=D[VAR_IDS()[0]].ids.filter(id=>!VAR_IDS().includes(id)); if(reg.length) c.fail('Варианты ДЗ · раскладка: ДЗ '+reg.join(', ')+' есть в реестре, но не проверяются (добавь элемент в VAR_IDS)');
  const bad=VR.fresh(list); c.M.variants={checked,remarks:list.length,fresh:bad.length};
  c.info('Варианты ДЗ (ядро): построено и проверено '+checked+', замечаний '+list.length+' (разобранных вручную: '+(list.length-bad.length)+')');
  bad.forEach(o=>c.fail('Варианты ДЗ · '+o.name+' · '+o.rule+' — '+String(o.msg).slice(0,200))); }};

/* 3б′. трассировка происхождения */
B.prov={el:async c=>{ const p=await c.page('prov'); const {issues,stats}=await require('./provenance-run.js').runProvenance(p);
  c.info('Происхождение: прослежено точек '+stats.traced+' из '+stats.pts+', отрезков '+stats.segTraced+' из '+stats.segs); c.report('Происхождение точек',issues); }};

/* 3б″. сертификаты (tests/certified). Элемент — задача */
const CERT_N=()=>require('./certified/run.js').TASKS.map(t=>'n'+t.n);
B.cert={els:()=>CERT_N(), el:async(c,k)=>{ const p=await c.page('cert'), CR=require('./certified/run.js'), Tk=CR.TASKS.find(t=>'n'+t.n===k);
  const {certify}=require('./certified/certify.js'); const r=certify(Tk,{site:await CR.siteData(p,Tk.n),variants:QUICK?50:200}); return {n:r.n,ok:r.ok,O:r.O}; },
 finish:(c,D)=>{ const certs=CERT_N().map(k=>D[k]);
  certs.forEach(x=>{ if(!x.ok) Object.entries(x.O).filter(([k,o])=>!o.ok).forEach(([k,o])=>c.fail('Сертификат №'+x.n+' · '+k+': '+o.detail)); });
  c.info('Сертификаты: выдано '+certs.filter(x=>x.ok).length+' из '+certs.length+' (№'+certs.map(x=>x.n).join(', №')+')'); }};

/* 3б‴. проверка проверки на мутациях КОДА задач (O8). Элемент — блок задач; генератор случайных чисел проматывается, мутанты те же */
const ADQ=()=>require('./adequacy.js').adequacyBlocks().map(x=>x.key);
B.adequacy={els:q=>q?[]:ADQ(), el:async(c,k)=>{ const p=await c.page('adequacy'); return (await require('./adequacy.js').runAdequacy(p,{per:2,seed:5,elements:[k]})).blocks[k]; },
 finish:(c,D)=>{ const ad=require('./adequacy.js').mergeAdequacy(D), fh=ad.by['F↔H'], ct=ad.cby['всего'];
  c.M.code={by:ad.by,kinds:ad.kinds,total:ad.total,equiv:ad.equiv,crashed:ad.crashed,cert:ad.cby,survivors:ad.survivors};
  c.info('Мутации кода: поймано '+ad.by['всего'].all+' из '+ad.by['всего'].n+', с «Евклидом» и арифметикой — '+ad.by['всего'].euc+(fh?'; подмена поля F↔H — '+fh.all+' из '+fh.n:'')+(ct?'; в задачах с сертификатом — '+ct.cert+' из '+ct.n:''));
  ad.baseErr.forEach(e=>c.fail('Мутации кода · блок задач не выполняется без мутаций: '+e));
  if(fh&&fh.all/fh.n<0.75) c.fail('Проверка ослабла: подмена поля F↔H ловится в '+Math.round(100*fh.all/fh.n)+'% случаев');
  if(ct&&ct.cert/ct.n<0.85) c.fail('Сертификаты ослабли: в задачах с сертификатом ловится '+Math.round(100*ct.cert/ct.n)+'% мутаций'); }};

/* 3в. случайные варианты. Элемент — блок задач */
const RND=()=>require('./random-run.js').blockKeys();
B.random={els:()=>RND(), el:async(c,k)=>{ const p=await c.page('random'); return (await require('./random-run.js').runVariants(p,QUICK?10:30,{elements:[k]}))[0]||null; },
 finish:(c,D)=>{ const N=QUICK?10:30, res=RND().map(k=>D[k]).filter(Boolean), list=[]; let deg=0;
  res.forEach(b=>{ Object.entries(b.bad).forEach(([k,v])=>{ const [n,rule]=k.split('|'); list.push({name:n,rule:'вариант: '+rule,msg:v[0].msg.slice(0,160)+' ('+v.length+' из '+N+')'}); });
    (b.info||[]).forEach(x=>{ const m=/вырожденных вариантов (\d+)/.exec(x); if(m) deg+=+m[1]; }); });
  const still=res.reduce((a,b)=>a.concat(b.still||[]),[]);
  c.info('Случайные варианты: '+N+' на задачу, вырожденных (без решения) отброшено '+deg+'; данные не числами — только на своих данных: '+(still.join(', ')||'нет'));
  c.report('Случайные варианты',list); }};

/* 3г. тренажёр */
B.gym={el:async c=>{ const gp=await c.page('gym',{viewport:VIEW.phone});
  const ref=require('./random.js').blocks().map(b=>b.src.trim()), got=await gp.evaluate(()=>GEN.blocks().map(x=>x.trim()));
  const diff=ref.filter((b,i)=>b!==got[i]).length+Math.abs(ref.length-got.length);
  if(diff) c.fail('Тренажёр: разбор кода на сайте расходится с контрольным разбором в '+diff+' блоках');
  const el=await require('./gen-check.js').genEligibility(gp,12), cur=await gp.evaluate(()=>GEN.list());
  if(JSON.stringify(el.ok)!==JSON.stringify(cur)) c.fail('Тренажёр: список задач для генератора устарел. Вставь в GEN_OK: '+JSON.stringify(el.ok));
  const gy=await require('./gym.js').gymCheck(gp,c.URL,{all:!QUICK});
  c.info('Тренажёр: блоков задач '+got.length+' (совпадают с контрольным разбором), генератор — задач '+el.ok.length+', «найди ошибку» — '+gy.info.bug+', 3D к задачам — '+gy.info.t3);
  c.report('Тренажёр',gy.bad); }};

B.rk2={el:async c=>{ const p=await c.fresh({viewport:VIEW.phone}); c.report('РК2', await require('./rk2.js').rk2Check(p,c.URL)); }};
B.rkp={el:async c=>{ const p=await c.fresh({viewport:VIEW.phone}); c.report('РК2 за 9 шагов', await require('./rkp.js').rkpCheck(p,c.URL)); }};
B.live={el:async c=>{ const p=await c.fresh({viewport:{width:1600,height:900}}); c.report('Режим эфира', await require('./live.js').liveCheck(p,c.URL)); }};
B.rkg={el:async c=>{ const p=await c.fresh({viewport:VIEW.phone}); c.report('«Сдашь РК2?»', await require('./rkg.js').rkgCheck(p,c.URL)); }};
/* ДЗ 4 по ИГ: решение по шагам (выборка вариантов; все 30 — node tests/ig4-steps.js). Элемент — вариант */
const IG4N=q=>q?[7]:[1,7,13,18,24,30];
B.ig4={els:q=>IG4N(q).map(n=>'v'+n), el:async(c,k)=>{ const p=await c.fresh({viewport:{width:1400,height:1000}}); return require('./ig4-steps.js').ig4StepsCheck(p,c.URL,{only:[+k.slice(1)]}); },
 finish:(c,D)=>c.report('ДЗ 4: шаги',IG4N(QUICK).flatMap(n=>D['v'+n]))};
/* ДЗ 2 по ИГ: размеры на листах (IGS.checkAll по вариантам). Элемент — 5 вариантов */
B.igs={els:()=>[0,1,2,3,4,5].map(i=>'v'+(i*5+1)+'-'+(i*5+5)), el:async(c,k)=>{ const p=await c.page('main'), [a,b]=k.slice(1).split('-').map(Number);
  return p.evaluate(([a,b])=>{ if(!window.IGS) return []; const out=[]; for(let n=a;n<=b;n++) if(window.IG_DIMS&&IG_DIMS[n]) try{ out.push(...IGS.checkDims(n)); }catch(e){ out.push({name:'Вариант '+n,rule:'ошибка проверки',msg:String(e).slice(0,120)}); } return out; },[a,b]); },
 finish:(c,D)=>c.report('ИГ: размеры на листах',[0,1,2,3,4,5].flatMap(i=>D['v'+(i*5+1)+'-'+(i*5+5)]))};

/* 3д. нормоконтроль листов ИГ. Элементы — наборы листов (ДЗ 2, задания 3–8), проверка проверки, тренажёры */
const NSETS=['dz2','ig3','ig4','ig5','ig6','ig8'], IGSAMPLE=[1,7,13,18,24,30];
/* элементы листов: ДЗ 2 — по 5 вариантов и лист урока; задания 3–6 — по варианту выборки; задание 8 — целиком */
const SHEET_ELS=()=>[...[0,1,2,3,4,5].map(i=>'sheets:dz2:'+(i*5+1)+'-'+(i*5+5)),...['ig3','ig4','ig5','ig6'].flatMap(s=>IGSAMPLE.map(n=>'sheets:'+s+':'+n)),'sheets:ig8','sheets:dz2:lesson'];
B.normo={els:q=>[...SHEET_ELS(),'mut',...(q?[]:['wavy']),'read'], el:async(c,k)=>{ const NR=require('./normo-run.js'), NM=require('./normo-mutate.js');
  if(k.startsWith('sheets:')){ const p=await c.page('normo'), [,set,part]=k.split(':'), o={nomodel:QUICK,igSample:IGSAMPLE}; NSETS.forEach(s=>{ o[s]=s===set; });
    if(part==='lesson'){ o.only=[]; o.lesson=true; } else if(part&&part.includes('-')){ const [a,b]=part.split('-').map(Number); o.only=Array.from({length:b-a+1},(_,i)=>a+i); o.lesson=false; } else if(part) o.only=[+part];
    const nr=await NR.runNormo(p,o); return {issues:nr.issues.map(i=>({name:i.name,rule:i.rule,msg:i.msg})),stat:nr.stat}; }
  if(k==='mut'){ const p=await c.page('normo'), mu=await NM.runMutations(p,{per:QUICK?1:2});
    /* «Нормоконтроль» — на той же странице, где листы уже построены: на медленном раннере CI с холодного кэша лист не успевал построиться за 90 с */
    return {mu,nk:await NM.nkUi(p,c.URL)}; }
  if(k==='wavy'){ const p=await c.page('normo'); return NM.wavyMutations(p); }
  if(k==='read'){ /* «Читаю чертёж» — на свежей вкладке на переднем плане */
    const p=await c.fresh({viewport:VIEW.phone}); await p.bringToFront(); await p.goto(c.URL); await ready(p); return NM.readUi(p,c.URL); } },
 finish:(c,D)=>{ const {info,fail}=c; let sheets=0, ms=0, issues=[]; SHEET_ELS().forEach(k=>{ const x=D[k]; sheets+=x.stat.sheets; ms+=x.stat.ms; issues=issues.concat(x.issues); });
  info('Нормоконтроль ИГ: листов '+sheets+(QUICK?' (без сверки с моделью)':', виды сверены с 3D-моделью')+', '+Math.round(ms/1000)+' с');
  c.report('ИГ: нормоконтроль листов',issues);
  const mu=D.mut.mu, tot=Object.values(mu).reduce((a,x)=>[a[0]+x.поймано,a[1]+x.всего,a[2]+x.лишнее],[0,0,0]);
  info('Нормоконтроль, проверка проверки: поймано '+tot[0]+' из '+tot[1]+' подсаженных нарушений ('+Object.keys(mu).length+' типов тренажёра), лишних замечаний — '+tot[2]);
  Object.entries(mu).forEach(([t,x])=>{ if(!x.всего) fail('Тренажёр «Нормоконтроль»: нарушение «'+t+'» не подсаживается ни в один лист');
    else if(x.поймано<x.всего) fail('Нормоконтроль не ловит «'+t+'»: '+x.поймано+' из '+x.всего+' — '+x.пример);
    if(x.лишнее) fail('Нормоконтроль: подсадка «'+t+'» даёт лишние замечания — '+x.пример); });
  c.report('Тренажёр «Нормоконтроль»',D.mut.nk);
  if(!QUICK){ const wm=D.wavy; info('Сторона волнистой линии (ГОСТ 2.305): поймано '+wm.поймано+' из '+wm.всего+' подсаженных ошибок'+(wm.review.length?'; для проверки человеком: '+wm.review.join('; '):''));
    if(wm.поймано<wm.всего) fail('Нормоконтроль не ловит сторону волнистой линии: '+wm.пропуски.join(', ')); }
  c.report('Читаю чертёж',D.read); }};

/* 3ж. «Научись защищать точки» (#/ig/points) */
B.points={el:async c=>{ const tp=await c.fresh({viewport:VIEW.phone,hash:'#/ig/points'}); const te=tp.__errs;
  const out=await tp.evaluate(()=>{ const bad=[], J=IG3.jc(IG_VARS[5].tree), M={F:'″',T:'′',L:'‴'};
    IGL.PEX().forEach(E=>{ const name='точка '+E.n, j=J(...E.p); if(E.cutp?!(j<-0.05&&Math.abs(E.p[E.cutp==='L'?0:1])<1e-9):Math.abs(j)>0.05) bad.push({name,rule:E.cutp?'точка в штриховке: в материале, в секущей плоскости':'точка на поверхности',msg:'J = '+j.toFixed(3)});
      IGL.ptSVG(E,0); const got=['F','T','L'].map(v=>E.vis[v]).join('');
      if(got!==E.exp) bad.push({name,rule:'видимость в тексте = видимость по модели',msg:'текст: '+E.exp+', модель: '+got+' (v — видна, h — закрыта, r — убрана разрезом)'});
      E.s.forEach((s,i)=>{ const tx=(s.act.join(' ')+' '+(s.why||'')).replace(/<[^>]+>/g,'');
        if(new RegExp('\\('+E.n+'[″′‴]\\)').test(tx)) bad.push({name,rule:'видимость — отметкой, не скобками',msg:'шаг '+(i+1)});
        try{ const sv=IGL.ptSVG(E,i); if(!/<svg/.test(sv)||sv.indexOf(E.n+'')<0) bad.push({name,rule:'чертёж шага',msg:'шаг '+(i+1)+' пустой'}); }catch(e){ bad.push({name,rule:'чертёж шага',msg:'шаг '+(i+1)+': '+e}); } }); });
    /* видимость — сверка с эталонным лучом: шаг 0,01 мм, любой материал на пути к глазу — крестик (точки разбора и 300 случайных точек тренажёра) */
    const {stOn,imJ,PSF,PVD}=IGL.ptVis, ref=(p,n,v)=>{ const d=PVD[v], q=p.map((c,i)=>c+n[i]*.06); for(let s=0.01;s<200;s+=0.01) if(imJ(v,[q[0]+d[0]*s,q[1]+d[1]*s,q[2]+d[2]*s])<-1e-4) return 'h'; return 'v'; };
    const vchk=(p,n,tag)=>['F','T','L'].forEach(v=>{ const a=stOn(p,n,v); if(a!=='r'&&a!==ref(p,n,v)) bad.push({name:tag,rule:'видимость = эталонный луч',msg:v+' '+p.map(x=>x.toFixed(2)).join(', ')+': на сайте '+a}); });
    IGL.PEX().forEach(E=>vchk(E.p,E.nr,'точка '+E.n)); for(let i=0;i<300;i++){ const s=PSF[i%PSF.length], G=s.g(Math.random); if(!s.ok||s.ok(G.p)) vchk(G.p,G.n,'тренажёр: '+s.t); }
    /* у самого очерка конуса: на долю градуса за очерком точка уже за материалом — крестик, на долю градуса перед ним — видна */
    const rC=z=>40-(z-25)*10/95; [40,70,100].forEach(z=>[0.5,1,2,4].forEach(dg=>[1,-1].forEach(sg=>{ const r=rC(z), a=Math.PI-sg*dg*Math.PI/180, c=Math.cos(a), sn=Math.sin(a); vchk([r*c,r*sn,z],[c,sn,0.1],'конус у очерка'); })));
    return bad; });
  const cnt={ok:0,n:0,mir:0,sym:0};
  for(let t=0;t<18;t++){ const mode=t%3; await tp.click('#igpTrNext'); await tp.evaluate(()=>document.getElementById('igpTrPic').scrollIntoView({block:'center'}));
    const w=await tp.evaluate(mir=>{ const E=document.getElementById('igpTr').igpTask(), k=3, p=E.p, P={F:q=>[k*q[0],-k*q[2]],T:q=>[k*q[0],k*(84-q[1])],L:q=>[k*(168-q[1]),-k*q[2]]}, m=document.querySelector('#igpTrPic svg').getScreenCTM();
      return {y:p[1],t:E.sf.t+', дана '+E.v,vis:E.vis,views:['F','T','L'].filter(v=>v!==E.v),pts:['F','T','L'].filter(v=>v!==E.v).map(v=>{ const a=P[v](mir&&v!=='F'?[p[0],-p[1],p[2]]:p); return [m.a*a[0]+m.e,m.d*a[1]+m.f]; })}; },mode===1);
    for(const [x,y] of w.pts) await tp.mouse.click(x,y);
    for(let j=0;j<2;j++){ const v=w.views[j], right=w.vis[v]==='v'?'v':'h', s=mode===2&&j===0?(right==='v'?'h':'v'):right; await tp.click(`#igpTrVis button[data-vw="${v}"][data-s="${s}"]`); }
    await tp.click('#igpTrGo'); const res=await tp.evaluate(()=>document.getElementById('igpTrRes').textContent), yes=/Защищено/.test(res);
    if(mode===0){ cnt.n++; if(yes) cnt.ok++; else out.push({name:'тренажёр',rule:'верный ответ засчитан',msg:w.t+' — '+res.slice(0,140)}); }
    else if(mode===1){ if(Math.abs(w.y)>=1){ if(!yes) cnt.mir++; else out.push({name:'тренажёр',rule:'перёд и зад перепутаны — не засчитано',msg:w.t+' — '+res.slice(0,140)}); } }
    else { if(!yes) cnt.sym++; else out.push({name:'тренажёр',rule:'не та отметка видимости — не засчитано',msg:w.t+' — '+res.slice(0,140)}); } }
  te.forEach(e=>out.push({name:'#/ig/points',rule:'ошибка JS',msg:e.slice(0,200)}));
  c.info('Защита точек: '+out.length+' замечаний; тренажёр — верных засчитано '+cnt.ok+' из '+cnt.n+', перепутанных перёд/зад отклонено '+cnt.mir+', неверных отметок отклонено '+cnt.sym);
  c.report('ИГ: защита точек',out); }};

/* 3з. ДЗ №3, «Сверь свой лист»: таблица 30 вариантов задания */
B.ng3={el:async c=>{ const hp=await c.fresh({viewport:VIEW.phone,hash:'#/ng3/my'}); const he=hp.__errs;
  const out=await hp.evaluate(async()=>{ const bad=[], S=HWCHECK.SPEC['3'], V=S.vars, sub=(a,b)=>a.map((v,i)=>v-b[i]), dt=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], ln=a=>Math.sqrt(dt(a,a)), D=r=>r*180/Math.PI;
    const keys=Object.keys(V); if(keys.length!==30) bad.push({name:'ДЗ №3',rule:'30 вариантов',msg:'в таблице '+keys.length});
    const fmt=x=>String(Math.round(x*10)/10).replace('.',',');
    for(const n of keys){ const [A,B,C,Sv]=V[n], N=cr(sub(B,A),sub(C,A)), H=Math.abs(dt(sub(Sv,A),N))/ln(N);
      /* двугранный угол при AB — между перпендикулярами к ребру, опущенными из C и из S (полуплоскости граней) */
      const u=sub(B,A), e=u.map(v=>v/ln(u)), q=p=>{ const w=sub(p,A), t=dt(w,e); return sub(w,e.map(v=>v*t)); }, qc=q(C), qs=q(Sv), dih=D(Math.acos(dt(qc,qs)/ln(qc)/ln(qs))), phi=D(Math.asin(H/ln(sub(Sv,A))));
      const R=S.ans({A,B,C,S:Sv}); [['H',H],['dih',dih],['phi',phi],['AB',ln(sub(B,A))],['BC',ln(sub(C,B))],['CA',ln(sub(A,C))]].forEach(([k,x])=>{ if(Math.abs(R[k]-x)>0.05) bad.push({name:'ДЗ №3, вариант '+n,rule:'ответ '+k,msg:'на сайте '+R[k].toFixed(2)+', пересчёт '+x.toFixed(2)}); });
      if(H<5) bad.push({name:'ДЗ №3, вариант '+n,rule:'пирамида не вырождена',msg:'H = '+H.toFixed(1)});
      document.querySelector(`.hc-vb[data-vn="${n}"]`).click(); await new Promise(r=>setTimeout(r,20));
      const vals=['A','B','C','S'].flatMap(m=>[0,1,2].map(c=>+document.querySelector(`.hc-in[data-k="d:${m}:${c}"]`).value)), want=[A,B,C,Sv].flat();
      if(vals.join()!==want.join()) bad.push({name:'ДЗ №3, вариант '+n,rule:'данные подставлены',msg:vals.join(',')});
      const tx=document.getElementById('hcAns').textContent; if(!tx.includes('H = '+fmt(H)+' мм')||!tx.includes(fmt(dih)+'°')||!tx.includes('φ = '+fmt(phi)+'°')) bad.push({name:'ДЗ №3, вариант '+n,rule:'ответы показаны',msg:tx.replace(/\s+/g,' ').slice(0,160)}); }
    /* свои числа = ответы варианта 17 → «Все условия выполнены» */
    document.querySelector('.hc-vb[data-vn="17"]').click(); const R=S.ans({A:V[17][0],B:V[17][1],C:V[17][2],S:V[17][3]});
    ['H','dih','AB','BC','CA','phi'].forEach(k=>{ document.querySelector(`.hc-in[data-k="v:${k}"]`).value=fmt(R[k]); }); document.querySelector('.hc-go').click(); await new Promise(r=>setTimeout(r,30));
    if(!/Все условия выполнены/.test(document.getElementById('hcRes').textContent)) bad.push({name:'ДЗ №3, вариант 17',rule:'ответы варианта проходят проверку',msg:document.getElementById('hcRes').textContent.slice(0,160)});
    document.querySelector('.hc-clr').click(); try{ localStorage.removeItem('nch2_hwvar_3'); }catch(e){}
    return bad; });
  he.forEach(e=>out.push({name:'#/ng3/my',rule:'ошибка JS',msg:e.slice(0,200)}));
  c.info('ДЗ №3, таблица вариантов: '+out.length+' замечаний (30 вариантов: данные, ответы, проверка своих чисел)');
  c.report('ДЗ №3: варианты и ответы',out); }};

/* 3е. обезличенная статистика режимов (docs/ANALYTICS.md) */
B.track={el:async c=>{ const ap=await c.fresh({viewport:VIEW.phone,hash:'#/ng/tasks/12'});
  await ap.evaluate(()=>{ window.__EV=[]; window.TRACK=(n,p)=>__EV.push(n+':'+(p&&p.mode||'')+':'+(p&&p.task||'')); location.hash='#/ng/path/t12'; });
  await ap.waitForSelector('.pl-mode[data-m="try"]',{timeout:5000}).catch(()=>{});
  await ap.click('.pl-mode[data-m="try"]').catch(()=>{}); await ap.click('.pl-mode[data-m="watch"]').catch(()=>{});
  await walkTask(ap);
  await ap.click('.pl-done').catch(()=>{}); await ap.waitForFunction(()=>window.__EV.some(e=>/^task_done:/.test(e)),null,{timeout:3000}).catch(()=>{});
  const ev=await ap.evaluate(()=>window.__EV);
  ['task_open:watch:12','task_mode:try:12','task_done:watch:12'].forEach(e=>{ if(!ev.includes(e)) c.fail('Статистика режимов: нет события '+e+' (пришло: '+ev.join(', ')+')'); });
  c.info('Статистика режимов: '+ev.length+' событий на один разбор ('+[...new Set(ev.map(e=>e.split(':')[0]))].join(', ')+')'); }};

/* 3и–3л. кабинет, пульт, печать, цвета, «Спроси автора», теория */
B.lk={el:async c=>{ const {bad,res}=await require('./lk-drawings.js').runLk(c.browser,c.URL);
  c.info('Мои чертежи: '+bad.length+' замечаний'+(res&&!res.err?' (конвейер на синтетическом фото: ДЗ №'+res.dz+' в.'+res.n+', невязка '+res.rms+' мм, рёбер '+res.edges+')':''));
  c.report('Мои чертежи (сканер в кабинете)',bad); }};
B.me={el:async c=>{ const bad=await require('./me-hub.js').runMe(c.browser,c.URL); c.info('Пульт владельца: '+bad.length+' замечаний'); c.report('Пульт владельца (me/)',bad); }};
B.print={el:async c=>c.report('Печать листов', await require('./print.js').printCheck(c.browser,c.URL))};
B.colors={el:async c=>c.report('Цвета чертежа', require('./colors.js').check())};
B.ask={el:async c=>{ const bad=await require('./ask.js').runAsk(c.browser); c.info('Спроси автора: '+bad.length+' замечаний'); c.report('Спроси автора (#/ask, пульт)',bad); }};
B.theory={el:async c=>{ const th=require('./theory.js').run().map(o=>({name:'строка '+o.line,rule:o.fact,msg:o.text})); c.report('Теория',th.map(o=>({name:'теория',rule:o.rule,msg:o.msg}))); }};

/* «Дальше» до ответа: после нажатия плеер перерисовывает шаг — ждём, пока старая кнопка уйдёт из документа (вместо паузы 60 мс; медленный кадр — до 2 с) */
async function walkTask(p){
  for(let k=0;k<40;k++){ const b=await p.$('.pl-next,.pl-nextpart'); if(!b) break;
    await b.click().catch(()=>{});
    await p.waitForFunction(el=>!el.isConnected,b,{timeout:2000,polling:'raf'}).catch(()=>{}); } }

/* 5. обход сайта: каждая страница на телефоне — без ошибок JS, без горизонтальной прокрутки, не пустая; разбор каждой задачи до конца.
   Элементы: pages — обход по ссылкам; walk0…walk3 — разборы задач (каждая четвёртая) */
const WALKN=4;
B.crawl={els:q=>q?[]:['pages',...Array.from({length:WALKN},(_,i)=>'walk'+i)], el:async(c,k)=>{ const page=await c.page('crawl'), errs=page.__errs;
  const bad=[];
  if(k==='pages'){ const seen=new Set(), queue=['#/']; let n=0;
    while(queue.length&&n<700){ const h=queue.shift(); if(seen.has(h)) continue; seen.add(h); n++;
      const before=errs.length; await page.evaluate(h=>{ location.hash=h; },h);
      /* роутер отрисовал адрес (смена страниц может идти через View Transition) и прошли два кадра */
      await page.waitForFunction(h=>CURH===h,h,{timeout:5000,polling:'raf'}).catch(()=>{}); await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,16)))));
      const st=await page.evaluate(()=>({ w:document.documentElement.scrollWidth, iw:window.innerWidth, txt:(document.getElementById('view')||document.body).innerText.length,
        /* элемент страницы, растянутый на весь экран чужим стилем (так плитка главной однажды получила стиль окна 3D) */
        huge:[...document.querySelectorAll('#view *')].filter(e=>{ const c=getComputedStyle(e); return c.position==='fixed'&&e.getBoundingClientRect().height>window.innerHeight*0.6; }).map(e=>e.tagName+'.'+String(e.className).slice(0,40)),
        links:[...document.querySelectorAll('a[href^="#/"]')].map(a=>a.getAttribute('href')) }));
      if(errs.length>before) bad.push({name:h,rule:'ошибка JS',msg:errs.slice(before).join(' / ').slice(0,200)});
      if(st.w>st.iw+1) bad.push({name:h,rule:'горизонтальная прокрутка',msg:'ширина '+st.w+' при экране '+st.iw});
      if(st.huge.length) bad.push({name:h,rule:'элемент на весь экран',msg:st.huge.slice(0,3).join(', ')});
      if(st.txt<40) bad.push({name:h,rule:'пустая страница',msg:'текста '+st.txt+' символов'});
      st.links.forEach(l=>{ if(!seen.has(l)&&!/^#\/ng\/check\/gym\/./.test(l)&&!/^#\/ig\/nk\/./.test(l)&&!/^#\/(ng|ig)\d\/(?!1(\/|$))\d+/.test(l)) queue.push(l); }); }   /* варианты тренажёров бесконечны — их проверяют tests/gym.js и tests/normo-mutate.js; варианты ДЗ — tests/variants-run.js (здесь — первый вариант каждого задания) */
    return {n,bad}; }
  const w=+k.slice(4), tasks=(await page.evaluate(()=>WB3.tasks.map(t=>t.n))).filter((t,i)=>i%WALKN===w);
  for(const t of tasks){ const before=errs.length; await page.evaluate(n=>{ location.hash='#/ng/path/t'+n; },t); await page.waitForSelector('.pl-next,.pl-nextpart,.pl-done',{timeout:3000}).catch(()=>{});
    await walkTask(page);
    const done=await page.waitForSelector('.pl-done',{timeout:2000}).catch(()=>null);
    if(errs.length>before) bad.push({name:'Задача №'+t,rule:'ошибка JS в разборе',msg:errs.slice(before).join(' / ').slice(0,200)});
    if(!done) bad.push({name:'Задача №'+t,rule:'разбор не доходит до ответа',msg:'нет кнопки «Готово»'}); }
  return {tasks:tasks.length,bad}; },
 finish:(c,D)=>{ c.info('Обход: страниц '+D.pages.n); let bad=D.pages.bad.slice(), t=0;
  for(let i=0;i<WALKN;i++){ t+=D['walk'+i].tasks; bad=bad.concat(D['walk'+i].bad); }
  c.info('Задач пройдено до ответа: '+t); c.report('Сайт',bad); }};

/* ═══ план: элементы выбранных блоков ═══ */
const elsOf=g=>(B[g].els?B[g].els(QUICK):['*']);
const selected=()=>GROUPS.filter(g=>!ONLY||ONLY.has(g)).filter(g=>elsOf(g).length);
module.exports={GROUPS,B,elsOf,finish:(...a)=>finish(...a)};

/* выполнить элементы: K страниц-исполнителей параллельно; у каждого исполнителя — свои страницы сайта, загруженные один раз
   и переиспользуемые его элементами одного блока */
async function execute(items,K,URL,browser){
  const queue=items.slice(), results=[];
  async function worker(){ const cache={};
    while(queue.length){ const it=queue.shift(), out={g:it.g,k:it.k,info:[],fail:[],M:{},raw:null,ms:0};
      const c=mkCtx(out,{URL,browser,cache});
      const t0=Date.now();
      try{ out.raw=await B[it.g].el(c,it.k); if(out.raw===undefined) out.raw=null; }
      catch(e){ out.fail.push('Сбой проверки · '+it.g+(it.k!=='*'?' / '+it.k:'')+' · '+String(e&&e.stack||e).slice(0,400)); }
      out.ms=Date.now()-t0; for(const p of c.__fresh) await p.close().catch(()=>{});
      results.push(out); }
    for(const p of Object.values(cache)) await p.close().catch(()=>{}); }
  await Promise.all(Array.from({length:Math.max(1,Math.min(K,items.length))},worker));
  return results;
}
function mkCtx(out,{URL,browser,cache}){
  const c={URL,browser,QUICK,M:out.M,__fresh:[],
    info:s=>out.info.push(s), fail:s=>out.fail.push(s),
    report:(title,list)=>{ const key=o=>[o.name,o.rule,o.msg].join(' | '), fresh=list.filter(o=>!baseline.includes(key(o))); out.info.push(title+': '+list.length+' замечаний, новых '+fresh.length); fresh.forEach(o=>out.fail.push(title+' · '+key(o))); },
    /* страница сайта для блока (одна на исполнителя, index.html загружен один раз) */
    page:async(key,o)=>{ if(cache[key]&&!cache[key].isClosed()) return cache[key]; const p=await open(browser,URL,o); cache[key]=p; return p; },
    /* отдельная страница (закрывается после элемента) */
    fresh:async o=>{ const p=await open(browser,URL,o); c.__fresh.push(p); return p; }};
  return c;
}
async function open(browser,URL,o){ o=o||{}; const p=await browser.newPage(o.viewport?{viewport:o.viewport,deviceScaleFactor:1}:{}); p.__errs=[]; p.on('pageerror',e=>p.__errs.push(String(e)));
  await p.goto(URL+(o.hash||''),{timeout:120000}); await ready(p); return p; }

/* итог: элементы → блоки в порядке GROUPS; отсутствующий элемент — ошибка (непроверенное не проходит) */
function finish(results,plan){
  const info=[], fail=[], M={}, TIME={}, EL={};
  const by={}; results.forEach(r=>{ (by[r.g]=by[r.g]||{})[r.k]=r; });
  for(const g of GROUPS){ const want=plan.filter(x=>x.g===g).map(x=>x.k); if(!want.length) continue;
    const got=by[g]||{}, missing=want.filter(k=>!got[k]); TIME[g]=0; EL[g]={};
    want.forEach(k=>{ const r=got[k]; if(!r) return; info.push(...r.info); fail.push(...r.fail); Object.assign(M,r.M); TIME[g]+=r.ms; EL[g][k]=r.ms; });
    if(missing.length){ fail.push('Сбой проверки · '+g+': нет результата элементов '+missing.join(', ')); continue; }
    if(B[g].finish&&!want.some(k=>got[k].raw===null&&got[k].fail.some(f=>/^Сбой проверки/.test(f)))){ const c=mkCtx({info,fail,M},{}); const D={}; want.forEach(k=>{ D[k]=got[k].raw; });
      try{ B[g].finish(c,D); }catch(e){ fail.push('Сбой проверки · '+g+' (итог) · '+String(e&&e.stack||e).slice(0,400)); } } }
  return {info,fail,M,TIME,EL};
}

function print(R,extra){ const {info,fail,TIME}=R;
  if(ONLY) info.unshift('Выборочная проверка: '+[...ONLY].join(', '));
  info.push('Время блоков, с: '+Object.entries(TIME).sort((a,b)=>b[1]-a[1]).map(([g,ms])=>g+' '+Math.round(ms/1000)).join(', ')+(extra||''));
  console.log(info.join('\n'));
  /* длинный список одного раздела — первые 25 строк и число остальных: лог CI обрезается, и иначе не видно других разделов */
  if(fail.length){ const by={}; fail.forEach(f=>{ const g=f.split(' · ')[0]; (by[g]=by[g]||[]).push(f); });
    console.log('\nНОВЫЕ ОШИБКИ ('+fail.length+'):'); Object.values(by).forEach(L=>{ console.log('- '+L.slice(0,25).join('\n- ')+(L.length>25?'\n  …и ещё '+(L.length-25)+' в этом разделе':'')); }); }
  else console.log('\nОшибок нет.');
  return fail.length?1:0; }

function commitId(){ let c=process.env.GITHUB_SHA||''; try{ if(!c) c=require('child_process').execSync('git rev-parse HEAD',{cwd:ROOT}).toString().trim(); }catch(e){} return c; }
function writeTimings(file,R,wall){ const t={commit:commitId(),date:new Date().toISOString(),quick:QUICK,wallMs:wall,blocks:R.TIME,elements:R.EL};
  fs.writeFileSync(file,JSON.stringify(t,null,1)+'\n'); }
async function siteStats(browser,URL){ const P=await open(browser,URL);
  for(const f of ['geometry','oracle','euclid']) await P.addScriptTag({content:T(f)});
  const s=await P.evaluate(()=>{ let st=0, why=0, parts=0; WB3.tasks.forEach(t=>PLAYER.partsOf(t).forEach(p=>{ parts++; (p.steps||[]).forEach(s=>{ st++; if(s.why&&String(s.why).replace(/<[^>]+>/g,'').trim()) why++; }); }));
    return {tasks:WB3.tasks.length,parts,steps:st,why,approx:WB3.tasks.filter(t=>t.conf==='approx').length,euclidTasks:WB3.tasks.filter(t=>!EUCLID_TODO.includes(t.n)).length,oracleParts:(window.ORACLE_SPECS||[]).length}; });
  await P.close(); return s; }
function writeJson(file,R){ fs.writeFileSync(file,JSON.stringify({commit:commitId(),date:new Date().toISOString(),quick:QUICK,info:R.info,fail:R.fail,M:R.M},null,1)); }

/* план элементов: --plan=plan.json --shard=i (поток CI) или --items=g:k,… ; иначе — все элементы выбранных блоков */
function planItems(){
  const P=arg('plan'), sh=arg('shard'), items=arg('items');
  if(P&&sh!=null){ const plan=JSON.parse(fs.readFileSync(P,'utf8')); return plan.shards[+sh].flat().map(id=>({g:id.split(':')[0],k:id.split(':').slice(1).join(':')||'*'})); }
  if(items) return items.split(',').filter(Boolean).map(id=>({g:id.split(':')[0],k:id.split(':').slice(1).join(':')||'*'}));
  return selected().flatMap(g=>elsOf(g).map(k=>({g,k})));
}

if(require.main===module)(async()=>{
  const t0=Date.now();
  /* итог потоков CI: node tests/run.js --merge=папка --plan=plan.json */
  if(arg('merge')){ const dir=arg('merge'), plan=JSON.parse(fs.readFileSync(arg('plan'),'utf8'));
    const all=plan.shards.flat(2).map(id=>({g:id.split(':')[0],k:id.split(':').slice(1).join(':')||'*'}));
    const results=[]; for(const f of fs.readdirSync(dir).filter(f=>/\.json$/.test(f))) results.push(...JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).results);
    const R=finish(results,all); if(plan.site) R.M.site=plan.site; const parts=fs.readdirSync(dir).filter(f=>/\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
    const site=parts.map(p=>p.site).find(Boolean); if(site) R.M.site=site;
    if(JSONOUT) writeJson(JSONOUT,R); if(TIMINGS) writeTimings(TIMINGS,R,Math.max(...parts.map(p=>p.wallMs||0)));
    process.exit(print(R,'; потоков '+parts.length+', самый долгий '+Math.round(Math.max(...parts.map(p=>p.wallMs||0))/1000)+' с'));
  }
  const items=planItems(), K=+(arg('jobs')||Math.max(1,Math.min(4,os.cpus().length)));
  const srv=await serve(), URL='http://127.0.0.1:'+srv.address().port+'/';
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  /* долгие элементы — первыми (по замерам tests/timings.json): так параллельные страницы кончают почти одновременно */
  let tm={}; try{ tm=JSON.parse(fs.readFileSync(path.join(__dirname,'timings.json'),'utf8')).elements||{}; }catch(e){}
  items.sort((a,b)=>(((tm[b.g]||{})[b.k])||0)-(((tm[a.g]||{})[a.k])||0));
  const results=await execute(items,K,URL,browser);
  const out=arg('out');
  if(out){ const site=JSONOUT||arg('site')?await siteStats(browser,URL):null; await browser.close(); srv.close();
    fs.writeFileSync(out,JSON.stringify({wallMs:Date.now()-t0,site,results},null,1));
    const f=results.reduce((a,r)=>a+r.fail.length,0); console.log('Элементов выполнено: '+results.length+' за '+Math.round((Date.now()-t0)/1000)+' с; замечаний '+f+' (итог — в задании «Итог проверки»)');
    results.forEach(r=>r.fail.forEach(x=>console.log('- '+x))); process.exit(results.some(r=>r.fail.some(x=>/^Сбой проверки/.test(x)))?2:0); }
  const R=finish(results,items);
  if(JSONOUT) R.M.site=await siteStats(browser,URL);
  await browser.close(); srv.close();
  const wall=Date.now()-t0;
  if(JSONOUT) writeJson(JSONOUT,R); if(TIMINGS) writeTimings(TIMINGS,R,wall);
  process.exit(print(R,'; всего '+Math.round(wall/1000)+' с на '+K+' страницах'));
})().catch(e=>{ console.error(e); process.exit(2); });
