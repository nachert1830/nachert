/* Наставник: сверщик. Студент не видит непроверенного утверждения о чертеже.
   Из ответа модели выделяется то, что можно проверить по ядру:
     • точки — «точка 9», «9′», «точки 5–12», «точки 5, 7 и 9»: номер есть в реестре варианта;
     • шаги — «шаг 5», «на шаге 11»: номер 1…N;
     • числа-размеры — «30 мм», «x = −30», «(−30; 100)», «глубина 25,8», углы «73,7°»: число есть среди фактов, которые студенту уже
       открыты (то, что вернули инструменты с учётом лесенки, и то, что открыто в прошлых репликах) или которые назвал сам
       студент. Значит, координаты закрытого лесенкой шага — тоже нарушение: их нет среди открытых фактов.
   check(text, ctx) → {ok, violations:[{kind, what, sentence}]}; cut(text, violations) — убрать фразы с нарушениями. */
'use strict';
const NUM='[−-]?\\d+(?:[.,]\\d+)?';
const num=s=>parseFloat(String(s).replace('−','-').replace(',','.'));

/* все числа из любого объекта/текста — факты */
function numbersOf(x,out){ out=out||[]; if(x==null) return out;
  if(typeof x==='number'){ if(isFinite(x)){ out.push(x); out.push(Math.abs(x)); } return out; }
  if(typeof x==='object'){ Object.values(x).forEach(v=>numbersOf(v,out)); return out; }   /* обход, не JSON: в «[0,-50]» запятая — не десятичная */
  for(const m of String(x).matchAll(/[−-]?\d+(?:[.,]\d+)?/g)){ const v=num(m[0]); if(isFinite(v)){ out.push(v); out.push(Math.abs(v)); } }
  return out; }

/* предложения (с позицией) — резать по ним */
function sentences(text){ const out=[]; const re=/[^.!?\n]+(?:[.!?]+|\n|$)/g; let m;
  while((m=re.exec(text))){ if(!m[0].trim()){ if(re.lastIndex===m.index) re.lastIndex++; continue; } out.push({s:m[0],a:m.index,b:m.index+m[0].length}); }
  return out; }
const sentenceAt=(S,i)=>(S.find(x=>i>=x.a&&i<x.b)||{s:''}).s.trim();

function claims(text){ const out=[];
  /* точки: штрихи после номера (k″ k′ k‴, а также " и ' вместо штрихов) */
  for(const m of text.matchAll(/(?<![\d.,])(\d{1,3})\s?(″|′|‴|''|")(?!\d)/g)) out.push({kind:'point',n:+m[1],i:m.index,what:m[0]});
  /* «точка 9», «точки 5–12», «точки 5, 7 и 9», «точку 10» */
  for(const m of text.matchAll(/точк\p{L}*\s+((?:\d{1,3}(?:\s*[″′‴])?(?:\s*(?:[–—-]|,|и|или)\s*)?)+)/giu)){
    const body=m[1], rng=body.match(/(\d{1,3})\s*[″′‴]?\s*[–—-]\s*(\d{1,3})/);
    if(rng){ out.push({kind:'point',n:+rng[1],i:m.index,what:m[0].trim()}); out.push({kind:'point',n:+rng[2],i:m.index,what:m[0].trim()}); }
    for(const d of body.replace(/(\d{1,3})\s*[″′‴]?\s*[–—-]\s*(\d{1,3})/g,'').matchAll(/\d{1,3}/g)) out.push({kind:'point',n:+d[0],i:m.index,what:m[0].trim()}); }
  /* шаги */
  for(const m of text.matchAll(/шаг\p{L}*\s*(?:№\s*)?(\d{1,3})(?!\s*(?:мм|°|%))/giu)) out.push({kind:'step',n:+m[1],i:m.index,what:m[0]});
  /* числа-размеры */
  const seen=new Set(), addN=(v,i,what)=>{ const key=i+':'+v; if(seen.has(key)) return; seen.add(key); out.push({kind:'number',v:num(v),i,what}); };
  for(const m of text.matchAll(new RegExp('('+NUM+')\\s*(?:мм|mm)(?![\\p{L}])','gu'))) addN(m[1],m.index,m[0]);
  /* углы: «73,7°» (общие 0°, 90°, 180°, 270°, 360° — не проверяем) */
  for(const m of text.matchAll(new RegExp('('+NUM+')\\s*°','gu'))){ const v=Math.abs(num(m[1])); if(![0,90,180,270,360].includes(v)) addN(m[1],m.index,m[0]); }
  for(const m of text.matchAll(new RegExp('(?<![\\p{L}\\d])[xyzхуXYZХУ]\\s*=\\s*('+NUM+')','gu'))) addN(m[1],m.index+m[0].indexOf(m[1]),m[0]);
  for(const m of text.matchAll(new RegExp('\\(\\s*('+NUM+')\\s*;\\s*('+NUM+')(?:\\s*;\\s*('+NUM+'))?\\s*\\)','g'))) [m[1],m[2],m[3]].forEach(v=>{ if(v!=null) addN(v,m.index,m[0]); });
  for(const m of text.matchAll(new RegExp('(?:глубин|высот|ширин|габарит|расстояни|отступ|координат)\\p{L}*[^.\\d\\n]{0,24}?('+NUM+')','giu'))) addN(m[1],m.index+m[0].lastIndexOf(m[1]),m[0]);
  return out; }

/* ctx: {points:Set номеров, steps:N, facts:[числа], quoted:[числа из реплики студента]} */
function check(text,ctx){ text=String(text||''); const S=sentences(text), V=[];
  const facts=ctx.facts||[], quoted=ctx.quoted||[], near=(v,L)=>L.some(f=>Math.abs(f-v)<=0.11);
  for(const c of claims(text)){
    if(c.kind==='point'&&!ctx.points.has(c.n)) V.push({kind:'point',what:c.what,n:c.n,sentence:sentenceAt(S,c.i)});
    if(c.kind==='step'&&(c.n<1||c.n>ctx.steps)) V.push({kind:'step',what:c.what,n:c.n,sentence:sentenceAt(S,c.i)});
    if(c.kind==='number'&&!near(c.v,facts)&&!near(c.v,quoted)) V.push({kind:'number',what:c.what,v:c.v,sentence:sentenceAt(S,c.i)}); }
  /* одно нарушение на фразу и вид */
  const uniq=[], k=new Set(); V.forEach(v=>{ const key=v.kind+'|'+v.sentence+'|'+(v.n!=null?v.n:v.v); if(!k.has(key)){ k.add(key); uniq.push(v); } });
  return {ok:!uniq.length,violations:uniq}; }

function cut(text,violations){ const bad=new Set(violations.map(v=>v.sentence).filter(Boolean)); let out='';
  for(const s of sentences(String(text||''))) if(!bad.has(s.s.trim())) out+=s.s;
  return out.replace(/\n{3,}/g,'\n\n').trim(); }

/* объяснение для модели: что переписать */
function explain(violations){ return violations.slice(0,8).map(v=>v.kind==='point'?'— точки '+v.n+' в этом варианте нет («'+v.what+'»)':
  v.kind==='step'?'— шага '+v.n+' нет («'+v.what+'»)':'— число '+String(v.v).replace('.',',')+' не взято из инструментов или ещё закрыто лесенкой («'+v.what+'»)').join('\n'); }

module.exports={check,cut,claims,numbersOf,explain,sentences};
