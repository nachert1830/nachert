/* АВТОГЕНЕРАЦИЯ: node hands/tools/extract-models.js — не править руками. Источник: index.html (IG3, IG_VARS, IG_DIMS, IG_WB, IGUI); в экспорт IG3 добавлены CSG, featLines, silLines. */
window.IG3=(function(){
/* ── описание детали: конструкторы ── */
const P={
  cyl:(r,z0,z1,o)=>Object.assign({t:'cyl',r,z0,z1,x:0,y:0},o||{}),
  cone:(r0,r1,z0,z1,o)=>Object.assign({t:'cone',r0,r1,z0,z1,x:0,y:0},o||{}),
  box:(sx,sy,z0,z1,o)=>Object.assign({t:'box',sx,sy,z0,z1,x:0,y:0,a:0},o||{}),
  /* правильная призма: n сторон, s — размер «под ключ» (между параллельными гранями; для n нечётного — апофема×2) */
  ngon:(n,s,z0,z1,o)=>Object.assign({t:'ngon',n,s,z0,z1,x:0,y:0,a:0},o||{}),
  /* правильная пирамида/усечённая: апофемы s0 внизу, s1 вверху (как ngon) */
  npyr:(n,s0,s1,z0,z1,o)=>Object.assign({t:'npyr',n,s0,s1,z0,z1,x:0,y:0,a:0},o||{}),
  /* горизонтальный цилиндр вдоль оси 'x' или 'y' */
  hcyl:(ax,r,c,u0,u1,o)=>Object.assign({t:'hcyl',ax,r,cx:c[0],cz:c[1],u0,u1},o||{}),
  /* полупространство: dot(n, p − o) ≤ 0 */
  hp:(n,o)=>{ const l=Math.hypot(...n); const u=n.map(v=>v/l); return {t:'hp',n:u,c:u[0]*o[0]+u[1]*o[1]+u[2]*o[2]}; },
  U:(...k)=>({t:'u',k}), S:(a,...k)=>({t:'s',a,k}), I:(...k)=>({t:'i',k}),
  /* n отверстий диаметра d на окружности D, первое под углом a0 (град от оси +x против часовой) */
  holes:(n,d,D,z0,z1,a0,step)=>{ const out=[]; for(let i=0;i<n;i++){ const a=((a0||0)+(step||360/n)*i)*Math.PI/180; out.push(P.cyl(d/2,z0,z1,{x:D/2*Math.cos(a),y:D/2*Math.sin(a)})); } return out; }
};
/* ── функция расстояния на JS (для сечений) ── */
const len2=(x,y)=>Math.hypot(x,y);
function sdCapZ(d2,z,z0,z1){ const h=(z1-z0)/2, dz=Math.abs(z-(z0+z1)/2)-h; const ax=Math.max(d2,0), az=Math.max(dz,0); return Math.min(Math.max(d2,dz),0)+Math.hypot(ax,az); }
function ngon2(x,y,n,s,a){ const ap=s/2; let m=-1e9; for(let i=0;i<n;i++){ const t=a*Math.PI/180+(i+.5)*2*Math.PI/n; m=Math.max(m,x*Math.cos(t)+y*Math.sin(t)-ap); } return m; }
function J(nd,x,y,z){
  switch(nd.t){
    case 'cyl': return sdCapZ(len2(x-nd.x,y-nd.y)-nd.r,z,nd.z0,nd.z1);
    case 'cone':{ const t=Math.min(1,Math.max(0,(z-nd.z0)/(nd.z1-nd.z0))), r=nd.r0+(nd.r1-nd.r0)*t, k=Math.cos(Math.atan2(nd.r1-nd.r0,nd.z1-nd.z0)); return sdCapZ((len2(x-nd.x,y-nd.y)-r)*Math.abs(k),z,nd.z0,nd.z1); }
    case 'box':{ const c=Math.cos(-nd.a*Math.PI/180), s=Math.sin(-nd.a*Math.PI/180), px=(x-nd.x)*c-(y-nd.y)*s, py=(x-nd.x)*s+(y-nd.y)*c;
      const dx=Math.abs(px)-nd.sx/2, dy=Math.abs(py)-nd.sy/2, d2=Math.min(Math.max(dx,dy),0)+Math.hypot(Math.max(dx,0),Math.max(dy,0)); return sdCapZ(d2,z,nd.z0,nd.z1); }
    case 'ngon': return sdCapZ(ngon2(x-nd.x,y-nd.y,nd.n,nd.s,nd.a),z,nd.z0,nd.z1);
    case 'npyr':{ const t=Math.min(1,Math.max(0,(z-nd.z0)/(nd.z1-nd.z0))), s=nd.s0+(nd.s1-nd.s0)*t, k=Math.cos(Math.atan2((nd.s1-nd.s0)/2,nd.z1-nd.z0)); return sdCapZ(ngon2(x-nd.x,y-nd.y,nd.n,s,nd.a)*Math.abs(k),z,nd.z0,nd.z1); }
    case 'hcyl':{ const u=nd.ax==='x'?x:y, v=nd.ax==='x'?y:x; const d2=Math.hypot(v-(nd.ax==='x'?0:nd.cx),z-nd.cz)-nd.r; const h=(nd.u1-nd.u0)/2, du=Math.abs(u-(nd.u0+nd.u1)/2)-h;
      return Math.min(Math.max(d2,du),0)+Math.hypot(Math.max(d2,0),Math.max(du,0)); }
    case 'hp': return nd.n[0]*x+nd.n[1]*y+nd.n[2]*z-nd.c;
    case 'sph': return Math.hypot(x-(nd.x||0),y-(nd.y||0),z-(nd.z||0))-nd.r;
    case 'u': return Math.min(...nd.k.map(c=>J(c,x,y,z)));
    case 'i': return Math.max(...nd.k.map(c=>J(c,x,y,z)));
    case 's': return Math.max(J(nd.a,x,y,z),...nd.k.map(c=>-J(c,x,y,z)));
  }
  return 1e9;
}
/* ── 3D: сетка треугольников вместо лучей ──
   Деталь собирается булевыми операциями над многогранниками (BSP-деревья, по мотивам csg.js Э. Уоллеса, лицензия MIT).
   Тела вращения — с точными нормалями, поэтому гладкие. Рисуется растеризацией (WebGL): быстро, без шума, со сглаживанием.
   Срез: часть сетки в убранной области не рисуется, на секущей плоскости — «крышка» со штриховкой; её контур строится
   по функции расстояния — так же, как сечение на чертеже. Рёбра и очерк — тонкие линии по точной геометрии примитивов. */
const CSG=(function(){
  const EPS=1e-5, dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  const newell=V=>{ let nx=0,ny=0,nz=0,cx=0,cy=0,cz=0; const L=V.length; for(let i=0;i<L;i++){ const a=V[i], b=V[(i+1)%L]; nx+=(a[1]-b[1])*(a[2]+b[2]); ny+=(a[2]-b[2])*(a[0]+b[0]); nz+=(a[0]-b[0])*(a[1]+b[1]); cx+=a[0]; cy+=a[1]; cz+=a[2]; }
    const l=Math.hypot(nx,ny,nz)||1, n=[nx/l,ny/l,nz/l]; return {n,w:(n[0]*cx+n[1]*cy+n[2]*cz)/L}; };
  const dedup=V=>{ const o=[]; V.forEach(v=>{ const q=o[o.length-1]; if(!q||Math.hypot(q.p[0]-v.p[0],q.p[1]-v.p[1],q.p[2]-v.p[2])>1e-7) o.push(v); }); while(o.length>1&&Math.hypot(o[0].p[0]-o[o.length-1].p[0],o[0].p[1]-o[o.length-1].p[1],o[0].p[2]-o[o.length-1].p[2])<=1e-7) o.pop(); return o; };
  const poly=(V,flatN)=>{ V=dedup(V); if(V.length<3) return null; const pl=newell(V.map(v=>v.p)); if(flatN) V=V.map(v=>({p:v.p,n:pl.n})); return {v:V,pl}; };
  const flipPl=pl=>({n:[-pl.n[0],-pl.n[1],-pl.n[2]],w:-pl.w});
  const pflip=P=>({v:P.v.slice().reverse().map(v=>({p:v.p,n:[-v.n[0],-v.n[1],-v.n[2]]})),pl:flipPl(P.pl)});
  function split(pl,P,cf,cb,f,b){ const n=pl.n, w=pl.w, V=P.v, L=V.length, ty=new Array(L); let all=0;
    for(let i=0;i<L;i++){ const d=dot(n,V[i].p)-w, t=d<-EPS?2:d>EPS?1:0; all|=t; ty[i]=t; }
    if(all===0){ (dot(n,P.pl.n)>0?cf:cb).push(P); return; } if(all===1){ f.push(P); return; } if(all===2){ b.push(P); return; }
    const fv=[], bv=[];
    for(let i=0;i<L;i++){ const j=(i+1)%L, ti=ty[i], tj=ty[j], vi=V[i], vj=V[j]; if(ti!==2) fv.push(vi); if(ti!==1) bv.push(vi);
      if((ti|tj)===3){ const t=(w-dot(n,vi.p))/dot(n,[vj.p[0]-vi.p[0],vj.p[1]-vi.p[1],vj.p[2]-vi.p[2]]), v={p:lerp(vi.p,vj.p,t),n:lerp(vi.n,vj.n,t)}; fv.push(v); bv.push(v); } }
    if(fv.length>=3) f.push({v:fv,pl:P.pl}); if(bv.length>=3) b.push({v:bv,pl:P.pl}); }
  const node=()=>({pl:null,f:null,b:null,ps:[]});
  function build(root,polys){ const st=[[root,polys]]; while(st.length){ const [nd,ps]=st.pop(); if(!ps.length) continue; if(!nd.pl) nd.pl=ps[0].pl; const F=[], B=[];
    for(const P of ps) split(nd.pl,P,nd.ps,nd.ps,F,B); if(F.length){ nd.f=nd.f||node(); st.push([nd.f,F]); } if(B.length){ nd.b=nd.b||node(); st.push([nd.b,B]); } } }
  function nodes(root){ const o=[], st=[root]; while(st.length){ const n=st.pop(); if(!n) continue; o.push(n); st.push(n.f,n.b); } return o; }
  function invert(root){ nodes(root).forEach(n=>{ n.ps=n.ps.map(pflip); if(n.pl) n.pl=flipPl(n.pl); const t=n.f; n.f=n.b; n.b=t; }); }
  function clip(root,polys){ const out=[], st=[[root,polys]]; while(st.length){ const [nd,ps]=st.pop(); if(!nd.pl){ for(const p of ps) out.push(p); continue; } const F=[], B=[];
    for(const P of ps) split(nd.pl,P,F,B,F,B); if(F.length){ if(nd.f) st.push([nd.f,F]); else for(const p of F) out.push(p); } if(B.length&&nd.b) st.push([nd.b,B]); } return out; }
  const clipTo=(a,b)=>nodes(a).forEach(n=>{ n.ps=clip(b,n.ps); });
  const all=r=>{ const o=[]; nodes(r).forEach(n=>{ for(const p of n.ps) o.push(p); }); return o; };
  const mk=ps=>{ const n=node(); build(n,ps); return n; };
  const union=(A,B)=>{ const a=mk(A), b=mk(B); clipTo(a,b); clipTo(b,a); invert(b); clipTo(b,a); invert(b); build(a,all(b)); return all(a); };
  const subtract=(A,B)=>{ const a=mk(A), b=mk(B); invert(a); clipTo(a,b); clipTo(b,a); invert(b); clipTo(b,a); invert(b); build(a,all(b)); invert(a); return all(a); };
  const intersect=(A,B)=>{ const a=mk(A), b=mk(B); invert(a); clipTo(b,a); invert(b); clipTo(a,b); clipTo(b,a); build(a,all(b)); invert(a); return all(a); };
  /* ── примитивы: боковая поверхность «кольцо → кольцо» и торцы; нормали тел вращения — точные ── */
  const NS=r=>Math.max(28,Math.min(144,Math.round(r*2.6)));
  function loft(B,T,zb,zt,nf){ const P=[], n=B.length, push=p=>{ if(p) P.push(p); };
    for(let i=0;i<n;i++){ const j=(i+1)%n, pts=[[B[i][0],B[i][1],zb],[B[j][0],B[j][1],zb],[T[j][0],T[j][1],zt],[T[i][0],T[i][1],zt]], ix=[i,j,j,i];
      push(poly(pts.map((p,k)=>({p,n:nf?nf(ix[k]):[0,0,0]})),!nf)); }
    push(poly(B.slice().reverse().map(q=>({p:[q[0],q[1],zb],n:[0,0,-1]})))); push(poly(T.map(q=>({p:[q[0],q[1],zt],n:[0,0,1]}))));
    return P; }
  const circ=(cx,cy,r,n)=>Array.from({length:n},(_,i)=>{ const a=i/n*2*Math.PI; return [cx+r*Math.cos(a),cy+r*Math.sin(a)]; });
  const reg=(cx,cy,ap,n,a0)=>{ const R=ap/Math.cos(Math.PI/n); return Array.from({length:n},(_,i)=>{ const a=a0*Math.PI/180+i*2*Math.PI/n; return [cx+R*Math.cos(a),cy+R*Math.sin(a)]; }); };
  const mapP=(P,f)=>P.map(p=>poly(p.v.map(v=>({p:f(v.p,1),n:f(v.n,0)})))).filter(Boolean);
  function prim(nd){
    switch(nd.t){
      case 'cyl':{ const n=NS(nd.r); return loft(circ(nd.x,nd.y,nd.r,n),circ(nd.x,nd.y,nd.r,n),nd.z0,nd.z1,i=>{ const a=i/n*2*Math.PI; return [Math.cos(a),Math.sin(a),0]; }); }
      case 'cone':{ const n=NS(Math.max(nd.r0,nd.r1)), k=(nd.r1-nd.r0)/(nd.z1-nd.z0), l=Math.hypot(1,k);
        return loft(circ(nd.x,nd.y,nd.r0,n),circ(nd.x,nd.y,nd.r1,n),nd.z0,nd.z1,i=>{ const a=i/n*2*Math.PI; return [Math.cos(a)/l,Math.sin(a)/l,-k/l]; }); }
      case 'box':{ const a=nd.a*Math.PI/180, c=Math.cos(a), s=Math.sin(a), R=[[-1,-1],[1,-1],[1,1],[-1,1]].map(q=>{ const x=q[0]*nd.sx/2, y=q[1]*nd.sy/2; return [nd.x+x*c-y*s,nd.y+x*s+y*c]; }); return loft(R,R,nd.z0,nd.z1,null); }
      case 'ngon':{ const R=reg(nd.x,nd.y,nd.s/2,nd.n,nd.a); return loft(R,R,nd.z0,nd.z1,null); }
      case 'npyr': return loft(reg(nd.x,nd.y,nd.s0/2,nd.n,nd.a),reg(nd.x,nd.y,nd.s1/2,nd.n,nd.a),nd.z0,nd.z1,null);
      case 'hcyl':{ const n=NS(nd.r), P=loft(circ(0,0,nd.r,n),circ(0,0,nd.r,n),nd.u0,nd.u1,i=>{ const a=i/n*2*Math.PI; return [Math.cos(a),Math.sin(a),0]; });
        return nd.ax==='x'?mapP(P,(p,t)=>[p[2],p[0],p[1]+(t?nd.cz:0)]):mapP(P,(p,t)=>[p[1]+(t?nd.cx:0),p[2],p[0]+(t?nd.cz:0)]); }
      case 'sph':{ const c=[nd.x||0,nd.y||0,nd.z||0], r=nd.r, NL=48, NB=24, P=[];   /* шар — 48×24 граней: нормали точные, выглядит гладким, а булевы операции остаются быстрыми */
        const pt=(j,i)=>{ const th=-Math.PI/2+j/NB*Math.PI, ph=i/NL*2*Math.PI, d=[Math.cos(th)*Math.cos(ph),Math.cos(th)*Math.sin(ph),Math.sin(th)]; return {p:[c[0]+r*d[0],c[1]+r*d[1],c[2]+r*d[2]],n:d}; };
        for(let j=0;j<NB;j++) for(let i=0;i<NL;i++){ const q=poly([pt(j,i),pt(j,i+1),pt(j+1,i+1),pt(j+1,i)]); if(q) P.push(q); } return P; }
      case 'hp':{ const n=nd.n, t1=(()=>{ const h=Math.abs(n[2])<0.9?[0,0,1]:[1,0,0], c=[n[1]*h[2]-n[2]*h[1],n[2]*h[0]-n[0]*h[2],n[0]*h[1]-n[1]*h[0]], l=Math.hypot(...c); return c.map(v=>v/l); })(),
          t2=[n[1]*t1[2]-n[2]*t1[1],n[2]*t1[0]-n[0]*t1[2],n[0]*t1[1]-n[1]*t1[0]], B=600, R=[[-B,-B],[B,-B],[B,B],[-B,B]];
        return mapP(loft(R,R,nd.c-2*B,nd.c,null),(p,t)=>t?[n[0]*p[2]+t1[0]*p[0]+t2[0]*p[1],n[1]*p[2]+t1[1]*p[0]+t2[1]*p[1],n[2]*p[2]+t1[2]*p[0]+t2[2]*p[1]]
          :[n[0]*p[2]+t1[0]*p[0]+t2[0]*p[1],n[1]*p[2]+t1[1]*p[0]+t2[1]*p[1],n[2]*p[2]+t1[2]*p[0]+t2[2]*p[1]]); }
    }
    return []; }
  function tree(nd){ switch(nd.t){
    case 'u': return nd.k.map(tree).reduce(union);
    case 'i': return nd.k.map(tree).reduce(intersect);
    case 's':{ const ks=nd.k.map(tree); return subtract(tree(nd.a),ks.length>1?ks.reduce(union):ks[0]); }
    default: return prim(nd); } }
  /* сетка: треугольники веером, координаты и нормали */
  function mesh(t){ const P=tree(t); let n=0; P.forEach(p=>{ n+=p.v.length-2; }); const pos=new Float32Array(n*9), nrm=new Float32Array(n*9); let o=0;
    P.forEach(p=>{ const V=p.v; for(let i=1;i<V.length-1;i++){ [V[0],V[i],V[i+1]].forEach(v=>{ pos[o]=v.p[0]; pos[o+1]=v.p[1]; pos[o+2]=v.p[2]; nrm[o]=v.n[0]; nrm[o+1]=v.n[1]; nrm[o+2]=v.n[2]; o+=3; }); } });
    return {pos,nrm,count:n*3}; }
  return {mesh};
})();
/* ── линии: рёбра (пересечения поверхностей примитивов на границе тела) — один раз на модель; очерк — под каждый ракурс ── */
const sideJ=(J,q,n,d)=>(J(q[0]+n[0]*d,q[1]+n[1]*d,q[2]+n[2]*d)<0)!==(J(q[0]-n[0]*d,q[1]-n[1]*d,q[2]-n[2]*d)<0);
function featLines(model){ if(model._fl) return model._fl; const E3=edges3(model), J=jc(model.tree), out=[];
  const ok=(p,A,B)=>{ if(Math.abs(J(p[0],p[1],p[2]))>0.01) return false; const na=grad(A,p), nb=grad(B,p), T=crs(na,nb), tl=Math.hypot(...T); if(tl<0.03) return false;
    const t=T.map(v=>v/tl), ra=crs(t,na), rb=crs(t,nb), e=0.06, d=0.015, on=(r,n,s)=>sideJ(J,[p[0]+r[0]*e*s,p[1]+r[1]*e*s,p[2]+r[2]*e*s],n,d);
    return (on(ra,na,1)||on(ra,na,-1))&&(on(rb,nb,1)||on(rb,nb,-1)); };
  E3.segs.forEach(g=>{ if(!g.B) return; const a=ok(g.p,g.A,g.B), b=ok(g.q,g.A,g.B); if(a&&b) out.push(g.p,g.q);
    else if(a!==b){ let lo=0, hi=1; const at=t=>[g.p[0]+(g.q[0]-g.p[0])*t,g.p[1]+(g.q[1]-g.p[1])*t,g.p[2]+(g.q[2]-g.p[2])*t];
      for(let k=0;k<8;k++){ const m=(lo+hi)/2; if(ok(at(m),g.A,g.B)===a) lo=m; else hi=m; } const m=at((lo+hi)/2); if(a) out.push(g.p,m); else out.push(m,g.q); } });
  Object.defineProperty(model,'_fl',{value:out}); return out; }
function silLines(model,F){ const E3=edges3(model), J=jc(model.tree), out=[], st=0.7;
  const take=(P,N)=>{ let prev=null; for(let i=0;i<P.length;i++){ const p=P[i], ok=Math.abs(J(p[0],p[1],p[2]))<0.03&&sideJ(J,p,N[i],0.04); if(ok&&prev) out.push(prev,p); prev=ok?p:null; } };
  E3.SS.forEach(A=>{ if(A.t==='pl') return; const [lo,hi]=tRange(A,A.bb);
    if(A.t==='sp'){ const h=Math.abs(F[2])<0.9?[0,0,1]:[1,0,0], e1=crs(F,h), l1=Math.hypot(...e1), u=e1.map(v=>v/l1), w=crs(F,u), n=Math.max(64,Math.ceil(2*Math.PI*A.r/st)), P=[], N=[];
      for(let i=0;i<=n;i++){ const a=i/n*2*Math.PI, d=[u[0]*Math.cos(a)+w[0]*Math.sin(a),u[1]*Math.cos(a)+w[1]*Math.sin(a),u[2]*Math.cos(a)+w[2]*Math.sin(a)]; P.push([A.c[0]+A.r*d[0],A.c[1]+A.r*d[1],A.c[2]+A.r*d[2]]); N.push(d); } take(P,N); return; }
    if(hi-lo<1e-6) return; let us=[];
    if(A.t==='zc'){ const a=Math.hypot(F[0],F[1]); if(a<1e-6) return; const c=A.k*F[2]/a; if(Math.abs(c)>1) return; const ph=Math.atan2(F[1],F[0]), d=Math.acos(c); us=[ph+d,ph-d]; }
    else { const ph=A.ax==='x'?Math.atan2(F[2],F[1]):Math.atan2(F[2],F[0]); us=[ph+Math.PI/2,ph-Math.PI/2]; }
    const n=Math.max(2,Math.ceil((hi-lo)/st)); us.forEach(u=>{ const P=[], N=[]; for(let i=0;i<=n;i++){ const t=lo+(hi-lo)*i/n; P.push(SP(A,u,t)); N.push(SN(A,u,t)); } take(P,N); }); });
  return out; }
/* ── крышка среза: область «материал ∩ плоскость ∩ остальные условия выреза» по сетке; внутри — полосами, у границы — по клеткам ── */
function capOf(f,O,U,V,u0,u1,v0,v1,st){ const nu=Math.ceil((u1-u0)/st), nv=Math.ceil((v1-v0)/st), G=new Float32Array((nu+1)*(nv+1));
  for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++) G[j*(nu+1)+i]=f(u0+i*st,v0+j*st);
  const P=(u,v)=>[O[0]+U[0]*u+V[0]*v,O[1]+U[1]*u+V[1]*v,O[2]+U[2]*u+V[2]*v], X=i=>u0+i*st, Y=j=>v0+j*st, at=(i,j)=>G[j*(nu+1)+i];
  const tri=[], seg=[], quad=(a,b,c,d)=>tri.push(a,b,c,a,c,d);
  const ip=(i0,j0,i1,j1)=>{ const a=at(i0,j0), b=at(i1,j1), t=a/(a-b); return [X(i0)+(X(i1)-X(i0))*t,Y(j0)+(Y(j1)-Y(j0))*t]; };
  for(let j=0;j<nv;j++){ let run=-1;
    for(let i=0;i<=nu;i++){ const full=i<nu&&at(i,j)<IN0&&at(i+1,j)<IN0&&at(i+1,j+1)<IN0&&at(i,j+1)<IN0;
      if(full){ if(run<0) run=i; continue; } if(run>=0){ quad(P(X(run),Y(j)),P(X(i),Y(j)),P(X(i),Y(j+1)),P(X(run),Y(j+1))); run=-1; } if(i===nu) break;
      const C=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]], ins=C.map(c=>at(c[0],c[1])<IN0); if(!ins.some(Boolean)) continue;
      const pg=[]; for(let k=0;k<4;k++){ const c=C[k], d=C[(k+1)%4]; if(ins[k]) pg.push([X(c[0]),Y(c[1])]); if(ins[k]!==ins[(k+1)%4]) pg.push(ip(c[0],c[1],d[0],d[1])); }
      for(let k=1;k<pg.length-1;k++) tri.push(P(...pg[0]),P(...pg[k]),P(...pg[k+1]));
      const cs=(ins[0]?1:0)|(ins[1]?2:0)|(ins[2]?4:0)|(ins[3]?8:0), e=[()=>ip(i,j,i+1,j),()=>ip(i+1,j,i+1,j+1),()=>ip(i,j+1,i+1,j+1),()=>ip(i,j,i,j+1)];
      ({1:[[0,3]],2:[[0,1]],3:[[1,3]],4:[[1,2]],5:[[0,1],[2,3]],6:[[0,2]],7:[[2,3]],8:[[2,3]],9:[[0,2]],10:[[0,3],[1,2]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[0,3]]})[cs].forEach(([a,b])=>seg.push(P(...e[a]()),P(...e[b]()))); } }
  return {tri,seg}; }
/* ── окно просмотра ── */
const GLS={
  mv:'attribute vec3 aP,aN;uniform mat4 uM;varying vec3 vP,vN;void main(){vP=aP;vN=aN;gl_Position=uM*vec4(aP,1.);}',
  cut:'uniform vec4 uH1,uH2;uniform int uNH;bool gone(vec3 p){if(uNH==0)return false;bool r=dot(uH1.xyz,p)>uH1.w;if(uNH>1)r=r&&dot(uH2.xyz,p)>uH2.w;return r;}',
  mf:`precision highp float;varying vec3 vP,vN;uniform vec3 uF;uniform float uDark,uFlat;CUT
void main(){ if(gone(vP)) discard; vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n; vec3 rd=uF;
  vec3 L1=normalize(vec3(-.5,-.75,.9)), L2=normalize(vec3(.85,.25,.35)); float dif=max(dot(n,L1),0.), dif2=max(dot(n,L2),0.), hemi=.5+.5*n.z;
  vec3 base=mix(vec3(.74,.75,.77),vec3(.60,.61,.64),uDark), hv=normalize(L1-rd); float nh=max(dot(n,hv),0.);
  float spec=pow(nh,48.)*.38+pow(nh,7.)*.06, fres=pow(1.-abs(dot(n,-rd)),4.);
  vec3 col=base*(.30+.30*hemi+dif*.58+dif2*.18)+spec+fres*.08*vec3(.92,.95,1.);
  if(!gl_FrontFacing) col*=.55;
  if(uFlat>.5) col=vec3(.985)-vec3(.04)*(1.-abs(dot(n,-rd)));
  gl_FragColor=vec4(col,1.); }`,
  cv:'attribute vec3 aP;uniform mat4 uM;varying vec3 vP;void main(){vP=aP;gl_Position=uM*vec4(aP,1.);}',
  cf:`precision highp float;varying vec3 vP;uniform vec3 uU,uV;uniform float uHs,uPx,uDark;uniform vec4 uTint;
void main(){ float u=dot(vP,(uU+uV)*.70711), w=abs(fract(u/uHs)-.5)*uHs; vec3 paper=mix(vec3(.96,.96,.955),vec3(.80,.81,.82),uDark*.4), ink=mix(vec3(.2,.21,.23),vec3(.30,.31,.34),uDark); paper=mix(paper,uTint.rgb,uTint.a);
  gl_FragColor=vec4(mix(ink,paper,smoothstep(uPx*.35,uPx*1.1,w)),1.); }`,
  lv:`attribute vec3 aA,aB;attribute vec2 aT;uniform mat4 uM;uniform vec2 uRes;uniform float uW;varying vec3 vP;
void main(){ vec4 a=uM*vec4(aA,1.), b=uM*vec4(aB,1.); vec2 d=(b.xy-a.xy)*uRes; float l=length(d); vec2 dir=l>1e-6?d/l:vec2(1.,0.), nr=vec2(-dir.y,dir.x);
  vec4 p=mix(a,b,aT.x); p.xy+=(nr*aT.y+dir*(aT.x*2.-1.))*uW/uRes; p.z-=.0012; vP=mix(aA,aB,aT.x); gl_Position=p; }`,
  lf:'precision highp float;varying vec3 vP;uniform vec3 uCol;uniform float uClip;CUT void main(){ if(uClip>.5&&gone(vP)) discard; gl_FragColor=vec4(uCol,1.); }',
  bv:'attribute vec2 a;varying float vY;void main(){vY=a.y*.5+.5;gl_Position=vec4(a,0.,1.);}',
  bf:'precision highp float;varying float vY;uniform vec3 uB1,uB2;void main(){gl_FragColor=vec4(mix(uB2,uB1,clamp(vY,0.,1.)),1.);}'};
function lineBuf(L){ const n=L.length/2, a=new Float32Array(n*6*8); let o=0; const T=[[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]];
  for(let s=0;s<n;s++){ const A=L[2*s], B=L[2*s+1]; for(const t of T){ a[o++]=A[0]; a[o++]=A[1]; a[o++]=A[2]; a[o++]=B[0]; a[o++]=B[1]; a[o++]=B[2]; a[o++]=t[0]; a[o++]=t[1]; } } return a; }
