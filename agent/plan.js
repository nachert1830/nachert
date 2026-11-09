/* ═══════════ Исполнитель: план LLM → программа core/cp.js ═══════════
   parse(text)        — достать JSON плана из ответа модели;
   validate(plan)     — формат программы core/cp.js и правила исполнителя (имена, типы, арность, порядок);
   run(plan, given)   — исполнить ядром core/cp.js (cp.exec, мм листа, плавающая точка).
   Любая ошибка — {ok:false, stage, errors:[текст]}: понятный текст для модели, а не падение.

   Правило исполнителя «LLM не вычисляет»: аргументы — только имена построенных объектов; единственное число,
   которое модель может написать сама, — сторона откладывания side = 1 или −1 у perpOff. */
const cp=require('../core/cp.js');

/* сигнатуры действий cp.OPS: типы аргументов и результата (point / line / num; side — литерал ±1) */
const SIG={
  through:{args:['point','point'],res:'line',what:'прямая через две точки (линейка)'},
  seg:{args:['point','point'],res:'line',what:'отрезок PQ (та же прямая, рисуется от P до Q)'},
  parAxis:{args:['point'],res:'line',what:'прямая через P параллельно оси x (рейсшина)'},
  link:{args:['point'],res:'line',what:'линия связи через P (перпендикулярна оси x)'},
  perp:{args:['line','point'],res:'line',what:'прямая через P перпендикулярно прямой L (угольник), на том же поле'},
  par:{args:['line','point'],res:'line',what:'прямая через P параллельно прямой L'},
  meet:{args:['line','line'],res:'point',what:'точка пересечения двух прямых'},
  foot:{args:['point','line'],res:'point',what:'основание перпендикуляра из P на прямую L'},
  perpOff:{args:['point','point','num','side?'],res:'point',what:'от P перпендикулярно PQ отложить длину s (циркуль); side = 1 или -1 — сторона'},
  along:{args:['point','point','num'],res:'point',what:'от P по лучу P→Q отложить длину s'},
  shiftU:{args:['point','num'],res:'point',what:'точка P, сдвинутая вдоль оси x на s (вправо)'},
  dv:{args:['point','point'],res:'num',what:'|vP − vQ|: разность отступов от оси x (Δz на π₂, Δy на π₁)'},
  du:{args:['point','point'],res:'num',what:'|uP − uQ|: разность абсцисс на листе'},
  absV:{args:['point'],res:'num',what:'|vP|: отступ точки от оси x'},
  dist:{args:['point','point'],res:'num',what:'расстояние |PQ| (циркуль)'},
};
const GIVEN_KIND={'A″':'point','A′':'point','a″':'line','a′':'line','x':'line'};
const OUTPUT={'K″':'point','K′':'point','|AK|':'num'};
const MAX_STEPS=80;

/* JSON из ответа модели: целиком, из ```json …```, или первый {...} верхнего уровня */
function parse(text){
  if(typeof text!=='string'||!text.trim()) return {ok:false,stage:'parse',errors:['пустой ответ: нужен JSON вида {"steps":[...]}']};
  const tries=[text.trim()], m=/```(?:json)?\s*([\s\S]*?)```/i.exec(text); if(m) tries.push(m[1].trim());
  const a=text.indexOf('{'), b=text.lastIndexOf('}'); if(a>=0&&b>a) tries.push(text.slice(a,b+1));
  let last='';
  for(const t of tries){ try{ const v=JSON.parse(t); return {ok:true,plan:v}; }catch(e){ last=e.message; } }
  return {ok:false,stage:'parse',errors:['ответ не разбирается как JSON ('+last+'). Нужен один объект {"steps":[...]} без комментариев']}; }

