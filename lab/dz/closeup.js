/* ═══════════ Съёмка по чертежам: общий снимок → каждый чертёж вблизи (ДЗ №3, лист без клеток) ═══════════
   На листе А3 четыре чертежа. Весь лист в кадре — 3–6 px/мм (настоящие листы в9, в16: 3,8 и 2,7), мерить хотим от 8.
   1. Общий снимок (overview): свои глаза находят все копии фигуры условия (eyes.findDrawings) — где каждый чертёж и
      сколько на нём px/мм. Чертёж, у которого уже ≥ 8 px/мм, проверяется и по общему снимку (кадр его серии).
   2. Камера просит поднести телефон к каждому остальному («чертёж 2 из 4 — справа вверху»). Снимок вблизи (close):
      чертежи на нём (findDrawings, длинная сторона кадра — o.side «мм»), их px/мм, какой это чертёж общего снимка
      (eyes.sameDrawing; не узнан — тот, к которому просили поднести, и только центральный), проверка (checkEyes).
      Мельче 8 px/мм — снимок не идёт в зачёт: «поднесите ближе».
   3. У каждого чертежа своя серия: от SHOTS до MAX кадров ≥ 8 px/мм с разных углов. Утверждение части («верно»,
      «ошибка») — только если его делают ≥ ⌈2k/3⌉ из k прочитанных кадров (не меньше двух) и ни один не утверждает
      обратного (правило series.js). Одна часть «верно» на двух разных чертежах листа — противоречие: у обоих
      «не могу утверждать» (часть на листе одна).
   Опознание чертежа вердикт не меняет — он по своим снимкам; ошибка опознания — лишь не тот чертёж в счёте «снято».
   overview(img, {dz, n, answers}) → {ok, reason, drawings:[{A, ppm, c, box, pos, title}], frames:{j: кадр}}
   close(img, ov{img, drawings}, {n, answers, want, side}) → {ok, reason, got:[{j, known, ppm, frame, note}]}
   Session(ov) → {add(j, кадр), need(j), next(from), done(), result()} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
/* мозг — при первом вызове: странице камеры нужны только vote и Session (без eyes.js, проверка идёт в потоке) */
const EYm=()=>isNode?require('./eyes.js'):self.LAB.dzEyes, Mm=()=>isNode?require('./model.js'):self.LAB.dzModel, Vm=()=>isNode?require('../../core/dz-variants.js'):self.CORE.dzVariants;
const MIN_PPM=8, SHOTS=2, MAX=3, PN={a:'1) высота',b:'2) угол граней',c:'3) истинный вид',d:'4) угол SA'};
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');
const ppmOf=A=>Math.sqrt(Math.abs(A[0]*A[4]-A[1]*A[3]));
const app=(A,p)=>[A[0]*p[0]+A[1]*p[1]+A[2],A[3]*p[0]+A[4]*p[1]+A[5]];
/* фигура условия: её рамка в мм условия (центр чертежа — центр фигуры, поле 40 мм — построения вокруг) */
function figBox(n){ const gv=Vm().get(3,+n), g=Mm().given(gv.id,gv.data), P=g.segs.flatMap(q=>[q.a,q.b]).concat([[0,0]]);
  return [Math.min(...P.map(p=>p[0])),Math.min(...P.map(p=>p[1])),Math.max(...P.map(p=>p[0])),Math.max(...P.map(p=>p[1]))]; }
/* кадр серии одного чертежа: только то, что голосует */
function frameOf(g,ppm){ return {ok:!!g.ok,verdict:g.verdict,why:g.why||[],ppm,ms:g.ms,shown:g.shown||[],partGuess:g.partGuess||null,idPart:g.idPart||null,
  parts:g.parts?Object.fromEntries(Object.entries(g.parts).map(([k,p])=>[k,{st:p.st,why:p.why||[]}])):{},
  /* что понял мозг (check3 geo, мм чертежа) — для чистого чертежа; только показанные части */
  geo:g.parts?Object.fromEntries((g.shown||[]).filter(k=>g.parts[k]&&g.parts[k].geo).map(k=>[k,g.parts[k].geo])):{}}; }