function viewer(canvas,opt){
  const gl=canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:!!(opt&&opt.keep)}); if(!gl) return null;
  const sh=(t,src)=>{ const s=gl.createShader(t); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog=(v,f,names)=>{ const p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,v)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f.replace('CUT',GLS.cut))); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const U={}; names.forEach(k=>U[k]=gl.getUniformLocation(p,k)); return {p,U}; };
  const PM=prog(GLS.mv,GLS.mf,['uM','uF','uDark','uFlat','uH1','uH2','uNH']), PC=prog(GLS.cv,GLS.cf,['uM','uU','uV','uHs','uPx','uDark','uTint']),
    PL=prog(GLS.lv,GLS.lf,['uM','uRes','uW','uCol','uClip','uH1','uH2','uNH']), PB=prog(GLS.bv,GLS.bf,['uB1','uB2']);
  const buf=d=>{ const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW); return b; };
  const bgB=buf(new Float32Array([-1,-1,3,-1,-1,3]));
  const S={yaw:-0.62,pit:0.42,zoom:1,cut:0,off:0,pl:[0,0,1,0],tx:0,ty:0,C:[0,0,60],R:80,res:1,bg:null};
  let model=null, M=null, mB=null, nB=null, fB=null, fN=0, sKey='', sB=null, sN=0, cKey='', cap=null, cT=null, cS=null, cTN=0, cSN=0;
  const attr=(p,name,b,size,stride,off)=>{ const l=gl.getAttribLocation(p,name); if(l<0) return -1; gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l,size,gl.FLOAT,false,stride||0,off||0); return l; };
  const off=ls=>ls.forEach(l=>{ if(l>=0) gl.disableVertexAttribArray(l); });
  function compile(m){ model=m; const b=m.box||[[-60,-60,0],[60,60,120]];
    S.C=[(b[0][0]+b[1][0])/2,(b[0][1]+b[1][1])/2,(b[0][2]+b[1][2])/2]; S.R=Math.hypot(b[1][0]-b[0][0],b[1][1]-b[0][1],b[1][2]-b[0][2])/2;
    let me=m._mesh; if(!me){ me=CSG.mesh(m.tree); Object.defineProperty(m,'_mesh',{value:me,configurable:true}); } M=me;
    [mB,nB,fB].forEach(x=>x&&gl.deleteBuffer(x)); mB=buf(M.pos); nB=buf(M.nrm);
    let fl=[]; try{ fl=featLines(m); }catch(e){ console.error(e); } fB=buf(lineBuf(fl)); fN=fl.length*3; sKey=''; cKey=''; }
  /* убранная область = пересечение полупространств n·p > w */
  function HS(){ const o=S.off||0, p=S.pl||[0,0,1,0];
    switch(S.cut){ case 1: return [[1,0,0,p[3]],[0,-1,0,-o]]; case 2: return [[0,-1,0,-o]]; case 3: return [[-1,0,0,-o]]; case 4: return [[p[0],p[1],p[2],p[3]]];
      case 5: return [[-1,0,0,-o],[0,-1,0,-p[3]]]; case 6: return [[0,0,1,o]]; case 7: return [[p[0],p[1],p[2],p[3]]]; } return []; }
  function caps(H){ const key=S.cut+'|'+H.map(h=>h.map(v=>v.toFixed(4)).join(',')).join(';'); if(key===cKey) return; cKey=key;
    const J=jc(model.tree), b=model.box, tri=[], seg=[], parts=[];
    H.forEach((h,i)=>{ const n=[h[0],h[1],h[2]], O=n.map(v=>v*h[3]), ax=n.map(Math.abs);
      const U=ax[1]>0.9?[1,0,0]:ax[0]>0.9?[0,1,0]:ax[2]>0.9?[1,0,0]:(()=>{ const c=[n[2],0,-n[0]], l=Math.hypot(...c)||1; return c.map(v=>v/l); })(), V=crs(n,U);
      /* материал — чуть внутри оставленной части (на 0,05 мм от плоскости): грань детали, совпавшая с секущей плоскостью (отверстие K кончается
         ровно на оси), — не срез, штриховать её нечего */
      const oth=H.filter((_,j)=>j!==i), f=(u,v)=>{ const x=O[0]+U[0]*u+V[0]*v, y=O[1]+U[1]*u+V[1]*v, z=O[2]+U[2]*u+V[2]*v; let d=J(x-n[0]*0.05,y-n[1]*0.05,z-n[2]*0.05); oth.forEach(g=>{ d=Math.max(d,g[3]-(g[0]*x+g[1]*y+g[2]*z)); }); return d; };
      let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9; for(let c=0;c<8;c++){ const q=[b[c&1][0],b[(c>>1)&1][1],b[(c>>2)&1][2]].map((v,k)=>v-O[k]); const u=dot3(q,U), v=dot3(q,V); u0=Math.min(u0,u); u1=Math.max(u1,u); v0=Math.min(v0,v); v1=Math.max(v1,v); }
      const R=capOf(f,O,U,V,u0-1,u1+1,v0-1,v1+1,0.3); parts.push({s:tri.length,n:R.tri.length,U,V}); R.tri.forEach(p=>tri.push(p)); R.seg.forEach(p=>seg.push(p)); });
    [cT,cS].forEach(x=>x&&gl.deleteBuffer(x)); const ta=new Float32Array(tri.length*3); tri.forEach((p,k)=>{ ta[3*k]=p[0]; ta[3*k+1]=p[1]; ta[3*k+2]=p[2]; });
    cT=buf(ta); cTN=tri.length; cS=buf(lineBuf(seg)); cSN=seg.length*3; cap=parts; }
  function draw(){ if(!M) return; const dpr=Math.min(window.devicePixelRatio||1,2), w=Math.max(2,Math.round(canvas.clientWidth*dpr)), h=Math.max(2,Math.round(canvas.clientHeight*dpr));
    if(canvas.width!==w||canvas.height!==h){ canvas.width=w; canvas.height=h; } gl.viewport(0,0,w,h);
    const cy=Math.cos(S.yaw), sy=Math.sin(S.yaw), cp=Math.cos(S.pit), sp=Math.sin(S.pit), F=[sy*cp,cy*cp,-sp], R=norm(cross(F,[0,0,1])), Up=cross(R,F);
    const Cc=[S.C[0]+S.tx*R[0]+S.ty*Up[0],S.C[1]+S.tx*R[1]+S.ty*Up[1],S.C[2]+S.tx*R[2]+S.ty*Up[2]], us=S.R*2.25/S.zoom*Math.max(1,h/w), sx=2*h/(us*w), syy=2/us, D=S.R*2.5;
    const row=(v,s)=>[v[0]*s,v[1]*s,v[2]*s,-(v[0]*Cc[0]+v[1]*Cc[1]+v[2]*Cc[2])*s], r0=row(R,sx), r1=row(Up,syy), r2=row(F,1/D);
    const MM=new Float32Array([r0[0],r1[0],r2[0],0, r0[1],r1[1],r2[1],0, r0[2],r1[2],r2[2],0, r0[3],r1[3],r2[3],1]);
    const dark=document.documentElement.getAttribute('data-theme')==='dark', H=HS(), nh=Math.min(2,H.length), h1=H[0]||[0,0,1,1e9], h2=H[1]||[0,0,1,1e9], cutU=P=>{ gl.uniform4fv(P.U.uH1,h1); gl.uniform4fv(P.U.uH2,h2); gl.uniform1i(P.U.uNH,S.cut===7?0:nh); };
    gl.disable(gl.DEPTH_TEST); gl.depthMask(true); gl.clearColor(0,0,0,0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    if(!S.clear){ const bg=S.bg||(dark?[[.07,.09,.14],[.11,.14,.21]]:[[1,1,1],[.92,.925,.935]]); gl.useProgram(PB.p); gl.uniform3fv(PB.U.uB1,bg[0]); gl.uniform3fv(PB.U.uB2,bg[1]); const l=attr(PB.p,'a',bgB,2); gl.drawArrays(gl.TRIANGLES,0,3); off([l]); }
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    if(S.cut!==7){ gl.useProgram(PM.p); gl.uniformMatrix4fv(PM.U.uM,false,MM); gl.uniform3fv(PM.U.uF,F); gl.uniform1f(PM.U.uDark,dark?1:0); gl.uniform1f(PM.U.uFlat,S.flat?1:0); cutU(PM);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1,2); const a=attr(PM.p,'aP',mB,3), b=attr(PM.p,'aN',nB,3); gl.drawArrays(gl.TRIANGLES,0,M.count); off([a,b]); gl.disable(gl.POLYGON_OFFSET_FILL); }
    if(H.length){ caps(H); if(cTN){ gl.useProgram(PC.p); gl.uniformMatrix4fv(PC.U.uM,false,MM); gl.uniform1f(PC.U.uHs,S.hatch||3.2); gl.uniform1f(PC.U.uPx,us/h); gl.uniform1f(PC.U.uDark,dark?1:0); gl.uniform4fv(PC.U.uTint,S.tint||[0,0,0,0]);
      const a=attr(PC.p,'aP',cT,3); cap.forEach(c=>{ if(!c.n) return; gl.uniform3fv(PC.U.uU,c.U); gl.uniform3fv(PC.U.uV,c.V); gl.drawArrays(gl.TRIANGLES,c.s,c.n); }); off([a]); } }
    /* линии */
    const k=F.map(v=>v.toFixed(3)).join(','); if(k!==sKey){ sKey=k; let L=[]; try{ L=silLines(model,F); }catch(e){} if(sB) gl.deleteBuffer(sB); sB=buf(lineBuf(L)); sN=L.length*3; }
    gl.useProgram(PL.p); gl.uniformMatrix4fv(PL.U.uM,false,MM); gl.uniform2fv(PL.U.uRes,[w,h]); gl.uniform3fv(PL.U.uCol,dark?[.05,.06,.08]:[.1,.105,.12]); cutU(PL);
    const lines=(b,n,wd,clip)=>{ if(!n) return; gl.uniform1f(PL.U.uW,wd*dpr); gl.uniform1f(PL.U.uClip,clip); const st=32, a=attr(PL.p,'aA',b,3,st,0), c=attr(PL.p,'aB',b,3,st,12), t=attr(PL.p,'aT',b,2,st,24); gl.drawArrays(gl.TRIANGLES,0,n); off([a,c,t]); };
    if(S.cut!==7){ lines(fB,fN,1.15,1); lines(sB,sN,1.15,1); } if(H.length) lines(cS,cSN,1.5,0);
  }
  return {gl,S,compile,draw,canvas}; }
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], norm=a=>{ const l=Math.hypot(...a)||1; return a.map(v=>v/l); };
/* ── контур сечения плоскостью: квадратики (marching squares) по функции расстояния ──
   плоскость задана точкой O и ортами u, v; возвращает отрезки контура в координатах (u, v), мм */
function section(tree,O,u,v,box,step){ step=step||0.4; const J=jc(tree), [u0,u1,v0,v1]=box, nu=Math.ceil((u1-u0)/step), nv=Math.ceil((v1-v0)/step), F=new Float32Array((nu+1)*(nv+1));
  for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++){ const a=u0+i*step, b=v0+j*step; F[j*(nu+1)+i]=J(O[0]+u[0]*a+v[0]*b,O[1]+u[1]*a+v[1]*b,O[2]+u[2]*a+v[2]*b); }
  const segs=[], at=(i,j)=>F[j*(nu+1)+i], X=i=>u0+i*step, Y=j=>v0+j*step;
  const ip=(i0,j0,i1,j1)=>{ const a=at(i0,j0), b=at(i1,j1), t=a/(a-b); return [X(i0)+(X(i1)-X(i0))*t, Y(j0)+(Y(j1)-Y(j0))*t]; };
  for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const c=(at(i,j)<IN0?1:0)|(at(i+1,j)<IN0?2:0)|(at(i+1,j+1)<IN0?4:0)|(at(i,j+1)<IN0?8:0); if(c===0||c===15) continue;
    const e=[()=>ip(i,j,i+1,j),()=>ip(i+1,j,i+1,j+1),()=>ip(i,j+1,i+1,j+1),()=>ip(i,j,i,j+1)];
    const T={1:[[0,3]],2:[[0,1]],3:[[1,3]],4:[[1,2]],5:[[0,1],[2,3]],6:[[0,2]],7:[[2,3]],8:[[2,3]],9:[[0,2]],10:[[0,3],[1,2]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[0,3]]}[c];
    T.forEach(([a,b])=>segs.push([e[a](),e[b]()])); }
  return {segs,inside:(a,b)=>J(O[0]+u[0]*a+v[0]*b,O[1]+u[1]*a+v[1]*b,O[2]+u[2]*a+v[2]*b)<IN0};
}
/* ── чертёж по точной геометрии: рёбра — пересечения поверхностей примитивов, очерк — где поверхность уходит от взгляда;
   видимость — лучом к наблюдателю. Всё в мм, линии — вектор (никакой растровой обработки). ── */
const sq=v=>v*v;
/* «внутри тела» для контуров и срезов: f < IN0, а не f < 0. Там, где два примитива касаются гранью (конус стоит на фланце),
   объединение даёт f = 0 ровно на общей плоскости внутри детали; точка сетки, попавшая на неё, считалась «снаружи» —
   и в сплошном срезе появлялась лишняя линия по шву. Наружная граница от этого не сдвигается */
const IN0=1e-6;
function capz(d2,z,z0,z1){ const h=(z1-z0)/2, dz=Math.abs(z-(z0+z1)/2)-h; return Math.min(Math.max(d2,dz),0)+Math.sqrt(sq(Math.max(d2,0))+sq(Math.max(dz,0))); }
function ngT(n,a){ const c=[],s=[]; for(let i=0;i<n;i++){ const t=a*Math.PI/180+(i+.5)*2*Math.PI/n; c.push(Math.cos(t)); s.push(Math.sin(t)); } return [c,s]; }
function ngF(T,x,y){ let m=-1e9; const c=T[0],s=T[1]; for(let i=0;i<c.length;i++){ const v=x*c[i]+y*s[i]; if(v>m) m=v; } return m; }
/* функция расстояния, собранная в замыкания (та же, что J, только быстрее) */
function JC(nd){
  switch(nd.t){
    case 'cyl':{ const cx=nd.x,cy=nd.y,r=nd.r,z0=nd.z0,z1=nd.z1; return (x,y,z)=>capz(Math.sqrt(sq(x-cx)+sq(y-cy))-r,z,z0,z1); }
    case 'cone':{ const cx=nd.x,cy=nd.y,r0=nd.r0,r1=nd.r1,z0=nd.z0,z1=nd.z1,k=Math.abs(Math.cos(Math.atan2(r1-r0,z1-z0)));
      return (x,y,z)=>{ const t=Math.min(1,Math.max(0,(z-z0)/(z1-z0))); return capz((Math.sqrt(sq(x-cx)+sq(y-cy))-(r0+(r1-r0)*t))*k,z,z0,z1); }; }
    case 'box':{ const c=Math.cos(-nd.a*Math.PI/180), s=Math.sin(-nd.a*Math.PI/180), cx=nd.x,cy=nd.y,hx=nd.sx/2,hy=nd.sy/2,z0=nd.z0,z1=nd.z1;
      return (x,y,z)=>{ const px=(x-cx)*c-(y-cy)*s, py=(x-cx)*s+(y-cy)*c, dx=Math.abs(px)-hx, dy=Math.abs(py)-hy; return capz(Math.min(Math.max(dx,dy),0)+Math.sqrt(sq(Math.max(dx,0))+sq(Math.max(dy,0))),z,z0,z1); }; }
    case 'ngon':{ const T=ngT(nd.n,nd.a), cx=nd.x,cy=nd.y,ap=nd.s/2,z0=nd.z0,z1=nd.z1; return (x,y,z)=>capz(ngF(T,x-cx,y-cy)-ap,z,z0,z1); }
    case 'npyr':{ const T=ngT(nd.n,nd.a), cx=nd.x,cy=nd.y,s0=nd.s0,s1=nd.s1,z0=nd.z0,z1=nd.z1,k=Math.abs(Math.cos(Math.atan2((s1-s0)/2,z1-z0)));
      return (x,y,z)=>{ const t=Math.min(1,Math.max(0,(z-z0)/(z1-z0))); return capz((ngF(T,x-cx,y-cy)-(s0+(s1-s0)*t)/2)*k,z,z0,z1); }; }
    case 'hcyl':{ const X=nd.ax==='x', cv=X?0:nd.cx, cz=nd.cz, r=nd.r, m=(nd.u0+nd.u1)/2, h=(nd.u1-nd.u0)/2;
      return (x,y,z)=>{ const u=X?x:y, v=X?y:x, d2=Math.sqrt(sq(v-cv)+sq(z-cz))-r, du=Math.abs(u-m)-h; return Math.min(Math.max(d2,du),0)+Math.sqrt(sq(Math.max(d2,0))+sq(Math.max(du,0))); }; }
    case 'hp':{ const a=nd.n[0],b=nd.n[1],c=nd.n[2],d=nd.c; return (x,y,z)=>a*x+b*y+c*z-d; }
    case 'sph':{ const cx=nd.x||0,cy=nd.y||0,cz=nd.z||0,r=nd.r; return (x,y,z)=>Math.sqrt(sq(x-cx)+sq(y-cy)+sq(z-cz))-r; }
    case 'u':{ const f=nd.k.map(JC), n=f.length; return (x,y,z)=>{ let m=f[0](x,y,z); for(let i=1;i<n;i++){ const v=f[i](x,y,z); if(v<m) m=v; } return m; }; }
    case 'i':{ const f=nd.k.map(JC), n=f.length; return (x,y,z)=>{ let m=f[0](x,y,z); for(let i=1;i<n;i++){ const v=f[i](x,y,z); if(v>m) m=v; } return m; }; }
    case 's':{ const a=JC(nd.a), f=nd.k.map(JC), n=f.length; return (x,y,z)=>{ let m=a(x,y,z); for(let i=0;i<n;i++){ const v=-f[i](x,y,z); if(v>m) m=v; } return m; }; }
  }
  return ()=>1e9;
}
const jc=t=>t._jc||(Object.defineProperty(t,'_jc',{value:JC(t)}),t._jc);
/* ── поверхности примитивов: плоскость pl (n·p = c), конус/цилиндр вдоль z (zc), цилиндр вдоль x/y (hc), шар (sp) ── */
const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function primBox(nd,MB){
  const R=(r,cx,cy,z0,z1)=>[[cx-r,cy-r,z0],[cx+r,cy+r,z1]];
  switch(nd.t){
    case 'cyl': return R(nd.r,nd.x,nd.y,nd.z0,nd.z1);
    case 'cone': return R(Math.max(nd.r0,nd.r1),nd.x,nd.y,nd.z0,nd.z1);
    case 'box': return R(Math.hypot(nd.sx,nd.sy)/2,nd.x,nd.y,nd.z0,nd.z1);
    case 'ngon': return R(nd.s/2/Math.cos(Math.PI/nd.n),nd.x,nd.y,nd.z0,nd.z1);
    case 'npyr': return R(Math.max(nd.s0,nd.s1)/2/Math.cos(Math.PI/nd.n),nd.x,nd.y,nd.z0,nd.z1);
    case 'hcyl': return nd.ax==='x'?[[nd.u0,-nd.r,nd.cz-nd.r],[nd.u1,nd.r,nd.cz+nd.r]]:[[nd.cx-nd.r,nd.u0,nd.cz-nd.r],[nd.cx+nd.r,nd.u1,nd.cz+nd.r]];
    case 'sph': { const c=[nd.x||0,nd.y||0,nd.z||0]; return [c.map(v=>v-nd.r),c.map(v=>v+nd.r)]; }
  }
  return MB;
}
function surfsOf(nd){
  const L=[], pl=(n,c)=>{ const l=Math.hypot(n[0],n[1],n[2]); L.push({t:'pl',n:n.map(v=>v/l),c:c/l}); }, caps=()=>{ pl([0,0,1],nd.z0); pl([0,0,1],nd.z1); };
  switch(nd.t){
    case 'cyl': L.push({t:'zc',cx:nd.x,cy:nd.y,r0:nd.r,k:0,z0:nd.z0,t0:nd.z0,t1:nd.z1}); caps(); break;
    case 'cone': L.push({t:'zc',cx:nd.x,cy:nd.y,r0:nd.r0,k:(nd.r1-nd.r0)/(nd.z1-nd.z0),z0:nd.z0,t0:nd.z0,t1:nd.z1}); caps(); break;
    case 'box':{ const A=-nd.a*Math.PI/180, c=Math.cos(A), s=Math.sin(A), o=[nd.x,nd.y,0], nx=[c,-s,0], ny=[s,c,0];
      pl(nx,dot3(nx,o)+nd.sx/2); pl(nx,dot3(nx,o)-nd.sx/2); pl(ny,dot3(ny,o)+nd.sy/2); pl(ny,dot3(ny,o)-nd.sy/2); caps(); break; }
    case 'ngon':{ const T=ngT(nd.n,nd.a); for(let i=0;i<nd.n;i++){ const n=[T[0][i],T[1][i],0]; pl(n,n[0]*nd.x+n[1]*nd.y+nd.s/2); } caps(); break; }
    case 'npyr':{ const T=ngT(nd.n,nd.a), ds=(nd.s1-nd.s0)/(nd.z1-nd.z0)/2; for(let i=0;i<nd.n;i++){ const c=T[0][i], s=T[1][i]; pl([c,s,-ds],c*nd.x+s*nd.y+nd.s0/2-ds*nd.z0); } caps(); break; }
    case 'hcyl': L.push({t:'hc',ax:nd.ax,cv:nd.ax==='x'?0:nd.cx,cz:nd.cz,r:nd.r,t0:nd.u0,t1:nd.u1}); pl(nd.ax==='x'?[1,0,0]:[0,1,0],nd.u0); pl(nd.ax==='x'?[1,0,0]:[0,1,0],nd.u1); break;
    case 'hp': pl(nd.n,nd.c); break;
    case 'sph': L.push({t:'sp',c:[nd.x||0,nd.y||0,nd.z||0],r:nd.r,t0:-Math.PI/2,t1:Math.PI/2}); break;
  }
  return L;
}
function SF(s,x,y,z){ switch(s.t){
  case 'pl': return s.n[0]*x+s.n[1]*y+s.n[2]*z-s.c;
  case 'zc': return Math.sqrt(sq(x-s.cx)+sq(y-s.cy))-(s.r0+s.k*(z-s.z0));
  case 'hc': return s.ax==='x'?Math.sqrt(sq(y-s.cv)+sq(z-s.cz))-s.r:Math.sqrt(sq(x-s.cv)+sq(z-s.cz))-s.r;
  case 'sp': return Math.sqrt(sq(x-s.c[0])+sq(y-s.c[1])+sq(z-s.c[2]))-s.r; } }
function SP(s,u,t){ const cu=Math.cos(u), su=Math.sin(u); switch(s.t){
  case 'zc': { const r=s.r0+s.k*(t-s.z0); return [s.cx+r*cu,s.cy+r*su,t]; }
  case 'hc': return s.ax==='x'?[t,s.cv+s.r*cu,s.cz+s.r*su]:[s.cv+s.r*cu,t,s.cz+s.r*su];
  case 'sp': { const ct=Math.cos(t); return [s.c[0]+s.r*ct*cu,s.c[1]+s.r*ct*su,s.c[2]+s.r*Math.sin(t)]; } } }
function SN(s,u,t){ const cu=Math.cos(u), su=Math.sin(u); switch(s.t){
  case 'zc': { const l=Math.sqrt(1+s.k*s.k); return [cu/l,su/l,-s.k/l]; }
  case 'hc': return s.ax==='x'?[0,cu,su]:[cu,0,su];
  case 'sp': { const ct=Math.cos(t); return [ct*cu,ct*su,Math.sin(t)]; } } }
function grad(s,p){ if(s.t==='pl') return s.n; const h=1e-5, g=[0,1,2].map(i=>{ const a=p.slice(), b=p.slice(); a[i]+=h; b[i]-=h; return (SF(s,...a)-SF(s,...b))/(2*h); }), l=Math.hypot(...g)||1; return g.map(v=>v/l); }
const rmax=s=>s.t==='zc'?Math.max(Math.abs(s.r0+s.k*(s.t0-s.z0)),Math.abs(s.r0+s.k*(s.t1-s.z0)),0.5):s.r;
/* корни f на [a, b]: n шагов, затем деление пополам */
function roots(f,a,b,n,per){ const out=[], z=v=>Math.abs(v)<1e-9?0:v; let x0=a, f0=z(f(a)), all0=f0===0;
  for(let i=1;i<=n;i++){ const x1=a+(b-a)*i/n, f1=z(f(x1)); if(f1!==0) all0=false;
    if(f0===0) out.push(x0);
    else if(f0*f1<0){ let lo=x0, hi=x1, flo=f0; for(let k=0;k<52;k++){ const m=(lo+hi)/2, fm=f(m); if(fm===0){ lo=hi=m; break; } if((fm<0)===(flo<0)){ lo=m; flo=fm; } else hi=m; } out.push((lo+hi)/2); }
    x0=x1; f0=f1; }
  if(!per&&f0===0) out.push(x0);
  return all0?[]:out; }
const H=0.4;   /* шаг вдоль кривой, мм */
/* кривая на параметрической поверхности A, где g(u,t) = 0: строки по u (решаем по t) и строки по t (решаем по u) */
function traceOn(A,g,tlo,thi,emit,chk){
  if(thi-tlo<1e-6) return; const R=rmax(A), Nu=Math.min(2400,Math.max(90,Math.ceil(2*Math.PI*R/H))), sph=A.t==='sp', Nt=Math.max(1,Math.ceil((thi-tlo)*(sph?R:1)/H));   /* у шара t — широта: шаг в мм по дуге */
  const ct=Math.max(2,Math.ceil((thi-tlo)/(sph?0.03:1))), cu=Math.min(720,Math.max(48,Math.ceil(2*Math.PI*R/1)));
  const rowsU=[]; for(let i=0;i<Nu;i++){ const u=i*2*Math.PI/Nu; rowsU.push(roots(t=>g(u,t),tlo,thi,ct).map(t=>SP(A,u,t))); }
  link(rowsU,true,emit,chk);
  const rowsT=[]; for(let j=0;j<=Nt;j++){ const t=tlo+(thi-tlo)*j/Nt; rowsT.push(roots(u=>g(u,t),0,2*Math.PI,cu,true).map(u=>SP(A,u,t))); }
  link(rowsT,false,emit,chk); }
function link(rows,cyc,emit,chk){ const n=rows.length, LM=3;
  for(let i=0;i<(cyc?n:n-1);i++){ const a=rows[i], b=rows[(i+1)%n]; if(!a.length||!b.length) continue; const pairs=new Set();
    const near=(p,L)=>{ let bi=-1, bd=LM; L.forEach((q,j)=>{ const d=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]); if(d<bd){ bd=d; bi=j; } }); return bi; };
    a.forEach((p,ia)=>{ const j=near(p,b); if(j>=0) pairs.add(ia+','+j); }); b.forEach((q,ib)=>{ const j=near(q,a); if(j>=0) pairs.add(j+','+ib); });
    pairs.forEach(k=>{ const [ia,ib]=k.split(',').map(Number), p=a[ia], q=b[ib], m=[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2]; if(chk(m)) emit(p,q); }); } }
/* пересечение двух плоскостей — прямая, обрезанная по коробке */
function lineOf(A,B,box,emit){ const n1=A.n, n2=B.n, d=[n1[1]*n2[2]-n1[2]*n2[1],n1[2]*n2[0]-n1[0]*n2[2],n1[0]*n2[1]-n1[1]*n2[0]], dd=dot3(d,d); if(dd<1e-10) return;
  const c1=A.c, c2=B.c, a=[n2[1]*d[2]-n2[2]*d[1],n2[2]*d[0]-n2[0]*d[2],n2[0]*d[1]-n2[1]*d[0]], b=[d[1]*n1[2]-d[2]*n1[1],d[2]*n1[0]-d[0]*n1[2],d[0]*n1[1]-d[1]*n1[0]];
  const p0=[0,1,2].map(i=>(c1*a[i]+c2*b[i])/dd), l=Math.sqrt(dd), u=d.map(v=>v/l); let s0=-1e9, s1=1e9;
  for(let i=0;i<3;i++){ if(Math.abs(u[i])<1e-12){ if(p0[i]<box[0][i]||p0[i]>box[1][i]) return; continue; } let ta=(box[0][i]-p0[i])/u[i], tb=(box[1][i]-p0[i])/u[i]; if(ta>tb) [ta,tb]=[tb,ta]; s0=Math.max(s0,ta); s1=Math.min(s1,tb); }
  if(s1-s0<1e-6) return; const N=Math.max(1,Math.ceil((s1-s0)/H)); let prev=null;
  for(let i=0;i<=N;i++){ const s=s0+(s1-s0)*i/N, p=[p0[0]+u[0]*s,p0[1]+u[1]*s,p0[2]+u[2]*s]; if(prev) emit(prev,p); prev=p; } }
const boxI=(a,b)=>[[0,1,2].map(i=>Math.max(a[0][i],b[0][i])),[0,1,2].map(i=>Math.min(a[1][i],b[1][i]))], boxOk=b=>b[0][0]<=b[1][0]&&b[0][1]<=b[1][1]&&b[0][2]<=b[1][2];
const grow=(b,e)=>[b[0].map(v=>v-e),b[1].map(v=>v+e)];
/* t-диапазон параметрической поверхности внутри коробки */
function tRange(A,bx){ if(A.t==='zc') return [Math.max(A.t0,bx[0][2]),Math.min(A.t1,bx[1][2])]; if(A.t==='hc'){ const i=A.ax==='x'?0:1; return [Math.max(A.t0,bx[0][i]),Math.min(A.t1,bx[1][i])]; } return [A.t0,A.t1]; }
/* все кривые пересечения пары поверхностей (точки лежат на обеих) */
function pairCurves(A,B,bx,emit){
  const tol=0.02, chk=m=>Math.abs(SF(A,...m))<tol&&Math.abs(SF(B,...m))<tol;
  if(A.t==='pl'&&B.t==='pl') return lineOf(A,B,bx,emit);
  const one=(P,Q)=>{ const [lo,hi]=tRange(P,bx); traceOn(P,(u,t)=>{ const p=SP(P,u,t); return SF(Q,p[0],p[1],p[2]); },lo,hi,(p,q)=>{ if(inB(p,bx)&&inB(q,bx)) emit(p,q); },chk); };
  if(A.t!=='pl') one(A,B); if(B.t!=='pl') one(B,A); }
const inB=(p,b)=>p[0]>=b[0][0]-1e-6&&p[0]<=b[1][0]+1e-6&&p[1]>=b[0][1]-1e-6&&p[1]<=b[1][1]+1e-6&&p[2]>=b[0][2]-1e-6&&p[2]<=b[1][2]+1e-6;
/* рёбра модели (от вида не зависят): кэш на модели */
function edges3(model){ if(model._e3) return model._e3;
  const MB=grow(model.box,1.5), PR=[]; (function w(n){ if(n.k){ if(n.a) w(n.a); n.k.forEach(w); } else PR.push(n); })(model.tree);
  const SS=[]; PR.forEach(nd=>{ const J=JC(nd), bb=boxI(grow(primBox(nd,MB),0.01),MB); surfsOf(nd).forEach(s=>{ s.J=J; s.bb=bb; s.pr=nd; SS.push(s); }); });
  const segs=[];
  /* плоскость, касательная к цилиндру (паз со скруглёнными концами, прилив, касательный к бобышке): переход плавный —
     линию касания не проводят (ГОСТ 2.305) */
  const tang=(P,C)=>{ if(P.t!=='pl') return false; const n=P.n;
    if(C.t==='zc'&&Math.abs(C.k)<1e-9) return Math.abs(n[2])<1e-6&&Math.abs(Math.abs(n[0]*C.cx+n[1]*C.cy-P.c)-C.r0)<0.05;
    if(C.t==='hc'){ const a=C.ax==='x'?0:1; return Math.abs(n[a])<1e-6&&Math.abs(Math.abs(n[1-a]*C.cv+n[2]*C.cz-P.c)-C.r)<0.05; }
    return false; };
  for(let i=0;i<SS.length;i++) for(let j=i+1;j<SS.length;j++){ const A=SS[i], B=SS[j], bx=boxI(A.bb,B.bb); if(!boxOk(bx)||tang(A,B)||tang(B,A)) continue;
    pairCurves(A,B,bx,(p,q)=>{ if(Math.abs(A.J(...p))<2e-3&&Math.abs(B.J(...p))<2e-3||Math.abs(A.J(...q))<2e-3&&Math.abs(B.J(...q))<2e-3) segs.push({p,q,A,B}); }); }
  return model._e3={segs,SS,MB}; }
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/* контуры области f < 0 на прямоугольнике (квадратики), петли в координатах (u, v) */
function msLoops(f,u0,u1,v0,v1,st){ const nu=Math.ceil((u1-u0)/st), nv=Math.ceil((v1-v0)/st), F=new Float64Array((nu+1)*(nv+1));
  for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++) F[j*(nu+1)+i]=f(u0+i*st,v0+j*st);
  const at=(i,j)=>F[j*(nu+1)+i], segs=[], ip=(i0,j0,i1,j1)=>{ const a=at(i0,j0), b=at(i1,j1), t=a/(a-b); return [u0+(i0+(i1-i0)*t)*st, v0+(j0+(j1-j0)*t)*st]; };
  for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const c=(at(i,j)<IN0?1:0)|(at(i+1,j)<IN0?2:0)|(at(i+1,j+1)<IN0?4:0)|(at(i,j+1)<IN0?8:0); if(c===0||c===15) continue;
    const e=[()=>ip(i,j,i+1,j),()=>ip(i+1,j,i+1,j+1),()=>ip(i,j+1,i+1,j+1),()=>ip(i,j,i,j+1)];
    ({1:[[0,3]],2:[[0,1]],3:[[1,3]],4:[[1,2]],5:[[0,1],[2,3]],6:[[0,2]],7:[[2,3]],8:[[2,3]],9:[[0,2]],10:[[0,3],[1,2]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[0,3]]})[c].forEach(([a,b])=>segs.push([e[a](),e[b]()])); }
  const key=p=>p[0].toFixed(5)+','+p[1].toFixed(5), adj=new Map(); segs.forEach((g,i)=>g.forEach(p=>{ const k=key(p); if(!adj.has(k)) adj.set(k,[]); adj.get(k).push(i); }));
  const used=new Uint8Array(segs.length), loops=[];
  for(let i=0;i<segs.length;i++){ if(used[i]) continue; used[i]=1; const pts=[segs[i][0],segs[i][1]]; let cur=segs[i][1];
    for(;;){ const nx=(adj.get(key(cur))||[]).find(j=>!used[j]); if(nx==null) break; used[nx]=1; const g=segs[nx]; cur=key(g[0])===key(cur)?g[1]:g[0]; pts.push(cur); }
    let ar=0; for(let q=1;q<pts.length;q++) ar+=pts[q-1][0]*pts[q][1]-pts[q][0]*pts[q-1][1]; if(pts.length>4&&Math.abs(ar)>2*st*st*4) loops.push(pts); }
  return loops; }
/* отрезки → цепочки (концы сшиваются с допуском), упрощение Дугласа — Пекера */
function chains(S,tol){ const G=new Map(), cell=2, k=(x,y)=>Math.floor(x/cell)+','+Math.floor(y/cell);
  S.forEach((s,i)=>[0,1].forEach(e=>{ const p=e?s.b:s.a, kk=k(p[0],p[1]); if(!G.has(kk)) G.set(kk,[]); G.get(kk).push([i,e]); }));
  const used=new Uint8Array(S.length), out=[];
  const next=(p,dir,excl)=>{ let best=null, bs=-2; const cx=Math.floor(p[0]/cell), cy=Math.floor(p[1]/cell);
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) (G.get((cx+dx)+','+(cy+dy))||[]).forEach(([i,e])=>{ if(used[i]||i===excl) return; const s=S[i], q=e?s.b:s.a, o=e?s.a:s.b;
      if(Math.hypot(q[0]-p[0],q[1]-p[1])>tol) return; const l0=Math.hypot(o[0]-q[0],o[1]-q[1]), l=l0||1, c=dir?((o[0]-q[0])*dir[0]+(o[1]-q[1])*dir[1])/l:0; if(c>bs){ bs=c; best=[i,e]; } });
    return best&&(dir?bs>0.5:true)?best:null; };
  for(let i=0;i<S.length;i++){ if(used[i]) continue; used[i]=1; let L=[S[i].a,S[i].b];
    /* направление цепочки — по отрезку не короче 1,5 px: ребро, почти параллельное взгляду, приходит кусочками в доли пикселя, и направление одного кусочка — шум */
    const dirOf=()=>{ const p=L[L.length-1]; for(let j=L.length-2;j>=0;j--){ const d=Math.hypot(p[0]-L[j][0],p[1]-L[j][1]); if(d>=1.5) return [(p[0]-L[j][0])/d,(p[1]-L[j][1])/d]; } return null; };
    for(let side=0;side<2;side++){ for(;;){ const p=L[L.length-1], n=next(p,dirOf(),i); if(!n) break; used[n[0]]=1; const s=S[n[0]]; L.push(n[1]?s.a:s.b); } L.reverse(); }
    const xs=L.map(p=>p[0]), ys=L.map(p=>p[1]); if(Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))<6) continue;   /* вершина конуса (срез Ø0,6) — точка, не линия */
    out.push(dp(L,0.06)); }
  return out; }
