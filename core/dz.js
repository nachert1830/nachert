/* ═══════════ ДЗ №2 и №3: условия, решения, сертификаты ответа ═══════════
   Свой решатель — независимый от кода сайта (index.html, HW.calc): другое вычисление тех же ответов. Совпадение
   с сайтом на каждом варианте проверяет lab/dz/fetch-variants.js; здесь каждое решение ещё и проверяется прямо
   по условию задачи (сертификат: высота 80 мм, AB = AC, рёбра куба равны и попарно ⟂ …) — неважно, как найдено.
   Соглашения сайта: x — влево, y — к зрителю, z — вверх; на листе A″ = (−x, −z), A′ = (−x, y) мм от O.

   Задачи (id — как на сайте: '2' = 2а, '2b' = 2б, '2c' = 2в, '3'):
   2а  пирамида SABC высотой 80 мм, вершина S на прямой EF. Решений два: S по обе стороны плоскости ABC.
   2б  прямая призма ABCA₁B₁C₁ высотой 70 мм, в основании равнобедренный ABC (AB = AC), A на прямой EF.
       A — пересечение EF с плоскостью, ⟂ BC через её середину; ребро AA₁ — в любую сторону от основания.
   2в  куб ABCDA₁B₁C₁D₁: B на прямой EF, сторона AD — на прямой AK. B — пересечение EF с плоскостью ⟂ AK через A;
       D — на AK на расстоянии |AB| от A (в сторону K или от неё), верхняя грань — в любую сторону: 4 решения.
   3   пирамида SABC дана: высота, угол между гранью SAB и основанием (двугранный при AB), истинный вид основания
       (длины сторон, углы), угол между ребром SA и основанием.
   solve(id, v) → {ok, why, sol:[…], …}; certify(id, v, r) → [нарушения] (пусто — решение верно). */
(function(){
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CORE=self.CORE||{}; self.CORE[n]=v; } };
const v3={ add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], mul:(a,k)=>[a[0]*k,a[1]*k,a[2]*k],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len:a=>Math.hypot(a[0],a[1],a[2]), dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]), unit:a=>{ const l=Math.hypot(a[0],a[1],a[2]); return [a[0]/l,a[1]/l,a[2]/l]; },
  mid:(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2] };
const DEG=r=>r*180/Math.PI, ang=(a,b)=>DEG(Math.acos(Math.max(-1,Math.min(1,v3.dot(a,b)/(v3.len(a)*v3.len(b))))));
/* плоскость по трём точкам: единичная нормаль (z ≥ 0, «вверх») и расстояние со знаком */
const plane=(A,B,C)=>{ let n=v3.unit(v3.cross(v3.sub(B,A),v3.sub(C,A))); if(n[2]<0||(n[2]===0&&(n[1]<0||(n[1]===0&&n[0]<0)))) n=v3.mul(n,-1); return {n,p:A,sd:P=>v3.dot(n,v3.sub(P,A))}; };
/* прямая P + t·d с плоскостью {n·X = n·Q}: параметр t или null (почти параллельна — задача теряет смысл) */
const meetPlane=(P,d,n,Q)=>{ const den=v3.dot(n,d); if(Math.abs(den)<1e-9*v3.len(d)) return null; return v3.dot(n,v3.sub(Q,P))/den; };
const F=P=>[-P[0],-P[2]], Hp=P=>[-P[0],P[1]];
const TASKS={
  '2': {name:'ДЗ №2а',given:['A','B','C','E','F'],h:80,
    text:'Построить проекции пирамиды SABC при условии, что её высота равна 80 мм, а вершина S принадлежит прямой EF. Решить без преобразования чертежа.'},
  '2b':{name:'ДЗ №2б',given:['B','C','E','F'],h:70,
    text:'Построить проекции прямой призмы ABCA₁B₁C₁ при условии, что её высота равна 70 мм, а в основании лежит равнобедренный треугольник ABC (AB = AC) с вершиной A на прямой EF. Решить без преобразования чертежа.'},
  '2c':{name:'ДЗ №2в',given:['A','K','E','F'],
    text:'Построить проекции куба ABCDA₁B₁C₁D₁ при условии, что вершина B лежит на прямой EF, а сторона AD — на прямой AK. Решить без преобразования чертежа.'},
  '3': {name:'ДЗ №3',given:['A','B','C','S'],
    text:'Дана пирамида SABC. Определить, применяя способы преобразования чертежа: 1) высоту пирамиды; 2) угол между гранью SAB и основанием ABC; 3) истинный вид основания ABC; 4) угол между ребром SA и основанием ABC.'} };

