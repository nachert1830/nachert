/* ═══════════ Замер глаз на настоящей модели: синтетические листы, где правда известна до сотых мм ═══════════
   node lab/dz/eyes-eval.js [--sheets=6] [--dz2=3] [--strategy=full,zoom,own,own+full,net,net+own] [--netw=eyes.onnx] [--models=m1,m2] [--brain=1]
   node lab/dz/eyes-eval.js --strategy=own --dz2=0 — свои глаза, без модели (findDrawings: все копии фигуры по линиям)
   node lab/dz/eyes-eval.js --provider=openrouter --models=google/gemini-3-pro --strategy=own+full --dz2=0 — модель через
     OpenRouter (ключ OPENROUTER_API_KEY; точное имя — из списка моделей OpenRouter, ближайшее к заданному)
   node lab/dz/eyes-eval.js --table=a.json,b.json — сводная таблица прогонов (REPORT.md, 7к; итог workflow)
   Нужен доступ к модели: EYES_TOKEN (IAM-токен) и EYES_FOLDER — Yandex AI Studio (или EYES_KEY / EYES_URL / EYES_MODEL —
   другая модель). Отсюда Yandex Cloud недоступен — прогон идёт в GitHub Actions (.github/workflows/eyes-eval.yml).
   Листы: ДЗ №3 — четыре чертежа на А3 (quadsynth.js), ДЗ №2 — А3 с одним чертежом (vsynth.js).
   Стратегии: full — всё фото одним запросом (1280 px); zoom — «лупа»: первый запрос находит чертежи, затем каждый чертёж
   отдельным запросом, вырезанный крупно (до 1280 px на один чертёж); own — свои глаза без модели; own+full — свои
   глаза и рамки модели вместе (mergeDrawings, как в сканере).
   Шкала координат ответа — сама (eyes.js rescale: px, 0…1000 [x, y], 0…1000 [y, x] у Gemini); --scale=px|n1000|yx1000 — задать.
   Часть опознана — номер части у чертежа (от модели) против правды quadsynth: верно / неверно (опаснее, чем «не знаю»).
   Меры: найдено чертежей; по подписям точек условия — найдено, перепутано (ближе к другой точке своего чертежа), промах в мм
   (медиана, 90 %); время; затем мозг (eyes.js → проверка) по ответу глаз: прочитано чертежей и ЛОЖНЫЕ вердикты (все листы
   начерчены верно — любое «ошибка» ложно). */
