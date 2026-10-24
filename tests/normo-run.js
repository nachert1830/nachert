/* Нормоконтроль листов ИГ (tests/normo.js, tests/normo-model.js) по всем листам сайта.
   node tests/normo-run.js            — все листы ДЗ 2 (30 вариантов: чистовик и черновик) и лист урока
   node tests/normo-run.js --only=8   — один вариант;  --nomodel — без сверки с 3D-моделью;  --mut — проверка проверки
   Из tests/run.js вызывается runNormo(page). */
const fs=require('fs'), path=require('path');
const SRC=['normo.js','normo-model.js'].map(f=>path.join(__dirname,f)).filter(f=>fs.existsSync(f)).map(f=>fs.readFileSync(f,'utf8'));

async function inject(page){ /* чертёжный шрифт должен быть загружен: canvas меряет надписи им, а не запасным */
  await page.evaluate(()=>document.fonts&&document.fonts.load("italic 22px NchSerif","Ø120 Б–Б").catch(()=>{}));
  if(await page.evaluate(()=>!!window.NORMO)) return; for(const s of SRC) await page.addScriptTag({content:s}); }

/* все листы: [имя, функция в странице, модель] */
async function runNormo(page,o){ o=o||{}; await inject(page);
  const only=o.only?o.only.map(Number):null;
  return page.evaluate(async({only,model})=>{ const out=[], t0=Date.now(), stat={sheets:0,ms:0,cover:{n:0,ok:0,by:{}}};
    const one=(name,svg,opt)=>{ stat.sheets++; let r; try{ r=NORMO.check(svg,opt); }catch(e){ out.push({name,rule:'ошибка проверки',msg:String(e&&e.stack||e).slice(0,200)}); return; }
      if(r.cover){ stat.cover.n+=r.cover.n; stat.cover.ok+=r.cover.ok; Object.entries(r.cover.by).forEach(([t,c])=>stat.cover.by[t]=(stat.cover.by[t]||0)+c); }   /* ГОСТ-покрытие */
      r.issues.forEach(i=>out.push({name,rule:'ГОСТ '+i.gost+' · '+i.rule,msg:i.msg+(i.at?' (у '+i.at.map(v=>Math.round(v)).join(', ')+' мм)':''),sev:i.sev,at:i.at,k:r.k})); return r; };
    const pause=()=>new Promise(r=>setTimeout(r,0));
    for(let n=1;n<=30;n++){ if(only&&!only.includes(n)) continue; if(!window.IG_VARS||!IG_VARS[n]) continue;
      one('ИГ ДЗ 2, вариант '+n+', чистовик',IGS.sheet(n,'clean'),{model:model?IG_VARS[n]:null,spec:IGUI.igSpec(IG_VARS[n])}); await pause();
      one('ИГ ДЗ 2, вариант '+n+', черновик',IGS.sheet(n,'draft'),{draft:true}); await pause(); }
    if(!only&&window.IGL){ one('ИГ урок (вариант 5), чистовик',IGL.sheet('clean'),{model:model&&window.IG_VARS?IG_VARS[5]:null,spec:IGUI.igSpec(IG_VARS[5])}); one('ИГ урок (вариант 5), черновик',IGL.sheet('draft'),{draft:true}); }
    stat.ms=Date.now()-t0; return {issues:out,stat}; },{only,model:!o.nomodel}); }

/* честность песочницы «Сломай ГОСТ» (#/ig/gost): профиль листа сдвигается за норму (ESKD.with) — песочница называет нарушение
   (ESKD.auditX), лист перерисовывается из этого профиля, и настоящий нормоконтроль по готовому SVG обязан поймать то же правило.
   Сдвиг внутри нормы — песочница молчит, и нормоконтроль тоже (ГОСТ-покрытие — под тем же профилем). */
