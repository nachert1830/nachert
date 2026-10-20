/* ═══════════ Синтетические листы ДЗ №2 по настоящим вариантам — верные и с ошибками ═══════════
   Сцена листа = заданное варианта + вспомогательные линии разбора сайта (если сайт строит этот вариант; мешают
   проверке так же, как настоящие построения студента) + тело ответа (lab/dz/model.js) — верное или испорченное.
   Ошибки — те, что делают студенты (и проверяет «Сверь свой лист» сайта):
     2а: h  — высота не 80 (70 мм);  other — второе решение (S на продолжении EF);  link — S″ и S′ не на одной линии связи;
     2б: h  — высота 60 вместо 70;   apex — A сдвинута по EF (AB ≠ AC);  other — призма в другую сторону;
     2в: h  — высота 0,8a;  D — |AD| = 0,85|AB|;  other — куб в другую сторону;
     все: vis — одно ребро не той видимости; given — неверно отложена координата точки условия (студент решил свои
          неверные данные); variant — начерчен чужой вариант; none — ответа на листе нет.
   sheet({dz:2, n, err, seed, level, turn}) → {img, truth:{…, expect:'верно'|'ошибка'|'другое решение'|'не тот вариант'|'ответ не найден', err}} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const IMG=require('../img.js'), DZ=require('../../core/dz.js'), V=require('../../core/dz-variants.js'), M=require('./model.js'), {dzSynth}=require('./synth.js');
let REF=null; try{ REF=require('./reference.json'); }catch(e){ REF={}; }
const {v3}=DZ;
const ERRS={'2':['h','other','link','vis'],'2b':['h','apex','other','vis'],'2c':['h','D','other','vis']}, COMMON=['given','variant','none'];
/* решение «как задумано»: 2а — S на отрезке EF; 2б, 2в — тело над основанием, D — в сторону K */
function main(id,r){ if(id==='2') return r.sol.find(s=>s.inSeg)||r.sol[0]; if(id==='2b') return r.sol[0]; return r.sol.find(s=>s.toK&&s.side==='над'); }
function alt(id,r){ if(id==='2') return r.sol.find(s=>!s.inSeg)||r.sol[1]; if(id==='2b') return r.sol[1]; return r.sol.find(s=>s.toK&&s.side==='под'); }
/* испорченное решение: то же построение с неверным числом */
function spoil(id,data,r,err,R){ const s=Object.assign({},main(id,r));
  if(id==='2'&&err==='h'){ const pl=DZ.plane(data.A,data.B,data.C), d=v3.sub(data.F,data.E), t=(70*Math.sign(pl.sd(s.S))-pl.sd(data.E))/v3.dot(pl.n,d); s.S=v3.add(data.E,v3.mul(d,t)); }
  if(id==='2b'){ const n=r.n, k=err==='h'?60/70:1;
    if(err==='apex'){ const d=v3.unit(v3.sub(data.F,data.E)); s.A=v3.add(s.A,v3.mul(d,(R()<0.5?-1:1)*9)); }
    const sh=v3.mul(v3.unit(v3.sub(s.A1,r.A)),70*k); s.A1=v3.add(s.A,sh); s.B1=v3.add(data.B,sh); s.C1=v3.add(data.C,sh); }
  if(id==='2c'){ const a=s.a, w=v3.unit(v3.sub(s.D,data.A)), up=v3.unit(v3.sub(s.A1,data.A)); let D=s.D, hh=a;
    if(err==='D') D=v3.add(data.A,v3.mul(w,0.85*a)); if(err==='h') hh=0.8*a;
    const C=v3.add(s.B,v3.sub(D,data.A)), sh=v3.mul(up,hh); Object.assign(s,{D,C,A1:v3.add(data.A,sh),B1:v3.add(s.B,sh),C1:v3.add(C,sh),D1:v3.add(D,sh)}); }
  return s; }
