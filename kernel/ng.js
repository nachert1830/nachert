/* ═══════════ Ядро решений · начертательная геометрия ═══════════
   NGK.solve(dz, n) → разбор варианта n задания dz: { task — шаги и чертёж в формате плеера сайта (3D строится по
   нему же, TASK3D), answers — ответы числами, cert — нарушения условия задачи (пусто — ответ верен) }.

   Как устроено. Каждый способ решения — программа построения от данных варианта: та же программа, что разбор
   примера на сайте (index.html, HW.calcOf / HW.taskOf), или своя для задач, у которых пример один, а типов
   вариантов несколько (kernel/ng-*.js). Способ выбирается по правилам из данных (прямая уровня — какая; тип
   фигуры — по номеру варианта), а не подбирается под ответ. Ответ потом проверяется условием задачи, записанным
   геометрически (сертификат ниже): S ∈ EF и d(S, ABC) = 80; AB = AC; рёбра куба равны и ⟂ … — независимо от того,
   как он построен.
   Данные вариантов — variants/ng/dzN.js (оглавление — variants/README.md). */
(function(){
const VAR=()=>(self.VARIANTS&&self.VARIANTS.ng)||{};
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]), dist=(a,b)=>len(sub(a,b)), unit=a=>mul(a,1/len(a));
const offLine=(P,A,B)=>len(cross(sub(P,A),sub(B,A)))/dist(A,B);
const plDist=(P,A,B,C)=>{ const n=cross(sub(B,A),sub(C,A)); return Math.abs(dot(sub(P,A),n))/len(n); };
const deg=r=>r*180/Math.PI;
const near=(a,b,tol)=>Math.abs(a-b)<=(tol||1e-6);

/* ── сертификаты: условие задачи на найденном ответе ── */
const CERT={
  '2':(D,c)=>{ const o=[]; if(!(offLine(c.S,D.E,D.F)<1e-6)) o.push('S не на прямой EF'); if(!near(plDist(c.S,D.A,D.B,D.C),80,1e-6)) o.push('высота '+plDist(c.S,D.A,D.B,D.C)+' ≠ 80'); return o; },
  '2b':(D,c)=>{ const o=[]; if(!(offLine(c.A,D.E,D.F)<1e-6)) o.push('A не на прямой EF'); if(!near(dist(c.A,D.B),dist(c.A,D.C))) o.push('AB ≠ AC');
    const n=cross(sub(D.B,c.A),sub(D.C,c.A)); [[c.A,c.A1],[D.B,c.B1],[D.C,c.C1]].forEach(([P,Q],i)=>{ if(!near(dist(P,Q),70,1e-6)) o.push('ребро '+i+' ≠ 70'); if(!(len(cross(sub(Q,P),n))<1e-6*len(n)*70)) o.push('ребро '+i+' не ⟂ основанию'); }); return o; },
  '2c':(D,c)=>{ const o=[]; if(!(offLine(c.B,D.E,D.F)<1e-6)) o.push('B не на прямой EF'); if(!(offLine(c.D,D.A,D.K)<1e-6)) o.push('D не на прямой AK');
    const V={A:D.A,B:c.B,C:c.C,D:c.D,A1:c.A1,B1:c.B1,C1:c.C1,D1:c.D1}, a=dist(D.A,c.B);
    [['A','B'],['B','C'],['C','D'],['D','A'],['A1','B1'],['B1','C1'],['C1','D1'],['D1','A1'],['A','A1'],['B','B1'],['C','C1'],['D','D1']].forEach(([p,q])=>{ if(!near(dist(V[p],V[q]),a,1e-6)) o.push('ребро '+p+q+' ≠ '+a); });
    [['A','B','D'],['A','A1','B'],['A','A1','D']].forEach(([O,p,q])=>{ if(!(Math.abs(dot(sub(V[p],V[O]),sub(V[q],V[O])))<1e-6*a*a)) o.push('угол '+p+O+q+' ≠ 90°'); }); return o; },
  '3':(D,c)=>{ const o=[], H=plDist(D.S,D.A,D.B,D.C); if(!near(c.H,H,1e-6)) o.push('высота '+c.H+' ≠ '+H); return o; },
};

/* ── задания ── */
const DZ={
  dz2:{ hw:n=>VAR().dz2.kind(n)==='2a'?'2':VAR().dz2.kind(n)==='2b'?'2b':'2c' },
  dz3:{ hw:()=>'3' },
  dz5:{ hw:n=>VAR().dz5.kind(n)==='cone'?'5':null },
};
/* ответ из расчёта разбора (для сертификата и для листа) */
const PICK={
  '2':c=>({S:c.S}), '2b':c=>({A:c.A,A1:c.A1,B1:c.B1,C1:c.C1}),
  '2c':c=>({B:c.B,C:c.C,D:c.D,A1:c.A1,B1:c.B1,C1:c.C1,D1:c.D1}), '3':c=>({H:c.H}), '5':c=>({K:c.Ks}) };

/* таблица данных — как на сайте: строка на точку (её читают и проверки) */
function tableHTML(D,names){ return L.table(['','x','y','z'],names.map(n=>[n,...D[n]])); }

/* разбор варианта программой сайта (HW): тот же код, что пример, на данных варианта */
function viaHW(dz,n,hwId){ const src=VAR()[dz], D=src.V[n];
  if(!window.NGHW||!NGHW.variant) return {why:'нет NGHW.variant'};
  const r=NGHW.variant(hwId,D); if(!r) return {why:'нет программы '+hwId};
  const t=r.task, names=typeof src.points==='function'?src.points(n):src.points;
  t.n=src.title.replace(/ ·.*/,'')+' · вариант '+n;
  t.q='<b>'+src.title.replace(/ ·.*/,'')+' · вариант '+n+'.</b> '+src.text(n);
  t.intro='Данные — из таблицы задания, вариант '+n+'. Каждое число на чертеже и в тексте посчитано по этим данным; ответ проверен условием задачи.';
  if(hwId!=='5') t.data=tableHTML(D,names);
  const cert=CERT[hwId]?CERT[hwId](D,r.calc):[];
  return {task:t,calc:r.calc,hwId,answers:PICK[hwId]?PICK[hwId](r.calc):{},cert}; }

const EXT={};   /* kernel/ng-*.js регистрируют свои программы: EXT[dz] = (n, D, src) → {task, answers, cert} */
function has(dz){ return !!VAR()[dz]&&(!!DZ[dz]||!!EXT[dz]); }
function numbers(dz){ const s=VAR()[dz]; return s?Object.keys(s.V).map(Number).filter(n=>{ try{ return supported(dz,n); }catch(e){ return false; } }):[]; }
function supported(dz,n){ if(EXT[dz]&&EXT[dz].has&&EXT[dz].has(n)) return true; const d=DZ[dz]; return !!(d&&d.hw(n)); }
function solve(dz,n){ n=+n; const src=VAR()[dz]; if(!src||!src.V[n]) return {why:'нет варианта '+dz+' №'+n};
  if(EXT[dz]&&EXT[dz].has(n)){ const r=EXT[dz].solve(n,src.V[n],src); return r; }
  const d=DZ[dz]; const hw=d&&d.hw(n); if(!hw) return {why:'способ для этого типа ещё не записан'};
  return viaHW(dz,n,hw); }
function list(){ return Object.keys(VAR()).sort(); }

self.NGK={list,has,numbers,supported,solve,EXT,CERT,util:{sub,add,mul,dot,cross,len,dist,unit,offLine,plDist,deg,tableHTML}};
})();
