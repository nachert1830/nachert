/* ═══════════ ДЗ №2: проверка ответа по фото — параметры построения студента, а не сличение картинок ═══════════
   Ответ ДЗ №2 — тело, у которого несколько степеней свободы задаёт студент своим построением:
     2а  S = E + t·(F − E)                       — один параметр t (высота = расстояние S до ABC);
     2б  A = E + t·(F − E), A₁ = A + s·n          — t (равнобедренность), s (высота);
     2в  B = E + t·(F − E), D = A + s·e_AK, A₁ = A + u·n — t (AB ⟂ AK), s (|AD|), u (высота).
   По калиброванному листу (lab/dz/calib.js) параметры студента находятся перебором: при каком t (s, u) рёбра тела
   лучше всего лежат на линиях листа (доля точек рёбер в 0,6 мм от линии). Так не важно, каким способом студент
   строил (через β ∥ ABC, через перпендикуляр и прямоугольный треугольник, …): важно, где его тело.
   Вердикт — по условиям задачи на теле студента (высота, AB = AC, ∠BAD, |AD| = |AB| …), допуск «Сверь свой лист»:
   1,5 мм / 1,5° — верно; ≥ 3 и тело студента читается уверенно, а верного тела на листе нет — ошибка, с числами
   (высота у вас 70 мм…); между — «не могу утверждать». Видимость рёбер — по разрывам линии вдоль ребра.
   check2(dig, loc, cal, id, data) → {verdict, why[], found:{…}, edges:[…]} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const DZ=isNode?require('../../core/dz.js'):self.CORE.dz, M=isNode?require('./model.js'):self.LAB.dzModel, C=isNode?require('./calib.js'):self.LAB.dzCalib;
const {v3}=DZ, TOL=1.5, BAD=3;
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');
/* покрытие отрезка чертежа (мм от O) линиями листа: доля точек (через 0,5 мм, без 2 мм у концов) в 0,6 мм от линии */
function segCover(D,T,a,b){ const L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<5) return null; let k=0, n=0;
  for(let s=2;s<=L-2;s+=0.5){ const p=[a[0]+(b[0]-a[0])*s/L,a[1]+(b[1]-a[1])*s/L]; n++; if(C.at(D,C.apply(T,p))<=0.6) k++; } return {c:k/n,L}; }
/* покрытие рёбер только вдали (> ex мм) от других линий; null — таких мест меньше 20 */
function coverExcl(D,T,segs,others,ex){ const dS=(p,q,r)=>{ const dx=r[0]-q[0], dy=r[1]-q[1], l2=dx*dx+dy*dy||1e-9, t=Math.max(0,Math.min(1,((p[0]-q[0])*dx+(p[1]-q[1])*dy)/l2)); return Math.hypot(p[0]-q[0]-t*dx,p[1]-q[1]-t*dy); };
  let k=0, n=0; segs.forEach(([a,b])=>{ const L=Math.hypot(b[0]-a[0],b[1]-a[1]); for(let s=2;s<=L-2;s+=0.5){ const p=[a[0]+(b[0]-a[0])*s/L,a[1]+(b[1]-a[1])*s/L]; if(others.some(([q,r])=>dS(p,q,r)<=ex)) continue; n++; if(C.at(D,C.apply(T,p))<=0.6) k++; } });
  return n>=20?k/n:null; }
/* покрытие набора рёбер (взвешено длиной) */
function cover(D,T,segs){ let s=0, w=0; segs.forEach(([a,b])=>{ const r=segCover(D,T,a,b); if(r){ s+=r.c*r.L; w+=r.L; } }); return w?s/w:0; }
/* рёбра тела, кроме заданных (они начерчены по условию — не довод), в проекциях */
function answerSegs(id,data,sol,which,pr){ const S=M.solid(id,sol,data), out=[];
  S.edges.forEach(e=>{ if(data[e.a]&&data[e.b]) return; if(which&&!which.includes(e.a+e.b)&&!which.includes(e.b+e.a)) return;
    [['f',M.Fp],['h',M.Hp]].forEach(([p,P])=>{ if(pr&&pr!==p) return; out.push([P(S.V[e.a]),P(S.V[e.b]),e,p]); }); });
  return out; }