const IMG=require('../img.js'), zlib=require('zlib'), fs=require('fs'), M=require('./model.js'), EY=require('./eyes.js'), SE=require('../../server/lib/eyes.js');
const Q=require('./quadsynth.js'), VS=require('./vsynth.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), NQ=+(A.sheets||6), N2=+(A.dz2||3), STR=(A.strategy||'full,zoom').split(','), BRAIN=A.brain!=='0';
/* --size=W,H — размер синтетического снимка (px/мм листа: 3000 px по длинной стороне ≈ 6 px/мм); --ppm — в имени листа */
const CLOSE=A.closeup!=null?+A.closeup:null, CSIDE=+(A.side||220);
/* --closeup=8 [--side=220] — снимки вблизи: каждый чертёж своим кадром (с полем 8 мм); side — «мм» длинной стороны кадра для поиска */
const SIZE=A.size?A.size.split(',').map(Number):undefined, ppmOf=Hm=>{ const P=q=>IMG.H.apply(Hm,q), p=P([210,148]), u=P([211,148]), v=P([210,149]); return Math.sqrt(Math.abs((u[0]-p[0])*(v[1]-p[1])-(u[1]-p[1])*(v[0]-p[0]))); };
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
  [3,9,14,21,27,30,6,17,24,12].slice(0,NQ).forEach((n,i)=>{ const s=Q.sheet({n,seed:11+i,err:ER[i]||undefined,size:SIZE,closeup:CLOSE}); if(!s) return;
    const G=s.truth.parts.map(p=>({part:p.part,built:p.built,pts:p.pts,err:p.err&&p.affects!==false?p.err:null,errSoft:p.err&&p.affects===false?p.err:null}));
    /* --closeup=поле мм: вместо общего снимка — снимок каждого чертежа вблизи (как просит камера); в кадре один чертёж, правда — все */
    if(CLOSE!=null){ s.views.forEach((v,j)=>out.push({name:'ДЗ3 в'+n+' вблизи '+'abcd'[j]+(ER[i]?' (ошибка '+ER[i]+')':'')+', '+ppmOf(v.H).toFixed(1).replace('.',',')+' px/мм',dz:3,n,img:v.img,H:v.H,groups:G,want:1,side:CSIDE})); return; }
    out.push({name:'ДЗ3 в'+n+' (4 чертежа'+(ER[i]?', ошибка '+ER[i]:'')+', '+ppmOf(s.truth.H).toFixed(1).replace('.',',')+' px/мм)',dz:3,n,img:s.img,H:s.truth.H,groups:s.truth.parts.map(p=>({part:p.part,built:p.built,pts:p.pts,err:p.err&&p.affects!==false?p.err:null,errSoft:p.err&&p.affects===false?p.err:null}))}); });
  [8,15,25,3,19].slice(0,N2).forEach((n,i)=>{ const s=VS.sheet({dz:2,n,err:'ok',seed:21+i,turn:0}); if(!s) return; const t=s.truth, pts={};
    M.given(t.id,t.data).pts.forEach(q=>{ pts[q.l]=[t.O[0]+q.at[0],t.O[1]+q.at[1]]; }); pts.O=t.O.slice();
    out.push({name:'ДЗ2 в'+n,dz:2,n,img:s.img,H:t.H,groups:[{part:null,pts}]}); });
  return out; }

/* цена запроса: OpenRouter отдаёт usage.cost ($); иначе — по токенам и ценам из списка моделей (PRICE) */
let PRICE=null; const costOf=u=>!u?0:u.cost!=null?+u.cost:PRICE?(u.prompt_tokens||0)*PRICE.prompt+(u.completion_tokens||0)*PRICE.completion+PRICE.image:0;
async function ask(cfg,pic,dz,n,text){ const t0=Date.now(); const r=await SE.ask(cfg,{image:pic.url,w:pic.w,h:pic.h,dz,n,text},{token:()=>TOKEN,timeout:180000}); const u=r.info&&r.info.usage;
  return {text:r.text,ms:Date.now()-t0,info:r.info,cost:costOf(u),tok:u?(u.prompt_tokens||0)+(u.completion_tokens||0):0}; }
/* стратегии: ответ — чертежи с точками в px полного снимка */
/* шкала координат ответа — сама, по ответу (eyes.js rescale), или задана --scale; свои глаза листа — для выбора по рамкам */
const SCALE=A.scale||'auto';
function toFull(E,pic,cfg,sh,own){ const o={w:pic.w,h:pic.h,k:pic.k,bx:pic.bx,by:pic.by,W:sh.img.width,H:sh.img.height,model:cfg.model,dz:sh.dz,n:sh.n,own};
  const r=EY.rescale(E,SCALE==='auto'?o:Object.assign(o,{only:SCALE})); E.drawings=r.E.drawings; return r.scale; }
async function full(cfg,sh){ const pic=Object.assign(grayPNG(sh.img,null,1280),{bx:0,by:0}), r=await ask(cfg,pic,sh.dz,sh.n), E=EY.parse(r.text);
  if(E.error) return {drawings:[],model:[],ms:r.ms,calls:1,cost:r.cost,tok:r.tok,err:E.error,text:r.text.slice(0,300)};
  const own=sh.dz===3?(await own_(sh)).drawings:null, scale=toFull(E,pic,cfg,sh,own);
  return {drawings:E.drawings,model:E.drawings,scale,ms:r.ms,calls:1,cost:r.cost,tok:r.tok,text:r.text.slice(0,400)}; }