const SB_BAD=[[{'axis.gp':6.5},'штрихпунктирная линия'],[{'axis.gp':2},'штрихпунктирная линия'],[{'font.dim':2.2},'шрифт|размерные числа|буквы обозначений'],[{'font.let':5},'буквы обозначений','igs-let'],
  [{'w.thin':0.6},'тонкие линии'],[{'w.thin':0.2},'тонкие линии'],[{'s':1.6},'основная линия'],[{'s':0.4},'основная линия'],[{'hatch.pitch':12},'шаг штриховки'],
  [{'dash.gp':2.6},'штриховая линия'],[{'dash.st':9},'штриховая линия'],[{'axis.ext':8},'осевая выходит'],[{'axis.ext':0.5},'осевая выходит']];
const SB_GOOD=[{'s':0.9},{'w.thin':0.45,'w.wavy':0.45,'w.axis':0.45},{'axis.gp':3.5},{'axis.gp':4.8},{'hatch.pitch':3},{'dash.st':4,'dash.gp':1.5},{'axis.ext':2.5}];
async function runSandbox(page,o){ o=o||{}; await inject(page);
  return page.evaluate(({vars,BAD,GOOD})=>{ const out={n:0,nb:0,ng:0,caught:0,quiet:0,good:0,fail:[]};
    vars.forEach(n=>{ BAD.forEach(([ov,re,need])=>{ if(need&&IGS.sheet(n,'clean').indexOf(need)<0) return; out.n++; out.nb++;   /* правило о буквах — только на листе с буквами */ const rx=new RegExp(re), a=ESKD.with(ov,()=>ESKD.auditX()), r=ESKD.with(ov,()=>NORMO.check(IGS.sheet(n,'clean'),{}));
        if(!a.length) out.fail.push('вар. '+n+' '+JSON.stringify(ov)+': песочница не видит нарушения');
        if(r.issues.some(i=>rx.test(i.rule))) out.caught++; else out.fail.push('вар. '+n+' '+JSON.stringify(ov)+': песочница — «'+(a[0]&&a[0].msg)+'», а нормоконтроль молчит'); });
      GOOD.forEach(ov=>{ out.n++; out.ng++; const a=ESKD.with(ov,()=>ESKD.auditX()), r=ESKD.with(ov,()=>NORMO.check(IGS.sheet(n,'clean'),{}));
        if(a.length) out.fail.push('вар. '+n+' '+JSON.stringify(ov)+': в норме, а песочница — «'+a[0].msg+'»'); else out.quiet++;
        if(r.issues.length) out.fail.push('вар. '+n+' '+JSON.stringify(ov)+': в норме, а нормоконтроль — '+r.issues.slice(0,2).map(i=>i.rule+': '+i.msg).join('; ')); else out.good++; }); });
    /* ГОСТ-покрытие ловит «магическое число»: одно значение листа подменено руками в обход реестра */
    out.magic=0; out.nm=0; const MAG=[[/stroke-width="0\.798"/,'stroke-width="0.7"'],[/font-size:15\.91px/,'font-size:17px'],[/stroke-dasharray="([\d.]+) 5\.25 1\.5 5\.25"/,'stroke-dasharray="$1 3 1.5 3"'],[/stroke-width="2\.1"/,'stroke-width="2.4"']];
    vars.forEach(n=>{ const sv=IGS.sheet(n,'clean'); MAG.forEach(([re,to])=>{ if(!re.test(sv)) return; out.nm++; const r=NORMO.check(sv.replace(re,to),{});
      if(r.issues.some(i=>/не выведен из профиля/.test(i.rule))) out.magic++; else out.fail.push('вар. '+n+': подмена '+re+' → '+to+' — ГОСТ-покрытие молчит'); }); });
    return out; },{vars:o.vars||[8,15,22],BAD:SB_BAD,GOOD:SB_GOOD}); }

/* «ГОСТ-рентген» нажатиями: покрытие 100 %; нажатие на элемент каждого типа даёт карточку с его типом и пунктом ГОСТ;
   «Сломай ГОСТ»: промежуток осевой за норму — нарушение названо, красные — только осевые; «Вернуть по ГОСТ» — лист чистый */
