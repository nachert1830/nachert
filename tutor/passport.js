/* ═══════════ TUTOR_PASSPORT: паспорт шага из ядра (docs/TUTOR.md, схема — tutor/passport.schema.json) ═══════════
   Паспорт строится детерминированно из данных шага (чертёж ядра, текст автора, обоснование) — для каждого шага каждой
   задачи тетради и каждого варианта ДЗ. Модель (когда появится) увидит только ступень лестницы и её словарь;
   секреты знает только линтер (tutor/lint.js).
   build(o) → паспорт.  o = {id, src, part, k, task, why?, ladder?, deps}
     part — часть задачи в формате плеера ({given, steps:[{t,d,why,tbl,add}]}), k — номер шага (1…n);
     deps — {STEPVIEW, PREPROG, PREP, CP:{cp46,cp47}, LINT, neighbor:(k)=>ref|null}.
   verifyFact(f, items) — независимая проверка факта по координатам чертежа (её зовут тесты).
   Где данных нет — поле todo с причиной, без выдумок. */
(function(){
const V=1;
const strip=s=>String(s==null?'':s).replace(/<sub>(.*?)<\/sub>/g,(m,x)=>x.replace(/[0-9]/g,d=>'₀₁₂₃₄₅₆₇₈₉'[d])).replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const MARK=/[′″‴]+$/;
const uniq=a=>[...new Set(a.filter(Boolean))];
const near=(p,q,e)=>p&&q&&Math.hypot(p[0]-q[0],p[1]-q[1])<(e||1.3);
function dSeg(q,a,b,inf){ const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy; if(L<1e-9) return Math.hypot(q[0]-a[0],q[1]-a[1]); let t=((q[0]-a[0])*dx+(q[1]-a[1])*dy)/L; if(!inf){ const d=4/Math.sqrt(L); if(t<-d||t>1+d) return 1e9; } return Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy); }

/* ── тип шага: по заголовку, тексту и тому, что появилось ── */
const TYPES=[
  ['analysis',/анализ|план решения|исследовани|условие задачи/i],
  ['visibility',/видимост|конкурир/i],
  ['replace',/замен|x₁₄|x₄₅|π₄|π₅|нов(ая|ую) ос/i],
  ['rotate',/вращ|поворач|поворот|совмещ/i],
  ['mediator',/посредник|проецирующ(ую|ая) плоскост|заключ/i],
  ['nv',/натуральн|прямоугольн(ый|ого) треугольник|истинн|Δ[yz]/i],
  ['perp',/перпендикуляр|⟂|прям(ой|ым) угл/i],
  ['level',/горизонтал|фронтал|линии уровня/i],
  ['parallel',/параллел|∥/i],
  ['intersect',/пересечени|∩|точк[аи] встречи/i],
  ['trace',/след/i],
  ['link',/линии связи|линией связи|по линии связи|недостающ/i],
  ['figure',/треугольник|квадрат|ромб|фигур|пирамид|многогранник/i] ];
function classify(text,title){ const one=t=>{ t=strip(t); for(const [k,re] of TYPES) if(re.test(t)) return k; return 'construct'; };
  if(title!=null){ const a=one(title); if(a!=='construct') return a; } return one(text); }
const TYPE_TOPICS={level:['s3','s5a'],mediator:['m4','m5'],intersect:['m4','m5','l6'],perp:['m2','m3','l7'],nv:['l4','l4u','s5b','m7b','t5'],
  visibility:['p5'],link:['p1','p2','l2','s2'],replace:['t2','t3','t4','t5','t6','t9'],rotate:['m7a','m7b','t7','t8'],parallel:['m1'],
  figure:['s6','m8','s2'],analysis:['m8','m6'],trace:['s4','l3'],construct:[]};

/* ── шаблоны ступеней (без меток и чисел, кроме подставленных разрешённых) ── */
const Q0={
  analysis:'Какие условия наложены на искомое и каким множеством точек отвечает каждое?',
  visibility:'Какие точки на этой проекции совпадают, хотя в пространстве это разные точки?',
  replace:'Как поставить новую ось, чтобы объект занял частное положение?',
  rotate:'Вокруг какой оси повернуть, чтобы объект стал параллелен плоскости проекций?',
  mediator:'Через какую прямую удобно провести вспомогательную плоскость, чтобы одна её проекция стала линией?',
  nv:'Какая проекция отрезка искажена и чего не хватает, чтобы найти его длину?',
  perp:'В каком случае прямой угол виден на проекции без искажения?',
  level:'У какой прямой плоскости одна проекция параллельна оси x и с какой проекции её начинают?',
  parallel:'Какое условие параллельности здесь можно проверить на проекциях?',
  intersect:'Какие две линии должны пересечься, чтобы получилась нужная точка?',
  trace:'Где прямая этой плоскости встречает плоскость проекций?',
  link:'Какая проекция у этой точки уже есть и как получить вторую?',
  figure:'Какие вершины фигуры уже известны и каких не хватает?',
  construct:'Что нужно получить на этом шаге и что для этого уже есть на чертеже?' };
const R1T={
  analysis:'Каждому условию отвечает множество точек, а искомое лежит на их пересечении.',
  visibility:'Видимость решают конкурирующие точки: из двух совпавших проекций видна та точка, что ближе к наблюдателю.',
  replace:'Новая ось ставится так, чтобы объект стал прямой уровня или проецирующим; расстояния до новой оси переносятся со старой проекции.',
  rotate:'При вращении точка движется по окружности в плоскости, перпендикулярной оси; радиус — расстояние до оси.',
  mediator:'Работает посредник: прямую заключаем в проецирующую плоскость, и задача сводится к пересечению двух плоскостей.',
  nv:'Длину отрезка даёт прямоугольный треугольник: один катет — проекция, второй — разность удалений концов.',
  perp:'Перпендикуляр к плоскости строят по её горизонтали и фронтали: прямой угол сохраняется на той проекции, где сторона — линия уровня.',
  level:'Горизонталь начинают с фронтальной проекции, параллельной оси x; фронталь — с горизонтальной.',
  parallel:'Прямая параллельна плоскости, если параллельна какой-нибудь прямой этой плоскости.',
  intersect:'Общая точка двух линий лежит на обеих сразу — на каждой проекции.',
  trace:'След — точка, где прямая встречает плоскость проекций: одна из её координат равна нулю.',
  link:'Две проекции одной точки лежат на одной линии связи, перпендикулярной оси.',
  figure:'Вершину фигуры находят как точку, лежащую сразу на двух известных линиях.',
  construct:'Каждая новая линия строится от уже известных точек и линий.' };
const KEYVIEW={
  mediator:t=>/фронтально-проецирующ/i.test(t)?{look:'вдоль π₂: камера по нормали к π₂',why:'фронтально-проецирующая плоскость схлопывается в линию — её фронтальный след'}:
    /горизонтально-проецирующ/i.test(t)?{look:'вдоль π₁: камера сверху',why:'горизонтально-проецирующая плоскость схлопывается в линию — её горизонтальный след'}:
    {look:'вдоль посредника: камера в его плоскости',why:'посредник схлопывается в линию'},
  level:t=>/фронтал/i.test(t)&&!/горизонтал/i.test(t)?{look:'спереди: камера по нормали к π₂',why:'фронталь видна в натуральную величину'}:{look:'сверху: камера по нормали к π₁',why:'горизонталь видна в натуральную величину'},
  nv:()=>({look:'перпендикулярно отрезку и проекции',why:'видны оба катета прямоугольного треугольника'}),
  visibility:t=>/π₁/.test(t)?{look:'сверху: камера по нормали к π₁',why:'видна точка, которая выше'}:{look:'спереди: камера по нормали к π₂',why:'видна точка, которая ближе к наблюдателю'},
  replace:()=>({look:'по нормали к новой плоскости проекций',why:'объект виден в частном положении'}),
  rotate:()=>({look:'вдоль оси вращения',why:'траектории точек — окружности'}),
  perp:()=>({look:'вдоль линии уровня плоскости',why:'прямой угол виден без искажения'}),
  intersect:()=>({look:'вдоль одной из пересекающихся линий',why:'видно, что точка лежит на обеих'}) };

/* общие ошибки по типу шага; detect — чем их ловит ядро (или TODO) */
const GEN_MIST={
  link:[{id:'G.link_not_perp',what:'Линия связи не перпендикулярна оси x: проекции точки не на одной вертикали',detect:'ядро: |x(P″) − x(P′)| больше допуска (tests/geometry.js; мутация «линия связи» в tests/mutate.js)',src:'GYM «найди ошибку»: разрыв линии связи'},
        {id:'G.label_swap',what:'Перепутаны проекции: штрих ′ поставлен у фронтальной проекции или наоборот',detect:'трассировка происхождения (tests/provenance.js); мутация «подписи местами»',src:'GYM «найди ошибку»: подписи местами'}],
  level:[{id:'G.level_not_par',what:'h″ (f′) проведена не параллельно оси x',detect:'ядро: наклон проекции к оси x — факт «∥ x» не подтверждается',src:'core/cp47.js, prep s3'},
         {id:'G.level_wrong_start',what:'Горизонталь начата с горизонтальной проекции (или фронталь — с фронтальной)',detect:'TODO: нужен порядок действий ученика (протокол «Решаю сам»)',src:'prep s3'}],
  intersect:[{id:'G.wrong_side',what:'Точка перенесена по линии связи не на ту сторону (не на ту прямую)',detect:'ядро: точка не лежит на нужной проекции прямой (факт «∈» не подтверждается)',src:'core/cp46.js 12-swap'}],
  mediator:[{id:'G.mediator_general',what:'Посредник взят общего положения: ни одна его проекция не вырождается в линию',detect:'TODO: распознавание посредника на листе ученика',src:'отчёт-исследование §4.2'}],
  visibility:[{id:'G.vis_inverted',what:'Видимость перепутана: видимой выбрана дальняя из конкурирующих точек',detect:'ядро: видимость лучом к наблюдателю (tests/geometry.js); core/cp46.js v1-inv, v2-inv',src:'core/cp46.js'}],
  nv:[{id:'G.nv_whole_coord',what:'Второй катет — вся координата точки, а не разность координат концов',detect:'ядро: длина гипотенузы ≠ длине отрезка в пространстве (core/cp47.js judge)',src:'core/cp47.js nv-abs'}],
  perp:[{id:'G.perp_to_sides',what:'Перпендикуляр к плоскости проведён к проекциям сторон, а не к h′ и f″',detect:'ядро: угол n′ с h′ (n″ с f″) ≠ 90°',src:'core/cp47.js h-par, f-hpar'}],
  replace:[{id:'G.replace_wrong_dist',what:'Расстояние до новой оси взято не с той (заменяемой) проекции',detect:'ДЗ-оракул: сохраняемая координата (tests/dz.js)',src:'prep t2'}],
  rotate:[{id:'G.rotate_radius',what:'Радиус вращения взят по проекции, а не в натуральную величину',detect:'TODO: для задач без программы построения',src:'prep m7a'}] };

/* ── что есть на чертеже ── */
function inv(SV,part,k){ const st=part.steps||[]; const given=(part.given||[]).filter(Boolean);
  const upto=j=>[].concat(given,...st.slice(0,j).map(s=>s.add||[])).filter(Boolean);
  const labOf=items=>{ const o=new Set(); items.forEach(it=>{ const l=strip(it.l||(it.t==='txt'&&String(it.s||'').length<=6?it.s:''));
    if(!l) return; l.split(/\s*[≡=]\s*/).forEach(x=>{ x=x.trim(); if(x&&x.length<=8&&!/\s/.test(x)&&!/^[0-9.,]+$/.test(x)&&!/мм|°/.test(x)) o.add(x); }); }); return o; };
  const before=upto(k-1), now=upto(k), all=upto(st.length);
  const kn=labOf(before), nw=[...labOf(now)].filter(x=>!kn.has(x)), fu=[...labOf(all)].filter(x=>!kn.has(x)&&!nw.includes(x));
  return {before,now,all,known:[...kn],new:nw,future:fu,add:((st[k-1]||{}).add||[]).filter(Boolean)}; }

/* ── факты: из геометрии и из текста шага; каждый проверен по координатам ── */
function facts(SV,I,text){ const out=[], items=I.now, P=SV.names(items), L=SV.lines(items).filter(o=>o.it.t!=='conn');
  const add=f=>{ const key=f.rel+':'+f.args.join(','); if(out.some(o=>o.rel+':'+o.args.join(',')===key)) return; const r=verifyFact(f,items,SV); f.verified=r.ok; f.res=Math.round(Math.min(r.res,999)*100)/100; if(!r.ok&&f.src==='kernel') return; out.push(f); };
  const newSet=new Set(I.new);
  /* прямые уровня: проекция ∥ x */
  L.forEach(o=>{ const s=SV.segsOf(o.it)[0]; if(!s||!strip(o.it.l)) return; if(Math.abs(s[0][1]-s[1][1])<0.6&&Math.abs(s[0][0]-s[1][0])>4) add({rel:'par',args:[o.name,'x'],text:o.name+' ∥ x',src:'kernel'}); });
  /* линии связи: две проекции точки на одной вертикали */
  items.filter(it=>it.t==='conn'&&it.a&&it.b).forEach(c=>{ const A=Object.keys(P).find(n=>near(P[n],c.a)), B=Object.keys(P).find(n=>near(P[n],c.b));
    if(A&&B&&A.replace(MARK,'')===B.replace(MARK,'')&&A!==B&&Math.abs(c.a[0]-c.b[0])<0.6) add({rel:'perp',args:[A,B,'x'],text:'линия связи '+A+B+' ⟂ x',src:'kernel',kind:'link'}); });
  /* принадлежность и пересечение: новые точки на линиях, известные точки на новых линиях */
  Object.keys(P).forEach(n=>{ const on=L.filter(o=>o.name!==n&&!o.name.includes(n)&&SV.onItem(P[n],o.it)); const rel=newSet.has(n)||on.some(o=>newSet.has(o.name));
    if(!rel) return; on.slice(0,3).forEach(o=>add({rel:'on',args:[n,o.name],text:n+' ∈ '+o.name,src:'kernel'}));
    if(on.length>=2&&newSet.has(n)){ add({rel:'meet',args:[n,on[0].name,on[1].name],text:n+' = '+on[0].name+' ∩ '+on[1].name,src:'kernel'}); add({rel:'meet',args:[on[0].name,on[1].name],text:on[0].name+' и '+on[1].name+' пересекаются',src:'kernel'}); } });
  /* знак прямого угла: две линии через вершину */
  items.filter(it=>it.t==='sq'&&it.at).forEach(q=>{ const th=L.filter(o=>SV.onItem(q.at,o.it)); if(th.length>=2&&(newSet.has(th[0].name)||newSet.has(th[1].name))) add({rel:'perp',args:[th[0].name,th[1].name],text:th[0].name+' ⟂ '+th[1].name,src:'kernel'}); });
  /* утверждения текста шага: «X ∥ Y», «X ⟂ Y», «X ∈ Y» */
  const labs=new Set(Object.keys(P).concat(L.map(o=>o.name),['x'])), t=strip(text), isLab=x=>labs.has(x)||Object.keys(P).some(a=>x.startsWith(a)&&P[x.slice(a.length)]);
  const re=/([A-Za-zα-ωΑ-Ω0-9][A-Za-zα-ωΑ-Ω0-9₀-₉′″‴]*)\s*(∥|⟂|⊥|∈)\s*([A-Za-zα-ωΑ-Ω0-9][A-Za-zα-ωΑ-Ω0-9₀-₉′″‴]*)/g; let m, claims=0;
  while((m=re.exec(t))){ const a=m[1], b=m[3]; if(!isLab(a)||!isLab(b)) continue; claims++;
    add({rel:m[2]==='∥'?'par':m[2]==='∈'?'on':'perp',args:[a,b],text:a+' '+(m[2]==='⊥'?'⟂':m[2])+' '+b,src:'text'}); }
  return out; }

/* независимая проверка факта по координатам (единицы чертежа ≈ мм) */
function verifyFact(f,items,SV){ const P=SV.names(items), L=SV.lines(items).filter(o=>o.it.t!=='conn');
  /* линия по имени: своя подпись, или «A″B″» — прямая через две подписанные точки (в любом порядке) */
  const ln=n=>{ const o=L.find(q=>q.name===n); if(o) return o; const ks=Object.keys(P).sort((a,b)=>b.length-a.length);
    for(const a of ks) if(n.startsWith(a)){ const b=n.slice(a.length); if(P[b]&&!near(P[a],P[b])) return {name:n,it:{t:'line',a:P[a],b:P[b]}}; }
    return null; };
  const dir=o=>{ const s=SV.segsOf(o.it)[0]; return s?[s[1][0]-s[0][0],s[1][1]-s[0][1]]:null; };
  const bad={ok:false,res:1e9};
  if(f.rel==='par'&&f.args[1]==='x'){ const o=ln(f.args[0]); const d=o&&dir(o); if(!d) return bad; const r=Math.abs(d[1])/Math.hypot(d[0],d[1])*20; return {ok:r<0.6,res:r}; }
  if(f.rel==='par'){ const a=ln(f.args[0]), b=ln(f.args[1]); const u=a&&dir(a), v=b&&dir(b); if(!u||!v) return bad; const r=Math.abs(u[0]*v[1]-u[1]*v[0])/Math.hypot(...u)/Math.hypot(...v)*20; return {ok:r<0.6,res:r}; }
  if(f.rel==='perp'&&f.args.length===3){ const A=P[f.args[0]], B=P[f.args[1]]; if(!A||!B) return bad; const r=Math.abs(A[0]-B[0]); return {ok:r<0.6,res:r}; }
  if(f.rel==='perp'){ const a=ln(f.args[0]), b=ln(f.args[1]); const u=a&&dir(a), v=b&&(f.args[1]==='x'?[1,0]:dir(b)); if(!u||!v) return bad; const r=Math.abs(u[0]*v[0]+u[1]*v[1])/Math.hypot(...u)/Math.hypot(...v)*20; return {ok:r<0.6,res:r}; }
  if(f.rel==='on'){ const p=P[f.args[0]], o=ln(f.args[1]); if(!p||!o) return bad; const r=Math.min(...SV.segsOf(o.it).map(([a,b])=>dSeg(p,a,b,false))); return {ok:r<1.0,res:r}; }
  if(f.rel==='meet'&&f.args.length===3){ const p=P[f.args[0]], a=ln(f.args[1]), b=ln(f.args[2]); if(!p||!a||!b) return bad; const r=Math.max(...[a,b].map(o=>Math.min(...SV.segsOf(o.it).map(([x,y])=>dSeg(p,x,y,false))))); return {ok:r<1.0,res:r}; }
  if(f.rel==='meet'){ const a=ln(f.args[0]), b=ln(f.args[1]); if(!a||!b) return bad; let best=1e9;
    SV.segsOf(a.it).forEach(([p1,p2])=>SV.segsOf(b.it).forEach(([q1,q2])=>{ const d1=[p2[0]-p1[0],p2[1]-p1[1]], d2=[q2[0]-q1[0],q2[1]-q1[1]], den=d1[0]*d2[1]-d1[1]*d2[0]; if(Math.abs(den)<1e-9) return;
      const t=((q1[0]-p1[0])*d2[1]-(q1[1]-p1[1])*d2[0])/den, X=[p1[0]+t*d1[0],p1[1]+t*d1[1]]; best=Math.min(best,Math.max(dSeg(X,p1,p2,false),dSeg(X,q1,q2,false))); }));
    return {ok:best<1.0,res:best}; }
  return bad; }

/* ── обоснование: ссылки «(вопрос 14)» убираем, остальное — как у автора ── */
const cleanWhy=s=>strip(s).replace(/\s*\((?:вопрос|вопросы|с\.|стр\.|рис\.)[^)]*\)/gi,'').replace(/\s+/g,' ').trim();
function ladderBlocks(tbl){ const o={}; String(tbl||'').replace(/<details class="hw-l (l\d)"[^>]*><summary>[^<]*<\/summary><div>([\s\S]*?)<\/div><\/details>/g,(m,c,b)=>{ o[{l1:'hint',l2:'principle',l3:'step',l4:'full',l5:'check'}[c]]=b; return m; }); return o; }
const firstSent=(s,n)=>{ const S=s.split(/(?<=[.!?])\s+/); let o=''; for(const x of S){ if((o+' '+x).trim().length>(n||300)) break; o=(o+' '+x).trim(); } return o||s.slice(0,n||300); };

