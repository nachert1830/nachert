/* Сводка по папке результатов sheet-digit.js: node lab/dz/bench-report.js <папка с *.sheet.json>
   Метрика — невязка точек условия варианта (привязка точек, выписанных моделью, к известной геометрии варианта; см. PLAN-digit.md):
   чем меньше, тем точнее модель попала в углы и пересечения. Считается только по чертежам, где привязка сошлась. Эталона вручную нет. */
const fs=require('fs'), dir=process.argv[2]; if(!dir){ console.error('нужна папка с результатами'); process.exit(2); }
const files=fs.readdirSync(dir).filter(f=>/\.sheet\.json$/.test(f)); let draws=0, cost=0, calls=0; const rms=[], hom=[], ppm=[], conf=[], inlr=[], dz={}; let noFit=0, noPts=0;
files.forEach(f=>{ const j=JSON.parse(fs.readFileSync(dir+'/'+f)); cost+=j.cost||0; calls+=j.calls||0; j.drawings.forEach(d=>{ if(!d.segs) return; draws++; const fi=d.fit;
  if(fi&&fi.rmsMm!=null){ rms.push(fi.rmsMm); if(fi.hom) hom.push(fi.hom.rmsMm); inlr.push(fi.inl/fi.of); ppm.push(fi.ppm); const k='ДЗ №'+fi.dz; dz[k]=(dz[k]||0)+1; } else if(d.stats&&d.stats.pts<4) noPts++; else noFit++;
  const s=d.stats; if(s&&s.kept) conf.push((s.kept-s.unverified)/s.kept); }); });
const med=a=>{ const t=a.slice().sort((x,y)=>x-y); return t.length?t[t.length>>1]:NaN; }, q=(a,p)=>{ const t=a.slice().sort((x,y)=>x-y); return t.length?t[Math.min(t.length-1,Math.floor(t.length*p))]:NaN; };
console.log('листов '+files.length+', чертежей '+draws+', запросов '+calls+', цена $'+cost.toFixed(2)+' (на лист $'+(cost/Math.max(1,files.length)).toFixed(3)+')');
console.log('привязано к условию варианта: '+rms.length+' из '+draws+' ('+Math.round(100*rms.length/Math.max(1,draws))+' %); не привязано при ≥ 4 точках: '+noFit+'; меньше 4 точек у модели: '+noPts);
console.log('задания, по которым привязалось: '+Object.entries(dz).map(([k,v])=>k+' — '+v).join(', '));
console.log('невязка точек условия, мм: медиана '+med(rms).toFixed(2)+', 90 % '+q(rms,0.9).toFixed(2)+', худшая '+Math.max(...rms).toFixed(2)+' (аффинная привязка); с перспективой ('+hom.length+' чертежей): медиана '+med(hom).toFixed(2)+', 90 % '+q(hom,0.9).toFixed(2));
console.log('согласных точек условия: медиана '+Math.round(100*med(inlr))+' %');
console.log('разрешение: медиана '+med(ppm).toFixed(1)+' px/мм; ≥ 6 px/мм у '+ppm.filter(x=>x>=6).length+' из '+ppm.length);
console.log('отрезков модели подтверждено карандашом на снимке: медиана '+Math.round(100*med(conf))+' %, 10 % чертежей хуже '+Math.round(100*q(conf,0.1))+' %');