async function zoom(cfg,sh){ const f=await full(cfg,sh); if(!f.drawings.length) return Object.assign(f,{note:'первый проход пуст'}); let ms=f.ms, calls=1, cost=f.cost, tok=f.tok; const out=[];
  for(const d of f.drawings){ const P=Object.values(d.pts); let b=d.box&&d.box.every(isFinite)?d.box.slice():null;
    if(!b&&P.length){ b=[Math.min(...P.map(p=>p[0])),Math.min(...P.map(p=>p[1])),Math.max(...P.map(p=>p[0])),Math.max(...P.map(p=>p[1]))]; }
    if(!b){ out.push(d); continue; }
    /* рамка чертежа с запасом 15 % (глаза рамку дают грубо), не меньше 1/5 снимка */
    const W=sh.img.width, Hh=sh.img.height, mw=Math.max((b[2]-b[0])*0.15,W*0.03), mh=Math.max((b[3]-b[1])*0.15,Hh*0.03);
    const x0=Math.max(0,Math.floor(b[0]-mw)), y0=Math.max(0,Math.floor(b[1]-mh)), x1=Math.min(W,Math.ceil(b[2]+mw)), y1=Math.min(Hh,Math.ceil(b[3]+mh));
    const pic=grayPNG(sh.img,[x0,y0,x1-x0,y1-y0],1280);
    try{ const r=await ask(cfg,pic,sh.dz,sh.n,'На фото — ОДИН чертёж (вырезан с листа). ДЗ №'+sh.dz+'. Вариант '+sh.n+'. Размер фото: '+pic.w+' × '+pic.h+' px.'); ms+=r.ms; calls++; cost+=r.cost; tok+=r.tok;
      const E=EY.parse(r.text); if(E.error||!E.drawings.length){ out.push(d); continue; }
      const dd=E.drawings.sort((a,c)=>Object.keys(c.pts).length-Object.keys(a.pts).length)[0];
      toFull({drawings:[dd]},Object.assign(pic,{bx:x0,by:y0}),cfg,sh,null); dd.box=[x0,y0,x1,y1]; dd.part=dd.part||d.part; out.push(dd); }
    catch(e){ out.push(d); } }
  return {drawings:out,model:f.model,scale:f.scale,ms,calls,cost,tok}; }

/* свои глаза: чертежи по линиям, без модели (только ДЗ №3) */
/* свои глаза листа — один раз на лист (их ждут и стратегии с моделью: рамки, шкала) */
const OWN=new Map();
async function own_(sh){ if(OWN.has(sh)) return OWN.get(sh); const t0=Date.now(); let r;
  if(sh.dz!==3) r={drawings:[],ms:0,calls:0,err:'свои глаза — только ДЗ №3'};
  else { const f=EY.findDrawings(sh.img,{dz:3,n:sh.n,side:sh.side}); r={drawings:f.ok?f.drawings:[],ms:Date.now()-t0,calls:0,err:f.ok?null:f.reason}; }
  OWN.set(sh,r); return r; }
async function own(cfg,sh){ const r=await own_(sh); return Object.assign({},r,{drawings:r.drawings.map(d=>Object.assign({},d))}); }
async function ownFull(cfg,sh){ const a=await own(cfg,sh), b=await full(cfg,sh); return {drawings:sh.dz===3?EY.mergeDrawings(a.drawings,b.drawings):b.drawings,model:b.model,scale:b.scale,ms:a.ms+b.ms,msModel:b.ms,calls:b.calls,cost:b.cost,tok:b.tok,text:b.text,err:b.err}; }
/* сеть глаз (lab/dz/net): кандидаты точек → чертежи по геометрии; net+own — свои глаза по линиям, а чертежи сети — где своих нет */
let NETL=null; const NET=()=>NETL||(NETL=(async()=>{ const N=require('./net/eyesnet.js'); await N.load(A.netw||__dirname+'/net/eyes.onnx'); return N; })());
async function net(cfg,sh){ const t0=Date.now(), N=await NET(), r=await N.eyes(sh.img,{dz:sh.dz,n:sh.n}); return {drawings:r.ok?r.drawings:[],ms:Date.now()-t0,calls:0,err:r.ok?null:r.reason}; }
async function netOwn(cfg,sh){ const a=await own(cfg,sh), b=await net(cfg,sh); return {drawings:EY.mergeDrawings(a.drawings,b.drawings),ms:a.ms+b.ms,calls:0,err:a.err&&b.err}; }
const STRATS={full,zoom,own,'own+full':ownFull,net,'net+own':netOwn};