/* ── Р3 из подписей подшагов: повелительно, секреты — словами ── */
function r3From(beats,secret){ const out=[];
  const nm=(c,word)=>secret.has(c.l)||secret.has(String(c.l).replace(MARK,''))?word:c.l;
  beats.forEach(b=>{ const segs=[[]]; (b.cap||[]).forEach(c=>{ if(c.s==='; ') segs.push([]); else segs[segs.length-1].push(c); });
    segs.forEach(g=>{ if(!g.length) return; const L=g.filter(c=>c.l!=null), S=g.map(c=>c.s||'').join('');
      if(/обводка/.test(S)){ out.push('Обведи с учётом видимости: сплошная — видна, штриховая — закрыта.'); return; }
      if(g[0].l!=null){ const p=nm(g[0],'искомую точку');
        if(/ ∩ /.test(S)&&L.length>=3) out.push('Отметь '+p+' там, где пересекаются '+nm(L[1],'искомая линия')+' и '+nm(L[2],'искомая линия')+'.');
        else if(/линия связи из/.test(S)) out.push('Перенеси '+p+' по линии связи из '+nm(L[1],'искомой точки')+(L[2]?' до '+nm(L[2],'искомой линии'):'')+'.');
        else if(/ на /.test(S)&&L[1]) out.push('Отметь '+p+' на '+nm(L[1],'искомой линии')+'.');
        else out.push('Отметь '+p+'.'); return; }
      let t=g.map(c=>c.l!=null?nm(c,'искомую линию'):c.s).join('').replace(/^прямая /,'прямую ').replace(/^линия построения/,'вспомогательную линию');
      out.push('Проведи '+t+'.'); }); });
  let s=''; for(const x of out){ if((s+' '+x).length>300) break; s=(s+' '+x).trim(); } return s; }

