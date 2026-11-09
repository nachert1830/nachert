/* ═══════════ Весь путь в Node: снимок + ответ модели → граф → привязка → 3D → вердикт ═══════════
   run(img RGBA, text, {s, n, sheet}) → {ok, graph, H, stats, bind, fit, verdict}; эталон варианта — lab/ig/ig4ref.json. */
'use strict';
const fs=require('fs'), path=require('path');
const IMG=require('../img.js'), IG=require('../../lk/scan/iggraph.js');
let I4=null; try{ I4=require('../../lk/scan/ig4.js'); }catch(e){ if(!/Cannot find module/.test(e.message)) throw e; }
let REFS=null; const refOf=n=>{ if(!REFS) REFS=JSON.parse(fs.readFileSync(process.env.IGREF||path.join(__dirname,'ig4ref.json'),'utf8')).vars; return REFS[n]; };
function run(img,text,o){ const g=IMG.toGray(img), r=IG.build(g,text,{s:o.s,sheet:o.sheet}); if(!r.ok) return r;
  if(I4&&o.n){ const ref=refOf(o.n); if(ref){ const c=I4.check(r.graph,ref,{D:r.D,ppm:r.raster.ppm}); Object.assign(r,c); } }
  return r; }
module.exports={run,refOf};
