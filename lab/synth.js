/* ═══════════ Синтетические фото листа ═══════════
   Эталон задачи и его ошибочные варианты «распечатываются» и «фотографируются»:
     1. рука: программа построения (core/cp*.js) исполняется с шумом — угол угольника, сдвиг линейки, перенос
        циркулем, отметка точки; вылет линий за точки, пропуски необязательного, подписи почерком;
     2. лист: напечатанное «дано» и рамка — чёрной краской; построения — карандашом (толщина, нажим, зерно,
        лёгкое дрожание), стёртые линии — бледные следы; бумага белая или в клетку;
     3. съёмка: перспектива (лист под углом), поворот, фон стола, неравномерный свет, тень, расфокус, шум.
      Размер фото — по уровню: easy 3000×2250 (≈ 9–11 px/мм листа), normal 2400×1800 (≈ 6–8), hard 1600×1200 (≈ 4–6,
      где тонкие линии уже на пределе: честный отказ здесь — правильный ответ).
   synth({n, kid, nvid, seed, level}) → {img (RGBA), truth: {cls, H (мм страницы → px фото), scene (мм чертежа), …}}
   node lab/synth.js --kid=front --nv=ok:1A+ --seed=3 [--level=hard] [--out=файл.png] — один лист в PNG. */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const core=n=>isNode?require('../core/'+n+'.js'):((self.CORE&&self.CORE[n])||(self.CERT&&self.CERT[n]));