/* профиль покрытия по параметру: шаг — чтобы проекции сдвигались ≤ 0,3 мм */
function scan(D,T,make,segsOf,lo,hi,stepMm,speed){ const dt=stepMm/Math.max(1e-6,speed), prof=[];
  for(let t=lo;t<=hi;t+=dt){ const sol=make(t); if(!sol){ prof.push([t,0]); continue; } prof.push([t,cover(D,T,segsOf(sol))]); }
  let bi=0; prof.forEach((p,i)=>{ if(p[1]>prof[bi][1]) bi=i; }); const best=prof[bi]||[lo,0];
  /* острота пика: лучшее покрытие вне ±4 мм от пика */
  const away=prof.filter(p=>Math.abs(p[0]-best[0])*speed>4).reduce((m,p)=>Math.max(m,p[1]),0);
  return {t:best[0],c:best[1],away,prof}; }
/* сдвиг проекций вершин ответа: тело студента против верного, мм чертежа */
function disp(id,data,a,b){ const A=M.solid(id,a,data), B=M.solid(id,b,data); let m=0;
  Object.keys(A.V).forEach(k=>{ if(data[k]) return; const P=A.V[k], Q=B.V[k]; m=Math.max(m,Math.hypot(...v3.sub(M.Fp(P).concat(0),M.Fp(Q).concat(0))),Math.hypot(...v3.sub(M.Hp(P).concat(0),M.Hp(Q).concat(0)))); }); return m; }
const projSpeed=d=>Math.max(Math.hypot(d[0],d[2]),Math.hypot(d[0],d[1]));
/* тип линии вдоль ребра: разрывы штриховой. Профиль тёмности (карта ink, 8 px/мм) вдоль ребра через 0,1 мм — максимум
   поперёк ±0,4 мм вдоль следа настоящей линии; разрыв — участок ≥ 0,8 мм, где тёмность ниже трети типичной на линии. Штриховая даёт 1–2,5
   разрыва на 10 мм (штрих 2–8, промежуток 1–2 мм), сплошная — 0. Места у других линий модели (пересечения) не берём.
   → {gaps (на 10 мм), len (мм учтено)} или null */
