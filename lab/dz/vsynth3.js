/* ═══════════ Синтетические листы ДЗ №3 по настоящим вариантам — четыре построения на одном листе ═══════════
   Заданная пирамида (с видимостью) и построения а)–г) (lab/dz/model3.js) со случайными выборами студента: проекция-
   основа (h′ или f″), место и сторона новых осей, прямая уровня и её уровень, направление поворота. Места выбираются
   так, чтобы построения не налезали друг на друга и помещались в поле А3.
   Ошибки: a_dir — x ⟂ h′ проведена с ошибкой 8° (основание не в прямую); a_d — для одной точки на π₄ отложено не то
   расстояние (+6 мм); b_dir — вторая ось не ⟂ A₄B₄ (8°); c_R — неверный радиус одной вершины при вращении (−6 мм);
   d_R — неверный радиус S при вращении (−6 мм); vis — ребро заданной пирамиды не той видимости; given; variant.
   sheet({n, err, seed, level, turn}) → {img, truth:{…, expect, err, parts}} */
(function(){
const IMG=require('../img.js'), DZ=require('../../core/dz.js'), V=require('../../core/dz-variants.js'), M=require('./model.js'), M3=require('./model3.js'), {dzSynth}=require('./synth.js');
const {v2,Fp,Hp}=M3, NM=M3.NAMES, SUBN={'4':'₄','5':'₅','0':'₀'};
const seg=(a,b,k,o)=>Object.assign({t:'seg',a,b,k:k||'thin'},o||{}), pt=(at,l)=>({t:'pt',at,l});
const ext=(P,Q,e)=>{ const u=v2.unit(v2.sub(Q,P)); return [v2.sub(P,v2.mul(u,e)),v2.add(Q,v2.mul(u,e))]; };
const bbox=pts=>{ let a=[1e9,1e9,-1e9,-1e9]; pts.forEach(p=>{ a=[Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[2],p[0]),Math.max(a[3],p[1])]; }); return a; };
const overlap=(a,b,m)=>!(a[2]+m<b[0]||b[2]+m<a[0]||a[3]+m<b[1]||b[3]+m<a[1]);
/* а) замена: ось ⟂ h′ (или ⟂ f″) — на расстоянии off от A′ (A″) */
function partA(g,ch,err,R){ const d=M3.dirs(g), base=ch.base, P0=base==='h'?Hp(g.A):Fp(g.A); let e=v2.perp(base==='h'?d.hH:d.fF);
  if(err==='a_dir') e=v2.unit([e[0]*Math.cos(0.14)-e[1]*Math.sin(0.14),e[0]*Math.sin(0.14)+e[1]*Math.cos(0.14)]);
  const nrm=v2.perp(e), L=M3.line(v2.add(P0,v2.mul(nrm,ch.off)),e); let s=M3.first(g,base,L,ch.side);
  let wrong=null; if(err==='a_d'){ const k=NM[Math.floor(R()*3)]; s.P[k]=v2.add(s.P[k],v2.mul(s.nu,6)); wrong=k; }
  const it=[], keep=k=>base==='h'?Hp(g[k]):Fp(g[k]), mk=base==='h'?'′':'″';
  const ax=ext(v2.add(L.p,v2.mul(e,-10)),v2.add(L.p,v2.mul(e,60)),0); NM.forEach(k=>{ it.push(seg(keep(k),s.P[k],'thin'),pt(s.P[k],k+'₄')); });
  /* прямая уровня основания на обеих проекциях — через A (её второй конец — на стороне BC) */
  const {A,B,C}=g, lvl=base==='h'?2:1, t=(A[lvl]-B[lvl])/((C[lvl]-B[lvl])||1e-9), Dp=[B[0]+(C[0]-B[0])*t,B[1]+(C[1]-B[1])*t,B[2]+(C[2]-B[2])*t];
  if(t>=0&&t<=1) it.push(seg(Fp(A),Fp(Dp),'thin'),seg(Hp(A),Hp(Dp),'thin'));
  /* вырожденная проекция основания (A₄B₄C₄) и пирамида на π₄; высота S₄K₄ */
  const ps=[s.P.A,s.P.B,s.P.C]; let far=[0,1]; for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) if(v2.len(v2.sub(ps[i],ps[j]))>v2.len(v2.sub(ps[far[0]],ps[far[1]]))) far=[i,j];
  const E=M3.line(ps[far[0]],v2.sub(ps[far[1]],ps[far[0]])), K=M3.foot(s.P.S,E);
  if(err==='a_dir') it.push(seg(s.P.A,s.P.B,'main'),seg(s.P.B,s.P.C,'main'),seg(s.P.C,s.P.A,'main')); else it.push(seg(...ext(ps[far[0]],ps[far[1]],4),'main'));
  ['A','B','C'].forEach(k=>it.push(seg(s.P.S,s.P[k],'main'))); it.push(seg(s.P.S,K,'res'),pt(K,'K₄'));
  it.push(seg(ax[0],ax[1],'thin',{axis:'x'+(base==='h'?'1':'2')+'4'}));
  return {items:it,box:bbox(ps.concat([s.P.S,ax[0],ax[1]])),info:{base,L,side:ch.side,P:s.P,wrong}}; }
