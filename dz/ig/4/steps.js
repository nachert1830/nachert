/* ═══════════ Инженерная графика · Задание №4 · решение по шагам: у каждой линии — происхождение ═══════════
   Всё считается из 3D-модели варианта (models.js): виды строит ядро IG3, каждая линия вида помнит свои концы в
   пространстве (a3, b3). Отсюда характерные точки: вершины тела, точки выреза K, точки фигур сечения — у каждой
   три проекции (″ — главный вид, ′ — вид сверху, ‴ — вид слева), сквозной номер и способ построения.

   Порядок (docs/IG4-STEPS-PROMPT.md, method.js): дано → анализ формы → оси и габарит вида слева → тело по рёбрам →
   точки K на главном виде → на виде сверху → на виде слева → линии выреза → стираем лишнее → профильный разрез
   (фигура сечения, половина вида) → разрез А–А (фигура, половина вида + половина разреза) → размеры → лист.

   Подключается из IGUI.buildBlock: если у модели есть outer и kp (ДЗ 4), шаги строит IG4S.block. */
window.IG4S=(function(){
const W=900, S=420, k0=S/W, X0=20, Y0=16, TOPY=Y0+S-20, PW=2*S+2*X0, PH=TOPY+S+6;
/* палитра — проверенная tests/colors.js: тушь, прошлые шаги, посредники MED, красный — стираем */
const INK='#15161a', PAST='#a3a9b4', RED='#c9302c', C_BODY='#117788', C_K='#aa2266', C_SEC='#6633dd', C_AA='#3388ee';
const f=v=>Math.round(v*10)/10, sx=v=>(v<-0.05?'−':'')+mm(v), mm=v=>String(Math.round(Math.abs(v)*10)/10).replace('.',','), esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const DR=(md,v,off,bnd)=>IG3.drawing(md,v,W,off||0,bnd||0);

/* ── линии вида → цепочки → отрезки и кривые ──
   ядро отдаёт линию кусочками по 0,4 мм; сшиваем их в цепочки (с 3D-концами), упрощаем (Дуглас — Пекер, 0,6 px)
   и делим по изломам: прямые участки — отрезки (концы — характерные точки), плавные — кривые (точки через равные доли) */
function chainsOf(S){ const key=p=>Math.round(p[0]*2)+','+Math.round(p[1]*2), used=new Uint8Array(S.length), G=new Map(), out=[];
  S.forEach((s,i)=>[0,1].forEach(e=>{ const k=key(e?s.b:s.a); if(!G.has(k)) G.set(k,[]); G.get(k).push([i,e]); }));
  for(let i=0;i<S.length;i++){ if(used[i]) continue; used[i]=1; const L=[{p:S[i].a,q:S[i].a3},{p:S[i].b,q:S[i].b3}];
    for(let side=0;side<2;side++){ for(;;){ const end=L[L.length-1].p, pr=L[L.length-2].p, dx=end[0]-pr[0], dy=end[1]-pr[1], dl=Math.hypot(dx,dy)||1; let best=null, bs=-2;
        const [cx,cy]=key(end).split(',').map(Number);
        for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++) (G.get((cx+a)+','+(cy+b))||[]).forEach(([j,e])=>{ if(used[j]) return; const s=S[j], A=e?s.b:s.a, O=e?s.a:s.b;
          if(Math.hypot(A[0]-end[0],A[1]-end[1])>0.8) return; const l=Math.hypot(O[0]-A[0],O[1]-A[1])||1, c=((O[0]-A[0])*dx+(O[1]-A[1])*dy)/l/dl; if(c>bs){ bs=c; best=[j,e]; } });
        if(!best||bs<0.3) break; used[best[0]]=1; const s=S[best[0]]; L.push(best[1]?{p:s.a,q:s.a3}:{p:s.b,q:s.b3}); } L.reverse(); }
    out.push(L); }
  return out; }
function dp(L,a,b,tol){ let mx=0, mi=-1; const A=L[a].p, B=L[b].p, ux=B[0]-A[0], uy=B[1]-A[1], l=Math.hypot(ux,uy)||1e-9;
  for(let k=a+1;k<b;k++){ const P=L[k].p, d=Math.abs((P[0]-A[0])*uy-(P[1]-A[1])*ux)/l; if(d>mx){ mx=d; mi=k; } }
  return mx>tol?dp(L,a,mi,tol).concat(dp(L,mi,b,tol).slice(1)):[a,b]; }
function elements(lines){ const out=[];
  [0,1].forEach(h=>chainsOf(lines.filter(s=>!!s.h===!!h)).forEach(L=>{ if(L.length<2) return;
    const ix=dp(L,0,L.length-1,0.6), V=ix.map(k=>L[k]), turn=j=>{ const a=V[j-1].p, b=V[j].p, c=V[j+1].p, u=[b[0]-a[0],b[1]-a[1]], v=[c[0]-b[0],c[1]-b[1]], l=Math.hypot(...u)*Math.hypot(...v)||1; return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/l)))*180/Math.PI; };
    const cut=[0]; for(let j=1;j<V.length-1;j++) if(turn(j)>12) cut.push(j); cut.push(V.length-1);
    for(let c=0;c+1<cut.length;c++){ const a=cut[c], b=cut[c+1], path=L.slice(ix[a],ix[b]+1).map(o=>o.p);
      if(Math.hypot(V[b].p[0]-V[a].p[0],V[b].p[1]-V[a].p[1])<1.5&&b-a<2) continue;
      if(b-a>=3){ let ln=0; for(let j=a;j<b;j++) ln+=Math.hypot(V[j+1].p[0]-V[j].p[0],V[j+1].p[1]-V[j].p[1]); const n=Math.min(b-a,Math.max(2,Math.min(4,Math.round(ln/70)))), key=[]; for(let t=0;t<=n;t++) key.push(V[a+Math.round(t*(b-a)/n)].q);   /* кривая: концы и точки через равные доли */
        out.push({h,curve:1,key,path}); }
      else for(let j=a;j<b;j++){ if(Math.hypot(V[j+1].p[0]-V[j].p[0],V[j+1].p[1]-V[j].p[1])<1.5) continue; out.push({h,curve:0,key:[V[j].q,V[j+1].q],path:L.slice(ix[j],ix[j+1]+1).map(o=>o.p)}); } } }));
  return out; }
