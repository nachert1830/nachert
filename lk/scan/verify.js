/* ═══════════ Проверка ДЗ №3 по результату, а не по способу ═══════════
   Студенты решают по-разному (замена плоскостей вместо вращения, свои подписи: A‴, A⁗, A^IV, A₀, A₁′ …), но любое верное
   построение приводит к одной и той же истинной величине — её и сверяем с эталоном варианта (данные core/dz-variants.js):
     высота H     — проекция, где основание видно ребром (A, B, C одного семейства подписей на одной прямой), и S того же
                    семейства: H = расстояние от S до этой прямой;
     угол граней  — проекция, где ребро AB видно точкой (A ≡ B): грани SAB и CAB — прямые через эту точку, угол между ними;
     истинный вид — треугольник A, B, C одного семейства, стороны которого равны истинным длинам |AB|, |BC|, |CA|
                    (проекции ″ и ′ — не в счёт: они не в натуральную величину, кроме редких совпадений);
     угол SA      — проекция, где основание видно ребром (как для H): угол между прямой ABC и SA.
   Семейство подписи — всё, кроме буквы: A″ → ″, A‴ → ‴, A₄ → ₄, A₁′ → ₁′, A^IV → ⁗. Копия — в мм листа (привязка к варианту).
   Вердикт по величине: «верно» — расхождение ≤ tol (1,5 мм / 2°, рука студента и сканер вместе ≈ 0,5 мм), «расходится» — ≥ bad
   (3 мм / 4°), между — «не уверен». Найти величину не удалось — о ней молчим (а не «ошибка»).
   ref(data) → {H, dih, sides:{AB,BC,CA}, phi}; verify(pts [[подпись, x, y]] мм, data, o) → {found:[{k, what, got, want, d, st, from}], verdict} */
