/* Движок размеров ИГ (IGS.dimFix, ГОСТ 2.307) — все листы и все чертежи «дано».
   На каждом листе (ДЗ 2 и задания 3–8, все варианты) и на каждом чертеже «Задание» (данные изображения с размерами условия):
   - каждая выносная линия начинается на элементе, к которому стоит размер: продолжает линию изображения (ребро, ось, касательную
     к окружности) или начинается в вершине; движок сам переносит точку размера вдоль выносной на элемент, проводит ось у
     симметричного элемента, ставит размерную линию с одной стрелкой на половине вида и половине разреза, переносит диаметр на вид,
     где элемент — окружность; что он не смог — ошибка;
   - стрелка диаметра — на окружности, которая нарисована; стрелка выноски — на линии изображения;
   - чертёж «дано» проходит нормоконтроль размеров (tests/normo.js, правила ГОСТ 2.307 и масштаб 1:1) по готовому SVG.
   node tests/dims-engine.js [--set=ig3] [--only=1,2]   — отдельно; из tests/run.js — блок igs (runDims). */
const fs=require('fs'), path=require('path');

async function runDims(page,o){ o=o||{};
  await require('./normo-run.js').inject(page);
  return page.evaluate(async({sets,only})=>{ const out=[], pause=()=>new Promise(r=>setTimeout(r,0)), stat={sheets:0,given:0};
    const dimRule=i=>/^2\.30[27]$/.test(i.gost);
    const nm=d=>d[0]+' '+d[1]+' «'+(d.find((x,i)=>i>1&&typeof x==='string')||'')+'»';
    for(const id of sets){ for(let n=1;n<=30;n++){ if(only&&!only.includes(n)) continue; let m, R;
        if(id==='dz2'){ if(!window.IG_VARS||!IG_VARS[n]) continue; m=IG_VARS[n]; R=n; }
        else { const PN=window.DZR&&DZR.get(id); if(!PN||!PN.part) break; m=PN.part(n); if(!m) continue; R={md:m,nv:n,key:id+'-'+n,dims:m.dims||[]}; }
        const name=(id==='dz2'?'ИГ ДЗ 2':'ИГ задание '+id.slice(2))+', вариант '+n;
        try{ IGS.sheet(R,'clean'); stat.sheets++; IGS.dimReport(R,'clean').forEach(b=>out.push({name:name+', лист',rule:'движок размеров: '+b.why,msg:nm(b.d)})); }
        catch(e){ out.push({name:name+', лист',rule:'ошибка',msg:String(e).slice(0,160)}); }
        if(id!=='dz2'&&Array.isArray(m.dims)&&m.dims.length&&!m.noGivenDims){ let svg='';
          try{ svg=IGUI.sheetSVG(m,'','','','given'); stat.given++; }catch(e){ out.push({name:name+', дано',rule:'ошибка',msg:String(e).slice(0,160)}); }
          (m._givenDimBad||[]).forEach(b=>out.push({name:name+', дано',rule:'движок размеров: '+b.why,msg:nm(b.d)}));
          if(svg) NORMO.check(svg,{}).issues.filter(dimRule).forEach(i=>out.push({name:name+', дано',rule:'ГОСТ '+i.gost+' · '+i.rule,msg:i.msg+(i.at?' (у '+i.at.map(v=>Math.round(v)).join(', ')+' мм)':'')})); }
        await pause(); } }
    return {issues:out,stat}; },{sets:o.sets||['dz2','ig3','ig4','ig5','ig6','ig8'],only:o.only||null}); }

module.exports={runDims};

if(require.main===module){ (async()=>{
  const http=require('http'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const ROOT=path.join(__dirname,'..'), arg=k=>{ const a=process.argv.find(x=>x.startsWith('--'+k+'=')); return a?a.split('=')[1]:null; };
  const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.js')?'text/javascript':'application/octet-stream'}); fs.createReadStream(p).pipe(r); });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage(); page.on('pageerror',e=>console.log('JS:',String(e)));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/'); await page.waitForTimeout(1500);
  const r=await runDims(page,{sets:arg('set')?arg('set').split(','):null,only:arg('only')?arg('only').split(',').map(Number):null});
  r.issues.forEach(i=>console.log(i.name+' | '+i.rule+' | '+i.msg));
  console.log('\nЛистов: '+r.stat.sheets+', чертежей «дано»: '+r.stat.given+', замечаний: '+r.issues.length);
  await browser.close(); srv.close(); process.exit(r.issues.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); }); }
