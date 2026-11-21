#!/usr/bin/env node
/* Ядро ИИ-тренера (core/tutor.js, kb/tutor/*.json).  node tests/tutor.js
   1. Данные: каждый шаг каждого варианта ДЗ 1–5 по начерту и ДЗ 2–6 по инже — с целью и ступенями 1–3; id уникальны;
      у каждого шага есть соседний вариант того же типа или с тем же приёмом (для ступени Р4).
   2. Шаблон без модели (fallback) на каждой ступени каждого шага проходит линтер — сайт может отвечать и без ИИ.
   3. Утечки: подсаженные в ответ найденная точка шага, вычисленное число шага, сырой текст «Шага» с найденными точками —
      линтер ловит все (до ступени Р4 своего варианта).
   4. Линтер на наборе заведомо плохих и хороших ответов.
   5. Автомат лестницы на сценариях §4.1: рост только после попытки или паузы, ошибка из библиотеки сначала не поднимает,
      Р4 — после двух ошибок на Р3, просьба без попытки — «попробуй сначала». */
'use strict';
const fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
const T=require(path.join(ROOT,'core/tutor.js'));
const fails=[], bad=s=>fails.push(s);
const DIR=path.join(ROOT,'kb/tutor'), files=fs.existsSync(DIR)?fs.readdirSync(DIR).filter(f=>/\.json$/.test(f)).sort():[];
if(files.length<10) bad('kb/tutor: нужны 10 файлов (ng1–ng5, ig2–ig6) — node tools/tutor-make.js');
const ids=new Set(); let N=0, NB=0, FB=0, LT=0, LC=0, NT=0, NC=0, RT=0, RC=0;
for(const f of files){ const D=JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'));
  for(const v of D.variants){ if(v.err){ bad(`${f} в.${v.n}: решатель упал: ${v.err}`); continue; }
    for(const s of v.steps){ N++;
      if(ids.has(s.id)) bad('повтор id '+s.id); ids.add(s.id);
      if(!s.goal||!s.rungs['1']||!s.rungs['2']||!s.rungs['3']) bad(`${s.id}: нет цели или ступеней 1–3`);
      if(!s.look||!s.look.cam||!s.look.t) bad(`${s.id}: нет ключевого ракурса`);
      if(!s.topics||!s.topics.length) bad(`${s.id}: шаг без темы программы`);
      const nb=T.neighborOf(D,s); if(nb) NB++;
      for(let r=0;r<=4;r++){ const c=T.context(s,r,{neighbor:nb,cond:v.q}), t=T.fallback(s,r,{neighbor:nb,cond:v.q}), L=T.lint(t,c);
        if(!L.ok){ FB++; if(FB<6) bad(`${s.id} Р${r}: шаблон не прошёл линтер — ${L.errors.map(e=>e.msg).join('; ')}`); } }
      const c2=T.context(s,2,{cond:v.q});
      c2.secret.labels.forEach(l=>{ LT++; if(!T.lint('Посмотри: '+l+' лежит на этой прямой.',c2).ok) LC++; else if(LT-LC<4) bad(`${s.id}: секретная точка ${l} не поймана`); });
      c2.secret.numbers.filter(x=>!c2.numbers.includes(x.replace(',','.'))).slice(0,2).forEach(x=>{ NT++; if(!T.lint('Там получится '+x+' мм.',c2).ok) NC++; else if(NT-NC<4) bad(`${s.id}: число шага ${x} не поймано`); });
      if(c2.secret.labels.some(l=>(s.rungs['3']||'').includes(l))){ RT++; if(!T.lint(s.rungs['3'].slice(0,300),c2).ok) RC++; else if(RT-RC<4) bad(`${s.id}: сырой «Шаг» с найденными точками прошёл линтер`); } } } }
if(FB) bad(`шаблон не прошёл линтер в ${FB} случаях`);
if(NB<N) bad(`соседний вариант есть у ${NB} из ${N} шагов — нужен у всех`);
/* 4. линтер на заготовках */
const S={id:'x',goal:'Найти точку K встречи прямой DE с плоскостью ABC',rungs:{1:'Нужен посредник.',2:'Проецирующая плоскость через прямую.',3:'Через D″E″ проводим γ″, отмечаем 1″ и 2″, затем K′.',4:'K(40; 20; 30).'},
  labels:['A′','A″','B′','B″','C′','C″','D′','D″','E′','E″'],secret:{labels:['1″','2″','K′','K″'],numbers:['40','20','30']}};
const C=T.context(S,2,{cond:'Даны A(10; 50; 60), прямая DE.'});
const must=[['Посмотри, как связаны A′ и A″: в каком направлении идёт линия между ними?',true],
  ['K′ лежит на D′E′.',false],['Отметь 1″ на A″B″.',false],['Получится 40 мм.',false],['Понятно? Где K?',false],['Ты умница! Дальше сам.',false],
  ['Где на чертеже прямая DE? Где плоскость ABC?',false],['x'.repeat(400),false],['Посмотри на Q′ — где она?',false],['Здесь нужен посредник: какая плоскость удобна?',true]];
