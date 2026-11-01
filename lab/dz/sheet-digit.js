/* ═══════════ Лист целиком → цифровая копия: раскладка → резка → оцифровка каждого чертежа → притяжка к карандашу ═══════════
   NODE_USE_ENV_PROXY=1 node lab/dz/sheet-digit.js фото.jpg --dir=папка_вне_git [--layout-model=…] [--digit-model=…] [--limit=0.25] [--replay=1]
   Шаги и цены — PLAN-digit.md. Нужен python3 + Pillow (lab/dz/tools/crop.py — лабораторная резка JPEG).
   Результат: <dir>/<имя>.sheet.json — отрезки и точки в координатах ИСХОДНОГО фото:
     {drawings:[{part, box, rot, pts:[[подпись,x,y]], segs:[{p:[x1,y1,x2,y2], src:'model'|'found', unverified, dash}], stats}], cost}
   --replay=1: ответы моделей берутся из <dir>/<имя>.*.txt (без запросов, бесплатно) — для настройки притяжки.
   Фото никуда не копируется, кроме <dir> (локально); моделям уходят только кадры чертежей. */
const IMG=require('../img.js'), EY=require('./eyes.js'), V=require('../../core/dz-variants.js'), fs=require('fs'), path=require('path'), cp=require('child_process'), SE=require('../../server/lib/eyes.js'), RF=require('./refine.js'), LY=require('./layout.js');
const A=Object.fromEntries(process.argv.slice(3).map(s=>s.replace(/^--/,'').split('='))), photo=process.argv[2], DIR=A.dir, NAME=path.basename(photo).replace(/\.[^.]+$/,'');
if(!photo||!DIR){ console.error('нужны: фото и --dir=папка'); process.exit(2); }
fs.mkdirSync(DIR,{recursive:true});
const LM=A['layout-model']||'anthropic/claude-haiku-5-5', DM=A['digit-model']||'anthropic/claude-sonnet-5-5', LIMIT=+(A.limit||0.25), REPLAY=A.replay==='1';
const PY=['python3',path.join(__dirname,'tools','crop.py')], py=args=>JSON.parse(cp.execFileSync(PY[0],PY.slice(1).concat(args),{encoding:'utf8'}));
/* цена по токенам: Sonnet $3/$15, Haiku $1/$5 за млн (оценка сверху; ProxyAPI считает в рублях) */
const PRICE=m=>/haiku/.test(m)?[1e-6,5e-6]:[3e-6,15e-6]; let spent=0, calls=0;
const cfg=m=>SE.eyesFromEnv({EYES_URL:SE.PX_URL,EYES_MODEL:m,PROXYAPI_KEY:'x',EYES_BEST_MODEL:'off',EYES_DIGIT_MODEL:'off'});
async function ask(model,system,text,jpg,tokens,tag){ const f=path.join(DIR,NAME+'.'+tag+'.txt');
  if(REPLAY) return fs.readFileSync(f,'utf8');
  if(spent>LIMIT) throw new Error('предел $'+LIMIT+' исчерпан');
  const img='data:image/jpeg;base64,'+fs.readFileSync(jpg).toString('base64'), r=await SE.ask(cfg(model),{image:img,w:0,h:0,system,text,opts:Object.assign({max_tokens:tokens},A.effort==='off'?{}:{reasoning_effort:A.effort||'low'})},{timeout:200000});
  const u=r.info.usage||{}, pr=PRICE(model), c=(u.prompt_tokens||0)*pr[0]+(u.completion_tokens||0)*pr[1]; spent+=c; calls++;
  console.log('  '+tag+': '+model.split('/')[1]+', токенов '+(u.prompt_tokens||'?')+' → '+(u.completion_tokens||'?')+', ≈ $'+c.toFixed(4)); fs.writeFileSync(f,r.text); return r.text; }
