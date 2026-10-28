/* ═══════════ ДЗ №4 · ядро: тела, их поверхности и линии пересечения ═══════════
   Тело — сплошное: inside(p) (точка внутри) и куски поверхности (patches). Кусок поверхности задан параметрически
   P(a, b) на прямоугольнике [A0, A1] × [B0, B1] и неявно f(p) = 0 (для поиска общих точек с другим телом).
   Линия пересечения тел A и B — нулевое множество f_B на сетке параметров куска A (квадраты, уточнение делением
   пополам), из которого оставлены точки, лежащие на границе обоих тел и не утонувшие в третьем теле.
   Контурные линии (очерки) — где нормаль поверхности ⟂ направлению взгляда; рёбра — заданы телом.
   Видимость — лучом от точки к наблюдателю (спереди — вдоль +y, сверху — вдоль +z).
   Пространство как во всём курсе: x — влево от O, y — к зрителю, z — вверх (мм). */
(function(){
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]), unit=a=>{ const l=len(a)||1; return [a[0]/l,a[1]/l,a[2]/l]; }, lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const dist=(a,b)=>len(sub(a,b));
const segDist=(p,a,b)=>{ const d=sub(b,a), L=dot(d,d); const t=L<1e-12?0:Math.max(0,Math.min(1,dot(sub(p,a),d)/L)); return dist(p,add(a,mul(d,t))); };
/* базис плоскости ⟂ оси d: e1, e2 */
function frame(d){ d=unit(d); const t=Math.abs(d[2])<0.9?[0,0,1]:[1,0,0], e1=unit(cross(t,d)), e2=cross(d,e1); return [e1,e2,d]; }
const grad=(f,p)=>{ const h=1e-4; return [(f([p[0]+h,p[1],p[2]])-f([p[0]-h,p[1],p[2]]))/(2*h),(f([p[0],p[1]+h,p[2]])-f([p[0],p[1]-h,p[2]]))/(2*h),(f([p[0],p[1],p[2]+h])-f([p[0],p[1],p[2]-h]))/(2*h)]; };

/* ── куски поверхностей ── */
/* сфера: a — долгота, b — широта */
const sphere=(c,R,A,B)=>({kind:'sph',c,R,A:A||[0,2*Math.PI],B:B||[0,Math.PI/2],per:!A,
  P:(a,b)=>[c[0]+R*Math.cos(b)*Math.cos(a),c[1]+R*Math.cos(b)*Math.sin(a),c[2]+R*Math.sin(b)], f:p=>dist(p,c)-R});
/* цилиндр: ось o + t·d, радиус r; a — угол, b — t */
function cylinder(o,d,r,t0,t1,A,E1){ const [e1,e2,dd]=E1?[E1,cross(unit(d),E1),unit(d)]:frame(d);
  return {kind:'cyl',o,d:dd,r,A:A||[0,2*Math.PI],B:[t0,t1],per:!A,
    P:(a,t)=>add(add(o,mul(dd,t)),add(mul(e1,r*Math.cos(a)),mul(e2,r*Math.sin(a)))),
    f:p=>{ const q=sub(p,o), h=dot(q,dd); return len(sub(q,mul(dd,h)))-r; }}; }
/* прямой круговой конус: на оси o + t·d радиус r0 при t0 и r1 при t1 */
function cone(o,d,r0,r1,t0,t1){ const [e1,e2,dd]=frame(d), k=(r1-r0)/(t1-t0), rr=t=>r0+k*(t-t0), cs=1/Math.sqrt(1+k*k);
  return {kind:'cone',o,d:dd,r0,r1,t0,t1,A:[0,2*Math.PI],B:[t0,t1],per:true,
    P:(a,t)=>add(add(o,mul(dd,t)),add(mul(e1,rr(t)*Math.cos(a)),mul(e2,rr(t)*Math.sin(a)))),
    f:p=>{ const q=sub(p,o), h=dot(q,dd); return (len(sub(q,mul(dd,h)))-rr(h))*cs; }}; }
