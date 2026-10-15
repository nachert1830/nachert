/* ═══════════ Нормоконтроль: сверка видов листа с 3D-моделью ═══════════
   Независимо от того, как генератор нашёл рёбра (он трассирует аналитические поверхности), здесь деталь просвечивается
   лучами — как её увидел бы чертёжник: по сетке 0,5 мм на каждом виде луч идёт вдоль направления взгляда, отмечает все
   поверхности на пути (вход в материал и выход), их глубину, нормаль и то, какому телу модели принадлежит поверхность.
   Между соседними лучами ребро есть, если сменились: попал/не попал, поверхность (с изломом), глубина скачком.
   Ребро первого слоя — видимое (сплошная основная), глубже — невидимое (штриховая). Сравнивается с нарисованным:
     лишняя линия — на листе есть, на детали нет;  нет линии — ребро на детали есть, на листе нет;
     видимое нарисовано штриховой и наоборот;  штриховка не там, где секущая плоскость прошла по материалу.
   Что считается разрезом, читается с самого листа: вид с штриховкой — разрез; половина — с той стороны, где штриховка,
   граница — волнистая линия или ось; секущая плоскость — по обозначению «Б–Б» (штрихи на другом виде) или плоскость
   симметрии. Отверстия круглого фланца в разрезе — по условности ГОСТ 2.305 (IG3.conv). */
(function(){
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function segDist(p,a,b){ const ax=b[0]-a[0], ay=b[1]-a[1], l2=ax*ax+ay*ay||1e-12, t=Math.max(0,Math.min(1,((p[0]-a[0])*ax+(p[1]-a[1])*ay)/l2)); return Math.hypot(a[0]+ax*t-p[0],a[1]+ay*t-p[1]); }
function grid(segs,cell){ const G=new Map(), key=(x,y)=>x+','+y;
  segs.forEach(s=>{ const x0=Math.floor(Math.min(s.a[0],s.b[0])/cell), x1=Math.floor(Math.max(s.a[0],s.b[0])/cell), y0=Math.floor(Math.min(s.a[1],s.b[1])/cell), y1=Math.floor(Math.max(s.a[1],s.b[1])/cell);
    for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++){ const k=key(x,y); if(!G.has(k)) G.set(k,[]); G.get(k).push(s); } });
  return {dist(p){ let m=Infinity; const x=Math.floor(p[0]/cell), y=Math.floor(p[1]/cell); for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) (G.get(key(x+i,y+j))||[]).forEach(s=>{ const d=segDist(p,s.a,s.b); if(d<m) m=d; }); return m; }}; }
function ptGrid(P,cell){ const G=new Map(), key=(x,y)=>x+','+y; P.forEach(p=>{ const k=key(Math.floor(p[0]/cell),Math.floor(p[1]/cell)); if(!G.has(k)) G.set(k,[]); G.get(k).push(p); });
  return {dist(p){ let m=Infinity; const x=Math.floor(p[0]/cell), y=Math.floor(p[1]/cell); for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) (G.get(key(x+i,y+j))||[]).forEach(q=>{ const d=dist(p,q); if(d<m) m=d; }); return m; }}; }
/* кучки отмеченных точек: соседство ≤ r; размер кучки — число точек × шаг */
function clusters(P,r){ const out=[], used=new Uint8Array(P.length), G=new Map(), cell=r, key=(x,y)=>x+','+y;
  P.forEach((p,i)=>{ const k=key(Math.floor(p[0]/cell),Math.floor(p[1]/cell)); if(!G.has(k)) G.set(k,[]); G.get(k).push(i); });
  for(let i=0;i<P.length;i++){ if(used[i]) continue; const c=[], st=[i]; used[i]=1; while(st.length){ const j=st.pop(); c.push(P[j]); const x=Math.floor(P[j][0]/cell), y=Math.floor(P[j][1]/cell);
      for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++) (G.get(key(x+a,y+b))||[]).forEach(q=>{ if(!used[q]&&dist(P[q],P[j])<=r){ used[q]=1; st.push(q); } }); }
    out.push(c); } return out; }

