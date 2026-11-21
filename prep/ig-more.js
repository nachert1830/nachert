/* ═══════════ Подготовка по инже: остальные виды, разрезы, сечения, тела с вырезом, размеры — на 3D-ядре IG3 ═══════════
   Вспомогательные функции — из prep/ig-views.js (self.IGV). Каждая пара — новая деталь (своя или настоящая из ДЗ 4–6),
   чертёж считает IG3, ловушка — одно отличие типичной ошибки. Только в браузере. */
(function(){
if(typeof window==='undefined'||!self.PREP||!self.IGV) return;
const {W,R,RI,pick,G3,partL,partSym,partBack,partBody,viewEls,frame,scene,reg,proj,shift,num,DZM,differs,N30}=self.IGV;
const st=(...a)=>a.map(([cap,roles])=>({cap,roles}));
const Ln=(a,b,c,role,dash)=>({t:'line',a:[a[0],a[1],b[0],b[1]],c,role,dash});
const Tx=(a,s,role,o)=>Object.assign({t:'txt',a,s,role,anchor:'middle',size:5},o||{});
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mul=(a,k)=>[a[0]*k,a[1]*k], unit=a=>{ const l=Math.hypot(a[0],a[1])||1; return [a[0]/l,a[1]/l]; };
const arrow=(tip,dir,role)=>{ const n=[-dir[1],dir[0]], b=sub(tip,mul(dir,3)); return {t:'poly',z:1,p:[tip,add(b,mul(n,.7)),sub(b,mul(n,.7))],c:'arw',role}; };
function dim(p1,p2,off,text,role,o){ o=o||{}; const u=unit(sub(p2,p1)), n=[-u[1],u[0]], sg=Math.sign(off)||1, q1=add(p1,mul(n,off)), q2=add(p2,mul(n,off)), E=[];
  E.push(Ln(add(p1,mul(n,sg*.8)),add(q1,mul(n,sg*2)),'thin',role));
  if(o.half){ E.push(Ln(add(q1,mul(u,-6)),q2,'thin',role),arrow(q2,u,role)); }
  else { E.push(Ln(add(p2,mul(n,sg*.8)),add(q2,mul(n,sg*2)),'thin',role),Ln(q1,q2,'thin',role),arrow(q1,mul(u,-1),role),arrow(q2,u,role)); }
  const m=o.half?add(q2,mul(u,-8)):mul(add(q1,q2),.5), ang=Math.atan2(u[1],u[0])*180/Math.PI, up=ang>90||ang<-90?ang+180:ang;
  E.push(Tx(add(m,mul(n,sg*1.6)),text,role,{rot:Math.abs(up)<1e-6?0:up,size:o.size||4.6})); return E; }
/* линия сечения: разомкнутые штрихи на концах, стрелки направления взгляда, буквы */
function cutMark(a,b,look,L,role){ const u=unit(sub(b,a)), E=[Ln(sub(a,mul(u,2)),add(a,mul(u,5)),'thick',role),Ln(sub(b,mul(u,5)),add(b,mul(u,2)),'thick',role)];
  [a,b].forEach((p,i)=>{ const e=add(sub(p,mul(u,i?-2:2)),[0,0]), s=add(e,mul(look,-7)); E.push(Ln(s,e,'thin',role),arrow(e,look,role),Tx(add(s,mul(look,-3)),L,role)); }); return E; }
const wavy=(p,q,role)=>{ const u=unit(sub(q,p)), n=[-u[1],u[0]], L=Math.hypot(...sub(q,p)), m=Math.max(6,Math.round(L/3)), P=[];
  for(let i=0;i<=m;i++) P.push(add(add(p,mul(u,L*i/m)),mul(n,1.2*Math.sin(i*1.7)))); return {t:'poly',p:P,c:'wav',role}; };
const sceneB=(E,pad)=>{ const S=scene(E); if(pad){ S.box=[S.box[0]-pad,S.box[1]-pad,S.box[2]+2*pad,S.box[3]+2*pad]; } return S; };
/* тело без части вычитаемых элементов: filt(c) — оставить ли вычитаемый элемент */
const strip=(m,filt)=>({box:m.box,tree:m.tree.t==='s'?{t:'s',a:m.tree.a,k:m.tree.k.filter(filt)}:m.tree});
const kinds=m=>{ const s=new Set(); (function w(n){ if(!n) return; s.add(n.t); if(n.a) w(n.a); (n.k||[]).forEach(w); })(m.tree&&m.tree.a); return s; };
const pickDZ=(want,ds)=>{ for(let t=0;t<12;t++){ const d=pick(ds), V=DZM(d,d==='ig5'?N30.filter(n=>![17,21,29].includes(n)):N30); if(V&&want(kinds(V.m),V)) return V; } return null; };
/* прореживание кривых: из каждой ломаной — каждая k-я точка (строят «по двум-трём точкам») */
const coarse=(d,k)=>d.split('M').filter(Boolean).map(sp=>{ const P=sp.split('L'); if(P.length<9) return 'M'+sp; return 'M'+P.filter((q,i)=>i%k===0||i===P.length-1).join('L'); }).join('');
const P3=()=>G3().P;

/* ═════ Виды ═════ */
/* v1m — главный вид: даёт больше всего о форме */
function partRot(){ const P=P3(); const L=RI(70,90), D=RI(40,50), h=RI(10,16), H=RI(34,46), w=RI(22,30);
  /* та же деталь, повёрнутая на 90°: стойка спереди — на главном виде прямоугольник со штриховыми */
  return {box:[[-D/2,-L/2,0],[D/2,L/2,H]],tree:P.S(P.U(P.box(D,L,0,h),P.box(D,w,h,H,{y:-(L/2-w/2)})),P.cyl(RI(5,7),-1,h+1,{y:L/2-18}))}; }
reg('v1m',{make(){ return {m:partL(),r:partRot()}; },
  scene(V,k){ const m=k==='R'?V.r:V.m; return scene(viewEls(m,'front0',0,0,'F').concat(viewEls(m,'top',0,W,'T'),viewEls(m,'left0',W,0,'L'))); },
  traps:{R:{b0:0,say:'Главным выбрали вид, где форма читается хуже: деталь повёрнута — профиль ушёл на вид слева',src:'ГОСТ 2.305; тетрадь, с. 19',hl:['F','Fh','T','L','Lh']}},
  watch:{steps:st(['Ставим деталь так, чтобы главный вид показал её форму полнее всего: профиль стойки',['F','Fh']],['Остальные виды — в проекционной связи с главным',['F','Fh','T','Th','L','Lh']])}});
/* v1n — обозначение видов: вид не на месте — стрелка с буквой и буква над видом */
reg('v1n',{part:partL,make(){ return {m:partL(),L:pick(['А','Б','В'])}; },
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F').concat(viewEls(V.m,'top',W*1.15,W*.2,'T'));
    const f=proj(V.m,'front0',0,0), c=f([0,0,V.m.box[1][2]]);
    if(k!=='N'){ E.push(Ln([c[0],c[1]-14],[c[0],c[1]-3],'thin','lab'),{t:'poly',z:1,p:[[c[0],c[1]-2],[c[0]-.8,c[1]-5],[c[0]+.8,c[1]-5]],c:'arw',role:'lab'},Tx([c[0]+4,c[1]-10],V.L,'lab',{size:6}));
      const t=frame(E.filter(e=>e.role==='T'||e.role==='Th')); E.push(Tx([t[0]+t[2]/2,t[1]+1],V.L,'lab',{size:6})); }
    return sceneB(E,4); },
  traps:{N:{b0:-0.2,say:'Вид не в проекционной связи — без стрелки и буквы его не прочитать',src:'ГОСТ 2.305; тетрадь, рис. 31',hl:['T','Th']}},
  watch:{steps:st(['Главный вид',['F','Fh']],['Вид сверху стоит не под главным — у главного стрелка с буквой',['F','Fh','lab']],['Над видом — та же буква, шрифт 7',['F','Fh','lab','T','Th']])}});
/* v1d — дополнительный вид: наклонная грань в натуральную величину (отверстие в ней — эллипс, его считает IG3) */
const arrowTo=(tip,dir,L,role)=>{ const s=sub(tip,mul(dir,12)); return [Ln(s,sub(tip,mul(dir,1)),'thin',role),arrow(tip,dir,role),Tx(add(s,[dir[1]*4,-dir[0]*4-1]),L,role,{size:6})]; };
reg('v1d',{make(){ const P=P3(); const L=RI(70,86), D=RI(34,42), H=RI(40,50), h=RI(10,14), a=R(.55,.8), x0=-L/2+RI(16,24), r=RI(5,7);
    /* грань: от точки (x0, H) вниз под углом a к горизонтали до высоты h */
    const n=[Math.sin(a),0,Math.cos(a)], o=[x0,0,H]; const xh=x0+(H-h)/Math.tan(a)*1, xc=(x0+Math.min(xh,L/2))/2, zc=H-(xc-x0)*Math.tan(a);
    const m={box:[[-L/2,-D/2,0],[L/2,D/2,H]],tree:P.S(P.I(P.box(L,D,0,H),P.hp(n,o)),P.cyl(r,-1,H+1,{x:xc}))}; return {m,a,x0,xc,zc,L:pick(['А','Б','В']),H}; },
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F').concat(viewEls(V.m,'top',0,W,'T')), f=proj(V.m,'front0',0,0), sc=Math.abs(f([1,0,0])[0]-f([0,0,0])[0]);
    const U=[Math.cos(V.a),0,-Math.sin(V.a)], O=[V.x0+Math.sin(V.a)*.4,0,V.H-Math.cos(V.a)*.4], Ls=G3().secShape(V.m.tree,O,U,[0,1,0],[-120,120,-120,120],0.5).all;
    const ku=k==='P'?Math.cos(V.a):1, c0=[W*1.25,W*.25], d=Ls.map(l=>'M'+l.map(q=>(c0[0]+q[0]*ku*sc).toFixed(2)+' '+(c0[1]+q[1]*sc).toFixed(2)).join('L')+'Z').join('');
    E.push({t:'path',d,c:'o',role:'D'});
    if(k!=='N'){ const mid=f([V.xc,0,V.zc]), nn=unit([-Math.sin(V.a),-Math.cos(V.a)]); E.push(...arrowTo(mid,[-nn[0],-nn[1]],V.L,'lab'));
      const fr=frame([{t:'path',d}]); E.push(Tx([fr[0]+fr[2]/2,fr[1]-1],V.L,'lab',{size:6})); }
    return sceneB(E,4); },
  traps:{N:{b0:-0.2,say:'Дополнительный вид не в проекционной связи — его обозначают стрелкой и буквой',src:'ГОСТ 2.305; тетрадь, рис. 33',hl:['D']},
         P:{b0:.2,say:'На дополнительном виде грань должна быть в натуральную величину — а нарисована её искажённая проекция',src:'ГОСТ 2.305; тетрадь, рис. 32',hl:['D']}},
  watch:{steps:st(['Наклонная грань: на основных видах она искажена',['F','Fh','T','Th']],['Смотрим перпендикулярно грани — стрелка с буквой',['F','Fh','T','Th','lab']],['Дополнительный вид: грань и отверстие в натуральную величину',['F','Fh','T','Th','lab','D']])}});