/* оценка ответа глаз против правды листа */
function score(sh,res){ const Hi=IMG.H.inv(sh.H), mm=p=>IMG.H.apply(Hi,p), used=new Set(), st={found:0,total:0,swap:0,err:[],extra:0,drawingsFound:0};
  sh.groups.forEach(g=>{ st.total+=Object.keys(g.pts).length; });
  res.drawings.forEach(d=>{ /* свои глаза: подписей нет — чертёж по началу O привязки (≤ 6 мм от правды) */
    if(d.A&&!Object.keys(d.pts||{}).length){ const o=mm([d.A[2],d.A[5]]); let b=null; sh.groups.forEach((g,gi)=>{ if(used.has(gi)) return; const e=Math.hypot(g.pts.O[0]-o[0],g.pts.O[1]-o[1]); if(e<=6&&(!b||e<b.e)) b={gi,e}; });
      if(!b){ st.extra++; return; } used.add(b.gi); st.drawingsFound++; d._group=b.gi; return; }
    /* только рамка (точки — по желанию): чертёж, чьих точек условия в ней больше всего */
    if(!Object.keys(d.pts||{}).length){ const gi=boxGroup(sh,d.box,used); if(gi==null){ st.extra++; return; } used.add(gi); st.drawingsFound++; d._group=gi; return; }
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
  /* какую часть опознал сам мозг (по построению): для своих глаз — это и есть «часть опознана» */
  const bparts=r.drawings.map(g=>{ const G=grpOf(g); const p=g.idPart||(g.partGuess&&g.partGuess.length===1?g.partGuess[0]:null); return G?{box:null,pts:{},_gi:sh.groups.indexOf(G),part:p}:null; }).filter(Boolean);
  return {verdicts:vs,read,ok,misplaced,false:bad.length,caught,bparts,falseWhy:r.drawings.filter(g=>sh.dz===2?bad.includes(g.verdict):isFalse(g)).map(g=>partFalse(g).concat((g.why||[]).filter(w=>/неточно|ошибк|должн|взята|отклон/.test(w))).join(' | ').slice(0,300)),ms:Date.now()-t0}; }

/* рамка → чертёж листа: в ней ≥ 6 из 9 точек его условия (больше, чем у соседей) */
function boxGroup(sh,box,used){ if(!box||!box.every(isFinite)) return null; let b=null;
  sh.groups.forEach((g,i)=>{ if(used&&used.has(i)) return; const k=Object.values(g.pts).filter(t=>{ const p=IMG.H.apply(sh.H,t); return p[0]>=box[0]&&p[0]<=box[2]&&p[1]>=box[1]&&p[1]<=box[3]; }).length;
    if(k>=6&&(!b||k>b.k)) b={i,k}; }); return b?b.i:null; }
/* часть опознана: номер части у чертежа (как ответила модель) против правды quadsynth. Чертёж — по рамке, иначе по подписям.
   Построенный чертёж: верно / неверно / не сказала; чертёж только с условием: любой номер — неверно */
function partScore(sh,ds){ const st={ok:0,wrong:0,none:0,built:0,why:[]}; if(sh.dz!==3) return st; const Hi=IMG.H.inv(sh.H), got=new Map();
  (ds||[]).forEach(d=>{ let gi=d._gi!=null?d._gi:boxGroup(sh,d.box,null);
    if(gi==null&&Object.keys(d.pts||{}).length){ let b=null; sh.groups.forEach((g,i)=>{ const k=Object.entries(d.pts).filter(([l,p])=>{ const t=g.pts[l]; if(!t) return false; const m=IMG.H.apply(Hi,p); return Math.hypot(m[0]-t[0],m[1]-t[1])<=15; }).length; if(k&&(!b||k>b.k)) b={i,k}; }); if(b) gi=b.i; }
    if(gi==null) return; if(!got.has(gi)||!got.get(gi)&&d.part) got.set(gi,d.part||null); });
  const PN={a:1,b:2,c:3,d:4};
  sh.groups.forEach((g,i)=>{ const p=got.get(i)||null; if(g.built){ st.built++; if(p===g.part) st.ok++; else if(p){ st.wrong++; st.why.push('часть '+PN[g.part]+' названа '+PN[p]); } else st.none++; }
    else if(p){ st.wrong++; st.why.push('условие без построений названо частью '+PN[p]); } });
  return st; }

/* OpenRouter: точное имя модели — из списка (ближайшее к заданному: то же имя, или начинается с него; из нескольких —
   с картинками на входе, не :free, самая большая по числу параметров, instruct раньше thinking) и цены за токен */
async function orResolve(name){ const r=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(30000)}), j=await r.json(), all=(j.data||[]).filter(m=>((m.architecture||{}).input_modalities||['image']).includes('image'));
  const n=name.toLowerCase(), size=id=>{ const m=id.match(/(\d+(?:\.\d+)?)b(?![a-z])/); return m?+m[1]:0; };
  let c=all.filter(m=>m.id.toLowerCase()===n); if(!c.length) c=all.filter(m=>m.id.toLowerCase().startsWith(n)); if(!c.length) c=all.filter(m=>m.id.toLowerCase().includes(n.split('/').pop()));
  c=c.filter(m=>!/:free$/.test(m.id)).concat(c.filter(m=>/:free$/.test(m.id)));
  c.sort((a,b)=>(/:free$/.test(a.id)-/:free$/.test(b.id))||size(b.id)-size(a.id)||(/thinking/.test(a.id)-/thinking/.test(b.id))||a.id.length-b.id.length);
  const m=c[0]; if(!m) return {id:null,near:all.filter(x=>x.id.startsWith(n.split('/')[0]+'/')).map(x=>x.id).slice(0,30)};
  const P=m.pricing||{}; return {id:m.id,price:{prompt:+P.prompt||0,completion:+P.completion||0,image:+P.image||0},others:c.slice(1,6).map(x=>x.id)}; }

