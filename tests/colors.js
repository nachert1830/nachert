/* ═══════════ Цвета чертежа: проверка по фактам (docs/color-policy.md, раздел «Наука») ═══════════
   1) каждая линия на белой бумаге — контраст ≥ 3:1 (WCAG 2.1, 1.4.11 «графические объекты»), иначе тонкая линия на
      телефоне на солнце пропадает;
   2) цвета посредников различимы между собой и с красным ответом, чёрным контуром и серым прошлым — ΔE2000 ≥ порога
      при обычном зрении и при протанопии, дейтеранопии, тританопии (симуляция Machado, Oliveira, Fernandes 2009,
      полная тяжесть). Порог для тонких линий выше, чем для пятен: различимость падает с размером метки (Szafir 2018).
   Отдельно: node tests/colors.js — печатает таблицу. */
const M={ /* Machado 2009, severity 1.0, линейный sRGB */
  protan:[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
  deutan:[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
  tritan:[[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]] };
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const lin=c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4), unlin=c=>{ c=Math.min(1,Math.max(0,c)); return c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055; };
const lum=rgb=>{ const [r,g,b]=rgb.map(lin); return 0.2126*r+0.7152*g+0.0722*b; };
const contrast=(a,b)=>{ const [x,y]=[lum(hex(a)),lum(hex(b))].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
function sim(h,k){ if(!k) return hex(h); const l=hex(h).map(lin), m=M[k]; return m.map(r=>unlin(r[0]*l[0]+r[1]*l[1]+r[2]*l[2])); }
function lab(rgb){ const [r,g,b]=rgb.map(lin); let X=(0.4124*r+0.3576*g+0.1805*b)/0.95047, Y=0.2126*r+0.7152*g+0.0722*b, Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883;
  const f=t=>t>216/24389?Math.cbrt(t):(24389/27*t+16)/116; [X,Y,Z]=[X,Y,Z].map(f); return [116*Y-16,500*(X-Y),200*(Y-Z)]; }
function de2000(a,b){ const [L1,a1,b1]=a,[L2,a2,b2]=b, rad=Math.PI/180;
  const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cm=(C1+C2)/2,G=0.5*(1-Math.sqrt(Math.pow(Cm,7)/(Math.pow(Cm,7)+Math.pow(25,7))));
  const A1=a1*(1+G),A2=a2*(1+G),c1=Math.hypot(A1,b1),c2=Math.hypot(A2,b2);
  let h1=Math.atan2(b1,A1)/rad; if(h1<0)h1+=360; let h2=Math.atan2(b2,A2)/rad; if(h2<0)h2+=360;
  const dL=L2-L1,dC=c2-c1; let dh=h2-h1; if(c1*c2===0)dh=0; else if(dh>180)dh-=360; else if(dh<-180)dh+=360;
  const dH=2*Math.sqrt(c1*c2)*Math.sin(dh/2*rad), Lm=(L1+L2)/2, cm=(c1+c2)/2;
  let hm=h1+h2; if(c1*c2!==0){ if(Math.abs(h1-h2)>180) hm+=hm<360?360:-360; hm/=2; }
  const T=1-0.17*Math.cos((hm-30)*rad)+0.24*Math.cos(2*hm*rad)+0.32*Math.cos((3*hm+6)*rad)-0.20*Math.cos((4*hm-63)*rad);
  const SL=1+0.015*Math.pow(Lm-50,2)/Math.sqrt(20+Math.pow(Lm-50,2)),SC=1+0.045*cm,SH=1+0.015*cm*T;
  const RT=-2*Math.sqrt(Math.pow(cm,7)/(Math.pow(cm,7)+Math.pow(25,7)))*Math.sin(60*Math.exp(-Math.pow((hm-275)/25,2))*rad);
  return Math.sqrt(Math.pow(dL/SL,2)+Math.pow(dC/SC,2)+Math.pow(dH/SH,2)+RT*(dC/SC)*(dH/SH)); }
const VIS=[null,'protan','deutan','tritan'], VN={null:'обычное',protan:'протан',deutan:'дейтеран',tritan:'тритан'};
function minDE(a,b){ return Math.min(...VIS.map(k=>de2000(lab(sim(a,k)),lab(sim(b,k))))); }
/* главная мера: обычное зрение и красно-зелёные нарушения (≈ 8 % мужчин); тританопия (≈ 0,01 %) — свой, мягкий порог */
function minRG(a,b){ return Math.min(...[null,'protan','deutan'].map(k=>de2000(lab(sim(a,k)),lab(sim(b,k))))); }
function deT(a,b){ return de2000(lab(sim(a,'tritan')),lab(sim(b,'tritan'))); }
/* палитра чертежа — те же значения, что в index.html (DRAW.PAL, CSS --mc*) и dz/ng/4/solver.js MCOL */
const FIXED={ink:'#15161a',answer:'#c9302c',past:'#a3a9b4'};
const MED=['#117788','#6633dd','#aa2266','#3388ee'];   /* посредники: сине-зелёный, фиолетовый, винный, голубой — подобраны перебором (наибольшая наименьшая ΔE) */
const AUX='#3567b5';   /* построение без своего посредника (синий карандаш) */
const MIN_CONTRAST=3, MIN_DE=14, MIN_DE_T=8;
function check(){ const bad=[];
  MED.concat([FIXED.ink,FIXED.answer,AUX]).forEach(c=>{ const r=contrast(c,'#ffffff'); if(r<MIN_CONTRAST) bad.push({name:'Цвета чертежа',rule:'контраст линии на белом < 3:1',msg:c+': '+r.toFixed(2)}); });
  const all=MED.map((c,i)=>['посредник '+(i+1),c]).concat([['искомое',FIXED.answer],['контур',FIXED.ink],['прошлое',FIXED.past]]);
  for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++){ if(i>=MED.length&&j>=MED.length) continue;
    const d=minRG(all[i][1],all[j][1]), t=deT(all[i][1],all[j][1]);
    if(d<MIN_DE) bad.push({name:'Цвета чертежа',rule:'цвета неразличимы (ΔE2000 < '+MIN_DE+': обычное зрение, протанопия, дейтеранопия)',msg:all[i][0]+' '+all[i][1]+' / '+all[j][0]+' '+all[j][1]+': '+d.toFixed(1)});
    if(t<MIN_DE_T) bad.push({name:'Цвета чертежа',rule:'цвета неразличимы при тританопии (ΔE2000 < '+MIN_DE_T+')',msg:all[i][0]+' / '+all[j][0]+': '+t.toFixed(1)}); }
  [FIXED.answer,FIXED.ink,FIXED.past].forEach(f=>{ const d=minRG(AUX,f); if(d<MIN_DE) bad.push({name:'Цвета чертежа',rule:'синий карандаш неразличим с '+f,msg:d.toFixed(1)}); });
  /* палитра в коде совпадает с проверяемой */
  try{ const fs=require('fs'), path=require('path'), src=fs.readFileSync(path.join(__dirname,'../dz/ng/4/solver.js'),'utf8'), html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
    const m=/const MCOL=\[([^\]]*)\]/.exec(src); const got=m?m[1].match(/#[0-9a-f]{6}/gi).map(x=>x.toLowerCase()):[];
    if(got.join()!==MED.join()) bad.push({name:'Цвета чертежа',rule:'палитра ДЗ №4 (MCOL) не та, что проверена',msg:got.join(' ')});
    if(!html.includes("aux:'"+AUX+"'")) bad.push({name:'Цвета чертежа',rule:'DRAW.PAL.aux не тот, что проверен',msg:AUX}); }catch(e){ bad.push({name:'Цвета чертежа',rule:'не прочитан код',msg:String(e)}); }
  return bad; }
module.exports={check,contrast,minDE,minRG,deT,de2000,lab,sim,MED,FIXED};
if(require.main===module){
  const rows=MED.concat(Object.values(FIXED)); console.log('контраст на белом:'); rows.forEach(c=>console.log(' ',c,contrast(c,'#ffffff').toFixed(2)));
  const all=MED.concat([FIXED.answer,FIXED.ink,FIXED.past,AUX]); console.log('наименьшая ΔE2000 (обычное, протан, дейтеран) / тритан:');
  all.forEach((a,i)=>console.log(' ',a,all.map((b,j)=>j===i?'    —    ':(minRG(a,b).toFixed(1)+'/'+deT(a,b).toFixed(1)).padStart(9)).join(' ')));
  const b=check(); console.log(b.length?b.map(o=>o.rule+' · '+o.msg).join('\n'):'Цвета чертежа: ошибок нет'); process.exit(b.length?1:0); }
