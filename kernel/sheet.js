/* ═══════════ Лист задания по ЕСКД: чистовик и черновик ═══════════
   SHEET.ng(r, meta, mode) → SVG листа А3 (книжный, 297 × 420 мм) по решению ядра r = DZR.solve(…):
   • формат и рамка — ГОСТ 2.301: рамка 20 мм слева, 5 мм с остальных сторон; граница формата — тонкой, рамка — основной;
   • основная надпись — ГОСТ 2.104, форма 1 (185 × 55) в правом нижнем углу; масштаб — в своей графе;
   • масштаб — ГОСТ 2.302: 1:1, если чертёж помещается в поле листа, иначе ближайший уменьшения (1:2; 1:2,5; 1:4; 1:5);
   • линии — ГОСТ 2.303: данное и найденное — сплошная основная s = 0,7 мм; построения, линии связи, выносные — сплошная
     тонкая s/3; невидимое — штриховая (штрих 4, промежуток 1,5); оси — штрихпунктирная тонкая;
   • шрифт — ГОСТ 2.304: обозначения точек 5 мм, пояснения 3,5 мм (наклонный);
   • таблица координат заданных точек — слева от основной надписи; условие — вверху; ответ — над таблицей.
   Черновик — то же построение в цвете (синим — построения, красным — результат, зелёным — второй способ), как на сайте:
   по нему удобно проверять ход решения. Единицы чертежа ядра: L.S на 1 мм. */