/* б) две замены: x ∥ A′B′ (A″B″), затем x ⟂ A₄B₄ */
function partB(g,ch,err){ const d=M3.dirs(g), base=ch.base, P0=base==='h'?Hp(g.A):Fp(g.A), e1=base==='h'?d.ABh:d.ABf, L1=M3.line(v2.add(P0,v2.mul(v2.perp(e1),ch.off)),e1), s1=M3.first(g,base,L1,ch.side);
  const ab=v2.unit(v2.sub(s1.P.B,s1.P.A)); let e2=v2.perp(ab); if(err==='b_dir') e2=v2.unit([e2[0]*Math.cos(0.14)-e2[1]*Math.sin(0.14),e2[0]*Math.sin(0.14)+e2[1]*Math.cos(0.14)]);
  const L2=M3.line(v2.add(s1.P.A,v2.mul(ab,ch.off2)),e2), s2=M3.second(g,s1,L2,ch.side2), it=[], keep=k=>base==='h'?Hp(g[k]):Fp(g[k]);
  NM.forEach(k=>{ it.push(seg(keep(k),s1.P[k],'thin'),pt(s1.P[k],k+'₄'),seg(s1.P[k],s2.P[k],'thin')); });
  [['A','B'],['B','C'],['C','A'],['S','A'],['S','B'],['S','C']].forEach(([a,b])=>it.push(seg(s1.P[a],s1.P[b],'thin')));
  it.push(pt(s2.P.A,'A₅'),pt(s2.P.C,'C₅'),pt(s2.P.S,'S₅'),seg(s2.P.A,s2.P.C,'res'),seg(s2.P.A,s2.P.S,'res'));
  if(err==='b_dir') it.push(seg(s2.P.B,s2.P.C,'res'),seg(s2.P.B,s2.P.S,'res'),pt(s2.P.B,'B₅'));
  const a1=ext(v2.add(L1.p,v2.mul(e1,-15)),v2.add(L1.p,v2.mul(e1,95)),0), a2=ext(v2.add(L2.p,v2.mul(e2,-25)),v2.add(L2.p,v2.mul(e2,25)),0);
  it.push(seg(a1[0],a1[1],'thin',{axis:'x'+(base==='h'?'1':'2')+'4'}),seg(a2[0],a2[1],'thin',{axis:'x45'}));
  return {items:it,box:bbox(Object.values(s1.P).concat(Object.values(s2.P),[a1[0],a1[1],a2[0],a2[1]])),info:{base,L1,L2,P4:s1.P,P5:s2.P}}; }
