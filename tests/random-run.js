/* node tests/random-run.js [--seeds N] — прогон случайных вариантов отдельно (в run.js он тоже есть) */
const http=require('http'), fs=require('fs'), path=require('path');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const R=require('./random.js'), ROOT=path.join(__dirname,'..');
const SEEDS=+((process.argv.find(a=>/^--seeds=/.test(a))||'').split('=')[1]||12);
function serve(){ return new Promise(res=>{ const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
  const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(srv)); }); }
/* вложенные (function(){…})(); внутри блока — по задаче на каждую: оборачиваем в try, чтобы вариант без решения
   у одной задачи не обрывал построение остальных */
function isolate(src){
  let acorn; try{ acorn=require('acorn'); }catch(e){ acorn=require('/opt/node-tools/node_modules/acorn'); }
  let ast; try{ ast=acorn.parse(src,{ecmaVersion:'latest'}); }catch(e){ return src; }
  const st=ast.body[0], fn=st&&st.expression&&st.expression.callee; if(!fn||!/Function/.test(fn.type)||!fn.body||!fn.body.body) return src;
  const iife=n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&/Function/.test(n.expression.callee.type);
  const parts=fn.body.body.filter(iife); if(parts.length<2) return src;
  let out='', at=0; parts.forEach(n=>{ out+=src.slice(at,n.start)+'try{'+src.slice(n.start,n.end)+'}catch(e){ (window.__RVERR=window.__RVERR||[]).push(String(e&&e.message||e)); }'; at=n.end; });
  return out+src.slice(at); }
