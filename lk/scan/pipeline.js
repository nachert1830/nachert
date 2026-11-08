/* ═══════════ Конвейер оцифровки листа (общий для lk/scan/ и кабинета lk/) ═══════════
   Фото → раскладка (где чертежи, поворот) → оцифровка каждого чертежа моделью → уточнение линий по карандашу
   (lab/dz/refine.js) → привязка к условию варианта (lab/dz/sheetlib.js) → копия в мм листа.
   SCANPIPE.LIBS            — модули сканера, порядок как в lab/dz/worker.js (грузить до run);
   SCANPIPE.load(v)         — подгрузить их по одному (кабинет: по требованию, не при открытии);
   SCANPIPE.create(o)       — {cloud: адрес облачной функции | '', api: адрес беты (lab/dz/beta-server.js), code, pass}
     .status()              → ответ сервера о готовности;
     .run(file, {dz, variant, single}, step) → {out, bmp}; step(id, текст, 'run'|'done'|'err') — ход работы для страницы;
       single — на снимке один чертёж во весь кадр (без раскладки);
     .runMany(files, sel, step) → {out, bmp, bmps} — «чертёж за чертежом»: по чертежу на снимке, все — один лист (у чертежа photo — номер снимка).
   Формат out — как у кнопки «Скачать JSON» беты: {name, size, layout, drawings:[{part, box, rot, mm, circles, fit, txt, pts, segs, stats}], cost, calls, seconds}. */
(function(){
'use strict';
const LIBS=['/core/dz.js','/core/dz-variants.js','/lab/img.js','/lab/clean.js','/lab/font.js','/lab/sheets.js','/lab/rectify.js','/lab/lines.js',
 '/lab/dz/sheet.js','/lab/dz/locate.js','/lab/dz/digitize.js','/lab/dz/model.js','/lab/dz/model3.js','/lab/dz/calib.js','/lab/dz/check2.js','/lab/dz/check3.js','/lab/dz/explain2.js','/lab/dz/report2.js','/lab/dz/check.js','/lab/dz/grid.js','/lab/dz/given.js','/lab/dz/explain3d.js','/lab/dz/report3d.js','/lab/dz/paper.js','/lab/dz/gridsheet.js','/lab/dz/series.js','/lab/dz/refine.js','/lab/dz/eyes.js','/lab/dz/layout.js','/lab/dz/sheetlib.js','/lk/scan/merge.js','/lk/scan/verify.js'];

let loading=null;
function load(v){ if(self.LAB&&self.LAB.sheetlib&&self.LAB.layout&&self.LAB.refine&&self.SCANMERGE&&self.SCANVERIFY) return Promise.resolve();
  if(loading) return loading;
  loading=LIBS.reduce((p,src)=>p.then(()=>new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src+'?v='+(v||'lk1'); s.async=false;
    s.onload=res; s.onerror=()=>rej(new Error('не загрузился модуль сканера '+src)); document.head.appendChild(s); })),Promise.resolve());
  loading.catch(()=>{ loading=null; }); return loading; }

function scaled(bmp,side){ const k=Math.min(1,side/Math.max(bmp.width,bmp.height)), c=document.createElement('canvas'); c.width=Math.round(bmp.width*k); c.height=Math.round(bmp.height*k); c.getContext('2d').drawImage(bmp,0,0,c.width,c.height); return {c,k}; }
/* вырезка чертежа: рамка + поле, поворот по часовой на rot, длинная сторона ≤ side; A — (u,v) вырезки → (x,y) фото (как lab/dz/tools/crop.py) */
function cut(bmp,box,rot,pad,side,view){ const W=bmp.width,H=bmp.height, X0=Math.max(0,Math.round(box[0]-pad)), Y0=Math.max(0,Math.round(box[1]-pad)), X1=Math.min(W,Math.round(box[2]+pad)), Y1=Math.min(H,Math.round(box[3]+pad)), cw=X1-X0, ch=Y1-Y0;
  const sw=(rot===90||rot===270)?ch:cw, sh=(rot===90||rot===270)?cw:ch, r=document.createElement('canvas'); r.width=sw; r.height=sh; const g=r.getContext('2d');
  if(rot===90){ g.translate(ch,0); g.rotate(Math.PI/2); } else if(rot===180){ g.translate(cw,ch); g.rotate(Math.PI); } else if(rot===270){ g.translate(0,cw); g.rotate(-Math.PI/2); }
  g.drawImage(bmp,X0,Y0,cw,ch,0,0,cw,ch); const k=Math.min(1,side/Math.max(sw,sh)), c=document.createElement('canvas'); c.width=Math.round(sw*k); c.height=Math.round(sh*k); c.getContext('2d').drawImage(r,0,0,c.width,c.height);
  const M={0:[1,0,0,0,1,0],90:[0,1,0,-1,0,ch],180:[-1,0,cw,0,-1,ch],270:[0,-1,cw,1,0,0]}[rot], A=[M[0]/k,M[1]/k,M[2]+X0,M[3]/k,M[4]/k,M[5]+Y0];
  const cg=c.getContext('2d'), im=cg.getImageData(0,0,c.width,c.height), d=im.data, gray=new Float32Array(c.width*c.height);
  /* серый кадр: карандашный чертёж цвета не несёт, а запрос становится меньше на треть — ProxyAPI оценивает цену по размеру запроса в байтах и отклоняет крупные */
  for(let i=0;i<gray.length;i++){ const v=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2]; gray[i]=v; d[i*4]=d[i*4+1]=d[i*4+2]=v; } cg.putImageData(im,0,0);
  const cr={c,w:c.width,h:c.height,A,k,gray}; cr.m=view?modelView(cr,view):{c,s:1}; return cr; }