/* в) вращение вокруг прямой уровня до ∥ π₁ (π₂) */
function partC(g,ch,err,R){ const t=M3.rotate(g,ch.form,ch.c,ch.same); if(!t) return null; const P=Object.assign({},t.P), proj=ch.form==='h'?Hp:Fp, it=[];
  let wrong=null; if(err==='c_R'){ const cand=['A','B','C'].filter(k=>v2.len(v2.sub(P[k],proj(g[k])))>8); if(cand.length){ wrong=cand[Math.floor(R()*cand.length)]; const u=v2.unit(v2.sub(P[wrong],proj(g[wrong]))); P[wrong]=v2.sub(P[wrong],v2.mul(u,6)); } }
  ['A','B','C'].forEach(k=>{ if(v2.len(v2.sub(P[k],proj(g[k])))>1) it.push(seg(proj(g[k]),P[k],'thin')); it.push(pt(P[k],k+'₀')); });
  it.push(seg(P.A,P.B,'res'),seg(P.B,P.C,'res'),seg(P.C,P.A,'res'));
  const ax=t.axis, a=ext(v2.add(ax.p,v2.mul(ax.e,-70)),v2.add(ax.p,v2.mul(ax.e,70)),0); it.push(seg(a[0],a[1],'thin',{axis:ch.form}));
  return {items:it,box:bbox(Object.values(P)),info:{form:ch.form,c:ch.c,same:ch.same,P,wrong}}; }
/* г) угол SA с основанием: вращение Σ = (SA, n) */
function partD(g,ch,err){ const t=M3.sigma(g,ch.c,ch.same); if(!t) return null; let S0=t.S0;
  if(err==='d_R'){ const u=v2.unit(v2.sub(S0,M3.foot(S0,t.axis))); S0=v2.sub(S0,v2.mul(u,6)); }
  const d=M3.dirs(g), S=g.S, it=[];
  /* n из S: n″ ⟂ f″, n′ ⟂ h′ (до уровня c) */
  const nF=v2.perp(d.fF), nH=v2.perp(d.hH); it.push(seg(Fp(S),v2.add(Fp(S),v2.mul(nF,35)),'thin'),seg(Hp(S),t.Y0,'thin'));
  it.push(seg(Hp(S),S0,'thin'),seg(S0,t.A0,'res'),seg(S0,t.Y0,'res'),pt(S0,'S₀'));
  if(v2.len(v2.sub(t.A0,Hp(g.A)))>1) it.push(seg(Hp(g.A),t.A0,'thin'),pt(t.A0,'A₀'));
  const a=ext(v2.add(t.axis.p,v2.mul(t.axis.e,-40)),v2.add(t.axis.p,v2.mul(t.axis.e,40)),0); it.push(seg(a[0],a[1],'thin',{axis:'h'}));
  return {items:it,box:bbox([S0,t.A0,t.Y0]),info:{c:ch.c,same:ch.same,S0,A0:t.A0,Y0:t.Y0,psi:t.psi}}; }
