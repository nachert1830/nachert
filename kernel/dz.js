/* ═══════════ Реестр домашних заданий ═══════════
   Каждое ДЗ — папка dz/<курс>/<номер>/ (оглавление — dz/README.md):
     variants.js — данные всех вариантов и типы вариантов;  method.js — методика;  solver.js — программа решения.
   Файлы дописывают описание ДЗ в реестр:  DZR.def('ng1', {…}). Сайт и проверки работают только через реестр:
     DZR.list('ng')            — задания курса по порядку;
     DZR.get('ng1')            — описание: course, num, title, short, types, variants, method, solve, has;
     DZR.typeOf('ng1', 17)     — тип варианта (по номеру);
     DZR.numbers('ng1')        — варианты, которые ядро уже решает;
     DZR.solve('ng1', 17)      — {task — разбор в формате плеера (3D — по нему же), answers, cert — нарушения условия}.
   Решатель: DZR.def('ng2', {solve:(n, D, src, d) → {task, answers, cert}, has:n → решает ли этот тип}); src — помощники
   варианта (kind, text, points, params), D — данные варианта.
   Идентификаторы: ng1…ng5 — начертательная геометрия, ДЗ №1…№5; ig2…ig4 — инженерная графика, задания 2…4. */
(function(){
const defs={};
/* из таблицы типов и данных — помощники варианта: kind(n) — код типа, text(n) — условие, points(n) — точки таблицы,
   params(n) — числа условия, которых нет в таблице (высота 80 мм, размеры поверхности…) */
function prep(d){ if(!d.V||!d.types) return;
  const ty=n=>d.types.find(t=>+n>=t.from&&+n<=t.to)||null;
  d.label=(d.course==='ng'?'ДЗ №':'Задание №')+d.num;
  d.variants={V:d.V,title:d.label+' · '+d.title,kind:n=>(ty(n)||{}).code||null,text:n=>(ty(n)||{}).text||'',
    points:n=>(ty(n)||{}).given||d.given||[],params:n=>d.params?d.params(+n):Object.assign({},(ty(n)||{}).params||{})}; }
const DZR={
  def(id,part){ const d=defs[id]||(defs[id]={id}); Object.assign(d,part); prep(d); return d; },
  get(id){ return defs[id]||null; },
  all(){ return Object.values(defs); },
  list(course){ return Object.values(defs).filter(d=>d.num&&(!course||d.course===course)).sort((a,b)=>(a.course===b.course?0:a.course==='ng'?-1:1)||a.num-b.num); },
  typeOf(id,n){ const d=defs[id]; return d&&d.types?d.types.find(t=>+n>=t.from&&+n<=t.to)||null:null; },
  /* решено ли: у НГ — решатель по данным варианта (solve), у ИГ — 3D-модель детали (part) */
  has(id,n){ const d=defs[id]; if(!d) return false; if(d.part){ try{ return !!d.part(+n); }catch(e){ return false; } }
    return !!(d.V&&d.V[n]&&d.solve&&(!d.has||d.has(+n))); },
  numbers(id){ const d=defs[id]; if(!d) return []; const all=d.V?Object.keys(d.V).map(Number):Array.from({length:d.count||0},(_,i)=>i+1); return all.filter(n=>DZR.has(id,n)); },
  solve(id,n){ n=+n; const d=defs[id]; if(!d||!d.V||!d.V[n]) return {why:'нет варианта '+id+' №'+n};
    if(!DZR.has(id,n)) return {why:'решение этого типа ещё в работе'};
    const r=d.solve(n,d.V[n],d.variants,d); if(r&&r.task) r.task.dzId=id; return r; },
  /* для листа: заголовок, данные, обозначения точек таблицы */
  meta(id,n){ const d=defs[id]; return {title:d.label,sub:d.title,n:+n,points:d.variants.points(+n),data:d.V[+n]}; } };
self.DZR=DZR;

/* ── совместимость: прежний интерфейс разборов ДЗ (NGHW) — им пользуются поиск сайта и проверки tests/ ──
   id: '1', '2' (2а), '2b', '2c', '3', '4a', '4b', '5'. task — разобранный пример этого типа (DZR.get(…).examples). */
const LEGACY={'1':['ng1','tri'],'2':['ng2','2a'],'2b':['ng2','2b'],'2c':['ng2','2c'],'3':['ng3','3'],'4a':['ng4','4a2'],'4b':['ng4','4b3'],'5':['ng5','cone']};
const norm=id=>{ id=String(id==null?'':id).toLowerCase(); return {'4':'4a','4б':'4b','4а':'4a','2а':'2','2a':'2','2б':'2b','2в':'2c'}[id]||id; };
const strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const RU=new WeakSet();
function exampleTask(id){ const L=LEGACY[id], d=L&&DZR.get(L[0]), f=d&&d.examples&&d.examples[L[1]]; if(!f) return null;
  const t=f(); if(t&&!RU.has(t)){ RU.add(t); try{ WB3.ruDec(t); }catch(e){} } return t; }
function methodText(d){ const m=d&&d.method; if(!m) return strip([d&&d.short,d&&d.text].join(' '));
  const T=m.types||{}; return strip([d.short,m.essence,m.idea,Object.values(T).map(t=>[t.idea,(t.plan||[]).map(p=>p.t+' '+p.d).join(' '),(t.mistakes||[]).join(' '),(t.defense||[]).map(q=>q.q+' '+q.a).join(' ')].join(' ')).join(' '),
    (m.mistakes||[]).join(' '),(m.defense||[]).map(q=>q.q+' '+q.a).join(' ')].join(' ')); }
self.NGHW={
  /* для поиска: по записи на ДЗ */
  list(){ return DZR.list().map(d=>({n:(d.course==='ig'?'ИГ №':'№')+d.num,title:d.title,kw:(d.kw||[]).join('; '),body:methodText(d),href:'#/'+d.id})); },   /* короткий адрес ДЗ: #/ng4, #/ig3 */
  get(id){ id=norm(id); const L=LEGACY[id], d=L&&DZR.get(L[0]); if(!d) return null; const task=exampleTask(id);
    return {n:id,id,dz:L[0],type:L[1],num:'№'+(id==='2'?'2а':id==='2b'?'2б':id==='2c'?'2в':id==='4a'?'4а':id==='4b'?'4б':id),title:d.title,task,body:methodText(d),steps:task?(task.parts||[task]).reduce((s,p)=>s+(p.steps||[]).length,0):0}; },
  /* разбор на данных D программой примера (HW.calcOf / HW.taskOf); пример сайта при этом не меняется */
  variant(id,D){ const HW=self.NGLIB&&NGLIB.HW; id=norm(id); const key=id==='2'||id==='3'||id==='5'?+id:id==='4a'?4:id; if(!HW||!HW.calcOf[key]||!HW.taskOf[key]) return null;
    const old=HW.calc[key]; try{ HW.calc[key]=HW.calcOf[key](D); const task=HW.taskOf[key](); try{ WB3.ruDec(task); WB3.snap(task); }catch(e){} return {calc:HW.calc[key],task}; }
    finally{ HW.calc[key]=old; } },
  get _HW(){ return self.NGLIB&&NGLIB.HW; } };
})();
