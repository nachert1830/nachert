/* Окружности и дуги: притяжка (snapCircle) и поиск (findCircles) на синтетическом «карандаше»: бумага с шумом и тенью,
   кольца шириной ≈ 0,4 мм при 6 px/мм, дуги, бледная окружность, отрезки-помехи. Правда известна.
   node lab/dz/test-circles.js [--seed=1] */
'use strict';
const RF=require('./refine.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), SEED=+(A.seed||1);
let st=SEED*7919+13; const rnd=()=>{ st=(st*1664525+1013904223)>>>0; return st/4294967296; }, gauss=()=>{ let u=0; for(let i=0;i<6;i++) u+=rnd(); return (u-3)*1.4142; };
const W=1200, H=900, PPM=6;
function paper(){ const a=new Float32Array(W*H); for(let y=0;y<H;y++) for(let x=0;x<W;x++) a[y*W+x]=232-18*(x/W)*(y/H)+gauss()*2.2; return a; }
/* кольцо: радиус r, центр (cx,cy), дуга от a1 до a2 по часовой на экране (градусы), глубина dep, σ в px */
function ring(a,cx,cy,r,a1,a2,dep,sg){ sg=sg||1.1; const x0=Math.max(0,Math.floor(cx-r-6)), x1=Math.min(W-1,Math.ceil(cx+r+6)), y0=Math.max(0,Math.floor(cy-r-6)), y1=Math.min(H-1,Math.ceil(cy+r+6));
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ const dx=x-cx, dy=y-cy, d=Math.abs(Math.hypot(dx,dy)-r); if(d>4*sg) continue; let ang=Math.atan2(dy,dx)*180/Math.PI; ang=(ang+360)%360;
    if(a1!=null){ const s=(ang-a1+720)%360, L=(a2-a1+720)%360; if(s>L) continue; } a[y*W+x]-=dep*Math.exp(-0.5*(d/sg)*(d/sg)); } }
function line(a,x1,y1,x2,y2,dep,sg){ sg=sg||1.1; const L=Math.hypot(x2-x1,y2-y1), n=Math.ceil(L*2); for(let i=0;i<=n;i++){ const t=i/n, x=x1+(x2-x1)*t, y=y1+(y2-y1)*t; for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++){ const X=Math.round(x)+dx, Y=Math.round(y)+dy; if(X<0||Y<0||X>=W||Y>=H) continue; const d=Math.hypot(X-x,Y-y); a[Y*W+X]-=dep*Math.exp(-0.5*(d/sg)*(d/sg))/Math.max(1,n/12); } } }
let fail=0; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fail++; };

/* 1. притяжка: полная окружность, модель ошиблась на 8 px по x, 6 по y и на 7 px по радиусу */
{ const a=paper(); ring(a,600,450,240,null,null,60); line(a,100,100,1100,160,50); const D=RF.darkness({w:W,h:H,a},{ppm:PPM}), r=RF.snapCircle(D,{cx:608,cy:444,r:247},{ppm:PPM,radius:2});
  console.log('притяжка полной окружности (правда 600,450 r=240):'); ok(Math.hypot(r.cx-600,r.cy-450)<0.7&&Math.abs(r.r-240)<0.7,'центр ('+r.cx.toFixed(1)+', '+r.cy.toFixed(1)+'), r '+r.r.toFixed(1)+' — ошибка '+Math.hypot(r.cx-600,r.cy-450).toFixed(2)+' / '+Math.abs(r.r-240).toFixed(2)+' px'); ok(r.full&&r.ink>0.9,'полная окружность, чернил '+Math.round(r.ink*100)+' %'); }
/* 2. дуга 20°→220°, модель дала 10°→235° */
{ const a=paper(); ring(a,500,400,180,20,220,60); const D=RF.darkness({w:W,h:H,a},{ppm:PPM}), r=RF.snapCircle(D,{cx:503,cy:397,r:183,a1:10,a2:235},{ppm:PPM,radius:2});
  console.log('притяжка дуги 20°→220° (модель 10°→235°):'); ok(Math.hypot(r.cx-500,r.cy-400)<0.8&&Math.abs(r.r-180)<0.8,'центр и радиус: ошибка '+Math.hypot(r.cx-500,r.cy-400).toFixed(2)+' / '+Math.abs(r.r-180).toFixed(2)+' px');
  const da=Math.abs(((r.a1-20+540)%360)-180), db=Math.abs(((r.a2-220+540)%360)-180); ok(!r.full&&da<=8&&db<=8,'углы '+r.a1.toFixed(0)+'°→'+r.a2.toFixed(0)+'° (правда 20°→220°)'); }