/* v1l — местный вид: только нужный участок */
reg('v1l',{make(){ const P=P3(); const L=RI(70,86), D=RI(36,44), h=RI(12,16), H=RI(36,46), rb=RI(9,12), rh=RI(4,rb-4), ex=RI(8,12), zc=RI(h+rb+2,H-rb-2);
    const m={box:[[-L/2,-D/2,0],[L/2+ex,D/2,H]],tree:P.S(P.U(P.box(L,D,0,h),P.box(L*.4,D,h,H,{x:L*.3}),P.hcyl('x',rb,[0,zc],L/2-1,L/2+ex)),P.hcyl('x',rh,[0,zc],L/2-8,L/2+ex+1))};
    return {m,rb,rh,zc,Lx:L/2+ex,L:pick(['А','Б','В'])}; },
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F').concat(viewEls(V.m,'top',0,W,'T')), f=proj(V.m,'front0',0,0), sc=Math.abs(f([1,0,0])[0]-f([0,0,0])[0]);
    if(k==='F') E.push(...viewEls(V.m,'left0',W*1.05,W*.95,'D'));
    else { const c=[W*1.35,W*1.3]; E.push({t:'circ',a:[c[0],c[1],V.rb*sc],c:'o',role:'D'},{t:'circ',a:[c[0],c[1],V.rh*sc],c:'o',role:'D'},
      Ln([c[0]-V.rb*sc-3,c[1]],[c[0]+V.rb*sc+3,c[1]],'cl','D'),Ln([c[0],c[1]-V.rb*sc-3],[c[0],c[1]+V.rb*sc+3],'cl','D')); }
    if(k!=='N'){ const tip=f([V.Lx,0,V.zc]); E.push(...arrowTo(add(tip,[1,0]),[-1,0],V.L,'lab'));
      const fr=frame(E.filter(e=>e.role==='D'&&e.t!=='circ').concat(E.filter(e=>e.role==='D'&&e.t==='circ').map(e=>({t:'path',d:`M${e.a[0]-e.a[2]} ${e.a[1]-e.a[2]}L${e.a[0]+e.a[2]} ${e.a[1]+e.a[2]}`}))));
      E.push(Tx([fr[0]+fr[2]/2,fr[1]+2],V.L,'lab',{size:6})); }
    return sceneB(E,4); },
  traps:{N:{b0:-0.2,say:'Местный вид не на своём месте — нужны стрелка и буква',src:'ГОСТ 2.305; тетрадь, рис. 34',hl:['D']},
         F:{b0:0,say:'Ради одного элемента нарисовали весь вид — достаточно местного',src:'ГОСТ 2.305; тетрадь, рис. 34',hl:['D','Dh']}},
  watch:{steps:st(['Бобышка сбоку: на основных видах её форма не видна',['F','Fh','T','Th']],['Смотрим на неё по стрелке с буквой',['F','Fh','T','Th','lab']],['Местный вид — только бобышка',['F','Fh','T','Th','lab','D']])}});