/* кадр для модели (cr.m = {c, s — px кадра модели на px вырезки}): вырезка остаётся в полном разрешении для притяжки к карандашу,
   а модель получает свой кадр —
     размер: длинная сторона до view.side (1568) и площадь до view.area (1,15 Мп — больше модель всё равно уменьшит у себя), в том
       числе УВЕЛИЧЕНИЕ мелкого чертежа (до view.up ×): модель ставит точки с промахом в долю своего «пикселя зрения», и на 600 px
       чертежа промах вдвое больше, чем на 1200 px;
     view.flat — свет выровнен: серое делится на фон (размытие ≈ 4 мм), бледный карандаш и линии в тени становятся контрастнее,
       тень, блик и серый тон фото уходят. Координаты ответа модели → px вырезки: scaleText(текст, 1/s) в digest. */
function modelView(cr,view){ const {w,h,gray}=cr, side=view.side||1568, area=view.area||1.15e6, s=Math.max(0.1,Math.min(view.up||2.5,side/Math.max(w,h),Math.sqrt(area/(w*h))));
  const src=document.createElement('canvas'); src.width=w; src.height=h; const g=src.getContext('2d'), im=g.createImageData(w,h), d=im.data;
  if(view.flat){ const r=Math.max(8,Math.round(Math.max(w,h)/60)), W=w+1, S=new Float64Array(W*(h+1));
    for(let y=0;y<h;y++){ let row=0; for(let x=0;x<w;x++){ row+=gray[y*w+x]; S[(y+1)*W+x+1]=S[y*W+x+1]+row; } }
    for(let y=0;y<h;y++){ const y0=Math.max(0,y-r), y1=Math.min(h,y+r+1); for(let x=0;x<w;x++){ const x0=Math.max(0,x-r), x1=Math.min(w,x+r+1), bg=(S[y1*W+x1]-S[y0*W+x1]-S[y1*W+x0]+S[y0*W+x0])/((x1-x0)*(y1-y0));
      const dk=Math.max(0,1-gray[y*w+x]/Math.max(30,bg)), v=255*(1-Math.min(1,dk*(view.gain||2.6))), i=4*(y*w+x); d[i]=d[i+1]=d[i+2]=v; d[i+3]=255; } } }
  else for(let i=0;i<w*h;i++){ d[4*i]=d[4*i+1]=d[4*i+2]=gray[i]; d[4*i+3]=255; }
  g.putImageData(im,0,0); if(Math.abs(s-1)<0.02&&!view.flat) return {c:cr.c,s:1};
  const c=document.createElement('canvas'); c.width=Math.round(w*s); c.height=Math.round(h*s); const cg=c.getContext('2d'); cg.imageSmoothingEnabled=true; cg.imageSmoothingQuality='high'; cg.drawImage(src,0,0,c.width,c.height);
  return {c,s:c.width/w}; }
/* ответ модели в px её кадра → px вырезки: координаты P/S/C/R/T умножаются на k (углы дуг R — нет) */
function scaleText(t,k){ if(k===1||t==null) return t; const f=v=>String(Math.round(+v*k*10)/10), num=/^-?\d+(?:[.,]\d+)?$/;
  return String(t).split(/\r?\n/).map(line=>{ const m=line.match(/^(\s*)([PSCRT])(\s+)(.*)$/); if(!m) return line; const tk=m[4].split(/(\s+)/);   /* токены и пробелы вперемешку */
    let want={P:[1,2],S:[0,1,2,3],C:[0,1,2],R:[0,1,2],T:[0,1]}[m[2]], n=0; const out=tk.map(x=>{ if(/^\s+$/.test(x)||x==='') return x; const j=n++; return want.includes(j)&&num.test(x)?f(x.replace(',','.')):x; });
    return m[1]+m[2]+m[3]+out.join(''); }).join('\n'); }
