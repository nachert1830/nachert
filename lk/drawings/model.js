/* ═══════════ «Мои чертежи»: оцифрованный чертёж → доводка → 3D (Node и браузер, без зависимостей) ═══════════
   Чертёж хранится в мм листа, как в core/model.js: u вправо, v вниз, ось x — прямая v = 0, начало O — (0, 0);
   фронтальная проекция A″ = (−x, −z), горизонтальная A′ = (−x, y). Сканер (lk/scan/pipeline.js) отдаёт копию в мм,
   если привязался к условию варианта; иначе — в px фото: тогда масштаб, поворот и ось оцениваются (approx), и
   студент ставит начало O сам.

   fromScan(out, o)   — результат сканера → лист {id, name, created, drawings:[чертёж]}; чертёж —
                        {id, name, part, dz, n, rms, approx, pts:[{id,l,at}], segs:[{id,a,b,dash,unv,src}], arcs:[{id,poly,dash,unv}], txt:[{at,s}]};
   parseLabel(s)      — подпись → {name, pr: 'f' (″) | 'h' (′) | 'w' (‴) | 'x' (доп. плоскость) | null};
   space(dr)          — 3D: точки по парам проекций (невязка линии связи), рёбра по отрезкам между подписанными
                        точками одной проекции (в обеих проекциях — подтверждено), грани (треугольники и плоские четырёхугольники);
   issues(dr)         — что довести до ума (у каждого замечания — исправление fix, если оно есть);
   apply(dr, fix)     — выполнить исправление; movePoint — точка вместе с концами отрезков в ней;
   reference(dr, LIB) — эталон по условию варианта (данные + решение core/dz.js), сверка точек;
   toSVG / toOBJ      — чистая копия и 3D-модель для скачивания. */
