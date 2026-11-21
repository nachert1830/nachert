#!/usr/bin/env node
/* ═══════════ Граф знаний с адресацией по содержимому и сертификатами: kb/graph.json ═══════════
   node tools/kb-graph.js            — собрать граф;   node tools/kb-graph.js --verify — проверить сохранённый граф.

   Зачем. ИИ-тренер не должен ничего утверждать о геометрии от себя (docs/AI-TUTOR-RESEARCH.md, §3). Каждое его утверждение —
   ссылка на узел графа. Граф устроен как git или блокчейн:
   - id узла = хеш (sha256, 16 знаков) от его содержимого и id всех узлов, на которые он опирается. Поменялся факт —
     поменялся его id и id всего, что на нём стоит; корневой хеш (root) меняется. Тренер, ссылающийся на старый id,
     сразу виден: такого узла больше нет.
   - Узел-факт (kind:'fact') несёт сертификат: имя проверки ядра и её входы. --verify заново исполняет ядро и сверяет числа.
     Факт без прошедшего сертификата в граф не попадает. Подделать факт, не сломав root и проверку, нельзя.
   - Ссылки (dep) только на уже существующие узлы — граф ацикличен по построению (Меркле-DAG).

   Виды узлов: topic (тема программы), trap (ловушка темы), dz (задание), variant (вариант ДЗ), op (построение варианта),
   step (кадр построения), fact (проверенное ядром утверждение). Сейчас сертифицированы факты ДЗ 1 по инже (сопряжения);
   начерт и ДЗ 2–6 инжи подключаются тем же способом — через свои ядра (core/certify.js, IG3). */
'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto'), ROOT=path.join(__dirname,'..');
global.self=global;
const R=p=>require(path.join(ROOT,p));
const K=R('core/conj.js'), IG1=R('dz/ig/1/variants.js'), IGP=R('kernel/prep-ig.js'); R('kernel/prep.js'); const NGP=self.PREPROG;
R('prep/engine.js'); ['x','x-b','t','base','sm','more','rest','space'].forEach(f=>R('prep/'+f+'.js')); const PT=self.PREP.TOPICS;
/* канонический JSON: ключи по алфавиту, числа — до 1e-6 мм (сертификат сверяет с допуском, хеш — от округлённого) */
const canon=v=>Array.isArray(v)?'['+v.map(canon).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}':
  typeof v==='number'?String(Math.round(v*1e6)/1e6):JSON.stringify(v);
const H=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
const r6=v=>Array.isArray(v)?v.map(r6):typeof v==='number'?Math.round(v*1e6)/1e6:v;

