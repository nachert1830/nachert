/* ═══════════ Синтетические фото листов ДЗ №2–3 ═══════════
   Лист А3 книжный, всё начерчено студентом карандашом: рамка (с неточностью руки), основная надпись, ось x
   и (не всегда) ось z/y, чертёж — итоговая сцена разбора с сайта (lab/dz/examples.json) с дрожью руки, подписи
   почерком. Начало O ставится в разные места поля. Съёмка — как в lab/synth.js, плюс поворот телефона на
   0/90/180/270° (лист лежит книжно, а снимок может быть повёрнут).
   dzSynth({id:'2'|'2b'|'2c'|'3', seed, level, turn} | {items, …}) → {img, truth:{H (стр. мм → px), O, turn, axis, zAxis, zLine, items}}
   items — своя сцена (мм от O) вместо примера сайта: листы вариантов с ошибками (lab/dz/vsynth.js).
   node lab/dz/synth.js --id=2 --seed=1 --turn=1 --out=файл.png */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('../'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const IMG=lab('img'), {rng,gray,blur,H}=IMG, S=lab('synth'), font=lab('font');
const DS=isNode?require('./sheet.js'):self.LAB.dzsheet;
const EX=isNode?require('./examples.json'):self.LAB.dzExamples;
const v2={add:(a,b)=>[a[0]+b[0],a[1]+b[1]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],mul:(a,k)=>[a[0]*k,a[1]*k],dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]};

/* поворот снимка на k·90° по часовой (телефон держали боком / вверх ногами) */
function turn(im,k){ k=((k%4)+4)%4; if(!k) return {im,M:[1,0,0,0,1,0,0,0,1]}; const W=im.width, Hh=im.height, w=k%2?Hh:W, h=k%2?W:Hh, o=IMG.rgba(w,h);
  for(let y=0;y<Hh;y++) for(let x=0;x<W;x++){ const [X,Y]=k===1?[Hh-1-y,x]:k===2?[W-1-x,Hh-1-y]:[y,W-1-x]; o.data.set(im.data.subarray((y*W+x)*4,(y*W+x)*4+4),(Y*w+X)*4); }
  /* та же карта для координат пикселей (центров) */
  const M=k===1?[0,-1,Hh,1,0,0,0,0,1]:k===2?[-1,0,W,0,-1,Hh,0,0,1]:[0,1,0,-1,0,W,0,0,1];
  return {im:o,M}; }