/* вырезка чертежа для притяжки к карандашу — до 2000 px (раньше 1280: на снимке 12 Мп чертёж терял треть пикселей карандаша);
   кадр модели — увеличенный до 1,15 Мп. Замер 04.11 (16 чертежей, Sonnet, ответ против «как начерчено»): сырые точки модели
   0,32 → 0,23 мм, линии в 1 мм: полнота 95 → 97 %, точность 96 → 98 %, точек в 1 мм 146 → 155 из 165 (lab/dz/REPORT.md, 7п) */
const CUT_SIDE=2000, VIEW={side:1568,area:1.15e6,up:2.5};
const mapPt=(A,u,v)=>[A[0]*u+A[1]*v+A[2],A[3]*u+A[4]*v+A[5]];
const fmt=(a,d)=>isFinite(a)?a.toFixed(d==null?2:d).replace('.',','):'—';

/* один чертёж: ответ основной модели tA и, если есть, второй tB (тот же кадр) → копия (px фото и мм листа) и её качество.
   c = {W, H (фото), vSel, dzSel (вариант и задание), rot, d (рамка чертежа)} */
function digest(cr,tA,tB,c){ const L=self.LAB, LY=L.layout, SL=L.sheetlib, RF=L.refine, IMG=L.img, MG=self.SCANMERGE, d=c.d||{};
  if(cr.m&&cr.m.s!==1){ tA=scaleText(tA,1/cr.m.s); tB=scaleText(tB,1/cr.m.s); }   /* ответ — в px кадра модели */
  /* одинаковые подписи двух проекций (A″ и A″ без A′) — верхняя ″, нижняя ′ (merge.fixPrimes): иначе к варианту не привязать */
  const parse=t=>{ const Q=LY.parseDigit(t), f=MG.fixPrimes(Q.pts); Q.pts=f.pts; Q.primesFixed=f.fixed; return Q; };
  const ppm0=Math.max(2,Math.min(c.W,c.H)/210*cr.k); let P=parse(tA), text=P.primesFixed.length?MG.toText(P):tA, mg=null; const pf=P.primesFixed;
  if(tB!=null){ let fA=null; try{ fA=SL.fitVariant(text,c.vSel,c.dzSel); }catch(e){} mg=MG.merge(P,parse(tB),{ppm:fA&&fA.ppm?fA.ppm:ppm0}); P=mg.P; text=MG.toText(P); }
  let fit=null; try{ fit=SL.fitVariant(text,c.vSel,c.dzSel); }catch(e){}
  const rg=P.pts.length>=4?[Math.min(...P.pts.map(q=>q[1])),Math.min(...P.pts.map(q=>q[2])),Math.max(...P.pts.map(q=>q[1])),Math.max(...P.pts.map(q=>q[2]))]:null;
  /* притяжка считает в индексах пикселей (значение пикселя i — в его центре), а координаты фото, модели и canvas — от края
     пикселя (центр пикселя i — i + 0,5): без поправки вся копия сдвигалась на полпикселя влево-вверх (≈ 0,15 мм при 3,3 px/мм) */
  const HP=0.5, sh=(s,k)=>s.map((v,i)=>i<4?v+k:v), shC=(c,k)=>Object.assign({},c,{cx:c.cx+k,cy:c.cy+k});
  const ppm=c.geo?c.geo.ppm:ppm0; let rf=RF.refine({w:cr.w,h:cr.h,a:cr.gray},P.segs.map(s=>sh(s,-HP)),{circles:P.circles.map(c=>shC(c,-HP)),findCircles:true,ppm:fit&&fit.ppm?fit.ppm:ppm,region:rg,points:P.pts.map(q=>[q[1]-HP,q[2]-HP]),findCap:0.35});
  if(mg) rf=MG.keepB(rf,mg.nA,P.circles.map(c=>shC(c,-HP)));   /* добавленное второй моделью без карандаша — вон */
  rf=Object.assign({},rf,{segs:rf.segs.map(q=>Object.assign({},q,{p:sh(q.p,HP)})),circles:(rf.circles||[]).map(c=>shC(c,HP))});
  /* точки — на перекрёсток уточнённых линий (МНК по всем линиям, что через него проходят) или хотя бы на линию: копия
     геометрически согласована и точнее догадки модели; догадки обеих моделей — кандидаты (refine.placePoints) */
  /* точки условия по форме (голос листа: вариант и масштаб известны, а подписи не прочитаны или перепутаны) — refine.matchGiven */
  let geo=null; if(c.geo){ const gv=self.CORE&&self.CORE.dzVariants.get(c.geo.dz,c.geo.n), G=gv?L.dzModel.given(gv.id,gv.data).pts.map(q=>({l:q.l,pr:q.pr,at:q.at})):[];
    geo=G.length?RF.matchGiven(rf.segs.filter(q=>!q.unverified).map(q=>q.p),G,{ppm:c.geo.ppm}):null;
    if(geo){ const gl=new Set(geo.pts.map(q=>MG.lab(q[0]))); P.pts=P.pts.filter(q=>!gl.has(MG.lab(q[0]))).concat(geo.pts); } }
  const pp=RF.placePoints(P.pts,rf.segs.filter(q=>!q.unverified).map(q=>q.p),{ppm:fit&&fit.ppm?fit.ppm:ppm,alts:mg?mg.alts:null}); P.pts=pp.map(q=>[q[0],q[1],q[2]]);
  const placed={vertex:pp.filter(q=>q[4]>=2).length,line:pp.filter(q=>q[4]===1).length,free:pp.filter(q=>!q[4]).length};
  /* привязка к варианту — заново, по уточнённым точкам: невязка честнее, мм копии точнее (не хуже прежней — иначе прежняя) */
  { let f2=null; try{ f2=SL.fitVariant(MG.toText(P),c.vSel,c.dzSel); }catch(e){} const rmsOf=f=>f&&f.rmsMm!=null?(f.hom?f.hom.rmsMm:f.rmsMm):null;
    if(f2&&rmsOf(f2)!=null&&f2.inl>=4&&(!fit||rmsOf(fit)==null||(f2.dz===fit.dz&&f2.n===fit.n&&f2.inl>=fit.inl&&rmsOf(f2)<=rmsOf(fit)+0.02))) fit=f2; }
  let toMm=null; if(fit&&fit.M){ const Mi=IMG.H.inv(fit.M); toMm=(x,y)=>IMG.H.apply(Mi,[x,y]); } else if(fit&&fit.A){ const a=fit.A, det=a[0]*a[4]-a[1]*a[3]; if(Math.abs(det)>1e-9) toMm=(x,y)=>{ const X=x-a[2], Y=y-a[5]; return [(a[4]*X-a[1]*Y)/det,(-a[3]*X+a[0]*Y)/det]; }; }
  const mmCopy=toMm?{pts:P.pts.map(q=>[q[0]].concat(toMm(q[1],q[2]).map(v=>+v.toFixed(2)))),txt:P.txt.map(q=>toMm(q[0],q[1]).map(v=>+v.toFixed(2)).concat(q[2])),segs:rf.segs.map(q=>({p:toMm(q.p[0],q.p[1]).concat(toMm(q.p[2],q.p[3])).map(v=>+v.toFixed(2)),src:q.src,unverified:!!q.unverified,dash:!!q.dash}))}:null;
  const circles=(rf.circles||[]).map(c=>{ const poly=SL.arcPoints(c); return {src:c.src,unverified:!!c.unverified,dash:!!c.dash,full:!!c.full,c:[c.cx,c.cy,c.r].map(v=>+v.toFixed(2)),a:c.full?null:[+c.a1.toFixed(1),+c.a2.toFixed(1)],poly:poly.map(([u,v])=>mapPt(cr.A,u,v).map(t=>+t.toFixed(1))),mm:toMm?poly.map(([u,v])=>toMm(u,v).map(t=>+t.toFixed(2))):null}; });
  const dr={part:d.part,box:d.box,rot:c.rot,ppm:fit&&fit.ppm?fit.ppm/cr.k:ppm/cr.k,mm:mmCopy,circles,fit,txt:P.txt.map(q=>mapPt(cr.A,q[0],q[1]).concat(q[2])),pts:P.pts.map(q=>[q[0]].concat(mapPt(cr.A,q[1],q[2]))),segs:rf.segs.map(q=>({p:mapPt(cr.A,q.p[0],q.p[1]).concat(mapPt(cr.A,q.p[2],q.p[3])),src:q.src,unverified:!!q.unverified,dash:!!q.dash})),stats:Object.assign({model:P.segs.length,bad:P.bad,pts:P.pts.length,placed,primesFixed:pf.length},rf.stats)};
  if(mg) dr.merge=mg.info; if(geo) dr.geoGiven={inl:geo.inl,rmsMm:+geo.rmsMm.toFixed(2)};
  return {dr,q:quality(fit,rf,P)}; }
