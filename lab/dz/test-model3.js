/* Тест модели построений ДЗ №3: node lab/dz/test-model3.js
   На всех 30 вариантах и при любых свободных выборах студента (проекция-основа h/f, сторона откладывания, место
   новой оси; прямая уровня h/f, её уровень, направление поворота) построения lab/dz/model3.js дают ответы решателя
   core/dz.js: A₄B₄C₄ на одной прямой и H; A₅ ≡ B₅ и двугранный угол; стороны A₀B₀C₀; угол φ. */
const M=require('./model3.js'), DZ=require('../../core/dz.js'), V=require('../../core/dz-variants.js'), {v2}=M;
const worst={H:0,dih:0,tri:0,phi:0}; let cases=0;
const dl=(P,L)=>Math.abs(v2.dot(v2.sub(P,L.p),v2.perp(L.e)));
for(let n=1;n<=30;n++){ const g=V.get(3,n).data, r=DZ.solve('3',g), d=M.dirs(g);
  for(const base of ['h','f']) for(const side of [1,-1]) for(const off of [-40,-5,25]){ cases++;
    const P0=base==='h'?M.Hp(g.A):M.Fp(g.A), e=v2.perp(base==='h'?d.hH:d.fF), L=M.line(v2.add(P0,v2.mul(v2.perp(e),off)),e), s=M.first(g,base,L,side);
    const ps=[s.P.A,s.P.B,s.P.C]; let far=[0,1]; for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) if(v2.len(v2.sub(ps[i],ps[j]))>v2.len(v2.sub(ps[far[0]],ps[far[1]]))) far=[i,j];
    const E=M.line(ps[far[0]],v2.sub(ps[far[1]],ps[far[0]])); worst.H=Math.max(worst.H,...ps.map(p=>dl(p,E)),Math.abs(dl(s.P.S,E)-r.H));
    const e1=base==='h'?d.ABh:d.ABf, L1=M.line(v2.add(P0,v2.mul(v2.perp(e1),off)),e1), s1=M.first(g,base,L1,side), ab=v2.unit(v2.sub(s1.P.B,s1.P.A)), L2=M.line(v2.add(s1.P.A,v2.mul(ab,30)),v2.perp(ab)), s2=M.second(g,s1,L2,-side);
    const a5=s2.P.A, ang=Math.acos(v2.dot(v2.unit(v2.sub(s2.P.C,a5)),v2.unit(v2.sub(s2.P.S,a5))))*180/Math.PI; worst.dih=Math.max(worst.dih,v2.len(v2.sub(s2.P.A,s2.P.B)),Math.abs(ang-r.dih));
    for(const form of ['h','f']) for(const same of [true,false]){ const t=M.rotate(g,form,(form==='h'?g.A[2]:g.A[1])+off/4,same); if(!t) continue; const P=t.P;
      worst.tri=Math.max(worst.tri,Math.abs(v2.len(v2.sub(P.A,P.B))-r.AB),Math.abs(v2.len(v2.sub(P.B,P.C))-r.BC),Math.abs(v2.len(v2.sub(P.C,P.A))-r.CA)); }
    for(const same of [true,false]){ const t=M.sigma(g,g.A[2]+off/5,same); if(t) worst.phi=Math.max(worst.phi,Math.abs(t.phi-r.phi)); } } }
const ok=Object.values(worst).every(v=>v<1e-9);
console.log('ДЗ №3, 30 вариантов, '+cases+' наборов выборов: наибольшее расхождение с решателем — высота '+worst.H.toExponential(1)+' мм, двугранный '+worst.dih.toExponential(1)+'° (и |A₅B₅|), стороны истинного вида '+worst.tri.toExponential(1)+' мм, φ '+worst.phi.toExponential(1)+'°. '+(ok?'Ошибок нет.':'ЕСТЬ РАСХОЖДЕНИЯ'));
process.exit(ok?0:1);