function dp(L,e){ if(L.length<3) return L; const keep=new Uint8Array(L.length); keep[0]=keep[L.length-1]=1; const st=[[0,L.length-1]];
  while(st.length){ const [a,b]=st.pop(); const A=L[a], B=L[b], dx=B[0]-A[0], dy=B[1]-A[1], l=Math.hypot(dx,dy); let mi=-1, md=e;
    for(let i=a+1;i<b;i++){ const d=l<1e-6?Math.hypot(L[i][0]-A[0],L[i][1]-A[1]):Math.abs((L[i][0]-A[0])*dy-(L[i][1]-A[1])*dx)/l; if(d>md){ md=d; mi=i; } } if(mi>=0){ keep[mi]=1; st.push([a,mi],[mi,b]); } }
  return L.filter((_,i)=>keep[i]); }
/* убрать повторы: отрезок, лежащий на уже принятом (видимый поверх невидимого), не рисуем */
function dedupe(S){ const G=new Map(), cell=3, acc=[], tol=0.35;
  const add=s=>{ const x0=Math.floor(Math.min(s.a[0],s.b[0])/cell), x1=Math.floor(Math.max(s.a[0],s.b[0])/cell), y0=Math.floor(Math.min(s.a[1],s.b[1])/cell), y1=Math.floor(Math.max(s.a[1],s.b[1])/cell);
    for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++){ const k=x+','+y; if(!G.has(k)) G.set(k,[]); G.get(k).push(s); } };
  const cov=(p,dir,h)=>{ const k=Math.floor(p[0]/cell)+','+Math.floor(p[1]/cell); return (G.get(k)||[]).some(s=>{ if(!h&&s.h) return false; const dx=s.b[0]-s.a[0], dy=s.b[1]-s.a[1], l=Math.hypot(dx,dy)||1e-9;
    if(Math.abs(dx*dir[1]-dy*dir[0])/l>0.25) return false; const t=((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dy)/(l*l); if(t<-0.02||t>1.02) return false; return Math.abs((p[0]-s.a[0])*dy-(p[1]-s.a[1])*dx)/l<tol; }); };
  const out=[]; S.sort((a,b)=>a.h-b.h); S.forEach(s=>{ const dx=s.b[0]-s.a[0], dy=s.b[1]-s.a[1], l=Math.hypot(dx,dy); if(l<1e-4) return; const dir=[dx/l,dy/l];
    if([0.15,0.5,0.85].every(t=>cov([s.a[0]+dx*t,s.a[1]+dy*t],dir,s.h))) return; add(s); out.push(s); });
  return out; }
/* элементы детали в порядке построения: сначала тела, потом отверстия и вырезы; одинаковые отверстия на окружности — один элемент */
function features(model){ if(model._ft) return model._ft; let F=[];
  const prims=nd=>{ const o=[]; (function w(n){ if(n.k){ if(n.a) w(n.a); n.k.forEach(w); } else o.push(n); })(nd); return o; };
  (function walk(n,sub){ if(n.t==='s'&&!sub){ walk(n.a,false); n.k.forEach(c=>walk(c,true)); return; } if(n.t==='u'&&!sub){ n.k.forEach(c=>walk(c,false)); return; } F.push({kind:sub?'sub':'add',nd:n,nds:[n],prims:prims(n),n:1}); })(model.tree,false);
  F=F.filter(f=>f.kind==='add').concat(F.filter(f=>f.kind==='sub'));
  const b=model.box, d=v=>String(Math.round(v*10)/10).replace('.',','), cnt={3:'трёхгранн',4:'четырёхгранн',5:'пятигранн',6:'шестигранн'}, up=t=>t[0].toUpperCase()+t.slice(1);
  const nm=f=>{ const p=f.nd;
    if(f.kind==='add') switch(p.t){ case 'cyl': return 'Цилиндр Ø'+d(2*p.r); case 'cone': return Math.min(p.r0,p.r1)<1?'Конус':'Усечённый конус'; case 'box': return 'Параллелепипед';
      case 'ngon': return up(cnt[p.n]+'ая призма'); case 'npyr': return up((Math.min(p.s0,p.s1)<1?'':'усечённая ')+(cnt[p.n]||'')+'ая пирамида'); case 'sph': return 'Шар Ø'+d(2*p.r); case 'hcyl': return 'Цилиндр Ø'+d(2*p.r);
      default: return nm({kind:'add',nd:f.prims[0]})+' со срезами'; }
    switch(p.t){ case 'cyl': return f.n>1?'Отверстия Ø'+d(2*p.r)+' ('+f.n+' шт.)':'Отверстие Ø'+d(2*p.r); case 'cone': return Math.min(p.r0,p.r1)<0.1&&Math.max(p.r0,p.r1)<8?'Конец глухого отверстия (конус сверла 118°)':'Коническое отверстие';
      case 'ngon': return p.n===4?'Квадратное отверстие':up(cnt[p.n]+'ое отверстие'); case 'npyr': return 'Пирамидальное отверстие'; case 'hcyl': return 'Поперечное отверстие Ø'+d(2*p.r); case 'sph': return 'Сферическая полость';
      case 'box': { const t=p.a*Math.PI/180, hx=(Math.abs(Math.cos(t))*p.sx+Math.abs(Math.sin(t))*p.sy)/2, hy=(Math.abs(Math.sin(t))*p.sx+Math.abs(Math.cos(t))*p.sy)/2, B=[[p.x-hx,p.y-hy,p.z0],[p.x+hx,p.y+hy,p.z1]], out=i=>[B[0][i]<b[0][i]-0.3,B[1][i]>b[1][i]+0.3], X=out(0), Y=out(1), Z=out(2), thr=X[0]&&X[1]&&!Y[0]&&!Y[1]||Y[0]&&Y[1]&&!X[0]&&!X[1];
        if(thr&&(Z[0]||Z[1])) return 'Паз'; if(thr) return 'Сквозное прямоугольное отверстие'; if(X[0]||X[1]||Y[0]||Y[1]||Z[0]||Z[1]) return 'Вырез'; return Math.abs(p.sx-p.sy)<1e-6?'Квадратное отверстие':'Прямоугольное отверстие'; } }
    return f.prims.some(q=>q.t==='box'&&/Сквозное|Паз/.test(nm({kind:'sub',nd:q})))?'Сквозное отверстие':'Выемка'; };
  F.forEach(f=>f.name=nm(f));
  const G=[]; F.forEach(f=>{ const q=G[G.length-1]; if(q&&q.kind==='sub'&&f.kind==='sub'&&q.name0===f.name){ q.prims.push(...f.prims); q.nds.push(f.nd); q.n++; q.name=f.nd.t==='cyl'?'Отверстия Ø'+d(2*f.nd.r)+' ('+q.n+' шт.)':f.name+' ('+q.n+' шт.)'; } else { f.name0=f.name; G.push(f); } });
  G.forEach((f,i)=>{ f.i=i; });
  Object.defineProperty(model,'_ft',{value:G}); return G; }
/* деталь «на шаге i»: тела и отверстия с 0-го по i-й элемент */
function partial(model,i){ const FT=features(model), A=[], Sb=[]; FT.slice(0,i+1).forEach(f=>(f.kind==='add'?A:Sb).push(...f.nds));
  const t=A.length>1?{t:'u',k:A}:A[0]; return {tree:Sb.length?{t:'s',a:t,k:Sb}:t,box:model.box}; }
/* линии → пути SVG: сплошные и штриховые */
function paths(L){ const f2=v=>v.toFixed(2), path=Q=>Q.map((p,i)=>(i?'L':'M')+f2(p[0])+' '+f2(p[1])).join(''); return {v:chains(L.filter(s=>!s.h),0.45).map(path).join(''),h:chains(L.filter(s=>s.h),0.45).map(path).join('')}; }
/* половина вида и половина разреза (front, left): невидимый контур на половине вида не проводят — внутреннее устройство показано разрезом */
const VIEW={front:{yaw:0,pit:1e-4,cut:1},front0:{yaw:0,pit:1e-4,cut:0,hid:2,full:1},left0:{yaw:Math.PI/2,pit:1e-4,cut:0,hid:3,full:1},frontF:{yaw:0,pit:1e-4,cut:2},frontSH:{yaw:0,pit:1e-4,cut:7},frontS:{yaw:0,pit:1e-4,cut:8},leftF:{yaw:Math.PI/2,pit:1e-4,cut:3},left:{yaw:Math.PI/2,pit:1e-4,cut:5},top:{yaw:0,pit:Math.PI/2-1e-4,cut:0,hid:1,full:1},topNH:{yaw:0,pit:Math.PI/2-1e-4,cut:0},topcut:{yaw:0,pit:Math.PI/2-1e-4,cut:6}};
/* ── условность ГОСТ 2.305 (условности и упрощения): отверстия на круглом фланце, не попадающие в секущую плоскость, показывают
   в разрезе как попавшие в неё — каждое поворачиваем вокруг оси детали в плоскость разреза, на тот же радиус (ближайшее положение).
   ax 'y' — фронтальная плоскость y = 0 (главный вид), 'x' — профильная x = 0 (вид слева). Отверстие поворачиваем, только если
   вокруг него материал тот же на любом угле (фланец круглый): иначе это не «отверстие на круглом фланце», оставляем как есть. ── */
function conv(model,ax){ const key=ax==='y'?'_cvy':'_cvx'; if(model[key]) return model[key]; let out=model; const T=model.tree;
  if(T&&T.t==='s'){
    const off=c=>(c.t==='cyl'&&c.r<12||c.t==='cone'&&Math.max(c.r0,c.r1)<12)&&Math.hypot(c.x||0,c.y||0)>1, hs=T.k.filter(off);
    if(hs.length){ const Jb=JC({t:'s',a:T.a,k:T.k.filter(c=>!off(c))}), b=model.box, tg=ax==='y'?[0,Math.PI]:[-Math.PI/2,Math.PI/2];
      /* точки вокруг отверстия — в его собственной полярной системе (по радиусу от оси детали и поперёк): у круглого фланца совпадут */
      const probe=(c,x,y)=>{ const r=c.t==='cyl'?c.r:Math.max(c.r0,c.r1), z0=Math.max(c.z0+0.7,b[0][2]+0.3), z1=Math.min(c.z1-0.7,b[1][2]-0.3), f=Math.atan2(y,x), s=[];   /* только в пределах самого отверстия, без припуска E за торцы */
        for(let i=0;i<=4;i++){ const z=z0+(z1-z0)*i/4; for(let j=0;j<12;j++){ const a=f+j*Math.PI/6; [0.6,1.6].forEach(m=>s.push(Jb(x+r*m*Math.cos(a),y+r*m*Math.sin(a),z)<0)); } } return s.join(); };
      const seen=new Set(), K=[]; let moved=false;
      T.k.forEach(c=>{ if(!off(c)){ K.push(c); return; } const R=Math.hypot(c.x,c.y), a=Math.atan2(c.y,c.x);
        let best=tg[0], bd=1e9; tg.forEach(t=>{ const d=Math.abs(Math.atan2(Math.sin(a-t),Math.cos(a-t))); if(d<bd-1e-6){ bd=d; best=t; } });
        const endsOk=(x,y)=>[c.z0,c.z1].every(z=>(Jb(c.x,c.y,z)<0)===(Jb(x,y,z)<0));   /* торцы: где отверстие выходило наружу, там и на новом месте должно выходить (иначе это не тот же фланец — v1: сверху треугольная призма) */
        let q=c; if(bd>1e-6){ const x=R*Math.cos(best), y=R*Math.sin(best); if(probe(c,c.x,c.y)===probe(c,x,y)&&endsOk(x,y)){ q=Object.assign({},c,{x,y}); moved=true;
          /* торец отверстия выходил наружу, а на новом месте за ним материал (например, полуконус только сзади) — там отверстие кончается: на высоте, где кончался материал */
          const rr=(c.t==='cyl'?c.r:Math.max(c.r0,c.r1))*0.8, any=(px,py,z)=>[[0,0]].concat(Array.from({length:8},(_,i)=>[rr*Math.cos(i*Math.PI/4),rr*Math.sin(i*Math.PI/4)])).some(d=>Jb(px+d[0],py+d[1],z)<0), io=z=>any(c.x,c.y,z), inn=z=>any(x,y,z); if(!io(c.z1)&&inn(c.z1)){ let z=c.z1; while(z>c.z0&&!io(z)) z-=0.05; q.z1=z+0.05; } if(!io(c.z0)&&inn(c.z0)){ let z=c.z0; while(z<c.z1&&!io(z)) z+=0.05; q.z0=z-0.05; } } }
        const k2=JSON.stringify([q.t,q.r,q.r0,q.r1,q.z0,q.z1,q.x.toFixed(3),q.y.toFixed(3)]); if(!seen.has(k2)){ seen.add(k2); K.push(q); } });
      if(moved){ out={}; Object.keys(model).forEach(k=>{ if(k[0]!=='_') out[k]=model[k]; }); out.tree={t:'s',a:T.a,k:K}; } } }   /* кэши модели (_e3, _spec…) не копируем — они от другой геометрии */
  Object.defineProperty(model,key,{value:out}); return out; }
/* вид модели: {svg, url, px} — px переводит точку (мм) в координаты картинки W×W; на разрезах — с условностью для отверстий фланца */
function drawing(model,view,W,off,bnd){
  const ct=VIEW[view]&&VIEW[view].cut; if(ct===1||ct===2) model=conv(model,'y'); else if(ct===3||ct===5) model=conv(model,'x');
  W=W||1000; off=off||0; bnd=bnd||0; const key=[view,W,off,bnd].join('|'), memo=model._dw||(Object.defineProperty(model,'_dw',{value:new Map()}),model._dw);
  if(!memo.has(key)) memo.set(key,draw1(model,view,W,off,bnd)); return memo.get(key); }
