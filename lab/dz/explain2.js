/* ═══════════ ДЗ №2а: на каком шаге построения ошибка — разбор по вспомогательным линиям листа ═══════════
   Вердикт («высота 76 мм вместо 80») говорит, ЧТО неверно; этот разбор — ГДЕ. Способ решения (prog2a.js, разбор сайта):
     1. перпендикуляр n к плоскости ABC: n″ ⟂ f″, n′ ⟂ h′;
     2. на n от точки P плоскости — отрезок PR = 80 мм (натуральная величина);
     3. плоскость β ∋ R, β ∥ ABC и её линия пересечения с посредником γ ⊃ EF — след; он встречает E″F″ в точке S_R;
     4. вершина S = след ∩ EF.
   Каждый шаг меряется по линиям листа и сверяется со СВОИМ предыдущим шагом студента («честно от неверного»): шаг 3 —
   с точкой R, которую студент построил сам, а не с верной. Так находится первый неверный шаг, а не только следствие.
   Принципы — те же, что у вердикта: шаг «неверно» — только при отклонении ≥ BAD и однозначной находке линий; не нашли
   или неоднозначно — «?»; пограничное — «?». Свободных подгонок к проверяемым элементам нет: линии ищутся по
   направлениям условия (n ⟂ ABC), точки — по сходящимся концам отрезков (так их строят циркулем и линейкой).
   explain2(segs, data, cur) → {steps:[{k, name, status:'ok'|'bad'|'?', msg, val}], first, pts}
     segs — отрезки листа в мм чертежа (calib.drawSegs), cur — ответ студента, найденный check2 (cur.S). */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const DZ=isNode?require('../../core/dz.js'):self.CORE.dz, M=isNode?require('./model.js'):self.LAB.dzModel, {v3}=DZ;
const TOL=1.5, BAD=3, ATOL=1.5, ABAD=3, WIN=15, JT=1.2;
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');
const v2={sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],add:(a,b)=>[a[0]+b[0],a[1]+b[1]],mul:(a,k)=>[a[0]*k,a[1]*k],dot:(a,b)=>a[0]*b[0]+a[1]*b[1],len:a=>Math.hypot(a[0],a[1]),cr:(a,b)=>a[0]*b[1]-a[1]*b[0]};
v2.unit=a=>{ const l=v2.len(a)||1; return [a[0]/l,a[1]/l]; }; v2.dist=(a,b)=>v2.len(v2.sub(a,b));
const Fp=P=>[-P[0],-P[2]], Hp=P=>[-P[0],P[1]], lift3=(f,h)=>[-(f[0]+h[0])/2,h[1],-f[1]];
const ang=(e,f)=>Math.acos(Math.min(1,Math.abs(v2.dot(v2.unit(e),v2.unit(f)))))*180/Math.PI;
const dLine=(p,q,e)=>Math.abs(v2.cr(v2.sub(p,q),e));
const dirOf=s=>v2.unit(v2.sub(s.b,s.a)), lenOf=s=>v2.dist(s.a,s.b);
const VERT=[0,1];
/* отрезок лежит на отрезке ab (линия условия или ребро ответа) */
function onSeg(s,a,b,tol){ const L=v2.dist(a,b); if(L<1) return false; const e=v2.unit(v2.sub(b,a)); if(ang(dirOf(s),e)>4) return false;
  if(Math.max(dLine(s.a,a,e),dLine(s.b,a,e))>tol) return false; const t1=v2.dot(v2.sub(s.a,a),e), t2=v2.dot(v2.sub(s.b,a),e); return Math.max(t1,t2)>-2&&Math.min(t1,t2)<L+2; }
/* коллинеарные отрезки → прямые (направление — по взвешенным концам) */
function lines(segs){ const out=[]; segs.slice().sort((p,q)=>lenOf(q)-lenOf(p)).forEach(s=>{ const e=dirOf(s);
    const l=out.find(l=>ang(l.e,e)<2.5&&dLine(s.a,l.p,l.e)<1.0&&dLine(s.b,l.p,l.e)<1.0);
    if(l){ l.segs.push(s); l.L+=lenOf(s); } else out.push({p:s.a,e,segs:[s],L:lenOf(s)}); });
  out.forEach(l=>{ const t=l.segs.flatMap(s=>[s.a,s.b]).map(p=>v2.dot(v2.sub(p,l.p),l.e)); l.t0=Math.min(...t); l.t1=Math.max(...t);
    l.u0=Math.min(l.p[0]+l.e[0]*l.t0,l.p[0]+l.e[0]*l.t1); l.u1=Math.max(l.p[0]+l.e[0]*l.t0,l.p[0]+l.e[0]*l.t1); });
  return out; }
