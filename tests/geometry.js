/* ═══════════ Проверка чертежей по 3D-модели ═══════════
   Идея: эпюр — это две проекции одного трёхмерного объекта. Если у точки есть A′ и A″, то она
   восстанавливается однозначно: x — общая абсцисса, y — отступ A′ от оси, z — отступ A″ от оси.
   Каждый чертёж сайта превращается в набор 3D-точек и прямых, и дальше всё проверяется числами:
     • линии связи, принадлежность, деление отрезка в одном отношении на обеих проекциях;
     • конкурирующие точки и видимость (штрих = точку закрывает плоскость, которая к нам ближе);
     • размеры на чертеже (|AB| = 35 мм, z=+25, Δy, углы) — по рисунку и по 3D-модели;
     • утверждения в тексте шагов: «AB ∥ CD», «K ∈ AB», «a и b скрещиваются», «A(25; 10; 30)»;
     • горизонталь/фронталь, следы плоскости.
   Запускается в браузере: GEOM_CHECK() → список нарушений. */
window.GEOM_CHECK=function(opts){
opts=opts||{};
const TOL=1.25, out=[];
const MARK=/(′|″|‴)$/, PN=/^(.+?)(′|″|‴)$/;
const strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&[a-z]+;/g,' ');
const d2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), nrm=a=>Math.hypot(...a);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const segT=(p,a,b)=>{ const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy; return l<1e-9?0:((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l; };
const segDist=(p,a,b)=>{ let t=Math.max(0,Math.min(1,segT(p,a,b))); return d2(p,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]); };
const lineDist=(p,a,b)=>{ const t=segT(p,a,b); return d2(p,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]); };
const cross2=(a,b,c,d)=>{ const r=sub(b,a), s=sub(d,c), den=r[0]*s[1]-r[1]*s[0]; if(Math.abs(den)<1e-9) return null;
  const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den, u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den; return {p:[a[0]+t*r[0],a[1]+t*r[1]],t,u}; };
const par2=(a,b,c,d)=>{ const r=sub(b,a), s=sub(d,c); return Math.abs(r[0]*s[1]-r[1]*s[0])<=0.012*nrm(r)*nrm(s); };
const num=s=>parseFloat(String(s).replace('−','-').replace(',','.'));

/* ───────── разбор одного чертежа ───────── */
function model(items){
  const pts={}, combo=new Set(), lines={}, segs={'′':[],'″':[]}, polys=[], texts=[], dims=[], angs=[];
  let axis=false, exotic=false, ax3=false;
  (items||[]).forEach(it=>{ if(!it) return;
    if(it.t==='axis') axis=true;
    if(it.t==='axis3') { axis=true; ax3=true; }                            /* три плоскости проекций: ось z — вертикаль через начало O */
    if(it.t==='pt'&&it.at&&it.l!=null){ const parts=strip(it.l).split(/\s*[≡=]\s*/);
      parts.forEach(n=>{ n=n.trim(); if(MARK.test(n)){ (pts[n]=pts[n]||[]).push(it.at); if(parts.length>1) combo.add(n); } }); }
    if((it.t==='seg'||it.t==='line'||it.t==='vec')&&it.a&&it.b){
      const l=strip(it.l||'').trim();
      if(/^[a-zа-яα-ω][₀-₉0-9]*[αβγδ]?(′|″|‴)$/.test(l)||/^[hf]₀[αβγδ]$/.test(l)) (lines[l]=lines[l]||[]).push([it.a,it.b]);
      segs.all=(segs.all||[]); segs.all.push({a:it.a,b:it.b,k:it.k||'main',l,it});
      if(/^\|?[A-ZА-Я]/.test(l)||/^Δ|^[xyz]\s*=/.test(l)) dims.push({a:it.a,b:it.b,l,it}); }
    if(it.t==='dim'&&it.a&&it.b&&it.l) dims.push({a:it.a,b:it.b,l:strip(it.l),it});
    if(it.t==='poly'&&it.p&&it.p.length>=3) polys.push({p:it.p,k:it.k||'main',close:!!it.close});
    if(it.t==='ang'&&it.at&&it.p1&&it.p2&&it.l) angs.push({at:it.at,p1:it.p1,p2:it.p2,l:strip(it.l)});
    if(it.t==='txt'&&it.at&&it.s) texts.push({s:strip(it.s),at:it.at}); });
  segs.all=segs.all||[];
  const uniq=n=>{ const a=pts[n]; if(!a) return null; return a.every(p=>d2(p,a[0])<TOL)?a[0]:null; };
  const bases=[...new Set(Object.keys(pts).map(n=>(PN.exec(n)||[])[1]).filter(Boolean))];
  /* 3D-точки: x = абсцисса, y = A′ под осью, z = A″ над осью (в единицах рисунка) */
  const P3={};
  if(!exotic) bases.forEach(b=>{ const p1=uniq(b+'′'), p2=uniq(b+'″'); if(p1&&p2&&Math.abs(p1[0]-p2[0])<=TOL) P3[b]=[(p1[0]+p2[0])/2,p1[1],-p2[1]]; });
  /* 3D-прямые с именем: a′ и a″ (не профильные) */
  const L3={};
  Object.keys(lines).forEach(l=>{ const m=/^(.+)″$/.exec(l); if(!m||!lines[m[1]+'′']) return;
    const [a2,b2]=lines[l][0], [a1,b1]=lines[m[1]+'′'][0];
    if(Math.abs(b2[0]-a2[0])<1e-6||Math.abs(b1[0]-a1[0])<1e-6) return;
    const at=x=>{ const t2=(x-a2[0])/(b2[0]-a2[0]), t1=(x-a1[0])/(b1[0]-a1[0]); return [x,a1[1]+t1*(b1[1]-a1[1]),-(a2[1]+t2*(b2[1]-a2[1]))]; };
    const x0=Math.max(Math.min(a2[0],b2[0]),Math.min(a1[0],b1[0])), x1=Math.min(Math.max(a2[0],b2[0]),Math.max(a1[0],b1[0]));
    L3[m[1]]={p:at(x0), q:at(x0===x1?x0+10:x1), name:m[1]}; });
  return {pts,combo,lines,segs,polys,texts,dims,angs,axis,ax3,exotic,uniq,bases,P3,L3};
}

