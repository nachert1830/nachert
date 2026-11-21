#!/usr/bin/env node
/* Спросить про элемент варианта ДЗ инжи без ИИ:  node tools/ig-ask.js ig4 7 "как строится дырка"
   Ищет элемент по словам (core/ig-explain.js → find), отвечает шаблоном (say), печатает темы программы и ловушки. */
'use strict';
const fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
const X=require(path.join(ROOT,'core/ig-explain.js')), G=require(path.join(ROOT,'kernel/prep-ig.js'));
const [dz,n,...q]=process.argv.slice(2); const f=path.join(ROOT,'dz/ig',String(dz||'').replace('ig',''),'lines','v'+String(n).padStart(2,'0')+'.json');
if(!fs.existsSync(f)){ console.log('Нет базы для',dz,n,'— node dz/ig/etalon/make.js',dz,n); process.exit(1); }
const L=JSON.parse(fs.readFileSync(f,'utf8')), ids=X.find(L,q.join(' '));
console.log(`${dz} в.${n} «${L.title}». Элементы: ${L.feats.map(x=>x.i+' '+x.name).join(' · ')}`);
if(!ids.length){ console.log('Не понял, о каком элементе речь.'); process.exit(0); }
if(ids.length>1) console.log('Подходит несколько: '+ids.map(i=>L.feats[i].name).join(', ')+' — отвечаю про первый.');
const ex=X.explain(L,ids[0],{topics:G});
console.log('\n'+X.say(ex)+'\n\nТемы: '+ex.topics.map(id=>id+' '+G.BY[id].t).join(' · ')+'\nЧастые ошибки:\n'+ex.traps.filter((t,i,a)=>a.findIndex(u=>u.topic===t.topic)===i).slice(0,5).map(t=>' - '+t.say).join('\n'));