/* вердикт по одному чертежу: копия (px фото: точки на перекрёстках, линии по карандашу) → разбор как ответ модели → проверка
   части (gridsheet.checkGridPhoto → check3): «верно» — всё на месте в допуске 1,5 мм; «ошибка» — найдено уверенно (≥ 3 мм / 5°);
   иначе «не могу утверждать» с причиной. Ложное «ошибка» хуже молчания: проверка требует доказательства по линиям */
const PART={a:'1 — высота',b:'2 — угол граней',c:'3 — истинный вид ABC',d:'4 — угол SA'};
function checkDrawing(img,dr){ const L=self.LAB, t0=Date.now();
  try{ const txt=dr.pts.map(q=>'P '+q[0]+' '+q[1].toFixed(1)+' '+q[2].toFixed(1)).concat(dr.segs.filter(q=>!q.unverified).map(q=>'S '+q.p.map(t=>t.toFixed(1)).join(' ')+(q.dash?' d':''))).join('\n');
    const q=L.dzEyes.parseDigit(txt,1).drawings[0]; if(!q) return {verdict:'не могу утверждать',why:['копия пуста']};
    const g=L.dzGridSheet.checkGridPhoto(img,{dz:3,n:+dr.fit.n,digit:q,eyes:{pts:q.pts},cleaner:false,answers:{}});
    const parts=g.parts?Object.fromEntries(Object.entries(g.parts).filter(([k,x])=>x&&x.st).map(([k,x])=>[k,{st:x.st,why:(x.why||[])[0]||null,measured:x.measured!=null?+(+x.measured).toFixed(1):null,mWhy:x.mWhy||null}])):{};
    const main=Object.entries(parts).find(([k,x])=>x.st===g.verdict)||Object.entries(parts)[0];
    return {verdict:g.verdict,part:main?main[0]:null,partName:main?PART[main[0]]:null,why:[main&&main[1].why,main&&main[1].mWhy].filter(Boolean),parts,ms:Date.now()-t0}; }
  catch(e){ return {verdict:'не могу утверждать',why:['проверка не сложилась: '+String(e&&e.message||e).slice(0,120)],ms:Date.now()-t0}; } }