/* обход: апострофы и кавычки вместо штрихов, LaTeX, «-штрих», кириллические двойники, пробелы, полноширинные цифры, числа словами */
["K' лежит на D'E'","K’ лежит на прямой","K'' на фронтальной","К′ лежит на D′E′","K^{\\prime} на DE","K` на DE","Получится сорок миллиметров","Примерно 4 0 мм","Около ４０ мм",
 "1 ″ на A″B″","точка один-штрих на AB","Это K-штрих","Отметь 2\" на B\"C\"","Z равно тридцать","Тут 46.7","Ответ: сорок шесть","K’ и K” — на одной линии связи"].forEach(t=>must.push([t,false]));
must.forEach(([t,ok])=>{ const L=T.lint(t,C); if(L.ok!==ok) bad(`линтер: «${t.slice(0,50)}» — ожидалось ${ok?'пропустить':'отказать'}, а ${L.ok?'пропустил':'отказал: '+L.errors.map(e=>e.code).join(',')}`); });
/* 5. автомат лестницы */
const run=evs=>evs.reduce((s,e)=>T.ladder.step(s,e),T.ladder.init());
const eq=(name,s,rung,extra)=>{ if(s.rung!==rung) bad(`лестница «${name}»: ступень ${s.rung}, ожидалась ${rung}`); if(extra&&!extra(s)) bad(`лестница «${name}»: состояние ${JSON.stringify(s)}`); };
eq('ошибка открывает Р0',run([{t:'open'},{t:'act_wrong'}]),0);
eq('ошибки поднимают по одной',run([{t:'open'},{t:'act_wrong'},{t:'act_wrong'},{t:'act_wrong'}]),2);
eq('ошибка из библиотеки сначала не поднимает',run([{t:'open'},{t:'act_wrong'},{t:'act_wrong',misc:'a'}]),0,s=>s.move==='feedback_incorrect');
eq('та же ошибка из библиотеки второй раз — поднимает',run([{t:'open'},{t:'act_wrong'},{t:'act_wrong',misc:'a'},{t:'act_wrong',misc:'a'}]),1);
eq('другая ошибка из библиотеки — снова сначала показываем',run([{t:'open'},{t:'act_wrong'},{t:'act_wrong',misc:'a'},{t:'act_wrong',misc:'b'}]),0,s=>s.move==='feedback_incorrect');
eq('ход не залипает',run([{t:'open'},{t:'act_wrong'},{t:'act_wrong',misc:'a'},{t:'text'}]),0,s=>s.move===null);
eq('просьбы без новых попыток не поднимают',run([{t:'open'},{t:'act_wrong'},{t:'ask'},{t:'ask'},{t:'ask'}]),0,s=>s.move==='prompt_try');
eq('попытка — и просьба поднимает',run([{t:'open'},{t:'act_wrong'},{t:'text',attempt:1},{t:'ask'}]),1);
eq('реплика сбрасывает паузу',run([{t:'open'},{t:'act_wrong'},{t:'idle',sec:40},{t:'text'},{t:'idle',sec:40}]),0);
eq('самообъяснение после Р2+',run([{t:'open'},{t:'act_wrong'},{t:'act_wrong'},{t:'act_wrong'},{t:'act_ok'}]),2,s=>s.move==='ask_self_explain');
eq('без самообъяснения на Р0',run([{t:'open'},{t:'act_wrong'},{t:'act_ok'}]),0,s=>s.move==='feedback_correct');
{ const r=[{t:'act_wrong'},{t:'act_wrong'},{t:'act_wrong'}].reduce((s,e)=>T.ladder.step(s,e),T.ladder.init({rk:1})); if(r.rung!==4) bad('лестница перед РК: ожидалось Р0 → Р2 → Р4, ступень '+r.rung); }
if(JSON.stringify(T.ladder.review([{maxRung:4,topics:['m4']},{maxRung:4,topics:['m4','p5']},{maxRung:4,topics:['x3']}]))!==JSON.stringify(['m4','p5','x3'])) bad('лестница: три шага с Р4 — нет совета вернуться к темам');
if(T.ladder.review([{maxRung:4},{maxRung:2},{maxRung:4}])) bad('лестница: совет вернуться без трёх Р4 подряд');
eq('пауза 45 с поднимает',run([{t:'open'},{t:'act_wrong'},{t:'idle',sec:46}]),1);
eq('пауза не поднимает выше Р3',run([{t:'open'},{t:'act_wrong'},{t:'idle',sec:46},{t:'idle',sec:46},{t:'idle',sec:46},{t:'idle',sec:46}]),3);
eq('Р4 — после двух ошибок на Р3',run([{t:'open'},{t:'act_wrong'},{t:'act_wrong'},{t:'act_wrong'},{t:'act_wrong'},{t:'act_wrong'},{t:'act_wrong'}]),4);
eq('просьба без попытки — «попробуй сначала»',run([{t:'open'},{t:'ask'},{t:'ask'}]),0,s=>s.move==='prompt_try');
eq('верное действие засчитывает шаг',run([{t:'open'},{t:'act_wrong'},{t:'act_ok'},{t:'act_wrong'}]),0,s=>s.done&&s.maxRung===0);
/* 6. проверка утверждений: инвариант «X′ и X″ на одной линии связи» во всех вариантах начерта; ложное — ложно;
   утверждение о ещё не открытой точке — скрыто (да/нет о положении искомого не даём) */