function check(img,ds,o){ const r=EYm().checkEyes(img,{dz:3,n:o.n,drawings:ds},{dz:3,n:o.n,answers:o.answers,grid:{ok:false,reason:'чистый лист'}}); return r&&r.drawings||[]; }

function overview(img,o){ o=o||{}; const n=+o.n, EY=EYm(); if(!Vm().get(3,n)) return {ok:false,reason:'для съёмки по чертежам нужен номер варианта'};
  const f=EY.findDrawings(img,{dz:3,n}); if(!f.ok) return {ok:false,reason:f.reason};
  const fb=figBox(n), m0=[(fb[0]+fb[2])/2,(fb[1]+fb[3])/2];
  const drawings=f.drawings.map(d=>({A:d.A,cover:d.cover,ppm:ppmOf(d.A),c:app(d.A,m0),box:[[fb[0]-40,fb[1]-30],[fb[2]+40,fb[1]-30],[fb[2]+40,fb[3]+30],[fb[0]-40,fb[3]+30]].map(p=>app(d.A,p))}));
  /* где чертёж — слова по положению среди остальных (лист 2 × 2) */
  const mx=drawings.map(d=>d.c[0]).sort((a,b)=>a-b), my=drawings.map(d=>d.c[1]).sort((a,b)=>a-b), cx=(mx[0]+mx[mx.length-1])/2, cy=(my[0]+my[my.length-1])/2, spanX=mx[mx.length-1]-mx[0], spanY=my[my.length-1]-my[0];
  drawings.forEach((d,j)=>{ const h=spanX>0.2*img.width?(d.c[0]<cx?'слева':'справа'):'', v=spanY>0.2*img.height?(d.c[1]<cy?'вверху':'внизу'):''; d.pos=[h,v].filter(Boolean).join(' ')||'посередине'; d.title='чертёж '+(j+1)+' из '+drawings.length+(d.pos?' — '+d.pos:''); });
  /* крупные уже сейчас — проверяются по общему снимку (все вместе: так мозг видит весь лист) */
  const frames={}, big=drawings.map((d,j)=>d.ppm>=MIN_PPM?j:-1).filter(j=>j>=0);
  if(big.length){ const r=check(img,big.map(j=>({A:drawings[j].A,cover:drawings[j].cover,pts:{}})),o); big.forEach((j,i)=>{ if(r[i]) frames[j]=frameOf(r[i],drawings[j].ppm); }); }
  return {ok:true,drawings,frames,page:f.page}; }

