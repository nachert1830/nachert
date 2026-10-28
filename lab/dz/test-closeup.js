/* ═══════════ Съёмка по чертежам на синтетике: общий снимок → каждый чертёж вблизи → серия по чертежу (closeup.js) ═══════════
   node lab/dz/test-closeup.js [--sheets=4] [--size=1500,2000] [--close=3000,4000] [--shots=3] [--from=0]
   Лист А3 с четырьмя чертежами (quadsynth.js), общий снимок мелкий (как настоящие: 3,6–4,2 px/мм), снимки вблизи —
   size --close (телефон 12 Мп). «Студент» подносит телефон к тому чертежу, который просит Session (правда — по месту
   начала O), снимок за снимком, как на странице камеры. Каждый второй лист — с ошибкой в части 1 или 4.
   Меры: чертежей найдено на общем снимке; снимков вблизи, их px/мм; опознано по линиям верно / не узнано / ОШИБОЧНО;
   по чертежам — «верно», ошибка найдена, ЛОЖНЫХ (как в eyes-eval.js: «верно» части на чужом чертеже или при ошибке,
   «ошибка» без ошибки). */
const IMG=require('../img.js'), Q=require('./quadsynth.js'), CU=require('./closeup.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), NS=+(A.sheets||4), FROM=+(A.from||0), SHOTS=+(A.shots||3);
const SIZE=(A.size||'1500,2000').split(',').map(Number), CLOSE=(A.close||'3000,4000').split(',').map(Number);
const f1=x=>x==null||!isFinite(x)?'—':(Math.round(x*10)/10).toString().replace('.',','), med=a=>{ const t=a.slice().sort((x,y)=>x-y); return t.length?t[t.length>>1]:NaN; };
const ER=[null,'a_dir',null,'d_R',null,'a_d',null,'d_R',null,'a_dir'], NN=[3,9,14,21,27,30,6,17,24,12];
const T={sheets:0,dr:0,drT:0,shots:0,ppm:[],idOk:0,idUnk:0,idBad:0,ok:0,caught:0,errT:0,false:0,falseWhy:[],ms:0,unread:0};
for(let i=FROM;i<Math.min(NN.length,FROM+NS);i++){ const n=NN[i], t0=Date.now();
  const s=Q.sheet({n,seed:11+i,err:ER[i]||undefined,size:SIZE,closeup:8,closeShots:SHOTS,closeSize:CLOSE}); if(!s) continue; T.sheets++;
  const G=s.truth.parts.map(p=>({part:p.part,built:p.built,O:p.O,err:p.err&&p.affects!==false?p.err:null,errSoft:p.err&&p.affects===false?p.err:null}));
  const partAt=(H,A)=>{ const o=IMG.H.apply(IMG.H.inv(H),[A[2],A[5]]), k=G.findIndex(g=>Math.hypot(g.O[0]-o[0],g.O[1]-o[1])<=6); return k; };
  const ov=CU.overview(s.img,{n}); if(!ov.ok){ console.log('в'+n+': общий снимок не прочитан — '+ov.reason); T.drT+=4; continue; }
  const who=ov.drawings.map(d=>partAt(s.truth.H,d.A)); T.dr+=new Set(who.filter(k=>k>=0)).size; T.drT+=4; T.errT+=G.filter(g=>g.err).length;
  const S=CU.Session(ov), used=G.map(()=>0), log=[]; let from=0, guard=0;
  /* как на странице: просим чертёж j — «студент» подносит телефон к нему (следующий свой ракурс); снимок проверяется */
  while(guard++<40){ const j=S.next(from); if(j<0) break; from=j; const k=who[j];
    if(k<0||used[k]>=SHOTS){ S.add(j,{ok:false,why:[k<0?'на этом месте нет чертежа':'ракурсы кончились']}); log.push((j+1)+':—'); continue; }
    const v=s.views[used[k]*4+k]; used[k]++; T.shots++;
    const r=CU.close(v.img,{img:s.img,drawings:ov.drawings},{n,want:j});
    if(!r.ok){ S.add(j,{ok:false,why:[r.reason]}); log.push((j+1)+':не прочитан'); continue; }
    r.got.forEach(g=>{ T.ppm.push(g.ppm); const tk=who[g.j]; if(!g.known) T.idUnk++; else if(tk===k) T.idOk++; else T.idBad++; S.add(g.j,g.frame); log.push((g.j+1)+(g.known?'':'?')+':'+f1(g.ppm)+'px/мм '+(g.frame.verdict||'')); }); }
  const D=S.result();
  D.forEach((d,j)=>{ const g=G[who[j]]; if(!g) return; const errHere=q=>!!(g.err&&g.err[0]===q&&g.part===q), soft=q=>!!(g.errSoft&&g.errSoft[0]===q&&g.part===q);
    const bad=d.shown.filter(q=>d.parts[q].st==='верно'&&(g.part!==q||!g.built||errHere(q))||d.parts[q].st==='ошибка'&&!errHere(q)&&!soft(q)).map(q=>q+':'+d.parts[q].st+' на чертеже '+g.part+(g.err?' ('+g.err+')':''));
    if(g.err&&d.verdict==='верно') bad.push('верно при ошибке '+g.err); if(!g.err&&!g.errSoft&&(d.verdict==='ошибка'||d.verdict==='ошибка в данных')) bad.push(d.verdict+' без ошибки');
    if(bad.length){ T.false++; T.falseWhy.push('в'+n+' чертёж '+(j+1)+': '+bad.join('; ')+' | '+d.why.join(' | ').slice(0,200)); }
    if(d.verdict==='верно'||d.verdict==='данные нанесены верно') T.ok++; if(g.err&&(d.verdict==='ошибка'||d.parts[g.err[0]]&&d.parts[g.err[0]].st==='ошибка')) T.caught++; if(d.verdict==='не могу прочитать'||d.verdict==='не снят') T.unread++; });
  const ms=Date.now()-t0; T.ms+=ms;
  console.log('в'+n+(ER[i]?' ('+ER[i]+')':'')+': общий '+ov.drawings.map(d=>f1(d.ppm)).join('/')+' px/мм, найдено '+new Set(who.filter(k=>k>=0)).size+'/4; снимки: '+log.join(', ')+'\n   итог: '+D.map((d,j)=>(j+1)+'('+(G[who[j]]?G[who[j]].part:'?')+') '+d.verdict+' ['+d.read+'/'+d.n+']').join('; ')+'  '+(ms/1000).toFixed(0)+' с'); }
console.log('\nИТОГО: листов '+T.sheets+', чертежей найдено '+T.dr+'/'+T.drT+', снимков вблизи '+T.shots+' (px/мм медиана '+f1(med(T.ppm))+', мин '+f1(Math.min(...T.ppm))+')'
  +', опознано: верно '+T.idOk+', не узнано '+T.idUnk+', ОШИБОЧНО '+T.idBad+'; по чертежам: «верно» '+T.ok+', ошибка найдена '+T.caught+'/'+T.errT+', не прочитано '+T.unread+', ЛОЖНЫХ '+T.false+'; '+(T.ms/1000/Math.max(1,T.sheets)).toFixed(0)+' с на лист');
T.falseWhy.forEach(w=>console.log('  ЛОЖНО: '+w));
