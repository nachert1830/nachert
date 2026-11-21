#!/usr/bin/env node
/* Программа подготовки по инженерной графике (kernel/prep-ig.js).  node tests/prep-ig.js
   Каждое задание закрыто; темы опираются только на темы раньше; у каждой темы есть задание и ≥ 3 ловушки;
   идеи не повторяются; ссылки на темы начерта (ng) существуют в PREPROG; курсы делят программу без повторов и без потери опоры;
   docs/prep/IG-PROGRAM.md собран из текущих данных. */
'use strict';
const fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
global.self=global; require(path.join(ROOT,'kernel/prep.js'));
const G=require(path.join(ROOT,'kernel/prep-ig.js')), NG=self.PREPROG;
const fails=[], bad=s=>fails.push(s);
const A=G.audit();
if(A.dz.length!==Object.keys(G.DZ).length) bad('не закрыты задания: '+Object.keys(G.DZ).filter(k=>!A.dz.includes(k)).join(', '));
if(A.cq.length!==23) bad('не все контрольные вопросы тетради закрыты темами'); if(A.gt.length!==16) bad('не все графические задания тетради закрыты темами');
for(const k of ['badOrder','orphan','badDz','fewTraps','dupNew','badRef']) if(A[k].length) bad(k+': '+A[k].join(', '));
for(const t of G.ALL) for(const n of t.ng||[]) if(!NG.BY[n]) bad(`тема ${t.id}: нет темы начерта ${n}`);
const own=G.COURSES.flatMap(c=>c.own);
if(new Set(own).size!==own.length) bad('курсы: тема в двух курсах');
if(own.length!==G.ALL.length) bad(`курсы: покрыто ${own.length} тем из ${G.ALL.length}`);
for(const c of G.COURSES){ const has=new Set(c.own.concat(c.prev));
  for(const id of c.own) for(const q of G.BY[id].pre) if(!has.has(q)) bad(`курс ${c.label}: ${id} опирается на ${q}, которой нет`); }
const MD=require(path.join(ROOT,'docs/prep/ig-program-md.js')), md=MD(G,MD.examples());
const file=path.join(ROOT,'docs/prep/IG-PROGRAM.md');
if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==md) bad('docs/prep/IG-PROGRAM.md устарел: node docs/prep/ig-program-md.js');
console.log(`ИГ: ${G.ALL.length} тем, ${G.ALL.reduce((s,t)=>s+t.traps.length,0)} ловушек; курсы: ${G.COURSES.map(c=>c.label.replace('Задание ','')+' '+c.own.length+'+'+c.prev.length).join(', ')}`);
if(fails.length){ console.log('ОШИБКИ:\n'+fails.join('\n')); process.exit(1); } console.log('ок');
