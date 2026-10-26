/* ═══════════ Замер глаз на настоящей модели: синтетические листы, где правда известна до сотых мм ═══════════
   node lab/dz/eyes-eval.js [--sheets=6] [--dz2=3] [--strategy=full,zoom,own,own+full] [--models=m1,m2] [--brain=1]
   node lab/dz/eyes-eval.js --strategy=own --dz2=0 — свои глаза, без модели (findDrawings: все копии фигуры по линиям)
   Нужен доступ к модели: EYES_TOKEN (IAM-токен) и EYES_FOLDER — Yandex AI Studio (или EYES_KEY / EYES_URL / EYES_MODEL —
   другая модель). Отсюда Yandex Cloud недоступен — прогон идёт в GitHub Actions (.github/workflows/eyes-eval.yml).
   Листы: ДЗ №3 — четыре чертежа на А3 (quadsynth.js), ДЗ №2 — А3 с одним чертежом (vsynth.js).
   Стратегии: full — всё фото одним запросом (1280 px); zoom — «лупа»: первый запрос находит чертежи, затем каждый чертёж
   отдельным запросом, вырезанный крупно (до 1280 px на один чертёж); own — свои глаза без модели; own+full — свои
   глаза и рамки модели вместе (mergeDrawings, как в сканере).
   Меры: найдено чертежей; по подписям точек условия — найдено, перепутано (ближе к другой точке своего чертежа), промах в мм
   (медиана, 90 %); время; затем мозг (eyes.js → проверка) по ответу глаз: прочитано чертежей и ЛОЖНЫЕ вердикты (все листы
   начерчены верно — любое «ошибка» ложно). */
const IMG=require('../img.js'), zlib=require('zlib'), fs=require('fs'), M=require('./model.js'), EY=require('./eyes.js'), SE=require('../../server/lib/eyes.js');
const Q=require('./quadsynth.js'), VS=require('./vsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), NQ=+(A.sheets||6), N2=+(A.dz2||3), STR=(A.strategy||'full,zoom').split(','), BRAIN=A.brain!=='0';
const TOKEN=process.env.EYES_TOKEN||'';
const med=a=>{ const t=a.slice().sort((x,y)=>x-y); return t.length?t[t.length>>1]:NaN; }, q90=a=>{ const t=a.slice().sort((x,y)=>x-y); return t.length?t[Math.floor(t.length*0.9)]:NaN; };
const f1=x=>isFinite(x)?x.toFixed(1):'—';

/* серое PNG (фильтр up) длинной стороной до maxSide: модели этого хватает, запрос лёгкий */
function grayPNG(im,box,maxSide){ const [bx,by,bw,bh]=box||[0,0,im.width,im.height], k=Math.min(1,maxSide/Math.max(bw,bh)), w=Math.max(1,Math.round(bw*k)), h=Math.max(1,Math.round(bh*k)), g=Buffer.alloc((w+1)*h);
  for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ let S=0,N=0; const X0=bx+Math.floor(x/k), Y0=by+Math.floor(y/k), X1=bx+Math.floor((x+1)/k), Y1=by+Math.floor((y+1)/k);
      for(let yy=Y0;yy<Math.max(Y0+1,Y1);yy++) for(let xx=X0;xx<Math.max(X0+1,X1);xx++){ if(xx<0||yy<0||xx>=im.width||yy>=im.height) continue; const i=(yy*im.width+xx)*4; S+=0.299*im.data[i]+0.587*im.data[i+1]+0.114*im.data[i+2]; N++; }
      g[y*(w+1)+1+x]=N?Math.round(S/N):255; } }
  for(let y=h-1;y>=0;y--){ g[y*(w+1)]=y?2:0; if(y) for(let x=0;x<w;x++) g[y*(w+1)+1+x]=(g[y*(w+1)+1+x]-g[(y-1)*(w+1)+1+x])&255; }
  const crcT=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let j=0;j<8;j++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; } return t; })(), crc=b=>{ let c=0xFFFFFFFF; for(const x of b) c=crcT[(c^x)&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
  const chunk=(t,d)=>{ const l=Buffer.alloc(4); l.writeUInt32BE(d.length); const td=Buffer.concat([Buffer.from(t),d]), c=Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l,td,c]); };
  const ih=Buffer.alloc(13); ih.writeUInt32BE(w,0); ih.writeUInt32BE(h,4); ih[8]=8; ih[9]=0;
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(g,{level:9})),chunk('IEND',Buffer.alloc(0))]);
  return {url:'data:image/png;base64,'+png.toString('base64'),w,h,k,bx,by,kb:png.length/1024}; }

