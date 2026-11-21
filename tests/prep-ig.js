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
/* интерактивные темы: сопряжения — в Node (ядро сопряжений), виды и разрезы — в браузере (3D-ядро IG3 живёт в index.html) */
global.self=global; require(path.join(ROOT,'prep/engine.js')); self.PREPIG=G; require(path.join(ROOT,'prep/ig-conj.js'));
const PR=self.PREP; let conjN=0;
for(const id of Object.keys(PR.TOPICS).filter(id=>G.BY[id])){ const t=PR.TOPICS[id]; conjN++;
  for(const k of Object.keys(t.traps)){ let n=0; for(let i=0;i<20;i++) if(PR.pair(t,k)) n++; if(n<18) bad(`тема ${id}, ловушка ${k}: честных пар ${n} из 20`); }
  const V=t.watch.V.call(t); if(!V||!t.watch.steps.length) bad(`тема ${id}: нет шагов «Смотри»`); }
if(conjN<9) bad('сопряжения: интерактивных тем меньше 9');
async function browser(){
  let chromium; try{ ({chromium}=require('playwright')); }catch(e){ return 'браузер: playwright не найден — пропущено'; }
  const http=require('http'); const srv=await new Promise(r=>{ const s=http.createServer((q,res)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ res.writeHead(404); return res.end(); }
    res.writeHead(200,{'content-type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json'}[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(res); }).listen(0,()=>r(s)); });
  const b=await chromium.launch(), pg=await b.newPage(), errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const base='http://127.0.0.1:'+srv.address().port+'/';
  await pg.goto(base+'#/prep'); await pg.waitForFunction(()=>window.IG3&&window.PREP&&window.PREPIG,null,{timeout:60000});
  const st=await pg.evaluate(()=>{ const out={}; PREPIG.ALL.forEach(t=>{ const T=PREP.TOPICS[t.id]; if(!T) return; const r={}; Object.keys(T.traps).forEach(k=>{ let n=0; for(let i=0;i<4;i++) if(PREP.pair(T,k)) n++; r[k]=n; }); out[t.id]=r; }); return out; });
  for(const id in st) for(const k in st[id]) if(st[id][k]<3) bad(`браузер: тема ${id}, ловушка ${k}: пар ${st[id][k]} из 4`);
  for(const h of ['#/prep','#/prep/igall','#/prep/ig4','#/prep/ig2/v2','#/prep/ig2/v1d','#/prep/ig1/g11','#/prep/all']){ await pg.goto(base+h); await pg.waitForTimeout(800);
    if(!(await pg.$('.pp'))) bad('браузер: экран '+h+' не нарисован'); }
  errs.forEach(e=>bad('браузер: ошибка страницы: '+e));
  await b.close(); srv.close(); return `браузер: интерактивных тем ${Object.keys(st).length}`;
}
console.log(`ИГ: ${G.ALL.length} тем, ${G.ALL.reduce((s,t)=>s+t.traps.length,0)} ловушек; курсы: ${G.COURSES.map(c=>c.label.replace('Задание ','')+' '+c.own.length+'+'+c.prev.length).join(', ')}`);
(process.argv.includes('--no-browser')?Promise.resolve('браузер: пропущено'):browser()).then(m=>{ console.log(m);
  if(fails.length){ console.log('ОШИБКИ:\n'+fails.join('\n')); process.exit(1); } console.log('ок'); });