function draw1(model,view,W,off,bnd){ const V=VIEW[view], E3=edges3(model), J=jc(model.tree), b=model.box;
  const C=[(b[0][0]+b[1][0])/2,(b[0][1]+b[1][1])/2,(b[0][2]+b[1][2])/2], R=Math.hypot(b[1][0]-b[0][0],b[1][1]-b[0][1],b[1][2]-b[0][2])/2,
    scale=Math.max(R*1.62,1.08*Math.max(b[1][0]-b[0][0],b[1][1]-b[0][1],b[1][2]-b[0][2]));   /* длинная плоская деталь не должна выходить за окно вида */
  const cy=Math.cos(V.yaw), sy=Math.sin(V.yaw), cp=Math.cos(V.pit), sp=Math.sin(V.pit), F=[sy*cp,cy*cp,-sp], Rr=(()=>{ const r=crs(F,[0,0,1]), l=Math.hypot(...r); return r.map(v=>v/l); })(), Up=crs(Rr,F);
  const px=q=>{ const d=[q[0]-C[0],q[1]-C[1],q[2]-C[2]]; return [W/2+dot3(d,Rr)/scale*W, W/2-dot3(d,Up)/scale*W]; };
  /* разрез: убранная часть и секущие плоскости (одна из них — граница вида и разреза, её рёбра не рисуем) */
  /* ступенчатый разрез (7 — половина вида и половина разреза, 8 — полный): секущие плоскости y = const на участках по x
     (model.step: [[x0, x1, y], …]); переходы между ними на разрезе не изображают (ГОСТ 2.305) */
  const STP=model.step||[[-1e4,1e4,0]], yAt=x=>(STP.find(q=>x>=q[0]&&x<=q[1])||STP[x<STP[0][0]?0:STP.length-1])[2];
  const cut=V.cut, CT={1:p=>Math.max(bnd-p[0],p[1]-off),2:p=>p[1]-off,3:p=>p[0]-off,5:p=>Math.max(p[0]-off,p[1]-bnd),6:p=>off-p[2],7:p=>Math.max(bnd-p[0],p[1]-yAt(p[0])),8:p=>p[1]-yAt(p[0])}[cut];
  const Jv=CT?(x,y,z)=>Math.max(J(x,y,z),-CT([x,y,z])):J;
  const pl=(n,c,face)=>({t:'pl',n,c,J:()=>0,bb:E3.MB,face});
  const stepPl=()=>STP.map(q=>pl([0,1,0],q[2],1)).concat(STP.slice(1).map(q=>pl([1,0,0],q[0],0)));
  const CP={1:[pl([1,0,0],bnd,0),pl([0,1,0],off,1)],2:[pl([0,1,0],off,1)],3:[pl([1,0,0],off,1)],5:[pl([1,0,0],off,1),pl([0,1,0],bnd,0)],6:[pl([0,0,1],off,1)],7:[pl([1,0,0],bnd,0)].concat(stepPl()),8:stepPl()}[cut]||[];
  const SG=E3.segs.slice();
  CP.filter(c=>c.face).forEach(c=>E3.SS.forEach(B=>{ const bx=boxI(B.bb,E3.MB); if(!boxOk(bx)) return; pairCurves(c,B,bx,(p,q)=>{ if(Math.abs(B.J(...p))<2e-3||Math.abs(B.J(...q))<2e-3) SG.push({p,q,A:c,B}); }); }));
  /* очерк: поверхность касается луча зрения */
  E3.SS.forEach(A=>{ if(A.t==='pl') return; const [lo,hi]=tRange(A,A.bb); traceOn(A,(u,t)=>dot3(SN(A,u,t),F),lo,hi,(p,q)=>{ if(Math.abs(A.J(...p))<2e-3||Math.abs(A.J(...q))<2e-3) SG.push({p,q,A,B:null}); },m=>Math.abs(SF(A,...m))<0.02); });
  /* точка на ребре: на границе тела и к ней подходят обе поверхности (излом); на очерке — поверхность и есть граница */
  const side=(q,n,d)=>(Jv(q[0]+n[0]*d,q[1]+n[1]*d,q[2]+n[2]*d)<0)!==(Jv(q[0]-n[0]*d,q[1]-n[1]*d,q[2]-n[2]*d)<0);
  const valid=(p,A,B)=>{ if(Math.abs(Jv(p[0],p[1],p[2]))>0.01) return false;
    if(!B){ const n=grad(A,p); return side(p,n,0.02); }
    const na=grad(A,p), nb=grad(B,p), T=crs(na,nb), tl=Math.hypot(...T); if(tl<0.03) return false; const t=T.map(v=>v/tl), ra=crs(t,na), rb=crs(t,nb), e=0.06, d=0.015;
    const on=(r,n,s)=>side([p[0]+r[0]*e*s,p[1]+r[1]*e*s,p[2]+r[2]*e*s],n,d);
    return (on(ra,na,1)||on(ra,na,-1))&&(on(rb,nb,1)||on(rb,nb,-1)); };
  /* луч к наблюдателю: внутри материала — точка закрыта. На общей грани двух тел (фланец и конус на одном уровне) функция равна нулю,
     поэтому там смотрим по обе стороны луча: материал с обеих сторон — значит, внутри */
  const MB=grow(E3.MB,2), O1=Rr.map(v=>v*0.01), O2=Up.map(v=>v*0.01), inMat=(q,v)=>{ if(v<-0.004) return true; if(v>0.004) return false;
    /* у острого ребра отверстия (вершина треугольника, ромба) пустота у самого ребра — узкая щель: смотрим чуть дальше по лучу — если там пусто, это не материал */
    if(Jv(q[0]-F[0]*0.5,q[1]-F[1]*0.5,q[2]-F[2]*0.5)>0.004) return false;
    return [O1,O2].some(o=>Jv(q[0]+o[0],q[1]+o[1],q[2]+o[2])<0&&Jv(q[0]-o[0],q[1]-o[1],q[2]-o[2])<0); };
  const seen=p=>{ let s=0.03; for(let i=0;i<6000;i++){ const q=[p[0]-F[0]*s,p[1]-F[1]*s,p[2]-F[2]*s]; if(!inB(q,MB)) return true; const v=Jv(q[0],q[1],q[2]); if(inMat(q,v)) return false; s+=Math.max(v,0.15); } return true; };
  const px0=q=>W/2+dot3([q[0]-C[0],q[1]-C[1],q[2]-C[2]],Rr)/scale*W, bx=cut===1||cut===7?px0([bnd,0,C[2]]):cut===5?px0([0,bnd,C[2]]):-1e4, half=V.full?W*2:(bx>-1e3?bx:W/2);
  const st=(p,A,B)=>{ if(!valid(p,A,B)) return 0; if(seen(p)) return 1; return V.hid&&px(p)[0]<half-1.5?2:0; };
  const S2=[], tok={};   /* состояние точки считаем один раз за вызов */
  SG.forEach(g=>{ if(g.A.face===0||g.B&&g.B.face===0) return; const sp=g.p._v===tok?g.p._s:(g.p._v=tok,g.p._s=st(g.p,g.A,g.B)), sq_=g.q._v===tok?g.q._s:(g.q._v=tok,g.q._s=st(g.q,g.A,g.B));
    /* e — ребро (излом между двумя поверхностями), иначе очерк; c — контур разреза (линия на секущей плоскости): для «Читаю чертёж» */
    const put=(a,c,s)=>{ if(s) S2.push({a:px(a),b:px(c),h:s===2,a3:a,b3:c,e:g.B?1:0,c:(g.A.face!=null||g.B&&g.B.face!=null)?1:0}); };
    if(sp===sq_){ put(g.p,g.q,sp); return; }
    let lo=0, hi=1; const at=t=>[g.p[0]+(g.q[0]-g.p[0])*t,g.p[1]+(g.q[1]-g.p[1])*t,g.p[2]+(g.q[2]-g.p[2])*t];
    for(let k=0;k<7;k++){ const m=(lo+hi)/2; if(st(at(m),g.A,g.B)===sp) lo=m; else hi=m; } const m=at((lo+hi)/2); put(g.p,m,sp); put(m,g.q,sq_); });
  const SD=dedupe(S2.slice()), f2=v=>v.toFixed(2), path=L=>L.map((p,i)=>(i?'L':'M')+f2(p[0])+' '+f2(p[1])).join('');
  /* разрыв видимой линии там, где ребро касается другого (квадрат вписан в окружность и т. п.): у точки касания проверка ребра
     вырождается и кусок длиной в 1–2 мм пропадает. Концы двух цепочек на одной прямой, смотрящие друг на друга, ближе 2,5 мм — сшиваем */
  const bridge=CH=>{ const mmL=W/scale, ends=[]; CH.forEach((L,i)=>{ if(L.length<2) return; const e=(p,q)=>{ const d=Math.hypot(p[0]-q[0],p[1]-q[1])||1; return [(p[0]-q[0])/d,(p[1]-q[1])/d]; };
      ends.push({i,p:L[0],u:e(L[0],L[1])},{i,p:L[L.length-1],u:e(L[L.length-1],L[L.length-2])}); });
    const add=[], used=new Set();
    ends.forEach((a,ia)=>{ if(used.has(ia)) return; let best=-1, bd=2.5*mmL; ends.forEach((b,ib)=>{ if(ib===ia||b.i===a.i||used.has(ib)) return; const dx=b.p[0]-a.p[0], dy=b.p[1]-a.p[1], d=Math.hypot(dx,dy); if(d<0.3*mmL||d>=bd) return;
        const g=[dx/d,dy/d]; if(a.u[0]*g[0]+a.u[1]*g[1]>0.995&&-(b.u[0]*g[0]+b.u[1]*g[1])>0.995){ bd=d; best=ib; } });
      if(best>=0){ used.add(ia); used.add(best); add.push([a.p,ends[best].p]); } });
    return CH.concat(add); };
  const vis=bridge(chains(SD.filter(s=>!s.h),0.45)).map(path).join(''), hid=chains(SD.filter(s=>s.h),0.45).map(path).join('');
  /* штриховка сечения на секущей плоскости */
  let hat='';
  /* ступенчатый разрез: каждая секущая плоскость штрихуется на своём участке по x */
  const FCL=cut===7||cut===8?CP.filter(c=>c.face).map((c,i)=>({c,x0:STP[i][0],x1:STP[i][1]})):[CP.find(c=>c.face)].filter(Boolean).map(c=>({c}));
  /* рёбра жёсткости (узлы с rib — ось толщины): плоскость вдоль ребра — ребро показывают незаштрихованным, его контур — сплошной
     основной линией (ГОСТ 2.305, условности). Берём только тела детали (не вычитаемые части) */
  const RIBS=[]; (function w(nd){ if(!nd) return; if(nd.rib!=null){ RIBS.push(nd); return; } if(nd.t==='u') nd.k.forEach(w); else if(nd.t==='s') w(nd.a); })(model.tree);
  let ribv='';
  FCL.forEach(({c:fc,x0:sx0,x1:sx1})=>{ const n=fc.n, ax=n[0]?0:n[1]?1:2, ua=ax===2?0:ax===0?1:0, va=ax===2?1:2, lo=[b[0][0]-1,b[0][1]-1,b[0][2]-1], hi=[b[1][0]+1,b[1][1]+1,b[1][2]+1];
    const RB=RIBS.filter(r=>r.rib===ax), JR=RB.length?jc(RB.length>1?{t:'u',k:RB}:RB[0]):null;
    const lim=cut===1?q=>bnd-q[0]:cut===5?q=>q[1]-bnd:cut===7?q=>Math.max(bnd-q[0],q[0]-sx1,sx0-q[0]):cut===8?q=>Math.max(q[0]-sx1,sx0-q[0]):()=>-1e9;   /* сечение — только в убранной части */
    const P3=(u,v)=>{ const q=[0,0,0]; q[ax]=fc.c; q[ua]=u; q[va]=v; return q; };
    /* штрихуем только разрезанный материал: он есть по обе стороны плоскости (грань детали, лежащая в плоскости, — не сечение) */
    const e=n.map(v=>v*0.01), mat=q=>Math.max(J(q[0]+e[0],q[1]+e[1],q[2]+e[2]),J(q[0]-e[0],q[1]-e[1],q[2]-e[2]),lim(q));
    const loops=msLoops((u,v)=>{ const q=P3(u,v); return JR?Math.max(mat(q),-JR(...q)):mat(q); },lo[ua],hi[ua],lo[va],hi[va],0.2);
    hat+=loops.map(L=>L.map((p,i)=>{ const q=px(P3(p[0],p[1])); return (i?'L':'M')+f2(q[0])+' '+f2(q[1]); }).join('')+'Z').join('');
    if(JR) msLoops((u,v)=>{ const q=P3(u,v); return Math.max(mat(q),JR(...q)); },lo[ua],hi[ua],lo[va],hi[va],0.2).forEach(L=>{
      const Q=L.map(p=>P3(p[0],p[1])), Pp=Q.map(px); ribv+=Pp.map((q,i)=>(i?'L':'M')+f2(q[0])+' '+f2(q[1])).join('')+'Z';
      for(let i=0;i<Q.length;i++){ const j=(i+1)%Q.length; SD.push({a:Pp[i],b:Pp[j],h:false,a3:Q[i],b3:Q[j],e:1,c:1}); } }); });
  /* толщины и шаг — в мм листа (ГОСТ 2.303, 2.306): основная s = 0,7, штриховка — шаг 7/3 мм (как на листе ДЗ, 7 единиц при 3 ед./мм),
     штриховая линия — штрихи 2,5 мм, промежутки 1,1 мм. Так у всех вариантов одинаково, какого бы размера ни была деталь */
  const mm=W/scale, sw=0.7*mm, hs=7/3*mm;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">`
    +(hat?`<defs><pattern id="h" patternUnits="userSpaceOnUse" width="${f2(hs)}" height="${f2(hs)}" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${f2(hs)}" stroke="#111" stroke-width="${f2(sw*0.34)}"/></pattern></defs><path d="${hat}" fill="url(#h)" fill-rule="evenodd"/>`:'')
    +(hid?`<path d="${hid}" fill="none" stroke="#111" stroke-width="${f2(sw*0.45)}" stroke-dasharray="${f2(2.5*mm)} ${f2(1.1*mm)}" stroke-linecap="butt"/>`:'')
    +`<path d="${vis}${ribv}" fill="none" stroke="#111" stroke-width="${f2(sw)}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return {svg,W,px,box:b,url:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),lines:SD,sw,mm}; }
/* ── контур сечения плоскостью O + a·U + b·V (U, V — орты): петли в координатах (a, b).
   Вертикальные отверстия, которые плоскость пересекает целиком (эллипс лежит внутри материала, в том числе касается края),
   строятся отдельно — точной замкнутой кривой; внешний контур считается по детали без них. Так контур и отверстие
   замкнуты даже в точке касания (сетка там рвёт линию). ── */
function secShape(tree,O,U,V,box,step){
  const n=[U[1]*V[2]-U[2]*V[1],U[2]*V[0]-U[0]*V[2],U[0]*V[1]-U[1]*V[0]], cands=[];
  (function w(nd,sub){ if(!nd) return; if(nd.t==='s'){ w(nd.a,sub); nd.k.forEach(c=>w(c,true)); return; } if(nd.k){ nd.k.forEach(c=>w(c,sub)); return; } if(sub&&nd.t==='cyl'&&Math.abs(n[2])>1e-6) cands.push(nd); })(tree,false);
  const strip=(nd,rm)=>nd.t==='s'?{t:'s',a:strip(nd.a,rm),k:nd.k.filter(c=>!rm.has(c)).map(c=>strip(c,rm))}:nd.k?Object.assign({},nd,{k:nd.k.map(c=>strip(c,rm))}):nd;
  const ell=h=>Array.from({length:97},(_,i)=>{ const t=i/96*2*Math.PI, X=h.x+h.r*Math.cos(t), Y=h.y+h.r*Math.sin(t), z=O[2]+(n[0]*(O[0]-X)+n[1]*(O[1]-Y))/n[2], d=[X-O[0],Y-O[1],z-O[2]];
    return {p:[X,Y,z],q:[d[0]*U[0]+d[1]*U[1]+d[2]*U[2],d[0]*V[0]+d[1]*V[1]+d[2]*V[2]]}; });
  const full=jc(tree), rm=new Set(), holes=[];
  cands.forEach(h=>{ const E=ell(h); if(!E.every(e=>e.p[2]>h.z0+1e-3&&e.p[2]<h.z1-1e-3)) return; rm.add(h); holes.push(E); });
  let T2=rm.size?strip(tree,rm):tree; const J2=jc(T2);
  /* отверстие отдельно — только если его эллипс целиком в материале детали без него (касание края — допустимо) */
  const keep=[]; holes.forEach((E,i)=>{ if(E.every(e=>J2(...e.p)<0.05)) keep.push(E); else rm.delete([...rm][i]); });
  if(keep.length!==holes.length) T2=rm.size?strip(tree,rm):tree;
  const R=section(T2,O,U,V,box,step), segs=R.segs, key=p=>p[0].toFixed(3)+','+p[1].toFixed(3), adj=new Map();
  segs.forEach((g,i)=>g.forEach(p=>{ const k=key(p); if(!adj.has(k)) adj.set(k,[]); adj.get(k).push(i); }));
  const used=new Uint8Array(segs.length), loops=[];
  for(let i=0;i<segs.length;i++){ if(used[i]) continue; used[i]=1; const pts=[segs[i][0],segs[i][1]]; let cur=segs[i][1];
    for(;;){ const nx=(adj.get(key(cur))||[]).find(j=>!used[j]); if(nx==null) break; used[nx]=1; const g=segs[nx]; cur=key(g[0])===key(cur)?g[1]:g[0]; pts.push(cur); }
    let ar=0; for(let q=1;q<pts.length;q++) ar+=pts[q-1][0]*pts[q][1]-pts[q][0]*pts[q-1][1];
    if(pts.length>4&&Math.abs(ar)>4) loops.push(pts); }   /* крошки площадью < 2 мм² — шум сетки, не контур */
  return {loops,holes:keep.map(E=>E.map(e=>e.q)),all:loops.concat(keep.map(E=>E.map(e=>e.q)))}; }
/* сетка детали и рёбра — заранее, отдельными кусками (просмотрщик потом берёт готовое из кэша модели) */
function prep(m,k){ if(k!=='lines'){ if(!m._mesh) Object.defineProperty(m,'_mesh',{value:CSG.mesh(m.tree),configurable:true}); } else { try{ featLines(m); }catch(e){} } }
return {CSG,featLines,silLines,P,J,jc,viewer,section,secShape,drawing,features,partial,paths,prep,conv,edges3};
})();

/* ═════════ IG_VARS: 30 вариантов задачи 2 «Построение изображений» ═════════
   Каждая деталь — дерево IG3.P (мм; z вверх; спереди смотрим вдоль +y; сзади — y > 0).
   tri(r) — правильный треугольник, вписанный в окружность Ø2r, вершиной назад (как на виде сверху: вершиной вверх).
   hexX(d) — шестиугольник, описанный около Ø d, вершинами влево-вправо (вдоль x).
   sq45(d) — квадрат, вписанный в Ø d, повёрнутый на 45° (вершинами по осям). sq(a) — квадрат a×a по осям. */
window.IG_VARS=(function(){
const {P}=IG3, E=0.6;
const cyl=P.cyl, cone=P.cone, box=P.box, U=P.U, S=P.S, I=P.I;
/* конус, продлённый на E за торцы (для вычитания — чтобы не было «плёнок» на торцах) */
const coneX=(d0,d1,z0,z1,o)=>{ const k=(d1-d0)/2/(z1-z0); return cone(d0/2-k*E,d1/2+k*E,z0-E,z1+E,o); };
const cylX=(d,z0,z1,o)=>cyl(d/2,z0-E,z1+E,o);
/* отверстие, у которого наружу выходит только один торец: другой — уступ внутри детали, его высота точная */
const cylT=(d,z0,z1)=>cyl(d/2,z0,z1+E), cylB=(d,z0,z1)=>cyl(d/2,z0-E,z1);
const coneB=(d0,d1,z0,z1)=>{ const k=(d1-d0)/2/(z1-z0); return cone(d0/2-k*E,d1/2,z0-E,z1); };
const tri=(D,z0,z1)=>P.ngon(3,D/2,z0,z1,{a:90});                 /* апофема = R/2 → s = R */
const triP=(D0,D1,z0,z1)=>{ const k=(D1-D0)/2/(z1-z0); return P.npyr(3,(D0-2*k*E)/2,(D1+2*k*E)/2,z0-E,z1+E,{a:90}); };
const hexX=(D,z0,z1)=>P.ngon(6,D*Math.cos(Math.PI/6),z0,z1,{a:0});
const hexP=(D0,D1,z0,z1,ext)=>{ const e=ext===false?0:E, k=(D1-D0)/(z1-z0); const c=Math.cos(Math.PI/6); return P.npyr(6,(D0-k*e)*c,(D1+k*e)*c,z0-e,z1+e,{a:0}); };
const sq45=(D,z0,z1)=>box(D/Math.SQRT2,D/Math.SQRT2,z0,z1,{a:45});
const sq45P=(D0,D1,z0,z1)=>{ const k=(D1-D0)/(z1-z0); return P.npyr(4,(D0-k*E)/Math.SQRT2,(D1+k*E)/Math.SQRT2,z0-E,z1+E,{a:0}); };
const sqP=(a0,a1,z0,z1)=>{ const k=(a1-a0)/(z1-z0); return P.npyr(4,a0-k*E,a1+k*E,z0-E,z1+E,{a:45}); };
const holes=(n,d,D,z0,z1,a0,step)=>P.holes(n,d,D,z0-E,z1+E,a0,step);
const H4=(d,D,z0,z1)=>holes(4,d,D,z0,z1,45);
/* глухие отверстия: цилиндр точно от дна zb до верха и конус от сверла 118° (глубина 0,6·r) вершиной вниз */
const blind=(n,d,D,zb,z1,a0,step)=>[...P.holes(n,d,D,zb,z1+E,a0,step),...Array.from({length:n},(_,i)=>{ const a=((a0||0)+(step||360/n)*i)*Math.PI/180, r=d/2; return cone(0.05,r,zb-0.6*r,zb+0.01,{x:D/2*Math.cos(a),y:D/2*Math.sin(a)}); })];
const flange=(D,h)=>cyl(D/2,0,h);
const V={};
/* 1 */ V[1]={tree:S(U(flange(110,20),P.ngon(3,55,20,120,{a:30})), box(120,60,70,121,{y:-30}), coneX(20,45,0,120),
          ...holes(2,10,90,0,20,60,60), ...holes(2,10,90,0,20,210,120)), box:[[-55,-55,0],[55,55,120]]};
/* 2 */ V[2]={tree:S(U(I(flange(120,20),box(130,80,-1,21)),cone(35,20,20,120)), cylT(30,70,120), sq45(30,-E,70.01), ...holes(2,10,90,0,20,-30,60), ...holes(2,10,90,0,20,150,60)), box:[[-60,-40,0],[60,40,120]]};
/* 3 */ (()=>{ const yf=Math.sqrt(40*40-25*25), A=[0,0,65];
  /* пирамидальная выемка: основание 50×70 в плоскости y = ∓20, вершина в центре детали (0, 0, 65) */
  const wedge=s=>I(P.hp([.625,-s*.781,0],A),P.hp([-.625,-s*.781,0],A),P.hp([0,-s*.868,-.496],A),P.hp([0,-s*.868,.496],A),P.hp([0,s,0],[0,s*20,0]));
  V[3]={tree:S(U(flange(120,20),cyl(40,20,120)),
    box(60,40,30,100,{y:-(yf+20)}), box(60,40,30,100,{y:yf+20}),
    box(50,yf-20+E+0.01,30,100,{y:-(yf+E+19.99)/2}), box(50,yf-20+E+0.01,30,100,{y:(yf+E+19.99)/2}),   /* перемычка — точно до основания выемки */
    wedge(-1), wedge(1), ...H4(10,100,0,20)), box:[[-60,-60,0],[60,60,120]]}; })();
/* 4 */ V[4]={tree:S(U(cyl(25,0,25),cyl(55,25,50),I(cone(55,35,50,120),box(120,60,49,121,{y:30}))), sq45(40,-E,120+E), ...holes(2,20,80,25,50,225,90)), box:[[-55,-55,0],[55,55,120]]};
/* 5 */ V[5]={tree:S(U(flange(110,25),cone(40,30,25,120)), triP(25,50,0,120), ...H4(10,95,0,25)), box:[[-55,-55,0],[55,55,120]]};
/* 6 */ V[6]={tree:S(U(flange(110,25),cone(35,25,25,120)), P.ngon(6,40*Math.cos(Math.PI/6),-E,120+E,{a:0}), ...H4(10,90,0,25)), box:[[-55,-55,0],[55,55,120]]};
/* 7 */ V[7]={tree:S(U(flange(120,20),cyl(40,20,120)), tri(40,-E,80.01), triP(40,70,80,120), ...H4(12,100,0,20)), box:[[-60,-60,0],[60,60,120]]};
/* 8 */ V[8]={tree:S(U(flange(110,30),cone(55,35,30,120)), cyl(30,20,80), sq45P(35,35,80,90), sq45P(35,60,90,120), ...H4(12,40,0,20)), box:[[-55,-55,0],[55,55,120]]};   /* воронка — правильная четырёхгранная пирамида: квадрат вписан в Ø60 вверху и в Ø35 внизу (z 90); горловина — квадратная призма того же квадрата
   (на виде сверху задания окружность Ø35 — тонкая сплошная, вспомогательная: в неё вписан квадрат; цилиндр дал бы штриховую), полость Ø60; 4 отв. Ø12 — центры на Ø40 (размер задания; на главном виде задания оси отверстий — на ±14 = 20·cos 45°). Сверху их не видно: край отверстия на 14 от оси, сторона квадрата Ø35 — на 12,4 */
/* 9 */ V[9]={tree:S(U(flange(120,20),cone(40,30,20,120)), hexP(35,50,80,120), cyl(25,30,80.01), cylX(20,0,30.01), ...H4(12,100,0,20)), box:[[-60,-60,0],[60,60,120]]};
/* 10 */ V[10]={tree:S(U(flange(110,20),cone(35,30,20,120)), cylT(50,70,120), P.npyr(6,(30-20/70*E)*Math.cos(Math.PI/6),(50+20/70*0.01)*Math.cos(Math.PI/6),-E,70.01,{a:0}), ...H4(10,90,0,20)), box:[[-55,-55,0],[55,55,120]]};   /* шестигранник Ø30 внизу → Ø50 у дна расточки */
/* 11 */ V[11]={tree:S(U(hexP(120,90,0,80,false),cyl(35,80,120)), coneB(25,40,0,70), cylT(40,69.99,120), ...blind(4,10,55,100,120,45)), box:[[-60,-52,0],[60,52,120]]};
/* 12 */ V[12]={tree:S(U(cone(55,40,0,70),cyl(40,70,120)), cylX(40,60,120), hexP(70,40,0,60.01), ...blind(4,12,60,105,120,45)), box:[[-55,-55,0],[55,55,120]]};
/* 13 */ V[13]={tree:S(U(flange(110,20),cyl(35,20,30),hexP(70,110,30,120,false)), cylT(50,70,120), cylX(30,0,70.01), ...H4(10,85,0,20)), box:[[-55,-55,0],[55,55,120]]};
/* 14 */ V[14]={tree:S(U(box(120,90,0,30),cyl(30,30,100),cyl(45,100,120)), box(70,100,-1,10), coneX(30,50,0,120), ...H4(10,75,100,120)), box:[[-60,-45,0],[60,45,120]]};
/* 15 */ V[15]={tree:S(U(flange(110,20),cone(35,55,20,120)), box(20,120,-1,10), cylX(40,0,70.01), P.npyr(4,40,60,70,120+E,{a:0}), ...H4(10,90,0,20)), box:[[-55,-55,0],[55,55,120]]};
/* 16 */ (()=>{ const rt=45/2, k=(35-rt)/65, t=10*Math.sqrt(1+k*k);   /* конус z 25…90, стенка 10 по нормали; полость до z = 80 */
  V[16]={tree:S(U(flange(110,25),cone(35,rt,25,90),P.ngon(6,45*Math.cos(Math.PI/6),90,105,{a:30}),P.npyr(6,45*Math.cos(Math.PI/6),0.5,105,120,{a:30})),   /* грани слева-справа, вершины спереди-сзади (как на виде сверху задания) */
    cone(35-t+25*k,35-t-55*k,-E,80), box(18,12,79,121), ...H4(12,90,0,25)), box:[[-55,-55,0],[55,55,120]]}; })();
/* 17 */ V[17]={tree:S(U(box(110,90,0,25),cyl(30,25,100),cyl(45,100,120)), box(20,100,110,121), sq45(40,-E,120+E), ...holes(2,10,75,100,120,-30,60), ...holes(2,10,75,100,120,150,60)), box:[[-55,-45,0],[55,45,120]]};
/* 18 */ V[18]={tree:S(cyl(55,0,120), box(90,130,20,70), cylT(70,90,120), sq45(50,70-E,90+E), cylB(30,0,20.01), ...blind(4,10,90,105,120,45)), box:[[-55,-55,0],[55,55,120]]};   /* окно 90×50 — сквозное спереди назад (на виде сверху — штриховые x = ±45) */
/* 19 */ V[19]={tree:S(U(flange(110,20),cone(35,30,20,120)), cylT(50,69.99,120), cone(17.5,25,40,70), tri(35,-E,40.01), ...H4(12,90,0,20)), box:[[-55,-55,0],[55,55,120]]};
/* 20 */ V[20]={tree:S(U(flange(110,25),cone(35,0.3,25,120)), P.npyr(6,60*Math.cos(Math.PI/6)+1,0.1,-1,80,{a:0}), ...H4(12,90,0,25)), box:[[-55,-55,0],[55,55,120]]};
/* 21 */ V[21]={tree:S(U(flange(110,20),hexP(60,90,20,120,false)), cylX(25,0,60.01), coneX(25,40,60,120), ...H4(14,90,0,20)), box:[[-55,-55,0],[55,55,120]]};
/* 22 */ V[22]={tree:S(U(flange(110,20),box(65,15,20,120,{y:32.5}),
    I(U(box(65,40,100,120,{y:20}),cyl(32.5,100,120)),box(65,80,99,121,{y:0}))),
    cylX(40,0,20.01), cylX(40,100,120), P.hcyl('y',25,[0,60],20,45), ...holes(2,12,90,0,20,225,90)), box:[[-55,-55,0],[55,55,120]]};
/* 23 */ V[23]={tree:S(U(flange(110,25),cone(35,25,25,120)), box(30,30,49.9,120+E), sqP(60,30,0,50.01), ...holes(2,10,90,0,25,-30,60), ...holes(2,10,90,0,25,150,60)), box:[[-55,-55,0],[55,55,120]]};
/* 24 */ V[24]={tree:S(U(flange(110,20),cyl(35,20,60),tri(70,60,120)), cylB(20,0,50), triP(20,50,50,120), ...H4(12,90,0,20)), box:[[-55,-55,0],[55,55,120]]};
/* 25 */ V[25]={tree:S(U(flange(110,25),cone(35,20,25,120)), hexX(30,79.9,120+E), hexP(50,30,0,80), ...H4(12,90,0,25)), box:[[-55,-55,0],[55,55,120]]};
/* 26 */ V[26]={tree:S(U(flange(110,25),cone(35,25,25,120)), box(30,30,94.99,120+E), P.npyr(4,20,30,55,95,{a:45}), box(20,20,-E,55.1), ...H4(12,90,0,25)), box:[[-55,-55,0],[55,55,120]]};
/* 27 */ (()=>{ const yf=Math.sqrt(35*35-25*25), yb=Math.sqrt(35*35-15*15), dx=10, dy=yf+yb;   /* окно z 40…80: на передней поверхности ширина 50, на задней — 30 (как паз сверху) */
  V[27]={tree:S(U(flange(110,25),cyl(35,25,120)), box(30,80,95,121),
    I(box(80,120,40,80),P.hp([dy,dx,0],[25,-yf,0]),P.hp([-dy,dx,0],[-25,-yf,0])), ...H4(12,90,0,25)), box:[[-55,-55,0],[55,55,120]]}; })();
/* 28 */ V[28]={tree:S(U(flange(110,25),cyl(35,25,120)), tri(35,-E,70.01), triP(35,70,70,120), ...H4(12,90,0,25)), box:[[-55,-55,0],[55,55,120]]};
/* 29 */ V[29]={tree:S(cyl(55,0,120), box(90,130,20,70), coneX(50,70,90,120), sq45(50,70-E,90.01), cylB(30,0,20.01), ...blind(4,10,90,105,120,45)), box:[[-55,-55,0],[55,55,120]]};   /* окно — сквозное; сверху на виде — окружность Ø70 (конус) и квадрат, вписанный в Ø50 */
/* 30 */ V[30]={tree:S(U(flange(110,20),box(65,15,20,120,{y:32.5}),box(65,60,100,120,{y:10})),
    cyl(20,99,121), box(40,30,99,121,{y:-15}), P.hcyl('y',25,[0,60],20,45), ...holes(2,12,90,0,20,225,90)), box:[[-55,-55,0],[55,55,120]]};
/* наклонная секущая плоскость A–A по заданию: след на главном виде — внутренние концы штрихов [x, z], мм.
   Смотрим по стрелкам — перпендикулярно следу, сверху-слева; сечение строится в натуральную величину.
   След снят со скана задания: прямая через оба штриха разомкнутой линии. Если она проходит через характерную точку детали
   (угол контура, образующая отверстия на грани фланца — касание), след проведён точно через эту точку.
   Вариант 11 нарисован в задании не в масштабе по высоте: след — через вершину основания (−60; 0) и угол отверстия (20; 70). */
const SEC={1:[[-65.317,-26.893],[76.622,94.883]],2:[[-75.754,-13.876],[87.848,87.675]],3:[[-71.883,-13.623],[97.757,104.563]],4:[[-93.889,4.469],[87.559,100.263]],5:[[-65.372,-23.28],[83.898,106.459]],
  6:[[-74.228,-15.735],[52.754,88.18]],7:[[-72.13,-19.883],[86.822,105.245]],8:[[-46.646,-19.558],[88.729,113.418]],9:[[-75.113,-17.723],[94.039,88.123]],10:[[-69.541,-21.542],[73.469,100.821]],
  11:[[-67.575,-6.628],[47.17,93.774]],12:[[-91.692,3.282],[60.767,99.343]],13:[[-64.796,-19.229],[90.284,102.897]],14:[[-44.14,63.108],[51.943,124.431]],15:[[-60.424,-15.886],[58.667,111.294]],
  16:[[-70.813,-17.184],[38.578,101.694]],17:[[-48.679,55.084],[53.647,125.992]],18:[[-68.995,62.332],[52.651,124.554]],19:[[-63.32,-26.971],[39.93,82.232]],20:[[-67.511,-23.564],[30.119,79.161]],
  21:[[-61.329,-16.797],[56.784,102.249]],22:[[-68.851,-19.524],[90.949,81.019]],23:[[-72.66,-14.776],[42.466,81.552]],24:[[-67.251,-19.116],[71.889,88.543]],25:[[-62.468,-22.94],[34.936,82.422]],
  26:[[-68.137,-19.894],[37.624,81.478]],27:[[-67.569,-14.829],[42.489,58.254]],28:[[-67.329,-17.519],[58.225,97.437]],29:[[-71.658,56.671],[58.708,121.854]],30:[[-71.346,-19.093],[44.427,58.758]]};
for(const n in SEC) V[n].sec={L:'А',p:SEC[n]};
/* вариант 3: наклонное сечение — А–А, как в задании; горизонтальный разрез через окно (на месте вида сверху) — следующая буква, Б–Б */
V[3].hz={L:'Б',z:65};
return V;
})();

/* IG_DIMS:begin */
/* ═════════ размеры ДЗ 2 по вариантам: числа — из задания, расположение — как на образце ═════════
   Наружные высоты — слева от главного вида; общая высота — слева от вида слева; внутренние глубины — справа от вида слева
   (со стороны разреза); диаметры тел вращения — на главном виде; окружность центров отверстий, углы, многогранники — на виде сверху.
   Координаты в мм: 'F' — (x, z), 'L' — (y, z), 'T' — (x, y). Формат — в IGS.dimsSVG. */
window.IG_DIMS=(function(){
const at=(R,a)=>[R*Math.cos(a*Math.PI/180),R*Math.sin(a*Math.PI/180)];
/* выноска к отверстию: n отверстий Ø d на окружности Ø Dc, отверстие под углом a, выноска в направлении dir */
const hl=(n,d,Dc,a,dir,ext)=>{ const c=at(Dc/2,a), u=at(1,dir), e=ext||16; return ['T','lead',[c[0]+u[0]*d/2,c[1]+u[1]*d/2],[c[0]+u[0]*(d/2+e),c[1]+u[1]*(d/2+e)],(n>1?n+' отв. ':'')+'Ø'+d,u[0]>=0?1:-1]; };
/* диаметр окружности на виде сверху: стрелка на окружности под углом ag, полка за противоположной стороной */
const dia=(Dm,ag,ext,axis)=>['T','dia',[0,0],Dm,ag,ext||10,'Ø'+Dm,Math.cos(ag*Math.PI/180)>0?-1:1,axis?{axis:1}:{}];
const ang=(r,a0,a1,tx,e0,e1)=>['T','ang',[0,0],r,a0,a1,tx,{e:[e0,e1]}];
const D={};
D[1]={d:[['F','v',[-55,0],[-55,20],-65,'20'],['F','v',[-31.75,70],[-47.63,120],-65,'50'],['F','h',[-55,0],[55,0],-12,'Ø110'],
  ['L','v',[55,0],[27.5,120],67,'120'],['L','h',[-10,0],[10,0],-12,'Ø20'],
  dia(90,-20,16,1),dia(45,160,44),hl(4,10,90,210,200),ang(64,60,120,'60°',45,45),ang(64,210,330,'120°',45,45)]};
D[2]={d:[['F','v',[-60,0],[-60,20],-70,'20'],['F','h',[-35,20],[35,20],-12,'Ø70'],['F','h',[-60,0],[60,0],-24,'Ø120'],['F','h',[-20,120],[20,120],142,'Ø40'],['F','h1',[15,120],130,'Ø30'],
  ['L','v',[40,0],[20,120],52,'120'],['L','v',[-15,70],[-15,120],-52,'50'],
  dia(90,-15,20,1),hl(4,10,90,210,200),ang(70,-30,30,'60°',45,60),['T','v',[44.72,-40],[44.72,40],98,'80']]};
D[3]={d:[['F','v',[-60,0],[-60,20],-70,'20'],['F','h',[-60,0],[60,0],-12,'Ø120'],['F','h',[-40,120],[40,120],142,'Ø80'],['F','h1',[-25,100],130,'50'],   /* выемка видна на половине вида (слева) — размеры к ней, а не через разрез */
  ['F','v',[-25,100],[-40,120],-52,'20'],['F','v',[-25,30],[-25,100],-52,'70'],
  ['L','v',[60,0],[40,120],72,'120'],
  dia(100,20,24,1),hl(4,10,100,45,20),['T','v1',[25,-20],72,'40'],ang(68,225,315,'90°',50,50)]};   /* на половине вида (сзади) невидимый контур не проводят — размер до оси, одной стрелкой */
D[4]={d:[['F','v',[-25,0],[-25,25],-65,'25'],['F','v',[-55,25],[-55,50],-65,'25'],['F','h',[-25,0],[25,0],-12,'Ø50'],['F','h',[-55,25],[55,25],-24,'Ø110'],
  ['L','v',[25,0],[35,120],67,'120'],
  dia(40,-30,45,1),['T','rad',[0,0],35,45,24,'R35',1],dia(80,20,30,1),hl(2,20,80,315,-20),ang(64,225,315,'90°',40,40)]};
D[5]={d:[['F','v',[-55,0],[-55,25],-65,'25'],['F','h',[-55,0],[55,0],-12,'Ø110'],['F','h',[-40,25],[40,25],37,'Ø80',{tx:-24}],['F','h',[-30,120],[30,120],132,'Ø60'],
  ['L','v',[55,0],[30,120],67,'120'],
  dia(25,240,48,1),dia(50,140,36,1),dia(95,25,14,1),hl(4,10,95,135,160),ang(62,-90,-45,'45°',55,47.5)]};
D[6]={d:[['F','v',[-55,0],[-55,25],-65,'25'],['F','h',[-55,0],[55,0],-12,'Ø110'],['F','h',[-35,25],[35,25],37,'Ø70',{tx:-18}],['F','h',[-25,120],[25,120],132,'Ø50'],
  ['L','v',[55,0],[25,120],67,'120'],
  hl(4,10,90,45,30),dia(40,60,45,1),dia(90,150,20,1),ang(64,135,225,'90°',45,45)]};
D[7]={d:[['F','v',[-60,0],[-60,20],-70,'20'],['F','h',[-60,0],[60,0],-12,'Ø120'],['F','h',[-40,120],[40,120],132,'Ø80'],
  ['L','v',[60,0],[40,120],72,'120'],['L','v',[-10,80],[-17.5,120],-72,'40'],
  dia(100,230,18,1),dia(40,-20,48,1),dia(70,200,32,1),hl(4,12,100,315,-20),ang(68,225,270,'45°',50,60)]};
D[8]={d:[['F','v',[-55,0],[-55,30],-65,'30'],['F','h',[14,0],[26,0],-12,'4 отв. Ø12',{tl:1}],['F','h',[-55,0],[55,0],-24,'Ø110'],['F','h',[-35,120],[35,120],132,'Ø70'],
  ['L','v',[55,0],[35,120],67,'120'],['L','v',[-17.5,90],[-30,120],-67,'30'],['L','v',[-30,20],[-30,80],-67,'60'],['L','v',[-30,0],[-30,20],-67,'20'],['L','h1',[-30,50],50,'Ø60'],
  dia(35,200,50,1),dia(40,-15,48,1),ang(64,-45,0,'45°',20,55)]};
D[9]={d:[['F','v',[-60,0],[-60,20],-70,'20'],['F','h1',[10,0],-12,'Ø20',{tx:18}],['F','h',[-60,0],[60,0],-24,'Ø120'],['F','h',[-30,120],[30,120],134,'Ø60'],['F','h1',[25,55],55,'Ø50'],
  ['L','v',[60,0],[30,120],72,'120'],['L','v',[-25,30],[-25,80],-72,'50'],['L','v',[-60,0],[-25,30],-72,'30'],
  dia(80,-20,30),dia(100,15,14,1),dia(35,25,52,1),hl(4,12,100,45,30),ang(68,-45,0,'45°',50,60)]};
D[10]={d:[['F','v',[-55,0],[-55,20],-65,'20'],['F','h',[-35,20],[35,20],-12,'Ø70'],['F','h',[-55,0],[55,0],-24,'Ø110'],['F','h',[-30,120],[30,120],140,'Ø60'],['F','h1',[25,120],130,'Ø50'],
  ['L','v',[55,0],[30,120],67,'120'],['L','v',[-25,70],[-25,120],-67,'50'],
  dia(90,205,20,1),hl(4,10,90,225,210),dia(30,155,50,1),ang(64,135,180,'45°',45,55)]};
D[11]={d:[['F','h',[-35,120],[35,120],132,'Ø70'],['F','v',[-45,80],[-35,120],-72,'40'],['F','v',[32.5,100],[32.5,120],50,'20'],['F','h1',[12.5,0],-12,'Ø25'],
  ['L','v',[51.96,0],[35,120],64,'120'],['L','v',[-20,70],[-20,120],-64,'50'],
  dia(40,160,48),dia(55,-15,40,1),dia(90,-120,26),dia(120,-60,12),hl(4,10,55,225,200,46),ang(72,-90,-45,'45°',52,27.5)]};
D[12]={d:[['F','h',[-55,0],[55,0],-12,'Ø110'],['F','h',[-40,120],[40,120],140,'Ø80'],['F','h1',[20,120],130,'Ø40'],['F','v',[-40,70],[-40,120],-65,'50'],['F','v',[36,105],[36,120],50,'15'],
  ['L','v',[55,0],[40,120],67,'120'],['L','v',[-30.31,0],[-17.32,60],-67,'60'],
  dia(70,-15,32,1),dia(60,20,40,1),hl(4,12,60,45,20,40),ang(64,-45,0,'45°',30,55)]};
D[13]={d:[['F','v',[-55,0],[-55,20],-65,'20'],['F','v',[-35,20],[-35,30],-65,'10'],['F','h1',[15,0],-12,'Ø30'],['F','h',[-35,20],[35,20],-24,'Ø70'],['F','h',[37.5,0],[47.5,0],-36,'4 отв. Ø10'],['F','h1',[25,120],130,'Ø50'],
  ['L','v',[55,0],[47.63,120],67,'120'],['L','v',[-25,70],[-25,120],-67,'50'],
  dia(85,30,24,1),dia(110,120,12),ang(68,135,180,'45°',42.5,55)]};
D[14]={d:[['F','v',[-60,0],[-60,30],-70,'30'],['F','v',[-35,0],[-35,10],-82,'10'],['F','h',[-35,10],[35,10],-12,'70'],['F','h',[-15,0],[15,0],-26,'Ø30',{free:1}],['F','line',[-15,0],[-15.83,10]],['F','line',[15,0],[15.83,10]],
  ['F','v',[-45,100],[-45,120],-70,'20'],['F','h',[-30,30],[30,30],62,'Ø60',{tx:-17}],['F','h',[-45,120],[45,120],142,'Ø90'],['F','h1',[25,120],130,'Ø50'],
  ['L','v',[45,0],[45,120],57,'120'],
  ang(72,135,180,'45°',37.5,60),dia(75,20,30,1),hl(4,10,75,45,60,30),['T','h',[-60,-45],[60,-45],-58,'120'],['T','v',[60,-45],[60,45],72,'90']]};
D[15]={d:[['F','v',[-55,0],[-55,20],-65,'20'],['F','v',[10,0],[10,10],65,'10'],['F','h',[-10,10],[10,10],-12,'20'],['F','h',[40,0],[50,0],-24,'4 отв. Ø10'],['F','h',[-35,20],[35,20],27,'Ø70',{tx:-20}],['F','h',[-55,120],[55,120],132,'Ø110'],['F','h1',[20,35],35,'Ø40'],
  ['L','v',[54.08,0],[55,120],67,'120'],['L','v',[-28.28,70],[-42.43,120],-67,'50'],
  dia(90,205,20,1),['T','lin',[-42.43,0],[0,-42.43],16,'□60'],['T','lin',[0,-28.28],[28.28,0],40,'□40'],ang(66,135,180,'45°',45,55)]};
D[16]={d:[['F','v',[-55,0],[-55,25],-65,'25'],['F','h',[-55,0],[55,0],-12,'Ø110'],['F','h',[-35,25],[35,25],37,'Ø70',{tx:-20}],['F','h',[-22.5,90],[22.5,90],132,'Ø45'],
  ['F','v',[-19.49,105],[0,120],-45,'15',{free:1}],['F','v',[-22.5,90],[0,120],-57,'30',{free:1}],['F','lin',[18.45,58.11],[28.27,60],0,'10'],
  ['L','v',[55,0],[0,120],67,'120',{free:1}],['L','v',[-29.5,0],[-14.24,80],-67,'80'],
  hl(4,12,90,135,150),['T','v',[-9,-6],[-9,6],-68,'12'],['T','h',[-9,-6],[9,-6],-68,'18'],dia(90,70,22,1),ang(64,-45,0,'45°',45,55)]};
D[17]={d:[['F','v',[-55,0],[-55,25],-65,'25'],['F','v',[-45,100],[-45,120],-65,'20'],['F','h',[-10,120],[10,120],132,'20'],['F','h',[-45,120],[45,120],144,'Ø90'],
  ['L','v',[45,0],[43.87,120],57,'120'],['L','v',[-43.87,110],[-43.87,120],-57,'10'],   /* глубина паза — на виде слева: там дно паза — линия во всю ширину, на главном виде выносная шла бы через разрез */
  dia(75,235,30,1),hl(4,10,75,30,10,40),dia(60,20,40),dia(40,-45,60,1),['T','ang',[0,0],50,150,180,'30°',{e:[37.5,45],tr:15}],['T','h',[-55,-45],[55,-45],-58,'110'],['T','v',[55,-45],[55,45],67,'90']]};
D[18]={d:[['F','v',[45,0],[45,20],67,'20'],['F','v',[45,20],[45,70],67,'50'],['F','h',[-45,45],[45,45],45,'90',{tx:-24}],['F','h',[-55,0],[55,0],-12,'Ø110'],['F','v',[50,105],[50,120],67,'15'],
  ['L','v',[55,0],[55,120],67,'120'],['L','v',[-35,90],[-35,120],-67,'30'],
  ang(68,135,180,'45°',45,55),hl(4,10,90,45,30),dia(50,15,40,1),dia(70,35,32),dia(90,160,20,1),dia(30,140,52)]};
D[19]={d:[['F','v',[-55,0],[-55,20],-65,'20'],['F','h',[-35,20],[35,20],-12,'Ø70'],['F','h',[-55,0],[55,0],-24,'Ø110'],['F','h',[-30,120],[30,120],140,'Ø60'],['F','h1',[25,120],130,'Ø50'],
  ['L','v',[55,0],[30,120],67,'120'],['L','v',[-25,70],[-25,120],-67,'50'],['L','v',[-17.5,40],[-25,120],-79,'80'],
  dia(90,-20,20,1),hl(4,12,90,45,20),dia(35,55,50,1),ang(64,-90,-45,'45°',55,45)]};
D[20]={d:[['F','v',[-55,0],[-55,25],-65,'25'],['F','h',[-55,0],[55,0],-12,'Ø110'],['F','h',[-35,25],[35,25],37,'Ø70',{tx:-18}],
  ['L','v',[55,0],[0,120],67,'120'],['L','v',[-40,0],[0,80],-67,'80'],
  dia(60,-30,40,1),dia(90,210,20,1),hl(4,12,90,225,200),ang(64,-45,0,'45°',45,55)]};
D[21]={d:[['F','v',[-55,0],[-55,20],-65,'20'],['F','h1',[12.5,0],-12,'Ø25'],['F','h',[-55,0],[55,0],-24,'Ø110'],['F','h1',[20,120],132,'Ø40'],
  ['L','v',[55,0],[38.97,120],67,'120'],['L','v',[-12.5,60],[-20,120],-67,'60'],
  hl(4,14,90,225,210),dia(90,30,14,1),dia(60,240,40,1),ang(64,-45,0,'45°',45,55)]};
D[22]={d:[['F','h',[-32.5,120],[32.5,120],132,'65'],['F','v',[-32.5,100],[-32.5,120],-65,'20'],['F','v',[-55,0],[-55,20],-65,'20'],['F','v',[-55,0],[0,60],-77,'60',{free:1}],
  ['F','h',[-55,0],[55,0],-12,'Ø110'],['F','dia',[0,60],50,-45,30,'Ø50',-1],
  ['L','v',[55,0],[40,120],67,'120'],
  dia(40,300,48),dia(90,160,14,1),hl(2,12,90,315,-20),ang(64,225,315,'90°',45,45),['T','v',[32.5,25],[32.5,40],72,'15'],['T','v',[32.5,0],[32.5,40],84,'40']]};
D[23]={d:[['F','v',[-55,0],[-55,25],-65,'25'],['F','h',[-55,0],[55,0],-12,'Ø110'],['F','h',[-35,25],[35,25],37,'Ø70',{tx:-24}],['F','h',[-25,120],[25,120],132,'Ø50'],['F','v',[30,0],[15,50],67,'50'],
  ['L','v',[55,0],[25,120],67,'120'],
  dia(90,210,14,1),hl(4,10,90,330,-60,30),ang(64,150,210,'60°',45,45),['T','v',[15,-15],[15,15],80,'□30'],['T','v',[30,-30],[30,30],92,'□60']]};
D[24]={d:[['F','v',[-55,0],[-55,20],-65,'20'],['F','h',[-10,0],[10,0],-12,'Ø20'],['F','h',[-55,0],[55,0],-24,'Ø110'],['F','h',[-35,20],[35,20],37,'Ø70',{tx:-24}],['F','v',[-35,60],[-30.31,120],-65,'60'],
  ['L','v',[55,0],[35,120],67,'120'],['L','v',[-10,0],[-10,50],-67,'50'],
  hl(4,12,90,135,150),dia(90,30,14,1),dia(50,210,40),ang(64,-90,-45,'45°',55,45)]};
D[25]={d:[['F','v',[-55,0],[-55,25],-65,'25'],['F','h',[-55,0],[55,0],-12,'Ø110'],['F','h',[-35,25],[35,25],37,'Ø70',{tx:-24}],['F','h',[-20,120],[20,120],132,'Ø40'],
  ['L','v',[55,0],[20,120],67,'120'],['L','v',[-12.99,80],[-12.99,120],-67,'40'],
  hl(4,12,90,135,150),dia(90,210,14,1),dia(30,60,54),dia(50,240,36,1),ang(64,-45,0,'45°',45,55)]};
D[26]={d:[['F','v',[-55,0],[-55,25],-65,'25'],['F','h',[-55,0],[55,0],-12,'Ø110'],['F','h',[-35,25],[35,25],37,'Ø70',{tx:-24}],['F','h',[-25,120],[25,120],132,'Ø50'],
  ['L','v',[55,0],[25,120],67,'120'],['L','v',[-15,95],[-15,120],-67,'25'],['L','v',[-10,55],[-15,120],-79,'65'],
  hl(4,12,90,45,30),dia(90,210,14,1),['T','v',[-10,-10],[-10,10],-70,'□20'],['T','v',[15,-15],[15,15],72,'□30'],ang(64,-90,-45,'45°',55,45)]};
D[27]={d:[['F','h',[-35,120],[35,120],132,'Ø70'],['F','h',[-15,95],[15,95],107,'30',{tx:-8}],['F','v',[-15,95],[-35,120],-47,'25'],['F','v',[-55,0],[-25,40],-65,'40'],['F','v',[-25,40],[-25,80],-65,'40'],
  ['F','v',[55,0],[55,25],67,'25'],['F','h',[-55,0],[55,0],-12,'Ø110'],
  ['L','v',[55,0],[31.62,120],67,'120'],
  dia(90,210,14,1),hl(4,12,90,135,150),['T','ang',[0,0],75,-90,-45,'45°',{e:[55,45]}],['T','h',[-25,-24.49],[25,-24.49],-86,'50']]};
D[28]={d:[['F','v',[-55,0],[-55,25],-65,'25'],['F','h',[-55,0],[55,0],-12,'Ø110'],['F','h',[-35,120],[35,120],132,'Ø70'],
  ['L','v',[55,0],[35,120],67,'120'],['L','v',[-8.75,0],[-8.75,70],-67,'70'],
  dia(35,210,44,1),dia(90,150,22,1),hl(4,12,90,135,150),ang(64,-90,-45,'45°',55,45)]};
D[29]={d:[['F','h',[-55,120],[55,120],132,'Ø110'],['F','v',[50,105],[50,120],67,'15'],['F','v',[45,0],[45,20],67,'20'],['F','v',[45,20],[45,70],67,'50'],['F','h',[-45,45],[45,45],45,'90',{tx:-24}],
  ['L','v',[55,0],[55,120],67,'120'],['L','v',[-25,90],[-35,120],-67,'30'],   /* глубина конической расточки — по разрезу на виде слева */
  ang(68,135,180,'45°',45,55),hl(4,10,90,45,30),dia(50,15,40,1),dia(70,35,32),dia(90,160,20,1),dia(30,140,52)]};
D[30]={d:[['F','h',[-32.5,120],[32.5,120],132,'65'],['F','v',[-32.5,100],[-32.5,120],-65,'20'],['F','v',[-55,0],[-55,20],-65,'20'],['F','v',[-55,0],[0,60],-77,'60',{free:1}],
  ['F','h',[-55,0],[55,0],-12,'Ø110'],['F','dia',[0,60],50,-45,30,'Ø50',-1],
  ['L','v',[55,0],[40,120],67,'120'],
  dia(40,30,40),dia(90,160,14,1),hl(2,12,90,315,-20),ang(64,225,315,'90°',45,45),['T','v',[32.5,25],[32.5,40],72,'15'],['T','v',[32.5,0],[32.5,40],84,'40']]};
return D;
})();
/* IG_DIMS:end */

/* ═════════ IG_WB: рабочая тетрадь, раздел 5 — геометрические тела со сквозными отверстиями ═════════
   Размеров в тетради нет (чертёж строят по данным изображениям), поэтому пропорции взяты с рисунков тетради.
   Единицы условные (≈ мм рисунка); z вверх, вид спереди — вдоль +y. */
window.IG_WB=(function(){
const {P}=IG3, E=0.8, S=P.S, U=P.U;
const thru=(sx,z0,z1,o)=>P.box(sx,400,z0,z1,o||{});                     /* призматическое отверстие вдоль y (на виде спереди — K) */
const L=[
 {n:1,fig:61,page:34,title:'Призма',q:'Достроить вид сверху, построить вид слева, выполнить горизонтальный и профильный разрезы призмы. K — сквозное отверстие.',
  why:'Четырёхгранная призма стоит ребром к нам. Отверстие K — призматическое, идёт насквозь вдоль взгляда. Его грани пересекают боковые грани призмы по вертикальным и горизонтальным отрезкам.',
  tree:S(P.box(84.85,84.85,0,128,{a:45}), thru(60,29,107)), box:[[-60,-60,0],[60,60,128]]},
 {n:2,fig:62,page:35,title:'Цилиндр',q:'Достроить вид сверху, построить вид слева, выполнить горизонтальный и профильный разрезы цилиндра. K — сквозное отверстие.',
  why:'Горизонтальные грани отверстия режут цилиндр по дугам окружностей, вертикальные — по образующим. На виде сверху отверстие видно как две вертикальные линии внутри окружности.',
  tree:S(P.cyl(65,0,140), thru(65,42,118)), box:[[-65,-65,0],[65,65,140]]},
 {n:3,fig:63,page:36,title:'Пирамида',q:'Достроить вид сверху, построить вид слева, выполнить горизонтальный и профильный разрезы пирамиды. K — сквозное отверстие.',
  why:'Треугольная пирамида. Горизонтальные грани отверстия дают в сечении треугольники, подобные основанию; вертикальные режут грани по прямым. Точки находят на рёбрах и по вспомогательным горизонталям.',
  tree:S(P.npyr(3,80,0.8,0,155,{a:30}), thru(41,27,88)), box:[[-69.3,-80,0],[69.3,40,155]]},   /* основание — сторона 138,6 (R 80), вершина основания к нам, задняя грань ∥ фронтальной плоскости; K по оси */
 {n:4,fig:64,page:37,title:'Конус',q:'Достроить вид сверху, построить вид слева, выполнить горизонтальный и профильный разрезы конуса. K — сквозное отверстие.',
  why:'Боковые стороны отверстия лежат на образующих: их продолжения проходят через вершину конуса (тонкие линии на рисунке тетради). Значит, боковые грани отверстия — плоскости через вершину, и режут конус по образующим — прямым; на виде сверху это отрезки радиусов окружности основания. Горизонтальные грани режут конус по окружностям-параллелям: радиус параллели снимают на виде спереди. На виде сверху дана только окружность основания — всё отверстие строится по виду спереди.',
  /* боковые грани — плоскости через вершину (0; 0; 134) и точки основания x = ±32,5 (продолжения сторон трапеции до основания) */
  tree:S(P.cone(60,0.3,0,134), P.I(P.box(80,400,22,67),P.hp([1,0,32.5/134],[32.5,0,0]),P.hp([-1,0,32.5/134],[-32.5,0,0]))), box:[[-60,-60,0],[60,60,134]]},
 {n:5,fig:65,page:38,title:'Шар',q:'Достроить вид спереди и вид сверху, построить вид слева, выполнить фронтальный, горизонтальный и профильный разрезы шара. K — сквозные отверстия.',
  why:'Любая плоскость режет шар по окружности. Горизонтальные грани призматического отверстия — по окружностям, видимым на виде сверху; вертикальные — по окружностям, видимым на виде слева. Вертикальное цилиндрическое отверстие соосно шару.',
  tree:null, box:[[-71,-71,-71],[71,71,71]]},
 {n:6,fig:66,page:39,title:'Цилиндр с окном',q:'Построить вид слева, выполнить горизонтальный, фронтальный и профильный разрезы (материал детали — сталь).',
  why:'Сквозное прямоугольное окно, над ним — вертикальное цилиндрическое отверстие, под ним — шестигранное. Разрез A–A проходит через окно: на нём видна шестигранная полость и круглое отверстие.',
  tree:S(P.cyl(58,0,136), thru(76,48,120), P.cyl(11,119,137), P.ngon(6,36,-1,49,{a:-30})), box:[[-58,-58,0],[58,58,136]]},
 {n:7,fig:67,page:40,title:'Шар с призмой',q:'Достроить вид сверху, построить вид слева, выполнить разрезы. K — сквозное отверстие.',
  why:'Шар срезан горизонтальной плоскостью, на срезе стоит четырёхгранная призма, повёрнутая ребром к нам: её вертикальные рёбра лежат на окружности среза. Отверстие K — пятиугольное, сквозное. Вертикальные грани отверстия режут шар по окружностям (на виде слева — дуги), нижняя грань — по окружности, видимой сверху, наклонные грани «крыши» режут призму по прямым.',
  tree:S(U(P.I({t:'sph',r:60},P.hp([0,0,1],[0,0,36.5])), P.box(67.3,67.3,30,82,{a:45})),
    P.I(thru(42,-25.6,65), P.hp([-27.9,0,21],[-21,0,36.5]), P.hp([27.9,0,21],[21,0,36.5]))), box:[[-60,-60,-60],[60,60,82]]},
 {n:8,fig:68,page:41,title:'Пятигранная призма',q:'Достроить вид сверху, построить вид слева, выполнить фронтальный, горизонтальный и профильный разрезы. K — сквозное отверстие.',
  why:'Правильная пятигранная призма стоит ребром к нам, по её оси — сквозное цилиндрическое отверстие. Штриховые линии на виде спереди — задние рёбра призмы и образующие отверстия. Прямоугольное отверстие K идёт насквозь: его грани режут призму по прямым, а цилиндрическое отверстие — по образующим (вертикальные грани) и дугам окружностей (горизонтальные).',
  tree:S(P.ngon(5,97.08,0,134,{a:-90}), P.cyl(39.5,-1,135), thru(42.6,41.7,101.4)), box:[[-57.1,-60,0],[57.1,48.6,134]]},
 {n:9,fig:69,page:42,title:'Полый шар',q:'Построить вид сверху и вид слева, выполнить фронтальный, горизонтальный и профильный разрезы. K — сквозное отверстие.',
  why:'Шар с внутренней сферической полостью (штриховая окружность — её контур, он невидим). Призматическое отверстие K проходит насквозь через обе стенки; цилиндрическое отверстие Ø32 идёт вдоль оси x из полости наружу. Любая плоскость режет обе сферы по окружностям: на горизонтальном и профильном разрезах сечение — кольцо между двумя концентрическими окружностями (Ø120 и Ø85), а грани K и цилиндр отверстия вырезают из него прямые и дуги.',
  tree:S({t:'sph',r:60}, {t:'sph',r:42.5}, P.box(24,400,-16.6,22.7,{x:-12}), P.hcyl('x',16,[0,0],0,70)), box:[[-60,-60,-60],[60,60,60]]},
 {n:10,fig:70,page:43,title:'Конус с призмой',q:'Достроить вид сверху, построить вид слева, выполнить разрезы. K — сквозное отверстие.',
  why:'Усечённый конус, на его верхнем срезе — четырёхгранная призма, повёрнутая ребром к нам (рёбра лежат на окружности среза). Нижние боковые грани отверстия K проходят через вершину конуса и поэтому режут его по прямым — образующим (тонкие линии на рисунке тетради). Нижняя грань режет конус по окружности, вертикальные грани верхней части — призму по прямым.',
  tree:S(U(P.I(P.cone(60,0.3,0,127.6),P.hp([0,0,1],[0,0,49.4])), P.box(52,52,45,129.4,{a:45})),
    thru(42,49,118.3), P.I(thru(80,21.4,49.6), P.hp([1,0,0.2685],[21,0,49.4]), P.hp([-1,0,0.2685],[-21,0,49.4]))), box:[[-60,-60,0],[60,60,129.4]]},
 {n:11,fig:71,page:44,title:'Шаровой слой с призмой',q:'Достроить вид сверху, построить вид слева, выполнить разрезы. K — сквозное отверстие.',
  why:'Низ — шаровой слой: шар Ø120 срезан по центру (основание) и горизонтальной плоскостью на высоте 44; на срезе стоит четырёхгранная призма, повёрнутая ребром к нам, — её вертикальные рёбра лежат на окружности среза. Снизу — глухое цилиндрическое отверстие Ø48 (штриховые на главном виде и штриховая окружность на виде сверху). Прямоугольное отверстие K идёт насквозь спереди назад и внизу выходит в цилиндрическое. Вертикальные грани K режут шар по дугам окружностей (на виде слева — дуги), а призму — по прямым; нижняя грань K — плоскость, она режет шар по окружности, видимой сверху.',
  /* размеры сняты с рисунка тетради (на нём размеров нет): шар R60 с центром в основании, срез на z 44 (окружность среза R40,8 — по ней вершины квадрата
     призмы, сторона 57,7), верх призмы 134; отверстие Ø48 глубиной 30; K — ширина 32 по оси, z 14…96 */
  tree:S(U(P.I({t:'sph',r:60},P.hp([0,0,1],[0,0,44]),P.hp([0,0,-1],[0,0,0])), P.box(57.7,57.7,30,134,{a:45})), P.cyl(24,-1,30), thru(32,14,96)), box:[[-60,-60,0],[60,60,134]]}
];
/* шар: точная функция расстояния в обоих движках через узел 'sph' */
L[4].tree=S({t:'sph',r:71}, thru(65,-20,30.5), P.cyl(23.5,-80,80));
/* что строим по заданию: F — главный вид ('view' — без разреза, 'half' — с фронтальным разрезом), hz — горизонтальный разрез (уровень — середина отверстия K).
   givenTop — что дано на виде сверху («достроить» — только наружный контур тела); noTop — вид сверху не дан */
const HZ={1:68,2:80,3:57.5,4:44.5,5:5,6:84,7:20,8:71.5,9:3,10:35,11:70}, FV={1:'view',2:'view',3:'view',4:'view'};
L.forEach(t=>{ t.hz={L:'А',z:HZ[t.n]}; t.spec={F:FV[t.n]||'half',L:'half'}; if(/^Достроить вид сверху|^Достроить вид спереди и вид сверху/.test(t.q)) t.givenTop=t.tree.a; if(/^Построить вид сверху/.test(t.q)) t.noTop=true; });
L[4].givenTop=S({t:'sph',r:71}, P.cyl(23.5,-80,80));   /* 5: на виде сверху дано и вертикальное отверстие — две окружности, как в тетради */
L[10].givenTop=S(L[10].tree.a, P.cyl(24,-1,30));   /* 11: на виде сверху дано и цилиндрическое отверстие снизу (штриховая окружность) */
return L;
})();

/* плашка раздела ИГ: что гарантирует проверка листов (нормоконтроль по ГОСТ и сверка с моделью) */
window.IGBETA=()=>`<div class="igx-beta" role="note"><i>ГОСТ</i><span><b>Каждый лист проходит нормоконтроль.</b> При каждом обновлении сайта листы проверяются по ГОСТ 2.301–2.307 и 2.104, а каждый вид сверяется с 3D-моделью детали. Раздел растёт каждый день; нашёл расхождение с заданием — напиши, оно будет разобрано.</span></div>`;
window.IGUI=(function(){
const N=30, $=(r,s)=>r.querySelector(s);
const hasGL=(()=>{ try{ const c=document.createElement('canvas'); return !!(c.getContext('webgl')); }catch(e){ return false; } })();
/* ── просмотрщик с жестами ── */
function mountViewer(host,n,opt){
  opt=opt||{}; const cv=document.createElement('canvas'); cv.className='ig3-cv'; cv.setAttribute('role','img'); cv.setAttribute('aria-label','Деталь в 3D');
  host.appendChild(cv); const v=IG3.viewer(cv); if(!v) return null; const MD=typeof n==='object'?n:IG_VARS[n]; v.compile(MD);
  const S=v.S; Object.assign(S,{yaw:-0.62,pit:0.42,zoom:1},opt.state||{});
  let raf=0, lowT=0, anim=0;
  const draw=()=>{ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; v.draw(); }); };   /* сетка рисуется быстро — всегда в полном разрешении, без пересборки холста */
  const pts=new Map(); let g=null, vel=0;
  cv.style.touchAction='none'; cv.style.webkitUserSelect='none'; cv.style.userSelect='none';
  /* Telegram и Safari: пока крутишь деталь, страница не едет и не пружинит, мини-приложение не сворачивается свайпом вниз */
  const noMove=e=>{ if(e.cancelable) e.preventDefault(); };
  cv.addEventListener('touchstart',noMove,{passive:false}); cv.addEventListener('touchmove',noMove,{passive:false});
  ['gesturestart','gesturechange','gestureend'].forEach(t=>cv.addEventListener(t,noMove,{passive:false}));
  let tgOff=false;
  const tgLock=on=>{ try{ const W=window.Telegram&&Telegram.WebApp; if(!W) return;
    if(on&&!tgOff&&W.disableVerticalSwipes&&W.isVerticalSwipesEnabled!==false){ W.disableVerticalSwipes(); tgOff=true; }
    else if(!on&&tgOff){ W.enableVerticalSwipes(); tgOff=false; } }catch(_){} };
  cv.addEventListener('pointerdown',e=>{ tgLock(true); cancelAnimationFrame(anim); try{ cv.setPointerCapture(e.pointerId); }catch(_){} pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===1) g={m:'r',x:e.clientX,y:e.clientY,t:performance.now()}; else if(pts.size===2){ const a=[...pts.values()]; g={m:'p',d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}; }
    host.classList.add('busy'); opt.onTouch&&opt.onTouch(); });
  cv.addEventListener('pointermove',e=>{ if(!pts.has(e.pointerId)||!g) return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(g.m==='p'&&pts.size>=2){ const a=[...pts.values()], d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); if(g.d>10) S.zoom=Math.max(.5,Math.min(5,S.zoom*d/g.d)); g.d=d; draw(true); return; }
    if(pts.size!==1) return; const dx=e.clientX-g.x, dy=e.clientY-g.y, now=performance.now(); g.x=e.clientX; g.y=e.clientY;
    S.yaw-=dx*0.009; S.pit=Math.max(-0.2,Math.min(Math.PI/2-1e-3,S.pit+dy*0.009)); vel=0.7*vel+0.3*(-dx*0.009/Math.max(1,now-g.t)); g.t=now; draw(true); opt.onMove&&opt.onMove(); });
  const up=e=>{ if(!pts.delete(e.pointerId)) return; if(pts.size===0){ host.classList.remove('busy'); tgLock(false);
      if(g&&g.m==='r'&&performance.now()-g.t<70&&Math.abs(vel)>0.0004){ let last=performance.now(); const st=now=>{ const dt=Math.min(40,now-last); last=now; S.yaw+=vel*dt; vel*=Math.pow(.93,dt/16); v.draw(.55); if(Math.abs(vel)>0.00006) anim=requestAnimationFrame(st); else v.draw(1); }; anim=requestAnimationFrame(st); }
      g=null; } };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{ e.preventDefault(); S.zoom=Math.max(.5,Math.min(5,S.zoom*Math.exp(-e.deltaY*0.0015))); draw(true); },{passive:false});
  cv.addEventListener('dblclick',()=>to(opt.home||{yaw:-0.62,pit:0.42,zoom:1}));
  const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  const to=(T,ms)=>{ cancelAnimationFrame(anim); const A={yaw:S.yaw,pit:S.pit,zoom:S.zoom,off:S.off||0}; let dy=T.yaw-A.yaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy)); const t0=performance.now(), D=ms||1150;
    const st=now=>{ const u=Math.min(1,(now-t0)/D), e=ease(u); S.yaw=A.yaw+dy*e; S.pit=A.pit+((T.pit==null?A.pit:T.pit)-A.pit)*e; S.zoom=A.zoom+((T.zoom==null?A.zoom:T.zoom)-A.zoom)*e; if(T.off!=null) S.off=A.off+(T.off-A.off)*e;
      v.draw(u<1?.6:1); if(u<1) anim=requestAnimationFrame(st); }; anim=requestAnimationFrame(st); };
  if(window.ResizeObserver){ const ro=new ResizeObserver(()=>draw(false)); ro.observe(cv); v.ro=ro; }
  draw(false);
  return {v,S,draw,to,cv};
}
/* ── три вида из модели: одинаковый масштаб и центр — виды в проекционной связи ── */
const VIEWS=[
  {k:'front',t:'Главный вид',d:'слева — вид, справа — фронтальный разрез',st:{yaw:0,pit:1e-4,cut:1}},
  {k:'left',t:'Вид слева',d:'слева — вид, справа — профильный разрез',st:{yaw:Math.PI/2,pit:1e-4,cut:5}},
  {k:'top',t:'Вид сверху',d:'без разреза',st:{yaw:0,pit:Math.PI/2-1e-4,cut:0}}];
function sheetImages(n,size){ const VV=VIEWS.concat([{k:'iso',st:{yaw:-0.62,pit:0.42,cut:1}}]); const c=document.createElement('canvas'); c.style.cssText='position:fixed;left:-9999px;top:0;width:'+size+'px;height:'+size+'px'; document.body.appendChild(c);
  const v=IG3.viewer(c,{keep:1}); const out={}; if(!v){ c.remove(); return out; } v.compile(typeof n==='object'?n:IG_VARS[n]);
  VV.forEach(o=>{ Object.assign(v.S,o.st,{zoom:1.02,off:0,bg:[[1,1,1],[1,1,1]],hatch:2.6,flat:o.k==='iso'?0:1}); v.draw(1); out[o.k]=c.toDataURL('image/png'); });
  c.remove(); try{ v.gl.getExtension('WEBGL_lose_context').loseContext(); }catch(e){} return out; }

/* ── сечение наклонной плоскостью: контур по модели, штриховка 45°; u — вдоль следа, v — глубина y ──
   на листе фигура лежит так, как её видно по стрелкам: след идёт под тем же углом, задняя сторона (y > 0) — к главному виду */
function secFig(model,sec,K){
  const [[x1,z1],[x2,z2]]=sec.p, th=Math.atan2(z2-z1,x2-x1), c=Math.cos(th), s=Math.sin(th), L=Math.hypot(x2-x1,z2-z1), b=model.box;
  const loops=IG3.secShape(model.tree,[x1,0,z1],[c,0,s],[0,1,0],[0,L,b[0][1]-2,b[1][1]+2],0.12).all;
  const M=p=>[(p[0]*c-p[1]*s)*K,(-p[0]*s-p[1]*c)*K]; let x0=1e9,y0=1e9,x9=-1e9,y9=-1e9;
  const d=loops.map(l=>l.map((p,i)=>{ const q=M(p); x0=Math.min(x0,q[0]); x9=Math.max(x9,q[0]); y0=Math.min(y0,q[1]); y9=Math.max(y9,q[1]); return (i?'L':'M')+q[0].toFixed(1)+','+q[1].toFixed(1); }).join('')+'Z').join('');
  return {d,box:[x0,y0,x9,y9],th};
}
/* обозначение секущей плоскости (ГОСТ 2.305): разомкнутая линия — два штриха за контуром, стрелки по направлению взгляда, буквы у стрелок.
   Q1, Q2 — концы следа на листе, Km — единиц листа на 1 мм */
function secMark(Q1,Q2,Km,L,col,which){ col=col||'#111'; const f=v=>Math.round(v*10)/10, l=Math.hypot(Q2[0]-Q1[0],Q2[1]-Q1[1]), ex=(Q2[0]-Q1[0])/l, ey=(Q2[1]-Q1[1])/l, dx=-ey, dy=ex;
  const ln=(a,c,w)=>`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(c[0])}" y2="${f(c[1])}" stroke="${col}" stroke-width="${w}"/>`;
  const arr=(q,ax,ay)=>`<path d="M${f(q[0])},${f(q[1])} l${f(ax*9-ay*2.6)},${f(ay*9+ax*2.6)} l${f(ay*5.2)},${f(-ax*5.2)}Z" fill="${col}"/>`;
  const one=(Q,sx,sy)=>{ const O=[Q[0]+sx*12*Km,Q[1]+sy*12*Km], T=[O[0]-sx*3*Km,O[1]-sy*3*Km], A=[T[0]-dx*10*Km,T[1]-dy*10*Km];
    /* буква — у стрелки с внешней стороны (за концом штриха), как в задании и по ГОСТ 2.305, п. 6.4 */
    const M=[A[0]+(T[0]-A[0])*.35+sx*(4*Km+8),A[1]+(T[1]-A[1])*.35+sy*(4*Km+8)];
    return ln(Q,O,3.1)+ln(A,T,.8)+arr(T,-dx,-dy)+`<text x="${f(M[0])}" y="${f(M[1]+7)}" class="igs-let" text-anchor="middle" fill="${col}">${L}</text>`; };
  return which===1?one(Q1,-ex,-ey):which===2?one(Q2,ex,ey):one(Q1,-ex,-ey)+one(Q2,ex,ey); }   /* which — только один конец (ступенчатый след) */
