/* ═══════════ Все варианты ДЗ: каждый разбор строится ядром и проходит проверки сайта ═══════════
   Данные — variants/ (таблицы заданий). Для каждого варианта ядро строит разбор (шаги, чертёж) тем же кодом,
   что пример на сайте, и разбор проходит те же проверки, что пример: ДЗ-оракул (условие и ответ числами),
   3D-проверка чертежа, «Евклид» (построимость), арифметика в тексте.
   node tests/variants-run.js [--only=dz2,dz3] [--n=1,7]   — отдельный прогон;  runVariants(page) — из tests/run.js */
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
/* разобранные вручную совпадения — tests/variants-baseline.json (ключ «вариант | правило | сообщение») */
const ACCEPTED=new Set(JSON.parse(fs.readFileSync(path.join(__dirname,'variants-baseline.json'),'utf8')).accepted.map(a=>a.key));
const fresh=list=>list.filter(x=>!ACCEPTED.has([x.name,x.rule,x.msg].join(' | ')));

/* файлы данных и ядра — в порядке загрузки (ядро после данных) */
const FILES=['variants/ng/dz1.js','variants/ng/dz2.js','variants/ng/dz3.js','variants/ng/dz4.js','variants/ng/dz5.js','kernel/ng.js','kernel/ng-dz1.js','kernel/ng-dz5.js','kernel/sheet.js'];
/* две независимые расшифровки таблиц ДЗ №2 и №3 (variants/ и core/dz-variants.js) обязаны совпасть */
function dataCheck(){ const out=[], C=require('../core/dz-variants.js');
  [['dz2',C.DZ2],['dz3',C.DZ3]].forEach(([dz,ref])=>{ const V=require('../variants/ng/'+dz+'.js').V;
    for(let n=1;n<=30;n++){ const a=V[n], b=ref[n]; if(!a||!b){ out.push({name:dz+' в.'+n,rule:'данные',msg:'нет варианта в одной из расшифровок'}); continue; }
      const ks=new Set([...Object.keys(a),...Object.keys(b)]); ks.forEach(k=>{ if(JSON.stringify(a[k])!==JSON.stringify(b[k])) out.push({name:dz+' в.'+n,rule:'данные: две расшифровки расходятся',msg:k+': '+JSON.stringify(a[k])+' и '+JSON.stringify(b[k])}); }); } });
  return out; }
async function loadAll(page){
  for(const f of FILES)
    if(fs.existsSync(path.join(ROOT,f))) await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,f),'utf8')});
  for(const f of ['geometry','euclid','arith','dz']) await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')});
}

