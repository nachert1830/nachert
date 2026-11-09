/* ═══════════ Эталон ДЗ №5 сканера (lk/scan/verify5.js) против решателя сайта (dz/ng/5, DZR.solve('ng5', n)) ═══════════
   Решатель живёт в странице (глобалы lib.js), поэтому — Chromium. Сверяются точки пересечения K (3D) и нормаль в точке
   касательной плоскости решателя (Kt, nrm): расхождение точек должно быть < 0,05 мм, нормали — < 0,1°.
   node lab/dz/dz5ref.js */
const http=require('http'), fs=require('fs'), path=require('path'), V5=require('../../lk/scan/verify5.js');
const ROOT=path.join(__dirname,'..','..');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
(async()=>{ const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const br=await chromium.launch(), pg=await br.newPage();
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/'); await pg.waitForFunction(()=>self.DZR&&DZR.get('ng5'),null,{timeout:60000});
  let bad=0, maxK=0, maxN=0;
  for(let n=1;n<=30;n++){ const s=await pg.evaluate(n=>{ const r=DZR.solve('ng5',n), a=r.answers||{}; return {K:a.K||[],Kt:a.Kt||null,nrm:a.nrm||null,V:DZR.get('ng5').V[n]}; },n), R=V5.ref(n);
    if(JSON.stringify(s.V)!==JSON.stringify(V5.V[n])){ console.log('в.'+n+': данные варианта расходятся с dz/ng/5/variants.js'); bad++; }
    const dK=s.K.length===R.K.length?Math.max(...s.K.map(k=>Math.min(...R.K.map(q=>Math.hypot(k[0]-q[0],k[1]-q[1],k[2]-q[2]))))):Infinity;
    let dN=0; if(s.Kt&&s.nrm){ const i=R.K.map(q=>Math.hypot(q[0]-s.Kt[0],q[1]-s.Kt[1],q[2]-s.Kt[2])).reduce((b,d,j,a)=>d<a[b]?j:b,0), c=Math.abs(R.N[i].reduce((a,v,j)=>a+v*s.nrm[j],0))/Math.hypot(...s.nrm); dN=Math.acos(Math.min(1,c))*180/Math.PI; }
    maxK=Math.max(maxK,dK); maxN=Math.max(maxN,dN); if(!(dK<0.05)||!(dN<0.1)){ bad++; console.log('в.'+n+': точек '+s.K.length+'/'+R.K.length+', ΔK '+dK.toFixed(3)+' мм, Δn '+dN.toFixed(3)+'°'); } }
  await br.close(); srv.close(); console.log('30 вариантов: наибольшее ΔK '+maxK.toFixed(4)+' мм, Δn '+maxN.toFixed(4)+'°, расхождений '+bad); process.exit(bad?1:0); })().catch(e=>{ console.error(e); process.exit(1); });
