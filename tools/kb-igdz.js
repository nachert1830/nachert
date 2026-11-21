#!/usr/bin/env node
/* База «как строится элемент» по всем ДЗ инжи: kb/ig-dz.json.  node tools/kb-igdz.js
   Для каждого варианта ДЗ 2–6 (dz/ig/<N>/lines/vNN.json, их пишет dz/ig/etalon/make.js из 3D-модели) и каждого элемента детали —
   ответ core/ig-explain.js: что дано, откуда каждая координата на каждом виде, кривые, невидимые линии, разрезы, поверхности,
   темы программы и ловушки; плюс шаблонный ответ без модели (say). ИИ-тренер берёт отсюда ответ на «как строится эта дырка». */
'use strict';
const fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
const X=require(path.join(ROOT,'core/ig-explain.js')), G=require(path.join(ROOT,'kernel/prep-ig.js'));
const out={about:'Инжа, ДЗ 2–6: каждый элемент каждого варианта — как строится (из базы «каждая линия»). Собрано tools/kb-igdz.js.',dz:{}};
let nv=0, nf=0;
for(const d of [2,3,4,5,6]){ const dir=path.join(ROOT,'dz/ig',String(d),'lines'); if(!fs.existsSync(dir)) continue;
  const V=out.dz['ig'+d]={};
  for(const f of fs.readdirSync(dir).filter(f=>/^v\d+\.json$/.test(f)).sort()){
    const L=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
    V[L.n]={title:L.title,feats:L.feats.map(ft=>{ const ex=X.explain(L,ft.i,{topics:G}); nf++; return Object.assign(ex,{say:X.say(ex)}); })}; nv++; } }
fs.writeFileSync(path.join(ROOT,'kb/ig-dz.json'),JSON.stringify(out));
console.log(`kb/ig-dz.json: вариантов ${nv}, элементов ${nf}`);
