/* ═══════════ Синтетические фото листов ДЗ №4 (линии пересечения поверхностей) ═══════════
   Настоящих фото ДЗ №4 нет — лист рисуется по эталону варианта (lk/scan/dz4ref.json, решатель dz/ng/4/solver.js):
   А3 книжный, рамка и основная надпись рукой, ось x, оси тел (штрихом), очерки трёх тел (видимые — толсто, закрытые —
   штрихом), линии пересечения (видимые — толсто, невидимые — штрихом), характерные точки со СВОЕЙ нумерацией студента
   (номера сдвинуты и перемешаны: проверка их не сверяет), немного построений-посредников (следы плоскостей, линии связи).
   Рука — дрожь штриха, сдвиг каждой линии на доли мм; съёмка — lab/synth.js camera (перспектива, свет, тень, расфокус, шум).
   err — ошибочный лист: {line: номер линии, proj: 'F'|'H'|'both', kind: 'shift' (сдвиг на mm) | 'shape' (форма: растяжение на 25 %), mm}.
   dz4Synth({n, seed, level, err, res, size, turn}) → {img, truth:{H (стр. мм → px фото), O (мм стр.), n, drawn:{curves, outl, segs, pts}, err}}
     drawn — что начерчено, в мм чертежа от O (как копия сканера): curves [{p, dash, line, v}], outl [{p, dash}], segs [[u1,v1,u2,v2]], pts [[подпись,u,v]];
   mockAnswer(truth, map, R, o) → текст ответа модели (P/S/C/R/L) по начерченному: map — мм чертежа → px кадра модели;
     погрешность «как у модели»: точки ± 0,5 мм, кривые — 8–14 точек ± 0,8 мм, окружности — радиус ± 0,5 мм.
   node lab/dz/synth4.js --n=7 --seed=1 [--err=shift] --out=файл.png */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const IMG=isNode?require('../img.js'):self.LAB.img, S=isNode?require('../synth.js'):self.LAB.synth, font=isNode?require('../font.js'):self.LAB.font;
const DS=isNode?require('./sheet.js'):self.LAB.dzsheet, B4=isNode?require('../../lk/scan/bind4.js'):self.SCANBIND4;
const REF=()=>isNode?require('../../lk/scan/dz4ref.json').v:self.SCANREF4;
const {rng,H}=IMG, joinRuns=runs=>[].concat(...runs.map((r,i)=>i?r.p.slice(1):r.p));

