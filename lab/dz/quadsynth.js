/* ═══════════ Синтетический лист ДЗ №3, как у студентов: четыре чертежа на одном А3 ═══════════
   Каждая часть — отдельный чертёж со своими осями и своей копией заданной пирамиды (с подписями A″, B′, …):
   1) высота (замена плоскостей), 2) угол граней, 3) истинный вид ABC (вращение), 4) угол SA (вращение плоскости).
   Построения — из lab/dz/vsynth3.js (те же случайные выборы студента); чертёж ставится в свою четверть поля над штампом.
   Нужен для замера глаз (eyes-eval.js): правда известна для каждой подписи каждого чертежа.
   sheet({n, seed, level, turn}) → {img, truth:{H (мм листа → px), n, data, groups:[{part, O (мм листа), pts:{A″:[u,v] мм листа}}]}} */
const IMG=require('../img.js'), DZ=require('../../core/dz.js'), V=require('../../core/dz-variants.js'), M=require('./model.js'), M3=require('./model3.js'), V3=require('./vsynth3.js'), DS=require('./sheet.js'), {dzSynth}=require('./synth.js');
const {Fp,Hp}=M3, NM=M3.NAMES;
const bbox=pts=>{ let a=[1e9,1e9,-1e9,-1e9]; pts.forEach(p=>{ a=[Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[2],p[0]),Math.max(a[3],p[1])]; }); return a; };
const itemPts=it=>['at','a','b'].map(f=>it[f]).filter(Boolean);
function sheet(o){ const n=o.n, R=IMG.rng((o.seed||1)*7349+n*13), data=V.get(3,n).data; if(!DZ.solve('3',data).ok) return null;
  /* заданное: пирамида с видимостью, подписи — для каждой копии */
  const S=M.solid('3',null,data), given=M.items('3',data,{}).filter(it=>it.t!=='seg').concat(S.edges.map(e=>[['f',Fp],['h',Hp]].map(([pr,P])=>({t:'seg',a:P(S.V[e.a]),b:P(S.V[e.b]),k:e[pr]==='hid'?'hid':'main'}))).flat());
  const F=DS.FIELD, cw=(F[2]-F[0])/2, ch=(F[3]-F[1])/2, cells=[[F[0],F[1]],[F[0]+cw,F[1]],[F[0],F[1]+ch],[F[0]+cw,F[1]+ch]];
  const zc=[data.A[2],data.B[2],data.C[2]], yc=[data.A[1],data.B[1],data.C[1]];
  /* o.err — ошибка в одной части (как в vsynth3.js): a_dir, a_d, b_dir, c_R, d_R; остальные части верны */
  const E=p=>o.err&&o.err[0]===p?o.err:'ok';
  const mk={a:()=>V3.partA(data,{base:R()<0.6?'h':'f',off:(R()<0.5?-1:1)*(20+R()*25),side:R()<0.5?1:-1},E('a'),R),
    b:()=>V3.partB(data,{base:R()<0.6?'h':'f',off:(R()<0.5?-1:1)*(20+R()*25),side:R()<0.5?1:-1,off2:(R()<0.5?-1:1)*(12+R()*20),side2:R()<0.5?1:-1},E('b')),
    c:()=>{ const form=R()<0.7?'h':'f'; return V3.partC(data,{form,c:(form==='h'?zc:yc)[Math.floor(R()*3)],same:R()<0.75},E('c'),R); },
    d:()=>V3.partD(data,{c:data.A[2],same:R()<0.75},E('d'))};
  const groups=[], gt=[];
  ['a','b','c','d'].forEach((part,i)=>{ const [x0,y0]=cells[i];
    /* построение части, которое помещается в четверть (с полями 6 мм): до 300 попыток, иначе — только заданное */
    let items=given, built=false;
    for(let k=0;k<300;k++){ let p=null; try{ p=mk[part](); }catch(e){} if(!p) continue; const its=given.concat(p.items), b=bbox(its.flatMap(itemPts));
      if(b[2]-b[0]+27<=cw-2&&b[3]-b[1]+16<=ch-2){ items=its; built=true; break; } }
    const b=bbox(items.flatMap(itemPts)), O=[x0+6+15-b[0]+R()*Math.max(0,cw-12-(b[2]-b[0]+30)),y0+6+8-b[1]+R()*Math.max(0,ch-12-(b[3]-b[1]+16))];
    groups.push({items,O}); const pts={}; M.given('3',data).pts.forEach(q=>{ pts[q.l]=[O[0]+q.at[0],O[1]+q.at[1]]; }); pts.O=O.slice();
    gt.push({part,built,err:built&&E(part)!=='ok'?E(part):null,O,pts,box:[O[0]+b[0]-15,O[1]+b[1]-8,O[0]+Math.max(0,b[2])+12,O[1]+b[3]+8]}); });
  const s=dzSynth({groups,seed:o.seed||1,level:o.level||'normal',turn:o.turn!=null?o.turn:0,size:o.size,clean:o.clean});
  s.truth=Object.assign(s.truth,{dz:3,n,data,parts:gt,err:o.err||'ok'}); return s; }
module.exports={sheet};
if(require.main===module){ const a=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
  const s=sheet({n:+(a.n||9),seed:+(a.seed||1),turn:a.turn!=null?+a.turn:0}); require('fs').writeFileSync(a.out||'quad.png',IMG.encodePNG(s.img));
  console.log('ДЗ3 в'+s.truth.n+': чертежей 4, построено '+s.truth.parts.map(p=>p.part+(p.built?'+':'-')).join(' ')); }
