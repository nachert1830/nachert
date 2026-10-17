/* ═══════════ Тест ядра: node core/test.js ═══════════
   1. Верная программа построения № 47 (оба способа) совпадает с сертификатом core/t47.js (точное исполнение в дробях)
      — на данных тетради и на 200 случайных вариантах.
   2. Каждая ошибка библиотеки действительно даёт неверный ответ (K не основание перпендикуляра или |AK| не та),
      и на данных тетради видно, насколько: это предел, ниже которого ошибку по фото не отличить от верного решения.
   3. Чертёж программы и «дано» — в формате оцифрованной сцены (core/scene.js), 3D восстанавливается по проекциям.
   --browser — ещё и переходники tests/certified/*.js на странице сайта (как их грузит тренажёр). */
const path=require('path');
const {q,V}=require('./exact.js'), {execute}=require('./certify.js'), T47=require('./t47.js');
const cp=require('./cp.js'), C=require('./cp47.js'), S=require('./scene.js'), M=require('./model.js');
let fail=0; const ok=(c,msg)=>{ if(!c){ fail++; console.log('  ✗ '+msg); } return c; };

console.log('1. Программа № 47 против сертификата');
const T1=Object.assign({},T47,{k:'1'});
function compare(G,label){ const R=execute(T1,G), g=C.given(G); let worst=0;
  ['front','horiz'].forEach(kid=>{ const {E,miss}=cp.exec(C.program(kid,'ok:1A+'),g); ok(!miss.length,label+' '+kid+': не построено '+miss.join(','));
    const names=kid==='front'?['1″','2″','1′','2′','K′','K″']:['K′','K″'];
    names.forEach(n=>{ const d=M.v2.dist(E[n],V.num(R.E[n])); worst=Math.max(worst,d); ok(d<1e-9,label+' '+kid+' '+n+': '+d); });
    const j=C.judge(E,G); ok(j.dK<1e-9&&j.dNV<1e-9,label+' '+kid+': ответ '+j.dK+' / '+j.dNV); });
  return worst; }
let w=compare(T47.gamma(T47.entries[0]),'тетрадь'); console.log('  данные тетради: расхождение с сертификатом '+w.toExponential(1)+' мм');
let seed=12345; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647); let wr=0, nr=0;
for(let i=0;i<200;i++){ const G=T47.randomGamma(rnd); try{ wr=Math.max(wr,compare(G,'вариант '+i)); nr++; }catch(e){ /* вырожденный вариант */ } }
console.log('  случайные варианты: '+nr+' из 200, наибольшее расхождение '+wr.toExponential(1)+' мм');

console.log('2. Ошибки библиотеки дают неверный ответ');
const G0=T47.gamma(T47.entries[0]), g0=C.given(G0);
const seen=new Set();
C.hypotheses().forEach(h=>{ if(h.cls==='ok'||seen.has(h.cls)) return;
  const all=Object.keys(C.NVOPT).filter(nv=>C.cls(h.kid,nv)===h.cls).map(nv=>{ const {E}=cp.exec(C.program(h.kid,nv),g0); return Object.assign({nv},C.judge(E,G0)); });
  const j=all.reduce((a,b)=>(Math.max(b.dK,b.dNV===Infinity?0:b.dNV)<Math.max(a.dK,a.dNV===Infinity?0:a.dNV)?b:a));
  const wrong=all.every(x=>x.dK>1e-6||x.dNV>1e-6); ok(wrong,h.cls+': ответ верный');
  if(h.cls.includes('+')) return; seen.add(h.cls);
  console.log('  '+h.cls.padEnd(9)+' K сдвинута на '+j.dK.toFixed(2)+' мм, |AK| '+(j.nv==null?'не построена':'= '+j.nv.toFixed(2)+' мм (верно '+j.AK.toFixed(2)+')')+(j.nv!=null&&j.dK<1e-6?' — самый близкий вариант: '+j.nv:'')); });
/* ошибка на случайных данных тоже неверна (не совпадение тетради) */
seed=777; const rate={};
for(let i=0;i<200;i++){ const G=T47.randomGamma(rnd), g=C.given(G);
  Object.keys(C.KOPT).filter(k=>!C.KOPT[k].ok).concat(['nv-same','nv-abs']).forEach(id=>{ const [kid,nv]=id.startsWith('nv-')?['front',(id==='nv-same'?'same':'abs')+':1A+']:[id,'ok:1A+'];
    let wrong=false; try{ const {E}=cp.exec(C.program(kid,nv),g), j=C.judge(E,G); wrong=j.dK>1e-6||j.dNV>1e-6; }catch(e){ wrong=true; }
    rate[id]=(rate[id]||0)+(wrong?1:0); }); }
console.log('  на 200 случайных вариантах неверна: '+Object.entries(rate).map(([k,v])=>k+' '+v).join(', '));
Object.entries(rate).forEach(([k,v])=>ok(v>=195,k+': верна на '+(200-v)+' вариантах'));

console.log('3. Формат сцены и 3D');
const pr=C.printed(G0), {E}=cp.exec(C.program('front','ok:1A+'),g0), dr=cp.draw(C.program('front','ok:1A+'),E);
const sc={units:'mm',items:pr.concat(dr)}; const bad=S.validate(sc); ok(!bad.length,'формат: '+bad.join('; '));
const lab=S.labelled(sc).points, R3=M.reconstruct(lab), tr=C.truth(G0);
ok(R3.K&&M.v3.dist(R3.K.P,tr.K)<1e-9,'K по проекциям'); ok(R3.A&&M.v3.dist(R3.A.P,tr.A)<1e-9,'A по проекциям');
console.log('  элементов: '+sc.items.length+' (напечатано '+pr.length+'), K = ('+R3.K.P.map(v=>v.toFixed(2)).join('; ')+'), |AK| = '+tr.AK.toFixed(2)+' мм');
const site=S.toSite(sc,4.16); ok(Math.abs(site.items.find(i=>i.l==='K′').at[0]-E['K′'][0]*4.16)<1e-9,'перевод в единицы сайта');

(async()=>{
  if(process.argv.includes('--browser')){ console.log('4. Переходники tests/certified на странице');
    const fs=require('fs'), http=require('http'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
    const ROOT=path.join(__dirname,'..'), srv=await new Promise(res=>{ const s=http.createServer((qq,r)=>{ let f=decodeURIComponent(qq.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
      const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
      r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'text/javascript'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
    const br=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}), pg=await br.newPage();
    const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
    await pg.goto('http://127.0.0.1:'+srv.address().port+'/'); await pg.waitForTimeout(800);
    const r=await pg.evaluate(async()=>{ const load=src=>new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
      const C='tests/certified/'; for(const f of ['exact','kernels','certify','list']) await load(C+f+'.js'); for(const f of CERT.list) await load(C+f+'.js');
      if(!window.CERT) return ['нет CERT'];
      return Object.values(CERT.tasks).map(T=>{ const c=CERT.certify.certify(T,{variants:5}); return T.n+':'+c.ok; }); });
    ok(r.length===2&&r.every(x=>x.endsWith(':true')),'сертификаты на странице: '+r.join(', ')); ok(!errs.length,'ошибки страницы: '+errs.join('; '));
    console.log('  '+r.join(', ')); await br.close(); srv.close(); }
  console.log(fail?'\nОШИБОК: '+fail:'\nЯдро: ошибок нет.'); process.exit(fail?1:0);
})();