async function gostUi(page,URL){ const bad=[], add=(r,m)=>bad.push({name:'ГОСТ-рентген',rule:r,msg:m});
  await page.goto(URL+'#/ig/gost/8');
  try{ await page.waitForFunction(()=>document.querySelectorAll('#gxSheet svg .gx-h').length>0,{timeout:120000}); }catch(e){ add('лист','не построился за 120 с'); return {bad,types:0}; }
  await page.waitForTimeout(600);   /* переход между страницами (View Transition) должен закончиться */
  const cov=await page.$eval('#gxCov',e=>e.textContent); if(!/100 %/.test(cov)) add('ГОСТ-покрытие',cov.trim());
  let hit=0; const TY=['axis','dash','main','thin','wavy','dim','tb','tbs','hatch'];
  for(const t of TY){ /* прокрутка — мгновенная (на сайте плавная) и отдельно от расчёта точки: иначе точка считается посреди прокрутки */
    const has=await page.evaluate(t=>{ const svg=document.querySelector('#gxSheet svg'), it=[...svg.querySelectorAll('*')].map(e=>e.__gx).find(x=>x&&x.type===t&&x.el.tagName!=='rect'); if(!it) return false;
      it.el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}); return true; },t); if(!has) continue; await page.waitForTimeout(250);
    const p=await page.evaluate(t=>{ const svg=document.querySelector('#gxSheet svg'), it=[...svg.querySelectorAll('*')].map(e=>e.__gx).find(x=>x&&x.type===t&&x.el.tagName!=='rect');
      const el=it.el, m=el.getScreenCTM();
      let q; if(el.tagName==='text'){ const r=el.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; }
      if(el.getTotalLength){ const L=el.getTotalLength(); for(const f of [0.37,0.5,0.21,0.63,0.79]){ const a=el.getPointAtLength(L*f), b=new DOMPoint(a.x,a.y).matrixTransform(m); const top=document.elementsFromPoint(b.x,b.y).map(e=>e.__gx).filter(Boolean); if(top.includes(it)&&top.every(x=>x===it||x.type===t||x.type==='hatch'||x.type==='main')) return [b.x,b.y]; q=q||[b.x,b.y]; } }
      return q||null; },t);
    if(!p) continue; await page.mouse.click(p[0],p[1]); await page.waitForTimeout(120);
    const card=await page.$eval('#gxOut',e=>e.textContent); const name=await page.evaluate(t=>ESKD.TYPES[t].n,t);
    if(!/ГОСТ|методические указания/.test(card)) add('карточка','нажатие на «'+name+'» — нет пункта ГОСТ в карточке'); else if(card.includes(name)) hit++; }
  if(hit<5) add('карточка','тип элемента узнан на '+hit+' нажатиях из '+TY.length);
  await page.click('.gx-mode button[data-m="b"]'); await page.waitForTimeout(400);
  await page.$eval('#gxKnobs input[data-i="4"]',e=>{ e.value=6.5; e.dispatchEvent(new Event('input')); }); await page.waitForTimeout(900);
  const v1=await page.$eval('#gxViol',e=>e.textContent), red=await page.evaluate(()=>[...document.querySelectorAll('#gxSheet .gx-bad')].map(e=>e.__gx&&e.__gx.type));
  if(!/промежуток осевой/.test(v1)) add('Сломай ГОСТ','промежуток осевой 6,5 мм — нарушение не названо: '+v1.slice(0,120));
  if(!red.length||red.some(t=>t!=='axis')) add('Сломай ГОСТ','красные элементы: '+[...new Set(red)].join(', ')+' — ждём только осевые');
  await page.click('#gxReset'); await page.waitForTimeout(900);
  const v2=await page.$eval('#gxViol',e=>e.textContent), red2=await page.$$eval('#gxSheet .gx-bad',x=>x.length);
  if(!/Лист по ГОСТ/.test(v2)||red2) add('Вернуть по ГОСТ','после сброса: «'+v2.slice(0,80)+'», красных '+red2);
  return {bad,types:hit}; }

