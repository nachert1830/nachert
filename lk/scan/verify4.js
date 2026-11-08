/* ═══════════ Проверка ДЗ №4 по результату: линии пересечения копии против эталона варианта ═══════════
   Способ построения у каждого свой (плоскости уровня, концентрические или эксцентрические сферы, плоскости через вершину),
   но линия пересечения двух тел одна — её и сверяем с эталоном (lk/scan/dz4ref.json, решатель dz/ng/4/solver.js).
   Вспомогательные построения (сферы, следы плоскостей, линии связи) не судятся: на копии они просто не совпадают ни с чем.
   Копия — в мм листа (привязка lk/scan/bind4.js). Для каждой ветви линии на каждой проекции (″ и ′):
     вырожденная проекция — эталонная линия лежит на очерке тела (проецирующий цилиндр, призма ⟂ π₂): её «строить» не надо,
       она уже на чертеже — не судим;
     карандаш — кривые копии, а также отрезки и дуги, если они не очерки тел (≥ 80 % их длины у очерков эталона);
     покрытие — доля длины эталонной линии, у которой ближе 1,5 мм есть такой карандаш; отклонение — медиана и 90 % этих расстояний;
     «верно» — покрытие ≥ 85 %, медиана ≤ 0,6 мм, 90 % ≤ 1,2 мм;
     «расходится» — только при сильной улике: рядом с эталонной линией (в среднем ближе 10 мм) начерчена кривая длиной ≥ 15 мм,
       которая ≥ 60 % своей длины идёт дальше 2,5 мм от неё (ближе, чем к любой другой линии эталона), а эталонная покрыта < 60 %;
     иначе — «не уверен» (линии не видно, покрыта частично): ложное «расходится» хуже молчания.
   Характерные точки: подписи — свои у каждого студента, поэтому номера не сверяются: точка эталона найдена, если ближе 1,5 мм
   есть любая подписанная точка копии.
   verify(copy {curves:[{p:[[u,v]], unv}], segs:[{p:[u1,v1,u2,v2], unv}], arcs:[{poly, unv}], pts:[[подпись, u, v]]}, ref, o) →
     {verdict: 'верно' | 'расходится с эталоном' | 'не уверен', lines:[{pair, st, why, proj:{F:{st, cov, med, p90, on}, H}, chars:{found, of}}], chars:{found, of}} */
(function(){
'use strict';
const TOL=1.5, OK={cov:0.85,med:0.6,p90:1.2}, BAD={far:2.5,share:0.6,len:15,near:10,cov:0.6};
function dense(P,step){ if(!P.length) return []; const o=[P[0]]; for(let i=1;i<P.length;i++){ const a=P[i-1], b=P[i], L=Math.hypot(b[0]-a[0],b[1]-a[1]), n=Math.max(1,Math.ceil(L/step)); for(let k=1;k<=n;k++) o.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]); } return o; }
/* ближайшая точка набора (сетка 2 мм): d(x, y) → расстояние (до rmax, дальше — Infinity) */
function index(pts,cell){ cell=cell||2; const G=new Map(), key=(i,j)=>i+','+j; pts.forEach(p=>{ const k=key(Math.floor(p[0]/cell),Math.floor(p[1]/cell)); (G.get(k)||G.set(k,[]).get(k)).push(p); });
  return (x,y,rmax)=>{ rmax=rmax||10; const r=Math.ceil(rmax/cell), i0=Math.floor(x/cell), j0=Math.floor(y/cell); let m=Infinity;
    for(let i=i0-r;i<=i0+r;i++) for(let j=j0-r;j<=j0+r;j++){ const c=G.get(key(i,j)); if(c) for(const p of c){ const d=Math.hypot(p[0]-x,p[1]-y); if(d<m) m=d; } } return m<=rmax?m:Infinity; }; }
const quant=(a,q)=>{ if(!a.length) return null; const s=a.slice().sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(q*s.length))]; };
const branchPoly=(b,v)=>[].concat(...(b[v]||[]).map((r,i)=>i?r.p.slice(1):r.p));