/* 3D-прямая по имени: «AB», «A₁B₁» — по точкам; «a», «h₁» — по подписанным проекциям */
function line3(M,tok){
  if(M.L3[tok]) return M.L3[tok];
  const m=/^([A-ZА-Я][₀-₉0-9]*)([A-ZА-Я][₀-₉0-9]*)$/.exec(tok); if(!m) return null;
  const A=M.P3[m[1]], B=M.P3[m[2]]; if(!A||!B||nrm(sub(B,A))<1e-6) return null; return {p:A,q:B,name:tok};
}
const dir=L=>{ const v=sub(L.q,L.p), n=nrm(v); return v.map(c=>c/n); };
function rel3(L,K){
  const u=dir(L), v=dir(K), n=crs(u,v), sn=nrm(n), w=sub(K.p,L.p);
  if(sn<0.012) return nrm(crs(w,u))<TOL*1.2?'совпадают':'параллельны';
  const dist=Math.abs(dot(w,n))/sn; return dist<TOL*1.2?'пересекаются':'скрещиваются';
}
const distPL=(P,L)=>{ const u=dir(L); return nrm(crs(sub(P,L.p),u)); };

/* ───────── правила ───────── */
function check(name,items,text,ctx){
  const M=model(items), {pts,combo,lines,uniq,bases,P3}=M; ctx=ctx||{};
  const add=(rule,msg,lvl)=>out.push({name,rule,msg,lvl:lvl||'ошибка'});
  /* 1. линии связи */
  bases.forEach(b=>{ const p1=uniq(b+'′'), p2=uniq(b+'″'), p3=uniq(b+'‴');
    if(p1&&p2&&!M.exotic&&Math.abs(p1[0]-p2[0])>TOL) add('линия связи',b+'′ и '+b+'″ не на одной вертикали (Δ='+Math.abs(p1[0]-p2[0]).toFixed(1)+')');
    if(p2&&p3&&Math.abs(p2[1]-p3[1])>TOL) add('линия связи',b+'″ и '+b+'‴ не на одной горизонтали (Δ='+Math.abs(p2[1]-p3[1]).toFixed(1)+')');
    /* в системе трёх плоскостей: расстояние A‴ от оси z равно расстоянию A′ от оси x (это координата y) */
    if(M.ax3&&p1&&p3&&Math.abs(p3[0]-p1[1])>TOL*1.5) add('линия связи',b+'‴ отстоит от оси z на '+p3[0].toFixed(1)+', а '+b+'′ от оси x на '+p1[1].toFixed(1)+' — координата y не совпадает'); });
  /* 1б. одна и та же подпись дважды — на экране раскладка подписей разведёт их, и имя появится два раза */
  const lab={}; (items||[]).forEach(it=>{ if(it&&it.t==='pt'&&it.l){ const l=strip(it.l).trim(); if(l) (lab[l]=lab[l]||[]).push(it.at); } });
  Object.keys(lab).forEach(l=>{ if(lab[l].length>1&&MARK.test(l)&&!lab[l].every(p=>d2(p,lab[l][0])<0.5)) add('двойная подпись','«'+l+'» стоит в '+lab[l].length+' разных местах — одна точка не может иметь две проекции на одной плоскости'); });
  /* 2. «1″≡2″» — действительно одна точка */
  Object.keys(pts).forEach(n=>{ if(combo.has(n)&&!uniq(n)) add('совпадение','«'+n+'» подписана как совпадающая, но стоит в разных местах'); });
  /* 3. принадлежность и простое отношение.
     Ребро на проекции = нарисованный отрезок, на котором лежат две подписанные точки (A″, B″).
     Если K″ лежит на A″B″ и K′ на A′B′ — отношения AK:KB должны совпасть (иначе K ∉ AB).
     Если K″ на A″B″, а K′ мимо A′B′ — нарушение, кроме законных случаев (конкурирующие точки, след
     вспомогательной проецирующей плоскости). */
  const onDrawn=(mk,A,B,K)=>M.segs.all.some(s=>s.k!=='thin'&&[A,B,K].every(P=>segDist(P,s.a,s.b)<TOL))   /* тонкие осевые линии — не рёбра */ || M.polys.some(pl=>{ const q=pl.p.concat(pl.close?[pl.p[0]]:[]); for(let i=0;i+1<q.length;i++) if([A,B,K].every(P=>segDist(P,q[i],q[i+1])<TOL)) return true; return false; });
  const named=bases.filter(b=>P3[b]);
  const edgesOf=(K,mk)=>{ const r=[]; const k=uniq(K+mk); if(!k) return r;
    for(let i=0;i<named.length;i++) for(let j=i+1;j<named.length;j++){ const A=named[i],B=named[j]; if(A===K||B===K) continue;
      const a=uniq(A+mk), b=uniq(B+mk); if(!a||!b||d2(a,b)<6) continue;
      if(lineDist(k,a,b)<TOL&&onDrawn(mk,a,b,k)) r.push(A+'|'+B); } return r; };
  named.forEach(K=>{ const E2=edgesOf(K,'″'), E1=edgesOf(K,'′');
    const both=E2.filter(e=>E1.includes(e));
    both.forEach(e=>{ const [A,B]=e.split('|'); const t2=segT(uniq(K+'″'),uniq(A+'″'),uniq(B+'″')), t1=segT(uniq(K+'′'),uniq(A+'′'),uniq(B+'′'));
      const len=Math.max(d2(uniq(A+'″'),uniq(B+'″')),d2(uniq(A+'′'),uniq(B+'′')));
      if(Math.abs(t1-t2)*len>TOL*1.5) add('деление отрезка',K+' на A′B′ и A″B″ делит '+A+B+' в разных отношениях ('+t1.toFixed(3)+' и '+t2.toFixed(3)+'): точка не принадлежит '+A+B); });
    if(combo.has(K+'″')||combo.has(K+'′')) return;
    const twin=mk=>Object.keys(pts).some(n=>n.endsWith(mk)&&n!==K+mk&&uniq(n)&&d2(uniq(n),uniq(K+mk))<TOL);
    if(both.length) return;                                                     /* точка задана ребром, на котором лежит на обеих проекциях */
    [['″','′',E2],['′','″',E1]].forEach(([mk,ot,E])=>{ if(!E.length||twin(mk)) return;
      E.forEach(e=>{ const [A,B]=e.split('|'); const a=uniq(A+ot), b=uniq(B+ot), k=uniq(K+ot); if(!onDrawn(ot,a,b,a)) return;
        if(Math.abs(a[0]-b[0])<TOL) return;                                       /* профильная прямая: судим по отношению, см. выше */
        /* след плоскости уровня или проецирующей плоскости: прямая ∥ x или ⊥ x на этой проекции, либо подписана как след/плоскость */
        const pa=uniq(A+mk), pb=uniq(B+mk); if(Math.abs(pa[1]-pb[1])<TOL||Math.abs(pa[0]-pb[0])<TOL) return;
        if(M.segs.all.some(sg=>/[αβγδθφ]|₀/.test(sg.l)&&lineDist(pa,sg.a,sg.b)<TOL&&lineDist(pb,sg.a,sg.b)<TOL)) return;
        /* след проецирующей плоскости: на прямой ≥2 «чужих» точек */
        const strays=named.filter(Q=>Q!==A&&Q!==B&&edgesOf(Q,mk).includes(e)&&!edgesOf(Q,ot).includes(e));
        if(strays.length>=2) return;
        /* две разные прямые одной проецирующей плоскости: K лежит на прямой KQ (видна на обеих проекциях), и на этой проекции KQ слилась с AB */
        if(named.some(Q=>Q!==K&&onDrawn(mk,uniq(K+mk),uniq(Q+mk),uniq(K+mk))&&onDrawn(ot,uniq(K+ot),uniq(Q+ot),uniq(K+ot))&&lineDist(uniq(Q+mk),pa,pb)<TOL)) return;
        if(lineDist(k,a,b)>TOL*2) add('принадлежность',K+mk+' лежит на '+A+mk+B+mk+', а '+K+ot+' не лежит на '+A+ot+B+ot,'проверить'); }); }); });
  /* 3б. то же для прямых с именем (a′, a″) */
  Object.keys(M.L3).forEach(l=>{ const L=M.L3[l];
    named.forEach(K=>{ const P=P3[K]; const on2=lines[l+'″'].some(([a,b])=>segDist(uniq(K+'″'),a,b)<TOL), on1=lines[l+'′'].some(([a,b])=>segDist(uniq(K+'′'),a,b)<TOL);
      if(on1&&on2&&distPL(P,L)>TOL*2) add('принадлежность',K+' лежит на '+l+'′ и '+l+'″, но в пространстве не на прямой '+l);
      if(on1!==on2&&!combo.has(K+'″')&&!combo.has(K+'′')){
        const mk=on2?'″':'′', ot=on2?'′':'″';
        if(named.some(Q=>Q!==K&&uniq(Q+mk)&&d2(uniq(Q+mk),uniq(K+mk))<TOL)) return;
        if(edgesOf(K,'″').some(e=>edgesOf(K,'′').includes(e))) return;
        const strays=named.filter(Q=>{ const s2=lines[l+mk].some(([a,b])=>segDist(uniq(Q+mk),a,b)<TOL), s1=lines[l+ot].some(([a,b])=>segDist(uniq(Q+ot),a,b)<TOL); return s2&&!s1; });
        if(strays.length>=2) return;
        if(Object.keys(lines).some(r=>r!==l+mk&&r.endsWith(mk)&&lines[r].some(([a,b])=>segDist(uniq(K+mk),a,b)<TOL&&par2(a,b,...lines[l+mk][0])))) return;
        add('принадлежность',K+mk+' лежит на '+l+mk+', а '+K+ot+' не лежит на '+l+ot,'проверить'); } }); });
  /* 4. конкурирующие точки: на «1″≡2″» сходятся две прямые — на другой проекции они должны разойтись */
  const yAt=(segs,x)=>{ for(const [a,b] of segs){ if(Math.abs(b[0]-a[0])<1e-9) continue; const t=(x-a[0])/(b[0]-a[0]); if(t>=-0.02&&t<=1.02) return a[1]+t*(b[1]-a[1]); } return null; };
  Object.keys(pts).filter(n=>combo.has(n)).forEach(n=>{ const m=PN.exec(n); if(!m||m[2]==='‴') return; const p=uniq(n); if(!p) return;
    const ot=m[2]==='″'?'′':'″';
    const thru=Object.keys(lines).filter(l=>l.endsWith(m[2])&&lines[l].some(([a,b])=>segDist(p,a,b)<TOL)).map(l=>l.replace(MARK,'')).filter(l=>lines[l+ot]);
    for(let i=0;i<thru.length;i++) for(let j=i+1;j<thru.length;j++){ const ya=yAt(lines[thru[i]+ot],p[0]), yb=yAt(lines[thru[j]+ot],p[0]);
      if(ya!=null&&yb!=null&&Math.abs(ya-yb)<=TOL) add('конкурирующие точки',n+': '+thru[i]+ot+' и '+thru[j]+ot+' сходятся на той же линии связи — прямые пересекаются, точки не конкурирующие'); }
    /* и сами точки: совпадают на этой проекции, различаются на другой */
    const names=strip(n).split(/\s*[≡=]\s*/); });
  Object.keys(pts).forEach(n=>{ if(!combo.has(n)) return; });
  /* 5. видимость: штрих — точку закрывает плоскость ближе к наблюдателю; сплошная — не закрывает */
  const tris=[];
  M.polys.filter(pl=>pl.close&&pl.p.length===3).forEach(pl=>{ });
  /* треугольники/многоугольники плоскостей по подписанным вершинам */
  const polysByMark=mk=>{ const r=[];
    M.polys.forEach(pl=>{ if(!/^(main|hid)$/.test(pl.k)) return; const vs=pl.p.map(q=>named.find(b=>uniq(b+mk)&&d2(uniq(b+mk),q)<TOL)); if(vs.every(Boolean)&&new Set(vs).size>=3) r.push(vs); });
    /* треугольники из отрезков: A″B″, B″C″, C″A″ нарисованы */
    const has=(A,B)=>M.segs.all.some(s=>/^(main|hid)$/.test(s.k)&&(d2(s.a,uniq(A+mk))<TOL&&d2(s.b,uniq(B+mk))<TOL)||(d2(s.b,uniq(A+mk))<TOL&&d2(s.a,uniq(B+mk))<TOL));
    for(let i=0;i<named.length;i++) for(let j=i+1;j<named.length;j++) for(let k=j+1;k<named.length;k++){ const A=named[i],B=named[j],C=named[k];
      if([A,B,C].every(X=>uniq(X+mk))&&has(A,B)&&has(B,C)&&has(C,A)) r.push([A,B,C]); }
    return r; };
  const inTri=(p,a,b,c,m)=>{ const s=(u,v,w)=>(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]); const d1=s(a,b,p),d2_=s(b,c,p),d3=s(c,a,p), ar=Math.abs(s(a,b,c));
    if(ar<1) return false; const mn=Math.min(d1,d2_,d3), mx=Math.max(d1,d2_,d3); const marg=m*Math.max(d2(a,b),d2(b,c),d2(c,a));
    return (mn>marg)||(mx<-marg); };
  ['″','′'].forEach(mk=>{
    const planes=polysByMark(mk).map(vs=>vs.slice(0,3)).filter(v=>v.every(b=>P3[b]));
    if(!planes.length) return;
    const depth=P=>mk==='″'?P[1]:P[2];                                     /* на π₂ ближе тот, у кого больше y; на π₁ — у кого больше z */
    M.segs.all.forEach(s=>{ if(!/^(main|res|grn|hid|resd|grnd)$/.test(s.k)) return; const dashed=/^(hid|resd|grnd)$/.test(s.k);
      /* отрезок должен лежать на прямой KL через подписанные точки — тогда известна его глубина */
      const host=[]; for(let i=0;i<named.length;i++) for(let j=i+1;j<named.length;j++){ const A=named[i],B=named[j], a=uniq(A+mk), b=uniq(B+mk); if(!a||!b||d2(a,b)<6) continue;
        if(lineDist(s.a,a,b)<TOL&&lineDist(s.b,a,b)<TOL) host.push([A,B]); }
      if(!host.length) return; const [A,B]=host[0];
      const mid=[(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2], t=segT(mid,uniq(A+mk),uniq(B+mk));
      const PA=P3[A], PB=P3[B], X=PA.map((v,i)=>v+t*(PB[i]-v));
      let cover=false, front=false, edgeOf=false;
      planes.forEach(([a,b,c])=>{ if([A,B].every(v=>[a,b,c].includes(v))) { edgeOf=true; return; }
        /* прямая лежит в этой плоскости — не закрывает сама себя */
        const n=crs(sub(P3[b],P3[a]),sub(P3[c],P3[a])), nn=nrm(n); if(nn<1e-6) return;
        if(Math.abs(dot(sub(PA,P3[a]),n))/nn<TOL*1.5&&Math.abs(dot(sub(PB,P3[a]),n))/nn<TOL*1.5) { edgeOf=true; return; }
        if(!inTri(mid,uniq(a+mk),uniq(b+mk),uniq(c+mk),0.02)) return;
        cover=true;
        /* глубина плоскости в этой точке проекции */
        const ax=mk==='″'?1:2;                                             /* неизвестная координата: y для π₂, z для π₁ */
        if(Math.abs(n[ax])<1e-9) return;
        const P=X.slice(); P[ax]=P3[a][ax]-(n[0]*(X[0]-P3[a][0])+n[ax===1?2:1]*(X[ax===1?2:1]-P3[a][ax===1?2:1]))/n[ax];
        if(depth(P)>depth(X)+TOL) front=true; });
      if(edgeOf&&!cover) return;
      if(dashed&&!front) add('видимость',A+B+' на '+(mk==='″'?'π₂':'π₁')+' показана штрихом, но в этом месте её ничто не закрывает');
      if(!dashed&&front&&s.k==='main') add('видимость',A+B+' на '+(mk==='″'?'π₂':'π₁')+' показана видимой, но здесь её закрывает плоскость','проверить'); }); });
  /* 6. размеры на чертеже.
     Масштаб у задач разный (крупные чертежи увеличены), поэтому мм проверяются так:
       а) без масштаба — длина отрезка с подписью |AB| совпадает с длиной AB по 3D-модели;
       б) все числа задачи (|AB| = …, z=+25, Δy = …, A(25; 10; 30)) дают один и тот же масштаб «px на мм»;
          число, которое выбивается из общего масштаба, — ошибка. */
  const smp=ctx.samples||[];
  M.dims.forEach(d=>{ const l=d.l; let m; const len=d2(d.a,d.b);
    if((m=/^([xyz])\s*=\s*([+−-]?\d+(?:[.,]\d+)?)/.exec(l))){ const v=num(m[2]); if(Math.abs(v)>0.5) smp.push({px:len,v:Math.abs(v),tol:0.6,what:'«'+l+'»',name});
      if(M.axis&&m[1]!=='x'){ const far=Math.abs(d.a[1])>Math.abs(d.b[1])?d.a:d.b; const sg=m[1]==='z'?-far[1]:far[1]; if(Math.abs(v)>0.5&&Math.abs(sg)>1&&Math.sign(sg)!==Math.sign(v)) add('размер','«'+l+'»: знак не совпадает с положением точки'); } }
    else if((m=/^(Δ[xyz])[₀-₉,]*\s*=\s*(\d+(?:[.,]\d+)?)\s*мм/.exec(l))) smp.push({px:len,v:num(m[2]),tol:0.6,what:'«'+l+'»',name});
    else if((m=/^\|?([A-ZА-Я][₀-₉0-9]*[A-ZА-Я][₀-₉0-9]*)\|?\s*([=≈])\s*(\d+(?:[.,]\d+)?)\s*мм/.exec(l))){ const v=num(m[3]), tol=m[2]==='='?0.6:Math.max(1.5,v*0.03);
      smp.push({px:len,v,tol,eq:m[2]==='='&&!/[.,]/.test(m[3]),what:'«'+l+'»',name});
      const L=line3(M,m[1]); if(L){ const r=nrm(sub(L.q,L.p)); if(Math.abs(r-len)>Math.max(TOL*2,0.02*r)) add('размер','«'+l+'»: отрезок на рисунке '+len.toFixed(1)+' px, а |'+m[1]+'| по проекциям '+r.toFixed(1)+' px'); } } });
  M.angs.forEach(a=>{ const m=/([=≈])\s*(\d+(?:[.,]\d+)?)°/.exec(a.l); if(!m) return; const v=num(m[2]);
    const u=sub(a.p1,a.at), w=sub(a.p2,a.at); const ang=Math.acos(Math.max(-1,Math.min(1,dot(u,w)/nrm(u)/nrm(w))))*180/Math.PI;
    const tol=m[1]==='='?1:2.5; if(Math.abs(ang-v)>tol&&Math.abs(180-ang-v)>tol) add('угол','«'+a.l+'»: на рисунке '+ang.toFixed(1)+'°'); });
  /* 7. горизонталь и фронталь, следы плоскости */
  Object.keys(lines).forEach(l=>{ const [a,b]=lines[l][0];
    if(/^h[₀-₉0-9]*″$/.test(l)&&/горизонтал(ь|и|ью|ей)(?![а-я])/i.test(text||'')&&Math.abs(a[1]-b[1])>TOL) add('горизонталь',l+' не параллельна оси x');
    if(/^f[₀-₉0-9]*′$/.test(l)&&/фронтал(ь|и|ью|ей)(?![а-я])/i.test(text||'')&&Math.abs(a[1]-b[1])>TOL) add('фронталь',l+' не параллельна оси x'); });
  ['α','β','γ','δ'].forEach(g=>{ const h=lines['h₀'+g], f=lines['f₀'+g]; if(!h||!f||!M.axis) return;
    const k=cross2(...h[0],...f[0]); if(!k) return; if(Math.abs(k.p[1])>TOL*1.5) add('следы плоскости','h₀'+g+' и f₀'+g+' пересекаются не на оси x'); });
  /* 8. утверждения в тексте */
  claims(name,M,text||'',smp,add);
}