const lab=n=>isNode?require('./'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const {v2,L2}=core('model'), cp=core('cp');
const IMG=lab('img'), {H,rng,gray,rgba,blur}=IMG, font=lab('font'), {SHEETS,toPage}=lab('sheets');

const LEVELS={
  easy:{size:[3000,2250],hand:[0.5,0.8],tilt:[0,0.04],rot:3,blur:[0.3,0.7],noise:[1,2],light:[0,0.1],shadow:0,erased:[0,1],grid:0,dark:[0.55,0.8],fill:[0.85,0.92]},
  normal:{size:[2400,1800],hand:[0.7,1.4],tilt:[0.01,0.08],rot:8,blur:[0.4,1.1],noise:[1.5,4],light:[0.05,0.25],shadow:0.5,erased:[0,3],grid:0.25,dark:[0.4,0.75],fill:[0.72,0.92]},
  hard:{size:[1600,1200],hand:[1.2,2.0],tilt:[0.04,0.13],rot:14,blur:[0.8,1.6],noise:[3,7],light:[0.15,0.4],shadow:0.8,erased:[1,4],grid:0.4,dark:[0.3,0.6],fill:[0.62,0.85]},
};

/* ── 1. рука студента: исполнение программы с шумом ── */
function hand(prog,given,R,lv){ const k=R.r(...lv.hand), deg=Math.PI/180;
  const rotL=(L,a,off)=>{ const d=v2.rot(L.d,a), n=v2.perp(d); return {p:v2.add(L.p,v2.mul(n,off)),d}; };
  /* необязательное: построение плоскости при ошибках foot1/foot2 — целиком (или есть, или нет); украшения — по отдельности */
  const plane=prog.steps.filter(s=>s.opt&&!['Sh','Sf','h₀γ'].includes(s.id)), planeOn=R()<0.5, skip=new Set();
  prog.steps.forEach(s=>{ if(s.opt&&['Sh','Sf','h₀γ'].includes(s.id)&&R()<0.4) skip.add(s.id); if(plane.includes(s)&&!planeOn) skip.add(s.id); });
  const noise=(st,v)=>{ const op=st.op;
    if(op==='parAxis'||op==='link') return rotL(v,R.n(0,0.35*k)*deg,R.n(0,0.12*k));
    if(op==='perp'||op==='par') return rotL(v,R.n(0,0.6*k)*deg,R.n(0,0.15*k));
    if(op==='through'||op==='seg') return rotL(v,R.n(0,0.15*k)*deg,R.n(0,0.08*k));
    if(op==='meet'||op==='foot') return v2.add(v,[R.n(0,0.12*k),R.n(0,0.12*k)]);
    if(op==='perpOff'||op==='along') return v2.add(v,[R.n(0,0.25*k),R.n(0,0.25*k)]);
    if(op==='dv'||op==='du'||op==='absV'||op==='dist') return v+R.n(0,0.2*k);
    return v; };
  const {E,miss}=cp.exec(prog,given,{noise,skip:s=>skip.has(s.id)});
  const ext=st=>{ const k2=st.draw&&st.draw.k; if(k2==='conn') return [R.r(0,1.5),R.r(0,2.5)]; if(k2==='main') return [0,0]; return [R.r(1,9),R.r(1,9)]; };
  const items=cp.draw(prog,E,{ext}).filter(it=>!skip.has(it.role));
  return {E,miss,items,hand:k}; }

/* ── 2. лист: растр страницы, тёмность 0…1 двух красок (печать, карандаш) ── */
const PX=10;                                                       /* растр страницы: пикселей на мм */
function Sheet(w,h,px){ this.px=px||PX; this.w=Math.round(w*this.px); this.h=Math.round(h*this.px); this.pr=new Float32Array(this.w*this.h); this.pe=new Float32Array(this.w*this.h); this.tmp=new Float32Array(this.w*this.h); this.touched=[]; }
/* штрих — ломаная (мм страницы): ширина w, тёмность dk; o.wob — дрожание поперёк, o.dash — [штрих, промежуток] мм,
   o.grain — зерно графита, o.press — неравномерный нажим */
Sheet.prototype.stroke=function(pts,w,dk,o,R){ o=o||{}; const PXs=this.px, L=this.layer==='print'?this.pr:this.pe, T=this.tmp, tc=[], CL=this.cl&&this.layer!=='print'&&!this.noClean?this.cl:null;
  /* дрожание: дробим ломаную через 2 мм и сдвигаем поперёк гладким шумом */
  let P=[]; if(o.wob){ const ph=[R()*6.3,R()*6.3], f=[R.r(0.15,0.4),R.r(0.6,1.3)];
    let acc=0; for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1], l=v2.dist(a,b), n=Math.max(1,Math.ceil(l/2)), nn=v2.perp(v2.unit(v2.sub(b,a)));
      for(let j=0;j<n;j++){ const t=j/n, s=acc+l*t, off=o.wob*(Math.sin(s*f[0]+ph[0])*0.7+Math.sin(s*f[1]+ph[1])*0.3); P.push(v2.add(v2.lerp(a,b,t),v2.mul(nn,off))); } acc+=l; }
    P.push(pts[pts.length-1]); } else P=pts;
  const press=o.press?[R.r(0.75,1),R.r(0.75,1),R()*6.3,R.r(0.02,0.08)]:null;
  let s0=0; for(let i=0;i<P.length-1;i++){ const a=P[i], b=P[i+1], d=v2.sub(b,a), l2=v2.dot(d,d), l=Math.sqrt(l2)||1e-9, r=w/2+0.15;
    const x0=Math.max(0,Math.floor((Math.min(a[0],b[0])-r)*PXs)), x1=Math.min(this.w-1,Math.ceil((Math.max(a[0],b[0])+r)*PXs));
    const y0=Math.max(0,Math.floor((Math.min(a[1],b[1])-r)*PXs)), y1=Math.min(this.h-1,Math.ceil((Math.max(a[1],b[1])+r)*PXs));
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ const p=[(x+0.5)/PXs,(y+0.5)/PXs], t=Math.max(0,Math.min(1,v2.dot(v2.sub(p,a),d)/l2)), q=v2.add(a,v2.mul(d,t)), dist=v2.dist(p,q);
      let c=Math.max(0,Math.min(1,(w/2-dist)*PXs+0.5)); if(c<=0) continue;
      const s=s0+t*l; if(o.dash){ const per=o.dash[0]+o.dash[1], ph=(s+o.dash[2])%per; if(ph>o.dash[0]) continue; }
      if(press) c*=press[0]+(press[1]-press[0])*(0.5+0.5*Math.sin(s*press[3]+press[2]));
      const i2=y*this.w+x; if(T[i2]===0) tc.push(i2); if(c>T[i2]) T[i2]=c;
      /* чистая правда для обучения очистителя (lab/dz/cleaner): где лежит линия карандаша — без нажима, зерна, тёмности */
      if(CL&&c>CL[i2]) CL[i2]=c; }
    s0+=l; }
  for(const i2 of tc){ let c=T[i2]*dk; if(o.grain) c*=this.grain[i2]; L[i2]=1-(1-L[i2])*(1-c); T[i2]=0; } };
