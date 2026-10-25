/* ═══════════ ДЗ №3 г): угол SA с основанием — по шагам начерченного построения ═══════════
   Способ (вращение вокруг прямой уровня): плоскость Σ = (SA, n), n ⟂ ABC через S (n″ ⟂ f″, n′ ⟂ h′);
   1. горизонталь Σ: h₁″ ∥ x на высоте z = c; на ней 3″ = A″S″ ∩ h₁″ и 4″ = n″ ∩ h₁″;
   2. линии связи вниз: 3′ — на прямой S′A′ (её продолжении), 4′ — на n′; h₁′ = 3′4′;
   3. вращение S вокруг h₁: O_s′ — основание перпендикуляра из S′ на h₁′; радиус R = √(|S′O_s′|² + (c − z_S)²);
      S̄′ — на этом перпендикуляре в R от O_s′;
   4. ψ — угол при S̄′ между S̄′3′ (это SA) и S̄′4′ (это n); φ = 90° − ψ.
   Каждый шаг меряется по линиям листа и сверяется со своим предыдущим шагом студента (как explain2.js):
   неверная 3′ даёт неверную h₁′ — дальше всё честно, но угол уже другой.
   explain3d(segs, data) → {steps:[{k,name,status,msg,val}], first, pts}; segs — отрезки листа в мм чертежа (от O). */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const DZ=isNode?require('../../core/dz.js'):self.CORE.dz, {v3}=DZ;
const v2={sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],add:(a,b)=>[a[0]+b[0],a[1]+b[1]],mul:(a,k)=>[a[0]*k,a[1]*k],dot:(a,b)=>a[0]*b[0]+a[1]*b[1],cr:(a,b)=>a[0]*b[1]-a[1]*b[0],len:a=>Math.hypot(a[0],a[1])};
v2.unit=a=>{ const l=v2.len(a)||1; return [a[0]/l,a[1]/l]; }; v2.dist=(a,b)=>v2.len(v2.sub(a,b));
const ang=(e,f)=>Math.acos(Math.min(1,Math.abs(v2.dot(v2.unit(e),v2.unit(f)))))*180/Math.PI;
const Fp=P=>[-P[0],-P[2]], Hp=P=>[-P[0],P[1]];
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');
const TOL=1.5, BAD=3;
const dirOf=s=>v2.unit(v2.sub(s.b,s.a)), lenOf=s=>v2.dist(s.a,s.b);
const meet=(p,e,q,f)=>{ const d=v2.cr(e,f); if(Math.abs(d)<1e-9) return null; const t=v2.cr(v2.sub(q,p),f)/d; return v2.add(p,v2.mul(e,t)); };
/* насколько отрезок p→q покрыт отрезками листа вдоль него (±0,8 мм, ±3°) */
function support(segs,p,q){ const L=v2.dist(p,q); if(L<2) return 1; const e=v2.unit(v2.sub(q,p)), n=[-e[1],e[0]]; const iv=[];
  segs.forEach(s=>{ if(ang(dirOf(s),e)>3) return; if(Math.abs(v2.dot(v2.sub(s.a,p),n))>0.8||Math.abs(v2.dot(v2.sub(s.b,p),n))>0.8) return; const t=[v2.dot(v2.sub(s.a,p),e),v2.dot(v2.sub(s.b,p),e)].sort((x,y)=>x-y); if(t[1]>0&&t[0]<L) iv.push([Math.max(0,t[0]),Math.min(L,t[1])]); });
  iv.sort((a,b)=>a[0]-b[0]); let tot=0,cx=-1,cy=-1; iv.forEach(([x,y])=>{ if(x>cy){ if(cy>cx) tot+=cy-cx; cx=x; cy=y; } else cy=Math.max(cy,y); }); if(cy>cx) tot+=cy-cx; return tot/L; }