/* v3 — база глубины: постоянная прямая под 45° */
reg('v3',{part:partL,
  scene(V,k){ const sx=k==='S'?.62:1, E=viewEls(V.m,'front0',0,0,'F').concat(viewEls(V.m,'top',0,W,'T'));
    const L=viewEls(V.m,'left0',W,0,'L'); if(sx!==1) L.forEach(e=>{ e.d=e.d.replace(num,(m,x,y)=>`${W+(+x-W-W/2)*sx+W/2} ${y}`); }); E.push(...L);
    const t=proj(V.m,'top',0,W), l=proj(V.m,'left0',W,0), b=V.m.box, lx=p=>W+(l(p)[0]-W-W/2)*sx+W/2;
    const pts=[b[0][1],b[1][1]].map(y=>{ const p=[b[1][0],y,0], T=t(p), Lp=[lx(p),l(p)[1]]; return {T,Lp,K:[Lp[0],T[1]]}; });
    pts.forEach(q=>E.push(Ln(q.T,q.K,'lk','k'),Ln(q.K,q.Lp,'lk','k')));
    E.push(Ln(sub(pts[0].K,mul(unit(sub(pts[1].K,pts[0].K)),8)),add(pts[1].K,mul(unit(sub(pts[1].K,pts[0].K)),8)),'a','k45'));
    return scene(E); },
  traps:{S:{b0:0,say:'Постоянная прямая не под 45° — глубина на виде слева искажена',src:'тетрадь, рис. 54',hl:['k45','L','Lh']}},
  watch:{steps:st(['Главный вид и вид сверху',['F','Fh','T','Th']],['Постоянная прямая под 45°: глубину с вида сверху переносим на вид слева',['F','Fh','T','Th','k','k45']],['Вид слева — высоты с главного, глубина — по линиям через постоянную прямую',['F','Fh','T','Th','k','k45','L','Lh']])}});
/* v4 — чтение детали: отверстие или бобышка */
reg('v4',{make(){ const P=P3(); const L=RI(70,90), D=RI(40,50), h=RI(12,16), r=RI(6,9), x=RI(-L/2+15,L/2-15);
    const base=P.box(L,D,0,h); return {m:{box:[[-L/2,-D/2,0],[L/2,D/2,h]],tree:P.S(base,P.cyl(r,-1,h+1,{x}))},b:{box:[[-L/2,-D/2,0],[L/2,D/2,h+12]],tree:P.U(base,P.cyl(r,h,h+12,{x}))}}; },
  scene(V,k){ return scene(viewEls(k==='B'?V.b:V.m,'front0',0,0,'F').concat(viewEls(V.m,'top',0,W,'T'),viewEls(V.m,'left0',W,0,'L'))); },
  traps:{B:{b0:-0.2,say:'Окружность на виде сверху — это отверстие (на виде слева — штриховые), а на главном нарисовали бобышку',src:'тетрадь, рис. 54',hl:['F','Fh']}},
  watch:{steps:st(['Вид сверху: окружность — отверстие или бобышка?',['T','Th']],['Вид слева: штриховые сквозь всю толщину — значит, отверстие',['T','Th','L','Lh']],['Главный вид: отверстие — штриховыми',['T','Th','L','Lh','F','Fh']])}});
/* v7 — оси и центровые */
reg('v7',{part:partSym,
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F').concat(viewEls(V.m,'top',0,W,'T')), b=V.m.box, f=proj(V.m,'front0',0,0), t=proj(V.m,'top',0,W);
    E.push(Ln(f([0,0,-3]),f([0,0,b[1][2]+3]),'cl','af'));
    const R0=b[1][0]+3; E.push(Ln(t([-R0,0,0]),t([R0,0,0]),'cl','at'),Ln(t([0,-R0,0]),t([0,R0,0]),'cl','at'));
    if(k!=='N'){ const Rc=V.m._rc; (V.m._h||[]).forEach(c=>{ const e=4; E.push(Ln(t([c[0]-e,c[1],0]),t([c[0]+e,c[1],0]),'cl','ah'),Ln(t([c[0],c[1]-e,0]),t([c[0],c[1]+e,0]),'cl','ah')); }); }
    return scene(E); },
  make(){ const m=partSym(); const hs=[]; (function w(n){ if(!n) return; if(n.t==='cyl'&&(n.x||n.y)) hs.push([n.x,n.y]); if(n.a) w(n.a); (n.k||[]).forEach(w); })(m.tree); m._h=hs; return {m}; },
  traps:{N:{b0:-0.2,say:'Забыли центровые линии отверстий на виде сверху',src:'ГОСТ 2.303',hl:['ah','T']}},
  watch:{steps:st(['Деталь',['F','Fh','T','Th']],['Ось тела вращения — на всех видах',['F','Fh','T','Th','af','at']],['Центровые — у каждого отверстия',['F','Fh','T','Th','af','at','ah']])}});
/* v8 — точка на конусе через параллель; v9 — точка на цилиндре: уже на окружности */
function ptScene(V,k,cone){ const m=V.m, b=m.box, H=b[1][2], r=b[1][0], z=V.z*H, rz=cone?r*(1-z/H):r, a=V.a, p=[rz*Math.cos(a),rz*Math.sin(a),z];
  const f=proj(m,'front0',0,0), t=proj(m,'top',0,W), l=proj(m,'left0',W,0);
  const E=viewEls(m,'front0',0,0,'F').concat(viewEls(m,'top',0,W,'T'),viewEls(m,'left0',W,0,'L'));
  const pt=(q,role,lab)=>({t:'pt',a:q,c:'ans',role,lab});
  const c0=t([0,0,0]), rr=Math.hypot(...sub(t([rz,0,0]),c0));
  if(cone) E.push({t:'circ',a:[c0[0],c0[1],rr],c:'a',role:'par',dash:true},Ln(f([-rz,0,z]),f([rz,0,z]),'a','par'));
  const pT=k==='P'?t([rz*.55*Math.cos(a),rz*.55*Math.sin(a),z]):k==='H'?t([r*Math.cos(a),r*Math.sin(a),z]):t(p), pL=k==='D'?l([p[0],-p[1],p[2]]):l(p);
  E.push(pt(f(p),'pF',"A″"),pt(pT,'pT',"A′"),pt(pL,'pL',"A‴"),Ln(f(p),pT,'lk','lk'),Ln(f(p),pL,'lk','lk'));
  return scene(E); }
reg('v8',{make(){ return {m:partBody('cone'),z:R(.25,.6),a:R(.3,1.2)*pick([1,-1])}; },
  scene(V,k){ return ptScene(V,k,1); },
  traps:{H:{b0:0,say:'Параллель взяли не на уровне точки — точка ушла с поверхности',src:'методика ДЗ 4; тетрадь, гл. 3',hl:['pT','pL']},D:{b0:.2,say:'Глубину перенесли не в ту сторону: перед на виде слева — справа',src:'тетрадь, рис. 54',hl:['pL']}},
  watch:{steps:st(['Конус и точка на главном виде',['F','Fh','T','Th','L','Lh','pF']],['Через точку — параллель: на виде сверху окружность радиуса параллели',['F','Fh','T','Th','L','Lh','pF','par']],['Вторая проекция — на параллели по линии связи; третья — по высоте и глубине',['F','Fh','T','Th','L','Lh','pF','par','pT','pL','lk']])}});