const sec=ms=>(ms/1000).toFixed(1).replace('.',',')+' с', usd=x=>x?'$'+(x<0.01?x.toFixed(4):x.toFixed(3)):'—';
/* строка итоговой таблицы: модель | часть опознана | «верно» | ошибка найдена | ложных | время | цена за лист */
function row(T){ return '| '+T.name+' | '+(T.partBuilt?T.partOk+' из '+T.partBuilt+(T.partWrong?' (неверно '+T.partWrong+')':''):'—')+' | '+T.ok+' (прочитано '+T.read+')'+' | '+T.caught+' из '+T.errs+' | **'+T.false+'** | '+sec(T.ms/Math.max(1,T.sheets))+(T.msModel?' (модель '+sec(T.msModel/Math.max(1,T.sheets))+')':'')+' | '+(T.cost?usd(T.cost/Math.max(1,T.sheets)):T.tok?Math.round(T.tok/Math.max(1,T.sheets)/100)/10+' тыс. токенов':T.calls?'—':'0')+(T.fails?' | сбоев '+T.fails:'')+' |'; }
const HEAD=['| модель | часть опознана | «верно» | ошибка найдена | **ложных** | время на лист | цена за лист |','|---|---|---|---|---|---|---|'];
function table(files){ const rows=[].concat(...files.map(f=>{ try{ return JSON.parse(fs.readFileSync(f,'utf8')).rows||[]; }catch(e){ return [{name:f+': нет результата ('+e.message.slice(0,60)+')',miss:true}]; } }));
  const ok=rows.filter(r=>!r.miss).sort((a,b)=>a.false-b.false||(b.partOk-(b.partWrong||0)*2)-(a.partOk-(a.partWrong||0)*2)||b.caught-a.caught||b.ok-a.ok||a.ms-b.ms);
  /* лучшая — среди зарубежных (OpenRouter: имя с «/»), при 0 ложных и без сбоев; Qwen в Yandex — запасная всегда */
  const best=ok.find(r=>r.false===0&&r.calls>0&&!r.fails&&r.name.includes('/')&&r.sheets===r.sheetNames.length);
  const md=['## Глаза: какая модель лучше','','листов: '+(ok[0]?ok[0].sheets+' ('+ok[0].sheetNames.join(', ')+')':'—'),'',...HEAD,...ok.map(row),...rows.filter(r=>r.miss).map(r=>'| '+r.name+' | | | | | | |'),'',
    best?'Лучшая при 0 ложных: **'+best.name+'** — подключить в кабинете: переменная репозитория EYES_BEST_MODEL='+best.name.replace(/,.*/,'')+' и секрет OPENROUTER_API_KEY, затем развёртывание (club.yml); запасная — Qwen в Yandex':'Зарубежная модель не подключается: ни одна не прошла все листы без ложных (или не измерена) — в кабинете остаётся Qwen в Yandex',''].concat(...ok.filter(r=>r.falseWhy&&r.falseWhy.length).map(r=>r.falseWhy.slice(0,6).map(w=>'- ЛОЖНО ('+r.name+'): '+w))).concat(...ok.filter(r=>r.partWhy&&r.partWhy.length).map(r=>['- часть ('+r.name+'): '+r.partWhy.slice(0,8).join('; ')])).concat(ok.filter(r=>r.scales).map(r=>'- шкала ('+r.name+'): '+Object.entries(r.scales).map(([k,v])=>k+' ×'+v).join(', ')));
  if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md.join('\n')+'\n'); console.log(md.join('\n')); }

