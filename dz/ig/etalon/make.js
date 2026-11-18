/* ═══════════ ИГ: служебная база «каждая линия» ═══════════
   node dz/ig/etalon/make.js ig6          — все варианты задания;   node dz/ig/etalon/make.js ig5 7   — один вариант
   → dz/ig/<N>/lines/vNN.json: каждая линия главного вида, вида сверху и вида слева — элемент детали, пересечение каких
     поверхностей, как построена (откуда x, высота, координата y, радиус дуги среза шара), в каком шаге сайта появляется.
   Сайт эти файлы не грузит и нигде не показывает. Формат — README.md рядом. */
const http=require('http'), fs=require('fs'), path=require('path');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..','..','..');
const ID=process.argv[2]||'ig6', NS=process.argv[3]?[+process.argv[3]]:Array.from({length:30},(_,i)=>i+1);
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};

/* в странице сайта: линии видов модели → записи */
function linesOf([ID,N]){
  const m=DZR.get(ID).part(N); if(!m) return null;
  const W=900, b=m.box, fm=v=>String(Math.round(v*10)/10).replace('.',',').replace('-','−'), r1=v=>Math.round(v*10)/10;
  const FT=IG3.features(m), JF=FT.map(f=>{ const J=f.nds.map(n=>IG3.jc(n)); return p=>Math.min(...J.map(j=>Math.abs(j(...p)))); });
  const GK=(m.givenTop&&m.givenTop.k)||[], GF=(m.givenF&&m.givenF.k)||null;
  /* поверхности примитивов: подпись и расстояние до точки (в пределах грани) */
  const E_=0.4, inR=(v,a,c)=>v>=Math.min(a,c)-E_&&v<=Math.max(a,c)+E_;
  const surfs=(nd,acc)=>{ if(!nd) return acc; if(nd.k){ if(nd.a) surfs(nd.a,acc); nd.k.forEach(k=>surfs(k,acc)); return acc; }
    const J=IG3.jc(nd);
    if(nd.t==='sph') acc.push({n:'сфера R'+fm(nd.r),k:'sph',r:nd.r,d:p=>Math.abs(Math.hypot(p[0]-(nd.x||0),p[1]-(nd.y||0),p[2]-(nd.z||0))-nd.r)});
    else if(nd.t==='box'&&!nd.a){ const x0=nd.x-nd.sx/2, x1=nd.x+nd.sx/2, y0=nd.y-nd.sy/2, y1=nd.y+nd.sy/2;
      [x0,x1].forEach(c=>acc.push({n:'грань x = '+fm(c),k:'px',c,d:p=>inR(p[1],y0,y1)&&inR(p[2],nd.z0,nd.z1)?Math.abs(p[0]-c):9}));
      [y0,y1].forEach(c=>acc.push({n:'грань y = '+fm(c),k:'py',c,d:p=>inR(p[0],x0,x1)&&inR(p[2],nd.z0,nd.z1)?Math.abs(p[1]-c):9}));
      [nd.z0,nd.z1].forEach(c=>acc.push({n:'грань z = '+fm(c),k:'pz',c,d:p=>inR(p[0],x0,x1)&&inR(p[1],y0,y1)?Math.abs(p[2]-c):9})); }
    else if(nd.t==='cyl'){ acc.push({n:'цилиндр Ø'+fm(2*nd.r),k:'cz',r:nd.r,d:p=>inR(p[2],nd.z0,nd.z1)?Math.abs(Math.hypot(p[0]-nd.x,p[1]-nd.y)-nd.r):9});
      [nd.z0,nd.z1].forEach(c=>acc.push({n:'торец z = '+fm(c),k:'pz',c,d:p=>Math.hypot(p[0]-nd.x,p[1]-nd.y)<=nd.r+E_?Math.abs(p[2]-c):9})); }
    else if(nd.t==='hcyl') acc.push({n:'цилиндр Ø'+fm(2*nd.r)+' вдоль '+nd.ax,k:'c'+nd.ax,r:nd.r,d:p=>nd.ax==='y'?Math.abs(Math.hypot(p[0]-nd.cx,p[2]-nd.cz)-nd.r):Math.abs(Math.hypot(p[1],p[2]-nd.cz)-nd.r)});
    else if(nd.t==='hp') acc.push({n:'плоскость среза',k:'hp',d:p=>Math.abs(J(...p))});
    else { const nm={cone:'конус',ngon:'призма',npyr:'пирамида',box:'брусок'}[nd.t]||nd.t; acc.push({n:'поверхность: '+nm,k:nd.t,d:p=>Math.abs(J(...p))}); }
    return acc; };
  const FS=FT.map(f=>surfs(f.nd,[]));
  const has=L=>{ const H=new Set(); L.forEach(s=>{ const x=Math.round((s.a[0]+s.b[0])/2), y=Math.round((s.a[1]+s.b[1])/2); for(let a=-1;a<=1;a++) for(let c=-1;c<=1;c++) H.add((x+a)+','+(y+c)); });
    return (p,q)=>H.has(Math.round((p[0]+q[0])/2)+','+Math.round((p[1]+q[1])/2)); };
  const D={F:IG3.drawing(m,'front0',W),T:IG3.drawing(m,'top',W),L:IG3.drawing(m,'left0',W)};
  const G={F:has(IG3.drawing(GF?{tree:m.givenF,box:b}:m,'front0',W).lines),T:has(IG3.drawing(m.givenTop?{tree:m.givenTop,box:b}:m,'top',W).lines)};
  const given=GF?f=>f.nds.every(n=>GF.includes(n)||n===m.givenF.a):()=>true, gTop=f=>!m.givenTop||f.kind==='add'||f.nds.every(n=>GK.includes(n));
  const lines=[]; let id=0;
  ['F','T','L'].forEach(v=>{ IG4S.elements(D[v].lines).forEach(e=>{ const K=e.key; if(K.length<2) return;
    /* точки проверки: у отрезка — ещё середина (концы ребра могут лежать на сфере, а само ребро — нет) */
    const KQ=e.curve?K:K.concat([[0,1,2].map(j=>(K[0][j]+K[K.length-1][j])/2)]);
    let fe=0; for(let i=FT.length-1;i>=0;i--) if(KQ.every(q=>JF[i](q)<0.35)){ fe=i; break; }
    const sfOf=Q=>{ const o=[]; FS.forEach(L=>L.forEach(S0=>{ if(Q.every(q=>S0.d(q)<0.4)&&!o.some(x=>x.n===S0.n)) o.push(S0); })); return o; };
    let sf=sfOf(KQ); if(!sf.length) sf=sfOf(K);   /* окружность, видимая с ребра (на виде — прямая): середина хорды не на поверхности */
    if(!sf.length){ FS.forEach(L=>L.forEach(S0=>{ if(K.filter(q=>S0.d(q)<0.4).length*2>=K.length&&!sf.some(x=>x.n===S0.n)) sf.push(S0); })); }   /* на виде склеены куски разных граней — где лежит большинство точек */
    const j0=Math.max(0,(e.path.length>>1)-1), isG=v!=='L'&&(G[v](e.path[j0],e.path[Math.min(e.path.length-1,j0+1)])||G[v](e.path[0],e.path[1]||e.path[0]));
    const f=FT[fe], ends=[K[0],K[K.length-1]], how={};
    let step;
    if(isG){ how.given=1; step='Дано'; }
    else { if(v==='L'){ how.z='F'; how.y=[...new Set(ends.map(q=>r1(q[1])))]; step=f.name; }
      if(v==='T'){ how.x='F'; how.y=[...new Set(ends.map(q=>r1(q[1])))]; step='Вид сверху: '+f.name.charAt(0).toLowerCase()+f.name.slice(1); }
      if(v==='F'){ how.x='T'; how.z=[...new Set(ends.map(q=>r1(q[2])))]; step=f.name; }
      const pl=sf.find(o=>o.k==='px'||o.k==='py'||o.k==='pz'), sp=sf.find(o=>o.k==='sph');
      if(e.curve&&pl&&sp){ const d=pl.c; how.rad={r:r1(Math.sqrt(Math.max(0,sp.r*sp.r-d*d))),R:sp.r,d,trace:pl.n,src:pl.k==='py'?'T':'F'}; } }
    lines.push({id:'l'+(++id),v,vis:e.h?0:1,t:e.curve?'a':'s',p:(e.curve?[K[0],K[K.length>>1],K[K.length-1]]:ends).map(q=>q.map(r1)),fe,s:sf.map(o=>o.n),step,how}); }); });
  /* разрезы: контур фигуры сечения — линии, лежащие в секущей плоскости (фронтальной y = 0, профильной x = 0, горизонтальной z = hz) */
  const sp=IGUI.igSpec(m), SEC=[];
  if(sp.F!=='view') SEC.push(['Fs',IG3.drawing(m,sp.fk,W,0,sp.xb),1,0,'фронтальная секущая плоскость y = 0','Фронтальный разрез']);
  if(sp.L!=='view') SEC.push(['Ls',IG3.drawing(m,sp.lk,W,0,sp.yb),0,0,'профильная секущая плоскость x = 0','Профильный разрез']);
  if(m.hz) SEC.push(['Ts',IG3.drawing(m,'topcut',W,m.hz.z),2,m.hz.z,'горизонтальная секущая плоскость z = '+fm(m.hz.z)+' ('+(m.hz.L||'А')+'–'+(m.hz.L||'А')+')','Разрез '+(m.hz.L||'А')+'–'+(m.hz.L||'А')]);
  SEC.forEach(([v,Dv,ax,c,pn,stp])=>{ IG4S.elements(Dv.lines.filter(q=>q.c)).forEach(e=>{ const K=e.key; if(K.length<2) return;   /* c — кусок контура фигуры сечения */
    const KQ=e.curve?K:K.concat([[0,1,2].map(j=>(K[0][j]+K[K.length-1][j])/2)]);
    let fe=0; for(let i=FT.length-1;i>=0;i--) if(KQ.every(q=>JF[i](q)<0.35)){ fe=i; break; }
    const sf=[]; FS.forEach(L=>L.forEach(S0=>{ if(KQ.every(q=>S0.d(q)<0.4)&&!sf.some(o=>o.n===S0.n)) sf.push(S0); }));
    lines.push({id:'l'+(++id),v,vis:1,t:e.curve?'a':'s',p:(e.curve?[K[0],K[K.length>>1],K[K.length-1]]:[K[0],K[K.length-1]]).map(q=>q.map(r1)),fe,s:sf.map(o=>o.n).concat([pn]),step:stp,
      how:{sec:pn,hatch:1}}); }); });
  return {v:1,dz:ID,n:N,title:m.title||'',box:b,views:{F:'главный вид',T:'вид сверху',L:'вид слева',Fs:'фронтальный разрез',Ls:'профильный разрез',Ts:'разрез на месте вида сверху'},
    feats:FT.map((f,i)=>({i,name:f.name,kind:f.kind==='add'?'тело':'отверстие'})),lines}; }

(async()=>{
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':TYPES[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch(), page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+srv.address().port+'/#/dz'); await page.waitForTimeout(1500);
  const dir=path.join(ROOT,'dz','ig',ID.slice(2),'lines'); fs.mkdirSync(dir,{recursive:true});
  for(const N of NS){ let D=null; try{ D=await page.evaluate(linesOf,[ID,N]); }catch(e){ console.log(ID,N,'ошибка',e.message.slice(0,160)); continue; }
    if(!D){ console.log(ID,N,'— нет модели'); continue; }
    fs.writeFileSync(path.join(dir,'v'+String(N).padStart(2,'0')+'.json'),JSON.stringify(D));
    console.log(ID,N,'линий',D.lines.length,'без поверхностей',D.lines.filter(l=>!l.s.length).length); }
  await browser.close(); srv.close();
})();