(function(){
'use strict';
const sub=(a,b)=>a.map((v,i)=>v-b[i]), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), len=a=>Math.sqrt(dot(a,a)), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const DEG=180/Math.PI;
/* эталон по данным варианта: точки — [x, y, z] мм */
function ref(D){ const A=D.A,B=D.B,C=D.C,S=D.S, n=cross(sub(B,A),sub(C,A)), nn=len(n), H=Math.abs(dot(sub(S,A),n))/nn;
  /* угол граней SAB и ABC вдоль AB: нормали граней — к ребру, угол между полуплоскостями (0…180) */
  const e=sub(B,A), eu=e.map(v=>v/len(e)), perp=P=>{ const v=sub(P,A), t=dot(v,eu); return sub(v,eu.map(x=>x*t)); }, ps=perp(S), pc=perp(C);
  const dih=Math.acos(Math.max(-1,Math.min(1,dot(ps,pc)/len(ps)/len(pc))))*DEG;
  /* угол SA с плоскостью ABC */
  const sa=sub(S,A), phi=Math.asin(Math.min(1,Math.abs(dot(sa,n))/nn/len(sa)))*DEG;
  return {H,dih,phi,sides:{AB:len(sub(B,A)),BC:len(sub(C,B)),CA:len(sub(A,C))}}; }
const SUP={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5'};
/* подпись → {L — буква A/B/C/S, fam — семейство} ; ^IV, IV, ⁗ — одно семейство */
function parse(l){ const s=String(l).trim().replace(/\^?IV/,'⁗').replace(/''''|""/g,'⁗').replace(/'''/g,'‴').replace(/''|"/g,'″').replace(/'/g,'′').replace(/[ⁱ]/g,'').replace(/\s+/g,'');
  const m=s.match(/^([ABCSabcs])(.*)$/); if(!m) return null; let fam=m[2].replace(/[⁰¹²³⁴⁵]/g,c=>'₀₁₂₃₄₅'['012345'.indexOf(SUP[c])]).replace(/\^/g,'');
  return {L:m[1].toUpperCase(),fam}; }
const d2=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
function verify(pts,data,o){ o=o||{}; const R=ref(data), tolL=o.tolL||1.5, badL=o.badL||3, tolA=o.tolA||2, badA=o.badA||4, fams=new Map();
  (pts||[]).forEach(([l,x,y])=>{ const q=parse(l); if(!q) return; if(!fams.has(q.fam)) fams.set(q.fam,{}); const F=fams.get(q.fam); if(!F[q.L]) F[q.L]=[x,y]; });
  const found=[], st=(d,tol,bad)=>d<=tol?'верно':d>=bad?'расходится':'не уверен';
  fams.forEach((F,fam)=>{ const {A,B,C,S}=F; if(!A||!B||!C) return; const proj=fam==='″'||fam==='′';
    const ab=d2(A,B), bc=d2(B,C), ca=d2(C,A), area=Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]))/2, span=Math.max(ab,bc,ca);
    /* основание ребром: A, B, C на одной прямой (высота треугольника < 0,8 мм) */
    const flat=span>10&&2*area/span<0.8;
    if(flat&&S&&!proj){ const [P,Q]=ab>=bc&&ab>=ca?[A,B]:bc>=ca?[B,C]:[C,A], u=[(Q[0]-P[0])/d2(P,Q),(Q[1]-P[1])/d2(P,Q)], h=Math.abs((S[0]-P[0])*u[1]-(S[1]-P[1])*u[0]);
      found.push({k:'H',what:'высота пирамиды',got:h,want:R.H,d:Math.abs(h-R.H),st:st(Math.abs(h-R.H),tolL,badL),from:fam,unit:'мм'});
      /* угол SA с основанием: прямая основания и SA в этой проекции */
      const sa=[S[0]-A[0],S[1]-A[1]], c=Math.abs(sa[0]*u[0]+sa[1]*u[1])/Math.hypot(...sa), phi=Math.acos(Math.min(1,c))*DEG;
      found.push({k:'phi',what:'угол SA с основанием',got:phi,want:R.phi,d:Math.abs(phi-R.phi),st:st(Math.abs(phi-R.phi),tolA,badA),from:fam,unit:'°',weak:true}); }
    /* ребро AB точкой: A ≡ B (ближе 1 мм), C и S есть — угол между гранями */
    if(ab<1&&S&&!proj){ const P=[(A[0]+B[0])/2,(A[1]+B[1])/2], vs=[S[0]-P[0],S[1]-P[1]], vc=[C[0]-P[0],C[1]-P[1]];
      const ang=Math.acos(Math.max(-1,Math.min(1,(vs[0]*vc[0]+vs[1]*vc[1])/Math.hypot(...vs)/Math.hypot(...vc))))*DEG;
      found.push({k:'dih',what:'угол между гранью SAB и основанием',got:ang,want:R.dih,d:Math.abs(ang-R.dih),st:st(Math.abs(ang-R.dih),tolA,badA),from:fam,unit:'°'}); }
    /* истинный вид основания: стороны = истинные длины (каждая ≤ tol); ″ и ′ — не в счёт */
    if(!flat&&!proj&&ab>=1){ const ds=[Math.abs(ab-R.sides.AB),Math.abs(bc-R.sides.BC),Math.abs(ca-R.sides.CA)], dm=Math.max(...ds);
      /* семейство похоже на истинный вид, только если хоть две стороны близки (иначе это промежуточная проекция, не результат) */
      /* «расходится» по истинному виду не говорим: семейство может быть промежуточной проекцией (на настоящих листах ‴ после
         первой замены давало «расхождение» 2–6 мм у верных решений) — только «верно» или «не уверен» */
      if(ds.filter(x=>x<=badL).length>=2) found.push({k:'true',what:'истинный вид основания ABC',got:[ab,bc,ca],want:[R.sides.AB,R.sides.BC,R.sides.CA],d:dm,st:dm<=tolL?'верно':'не уверен',from:fam,unit:'мм'}); } });
  /* по каждой величине — лучшее (наименьшее расхождение) семейство: промежуточные проекции не должны давать «расходится» */
  const best={}; found.forEach(f=>{ if(!best[f.k]||f.d<best[f.k].d) best[f.k]=f; });
  const fin=Object.values(best).filter(f=>!(f.weak&&f.st!=='верно'));   /* угол SA по проекции «основание ребром» — только подтверждение */
  const verdict=!fin.length?'нечего проверить':fin.some(f=>f.st==='расходится')?'расходится с эталоном':fin.every(f=>f.st==='верно')?'верно':'не уверен';
  return {ref:R,found:fin,all:found,verdict}; }
const api={ref,verify,parse};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else { self.SCANVERIFY=api; }
})();
