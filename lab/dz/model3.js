/* ═══════════ ДЗ №3: построения как функции свободных выборов студента (мм чертежа от O) ═══════════
   Студент сам решает, где провести новую ось и вокруг какой прямой уровня вращать. Остальное этими выборами
   определено однозначно — его и предсказываем, а выборы потом находим по фото (lab/dz/check3.js).
   Замена плоскостей (шаг): ось ℓ = {p, e} (точка, направление), сторона ν (единичная нормаль ℓ — куда откладывать).
     Новая проекция точки: P_new = (основание перпендикуляра из P_ост на ℓ) + ν · d_P, где P_ост — проекция, которая
     остаётся, d_P — расстояние заменяемой проекции от прежней оси (со знаком). От π₁/π₂: оставляем P′ — d = z,
     оставляем P″ — d = y. Второй шаг: оставляем P₄, d = расстояние P′ (или P″) от x₁₄ (x₂₄) со знаком.
   а) высота: x ⟂ h′ (или ⟂ f″) — основание проецируется в прямую, H = расстояние S₄ до неё;
   б) двугранный угол при AB: x ∥ A′B′ (или A″B″), затем x ⟂ A₄B₄ — AB в точку, грани — прямые, угол между ними;
   в) истинный вид ABC: вращение вокруг горизонтали h (z = c) плоскости ABC до ∥ π₁ (или фронтали f, y = c, до ∥ π₂):
      точка P идёт по перпендикуляру к h′ на расстояние R = |P − O_P| (O_P — основание перпендикуляра на h);
      в сторону P′ (поворот на меньший угол) или наоборот (больший угол — тоже истинный вид, зеркально);
   г) угол SA с основанием: плоскость Σ = (SA, n), n ⟂ ABC через S; вращение Σ вокруг её горизонтали (z = c)
      до ∥ π₁: S₀, A₀ и прямая n₀; ψ = ∠(S₀A₀, n₀), φ = 90° − ψ. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const DZ=isNode?require('../../core/dz.js'):self.CORE.dz, {v3}=DZ;
const v2={add:(a,b)=>[a[0]+b[0],a[1]+b[1]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],mul:(a,k)=>[a[0]*k,a[1]*k],dot:(a,b)=>a[0]*b[0]+a[1]*b[1],len:a=>Math.hypot(a[0],a[1]),unit:a=>{ const l=Math.hypot(a[0],a[1])||1; return [a[0]/l,a[1]/l]; },perp:a=>[-a[1],a[0]]};
const Fp=P=>[-P[0],-P[2]], Hp=P=>[-P[0],P[1]];
const NAMES=['A','B','C','S'];
/* прямая на чертеже: p, e (единичный); ν — нормаль: perp(e) · side */
const line=(p,e)=>({p,e:v2.unit(e)});
const foot=(P,L)=>v2.add(L.p,v2.mul(L.e,v2.dot(v2.sub(P,L.p),L.e)));
const sdist=(P,L,nu)=>v2.dot(v2.sub(P,L.p),nu);
/* шаг замены: keep — проекции, что остаются; d — расстояния (со знаком) заменяемых; ℓ, side → новые проекции */
function replace(keep,d,L,side){ const nu=v2.mul(v2.perp(L.e),side), out={}; Object.keys(keep).forEach(k=>{ out[k]=v2.add(foot(keep[k],L),v2.mul(nu,d[k])); }); return {P:out,nu,L}; }
/* первая замена от системы π₂/π₁: base 'h' — оставляем P′ (d = z), 'f' — оставляем P″ (d = y) */
function first(data,base,L,side){ const keep={}, d={}; NAMES.forEach(k=>{ const P=data[k]; keep[k]=base==='h'?Hp(P):Fp(P); d[k]=base==='h'?P[2]:P[1]; }); return Object.assign(replace(keep,d,L,side),{base}); }
/* вторая замена: оставляем проекции шага 1, d — расстояния заменённых (P′ или P″) от оси шага 1 со знаком «к ним» */
function second(data,s1,L,side){ const d={}; NAMES.forEach(k=>{ const P=data[k], Q=s1.base==='h'?Hp(P):Fp(P); d[k]=-sdist(Q,s1.L,s1.nu); }); return replace(s1.P,d,L,side); }
/* направления по задаче: горизонталь h′ и фронталь f″ плоскости ABC, A′B′ и A″B″ */
function dirs(data){ const {A,B,C}=data, n=v3.unit(v3.cross(v3.sub(B,A),v3.sub(C,A)));
  const h3=v3.unit([n[1],-n[0],0]), f3=v3.unit([n[2],0,-n[0]]);   /* h ⟂ n и горизонтальна; f ⟂ n и фронтальна */
  return {n,h3,f3,hH:v2.unit([-h3[0],h3[1]]),fF:v2.unit([-f3[0],-f3[2]]),ABh:v2.unit(v2.sub(Hp(B),Hp(A))),ABf:v2.unit(v2.sub(Fp(B),Fp(A)))}; }
