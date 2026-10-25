/* ═══════════ Интерпретация: анализ через синтез ═══════════
   Известны задача, «дано» (напечатано, после выпрямления — точно), верные способы решения и ошибки библиотеки
   (core/cp47.js). Гипотеза = программа построения. Она подгоняется к найденным на фото отрезкам шаг за шагом,
   и каждый шаг предсказывается из того, что студент уже нарисовал (его собственных линий), а не из идеала:
     линия (∥ оси, линия связи, ⟂, через точки) — ищем отрезок у предсказанной прямой; допуск — модель руки:
       поперёк σ(t) = √(σ_сдвиг² + (t·σ_угол)²) на расстоянии t от опорной точки; найденный отрезок становится
       «линией студента» для следующих шагов;
     точка (пересечение) — пересечение линий студента;
     отрезок между точками (A′K′, катет, гипотенуза) — концы у этих точек; катет — ещё и длина, снятая циркулем.
   Правдоподобие гипотезы: −½ Σ невязок² − штраф за каждый ненайденный обязательный элемент − штраф за линии
   на листе, которые гипотеза не объясняет. Победитель — диагноз, если:
     • он объясняет все обязательные элементы и все заметные линии листа;
     • он лучше любой гипотезы другого класса на ≥ МАРЖА (кроме неотличимых на этих данных: их чертежи
       расходятся меньше чем на 1 мм — тогда вердикт с оговоркой);
   иначе — честный отказ («не узнаю построение» или «не уверен: X или Y»). */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const core=n=>isNode?require('../core/'+n+'.js'):((self.CORE&&self.CORE[n])||(self.CERT&&self.CERT[n]));
