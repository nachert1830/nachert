/* ═══════════ Отпечаток построения: та же это работа или нет (для преподавателя) ═══════════
   Студенты одного варианта обязаны начертить одно и то же заданное — его из сравнения исключаем (рёбра условия,
   линии связи его точек, оси). Остальное — свобода руки: на какой высоте взята горизонталь, куда проведена новая
   ось, как далеко продолжено ребро, где кончается каждая линия. Это и есть почерк. Списанная (или купленная и
   перерисованная) работа совпадает именно в свободном; две независимые — только в вынужденном.
   Координаты — мм от O эпюра (не от края листа и не от кадра): одну работу можно снять как угодно.
   print(r, id) по результату gridsheet.js → {ink:[[u,v]] — графит построений через 1 мм, ends:[[u,v]] — концы линий, n}
   compare(A, B) → {ink, ends, score, n, verdict}: доля совпавшего графита (≤ 0,6 мм) и концов (≤ 1 мм), среднее двух направлений (блик в одном кадре прячет часть линий) */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const M=isNode?require('./model.js'):self.LAB.dzModel;
const dseg=(p,a,b)=>{ const d=[b[0]-a[0],b[1]-a[1]], l2=d[0]*d[0]+d[1]*d[1]||1e-9, t=Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/l2)); return Math.hypot(a[0]+d[0]*t-p[0],a[1]+d[1]*t-p[1]); };
function print(r,id){ if(!r||!r.ok||!r.given||!r.dig) return null; const O=r.given.O, D=r.given.drawn;
  if(!Object.values(D).every(p=>p.every(v=>v!=null))) return null;
  const g=M.given(id||'3',D), forced=g.segs.map(s=>[s.a,s.b]).concat(g.conn?g.conn.map(c=>[c.a,c.b]):[]);
  const isForced=p=>Math.abs(p[0])<0.6||Math.abs(p[1])<0.6||forced.some(([a,b])=>dseg(p,a,b)<0.6);
  /* только область чертежа: заданное + 35 мм (край бумаги на фоне стола, края тени, соседние задачи — не почерк) */
  const P=g.pts.map(q=>q.at), u0=Math.min(...P.map(p=>p[0]))-35, u1=Math.max(...P.map(p=>p[0]))+35, v0=Math.min(...P.map(p=>p[1]))-35, v1=Math.max(...P.map(p=>p[1]))+35;
  const inside=p=>p[0]>=u0&&p[0]<=u1&&p[1]>=v0&&p[1]<=v1;
  const ink=[], ends=[];
  /* остатки сетки — не почерк: короткие отрезки (крестики узлов: стирание бережёт пересечения) и отрезки точно по
     линии сетки (кратно клетке в координатах листа). Свободную линию, проведённую по клетке, так тоже теряем —
     отпечаток становится беднее, но не ложнее */
  const cell=r.grid&&r.grid.cell||5, onGrid=s=>{ const dx=Math.abs(s.b[0]-s.a[0]), dy=Math.abs(s.b[1]-s.a[1]), m=(x,k)=>Math.abs(x/k-Math.round(x/k))*k;
    return dx<0.02*dy&&m((s.a[0]+s.b[0])/2,cell)<0.5||dy<0.02*dx&&m((s.a[1]+s.b[1])/2,cell)<0.5; };
  /* край бумаги на фоне стола и край тени — не линия чертежа: по одну сторону заметно темнее, чем по другую */
  const sc=r.scan, lum=p=>{ if(!sc) return null; const x=Math.round((p[0]-sc.box[0])*sc.ppm), y=Math.round((p[1]-sc.box[1])*sc.ppm), im=sc.img;
    if(x<0||y<0||x>=im.width||y>=im.height) return 0; const i=(y*im.width+x)*4; return (im.data[i]+im.data[i+1]+im.data[i+2])/765; };
  const isEdge=s=>{ if(!sc) return false; const d=[s.b[0]-s.a[0],s.b[1]-s.a[1]], l=Math.hypot(...d)||1, n=[-d[1]/l,d[0]/l]; let k=0;
    for(const t of [0.2,0.5,0.8]){ const c=[s.a[0]+d[0]*t,s.a[1]+d[1]*t], L1=lum([c[0]+n[0]*2.5,c[1]+n[1]*2.5]), L2=lum([c[0]-n[0]*2.5,c[1]-n[1]*2.5]); if(L1!=null&&L2!=null&&Math.min(L1,L2)<0.75*Math.max(L1,L2)) k++; }
    return k>=2; };
  r.dig.segs.forEach(s=>{ const a=[s.a[0]-O[0],s.a[1]-O[1]], b=[s.b[0]-O[0],s.b[1]-O[1]], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<6||r.grid&&onGrid(s)||isEdge(s)) return;
    for(let t=0;t<=L;t+=1){ const p=[a[0]+(b[0]-a[0])*t/L,a[1]+(b[1]-a[1])*t/L]; if(inside(p)&&!isForced(p)) ink.push(p); }
    [a,b].forEach(p=>{ if(inside(p)&&!isForced(p)) ends.push(p); }); });
  return {ink,ends,n:ink.length}; }