/* ── лист чертежа: виды в проекционной связи, оси, габариты, сечение, основная надпись; mode 'given' — только данные изображения задания ── */
function sheetSVG(model,title,sub,task,mode){
  const given=mode==='given', W=900, hz=!given&&model.hz;
  const GT=model.givenTop, SP=igSpec(model), D=given?{front:IG3.drawing(model,'front0',W),top:IG3.drawing(GT?{tree:GT,box:model.box}:model,'top',W)}:{front:IG3.drawing(model,SP.fk,W,0,SP.xb),left:IG3.drawing(model,SP.lk,W,0,SP.yb),top:IG3.drawing(model,'top',W)}; if(!D.front) return '';
  if(hz) D.cut=IG3.drawing(model,'topcut',W,hz.z);
  const S=480, Y0=20, k=S/W, b=model.box, TOPY=Y0+S-30, C3=model.sec?360:0, hid='igH'+Math.random().toString(36).slice(2,7);
  /* обозначение плоскости слева может выйти за поле — тогда виды сдвигаются вправо */
  const X0=model.sec?(()=>{ const [[x1,z1s],[x2,z2s]]=model.sec.p, a=D.front.px([x1,0,z1s]), c=D.front.px([x2,0,z2s]), m=D.front.px([10,0,0])[0]-D.front.px([0,0,0])[0], l=Math.hypot(c[0]-a[0],c[1]-a[1]);
    const left=a[0]*k-(12*Math.abs(c[0]-a[0])/l+13*Math.abs(c[1]-a[1])/l)*m/10*k-22; return Math.max(30,30-left); })():30;
  const z0=b[0][2], z1=b[1][2], r=Math.max(b[1][0],-b[0][0]), J=IG3.J;
  /* габарит по ширине: самая широкая часть может стоять не на дне (под фланцем — цилиндр меньшего диаметра) — ищем снизу первый уровень,
     где деталь доходит до x = r; от него и идут выносные линии */
  const zw=(()=>{ for(let i=0;i<=200;i++){ const z=z0+(z1-z0)*i/200; if(J(model.tree,0.995*r,0,z)<0||J(model.tree,-0.995*r,0,z)<0) return z; } return z0; })(), zt=Math.min(zw+1,(zw+z1)/2);
  /* Ø — если у края по ширине контур — дуга окружности радиуса r (фланец с лысками тоже: размер по дугам, как в задании).
     Радиус контура меряем по нескольким направлениям у правого и у левого края (с одной стороны может быть отверстие) */
  const rad=(t,z)=>{ let a=0.85*r, c=1.3*r; if(J(model.tree,a*Math.cos(t),a*Math.sin(t),z)>=0) return 0; if(J(model.tree,c*Math.cos(t),c*Math.sin(t),z)<0) return c; for(let k=0;k<40;k++){ const m=(a+c)/2; if(J(model.tree,m*Math.cos(t),m*Math.sin(t),z)<0) a=m; else c=m; } return a; };
  const roundAt=(z,c0)=>{ const R=[0,8,16,-8,-16].map(a=>rad(c0+a*Math.PI/180,z)); return Math.min(...R)>0.95*r&&Math.max(...R)/Math.min(...R)<1.01; };
  const round=[zt,zw+(z1-zw)*0.05,zw+(z1-zw)*0.1].some(z=>roundAt(z,0)||roundAt(z,Math.PI));
  const P=(d,q,ox,oy)=>{ const v=d.px(q); return [ox+v[0]*k,oy+v[1]*k]; };
  const K=P(D.front,[10,0,0],X0,Y0)[0]-P(D.front,[0,0,0],X0,Y0)[0], Km=K/10;   /* единиц листа на 1 мм */
  const AX='14 3 2 3'; let o='';
  const f=v=>Math.round(v*10)/10, ln=(a,c,col,dash,w)=>{ if(dash===AX) dash=axDash(Math.hypot(c[0]-a[0],c[1]-a[1]),Km);   /* осевые — по ГОСТ 2.303 */
    return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(c[0])}" y2="${f(c[1])}" stroke="${col||'#111'}" stroke-width="${w||1}"${dash?` stroke-dasharray="${dash}"`:''}/>`; };
  const tc=P(D.top,[0,0,z1],X0,TOPY), e=P(D.top,[r+7,0,z1],X0,TOPY)[0]-tc[0];
  o+=`<image href="${D.front.url}" x="${X0}" y="${Y0}" width="${S}" height="${S}"/>`;
  /* горизонтальный разрез на месте вида сверху: слева от вертикальной оси — половина вида, справа — половина разреза; 'halfD' — сверху вид, снизу разрез; 'full' — полный */
  o+=hz&&D.cut&&SP.H==='full'?`<image href="${D.cut.url}" x="${X0}" y="${TOPY}" width="${S}" height="${S}"/>`
    :hz&&D.cut&&SP.H==='halfD'?`<defs><clipPath id="${hid}a"><rect x="${X0}" y="${TOPY}" width="${S}" height="${f(tc[1]-TOPY)}"/></clipPath><clipPath id="${hid}b"><rect x="${X0}" y="${f(tc[1])}" width="${S}" height="${f(TOPY+S-tc[1])}"/></clipPath></defs>`
      +`<image href="${IG3.drawing(model,'topNH',W).url}" x="${X0}" y="${TOPY}" width="${S}" height="${S}" clip-path="url(#${hid}a)"/><image href="${D.cut.url}" x="${X0}" y="${TOPY}" width="${S}" height="${S}" clip-path="url(#${hid}b)"/>`
    :hz&&D.cut?`<defs><clipPath id="${hid}a"><rect x="${X0}" y="${TOPY}" width="${f(tc[0]-X0)}" height="${S}"/></clipPath><clipPath id="${hid}b"><rect x="${f(tc[0])}" y="${TOPY}" width="${f(X0+S-tc[0])}" height="${S}"/></clipPath></defs>`
    +`<image href="${IG3.drawing(model,'topNH',W).url}" x="${X0}" y="${TOPY}" width="${S}" height="${S}" clip-path="url(#${hid}a)"/><image href="${D.cut.url}" x="${X0}" y="${TOPY}" width="${S}" height="${S}" clip-path="url(#${hid}b)"/>`
    :given&&model.noTop?'':`<image href="${D.top.url}" x="${X0}" y="${TOPY}" width="${S}" height="${S}"/>`;
  if(D.left) o+=`<image href="${D.left.url}" x="${X0+S}" y="${Y0}" width="${S}" height="${S}"/>`;
  const fa=P(D.front,[0,0,z0-7],X0,Y0), fb=P(D.front,[0,0,z1+7],X0,Y0); o+=ln(fa,fb,'#111',AX,.8);
  if(D.left){ const la=P(D.left,[0,0,z0-7],X0+S,Y0), lb=P(D.left,[0,0,z1+7],X0+S,Y0); o+=ln(la,lb,'#111',AX,.8); }
  if(!given&&SP.xb) o+=wavy(P(D.front,[SP.xb,0,z0+0.5],X0,Y0),P(D.front,[SP.xb,0,z1-0.5],X0,Y0));
  if(!given&&SP.yb&&D.left) o+=wavy(P(D.left,[0,SP.yb,z0+0.5],X0+S,Y0),P(D.left,[0,SP.yb,z1-0.5],X0+S,Y0));
  if(!(given&&model.noTop)) o+=ln([tc[0]-e,tc[1]],[tc[0]+e,tc[1]],'#111',AX,.8)+ln([tc[0],tc[1]-e],[tc[0],tc[1]+e],'#111',AX,.8);   /* вида сверху в задании нет — и его осей нет */
  /* оси отверстий (ГОСТ 2.303): на виде сверху — центровая окружность и перекрестия, на главном виде и виде слева — оси отверстий */
  if(!given){ const HL=holeAxes(model), done={c:{},x:{},y:{}}; HL.forEach(h=>{ const R=Math.hypot(h.x,h.y), q=P(D.top,[h.x,h.y,z1],X0,TOPY), a=h.r+3;
      if(!done.c[R.toFixed(1)]){ done.c[R.toFixed(1)]=1; const c0=P(D.top,[0,0,z1],X0,TOPY); o+=axCircle(c0,R*Km,HL.filter(q=>Math.abs(Math.hypot(q.x,q.y)-R)<0.05).map(q=>Math.atan2(q.y,q.x)*180/Math.PI),Km,'#111',.7); }
      const ux=h.x/R, uy=h.y/R, dd=2*h.r<12-1e-6?null:AX; o+=ln(P(D.top,[h.x-ux*a,h.y-uy*a,z1],X0,TOPY),P(D.top,[h.x+ux*a,h.y+uy*a,z1],X0,TOPY),'#111',dd,.7)+ln(P(D.top,[h.x+uy*a,h.y-ux*a,z1],X0,TOPY),P(D.top,[h.x-uy*a,h.y+ux*a,z1],X0,TOPY),'#111',dd,.7);
    });
    const FL=holeAxesFL(model); FL.F.forEach(h=>{ o+=ln(P(D.front,[h.x,0,h.z0-4],X0,Y0),P(D.front,[h.x,0,h.z1+4],X0,Y0),'#111',AX,.7); });
    if(D.left) FL.L.forEach(h=>{ o+=ln(P(D.left,[0,h.y,h.z0-4],X0+S,Y0),P(D.left,[0,h.y,h.z1+4],X0+S,Y0),'#111',AX,.7); }); }
  const arr=(q,dx,dy)=>`<path d="M${f(q[0])},${f(q[1])} l${f(dx*9-dy*2.6)},${f(dy*9+dx*2.6)} l${f(dy*5.2)},${f(-dx*5.2)}Z" fill="#111"/>`;
  const hb=P(D.front,[r,0,z0],X0,Y0), ht=P(D.front,[r,0,z1],X0,Y0), hx=hb[0]+(hz?22*Km+16:26);   /* при горизонтальном разрезе размер — за его штрихом */
  const noDim=!!(window.IG_WB&&IG_WB.includes(model));   /* рабочая тетрадь: размеры на листе не нужны (в задании их нет) */
  if(!noDim) o+=ln([hb[0]+3,hb[1]],[hx+4,hb[1]],'#111',null,.7)+ln([ht[0]+3,ht[1]],[hx+4,ht[1]],'#111',null,.7)+ln([hx,hb[1]],[hx,ht[1]],'#111',null,.7)+arr([hx,hb[1]],0,-1)+arr([hx,ht[1]],0,1)
    +`<text x="${f(hx-5)}" y="${f((hb[1]+ht[1])/2)}" transform="rotate(-90 ${f(hx-5)} ${f((hb[1]+ht[1])/2)})" class="igs-dim" text-anchor="middle">${Math.round(z1-z0)}</text>`;
  const sx=Math.abs(b[0][0]+b[1][0])<0.5, wl=P(D.front,[sx?-r:b[0][0],0,zw],X0,Y0), wr=P(D.front,[sx?r:b[1][0],0,zw],X0,Y0), wy=P(D.front,[0,0,z0],X0,Y0)[1]+24;   /* несимметричная деталь — по её краям */
  if(!noDim) o+=ln([wl[0],wl[1]+3],[wl[0],wy+4],'#111',null,.7)+ln([wr[0],wr[1]+3],[wr[0],wy+4],'#111',null,.7)+ln([wl[0],wy],[wr[0],wy],'#111',null,.7)+arr([wl[0],wy],1,0)+arr([wr[0],wy],-1,0)
    +`<text x="${f((wl[0]+wr[0])/2+(wr[0]-wl[0])*.22)}" y="${f(wy-5)}" class="igs-dim" text-anchor="middle">${round&&sx?'Ø':''}${Math.round(sx?2*r:b[1][0]-b[0][0])}</text>`;
  if(model.sec){ const [[x1,z1s],[x2,z2s]]=model.sec.p; o+=secMark(P(D.front,[x1,0,z1s],X0,Y0),P(D.front,[x2,0,z2s],X0,Y0),Km,given?'А':secL(model)); }
  if(!given&&prL(model)&&D.left){ const L=prL(model), lt=P(D.left,[0,0,z1],X0+S,Y0); o+=secMark(P(D.top,[0,-r-3,z1],X0,TOPY),P(D.top,[0,r+3,z1],X0,TOPY),Km,L)+`<text x="${f(lt[0])}" y="${f(lt[1]-16)}" class="igs-let" text-anchor="middle">${L}–${L}</text>`; }
  if(!given&&frL(model)){ const ta=P(D.front,[0,0,z1],X0,Y0), L=frL(model); o+=secMark(P(D.top,[r+3,0,z1],X0,TOPY),P(D.top,[-r-3,0,z1],X0,TOPY),Km,L)+`<text x="${f(ta[0])}" y="${f(ta[1]-16)}" class="igs-let" text-anchor="middle">${L}–${L}</text>`; }
  if(hz&&hzL(model)){ const y=P(D.front,[0,0,hz.z],X0,Y0)[1], xl=P(D.front,[-r-5,0,0],X0,Y0)[0], xr=P(D.front,[r+5,0,0],X0,Y0)[0];
    o+=secMark([xl,y],[xr,y],Km,hzL(model))+`<text x="${f(tc[0]+(prL(model)?24*Km+10:0))}" y="${f(tc[1]-r*Km-30)}" class="igs-let" text-anchor="middle">${hzL(model)}–${hzL(model)}</text>`; }
  let PW=S+2*X0, PH=TOPY+S+10;
  if(!given){
    PW=Math.max(2*S+2*X0,X0+S+185*Km+X0); PH=TOPY+S+20;
    if(model.sec){ const F=secFig(model,model.sec,Km), [bx0,by0,bx9,by9]=F.box, cx=X0+S+S/2-(bx0+bx9)/2, ty=TOPY+40, cy=ty+20-by0;
      PH=Math.max(PH,cy+by9+30);
      o+=`<defs><pattern id="${hid}" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(${secRot(model)})"><line x1="0" y1="0" x2="0" y2="7" stroke="#111" stroke-width=".8"/></pattern></defs>`
        +`<text x="${f(X0+S+S/2)}" y="${f(ty)}" class="igs-let" text-anchor="middle">${secL(model)}–${secL(model)}</text>`
        +`<path transform="translate(${f(cx)} ${f(cy)})" d="${F.d}" fill="url(#${hid})" fill-rule="evenodd" stroke="#111" stroke-width="1.7" stroke-linejoin="round"/>`; }
    /* основная надпись по форме 1 (ГОСТ 2.104) — в правом нижнем углу, под изображениями */
    const nv=parseInt(String(title).replace(/\D/g,''),10)||'', sh=55*Km; PH+=sh+10;
    o+=window.IGL&&IGL.stampK?IGL.stampK(PW-X0,PH-10,Km,nv):''; }
  return `<svg class="igs-sheet${given?' given':''}" viewBox="0 0 ${f(PW)} ${f(PH)}" role="img" aria-label="${given?'Данные изображения: главный вид и вид сверху':'Чертёж: главный вид, вид слева, вид сверху'+(model.sec?', сечение':'')}"><rect x="3" y="3" width="${f(PW-6)}" height="${f(PH-6)}" fill="#fff" stroke="#111" stroke-width="${given?1:2}"/>${o}</svg>`;
}
/* ── страницы ── */
function crumbs(list){ return list; }
function home(v){ return subjHome(v,'ig'); }   /* главная ИГ: виджет ДЗ и разделы — как у начерта (subjHome) */
/* штриховка сечения (ГОСТ 2.306, п. 5): 45° к рамке; если так штрихи почти совпадают с осью сечения (она параллельна следу) — 30° или 60° */
function hatchDeg(th){ const a=((th*180/Math.PI)%180+180)%180, near=v=>Math.min(Math.abs(a-v),180-Math.abs(a-v)); if(near(45)>=10) return 45; return near(60)>=near(30)?60:30; }
const secRot=model=>{ const [[x1,z1],[x2,z2]]=model.sec.p; return 90-hatchDeg(Math.atan2(z2-z1,x2-x1)); };
const myVar=()=>{ try{ return +localStorage.getItem('nch2_igvar')||0; }catch(e){ return 0; } };
/* ── какие изображения на листе (ГОСТ 2.305) ──
   F/L: 'half' — половина вида и половина разреза, 'view' — вид без разреза (с невидимым контуром), 'full' — полный разрез.
   Несимметричная спереди-назад деталь → вид слева только полным разрезом. Если на ось симметрии попадает ребро,
   вид от разреза отделяют волнистой линией: граница смещается так, чтобы ребро было видно (внутреннее — в разрезе, наружное — на виде). */