/* кусочки A, которых нет среди B (по картинке: та же видимость, лежат на линии B) */
function diff(A,B){ const G=new Map(), cell=3, K=(x,y)=>Math.floor(x/cell)+','+Math.floor(y/cell);
  B.forEach(s=>[s.a,s.b,[(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2]].forEach(p=>{ const k=K(p[0],p[1]); if(!G.has(k)) G.set(k,[]); G.get(k).push(s); }));
  const on=(p,h)=>{ for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) for(const q of G.get((Math.floor(p[0]/cell)+dx)+','+(Math.floor(p[1]/cell)+dy))||[]){ if(!!q.h!==!!h) continue;
      const ux=q.b[0]-q.a[0], uy=q.b[1]-q.a[1], l=Math.hypot(ux,uy)||1e-9, u=((p[0]-q.a[0])*ux+(p[1]-q.a[1])*uy)/(l*l); if(u>-0.05&&u<1.05&&Math.abs((p[0]-q.a[0])*uy-(p[1]-q.a[1])*ux)/l<0.7) return true; } return false; };
  return A.filter(s=>!on([(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2],s.h)); }

/* фигура сечения плоскостью (O, U, V) — контуры из модели (IG3.secShape), обрезанные половиной keep(p) ≤ 0, кусочками для elements() */
function secPieces(model,O,U,V,box,keep,px){ const R=IG3.secShape(model.tree,O,U,V,box,0.15), out=[];
  const at=(u,v)=>[O[0]+U[0]*u+V[0]*v,O[1]+U[1]*u+V[1]*v,O[2]+U[2]*u+V[2]*v];
  R.all.forEach(loop=>{ let P=loop.map(q=>at(q[0],q[1]));
    if(keep){ const Q=[]; for(let i=0;i<P.length;i++){ const a=P[i], c=P[(i+1)%P.length], ga=keep(a), gc=keep(c);
        if(ga<=0) Q.push(a); if((ga<0&&gc>0)||(ga>0&&gc<0)){ const t=ga/(ga-gc); Q.push([a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t,a[2]+(c[2]-a[2])*t]); } } P=Q; }
    for(let i=0;i<P.length;i++){ const a=P[i], c=P[(i+1)%P.length]; out.push({a:px(a),b:px(c),a3:a,b3:c,h:0}); } });
  return out; }
/* ── план решения варианта ── */
function plan(model){ if(model._ig4s) return model._ig4s;
  const O={tree:model.outer,box:model.box}, sp=IGUI.igSpec(model), b=model.box, z0=b[0][2], z1=b[1][2], hz=model.hz&&model.hz.z;
  const D={F:DR(model,'front0'),T:DR(model,'top'),L:DR(model,'left0'),OL:DR(O,'left0'),OT:DR(O,'top'),GT:model.givenTop?DR({tree:model.givenTop,box:b},'top'):DR(model,'top')};
  const Jo=IG3.jc(model.outer), Jm=IG3.jc(model.tree), E3=[];   /* рёбра тела в пространстве — для «точка на ребре» */
  [D.OL,D.OT,DR(O,'front0')].forEach(d=>elements(d.lines.filter(s=>s.e)).forEach(e=>{ if(!e.curve) E3.push(e.key); }));
  const onEdge=p=>E3.find(([a,c])=>{ const u=[c[0]-a[0],c[1]-a[1],c[2]-a[2]], l2=u[0]*u[0]+u[1]*u[1]+u[2]*u[2]||1e-9, t=((p[0]-a[0])*u[0]+(p[1]-a[1])*u[1]+(p[2]-a[2])*u[2])/l2; if(t<-0.01||t>1.01) return false;
      return Math.hypot(a[0]+u[0]*t-p[0],a[1]+u[1]*t-p[1],a[2]+u[2]*t-p[2])<0.35; });
  const grad=p=>{ const e=0.02, g=[0,1,2].map(i=>{ const a=p.slice(), c=p.slice(); a[i]+=e; c[i]-=e; return (Jo(...a)-Jo(...c))/(2*e); }), l=Math.hypot(...g)||1; return g.map(v=>v/l); };
  const onOuter=p=>Math.abs(Jo(...p))<0.05;
  /* реестр точек: одна точка пространства — один номер на всех шагах */
  const R=[], reg=p=>{ let o=R.find(q=>Math.hypot(q.p[0]-p[0],q.p[1]-p[1],q.p[2]-p[2])<0.45); if(!o){ o={n:R.length+1,p:p.map(v=>Math.abs(v-Math.round(v))<0.16?Math.round(v):Math.round(v*10)/10)}; R.push(o); } return o; };
  const uniq=(P,pr)=>{ const out=[]; P.forEach(p=>{ if(!out.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<0.45)) out.push(p); }); return out; };
  let aEl0=null; const ST=[], tName=model.title||'Тело', KA=model.kp||[], K=KA[0]||[], multi=KA.length>1;
  const kName=n=>({3:'треугольник',4:'четырёхугольник',5:'пятиугольник',6:'шестиугольник'}[n]||n+'-угольник');
  const isTrap=K.length===4&&(Math.abs(K[0][1]-K[1][1])<0.1&&Math.abs(K[2][1]-K[3][1])<0.1);
  const isRect=isTrap&&Math.abs(K[0][0]-K[3][0])<0.1&&Math.abs(K[1][0]-K[2][0])<0.1;
  const titleOf=K=>{ const tr=K.length===4&&Math.abs(K[0][1]-K[1][1])<0.1&&Math.abs(K[2][1]-K[3][1])<0.1, rc=tr&&Math.abs(K[0][0]-K[3][0])<0.1&&Math.abs(K[1][0]-K[2][0])<0.1; return rc?'прямоугольник':tr?'трапеция':kName(K.length); };
  /* шар: контуры K обрезаны по сфере — называем их с пределами, иначе «прямоугольник и прямоугольник» не различить */
  const spanOf=K=>{ const R0=model.sph?model.sph.R:1e9, xs=K.map(p=>Math.max(-R0,Math.min(R0,p[0]))), zs=K.map(p=>Math.max(-R0,Math.min(R0,p[1]))); return ' (x от '+sx(Math.min(...xs))+' до '+sx(Math.max(...xs))+', z от '+sx(Math.min(...zs))+' до '+sx(Math.max(...zs))+')'; };
  const kName2=K=>K.length>12?'дуга (цилиндр)':titleOf(K);
  const kTitle=model.sph?KA.map(k=>kName2(k)+spanOf(k)).join('; '):multi?KA.map(titleOf).join(' и '):titleOf(K);
  const zs=[].concat(...KA.map(k=>k.map(p=>p[1]))), kz0=Math.min(...zs), kz1=Math.max(...zs);
  const elK=els=>els;   /* для читаемости */

  /* 1. Дано */
  ST.push({id:'given',t:'Дано и задача',d:(model.sph?'Даны главный вид (на нём профиль отверстия K) и вид сверху':model.givenTop?'Дан главный вид и вид сверху тела без выреза K':'Даны главный вид и вид сверху')+'. Построить вид слева, профильный разрез, горизонтальный разрез А–А и нанести размеры.',
    more:`<p>${esc(tName)}: высота ${mm(z1-z0)} мм. ${multi?'Сквозные вырезы K заданы на главном виде — '+kTitle:'Сквозной вырез K задан на главном виде — '+kTitle}${K.length?' от z = '+mm(kz0)+' до z = '+mm(kz1)+' мм':''}.</p>`+(model.givenTop?'<p>На виде сверху выреза K в задании нет — его линии появятся по ходу построения, как и весь вид слева.</p>':'')+'<p>Вид слева строим справа от главного вида, на одной высоте с ним; вид сверху — под главным видом. Это и есть проекционная связь.</p>',
    F:{k:'given'},T:{k:'given'},L:{k:'none'}});
  /* 2. Анализ формы */
  { const kvOf=K=>K.map(p=>'('+(p[0]<0?'−':'')+mm(p[0])+'; '+mm(p[1])+')').join(', ');
    ST.push({id:'anal',t:'Анализ формы',d:esc(tName)+(multi?' и '+(['','','два','три','четыре','пять','шесть'][KA.length]||KA.length)+' сквозных выреза K — '+kTitle:' и вырез K — '+kTitle)+(model.sph?' на главном виде (сквозные вдоль глубины). Каждая сторона K — плоскость уровня: шар она режет по окружности.':' на главном виде, протянутые насквозь от передней поверхности до задней.'),
      more:`<p><b>Тело:</b> ${esc(tName)} — габарит ${mm(b[1][0]-b[0][0])} × ${mm(b[1][1]-b[0][1])} × ${mm(z1-z0)} мм (ширина × глубина × высота).</p>`
        +KA.map((k,i)=>`<p><b>Вырез K${multi?' '+(i+1):''}</b> — ${titleOf(k)} с вершинами ${kvOf(k)} (x; z, мм).</p>`).join('')+`<p> Каждая сторона K — плоскость, перпендикулярная фронтальной плоскости π₂: на главном виде она видна линией, поэтому контур K на главном виде уже готов. На виде сверху и слева линию выреза строим по точкам — там, где эти плоскости режут грани и рёбра тела.</p>`
        +'<p>Отсюда план: сначала тело целиком на виде слева, потом характерные точки K на трёх видах, потом разрезы и размеры.</p>',
      F:{k:'given',kHL:1},T:{k:'given'},L:{k:'none'}}); }
  /* 3. Оси и габарит вида слева */
  const yb0=b[0][1], yb1=b[1][1];
  ST.push({id:'axis',t:'Ось и габарит вида слева',d:'Проводим ось симметрии вида слева, верх и низ — горизонтальными линиями связи с главного вида; ширина вида слева равна глубине вида сверху.',
    more:`<p>Ось вида слева — штрихпунктирная, справа от главного вида на свободном месте. Верх тела z = ${mm(z1)}, низ z = ${mm(z0)} — переносим горизонтальными линиями связи.</p><p>Глубину берём на виде сверху от горизонтальной оси: вперёд ${mm(-yb0)} мм, назад ${mm(yb1)} мм — те же отрезки откладываем от оси вида слева (засечки — равные отрезки).</p>`,
    F:{k:'given'},T:{k:'given'},L:{k:'axis'},gab:{y0:yb0,y1:yb1,z0,z1}});
  /* 4. Тело без выреза — по рёбрам и очерку */
  const bodyEl=elements(D.OL.lines), bodyPts=[];
  { const P=[]; bodyEl.forEach(e=>e.key.forEach(p=>P.push(p)));
    /* на виде слева совпадающие точки (одинаковые y, z) — одна; берём ближнюю к нам (наименьшая x) */
    const byL=[]; P.forEach(p=>{ const q=byL.find(o=>Math.abs(o[1]-p[1])<0.5&&Math.abs(o[2]-p[2])<0.5); if(!q) byL.push(p); else if(p[0]<q[0]){ q[0]=p[0]; } });
    byL.sort((p,q)=>q[2]-p[2]||p[1]-q[1]).forEach(p=>bodyPts.push(reg(p))); }
  /* группы поровну: 16 точек при пределе 14 — 8 + 8, а не 14 + 2 */
  const chunk=(A,n)=>{ const k=Math.max(1,Math.ceil(A.length/n)), m=Math.ceil(A.length/k), out=[]; for(let i=0;i<A.length;i+=m) out.push(A.slice(i,i+m)); return out; };
  const ptT=o=>{ const p=o.p; return o.n+' ('+'z = '+mm(p[2])+', глубина '+(Math.abs(p[1])<0.3?'0 — на оси':mm(p[1])+' мм '+(p[1]<0?'вперёд':'назад'))+')'; };
  const BG=chunk(bodyPts,12);
  BG.forEach((g,i)=>{ const last=i===BG.length-1;
    ST.push({id:'body',t:'Тело на виде слева'+(BG.length>1?' ('+(i+1)+' из '+BG.length+')':''),d:model.sph?'Шар на любом виде — окружность того же диаметра с центром на оси; полость — штриховая окружность. Отверстия, данные на виде сверху, переносим по точкам: высота — горизонтальной линией связи с главного вида, глубина — с вида сверху от оси (засечки).':'Каждая вершина: высота — горизонтальной линией связи с главного вида, глубина — с вида сверху от оси (засечки). Соединяем точки по рёбрам.',
      more:'<p>Точки '+g.map(ptT).join('; ')+'.</p><p>Для точки k: k″ на главном виде даёт высоту, k′ на виде сверху — глубину (расстояние от горизонтальной оси). Откладываем ту же глубину от оси вида слева — получаем k‴.</p>'+(last?'<p>Соединяем точки так же, как соединены рёбра тела. Видимые рёбра — сплошной основной линией, невидимые — штриховой.</p>':''),
      F:{k:'given'},T:{k:'given'},L:{k:'body',cur:last?bodyEl:[]},pts:g.map(o=>({o,col:C_BODY,how:'FTL'}))}); });
  /* 5–7. Вырез K: характерные точки */
  const kL=diff(D.L.lines,D.OL.lines), kT=diff(D.T.lines,D.GT.lines), eraseL=diff(D.OL.lines,D.L.lines), eraseT=diff(D.GT.lines,D.T.lines);
  const kLe=elements(kL), kTe=elements(kT), eLe=elements(eraseL), eTe=elements(eraseT);
  /* концы обрезанных рёбер — тоже точки выреза: там плоскость K пересекла ребро; берём только те, что остались на итоговом виде */
  const Lend=elements(D.L.lines), Tend=elements(D.T.lines), endsOf=E=>[].concat(...E.map(e=>[e.key[0],e.key[e.key.length-1]]));
  const near=(p,E,v)=>E.some(e=>e.key.some(q=>v==='L'?Math.hypot(q[1]-p[1],q[2]-p[2])<0.6:Math.hypot(q[0]-p[0],q[1]-p[1])<0.6));
  const cutEnds=[].concat(endsOf(eLe).filter(p=>near(p,Lend,'L')&&!bodyPts.some(o=>Math.hypot(o.p[1]-p[1],o.p[2]-p[2])<0.6)),endsOf(eTe).filter(p=>near(p,Tend,'T')));
  let KP=uniq([].concat(...kLe.map(e=>e.key),...kTe.map(e=>e.key),cutEnds));
  /* порядок обхода контура K на главном виде: по углу вокруг центра K, спереди — раньше, чем сзади */
  const segD=(p,a,c)=>{ const ux=c[0]-a[0], uz=c[1]-a[1], l2=ux*ux+uz*uz||1e-9, t=Math.max(0,Math.min(1,((p[0]-a[0])*ux+(p[2]-a[1])*uz)/l2)); return Math.hypot(a[0]+ux*t-p[0],a[1]+uz*t-p[2]); };
  const polyOf=p=>{ let bi=0, bd=1e9; KA.forEach((k,i)=>k.forEach((v,j)=>{ const d=segD(p,v,k[(j+1)%k.length]); if(d<bd){ bd=d; bi=i; } })); return bi; };
  const ctr=k=>k.length?[k.reduce((s,p)=>s+p[0],0)/k.length,k.reduce((s,p)=>s+p[1],0)/k.length]:[0,(z0+z1)/2];
  KP.sort((p,q)=>{ const ip=polyOf(p), iq=polyOf(q); if(ip!==iq) return ip-iq; const kc=ctr(KA[ip]||[]), a=Math.atan2(p[2]-kc[1],p[0]-kc[0]), c=Math.atan2(q[2]-kc[1],q[0]-kc[0]); return Math.abs(a-c)>0.02?c-a:p[1]-q[1]; });
  const kPts=KP.map(reg);
  /* как найти точку на виде сверху: на ребре; грань ⟂ π₁ (её след на виде сверху — линия); грань ⟂ π₃ (линия на виде слева); иначе — параллель; внутри тела — конкурирующая точка */
  kPts.forEach(o=>{ const p=o.p;
    const isV=[].concat(...KA).some(v=>Math.abs(v[0]-p[0])<0.4&&Math.abs(v[1]-p[2])<0.4);
    o.kv=isV;
    if(!onOuter(p)){ const q=kPts.find(r=>r!==o&&onOuter(r.p)&&Math.abs(r.p[1]-p[1])<0.4&&r.p[2]>p[2]+0.5)||kPts.find(r=>r!==o&&Math.abs(r.p[1]-p[1])<0.4&&r.p[2]>p[2]+0.5); o.how='vis'; o.by=q; return; }
    const e=onEdge(p); if(e){ o.how='edge'; o.edge=e; return; }
    const g=grad(p); o.g=g;
    if(Math.abs(g[2])<0.03){ o.how='T'; return; }
    if(Math.abs(g[0])<0.03){ o.how='L'; return; }
    o.how='P'; });
  const where=o=>{ const p=o.p, side=p[1]<-0.3?'передней':p[1]>0.3?'задней':'';
    if(o.how==='vis') return 'точка на ребре выреза внутри тела, где оно уходит под '+(o.by?'край выреза над ней (точка '+o.by.n+')':'материал')+': здесь меняется видимость';
    const t=o.kv?'вершина выреза K':'сторона выреза K';
    if(o.how==='edge') return t+' на ребре тела';
    if(o.how==='T') return t+' на '+(side?side+' ':'')+'поверхности, перпендикулярной π₁ (на виде сверху она — линия)';
    if(o.how==='L') return t+' на '+(side?side+' ':'')+'грани, перпендикулярной π₃ (на виде слева она — линия)';
    return t+' на '+(side?side+' ':'')+'поверхности тела'; };
  /* ── шаги выреза K — по граням (стандарт docs/IG-STEPS-STANDARD.md): один шаг — одна грань K: её точки, её линии на виде
     сверху и слева и текст про эту грань (какая плоскость, чем режет тело). Короткие стороны подряд (дуга контура) — одна
     цилиндрическая грань. Грань без точек (сторона K вне тела) пропускается. */
  const FACES=[]; KA.forEach((K0,ip)=>{ const n=K0.length, side=j=>[K0[j],K0[(j+1)%n]], len=j=>{ const [a,c]=side(j); return Math.hypot(c[0]-a[0],c[1]-a[1]); };
    let j0=0; while(j0<n&&len(j0)<8&&len((j0+n-1)%n)<8) j0++; if(j0===n) j0=0;   /* начать не с середины дуги */
    for(let t=0;t<n;){ const j=(j0+t)%n; if(len(j)>=8){ FACES.push({ip,S:[side(j)],arc:false}); t++; continue; }
      const S0=[]; while(t<n&&len((j0+t)%n)<8){ S0.push(side((j0+t)%n)); t++; } FACES.push({ip,S:S0,arc:true}); } });
  const onFace=(F0,p,tol)=>F0.S.some(([a,c])=>segD(p,a,c)<(tol||0.45));
  const inPlane=(F0,p)=>F0.arc?onFace(F0,p,0.8):(()=>{ const [a,c]=F0.S[0], ux=c[0]-a[0], uz=c[1]-a[1], l=Math.hypot(ux,uz)||1; return Math.abs((p[0]-a[0])*uz-(p[2]-a[1])*ux)/l<0.5; })();
  const SPH=model.sph, fn=v=>mm(v), rr=(R,d)=>Math.sqrt(Math.max(0,R*R-d*d));
  const faceTxt=F0=>{ if(F0.arc){ const A=F0.S[0][0], B=F0.S[F0.S.length>>1][0], C=F0.S[F0.S.length-1][1], dd=2*(A[0]*(B[1]-C[1])+B[0]*(C[1]-A[1])+C[0]*(A[1]-B[1]))||1e-9, q2=v=>v[0]*v[0]+v[1]*v[1],
        c=[(q2(A)*(B[1]-C[1])+q2(B)*(C[1]-A[1])+q2(C)*(A[1]-B[1]))/dd,(q2(A)*(C[0]-B[0])+q2(B)*(A[0]-C[0])+q2(C)*(B[0]-A[0]))/dd];   /* центр дуги — по трём точкам */
      return {t:'цилиндрическая поверхность K',d:'Дуга контура K — цилиндр, перпендикулярный π₂: на главном виде он — эта дуга, на виде сверху и виде слева его линии строим по точкам.'+(SPH&&Math.hypot(c[0],c[1])<0.5?' Ось цилиндра проходит через центр шара — цилиндр выходит на сферу по окружности, на виде сверху и слева это отрезок.':'')}; }
    const [a,c]=F0.S[0], vx=Math.abs(a[0]-c[0])<0.05, hz=Math.abs(a[1]-c[1])<0.05;
    if(vx){ const d=a[0]; return {t:'грань x = '+sx(d),d:'Грань x = '+sx(d)+' — профильная плоскость: на виде сверху и на главном виде она — прямая, на виде слева видна в натуральную величину.'+(SPH?' Шар она режет по окружности радиуса √('+fn(SPH.R)+'² − '+fn(Math.abs(d))+'²) = '+fn(rr(SPH.R,d))+(SPH.r&&Math.abs(d)<SPH.r?', полость — радиуса '+fn(rr(SPH.r,d)):', полость не задевает')+': на виде слева — дуги этих радиусов из центра.':'')}; }
    if(hz){ const d=a[1]; return {t:'грань z = '+sx(d),d:'Грань z = '+sx(d)+' — горизонтальная плоскость: на главном виде и виде слева она — прямая на высоте '+sx(d)+', на виде сверху видна в натуральную величину.'+(SPH?' Шар она режет по окружности радиуса √('+fn(SPH.R)+'² − '+fn(Math.abs(d))+'²) = '+fn(rr(SPH.R,d))+(SPH.r&&Math.abs(d)<SPH.r?', полость — радиуса '+fn(rr(SPH.r,d)):', полость не задевает')+': на виде сверху — дуги этих радиусов из центра.':'')}; }
    return {t:'наклонная грань K',d:'Грань ⟂ π₂: на главном виде она — прямая (сторона K), на виде сверху и слева — фигура, которую строим по точкам.'}; };
  /* шар: дугу среза проводят циркулем из центра известным радиусом — точки нужны только на её концах */
  const ENDS=endsOf(kLe.concat(kTe)), isEnd=p=>!SPH||ENDS.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<0.45);
  kPts.forEach(o=>{ if(!isEnd(o.p)) o.fg=1; });
  /* конец линии грани — где она упирается в другую линию; стык двух кусков одной линии (степень 2 на этом виде) — не конец */
  const deg=(E,p)=>E.reduce((c,e)=>c+[e.key[0],e.key[e.key.length-1]].filter(q=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<0.45).length,0);
  const sphPts=F0=>{ const [a,c]=F0.S[0], C=[], R=SPH.R, r=SPH.r||0, P0=[];
    [a,c].forEach(v=>{ if(Math.hypot(v[0],v[1])<R-0.05) C.push(v); });
    [R,r].filter(Q=>Q>0).forEach(Q=>{ const dx=c[0]-a[0], dz=c[1]-a[1], A=dx*dx+dz*dz, B=2*(a[0]*dx+a[1]*dz), Cc=a[0]*a[0]+a[1]*a[1]-Q*Q, D0=B*B-4*A*Cc; if(D0<0) return;
      [(-B-Math.sqrt(D0))/(2*A),(-B+Math.sqrt(D0))/(2*A)].forEach(t=>{ if(t>-1e-6&&t<1+1e-6) P0.push([a[0]+dx*t,0,a[1]+dz*t]); }); });   /* сторона K выходит на очерк сферы — одна точка на оси y = 0 */
    C.forEach(v=>{ const rho=Math.hypot(v[0],v[1]); [R,r].filter(Q=>Q>=rho-0.05&&Q>0).forEach(Q=>{ const y=Math.sqrt(Math.max(0,Q*Q-rho*rho)); (y<0.3?[0]:[-y,y]).forEach(yy=>P0.push([v[0],yy,v[1]])); }); });
    return uniq(P0).filter(p=>Math.abs(Jm(...p))<0.35).sort((p,q)=>(p[1]-q[1])||(q[2]-p[2])).map(p=>{ const o=reg(p); o.how=o.how||(Math.abs(p[1])<0.3?'T':(F0.S[0][0][0]===F0.S[0][1][0]?'L':'T')); o.kv=true; return o; }); };
  const KG=[]; FACES.forEach(F0=>{ const fL=kLe.filter(e=>e.key.every(p=>inPlane(F0,p))), fT=kTe.filter(e=>e.key.every(p=>inPlane(F0,p)));
    const keep=o=>!SPH||o.kv||[fL,fT].some(E=>{ const d=deg(E,o.p); return d===1||d>2; })||!fL.concat(fT).some(e=>e.key.some(q=>Math.hypot(q[0]-o.p[0],q[1]-o.p[1],q[2]-o.p[2])<0.45));
    let all=kPts.filter(o=>onFace(F0,o.p)&&isEnd(o.p)&&keep(o)); kPts.filter(o=>onFace(F0,o.p)).forEach(o=>o.fg=1);
    if(SPH&&!F0.arc) all=sphPts(F0);   /* шар: точки — где рёбра K (линии вдоль y через концы стороны) протыкают сферу и полость */
    const g=all.filter(o=>!o.gs); all.forEach(o=>o.gs=1); if(!g.length&&!fL.length&&!fT.length) return;
    KG.push({g,all,F0}); });
  kPts.filter(o=>!o.fg).forEach(o=>{ const q=KG.find(G=>G.F0.ip===polyOf(o.p)); if(q){ q.g.push(o); q.all.push(o); } else KG.push({g:[o],all:[o],F0:FACES[0]||{ip:0,S:[]}}); });
  const pastL=[], pastT=[];
  KG.forEach(({g:kG,all,F0},gi)=>{ const ip=F0.ip, kn=multi?' '+(ip+1):'', ft=faceTxt(F0), fL=kLe.filter(e=>e.key.every(p=>inPlane(F0,p))), fT=kTe.filter(e=>e.key.every(p=>inPlane(F0,p)));
  const viaL=kG.filter(o=>o.how==='L');
  ST.push({id:'kP',t:'Вырез K'+kn+': '+ft.t+' — точки '+all.map(o=>o.n).sort((a,c)=>a-c).join(', '),d:ft.d+' Точки '+all.map(o=>o.n).sort((a,c)=>a-c).join(', ')+' — концы её линий: переносим их по линиям связи и соединяем'+(fL.some(e=>e.h)||fT.some(e=>e.h)?' (невидимое — штриховой)':'')+'.',
    kSide:F0.S,
    more:'<p><b>Что за точки</b> (передняя и задняя совпадают на главном виде: видимая подписана первой, невидимая — в скобках):</p><ul>'+(()=>{ const G=[]; kG.forEach(o=>{ const w=where(o), g=G.find(q=>q.w===w); if(g) g.L.push(o); else G.push({w,L:[o]}); }); return G.map(g=>`<li><b>${g.L.map(o=>o.n).join(', ')}</b> — ${g.w} (${g.L.map(o=>o.n+': x = '+sx(o.p[0])+', z = '+mm(o.p[2])).join('; ')}).</li>`).join(''); })()+'</ul><p><b>Как найти</b> на виде сверху:</p>'+'<ul>'+['edge','T','L','P','vis'].map(h=>{ const g=kG.filter(o=>o.how===h); if(!g.length) return ''; const nm=g.map(o=>o.n+'′').join(', '), dp=g.map(o=>o.n+' — '+(Math.abs(o.p[1])<0.3?'0':mm(o.p[1]))).join('; ');
      if(h==='edge') return `<li><b>${nm}</b> — на рёбрах тела: вертикальная линия связи от k″ до проекции ребра на виде сверху.</li>`;
      if(h==='T') return `<li><b>${nm}</b> — на поверхности ⟂ π₁: сверху она видна линией, вертикальная линия связи от k″ упирается в неё.</li>`;
      if(h==='L') return `<li><b>${nm}</b> — на гранях ⟂ π₃: горизонтальная линия связи от k″ до линии грани на виде слева даёт k‴; глубину от оси вида слева откладываем от оси вида сверху и опускаем вертикальную линию связи от k″. Глубины, мм: ${dp}.</li>`;
      if(h==='P') return `<li><b>${nm}</b> — на поверхности общего положения: через точку проводим параллель (горизонтальное сечение тела на её высоте) — на виде сверху это контур сечения; k′ — на нём, на вертикальной линии связи от k″.</li>`;
      return '<li><b>'+nm+'</b> — точки смены видимости: вертикальная линия связи от k″, глубина — как у точки над ней ('+g.map(o=>o.n+' — как '+(o.by?o.by.n:'?')).join('; ')+').</li>'; }).join('')+'</ul>'+'<p>На виде слева: высота — горизонтальной линией связи с главного вида, глубина — та же, что на виде сверху, от оси.</p>',
    F:{k:'given',kHL:1},T:{k:'given',addP:pastT.slice(),add:fT,col:C_K},L:{k:'body',addP:pastL.slice(),add:fL,col:C_K},pts:kG.map(o=>({o,col:C_K,how:o.how==='L'?'FLT':'FTL',par:o.how==='P'}))});
  pastL.push(...fL); pastT.push(...fT);
  });
  /* 8. Линии выреза */
  const hidK=kLe.some(e=>e.h), visK=kLe.some(e=>!e.h);
  ST.push({id:'kLines',t:'Вырез K: соединяем точки',d:'Соединяем точки в порядке обхода контура K на виде слева и на виде сверху.'+(hidK?' Невидимые участки — штриховой.':''),
    more:'<p>Точки одной стороны выреза лежат в одной плоскости ⟂ π₂, поэтому соединяем только точки, соседние на контуре K главного вида. '+(hidK&&!visK?'На виде слева вырез закрыт гранями тела — все его линии штриховые.':hidK?'Видимые участки — сплошной основной линией, закрытые телом — штриховой.':'')+'</p>'
      +(kTe.length?'<p>На виде сверху так достраиваем вырез K, которого в задании не было.</p>':''),
    F:{k:'given',kHL:1},T:{k:'given',add:kTe,col:C_K},L:{k:'body',add:kLe,col:C_K}});
  /* 9. Стираем */
  if(eLe.length||eTe.length) ST.push({id:'erase',t:'Стираем то, чего больше нет',d:'Участки рёбер тела, которые вырез K унёс вместе с материалом, стираем.',
    more:'<p>Перечёркнуты линии, которых на детали больше нет: ребро прерывается там, где его пересекла плоскость выреза. На следующем шаге их уже нет.</p>',
    F:{k:'given'},T:{k:'given',add:kTe,col:INK,er:eTe},L:{k:'body',add:kLe,col:INK,er:eLe}});
  /* 10–11. Профильный разрез */
  const LS=DR(model,sp.lk,0,sp.yb), secEl=elements(secPieces(model,[0,0,0],[0,1,0],[0,0,1],[b[0][1]-2,b[1][1]+2,z0-2,z1+2],sp.L==='half'?p=>p[1]-(sp.yb||0):null,D.L.px)), secPts=uniq([].concat(...secEl.map(e=>e.key))).map(reg);
  const full=sp.L!=='half';
  ST.push({id:'secL',t:full?'Профильный разрез':'Профильный разрез: фигура сечения',d:'Секущая плоскость — профильная плоскость симметрии (через ось). Строим фигуру сечения по точкам и штрихуем под 45°.',
    more:`<p>Разрез нужен: вырез K внутри тела, на виде слева он виден только штриховыми. ${full?'Деталь несимметрична спереди назад — разрез полный (ГОСТ 2.305).':'Деталь симметрична спереди назад — соединяем половину вида и половину разреза, граница — ось симметрии'+(sp.yb?' (на ось попадает ребро — граница волнистой линией, ребро остаётся на изображении)':'')+'; разрез — справа от оси.'}</p>`
      +'<p>Точки фигуры сечения — пересечения секущей плоскости с рёбрами тела и с плоскостями выреза: '+secPts.map(o=>o.n).join(', ')+'. На главном виде они на оси, на виде сверху — на горизонтальной оси… по линиям связи, как раньше.</p><p>Всё, что попало в секущую плоскость, — штриховка 45° (ГОСТ 2.306); линии выреза за секущей плоскостью теперь видны — обводим основной линией.</p>',
    F:{k:'sec'},T:{k:'given',add:kTe,col:INK},L:{k:'img',d:LS,hl:secEl,col:C_SEC},pts:[]});
  { const sec0=ST[ST.length-1], SG=chunk(secPts,14); SG.forEach((g,gi)=>{ if(!gi){ sec0.pts=g.map(o=>({o,col:C_SEC,how:'FTL'})); if(SG.length>1) sec0.t+=' (1 из '+SG.length+')'; return; }
    ST.push(Object.assign({},sec0,{t:sec0.t.replace(/ \(1 из \d+\)$/,'')+' ('+(gi+1)+' из '+SG.length+')',d:'Продолжаем: остальные точки фигуры сечения — так же, высота с главного вида, глубина с вида сверху.',more:'<p>Точки '+g.map(o=>o.n).join(', ')+'.</p>',pts:g.map(o=>({o,col:C_SEC,how:'FTL'}))})); }); }
  const lostL=elements(diff(D.L.lines.filter(s=>s.h),LS.lines));
  if(!full&&lostL.length) ST.push({id:'secV',t:'Профильный разрез: половина вида',d:'На половине вида невидимый контур (штриховые) не проводим — внутреннее устройство уже показано разрезом.',
    more:'<p>Перечёркнутые штриховые остаются только на месте разреза — там они стали видимыми линиями. ГОСТ 2.305: если вид и разрез симметричны, на половине вида линии невидимого контура не показывают.</p>',
    F:{k:'sec'},T:{k:'given',add:kTe,col:INK},L:{k:'img',d:LS,er:lostL}});
  /* 12–13. Горизонтальный разрез А–А */
  if(hz!=null){ const TC=DR(model,'topcut',0,0), TCz=IG3.drawing(model,'topcut',W,hz), aEl=elements(secPieces(model,[0,0,hz],[1,0,0],[0,1,0],[b[0][0]-2,b[1][0]+2,b[0][1]-2,b[1][1]+2],sp.H==='half'?p=>(sp.tb||0)-p[0]:sp.H==='halfD'?p=>p[1]:null,D.T.px)), aPts=uniq([].concat(...aEl.map(e=>e.key))).map(reg), L0=(model.hz.L||'А'); aEl0=aEl;
    ST.push({id:'aa',t:'Разрез '+L0+'–'+L0+': фигура сечения',d:'Горизонтальная секущая плоскость на высоте '+mm(hz)+' мм. Точки фигуры — где её след на главном виде пересекает контур тела и выреза; глубины — с вида слева.',
      more:'<p>Положение плоскости — по середине выреза K: так разрез показывает вырез. На главном виде — разомкнутая линия со стрелками (направление взгляда — сверху вниз) и буквами '+L0+'.</p><p>Точки '+aPts.map(o=>o.n).join(', ')+': x — с главного вида (вертикальная линия связи вниз), глубина — с вида слева на той же высоте '+mm(hz)+' мм (засечки от оси).</p>',
      F:{k:'given',aa:hz},T:{k:'given',add:kTe,col:INK,hl:aEl,hlc:C_AA},L:{k:'img',d:LS,hz},pts:[]});
    { const a0=ST[ST.length-1], AG=chunk(aPts,14); AG.forEach((g,gi)=>{ if(!gi){ a0.pts=g.map(o=>({o,col:C_AA,how:'FLT'})); if(AG.length>1) a0.t+=' (1 из '+AG.length+')'; return; }
      ST.push(Object.assign({},a0,{t:a0.t.replace(/ \(1 из \d+\)$/,'')+' ('+(gi+1)+' из '+AG.length+')',d:'Продолжаем: остальные точки фигуры — x с главного вида, глубина с вида слева на той же высоте.',more:'<p>Точки '+g.map(o=>o.n).join(', ')+'.</p>',pts:g.map(o=>({o,col:C_AA,how:'FLT'}))})); }); }
    const H=sp.H, hTxt=H==='half'?'слева от вертикальной оси — половина вида, справа — половина разреза':H==='halfD'?'сверху от горизонтальной оси — половина вида, снизу — половина разреза (слева направо деталь несимметрична или на вертикальной оси ребро)':'полный разрез — половину вида с половиной разреза здесь соединить нельзя';
    ST.push({id:'aa2',t:'Разрез '+L0+'–'+L0+' на месте вида сверху',d:'На месте вида сверху: '+hTxt+'. Штриховка 45°, над изображением — «'+L0+'–'+L0+'».',
      more:'<p>Горизонтальный разрез не совпадает с плоскостью симметрии детали — его обозначают: след на главном виде со стрелками и буквами и надпись «'+L0+'–'+L0+'» над разрезом (ГОСТ 2.305). На половине вида невидимый контур не проводим.</p>',
      F:{k:'given',aa:hz},T:{k:'aa',z:hz},L:{k:'img',d:LS}}); }
  /* 14. Размеры */
  { const DM=model.dims||[], why=d=>{ const [v,t,a,c,,lab]=d, L=String(lab);
      if(t==='dia') return 'диаметр описанной окружности правильного многоугольника — им задают его размер';
      if(t==='v'){ const lo=Math.min(a[1],c[1]), hi=Math.max(a[1],c[1]); if(Math.abs(lo-z0)<0.3&&Math.abs(hi-z1)<0.3) return 'общая высота детали';
        if(zs.some(z=>Math.abs(z-hi)<0.6)||zs.some(z=>Math.abs(z-lo)<0.6)) return 'уровень выреза K: положение его горизонтальной стороны или вершины по высоте';
        return 'высота ступени тела'; }
      if(v==='T') return 'размер тела в плане — виден только на виде сверху';
      const AK=[].concat(...KA), xs=AK.map(p=>p[0]), za=a[1];
      if(AK.some(p=>Math.abs(p[1]-za)<0.6)&&(xs.some(x=>Math.abs(x-a[0])<0.6)||xs.some(x=>Math.abs(x-c[0])<0.6))) return 'ширина выреза K на этом уровне';
      return 'размер тела на главном виде'; };
    ST.push({id:'dims',t:'Размеры',d:'Ставим размеры тела и выреза K — каждый один раз, на том виде, где он виден лучше (ГОСТ 2.307).',
      more:'<ul>'+DM.map(d=>`<li><b>${esc(d[5])}</b> — ${why(d)}.</li>`).join('')+'</ul><p>Размеры выреза — от баз тела: высоты от основания, ширины от оси симметрии. Верх выреза, стороны которого направлены в вершину, не образмеривают — он уже определён (лишний размер).</p>',
      sheet:1}); }
  /* 15. Лист */
  { const M=(window.DZR&&DZR.get('ig4')&&DZR.get('ig4').method)||{}, ch=(((M.types||{}).all||{}).check)||[];
    ST.push({id:'sheet',t:'Готовый лист и самопроверка',d:'Все изображения — в проекционной связи, с осями, разрезами, размерами и основной надписью.',
      more:(ch.length?'<p><b>Проверь себя:</b></p><ul>'+ch.map(c=>'<li>'+c+'</li>').join('')+'</ul>':''),sheet:1}); }
  /* номера точек: где строится впервые — там и подпись */
  const out={ST,R,D,sp,O,LS,kTe,kLe,bodyEl,secEl,aEl:typeof aEl0!=='undefined'?aEl0:null}; Object.defineProperty(model,'_ig4s',{value:out}); return out; }