/* подписи и кружки-метки в чистую правду не входят: очиститель оставляет только линии */
Sheet.prototype.text=function(str,at,size,dk,w,o,R){ const lay=font.layout(str,at,size,o), nc=this.noClean; this.noClean=true; lay.strokes.forEach(pl=>{
    const P=o&&o.jit?pl.map(p=>[p[0]+R.n(0,o.jit*size),p[1]+R.n(0,o.jit*size)]):pl; this.stroke(P,w,dk,{grain:!!(o&&o.grain)},R); }); this.noClean=nc; return lay.width; };
Sheet.prototype.circle=function(c,r,w,dk,o,R){ const P=[]; for(let i=0;i<=20;i++){ const a=i/20*2*Math.PI; P.push([c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)]); } const nc=this.noClean; this.noClean=true; this.stroke(P,w,dk,o,R); this.noClean=nc; };

/* ── 3. камера: гомография страница → фото, свет, тень, расфокус, шум ── */
/* opt.glare (0…1): вероятность блика — пятно, где свет отражается от графита и бумаги и линии бледнеют (лампа над листом);
   только по явному запросу: остальные тесты идут на прежних случайных потоках */
function camera(sheet,page,R,lv,size,opt){ const [W,Hh]=size; opt=opt||{};
  const rot=R.n(0,lv.rot/2)*Math.PI/180, fill=R.r(...lv.fill), sc=Math.min(W/page.w,Hh/page.h)*fill;
  const c=[W/2+R.n(0,W*0.03),Hh/2+R.n(0,Hh*0.03)], corners=[[0,0],[page.w,0],[page.w,page.h],[0,page.h]];
  const tilt=R.r(...lv.tilt), dir=R()*2*Math.PI, dst=corners.map(p=>{ const q=v2.rot([(p[0]-page.w/2)*sc,(p[1]-page.h/2)*sc],rot);
      /* наклон телефона: дальний край страницы меньше — сжатие вдоль направления dir */
      const along=(q[0]*Math.cos(dir)+q[1]*Math.sin(dir))/(Math.max(page.w,page.h)*sc/2), k=1-tilt*along;
      return [c[0]+q[0]*k+R.n(0,W*0.004),c[1]+q[1]*k+R.n(0,W*0.004)]; });
  const M=H.fit(corners,dst), Mi=H.inv(M);
  /* фон стола, бумага, свет */
  const bg=R.pick([[0.42,0.3,0.2],[0.3,0.3,0.32],[0.55,0.52,0.48],[0.18,0.2,0.26],[0.62,0.45,0.3]]), paper=[R.r(0.9,0.97),R.r(0.89,0.96),R.r(0.84,0.94)];
  const gx=R.n(0,lv.light[1]), gy=R.n(0,lv.light[1]), base=R.r(0.8,1.02), vig=R.r(0,lv.light[1]);
  const sh=R()<lv.shadow?{p:[R.r(0,W),R.r(0,Hh)],n:v2.rot([1,0],R()*6.3),k:R.r(0.5,0.8),soft:R.r(15,70)}:null;
  const cast=[1+R.n(0,0.03),1+R.n(0,0.02),1+R.n(0,0.04)], graphite=[0.9,0.92,1.0];
  const gl=opt.glare&&R()<opt.glare?{p:[R.r(0.15,0.85)*W,R.r(0.15,0.85)*Hh],s:R.r(0.06,0.16)*Math.min(W,Hh),k:R.r(0.5,0.85)}:null;
  const im=rgba(W,Hh), d=im.data, ch=[gray(W,Hh),gray(W,Hh),gray(W,Hh)], tex=R();
  const S=(L,x,y)=>{ const x0=Math.floor(x), y0=Math.floor(y); if(x0<0||y0<0||x0>=sheet.w-1||y0>=sheet.h-1) return 0; const fx=x-x0, fy=y-y0, i=y0*sheet.w+x0;
    return (L[i]*(1-fx)+L[i+1]*fx)*(1-fy)+(L[i+sheet.w]*(1-fx)+L[i+sheet.w+1]*fx)*fy; };
  for(let y=0;y<Hh;y++) for(let x=0;x<W;x++){ const p=H.apply(Mi,[x+0.5,y+0.5]), i=y*W+x;
    let col; if(p[0]>=0&&p[1]>=0&&p[0]<=page.w&&p[1]<=page.h){ const sx=p[0]*sheet.px-0.5, sy=p[1]*sheet.px-0.5, pr=S(sheet.pr,sx,sy), pe=S(sheet.pe,sx,sy), gr=sheet.gridAt?S(sheet.grid,sx,sy):0;
        col=[0,1,2].map(j=>paper[j]*(1-0.93*pr)*(1-pe*graphite[j])*(1-gr*[0.35,0.18,0.02][j])); }
    else { const n=((Math.sin(x*0.05+tex*9)*Math.sin(y*0.031+tex*5)+1)*0.04); col=bg.map(v=>v*(0.92+n)); }
    const ux=(x-W/2)/W, uy=(y-Hh/2)/Hh; let L=base*(1+gx*ux+gy*uy)*(1-vig*(ux*ux+uy*uy)*2);
    if(sh){ const s=v2.dot(v2.sub([x,y],sh.p),sh.n); L*=1-(1-sh.k)/(1+Math.exp(-s/sh.soft*4)); }
    if(gl){ const r2=((x-gl.p[0])**2+(y-gl.p[1])**2)/(2*gl.s*gl.s); if(r2<9){ const q=gl.k*Math.exp(-r2); for(let j=0;j<3;j++) ch[j].a[i]=(col[j]*L*cast[j])*(1-q)+q*1.05; continue; } }
    for(let j=0;j<3;j++) ch[j].a[i]=col[j]*L*cast[j]; }
  const bl=R.r(...lv.blur), nz=R.r(...lv.noise)/255;
  for(let j=0;j<3;j++){ const b=blur(ch[j],bl); for(let i=0;i<W*Hh;i++) d[4*i+j]=Math.max(0,Math.min(255,(b.a[i]+R.n(0,nz))*255)); }
  for(let i=0;i<W*Hh;i++) d[4*i+3]=255;
  return {im,M,params:{rot:rot*180/Math.PI,fill,tilt,blur:bl,noise:nz*255,shadow:!!sh,glare:gl,light:[gx,gy,base,vig]}}; }

