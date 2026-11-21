/* ═══════════ Подготовка по инже: виды, разрезы, сечения на 3D-ядре IG3 ═══════════
   Каждая пара — новая случайная деталь (дерево IG3.P). Чертёж считает IG3.drawing: видимые, невидимые линии и штриховка —
   из модели, не нарисованы руками. Ловушка — одно отличие, которое делает типичная ошибка студента:
   вид не на своём месте, глубина перевёрнута, невидимое сплошной, штриховые на разрезе, разный наклон штриховки,
   разрез не с той стороны оси, в сечении лишнее. Только в браузере (IG3 живёт в index.html). */
(function(){
if(typeof window==='undefined'||!self.PREP) return;
const R=(a,b)=>a+Math.random()*(b-a), RI=(a,b)=>Math.round(R(a,b)), pick=a=>a[Math.floor(Math.random()*a.length)];
const W=100;                                   /* размер окна одного вида в единицах чертежа */
const G3=()=>window.IG3;
/* ── детали ── */
/* несимметричная: основание, стойка с вырезом спереди, отверстие в основании — у неё перед и зад различимы */
function partL(o){ const {P}=G3(); const L=RI(70,90), D=RI(40,50), h=RI(10,16), H=RI(34,46), w=RI(22,30), side=pick([-1,1]);
  const xs=side*(L/2-w/2), notch=RI(10,16), nz=RI(h+6,H-8), hx=-side*RI(L/2-24,L/2-14), hr=RI(5,7);
  const tree=P.S(P.U(P.box(L,D,0,h),P.box(w,D,h,H,{x:xs})),P.box(w+2,notch+1,nz,H+1,{x:xs,y:-D/2+notch/2-0.5}),P.cyl(hr,-1,h+1,{x:hx,y:o&&o.back?RI(D/4,D/3):RI(-6,6)}));
  return {title:'Деталь',box:[[-L/2,-D/2,0],[L/2,D/2,H]],tree}; }
/* симметричная: фланец, бобышка, сквозное отверстие и 4 отверстия на фланце — для полуразрезов */
function partSym(){ const {P}=G3(); const Rf=RI(34,42), hf=RI(10,14), Rb=RI(16,22), H=RI(38,50), rb=RI(8,Rb-6), rh=RI(3,5), Rc=Math.round((Rf+Rb)/2+2);
  const holes=[0,1,2,3].map(i=>P.cyl(rh,-1,hf+1,{x:Rc*Math.cos(Math.PI/4+i*Math.PI/2),y:Rc*Math.sin(Math.PI/4+i*Math.PI/2)}));
  const tree=P.S(P.U(P.cyl(Rf,0,hf),P.cyl(Rb,hf,H)),P.cyl(rb,-1,H+1),...holes);
  return {title:'Фланец',box:[[-Rf,-Rf,0],[Rf,Rf,H]],tree}; }
/* основание и стенка у задней грани: секущая фронтальная плоскость через середину режет только основание — стенка за ней */
function partBack(){ const {P}=G3(); const L=RI(70,90), D=RI(40,50), h=RI(10,14), t=RI(8,12), H=RI(36,48), w=RI(40,L-10), hr=RI(5,7);
  const tree=P.S(P.U(P.box(L,D,0,h),P.box(w,t,h,H,{y:D/2-t/2})),P.cyl(hr,-1,h+1,{x:RI(-L/2+12,-L/2+20)}));
  return {title:'Основание со стенкой',box:[[-L/2,-D/2,0],[L/2,D/2,H]],tree}; }
/* простое тело: цилиндр, конус, шар, призма, пирамида — «что во что проецируется» */
function partBody(kind){ const {P}=G3(); const r=RI(22,30), H=RI(40,56);
  const T={cyl:()=>P.cyl(r,0,H),cone:()=>P.cone(r,0.01,0,H),sph:()=>P.U(P.cyl(0.01,0,0.01,{x:0}),P.S(P.cyl(r,0,2*r),[])),prism:()=>P.ngon(6,2*r*Math.cos(Math.PI/6),0,H),pyr:()=>P.npyr(4,2*r*.8,0.6,0,H)}[kind];
  const z1=kind==='sph'?2*r:H;
  return {title:kind,box:[[-r,-r,0],[r,r,z1]],tree:T()}; }
/* ── вид → элементы чертежа ── */
const num=/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g;
const shift=(d,ox,oy,mx)=>d.replace(num,(m,x,y)=>`${(mx?mx-(+x):+x)+ox} ${+y+oy}`);
function viewEls(model,view,ox,oy,role,o){
  o=o||{}; const d=G3().drawing(model,view,W*3);       /* считаем в 300 px, переводим в 100 единиц */
  const k=1/3, L=d.lines.map(s=>({a:[s.a[0]*k,s.a[1]*k],b:[s.b[0]*k,s.b[1]*k],h:s.h}));
  const ph=G3().paths(L), E=[], mx=o.mirror?W:0;
  if(o.hat!==false){ const m=/<path d="([^"]*)" fill="url\(#h\)"/.exec(d.svg); if(m){ const hd=m[1].replace(num,(q,x,y)=>`${+x*k} ${+y*k}`); E.push({t:'path',d:shift(hd,ox,oy,mx),c:o.hat||'hat',role:role+'hat'}); } }
  if(ph.v) E.push({t:'path',d:shift(ph.v,ox,oy,mx),c:'o',role});
  if(ph.h&&!o.noHid) E.push({t:'path',d:shift(ph.h,ox,oy,mx),c:'o',dash:!o.solidHid,role:role+'h'});
  return E;
}
/* рамка сцены по линиям: обрезаем пустые поля окон видов */
function frame(E){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; E.forEach(e=>{ if(e.t!=='path') return; e.d.replace(num,(m,x,y)=>{ x=+x; y=+y; x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y); return m; }); });
  return [x0-6,y0-6,x1-x0+12,y1-y0+12]; }
const scene=E=>({box:frame(E),E,hatch:true});
const T3=(cap)=>[{cap:'Главный вид — изображение на фронтальной плоскости',roles:['F','Fh','Fhat']},{cap:'Вид сверху — под главным, ширины те же',roles:['F','Fh','Fhat','T','Th']},{cap:cap||'Вид слева — справа от главного, высоты те же, глубина — с вида сверху',roles:['F','Fh','Fhat','T','Th','L','Lh','Lhat']}];
/* три вида: главный (0,0), сверху — под ним, слева — справа (ГОСТ 2.305) */
function three(m,o){ o=o||{}; const pos=Object.assign({F:[0,0],T:[0,W],L:[W,0]},o.pos||{});
  return viewEls(m,o.F||'front0',pos.F[0],pos.F[1],'F',o.Fo).concat(viewEls(m,'top',pos.T[0],pos.T[1],'T',o.To),viewEls(m,o.L||'left0',pos.L[0],pos.L[1],'L',o.Lo)); }
const reg=(id,o)=>PREP.topic(id,Object.assign({make(){ return {m:o.part()}; }},o));
/* v1 — три вида на своих местах */
reg('v1',{part:partL,
  scene(V,k){ const pos=k==='L'?{L:[-W,0]}:k==='T'?{T:[0,-W]}:null; return scene(three(V.m,{pos})); },
  traps:{L:{b0:-0.4,say:'Вид слева стоит справа от главного, а не слева',src:'ГОСТ 2.305; тетрадь, рис. 29–30',hl:['L','Lh']},
         T:{b0:-0.2,say:'Вид сверху стоит под главным, а не над ним',src:'ГОСТ 2.305; тетрадь, рис. 29–30',hl:['T','Th']}},
  watch:{steps:T3()}});
/* v2 — проекционная связь: высоты и глубина */
reg('v2',{part:partL,
  scene(V,k){ return scene(three(V.m,{Lo:{mirror:k==='D'},pos:k==='H'?{L:[W,7]}:null})); },
  traps:{D:{b0:0.3,say:'Перед и зад перепутаны: передняя сторона на виде сверху — внизу, на виде слева — справа',src:'тетрадь, рис. 54',hl:['L','Lh']},
         H:{b0:-0.2,say:'Высоты на виде слева не совпадают с главным видом',src:'ГОСТ 2.305',hl:['L','Lh']}},
  watch:{steps:T3('Вид слева: высоты — с главного вида, глубина — с вида сверху от одной базы')}});
/* v6 — видимые и невидимые линии */
reg('v6',{part:partL,
  scene(V,k){ return scene(three(V.m,{Lo:{solidHid:k==='S',noHid:k==='N'}})); },
  fair(V,k,ok){ return ok.E.some(e=>e.role==='Lh'); },
  traps:{S:{b0:-0.3,say:'Невидимый контур проведён сплошной линией',src:'ГОСТ 2.303',hl:['Lh']},
         N:{b0:0.2,say:'Невидимый контур не показан — форма не читается',src:'ГОСТ 2.303, 2.305',hl:['Lh']}},
  watch:{steps:T3('Вид слева: то, что закрыто телом, — штриховыми линиями')}});
/* v5 — что во что проецируется: вид сверху от другого тела */
const BODY=['cyl','cone','prism','pyr'];
reg('v5',{make(){ const k=pick(BODY); return {k,m:partBody(k),w:partBody(pick(BODY.filter(x=>x!==k)))}; },
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F').concat(viewEls(k==='W'?V.w:V.m,'top',0,W,'T'),viewEls(V.m,'left0',W,0,'L')); return scene(E); },
  traps:{W:{b0:-0.2,say:'Вид сверху не того тела: проверь, во что проецируется тело на горизонтальную плоскость',src:'тетрадь, рис. 29',hl:['T','Th']}},
  watch:{steps:T3('Цилиндр и конус сверху — окружности, призма и пирамида — многоугольники')}});
/* r1 — разрез: штриховые за плоскостью становятся видимыми; на разрезе их нет */
reg('r1',{part:partL,
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F',{hat:false}).concat(viewEls(V.m,'leftF',W,0,'L'));
    if(k==='H'){ const h=viewEls(V.m,'left0',W,0,'X',{hat:false}).filter(e=>e.role==='Xh'); h.forEach(e=>e.role='Lx'); E.push(...h); }
    return scene(E); },
  fair(V,k,ok,bad){ return k!=='H'||bad.E.some(e=>e.role==='Lx'); },
  traps:{H:{b0:0,say:'На разрезе оставили штриховые линии — то, что за плоскостью, теперь видно',src:'ГОСТ 2.305; тетрадь, с. 20',hl:['Lx']}},
  watch:{steps:[{cap:'Деталь: главный вид',roles:['F','Fh']},{cap:'Мысленно рассекаем профильной плоскостью и убираем ближнюю часть: фигура в плоскости — штрихуется',roles:['F','Fh','Lhat']},{cap:'За плоскостью — видимые линии; штриховых на разрезе нет',roles:['F','Fh','Lhat','L','Lh']}]}});