/* листы с правдой: группы = чертежи, у каждого точки условия в мм листа */
function sheets(){ const out=[];
  /* каждый второй лист — с ошибкой в части 1 или 4 (ось замены не ⟂, неверный радиус): про неё «верно» — ложное */
  const ER=[null,'a_dir',null,'d_R',null,'a_d',null,'d_R',null,'a_dir'];
  [3,9,14,21,27,30,6,17,24,12].slice(0,NQ).forEach((n,i)=>{ const s=Q.sheet({n,seed:11+i,err:ER[i]||undefined}); if(!s) return;
    out.push({name:'ДЗ3 в'+n+' (4 чертежа'+(ER[i]?', ошибка '+ER[i]:'')+')',dz:3,n,img:s.img,H:s.truth.H,groups:s.truth.parts.map(p=>({part:p.part,built:p.built,pts:p.pts,err:p.err&&p.affects!==false?p.err:null,errSoft:p.err&&p.affects===false?p.err:null}))}); });
  [8,15,25,3,19].slice(0,N2).forEach((n,i)=>{ const s=VS.sheet({dz:2,n,err:'ok',seed:21+i,turn:0}); if(!s) return; const t=s.truth, pts={};
    M.given(t.id,t.data).pts.forEach(q=>{ pts[q.l]=[t.O[0]+q.at[0],t.O[1]+q.at[1]]; }); pts.O=t.O.slice();
    out.push({name:'ДЗ2 в'+n,dz:2,n,img:s.img,H:t.H,groups:[{part:null,pts}]}); });
  return out; }

async function ask(cfg,pic,dz,n,text){ const t0=Date.now(); const r=await SE.ask(cfg,{image:pic.url,w:pic.w,h:pic.h,dz,n,text},{token:()=>TOKEN,timeout:90000}); return {text:r.text,ms:Date.now()-t0,info:r.info}; }
/* стратегии: ответ — чертежи с точками в px полного снимка */
/* шкала координат ответа: px присланного фото или 0…1000 (так отвечает семейство Qwen3-VL) — A.scale=px|n1000|auto */
const SCALE=A.scale||'px';
function toFull(E,pic,mode,W,Hh){ E.drawings.forEach(d=>{ const f=p=>mode==='n1000'?[pic.bx+p[0]/1000*pic.w/pic.k,pic.by+p[1]/1000*pic.h/pic.k]:[pic.bx+p[0]/pic.k,pic.by+p[1]/pic.k];
    Object.keys(d.pts).forEach(l=>{ d.pts[l]=f(d.pts[l]); }); if(d.box){ const a=f([d.box[0],d.box[1]]), b=f([d.box[2],d.box[3]]); d.box=[a[0],a[1],b[0],b[1]]; } }); return E; }
async function full(cfg,sh,mode){ const pic=Object.assign(grayPNG(sh.img,null,1280),{bx:0,by:0}), r=await ask(cfg,pic,sh.dz,sh.n), E=EY.parse(r.text);
  if(E.error) return {drawings:[],ms:r.ms,calls:1,err:E.error,text:r.text.slice(0,300)};
  const raw=JSON.parse(JSON.stringify(E)); toFull(E,pic,mode||SCALE);
  return {drawings:E.drawings,raw,pic,ms:r.ms,calls:1,text:r.text.slice(0,400)}; }
