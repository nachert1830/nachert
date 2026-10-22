/* ═══════════ Полная проверка сайта перед публикацией ═══════════
   node tests/run.js            — всё (≈1–2 мин)
   node tests/run.js --quick    — без обхода всех страниц
   Код выхода 0 — ошибок нет; 1 — есть новые ошибки (их список выводится).
   Уже разобранные вручную случаи лежат в tests/baseline.json вместе с объяснением, почему это не ошибка. */
const http=require('http'), fs=require('fs'), path=require('path');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..'), QUICK=process.argv.includes('--quick');
/* --json=файл — все замеры одной записью (для тезисов и отчётов: каждое число — с коммитом, на котором оно получено) */
const JSONOUT=(process.argv.find(a=>a.startsWith('--json='))||'').slice(7), M={};
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.txt':'text/plain'};
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline.json'),'utf8')).accepted.map(a=>a.key);

function serve(){ return new Promise(res=>{ const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end('нет'); }
    r.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(srv)); }); }

(async()=>{
  const srv=await serve(), URL='http://127.0.0.1:'+srv.address().port+'/';
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const fail=[], info=[];
  const key=o=>[o.name,o.rule,o.msg].join(' | ');
  const report=(title,list)=>{ const fresh=list.filter(o=>!baseline.includes(key(o))); info.push(title+': '+list.length+' замечаний, новых '+fresh.length); fresh.forEach(o=>fail.push(title+' · '+key(o))); };

  /* 1–3. чертежи: 3D-проверка, отрисовка, мутации */
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(1500);
  for(const f of ['geometry','render','mutate','oracle']) await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')});
  report('Чертежи (3D-модель)', await page.evaluate(()=>GEOM_CHECK()));
  report('Отрисовка (подписи)', await page.evaluate(()=>RENDER_CHECK()));
  const mut=await page.evaluate(()=>MUTATE_CHECK({n:450,seed:11}));
  Object.entries(mut).forEach(([k,v])=>info.push('Мутации «'+k+'»: поймано '+v.поймано+' из '+v.всего)); M.mutate=mut;
  const ml=mut['линия связи'], ms=mut['подписи местами'];
  if(ml&&ml.поймано/ml.всего<0.95) fail.push('Проверка ослабла: разрыв линии связи ловится в '+Math.round(100*ml.поймано/ml.всего)+'% случаев');
  if(ms&&ms.поймано/ms.всего<0.93) fail.push('Проверка ослабла: перепутанные подписи ловятся в '+Math.round(100*ms.поймано/ms.всего)+'% случаев');
  /* числа на чертежах — полным перебором (каждое «N мм» → N−3, N+3, N+6, N+9): сверка с текстом задачи и с общим масштабом */
  const msz=await page.evaluate(()=>MUTATE_SIZES());
  M.sizes={caught:msz.поймано,total:msz.всего}; info.push('Числа на чертежах (перебор): поймано '+msz.поймано+' из '+msz.всего+(msz.пропуски.length?' — пропуски: '+msz.пропуски.slice(0,5).join('; '):''));
  if(msz.поймано/msz.всего<0.95) fail.push('Проверка ослабла: неверное число на чертеже ловится в '+Math.round(100*msz.поймано/msz.всего)+'% случаев');

  /* 3б. оракул: ответы задач против условия, записанного геометрически; и проверка самого оракула */
  report('Оракул (ответы задач)', await page.evaluate(()=>ORACLE_CHECK()));
  const om=await page.evaluate(()=>ORACLE_MUTATE({per:4,seed:7}));
  M.answer={geom:om.геометрия,oracle:om.сОракулом,total:om.всего}; info.push('Сдвиг точки ответа: ловит 3D-проверка '+om.геометрия+' из '+om.всего+', вместе с оракулом '+om.сОракулом+' из '+om.всего+' (задач с оракулом: '+(await page.evaluate(()=>ORACLE_SPECS.length))+')');
  if(om.сОракулом/om.всего<0.85) fail.push('Оракул ослаб: ловит '+Math.round(100*om.сОракулом/om.всего)+'% сдвигов ответа');

  /* 3б+. «Евклид»: каждый элемент чертежа выводится из предыдущих линейкой и циркулем (tests/euclid.js);
     ДЗ-оракул: разборы ДЗ №2 и №3 проверены числами по условию (tests/dz.js); арифметика в текстах (tests/arith.js) */
  for(const f of ['euclid','arith','dz']) await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')});
  report('Построимость («Евклид»)', await page.evaluate(()=>EUCLID_CHECK()));
  info.push('«Евклид»: проверено задач '+(await page.evaluate(()=>WB3.tasks.filter(t=>!EUCLID_TODO.includes(t.n)).length))+' из 89 и ДЗ №2 (2а–2в), №3; кривые поверхности — в работе: №'+(await page.evaluate(()=>EUCLID_TODO.join(', №'))));
  report('Арифметика в тексте', await page.evaluate(()=>ARITH_CHECK()));
  report('ДЗ-оракул (ДЗ №2, №3)', await page.evaluate(()=>DZ_CHECK()));
  { const dpage=await browser.newPage(); await dpage.goto(URL); await dpage.waitForTimeout(1200);
    for(const f of ['geometry','euclid','arith','dz']) await dpage.addScriptTag({content:fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')});
    const DR=require('./dz-run.js'), N=QUICK?10:40, v=await DR.runDzVariants(dpage,N);
    M.dzVar={n:N,checked:v.checked,skipped:v.skipped,bad:Object.keys(v.bad).length}; info.push('ДЗ №2 и №3 на случайных вариантах: '+N+' × 4 разбора, проверено '+v.checked+', вырожденных отброшено '+v.skipped);
    Object.entries(v.bad).forEach(([k,list])=>fail.push('ДЗ, случайные варианты · '+k+': '+list.length+' вар. — '+list[0]));
    if(!QUICK){ const m=await DR.runDzMutations(dpage,{per:12}), t=m.by['всего']||{n:0,geo:0,all:0};
      M.dzMut=m; info.push('ДЗ, мутации кода: 3D-проверка ловит '+t.geo+' из '+t.n+', с ДЗ-оракулом, «Евклидом» и арифметикой — '+t.all+' из '+t.n);
      if(t.n&&t.all/t.n<0.85) fail.push('Проверка ДЗ ослабла: мутации кода ДЗ ловятся в '+Math.round(100*t.all/t.n)+'% случаев'); }
    await dpage.close(); }

  /* 3б′. трассировка происхождения (O4 «по построению»): каждая точка и линия — с того поля, которое указывает подпись */
  { const ppage=await browser.newPage(); await ppage.goto(URL); await ppage.waitForTimeout(1200);
    const {issues,stats}=await require('./provenance-run.js').runProvenance(ppage);
    info.push('Происхождение: прослежено точек '+stats.traced+' из '+stats.pts+', отрезков '+stats.segTraced+' из '+stats.segs);
    report('Происхождение точек',issues); await ppage.close(); }

  /* 3б″. сертификаты (tests/certified): два исполнения протокола совпадают по шагам, ответ = решение условия,
     опубликованный чертёж и число в ответе = доказанная модель */
  { const cpage=await browser.newPage(); await cpage.goto(URL); await cpage.waitForTimeout(1200);
    const certs=await require('./certified/run.js').runCertificates(cpage,{variants:QUICK?50:200});
    certs.forEach(c=>{ if(!c.ok) Object.entries(c.O).filter(([k,o])=>!o.ok).forEach(([k,o])=>fail.push('Сертификат №'+c.n+' · '+k+': '+o.detail)); });
    info.push('Сертификаты: выдано '+certs.filter(c=>c.ok).length+' из '+certs.length+' (№'+certs.map(c=>c.n).join(', №')+')'); await cpage.close(); }

  /* 3б‴. проверка проверки на мутациях КОДА задач (O8): порог для подмены поля и для задач с сертификатом */
  if(!QUICK){ const apage=await browser.newPage(); await apage.goto(URL); await apage.waitForTimeout(1200);
    const ad=await require('./adequacy.js').runAdequacy(apage,{per:2,seed:5}), fh=ad.by['F↔H'], ct=ad.cby['всего'];
    M.code={by:ad.by,kinds:ad.kinds,total:ad.total,equiv:ad.equiv,crashed:ad.crashed,cert:ad.cby}; info.push('Мутации кода: поймано '+ad.by['всего'].all+' из '+ad.by['всего'].n+', с «Евклидом» и арифметикой — '+ad.by['всего'].euc+(fh?'; подмена поля F↔H — '+fh.all+' из '+fh.n:'')+(ct?'; в задачах с сертификатом — '+ct.cert+' из '+ct.n:''));
    if(fh&&fh.all/fh.n<0.75) fail.push('Проверка ослабла: подмена поля F↔H ловится в '+Math.round(100*fh.all/fh.n)+'% случаев');
    if(ct&&ct.cert/ct.n<0.85) fail.push('Сертификаты ослабли: в задачах с сертификатом ловится '+Math.round(100*ct.cert/ct.n)+'% мутаций');
    await apage.close(); }

  /* 3в. случайные варианты: каждая задача заново строится на искажённых данных и проходит 3D-проверку и оракул */
  { const vpage=await browser.newPage(); await vpage.goto(URL); await vpage.waitForTimeout(1200);
    const N=QUICK?10:30, res=await require('./random-run.js').runVariants(vpage,N), list=[]; let deg=0;
    res.forEach(b=>{ Object.entries(b.bad).forEach(([k,v])=>{ const [n,rule]=k.split('|'); list.push({name:n,rule:'вариант: '+rule,msg:v[0].msg.slice(0,160)+' ('+v.length+' из '+N+')'}); });
      (b.info||[]).forEach(x=>{ const m=/вырожденных вариантов (\d+)/.exec(x); if(m) deg+=+m[1]; }); });
    const still=res.reduce((a,b)=>a.concat(b.still||[]),[]);
    info.push('Случайные варианты: '+N+' на задачу, вырожденных (без решения) отброшено '+deg+'; данные не числами — только на своих данных: '+(still.join(', ')||'нет'));
    report('Случайные варианты', list); await vpage.close(); }

  /* 3г. тренажёр: генератор на сайте ищет блоки задач так же, как контрольный разбор (acorn); список допущенных задач
     совпадает с расчётом; каждый режим работает на каждой задаче */
  { const gpage=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}); await gpage.goto(URL); await gpage.waitForTimeout(1200);
    const ref=require('./random.js').blocks().map(b=>b.src.trim()), got=await gpage.evaluate(()=>GEN.blocks().map(x=>x.trim()));
    const diff=ref.filter((b,i)=>b!==got[i]).length+Math.abs(ref.length-got.length);
    if(diff) fail.push('Тренажёр: разбор кода на сайте расходится с контрольным разбором в '+diff+' блоках');
    const el=await require('./gen-check.js').genEligibility(gpage,12), cur=await gpage.evaluate(()=>GEN.list());
    if(JSON.stringify(el.ok)!==JSON.stringify(cur)) fail.push('Тренажёр: список задач для генератора устарел. Вставь в GEN_OK: '+JSON.stringify(el.ok));
    const gy=await require('./gym.js').gymCheck(gpage,URL,{all:!QUICK});
    info.push('Тренажёр: блоков задач '+got.length+' (совпадают с контрольным разбором), генератор — задач '+el.ok.length+', «найди ошибку» — '+gy.info.bug+', 3D к задачам — '+gy.info.t3);
    report('Тренажёр',gy.bad); await gpage.close(); }

  /* 3г′. РК2: банк заданий, генераторы «Вижу» с независимой проверкой ответа, модель готовности, проход всех режимов */
  { const rpage=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    report('РК2', await require('./rk2.js').rk2Check(rpage,URL)); await rpage.close(); }

  /* 3в. ДЗ 2 по ИГ: размеры на листах — числа равны расстояниям по модели, выносные линии упираются в контур */
  report('ИГ: размеры на листах', await page.evaluate(()=>window.IGS?IGS.checkAll():[]));

  /* 3д. нормоконтроль листов ИГ (tests/normo.js, normo-model.js): ГОСТ 2.301–2.307 и 2.104 по готовому SVG листа и сверка
     каждого вида с 3D-моделью лучами. Проверка проверки (normo-mutate.js): нарушения тренажёра «Нормоконтроль» подсаживаются
     в настоящие листы и должны ловиться там, где тренажёр их показывает, — без лишних замечаний */
  { const npage=await browser.newPage(); await npage.goto(URL); await npage.waitForTimeout(1200);
    const nr=await require('./normo-run.js').runNormo(npage,{nomodel:QUICK});
    info.push('Нормоконтроль ИГ: листов '+nr.stat.sheets+(QUICK?' (без сверки с моделью)':', виды сверены с 3D-моделью')+', '+Math.round(nr.stat.ms/1000)+' с');
    report('ИГ: нормоконтроль листов',nr.issues.map(i=>({name:i.name,rule:i.rule,msg:i.msg})));
    const mu=await require('./normo-mutate.js').runMutations(npage,{per:QUICK?1:2}), tot=Object.values(mu).reduce((a,x)=>[a[0]+x.поймано,a[1]+x.всего,a[2]+x.лишнее],[0,0,0]);
    info.push('Нормоконтроль, проверка проверки: поймано '+tot[0]+' из '+tot[1]+' подсаженных нарушений ('+Object.keys(mu).length+' типов тренажёра), лишних замечаний — '+tot[2]);
    Object.entries(mu).forEach(([t,x])=>{ if(!x.всего) fail.push('Тренажёр «Нормоконтроль»: нарушение «'+t+'» не подсаживается ни в один лист');
      else if(x.поймано<x.всего) fail.push('Нормоконтроль не ловит «'+t+'»: '+x.поймано+' из '+x.всего+' — '+x.пример);
      if(x.лишнее) fail.push('Нормоконтроль: подсадка «'+t+'» даёт лишние замечания — '+x.пример); });
    /* «Нормоконтроль» — здесь, пока листы в кэше после нормоконтроля всех листов: на медленном раннере CI с холодного кэша
       лист не успевал построиться за 90 с */
    report('Тренажёр «Нормоконтроль»',await require('./normo-mutate.js').nkUi(npage,URL));
    if(!QUICK){ const wm=await require('./normo-mutate.js').wavyMutations(npage);
      info.push('Сторона волнистой линии (ГОСТ 2.305): поймано '+wm.поймано+' из '+wm.всего+' подсаженных ошибок'+(wm.review.length?'; для проверки человеком: '+wm.review.join('; '):''));
      if(wm.поймано<wm.всего) fail.push('Нормоконтроль не ловит сторону волнистой линии: '+wm.пропуски.join(', ')); }
    await npage.close();
    /* «Читаю чертёж» — на свежей вкладке на переднем плане: в той, где считался нормоконтроль, переход по # страницу
       не перезагружает, и на раннере CI лист варианта 8 не успевал построиться (падало и до этой правки) */
    const upage=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}); await upage.bringToFront(); await upage.goto(URL); await upage.waitForTimeout(1200);
    report('Читаю чертёж',await require('./normo-mutate.js').readUi(upage,URL));
    await upage.close(); }

  /* 3ж. «Научись защищать точки» (#/ig/points): каждая точка разбора лежит на поверхности детали варианта 5 (точка в штриховке — в материале, в секущей плоскости), видимость, под которую
     написан текст шага (exp: главный вид, вид сверху, вид слева), совпадает с видимостью по модели на изображениях листа (луч к глазу,
     разрезы — как на листе), чертёж каждого шага строится. Тренажёр нажатиями: верное место и верная отметка засчитываются;
     перепутанные перёд и зад или не та отметка (выколотая точка ↔ крестик) — нет */
  { const tp=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}); const te=[]; tp.on('pageerror',e=>te.push(String(e)));
    await tp.goto(URL+'#/ig/points'); await tp.waitForTimeout(1500);
    const out=await tp.evaluate(()=>{ const bad=[], J=IG3.jc(IG_VARS[5].tree), M={F:'″',T:'′',L:'‴'};
      IGL.PEX().forEach(E=>{ const name='точка '+E.n, j=J(...E.p); if(E.cutp?!(j<-0.05&&Math.abs(E.p[E.cutp==='L'?0:1])<1e-9):Math.abs(j)>0.05) bad.push({name,rule:E.cutp?'точка в штриховке: в материале, в секущей плоскости':'точка на поверхности',msg:'J = '+j.toFixed(3)});
        IGL.ptSVG(E,0); const got=['F','T','L'].map(v=>E.vis[v]).join('');
        if(got!==E.exp) bad.push({name,rule:'видимость в тексте = видимость по модели',msg:'текст: '+E.exp+', модель: '+got+' (v — видна, h — закрыта, r — убрана разрезом)'});
        E.s.forEach((s,i)=>{ const tx=(s.act.join(' ')+' '+(s.why||'')).replace(/<[^>]+>/g,'');
          if(new RegExp('\\('+E.n+'[″′‴]\\)').test(tx)) bad.push({name,rule:'видимость — отметкой, не скобками',msg:'шаг '+(i+1)});
          try{ const sv=IGL.ptSVG(E,i); if(!/<svg/.test(sv)||sv.indexOf(E.n+'')<0) bad.push({name,rule:'чертёж шага',msg:'шаг '+(i+1)+' пустой'}); }catch(e){ bad.push({name,rule:'чертёж шага',msg:'шаг '+(i+1)+': '+e}); } }); });
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
    info.push('Защита точек: '+out.length+' замечаний; тренажёр — верных засчитано '+cnt.ok+' из '+cnt.n+', перепутанных перёд/зад отклонено '+cnt.mir+', неверных отметок отклонено '+cnt.sym);
    report('ИГ: защита точек',out); await tp.close(); }

  /* 3з. ДЗ №3, «Сверь свой лист»: таблица 30 вариантов задания. Ответы пересчитываются здесь независимо (нормаль, проекция на ребро AB,
     угол ребра с плоскостью), выбор варианта подставляет его данные и показывает те же числа; варианты-«зеркала» дают равные ответы;
     ответы варианта, вписанные как свои, проходят проверку */
  { const hp=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}); const he=[]; hp.on('pageerror',e=>he.push(String(e)));
    await hp.goto(URL+'#/ng/hw/3'); await hp.waitForTimeout(1500);
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
    he.forEach(e=>out.push({name:'#/ng/hw/3',rule:'ошибка JS',msg:e.slice(0,200)}));
    info.push('ДЗ №3, таблица вариантов: '+out.length+' замечаний (30 вариантов: данные, ответы, проверка своих чисел)');
    report('ДЗ №3: варианты и ответы',out); await hp.close(); }

  /* 3е. обезличенная статистика режимов (docs/ANALYTICS.md): события уходят в TRACK — он сам отправляет их, только если посетитель
     согласился на cookie. Здесь TRACK подменяется записью в список: открыть задачу, сменить режим, дойти до ответа */
  { const apage=await browser.newPage({viewport:{width:390,height:844}}); await apage.goto(URL+'#/ng/tasks/12'); await apage.waitForTimeout(1200);
    await apage.evaluate(()=>{ window.__EV=[]; window.TRACK=(n,p)=>__EV.push(n+':'+(p&&p.mode||'')+':'+(p&&p.task||'')); location.hash='#/ng/path/t12'; });
    await apage.waitForSelector('.pl-mode[data-m="try"]',{timeout:5000}).catch(()=>{});
    await apage.click('.pl-mode[data-m="try"]').catch(()=>{}); await apage.click('.pl-mode[data-m="watch"]').catch(()=>{});
    for(let k=0;k<40;k++){ const b=await apage.$('.pl-next,.pl-nextpart'); if(!b) break; await b.click().catch(()=>{}); await apage.waitForTimeout(60); }
    await apage.click('.pl-done').catch(()=>{}); await apage.waitForTimeout(200);
    const ev=await apage.evaluate(()=>window.__EV);
    ['task_open:watch:12','task_mode:try:12','task_done:watch:12'].forEach(e=>{ if(!ev.includes(e)) fail.push('Статистика режимов: нет события '+e+' (пришло: '+ev.join(', ')+')'); });
    info.push('Статистика режимов: '+ev.length+' событий на один разбор ('+[...new Set(ev.map(e=>e.split(':')[0]))].join(', ')+')'); await apage.close(); }

  /* 4. теория */
  const th=require('./theory.js').run().map(o=>({name:'строка '+o.line,rule:o.fact,msg:o.text}));
  report('Теория',th.map(o=>({name:'теория',rule:o.rule,msg:o.msg})));

  /* 5. обход сайта: каждая страница на телефоне — без ошибок JS, без горизонтальной прокрутки, не пустая */
  if(!QUICK){
    const seen=new Set(), queue=['#/'], bad=[]; let n=0;
    while(queue.length&&n<700){ const h=queue.shift(); if(seen.has(h)) continue; seen.add(h); n++;
      const before=errs.length; await page.evaluate(h=>{ location.hash=h; },h); await page.waitForTimeout(60);
      const st=await page.evaluate(()=>({ w:document.documentElement.scrollWidth, iw:window.innerWidth, txt:(document.getElementById('view')||document.body).innerText.length,
        /* элемент страницы, растянутый на весь экран чужим стилем (так плитка главной однажды получила стиль окна 3D) */
        huge:[...document.querySelectorAll('#view *')].filter(e=>{ const c=getComputedStyle(e); return c.position==='fixed'&&e.getBoundingClientRect().height>window.innerHeight*0.6; }).map(e=>e.tagName+'.'+String(e.className).slice(0,40)),
        links:[...document.querySelectorAll('a[href^="#/"]')].map(a=>a.getAttribute('href')) }));
      if(errs.length>before) bad.push({name:h,rule:'ошибка JS',msg:errs.slice(before).join(' / ').slice(0,200)});
      if(st.w>st.iw+1) bad.push({name:h,rule:'горизонтальная прокрутка',msg:'ширина '+st.w+' при экране '+st.iw});
      if(st.huge.length) bad.push({name:h,rule:'элемент на весь экран',msg:st.huge.slice(0,3).join(', ')});
      if(st.txt<40) bad.push({name:h,rule:'пустая страница',msg:'текста '+st.txt+' символов'});
      st.links.forEach(l=>{ if(!seen.has(l)&&!/^#\/ng\/check\/gym\/./.test(l)&&!/^#\/ig\/nk\/./.test(l)) queue.push(l); }); }   /* варианты тренажёров бесконечны — их проверяют tests/gym.js и tests/normo-mutate.js */
    info.push('Обход: страниц '+n);
    /* разбор каждой задачи до конца: «Дальше» до ответа */
    const tasks=await page.evaluate(()=>WB3.tasks.map(t=>t.n));
    for(const t of tasks){ const before=errs.length; await page.evaluate(n=>{ location.hash='#/ng/path/t'+n; },t); await page.waitForSelector('.pl-next,.pl-nextpart,.pl-done',{timeout:3000}).catch(()=>{});   /* первый разбор после обхода страниц иногда рисуется дольше 80 мс */
      for(let k=0;k<40;k++){ const b=await page.$('.pl-next,.pl-nextpart'); if(!b) break; await b.click().catch(()=>{}); await page.waitForTimeout(60); }
      let done=await page.$('.pl-done'); if(!done){ for(let k=0;k<40;k++){ const b=await page.$('.pl-next,.pl-nextpart'); if(!b) break; await b.click().catch(()=>{}); await page.waitForTimeout(200); } done=await page.waitForSelector('.pl-done',{timeout:2000}).catch(()=>null); }   /* медленный кадр — повторяем не спеша */
      if(errs.length>before) bad.push({name:'Задача №'+t,rule:'ошибка JS в разборе',msg:errs.slice(before).join(' / ').slice(0,200)});
      if(!done) bad.push({name:'Задача №'+t,rule:'разбор не доходит до ответа',msg:'нет кнопки «Готово»'}); }
    info.push('Задач пройдено до ответа: '+tasks.length);
    report('Сайт',bad);
  }
  if(JSONOUT){ const P=await browser.newPage(); await P.goto(URL); await P.waitForTimeout(1200);
    for(const f of ['geometry','oracle','euclid']) await P.addScriptTag({content:fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')});
    M.site=await P.evaluate(()=>{ let st=0, why=0, parts=0; WB3.tasks.forEach(t=>PLAYER.partsOf(t).forEach(p=>{ parts++; (p.steps||[]).forEach(s=>{ st++; if(s.why&&String(s.why).replace(/<[^>]+>/g,'').trim()) why++; }); }));
      return {tasks:WB3.tasks.length,parts,steps:st,why,approx:WB3.tasks.filter(t=>t.conf==='approx').length,euclidTasks:WB3.tasks.filter(t=>!EUCLID_TODO.includes(t.n)).length,oracleParts:(window.ORACLE_SPECS||[]).length}; });
    await P.close();
    let commit=process.env.GITHUB_SHA||''; try{ if(!commit) commit=require('child_process').execSync('git rev-parse HEAD',{cwd:ROOT}).toString().trim(); }catch(e){}
    fs.writeFileSync(JSONOUT,JSON.stringify({commit,date:new Date().toISOString(),quick:QUICK,info,fail,M},null,1)); }
  await browser.close(); srv.close();
  console.log(info.join('\n'));
  /* длинный список одного раздела — первые 25 строк и число остальных: лог CI обрезается, и иначе не видно других разделов */
  if(fail.length){ const by={}; fail.forEach(f=>{ const g=f.split(' · ')[0]; (by[g]=by[g]||[]).push(f); });
    console.log('\nНОВЫЕ ОШИБКИ ('+fail.length+'):'); Object.values(by).forEach(L=>{ console.log('- '+L.slice(0,25).join('\n- ')+(L.length>25?'\n  …и ещё '+(L.length-25)+' в этом разделе':'')); }); process.exit(1); }
  console.log('\nОшибок нет.'); process.exit(0);
})().catch(e=>{ console.error(e); process.exit(2); });
