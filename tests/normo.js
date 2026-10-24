/* ═══════════ Нормоконтроль листов инженерной графики ═══════════
   Проверяет ГОТОВЫЙ лист — SVG, который видит студент, — а не код, который его нарисовал. Лист разбирается на примитивы
   в миллиметрах листа: вложенные изображения видов разворачиваются в общие координаты, у каждой линии — настоящая толщина,
   штрихи и промежутки, у каждой надписи — габарит самих букв. Тип линии определяется по её виду (толщина, штрихи), смысл —
   по геометрии (стрелки, числа, буквы), без подсказок генератора: так ловится и то, что генератор считает верным.

   NORMO.check(svg, opt) → {k, fmt, views, issues:[{rule, gost, msg, at:[x,y] мм листа, sev}]}
   opt.model — 3D-модель детали (IG_VARS[n]): тогда каждый вид сверяется с деталью лучами (линии, видимость, штриховка).
   opt.draft — черновик: цветные построения, рамка без формата; правила оформления листа не применяются.
   Числа и пункты — из реестра норм сайта (window.ESKD в index.html): тот же реестр, из которого генератор строит лист.
   Правила с кодом «МУ» — правила методических указаний кафедры, а не пункты ГОСТ (так и пишется в замечании).
   Правила (ГОСТ ЕСКД):
     2.301  формат листа, всё внутри рамки
     Р 2.104 рамка 20/5 мм, основная надпись 185 × 55 в правом нижнем углу, на ней ничего лишнего
     2.302  масштаб 1:1 — размерные числа равны длинам на листе
     2.303  одна толщина основной линии s = 0,5…1,4 и одна толщина у линий каждого типа; тонкие s/3…s/2; штриховая 2…8 / 1…2;
            штрихпунктирная 5…30, промежуток 3…5 (весь разрыв с точкой), начинается и кончается штрихом, пересекается штрихами;
            разомкнутая s…1,5s, 8…20 мм; центровые окружностей меньше 12 мм — сплошные тонкие
     2.304  размер шрифта — из ряда (1,8); 2,5; 3,5; 5; 7 …
     2.316  буквы обозначений ≈ вдвое крупнее размерных чисел
     МУ     (методические указания, не ГОСТ): осевая выходит за контур на 2…5 мм; шрифт ≥ 2,5, размерные числа ≥ 3,5;
            половина разреза справа от оси / снизу; на половине вида без невидимого контура; ребро на оси — волнистая граница
     2.305  проекционная связь видов (ширина, высота, глубина); обозначения разрезов: буква у каждого штриха, надпись «Б–Б»,
            без Й О Х Ъ Ы Ь
     2.306  штриховка: один шаг 1…10 мм и один наклон на всём листе, 45° (30°/60°, если 45° совпадает с контуром)
     2.307  размерные числа не пересекаются линиями и штриховкой, стрелки одного размера, размерная линия ≥ 10 мм от контура
            и ≥ 7 мм от параллельной, выносные выходят за концы стрелок на 1…5 мм
     модель: линии вида совпадают с рёбрами и очерками детали, невидимое — штриховой там, где её проводят,
            штриховка — ровно там, где секущая плоскость прошла по материалу */
(function(){
const NS='http://www.w3.org/2000/svg';
const R=(v,d)=>Math.round(v*Math.pow(10,d||1))/Math.pow(10,d||1), num=v=>String(v).replace('.',',');
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function segDist(p,a,b){ const ax=b[0]-a[0], ay=b[1]-a[1], l2=ax*ax+ay*ay||1e-12, t=Math.max(0,Math.min(1,((p[0]-a[0])*ax+(p[1]-a[1])*ay)/l2)); return Math.hypot(a[0]+ax*t-p[0],a[1]+ay*t-p[1]); }
function segX(a,b,c,d){ const r=[b[0]-a[0],b[1]-a[1]], s=[d[0]-c[0],d[1]-c[1]], den=r[0]*s[1]-r[1]*s[0]; if(Math.abs(den)<1e-12) return null;
  const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den, u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den; return t>=0&&t<=1&&u>=0&&u<=1?{t,u,p:[a[0]+r[0]*t,a[1]+r[1]*t]}:null; }
const inPoly=(p,P)=>{ let c=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ if((P[i][1]>p[1])!==(P[j][1]>p[1])&&p[0]<(P[j][0]-P[i][0])*(p[1]-P[i][1])/(P[j][1]-P[i][1])+P[i][0]) c=!c; } return c; };
function segPoly(a,b,P){ if(inPoly(a,P)||inPoly(b,P)) return true; for(let i=0;i<P.length;i++) if(segX(a,b,P[i],P[(i+1)%P.length])) return true; return false; }
const polyX=(P,Q)=>P.some(p=>inPoly(p,Q))||Q.some(q=>inPoly(q,P))||P.some((p,i)=>Q.some((q,j)=>segX(p,P[(i+1)%P.length],q,Q[(j+1)%Q.length])));
const shrink=(P,d)=>{ const c=[P.reduce((s,p)=>s+p[0],0)/P.length,P.reduce((s,p)=>s+p[1],0)/P.length]; return P.map(p=>{ const l=dist(p,c)||1; return [p[0]+(c[0]-p[0])/l*d,p[1]+(c[1]-p[1])/l*d]; }); };

/* ── разбор листа ── */
const CV=document.createElement('canvas').getContext('2d');
function pathSubs(d){ /* M/L/H/V/Z (абсолютные и относительные) — точно; кривые — null (их снимаем getPointAtLength) */
  if(/[QqCcAaSsTt]/.test(d)) return null;
  const tk=d.match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)||[], out=[]; let cmd='', cur=[0,0], st=[0,0], sub=null, i=0;
  const num=()=>parseFloat(tk[i++]);
  while(i<tk.length){ if(/[A-Za-z]/.test(tk[i])) cmd=tk[i++];
    if(cmd==='Z'||cmd==='z'){ if(sub){ sub.closed=true; } cur=st.slice(); sub=null; continue; }
    if(cmd==='M'||cmd==='m'){ const x=num(), y=num(); cur=cmd==='m'?[cur[0]+x,cur[1]+y]:[x,y]; st=cur.slice(); sub=[cur.slice()]; out.push(sub); cmd=cmd==='m'?'l':'L'; continue; }
    let p; if(cmd==='L'){ p=[num(),num()]; } else if(cmd==='l'){ const x=num(), y=num(); p=[cur[0]+x,cur[1]+y]; }
    else if(cmd==='H'){ p=[num(),cur[1]]; } else if(cmd==='h'){ p=[cur[0]+num(),cur[1]]; } else if(cmd==='V'){ p=[cur[0],num()]; } else if(cmd==='v'){ p=[cur[0],cur[1]+num()]; } else { i++; continue; }
    if(!sub){ sub=[cur.slice()]; out.push(sub); } sub.push(p); cur=p; }
  return out; }
function sampleCurve(el,d){ /* кривая (волнистая, дуга): по подпутям, шаг ~0,7 ед. */
  return d.split(/(?=[Mm])/).filter(s=>s.trim()).map(s=>{ const p=document.createElementNS(NS,'path'); p.setAttribute('d',s); el.parentNode.appendChild(p);
    const L=p.getTotalLength(), n=Math.max(2,Math.ceil(L/0.7)), o=[]; for(let i=0;i<=n;i++){ const q=p.getPointAtLength(L*i/n); o.push([q.x,q.y]); } p.remove(); return o; }); }