/* ── рисунок шага ── */
function svg(model,PL,i,opt){ opt=opt||{}; const ST=PL.ST, st=ST[i], D=PL.D, sp=PL.sp, b=model.box, z0=b[0][2], z1=b[1][2];
  const P=(d,q,ox,oy)=>{ const t=d.px(q); return [ox+t[0]*k0,oy+t[1]*k0]; }, FR=q=>P(D.F,q,X0,Y0), TP=q=>P(D.T,q,X0,TOPY), LF=q=>P(D.L,q,X0+S,Y0);
  const Km=(FR([10,0,0])[0]-FR([0,0,0])[0])/10;   /* px на мм */
  const L=(a,c,cl,w,dash,op)=>`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(c[0])}" y2="${f(c[1])}" stroke="${cl}" stroke-width="${w||1}"${dash?` stroke-dasharray="${dash}"`:''}${op!=null?` stroke-opacity="${op}"`:''}/>`;
  const AX='12 3 2 3', sw=D.L.sw, dsh=`${f(2.5*D.L.mm)} ${f(1.1*D.L.mm)}`;
  const pathEl=(e,cl,w)=>`<path d="${e.path.map((p,j)=>(j?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join('')}" fill="none" stroke="${cl}" stroke-width="${f(e.h?sw*(w||1)*(cl===INK?0.5:0.75):sw*(w||1))}"${e.h?` stroke-dasharray="${dsh}"`:''} stroke-linecap="round" stroke-linejoin="round"/>`;
  const grp=(ox,oy,inner)=>`<g transform="translate(${ox} ${oy}) scale(${k0})">${inner}</g>`;
  const lines=(d,cl)=>{ const pp=IG3.paths(d.lines||d); return (pp.h?`<path d="${pp.h}" fill="none" stroke="${cl}" stroke-width="${f(sw*0.5)}" stroke-dasharray="${dsh}"/>`:'')+(pp.v?`<path d="${pp.v}" fill="none" stroke="${cl}" stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round"/>`:''); };
  /* крестик — только на заметном участке и не вплотную к соседнему (короткие обрезки рядом сливались в пятно) */
  const XS=[], cross=(e,ox,oy)=>{ let ln=0; for(let j=1;j<e.path.length;j++) ln+=Math.hypot(e.path[j][0]-e.path[j-1][0],e.path[j][1]-e.path[j-1][1]); if(ln*k0<10) return '';
    const m=e.path[Math.floor(e.path.length/2)], q=[ox+m[0]*k0,oy+m[1]*k0], r=6; if(XS.some(p=>Math.hypot(p[0]-q[0],p[1]-q[1])<18)) return ''; XS.push(q); return L([q[0]-r,q[1]-r],[q[0]+r,q[1]+r],RED,2)+L([q[0]-r,q[1]+r],[q[0]+r,q[1]-r],RED,2); };
  let o='', aux='', top='';
  /* главный вид */
  const kOutline0=()=>(model.kp||[]).map(K=>`<polygon points="${K.map(p=>FR([p[0],b[0][1],p[1]]).map(f).join(',')).join(' ')}" fill="${C_K}" fill-opacity=".08" stroke="${C_K}" stroke-width="2.6" stroke-linejoin="round"/>`).join('')
  const kOutline=()=>model.sph?`<defs><clipPath id="ig4kc${i}"><circle cx="${f(FR([0,0,0])[0])}" cy="${f(FR([0,0,0])[1])}" r="${f(model.sph.R*Km)}"/></clipPath></defs><g clip-path="url(#ig4kc${i})">${kOutline0()}</g>`:kOutline0();   /* шар: контур K — только в пределах шара */
  if(st.F.k==='sec'){ const d=IG3.drawing(model,sp.fk,W,0,sp.xb); o+=`<image href="${d.url}" x="${X0}" y="${Y0}" width="${S}" height="${S}"/>`; if(sp.xb) o+=IGUI.wavyIn(model,'F',sp.xb,(u,v)=>FR([u,0,v])).svg; }
  else o+=grp(X0,Y0,lines(D.F,INK));
  if(st.F.kHL) o+=kOutline();
  if(st.kSide) o+=st.kSide.map(([a2,c2])=>L(FR([a2[0],b[0][1],a2[1]]),FR([c2[0],b[0][1],c2[1]]),C_K,5)).join('');   /* грань текущего шага — толстой линией */
  o+=L(FR([0,0,z0-6]),FR([0,0,z1+6]),INK,.7,AX);
  if(st.F.aa!=null){ const xs=[b[0][0]-6,b[1][0]+6]; o+=IGUI.secMark(FR([xs[1],0,st.F.aa]),FR([xs[0],0,st.F.aa]),Km,(model.hz&&model.hz.L)||'А',st.id==='aa'?C_AA:INK); }
  /* вид сверху */
  const tc=TP([0,0,z1]), rr=Math.max(b[1][0],-b[0][0],b[1][1],-b[0][1])+6, e=rr*Km;
  if(st.T.k==='aa'){ const top0=DR(model,'topNH'), cut=IG3.drawing(model,'topcut',W,st.T.z), xc=tc[0], yc=tc[1], id='ig4hz'+i, H=sp.H;
    const img=d=>`<image href="${d.url}" x="${X0}" y="${TOPY}" width="${S}" height="${S}"/>`;
    o+=(H==='half'?`<defs><clipPath id="${id}a"><rect x="-2000" y="-2000" width="${f(xc+2000)}" height="8000"/></clipPath><clipPath id="${id}b"><rect x="${f(xc)}" y="-2000" width="4000" height="8000"/></clipPath></defs>`
      :H==='halfD'?`<defs><clipPath id="${id}a"><rect x="-2000" y="-2000" width="4000" height="${f(yc+2000)}"/></clipPath><clipPath id="${id}b"><rect x="-2000" y="${f(yc)}" width="4000" height="2000"/></clipPath></defs>`:'')
      +(H==='full'?img(cut):`<g clip-path="url(#${id}a)">${img(top0)}</g><g clip-path="url(#${id}b)">${img(cut)}</g>`);
    if(sp.tb) o+=IGUI.wavyIn(model,'T',sp.tb,(u,v)=>TP([u,v,z1])).svg;
    const L0=(model.hz.L||'А'), yTop=Math.min(TP([0,b[1][1],z1])[1],TP([0,b[0][1],z1])[1]); o+=`<text x="${f(tc[0])}" y="${f(yTop-12)}" class="igs-let" text-anchor="middle">${L0}–${L0}</text>`; }
  else { o+=grp(X0,TOPY,lines(PL.D.GT,INK)); if(st.T.addP) o+=grp(X0,TOPY,st.T.addP.map(e=>pathEl(e,INK)).join('')); if(st.T.add) o+=grp(X0,TOPY,st.T.add.map(e=>pathEl(e,st.T.col||INK)).join(''));
    if(st.T.er) o+=grp(X0,TOPY,st.T.er.map(e=>pathEl(e,PAST)).join(''))+st.T.er.map(e=>cross(e,X0,TOPY)).join('');
    if(st.T.hl) o+=grp(X0,TOPY,st.T.hl.map(e=>pathEl(e,st.T.hlc,1.15)).join('')); }
  o+=L([tc[0]-e,tc[1]],[tc[0]+e,tc[1]],INK,.7,AX)+L([tc[0],tc[1]-e],[tc[0],tc[1]+e],INK,.7,AX);
  /* вид слева */
  const Lk=st.L.k;
  if(Lk==='axis'||Lk==='body'||Lk==='img'){ o+=L(LF([0,0,z0-6]),LF([0,0,z1+6]),Lk==='axis'?C_BODY:INK,Lk==='axis'?1.3:.7,AX); }
  if(Lk==='axis'){ const g=st.gab, a=LF([0,g.y0,z1]), c=LF([0,g.y1,z1]), a0=LF([0,g.y0,z0]), c0=LF([0,g.y1,z0]);
    aux+=L(FR([b[1][0],0,z1]),[Math.max(a[0],c[0])+8,a[1]],C_BODY,.8)+L(FR([b[1][0],0,z0]),[Math.max(a0[0],c0[0])+8,a0[1]],C_BODY,.8);
    const ty=TP([0,0,z1]); const dep=(A,B)=>L(A,B,C_BODY,1.8)+tick2(A,B,C_BODY); aux+=dep(TP([b[1][0]+8,0,z1]),TP([b[1][0]+8,g.y0,z1]))+dep(TP([b[1][0]+16,0,z1]),TP([b[1][0]+16,g.y1,z1]))+dep(LF([0,0,(z0+z1)/2]),LF([0,g.y0,(z0+z1)/2]))+dep(LF([0,0,(z0+z1)/2-10]),LF([0,g.y1,(z0+z1)/2-10]));
    [a,c,a0,c0].forEach(q=>{ aux+=`<circle cx="${f(q[0])}" cy="${f(q[1])}" r="3" fill="${C_BODY}"/>`; }); }
  if(Lk==='body'){ const idx=ST.indexOf(st), built=ST.slice(0,idx).some(s=>s.id==='body'&&s.L.cur&&s.L.cur.length);
    const cur=st.L.cur&&st.L.cur.length; if(built||cur) o+=grp(X0+S,Y0,PL.bodyEl.map(e=>pathEl(e,cur&&!built?C_BODY:INK)).join(''));
    if(st.L.addP) o+=grp(X0+S,Y0,st.L.addP.map(e=>pathEl(e,INK)).join(''));
    if(st.L.add) o+=grp(X0+S,Y0,st.L.add.map(e=>pathEl(e,st.L.col||INK)).join(''));
    if(st.L.er) o+=grp(X0+S,Y0,st.L.er.map(e=>pathEl(e,PAST)).join(''))+st.L.er.map(e=>cross(e,X0+S,Y0)).join(''); }
  if(Lk==='img'){ o+=`<image href="${st.L.d.url}" x="${X0+S}" y="${Y0}" width="${S}" height="${S}"/>`; if(sp.yb) o+=IGUI.wavyIn(model,'L',sp.yb,(u,v)=>LF([0,u,v])).svg;
    if(st.L.hl) o+=grp(X0+S,Y0,st.L.hl.map(e=>pathEl(e,st.L.col,1.15)).join(''));
    if(st.L.er) o+=grp(X0+S,Y0,st.L.er.map(e=>pathEl(e,PAST)).join(''))+st.L.er.map(e=>cross(e,X0+S,Y0)).join('');
    if(st.L.hz!=null){ const zz=st.L.hz; aux+=L(FR([b[1][0],0,zz]),LF([0,b[1][1]+6,zz]),C_AA,.8,'5 3'); } }
  /* построения: прошлые шаги — бледно (можно скрыть), текущий — цветом */
  const LB=[], DOTS=[];
  const idx=ST.indexOf(st), first={}; ST.forEach((s,j)=>(s.pts||[]).forEach(q=>{ if(first[q.o.n]==null) first[q.o.n]=j; }));
  const draw=(q,cur)=>{ const p=q.o.p, n=q.o.n, cl=cur?q.col:PAST, w=cur?1:.7, op=cur?1:.8; let g='';
    const A2=FR(p), A1=TP(p), A3=LF(p), how=q.how, hasD=Math.abs(p[1])>0.3;
    if(/T/.test(how)&&/F/.test(how)||how==='TL') g+=L(A2,A1,cl,w,null,op);
    if(/L/.test(how)&&(/F/.test(how)||how==='TL')) g+=L(A2,A3,cl,w,null,op);
    if(hasD&&(how==='FTL'||how==='FLT'||how==='TL')){ const T0=TP([p[0],0,p[2]]), L0=LF([0,0,p[2]]); g+=L(T0,A1,cl,cur?1.8:1,null,op)+L(L0,A3,cl,cur?1.8:1,null,op); if(cur) g+=tick2(T0,A1,cl)+tick2(L0,A3,cl); }
    if(cur&&q.par){ const sec=parallel(model,PL,p[2]); g+=grp(X0,TOPY,sec.map(e=>pathEl(e,cl,.55)).join('')); }
    return g; };
  let pa=''; ST.slice(0,idx).forEach(s=>(s.pts||[]).forEach(q=>{ if(opt.hidePast===false) pa+=draw(q,false); }));   /* под линиями вида */
  (st.pts||[]).forEach(q=>{ aux+=draw(q,true); });
  /* подписи: текущий шаг — цветом; «все номера» — и прошлые (серым) */
  const labs=[]; const want=(q,cur)=>{ const p=q.o.p, how=q.how, v=[];
    if(cur){ v.push('F'); if(/T/.test(how)) v.push('T'); if(/L/.test(how)) v.push('L'); if(st.id==='kL') v.splice(v.indexOf('T'),1); }
    else v.push('F','T','L');
    v.forEach(w=>labs.push({w,o:q.o,cl:cur?q.col:PAST,cur})); };
  (st.pts||[]).forEach(q=>want(q,true));
  if(opt.allNums){ const seen=new Set((st.pts||[]).map(q=>q.o.n)); ST.slice(0,idx).forEach(s=>(s.pts||[]).forEach(q=>{ if(!seen.has(q.o.n)){ seen.add(q.o.n); want(q,false); } })); }
  /* подсветка точек по запросу (наставник: «смотри на точку 5») — жёлтый маркер на всех трёх проекциях */
  if(opt.focus&&opt.focus.length){ opt.focus.forEach(n=>{ const r=PL.R.find(o=>o.n===n); if(!r) return; [FR,TP,LF].forEach(V=>{ const q=V(r.p); aux+=`<circle cx="${f(q[0])}" cy="${f(q[1])}" r="11" fill="#ffd23f" fill-opacity=".45" stroke="#e0a800" stroke-width="1.5"/>`; }); }); }
  top+=labelsSVG(labs,{FR,TP,LF},PL,st,LB);
  o+=aux+top;
  return `<svg class="igs-sheet igs-steps ig4s" viewBox="0 0 ${PW} ${f(PH)}" role="img" aria-label="Построение по шагам: ${esc(st.t)}"><rect x="2" y="2" width="${PW-4}" height="${f(PH-4)}" fill="#fff" stroke="#111" stroke-width="1"/>${pa}${o}</svg>`; }
