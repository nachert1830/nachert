/* ═══════════ Эталонный граф чертежа ИГ №4: чистовик сайта → ig-graph v1 (мм листа) ═══════════
   Чистовик (IGS.sheet, А3 1:1, 3 ед./мм) — SVG: виды — картинки IG3.drawing (у каждой — линии с 3D-концами и видимостью),
   поверх — оси, волнистые, разомкнутые линии А–А, размеры, рамка и основная надпись. Разбор:
     картинка вида → какой это вызов IG3.drawing (по url) → его линии в мм листа (с обрезкой по clip-path половины вида/разреза),
       тип: видимая → main, невидимая → hidden; штриховка — области; 3D-концы каждой вершины (p3);
     линии листа: штрихпунктир → axis, Q-кривая → wavy, толщина ≥ 2,5 ед. → open (разомкнутая), прочие тонкие → thin (размеры: dim).
   Линия выреза K — все её точки на поверхности призмы K (k: 1): это ядро проверки ДЗ №4.
   Каждому виду — отображение «мм детали → мм листа» (F: x,z; T: x,y; L: y,z) и допустимые изображения (alts):
     T — вид с невидимыми / полный разрез / половина справа / половина снизу; L — вид / полный разрез / половина справа.
   refGraph(n, {model, key}) → граф; node lab/ig/ref.js [--n=8] [--all] [--out=lab/ig/ig4ref.json] */
'use strict';
const G=require('./ig3node.js');
const V='ig-graph', VER=1, U=3;   /* единиц чистовика на 1 мм */
const r2=v=>Math.round(v*100)/100;

/* ── аффинные 2×3: [a,b,c,d,e,f] — x' = a·x + b·y + c, y' = d·x + e·y + f ── */
const A0=[1,0,0,0,1,0], mul=(P,Q)=>[P[0]*Q[0]+P[1]*Q[3],P[0]*Q[1]+P[1]*Q[4],P[0]*Q[2]+P[1]*Q[5]+P[2],P[3]*Q[0]+P[4]*Q[3],P[3]*Q[1]+P[4]*Q[4],P[3]*Q[2]+P[4]*Q[5]+P[5]];
const ap=(M,p)=>[M[0]*p[0]+M[1]*p[1]+M[2],M[3]*p[0]+M[4]*p[1]+M[5]];
function tf(s){ let M=A0; if(!s) return M; String(s).replace(/(translate|scale)\(([^)]*)\)/g,(m,k,a)=>{ const v=a.split(/[\s,]+/).filter(Boolean).map(Number);
  M=mul(M,k==='translate'?[1,0,v[0],0,1,v[1]||0]:[v[0],0,0,0,v.length>1?v[1]:v[0],0]); return m; }); return M; }
const attrs=t=>{ const o={}; t.replace(/([\w:-]+)="([^"]*)"/g,(m,k,v)=>{ o[k]=v; return m; }); return o; };

/* обрезка отрезка прямоугольником (Лян — Барски) */
function clipSeg(p,q,R){ if(!R) return [p,q]; let t0=0,t1=1; const dx=q[0]-p[0], dy=q[1]-p[1];
  for(const [pp,qq] of [[-dx,p[0]-R[0]],[dx,R[2]-p[0]],[-dy,p[1]-R[1]],[dy,R[3]-p[1]]]){ if(pp===0){ if(qq<0) return null; continue; } const t=qq/pp; if(pp<0){ if(t>t1) return null; if(t>t0) t0=t; } else { if(t<t0) return null; if(t<t1) t1=t; } }
  return t1-t0<1e-9?null:[[p[0]+dx*t0,p[1]+dy*t0],[p[0]+dx*t1,p[1]+dy*t1]]; }
/* path d (M/L/Z и Q для волнистой) → ломаные */
function pathPolys(d){ const out=[]; let cur=null, st=null; const tk=String(d).match(/[MLQZmlz]|-?\d*\.?\d+(?:e-?\d+)?/g)||[]; let i=0, cmd='';
  const num=()=>+tk[i++];
  while(i<tk.length){ if(/[MLQZmlz]/.test(tk[i])) cmd=tk[i++]; if(cmd==='Z'||cmd==='z'){ if(cur&&st) cur.push(st.slice()); cur=null; continue; }
    if(cmd==='M'){ cur=[[num(),num()]]; st=cur[0]; out.push(cur); cmd='L'; } else if(cmd==='L'){ cur.push([num(),num()]); }
    else if(cmd==='Q'){ const c=[num(),num()], e=[num(),num()], s=cur[cur.length-1]; for(let k=1;k<=4;k++){ const t=k/4; cur.push([(1-t)*(1-t)*s[0]+2*(1-t)*t*c[0]+t*t*e[0],(1-t)*(1-t)*s[1]+2*(1-t)*t*c[1]+t*t*e[1]]); } }
    else i++; }
  return out; }

