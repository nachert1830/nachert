/* ═══════════ Может ли большая модель сама оцифровать чертёж: точки и отрезки против правды ═══════════
   node lab/dz/digit-eval.js [--models=google/gemini-3-flash-preview,anthropic/claude-opus-5.5,…] [--views=0,3] [--limit=0.095]
   node lab/dz/digit-eval.js --n=9 --seed=12 --err=a_dir — лист с ошибкой студента в части 1 (ось x₁₄ не ⟂ h′): рисует ли модель
     то, что начерчено, а не «как надо» — мера против правильного построения того же чертежа («как надо», точность в 1 мм)
   node lab/dz/digit-eval.js --dry=1 — без модели: «ответ» — правда с шумом (проверка разбора и мер, бесплатно)
   Лист — синтетический ДЗ №3 (quadsynth.js, вариант 21), снимок вблизи одного чертежа (как просит камера, 12–15 px/мм),
   модели уходит длинной стороной 1568 px (≈ 7,5 px/мм). Просьба: каждую подписанную точку (подпись и x y) и каждый
   прямой отрезок (x1 y1 x2 y2) в px фото. Правда — построение quadsynth (отрезки, линии связи, оси, точки с подписями).
   Меры (в мм листа):
     точки — найдено подписей, промах (медиана, ≤ 1 мм, ≤ 2 мм), перепутано (ближе к другой точке чертежа);
     отрезки — полнота: какая доля длины правды лежит в T мм от отрезка модели того же направления (± 8°), T = 1 и 3 мм;
               точность: какая доля длины ответа модели лежит в T мм от правды; отрезков правды найдено целиком (≥ 90 % в 3 мм).
   Шкала ответа: px просили, но на всякий случай пробуются px, 0…1000 [x, y] и 0…1000 [y, x] — берётся лучшая (в пользу модели).
   Деньги: OpenRouter (OPENROUTER_API_KEY), предел --limit $ на весь прогон — max_tokens каждого запроса урезается так,
   чтобы даже худший случай не вышел за предел; не помещается — запрос пропускается. Прогон — .github/workflows/digit-eval.yml */
const IMG=require('../img.js'), fs=require('fs'), zlib=require('zlib'), Q=require('./quadsynth.js'), SE=require('../../server/lib/eyes.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), DRY=A.dry==='1', LIMIT=+(A.limit||0.095), SIDE=1568;
const N=+(A.n||21), SEED=+(A.seed||13), ERR=A.err||undefined;
const MODELS=(A.models||'google/gemini-3-flash-preview,anthropic/claude-opus-5.5,google/gemini-3.1-pro-preview,anthropic/claude-sonnet-5.5').split(','), VIEWS=(A.views||'0').split(',').map(Number);
const med=a=>{ const t=a.slice().sort((x,y)=>x-y); return t.length?t[t.length>>1]:NaN; }, pc=(a,b)=>b?Math.round(100*a/b)+' %':'—', f1=x=>isFinite(x)?x.toFixed(1).replace('.',','):'—';

const SYSTEM='Ты — оцифровщик чертежей. На фото — один карандашный чертёж по начертательной геометрии (эпюр Монжа: проекции пирамиды, '+
  'оси, линии связи, построения). Координаты — в пикселях ЭТОГО фото: начало — левый верхний угол, x вправо, y вниз, целые числа.\n'+
  'Выпиши построчно, без пояснений и без markdown:\n'+
  'P <подпись> <x> <y> — каждая подписанная точка: подпись как на чертеже (A″, B′, S₄, K₄ …) и где сама точка (не текст подписи);\n'+
  'S <x1> <y1> <x2> <y2> — каждый прямой отрезок чертежа от конца до конца: рёбра, штриховые линии, тонкие линии связи, оси X, Z, Y, '+
  'линии построения. Отрезок, который прерывается точкой, можно дать одним отрезком. Рамку листа и чужие чертежи у края фото не пиши.';

/* снимок → RGBA длинной стороной до SIDE (среднее по клетке) */
function resize(im,side){ const k=Math.min(1,side/Math.max(im.width,im.height)), w=Math.round(im.width*k), h=Math.round(im.height*k), o=IMG.rgba(w,h), d=im.data;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const X0=Math.floor(x/k), Y0=Math.floor(y/k), X1=Math.max(X0+1,Math.floor((x+1)/k)), Y1=Math.max(Y0+1,Math.floor((y+1)/k)); let r=0,g=0,b=0,n=0;
    for(let yy=Y0;yy<Y1&&yy<im.height;yy++) for(let xx=X0;xx<X1&&xx<im.width;xx++){ const i=(yy*im.width+xx)*4; r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; }
    const i=(y*w+x)*4; o.data[i]=r/n; o.data[i+1]=g/n; o.data[i+2]=b/n; o.data[i+3]=255; }
  return {im:o,k}; }