function tick2(a,c,cl){ const dx=c[0]-a[0], dy=c[1]-a[1], l=Math.hypot(dx,dy); if(l<2) return ''; const nx=-dy/l*4, ny=dx/l*4, ln=(q)=>`<line x1="${f(q[0]-nx)}" y1="${f(q[1]-ny)}" x2="${f(q[0]+nx)}" y2="${f(q[1]+ny)}" stroke="${cl}" stroke-width="1.3"/>`; return ln(a)+ln(c); }
/* параллель: горизонтальное сечение тела (без выреза) на высоте z — контур на виде сверху */
function parallel(model,PL,z){ const c=PL._par||(PL._par={}); const k=z.toFixed(1); if(c[k]) return c[k]; const d=IG3.drawing(PL.O,'topcut',W,z); return c[k]=elements(d.lines.filter(s=>s.c)); }
/* подписи: точка → место без наложений (на другие подписи, точки и линии вида); совпавшие проекции — одна подпись «5″ (6″)» */
function labelsSVG(labs,M,PL,st,LB){ const V={F:M.FR,T:M.TP,L:M.LF}, mark={F:'″',T:'′',L:'‴'};
  /* ближний к наблюдателю — первым: спереди — меньший y, сверху — больший z, слева — меньший x */
  const near={F:p=>p[1],T:p=>-p[2],L:p=>p[0]};
  const G=[]; labs.forEach(l=>{ const q=V[l.w](l.o.p); let g=G.find(o=>o.w===l.w&&Math.hypot(o.q[0]-q[0],o.q[1]-q[1])<2.5); if(!g){ g={w:l.w,q,L:[]}; G.push(g); } if(!g.L.some(x=>x.o.n===l.o.n)) g.L.push(l); });
  let s=''; const boxes=[];
  G.forEach(g=>{ g.L.sort((a,c)=>near[g.w](a.o.p)-near[g.w](c.o.p)); });
  G.forEach(g=>{ const cl=g.L[0].cl; s+=`<circle cx="${f(g.q[0])}" cy="${f(g.q[1])}" r="3.4" fill="${cl}" stroke="#fff" stroke-width="1"/>`; boxes.push([g.q[0]-4,g.q[1]-4,g.q[0]+4,g.q[1]+4]); });
  /* номера подряд — диапазоном: 10″…14″ */
  const list=ns=>{ const o=[]; for(let i=0;i<ns.length;){ let j=i; while(j+1<ns.length&&ns[j+1]===ns[j]+1) j++; o.push(j-i>=2?[ns[i],ns[j]]:null); if(j-i>=2) i=j+1; else { o[o.length-1]=[ns[i]]; i++; } } return o; };
  /* сначала — где тесно: больше всего соседей */
  G.forEach(g=>{ g.nb=G.filter(o=>o!==g&&Math.hypot(o.q[0]-g.q[0],o.q[1]-g.q[1])<60).length; }); G.sort((a,c)=>c.nb-a.nb);
  G.forEach(g=>{ const m=mark[g.w], t0=g.L[0].o.n+m, rest=list(g.L.slice(1).map(x=>x.o.n).sort((a,c)=>a-c)).map(r=>r.length>1?r[0]+m+'…'+r[1]+m:r[0]+m), txt=t0+(rest.length?' ('+rest.join(', ')+')':''), w=txt.length*11+4, h=20;
    const C=[[7,-7],[7,21],[-w-5,-7],[-w-5,21],[9,7],[-w-7,7],[-w/2,-12],[-w/2,30],[14,-18],[-w-10,-18],[14,32],[-w-10,32]];
    [26,42,58].forEach(r=>{ for(let a=0;a<16;a++){ const t=a*Math.PI/8, cx=Math.cos(t)*r, cy=Math.sin(t)*r; C.push([cx>=0?cx:cx-w,cy+7]); } });
    let best=null, bs=1e9; C.forEach(([dx,dy],ci)=>{ const x=g.q[0]+dx, y=g.q[1]+dy, B=[x,y-h+4,x+w,y+3]; let sc=ci*0.5;
      boxes.forEach(o=>{ const ox=Math.min(B[2],o[2])-Math.max(B[0],o[0]), oy=Math.min(B[3],o[3])-Math.max(B[1],o[1]); if(ox>0&&oy>0) sc+=40+ox*oy*0.2; });
      if(B[0]<4||B[2]>PW-4||B[1]<4||B[3]>PH-4) sc+=500; if(sc<bs){ bs=sc; best=[x,y,B]; } });
    boxes.push(best[2]);
    { const B=best[2], cx=Math.max(B[0],Math.min(g.q[0],B[2])), cy=Math.max(B[1],Math.min(g.q[1],B[3])); if(Math.hypot(cx-g.q[0],cy-g.q[1])>22) s+=`<line x1="${f(g.q[0])}" y1="${f(g.q[1])}" x2="${f(cx)}" y2="${f(cy)}" stroke="${g.L[0].cl}" stroke-width=".6"/>`; }   /* далеко отнесённая подпись — с выноской */
    s+=`<text x="${f(best[0])}" y="${f(best[1])}" class="igs-k" fill="${g.L[0].cl}">${esc(txt)}</text>`; });
  return s; }

