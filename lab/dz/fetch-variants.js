/* Эталоны по вариантам: разбор сайта (тот же код, что в index.html) на данных каждого варианта таблицы.
   node lab/dz/fetch-variants.js → lab/dz/reference.json — нужен Chromium (как для tests/run.js).
   Для каждого из 60 вариантов: ответ сайта, итоговые сцены разбора (мм от O, u = −x, v = −z | +y) и замечания
   ДЗ-оракула сайта (tests/dz.js). Печатает сверку ответа сайта с независимым решателем core/dz.js. */
const fs=require('fs'), http=require('http'), path=require('path');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..','..'), {source}=require('../../tests/dz-run.js'), V=require('../../core/dz-variants.js'), DZ=require('../../core/dz.js');
/* имя точки в строке данных сайта */
const NAME={'2':{F:'Pf'},'2b':{F:'Fp'},'2c':{F:'Fp'},'3':{S:'Sv'}};
const LINE={'2':/(HW\.calcOf\[2\] = function\(VAR_\)\{\n  let )([^;]*)(;)/,'2b':/(HW\.calcOf\['2b'\] = function\(VAR_\)\{\n  let )([^;]*)(;)/,'2c':/(HW\.calcOf\['2c'\] = function\(VAR_\)\{\n  let )([^;]*)(;)/,'3':/(HW\.calcOf\[3\] = function\(VAR_\)\{\n  let )([^;]*)(;)/};
function patch(src,id,data){ return src.replace(LINE[id],(m,p,body,e)=>{ let b=body; Object.entries(data).forEach(([k,v])=>{ const nm=(NAME[id]&&NAME[id][k])||k, re=new RegExp('(^|[ ,])'+nm+'=\\[[^\\]]*\\]');
    if(!re.test(b)) throw new Error('в строке данных '+id+' нет '+nm); b=b.replace(re,(mm,pre)=>pre+nm+'=['+v.join(',')+']'); }); return p+b+e; }); }

(async()=>{ const src=source();
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const br=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}), pg=await br.newPage();
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/'); await pg.waitForTimeout(1500);
  await pg.addScriptTag({content:fs.readFileSync(path.join(ROOT,'tests','dz.js'),'utf8')});
  const out={}, worst={}; let bad=0;
  for(const dz of [2,3]) for(let n=1;n<=30;n++){ const g=V.get(dz,n), code=patch(src,g.id,g.data);
    const r=await pg.evaluate(([code,id])=>{ const old=window.NGHW; let NEW=null, err=null; try{ (0,eval)(code); NEW=window.NGHW; }catch(e){ err=String(e&&e.message||e); } if(!NEW){ window.NGHW=old; return {err}; }   /* ex() читает window.NGHW._HW — пока не вернули старый */
      const S=L.S, m=p=>p&&[+(p[0]/S).toFixed(4),+(p[1]/S).toFixed(4)], strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').trim();
      const d=NEW.get(id), parts=PLAYER.partsOf(d.task).map(p=>({title:strip(p.title||p.q||''),ans:strip(p.ans||''),items:PLAYER.scene(p,(p.steps||[]).length).items.filter(Boolean).map(it=>{ const o={t:it.t,k:it.k||null,l:it.l?strip(it.l):null};
        ['at','a','b','c','p1','p2'].forEach(f=>{ if(it[f]) o[f]=m(it[f]); }); if(it.r) o.r=+(it.r/S).toFixed(4); if(it.p) o.p=it.p.map(m); if(it.s) o.s=strip(it.s); return o; })}));
      let chk=[]; try{ chk=DZ_CHECK({get:x=>x===id?d:null}).filter(o=>!/нет разбора/.test(o.rule)).map(o=>o.name+': '+o.rule+' — '+o.msg); }catch(e){ chk=['сбой оракула: '+e]; }
      /* ответ сайта — из его же вычисления (HW.calc), те же поля, что «Сверь свой лист» (HWCHECK) */
      const c=NEW._HW.calc[id], ex=id==='2'?{S:c.S,N:c.T}:id==='2b'?{A:c.A,'A₁':c.A1}:id==='2c'?{B:c.B,D:c.D,'A₁':c.A1}:{H:c.H,dih:c.dih,AB:c.AB,BC:c.BC,CA:c.CA,phi:c.phi};
      window.NGHW=old; return {ex,parts,chk,hasEx:true}; },[code,g.id]);
    if(r.err){ console.log('ДЗ'+dz+' в'+n+': сборка — '+r.err); bad++; continue; }
    if(!r.ex){ console.log('ДЗ'+dz+' в'+n+': у разбора сайта нет ответа (ex)'); bad++; continue; }
    /* сверка с core/dz.js: ответ сайта — одно из решений */
    const s=DZ.solve(g.id,g.data), ex=r.ex, d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]); let diff;
    if(g.id==='2') diff=Math.min(...s.sol.map(x=>d3(x.S,ex.S)));
    if(g.id==='2b') diff=Math.max(d3(s.A,ex.A),Math.min(...s.sol.map(x=>d3(x.A1,ex['A₁']))));
    if(g.id==='2c') diff=Math.max(d3(s.B,ex.B),Math.min(...s.sol.map(x=>Math.max(d3(x.D,ex.D),d3(x.A1,ex['A₁'])))));
    if(g.id==='3') diff=Math.max(Math.abs(s.H-ex.H),Math.abs(s.dih-ex.dih),Math.abs(s.phi-ex.phi),Math.abs(s.AB-ex.AB),Math.abs(s.BC-ex.BC),Math.abs(s.CA-ex.CA));
    worst[g.id]=Math.max(worst[g.id]||0,diff);
    if(!(diff<1e-6)||r.chk.length){ bad++; console.log('ДЗ'+dz+' в'+n+' ('+g.id+'): расхождение '+diff+(r.chk.length?'; оракул: '+r.chk.join(' | '):'')); }
    out[dz+'-'+n]={dz,n,id:g.id,data:g.data,site:ex,parts:r.parts,oracle:r.chk}; }
  fs.writeFileSync(path.join(__dirname,'reference.json'),JSON.stringify(out));
  console.log('вариантов '+Object.keys(out).length+' из 60; наибольшее расхождение сайт ↔ core/dz.js: '+Object.entries(worst).map(([k,v])=>k+' '+v.toExponential(1)).join(', ')+'; замечаний и расхождений: '+bad);
  await br.close(); srv.close(); process.exit(bad?1:0); })().catch(e=>{ console.error(e); process.exit(2); });