function dashes(map,T,a,b,others){ const g=map.g, ppm=g.ppm||8, L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<12) return null;
  const dS=(p,q,r)=>{ const dx=r[0]-q[0], dy=r[1]-q[1], l2=dx*dx+dy*dy||1e-9, t=Math.max(0,Math.min(1,((p[0]-q[0])*dx+(p[1]-q[1])*dy)/l2)); return Math.hypot(p[0]-q[0]-t*dx,p[1]-q[1]-t*dy); };
  const u=[(b[0]-a[0])/L,(b[1]-a[1])/L], nn=[-u[1],u[0]], pr=[];
  const ink=(p,q)=>{ const P=C.apply(T,[p[0]+nn[0]*q,p[1]+nn[1]*q]), x=Math.round((P[0]-map.box[0])*ppm-0.5), y=Math.round((P[1]-map.box[1])*ppm-0.5); return x>=0&&y>=0&&x<g.w&&y<g.h?g.a[y*g.w+x]:0; };
  /* где идёт настоящая линия: по кускам 3 мм — сдвиг поперёк (±2 мм от модели) с наибольшей суммой тёмности
     (рука уводит линию от модели на 0,5–1,5 мм; профиль снимаем вдоль найденного следа, ±0,4 мм) */
  const off=[]; for(let s0=0.1*L;s0<0.9*L;s0+=3){ let bq=0, bv=-1; for(let q=-2;q<=2;q+=0.1){ let sum=0; for(let s=s0;s<Math.min(s0+3,0.9*L);s+=0.25) sum+=ink([a[0]+u[0]*s,a[1]+u[1]*s],q); if(sum>bv){ bv=sum; bq=q; } } off.push(bq); }
  for(let s=0.1*L;s<=0.9*L;s+=0.1){ const p=[a[0]+u[0]*s,a[1]+u[1]*s]; if(others.some(([q,r])=>dS(p,q,r)<1.2)){ pr.push(null); continue; } let m=0;
    const o0=off[Math.min(off.length-1,Math.floor((s-0.1*L)/3))]; for(let q=o0-0.4;q<=o0+0.4;q+=0.1){ const v=ink(p,q); if(v>m) m=v; }
    pr.push(m); }
  const vals=pr.filter(v=>v!=null).sort((x,y)=>x-y); if(vals.length<100) return null; const on=vals[Math.floor(vals.length*0.75)], th=on/3;
  if(on<0.05) return null;
  /* разрывы и их места; «провалы» — участки ≥ 0,4 мм ниже половины типичной тёмности (у сплошной их нет) */
  let gaps=0, run=0, used=0, dips=0, drun=0; const where=[], dwhere=[]; pr.forEach((v,i)=>{ if(v==null){ run=0; drun=0; return; } used++;
    if(v<th){ run++; if(run===8){ gaps++; where.push(i/pr.length); } } else run=0;
    if(v<on/2){ drun++; if(drun===4){ dips++; dwhere.push(i/pr.length); } } else drun=0; });
  const bins=new Set(dwhere.map(t=>Math.min(4,Math.floor(t*5)))).size;
  return {gaps:gaps/(used*0.1)*10,n:gaps,bins,dips,len:used*0.1}; }
/* тип линии. Промежутки штриховой у руки бывают и короче 0,8 мм — поэтому главный признак — «провалы» (≥ 0,4 мм ниже
   половины тёмности линии): у штриховой их ≥ 5 и ≥ 0,12 на мм, по всей длине (≥ 3 пятых ребра); у сплошной — ни
   одного разрыва и не больше 0,07 провала на мм (зерно карандаша). Между — не берусь. Пороги — по замеру на листах
   lab/dz/vsynth.js: видимые ≤ 0,064 провала на мм, невидимые ≥ 0,14 (кроме коротких рёбер с 2–3 штрихами). */
const lineType=ds=>!ds?'?':ds.dips>=5&&ds.dips/ds.len>=0.12&&ds.bins>=3?'hid':ds.n===0&&ds.dips<=Math.max(1,0.07*ds.len)?'vis':'?';
/* семейства решений по задаче. Высота и ребро меньше 15–20 мм не ищутся: верх тела тогда ложится на основание
   и «покрывается» линиями условия — вырожденный ответ */
