/* ═══════════ № 47 — программа построения, её варианты и типичные ошибки ═══════════
   Расстояние от точки A до прямой a общего положения. Программа состоит из двух частей:
     K  — основание перпендикуляра K = a ∩ α, α ⟂ a через A (горизонталь h и фронталь f, посредник γ ⊃ a);
     NV — натуральная величина |AK| способом прямоугольного треугольника.
   Гипотеза = (вариант K) × (вариант NV). Верные варианты — все способы, которые дают верный ответ (посредник
   фронтально- или горизонтально-проецирующий; треугольник на π₁ или π₂, при любом конце и в любую сторону).
   Ошибка — операция над верной программой (core/cp.js → edit): заменить действие или убрать шаги.
   Тест core/test.js: верная программа совпадает с сертификатом core/t47.js точно (до 1e-9 мм), каждая ошибка
   действительно даёт неверный ответ (условие «K ∈ a, AK ⟂ a» или длина |AK| нарушены). */
(function(){
const need=n=>(typeof module!=='undefined'&&module.exports&&typeof require==='function')?require('./'+n+'.js'):((self.CORE&&self.CORE[n])||(self.CERT&&self.CERT[n]));
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CORE=self.CORE||{}; self.CORE[n]=v; } };
const {v2,L2,PRJ}=need('model');
const {edit}=need('cp');

/* «дано» на листе по условию Γ (числа — те же, что в сертификате; aP(x) — точка прямой a с абсциссой x) */
function given(G){ const num=a=>a.map(v=>typeof v==='number'?v:v.num()), A=num(G.A), P0=num(G.aP(0)), P1=num(G.aP(1));
  return {'A″':PRJ.F(A),'A′':PRJ.H(A),'a″':L2.through(PRJ.F(P0),PRJ.F(P1)),'a′':L2.through(PRJ.H(P0),PRJ.H(P1)),x:L2.axis()}; }
/* напечатанное «дано» тетради (мм листа): ось, a″, a′ — отрезками; A″, A′ — кружками; линия связи A″A′; подписи
   (txt: левый край по линии строки, высота прописной size). Раскладку подписей нужно сверить со сканом тетради. */
function printed(G){ const g=given(G), num=a=>a.map(v=>typeof v==='number'?v:v.num()), F=x=>PRJ.F(num(G.aP(x))), H=x=>PRJ.H(num(G.aP(x)));
  const T=(s,at,o)=>({t:'txt',s,at:v2.add(at,o),size:3});
  return [ {t:'seg',a:[-62,0],b:[6,0],k:'thin',l:'x',role:'x'},
    {t:'seg',a:F(51.4),b:F(12),k:'main',l:'a″',role:'a″'}, {t:'seg',a:H(40.1),b:H(22),k:'main',l:'a′',role:'a′'},
    {t:'conn',a:g['A″'],b:g['A′'],role:'A″A′'},
    {t:'pt',at:g['A″'],l:'A″',hollow:true,role:'A″'}, {t:'pt',at:g['A′'],l:'A′',hollow:true,role:'A′'},
    T('x',[-62,0],[-3.5,-1]), T('a″',F(12),[1.5,-1]), T('a′',H(22),[1.5,3]), T('A″',g['A″'],[1.6,-1.2]), T('A′',g['A′'],[1.6,3.4]) ]
    .map(it=>Object.assign(it,{src:'print',σ:0,conf:1})); }