/* r2 — одна деталь — один наклон и шаг штриховки на всех разрезах */
reg('r2',{part:partSym,
  scene(V,k){ return scene(viewEls(V.m,'frontF',0,0,'F').concat(viewEls(V.m,'leftF',W,0,'L',{hat:k==='A'?'hat2':'hat'}))); },
  traps:{A:{b0:-0.3,say:'На разрезах одной детали разный наклон штриховки',src:'ГОСТ 2.306; тетрадь, с. 28',hl:['Lhat']}},
  watch:{steps:[{cap:'Фронтальный разрез: штриховка под 45°',roles:['F','Fh','Fhat']},{cap:'Профильный разрез той же детали — тот же наклон и шаг',roles:['F','Fh','Fhat','L','Lh','Lhat']}]}});
/* r4 — половина вида и половина разреза: разрез справа от оси */
reg('r4',{part:partSym,
  scene(V,k){ return scene(viewEls(V.m,'front',0,0,'F',{mirror:k==='M'}).concat(viewEls(V.m,'top',0,W,'T'))); },
  traps:{M:{b0:-0.2,say:'Разрез поставили слева от оси — его ставят справа',src:'ГОСТ 2.305; тетрадь, рис. 43',hl:['F','Fhat']}},
  watch:{steps:[{cap:'Деталь симметрична — вид и разрез можно совместить на одном изображении',roles:['T','Th']},{cap:'Граница — ось симметрии; справа — разрез',roles:['T','Th','F','Fhat']},{cap:'Слева — вид, без штриховых: внутреннее показано разрезом',roles:['T','Th','F','Fh','Fhat']}]}});