function family(id,data,r){
  if(id==='2'){ const d=v3.sub(data.F,data.E), pl=DZ.plane(data.A,data.B,data.C), mk=t=>({S:v3.add(data.E,v3.mul(d,t)),t});
    return {stages:[{name:'t',make:mk,speed:projSpeed(d),lo:-12,hi:12}],
      cond:s=>{ const h=Math.abs(pl.sd(s.S)); return [{dev:Math.abs(h-80),msg:'высота пирамиды у вас '+f1(h)+' мм, а по условию 80 мм'}]; }}; }
  if(id==='2b'){ const d=v3.sub(data.F,data.E);
    const mkA=t=>{ const A=v3.add(data.E,v3.mul(d,t)), pl=DZ.plane(A,data.B,data.C); if(!Number.isFinite(pl.n[0])) return null; return {A,t,n:pl.n,A1:A,B1:data.B,C1:data.C,flat:true}; };
    return {stages:[{name:'t',make:mkA,speed:projSpeed(d),lo:-12,hi:12,which:['AB','AC']},
      {name:'s',from:'t',make:(s,base)=>{ if(Math.abs(s)<20) return null; const sh=v3.mul(base.n,s); return Object.assign({},base,{s,A1:v3.add(base.A,sh),B1:v3.add(data.B,sh),C1:v3.add(data.C,sh),flat:false}); },speed:1,lo:-160,hi:160,which:['A₁B₁','B₁C₁','C₁A₁','AA₁','BB₁','CC₁']}],
      cond:s=>{ const ab=v3.dist(s.A,data.B), ac=v3.dist(s.A,data.C), h=v3.dist(s.A,s.A1);
        return [{dev:Math.abs(ab-ac),msg:'основание не равнобедренное: AB = '+f1(ab)+' мм, AC = '+f1(ac)+' мм — A найдена неверно'},{dev:Math.abs(h-70),msg:'высота призмы у вас '+f1(h)+' мм, а по условию 70 мм'}]; }}; }
  if(id==='2c'){ const d=v3.sub(data.F,data.E), w=v3.unit(v3.sub(data.K,data.A));
    const mkB=t=>{ const B=v3.add(data.E,v3.mul(d,t)); return {B,t,D:data.A,C:B,A1:data.A,B1:B,C1:B,D1:data.A}; };
    return {stages:[{name:'t',make:mkB,speed:projSpeed(d),lo:-12,hi:12,which:['AB']},
      {name:'s',from:'t',make:(s,b)=>{ if(Math.abs(s)<15) return null; const D=v3.add(data.A,v3.mul(w,s)), C=v3.add(b.B,v3.sub(D,data.A)); return Object.assign({},b,{s,D,C,A1:data.A,B1:b.B,C1:C,D1:D}); },speed:projSpeed(w),lo:-200,hi:200,which:['BC','CD']},
      {name:'u',from:'s',make:(u,b)=>{ if(Math.abs(u)<15) return null; let n=v3.unit(v3.cross(v3.sub(b.B,data.A),v3.sub(b.D,data.A))); if(!Number.isFinite(n[0])) return null; if(n[2]<0) n=v3.mul(n,-1); const sh=v3.mul(n,u);
        return Object.assign({},b,{u,A1:v3.add(data.A,sh),B1:v3.add(b.B,sh),C1:v3.add(b.C,sh),D1:v3.add(b.D,sh)}); },speed:1,lo:-200,hi:200,which:['A₁B₁','B₁C₁','C₁D₁','D₁A₁','AA₁','BB₁','CC₁','DD₁']}],
      cond:s=>{ const out=[], a=v3.dist(data.A,s.B), g=Math.acos(v3.dot(v3.unit(v3.sub(s.B,data.A)),w))*180/Math.PI, ad=v3.dist(data.A,s.D), h=v3.dist(data.A,s.A1);
        out.push({dev:Math.abs(g-90),msg:'угол BAD у вас '+f1(g)+'°, а у куба 90° — B найдена неверно'});
        out.push({dev:Math.abs(ad-a),msg:'|AD| = '+f1(ad)+' мм, а |AB| = '+f1(a)+' мм — рёбра куба не равны'});
        out.push({dev:Math.abs(h-a),msg:'высота у вас '+f1(h)+' мм, а ребро куба '+f1(a)+' мм'}); return out; }}; }
  return null; }
