/* Тест оцифровки листа ДЗ: node lab/dz/test-digitize.js [--n=8] [--level=normal]
   На синтетике (lab/dz/synth.js) — найденные отрезки против начерченных (сцена разбора + оси x и z/y), на фото (мм — по масштабу листа):
   полнота — доля длины начерченных линий, рядом с которой (≤ 0,8 мм, направление ±5°) есть найденный отрезок;
   точность — доля длины найденных отрезков ≥ 6 мм, рядом с которыми есть начерченная линия (подписи почерком
   в сцене не учтены: их штрихи — часть «неточности»); тип — основная / тонкая / штриховая совпали. */
const IMG=require('../img.js'), {dzSynth}=require('./synth.js'), {locate}=require('./locate.js'), {digitize}=require('./digitize.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), N=+(A.n||8), LV=A.level||'normal';
const dSeg=(p,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy||1e-9, t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L)); return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); };
const ang=(a,b,c,d)=>{ const u=[b[0]-a[0],b[1]-a[1]], v=[d[0]-c[0],d[1]-c[1]]; return Math.acos(Math.min(1,Math.abs(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)||1)))*180/Math.PI; };
/* доля длины отрезков S, у которых есть сосед из T */
const cover=(S,T,minLen)=>{ let on=0, tot=0; S.forEach(s=>{ const L=Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]); if(L<(minLen||0)) return; const near=T.filter(t=>ang(s.a,s.b,t.a,t.b)<=5);
  for(let x=0;x<=L;x+=0.5){ const p=[s.a[0]+(s.b[0]-s.a[0])*x/L,s.a[1]+(s.b[1]-s.a[1])*x/L]; tot++; if(near.some(t=>dSeg(p,t.a,t.b)<=0.8)) on++; } }); return tot?on/tot:0; };
const md=a=>a.length?a.slice().sort((x,y)=>x-y)[a.length>>1]:NaN, f2=v=>(100*v).toFixed(0)+' %';
const rec=[], prec=[], typ=[], ref=[];
for(let i=0;i<N;i++){ const id=['2','2b','2c','3'][i%4], s=dzSynth({id,seed:500+i,level:LV,turn:i%4}), t=s.truth, loc=locate(s.img), d=digitize(s.img,loc);
  if(!d.ok){ ref.push(i+': '+d.reason); continue; }
  /* сравнение — на фото (px → мм по масштабу листа): рамка начерчена рукой (углы ± до 1,5 мм от ГОСТ), поэтому
     «мм страницы» по найденной рамке и по настоящей странице расходятся на доли мм — это не ошибка оцифровки */
  const k=1/loc.pxPerMm, Of=loc.O||[0,0], P=p=>IMG.H.apply(t.H,[t.O[0]+p[0],t.O[1]+p[1]]).map(v=>v*k), Q=p=>IMG.H.apply(loc.H,[Of[0]+p[0],Of[1]+p[1]]).map(v=>v*k), Pp=p=>IMG.H.apply(t.H,p).map(v=>v*k);
  const truth=t.items.filter(it=>(it.t==='seg'||it.t==='line'||it.t==='conn')&&it.a&&it.b).map(it=>({a:P(it.a),b:P(it.b),k:it.t==='conn'?'thin':/d$|^hid$/.test(it.k||'')?'hid':/^(main|res)$/.test(it.k||'main')?'main':'thin'}));
  truth.push({a:Pp(t.axis[0]),b:Pp(t.axis[1]),k:'thin'}); if(t.zLine) truth.push({a:Pp(t.zLine[0]),b:Pp(t.zLine[1]),k:'thin'});
  const found=d.segs.map(x=>({a:Q(x.a),b:Q(x.b),k:x.k}));
  const r=cover(truth,found), p=cover(found,truth,6); rec.push(r); prec.push(p);
  /* тип: по найденным, у которых есть сосед ≥ 80 % длины */
  let ok=0, n=0; found.forEach(f=>{ const L=Math.hypot(f.b[0]-f.a[0],f.b[1]-f.a[1]); if(L<6) return; const m=truth.find(tr=>ang(f.a,f.b,tr.a,tr.b)<=5&&dSeg(f.a,tr.a,tr.b)<=0.8&&dSeg(f.b,tr.a,tr.b)<=0.8); if(!m) return; n++; if(m.k===f.k) ok++; }); typ.push(n?ok/n:0);
  console.log(i,id,'отрезков',d.segs.length,'полнота',f2(r),'точность',f2(p),'тип',f2(n?ok/n:0)); }
console.log('ИТОГО ('+LV+'): оцифровано '+rec.length+' из '+N+', полнота — медиана '+f2(md(rec))+' (худшая '+f2(Math.min(...rec))+'), точность — медиана '+f2(md(prec))+' (худшая '+f2(Math.min(...prec))+'), тип линии верен — медиана '+f2(md(typ)));
ref.forEach(x=>console.log('  отказ '+x));