module.exports={runNormo,runSandbox,gostUi,inject,SRC};

if(require.main===module){ (async()=>{
  const http=require('http'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const ROOT=path.join(__dirname,'..'), arg=k=>{ const a=process.argv.find(x=>x.startsWith('--'+k+'=')); return a?a.split('=')[1]:null; };
  const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(p).pipe(r); });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage(); page.on('pageerror',e=>console.log('JS:',String(e)));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/'); await page.waitForTimeout(1500);
  const only=arg('only')?arg('only').split(','):null;
  if(process.argv.includes('--sandbox')){ const sb=await runSandbox(page,{vars:only?only.map(Number):undefined}); console.log(JSON.stringify(sb,null,1)); await browser.close(); srv.close(); return; }
  const r=await runNormo(page,{only,nomodel:process.argv.includes('--nomodel')});
  const by={}; r.issues.forEach(i=>{ (by[i.rule]=by[i.rule]||[]).push(i); });
  Object.entries(by).sort((a,b)=>b[1].length-a[1].length).forEach(([k,v])=>{ console.log('\n■ '+k+' — '+v.length); v.slice(0,process.argv.includes('--all')?999:6).forEach(i=>console.log('   '+i.name+': '+i.msg)); });
  console.log('\nЛистов: '+r.stat.sheets+', замечаний: '+r.issues.length+', '+Math.round(r.stat.ms/1000)+' с');
  const C=r.stat.cover; console.log('ГОСТ-покрытие: элементов '+C.n+', выведено из профиля '+C.ok+' ('+(C.n?Math.round(1000*C.ok/C.n)/10:0)+' %) — '+Object.entries(C.by).map(([t,c])=>t+' '+c).join(', '));
  const shots=arg('shots'); if(shots){ fs.mkdirSync(shots,{recursive:true}); const names=[...new Set(r.issues.filter(i=>i.at).map(i=>i.name))];
    await page.setViewportSize({width:1800,height:1300});
    for(const nm of names){ const II=r.issues.filter(i=>i.name===nm&&i.at), m=/вариант (\d+), (\S+)/.exec(nm)||[], urok=/урок/.test(nm);
      await page.evaluate(({n,mode,urok,II})=>{ let svg=urok?IGL.sheet(/черновик/.test(mode)?'draft':'clean'):IGS.sheet(+n,/черновик/.test(mode)?'draft':'clean'); const k=II[0].k;
        const mk=II.map((i,j)=>`<circle cx="${i.at[0]*k}" cy="${i.at[1]*k}" r="${4*k}" fill="none" stroke="red" stroke-width="3"/><text x="${i.at[0]*k+4*k}" y="${i.at[1]*k-3*k}" fill="red" font-size="${3*k}" font-family="sans-serif">${j+1}</text>`).join('');
        const vb=/viewBox="([-\d.]+) ([-\d.]+)/.exec(svg); svg=svg.replace(/<\/svg>$/,`<g transform="translate(${vb[1]} ${vb[2]})">${mk}</g></svg>`);
        document.body.innerHTML='<div id="shot" style="width:1800px;background:#fff">'+svg+'</div>'; },{n:m[1],mode:m[2]||nm,urok,II});
      await page.waitForTimeout(200); const f=path.join(shots,nm.replace(/[^\wа-яё]+/gi,'_')+'.png'); await (await page.$('#shot')).screenshot({path:f});
      fs.writeFileSync(f.replace(/\.png$/,'.txt'),II.map((i,j)=>(j+1)+'. '+i.rule+': '+i.msg).join('\n')); }
    console.log('Снимки: '+shots); }
  if(process.argv.includes('--mut')){ const m=await require('./normo-mutate.js').runMutations(page,{per:+(arg('per')||3)}); console.log(JSON.stringify(m,null,1)); }
  await browser.close(); srv.close();
})().catch(e=>{ console.error(e); process.exit(2); }); }