/* главный вид — всегда половина вида и половина фронтального разреза (все детали симметричны слева направо): главное изображение должно давать
   наиболее полное представление о детали, внутреннее устройство — разрезом (ГОСТ 2.305). Если плоскость y = 0 — не плоскость симметрии, разрез обозначают (Б–Б) */
const IG_SPEC={7:{L:'full'},22:{L:'full'},24:{L:'full'},27:{L:'full'},28:{L:'full'},30:{L:'full'},4:{L:'full'},5:{L:'full'}};   /* 5: вид слева — полный профильный разрез (деталь несимметрична спереди назад) */
function crease(model,ax){ const J=IG3.J, T=model.tree, b=model.box, h=0.05, d=0.35, o=ax==='x'?1:0;   /* ось 'x': плоскость x=0 (главный вид); 'y': y=0 (вид слева) */
  let inner=0, outer=0; const U=o?[b[0][1],b[1][1]]:[b[0][0],b[1][0]];
  for(let z=b[0][2]+1;z<b[1][2]-0.5;z+=1.5){ let prev=null;
    for(let u=U[0]-1;u<=U[1]+1;u+=0.5){ const P=o?[0,u,z]:[u,0,z], v=J(T,...P);
      if(prev!=null&&(v<0)!==(prev<0)){ const Q=o?[d,u,z]:[u,d,z], g=(k)=>{ const a=Q.slice(), c=Q.slice(); a[k]+=h; c[k]-=h; return (J(T,...a)-J(T,...c))/(2*h); };
        const n=[g(0),g(1),g(2)], l=Math.hypot(...n)||1, nn=Math.abs(n[o?0:1])/l;
        if(nn>0.3){ const out=o?[0,u+Math.sign(u||1)*2.5,z]:[u+Math.sign(u||1)*2.5,0,z]; if(J(T,...out)<0) inner++; else outer++; } }
      prev=v; } }
  return inner+outer<6?0:(inner>=outer?1:-1); }   /* ребро на оси — на заметной высоте (от 9 мм), а не точка у вершины конуса */
/* ребро на вертикальной оси вида сверху (x = 0): на половине вида — видимое сверху, на половине разреза — ниже секущей плоскости.
   Луч сверху вниз по x = 0 до поверхности; излом там, где нормаль заметно наклонена к x (у гладкой симметричной поверхности на оси n_x = 0) */
function creaseTop(model){ if(model._ct!=null) return model._ct; const J=IG3.J, T=model.tree, b=model.box, h=0.05, d=0.35, zc=model.hz.z;
  const hit=(y,zs)=>{ let prev=null; for(let z=zs;z>b[0][2]-1;z-=0.25){ const v=J(T,0,y,z); if(prev!=null&&prev>=0&&v<0) return z; prev=v; } return null; };
  const kink=(y,z)=>{ const g=k=>{ const a=[d,y,z], c=[d,y,z]; a[k]+=h; c[k]-=h; return (J(T,...a)-J(T,...c))/(2*h); }, n=[g(0),g(1),g(2)]; return Math.abs(n[0])/(Math.hypot(...n)||1)>0.3; };
  let nv=0, nc=0; for(let y=b[0][1]+0.25;y<b[1][1];y+=0.5){ const zv=hit(y,b[1][2]+1); if(zv!=null&&kink(y,zv)) nv++; const zcut=J(T,0,y,zc)<0?null:hit(y,zc); if(zcut!=null&&kink(y,zcut)) nc++; }
  Object.defineProperty(model,'_ct',{value:nv>=12||nc>=12}); return model._ct; }   /* ребро — от 6 мм */
/* симметрия детали относительно плоскости y = 0 ('y') или x = 0 ('x'): 8000 псевдослучайных точек (одинаково при каждом открытии);
   несимметричный объём бывает маленьким (треугольное отверстие), поэтому точек много, а порог — 5 несовпадений */
function symAx(model,ax){ const key=ax==='y'?'_sy':'_sx'; if(model[key]!=null) return model[key]; const b=model.box, T=model.tree; let asym=0, sd=ax==='y'?12345:777; const rnd=()=>(sd=(sd*1103515245+12345)%2147483648)/2147483648;
  for(let i=0;i<8000&&asym<5;i++){ const x=b[0][0]+rnd()*(b[1][0]-b[0][0]), y=b[0][1]+rnd()*(b[1][1]-b[0][1]), z=b[0][2]+rnd()*(b[1][2]-b[0][2]);
    if((IG3.J(T,x,y,z)<0)!==(ax==='y'?IG3.J(T,x,-y,z)<0:IG3.J(T,-x,y,z)<0)) asym++; }
  Object.defineProperty(model,key,{value:asym<5}); return model[key]; }
function igSpec(model){ if(model._spec) return model._spec; const n=Object.keys(window.IG_VARS||{}).find(k=>IG_VARS[k]===model), sp=Object.assign({F:'half',L:'half'},n?IG_SPEC[n]:{},model.spec||{});
  if(sp.L==='half'&&!symAx(model,'y')) sp.L='full';   /* несимметричная спереди назад деталь: половина вида и половина разреза на виде слева недопустима */
  if(model.step&&(sp.F==='half'||sp.F==='full')) sp.F=sp.F==='half'?'stepH':'step';   /* ступенчатый разрез (model.step — участки секущих плоскостей) */
  if(sp.F==='half'&&!symAx(model,'x')) sp.F='full'; if(sp.F==='stepH'&&!symAx(model,'x')) sp.F='step';   /* несимметричная слева направо: на главном виде — только полный разрез (ГОСТ 2.305, п. 7.10) */
  /* горизонтальный разрез: как на главном виде — слева половина вида, справа половина разреза ('half', граница — вертикальная ось), если деталь симметрична
     слева направо и на этой оси вида сверху нет ребра; иначе — по горизонтальной оси, разрез снизу ('halfD': симметрична спереди назад, hzFull — ребро на
     горизонтальной оси); иначе полный разрез */
  sp.H=!model.hz?'half':symAx(model,'x')&&!creaseTop(model)?'half':!model.hzFull&&symAx(model,'y')?'halfD':'full';
  const DL=7; sp.xb=sp.F==='half'||sp.F==='stepH'?-DL*crease(model,'x'):0; sp.yb=sp.L==='half'?DL*crease(model,'y'):0;
  sp.fk={half:'front',view:'front0',full:'frontF',stepH:'frontSH',step:'frontS'}[sp.F]; sp.lk={half:'left',view:'left0',full:'leftF'}[sp.L];
  return model._spec=sp; }
/* обозначения (ГОСТ 2.305, п. 6.7): фронтальный разрез обозначают, если его плоскость — не плоскость симметрии детали в целом
   (деталь несимметрична спереди назад). Сечение сохраняет букву из задания (А–А), фронтальный разрез получает следующую — Б–Б */
const fDes=model=>{ const sp=igSpec(model); return sp.F!=='view'&&sp.L==='full'&&!model.hz; };
/* профильный разрез обозначают, если плоскость x = 0 — не плоскость симметрии детали (деталь несимметрична слева направо) */
const pDes=model=>igSpec(model).L!=='view'&&!symAx(model,'x');
/* обозначения на листе: наклонное сечение — буквой из задания (А). Разрезы на месте видов (фронтальный, профильный, горизонтальный)
   не подписываются — на листе одна буква, как в задании. Тетрадь (без наклонного сечения): горизонтальный разрез — А–А, как в условии */
/* обозначения разрезов (ГОСТ 2.305): фронтальный, профильный и горизонтальный разрез не обозначают, только если секущая плоскость —
   плоскость симметрии детали в целом и разрез стоит в проекционной связи. Иначе — разомкнутая линия со стрелками и буквами, над разрезом «Б–Б».
   Наклонное сечение — буква из задания (А); дальше — по алфавиту (Й, О, Х, Ъ, Ы, Ь не берут). Тетрадь без наклонного сечения:
   горизонтальный разрез — А–А, как в условии */
const ySym=model=>symAx(model,'y');
function letters(model){ if(model._lt) return model._lt; const o={}, AB=model.sec?['Б','В','Г','Д']:['А','Б','В','Г'], nx=()=>AB.shift(), sp=igSpec(model);
  if(model.sec) o.s='А'; else if(model.hz) o.h=nx();
  if(sp.F!=='view'&&(model.step||!ySym(model))) o.f=nx();   /* сложный (ступенчатый) разрез обозначают всегда */
  if(sp.L!=='view'&&pDes(model)) o.p=nx();
  if(model.sec&&model.hz) o.h=nx();
  Object.defineProperty(model,'_lt',{value:o}); return o; }
const prL=model=>letters(model).p||'', hzL=model=>letters(model).h||'';
const secL=model=>letters(model).s||'';
/* отверстия вне оси детали (крепёжные на фланце и т. п.): вертикальные цилиндры, вычитаемые из детали */
function holeAxes(model){ const b=model.box, out=[]; (function w(n,sub){ if(!n) return; if(n.t==='s'){ w(n.a,sub); n.k.forEach(c=>w(c,true)); return; } if(n.k){ n.k.forEach(c=>w(c,sub)); return; }
    if(sub&&n.t==='cyl'&&Math.hypot(n.x,n.y)>1&&n.r<12) out.push({x:n.x,y:n.y,r:n.r,z0:Math.max(b[0][2],n.z0),z1:Math.min(b[1][2],n.z1)}); })(model.tree,false);
  /* глухое отверстие: конус от сверла — продолжение отверстия, ось выходит за его вершину (ГОСТ 2.303: на 2…5 мм за контур) */
  (function w(n,sub){ if(!n) return; if(n.t==='s'){ w(n.a,sub); n.k.forEach(c=>w(c,true)); return; } if(n.k){ n.k.forEach(c=>w(c,sub)); return; }
    if(sub&&n.t==='cone') out.forEach(h=>{ if(Math.hypot(h.x-n.x,h.y-n.y)>0.01) return; if(n.z0<h.z0&&n.z1>=h.z0-0.05) h.z0=Math.max(b[0][2],n.z0); if(n.z1>h.z1&&n.z0<=h.z1+0.05) h.z1=Math.min(b[1][2],n.z1); }); })(model.tree,false);
  return out; }
/* оси отверстий фланца на главном виде (x) и виде слева (y): на виде — проекции осей; на разрезе — там, куда отверстия повёрнуты
   по условности (IG3.conv): на истинном радиусе в плоскости разреза. У половины вида и половины разреза — только в разрезе:
   на половине вида невидимый контур не проводят, значит, и осей невидимых отверстий там нет */
function holeAxesFL(model){ const sp=igSpec(model), F=[], L=[], dF={}, dL={};
  const fh=sp.F==='view'?holeAxes(model):holeAxes(IG3.conv(model,'y')).filter(h=>Math.abs(h.y)<0.01&&(sp.F==='full'||h.x>(sp.xb||0)+0.5));
  const lh=sp.L==='view'?holeAxes(model):holeAxes(IG3.conv(model,'x')).filter(h=>Math.abs(h.x)<0.01&&(sp.L==='full'||h.y<(sp.yb||0)-0.5));
  fh.forEach(h=>{ const k=h.x.toFixed(1); if(!dF[k]){ dF[k]=1; F.push({x:h.x,z0:h.z0,z1:h.z1}); } });
  lh.forEach(h=>{ const k=h.y.toFixed(1); if(!dL[k]){ dL[k]=1; L.push({y:h.y,z0:h.z0,z1:h.z1}); } });
  return {F,L}; }
/* штрихпунктирная тонкая (ГОСТ 2.303): штрихи 5…30 мм, промежутки 3…5 мм; линия начинается и кончается штрихом, середина — штрих
   (оси и центровые пересекаются штрихами, а не точками). Длину штриха подгоняем под длину линии. L — длина в единицах листа, K — единиц на 1 мм.
   Короткая линия (меньше двух штрихов) — сплошная тонкая: так же ГОСТ велит для центровых окружностей меньше Ø12 */
function axDash(L,K){ const g=3*K, t=0.5*K, d0=9*K, P=d0+2*g+t, D=n=>(L-n*(2*g+t))/(n+1); let n=Math.round((L-d0)/P/2)*2, best=0;
  [n-2,n,n+2].forEach(m=>{ if(m>0&&D(m)>=5*K&&D(m)<=30*K&&(best===0||Math.abs(D(m)-d0)<Math.abs(D(best)-d0))) best=m; });
  if(!best) return ''; const d=D(best), r=v=>Math.round(v*100)/100; return r(d)+' '+r(g)+' '+r(t)+' '+r(g); }
/* центровая окружность радиуса R (ед. листа) с центрами отверстий под углами A (град, против часовой; на листе ось y вниз):
   дуги между соседними отверстиями — каждая со своим шагом, чтобы на центре каждого отверстия был штрих */
function axCircle(c,R,A,K,col,w){ const a=[...new Set(A.map(v=>((Math.round(v*1000)/1000)%360+360)%360))].sort((x,y)=>x-y), g=3*K, t=0.5*K, d0=9*K; let o='';
  const arc=(a0,a1)=>{ const L=R*(a1-a0)*Math.PI/180, n=Math.max(1,Math.round(L/(d0+2*g+t))), d=L/n-(2*g+t), N=Math.max(8,Math.ceil((a1-a0)/2)), pts=[];
    for(let i=0;i<=N;i++){ const q=(a0+(a1-a0)*i/N)*Math.PI/180; pts.push((i?'L':'M')+(c[0]+R*Math.cos(q)).toFixed(1)+' '+(c[1]-R*Math.sin(q)).toFixed(1)); }
    return d<2*K?`<path d="${pts.join('')}" fill="none" stroke="${col}" stroke-width="${w}"/>`:`<path d="${pts.join('')}" fill="none" stroke="${col}" stroke-width="${w}" stroke-dasharray="${d.toFixed(2)} ${g} ${t} ${g}" stroke-dashoffset="${(d/2).toFixed(2)}"/>`; };
  if(!a.length) return arc(0,360); a.forEach((v,i)=>{ const nx=i+1<a.length?a[i+1]:a[0]+360; o+=arc(v,nx); }); return o; }
/* осевая с опорами (ГОСТ 2.303: штрихпунктирные пересекаются и кончаются штрихами): в точках ts (расстояние от a, ед. листа) —
   середина штриха, концы — полным штрихом. Кусок между опорами — целое число периодов от полуштриха до полуштриха, крайний —
   от полного штриха до полуштриха; штрих каждого куска — 5…30 мм, ближе всего к 9. Опору, с которой кусок не складывается,
   убираем (сначала не центр: pr — важность). Возвращает разметку SVG; rec(a,b) — отрезок для обхода подписей */
function axLine(a,b,ts,K,col,w,rec){ const L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<1e-6) return ''; const u=[(b[0]-a[0])/L,(b[1]-a[1])/L], g=3*K, t=0.5*K, d0=9*K, gt=2*g+t, P=v=>[a[0]+u[0]*v,a[1]+u[1]*v];
  const fit=(l,e)=>{ let best=null; for(let n=0;n<80;n++){ const d=e===0?(n?l/n-gt:-1):e===1?(l-n*gt)/(n+.5):(l-n*gt)/(n+1); if(d<5*K-1e-9||d>30*K+1e-9) continue; if(best==null||Math.abs(d-d0)<Math.abs(best-d0)) best=d; } return best; };
  let A=[]; (ts||[]).forEach(q=>{ const v=typeof q==='number'?{t:q,pr:1}:q; if(v.t>1e-6&&v.t<L-1e-6&&!A.some(x=>Math.abs(x.t-v.t)<0.05*K)) A.push(v); }); A.sort((x,y)=>x.t-y.t);
  for(let it=0;it<40;it++){ const S=[0,...A.map(x=>x.t),L]; let bad=-1; for(let i=0;i+1<S.length;i++){ const e=(i===0?1:0)+(i+2===S.length?1:0); if(fit(S[i+1]-S[i],e)==null){ bad=i; break; } }
    if(bad<0) break; const c=[A[bad-1],A[bad]].filter(Boolean).sort((x,y)=>x.pr-y.pr)[0]; A=A.filter(x=>x!==c); }
  const r=v=>Math.round(v*100)/100, f=v=>Math.round(v*10)/10, S=[0,...A.map(x=>x.t),L], out=[];
  const put=(p,q,d,off)=>{ if(rec) rec(p,q); out.push(`<line x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}" stroke="${col}" stroke-width="${w}" stroke-dasharray="${r(d)} ${r(g)} ${r(t)} ${r(g)}"${off?` stroke-dashoffset="${r(off)}"`:''} stroke-linecap="butt"/>`); };
  if(S.length===2){ const d=fit(L,2); if(d==null){ if(rec) rec(a,b); return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; } put(a,b,d,0); return out.join(''); }
  for(let i=0;i+1<S.length;i++){ const l=S[i+1]-S[i], first=i===0, last=i+2===S.length, d=fit(l,(first?1:0)+(last?1:0));
    if(first) put(P(S[0]),P(S[1]),d,0); else if(last) put(P(S[i+1]),P(S[i]),d,0); else put(P(S[i]),P(S[i+1]),d,d/2); }
  return out.join(''); }
const frL=model=>letters(model).f||'';
function wavy(Pa,Pb){ const dx=Pb[0]-Pa[0], dy=Pb[1]-Pa[1], L=Math.hypot(dx,dy), ux=dx/L, uy=dy/L, n=Math.max(4,Math.round(L/16)); let d=`M${Pa[0].toFixed(1)},${Pa[1].toFixed(1)}`;
  for(let i=1;i<=n;i++){ const t=i/n, m=(i-.5)/n, a=(i%2?3.2:-3.2); d+=` Q${(Pa[0]+dx*m-uy*a).toFixed(1)},${(Pa[1]+dy*m+ux*a).toFixed(1)} ${(Pa[0]+dx*t).toFixed(1)},${(Pa[1]+dy*t).toFixed(1)}`; }
  return `<path d="${d}" fill="none" stroke="#111" stroke-width="1"/>`; }
/* ── характерные точки очерка (для развёртки): уровни z примитивов и наибольшая глубина |y| тела на каждом уровне.
   Все виды в одном масштабе и с общим центром (IG3.drawing), поэтому линии связи точно горизонтальны и вертикальны. */
function keyPts(model){
  const b=model.box, J=IG3.J, T=model.tree, zs=new Set([b[0][2],b[1][2]]);
  (function w(n){ if(!n) return; if(n.z0!=null&&n.z1!=null){ [n.z0,n.z1].forEach(z=>{ if(z>b[0][2]+0.3&&z<b[1][2]-0.3) zs.add(Math.round(z*2)/2); }); } (n.k||[]).forEach(w); if(n.a) w(n.a); })(T);
  /* крайняя точка тела по глубине на высоте z: sgn = −1 — ближайшая к нам (y min), +1 — дальняя; возвращает y и x */
  const Y=(z,sgn)=>{ for(let t=0;t<=b[1][1]-b[0][1]+2;t+=0.25){ const y=sgn<0?b[0][1]-1+t:b[1][1]+1-t; let best=null;
      for(let x=b[0][0];x<=b[1][0];x+=0.5){ if(J(T,x,y,z)<0&&(best==null||Math.abs(x)<Math.abs(best))) best=x; } if(best!=null) return {y:Math.round(y*4)/4,x:best}; } return null; };
  const lv=[...zs].sort((p,q)=>p-q), out=[];
  lv.forEach(z=>{ [z>b[0][2]+0.1?z-0.35:null, z<b[1][2]-0.1?z+0.35:null].forEach(zz=>{ if(zz==null) return; [-1,1].forEach(sg=>{ const q=Y(zz,sg); if(!q) return;
      if(!out.some(p=>Math.abs(p.z-z)<0.6&&Math.abs(p.y-q.y)<0.8)) out.push({z,y:q.y,x:q.x}); }); }); });
  return out;
}
/* ── шаги построения: вид слева строим по элементам детали — сначала тела, потом отверстия и вырезы ── */
/* линии вида слева на шаге i: детали «на этот момент»; новые — те, которых не было на прошлом шаге */
function stepLines(model,i){ const c=model._sl||(Object.defineProperty(model,'_sl',{value:{}}),model._sl); if(c[i]) return c[i];
  const pm=j=>c['m'+j]||(c['m'+j]=IG3.drawing(IG3.partial(model,j),'left0',900).lines), cur=pm(i), prev=i>0?pm(i-1):[];
  const G=new Map(), K=(x,y)=>Math.floor(x/3)+','+Math.floor(y/3); prev.forEach(s=>[s.a,s.b,[(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2]].forEach(p=>{ const k=K(p[0],p[1]); if(!G.has(k)) G.set(k,[]); G.get(k).push(s); }));
  const was=s=>[0.25,0.5,0.75].every(t=>{ const p=[s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t]; for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) for(const q of G.get((Math.floor(p[0]/3)+dx)+','+(Math.floor(p[1]/3)+dy))||[]){
      if(q.h!==s.h) continue; const ux=q.b[0]-q.a[0], uy=q.b[1]-q.a[1], l=Math.hypot(ux,uy)||1e-9, u=((p[0]-q.a[0])*ux+(p[1]-q.a[1])*uy)/(l*l); if(u>-0.02&&u<1.02&&Math.abs((p[0]-q.a[0])*uy-(p[1]-q.a[1])*ux)/l<0.5) return true; } return false; });
  const nw=cur.filter(s=>!was(s)), old=cur.filter(s=>was(s));
  return c[i]={old:IG3.paths(old),cur:IG3.paths(nw),segs:nw}; }
function buildSteps(model){ const FT=IG3.features(model), out=[['given','Дано',(model.noTop?'Главный вид — из задания; вид сверху строим под ним.':'Главный вид и вид сверху — из задания.'+(model.givenTop?' Вид сверху дан не полностью: отверстие K на нём достраиваем по главному виду — дальше он уже достроен.':''))+' Вид слева строим справа от главного вида, на одной высоте с ним.'],
   ...(model.noTop?[['top','Вид сверху','Вида сверху в задании нет — строим его первым, под главным видом. Ширины переносим с главного вида вертикальными линиями связи; глубины берём из формы тела (у шара и цилиндра контур сверху — окружность того же диаметра). Отверстия, идущие вдоль взгляда (K), видны сверху как линии по их ширине на главном виде; невидимые контуры — штриховыми. Дальше глубины для вида слева берём с этого вида.']]:[]),
   ['axis','Ось симметрии вида слева','Сначала проводим ось симметрии вида слева — от неё будем откладывать глубины. Высоты общие с главным видом.']];
  let first=true;
  FT.forEach((f,i)=>{ const u=stepLines(model,i); if(!u.segs.length) return;   /* элемент не добавляет линий на виде слева — шаг не нужен */
    const hid=u.segs.every(q=>q.h), vis=u.segs.every(q=>!q.h);
    const how=first?'Высоту каждой точки (1″, 2″, …) переносим с главного вида горизонтальной линией связи. Глубину — расстояние от оси до точки на виде сверху (1′, 2′, …) — откладываем от оси вида слева. Получаем 1‴, 2‴, … и соединяем.'
      :'Точки — так же: высота с главного вида, глубина с вида сверху от оси.';
    out.push(['feat',f.name,how+(hid?' Элемент внутри детали — его линии невидимы, проводим штриховой.':vis?'':' Видимые части — сплошной линией, невидимые — штриховой.'),i]); first=false; });
  { const LT=letters(model), hl=holeAxes(model).length, sp=igSpec(model);
    out.push(['cut','Разрезы','Внутреннюю форму показываем разрезами. Симметричное изображение — половина вида и половина разреза, граница по оси (если на ось попадает ребро — волнистой линией: внутреннее ребро остаётся в разрезе, наружное — на виде). Несимметричное изображение — полный разрез. В секущей плоскости — штриховка 45°. На половине вида невидимый контур (штриховые) не проводят — внутреннее устройство уже показано разрезом.'
      +(hl?' Отверстия на круглом фланце в секущую плоскость не попали, но по ГОСТ 2.305 их показывают в разрезе как попавшие в неё: мысленно поворачиваем отверстие вокруг оси детали до плоскости разреза — оно встаёт на свой радиус (не на проекцию).':'')
      +(LT.f?' Фронтальная плоскость здесь — не плоскость симметрии детали (спереди и сзади деталь разная), поэтому разрез обозначают: на виде сверху — разомкнутая линия со стрелками и буквами '+LT.f+', над главным видом — «'+LT.f+'–'+LT.f+'».':'')
      +(sp.F!=='view'&&!LT.f||sp.L!=='view'&&!LT.p?' Разрез, плоскость которого — плоскость симметрии детали и который стоит в проекционной связи, не обозначают.':'')]); }
  if(model.sec) out.push(['sec','Сечение '+secL(model)+'–'+secL(model),'Наклонная плоскость задана следом на главном виде. Точки контура переносим перпендикулярно следу — фигура строится в натуральную величину, со штриховкой.']);
  out.push(['sheet','Готовый лист','Все изображения на листе в проекционной связи, с осями'+(window.IG_WB&&IG_WB.includes(model)?'':', размерами')+' и основной надписью.']);
  return out; }
/* характерные точки элемента на виде слева: верхний и нижний уровни и излом между ними; на каждом уровне — ближайшая к нам точка контура */
function featPts(segs){ const P=[]; segs.forEach(q=>{ P.push(q.a3,q.b3); }); if(!P.length) return [];
  const zs=P.map(p=>p[2]), lo=Math.min(...zs), hi=Math.max(...zs), lv=new Set([hi,lo].map(z=>Math.round(z*10)/10));
  segs.forEach(q=>{ if(Math.abs(q.a3[2]-q.b3[2])<1e-6) lv.add(Math.round(q.a3[2]*10)/10); });
  let L=[...lv].sort((a,b)=>b-a); if(L.length>3) L=[L[0],L[Math.floor(L.length/2)],L[L.length-1]];
  /* на уровне — ближайшая к нам точка; если сзади глубина другая (элемент несимметричен) — и задняя */
  const out=[], put=p=>{ if(!out.some(q=>Math.abs(q[1]-p[1])<0.5&&Math.abs(q[2]-p[2])<0.5)) out.push(p); };
  L.forEach(z=>{ const c=P.filter(p=>Math.abs(p[2]-z)<0.06); if(!c.length) return; c.sort((a,b)=>a[1]-b[1]); const fr=c[0], bk=c[c.length-1];
    if(fr[1]<-0.05) put(fr); if(bk[1]>0.05&&(fr[1]>-0.05||Math.abs(bk[1]+fr[1])>0.5)) put(bk); });
  return out.slice(0,4); }
