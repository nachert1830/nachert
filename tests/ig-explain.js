#!/usr/bin/env node
/* «Как строится элемент» по ДЗ инжи (core/ig-explain.js, kb/ig-dz.json).  node tests/ig-explain.js
   Для каждого варианта с базой «каждая линия» и каждого элемента: объяснение строится, темы — из программы PREPIG,
   у достраиваемых линий указано, откуда координаты, ответ без модели не пустой и без NaN; элемент находится по своему названию;
   kb/ig-dz.json собран из текущих данных. */
'use strict';
const fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
const X=require(path.join(ROOT,'core/ig-explain.js')), G=require(path.join(ROOT,'kernel/prep-ig.js'));
const fails=[], bad=s=>fails.push(s); let nv=0, nf=0, noHow=0;
for(const d of [2,3,4,5,6]){ const dir=path.join(ROOT,'dz/ig',String(d),'lines'); if(!fs.existsSync(dir)) continue;
  for(const f of fs.readdirSync(dir).filter(f=>/^v\d+\.json$/.test(f))){ const L=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); nv++;
    for(const ft of L.feats){ nf++; let ex; try{ ex=X.explain(L,ft.i,{topics:G}); }catch(e){ bad(`ig${d} в.${L.n} ${ft.name}: ${e.message}`); continue; }
      ex.topics.forEach(t=>{ if(!G.BY[t]) bad(`ig${d} в.${L.n}: тема ${t} не из программы`); });
      const s=X.say(ex); if(!s||/NaN|undefined/.test(s)) bad(`ig${d} в.${L.n} ${ft.name}: плохой ответ «${s}»`);
      ex.byView.forEach(b=>{ if(!b.how.x&&!b.how.z&&!b.how.y&&!b.rad.length) noHow++; });
      const hit=X.find(L,ft.name); if(!hit.includes(ft.i)) bad(`ig${d} в.${L.n}: «${ft.name}» не находится по названию`); } } }
if(nv<50) bad('мало вариантов с базой: '+nv);
const kbf=path.join(ROOT,'kb/ig-dz.json'); if(!fs.existsSync(kbf)) bad('нет kb/ig-dz.json: node tools/kb-igdz.js');
else { const K=JSON.parse(fs.readFileSync(kbf,'utf8')); const n=Object.values(K.dz).reduce((s,v)=>s+Object.keys(v).length,0); if(n!==nv) bad(`kb/ig-dz.json устарел (${n} вариантов, в базе линий ${nv}): node tools/kb-igdz.js`); }
console.log(`Инжа, «как строится»: вариантов ${nv}, элементов ${nf}; видов без источника координат: ${noHow}`);
if(fails.length){ console.log('ОШИБКИ:\n'+[...new Set(fails)].slice(0,30).join('\n')); process.exit(1); } console.log('ок');
