/* ═══════════ Два независимых исполнителя ═══════════
   Ядро 3D (скульптор) — объекты в пространстве. Ядро 2D (чертёжник) — только то, что делается на эпюре
   линейкой и циркулем; третьей координаты у него нет. Общего у ядер только арифметика дробей.
   Соглашения сайта: x — влево, y — к зрителю, z — вверх; на чертеже A″ = (−x·k, −z·k), A′ = (−x·k, y·k). */
const {q,V}=require('./exact.js');
const Z=[q(0),q(1),q(0)], UP=[q(0),q(0),q(1)];

const K3={
  point:(p)=>V.of(p),
  line:(P,Qp)=>({p:P,d:V.sub(Qp,P)}),
  lineDir:(P,d)=>({p:P,d}),
  plane:(P,n)=>({p:P,n}),
  plane3:(A,B,C)=>({p:A,n:V.cross(V.sub(B,A),V.sub(C,A))}),
  /* прямая ∩ плоскость */
  meet(L,Pl){ const den=V.dot(Pl.n,L.d); if(den.isZero()) throw new Error('прямая параллельна плоскости');
    return V.add(L.p,V.mul(L.d,V.dot(Pl.n,V.sub(Pl.p,L.p)).div(den))); },
  /* прямая ∩ прямая (должны лежать в одной плоскости — проверяется точно) */
  meetLL(L1,L2){ const w=V.sub(L2.p,L1.p), n=V.cross(L1.d,L2.d); if(V.zero(n)) throw new Error('прямые параллельны');
    if(!V.dot(w,n).isZero()) throw new Error('прямые скрещиваются');
    const nn=V.dot(n,n); return V.add(L1.p,V.mul(L1.d,V.dot(V.cross(w,L2.d),n).div(nn))); },
  /* горизонталь и фронталь плоскости через её точку */
  horizontal:(Pl,A)=>({p:A,d:V.cross(Pl.n,UP)}),
  frontal:(Pl,A)=>({p:A,d:V.cross(Pl.n,Z)}),
  /* проецирующие плоскости через прямую */
  frontProj:L=>({p:L.p,n:V.cross(L.d,Z)}),
  horizProj:L=>({p:L.p,n:V.cross(L.d,UP)}),
  dist2:(A,B)=>{ const v=V.sub(B,A); return V.dot(v,v); },
  on:(P,L)=>V.zero(V.cross(V.sub(P,L.p),L.d)),
  inPlane:(P,Pl)=>V.dot(V.sub(P,Pl.p),Pl.n).isZero(),
};

const K2={
  line:(A,B)=>({p:A,d:V.sub(B,A)}),
  axisPar:P=>({p:P,d:[q(1),q(0)]}),           /* прямая ∥ оси x */
  link:P=>({p:P,d:[q(0),q(1)]}),              /* линия связи — вертикаль */
  perp:(L,P)=>({p:P,d:[L.d[1].neg(),L.d[0]]}),   /* перпендикуляр к прямой на том же поле */
  par:(L,P)=>({p:P,d:L.d}),
  meet(L1,L2){ const den=V.cross2(L1.d,L2.d); if(den.isZero()) throw new Error('прямые на чертеже параллельны');
    return V.add(L1.p,V.mul(L1.d,V.cross2(V.sub(L2.p,L1.p),L2.d).div(den))); },
  /* перпендикуляр из точки на прямую (основание) */
  foot(P,L){ const t=V.dot(V.sub(P,L.p),L.d).div(V.dot(L.d,L.d)); return V.add(L.p,V.mul(L.d,t)); },
  on:(P,L)=>V.cross2(V.sub(P,L.p),L.d).isZero(),
  same:(L1,L2)=>V.cross2(L1.d,L2.d).isZero()&&V.cross2(V.sub(L2.p,L1.p),L1.d).isZero(),
  dist2:(A,B)=>{ const v=V.sub(B,A); return V.dot(v,v); },
  /* sin² угла между прямыми (для O6: пересечение под острым углом на бумаге неточно) */
  sin2:(L1,L2)=>{ const c=V.cross2(L1.d,L2.d); return c.mul(c).div(V.dot(L1.d,L1.d).mul(V.dot(L2.d,L2.d))); },
};

/* проекции (k — масштаб чертежа: единиц на мм) */
const PR={
  2:(P,k)=>[P[0].neg().mul(k),P[2].neg().mul(k)],
  1:(P,k)=>[P[0].neg().mul(k),P[1].mul(k)],
  dir2:(d,k)=>[d[0].neg().mul(k),d[2].neg().mul(k)],
  dir1:(d,k)=>[d[0].neg().mul(k),d[1].mul(k)],
};
module.exports={K3,K2,PR};