/* ── плеер шагов ── */
function block(host,model,o){ o=o||{}; let PL=null, k=1, hidePast=false, allNums=false, focus=[];
  hidePast=true;   /* точки и линии связи сделали своё — на следующем шаге их нет, остаётся результат; вернуть можно кнопкой */
  host.innerHTML=`<div class="igb-ctl"><button class="igb-b" id="igbPrev" aria-label="Назад">‹</button><div class="igb-t"><small id="igbN"></small><b id="igbTt"></b></div><button class="igb-b pri" id="igbNext" aria-label="Дальше">›</button></div>
   <div class="igb-nums" role="tablist" id="ig4Nums"></div>
   <div class="igb-pic ig4-pic" id="igbPic"></div>
   <div class="ig4-tools"><button class="ig4-tg" id="ig4Past" aria-pressed="false">Показать прошлые построения</button><button class="ig4-tg" id="ig4All" aria-pressed="false">Все номера</button></div>
   <p class="igb-d" id="igbD"></p><details class="ig4-more" id="ig4More"><summary>Подробнее: как и почему</summary><div id="ig4MoreB"></div></details>`;
  const $=s=>host.querySelector(s), pic=$('#igbPic');
  const syncBtns=()=>{ const p=$('#ig4Past'), a=$('#ig4All'); p.textContent=hidePast?'Показать прошлые построения':'Скрыть прошлые построения'; p.setAttribute('aria-pressed',String(hidePast)); a.setAttribute('aria-pressed',String(allNums)); a.classList.toggle('on',allNums); };
  const paint=()=>{ const st=PL.ST[k-1]; let s='';
    try{ s=st.sheet?(o.sheet?o.sheet('clean'):''):svg(model,PL,k-1,{hidePast,allNums,focus}); }catch(e){ console.error(e); }
    pic.innerHTML=s||'<div class="igx-given-l">Не удалось построить на этом устройстве.</div>'; $('.ig4-tools').hidden=!!st.sheet; };
  const show=()=>{ const N=PL.ST.length, st=PL.ST[k-1];
    $('#igbN').textContent='Шаг '+k+' из '+N; $('#igbTt').textContent=st.t; $('#igbD').innerHTML=st.d; $('#ig4MoreB').innerHTML=st.more||''; $('#ig4More').hidden=!st.more;
    host.querySelectorAll('.igb-nums button').forEach(b=>{ const n=+b.dataset.k; b.classList.toggle('on',n===k); b.classList.toggle('done',n<k); });
    $('#igbPrev').disabled=k<=1; $('#igbNext').disabled=k>=N; paint(); };
  const start=()=>{ try{ PL=plan(model); }catch(e){ console.error(e); pic.innerHTML='<div class="igx-given-l">Не удалось построить шаги.</div>'; return; }
    $('#ig4Nums').innerHTML=PL.ST.map((s,i)=>`<button data-k="${i+1}" aria-label="Шаг ${i+1}: ${esc(s.t)}"></button>`).join('');
    host.querySelectorAll('.igb-nums button').forEach(b=>b.addEventListener('click',()=>{ k=+b.dataset.k; show(); }));
    syncBtns(); show();
    /* управление для наставника (чат-бот): открыть шаг, подсветить точки */
    player={model,go:n=>{ k=Math.max(1,Math.min(PL.ST.length,n|0)); focus=[]; show(); host.scrollIntoView({behavior:'smooth',block:'start'}); return k; },
      current:()=>k, highlight:nums=>{ focus=(nums||[]).map(Number); paint(); }, steps:()=>tutor(model)}; };
  $('#igbPrev').addEventListener('click',()=>{ if(!PL) return; k=Math.max(1,k-1); focus=[]; show(); });
  $('#igbNext').addEventListener('click',()=>{ if(!PL) return; k=Math.min(PL.ST.length,k+1); focus=[]; show(); });
  $('#ig4Past').addEventListener('click',()=>{ hidePast=!hidePast; syncBtns(); if(PL) paint(); });
  $('#ig4All').addEventListener('click',()=>{ allNums=!allNums; syncBtns(); if(PL) paint(); });
  pic.innerHTML='<div class="igx-ld soft" role="status"><div class="igx-ld-c"><span class="igx-ld-sp" aria-hidden="true"></span><b>Строю шаги…</b></div></div>';
  (IGUI.frame?IGUI.frame():Promise.resolve()).then(start);
}