function dzSynth(o){ o=o||{}; const id=o.id||'2', R=rng(o.seed||1), lv=S.LEVELS[o.level||'normal'], ex=o.items?{items:o.items}:o.groups?{items:[]}:EX[id], page=DS.A3;
  const sheet=new S.Sheet(page.w,page.h,o.res||6); if(o.clean) sheet.cl=new Float32Array(sheet.w*sheet.h);
  const g0=gray(sheet.w,sheet.h); for(let i=0;i<g0.a.length;i++) g0.a[i]=R(); const g1=blur(g0,0.8); sheet.grain=new Float32Array(sheet.w*sheet.h);
  for(let i=0;i<g1.a.length;i++) sheet.grain[i]=Math.max(0.35,Math.min(1,0.7+(g1.a[i]-0.5)*3.2));
  sheet.layer='pencil'; const pen={dk:R.r(...lv.dark),thin:R.r(0.22,0.36),main:R.r(0.45,0.7)}, k=R.r(...lv.hand);
  const line=(a,b,w,dk,dash)=>sheet.stroke([a,b],w,Math.min(0.95,dk),{wob:R.r(0.02,0.06),grain:true,press:true,dash},R);
  /* рамка и основная надпись — рукой: углы рамки ± до 1,5 мм от ГОСТ */
  const F=DS.FRAME, fc=[[F[0],F[1]],[F[2],F[1]],[F[2],F[3]],[F[0],F[3]]].map(p=>v2.add(p,[R.n(0,0.6*k),R.n(0,0.6*k)]));
  for(let i=0;i<4;i++) line(v2.add(fc[i],[-0.5,0]),fc[(i+1)%4],pen.main,pen.dk*1.1);
  DS.titleLines().forEach(([a,b])=>line(a,b,a[0]===b[0]||a[1]===b[1]?pen.thin*1.2:pen.thin,pen.dk*0.9));
  /* один чертёж (своя сцена, своё O): оси x и (не всегда) z/y, сцена с дрожью руки, подписи */
  const labels=[];
  const drawGroup=(items,O)=>{ let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9; items.forEach(it=>['at','a','b'].forEach(f=>{ if(it[f]){ u0=Math.min(u0,it[f][0]); u1=Math.max(u1,it[f][0]); v0=Math.min(v0,it[f][1]); v1=Math.max(v1,it[f][1]); } }));
    if(!O){ const Ox=Math.min(DS.FIELD[2]-12-Math.max(0,u1),R.r(DS.FIELD[0]+20-u0,DS.FIELD[2]-15)), Oy=R.r(DS.FIELD[1]+12-v0,DS.FIELD[3]-12-v1); O=[Ox,Oy]; }
    const P=p=>[O[0]+p[0],O[1]+p[1]];
    const jit=new Map(), J=p=>{ const key=p[0].toFixed(2)+','+p[1].toFixed(2); if(!jit.has(key)) jit.set(key,[R.n(0,0.25*k),R.n(0,0.25*k)]); return v2.add(P(p),jit.get(key)); };
    /* оси: x — через всё поле чертежа; z/y — вертикаль через O (не всегда) */
    const ax=[P([u0-15,0]),P([Math.max(u1,0)+12,0])]; line(ax[0],ax[1],pen.thin,pen.dk*0.9);
    const zAxis=R()<0.75, zLine=zAxis?[P([0,v0-8]),P([0,v1+8])]:null; if(zAxis) line(zLine[0],zLine[1],pen.thin,pen.dk*0.9);
    labels.push({s:'X',at:v2.add(ax[0],[-3,-1.5])}); if(zAxis){ labels.push({s:'Z',at:P([2,v0-6])},{s:'Y',at:P([2,v1+6])}); }
    /* сцена разбора */
    items.forEach(it=>{ const kk=it.k||'main';
      const w=/^(main|res)$/.test(kk)?pen.main:pen.thin, dk=pen.dk*(/^(main|res)$/.test(kk)?1.15:0.85), dash=/d$|^hid$/.test(kk)?[R.r(3,5),R.r(1.2,2),R()*4]:null;
      if((it.t==='seg'||it.t==='line')&&it.a&&it.b) line(J(it.a),J(it.b),w,dk,dash);
      if(it.t==='conn'&&it.a&&it.b) line(J(it.a),J(it.b),pen.thin*0.8,pen.dk*0.7);
      if(it.t==='pt'&&it.at){ if(R()<0.6) sheet.circle(J(it.at),R.r(0.4,0.8),pen.thin,pen.dk,{grain:true},R); if(it.l) labels.push({s:it.l,at:v2.add(J(it.at),[R.r(1,2),R.r(-2.5,-1)])}); }
      if(it.t==='sq'&&it.at&&it.p1&&it.p2){ const u=v2.sub(it.p1,it.at), w2=v2.sub(it.p2,it.at), nu=Math.hypot(...u)||1, nw=Math.hypot(...w2)||1, s=2.5, A=v2.add(J(it.at),v2.mul(u,s/nu)), B=v2.add(J(it.at),v2.mul(w2,s/nw)), C=v2.add(A,v2.mul(w2,s/nw)); sheet.stroke([A,C,B],pen.thin,pen.dk*0.8,{grain:true},R); } });
    return {O,axis:ax,zAxis,zLine}; };
  /* o.groups — несколько чертежей на листе (ДЗ №3: четыре части, у каждой своя копия условия): [{items, O (мм листа)}] */
  const groups=o.groups?o.groups.map(gr=>drawGroup(gr.items,gr.O)):null, g1st=groups?groups[0]:drawGroup(ex.items,null), O=g1st.O, ax=g1st.axis, zAxis=g1st.zAxis, zLine=g1st.zLine;
  labels.forEach(l=>{ const s=String(l.s).split('').filter(c=>font.has(c)).join(''); if(!s) return; sheet.text(s,l.at,R.r(3,4.5),Math.min(0.95,pen.dk*1.1),R.r(0.22,0.35),{rot:R.n(0,0.06),shear:R.n(0.12,0.08),jit:0.02,grain:true},R); });
  /* съёмка: телефон книжно (3:4), затем возможный поворот снимка */
  const sz=o.size||[2250,3000], cam=S.camera(sheet,page,R,lv,sz), tk=o.turn!=null?o.turn:Math.floor(R()*4), tr=turn(cam.im,tk);
  return {img:tr.im,truth:{id,H:IMG.H.norm(IMG.H.mul(tr.M,cam.M)),O,turn:tk,frame:fc,axis:ax,zAxis,zLine,items:ex.items,groups,clean:o.clean?{a:sheet.cl,w:sheet.w,h:sheet.h,px:sheet.px}:null,params:Object.assign(cam.params,{hand:k,level:o.level||'normal'})}}; }

put('dzSynth',{dzSynth,turn});
if(isNode&&require.main===module){ const a=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
  const t0=Date.now(), r=dzSynth({id:a.id||'2',seed:+(a.seed||1),level:a.level,turn:a.turn!=null?+a.turn:undefined});
  require('fs').writeFileSync(a.out||'dz.png',IMG.encodePNG(r.img)); console.log('лист ДЗ '+r.truth.id+', поворот '+r.truth.turn*90+'°, O = '+r.truth.O.map(v=>v.toFixed(1))+', ось z/y: '+r.truth.zAxis+', '+(Date.now()-t0)+' мс'); }
})();
