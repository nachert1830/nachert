/* ═══════════ Ложные срабатывания: сколько заведомо верных решений проверка отвергает ═══════════
   Наборы верных решений:
     1. эталоны — все задачи тетради, разборы ДЗ, типовые задачи РК, рисунки уроков, как на сайте;
     2а. итоговый чертёж эталона с элементами и текстами в другом порядке — проверка не должна зависеть от порядка;
     2б. шаги в обратном и случайном порядке — справочно: промежуточные чертежи тогда неверны (размер раньше точки,
        штриховая раньше закрывающей грани), и замечания на них — верные;
     3. эталон на случайных допустимых данных — tests/random-run.js (там же порог в tests/run.js).
   Считается доля чертежей (задача · пункт), на которых проверка дала замечание уровня «ошибка», и каждое такое замечание — со списком.
   node tests/false-positives.js [--perm=3] [--seed=1] */
const fs=require('fs'), path=require('path'), http=require('http');
let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
const ROOT=path.join(__dirname,'..'), arg=k=>{ const a=process.argv.find(x=>x.startsWith('--'+k+'=')); return a&&a.split('=')[1]; };
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline.json'),'utf8')).accepted.map(a=>a.key);

async function falsePositives(page,opts){
  opts=opts||{}; for(const f of ['geometry','oracle']) await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')});
  return page.evaluate(({PERM,SEED,baseline})=>{ let seed=SEED; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
    const key=o=>[o.name,o.rule,o.msg].join(' | '), errs=L=>L.filter(o=>o.lvl==='ошибка'||!o.lvl);
    const partsOf=t=>(t.parts&&t.parts.length)?t.parts:[t];
    /* 1. эталоны: весь сайт */
    const raw=GEOM_CHECK().concat(ORACLE_CHECK()), all=errs(raw), chk=raw.filter(o=>o.lvl&&o.lvl!=='ошибка');
    const drawings=new Set(), flagged=new Set(); const reg=nm=>nm.replace(/ · (шаг \d+|дано)$/,'');
    COURSE.forEach(l=>(l.blocks||[]).forEach((b,i)=>{ if(b.t==='fig'&&b.scene) drawings.add('Урок '+l.id+' · рисунок '+(i+1)); }));
    const tasks=[]; WB3.tasks.forEach(t=>tasks.push(['Задача №'+t.n,t]));
    ['1','2','2b','2c','3','4a','4b','5'].forEach(id=>{ const d=window.NGHW&&NGHW.get(id); if(d&&d.task) tasks.push(['ДЗ '+id,d.task]); });
    (typeof TK3!=='undefined'?TK3:[]).forEach(tk=>tk.tasks.forEach(t=>tasks.push([tk.title+' · '+(t.idx||t.key),t])));
    let steps=0; tasks.forEach(([nm,t])=>partsOf(t).forEach((p,pi)=>{ drawings.add(nm+(pi?' п.'+(pi+1):'')); steps+=1+(p.steps||[]).length; }));
    all.forEach(o=>flagged.add(reg(o.name)));
    const ref={drawings:drawings.size,steps,issues:all.length,flaggedDrawings:flagged.size,inBaseline:all.filter(o=>baseline.includes(key(o))).length,list:all.map(key),
      check:chk.length,checkBaseline:chk.filter(o=>baseline.includes(key(o))).length,checkList:chk.map(key)};
    /* 2а. итоговый чертёж — те же элементы и тексты в другом порядке: замечаний быть не должно */
    const fin={variants:0,flagged:0,list:[]};
    WB3.tasks.forEach(t=>{ const one=p=>{ const items=[].concat(p.given||t.given||[],...(p.steps||[]).map(s=>s.add||[])), txt=(p.steps||[]).map(s=>[s.t,s.d,s.why].filter(Boolean).join(' ')).join('\n');
        return {items,txt}; };
      const mk=(sh)=>{ const c=Object.assign({},t); const conv=p=>{ const o=one(p); return Object.assign({},p,{given:[],steps:[{t:'итог',d:o.txt,why:'',add:sh(o.items)}]}); };
        if(t.parts&&t.parts.length){ c.parts=t.parts.map(conv); c.given=[]; } else Object.assign(c,conv(t)); return c; };
      const base=new Set(errs(GEOM_CHECK({tasks:[mk(a=>a.slice())]})).map(o=>o.rule+'|'+o.msg));
      for(let k=0;k<PERM;k++){ const sh=a=>{ const b=a.slice(); for(let i=b.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; };
        let got=[]; try{ got=errs(GEOM_CHECK({tasks:[mk(sh)]})); }catch(e){ got=[{name:'Задача №'+t.n,rule:'сбой',msg:String(e)}]; }
        const fresh=got.filter(o=>!base.has(o.rule+'|'+o.msg)); fin.variants++; if(fresh.length){ fin.flagged++; if(fin.list.length<40) fin.list.push('№'+t.n+': '+fresh.slice(0,2).map(o=>o.rule+' — '+o.msg.slice(0,140)).join(' / ')); } } });
    /* 2. другой порядок шагов: для каждой задачи тетради — обратный и PERM случайных */
    const ord={variants:0,flagged:0,list:[]};
    WB3.tasks.forEach(t=>{ const base=new Set(errs(GEOM_CHECK({tasks:[t]})).map(o=>reg(o.name)+'|'+o.rule+'|'+o.msg));
      const orders=[]; partsOf(t).forEach(()=>{}); for(let k=0;k<=PERM;k++) orders.push(k);
      orders.forEach(k=>{ const c=Object.assign({},t);
        const shuffle=a=>{ const b=a.slice(); if(k===0) return b.reverse(); for(let i=b.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; };
        if(t.parts&&t.parts.length) c.parts=t.parts.map(p=>Object.assign({},p,{steps:shuffle(p.steps||[])})); else c.steps=shuffle(t.steps||[]);
        let got=[]; try{ got=errs(GEOM_CHECK({tasks:[c]})).concat(errs(ORACLE_CHECK({tasks:[c]}))); }catch(e){ got=[{name:'Задача №'+t.n,rule:'сбой',msg:String(e)}]; }
        /* замечание, привязанное к шагу, сравниваем без номера шага: шаги переставлены */
        const fresh=got.filter(o=>!base.has(reg(o.name)+'|'+o.rule+'|'+o.msg)); ord.variants++;
        if(fresh.length){ ord.flagged++; if(ord.list.length<40) ord.list.push('№'+t.n+(k?' (случайный порядок)':' (обратный порядок)')+': '+fresh.slice(0,2).map(o=>o.rule+' — '+o.msg.slice(0,140)).join(' / ')); } }); });
    return {ref,fin,ord}; },{PERM:opts.perm||3,SEED:opts.seed||1,baseline});
}
module.exports={falsePositives};

if(require.main===module)(async()=>{
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined});
  const page=await browser.newPage(); await page.goto('http://127.0.0.1:'+srv.address().port+'/'); await page.waitForTimeout(1500);
  const r=await falsePositives(page,{perm:+(arg('perm')||3),seed:+(arg('seed')||1)});
  console.log('1. Эталоны: чертежей '+r.ref.drawings+' (шагов '+r.ref.steps+'), с замечанием «ошибка» — '+r.ref.flaggedDrawings+' ('+(100*r.ref.flaggedDrawings/r.ref.drawings).toFixed(1)+' %); замечаний '+r.ref.issues+', из них разобраны в baseline.json — '+r.ref.inBaseline);
  r.ref.list.forEach(x=>console.log('   '+x));
  console.log('   «проверить» (не ошибка, разбирает человек): '+r.ref.check+', из них разобраны в baseline.json — '+r.ref.checkBaseline);
  r.ref.checkList.forEach(x=>console.log('   '+x));
  console.log('2а. Итоговый чертёж, элементы в другом порядке: вариантов '+r.fin.variants+', с новым замечанием — '+r.fin.flagged+' ('+(100*r.fin.flagged/r.fin.variants).toFixed(1)+' %)');
  r.fin.list.forEach(x=>console.log('   '+x));
  console.log('2б. Шаги в обратном и случайном порядке (зависимости шагов нарушаются, промежуточные чертежи неверны): вариантов '+r.ord.variants+', с новым замечанием — '+r.ord.flagged+' ('+(100*r.ord.flagged/r.ord.variants).toFixed(1)+' %)');
  r.ord.list.forEach(x=>console.log('   '+x));
  await browser.close(); srv.close();
})().catch(e=>{ console.error(e); process.exit(2); });
