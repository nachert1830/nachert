/* ═══════════ ИГ №4: граф студента → привязка к модели → 3D (вырез K) → вердикт по видам ═══════════
   Эталон — граф чистовика сайта (lab/ig/ref.js → lab/ig/ig4ref.json): виды с отображением «мм детали → мм листа», линии с типами
   и признаком выреза K, допустимые изображения видов (alts, в мм детали). Принципы (lab/ig/PLAN.md):
     ложное «ошибка» хуже молчания — обвинение только при доказательстве: расхождение ≥ 2 мм, привязка вида с невязкой ≤ 0,7 мм,
     линия подтверждена карандашом (лишняя — графит есть; пропущенная — графита нет); иначе «не уверен» с причиной;
     проверяется результат, а не способ: композиция вида (вид / полуразрез справа или снизу / разрез) выбирается из допустимых
     по совпадению; тонкие линии построения не судятся.
   1. bind — вид эталона → вид студента: сдвиг + масштаб (≈ 1) по основным линиям тела без выреза K (ICP с многих стартов);
      невязка — медиана расстояний совпавших точек; покрытие — доля точек эталона в 1 мм.
   2. fit — 3D: стороны выреза K на главном виде студента (в мм детали) — МНК-прямые в коридоре у сторон K задания, вершины —
      пересечения соседних сторон (параметрическая модель; общий интерфейс reconstruct(graph, prior) → {K, dev, sides}).
   3. diff — по каждому виду: пропущенные линии, лишние, неверный тип; место — мм листа и что это (линия выреза K, сторона i).
   4. links — проекционная связь F↔T (x детали), F↔L (z детали) по привязкам, мм.
   check(graph, ref, {D, ppm}) → {bind, fit, verdict:{views:[{id, name, st, why, errors, unsure}], links, k3d}} */
