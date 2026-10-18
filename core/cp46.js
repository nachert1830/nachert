/* ═══════════ № 46 — программа построения, видимость и типичные ошибки ═══════════
   Линия пересечения треугольников ABC и DEF и их видимость. Две части:
     P — точки 5 = DF ∩ (ABC) и 6 = EF ∩ (ABC) через фронтально-проецирующие посредники γ₁ ⊃ DF, γ₂ ⊃ EF
         (как на сайте и в сертификате core/t46.js), отрезок 56 на обеих проекциях;
     V — видимость: каждая сторона на каждой проекции обведена основной там, где видна, и штриховой там, где её
         закрывает другой треугольник. Узор участков считается по 3D-модели (глубина: π₂ — y, π₁ — z).
   Ошибка — операция над верной программой (P) или над верным узором (V). Тест — core/test.js. */
(function(){
const need=n=>(typeof module!=='undefined'&&module.exports&&typeof require==='function')?require('./'+n+'.js'):((self.CORE&&self.CORE[n])||(self.CERT&&self.CERT[n]));
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CORE=self.CORE||{}; self.CORE[n]=v; } };
const {v2,L2,v3,PRJ}=need('model');
const {edit}=need('cp');
const NAMES=['A','B','C','D','E','F'], SIDES=[['A','B'],['B','C'],['C','A'],['D','E'],['E','F'],['F','D']];

const pts3=G=>{ const o={}; NAMES.forEach(n=>o[n]=G[n].map(v=>typeof v==='number'?v:v.num())); return o; };
/* «дано» на листе: проекции вершин и прямые сторон (имя — 'AC″', 'AC′') */
function given(G){ const P=pts3(G), g={x:L2.axis()};
  NAMES.forEach(n=>{ g[n+'″']=PRJ.F(P[n]); g[n+'′']=PRJ.H(P[n]); });
  SIDES.forEach(([a,b])=>['″','′'].forEach(m=>{ g[a+b+m]=L2.through(g[a+m],g[b+m]); g[b+a+m]=g[a+b+m]; }));
  return g; }
/* напечатано: ось, стороны тонкими, кружки вершин, линии связи, подписи вершин */
function printed(G){ const g=given(G), out=[{t:'seg',a:[-70,0],b:[6,0],k:'thin',l:'x',role:'x'},{t:'txt',s:'x',at:[-73.5,-1],size:3}];
  const off={A:[[-4.2,-1.2],[-4.2,3.6]],B:[[-1,-2.4],[-1,4.6]],C:[[1.6,1],[1.6,3.4]],D:[[1.6,-1.2],[1.6,3.6]],E:[[-1,-2.4],[-1,5.2]],F:[[-4.2,3.4],[-4.2,-1.4]]};
  SIDES.forEach(([a,b])=>['″','′'].forEach(m=>out.push({t:'seg',a:g[a+m],b:g[b+m],k:'thin',role:a+b+m})));
  NAMES.forEach(n=>{ out.push({t:'conn',a:g[n+'″'],b:g[n+'′'],role:n+'″'+n+'′'});
    ['″','′'].forEach((m,i)=>{ out.push({t:'pt',at:g[n+m],l:n+m,hollow:true,role:n+m}); out.push({t:'txt',s:n+m,at:v2.add(g[n+m],off[n][i]),size:3}); }); });
  return out.map(it=>Object.assign(it,{src:'print',σ:0,conf:1})); }

/* ── часть P: посредник через сторону XY, стороны ABC: AC и BC (как на сайте) ── */
const T=(k,span,o)=>Object.assign({k,span},o||{});
function via(XY,i,j,res){ const [p,q]=[String(i),String(j)];
  return [ {id:p+'″',op:'meet',args:[XY+'″','AC″'],draw:{}}, {id:q+'″',op:'meet',args:[XY+'″','BC″'],draw:{}},
    {id:'l'+p,op:'link',args:[p+'″'],draw:T('conn',[p+'″',p+'′'])}, {id:p+'′',op:'meet',args:['l'+p,'AC′'],draw:{}},
    {id:'l'+q,op:'link',args:[q+'″'],draw:T('conn',[q+'″',q+'′'])}, {id:q+'′',op:'meet',args:['l'+q,'BC′'],draw:{}},
    {id:'m'+p+q,op:'through',args:[p+'′',q+'′'],draw:T('thin',[p+'′',q+'′',res+'′'])},
    {id:res+'′',op:'meet',args:['m'+p+q,XY+'′'],draw:{}},
    {id:'l'+res,op:'link',args:[res+'′'],draw:T('conn',[res+'′',res+'″'])}, {id:res+'″',op:'meet',args:['l'+res,XY+'″'],draw:{}} ]; }
const P_OK=via('DF',1,2,'5').concat(via('EF',3,4,'6'),[
  {id:'56″',op:'seg',args:['5″','6″'],draw:T('main',['5″','6″'])}, {id:'56′',op:'seg',args:['5′','6′'],draw:T('main',['5′','6′'])} ]);
const POPT={
  ok:{ok:true,what:'5 = DF ∩ (ABC), 6 = EF ∩ (ABC) через фронтально-проецирующие посредники',steps:P_OK},
  '5-EF':{ok:false,what:'5′ взята на пересечении 1′2′ с E′F′, а не с D′F′',
    why:'Посредник γ₁ проведён через DF, поэтому линия 12 = γ₁ ∩ (ABC) лежит в одной плоскости с DF и пересекает именно D′F′ — там и 5′.',
    mark:['5′','56′'],steps:p=>edit.replace(p,'5′',{args:['m12','EF′']}).steps},
  '12-swap':{ok:false,what:'Точки 1′ и 2′ перенесены не на те стороны: 1′ — на B′C′, 2′ — на A′C′',
    why:'1″ лежит на A″C″, значит, 1′ — на A′C′ (та же точка стороны AC); 2″ на B″C″ — 2′ на B′C′.',
    mark:['1′','2′','5′'],steps:p=>edit.replace(edit.replace(p,'1′',{args:['l1','BC′']}),'2′',{args:['l2','AC′']}).steps},
};

