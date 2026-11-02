/* ═══════════ Пример для «Моих чертежей»: ДЗ № 3, вариант 21 (пирамида SABC), как будто его оцифровал сканер ═══════════
   Без камеры, кода доступа и интернета: формат — тот же, что у lk/scan/pipeline.js (out.drawings[…].mm, fit).
   Подсажены типичные огрехи фото, чтобы было что доводить: S′ съехала на 2,6 мм (разрыв линии связи и отход от условия),
   одна линия не подтверждена карандашом, у C нет подписи C′ (точка есть, подпись съедена бликом — «C» без штриха).
   Видимость рёбер — по 3D (lab/dz/model.js, solid): AB — штрихом на π₂, BC — штрихом на π₁. */
(function(){
'use strict';
const DATA={A:[50,10,40],B:[0,30,30],C:[70,50,0],S:[20,60,60]};
const F=P=>[-P[0],-P[2]], H=P=>[-P[0],P[1]];
const EDGES=[['A','B','f'],['B','C','h'],['C','A',''],['S','A',''],['S','B',''],['S','C','']];   /* третье — где ребро невидимо */
function make(){ let s=7; const rnd=()=>{ s=(s*16807)%2147483647; return (s/2147483647-0.5)*0.5; };   /* шум ±0,25 мм — как у хорошего снимка */
  const pf={}, ph={}; Object.entries(DATA).forEach(([k,P])=>{ pf[k]=F(P).map(v=>v+rnd()); ph[k]=H(P).map(v=>v+rnd()); });
  ph.S=[ph.S[0]+2.6,ph.S[1]+0.4];                                  /* огрех: S′ съехала */
  const pts=[]; Object.keys(DATA).forEach(k=>{ pts.push([k+'″'].concat(pf[k])); pts.push([k==='C'?'C':k+'′'].concat(ph[k])); });
  const seg=(a,b,o)=>Object.assign({p:[a[0],a[1],b[0],b[1]].map(v=>+v.toFixed(2)),src:'model',unverified:false,dash:false},o||{});
  const segs=[seg([-82,0],[8,0])];                                  /* ось x */
  EDGES.forEach(([a,b,hid])=>{ segs.push(seg(pf[a],pf[b],{dash:hid==='f'})); segs.push(seg(ph[a],ph[b],{dash:hid==='h'})); });
  Object.keys(DATA).forEach(k=>segs.push(seg(pf[k],[ph[k][0],ph[k][1]],{src:'found'})));   /* линии связи — тонкие */
  segs.push(seg([-30,-35],[-58,-20],{unverified:true}));              /* огрех: линии на бумаге нет */
  const mm={pts:pts.map(q=>[q[0],+q[1].toFixed(2),+q[2].toFixed(2)]),segs,txt:[[-75,-58,'ДЗ №3 в.21']]};
  return {name:'Пример — ДЗ №3, вариант 21',size:[1500,2000],layout:{rot:0,n:1},demo:true,cost:0,calls:0,seconds:0,
    drawings:[{part:1,box:[0,0,1500,2000],rot:0,ppm:5,mm,circles:[],fit:{dz:3,n:21,inl:8,of:8,rmsMm:0.31,ppm:5},
      pts:mm.pts.map(q=>[q[0],q[1]*5+700,q[2]*5+800]),segs:segs.map(q=>Object.assign({},q,{p:[q.p[0]*5+700,q.p[1]*5+800,q.p[2]*5+700,q.p[3]*5+800]})),txt:[],stats:{model:segs.length,pts:pts.length,kept:segs.length,unverified:1}}]}; }
const api={make,DATA};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else self.DRAWINGS_DEMO=api;
})();
