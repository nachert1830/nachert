/* ═══════════ ДЗ №1 · решение: плоская фигура со стороной на прямой уровня MN ═══════════
   Одна программа на все 30 вариантов. Что меняется от варианта к варианту — решают правила, а не ручная подгонка:
   • какая MN прямая уровня: y_M = y_N — фронталь, на π₂ она в натуральную величину (там строим прямой угол и длины);
     z_M = z_N — горизонталь, то же на π₁. Дальше «главная» проекция P — та, где MN натуральная, «вторая» O — другая;
   • какая фигура: 1–10 равносторонний треугольник, 11–20 параллелограмм (BC = 100, AB = 60), 21–30 равнобедренная
     трапеция (AD = высоте, диагонали 120).
   Размеры фигуры строятся способом совмещения: плоскость фигуры поворачиваем вокруг MN до положения ∥ P. MN остаётся
   на месте, A переходит в A₀ — на перпендикуляре к MN в точке K, на расстоянии h = |AK| (натуральная величина высоты).
   В совмещённом положении фигура видна без искажения: стороны и углы откладываются прямо (циркулем, угольником 60°).
   Затем точки на MN возвращаются на вторую проекцию по линиям связи, а сторона AD ∥ MN — параллельно проекциям MN.
   Ответ проверяется условием задачи (сертификат): форма фигуры, BC ⊂ MN, углы — по нормали плоскости. */