/* сертификаты: имя → функция (входы) → вычисленное значение; --verify сравнивает с записанным */
const CERTS={
  /* точка касания и центр сопряжения варианта: исполняем программу варианта заново */
  'conj.op':({variant,op})=>{ const r=K.run(IG1.V[variant]), o=r.ops.find(x=>x.name===op); return {O:o.O?r6(o.O):undefined,R:o.R,T:r6(o.T),ok:K.verify(o).every(c=>c.ok)}; },
  'conj.contour':({variant})=>{ const r=K.run(IG1.V[variant]); return {closed:!r.bad.some(b=>b.what==='разрыв контура'),smooth:!r.bad.length,pieces:r.contours.map(c=>c.length)}; }
};
function build(){
  const nodes={}, byKey={};
  const put=(key,kind,body,dep=[])=>{ dep.forEach(d=>{ if(!nodes[d]) throw new Error('ссылка на несуществующий узел '+d+' из '+key); });
    const id=H(kind+'|'+canon(body)+'|'+dep.slice().sort().join(',')); nodes[id]={id,kind,key,body,dep}; byKey[key]=id; return id; };
  /* темы: сначала те, на кого опираются (порядок программы гарантирует) */
  const topic=(t,subj)=>{ const tid=put('topic:'+t.id,'topic',{subj,id:t.id,t:t.t,new:t.new,gost:t.gost,src:t.src},(t.pre||[]).map(p=>byKey['topic:'+p]));
    (t.traps||[]).forEach((x,i)=>put(`trap:${t.id}:${i}`,'trap',{say:typeof x==='string'?x:x.say},[tid])); return tid; };
  NGP.ALL.forEach(t=>topic(Object.assign({},t,{traps:PT[t.id]?Object.values(PT[t.id].traps).map(x=>x.say):[]}),'ng'));
  IGP.ALL.forEach(t=>topic(Object.assign({},t,{traps:t.traps}),'ig'));
  /* ДЗ 1 инжи: варианты → построения → шаги и сертифицированные факты */
  const dz=put('dz:ig1','dz',{subj:'ig',id:'ig1',t:'Сопряжения'},IGP.need('ig1').size?[...IGP.need('ig1')].map(id=>byKey['topic:'+id]):[]);
  const OPTOP={LL:'g10',LC:'g11',CC:'g12',PC:'g8',TT:'g9'};
  for(const n of IG1.list){ const V=IG1.V[n], vid=put('variant:ig1:'+n,'variant',{n,title:V.title,note:V.note,given:r6(V.given)},[dz]);
    const r=K.run(V);
    r.ops.forEach((o,i)=>{ const kind=V.ops[i][1], tp=byKey['topic:'+OPTOP[kind]];
      const cert={name:'conj.op',in:{variant:n,op:o.name}}, val=CERTS['conj.op'](cert.in); if(!val.ok) throw new Error(`в.${n} ${o.name}: сертификат не прошёл`);
      const fid=put(`fact:ig1:${n}:${o.name}`,'fact',{claim:`${o.title}: центр, радиус и точки касания`,cert,val},[vid,tp]);
      const oid=put(`op:ig1:${n}:${o.name}`,'op',{name:o.name,kind,title:o.title},[vid,tp,fid]);
      o.steps.forEach((s,j)=>put(`step:ig1:${n}:${o.name}:${j}`,'step',{cap:s.cap,roles:[...new Set(s.els.map(e=>e.role))]},[oid,fid])); });
    const cin={variant:n}, cv=CERTS['conj.contour'](cin); if(!cv.smooth) throw new Error(`в.${n}: контур не гладкий`);
    put(`fact:ig1:${n}:contour`,'fact',{claim:'Контур замкнут, все стыки гладкие (кроме помеченных изломов)',cert:{name:'conj.contour',in:cin},val:cv},[vid,byKey['topic:g13']]); }
  /* корень Меркле: хеш отсортированных id */
  const ids=Object.keys(nodes).sort(); let level=ids; while(level.length>1){ const nx=[]; for(let i=0;i<level.length;i+=2) nx.push(H(level[i]+(level[i+1]||level[i]))); level=nx; }
  const kinds={}; ids.forEach(id=>kinds[nodes[id].kind]=(kinds[nodes[id].kind]||0)+1);
  return {root:level[0],count:ids.length,kinds,nodes:ids.map(id=>nodes[id])};
}
function verify(G){
  const errs=[], by=Object.fromEntries(G.nodes.map(n=>[n.id,n]));
  for(const n of G.nodes){
    if(H(n.kind+'|'+canon(n.body)+'|'+n.dep.slice().sort().join(','))!==n.id) errs.push(`${n.key}: id не совпадает с содержимым (узел изменён)`);
    n.dep.forEach(d=>{ if(!by[d]) errs.push(`${n.key}: ссылка на несуществующий ${d}`); });
    if(n.kind==='fact'){ const f=CERTS[n.body.cert.name]; if(!f){ errs.push(`${n.key}: неизвестный сертификат`); continue; }
      let v; try{ v=f(n.body.cert.in); }catch(e){ errs.push(`${n.key}: ядро упало: ${e.message}`); continue; }
      if(canon(v)!==canon(n.body.val)) errs.push(`${n.key}: ядро сейчас даёт другое значение`); } }
  const fresh=build(); if(fresh.root!==G.root) errs.push(`root: сохранён ${G.root}, по текущим данным ${fresh.root}`);
  return errs;
}
module.exports={build,verify,canon,H};
if(require.main===module){
  const file=path.join(ROOT,'kb/graph.json');
  if(process.argv.includes('--verify')){ const e=verify(JSON.parse(fs.readFileSync(file,'utf8'))); console.log(e.length?'НЕ СХОДИТСЯ:\n'+e.slice(0,20).join('\n'):'граф сходится'); process.exit(e.length?1:0); }
  const G=build(); fs.writeFileSync(file,JSON.stringify(G)); console.log(`kb/graph.json: ${G.count} узлов, root ${G.root}`,JSON.stringify(G.kinds));
}
