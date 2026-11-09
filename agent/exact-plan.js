/* ═══════════ Второе исполнение плана — точно, в дробях (для сертификата) ═══════════
   Тот же план, что исполняет core/cp.js, но на ядре 2D core/kernels.js (K2) в рациональных числах core/exact.js.
   Так сертификат core/certify.js сверяет построение с ядром 3D точно — «равно» значит «равно», без допусков.

   Линейка и угольник (through, parAxis, link, perp, par, meet, foot, dv, du, absV) — рациональные операции.
   Циркуль (dist, perpOff, along) даёт корни. Длины хранятся квадратами: число = {v: Q или null, sq: Q}.
   Точка, отложенная циркулем (perpOff, along), хранится символически {P, Q, s², side}: расстояние от неё
   до X вычисляется точно, когда X лежит на прямой PQ (для perpOff) / перпендикулярно ей (для along),
   или когда корень извлекается в дробях. Иначе — честная ошибка «точно не исполняется»: такой план
   сертификат проверить не может, и ответ не выдаётся. */
const {q,V}=require('../core/exact.js');
const KER=require('../core/kernels.js');           /* тот же объект, что у certify.js: O6 видит каждое K2.meet */
const {K2}=KER;

const isPt=x=>Array.isArray(x)&&x.length===2;
const isSym=x=>x&&x.sym;
const qabs=x=>x.sign()<0?x.neg():x;
function isqrt(n){ if(n<0n) return null; if(n<2n) return n; let x=BigInt(Math.floor(Math.sqrt(Number(n)))); while(x*x>n) x--; while((x+1n)*(x+1n)<=n) x++; return x; }
function sqrtQ(r){ const a=isqrt(r.n), b=isqrt(r.d); return a!=null&&a*a===r.n&&b*b===r.d?q(a).div(q(b)):null; }
const perp2=w=>[w[1].neg(),w[0]];                  /* как v2.perp в core/model.js: [-w₁, w₀] */
const num=v=>({v,sq:v.mul(v)});

class ExactError extends Error{}

/* квадрат расстояния до символической точки N = P + side·s·ê, ê = perp(ŵ) (perpOff) или ŵ (along), w = Q − P */
function dist2Sym(X,N){ const w=V.sub(N.Q,N.P), ww=V.dot(w,w), e=N.sym==='off'?perp2(w):w, PX=V.sub(N.P,X);
  const base=V.dot(PX,PX).add(N.s2), dot=V.dot(PX,e);
  if(dot.isZero()) return base;
  const r=sqrtQ(N.s2.div(ww)); if(!r) return null;
  return base.add(dot.mul(r).mul(q(2*N.side))); }

const OPS={
  through:(P,Q)=>line2(P,Q), seg:(P,Q)=>(isSym(P)||isSym(Q))?{sym:'seg'}:line2(P,Q),
  parAxis:P=>K2.axisPar(rat(P)), link:P=>K2.link(rat(P)),
  perp:(L,P)=>K2.perp(ratL(L),rat(P)), par:(L,P)=>K2.par(ratL(L),rat(P)),
  meet:(A,B)=>K2.meet(ratL(A),ratL(B)),
  foot:(P,L)=>K2.foot(rat(P),ratL(L)),
  perpOff:(P,Q,s,side)=>symPt('off',P,Q,s,side==null?1:side),
  along:(P,Q,s)=>symPt('along',P,Q,s,1),
  shiftU:(P,s)=>{ P=rat(P); if(!s.v) throw new ExactError('сдвиг на длину с корнем не исполняется точно — используйте разности координат (dv, du, absV)'); return [P[0].add(s.v),P[1]]; },
  dv:(P,Q)=>num(qabs(rat(P)[1].sub(rat(Q)[1]))),
  du:(P,Q)=>num(qabs(rat(P)[0].sub(rat(Q)[0]))),
  absV:P=>num(qabs(rat(P)[1])),
  dist:(P,Q)=>{ if(!isSym(P)&&!isSym(Q)) return {v:null,sq:K2.dist2(P,Q)};
    if(isSym(P)&&isSym(Q)) throw new ExactError('расстояние между двумя точками, отложенными циркулем, не исполняется точно');
    const [X,N]=isSym(P)?[Q,P]:[P,Q], d2=dist2Sym(X,N);
    if(!d2) throw new ExactError('расстояние от точки, отложенной циркулем, до точки вне её прямой не исполняется точно');
    return {v:null,sq:d2}; },
};
function rat(P){ if(isSym(P)) throw new ExactError('точку, отложенную циркулем (perpOff/along), можно использовать только в dist и seg'); return P; }
function ratL(L){ if(isSym(L)) throw new ExactError('отрезок до точки, отложенной циркулем, — только для чертежа: его нельзя пересекать и строить от него'); return L; }
function line2(P,Q){ P=rat(P); Q=rat(Q); if(V.eq(P,Q)) throw new ExactError('точки совпадают — прямая не определена'); return K2.line(P,Q); }
function symPt(kind,P,Q,s,side){ P=rat(P); Q=rat(Q); if(V.eq(P,Q)) throw new ExactError('точки совпадают — направление не определено'); return {sym:kind,P,Q,s2:s.sq,side}; }

/* шаги, от которых зависит ответ (K″, K′, |AK|); остальные — линии чертежа, на ответ не влияют */
function cone(prog,outs){ const need=new Set(outs||['K″','K′','|AK|']);
  for(let i=prog.steps.length-1;i>=0;i--){ const st=prog.steps[i]; if(need.has(st.id)) st.args.forEach(a=>{ if(typeof a==='string') need.add(a); }); }
  return prog.steps.map(st=>need.has(st.id)); }

/* исполнить план над данными E (уже записаны certify: A″, A′, a″, a′); ось x добавляется здесь.
   Точно исполняются шаги, от которых зависит ответ; шаги вне этого конуса (лишние линии чертежа) пропускаются */
function execExact(prog,E){ E.x=K2.axisPar([q(0),q(0)]); const angles=[], live=cone(prog);
  prog.steps.forEach((st,i)=>{ if(!live[i]) return; const args=st.args.map(a=>typeof a==='string'?E[a]:a);
    try{ const v=OPS[st.op](...args); E[st.id]=v;
      if(st.op==='meet') angles.push({id:st.id,i,sin2:K2.sin2(args[0],args[1]).num()}); }
    catch(e){ const err=new Error('шаг '+(i+1)+' («'+st.id+'», '+st.op+'): '+e.message); err.exact=e instanceof ExactError; throw err; } });
  return {E,angles}; }

module.exports={execExact,ExactError,cone};
