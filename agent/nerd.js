/* ═══════════ Зануда: сертификат core/certify.js для плана LLM ═══════════
   План превращается в протокол задачи того же вида, что core/t47.js:
     • ядро 3D находит K по определению (K = a ∩ α, α ⟂ a через A) — без плана;
     • ядро 2D исполняет план LLM точно (agent/exact-plan.js);
     • certify() проверяет обязательства сертификата без изменений и без ослаблений:
       O9 — условие, данное модели текстом, совпадает с вариантом генератора (два ввода);
       O1 — проекции K″, K′ плана и квадрат |AK| совпадают с пространством точно;
       O2, O3 — ответ удовлетворяет условию и совпадает с независимым решателем t47.spec;
       O6 — ни одно пересечение плана не острее 8°;
       O4, O5 — то, что выдаётся пользователю (координаты из core/cp.js и число «|AK| ≈ N мм»), совпадает
                с доказанным (до 1e-6 мм; округление √ — доказательно);
       O7 — тот же план как способ верен на 200 случайных вариантах данных.
   Вердикт — только c.ok сертификата. Подсказки для модели (diagnose) на вердикт не влияют. */
const {q,V}=require('../core/exact.js');
const {K3,K2,PR}=require('../core/kernels.js');
const {certify}=require('../core/certify.js');
const T47=require('../core/t47.js');
const {execExact}=require('./exact-plan.js');
const {gammaOf}=require('./variants.js');

const OBL={O1:'построение совпадает с пространством',O2:'ответ удовлетворяет условию',O3:'ответ совпадает с независимым решением',
  O4:'выданные координаты совпадают с доказанными',O5:'выданное число совпадает с доказанным',O6:'пересечения не острее 8°',
  O7:'способ верен на 200 случайных вариантах',O9:'условие прочитано без расхождений'};

function taskFor(v,prog){
  return {
    n:47, title:'Расстояние от точки A до прямой a (план LLM)', k:'1',
    entries:[v.entry,v.entry2], gamma:gammaOf,
    given3(M,G){ M.A=G.A; M.a=K3.line(G.aP(0),G.aP(1)); },
    given2(E,G,k){ E['A″']=PR[2](G.A,k); E['A′']=PR[1](G.A,k);
      E['a″']=K2.line(PR[2](G.aP(0),k),PR[2](G.aP(1),k)); E['a′']=K2.line(PR[1](G.aP(0),k),PR[1](G.aP(1),k)); },
    steps:[{ id:'plan', title:'план построения',
      do3(M){ M.alpha=K3.plane(M.A,M.a.d); M.K=K3.meet(M.a,M.alpha); M.AK2=K3.dist2(M.A,M.K); },
      do2(E){ execExact(prog,E);
        ['K″','K′'].forEach(n=>{ if(!(Array.isArray(E[n])&&E[n].length===2)) throw new Error(n+' — не точка, построенная линейкой и угольником'); });
        if(!E['|AK|']||!E['|AK|'].sq) throw new Error('|AK| — не число'); E.AK2=E['|AK|'].sq; },
      claims:[['K','point'],['AK2','scalar']] }],
    spec:T47.spec,
    answer:{name:'|AK|',value:M=>K3.dist2(M.A,M.K),re:/\|AK\|\s*≈\s*(\d+)\s*мм/},
    site:{points:{'A″':'A','A′':'A','K″':'K','K′':'K'},lines:{}},
    randomGamma:T47.randomGamma };
}

/* то, что увидит пользователь: только из исполнения core/cp.js (мм листа) */
function deliverable(E){ const r=x=>+x.toFixed(6);
  return {'K″':E['K″'].map(r),'K′':E['K′'].map(r),'|AK|':+E['|AK|'].toFixed(6),text:'|AK| ≈ '+Math.round(E['|AK|'])+' мм'}; }
function siteOf(E,v){ const g={'A″':E['A″'],'A′':E['A′'],'K″':E['K″'],'K′':E['K′']};
  return {points:g,lines:{},segs:[],ans:deliverable(E).text}; }

function check(v,prog,Efloat,opts){ opts=opts||{};
  const task=taskFor(v,prog), c=certify(task,{site:siteOf(Efloat,v),variants:opts.variants});
  const failed=Object.entries(c.O).filter(([,o])=>!o.ok).map(([k])=>k);
  return {ok:c.ok,failed,O:Object.fromEntries(Object.entries(c.O).map(([k,o])=>[k,{ok:o.ok,detail:o.detail}]))}; }

/* текст ошибки для модели: какие обязательства не выполнены и что не так — без верного ответа */
const redact=s=>s.replace(/проекция точки пространства \([^)]*\)/g,'проекция точки пространства — другая')
  .replace(/, в пространстве -?[\d.]+/g,', в пространстве — другое').replace(/доказанное значение \d+ мм/g,'доказанное значение — другое');
function feedback(cert,diag){ const out=cert.failed.map(k=>'['+k+' — '+OBL[k]+'] не выполнено: '+redact(cert.O[k].detail));
  return out.concat(diag.map(d=>'подсказка: '+d)); }

/* качественная диагностика по точному исполнению плана: что именно нарушено (без чисел ответа) */
function diagnose(v,prog){ const out=[], G=v.G, E={}, k=q(1);
  E['A″']=PR[2](G.A,k); E['A′']=PR[1](G.A,k); E['a″']=K2.line(PR[2](G.aP(0),k),PR[2](G.aP(1),k)); E['a′']=K2.line(PR[1](G.aP(0),k),PR[1](G.aP(1),k));
  let r; try{ r=execExact(prog,E); }catch(e){ out.push('точное исполнение: '+e.message); return out; }
  const Kf=E['K″'], Kh=E['K′']; if(!Array.isArray(Kf)||!Array.isArray(Kh)) return out;
  const onF=K2.on(Kf,E['a″']), onH=K2.on(Kh,E['a′']), link=Kf[0].eq(Kh[0]);
  if(!onF) out.push('K″ не лежит на a″'); if(!onH) out.push('K′ не лежит на a′'); if(!link) out.push('K″ и K′ не на одной линии связи');
  if(onF&&onH&&link){ const K=[Kf[0].neg(),Kh[1],Kf[1].neg()], d=V.sub(G.aP(1),G.aP(0));
    const perp=V.dot(V.sub(K,G.A),d).isZero();
    if(!perp) out.push('K лежит на a, но AK не перпендикулярна a — это не основание перпендикуляра');
    else if(!E['|AK|'].sq.eq(K3.dist2(G.A,K))) out.push('K построена верно, но |AK| не равна длине отрезка AK — натуральная величина построена неверно'); }
  const sharp=r.angles.filter(a=>a.sin2<Math.sin(8*Math.PI/180)**2);
  sharp.forEach(a=>out.push('шаг '+(a.i+1)+' («'+a.id+'»): прямые пересекаются под углом '+(Math.asin(Math.sqrt(a.sin2))*180/Math.PI).toFixed(1)+'° — на бумаге неточно; выберите другой способ или посредник'));
  return out; }

module.exports={taskFor,check,feedback,diagnose,deliverable,OBL};
