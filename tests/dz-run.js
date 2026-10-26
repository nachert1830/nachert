/* ═══════════ ДЗ №2 и №3 на случайных вариантах ═══════════
   У каждого студента свой вариант, поэтому разбор ДЗ должен быть верен на любых данных, а не только на нашем примере.
   Блок ДЗ (тот же код, что на сайте) пересобирается с искажёнными исходными данными (каждая координата ± до 12 мм,
   целые — как в таблицах вариантов), и каждый вариант проходит ДЗ-оракул (tests/dz.js).
   Вариант, в котором задача теряет смысл (прямая почти параллельна плоскости, вершина за пределами листа, тело
   вырождено), отбрасывается до проверки — по условию, а не по результату проверки.
   node tests/dz-run.js [--seeds=40]  — отдельный прогон; runDzVariants(page,n) — из tests/run.js */
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');

/* исходный текст блока ДЗ на сайте и строки данных каждого примера */
function source(){ const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const a=html.indexOf('/* ДЗ №1–5: методика и разобранные примеры. */'), b=html.indexOf('window.NGHW={',a), c=html.indexOf('})();',b)+5;
  if(a<0||b<0) throw new Error('блок ДЗ не найден');
  return html.slice(a,c); }
const DATA={
  '2':  /(HW\.calcOf\[2\] = function\(VAR_\)\{\n  let )([^;]*)(;)/,
  '2b': /(HW\.calcOf\['2b'\] = function\(VAR_\)\{\n  let )([^;]*)(;)/,
  '2c': /(HW\.calcOf\['2c'\] = function\(VAR_\)\{\n  let )([^;]*)(;)/,
  '3':  /(HW\.calcOf\[3\] = function\(VAR_\)\{\n  let )([^;]*)(;)/ };
/* искажение: только точки-тройки [x,y,z]; длины из условия (Hh, L0) не трогаем */
/* прямая из условия (EF, BC, AK) не должна стать профильной (|Δx| < 6 мм): для неё метод через h и f не работает
   и в вариантах задания таких нет — такой вариант перебрасывается */
const LINES={'2':[['E','Pf']],'2b':[['B','C'],['E','Fp']],'2c':[['A','K'],['E','Fp']],'3':[]};
function perturb(src,seed){ let s=seed>>>0||1; const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
  Object.entries(DATA).forEach(([id,re])=>{ src=src.replace(re,(m,p,body,e)=>{ for(;;){
    const nb=body.replace(/\[(-?\d+),(-?\d+),(-?\d+)\]/g,(t,...v)=>'['+v.slice(0,3).map(x=>Math.round(+x+(rnd()-0.5)*24)).join(',')+']');
    const P={}; nb.replace(/(\w+)=\[(-?\d+),(-?\d+),(-?\d+)\]/g,(t,n,x,y,z)=>{ P[n]=[+x,+y,+z]; return t; });
    if(LINES[id].every(([a,b])=>Math.abs(P[a][0]-P[b][0])>=6)) return p+nb+e; } }); });
  return src; }

async function runDzVariants(page,n){ n=n||40; const src=source();
  Object.entries(DATA).forEach(([id,re])=>{ if(!re.test(src)) throw new Error('нет строки данных ДЗ '+id); });
  const res={total:0,checked:0,skipped:0,bad:{}};
  for(let k=0;k<n;k++){ const v=perturb(src,1000+k*7919);
    const r=await page.evaluate(v=>{ const old=window.NGHW; let NEW=null, err=null;
      try{ (0,eval)(v); NEW=window.NGHW; }catch(e){ err=String(e&&e.message||e); } window.NGHW=old;
      if(!NEW) return {err};
      /* вариант имеет смысл: все точки ответа — в пределах листа (|координата| < 400 мм), задача не вырождена */
      const sane=id=>{ const d=NEW.get(id); if(!d||!d.task) return false; const ok=x=>Number.isFinite(x)&&Math.abs(x)<400*L.S;
        return PLAYER.partsOf(d.task).every(p=>PLAYER.scene(p,(p.steps||[]).length).items.every(it=>(!it.at||it.at.every(ok))&&(!it.a||it.a.every(ok))&&(!it.b||it.b.every(ok)))); };
      const keep=DZ_IDS.filter(sane), list=DZ_CHECK({get:id=>keep.includes(id)?NEW.get(id):null}).filter(o=>!/нет разбора/.test(o.rule));
      return {keep,list}; },v);
    if(r.err){ (res.bad['сборка']=res.bad['сборка']||[]).push(r.err); continue; }
    res.total+=4; res.checked+=r.keep.length; res.skipped+=4-r.keep.length;
    r.list.forEach(o=>{ const key=o.name.replace(/ [а-г]\).*/,m=>m.slice(0,3))+' | '+o.rule; (res.bad[key]=res.bad[key]||[]).push('вариант '+k+': '+o.msg); }); }
  return res; }

module.exports={runDzVariants,source,perturb};

if(require.main===module&&!process.argv.includes("--mutate"))(async()=>{
  const http=require('http'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const n=+((process.argv.find(a=>a.startsWith('--seeds='))||'').split('=')[1]||40);
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined});
  const page=await browser.newPage(); await page.goto('http://127.0.0.1:'+srv.address().port+'/'); await page.waitForTimeout(1500);
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'dz.js'),'utf8')});
  const r=await runDzVariants(page,n);
  console.log('Вариантов: '+n+' × 4 разбора; проверено '+r.checked+', отброшено как вырожденные '+r.skipped);
  Object.entries(r.bad).forEach(([k,v])=>console.log('✗ '+k+' — '+v.length+' вар.: '+v.slice(0,3).join(' | ')));
  if(!Object.keys(r.bad).length) console.log('Ошибок нет.');
  await browser.close(); srv.close(); process.exit(Object.keys(r.bad).length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });

