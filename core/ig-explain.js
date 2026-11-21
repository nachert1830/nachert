/* ═══════════ Инжа: «как строится этот элемент» — ответ из базы «каждая линия» ═══════════
   explain(L, fe, {topics}) → структура ответа про элемент fe варианта (L — dz/ig/<N>/lines/vNN.json):
     что дано и где; на каких видах его достраивают и откуда каждая координата (x — с главного, высота — с главного,
     глубина y — с вида сверху, радиус дуги среза шара — со следа); какие линии кривые (строятся по точкам); где невидим;
     в каких разрезах рассечён; на пересечении каких поверхностей лежат его линии; темы программы PREPIG и их ловушки.
   find(L, text) → номер элемента по словам студента («дырка», «паз», «Ø10», «вырез», «конус»…).
   say(ex) → короткий ответ без модели (шаблон), чтобы сайт отвечал и без ИИ; ИИ-тренер получает структуру и формулирует.
   Всё в ответе — из данных линии и модели; ничего не придумывается. */
(function(){
const VIEW={F:'главный вид',T:'вид сверху',L:'вид слева',Fs:'фронтальный разрез',Ls:'профильный разрез',Ts:'разрез А–А (на месте вида сверху)'};
const VIEW_IN={F:'на главном виде',T:'на виде сверху',L:'на виде слева',Fs:'во фронтальном разрезе',Ls:'в профильном разрезе',Ts:'в разрезе А–А'};
const SRC={F:'с главного вида',T:'с вида сверху',L:'с вида слева'};
const fm=v=>String(Math.round(v*10)/10).replace('.',',').replace('-','−');
/* поверхность → тип (для тем программы) */
const skind=s=>/^сфера/.test(s)?'sph':/^цилиндр/.test(s)?'cyl':/конус/.test(s)?'cone':/пирамида/.test(s)?'pyr':/призма/.test(s)?'prism':/плоскость среза/.test(s)?'cut':/^(грань|торец)/.test(s)?'plane':'other';
/* правила: какие темы программы участвуют в построении элемента */
function topicsFor(ex){
  const t=new Set(['v2']);                                      /* проекционная связь — всегда */
  const K=new Set(ex.surfaces.map(skind)), kind=ex.kind;
  if(ex.byView.some(v=>v.how.y)) t.add('v3');                  /* глубина с вида сверху от базы */
  if(K.has('cyl')){ t.add('v9'); if(kind==='отверстие') t.add('v11'); }
  if(K.has('cone')||K.has('pyr')) t.add('v8');
  if(K.has('sph')) t.add('k6');
  if(K.has('cut')){ t.add('k1'); t.add('k2'); if(K.has('cyl')) t.add('k4'); if(K.has('cone')) t.add('k5'); if(K.has('pyr')||K.has('prism')) t.add('k3'); }
  if(ex.curves) t.add('k2');
  if(ex.hidden) t.add('v6');
  if(ex.sections.length){ t.add('r1'); t.add('r2'); }
  if(kind==='отверстие'&&ex.sections.length) t.add('r8');
  return [...t];
}
function explain(L,fe,{topics}={}){
  const f=L.feats[fe]; if(!f) return null;
  const ls=L.lines.filter(l=>l.fe===fe), given=new Set(), byV={};
  const surfaces=new Set(), sections=[]; let curves=0, hidden=0;
  for(const l of ls){
    (l.s||[]).forEach(s=>surfaces.add(s));
    if(l.how&&l.how.given){ given.add(l.v); continue; }
    if(l.how&&l.how.sec){ if(!sections.some(s=>s.v===l.v)) sections.push({v:l.v,plane:l.how.sec}); continue; }
    const b=byV[l.v]||(byV[l.v]={v:l.v,n:0,curves:0,hidden:0,step:new Set(),how:{},rad:[]});
    b.n++; if(l.t==='a'){ b.curves++; curves++; } if(!l.vis){ b.hidden++; hidden++; } if(l.step) b.step.add(l.step);
    const h=l.how||{};
    if(h.x) b.how.x=h.x; if(h.z) b.how.z=typeof h.z==='string'?h.z:'F';
    if(h.y){ b.how.y=b.how.y||new Set(); h.y.forEach(v=>b.how.y.add(Math.round(v*10)/10)); }
    if(h.rad) b.rad.push(h.rad);
  }
  const byView=Object.values(byV).map(b=>Object.assign(b,{step:[...b.step],how:Object.assign({},b.how,b.how.y?{y:[...b.how.y].sort((a,c)=>a-c)}:{})}));
  const ex={dz:L.dz,n:L.n,title:L.title,fe,name:f.name,kind:f.kind,given:[...given],byView,sections,surfaces:[...surfaces],curves,hidden,lines:ls.length};
  ex.topics=topicsFor(ex);
  if(topics) ex.traps=ex.topics.flatMap(id=>topics.BY[id]?topics.BY[id].traps.slice(0,2).map(s=>({topic:id,say:s})):[]);
  return ex;
}
/* слова студента → элемент */
const SYN=[[/дыр|отв|сквозн/i,['отверстие','Отверстие','отверст']],[/паз|канавк|прорез/i,['Паз','паз']],[/вырез|выем|K\b|К\b/i,['Вырез','вырез','Выемк','выемк']],
  [/шар|сфер/i,['Шар','сфер']],[/полост/i,['полость']],[/конус/i,['конус']],[/цилиндр/i,['Цилиндр','цилиндр']],[/пирамид/i,['ирамид']],[/призм/i,['ризм']],
  [/ребр|рёбр/i,['ребро','Ребро']],[/лап|ушк|проуш/i,['Параллелепипед','лап']],[/корпус|основан|тело|деталь/i,['тело']]];
function find(L,text){
  const q=String(text||''); const dia=(q.match(/[ØøФф⌀]\s*(\d+)|диаметр\w*\s*(\d+)|\b(\d+)\s*мм/)||[]).slice(1).find(Boolean);
  const sc=L.feats.map(f=>{ let s=0; if(dia&&f.name.includes('Ø'+dia)) s+=5;
    SYN.forEach(([re,keys])=>{ if(re.test(q)&&keys.some(k=>f.name.includes(k)||f.kind===k)) s+=2; });
    q.toLowerCase().split(/\s+/).filter(w=>w.length>3).forEach(w=>{ if(f.name.toLowerCase().includes(w.slice(0,5))) s+=1; });
    return {i:f.i,s}; }).sort((a,b)=>b.s-a.s);
  return sc[0]&&sc[0].s>0?sc.filter(x=>x.s===sc[0].s).map(x=>x.i):[];
}
/* ответ без модели: 3–6 коротких фраз, только из структуры */
function say(ex){
  if(!ex) return 'Такого элемента в варианте нет.';
  const out=[`${ex.name} — ${ex.kind}.`];
  if(ex.given.length) out.push(`Дано ${ex.given.map(v=>VIEW_IN[v]).join(' и ')} — с этого и начинаем.`);
  for(const b of ex.byView){ const parts=[];
    if(b.how.x) parts.push('положение по ширине — '+SRC[b.how.x]);
    if(b.how.z) parts.push('высоты — '+SRC[b.how.z]);
    if(b.how.y) parts.push('глубины — '+SRC.T+(b.how.y.length<=4?' ('+b.how.y.map(fm).join('; ')+' мм от оси)':''));
    if(b.rad.length) parts.push(`дуги среза шара: r = √(R² − d²), радиус — со следа грани`);
    const tail=[b.curves?'есть кривые — их строят по точкам':'',b.hidden?'часть линий невидима — штриховые':''].filter(Boolean);
    out.push(`${VIEW_IN[b.v][0].toUpperCase()+VIEW_IN[b.v].slice(1)} достраиваем: ${parts.length?parts.join(', '):'по проекционной связи'}${tail.length?'; '+tail.join(', '):''}.`); }
  if(ex.sections.length) out.push('Попадает в разрез: '+ex.sections.map(s=>VIEW_IN[s.v]).join(', ')+' — там контур сплошной, материал вокруг штрихуется'+(ex.kind==='отверстие'?', само отверстие — нет':'')+'.');
  return out.join(' ');
}
const api={explain,find,say,topicsFor,VIEW,VIEW_IN};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else self.IGX=api;
})();
