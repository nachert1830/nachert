/* Тест выпрямления: node lab/test-rectify.js [--n=6]
   1. Точность: на синтетике № 47 и № 46 (уровни easy, normal, hard) — наибольшая ошибка положения напечатанного
      «дано» после выпрямления, мм.
   2. Честный отказ: лист другой задачи (фото листа № 46, а сканер ждёт № 47, и наоборот), чистая страница с рамкой
      и снимок без листа — выпрямление должно отказать, а не «найти» условие. */
const {synth}=require('./synth.js'), {rectifyFull}=require('./scan.js'), IMG=require('./img.js'), {SHEETS,toPage}=require('./sheets.js'), {v2}=require('../core/model.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), N=+(A.n||6);
let fail=0;
function err(s,r,n){ const Mi=IMG.H.inv(r.H), SH=SHEETS[n]; return Math.max(...SH.given().filter(i=>i.t==='pt').map(i=>i.at).map(p=>{ const P=toPage(SH,p), b=IMG.H.apply(Mi,IMG.H.apply(s.truth.H,P)); return v2.dist(b,P); })); }
for(const n of [47,46]) for(const lv of ['easy','normal','hard']){ const e=[]; let ref=0;
  for(let i=0;i<N;i++){ const s=synth({n,seed:7000+i,level:lv,kid:n===47?'front':'ok',nvid:n===47?'ok:1A+':'ok'}), r=rectifyFull(s.img,n); if(!r.ok){ ref++; continue; } e.push(err(s,r,n)); }
  e.sort((a,b)=>a-b); const worst=e.length?e[e.length-1]:NaN; if(worst>0.5){ fail++; }
  console.log('№ '+n+' · '+lv+': выпрямлено '+e.length+' из '+N+', ошибка медиана '+(e.length?e[Math.floor(e.length/2)].toFixed(3):'—')+' мм, худшая '+(isFinite(worst)?worst.toFixed(3):'—')+' мм'+(worst>0.5?'  ✗ больше 0,5 мм':'')); }
/* отказы */
const neg=[];
for(let i=0;i<N;i++){ const s=synth({n:46,seed:8000+i,level:'normal',kid:'ok',nvid:'ok'}); neg.push(['лист № 46 вместо № 47',rectifyFull(s.img,47)]);
  const t=synth({n:47,seed:8100+i,level:'normal',kid:'front',nvid:'ok:1A+'}); neg.push(['лист № 47 вместо № 46',rectifyFull(t.img,46)]); }
/* чистая страница (рамка есть, «дано» нет): синтетика № 47, где «дано» закрашено цветом бумаги — берём фон */
{ const s=synth({n:47,seed:8200,level:'easy',kid:'front',nvid:'ok:1A+'}), im=s.img, d=im.data, M=s.truth.H, SH=SHEETS[47];
  const Mi=IMG.H.inv(M); for(let y=0;y<im.height;y++) for(let x=0;x<im.width;x++){ const p=IMG.H.apply(Mi,[x,y]); if(p[0]>20&&p[0]<128&&p[1]>40&&p[1]<190){ const o=(y*im.width+x)*4; d[o]=d[o+1]=d[o+2]=225; } }
  neg.push(['страница без «дано»',rectifyFull(im,47)]); }
{ const im=IMG.rgba(1600,1200); for(let i=0;i<im.data.length;i+=4){ im.data[i]=90; im.data[i+1]=70; im.data[i+2]=50; im.data[i+3]=255; } neg.push(['снимок без листа',rectifyFull(im,47)]); }
const acc=neg.filter(([,r])=>r.ok); if(acc.length) fail++;
console.log('Отказ там, где отказ правильный: '+(neg.length-acc.length)+' из '+neg.length+(acc.length?'  ✗ выпрямлено: '+acc.map(x=>x[0]).join(', '):''));
const why={}; neg.forEach(([k,r])=>{ if(!r.ok){ const w=k+': '+r.reason.replace(/[\d.,]+ %/,'# %'); why[w]=(why[w]||0)+1; } }); Object.entries(why).forEach(([k,v])=>console.log('  '+v+' × '+k));
process.exit(fail?1:0);