const MAIN=(id,r)=>id==='2'?(r.sol.find(s=>s.inSeg)||r.sol[0]):id==='2b'?r.sol[0]:r.sol.find(s=>s.toK&&s.side==='над');
function check2(dig,loc,cal,id,data){ const why=[], D=C.dmap(dig.map), T=cal.T, r=DZ.solve(id,data); if(!r.ok) return {verdict:'не могу проверить',why:[r.why]};
  const fam=family(id,data,r); let cur=null; const found={}, steps=[];
  for(const st of fam.stages){ const base=cur, make=x=>st.make(x,base), segsOf=sol=>answerSegs(id,data,sol,st.which).map(s=>[s[0],s[1]]);
    /* для 2а — по проекциям отдельно (S″ и S′ могут быть не на одной линии связи) и вместе */
    const sc=scan(D,T,make,segsOf,st.lo,st.hi,0.3,st.speed);
    steps.push({name:st.name,t:sc.t,c:sc.c,away:sc.away}); found[st.name]=sc.t;
    if(id==='2'){ ['f','h'].forEach(pr=>{ const s2=scan(D,T,make,sol=>answerSegs(id,data,sol,null,pr).map(s=>[s[0],s[1]]),st.lo,st.hi,0.3,st.speed); found['t_'+pr]=s2; }); }
    cur=make(sc.t); if(!cur) return {verdict:'не могу проверить',why:['тело ответа не строится'],steps}; }
  const last=steps[steps.length-1], weak=steps.find(s=>s.c<0.6);
  /* ответа нет или не читается */
  if(weak){ const none=steps.every(s=>s.c<0.35);
    /* «нет ответа» — не уверенный вердикт: бледный ответ тоже не находится. Говорим, что не нашли */
    return {verdict:'ответ не найден',why:['не нашёл на листе тела ответа: лучшее положение объясняет '+Math.round(weak.c*100)+' % длины его рёбер (нужно ≥ 60 %). Если ответ начерчен — переснимите ближе или обведите рёбра'],steps,found}; }
  /* 2а: S″ и S′ — на одной линии связи? */
  if(id==='2'){ const d=v3.sub(data.F,data.E), F=found.t_f, Hh=found.t_h;
    if(F.c>=0.6&&Hh.c>=0.6){ const du=Math.abs(F.t-Hh.t)*Math.abs(d[0]);
      /* по отдельности каждая проекция объясняется полностью, а общим t (одна точка S) — заметно хуже */
      const joint=steps[0].c, split=F.c>=0.85&&Hh.c>=0.85&&joint<=Math.min(F.c,Hh.c)-0.15;
      if(du>=BAD&&((F.c-F.away>=0.2&&Hh.c-Hh.away>=0.2)||split)) return {verdict:'ошибка',why:['S″ и S′ не на одной линии связи: расходятся на '+f1(du)+' мм по оси x'],steps,found}; } }
  const sharp=steps.every(s=>s.c-s.away>=0.2);
  const dMain=disp(id,data,cur,MAIN(id,r)), others=r.sol.filter(s=>s!==MAIN(id,r)), dAlt=Math.min(...others.map(s=>disp(id,data,cur,s)));
  /* верного тела на листе нет? Считаем только там, где его рёбра дальше 1,2 мм от рёбер студента и заданного
     (у вершин условия рёбра обоих тел сходятся — там покрытие ничего не говорит) */
  const near=answerSegs(id,data,cur).map(s=>[s[0],s[1]]).concat(M.given(id,data).segs.map(s=>[s.a,s.b]));
  const covMain=coverExcl(D,T,answerSegs(id,data,MAIN(id,r)).map(s=>[s[0],s[1]]),near,1.2);
  /* и отношение правдоподобий: тело студента объясняет линии листа заметно лучше верного */
  const cStud=cover(D,T,answerSegs(id,data,cur).map(s=>[s[0],s[1]])), cMain=cover(D,T,answerSegs(id,data,MAIN(id,r)).map(s=>[s[0],s[1]]));
  /* вердикт — по условиям задачи, как «Сверь свой лист» (допуск 1,5 мм и 1,5°): все в допуске — решение;
     какое (то, что берут в варианте, или второе) — по близости тела; хоть одно условие нарушено на ≥ 3 — ошибка,
     если тело студента читается уверенно и верного тела на листе нет; иначе — не утверждаем */
  let verdict; const cond=fam.cond(cur), worst=cond.reduce((m,c)=>c.dev>m.dev?c:m,{dev:0,msg:''});
  if(worst.dev<=TOL){ if(dMain<=dAlt) verdict='верно'; else { verdict='другое решение'; why.push(id==='2'?'это второе решение: S по другую сторону основания, на продолжении EF':'тело построено в другую сторону от основания — тоже решение, но в варианте обычно берут другое'); } }
  else if(worst.dev>=BAD&&sharp&&covMain!=null&&covMain<0.4&&cStud-cMain>=0.2){ verdict='ошибка'; why.push(...cond.filter(c=>c.dev>TOL).map(c=>c.msg)); }
  else { verdict='не могу утверждать'; why.push(worst.msg+' — отклонение '+f1(worst.dev)+(id==='2c'&&/угол/.test(worst.msg)?'°':' мм')+': на грани допуска или линии читаются неоднозначно'); }
  /* видимость рёбер — только для верного (или второго) решения */
  const edges=[];
  if(verdict==='верно'||verdict==='другое решение'){ const S=M.solid(id,cur,data), all=answerSegs(id,data,cur).concat(M.given(id,data).segs.map(s=>[s.a,s.b]));
    S.edges.forEach(e=>{ [['f',M.Fp,'″'],['h',M.Hp,'′']].forEach(([pr,P,mk])=>{ if(e[pr]==='?') return; const a=P(S.V[e.a]), b=P(S.V[e.b]);
      const oth=all.filter(s=>!(Math.hypot(s[0][0]-a[0],s[0][1]-a[1])<1e-6&&Math.hypot(s[1][0]-b[0],s[1][1]-b[1])<1e-6)&&!(Math.hypot(s[0][0]-b[0],s[0][1]-b[1])<1e-6&&Math.hypot(s[1][0]-a[0],s[1][1]-a[1])<1e-6)).map(s=>[s[0],s[1]]);
      const ds=dashes(dig.map,T,a,b,oth); let got=lineType(ds);
      /* ребро на линии условия (AD на AK у куба): тип не измерить — видимое закрыто сплошной линией условия, а
         невидимое не отличить; видимое считаем выполненным, невидимое — непрочитанным */
      if(!ds){ const g=M.given(id,data).segs.filter(q=>q.pr===pr), on=g.some(q=>{ const L=Math.hypot(q.b[0]-q.a[0],q.b[1]-q.a[1]), d=p=>Math.abs((p[0]-q.a[0])*(q.b[1]-q.a[1])-(p[1]-q.a[1])*(q.b[0]-q.a[0]))/L; return d(a)<1&&d(b)<1; });
        got=on&&e[pr]==='vis'?'vis':'?'; }
      edges.push({e:e.a+e.b+mk,want:e[pr],fill:ds?ds.gaps:null,got,onGiven:!ds&&got==='?'}); }); });
    const badV=edges.filter(x=>x.got!=='?'&&x.got!==x.want), unk=edges.filter(x=>x.got==='?');
    if(badV.length){ if(verdict==='верно') verdict='ошибка'; why.push(...badV.map(x=>'ребро '+x.e+' должно быть '+(x.want==='vis'?'сплошным (видимым)':'штриховым (невидимым)'))); }
    /* «верно» — только если прочитан тип линии каждого ребра: непрочитанное могло быть неверным */
    else if(unk.length&&verdict==='верно'){ verdict='не могу утверждать'; const og=unk.filter(x=>x.onGiven), rd=unk.filter(x=>!x.onGiven);
      why.push('тело построено верно'+(rd.length?'; не прочитал тип линии (сплошная / штриховая) у рёбер '+rd.map(x=>x.e).join(', ')+' — проверьте их сами или переснимите':'')+(og.length?'; ребро '+og.map(x=>x.e).join(', ')+' лежит на прямой условия — сплошное оно или штриховое, по фото не различить: проверьте сами':'')); } }
  return {verdict,why,steps,found,dMain,dAlt,covMain,cStud,cMain,edges,cur}; }
put('dzCheck2',{check2,family,segCover,cover,dashes,lineType});
})();