/* наклонный конус с горизонтальными круговыми сечениями: центр c0 + z·s (s — сдвиг по x, y на 1 мм высоты), радиус r0 → r1 */
function oblique(c0,s,r0,r1,z0,z1){ const rr=z=>r0+(r1-r0)*(z-z0)/(z1-z0), cz=z=>[c0[0]+s[0]*(z-z0),c0[1]+s[1]*(z-z0)];
  return {kind:'obl',A:[0,2*Math.PI],B:[z0,z1],per:true,
    P:(a,z)=>{ const c=cz(z), r=rr(z); return [c[0]+r*Math.cos(a),c[1]+r*Math.sin(a),z]; },
    f:p=>{ const c=cz(p[2]); return Math.hypot(p[0]-c[0],p[1]-c[1])-rr(p[2]); }}; }
/* тор: центр c, ось d, радиус центров R (R < 0 — «лимон», «бочка»: дуга по другую сторону оси), радиус образующей r;
   a — угол вокруг оси, b — угол на образующей окружности */
function torus(c,d,R,r,A,B,E1){ const [e1,e2,dd]=E1?[E1,cross(unit(d),E1),unit(d)]:frame(d);
  return {kind:'tor',c,d:dd,R,r,A:A||[0,2*Math.PI],B:B||[0,2*Math.PI],per:!A,perB:!B,
    P:(a,b)=>{ const er=add(mul(e1,Math.cos(a)),mul(e2,Math.sin(a))); return add(c,add(mul(er,R+r*Math.cos(b)),mul(dd,r*Math.sin(b)))); },
    f:p=>{ const q=sub(p,c), h=dot(q,dd), rho=len(sub(q,mul(dd,h))); return Math.hypot(rho-R,h)-r; }}; }
/* поверхность вращения: ось o + t·d, меридиан (rho(b), t(b)) */
function revolve(o,d,mer,B,fimp){ const [e1,e2,dd]=frame(d);
  return {kind:'rev',A:[0,2*Math.PI],B,per:true,
    P:(a,b)=>{ const m=mer(b); return add(add(o,mul(dd,m[1])),add(mul(e1,m[0]*Math.cos(a)),mul(e2,m[0]*Math.sin(a)))); },
    f:p=>{ const q=sub(p,o), h=dot(q,dd); return fimp(len(sub(q,mul(dd,h))),h); }}; }
/* плоскость: o + a·e1 + b·e2 на прямоугольнике; граница грани — по телу */
function plane(o,e1,e2,A,B){ const n=unit(cross(e1,e2));
  return {kind:'pl',plane:true,n,o,A,B,P:(a,b)=>add(o,add(mul(e1,a),mul(e2,b))),f:p=>dot(sub(p,o),n)}; }

/* круг (торец тела): a — угол, b — радиус */
function disc(o,e1,e2,r){ const n=unit(cross(e1,e2));
  return {kind:'pl',plane:true,polar:true,n,o,A:[0,2*Math.PI],B:[0,r],per:true,P:(a,b)=>add(o,add(mul(e1,b*Math.cos(a)),mul(e2,b*Math.sin(a)))),f:p=>dot(sub(p,o),n)}; }