/* ── часть V: узор видимости ── */
const inside2=(p,t)=>{ const s=[0,1,2].map(i=>{ const a=t[i], b=t[(i+1)%3]; return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]); }); return s.every(x=>x>1e-9)||s.every(x=>x<-1e-9); };
/* для стороны XY проекции pl: функция t → 'vis' | 'hid' (закрыта другим треугольником) и 'over' — лежит ли над ним */
function sideState(P,side,pl){ const [a,b]=side, T1=['A','B','C'].includes(a)?['D','E','F']:['A','B','C'], pr=pl===2?PRJ.F:PRJ.H, dep=pl===2?1:2, O=T1.map(n=>P[n]);
  const n=v3.cross(v3.sub(O[1],O[0]),v3.sub(O[2],O[0])), oth=[0,1,2].filter(i=>i!==dep), t2=O.map(pr);
  return t=>{ const X=[0,1,2].map(i=>P[a][i]+(P[b][i]-P[a][i])*t); if(!inside2(pr(X),t2)) return 'free';
    const d=O[0][dep]-(n[oth[0]]*(X[oth[0]]-O[0][oth[0]])+n[oth[1]]*(X[oth[1]]-O[0][oth[1]]))/n[dep]; return d>X[dep]?'hid':'vis'; }; }
const VOPT={
  ok:{ok:true,what:'видимость определена верно'},
  'v2-inv':{ok:false,what:'Видимость на π₂ перепутана',why:'На π₂ ближе к наблюдателю та точка, у которой больше глубина y (смотрим на π₁: какая из конкурирующих точек дальше от оси x). Решение «по высоте z» даёт обратную видимость.'},
  'v1-inv':{ok:false,what:'Видимость на π₁ перепутана',why:'На π₁ видна та из конкурирующих точек, что выше (больше z — смотрим на π₂). Обратная видимость — ошибка выбора конкурирующей точки.'},
  'v-both':{ok:false,what:'Видимость перепутана на обеих проекциях',why:'Для каждой проекции видимость решается своими конкурирующими точками: на π₂ — по глубине y, на π₁ — по высоте z.'},
  'v-none':{ok:false,what:'Видимость не определена: штриховых участков нет',why:'Где один треугольник закрывает другой, закрытая часть стороны изображается штриховой линией — видимость определяют по конкурирующим точкам.'},
};
/* узор: для каждой стороны и проекции — участки [t0, t1, 'main' | 'hid'] */
function pattern(G,vid){ const P=pts3(G), out={};
  SIDES.forEach(side=>[2,1].forEach(pl=>{ const st=sideState(P,side,pl), N=600, seq=[];
    for(let i=0;i<N;i++){ const t=(i+0.5)/N; let s=st(t); if(s==='free') s='vis';
      else if(vid==='v-none'||(vid==='v2-inv'||vid==='v-both')&&pl===2||(vid==='v1-inv'||vid==='v-both')&&pl===1) s=vid==='v-none'?'vis':(s==='vis'?'hid':'vis');
      const k=s==='vis'?'main':'hid'; if(seq.length&&seq[seq.length-1][2]===k) seq[seq.length-1][1]=(i+1)/N; else seq.push([i/N,(i+1)/N,k]); }
    out[side.join('')+(pl===2?'″':'′')]=seq; }));
  return out; }

function program(pid,vid){ const Pp=POPT[pid], base={n:46,steps:P_OK}; const ps=typeof Pp.steps==='function'?Pp.steps(base):Pp.steps;
  return Object.assign(edit.clone({n:46,steps:ps}),{kid:pid,nvid:vid}); }
function cls(pid,vid){ const c=[]; if(!POPT[pid].ok) c.push(pid); if(!VOPT[vid].ok) c.push(vid); return c.length?c.join('+'):'ok'; }
function hypotheses(){ const o=[]; Object.keys(POPT).forEach(p=>Object.keys(VOPT).forEach(v=>o.push({kid:p,nvid:v,cls:cls(p,v)}))); return o; }
/* ответ по условию: 5 ∈ DF ∩ (ABC), 6 ∈ EF ∩ (ABC) — сдвиг проекций 5, 6 от точных, мм */
function truth(G){ const P=pts3(G), n=v3.cross(v3.sub(P.B,P.A),v3.sub(P.C,P.A)), meet=(X,Y)=>{ const d=v3.sub(P[Y],P[X]), t=v3.dot(n,v3.sub(P.A,P[X]))/v3.dot(n,d); return v3.add(P[X],v3.mul(d,t)); };
  return {P,'5':meet('D','F'),'6':meet('E','F')}; }
function judge(E,G){ const tr=truth(G); let d=0; ['5','6'].forEach(k=>{ d=Math.max(d,E[k+'″']?v2.dist(E[k+'″'],PRJ.F(tr[k])):Infinity,E[k+'′']?v2.dist(E[k+'′'],PRJ.H(tr[k])):Infinity); }); return {d56:d}; }

put('cp46',{given,printed,POPT,VOPT,KOPT:POPT,NVOPT:VOPT,program,cls,hypotheses,pattern,truth,judge,SIDES,PLANE:[]});
})();