/* c1 — сечение: только то, что в плоскости */
reg('c1',{part:partBack,
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F',{hat:false}).concat(viewEls(V.m,'top',0,W,'T'));
    const S=viewEls(V.m,'frontF',W,0,'S'); if(k==='B') return scene(E.concat(S));
    /* сечение: штриховка фигуры и её контур — без линий за плоскостью */
    const h=S.find(e=>e.role==='Shat'); return scene(E.concat(h?[h,{t:'path',d:h.d,c:'o',role:'S'}]:[])); },
  traps:{B:{b0:0,say:'В сечение добавили то, что за плоскостью, — это уже разрез',src:'ГОСТ 2.305; тетрадь, с. 26',hl:['S','Sh']}},
  watch:{steps:[{cap:'Деталь: главный вид и вид сверху',roles:['F','Fh','T','Th']},{cap:'Сечение фронтальной плоскостью — только фигура в плоскости; стенка за плоскостью в сечение не входит',roles:['F','Fh','T','Th','Shat','S']}]}});
/* точка модели → точка вида в сцене (тот же масштаб и смещение, что у viewEls) */
function proj(model,view,ox,oy,o){ const d=G3().drawing(model,view,W*3); return p=>{ const q=d.px(p); return [(o&&o.mirror?W-q[0]/3:q[0]/3)+ox,q[1]/3+oy]; }; }
/* ── тела с вырезом: настоящие детали ДЗ 4–6 (модели вариантов) ── */
/* детали ДЗ: за сессию берём небольшой набор вариантов (6 на задание) — чертежи у модели кэшируются, повторная пара почти мгновенна;
   производные модели (тело без выреза, без полости) тоже кэшируем на самой модели */