function close(img,ov,o){ o=o||{}; const n=+o.n, EY=EYm(), f=EY.findDrawings(img,{dz:3,n,side:o.side||220});
  if(!f.ok) return {ok:false,reason:'чертёж на снимке не нашёл — '+f.reason};
  const fb=figBox(n), m0=[(fb[0]+fb[2])/2,(fb[1]+fb[3])/2], C=[img.width/2,img.height/2];
  const ds=f.drawings.map(d=>({d,ppm:ppmOf(d.A),r:Math.hypot(app(d.A,m0)[0]-C[0],app(d.A,m0)[1]-C[1])})).sort((a,b)=>a.r-b.r);
  const ok=ds.filter(q=>q.ppm>=MIN_PPM); if(!ok.length) return {ok:false,ppm:ds[0].ppm,reason:'мелко: '+f1(ds[0].ppm)+' px/мм, нужно от '+MIN_PPM+' — поднесите телефон ближе'};
  /* какой это чертёж общего снимка; не узнан — центральный считается тем, к которому просили поднести */
  const got=[]; ok.forEach((q,i)=>{ const m=ov&&ov.img?EY.sameDrawing({img,A:q.d.A},{img:ov.img,drawings:ov.drawings},{dz:3,n}):{j:-1,why:'нет общего снимка'};
    let j=m.j, known=j>=0, note=null; if(!known){ if(i===0&&o.want!=null){ j=o.want; note='не узнал по линиям, какой это чертёж, — считаю, что '+(j+1)+'-й, к которому просил поднести'; } else return; }
    else if(o.want!=null&&j!==o.want&&i===0) note='это чертёж '+(j+1)+', а просил '+(o.want+1);
    if(got.some(g=>g.j===j)) return; got.push({j,known,ppm:q.ppm,A:q.d.A,cover:q.d.cover,note,score:m.score}); });
  if(!got.length) return {ok:false,reason:'не узнал, какой это чертёж общего снимка'};
  /* подсказка модели (номер части у чертежа общего снимка) — мозгу: он примет её, только если построение её подтвердит */
  const r=check(img,got.map(g=>({A:g.A,cover:g.cover,pts:{},part:o.hints&&o.hints[g.j]||null})),o);
  return {ok:true,got:got.map((g,i)=>({j:g.j,known:g.known,ppm:g.ppm,note:g.note,score:g.score,frame:r[i]?frameOf(r[i],g.ppm):{ok:false,why:['мозг не вернул чертёж']}}))}; }

/* серия кадров одного чертежа → вердикт по частям (правило series.js: ≥ ⌈2k/3⌉ из k, не меньше двух, без возражений) */
const OPP={'верно':['ошибка','ошибка в данных'],'ошибка':['верно'],'данные нанесены верно':['ошибка в данных'],'ошибка в данных':['данные нанесены верно','верно']};
function vote(frames){ const R=frames.filter(f=>f&&f.ok), k=R.length, need=Math.max(2,Math.ceil(2*k/3)), out={n:frames.length,read:k,parts:{},shown:[],verdict:'не могу утверждать',why:[],conflicts:[],ppm:R.length?Math.min(...R.map(f=>f.ppm||0)):null};
  if(!k){ out.verdict=frames.length?'не могу прочитать':'не снят'; if(frames.length) out.why.push(((frames[0].why||[])[0])||'снимки не прочитаны'); return out; }
  const pick=(sts)=>{ const c={}; sts.forEach(s=>{ if(s) c[s]=(c[s]||0)+1; }); let res=null; Object.keys(c).forEach(s=>{ if(c[s]>=need&&!(OPP[s]||[]).some(t=>c[t])) res=s; });
    const conf=Object.keys(c).some(s=>(OPP[s]||[]).some(t=>c[t])); return {res,conf,c}; };
  [...new Set(R.flatMap(f=>f.shown||[]))].forEach(q=>{ const v=pick(R.map(f=>(f.shown||[]).includes(q)&&f.parts[q]?f.parts[q].st:null));
    if(v.conf) out.conflicts.push('часть '+PN[q]);
    const st=v.res==='верно'||v.res==='ошибка'?v.res:'не могу утверждать', src=R.find(f=>f.parts[q]&&f.parts[q].st===st);
    out.parts[q]={st,why:v.conf?['кадры расходятся ('+Object.entries(v.c).map(([s,x])=>s+' — '+x).join(', ')+')']:src?src.parts[q].why:['подтвердил '+Math.max(0,...Object.values(v.c))+' кадр(а) из '+k+', нужно '+need]};
    const gs=src&&src.geo&&src.geo[q]?src:R.find(f=>f.geo&&f.geo[q]); if(gs&&!v.conf) (out.geo=out.geo||{})[q]=gs.geo[q];
    out.shown.push(q); });
  const pv=Object.values(out.parts).map(p=>p.st), wv=pick(R.map(f=>f.verdict));
  out.verdict=pv.includes('ошибка')?'ошибка':pv.includes('верно')?'верно':wv.res||'не могу утверждать';
  if(wv.conf) out.conflicts.push('вердикт');
  out.why=out.shown.map(q=>PN[q]+': '+out.parts[q].st+(out.parts[q].why.length?' — '+out.parts[q].why.join('; '):''));
  if(!out.shown.length) out.why.push(((R.find(f=>f.verdict===out.verdict)||R[0]).why||[]).slice(0,2).join('; '));
  return out; }