/* доля точек P, у которых в Q есть сосед ближе tol (сетка-хэш) */
function hit(P,Q,tol){ if(!P.length||!Q.length) return 0; const h=new Map(), key=(i,j)=>i+','+j;
  Q.forEach(q=>{ const k=key(Math.floor(q[0]/tol),Math.floor(q[1]/tol)); (h.get(k)||h.set(k,[]).get(k)).push(q); });
  let n=0; P.forEach(p=>{ const i=Math.floor(p[0]/tol), j=Math.floor(p[1]/tol); let ok=false;
    for(let di=-1;di<=1&&!ok;di++) for(let dj=-1;dj<=1&&!ok;dj++){ const c=h.get(key(i+di,j+dj)); if(c&&c.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<=tol)) ok=true; }
    if(ok) n++; }); return n/P.length; }
/* утверждение одно — «похоже на одну работу, проверьте» (сходство ≥ 0,6). Вредная ошибка — обвинить двух
   честных студентов; пропустить копию — промах, не ложь. Поэтому ниже порога — «совпадения не найдено», а не
   «работы независимы». Порог — по синтетике (test-fingerprint.js): независимые работы того же варианта ≤ 0,40 */
function compare(A,B){ if(!A||!B) return {score:null,verdict:'не сравнить'}; const n=Math.min(A.n,B.n);
  const ink=(hit(A.ink,B.ink,0.6)+hit(B.ink,A.ink,0.6))/2, ends=(hit(A.ends,B.ends,1)+hit(B.ends,A.ends,1))/2, score=(ink+ends)/2;
  const verdict=n<60?'мало свободных линий — не сравнить':score>=0.6?'свободные построения почти совпадают — похоже на одну работу, проверьте':'совпадения не найдено';
  return {ink,ends,score,n,verdict}; }
/* отпечаток серии кадров: графит, который видят ≥ 2 кадра (блик в одном кадре прячет линии, мусор одного кадра не
   повторяется), объединение по кадрам — что видно хоть где-то с подтверждением */
function merge(prints){ const P=prints.filter(Boolean); if(P.length<2) return P[0]||null; const keep=(get)=>{ const out=[]; P.forEach((A,i)=>get(A).forEach(p=>{ const others=P.filter((_,j)=>j!==i);
    if(others.some(B=>hit([p],get(B),0.6)>0)&&!hit([p],out,0.5)) out.push(p); })); return out; };
  const ink=keep(A=>A.ink), ends=keep(A=>A.ends); return {ink,ends,n:ink.length,frames:P.length}; }
put('dzFingerprint',{print,compare,merge,hit});
})();
