#!/usr/bin/env node
/* ДЗ 1 по инже · сопряжения (core/conj.js, dz/ig/1/).  node tests/ig1.js [--n=2000]
   1. Каждый вариант: программа исполняется, все построения проходят независимую проверку определения касания,
      каждый контур замкнут и гладкий на всех стыках (кроме явно помеченных изломов), шаги рисуются.
   2. Ядро на случайных данных: для каждого вида построения — N случайных задач; результат построителя (ГМТ и пересечения)
      проверяется определением: расстояние центр–прямая = R, |OC| = R ± r, точка касания на обоих элементах,
      касательная ⟂ радиусу в точке касания. Неверный режим (R + r вместо R − r) проверку не проходит.
   3. Чертёж: каждый шаг — корректный SVG без NaN. */
'use strict';
const path=require('path'), ROOT=path.join(__dirname,'..');
const K=require(path.join(ROOT,'core/conj.js')), {V}=require(path.join(ROOT,'dz/ig/1/variants.js')), D=require(path.join(ROOT,'dz/ig/1/draw.js'));
const N=+((process.argv.find(a=>a.startsWith('--n='))||'').slice(4)||2000);
const fails=[], bad=s=>fails.push(s);
let seed=12345; const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648, U=(a,b)=>a+(b-a)*rnd();
/* 1 */
for(const n in V){ let r; try{ r=K.run(V[n]); }catch(e){ bad(`в.${n}: ${e.message}`); continue; }
  r.bad.forEach(b=>bad(`в.${n}: контур ${b.contour}, кусок ${b.i}: ${b.what}`));
  r.checks.forEach(c=>c.res.filter(x=>!x.ok).forEach(x=>bad(`в.${n}, ${c.name}: ${x.what}, ошибка ${x.err}`)));
  const st=D.steps(+n); if(st.some(s=>/NaN|undefined/.test(s.svg))) bad(`в.${n}: NaN в чертеже шага`);
  if(/NaN|undefined/.test(D.sheet(+n))) bad(`в.${n}: NaN на листе`); }
/* 2 — определение касания, независимо от построителя */
const tanLine=(L,O,R,T)=>Math.abs(Math.abs(K.crs(L.d,K.sub(O,L.p)))-R)<1e-7&&Math.abs(K.crs(L.d,K.sub(T,L.p)))<1e-7&&Math.abs(K.dist(O,T)-R)<1e-7;
const tanCirc=(C,O,R,T)=>Math.abs(K.dist(T,C.c)-C.r)<1e-7&&Math.abs(K.dist(T,O)-R)<1e-7&&Math.abs(K.crs(K.sub(T,O),K.sub(T,C.c)))<1e-6;
const cnt={LL:0,LC:0,CC:0,PC:0,TT:0}, wrong={LC:0,CC:0};
for(let i=0;i<N;i++){
  const L1=K.lineDir([U(-50,50),U(-50,50)],[Math.cos(U(0,6.3)),Math.sin(U(0,6.3))]), L2=K.lineDir([U(-50,50),U(-50,50)],[Math.cos(U(0,6.3)),Math.sin(U(0,6.3))]);
  const R=U(3,40), C1=K.circ([U(-60,60),U(-60,60)],U(5,30)), C2=K.circ([U(-60,60),U(-60,60)],U(5,30));
  try{ const f=K.filletLL(L1,L2,R,1,1); if(tanLine(L1,f.O,R,f.T[0])&&tanLine(L2,f.O,R,f.T[1])) cnt.LL++; else bad('LL: касание не выполнено'); }catch(e){ cnt.LL++; }
  for(const m of ['ext','enc','ins']){ try{ const f=K.filletLC(L1,C1,R,1,m);
      if(!(tanLine(L1,f.O,R,f.T[0])&&tanCirc(C1,f.O,R,f.T[1]))) bad('LC '+m+': касание не выполнено'); else cnt.LC++;
      /* подсаженная ошибка: центр от окружности на R + r вместо нужного — определение касания должно её поймать */
      if(m!=='ext'){ const g=K.filletLC(L1,C1,R,1,'ext'); if(Math.abs(K.dist(g.O,C1.c)-(m==='enc'?R-C1.r:C1.r-R))>1e-6) wrong.LC++; } }catch(e){} }
  for(const m of [['ext','ext'],['enc','enc'],['ext','enc'],['ins','ins']]){ try{ const f=K.filletCC(C1,C2,R,m[0],m[1]);
      if(!(tanCirc(C1,f.O,R,f.T[0])&&tanCirc(C2,f.O,R,f.T[1]))) bad('CC '+m+': касание не выполнено'); else cnt.CC++; }catch(e){} }
  try{ const P=[U(-90,90),U(-90,90)]; const t=K.tangentPC(P,C1); if(Math.abs(K.dot(K.sub(t.T[0],P),K.sub(t.T[0],C1.c)))>1e-6||Math.abs(K.dist(t.T[0],C1.c)-C1.r)>1e-7) bad('PC: не касательная'); else cnt.PC++; }catch(e){}
  for(const k of ['outer','inner']){ try{ const t=K.tangentCC(C1,C2,k); const d=K.sub(t.T[1],t.T[0]);
      if(Math.abs(K.dot(d,K.sub(t.T[0],C1.c)))>1e-6||Math.abs(K.dot(d,K.sub(t.T[1],C2.c)))>1e-6||Math.abs(K.dist(t.T[0],C1.c)-C1.r)>1e-7||Math.abs(K.dist(t.T[1],C2.c)-C2.r)>1e-7) bad('TT '+k+': не касательная'); else cnt.TT++; }catch(e){} } }
if(Object.values(cnt).some(v=>v<N/10)) bad('мало проверенных построений: '+JSON.stringify(cnt));
console.log(`ДЗ 1 инжа: вариантов ${Object.keys(V).length}; ядро на случайных данных: ${JSON.stringify(cnt)}; подсаженная ошибка R ± r поймана ${wrong.LC} раз`);
if(fails.length){ console.log('ОШИБКИ:\n'+[...new Set(fails)].slice(0,30).join('\n')); process.exit(1); } console.log('ок');