function sheet(o){ const n=o.n, err=o.err||'ok', R=IMG.rng((o.seed||1)*104729+n*31);
  let g=V.get(3,n), drawn=n; if(err==='variant'){ do{ drawn=1+Math.floor(R()*30); }while(drawn===n||Math.abs(DZ.solve('3',V.get(3,drawn).data).H-DZ.solve('3',g.data).H)<0.5); g=V.get(3,drawn); }
  let data=JSON.parse(JSON.stringify(g.data)), wrongPt=null;
  if(err==='given'){ const k=NM[Math.floor(R()*4)], c=Math.floor(R()*3); data[k][c]+=(R()<0.5?-1:1)*7; wrongPt=k+' '+'xyz'[c]; }
  /* заданное: пирамида с видимостью */
  const r=DZ.solve('3',data); if(!r.ok) return null;
  let items=M.items('3',data,{}).filter(it=>it.t!=='seg'), S=M.solid('3',null,data), flipped=null;
  const edges=S.edges.map(e=>[['f',Fp],['h',Hp]].map(([pr,P])=>({t:'seg',a:P(S.V[e.a]),b:P(S.V[e.b]),k:e[pr]==='hid'?'hid':'main',edge:e.a+e.b,pr}))).flat();
  if(err==='vis'){ const c=edges.filter(x=>x.k==='main'||x.k==='hid'), x=c[Math.floor(R()*c.length)]; x.k=x.k==='hid'?'main':'hid'; flipped=x.edge+(x.pr==='f'?'″':'′'); }
  items=items.concat(edges);
  const gbox=bbox(items.filter(it=>it.at).map(it=>it.at)); const parts={}, boxes=[gbox]; let ok=true;
  /* построения: случайные выборы, без наложения рамок построений и в пределах поля (≈ 260 × 340 мм вокруг O) */
  const all=()=>boxes.reduce((a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]);
  const tries=(f)=>{ for(let k=0;k<200;k++){ const p=f(); if(!p) continue; const b=p.box; if(boxes.some(q=>overlap(q,b,4))) continue; boxes.push(b); const A=all(); if(A[2]-A[0]>255||A[3]-A[1]>335){ boxes.pop(); continue; } return p; } return null; };
  parts.a=tries(()=>partA(data,{base:R()<0.6?'h':'f',off:(R()<0.5?-1:1)*(25+R()*60),side:R()<0.5?1:-1},err,R));
  parts.b=tries(()=>partB(data,{base:R()<0.6?'h':'f',off:(R()<0.5?-1:1)*(25+R()*60),side:R()<0.5?1:-1,off2:(R()<0.5?-1:1)*(15+R()*40),side2:R()<0.5?1:-1},err));
  const zc=[data.A[2],data.B[2],data.C[2]], yc=[data.A[1],data.B[1],data.C[1]];
  parts.c=(()=>{ for(let k=0;k<40;k++){ const form=R()<0.7?'h':'f', c=(form==='h'?zc:yc)[Math.floor(R()*3)], p=partC(data,{form,c,same:R()<0.75},err,R); if(p) return p; } return null; })();
  parts.d=(()=>{ for(let k=0;k<40;k++){ const p=partD(data,{c:data.A[2],same:R()<0.75},err); if(p) return p; } return null; })();
  if(o.dbg) console.log('части',Object.entries(parts).map(([k,p])=>k+':'+!!p).join(' '));
  if(!parts.a||!parts.b||!parts.c||!parts.d) return null;
  Object.values(parts).forEach(p=>{ items=items.concat(p.items); });
  const s=dzSynth({items,seed:o.seed||1,level:o.level||'normal',turn:o.turn!=null?o.turn:0});
  const expect=err==='ok'?'верно':err==='variant'?'не тот вариант':'ошибка';
  s.truth=Object.assign(s.truth,{dz:3,n,drawn,id:'3',err,expect,wrongPt,flipped,data,parts:Object.fromEntries(Object.entries(parts).map(([k,p])=>[k,p.info]))});
  return s; }
module.exports={sheet,ERRS:['a_dir','a_d','b_dir','c_R','d_R','vis','given','variant']};
if(require.main===module){ const a=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
  const s=sheet({n:+(a.n||8),err:a.err||'ok',seed:+(a.seed||1),turn:a.turn!=null?+a.turn:0}); if(!s){ console.log('не разместилось'); process.exit(1); }
  require('fs').writeFileSync(a.out||'v3.png',IMG.encodePNG(s.img)); console.log('ДЗ3 в'+s.truth.n+', ошибка '+s.truth.err+', ждём «'+s.truth.expect+'»', JSON.stringify(Object.fromEntries(Object.entries(s.truth.parts).map(([k,p])=>[k,p.base||p.form]))));
}
})();
