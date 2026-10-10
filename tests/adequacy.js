/* ═══════════ Адекватность проверки (обязательство O8): мутации КОДА задач ═══════════
   mutate.js портит готовый рисунок; здесь портится программа, которая его строит, — так ошибаются люди:
     F↔H        проекция взята не с того поля: F(A) вместо H(A);
     ось        не та координата: P[1] вместо P[2];
     знак       не тот знак действия: a − b вместо a + b;
     число      опечатка в числе (±6…24 %);
     штрих      подпись не того поля: 'K″' вместо 'K′';
     линия      видимая линия стала штриховой и наоборот: 'main' ↔ 'hid'.
   В каждом блоке задач по одной правке на мутанта; блок выполняется заново. Мутант без видимых изменений
   (точки, линии, тип линий, текст те же) — эквивалентный, не считается. Остальные должны быть пойманы:
   новое замечание GEOM_CHECK, ORACLE_CHECK или PROV_CHECK.
   node tests/adequacy.js [--per=4] [--seed=5] [--out=файл.json] → доля пойманных по видам, без и с трассировкой. */
const fs=require('fs'), path=require('path');
const R=require('./random.js'), {isolate}=require('./random-run.js');
let acorn; try{ acorn=require('acorn'); }catch(e){ acorn=require('/opt/node-tools/node_modules/acorn'); }

function sites(src,rnd){
  let ast; try{ ast=acorn.parse(src,{ecmaVersion:'latest'}); }catch(e){ return []; }
  const out=[];
  (function walk(n,inFor){ if(!n||typeof n.type!=='string') return;
    if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&(n.callee.name==='F'||n.callee.name==='H'))
      out.push({op:'F↔H',start:n.callee.start,end:n.callee.end,to:n.callee.name==='F'?'H':'F'});
    if(n.type==='MemberExpression'&&n.computed&&n.property.type==='Literal'&&[0,1,2].includes(n.property.value))
      out.push({op:'ось',start:n.property.start,end:n.property.end,to:String((n.property.value+1+Math.floor(rnd()*2))%3)});
    if(n.type==='BinaryExpression'&&'+-*/'.includes(n.operator)&&![n.left,n.right].some(x=>x.type==='TemplateLiteral'||(x.type==='Literal'&&typeof x.value==='string'))){
      const at=src.indexOf(n.operator,n.left.end); if(at>=0&&at<n.right.start) out.push({op:'знак',start:at,end:at+1,to:{'+':'-','-':'+','*':'/','/':'*'}[n.operator]}); }
    if(n.type==='Literal'&&typeof n.value==='number'&&!inFor&&!(Number.isInteger(n.value)&&Math.abs(n.value)<5)){
      const v=n.value*(1+(rnd()<.5?-1:1)*(0.06+rnd()*0.18)), nv=Math.abs(n.value)>=20?Math.round(v*10)/10:Math.round(v*1000)/1000;
      if(nv!==n.value) out.push({op:'число',start:n.start,end:n.end,to:String(nv)}); }
    if(n.type==='Literal'&&typeof n.value==='string'){
      if(/^[A-ZА-Я0-9][₀-₉0-9]*[′″]$/.test(n.value)) out.push({op:'штрих',start:n.start,end:n.end,to:"'"+n.value.slice(0,-1)+(n.value.endsWith('′')?'″':'′')+"'"});
      if(n.value==='main'||n.value==='hid') out.push({op:'линия',start:n.start,end:n.end,to:n.value==='main'?"'hid'":"'main'"}); }
    for(const k in n){ if(k==='type'||k==='start'||k==='end') continue; const c=n[k];
      const f=inFor||(/^For/.test(n.type)&&k!=='body');
      if(Array.isArray(c)) c.forEach(x=>walk(x,f)); else if(c&&typeof c.type==='string') walk(c,f); } })(ast,false);
  return out;
}