reg('v9',{make(){ return {m:partBody('cyl'),z:R(.3,.7),a:R(.3,1.2)*pick([1,-1])}; },
  scene(V,k){ return ptScene(V,k,0); },
  traps:{P:{b0:-0.2,say:'Точка цилиндра на виде сверху — на окружности: боковая поверхность проецируется в неё',src:'методика ДЗ 2–5',hl:['pT','pL']}},
  watch:{steps:st(['Цилиндр и точка на главном виде',['F','Fh','T','Th','L','Lh','pF']],['Вид сверху: боковая поверхность — окружность, точка уже на ней',['F','Fh','T','Th','L','Lh','pF','pT','lk']],['Вид слева — высота с главного, глубина с вида сверху',['F','Fh','T','Th','L','Lh','pF','pT','pL','lk']])}});
/* v10 — соосные тела: стык ступеней — окружность (на виде — прямая) */
reg('v10',{make(){ const P=P3(); const r1=RI(26,32), r2=RI(14,r1-6), h1=RI(14,20), h2=RI(36,48);
    return {m:{box:[[-r1,-r1,0],[r1,r1,h2]],tree:P.U(P.cyl(r1,0,h1),P.cyl(r2,h1,h2))},o:{box:[[-r1,-r1,0],[r1,r1,h2]],tree:P.cyl(r1,0,h1)},r2}; },
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F').concat(viewEls(k==='M'?V.o:V.m,'top',0,W,'T'),viewEls(V.m,'left0',W,0,'L')); return scene(E); },
  traps:{M:{b0:-0.2,say:'Пропустили вторую ступень на виде сверху — у соосных цилиндров там две окружности',src:'тетрадь, гл. 3',hl:['T','Th']}},
  watch:{steps:st(['Две соосные ступени: стык — окружность, на главном виде — прямая',['F','Fh']],['Сверху — две концентрические окружности',['F','Fh','T','Th']],['Слева — как главный',['F','Fh','T','Th','L','Lh']])}});
/* v11 — отверстие в цилиндре: линия пересечения на виде слева */
reg('v11',{make(){ const P=P3(); const R1=RI(22,28), H=RI(50,64), r=RI(6,Math.min(11,R1-8)), zc=RI(H*.4,H*.6);
    const body=P.cyl(R1,0,H); return {m:{box:[[-R1,-R1,0],[R1,R1,H]],tree:P.S(body,P.hcyl('y',r,[0,zc],-R1-2,R1+2))},b:{box:[[-R1,-R1,0],[R1,R1,H]],tree:P.S(body,P.box(2*r,2*R1+4,zc-r,zc+r))}}; },
  scene(V,k){ return scene(viewEls(V.m,'front0',0,0,'F').concat(viewEls(V.m,'top',0,W,'T'),viewEls(k==='S'?V.b:V.m,'left0',W,0,'L'))); },
  fair(V,k,ok,bad){ return differs(ok,bad,['L','Lh']); },
  traps:{S:{b0:.1,say:'Линию пересечения отверстия с цилиндром провели прямой — она кривая, строится по точкам',src:'методика ДЗ 3',hl:['L','Lh']}},
  watch:{steps:st(['Главный вид: отверстие — окружность (вдоль оси отверстия)',['F','Fh']],['Сверху: всё уже лежит на окружности цилиндра',['F','Fh','T','Th']],['Слева: линия пересечения — кривая, по точкам',['F','Fh','T','Th','L','Lh']])}});

/* ═════ Разрезы ═════ */
reg('r1k',{part:partL,
  scene(V,k){ const E=viewEls(V.m,'frontF',0,0,'F').concat(viewEls(V.m,'top',0,W,'T')), t=proj(V.m,'top',0,W), b=V.m.box;
    const [a,c]=k==='P'?[t([0,b[0][1]-4,0]),t([0,b[1][1]+4,0])]:[t([b[0][0]-4,0,0]),t([b[1][0]+4,0,0])];
    E.push(...cutMark(a,c,k==='P'?[-1,0]:[0,-1],'А','cut')); return sceneB(E,8); },
  traps:{P:{b0:0,say:'Плоскость профильная, а построен фронтальный разрез: фронтальный — плоскость ∥ фронтальной',src:'тетрадь, с. 20–21',hl:['cut']}},
  watch:{steps:st(['Вид сверху',['T','Th']],['Секущая плоскость ∥ фронтальной плоскости проекций',['T','Th','cut']],['Значит, разрез фронтальный — на месте главного вида',['T','Th','cut','F','Fh','Fhat']])}});
reg('r2n',{part:partSym,
  scene(V,k){ return scene(viewEls(V.m,'frontF',0,0,'F',{hat:'net'}).concat(viewEls(V.m,'leftF',W,0,'L',{hat:k==='M'?'hat':'net'}))); },
  traps:{M:{b0:-0.2,say:'Деталь из пластмассы: штриховка — сетка на всех разрезах',src:'ГОСТ 2.306; тетрадь, рис. 52',hl:['Lhat']}},
  watch:{steps:st(['Неметалл — сетка',['F','Fh','Fhat']],['На всех разрезах одного предмета — одна и та же',['F','Fh','Fhat','L','Lh','Lhat']])}});
reg('r3',{make(){ const P=P3(); const L=RI(70,90), D=RI(40,50), h=RI(14,18), y0=RI(6,12), r=RI(4,6);
    return {m:{box:[[-L/2,-D/2,0],[L/2,D/2,h]],tree:P.S(P.box(L,D,0,h),P.cyl(r,-1,h+1,{x:-L/4,y:y0}),P.cyl(r,-1,h+1,{x:L/4,y:y0}))},y0,L:pick(['А','Б'])}; },
  scene(V,k){ const d=G3().drawing(V.m,'frontF',W*3,V.y0); const k3=1/3, L=d.lines.map(s=>({a:[s.a[0]*k3,s.a[1]*k3],b:[s.b[0]*k3,s.b[1]*k3],h:s.h})), ph=G3().paths(L);
    const E=[], m=/<path d="([^"]*)" fill="url\(#h\)"/.exec(d.svg); if(m) E.push({t:'path',d:m[1].replace(num,(q,x,y)=>`${+x*k3} ${+y*k3}`),c:'hat',role:'Fhat'}); if(ph.v) E.push({t:'path',d:ph.v,c:'o',role:'F'});
    E.push(...viewEls(V.m,'top',0,W,'T'));
    if(k!=='N'){ const t=proj(V.m,'top',0,W), b=V.m.box; E.push(...cutMark(t([b[0][0]-4,V.y0,0]),t([b[1][0]+4,V.y0,0]),[0,-1],V.L,'lab')); const f=frame(E.filter(e=>e.role==='F')); E.push(Tx([f[0]+f[2]/2,f[1]-1],V.L+'–'+V.L,'lab',{size:6})); }
    return sceneB(E,8); },
  traps:{N:{b0:-0.2,say:'Плоскость не совпадает с плоскостью симметрии — разрез обозначают: линия сечения, стрелки, «А–А»',src:'ГОСТ 2.305; тетрадь, рис. 35',hl:['F','Fhat']}},
  watch:{steps:st(['Отверстия не на оси симметрии — плоскость проходит через них',['T','Th']],['Линия сечения: разомкнутые штрихи, стрелки взгляда, буквы',['T','Th','lab']],['Разрез с надписью «А–А»',['T','Th','lab','F','Fhat']])}});