/* ── сцепка отрезков в ломаные (концы ближе tol), затем деление на элементы: прямые участки и кривые ── */
function chain(S,tol){ tol=tol||0.03; const key=p=>Math.round(p[0]/tol)+','+Math.round(p[1]/tol), M=new Map(), used=new Uint8Array(S.length);
  S.forEach((s,i)=>[0,1].forEach(e=>{ const k=key(s.p[e]); if(!M.has(k)) M.set(k,[]); M.get(k).push([i,e]); }));
  const near=p=>{ const [x,y]=key(p).split(',').map(Number), r=[]; for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){ const L=M.get((x+a)+','+(y+b)); if(L) r.push(...L); } return r; };
  const out=[];
  for(let i=0;i<S.length;i++){ if(used[i]) continue; used[i]=1; let P=[S[i].p[0],S[i].p[1]], P3=[S[i].p3[0],S[i].p3[1]];
    for(const dir of [1,0]){ for(;;){ const end=dir?P[P.length-1]:P[0], c=near(end).find(([j,e])=>!used[j]&&Math.hypot(S[j].p[e][0]-end[0],S[j].p[e][1]-end[1])<tol); if(!c) break;
        const [j,e]=c; used[j]=1; const nx=S[j].p[1-e], n3=S[j].p3[1-e]; if(dir){ P.push(nx); P3.push(n3); } else { P.unshift(nx); P3.unshift(n3); } } }
    out.push({p:P,p3:P3}); }
  return out; }
/* упрощение (Дуглас — Пекер) с сохранением 3D-вершин */
function dp(P,P3,e){ if(P.length<3) return {p:P,p3:P3}; const keep=new Uint8Array(P.length); keep[0]=keep[P.length-1]=1; const st=[[0,P.length-1]];
  while(st.length){ const [a,b]=st.pop(); let m=-1, md=e; const A=P[a], B=P[b], L=Math.hypot(B[0]-A[0],B[1]-A[1])||1e-9;
    for(let i=a+1;i<b;i++){ const d=Math.abs((B[0]-A[0])*(A[1]-P[i][1])-(A[0]-P[i][0])*(B[1]-A[1]))/L; if(d>md){ md=d; m=i; } } if(m>0){ keep[m]=1; st.push([a,m],[m,b]); } }
  const I=[...keep.keys()].filter(i=>keep[i]); return {p:I.map(i=>P[i]),p3:P3&&I.map(i=>P3[i])}; }
/* элементы: ломаная делится в изломах > 25° на прямые; кривая (много мелких звеньев одного направления) остаётся целой */
function elements(L){ const out=[]; L.forEach(q=>{ const s=dp(q.p,q.p3,0.04), P=s.p, P3=s.p3; let a=0;
  const ang=i=>{ const u=[P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]], v=[P[i+1][0]-P[i][0],P[i+1][1]-P[i][1]]; return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/((Math.hypot(...u)*Math.hypot(...v))||1)))); };
  for(let i=1;i<P.length;i++) if(i===P.length-1||ang(i)>25*Math.PI/180){ out.push({p:P.slice(a,i+1),p3:P3&&P3.slice(a,i+1)}); a=i; } });
  return out.filter(e=>plen(e.p)>0.3); }
const plen=P=>{ let s=0; for(let i=1;i<P.length;i++) s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); return s; };

/* вырез K модели: многоугольники [[x,z],…] (узлы с pts в вычитаемых частях дерева) */
function kPolys(m){ const out=[]; (function w(n){ if(!n) return; if(n.pts) out.push(n.pts); if(n.t==='s'){ (n.k||[]).forEach(w); } else if(n.t==='u'||n.t==='i') (n.k||[]).forEach(w); })(m.tree); return out; }
const segD=(p,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy||1e-12, t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L)); return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); };
const onK=(K,p3)=>K.some(P=>P.some((a,i)=>segD([p3[0],p3[2]],a,P[(i+1)%P.length])<0.08));
/* сторона K, на которой лежит 3D-точка (для «где»): индекс многоугольника и стороны */
const kSide=(K,p3)=>{ let best=null, bd=0.08; K.forEach((P,pi)=>P.forEach((a,i)=>{ const d=segD([p3[0],p3[2]],a,P[(i+1)%P.length]); if(d<bd){ bd=d; best=[pi,i]; } })); return best; };