/* вспомогательные линии разбора сайта (без заданного и ответа) */
function aux(dz,n){ const r=REF[dz+'-'+n]; if(!r) return []; return r.parts[0].items.filter(it=>it.k==='aux'&&(it.t==='line'||it.t==='seg'||it.t==='pt'||it.t==='sq')||it.t==='conn'&&!it.k); }
function sheet(o){ const dz=o.dz||2, n=o.n, err=o.err||'ok', R=IMG.rng((o.seed||1)*7919+n);
  let g=V.get(dz,n), data=g.data, id=g.id, claimed=n, drawn=n;
  if(err==='variant'){ do{ drawn=1+Math.floor(R()*30); }while(drawn===n||V.get(dz,drawn).id!==id&&R()<0.5); g=V.get(dz,drawn); data=g.data; id=g.id; }
  let wrongPt=null;
  if(err==='given'){ data=JSON.parse(JSON.stringify(data)); const ks=Object.keys(data), k=ks[Math.floor(R()*ks.length)], c=Math.floor(R()*3); data[k][c]+=(R()<0.5?-1:1)*8; wrongPt=k+' '+'xyz'[c]; }
  const r=DZ.solve(id,data); if(!r.ok) return null;
  let sol=err==='none'?null:err==='other'?alt(id,r):(err==='h'||err==='apex'||err==='D')?spoil(id,data,r,err,R):main(id,r);
  let items=M.items(id,data,sol);
  if(err==='link'){ const d=v3.sub(data.F,data.E), L=v3.len(d), S2=v3.add(sol.S,v3.mul(d,(R()<0.5?-7:7)/Math.hypot(d[0],d[1]))), H2=M.Hp(S2), H1=M.Hp(sol.S);
    /* S′ ушла вдоль E′F′ на 7 мм — рёбра горизонтальной проекции из новой S′ */
    items=items.map(it=>{ if(it.pr==='h'&&it.edge&&it.edge.includes('S')){ const a=Math.hypot(it.a[0]-H1[0],it.a[1]-H1[1])<1e-9?H2:it.a, b=Math.hypot(it.b[0]-H1[0],it.b[1]-H1[1])<1e-9?H2:it.b; return Object.assign({},it,{a,b}); }
      if(it.t==='pt'&&it.l==='S′') return Object.assign({},it,{at:H2}); if(it.t==='conn'&&Math.hypot(it.b[0]-H1[0],it.b[1]-H1[1])<1e-9) return null; return it; }).filter(Boolean); }
  let flipped=null;
  if(err==='vis'){ const cand=items.filter(it=>it.edge); const it=cand[Math.floor(R()*cand.length)]; it.k=it.k==='res'?'resd':'res'; flipped=it.edge+(it.pr==='f'?'″':'′'); }
  /* поместится ли чертёж в поле А3 (272 × 355 мм) с полями: второе решение часто уходит за лист — такой лист
     студент начертить не может, его не делаем */
  let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9; items.forEach(it=>it.k==='aux'||it.t==='conn'?0:['at','a','b'].forEach(f=>{ if(it[f]){ u0=Math.min(u0,it[f][0]); u1=Math.max(u1,it[f][0]); v0=Math.min(v0,it[f][1]); v1=Math.max(v1,it[f][1]); } }));
  if(u1-u0>272-40||v1-v0>355-30) return null;
  /* вспомогательные линии сайта — только для верно начерченного заданного (у чужих данных свои) */
  if(err!=='given') items=items.concat(aux(dz,drawn).map(it=>Object.assign({},it)));
  const s=dzSynth({items,seed:o.seed||1,level:o.level||'normal',turn:o.turn!=null?o.turn:0});
  const expect=err==='ok'?'верно':err==='other'?'другое решение':err==='variant'?'не тот вариант':err==='none'?'ответ не найден':'ошибка';
  s.truth=Object.assign(s.truth,{dz,n:claimed,drawn,id,err,expect,wrongPt,flipped,data,sol});
  return s; }
/* лист 2а с построением (lab/dz/prog2a.js): заданное + вспомогательные линии решения + пирамида из той S, что вышла;
   ошибка — на одном шаге построения (n_dir, len, proj, beta, pick), дальше студент строит честно от неверного */
const PROG_ERRS=['ok','n_dir','len','proj','beta','pick'];
function progSheet(o){ const n=o.n, err=o.err||'ok', g=V.get(2,n); if(g.id!=='2') return null; const data=g.data, P=require('./prog2a.js'), b=P.build(data,{err,pickSign:o.pickSign});
  if(!b) return null; let items=M.items('2',data,{S:b.S}).concat(b.items);
  let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9; items.forEach(it=>['at','a','b'].forEach(f=>{ if(it[f]){ u0=Math.min(u0,it[f][0]); u1=Math.max(u1,it[f][0]); v0=Math.min(v0,it[f][1]); v1=Math.max(v1,it[f][1]); } }));
  if(u1-u0>272-40||v1-v0>355-30) return null;
  const s=dzSynth({items,seed:o.seed||1,level:o.level||'normal',turn:o.turn!=null?o.turn:0});
  const dh=Math.abs(b.steps.Sh-80), expect=dh>=3?'ошибка':dh<=1.5?'верно':'?';
  s.truth=Object.assign(s.truth,{dz:2,n,id:'2',err,expect,data,sol:{S:b.S},prog:b.steps}); return s; }
put('dzVsynth',{sheet,ERRS,COMMON,main,alt,progSheet,PROG_ERRS});
if(isNode&&require.main===module){ const a=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
  const s=sheet({dz:2,n:+(a.n||8),err:a.err||'ok',seed:+(a.seed||1),turn:a.turn!=null?+a.turn:0}); require('fs').writeFileSync(a.out||'v.png',IMG.encodePNG(s.img));
  console.log('ДЗ2 в'+s.truth.n+' (начерчен '+s.truth.drawn+'), ошибка '+s.truth.err+', ждём «'+s.truth.expect+'»'+(s.truth.wrongPt?', неверно: '+s.truth.wrongPt:'')+(s.truth.flipped?', видимость: '+s.truth.flipped:'')); }
})();