/* прямые листа через точку p (±0,8 мм, отрезок доходит до p ±3 мм), не вдоль направления ex */
function through(segs,p,ex,minLen,tol,reach){ const R=reach||3; return segs.filter(s=>{ const l=lenOf(s); if(l<(minLen||10)) return false; const e=dirOf(s); if(ex&&ang(e,ex)<12) return false; const off=Math.abs(v2.cr(v2.sub(p,s.a),e)), t=v2.dot(v2.sub(p,s.a),e); return off<=(tol||0.8)&&t>=-R&&t<=l+R; }); }
/* как support, но допуск поперёк tol (прямая от руки и её куски чуть расходятся) */
function supportT(segs,p,q,tol){ const L=v2.dist(p,q); if(L<2) return 1; const e=v2.unit(v2.sub(q,p)), n=[-e[1],e[0]]; const iv=[];
  segs.forEach(s=>{ if(ang(dirOf(s),e)>4) return; if(Math.abs(v2.dot(v2.sub(s.a,p),n))>tol||Math.abs(v2.dot(v2.sub(s.b,p),n))>tol) return; const t=[v2.dot(v2.sub(s.a,p),e),v2.dot(v2.sub(s.b,p),e)].sort((x,y)=>x-y); if(t[1]>0&&t[0]<L) iv.push([Math.max(0,t[0]),Math.min(L,t[1])]); });
  iv.sort((a,b)=>a[0]-b[0]); let tot=0,cx=-1,cy=-1; iv.forEach(([x,y])=>{ if(x>cy){ if(cy>cx) tot+=cy-cx; cx=x; cy=y; } else cy=Math.max(cy,y); }); if(cy>cx) tot+=cy-cx; return tot/L; }
/* коллинеарные куски одной прямой (линия от руки рвётся на пересечениях) — один отрезок от крайнего до крайнего */
function merged(segs){ const G=[]; segs.slice().sort((p,q)=>lenOf(q)-lenOf(p)).forEach(s=>{ const e=dirOf(s); const g=G.find(g=>ang(g.e,e)<2.5&&Math.abs(v2.cr(v2.sub(s.a,g.p),g.e))<1&&Math.abs(v2.cr(v2.sub(s.b,g.p),g.e))<1);
    if(g){ g.ss.push(s); } else G.push({p:s.a,e,ss:[s]}); });
  return G.map(g=>{ const t=g.ss.flatMap(s=>[s.a,s.b]).map(p=>v2.dot(v2.sub(p,g.p),g.e)), t0=Math.min(...t), t1=Math.max(...t), ink=g.ss.reduce((m,s)=>m+lenOf(s),0);
    return {a:v2.add(g.p,v2.mul(g.e,t0)),b:v2.add(g.p,v2.mul(g.e,t1)),k:g.ss[0].k,ink,parts:g.ss.length}; }).filter(m=>m.ink>=0.5*v2.dist(m.a,m.b)); }
const st=(dev,tol,bad)=>dev<=tol?'ok':dev>=bad?'bad':'?';