function build(o){ const D=o.deps, SV=D.STEPVIEW, part=o.part, k=o.k, st=(part.steps||[])[k-1]||{};
  const I=inv(SV,part,k), todo=[], LB=st.tbl?ladderBlocks(st.tbl):{};
  const title=strip(st.t), body=strip(st.d||LB.step||''), whyRaw=st.why||LB.principle||'';
  const type=classify(title+' '+body,title);
  /* секреты: будущие метки и искомое этого шага (красное/зелёное — ответ) */
  const ans=new Set(); I.add.forEach(it=>{ if(/^(res|resd|grn|grnd)$/.test(it.k||'')&&it.l) strip(it.l).split(/\s*[≡=]\s*/).forEach(x=>ans.add(x.trim())); });
  const secLabels=uniq(I.future.concat(I.new.filter(x=>ans.has(x))));
  const knownEnt=new Set(I.known.concat(I.new.filter(x=>!secLabels.includes(x))).map(x=>x.replace(MARK,'')));
  const ents=uniq(I.known.concat(I.new,I.future).map(x=>x.replace(MARK,'')).filter(x=>x.length<=4));
  const secEnts=ents.filter(e=>!knownEnt.has(e)&&secLabels.some(l=>l.replace(MARK,'')===e));
  const general=uniq((String(o.task&&o.task.q||'').match(/[α-ωΑ-Ω](?:[₀-₉])?/g)||[]).concat(['x']));
  const newLines=I.new.filter(x=>!secLabels.includes(x)&&!/^[A-Z0-9]/.test(x));
  const lab={known:I.known,new:I.new,future:I.future,general};
  const rl=[ I.known.concat(ents.filter(e=>knownEnt.has(e)&&I.known.some(l=>l.replace(MARK,'')===e))), null, null, null, null ];
  rl[1]=rl[0]; rl[2]=uniq(rl[0].concat(newLines)); rl[3]=uniq(rl[2].concat(I.new.filter(x=>!secLabels.includes(x)),ents.filter(e=>knownEnt.has(e)))); rl[4]=uniq(I.known.concat(I.new,I.future,ents));
  const F=facts(SV,I,[st.d,st.why,LB.step,LB.principle].join(' '));
  const rungOf=args=>{ let r=0; for(const a of args){ if(a==='x') continue; if(secLabels.includes(a)||secEnts.includes(a)) return 4; if(!rl[0].includes(a)) r=Math.max(r,rl[2].includes(a)?2:3); } return r; };
  F.forEach((f,i)=>{ f.id='F'+(i+1); f.rung=rungOf(f.args); });
  if(!F.some(f=>f.verified)) todo.push({field:'facts',why:'ядро не нашло на чертеже шага проверяемых отношений (∥ x, линия связи, ∈, ∩, ⟂)'});
  const P={v:V,id:o.id,src:o.src,type,title,goal:title||body.slice(0,120),
    why:whyRaw?{text:cleanWhy(whyRaw),src:st.why?'wb.why':'dz.principle'}:{text:'',src:null},
    entities:ents,labels:lab,facts:F,secrets:{labels:secLabels,entities:secEnts,numbers:true,values:uniq((body.match(/\d+[.,]\d+|\d{2,}(?=\s*(?:мм|°))/g)||[]).slice(0,12))},
    rungs:[],mistakes:[],key_view:null,topics:[],todo};
  if(!whyRaw) todo.push({field:'why',why:'у шага нет обоснования «почему» в задаче'});
  if(!title) todo.push({field:'goal',why:'у шага нет заголовка — цель взята из текста'});
  /* ступени */
  const A=SV.analyze(part,k)||{beats:[]};
  const supKnown=uniq(A.beats.flatMap(b=>b.sup.map(x=>x.l)).filter(l=>rl[0].includes(l))).slice(0,4);
  const L=D.LINT, ok=(t,r)=>L?L.lint(t,P,r).ok:true;
  const mk=(k2,name,text,src,extra)=>Object.assign({k:k2,name,text,src,labels:rl[k2]},extra||{});
  const pick=(r,arr)=>{ for(const [t,src] of arr) if(t&&ok(t,r)) return [t,src]; return [arr[arr.length-1][0],arr[arr.length-1][1]+':lint-fail']; };
  const q0=pick(0,[[Q0[type],'template:'+type],[Q0.construct,'template:construct'],['Что нужно получить на этом шаге?','template:min']]);
  P.rungs.push(mk(0,'вопрос',q0[0],q0[1]), mk(1,'приём','','',{}), mk(2,'объект','','',{}), mk(3,'действие','','',{}));
  /* Р1: обоснование автора, если оно проходит линтер на Р1; иначе приём по типу шага */
  const w=firstSent(cleanWhy(whyRaw),300); const r1=pick(1,[[w,st.why?'wb.why':'dz.principle'],[R1T[type],'template:'+type],[R1T.construct,'template:construct']]); P.rungs[1].text=r1[0]; P.rungs[1].src=r1[1];
  if(P.rungs[1].src.startsWith('template')&&w) P.rungs[1].note='обоснование автора не прошло линтер на Р1 (метки нового шага или числа) — взят шаблон';
  /* Р2: опоры шага и разрешённый факт о них */
  { const f2=F.find(f=>f.verified&&f.rung<=2&&f.args.some(a=>supKnown.includes(a)||newLines.includes(a)));
    let t=supKnown.length?'Опора этого шага — '+supKnown.join(', ')+'.':'Опора этого шага — то, что уже построено.';
    if(newLines.length) t+=' Понадобится новая линия '+newLines.slice(0,2).join(', ')+'.';
    if(f2) t+=' Известно: '+f2.text+'.';
    if(!ok(t,2)) t=supKnown.length&&ok('Опора этого шага — '+supKnown.join(', ')+'.',2)?'Опора этого шага — '+supKnown.join(', ')+'.':'Опора этого шага — то, что уже построено.';
    P.rungs[2].text=t; P.rungs[2].src='template:support'+(f2?'+fact':''); if(!supKnown.length) todo.push({field:'rungs.2',why:'опоры шага не найдены анализом чертежа — Р2 общий'}); }
  /* Р3: действие по подшагам (без искомого) */
  { let t=r3From(A.beats,new Set(secLabels.concat(secEnts)));
    if(!t||!ok(t,3)){ const t2=A.beats.length?r3From(A.beats.slice(0,1),new Set(secLabels.concat(secEnts))):''; t=t2&&ok(t2,3)?t2:'';
      if(!t){ t='Построй то, что названо в цели шага, от опор: '+(supKnown.join(', ')||'уже построенных точек')+'.'; if(!ok(t,3)) t='Построй то, что названо в цели шага, от уже построенных точек и линий.'; todo.push({field:'rungs.3',why:'действие из подшагов не прошло линтер — Р3 общий'}); } }
    P.rungs[3].text=t; P.rungs[3].src='stepview'; }
  /* Р4: соседний вариант */
  const nb=D.neighbor?D.neighbor(k):null;
  P.rungs.push(mk(4,'пример',nb?'Посмотри этот же шаг на соседнем варианте, потом сделай на своём.':'',nb?'neighbor':'todo',{neighbor:nb}));
  if(!nb) todo.push({field:'rungs.4',why:o.noNeighborWhy||'нет соседнего варианта этой задачи'});
  /* ошибки */
  const M=[]; (GEN_MIST[type]||[]).forEach(m=>M.push(Object.assign({},m)));
  const cp=D.CP||{};
  if(cp.cp47&&(type==='perp'||type==='nv')){ const src=type==='perp'?cp.cp47.KOPT:cp.cp47.NVOPT; const seen=new Set();
    Object.entries(src).forEach(([id,v])=>{ if(v.ok) return; const key=v.fault||id; if(seen.has(key)) return; seen.add(key); M.push({id:'cp47.'+key,what:strip(v.what),why:strip(v.why||''),detect:o.task&&+o.task.n===47?'core/cp47.js: операция над верной программой, judge() — сдвиг K и |AK|':'TODO: программа построения есть только для № 47',src:'core/cp47.js'}); }); }
  if(cp.cp46&&(type==='intersect'||type==='mediator'||type==='visibility')){ const src=type==='visibility'?cp.cp46.VOPT:cp.cp46.POPT;
    Object.entries(src).forEach(([id,v])=>{ if(v.ok) return; M.push({id:'cp46.'+id,what:strip(v.what),why:strip(v.why||''),detect:o.task&&+o.task.n===46?'core/cp46.js: judge() — точки 5, 6 и узор видимости против сертификата t46':'TODO: программа построения есть только для № 46',src:'core/cp46.js'}); }); }
  /* темы и ловушки подготовки */
  const G=D.PREPROG; if(G){ const own=G.ALL.filter(t=>(o.src.kind==='wb'?(t.wb||[]).includes(+o.src.task):(t.dz||[]).includes(o.src.dz))).map(t=>t.id);
    const want=TYPE_TOPICS[type]||[]; let tp=own.filter(x=>want.includes(x)); if(!tp.length) tp=want.filter(x=>G.BY[x]).slice(0,2); if(!tp.length) tp=own.slice(0,2);
    P.topics=tp; if(!tp.length) todo.push({field:'topics',why:'ни одна тема kernel/prep.js не закрывает эту задачу'});
    const PT=D.PREP&&D.PREP.TOPICS; if(PT) tp.forEach(id=>{ const tt=PT[id]; if(!tt||!tt.traps) return; Object.entries(tt.traps).forEach(([key,tr])=>M.push({id:'prep.'+id+'.'+key,what:strip(tr.say),detect:'prep: карточка-дуэль — чертёж с ловушкой отличается элементами '+(tr.hl||[]).join(', ')+'; точка проверяется в пространстве (tests/prep.js)',src:'prep/ ('+id+')'})); }); }
  P.mistakes=M.slice(0,14); if(!M.length) todo.push({field:'mistakes',why:'для типа шага «'+type+'» нет ни библиотеки ошибок ядра, ни ловушек подготовки'});
  /* ракурс */
  P.key_view=KEYVIEW[type]?Object.assign({target:(newLines[0]||supKnown[0]||null)},KEYVIEW[type](title+' '+body)):null;
  if(!P.key_view) todo.push({field:'key_view',why:'ключевой ракурс для типа «'+type+'» не задан'});
  return P; }

/* ── обход: все шаги части ── */
function forPart(part,base,o){ const out=[]; (part.steps||[]).forEach((s,i)=>{ out.push(build(Object.assign({},o,{id:base+'.s'+(i+1),src:Object.assign({},o.src,{step:i+1}),part,k:i+1}))); }); return out; }

const TUTOR_PASSPORT={V,build,forPart,verifyFact,classify,cleanWhy,ladderBlocks,r3From,TYPES,TYPE_TOPICS,GEN_MIST};
if(typeof module!=='undefined'&&module.exports) module.exports=TUTOR_PASSPORT; else self.TUTOR_PASSPORT=TUTOR_PASSPORT;
})();