function stepsSVG(model,st,steps){
  const W=900, S=420, k0=S/W, X0=20, Y0=16, TOPY=Y0+S-20, PW=2*S+2*X0, PH=TOPY+S+6, kind=st[0], sp=igSpec(model);
  const d={front0:IG3.drawing(model,'front0',W),top:IG3.drawing(model,'top',W),left0:IG3.drawing(model,'left0',W),front:IG3.drawing(model,sp.fk,W,0,sp.xb),left:IG3.drawing(model,sp.lk,W,0,sp.yb)}; if(!d.front0) return '';
  const P=(v,q,ox,oy)=>{ const t=d[v].px(q); return [ox+t[0]*k0,oy+t[1]*k0]; }, f=v=>Math.round(v*10)/10;
  const FR=q=>P('front0',q,X0,Y0), TP=q=>P('top',q,X0,TOPY), LF=q=>P('left0',q,X0+S,Y0);
  const L=(a,c,cl,dash,w)=>`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(c[0])}" y2="${f(c[1])}" stroke="${cl}" stroke-width="${w||1}"${dash?` stroke-dasharray="${dash}"`:''}/>`;
  const dot=(q,cl)=>`<circle cx="${f(q[0])}" cy="${f(q[1])}" r="3.6" fill="${cl}"/>`, LB=[], lab=(q,t,cl,dx,dy)=>{ let x=q[0]+dx, y=q[1]+dy; while(LB.some(z=>Math.abs(z[0]-x)<24&&Math.abs(z[1]-y)<14)) y+=14; LB.push([x,y]); return `<text x="${f(x)}" y="${f(y)}" class="igs-k" fill="${cl}">${t}</text>`; };
  const AC='#4f86c6', HL='#8e1f32', AX='12 3 2 3', b=model.box, z0=b[0][2], z1=b[1][2], cut=kind==='cut'||kind==='sec';
  let o='';
  const img=(v,x,y)=>`<image href="${d[v].url}" x="${x}" y="${y}" width="${S}" height="${S}"/>`;
  if(kind==='given'&&model.givenTop) d.topG=IG3.drawing({tree:model.givenTop,box:model.box},'top',W);   /* «Дано» — вид сверху как в задании (не достроен) */
  o+=img(cut?'front':'front0',X0,Y0)+(kind==='given'&&model.noTop?'':img(kind==='given'&&d.topG?'topG':'top',X0,TOPY));
  if(cut){ o+=img('left',X0+S,Y0);
    /* ребро на оси: вид от разреза отделяет волнистая линия (как на листе) */
    if(sp.xb) o+=wavy(P('front',[sp.xb,0,z0+0.5],X0,Y0),P('front',[sp.xb,0,z1-0.5],X0,Y0)); if(sp.yb) o+=wavy(P('left',[0,sp.yb,z0+0.5],X0+S,Y0),P('left',[0,sp.yb,z1-0.5],X0+S,Y0));
    /* оси отверстий фланца в разрезах (там, куда отверстия повёрнуты по условности) и обозначения разрезов, если плоскость — не плоскость симметрии */
    const FL=holeAxesFL(model), Km=(P('front',[10,0,0],X0,Y0)[0]-P('front',[0,0,0],X0,Y0)[0])/10, AXs='12 3 2 3', LT=letters(model), rr=Math.max(b[1][0],b[1][1])+4;
    FL.F.forEach(h=>{ o+=L(P('front',[h.x,0,h.z0-4],X0,Y0),P('front',[h.x,0,h.z1+4],X0,Y0),'#111',AXs,.7); }); FL.L.forEach(h=>{ o+=L(P('left',[0,h.y,h.z0-4],X0+S,Y0),P('left',[0,h.y,h.z1+4],X0+S,Y0),'#111',AXs,.7); });
    const lbl=(q,t)=>`<text x="${f(q[0])}" y="${f(q[1])}" class="igs-let" text-anchor="middle">${t}–${t}</text>`;
    if(LT.f) o+=secMark(P('top',[rr,0,z1],X0,TOPY),P('top',[-rr,0,z1],X0,TOPY),Km,LT.f)+lbl([P('front',[0,0,z1],X0,Y0)[0],P('front',[0,0,z1],X0,Y0)[1]-12],LT.f);
    if(LT.p) o+=secMark(P('top',[0,-rr,z1],X0,TOPY),P('top',[0,rr,z1],X0,TOPY),Km,LT.p)+lbl([P('left',[0,0,z1],X0+S,Y0)[0],P('left',[0,0,z1],X0+S,Y0)[1]-12],LT.p); }
  /* вид слева по элементам: построенные раньше — чёрным, текущий — цветом */
  let view='';
  if(kind==='feat'){ const u=stepLines(model,st[3]), sw=d.left0.sw, g=(pp,cl)=>(pp.h?`<path d="${pp.h}" fill="none" stroke="${cl}" stroke-width="${f(sw*(cl==='#111'?0.45:0.65))}" stroke-dasharray="${f(2.5*d.left0.mm)} ${f(1.1*d.left0.mm)}"/>`:'')+(pp.v?`<path d="${pp.v}" fill="none" stroke="${cl}" stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round"/>`:'');
    view=`<g transform="translate(${X0+S} ${Y0}) scale(${k0})">${g(u.old,'#111')}${g(u.cur,HL)}</g>`; }
  /* оси симметрии */
  const fa=FR([0,0,z0-6]), fb=FR([0,0,z1+6]); o+=L(fa,fb,'#111',AX,.7);
  const tc=TP([0,0,z1]), r=Math.max(b[1][0],b[1][1])+6, e=TP([r,0,z1])[0]-tc[0], noT=kind==='given'&&model.noTop; if(!noT) o+=L([tc[0]-e,tc[1]],[tc[0]+e,tc[1]],'#111',AX,.7)+L([tc[0],tc[1]-e],[tc[0],tc[1]+e],'#111',AX,.7);
  if(kind==='top') [b[0][0],b[1][0]].forEach(x=>{ o+=L(FR([x,0,z0]),TP([x,b[1][1],z1]),AC,null,1); });   /* построение вида сверху: ширины — вертикальными линиями связи */
  if(kind!=='given'&&kind!=='top'){ const la=LF([0,0,z0-6]), lb=LF([0,0,z1+6]); o+=L(la,lb,kind==='axis'?AC:'#111',AX,kind==='axis'?1.2:.7); }
  /* как в задании: оси отверстий и центровая окружность на виде сверху, след плоскости А на главном виде — с первого шага */
  { const Km=(FR([10,0,0])[0]-FR([0,0,0])[0])/10, dn={};
    if(!noT) holeAxes(model).forEach(h=>{ const R=Math.hypot(h.x,h.y), q=TP([h.x,h.y,z1]), a=h.r+3, ux=h.x/R, uy=h.y/R;
      if(!dn[R.toFixed(1)]){ dn[R.toFixed(1)]=1; o+=`<circle cx="${f(tc[0])}" cy="${f(tc[1])}" r="${f(R*Km)}" fill="none" stroke="#111" stroke-width=".7" stroke-dasharray="${AX}"/>`; }
      o+=L(TP([h.x-ux*a,h.y-uy*a,z1]),TP([h.x+ux*a,h.y+uy*a,z1]),'#111',AX,.5)+L(TP([h.x+uy*a,h.y-ux*a,z1]),TP([h.x-uy*a,h.y+ux*a,z1]),'#111',AX,.5); });
    if(model.sec&&kind!=='sec'){ const [[x1,za],[x2,zb]]=model.sec.p; o+=secMark(FR([x1,0,za]),FR([x2,0,zb]),Km,secL(model)); } }
  /* точки текущего элемента: P″ на главном виде, P′ на виде сверху, P‴ на виде слева.
     Высота — горизонтальной линией связи; глубина |y| — от оси вида сверху до P′, тот же отрезок — от оси вида слева до P‴ (засечки — равные отрезки) */
  if(kind==='feat'){ const pts=featPts(stepLines(model,st[3]).segs); let n0=0; steps.slice(0,steps.indexOf(st)).forEach(q=>{ if(q[0]==='feat') n0+=featPts(stepLines(model,q[3]).segs).length; });
    const tick=(a,c)=>{ const dx=c[0]-a[0], dy=c[1]-a[1], l=Math.hypot(dx,dy)||1, nx=-dy/l*4, ny=dx/l*4; return [a,c].map(q=>L([q[0]-nx,q[1]-ny],[q[0]+nx,q[1]+ny],AC,null,1.2)).join(''); };
    let g='', t='';
    pts.forEach((p,i)=>{ const n=n0+i+1, A2=FR(p), A1=TP(p), A3=LF(p), T0=TP([p[0],0,p[2]]), L0=LF([0,0,p[2]]);
      g+=L(A2,A3,AC,null,.8);
      if(Math.abs(p[1])>0.3) g+=L(T0,A1,AC,null,1.8)+L(L0,A3,AC,null,1.8)+tick(T0,A1)+tick(L0,A3);
      t+=dot(A2,'#111')+dot(A1,'#111')+dot(A3,HL)+lab(A2,n+'″','#111',5,-6)+lab(A1,n+'′','#111',6,14)+lab(A3,n+'‴',HL,6,-6); });
    o+=g+view+t; view=''; }   /* построения под линиями вида, точки и подписи — поверх */
  o+=view;
  if(kind==='sec'){ const [[x1,za],[x2,zb]]=model.sec.p, Km=(FR([10,0,0])[0]-FR([0,0,0])[0])/10; o+=secMark(P('front',[x1,0,za],X0,Y0),P('front',[x2,0,zb],X0,Y0),Km,secL(model),HL);
    const F=secFig(model,model.sec,Km*0.8), [bx0,by0,bx9,by9]=F.box, cx=X0+S+S*0.62-(bx0+bx9)/2, cy=TOPY+S*0.55-(by0+by9)/2;
    o+=`<defs><pattern id="igStH" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(${secRot(model)})"><line x1="0" y1="0" x2="0" y2="6" stroke="#111" stroke-width=".7"/></pattern></defs>`
      +`<text x="${f(cx+(bx0+bx9)/2)}" y="${f(cy+by0-12)}" class="igs-let" text-anchor="middle" style="font-size:24px">${secL(model)}–${secL(model)}</text><path transform="translate(${f(cx)} ${f(cy)})" d="${F.d}" fill="url(#igStH)" fill-rule="evenodd" stroke="#111" stroke-width="1.5"/>`; }
  return `<svg class="igs-sheet igs-steps" viewBox="0 0 ${PW} ${f(PH)}" role="img" aria-label="Построение по шагам: ${st[1]}"><rect x="2" y="2" width="${PW-4}" height="${f(PH-4)}" fill="#fff" stroke="#111" stroke-width="1"/>${o}</svg>`;
}
function buildBlock(host,model,o){
  /* вариант ДЗ: сечение А–А — по точкам (IGS.secSteps), готовый лист — чистовик как на образце */
  const nv=+(Object.keys(window.IG_VARS||{}).find(q=>IG_VARS[q]===model)||0), hw=nv&&window.IGS;
  const ST=hw?buildSteps(model).flatMap(s=>s[0]==='sec'?IGS.secSteps(nv).map(q=>['secp',q.t,q.d,q.st]):[s]):buildSteps(model), N=ST.length; let k=1;
  /* компактно, всё на одном экране телефона: сверху навигация и название шага, ниже чертёж, под ним — пояснение */
  host.innerHTML=`
   <div class="igb-ctl"><button class="igb-b" id="igbPrev" aria-label="Назад">‹</button><div class="igb-t"><small id="igbN"></small><b id="igbTt"></b></div><button class="igb-b pri" id="igbNext" aria-label="Дальше">›</button></div>
   <div class="igb-nums" role="tablist">${Array.from({length:N},(_,i)=>`<button data-k="${i+1}" aria-label="Шаг ${i+1}"></button>`).join('')}</div>
   <div class="igb-pic" id="igbPic"></div>
   <p class="igb-d" id="igbD"></p>`;
  const pic=host.querySelector('#igbPic');
  /* линии шага считаются при первом показе: заголовок меняется сразу, картинка — следующим кадром.
     Пока считается, на картинке крутилка (появляется с задержкой — на быстрых шагах её не видно) */
  let busy=false;
  const show=()=>{ const kk=k, st=ST[kk-1];
    host.querySelector('#igbN').textContent='Шаг '+kk+' из '+N; host.querySelector('#igbTt').textContent=st[1]; host.querySelector('#igbD').textContent=st[2];
    host.querySelectorAll('.igb-nums button').forEach(b=>{ const n=+b.dataset.k; b.classList.toggle('on',n===kk); b.classList.toggle('done',n<kk); });
    if(busy) return; busy=true; pic.classList.add('igx-ldh');
    pic.insertAdjacentHTML('beforeend','<div class="igx-ld soft" role="status"><div class="igx-ld-c"><span class="igx-ld-sp" aria-hidden="true"></span><b>Строю шаг…</b></div></div>');
    frame().then(()=>{ busy=false; pic.classList.remove('igx-ldh'); if(!pic.isConnected) return; paint(k); }); };
  const paint=kk=>{ const st=ST[kk-1];
    let svg=''; try{ svg=st[0]==='secp'?IGS.secFrame(nv,st[3]):st[0]==='sheet'&&hw?IGS.sheet(nv,'clean'):st[0]==='sheet'?sheetSVG(model,(o.tb||{}).name||o.title,(o.tb||{}).sub||'Построение изображений',(o.tb||{}).task||'Задание №2'):stepsSVG(model,st,ST); }catch(e){ console.error(e); }
    pic.innerHTML=svg||'<div class="igx-given-l">Не удалось построить на этом устройстве.</div>'; };
  host.querySelectorAll('.igb-nums button').forEach(b=>b.addEventListener('click',()=>{ k=+b.dataset.k; show(); }));
  host.querySelector('#igbPrev').addEventListener('click',()=>{ k=Math.max(1,k-1); show(); });
  host.querySelector('#igbNext').addEventListener('click',()=>{ k=Math.min(N,k+1); show(); });
  show();
}
/* ── развёртка плоскостей проекций: деталь в углу П₁ П₂ П₃ → деталь убрали → плоскости развернули → эпюр ──
   Деталь рисует WebGL (прозрачный фон), всё остальное — вектор поверх и под ней, в той же ортогональной камере.
   Изображения на плоскостях — виды из модели; плоскость остаётся плоской при повороте, поэтому её картинка
   переносится аффинным преобразованием точно. */