async function runAdequacy(page,opts){
  opts=opts||{}; const PER=opts.per||4; let seed=opts.seed||5; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
  for(const f of ['geometry','oracle','provenance']) await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')});
  await page.evaluate(()=>PROV_INSTRUMENT());
  /* задачи с сертификатом (tests/certified): опубликованный чертёж каждого мутанта сверяется с доказанной моделью */
  const {certify}=require('./certified/certify.js'), CERT={}; require('./certified/run.js').TASKS.forEach(T=>CERT[T.n]=T);
  await page.evaluate(ns=>{ window.__CERT_N=ns; },Object.keys(CERT).map(Number));
  const certOk=(n,site)=>{ if(!CERT[n]||!site) return null; try{ return certify(CERT[n],{site,variants:0}).ok; }catch(e){ return false; } };
  const run=src=>page.evaluate(src=>{
    const keep=WB3.tasks.slice(), old=new Set(keep); let added=[], err=null; window.__RVERR=[];
    try{ (0,eval)(src); added=WB3.tasks.filter(t=>!old.has(t)); }catch(e){ err=String(e&&e.message||e); }
    const res=[];
    if(!err) added.forEach(t=>{ const parts=(t.parts&&t.parts.length)?t.parts:[t]; const vis=[];
      parts.forEach((p,pi)=>{ [].concat(p.given||t.given||[],...(p.steps||[]).map(s=>s.add||[])).forEach(it=>{ if(!it) return;
          const r=a=>Array.isArray(a)&&a.length===2?Math.round(a[0]*2)+','+Math.round(a[1]*2):'';
          if(it.t==='pt') vis.push('p'+pi+'|'+it.l+'|'+r(it.at));
          else if(it.a&&it.b) vis.push('s'+pi+'|'+it.t+'|'+(it.k||'')+'|'+(it.l||'')+'|'+r(it.a)+'|'+r(it.b));
          else if(it.p) vis.push('q'+pi+'|'+it.t+'|'+(it.k||'')+'|'+it.p.map(r).join(';'));
          else if(it.c) vis.push('c'+pi+'|'+it.t+'|'+(it.k||'')+'|'+r(it.c)+'|'+Math.round((it.r||0)*2)); });
        (p.steps||[]).forEach(s=>vis.push('t|'+s.t+'|'+s.d+'|'+s.why)); vis.push('a|'+p.ans); });
      vis.push('A|'+t.ans+'|'+t.note+'|'+t.intro);
      const k=o=>o.name.replace(/ · (шаг \d+|дано)$/,'')+'|'+o.rule;
      /* трассировка — первой: GEOM_CHECK «доводит» линии (LINEFIX) и заменяет координаты копиями без пометок */
      let old=[], prov=[]; try{ prov=PROV_CHECK({tasks:[t]}).map(k); }catch(e){ prov=['сбой']; }
      try{ old=GEOM_CHECK({tasks:[t]}).concat(ORACLE_CHECK({tasks:[t]})).map(k); }catch(e){ old=['сбой']; }
      let site=null; if((window.__CERT_N||[]).includes(t.n)){ const p=parts[0], strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').trim(), points={}, lines={}, segs=[];
        [].concat(p.given||t.given||[],...(p.steps||[]).map(s=>s.add||[])).filter(Boolean).forEach(it=>{
          if(it.t==='pt'&&it.at&&it.l) strip(it.l).split(/\s*≡\s*/).forEach(l=>{ if(!points[l]) points[l]=it.at.slice(); });
          if((it.t==='seg'||it.t==='line')&&it.a&&it.b&&it.l){ const l=strip(it.l); (lines[l]=lines[l]||[]).push(it.a.slice(),it.b.slice()); }
          if(it.t==='seg'&&it.a&&it.b) segs.push({a:it.a.slice(),b:it.b.slice(),k:it.k||'main'}); });
        site={points,lines,segs,ans:strip(t.ans)}; }
      res.push({n:t.n,vis:vis.join('\n'),old,prov,site}); });
    WB3.tasks.length=0; keep.forEach(t=>WB3.tasks.push(t));
    return {err,res}; },src);
  const by={}, survivors=[]; let total=0, equiv=0, crashed=0;
  const bump=(k,a,b)=>{ const o=by[k]=by[k]||{n:0,old:0,all:0}; o.n++; if(a) o.old++; if(a||b) o.all++; };
  const cby={}, csurv=[]; const cbump=(k,a,b,c)=>{ const o=cby[k]=cby[k]||{n:0,old:0,all:0,cert:0}; o.n++; if(a) o.old++; if(a||b) o.all++; if(a||b||c) o.cert++; };
  for(const b of R.blocks().filter(b=>!opts.only||opts.only.some(n=>new RegExp('n:'+n+'\\b').test(b.src)))){
    const src0=isolate(b.src), base=await run(src0); if(base.err) continue;
    const B={}; base.res.forEach(r=>B[r.n]=r);
    const all=sites(src0,rnd), ops=[...new Set(all.map(s=>s.op))];
    for(const op of ops){ const pool=all.filter(s=>s.op===op);
      for(let k=0;k<PER&&pool.length;k++){ const S=pool.splice(Math.floor(rnd()*pool.length),1)[0];
        const m=await run(src0.slice(0,S.start)+S.to+src0.slice(S.end)); total++;
        if(m.err){ crashed++; continue; }   /* блок перестал выполняться — это видно сразу (сайт не построит задачу) */
        m.res.forEach(r=>{ const b0=B[r.n]; if(!b0) return; if(r.vis===b0.vis){ equiv++; return; }
          const o0=new Set(b0.old), p0=new Set(b0.prov);
          const a=r.old.some(x=>!o0.has(x)), p=r.prov.some(x=>!p0.has(x));
          bump(op,a,p); bump('всего',a,p);
          if(CERT[r.n]&&b0.site&&certOk(r.n,b0.site)){ const c=certOk(r.n,r.site)===false; cbump(op,a,p,c); cbump('всего',a,p,c);
            if(!a&&!p&&!c) csurv.push({task:'№'+r.n,op,ctx:(src0.slice(Math.max(0,S.start-60),S.start)+'⟦'+src0.slice(S.start,S.end)+'→'+S.to+'⟧'+src0.slice(S.end,S.end+35)).replace(/\s+/g,' ')}); }
          if(!a&&!p&&survivors.length<1000) survivors.push({task:'№'+r.n,op,ctx:(src0.slice(Math.max(0,S.start-60),S.start)+'⟦'+src0.slice(S.start,S.end)+'→'+S.to+'⟧'+src0.slice(S.end,S.end+35)).replace(/\s+/g,' ')}); }); } } }
  return {by,cby,csurv,survivors,total,equiv,crashed};
}
module.exports={runAdequacy,sites};

