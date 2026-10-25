/* ═══════════ Синтетический лист в клетку: ДЗ №3 от руки (заданное + построение г)) ═══════════
   Для проверки пути «лист в клетку» (grid.js → given.js → explain3d.js) там, где правда известна до 0,01 мм.
   Лист 200 × 260 мм, сетка 5 мм печатью (серая, 0,15–0,22 мм), начало O — в узле сетки (так чертят на клетке),
   заданная пирамида варианта — с ошибкой нанесения или без; построение г) (вращение вокруг h₁ плоскости (SA, n)) —
   верное или с ошибкой шага: p3h — 3′ взята на h′ вместо продолжения S′A′; rad — радиус вращения S на 5 мм больше.
   Съёмка — как у всех синтетических листов (lab/synth.js: перспектива, свет, тень, шум).
   sheet({n, err:'ok'|'given'|'p3h'|'rad', seed, level, noS, shots, glare}) → {img, imgs (серия при shots > 1), truth:{data, drawn, wrong, O, phi, steps}} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const IMG=require('../img.js'), S=require('../synth.js'), font=require('../font.js'), DZ=require('../../core/dz.js'), V=require('../../core/dz-variants.js'), M=require('./model.js'), {v3}=DZ;
const {rng,gray,blur}=IMG;
const v2={add:(a,b)=>[a[0]+b[0],a[1]+b[1]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],mul:(a,k)=>[a[0]*k,a[1]*k],dot:(a,b)=>a[0]*b[0]+a[1]*b[1],len:a=>Math.hypot(a[0],a[1])};
v2.unit=a=>{ const l=v2.len(a)||1; return [a[0]/l,a[1]/l]; };
const Fp=P=>[-P[0],-P[2]], Hp=P=>[-P[0],P[1]];
const meet=(p,e,q,f)=>{ const d=e[0]*f[1]-e[1]*f[0]; if(Math.abs(d)<1e-9) return null; const w=v2.sub(q,p), t=(w[0]*f[1]-w[1]*f[0])/d; return v2.add(p,v2.mul(e,t)); };
/* построение г) по начерченным данным D: возвращает отрезки (мм чертежа) и правду по шагам */
function prog3d(D,err,R){ const {A,B,C,S:Sp}=D, n=v3.unit(v3.cross(v3.sub(B,A),v3.sub(C,A))), h3=v3.unit([n[1],-n[0],0]), hH=v2.unit([-h3[0],h3[1]]), nF=v2.unit([-n[0],-n[2]]), nH=v2.unit([-n[0],n[1]]);
  const segs=[], add=(a,b,k)=>segs.push({a,b,k:k||'thin'});
  const c=Sp[2]+R.r(15,28), SF=Fp(Sp), AF=Fp(A), SH=Hp(Sp), AH=Hp(A);
  const p3=meet(AF,v2.unit(v2.sub(SF,AF)),[0,-c],[1,0]), p4=meet(SF,nF,[0,-c],[1,0]); if(!p3||!p4) return null;
  if(Math.abs(p3[0]-p4[0])<12) return null;
  add([Math.min(p3[0],p4[0])-10,-c],[Math.max(p3[0],p4[0])+10,-c]); add(SF,p3); add(SF,v2.add(p4,v2.mul(v2.unit(v2.sub(p4,SF)),6)));
  /* h′ плоскости ABC через A′ — до стороны B′C′ (как у студентов) */
  const hEnd=meet(AH,hH,Hp(B),v2.unit(v2.sub(Hp(C),Hp(B)))); if(hEnd) add(v2.sub(AH,v2.mul(hH,8)),v2.add(hEnd,v2.mul(hH,25)));
  const E3=meet(AH,v2.unit(v2.sub(SH,AH)),[p3[0],0],[0,1]), E4=meet(SH,nH,[p4[0],0],[0,1]); if(!E3||!E4) return null;
  let q3=E3; if(err==='p3h'){ if(!hEnd) return null; const q=meet(AH,hH,[p3[0],0],[0,1]); if(!q||Math.abs(q[1]-E3[1])<6) return null; q3=q; }
  const q4=E4; add(AH,v2.add(E3,v2.mul(v2.unit(v2.sub(E3,AH)),5))); add(SH,v2.add(q4,v2.mul(v2.unit(v2.sub(q4,SH)),5)));
  /* линии связи 3″→3′, 4″→4′ */
  add(p3,[p3[0],Math.max(q3[1],E3[1])+3]); add(p4,[p4[0],q4[1]+3]);
  const ae=v2.unit(v2.sub(q4,q3)); add(v2.sub(q3,v2.mul(ae,10)),v2.add(q4,v2.mul(ae,10)));
  const nax=[-ae[1],ae[0]], Os=v2.sub(SH,v2.mul(nax,v2.dot(v2.sub(SH,q3),nax))), r1=v2.len(v2.sub(SH,Os)), R0=Math.hypot(r1,c-Sp[2]), Rr=R0+(err==='rad'?5:0);
  const dir=v2.unit(v2.sub(Os,SH)), Sb=v2.add(Os,v2.mul(dir,Rr)); if(r1<3) return null;
  add(SH,v2.add(Sb,v2.mul(dir,4))); add(Sb,q3); add(Sb,q4);
  const ang=(e,f)=>Math.acos(Math.min(1,Math.abs(v2.dot(v2.unit(e),v2.unit(f)))))*180/Math.PI, psi=ang(v2.sub(q3,Sb),v2.sub(q4,Sb));
  return {segs,pts:[['3″',p3],['4″',p4],['3′',q3],['4′',q4],['S̄′',Sb],['O′',Os]],truth:{c,d3:Math.abs(q3[1]-E3[1]),dR:Rr-R0,R:Rr,R0,psi,phi:90-psi}}; }

