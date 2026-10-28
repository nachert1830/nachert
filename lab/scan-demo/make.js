/* ═══════════ Примеры для сканера (lab/cam.html, lab/dz.html → «Пример без камеры») ═══════════
   Синтетический лист ДЗ № 3 (lab/dz/quadsynth.js) проверяется тем же потоком, что и в браузере (lab/dz/worker.js,
   paper: 'plain'), ответ сохраняется как есть — страница рисует его без пересчёта, поэтому показ работает без камеры
   и без интернета. Картинка — JPEG того же размера (координаты ответа — в её пикселях), через Chromium (Playwright).
   node lab/scan-demo/make.js --id=v21 --n=21 --seed=1 [--err=b_dir] [--view=1 — снимок вблизи части view] [--size=1500x2000]
   [--cam --shots=2 — съёмка по чертежам: общий снимок + каждый чертёж вблизи, ответ — итог серий closeup.js]
   Описание примера (название, подпись) — в index.json, руками: что вышло, то и пишем. Лист проверяется минуты. */
const fs=require('fs'), path=require('path'), vm=require('vm'), DZ=path.join(__dirname,'../dz/');
const a=Object.fromEntries(process.argv.slice(2).map(s=>{ const [k,v]=s.replace(/^--/,'').split('='); return [k,v==null?'1':v]; }));
const Q=require(DZ+'quadsynth.js'), IMG=require('../img.js'), size=(a.size||'1500x2000').split('x').map(Number);
const view=a.view!=null?+a.view:null;
const s0=Q.sheet({n:+a.n,seed:+a.seed,err:a.err||undefined,size,closeup:view!=null||a.cam?8:undefined,closeShots:+a.shots||(a.cam?2:1),closeSize:[2250,3000]});
const img=view!=null?s0.views[view].img:s0.img, t0=Date.now();
/* поток как в браузере: importScripts — файлы lab/dz/ в одном контексте */
const out=[], ctx={console,setTimeout:()=>0}; ctx.self=ctx;   /* setTimeout потока — только фоновый кеш опознания, здесь не нужен */ ctx.postMessage=m=>out.push(m);
ctx.importScripts=(...f)=>f.forEach(x=>vm.runInContext(fs.readFileSync(path.resolve(DZ,x),'utf8'),ctx,{filename:x}));
vm.createContext(ctx); vm.runInContext(fs.readFileSync(DZ+'worker.js','utf8'),ctx);
let r;
if(a.cam){ /* съёмка по чертежам, как в камере: общий снимок, затем каждый чертёж вблизи (снимки quadsynth: s0.views[i] — часть i % 4) */
  ctx.onmessage({data:{mode:'overview',img:s0.img,dz:3,n:+a.n,answers:{}}}); const ov=out.pop().overview, log=[];
  if(!ov||!ov.ok) throw new Error('общий снимок: '+(ov&&ov.reason));
  const fb=require(DZ+'model.js').given('3',s0.truth.data).segs.flatMap(q=>[q.a,q.b]), m0=[0,1].map(k=>(Math.min(...fb.map(p=>p[k]))+Math.max(...fb.map(p=>p[k])))/2);
  const want=s0.truth.parts.map(p=>{ const c=IMG.H.apply(s0.truth.H,[p.O[0]+m0[0],p.O[1]+m0[1]]); let b=0, bd=1e18; ov.drawings.forEach((d,j)=>{ const v=Math.hypot(d.c[0]-c[0],d.c[1]-c[1]); if(v<bd){ bd=v; b=j; } }); return b; });
  const S=ctx.LAB.dzCloseup.Session({drawings:ov.drawings,frames:ov.frames});
  s0.views.forEach((v,i)=>{ const j=want[i%4]; if(!S.need(j)) return; ctx.onmessage({data:{mode:'close',want:j,img:v.img,dz:3,n:+a.n,answers:{}}}); const c=out.pop().close;
    if(c.ok) c.got.forEach(g=>{ S.add(g.j,g.frame); log.push('чертёж '+(g.j+1)+': '+g.ppm.toFixed(1).replace('.',',')+' px/мм — '+(g.frame.verdict||'не прочитан')); }); else log.push('чертёж '+(j+1)+': '+c.reason); console.log(log[log.length-1]); });
  r={cam:true,ov:{drawings:ov.drawings.map(d=>({c:d.c,box:d.box,ppm:d.ppm,pos:d.pos,title:d.title}))},R:S.result(),log}; r.verdict=r.R.map(x=>x.verdict).join(', '); }
else { ctx.onmessage({data:{img,dz:3,n:+a.n,paper:'plain',answers:{},part:null}}); r=out[out.length-1]; } r.demo={n:+a.n,seed:+a.seed,err:a.err||null,view,parts:s0.truth.parts.map(p=>({part:p.part,built:p.built,err:p.err})),s:Math.round((Date.now()-t0)/1000)};
fs.writeFileSync(path.join(__dirname,a.id+'.json'),JSON.stringify(r));
console.log(a.id+': '+r.verdict+' — '+(r.drawings||r.R||[]).map(d=>d.title+': '+d.verdict).join(' | ')+' ('+r.demo.s+' с)');
/* JPEG и миниатюра */
(async()=>{ const {chromium}=require('playwright'), br=await chromium.launch(), pg=await br.newPage(), png='data:image/png;base64,'+IMG.encodePNG(img).toString('base64');
  const [jpg,th]=await pg.evaluate(async u=>{ const im=new Image(); await new Promise(r=>{ im.onload=r; im.src=u; }); const enc=(w,h,q)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(im,0,0,w,h); return c.toDataURL('image/jpeg',q).split(',')[1]; };
    return [enc(im.width,im.height,0.86),enc(300,Math.round(300*im.height/im.width),0.8)]; },png);
  fs.writeFileSync(path.join(__dirname,a.id+'.jpg'),Buffer.from(jpg,'base64')); fs.writeFileSync(path.join(__dirname,a.id+'-s.jpg'),Buffer.from(th,'base64')); await br.close(); })();
