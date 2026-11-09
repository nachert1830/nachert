/* ═══════════ Варианты № 47: тот же генератор, что в core/test.js ═══════════
   Линейный конгруэнтный генератор (seed·16807 mod 2³¹−1) и T47.randomGamma — ровно как в core/test.js
   и в обязательстве O7 сертификата. Вариант i при начальном значении seed — i-й вызов randomGamma.

   Разделение сидов зафиксировано ДО прогонов (правило честности: настраиваем на одних, меряем на других):
     DEV_SEED  = 2026  — на этих вариантах подбирался промпт генератора;
     EVAL_SEED = 12345 — на этих вариантах сняты цифры RESULTS.md (тот же сид, что в core/test.js). */
const T47=require('../core/t47.js');
const {q,V}=require('../core/exact.js');

const DEV_SEED=2026, EVAL_SEED=12345;

function lcg(seed){ let s=seed; return ()=>((s=(s*16807)%2147483647)/2147483647); }

/* число из дробей со знаменателем 10ᵏ → точная десятичная запись */
function dec(x){ x=q(x); const neg=x.n<0n, n=neg?-x.n:x.n; let k=0;
  while((10n**BigInt(k))%x.d!==0n){ k++; if(k>12) throw new Error('не десятичная дробь: '+x); }
  const s=(n*10n**BigInt(k)/x.d).toString().padStart(k+1,'0'); return (neg?'-':'')+(k?s.slice(0,-k)+'.'+s.slice(-k):s); }

/* условие варианта: две записи — из генератора и прочитанная обратно из текста (для O9) */
function entryOf(G){ return {A:G.A.map(dec), B:G.aP(0).map(dec), C:G.aP(1).map(dec)}; }
function gammaOf(e){ const A=V.of(e.A), B=V.of(e.B), C=V.of(e.C);
  return {A, aP:x=>{ x=q(x); return V.add(B,V.mul(V.sub(C,B),x)); }}; }

const fmt=p=>'('+p.join('; ')+')';
function textOf(e){
  return 'Задача № 47. Определить расстояние от точки A до прямой a.\n'+
    'Дано (координаты в мм, x — влево, y — к зрителю, z — вверх):\n'+
    '  точка A'+fmt(e.A)+';\n'+
    '  прямая a проходит через точки B'+fmt(e.B)+' и C'+fmt(e.C)+'.\n'+
    'На листе уже построены проекции данных: точки A″, A′, прямые a″, a′ и ось x.\n'+
    'Построить проекции K″, K′ основания K перпендикуляра из A на a и натуральную величину |AK|.'; }
/* обратное чтение условия из текста — независимый от генератора ввод (O9 сверяет его с первым) */
function parseText(t){ const num='(-?\\d+(?:\\.\\d+)?)', pt=n=>new RegExp(n+'\\('+num+'; '+num+'; '+num+'\\)').exec(t);
  const a=pt('точка A'), b=pt('точки B'), c=pt(' и C'); if(!a||!b||!c) throw new Error('условие не прочитано из текста');
  return {A:a.slice(1,4), B:b.slice(1,4), C:c.slice(1,4)}; }

function variants(seed,n){ const rnd=lcg(seed), out=[];
  for(let i=0;i<n;i++){ const G0=T47.randomGamma(rnd), entry=entryOf(G0), text=textOf(entry);
    out.push({id:seed+'#'+i, seed, i, entry, entry2:parseText(text), G:gammaOf(entry), text}); }
  return out; }

module.exports={DEV_SEED,EVAL_SEED,lcg,variants,entryOf,gammaOf,textOf,parseText,dec};