/* «неизвестное построение» — ошибка, которой нет в библиотеке сканера (проверка честного отказа):
   u-hrot — h′ под произвольным углом к a′ (12…35° от перпендикуляра); u-Kshift — K′ взята на a′ наугад (4…10 мм от верной) */
function unknown(C,kid,nvid,given,R){ const {edit}=cp, base=C.program(C.POPT?'ok':'front',nvid);
  /* № 46: u-5shift — 5′ взята на D′F′ наугад (3…8 мм от верной); u-vpiece — видимость одного участка перепутана */
  if(kid==='u-5shift'){ const s=(R()<0.5?-1:1)*R.r(3,8); let q=edit.replace(base,'5′',{id:'5c'}); q.steps.find(x=>x.id==='5c').draw=null;
    q=edit.insertAfter(q,'5c',[{id:'5s',op:'shiftU',args:['5c',s]},{id:'l5s',op:'link',args:['5s']},{id:'5′',op:'meet',args:['l5s','DF′'],draw:{}}]);
    q.steps.find(x=>x.id==='m12').draw.span=['1′','2′','5c']; return q; }
  if(kid==='u-vpiece') return base;
  if(kid==='u-hrot'){ const a=(R()<0.5?-1:1)*R.r(12,35)*Math.PI/180; given.aRot={p:given['a′'].p,d:v2.rot(given['a′'].d,a)};
    return edit.replace(base,'h′',{args:['aRot','A′']}); }
  if(kid==='u-Kshift'){ const s=(R()<0.5?-1:1)*R.r(4,10); let q=edit.replace(base,'K′',{id:'Kc'}); q.steps.find(x=>x.id==='Kc').draw=null;
    q=edit.insertAfter(q,'Kc',[{id:'Ks',op:'shiftU',args:['Kc',s]},{id:'lks',op:'link',args:['Ks']},{id:'K′',op:'meet',args:['lks','a′'],draw:{}}]);
    q.steps.find(x=>x.id==='m').draw.span=['1′','2′','Kc']; return q; }
  throw new Error('нет такого неизвестного: '+kid); }

