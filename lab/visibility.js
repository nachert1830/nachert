/* ═══════════ Видимость (№ 46): как обведена каждая напечатанная сторона ═══════════
   Студент обводит стороны треугольников поверх тонкой печати: видимые участки — основной линией, закрытые —
   штриховой. Печать маскируется при поиске линий, поэтому обводку читаем отдельно — вдоль известной стороны:
   через 0,5 мм профиль поперёк (±0,8 мм) по карте тёмности без маски; «вес» профиля сравнивается с весом
   одной печати (ось x — та же тонкая печать, её студент не обводит) и с весом основной линии студента.
   Точка «обведено», если вес ближе к основной линии, чем к печати. Около вершин и пересечений с другими
   линиями (печать, построения) — не читаем.
   read(ln, G) → {sides: {'AB″': [{t, ink}]…}, wb, wm}; score(obs, pattern) → лог-правдоподобие узора и худший участок. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('./'+n+'.js'):self.LAB[n];
const core=n=>isNode?require('../core/'+n+'.js'):((self.CORE&&self.CORE[n])||(self.CERT&&self.CERT[n]));
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const {v2,L2}=core('model');

function weightAt(map,p,n){ const {g,box,O}=map, P=g.ppm||8; let s=0, base=1;
  for(let q=-1.3;q<=1.3;q+=0.125){ const x=(p[0]+n[0]*q+O[0]-box[0])*P-0.5, y=(p[1]+n[1]*q+O[1]-box[1])*P-0.5, x0=Math.floor(x), y0=Math.floor(y);
    if(x0<0||y0<0||x0>=g.w-1||y0>=g.h-1) return null; const fx=x-x0, fy=y-y0, i=y0*g.w+x0, v=(g.a[i]*(1-fx)+g.a[i+1]*fx)*(1-fy)+(g.a[i+g.w]*(1-fx)+g.a[i+g.w+1]*fx)*fy;
    s+=v*0.125; if(Math.abs(q)>1&&v<base) base=v; }
  return s-base*2.6; }
function read(ln,G,C,segs){ const g=C.given(G), map=ln.map, pr=C.printed(G);
  /* все линии на листе, кроме самой стороны: печать (стороны, связи, ось) и найденные отрезки студента */
  const others=pr.filter(it=>it.t==='seg'||it.t==='conn').map(it=>[it.a,it.b]).concat((segs||ln.segs).map(s=>[s.a,s.b]));
  const crossT=(A,B)=>{ const L=L2.through(A,B), len=v2.dist(A,B), ts=[]; others.forEach(([a,b])=>{ if(v2.dist(a,A)+v2.dist(b,B)<0.5||v2.dist(a,B)+v2.dist(b,A)<0.5) return;
      const M=L2.through(a,b), X=L2.meet(L,M); if(!X||L2.angle(L,M)<3) return; const t=L2.t(X,L), u=L2.t(X,M); if(t<0||t>len||u<-0.5||u>v2.dist(a,b)+0.5) return; ts.push(t); }); return ts; };
  /* вес печати — по оси x (без пересечений), вес основной — по основным отрезкам студента */
  const ax=[]; const AX=pr.find(it=>it.role==='x'), cx=crossT(AX.a,AX.b); for(let t=1;t<v2.dist(AX.a,AX.b)-1;t+=0.5){ if(cx.some(c=>Math.abs(c-t)<1.5)) continue; const w=weightAt(map,v2.lerp(AX.a,AX.b,t/v2.dist(AX.a,AX.b)),[0,1]); if(w!=null) ax.push(w); }
  const med=a=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?s[Math.floor(s.length/2)]:null; };
  const wb=med(ax)||0.05, mains=(segs||ln.segs).filter(s=>s.k==='main'&&s.len>10).map(s=>s.weight), wm=Math.max(wb*2.2,med(mains)||wb*3);
  const sides={};
  C.SIDES.forEach(([a,b])=>['″','′'].forEach(m=>{ const A=g[a+m], B=g[b+m], len=v2.dist(A,B), n=v2.perp(v2.unit(v2.sub(B,A))), cr=crossT(A,B), out=[];
    for(let t=2;t<=len-2;t+=0.5){ if(cr.some(c=>Math.abs(c-t)<1.2)) continue; const w=weightAt(map,v2.lerp(A,B,t/len),n); if(w==null) continue; out.push({t:t/len,mm:t,w}); }
    sides[a+b+m]=out; }));
  /* порог «обведено»: между печатью (ось) и типичной обведённой стороной (80-й процентиль весов сторон) */
  const all=Object.values(sides).flat().map(x=>x.w).sort((x,y)=>x-y), q80=all.length?all[Math.floor(all.length*0.8)]:wb, th=wb+Math.max(0.035,0.4*(q80-wb));
  Object.values(sides).forEach(S=>S.forEach(x=>x.ink=x.w>th));
  return {sides,wb,wm,q80,th,contrast:(q80-wb)/Math.max(1e-3,wb)}; }
