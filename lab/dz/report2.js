/* ═══════════ ДЗ №2а: разбор листа картинкой (SVG) ═══════════
   Что начертил студент (линии листа в мм чертежа, после калибровки) — серым; условие — чёрным; верная пирамида —
   зелёной полосой; точки построения студента (P, R, след, S) и верная S — кружками с подписями; справа — шаги
   разбора с отметками ✓ / ✗ / ? и увеличенный кусок листа у вершины S (там, где обычно ошибка видна в миллиметрах).
   Масштаб чертежа 1:1 в мм: картинку можно мерить.
   svg({data, segs, cur, ex, verdict, why}) → строка SVG */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const DZ=isNode?require('../../core/dz.js'):self.CORE.dz, M=isNode?require('./model.js'):self.LAB.dzModel;
const Fp=P=>[-P[0],-P[2]], Hp=P=>[-P[0],P[1]];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const n1=x=>(Math.round(x*100)/100), f1=x=>(Math.round(x*10)/10).toString().replace('.',',');
const COL={good:'#2e9d4f',stud:'#c62828',R:'#d07a00',tr:'#1565c0',P:'#7a3db8'};
/* сцена: k — увеличение (толщины и шрифт делятся на k, чтобы в увеличенном куске выглядели так же) */
function scene(o,k,labels){ const {data,segs,cur,ex}=o, r=DZ.solve('2',data), good=r.ok&&(r.sol.find(s=>s.inSeg)||r.sol[0]), out=[], P=ex&&ex.pts||{};
  const line=(a,b,st,w)=>out.push('<line x1="'+n1(a[0])+'" y1="'+n1(a[1])+'" x2="'+n1(b[0])+'" y2="'+n1(b[1])+'" stroke-width="'+n1(w/k)+'" '+st+'/>');
  const dot=(p,c,l,dy)=>{ out.push('<circle cx="'+n1(p[0])+'" cy="'+n1(p[1])+'" r="'+n1(1.3/k)+'" fill="none" stroke="'+c+'" stroke-width="'+n1(0.5/k)+'"/>');
    if(l&&labels) out.push('<text x="'+n1(p[0]+2/k)+'" y="'+n1(p[1]+(dy||-2)/k)+'" font-size="'+n1(3.2/k)+'" fill="'+c+'">'+esc(l)+'</text>'); };
  line([-400,0],[400,0],'stroke="#000"',0.25);
  if(good) ['A','B','C'].forEach(v=>{ [Fp,Hp].forEach(pr=>line(pr(good.S),pr(data[v]),'stroke="'+COL.good+'" stroke-opacity="0.35" stroke-linecap="round"',2.2)); });
  segs.forEach(s=>line(s.a,s.b,'stroke="'+(s.k==='main'?'#555':'#999')+'"'+(s.k==='dash'||s.k==='hid'?' stroke-dasharray="'+n1(1.5/k)+' '+n1(1/k)+'"':''),s.k==='main'?0.45:0.25));
  M.given('2',data).segs.forEach(s=>line(s.a,s.b,'stroke="#000" stroke-opacity="0.6"',0.35));
  if(P.P){ dot(Fp(P.P),COL.P,'P″'); dot(Hp(P.P),COL.P,'P′'); }
  if(P.RF){ dot(P.RF,COL.R,'R″'); dot(P.RH,COL.R,'R′'); }
  if(P.SR) dot(Fp(P.SR),COL.tr,'по R',5);
  if(P.trace) dot(P.trace,COL.tr,'след',-4);
  if(cur&&cur.S){ dot(Fp(cur.S),COL.stud,'S″ студента',-3); dot(Hp(cur.S),COL.stud,'S′ студента',5); }
  if(good){ dot(Fp(good.S),COL.good,'верная S″',9); dot(Hp(good.S),COL.good,'верная S′',-3); }
  return {out,good,P}; }