(function(){
const SH={};
const f=v=>Math.round(v*100)/100;
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const strip=s=>String(s==null?'':s).replace(/<sub>(.*?)<\/sub>/g,(m,a)=>a.split('').map(c=>({'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','t':'ₜ','x':'ₓ','y':'ᵧ'}[c]||c)).join('')).replace(/<br\s*\/?>/g,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const INK='#111';
/* стили линий: [цвет, толщина мм, штрих] */
const ST={
  final:{ main:[INK,.7], res:[INK,.7], grn:[INK,.25], aux:[INK,.25], thin:[INK,.25], dim:[INK,.25], conn:[INK,.25],
    hid:[INK,.35,'4 1.5'], dash:[INK,.35,'4 1.5'], resd:[INK,.35,'4 1.5'], grnd:[INK,.35,'4 1.5'], auxd:[INK,.25,'4 1.5'],
    axis:[INK,.25,'14 1.5 0.5 1.5'], paper:['#fff',1.4] },
  draft:{ main:[INK,.6], res:['#d4322c',.6], grn:['#13885a',.45], aux:['#2f6bd8',.3], thin:['#555',.25], dim:['#2f6bd8',.25], conn:['#8fb0e3',.25],
    hid:[INK,.35,'4 1.5'], dash:[INK,.35,'4 1.5'], resd:['#d4322c',.4,'4 1.5'], grnd:['#13885a',.4,'4 1.5'], auxd:['#2f6bd8',.3,'4 1.5'],
    axis:[INK,.25,'14 1.5 0.5 1.5'], paper:['#fff',1.4] } };
const PTC={final:{res:INK,aux:INK,grn:INK},draft:{res:'#d4322c',aux:'#2f6bd8',grn:'#13885a'}};

/* ── чертёж (сцена ядра) → SVG в мм: T(q) — перевод точки, sc — масштаб ── */
function draw(items,T,sc,mode,occ){ const S=L.S, out=[], st=ST[mode], lab=[], u=sc/S;
  const sty=k=>st[k||'main']||st.main;
  const line=(a,b,k,w)=>{ const s=sty(k); if(!s) return; const A=T(a), B=T(b); out.push(`<line x1="${f(A[0])}" y1="${f(A[1])}" x2="${f(B[0])}" y2="${f(B[1])}" stroke="${s[0]}" stroke-width="${w||s[1]}"${s[2]?` stroke-dasharray="${s[2]}"`:''} stroke-linecap="${s[2]?'butt':'round'}"/>`); occ.segs.push([A,B]); };
  const path=(pts,k,close)=>{ const s=sty(k); if(!s||pts.length<2) return; const P=pts.map(T); out.push(`<path d="M${P.map(p=>f(p[0])+' '+f(p[1])).join(' L')}${close?' Z':''}" fill="none" stroke="${s[0]}" stroke-width="${s[1]}"${s[2]?` stroke-dasharray="${s[2]}"`:''} stroke-linejoin="round"/>`); for(let i=1;i<P.length;i++) occ.segs.push([P[i-1],P[i]]); };
  const unit=d=>{ const l=Math.hypot(d[0],d[1])||1; return [d[0]/l,d[1]/l]; };
  const ext=(a,b,e0,e1)=>{ const d=unit([b[0]-a[0],b[1]-a[1]]); return [[a[0]-d[0]*e0,a[1]-d[1]*e0],[b[0]+d[0]*e1,b[1]+d[1]*e1]]; };
  const DIR={ne:[1,-1],nw:[-1,-1],se:[1,1],sw:[-1,1],n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
  items.forEach(it=>{ if(!it) return; const k=it.k;
    switch(it.t){
      case 'seg': if(k==='ghost') break; line(it.a,it.b,k); if(it.l&&k!=='paper') lab.push({at:it.lat||[(it.a[0]+it.b[0])/2,(it.a[1]+it.b[1])/2],l:it.l,la:it.la,k,sz:3.5}); break;
      case 'line': { if(k==='ghost') break; const [a,b]=ext(it.a,it.b,it.e0===undefined?14:it.e0,it.e1===undefined?14:it.e1); line(a,b,k); if(it.l) lab.push({at:b,l:it.l,la:it.la,k,sz:3.5}); break; }
      case 'vec': line(it.a,it.b,k||'aux'); break;
      case 'conn': if(it.p) path(it.p,'conn'); else line(it.a,it.b,'conn'); break;
      case 'ext': line(it.a,it.b,'dim'); break;
      case 'poly': path(it.p,k,it.close); break;
      case 'curve': path(it.p,k,it.close); break;
      case 'circ': { const s=sty(k||'main'); const C=T(it.c); out.push(`<circle cx="${f(C[0])}" cy="${f(C[1])}" r="${f(it.r*u)}" fill="none" stroke="${s[0]}" stroke-width="${s[1]}"${s[2]?` stroke-dasharray="${s[2]}"`:''}/>`); break; }
      case 'arc': { const n=Math.max(8,Math.ceil(Math.abs(it.a2-it.a1)/4)), ps=[]; for(let i=0;i<=n;i++){ const a=(it.a1+(it.a2-it.a1)*i/n)*Math.PI/180; ps.push([it.c[0]+Math.cos(a)*it.r,it.c[1]-Math.sin(a)*it.r]); } path(ps,k||'main'); break; }
      case 'ell': { const r=(it.rot||0)*Math.PI/180, cr=Math.cos(r), sr=Math.sin(r), ps=[]; for(let i=0;i<=72;i++){ const a=i/72*2*Math.PI, x=Math.cos(a)*it.rx, y=Math.sin(a)*it.ry; ps.push([it.c[0]+x*cr-y*sr,it.c[1]+x*sr+y*cr]); } path(ps,k||'main',true); break; }
      case 'pt': { const P=T(it.at), c=(PTC[mode][k])||INK; if(!it.nodot) out.push(`<circle cx="${f(P[0])}" cy="${f(P[1])}" r="${it.hollow?.7:.55}" fill="${it.hollow?'#fff':c}" stroke="${c}" stroke-width=".25"/>`); occ.dots.push(P);
        if(it.l) lab.push({at:it.at,l:it.l,la:it.la,k,sz:5,pt:true}); break; }
      case 'txt': if(mode==='final'&&/\s/.test(strip(it.s).trim())) break;   /* на чистовике — только обозначения (h″, f″, β), пояснения — в ответе */
        lab.push({at:it.at,l:it.s,k,sz:3.5,fixed:[(it.dx||0)/L.S,(it.dy||0)/L.S],anchor:it.anchor||'start'}); break;
      case 'sq': { const v=it.at, d1=unit([it.p1[0]-v[0],it.p1[1]-v[1]]), d2=unit([it.p2[0]-v[0],it.p2[1]-v[1]]), s=2.5*S/sc;
        const p1=[v[0]+d1[0]*s,v[1]+d1[1]*s], p3=[v[0]+d2[0]*s,v[1]+d2[1]*s], p2=[v[0]+(d1[0]+d2[0])*s,v[1]+(d1[1]+d2[1])*s]; line(p1,p2,'thin'); line(p2,p3,'thin'); break; }
      case 'tick': { const m=[(it.a[0]+it.b[0])/2,(it.a[1]+it.b[1])/2], d=unit([it.b[0]-it.a[0],it.b[1]-it.a[1]]), nn=[-d[1],d[0]], cnt=it.n||1, g=1.1*S/sc, h=1.4*S/sc;
        for(let i=0;i<cnt;i++){ const o=(i-(cnt-1)/2)*g, c=[m[0]+d[0]*o,m[1]+d[1]*o]; line([c[0]-nn[0]*h,c[1]-nn[1]*h],[c[0]+nn[0]*h,c[1]+nn[1]*h],'thin'); } break; }
      case 'dim': { const A=T(it.a), B=T(it.b), s=sty('dim'), d=unit([B[0]-A[0],B[1]-A[1]]), ar=(P,dd)=>{ const n=[-dd[1],dd[0]], q=[P[0]-dd[0]*2.5,P[1]-dd[1]*2.5]; return `<path d="M${f(P[0])} ${f(P[1])} L${f(q[0]+n[0]*.6)} ${f(q[1]+n[1]*.6)} L${f(q[0]-n[0]*.6)} ${f(q[1]-n[1]*.6)} Z" fill="${s[0]}"/>`; };
        out.push(`<line x1="${f(A[0])}" y1="${f(A[1])}" x2="${f(B[0])}" y2="${f(B[1])}" stroke="${s[0]}" stroke-width="${s[1]}"/>`+ar(B,d)+ar(A,[-d[0],-d[1]])); occ.segs.push([A,B]);
        if(it.l) lab.push({at:[(it.a[0]+it.b[0])/2,(it.a[1]+it.b[1])/2],l:it.l,la:it.la,k:'dim',sz:3.5}); break; }
      case 'ang': { const v=T(it.at), r=Math.max(5,(it.r||20)/S*sc), a1=Math.atan2(T(it.p1)[1]-v[1],T(it.p1)[0]-v[0]), a2=Math.atan2(T(it.p2)[1]-v[1],T(it.p2)[0]-v[0]);
        let d=a2-a1; while(d<-Math.PI) d+=2*Math.PI; while(d>Math.PI) d-=2*Math.PI; const P1=[v[0]+Math.cos(a1)*r,v[1]+Math.sin(a1)*r], P2=[v[0]+Math.cos(a2)*r,v[1]+Math.sin(a2)*r], s=sty('thin');
        const c=mode==='draft'?(k==='aux'?'#2f6bd8':k==='grn'?'#13885a':'#d4322c'):INK;
        out.push(`<path d="M${f(P1[0])} ${f(P1[1])} A${f(r)} ${f(r)} 0 0 ${d>0?1:0} ${f(P2[0])} ${f(P2[1])}" fill="none" stroke="${c}" stroke-width="${s[1]}"/>`);
        if(it.l){ const am=a1+d/2, R=r+3.2; lab.push({abs:[v[0]+Math.cos(am)*R,v[1]+Math.sin(am)*R+1.2],l:it.l,k,sz:3.5,anchor:'middle'}); } break; }
      case 'note': lab.push({at:it.at,l:it.s,k:'aux',sz:3.5,anchor:'middle',fixed:[0,0]}); break;
      default: break; } });
  return {svg:out.join(''),lab}; }

/* подписи: из восьми положений вокруг точки — то, где меньше всего наложений (на другие подписи, точки и линии) */
function labels(lab,T,mode,occ){ const out=[], boxes=[], DIR={ne:[1,-1],nw:[-1,-1],se:[1,1],sw:[-1,1],n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
  const W=(s,sz)=>[...String(s)].reduce((a,c)=>a+(/[″′‴₀-₉ₜ̄]/.test(c)?0.32:/[ ,.;:()]/.test(c)?0.4:/[0-9]/.test(c)?0.55:0.62),0)*sz;
  const hitSeg=(b,g)=>{ const [p,q]=g; if(Math.max(p[0],q[0])<b[0]||Math.min(p[0],q[0])>b[2]||Math.max(p[1],q[1])<b[1]||Math.min(p[1],q[1])>b[3]) return false;
    const N=8; for(let i=0;i<=N;i++){ const x=p[0]+(q[0]-p[0])*i/N, y=p[1]+(q[1]-p[1])*i/N; if(x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]) return true; } return false; };
  const cost=b=>{ let c=0; boxes.forEach(o=>{ if(b[0]<o[2]&&b[2]>o[0]&&b[1]<o[3]&&b[3]>o[1]) c+=50; }); occ.dots.forEach(d=>{ if(d[0]>b[0]-.6&&d[0]<b[2]+.6&&d[1]>b[1]-.6&&d[1]<b[3]+.6) c+=20; }); occ.segs.forEach(g=>{ if(hitSeg(b,g)) c+=3; }); return c; };
  /* сначала точки (их подписи важнее), потом остальное */
  lab.sort((a,b)=>(b.pt?1:0)-(a.pt?1:0)).forEach(o=>{ const txt=strip(o.l); if(!txt) return; const w=W(txt,o.sz), h=o.sz*0.78;
    let x,y,anchor='start';
    if(o.abs){ x=o.abs[0]; y=o.abs[1]; anchor=o.anchor||'middle'; }
    else if(o.fixed){ const P=T(o.at); x=P[0]+o.fixed[0]; y=P[1]+o.fixed[1]; anchor=o.anchor||'start'; }
    else { const P=T(o.at), pref=DIR[o.la]||DIR.ne; let best=null, bc=1e9;
      const cand=[pref].concat(Object.values(DIR).filter(d=>d!==pref));
      cand.forEach((d,ci)=>{ for(const r of [1.2,2.6]){ const cx=P[0]+d[0]*r, cy=P[1]+d[1]*r, bx=d[0]>0?cx:d[0]<0?cx-w:cx-w/2, by=d[1]<0?cy-h:d[1]>0?cy:cy-h/2, b=[bx,by,bx+w,by+h];
        const c=cost(b)+ci*0.6+(r>2?1:0); if(c<bc){ bc=c; best={b,x:bx,y:by+h}; } } });
      x=best.x; y=best.y; anchor='start'; }
    const b=anchor==='middle'?[x-w/2,y-h,x+w/2,y]:anchor==='end'?[x-w,y-h,x,y]:[x,y-h,x+w,y]; boxes.push(b);
    const c=mode==='draft'?(o.k==='res'||o.k==='resd'?'#d4322c':o.k==='aux'||o.k==='auxd'||o.k==='dim'?'#2f6bd8':o.k==='grn'?'#13885a':INK):INK;
    out.push(`<text x="${f(x)}" y="${f(y)}" font-size="${o.sz}" fill="${c}" font-style="italic" text-anchor="${anchor}">${esc(txt)}</text>`); });
  return out.join(''); }

/* габарит сцены в единицах чертежа */
function bboxOf(items){ const B=[1e9,1e9,-1e9,-1e9], add=p=>{ if(!p||!isFinite(p[0])||!isFinite(p[1])) return; B[0]=Math.min(B[0],p[0]); B[1]=Math.min(B[1],p[1]); B[2]=Math.max(B[2],p[0]); B[3]=Math.max(B[3],p[1]); };
  items.forEach(it=>{ if(!it||it.k==='ghost') return; [it.at,it.a,it.b].forEach(add); (it.p||[]).forEach(add); if(it.c&&it.r){ add([it.c[0]-it.r,it.c[1]-it.r]); add([it.c[0]+it.r,it.c[1]+it.r]); }
    if(it.t==='line'){ const d=[it.b[0]-it.a[0],it.b[1]-it.a[1]], l=Math.hypot(...d)||1, e0=it.e0===undefined?14:it.e0, e1=it.e1===undefined?14:it.e1; add([it.a[0]-d[0]/l*e0,it.a[1]-d[1]/l*e0]); add([it.b[0]+d[0]/l*e1,it.b[1]+d[1]/l*e1]); } });
  return B; }

/* основная надпись, форма 1 (185 × 55), правый нижний угол рамки (x1, y1) */
function stamp(x1,y1,m){ const x0=x1-185, y0=y1-55, X=v=>f(x0+v), Y=v=>f(y0+v), Lr=(a,b,c,d,w)=>`<line x1="${X(a)}" y1="${Y(b)}" x2="${X(c)}" y2="${Y(d)}" stroke="${INK}" stroke-width="${w||.25}"/>`;
  const T=(x,y,t,sz,anc)=>`<text x="${X(x)}" y="${Y(y)}" font-size="${sz||2.5}" font-style="italic" fill="${INK}"${anc?` text-anchor="${anc}"`:''}>${esc(t)}</text>`;
  let o=`<rect x="${X(0)}" y="${Y(0)}" width="185" height="55" fill="#fff" stroke="${INK}" stroke-width=".7"/>`;
  o+=Lr(7,0,7,30); [17,40,55].forEach(x=>o+=Lr(x,0,x,55,x===55?.7:.25)); o+=Lr(65,0,65,55,.7);
  for(let r=1;r<11;r++) o+=Lr(0,r*5,65,r*5,r===5||r===6?.7:.25);
  o+=Lr(65,15,185,15,.7)+Lr(65,40,185,40,.7)+Lr(135,15,135,55,.7)+Lr(135,20,185,20,.7)+Lr(135,35,185,35,.7)+Lr(150,15,150,35,.7)+Lr(167,15,167,35,.7)+Lr(140,20,140,35)+Lr(145,20,145,35)+Lr(155,35,155,40);
  [['Изм.',.4,29],['Лист',7.4,29],['№ докум.',17.6,29],['Подпись',40.6,29],['Дата',55.6,29]].forEach(([t,x,y])=>o+=T(x,y,t,2.5));
  [['Разраб.',34],['Пров.',39],['Т. контр.',44],['Н. контр.',49],['Утв.',54]].forEach(([t,y])=>o+=T(.6,y,t,2.5));
  o+=T(136.5,19,'Лит.',2.5)+T(151.5,19,'Масса',2.5)+T(167.5,19,'Масштаб',2.5)+T(137,39,'Лист',2.5)+T(156,39,'Листов',2.5);
  o+=T(125,10,m.course,5,'middle')+T(100,26,m.title,5,'middle')+T(100,34,m.sub||'',3.5,'middle')+T(100,50,'Вариант № '+m.n,5,'middle');
  o+=T(176,30,m.scale,5,'middle')+T(173,39,'1',3.5);
  o+=T(160,46,'МГТУ им. Н. Э. Баумана',2.5,'middle')+T(160,51.5,'Группа ______',2.5,'middle');
  return o; }

/* таблица координат заданных точек: столбец на точку, строки x, y, z (как на листах заданий) */
function dataTable(x0,y0,names,D){ const cw=12, w0=8, rh=7; let o=''; const Wt=w0+cw*names.length, Ht=rh*4;
  const T=(x,y,t,sz)=>`<text x="${f(x)}" y="${f(y)}" font-size="${sz||3.5}" font-style="italic" fill="${INK}" text-anchor="middle">${esc(t)}</text>`;
  o+=`<rect x="${f(x0)}" y="${f(y0)}" width="${f(Wt)}" height="${Ht}" fill="#fff" stroke="${INK}" stroke-width=".5"/>`;
  for(let r=1;r<4;r++) o+=`<line x1="${f(x0)}" y1="${f(y0+r*rh)}" x2="${f(x0+Wt)}" y2="${f(y0+r*rh)}" stroke="${INK}" stroke-width=".25"/>`;
  for(let c=0;c<names.length;c++) o+=`<line x1="${f(x0+w0+c*cw)}" y1="${f(y0)}" x2="${f(x0+w0+c*cw)}" y2="${f(y0+Ht)}" stroke="${INK}" stroke-width=".25"/>`;
  names.forEach((n,c)=>{ o+=T(x0+w0+c*cw+cw/2,y0+rh-2,n,5); ['x','y','z'].forEach((ax,r)=>o+=T(x0+w0+c*cw+cw/2,y0+(r+2)*rh-2,String(D[n][r]).replace('-','−'),3.5)); });
  ['x','y','z'].forEach((ax,r)=>o+=T(x0+w0/2,y0+(r+2)*rh-2,ax.toUpperCase(),3.5));
  return {svg:o,w:Wt,h:Ht}; }

/* перенос строки по ширине (символ ≈ 0,55 высоты шрифта) */
const wrap=(s,maxw,sz)=>{ const words=String(s).split(/\s+/), out=[]; let cur=''; words.forEach(w=>{ const t=cur?cur+' '+w:w; if(t.length*sz*0.56>maxw&&cur){ out.push(cur); cur=w; } else cur=t; }); if(cur) out.push(cur); return out; };

const SCALES=[[1,'1:1'],[1/2,'1:2'],[1/2.5,'1:2,5'],[1/4,'1:4'],[1/5,'1:5']];
/* части разбора, которые идут на лист: одна часть — её итог; части, где следующая продолжает предыдущую (касательная
   плоскость после точек пересечения) — склеиваем; независимые (ДЗ №3: четыре способа) — по клеткам */
function scenesOf(task){ const parts=PLAYER.partsOf(task), sc=p=>PLAYER.scene(p,(p.steps||[]).length).items.filter(Boolean);
  if(parts.length===1) return [sc(parts[0])];
  if(task.n&&/ДЗ №5/.test(task.n)){ const a=sc(parts[0]), b=[].concat(...parts.slice(1).map(p=>(p.steps||[]).flatMap(s=>s.add||[]))); return [a.concat(b)]; }
  return parts.map(sc); }

SH.ng=function(r,meta,mode){ mode=mode==='draft'?'draft':'final'; const task=r.task, scenes=scenesOf(task);
  const W=297, H=420, fx0=20, fy0=5, fx1=292, fy1=415, sx1=fx1, sy1=fy1;
  let o=`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="${INK}" stroke-width=".25"/><rect x="${fx0}" y="${fy0}" width="${fx1-fx0}" height="${fy1-fy0}" fill="none" stroke="${INK}" stroke-width=".7"/>`;
  /* условие */
  const cond=wrap(strip(task.q).replace(/^ДЗ №\d+\S* · вариант \d+\.\s*/,''),fx1-fx0-12,3.5), cy0=fy0+4, ch=cond.length*5+4;
  o+=`<rect x="${fx0+4}" y="${cy0}" width="${fx1-fx0-8}" height="${ch}" fill="none" stroke="${INK}" stroke-width=".25"/>`+cond.map((t,i)=>`<text x="${fx0+7}" y="${f(cy0+5.2+i*5)}" font-size="3.5" font-style="italic" fill="${INK}">${esc(t)}</text>`).join('');
  /* таблица и ответ */
  const names=meta.points||[], tb=names.length?dataTable(fx0+3,sy1-55+(55-28)-3,names,meta.data):{svg:'',w:0,h:0};
  o+=tb.svg;
  const ansLines=strip(task.ans||(PLAYER.partsOf(task).map(p=>((/^\S+\)/.exec(strip(p.l||''))||[''])[0]+' '+strip(p.ans||'')).trim()).filter(Boolean).join('\n'))).split(/\n+/).flatMap(s=>wrap(s.trim(),fx1-fx0-14,3.5)).filter(Boolean).slice(0,12);
  /* поле чертежа: от условия до блока ответа; ответ — над основной надписью во всю ширину; таблица — слева от надписи */
  const ay=sy1-55-4-ansLines.length*4.8;
  o+=`<line x1="${fx0}" y1="${f(ay-1)}" x2="${fx1}" y2="${f(ay-1)}" stroke="${INK}" stroke-width=".25"/>`+ansLines.map((t,i)=>`<text x="${fx0+4}" y="${f(ay+3.6+i*4.8)}" font-size="3.5" font-style="italic" fill="${INK}">${esc(i===0?'Ответ: '+t:t)}</text>`).join('');
  const area=[fx0+3,cy0+ch+4,fx1-3,ay-3];
  /* клетки под части */
  const n=scenes.length, cols=n>1?2:1, rows=Math.ceil(n/cols), cw=(area[2]-area[0])/cols, chh=(area[3]-area[1])/rows;
  /* масштаб — у каждого изображения свой наибольший стандартный, при котором оно помещается в клетку (ГОСТ 2.302);
     если масштабы разные, у изображения пишем «М 1:…», в основной надписи — масштаб большинства */
  /* габарит; на эпюре с осью x в него входит и начало координат O (ось z, y — у O) */
  const BB=scenes.map(it=>{ const B=bboxOf(it); if(it.some(x=>x&&x.t==='axis')){ B[0]=Math.min(B[0],-6*L.S); B[2]=Math.max(B[2],10*L.S); B[1]=Math.min(B[1],-16*L.S); B[3]=Math.max(B[3],16*L.S); } return B; }), S=L.S;
  const scs=BB.map(B=>SCALES.find(s=>(B[2]-B[0])/S*s[0]<=cw-16&&(B[3]-B[1])/S*s[0]<=chh-12)||SCALES[SCALES.length-1]);   /* запас по 8 мм с боков и 6 мм сверху-снизу — под подписи точек */
  const cnt={}; scs.forEach(s=>cnt[s[1]]=(cnt[s[1]]||0)+1); const sc=SCALES.find(s=>cnt[s[1]]===Math.max(...Object.values(cnt)));
  const occ={segs:[],dots:[]}, labs=[];
  scenes.forEach((items,i)=>{ const B=BB[i], s0=scs[i][0], cx=area[0]+(i%cols)*cw, cy=area[1]+Math.floor(i/cols)*chh, w=(B[2]-B[0])/S*s0, h=(B[3]-B[1])/S*s0;
    const ox=cx+(cw-w)/2-B[0]/S*s0, oy=cy+(chh-h)/2-B[1]/S*s0, T=q=>[ox+q[0]/S*s0,oy+q[1]/S*s0];
    /* ось x и ось z/y у точки O — как на листах заданий */
    if(items.some(it=>it&&it.t==='axis')){ const xl=T([B[0],0])[0], xr=T([B[2],0])[0], O=T([0,0]), y0=O[1];
      o+=`<line x1="${f(xl)}" y1="${f(y0)}" x2="${f(xr)}" y2="${f(y0)}" stroke="${INK}" stroke-width=".25"/>`;
      if(O[0]>=xl&&O[0]<=xr+1) o+=`<line x1="${f(O[0])}" y1="${f(y0-14)}" x2="${f(O[0])}" y2="${f(y0+14)}" stroke="${INK}" stroke-width=".25"/>`;
      labs.push({abs:[xl+1,y0-1.5],l:'x',sz:5,anchor:'start',k:'main'},{abs:[O[0]+1.2,y0-1.5],l:'O',sz:5,anchor:'start',k:'main'},{abs:[O[0]+1.2,y0-11],l:'z',sz:5,anchor:'start',k:'main'},{abs:[O[0]+1.2,y0+14],l:'y',sz:5,anchor:'start',k:'main'});
      occ.segs.push([[xl,y0],[xr,y0]]); }
    if(n>1){ const t=strip(PLAYER.partsOf(task)[i].l||''); if(t) labs.push({abs:[cx+2,cy+4],l:t+(scs[i][1]!==sc[1]?'   М '+scs[i][1]:''),sz:3.5,anchor:'start',k:'main'}); }
    const d=draw(items.filter(it=>it&&it.t!=='axis'),T,s0,mode,occ); o+=d.svg; d.lab.forEach(l=>{ l.T=T; labs.push(l); }); });
  /* подписи — после всех линий (знают, где линии) */
  const byT=new Map(); labs.forEach(l=>{ const k=l.T||(q=>q); if(!byT.has(k)) byT.set(k,[]); byT.get(k).push(l); });
  byT.forEach((ls,T)=>{ o+=labels(ls,T,mode,occ); });
  o+=stamp(sx1,sy1,{course:'Начертательная геометрия',title:meta.title,sub:meta.sub,n:meta.n,scale:sc[1]});
  o+=`<text x="${fx1}" y="${H-1.2}" font-size="2.5" font-style="italic" fill="${INK}" text-anchor="end">Формат А3</text>`;
  if(mode==='draft') o+=`<text x="${fx1-4}" y="${f(cy0+ch+4)}" font-size="3.5" fill="#2f6bd8" font-style="italic" text-anchor="end">Черновик — построения в цвете</text>`;
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="'Golos Text',Arial,sans-serif">${o}</svg>`,scale:sc[1],format:'А3'}; };

/* открыть лист для печати в масштабе 100 % (как печатные заготовки сайта) */
SH.print=function(svg,title,fname){ const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>@page{size:A3 portrait;margin:0}html,body{margin:0;background:#fff}svg{display:block;width:297mm;height:420mm;margin:0 auto}.bar{position:fixed;top:10px;right:10px;font:15px Arial,sans-serif;display:flex;gap:8px}.bar button,.bar a{font:inherit;padding:10px 16px;border-radius:10px;border:0;background:#1f47b8;color:#fff;cursor:pointer;text-decoration:none}@media print{.bar{display:none}}@media screen and (max-width:900px){svg{width:100%;height:auto}}</style></head>
<body><div class="bar"><button onclick="print()">Печать (А3, 100 %)</button><a download="${esc(fname||'list')}.svg" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">Скачать SVG</a></div>${svg}</body></html>`;
  try{ const u=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})); const w=window.open(u,'_blank'); if(!w){ const a=document.createElement('a'); a.href=u; a.download=(fname||'list')+'.html'; document.body.appendChild(a); a.click(); a.remove(); } setTimeout(()=>URL.revokeObjectURL(u),60000); }catch(e){} };

self.SHEET=SH;
})();