const VIEWOF=v=>/^front/.test(v)?'F':/^left/.test(v)?'L':'T';
const AX={F:[0,2],T:[0,1],L:[1,2]};   /* координаты детали на виде */

/* линии одного вызова IG3.drawing → элементы в мм листа (M — px картинки → мм листа, R — обрезка в мм) */
function drawLines(r,M,R){ const S=[]; r.lines.forEach(s=>{ const p=ap(M,s.a), q=ap(M,s.b), c=clipSeg(p,q,R); if(!c) return;
    const t=k=>{ const d=Math.hypot(q[0]-p[0],q[1]-p[1])||1, u=Math.hypot(c[k][0]-p[0],c[k][1]-p[1])/d; return s.a3.map((v,i)=>v+(s.b3[i]-v)*u); };
    S.push({p:c,p3:[t(0),t(1)],h:!!s.h}); });
  const out=[]; [false,true].forEach(h=>elements(chain(S.filter(s=>s.h===h))).forEach(e=>out.push(Object.assign(e,{type:h?'hidden':'main'})))); return out; }
function hatchOf(r,M,R){ const m=String(r.svg).match(/<path d="([^"]*)" fill="url\(#h\)"/); if(!m) return []; return pathPolys(m[1]).map(P=>P.map(p=>ap(M,p))).map(P=>R?P.map(p=>[Math.max(R[0],Math.min(R[2],p[0])),Math.max(R[1],Math.min(R[3],p[1]))]):P).filter(P=>P.length>2); }

/* модель → отображение вида: мм детали (u, v по AX) → мм листа; по px трёх точек */
function viewMap(r,M,id){ const [iu,iv]=AX[id], q=(u,v)=>{ const p=[0,0,0]; p[iu]=u; p[iv]=v; return ap(M,r.px(p)); }, o=q(0,0), a=q(1,0), b=q(0,1);
  return [a[0]-o[0],b[0]-o[0],o[0],a[1]-o[1],b[1]-o[1],o[1]].map(v=>Math.round(v*1e6)/1e6); }

function refGraph(n,o){ o=o||{}; const m=o.model||G.part(n); if(!m) throw new Error('нет варианта '+n);
  G.calls.length=0; const svg=G.sheet(m,n,o.key), K=kPolys(m);
  /* разбор SVG: стек групп (transform, clip-path) */
  const clips={}, st=[{M:A0,clip:null}], items=[]; let inClip=null;
  const re=/<(\/?)(g|image|line|path|circle|rect|clipPath|text|defs|svg)\b([^>]*?)(\/?)>/g; let t;
  while((t=re.exec(svg))){ const [, close, tag, body, self]=t, a=attrs(body), top=st[st.length-1];
    if(tag==='clipPath'){ if(close) inClip=null; else inClip=a.id; continue; }
    if(tag==='rect'&&inClip){ const R=[+a.x,+a.y,+a.x+ +a.width,+a.y+ +a.height], p=ap(top.M,[R[0],R[1]]), q=ap(top.M,[R[2],R[3]]); clips[inClip]=[p[0]/U,p[1]/U,q[0]/U,q[1]/U]; continue; }
    if(tag==='g'){ if(close){ st.pop(); continue; } const c=(a['clip-path']||'').match(/#([^)]+)/); st.push({M:mul(top.M,tf(a.transform)),clip:c?c[1]:top.clip}); continue; }
    if(close||tag==='svg'||tag==='defs'||tag==='text') continue;
    const M=mul(top.M,tf(a.transform)); items.push({tag,a,M,clip:top.clip,top:st.length}); }
  const mm=(M,p)=>{ const q=ap(M,p); return [q[0]/U,q[1]/U]; };
  const views={}, lines=[], hatch=[];
  items.filter(it=>it.tag==='image').forEach(it=>{ const c=G.calls.find(c=>c.r.url===it.a.href); if(!c) return; const id=VIEWOF(c.view);
    const Mpx=mul([1/U,0,0,0,1/U,0],mul(it.M,[(+it.a.width||900)/c.r.W,0,+it.a.x||0,0,(+it.a.height||900)/c.r.W,+it.a.y||0])), R=it.clip?clips[it.clip]:null;
    const v=views[id]||(views[id]={id,parts:[],map:viewMap(c.r,Mpx,id),mmPerUnit:Math.hypot(...viewMap(c.r,Mpx,id).slice(0,1))});
    v.parts.push({view:c.view,off:c.off,bnd:c.bnd,clip:R&&R.map(r2)});
    drawLines(c.r,Mpx,R).forEach(e=>lines.push(Object.assign(e,{view:id})));
    hatchOf(c.r,Mpx,R).forEach(P=>hatch.push({view:id,poly:P})); });
  /* линии листа: только внутри группы чертежа (рамка и основная надпись — вне её, у них top = 1) */
  items.filter(it=>it.top>1&&it.tag!=='image').forEach(it=>{ const a=it.a;
    if(it.tag==='line'){ const p=mm(it.M,[+a.x1,+a.y1]), q=mm(it.M,[+a.x2,+a.y2]), w=+a['stroke-width']||1;
      lines.push({type:a['stroke-dasharray']?'axis':w>=2.5?'open':'thin',p:[p,q]}); return; }
    if(it.tag==='circle'){ const c=mm(it.M,[+a.cx,+a.cy]), r=+a.r/U, P=[]; for(let i=0;i<=72;i++) P.push([c[0]+r*Math.cos(i*Math.PI/36),c[1]+r*Math.sin(i*Math.PI/36)]); lines.push({type:'thin',p:P,circ:[c[0],c[1],r]}); return; }
    if(it.tag==='path'&&a.fill==='none'&&/Q/.test(a.d)) pathPolys(a.d).forEach(P=>lines.push({type:'wavy',p:P.map(p=>mm(it.M,p))})); });
  /* к какому виду относится линия листа: ближайшая рамка вида (по линиям main/hidden) */
  Object.values(views).forEach(v=>{ const P=[].concat(...lines.filter(l=>l.view===v.id).map(l=>l.p)); v.box=[Math.min(...P.map(p=>p[0])),Math.min(...P.map(p=>p[1])),Math.max(...P.map(p=>p[0])),Math.max(...P.map(p=>p[1]))].map(r2); });
  const boxD=(b,p)=>Math.hypot(Math.max(b[0]-p[0],0,p[0]-b[2]),Math.max(b[1]-p[1],0,p[1]-b[3]));
  lines.filter(l=>!l.view).forEach(l=>{ const mid=l.p[Math.floor(l.p.length/2)], m2=l.p.length===2?[(l.p[0][0]+l.p[1][0])/2,(l.p[0][1]+l.p[1][1])/2]:mid;
    let best=null, bd=1e9; Object.values(views).forEach(v=>{ const d=boxD(v.box,m2); if(d<bd){ bd=d; best=v.id; } }); l.view=best;
    /* тонкие сплошные — размерные и выносные (не предмет проверки первого запуска); окружность Ø описанной — тоже тонкая */
    if(l.type==='thin'&&!l.circ) l.dim=1; });
  /* признаки: линия выреза K, сторона K; длина */
  lines.forEach((l,i)=>{ l.id=i; l.len=r2(plen(l.p)); if(l.p3){ const S=l.p3.filter((p,j)=>j===0||j===l.p3.length-1||j%3===0); l.k=S.every(p=>onK(K,p))?1:0; if(l.k){ const sd=kSide(K,l.p3[Math.floor(l.p3.length/2)]); if(sd) l.kside=sd; } }
    l.p=l.p.map(p=>[r2(p[0]),r2(p[1])]); if(l.p3) l.p3=l.p3.map(p=>p.map(r2)); });
  const sp=G.IGUI.igSpec(m);
  /* проекционные связи (мм листа): F и T — общий x детали, F и L — общий z */
  const links=[];
  if(views.F&&views.T) links.push({a:'F',b:'T',axis:'x'}); if(views.F&&views.L) links.push({a:'F',b:'L',axis:'z'});
  return {format:V,v:VER,src:'site',n,sheet:{w:Math.round(svgW(svg)/U),h:Math.round(svgH(svg)/U)},spec:{F:sp.F,L:sp.L,H:sp.H,tb:sp.tb,yb:sp.yb,xb:sp.xb},
    model:{box:m.box,K,hz:m.hz&&m.hz.z},views:Object.values(views),links,lines,hatch:hatch.map(h=>({view:h.view,poly:dpRing(closed(h.poly),0.05).map(p=>[r2(p[0]),r2(p[1])])})),svg:o.svg?svg:undefined}; }
/* замкнутый контур: последняя точка = первая — упрощение по хорде нулевой длины съело бы всё */
/* упрощение кольца: делим в самой дальней от начала точке — две открытые ломаные */
const dpRing=(P,e)=>{ if(P.length<4) return P; let k=0, m=-1; P.forEach((p,i)=>{ const d=Math.hypot(p[0]-P[0][0],p[1]-P[0][1]); if(d>m){ m=d; k=i; } }); const a=dp(P.slice(0,k+1),null,e).p, b=dp(P.slice(k).concat([P[0]]),null,e).p; return a.concat(b.slice(1,-1)); };
const closed=P=>P.length>3&&Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1])<1e-6?P.slice(0,-1):P;
const svgW=s=>+((s.match(/viewBox="0 0 ([\d.]+)/)||[])[1]||1260), svgH=s=>+((s.match(/viewBox="0 0 [\d.]+ ([\d.]+)/)||[])[1]||891);

/* ── допустимые изображения вида (проверяется результат, а не выбор композиции): линии в мм детали (u, v вида) ── */
function altViews(n,o){ o=o||{}; const m=o.model||G.part(n), sp=G.IGUI.igSpec(m), IG3=G.IG3, W=900, out={};
  const lin=(r,id,keep)=>{ const [iu,iv]=AX[id], S=[]; r.lines.forEach(s=>{ const P=[s.a3,s.b3]; if(keep&&!keep(s)) return; S.push({p:P.map(q=>[q[iu],q[iv]]),p3:P,h:!!s.h}); });
    const L=[]; [false,true].forEach(h=>elements(chain(S.filter(s=>s.h===h),0.05)).forEach(e=>L.push({type:h?'hidden':'main',p:e.p,p3:e.p3}))); return L; };
  const half=(rv,rs,id,side)=>lin(rv,id,s=>side(s.a3)<=0.01&&side(s.b3)<=0.01).concat(lin(rs,id,s=>side(s.a3)>=-0.01&&side(s.b3)>=-0.01));
  const hz=m.hz&&m.hz.z;
  if(hz!=null){ const v=IG3.drawing(m,'top',W), nh=IG3.drawing(m,'topNH',W), c=IG3.drawing(m,'topcut',W,hz);
    out.T={view:lin(v,'T'),full:lin(c,'T'),halfR:half(nh,c,'T',p=>p[0]-(sp.tb||0)),halfD:half(nh,c,'T',p=>-p[1])}; }
  const lv=IG3.drawing(m,'left0',W), lf=IG3.drawing(m,'leftF',W,0), lh=IG3.drawing(m,'left',W,0,sp.yb||0);
  out.L={view:lin(lv,'L'),full:lin(lf,'L'),half:lin(lh,'L')};
  out.F={view:lin(IG3.drawing(m,'front0',W),'F')};
  return out; }

/* допустимые изображения — в файл: линии в мм детали, признак выреза K, округление 0,01 мм */
function packAlts(al,K){ const o={}; Object.entries(al).forEach(([id,v])=>{ o[id]={}; Object.entries(v).forEach(([k,L])=>{ o[id][k]=L.filter(l=>plen(l.p)>0.3).map(l=>{ const S=l.p3.filter((p,j)=>j===0||j===l.p3.length-1||j%3===0), kk=S.every(p=>onK(K,p))?1:0, r={type:l.type,p:l.p.map(p=>[r2(p[0]),r2(p[1])])}; if(kk){ r.k=1; const sd=kSide(K,l.p3[Math.floor(l.p3.length/2)]); if(sd) r.kside=sd; } return r; }); }); }); return o; }
module.exports={refGraph,altViews,packAlts,kPolys,pathPolys,chain,elements,dp,plen,clipSeg,ap,mul,AX,onK,kSide};
if(require.main===module){ const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), fs=require('fs');
  const ns=('all' in A)?Array.from({length:30},(_,i)=>i+1):[+(A.n||8)], out={};
  ns.forEach(n=>{ const t0=Date.now(); try{ const g=refGraph(n); out[n]=g; if(!('noalts' in A)) g.alts=packAlts(altViews(n),g.model.K); const c={}; g.lines.forEach(l=>{ c[l.type]=(c[l.type]||0)+1; });
      console.log('в.'+n+': виды '+g.views.map(v=>v.id+'['+v.box.map(Math.round)+']').join(' ')+' · линии '+JSON.stringify(c)+' · K-линий '+g.lines.filter(l=>l.k).length+' · '+(Date.now()-t0)+' мс'); }
    catch(e){ console.log('в.'+n+': ОШИБКА '+e.message); } });
  if(A.out) fs.writeFileSync(A.out,JSON.stringify({format:V,v:VER,vars:out})); }
