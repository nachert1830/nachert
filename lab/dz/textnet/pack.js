/* Слой «своя геометрия + Claude читает»: фото → линии (vec.js) + кружки над текстом (blobs.js) → картинка с номерами для Claude
   → ответ «N: подпись» → цифровая копия (SVG + JSON в px и в мм, если дана гомография).
   node lab/dz/textnet/pack.js фото.png [--out=каталог] [--answers=файл.json]  (без --answers — только картинка и запрос)
   Claude ничего не меряет: он читает подпись в заданном кружке и отвечает «-», если там не текст. */
const IMG=require('../../img.js'), B=require('./blobs.js'), V=require('./vec.js'), fs=require('fs');
const FONT={'0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001001010010','8':'111101111101111','9':'111101111001111'};
const PROMPT='На фото чертёжного листа красными кружками с номерами отмечены места, где, возможно, написан текст (буква с индексом, число, формула). '+
 'Для КАЖДОГО номера прочитай, что написано внутри кружка. Если там не текст (обрывок линии, пятно, край листа) — ответь «-». '+
 'Индексы и штрихи сохраняй: A″ (два штриха — фронтальная проекция), A′ (один — горизонтальная), h₀₁, x₁₄, φ°, 1″…20″, числа с единицами. '+
 'Ничего не измеряй и не придумывай. Ответ — только JSON: {"1":"A″","2":"-","3":"h₀₁",…}.';
function number(o,w,x,y,n,c){ String(n).split('').forEach((ch,k)=>{ const g=FONT[ch]; if(!g) return; for(let j=0;j<15;j++) if(g[j]==='1'){ const px=x+k*4+(j%3), py=y+Math.floor(j/3); const i=(py*w+px)*4; if(px>=0&&py>=0&&i>=0&&i<o.data.length){ o.data[i]=c[0]; o.data[i+1]=c[1]; o.data[i+2]=c[2]; } } }); }
/* картинка для Claude: кружки + номера (цифры 3×5 px, масштабируются вместе с кружком не нужны — ставятся справа сверху) */
function annotate(im,circles){ const k=Math.max(1,Math.round(Math.min(im.width,im.height)/700)), W=im.width*k, H=im.height*k, o={width:W,height:H,data:new Uint8ClampedArray(W*H*4)};
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const s=(Math.floor(y/k)*im.width+Math.floor(x/k))*4, d=(y*W+x)*4; o.data[d]=im.data[s]; o.data[d+1]=im.data[s+1]; o.data[d+2]=im.data[s+2]; o.data[d+3]=255; }
  const put=(x,y,c)=>{ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=W||y>=H) return; const i=(y*W+x)*4; o.data[i]=c[0]; o.data[i+1]=c[1]; o.data[i+2]=c[2]; };
  circles.forEach(c=>{ const r=c.r*k; for(let a=0;a<6.283;a+=0.4/Math.max(4,r)) put(c.cx*k+r*Math.cos(a),c.cy*k+r*Math.sin(a),[230,0,0]);
    /* номер — тем крупнее, чем крупнее снимок (цифры 3×5, увеличение s) */ const s=Math.max(1,k); const lab=String(c.id), x0=Math.round(c.cx*k+r*0.7), y0=Math.round(c.cy*k-r*0.7-5*s);
    for(let j=0;j<lab.length;j++){ const g=FONT[lab[j]]; if(!g) continue; for(let q=0;q<15;q++) if(g[q]==='1') for(let sy=0;sy<s;sy++) for(let sx=0;sx<s;sx++) put(x0+(j*4+(q%3))*s+sx,y0+Math.floor(q/3)*s+sy,[230,0,0]); } });
  return o; }
function scene(r,circles,answers){ const labels=circles.filter(c=>{ const t=(answers||{})[c.id]; return t&&t!=='-'; }).map(c=>({id:c.id,text:answers[c.id],at:[+c.cx.toFixed(1),+c.cy.toFixed(1)],r:+c.r.toFixed(1)}));
  return {w:r.w,h:r.h,lines:r.segs.map(s=>({a:s.a.map(v=>+v.toFixed(2)),b:s.b.map(v=>+v.toFixed(2)),width:s.width,support:+s.support.toFixed(2)})),labels,selfcheck:{recall:+r.recall.toFixed(3),support:+r.support.toFixed(3)}}; }
function svg(sc){ return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+sc.w+' '+sc.h+'"><rect width="100%" height="100%" fill="#fff"/>'+sc.lines.map(l=>'<line x1="'+l.a[0]+'" y1="'+l.a[1]+'" x2="'+l.b[0]+'" y2="'+l.b[1]+'" stroke="#000" stroke-width="'+Math.max(0.8,l.width*0.8).toFixed(1)+'"/>').join('')+
  sc.labels.map(t=>'<text x="'+t.at[0]+'" y="'+t.at[1]+'" font-size="'+(t.r*1.6).toFixed(1)+'" font-family="serif" font-style="italic" text-anchor="middle" dominant-baseline="central" fill="#c00">'+t.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</text>').join('')+'</svg>'; }
module.exports={annotate,scene,svg,PROMPT,detect:(im)=>{ const r=V.vectorize(im), t=B.detect(im), circles=t.circles.map((c,i)=>Object.assign({id:i+1},c)); return {r,circles}; }};
if(require.main===module){ const f=process.argv[2], A=Object.fromEntries(process.argv.slice(3).map(s=>s.replace(/^--/,'').split('='))), im=IMG.decodePNG(fs.readFileSync(f)), {r,circles}=module.exports.detect(im), base=(A.out||'.')+'/'+require('path').basename(f,'.png');
  fs.writeFileSync(base+'-claude.png',IMG.encodePNG(annotate(im,circles))); const ans=A.answers?JSON.parse(fs.readFileSync(A.answers,'utf8')):null, sc=scene(r,circles,ans); fs.writeFileSync(base+'-scene.json',JSON.stringify(sc)); fs.writeFileSync(base+'-copy.svg',svg(sc));
  console.log('кружков '+circles.length+', линий '+sc.lines.length+', подписей '+sc.labels.length+' → '+base+'-claude.png'); }