/* ── нулевое множество g на сетке куска (квадраты); выход — ломаные [{pts, ab, closed}] ── */
function march(pc,g,na,nb){ na=na||pc.na||144; nb=nb||pc.nb||96;
  const [a0,a1]=pc.A, [b0,b1]=pc.B, ua=i=>a0+(a1-a0)*i/na, ub=j=>b0+(b1-b0)*j/nb;
  const V=[]; for(let i=0;i<=na;i++){ const row=[]; for(let j=0;j<=nb;j++){ let v=g(pc.P(ua(i),ub(j))); if(!isFinite(v)) v=NaN; else if(Math.abs(v)<1e-12) v=1e-12; row.push(v); } V.push(row); }
  if(pc.per) for(let j=0;j<=nb;j++) V[na][j]=V[0][j];
  if(pc.perB) for(let i=0;i<=na;i++) V[i][nb]=V[i][0];
  const I=i=>pc.per&&i===na?0:i, J=j=>pc.perB&&j===nb?0:j;
  const pts=new Map(), adj=new Map();
  /* точка на ребре сетки: деление пополам по параметру */
  const node=(i0,j0,i1,j1)=>{ const K=j0===j1?'h'+i0+','+J(j0):'v'+I(i0)+','+j0;
    if(!pts.has(K)){ let pa=[ua(i0),ub(j0)], pb=[ua(i1),ub(j1)], va=V[i0][j0];
      for(let it=0;it<14;it++){ const m=[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2], vm=g(pc.P(m[0],m[1])); if((vm<0)===(va<0)){ pa=m; va=vm; } else pb=m; }
      const ab=[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2]; pts.set(K,{ab,p:pc.P(ab[0],ab[1])}); }
    return K; };
  const link=(x,y)=>{ if(x===y) return; (adj.get(x)||adj.set(x,[]).get(x)).push(y); (adj.get(y)||adj.set(y,[]).get(y)).push(x); };
  for(let i=0;i<na;i++) for(let j=0;j<nb;j++){
    const v00=V[i][j], v10=V[i+1][j], v11=V[i+1][j+1], v01=V[i][j+1];
    if([v00,v10,v11,v01].some(isNaN)) continue;
    const E=[]; const s=v=>v<0;
    if(s(v00)!==s(v10)) E.push(node(i,j,i+1,j)); if(s(v10)!==s(v11)) E.push(node(i+1,j,i+1,j+1));
    if(s(v11)!==s(v01)) E.push(node(i,j+1,i+1,j+1)); if(s(v01)!==s(v00)) E.push(node(i,j,i,j+1));
    if(E.length===2) link(E[0],E[1]);
    else if(E.length===4){ const c=(v00+v10+v11+v01)/4; if(s(c)===s(v00)){ link(E[0],E[1]); link(E[2],E[3]); } else { link(E[0],E[3]); link(E[1],E[2]); } } }
  /* цепочки */
  const used=new Set(), out=[];
  const walk=st=>{ const ch=[st]; used.add(st); let cur=st;
    for(;;){ const nx=(adj.get(cur)||[]).find(k=>!used.has(k)); if(!nx) break; used.add(nx); ch.push(nx); cur=nx; }
    const closed=ch.length>2&&(adj.get(cur)||[]).includes(st);
    return {pts:ch.map(k=>pts.get(k).p),ab:ch.map(k=>pts.get(k).ab),closed}; };
  adj.forEach((v,k)=>{ if(!used.has(k)&&v.length===1) out.push(walk(k)); });
  adj.forEach((v,k)=>{ if(!used.has(k)) out.push(walk(k)); });
  return out.filter(c=>c.pts.length>1); }