function svg(o){ const {data,segs,cur,ex}=o;
  const all=segs.flatMap(s=>[s.a,s.b]).concat(M.given('2',data).segs.flatMap(s=>[s.a,s.b]));
  const u0=Math.min(...all.map(p=>p[0]))-8, u1=Math.max(...all.map(p=>p[0]))+8, v0=Math.min(...all.map(p=>p[1]))-8, v1=Math.max(...all.map(p=>p[1]))+8;
  const W=u1-u0, PW=120, H=Math.max(v1-v0,250), out=[];
  out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+n1(u0)+' '+n1(v0)+' '+n1(W+PW)+' '+n1(H)+'" width="'+Math.round((W+PW)*4)+'" height="'+Math.round(H*4)+'" font-family="sans-serif">');
  out.push('<rect x="'+n1(u0)+'" y="'+n1(v0)+'" width="'+n1(W+PW)+'" height="'+n1(H)+'" fill="#fff"/>');
  out.push('<svg x="'+n1(u0)+'" y="'+n1(v0)+'" width="'+n1(W)+'" height="'+n1(v1-v0)+'" viewBox="'+n1(u0)+' '+n1(v0)+' '+n1(W)+' '+n1(v1-v0)+'">');
  const sc=scene(o,1,true); out.push(...sc.out); out.push('</svg>');
  /* панель шагов */
  const x0=u1+4; let y=v0+8; const tx=(s,sz,c,w)=>{ out.push('<text x="'+n1(x0)+'" y="'+n1(y)+'" font-size="'+sz+'" fill="'+(c||'#000')+'"'+(w?' font-weight="bold"':'')+'>'+esc(s)+'</text>'); y+=sz*1.35; };
  const wrap=(s,n)=>{ const w=String(s).split(' '), L=[]; let c=''; w.forEach(x=>{ if((c+' '+x).length>n){ L.push(c); c=x; } else c=c?c+' '+x:x; }); if(c) L.push(c); return L; };
  tx('ДЗ №2а — разбор листа',4.4,'#000',true);
  if(o.verdict){ tx('Вердикт: '+o.verdict,3.8,o.verdict==='верно'?COL.good:o.verdict==='ошибка'?COL.stud:'#555',true); (o.why||[]).forEach(w=>wrap(w,50).forEach(l=>tx(l,3.1,'#333'))); } y+=3;
  (ex?ex.steps:[]).forEach((s,i)=>{ const c=s.status==='ok'?COL.good:s.status==='bad'?COL.stud:'#888', m=s.status==='ok'?'✓':s.status==='bad'?'✗':'?';
    tx(m+' '+(i+1)+'. '+s.name,3.5,c,true); wrap(s.msg,52).forEach(l=>tx(l,3,'#333')); y+=1.5; });
  if(ex&&ex.first){ y+=2; tx('Первая ошибка — шаг '+(ex.steps.indexOf(ex.first)+1)+' («'+ex.first.name+'»).',3.4,COL.stud,true); if(ex.steps.indexOf(ex.first)>0) tx('Всё, что до него, построено верно.',3.4,COL.stud); }
  /* увеличенный кусок у S″: верная S, точка по R студента, след, S студента — в миллиметрах */
  const key=[sc.P.trace,sc.P.SR&&Fp(sc.P.SR),cur&&cur.S&&Fp(cur.S),sc.good&&Fp(sc.good.S)].filter(Boolean);
  if(key.length){ const w=PW-8, h=w*0.7, bx=[Math.min(...key.map(p=>p[0])),Math.max(...key.map(p=>p[0]))], by=[Math.min(...key.map(p=>p[1])),Math.max(...key.map(p=>p[1]))];
    /* увеличение — чтобы все ключевые точки (верная S, S студента, след, точка по R) попали в окно */
    const K=Math.max(1,Math.min(5,Math.floor(Math.min(0.75*w/Math.max(1e-6,bx[1]-bx[0]),0.75*h/Math.max(1e-6,by[1]-by[0]))))), cx=(bx[0]+bx[1])/2, cy=(by[0]+by[1])/2, vw=w/K, vh=h/K; y+=5;
    tx('У вершины S″, увеличено ×'+K+' (клетка — 1 мм):',3.2,'#000',true); const yy=y-1;
    out.push('<rect x="'+n1(x0)+'" y="'+n1(yy)+'" width="'+n1(w)+'" height="'+n1(h)+'" fill="#fff" stroke="#000" stroke-width="0.3"/>');
    out.push('<svg x="'+n1(x0)+'" y="'+n1(yy)+'" width="'+n1(w)+'" height="'+n1(h)+'" viewBox="'+n1(cx-vw/2)+' '+n1(cy-vh/2)+' '+n1(vw)+' '+n1(vh)+'">');
    for(let gx=Math.ceil(cx-vw/2);gx<=cx+vw/2;gx++) out.push('<line x1="'+gx+'" y1="'+n1(cy-vh/2)+'" x2="'+gx+'" y2="'+n1(cy+vh/2)+'" stroke="#e3e8f0" stroke-width="0.04"/>');
    for(let gy=Math.ceil(cy-vh/2);gy<=cy+vh/2;gy++) out.push('<line x1="'+n1(cx-vw/2)+'" y1="'+gy+'" x2="'+n1(cx+vw/2)+'" y2="'+gy+'" stroke="#e3e8f0" stroke-width="0.04"/>');
    out.push(...scene(o,K,true).out); out.push('</svg>'); y=yy+h+5; }
  [[COL.good,'верная пирамида и верная S'],['#555','линии листа (основные)'],['#999','линии листа (тонкие)'],[COL.stud,'вершина S студента'],[COL.R,'точка R студента'],[COL.tr,'след β; точка EF на высоте R студента'],[COL.P,'основание перпендикуляра P']].forEach(([c,l])=>{ out.push('<rect x="'+n1(x0)+'" y="'+n1(y-2.4)+'" width="5" height="2.4" fill="'+c+'" fill-opacity="0.7"/>'); out.push('<text x="'+n1(x0+7)+'" y="'+n1(y)+'" font-size="3" fill="#333">'+esc(l)+'</text>'); y+=4; });
  out.push('</svg>'); return out.join('\n'); }
put('dzReport2',{svg});
})();