/* серое PNG (фильтр up): втрое легче цветного, модели цвет не нужен */
function grayPNG(im){ const w=im.width, h=im.height, d=im.data, g=Buffer.alloc((w+1)*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=(y*w+x)*4; g[y*(w+1)+1+x]=Math.round(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]); }
  for(let y=h-1;y>=0;y--){ g[y*(w+1)]=y?2:0; if(y) for(let x=0;x<w;x++) g[y*(w+1)+1+x]=(g[y*(w+1)+1+x]-g[(y-1)*(w+1)+1+x])&255; }
  const crcT=new Uint32Array(256).map((_,n)=>{ let c=n; for(let j=0;j<8;j++) c=c&1?0xEDB88320^(c>>>1):c>>>1; return c>>>0; }), crc=b=>{ let c=0xFFFFFFFF; for(const x of b) c=crcT[(c^x)&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
  const chunk=(t,dd)=>{ const l=Buffer.alloc(4); l.writeUInt32BE(dd.length); const td=Buffer.concat([Buffer.from(t),dd]), c=Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l,td,c]); };
  const ih=Buffer.alloc(13); ih.writeUInt32BE(w,0); ih.writeUInt32BE(h,4); ih[8]=8; ih[9]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(g,{level:9})),chunk('IEND',Buffer.alloc(0))]); }

/* правда чертежа в мм листа: отрезки (рёбра, построение, линии связи, оси) и точки с подписями */
function truthOf(s,i,items){ const g=s.truth.parts[i], O=g.O, P=p=>[O[0]+p[0],O[1]+p[1]], G=s.truth.groups[i];
  const segs=(items||g.items).filter(it=>(it.t==='seg'||it.t==='line'||it.t==='conn')&&it.a&&it.b).map(it=>[P(it.a),P(it.b)]).concat([G.axis],G.zLine?[G.zLine]:[]).filter(([a,b])=>Math.hypot(b[0]-a[0],b[1]-a[1])>=3);
  const pts={}; (items||g.items).forEach(it=>{ if(it.t==='pt'&&it.l) pts[it.l]=P(it.at); });
  return {segs,pts,box:[g.box[0]-6,g.box[1]-6,g.box[2]+6,g.box[3]+6],part:g.part}; }