/* качество копии: привязалась ли к условию варианта, невязка, доля линий, подтверждённых карандашом, сколько ответа модели не нашлось на бумаге */
function quality(fit,rf,P){ const bound=!!(fit&&fit.rmsMm!=null&&fit.inl>=4), rms=bound?(fit.hom?fit.hom.rmsMm:fit.rmsMm):null, st=rf.stats, kept=st.kept||0;
  const conf=kept?(kept-(st.unverified||0))/kept:0, drop=(st.dropped||0)/Math.max(1,st.model||0), why=[];
  if(!bound) why.push('не привязался к варианту'); else if(rms>0.8) why.push('невязка '+fmt(rms)+' мм');
  if(conf<0.9) why.push('без карандаша '+Math.round(100*(1-conf))+' % линий'); if(drop>0.15) why.push('не на бумаге '+Math.round(100*drop)+' % ответа');
  if(P.pts.length<6) why.push('мало точек');
  return {bound,inl:bound?fit.inl:0,rms,conf,drop,pts:P.pts.length,confirmed:kept-(st.unverified||0),weak:why.length>0,why}; }
/* вариант листа: голоса чертежей, привязанных честно (невязка ≤ 0,8 мм), с весом — числом точек условия; победитель — если за него
   ≥ 2 чертежа и ≥ 60 % веса, иначе null (один чертёж листа ничего не решает за остальные) */
function sheetVariant(drs){ const V=new Map(); let tot=0;
  (drs||[]).forEach(d=>{ const f=d&&!d.error&&d.fit; if(!f||f.rmsMm==null||f.inl<4) return; const r=f.hom?f.hom.rmsMm:f.rmsMm; if(!(r<=0.8)) return;
    const k=f.dz+':'+f.n, v=V.get(k)||{dz:f.dz,n:f.n,w:0,c:0}; v.w+=f.inl; v.c++; V.set(k,v); tot+=f.inl; });
  const best=[...V.values()].sort((a,b)=>b.w-a.w)[0]; if(!(best&&best.c>=2&&best.w>=0.6*tot)) return null;
  /* масштаб листа (px фото на мм) — медиана по чертежам победителя: для поиска точек условия по форме у остальных */
  const pp=(drs||[]).filter(d=>d&&!d.error&&d.fit&&d.fit.dz===best.dz&&d.fit.n===best.n&&d.ppm).map(d=>d.ppm).sort((a,b)=>a-b);
  return {dz:best.dz,n:best.n,drawings:best.c,ppm:pp.length?pp[pp.length>>1]:null}; }
/* слитая копия лучше, если не потеряла привязку к варианту и не ухудшила её */
function better(M,A){ if(A.bound&&(!M.bound||M.inl<A.inl||M.rms>A.rms+0.2)) return false; return M.bound||!A.bound; }

