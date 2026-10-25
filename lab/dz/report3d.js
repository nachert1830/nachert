/* ═══════════ ДЗ №3 г): разбор картинкой (SVG, мм чертежа) ═══════════
   Линии листа — серым; верное построение для начерченной пирамиды (h₁′ через верные 3′ и 4′, повёрнутая S̄₀,
   прямые S̄₀3′ и S̄₀4′) — зелёным; что взял студент (его 3′, 4′, h₁′, S̄′) — красным; панель шагов ✓ / ✗ / ?.
   svg({segs, data, ex, why, title}) → строка SVG */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const M3=isNode?require('./model3.js'):self.LAB.dzModel3, M=isNode?require('./model.js'):self.LAB.dzModel;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'), n1=x=>Math.round(x*100)/100;
const COL={good:'#2e9d4f',stud:'#c62828',ink:'#666'};
function svg(o){ const {segs,data,ex}=o, all=segs.flatMap(s=>[s.a,s.b]); const P=ex.pts||{};
  const u0=Math.min(...all.map(p=>p[0]))-6, u1=Math.max(...all.map(p=>p[0]))+6, v0=Math.min(...all.map(p=>p[1]))-6, v1=Math.max(...all.map(p=>p[1]))+6, W=u1-u0, PW=125, H=Math.max(v1-v0,200), out=[];
  out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+n1(u0)+' '+n1(v0)+' '+n1(W+PW)+' '+n1(H)+'" width="'+Math.round((W+PW)*4)+'" height="'+Math.round(H*4)+'" font-family="sans-serif">');
  out.push('<rect x="'+n1(u0)+'" y="'+n1(v0)+'" width="'+n1(W+PW)+'" height="'+n1(H)+'" fill="#fff"/>');
  const line=(a,b,st,w)=>out.push('<line x1="'+n1(a[0])+'" y1="'+n1(a[1])+'" x2="'+n1(b[0])+'" y2="'+n1(b[1])+'" stroke-width="'+w+'" '+st+'/>');
  const dot=(p,c,l,dx,dy)=>{ out.push('<circle cx="'+n1(p[0])+'" cy="'+n1(p[1])+'" r="1.4" fill="none" stroke="'+c+'" stroke-width="0.55"/>'); if(l) out.push('<text x="'+n1(p[0]+(dx||2))+'" y="'+n1(p[1]+(dy||-2))+'" font-size="3.4" fill="'+c+'">'+esc(l)+'</text>'); };
  segs.forEach(s=>line(s.a,s.b,'stroke="'+(s.k==='main'?'#777':'#aaa')+'"',s.k==='main'?0.4:0.25));
  line([u0,0],[u1,0],'stroke="#000"',0.25);
  /* верное построение от его h₁ (уровень c — его, начерченный) */
  const st1=ex.steps.find(s=>s.k==='h1f'); if(st1&&st1.val){ const c=st1.val.c, t=M3.sigma(data,c,true), t2=M3.sigma(data,c,false);
    if(t&&t2){ const ref=P.Sbar||t.S0, tt=Math.hypot(t.S0[0]-ref[0],t.S0[1]-ref[1])<=Math.hypot(t2.S0[0]-ref[0],t2.S0[1]-ref[1])?t:t2, X0=tt.X0, Y0=tt.Y0, e=[Y0[0]-X0[0],Y0[1]-X0[1]], l=Math.hypot(...e)||1;
      line([X0[0]-e[0]/l*10,X0[1]-e[1]/l*10],[Y0[0]+e[0]/l*10,Y0[1]+e[1]/l*10],'stroke="'+COL.good+'" stroke-dasharray="2 1"',0.6);
      line(tt.S0,X0,'stroke="'+COL.good+'"',0.6); line(tt.S0,Y0,'stroke="'+COL.good+'"',0.6);
      dot(X0,COL.good,'3′ верная',2,4); dot(Y0,COL.good,'4′',2,4); dot(tt.S0,COL.good,'S̄₀ верная',2,5); } }
  if(P.q3&&P.q4){ const e=[P.q4[0]-P.q3[0],P.q4[1]-P.q3[1]], l=Math.hypot(...e)||1; line([P.q3[0]-e[0]/l*10,P.q3[1]-e[1]/l*10],[P.q4[0]+e[0]/l*10,P.q4[1]+e[1]/l*10],'stroke="'+COL.stud+'"',0.6); dot(P.q3,COL.stud,'3′ студента',2,-2.5); dot(P.q4,COL.stud,'4′',-6,-2.5); }
  if(P.Sbar){ dot(P.Sbar,COL.stud,'S̄′ студента',2,-2.5); if(P.q3) line(P.Sbar,P.q3,'stroke="'+COL.stud+'" stroke-opacity="0.7"',0.45); if(P.q4) line(P.Sbar,P.q4,'stroke="'+COL.stud+'" stroke-opacity="0.7"',0.45); }
  if(P.p3F) dot(P.p3F,COL.ink,'3″'); if(P.p4F) dot(P.p4F,COL.ink,'4″');
  /* панель */
  const x0=u1+4; let y=v0+8; const tx=(s,sz,c,b)=>{ out.push('<text x="'+n1(x0)+'" y="'+n1(y)+'" font-size="'+sz+'" fill="'+(c||'#000')+'"'+(b?' font-weight="bold"':'')+'>'+esc(s)+'</text>'); y+=sz*1.35; };
  const wrap=(s,n)=>{ const w=String(s).split(' '), L=[]; let c=''; w.forEach(x=>{ if((c+' '+x).length>n){ L.push(c); c=x; } else c=c?c+' '+x:x; }); if(c) L.push(c); return L; };
  tx(o.title||'ДЗ №3 г) — угол SA с основанием',4.2,'#000',true); y+=1; (o.why||[]).forEach(w=>wrap(w,54).forEach(l=>tx(l,3,'#333'))); y+=3;
  ex.steps.forEach((s,i)=>{ const c=s.status==='ok'?COL.good:s.status==='bad'?COL.stud:'#888'; tx((s.status==='ok'?'✓':s.status==='bad'?'✗':'?')+' '+(i+1)+'. '+s.name,3.5,c,true); wrap(s.msg,56).forEach(l=>tx(l,3,'#333')); y+=1.5; });
  if(ex.first){ y+=2; tx('Первая ошибка — шаг '+(ex.steps.indexOf(ex.first)+1)+'. Дальше всё построено',3.4,COL.stud,true); tx('честно от неё — поэтому и угол другой.',3.4,COL.stud,true); }
  y+=4; [[COL.good,'верное построение для вашей пирамиды'],[COL.stud,'что взято у вас'],['#888','линии листа']].forEach(([c,l])=>{ out.push('<rect x="'+n1(x0)+'" y="'+n1(y-2.4)+'" width="5" height="2.4" fill="'+c+'"/>'); out.push('<text x="'+n1(x0+7)+'" y="'+n1(y)+'" font-size="3" fill="#333">'+esc(l)+'</text>'); y+=4; });
  out.push('</svg>'); return out.join('\n'); }