(function(){
'use strict';
const TOL=1.2;                     /* мм: точка «на отрезке» / конец отрезка в точке */
const LINK_TOL=1.0;                /* мм: допустимый разрыв линии связи */
let seq=0; const uid=p=>(p||'e')+Date.now().toString(36)+(seq++).toString(36);
const r2=v=>Math.round(v*100)/100;
const d2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');

/* ── подписи ── */
const CYR={'А':'A','В':'B','С':'C','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','Т':'T','Х':'X','Ѕ':'S','а':'a','с':'c','е':'e','о':'o','р':'p','х':'x','к':'k','м':'m'};
const SUB={'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'}, UNSUB={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
const sub=s=>String(s).replace(/[0-9]/g,c=>SUB[c]);
function parseLabel(raw){ let s=String(raw==null?'':raw).trim().replace(/\s+/g,'').replace(/[АВСЕКМНОРТХЅасеорхкм]/g,c=>CYR[c]||c);
  if(!s) return {name:'',pr:null};
  if(/^[OoО0]$/.test(s)) return {name:'O',pr:null,origin:true};
  if(/^[xXхХ](?:[_₁1][₂2]?|₁₂|12)?$/.test(s)) return {name:s,pr:null,axis:true};
  s=s.replace(/''/g,'″').replace(/"/g,'″').replace(/[ʺ〃]/g,'″').replace(/[’ʹ`']/g,'′');
  let m=s.match(/^(.+?)(‴|″|′|′′′)$/);
  if(m){ const pr=m[2]==='″'?'f':m[2]==='′'?'h':'w'; return {name:norm(m[1]),pr}; }
  /* без штрихов: индекс проекции — нижняя цифра у буквы (A₁ — на π₁, A₂ — на π₂, A₄ — на доп. плоскости) */
  m=s.match(/^([A-Za-z])_?([0-9₀-₉])$/);
  if(m){ const k=UNSUB[m[2]]||m[2]; return {name:m[1].toUpperCase(),pr:k==='1'?'h':k==='2'?'f':k==='3'?'w':'x'}; }
  m=s.match(/^([0-9]+)_?([₀-₉])$/);
  if(m){ const k=UNSUB[m[2]]; return {name:m[1],pr:k==='1'?'h':k==='2'?'f':k==='3'?'w':'x'}; }
  return {name:norm(s),pr:null}; }
function norm(n){ n=String(n).replace(/_/g,''); const m=n.match(/^([A-Za-z])([0-9₀-₉]*)$/); if(m) return m[1].toUpperCase()+sub(m[2].replace(/[₀-₉]/g,c=>UNSUB[c])); return n; }
const mark={f:'″',h:'′',w:'‴'};
const labelOf=(name,pr)=>name+(mark[pr]||'');

/* аффинное отображение по парам точек (МНК): m → p, [a,b,c,d,e,f]: p = (a·u + b·v + c, d·u + e·v + f) */
function affine(M,P){ if(M.length<3) return null; const S=[[0,0,0],[0,0,0],[0,0,0]], bx=[0,0,0], by=[0,0,0];
  M.forEach((m,i)=>{ const r=[m[0],m[1],1]; for(let a=0;a<3;a++){ for(let b=0;b<3;b++) S[a][b]+=r[a]*r[b]; bx[a]+=r[a]*P[i][0]; by[a]+=r[a]*P[i][1]; } });
  const solve=b=>{ const A=S.map((r,i)=>r.concat(b[i])); for(let c=0;c<3;c++){ let q=c; for(let r=c+1;r<3;r++) if(Math.abs(A[r][c])>Math.abs(A[q][c])) q=r; if(Math.abs(A[q][c])<1e-9) return null; [A[c],A[q]]=[A[q],A[c]];
      for(let r=0;r<3;r++){ if(r===c) continue; const f=A[r][c]/A[c][c]; for(let j=c;j<4;j++) A[r][j]-=f*A[c][j]; } } return A.map((r,i)=>r[3]/r[i]); };
  const X=solve(bx), Y=solve(by); return X&&Y&&X.concat(Y).every(Number.isFinite)?X.concat(Y):null; }
function inv(A){ const det=A[0]*A[4]-A[1]*A[3]; if(Math.abs(det)<1e-12) return null; const a=A[4]/det, b=-A[1]/det, d=-A[3]/det, e=A[0]/det; return [a,b,-(a*A[2]+b*A[5]),d,e,-(d*A[2]+e*A[5])]; }

/* ── результат сканера → лист ── */
function fromScan(out,o){ o=o||{}; const sheet={id:uid('s'),name:o.name||out.name||'Лист',created:o.date||Date.now(),photo:o.photo||null,size:out.size||null,cost:out.cost||0,drawings:[]};
  (out.drawings||[]).forEach((d,i)=>{ if(!d||!d.segs) return; const dr=fromDrawing(d,out); dr.name='Чертёж '+(i+1)+(d.part?' · часть '+d.part:''); dr.idx=i; sheet.drawings.push(dr); });
  return sheet; }
function fromDrawing(d,out){ const f=d.fit&&d.fit.rmsMm!=null?d.fit:null;
  const dr={id:uid('d'),part:d.part||null,dz:f?f.dz:null,n:f?f.n:null,rms:f?r2(f.hom?f.hom.rmsMm:f.rmsMm):null,approx:false,pts:[],segs:[],arcs:[],txt:[],created:Date.now()};
  if(d.check) dr.check=d.check; if(d.verify) dr.verify=d.verify;   /* проверка по результату (lk/scan/verify.js) — на момент скана */   /* вердикт сканера по построению (pipeline.checkDrawing) — на момент скана; правки копии его не меняют */
  let T;
  if(d.mm&&f&&d.mm.segs){ T=(x,y)=>[x,y];
    d.mm.pts.forEach(q=>dr.pts.push({id:uid('p'),l:String(q[0]),at:[r2(q[1]),r2(q[2])]}));
    d.mm.segs.forEach(q=>dr.segs.push({id:uid('g'),a:[r2(q.p[0]),r2(q.p[1])],b:[r2(q.p[2]),r2(q.p[3])],dash:!!q.dash,unv:!!q.unverified,src:q.src||'model'}));
    (d.circles||[]).forEach(c=>{ if(c.mm&&c.mm.length>2) dr.arcs.push({id:uid('c'),poly:c.mm.map(p=>[r2(p[0]),r2(p[1])]),dash:!!c.dash,unv:!!c.unverified,src:c.src||'model'}); });
    (d.mm.txt||[]).forEach(q=>dr.txt.push({at:[r2(q[0]),r2(q[1])],s:String(q[2])}));
    const M=[], Pp=[]; d.mm.pts.forEach((q,i)=>{ if(d.pts[i]){ M.push([q[1],q[2]]); Pp.push([d.pts[i][1],d.pts[i][2]]); } });
    d.mm.segs.forEach((q,i)=>{ const z=d.segs[i]; if(z){ M.push([q.p[0],q.p[1]],[q.p[2],q.p[3]]); Pp.push([z.p[0],z.p[1]],[z.p[2],z.p[3]]); } });
    dr.ph=affine(M,Pp);   /* мм листа → px фото: фото под копией в редакторе */
    return dr; }
  /* без привязки: px фото → мм оценочно. Поворот — по линиям связи (X″ над X′), иначе по повороту листа; масштаб — px/мм сканера */
  dr.approx=true; const ppm=d.ppm||(out&&out.size?Math.min(out.size[0],out.size[1])/297:4);
  const P=d.pts.map(q=>({l:String(q[0]),p:[q[1],q[2]],L:parseLabel(q[0])}));
  const by={}; P.forEach(q=>{ if(q.L.pr==='f'||q.L.pr==='h') (by[q.L.name]=by[q.L.name]||{})[q.L.pr]=q.p; });
  let sx=0,sy=0; Object.values(by).forEach(b=>{ if(b.f&&b.h){ const dx=b.h[0]-b.f[0], dy=b.h[1]-b.f[1], l=Math.hypot(dx,dy); if(l>1){ sx+=dx/l; sy+=dy/l; } } });
  let ang; if(Math.hypot(sx,sy)>0.5) ang=Math.atan2(sy,sx)-Math.PI/2; else ang=-(d.rot||0)*Math.PI/180;   /* «вниз» — направление X″ → X′ */
  const ca=Math.cos(-ang), sa=Math.sin(-ang), R=(x,y)=>[(x*ca-y*sa)/ppm,(x*sa+y*ca)/ppm];
  const Rp=P.map(q=>R(q.p[0],q.p[1])), Rs=d.segs.map(q=>[R(q.p[0],q.p[1]),R(q.p[2],q.p[3])]);
  /* ось: самый длинный почти горизонтальный отрезок между ″ и ′; иначе — посередине между ними; O — подписанная точка или правее всех */
  const vf=P.map((q,i)=>q.L.pr==='f'?Rp[i][1]:null).filter(v=>v!=null), vh=P.map((q,i)=>q.L.pr==='h'?Rp[i][1]:null).filter(v=>v!=null);
  const mid=vf.length&&vh.length?(Math.max(...vf)+Math.min(...vh))/2:null;
  let axV=null, best=0; Rs.forEach(([a,b])=>{ const len=d2(a,b), h=Math.abs(b[1]-a[1])/Math.max(len,1e-9); const v=(a[1]+b[1])/2;
    if(h<0.03&&len>best&&(mid==null||(vf.length&&vh.length&&v>=Math.min(...vf)-2&&v<=Math.max(...vh)+2))){ best=len; axV=v; } });
  if(axV==null) axV=mid!=null?mid:0;
  const oi=P.findIndex(q=>q.L.origin); const all=Rp.concat(...Rs);
  const O=oi>=0?[Rp[oi][0],axV]:[Math.max(...all.map(p=>p[0]))+10,axV];
  T=(x,y)=>[r2(x-O[0]),r2(y-O[1])];
  P.forEach((q,i)=>{ if(q.L.origin) return; dr.pts.push({id:uid('p'),l:q.l,at:T(Rp[i][0],Rp[i][1])}); });
  Rs.forEach(([a,b],i)=>{ const q=d.segs[i]; dr.segs.push({id:uid('g'),a:T(a[0],a[1]),b:T(b[0],b[1]),dash:!!q.dash,unv:!!q.unverified,src:q.src||'model'}); });
  (d.circles||[]).forEach(c=>{ if(c.poly&&c.poly.length>2) dr.arcs.push({id:uid('c'),poly:c.poly.map(p=>{ const q=R(p[0],p[1]); return T(q[0],q[1]); }),dash:!!c.dash,unv:!!c.unverified,src:c.src||'model'}); });
  (d.txt||[]).forEach(q=>{ const p=R(q[0],q[1]); dr.txt.push({at:T(p[0],p[1]),s:String(q[2])}); });
  const M=[], Pp=[]; Rs.forEach(([a,b],i)=>{ const q=d.segs[i].p; M.push(T(a[0],a[1]),T(b[0],b[1])); Pp.push([q[0],q[1]],[q[2],q[3]]); }); P.forEach((q,i)=>{ M.push(T(Rp[i][0],Rp[i][1])); Pp.push(q.p); });
  dr.ph=affine(M,Pp);
  return dr; }

/* ── правка ── */
function movePoint(dr,id,to){ const p=dr.pts.find(q=>q.id===id); if(!p) return; const from=p.at.slice(); p.at=[r2(to[0]),r2(to[1])];
  dr.segs.forEach(s=>{ if(d2(s.a,from)<0.6) s.a=p.at.slice(); if(d2(s.b,from)<0.6) s.b=p.at.slice(); }); }
function addPoint(dr,l,at){ const p={id:uid('p'),l:String(l),at:[r2(at[0]),r2(at[1])]}; dr.pts.push(p); return p; }
function addSeg(dr,a,b,dash){ const s={id:uid('g'),a:[r2(a[0]),r2(a[1])],b:[r2(b[0]),r2(b[1])],dash:!!dash,unv:false,src:'hand'}; dr.segs.push(s); return s; }
function remove(dr,id){ ['pts','segs','arcs'].forEach(k=>{ dr[k]=dr[k].filter(q=>q.id!==id); }); }
/* сдвиг начала O: всё смещается так, чтобы точка `at` стала (0, 0) (ось x — горизонталь через неё) */
function setOrigin(dr,at){ const sh=p=>[r2(p[0]-at[0]),r2(p[1]-at[1])];
  dr.pts.forEach(p=>p.at=sh(p.at)); dr.segs.forEach(s=>{ s.a=sh(s.a); s.b=sh(s.b); }); dr.arcs.forEach(c=>c.poly=c.poly.map(sh)); dr.txt.forEach(t=>t.at=sh(t.at)); dr.originSet=true;
  if(dr.ph){ dr.ph[2]+=dr.ph[0]*at[0]+dr.ph[1]*at[1]; dr.ph[5]+=dr.ph[3]*at[0]+dr.ph[4]*at[1]; } }

/* ── 3D ── */
function named(dr){ const by={}, dup=[];
  dr.pts.forEach(p=>{ const L=parseLabel(p.l); if(!L.name||L.axis||L.origin) return; const b=by[L.name]=by[L.name]||{name:L.name};
    if(L.pr==='f'||L.pr==='h'||L.pr==='w'){ if(b[L.pr]) dup.push(labelOf(L.name,L.pr)); else b[L.pr]=p; } else (b.other=b.other||[]).push(p); });
  return {by,dup}; }
function space(dr){ const {by}=named(dr), pts={};
  Object.values(by).forEach(b=>{ if(b.f&&b.h){ const f=b.f.at, h=b.h.at; pts[b.name]={name:b.name,P:[-(f[0]+h[0])/2,h[1],-f[1]],link:Math.abs(f[0]-h[0]),f:b.f.id,h:b.h.id}; } });
  /* рёбра: подписанные точки одной проекции на одном отрезке — соседние по отрезку соединены */
  const E=new Map();
  dr.segs.forEach(s=>{ const L=d2(s.a,s.b); if(L<1) return; const dx=(s.b[0]-s.a[0])/L, dy=(s.b[1]-s.a[1])/L;
    ['f','h'].forEach(pr=>{ const on=[];
      Object.values(by).forEach(b=>{ const p=b[pr]; if(!p||!pts[b.name]) return; const wx=p.at[0]-s.a[0], wy=p.at[1]-s.a[1], t=wx*dx+wy*dy, off=Math.abs(wx*dy-wy*dx);
        if(off<=TOL&&t>=-TOL&&t<=L+TOL) on.push({n:b.name,t}); });
      on.sort((a,b)=>a.t-b.t);
      for(let i=1;i<on.length;i++){ const a=on[i-1].n, b=on[i].n; if(a===b) continue; const k=[a,b].sort().join('|');
        if(!E.has(k)) E.set(k,{a:[a,b].sort()[0],b:[a,b].sort()[1]}); const e=E.get(k); e[pr]={dash:!!s.dash,seg:s.id}; } }); });
  const edges=[...E.values()].map(e=>Object.assign(e,{both:!!(e.f&&e.h),hid:!!((e.f&&e.f.dash)||(e.h&&e.h.dash))}));
  /* грани: треугольники из рёбер; четырёхугольники без диагоналей, если плоские (в 2 мм) */
  const has=(a,b)=>E.has([a,b].sort().join('|')), names=Object.keys(pts).filter(n=>/^[A-Z]/.test(n)).sort(), faces=[];
  for(let i=0;i<names.length;i++) for(let j=i+1;j<names.length;j++) for(let k=j+1;k<names.length;k++){ const [a,b,c]=[names[i],names[j],names[k]];
    if(has(a,b)&&has(b,c)&&has(a,c)) faces.push([a,b,c]); }
  const plane=(q)=>{ const P=q.map(n=>pts[n].P), u=sub3(P[1],P[0]), v=sub3(P[2],P[0]), n=cross(u,v), l=Math.hypot(...n); if(l<1e-6) return 1e9; return Math.abs(dot(n,sub3(P[3],P[0])))/l; };
  for(let i=0;i<names.length;i++) for(let j=0;j<names.length;j++) for(let k=0;k<names.length;k++) for(let m=0;m<names.length;m++){ const q=[names[i],names[j],names[k],names[m]];
    if(new Set(q).size<4||i>j||i>k||i>m||j>m) continue;   /* цикл a-b-c-d, a — наименьший, b < d (без повторов обхода) */
    if(!(has(q[0],q[1])&&has(q[1],q[2])&&has(q[2],q[3])&&has(q[3],q[0]))) continue; if(has(q[0],q[2])||has(q[1],q[3])) continue;
    if(plane(q)<=2) faces.push(q); }
  const P3=Object.values(pts).map(p=>p.P), lo=[0,1,2].map(k=>P3.length?Math.min(...P3.map(p=>p[k])):0), hi=[0,1,2].map(k=>P3.length?Math.max(...P3.map(p=>p[k])):0);
  return {pts,edges,faces,box:[lo,hi]}; }
const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/* ── эталон по условию варианта: данные (core/dz-variants.js) + решение (core/dz.js) + тело ответа (lab/dz/model.js) ── */
function reference(dr,LIB){ if(!dr.dz||!dr.n||!LIB||!LIB.variants) return null; const gv=LIB.variants.get(dr.dz,dr.n); if(!gv) return null;
  const pts={}; Object.entries(gv.data).forEach(([k,P])=>pts[k]=P.slice()); let edges=[], sol=null;
  try{ const r=LIB.dz&&LIB.dz.solve(gv.id,gv.data); if(r&&r.ok&&r.sol&&r.sol.length){
      const sp=space(dr).pts, S=r.sol.slice().sort((a,b)=>score(a)-score(b)); function score(s){ let e=0,n=0; Object.entries(s).forEach(([k,P])=>{ const nm=norm(k); if(Array.isArray(P)&&P.length===3&&sp[nm]){ e+=Math.hypot(...sub3(P,sp[nm].P)); n++; } }); return n?e/n:1e9; }
      sol=S[0]; if(LIB.model&&LIB.model.solid){ const so=LIB.model.solid(gv.id,sol,gv.data); if(so){ Object.entries(so.V).forEach(([k,P])=>pts[norm(k)]=P.slice()); edges=so.edges.map(e=>[norm(e.a),norm(e.b)]); } } } }catch(e){}
  if(!edges.length&&LIB.model&&LIB.model.GIVEN_SEGS) edges=(LIB.model.GIVEN_SEGS[gv.id]||[]).map(([a,b])=>[a,b]);
  if(gv.data.E&&gv.data.F&&!edges.some(e=>e.join()==='E,F')) edges.push(['E','F']);
  return {id:gv.id,dz:dr.dz,n:dr.n,given:Object.keys(gv.data),pts,edges,sol}; }

/* ── что довести до ума ── */
function issues(dr,LIB){ const out=[], {by,dup}=named(dr), sp=space(dr);
  if(dr.approx&&!dr.originSet) out.push({k:'origin',lvl:'warn',t:'Масштаб и начало O оценены примерно',d:'Чертёж не привязался к условию варианта. Отметьте начало O на оси x — 3D станет точнее.',fix:{k:'pickOrigin'}});
  dup.forEach(l=>out.push({k:'dup',lvl:'bad',t:'Две точки с подписью '+l,d:'Переименуйте лишнюю — иначе непонятно, какую брать в 3D.'}));
  Object.values(by).forEach(b=>{ const one=b.f&&!b.h?'f':b.h&&!b.f?'h':null; if(!one||b.w) return;
    out.push({k:'alone',lvl:'warn',t:labelOf(b.name,one)+' без пары '+labelOf(b.name,one==='f'?'h':'f'),d:'Точка есть только на одной проекции — в 3D её нет. Подпишите вторую проекцию или переименуйте.',id:b[one].id}); });
  /* подпись без штриха («C» вместо «C′»): какая проекция — по стороне от оси x (выше — ″, ниже — ′) */
  const guess={}; Object.values(by).forEach(b=>(b.other||[]).forEach(p=>{ const pr=p.at[1]>0?'h':'f'; if(b[pr]||guess[b.name+pr]) return; guess[b.name+pr]=1;
    out.push({k:'nomark',lvl:'warn',t:'Подпись «'+p.l+'» без штриха',d:'Точка '+(pr==='h'?'ниже':'выше')+' оси x — это, видимо, '+labelOf(b.name,pr)+'.',fix:{k:'rename',id:p.id,l:labelOf(b.name,pr)},id:p.id}); }));
  const ref=reference(dr,LIB), off=new Set();   /* точки условия, съехавшие с таблицы варианта: их чинит «по условию», а не выравнивание */
  if(ref) ref.given.forEach(nm=>{ const P=ref.pts[nm], b=by[nm]; ['f','h'].forEach(pr=>{ const p=b&&b[pr], want=pr==='f'?[-P[0],-P[2]]:[-P[0],P[1]]; if(p&&d2(p.at,want)>1.5) off.add(nm); }); });
  Object.values(sp.pts).forEach(p=>{ if(p.link>LINK_TOL&&!off.has(p.name)) out.push({k:'link',lvl:p.link>3?'bad':'warn',t:'Линия связи '+p.name+': разрыв '+f1(p.link)+' мм',d:p.name+'″ и '+p.name+'′ должны лежать на одной вертикали.',fix:{k:'align',name:p.name},id:p.f}); });
  const unv=dr.segs.filter(s=>s.unv).length+dr.arcs.filter(s=>s.unv).length;
  if(unv) out.push({k:'unv',lvl:'warn',t:'Не подтверждено карандашом: '+unv,d:'Эти линии модель увидела, а на фото под ними карандаш не нашёлся. Проверьте их (оранжевые) — подтвердите или уберите.',fix:{k:'unv'}});
  if(ref){ ref.given.forEach(nm=>{ const P=ref.pts[nm], b=by[nm]; ['f','h'].forEach(pr=>{ const want=pr==='f'?[-P[0],-P[2]]:[-P[0],P[1]], p=b&&b[pr];
      if(!p&&guess[nm+pr]) return;
      if(!p) out.push({k:'missing',lvl:'warn',t:'Нет точки '+labelOf(nm,pr)+' из условия',d:'В условии варианта '+ref.n+' она есть. Добавить по координатам условия?',fix:{k:'addGiven',name:nm,pr,at:want}});
      else { const e=d2(p.at,want); if(e>1.5) out.push({k:'given',lvl:e>4?'bad':'warn',t:labelOf(nm,pr)+' — '+f1(e)+' мм от условия',d:'По таблице варианта '+ref.n+' точка стоит иначе. Если это неточность фото — поставьте по условию.',fix:{k:'snapGiven',id:p.id,at:want},id:p.id}); } }); }); }
  const one=sp.edges.filter(e=>!e.both);
  if(one.length) out.push({k:'edge1',lvl:'info',t:'Рёбер только на одной проекции: '+one.length,d:one.slice(0,6).map(e=>e.a+e.b+(e.f?' (есть ″)':' (есть ′)')).join(', ')+(one.length>6?'…':'')+'. В 3D они бледные — проверьте вторую проекцию.'});
  if(Object.keys(sp.pts).length<3) out.push({k:'few',lvl:'bad',t:'Для 3D мало точек: '+Object.keys(sp.pts).length,d:'Нужно хотя бы три точки с обеими проекциями (A″ и A′). Проверьте подписи.'});
  return out; }
function ready(dr){ const sp=space(dr); return Object.keys(sp.pts).length>=3&&sp.edges.length>=1; }

function apply(dr,fix){ if(!fix) return false; const {by}=named(dr);
  if(fix.k==='align'){ const b=by[fix.name]; if(!b||!b.f||!b.h) return false; const u=r2((b.f.at[0]+b.h.at[0])/2); movePoint(dr,b.f.id,[u,b.f.at[1]]); movePoint(dr,b.h.id,[u,b.h.at[1]]); return true; }
  if(fix.k==='alignAll'){ Object.values(by).forEach(b=>{ if(b.f&&b.h&&Math.abs(b.f.at[0]-b.h.at[0])>0.05) apply(dr,{k:'align',name:b.name}); }); return true; }
  if(fix.k==='unvOk'){ dr.segs.forEach(s=>s.unv=false); dr.arcs.forEach(s=>s.unv=false); return true; }
  if(fix.k==='unvDrop'){ dr.segs=dr.segs.filter(s=>!s.unv); dr.arcs=dr.arcs.filter(s=>!s.unv); return true; }
  if(fix.k==='snapGiven'){ movePoint(dr,fix.id,fix.at); return true; }
  if(fix.k==='rename'){ const p=dr.pts.find(q=>q.id===fix.id); if(!p) return false; p.l=fix.l; return true; }
  if(fix.k==='addGiven'){ addPoint(dr,labelOf(fix.name,fix.pr),fix.at); return true; }
  return false; }

/* ── привязка к варианту вручную: точки условия на копии → их места по таблице варианта (аффинно, МНК); копия переводится в точные мм ── */
function bindVariant(dr,LIB,dz,n){ const gv=LIB&&LIB.variants&&LIB.variants.get(+dz,+n); if(!gv) return {ok:false,why:'нет такого варианта'};
  const {by}=named(dr), M=[], P=[], who=[];
  Object.entries(gv.data).forEach(([nm,X])=>{ const b=by[nm]; if(!b) return; if(b.f){ M.push(b.f.at); P.push([-X[0],-X[2]]); who.push(nm+'″'); } if(b.h){ M.push(b.h.at); P.push([-X[0],X[1]]); who.push(nm+'′'); } });
  if(M.length<3) return {ok:false,why:'на копии мало точек условия ('+M.length+'), нужно хотя бы 3 с подписями как в условии'};
  const A=affine(M,P); if(!A) return {ok:false,why:'точки условия на одной прямой'};
  const T=p=>[r2(A[0]*p[0]+A[1]*p[1]+A[2]),r2(A[3]*p[0]+A[4]*p[1]+A[5])];
  const res=M.map((m,i)=>d2(T(m),P[i])), rms=Math.sqrt(res.reduce((a,r)=>a+r*r,0)/res.length);
  const sc=Math.sqrt(Math.abs(A[0]*A[4]-A[1]*A[3]));
  if(rms>6||sc<0.3||sc>3) return {ok:false,why:'точки не похожи на вариант '+n+' (расхождение '+f1(rms)+' мм) — проверьте номер и подписи'};
  dr.pts.forEach(p=>p.at=T(p.at)); dr.segs.forEach(s=>{ s.a=T(s.a); s.b=T(s.b); }); dr.arcs.forEach(c=>c.poly=c.poly.map(T)); dr.txt.forEach(t=>t.at=T(t.at));
  if(dr.ph){ const I=inv(A); if(I){ const B=dr.ph; dr.ph=[B[0]*I[0]+B[1]*I[3],B[0]*I[1]+B[1]*I[4],B[0]*I[2]+B[1]*I[5]+B[2],B[3]*I[0]+B[4]*I[3],B[3]*I[1]+B[4]*I[4],B[3]*I[2]+B[4]*I[5]+B[5]]; } }
  Object.assign(dr,{dz:+dz,n:+n,rms:r2(rms),approx:false,originSet:true});
  return {ok:true,rms,used:who}; }

/* ── выгрузка ── */
const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function bounds(dr){ let a=[1e9,1e9], b=[-1e9,-1e9]; const g=p=>{ a=[Math.min(a[0],p[0]),Math.min(a[1],p[1])]; b=[Math.max(b[0],p[0]),Math.max(b[1],p[1])]; };
  dr.pts.forEach(p=>g(p.at)); dr.segs.forEach(s=>{ g(s.a); g(s.b); }); dr.arcs.forEach(c=>c.poly.forEach(g)); g([0,0]);
  return [a[0],a[1],b[0],b[1]]; }
/* чистая копия: основные линии 0,7 мм, штриховые 0,5, тонкие (не подтверждённые) — 0,35; ось x и O */
function toSVG(dr,o){ o=o||{}; const [x0,y0,x1,y1]=bounds(dr), m=8, W=x1-x0+2*m, H=y1-y0+2*m, X=u=>(u-x0+m).toFixed(2), Y=v=>(v-y0+m).toFixed(2);
  const ink=o.ink||'#111', L=[];
  L.push('<line x1="'+X(x0-4)+'" y1="'+Y(0)+'" x2="'+X(x1+4)+'" y2="'+Y(0)+'" stroke="'+ink+'" stroke-width="0.35"/>');
  L.push('<text x="'+X(x0-3)+'" y="'+Y(-1.5)+'" font-size="3.5" font-style="italic" fill="'+ink+'">x</text><text x="'+X(1)+'" y="'+Y(4.5)+'" font-size="3.5" fill="'+ink+'">O</text>');
  dr.segs.forEach(s=>L.push('<line x1="'+X(s.a[0])+'" y1="'+Y(s.a[1])+'" x2="'+X(s.b[0])+'" y2="'+Y(s.b[1])+'" stroke="'+(s.unv&&o.color?'#e07b00':ink)+'" stroke-width="'+(s.dash?0.5:s.unv?0.35:0.6)+'"'+(s.dash?' stroke-dasharray="3 1.5"':'')+' stroke-linecap="round"/>'));
  dr.arcs.forEach(c=>L.push('<polyline fill="none" points="'+c.poly.map(p=>X(p[0])+','+Y(p[1])).join(' ')+'" stroke="'+ink+'" stroke-width="'+(c.dash?0.5:0.6)+'"'+(c.dash?' stroke-dasharray="3 1.5"':'')+'/>'));
  dr.pts.forEach(p=>L.push('<circle cx="'+X(p.at[0])+'" cy="'+Y(p.at[1])+'" r="0.7" fill="'+ink+'"/><text x="'+(+X(p.at[0])+1.2).toFixed(2)+'" y="'+(+Y(p.at[1])-1.2).toFixed(2)+'" font-size="3.5" font-style="italic" fill="'+ink+'">'+esc(p.l)+'</text>'));
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W.toFixed(1)+' '+H.toFixed(1)+'" width="'+W.toFixed(1)+'mm" height="'+H.toFixed(1)+'mm" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/>'+L.join('')+'</svg>'; }
/* OBJ: точки — вершины (x, y, z в мм; ось Z вверх), рёбра — l, грани — f */
function toOBJ(dr){ const sp=space(dr), names=Object.keys(sp.pts), ix={}; const L=['# Начерт: 3D по оцифрованному чертежу «'+(dr.name||'')+'»','# мм; x — влево, y — к зрителю, z — вверх (как на эпюре)','o '+String(dr.name||'drawing').replace(/\s+/g,'_')];
  names.forEach((n,i)=>{ ix[n]=i+1; const P=sp.pts[n].P; L.push('v '+P.map(v=>v.toFixed(3)).join(' ')+'  # '+n); });
  sp.faces.forEach(f=>L.push('f '+f.map(n=>ix[n]).join(' ')));
  sp.edges.forEach(e=>L.push('l '+ix[e.a]+' '+ix[e.b]));
  return L.join('\n')+'\n'; }

const api={bindVariant,affine,inv,parseLabel,labelOf,fromScan,fromDrawing,movePoint,addPoint,addSeg,remove,setOrigin,named,space,reference,issues,ready,apply,toSVG,toOBJ,bounds,TOL,LINK_TOL};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else self.DRAWINGS=api;
})();