function explain3d(segs,data,o){ o=o||{}; const {A,B,C,S}=data, n=v3.unit(v3.cross(v3.sub(B,A),v3.sub(C,A))), steps=[], pts={};
  const h3=v3.unit([n[1],-n[0],0]), hH=v2.unit([-h3[0],h3[1]]), nF=v2.unit([-n[0],-n[2]]), nH=v2.unit([-n[0],n[1]]);
  const SF=Fp(S), AF=Fp(A), SH=Hp(S), AH=Hp(A), eSA_F=v2.unit(v2.sub(SF,AF)), eSA_H=v2.unit(v2.sub(SH,AH));
  /* ── 1. h₁″: горизонталь π₂, пересекающая n″ (из S″) и продолжение A″S″; обе прямые — начерченные студентом
     (через S″ ±1 мм, направление ±6° от нужного): дальше всё от них, а их отклонение от нужного — тоже шаг ── */
  /* оси эпюра — не линии построения: точка построения может случайно лечь на ось (3′ при x₃ ≈ 0), и длинная ось
     тогда «проходит через неё» — её брали за S̄′3′, и S̄′ садилась на ось */
  const onAxis=m=>{ const e=dirOf(m); return ang(e,[0,1])<=1.5&&Math.abs((m.a[0]+m.b[0])/2)<0.8||ang(e,[1,0])<=1.5&&Math.abs((m.a[1]+m.b[1])/2)<0.8; };
  const ML=merged(segs).filter(m=>!onAxis(m));
  const lineThru=(P,e,maxA)=>ML.filter(s=>lenOf(s)>=10&&ang(dirOf(s),e)<=maxA&&Math.abs(v2.cr(v2.sub(P,s.a),dirOf(s)))<=1.5).sort((p,q)=>lenOf(q)-lenOf(p))[0];
  const nLine=lineThru(SF,nF,6), saLine=lineThru(SF,eSA_F,3), enF=nLine?(v2.dot(dirOf(nLine),nF)<0?v2.mul(dirOf(nLine),-1):dirOf(nLine)):nF, eSA=saLine?(v2.dot(dirOf(saLine),eSA_F)<0?v2.mul(dirOf(saLine),-1):dirOf(saLine)):eSA_F;
  const H1=[]; ML.forEach(s=>{ if(lenOf(s)<15||ang(dirOf(s),[1,0])>1.5) return; const v=(s.a[1]+s.b[1])/2; if(v>-1) return;
    if(Math.abs(-v-S[2])<5) return;   /* горизонталь через саму S — 3 ≡ 4 ≡ S, оси нет */
    const p3=meet(SF,eSA,[0,v],[1,0]), p4=meet(SF,enF,[0,v],[1,0]); if(!p3||!p4) return; const u0=Math.min(s.a[0],s.b[0])-4, u1=Math.max(s.a[0],s.b[0])+4; if(p3[0]<u0||p3[0]>u1||p4[0]<u0||p4[0]>u1) return;
    const sup=supportT(segs,SF,p3,1.2)+supportT(segs,SF,p4,1.2); if(sup<1.2) return; H1.push({v,c:-v,p3,p4,sup,s}); });
  H1.sort((a,b)=>b.sup-a.sup); const h1=H1[0];
  /* вторая горизонталь с почти той же опорой — дальше 0,8 мм (merged уже слил куски одной линии): какую строили, не
     различить. Было 1,5 мм — и остаток сетки на z = 70 в 1,4 мм от настоящей h₁″ (71,4) проходил за неё */
  if(!h1||H1[1]&&H1[1].sup>=0.9*h1.sup&&Math.abs(H1[1].c-h1.c)>0.8){ steps.push({k:'h1f',name:'горизонталь h₁″ плоскости (SA, n)',status:'?',msg:h1?'несколько горизонталей подходят — какую строили, не различить':'не нашёл h₁″ ∥ x, пересекающей n″ и продолжение A″S″'}); return {steps,first:null,pts}; }
  const dn=ang(enF,nF), sN=nLine?st(dn,TOL,BAD):'?';
  steps.push({k:'h1f',name:'n″ ⟂ f″ и горизонталь h₁″ плоскости (SA, n)',status:sN==='bad'?'bad':'ok',msg:(nLine?(sN==='ok'?'n″ ⟂ f″ (отклонение '+f1(dn)+'°)':'n″ отклонена от ⟂ f″ на '+f1(dn)+'°'+(sN==='bad'?' — перпендикуляр к ABC построен неверно':'')):'n″ по листу не найдена, беру расчётную')+'; h₁″ ∥ x на высоте z = '+f1(h1.c)+' мм; 3″ = A″S″ ∩ h₁″, 4″ = n″ ∩ h₁″',val:{c:h1.c,dn}}); pts.p3F=h1.p3; pts.p4F=h1.p4;
  /* ── 2. 3′ и 4′: по линиям связи; где их взял студент — где его h₁′ пересекает линии связи ── */
  /* линии связи — те, что студент провёл из своих 3″ и 4″ (вертикаль у расчётной точки, ±2,5 мм): дальше всё — от них */
  const vAt=u=>merged(segs).filter(s=>lenOf(s)>=10&&ang(dirOf(s),[0,1])<=1.5&&Math.abs((s.a[0]+s.b[0])/2-u)<=2.5&&Math.max(s.a[1],s.b[1])>0).sort((p,q)=>Math.abs((p.a[0]+p.b[0])/2-u)-Math.abs((q.a[0]+q.b[0])/2-u))[0];
  const L3v=vAt(h1.p3[0]), L4v=vAt(h1.p4[0]), u3=L3v?(L3v.a[0]+L3v.b[0])/2:h1.p3[0], u4=L4v?(L4v.a[0]+L4v.b[0])/2:h1.p4[0];
  const E3=meet(AH,eSA_H,[u3,0],[0,1]), E4=meet(SH,nH,[u4,0],[0,1]); pts.E3=E3; pts.E4=E4;
  const vert=u=>merged(segs).filter(s=>lenOf(s)>=10&&ang(dirOf(s),[0,1])<=1.5&&Math.abs((s.a[0]+s.b[0])/2-u)<=1);
  const reach=(u,v)=>vert(u).some(s=>Math.min(s.a[1],s.b[1])-2<=v&&Math.max(s.a[1],s.b[1])+2>=v);
  /* h₁′ — не ребро заданной пирамиды и не прямая через S′ (n′, S′A′): у неё с линиями связи тоже бывают пересечения */
  const onLine=(s,p,q)=>{ const e=v2.unit(v2.sub(q,p)), n=[-e[1],e[0]]; return ang(dirOf(s),e)<3&&Math.abs(v2.dot(v2.sub(s.a,p),n))<1&&Math.abs(v2.dot(v2.sub(s.b,p),n))<1; };
  const known=[['A','B'],['B','C'],['C','A'],['S','A'],['S','B'],['S','C']].map(([a,b])=>[Hp(data[a]),Hp(data[b])]);
  const H1h=[]; merged(segs).forEach(s=>{ if(lenOf(s)<15||ang(dirOf(s),[0,1])<20) return; const e=dirOf(s); if(Math.max(s.a[1],s.b[1])<1) return;
    if(known.some(([p,q])=>onLine(s,p,q))||Math.abs(v2.cr(v2.sub(SH,s.a),e))<1||ang(e,hH)<2) return;   /* и не h′ плоскости ABC */
    const q3=meet(s.a,e,[u3,0],[0,1]), q4=meet(s.a,e,[u4,0],[0,1]); if(!q3||!q4||q3[1]<0||q4[1]<0) return; const L=lenOf(s), t3=v2.dot(v2.sub(q3,s.a),e), t4=v2.dot(v2.sub(q4,s.a),e);
    if(t3<-4||t3>L+4||t4<-4||t4>L+4) return; const r=(reach(u3,q3[1])?1:0)+(reach(u4,q4[1])?1:0); if(!r) return; H1h.push({s,e,q3,q4,r,L}); });
  /* выбор h₁′: прямая, проходящая через ОБЕ верные точки (3′ на S′A′, 4′ на n′), — построение верно, она и есть;
     иначе — по линиям связи и длине, а если подходят разные прямые — «?» (неверный выбор дал бы ложную ошибку) */
  H1h.forEach(c=>{ c.both=Math.abs(c.q3[1]-E3[1])<=1.5&&Math.abs(c.q4[1]-E4[1])<=1.5; });
  H1h.sort((a,b)=>(b.both-a.both)||b.r-a.r||b.L-a.L); const hh=H1h[0];
  const rivals=hh&&!hh.both?H1h.slice(1).filter(c=>c.r===hh.r&&(Math.abs(c.q3[1]-hh.q3[1])>1.5||Math.abs(c.q4[1]-hh.q4[1])>1.5)):[];
  if(!hh||rivals.length){ steps.push({k:'p3',name:'точки 3′ и 4′ (по линиям связи)',status:'?',msg:hh?'несколько прямых подходят на роль h₁′ — какую строили, не различить':'не нашёл h₁′, пересекающей линии связи из 3″ и 4″'}); return {steps,first:firstBad(steps),pts}; }
  /* погрешность «где должна быть» 3′ и 4′: от точности S′ и A′ на листе (given.js, σ координат) */
  const sg=o.sig||{}, sS=sg.S?Math.hypot(sg.S[0]||0,sg.S[1]||0):0.3, sA=sg.A?Math.hypot(sg.A[0]||0,sg.A[1]||0):0.3, e3=Math.max(sS,sA), e4=sS;
  const stE=(d,e)=>d<=TOL+2*e?'ok':d-2*e>=BAD?'bad':'?';
  const d3=Math.abs(hh.q3[1]-E3[1]), d4=Math.abs(hh.q4[1]-E4[1]), s3=stE(d3,e3), s4=stE(d4,e4); pts.q3=hh.q3; pts.q4=hh.q4;
  /* через какую линию листа студент взял неверную точку (направление h′, A′B′, …) */
  const named=q=>{ const names=[['h′',hH],['A′B′',v2.sub(Hp(B),AH)],['B′C′',v2.sub(Hp(C),Hp(B))],['C′A′',v2.sub(AH,Hp(C))],['S′A′',eSA_H],['n′',nH]];
    const L=through(segs,q,[0,1],12).filter(s=>ang(dirOf(s),hh.e)>=5); for(const s of L){ const nm=names.find(([,d])=>ang(dirOf(s),d)<=2); if(nm) return nm[0]; } return null; };
  let msg=[];
  if(s3==='ok') msg.push('3′ на продолжении S′A′'); else { const nm=s3==='bad'?named(hh.q3):null; msg.push('3′ взята в '+f1(d3)+' мм от прямой S′A′'+(nm?' — на пересечении линии связи с '+nm+', а нужно с продолжением S′A′':'')); }
  if(s4==='ok') msg.push('4′ на n′'); else { const nm=s4==='bad'?named(hh.q4):null; msg.push('4′ взята в '+f1(d4)+' мм от n′'+(nm?' — на '+nm:'')); }
  let s34=s3==='bad'||s4==='bad'?'bad':s3==='?'||s4==='?'?'?':'ok';
  /* «неверно» — только если найденная прямая и правда ось студента: от S′ к ней проведён перпендикуляр (радиус
     вращения, хоть наполовину). Чужая прямая через обе линии связи (ребро вида сверху) его не имеет — тогда «?» */
  if(s34==='bad'){ const e0=v2.unit(v2.sub(hh.q4,hh.q3)), n0=[-e0[1],e0[0]], O0=v2.sub(SH,v2.mul(n0,v2.dot(v2.sub(SH,hh.q3),n0)));
    if(v2.dist(SH,O0)>=3&&supportT(segs,SH,O0,1.2)<0.5){ s34='?'; msg=['прямая через линии связи найдена, но перпендикуляра к ней из S′ нет — она ли ось вращения, не ясно']; } }
  steps.push({k:'p3',name:'точки 3′ и 4′ (по линиям связи)',status:s34,msg:msg.join('; '),val:{d3,d4}});
  /* ── 3. вращение: радиус для ЕГО оси h₁′ (через его 3′ и 4′) ── */
  const ax={p:hh.q3,e:v2.unit(v2.sub(hh.q4,hh.q3))}, nax=[-ax.e[1],ax.e[0]], Os=v2.sub(SH,v2.mul(nax,v2.dot(v2.sub(SH,ax.p),nax))), r1=v2.dist(SH,Os), R=Math.hypot(r1,h1.c-S[2]);
  pts.Os=Os;
  /* S̄′ — где сходятся прямые листа из его 3′ и 4′ (не h₁′) вблизи перпендикуляра из S′ на h₁′ */
  /* прямые из его 3′ и 4′ (направления — по отрезкам через эти точки); S̄′ — их пересечение у перпендикуляра из S′
     на h₁′ (±6 мм: студент мог и этот перпендикуляр провести неточно — тогда это видно на шаге 3); прямая начерчена
     от точки до S̄′ хотя бы наполовину (куски от руки рвутся) */
  /* прямые через S′ (сама S′A′ проходит через верную 3′, n′ — через 4′) — не лучи к S̄′: их пересечение — S′ */
  const notS=L=>L.filter(q=>Math.abs(v2.cr(v2.sub(SH,q.a),dirOf(q)))>1.5);
  const L3=notS(through(ML,hh.q3,ax.e,10,1.5,8)), L4=notS(through(ML,hh.q4,ax.e,10,1.5,8));   /* у загромождённой точки линия от руки часто начинается в нескольких мм */ let best=null;
  L3.forEach(a=>L4.forEach(b=>{ if(a===b) return; const ea=dirOf(a), eb=dirOf(b); if(ang(ea,eb)<8) return; const X=meet(hh.q3,ea,hh.q4,eb); if(!X) return;const off=Math.abs(v2.dot(v2.sub(X,Os),ax.e)); if(off>6) return;
    const dX=v2.dist(X,Os); if(dX<5||v2.dist(X,SH)<3) return; const s3=supportT(segs,hh.q3,X,1.2), s4=supportT(segs,hh.q4,X,1.2); if(s3<0.5||s4<0.5) return;
    /* S̄′ лежит на начерченном перпендикуляре из S′ через O_s′ (его студент проводит, чтобы отложить радиус) */
    const sp=supportT(segs,SH,X,1.2); if(sp<0.4) return;
    const sc=s3+s4+sp-0.05*off; if(!best||sc>best.sc) best={sc,X,ea,eb,off}; }));
  if(!best){ steps.push({k:'rot',name:'вращение S вокруг h₁ (радиус)',status:'?',msg:'не нашёл повёрнутую S̄′ (где сходятся прямые из 3′ и 4′)'}); return {steps,first:firstBad(steps),pts}; }
  const Rs=v2.dist(best.X,Os), dR=Math.abs(Rs-R), sR=stE(dR,sS); pts.Sbar=best.X;
  steps.push({k:'rot',name:'вращение S вокруг h₁ (радиус)',status:sR,msg:sR==='ok'?'радиус вращения S отложен верно: '+f1(Rs)+' мм (нужно '+f1(R)+' — гипотенуза из |S′O_s′| = '+f1(r1)+' и Δz = '+f1(Math.abs(h1.c-S[2]))+')':'радиус вращения S отложен '+f1(Rs)+' мм вместо '+f1(R)+' мм (гипотенуза из |S′O_s′| = '+f1(r1)+' и Δz = '+f1(Math.abs(h1.c-S[2]))+')',val:{R:Rs,R0:R}});
  /* ── 4. угол ψ при S̄′ и φ = 90° − ψ ── */
  /* ψ — по точкам: S̄′ и его 3′, 4′ (направления по кускам прямых от руки менее точны, чем сами точки) */
  const psi=ang(v2.sub(hh.q3,best.X),v2.sub(hh.q4,best.X)), phi=90-psi, r=DZ.solve("3",data);
  /* σψ: точки S̄′, 3′, 4′ — каждая ±0,4 мм (узлы линий от руки) */
  let q2=0; [[0,0.4],[1,0.4]].forEach(([i,dd])=>[hh.q3,hh.q4,best.X].forEach((P0,k)=>{ const P=[P0[0],P0[1]]; P[i]+=dd; const a=k===0?P:hh.q3, b=k===1?P:hh.q4, x=k===2?P:best.X; q2+=(ang(v2.sub(a,x),v2.sub(b,x))-psi)**2; }));
  const spsi=Math.sqrt(q2);
  /* какой угол получился бы при его 3′, 4′, но верном радиусе — чтобы сказать, откуда разница */
  const Sbar0=v2.add(Os,v2.mul(v2.unit(v2.sub(best.X,Os)),R)), psi0=ang(v2.sub(hh.q3,Sbar0),v2.sub(hh.q4,Sbar0));
  steps.push({k:'psi',name:'угол ψ при S̄′ и φ = 90° − ψ',status:'ok',msg:'на чертеже ψ = '+f1(psi)+' ± '+f1(spsi)+'°, значит φ = '+f1(phi)+'° (для начерченной пирамиды нужно '+f1(r.phi)+'°)',val:{psi,phi,spsi,phi0:90-psi0,ref:r.phi}});
  return {steps,first:firstBad(steps),pts,phi,ref:r.phi}; }
function firstBad(steps){ for(const s of steps){ if(s.status==='bad') return s; if(!s.val) return null; } return null; }
put('dzExplain3d',{explain3d});
})();