/* ── покрытие (для tests/ig4-steps.js): каждый отрезок итогового вида слева, линий K на виде сверху, фигур обоих разрезов —
   концы построены (точка в реестре и показана на шаге с линиями связи) ── */
function coverage(model){ const PL=plan(model), D=PL.D, built=[]; PL.ST.forEach(s=>(s.pts||[]).forEach(q=>built.push(q.o.p)));
  const TOL=0.9;   /* мм: меньше толщины линии на листе; точки реестра сливаются в радиусе 0,45 */
  const has=p=>built.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<TOL);
  /* совпадающая проекция тоже годится: на виде слева у точки (x, y, z) проекция (y, z) */
  const hasIn=(p,v)=>has(p)||built.some(q=>v==='L'?Math.hypot(q[1]-p[1],q[2]-p[2])<TOL:v==='T'?Math.hypot(q[0]-p[0],q[1]-p[1])<TOL:Math.hypot(q[0]-p[0],q[2]-p[2])<TOL);
  const sets=[['вид слева',elements(D.L.lines),'L'],['вырез K на виде сверху',PL.kTe,'T'],['профильный разрез',PL.secEl,'L']];
  if(PL.aEl) sets.push(['разрез А–А',PL.aEl,'T']);
  let all=0, ok=0; const miss=[];
  /* отрезок — оба конца; кривая — концы и хотя бы одна построенная точка внутри (кривую строят по точкам и обводят по лекалу) */
  const onCurve=k=>built.some(q=>k.slice(1,-1).some(p=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<4)&&!k.slice(0,1).concat(k.slice(-1)).some(p=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<0.6));
  sets.forEach(([nm,els,v])=>els.forEach(e=>{ all++; const good=e.curve?hasIn(e.key[0],v)&&hasIn(e.key[e.key.length-1],v)&&onCurve(e.key):e.key.every(p=>hasIn(p,v)); if(good) ok++; else miss.push(nm+': '+e.key.map(p=>'('+p.map(x=>x.toFixed(1)).join('; ')+')').join(' — ')); }));
  return {all,ok,miss,steps:PL.ST.map(s=>s.id)}; }