function sheet(o){ o=o||{}; const n=o.n||7, err=o.err||'ok', R=rng((o.seed||1)*6151+n), lv=S.LEVELS[o.level||'normal'], g=V.get(3,n), data=g.data, page={w:200,h:260};
  /* начерченные данные: ошибка нанесения — одна координата одной точки на 2,5–4 мм */
  const D=JSON.parse(JSON.stringify(data)); let wrong=null;
  if(err==='given'){ const ks=Object.keys(D), k=ks[Math.floor(R()*ks.length)], cI=Math.floor(R()*3), d=(R()<0.5?-1:1)*R.r(2.5,4); D[k][cI]+=d; wrong={k,c:'xyz'[cI],d}; }
  const pr=(err==='p3h'||err==='rad'||(err==='ok'&&R()<0.6))?prog3d(D,err,R):null; if((err==='p3h'||err==='rad')&&!pr) return null;
  const sh=new S.Sheet(page.w,page.h,6), g0=gray(sh.w,sh.h); for(let i=0;i<g0.a.length;i++) g0.a[i]=R(); const g1=blur(g0,0.8); sh.grain=new Float32Array(sh.w*sh.h);
  for(let i=0;i<g1.a.length;i++) sh.grain[i]=Math.max(0.35,Math.min(1,0.7+(g1.a[i]-0.5)*3.2));
  /* сетка печатью */
  sh.layer='print'; const ph=[R()*5,R()*5], gdk=R.r(0.3,0.6), gw=R.r(0.15,0.22);
  for(let u=ph[0];u<page.w;u+=5) sh.stroke([[u,0],[u,page.h]],gw,gdk,{},R); for(let v=ph[1];v<page.h;v+=5) sh.stroke([[0,v],[page.w,v]],gw,gdk,{},R);
  /* O — в узле сетки так, чтобы чертёж влез */
  const items=M.given('3',D), all=items.segs.flatMap(s=>[s.a,s.b]).concat(pr?pr.segs.flatMap(s=>[s.a,s.b]):[]);
  const u0=Math.min(...all.map(p=>p[0])), u1=Math.max(...all.map(p=>p[0]),0), v0=Math.min(...all.map(p=>p[1])), v1=Math.max(...all.map(p=>p[1]));
  if(u1-u0>page.w-30||v1-v0>page.h-30) return null;
  const Ox=ph[0]+5*Math.round((R.r(15-u0,page.w-15-u1)-ph[0])/5), Oy=ph[1]+5*Math.round((R.r(15-v0,page.h-15-v1)-ph[1])/5), O=[Ox,Oy], P=p=>[O[0]+p[0],O[1]+p[1]];
  sh.layer='pencil'; const pen={dk:R.r(...lv.dark),thin:R.r(0.22,0.36),main:R.r(0.45,0.7)}, k=R.r(...lv.hand);
  const jit=new Map(), J=p=>{ const key=p[0].toFixed(2)+','+p[1].toFixed(2); if(!jit.has(key)) jit.set(key,[R.n(0,0.15*k),R.n(0,0.15*k)]); return v2.add(P(p),jit.get(key)); };
  const line=(a,b,w,dk)=>sh.stroke([a,b],w,Math.min(0.95,dk),{wob:R.r(0.02,0.05),grain:true,press:true},R);
  /* оси x и z/y */
  line(P([u0-12,0]),P([u1+10,0]),pen.thin*1.1,pen.dk); line(P([0,v0-6]),P([0,v1+6]),pen.thin,pen.dk*0.9);
  /* заданное: рёбра (рёбра S — иногда только точки: так чертят части, где они не нужны) */
  const noS=o.noS!=null?o.noS:R()<0.25;
  items.segs.forEach(s=>{ if(noS&&s.n.includes('S')) return; line(J(s.a),J(s.b),pen.main,pen.dk*1.1); });
  items.pts.forEach(q=>{ sh.circle(J(q.at),R.r(0.6,0.9),pen.thin,pen.dk,{grain:true},R); const t=q.l.split('').filter(ch=>font.has(ch)).join(''); if(t) sh.text(t,v2.add(J(q.at),[R.r(1.5,2.5),R.r(-3,-1.5)]),R.r(3,4),pen.dk,R.r(0.22,0.32),{grain:true},R); });
  /* линии связи заданных точек — тонко */
  items.conn.forEach(c=>line(J(c.a),J(c.b),pen.thin*0.8,pen.dk*0.6));
  if(pr){ pr.segs.forEach(s=>line(J(s.a),J(s.b),pen.thin,pen.dk*0.85)); pr.pts.forEach(([l,p])=>{ sh.circle(J(p),R.r(0.5,0.8),pen.thin,pen.dk,{grain:true},R); }); }
  const sz=o.size||[1500,2000], cam=S.camera(sh,page,R,lv,sz);
  /* серия: тот же лист, ещё o.shots − 1 съёмок — другой наклон, свет, блик (как телефон в руке); свой поток случайностей */
  const shots=o.shots>1?[cam].concat(Array.from({length:o.shots-1},(_,k)=>S.camera(sh,page,rng((o.seed||1)*7919+n*131+k*17+1),lv,sz,{glare:o.glare==null?0.5:o.glare}))):null;
  return {img:cam.im,imgs:shots&&shots.map(c=>c.im),truth:{n,err,data,drawn:D,wrong,O,ph,H:cam.M,noS,prog:pr&&pr.truth,params:cam.params,shots:shots&&shots.map(c=>Object.assign({H:c.M},c.params))}}; }
put('dzGsynth',{sheet,prog3d});
if(isNode&&require.main===module){ const a=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), s=sheet({n:+(a.n||7),err:a.err||'ok',seed:+(a.seed||1)});
  if(!s){ console.log('лист не построился'); process.exit(1); } require('fs').writeFileSync(a.out||'g.png',IMG.encodePNG(s.img)); console.log(JSON.stringify(s.truth,(k,v)=>k==='H'?undefined:typeof v==='number'?+v.toFixed(2):v)); }
})();