/* r4a, r7m — граница вида и разреза — волнистая; r5 — ребро на оси */
function partView(V,k,o){ const d=G3().drawing(V.m,'front',W*3,0,V.bnd); const k3=1/3, L=d.lines.map(s=>({a:[s.a[0]*k3,s.a[1]*k3],b:[s.b[0]*k3,s.b[1]*k3],h:s.h})), ph=G3().paths(L);
  const E=[], m=/<path d="([^"]*)" fill="url\(#h\)"/.exec(d.svg); if(m) E.push({t:'path',d:m[1].replace(num,(q,x,y)=>`${+x*k3} ${+y*k3}`),c:'hat',role:'Fhat'}); if(ph.v) E.push({t:'path',d:ph.v,c:'o',role:'F'});
  const f=proj(V.m,'front',0,0), b=V.m.box, p=f([V.bnd,0,b[0][2]]), q=f([V.bnd,0,b[1][2]]);
  E.push(k==='S'?Ln(p,q,'thick','bd'):wavy(p,q,'bd')); return E; }
reg('r4a',{make(){ return {m:partL(),bnd:0}; },
  scene(V,k){ const E=partView(V,k).concat(viewEls(V.m,'top',0,W,'T')); return scene(E); },
  make2:null,
  traps:{S:{b0:-0.2,say:'Границу вида и разреза провели основной линией — нужна волнистая (или тонкая с изломом)',src:'ГОСТ 2.305; тетрадь, рис. 42',hl:['bd']}},
  watch:{steps:st(['Деталь несимметрична — часть вида, часть разреза',['T','Th']],['Разрез — там, где внутреннее устройство',['T','Th','F','Fhat']],['Граница — волнистая линия',['T','Th','F','Fhat','bd']])}});
reg('r7m',{make(){ return {m:partL(),bnd:RI(6,14)}; },
  scene(V,k){ const E=partView(V,null).concat(viewEls(V.m,'top',0,W,'T')); if(k==='L'){ const f=frame(E.filter(e=>e.role==='F')); E.push(Tx([f[0]+f[2]/2,f[1]-1],'А–А','lab',{size:6})); } return sceneB(E,4); },
  traps:{L:{b0:-0.2,say:'Местный разрез не обозначают буквами',src:'ГОСТ 2.305; тетрадь, рис. 41',hl:['lab']}},
  watch:{steps:st(['Нужно показать устройство в одном месте',['T','Th']],['Местный разрез — граница волнистая',['T','Th','F','Fhat','bd']])}});
reg('r5',{make(){ const P=P3(); const s=RI(50,64), H=RI(40,54), r=RI(10,15); const m={box:[[-s/2,-s/2,0],[s/2,s/2,H]],tree:P.S(P.ngon(4,s,0,H,{a:45}),P.cyl(r,-1,H+1))}; return {m,bnd:0,sh:RI(5,8)}; },
  scene(V,k){ const U=Object.assign({},V,{bnd:k==='A'?0:V.sh}); const E=partView(U,k==='A'?'S':null).concat(viewEls(V.m,'top',0,W,'T')); return scene(E); },
  traps:{A:{b0:0,say:'На оси симметрии ребро — границу по оси нельзя: ведут волнистой, сохраняя ребро',src:'ГОСТ 2.305; тетрадь, рис. 44',hl:['bd','F','Fhat']}},
  watch:{steps:st(['На оси симметрии — ребро',['T','Th']],['Граница вида и разреза — волнистой, сдвинутой так, чтобы ребро было видно',['T','Th','F','Fhat','bd']])}});
/* r6 — ребро жёсткости в продольном разрезе не штрихуют */
reg('r6',{make(){ const P=P3(); const L=RI(80,96), D=RI(40,48), h=RI(10,14), rb=RI(13,17), H=RI(40,50), t=RI(5,7);
    const rib=Object.assign(P.box(L/2-rb-4+2,t,h,h+H*.6,{x:(L/2-rb-4)/2+rb-1}),{rib:1});
    const m={box:[[-L/2,-D/2,0],[L/2,D/2,H]],tree:P.S(P.U(P.box(L,D,0,h),P.cyl(rb,h,H,{x:0}),rib),P.cyl(RI(6,rb-5),-1,H+1))}; return {m,rib:[rb-1,(L/2-rb-4)+rb,h,h+H*.6],H}; },
  scene(V,k){ const E=viewEls(V.m,'frontF',0,0,'F').concat(viewEls(V.m,'top',0,W,'T')), f=proj(V.m,'frontF',0,0), [x0,x1,z0,z1]=V.rib;
    const c=[f([x0,0,z0]),f([x1,0,z0]),f([x1,0,z1]),f([x0,0,z1])], d=`M${c.map(p=>p[0].toFixed(2)+' '+p[1].toFixed(2)).join('L')}Z`;
    if(k==='H') E.push({t:'path',d,c:'hat',role:'rh'}); E.push({t:'path',d,c:'o',role:'rb'});
    return scene(E); },
  traps:{H:{b0:-0.1,say:'Ребро, рассечённое вдоль, заштриховали — его показывают незаштрихованным',src:'ГОСТ 2.305; тетрадь, рис. 45',hl:['rh']}},
  watch:{steps:st(['Деталь с ребром жёсткости',['T','Th']],['Плоскость идёт вдоль ребра — ребро не штрихуют, его контур — сплошной',['T','Th','F','Fh','Fhat']])}});
reg('r6f',{make(){ const m=partSym(); return {m,o:strip(m,c=>!(c.t==='cyl'&&(c.x||c.y)))}; },
  scene(V,k){ return scene(viewEls(k==='N'?V.o:V.m,'frontF',0,0,'F').concat(viewEls(V.m,'top',0,W,'T'))); },
  fair(V,k,ok,bad){ return differs(ok,bad,['F','Fhat']); },
  traps:{N:{b0:0,say:'Отверстия фланца не попали в плоскость — но в разрезе их показывают, как будто попали',src:'ГОСТ 2.305; тетрадь, рис. 46',hl:['F','Fhat']}},
  watch:{steps:st(['Отверстия фланца не на линии разреза',['T','Th']],['В разрезе их показывают повёрнутыми в плоскость — на том же радиусе',['T','Th','F','Fh','Fhat']])}});