function create(o){ o=o||{};
  const CLOUD=String(o.cloud||'').trim().replace(/[?&]integration=raw$/,'');   /* raw-режим Яндекса не отдаёт функции заголовки — адрес всегда без него */
  const API=String(o.api||'').replace(/\/+$/,'');
  const hdr=()=>CLOUD?{'content-type':'application/json','x-scan-code':encodeURIComponent(o.code||'')}:{'content-type':'application/json','x-beta-password':o.pass||''};
  async function status(){ const r=await fetch(CLOUD?CLOUD:API+'/api/status',CLOUD&&o.code?{headers:{'x-scan-code':encodeURIComponent(o.code)}}:undefined); const j=await r.json().catch(()=>null); return {http:r.status,j}; }
  async function ask(mode,canvas,extra){ const url=canvas.toDataURL('image/jpeg',0.8); let r;
    for(let attempt=0;;attempt++){ r=await fetch(CLOUD||API+'/api/eyes',{method:'POST',headers:hdr(),body:JSON.stringify(Object.assign({img:url,w:canvas.width,h:canvas.height,mode},extra||{}))});
      if(![429,500,502,503,504].includes(r.status)||attempt>=2) break; await new Promise(res=>setTimeout(res,2000*(attempt+1))); }   /* временный сбой облака или модели — до двух повторов */
    const raw=await r.text(); let j=null; try{ j=JSON.parse(raw); }catch(e){}
    /* откуда ошибка: ответ нашей функции (error), платформы Yandex Cloud (message) или не JSON; в конце — код ответа */
    if(!r.ok||!j||!j.ok){ const e=new Error(((j&&(j.error||j.message))||(raw?raw.replace(/\s+/g,' ').slice(0,120):'пустой ответ'))+' [HTTP '+r.status+(CLOUD?', облако':'')+']'); e.status=r.status; throw e; }
    return j; }

  async function run(file,sel,step){ sel=sel||{}; step=step||function(){};
    const LY=self.LAB.layout, acc={cost:0,calls:0}, t0=Date.now();
    step('l','Читаю фото…'); const bmp=await createImageBitmap(file,{imageOrientation:'from-image'}); const W=bmp.width,H=bmp.height; step('l','Фото '+W+' × '+H+' px','done');
    let lay;
    /* один чертёж во весь кадр (снимок вблизи, «чертёж за чертежом»): раскладка не нужна — ни её запрос, ни её ошибки (рамки внахлёст, пропуск бледного) */
    if(sel.single){ lay={ok:true,rot:0,drawings:[{box:[0,0,W,H],part:null}]}; step('lay','Один чертёж во весь кадр — раскладка не нужна','done'); }
    else { step('lay','Нахожу чертежи на листе…'); const sm=scaled(bmp,800);
      try{ const j=await ask('layout',sm.c); acc.cost+=j.cost||0; acc.calls++; lay=LY.parseLayout(j.text,1/sm.k,W,H); }
      catch(e){ if(e.status===401||e.status===403) throw e; lay={ok:false,why:e.message}; }   /* неверный код — дальше идти незачем */
      if(!lay.ok){ step('lay','Раскладка не помогла ('+lay.why+') — лист как один чертёж','done'); lay={ok:true,rot:0,drawings:[{box:[0,0,W,H],part:null}]}; }
      else step('lay','Чертежей: '+lay.drawings.length+(lay.rot?', лист повёрнут на '+lay.rot+'°':'')+(lay.drawings.some(d=>d.part)?' (части '+lay.drawings.map(d=>d.part||'?').join(', ')+')':''),'done'); }
    const out={name:String(file.name||'лист').replace(/\.[^.]+$/,''),size:[W,H],layout:{rot:lay.rot,n:lay.drawings.length},drawings:[]}; if(sel.single) out.layout.single=true;
    await digitize(lay.drawings.map(d=>({bmp,d,rot:lay.rot,W,H})),out,sel,step,acc,true);
    out.cost=+acc.cost.toFixed(4); out.calls=acc.calls; out.seconds=Math.round((Date.now()-t0)/1000); return {out,bmp}; }
  /* «чертёж за чертежом»: снимки вблизи, на каждом — один чертёж во весь кадр (≥ 8 px/мм: подписи A‴, A₄ читаются, а раскладка
     листа с её ошибками не нужна). Все чертежи — в один out, как один лист; у чертежа photo — номер снимка, с которого он.
     → {out, bmp (первый снимок), bmps} */
  async function runMany(files,sel,step){ sel=sel||{}; step=step||function(){}; files=Array.from(files||[]); if(!files.length) throw new Error('нет снимков');
    const acc={cost:0,calls:0}, t0=Date.now(), units=[];
    for(let i=0;i<files.length;i++){ step('l'+i,'Читаю снимок '+(i+1)+'…'); const bmp=await createImageBitmap(files[i],{imageOrientation:'from-image'}), W=bmp.width, H=bmp.height;
      units.push({bmp,d:{box:[0,0,W,H],part:null},rot:0,W,H,photo:i}); step('l'+i,'Снимок '+(i+1)+': '+W+' × '+H+' px','done'); }
    step('lay','Снимков вблизи: '+units.length+' — по чертежу на снимке, раскладка листа не нужна','done');
    const out={name:String(files[0].name||'лист').replace(/\.[^.]+$/,''),size:[units[0].W,units[0].H],photos:units.map(u=>[u.W,u.H]),layout:{rot:0,n:units.length,single:true,many:true},drawings:[]};
    /* масштаб (px на мм) у каждого снимка вблизи свой — медиана по ним для поиска точек условия по форме не годится: samePpm = false */
    await digitize(units,out,sel,step,acc,false);
    out.cost=+acc.cost.toFixed(4); out.calls=acc.calls; out.seconds=Math.round((Date.now()-t0)/1000); return {out,bmp:units[0].bmp,bmps:units.map(u=>u.bmp)}; }
  /* оцифровка чертежей, u = {bmp, d (рамка, часть), rot, W, H, photo?} → out.drawings; голос листа, проверка по результату и построения.
     samePpm — все чертежи с одного фото (общий масштаб листа: точки условия по форме по медиане масштаба) */
  async function digitize(units,out,sel,step,acc,samePpm){ const L=self.LAB;
    const dzSel=sel.dz&&sel.dz!=='auto'?+sel.dz:null, vSel=/^\d+$/.test(String(sel.variant||'').trim())?String(sel.variant).trim():'auto';
    const prec=sel.precision||'fast', mname=m=>/opus/.test(m||'')?'Opus':/sonnet/.test(m||'')?'Sonnet':/haiku/.test(m||'')?'Haiku':(m||'?');
    const redo=[], tag=(dr,u)=>{ if(dr&&u.photo!=null) dr.photo=u.photo; return dr; };
    const jobs=units.map((u,i)=>async()=>{ const d=u.d, id='d'+i, nm='Чертёж '+(i+1); step(id,nm+': оцифровка…'); const cr=cut(u.bmp,d.box,u.rot,Math.max(40,0.05*Math.max(d.box[2]-d.box[0],d.box[3]-d.box[1])),CUT_SIDE,VIEW), ctx={W:u.W,H:u.H,vSel,dzSel,rot:u.rot,d};
      let jA; try{ jA=await ask('crop',cr.m.c,sel.model?{model:sel.model}:null); }catch(e){ step(id,nm+': '+e.message,'err'); return tag({part:d.part,box:d.box,error:e.message},u); } acc.cost+=jA.cost||0; acc.calls++;
      const reads=[{mode:'crop',model:jA.model,fallback:jA.fallback||null,cost:jA.cost||0}];
      let R=digest(cr,jA.text,null,ctx), tB=null;
      /* вторая, независимая оцифровка другой моделью — если первая слабая (или «максимальная точность»); сливаются, карандаш решает */
      if(!jA.fallback&&(prec==='max'||(prec==='auto'&&R.q.weak))){ step(id,nm+': вторая, независимая оцифровка другой моделью'+(R.q.why.length?' ('+R.q.why.join(', ')+')':'')+'…');
        try{ const jB=await ask('crop2',cr.m.c); acc.cost+=jB.cost||0; acc.calls++; reads.push({mode:'crop2',model:jB.model,cost:jB.cost||0});
          const M=digest(cr,jA.text,jB.text,ctx); if(better(M.q,R.q)){ R=M; tB=jB.text; } else R.dr.secondKept=false; }
        catch(e){ R.dr.secondError=e.message; } }
      const dr=R.dr, fit=dr.fit, mg=dr.merge; dr.reads=reads; dr.quality=R.q;
      redo[i]=(n,dz,geoPpm)=>{ const X=digest(cr,jA.text,tB,Object.assign({},ctx,{vSel:String(n),dzSel:dz},geoPpm?{geo:{n,dz,ppm:geoPpm*cr.k}}:{})); X.dr.reads=reads; X.dr.quality=X.q; if(mg) X.dr.merge=X.dr.merge||mg; tag(X.dr,u); return X; };   /* те же ответы — другой вариант (голос листа) */
      step(id,nm+': '+reads.map(r=>mname(r.model)).join(' + ')+' — точек '+dr.stats.pts+', отрезков '+dr.stats.kept+(dr.circles.length?', окружностей и дуг '+dr.circles.length:'')
        +(mg?' (вторая модель добавила: линий '+Math.max(0,mg.segsAdded-(dr.stats.dropB||0))+', точек '+mg.ptsAdded+')':'')
        +(fit&&fit.rmsMm!=null?', привязка ДЗ №'+fit.dz+' в.'+fit.n+', невязка '+fmt(fit.hom?fit.hom.rmsMm:fit.rmsMm)+' мм':', к условию не привязался'),'done'); return tag(dr,u); });
    /* до двух чертежей одновременно */
    const q=jobs.slice(); await Promise.all([0,1].map(async()=>{ while(q.length){ const job=q.shift(), idx=jobs.indexOf(job); out.drawings[idx]=await job(); } }));
    /* голос листа: на листе — один вариант. Чертёж, привязавшийся к другому (или ни к какому), пересчитывается по варианту
       большинства на тех же ответах моделей; принимается, если привязка к нему честная (≥ 4 точек условия, невязка ≤ 1 мм) */
    if(vSel==='auto'){ const sv=sheetVariant(out.drawings);
      if(sv){ out.variant=sv; out.drawings.forEach((dr,i)=>{ if(!dr||dr.error||!redo[i]) return; const f=dr.fit; if(f&&f.rmsMm!=null&&f.dz===sv.dz&&String(f.n)===String(sv.n)) return;
          const ok=X=>X&&X.q.bound&&X.q.rms<=1&&String(X.dr.fit.n)===String(sv.n);
          let X=null; try{ X=redo[i](sv.n,sv.dz); }catch(e){}
          if(!ok(X)&&sv.ppm&&samePpm){ try{ X=redo[i](sv.n,sv.dz,sv.ppm); }catch(e){ X=null; } }   /* подписи не помогли — точки условия по форме */
          if(!ok(X)) return;
          X.dr.sheetVote={was:f&&f.rmsMm!=null?{dz:f.dz,n:f.n}:null}; out.drawings[i]=X.dr;
          step('d'+i,'Чертёж '+(i+1)+': '+(f&&f.rmsMm!=null?'был привязан к ДЗ №'+f.dz+' в.'+f.n:'не был привязан')+' — по листу вариант '+sv.n+', невязка '+fmt(X.q.rms)+' мм','done'); }); } }
    /* проверка по результату (lk/scan/verify.js): истинные величины в копии против эталона варианта — каким бы способом и с какими
       подписями студент ни строил; на офлайн-копии, без запросов */
    if(self.SCANVERIFY&&self.CORE&&self.CORE.dzVariants) out.drawings.forEach(dr=>{ if(!dr||dr.error||!dr.mm||!dr.fit||dr.fit.dz!==3||dr.fit.rmsMm==null) return;
      try{ const gv=self.CORE.dzVariants.get(3,+dr.fit.n); if(!gv) return; const v=self.SCANVERIFY.verify(dr.mm.pts,gv.data);
        if(v.found.length) dr.verify={verdict:v.verdict,found:v.found.map(f=>({k:f.k,what:f.what,got:Array.isArray(f.got)?f.got.map(t=>+t.toFixed(1)):+f.got.toFixed(1),want:Array.isArray(f.want)?f.want.map(t=>+t.toFixed(1)):+f.want.toFixed(1),st:f.st,from:f.from,unit:f.unit}))}; }catch(e){} });
    /* проверка построения (ДЗ №3): мозг сканера (lab/dz/check3.js через gridsheet) по уточнённой копии каждого чертежа.
       Только по запросу (sel.check = true): на 62 настоящих чертежах (REPORT 7с) почти всё — «не могу утверждать» (студенты строят
       не только способом из указания), одно «ошибка в данных» — скорее ложное; студенту такой вердикт показывать рано */
    const chk=dr=>dr&&!dr.error&&dr.fit&&dr.fit.dz===3&&dr.fit.rmsMm!=null;
    if(sel.check===true&&L.dzGridSheet&&out.drawings.some(chk)){ step('chk','Проверяю построение…'); const imgs=new Map();   /* кадр RGBA — один на фото */
      const imgOf=u=>{ if(imgs.has(u.bmp)) return imgs.get(u.bmp); let img=null; try{ const c=document.createElement('canvas'); c.width=u.W; c.height=u.H; const g=c.getContext('2d'); g.drawImage(u.bmp,0,0); img=g.getImageData(0,0,u.W,u.H); }catch(e){} imgs.set(u.bmp,img); return img; };
      out.drawings.forEach((dr,i)=>{ if(!chk(dr)) return; const img=imgOf(units[i]); if(img) dr.check=checkDrawing(img,dr); });
      const vs=out.drawings.filter(d=>d&&d.check).map(d=>d.check.verdict); if(vs.length) step('chk','Проверка: '+['верно','ошибка','не могу утверждать'].map(v=>[v,vs.filter(x=>x===v).length]).filter(x=>x[1]).map(x=>x[0]+' — '+x[1]).join(', '),'done'); } }

  return {status,ask,run,runMany,cloud:CLOUD,api:API}; }

self.SCANPIPE={LIBS,load,create,scaled,cut,modelView,scaleText,mapPt,digest,quality,better,sheetVariant,checkDrawing,CUT_SIDE,VIEW};
})();
