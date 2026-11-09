/* ═══════════ Параметрическая модель ДЗ №4: тело варианта + вырез K с любыми вершинами ═══════════
   Вырез K строится так же, как в dz/ig/4/models.js (выпуклый многоугольник на главном виде, протянутый вдоль y насквозь):
   пересечение полупространств сторон и коробки. kOf(n) — вершины K варианта [[[x, z], …], …]; withK(n, K) — модель варианта
   с другими вершинами K (для синтетики «сдвиг выреза» и для проекций восстановленной детали). */
'use strict';
const G=require('./ig3node.js');
const E=0.6;
function Kbody(pts){ const P=G.IG3.P, xs=pts.map(p=>p[0]), zs=pts.map(p=>p[1]);
  const hs=pts.map((A,i)=>{ const B=pts[(i+1)%pts.length], dx=B[0]-A[0], dz=B[1]-A[1]; return P.hp([dz,0,-dx],[A[0],0,A[1]]); });
  return Object.assign(P.I(P.box(Math.max(...xs)-Math.min(...xs)+2*E,400,Math.min(...zs)-E,Math.max(...zs)+E,{x:(Math.max(...xs)+Math.min(...xs))/2}),...hs),{pts}); }
const kOf=n=>{ const m=G.part(n), out=[]; (m.tree.k||[]).forEach(c=>{ if(c.pts) out.push(c.pts.map(p=>p.slice())); }); return out; };
/* вершины против часовой (как в models.js): иначе полупространства смотрят наружу */
const ccw=P=>{ let a=0; P.forEach((p,i)=>{ const q=P[(i+1)%P.length]; a+=p[0]*q[1]-q[0]*p[1]; }); return a>=0?P:P.slice().reverse(); };
function withK(n,K){ const m=G.part(n), P=G.IG3.P, extra=(m.tree.k||[]).filter(c=>!c.pts);   /* вычитаемое без pts (отверстие в. 19, 29) — как было */
  const tree=P.S(m.outer,...extra,...K.map(k=>Kbody(ccw(k))));
  const o=Object.assign({},m,{tree}); delete o._spec; return o; }
module.exports={kOf,withK,Kbody};