(async()=>{ if(A.table){ table(A.table.split(',').flatMap(f=>fs.existsSync(f)&&fs.statSync(f).isDirectory()?fs.readdirSync(f,{recursive:true}).filter(x=>/\.json$/.test(x)).map(x=>f+'/'+x):[f])); return; }
  /* --resolve=имя,… — только точные имена в списке OpenRouter (ключ не нужен) */
  if(A.resolve){ for(const m of A.resolve.split(',')){ const r=await orResolve(m); console.log('OpenRouter: '+m+' → '+(r.id?r.id+' ($'+(r.price.prompt*1e6).toFixed(2)+' / $'+(r.price.completion*1e6).toFixed(2)+' за 1 млн токенов)':'нет такой; есть: '+r.near.join(', '))+(r.others&&r.others.length?' (ещё: '+r.others.join(', ')+')':'')); } return; }
  const OR=A.provider==='openrouter', env=Object.assign({},process.env,OR?{EYES_URL:SE.OR_URL}:{}), base=SE.eyesFromEnv(env);
  const noModel=STR.every(s=>/^(own|net|net\+own)$/.test(s));
  if(!noModel&&(!base.on||!(TOKEN||base.key))){ console.log('нет доступа к модели: '+(OR?'нужен OPENROUTER_API_KEY':'нужны EYES_TOKEN и EYES_FOLDER (или EYES_KEY)')+'; без модели — --strategy=own'); process.exit(1); }
  let models=noModel?['свои глаза']:A.models?A.models.split(',').map(m=>OR||m.includes('://')?m:'gpt://{folder}/'+m):[process.env.EYES_MODEL||SE.DEF_MODEL];
  if(OR&&!noModel){ const res=[]; for(const m of models){ const r=await orResolve(m); console.log('OpenRouter: '+m+' → '+(r.id||'нет такой; есть: '+r.near.join(', '))+(r.others&&r.others.length?' (ещё: '+r.others.join(', ')+')':'')); if(r.id){ res.push(r.id); PRICE=r.price; } } models=res;
    if(!models.length){ fs.writeFileSync(A.out||'eyes-eval.json',JSON.stringify({rows:[{name:A.models+': нет в списке OpenRouter',miss:true}]})); process.exit(1); } }
  console.log('листы строю…'); const S=sheets(); console.log('листов: '+S.length+' ('+S.map(s=>s.name).join(', ')+')');
  const rows=[], raw=[];
  for(const m of models){ const cfg=noModel?{model:'свои глаза'}:SE.eyesFromEnv(Object.assign({},env,{EYES_MODEL:m}));
    for(const strat of STR){ const name=(noModel?'свои глаза (без модели)':cfg.model.replace(/^gpt:\/\/[^/]+\//,'').replace(/\/latest$/,'')+(OR?'':' (Yandex)'))+(STR.length>1?', '+strat:'');
      const T={name,strat,sheets:0,sheetNames:S.map(s=>s.name),found:0,total:0,swap:0,err:[],dr:0,drT:0,ms:0,msModel:0,calls:0,cost:0,tok:0,fails:0,read:0,ok:0,bdr:0,false:0,caught:0,errs:0,partOk:0,partWrong:0,partNone:0,partBuilt:0,partWhy:[],falseWhy:[],scales:{}};
      console.log('\n══ '+name);
      for(const sh of S){ T.errs+=sh.groups.filter(g=>g.built!==false&&g.err).length;
        let res; try{ res=await STRATS[strat](cfg,sh); }catch(e){ T.fails++; console.log('  '+sh.name+': СБОЙ '+e.message.slice(0,200)); continue; }
        T.sheets++; const st=score(sh,res), b=await brain(sh,res), ps=partScore(sh,res.model||(b&&b.bparts)||[]);
        T.found+=st.found; T.total+=st.total; T.swap+=st.swap; T.err.push(...st.err); T.dr+=Math.min(st.drawingsFound,sh.want||4); T.drT+=sh.want||sh.groups.length;
        T.ms+=res.ms; T.msModel+=res.msModel||(res.calls?res.ms:0); T.calls+=res.calls; T.cost+=res.cost||0; T.tok+=res.tok||0; if(res.scale) T.scales[res.scale]=(T.scales[res.scale]||0)+1;
        T.partOk+=ps.ok; T.partWrong+=ps.wrong; T.partNone+=ps.none; T.partBuilt+=ps.built; ps.why.forEach(w=>T.partWhy.push(sh.name.replace(/ \(.*/,'')+': '+w));
        if(b&&!b.err){ T.read+=b.read; T.ok+=b.ok; T.bdr+=res.drawings.length; T.false+=b.false; T.caught+=b.caught; b.falseWhy.forEach(w=>T.falseWhy.push(sh.name+': '+w)); }
        raw.push({model:name,sheet:sh.name,scale:res.scale||null,text:res.text||null,model_drawings:res.model||null,err:res.err||null,brain:b&&{verdicts:b.verdicts,read:b.read,ok:b.ok,false:b.false,caught:b.caught}});
        console.log('  '+sh.name.replace(/ \(.*/,'').padEnd(10)+' чертежей '+st.drawingsFound+'/'+sh.groups.length+', часть '+ps.ok+'/'+ps.built+(ps.wrong?' (неверно '+ps.wrong+')':'')+(res.scale?', шкала '+res.scale:'')+', '+sec(res.ms)+(res.cost?', '+usd(res.cost):'')
          +(b?b.err?' | мозг: сбой '+b.err:' | мозг: прочитано '+b.read+', «верно» '+b.ok+', ошибка найдена '+b.caught+', ЛОЖНЫХ '+b.false:'')+(res.err?' | '+String(res.err).slice(0,120):'')); }
      delete T.err; rows.push(T); console.log('ИТОГО '+row(T)); T.falseWhy.forEach(w=>console.log('  ЛОЖНО: '+w)); } }
  fs.writeFileSync(A.out||'eyes-eval.json',JSON.stringify({rows,raw},null,1));
  if(!A.out||A.summary==='1'){ const f=(A.out||'eyes-eval.json'); table([f]); } })().catch(e=>{ console.error(e); process.exit(1); });