/* узор гипотезы против прочитанного: по каждому участку (без 1,5 мм у стыков) — доля «обведено» f;
   основная ждёт f ≈ 0,95, штриховая — f ≈ 0,65 и разрывы. Возвращает сумму лог-правдоподобий и худший участок */
/* все узоры оцениваются на одном разбиении (объединение стыков всех узоров) — иначе узор с крупными участками
   «размазывает» короткую штриховую и выигрывает нечестно */
function score(obs,pat,all){ let ll=0, worst=0, n=0, dis=0; const detail=[];
  Object.entries(pat).forEach(([k,seq0])=>{ const S=obs.sides[k]; if(!S) return; const len=S.length?S[S.length-1].mm/S[S.length-1].t:0;
    const cuts=[...new Set([0,1].concat(...(all||[pat]).map(P=>(P[k]||[]).map(x=>x[1]))).map(x=>+x.toFixed(4)))].sort((a,b)=>a-b);
    const kindAt=t=>(seq0.find(x=>t>=x[0]&&t<=x[1])||seq0[seq0.length-1])[2];
    const seq=[]; for(let i=0;i<cuts.length-1;i++) seq.push([cuts[i],cuts[i+1],kindAt((cuts[i]+cuts[i+1])/2)]);
    seq.forEach(([t0,t1,kind])=>{ const L=(t1-t0)*len; if(L<4) return; const pts=S.filter(x=>x.t*len>t0*len+1.5&&x.t*len<t1*len-1.5); if(pts.length<5) return;
      /* разрывы — по сглаженной последовательности (большинство из трёх): зерно графита не даёт ложных разрывов */
      const f=pts.filter(x=>x.ink).length/pts.length, sm=pts.map((x,i)=>{ const a=pts[Math.max(0,i-1)].ink, b=x.ink, c=pts[Math.min(pts.length-1,i+1)].ink; return (a+b+c)>=2; });
      let tr=0; for(let i=1;i<sm.length;i++) if(sm[i]!==sm[i-1]) tr++;
      /* доля обведённого и частота разрывов (на мм): основная — сплошная, штриховая — штрих 3…5 мм, пробел 1…2 мм */
      const span=(pts[pts.length-1].mm-pts[0].mm)||1, rate=tr/span;
      const cost=k2=>{ const zf=k2==='main'?(f-0.95)/0.08:(f-0.64)/0.14, zr=k2==='main'?rate/0.07:(rate-0.36)/0.14; return (Math.min(49,zf*zf)+Math.min(49,zr*zr))*Math.min(1,L/10); };
      /* короткий участок (< 10 мм) — меньше свидетельств: вес пропорционален длине. Участок, который сам по себе
         уверенно читается как другой тип (разница > 6), — несогласие: один перепутанный участок узор не спрячет */
      const c=cost(kind), alt=cost(kind==='main'?'hid':'main'); if(alt<c-6) dis++; ll-=c/2; n++; worst=Math.max(worst,c); detail.push({k,t0,t1,kind,f:+f.toFixed(2),rate:+rate.toFixed(2),c:+c.toFixed(1)}); }); });
  return {ll,worst,n,dis,detail}; }

put('visibility',{read,score});
})();