/* ───────── утверждения из текста ───────── */
const LN='([A-ZА-Я][₀-₉0-9]*[A-ZА-Я][₀-₉0-9]*|[a-z][₀-₉0-9]*)';
function claims(name,M,text,smp,add){
  const sents=strip(text).split(/(?<=[.;!?:])\s+|\n+/);
  sents.forEach(s0=>{ const s=s0.trim(); if(!s) return;
    if(/\b(если|ли|бы|нельзя|допустим|предположим|проверим|пусть|когда|либо|или)\b|\?|не\s+(∥|⊥|∈|пересека|скрещива|параллел)/i.test(s)) return;
    let m;
    /* AB ∥ CD, AB ⊥ CD (в пространстве) — без штрихов */
    const re=new RegExp(LN+'\\s*(∥|⊥)\\s*'+LN+'(?![′″‴₀-₉A-Za-z])','g');
    while((m=re.exec(s))){ if(/[′″‴]/.test(s.slice(Math.max(0,m.index-1),m.index))||/через\s*$|[∥⊥]\s*$/.test(s.slice(Math.max(0,m.index-10),m.index))) continue;
      const L=line3(M,m[1]), K=line3(M,m[3]); if(!L||!K) continue;
      if(m[2]==='∥'&&!/параллельны|совпадают/.test(rel3(L,K))) add('утверждение «'+m[0]+'»','по проекциям '+m[1]+' и '+m[3]+' '+rel3(L,K)+' ⟨'+s.slice(0,160)+'⟩');
      if(m[2]==='⊥'){ const c=Math.abs(dot(dir(L),dir(K))); if(c>0.03) add('утверждение «'+m[0]+'»','угол между '+m[1]+' и '+m[3]+' = '+(Math.acos(c)*180/Math.PI).toFixed(1)+'°'); } }
    /* A″B″ ∥ C″D″, h′ ∥ h₀α, n′ ⊥ h′ — на проекции */
    const P2='([A-ZА-Я][₀-₉0-9]*([′″])[A-ZА-Я][₀-₉0-9]*[′″]|[a-z][₀-₉0-9]*[αβγδ]?[′″]|[hf]₀[αβγδ])';
    const re2=new RegExp(P2+'\\s*(∥|⊥)\\s*'+P2,'g');
    while((m=re2.exec(s))){ const g=t=>{ if(M.lines[t]) return M.lines[t][0]; const q=/^([A-ZА-Я][₀-₉0-9]*)([′″])([A-ZА-Я][₀-₉0-9]*)[′″]$/.exec(t); if(!q) return null; const a=M.uniq(q[1]+q[2]), b=M.uniq(q[3]+q[2]); return a&&b&&d2(a,b)>3?[a,b]:null; };
      const A=g(m[1]), B=g(m[4]); if(!A||!B) continue;
      const u=sub(A[1],A[0]), v=sub(B[1],B[0]), c=dot(u,v)/nrm(u)/nrm(v);
      if(m[3]==='∥'&&Math.abs(Math.abs(c)-1)>2e-4) add('утверждение «'+m[0]+'»','на рисунке угол '+(Math.acos(Math.min(1,Math.abs(c)))*180/Math.PI).toFixed(1)+'°');
      if(m[3]==='⊥'&&Math.abs(c)>0.02) add('утверждение «'+m[0]+'»','на рисунке угол '+(Math.acos(Math.abs(c))*180/Math.PI).toFixed(1)+'°'); }
    /* K ∈ AB / K ∈ a */
    const re3=new RegExp('([A-ZА-Я0-9][₀-₉0-9]*)\\s*∈\\s*'+LN+'(?![′″‴A-Za-z₀-₉])','g');
    while((m=re3.exec(s))){ const P=M.P3[m[1]], L=line3(M,m[2]); if(!P||!L) continue; if(distPL(P,L)>TOL*2) add('утверждение «'+m[0]+'»','точка в '+distPL(P,L).toFixed(1)+' px от прямой'); }
    /* «a и b пересекаются / скрещиваются / параллельны» */
    const re4=new RegExp('(?:прямые\\s+)?'+LN+'\\s+и\\s+'+LN+'\\s*(?:—\\s*)?(пересекающиеся|скрещивающиеся|параллельные|пересекаются|скрещиваются|параллельны)','g');
    while((m=re4.exec(s))){ if(/[∥⊥∈]\s*$|через\s*$/.test(s.slice(Math.max(0,m.index-10),m.index))) continue; const L=line3(M,m[1]), K=line3(M,m[2]); if(!L||!K) continue; const r=rel3(L,K), c=m[3].slice(0,6);
      const want={'пересе':'пересекаются','скрещи':'скрещиваются','паралл':'параллельны'}[c]; if(r!==want&&!(want==='параллельны'&&r==='совпадают')) add('утверждение «'+m[0]+'»','по проекциям '+m[1]+' и '+m[2]+' '+r+' ⟨'+s.slice(0,160)+'⟩'); }
    /* |AB| = 35 мм в тексте */
    const re5=new RegExp('\\|'+LN+'\\|\\s*([=≈])\\s*(\\d+(?:[.,]\\d+)?)\\s*мм','g');
    while((m=re5.exec(s))){ const L=line3(M,m[1]); if(!L||/[a-z]/.test(m[1][0])) continue; const v=num(m[3]), tol=m[2]==='='?0.6:Math.max(1.5,v*0.03);
      smp.push({px:nrm(sub(L.q,L.p)),v,tol,eq:m[2]==='='&&!/[.,]/.test(m[3]),what:'«'+m[0]+'» (текст)',name}); }
    /* координаты A(25; 10; 30): x отсчитывается влево от начала, y — вниз от оси на π₁, z — вверх на π₂ */
    const re6=/([A-ZА-Я][₀-₉0-9]*)\s*\(\s*([−-]?\d+(?:,\d+)?)\s*;\s*([−-]?\d+(?:,\d+)?)\s*;\s*([−-]?\d+(?:,\d+)?)\s*\)/g;
    while((m=re6.exec(s))){ const P=M.P3[m[1]]; if(!P||!M.axis) continue; const want=[-num(m[2]),num(m[3]),num(m[4])];
      want.forEach((v,i)=>{ if(Math.abs(v)<0.5){ if(Math.abs(P[i])>TOL*1.5) add('координаты',m[0]+': координата '+'xyz'[i]+' = 0, а точка не на оси'); return; }
        if(Math.sign(P[i])!==Math.sign(v)) add('координаты',m[0]+': знак '+'xyz'[i]+' не совпадает с чертежом');
        else smp.push({px:Math.abs(P[i]),v:Math.abs(v),tol:0.6,what:m[0]+' · '+'xyz'[i],name}); }); }
  });
}