/* в) вращение вокруг прямой уровня плоскости ABC: form 'h' (z = c) или 'f' (y = c); same — в сторону проекции */
function rotate(data,form,c,same,pts){ const {n,h3,f3}=dirs(data), A=data.A, dirL=form==='h'?h3:f3;
  /* точка прямой уровня: в плоскости ABC, z = c (или y = c) — на прямой через A вдоль линии наибольшего ската */
  const k=form==='h'?2:1, m=v3.unit(v3.cross(n,dirL)); if(Math.abs(m[k])<1e-9) return null; const Q=v3.add(A,v3.mul(m,(c-A[k])/m[k]));
  const out={}, proj=form==='h'?Hp:Fp, Lp=line(proj(Q),v2.sub(proj(v3.add(Q,dirL)),proj(Q)));
  (pts||['A','B','C']).forEach(nm=>{ const P=data[nm], O=v3.add(Q,v3.mul(dirL,v3.dot(v3.sub(P,Q),dirL))), R=v3.dist(P,O), Pp=proj(P), sd=sdist(Pp,Lp,v2.perp(Lp.e));
    const w=v2.mul(v2.perp(Lp.e),(sd>=0?1:-1)*(same?1:-1)); out[nm]=Math.abs(sd)<1e-9&&R<1e-9?Pp:v2.add(proj(O),v2.mul(w,R)); });
  return {P:out,axis:Lp,Q,dirL,form,c}; }
/* г) угол SA с основанием: Σ = (S, A, n); вращение вокруг горизонтали Σ на высоте c до ∥ π₁ */
function sigma(data,c,same){ const {A,S}=data, {n}=dirs(data), nS=v3.cross(v3.sub(A,S),n); if(v3.len(nS)<1e-9) return null;
  const nu=v3.unit(nS), h=v3.unit([nu[1],-nu[0],0]); if(!Number.isFinite(h[0])) return null;
  /* точки Σ на высоте c: X на SA, Y на n из S */
  const X=Math.abs(A[2]-S[2])<1e-9?null:v3.add(S,v3.mul(v3.sub(A,S),(c-S[2])/(A[2]-S[2]))), Y=Math.abs(n[2])<1e-9?null:v3.add(S,v3.mul(n,(c-S[2])/n[2]));
  if(!X||!Y) return null; const Lp=line(Hp(X),v2.sub(Hp(v3.add(X,h)),Hp(X)));
  const rot=P=>{ const O=v3.add(X,v3.mul(h,v3.dot(v3.sub(P,X),h))), R=v3.dist(P,O), Pp=Hp(P), sd=sdist(Pp,Lp,v2.perp(Lp.e)); const w=v2.mul(v2.perp(Lp.e),(sd>=0?1:-1)*(same?1:-1)); return R<1e-9?Pp:v2.add(Hp(O),v2.mul(w,R)); };
  const S0=rot(S), A0=rot(A), Y0=Hp(Y), psi=Math.acos(Math.min(1,Math.abs(v2.dot(v2.unit(v2.sub(A0,S0)),v2.unit(v2.sub(Y0,S0))))))*180/Math.PI;   /* угол между прямыми (Y может быть по любую сторону от S) */
  return {S0,A0,Y0,X0:Hp(X),axis:Lp,psi,phi:90-psi,c}; }
put('dzModel3',{replace,first,second,dirs,rotate,sigma,line,foot,sdist,Fp,Hp,v2,NAMES});
})();