/* ── часть K ── */
const T=(k,span,o)=>Object.assign({k,span},o||{});
const K_FRONT=[ /* способ сайта: γ ⊃ a фронтально-проецирующая, f₀γ ≡ a″ */
  {id:'h″',op:'parAxis',args:['A″'],draw:T('thin',['A″','1″'],{l:'h″'})},
  {id:'h′',op:'perp',args:['a′','A′'],draw:T('thin',['A′','1′'],{l:'h′'})},
  {id:'Sh',op:'meet',args:['h′','a′'],opt:true,draw:{label:false,sq:['h′','a′']}},
  {id:'f′',op:'parAxis',args:['A′'],draw:T('thin',['A′','2′'],{l:'f′'})},
  {id:'f″',op:'perp',args:['a″','A″'],draw:T('thin',['A″','2″'],{l:'f″'})},
  {id:'1″',op:'meet',args:['a″','h″'],draw:{}},
  {id:'2″',op:'meet',args:['a″','f″'],draw:{sq:['f″','a″']}},
  {id:'Xg',op:'meet',args:['a″','x']},
  {id:'h₀γ',op:'link',args:['Xg'],opt:true,draw:T('thin',['Xg'],{l:'h₀γ',from:'first'})},
  {id:'l1',op:'link',args:['1″'],draw:T('conn',['1″','1′'])},
  {id:'1′',op:'meet',args:['l1','h′'],draw:{}},
  {id:'l2',op:'link',args:['2″'],draw:T('conn',['2″','2′'])},
  {id:'2′',op:'meet',args:['l2','f′'],draw:{}},
  {id:'m',op:'through',args:['1′','2′'],draw:T('thin',['1′','2′','K′'])},
  {id:'K′',op:'meet',args:['m','a′'],draw:{}},
  {id:'lk',op:'link',args:['K′'],draw:T('conn',['K′','K″'])},
  {id:'K″',op:'meet',args:['lk','a″'],draw:{}},
  {id:'A″K″',op:'seg',args:['A″','K″'],draw:T('main',['A″','K″'])},
  {id:'A′K′',op:'seg',args:['A′','K′'],draw:T('main',['A′','K′'])} ];
/* γ ⊃ a горизонтально-проецирующая: h₀γ ≡ a′; 1′ = h′ ∩ a′, 2′ = f′ ∩ a′, линия 1″2″ даёт K″ */
const K_HORIZ=[
  {id:'h″',op:'parAxis',args:['A″'],draw:T('thin',['A″','1″'],{l:'h″'})},
  {id:'h′',op:'perp',args:['a′','A′'],draw:T('thin',['A′','1′'],{l:'h′'})},
  {id:'f′',op:'parAxis',args:['A′'],draw:T('thin',['A′','2′'],{l:'f′'})},
  {id:'f″',op:'perp',args:['a″','A″'],draw:T('thin',['A″','2″'],{l:'f″'})},
  {id:'1′',op:'meet',args:['a′','h′'],draw:{sq:['h′','a′']}},
  {id:'2′',op:'meet',args:['a′','f′'],draw:{}},
  {id:'l1',op:'link',args:['1′'],draw:T('conn',['1′','1″'])},
  {id:'1″',op:'meet',args:['l1','h″'],draw:{}},
  {id:'l2',op:'link',args:['2′'],draw:T('conn',['2′','2″'])},
  {id:'2″',op:'meet',args:['l2','f″'],draw:{}},
  {id:'Sf',op:'meet',args:['f″','a″'],opt:true,draw:{label:false,sq:['f″','a″']}},
  {id:'m',op:'through',args:['1″','2″'],draw:T('thin',['1″','2″','K″'])},
  {id:'K″',op:'meet',args:['m','a″'],draw:{}},
  {id:'lk',op:'link',args:['K″'],draw:T('conn',['K″','K′'])},
  {id:'K′',op:'meet',args:['lk','a′'],draw:{}},
  {id:'A″K″',op:'seg',args:['A″','K″'],draw:T('main',['A″','K″'])},
  {id:'A′K′',op:'seg',args:['A′','K′'],draw:T('main',['A′','K′'])} ];
const PLANE=['h″','h′','Sh','f′','f″','1″','2″','Xg','h₀γ','l1','1′','l2','2′','m'];