function mountUnfold(host,model,opt){ opt=opt||{};   /* opt.pt = {p:[x,y,z], n:'A'} — своя точка (по умолчанию — передняя верхняя точка очерка) */
  host.innerHTML=`<div class="igu-st" id="iguSt"><svg class="igu-back" id="iguB"></svg><svg class="igu-front" id="iguF"></svg></div>
   <div class="igu-ph" role="tablist">${['Деталь','Проекции','Без детали','Развернули','Чертёж'].map((t,i)=>`<button data-i="${i}" class="${i?'':'on'}">${t}</button>`).join('')}</div>
   <div class="igu-ctl"><button class="igu-play" id="iguPlay" aria-label="Показать">▶</button><input type="range" id="iguT" min="0" max="1000" value="0" aria-label="Ход развёртки"></div>
   <p class="igx-mcap" id="iguCap"></p>`;
  const st=host.querySelector('#iguSt'), B=host.querySelector('#iguB'), Fr=host.querySelector('#iguF');
  const M=mountViewer(st,model,{state:{res:1.25,cut:0,clear:1,yaw:0.68,pit:0.42,zoom:0.5},home:{yaw:0.68,pit:0.42,zoom:0.5}});   /* смотрим слева-спереди-сверху: все три плоскости — позади детали */ if(!M){ st.insertAdjacentHTML('afterbegin','<div class="igx-nogl">Не удалось запустить 3D на этом устройстве.</div>'); return; }
  st.appendChild(Fr);
  const b=model.box, S=M.S, C=S.C, Rr=S.R, sc=Rr*1.62, g=Rr*0.32;
  const X=b[1][0]+g, Y=b[1][1]+g, Z0=b[0][2]-g, xa=C[0]-sc/2, ya=C[1]-sc/2, zt=C[2]+sc/2;
  /* толщины по ГОСТ 2.303: контур детали — самая толстая линия (s), невидимый контур — s/2, оси проекций, линии связи,
     рамки плоскостей — тонкие (≈ s/2,5). Вид — картинка листа (900 px), в рамке она уменьшена в ~4 раза, и её контур
     становился тоньше осей x, y, z. Поэтому линии вида утолщаем (в готовом SVG — пересчитывать чертёж не нужно);
     на узком экране вид уменьшен сильнее — утолщаем больше */
  const THK=2*Math.min(1.7,Math.max(1,630/(st.clientWidth||630))), thick=d=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(d.svg.replace(/stroke-width="([\d.]+)"/g,(m,v)=>'stroke-width="'+(+v*THK).toFixed(2)+'"'));
  const IMG={}; ['front0','left0','top'].forEach(k=>{ try{ IMG[k]=thick(IG3.drawing(model,k,900));   /* тот же размер, что у листа и шагов: чертёж считается один раз (вектор — размер не влияет на вид) */ }catch(e){ IMG[k]=''; } });
  /* точка A — передняя верхняя точка очерка */
  const kp=opt.pt?[]:keyPts(model).filter(p=>p.y<0).sort((p,q)=>q.z-p.z||p.y-q.y); let A=opt.pt?opt.pt.p:kp.length?[kp[0].x,kp[0].y,kp[0].z]:[C[0],b[0][1],b[1][2]], NM=opt.pt?opt.pt.n:'A';
  let T=0, axo=1, fi1=0, fi3=0, fade=0, cam0=null, proj=0, shown=0, ray=1, link=0, dr=0;   /* dr — переход к чертежу «как на листе» */
  const m1=(p,f)=>{ const d=Y-p[1]; return [p[0],Y-d*Math.cos(f),Z0-d*Math.sin(f)]; };
  const m3=(p,f)=>{ const d=Y-p[1]; return [X+d*Math.sin(f),Y-d*Math.cos(f),p[2]]; };
  const cam=()=>{ const cy=Math.cos(S.yaw), sy=Math.sin(S.yaw), cp=Math.cos(S.pit), sp=Math.sin(S.pit), F=[sy*cp,cy*cp,-sp];
    let R=[F[1]*1-F[2]*0, F[2]*0-F[0]*1, 0]; const l=Math.hypot(R[0],R[1])||1; R=[R[0]/l,R[1]/l,0]; const U=[R[1]*F[2]-R[2]*F[1],R[2]*F[0]-R[0]*F[2],R[0]*F[1]-R[1]*F[0]];
    const w=st.clientWidth, h=st.clientHeight, us=S.R*2.25/S.zoom*Math.max(1,h/w), Cc=[C[0]+(S.tx||0)*R[0]+(S.ty||0)*U[0],C[1]+(S.tx||0)*R[1]+(S.ty||0)*U[1],C[2]+(S.tx||0)*R[2]+(S.ty||0)*U[2]];
    return {w,h,P:p=>{ const d=[p[0]-Cc[0],p[1]-Cc[1],p[2]-Cc[2]]; return [w/2+(d[0]*R[0]+d[1]*R[1]+d[2]*R[2])/us*h, h/2-(d[0]*U[0]+d[1]*U[1]+d[2]*U[2])/us*h]; }}; };
  const f=v=>Math.round(v*10)/10;
  function over(){ if(!st.clientWidth||!st.clientHeight) return; const {w,h,P}=cam(); [B,Fr].forEach(x=>x.setAttribute('viewBox',`0 0 ${w} ${h}`));
    const poly=(ps,cl,op)=>`<polygon points="${ps.map(P).map(q=>f(q[0])+','+f(q[1])).join(' ')}" fill="${cl}" fill-opacity="${f(op*(.3+.7*axo))}" stroke="#8a7442" stroke-opacity="${f(.7*axo)}" stroke-width=".7"/>`;
    const img=(url,O,Uv,Vv)=>{ const o=P(O), u=P(Uv), v=P(Vv); return url&&shown>0.005?`<image href="${url}" opacity="${f(shown)}" width="1" height="1" preserveAspectRatio="none" style="mix-blend-mode:multiply" transform="matrix(${f(u[0]-o[0])} ${f(u[1]-o[1])} ${f(v[0]-o[0])} ${f(v[1]-o[1])} ${f(o[0])} ${f(o[1])})"/>`:''; };
    const ln=(a,c,cl,wd,dash,op)=>{ const p=P(a), q=P(c); return `<line x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}" stroke="${cl}" stroke-width="${wd}"${dash?` stroke-dasharray="${dash}"`:''}${op!=null?` stroke-opacity="${op}"`:''} stroke-linecap="round"/>`; };
    const tx=(p,t,cl,dx,dy,cls)=>{ const q=P(p); return `<text x="${f(q[0]+(dx||0))}" y="${f(q[1]+(dy||0))}" class="${cls||'igu-l'}" fill="${cl}">${t}</text>`; };
    const dot=(p,cl)=>{ const q=P(p); return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="3" fill="#fff" stroke="${cl}" stroke-width="1.6"/>`; };
    /* плоскости */
    const P1=[[xa,ya,Z0],[X,ya,Z0],[X,Y,Z0],[xa,Y,Z0]].map(p=>m1(p,fi1)), P2=[[xa,Y,Z0],[X,Y,Z0],[X,Y,zt],[xa,Y,zt]], P3=[[X,ya,Z0],[X,Y,Z0],[X,Y,zt],[X,ya,zt]].map(p=>m3(p,fi3));
    let o=poly(P1,'#cdb67f',.16)+poly(P2,'#cdb67f',.16)+poly(P3,'#cdb67f',.16);
    o+=img(IMG.front0,[C[0]-sc/2,Y,C[2]+sc/2],[C[0]+sc/2,Y,C[2]+sc/2],[C[0]-sc/2,Y,C[2]-sc/2]);
    o+=img(IMG.left0,m3([X,C[1]+sc/2,C[2]+sc/2],fi3),m3([X,C[1]-sc/2,C[2]+sc/2],fi3),m3([X,C[1]+sc/2,C[2]-sc/2],fi3));
    o+=img(IMG.top,m1([C[0]-sc/2,C[1]+sc/2,Z0],fi1),m1([C[0]+sc/2,C[1]+sc/2,Z0],fi1),m1([C[0]-sc/2,C[1]-sc/2,Z0],fi1));
    /* оси: x (П₁/П₂), z (П₂/П₃), y на П₁ и на П₃ */
    let ax=''; const O=[X,Y,Z0], mv1=fi1>.01&&fi1<1.56, mv3=fi3>.01&&fi3<1.56; ax+=ln([xa,Y,Z0],O,mv1?'#9b2335':'#111',mv1?2.4:.7)+ln(O,[X,Y,zt],mv3?'#9b2335':'#111',mv3?2.4:.7)+ln(O,m1([X,ya,Z0],fi1),'#111',.7)+ln(O,m3([X,ya,Z0],fi3),'#111',.7);
    ax+=tx([xa,Y,Z0],'x','#111',-12,4,'igu-ax')+tx([X,Y,zt],'z','#111',-4,-6,'igu-ax')+tx(m1([X,ya,Z0],fi1),'y','#111',6,10,'igu-ax')+tx(m3([X,ya,Z0],fi3),'y','#111',6,14,'igu-ax')+tx(O,'O','#111',5,15,'igu-ax');
    if(axo>.01) o+=`<g opacity="${f(axo)}">${ax}</g>`;
    if(axo>.01) o+=`<g opacity="${f(axo)}">`+tx(P2[0],'П₂','#7a6440',6,-8,'igu-pl')+tx(P3[0],'П₃','#7a6440',-26,-8,'igu-pl')+tx(P1[0],'П₁','#7a6440',6,-8,'igu-pl')+'</g>';
    /* на листе вместо осей проекций — осевые и центровые линии (ГОСТ 2.303), как на чертеже ДЗ */
    if(dr>.01){ const z0=b[0][2], z1=b[1][2], r=Math.max(b[1][0],-b[0][0]), e=r+7, AX='10 3 2 3';
      const cl=(a,c)=>ln(a,c,'#111',.7,AX), t1=(x,y)=>m1([x,y,Z0],fi1);
      let a=cl([0,Y,z0-7],[0,Y,z1+7])+cl(m3([X,0,z0-7],fi3),m3([X,0,z1+7],fi3))+cl(t1(-e,0),t1(e,0))+cl(t1(0,-e),t1(0,e));
      const done={c:{},x:{},y:{}};
      holeAxes(model).forEach(h=>{ const R=Math.hypot(h.x,h.y), ux=h.x/R, uy=h.y/R, d=h.r+3;
        if(!done.c[R.toFixed(1)]){ done.c[R.toFixed(1)]=1; const n=72, pts=[]; for(let i=0;i<=n;i++){ const t=i/n*2*Math.PI; pts.push(P(t1(R*Math.cos(t),R*Math.sin(t)))); }
          a+=`<polyline points="${pts.map(q=>f(q[0])+','+f(q[1])).join(' ')}" fill="none" stroke="#111" stroke-width=".7" stroke-dasharray="${AX}"/>`; }
        a+=cl(t1(h.x-ux*d,h.y-uy*d),t1(h.x+ux*d,h.y+uy*d))+cl(t1(h.x+uy*d,h.y-ux*d),t1(h.x-uy*d,h.y+ux*d));
        const kx=h.x.toFixed(1); if(!done.x[kx]){ done.x[kx]=1; a+=cl([h.x,Y,h.z0-4],[h.x,Y,h.z1+4]); }
        const ky=h.y.toFixed(1); if(!done.y[ky]){ done.y[ky]=1; a+=cl(m3([X,h.y,h.z0-4],fi3),m3([X,h.y,h.z1+4],fi3)); } });
      o+=`<g opacity="${f(dr)}">${a}</g>`; }
    B.innerHTML=o;
    /* точка A, её проекции и лучи */
    const A2=[A[0],Y,A[2]], A3=m3([X,A[1],A[2]],fi3), A1=m1([A[0],A[1],Z0],fi1);
    
    let q='';
    if(ray>0){ const op=ray, L=(a,c)=>[a[0]+(c[0]-a[0])*proj,a[1]+(c[1]-a[1])*proj,a[2]+(c[2]-a[2])*proj]; q+=`<g opacity="${f(op)}">`+ln(A,L(A,A2),'#4f86c6',1,'5 4')+ln(A,L(A,[X,A[1],A[2]]),'#4f86c6',1,'5 4')+ln(A,L(A,[A[0],A[1],Z0]),'#4f86c6',1,'5 4')+`<circle cx="${f(P(A)[0])}" cy="${f(P(A)[1])}" r="4" fill="#9b2335"/>`+tx(A,NM,'#9b2335',7,-6,'igu-pt')+'</g>'; }
    /* связь через оси, без постоянной прямой и дуги: A″A′ — вертикаль, A″A‴ — горизонталь; глубина y одинакова на П₁ (от оси x) и на П₃ (от оси z) — отмечена засечками */
    if(link>0&&dr<.99){ const op=Math.min(1,link)*(1-dr), y1=[A[0],Y,Z0], y3=[X,Y,A[2]];
      const tk=(a,c)=>{ const p=P(a), r=P(c), dx=r[0]-p[0], dy=r[1]-p[1], l=Math.hypot(dx,dy)||1, nx=-dy/l*5, ny=dx/l*5; return [p,r].map(z=>`<line x1="${f(z[0]-nx)}" y1="${f(z[1]-ny)}" x2="${f(z[0]+nx)}" y2="${f(z[1]+ny)}" stroke="#4f86c6" stroke-width="1.2"/>`).join(''); };
      q+=`<g opacity="${f(op)}">`+ln(A2,A1,'#9dbbe0',.7)+ln(A2,A3,'#9dbbe0',.7)+ln(y1,A1,'#4f86c6',1.8)+ln(y3,A3,'#4f86c6',1.8)+tk(y1,A1)+tk(y3,A3)+tx(m1([A[0],(Y+A[1])/2,Z0],fi1),'y','#2f5f9e',-14,4,'igu-pt')+tx([X+(Y-A[1])/2,Y,A[2]],'y','#2f5f9e',-4,-8,'igu-pt')+'</g>'; }
    const dop=Math.max(0,(proj-.8)/.2)*(1-dr); if(dop>0.01) q+=`<g opacity="${f(dop)}">`+dot(A2,'#9b2335')+dot(A1,'#9b2335')+dot(A3,'#9b2335')+tx(A2,NM+'″','#9b2335',6,-6,'igu-pt')+tx(A1,NM+'′','#9b2335',6,14,'igu-pt')+tx(A3,NM+'‴','#9b2335',6,-6,'igu-pt')+'</g>';
    Fr.innerHTML=q; }
  const od=M.v.draw; M.v.draw=sc2=>{ if(fade<0.99) od(sc2); over(); };
  const CAPf=()=>{ const a=NM; return ['Деталь стоит в углу трёх плоскостей проекций: П₂ — сзади, П₁ — снизу, П₃ — справа. Берём точку '+a+'.',
    'Проецируем: лучи из '+a+' перпендикулярны плоскостям. На П₂ получается главный вид, на П₃ — вид слева, на П₁ — вид сверху. Каждая проекция помнит две координаты из трёх: '+a+'″ — x и z, '+a+'′ — x и y, '+a+'‴ — y и z.','Убираем деталь — на плоскостях остались только её изображения.',
    'Разворачиваем: П₁ — вниз вокруг оси x, П₃ — вправо вокруг оси z (оси поворота выделены красным). '+a+'″ и '+a+'′ встали на одну вертикаль (общая x), '+a+'″ и '+a+'‴ — на одну горизонталь (общая z); глубина y одинакова на виде сверху и на виде слева — её и отмеряют.',
    'Чертёж, как на листе: вид сверху — под главным видом, вид слева — справа от него. Осей проекций, плоскостей и точки '+a+' на листе нет — только виды и осевые линии (штрихпунктир).']; };
  const cap=host.querySelector('#iguCap'), rg=host.querySelector('#iguT'), pb=host.querySelector('#iguPlay');
  const ease=x=>x<=0?0:x>=1?1:x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2, win=(t,a,b)=>ease((t-a)/(b-a));
  function setT(t){ T=t; proj=win(t,.04,.2); shown=win(t,.1,.22); fade=win(t,.24,.38); ray=1-win(t,.3,.4); link=win(t,.7,.78); axo=1-win(t,.84,.95); dr=win(t,.86,.98);
    fi1=win(t,.4,.68)*Math.PI/2; fi3=win(t,.48,.76)*Math.PI/2; M.cv.style.opacity=String(1-fade);
    const k=win(t,.36,.9);
    if(k>0){ if(!cam0) cam0={yaw:S.yaw,pit:S.pit,zoom:S.zoom,tx:S.tx||0,ty:S.ty||0};
      const wid=(X+(Y-ya))-xa, hgt=zt-(Z0-(Y-ya)), cw=st.clientWidth, ch=st.clientHeight;
      const zf=S.R*2.25*Math.max(1,ch/cw)/(1.1*Math.max(hgt,wid*ch/cw)), cx=(xa+X+(Y-ya))/2, cz=(zt+Z0-(Y-ya))/2;
      let dy=0-cam0.yaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy));
      S.yaw=cam0.yaw+dy*k; S.pit=cam0.pit*(1-k)+1e-4*k; S.zoom=cam0.zoom+(zf-cam0.zoom)*k; S.tx=cam0.tx+(cx-C[0]-cam0.tx)*k; S.ty=cam0.ty+(cz-C[2]-cam0.ty)*k; }
    else if(cam0){ Object.assign(S,cam0); cam0=null; }
    const ph=t<.04?0:t<.3?1:t<.42?2:t<.83?3:4; host.querySelectorAll('.igu-ph button').forEach(x=>x.classList.toggle('on',+x.dataset.i===ph)); cap.textContent=CAPf()[ph];
    rg.value=Math.round(t*1000); M.v.draw(fade>.5?0.6:1.25); }
  let anim=0; const go=(to,ms)=>{ cancelAnimationFrame(anim); const t0=T, s0=performance.now(), D=ms||Math.max(800,Math.abs(to-t0)*17000);
    const stp=now=>{ const u=Math.min(1,(now-s0)/D); setT(t0+(to-t0)*u); if(u<1) anim=requestAnimationFrame(stp); else pb.textContent=T>=1?'↺':'▶'; }; pb.textContent='❚❚'; anim=requestAnimationFrame(stp); };
  pb.addEventListener('click',()=>{ if(pb.textContent==='❚❚'){ cancelAnimationFrame(anim); pb.textContent='▶'; return; } go(T>=1?0:1); });
  host.querySelectorAll('.igu-ph button').forEach(x=>x.addEventListener('click',()=>go([0,.21,.4,.8,1][+x.dataset.i])));
  rg.addEventListener('input',()=>{ cancelAnimationFrame(anim); pb.textContent='▶'; setT(rg.value/1000); });
  if(window.ResizeObserver) new ResizeObserver(()=>over()).observe(st);
  setTimeout(()=>setT(0),60);
  return {setPt(p,n){ A=p; NM=n; setT(T); },go};
}
/* очередь расчётов решения: чертежи видов, шаги, лист. В фоне не считаем — каждый кусок занимает браузер на полсекунды
   и больше (на телефоне — секунды): кнопки не нажимаются, деталь в 3D дёргается. Вкладка достраивает нужное сама,
   под панелью загрузки — need(). */
function solQueue(v,n,o){ const sp=igSpec(n), nv=parseInt(String(o.title).replace(/\D/g,''),10), hw=window.IG_VARS&&IG_VARS[nv]===n, D=(k,b)=>['dw',()=>IG3.drawing(n,k,900,0,b||0)];
  const Q=[D('front0'),D('top'),D(sp.fk,sp.xb),D(sp.lk,sp.yb),D('left0'),['kp',()=>keyPts(n)]];
  try{ IG3.features(n).forEach((f,i)=>Q.push(['st',()=>stepLines(n,i)])); }catch(e){}
  if(hw) Q.push(['sh',()=>nv===5&&window.IGL?IGL.sheet('clean'):IGS.sheet(nv,'clean')],['sh',()=>nv===5&&window.IGL?IGL.sheet('draft'):IGS.sheet(nv,'draft')]);
  return {left:gs=>Q.filter(q=>gs.includes(q[0])).length,
    /* достроить нужное по кускам; между кусками браузер успевает перерисовать панель загрузки */
    async need(gs,step,alive){ for(const q of Q.filter(q=>gs.includes(q[0]))){ await frame(); if(alive&&!alive()) return; const k=Q.indexOf(q); if(k<0) continue; Q.splice(k,1); try{ q[1](); }catch(e){} step&&step(); } }}; }
/* следующий кус работы — после кадра (панель загрузки успевает перерисоваться) или через 100 мс, что раньше: в фоновой вкладке
   requestAnimationFrame не вызывается, и без запасного таймера лист не достраивался, пока вкладку не открыть снова */
const frame=()=>new Promise(r=>{ let done=false; const go=()=>{ if(done) return; done=true; setTimeout(r,0); }; requestAnimationFrame(go); setTimeout(go,100); });
/* панель загрузки поверх вкладки: пока считается, деталь и чертёж не трогаем — крутилка и полоска показывают, что идёт работа */
function loading(host,title,sub){ const el=document.createElement('div'); el.className='igx-ld'; el.setAttribute('role','status');
  el.innerHTML=`<div class="igx-ld-c"><span class="igx-ld-sp" aria-hidden="true"></span><b>${title}</b><small>${sub||'Подожди пару секунд — откроется само'}</small><span class="igx-ld-bar" aria-hidden="true"><i></i></span></div>`;
  host.classList.add('igx-ldh'); host.appendChild(el); const bar=el.querySelector('i');
  return {p(k,N){ bar.style.transform='scaleX('+Math.max(.04,Math.min(1,k/N)).toFixed(3)+')'; },
    done(){ host.classList.remove('igx-ldh'); el.classList.add('out'); setTimeout(()=>el.remove(),260); }}; }
function partPage(v,o){
  const n=o.model;
  v.innerHTML=pageHTML({crumbs:o.crumbs,next:null,noBottom:true,cls:'igx',body:`
   ${o.head||`<a class="igx-back" href="${o.back[0]}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>${o.back[1]}</a>
   <div class="igx-vh"><h1>${o.title}</h1>${o.star||''}</div>`}${o.beta!=null?o.beta:IGBETA()}
   <section class="igx-task"><div class="igx-task-t"><span class="igx-k">Задание${o.fig?' · '+o.fig:''}</span><p>${o.q||''}</p></div>
    <div class="igx-given" id="igGiven">${o.img?`<div class="igx-dwg igx-orig"><img src="${o.img}" alt="Чертёж задания" decoding="async"></div>`:'<div class="igx-given-l">Строю данные изображения…</div>'}</div></section>
   ${o.learn?`<a class="igx-xl" href="${H('ig','learn')}"><b>Как это строится?</b> Разбор по шагам: вид слева, разрезы, сечение А–А →</a><a class="igx-xl igp-go" href="${H('ig','points')}"><b>Защита листа:</b> как найти две недостающие проекции точки →</a>`:''}
   <div class="igx-reveal"><button class="igx-sol-btn" id="igShow"><span>Показать решение</span><small>по шагам, в 3D и готовый лист</small></button></div>
   <div id="igSol" hidden>
    <div class="igx-tabs" role="tablist"><button role="tab" data-t="3d" class="on" aria-selected="true">3D</button><button role="tab" data-t="unf" aria-selected="false">Развёртка</button><button role="tab" data-t="steps" aria-selected="false">По шагам</button><button role="tab" data-t="sheet" aria-selected="false">Лист</button></div>
    <section class="igb" data-p="steps" id="igBuild" aria-label="Построение по шагам" hidden></section>
    <section data-p="unf" id="igUnf" hidden></section>
    <section data-p="3d">
     <div class="igx-modes" role="tablist" aria-label="Режим">${[['cut','Разрез'],['part','Деталь']].concat(n.sec?[['sec','Сечение '+secL(n)+'–'+secL(n)]]:[]).map((m,i)=>`<button role="tab" data-m="${m[0]}" class="${i===0?'on':''}" aria-selected="${i===0}">${m[1]}</button>`).join('')}</div>
     <div class="igx-stage" id="igStage">${hasGL?'':'<div class="igx-nogl">Браузер не поддерживает WebGL — 3D недоступно. Попробуй Chrome или Safari.</div>'}<button type="button" class="igx-spb on" id="igSpBtn" aria-pressed="true" title="Точка A в пространстве и её проекции">Точка A</button><div class="igx-hint">тяни — вращать · двумя пальцами — зум</div></div>
     <p class="igx-mcap" id="igMcap"></p>
    </section>
    <section data-p="sheet" hidden><div class="igx-dwg igx-sheetbox" id="igSheetBox"></div><p class="igx-mcap" id="igSheetCap"></p></section>
    ${o.bottom||''}</div>`});
  const st0=$(v,'#igStar'); if(st0) st0.addEventListener('click',()=>{ const on=!st0.classList.contains('on'); try{ if(on) localStorage.setItem('nch2_igvar',String(parseInt(o.title.replace(/\D/g,''),10))); else localStorage.removeItem('nch2_igvar'); }catch(e){}
    st0.classList.toggle('on',on); st0.setAttribute('aria-pressed',on); st0.textContent=on?'★ Мой вариант':'☆ Мой вариант'; try{ FX.buzz&&FX.buzz(6); }catch(e){} });
  if(!o.img) setTimeout(()=>{ const g=$(v,'#igGiven'); if(!g||!g.isConnected) return; let svg=''; try{ svg=hasGL?sheetSVG(n,'','','','given'):''; }catch(e){ console.error(e); }
    g.innerHTML=svg?`<div class="igx-dwg">${svg}</div>`:'<div class="igx-given-l">Изображения не построились на этом устройстве.</div>'; },30);
  const KEY='igsol:'+location.hash, show=()=>{ $(v,'#igSol').hidden=false; $(v,'.igx-reveal').hidden=true; try{ sessionStorage.setItem(KEY,'1'); }catch(e){} startSol(); };
  $(v,'#igShow').addEventListener('click',()=>{ show(); setTimeout(()=>{ const t=$(v,'.igx-tabs'); t&&t.scrollIntoView({behavior:'smooth',block:'start'}); },60); });
  const CAP={cut:'Четверть детали вырезана — видно, что внутри. Штриховка — там, где прошла секущая плоскость.',part:'Деталь целиком.',
    sec:'Наклонная секущая плоскость срезала деталь. Заштрихованная фигура — то самое сечение, которое строится на листе.'};
  let started=false, M=null, sheetDone=false, unfDone=false, stepsDone=false;
  function tab(t){ v.querySelectorAll('.igx-tabs button').forEach(b=>{ const on=b.dataset.t===t; b.classList.toggle('on',on); b.setAttribute('aria-selected',on); });
    v.querySelectorAll('#igSol [data-p]').forEach(x=>x.hidden=x.dataset.p!==t);
    if(t==='3d') start3d(); if(t==='sheet') startSheet(); if(t==='unf'&&!unfDone){ unfDone=true; later($(v,'#igUnf'),'Готовлю развёртку',['dw'],()=>mountUnfold($(v,'#igUnf'),n)); } if(t==='steps'&&!stepsDone){ stepsDone=true; later($(v,'#igBuild'),'Готовлю построение по шагам',['dw','st'],()=>buildBlock($(v,'#igBuild'),n,o)); } try{ sessionStorage.setItem(KEY+':t',t); }catch(e){} }
  v.querySelectorAll('.igx-tabs button').forEach(b=>b.addEventListener('click',()=>{ tab(b.dataset.t); try{ FX.buzz&&FX.buzz(6); }catch(e){} }));
  /* вкладка открывается сразу; чего не хватает — достраиваем под панелью загрузки, по кускам, потом собираем вкладку */
  function later(host,title,gs,f){ const L=loading(host,title,'Считаю чертежи видов — на телефоне это может занять до полминуты. Откроется само'), N=PW.left(gs)+1; let k=0; L.p(0,N);
    const alive=()=>host.isConnected;   /* ушли со страницы, пока считалось, — дальше не строим */
    PW.need(gs,()=>L.p(++k,N),alive).then(frame).then(()=>{ if(!alive()) return; try{ f(); }catch(e){ console.error(e); } L.p(N,N); return frame(); }).then(()=>L.done()); }
  function startSheet(){ if(sheetDone) return; sheetDone=true; later($(v,'#igSheetBox').parentNode,'Готовлю лист',['dw','sh'],sheetNow); }
  function sheetNow(){
    /* чистовик и черновик — как на образце; вариант 5 разобран в «Обучении» по шагам — тот же лист */
    const nv=parseInt(String(o.title).replace(/\D/g,''),10), box=$(v,'#igSheetBox'), sp=igSpec(n), tt={half:'половина вида и половина разреза',view:'вид, невидимый контур — штриховыми',full:'полный разрез'};
    const CAP={clean:'Чистовик. Главный вид — '+tt[sp.F]+'; вид слева — '+tt[sp.L]+'; вид сверху'+(n.hz?(sp.H==='full'?' — полный горизонтальный разрез':' — половина вида и половина горизонтального разреза'+(sp.H==='halfD'?' (разрез снизу: справа от вертикальной оси нельзя)':'')):'')+'. Размеры — из задания.',
      draft:'Черновик. Те же изображения и сечение '+secL(n)+'–'+secL(n)+' в натуральную величину: оно стоит по направлению стрелок, точки переносятся перпендикулярно следу. Точка n″ на следе → n′ на виде сверху (линия связи) → n₁ в сечении (глубина та же, что на виде сверху).'};
    const own=o.sheet, hw=!own&&window.IG_VARS&&IG_VARS[nv]===n, make=m=>{ try{ return own?own(m):hw&&nv===5&&window.IGL?IGL.sheet(m):hw&&window.IGS?IGS.sheet(nv,m):m==='clean'?sheetSVG(n,(o.tb||{}).name||o.title,(o.tb||{}).sub||'Построение изображений',(o.tb||{}).task||'Задание №2'):''; }catch(e){ console.error(e); return ''; } };
    /* «Читаю чертёж»: нажатая линия подсвечивается на всех видах (IGREAD) */
    const rdw=document.createElement('div'); rdw.className='rd-bar'; rdw.innerHTML='<button class="rd-b" id="igRd" aria-pressed="false"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5a2 2 0 0 1 4 0v5"/><path d="M13 10V8a2 2 0 0 1 4 0v4"/><path d="M17 12a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L4 15a2 2 0 0 1 3.4-2L9 15"/></svg>Читаю чертёж</button><span class="rd-hint">нажми на линию — увидишь её на всех видах</span><div class="rd-cap" id="igRdCap" aria-live="polite"></div>';
    box.parentNode.insertBefore(rdw,box); const RD=window.IGREAD?IGREAD.attach(box,n,$(v,'#igRdCap')):null;
    $(v,'#igRd').addEventListener('click',e=>{ const on=e.currentTarget.getAttribute('aria-pressed')!=='true'; e.currentTarget.setAttribute('aria-pressed',on); e.currentTarget.classList.toggle('on',on); RD&&RD.set(on); try{ TRACK&&TRACK('ig_read',{on:on?1:0}); }catch(e2){} });
    const pick=m=>{ const s2=make(m); box.innerHTML=s2||'<div class="igx-given-l">Лист не построился на этом устройстве.</div>'; RD&&RD.refresh();
      v.querySelectorAll('#igSheetSw button').forEach(x=>{ const on=x.dataset.s===m; x.classList.toggle('on',on); x.setAttribute('aria-selected',on); }); $(v,'#igSheetCap').textContent=CAP[m]; };
    if(!hw&&!own){ pick('clean'); $(v,'#igSheetCap').textContent=CAP.clean.replace(/ Размеры — из задания\./,''); return; }
    box.insertAdjacentHTML('beforebegin','<div class="igx-modes" id="igSheetSw" role="tablist" aria-label="Лист"><button role="tab" data-s="clean">Чистовик</button><button role="tab" data-s="draft">Черновик</button></div>');
    v.querySelectorAll('#igSheetSw button').forEach(x=>x.addEventListener('click',()=>{ pick(x.dataset.s); try{ FX.buzz&&FX.buzz(6); }catch(e){} }));
    pick('clean'); }
  const PW=solQueue(v,n,o);

  /* точка в пространстве поверх 3D: A, три её проекции и лучи к плоскостям проекций (плоскости — еле заметные) */
  function spaceOverlay(st,M,model){
    const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg'); svg.setAttribute('class','igx-sp'); svg.setAttribute('aria-hidden','true'); st.appendChild(svg);
    const b=model.box, S=M.S, C=S.C, g=S.R*0.22, X=b[1][0]+g, Y=b[1][1]+g, Z0=b[0][2]-g, xa=b[0][0]-g, ya=b[0][1]-g, zt=b[1][2]+g;
    const kp=keyPts(model).filter(p=>p.y<0).sort((p,q)=>q.z-p.z||p.y-q.y), A=kp.length?[kp[0].x,kp[0].y,kp[0].z]:[C[0],b[0][1],b[1][2]];
    const A2=[A[0],Y,A[2]], A1=[A[0],A[1],Z0], A3=[X,A[1],A[2]];
    let on=true; const f=v=>Math.round(v*10)/10;
    function cam(){ const cy=Math.cos(S.yaw), sy=Math.sin(S.yaw), cp=Math.cos(S.pit), sp=Math.sin(S.pit), F=[sy*cp,cy*cp,-sp];
      let R=[F[1],-F[0],0]; const l=Math.hypot(R[0],R[1])||1; R=[R[0]/l,R[1]/l,0]; const U=[R[1]*F[2]-R[2]*F[1],R[2]*F[0]-R[0]*F[2],R[0]*F[1]-R[1]*F[0]];
      const w=st.clientWidth, h=st.clientHeight, us=S.R*2.25/S.zoom*Math.max(1,h/w), tx=S.tx||0, ty=S.ty||0, Cc=[C[0]+tx*R[0]+ty*U[0],C[1]+tx*R[1]+ty*U[1],C[2]+tx*R[2]+ty*U[2]];
      return {w,h,P:p=>{ const d=[p[0]-Cc[0],p[1]-Cc[1],p[2]-Cc[2]]; return [w/2+(d[0]*R[0]+d[1]*R[1]+d[2]*R[2])/us*h, h/2-(d[0]*U[0]+d[1]*U[1]+d[2]*U[2])/us*h]; }}; }
    function paint(){ if(!on||!st.clientWidth||!st.clientHeight){ svg.innerHTML=''; return; } const {w,h,P}=cam(); svg.setAttribute('viewBox','0 0 '+w+' '+h);
      const poly=ps=>`<polygon points="${ps.map(P).map(q=>f(q[0])+','+f(q[1])).join(' ')}" fill="#cdb67f" fill-opacity=".10" stroke="#8a7442" stroke-opacity=".28" stroke-width="1"/>`;
      const ln=(a,c,cl,wd,dash)=>{ const p=P(a), q=P(c); return `<line x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}" stroke="${cl}" stroke-width="${wd}"${dash?` stroke-dasharray="${dash}"`:''} stroke-linecap="round"/>`; };
      const dot=(p,cl,hol)=>{ const q=P(p); return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${hol?3:4}" fill="${hol?'#fff':cl}" stroke="${cl}" stroke-width="1.6"/>`; };
      const tx=(p,t,dx,dy)=>{ const q=P(p); return `<text x="${f(q[0]+dx)}" y="${f(q[1]+dy)}" class="igu-pt" fill="#9b2335">${t}</text>`; };
      let o=poly([[xa,Y,Z0],[X,Y,Z0],[X,Y,zt],[xa,Y,zt]])+poly([[xa,ya,Z0],[X,ya,Z0],[X,Y,Z0],[xa,Y,Z0]])+poly([[X,ya,Z0],[X,Y,Z0],[X,Y,zt],[X,ya,zt]]);
      o+=ln(A,A2,'#4f86c6',1.2,'5 4')+ln(A,A1,'#4f86c6',1.2,'5 4')+ln(A,A3,'#4f86c6',1.2,'5 4');
      o+=dot(A2,'#9b2335',1)+dot(A1,'#9b2335',1)+dot(A3,'#9b2335',1)+dot(A,'#9b2335')+tx(A,'A',7,-6)+tx(A2,'A″',6,-6)+tx(A1,'A′',6,14)+tx(A3,'A‴',6,-6);
      svg.innerHTML=o; }
    const od=M.v.draw; M.v.draw=sc=>{ od(sc); paint(); };
    if(window.ResizeObserver) new ResizeObserver(paint).observe(st);
    paint();
    return {set(v){ on=v; paint(); },get on(){ return on; }};
  }
  let m3=false;
  function start3d(){ if(m3||!hasGL) return; m3=true; const st=$(v,'#igStage'), L=loading(st,'Собираю 3D-модель'); L.p(0,3);
    const go=f=>()=>{ if(!st.isConnected) return Promise.reject(0); try{ f(); }catch(e){ console.error(e); } return frame(); };   /* ушли со страницы — дальше не строим */
    frame().then(go(()=>{ IG3.prep(n); L.p(1,3); })).then(go(()=>{ IG3.prep(n,'lines'); L.p(2,3); }))
      .then(go(()=>mount3d(st)))   /* первый кадр с разрезом — тоже под панелью */
      .then(()=>{ L.p(3,3); return frame(); }).then(()=>L.done(),()=>{}); }
  function mount3d(st){
    M=mountViewer(st,n,{state:{cut:1},onTouch:()=>{ const h=$(v,'.igx-hint'); if(h) h.style.opacity=0; }});
    if(!M){ st.insertAdjacentHTML('afterbegin','<div class="igx-nogl">Не удалось запустить 3D на этом устройстве.</div>'); return; }
    $(v,'#igMcap').textContent=CAP.cut;
    try{ const sp=spaceOverlay(st,M,n), tb=$(v,'#igSpBtn'); if(tb) tb.addEventListener('click',()=>{ const on=!sp.on; sp.set(on); tb.setAttribute('aria-pressed',on); tb.classList.toggle('on',on); }); }catch(e){ console.error(e); }
    const SP=n.sec?(()=>{ const [[x1,z1],[x2,z2]]=n.sec.p, t=Math.atan2(z2-z1,x2-x1), nx=-Math.sin(t), nz=Math.cos(t); return {pl:[nx,0,nz,nx*x1+nz*z1],t}; })():null;
    v.querySelectorAll('.igx-modes button').forEach(b=>b.addEventListener('click',()=>{ const m=b.dataset.m;
      v.querySelectorAll('.igx-modes button').forEach(x=>{ x.classList.toggle('on',x===b); x.setAttribute('aria-selected',x===b); });
      M.S.res=1; M.S.cut={cut:1,part:0,sec:4}[m]; M.S.pl=m==='sec'?SP.pl:[0,0,1,0]; $(v,'#igMcap').textContent=CAP[m];
      if(m==='sec') M.to({yaw:Math.PI/2-0.55,pit:Math.PI/2-SP.t-0.12,zoom:1});
      else M.to({yaw:-0.62,pit:0.42,zoom:1});
      try{ FX.buzz&&FX.buzz(6); }catch(e){} })); }
  function startSol(){ if(started) return; started=true; let t0='3d'; try{ t0=sessionStorage.getItem(KEY+':t')||'3d'; }catch(e){} tab(t0); }
  try{ if(sessionStorage.getItem(KEY)) show(); }catch(e){}
  NEXT=null; return o.docTitle;
}
/* ── тетрадь и теория ИГ ── */
function wbList(v){
  v.innerHTML=pageHTML({crumbs:[[SUBJ.ig.name,H('ig')],['Тетрадь']],next:null,noBottom:true,cls:'igx',body:`
   <div class="intro"><h1>Рабочая тетрадь · раздел 5</h1><p class="lead">«Изображение геометрических фигур с построением линий пересечения проецирующими плоскостями». Найди задание по номеру рисунка — на карточке то, что дано в тетради. Решение откроется внутри.</p></div>${IGBETA()}
   <div class="igx-wbl">${IG_WB.map(t=>`<a class="igx-wbc" href="${H('ig','wb',t.n)}"><span class="igx-wbn"><b>Рис. ${t.fig}</b><i>стр. ${t.page}</i></span><span class="igx-wbi"><img alt="" data-w="${t.n}"></span><span class="igx-wbt"><b>${t.n}. ${t.title}</b><small>${t.q}</small></span></a>`).join('')}</div>
`});
  if(hasGL){ let i=0; const step=()=>{ if(i>=IG_WB.length||!v.isConnected) return; const t=IG_WB[i++];
      try{ const d=IG3.drawing(t,'front0',360); const im=v.querySelector('img[data-w="'+t.n+'"]'); if(im&&d) im.src=d.url; }catch(e){}
      setTimeout(step,20); }; setTimeout(step,30); }
  NEXT=null; return 'Тетрадь · '+SUBJ.ig.name;
}
function wbItem(v,n){
  const i=IG_WB.findIndex(t=>t.n===n); if(i<0){ setTimeout(()=>redir(H('ig','wb')),0); return 'Тетрадь'; }
  const t=IG_WB[i], L=IG_WB.length;
  return partPage(v,{model:t,crumbs:[[SUBJ.ig.name,H('ig')],['Тетрадь',H('ig','wb')],['Задание '+t.n]],title:'Задание '+t.n+'. '+t.title,
    back:[H('ig','wb'),'Все задания'],docTitle:'Задание '+t.n+' · Тетрадь · '+SUBJ.ig.name,
    tb:{name:'Задание '+t.n,sub:t.title,task:'Тетрадь, р. 5'},
    q:t.q, fig:'рис. '+t.fig+', стр. '+t.page,
    bottom:`<div class="igx-why"><b>Как получается ответ.</b> ${t.why}</div>`,
    note:''});
}
const TH=[
 {id:'eskd',t:'ЕСКД',b:`<p><b>ЕСКД</b> — Единая система конструкторской документации: комплекс государственных стандартов с общими правилами разработки, оформления и обращения чертежей и других конструкторских документов. Стандарты разбиты на 10 классификационных групп (0–9).</p>
   <p>Обозначение стандарта читается так: <b>ГОСТ 2.303–68</b> — «2» — комплекс ЕСКД, «3» — группа (общие правила выполнения чертежей), «03» — номер стандарта в группе, «68» — год утверждения.</p>`},
 {id:'format',t:'Форматы',b:`<p>Формат — размер листа по внешней рамке (ГОСТ 2.301). Основной ряд получают делением листа А0 площадью 1 м² пополам; стороны всех форматов относятся как 1 : √2.</p>
   <table class="igx-t"><tr><th>Формат</th><th>Размеры, мм</th></tr><tr><td>А0</td><td>841 × 1189</td></tr><tr><td>А1</td><td>594 × 841</td></tr><tr><td>А2</td><td>420 × 594</td></tr><tr><td>А3</td><td>297 × 420</td></tr><tr><td>А4</td><td>210 × 297</td></tr></table>
   <p>Рамка поля чертежа: слева 20 мм (для подшивки), с остальных сторон 5 мм. Основная надпись — в правом нижнем углу; на А4 — только вдоль короткой стороны.</p>`},
 {id:'scale',t:'Масштабы',b:`<p>Масштаб — отношение линейного размера на чертеже к действительному (ГОСТ 2.302).</p>
   <p><b>Уменьшения:</b> 1:2; 1:2,5; 1:4; 1:5; 1:10; 1:15; 1:20 … <b>Натуральная величина:</b> 1:1. <b>Увеличения:</b> 2:1; 2,5:1; 4:1; 5:1; 10:1; 20:1 …</p>
   <p>Размеры на чертеже всегда проставляют <b>действительные</b>, в каком бы масштабе ни было изображение.</p>`},
 {id:'lines',t:'Линии',b:`<p>Типы линий — ГОСТ 2.303. Толщина основной линии s = 0,5…1,4 мм; остальные выражаются через s.</p>
   <table class="igx-t"><tr><th>Линия</th><th>Толщина</th><th>Для чего</th></tr>
   <tr><td>Сплошная толстая основная</td><td>s</td><td>видимый контур</td></tr>
   <tr><td>Сплошная тонкая</td><td>s/3…s/2</td><td>размерные и выносные, штриховка, линии-выноски</td></tr>
   <tr><td>Сплошная волнистая</td><td>s/3…s/2</td><td>обрыв, граница вида и разреза</td></tr>
   <tr><td>Штриховая</td><td>s/3…s/2</td><td>невидимый контур (штрихи 2…8, промежутки 1…2 мм)</td></tr>
   <tr><td>Штрихпунктирная тонкая</td><td>s/3…s/2</td><td>осевые и центровые (штрихи 5…30, промежутки 3…5 мм)</td></tr>
   <tr><td>Штрихпунктирная утолщённая</td><td>s/2…2s/3</td><td>элементы перед секущей плоскостью</td></tr>
   <tr><td>Разомкнутая</td><td>s…1,5s</td><td>линии сечений (штрихи 8…20 мм)</td></tr>
   <tr><td>Сплошная тонкая с изломами</td><td>s/3…s/2</td><td>длинные линии обрыва</td></tr></table>
   <p>Осевые выходят за контур на 2…5 мм и пересекаются штрихами, а не точками. Если диаметр окружности (или размер другой фигуры) на изображении меньше 12 мм, центровые штрихпунктирные заменяют сплошными тонкими.</p>`},
 {id:'font',t:'Шрифты',b:`<p>Шрифт — ГОСТ 2.304. Размер шрифта h — высота прописных букв в мм: 2,5; 3,5; 5; 7; 10; 14; 20; 28; 40. Строчные буквы — на шаг меньше (примерно 0,7h).</p>
   <p>Два типа: <b>А</b> (толщина линии h/14) и <b>Б</b> (h/10). Шрифт бывает с наклоном 75° к основанию строки и без наклона. На учебных чертежах — тип Б с наклоном; надписи над видами и разрезами (А–А) — шрифт 7.</p>`},
 {id:'dims',t:'Размеры',b:`<p>Размеры — ГОСТ 2.307. Размерные числа — действительные размеры в миллиметрах, без единиц; углы — в градусах. Общее число размеров — минимальное, но достаточное для изготовления.</p>
   <ul><li>Размерная линия отстоит от контура не меньше чем на 10 мм, параллельные размерные линии — друг от друга на 7…10 мм.</li>
   <li>Выносные линии выходят за размерную на 1…5 мм.</li><li>Стрелки — 2,5…5 мм, одинаковые по всему чертежу.</li>
   <li>Знаки перед числом: Ø — диаметр, R — радиус, □ — квадрат; для шара пишут «Сфера Ø20»; ∠ — уклон, ▷ — конусность.</li>
   <li>Размерные числа не пересекают никакими линиями; осевые в месте числа прерывают.</li>
   <li>Одинаковые элементы (отверстия) образмеривают один раз с указанием количества: «4 отв. Ø10».</li></ul>`},
 {id:'views',t:'Виды',b:`<p><b>Вид</b> — изображение обращённой к наблюдателю видимой части поверхности предмета (ГОСТ 2.305). Допускается показывать невидимые части штриховыми линиями, если это сокращает число изображений.</p>
   <p>Шесть <b>основных видов</b> получают проецированием на грани куба: спереди (главный), сверху, слева, справа, снизу, сзади. Вид сверху располагают под главным, вид слева — справа от главного, в проекционной связи; такие виды не подписывают.</p>
   <p><b>Главный вид</b> выбирают так, чтобы он давал наиболее полное представление о форме и размерах. Если вид не в проекционной связи, его обозначают стрелкой и буквой («А»). <b>Дополнительный вид</b> — на плоскость, не параллельную основным; <b>местный</b> — отдельный ограниченный участок.</p>`},
 {id:'cuts',t:'Разрезы',b:`<p><b>Разрез</b> — изображение предмета, мысленно рассечённого плоскостью: показывают то, что в плоскости, и то, что за ней. <b>Сечение</b> — только то, что в самой плоскости.</p>
   <p>По положению секущей плоскости: <b>горизонтальные</b> (∥ π₁), <b>вертикальные</b> — фронтальные (∥ π₂) и профильные (∥ π₃), <b>наклонные</b>. По числу плоскостей: <b>простые</b> и <b>сложные</b> — ступенчатые (плоскости параллельны) и ломаные (пересекаются). <b>Местный</b> разрез отделяют волнистой линией.</p>
   <p>Если секущая плоскость совпадает с плоскостью симметрии и разрез стоит в проекционной связи, его <b>не обозначают</b>. Иначе положение плоскости показывают разомкнутой линией со стрелками и буквами, а над разрезом пишут «А–А».</p>
   <p>Для симметричной детали соединяют <b>половину вида и половину разреза</b>; граница — ось симметрии (разрез — справа от вертикальной оси или снизу от горизонтальной). Если на ось попадает ребро, границу проводят волнистой линией так, чтобы ребро было видно: внутреннее — в разрезе, наружное — на виде. На половине вида невидимый контур (штриховые) не проводят — внутреннее устройство уже показано разрезом. Тонкие стенки и рёбра, рассечённые вдоль, не штрихуют.</p>
   <p><b>Отверстия на круглом фланце</b>, не попавшие в секущую плоскость, показывают в разрезе как попавшие в неё: отверстие мысленно поворачивают вокруг оси детали до плоскости разреза — в разрезе оно стоит на своём радиусе (на окружности центров), а не на месте своей проекции. Ось отверстия — штрихпунктир.</p>`},
 {id:'sect',t:'Сечения',b:`<p>Сечения бывают <b>вынесенные</b> (контур — основной линией, предпочтительны) и <b>наложенные</b> (контур — тонкой линией, прямо на виде). Обозначают так же, как разрезы. Симметричное сечение, наложенное или вынесенное на продолжение следа секущей плоскости, не обозначают: показывают только его ось симметрии штрихпунктирной линией.</p>
   <p>Если плоскость проходит через ось отверстия или углубления — тела вращения, его контур в сечении показывают полностью. Если сечение распадается на отдельные части, применяют разрез.</p>
   <p>В ДЗ сечение А–А строят наклонной плоскостью: фигуру сечения выносят и строят в <b>натуральную величину</b> — расстояния вдоль следа плоскости снимают с главного вида, поперечные — с вида сверху.</p>`},
 {id:'hatch',t:'Штриховка',b:`<p>Материалы в сечениях — ГОСТ 2.306. Металлы — штриховка тонкими параллельными линиями под <b>45°</b> к рамке или к оси изображения; неметаллы — сеткой из двух направлений.</p>
   <p>Расстояние между линиями — 1…10 мм, одинаковое для всех сечений одной детали (на учебных чертежах 2…3 мм). Наклон и шаг на всех разрезах и сечениях одной детали — одни и те же. Если линии штриховки совпали бы с контуром или осью, берут 30° или 60°.</p>`}
];
function theory(v,id){
  const cur=TH.find(x=>x.id===id)||null;
  v.innerHTML=pageHTML({crumbs:cur?[[SUBJ.ig.name,H('ig')],['Теория',H('ig','theory')],[cur.t]]:[[SUBJ.ig.name,H('ig')],['Теория']],next:null,noBottom:true,cls:'igx',body:`
   <div class="intro"><h1>${cur?cur.t:'Теория'}</h1>${cur?'':'<p class="lead">Всё, что нужно для ДЗ и РК по оформлению и изображениям — коротко, по стандартам ЕСКД.</p>'}</div>
   <nav class="igx-th-nav" aria-label="Темы">${TH.map(x=>`<a href="${H('ig','theory',x.id)}" class="${cur&&cur.id===x.id?'on':''}">${x.t}</a>`).join('')}</nav>
   ${cur?`<article class="igx-th">${cur.b}</article>`:`<div class="igx-th-list">${TH.map(x=>`<section class="igx-th" id="th-${x.id}"><h2>${x.t}</h2>${x.b}</section>`).join('')}</div>`}
   ${cur?'':`<p class="igx-nk-l">Проверить себя на оформлении: <a href="${H('ig','nk')}">тренажёр «Нормоконтроль» — найди нарушение ГОСТ на готовом листе</a>.</p>`}`});
  NEXT=null; return (cur?cur.t+' · ':'')+'Теория · '+SUBJ.ig.name;
}
function view(v,r){
  if(r.tab==='wb') return r.item?wbItem(v,parseInt(r.item,10)):wbList(v);
  if(r.tab==='theory') return theory(v,r.item);
  if(r.tab==='learn'&&window.IGL) return IGL.view(v,r.item);
  if(r.tab==='points'&&window.IGL) return IGL.points(v);
  if(r.tab==='nk'&&window.IGNK) return IGNK.view(v,r.item);
  return home(v);
}
return {view,TH,mountViewer,sheetImages,keyPts,mountUnfold,buildBlock,igSpec,wavy,secMark,hatchDeg,hasGL,stepLines,letters,fDes,pDes,holeAxes,holeAxesFL,axDash,axCircle,axLine,secRot,loading,frame,sheetSVGgiven:n=>sheetSVG(IG_VARS[n],'','','','given'),partPage,sheetSVG};
})();
