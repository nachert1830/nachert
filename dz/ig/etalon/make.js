/* ═══════════ Эталон шагов ИГ: публичные шаги картинками + полные данные «каждая линия» ═══════════
   node dz/ig/etalon/make.js ig6 5
   → lk/etalon-ig6-5/index.html  — шаги для всех: на шаге один элемент на одном виде, его источник и линии связи (высота —
     горизонтальной линией связи, координата y — отрезком от осей эпюра x и z, радиус дуги шара — со следа грани); подсветка гаснет на следующем шаге
   → dz/ig/6/lines/v05.json      — каждая линия каждого вида: элемент, поверхности (чьё пересечение), как построена
     (откуда высота, y, радиус), на каком шаге появилась. Сайт файл не грузит; его читает ассистент. Формат — dz/ig/etalon/README.md */
const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');const ROOT=path.join(__dirname,'..','..','..');
const ID=process.argv[2]||'ig6', N=+(process.argv[3]||5);
(async()=>{const srv=await new Promise(res=>{const s=http.createServer((q,r)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f.endsWith('/'))f+='index.html';const p=path.join(ROOT,f);if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});fs.createReadStream(p).pipe(r);}).listen(0,'127.0.0.1',()=>res(s));});
const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://127.0.0.1:'+srv.address().port+'/#/dz');await p.waitForTimeout(1500);
const RES=await p.evaluate(([ID,N])=>{
  const m=DZR.get(ID).part(N), W=900, S=420, k0=S/W, X0=20, Y0=16, TOPY=Y0+S-20, b=m.box, R=b[1][0];
  const INK='#1f2533', HL='#e8336d', LINK='#e8336d', GREY='#a7afbd', ERASE='#c9302c';
  const f=v=>Math.round(v*10)/10;
  const DF=IG3.drawing(m,'front0',W), DT=IG3.drawing(m,'top',W), DL=IG3.drawing(m,'left0',W);
  const GF=IG3.drawing({tree:m.givenF,box:b},'front0',W), GT=IG3.drawing({tree:m.givenTop,box:b},'top',W);
  const VP={F:[X0,Y0],T:[X0,TOPY],L:[X0+S,Y0]}, DD={F:DF,T:DT,L:DL};
  const P=(v,q)=>{ const t=DD[v].px(q), o=VP[v]; return [o[0]+t[0]*k0,o[1]+t[1]*k0]; };
  const sp=IGUI.igSpec(m);
  /* элементы детали по порядку построения: шар, полость, отверстия K */
  const T=m.tree, FE=[T.a].concat(T.k), J=FE.map(n=>IG3.jc(n));
  const inF=n=>m.givenF.k&&m.givenF.k.includes(n), inT=n=>m.givenTop.k&&m.givenTop.k.includes(n);
  const featOf=s=>{ for(let i=FE.length-1;i>=0;i--) if(Math.abs(J[i](...s.a3))<0.35&&Math.abs(J[i](...s.b3))<0.35) return i; return 0; };
  const remOf=s=>{ const mid=[0,1,2].map(j=>(s.a3[j]+s.b3[j])/2); for(let i=FE.length-1;i>=1;i--) if(J[i](...mid)<0.05) return i; return -1; };
  const key=s=>Math.round((s.a[0]+s.b[0])/2)+','+Math.round((s.a[1]+s.b[1])/2);
  const has=(L)=>{ const H=new Set(); L.forEach(s=>{ const x=Math.round((s.a[0]+s.b[0])/2), y=Math.round((s.a[1]+s.b[1])/2); for(let a=-1;a<=1;a++) for(let c=-1;c<=1;c++) H.add((x+a)+','+(y+c)); }); return s=>H.has(key(s)); };
  /* линии каждого вида: дано / новые (по элементам) / стёртые (по элементам) */
  const V={};
  [['F',DF,GF],['T',DT,GT],['L',DL,null]].forEach(([v,D,G])=>{ const inG=G?has(G.lines):()=>false, inD=has(D.lines);
    V[v]={given:D.lines.filter(s=>inG(s)), neu:D.lines.filter(s=>!inG(s)).map(s=>({s,fe:featOf(s)})), rem:G?G.lines.filter(s=>!inD(s)).map(s=>({s,fe:remOf(s)})):[]}; });
  const seg=(v,L,col,w,op)=>{ if(!L.length) return ''; const o=VP[v], pp=IG3.paths(L), sw=DD[v].sw*(w||1), A=op?` opacity="${op}"`:'';
    return `<g transform="translate(${o[0]} ${o[1]}) scale(${k0})">`+(pp.h?`<path d="${pp.h}" stroke="${col}" stroke-width="${f(sw*0.55)}" stroke-dasharray="${f(2.5*DD[v].mm)} ${f(1.2*DD[v].mm)}" fill="none"${A}/>`:'')
      +(pp.v?`<path d="${pp.v}" stroke="${col}" stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round" fill="none"${A}/>`:'')+'</g>'; };
  const ln=(a,c,col,w,dash,op)=>`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(c[0])}" y2="${f(c[1])}" stroke="${col}" stroke-width="${w}"${dash?` stroke-dasharray="${dash}"`:''}${op?` opacity="${op}"`:''}/>`;
  const dot=(q,col,r)=>`<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${r||3.2}" fill="${col}"/>`;
  const AX='10 3 2 3';
  const axes=v=>{ const c=P(v,[0,0,0]), e=(R+6)*DD[v].mm*k0; return ln([c[0]-e,c[1]],[c[0]+e,c[1]],INK,.6,AX)+ln([c[0],c[1]-e],[c[0],c[1]+e],INK,.6,AX); };
  /* линия под 45°: горизонталь с вида сверху и вертикаль с вида слева встречаются на ней (одна и та же глубина y) */
  /* оси эпюра: x — между главным видом и видом сверху, z — между главным видом и видом слева, O — их пересечение;
     глубина y — расстояние от оси x вниз на виде сверху и от оси z вправо на виде слева: переходит дугой из O */
  const FB=P('F',[0,0,-R])[1], TT=P('T',[0,R,0])[1], OY=(FB+TT)/2, OX=P('L',[0,0,0])[0]-(P('T',[0,0,0])[1]-OY), O=[OX,OY];
  const tx=(t,q,a,col)=>`<text x="${f(q[0])}" y="${f(q[1])}" font-style="italic" font-family="Georgia,serif" font-size="17" fill="${col||'#6b7486'}" text-anchor="${a||'middle'}">${t}</text>`;
  const epure=()=>{ const col='#a7afbd', xl=VP.F[0]+2, yb=P('T',[0,-R-6,0])[1], xr=P('L',[0,-R-6,0])[0], zt=VP.F[1]+2;
    return ln([xl,OY],[OX,OY],col,1)+ln([OX,zt],[OX,OY],col,1)+ln([OX,OY],[OX,yb],col,1)+ln([OX,OY],[xr,OY],col,1)
      +tx('x',[xl+4,OY-8],'start')+tx('z',[OX+9,zt+14],'start')+tx('y',[OX+9,yb],'start')+tx('y',[xr,OY+20],'end')+tx('O',[OX-8,OY+20],'end'); };
  /* отмеренный отрезок (координата, радиус): полупрозрачная полоса + линия с засечками на концах */
  const bar=(a,c,HL)=>{ const dx=c[0]-a[0], dy=c[1]-a[1], l=Math.hypot(dx,dy)||1, nx=-dy/l*5, ny=dx/l*5;
    return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(c[0])}" y2="${f(c[1])}" stroke="${HL}" stroke-width="8" stroke-opacity=".18" stroke-linecap="round"/>`+ln(a,c,HL,1.6)
      +ln([a[0]-nx,a[1]-ny],[a[0]+nx,a[1]+ny],HL,1.6)+ln([c[0]-nx,c[1]-ny],[c[0]+nx,c[1]+ny],HL,1.6); };
  /* координата y: на виде сверху — от оси x до точки, на виде слева — тот же отрезок от оси z */
  const BY='#2f6bff', BR='#7c4dff';
  const depth=(t,a)=>bar([t[0],OY],t,BY)+bar([OX,a[1]],a,BY);
  const glow=(html)=>html.replace(/<path /g,'<path filter="url(#gl)" ');
  /* шаги: что строим (элемент fe на виде v), откуда (вид-источник) */
  const ST=[{kind:'given'}];
  FE.forEach((n,i)=>{ const src=i<2?'F':inF(n)?'F':inT(n)?'T':'F';
    ['F','T','L'].forEach(v=>{ if(v===src&&i>=2) return; if(V[v].neu.some(q=>q.fe===i)||V[v].rem.some(q=>q.fe===i)) ST.push({kind:'feat',fe:i,v,src}); }); });
  ST.push({kind:'secL'},{kind:'aa'},{kind:'done'});
  const out=[];
  ST.forEach((st,si)=>{ let o='', top='';
    const done=(v,q)=>ST.slice(1,si).some(t=>t.kind==='feat'&&t.v===v&&t.fe===q.fe);
    const secLdone=ST.slice(0,si).some(t=>t.kind==='secL')||st.kind==='secL', aaDone=ST.slice(0,si).some(t=>t.kind==='aa')||st.kind==='aa';
    ['F','T','L'].forEach(v=>{ o+=axes(v);
      if(v==='L'&&secLdone){ const d=IG3.drawing(m,sp.lk,W,0,sp.yb); o+=`<image href="${d.url}" x="${VP.L[0]}" y="${VP.L[1]}" width="${S}" height="${S}"/>`; return; }
      if(v==='T'&&aaDone){ const top0=IG3.drawing(m,'topNH',W), cut=IG3.drawing(m,'topcut',W,m.hz.z), c=P('T',[0,0,0]), img=d=>`<image href="${d.url}" x="${VP.T[0]}" y="${VP.T[1]}" width="${S}" height="${S}"/>`;
        o+=sp.H==='full'?img(cut):sp.H==='halfD'?`<defs><clipPath id="a${si}"><rect x="0" y="0" width="2000" height="${f(c[1])}"/></clipPath><clipPath id="b${si}"><rect x="0" y="${f(c[1])}" width="2000" height="2000"/></clipPath></defs><g clip-path="url(#a${si})">${img(top0)}</g><g clip-path="url(#b${si})">${img(cut)}</g>`
          :`<defs><clipPath id="a${si}"><rect x="0" y="0" width="${f(c[0])}" height="2000"/></clipPath><clipPath id="b${si}"><rect x="${f(c[0])}" y="0" width="2000" height="2000"/></clipPath></defs><g clip-path="url(#a${si})">${img(top0)}</g><g clip-path="url(#b${si})">${img(cut)}</g>`;
        return; }
      const finished=st.kind==='done'||st.kind==='secL'||st.kind==='aa';
      o+=seg(v,V[v].given.filter(s=>!V[v].rem.some(q=>q.s===s)),INK);
      /* стёртые: пока их элемент не построен на этом виде — как в задании */
      o+=seg(v,V[v].rem.filter(q=>!(finished||done(v,q)||(st.kind==='feat'&&st.v===v&&st.fe===q.fe))).map(q=>q.s),INK);
      o+=seg(v,V[v].neu.filter(q=>finished||done(v,q)).map(q=>q.s),INK);
      if(st.kind==='feat'&&st.v===v){ o+=seg(v,V[v].rem.filter(q=>q.fe===st.fe).map(q=>q.s),ERASE,1,.35); { const NL=V[v].neu.filter(q=>q.fe===st.fe).map(q=>q.s); top+=seg(v,NL,HL,4,.16)+seg(v,NL,HL,1.3); } } });
    o+=epure();
    if(st.kind==='feat'){ const fe=st.fe, v=st.v, src=st.src;
      /* источник: этот элемент на виде, где он дан */
      const srcL=(src==='F'?(fe<2?V.F.given:V.F.given):V.T.given).filter(s=>featOf(s)===fe);
      top+=seg(src,srcL,HL,4,.16)+seg(src,srcL,HL,1.5);
      /* концы новых линий — линии связи */
      const E=IG4S.elements(V[v].neu.filter(q=>q.fe===fe).map(q=>q.s)), ends=[], seen=[];
      /* настоящие концы: на виде к точке подходит не ровно два куска (стык двух обрывков одной линии — не конец) */
      const EP=[]; E.forEach(e=>[e.key[0],e.key[e.key.length-1]].forEach(q=>{ const t=P(v,q), o=EP.find(u=>Math.hypot(u.t[0]-t[0],u.t[1]-t[1])<2.5); if(o) o.n++; else EP.push({t,q,n:1}); }));
      EP.filter(u=>u.n!==2).forEach(u=>{ if(seen.some(w=>Math.hypot(w[0]-u.t[0],w[1]-u.t[1])<6)) return; seen.push(u.t); ends.push(u.q); });
      /* вид сверху по вертикальным линиям связи: на одной линии связи точки нужны только на её концах */
      if(v==='T'||v==='F'){ const G={}; ends.forEach(q=>{ const t=P(v,q), k=Math.round(t[0]/3); (G[k]=G[k]||[]).push({q,t}); });
        ends.length=0; Object.values(G).forEach(g=>{ g.sort((u,w)=>u.t[1]-w.t[1]); ends.push(g[0].q); if(g.length>1) ends.push(g[g.length-1].q); }); }
      let links='', dots='', bars=''; const RAD=new Set(), YS=[];
      const usesDepth=v==='L';
      ends.forEach(q=>{ const a=P(v,q);
        if(v==='T'&&src==='F') links+=ln(P('F',q),a,LINK,1);
        if(v==='F'&&src==='T') links+=ln(P('T',q),a,LINK,1);
        if(v==='L'){ links+=ln(P('F',q),a,LINK,1); if(q[1]<=0.3) YS.push({q,t:P('T',q),a}); }
        dots+=`<circle cx="${f(a[0])}" cy="${f(a[1])}" r="3.4" fill="#fff" stroke="${HL}" stroke-width="1.8"/>`; });
      /* координата y (передняя половина — задняя симметрична): на виде сверху — по линии связи от оси x до точки;
         на виде слева — тот же отрезок от оси z, вынесен на свою дорожку, как размерная линия */
      { const U=[]; YS.sort((u,w)=>Math.abs(u.q[1])-Math.abs(w.q[1])).forEach(u=>{ if(!U.some(w=>Math.abs(w.q[1]-u.q[1])<0.6)) U.push(u); });
        const cz=P('L',[0,0,0])[1], lane={};
        U.forEach(u=>{ const d=Math.abs(u.q[1]); if(d<0.6) return; const side=u.a[1]>=cz-1?1:-1, kz=Math.round(u.a[1]/4)+'|'+side, i=lane[kz]=(lane[kz]||0)+1, yy=u.a[1]+side*(12+14*(i-1));
          bars+=bar([u.t[0],OY],u.t,BY)+bar([OX,yy],[u.a[0],yy],BY)+ln(u.a,[u.a[0],yy+side*3],BY,.9); }); }
      /* дуги среза шара — циркулем из центра: центр и радиус */
      E.filter(e=>e.curve&&e.key.length>2).forEach(e=>{ const c=P(v,[0,0,0]), ds=e.key.map(q=>{ const t=P(v,q); return Math.hypot(t[0]-c[0],t[1]-c[1]); });
        const pa=P(v,e.key[0]), pb=P(v,e.key[e.key.length-1]), pm=P(v,e.key[e.key.length>>1]), ch=Math.hypot(pb[0]-pa[0],pb[1]-pa[1])||1, sag=Math.abs((pm[0]-pa[0])*(pb[1]-pa[1])-(pm[1]-pa[1])*(pb[0]-pa[0]))/ch;
        const r0=ds[0]; if(!(r0>4&&sag>4&&ds.every(d=>Math.abs(d-r0)<0.03*r0))) return;
        /* дуга среза шара: радиус берём там, где грань видна прямой (след) — от оси до контура сферы; тем же радиусом из центра */
        const K=e.key, avg=j=>K.reduce((a,q)=>a+q[j],0)/K.length, Q=avg3=K.reduce((a,q)=>a+Math.hypot(...q),0)/K.length;
        const ax=v==='L'?0:v==='T'?2:1, ab=K.map(q=>Math.abs(q[ax])).sort((x,y)=>x-y), sgn=K.some(q=>q[ax]>0.3)?1:-1, cc=sgn*ab[ab.length>>1],   /* совпавшие дуги граней ±c — берём видимую */ h=Math.sqrt(Math.max(0,Q*Q-cc*cc)), kk=`${v}${ax}${cc.toFixed(0)}${Q.toFixed(0)}`; if(RAD.has(kk)) return; RAD.add(kk);
        let A3,B3,sv; if(v==='L'){ A3=[cc,0,0]; B3=[cc,0,avg(2)>=0?h:-h]; sv='F'; } else if(v==='T'){ const sg=avg(0)>=0?1:-1; A3=[0,0,cc]; B3=[sg*h,0,cc]; sv='F'; } else { const sg=avg(0)>=0?1:-1; A3=[0,cc,0]; B3=[sg*h,cc,0]; sv='T'; }
        const ra=P(sv,A3), rb=P(sv,B3), t=P(v,K[K.length>>1]);
        bars+=bar(ra,rb,BR)+bar(c,t,BR)+`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="3" fill="${BR}"/>`; });
      top=links+bars+top+dots; }
    if(st.kind==='secL'){ /* секущая плоскость — профильная через ось: её след на главном виде и виде сверху */
      top+=ln(P('F',[0,0,R+10]),P('F',[0,0,-R-10]),HL,2.4,'16 5 3 5')+ln(P('T',[0,R+10,0]),P('T',[0,-R-10,0]),HL,2.4,'16 5 3 5'); }
    if(st.kind==='aa'){ const z=m.hz.z; top+=ln(P('F',[-R-14,0,z]),P('F',[R+14,0,z]),HL,2.4,'16 5 3 5'); }
    out.push(`<svg viewBox="0 0 ${2*S+2*X0} ${TOPY+S+6}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/>${o}${top}</svg>`); });

  /* ═══ полные данные: каждая линия каждого вида — из чего она и как построена (для ассистента; сайт их не грузит) ═══ */
  const fm=v=>String(Math.round(v*10)/10).replace('-','−'), r0=FE[1]&&FE[1].t==='sph'?FE[1].r:0;
  /* поверхности примитива: подпись и расстояние до неё (с пределами грани) */
  const E_=0.4, inR=(v,a,c)=>v>=Math.min(a,c)-E_&&v<=Math.max(a,c)+E_;
  function surfs(nd,acc){ if(!nd) return acc; if(nd.t==='s'){ surfs(nd.a,acc); nd.k.forEach(k=>surfs(k,acc)); return acc; } if(nd.t==='u'||nd.t==='i'){ nd.k.forEach(k=>surfs(k,acc)); return acc; }
    if(nd.t==='sph') acc.push({n:'сфера R'+fm(nd.r),k:'sph',r:nd.r,d:p=>Math.abs(Math.hypot(p[0]-(nd.x||0),p[1]-(nd.y||0),p[2]-(nd.z||0))-nd.r)});
    if(nd.t==='box'){ const x0=nd.x-nd.sx/2, x1=nd.x+nd.sx/2, y0=nd.y-nd.sy/2, y1=nd.y+nd.sy/2;
      [['x',x0],['x',x1]].forEach(([a,c])=>acc.push({n:'грань x = '+fm(c),k:'px',c,d:p=>inR(p[1],y0,y1)&&inR(p[2],nd.z0,nd.z1)?Math.abs(p[0]-c):9}));
      [['y',y0],['y',y1]].forEach(([a,c])=>{ if(Math.abs(c)<60) acc.push({n:'грань y = '+fm(c),k:'py',c,d:p=>inR(p[0],x0,x1)&&inR(p[2],nd.z0,nd.z1)?Math.abs(p[1]-c):9}); });
      [nd.z0,nd.z1].forEach(c=>{ if(Math.abs(c)<60) acc.push({n:'грань z = '+fm(c),k:'pz',c,d:p=>inR(p[0],x0,x1)&&inR(p[1],y0,y1)?Math.abs(p[2]-c):9}); }); }
    if(nd.t==='cyl') acc.push({n:'цилиндр Ø'+fm(2*nd.r)+' (вертикальный)',k:'cz',r:nd.r,d:p=>inR(p[2],nd.z0,nd.z1)?Math.abs(Math.hypot(p[0]-nd.x,p[1]-nd.y)-nd.r):9});
    if(nd.t==='hcyl') acc.push({n:'цилиндр Ø'+fm(2*nd.r)+' (вдоль '+nd.ax+')',k:'c'+nd.ax,r:nd.r,d:p=>nd.ax==='y'?Math.abs(Math.hypot(p[0]-nd.cx,p[2]-nd.cz)-nd.r):Math.abs(Math.hypot(p[1],p[2]-nd.cz)-nd.r)});
    if(nd.t==='cone') acc.push({n:'конус',k:'cone',d:p=>Math.abs(IG3.jc(nd)(...p))});
    return acc; }
  const FS=FE.map(n=>surfs(n,[]));
  const bb=n=>{ const B=IG3.bbox?IG3.bbox(n):null; return B; };
  const descr=(n,i)=>{ if(i===0) return 'шар Ø'+fm(2*R); if(i===1&&r0) return 'полость Ø'+fm(2*r0);
    const where=inF(n)?'профиль дан на главном виде, сквозное вдоль y':inT(n)?'профиль дан на виде сверху, вертикальное':'вдоль x';
    const t=n.t==='box'?'прямоугольное':n.t==='cyl'||n.t==='hcyl'?'цилиндрическое Ø'+fm(2*n.r):'отверстие';
    const ext=n.t==='box'?' (x '+fm(n.x-n.sx/2)+'…'+fm(n.x+n.sx/2)+', z '+fm(n.z0)+'…'+fm(n.z1)+')':'';
    return 'отверстие K'+(i-(r0?1:0))+': '+t+ext+', '+where; };
  const FEATS=FE.map((n,i)=>({i,name:descr(n,i)}));
  const LINES=[]; let lid=0;
  const VN={F:'главный вид',T:'вид сверху',L:'вид слева'};
  ['F','T','L'].forEach(v=>{ const D=DD[v], inG=v==='L'?()=>false:has((v==='F'?GF:GT).lines);
    IG4S.elements(D.lines).forEach(e=>{ const K=e.key; if(K.length<2) return;
      const fe=(()=>{ for(let i=FE.length-1;i>=0;i--) if(K.every(q=>Math.abs(J[i](...q))<0.35)) return i; return 0; })();
      const sf=[]; FS.forEach((L,i)=>L.forEach(S0=>{ if(K.every(q=>S0.d(q)<0.4)&&!sf.some(o=>o.n===S0.n)) sf.push(Object.assign({fe:i},S0)); }));
      const j0=Math.max(0,(e.path.length>>1)-1), pa=e.path[j0], pb=e.path[Math.min(e.path.length-1,j0+1)], given=v!=='L'&&(inG({a:pa,b:pb})||inG({a:e.path[0],b:e.path[1]||e.path[0]}));   /* дано — линия есть на виде из задания */
      const st=given?0:ST.findIndex(t=>t.kind==='feat'&&t.v===v&&t.fe===fe);
      /* как построена */
      const how={}; const ends=[K[0],K[K.length-1]];
      if(given) how.given=1;
      else { if(v==='L'){ how.z='F'; how.y=[...new Set(ends.map(q=>Math.round(q[1]*10)/10))]; }
        if(v==='T'){ how.x='F'; how.y=[...new Set(ends.map(q=>Math.round(q[1]*10)/10))]; }
        if(v==='F'){ how.x='T'; how.z=[...new Set(ends.map(q=>Math.round(q[2]*10)/10))]; }
        const pl=sf.find(o=>o.k==='px'||o.k==='py'||o.k==='pz'), sph=sf.find(o=>o.k==='sph');
        if(e.curve&&pl&&sph){ const d=pl.c, rr=Math.sqrt(Math.max(0,sph.r*sph.r-d*d)); how.rad={r:Math.round(rr*10)/10,src:pl.k==='pz'?'F':pl.k==='px'?'F':'T',trace:pl.n,R:sph.r,d}; } }
      const pr=q=>q.map(c=>Math.round(c*10)/10);
      LINES.push({id:'l'+(++lid),v,vis:e.h?0:1,t:e.curve?'a':'s',p:(e.curve?[K[0],K[K.length>>1],K[K.length-1]]:ends).map(pr),fe,s:sf.map(o=>o.n),st,how,
        svg:e.path.map((q,j)=>(j?'L':'M')+f(VP[v][0]+q[0]*k0)+' '+f(VP[v][1]+q[1]*k0)).join('')}); }); });

  return {slides:out,lines:LINES,feats:FEATS,steps:ST.map((t,i)=>({i,k:t.kind,fe:t.fe,v:t.v,src:t.src})),R,r:r0}; },[ID,N]);