const KOPT={
  front:{ok:true,what:'K = a ∩ α (посредник γ ⊃ a, фронтально-проецирующий)',steps:K_FRONT},
  horiz:{ok:true,what:'K = a ∩ α (посредник γ ⊃ a, горизонтально-проецирующий)',steps:K_HORIZ},
  'h-par':{ok:false,what:'Горизонталь плоскости α проведена параллельно a′, а не перпендикулярно',
    why:'Плоскость α ⟂ a задаётся прямыми h и f, для которых h′ ⟂ a′ и f″ ⟂ a″ (теорема о проецировании прямого угла). С h′ ∥ a′ плоскость α не перпендикулярна a, и K — не основание перпендикуляра.',
    mark:['h′','K′'],steps:p=>edit.replace(p,'h′',{op:'par'}).steps},
  'f-hpar':{ok:false,what:'Фронталь f″ проведена ⟂ a′ (направление взято с другой проекции)',
    why:'Перпендикулярность прямой и фронтали видна на фронтальной проекции: f″ ⟂ a″. Направление a′ к π₂ отношения не имеет.',
    mark:['f″','K′'],steps:p=>edit.replace(p,'f″',{op:'perp',args:['a′','A″']}).steps},
  foot1:{ok:false,what:'K′ найдена как основание перпендикуляра из A′ на a′ — прямой угол на π₁ искажён',
    why:'Прямой угол между AK и a проецируется в натуральную величину, только если одна из прямых параллельна плоскости проекций. Прямая a — общего положения, поэтому A′K′ не перпендикулярна a′. Нужна плоскость α ⟂ a через A и точка K = a ∩ α.',
    mark:['K′','A′K′'],steps:p=>edit.optional(edit.replace(p,'K′',{op:'foot',args:['A′','a′']}),PLANE).steps},
  foot2:{ok:false,what:'K″ найдена как основание перпендикуляра из A″ на a″ — прямой угол на π₂ искажён',
    why:'Прямая a — общего положения: прямой угол между AK и a на π₂ не сохраняется. Нужна плоскость α ⟂ a через A и точка K = a ∩ α.',
    mark:['K″','A″K″'],
    steps:p=>{ let q=edit.optional(p,PLANE); q=edit.remove(q,['lk','K″','K′']);
      q=edit.insertAfter(q,'m',[{id:'K″',op:'foot',args:['A″','a″'],draw:{}},{id:'lk',op:'link',args:['K″'],draw:T('conn',['K″','K′'])},{id:'K′',op:'meet',args:['lk','a′'],draw:{}}]); return q.steps; }},
  '12-swap':{ok:false,what:'Точки 1′ и 2′ перенесены не на те прямые: 1′ — на f′, 2′ — на h′',
    why:'Точка 1 лежит на горизонтали h (1″ = a″ ∩ h″), значит 1′ — на h′; точка 2 — на фронтали f, значит 2′ — на f′.',
    mark:['1′','2′','K′'],steps:p=>edit.replace(edit.replace(p,'1′',{args:['l1','f′']}),'2′',{args:['l2','h′']}).steps},
};

/* ── часть NV: треугольник на поле fld (1 — π₁, 2 — π₂) при конце e (A или K), в сторону s ── */
function nvSteps(fld,e,s,leg){ const m=fld===1?'′':'″', o=fld===1?'″':'′', P=e+m, Q=(e==='A'?'K':'A')+m, N=e+'₀';
  const L={ok:['dv','A'+o,'K'+o], same:['dv','A'+m,'K'+m], abs:['absV',e+o]}[leg];
  return [ {id:'Δ',op:L[0],args:L.slice(1)}, {id:N,op:'perpOff',args:[P,Q,'Δ',s],draw:{}},
    {id:'leg',op:'seg',args:[P,N],draw:T('thin',[P,N])}, {id:'hyp',op:'seg',args:[Q,N],draw:T('main',[Q,N])},
    {id:'|AK|',op:'dist',args:[Q,N]} ]; }