/* привязка точек модели к условию: variant — номер или auto (перебор вариантов 1–30 заданий dz); лучший — больше согласных точек, при равенстве — меньше невязка */
function fitVariant(text,variant,dz){ const dr=EY.parseDigit(text,1).drawings[0]; if(!dr) return null; let best=null;
  const dzs=dz?[+dz]:[2,3], ns=variant==='auto'?Array.from({length:30},(_,i)=>i+1):[+variant];
  dzs.forEach(d=>ns.forEach(n=>{ const gv=V.get(d,n); if(!gv) return; const PP=EY.pairs(dr,gv.id,gv.data), b=PP.length>=4?EY.bindAffine(PP,{tol:3}):null; if(!b||b.inl.length<4) return;
    const r={dz:d,n,inl:b.inl.length,of:PP.length,rmsMm:b.rms/b.s,ppm:b.s,A:b.A,out:(b.out||[]).map(q=>q.l)};
    /* перспектива снимка: гомография по согласным точкам условия (как prepareDigit); без неё оси наклонены. Допуск 1,5 мм, нужно ≥ 4 точек */
    try{ const hb=EY.bindHom(PP,1.5*b.s); if(hb&&hb.inl.length>=4){ r.M=hb.M; r.hom={inl:hb.inl.length,rmsMm:hb.rms/b.s}; } }catch(e){} if(!best||r.inl>best.inl||(r.inl===best.inl&&r.rmsMm<best.rmsMm)) best=r; }));
  return best||{inl:0,of:0,rmsMm:null}; }