let LK=0, LKbad=0, HID=0, HIDbad=0, FALSEok=0;
for(const d of ['ng1','ng2','ng3','ng4','ng5']){ const f=path.join(DIR,d+'.json'); if(!fs.existsSync(f)) continue; const D=JSON.parse(fs.readFileSync(f,'utf8'));
  for(const V of D.variants){ if(!V.P) { bad(d+' в.'+V.n+': нет координат точек'); continue; }
    for(const l of Object.keys(V.P)) if(l.endsWith('′')&&V.P[l.slice(0,-1)+'″']){ LK++; const r=T.checkClaim(V,'x.p99.s999',{rel:'link',a:l,b:l.slice(0,-1)+'″'}); if(!r.truth){ LKbad++; if(LKbad<4) bad(`${d} в.${V.n}: ${l} и его ″ не на линии связи`); } }
    const s0=V.steps[0]; if(!s0) continue;
    Object.entries(V.P).filter(([l,q])=>q[2]!=='g').forEach(([l])=>{ HID++; const r=T.checkClaim(V,s0.id,{rel:'link',a:l,b:Object.keys(V.P)[0]}); if(!r.hidden) HIDbad++; });
    const g=Object.keys(V.P).filter(l=>V.P[l][2]==='g'&&l.endsWith('′')); if(g.length>=2&&Math.abs(V.P[g[0]][0]-V.P[g[1]][0])>5&&!T.checkClaim(V,s0.id,{rel:'link',a:g[0],b:g[1].slice(0,-1)+'″'}).truth) FALSEok++; } }
if(LKbad) bad(`линия связи нарушена в ${LKbad} из ${LK} пар`); if(HIDbad) bad(`утверждение о неоткрытой точке не скрыто: ${HIDbad} из ${HID}`);
const pc=[['K′ лежит на D′E′','on'],['A′ и A″ на одной линии связи','link'],['A″B″ параллельна оси x','parx'],['AB ⟂ CD: A′B′ ⟂ C′D′','perp']];
pc.forEach(([t,rel])=>{ const c=T.parseClaim(t); if(!c||c.rel!==rel) bad(`разбор «${t}»: ${JSON.stringify(c)}`); });
/* 7. инжа: утверждения об элементе против базы «каждая линия» — на всех элементах всех вариантов */
{ const K=JSON.parse(fs.readFileSync(path.join(ROOT,'kb/ig-dz.json'),'utf8')); let n=0, wrong=0;
  const P=(t,exp)=>{ const c=T.parseIGClaim(t); if(!c||c.rel!==exp) bad(`разбор инжи «${t}»: ${JSON.stringify(c)}`); };
  P('высоты на виде слева берут с главного вида','src'); P('глубину на виде слева — с вида сверху','src'); P('на виде слева линии отверстия невидимые','hidden');
  P('на виде сверху линия выреза — кривая','curve'); P('отверстие в разрезе штрихуется','hatch'); P('во фронтальном разрезе отверстие рассечено','cut'); P('паз дан на главном виде','given');
  for(const dz in K.dz) for(const v in K.dz[dz]) for(const ex of K.dz[dz][v].feats){ n++;
    ex.byView.forEach(b=>{ if(b.how.z&&!T.checkIG(ex,{rel:'src',view:b.v,coord:'z',from:b.how.z}).truth) wrong++; if(b.how.y&&!T.checkIG(ex,{rel:'src',view:b.v,coord:'y',from:'T'}).truth) wrong++;
      if(T.checkIG(ex,{rel:'hidden',view:b.v}).truth!==!!b.hidden) wrong++; });
    if(T.checkIG(ex,{rel:'hatch'}).truth===(ex.kind==='отверстие')) wrong++;
    ex.given.forEach(g=>{ if(!T.checkIG(ex,{rel:'given',view:g}).truth) wrong++; }); }
  if(wrong) bad(`инжа: проверка утверждений расходится с базой в ${wrong} случаях`);
  console.log(`Инжа: утверждения сверены с базой на ${n} элементах`); }
console.log(`Утверждения: линия связи верна у ${LK-LKbad}/${LK} пар проекций; ложное «на одной линии связи» опровергнуто в ${FALSEok} вариантах; о неоткрытых точках скрыто ${HID-HIDbad}/${HID}`);
console.log(`Тренер: шагов ${N} (сосед — у ${NB}); шаблон без модели прошёл линтер везде: ${!FB}; утечки пойманы: точки ${LC}/${LT}, числа ${NC}/${NT}, сырой «Шаг» ${RC}/${RT}`);
if(LC!==LT||NC!==NT||RC!==RT) bad('не все подсаженные утечки пойманы');
if(fails.length){ console.log('ОШИБКИ:\n'+fails.slice(0,30).join('\n')); process.exit(1); } console.log('ок');
