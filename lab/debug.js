/* Разбор одного синтетического листа по этапам: node lab/debug.js --seed=10007 --level=normal --kid=front --nv=ok:1A+ [--png=файл]
   Печатает: выпрямление, найденные отрезки, лучшие гипотезы и их невязки по шагам; PNG — область построения:
   серое — карта тёмности, зелёное — что нарисовано на самом деле, красное/оранжевое — найденные отрезки
   (основная/тонкая), синее — отрезки, которые лучшая гипотеза не объяснила. */
const fs=require('fs'), {synth}=require('./synth.js'), {rectifyFull}=require('./scan.js'), Ln=require('./lines.js'), IT=require('./interpret.js'), IMG=require('./img.js');
const C=require('../core/cp47.js'), {SHEETS}=require('./sheets.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const s=synth({seed:+(A.seed||1),level:A.level||'normal',kid:A.kid||'front',nvid:A.nv||'ok:1A+'}), t=s.truth;
console.log('правда: '+t.cls+' ('+t.kid+', '+t.nvid+'), рука ×'+t.hand.toFixed(2)+', '+JSON.stringify(t.params));
const r=rectifyFull(s.img,47); if(!r.ok){ console.log('выпрямление: '+r.reason); process.exit(); }
console.log('выпрямление: '+(r.pxPerMm||0).toFixed(1)+' px/мм, качество '+JSON.stringify(r.quality));
const ln=Ln.extract(s.img,r,{n:47}); if(!ln.ok){ console.log('линии: '+ln.reason); process.exit(); }
const it=IT.interpret(ln,null,{n:47});
console.log('отрезков: '+ln.segs.length+' (сильных '+it.segs.length+')');
it.segs.forEach((g,i)=>console.log('  #'+i+' '+g.a.map(v=>v.toFixed(1))+' → '+g.b.map(v=>v.toFixed(1))+' '+g.len.toFixed(1)+' мм '+g.k+' rel '+g.rel.toFixed(2)+' w '+g.weight.toFixed(3)));
console.log('гипотезы:'); it.fits.forEach(f=>console.log('  '+f.cls.padEnd(16)+f.kid.padEnd(9)+f.nvid.padEnd(9)+' ll '+f.ll+' нет: '+f.miss.join(',')+' лишних '+f.extra));
const C47=C, given=C47.given(SHEETS[47].G());
const best=IT.fitProgram(C47.program(it.fits[0].kid,it.fits[0].nvid),given,it.segs,it.vis);
console.log('шаги лучшей:'); best.steps.forEach(x=>console.log('  '+x.id.padEnd(6)+(x.c==null?'—':x.c.toFixed(2)+' #'+(best.roles[x.id]||[x.seg]).join(',#'))));
console.log('не объяснены: '+it.segs.map((g,i)=>i).filter(i=>!Object.values(best.roles).some(v=>Array.isArray(v)&&v.includes(i))).join(', '));
if(A.truthfit){ const tf=IT.fitProgram(C47.program(t.kid.startsWith('u-')?'front':t.kid,t.nvid),given,it.segs,it.vis); console.log('правда как гипотеза: ll '+tf.ll.toFixed(2)+' нет: '+tf.missReq.join(',')+' лишних '+tf.extra.length); tf.steps.forEach(x=>console.log('  '+x.id.padEnd(6)+(x.c==null?'—':x.c.toFixed(2)+' #'+x.seg))); }
console.log('итог: '+(it.ok?'ВЕРДИКТ '+it.verdict.cls+' — '+it.verdict.title:'отказ: '+it.reason));
if(A.png){ const g=ln.map.g, box=ln.map.box, O=t.O, im=IMG.rgba(g.w,g.h); for(let i=0;i<g.w*g.h;i++){ const v=255*(1-Math.min(1,g.a[i]*1.5)); im.data[4*i]=im.data[4*i+1]=im.data[4*i+2]=v; im.data[4*i+3]=255; }
  const line=(a,b,col,off)=>{ const P=p=>[(p[0]+O[0]-box[0])*8,(p[1]+O[1]-box[1])*8+off]; const A_=P(a),B=P(b),n=Math.ceil(Math.hypot(B[0]-A_[0],B[1]-A_[1])); for(let k=0;k<=n;k++){ const x=Math.round(A_[0]+(B[0]-A_[0])*k/n), y=Math.round(A_[1]+(B[1]-A_[1])*k/n); if(x<0||y<0||x>=g.w||y>=g.h) continue; const i=y*g.w+x; im.data[4*i]=col[0]; im.data[4*i+1]=col[1]; im.data[4*i+2]=col[2]; } };
  t.scene.items.filter(x=>x.t==='seg'&&x.src==='hand').forEach(x=>line(x.a,x.b,[0,170,0],-3));
  it.segs.forEach((g2,i)=>{ const used=Object.values(best.roles).some(v=>Array.isArray(v)&&v.includes(i)); line(g2.a,g2.b,!used?[0,60,255]:g2.k==='main'?[220,0,0]:[255,140,0],3); });
  fs.writeFileSync(A.png,IMG.encodePNG(im)); }