(function(){
const {sub,add,mul,dot,cross,len,dist,unit,offLine,deg}=NGLIB.vu, {STEP}=NGLIB;
const r1=x=>Math.round(x*10)/10, fmt=x=>String(r1(x)).replace('.',',').replace('-','−');

function build(n,D,src){
  const {F,H,S,G,point,seg3,seg,pt,conn,sq,ang,txt,ln,axis,nvOnF,nvOnH,poly,table}=L;
  const {A,M,N}=D, kind=src.kind(n);
  const lev=M[1]===N[1]?'f':M[2]===N[2]?'h':null;
  if(!lev) return {why:'MN не прямая уровня — в вариантах задания такого нет'};
  const fr=lev==='f';
  /* главная проекция P (MN натуральная) и вторая O */
  const PP=fr?F:H, PO=fr?H:F, mP=fr?'″':'′', mO=fr?'′':'″', piP=fr?'π₂':'π₁', piO=fr?'π₁':'π₂';
  const lvName=fr?'фронталь':'горизонталь', cK=fr?1:2, cO=fr?2:1;        /* координата уровня MN (y или z) и «другая» */
  const cName=['x','y','z'][cK], oName=['x','y','z'][cO];
  const aP=fr?'β':'α', aO=fr?'α':'β';                                     /* угол с плоскостью P и с плоскостью O */
  const e=unit(sub(N,M)), K=add(M,mul(e,dot(sub(A,M),e))), h=dist(A,K);
  /* фигура (в пространстве) — по типу варианта */
  let fig={}, extra={};
  if(kind==='tri'){ const a=2*h/Math.sqrt(3); fig={B:add(K,mul(e,a/2)),C:add(K,mul(e,-a/2))}; extra={a}; }
  if(kind==='par'){ if(h>60) return {why:'высота больше боковой стороны 60 мм — параллелограмма нет'};
    const s=Math.sqrt(3600-h*h), B=add(K,mul(e,-s)); fig={B,C:add(B,mul(e,100)),D:add(A,mul(e,100))}; extra={s}; }
  if(kind==='trap'){ const x=Math.sqrt(14400-h*h)-h; if(!(x>0)) return {why:'диагональ 120 мм короче, чем нужно для трапеции с меньшим основанием, равным высоте'};
    fig={B:add(K,mul(e,-x)),C:add(K,mul(e,h+x)),D:add(A,mul(e,h))}; extra={x}; }
  const V=Object.assign({A},fig), names=kind==='tri'?['A','B','C']:['A','B','C','D'];
  const nrm=unit(cross(sub(V.B,A),sub(V.C,A)));
  const plA1=deg(Math.acos(Math.min(1,Math.abs(nrm[2])))), plA2=deg(Math.acos(Math.min(1,Math.abs(nrm[1]))));
  const akA1=deg(Math.asin(Math.min(1,Math.abs(A[2]-K[2])/h))), akA2=deg(Math.asin(Math.min(1,Math.abs(A[1]-K[1])/h)));
  /* ── чертёж ── */
  const Pp=p=>PP(p), Po=p=>PO(p);
  const cen=(pr)=>{ const ps=names.map(k=>pr(V[k])); return [ps.reduce((s,p)=>s+p[0],0)/ps.length,ps.reduce((s,p)=>s+p[1],0)/ps.length]; };
  const away=(p,c)=>{ const dx=p[0]-c[0], dy=p[1]-c[1]; return (dy<0?'n':'s')+(dx<0?'w':'e'); };
  const nv=(a,b,pr,o)=>{ const f=pr===F?nvOnF:nvOnH, c=cen(pr); const t1=f(a,b,Object.assign({},o,{side:1})), t2=f(a,b,Object.assign({},o,{side:-1}));
    return G.dist(t1.B0,c)>=G.dist(t2.B0,c)?t1:t2; };
  const given=[ axis(), ...point('A',A), ...point('M',M), ...point('N',N), ...seg3(M,N,'main') ];
  const steps=[];
  /* 1. положение MN */
  steps.push(STEP('Смотрим на прямую MN',{check:'Сравни у M и N координату уровня: если совпадает y — работаешь на π₂, если z — на π₁. Ошибся здесь — ошибёшься во всём остальном.',
    hint:'Сравни у концов M и N каждую из трёх координат. Какая из них одинакова?',
    principle:`Если у всех точек прямой одна координата постоянна, это прямая уровня. Постоянный y — фронталь: M′N′ ∥ оси x, а M″N″ показывает прямую без искажения. Постоянный z — горизонталь: M″N″ ∥ x, а M′N′ без искажения. На той проекции, где прямая натуральная, сохраняются её длины и прямые углы с ней.`,
    step:`${cName}<sub>M</sub> = ${cName}<sub>N</sub> = ${fmt(M[cK])}, значит MN — <b>${lvName}</b>. Запоминаем: на ${piP} длины вдоль MN и прямые углы с MN видны в натуральную величину. Дальше всё главное строим на ${piP}, а на ${piO} переносим линиями связи.`,
    full:`|MN| = ${fmt(dist(M,N))} мм — столько же на ${piP}.`},
    [ txt([Pp(M)[0]+8,Pp(M)[1]+(fr?-14:22)],'MN ∥ '+piP+' ('+lvName+')','aux') ]));
  /* 2. высота */
  steps.push(STEP('Высота AK ⟂ MN',{check:'На главной проекции угол между AK и MN — прямой (приложи угольник); K — на обеих проекциях MN, на одной линии связи.',
    hint:`Высота — перпендикуляр из A к MN. На какой проекции прямой угол виден без искажения?`,
    principle:`Теорема о проекции прямого угла: если одна сторона прямого угла параллельна плоскости проекций, угол проецируется в прямой. MN ∥ ${piP}, поэтому A${mP}K${mP} ⟂ M${mP}N${mP}. На ${piO} угол искажён — там перпендикуляр не строят.`,
    step:`Из A${mP} опускаем перпендикуляр на M${mP}N${mP} → K${mP}. По линии связи находим K${mO} на M${mO}N${mO} и соединяем A${mO}K${mO}.`,
    full:`K(${fmt(K[0])}; ${fmt(K[1])}; ${fmt(K[2])}). На чертеже A${mP}K${mP} = ${fmt(G.dist(Pp(A),Pp(K))/S)} мм — это проекция, длина высоты пока неизвестна.`},
    [ seg(Pp(A),Pp(K),'res'), sq(Pp(K),Pp(A),Pp(N),'res'), ...point('K',K,{k:'res'}), ...seg3(A,K,'res',{only:fr?'1':'2'}) ]));
  /* 3. натуральная величина высоты — треугольник на P */
  const tP=nv(A,K,PP,{A:'A',B:'K',r:26,la:'s'});
  tP.items.forEach(it=>{ if(it.t==='ang') it.l=aP; });
  steps.push(STEP(`Натуральная величина высоты и угол ${aP}`,{check:'Гипотенуза длиннее любого катета: h больше главной проекции AK. Второй катет — разность координат, а не длина второй проекции.',
    hint:'Высота AK — отрезок общего положения. Как найти его настоящую длину?',
    principle:`Натуральная величина отрезка — гипотенуза прямоугольного треугольника: один катет — проекция отрезка, второй — разность недостающей координаты его концов. На ${piP} недостающая координата — ${fr?'y (глубина: её разность берём с π₁)':'z (высота: её разность берём с π₂)'}.`,
    step:`На ${piP} строим треугольник: катет A${mP}K${mP}, второй катет Δ${fr?'y':'z'} — разность расстояний A${mO} и K${mO} до оси x — откладываем в K${mP} перпендикулярно. Гипотенуза A${mP}K₀ = h = |AK|. Угол при A${mP} — угол ${aP} высоты с ${piP}.`,
    full:`Δ${fr?'y':'z'} = ${fmt(Math.abs(A[fr?1:2]-K[fr?1:2]))} мм; h = √(${fmt(G.dist(Pp(A),Pp(K))/S)}² + ${fmt(Math.abs(A[fr?1:2]-K[fr?1:2]))}²) = ${fmt(h)} мм; ${aP} = ${fmt(fr?akA2:akA1)}°.`},
    [ ...tP.items ]));
  /* 4. совмещение: A₀ на перпендикуляре к MN в K, |K A₀| = h */
  const Kp=Pp(K), Ap=Pp(A), u=G.unit(G.sub(Ap,Kp)), A0=G.add(Kp,G.mul(u,h*S)), ep=G.unit(G.sub(Pp(N),Pp(M)));
  const arcK=(()=>{ const a0=Math.atan2(Ap[1]-Kp[1],Ap[0]-Kp[0]), ps=[]; for(let i=-8;i<=8;i++){ const t=a0+i*0.012; ps.push([Kp[0]+h*S*Math.cos(t),Kp[1]+h*S*Math.sin(t)]); } return poly(ps,'aux'); })();
  steps.push(STEP('Совмещение: точка A₀',{check:'A₀ — на перпендикуляре к MN через K, и |KA₀| равно h, а не длине проекции AK.',
    hint:`Чтобы увидеть фигуру без искажения, её плоскость надо «положить» параллельно ${piP}. Вокруг какой прямой удобно повернуть?`,
    principle:`Повернём плоскость фигуры вокруг MN, пока она не станет параллельной ${piP} (способ совмещения). Точки MN при этом стоят на месте, а A идёт по окружности в плоскости ⟂ MN — на ${piP} это прямая K${mP}A${mP} — и останавливается на расстоянии h от K. Так получаем A₀ — положение A после поворота. В совмещённом положении фигура на ${piP} видна в натуральную величину.`,
    step:`Циркулем берём h = A${mP}K₀ и из K${mP} засекаем прямую K${mP}A${mP} за точкой A${mP} → A₀.`,
    rec:`K${mP}A₀ ⟂ M${mP}N${mP}, |K${mP}A₀| = h`,
    full:`|K${mP}A₀| = h = ${fmt(h)} мм > |K${mP}A${mP}| = ${fmt(G.dist(Kp,Ap)/S)} мм — поэтому A₀ лежит за A${mP}.`},
    [ arcK, seg(Ap,A0,'aux'), pt(A0,'A₀',away(A0,cen(PP)),'aux') ]));
  /* 5. фигура в натуральную величину и точки на MN (на P) */
  const onMN=p3=>Pp(p3), B0=onMN(V.B), C0=onMN(V.C);
  let natItems=[], natTxt={}, D0=null;
  if(kind==='tri'){
    natTxt={hint:'Равносторонний треугольник: все углы по 60°. Под каким углом к MN выходят его боковые стороны из A₀?',
      principle:'В совмещённом положении треугольник A₀BC — натуральный: стороны A₀B и A₀C образуют с основанием BC углы 60°. Угол 60° строят угольником (или циркулем: равносторонний треугольник).',
      step:`Из A₀ проводим две прямые под 60° к M${mP}N${mP} — они пересекают M${mP}N${mP} в точках B${mP} и C${mP}. Это вершины на прямой MN: при совмещении они не двигались.`,
      full:`Сторона a = 2h/√3 = 2·${fmt(h)}/√3 = ${fmt(extra.a)} мм; |K${mP}B${mP}| = |K${mP}C${mP}| = a/2 = ${fmt(extra.a/2)} мм.`};
    natItems=[ seg(A0,B0,'aux'), seg(A0,C0,'aux'), ang(B0,C0,A0,'60°','aux',22) ]; }
  if(kind==='par'){
    natTxt={hint:'Боковая сторона AB = 60 мм. Где на MN лежит точка, удалённая от A₀ на 60 мм?',
      principle:'В совмещённом положении расстояния видны без искажения: B — точка MN на расстоянии 60 мм от A₀ (дуга радиусом 60). Основание BC = 100 мм лежит на MN — его откладываем прямо по M'+mP+'N'+mP+'. Задача имеет четыре решения (B по любую сторону от K, C — в любую сторону от B); строим одно, остальные — зеркальные.',
      step:`Дугой радиусом 60 мм из A₀ засекаем M${mP}N${mP} → B${mP} (берём точку со стороны M). От B${mP} откладываем по M${mP}N${mP} отрезок 100 мм в сторону N → C${mP}.`,
      full:`|K${mP}B${mP}| = √(60² − h²) = √(60² − ${fmt(h)}²) = ${fmt(extra.s)} мм; BC = 100 мм.`};
    const arcB=(()=>{ const c=A0, r=60*S, a0=Math.atan2(B0[1]-c[1],B0[0]-c[0]), ps=[]; for(let i=-6;i<=6;i++){ const t=a0+i*0.02; ps.push([c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)]); } return poly(ps,'aux'); })();
    natItems=[ arcB, seg(A0,B0,'aux') ]; }
  if(kind==='trap'){
    D0=G.add(A0,G.mul(ep,h*S));
    natTxt={hint:'Меньшее основание AD равно высоте и параллельно MN; диагонали по 120 мм. С чего начать в совмещённом положении?',
      principle:'В совмещённом положении трапеция натуральная. AD ∥ BC (∥ MN) и |AD| = h — значит D₀ лежит на прямой через A₀ ∥ MN на расстоянии h. Диагональ AC = 120 мм: C — точка MN на расстоянии 120 мм от A₀; так же B — на расстоянии 120 мм от D₀ (вторая диагональ). Трапеция получается равнобедренной сама: равные диагонали.',
      step:`Через A₀ проводим прямую ∥ M${mP}N${mP} и откладываем на ней h (циркулем, A${mP}K₀) → D₀. Дугой R120 из A₀ засекаем M${mP}N${mP} → C${mP} (со стороны D₀); дугой R120 из D₀ → B${mP} (со стороны A₀).`,
      full:`|A₀D₀| = h = ${fmt(h)} мм; |K${mP}C${mP}| = √(120² − ${fmt(h)}²) = ${fmt(extra.x+h)} мм; BC = h + 2·(${fmt(extra.x+h)} − ${fmt(h)}) = ${fmt(h+2*extra.x)} мм.`};
    const arc=(c,p)=>{ const r=120*S, a0=Math.atan2(p[1]-c[1],p[0]-c[0]), ps=[]; for(let i=-6;i<=6;i++){ const t=a0+i*0.012; ps.push([c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)]); } return poly(ps,'aux'); };
    natItems=[ seg(A0,D0,'aux'), pt(D0,'D₀',away(D0,cen(PP)),'aux'), arc(A0,C0), arc(D0,B0), seg(A0,C0,'aux'), seg(D0,B0,'aux') ]; }
  steps.push(STEP('Фигура в натуральную величину: точки на MN',Object.assign({check:'В совмещённом виде фигура должна быть «правильной»: углы и длины — как в условии (измерь транспортиром и линейкой).',rec:'B, C ∈ MN'},natTxt),
    [ ...natItems, ...point('B',V.B,{only:fr?'2':'1',k:'res'}), ...point('C',V.C,{only:fr?'2':'1',k:'res'}), seg(B0,C0,'res') ]));
  /* 6. вершины на P и на O */
  const dItems=kind==='tri'?[]:[ ln(Ap,G.add(Ap,ep),'aux',null,null,6,6), ...point('D',V.D,{only:fr?'2':'1',k:'res'}) ];
  const dItemsO=kind==='tri'?[]:[ ln(Po(A),G.add(Po(A),G.unit(G.sub(Po(N),Po(M)))),'aux',null,null,6,6), conn(Pp(V.D),Po(V.D)), pt(Po(V.D),'D'+mO,away(Po(V.D),cen(PO)),'res') ];
  steps.push(STEP('Возвращаем вершины на обе проекции',{check:'Каждая вершина на MN — на обеих проекциях MN и на одной линии связи; противоположные стороны параллельны на обеих проекциях.',
    hint:'Точки B и C лежат на MN — где их вторые проекции? А сторона AD параллельна MN — значит, и её проекции…',
    principle:`Точка прямой имеет проекции на одноимённых проекциях прямой и связана линией связи. Параллельные прямые имеют параллельные проекции. ${kind==='tri'?'':`Сторона AD ∥ MN, поэтому A${mP}D${mP} ∥ M${mP}N${mP} и A${mO}D${mO} ∥ M${mO}N${mO}; на ${piP} отрезок AD натуральный, как и MN.`}`,
    step:`Линиями связи переносим B${mP} и C${mP} на M${mO}N${mO} → B${mO}, C${mO}.`+(kind==='tri'?'':` Через A${mP} проводим прямую ∥ M${mP}N${mP} и откладываем на ней |AD| = ${kind==='par'?'100 мм':'h'} → D${mP}; через A${mO} — прямую ∥ M${mO}N${mO}, D${mO} — на ней по линии связи.`),
    full:names.slice(1).map(k=>`${k}(${fmt(V[k][0])}; ${fmt(V[k][1])}; ${fmt(V[k][2])})`).join(', ')+'.'},
    [ conn(B0,Po(V.B)), conn(C0,Po(V.C)), pt(Po(V.B),'B'+mO,away(Po(V.B),cen(PO)),'res'), pt(Po(V.C),'C'+mO,away(Po(V.C),cen(PO)),'res'), seg(Po(V.B),Po(V.C),'res'), ...dItems, ...dItemsO ]));
  /* 7. контур фигуры */
  const ring=names.concat([names[0]]), edges=[]; for(let i=0;i+1<ring.length;i++) edges.push([ring[i],ring[i+1]]);
  const title={tri:'Треугольник ABC',par:'Параллелограмм ABCD',trap:'Трапеция ABCD'}[kind];
  const checkTxt={tri:()=>`AB = AC = BC = ${fmt(dist(A,V.B))} мм`,par:()=>`AB = CD = ${fmt(dist(A,V.B))} мм, BC = AD = ${fmt(dist(V.B,V.C))} мм`,trap:()=>`AD = ${fmt(dist(A,V.D))} мм = h, AC = BD = ${fmt(dist(A,V.C))} мм, AB = CD = ${fmt(dist(A,V.B))} мм`}[kind]();
  steps.push(STEP(title,{check:'Сравни с условием: длины сторон в натуральную величину совпадают с заданными.',
    hint:'Соедини вершины по порядку на обеих проекциях.',
    principle:'Плоская фигура задаётся проекциями вершин; её стороны — отрезки между ними. Проверить размеры можно по совмещённому положению (натуральная величина).',
    step:`Соединяем ${names.join(', ')} по порядку на ${piP} и ${piO}.`,
    full:`Проверка расчётом: ${checkTxt}.`},
    edges.flatMap(([p,q])=>seg3(V[p],V[q],'res'))));
  /* 8. угол высоты со второй плоскостью */
  const tO=nv(A,K,PO,{A:'A',B:'K',r:26,la:'s'});
  tO.items.forEach(it=>{ if(it.t==='seg'&&it.l) it.l=null; if(it.t==='ang') it.l=aO; });
  steps.push(STEP(`Угол ${aO} высоты с ${piO}`,{check:'Угол — между проекцией высоты и гипотенузой, у вершины на проекции, а не у прямого угла.',
    hint:`Угол с ${piO} виден в треугольнике, построенном на ${piO}: катет — A${mO}K${mO}, второй катет — разность другой координаты.`,
    principle:`Тот же прямоугольный треугольник, но на ${piO}: второй катет Δ${fr?'z':'y'} (берём с ${piP}), угол при A${mO} — угол высоты с ${piO}.`,
    step:`Катет A${mO}K${mO}, второй катет Δ${fr?'z':'y'} — разность расстояний A${mP} и K${mP} до оси x — в K${mO} перпендикулярно. Угол при A${mO} — ${aO}.`,
    full:`Δ${fr?'z':'y'} = ${fmt(Math.abs(A[fr?2:1]-K[fr?2:1]))} мм; ${aO} = ${fmt(fr?akA1:akA2)}°.`},
    [ ...tO.items ]));
  /* 9. угол плоскости с P: AK — линия ската */
  steps.push(STEP(`Угол плоскости с ${piP}`,{check:'Этот угол плоскости равен углу высоты с той же плоскостью проекций — числа совпадают.',
    hint:`Какая прямая плоскости перпендикулярна ${lvName === 'фронталь'?'фронтали':'горизонтали'} MN? Мы её уже построили.`,
    principle:`Линия наибольшего ската плоскости к ${piP} перпендикулярна её ${fr?'фронталям':'горизонталям'}, и её угол с ${piP} равен углу самой плоскости. MN — ${lvName} плоскости фигуры, AK ⟂ MN.`,
    step:`AK — линия ската к ${piP}, значит угол плоскости с ${piP} равен ${aP} = ${fmt(fr?plA2:plA1)}° (шаг 3).`,
    full:`Проверка по нормали плоскости: cos ${aP} = |n<sub>${fr?'y':'z'}</sub>| = ${String(Math.round(Math.abs(nrm[fr?1:2])*100)/100).replace('.',',')} ⇒ ${aP} = ${fmt(fr?plA2:plA1)}°.`},
    [ txt(G.add(Ap,[-96,20]),aP+' пл. = '+fmt(fr?plA2:plA1)+'°','grn') ]));
  /* 10–11. угол плоскости с O: прямая уровня другого вида и линия ската к ней */
  /* прямая уровня второго вида — через M или N (берём ту, где точка P на AK ближе к отрезку AK), P = AK на уровне этой точки */
  const pick=['N','M'].map(nm=>{ const Q=nm==='N'?N:M, t=(Q[cO]-A[cO])/(K[cO]-A[cO]); return {nm,Q,t,P:add(A,mul(sub(K,A),t)),bad:Math.abs(t-0.5)}; }).filter(o=>Number.isFinite(o.t)).sort((a,b)=>a.bad-b.bad)[0];
  if(!pick) return {why:'AK — сама прямая уровня второго вида (частный случай не реализован)'};
  const Pl=pick.P, Qn=pick.Q, dL=unit(sub(Pl,Qn)), Qf=add(Qn,mul(dL,dot(sub(K,Qn),dL)));
  const lvO=fr?'горизонталь h':'фронталь f', lvl=fr?'h':'f';
  steps.push(STEP(`${fr?'Горизонталь':'Фронталь'} плоскости`,{check:'Прямая уровня на одной проекции ∥ оси x, а её точки — на сторонах фигуры по линиям связи.',
    hint:`Для угла с ${piO} нужна ${fr?'горизонталь':'фронталь'} плоскости. Через ${pick.nm}${mP} проведи прямую ∥ x — где она встретит A${mP}K${mP}?`,
    principle:`Линия ската к ${piO} перпендикулярна ${fr?'горизонтали':'фронтали'} плоскости, поэтому сначала строим ${fr?'горизонталь':'фронталь'}: на ${piP} её проекция ∥ x${fr?'':'' }.`,
    step:`${lvO} через ${pick.nm}: через ${pick.nm}${mP} проводим ${lvl}${mP} ∥ x до пересечения с A${mP}K${mP} → P${mP}; P${mO} — по линии связи на A${mO}K${mO}. ${lvl}${mO} = ${pick.nm}${mO}P${mO}.`,
    rec:`${pick.nm} ∈ ${lvl}, ${lvl}${mP} ∥ x; P = ${lvl} ∩ AK`,
    full:`P(${fmt(Pl[0])}; ${fmt(Pl[1])}; ${fmt(Pl[2])}).`},
    [ seg(Pp(Qn),Pp(Pl),'aux'), ...point('P',Pl,{k:'aux'}), seg(Po(Qn),Po(Pl),'aux'), ...(pick.t<0||pick.t>1?seg3(A,Pl,'aux'):[]) ]));
  const tQ=nv(K,Qf,PO,{A:'K',B:'Q',r:22,la:'s'});
  tQ.items.forEach(it=>{ if(it.t==='seg'&&it.l) it.l=null; if(it.t==='ang') it.l=aO+' пл.='+fmt(fr?plA1:plA2)+'°'; });
  steps.push(STEP(`Линия ската к ${piO} и угол ${aO} плоскости`,{check:'Линия ската на «своей» проекции ⟂ прямой уровня; угол меньше 90° и не больше угла любой другой прямой плоскости с этой плоскостью проекций.',
    hint:`Из K опусти перпендикуляр на ${lvl}${mO} — на ${piO} прямой угол не исказится.`,
    principle:`${fr?'Горизонталь ∥ π₁':'Фронталь ∥ π₂'} ⇒ прямой угол с ней виден на ${piO} без искажения. Перпендикуляр KQ к ней — линия наибольшего ската; её угол с ${piO} равен углу плоскости с ${piO}.`,
    step:`K${mO}Q${mO} ⟂ ${lvl}${mO} → Q${mO}; Q${mP} — по линии связи на ${lvl}${mP}. Треугольник на ${piO}: катет K${mO}Q${mO}, второй катет Δ${fr?'z':'y'} — расстояние от K${mP} до ${lvl}${mP}. Угол при K${mO} — ${aO} плоскости.`,
    rec:`K${mO}Q${mO} ⟂ ${lvl}${mO}; Q ∈ ${lvl}`,
    full:`Δ${fr?'z':'y'} = ${fmt(Math.abs(K[cO]-Qf[cO]))} мм; ${aO} плоскости = ${fmt(fr?plA1:plA2)}°. Проверка по нормали: cos ${aO} = |n<sub>${fr?'z':'y'}</sub>| = ${String(Math.round(Math.abs(nrm[fr?2:1])*100)/100).replace('.',',')} ⇒ ${fmt(fr?plA1:plA2)}°.`},
    [ sq(Po(Qf),Po(K),Po(Qn),'aux'), seg(Po(K),Po(Qf),'grn'), seg(Pp(K),Pp(Qf),'grn'), ...point('Q',Qf,{k:'aux'}), ...tQ.items ]));
  const figName={tri:'треугольника',par:'параллелограмма',trap:'трапеции'}[kind];
  const ans=`${kind==='tri'?`Сторона <b>a = ${fmt(extra.a)} мм</b>, высота`:'Высота'} <b>h = ${fmt(h)} мм</b>.<br>Высота AK: α = ${fmt(akA1)}° (к π₁), β = ${fmt(akA2)}° (к π₂).<br>Плоскость ${figName}: α = ${fmt(plA1)}°, β = ${fmt(plA2)}°.<br>`+names.slice(1).map(k=>`${k}(${fmt(V[k][0])}; ${fmt(V[k][1])}; ${fmt(V[k][2])})`).join(', ')+'.';
  const task={ n:'ДЗ №1 · вариант '+n, q:'<b>ДЗ №1 · вариант '+n+'.</b> '+src.text(n),
    data:table(['','x','y','z'],[['A',...A],['M',...M],['N',...N]])+(kind==='par'?'<p class="hw-dim">BC = 100 мм, AB = 60 мм.</p>':kind==='trap'?'<p class="hw-dim">AD = h, диагонали AC = BD = 120 мм.</p>':''),
    intro:`Данные — из таблицы задания, вариант ${n}. MN — ${lvName}: главное строим на ${piP}. Каждое число посчитано по этим данным; ответ проверен условием задачи.`,
    given, steps, ans };
  /* сертификат: условие задачи на найденных вершинах */
  const cert=[], eq=(a,b,w)=>{ if(!(Math.abs(a-b)<1e-6)) cert.push(w+': '+a+' ≠ '+b); };
  eq(offLine(V.B,M,N),0,'B на MN'); eq(offLine(V.C,M,N),0,'C на MN');
  if(kind==='tri'){ eq(dist(A,V.B),dist(V.B,V.C),'AB = BC'); eq(dist(A,V.C),dist(V.B,V.C),'AC = BC'); }
  if(kind==='par'){ eq(dist(V.B,V.C),100,'BC'); eq(dist(A,V.B),60,'AB'); eq(dist(add(A,sub(V.C,V.B)),V.D),0,'AD = BC (вектором)'); }
  if(kind==='trap'){ eq(len(cross(sub(V.D,A),sub(V.C,V.B))),0,'AD ∥ BC'); eq(dist(A,V.D),h,'AD = h'); eq(dist(A,V.C),120,'AC'); eq(dist(V.B,V.D),120,'BD'); eq(dist(A,V.B),dist(V.C,V.D),'AB = CD');
    if(!(dist(V.B,V.C)>dist(A,V.D))) cert.push('BC не большее основание'); }
  eq(plA1+0,deg(Math.acos(Math.abs(unit(cross(sub(V.B,A),sub(V.C,A)))[2]))),'угол α плоскости');
  return {task,answers:{h,akA1,akA2,plA1,plA2,V},cert};
}
DZR.def('ng1',{ solve:(n,D,src)=>build(n,D,src),
  /* разобранные примеры — по варианту каждого типа из таблицы */
  examples:{tri:()=>DZR.solve('ng1',1).task,par:()=>DZR.solve('ng1',11).task,trap:()=>DZR.solve('ng1',21).task} });
})();
