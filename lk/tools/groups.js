/* Расписание групп: lk/data/raw/*.txt (переписано с фото стенда кафедры) → lk/data/groups.json.
   node lk/tools/groups.js — запускать после правки txt. Формат строки: «группы | аудитория преподаватель | …»;
   у группы суффиксы: НГ — начертательная геометрия (иначе ИКГ), чс / зн — только по числителям / знаменателям; «?» в конце — плохо видно на фото. */
'use strict';
const fs=require('fs'), path=require('path');
const DIR=path.join(__dirname,'..','data'), RAW=path.join(DIR,'raw');
function parseGroup(s){ let x=s.replace(/\s+/g,'').toUpperCase(), par='', ng=false, m;
  for(let i=0;i<3;i++){ if((m=/(ЧС|ЗН)$/.exec(x))){ par=m[1]==='ЧС'?'чс':'зн'; x=x.slice(0,-2); continue; } if(/НГ$/.test(x)){ ng=true; x=x.slice(0,-2); continue; } break; }
  return {code:x,par,subj:ng?'ng':'ikg'}; }
function parse(text,file){ let day=0, t='', out=[];
  text.split('\n').forEach((line,i)=>{ line=line.trim(); if(!line||line.startsWith('#')) return;
    let m; if((m=/^DAY\s+(\d)$/.exec(line))){ day=+m[1]; return; } if((m=/^T\s+(\d{1,2}:\d{2})$/.exec(line))){ t=m[1].padStart(5,'0'); return; }
    const unsure=/\?\s*$/.test(line), parts=line.replace(/\?\s*$/,'').split('|').map(x=>x.trim());
    if(!day||!t||parts.length<2) throw new Error(file+':'+(i+1)+' не понял строку: '+line);
    const rooms=parts.slice(1).map(p=>{ const r=/^(\S+)\s*(.*)$/.exec(p); return {r:r[1],who:r[2]||''}; });
    parts[0].split(',').forEach(g=>{ const G=parseGroup(g); if(!/^[А-ЯЁA-Z]{1,6}\d{0,2}[А-ЯЁA-Z]?-[\d.]{1,5}(\/\d)?[А-ЯЁA-Z]{0,2}$/.test(G.code)) throw new Error(file+':'+(i+1)+' странная группа: '+g);
      out.push(Object.assign({day,t,rooms},G,unsure?{unsure:true}:{})); }); });
  return out; }
function build(){ const files=fs.readdirSync(RAW).filter(f=>f.endsWith('.txt')).sort(), all=[];
  files.forEach(f=>all.push(...parse(fs.readFileSync(path.join(RAW,f),'utf8'),f)));
  const groups={};
  all.sort((a,b)=>a.day-b.day||a.t.localeCompare(b.t)).forEach(l=>{ const g=groups[l.code]||(groups[l.code]={lessons:[]});
    g.lessons.push({subj:l.subj,day:l.day,t:l.t,par:l.par||undefined,rooms:l.rooms.map(r=>r.r),who:l.rooms.map(r=>r.who).filter(Boolean),unsure:l.unsure||undefined}); });
  /* день занятия по предмету для расчёта дат ДЗ/РК — первое занятие недели (без чс/зн, если такое есть) */
  Object.values(groups).forEach(g=>{ ['ikg','ng'].forEach(s=>{ const ls=g.lessons.filter(l=>l.subj===s); if(!ls.length) return;
    const l=ls.find(x=>!x.par)||ls[0]; g[s]={day:l.day,time:l.t}; }); });
  const days=[...new Set(all.map(l=>l.day))].sort();
  return {about:'Расписание занятий кафедры РК-1 (ИКГ и начертательная геометрия) с 01.09.2026 — переписано с фото стенда. Источник: lk/data/raw/*.txt, сборка: node lk/tools/groups.js',
    updated:new Date().toISOString().slice(0,10),days,groups:Object.keys(groups).sort((a,b)=>a.localeCompare(b,'ru')).reduce((o,k)=>(o[k]=groups[k],o),{})}; }
if(require.main===module){ const j=build(); fs.writeFileSync(path.join(DIR,'groups.json'),JSON.stringify(j)+'\n');
  console.log('групп:',Object.keys(j.groups).length,'· дни:',j.days.join(','),'· занятий:',Object.values(j.groups).reduce((n,g)=>n+g.lessons.length,0)); }
module.exports={build,parseGroup};