/* ── для чат-бота-наставника: решение шагами без вёрстки ──
   IG4S.tutor(n) → {variant, title, steps:[{k, id, title, short, more, points:[{n, x, y, z, how, front, top, left}]}]}
   how: edge — на ребре; T — на поверхности ⟂ π₁; L — на грани ⟂ π₃ (сначала вид слева); P — через параллель; vis — смена видимости.
   IG4S.player (когда открыт плеер шагов): go(k), current(), highlight([номера точек]), steps(). Числа — из модели, их и называть. */
function tutor(n){ const model=typeof n==='object'?n:DZR.get('ig4').part(n); if(!model) return null; const PL=plan(model);
  const txt=h=>String(h||'').replace(/<li>/g,'\n• ').replace(/<\/p>\s*<p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').trim();
  return {variant:model.n,title:model.title,steps:PL.ST.map((s,i)=>({k:i+1,id:s.id,title:s.t,short:txt(s.d),more:txt(s.more),
    points:(s.pts||[]).map(q=>{ const p=q.o.p; return {n:q.o.n,x:p[0],y:p[1],z:p[2],how:q.o.how||null,front:q.o.n+'″',top:q.o.n+'′',left:q.o.n+'‴'}; })}))}; }
let player=null;
return {plan,svg,block,coverage,elements,diff,tutor,get player(){ return player; }};
})();