/* r7 — ступенчатый разрез через все отверстия */
reg('r7',{make(){ const P=P3(); const L=RI(80,96), D=RI(44,54), h=RI(14,18), y1=RI(-D/2+10,-6), y2=RI(6,D/2-10), x1=-L/4, x2=L/4, r=RI(4,6);
    const m={box:[[-L/2,-D/2,0],[L/2,D/2,h]],tree:P.S(P.box(L,D,0,h),P.cyl(r,-1,h+1,{x:x1,y:y1}),P.cyl(r+2,-1,h+1,{x:x2,y:y2})),step:[[-1e4,0,y1],[0,1e4,y2]]}; return {m,y1,y2,x1,x2}; },
  scene(V,k){ const E=viewEls(V.m,k==='S'?'frontF':'frontS',0,0,'F').concat(viewEls(V.m,'top',0,W,'T')), t=proj(V.m,'top',0,W), b=V.m.box;
    E.push(Ln(t([b[0][0]-3,V.y1,0]),t([0,V.y1,0]),'thick','cut'),Ln(t([0,V.y1,0]),t([0,V.y2,0]),'thick','cut'),Ln(t([0,V.y2,0]),t([b[1][0]+3,V.y2,0]),'thick','cut'));
    return scene(E); },
  fair(V,k,ok,bad){ return differs(ok,bad,['F','Fhat']); },
  traps:{S:{b0:-0.2,say:'Простой разрез прошёл мимо части отверстий — нужен ступенчатый',src:'ГОСТ 2.305; тетрадь, рис. 39',hl:['F','Fhat']}},
  watch:{steps:st(['Отверстия на разных расстояниях от оси',['T','Th']],['Секущие плоскости — параллельные, через каждое отверстие',['T','Th','cut']],['Разрез — как одна плоскость, переходы не показывают',['T','Th','cut','F','Fh','Fhat']])}});
/* r7l — ломаный разрез: наклонную часть поворачивают до совмещения */
reg('r7l',{make(){ const P=P3(); const Rf=RI(36,44), h=RI(12,16), rb=RI(10,13), Rc=RI(Rf-11,Rf-7), a=R(.95,1.2), r=RI(4,5);
    const base=P.S(P.cyl(Rf,0,h),P.cyl(rb,-1,h+1));
    return {m:{box:[[-Rf,-Rf,0],[Rf,Rf,h]],tree:P.S(base,P.cyl(r,-1,h+1,{x:Rc}))},w:{box:[[-Rf,-Rf,0],[Rf,Rf,h]],tree:P.S(base,P.cyl(r,-1,h+1,{x:Rc*Math.cos(a)}))},Rc,a,r}; },
  scene(V,k){ const E=viewEls(k==='P'?V.w:V.m,'frontF',0,0,'F'), tm={box:V.m.box,tree:(()=>{ const P=P3(); return P.S(V.m.tree.a,P.cyl(V.r,-1,30,{x:V.Rc*Math.cos(V.a),y:V.Rc*Math.sin(V.a)})); })()};
    E.push(...viewEls(tm,'top',0,W,'T')); const t=proj(tm,'top',0,W);
    E.push(Ln(t([-V.m.box[1][0]-3,0,0]),t([0,0,0]),'thick','cut'),Ln(t([0,0,0]),t([(V.m.box[1][0]+3)*Math.cos(V.a),(V.m.box[1][0]+3)*Math.sin(V.a),0]),'thick','cut'));
    return scene(E); },
  fair(V,k,ok,bad){ return differs(ok,bad,['F','Fhat']); },
  traps:{P:{b0:.1,say:'Наклонную часть показали в проекции — отверстие ближе к оси, чем на самом деле; её поворачивают в плоскость',src:'ГОСТ 2.305; тетрадь, рис. 40',hl:['F','Fhat']}},
  watch:{steps:st(['Вид сверху: секущие плоскости пересекаются',['T','Th']],['Наклонную плоскость поворачивают до совмещения с фронтальной',['T','Th','cut']],['Отверстие — на своём радиусе',['T','Th','cut','F','Fh','Fhat']])}});
/* r8 — полое тело: полость не штрихуют */
reg('r8',{make(){ const V=DZM('ig6',N30); if(!V) return null; if(!V.m._pnc) Object.defineProperty(V.m,'_pnc',{value:strip(V.m,c=>c.t!=='sph')}); V.s=V.m._pnc; return V; },
  scene(V,k){ const E=viewEls(V.m,'frontF',0,0,'F',{hat:false}); const H=viewEls(k==='H'?V.s:V.m,'frontF',0,0,'X').filter(e=>e.role==='Xhat'); H.forEach(e=>e.role='Fhat'); return scene(H.concat(E,viewEls(V.m,'top',0,W,'T'))); },
  fair(V,k,ok,bad){ return differs(ok,bad,['Fhat']); },
  traps:{H:{b0:-0.3,say:'Заштриховали полость — штрихуют только материал',src:'ГОСТ 2.306',hl:['Fhat']}},
  watch:{steps:st(['Полый шар с отверстием',['T','Th']],['Разрез: стенки штрихуются, полость и отверстия — нет',['T','Th','F','Fh','Fhat']])}});
/* r9 — какие разрезы нужны: сквозной вырез ⟂ π₂ на главном виде и так виден */
reg('r9',{make(){ return pickDZ(()=>true,['ig4']); },
  scene(V,k){ return scene(viewEls(V.m,k==='X'?'frontF':'front0',0,0,'F',{hat:k==='X'?'hat':false}).concat(viewEls(V.m,'top',0,W,'T',{hat:false}),viewEls(V.m,'left',W,0,'L'))); },
  traps:{X:{b0:0,say:'Лишний фронтальный разрез: сквозной вырез на главном виде и так виден целиком',src:'ГОСТ 2.305; методика ДЗ 4',hl:['F','Fhat']}},
  watch:{steps:st(['Вырез сквозной и ⟂ фронтальной плоскости — на главном виде он виден',['F','Fh']],['Разрез нужен там, где он показывает новое: на виде слева',['F','Fh','T','Th','L','Lh','Lhat']])}});

/* ═════ Сечения ═════ */
function secLoops(m,O,U,Vv){ const b=m.box, e=Math.max(...[0,1,2].map(i=>Math.max(Math.abs(b[0][i]),Math.abs(b[1][i]))))*1.8+4, bx=[-e,e,-e,e]; return G3().secShape(m.tree,O,U,Vv,bx,0.6).all; }
function loopsPath(L,map){ return L.map(l=>'M'+l.map(q=>{ const p=map(q); return p[0].toFixed(2)+' '+p[1].toFixed(2); }).join('L')+'Z').join(''); }
reg('c1v',{make(){ return {m:partBack(),L:pick(['А','Б'])}; },
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F',{hat:false}).concat(viewEls(V.m,'top',0,W,'T')), f=proj(V.m,'front0',0,0), b=V.m.box;
    const sc=Math.abs(f([1,0,0])[0]-f([0,0,0])[0]), L=secLoops(V.m,[0,0,0],[1,0,0],[0,0,1]), c0=[W*1.2,f([0,0,0])[1]];
    const d=loopsPath(L,q=>[c0[0]+q[0]*sc,c0[1]-q[1]*sc]); E.push({t:'path',d,c:'hat',role:'S'},{t:'path',d,c:k==='T'?'thin':'o',role:'Sc'});
    return scene(E); },
  traps:{T:{b0:0,say:'Контур вынесенного сечения — сплошной основной линией, а не тонкой',src:'ГОСТ 2.305; тетрадь, рис. 47',hl:['Sc']}},
  watch:{steps:st(['Деталь',['F','Fh','T','Th']],['Вынесенное сечение — рядом с видом, только фигура в плоскости',['F','Fh','T','Th','S']],['Контур — основной линией',['F','Fh','T','Th','S','Sc']])}});
