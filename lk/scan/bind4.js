/* ═══════════ ДЗ №4: привязка копии к варианту по очеркам тел (подписанных точек условия нет) ═══════════
   В ДЗ №2–3 вариант и масштаб дают подписанные точки условия (A″, B′ …). В ДЗ №4 условие — три тела, их размеры из таблицы
   варианта, и подписей у них нет (given: []). Зато очерки тел начерчены студентом ровно по размерам: окружности (основание
   конуса, сфера, торец цилиндра ⟂ π₂ …), прямые образующие, ось x. Чертёж-тип общий у пяти вариантов, размеры разные —
   поэтому вариант узнаётся по тому, как очерки КАЖДОГО варианта ложатся на начерченное:
     1. начерченное (уточнённые по карандашу отрезки, окружности, кривые; px вырезки) → точки через ~0,5 мм → карта
        расстояний до ближайшей точки (с номером этой точки);
     2. гипотезы подобия: каждая начерченная окружность (дуга ≥ 120°) ↔ каждая окружность очерков варианта — масштаб по
        отношению радиусов, сдвиг по центрам, поворот — по оси x (самый длинный почти горизонтальный отрезок), иначе 0;
     3. оценка — доля длины очерков варианта, легшая ближе 1,5 мм к карандашу; лучшие гипотезы уточняются ICP (пары
        «точка очерка → ближайшая точка начерченного», допуск 3 → 1,5 → 1 мм): подобие, затем аффинное, затем перспектива;
     4. вариант — с наибольшим покрытием очерков (у соседей по типу общие тела совпадают, отличаются размерами — отличает
        именно покрытие); невязка — СКО расстояний совпавших точек очерков, мм.
   Решает только «какой вариант и где он на фото»: верно ли построены линии пересечения — lk/scan/verify4.js.
   classify(P, tol) → {t:'S', a, b} | {t:'C', c, r, a1, a2, full, span} | {t:'L', p}  — ломаная (любые единицы) как отрезок / окружность / кривая;
   shapes(ref) → {samples:[[u,v]], ids, nOutl, circles:[{c, r, span}]}  — очерки варианта (lk/scan/dz4ref.json), кэш;
   bind(drawn {segs:[[x1,y1,x2,y2]], circles:[{cx,cy,r,full,span}], curves:[[[x,y]…]]}, REF {n: эталон}, {ppm, n}) →
     {dz:4, n, inl, of, rmsMm, ppm, A (мм → px: x = A0·u + A1·v + A2, y = A3·u + A4·v + A5), M (перспектива), hom, cover, prec, second} | null */
(function(){
'use strict';
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const IMG=isNode?require('../../lab/img.js'):self.LAB.img;
const plen=P=>{ let s=0; for(let i=1;i<P.length;i++) s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); return s; };
function dense(P,step){ const o=[P[0]]; for(let i=1;i<P.length;i++){ const a=P[i-1], b=P[i], L=Math.hypot(b[0]-a[0],b[1]-a[1]), n=Math.max(1,Math.ceil(L/step)); for(let k=1;k<=n;k++) o.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]); } return o; }
/* ── ломаная → отрезок / окружность / кривая ── */
function classify(P,tol){ tol=tol||0.15; const n=P.length; if(n<2) return null; const L=plen(P);
  if(n===2) return {t:'S',a:P[0],b:P[1]};
  let mx=0,my=0; P.forEach(p=>{ mx+=p[0]/n; my+=p[1]/n; }); let sxx=0,syy=0,sxy=0; P.forEach(p=>{ const dx=p[0]-mx, dy=p[1]-my; sxx+=dx*dx; syy+=dy*dy; sxy+=dx*dy; });
  const th=0.5*Math.atan2(2*sxy,sxx-syy), ux=Math.cos(th), uy=Math.sin(th); let dmax=0, t0=1e9, t1=-1e9;
  P.forEach(p=>{ const dx=p[0]-mx, dy=p[1]-my; dmax=Math.max(dmax,Math.abs(-dx*uy+dy*ux)); const t=dx*ux+dy*uy; t0=Math.min(t0,t); t1=Math.max(t1,t); });
  if(dmax<=tol) { const s=(P[n-1][0]-P[0][0])*ux+(P[n-1][1]-P[0][1])*uy>=0, a=[mx+ux*t0,my+uy*t0], b=[mx+ux*t1,my+uy*t1]; return s?{t:'S',a,b}:{t:'S',a:b,b:a}; }
  /* окружность: МНК Каса (x² + y² + Dx + Ey + F = 0), затем проверка отклонения */
  const S=[[0,0,0],[0,0,0],[0,0,0]], r=[0,0,0]; P.forEach(p=>{ const x=p[0]-mx, y=p[1]-my, z=-(x*x+y*y), v=[x,y,1]; for(let i=0;i<3;i++){ for(let j=0;j<3;j++) S[i][j]+=v[i]*v[j]; r[i]+=v[i]*z; } });
  const sol=n>=5?solve3(S,r):null; if(sol){ const cx=-sol[0]/2+mx, cy=-sol[1]/2+my, R=Math.sqrt(Math.max(0,sol[0]*sol[0]/4+sol[1]*sol[1]/4-sol[2]));
    if(R>0&&R<1e4&&P.every(p=>Math.abs(Math.hypot(p[0]-cx,p[1]-cy)-R)<=tol)){ let ang=P.map(p=>Math.atan2(p[1]-cy,p[0]-cx)), acc=0; for(let i=1;i<n;i++){ let d=ang[i]-ang[i-1]; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; acc+=d; }
      const span=Math.abs(acc)*180/Math.PI, deg=a=>((a*180/Math.PI)%360+360)%360, a1=acc>=0?deg(ang[0]):deg(ang[n-1]), a2=acc>=0?deg(ang[n-1]):deg(ang[0]);
      return {t:'C',c:[cx,cy],r:R,a1,a2,span:Math.min(360,span),full:span>=355}; } }
  return {t:'L',p:P}; }