/* ───────── обход сайта ───────── */
const TX=o=>[o&&o.t,o&&o.d,o&&o.why,o&&o.q,o&&o.intro,o&&o.note,o&&o.c,o&&o.cap].filter(x=>typeof x==='string').join('\n');
const partsOf=t=>(t.parts&&t.parts.length)?t.parts.map(p=>Object.assign({given:t.given||[]},p)):[{given:t.given||[],steps:t.steps||[]}];
/* общий масштаб задачи: медиана px/мм по всем числам; число, выбивающееся из него, — ошибка */
const scale=(name,smp)=>{ const u=[]; const seen=new Set(); smp.forEach(o=>{ const k=o.what+'|'+o.px.toFixed(1); if(seen.has(k)) return; seen.add(k); u.push(o); });
  if(u.length<2) return; const rs=u.map(o=>o.px/o.v).sort((a,b)=>a-b), S=rs[Math.floor(rs.length/2)];
  const ok=u.filter(o=>Math.abs(o.px/S-o.v)<=o.tol).length; if(ok<Math.max(2,u.length/2)) return;   /* нет устойчивого масштаба — не судим */
  u.forEach(o=>{ if(Math.abs(o.px/S-o.v)>o.tol) out.push({name:o.name,rule:'число',msg:o.what+': при общем масштабе задачи ('+S.toFixed(2)+' px/мм) получается '+(o.px/S).toFixed(1),lvl:'ошибка'}); });
  /* точность: «= 35 мм» допустимо, только если величина действительно 35 (до округления 0,1 мм); иначе пишут «≈».
     Масштаб берём по самим точным числам: у верного «=» отношение px/мм одинаково до 0,3 %. */
  const ex=u.filter(o=>o.eq); if(ex.length<2) return; const rx=ex.map(o=>o.px/o.v).sort((a,b)=>a-b), Sx=rx[Math.floor(rx.length/2)];
  if(ex.filter(o=>Math.abs(o.px/Sx-o.v)<=0.12).length<2) return;
  ex.forEach(o=>{ const t=o.px/Sx; if(Math.abs(t-o.v)>0.12&&Math.abs(t-o.v)<=o.tol) out.push({name:o.name,rule:'точность',msg:o.what+': точное значение '+t.toFixed(2)+' — нужно «≈», а не «=»',lvl:'ошибка'}); }); };