const slides=RES.slides;
/* 1) полные данные — отдельный файл, сайт его не грузит; читает ассистент */
const NN=String(N).padStart(2,'0'), DATA={v:1,dz:ID,n:N,R:RES.R,r:RES.r,views:{F:'главный вид',T:'вид сверху',L:'вид слева'},feats:RES.feats,steps:RES.steps,
  lines:RES.lines.map(({svg,...o})=>o)};
const dataDir=path.join(ROOT,'dz','ig',ID.slice(2),'lines'); fs.mkdirSync(dataDir,{recursive:true});
fs.writeFileSync(path.join(dataDir,'v'+NN+'.json'),JSON.stringify(DATA));
/* 2) страница в кабинете: публичные шаги картинками + проба ассистента (нажми на линию на последнем шаге) */
const pageDir=path.join(ROOT,'lk','etalon-'+ID+'-'+N); fs.mkdirSync(pageDir,{recursive:true});
const HIT=RES.lines.map(o=>({id:o.id,svg:o.svg}));
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Эталон шагов · ДЗ ${ID.slice(2)}, в. ${N}</title><link rel="icon" href="../../icon-192.png">
<style>:root{--bg:#f4f6fa;--ink:#1f2533;--mut:#6b7486;--acc:#e8336d;--blue:#2f6bff;--vio:#7c4dff}body{margin:0;background:var(--bg);font:15px/1.45 system-ui,sans-serif;color:var(--ink)}
.w{max-width:900px;margin:0 auto;padding:10px 16px 40px}.top{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:14px;margin:4px 0 6px}.top a{color:#1a5ae0;text-decoration:none}
.s{position:relative;background:#fff;border-radius:16px;box-shadow:0 2px 16px rgba(20,30,60,.08);overflow:hidden}.s svg{display:block;width:100%;height:auto}
.nav{display:flex;align-items:center;gap:10px;margin:12px 0}.nav button{width:52px;height:44px;border:0;border-radius:12px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.08);font-size:22px;cursor:pointer;color:var(--ink)}
.nav button.pr{background:var(--acc);color:#fff}.dots{flex:1;display:flex;gap:4px}.dots i{flex:1;height:5px;border-radius:3px;background:#dde2ea}.dots i.on{background:var(--acc)}.dots i.past{background:#f4b3c8}
.ask{margin:14px 0 0;display:flex;gap:10px;align-items:center}.ask button{border:0;border-radius:12px;padding:11px 16px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.08);font:600 14px system-ui;cursor:pointer;color:var(--ink)}
.ask button.on{background:var(--ink);color:#fff}.ask span{color:var(--mut);font-size:13px}
.hit path{fill:none;stroke:transparent;stroke-width:14;cursor:pointer}.hit path.sel{stroke:rgba(232,51,109,.28)}
.ans{margin-top:12px;background:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 1px 8px rgba(0,0,0,.06);display:none}.ans.on{display:block}.ans b{color:var(--acc)}.ans ul{margin:6px 0 0;padding-left:18px}.ans li{margin:3px 0}
.ans .q{font-size:12px;color:var(--mut);margin-bottom:4px}</style></head>
<body><div class="w"><div class="top"><a href="../">← Кабинет</a><b>ДЗ ${ID.slice(2)} · вариант ${N}</b><a href="/#/${ID}/${N}">На сайте →</a></div>
<div class="nav"><button id="b" aria-label="Назад">‹</button><div class="dots" id="d"></div><button class="pr" id="n" aria-label="Дальше">›</button></div>
<div class="s" id="s"></div>
<div class="ask"><button id="ai">Спросить про линию</button><span id="aih">проба ассистента: нажми на любую линию готового чертежа</span></div>
<div class="ans" id="ans"></div></div>
<script>const S=${JSON.stringify(slides)}, HIT=${JSON.stringify(HIT)};let k=0, ai=false, DB=null;const d=document.getElementById('d');S.forEach(()=>d.appendChild(document.createElement('i')));
const VN={F:'главном виде',T:'виде сверху',L:'виде слева'}, VS={F:'главного вида',T:'вида сверху',L:'вида слева'}, num=v=>String(v).replace('.',',').replace('-','−');
function go(i){k=Math.max(0,Math.min(S.length-1,i));document.getElementById('s').innerHTML=S[k];[...d.children].forEach((e,j)=>e.className=j===k?'on':j<k?'past':'');if(ai) hits();}
function hits(){ const sv=document.querySelector('#s svg'); if(!sv) return; const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','hit');
  g.innerHTML=HIT.map(h=>'<path data-id="'+h.id+'" d="'+h.svg+'"/>').join(''); sv.appendChild(g);
  g.addEventListener('click',e=>{ const p=e.target.closest('path'); if(!p) return; g.querySelectorAll('.sel').forEach(x=>x.classList.remove('sel')); p.classList.add('sel'); explain(p.dataset.id); }); }
/* ответ ассистента — из полных данных (файл варианта); здесь — простой шаблон, ассистент будет говорить своими словами */
function explain(id){ const L=DB.lines.find(o=>o.id===id), F=DB.feats[L.fe], h=L.how, a=document.getElementById('ans'); let t='<div class="q">Как построить эту линию?</div>';
  t+='<p><b>'+(L.t==='a'?'Дуга':'Отрезок')+(L.vis?'':' (невидимая — штриховая)')+'</b> на '+VN[L.v]+' — '+F.name+'.</p><ul>';
  if(L.s.length>1) t+='<li>Это пересечение поверхностей: '+L.s.join(' и ')+'.</li>'; else if(L.s.length) t+='<li>Это очерк поверхности: '+L.s[0]+'.</li>';
  if(h.given) t+='<li>Линия дана в задании.</li>';
  else { if(h.z==='F') t+='<li>Высоту концов переносим с главного вида горизонтальными линиями связи.</li>';
    if(h.x==='F') t+='<li>Положение по x — с главного вида вертикальной линией связи.</li>';
    if(h.x==='T') t+='<li>Положение по x — с вида сверху вертикальной линией связи.</li>';
    if(Array.isArray(h.z)) t+='<li>Высота концов: z = '+h.z.map(num).join(' и ')+' мм.</li>';
    if(h.y&&L.v==='L') t+='<li>Координату y (глубину) берём на виде сверху от оси x и откладываем на виде слева от оси z: y = '+h.y.map(num).join(' и ')+' мм.</li>';
    if(h.rad) t+='<li>Дуга — часть окружности, по которой '+h.rad.trace+' режет сферу R'+num(h.rad.R)+'. Радиус — с '+VS[h.rad.src]+': отрезок следа грани от оси до контура, r = √('+num(h.rad.R)+'² − '+num(Math.abs(h.rad.d))+'²) = '+num(h.rad.r)+' мм. Центр — на оси.</li>'; }
  t+='<li>Появляется на шаге '+(L.st+1)+'.</li></ul>'; a.innerHTML=t; a.classList.add('on'); }
document.getElementById('ai').onclick=async()=>{ ai=!ai; document.getElementById('ai').classList.toggle('on',ai); document.getElementById('ans').classList.remove('on');
  if(ai&&!DB){ DB=await fetch('/dz/ig/${ID.slice(2)}/lines/v${NN}.json').then(r=>r.json()); } if(ai) go(S.length-1); else go(k); };
document.getElementById('b').onclick=()=>go(k-1);document.getElementById('n').onclick=()=>go(k+1);document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(k+1);if(e.key==='ArrowLeft')go(k-1);});go(0);</script></body></html>`;
fs.writeFileSync(path.join(pageDir,'index.html'),html);
console.log('шагов',slides.length,'линий',RES.lines.length,'данные',Math.round(JSON.stringify(DATA).length/1024)+' КБ','страница',Math.round(html.length/1024)+' КБ');
await b.close();srv.close();})();