if(require.main===module)(async()=>{
  const http=require('http'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const arg=k=>{ const a=process.argv.find(x=>x.startsWith('--'+k+'=')); return a&&a.split('=')[1]; };
  const ROOT=path.join(__dirname,'..');
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined});
  const page=await browser.newPage(); await page.goto('http://127.0.0.1:'+srv.address().port+'/'); await page.waitForTimeout(1500);
  const r=await runAdequacy(page,{per:+(arg('per')||4),seed:+(arg('seed')||5),only:arg('only')?arg('only').split(',').map(Number):null});
  const pc=(a,n)=>a+'/'+n+' ('+Math.round(100*a/Math.max(1,n))+'%)';
  console.log('Мутантов '+r.total+': не выполнились '+r.crashed+', эквивалентных (ничего не изменилось) '+r.equiv);
  console.log('вид        | ловила прежняя проверка | с трассировкой');
  Object.entries(r.by).sort((a,b)=>a[0]==='всего'?1:b[0]==='всего'?-1:0).forEach(([k,v])=>console.log(k.padEnd(10)+' | '+pc(v.old,v.n).padEnd(23)+' | '+pc(v.all,v.n)));
  if(Object.keys(r.cby).length){ console.log('\nЗадачи с сертификатом (№'+require('./certified/run.js').TASKS.map(T=>T.n).join(', №')+'):');
    console.log('вид        | прежняя проверка        | + трассировка           | + сертификат');
    Object.entries(r.cby).sort((a,b)=>a[0]==='всего'?1:b[0]==='всего'?-1:0).forEach(([k,v])=>console.log(k.padEnd(10)+' | '+pc(v.old,v.n).padEnd(23)+' | '+pc(v.all,v.n).padEnd(23)+' | '+pc(v.cert,v.n))); }
  if(arg('out')) fs.writeFileSync(arg('out'),JSON.stringify(r,null,1));
  await browser.close(); srv.close();
})().catch(e=>{ console.error(e); process.exit(2); });
