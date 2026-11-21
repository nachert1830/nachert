#!/usr/bin/env node
/* Собирает docs/prep/IG-PROGRAM.md из kernel/prep-ig.js.  node docs/prep/ig-program-md.js */
'use strict';
const path=require('path'), fs=require('fs');
function build(G,EXA={}){
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
  L.push('## Контрольные вопросы тетради (с. 29)','');
  Object.keys(G.CQ).forEach(n=>L.push(`${n}. ${G.CQ[n][0]} — *${G.CQ[n][1]}* (темы: ${G.ALL.filter(t=>(t.cq||[]).includes(+n)).map(t=>'`'+t.id+'`').join(' ')})`));
  L.push('','## Графические задания тетради','');
  Object.keys(G.GT).forEach(k=>L.push(`- **${k}** ${G.GT[k]} — темы: ${G.ALL.filter(t=>(t.gt||[]).includes(k)).map(t=>'`'+t.id+'`').join(' ')}`));
  L.push('','## Все темы','');
  for(const m of G.MODS){
    L.push(`### Блок «${m.t}» — ${m.k}`,'');
    for(const t of m.T){
      L.push(`#### \`${t.id}\` ${t.t}`,'',`**Идея:** ${t.new}`,'');
      const meta=[];
      meta.push('опора: '+(t.pre.length?t.pre.map(id=>'`'+id+'`').join(' '):'—'));
      meta.push('задания: '+t.dz.map(k=>'№'+k.slice(2)).join(', '));
      if(t.ng) meta.push('в начерте: '+t.ng.map(id=>'`'+id+'`').join(' '));
      if(t.gost) meta.push('ГОСТ '+t.gost);
      if(t.wb) meta.push('тетрадь: '+t.wb);
      L.push(meta.join(' · '),'');
      if(t.look) L.push(`**Ракурс 3D:** ${t.look}`,'');
      if(t.q) L.push(`**Вопрос защиты:** ${t.q}`,'');
      (t.cq||[]).forEach(n=>L.push(`**Контрольный вопрос ${n}.** ${G.CQ[n][0]} — *${G.CQ[n][1]}*`,''));
      if((t.gt||[]).length) L.push('**Задания тетради:** '+t.gt.map(k=>k+' '+G.GT[k]).join('; '),'');
      if(EXA[t.id]&&EXA[t.id].length) L.push('**Живые примеры в ДЗ:** '+EXA[t.id].map(e=>`ДЗ ${e.dz.slice(2)}, в. ${e.n} — ${e.name}`).join('; '),'');
      L.push('**Ловушки:**'); t.traps.forEach(s=>L.push('- '+s)); L.push('');
    }
  }
  return L.join('\n');
}
module.exports=build;
/* живые примеры: элементы вариантов ДЗ, в построении которых тема участвует (kb/ig-dz.json), по 3 на тему из разных ДЗ */
function examples(){ const f=path.join(__dirname,'../../kb/ig-dz.json'); if(!fs.existsSync(f)) return {};
  const K=JSON.parse(fs.readFileSync(f,'utf8')), E={};
  for(const dz of Object.keys(K.dz).sort()) for(const n of Object.keys(K.dz[dz]).sort((a,b)=>a-b)) K.dz[dz][n].feats.forEach(ft=>{ if(ft.kind!=='отверстие') return;
    ft.topics.forEach(t=>{ const a=E[t]||(E[t]=[]); if(a.length<3&&!a.some(e=>e.dz===dz)) a.push({dz,n:+n,name:ft.name}); }); });
  return E; }
module.exports.examples=examples;
if(require.main===module){ const G=require(path.join(__dirname,'../../kernel/prep-ig.js'));
  fs.writeFileSync(path.join(__dirname,'IG-PROGRAM.md'),build(G,examples())); console.log('docs/prep/IG-PROGRAM.md'); }