/* ═══ Проверка проверки для ДЗ: мутации КОДА разборов ДЗ №2 и №3 (те же виды, что tests/adequacy.js, + 'res' ↔ 'resd') ═══
   В блок ДЗ подсаживается одна правка; мутант без видимых изменений в разборах 2а–2в и 3 — эквивалентный, не считается.
   Пойман — новое замечание ДЗ-оракула (dz.js) или 3D-проверки (geometry.js) в любом из четырёх разборов. */
async function runDzMutations(page,opts){ opts=opts||{}; const PER=opts.per||12; let seed=opts.seed||9; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
  const {sites}=require('./adequacy.js'), src=source();
  const a=src.indexOf('/* ── 20-dz2.js ── */'), b=src.indexOf('/* ── 40-dz5.js ── */');
  const all=sites(src,rnd).filter(s=>s.start>a&&s.end<b);
  /* 'res' ↔ 'resd': видимое ребро ответа стало штриховым и наоборот */
  src.slice(a,b).replace(/'(res|resd)'/g,(m,k,off)=>{ all.push({op:'линия',start:a+off,end:a+off+m.length,to:k==='res'?"'resd'":"'res'"}); return m; });
  const sig=v=>page.evaluate(v=>{ const old=window.NGHW; let NEW=null, err=null; try{ (0,eval)(v); NEW=window.NGHW; }catch(e){ err=String(e&&e.message||e); } window.NGHW=old;
    if(!NEW) return {err};
    const r=x=>Array.isArray(x)?x.map(v=>Math.round(v*4)).join(','):'';
    /* geo — то же без «оформления»: прямая отрезка (направление и положение) вместо концов, подписи-тексты без положения */
    const car=it=>{ const dx=it.b[0]-it.a[0], dy=it.b[1]-it.a[1], L=Math.hypot(dx,dy)||1; let an=Math.atan2(dy,dx); if(an<0) an+=Math.PI; if(an>=Math.PI-1e-9) an=0; return Math.round(an*180/Math.PI*5)+'|'+Math.round((-dy*it.a[0]+dx*it.a[1])/L*2); };
    const geo=DZ_IDS.map(id=>{ const t=NEW.get(id).task; return PLAYER.partsOf(t).map(p=>PLAYER.scene(p,(p.steps||[]).length).items.map(it=>it.t==='txt'?'txt|'+it.s:it.a&&it.b&&it.t!=='sq'&&it.t!=='ang'?it.t+'|'+(it.k||'')+'|'+(it.l||'')+'|'+car(it):it.t+'|'+(it.k||'')+'|'+(it.l||'')+'|'+r(it.at)+r(it.c)+(it.r?Math.round(it.r*4):'')+(it.p?it.p.map(r).join(';'):'')+(it.t==='sq'||it.t==='ang'?[it.p1,it.p2].map(q=>Math.round(Math.atan2(q[1]-it.at[1],q[0]-it.at[0])*180/Math.PI*5)).join(','):'')).sort().join('\n')
      +(p.steps||[]).map(s=>s.t+s.d+s.why+s.tbl).join('|')+p.ans).join('#')+t.ans; }).join('@');
    const vis=DZ_IDS.map(id=>{ const t=NEW.get(id).task; return PLAYER.partsOf(t).map(p=>PLAYER.scene(p,(p.steps||[]).length).items.map(it=>it.t+'|'+(it.k||'')+'|'+(it.l||'')+'|'+r(it.at)+r(it.a)+r(it.b)+(it.p?it.p.map(r).join(';'):'')).join('\n')
      +(p.steps||[]).map(s=>s.t+s.d+s.why+s.tbl).join('|')+p.ans).join('#')+t.ans; }).join('@');
    const k=o=>o.name+'|'+o.rule;
    let dz=[], geoChk=[]; try{ dz=DZ_CHECK({get:id=>NEW.get(id)}).map(k); }catch(e){ dz=['сбой']; }
    try{ if(window.ARITH_CHECK) dz=dz.concat(ARITH_CHECK({tasks:[],dz:DZ_IDS,get:id=>NEW.get(id)}).map(o=>'А|'+k(o)+'|'+o.msg)); }catch(e){ dz.push('сбой арифметики'); }
    try{ if(window.EUCLID_CHECK) dz=dz.concat(EUCLID_CHECK({tasks:[],dz:DZ_IDS,get:id=>NEW.get(id)}).map(o=>'Е|'+k(o)+'|'+o.msg)); }catch(e){ dz.push('сбой Евклида'); }
    try{ geoChk=GEOM_CHECK({tasks:DZ_IDS.map(id=>Object.assign({},NEW.get(id).task,{n:'ДЗ '+id}))}).map(k); }catch(e){ geoChk=['сбой']; }
    return {vis,geo:geo,dz,g3d:geoChk}; },v);
  const base=await sig(src); if(base.err) throw new Error(base.err);
  const by={}, surv=[]; let total=0, equiv=0, crashed=0, data=0, cosm=0;
  const dataSpans=[]; Object.values(DATA).forEach(re=>{ const m=re.exec(src); if(m) dataSpans.push([m.index+m[1].length,m.index+m[1].length+m[2].length]); });
  const bump=(k,g,d)=>{ const o=by[k]=by[k]||{n:0,geo:0,all:0}; o.n++; if(g) o.geo++; if(g||d) o.all++; };
  const ops=[...new Set(all.map(s=>s.op))];
  for(const op of ops){ const pool=all.filter(s=>s.op===op);
    for(let k=0;k<PER&&pool.length;k++){ const S=pool.splice(Math.floor(rnd()*pool.length),1)[0], m=await sig(src.slice(0,S.start)+S.to+src.slice(S.end)); total++;
      if(m.err){ crashed++; continue; } if(m.vis===base.vis){ equiv++; continue; }
      /* «данные»: опечатка в исходных данных примера — та же программа на другом варианте (её проверяют случайные варианты);
         «оформление»: другие только длины отрезков и места подписей */
      if(dataSpans.some(([x,y])=>S.start>=x&&S.end<=y)){ data++; continue; }
      if(m.geo===base.geo){ cosm++; continue; }
      const g=m.g3d.some(x=>!base.g3d.includes(x)), d=m.dz.some(x=>!base.dz.includes(x)); bump(op,g,d); bump('всего',g,d);
      if(!g&&!d) surv.push(op+': '+(src.slice(Math.max(0,S.start-50),S.start)+'⟦'+src.slice(S.start,S.end)+'→'+S.to+'⟧'+src.slice(S.end,S.end+30)).replace(/\s+/g,' ')); } }
  return {by,surv,total,equiv,crashed,data,cosm}; }