function solve(id,v){ const T=TASKS[id]; if(!T) return {ok:false,why:'нет задачи '+id};
  for(const k of T.given) if(!v[k]||v[k].length!==3||!v[k].every(Number.isFinite)) return {ok:false,why:'нет точки '+k};
  if(id==='2'){ const {A,B,C,E,F:Fp}=v, pl=plane(A,B,C), d=v3.sub(Fp,E), den=v3.dot(pl.n,d);
    if(Math.abs(den)<1e-6*v3.len(d)) return {ok:false,why:'EF параллельна плоскости ABC'};
    const sol=[T.h,-T.h].map(h=>{ const t=(h-pl.sd(E))/den, S=v3.add(E,v3.mul(d,t)); return {S,t,side:h>0?'над':'под',inSeg:t>=0&&t<=1}; });
    return {ok:true,id,n:pl.n,sol}; }
  if(id==='2b'){ const {B,C,E,F:Fp}=v, K=v3.mid(B,C), w=v3.sub(C,B), d=v3.sub(Fp,E), t=meetPlane(E,d,w,K); if(t==null) return {ok:false,why:'EF параллельна плоскости, ⟂ BC'};
    const A=v3.add(E,v3.mul(d,t)), pl=plane(A,B,C); if(!Number.isFinite(pl.n[0])) return {ok:false,why:'A на прямой BC — треугольника нет'};
    const sol=[1,-1].map(s=>{ const sh=v3.mul(pl.n,s*T.h); return {A,t,A1:v3.add(A,sh),B1:v3.add(B,sh),C1:v3.add(C,sh),side:s>0?'над':'под'}; });
    return {ok:true,id,A,K,n:pl.n,sol}; }
  if(id==='2c'){ const {A,K,E,F:Fp}=v, w=v3.sub(K,A), d=v3.sub(Fp,E), t=meetPlane(E,d,w,A); if(t==null) return {ok:false,why:'EF параллельна плоскости, ⟂ AK через A'};
    const B=v3.add(E,v3.mul(d,t)), a=v3.dist(A,B); if(a<1e-6) return {ok:false,why:'B совпала с A'};
    const sol=[]; [1,-1].forEach(sd=>{ const D=v3.add(A,v3.mul(v3.unit(w),sd*a)), C=v3.add(B,v3.sub(D,A)); let n=v3.unit(v3.cross(v3.sub(B,A),v3.sub(D,A))); if(n[2]<0) n=v3.mul(n,-1);
      [1,-1].forEach(su=>{ const sh=v3.mul(n,su*a); sol.push({B,t,a,D,C,A1:v3.add(A,sh),B1:v3.add(B,sh),C1:v3.add(C,sh),D1:v3.add(D,sh),toK:sd>0,side:su>0?'над':'под'}); }); });
    return {ok:true,id,B,a,sol}; }
  if(id==='3'){ const {A,B,C,S}=v, pl=plane(A,B,C), H=Math.abs(pl.sd(S)); if(!(H>1e-6)) return {ok:false,why:'S в плоскости основания'};
    /* двугранный угол при AB: между полуплоскостями ABS и ABC (перпендикуляры к AB к S и к C) */
    const ab=v3.unit(v3.sub(B,A)), perp=P=>{ const q=v3.sub(P,A); return v3.sub(q,v3.mul(ab,v3.dot(q,ab))); };
    const dih=ang(perp(S),perp(C)), SA=v3.dist(S,A), phi=DEG(Math.asin(H/SA));
    const AB=v3.dist(A,B), BC=v3.dist(B,C), CA=v3.dist(C,A), foot=v3.sub(S,v3.mul(pl.n,pl.sd(S)));
    const angA=ang(v3.sub(B,A),v3.sub(C,A)), angB=ang(v3.sub(A,B),v3.sub(C,B)), angC=180-angA-angB;
    return {ok:true,id,H,dih,phi,AB,BC,CA,angA,angB,angC,foot,n:pl.n,sol:[{H,dih,phi,AB,BC,CA}]}; }
}
/* сертификат: условие задачи проверяется прямо на ответе (допуск 1e-6 мм / 1e-6°) */
function certify(id,v,r){ const bad=[], eq=(a,b,what)=>{ if(!(Math.abs(a-b)<=1e-6)) bad.push(what+': '+a+' ≠ '+b); };
  if(!r||!r.ok) return ['нет решения'];
  const onLine=(P,a,b,what)=>{ const d=v3.sub(b,a), c=v3.len(v3.cross(v3.sub(P,a),d))/v3.len(d); eq(c,0,what+' на прямой'); };
  if(id==='2') r.sol.forEach((s,i)=>{ onLine(s.S,v.E,v.F,'S'+i); eq(Math.abs(plane(v.A,v.B,v.C).sd(s.S)),80,'высота S'+i); });
  if(id==='2b') r.sol.forEach((s,i)=>{ onLine(s.A,v.E,v.F,'A'+i); eq(v3.dist(s.A,v.B),v3.dist(s.A,v.C),'AB = AC'); const n=plane(s.A,v.B,v.C);
    [[s.A,s.A1],[v.B,s.B1],[v.C,s.C1]].forEach(([P,Q],k)=>{ eq(v3.dist(P,Q),70,'ребро '+k); eq(v3.len(v3.cross(v3.sub(Q,P),n.n)),0,'ребро ⟂ основанию '+k); }); });
  if(id==='2c') r.sol.forEach((s,i)=>{ onLine(s.B,v.E,v.F,'B'+i); onLine(s.D,v.A,v.K,'D'+i); const V={A:v.A,B:s.B,C:s.C,D:s.D,A1:s.A1,B1:s.B1,C1:s.C1,D1:s.D1}, a=s.a;
    [['A','B'],['B','C'],['C','D'],['D','A'],['A1','B1'],['B1','C1'],['C1','D1'],['D1','A1'],['A','A1'],['B','B1'],['C','C1'],['D','D1']].forEach(([p,q])=>eq(v3.dist(V[p],V[q]),a,p+q));
    [['A','B','D'],['A','A1','B'],['A','A1','D']].forEach(([o,p,q])=>eq(v3.dot(v3.sub(V[p],V[o]),v3.sub(V[q],V[o])),0,'⟂ '+p+o+q)); });
  if(id==='3'){ const s=r.sol[0], pl=plane(v.A,v.B,v.C); eq(v3.dist(v.S,r.foot),s.H,'H = |S — основание|'); eq(Math.abs(pl.sd(r.foot)),0,'основание высоты в плоскости');
    eq(s.H,v3.dist(v.S,v.A)*Math.sin(s.phi*Math.PI/180),'sin φ = H / SA'); eq(r.angA+r.angB+r.angC,180,'сумма углов'); }
  return bad; }
/* проекции на листе (мм от O): A″ = (−x, −z), A′ = (−x, y) */
const proj=P=>({f:F(P),h:Hp(P)});
put('dz',{TASKS,solve,certify,proj,plane,v3});
})();