/* ── сцена ── */
function scene(bodies){
  const B={}; bodies.forEach(b=>B[b.id]=b);
  /* точка на границе тела: по разные стороны поверхности (вдоль нормали) — внутри и снаружи */
  const onBd=(b,pc,p)=>{ const n=unit(grad(pc.f,p)), e=0.03; return b.inside(add(p,mul(n,e)))!==b.inside(sub(p,mul(n,e))); };
  const buried=(p,ex)=>bodies.some(b=>!ex.includes(b.id)&&b.inside(p));
  /* габарит — для лучей видимости */
  let BOX=null;
  const box=()=>{ if(BOX) return BOX; const m=[1e9,1e9,1e9,-1e9,-1e9,-1e9];
    bodies.forEach(b=>b.patches.forEach(pc=>{ if(pc.plane) return; for(let i=0;i<=24;i++) for(let j=0;j<=24;j++){ const p=pc.P(pc.A[0]+(pc.A[1]-pc.A[0])*i/24,pc.B[0]+(pc.B[1]-pc.B[0])*j/24); for(let k=0;k<3;k++){ m[k]=Math.min(m[k],p[k]); m[k+3]=Math.max(m[k+3],p[k]); } } }));
    return BOX=m; };
  const DIR={F:[0,1,0],H:[0,0,1]};
  /* видима ли точка p (на поверхности) из вида v: луч к наблюдателю не заходит внутрь тел */
  const visible=(p,v)=>{ const d=DIR[v], m=box(), lim=(v==='F'?m[4]-p[1]:m[5]-p[2])+0.5; const q0=[p[0],p[1],v==='F'?Math.max(p[2],0.05):p[2]];
    for(let s=0.12;s<=lim;s+=0.35){ const q=add(q0,mul(d,s)); for(const b of bodies) if(b.inside(q)) return false; } return true; };
  /* ломаная → участки, где ok(p) истинно; концы участков уточнены делением хорды пополам */
  function runs(pl,ok){ let P=pl.pts.slice(); const n=P.length; if(n<2) return [];
    const val=P.map(ok);
    if(pl.closed&&val.every(x=>x)) return [{pts:P.concat([P[0]]),closed:true}];
    if(pl.closed){ const k=val.indexOf(false); P=P.slice(k).concat(P.slice(0,k+1)); const v2=val.slice(k).concat(val.slice(0,k+1)); return cut(P,v2,ok); }
    return cut(P,val,ok); }
  function cut(P,val,ok){ const out=[]; let cur=null;
    const edge=(a,b)=>{ /* a — годная, b — нет */ let lo=0,hi=1; for(let it=0;it<16;it++){ const m=(lo+hi)/2; if(ok(lerp(a,b,m))) lo=m; else hi=m; } return lerp(a,b,lo); };
    for(let i=0;i<P.length;i++){
      if(val[i]){ if(!cur){ cur=[]; if(i>0) cur.push(edge(P[i],P[i-1])); } cur.push(P[i]); }
      else if(cur){ cur.push(edge(P[i-1],P[i])); if(cur.length>1) out.push({pts:cur,closed:false}); cur=null; } }
    if(cur&&cur.length>1) out.push({pts:cur,closed:false});
    return out; }
  /* участки ломаной → отрезки одной видимости для вида v */
  function visRuns(pts,v){ const vis=pts.map(p=>visible(p,v)), out=[]; let cur={vis:vis[0],pts:[pts[0]]};
    for(let i=1;i<pts.length;i++){ if(vis[i]===cur.vis){ cur.pts.push(pts[i]); continue; }
      let lo=0,hi=1; const a=pts[i-1], b=pts[i]; for(let it=0;it<12;it++){ const m=(lo+hi)/2; if(visible(lerp(a,b,m),v)===cur.vis) lo=m; else hi=m; }
      const x=lerp(a,b,(lo+hi)/2); cur.pts.push(x); out.push(cur); cur={vis:vis[i],pts:[x,pts[i]]}; }
    out.push(cur); return out.filter(r=>r.pts.length>1); }

  /* линия пересечения тел a и b: по всем парам кусков; проверка — та же линия с сетки второго тела */
  function meet(ia,ib,noBury){ const A=B[ia], Bb=B[ib], res=[], alt=[];
    const okFor=(pa,pb)=>p=>onBd(A,pa,p)&&onBd(Bb,pb,p)&&(noBury||!buried(p,[ia,ib]));
    A.patches.forEach(pa=>Bb.patches.forEach(pb=>{ if(pa.plane&&pb.plane&&Math.abs(Math.abs(dot(pa.n,pb.n))-1)<1e-9) return;
      /* сетка — на куске, который не плоскость (на плоскости прямоугольник параметров шире грани) */
      const [m,o]=pa.plane&&!pb.plane?[pb,pa]:[pa,pb], ok=okFor(pa,pb);
      march(m,o.f).forEach(pl=>runs(pl,ok).forEach(r=>{ r.cc=!m.plane&&!o.plane; res.push(r); }));
      if(!m.plane&&!o.plane) march(o,m.f).forEach(pl=>runs(pl,ok).forEach(r=>alt.push(r))); }));
    /* сшиваем участки с разных кусков, если концы совпадают */
    const lines=join(res);
    /* проверка: точки первой сетки (кроме 2 мм у концов участка — там линию обрезает граница тела) — на линии второй */
    let dev=0; if(alt.length){ res.filter(r=>r.cc&&pathLen(r.pts)>4).forEach(l=>{ const P=l.pts, L=pathLen(P); let acc=0; P.forEach((p,i)=>{ if(i) acc+=dist(P[i-1],p); if(i%3||acc<2||L-acc<2) return; let m=1e9; alt.forEach(r=>{ for(let k=1;k<r.pts.length;k++){ const d=segDist(p,r.pts[k-1],r.pts[k]); if(d<m) m=d; } }); if(m>dev) dev=m; }); }); }
    return {a:ia,b:ib,lines,dev,check:alt.length>0}; }
  function join(rs){ const L=rs.map(r=>({pts:r.pts.slice(),closed:r.closed})), tol=0.6;
    for(let changed=true;changed;){ changed=false;
      for(let i=0;i<L.length&&!changed;i++) for(let j=0;j<L.length&&!changed;j++){ if(i===j||L[i].closed||L[j].closed) continue;
        const a=L[i].pts, b=L[j].pts;
        if(dist(a[a.length-1],b[0])<tol){ L[i].pts=a.concat(b.slice(1)); L.splice(j,1); changed=true; }
        else if(dist(a[a.length-1],b[b.length-1])<tol){ L[i].pts=a.concat(b.slice().reverse().slice(1)); L.splice(j,1); changed=true; }
        else if(dist(a[0],b[0])<tol){ L[i].pts=a.slice().reverse().concat(b.slice(1)); L.splice(j,1); changed=true; } }
      L.forEach(l=>{ const p=l.pts; if(!l.closed&&p.length>3&&dist(p[0],p[p.length-1])<tol){ l.closed=true; p[p.length-1]=p[0]; } }); }
    return L.filter(l=>l.pts.length>1&&pathLen(l.pts)>0.8); }
  const pathLen=P=>{ let s=0; for(let i=1;i<P.length;i++) s+=dist(P[i-1],P[i]); return s; };

  /* очерки тела для вида v: нормаль ⟂ взгляду; рёбра — заданные телом; всё — без утонувших в других телах участков */
  function outline(ib,v,raw){ const b=B[ib], d=DIR[v], out=[], bur=raw?()=>false:buried;
    b.patches.forEach(pc=>{ if(pc.plane||(pc.noSil&&pc.noSil.includes(v))) return;
      const g=p=>dot(unit(grad(pc.f,p)),d);
      let mx=0; for(let i=0;i<=12;i++) for(let j=0;j<=12;j++) mx=Math.max(mx,Math.abs(g(pc.P(pc.A[0]+(pc.A[1]-pc.A[0])*i/12,pc.B[0]+(pc.B[1]-pc.B[0])*j/12))));
      if(mx<1e-6) return;   /* проецирующая поверхность: очерк — её рёбра */
      march(pc,g).forEach(pl=>runs(pl,p=>onBd(b,pc,p)&&!bur(p,[ib])).forEach(r=>out.push(r.pts))); });
    (b.edges||[]).forEach(e=>{ if(e.only&&!e.only.includes(v)) return; runs({pts:e.pts,closed:false},p=>!bur(p,[ib])).forEach(r=>out.push(r.pts)); });
    return out; }
  /* сечение куска поверхностью-посредником g = 0 (только по самому телу) */
  function section(ib,g){ const b=B[ib], out=[];
    b.patches.forEach(pc=>march(pc,g).forEach(pl=>runs(pl,p=>onBd(b,pc,p)).forEach(r=>out.push(r.pts)))); return out; }
  return {B,bodies,meet,outline,section,visible,visRuns,onBd,buried,box,runs,march};
}

self.NG4S={add,sub,mul,dot,cross,len,unit,lerp,dist,frame,grad,sphere,cylinder,cone,oblique,torus,revolve,plane,disc,march,scene};
})();