const lab=n=>isNode?require('./'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const {v2,L2,PRJ,point3,v3}=core('model'), cp=core('cp'), {SHEETS}=lab('sheets');

/* «K где угодно на a» — соперник любого диагноза: K′ — конец основной линии от A′ на a′, дальше всё как обычно.
   Свободная точка стоит FREE_PEN (≈ ln(ширина поиска / σ)): если K студента ближе к «где угодно», чем к тому, что
   даёт гипотеза, — гипотеза не объясняет лист, вердикта нет (так ловится построение, которого нет в библиотеке) */
const FREE_PEN=3;
function freeProgram(C,nvid){ const {edit}=cp; let q=edit.optional(C.program('front',nvid),C.PLANE.concat(['Sh']));
  q=edit.remove(q,['K′','A′K′']); q=edit.insertAfter(q,'m',[{id:'A′K′',op:'rayTo',args:['A′','a′'],draw:{k:'main',span:['A′','K′']}},{id:'K′',op:'meet',args:['A′K′','a′'],draw:{}}]);
  return q; }
/* модель руки и пороги (мм, градусы); см. lab/REPORT-scanner.md — подобраны на синтетике уровня normal */
const HAND={off:0.45,ang:1.1,pt:0.7,len:0.5,end:1.2};
const ACCEPT=16, MISS=10, MARGIN=8, SEP=1.0, FIT_MAX=9;
const deg=Math.PI/180;

/* стоимость: отрезок s как прямая L через опорную точку P (если есть) */
function lineCost(s,L,P){ const da=L2.dist(s.a,L), db=L2.dist(s.b,L), ta=P?Math.abs(L2.t(s.a,L)-L2.t(P,L)):0, tb=P?Math.abs(L2.t(s.b,L)-L2.t(P,L)):0;
  const sa=Math.hypot(HAND.off,ta*HAND.ang*deg), sb=Math.hypot(HAND.off,tb*HAND.ang*deg);
  return (da/sa)**2+(db/sb)**2; }
const segLine=s=>L2.through(s.a,s.b);
/* отрезок лежит в ожидаемом пролёте (между точками пролёта ± вылет) — не берём чужой отрезок на той же прямой далеко */
function inSpan(s,L,lo,hi){ const ta=L2.t(s.a,L), tb=L2.t(s.b,L), a=Math.min(ta,tb), b=Math.max(ta,tb); return b>=lo-2&&a<=hi+2&&(b-a)>=Math.min(3,hi-lo); }

/* подгонка одной гипотезы */
function fitProgram(prog,given,segs,vis,probeLine){ const E=Object.assign({},given), roles={}, used=new Map(), steps=[]; let ll=0; const missReq=[];
  const ideal=cp.exec(Object.assign({},prog,{steps:prog.steps.filter(x=>x.op!=='rayTo')}),given).E;   /* где примерно будут ещё не построенные точки — для пролёта линии */
  const P_=n=>{ const p=E[n]!=null&&!E[n].d?E[n]:ideal[n]; return Array.isArray(p)&&p.length===2?p:null; };
  const span=(st,L)=>{ const pts=(st.draw&&st.draw.span||[]).map(P_).filter(Boolean); if(!pts.length) return null; const ts=pts.map(P=>L2.t(P,L)); return [Math.min(...ts)-10,Math.max(...ts)+10]; };
  const take=(id,idx,c)=>{ ll-=c/2; roles[id]=idx; idx.forEach(i=>used.set(i,(used.get(i)||[]).concat(id))); steps.push({id,c,seg:idx[0],n:idx.length}); };
  /* ненайденное штрафуется, только если его можно было увидеть: видимая (не под печатью) длина ≥ 3,5 мм */
  const visLen=(st,L)=>{ if(!vis) return Infinity; let a, b;
    if(st.op==='seg'){ a=E[st.args[0]]; b=E[st.args[1]]; } else { const pts=(st.draw&&st.draw.span||[]).map(P_).filter(Boolean); if(pts.length<2) return Infinity; const ts=pts.map(P=>L2.t(P,L)); a=L2.at(L,Math.min(...ts)); b=L2.at(L,Math.max(...ts)); }
    return Array.isArray(a)&&Array.isArray(b)?vis(a,b):Infinity; };
  const optMiss=[];
  const miss=(st,Lp)=>{ E[st.id]=Lp; const v=visLen(st,Lp); if(!st.opt&&v>=3.5){ ll-=MISS; missReq.push(st.id); } if(st.opt&&v>=3.5) optMiss.push(st.id); steps.push({id:st.id,c:null,unseen:v<3.5}); };
  const kcost=(st,i)=>{ const k=st.draw&&st.draw.k, o=segs[i].k; if(!k||!o) return 0; return (k==='main')!==(o==='main')?1.5:0; };
  for(const st of prog.steps){ const op=st.op==='rayTo'?{kind:'line',f:()=>null}:cp.OPS[st.op], args=st.args.map(a=>typeof a==='string'?E[a]:a);
    if(args.some(a=>a==null)){ if(!st.opt) missReq.push(st.id); continue; }
    if(op.kind==='num'||op.kind==='point'&&st.op!=='perpOff'&&st.op!=='along'){ const v=op.f(...args); if(v==null){ missReq.push(st.id); continue; } E[st.id]=v; continue; }
    if(st.op==='perpOff'||st.op==='along'){ E[st.id]=op.f(...args); E[st.id+'#pred']=true; continue; }
    const Lp=op?op.f(...args):null, anchor=args.find(a=>Array.isArray(a)&&a.length===2);
    if(st.op==='rayTo'){ /* основная линия от P до прямой L, направление любое (для «K где угодно») */
      const P=args[0], Lt=args[1]; let best=null;
      segs.forEach((s,i)=>{ for(const [a,b] of [[s.a,s.b],[s.b,s.a]]){ if(v2.dist(a,P)>2.5||s.len<8||L2.dist(b,Lt)>1.5) continue; const c=(v2.dist(a,P)/HAND.end)**2/2+(L2.dist(b,Lt)/HAND.off)**2/2+kcost(st,i); if(!best||c<best.c) best={c,i}; } });
      if(best){ E[st.id]=segLine(segs[best.i]); take(st.id,[best.i],best.c+2*FREE_PEN); } else miss(st,null); continue; }
    if(st.op==='seg'){ const P=args[0], Q=args[1], free=E[st.args[1]+'#pred']&&!roles[st.args[1]+'#got'];
      if(free){ /* катет: от P перпендикулярно, длина — циркулем; дальний конец N — точка студента. Катет часто виден
           не целиком (через него идут подписи, вылет другой линии), поэтому N — пересечение линии катета с гипотенузой
           (следующий шаг: отрезок от другой точки к N), а если гипотенузы нет — дальний конец катета */
        const dir=v2.unit(v2.sub(Q,P)), L=L2.dir(P,dir), want=v2.dist(P,Q), Nn=st.args[1];
        const hs=prog.steps.find(x=>x.op==='seg'&&x.args[1]===Nn&&x!==st), H0=hs&&E[hs.args[0]];
        const legC=[]; segs.forEach((s,i)=>{ const ta=L2.t(s.a,L), tb=L2.t(s.b,L), near=Math.min(ta,tb), far=Math.max(ta,tb); if(near<-2.5||near>4.5||far<2||far>want+Math.max(6,0.5*want)) return;
          const c=lineCost(s,L,P)*0.5+Math.max(0,(near-2.5)/1.5)**2+kcost(st,i); if(c<ACCEPT) legC.push({c,i,far,fe:ta>tb?s.a:s.b}); });
        const hypC=[]; if(H0){ const Lh=L2.through(H0,Q), wl=v2.dist(H0,Q); segs.forEach((s,i)=>{ const ta=L2.t(s.a,Lh), tb=L2.t(s.b,Lh), lo=Math.min(ta,tb), hi=Math.max(ta,tb); if(lo>4||hi<0.4*wl||hi>wl+6) return;
            const c=lineCost(s,Lh,H0)*0.5; if(c<ACCEPT) hypC.push({c,i,L:segLine(s),far:hi,fe:ta>tb?s.a:s.b}); }); }
        let best=null;
        legC.forEach(lg=>{ let N=lg.fe, hc=null; hypC.forEach(h=>{ const X=L2.meet(segLine(segs[lg.i]),h.L); if(!X||L2.angle(segLine(segs[lg.i]),h.L)<15) return; const t=L2.t(X,L);
            if(t<2||t>Math.max(want,lg.far)+3) return; if(!hc||h.c<hc.c){ hc=h; N=X; } });
          const len=L2.t(N,L), c=lg.c+((len-want)/HAND.len)**2; if(c<ACCEPT&&(!best||c<best.c)) best={c,i:lg.i,N,h:hc}; });
        /* катета не видно (короткий, под печатью) — конец по гипотенузе */
        if(!best&&hypC.length){ hypC.forEach(h=>{ const X=L2.meet(h.L,L); if(!X) return; const len=L2.t(X,L), c=h.c+((len-want)/HAND.len)**2+(v2.dist(X,h.fe)/HAND.end)**2; if(c<ACCEPT&&(!best||c<best.c)) best={c,i:null,N:X,h}; }); }
        if(best){ E[Nn]=best.N; roles[Nn+'#got']=true; if(best.i!=null){ E[st.id]=segLine(segs[best.i]); const Lg=E[st.id], grp=[best.i];
            segs.forEach((s,i)=>{ if(i!==best.i&&L2.dist(s.a,Lg)<0.6&&L2.dist(s.b,Lg)<0.6&&Math.min(L2.t(s.a,L),L2.t(s.b,L))>-2&&Math.max(L2.t(s.a,L),L2.t(s.b,L))<want+3) grp.push(i); }); take(st.id,grp,best.c); } else { E[st.id]=L; steps.push({id:st.id,c:best.c,viaHyp:true}); ll-=best.c/2; if(visLen(st,L)>=3.5){ ll-=MISS/2; } } }
        else miss(st,Lp); continue; }
      /* отрезок между построенными точками: поперёк — у прямой PQ, покрывает её, за точки не выходит */
      const L=L2.through(P,Q), len=v2.dist(P,Q); let best=null;
      segs.forEach((s,i)=>{ const da=L2.dist(s.a,L), db=L2.dist(s.b,L), ta=L2.t(s.a,L), tb=L2.t(s.b,L), lo=Math.min(ta,tb), hi=Math.max(ta,tb);
        const cov=(Math.min(hi,len)-Math.max(lo,0))/len; if(cov<0.5) return;
        /* выход за точки: штраф, если продолжение не объяснено другой линией построения (гипотенуза поверх h″) */
        const over=used.has(i)?0:Math.max(0,-lo-2)+Math.max(0,hi-len-2);
        const c=(da/HAND.off)**2/2+(db/HAND.off)**2/2+(over/1)**2+kcost(st,i); if(c<ACCEPT&&(!best||c<best.c)) best={c,i}; });
      if(best){ /* куски того же отрезка (разорван пересечениями и подписями) — тоже его */
        const grp=[best.i]; segs.forEach((s,i)=>{ if(i===best.i) return; const ta=L2.t(s.a,L), tb=L2.t(s.b,L); if(L2.dist(s.a,L)<0.6&&L2.dist(s.b,L)<0.6&&Math.min(ta,tb)>-2&&Math.max(ta,tb)<len+2) grp.push(i); });
        E[st.id]=segLine(segs[best.i]); take(st.id,grp,best.c); } else miss(st,Lp); continue; }
    /* прямая построения: все куски у предсказанной прямой в пролёте; затравка — лучший по невязке с учётом длины */
    const sp=span(st,Lp), cand=[];
    segs.forEach((s,i)=>{ const c=lineCost(s,Lp,anchor); if(c>=ACCEPT) return; if(sp&&!inSpan(s,Lp,sp[0],sp[1])) return; cand.push({c:c+kcost(st,i),i,score:c-2*Math.log(s.len)}); });
    if(!cand.length){ /* бледная линия: проверить предсказание прямо по карте гребней (между точками пролёта) */
      const pr=probeLine&&sp?probeLine(st,Lp,sp):null;
      if(pr&&pr.frac>=0.5&&pr.line){ const c=lineCost(pr.line,Lp,anchor); if(c<ACCEPT){ E[st.id]=segLine(pr.line); ll-=c/2+1; steps.push({id:st.id,c,probe:pr.frac}); continue; } }
      miss(st,Lp); continue; }
    cand.sort((a,b)=>a.score-b.score); let grp=[cand[0].i], L=segLine(segs[cand[0].i]);
    for(let it=0;it<2;it++){ grp=cand.map(c=>c.i).filter(i=>L2.dist(segs[i].a,L)<0.6&&L2.dist(segs[i].b,L)<0.6); if(!grp.includes(cand[0].i)) grp.push(cand[0].i);
      L=fitPts(grp.flatMap(i=>pieces(segs[i])))||L; }
    /* невязка — по всей линии студента: концы самого дальнего покрытия против предсказания */
    const ts=grp.flatMap(i=>[L2.t(segs[i].a,L),L2.t(segs[i].b,L)]), ends=[L2.at(L,Math.min(...ts)),L2.at(L,Math.max(...ts))];
    const c=lineCost({a:ends[0],b:ends[1]},Lp,anchor)+kcost(st,cand[0].i);
    if(c>=ACCEPT){ miss(st,Lp); continue; }
    E[st.id]=L; take(st.id,grp,c); }
  /* необязательная группа (плоскость α при ошибках foot1/foot2): студент либо строил её, либо нет. Если найдены
     хотя бы две её прямые, остальные видимые прямые группы обязательны (иначе гипотеза «объясняет» обрывки) */
  const GROUP=['h″','h′','f′','f″','l1','l2','m'], gFound=steps.filter(x=>GROUP.includes(x.id)&&x.c!=null).length;
  if(gFound>=2) optMiss.filter(id=>GROUP.includes(id)).forEach(id=>{ ll-=MISS; missReq.push(id); });
  /* необъяснённые линии листа */
  const extra=[]; segs.forEach((s,i)=>{ if(used.has(i)||s.print) return; const w=Math.min(1,s.len/10)*Math.min(1,s.conf||1)*(s.rel==null?1:Math.min(1,s.rel)); ll-=6*w; if(s.len>=6&&w>=0.4) extra.push(i); });
  return {ll,E,roles,missReq,extra,steps}; }
/* точки вдоль отрезка (вес — длина) для общей МНК-прямой */
function pieces(s){ const n=Math.max(2,Math.round(s.len/2)), o=[]; for(let k=0;k<=n;k++) o.push(v2.lerp(s.a,s.b,k/n)); return o; }
function fitPts(P){ if(P.length<2) return null; const n=P.length, m=[P.reduce((s,p)=>s+p[0],0)/n,P.reduce((s,p)=>s+p[1],0)/n]; let sxx=0,sxy=0,syy=0;
  P.forEach(p=>{ const x=p[0]-m[0], y=p[1]-m[1]; sxx+=x*x; sxy+=x*y; syy+=y*y; }); const a=0.5*Math.atan2(2*sxy,sxx-syy); return {p:m,d:[Math.cos(a),Math.sin(a)]}; }

/* то же только по K′, K″ (для частичного вердикта об основании перпендикуляра) */
function sepK(C,given,h1,h2){ const E1=cp.exec(C.program(h1.kid,h1.nvid),given).E, E2=cp.exec(C.program(h2.kid,h2.nvid),given).E; let m=0;
  ['K′','K″'].forEach(n=>{ if(E1[n]&&E2[n]) m=Math.max(m,v2.dist(E1[n],E2[n])); else m=99; }); return m; }
/* разведение гипотез на этих данных: наибольший сдвиг ключевых точек идеальных чертежей */
const KEYS=['K′','K″','A₀','K₀','1′','2′','1″','2″'];
function separation(C,given,h1,h2){ const E1=cp.exec(C.program(h1.kid,h1.nvid),given).E, E2=cp.exec(C.program(h2.kid,h2.nvid),given).E; let m=0, any=false;
  KEYS.forEach(n=>{ if(E1[n]&&E2[n]){ any=true; m=Math.max(m,v2.dist(E1[n],E2[n])); } else if(!!E1[n]!==!!E2[n]&&(n==='A₀'||n==='K₀')) m=Math.max(m,99); });
  /* треугольник есть в одной и нет в другой — различимы; при разных концах треугольника сравнивать нечего — различимы */
  if((E1['A₀']||E1['K₀'])&&(E2['A₀']||E2['K₀'])&&!(E1['A₀']&&E2['A₀'])&&!(E1['K₀']&&E2['K₀'])) m=Math.max(m,99);
  return any?m:99; }

function interpret(ln,lb,o){ o=o||{}; const n=o.n||47, SH=SHEETS[n], C=core('cp'+n), G=SH.G(), given=C.given(G);
  if(C.pattern) return interpret46(ln,lb,o,SH,C,G,given);
  /* относительная тёмность: бледные следы (стёртое) объясняют меньше и штрафуют меньше */
  const segs=ln.segs.map(s=>Object.assign({},s)); const dk=segs.filter(s=>s.len>15).map(s=>s.dark).sort((a,b)=>a-b), ref=dk.length?dk[Math.floor(dk.length/2)]:0.3;
  segs.forEach(s=>s.rel=s.dark/ref);
  const strong=segs.filter(s=>s.rel>=0.45);
  /* видимая длина отрезка (мм чертежа): не под маской печати и в кадре области построения */
  const mp=ln.map, O=SH.O, vis=(a,b)=>{ const L=v2.dist(a,b), n=Math.max(1,Math.ceil(L/0.25)); let k=0;
    for(let i=0;i<=n;i++){ const p=v2.lerp(a,b,i/n), x=Math.floor((p[0]+O[0]-mp.box[0])*8), y=Math.floor((p[1]+O[1]-mp.box[1])*8); if(x<0||y<0||x>=mp.g.w||y>=mp.g.h) continue; if(!mp.mask[y*mp.g.w+x]) k++; }
    return k/(n+1)*L; };
  /* пробник бледных линий: только между точками пролёта (без запаса на вылет) */
  const probeLine=(st,Lp,sp)=>{ const a=L2.at(Lp,sp[0]+10), b=L2.at(Lp,sp[1]-10); return lab('lines').probe(ln.map,a,b); };
  const H=C.hypotheses(), LB=lb?lab('labels'):null, NAMES=['K′','K″','1′','2′','1″','2″','A₀','K₀'];
  const fits=H.map(h=>{ const f=Object.assign({h},fitProgram(C.program(h.kid,h.nvid),given,strong,vis,probeLine));
    /* подписи — слабое свидетельство: у точек гипотезы прочитаны их имена (каждая подпись ±1 к правдоподобию) */
    if(LB){ const ag=LB.agreement(lb,f.E,NAMES); f.ll+=ag.ll; f.labels=ag.pairs; } return f; });
  fits.sort((a,b)=>b.ll-a.ll); const best=fits[0];
  const freeFit=w=>{ try{ return fitProgram(freeProgram(C,w.h.nvid),given,strong,vis,probeLine); }catch(e){ return null; } };
  const why=[]; if(best.missReq.length) why.push('не найдено: '+best.missReq.join(', ')); if(best.extra.length) why.push('лишние линии: '+best.extra.length);
  const res={vis,probeLine,ok:false,fits:fits.slice(0,8).map(f=>({cls:f.h.cls,kid:f.h.kid,nvid:f.h.nvid,ll:+f.ll.toFixed(2),miss:f.missReq,extra:f.extra.length})),segs:strong};
  res.extraInfo=best.extra.map(i=>{ const g=strong[i]; return g.a.map(v=>v.toFixed(1))+'→'+g.b.map(v=>v.toFixed(1))+' '+g.len.toFixed(1)+'мм '+g.k+' rel'+g.rel.toFixed(2); }); res.bestH=best.h.kid+'/'+best.h.nvid;
  if(best.missReq.length||best.extra.length){ res.reason='не узнаю построение: оно не совпадает ни с верным решением, ни с известными ошибками ('+why.join('; ')+')'; res.unknown=true; return res; }
  /* соперник другого класса, различимый на этих данных */
  /* соперник — гипотеза другого класса, которая тоже объясняет всё на листе (иначе она не правдоподобна) */
  const rival=fits.find(f=>f.h.cls!==best.h.cls&&!f.missReq.length&&!f.extra.length&&separation(C,given,best.h,f.h)>=SEP);
  const margin=rival?best.ll-rival.ll:Infinity;
  if(margin<MARGIN){ res.reason='не уверен: похоже и на «'+label(C,best.h)+'», и на «'+label(C,rival.h)+'» — переснимите резче или обведите построение'; res.margin=margin;
    /* частичный вердикт: сомнение только в треугольнике, а основание перпендикуляра K различимо уверенно */
    const kc=h=>C.KOPT[h.kid].ok?'ok':h.kid;
    if(kc(rival.h)===kc(best.h)){ const rK=fits.find(f=>kc(f.h)!==kc(best.h)&&!f.missReq.length&&!f.extra.length&&sepK(C,given,best.h,f.h)>=SEP), mK=rK?best.ll-rK.ll:Infinity;
      const frK=freeFit(best); if(frK&&!frK.missReq.length&&!frK.extra.length&&frK.ll>best.ll){ res.reason+=' (и K стоит не там, где её дают известные способы)'; return res; }
      const worstK=best.steps.filter(x=>x.c!=null).reduce((m,x)=>Math.max(m,x.c),0); if(worstK>FIT_MAX) return res;
      if(mK>=MARGIN){ const v=verdict(C,best,G,given,[],true); res.ok=true; res.partial=true; res.verdict=v; res.margin=mK; res.marks=v.marks; res.scene=sceneOf(SH,ln,best,strong); return res; } }
    return res; }
  /* неотличимые на этих данных (чертежи расходятся < 1 мм): если среди них есть верное решение — вердикт «верно»
     с оговоркой (чертёж верен с точностью построения, а способ по чертежу не проверить); две разные ошибки —
     отказ: какую назвать, по чертежу не решить */
  const twinF=fits.filter(f=>f.h.cls!==best.h.cls&&!f.missReq.length&&!f.extra.length&&separation(C,given,best.h,f.h)<SEP&&best.ll-f.ll<MARGIN);
  let win=best; const okT=twinF.find(f=>f.h.cls==='ok');
  if(best.h.cls!=='ok'&&okT) win=okT;
  else if(best.h.cls!=='ok'&&twinF.length){ res.reason='не могу различить: «'+label(C,best.h)+'» или «'+label(C,twinF[0].h)+'» — на этих данных чертежи почти совпадают'; return res; }
  const twins=[best].concat(twinF).filter(f=>f!==win).map(f=>f.h.cls);
  /* каждый найденный шаг — в пределах 3σ руки (невязка² ≤ 9): иначе совпадение натянутое */
  const worst=win.steps.filter(x=>x.c!=null).reduce((m,x)=>Math.max(m,x.c),0);
  if(worst>FIT_MAX){ res.reason='построение похоже на «'+label(C,win.h)+'», но расходится с ним больше, чем допускает точность руки ('+win.steps.find(x=>x.c===worst).id+') — переснимите резче или обведите построение'; return res; }
  /* «K где угодно» с тем же треугольником объясняет лист лучше — K студента не там, где её даёт этот способ */
  const fr=freeFit(win);
  if(fr&&!fr.missReq.length&&!fr.extra.length&&fr.ll>win.ll){ res.reason='не узнаю построение: точка K стоит не там, где её дают известные способы и ошибки (ближе всего «'+label(C,win.h)+'»)'; res.unknown=true; return res; }
  /* «нет натуральной величины» — вывод из отсутствия: проверяем, что на месте треугольника действительно пусто */
  if(/nv-none/.test(win.h.cls)&&faintNear(ln,win,C,given)) { res.reason='не вижу треугольник натуральной величины, но на его месте есть бледные линии — обведите построение и переснимите'; return res; }
  const v=verdict(C,win,G,given,[...new Set(twins)]); res.ok=true; res.verdict=v; res.margin=margin; res.marks=v.marks; res.scene=sceneOf(SH,ln,win,strong); return res; }

function label(C,h){ const c=h.cls; if(c==='ok') return 'верное решение'; return c.split('+').map(x=>(C.KOPT[x]||Object.values(C.NVOPT).find(v=>v.fault===x)||{}).what||x).join('; '); }
/* бледные линии там, где был бы треугольник (по любому из 8 вариантов) */
function faintNear(ln,best,C,given){ const E=best.E; let hits=0;
  Object.keys(C.NVOPT).filter(k=>C.NVOPT[k].ok).forEach(k=>{ const p=C.program(best.h.kid,k), r=cp.exec(p,given).E, N=r['A₀']||r['K₀']; if(!N) return;
    ln.segs.forEach(s=>{ if(s.len>=4&&(v2.dist(s.a,N)<2||v2.dist(s.b,N)<2)) hits++; }); });
  return hits>0; }

function verdict(C,f,G,given,twins,partial){ const h=f.h, E=f.E, parts=[];
  const K=C.KOPT[h.kid], NV=C.NVOPT[h.nvid], ok=partial?K.ok:h.cls==='ok';
  if(!K.ok) parts.push({what:K.what,why:K.why,mark:K.mark}); if(!NV.ok&&!partial) parts.push({what:NV.what,why:NV.why,mark:NV.mark});
  /* отметки: где ошибка (элементы студента) и где должно быть (идеал верной программы от его же «дано») */
  const marks=[]; parts.forEach(p=>(p.mark||[]).forEach(id=>{ const v=E[id]; if(Array.isArray(v)&&v.length===2) marks.push({at:v,id,kind:'bad'}); else if(v&&v.p&&f.roles[id]) marks.push({id,kind:'bad-line',seg:f.roles[id][0]}); }));
  const okE=cp.exec(C.program('front','ok:1A+'),given).E; if(!K.ok) ['K′','K″'].forEach(n=>marks.push({at:okE[n],id:n,kind:'should'}));
  /* 3D по прочитанному: A — из «дано», K — по K″ и K′ студента */
  const tr=C.truth(G), Kst=E['K″']&&E['K′']?point3(E['K″'],E['K′']):null;
  const scene3d={A:tr.A,K:Kst&&Kst.P,Ktrue:tr.K,a:[G.aP(0),G.aP(60)].map(p=>p.map(v=>v.num())),link:Kst&&Kst.link,nv:E['|AK|']!=null?E['|AK|']:null};
  const AK=Kst?v3.dist(tr.A,Kst.P):null;
  if(partial) return {cls:(K.ok?'ok':h.kid)+'+nv?',partial:true,kid:h.kid,ok,title:(K.ok?'Основание перпендикуляра K построено верно':parts.map(p=>p.what).join('; '))+'. Натуральную величину |AK| прочитать уверенно не удалось — обведите треугольник и переснимите',parts,
    note:'Проверено только построение точки K ('+K.what+').',points:{'K′':E['K′'],'K″':E['K″']},answer:{AK_true:tr.AK},twins:[],marks,scene3d};
  return {cls:h.cls,kid:h.kid,nvid:h.nvid,ok,title:ok?'Верно':parts.map(p=>p.what).join('; '),parts,
    note:ok?'K — основание перпендикуляра ('+K.what+'), |AK| — '+NV.what.replace('|AK| — ','')+'.'+(twins.length?' Оговорка: на этих данных такой же чертёж (разница меньше 1 мм) дала бы и ошибка «'+twins.filter(t=>t!=='ok').map(t=>label(C,{cls:t})).join('», «')+'» — по чертежу её не отличить.':''):'',
    points:{'K′':E['K′'],'K″':E['K″'],'A₀':E['A₀']||E['K₀']},answer:{AK_true:tr.AK,AK_drawn:E['|AK|'],AK_3d:AK},twins,marks,scene3d}; }

/* цифровая сцена: «дано» + найденные отрезки с ролями */
function sceneOf(SH,ln,f,segs){ const role={}; Object.entries(f.roles).forEach(([id,v])=>{ if(Array.isArray(v)) v.forEach(i=>role[i]=id); });
  const items=SH.given().map(it=>Object.assign({},it)).concat(segs.map((s,i)=>({t:'seg',a:s.a,b:s.b,k:s.k,σ:+s.σ.toFixed(3),conf:+s.conf.toFixed(3),src:'hand',role:role[i]||null})));
  ['K′','K″','1′','2′','1″','2″','A₀','K₀'].forEach(n=>{ const p=f.E[n]; if(Array.isArray(p)&&p.length===2) items.push({t:'pt',at:p,l:n,σ:HAND.pt,conf:0.8,src:'hand',role:n}); });
  return {units:'mm',items}; }

/* ═══ № 46: точки 5, 6 (программа) и видимость (узор обводки) решаются независимо ═══ */
function free46(C){ const {edit}=cp; let q=edit.optional(C.program('ok','ok'),['1″','2″','l1','1′','l2','2′','m12']);
  q=edit.remove(q,['5′','56′']); q=edit.insertAfter(q,'6″',[{id:'56′',op:'rayTo',args:['6′','DF′'],draw:{k:'main',span:['6′','5′']}},{id:'5′',op:'meet',args:['56′','DF′'],draw:{}}]);
  /* порядок: 5″ строится от 5′ — переносим шаги l5, 5″ после 5′ */
  const st=q.steps, mv=['l5','5″','56″'].map(id=>st.find(x=>x.id===id)).filter(Boolean); q.steps=st.filter(x=>!mv.includes(x)).concat(mv); return q; }
function sep46(C,given,a,b){ const E1=cp.exec(C.program(a,'ok'),given).E, E2=cp.exec(C.program(b,'ok'),given).E; let m=0; ['5′','5″','6′','6″','1′','2′','3′','4′'].forEach(k=>{ if(E1[k]&&E2[k]) m=Math.max(m,v2.dist(E1[k],E2[k])); }); return m; }
function interpret46(ln,lb,o,SH,C,G,given){ const VS=lab('visibility');
  const segs=ln.segs.map(s=>Object.assign({},s)); const dk=segs.filter(s=>s.len>15).map(s=>s.dark).sort((a,b)=>a-b), ref=dk.length?dk[Math.floor(dk.length/2)]:0.3;
  segs.forEach(s=>s.rel=s.dark/ref); const strong=segs.filter(s=>s.rel>=0.45);
  const mp=ln.map, O=SH.O, vis=(a,b)=>{ const L=v2.dist(a,b), n=Math.max(1,Math.ceil(L/0.25)); let k=0;
    for(let i=0;i<=n;i++){ const p=v2.lerp(a,b,i/n), x=Math.floor((p[0]+O[0]-mp.box[0])*8), y=Math.floor((p[1]+O[1]-mp.box[1])*8); if(x<0||y<0||x>=mp.g.w||y>=mp.g.h) continue; if(!mp.mask[y*mp.g.w+x]) k++; } return k/(n+1)*L; };
  const probeLine=(st,Lp,sp)=>lab('lines').probe(ln.map,L2.at(Lp,sp[0]+10),L2.at(Lp,sp[1]-10));
  const LB=lb?lab('labels'):null, NAMES=['1″','2″','1′','2′','3″','4″','3′','4′','5″','5′','6″','6′'];
  const fits=Object.keys(C.POPT).map(pid=>{ const f=Object.assign({pid},fitProgram(C.program(pid,'ok'),given,strong,vis,probeLine)); if(LB){ const ag=LB.agreement(lb,f.E,NAMES); f.ll+=ag.ll; } return f; }).sort((a,b)=>b.ll-a.ll);
  const obs=VS.read(ln,G,C,strong), pats=Object.keys(C.VOPT).map(v=>({v,pat:C.pattern(G,v)})), all=pats.map(x=>x.pat);
  const vs=pats.map(x=>Object.assign({v:x.v},VS.score(obs,x.pat,all))).sort((a,b)=>b.ll-a.ll);
  const res={ok:false,vis,probeLine,fits:fits.map(f=>({cls:f.pid,kid:f.pid,nvid:'',ll:+f.ll.toFixed(2),miss:f.missReq,extra:f.extra.length})),vfits:vs.map(x=>({v:x.v,ll:+x.ll.toFixed(1),mean:+(-2*x.ll/Math.max(1,x.n)).toFixed(2)})),segs:strong,obs};
  /* P: как у № 47 — объясняет всё, соперник хуже на МАРЖУ, каждый шаг в 3σ, «5 где угодно» не лучше */
  const bp=fits[0]; let P=null, whyP='';
  if(bp.missReq.length||bp.extra.length) whyP='не узнаю построение точек 5, 6 ('+(bp.missReq.length?'не найдено: '+bp.missReq.join(', '):'лишние линии: '+bp.extra.length)+')';
  else { const rv=fits.find(f=>f!==bp&&!f.missReq.length&&!f.extra.length&&sep46(C,given,bp.pid,f.pid)>=SEP), worst=bp.steps.filter(x=>x.c!=null).reduce((m,x)=>Math.max(m,x.c),0);
    const fr=(()=>{ try{ return fitProgram(free46(C),given,strong,vis,probeLine); }catch(e){ return null; } })();
    if(rv&&bp.ll-rv.ll<MARGIN) whyP='не уверен: точки 5, 6 похожи и на «'+C.POPT[bp.pid].what+'», и на «'+C.POPT[rv.pid].what+'»';
    else if(worst>FIT_MAX) whyP='построение точек 5, 6 расходится с известными способами больше, чем допускает точность руки';
    else if(fr&&!fr.missReq.length&&!fr.extra.length&&fr.ll>bp.ll) whyP='не узнаю построение: точка 5 стоит не там, где её дают известные способы';
    else P=bp; }
  /* V: средняя невязка участков ≤ 4 и соперник хуже на МАРЖУ; обводки почти нет — читать нечего */
  const bv=vs[0], rvV=vs[1], meanV=-2*bv.ll/Math.max(1,bv.n); let V=null, whyV='';
  if(obs.contrast<0.15) whyV='стороны не обведены (или обводка не видна) — видимость прочитать нельзя';
  else if(meanV>4||bv.worst>20||bv.dis>0) whyV='обводка сторон не совпадает ни с одним известным вариантом видимости'+(bv.worst>20||bv.dis>0?' (участок обведён не так, как в ближайшем варианте)':'');
  else if(rvV&&bv.ll-rvV.ll<MARGIN) whyV='не уверен в видимости: «'+C.VOPT[bv.v].what+'» или «'+C.VOPT[rvV.v].what+'»';
  else V=bv;
  res.extraInfo=bp.extra.map(i=>{ const g=strong[i]; return g.a.map(v=>v.toFixed(1))+'→'+g.b.map(v=>v.toFixed(1))+' '+g.len.toFixed(1)+'мм'; }); res.bestH=bp.pid+'/'+bv.v;
  if(!P&&!V){ res.reason=whyP+'; '+whyV; res.unknown=/не узнаю/.test(whyP); return res; }
  if(!P){ res.reason=whyP+(V?' (видимость: '+C.VOPT[V.v].what+')':''); res.unknown=/не узнаю/.test(whyP); return res; }
  const v=verdict46(C,P,V,G,given,obs,whyV); res.ok=true; res.partial=!V; res.verdict=v; res.marks=v.marks; res.scene=sceneOf(SH,ln,P,strong); return res; }
function verdict46(C,f,V,G,given,obs,whyV){ const Pp=C.POPT[f.pid], Vv=V?C.VOPT[V.v]:null, parts=[], E=f.E, marks=[];
  if(!Pp.ok) parts.push({what:Pp.what,why:Pp.why}); if(Vv&&!Vv.ok) parts.push({what:Vv.what,why:Vv.why});
  (Pp.mark||[]).forEach(id=>{ if(Array.isArray(E[id])) marks.push({at:E[id],id,kind:'bad'}); });
  if(!Pp.ok){ const okE=cp.exec(C.program('ok','ok'),given).E; ['5′','5″','6′','6″'].forEach(n=>marks.push({at:okE[n],id:n,kind:'should'})); }
  /* отметки видимости: участки, где узор студента отличается от верного */
  if(V&&!Vv.ok){ const pv=C.pattern(G,V.v), po=C.pattern(G,'ok'), g=C.given(G); Object.keys(po).forEach(k=>{ const a=g[k[0]+k[2]], b=g[k[1]+k[2]];
    po[k].forEach(([t0,t1,kk])=>{ const m=(t0+t1)/2, kv=(pv[k].find(x=>m>=x[0]&&m<=x[1])||[])[2]; if(kv&&kv!==kk) marks.push({at:v2.lerp(a,b,m),id:k,kind:'bad'}); }); }); }
  const cls=(Pp.ok?'':f.pid)+(V?(Vv.ok?'':(Pp.ok?'':'+')+V.v):(Pp.ok?'ok':'')+'+v?');
  const tr=C.truth(G), K5=E['5″']&&E['5′']?point3(E['5″'],E['5′']):null, K6=E['6″']&&E['6′']?point3(E['6″'],E['6′']):null;
  const scene3d={tri:[['A','B','C'],['D','E','F']].map(T=>T.map(n=>tr.P[n])),p5:K5&&K5.P,p6:K6&&K6.P,t5:tr['5'],t6:tr['6']};
  const okAll=Pp.ok&&V&&Vv.ok;
  return {cls:cls||'ok',partial:!V,ok:okAll,title:okAll?'Верно':(parts.length?parts.map(p=>p.what).join('; '):'Точки 5, 6 построены верно')+(V?'':'. Видимость: '+whyV),parts,
    note:'Точки: '+Pp.what+(V?'; видимость: '+Vv.what:''),points:{'5′':E['5′'],'5″':E['5″'],'6′':E['6′'],'6″':E['6″']},twins:[],marks,scene3d}; }

put('interpret',{interpret,fitProgram,separation,HAND});
})();
