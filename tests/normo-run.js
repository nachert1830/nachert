/* Нормоконтроль листов ИГ (tests/normo.js, tests/normo-model.js) по всем листам сайта.
   node tests/normo-run.js            — все листы ДЗ 2 и задания 4 (по 30 вариантов: чистовик и черновик) и лист урока
   node tests/normo-run.js --only=8   — один вариант;  --set=ig3 | ig4 | dz2 — один набор;  --nomodel — без сверки с 3D-моделью;  --mut — проверка проверки
   Из tests/run.js вызывается runNormo(page). */
const fs=require('fs'), path=require('path');
const SRC=['normo.js','normo-model.js'].map(f=>path.join(__dirname,f)).filter(f=>fs.existsSync(f)).map(f=>fs.readFileSync(f,'utf8'));

async function inject(page){ /* чертёжный шрифт должен быть загружен: canvas меряет надписи им, а не запасным */
  await page.evaluate(()=>document.fonts&&document.fonts.load("italic 22px NchSerif","Ø120 Б–Б").catch(()=>{}));
  if(await page.evaluate(()=>!!window.NORMO)) return; for(const s of SRC) await page.addScriptTag({content:s}); }

/* все листы: [имя, функция в странице, модель] */
async function runNormo(page,o){ o=o||{}; await inject(page);
  const only=o.only?o.only.map(Number):null;
  return page.evaluate(async({only,model,o3,o4,dz2,igSample})=>{ const out=[], t0=Date.now(), stat={sheets:0,ms:0};
    const one=(name,svg,opt)=>{ stat.sheets++; let r; try{ r=NORMO.check(svg,opt); }catch(e){ out.push({name,rule:'ошибка проверки',msg:String(e&&e.stack||e).slice(0,200)}); return; }
      r.issues.forEach(i=>out.push({name,rule:'ГОСТ '+i.gost+' · '+i.rule,msg:i.msg+(i.at?' (у '+i.at.map(v=>Math.round(v)).join(', ')+' мм)':''),sev:i.sev,at:i.at,k:r.k})); return r; };
    const pause=()=>new Promise(r=>setTimeout(r,0));
    for(let n=1;n<=30;n++){ if(!dz2) break; if(only&&!only.includes(n)) continue; if(!window.IG_VARS||!IG_VARS[n]) continue;
      one('ИГ ДЗ 2, вариант '+n+', чистовик',IGS.sheet(n,'clean'),{model:model?IG_VARS[n]:null,spec:IGUI.igSpec(IG_VARS[n])}); await pause();
      one('ИГ ДЗ 2, вариант '+n+', черновик',IGS.sheet(n,'draft'),{draft:true}); await pause(); }
    /* ИГ, задания 3 и 4 (dz/ig/N/models.js): те же листы, тот же модуль */
    for(const [id,on] of [['ig3',o3],['ig4',o4]]){ const PN=window.DZR&&DZR.get(id); if(!on||!PN||!PN.part) continue; const N=id.slice(2);
      for(let n=1;n<=30;n++){ if(only&&!only.includes(n)) continue; if(!only&&igSample&&!igSample.includes(n)) continue; const m=PN.part(n); if(!m) continue; const R={md:m,nv:n,key:id+'-'+n,dims:m.dims||[]};
        one('ИГ задание '+N+', вариант '+n+', чистовик',IGS.sheet(R,'clean'),{model:model?m:null,spec:IGUI.igSpec(m)}); await pause();
        one('ИГ задание '+N+', вариант '+n+', черновик',IGS.sheet(R,'draft'),{draft:true}); await pause(); } }
    if(!only&&dz2&&window.IGL){ one('ИГ урок (вариант 5), чистовик',IGL.sheet('clean'),{model:model&&window.IG_VARS?IG_VARS[5]:null,spec:IGUI.igSpec(IG_VARS[5])}); one('ИГ урок (вариант 5), черновик',IGL.sheet('draft'),{draft:true}); }
    stat.ms=Date.now()-t0; return {issues:out,stat}; },{only,model:!o.nomodel,o3:o.ig3!==false,o4:o.ig4!==false,dz2:o.dz2!==false,igSample:o.igSample||null}); }

module.exports={runNormo,inject,SRC};

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
  const set=arg('set');   /* --set=ig3 | ig4 — только листы задания 3 или 4, --set=dz2 — только ДЗ 2 */
  const r=await runNormo(page,{only,nomodel:process.argv.includes('--nomodel'),ig3:!set||set==='ig3',ig4:!set||set==='ig4',dz2:!set||set==='dz2'});
  const by={}; r.issues.forEach(i=>{ (by[i.rule]=by[i.rule]||[]).push(i); });
  Object.entries(by).sort((a,b)=>b[1].length-a[1].length).forEach(([k,v])=>{ console.log('\n■ '+k+' — '+v.length); v.slice(0,process.argv.includes('--all')?999:6).forEach(i=>console.log('   '+i.name+': '+i.msg)); });
  console.log('\nЛистов: '+r.stat.sheets+', замечаний: '+r.issues.length+', '+Math.round(r.stat.ms/1000)+' с');
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