/* 3. бледная окружность */
{ const a=paper(); ring(a,400,300,100,null,null,16); const D=RF.darkness({w:W,h:H,a},{ppm:PPM}), r=RF.snapCircle(D,{cx:405,cy:296,r:104},{ppm:PPM,radius:2});
  console.log('бледная окружность (контраст 16 из 255):'); ok(Math.hypot(r.cx-400,r.cy-300)<1&&Math.abs(r.r-100)<1&&r.ink>0.6,'ошибка '+Math.hypot(r.cx-400,r.cy-300).toFixed(2)+' / '+Math.abs(r.r-100).toFixed(2)+' px, чернил '+Math.round(r.ink*100)+' %'); }
/* 4. окружности нет — модель выдумала */
{ const a=paper(); line(a,100,100,1100,160,50); const D=RF.darkness({w:W,h:H,a},{ppm:PPM}), r=RF.snapCircle(D,{cx:600,cy:450,r:200},{ppm:PPM,radius:2});
  console.log('выдуманная окружность на пустой бумаге:'); ok(r.ink<0.3,'чернил '+Math.round(r.ink*100)+' % (порог отбрасывания 30 %)'); }
/* 5. поиск: три фигуры + отрезки-помехи + «текст» */
{ const a=paper(); ring(a,420,330,200,null,null,60); ring(a,880,560,110,300,80,55); ring(a,300,700,45,null,null,50);
  [[50,820,1150,830],[100,50,1100,80],[700,100,700,800],[200,200,900,860]].forEach(l=>line(a,l[0],l[1],l[2],l[3],45)); for(let i=0;i<40;i++){ const x=rnd()*W, y=rnd()*H; line(a,x,y,x+rnd()*14,y+rnd()*14,40); }
  const D=RF.darkness({w:W,h:H,a},{ppm:PPM}), f=RF.findCircles(D,null,{ppm:PPM,maxFind:8}), truth=[[420,330,200,true],[880,560,110,false],[300,700,45,true]];
  console.log('поиск среди помех (найдено '+f.length+'):'); truth.forEach(([cx,cy,r,full])=>{ const m=f.find(c=>Math.hypot(c.cx-cx,c.cy-cy)<3&&Math.abs(c.r-r)<3); ok(!!m,'r='+r+(full?' (полная)':' (дуга 300°→80°)')+(m?': найдена, ошибка '+Math.hypot(m.cx-cx,m.cy-cy).toFixed(2)+' / '+Math.abs(m.r-r).toFixed(2)+' px'+(m.full?', полная':', дуга '+m.a1.toFixed(0)+'°→'+m.a2.toFixed(0)+'°'):': НЕ найдена')); });
  const extra=f.filter(c=>!truth.some(([cx,cy,r])=>Math.hypot(c.cx-cx,c.cy-cy)<3&&Math.abs(c.r-r)<3)); ok(extra.length===0,'лишних окружностей: '+extra.length+extra.map(c=>' ['+c.cx.toFixed(0)+','+c.cy.toFixed(0)+' r='+c.r.toFixed(0)+' '+(c.full?'полная':c.a1.toFixed(0)+'°→'+c.a2.toFixed(0)+'°')+' чернил '+Math.round(c.ink*100)+'%]').join('')); }
/* 6. без окружностей: только отрезки и шум — ничего не должно находиться */
{ const a=paper(); [[50,820,1150,830],[100,50,1100,80],[700,100,700,800],[200,200,900,860],[100,600,1100,300]].forEach(l=>line(a,l[0],l[1],l[2],l[3],45)); for(let i=0;i<60;i++){ const x=rnd()*W, y=rnd()*H; line(a,x,y,x+rnd()*16,y+rnd()*16,40); }
  const D=RF.darkness({w:W,h:H,a},{ppm:PPM}), f=RF.findCircles(D,null,{ppm:PPM,maxFind:8}); console.log('лист без окружностей:'); ok(f.length===0,'ложных окружностей: '+f.length+f.map(c=>' ['+c.cx.toFixed(0)+','+c.cy.toFixed(0)+' r='+c.r.toFixed(0)+' '+(c.full?'полная':c.a1.toFixed(0)+'°→'+c.a2.toFixed(0)+'°')+']').join('')); }
process.exit(fail?1:0);
