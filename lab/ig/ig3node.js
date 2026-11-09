/* ═══════════ Модуль ИГ сайта (IG3 — геометрия, IGUI/IGS — виды и лист) в Node ═══════════
   Эталон и синтетика строятся тем же кодом, что и сайт: блок от window.IG3 до window.IGNK вырезается из index.html
   (как hands/tools/extract-models.js) и выполняется в vm с заглушками document/window — геометрия и SVG листа чисто вычислительные.
   Модели ДЗ №4 — dz/ig/4/models.js через заглушку DZR.
   const G=require('./ig3node.js'); G.part(8) → модель варианта; G.sheet(model, n) → SVG чистовика; G.ctx — контекст vm.
   Запись вызовов IG3.drawing (G.calls) — чтобы по картинке вида на листе узнать, какой это вид и какие у него линии. */
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..','..');
let G=null;
function load(){ if(G) return G;
  const src=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'), a=src.indexOf('window.IG3=(function(){'), b=src.indexOf('window.IGNK=(function(){'), e=src.indexOf('</script>',a);
  if(a<0||b<a||e<b) throw new Error('ig3node: не нашёл блок IG3…IGS в index.html — формат изменился');
  const el=()=>({getContext:()=>null,style:{},setAttribute(){},appendChild(){},addEventListener(){},classList:{add(){},toggle(){}}});
  const win={document:{createElement:el,querySelector:()=>null,getElementById:()=>null,addEventListener(){}},addEventListener(){},matchMedia:()=>({matches:false}),
    devicePixelRatio:1,navigator:{userAgent:''},location:{hash:''},setTimeout,clearTimeout,console,performance:{now:()=>Date.now()}};
  win.window=win; win.self=win; const ctx=vm.createContext(win);
  vm.runInContext(src.slice(a,b),ctx,{filename:'index.html#IG'});
  vm.runInContext('var DZR={_:{},def(id,o){ this._[id]=Object.assign(this._[id]||{},o); },get(id){ return this._[id]; }};',ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'dz/ig/4/models.js'),'utf8'),ctx,{filename:'dz/ig/4/models.js'});
  /* запись вызовов IG3.drawing: IGS берёт виды через IG3.drawing, результат мемоизирован — по url картинки вид узнаётся однозначно */
  const calls=[], IG3=ctx.IG3, orig=IG3.drawing;
  IG3.drawing=function(m,view,W,off,bnd){ const r=orig.apply(this,arguments); if(r&&!calls.some(c=>c.r===r)) calls.push({view,W,off:off||0,bnd:bnd||0,r}); return r; };
  G={ctx,IG3,IGUI:ctx.IGUI,IGS:ctx.IGS,calls,
    part:n=>ctx.DZR.get('ig4').part(n),
    /* чистовик варианта (как на сайте: dz/ig/4 → IGS.sheet с md, nv, key); key — свой у каждой модели (мемо IGS) */
    sheet:(m,n,key)=>{ const s=ctx.IGS.sheet({md:m,nv:n,key:key||('ig4-'+n),dims:m.dims||[]},'clean'); return typeof s==='string'?s:s.svg; }};
  return G; }
module.exports=new Proxy({},{get:(t,k)=>load()[k]});