const atU=(l,u)=>{ const t=(u-l.p[0])/l.e[0]; return [u,l.p[1]+l.e[1]*t]; };
/* точки прямой, где сходятся концы других отрезков (так отмечают построенную точку): кластеры по t */
function junctions(l,segs,o){ o=o||{}; const hits=[];
  segs.forEach(s=>{ if(l.segs&&l.segs.includes(s)) return; const L=lenOf(s); if(L<7) return; const e=dirOf(s);
    /* почти параллельный l отрезок места на ней не задаёт (конец может быть где угодно вдоль), короткие — штрихи подписей */
    if(ang(e,l.e)<20) return; if(o.noVert&&ang(e,VERT)<3) return;
    /* точка — пересечение прямой отрезка с прямой l (конец отрезка от руки не доходит или заходит за неё); под малым углом — проекция конца */
    const cut=p=>{ const d=v2.cr(e,l.e), k=v2.cr(v2.sub(l.p,s.a),l.e)/d; return v2.dot(v2.sub(v2.add(s.a,v2.mul(e,k)),l.p),l.e); };
    /* σ — погрешность положения точки вдоль l: пересечение — 0,4 мм поперёк отрезка / sin угла; проекция конца — 1 мм */
    const a=ang(e,l.e), sg=0.4/Math.max(0.2,Math.sin(a*Math.PI/180));
    [s.a,s.b].forEach(p=>{ if(dLine(p,l.p,l.e)<=JT) hits.push({t:cut(p),s,w:1,sg}); });
    /* прямая насквозь (след ℓ″ через E″F″): пересечение внутри отрезка */
    if(o.cross){ const d=v2.cr(e,l.e); if(Math.abs(d)>1e-6){ const w=v2.sub(l.p,s.a), k=v2.cr(w,l.e)/d; if(k>3&&k<L-3) hits.push({t:v2.dot(v2.sub(v2.add(s.a,v2.mul(e,k)),l.p),l.e),s,w:1}); } } });
  hits.sort((a,b)=>a.t-b.t); const cl=[];
  hits.forEach(h=>{ const c=cl[cl.length-1]; if(c&&h.t-c.tl<=1.5){ c.h.push(h); c.tl=h.t; } else cl.push({h:[h],tl:h.t}); });
  return cl.map(c=>{ const segsU=[...new Set(c.h.map(h=>h.s))], t=c.h.reduce((m,h)=>m+h.t,0)/c.h.length; return {t,pt:v2.add(l.p,v2.mul(l.e,t)),n:segsU.length,segs:segsU,h:c.h}; }); }
/* прямая по отрезкам (главная ось точек вдоль них, вес — длина) */
function fit(ss){ if(!ss.length) return null; const P=[]; ss.forEach(s=>{ const L=lenOf(s); for(let k=0;k<=L;k+=1) P.push(v2.add(s.a,v2.mul(dirOf(s),k))); }); if(P.length<4) return null;
  const c=P.reduce((m,p)=>v2.add(m,v2.mul(p,1/P.length)),[0,0]); let xx=0,xy=0,yy=0; P.forEach(p=>{ const d=v2.sub(p,c); xx+=d[0]*d[0]; xy+=d[0]*d[1]; yy+=d[1]*d[1]; });
  const a=0.5*Math.atan2(2*xy,xx-yy); return {p:c,e:[Math.cos(a),Math.sin(a)]}; }
const st=(dev,tol,bad)=>dev<=tol?'ok':dev>=bad?'bad':'?';