reg('c1n',{make(){ return {m:partBack()}; },
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F',{hat:false}), f=proj(V.m,'front0',0,0), b=V.m.box, x=b[1][0]*.4;
    const sc=Math.abs(f([1,0,0])[0]-f([0,0,0])[0]), L=secLoops(V.m,[x,0,0],[0,1,0],[0,0,1]);
    const d=loopsPath(L,q=>{ const p=f([x,0,q[1]]); return [p[0]+q[0]*sc,p[1]]; }); E.push({t:'path',d,c:'hat',role:'S'},{t:'path',d,c:k==='T'?'o':'thin',role:'Sc'});
    E.push(Ln(f([x,0,b[0][2]-4]),f([x,0,b[1][2]+4]),'cl','ax'));
    return scene(E); },
  traps:{T:{b0:-0.1,say:'Контур наложенного сечения — тонкой линией, не основной',src:'ГОСТ 2.305; тетрадь, рис. 48',hl:['Sc']}},
  watch:{steps:st(['Главный вид',['F','Fh']],['Наложенное сечение — прямо на изображении, повёрнутое в плоскость чертежа',['F','Fh','S','ax']],['Контур — тонкий, контур детали под ним не прерывают',['F','Fh','S','ax','Sc']])}});
reg('c1s',{make(){ return {m:partBack()}; },
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F',{hat:false}).concat(viewEls(V.m,'top',0,W,'T')); const S=viewEls(V.m,'frontF',W,0,'S');
    if(k==='S'){ const h=S.find(e=>e.role==='Shat'); return scene(E.concat(h?[h,{t:'path',d:h.d,c:'o',role:'S'}]:[])); } return scene(E.concat(S)); },
  traps:{S:{b0:.1,say:'Сечение распалось на отдельные части — в таком случае делают разрез',src:'ГОСТ 2.305; тетрадь, рис. 50',hl:['S','Shat']}},
  watch:{steps:st(['Плоскость проходит через отверстие — фигура сечения распадается',['F','Fh','T','Th']],['Поэтому выполняют разрез: с тем, что за плоскостью',['F','Fh','T','Th','S','Sh','Shat']])}});
/* c2, c3, c4 — наклонное сечение: натуральный вид */
function inclined(V,k,o){ const m=V.m, f=proj(m,'front0',0,0), a=V.a, U=[Math.cos(a),0,Math.sin(a)], Vv=[0,1,0], O=[0,0,V.zc];
  const L=secLoops(m,O,U,Vv), sc=Math.abs(f([1,0,0])[0]-f([0,0,0])[0]), E=viewEls(m,'front0',0,0,'F',{hat:false}).concat(viewEls(m,'top',0,W,'T'));
  const ku=k==='P'?Math.cos(a):1, kv=k==='V'?.78:1, c0=[W*1.25,W*.45], rot=k==='Rn'||o&&o.rot;
  const d=loopsPath(L,q=>rot?[c0[0]+q[1]*kv*sc,c0[1]-q[0]*ku*sc]:[c0[0]+q[0]*ku*sc,c0[1]+q[1]*kv*sc]); E.push({t:'path',d,c:'hat',role:'S'},{t:'path',d,c:'o',role:'S'});
  const tr=[f(add3(O,mul3(U,-70))),f(add3(O,mul3(U,70)))]; E.push(Ln(tr[0],tr[1],'a','tr'));
  if(o&&o.rot&&k!=='N'){ const fr=frame([{t:'path',d}]); E.push(Tx([fr[0]+fr[2]/2,fr[1]-1],'А–А ⟲','lab',{size:6})); }
  return scene(E); }
const add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], mul3=(a,k)=>a.map(v=>v*k);
reg('c2',{make(){ return {m:partSym(),a:R(.45,.75),zc:RI(14,24)}; },
  scene(V,k){ return inclined(V,k); },
  fair(V,k,ok,bad){ return differs(ok,bad,['S']); },
  traps:{P:{b0:0,say:'Длины по следу взяли с проекции — укорочены; натуральная длина — вдоль следа',src:'тетрадь, рис. 51',hl:['S']}},
  watch:{steps:st(['Деталь и след наклонной плоскости на главном виде',['F','Fh','T','Th','tr']],['Новая ось вдоль следа: длины — по следу, ширины — с вида сверху',['F','Fh','T','Th','tr','S']])}});
reg('c3',{make(){ return {m:partBody('cyl'),a:R(.4,.7),zc:RI(18,30)}; },
  scene(V,k){ return inclined(V,k); },
  fair(V,k,ok,bad){ return differs(ok,bad,['S']); },
  traps:{V:{b0:0,say:'Малая ось эллипса — это диаметр цилиндра, а её сделали меньше',src:'методика ДЗ 2',hl:['S']}},
  watch:{steps:st(['Цилиндр и наклонная плоскость',['F','Fh','T','Th','tr']],['Сечение — эллипс: большая ось по следу, малая равна диаметру',['F','Fh','T','Th','tr','S']])}});
reg('c4',{make(){ return {m:partSym(),a:R(.45,.75),zc:RI(14,24)}; },
  scene(V,k){ return inclined(V,k,{rot:1}); },
  traps:{N:{b0:-0.2,say:'Сечение повернули, а знак «повёрнуто» не поставили',src:'ГОСТ 2.305',hl:['S']}},
  watch:{steps:st(['Наклонное сечение',['F','Fh','T','Th','tr']],['Его можно повернуть — тогда к надписи добавляют знак «повёрнуто»',['F','Fh','T','Th','tr','S','lab']])}});

/* ═════ Тело с вырезом: детали ДЗ 4–6 ═════ */
const cutScene=(V,o)=>{ o=o||{}; const L=viewEls(o.Lm||V.m,'left0',W,0,'L',{hat:false,solidHid:o.solid}); if(o.coarse) L.forEach(e=>{ if(e.t==='path') e.d=coarse(e.d,o.coarse); });
  const T=viewEls(o.Tm||V.m,'top',0,W,'T',{hat:false}); if(o.coarseT) T.forEach(e=>{ if(e.t==='path') e.d=coarse(e.d,o.coarseT); });
  const E=viewEls(V.m,'front0',0,0,'F',{hat:false}).concat(T,L); if(o.extra) E.push(...o.extra); return scene(E); };