const task=(name,t)=>{ try{ partsOf(t).forEach((p,pi)=>{ const nm=name+(pi?' п.'+(pi+1):''); let acc=(p.given||[]).slice(), txt=TX(t)+'\n'+TX(p); const samples=[];
    check(nm+' · дано',acc,txt,{samples});
    (p.steps||[]).forEach((st,k)=>{ acc=acc.concat(st.add||[]); check(nm+' · шаг '+(k+1),acc,TX(st),{samples}); });
    scale(nm,samples); }); }catch(e){ out.push({name,rule:'сбой проверки',msg:String(e&&e.stack||e),lvl:'ошибка'}); } };
if(opts.items){ const samples=[]; check(opts.name||'проверка',opts.items,opts.text||'',{samples}); scale(opts.name||'проверка',samples); return out; }
if(opts.modelOf) return model(opts.modelOf);
if(opts.tasks){ opts.tasks.forEach(t=>task('Задача №'+t.n,t)); return out; }
try{ COURSE.forEach(l=>(l.blocks||[]).forEach((b,i)=>{ if(b.t==='fig'&&b.scene) { const samples=[]; check('Урок '+l.id+' · рисунок '+(i+1),b.scene.items,b.cap,{samples}); scale('Урок '+l.id+' · рисунок '+(i+1),samples); } })); }catch(e){ out.push({name:'COURSE',rule:'сбой проверки',msg:String(e),lvl:'ошибка'}); }
try{ WB3.tasks.forEach(t=>task('Задача №'+t.n,t)); }catch(e){ out.push({name:'WB3',rule:'сбой проверки',msg:String(e),lvl:'ошибка'}); }
try{ (typeof TK3!=='undefined'?TK3:[]).forEach(tk=>tk.tasks.forEach(t=>task(tk.title+' · '+(t.idx||t.key),t))); }catch(e){}
try{ ['1','2','3','4a','4b','5'].forEach(id=>{ const d=window.NGHW&&NGHW.get(id); if(d&&d.task) task('ДЗ '+id,d.task); }); }catch(e){}
const seen=new Set();
return out.filter(o=>{ const k=o.name.replace(/ · (шаг \d+|дано)$/,'')+'|'+o.rule+'|'+o.msg; if(seen.has(k)) return false; seen.add(k); return true; });
};