/* подпись → вид для сравнения: A″ = A'' = A" → A2, A′ = A' → A1, S₄ = S4 */
const SUB='₀₁₂₃₄₅₆₇₈₉';
function norm(l){ let s=String(l).trim().replace(/[₀-₉]/g,c=>SUB.indexOf(c)).replace(/[″"]|''|′′|’’/g,'^2').replace(/[′'’`]/g,'^1').replace(/_/g,'').toUpperCase();
  return s.replace(/\^2/g,'"').replace(/\^1/g,"'"); }

/* ответ модели → {pts:[[подпись,x,y]], segs:[[x1,y1,x2,y2]]} */
function parse(text){ const pts=[], segs=[], num='(-?\\d+(?:[.,]\\d+)?)';
  String(text||'').split(/\r?\n/).forEach(line=>{ const L=line.replace(/[*`|]/g,' ').replace(/[(),;:]/g,' ').trim();
    let m=L.match(new RegExp('^P\\s+(\\S+)\\s+'+num+'\\s+'+num)); if(m){ pts.push([m[1],+m[2].replace(',','.'),+m[3].replace(',','.')]); return; }
    m=L.match(new RegExp('^S\\s+'+num+'\\s+'+num+'\\s+'+num+'\\s+'+num)); if(m) segs.push([1,2,3,4].map(j=>+m[j].replace(',','.'))); });
  return {pts,segs}; }

/* мера: отрезки и точки ответа (px картинки модели) против правды (мм листа) */
const dist=(p,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy, t=L?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L)):0; return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); };
const ang=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]), dAng=(s,t)=>{ let d=Math.abs(ang(s[0],s[1])-ang(t[0],t[1]))%Math.PI; return Math.min(d,Math.PI-d)*180/Math.PI; };
function sample(s,step){ const L=Math.hypot(s[1][0]-s[0][0],s[1][1]-s[0][1]), n=Math.max(1,Math.ceil(L/step)), out=[];
  for(let i=0;i<=n;i++){ const t=i/n; out.push([s[0][0]+t*(s[1][0]-s[0][0]),s[0][1]+t*(s[1][1]-s[0][1])]); } return {out,L}; }
/* доля длины отрезков X, лежащая в T мм от какого-то отрезка Y того же направления (± 8°) */
function cover(X,Y,T){ let got=0, all=0; const whole=[];
  X.forEach(s=>{ const {out,L}=sample(s,0.5), Ys=Y.filter(t=>dAng(s,t)<=8); let k=0; out.forEach(p=>{ if(Ys.some(t=>dist(p,t[0],t[1])<=T)) k++; }); const f=k/out.length; got+=f*L; all+=L; whole.push(f); });
  return {f:all?got/all:0,whole}; }
function measure(tr,ans,toMM){ const inBox=p=>p[0]>=tr.box[0]&&p[0]<=tr.box[2]&&p[1]>=tr.box[1]&&p[1]<=tr.box[3];
  const msegs=ans.segs.map(s=>[toMM([s[0],s[1]]),toMM([s[2],s[3]])]).filter(s=>inBox([(s[0][0]+s[1][0])/2,(s[0][1]+s[1][1])/2])&&Math.hypot(s[1][0]-s[0][0],s[1][1]-s[0][1])>=1);
  /* ошибка студента: отрезки, которых нет в правильном построении, — нашла ли их модель; и сколько ответа легло на «как надо» */
  const errC=tr.errSegs&&tr.errSegs.length?cover(tr.errSegs,msegs,1).f:null, okP=tr.okSegs?cover(msegs,tr.okSegs,1).f:null;
  const r1=cover(tr.segs,msegs,1), r3=cover(tr.segs,msegs,3), p1=cover(msegs,tr.segs,1), p3=cover(msegs,tr.segs,3);
  const T=Object.entries(tr.pts), byN=new Map(T.map(([l,p])=>[norm(l),[l,p]])), err=[]; let found=0, swap=0, unknown=0; const seen=new Set();
  ans.pts.forEach(([l,x,y])=>{ const n=norm(l), t=byN.get(n); if(!t||seen.has(n)){ unknown++; return; } seen.add(n); const m=toMM([x,y]), e=Math.hypot(m[0]-t[1][0],m[1]-t[1][1]);
    if(T.some(([l2,q])=>l2!==t[0]&&Math.hypot(m[0]-q[0],m[1]-q[1])+3<e)) swap++; else { found++; err.push(e); } });
  return {nSeg:tr.segs.length,nAns:msegs.length,rec1:r1.f,rec3:r3.f,prec1:p1.f,prec3:p3.f,whole:r3.whole.filter(f=>f>=0.9).length,
    errC,okP,nPts:T.length,found,swap,unknown,med:med(err),le1:err.filter(e=>e<=1).length,le2:err.filter(e=>e<=2).length}; }

/* шкала ответа: px просили; 0…1000 — пробуем тоже, берём лучшую по точности отрезков в 3 мм */
function bestScale(tr,ans,pic,toMMpx){ const S={px:p=>p,'n1000 xy':p=>[p[0]*pic.w/1000,p[1]*pic.h/1000],'n1000 yx':p=>[p[1]*pic.w/1000,p[0]*pic.h/1000]}; let best=null;
  Object.entries(S).forEach(([name,f])=>{ const m=measure(tr,ans,p=>toMMpx(f(p))), sc=m.prec3+m.rec3+m.le2/Math.max(1,m.nPts); if(!best||sc>best.sc) best={name,m,sc}; }); return best; }

/* цена: OpenRouter, точное имя из списка моделей */
async function priceOf(id){ const j=await (await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(30000)})).json(), all=j.data||[];
  const m=all.find(x=>x.id===id)||all.find(x=>x.id.startsWith(id)); if(!m) return null; const P=m.pricing||{};
  return {id:m.id,prompt:+P.prompt||0,completion:+P.completion||0,image:+P.image||0,internal:+P.internal_reasoning||0}; }

(async()=>{ console.log('лист строю… (ДЗ №3 в'+N+(ERR?', ошибка '+ERR:'')+', снимки вблизи)'); const s=Q.sheet({n:N,seed:SEED,err:ERR,closeup:8}), s0=ERR?Q.sheet({n:N,seed:SEED,closeup:8}):null;
  const pics=VIEWS.map(vi=>{ const v=s.views[vi], r=resize(v.img,SIDE), png=grayPNG(r.im), Hi=IMG.H.inv(v.H), tr=truthOf(s,vi);
    /* правильное построение того же чертежа (лист без ошибки, его отрезки — на место этого чертежа): что отличается — ошибка */
    if(s0&&s.truth.parts[vi].err){ const ok=truthOf(s,vi,s0.truth.parts[vi].items), key=q=>q.map(p=>p.map(v=>v.toFixed(2)).join(',')).join(';'), okK=new Set(ok.segs.map(key));
      tr.okSegs=ok.segs; tr.errSegs=tr.segs.filter(q=>!okK.has(key(q))); }
    if(A.dump) fs.writeFileSync(A.dump+'-'+vi+'.png',png);
    const P=q=>IMG.H.apply(v.H,q), a=P([tr.box[0],tr.box[1]]), b=P([tr.box[0]+1,tr.box[1]]), ppm=Math.hypot(b[0]-a[0],b[1]-a[1])*r.k;
    return {vi,part:tr.part,tr,w:r.im.width,h:r.im.height,k:r.k,ppm,url:'data:image/png;base64,'+png.toString('base64'),kb:png.length/1024,toMM:p=>IMG.H.apply(Hi,[p[0]/r.k,p[1]/r.k]),toPx:q=>{ const p=IMG.H.apply(v.H,q); return [p[0]*r.k,p[1]*r.k]; }}; });
  pics.forEach(p=>console.log('снимок '+p.vi+' (часть '+('abcd'.indexOf(p.part)+1)+'): '+p.w+' × '+p.h+' px, '+f1(p.ppm)+' px/мм, '+Math.round(p.kb)+' КБ; правда: отрезков '+p.tr.segs.length+', точек '+Object.keys(p.tr.pts).length));
  const PX=(A.provider||'proxyapi')==='proxyapi', key=PX?(process.env.PROXYAPI_KEY||'proxy-injected'):process.env.OPENROUTER_API_KEY||''; if(!DRY&&!key){ console.log('нет OPENROUTER_API_KEY'); process.exit(1); }
  let spent=0; const rows=[], raw=[];
  for(const p of pics) for(const name of DRY?['правда с шумом']:MODELS){
    let text, cost=0, ms=0, info=null, model=name;
    if(DRY){ const R=IMG.rng(7), n=()=>(R()-0.5)*6; text=Object.entries(p.tr.pts).map(([l,q])=>{ const x=p.toPx(q); return 'P '+l+' '+Math.round(x[0]+n())+' '+Math.round(x[1]+n()); })
        .concat(p.tr.segs.slice(2).map(([a,b])=>{ const x=p.toPx(a), y=p.toPx(b); return 'S '+[x[0],x[1],y[0],y[1]].map(v=>Math.round(v+n())).join(' '); })).join('\n'); }
    else { const pr=PX?{id:SE.pxModel(name),prompt:3e-6,completion:15e-6,image:0,internal:0}:await priceOf(name); if(!pr){ console.log('\n══ '+name+': нет в списке OpenRouter'); continue; } model=pr.id;
      /* худший случай: вход (картинка ≈ w·h/750 токенов + текст, с запасом ×1,5) + max_tokens ответа (и рассуждения) */
      console.log('цена '+model+': $'+(pr.prompt*1e6).toFixed(2)+' / $'+(pr.completion*1e6).toFixed(2)+' за 1 млн');
      const inCost=(p.w*p.h/750+1000)*pr.prompt+pr.image, outP=Math.max(pr.completion,pr.internal), cap=/gemini|gpt-5/.test(model)?6000:2000, minTok=/gemini|gpt-5/.test(model)?1500:900;
      const maxTok=Math.min(cap,Math.floor((LIMIT-spent-inCost)/outP));
      if(maxTok<minTok){ console.log('\n══ '+model+', снимок '+p.vi+': пропущено — не помещается в $'+LIMIT+' (потрачено $'+spent.toFixed(4)+')'); continue; }
      const cfg=PX?SE.eyesFromEnv({EYES_URL:SE.PX_URL,EYES_MODEL:model,PROXYAPI_KEY:key,EYES_BEST_MODEL:'off',EYES_DIGIT_MODEL:'off'}):SE.eyesFromEnv({EYES_URL:SE.OR_URL,EYES_MODEL:model,OPENROUTER_API_KEY:key,EYES_BEST_MODEL:'off'}), t0=Date.now();
      try{ const r=await SE.ask(cfg,{image:p.url,w:p.w,h:p.h,system:SYSTEM,text:'Размер фото: '+p.w+' × '+p.h+' px.',opts:{max_tokens:maxTok}},{timeout:240000});
        text=r.text; info=r.info; const u=info&&info.usage; cost=u&&u.cost!=null?+u.cost:u?(u.prompt_tokens||0)*pr.prompt+(u.completion_tokens||0)*outP:inCost+maxTok*outP; }
      catch(e){ text=''; info={error:e.message}; cost=e.info&&e.info.usage&&e.info.usage.cost!=null?+e.info.usage.cost:inCost+maxTok*outP; console.log('СБОЙ '+model+': '+e.message.slice(0,300)); }
      ms=Date.now()-t0; spent+=cost; }
    const ans=parse(text), b=bestScale(p.tr,ans,p,p.toMM), m=b.m;
    rows.push({model,view:p.vi,part:p.part,scale:b.name,ms,cost,tok:info&&info.usage?{in:info.usage.prompt_tokens,out:info.usage.completion_tokens}:null,finish:info&&info.finish,lines:{P:ans.pts.length,S:ans.segs.length},m});
    raw.push({model,view:p.vi,text});
    console.log('\n══ '+model+', снимок '+p.vi+(rows[rows.length-1].tok?', токенов '+JSON.stringify(rows[rows.length-1].tok):'')+(ms?', '+(ms/1000).toFixed(1)+' с':'')+(cost?', $'+cost.toFixed(4):'')+(info&&info.finish?', finish '+info.finish:'')+', шкала '+b.name);
    console.log('  точки: подписей '+m.found+' из '+m.nPts+' (перепутано '+m.swap+', лишних '+m.unknown+'), промах медиана '+f1(m.med)+' мм, ≤ 1 мм — '+m.le1+', ≤ 2 мм — '+m.le2);
    if(m.errC!=null) console.log('  ошибка студента: её отрезков ('+p.tr.errSegs.length+') найдено в 1 мм — '+pc(m.errC,1)+'; ответа на месте «как надо» (в 1 мм) — '+pc(m.okP,1)+' (на верных отрезках совпадает и так)');
    console.log('  отрезки: правды '+m.nSeg+', у модели '+m.nAns+'; полнота '+pc(m.rec1,1)+' (1 мм) / '+pc(m.rec3,1)+' (3 мм); точность '+pc(m.prec1,1)+' / '+pc(m.prec3,1)+'; целиком найдено '+m.whole+' из '+m.nSeg);
    console.log('----- ответ '+model+' (снимок '+p.vi+') -----\n'+text+'\n----- конец -----'); }
  console.log('\nпотрачено всего: $'+spent.toFixed(4)+' (предел $'+LIMIT+')');
  const md=['## Оцифровка чертежа большой моделью (ДЗ №3 в'+N+(ERR?', ошибка '+ERR:'')+', снимок вблизи)','','| модель | снимок | точки: найдено | промах, медиана | ≤ 1 мм | ≤ 2 мм | отрезки: полнота 1 мм / 3 мм | точность 1 мм / 3 мм | целиком | время | цена |','|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(r=>'| '+r.model+' | '+r.view+' | '+r.m.found+' из '+r.m.nPts+(r.m.swap?' (перепутано '+r.m.swap+')':'')+' | '+f1(r.m.med)+' мм | '+r.m.le1+' | '+r.m.le2+' | '+pc(r.m.rec1,1)+' / '+pc(r.m.rec3,1)+' | '+pc(r.m.prec1,1)+' / '+pc(r.m.prec3,1)+' | '+r.m.whole+' из '+r.m.nSeg+' | '+(r.ms/1000).toFixed(1)+' с | $'+r.cost.toFixed(4)+' |'),'','потрачено: $'+spent.toFixed(4)];
  if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md.join('\n')+'\n'); console.log(md.join('\n'));
  fs.writeFileSync(A.out||'digit-eval.json',JSON.stringify({rows,raw,spent},null,1)); })().catch(e=>{ console.error(e); process.exit(1); });