const NVOPT={};
[1,2].forEach(f=>['A','K'].forEach(e=>[1,-1].forEach(s=>{ const v=(f===1?'π₁':'π₂')+', при '+e+(s>0?'':' (в другую сторону)');
  NVOPT['ok:'+f+e+(s>0?'+':'-')]={ok:true,what:'|AK| — гипотенуза треугольника на '+v,steps:nvSteps(f,e,s,'ok')};
  NVOPT['same:'+f+e+(s>0?'+':'-')]={ok:false,fault:'nv-same',what:'Второй катет треугольника взят не с той проекции',
    why:'Треугольник на '+(f===1?'π₁':'π₂')+': первый катет — '+(f===1?'A′K′':'A″K″')+', второй — разность '+(f===1?'высот z точек A и K (снимается с π₂)':'глубин y точек A и K (снимается с π₁)')+'. Разность с той же проекции не даёт натуральной величины.',
    mark:['leg'],steps:nvSteps(f,e,s,'same')};
  NVOPT['abs:'+f+e+(s>0?'+':'-')]={ok:false,fault:'nv-abs',what:'Второй катет — вся координата точки, а не разность координат A и K',
    why:'Второй катет — разность удалений концов отрезка от плоскости проекций ('+(f===1?'Δz = z_A − z_K':'Δy = y_A − y_K')+'), а не удаление одного конца.',
    mark:['leg'],steps:nvSteps(f,e,s,'abs')}; })));
NVOPT['none']={ok:false,fault:'nv-none',what:'Натуральная величина |AK| не построена',
  why:'A′K′ и A″K″ — проекции отрезка общего положения, обе искажены. Длину даёт гипотенуза прямоугольного треугольника: катет — проекция, второй катет — разность удалений концов.',
  mark:['A′K′'],steps:[]};

/* программа гипотезы */
function program(kid,nvid){ const K=KOPT[kid], NV=NVOPT[nvid]; const base={n:47,steps:K_FRONT};
  const ks=typeof K.steps==='function'?K.steps(base):K.steps;
  return edit.clone({n:47,kid,nvid,steps:ks.concat(NV.steps)}); }
/* класс ошибки (что сообщает сканер): верно, или код ошибки части K и/или NV */
function cls(kid,nvid){ const K=KOPT[kid], NV=NVOPT[nvid], c=[]; if(!K.ok) c.push(kid); if(!NV.ok) c.push(NV.fault); return c.length?c.join('+'):'ok'; }
function hypotheses(){ const out=[]; Object.keys(KOPT).forEach(k=>Object.keys(NVOPT).forEach(nv=>out.push({kid:k,nvid:nv,cls:cls(k,nv)}))); return out; }

/* ответ по условию (как spec в core/t47.js): K на a и AK ⟂ a — сдвиг K′, K″ от верного основания, мм;
   |AK| — гипотенуза построенного треугольника против точной длины */
function truth(G){ const num=a=>a.map(v=>typeof v==='number'?v:v.num()), A=num(G.A), P0=num(G.aP(0)), P1=num(G.aP(1));
  const d=[P1[0]-P0[0],P1[1]-P0[1],P1[2]-P0[2]], t=((A[0]-P0[0])*d[0]+(A[1]-P0[1])*d[1]+(A[2]-P0[2])*d[2])/(d[0]**2+d[1]**2+d[2]**2);
  const K=[P0[0]+d[0]*t,P0[1]+d[1]*t,P0[2]+d[2]*t]; return {A,K,AK:Math.hypot(A[0]-K[0],A[1]-K[1],A[2]-K[2])}; }
function judge(E,G){ const tr=truth(G), Kf=E['K″'], Kh=E['K′'];
  const dK=Kf&&Kh?Math.max(v2.dist(Kf,PRJ.F(tr.K)),v2.dist(Kh,PRJ.H(tr.K))):Infinity;
  const dNV=E['|AK|']!=null?Math.abs(E['|AK|']-tr.AK):Infinity; return {K:tr.K,AK:tr.AK,dK,dNV,nv:E['|AK|']}; }

put('cp47',{given,printed,KOPT,NVOPT,program,cls,hypotheses,judge,truth,PLANE});
})();