/* ── всё вместе ── */
function synth(o){ o=o||{}; const n=o.n||47, R=rng(o.seed||1), lv=LEVELS[o.level||'normal'], SH=SHEETS[n];
  const C=core('cp'+n), G=SH.G(), given=C.given(G), prog=/^u-/.test(o.kid||'')?unknown(C,o.kid,o.nvid,given,rng((o.seed||1)*7+3)):C.program(o.kid||(n===46?'ok':'front'),o.nvid||(n===46?'ok':'ok:1A+'));
  const st=hand(prog,given,R,lv), page=SH.page, sheet=new Sheet(page.w,page.h);
  /* № 46: обводка сторон по узору видимости (основная / штриховая), стыки — с дрожью руки */
  let vis=null; if(C.pattern){ vis=C.pattern(G,o.nvid||'ok');
    if(o.kid==='u-vpiece'){ const ks=Object.keys(vis).filter(k=>vis[k].length>1), k=ks[Math.floor(R()*ks.length)], i=Math.floor(R()*vis[k].length); vis[k][i][2]=vis[k][i][2]==='main'?'hid':'main'; }
    Object.entries(vis).forEach(([k,seq])=>{ const a=k[0]+k[2], b=k[1]+k[2]; seq.forEach(pc=>{ const L=v2.dist(given[a],given[b]); pc.p=[pc[0]===0?0:pc[0]+R.n(0,0.5*st.hand)/L,pc[1]===1?1:pc[1]+R.n(0,0.5*st.hand)/L].map(t=>Math.max(0,Math.min(1,t))); pc.A=v2.lerp(given[a],given[b],pc.p[0]); pc.B=v2.lerp(given[a],given[b],pc.p[1]); }); }); }
  /* зерно графита */
  const g0=gray(sheet.w,sheet.h); for(let i=0;i<g0.a.length;i++) g0.a[i]=R(); const g1=blur(g0,0.8); sheet.grain=new Float32Array(sheet.w*sheet.h);
  for(let i=0;i<g1.a.length;i++) sheet.grain[i]=Math.max(0.35,Math.min(1,0.7+(g1.a[i]-0.5)*3.2));
  /* клетка */
  if(R()<lv.grid){ sheet.gridAt=true; sheet.grid=new Float32Array(sheet.w*sheet.h); const ph=[R()*5,R()*5], dk=R.r(0.25,0.55);
    for(let y=0;y<sheet.h;y++) for(let x=0;x<sheet.w;x++){ const u=(x/PX+ph[0])%5, v=(y/PX+ph[1])%5, dd=Math.min(u,5-u,v,5-v); if(dd<0.1) sheet.grid[y*sheet.w+x]=dk*(1-dd/0.1); } }
  const P=p=>toPage(SH,p);
  /* печать: рамка, заголовок, «дано» */
  sheet.layer='print'; const fr=SH.frame;
  sheet.stroke([[fr[0],fr[1]],[fr[2],fr[1]],[fr[2],fr[3]],[fr[0],fr[3]],[fr[0],fr[1]]],0.6,1,{},R);
  const words=['A','B','C','D','E','F','K','h','f','a','x']; let tx=16;
  sheet.text(n+'.',[tx,24],3.2,1,0.35,{},R); tx+=10; while(tx<126){ const wl=1+Math.floor(R()*4); let s=''; for(let i=0;i<wl;i++) s+=R.pick(words); tx+=sheet.text(s,[tx,24],2.6,0.9,0.3,{},R)+2.2; }
  const g0p=SH.given(); g0p.forEach(it=>{ if(it.t==='seg') sheet.stroke([P(it.a),P(it.b)],it.k==='main'?0.45:0.25,1,{},R);
    if(it.t==='conn') sheet.stroke([P(it.a),P(it.b)],0.18,0.9,{dash:[4,1.2,0]},R);
    if(it.t==='pt'){ sheet.circle(P(it.at),0.75,0.25,1,{},R); } });
  g0p.filter(it=>it.t==='txt').forEach(it=>sheet.text(it.s,P(it.at),it.size,1,0.3,{},R));
  /* карандаш: стёртое, построения, подписи */
  sheet.layer='pencil'; const pen={dk:R.r(...lv.dark),thin:R.r(0.22,0.38),main:R.r(0.45,0.75)}, roi=SH.roi;
  const nE=Math.round(R.r(lv.erased[0],lv.erased[1]+0.99)-0.49); for(let i=0;i<nE;i++){ const a=[R.r(roi[0],roi[2]),R.r(roi[1],roi[3])], b=v2.add(a,v2.mul(v2.rot([1,0],R()*6.3),R.r(10,45)));
    sheet.stroke([P(a),P(b)],R.r(0.5,1.2),R.r(0.05,0.12),{grain:true},R); }
  if(vis) Object.values(vis).forEach(seq=>seq.forEach(pc=>{ const off=v2.mul(v2.perp(v2.unit(v2.sub(pc.B,pc.A))),R.n(0,0.08)); if(v2.dist(pc.A,pc.B)<0.8) return;
    sheet.stroke([P(v2.add(pc.A,off)),P(v2.add(pc.B,off))],pc[2]==='main'?pen.main:pen.main*0.8,Math.min(0.95,pen.dk*(pc[2]==='main'?1.15:1)),{wob:R.r(0.02,0.06),grain:true,press:true,dash:pc[2]==='hid'?[R.r(3,5),R.r(1.2,2),R()*4]:null},R); }));
  const labels=[];
  st.items.forEach(it=>{ if(it.t==='seg'){ const k=it.k; const w=k==='main'?pen.main:k==='conn'?pen.thin*0.8:pen.thin, dk=pen.dk*(k==='main'?1.15:k==='conn'?0.75:0.9);
      sheet.stroke([P(it.a),P(it.b)],w,Math.min(0.95,dk),{wob:R.r(0.02,0.07),grain:true,press:true,dash:k==='hid'?[R.r(3,5),R.r(1,1.8),R()*4]:null},R);
      if(it.l&&R()<0.6) labels.push({s:it.l,at:v2.lerp(it.a,it.b,R.r(0.15,0.85)),role:it.role,line:true}); }
    if(it.t==='pt'){ if(R()<0.5) sheet.circle(P(it.at),R.r(0.4,0.8),pen.thin,pen.dk,{grain:true},R);
      if(R()<0.85) labels.push({s:it.l,at:it.at,role:it.role}); }
    if(it.t==='sq'){ const u=v2.unit(v2.sub(it.p1,it.at)), w=v2.unit(v2.sub(it.p2,it.at)), s=R.r(1.8,3); const A=v2.add(it.at,v2.mul(u,s)), B=v2.add(it.at,v2.mul(w,s)), Cc=v2.add(A,v2.mul(w,s));
      sheet.stroke([P(A),P(Cc),P(B)],pen.thin*0.9,pen.dk*0.8,{grain:true},R); } });
  /* подписи «почерком»: справа-сверху/снизу от точки, наклон, дрожь */
  const placed=[];
  labels.forEach(l=>{ const size=R.r(2.6,3.8), dir=R.pick([[1.2,-1.2],[1.2,2.8],[-3.6,-1.2],[-3.6,2.8]]), at=v2.add(l.at,[dir[0]*size/3+R.n(0,0.3),dir[1]*size/3+R.n(0,0.3)]);
    if(placed.some(p=>v2.dist(p,at)<size*1.1)) return; placed.push(at);
    const w=sheet.text(l.s,P(at),size,Math.min(0.95,pen.dk*1.1),R.r(0.22,0.35),{rot:R.n(0,0.08),shear:R.n(0.12,0.1),jit:0.02,grain:true},R);
    l.box=[at[0],at[1]-size,at[0]+w,at[1]+size*0.3]; l.size=size; });
  const sz=o.size||lv.size, size=R()<0.5?[sz[1],sz[0]]:sz.slice();
  const cam=camera(sheet,page,R,lv,size);
  const scene={units:'mm',items:SH.given().concat(st.items).map(it=>Object.assign({},it))};
  return {img:cam.im,truth:{n,vis,kid:o.kid||'front',nvid:o.nvid||'ok:1A+',cls:/^u-/.test(o.kid||'')?'unknown':C.cls(o.kid||(n===46?'ok':'front'),o.nvid||(n===46?'ok':'ok:1A+')),H:cam.M,O:SH.O,scene,E:st.E,labels,hand:st.hand,pen,params:Object.assign(cam.params,{level:o.level||'normal',erased:nE,grid:!!sheet.gridAt})}}; }

put('synth',{synth,LEVELS,PX,Sheet,camera});

if(isNode&&require.main===module){ const a=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
  const t0=Date.now(), r=synth({n:+(a.n||47),kid:a.kid,nvid:a.nv,seed:+(a.seed||1),level:a.level}); require('fs').writeFileSync(a.out||'synth.png',IMG.encodePNG(r.img));
  console.log('лист: '+r.truth.cls+' ('+r.truth.kid+', '+r.truth.nvid+'), '+(Date.now()-t0)+' мс, '+JSON.stringify(r.truth.params)); }
})();