/* чистая цифровая копия: SVG без фото. Единицы — мм (если привязка к условию сошлась), иначе px чертежа в исходном фото */
function svgOf(out){ const items=out.drawings.filter(d=>d.segs).map(d=>{ const mm=d.mm&&d.mm.segs.length?d.mm:null; return {d,segs:mm?mm.segs:d.segs,pts:mm?mm.pts:d.pts,mm:!!mm}; });
  if(!items.length) return null; const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  items.forEach(it=>{ let a=1e9,b=1e9,c=-1e9,e=-1e9; it.segs.forEach(q=>{ [[q.p[0],q.p[1]],[q.p[2],q.p[3]]].forEach(([x,y])=>{ a=Math.min(a,x); b=Math.min(b,y); c=Math.max(c,x); e=Math.max(e,y); }); }); it.box=[a,b,c,e]; it.sc=it.mm?1:0.25; it.w=(c-a)*it.sc+20; it.h=(e-b)*it.sc+20; });
  const cols=items.length>1?2:1, colW=[], rowH=[]; items.forEach((it,i)=>{ const c=i%cols, r=Math.floor(i/cols); colW[c]=Math.max(colW[c]||0,it.w); rowH[r]=Math.max(rowH[r]||0,it.h+8); });
  const xs=[0], ys=[0]; colW.forEach((w,c)=>xs[c+1]=xs[c]+w); rowH.forEach((h,r)=>ys[r+1]=ys[r]+h);
  const g=items.map((it,i)=>{ const c=i%cols, r=Math.floor(i/cols), [a,b]=it.box, dx=xs[c]+10-a*it.sc, dy=ys[r]+16-b*it.sc, T=(x,y)=>[(x*it.sc+dx).toFixed(2),(y*it.sc+dy).toFixed(2)];
    const lines=it.segs.map(q=>{ const p1=T(q.p[0],q.p[1]), p2=T(q.p[2],q.p[3]), col=q.src==='found'?'#8aa4c8':q.unverified?'#e07b00':'#111', w=q.src==='found'?0.25:q.unverified?0.3:0.45, dash=q.dash?'1.6 1':(q.unverified?'2 1':'');
      return '<line x1="'+p1[0]+'" y1="'+p1[1]+'" x2="'+p2[0]+'" y2="'+p2[1]+'" stroke="'+col+'" stroke-width="'+w+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+' stroke-linecap="round"/>'; });
    const dots=it.pts.map(q=>{ const p=T(q[1],q[2]); return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="0.7" fill="#c0005a"/><text x="'+(+p[0]+1.1)+'" y="'+(+p[1]-1.1)+'" font-size="3" font-family="sans-serif" fill="#c0005a">'+esc(q[0])+'</text>'; });
    const f=it.d.fit, cap='чертёж '+(i+1)+(it.d.part?' · часть '+it.d.part:'')+(it.mm?' · мм':' · px×0,25')+(f&&f.rmsMm!=null?' · ДЗ №'+f.dz+' в.'+f.n+' · невязка '+(f.hom?f.hom.rmsMm:f.rmsMm).toFixed(2)+' мм'+(f.hom?' (перспектива учтена)':''):'');
    return '<g><text x="'+(xs[c]+10)+'" y="'+(ys[r]+8)+'" font-size="3.4" font-family="sans-serif" fill="#555">'+esc(cap)+'</text>'+lines.join('')+dots.join('')+'</g>'; });
  const W=xs[xs.length-1], H=ys[ys.length-1];
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W.toFixed(1)+' '+H.toFixed(1)+'" width="'+Math.round(W*4)+'" height="'+Math.round(H*4)+'"><rect width="100%" height="100%" fill="#fff"/>'+g.join('')+'</svg>'; }
const mapPt=(Am,u,v)=>[Am[0]*u+Am[1]*v+Am[2],Am[3]*u+Am[4]*v+Am[5]];
function readPGM(f){ const b=fs.readFileSync(f); let i=0, tok=[]; while(tok.length<4){ while(/\s/.test(String.fromCharCode(b[i]))) i++; let s=''; while(!/\s/.test(String.fromCharCode(b[i]))) s+=String.fromCharCode(b[i++]); tok.push(s); } i++;
  const w=+tok[1], h=+tok[2], a=new Float32Array(w*h); for(let k=0;k<w*h;k++) a[k]=b[i+k]; return {w,h,a}; }

(async()=>{ console.log('лист '+NAME+(REPLAY?' (повтор ответов, без запросов)':''));
  /* шаг 1: раскладка */
  const sm=path.join(DIR,NAME+'.small.jpg'), meta=py(['small',photo,sm,'--side=800']);
  let lay; try{ lay=LY.parseLayout(await ask(LM,LY.LAYOUT_PROMPT,'Размер фото: '+meta.w+' × '+meta.h+' px.',sm,2000,'layout'),meta.k,meta.W,meta.H); }catch(e){ lay={ok:false,why:e.message,rot:0,drawings:[]}; }
  if(!lay.ok){ console.log('  раскладка не помогла ('+lay.why+') — лист как один чертёж'); lay={ok:true,rot:0,drawings:[{box:[0,0,meta.W,meta.H],part:null}]}; }
  console.log('  чертежей: '+lay.drawings.length+', поворот '+lay.rot+'°, части: '+lay.drawings.map(d=>d.part==null?'?':d.part).join(','));
  if(A.stop==='layout'){ console.log('  (остановка после раскладки)'); console.log('  итого запросов '+calls+', ≈ $'+spent.toFixed(4)); return; }
  const out={name:NAME,size:[meta.W,meta.H],layout:{rot:lay.rot,n:lay.drawings.length},drawings:[]};
  for(let i=0;i<lay.drawings.length;i++){ const d=lay.drawings[i], tag='d'+(i+1), base=path.join(DIR,NAME+'.'+tag);
    const cut=py(['cut',photo,base,'box='+d.box.map(Math.round).join(','),'rot='+lay.rot,'pad='+(A.pad||40),'side=1200']), g=readPGM(base+'.pgm');
    let text; try{ text=await ask(DM,LY.DIGIT_PROMPT,'Размер фото: '+cut.w+' × '+cut.h+' px.',base+'.jpg',2500,tag); }catch(e){ console.log('  '+tag+': '+e.message); out.drawings.push({part:d.part,box:d.box,error:e.message}); continue; }
    /* привязка точек модели к условию варианта: настоящий px/мм и невязка в мм (автоматическая метрика точности, без ручного эталона) */
    let fit=null; if(A.variant){ try{ fit=fitVariant(text,A.variant,A.dz); }catch(e){ fit={error:e.message}; } }
    const P=LY.parseDigit(text), ppm=Math.max(2,Math.min(meta.W,meta.H)/210*cut.k); /* px/мм вырезки ≈ короткая сторона фото / 210 мм × уменьшение вырезки (грубо; нужно притяжке только для размера окна поиска) */
    const rg=P.pts.length>=4?[Math.min(...P.pts.map(q=>q[1])),Math.min(...P.pts.map(q=>q[2])),Math.max(...P.pts.map(q=>q[1])),Math.max(...P.pts.map(q=>q[2]))]:null;
    const rf=RF.refine(g,P.segs,{ppm:fit&&fit.ppm?fit.ppm:ppm,findCap:A.cap?+A.cap:0.35,region:rg,points:P.pts.map(q=>[q[1],q[2]])});
    const Am=cut.A;
    /* копия в мм условия (u вправо, v вниз — как сцены сайта): обратная аффинная привязка «мм → px чертежа» */
    let toMm=null; if(fit&&fit.M){ const Mi=IMG.H.inv(fit.M); toMm=(x,y)=>IMG.H.apply(Mi,[x,y]); }
    else if(fit&&fit.A){ const a=fit.A, det=a[0]*a[4]-a[1]*a[3]; if(Math.abs(det)>1e-9) toMm=(x,y)=>{ const X=x-a[2], Y=y-a[5]; return [(a[4]*X-a[1]*Y)/det,(-a[3]*X+a[0]*Y)/det]; }; }
    const mmCopy=toMm?{pts:P.pts.map(q=>[q[0]].concat(toMm(q[1],q[2]).map(v=>+v.toFixed(2)))),segs:rf.segs.map(q=>({p:toMm(q.p[0],q.p[1]).concat(toMm(q.p[2],q.p[3])).map(v=>+v.toFixed(2)),src:q.src,unverified:!!q.unverified,dash:!!q.dash}))}:null;
    out.drawings.push({part:d.part,box:d.box,rot:lay.rot,mm:mmCopy,cut:{w:cut.w,h:cut.h,ppm},
      pts:P.pts.map(q=>[q[0]].concat(mapPt(Am,q[1],q[2]))),
      segs:rf.segs.map(q=>({p:mapPt(Am,q.p[0],q.p[1]).concat(mapPt(Am,q.p[2],q.p[3])),src:q.src,unverified:!!q.unverified,dash:!!q.dash})),
      txt:P.txt.map(q=>mapPt(Am,q[0],q[1]).concat(q[2])),
      fit,stats:Object.assign({model:P.segs.length,bad:P.bad,pts:P.pts.length},rf.stats)});
    const s=out.drawings[out.drawings.length-1].stats;
    console.log('  '+tag+' (часть '+(d.part==null?'?':d.part)+'): точек '+s.pts+', модель '+s.model+' отрезков → оставлено '+s.kept+' (не подтверждено '+s.unverified+'), отброшено '+s.dropped+', найдено сверх модели '+s.found+', фото надёжное '+s.reliable+(f=>f?(f.rmsMm!=null?' | привязка к условию (ДЗ №'+f.dz+', вариант '+f.n+'): точек '+f.inl+' из '+f.of+', невязка '+f.rmsMm.toFixed(2)+' мм, '+f.ppm.toFixed(1)+' px/мм':' | привязка к условию: не сошлась ('+f.inl+' из '+f.of+')'):'')(out.drawings[out.drawings.length-1].fit)); }
  { const sv=svgOf(out); if(sv) fs.writeFileSync(path.join(DIR,NAME+'.svg'),sv); }
  out.cost=+spent.toFixed(4); out.calls=calls; fs.writeFileSync(path.join(DIR,NAME+'.sheet.json'),JSON.stringify(out));
  console.log('  итого запросов '+calls+', ≈ $'+spent.toFixed(4)); })().catch(e=>{ console.error('СБОЙ: '+e.message); process.exit(1); });