const mul=(M,p)=>[M.a*p[0]+M.c*p[1]+M.e,M.b*p[0]+M.d*p[1]+M.f];
/* точка для isPointInFill: старые Chromium (129 в CI) принимают только SVGPoint, не DOMPoint */
const svgPt=(el,x,y)=>{ const q=el.ownerSVGElement.createSVGPoint(); q.x=x; q.y=y; return q; };
function flatten(svgStr){
  const host=document.createElement('div'); host.style.cssText='position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;width:10px;height:10px;overflow:hidden';
  host.innerHTML=svgStr; document.body.appendChild(host); const svg=host.querySelector('svg');
  const vb=(svg.getAttribute('viewBox')||'0 0 100 100').split(/[ ,]+/).map(Number); svg.setAttribute('width',vb[2]); svg.setAttribute('height',vb[3]); svg.style.cssText='position:absolute;left:0;top:0';
  /* вложенные виды (data:image/svg+xml) — в группы с тем же переносом и масштабом */
  let vi=0;
  [...svg.querySelectorAll('image')].forEach(im=>{ const h=im.getAttribute('href')||im.getAttribute('xlink:href')||'', m=/^data:image\/svg\+xml(?:;charset=utf-8)?,(.*)$/.exec(h); if(!m) return;
    const ns=new DOMParser().parseFromString(decodeURIComponent(m[1]),'image/svg+xml').documentElement;
    const v=(ns.getAttribute('viewBox')||('0 0 '+ns.getAttribute('width')+' '+ns.getAttribute('height'))).split(/[ ,]+/).map(Number);
    const w=+im.getAttribute('width'), hh=+im.getAttribute('height'), x=+(im.getAttribute('x')||0), y=+(im.getAttribute('y')||0), s=Math.min(w/v[2],hh/v[3]);
    const ox=x+(w-v[2]*s)/2-v[0]*s, oy=y+(hh-v[3]*s)/2-v[1]*s, g=document.createElementNS(NS,'g'), pre='nv'+vi+'_';
    g.setAttribute('transform',(im.getAttribute('transform')||'')+` translate(${ox} ${oy}) scale(${s})`);
    if(im.hasAttribute('clip-path')) g.setAttribute('clip-path',im.getAttribute('clip-path'));
    g.setAttribute('data-view',vi++); g.setAttribute('data-href-len',h.length);
    ns.querySelectorAll('[id]').forEach(e=>{ e.id=pre+e.id; });
    ns.querySelectorAll('*').forEach(e=>['fill','stroke','clip-path'].forEach(a=>{ const q=e.getAttribute(a); if(q&&/url\(#/.test(q)) e.setAttribute(a,q.replace(/url\(#([^)]+)\)/,'url(#'+pre+'$1)')); }));
    [...ns.childNodes].forEach(c=>g.appendChild(document.importNode(c,true))); g.__href=h; im.replaceWith(g); });
  const toRoot=el=>{ const M=el.getCTM(); return {a:M.a,b:M.b,c:M.c,d:M.d,e:M.e+vb[0],f:M.f+vb[1]}; };   /* svg width = viewBox → корень = getCTM + начало viewBox */
  const viewOf=el=>{ const g=el.closest('[data-view]'); return g?+g.getAttribute('data-view'):-1; };
  const clipOf=el=>{ /* прямоугольники обрезки по цепочке предков — в координатах листа */
    const out=[]; for(let e=el;e&&e!==svg;e=e.parentNode){ const c=e.getAttribute&&e.getAttribute('clip-path'); if(!c) continue; const id=/url\(#([^)]+)\)/.exec(c); if(!id) continue;
      const cp=svg.querySelector('#'+CSS.escape(id[1])); const r=cp&&cp.querySelector('rect'); if(!r) continue; const M=toRoot(e.parentNode&&e.parentNode.getCTM?e.parentNode:svg);
      const x=+r.getAttribute('x'), y=+r.getAttribute('y'), w=+r.getAttribute('width'), h=+r.getAttribute('height'), A=mul(M,[x,y]), B=mul(M,[x+w,y+h]);
      out.push([Math.min(A[0],B[0]),Math.min(A[1],B[1]),Math.max(A[0],B[0]),Math.max(A[1],B[1])]); } return out; };
  const items=[], fills=[], texts=[], vpos=[];
  svg.querySelectorAll('[data-view]').forEach(g=>{ const M=toRoot(g.firstElementChild||g); vpos[+g.getAttribute('data-view')]=[M.e,M.f,M.a,g.__href]; });
  svg.querySelectorAll('line,path,rect,circle,polyline,polygon,ellipse').forEach(el=>{ if(el.closest('defs,pattern,clipPath,mask,marker')) return;
    const cs=getComputedStyle(el), M=toRoot(el), sc=Math.sqrt(Math.abs(M.a*M.d-M.b*M.c)), view=viewOf(el), clip=clipOf(el);
    let polys=[];
    const tag=el.tagName.toLowerCase();
    if(tag==='line') polys=[[[+el.getAttribute('x1'),+el.getAttribute('y1')],[+el.getAttribute('x2'),+el.getAttribute('y2')]]];
    else if(tag==='rect'){ const x=+el.getAttribute('x')||0, y=+el.getAttribute('y')||0, w=+el.getAttribute('width'), h=+el.getAttribute('height'); const P=[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]; P.closed=true; polys=[P]; }
    else if(tag==='circle'){ const cx=+el.getAttribute('cx'), cy=+el.getAttribute('cy'), r=+el.getAttribute('r'), P=[]; for(let i=0;i<=72;i++){ const a=i/72*2*Math.PI; P.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]); } P.closed=true; polys=[P]; }
    else if(tag==='path'){ const d=el.getAttribute('d')||''; polys=pathSubs(d)||sampleCurve(el,d); polys.forEach(P=>{ if(P.closed&&dist(P[0],P[P.length-1])>1e-9) P.push(P[0].slice()); }); }
    else if(tag==='polyline'||tag==='polygon'){ const n=(el.getAttribute('points')||'').trim().split(/[ ,]+/).map(Number), P=[]; for(let i=0;i+1<n.length;i+=2) P.push([n[i],n[i+1]]); if(tag==='polygon'){ P.push(P[0].slice()); P.closed=true; } polys=[P]; }
    polys=polys.filter(P=>P.length>=2).map(P=>{ const Q=P.map(p=>mul(M,p)); Q.closed=P.closed; return Q; });
    if(!polys.length) return;
    const stroke=cs.stroke, sw=parseFloat(cs.strokeWidth)||0, fill=cs.fill, op=+cs.opacity*(+cs.strokeOpacity||1);
    if(stroke&&stroke!=='none'&&sw>0&&op>0.05){ const da=cs.strokeDasharray&&cs.strokeDasharray!=='none'?cs.strokeDasharray.split(/[ ,]+/).map(parseFloat).filter(v=>!isNaN(v)):null;
      items.push({el,tag,view,clip,polys,sw:sw*sc,dash:da&&da.length&&da.some(v=>v>0)?(da.length%2?da.concat(da):da).map(v=>v*sc):null,off:(parseFloat(cs.strokeDashoffset)||0)*sc,col:stroke,curve:tag==='path'&&/[QqCcAa]/.test(el.getAttribute('d')||'')}); }
    if(fill&&fill!=='none'&&+cs.fillOpacity>0.02){ const pat=/url\("?#([^")]+)"?\)/.exec(fill); let P=null;
      if(pat){ const pe=svg.querySelector('#'+CSS.escape(pat[1])); if(pe){ const ln=pe.querySelector('line'), pt=(pe.getAttribute('patternTransform')||''), rot=/rotate\(([-\d.]+)/.exec(pt), w=+pe.getAttribute('width'), lw=ln?parseFloat(ln.getAttribute('stroke-width')):0;
        /* направление штриха: линия узора (x1,y1)-(x2,y2), повёрнутая patternTransform, затем в координаты листа */
        const a=(rot?+rot[1]:0)*Math.PI/180, d0=ln?[+ln.getAttribute('x2')-+ln.getAttribute('x1'),+ln.getAttribute('y2')-+ln.getAttribute('y1')]:[0,1], dl=[d0[0]*Math.cos(a)-d0[1]*Math.sin(a),d0[0]*Math.sin(a)+d0[1]*Math.cos(a)], dm=[M.a*dl[0]+M.c*dl[1],M.b*dl[0]+M.d*dl[1]];
        P={pitch:w*sc,lw:lw*sc,ang:R(((Math.atan2(-dm[1],dm[0])*180/Math.PI)%180+180)%180,1)}; } }
      fills.push({el,tag,view,clip,polys,fill,pat:P,M}); } });
  svg.querySelectorAll('text').forEach(el=>{ const s=el.textContent.trim(); if(!s) return; const cs=getComputedStyle(el), M=toRoot(el), sc=Math.sqrt(Math.abs(M.a*M.d-M.b*M.c));
    CV.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const m=CV.measureText(s);
    /* высота шрифта по ГОСТ 2.304 — высота прописных, по шрифту, которым надпись нарисована; меряем на кегле 100 px
       (на мелком кегле canvas округляет высоту глифа до целого пикселя — ошибка до 7 %) и пересчитываем */
    CV.font=`${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`; const cap=CV.measureText('Н').actualBoundingBoxAscent/100*parseFloat(cs.fontSize); CV.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const x=+el.getAttribute('x')||0, y=+el.getAttribute('y')||0, an=cs.textAnchor, w=m.width, x0=an==='middle'?x-w/2:an==='end'?x-w:x;
    const L=x0+(m.actualBoundingBoxLeft<0?-m.actualBoundingBoxLeft:-m.actualBoundingBoxLeft), Rr=x0+m.actualBoundingBoxRight, T=y-m.actualBoundingBoxAscent, B=y+m.actualBoundingBoxDescent;
    const box=[[L,T],[Rr,T],[Rr,B],[L,B]].map(p=>mul(M,p)), rot=Math.atan2(M.b,M.a)*180/Math.PI;
    texts.push({el,s,cls:el.getAttribute('class')||'',box,cap:cap*sc,size:parseFloat(cs.fontSize)*sc,rot,c:mul(M,[(L+Rr)/2,(T+B)/2]),base:mul(M,[x,y]),view:viewOf(el)}); });
  return {host,svg,vb,items,fills,texts,vpos}; }

/* ── отрезки с отсечением по прямоугольникам обрезки ── */
function clipSeg(a,b,r){ let t0=0,t1=1; const dx=b[0]-a[0], dy=b[1]-a[1];
  const p=[-dx,dx,-dy,dy], q=[a[0]-r[0],r[2]-a[0],a[1]-r[1],r[3]-a[1]];
  for(let i=0;i<4;i++){ if(Math.abs(p[i])<1e-12){ if(q[i]<0) return null; continue; } const t=q[i]/p[i]; if(p[i]<0){ if(t>t1) return null; if(t>t0) t0=t; } else { if(t<t0) return null; if(t<t1) t1=t; } }
  return [[a[0]+dx*t0,a[1]+dy*t0],[a[0]+dx*t1,a[1]+dy*t1]]; }
function segsOf(it){ const out=[]; it.polys.forEach((P,pi)=>{ for(let i=1;i<P.length;i++){ let s=[P[i-1],P[i]]; for(const r of it.clip){ s=clipSeg(s[0],s[1],r); if(!s) break; } if(s&&dist(s[0],s[1])>1e-6) out.push({a:s[0],b:s[1],it,pi}); } }); return out; }

/* ── сетка для поиска ближайших отрезков ── */
function grid(segs,cell){ const G=new Map(), key=(x,y)=>x+','+y;
  segs.forEach(s=>{ const x0=Math.floor(Math.min(s.a[0],s.b[0])/cell), x1=Math.floor(Math.max(s.a[0],s.b[0])/cell), y0=Math.floor(Math.min(s.a[1],s.b[1])/cell), y1=Math.floor(Math.max(s.a[1],s.b[1])/cell);
    for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++){ const k=key(x,y); if(!G.has(k)) G.set(k,[]); G.get(k).push(s); } });
  return {near(p,r){ const o=new Set(), x0=Math.floor((p[0]-r)/cell), x1=Math.floor((p[0]+r)/cell), y0=Math.floor((p[1]-r)/cell), y1=Math.floor((p[1]+r)/cell);
    for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) (G.get(key(x,y))||[]).forEach(s=>o.add(s)); return [...o]; },
    dist(p,r){ let m=Infinity; this.near(p,r).forEach(s=>{ const d=segDist(p,s.a,s.b); if(d<m) m=d; }); return m; }}; }

/* ── главное: проверка листа ── */
function check(svgStr,opt){ opt=opt||{}; const F=flatten(svgStr); try{ return run(F,opt); } finally{ F.host.remove(); } }
function run(F,opt){
  const E=window.ESKD; if(!E) throw new Error('нет реестра норм window.ESKD');
  const issues=[], add=(gost,rule,msg,at,sev)=>issues.push({gost,rule,msg,at:at?[R(at[0]/k),R(at[1]/k)]:null,sev:sev||'err'});
  const N=id=>E.N[id].v, rg=(id,s)=>E.r(id,s), T=id=>E.t(id), GS=id=>E.g(id);
  const STD=Object.entries(N('fmt')).map(([n,[a,b]])=>[n,b,a]);   /* форматы ГОСТ 2.301: [имя, длинная, короткая сторона] */
  const {items,fills,texts}=F;
  /* масштаб листа k (ед. SVG на мм): основная надпись 185 × 55 — самый крупный прямоугольник этой пропорции у края */
  const rects=items.filter(it=>it.tag==='rect').map(it=>{ const P=it.polys[0]; return {it,x0:Math.min(...P.map(p=>p[0])),y0:Math.min(...P.map(p=>p[1])),x1:Math.max(...P.map(p=>p[0])),y1:Math.max(...P.map(p=>p[1]))}; });
  rects.forEach(r=>{ r.w=r.x1-r.x0; r.h=r.y1-r.y0; });
  const TB=N('tb'), FRM=N('frame'), tbR=rects.filter(r=>Math.abs(r.w/r.h-TB[0]/TB[1])<0.01).sort((a,b)=>b.w-a.w)[0];
  /* по размерным числам — независимо от рамки (масштаб 1:1): сюда же сходится проверка масштаба ниже */
  let k=tbR?tbR.w/TB[0]:null;
  const segAll=[]; items.forEach(it=>segsOf(it).forEach(s=>segAll.push(s)));
  /* типы линий по виду */
  const sMain=(()=>{ const ws=items.filter(it=>!it.dash&&it.view>=0).map(it=>it.sw); if(!ws.length) return null; ws.sort((a,b)=>b-a); return ws[0]; })();
  /* толстая — от самой толстой сплошной линии видов (контура): тонкие по ГОСТ не толще s/2, а s бывает и 0,5 мм — порог в мм не годится */
  const kind=it=>{ if(it.dash){ const d=it.dash; return d.length>=4&&d.length%4===0&&d[0]>d[2]*2?'axis':'dash'; } if(!k) return 'solid'; return sMain?(it.sw>=0.7*sMain?'thick':'thin'):(it.sw/k>=0.45?'thick':'thin'); };
  items.forEach(it=>{ it.kind=kind(it); });
  const arrows=fills.filter(f=>f.tag==='path'&&!f.pat&&f.polys.length===1&&f.polys[0].length<=5&&(()=>{ const P=f.polys[0]; let A=0; for(let i=1;i<P.length;i++) A+=P[i-1][0]*P[i][1]-P[i][0]*P[i-1][1]; A=Math.abs(A)/2; return k&&A/k/k<6&&A>0; })())
    .map(f=>{ const P=f.polys[0].slice(0,3), e=[dist(P[0],P[1]),dist(P[1],P[2]),dist(P[2],P[0])], i=e.indexOf(Math.min(...e)), base=[P[(i)%3],P[(i+1)%3]], tip=P[(i+2)%3], mid=[(base[0][0]+base[1][0])/2,(base[0][1]+base[1][1])/2];
      return {f,tip,len:dist(tip,mid),wid:e[i],dir:[(tip[0]-mid[0])/(dist(tip,mid)||1),(tip[1]-mid[1])/(dist(tip,mid)||1)],view:f.view}; });

  if(!opt.draft){
    /* ГОСТ 2.104, 2.301 */
    if(!tbR){ add(GS('tb'),'основная надпись','нет основной надписи '+TB[0]+' × '+TB[1]+' мм',null); }
    else {
      const outer=rects.filter(r=>r!==tbR&&r.w>tbR.w*1.5).sort((a,b)=>b.w-a.w), sheetR=outer[0], frameR=outer.find(r=>r!==sheetR&&r.x0>sheetR.x0+1);
      if(!sheetR) add(GS('fmt'),'формат','нет границы формата',null);
      else { const W=sheetR.w/k, H=sheetR.h/k, fm=STD.find(f=>Math.abs(f[1]-W)<1&&Math.abs(f[2]-H)<1||Math.abs(f[2]-W)<1&&Math.abs(f[1]-H)<1);
        F.fmt=fm?fm[0]:R(W,0)+'×'+R(H,0);
        if(!fm) add(GS('fmt'),'формат','лист '+R(W,0)+' × '+R(H,0)+' мм — не стандартный формат',[sheetR.x0,sheetR.y0]);
        const lab=texts.find(t=>/^Формат\s+/.test(t.s)); if(fm&&lab&&lab.s.replace(/^Формат\s+/,'').trim()!==fm[0]) add(GS('fmt'),'формат','подпись «'+lab.s+'», а лист — '+fm[0],lab.base);
        if(!frameR) add(GS('frame'),'рамка','нет рамки',null);
        else { const o=[(frameR.x0-sheetR.x0)/k,(frameR.y0-sheetR.y0)/k,(sheetR.x1-frameR.x1)/k,(sheetR.y1-frameR.y1)/k];
          if(Math.abs(o[0]-FRM.l)>0.5||[1,2,3].some(i=>Math.abs(o[i]-FRM.o)>0.5)) add(GS('frame'),'рамка','поля рамки '+o.map(v=>R(v,1)).join(' / ')+' мм вместо '+[FRM.l,FRM.o,FRM.o,FRM.o].join(' / '),[frameR.x0,frameR.y0]);
          if(Math.abs(tbR.x1-frameR.x1)>0.5*k||Math.abs(tbR.y1-frameR.y1)>0.5*k) add(GS('tb'),'основная надпись','не в правом нижнем углу рамки',[tbR.x0,tbR.y0]);
          /* всё — внутри рамки (кроме подписи формата под рамкой) */
          const outside=p=>p[0]<frameR.x0-0.3*k||p[0]>frameR.x1+0.3*k||p[1]<frameR.y0-0.3*k||p[1]>frameR.y1+0.3*k;
          const bad=segAll.find(s=>s.it!==sheetR.it&&(outside(s.a)||outside(s.b))); if(bad) add(GS('frame'),'рамка','линия за рамкой',bad.a);
          const bt=texts.find(t=>!/^Формат/.test(t.s)&&t.box.some(outside)); if(bt) add(GS('frame'),'рамка','надпись «'+bt.s+'» за рамкой',bt.c);
          F.frame=frameR; }
        if(Math.abs(tbR.h/k-TB[1])>0.5) add(GS('tb'),'основная надпись','высота '+R(tbR.h/k)+' мм вместо '+TB[1],[tbR.x0,tbR.y0]);
        /* на основной надписи — ничего с изображений и размеров: отрезок, пересекающий её край, или линия вида внутри */
        const inTB=p=>p[0]>tbR.x0+0.3*k&&p[0]<tbR.x1-0.3*k&&p[1]>tbR.y0+0.3*k&&p[1]<tbR.y1-0.3*k;
        const outTB=p=>p[0]<tbR.x0-0.3*k||p[0]>tbR.x1+0.3*k||p[1]<tbR.y0-0.3*k||p[1]>tbR.y1+0.3*k;
        const cross=segAll.find(s=>s.it!==sheetR.it&&s.it!==(frameR&&frameR.it)&&(s.it.view>=0&&(inTB(s.a)||inTB(s.b))||(inTB(s.a)&&outTB(s.b)||inTB(s.b)&&outTB(s.a))));
        if(cross) add(GS('tb'),'основная надпись','линия чертежа заходит на основную надпись',cross.a);
        if(!texts.some(t=>/^1\s*:\s*1$/.test(t.s)&&inTB(t.c))) add('2.302','масштаб','в основной надписи не указан масштаб 1:1',[tbR.x0,tbR.y0]);
      }
    }
  }
  if(!k){ return {k:null,issues}; }
  const mm=v=>R(v/k,2);

  /* ── ГОСТ 2.303: линии ── */
  const drawn=items.filter(it=>!(opt.draft&&!/^(#111|#15161a|rgb\(17, 17, 17\)|rgb\(21, 22, 26\)|#000|rgb\(0, 0, 0\))$/i.test(it.col)));   /* в черновике цветные построения — не линии чертежа */
  const thick=drawn.filter(it=>it.kind==='thick'), sVals=thick.map(it=>it.sw/k);
  const s=(()=>{ const v=drawn.filter(it=>it.kind==='thick'&&it.view>=0).map(it=>it.sw/k); return v.length?Math.min(...v):sVals.length?Math.min(...sVals):0.7; })();
  if(!E.ok('line.s',s)) add(GS('line.s'),'основная линия','толщина '+R(s,2)+' мм вне '+T('line.s'),null);
  /* разомкнутая линия (обозначение разреза) — толще основной: s…1,5s, штрих 8…20 мм */
  const openL=thick.filter(it=>it.sw/k>s*1.15&&it.tag==='line');
  thick.filter(it=>!openL.includes(it)).forEach(it=>{ const w=it.sw/k; if(Math.abs(w-s)>0.04){ const P=it.polys[0]; add(GS('line.same'),'одна толщина основной линии',(it.view>=0?'контур вида':it.tag==='rect'?'рамка/надпись':'линия')+' '+R(w,2)+' мм, а основная — '+R(s,2)+' мм',P[0]); } });
  /* видимый контур каждого изображения (самая толстая сплошная линия вложенного рисунка вида) — одной толщины на всех видах */
  { const per={}; drawn.filter(it=>it.view>=0&&!it.dash).forEach(it=>{ const v=it.view; if(!per[v]||it.sw>per[v].sw) per[v]=it; }); const V=Object.values(per);
    if(V.length>1){ const mx=Math.max(...V.map(it=>it.sw)); V.forEach(it=>{ if(it.sw<mx*0.8) add(GS('line.same'),'одна толщина основной линии','видимый контур одного изображения '+R(it.sw/k,2)+' мм, других — '+R(mx/k,2)+' мм',it.polys[0][0]); }); } }
  openL.forEach(it=>{ const w=it.sw/k, P=it.polys[0], L=dist(P[0],P[1])/k; if(w>rg('line.open.w',s)[1]+0.01) add(GS('line.open.w'),'разомкнутая линия','толщина '+R(w,2)+' мм больше '+T('line.open.w').split('…')[1]+' = '+R(rg('line.open.w',s)[1],2),P[0]); if(!E.ok('line.open.st',L,s,0.1)) add(GS('line.open.st'),'разомкнутая линия','штрих '+R(L,1)+' мм вне '+T('line.open.st'),P[0]); });
  const KN={thin:'тонкая',dash:'штриховая',axis:'штрихпунктирная'}, KW={thin:'line.thin.w',dash:'line.dash.w',axis:'line.axis.w'};
  drawn.filter(it=>it.kind!=='thick').forEach(it=>{ const w=it.sw/k, P=it.polys[0], id=KW[it.kind]||'line.thin.w'; if(!E.ok(id,w,s,0.012)) add(GS(id),'тонкие линии',(KN[it.kind]||'тонкая')+' '+R(w,3)+' мм вне '+T(id)+' = '+rg(id,s).map(v=>R(v,2)).join('…'),P[0]); });
  fills.filter(f=>f.pat).forEach(f=>{ const w=f.pat.lw/k; if(!E.ok('line.thin.w',w,s,0.012)) add(GS('line.thin.w'),'тонкие линии','штриховка '+R(w,3)+' мм вне '+T('line.thin.w'),f.polys[0][0]); });
  /* одна толщина у линий одного типа на всём листе (ГОСТ 2.303): сплошные тонкие (с волнистой и штриховкой), штриховые, штрихпунктирные */
  if(!opt.draft){ const grp={thin:[],dash:[],axis:[]}; drawn.forEach(it=>{ if(grp[it.kind]) grp[it.kind].push({w:it.sw/k,at:it.polys[0][0]}); }); fills.filter(f=>f.pat).forEach(f=>grp.thin.push({w:f.pat.lw/k,at:f.polys[0][0],h:1}));
    Object.entries(grp).forEach(([kd,L])=>{ if(L.length<2) return; const ws=L.map(x=>x.w).sort((a,b)=>a-b), md=ws[ws.length>>1];
      const odd=L.filter(x=>Math.abs(x.w-md)>0.02); if(odd.length) add(GS('line.same'),'одна толщина линий одного типа',KN[kd]+(odd[0].h?' (штриховка)':'')+' '+R(odd[0].w,3)+' мм, остальные '+R(md,3)+' мм'+(odd.length>1?' — таких линий '+odd.length:''),odd[0].at); }); }
  /* штриховая */
  drawn.filter(it=>it.kind==='dash').forEach(it=>{ const d=it.dash.map(v=>v/k), st=d.filter((v,i)=>i%2===0), gp=d.filter((v,i)=>i%2===1);
    if(st.some(v=>!E.ok('line.dash.st',v,s,0.05))||gp.some(v=>!E.ok('line.dash.gp',v,s,0.05))) add(GS('line.dash.st'),'штриховая линия','штрих '+st.map(v=>R(v,2)).join('/')+', промежуток '+gp.map(v=>R(v,2)).join('/')+' мм — нужно '+T('line.dash.st').replace(' мм','')+' и '+T('line.dash.gp'),it.polys[0][0]); });
  /* штрихпунктирная: шаг, начало и конец штрихом, пересечения штрихами, выход за контур */
  const axes=drawn.filter(it=>it.kind==='axis');
  const phase=(it,len)=>{ const d=it.dash, P=d.reduce((a,b)=>a+b,0); let u=((len+it.off)%P+P)%P; for(let i=0;i<d.length;i++){ if(u<d[i]) return {i,u,rest:d[i]-u}; u-=d[i]; } return {i:0,u:0,rest:d[0]}; };
  const longDash=(it,len)=>{ const p=phase(it,len); return p.i%4===0?p:null; };
  /* осевая из нескольких кусков (опоры у пересечений) — одна линия: соосные куски, сходящиеся концами */
  const straight=axes.filter(it=>it.polys.length===1&&it.polys[0].length===2&&!it.curve);
  const chainLen=it0=>{ const seen=new Set([it0]), st=[it0]; let L=0; const P0=it0.polys[0], u=[(P0[1][0]-P0[0][0]),(P0[1][1]-P0[0][1])], ul=Math.hypot(...u);
    while(st.length){ const it=st.pop(), P=it.polys[0]; L+=dist(P[0],P[1]);
      straight.forEach(o=>{ if(seen.has(o)) return; const Q=o.polys[0], v=[Q[1][0]-Q[0][0],Q[1][1]-Q[0][1]]; if(Math.abs(u[0]*v[1]-u[1]*v[0])/(ul*Math.hypot(...v))>0.01) return;
        if([P[0],P[1]].some(p=>[Q[0],Q[1]].some(q=>dist(p,q)<0.2*k))){ seen.add(o); st.push(o); } }); }
    return L; };
  axes.forEach(it=>{ const d=it.dash.map(v=>v/k); const at=it.polys[0][0];
    if(!E.ok('line.axis.st',d[0],s,0.05)) add(GS('line.axis.st'),'штрихпунктирная линия','штрих '+R(d[0],1)+' мм вне '+T('line.axis.st'),at);
    /* промежуток — весь разрыв между штрихами, с точкой посередине (ESKD: line.axis.gp) */
    const gpAll=d[1]+d[2]+d[3]; if(!E.ok('line.axis.gp',gpAll,s,0.05)) add(GS('line.axis.gp'),'штрихпунктирная линия','промежуток между штрихами (с точкой) '+R(gpAll,1)+' мм вне '+T('line.axis.gp'),at);
    it.polys.forEach(P=>{ if(P.closed) return; let L=0; for(let i=1;i<P.length;i++) L+=dist(P[i-1],P[i]);
      const a=longDash(it,Math.min(0.1*k,L/2)), b=longDash(it,Math.max(L-0.1*k,L/2));   /* 0,1 мм у конца — округление координат */
      if(!a||a.rest<0.9*k) add(GS('axis.cross'),'штрихпунктирная: начало и конец — штрих','начинается '+(a?'обрывком штриха '+mm(a.rest)+' мм':'промежутком или точкой'),P[0]);
      if(!b||b.u<0.9*k) add(GS('axis.cross'),'штрихпунктирная: начало и конец — штрих','кончается '+(b?'обрывком штриха '+mm(b.u)+' мм':'промежутком или точкой'),P[P.length-1]);
      if(P.length===2&&!it.curve&&chainLen(it)<18*k-0.1*k) add(GS('axis.small'),'центровые малых окружностей','штрихпунктирная длиной '+mm(L)+' мм: у окружности меньше Ø'+N('axis.small')+' центровые — сплошные тонкие',P[0]); }); });
  /* пересечения штрихпунктирных — штрихами */
  const along=(it,pi,p)=>{ const P=it.polys[pi]; let L=0, best=Infinity, at=0; for(let i=1;i<P.length;i++){ const l=dist(P[i-1],P[i]), d=segDist(p,P[i-1],P[i]); if(d<best){ best=d; const ax=P[i][0]-P[i-1][0], ay=P[i][1]-P[i-1][1]; at=L+Math.max(0,Math.min(l,((p[0]-P[i-1][0])*ax+(p[1]-P[i-1][1])*ay)/(l||1))); } L+=l; } return at; };
  { const AS=[]; axes.forEach(it=>it.polys.forEach((P,pi)=>{ for(let i=1;i<P.length;i++) AS.push({a:P[i-1],b:P[i],it,pi}); }));
    const seen=new Set();
    for(let i=0;i<AS.length;i++) for(let j=i+1;j<AS.length;j++){ const A=AS[i], B=AS[j]; if(A.it===B.it&&A.pi===B.pi) continue; const x=segX(A.a,A.b,B.a,B.b); if(!x) continue;
      const key=R(x.p[0]/k,0)+','+R(x.p[1]/k,0); if(seen.has(key)) continue;
      const da=Math.abs((A.b[0]-A.a[0])*(B.b[1]-B.a[1])-(A.b[1]-A.a[1])*(B.b[0]-B.a[0]))/(dist(A.a,A.b)*dist(B.a,B.b)); if(da<0.2) continue;
      const pa=longDash(A.it,along(A.it,A.pi,x.p)), pb=longDash(B.it,along(B.it,B.pi,x.p));
      /* пересечение у самого конца линии — это не «пересечение осей» (касание оси и центровой) */
      if(!pa||!pb){ seen.add(key); add(GS('axis.cross'),'штрихпунктирные пересекаются штрихами','в точке пересечения '+(!pa&&!pb?'у обеих':'у одной')+' линий — промежуток или точка',x.p); } } }

  /* ── виды: группы вложенных изображений с контуром ── */
  const vIdx=[...new Set(items.filter(it=>it.view>=0).map(it=>it.view))];
  const vb=v=>{ const S=segAll.filter(q=>q.it.view===v&&q.it.kind==='thick'); if(!S.length) return null; let b=[1e9,1e9,-1e9,-1e9]; S.forEach(q=>[q.a,q.b].forEach(p=>{ b[0]=Math.min(b[0],p[0]); b[1]=Math.min(b[1],p[1]); b[2]=Math.max(b[2],p[0]); b[3]=Math.max(b[3],p[1]); })); return b; };
  /* одно изображение может быть собрано из нескольких (половина вида и половина разреза — два вложенных рисунка с обрезкой):
     у них одно место на листе — тот же перенос и масштаб */
  const VW=[]; vIdx.forEach(v=>{ const b=vb(v); if(!b) return; const P=F.vpos[v]||[0,0,1], g=VW.find(w=>{ const Q=F.vpos[w.ids[0]]||[1e9,0,1]; return Math.abs(P[0]-Q[0])<0.5&&Math.abs(P[1]-Q[1])<0.5&&Math.abs(P[2]-Q[2])<1e-4; });
    if(g){ g.ids.push(v); g.b=[Math.min(g.b[0],b[0]),Math.min(g.b[1],b[1]),Math.max(g.b[2],b[2]),Math.max(g.b[3],b[3])]; } else VW.push({ids:[v],b}); });
  /* главный вид — слева сверху; вид слева — справа от него в той же полосе; вид сверху — под ним */
  VW.sort((a,b)=>a.b[1]-b.b[1]||a.b[0]-b.b[0]);
  const ovX=(a,b)=>Math.min(a.b[2],b.b[2])-Math.max(a.b[0],b.b[0]), ovY=(a,b)=>Math.min(a.b[3],b.b[3])-Math.max(a.b[1],b.b[1]);
  let FV=null, LV=null, TV=null;
  VW.forEach(w=>{ if(FV) return; const l=VW.find(u=>u!==w&&u.b[0]>w.b[2]&&ovY(u,w)>0), t=VW.find(u=>u!==w&&u.b[1]>w.b[3]&&ovX(u,w)>0); if(l||t){ FV=w; LV=l||null; TV=t||null; } });
  F.views={front:FV&&FV.b.map(v=>R(v/k)),left:LV&&LV.b.map(v=>R(v/k)),top:TV&&TV.b.map(v=>R(v/k))};
  const tol=0.35*k;
  if(FV&&TV){ if(Math.abs(FV.b[0]-TV.b[0])>tol||Math.abs(FV.b[2]-TV.b[2])>tol) add(GS('view.link'),'проекционная связь','главный вид и вид сверху: ширина '+mm(FV.b[2]-FV.b[0])+' и '+mm(TV.b[2]-TV.b[0])+' мм, сдвиг '+mm(TV.b[0]-FV.b[0])+' мм — не на одной вертикали',[TV.b[0],TV.b[1]]); }
  if(FV&&LV){ if(Math.abs(FV.b[1]-LV.b[1])>tol||Math.abs(FV.b[3]-LV.b[3])>tol) add(GS('view.link'),'проекционная связь','главный вид и вид слева: высота '+mm(FV.b[3]-FV.b[1])+' и '+mm(LV.b[3]-LV.b[1])+' мм, сдвиг '+mm(LV.b[1]-FV.b[1])+' мм — не на одной горизонтали',[LV.b[0],LV.b[1]]); }
  if(TV&&LV){ const dT=TV.b[3]-TV.b[1], dL=LV.b[2]-LV.b[0]; if(Math.abs(dT-dL)>tol) add(GS('view.link'),'проекционная связь','глубина на виде сверху '+mm(dT)+' мм, на виде слева '+mm(dL)+' мм',[LV.b[0],LV.b[3]]); }

  /* ── осевые выходят за контур на 2…5 мм (правило МУ, ESKD: axis.ext): крайние точки контура своего изображения в полосе вдоль оси ── */
  const chains=[];
  { const done=new Set(); straight.forEach(it0=>{ if(done.has(it0)) return; const ch=[it0], st=[it0]; done.add(it0);
      while(st.length){ const it=st.pop(), P=it.polys[0]; straight.forEach(o=>{ if(done.has(o)) return; const Q=o.polys[0], u=[P[1][0]-P[0][0],P[1][1]-P[0][1]], v=[Q[1][0]-Q[0][0],Q[1][1]-Q[0][1]];
        if(Math.abs(u[0]*v[1]-u[1]*v[0])/(Math.hypot(...u)*Math.hypot(...v))>0.01) return; if([P[0],P[1]].some(p=>[Q[0],Q[1]].some(q=>dist(p,q)<0.2*k))){ done.add(o); ch.push(o); st.push(o); } }); }
      const pts=ch.flatMap(it=>it.polys[0]), A=pts[0], u0=[pts[1][0]-A[0],pts[1][1]-A[1]], ul=Math.hypot(...u0), u=[u0[0]/ul,u0[1]/ul], pr=p=>(p[0]-A[0])*u[0]+(p[1]-A[1])*u[1];
      const s0=Math.min(...pts.map(pr)), s1=Math.max(...pts.map(pr)), L=s1-s0, mid=[A[0]+u[0]*(s0+s1)/2,A[1]+u[1]*(s0+s1)/2];
      chains.push({polys:[[[A[0]+u[0]*s0,A[1]+u[1]*s0],[A[0]+u[0]*s1,A[1]+u[1]*s1]]]});
      const w=[FV,LV,TV].find(w=>w&&mid[0]>=w.b[0]-1*k&&mid[0]<=w.b[2]+1*k&&mid[1]>=w.b[1]-1*k&&mid[1]<=w.b[3]+1*k); if(!w) return;
      const band=0.3*L; let lo=Infinity, hi=-Infinity;
      segAll.forEach(q=>{ if(!w.ids.includes(q.it.view)||(q.it.kind!=='thick'&&q.it.kind!=='dash')) return; [q.a,q.b,[(q.a[0]+q.b[0])/2,(q.a[1]+q.b[1])/2]].forEach(p=>{ const s=pr(p), n=Math.abs((p[0]-A[0])*u[1]-(p[1]-A[1])*u[0]); if(n>band||s<s0-0.01*k||s>s1+0.01*k) return; if(s<lo) lo=s; if(s>hi) hi=s; }); });
      if(!(hi>lo)) return; [[lo-s0,[A[0]+u[0]*s0,A[1]+u[1]*s0]],[s1-hi,[A[0]+u[0]*s1,A[1]+u[1]*s1]]].forEach(([o,at])=>{ if(!E.ok('axis.ext',o/k,s,0.3)) add(GS('axis.ext'),'осевая выходит за контур на '+T('axis.ext'),'выходит на '+mm(o)+' мм',at); }); }); }

  /* ── половина вида и половина разреза; невидимый контур на половине вида ── */
  const hatch=fills.filter(f=>f.pat), hatchOf=w=>hatch.filter(f=>w.ids.includes(f.view)||f.view<0&&(()=>{ const P=f.polys[0], c=[P.reduce((a,p)=>a+p[0],0)/P.length,P.reduce((a,p)=>a+p[1],0)/P.length]; return c[0]>w.b[0]&&c[0]<w.b[2]&&c[1]>w.b[1]&&c[1]<w.b[3]; })());
  const fillArea=(f,box,axis)=>{ /* доля заштрихованного слева/справа (сверху/снизу) от оси — по точкам сетки */
    const n=40; let a=0,b=0; for(let i=0;i<n;i++) for(let j=0;j<n;j++){ const p=[box[0]+(box[2]-box[0])*(i+.5)/n,box[1]+(box[3]-box[1])*(j+.5)/n];
      if(!f.clip.every(r=>p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3])) continue;
      const inv=f.M, det=inv.a*inv.d-inv.b*inv.c, x=p[0]-inv.e, y=p[1]-inv.f, lp=svgPt(f.el,(inv.d*x-inv.c*y)/det,(-inv.b*x+inv.a*y)/det);
      if(f.el.isPointInFill(lp)) (axis==='v'?p[0]:p[1])<(axis==='v'?box.ax:box.ay)?a++:b++; } return [a,b]; };
  const axLines=chains;   /* оси — целиком, из всех кусков */
  [FV,LV,TV].forEach((w,wi)=>{ if(!w) return; const H=hatchOf(w); if(!H.length) return; const cx=(w.b[0]+w.b[2])/2, cy=(w.b[1]+w.b[3])/2;
    const vx=axLines.find(it=>{ const P=it.polys[0]; return Math.abs(P[0][0]-P[1][0])<0.05*k&&Math.abs(P[0][0]-cx)<1*k&&Math.min(P[0][1],P[1][1])<w.b[1]&&Math.max(P[0][1],P[1][1])>w.b[3]; });
    const hy=axLines.find(it=>{ const P=it.polys[0]; return Math.abs(P[0][1]-P[1][1])<0.05*k&&Math.abs(P[0][1]-cy)<1*k&&Math.min(P[0][0],P[1][0])<w.b[0]&&Math.max(P[0][0],P[1][0])>w.b[2]; });
    const box=w.b.slice(); box.ax=vx?vx.polys[0][0][0]:cx; box.ay=hy?hy.polys[0][0][1]:cy;
    let L=0,Rr=0,U=0,D=0; H.forEach(f=>{ const v=fillArea(f,box,'v'), h=fillArea(f,box,'h'); L+=v[0]; Rr+=v[1]; U+=h[0]; D+=h[1]; });
    const name=['главном виде','виде слева','виде сверху'][wi];
    /* разрез только с одной стороны оси — это половина разреза: справа от вертикальной оси или снизу от горизонтальной */
    const half=wi===2?(U+D>0&&Math.min(U,D)<0.08*(U+D)?(U>D?'up':'down'):null):(L+Rr>0&&Math.min(L,Rr)<0.08*(L+Rr)?(L>Rr?'left':'right'):null);
    if(wi<2&&half==='left'&&vx) add(GS('cut.side'),'половина разреза — справа от оси','на '+name+' разрез слева от оси симметрии',[box.ax-5*k,cy]);
    if(wi===2&&half==='up'&&hy) add(GS('cut.side'),'половина разреза — снизу от оси','на '+name+' разрез сверху от оси',[cx,box.ay-5*k]);
    /* на половине вида невидимый контур не проводят */
    if(half){ const hid=segAll.filter(q=>w.ids.includes(q.it.view)&&q.it.kind==='dash'), side=q=>{ const m=[(q.a[0]+q.b[0])/2,(q.a[1]+q.b[1])/2]; return wi<2?(half==='right'?m[0]<box.ax-0.5*k:m[0]>box.ax+0.5*k):(half==='down'?m[1]<box.ay-0.5*k:m[1]>box.ay+0.5*k); };
      const bad=hid.filter(side); const len=bad.reduce((a,q)=>a+dist(q.a,q.b),0); if(len>3*k) add(GS('cut.hid'),'на половине вида — без невидимого контура','на '+name+' штриховые линии на половине вида ('+mm(len)+' мм)',bad[0].a); }
    /* ребро на оси симметрии (ГОСТ 2.305, соединение половины вида и половины разреза): если с осью совпадает ребро, вид от разреза
       отделяют сплошной волнистой линией, смещённой так, чтобы ребро было видно (внутреннее — в разрезе, наружное — на виде).
       По листу: граница волнистая → по оси идёт сплошная основная (ребро нарисовано; если волнистая не с той стороны, ребро
       оказывается на половине вида без невидимого контура или в срезанной части — и пропадает); ребро по оси есть → граница
       волнистая, а не ось (иначе ребро сливается со штрихпунктиром). u — координата поперёк оси, v — вдоль */
    if(half&&(wi<2?vx:hy)){ const U=p=>wi<2?p[0]:p[1], V=p=>wi<2?p[1]:p[0], ax0=wi<2?box.ax:box.ay, lo=wi<2?w.b[1]:w.b[0], hi=wi<2?w.b[3]:w.b[2];
      const cand=items.filter(it=>it.curve&&it.kind==='thin'&&(w.ids.includes(it.view)||it.view<0)&&it.polys.length);
      /* волнистая этого изображения: узкая поперёк оси, длинная вдоль, рядом с осью и большей частью в пределах изображения */
      const wav=cand.filter(it=>{ const P=[].concat(...it.polys), us=P.map(U), vs=P.map(V), v0=Math.min(...vs), v1=Math.max(...vs);
        return Math.max(...us)-Math.min(...us)<12*k&&v1-v0>8*k&&Math.abs((Math.max(...us)+Math.min(...us))/2-ax0)<15*k&&Math.min(v1,hi)-Math.max(v0,lo)>0.7*(v1-v0); });
      /* для проверки человеком (не ошибка): волнистая выходит за контур изображения — где кончается материал на её линии */
      wav.forEach(it=>{ const P=[].concat(...it.polys), um=P.reduce((s,p)=>s+U(p),0)/P.length, vs=P.map(V);
        const cut=segAll.filter(q=>w.ids.includes(q.it.view)&&q.it.kind==='thick'&&(U(q.a)-um)*(U(q.b)-um)<=0&&Math.abs(U(q.b)-U(q.a))>0.05*k).map(q=>{ const t=(um-U(q.a))/(U(q.b)-U(q.a)); return V(q.a)+t*(V(q.b)-V(q.a)); });
        if(cut.length>=2){ const out=Math.max(Math.min(...cut)-Math.min(...vs),Math.max(...vs)-Math.max(...cut)); if(out>1.5*k) (F.review=F.review||[]).push({gost:GS('cut.edge'),rule:'волнистая граница в пределах контура',msg:'на '+name+' волнистая линия выходит за контур изображения на '+mm(out)+' мм',at:P[0]}); } });
      const onAx=segAll.filter(q=>w.ids.includes(q.it.view)&&q.it.kind==='thick'&&Math.abs(U(q.a)-ax0)<0.3*k&&Math.abs(U(q.b)-ax0)<0.3*k&&Math.abs(V(q.b)-V(q.a))>1*k);
      const axLen=(v0,v1)=>onAx.reduce((s,q)=>s+Math.max(0,Math.min(Math.max(V(q.a),V(q.b)),v1)-Math.max(Math.min(V(q.a),V(q.b)),v0)),0);
      wav.forEach(it=>{ const P=[].concat(...it.polys), vs=P.map(V), um=P.reduce((s,p)=>s+U(p),0)/P.length, v0=Math.min(...vs), v1=Math.max(...vs);
        if(Math.abs(um-ax0)<1*k) add(GS('cut.edge'),'волнистая граница смещена от оси','на '+name+' волнистая линия лежит на оси симметрии — её смещают так, чтобы ребро на оси было видно',P[0]);
        else if(axLen(v0,v1)<Math.min(3*k,0.2*(v1-v0))) add(GS('cut.edge'),'ребро на оси видно','на '+name+' граница вида и разреза — волнистая линия, а сплошного ребра по оси нет: волнистая смещена не в ту сторону или ребро не нарисовано',P[Math.floor(P.length/2)]); });
      if(!wav.length&&axLen(lo,hi)>=3*k) add(GS('cut.edge'),'ребро на оси — граница волнистой линией','на '+name+' по оси симметрии идёт ребро ('+mm(axLen(lo,hi))+' мм), а граница вида и разреза — сама ось: ребро сливается с осью',wi<2?[ax0,(lo+hi)/2]:[(lo+hi)/2,ax0]); } });

  /* ── ГОСТ 2.306: штриховка ── */
  if(hatch.length){ const P0=hatch[0].pat; hatch.forEach(f=>{ const p=f.pat;
      if(!E.ok('hatch.pitch',p.pitch/k,s,0.05)) add(GS('hatch.pitch'),'шаг штриховки',R(p.pitch/k,2)+' мм вне '+T('hatch.pitch'),f.polys[0][0]);
      if(Math.abs(p.pitch-P0.pitch)>0.05*k) add(GS('hatch.same'),'один шаг штриховки на всех разрезах','шаг '+mm(p.pitch)+' и '+mm(P0.pitch)+' мм',f.polys[0][0]);
      const a=p.ang, A0=N('hatch.ang'), A1=N('hatch.alt'); if(![A0,180-A0].some(v=>Math.abs(a-v)<1)&&!A1.flatMap(v=>[v,180-v]).some(v=>Math.abs(a-v)<1)) add(GS('hatch.ang'),'наклон штриховки',R(a,0)+'° — нужно '+T('hatch.ang')+' ('+A1.join('° или ')+'°, если '+T('hatch.ang')+' совпадает с контуром или осью)',f.polys[0][0]);
      const same=(x,y)=>Math.abs(x-y)<1||Math.abs(x-y)>179; const dirOf=v=>v<90?1:-1;
      if(!opt.draft&&dirOf(a)!==dirOf(P0.ang)) add(GS('hatch.same'),'наклон штриховки в одну сторону','на разных разрезах одной детали штриховка в разные стороны ('+R(a,0)+'° и '+R(P0.ang,0)+'°)',f.polys[0][0]);
      else if(!opt.draft&&!same(a,P0.ang)&&[45,135].some(v=>Math.abs(P0.ang-v)<1)&&[45,135].some(v=>Math.abs(a-v)<1)) add(GS('hatch.same'),'наклон штриховки в одну сторону','штриховка '+R(a,0)+'° и '+R(P0.ang,0)+'°',f.polys[0][0]); }); }

  /* ── ГОСТ 2.304, 2.307: надписи ── */
  const isNum=t=>/^(\d+\s*отв\.\s*)?[ØR⌀]?\s*\d+([.,]\d+)?°?$/.test(t.s.replace(/\s+/g,' '));
  const isLet=t=>/^[А-ЯЁ]$/.test(t.s), isLab=t=>/^([А-ЯЁ])\s*[–-]\s*\1$/.test(t.s);
  const nums=texts.filter(isNum).filter(t=>!(F.frame&&tbR&&t.c[0]>tbR.x0&&t.c[1]>tbR.y0));
  texts.forEach(t=>{ const h=t.cap/k; if(h<N('font.min')-0.08) add(GS('font.min'),'шрифт ≥ '+T('font.min'),'«'+t.s+'» — '+R(h,2)+' мм',t.c);
    /* размер шрифта — из ряда ГОСТ 2.304 (высота прописных); на черновике подписи точек — не чертёжный шрифт */
    else if(!opt.draft&&!E.inSeries(h)) add(GS('font.h'),'размер шрифта из ряда','«'+t.s+'» — '+R(h,2)+' мм, а ряд: '+T('font.h'),t.c); });
  nums.forEach(t=>{ const h=t.cap/k; if(h<rg('font.dim')[0]-0.08) add(GS('font.dim'),'размерные числа ≥ '+num(rg('font.dim')[0])+' мм','«'+t.s+'» — '+R(h,2)+' мм',t.c); });
  const dimH=nums.length?nums.map(t=>t.cap).sort((a,b)=>a-b)[nums.length>>1]:0;
  /* буквенные обозначения ≈ вдвое крупнее размерных чисел (ГОСТ 2.316): мелкая буква — замечание у буквы, мелкие числа — у числа */
  texts.filter(t=>isLab(t)||isLet(t)).forEach(t=>{ if(!dimH) return; const q=t.cap/dimH; if(q<1.6) add(GS('font.let'),'буквы обозначений ≈ в 2 раза крупнее размерных чисел','«'+t.s+'» '+mm(t.cap)+' мм, размерные числа '+mm(dimH)+' мм — в '+R(q,1)+' раза',t.c);
    else if(q>2.5){ const sm=nums.slice().sort((a,b)=>a.cap-b.cap)[0]; add(GS('font.let'),'буквы обозначений ≈ в 2 раза крупнее размерных чисел','размерные числа '+mm(dimH)+' мм, буквы «'+t.s+'» '+mm(t.cap)+' мм — в '+R(q,1)+' раза',sm.c); } });
  /* числа не пересекают линиями и штриховкой; надписи не налезают друг на друга */
  const G=grid(segAll.filter(q=>!(opt.draft&&q.it.kind!=='thick'&&!/^(#111|#15161a|rgb\(17, 17, 17\)|rgb\(21, 22, 26\))$/i.test(q.it.col))),5*k);
  nums.forEach(t=>{ const P=shrink(t.box,0.15*k), c=t.c, r=Math.max(...P.map(p=>dist(p,c)));
    const hit=G.near(c,r).find(q=>segPoly(q.a,q.b,P)); if(hit) add(GS('dim.cross'),'размерное число не пересекают линиями','«'+t.s+'» пересекает '+({thick:'контур',thin:'тонкая линия',dash:'штриховая',axis:'осевая'}[hit.it.kind]||'линия'),c);
    const hf=hatch.find(f=>P.concat([c]).some(p=>{ if(!f.clip.every(r2=>p[0]>=r2[0]&&p[0]<=r2[2]&&p[1]>=r2[1]&&p[1]<=r2[3])) return false; const M=f.M, det=M.a*M.d-M.b*M.c, x=p[0]-M.e, y=p[1]-M.f; return f.el.isPointInFill(svgPt(f.el,(M.d*x-M.c*y)/det,(-M.b*x+M.a*y)/det)); }));
    if(hf) add('2.306','размерное число на штриховке','«'+t.s+'» стоит на заштрихованном разрезе — штриховку у числа прерывают, лучше вынести число',c); });
  for(let i=0;i<texts.length;i++) for(let j=i+1;j<texts.length;j++){ const A=texts[i], B=texts[j]; if(dist(A.c,B.c)>60*k) continue; if(polyX(shrink(A.box,0.1*k),shrink(B.box,0.1*k))) add('2.307','надписи не налезают','«'+A.s+'» и «'+B.s+'»',A.c); }
  /* стрелки одного размера */
  const AR=arrows.filter(a=>a.view<0&&a.len/k<8);
  const opArr=new Set(), arDim=AR.filter(a=>{ const near=items.some(it=>it.kind==='thick'&&it.tag==='line'&&openL.includes(it)&&it.polys[0].some(p=>dist(p,a.tip)<16*k)); if(near) opArr.add(a); return !near; });
  if(arDim.length){ const L=arDim.map(a=>a.len/k), W=arDim.map(a=>a.wid/k), md=v=>v.slice().sort((x,y)=>x-y)[v.length>>1], mL=md(L), mW=md(W);
    arDim.forEach(a=>{ if(Math.abs(a.len/k-mL)>0.3||Math.abs(a.wid/k-mW)>0.3) add(GS('dim.arrow'),'стрелки одного размера','стрелка '+mm(a.len)+' × '+mm(a.wid)+' мм, остальные '+R(mL,1)+' × '+R(mW,1),a.tip); });
    if(!E.ok('dim.arrowLen',mL,s,0.1)) add(GS('dim.arrowLen'),'размер стрелок','длина стрелки '+R(mL,1)+' мм вне '+T('dim.arrowLen'),arDim[0].tip); }
  /* размерные линии: тонкие прямые со стрелкой на конце */
  const thinS=segAll.filter(q=>q.it.kind==='thin'&&q.it.view<0&&q.it.tag==='line');
  const dims=[]; thinS.forEach(q=>{ const L=dist(q.a,q.b); if(L<1e-6) return; const u=[(q.b[0]-q.a[0])/L,(q.b[1]-q.a[1])/L];
    const on=arDim.filter(a=>segDist(a.tip,q.a,q.b)<0.15*k&&Math.abs(a.dir[0]*u[1]-a.dir[1]*u[0])<0.1); if(!on.length) return;
    /* свои стрелки: у концов линии и смотрят наружу; у короткого размера — внутри линии и смотрят друг на друга.
       Стрелка соседнего размера цепочки стоит в том же конце, но смотрит внутрь — она не наша */
    const m=[(q.a[0]+q.b[0])/2,(q.a[1]+q.b[1])/2], out_=a=>(a.tip[0]-m[0])*a.dir[0]+(a.tip[1]-m[1])*a.dir[1]>0, atEnd=a=>Math.min(dist(a.tip,q.a),dist(a.tip,q.b))<0.2*k;
    let tips=on.filter(a=>atEnd(a)&&out_(a)); if(!tips.length) tips=on.filter(a=>!atEnd(a)&&!out_(a)); if(!tips.length) tips=on.filter(a=>!atEnd(a));
    if(tips.length) dims.push({q,u,tips,L}); });
  /* выносные линии выходят за размерную на 1…5 мм */
  dims.forEach(d=>{ if(Math.abs(d.u[0])>1e-3&&Math.abs(d.u[1])>1e-3) return;   /* выноска (наклонная, со стрелкой на окружности) — не размерная линия с выносными */
    d.tips.forEach(a=>{ const ext=thinS.find(q=>q!==d.q&&segDist(a.tip,q.a,q.b)<0.15*k&&(()=>{ const L=dist(q.a,q.b), v=[(q.b[0]-q.a[0])/L,(q.b[1]-q.a[1])/L]; return Math.abs(v[0]*d.u[0]+v[1]*d.u[1])<0.05; })());
      if(!ext) return; const over=Math.max(...[ext.a,ext.b].map(p=>{ const v=[p[0]-a.tip[0],p[1]-a.tip[1]]; return Math.abs(v[0]*d.u[1]-v[1]*d.u[0]); })), side=[ext.a,ext.b].map(p=>{ const v=[p[0]-a.tip[0],p[1]-a.tip[1]]; return v[0]*d.u[1]-v[1]*d.u[0]; });
      const beyond=Math.min(Math.abs(side[0]),Math.abs(side[1])); if(Math.sign(side[0])!==Math.sign(side[1])&&beyond>0.05*k&&!E.ok('dim.ext',beyond/k,s,0.05)) add(GS('dim.ext'),'выносная за размерную на '+T('dim.ext'),'выходит на '+mm(beyond)+' мм',a.tip); }); });
  /* размерная линия — не ближе 10 мм к параллельной линии контура (снаружи изображения) и 7 мм к параллельной размерной */
  const contour=segAll.filter(q=>q.it.view>=0&&q.it.kind==='thick');
  const CG=grid(contour,10*k);
  dims.forEach(d=>{ const hv=Math.abs(d.u[1])<1e-3?'h':Math.abs(d.u[0])<1e-3?'v':null; if(!hv) return;
    const lo=hv==='h'?Math.min(d.q.a[0],d.q.b[0]):Math.min(d.q.a[1],d.q.b[1]), hi=hv==='h'?Math.max(d.q.a[0],d.q.b[0]):Math.max(d.q.a[1],d.q.b[1]), c=hv==='h'?d.q.a[1]:d.q.a[0];
    const VS=[FV,LV,TV].filter(Boolean), inside=w=>hv==='h'?c>=w.b[1]-0.5*k&&c<=w.b[3]+0.5*k&&hi>w.b[0]&&lo<w.b[2]:c>=w.b[0]-0.5*k&&c<=w.b[2]+0.5*k&&hi>w.b[1]&&lo<w.b[3];
    if(VS.some(inside)) return;   /* размер внутри изображения — правило о 10 мм к нему не относится */
    const gap=w=>hv==='h'?Math.min(Math.abs(c-w.b[1]),Math.abs(c-w.b[3])):Math.min(Math.abs(c-w.b[0]),Math.abs(c-w.b[2]));
    const w=VS.filter(w=>hv==='h'?lo>=w.b[0]-1*k&&hi<=w.b[2]+1*k:lo>=w.b[1]-1*k&&hi<=w.b[3]+1*k).sort((x,y)=>gap(x)-gap(y))[0]; if(!w) return;
    let best=Infinity; contour.filter(q=>w.ids.includes(q.it.view)).forEach(q=>{ const par=hv==='h'?Math.abs(q.a[1]-q.b[1])<0.05*k:Math.abs(q.a[0]-q.b[0])<0.05*k; if(!par) return;
      const a=hv==='h'?Math.min(q.a[0],q.b[0]):Math.min(q.a[1],q.b[1]), b=hv==='h'?Math.max(q.a[0],q.b[0]):Math.max(q.a[1],q.b[1]); if(b<lo+0.5*k||a>hi-0.5*k) return;
      const dd=Math.abs((hv==='h'?q.a[1]:q.a[0])-c); if(dd<best) best=dd; });
    if(best<N('dim.contour')*k-0.3*k) add(GS('dim.contour'),'размерная линия ≥ '+T('dim.contour')+' от контура',mm(best)+' мм',[(d.q.a[0]+d.q.b[0])/2,(d.q.a[1]+d.q.b[1])/2]); });
  for(let i=0;i<dims.length;i++) for(let j=i+1;j<dims.length;j++){ const A=dims[i], B=dims[j]; if(Math.abs(A.u[0]*B.u[1]-A.u[1]*B.u[0])>1e-3) continue;
    const off=Math.abs((B.q.a[0]-A.q.a[0])*A.u[1]-(B.q.a[1]-A.q.a[1])*A.u[0]); if(off<0.2*k||off>=N('dim.par')*k-0.3*k) continue;
    const pa=[A.q.a,A.q.b].map(p=>p[0]*A.u[0]+p[1]*A.u[1]), pb=[B.q.a,B.q.b].map(p=>p[0]*A.u[0]+p[1]*A.u[1]);
    if(Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb))>1*k) add(GS('dim.par'),'параллельные размерные — не ближе '+T('dim.par'),mm(off)+' мм',A.q.a); }
  /* масштаб 1:1: число линейного размера = расстояние между стрелками */
  /* число размера — над самой размерной линией (на её продолжении, если стрелки снаружи), вдоль неё */
  const numOf=d=>{ const a=d.q.a, u=d.u, lo=Math.min(0,(d.q.b[0]-a[0])*u[0]+(d.q.b[1]-a[1])*u[1]), hi=Math.max(0,(d.q.b[0]-a[0])*u[0]+(d.q.b[1]-a[1])*u[1]);
    const ang=((Math.atan2(u[1],u[0])*180/Math.PI)%180+180)%180;
    return nums.filter(t=>!/[°]/.test(t.s)).map(t=>{ const v=[t.c[0]-a[0],t.c[1]-a[1]], s=v[0]*u[0]+v[1]*u[1], n=Math.abs(v[0]*u[1]-v[1]*u[0]), ta=((t.rot%180)+180)%180;
      return {t,n,s,sc:n+Math.max(0,lo-s,s-hi),ok:n<6*k&&s>=lo-40*k&&s<=hi+40*k&&Math.min(Math.abs(ta-ang),180-Math.abs(ta-ang))<5}; }).filter(x=>x.ok).sort((x,y)=>x.sc-y.sc)[0]; };
  dims.forEach(d=>{ d.num=numOf(d); });
  dims.forEach(d=>{ if(d.tips.length<2) return; const a=d.tips[0].tip, b=d.tips[d.tips.length-1].tip, L=dist(a,b)/k;
    const hit=d.num; if(!hit) return; const t=hit.t;
    const v=parseFloat(t.s.replace(/^\d+\s*отв\.\s*/,'').replace(/[ØR⌀\s]/g,'').replace(',','.')); if(isNaN(v)||L<1) return;
    if(Math.abs(v-L)>0.3) add('2.302','масштаб 1:1','размер «'+t.s+'» на листе '+R(L,1)+' мм',t.c); });

  /* ── ГОСТ 2.305: обозначения разрезов ── */
  const labs=texts.filter(isLab), lets=texts.filter(isLet);
  labs.concat(lets).forEach(t=>{ if(N('let.ban').includes(t.s[0])) add(GS('let.ban'),'буквы обозначений','буква «'+t.s[0]+'» не применяется ('+N('let.ban').join(', ')+')',t.c); });
  const marks=openL.map(it=>({it,p:it.polys[0],c:[(it.polys[0][0][0]+it.polys[0][1][0])/2,(it.polys[0][0][1]+it.polys[0][1][1])/2]}));
  marks.forEach(m=>{ const l=lets.filter(t=>dist(t.c,m.c)<18*k).sort((a,b)=>dist(a.c,m.c)-dist(b.c,m.c))[0]; m.L=l?l.s:null;
    if(!l) add(GS('cut.letter'),'буква у штриха разреза','у штриха разомкнутой линии нет буквы',m.c);
    const ar=opArr.size?[...opArr].find(a=>dist(a.tip,m.c)<16*k):null; if(!ar) add(GS('cut.mark'),'стрелка у штриха разреза','у штриха разомкнутой линии нет стрелки (направление взгляда)',m.c); });
  labs.forEach(t=>{ const L=t.s[0], n=marks.filter(m=>m.L===L).length; if(n<2) add(GS('cut.label'),'обозначение разреза','надпись «'+t.s+'», а штрихов с буквой «'+L+'» '+n,t.c); });
  [...new Set(marks.map(m=>m.L).filter(Boolean))].forEach(L=>{ if(!labs.some(t=>t.s[0]===L)) add(GS('cut.label'),'обозначение разреза','штрихи с буквой «'+L+'», а надписи «'+L+'–'+L+'» над изображением нет',marks.find(m=>m.L===L).c); });
  { const used=labs.map(t=>t.s[0]); const dup=used.filter((L,i)=>used.indexOf(L)!==i); dup.forEach(L=>add(GS('let.order'),'буквы не повторяются','«'+L+'–'+L+'» дважды',labs.find(t=>t.s[0]===L).c)); }

  /* ── ГОСТ-покрытие: каждый элемент листа выведен из профиля ESKD — толщина и штрихи линии, шаг штриховки, кегль надписи, стрелка.
     Элемент, который не сходится ни с одним типом профиля, нарисован «магическим числом» в обход реестра ГОСТ ── */
  const cov={n:0,ok:0,by:{},stray:[]};
  const put=(m,at,what)=>{ const c=E.classify(m); cov.n++; if(c.ok){ cov.ok++; cov.by[c.type]=(cov.by[c.type]||0)+1; return; }
    cov.stray.push(what); add('ESKD','элемент не выведен из профиля ГОСТ',what+(c.type?' («'+E.TYPES[c.type].n+'»)':'')+': '+c.why.join('; '),at); };
  drawn.forEach(it=>put({kind:'stroke',w:it.sw/k,dash:it.dash&&it.dash.map(v=>v/k),curve:it.curve},it.polys[0][0],it.tag==='rect'?'рамка':'линия'));
  fills.filter(f=>f.pat).forEach(f=>put({kind:'hatch',w:f.pat.lw/k,pitch:f.pat.pitch/k},f.polys[0][0],'штриховка'));
  texts.filter(t=>!opt.draft||/igs-|igl-tb/.test(t.cls)).forEach(t=>put({kind:'text',cls:t.cls,h:t.cap/k},t.c,'«'+t.s+'»'));
  /* стрелка размера или стрелка взгляда у разомкнутой — по длине: стрелка размера бывает и рядом с линией разреза */
  AR.forEach(a=>{ const L=a.len/k; put({kind:Math.abs(L-E.PR.open.arrow)<Math.abs(L-E.PR.dim.arrow)?'cutArrow':'arrow',len:L},a.tip,'стрелка'); });

  /* ── сверка с 3D-моделью ── */
  if(opt.model&&window.NORMO_MODEL) NORMO_MODEL(F,opt.model,{k,FV,LV,TV,segAll,items,fills,hatch,add,opt,axLines:chains,marks,labs});
  return {k,fmt:F.fmt,views:F.views,s:R(s,2),model:F.modelStats,review:F.review||[],cover:{n:cov.n,ok:cov.ok,by:cov.by},issues}; }

window.NORMO={check,flatten};
})();