module.exports.runDzMutations=runDzMutations;

if(require.main===module&&process.argv.includes('--mutate'))(async()=>{
  const http=require('http'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined});
  const page=await browser.newPage(); await page.goto('http://127.0.0.1:'+srv.address().port+'/'); await page.waitForTimeout(1500);
  for(const f of ['geometry','dz','euclid','arith']) await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')});
  const per=+((process.argv.find(a=>a.startsWith('--per='))||'').split('=')[1]||12);
  const r=await runDzMutations(page,{per}), pc=(a,n)=>a+'/'+n+' ('+Math.round(100*a/Math.max(1,n))+'%)';
  console.log('Мутантов '+r.total+': не выполнились '+r.crashed+', эквивалентных '+r.equiv+', в исходных данных примера '+r.data+', только оформление '+r.cosm);
  console.log('вид        | 3D-проверка             | + ДЗ-оракул и «Евклид»');
  Object.entries(r.by).sort((a,b)=>a[0]==='всего'?1:b[0]==='всего'?-1:0).forEach(([k,v])=>console.log(k.padEnd(10)+' | '+pc(v.geo,v.n).padEnd(23)+' | '+pc(v.all,v.n)));
  if(r.surv.length) console.log('\nВыжившие:\n'+r.surv.join('\n'));
  await browser.close(); srv.close();
})().catch(e=>{ console.error(e); process.exit(2); });
