/* ═══════════ Модель пространства и проекций (числа с плавающей точкой, мм) ═══════════
   Соглашения сайта: x — влево, y — к зрителю, z — вверх. Чертёж — плоскость листа (u, v) в мм: u вправо, v вниз,
   ось x — прямая v = 0, начало O — точка x = 0 на оси. Фронтальная проекция A″ = (−x, −z), горизонтальная
   A′ = (−x, y), профильная A‴ = (y, −z). Это те же формулы, что L.F / L.H в index.html и PR в core/kernels.js
   (там — точно, в дробях); здесь — в мм для фото и сканера.
   Восстановление 3D: у точки с A″ и A′ абсцисса общая (линия связи вертикальна), y — отступ A′ от оси,
   z — отступ A″ от оси. Невязка линии связи |u″ − u′| — мера того, насколько чертёж — проекции одной точки. */
(function(){
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CORE=self.CORE||{}; self.CORE[n]=v; } };

const v2={
  add:(a,b)=>[a[0]+b[0],a[1]+b[1]], sub:(a,b)=>[a[0]-b[0],a[1]-b[1]], mul:(a,k)=>[a[0]*k,a[1]*k],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1], cross:(a,b)=>a[0]*b[1]-a[1]*b[0], len:a=>Math.hypot(a[0],a[1]),
  dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]), unit:a=>{ const l=Math.hypot(a[0],a[1])||1; return [a[0]/l,a[1]/l]; },
  lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t], perp:a=>[-a[1],a[0]],
  rot:(a,r)=>[a[0]*Math.cos(r)-a[1]*Math.sin(r),a[0]*Math.sin(r)+a[1]*Math.cos(r)],
};
/* прямая на листе: {p, d} — точка и единичное направление */
const L2={
  through:(P,Q)=>({p:P.slice(),d:v2.unit(v2.sub(Q,P))}),
  dir:(P,d)=>({p:P.slice(),d:v2.unit(d)}),
  axis:()=>({p:[0,0],d:[1,0]}),
  parAxis:P=>({p:P.slice(),d:[1,0]}),
  link:P=>({p:P.slice(),d:[0,1]}),
  perp:(L,P)=>({p:P.slice(),d:v2.perp(L.d)}),
  par:(L,P)=>({p:P.slice(),d:L.d.slice()}),
  meet(A,B){ const den=v2.cross(A.d,B.d); if(Math.abs(den)<1e-12) return null; const t=v2.cross(v2.sub(B.p,A.p),B.d)/den; return v2.add(A.p,v2.mul(A.d,t)); },
  foot:(P,L)=>v2.add(L.p,v2.mul(L.d,v2.dot(v2.sub(P,L.p),L.d))),
  dist:(P,L)=>Math.abs(v2.cross(v2.sub(P,L.p),L.d)),
  t:(P,L)=>v2.dot(v2.sub(P,L.p),L.d),
  at:(L,t)=>v2.add(L.p,v2.mul(L.d,t)),
  /* угол между прямыми, градусы, 0…90 */
  angle:(A,B)=>{ const c=Math.abs(v2.dot(A.d,B.d)); return Math.acos(Math.min(1,c))*180/Math.PI; },
};
const v3={
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], mul:(a,k)=>[a[0]*k,a[1]*k,a[2]*k],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len:a=>Math.hypot(a[0],a[1],a[2]), dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),
};
/* проекции (мм) */
const PRJ={ F:P=>[-P[0],-P[2]], H:P=>[-P[0],P[1]], W:P=>[P[1],-P[2]] };
/* восстановление точки по двум проекциям: x — среднее абсцисс, невязка — разрыв линии связи, мм */
function point3(f,h){ return {P:[-(f[0]+h[0])/2,h[1],-f[1]],link:Math.abs(f[0]-h[0])}; }
/* прямая по двум проекциям (не профильная): точки при двух абсциссах */
function line3(Lf,Lh){ if(Math.abs(Lf.d[0])<1e-9||Math.abs(Lh.d[0])<1e-9) return null;
  const at=(L,u)=>L.p[1]+(u-L.p[0])*L.d[1]/L.d[0], P=u=>[-u,at(Lh,u),-at(Lf,u)];
  return {p:P(0),d:v3.sub(P(-1),P(0))}; }
/* сцена листа (точки с подписями X″, X′) → 3D-точки и невязки линий связи */
function reconstruct(points){ const out={};
  Object.keys(points).forEach(l=>{ const m=/^(.+)″$/.exec(l); if(!m||!points[m[1]+'′']) return; out[m[1]]=point3(points[l],points[m[1]+'′']); });
  return out; }

put('model',{v2,L2,v3,PRJ,point3,line3,reconstruct});
})();