async function runVariants(page,seeds){
  for(const f of ['geometry','oracle']) await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')});
  const res=[];
  for(const b of R.blocks()){
    const variants=[{seed:0,src:isolate(b.src)}].concat(Array.from({length:seeds},(_,i)=>({seed:i+1,src:isolate(R.perturb(b.src,1000+i*7919).src)})));
    const r=await page.evaluate(vs=>{
      const keep=WB3.tasks.slice(), old=new Set(keep), out=[];
      for(const v of vs){ let added=[], err=null;
        window.__RVERR=[];
        try{ (0,eval)(v.src); added=WB3.tasks.filter(t=>!old.has(t)); }catch(e){ err=String(e&&e.message||e); }
        const inner=window.__RVERR.slice();
        WB3.tasks.length=0; keep.forEach(t=>WB3.tasks.push(t));
        const iss=err?[]:GEOM_CHECK({tasks:added}).concat(ORACLE_CHECK({tasks:added})).filter(o=>o.lvl==='ошибка').map(o=>({n:o.name.replace(/ · (шаг \d+|дано)$/,''),rule:o.rule,msg:o.msg}));
        /* числа на чертеже: подпись и длина того, что она подписывает */
        const nums=[]; added.forEach(t=>{ const parts=(t.parts&&t.parts.length)?t.parts:[t]; parts.forEach((p,pi)=>{ const occ={};
          [].concat(p.given||t.given||[],...(p.steps||[]).map(s=>s.add||[])).forEach(it=>{ if(!it||!it.l||typeof it.l!=='string') return;
            if(!/\d\s*(мм|°)|^[xyzΔ][^=]*=\s*[−-]?\d/.test(it.l)) return;
            let m=null; if((it.t==='seg'||it.t==='dim')&&it.a&&it.b) m=Math.hypot(it.a[0]-it.b[0],it.a[1]-it.b[1]);
            else if(it.t==='ang'&&it.at&&it.p1&&it.p2){ const a1=Math.atan2(it.p1[1]-it.at[1],it.p1[0]-it.at[0]), a2=Math.atan2(it.p2[1]-it.at[1],it.p2[0]-it.at[0]); let d=Math.abs(a1-a2); if(d>Math.PI) d=2*Math.PI-d; m=d*180/Math.PI; }
            if(m==null) return; const tpl=it.l.replace(/<[^>]+>/g,'').replace(/[−-]?\d+(?:[.,]\d+)?/g,'#'); occ[tpl]=(occ[tpl]||0)+1;
            nums.push({key:t.n+'|'+pi+'|'+tpl+'|'+occ[tpl],l:it.l.replace(/<[^>]+>/g,''),m}); }); }); });
        const sig={}; added.forEach(t=>{ let h=0; const parts=(t.parts&&t.parts.length)?t.parts:[t]; parts.forEach(p=>[].concat(p.given||t.given||[],...(p.steps||[]).map(s=>s.add||[])).forEach(it=>{ if(it&&it.t==='pt'&&it.at) h+=Math.abs(it.at[0])*1.3+Math.abs(it.at[1])*0.7; })); sig[t.n]=h; });
        out.push({seed:v.seed,err,inner,sig,tasks:added.map(t=>t.n),fixed:added.filter(t=>t.fixed).map(t=>t.n),iss,nums}); }
      return out; },variants);
    /* задачи с числовым условием (fixed): числа задаёт условие, на вариантах проверяется только геометрия */
    const FIX=new Set((r[0].fixed||[]).map(n=>'Задача №'+n)), NUMR=/^(число|угол|координаты|точность|размер)/;
    r.forEach(v=>{ v.iss=v.iss.filter(o=>!(FIX.has(o.n.replace(/ п\.\d+$/,''))&&(NUMR.test(o.rule)||o.rule==='оракул')));   /* числа условия проверяет оракул на исходных данных */ v.nums=(v.nums||[]).filter(o=>!FIX.has('Задача №'+o.key.split('|')[0])); });
    const base=new Set(r[0].iss.map(o=>o.n+'|'+o.rule));
    const tasks=r[0].tasks;
    /* вариант, на котором построение невозможно (у задачи нет решения), — не ошибка, если таких единицы */
    /* вариант, на котором построение не существует (прямая мимо сферы, пустое пересечение) — вырожденный, не ошибка */
    const DEG=/reading '0'|of null|of undefined|is not iterable|NaN/;
    const errs=r.slice(1).filter(v=>v.err), degen=errs.every(v=>DEG.test(v.err))&&errs.length<=0.5*(r.length-1);
    const bad={}, info=degen&&errs.length?['вырожденных вариантов '+errs.length+' из '+(r.length-1)]:[];
    /* задачи, выпавшие из варианта из-за ошибки внутри своей задачи: вырожденный вариант, если ошибка «пустое пересечение» */
    if((r[0].inner||[]).length) (bad['сбой']=bad['сбой']||[]).push({seed:0,msg:'на исходных данных: '+r[0].inner[0]});
    const drop={}; r.slice(1).forEach(v=>{ if(v.err) return; (v.inner||[]).forEach(e=>{ if(!DEG.test(e)) (bad['сбой']=bad['сбой']||[]).push({seed:v.seed,msg:e}); });
      r[0].tasks.filter(n=>!v.tasks.includes(n)).forEach(n=>drop[n]=(drop[n]||0)+1); });
    Object.entries(drop).forEach(([n,c])=>{ if(c>0.6*(r.length-1)) (bad['Задача №'+n+'|вариант без решения']=bad['Задача №'+n+'|вариант без решения']||[]).push({seed:0,msg:'выпадает в '+c+' из '+(r.length-1)+' вариантов'}); else info.push('вырожденных вариантов '+c+' из '+(r.length-1)+' (№'+n+')'); });
    r.slice(1).forEach(v=>{ if(v.err){ if(!degen) (bad['сбой']=bad['сбой']||[]).push({seed:v.seed,msg:v.err}); return; }
      v.iss.forEach(o=>{ const k=o.n+'|'+o.rule; if(base.has(k)) return; (bad[k]=bad[k]||[]).push({seed:v.seed,msg:o.msg}); }); });
    /* подпись не изменилась, а то, что она подписывает, изменилось — число набрано руками, а не вычислено */
    (r[0].nums||[]).forEach(n0=>{ let same=0, moved=0, tot=0; r.slice(1).forEach(v=>{ const n=(v.nums||[]).find(o=>o.key===n0.key); if(!n) return; tot++;
        if(Math.abs(n.m-n0.m)>(/°/.test(n0.l)?1.5:Math.max(1,0.06*n0.m))){ moved++; if(n.l===n0.l) same++; } });
      if(moved>=Math.max(2,tot/2)&&same===moved){ const k='Задача №'+n0.key.split('|')[0]+'|число набрано вручную'; (bad[k]=bad[k]||[]).push({seed:0,msg:'«'+n0.l+'» не меняется, хотя подписанный элемент меняется'}); } });
    const still=tasks.filter(n=>!r.slice(1).some(v=>!v.err&&v.sig&&Math.abs((v.sig[n]||0)-(r[0].sig[n]||0))>1));
    if(still.length) info.push('не искажаются: '+still.join(', '));
    res.push({line:b.line,tasks,base:[...base],bad,info,still});
  }
  return res;
}
module.exports={runVariants};
if(require.main===module)(async()=>{
  const srv=await serve(), URL='http://127.0.0.1:'+srv.address().port+'/';
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined});
  const page=await browser.newPage(); await page.goto(URL); await page.waitForTimeout(1500);
  const res=await runVariants(page,SEEDS);
  let clean=0, total=0;
  res.forEach(b=>{ total+=b.tasks.length; const ks=Object.keys(b.bad); if(b.info.length) console.log('  (задачи '+b.tasks.join(', ')+': '+b.info.join('; ')+')'); if(!ks.length){ clean+=b.tasks.length; return; }
    console.log('\n■ строка '+b.line+' · задачи '+b.tasks.join(', '));
    ks.forEach(k=>console.log('   '+k+'  ×'+b.bad[k].length+'/'+SEEDS+'  — '+b.bad[k][0].msg.slice(0,150))); });
  const st=res.reduce((a,b)=>a.concat(b.still||[]),[]);
  console.log('\nЗадач в блоках без замечаний на всех вариантах: '+clean+' из '+total+'; не искажаются (данные не числами): '+(st.join(', ')||'нет'));
  await browser.close(); srv.close();
})();