function dz4Synth(o){ o=o||{}; const n=o.n||1, ref=o.ref||REF()[n], R=rng(o.seed||1), lv=S.LEVELS[o.level||'normal'], page=DS.A3, sheet=new S.Sheet(page.w,page.h,o.res||6);
  const g0=IMG.gray(sheet.w,sheet.h); for(let i=0;i<g0.a.length;i++) g0.a[i]=R(); const g1=IMG.blur(g0,0.8); sheet.grain=new Float32Array(sheet.w*sheet.h);
  for(let i=0;i<g1.a.length;i++) sheet.grain[i]=Math.max(0.35,Math.min(1,0.7+(g1.a[i]-0.5)*3.2));
  sheet.layer='pencil'; const pen={dk:R.r(...lv.dark),thin:R.r(0.22,0.34),main:R.r(0.45,0.65)}, k=R.r(...lv.hand);
  const stroke=(P,w,dk,dash)=>sheet.stroke(P,w,Math.min(0.95,dk),{wob:R.r(0.02,0.05),grain:true,press:true,dash},R);
  const F=DS.FRAME, fc=[[F[0],F[1]],[F[2],F[1]],[F[2],F[3]],[F[0],F[3]]].map(p=>[p[0]+R.n(0,0.5*k),p[1]+R.n(0,0.5*k)]);
  for(let i=0;i<4;i++) stroke([fc[i],fc[(i+1)%4]],pen.main,pen.dk*1.1); DS.titleLines().forEach(([a,b])=>stroke([a,b],pen.thin,pen.dk*0.9));
  /* где чертёж: начало O — так, чтобы всё легло в поле над основной надписью */
  let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9; ref.outlines.forEach(q=>q.p.forEach(p=>{ u0=Math.min(u0,p[0]); u1=Math.max(u1,p[0]); v0=Math.min(v0,p[1]); v1=Math.max(v1,p[1]); }));
  const FL=DS.FIELD, oxLo=FL[0]+22-u0, oxHi=FL[2]-16, oyLo=FL[1]+12-v0, oyHi=FL[3]-6-v1, O=[R.r(Math.min(oxLo,oxHi),Math.max(oxLo,oxHi)),R.r(Math.min(oyLo,oyHi),Math.max(oyLo,oyHi))];
  const pg=p=>[O[0]+p[0],O[1]+p[1]], drawn={curves:[],outl:[],segs:[],pts:[]};
  /* рука: каждая линия сдвинута целиком на доли мм (циркуль и лекало ставятся не идеально) */
  const hand=P=>{ const d=[R.n(0,0.12*k),R.n(0,0.12*k)]; return P.map(p=>[p[0]+d[0],p[1]+d[1]]); };
  const dashOf=()=>[R.r(3,5),R.r(1.2,2),R()*4];
  const ax=[[u0-15,0],[12,0]]; stroke(ax.map(pg),pen.thin,pen.dk*0.9); drawn.segs.push(ax[0].concat(ax[1]));
  (ref.axes||[]).forEach(a=>{ stroke(a.p.map(pg),pen.thin*0.8,pen.dk*0.7,[R.r(6,9),R.r(1.5,2.5),R()*5]); });
  ref.outlines.forEach(q=>{ if(q.p.length<2) return; const P=hand(q.p), dash=!q.vis; stroke(P.map(pg),dash?pen.thin*1.1:pen.main,pen.dk*(dash?0.9:1.15),dash?dashOf():null); drawn.outl.push({p:P,dash}); });
  /* линии пересечения: ошибка — сдвиг или искажение одной линии (на одной или обеих проекциях) */
  const err=o.err||null, bad=(li,v)=>err&&err.line===li&&(err.proj==='both'||err.proj===v);
  const errDir=R()*2*Math.PI, warp=(P,li,v)=>{ if(!bad(li,v)) return P; if(err.kind==='shift'){ const m=err.mm||4; return P.map(p=>[p[0]+m*Math.cos(errDir),p[1]+m*Math.sin(errDir)]); }
    const c=P.reduce((a,p)=>[a[0]+p[0]/P.length,a[1]+p[1]/P.length],[0,0]), s=1+(err.mm||25)/100; return P.map(p=>[c[0]+(p[0]-c[0])*s,c[1]+(p[1]-c[1])*(2-s)]); };
  ref.lines.forEach((L,li)=>L.branches.forEach(b=>['F','H'].forEach(v=>{ const full=warp(joinRuns(b[v]),li,v); if(full.length<2) return; const d=[R.n(0,0.1*k),R.n(0,0.1*k)];
    /* видимость — участками эталона (у искажённой — по той же доле длины) */
    let at=0; b[v].forEach(r=>{ const m=r.p.length-(at?1:0), P=full.slice(Math.max(0,at-1),at+m).map(p=>[p[0]+d[0],p[1]+d[1]]); at+=m; if(P.length<2) return; const dash=!r.vis;
      stroke(P.map(pg),dash?pen.thin*1.1:pen.main,pen.dk*(dash?0.9:1.2),dash?dashOf():null); drawn.curves.push({p:P,dash,line:li,v}); }); })));
  /* характерные точки — своя нумерация студента (сдвиг и перестановка); у ошибочной линии точки уходят вместе с ней */
  const chars=[].concat(...ref.lines.map((L,li)=>L.chars.map(c=>({c,li})))), perm=chars.map((_,i)=>i).sort(()=>R()-0.5), base=1+Math.floor(R()*4), labels=[];
  chars.forEach(({c,li},i)=>['F','H'].forEach(v=>{ const p=warp([c[v]],li,v)[0], q=[p[0]+R.n(0,0.15*k),p[1]+R.n(0,0.15*k)], l=String(base+perm[i])+(v==='F'?'″':'′');
    if(R()<0.7) sheet.circle(pg(q),R.r(0.5,0.8),pen.thin,pen.dk,{grain:true},R); drawn.pts.push([l,q[0],q[1]]); labels.push({s:l,at:[pg(q)[0]+R.r(1,2),pg(q)[1]+R.r(-2.5,-1)]}); }));
  /* посредники: следы плоскостей уровня и линии связи у нескольких точек (их проверка не судит — просто линии на листе) */
  chars.slice().sort(()=>R()-0.5).slice(0,4).forEach(({c})=>{ const a=[c.F[0],c.F[1]], b=[c.H[0],c.H[1]]; stroke([pg(a),pg(b)],pen.thin*0.8,pen.dk*0.7); drawn.segs.push(a.concat(b));
    if(R()<0.6){ const t=[[a[0]-R.r(25,45),a[1]],[a[0]+R.r(25,45),a[1]]]; stroke(t.map(pg),pen.thin*0.8,pen.dk*0.75); drawn.segs.push(t[0].concat(t[1])); } });
  labels.push({s:'X',at:pg([u0-18,-1.5])});
  labels.forEach(l=>{ const s=String(l.s).split('').filter(c=>font.has(c)).join(''); if(s) sheet.text(s,l.at,R.r(3,4.2),Math.min(0.95,pen.dk*1.1),R.r(0.22,0.33),{rot:R.n(0,0.06),shear:R.n(0.12,0.08),jit:0.02,grain:true},R); });
  const sz=o.size||[2250,3000], cam=S.camera(sheet,page,R,lv,sz), dz=isNode?require('./synth.js'):self.LAB.dzSynth, tk=o.turn||0, tr=dz.turn(cam.im,tk);
  return {img:tr.im,truth:{n,H:IMG.H.norm(IMG.H.mul(tr.M,cam.M)),O,drawn,err,params:Object.assign(cam.params,{hand:k})}}; }