(function(){
'use strict';
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const IG=isNode?require('./iggraph.js'):self.SCANIGRAPH;
const NAME={F:'главный вид',T:'вид сверху (разрез А–А)',L:'вид слева'}, AXN={F:['x','z'],T:['x','y'],L:['y','z']};
const TOL={bind:0.7,diff:2,run:4,typeRun:5};
const r2=v=>Math.round(v*100)/100, ap=(M,p)=>[M[0]*p[0]+M[1]*p[1]+M[2],M[3]*p[0]+M[4]*p[1]+M[5]];
const inv=M=>{ const d=M[0]*M[4]-M[1]*M[3]; return [M[4]/d,-M[1]/d,(M[1]*M[5]-M[4]*M[2])/d,-M[3]/d,M[0]/d,(M[3]*M[2]-M[0]*M[5])/d]; };
const mul=(P,Q)=>[P[0]*Q[0]+P[1]*Q[3],P[0]*Q[1]+P[1]*Q[4],P[0]*Q[2]+P[1]*Q[5]+P[2],P[3]*Q[0]+P[4]*Q[3],P[3]*Q[1]+P[4]*Q[4],P[3]*Q[2]+P[4]*Q[5]+P[5]];

/* ── точки линий с сеткой для ближайшего ── */
function index(L,st,cell){ st=st||0.5; cell=cell||2; const P=[], M=new Map();
  L.forEach(l=>IG.sampleP(l.p,st).forEach(q=>{ const i=P.length; P.push({q,l}); const k=Math.floor(q[0]/cell)+','+Math.floor(q[1]/cell); if(!M.has(k)) M.set(k,[]); M.get(k).push(i); }));
  return {P,near(q,r,f){ const cx=Math.floor(q[0]/cell), cy=Math.floor(q[1]/cell), R=Math.ceil(r/cell); let best=null, bd=r;
    for(let a=-R;a<=R;a++) for(let b=-R;b<=R;b++){ const I=M.get((cx+a)+','+(cy+b)); if(!I) continue; for(const i of I){ const p=P[i]; if(f&&!f(p.l)) continue; const d=Math.hypot(p.q[0]-q[0],p.q[1]-q[1]); if(d<bd){ bd=d; best=p; } } }
    return best?{d:bd,l:best.l,q:best.q}:null; }}; }

/* ── 1. привязка вида эталона к листу студента: q = s·(p − c) + c + t ── */
function bindView(rv,refLines,G,o){ o=o||{}; const src=refLines.filter(l=>l.view===rv.id&&l.type==='main'&&!l.k&&l.len>=3);
  const P=[].concat(...src.map(l=>IG.sampleP(l.p,1))); if(P.length<20) return null;
  const c=[(rv.box[0]+rv.box[2])/2,(rv.box[1]+rv.box[3])/2], idx=o.idx, isMH=l=>l.type==='main'||l.type==='hidden'||l.type==='open';
  const starts=[]; (o.cands||[]).forEach(b=>{ const t0=[(b[0]+b[2])/2-c[0],(b[1]+b[3])/2-c[1]]; for(let a=-8;a<=8;a+=4) for(let d=-8;d<=8;d+=4) starts.push([t0[0]+a,t0[1]+d]); });
  let best=null;
  const icp=(t,s)=>{ for(let it=0;it<25;it++){ const r=it<6?4:it<12?2:1.2, A=[]; P.forEach(p=>{ const q=[s*(p[0]-c[0])+c[0]+t[0],s*(p[1]-c[1])+c[1]+t[1]], n=idx.near(q,r,isMH); if(n) A.push([p,n.q]); });
      if(A.length<P.length*0.25) return null;
      /* МНК: t и s (масштаб — с привязкой к 1: студент чертит 1:1, расхождение — усадка фото и бумаги) */
      let Sx=0,Sy=0,Su=0,Sv=0,Suu=0,Sux=0, n=A.length; A.forEach(([p,q])=>{ const u=[p[0]-c[0],p[1]-c[1]]; Sx+=q[0]-c[0]; Sy+=q[1]-c[1]; Su+=u[0]+u[1]*0; Sv+=u[1]; Suu+=u[0]*u[0]+u[1]*u[1]; Sux+=u[0]*(q[0]-c[0])+u[1]*(q[1]-c[1]); });
      const lam=200*n/100, num=Sux-(Su*Sx+Sv*Sy)/n+lam*1, den=Suu-(Su*Su+Sv*Sv)/n+lam; s=Math.max(0.96,Math.min(1.04,num/den)); t=[(Sx-s*Su)/n,(Sy-s*Sv)/n]; }
    const d=P.map(p=>{ const q=[s*(p[0]-c[0])+c[0]+t[0],s*(p[1]-c[1])+c[1]+t[1]], n=idx.near(q,3,isMH); return n?n.d:3; }), cov=d.filter(v=>v<=1).length/d.length, inl=d.filter(v=>v<=1.5).sort((a,b)=>a-b);
    return {t,s,cov,resid:inl.length?inl[inl.length>>1]:9,n:P.length}; };
  starts.forEach(t0=>{ const r=icp(t0,1); if(r&&(!best||r.cov>best.cov+1e-9||(Math.abs(r.cov-best.cov)<1e-9&&r.resid<best.resid))) best=r; });
  if(!best) return null; const {t,s}=best, A=[s,0,(1-s)*c[0]+t[0],0,s,(1-s)*c[1]+t[1]];
  return {id:rv.id,A,map:mul(A,rv.map),s:r2(s),t:t.map(r2),cov:r2(best.cov),resid:r2(best.resid),n:best.n}; }

/* ── 2. 3D: вершины выреза K по главному виду студента ── */
function reconstruct(G,ref,B){ const bF=B.F; if(!bF) return {ok:false,why:'главный вид не привязан'};
  const Mi=inv(bF.map), K0=ref.model.K, lines=G.lines.filter(l=>l.view==='F'&&(l.type==='main'||l.type==='hidden'||l.type==='open')).map(l=>({l,P:l.p.map(p=>ap(Mi,p))}));
  const pts=[].concat(...lines.map(o=>IG.sampleP(o.P,0.5)));
  const fitSide=(a,b,others)=>{ const L=Math.hypot(b[0]-a[0],b[1]-a[1]), u=[(b[0]-a[0])/L,(b[1]-a[1])/L], n=[-u[1],u[0]];
    /* коридор ±6 мм поперёк стороны, вдоль — её средние 80 % (у вершин сходятся соседние стороны и рёбра тела) */
    let S=pts.filter(p=>{ const v=[p[0]-a[0],p[1]-a[1]], s=v[0]*u[0]+v[1]*u[1], d=v[0]*n[0]+v[1]*n[1]; return s>-0.25*L&&s<1.25*L&&Math.abs(d)<6; }).map(p=>({x:p[0],y:p[1],w:1}));
    /* самое частое смещение поперёк (гистограмма 0,5 мм): сторона — длинная прямая, она даёт пик */
    const off=p=>(p.x-a[0])*n[0]+(p.y-a[1])*n[1], hb=new Map(); S.forEach(p=>{ const k=Math.round(off(p)*2); hb.set(k,(hb.get(k)||0)+1); }); let mb=0, mv=-1; hb.forEach((v,k)=>{ const t=v+(hb.get(k-1)||0)+(hb.get(k+1)||0); if(t>mv){ mv=t; mb=k; } });
    S=S.filter(p=>Math.abs(off(p)*2-mb)<=2.5);
    let f=tls(S); for(let k=0;k<3&&f;k++){ const r=S.map(p=>Math.abs((p.x-f.x)*-f.dy+(p.y-f.y)*f.dx)); S=S.filter((p,i)=>r[i]<=0.8); f=tls(S); }
    /* направление — должно совпасть со стороной задания в пределах 10°: иначе это не она */
    if(!f||S.length<Math.max(8,0.3*L/0.5)||Math.abs(f.dx*u[0]+f.dy*u[1])<Math.cos(10*Math.PI/180)) return {found:false,a,b,n:S.length};
    const span=S.map(p=>(p.x-a[0])*u[0]+(p.y-a[1])*u[1]); return {found:true,f,n:S.length,cover:r2((Math.max(...span)-Math.min(...span))/L),resid:r2(Math.sqrt(S.reduce((s,p)=>s+((p.x-f.x)*-f.dy+(p.y-f.y)*f.dx)**2,0)/S.length))}; };
  const K=[], sides=[]; let ok=true;
  K0.forEach((P,pi)=>{ const F=P.map((a,i)=>fitSide(a,P[(i+1)%P.length])); sides.push(F.map(s=>({found:s.found,n:s.n,cover:s.cover,resid:s.resid})));
    const line=(s,i)=>s.found?s.f:{x:P[i][0],y:P[i][1],dx:P[(i+1)%P.length][0]-P[i][0],dy:P[(i+1)%P.length][1]-P[i][1]};
    K.push(P.map((v,i)=>{ const j=(i+P.length-1)%P.length, A=line(F[j],j), Bq=line(F[i],i), m=meet(A,Bq); if(!F[j].found||!F[i].found) ok=false; return m?m.map(r2):v.slice(); })); });
  let dev=0, at=null; K.forEach((P,i)=>P.forEach((p,j)=>{ const d=Math.hypot(p[0]-K0[i][j][0],p[1]-K0[i][j][1]); if(d>dev){ dev=d; at=[i,j]; } }));
  const shift=K.length?[r2(K[0].reduce((a,p,j)=>a+p[0]-K0[0][j][0],0)/K[0].length),r2(K[0].reduce((a,p,j)=>a+p[1]-K0[0][j][1],0)/K[0].length)]:[0,0];
  return {ok,K,dev:r2(dev),at,shift,sides}; }
function tls(P){ let W=0,mx=0,my=0; P.forEach(c=>{ W+=c.w; mx+=c.w*c.x; my+=c.w*c.y; }); if(W<=0||P.length<2) return null; mx/=W; my/=W; let a=0,b=0,c=0;
  P.forEach(q=>{ const dx=q.x-mx, dy=q.y-my; a+=q.w*dx*dx; b+=q.w*dx*dy; c+=q.w*dy*dy; }); const th=0.5*Math.atan2(2*b,a-c); return {x:mx,y:my,dx:Math.cos(th),dy:Math.sin(th)}; }
function meet(a,b){ const den=a.dx*b.dy-a.dy*b.dx; if(Math.abs(den)<1e-9) return null; const t=((b.x-a.x)*b.dy-(b.y-a.y)*b.dx)/den; return [a.x+a.dx*t,a.y+a.dy*t]; }

/* ── 3. различия вида: эталон (выбранное допустимое изображение) против графа студента ── */
function runsOf(S,flag,minLen,st){ const out=[]; let cur=null; S.forEach((q,i)=>{ if(flag[i]){ if(!cur){ cur=[]; out.push(cur); } cur.push(q); } else cur=null; }); return out.filter(r=>(r.length-1)*st>=minLen); }
function diffView(id,alt,b,G,ref,o){ const st=0.5, lines=alt.map(l=>Object.assign({},l,{p:l.p.map(p=>ap(b.map,p))}));
  const mine=G.lines.filter(l=>l.view===id), idxS=index(mine.filter(l=>l.type!=='axis'||true),st,2), drawn=index(mine,st,2);
  /* ничьё место: волнистая граница вида и разреза (студент вправе провести её чуть иначе), ±4 мм; линии листа эталона (оси, волнистые, разомкнутые) */
  const free=q=>{ const m=ap(inv(b.map),q); if(o.bnd!=null&&Math.abs(m[o.bndAx]-o.bnd)<4) return true; return false; };
  const sheetRef=ref.lines.filter(l=>l.view===id&&!l.p3).map(l=>Object.assign({},l,{p:l.p.map(p=>ap(b.A,p))}));
  const allRef=index(lines.concat(sheetRef),st,2), errors=[], unsure=[];
  const what=l=>(l.k?'линия выреза K'+(l.kside?' (сторона '+(l.kside[1]+1)+')':''):l.type==='hidden'?'невидимый контур':'контур тела');
  const inkAt=P=>{ if(!o.D) return null; const pr=IG.profile(o.D,P.map(p=>[p[0]*o.ppm,p[1]*o.ppm]),o.ppm); return IG.rhythm(pr).frac; };
  const isMH=l=>l.type==='main'||l.type==='hidden'||l.type==='open';
  /* пропущенная линия: точки эталона, у которых ближе 2 мм нет ни одной линии студента */
  lines.filter(l=>l.type==='main'||l.type==='hidden').forEach(l=>{ const S=IG.sampleP(l.p,st), far=S.map(q=>!free(q)&&!idxS.near(q,TOL.diff));
    runsOf(S,far,TOL.run,st).forEach(R=>{ const ink=inkAt(R), at=R[R.length>>1], len=r2((R.length-1)*st);
      if(ink!=null&&ink>0.3) unsure.push({kind:'miss',at:at.map(r2),len,what:what(l),why:'на листе есть карандаш ('+Math.round(ink*100)+' %), но линия не прочитана'});
      else errors.push({kind:'miss',at:at.map(r2),p:R.map(q=>q.map(r2)),len,k:l.k?1:0,what:'нет линии: '+what(l)+', '+len+' мм'}); }); });
  /* лишняя линия: основная или штриховая студента дальше 2 мм от всех линий эталона (и его осей, волнистых, размеров) */
  mine.filter(l=>isMH(l)&&l.len>=TOL.run).forEach(l=>{ const S=IG.sampleP(l.p,st), far=S.map(q=>!free(q)&&!allRef.near(q,TOL.diff));
    runsOf(S,far,TOL.run,st).forEach(R=>{ const at=R[R.length>>1], len=r2((R.length-1)*st);
      if(l.conf<0.7||l.ev&&l.ev.ink<0.6) unsure.push({kind:'extra',at:at.map(r2),len,why:'линия '+len+' мм не на месте, но тип или карандаш под сомнением ('+(l.ev?l.ev.why:'')+')'});
      else errors.push({kind:'extra',at:at.map(r2),p:R.map(q=>q.map(r2)),len,what:'лишняя '+(l.type==='hidden'?'штриховая':'основная')+' линия, '+len+' мм'}); }); });
  /* неверный тип: на месте невидимой — сплошная основная, на месте видимой — штриховая (только ритм карандаша, толщину не судим) */
  lines.filter(l=>l.type==='main'||l.type==='hidden').forEach(l=>{ const S=IG.sampleP(l.p,st), other=l.type==='main'?'hidden':'main';
    const bad=S.map(q=>{ if(free(q)) return false; const n=drawn.near(q,1); if(!n||n.l.type!==other) return false; if(n.l.conf<0.75) return false;
      /* в этом месте есть и линия эталона нужного типа (совпадение двух рёбер) — не ошибка */ return !lines.some(m=>m!==l&&m.type===other&&IG.dPL(q,m.p)<0.8); });
    runsOf(S,bad,TOL.typeRun,st).forEach(R=>{ const at=R[R.length>>1], len=r2((R.length-1)*st);
      errors.push({kind:'type',at:at.map(r2),p:R.map(q=>q.map(r2)),len,k:l.k?1:0,what:(l.type==='hidden'?'невидимая линия начерчена видимой':'видимая линия начерчена штриховой')+': '+what(l)+', '+len+' мм'}); }); });
  return {errors,unsure}; }
/* насколько допустимое изображение похоже на начерченное (F-мера по длине в 1 мм) */
function altScore(alt,b,G,id){ const st=1, mine=G.lines.filter(l=>l.view===id&&(l.type==='main'||l.type==='hidden')), L=alt.filter(l=>l.type==='main'||l.type==='hidden').map(l=>({type:l.type,p:l.p.map(p=>ap(b.map,p))}));
  const iS=index(mine,st,2), iR=index(L,st,2); let a=0,ah=0,s=0,sh=0;
  L.forEach(l=>IG.sampleP(l.p,st).forEach(q=>{ a++; const n=iS.near(q,1); if(n&&n.l.type===l.type) ah++; else if(n) ah+=0.5; }));
  mine.forEach(l=>IG.sampleP(l.p,st).forEach(q=>{ s++; if(iR.near(q,1)) sh++; }));
  const R=a?ah/a:0, P=s?sh/s:0; return R+P?2*R*P/(R+P):0; }

function check(G,ref,o){ o=o||{}; const B={}, out={views:[],links:[]};
  const idx=index(G.lines.filter(l=>l.type==='main'||l.type==='hidden'||l.type==='open'),0.5,2);
  /* кандидаты: вид модели с тем же именем, затем остальные */
  ref.views.forEach(rv=>{ const own=G.views.filter(v=>v.id===rv.id).map(v=>v.box), rest=G.views.filter(v=>v.id!==rv.id).map(v=>v.box);
    let b=bindView(rv,ref.lines,G,{idx,cands:own}); if(!b||b.cov<0.6){ const b2=bindView(rv,ref.lines,G,{idx,cands:rest}); if(b2&&(!b||b2.cov>b.cov)) b=b2; }
    if(b) B[rv.id]=b; });
  /* линии студента — к виду по привязке (рамка вида эталона на листе студента + 6 мм), а не по рамке модели */
  G.lines.forEach(l=>{ const m=IG.midP(l.p); let best=null, bd=8; Object.values(B).forEach(b=>{ const rv=ref.views.find(v=>v.id===b.id), c=[[rv.box[0],rv.box[1]],[rv.box[2],rv.box[3]]].map(p=>ap(b.A,p)), bx=[c[0][0],c[0][1],c[1][0],c[1][1]];
    const d=Math.hypot(Math.max(bx[0]-m[0],0,m[0]-bx[2]),Math.max(bx[1]-m[1],0,m[1]-bx[3])); if(d<bd){ bd=d; best=b.id; } }); if(best) l.view=best; });
  const fit=reconstruct(G,ref,B);
  const kOff=fit.ok&&fit.dev>=TOL.diff;
  ref.views.forEach(rv=>{ const id=rv.id, b=B[id], V={id,name:NAME[id]};
    if(!b){ Object.assign(V,{st:'не уверен',why:'вид не найден на листе (не совпал ни с одним изображением)'}); out.views.push(V); return; }
    V.bind={s:b.s,cov:b.cov,resid:b.resid};
    if(b.resid>TOL.bind||b.cov<0.7){ Object.assign(V,{st:'не уверен',why:'привязка вида неточная: невязка '+b.resid+' мм, совпало '+Math.round(b.cov*100)+' % контура'}); out.views.push(V); return; }
    /* допустимые изображения вида → лучшее по совпадению */
    const AL=(ref.alts&&ref.alts[id])||{}, names=Object.keys(AL); let alt=null, an=null, sc=-1;
    names.forEach(k=>{ const v=altScore(AL[k],b,G,id); if(v>sc){ sc=v; alt=AL[k]; an=k; } }); V.alt=an; V.altScore=r2(sc);
    if(!alt){ Object.assign(V,{st:'не уверен',why:'нет эталона изображения'}); out.views.push(V); return; }
    const sp=ref.spec||{}, bo=an==='halfR'?{bnd:sp.tb||0,bndAx:0}:an==='halfD'?{bnd:0,bndAx:1}:an==='half'?{bnd:sp.yb||0,bndAx:0}:{};
    const d=diffView(id,alt,b,G,ref,Object.assign({D:o.D,ppm:o.ppm},bo));
    /* вырез K не по заданию (подгонка по главному виду): одна причина вместо россыпи «пропущенных» и «лишних» у выреза */
    if(kOff){ const kErr=d.errors.filter(e=>e.k||e.kind==='extra'); if(id==='F'){ const c=fit.K[0].reduce((a,p)=>[a[0]+p[0]/fit.K[0].length,a[1]+p[1]/fit.K[0].length],[0,0]);
        d.errors=d.errors.filter(e=>!kErr.includes(e)); d.errors.unshift({kind:'kshift',at:ap(b.map,c).map(r2),what:'вырез K не по заданию: смещён на '+fit.dev+' мм ('+AXN.F[0]+' '+fit.shift[0]+', '+AXN.F[1]+' '+fit.shift[1]+' мм)'}); }
      else d.errors.forEach(e=>{ if(kErr.includes(e)) e.what+=' — следствие сдвига выреза K на главном виде'; }); }
    if(sc<0.75) d.unsure.push({kind:'alt',why:'изображение мало похоже на допустимые ('+Math.round(sc*100)+' %)'});
    V.errors=d.errors; V.unsure=d.unsure;
    V.st=d.errors.length?'ошибка':d.unsure.length?'не уверен':'верно';
    V.why=d.errors.length?d.errors.map(e=>e.what).join('; '):d.unsure.length?d.unsure.map(e=>e.why).join('; '):'линии совпали с эталоном (изображение «'+an+'», невязка '+b.resid+' мм)';
    out.views.push(V); });
  /* 4. проекционная связь — по привязкам, без эталона: x детали на главном и на виде сверху, z — на главном и слева */
  const at=(id,u,v)=>B[id]&&ap(B[id].map,[u,v]);
  if(B.F&&B.T){ const a=at('F',0,0), c=at('T',0,0); out.links.push({a:'F',b:'T',axis:'x',d:r2(c[0]-a[0])}); }
  if(B.F&&B.L){ const a=at('F',0,0), c=at('L',0,0); out.links.push({a:'F',b:'L',axis:'z',d:r2(c[1]-a[1])}); }
  out.links.forEach(l=>{ l.st=Math.abs(l.d)<=1.5?'верно':'не уверен'; if(l.st!=='верно') l.why='виды смещены на '+Math.abs(l.d)+' мм поперёк линии связи'; });
  out.k3d={K:fit.K,dev:fit.dev,shift:fit.shift,ok:fit.ok};
  return {bind:B,fit,verdict:out}; }

const api={check,bindView,reconstruct,diffView,altScore,index,TOL,NAME};
if(isNode) module.exports=api; else self.SCANIG4=api;
})();
