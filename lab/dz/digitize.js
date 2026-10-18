/* ═══════════ ДЗ: чертёж из рамки → числа ═══════════
   По найденному листу (lab/dz/locate.js):
   1. Чертёж: где в поле (рамка без штампа) есть линии — сетка 2 мм, клетки с гребнем выше шума; рамка чертежа —
      по клеткам без одиночных выбросов (пятна, точки от карандаша), с полем 5 мм.
   2. Линии: lab/lines.js на этой рамке (гребни, Хаф по направлению, тип основная / тонкая / штриховая, σ).
   3. Координаты — от начала O эпюра, мм: u вправо, v вниз (как у сцен сайта: A″ = (−x, −z), A′ = (−x, y)).
      Нет O (ось z/y не найдена) — координаты страницы, origin:'page'; O определится по таблице варианта.
   digitize(img, loc) → {ok, origin, O, box (мм страницы), segs, scene, crop:{box,ppm}} */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const lab=n=>isNode?require('../'+n+'.js'):self.LAB[n];
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const IMG=lab('img'), CL=lab('clean'), LN=lab('lines');
const DS=isNode?require('./sheet.js'):self.LAB.dzsheet, LC=isNode?require('./locate.js'):self.LAB.dzLocate;

/* рамка чертежа в поле (мм страницы) по карте гребней */
function drawingBox(img,loc){ const FL=DS.FIELD, box=[FL[0]+3,FL[1]+3,FL[2]-3,FL[3]-3], ppm=4, f=LC.inkOf(img,loc.H,box), g=CL.warp(f.ink,f.M,box,ppm), R=LN.ridges(g,1.2).R, w=g.w, h=g.h;
  const s=[]; for(let i=0;i<w*h;i+=7) s.push(R[i]); s.sort((a,b)=>a-b); const med=s[s.length>>1], mad=s.map(v=>Math.abs(v-med)).sort((a,b)=>a-b)[s.length>>1]*1.4826, tR=Math.max(0.01,med+6*mad);
  /* клетки 2 × 2 мм: в клетке ≥ 3 px гребня */
  const C=2*ppm, cw=Math.ceil(w/C), ch=Math.ceil(h/C), cell=new Uint8Array(cw*ch);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(R[y*w+x]>=tR) cell[((y/C)|0)*cw+((x/C)|0)]++;
  const on=new Uint8Array(cw*ch); for(let i=0;i<cw*ch;i++) on[i]=cell[i]>=3?1:0;
  /* одиночная клетка без соседей — не чертёж */
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9, n=0;
  for(let y=0;y<ch;y++) for(let x=0;x<cw;x++){ if(!on[y*cw+x]) continue; let k=0; for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++){ const xx=x+i, yy=y+j; if((i||j)&&xx>=0&&yy>=0&&xx<cw&&yy<ch&&on[yy*cw+xx]) k++; }
    if(k<2) continue; n++; x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y); }
  if(!n) return null;
  const mm=v=>v*2;
  return [Math.max(FL[0]+1,box[0]+mm(x0)-5),Math.max(FL[1]+1,box[1]+mm(y0)-5),Math.min(FL[2]-1,box[0]+mm(x1+1)+5),Math.min(FL[3]-1,box[1]+mm(y1+1)+5)]; }

function digitize(img,loc,o){ o=o||{}; if(!loc||!loc.ok) return {ok:false,reason:loc&&loc.reason||'лист не найден'};
  const bx=drawingBox(img,loc); if(!bx) return {ok:false,reason:'в рамке не нашлось чертежа (пусто или слишком бледно) — переснимите при хорошем свете'};
  const origin=loc.O?'O':'page', O=loc.O||[0,0];
  /* псевдо-лист для lab/lines.js: печатного «дано» на листе ДЗ нет — всё начерчено рукой */
  const SH={O,frame:DS.FRAME,roi:[bx[0]-O[0],bx[1]-O[1],bx[2]-O[0],bx[3]-O[1]],given:()=>[]};
  const ex=LN.extract(img,{H:loc.H},{sheet:SH,maxIter:o.maxIter||250}); if(!ex.ok) return Object.assign(ex,{box:bx});
  return {ok:true,origin,O:loc.O,box:bx,segs:ex.segs,scene:ex.scene,map:ex.map}; }

put('dzDigitize',{digitize,drawingBox});
})();
