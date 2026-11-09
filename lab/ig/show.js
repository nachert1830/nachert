/* ═══════════ Граф чертежа → SVG для глаз (отладка, отчёт) ═══════════
   toSVG(graph, {over: второй граф (серым), marks: [{p:[x,y], st:'ошибка'|'верно'|'не уверен', t}]}) → строка SVG в мм листа.
   Цвета: main — чёрный, hidden — синий штрих, axis — зелёный штрихпунктир, thin — серый, wavy — фиолетовый, open — оранжевый;
   линия выреза K — красная. node lab/ig/show.js граф.json [--n=8] > файл.svg */
'use strict';
const COL={main:'#111',hidden:'#1d5fd1',axis:'#169b45',thin:'#999',wavy:'#8a3bc4',open:'#e07b00'};
function toSVG(g,o){ o=o||{}; const W=g.sheet&&g.sheet.w||420, H=g.sheet&&g.sheet.h||297, f=v=>Math.round(v*100)/100;
  const pl=(l,col,w,op)=>`<polyline points="${l.p.map(p=>f(p[0])+','+f(p[1])).join(' ')}" fill="none" stroke="${col}" stroke-width="${w}"${l.type==='hidden'?' stroke-dasharray="2 1"':l.type==='axis'?' stroke-dasharray="6 1.5 1 1.5"':''}${op?` opacity="${op}"`:''}/>`;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W*3}" height="${H*3}"><rect width="${W}" height="${H}" fill="#fff"/>`;
  (g.hatch||[]).forEach(h=>{ s+=`<polygon points="${h.poly.map(p=>f(p[0])+','+f(p[1])).join(' ')}" fill="#e33" fill-opacity=".12"/>`; });
  (g.views||[]).forEach(v=>{ if(v.box) s+=`<rect x="${f(v.box[0])}" y="${f(v.box[1])}" width="${f(v.box[2]-v.box[0])}" height="${f(v.box[3]-v.box[1])}" fill="none" stroke="#fb0" stroke-width=".3"/><text x="${f(v.box[0])}" y="${f(v.box[1]-1)}" font-size="4" fill="#b80">${v.id}</text>`; });
  if(o.over) o.over.lines.forEach(l=>{ s+=pl(l,'#7cc',0.9,0.6); });
  g.lines.forEach(l=>{ s+=pl(l,l.k?'#d00':COL[l.type]||'#000',l.type==='main'?0.45:0.25); });
  (o.marks||[]).forEach(m=>{ const c=m.st==='ошибка'?'#e00':m.st==='верно'?'#0a0':'#e90'; s+=`<circle cx="${f(m.p[0])}" cy="${f(m.p[1])}" r="4" fill="none" stroke="${c}" stroke-width=".6"/>`+(m.t?`<text x="${f(m.p[0]+5)}" y="${f(m.p[1])}" font-size="3.2" fill="${c}">${String(m.t).replace(/</g,'&lt;')}</text>`:''); });
  return s+'</svg>'; }
module.exports={toSVG,COL};
if(require.main===module){ const fs=require('fs'), a=process.argv.slice(2), A=Object.fromEntries(a.filter(s=>s.startsWith('--')).map(s=>s.slice(2).split('=')));
  let g=JSON.parse(fs.readFileSync(a.find(s=>!s.startsWith('--')),'utf8')); if(g.vars) g=g.vars[A.n||8]; process.stdout.write(toSVG(g)); }