function validate(plan){
  const errs=[], push=(i,id,msg)=>errs.push('шаг '+(i+1)+(id!=null?' («'+id+'»)':'')+': '+msg);
  if(!plan||typeof plan!=='object'||Array.isArray(plan)) return {ok:false,stage:'validate',errors:['план — объект {"steps":[...]}']};
  const steps=plan.steps;
  if(!Array.isArray(steps)||!steps.length) return {ok:false,stage:'validate',errors:['нет непустого массива "steps"']};
  if(steps.length>MAX_STEPS) return {ok:false,stage:'validate',errors:['слишком длинный план: '+steps.length+' шагов (не больше '+MAX_STEPS+')']};
  const kind=Object.assign({},GIVEN_KIND), clean=[];
  steps.forEach((st,i)=>{
    if(!st||typeof st!=='object'){ push(i,null,'шаг — объект {"id","op","args"}'); return; }
    const {id,op,args}=st;
    if(typeof id!=='string'||!id.trim()){ push(i,null,'нет имени "id" (строка)'); return; }
    if(GIVEN_KIND[id]){ push(i,id,'имя занято данными условия ('+Object.keys(GIVEN_KIND).join(', ')+')'); return; }
    if(kind[id]&&!GIVEN_KIND[id]){ push(i,id,'имя уже использовано в одном из предыдущих шагов — имена должны быть различны'); return; }
    const sg=SIG[op]; if(!sg){ push(i,id,'неизвестное действие "'+op+'". Доступны: '+Object.keys(SIG).join(', ')); return; }
    if(!Array.isArray(args)){ push(i,id,'"args" — массив'); return; }
    const need=sg.args.filter(a=>!a.endsWith('?')).length;
    if(args.length<need||args.length>sg.args.length){ push(i,id,op+' принимает '+(need===sg.args.length?need:need+'–'+sg.args.length)+' аргумента ('+sg.args.join(', ')+'), дано '+args.length); return; }
    let bad=false;
    args.forEach((a,j)=>{ const want=sg.args[j].replace('?','');
      if(want==='side'){ if(a!==1&&a!==-1){ push(i,id,'side у perpOff — число 1 или -1, дано '+JSON.stringify(a)); bad=true; } return; }
      if(typeof a!=='string'){ push(i,id,'аргумент '+(j+1)+' — имя построенного объекта, а не '+JSON.stringify(a)+' (числа модель не вычисляет: длины берутся действиями dv, du, absV, dist)'); bad=true; return; }
      if(!kind[a]){ push(i,id,'аргумент «'+a+'» ещё не построен (объект должен быть создан в одном из предыдущих шагов или быть данным условия)'); bad=true; return; }
      if(kind[a]!==want){ push(i,id,op+': аргумент '+(j+1)+' «'+a+'» — '+ru(kind[a])+', а нужна '+ru(want)); bad=true; } });
    if(bad) return;
    kind[id]=sg.res; clean.push({id,op,args:args.slice()}); });
  Object.entries(OUTPUT).forEach(([n,k])=>{ if(!kind[n]) errs.push('в плане не построен обязательный результат «'+n+'» ('+ru(k)+')');
    else if(kind[n]!==k) errs.push('«'+n+'» должен быть '+ru(k)+', а построен как '+ru(kind[n])); });
  return errs.length?{ok:false,stage:'validate',errors:errs}:{ok:true,prog:{n:47,steps:clean}}; }
const ru=k=>({point:'точка',line:'прямая',num:'число',side:'знак ±1'})[k]||k;

/* исполнение ядром core/cp.js; вырождения (параллельные прямые, совпавшие точки) — ошибки с именем шага */
function run(prog,given){
  const errs=[];
  let out; try{ out=cp.exec(prog,given); }catch(e){ return {ok:false,stage:'exec',errors:['исполнитель core/cp.js: '+e.message]}; }
  const {E,miss}=out;
  const lost=[];
  prog.steps.forEach((st,i)=>{ const v=E[st.id];
    if(miss.includes(st.id)){ const gone=st.args.filter(a=>typeof a==='string'&&E[a]==null);
      if(gone.length) lost.push(st.id);
      else errs.push('шаг '+(i+1)+' («'+st.id+'», '+st.op+'): не построен — '+(st.op==='meet'?'прямые '+st.args.join(' и ')+' параллельны (не пересекаются)':'действие не дало результата'));
      return; }
    if(SIG[st.op].res==='line'&&(st.op==='through'||st.op==='seg')){ const [P,Q]=st.args.map(a=>E[a]); if(P&&Q&&Math.hypot(P[0]-Q[0],P[1]-Q[1])<1e-9) errs.push('шаг '+(i+1)+' («'+st.id+'»): точки '+st.args.join(' и ')+' совпадают — прямая не определена'); }
    if(st.op==='perpOff'||st.op==='along'){ const [P,Q]=st.args.map(a=>E[a]); if(P&&Q&&Math.hypot(P[0]-Q[0],P[1]-Q[1])<1e-9) errs.push('шаг '+(i+1)+' («'+st.id+'»): точки '+st.args.slice(0,2).join(' и ')+' совпадают — направление не определено'); }
    const finite=x=>typeof x==='number'?isFinite(x):Array.isArray(x)?x.every(finite):x&&typeof x==='object'?finite(x.p)&&finite(x.d):false;
    if(v!=null&&!finite(v)) errs.push('шаг '+(i+1)+' («'+st.id+'»): получилось не число'); });
  if(lost.length&&errs.length) errs.push('из-за этого не построены и следующие шаги: '+lost.join(', '));
  return errs.length?{ok:false,stage:'exec',errors:errs,E}:{ok:true,E}; }

module.exports={SIG,GIVEN_KIND,OUTPUT,parse,validate,run,MAX_STEPS};
