/* ═══════════ ДЗ №2а как программа построения (способ без преобразования чертежа) — с ошибкой на любом шаге ═══════════
   Способ (как у студентов и в разборе сайта):
   1. h и f плоскости ABC (через вершины); точка P плоскости — начало перпендикуляра (h ∩ f или вершина);
   2. перпендикуляр n из P: n″ ⟂ f″, n′ ⟂ h′;
   3. на n — точка R на расстоянии 80 мм от P: натуральная величина отрезка PM (прямоугольный треугольник: катеты P′M′
      и Δz), затем подобие до 80;
   4. плоскость β ∋ R, β ∥ ABC — прямыми через R, параллельными AB и AC;
   5. посредник γ ⊃ EF, γ ⟂ π₁ (γ′ ≡ E′F′): точки Q₁, Q₂ — где прямые β пересекают γ; след ℓ = Q₁Q₂;
   6. S = ℓ ∩ EF; рёбра пирамиды из S.
   Ошибки — на одном шаге, дальше студент строит честно от неверного:
     n_dir — n″ повёрнута на 6° (n′ верна); len — на n отложено 70 мм вместо 80; proj — 80 мм отложено на проекции n′,
     а не на натуральной величине; beta — прямая β ∥ AB в π₂ повёрнута на 5°; pick — S поставлена в 6 мм от ℓ ∩ EF.
   build(data, {err, P, seed}) → {items (сцена, мм от O), steps (что на каждом шаге вышло на самом деле)} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const DZ=isNode?require('../../core/dz.js'):self.CORE.dz, {v3}=DZ;
const Fp=P=>[-P[0],-P[2]], Hp=P=>[-P[0],P[1]];
const seg=(a,b,k)=>({t:'seg',a,b,k:k||'aux'}), pt=(at,l,k)=>({t:'pt',at,l,k:k||'aux'});
const rot2=(e,a)=>[e[0]*Math.cos(a)-e[1]*Math.sin(a),e[0]*Math.sin(a)+e[1]*Math.cos(a)];
/* точка по двум проекциям: x — общий, z — из фронтальной, y — из горизонтальной */
const lift=(f,h)=>[-(f[0]+h[0])/2,h[1],-f[1]];
/* 2D: пересечение прямых p + e·t */
const meet2=(p,e,q,f)=>{ const d=e[0]*f[1]-e[1]*f[0]; if(Math.abs(d)<1e-12) return null; const w=[q[0]-p[0],q[1]-p[1]], t=(w[0]*f[1]-w[1]*f[0])/d; return [p[0]+e[0]*t,p[1]+e[1]*t]; };
function build(data,o){ o=o||{}; const err=o.err||'ok', {A,B,C,E,F}=data, pl=DZ.plane(A,B,C), n=pl.n, items=[], steps={};
  /* 1. h через вершину со средней высотой, f — со средней глубиной; P = h ∩ f (в плоскости) */
  const mid=(k)=>['A','B','C'].sort((p,q)=>data[p][k]-data[q][k])[1], hv=o.hv||mid(2), fv=o.fv||mid(1);
  const h3=v3.unit([n[1],-n[0],0]), f3=v3.unit([n[2],0,-n[0]]);
  const Hh=data[hv], Ff=data[fv];
  /* h ∩ f: точка X = Hh + a·h3 = Ff + b·f3 (обе в плоскости, на разных уровнях: z = z_h, y = y_f) */
  const a=(Ff[1]-Hh[1])/h3[1], P=o.P||v3.add(Hh,v3.mul(h3,a));
  [[Hh,h3],[Ff,f3]].forEach(([Q,d],i)=>{ const Q2=v3.add(Q,v3.mul(d,i?-60:60)); items.push(seg(Fp(Q),Fp(v3.add(Q,v3.mul(d,i?-60:60))),'thin'),seg(Hp(Q),Hp(Q2),'thin')); });
  items.push(pt(Fp(P),'1″'),pt(Hp(P),'1′'),{t:'conn',a:Fp(P),b:Hp(P)});
  /* 2. перпендикуляр n из P: направления в проекциях — n″ ⟂ f″, n′ ⟂ h′ (сами проекции n) */
  const nup=n[2]>=0?n:v3.mul(n,-1); let nF=[-nup[0],-nup[2]], nH=[-nup[0],nup[1]];
  if(err==='n_dir') nF=rot2(nF,6*Math.PI/180);
  /* 3D-направление n у студента — из двух его проекций (x общий): (−du, dv_H, −dv_F) при одинаковом du */
  const nStud=v3.unit([-nF[0],nH[1]*nF[0]/nH[0],-nF[1]]), n3=v3.dot(nStud,nup)<0?v3.mul(nStud,-1):nStud;
  steps.nAngle=Math.acos(Math.min(1,Math.abs(v3.dot(n3,nup))))*180/Math.PI;
  /* 3. R на n: натуральная величина 80 (len — 70; proj — 80 по проекции n′) */
  const L=err==='len'?70:80; let R;
  if(err==='proj'){ const nh=Math.hypot(n3[0],n3[1]); R=v3.add(P,v3.mul(n3,80/nh)); } else R=v3.add(P,v3.mul(n3,L));
  /* вспомогательная M (30 мм по n) и треугольник натуральной величины в π₁ — как у студента */
  const M3=v3.add(P,v3.mul(n3,30)), Pf=Fp(P), Ph=Hp(P);
  items.push(seg(Pf,Fp(v3.add(R,v3.mul(n3,8))),'thin'),seg(Ph,Hp(v3.add(R,v3.mul(n3,8))),'thin'),pt(Fp(M3),'M″'),pt(Hp(M3),'M′'),pt(Fp(R),'R″'),pt(Hp(R),'R′'),{t:'conn',a:Fp(R),b:Hp(R)});
  const RH=Hp(R), dz=R[2]-P[2], lw=[-(RH[1]-Ph[1]),RH[0]-Ph[0]], lwn=Math.hypot(...lw)||1, L0h=[RH[0]+lw[0]/lwn*dz,RH[1]+lw[1]/lwn*dz];
  items.push(seg(RH,L0h,'thin'),seg(Ph,L0h,'thin'),pt(L0h,'L₀'));
  steps.P=P; steps.R=R; steps.Rh=pl.sd(R); steps.L=v3.dist(P,R);
  /* 4. β через R: прямые ∥ AB и ∥ AC (в beta прямая ∥ AB во фронтальной проекции повёрнута на 5°) */
  const dAB=v3.sub(B,A), dAC=v3.sub(C,A), betaLine=(d,rotF)=>{ let eF=[-d[0],-d[2]], eH=[-d[0],d[1]]; if(rotF) eF=rot2(eF,rotF); return {eF,eH}; };
  const b1=betaLine(dAB,err==='beta'?5*Math.PI/180:0), b2=betaLine(dAC,0);
  /* 5. γ′ ≡ E′F′: в π₁ Q′ = (прямая β)′ ∩ E′F′; Q″ — на (прямой β)″ по линии связи */
  const Ef=Fp(E), Eh=Hp(E), eEF_H=[Hp(F)[0]-Eh[0],Hp(F)[1]-Eh[1]], eEF_F=[Fp(F)[0]-Ef[0],Fp(F)[1]-Ef[1]];
  const Q=[b1,b2].map(b=>{ const qh=meet2(RH,b.eH,Eh,eEF_H); if(!qh) return null; const RF=Fp(R), t=(qh[0]-RF[0])/b.eF[0], qf=[qh[0],RF[1]+b.eF[1]*t]; return {qh,qf}; });
  if(Q.some(q=>!q)) return null;
  Q.forEach((q,i)=>{ items.push(seg(Fp(R),q.qf,'thin'),seg(RH,q.qh,'thin'),pt(q.qf,(i?'4':'3')+'″'),pt(q.qh,(i?'4':'3')+'′'),{t:'conn',a:q.qf,b:q.qh}); });
  /* 6. ℓ″ = Q₁″Q₂″ ∩ E″F″ → S″ */
  const eL=[Q[1].qf[0]-Q[0].qf[0],Q[1].qf[1]-Q[0].qf[1]], Sf=meet2(Q[0].qf,eL,Ef,eEF_F); if(!Sf) return null;
  items.push(seg(Q[0].qf,Sf,'thin'),seg(Q[1].qf,Sf,'thin'));
  let tS=(Sf[0]-Ef[0])/eEF_F[0]; steps.tTrace=tS; steps.Strace=v3.add(E,v3.mul(v3.sub(F,E),tS));
  if(err==='pick'){ const Lp=Math.hypot(...eEF_F); tS+=(o.pickSign||1)*6/Lp; }
  const S=v3.add(E,v3.mul(v3.sub(F,E),tS)); steps.S=S; steps.Sh=Math.abs(pl.sd(S));
  return {items,steps,S}; }
put('dzProg2a',{build,lift,meet2});
})();
