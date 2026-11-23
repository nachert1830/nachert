/* Наставник: пакеты знаний ДЗ (server/lib/tutor/<дз>.json) — из того же кода, что рисует решение на сайте.
   ИГ №4 (ig4.json): для каждого из 30 вариантов — IG4S.tutor(n): шаги и точки с координатами из 3D-модели; плюс методика ДЗ.
   ИГ №3, №5, №6 (ig3, ig5, ig6.json): шаги плеера IGUI.tutor — элементы детали по порядку, точки пронумерованы как на чертеже шагов.
   Начерт №1–5 (ng1…ng5.json): для каждого варианта — решение решателя DZR.solve: шаги плеера с лесенкой «намёк → почему →
   шаг → числа → проверь себя» (подзадачи а), б)… — подряд), точки с координатами из «Чисел», ответ; методика типа варианта.
   node tools/tutor-pack.js [ig4 ng2 …]          — собрать и записать (по умолчанию все; ≈ 1–2 мин, браузер Playwright)
   node tools/tutor-pack.js --check [ig4 ng2 …]  — только сравнить с файлами: код выхода 1, если решение на сайте поменялось, а пакет нет
   Тот же снимок делает tests/tutor.js (выборочно), поэтому забытая пересборка видна в проверке сайта. */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..'), outOf=dz=>path.join(ROOT,'server','lib','tutor',dz+'.json'), OUT=outOf('ig4');
const ALL=['ig4','ng1','ng2','ng3','ng4','ng5','ig3','ig5','ig6'];

/* снимок в браузере: страница сайта уже открыта, DZR и IG4S загружены */
function snapshot(list){ /* выполняется в браузере */
  const txt=h=>String(h==null?'':h).replace(/<li>/g,'\n• ').replace(/<br\s*\/?>/g,'\n').replace(/<\/p>\s*<p>/g,'\n').replace(/<[^>]+>/g,'')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/[ \t]+\n/g,'\n').trim();
  const D=DZR.get('ig4'), M=D.method, T=M.types&&M.types.all||{};
  const method={essence:txt(M.essence),idea:txt(M.idea),plan:(T.plan||[]).map(p=>({t:txt(p.t),d:txt(p.d),why:txt(p.why)})),answer:txt(T.answer),
    check:(T.check||[]).map(txt),mistakes:(M.mistakes||[]).map(txt),defense:(M.defense||[]).map(q=>({q:txt(q.q),a:txt(q.a)})),sheet:(M.sheet||[]).map(txt)};
  const variants={};
  list.forEach(n=>{ const m=D.part(n); if(!m) return; const t=IG4S.tutor(m);
    variants[n]={title:t.title,note:txt(m.note||''),steps:t.steps.map(s=>({k:s.k,id:s.id,title:s.title,short:s.short,more:s.more,
      points:s.points.map(p=>({n:p.n,x:p.x,y:p.y,z:p.z,how:p.how}))}))}; });
  return {dz:'ig4',title:D.title,label:D.label,text:txt(D.text),method,variants}; }

