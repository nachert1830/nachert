/* ═══════════ Формат «оцифрованная сцена» ═══════════
   Те же элементы, что у сцен сайта ({t:'pt',at,l}, {t:'seg',a,b,k,l}, {t:'conn',a,b}, {t:'sq',at,p1,p2}, {t:'axis'}),
   но в мм листа (u вправо, v вниз, ось x — v = 0) и с двумя полями у каждого элемента:
     σ    — погрешность положения, мм (1 σ: для точки — радиус, для отрезка — концов поперёк линии);
     conf — уверенность распознавания 0…1 (1 — напечатано в «дано» и совпало с шаблоном).
   Необязательные: src — 'print' (напечатанное условие) | 'hand' (рука студента); role — имя элемента в программе
   построения (core/cp.js), если сканер его опознал; px — где элемент на исходном фото (для отметок поверх фото).
   Тип линии k — как на сайте: main (основная), thin (тонкая), hid (штриховая), conn (линия связи), axis.
   toSite(scene, k) переводит в единицы сайта (k ед./мм; у № 47 k = 4,16), и сцену можно отдать проверкам tests/geometry.js. */
(function(){
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CORE=self.CORE||{}; self.CORE[n]=v; } };
const KINDS=['main','thin','hid','conn','axis','aux','res'];
const P=a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite);

/* проверка формата: список замечаний (пустой — сцена корректна) */
function validate(sc){ const out=[];
  if(!sc||sc.units!=='mm') out.push('units: должно быть "mm"');
  (sc&&sc.items||[]).forEach((it,i)=>{ const w='#'+i+' '+(it&&it.t);
    if(!it||!it.t) return out.push(w+': нет типа');
    if(!(it.σ>=0)) out.push(w+': нет погрешности σ');
    if(!(it.conf>=0&&it.conf<=1)) out.push(w+': уверенность conf вне 0…1');
    if(it.t==='pt'&&!P(it.at)) out.push(w+': at');
    if((it.t==='seg'||it.t==='conn')&&!(P(it.a)&&P(it.b))) out.push(w+': a, b');
    if(it.t==='seg'&&it.k&&!KINDS.includes(it.k)) out.push(w+': тип линии '+it.k);
    if(it.t==='sq'&&!(P(it.at)&&P(it.p1)&&P(it.p2))) out.push(w+': at, p1, p2');
    if(it.t==='circ'&&!(P(it.c)&&it.r>0)) out.push(w+': c, r'); });
  return out; }

const scale=(it,k)=>{ const o=Object.assign({},it), m=p=>[p[0]*k,p[1]*k];
  ['at','a','b','c','p1','p2'].forEach(f=>{ if(o[f]) o[f]=m(o[f]); }); if(o.r) o.r*=k; if(o.σ!=null) o.σ*=k; return o; };
/* мм листа → единицы сайта (и обратно) */
const toSite=(sc,k)=>({units:'site',k,items:sc.items.map(it=>scale(it,k))});
const fromSite=(items,k,o)=>({units:'mm',items:items.filter(Boolean).map(it=>Object.assign(scale(it,1/k),{σ:0,conf:1,src:'print'},o||{}))});

/* подписанные точки и прямые — как siteData в tests/certified/run.js */
function labelled(sc){ const points={}, lines={};
  sc.items.forEach(it=>{ if(it.t==='pt'&&it.l) String(it.l).split(/\s*≡\s*/).forEach(l=>{ if(!points[l]) points[l]=it.at.slice(); });
    if(it.t==='seg'&&it.l) (lines[it.l]=lines[it.l]||[]).push(it.a.slice(),it.b.slice()); });
  return {points,lines}; }

/* SVG сцены (для страницы сканера и отладки): мм → px с полями */
function svg(sc,o){ o=o||{}; const s=o.scale||4, its=sc.items; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  const grow=p=>{ x0=Math.min(x0,p[0]); y0=Math.min(y0,p[1]); x1=Math.max(x1,p[0]); y1=Math.max(y1,p[1]); };
  its.forEach(it=>['at','a','b','c'].forEach(f=>it[f]&&grow(it[f]))); if(o.box) [[o.box[0],o.box[1]],[o.box[2],o.box[3]]].forEach(grow);
  const m=6; x0-=m; y0-=m; x1+=m; y1+=m; const X=p=>((p[0]-x0)*s).toFixed(1), Y=p=>((p[1]-y0)*s).toFixed(1);
  const col=it=>it.col||(it.src==='print'?'#14181f':it.bad?'#c0392b':'#3f74b8');
  const dash={hid:'6 4',conn:'8 3 2 3',axis:'14 3 2 3'};
  const w={main:2,thin:1,hid:1.6,conn:0.8,axis:0.8,aux:1.2,res:2.2};
  const esc=t=>String(t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const body=its.map(it=>{ const op=it.conf<1?(0.35+0.65*it.conf).toFixed(2):'1';
    if(it.t==='seg'||it.t==='conn'){ const k=it.t==='conn'?'conn':(it.k||'main');
      return `<line x1="${X(it.a)}" y1="${Y(it.a)}" x2="${X(it.b)}" y2="${Y(it.b)}" stroke="${col(it)}" stroke-width="${w[k]||1}" stroke-opacity="${op}"${dash[k]?` stroke-dasharray="${dash[k]}"`:''}/>`+
        (it.l?`<text x="${X(it.b)}" y="${Y(it.b)}" dx="4" dy="-3" font-size="11" fill="${col(it)}">${esc(it.l)}</text>`:''); }
    if(it.t==='pt') return `<circle cx="${X(it.at)}" cy="${Y(it.at)}" r="${it.bad?4:2.4}" fill="${it.hollow?'#fff':col(it)}" stroke="${col(it)}" fill-opacity="${op}"/>`+
      (it.l?`<text x="${X(it.at)}" y="${Y(it.at)}" dx="5" dy="-5" font-size="12" fill="${col(it)}">${esc(it.l)}</text>`:'');
    if(it.t==='circ') return `<circle cx="${X(it.c)}" cy="${Y(it.c)}" r="${(it.r*s).toFixed(1)}" fill="none" stroke="${col(it)}"/>`;
    if(it.t==='mark') return `<circle cx="${X(it.at)}" cy="${Y(it.at)}" r="${(it.r||3)*s}" fill="none" stroke="#c0392b" stroke-width="2.5"/>`;
    return ''; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${((x1-x0)*s).toFixed(0)} ${((y1-y0)*s).toFixed(0)}" font-family="sans-serif">${body}</svg>`; }

put('scene',{validate,toSite,fromSite,labelled,svg,KINDS});
})();