const cutSteps=[{cap:'Дано: главный вид с вырезом K',roles:['F','Fh']},{cap:'Вид сверху: точки выреза — по принадлежности поверхности',roles:['F','Fh','T','Th']},{cap:'Вид слева: высоты с главного, глубина с вида сверху',roles:['F','Fh','T','Th','L','Lh','Lx']}];
const DZcut=want=>()=>pickDZ(want,['ig4','ig5']);
reg('k2',{make:DZcut(K=>K.has('cone')||K.has('cyl')),
  scene(V,k){ return cutScene(V,k==='C'?{coarse:14,coarseT:14}:{}); },
  fair(V,k,ok,bad){ return differs(ok,bad,['L','Lh','T','Th']); },
  traps:{C:{b0:0,say:'Кривую выреза построили по двум-трём точкам — нужны все характерные и промежуточные',src:'методика ДЗ 4',hl:['L','Lh','T','Th']}},watch:{steps:cutSteps}});
reg('k3',{make:DZcut(K=>K.has('npyr')||K.has('ngon')),
  scene(V,k){ return cutScene(V,k==='N'?{Lm:V.body}:{}); },
  fair(V,k,ok,bad){ return differs(ok,bad,['L','Lh']); },
  traps:{N:{b0:-0.2,say:'Линии выреза на гранях не перенесены на вид слева — точки на рёбрах по линиям связи',src:'методика ДЗ 4',hl:['L','Lh']}},watch:{steps:cutSteps}});
reg('k4',{make:DZcut(K=>K.has('cyl')),
  scene(V,k){ return cutScene(V,k==='C'?{coarse:14}:{}); },
  fair(V,k,ok,bad){ return differs(ok,bad,['L','Lh']); },
  traps:{C:{b0:0,say:'Наклонная грань режет цилиндр по эллипсу — его строят по точкам, а провели ломаной',src:'методика ДЗ 4',hl:['L','Lh']}},watch:{steps:cutSteps}});
reg('k5',{make:DZcut(K=>K.has('cone')),
  scene(V,k){ return cutScene(V,k==='C'?{coarse:14,coarseT:14}:{}); },
  fair(V,k,ok,bad){ return differs(ok,bad,['L','Lh','T','Th']); },
  traps:{C:{b0:0,say:'Промежуточные точки на конусе не построены — кривая неточна: точки через параллели',src:'методика ДЗ 4',hl:['L','Lh','T','Th']}},watch:{steps:cutSteps}});
reg('k7',{make:DZcut(()=>true),
  scene(V,k){ const ex=k==='O'?viewEls(V.body,'left0',W,0,'X',{hat:false}).filter(e=>e.role==='X').map(e=>Object.assign(e,{role:'Lx'})):[]; return cutScene(V,{extra:ex}); },
  traps:{O:{b0:0,say:'Дорисовали очерк тела через вырез — вырезанная часть очерка исчезает',src:'методика ДЗ 4',hl:['Lx']}},watch:{steps:cutSteps}});
reg('k8',{make(){ const V=DZM('ig6',N30); if(!V) return null; if(!V.m._pnc) Object.defineProperty(V.m,'_pnc',{value:strip(V.m,c=>c.t!=='sph')}); V.s=V.m._pnc; return V; },
  scene(V,k){ return cutScene(V,k==='I'?{Lm:V.s}:{}); },
  fair(V,k,ok,bad){ return differs(ok,bad,['L','Lh']); },
  traps:{I:{b0:0,say:'Забыли внутреннюю сферу: грань отверстия режет и полость',src:'методика ДЗ 6',hl:['L','Lh']}},watch:{steps:cutSteps}});
reg('k9',{make:()=>pickDZ(()=>true,['ig4','ig5','ig6']),
  scene(V,k){ return cutScene(V,k==='S'?{solid:1}:{}); },
  fair(V,k,ok){ return ok.E.some(e=>e.role==='Lh'); },
  traps:{S:{b0:-0.2,say:'Невидимые линии выреза провели сплошными',src:'ГОСТ 2.303',hl:['Lh']}},watch:{steps:cutSteps}});

/* ═════ Размеры детали ═════ */
reg('d1',{make(){ return {m:partL()}; },
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F').concat(viewEls(V.m,'top',0,W,'T')), b=V.m.box, f=proj(V.m,'front0',0,0), t=proj(V.m,'top',0,W), L=Math.round(b[1][0]-b[0][0]);
    E.push(...dim(f([b[0][0],0,b[0][2]]),f([b[1][0],0,b[0][2]]),-7,String(L),'d'));
    if(k==='D') E.push(...dim(t([b[0][0],b[0][1],0]),t([b[1][0],b[0][1],0]),-7,String(L),'dd'));
    else E.push(...dim(t([b[1][0],b[0][1],0]),t([b[1][0],b[1][1],0]),-7,String(Math.round(b[1][1]-b[0][1])),'dd'));
    return sceneB(E,6); },
  traps:{D:{b0:-0.3,say:'Один и тот же размер повторили на двух видах',src:'ГОСТ 2.307; методика ДЗ 3',hl:['dd']}},
  watch:{steps:st(['Виды детали',['F','Fh','T','Th']],['Длина — на главном виде',['F','Fh','T','Th','d']],['Ширина — на виде сверху; каждый размер один раз',['F','Fh','T','Th','d','dd']])}});
reg('d2',{make(){ const m=partSym(); let rb=0; (function w(n){ if(!n) return; if(n.t==='cyl'&&!n.x&&!n.y&&n.z0<0) rb=n.r; if(n.a) w(n.a); (n.k||[]).forEach(w); })(m.tree); return {m,rb}; },
  scene(V,k){ const E=viewEls(V.m,'front',0,0,'F').concat(viewEls(V.m,'top',0,W,'T')), f=proj(V.m,'front',0,0), z=V.m.box[1][2]*.8;
    E.push(...dim(f([-V.rb,0,z]),f([V.rb,0,z]),0,'Ø'+(k==='H'?V.rb:2*V.rb),'d',{half:1,size:6.5})); return sceneB(E,6); },
  traps:{H:{b0:-0.2,say:'На половине разреза ставят полный размер, а не половину',src:'ГОСТ 2.307',hl:['d']}},
  watch:{steps:st(['Половина вида и половина разреза',['F','Fh','Fhat','T','Th']],['Размерная линия — за ось, стрелка одна, число — полный диаметр',['F','Fh','Fhat','T','Th','d']])}});
reg('d3',{make(){ return {m:partL()}; },
  scene(V,k){ const E=viewEls(V.m,'front0',0,0,'F').concat(viewEls(V.m,'left0',W,0,'L')), b=V.m.box;
    const pr=k==='H'?proj(V.m,'front0',0,0):proj(V.m,'left0',W,0); E.push(...dim(pr([b[1][0],b[0][1],0]),pr([b[1][0],b[0][1],b[1][2]]),k==='H'?-8:8,String(Math.round(b[1][2])),'d'));
    return sceneB(E,6); },
  traps:{H:{b0:0,say:'Размер поставили на виде, где элемент виден хуже — ставят там, где форма читается',src:'ГОСТ 2.307',hl:['d']}},
  watch:{steps:st(['Виды детали',['F','Fh','L','Lh']],['Положение плоскостей выреза — от баз, на виде, где вырез виден формой',['F','Fh','L','Lh','d']])}});
})();
