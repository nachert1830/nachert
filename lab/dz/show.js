/* Разбор настоящего фото листа ДЗ: node lab/dz/show.js файл.png [--out=папка]
   Печатает найденное (ориентация, рамка, штамп, ось x, ось z/y, O) и пишет картинки: фото с наложением и выпрямленное
   поле чертежа (мм, 1:1 по рамке), чертёж, вырезанный из рамки, с оцифрованными линиями (синие — основные, зелёные —
   тонкие, красные — штриховые) и сцену в числах (<имя>-сцена.json, мм от O). Фото студентов — только в lab/private/ (папка не попадает в git). */
const fs=require('fs'), path=require('path'), IMG=require('../img.js'), {locate}=require('./locate.js'), {digitize}=require('./digitize.js'), DS=require('./sheet.js');
const file=process.argv[2], A=Object.fromEntries(process.argv.slice(3).map(s=>s.replace(/^--/,'').split('='))), out=A.out||path.dirname(file);
const img=IMG.decodePNG(fs.readFileSync(file)), t0=Date.now(), r=locate(img);
console.log('фото '+img.width+'×'+img.height+', '+(Date.now()-t0)+' мс');
console.log(r.ok?'лист найден: снимок повёрнут на '+r.turn*90+'°, '+r.pxPerMm.toFixed(1)+' px/мм, штамп '+r.title.score.toFixed(2):'отказ: '+r.reason);
(r.dbg||[]).forEach(x=>console.log('  '+x));
if(r.ok){ console.log('ось x: '+r.axis.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' → ')+' (мм листа)');
  console.log(r.O?'ось z/y: '+r.zAxis.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' → ')+', O = ('+r.O.map(v=>v.toFixed(1)).join('; ')+') мм листа':r.axisWhy);
  /* наложение: рамка, штамп, оси, O */
  const o=IMG.rgba(img.width,img.height); o.data.set(img.data); const put=(x,y,c)=>{ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=o.width||y>=o.height) return; const i=(y*o.width+x)*4; o.data[i]=c[0]; o.data[i+1]=c[1]; o.data[i+2]=c[2]; };
  const seg=(a,b,c,w)=>{ const P=IMG.H.apply(r.H,a), Q=IMG.H.apply(r.H,b), n=Math.ceil(Math.hypot(Q[0]-P[0],Q[1]-P[1])); for(let k=0;k<=n;k++) for(let d=-(w||1);d<=(w||1);d++) for(let e=-(w||1);e<=(w||1);e++) put(P[0]+(Q[0]-P[0])*k/n+d,P[1]+(Q[1]-P[1])*k/n+e,c); };
  const F=DS.FRAME; [[F[0],F[1],F[2],F[1]],[F[2],F[1],F[2],F[3]],[F[2],F[3],F[0],F[3]],[F[0],F[3],F[0],F[1]]].forEach(q=>seg([q[0],q[1]],[q[2],q[3]],[0,90,255],2));
  DS.titleLines().forEach(([a,b])=>seg(a,b,[0,170,0],1));
  if(r.axis) seg(r.axis[0],r.axis[1],[230,120,0],2); if(r.zAxis) seg(r.zAxis[0],r.zAxis[1],[230,120,0],2);
  if(r.O) for(let k=0;k<40;k++){ const a=k/40*2*Math.PI; seg([r.O[0]+4*Math.cos(a),r.O[1]+4*Math.sin(a)],[r.O[0]+4*Math.cos(a+0.16),r.O[1]+4*Math.sin(a+0.16)],[220,0,0],2); }
  fs.writeFileSync(path.join(out,path.basename(file,'.png')+'-найдено.png'),IMG.encodePNG(IMG.downscale(o,1200)));
  /* выпрямленное поле чертежа 5 px/мм */
  const ppm=5, FL=DS.FIELD, w=Math.round((FL[2]-FL[0])*ppm), h=Math.round((FL[3]-FL[1])*ppm), g=IMG.rgba(w,h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const p=IMG.H.apply(r.H,[FL[0]+(x+0.5)/ppm,FL[1]+(y+0.5)/ppm]), X=Math.round(p[0]), Y=Math.round(p[1]), i=(y*w+x)*4; g.data[i+3]=255; if(X<0||Y<0||X>=img.width||Y>=img.height) continue; const j=(Y*img.width+X)*4; g.data[i]=img.data[j]; g.data[i+1]=img.data[j+1]; g.data[i+2]=img.data[j+2]; }
  fs.writeFileSync(path.join(out,path.basename(file,'.png')+'-поле.png'),IMG.encodePNG(g));
  /* чертёж из рамки: оцифровка, наложение на вырезанный чертёж (8 px/мм), сцена в числах */
  const t1=Date.now(), d=digitize(img,r); if(!d.ok){ console.log('оцифровка: '+d.reason); return; }
  const k={}; d.segs.forEach(s=>k[s.k]=(k[s.k]||0)+1);
  console.log('чертёж: '+d.box.map(v=>v.toFixed(0)).join(', ')+' мм листа; отрезков '+d.segs.length+' (основных '+(k.main||0)+', тонких '+(k.thin||0)+', штриховых '+(k.hid||0)+'), координаты '+(d.origin==='O'?'от O':'листа (O не найдено)')+', '+(Date.now()-t1)+' мс');
  const q=8, B=d.box, cw=Math.round((B[2]-B[0])*q), ch=Math.round((B[3]-B[1])*q), c=IMG.rgba(cw,ch), O=d.O||[0,0];
  for(let y=0;y<ch;y++) for(let x=0;x<cw;x++){ const p=IMG.H.apply(r.H,[B[0]+(x+0.5)/q,B[1]+(y+0.5)/q]), X=Math.round(p[0]), Y=Math.round(p[1]), i=(y*cw+x)*4; c.data[i+3]=255; if(X<0||Y<0||X>=img.width||Y>=img.height) continue; const j=(Y*img.width+X)*4; for(let e=0;e<3;e++) c.data[i+e]=155+img.data[j+e]*0.39; }
  const col={main:[20,60,230],thin:[0,150,40],hid:[220,30,30]};
  d.segs.forEach(s=>{ const P=[(s.a[0]+O[0]-B[0])*q,(s.a[1]+O[1]-B[1])*q], Q=[(s.b[0]+O[0]-B[0])*q,(s.b[1]+O[1]-B[1])*q], n=Math.ceil(Math.hypot(Q[0]-P[0],Q[1]-P[1]));
    for(let m=0;m<=n;m++) for(let e=-1;e<=1;e++) for(let f=-1;f<=1;f++){ const x=Math.round(P[0]+(Q[0]-P[0])*m/n+e), y=Math.round(P[1]+(Q[1]-P[1])*m/n+f); if(x<0||y<0||x>=cw||y>=ch) continue; const i=(y*cw+x)*4; c.data.set(col[s.k]||[0,0,0],i); } });
  const base=path.join(out,path.basename(file,'.png'));
  fs.writeFileSync(base+'-чертёж.png',IMG.encodePNG(c));
  fs.writeFileSync(base+'-сцена.json',JSON.stringify({origin:d.origin,O:d.O,box:d.box,units:'mm',items:d.scene.items},null,0)); }