function solve3(A,b){ const M=A.map((r,i)=>r.concat([b[i]])); for(let c=0;c<3;c++){ let p=c; for(let r=c+1;r<3;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r; if(Math.abs(M[p][c])<1e-12) return null; [M[c],M[p]]=[M[p],M[c]];
    for(let r=0;r<3;r++){ if(r===c) continue; const f=M[r][c]/M[c][c]; for(let k=c;k<4;k++) M[r][k]-=f*M[c][k]; } } return M.map((r,i)=>r[3]/r[i]); }
/* окружность по участку очерка: на эталоне ломаные бывают склеены из дуги и прямой — берём только круглые куски длиной ≥ 15 мм */
const CACHE=new Map();
/* куски одной окружности (видимость режет очерк на дуги) → одна: центр и радиус ближе 2 % радиуса (и 1,5 px/мм); центр и радиус —
   заново по точкам всех кусков, дуга — сумма */
function joinCircles(L,pts){ const G=[]; L.forEach((c,i)=>{ const g=G.find(x=>Math.hypot(x.c[0]-c.c[0],x.c[1]-c.c[1])<Math.max(1,0.02*c.r)&&Math.abs(x.r-c.r)<Math.max(1,0.02*c.r)); if(g){ g.span=Math.min(360,g.span+c.span); g.i.push(i); } else G.push(Object.assign({},c,{i:[i]})); });
  return G.map(g=>{ if(g.i.length<2||!pts) return g; const q=classify([].concat(...g.i.map(i=>pts[i])),1e9); return q&&q.t==='C'?Object.assign(g,{c:q.c,r:q.r}):g; }); }
function shapes(ref){ if(CACHE.has(ref)) return CACHE.get(ref); const samples=[], ids=[], circles=[], cp=[];
  (ref.outlines||[]).forEach((o,k)=>{ if(plen(o.p)<2) return; dense(o.p,1).forEach(p=>{ samples.push(p); ids.push(k); });
    const q=classify(o.p,0.2); if(q&&q.t==='C'&&q.span>=25&&q.r>=8&&q.r<=120){ circles.push({c:q.c,r:q.r,span:q.span,v:o.v}); cp.push(o.p); } });
  const r={samples,ids,nOutl:(ref.outlines||[]).length,circles:joinCircles(circles,cp).filter(c=>c.span>=60)}; CACHE.set(ref,r); return r; }

/* ── карта расстояний до начерченного (с номером ближайшей точки), шаг сетки g px ── */
function field(pts,W,H,g){ const w=Math.ceil(W/g)+2, h=Math.ceil(H/g)+2, D=new Float32Array(w*h).fill(1e9), I=new Int32Array(w*h).fill(-1);
  pts.forEach((p,k)=>{ const x=Math.round(p[0]/g), y=Math.round(p[1]/g); if(x<0||y<0||x>=w||y>=h) return; const i=y*w+x, d=Math.hypot(p[0]/g-x,p[1]/g-y); if(d<D[i]){ D[i]=d; I[i]=k; } });
  const rel=(i,j)=>{ if(I[j]<0) return; const p=pts[I[j]], x=i%w, y=(i/w)|0, d=Math.hypot(p[0]/g-x,p[1]/g-y); if(d<D[i]){ D[i]=d; I[i]=I[j]; } };
  for(let y=1;y<h;y++) for(let x=1;x<w-1;x++){ const i=y*w+x; rel(i,i-1); rel(i,i-w); rel(i,i-w-1); rel(i,i-w+1); }
  for(let y=h-2;y>=0;y--) for(let x=w-2;x>=1;x--){ const i=y*w+x; rel(i,i+1); rel(i,i+w); rel(i,i+w+1); rel(i,i+w-1); }
  for(let y=1;y<h;y++) for(let x=1;x<w-1;x++){ const i=y*w+x; rel(i,i-1); rel(i,i-w); rel(i,i-w-1); rel(i,i-w+1); }
  /* d(x, y) → [расстояние px, номер точки] */
  return (x,y)=>{ const X=Math.round(x/g), Y=Math.round(y/g); if(X<0||Y<0||X>=w||Y>=h) return [1e9,-1]; const k=I[Y*w+X]; if(k<0) return [1e9,-1]; const p=pts[k]; return [Math.hypot(p[0]-x,p[1]-y),k]; }; }

/* подобие и аффинное по парам (мм → px) */
function simFit(P){ const n=P.length; if(n<2) return null; let mx=0,my=0,px=0,py=0; P.forEach(([m,p])=>{ mx+=m[0]; my+=m[1]; px+=p[0]; py+=p[1]; }); mx/=n; my/=n; px/=n; py/=n;
  let sxx=0,sab=0,sba=0; P.forEach(([m,p])=>{ const u=m[0]-mx, v=m[1]-my, X=p[0]-px, Y=p[1]-py; sxx+=u*u+v*v; sab+=u*X+v*Y; sba+=u*Y-v*X; }); if(sxx<1e-9) return null;
  const a=sab/sxx, b=sba/sxx; return [a,-b,px-(a*mx-b*my),b,a,py-(b*mx+a*my)]; }
function affFit(P){ if(P.length<6) return null; const S=[[0,0,0],[0,0,0],[0,0,0]], bx=[0,0,0], by=[0,0,0];
  P.forEach(([m,p])=>{ const r=[m[0],m[1],1]; for(let a=0;a<3;a++){ for(let b=0;b<3;b++) S[a][b]+=r[a]*r[b]; bx[a]+=r[a]*p[0]; by[a]+=r[a]*p[1]; } });
  const X=solve3(S,bx), Y=solve3(S,by); return X&&Y?X.concat(Y):null; }
const apA=(A,m)=>[A[0]*m[0]+A[1]*m[1]+A[2],A[3]*m[0]+A[4]*m[1]+A[5]];

function bind(drawn,REF,o){ o=o||{}; const segs=drawn.segs||[], circ=drawn.circles||[], curves=drawn.curves||[];
  /* начерченное → точки через ~1 px */
  const pts=[]; segs.forEach(s=>dense([[s[0],s[1]],[s[2],s[3]]],1).forEach(p=>pts.push(p))); curves.forEach(c=>dense(c,1).forEach(p=>pts.push(p)));
  circ.forEach(c=>{ const full=c.full||c.a1==null, a0=full?0:c.a1, L=full?360:((c.a2-c.a1+360)%360)||360, n=Math.max(8,Math.ceil(2*Math.PI*c.r*L/360)); for(let i=0;i<=n;i++){ const a=(a0+L*i/n)*Math.PI/180; pts.push([c.cx+c.r*Math.cos(a),c.cy+c.r*Math.sin(a)]); } });
  if(pts.length<50||!circ.length) return null;
  let W=0,H=0; pts.forEach(p=>{ W=Math.max(W,p[0]); H=Math.max(H,p[1]); }); const F=field(pts.filter(p=>p[0]>=0&&p[1]>=0),W+2,H+2,2), PT=pts.filter(p=>p[0]>=0&&p[1]>=0);
  /* поворот — по оси x: самый длинный почти горизонтальный отрезок (на вырезке лист уже повёрнут подписями вверх) */
  let th=0, axL=0; segs.forEach(s=>{ const L=Math.hypot(s[2]-s[0],s[3]-s[1]), a=Math.atan2(s[3]-s[1],s[2]-s[0]), a2=a>Math.PI/2?a-Math.PI:a<-Math.PI/2?a+Math.PI:a; if(Math.abs(a2)<0.17&&L>axL){ axL=L; th=a2; } });
  const cs=circ.map(c=>{ const full=c.full||c.a1==null; return {c:[c.cx,c.cy],r:c.r,span:full?360:(c.span!=null?c.span:((c.a2-c.a1+360)%360))}; });
  const ppm0=o.ppm||null, ns=o.n?[+o.n]:Object.keys(REF).map(Number), dc=joinCircles(cs,null).filter(c=>c.span>=90&&c.r>3).map(c=>({cx:c.c[0],cy:c.c[1],r:c.r}));
  const cover=(A,S,tolPx)=>{ let k=0; for(const m of S.samples){ const p=apA(A,m); if(F(p[0],p[1])[0]<=tolPx) k++; } return k/S.samples.length; };
  const icp=(A,S,tolsMm,mode)=>{ for(const t of tolsMm){ const s=Math.sqrt(Math.abs(A[0]*A[4]-A[1]*A[3])), P=[];
      S.samples.forEach(m=>{ const p=apA(A,m), [d,k]=F(p[0],p[1]); if(k>=0&&d<=t*s) P.push([m,PT[k]]); });
      const B=(mode==='aff'?affFit(P):null)||simFit(P); if(!B) break; A=B; } return A; };
  const res=[];
  ns.forEach(n=>{ const ref=REF[n]; if(!ref) return; const S=shapes(ref); if(!S.samples.length) return; const hyp=[];
    S.circles.forEach(rc=>dc.forEach(c=>{ const s=c.r/rc.r; if(ppm0&&(s<ppm0*0.5||s>ppm0*2)) return; if(s<0.5||s>30) return;
      const ca=Math.cos(th)*s, sa=Math.sin(th)*s, A=[ca,-sa,0,sa,ca,0]; A[2]=c.cx-(A[0]*rc.c[0]+A[1]*rc.c[1]); A[5]=c.cy-(A[3]*rc.c[0]+A[4]*rc.c[1]);
      hyp.push({A,sc:cover(A,S,1.5*s)}); }));
    hyp.sort((a,b)=>b.sc-a.sc); let best=null;
    hyp.slice(0,4).forEach(h=>{ let A=icp(h.A,S,[6,4,3,2],'sim'); A=icp(A,S,[3,2,1.5,1],'aff'); const s=Math.sqrt(Math.abs(A[0]*A[4]-A[1]*A[3])), cv=cover(A,S,1*s);
      if(!best||cv>best.cv) best={A,cv,s}; });
    if(best) res.push(Object.assign({n,S},best)); });
  if(!res.length) return null; res.sort((a,b)=>b.cv-a.cv);
  /* перспектива снимка: три лучших варианта уточняются ICP с гомографией (наклон телефона аффинное не берёт: низ листа
     уезжает на 1–2 мм) — и только потом сравниваются */
  const apM=(M,m)=>IMG.H.apply(M,m), stat=(M,S,s)=>{ const hit=new Map(), tot=new Map(), d2=[], pairs=[]; let k1=0;
    S.samples.forEach((m,i)=>{ const k=S.ids[i]; tot.set(k,(tot.get(k)||0)+1); const p=apM(M,m), [d,j]=F(p[0],p[1]); if(d<=1*s){ k1++; hit.set(k,(hit.get(k)||0)+1); d2.push(d*d); pairs.push([m,PT[j]]); } });
    return {cv:k1/S.samples.length,inl:[...tot.keys()].filter(k=>(hit.get(k)||0)>=0.6*tot.get(k)).length,of:tot.size,rms:Math.sqrt(d2.reduce((a,v)=>a+v,0)/Math.max(1,d2.length))/s,pairs}; };
  res.slice(0,3).forEach(b=>{ let M=b.A.concat([0,0,1]); b.st=stat(M,b.S,b.s);
    for(const t of [3,2,1.5,1,1]){ const P=[]; b.S.samples.forEach(m=>{ const p=apM(M,m), [d,k]=F(p[0],p[1]); if(k>=0&&d<=t*b.s) P.push([m,PT[k]]); }); if(P.length<40) break;
      let M2=null; try{ M2=IMG.H.fit(P.map(q=>q[0]),P.map(q=>q[1])); }catch(e){} if(!M2) break; const st=stat(M2,b.S,b.s); if(st.cv+1e-9<b.st.cv-0.01) break; M=M2; b.st=st; b.M=M; } });
  const top=res.slice(0,3).sort((a,b)=>b.st.cv-a.st.cv), B=top[0], st=B.st, second=top[1]||res[1];
  const r={dz:4,n:B.n,inl:st.inl,of:st.of,rmsMm:+st.rms.toFixed(3),ppm:B.s,A:B.A,cover:+st.cv.toFixed(3),second:second?{n:second.n,cover:+(second.st?second.st.cv:second.cv).toFixed(3)}:null};
  if(B.M){ r.M=B.M; r.hom={inl:st.inl,rmsMm:+st.rms.toFixed(3)}; }
  return r; }

const api={classify,shapes,bind,dense,plen};
if(isNode) module.exports=api; else self.SCANBIND4=api;
})();
