/* Тест подписей на синтетике: node lab/test-labels.js [--level=normal] [--n=6]
   Нашлось ли пятно у каждой написанной подписи (центр рамки ≤ 2 мм) и прочитано ли оно верно (из ожидаемых). */
const {synth}=require('./synth.js'), {rectifyFull}=require('./scan.js'), Ln=require('./lines.js'), LB=require('./labels.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), LV=A.level||'normal', N=+(A.n||6);
let tot=0, found=0, right=0, top1=0, blobsN=0, ms=0; const conf={};
for(let i=0;i<N;i++){ const s=synth({seed:700+i,level:LV,kid:['front','horiz','foot1'][i%3],nvid:'ok:1A+'}), r=rectifyFull(s.img,47); if(!r.ok) continue;
  const ln=Ln.extract(s.img,r,{n:47}); if(!ln.ok) continue; const t0=Date.now(), lb=LB.attach(ln,r,{n:47}); ms+=Date.now()-t0; blobsN+=lb.blobs.length;
  s.truth.labels.filter(l=>l.box&&LB.EXPECT[47].includes(l.s)).forEach(l=>{ tot++; const c=[(l.box[0]+l.box[2])/2,(l.box[1]+l.box[3])/2];
    const b=lb.blobs.find(b=>Math.hypot(b.at[0]-c[0],b.at[1]-c[1])<2); if(!b) return; found++; const got=b.best&&b.best.p>0.3?b.best.text:'?'; if(got===l.s) right++; if(b.best&&b.best.text===l.s) top1++; const k=l.s+'→'+got; conf[k]=(conf[k]||0)+1; }); }
console.log('подписей '+tot+', найдено '+found+' ('+Math.round(100*found/tot)+' %), прочитано верно '+right+' ('+Math.round(100*right/Math.max(1,found))+' % найденных; первый вариант верен — '+top1+'), пятен всего '+blobsN+', '+Math.round(ms/N)+' мс на лист');
if(A.v) console.log(Object.entries(conf).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v).join(', '));