async function zoom(cfg,sh){ const f=await full(cfg,sh,SCALE); if(!f.drawings.length) return Object.assign(f,{note:'первый проход пуст'}); let ms=f.ms, calls=1; const out=[];
  for(const d of f.drawings){ const P=Object.values(d.pts); let b=d.box&&d.box.every(isFinite)?d.box.slice():null;
    if(!b&&P.length){ b=[Math.min(...P.map(p=>p[0])),Math.min(...P.map(p=>p[1])),Math.max(...P.map(p=>p[0])),Math.max(...P.map(p=>p[1]))]; }
    if(!b){ out.push(d); continue; }
    /* рамка чертежа с запасом 15 % (глаза рамку дают грубо), не меньше 1/5 снимка */
    const W=sh.img.width, Hh=sh.img.height, mw=Math.max((b[2]-b[0])*0.15,W*0.03), mh=Math.max((b[3]-b[1])*0.15,Hh*0.03);
    const x0=Math.max(0,Math.floor(b[0]-mw)), y0=Math.max(0,Math.floor(b[1]-mh)), x1=Math.min(W,Math.ceil(b[2]+mw)), y1=Math.min(Hh,Math.ceil(b[3]+mh));
    const pic=grayPNG(sh.img,[x0,y0,x1-x0,y1-y0],1280);
    try{ const r=await ask(cfg,pic,sh.dz,sh.n,'На фото — ОДИН чертёж (вырезан с листа). ДЗ №'+sh.dz+'. Вариант '+sh.n+'. Размер фото: '+pic.w+' × '+pic.h+' px.'); ms+=r.ms; calls++;
      const E=EY.parse(r.text); if(E.error||!E.drawings.length){ out.push(d); continue; }
      const dd=E.drawings.sort((a,c)=>Object.keys(c.pts).length-Object.keys(a.pts).length)[0];
      toFull({drawings:[dd]},Object.assign(pic,{bx:x0,by:y0}),SCALE); dd.box=[x0,y0,x1,y1]; dd.part=dd.part||d.part; out.push(dd); }
    catch(e){ out.push(d); } }
  return {drawings:out,ms,calls}; }

/* свои глаза: чертежи по линиям, без модели (только ДЗ №3) */
async function own(cfg,sh){ const t0=Date.now(); if(sh.dz!==3) return {drawings:[],ms:0,calls:0,err:'свои глаза — только ДЗ №3'};
  const f=EY.findDrawings(sh.img,{dz:3,n:sh.n}); return {drawings:f.ok?f.drawings:[],ms:Date.now()-t0,calls:0,err:f.ok?null:f.reason}; }
async function ownFull(cfg,sh){ const a=await own(cfg,sh), b=await full(cfg,sh); return {drawings:sh.dz===3?EY.mergeDrawings(a.drawings,b.drawings):b.drawings,ms:a.ms+b.ms,calls:b.calls,raw:b.raw,pic:b.pic,text:b.text,err:b.err}; }
const STRATS={full,zoom,own,'own+full':ownFull};