/* opts: {only:['dz2',…], n:[1,7]} → {checked, list:[{name,rule,msg}]} */
async function runVariants(page,opts){ opts=opts||{};
  return page.evaluate(o=>{ const out=[]; let checked=0;
    const dzs=(o.only&&o.only.length?o.only:NGK.list()).filter(d=>NGK.has(d));
    dzs.forEach(dz=>NGK.numbers(dz).forEach(n=>{ if(o.n&&o.n.length&&!o.n.includes(n)) return;
      const name=dz+' в.'+n; let r;
      try{ r=NGK.solve(dz,n); }catch(e){ out.push({name,rule:'сбой построения',msg:String(e&&e.stack||e).slice(0,300)}); return; }
      if(!r||!r.task){ out.push({name,rule:'нет разбора',msg:r&&r.why||''}); return; }
      checked++;
      (r.cert||[]).forEach(m=>out.push({name,rule:'условие задачи (сертификат ядра)',msg:m}));
      const add=(rule,list)=>list.forEach(x=>out.push({name,rule:rule+(x.rule?' · '+x.rule:''),msg:(x.name?x.name+': ':'')+(x.msg||'')}));
      try{ if(r.hwId&&DZ_IDS.includes(r.hwId)) add('ДЗ-оракул',DZ_CHECK({get:id=>id===r.hwId?{task:r.task}:{task:null}}).filter(x=>!/нет разбора/.test(x.rule))); }catch(e){ out.push({name,rule:'сбой ДЗ-оракула',msg:String(e)}); }
      try{ add('3D-проверка',GEOM_CHECK({tasks:[Object.assign({n:name},r.task)]})); }catch(e){ out.push({name,rule:'сбой 3D-проверки',msg:String(e)}); }
      try{ add('«Евклид»',EUCLID_CHECK({tasks:[Object.assign({n:name},r.task)]})); }catch(e){ out.push({name,rule:'сбой «Евклида»',msg:String(e)}); }
      try{ add('арифметика',ARITH_CHECK({tasks:[Object.assign({n:name},r.task)]})); }catch(e){ out.push({name,rule:'сбой арифметики',msg:String(e)}); }
      /* листы: строятся, без NaN, всё нарисованное — внутри рамки (20/5/5/5 на А3 297 × 420) */
      if(window.SHEET) ['final','draft'].forEach(mode=>{ try{ const src=VARIANTS.ng[dz], pts=typeof src.points==='function'?src.points(n):src.points;
          const sh=SHEET.ng(r,{title:dz,sub:'',n,points:pts,data:src.V[n]},mode);
          if(/NaN|undefined|Infinity/.test(sh.svg)) out.push({name,rule:'лист ('+mode+')',msg:'в SVG есть NaN/undefined'});
          const xs=[], ys=[]; sh.svg.replace(/<(line|circle|path|text)\b([^>]*)>/g,(m,t,a)=>{ const g=k=>{ const q=new RegExp(' '+k+'="([-\\d.]+)"').exec(a); return q?+q[1]:null; };
            if(t==='line'){ xs.push(g('x1'),g('x2')); ys.push(g('y1'),g('y2')); } if(t==='circle'){ const r0=g('r')||0; xs.push(g('cx')-r0,g('cx')+r0); ys.push(g('cy')-r0,g('cy')+r0); } if(t==='text'){ xs.push(g('x')); ys.push(g('y')); }
            if(t==='path'){ String((/ d="([^"]*)"/.exec(a)||[])[1]||'').replace(/([MLA])([^MLAZ]*)/g,(mm,c,body)=>{ const v=body.trim().split(/[\s,]+/).map(Number); if(c==='A'&&v.length>=7){ xs.push(v[5]); ys.push(v[6]); } else for(let i=0;i+1<v.length;i+=2){ xs.push(v[i]); ys.push(v[i+1]); } return mm; }); } return m; });
          const X=xs.filter(v=>v!=null), Y=ys.filter(v=>v!=null), bad=X.some(v=>v<19.5||v>297)||Y.some(v=>v<4.5||v>420);
          if(bad) out.push({name,rule:'лист ('+mode+')',msg:'чертёж выходит за рамку: x '+Math.min(...X).toFixed(1)+'…'+Math.max(...X).toFixed(1)+', y '+Math.min(...Y).toFixed(1)+'…'+Math.max(...Y).toFixed(1)});
        }catch(e){ out.push({name,rule:'сбой листа ('+mode+')',msg:String(e&&e.stack||e).slice(0,200)}); } });
    }));
    return {checked,list:out}; },opts); }

module.exports={runVariants,loadAll,fresh,dataCheck,FILES};

if(require.main===module)(async()=>{
  const http=require('http'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const arg=k=>(process.argv.find(a=>a.startsWith('--'+k+'='))||'').split('=')[1]||'';
  const only=arg('only').split(',').filter(Boolean), nn=arg('n').split(',').filter(Boolean).map(Number);
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.js')?'text/javascript':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined});
  const page=await browser.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/'); await page.waitForTimeout(1500);
  await loadAll(page);
  const r=await runVariants(page,{only,n:nn}); r.list=dataCheck().concat(r.list); const all=r.list.length; r.list=fresh(r.list);
  const by={}; r.list.forEach(x=>{ (by[x.name]=by[x.name]||[]).push(x); });
  Object.entries(by).forEach(([k,l])=>{ console.log(k+': '+l.length); l.slice(0,6).forEach(x=>console.log('   · '+x.rule+' — '+String(x.msg).slice(0,220))); });
  console.log('Проверено вариантов: '+r.checked+', замечаний: '+r.list.length+' (разобранных вручную: '+(all-r.list.length)+')'+(errs.length?'; ошибки страницы: '+errs.slice(0,3).join(' | '):''));
  await browser.close(); srv.close(); process.exit(r.list.length?1:0);
})();