function explain2(segs,data,cur){ const {A,B,C,E,F}=data, pl=DZ.plane(A,B,C), n=pl.n, nup=n[2]>=0?n:v3.mul(n,-1), steps=[], pts={};
  /* известные линии: условие и рёбра ответа студента — не построения */
  const known=M.given('2',data).segs.map(s=>[s.a,s.b]);
  if(cur&&cur.S){ const S=cur.S; ['A','B','C'].forEach(k=>{ known.push([Fp(S),Fp(data[k])],[Hp(S),Hp(data[k])]); }); }
  const free=segs.filter(s=>lenOf(s)>=3&&!known.some(([a,b])=>onSeg(s,a,b,1.0)));
  const inF=s=>s.a[1]<0.5&&s.b[1]<0.5, inH=s=>s.a[1]>-0.5&&s.b[1]>-0.5;
  /* ── шаг 1: перпендикуляр n ── */
  const eF=v2.unit([-nup[0],-nup[2]]), eH=v2.unit([-nup[0],nup[1]]), fF=[-nup[2],nup[0]], hH=[nup[1],nup[0]];
  const LF=lines(free.filter(inF)).filter(l=>l.L>=15&&ang(l.e,eF)<=WIN&&Math.abs(l.e[0])>0.1), LH=lines(free.filter(inH)).filter(l=>l.L>=15&&ang(l.e,eH)<=WIN&&Math.abs(l.e[0])>0.1);
  const pairs=[];
  LF.forEach(lf=>LH.forEach(lh=>{ const ov=Math.min(lf.u1,lh.u1)-Math.max(lf.u0,lh.u0); if(ov<8) return;
    /* прямая в пространстве по двум проекциям: X(u) = (−u, v′(u), −v″(u)); где она встречает ABC */
    const X=u=>{ const f=atU(lf,u), h=atU(lh,u); return [-u,h[1],-f[1]]; }, s0=pl.sd(X(0)), s1=pl.sd(X(1)); if(Math.abs(s1-s0)<1e-9) return;
    const uP=-s0/(s1-s0), lo=Math.max(lf.u0,lh.u0)-10, hi=Math.min(lf.u1,lh.u1)+10; if(uP<lo||uP>hi) return;
    const d3=v3.unit(v3.sub(X(uP+1),X(uP))), a3=Math.acos(Math.min(1,Math.abs(v3.dot(d3,nup))))*180/Math.PI;
    /* перпендикуляр строят ИЗ точки плоскости: обе проекции начинаются в основании P */
    const fromP=Math.min(Math.abs(lf.u0-uP),Math.abs(lf.u1-uP))<=2.5&&Math.min(Math.abs(lh.u0-uP),Math.abs(lh.u1-uP))<=2.5;
    pairs.push({lf,lh,uP,P:X(uP),X,a3,dF:ang(lf.e,eF),dH:ang(lh.e,eH),score:lf.L+lh.L,fromP}); }));
  pairs.sort((a,b)=>b.fromP-a.fromP||b.score-a.score); if(pairs[0]&&pairs[0].fromP) pairs.splice(0,pairs.length,...pairs.filter(p=>p.fromP));
  const N=pairs[0], amb=N&&pairs.slice(1).some(p=>p.score>=0.7*N.score&&Math.abs(p.a3-N.a3)>1.5);
  if(!N||amb) steps.push({k:'n',name:'перпендикуляр n к ABC',status:'?',msg:N?'на листе несколько линий, похожих на перпендикуляр, — какую строили, не различить':'перпендикуляр к ABC на листе не найден (нет пары n″, n′ около нужных направлений)'});
  else { const dev=Math.max(N.dF,N.dH), s=st(dev,ATOL,ABAD); let msg;
    if(s==='ok') msg='n″ ⟂ f″ и n′ ⟂ h′ (отклонение '+f1(N.dF)+'° и '+f1(N.dH)+'°)';
    else { const bad=[]; if(N.dF>=ABAD) bad.push('n″ не перпендикулярна фронтали f″: угол '+f1(90-N.dF)+'° вместо 90°'); if(N.dH>=ABAD) bad.push('n′ не перпендикулярна горизонтали h′: угол '+f1(90-N.dH)+'° вместо 90°');
      msg=bad.length?bad.join('; ')+' — прямая n не перпендикулярна ABC (на '+f1(N.a3)+'° в пространстве)':'отклонение '+f1(N.dF)+'° и '+f1(N.dH)+'° — на границе точности'; }
    steps.push({k:'n',name:'перпендикуляр n к ABC',status:s,msg,val:{dF:N.dF,dH:N.dH,a3:N.a3}}); pts.P=N.P; pts.nF=N.lf; pts.nH=N.lh; }
  /* ── шаг 2: R на n, |PR| = 80 ── */
  let R=null;
  if(N){ const jF=junctions(N.lf,free), jH=junctions(N.lh,free), cand=[];
    /* R — точка, ОТ которой строят β: в обеих проекциях из неё выходит не только линия связи (у вспомогательной
       точки натуральной величины во π₂ обычно одна линия связи) */
    const nv=j=>j.segs.filter(s=>ang(dirOf(s),VERT)>3).length;
    /* кандидаты — по линии связи: R″ и R′ на одной вертикали, поэтому сходящиеся отрезки считаем в полосе ±2 мм по u
       в обеих проекциях (пересечения под малым углом к n разбрасывают кластеры вдоль прямой) */
    [...jF,...jH].forEach(j=>{ const u=j.pt[0]; if(Math.abs(u-N.uP)<5) return; const fF=jF.filter(x=>Math.abs(x.pt[0]-u)<=2), fH=jH.filter(x=>Math.abs(x.pt[0]-u)<=2);
      if(!fF.length||!fH.length||!fF.some(nv)||!fH.some(nv)) return; const segsF=new Set(fF.flatMap(x=>x.segs)), segsH=new Set(fH.flatMap(x=>x.segs));
      const W=[...fF,...fH], uu=W.reduce((m,x)=>m+x.pt[0]*x.n,0)/W.reduce((m,x)=>m+x.n,0); cand.push({u:uu,sc:segsF.size+segsH.size}); });
    cand.sort((p,q)=>q.sc-p.sc);
    const c=cand[0], rival=c&&cand.find(x=>Math.abs(x.u-c.u)>3&&x.sc===c.sc);
    /* R = X(u): точка 3D-прямой n задаётся одним числом u. Каждый сходящийся отрезок (в π₂ и π₁) — своя оценка u с
       погрешностью σ·|e_u|; итог — взвешенное среднее, его σ переходит в σ длины |PR|. Оценки, не согласные между
       собой, — «?»: какая из точек R, не различить */
    /* где R на каждой проекции: вдоль n″ — по отрезкам, сходящимся к n″ (σ = 0,4 мм / sin угла), то же на n′; выбросы —
       от медианы (одна чужая линия у R не должна тянуть среднее). Если в проекции оценок нет — по линии связи из другой
       (σ_u / |cos| — для крутой проекции такая оценка слабая, и это честно входит в σ). Положение по u и 3D-прямой X(u)
       не берём: при крутой проекции малая ошибка её направления даёт миллиметры по высоте */
    const loc=(J,l)=>{ const H=[]; J.filter(x=>Math.abs(x.pt[0]-c.u)<=2.5).forEach(x=>x.h.forEach(h=>H.push({t:h.t,sg:Math.max(0.3,h.sg)}))); if(!H.length) return null;
      const med=H.map(h=>h.t).sort((a,b)=>a-b)[H.length>>1], win=H.filter(h=>Math.abs(h.t-med)<=Math.max(3*h.sg,1.5)), w=H.reduce((m,h)=>m+1/h.sg**2,0), ww=win.reduce((m,h)=>m+1/h.sg**2,0);
      if(ww<w*2/3) return {bad:true}; return {t:win.reduce((m,h)=>m+h.t/h.sg**2,0)/ww,sg:1/Math.sqrt(ww),n:win.length}; };
    let eF=c&&c.sc>=3&&!rival?loc(jF,N.lf):null, eH=c&&c.sc>=3&&!rival?loc(jH,N.lh):null, est=null;
    if(eF&&!eF.bad&&eH&&!eH.bad&&eF.n+eH.n>=2){ const pF=v2.add(N.lf.p,v2.mul(N.lf.e,eF.t)), pH=v2.add(N.lh.p,v2.mul(N.lh.e,eH.t)), su=Math.hypot(eF.sg*Math.abs(N.lf.e[0]),eH.sg*Math.abs(N.lh.e[0]));
      /* R″ и R′ — на одной линии связи */
      if(Math.abs(pF[0]-pH[0])<=1.5+2*su) est={pF,pH,sg:Math.hypot(eF.sg,eH.sg)}; }
    if(!est) steps.push({k:'R',name:'отрезок PR = 80 мм на n',status:'?',msg:!c?'точка R на перпендикуляре не найдена':c.sc<3||rival?'на перпендикуляре несколько построенных точек — какая R, не различить':'линии, сходящиеся в R, не согласуются между собой — положение R не измерить'});
    else { R=lift3(est.pF,est.pH); pts.RF=est.pF; pts.RH=est.pH; const P=N.P, Ln=v3.dist(P,R), LhP=v2.dist(Hp(P),Hp(R)), LfP=v2.dist(Fp(P),Fp(R));
      const sL=est.sg, dev=Math.abs(Ln-80), s=dev+sL<=TOL+0.5?'ok':dev-2*sL>=BAD?'bad':'?'; pts.Rsh=sL; let msg;
      if(s==='ok') msg='|PR| = '+f1(Ln)+' мм — натуральная величина отложена верно';
      else if(s==='bad'&&Math.abs(LhP-80)<=2) msg='80 мм отложено на проекции n′ (|P′R′| = '+f1(LhP)+' мм), а не на натуральной величине: |PR| = '+f1(Ln)+' мм';
      else if(s==='bad'&&Math.abs(LfP-80)<=2) msg='80 мм отложено на проекции n″ (|P″R″| = '+f1(LfP)+' мм), а не на натуральной величине: |PR| = '+f1(Ln)+' мм';
      else if(s==='bad') msg='на перпендикуляре отложено |PR| = '+f1(Ln)+' мм вместо 80';
      else msg='|PR| = '+f1(Ln)+' ± '+f1(sL)+' мм — не утверждаем: на границе точности';
      steps.push({k:'R',name:'отрезок PR = 80 мм на n',status:s,msg,val:{L:Ln,sL,Lh:LhP,Lf:LfP,h:Math.abs(pl.sd(R))}}); pts.R=R; } }
  else steps.push({k:'R',name:'отрезок PR = 80 мм на n',status:'?',msg:'без перпендикуляра точку R не найти'});
  /* ── шаги 3–4: след β на EF и вершина S ──
     след ищется по устройству построения, а не по ожидаемому месту: это прямая π₂, которая (а) доходит до E″F″ или
     пересекает её, (б) встречает не меньше двух прямых β, выходящих из R″ (точки Q″ — где прямые β пересекают посредник
     γ ⊃ EF), (в) сама через R″ не идёт (R не лежит в γ) */
  let Tr=null, betaF=[], trWhy='след плоскости β на E″F″ не найден';
  if(R){ const RF=pts.RF, LF2=lines(free.filter(s=>inF(s)&&ang(dirOf(s),VERT)>3)), ext=(l,p,m)=>{ const t=v2.dot(v2.sub(p,l.p),l.e); return t>=l.t0-m&&t<=l.t1+m; };
    betaF=LF2.filter(l=>dLine(RF,l.p,l.e)<=1.5&&ext(l,RF,2)&&!(N&&ang(l.e,N.lf.e)<3));
    const EFl={p:Fp(E),e:v2.unit(v2.sub(Fp(F),Fp(E)))}, Lef=v2.dist(Fp(E),Fp(F)), X=(l,m)=>{ const d=v2.cr(l.e,m.e); if(Math.abs(d)<1e-6) return null; const k=v2.cr(v2.sub(m.p,l.p),m.e)/d; return v2.add(l.p,v2.mul(l.e,k)); };
    const cand=[];
    LF2.forEach(l=>{ if(betaF.includes(l)||dLine(RF,l.p,l.e)<=2||ang(l.e,EFl.e)<8) return; const x=X(l,EFl); if(!x||!ext(l,x,3.5)) return; const t=v2.dot(v2.sub(x,EFl.p),EFl.e); if(t<-5||t>Lef+5) return;
      const met=betaF.filter(b=>{ if(ang(b.e,l.e)<8) return false; const q=X(l,b); return q&&ext(l,q,6)&&ext(b,q,6); }).length; if(met>=2) cand.push({x,t,l,sg:0.4/Math.max(0.2,Math.sin(ang(l.e,EFl.e)*Math.PI/180))}); });
    cand.sort((p,q)=>p.t-q.t); const cl=[]; cand.forEach(c=>{ const k=cl[cl.length-1]; if(k&&c.t-k[k.length-1].t<=1.5) k.push(c); else cl.push([c]); });
    if(cl.length===1) Tr={pt:cl[0].reduce((m,c)=>v2.add(m,v2.mul(c.x,1/cl[0].length)),[0,0]),sg:Math.min(...cl[0].map(c=>c.sg))};
    else if(cl.length>1) trWhy='на E″F″ несколько прямых, похожих на след β, — какую строили, не различить';
    if(Tr) pts.trace=Tr.pt; }
  if(!R) steps.push({k:'beta',name:'плоскость β ∥ ABC через R и её след на EF',status:'?',msg:'без точки R не проверить'});
  else if(!Tr) steps.push({k:'beta',name:'плоскость β ∥ ABC через R и её след на EF',status:'?',msg:trWhy});
  else { const hR=pl.sd(R), d=v3.sub(F,E), tR=(hR-pl.sd(E))/v3.dot(pl.n,d), SR=v3.add(E,v3.mul(d,tR)), dev=v2.dist(Fp(SR),Tr.pt);
    /* погрешности: высота R (σ_u → σ_h → сдвиг по E″F″) и сам след (угол со E″F″) */
    const sh=pts.Rsh, sSR=sh/Math.abs(v3.dot(pl.n,d))*v2.len(Fp(d)), sg=Math.hypot(sSR,Tr.sg), s=dev+sg<=TOL+0.5?'ok':dev-2*sg>=BAD?'bad':'?';
    pts.SR=SR; let msg=s==='ok'?'след β проходит через точку EF на высоте R ('+f1(Math.abs(hR))+' мм над ABC)':'след β встречает E″F″ в '+f1(dev)+' мм от точки, где EF на высоте R ('+f1(Math.abs(hR))+' мм над ABC)'+(s==='bad'?': плоскость β построена неверно':' — на границе точности');
    if(s==='bad'){ /* подробность: какая прямая β не параллельна ABC (в π₂) */
      const sides=[['AB',v3.sub(B,A)],['BC',v3.sub(C,B)],['CA',v3.sub(A,C)],['h',[n[1],-n[0],0]],['f',[n[2],0,-n[0]]]], det=[];
      betaF.forEach(l=>{ const best=sides.map(([nm,d])=>({nm,a:ang(l.e,Fp(d))})).sort((p,q)=>p.a-q.a)[0]; if(best.a>=2&&best.a<=12) det.push('прямая β из R″ отклонена от ∥ '+best.nm+'″ на '+f1(best.a)+'°'); });
      if(det.length) msg+=' ('+det.join('; ')+')'; }
    steps.push({k:'beta',name:'плоскость β ∥ ABC через R и её след на EF',status:s,msg,val:{dev}}); }
  /* S″ студента — где его рёбра S″A″, S″B″, S″C″ встречают E″F″ (прямые по точкам рёбер на листе); cur.S из проверки
     ответа — лучшее положение по покрытию, оно на плато и может уйти на 1–1,5 мм */
  let SF=cur&&cur.S?Fp(cur.S):null;
  if(SF){ const EFl={p:Fp(E),e:v2.unit(v2.sub(Fp(F),Fp(E)))}; let w=0, q=[0,0], wmax=0;
    ['A','B','C'].forEach(k=>{ const V=Fp(data[k]), on=segs.filter(s=>lenOf(s)>=3&&onSeg(s,SF,V,1.5)); const l=fit(on); if(!l) return; const a=ang(l.e,EFl.e); if(a<20) return;
      /* пересечение под малым углом неточно: вес — sin² угла */
      const d=v2.cr(l.e,EFl.e), x=v2.add(l.p,v2.mul(l.e,v2.cr(v2.sub(EFl.p,l.p),EFl.e)/d)), wk=Math.sin(a*Math.PI/180)**2; q=v2.add(q,v2.mul(x,wk)); w+=wk; wmax=Math.max(wmax,a); });
    if(w>0&&wmax>=30){ q=v2.mul(q,1/w); if(v2.dist(q,SF)<=3) SF=q; } }
  pts.SF=SF;
  if(!cur||!cur.S) steps.push({k:'S',name:'вершина S = след ∩ EF',status:'?',msg:'вершина пирамиды не найдена'});
  else if(!Tr) steps.push({k:'S',name:'вершина S = след ∩ EF',status:'?',msg:'без следа β не проверить'});
  else { const dev=v2.dist(SF,Tr.pt), sg=Math.hypot(Tr.sg,0.4), s=dev+sg<=TOL+0.5?'ok':dev-2*sg>=BAD?'bad':'?';
    steps.push({k:'S',name:'вершина S = след ∩ EF',status:s,msg:s==='ok'?'S″ — в точке пересечения следа с E″F″':'S″ поставлена в '+f1(dev)+' мм от точки, где след β пересекает E″F″',val:{dev}}); }
  pts.S=cur&&cur.S;
  /* первый неверный шаг — только если все шаги до него проверены и верны */
  /* первый неверный шаг: все шаги до него измерены (найдены на листе) и не неверны; пограничный «?» с измерением —
     не ошибка, а «не утверждаем»: он не прерывает цепочку, но и сам ошибкой не называется */
  let first=null; for(const s of steps){ if(s.status==='bad'){ first=s; break; } if(!s.val) break; }
  return {steps,first,pts,dbg:{pairs:pairs.map(p=>({uF:[p.lf.u0,p.lf.u1],uH:[p.lh.u0,p.lh.u1],a3:p.a3,dF:p.dF,dH:p.dH,score:p.score,uP:p.uP}))}}; }
put('dzExplain2',{explain2,lines,junctions});
})();