/* ответ «модели» по начерченному: map — мм чертежа → px кадра модели, ppm — px кадра на мм */
function mockAnswer(truth,map,R,o){ o=o||{}; const ppm=o.ppm, f=v=>String(Math.round(v)), J=s=>[R.n(0,s*ppm),R.n(0,s*ppm)], out=[], dr=truth.drawn;
  const P=p=>{ const q=map(p), j=J(0.4); return [q[0]+j[0],q[1]+j[1]]; };
  dr.pts.forEach(([l,u,v])=>{ const q=P([u,v]); out.push('P '+l+' '+f(q[0])+' '+f(q[1])); });
  const line=(a,b,d)=>{ const A=P(a), B=P(b); out.push('S '+[A[0],A[1],B[0],B[1]].map(f).join(' ')+(d?' d':'')); };
  dr.segs.forEach(s=>line([s[0],s[1]],[s[2],s[3]],false));
  const curve=(Pm,d)=>{ const L=B4.plen(Pm); if(L<3) return; const m=Math.max(5,Math.min(14,Math.round(L/12)+5)), D=B4.dense(Pm,0.5), pts=[];
    for(let i=0;i<m;i++){ const q=map(D[Math.round(i*(D.length-1)/(m-1))]), j=J(o.curveErr==null?0.8:o.curveErr); pts.push([q[0]+j[0],q[1]+j[1]]); }
    out.push('L '+pts.map(q=>f(q[0])+' '+f(q[1])).join(' ')+(d?' d':'')); };
  dr.outl.forEach(q=>{ const px=q.p.map(map), c=B4.classify(px,0.25*ppm); if(!c) return;
    if(c.t==='S') line(q.p[0],q.p[q.p.length-1],q.dash);
    else if(c.t==='C'){ const r=c.r+R.n(0,0.4*ppm), j=J(0.4); out.push((c.full?'C ':'R ')+f(c.c[0]+j[0])+' '+f(c.c[1]+j[1])+' '+f(r)+(c.full?'':' '+f(c.a1)+' '+f(c.a2))+(q.dash?' d':'')); }
    else curve(q.p,q.dash); });
  dr.curves.forEach(q=>curve(q.p,q.dash));
  return out.join('\n'); }

const api={dz4Synth,mockAnswer};
if(isNode) module.exports=api; else { self.LAB=self.LAB||{}; self.LAB.dz4Synth=api; }
if(isNode&&require.main===module){ const a=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
  const t0=Date.now(), r=dz4Synth({n:+(a.n||1),seed:+(a.seed||1),err:a.err?{line:0,proj:'both',kind:a.err,mm:a.err==='shift'?4:25}:null});
  require('fs').writeFileSync(a.out||'dz4.png',IMG.encodePNG(r.img)); console.log('ДЗ №4 в.'+r.truth.n+', O = '+r.truth.O.map(v=>v.toFixed(1))+', кривых '+r.truth.drawn.curves.length+', точек '+r.truth.drawn.pts.length+', '+(Date.now()-t0)+' мс'); }
})();
