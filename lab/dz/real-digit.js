/* Настоящее фото листа → оцифровка моделью (ProxyAPI) → притяжка к карандашу (refine.js) → JSON в мм не нужен: пиксели фото.
   node lab/dz/real-digit.js фото.jpg серое.pgm [--ppm=3.5] [--out=ответ.json] [--replay=ответ.json]
   Фото не копируется и никуда не публикуется: одно обращение к модели (ProxyAPI), результат — только числа. Нужно NODE_USE_ENV_PROXY=1 */
const fs=require('fs'), SE=require('../../server/lib/eyes.js'), RF=require('./refine.js');
const A=Object.fromEntries(process.argv.slice(4).map(s=>s.replace(/^--/,'').split('='))), [photo,pgm]=process.argv.slice(2,4);
function readPGM(f){ const b=fs.readFileSync(f); let i=0, tok=[]; while(tok.length<4){ while(/\s/.test(String.fromCharCode(b[i]))) i++; let s=''; while(!/\s/.test(String.fromCharCode(b[i]))) s+=String.fromCharCode(b[i++]); tok.push(s); } i++;
  const w=+tok[1], h=+tok[2], a=new Float32Array(w*h); for(let k=0;k<w*h;k++) a[k]=b[i+k]; return {w,h,a}; }
const SYSTEM='Ты — оцифровщик чертежей. На фото — лист с карандашным чертежом по начертательной геометрии (эпюр Монжа): проекции, оси, линии связи, построения. Фото сделано на телефон: тень, блик, возможны линейка и чужие предметы в кадре. Координаты — в пикселях ЭТОГО фото: начало — левый верхний угол, x вправо, y вниз, целые числа.\n'+
 'Выпиши построчно, без пояснений и без markdown:\nP <подпись> <x> <y> — каждая подписанная точка: подпись как на чертеже (A″, B′, H″ …) и где сама точка, не текст подписи;\n'+
 'S <x1> <y1> <x2> <y2> — каждый прямой отрезок чертежа от конца до конца: рёбра, оси, тонкие линии связи и построения; штриховой — с буквой d в конце. Отрезок, прерванный точкой, можно дать одним.\n'+
 'Не выдумывай: чего не видно — не пиши. Рамку листа, штамп, таблицу, предметы в кадре и текст не пиши. Рисуй линии там, где они лежат на фото, даже если построение выглядит неверным.';
(async()=>{ const g=readPGM(pgm); let text;
  if(A.replay) text=JSON.parse(fs.readFileSync(A.replay,'utf8')).text;
  else { const png='data:image/jpeg;base64,'+fs.readFileSync(photo).toString('base64'), cfg=SE.eyesFromEnv({EYES_URL:SE.PX_URL,EYES_MODEL:'anthropic/claude-sonnet-5-5',PROXYAPI_KEY:'x',EYES_BEST_MODEL:'off',EYES_DIGIT_MODEL:'off'});
    const r=await SE.ask(cfg,{image:png,w:g.w,h:g.h,system:SYSTEM,text:'Размер фото: '+g.w+' × '+g.h+' px.',opts:{max_tokens:3000}},{timeout:200000}); text=r.text; console.log('токенов',JSON.stringify(r.info.usage&&{in:r.info.usage.prompt_tokens,out:r.info.usage.completion_tokens}),'finish',r.info.finish);
    if(A.out) fs.writeFileSync(A.out,JSON.stringify({text})); }
  const segs=[], pts=[]; text.split(/\r?\n/).forEach(l=>{ const t=l.replace(/[*`|(),;:]/g,' ').trim().split(/\s+/); if(t[0]==='S'&&t.length>=5) segs.push(t.slice(1,5).map(Number).concat(t[5]==='d'?[1]:[])); else if(t[0]==='P'&&t.length>=4) pts.push([t[1],+t[2],+t[3]]); });
  const rg=pts.length>=4?[Math.min(...pts.map(q=>q[1])),Math.min(...pts.map(q=>q[2])),Math.max(...pts.map(q=>q[1])),Math.max(...pts.map(q=>q[2]))]:null, rf=RF.refine(g,segs,{ppm:+(A.ppm||3.5),region:rg,points:pts.map(q=>[q[1],q[2]])});
  console.log('модель: отрезков',segs.length,'точек',pts.length,'| притяжка: оставлено',rf.stats.kept,'не подтверждено (оставлено)',rf.stats.unverified,'отброшено',rf.stats.dropped,'фото надёжное',rf.stats.reliable,'найдено',rf.stats.found,'порог',rf.stats.thr.toFixed(2));
  if(A.json) fs.writeFileSync(A.json,JSON.stringify({model:segs,pts,kept:rf.segs.map(q=>({p:q.p,src:q.src,ink:q.ink,unv:!!q.unverified})),dropped:rf.dropped.map(d=>d.p)})); })().catch(e=>{ console.error(e.message); process.exit(1); });