function Session(ov,o){ o=o||{}; const shots=o.shots||SHOTS, max=o.max||MAX, fr=ov.drawings.map(()=>[]);
  Object.entries(ov.frames||{}).forEach(([j,f])=>fr[+j].push(f));
  /* ещё кадр: мало прочитанных, кадры расходятся, или один кадр утверждает часть, а подтверждения не хватило */
  const need=j=>{ if(fr[j].length>=max) return false; const S=vote(fr[j]); if(S.read<shots||S.conflicts.length>0) return true;
    return S.shown.some(q=>S.parts[q].st==='не могу утверждать'&&fr[j].some(f=>f&&f.ok&&f.parts[q]&&(f.parts[q].st==='верно'||f.parts[q].st==='ошибка'))); };
  return { fr, add(j,f){ if(fr[j]) fr[j].push(f); }, need,
    next(from){ const N=fr.length; for(let i=0;i<N;i++){ const j=((from||0)+i)%N; if(need(j)) return j; } return -1; },
    done(){ return fr.every((x,j)=>!need(j)); },
    result(){ const D=fr.map(vote);
      /* часть на листе одна (как в checkEyes): «верно» одной части на двух чертежах — противоречие, у обоих не утверждаю;
         «верно» на одном — «ошибка» той же части на другом не утверждается (там чужие похожие линии) */
      const unsure=(j,q,w)=>{ D[j].parts[q]={st:'не могу утверждать',why:[w]}; const pv=Object.values(D[j].parts).map(p=>p.st);
        D[j].verdict=pv.includes('ошибка')?'ошибка':pv.includes('верно')?'верно':'не могу утверждать'; D[j].why=D[j].shown.map(k=>PN[k]+': '+D[j].parts[k].st+' — '+D[j].parts[k].why.join('; ')); };
      ['a','b','c','d'].forEach(q=>{ const js=D.map((d,j)=>d.parts[q]&&d.parts[q].st==='верно'?j:-1).filter(j=>j>=0); if(!js.length) return;
        if(js.length>=2) js.forEach(j=>unsure(j,q,'«верно» этой части вышло на чертежах '+js.map(x=>x+1).join(' и ')+' — часть на листе одна, не утверждаю'));
        else D.forEach((d,j)=>{ if(j!==js[0]&&d.parts[q]&&d.parts[q].st==='ошибка') unsure(j,q,'эта часть сошлась на чертеже '+(js[0]+1)+' — здесь, видимо, чужие похожие линии'); }); });
      /* какая это часть — только та, что сошлась («верно»): «не могу утверждать» части её не опознаёт */
      /* «ошибка» в серии — только у части, опознанной построением (gridsheet idPart): она тоже называет часть */
      return D.map((d,j)=>{ const ok=d.shown.filter(q=>d.parts[q].st==='верно'), bad=d.shown.filter(q=>d.parts[q].st==='ошибка'); /* без вердикта — часть, которую построение опознало на всех прочитанных кадрах (не меньше двух) */
        const ids=fr[j].filter(f=>f&&f.ok).map(f=>f.idPart), idk=ids.length>=2&&ids.every(x=>x&&x===ids[0])?ids[0]:null;
        return Object.assign(d,{title:ov.drawings[j].title,part:ok.length===1?ok[0]:!ok.length&&bad.length===1?bad[0]:!ok.length&&!bad.length?idk:null}); }); } }; }

put('dzCloseup',{overview,close,vote,Session,MIN_PPM,ppmOf});
})();