function verify(copy,ref,o){ o=o||{}; const outl={F:[],H:[]}; (ref.outlines||[]).forEach(q=>dense(q.p,0.5).forEach(p=>outl[q.v].push(p)));
  const outAll=index(outl.F.concat(outl.H),2), outV={F:index(outl.F,2),H:index(outl.H,2)};
  /* карандаш копии: кривые — всегда; отрезки и дуги — если это не очерки тел */
  const prims=[]; (copy.curves||[]).forEach(c=>{ if(!c.unv) prims.push({p:dense(c.p||c.poly,0.5),curve:true}); });
  (copy.segs||[]).forEach(s=>{ if(!s.unv) prims.push({p:dense([[s.p[0],s.p[1]],[s.p[2],s.p[3]]],0.5)}); });
  (copy.arcs||[]).forEach(c=>{ if(!c.unv&&!c.curve) prims.push({p:dense(c.poly,0.5)}); });
  const ink=prims.filter(q=>q.p.length>1&&(q.curve?true:q.p.filter(p=>outAll(p[0],p[1],1)<=0.6).length<0.8*q.p.length));
  const inkIdx=index([].concat(...ink.map(q=>q.p)),2);
  /* все эталонные ветви (обе проекции) — чтобы кривую копии судить только по той линии, к которой она ближе всего */
  const all=[]; (ref.lines||[]).forEach((L,li)=>L.branches.forEach((b,bi)=>['F','H'].forEach(v=>{ const P=dense(branchPoly(b,v),0.5); if(P.length>1) all.push({li,bi,v,P,idx:index(P,2)}); })));
  const pts=(copy.pts||[]).map(q=>[q[1],q[2]]);
  const lines=(ref.lines||[]).map((L,li)=>{ const proj={};
    ['F','H'].forEach(v=>{ const Bs=all.filter(x=>x.li===li&&x.v===v); if(!Bs.length) return; const P=[].concat(...Bs.map(x=>x.P));
      const on=P.filter(p=>outV[v](p[0],p[1],1)<=0.3).length/P.length; if(on>=0.9){ proj[v]={st:'на очерке',on:+on.toFixed(2)}; return; }
      const d=P.map(p=>inkIdx(p[0],p[1],TOL)), hit=d.filter(x=>x<=TOL), cov=hit.length/P.length, med=quant(hit,0.5), p90=quant(hit,0.9);
      /* кривые рядом: какая доля их длины (из той, что ближе к этой линии, чем к другим) идёт дальше 2,5 мм */
      let bad=null; ink.filter(q=>q.curve).forEach(q=>{ const mine=q.p.filter(p=>{ const dm=Math.min(...Bs.map(x=>x.idx(p[0],p[1],BAD.near))); if(!(dm<=BAD.near)) return false;
          return all.filter(x=>x.li!==li||x.v!==v).every(x=>x.idx(p[0],p[1],dm)>=dm); });
        if(mine.length*0.5<BAD.len) return; const dd=mine.map(p=>Math.min(...Bs.map(x=>x.idx(p[0],p[1],BAD.near)))), far=dd.filter(x=>x>BAD.far).length/dd.length;
        if(far>=BAD.share&&(!bad||far>bad.far)) bad={far,len:mine.length*0.5,mean:dd.reduce((a,b)=>a+b,0)/dd.length}; });
      let st='не уверен', why='';
      if(cov>=OK.cov&&med<=OK.med&&p90<=OK.p90){ st='верно'; why='совпадает с эталоном на '+Math.round(cov*100)+' %'; }
      else if(bad&&cov<BAD.cov){ st='расходится'; why='начерченная кривая ('+Math.round(bad.len)+' мм) идёт в среднем в '+bad.mean.toFixed(1).replace('.',',')+' мм от эталона'; }
      else why=cov<0.2?'линия не найдена на копии':'совпадает с эталоном только на '+Math.round(cov*100)+' %';
      proj[v]={st,why,cov:+cov.toFixed(3),med:med==null?null:+med.toFixed(2),p90:p90==null?null:+p90.toFixed(2),bad:bad?{far:+bad.far.toFixed(2),len:+bad.len.toFixed(1),mean:+bad.mean.toFixed(2)}:null}; });
    const J=Object.values(proj).filter(x=>x.st!=='на очерке'), st=J.some(x=>x.st==='расходится')?'расходится':J.length&&J.every(x=>x.st==='верно')?'верно':'не уверен';
    const ch=(L.chars||[]).map(c=>['F','H'].map(v=>{ const at=c[v]; return pts.some(p=>Math.hypot(p[0]-at[0],p[1]-at[1])<=TOL); })), found=ch.reduce((a,x)=>a+x.filter(Boolean).length,0);
    const why=st==='верно'?'линия пересечения построена верно':st==='расходится'?'линия пересечения расходится с эталоном':'не уверен';
    return {pair:L.pair,st,why,proj,chars:{found,of:ch.length*2}}; });
  const verdict=lines.some(l=>l.st==='расходится')?'расходится с эталоном':lines.length&&lines.every(l=>l.st==='верно')?'верно':'не уверен';
  return {verdict,lines,chars:{found:lines.reduce((a,l)=>a+l.chars.found,0),of:lines.reduce((a,l)=>a+l.chars.of,0)}}; }

const api={verify,dense,index};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else self.SCANVERIFY4=api;
})();