/* то же, что рисует svg, — примитивами в мм чертежа (для разбора поверх фото: страница переводит их в пиксели снимка)
   prims({data, truth, ex, claims, drawnPts}) → [{t:'line'|'dot', a, b | p, col:'good'|'stud', label, dash, g:'ex'|'data:A'}];
   claims — уверенные «нанесено неточно» (given.js): у точки — где начерчена (stud) и где должна быть (good) */
function prims(o){ const {data,ex}=o, P=(ex&&ex.pts)||{}, out=[]; let G='ex'; const L=(a,b,col,dash,label)=>out.push({t:'line',a,b,col,dash:!!dash,label,g:G}), D=(p,col,label)=>out.push({t:'dot',p,col,label,g:G});
  const st1=ex&&ex.steps&&ex.steps.find(s=>s.k==='h1f'); if(st1&&st1.val&&data){ const c=st1.val.c, t=M3.sigma(data,c,true), t2=M3.sigma(data,c,false);
    if(t&&t2){ const ref=P.Sbar||t.S0, tt=Math.hypot(t.S0[0]-ref[0],t.S0[1]-ref[1])<=Math.hypot(t2.S0[0]-ref[0],t2.S0[1]-ref[1])?t:t2;
      L(tt.X0,tt.Y0,'good',true); L(tt.S0,tt.X0,'good'); L(tt.S0,tt.Y0,'good'); D(tt.X0,'good','3′ верная'); D(tt.S0,'good','S̄₀ верная'); } }
  if(P.q3&&P.q4){ L(P.q3,P.q4,'stud'); D(P.q3,'stud','3′ у вас'); }
  if(P.Sbar){ D(P.Sbar,'stud','S̄′ у вас'); if(P.q3) L(P.Sbar,P.q3,'stud'); if(P.q4) L(P.Sbar,P.q4,'stud'); }
  (o.claims||[]).forEach(d=>{ const V=data&&o.truth?o.truth[d.n]:null; if(!V) return; const want={'″':[-V[0],-V[2]],'′':[-V[0],V[1]]}; G='data:'+d.n;
    ['″','′'].forEach(pr=>{ if(d.c==='y'&&pr==='″'||d.c==='z'&&pr==='′') return; const at=o.drawnPts&&o.drawnPts[d.n+pr]; if(!at) return; D(at,'stud',d.n+pr+' у вас'); D(want[pr],'good',d.n+pr+' по варианту'); L(at,want[pr],'stud',true); }); });
  return out; }
put('dzReport3d',{svg,prims});
})();
