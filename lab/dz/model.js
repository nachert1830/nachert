/* ═══════════ ДЗ: что должно быть на листе — заданное и ответ (мм чертежа от O) ═══════════
   Чертёж: u вправо, v вниз от O; фронтальная проекция P″ = (−x, −z), горизонтальная P′ = (−x, y).
   given(id, data)   — заданное по условию: точки обеих проекций, отрезки фигуры условия (ABC, EF, BC, AK; у ДЗ №3 —
                       рёбра пирамиды), линии связи. Это начертит каждый студент своего варианта — по нему калибровка.
   solid(id, sol)    — тело ответа: вершины, рёбра, грани; видимость каждого ребра на π₂ и π₁ (по 3D: ребро видно,
                       если видна хоть одна из двух его граней; зритель π₂ — со стороны +y, π₁ — сверху, +z).
                       Почти ребром к зрителю (|n·взгляд| < 0,02) — видимость «не определена», её не проверяем.
   items(...)        — то же в формате сцен сайта ({t:'seg',a,b,k}, {t:'pt',at,l}) для синтетических листов. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const DZ=isNode?require('../../core/dz.js'):self.CORE.dz, {v3}=DZ;
const Fp=P=>[-P[0],-P[2]], Hp=P=>[-P[0],P[1]];
/* заданные отрезки по задаче: фигура условия */
const GIVEN_SEGS={'2':[['A','B'],['B','C'],['C','A'],['E','F']],'2b':[['B','C'],['E','F']],'2c':[['A','K'],['E','F']],'3':[['A','B'],['B','C'],['C','A'],['S','A'],['S','B'],['S','C']]};
function given(id,data){ const pts=[], segs=[];
  Object.entries(data).forEach(([n,P])=>{ pts.push({n,pr:'f',l:n+'″',at:Fp(P),P},{n,pr:'h',l:n+'′',at:Hp(P),P}); });
  (GIVEN_SEGS[id]||[]).forEach(([a,b])=>{ segs.push({a:Fp(data[a]),b:Fp(data[b]),pr:'f',n:a+b},{a:Hp(data[a]),b:Hp(data[b]),pr:'h',n:a+b}); });
  /* линии связи: от фронтальной проекции до горизонтальной (студент их чертит тонко) */
  const conn=Object.entries(data).map(([n,P])=>({a:Fp(P),b:Hp(P),n}));
  return {pts,segs,conn}; }
/* тела ответа: вершины и грани (обход любой, нормаль ориентируется наружу по центру тела) */
function solid(id,sol,data){ let V, faces;
  if(id==='2'){ V={S:sol.S,A:data.A,B:data.B,C:data.C}; faces=[['A','B','C'],['S','A','B'],['S','B','C'],['S','C','A']]; }
  else if(id==='2b'){ V={A:sol.A,B:data.B,C:data.C,'A₁':sol.A1,'B₁':sol.B1,'C₁':sol.C1}; faces=[['A','B','C'],['A₁','B₁','C₁'],['A','B','B₁','A₁'],['B','C','C₁','B₁'],['C','A','A₁','C₁']]; }
  else if(id==='2c'){ V={A:data.A,B:sol.B,C:sol.C,D:sol.D,'A₁':sol.A1,'B₁':sol.B1,'C₁':sol.C1,'D₁':sol.D1}; faces=[['A','B','C','D'],['A₁','B₁','C₁','D₁'],['A','B','B₁','A₁'],['B','C','C₁','B₁'],['C','D','D₁','C₁'],['D','A','A₁','D₁']]; }
  else if(id==='3'){ V={S:data.S,A:data.A,B:data.B,C:data.C}; faces=[['A','B','C'],['S','A','B'],['S','B','C'],['S','C','A']]; }
  else return null;
  const names=Object.keys(V), c=v3.mul(names.reduce((s,k)=>v3.add(s,V[k]),[0,0,0]),1/names.length);
  const F=faces.map(f=>{ const P=f.map(k=>V[k]); let n=v3.unit(v3.cross(v3.sub(P[1],P[0]),v3.sub(P[2],P[0]))); const m=v3.mul(P.reduce((s,p)=>v3.add(s,p),[0,0,0]),1/P.length); if(v3.dot(n,v3.sub(m,c))<0) n=v3.mul(n,-1); return {f,n}; });
  const E=new Map(); F.forEach((fc,i)=>fc.f.forEach((a,k)=>{ const b=fc.f[(k+1)%fc.f.length], key=[a,b].sort().join('|'); if(!E.has(key)) E.set(key,{a,b,faces:[]}); E.get(key).faces.push(i); }));
  /* видимость: f — зритель с +y (π₂), h — сверху, +z (π₁) */
  const vis=(e,ax)=>{ const s=e.faces.map(i=>F[i].n[ax]); if(s.some(x=>x>0.02)) return 'vis'; if(s.every(x=>x<-0.02)) return 'hid'; return '?'; };
  const edges=[...E.values()].map(e=>Object.assign(e,{f:vis(e,1),h:vis(e,2)}));
  return {V,faces:F,edges}; }
/* сцена (формат сайта): заданное + тело ответа с видимостью */
function items(id,data,sol,o){ o=o||{}; const out=[], g=given(id,data);
  g.pts.forEach(p=>out.push({t:'pt',at:p.at,l:p.l}));
  if(o.conn!==false) g.conn.forEach(c=>out.push({t:'conn',a:c.a,b:c.b}));
  if(sol){ const S=solid(id,sol,data);
    S.edges.forEach(e=>{ const A=S.V[e.a], B=S.V[e.b]; [['f',Fp],['h',Hp]].forEach(([pr,P])=>out.push({t:'seg',a:P(A),b:P(B),k:e[pr]==='hid'?'resd':'res',edge:e.a+e.b,pr})); });
    Object.entries(S.V).forEach(([n,P])=>{ if(data[n]) return; out.push({t:'pt',at:Fp(P),l:n+'″'},{t:'pt',at:Hp(P),l:n+'′'}); if(o.conn!==false) out.push({t:'conn',a:Fp(P),b:Hp(P)}); }); }
  /* фигура условия, которой нет среди рёбер тела (EF, AK) — основной */
  const have=new Set(out.filter(it=>it.edge).map(it=>it.edge.split('').sort().join('')));
  g.segs.forEach(s=>{ if(id==='3') return; if(sol&&have.has(s.n.split('').sort().join(''))) return; out.push({t:'seg',a:s.a,b:s.b,k:'main'}); });
  return out; }
put('dzModel',{given,solid,items,Fp,Hp,GIVEN_SEGS});
})();