window.NORMO_MODEL=function(F,model0,C){ const {k,FV,LV,TV,segAll,hatch,add,marks,labs}=C, g=0.5, TOL=0.75;
  const IG3=window.IG3; if(!IG3||!IG3.jc) return;
  const segsV=w=>segAll.filter(q=>w.ids.includes(q.it.view)), stats={};
  const VIEW={front:{u:p=>p[0],v:p=>p[2],ray:(u,v,t)=>[u,t,v],d:1,ax:1,lo:b=>b[0][1],hi:b=>b[1][1],uR:b=>[b[0][0],b[1][0]],vR:b=>[b[0][2],b[1][2]]},
              left:{ray:(u,v,t)=>[t,-u,v],d:1,ax:0,lo:b=>b[0][0],hi:b=>b[1][0],uR:b=>[-b[1][1],-b[0][1]],vR:b=>[b[0][2],b[1][2]]},
              top:{ray:(u,v,t)=>[u,v,-t],d:-1,ax:2,lo:b=>-b[1][2],hi:b=>-b[0][2],uR:b=>[b[0][0],b[1][0]],vR:b=>[b[0][1],b[1][1]]}};
  const MAP={}, FIT={};
  const T={}, tm=(k2,q)=>{ T[k2]=(T[k2]||0)+performance.now()-q; };
  const one=(name,w,mapOnly)=>{ if(!w) return; let tq=performance.now(); const V=VIEW[name], nm={front:'главный вид',left:'вид слева',top:'вид сверху'}[name];
    /* ── разрез по листу: штриховка этого изображения ── */
    const H=hatch.filter(f=>w.ids.includes(f.view)); const S=segsV(w);
    const inFill=(f,p)=>{ if(!f.clip.every(r=>p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3])) return false; const M=f.M, det=M.a*M.d-M.b*M.c, x=p[0]-M.e, y=p[1]-M.f; const q=f.el.ownerSVGElement.createSVGPoint(); q.x=(M.d*x-M.c*y)/det; q.y=(-M.b*x+M.a*y)/det; return f.el.isPointInFill(q); };
    /* штриховка этого изображения — растром 0,25 мм (isPointInFill в каждой точке медленный) */
    const hatched=(()=>{ if(!H.length) return ()=>false; const q=0.25*k, X0=w.b[0]-3*k, Y0=w.b[1]-3*k, cw=Math.ceil((w.b[2]-w.b[0]+6*k)/q), ch=Math.ceil((w.b[3]-w.b[1]+6*k)/q);
      const cv=document.createElement('canvas'); cv.width=cw; cv.height=ch; const cx=cv.getContext('2d',{willReadFrequently:true});
      H.forEach(f=>{ cx.save(); cx.setTransform(1/q,0,0,1/q,-X0/q,-Y0/q); f.clip.forEach(r=>{ cx.beginPath(); cx.rect(r[0],r[1],r[2]-r[0],r[3]-r[1]); cx.clip(); });
        const M=f.M; cx.transform(M.a,M.b,M.c,M.d,M.e,M.f); cx.fillStyle='#000'; cx.fill(new Path2D(f.el.getAttribute('d')),(getComputedStyle(f.el).fillRule==='evenodd')?'evenodd':'nonzero'); cx.restore(); });
      const D=cx.getImageData(0,0,cw,ch).data; return p=>{ const i=Math.floor((p[0]-X0)/q), j=Math.floor((p[1]-Y0)/q); return i>=0&&j>=0&&i<cw&&j<ch&&D[(j*cw+i)*4+3]>127; }; })();
    /* граница вида и разреза: волнистая линия этого изображения или ось симметрии */
    const vert=name!=='top';
    /* волнистая: тонкая кривая вдоль границы (вертикальная на главном виде и виде слева), колеблется у хорды не больше чем на 1,5 мм */
    const isWavy=it=>{ if(!it.curve||it.kind!=='thin'||it.view>=0) return false; const P=it.polys[0], A=P[0], B=P[P.length-1], L=dist(A,B); if(L<10*k) return false;
      if(vert?Math.abs(B[0]-A[0])>0.05*L:Math.abs(B[1]-A[1])>0.05*L) return false; let dev=0, sg=0, ch=0; P.forEach(p=>{ const d=((B[0]-A[0])*(p[1]-A[1])-(B[1]-A[1])*(p[0]-A[0]))/L; dev=Math.max(dev,Math.abs(d)); const s2=Math.sign(d); if(s2&&s2!==sg){ ch++; sg=s2; } }); return dev<1.5*k&&ch>=4; };
    const wav=segAll.filter(q=>isWavy(q.it)&&[q.a,q.b].every(p=>p[0]>=w.b[0]-1&&p[0]<=w.b[2]+1&&p[1]>=w.b[1]-1&&p[1]<=w.b[3]+1));
    const axs=C.axLines.filter(it=>{ const P=it.polys[0]; return vert?Math.abs(P[0][0]-P[1][0])<0.05*k&&P[0][0]>w.b[0]&&P[0][0]<w.b[2]&&Math.min(P[0][1],P[1][1])<w.b[1]+5*k&&Math.max(P[0][1],P[1][1])>w.b[3]-5*k
      :Math.abs(P[0][1]-P[1][1])<0.05*k&&P[0][1]>w.b[1]&&P[0][1]<w.b[3]&&Math.min(P[0][0],P[1][0])<w.b[0]+5*k&&Math.max(P[0][0],P[1][0])>w.b[2]-5*k; });
    const axC=axs.map(it=>vert?it.polys[0][0][0]:it.polys[0][0][1]).sort((a,b)=>Math.abs(a-(vert?(w.b[0]+w.b[2])/2:(w.b[1]+w.b[3])/2))-Math.abs(b-(vert?(w.b[0]+w.b[2])/2:(w.b[1]+w.b[3])/2)))[0];
    const bnd=wav.length?wav.reduce((s,q)=>s+(vert?(q.a[0]+q.b[0])/2:(q.a[1]+q.b[1])/2),0)/wav.length:axC;
    let half=null; if(H.length){ let a=0,b=0; const n=40; for(let i=0;i<n;i++) for(let j=0;j<n;j++){ const p=[w.b[0]+(w.b[2]-w.b[0])*(i+.5)/n,w.b[1]+(w.b[3]-w.b[1])*(j+.5)/n]; if(hatched(p)) (bnd==null?0:(vert?p[0]:p[1])<bnd)?a++:b++; }
      half=bnd==null||Math.min(a,b)>0.08*(a+b)?'full':vert?(a>b?'left':'right'):(a>b?'up':'down'); }
    /* секущая плоскость: по обозначению над изображением, иначе — плоскость симметрии (0) */
    let plane=null; if(H.length){ plane=name==='top'?null:0;
      const lab=labs.find(t=>t.c[0]>w.b[0]-5*k&&t.c[0]<w.b[2]+5*k&&t.c[1]<w.b[1]&&t.c[1]>w.b[1]-40*k);
      if(lab){ const M=marks.filter(m=>m.L===lab.s[0]); if(M.length>=2) plane={marks:M}; }
      if(name==='top'&&!lab) plane=null; }
    /* ── модель вида: с условностью для отверстий фланца, если вид с разрезом ── */
    const model=H.length&&name!=='top'?IG3.conv(model0,name==='front'?'y':'x'):model0, J=IG3.jc(model.tree), b=model.box;
    const leaves=[]; (function wk(n){ if(!n) return; if(n.t==='u'||n.t==='i'){ n.k.forEach(wk); return; } if(n.t==='s'){ wk(n.a); n.k.forEach(wk); return; } leaves.push(IG3.jc(n)); })(model.tree);
    /* ── перевод мм ↔ лист: масштаб 1:1, сдвиг — по габариту изображения на листе и деталь лучами ── */
    const [u0,u1]=V.uR(b), [v0,v1]=V.vR(b), t0=V.lo(b)-1, t1=V.hi(b)+1;
    /* удалённая часть разреза (в мм модели) — после того как известны сдвиги; пока считаем без разреза, чтобы найти габарит */
    let cutSD=null;
    const Jv=p=>{ const j=J(p[0],p[1],p[2]); return cutSD?Math.max(j,-cutSD(p)):j; };
    const march=(u,v,all)=>{ const hits=[]; let t=t0, tp=t0, inside=false;
      for(let i=0;i<6000&&t<t1;i++){ const d=Jv(V.ray(u,v,t));
        if((d<0)!==inside){ let a=tp, c=t; for(let s=0;s<18;s++){ const m=(a+c)/2; if((Jv(V.ray(u,v,m))<0)===inside) a=m; else c=m; }
          const tm=(a+c)/2; hits.push({t:tm,p:V.ray(u,v,tm),ent:!inside}); inside=!inside; if(!all) return hits; tp=c; t=c+0.02; continue; }
        tp=t; t+=Math.max(Math.abs(d),0.02); }
      /* шов двух тел (общая грань в объединении) — пара «выход–вход» на одной глубине: это не поверхность */
      for(let i=0;i+1<hits.length;){ if(hits[i+1].t-hits[i].t<0.06){ hits.splice(i,2); } else i++; }
      return hits; };
    /* габарит детали на виде лучами (с запасом 2 мм) */
    const nu=Math.ceil((u1-u0+4)/g), nv=Math.ceil((v1-v0+4)/g), U=i=>u0-2+i*g+0.01371, Vv=j=>v1+2-j*g-0.02113;   /* сетка не попадает на «круглые» координаты: луч ровно по шву двух тел модели проскальзывает */
    /* положение на листе: X = ox + k·u, Y = oy − k·v. Габарит детали на виде — лучами: грубо (1 мм), затем края двоичным поиском
       по нескольким строкам/столбцам у крайних точек */
    const hitAt=(u,v)=>march(u,v,false).length>0;
    let E=FIT[name];
    if(!E){ const cu=[], cvv=[]; let mu=Infinity,Mu=-Infinity,mv=Infinity,Mv=-Infinity; const HG=[];
      for(let i=0;i<=nu;i+=2){ HG[i]=[]; for(let j=0;j<=nv;j+=2){ const h=hitAt(U(i),Vv(j)); HG[i][j]=h; if(h){ mu=Math.min(mu,U(i)); Mu=Math.max(Mu,U(i)); mv=Math.min(mv,Vv(j)); Mv=Math.max(Mv,Vv(j)); } } }
      if(!(Mu>mu)) return;
      const bis=(a,c,f)=>{ for(let s2=0;s2<18;s2++){ const m=(a+c)/2; if(f(m)) c=m; else a=m; } return c; };   /* a — пусто, c — деталь */
      const pick=(L,n)=>L.length<=n?L:Array.from({length:n},(_,i)=>L[Math.round(i*(L.length-1)/(n-1))]);
      const rowsAt=(uu)=>{ const o=[]; for(let j=0;j<=nv;j+=2){ const i=Math.round((uu-U(0))/g); if(HG[i]&&HG[i][j]) o.push(Vv(j)); } return o; };
      const colsAt=(vv)=>{ const o=[]; const j=Math.round((Vv(0)-vv)/g); for(let i=0;i<=nu;i+=2) if(HG[i]&&HG[i][j]) o.push(U(i)); return o; };
      const v2lo=Math.min(...pick(colsAt(mv),9).map(u=>bis(mv-2*g,mv,v=>hitAt(u,v)))), v2hi=Math.max(...pick(colsAt(Mv),9).map(u=>bis(Mv+2*g,Mv,v=>hitAt(u,v))));
      const rowsLo=pick(rowsAt(mu),9).concat([v2lo+0.004,v2hi-0.004]), rowsHi=pick(rowsAt(Mu),9).concat([v2lo+0.004,v2hi-0.004]);
      const u2lo=Math.min(...rowsLo.filter(v=>hitAt(mu+2*g,v)||hitAt(mu,v)).map(v=>bis(mu-2*g,hitAt(mu,v)?mu:mu+2*g,u=>hitAt(u,v))));
      const u2hi=Math.max(...rowsHi.filter(v=>hitAt(Mu-2*g,v)||hitAt(Mu,v)).map(v=>bis(Mu+2*g,hitAt(Mu,v)?Mu:Mu-2*g,u=>hitAt(u,v))));
      E=FIT[name]=[u2lo,u2hi,v2lo,v2hi]; }
    const W=(w.b[2]-w.b[0])/k, Hh=(w.b[3]-w.b[1])/k;
    tm('fit',tq); tq=performance.now();
    if(mapOnly){ MAP[name]={ox:w.b[0]-k*E[0],oy:w.b[1]+k*E[3]}; return; }
    if(Math.abs((E[1]-E[0])-W)>0.4||Math.abs((E[3]-E[2])-Hh)>0.4) add('модель','габарит изображения = деталь',nm+': на листе '+(Math.round(W*10)/10)+' × '+(Math.round(Hh*10)/10)+' мм, у детали '+(Math.round((E[1]-E[0])*10)/10)+' × '+(Math.round((E[3]-E[2])*10)/10),[w.b[0],w.b[1]]);
    const ox=w.b[0]-k*E[0], oy=w.b[1]+k*E[3], toS=(u,v)=>[ox+k*u,oy-k*v], toU=X=>(X-ox)/k, toV=Y=>(oy-Y)/k;
    /* разрез в мм модели */
    if(H.length&&half){ const ub=bnd!=null?(vert?toU(bnd):toV(bnd)):null; let pl=0;
      if(plane&&plane.marks){ const c=plane.marks.map(m=>m.c), hz=Math.abs(c[0][1]-c[1][1])<1*k, vt=Math.abs(c[0][0]-c[1][0])<1*k;
        /* штрихи — на соседнем виде; их линия в мм модели — через тот вид */
        const other=[FV,LV,TV].find(o=>o&&o!==w&&c.every(p=>p[0]>o.b[0]-25*k&&p[0]<o.b[2]+25*k&&p[1]>o.b[1]-25*k&&p[1]<o.b[3]+25*k));
        if(other===TV&&name==='front'&&hz&&MAP.top) pl=(MAP.top.oy-c[0][1])/k;
        else if(other===TV&&name==='left'&&vt&&MAP.top) pl=(c[0][0]-MAP.top.ox)/k;
        else if(other===FV&&name==='top'&&hz&&MAP.front) pl=(MAP.front.oy-c[0][1])/k; }
      else if(name==='top') return;   /* горизонтальный разрез без обозначения — не знаем высоты */
      /* что убрано: часть между наблюдателем и плоскостью, в половине — только со стороны разреза */
      const side=half==='full'?null:half;
      cutSD=p=>{ const u=name==='left'?-p[1]:p[0], v=name==='top'?p[1]:p[2];
        const pd=name==='front'?p[1]-pl:name==='left'?p[0]-pl:pl-p[2];   /* < 0 — перед плоскостью (со стороны наблюдателя) */
        let hs=-1e9; if(side==='right') hs=ub-u; else if(side==='left') hs=u-ub; else if(side==='down') hs=v-ub; else if(side==='up') hs=ub-v;
        return Math.max(pd,hs); };
      stats[name]={half,plane:Math.round(pl*10)/10,ub:ub!=null?Math.round(ub*10)/10:null};
      /* ребро детали на оси симметрии (ГОСТ 2.305): если оно совпало с осью, вид от разреза отделяют волнистой линией, а не осью
         (ребро слилось бы со штрихпунктиром). Ищем по модели, независимо от листа: по обе стороны оси (±0,6 мм) — первая поверхность
         на целой детали (наружное ребро) и на детали, разрезанной плоскостью целиком (внутреннее); излом нормали или скачок глубины
         на 3 мм подряд — ребро. Граница уже волнистая — это проверяет нормоконтроль по листу (ребро по оси нарисовано) */
      if(half!=='full'&&axC!=null){ const ua=vert?toU(axC):toV(axC);   /* ось симметрии в мм модели (граница может быть и волнистой) */
        const pdF=p=>name==='front'?p[1]-pl:name==='left'?p[0]-pl:pl-p[2], Fo=p=>J(p[0],p[1],p[2]), Fc=p=>Math.max(J(p[0],p[1],p[2]),-pdF(p));
        const first=(f,u,v)=>{ let t=t0, tp=t0; for(let i=0;i<6000&&t<t1;i++){ const d=f(V.ray(u,v,t));
            if(d<0){ let a=tp, c=t; for(let s=0;s<18;s++){ const m=(a+c)/2; if(f(V.ray(u,v,m))<0) c=m; else a=m; }
              const p=V.ray(u,v,c), h=0.01, gx=f([p[0]+h,p[1],p[2]])-f([p[0]-h,p[1],p[2]]), gy=f([p[0],p[1]+h,p[2]])-f([p[0],p[1]-h,p[2]]), gz=f([p[0],p[1],p[2]+h])-f([p[0],p[1],p[2]-h]), l=Math.hypot(gx,gy,gz)||1;
              return {t:c,n:[gx/l,gy/l,gz/l]}; }
            tp=t; t+=Math.max(Math.abs(d),0.02); } return null; };
        /* где по оси идёт ребро (наружное или внутреннее): мм вдоль оси через 0,5; куски длиной от 3 мм */
        const lo2=vert?v0:u0, hi2=vert?v1:u1, E=[];
        /* излом — грани по обе стороны оси: нормаль на 0,6 и на 1,2 мм от оси одна и та же (у вершины конуса, где радиус меньше
           миллиметра, нормаль поворачивается плавно — это не ребро, ср. docs/gost-ig.md, вар. 20) */
        const at2=(f,d,s)=>vert?first(f,ua+d,s):first(f,s,ua+d), dt=(a,b)=>a.n[0]*b.n[0]+a.n[1]*b.n[1]+a.n[2]*b.n[2];
        for(let s=lo2+0.25;s<hi2;s+=0.5){ if([Fo,Fc].some(f=>{ const A=at2(f,-0.6,s), B=at2(f,0.6,s); if(!A||!B) return false;
            if(Math.abs(A.t-B.t)>0.8) return true; if(dt(A,B)>=0.9) return false;
            const A2=at2(f,-1.2,s), B2=at2(f,1.2,s); if(C.opt.debugAx) C.opt.debugAx.push([name,s,dt(A,B),A2&&dt(A,A2),B2&&dt(B,B2),A2&&A2.t-A.t,B2&&B2.t-B.t].map(v=>typeof v==='number'?Math.round(v*1000)/1000:v));
            return !!A2&&!!B2&&dt(A,A2)>0.995&&dt(B,B2)>0.995; })) E.push(s); }
        const runs=[]; E.forEach((s,i)=>{ if(i&&s-E[i-1]<0.75) runs[runs.length-1].push(s); else runs.push([s]); });
        const long=runs.filter(r=>r.length*0.5>=3), at=vert?[axC,(w.b[1]+w.b[3])/2]:[(w.b[0]+w.b[2])/2,axC];
        if(long.length&&!wav.length) add('модель','ребро на оси — граница волнистой линией (ГОСТ 2.305)',nm+': с осью симметрии совпадает ребро детали ('+long.reduce((a,r)=>a+r.length*0.5,0)+' мм), а граница вида и разреза — сама ось: нужна волнистая линия, смещённая так, чтобы ребро было видно',at);
        else if(long.length){ /* граница волнистая — ребро нарисовано сплошной основной по оси на всей своей длине */
          const onAx=S.filter(q=>q.it.kind==='thick'&&!q.it.curve&&(vert?Math.abs(q.a[0]-axC)<0.3*k&&Math.abs(q.b[0]-axC)<0.3*k:Math.abs(q.a[1]-axC)<0.3*k&&Math.abs(q.b[1]-axC)<0.3*k));
          const drawn=s=>{ const Y=vert?toS(ua,s)[1]:toS(s,ua)[0]; return onAx.some(q=>{ const a=vert?q.a[1]:q.a[0], b=vert?q.b[1]:q.b[0]; return Y>=Math.min(a,b)-0.6*k&&Y<=Math.max(a,b)+0.6*k; }); };
          let worst=0; long.forEach(r=>{ let m=0; r.forEach(s=>{ m=drawn(s)?0:m+1; worst=Math.max(worst,m); }); });
          if(worst*0.5>=3) add('модель','ребро на оси видно (ГОСТ 2.305)',nm+': ребро детали на оси симметрии не нарисовано на '+worst*0.5+' мм — волнистая линия смещена не в ту сторону',at); } } }
    /* ── лучи по сетке ── */
    const needHid=S.some(q=>q.it.kind==='dash');
    const R=new Array((nu+1)*(nv+1)), id=(i,j)=>i*(nv+1)+j;
    const own=p=>{ let bi=-1, bv=Infinity; for(let i=0;i<leaves.length;i++){ const v=Math.abs(leaves[i](p[0],p[1],p[2])); if(v<bv){ bv=v; bi=i; } } if(cutSD){ const c=Math.abs(cutSD(p)); if(c<bv&&c<0.02) bi=-2; } return bi; };
    const nrm=p=>{ const h=0.01, gx=Jv([p[0]+h,p[1],p[2]])-Jv([p[0]-h,p[1],p[2]]), gy=Jv([p[0],p[1]+h,p[2]])-Jv([p[0],p[1]-h,p[2]]), gz=Jv([p[0],p[1],p[2]+h])-Jv([p[0],p[1],p[2]-h]), l=Math.hypot(gx,gy,gz)||1; return [gx/l,gy/l,gz/l]; };
    for(let i=0;i<=nu;i++) for(let j=0;j<=nv;j++){ const hs=march(U(i),Vv(j),needHid); hs.forEach(h=>{ h.o=own(h.p); h.n=nrm(h.p); }); R[id(i,j)]=hs; }
    tm('rays'+(needHid?'H':''),tq); tq=performance.now();
    /* ── рёбра между соседними лучами ── */
    const dirC=V.ax, vis=[], hid=[];
    const slope=h=>{ const c=Math.abs(h.n[dirC]); return c<0.05?20:Math.sqrt(1-c*c)/c; };
    let why='';
    const diff=(a,b)=>{ if(!a||!b){ why='hit'; return !!(a||b); } const dd=Math.abs(a.t-b.t), lim=0.6+g*Math.min(slope(a),slope(b))*1.6;
      if(dd>lim){ why='depth '+dd.toFixed(2); return true; } const cs=a.n[0]*b.n[0]+a.n[1]*b.n[1]+a.n[2]*b.n[2]; if(a.o!==b.o&&cs<0.996){ why='own '+a.o+'/'+b.o+' '+cs.toFixed(3); return true; } why='n '+cs.toFixed(3)+' '+a.n.map(v=>v.toFixed(2))+' '+b.n.map(v=>v.toFixed(2)); return cs<0.87; };
    for(let i=0;i<=nu;i++) for(let j=0;j<=nv;j++){ const A=R[id(i,j)]; [[1,0],[0,1]].forEach(([di,dj])=>{ if(i+di>nu||j+dj>nv) return; const B=R[id(i+di,j+dj)];
        const m=toS((U(i)+U(i+di))/2,(Vv(j)+Vv(j+dj))/2); m.dir=di?'u':'v';
        if(diff(A[0],B[0])){ if(C.opt.debug) m.why=why+' @'+[U(i),Vv(j)].map(v=>v.toFixed(2)); vis.push(m); return; }
        if(needHid){ const n=Math.max(A.length,B.length); for(let l=1;l<n;l++){ if(diff(A[l],B[l])){ if(C.opt.debug) m.why='L'+l+' '+A.length+'/'+B.length+' '+why+' @'+[U(i),Vv(j)].map(v=>v.toFixed(2))+' t='+A.map(h=>h.t.toFixed(2))+'|'+B.map(h=>h.t.toFixed(2)); hid.push(m); break; } } } }); }
    if(C.opt.debug){ (F.dbg=F.dbg||{vis:[],hid:[]}); vis.forEach(m=>F.dbg.vis.push(m)); hid.forEach(m=>F.dbg.hid.push(m)); }
    tm('edges',tq); tq=performance.now();
    /* граница вида и разреза — не линия контура (там ось или волнистая) */
    const nearB=m=>bnd!=null&&half&&half!=='full'&&(vert?m.dir==='u'&&Math.abs(m[0]-bnd)<(wav.length?1.6:0.8)*k:m.dir==='v'&&Math.abs(m[1]-bnd)<(wav.length?1.6:0.8)*k);
    const thick=S.filter(q=>q.it.kind==='thick'&&!q.it.curve), dash=S.filter(q=>q.it.kind==='dash');
    const GT=grid(thick,3*k), GD=grid(dash,3*k), VP=ptGrid(vis.filter(m=>!nearB(m)),3*k), HP=ptGrid(hid,3*k);
    /* кучка — линия, если вытянута хотя бы на 1,5 мм (вершина конуса сверла сверху — точка, а не линия) */
    const ext=c=>{ let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; c.forEach(p=>{ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); }); return Math.hypot(x1-x0,y1-y0)/k; };
    const report=(P,rule,msg)=>clusters(P,1.1*g*k).filter(c=>c.length*g>=1.5&&ext(c)>=1.5).forEach(c=>{ const m=[c.reduce((s,p)=>s+p[0],0)/c.length,c.reduce((s,p)=>s+p[1],0)/c.length]; add('модель',rule,nm+': '+msg+' ('+(Math.round(c.length*g*10)/10)+' мм)',m); });
    /* видимые рёбра без линии */
    const miss=vis.filter(m=>!nearB(m)&&GT.dist(m)>TOL*k);
    report(miss.filter(m=>GD.dist(m)<=TOL*k),'видимое — сплошной основной','видимое ребро нарисовано штриховой');
    report(miss.filter(m=>GD.dist(m)>TOL*k),'все рёбра детали на виде','ребро детали не нарисовано');
    /* лишние сплошные: точки линий через 0,5 мм */
    const samp=L=>{ const o=[]; L.forEach(q=>{ const l=dist(q.a,q.b), n=Math.max(1,Math.round(l/(g*k))); for(let s=0;s<=n;s++){ const t=s/n; o.push([q.a[0]+(q.b[0]-q.a[0])*t,q.a[1]+(q.b[1]-q.a[1])*t]); } }); return o; };
    const inBox=p=>{ const u=toU(p[0]), v=toV(p[1]); return u>u0-2&&u<u1+2&&v>v0-2&&v<v1+2; };
    report(samp(thick).filter(p=>inBox(p)&&VP.dist(p)>TOL*k&&!(bnd!=null&&half&&half!=='full'&&Math.abs((vert?p[0]:p[1])-bnd)<1*k)),'нет лишних линий','линия, которой на детали нет');
    /* штриховые: только на невидимых рёбрах */
    if(dash.length){ report(samp(dash).filter(p=>inBox(p)&&HP.dist(p)>TOL*k&&VP.dist(p)>TOL*k),'невидимый контур — по рёбрам детали','штриховая линия, а невидимого ребра здесь нет');
      const hv=hid.filter(m=>GD.dist(m)>TOL*k&&GT.dist(m)>TOL*k&&VP.dist(m)>TOL*k&&!(half&&half!=='full'&&H.length));
      report(hv,'невидимый контур — полностью','невидимое ребро не показано штриховой'); }
    /* ── штриховка = сечение: первый луч упёрся в секущую плоскость ── */
    tm('cmp',tq); tq=performance.now();
    /* сечение — плоскость прошла по материалу: он был по обе стороны от неё. Грань детали в самой плоскости — не сечение (ГОСТ 2.306) */
    const fw=V.ray(0,0,1), bk=V.ray(0,0,0), F3=[fw[0]-bk[0],fw[1]-bk[1],fw[2]-bk[2]];
    const cutMat=h=>h&&h.o===-2&&J(h.p[0]-F3[0]*0.05,h.p[1]-F3[1]*0.05,h.p[2]-F3[2]*0.05)<0&&J(h.p[0]+F3[0]*0.05,h.p[1]+F3[1]*0.05,h.p[2]+F3[2]*0.05)<0;
    if(cutSD){ const bad1=[], bad2=[]; for(let i=1;i<nu;i++) for(let j=1;j<nv;j++){ const h=R[id(i,j)][0], sec=cutMat(h), p=toS(U(i),Vv(j));
        if(VP.dist(p)<1*k||GT.dist(p)<1*k) continue; if(bnd!=null&&half!=='full'&&Math.abs((vert?p[0]:p[1])-bnd)<0.6*k) continue;   /* у границы вида и разреза — ширина линии */
        const hh=hatched(p); if(C.opt.debug) p.why=name+' u='+U(i).toFixed(2)+' v='+Vv(j).toFixed(2)+' o='+(h&&h.o)+' t='+(h&&h.t.toFixed(2));
        if(sec&&!hh) bad1.push(p); else if(!sec&&hh) bad2.push(p); }
      if(C.opt.debug){ F.dbg=F.dbg||{vis:[],hid:[]}; F.dbg.bad=(F.dbg.bad||[]).concat(bad1.slice(0,5).map(p=>'1 '+p.why),bad2.slice(0,8).map(p=>'2 '+p.why)); }
      report(bad1,'штриховка — там, где сечение','сечение не заштриховано'); report(bad2,'штриховка — там, где сечение','заштриховано то, что не попало в секущую плоскость'); }
    tm('hatch',tq);
  };
  const VV=[['front',FV],['left',LV],['top',TV]]; VV.forEach(([n,w])=>one(n,w,true)); VV.forEach(([n,w])=>one(n,w,false));
  stats.ms=Object.fromEntries(Object.entries(T).map(([a,b])=>[a,Math.round(b)])); F.modelStats=stats; };
})();