/* снимок ДЗ по начерту (выполняется в браузере): решение каждого варианта — DZR.solve(dz, n) */
function snapshotNg(a){ const dz=a.dz, list=a.list;
  const txt=h=>String(h==null?'':h).replace(/<li>/g,'\n• ').replace(/<br\s*\/?>/g,'\n').replace(/<\/p>\s*<p>/g,'\n').replace(/<\/(?:div|tr)>/g,'\n').replace(/<\/t[dh]>/g,' ')
    .replace(/<sub>([^<]*)<\/sub>/g,(m,a)=>a.replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[d])).replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{2,}/g,'\n').trim();
  /* таблица данных: «B(115; 100; 125), C(…)» */
  const table=h=>{ const rows=[...String(h||'').matchAll(/<tr>(.*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/g)].map(c=>txt(c[1])));
    if(rows.length<2) return txt(h); const head=rows[0].slice(1); return rows.slice(1).map(r=>r[0]+'('+r.slice(1).map(v=>String(v).replace('.',',')).join('; ')+')'+(head.join('')==='xyz'?'':' ['+head.join(', ')+']')).join(', '); };
  /* лесенка шага из вёрстки плеера: l1 намёк, l2 почему так, l3 шаг, l4 числа, l5 проверь себя */
  const ladder=s=>{ const L={}; for(const m of String(s.tbl||'').matchAll(/<details class="hw-l (l\d)[^>]*><summary>[^<]*<\/summary>([\s\S]*?)<\/details>/g)) L[m[1]]=txt(m[2]);
    if(!L.l3) L.l3=txt(s.d||s.tbl); if(!L.l2&&s.why) L.l2=txt(s.why); return L; };
  const SUB='₀₁₂₃₄₅₆₇₈₉', norm=l=>String(l).replace(/<sub>([^<]*)<\/sub>/g,(m,a)=>a.replace(/\d/g,d=>SUB[d])).replace(/<[^>]+>/g,'').replace(/[″′‴'"]+/g,'').trim();
  /* точки шага: подписи точек (A″, 1′, A₁ ≡ N…) без штрихов — имена; номера-цифры — числа (их проверяет сверщик) */
  const ptName=/^(?:\d{1,3}|[A-ZА-Я][₀-₉]*|[A-ZА-Я]?\d{1,2}[₀-₉]*)$/;
  const pointsOf=(s,coords)=>{ const seen=new Set(), out=[];
    (s.add||[]).forEach(it=>{ if(it.t!=='pt'||!it.l) return; String(it.l).split(/\s*[≡=]\s*/).forEach(l=>{ const n=norm(l); if(!n||!ptName.test(n)||seen.has(n)) return; seen.add(n);
      const c=coords[n]; out.push(Object.assign({n:/^\d+$/.test(n)?+n:n},c?{x:c[0],y:c[1],z:c[2]}:{})); }); });
    return out; };
  const D=DZR.get(dz), M=D.method;
  const plan=T=>(T&&T.plan||[]).map(p=>typeof p==='string'?{t:txt(p),d:'',why:''}:{t:txt(p.t),d:txt(p.d),why:txt(p.why)});
  const types={}; Object.keys(M.types||{}).forEach(code=>{ const T=M.types[code]; types[code]={idea:txt(T.idea),plan:plan(T),answer:txt(T.answer),check:(T.check||[]).map(txt),
    mistakes:(T.mistakes||[]).map(txt),defense:(T.defense||[]).map(q=>({q:txt(q.q),a:txt(q.a)}))}; });
  const method={essence:txt(M.essence),idea:txt(M.idea),mistakes:(M.mistakes||[]).map(txt),defense:(M.defense||[]).map(q=>({q:txt(q.q),a:txt(q.a)})),sheet:(M.sheet||[]).map(txt),types};
  const variants={};
  list.forEach(n=>{ let r; try{ r=DZR.solve(dz,n); }catch(e){ return; } if(!r||!r.task) return; const t=r.task, ty=DZR.typeOf(dz,n)||{};
    const parts=t.parts&&t.parts.length?t.parts:[{l:'',q:'',steps:t.steps||[],ans:t.ans}], steps=[]; let k=0;
    parts.forEach((p,pi)=>(p.steps||[]).forEach((s,si)=>{ const L=ladder(s), coords={};
      for(const m of (L.l4||'').matchAll(/([A-ZА-Я][₀-₉]*|\d{1,2})\s*\(\s*([−-]?\d+(?:,\d+)?)\s*;\s*([−-]?\d+(?:,\d+)?)\s*;\s*([−-]?\d+(?:,\d+)?)\s*\)/g))
        coords[m[1]]=[m[2],m[3],m[4]].map(v=>+v.replace('−','-').replace(',','.'));
      k++; steps.push({k,id:'p'+(pi+1)+'s'+(si+1),part:p.l?txt(p.l):undefined,title:txt(s.t),idea:[L.l1,L.l2].filter(Boolean).join('\n'),short:L.l3||'',more:[L.l4,L.l5&&('Проверь себя: '+L.l5)].filter(Boolean).join('\n'),
        points:pointsOf(s,coords)}); }));
    variants[n]={title:ty.name||D.title,type:ty.code||null,task:txt(t.q)+(t.data?'\nДанные: '+table(t.data):''),
      parts:parts.length>1?parts.map((p,pi)=>({l:txt(p.l),q:txt(p.q),answer:txt(p.ans),from:steps.findIndex(s=>s.id==='p'+(pi+1)+'s1')+1})):undefined,
      answer:txt(t.ans||parts.map(p=>p.ans&&(txt(p.l)+': '+txt(p.ans))).filter(Boolean).join('\n')),steps}; });
  return {dz,kind:'ng',course:'ng',title:D.title,label:D.label,text:'',method,variants}; }

/* снимок ИГ №3, №5, №6 (выполняется в браузере): шаги плеера IGUI (тот же список, что видит студент), точки — как на чертеже шагов */
function snapshotIg(a){ const dz=a.dz, list=a.list;
  const txt=h=>String(h==null?'':h).replace(/<li>/g,'\n• ').replace(/<br\s*\/?>/g,'\n').replace(/<\/p>\s*<p>/g,'\n').replace(/<[^>]+>/g,'')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/[ \t]+\n/g,'\n').trim();
  const D=DZR.get(dz), M=D.method, T=M.types&&M.types.all||{};
  const method={essence:txt(M.essence),idea:txt(M.idea),plan:(T.plan||[]).map(p=>({t:txt(p.t),d:txt(p.d),why:txt(p.why)})),answer:txt(T.answer),
    check:(T.check||[]).map(txt),mistakes:(M.mistakes||[]).map(txt),defense:(M.defense||[]).map(q=>({q:txt(q.q),a:txt(q.a)})),sheet:(M.sheet||[]).map(txt)};
  const variants={};
  list.forEach(n=>{ const m=D.part(n); if(!m) return; const st=IGUI.tutor(m,0);
    variants[n]={title:txt(m.title||''),note:txt(m.note||''),steps:st.map(s=>({k:s.k,id:s.id,title:s.title,short:s.short,more:'',points:s.points}))}; });
  return {dz,kind:'ig',course:'ig',title:D.title,label:D.label,text:txt(D.text),method,variants}; }

function serve(){ return new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.js')?'text/javascript':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); }); }

/* пакет без даты и прочего шума: одинаковый код — одинаковый файл */
const stringify=o=>JSON.stringify(o,null,0).replace(/\},\{"k"/g,'},\n{"k"').replace(/\},"(\d+)":\{/g,'},\n"$1":{')+'\n';

async function build(page,list){ return page.evaluate(snapshot,list); }
/* любой ДЗ: ig4 — снимок IG4S, начерт — снимок решателя */
async function buildDz(page,dz,list){ return dz==='ig4'?build(page,list):/^ig/.test(dz)?page.evaluate(snapshotIg,{dz,list}):page.evaluate(snapshotNg,{dz,list}); }
module.exports={snapshot,snapshotNg,snapshotIg,build,buildDz,OUT,outOf,ALL,stringify};

if(require.main===module)(async()=>{
  let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const check=process.argv.includes('--check'), want=process.argv.slice(2).filter(a=>!a.startsWith('--')), list=want.length?want:ALL;
  const bad=list.filter(d=>!ALL.includes(d)); if(bad.length){ console.error('✖ нет такого ДЗ: '+bad.join(', ')+' (есть: '+ALL.join(', ')+')'); process.exit(1); }
  const srv=await serve();
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage(), errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.addInitScript(()=>{ try{ localStorage.setItem('nch-preview-ok','1'); }catch(e){} }); await page.goto('http://127.0.0.1:'+srv.address().port+'/new/#/ig/dz/4/1'); await page.waitForFunction(()=>window.IG4S&&window.IGUI&&IGUI.tutor&&window.DZR&&DZR.get('ig4')&&DZR.get('ng1'),null,{timeout:30000});
  let fail=0;
  for(const dz of list){ const pack=await buildDz(page,dz,Array.from({length:30},(_,i)=>i+1)), n=Object.keys(pack.variants).length, OUTF=outOf(dz);
    const want=await page.evaluate(dz=>{ const D=DZR.get(dz); return D.part?Array.from({length:30},(_,i)=>i+1).filter(n=>D.part(n)).length:30; },dz);   /* ИГ №5: моделей 27 из 30 */
    if(n!==want||errs.length){ console.error('✖ '+dz+': собрано вариантов '+n+' из '+want+(errs.length?'; ошибки JS: '+errs.join(' / '):'')); fail=1; continue; }
    const out=stringify(pack);
    if(check){ const cur=fs.existsSync(OUTF)?fs.readFileSync(OUTF,'utf8'):'';
      if(cur===out) console.log(dz+': пакет наставника совпадает с решением на сайте.');
      else { console.error('✖ '+dz+': пакет наставника устарел — решение на сайте поменялось. Пересоберите: node tools/tutor-pack.js '+dz); fail=1; } continue; }
    fs.mkdirSync(path.dirname(OUTF),{recursive:true}); fs.writeFileSync(OUTF,out);
    console.log('Записан '+path.relative(ROOT,OUTF)+': '+n+' вариантов, '+Math.round(out.length/1024)+' КБ'); }
  await browser.close(); srv.close(); process.exit(fail);
})().catch(e=>{ console.error(e); process.exit(1); });