/* оценка ответа глаз против правды листа */
function score(sh,res){ const Hi=IMG.H.inv(sh.H), mm=p=>IMG.H.apply(Hi,p), used=new Set(), st={found:0,total:0,swap:0,err:[],extra:0,drawingsFound:0};
  sh.groups.forEach(g=>{ st.total+=Object.keys(g.pts).length; });
  res.drawings.forEach(d=>{ /* свои глаза: подписей нет — чертёж по началу O привязки (≤ 6 мм от правды) */
    if(d.A&&!Object.keys(d.pts||{}).length){ const o=mm([d.A[2],d.A[5]]); let b=null; sh.groups.forEach((g,gi)=>{ if(used.has(gi)) return; const e=Math.hypot(g.pts.O[0]-o[0],g.pts.O[1]-o[1]); if(e<=6&&(!b||e<b.e)) b={gi,e}; });
      if(!b){ st.extra++; return; } used.add(b.gi); st.drawingsFound++; d._group=b.gi; return; }
    /* какой чертёж листа это: где больше подписей в 15 мм от своей правды */
    let best=null; sh.groups.forEach((g,gi)=>{ if(used.has(gi)) return; let k=0; Object.entries(d.pts).forEach(([l,p])=>{ const t=g.pts[l]; if(t){ const m=mm(p); if(Math.hypot(m[0]-t[0],m[1]-t[1])<=15) k++; } }); if(!best||k>best.k) best={gi,k}; });
    if(!best||best.k===0){ st.extra++; return; } used.add(best.gi); st.drawingsFound++; const g=sh.groups[best.gi]; d._group=best.gi;
    Object.entries(d.pts).forEach(([l,p])=>{ const t=g.pts[l]; if(!t) return; const m=mm(p), e=Math.hypot(m[0]-t[0],m[1]-t[1]);
      /* перепутана: ближе (на 3 мм) к другой точке условия этого чертежа */
      const other=Object.entries(g.pts).some(([l2,t2])=>l2!==l&&Math.hypot(m[0]-t2[0],m[1]-t2[1])+3<e);
      if(other) st.swap++; else { st.found++; st.err.push(e); } }); });
  return st; }

async function brain(sh,res){ if(!BRAIN||!res.drawings.length) return null; const t0=Date.now();
  let r; try{ r=EY.checkEyes(sh.img,{dz:sh.dz,n:sh.n,drawings:res.drawings},{dz:sh.dz,n:sh.n}); }catch(e){ return {err:String(e.message||e)}; }
  /* где мозг поставил начало O каждого чертежа — на своём ли месте листа (≤ 6 мм от правды какого-то чертежа) */
  const Hi=IMG.H.inv(sh.H); let misplaced=0; r.drawings.forEach(g=>{ if(!g.ok||!g._grid||!g.given) return; const o=IMG.H.apply(Hi,g._grid.map(g.given.O[0],g.given.O[1]));
    if(!sh.groups.some(G=>Math.hypot(G.pts.O[0]-o[0],G.pts.O[1]-o[1])<=6)) misplaced++; });
  /* чей это чертёж: ближайшее начало O правды; ложно — «ошибка» на верном чертеже или «верно» на чертеже с ошибкой */
  const grpOf=g=>{ if(!g.ok||!g._grid||!g.given) return null; const o=IMG.H.apply(Hi,g._grid.map(g.given.O[0],g.given.O[1])); let b=null; sh.groups.forEach(G=>{ const d=Math.hypot(G.pts.O[0]-o[0],G.pts.O[1]-o[1]); if(d<=6&&(!b||d<b.d)) b={G,d}; }); return b&&b.G; };
  /* ошибка, которая не меняет ответ (errSoft: a_d не в конце прямой A₄B₄C₄), — как в test-check3.js: «верно» не ложно,
     но и «ошибка» про эту часть не ложна */
  /* ложно и по частям: «верно» части на чертеже другой части (или не построенной, или с ошибкой в ней), «ошибка» части,
     в которой ошибки нет */
  const partFalse=g=>{ const G=grpOf(g); if(!G||!g.parts) return []; return (g.shown||[]).filter(k=>{ const p=g.parts[k]; if(!p) return false; const errHere=!!(G.err&&G.err[0]===k&&G.part===k);
    return p.st==='верно'&&(G.part!==k||!G.built||errHere)||p.st==='ошибка'&&!errHere&&!(G.errSoft&&G.errSoft[0]===k&&G.part===k); }).map(k=>k+':'+g.parts[k].st+' на чертеже '+G.part+(G.err?' ('+G.err+')':'')); };
  const isFalse=g=>{ const G=grpOf(g); return G&&(G.err?g.verdict==='верно':!G.errSoft&&(g.verdict==='ошибка'||g.verdict==='ошибка в данных'))||partFalse(g).length>0; };
  const vs=r.drawings.map(g=>g.verdict), bad=sh.dz===2?vs.filter(v=>v==='ошибка'||v==='другое решение'||v==='не тот вариант'):r.drawings.filter(isFalse).map(g=>g.verdict);
  const caught=r.drawings.filter(g=>{ const G=grpOf(g); return G&&G.err&&(g.verdict==='ошибка'||g.parts&&g.parts[G.err[0]]&&g.parts[G.err[0]].st==='ошибка'&&(g.shown||[]).includes(G.err[0])); }).length;
  const read=r.drawings.filter(g=>g.ok).length, ok=sh.dz===2?vs.filter(v=>v==='верно').length:vs.filter(v=>v==='верно'||v==='данные нанесены верно').length;
  return {verdicts:vs,read,ok,misplaced,false:bad.length,caught,falseWhy:r.drawings.filter(g=>sh.dz===2?bad.includes(g.verdict):isFalse(g)).map(g=>partFalse(g).concat((g.why||[]).filter(w=>/неточно|ошибк|должн|взята|отклон/.test(w))).join(' | ').slice(0,300)),ms:Date.now()-t0}; }

