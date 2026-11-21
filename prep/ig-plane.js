/* ═══════════ Подготовка по инже: оформление чертежа и размеры — плоские чертежи ═══════════
   Темы g1–g4r, g5b, g14 (тетрадь, гл. 1–2): каждая пара — новые размеры; чертёж собран из примитивов ГОСТ (линии 2.303,
   размеры 2.307: выносные, размерные, стрелки, числа над линией, знаки), ловушка — одна типичная ошибка.
   Единицы — мм чертежа, y вниз. Работает и в Node (без IG3). */
(function(){
if(!self.PREP) return;
const R=(a,b)=>a+Math.random()*(b-a), RI=(a,b)=>Math.round(R(a,b)), pick=a=>a[Math.floor(Math.random()*a.length)];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mul=(a,k)=>[a[0]*k,a[1]*k], unit=a=>{ const l=Math.hypot(a[0],a[1]); return [a[0]/l,a[1]/l]; };
const Ln=(a,b,c,role,dash)=>({t:'line',a:[a[0],a[1],b[0],b[1]],c,role,dash});
const Tx=(a,s,role,o)=>Object.assign({t:'txt',a,s,role,anchor:'middle',size:4.2},o||{});
function arrow(tip,dir,role){ const n=[-dir[1],dir[0]], b=sub(tip,mul(dir,3.2)); return {t:'poly',z:1,p:[tip,add(b,mul(n,.75)),sub(b,mul(n,.75))],c:'arw',role}; }
/* линейный размер: p1, p2 — точки детали; off — вынос (знак — сторона); out — стрелки снаружи (короткий размер) */
function dim(p1,p2,off,text,role,o){ o=o||{}; const u=unit(sub(p2,p1)), n=[-u[1],u[0]], sg=Math.sign(off)||1, q1=add(p1,mul(n,off)), q2=add(p2,mul(n,off)), E=[];
  if(!o.noExt){ E.push(Ln(add(p1,mul(n,sg*.8)),add(q1,mul(n,sg*2)),'thin',role),Ln(add(p2,mul(n,sg*.8)),add(q2,mul(n,sg*2)),'thin',role)); }
  if(o.out){ E.push(Ln(sub(q1,mul(u,7)),add(q2,mul(u,7)),'thin',role),arrow(q1,u,role),arrow(q2,mul(u,-1),role)); }
  else E.push(Ln(q1,q2,'thin',role),arrow(q1,mul(u,-1),role),arrow(q2,u,role));
  const m=mul(add(q1,q2),.5), ang=Math.atan2(u[1],u[0])*180/Math.PI, up=ang>90||ang<-90?ang+180:ang;
  E.push(Tx(add(add(m,mul(n,sg*1.6)),o.tx?mul(u,o.tx):[0,0]),text,role,{rot:Math.abs(up)<1e-6?0:up,size:o.size||4.2}));
  return E; }
/* выноска с полкой: от точки на контуре (стрелка) к полке с надписью */
function leader(at,dir,len,text,role){ const end=add(at,mul(dir,len)), sh=dir[0]>=0?1:-1, w=text.length*2.3+2;
  return [arrow(at,mul(dir,-1),role),Ln(at,end,'thin',role),Ln(end,add(end,[sh*w,0]),'thin',role),Tx(add(end,[sh*w/2,-1.2]),text,role)]; }
const rect=(x,y,w,h,c,role,dash)=>[Ln([x,y],[x+w,y],c,role,dash),Ln([x+w,y],[x+w,y+h],c,role,dash),Ln([x+w,y+h],[x,y+h],c,role,dash),Ln([x,y+h],[x,y],c,role,dash)];
const circ=(c,r,cls,role,dash)=>({t:'circ',a:[c[0],c[1],r],c:cls,role,dash});
const axes=(c,r,role)=>[Ln([c[0]-r-3,c[1]],[c[0]+r+3,c[1]],'cl',role),Ln([c[0],c[1]-r-3],[c[0],c[1]+r+3],'cl',role)];
function box(E,pad){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; const P=(x,y)=>{ x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y); };
  E.forEach(e=>{ if(e.t==='line'){ P(e.a[0],e.a[1]); P(e.a[2],e.a[3]); } else if(e.t==='circ'){ P(e.a[0]-e.a[2],e.a[1]-e.a[2]); P(e.a[0]+e.a[2],e.a[1]+e.a[2]); } else if(e.t==='poly') e.p.forEach(q=>P(q[0],q[1])); else if(e.t==='txt') P(e.a[0],e.a[1]); });
  pad=pad==null?8:pad; return [x0-pad,y0-pad,x1-x0+2*pad,y1-y0+2*pad]; }
const S=E=>({box:box(E),E});
const reg=(id,o)=>PREP.topic(id,o);
const st=(...a)=>a.map(([cap,roles])=>({cap,roles}));

/* g1 — лист: рамка 20 мм слева и 5 мм с остальных сторон, основная надпись в правом нижнем углу */
reg('g1',{make:()=>({f:pick([[210,297],[420,297]]),k:.32}),
  scene(V,t){ const [w,h]=V.f.map(v=>v*V.k), k=V.k, l=(t==='F'?5:20)*k, s=5*k, tw=185*k, th=55*k;
    const E=rect(0,0,w,h,'thin','sh').concat(rect(l,s,w-l-s,h-2*s,'thick','fr'));
    const tb=t==='N'?[l,s]:[w-s-tw,h-s-th]; E.push(...rect(tb[0],tb[1],tw,th,'thick','tb'),Tx([tb[0]+tw/2,tb[1]+th/2+1.5],'основная надпись','tb',{size:3.6}));
    E.push(Tx([w/2,h+5],V.f[0]>V.f[1]?'А3':'А4','sh',{size:4})); return {box:[-6,-6,w+12,h+16],E}; },
  traps:{F:{b0:-0.2,say:'Слева рамка 5 мм — нужно 20 мм под подшивку',src:'ГОСТ 2.301',hl:['fr']},N:{b0:-0.6,say:'Основная надпись — в правом нижнем углу',src:'ГОСТ 2.104',hl:['tb']}},
  watch:{steps:st(['Формат — тонкой линией по краю листа',['sh']],['Рамка основной линией: 20 мм слева, 5 мм с остальных сторон',['sh','fr']],['Основная надпись — в правом нижнем углу, вплотную к рамке',['sh','fr','tb']])}});
/* g2 — типы линий */
reg('g2',{make:()=>({w:RI(70,90),h:RI(40,50),r:RI(7,10),sw:RI(14,20),sh:RI(8,12)}),
  scene(V,t){ const c=[V.w*.35,V.h/2], E=rect(0,0,V.w,V.h,'thick','o'); E.push(circ(c,V.r,'thick','o'));
    const sx=V.w*.62; E.push(...rect(sx,V.h/2-V.sh/2,V.sw,V.sh,t==='H'?'thick':'thin','hid',t!=='H'));
    const ext=t==='A'?0:3; E.push(Ln([c[0]-V.r-ext,c[1]],[c[0]+V.r+ext,c[1]],'cl','ax'),Ln([c[0],c[1]-V.r-ext],[c[0],c[1]+V.r+ext],'cl','ax'));
    return S(E); },
  traps:{H:{b0:-0.4,say:'Невидимый контур проведён сплошной основной — нужна штриховая',src:'ГОСТ 2.303',hl:['hid']},A:{b0:0.2,say:'Осевые не выходят за контур — выпуск 2–5 мм',src:'ГОСТ 2.303',hl:['ax']}},
  watch:{steps:st(['Видимый контур — сплошная основная',['o']],['Невидимый контур — штриховая',['o','hid']],['Оси — штрихпунктирные, выходят за контур на 2–5 мм',['o','hid','ax']])}});
/* g3 — шрифт: обозначение разреза на номер крупнее размерных чисел */
reg('g3',{make:()=>({w:RI(50,70),h:RI(20,30),L:pick(['А','Б','В'])}),
  scene(V,t){ const E=[{t:'path',d:`M0 0H${V.w}V${V.h}H0Z`,c:'hat',role:'o'}].concat(rect(0,0,V.w,V.h,'thick','o'),dim([0,V.h],[V.w,V.h],8,String(V.w),'dm'),dim([V.w,0],[V.w,V.h],-8,String(V.h),'dm'));
    E.push(Tx([V.w/2,-5],V.L+'–'+V.L,'lab',{size:t==='S'?4.2:6})); return Object.assign(S(E),{hatch:true}); },
  traps:{S:{b0:0,say:'Буквы разреза того же размера, что размерные числа — нужно на номер больше (7 при размерах 5)',src:'ГОСТ 2.304; тетрадь, с. 21',hl:['lab']}},
  watch:{steps:st(['Размерные числа — шрифт 3,5–5',['o','dm']],['Обозначение разреза — на номер больше: шрифт 7',['o','dm','lab']])}});
/* g4 — как ставят размер */
reg('g4',{make:()=>({w:RI(50,80),h:RI(25,40)}),
  scene(V,t){ const E=rect(0,0,V.w,V.h,'thick','o');
    E.push(...(t==='X'?dim([0,V.h],[V.w,V.h],0,String(V.w),'dw',{noExt:1}):dim([0,V.h],[V.w,V.h],t==='C'?3:10,String(V.w),'dw')),...dim([V.w,0],[V.w,V.h],-10,String(V.h),'dh'));
    return S(E); },
  traps:{C:{b0:-0.2,say:'Размерная линия ближе 10 мм к контуру',src:'ГОСТ 2.307; тетрадь, рис. 10',hl:['dw']},X:{b0:0,say:'Контурную линию использовали как размерную',src:'ГОСТ 2.307; тетрадь, с. 10',hl:['dw']}},
  watch:{steps:st(['Деталь',['o']],['Выносные линии от контура, размерная — не ближе 10 мм, стрелки упираются в выносные',['o','dw']],['Число — над размерной линией, у вертикального размера — повёрнуто',['o','dw','dh']])}});
/* g4m — маленький размер: стрелки снаружи */
reg('g4m',{make:()=>({w:RI(60,80),h:RI(25,35),s:RI(5,8),x:RI(20,35)}),
  scene(V,t){ const d=RI(6,10), E=[Ln([0,0],[V.x,0],'thick','o'),Ln([V.x,0],[V.x,d],'thick','o'),Ln([V.x,d],[V.x+V.s,d],'thick','o'),Ln([V.x+V.s,d],[V.x+V.s,0],'thick','o'),Ln([V.x+V.s,0],[V.w,0],'thick','o'),
      Ln([V.w,0],[V.w,V.h],'thick','o'),Ln([V.w,V.h],[0,V.h],'thick','o'),Ln([0,V.h],[0,0],'thick','o')];
    E.push(...dim([V.x,0],[V.x+V.s,0],-8,String(V.s),'ds',{out:t!=='I',tx:t!=='I'?0:0}),...dim([0,V.h],[V.w,V.h],10,String(V.w),'dw')); return S(E); },
  traps:{I:{b0:-0.2,say:'Размер меньше 12 мм — стрелки внутрь не помещаются: их ставят снаружи, размерную линию продлевают',src:'ГОСТ 2.307; тетрадь, рис. 11',hl:['ds']}},
  watch:{steps:st(['Деталь с узким пазом',['o']],['Ширина паза мала — стрелки снаружи, размерная линия продлена за выносные',['o','ds']],['Общий размер — как обычно',['o','ds','dw']])}});
/* g4z — знаки: Ø — у полной окружности, R — у дуги */
reg('g4z',{make:()=>({w:RI(60,80),h:RI(36,46),r:RI(6,10),R:RI(8,12)}),
  scene(V,t){ const R=V.R, E=[Ln([0,0],[V.w-R,0],'thick','o'),{t:'poly',p:Array.from({length:13},(_,i)=>{ const a=-Math.PI/2+i/12*Math.PI/2; return [V.w-R+R*Math.cos(a),R+R*Math.sin(a)]; }),c:'thick',role:'o'},
      Ln([V.w,R],[V.w,V.h],'thick','o'),Ln([V.w,V.h],[0,V.h],'thick','o'),Ln([0,V.h],[0,0],'thick','o')];
    const c=[V.w*.38,V.h/2]; E.push(circ(c,V.r,'thick','o'),...axes(c,V.r,'o'));
    const a=-Math.PI/4, p=[c[0]+V.r*Math.cos(a),c[1]+V.r*Math.sin(a)], q=[c[0]-V.r*Math.cos(a),c[1]-V.r*Math.sin(a)];
    E.push(Ln(q,p,'thin','dd'),arrow(p,unit(sub(p,q)),'dd'),arrow(q,unit(sub(q,p)),'dd'),Ln(p,add(p,[8,-8]),'thin','dd'),Ln(add(p,[8,-8]),add(p,[20,-8]),'thin','dd'),Tx(add(p,[14,-9.2]),(t==='D'?'R':'Ø')+(2*V.r),'dd'));
    const ac=[V.w-R,R], am=[ac[0]+R*Math.cos(-Math.PI/4),ac[1]+R*Math.sin(-Math.PI/4)];
    E.push(...leader(am,unit([1,-1]),9,(t==='A'?'Ø':'R')+R,'dr')); return S(E); },
  traps:{D:{b0:-0.5,say:'Перед размером полной окружности ставят Ø, а не R',src:'ГОСТ 2.307; тетрадь, рис. 13',hl:['dd']},A:{b0:-0.2,say:'Дугу меньше полуокружности задают радиусом R, а не диаметром',src:'ГОСТ 2.307; тетрадь, рис. 13',hl:['dr']}},
  watch:{steps:st(['Деталь: отверстие и скруглённый угол',['o']],['Окружность — знак Ø и полный диаметр',['o','dd']],['Дуга — знак R и радиус',['o','dd','dr']])}});
/* g4r — одинаковые отверстия: размер один раз с числом */
reg('g4r',{make:()=>({w:RI(80,100),h:RI(30,40),n:RI(3,4),d:pick([6,7,8,10])}),
  scene(V,t){ const E=rect(0,0,V.w,V.h,'thick','o'), xs=Array.from({length:V.n},(_,i)=>V.w*(i+1)/(V.n+1));
    xs.forEach((x,i)=>{ E.push(circ([x,V.h/2],V.d/2,'thick','o'),...axes([x,V.h/2],V.d/2,'o')); });
    if(t==='E') xs.forEach((x,i)=>E.push(...leader([x+V.d/2*Math.SQRT1_2,V.h/2-V.d/2*Math.SQRT1_2],unit([1,-1]),8+i*2,'Ø'+V.d,'dl')));
    else E.push(...leader([xs[0]+V.d/2*Math.SQRT1_2,V.h/2-V.d/2*Math.SQRT1_2],unit([1,-1]),10,V.n+' отв. Ø'+V.d,'dl'));
    return S(E); },
  traps:{E:{b0:-0.3,say:'Размер каждого из одинаковых отверстий поставили отдельно — пишут один раз: «n отв. Ød»',src:'ГОСТ 2.307; тетрадь, рис. 17',hl:['dl']}},
  watch:{steps:st(['Деталь с одинаковыми отверстиями',['o']],['Одна выноска: число отверстий и диаметр — «'+'n отв. Ød»',['o','dl']])}});
/* g5b — биссектриса угла и серединный перпендикуляр: засечки одним раствором */
reg('g5b',{make:()=>({m:pick(['ang','seg']),a:R(.5,1.3),L:RI(50,70),r:RI(22,30)}),
  scene(V,t){ const E=[];
    if(V.m==='ang'){ const O=[0,0], A=[V.L,0], B=[V.L*Math.cos(V.a),-V.L*Math.sin(V.a)], u1=unit(A), u2=unit(B), p1=mul(u1,V.r), p2=mul(u2,V.r);
      E.push(Ln(O,A,'thick','o'),Ln(O,B,'thick','o'),circ(O,V.r,'a','s1',true),{t:'pt',a:p1,c:'o',role:'s1'},{t:'pt',a:p2,c:'o',role:'s1'});
      const k=V.r*0.8, k2=t==='R'?k*1.3:k, X=(()=>{ const d=Math.hypot(...sub(p2,p1)), a=(k*k-k2*k2+d*d)/(2*d), h=Math.sqrt(Math.max(0,k*k-a*a)), u=unit(sub(p2,p1)), m=add(p1,mul(u,a)); const c1=add(m,mul([-u[1],u[0]],h)), c2=sub(m,mul([-u[1],u[0]],h)); return Math.hypot(...c1)>Math.hypot(...c2)?c1:c2; })();
      E.push(circ(p1,k,'b','s2',true),circ(p2,k2,'b','s2',true),{t:'pt',a:X,c:'ans',role:'s2'},Ln(O,mul(unit(X),V.L*1.05),'crv','res')); }
    else { const A=[0,0], B=[V.L,0], k=V.L*.62, k2=t==='R'?k*1.25:k, d=V.L, a=(k*k-k2*k2+d*d)/(2*d), h=Math.sqrt(k*k-a*a), C1=[a,-h], C2=[a,h];
      E.push(Ln(A,B,'thick','o'),{t:'pt',a:A,c:'o',role:'o'},{t:'pt',a:B,c:'o',role:'o'},circ(A,k,'b','s2',true),circ(B,k2,'b','s2',true),{t:'pt',a:C1,c:'ans',role:'s2'},{t:'pt',a:C2,c:'ans',role:'s2'},Ln(add(C1,[0,-4]),add(C2,[0,4]),'crv','res')); }
    return S(E); },
  traps:{R:{b0:-0.1,say:'Засечки сделали разным раствором циркуля — линия не делит пополам',src:'тетрадь, рис. 24',hl:['s2','res']}},
  watch:{V(){ const V=this.make(); this.watch.steps=V.m==='ang'?st(['Угол',['o']],['Дуга из вершины — точки на сторонах',['o','s1']],['Из них — засечки одним раствором',['o','s1','s2']],['Через вершину и точку пересечения — биссектриса',['o','s1','s2','res']]):st(['Отрезок',['o']],['Из концов — дуги одним раствором, больше половины отрезка',['o','s2']],['Через точки пересечения — серединный перпендикуляр',['o','s2','res']]); return V; },steps:[]}});
/* g14 — размеры плоского контура: центры от баз, радиусы, без точек касания */
reg('g14',{make:()=>({w:RI(70,90),h:RI(40,50),R:RI(10,14),d:RI(10,14),cx:RI(20,30),cy:RI(16,24)}),
  scene(V,t){ const R=V.R, E=[Ln([0,0],[V.w-R,0],'thick','o'),{t:'poly',p:Array.from({length:13},(_,i)=>{ const a=-Math.PI/2+i/12*Math.PI/2; return [V.w-R+R*Math.cos(a),R+R*Math.sin(a)]; }),c:'thick',role:'o'},
      Ln([V.w,R],[V.w,V.h],'thick','o'),Ln([V.w,V.h],[0,V.h],'thick','o'),Ln([0,V.h],[0,0],'thick','o')];
    const c=[V.cx,V.h-V.cy]; E.push(circ(c,V.d/2,'thick','o'),...axes(c,V.d/2,'o'));
    E.push(...dim([0,V.h],[V.w,V.h],12,String(V.w),'d1'),...dim([V.w,0],[V.w,V.h],-12,String(V.h),'d1'),...dim([0,V.h],[c[0],V.h],6,String(V.cx),'d2'),...dim([0,c[1]],[0,V.h],6,String(V.cy),'d2'),
      ...leader([V.w-R+R*Math.SQRT1_2,R-R*Math.SQRT1_2],unit([1,-1]),8,'R'+R,'d3'));
    if(t==='T') E.push(...dim([0,0],[V.w-R,0],-7,String(V.w-R),'bad'));
    return S(E); },
  traps:{T:{b0:0,say:'Поставили размер до точки касания — она получается построением, её не образмеривают',src:'ГОСТ 2.307',hl:['bad']}},
  watch:{steps:st(['Контур детали',['o']],['Габариты',['o','d1']],['Положение центра отверстия — от баз',['o','d1','d2']],['Радиус скругления — R; точки касания не образмеривают',['o','d1','d2','d3']])}});
})();