const POOL={};
const DZM=(d,ns)=>{ const fresh=!POOL[d], pool=POOL[d]||(POOL[d]=ns.slice().sort(()=>Math.random()-.5).slice(0,6)); if(fresh) setTimeout(()=>self.IGWARM&&self.IGWARM(d),0);
  for(let t=0;t<8;t++){ const n=pick(pool); try{ const m=window.DZR&&DZR.get(d).part(n); if(m&&m.tree&&m.tree.t==='s'){ if(!m._pbody) Object.defineProperty(m,'_pbody',{value:{box:m.box,tree:m.tree.a}}); return {m,body:m._pbody,d,n}; } }catch(e){} } return null; };
/* прогрев: после открытия темы строим чертежи набора заранее, в паузах */
self.IGWARM=(d,views)=>{ const ns=POOL[d]||[]; let i=0; const step=()=>{ if(i>=ns.length) return; try{ const m=DZR.get(d).part(ns[i++]); (views||['front0','top','left0']).forEach(v=>G3().drawing(m,v,W*3)); }catch(e){} (self.requestIdleCallback||setTimeout)(step,50); }; step(); };
const N30=Array.from({length:30},(_,i)=>i+1);
const differs=(ok,bad,roles)=>{ const key=S=>S.E.filter(e=>roles.includes(e.role)).map(e=>e.d).join('|'); return key(ok)!==key(bad); };
const cutSteps=[{cap:'Дано: главный вид с вырезом K — грани выреза проецирующие, на этом виде они уже линии',roles:['F','Fh']},
  {cap:'Вид сверху: каждую точку выреза — по линии связи и принадлежности поверхности',roles:['F','Fh','T','Th']},
  {cap:'Вид слева: высоты — с главного, глубина — с вида сверху; невидимое — штриховыми',roles:['F','Fh','T','Th','L','Lh']}];
reg('k1',{make(){ return Math.random()<.5?DZM('ig4',N30):DZM('ig5',N30.filter(n=>![17,21,29].includes(n))); },
  scene(V,k){ const mT=k==='N'?V.body:V.m, mL=k==='N'||k==='L'?V.body:V.m;
    return scene(viewEls(V.m,'front0',0,0,'F',{hat:false}).concat(viewEls(mT,'top',0,W,'T',{hat:false}),viewEls(mL,'left0',W,0,'L',{hat:false}))); },
  fair(V,k,ok,bad){ return differs(ok,bad,['T','Th','L','Lh']); },
  traps:{N:{b0:-0.4,say:'Вырез есть на главном виде, но не перенесён на вид сверху и вид слева',src:'методика ДЗ 4–5',hl:['T','Th','L','Lh']},
         L:{b0:0.1,say:'На виде слева нет линий выреза: точки выреза не перенесены по высоте и глубине',src:'методика ДЗ 4–5',hl:['L','Lh']}},
  watch:{steps:cutSteps}});
reg('k6',{make(){ return DZM('ig6',N30); },
  scene(V,k){ const mL=k==='L'?V.body:V.m; return scene(viewEls(V.m,'front0',0,0,'F',{hat:false}).concat(viewEls(V.m,'top',0,W,'T',{hat:false}),viewEls(mL,'left0',W,0,'L',{hat:false}))); },
  fair(V,k,ok,bad){ return differs(ok,bad,['L','Lh']); },
  traps:{L:{b0:-0.2,say:'На виде слева не построены линии отверстия: каждая грань режет шар по окружности r = √(R² − d²)',src:'методика ДЗ 6',hl:['L','Lh']}},
  watch:{steps:[{cap:'Дано: шар и отверстие K на главном виде — грани K плоскости уровня',roles:['F','Fh']},{cap:'Вид сверху: горизонтальная грань режет шар по окружности — здесь она в натуральную величину',roles:['F','Fh','T','Th']},{cap:'Вид слева: профильная грань — окружность, остальные грани — отрезки; полость — штриховыми',roles:['F','Fh','T','Th','L','Lh']}]}});
self.IGV={W,R,RI,pick,G3,partL,partSym,partBack,partBody,viewEls,frame,scene,three,reg,proj,shift,num,DZM,differs,N30};
})();