(async()=>{ const base=SE.eyesFromEnv(process.env);
  const noModel=STR.every(s=>s==='own');
  if(!noModel&&(!base.on||!(TOKEN||base.key))){ console.log('нет доступа к модели: нужны EYES_TOKEN и EYES_FOLDER (или EYES_KEY); без модели — --strategy=own'); process.exit(1); }
  const models=noModel?['свои глаза']:A.models?A.models.split(',').map(m=>m.includes('://')?m:'gpt://{folder}/'+m):[process.env.EYES_MODEL||SE.DEF_MODEL];
  console.log('листы строю…'); const S=sheets(); console.log('листов: '+S.length+' ('+S.map(s=>s.name).join(', ')+')');
  const md=['# Замер глаз на настоящей модели','','листы: '+S.map(s=>s.name).join(', '),''], raw=[];
  for(const m of models){ const cfg=SE.eyesFromEnv(Object.assign({},process.env,{EYES_MODEL:m}));
    for(const strat of STR){ const T={found:0,total:0,swap:0,err:[],extra:0,dr:0,drT:0,ms:0,calls:0,fails:0,read:0,ok:0,bdr:0,false:0,falseWhy:[]};
      console.log('\n══ модель '+cfg.model.replace(cfg.folder,'<каталог>')+', стратегия '+strat);
      for(const sh of S){ let res; try{ res=await STRATS[strat](cfg,sh); }catch(e){ T.fails++; console.log('  '+sh.name+': ОШИБКА '+e.message.slice(0,200)); continue; }
        const st=score(sh,res);
        /* диагностика: та же выдача в другой шкале и остаток после лучшего аффинного (систематическое — лечится) */
        if(res.raw&&strat==='full'){ const alt=toFull(JSON.parse(JSON.stringify(res.raw)),res.pic,SCALE==='px'?'n1000':'px'), sa=score(sh,{drawings:alt.drawings});
          const Hi=IMG.H.inv(sh.H), pairs=[]; res.drawings.forEach(d=>{ if(d._group==null) return; const g=sh.groups[d._group]; Object.entries(d.pts).forEach(([l,p])=>{ if(g.pts[l]) pairs.push({p:IMG.H.apply(Hi,p),t:g.pts[l]}); }); });
          let aff='—'; if(pairs.length>=6){ const Af=EY.bindAffine(pairs.map(q=>({l:'',m:q.p,p:q.t})),{tol:15,sRange:[0.5,2]}); if(Af) aff='масштаб '+Af.s.toFixed(3)+', согласных '+Af.inl.length+'/'+pairs.length+', остаток '+f1(Af.rms)+' мм'; }
          T.diag=(T.diag||[]); T.diag.push(sh.name+': в шкале '+(SCALE==='px'?'0…1000':'px')+' — точки '+sa.found+'/'+sa.total+', промах '+f1(med(sa.err))+' мм; лучшее аффинное по точкам: '+aff);
          console.log('    · '+T.diag[T.diag.length-1]+' | ответ: '+String(res.text||'').replace(/\s+/g,' ').slice(0,220)); } T.found+=st.found; T.total+=st.total; T.swap+=st.swap; T.err.push(...st.err); T.extra+=st.extra; T.dr+=st.drawingsFound; T.drT+=sh.groups.length; T.ms+=res.ms; T.calls+=res.calls;
        const b=await brain(sh,res); if(b&&!b.err){ T.read+=b.read; T.ok+=b.ok; T.bdr+=res.drawings.length; T.false+=b.false; b.falseWhy.forEach(w=>T.falseWhy.push(sh.name+': '+w)); }
        raw.push({model:cfg.model.replace(cfg.folder,'<каталог>'),strat,sheet:sh.name,drawings:res.drawings,err:res.err||null,brain:b});
        console.log('  '+sh.name.padEnd(22)+' чертежей '+st.drawingsFound+'/'+sh.groups.length+(st.extra?' (+'+st.extra+' лишних)':'')+', точки '+st.found+'/'+st.total+(st.swap?', перепутано '+st.swap:'')+', промах медиана '+f1(med(st.err))+' мм, 90 % '+f1(q90(st.err))+' мм, '+(res.ms/1000).toFixed(1)+' с ('+res.calls+' запр.)'
          +(b?b.err?' | мозг: сбой '+b.err:' | мозг: прочитано '+b.read+'/'+res.drawings.length+', «верно» '+b.ok+(b.caught?', ошибка найдена '+b.caught:'')+(b.misplaced?', НЕ НА МЕСТЕ '+b.misplaced:'')+', ЛОЖНЫХ '+b.false+' ['+b.verdicts.join('; ')+'] '+(b.ms/1000).toFixed(0)+' с':'')+(res.err?' | '+res.err:'')); }
      const line='| '+cfg.model.replace(/^gpt:\/\/[^/]+\//,'').replace(/\/latest$/,'')+' | '+strat+' | '+T.dr+'/'+T.drT+' | '+T.found+'/'+T.total+' ('+Math.round(100*T.found/Math.max(1,T.total))+' %) | '+T.swap+' | '+f1(med(T.err))+' / '+f1(q90(T.err))+' | '+(T.ms/1000/Math.max(1,S.length-T.fails)).toFixed(1)+' с | '+T.read+'/'+T.bdr+' | '+T.ok+' | **'+T.false+'** |';
      md.push(line); T.falseWhy.forEach(w=>md.push('- ЛОЖНО: '+w));
      console.log('ИТОГО: чертежей '+T.dr+'/'+T.drT+', точки '+T.found+'/'+T.total+', перепутано '+T.swap+', промах медиана '+f1(med(T.err))+' мм, 90 % '+f1(q90(T.err))+' мм, '+(T.ms/1000).toFixed(0)+' с всего, мозг: прочитано '+T.read+'/'+T.bdr+', «верно» '+T.ok+', ЛОЖНЫХ '+T.false+(T.fails?', сбоев запроса '+T.fails:''));
      T.falseWhy.forEach(w=>console.log('  ЛОЖНО: '+w)); } }
  md.splice(4,0,'| модель | стратегия | чертежей | точки | перепутано | промах, мм (медиана / 90 %) | время на лист | мозг: прочитано | «верно» | ложных |','|---|---|---|---|---|---|---|---|---|---|');
  if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md.join('\n')+'\n');
  fs.writeFileSync(A.out||'eyes-eval.json',JSON.stringify(raw,null,1)); console.log('\n'+md.join('\n')); })().catch(e=>{ console.error(e); process.exit(1); });
