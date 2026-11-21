#!/usr/bin/env node
/* Собирает docs/prep/IG-PROGRAM.md из kernel/prep-ig.js.  node docs/prep/ig-program-md.js */
'use strict';
const path=require('path'), fs=require('fs');
function build(G){
  const L=[], T=id=>G.BY[id];
  const ref=id=>`\`${id}\` ${T(id).t}`;
  L.push('# Программа подготовки по инженерной графике','',
    '> Собрано из `kernel/prep-ig.js` командой `node docs/prep/ig-program-md.js`. Руками не править — правь данные.','',
    `${G.ALL.length} тем, ${G.ALL.reduce((s,t)=>s+t.traps.length,0)} ловушек, ${G.ALL.filter(t=>t.q).length} вопросов защиты, ${G.ALL.filter(t=>t.look).length} ключевых ракурсов 3D. `+
    'Одна тема — одна новая идея. Тема опирается только на темы раньше. Тема принадлежит первому заданию, которому она нужна; '+
    'курс задания = свои темы + «нужно из прошлых».','',
    'Главная мысль курса: приёмы одни и те же — растёт сложность тела. Задание №1 (сопряжения) — отдельный плоский чертёж. '+
    'Задание №2 закладывает весь фундамент проецирования и разрезов; дальше каждое задание добавляет 1–10 своих тем.','',
    '## Курсы по заданиям','','| Задание | Своих тем | Нужно из прошлых | Всего |','|---|---|---|---|');
  for(const c of G.COURSES) L.push(`| ${c.label} · ${c.title} | ${c.own.length} | ${c.prev.length} | ${c.need.length} |`);
  L.push('');
  for(const c of G.COURSES){
    L.push(`### ${c.label} · ${c.title}`,'');
    if(c.own.length) for(const b of c.blocks) L.push(`- **${b.t}:** ${b.ids.map(ref).join(' · ')}`);
    else L.push('- Своих тем нет: все приёмы уже пройдены в прошлых заданиях — курс повторяет их на новом теле.');
    for(const p of c.prevBy) L.push(`- *Из ${p.label.replace('Задание','задания')}:* ${p.ids.map(id=>'`'+id+'`').join(' ')}`);
    L.push('');
  }
  L.push('## Все темы','');
  for(const m of G.MODS){
    L.push(`### Блок «${m.t}» — ${m.k}`,'');
    for(const t of m.T){
      L.push(`#### \`${t.id}\` ${t.t}`,'',`**Идея:** ${t.new}`,'');
      const meta=[];
      meta.push('опора: '+(t.pre.length?t.pre.map(id=>'`'+id+'`').join(' '):'—'));
      meta.push('задания: '+t.dz.map(k=>'№'+k.slice(2)).join(', '));
      if(t.ng) meta.push('в начерте: '+t.ng.map(id=>'`'+id+'`').join(' '));
      if(t.gost) meta.push('ГОСТ '+t.gost);
      L.push(meta.join(' · '),'');
      if(t.look) L.push(`**Ракурс 3D:** ${t.look}`,'');
      if(t.q) L.push(`**Вопрос защиты:** ${t.q}`,'');
      L.push('**Ловушки:**'); t.traps.forEach(s=>L.push('- '+s)); L.push('');
    }
  }
  return L.join('\n');
}
module.exports=build;
if(require.main===module){ const G=require(path.join(__dirname,'../../kernel/prep-ig.js'));
  fs.writeFileSync(path.join(__dirname,'IG-PROGRAM.md'),build(G)); console.log('docs/prep/IG-PROGRAM.md'); }
