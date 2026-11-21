#!/usr/bin/env node
/* Наглядность пар «верно / ловушка» (подготовка, оба предмета): для каждой темы и ловушки — N пар, обе карточки рисуются
   движком в одинаковом окне 320×320, сравниваются попиксельно. Доля отличающихся пикселей — насколько заметна ошибка.
   node tools/prep-contrast.js [--subj=ig|ng] [--n=3] [--ids=v1,v2]  → таблица от самых неочевидных. */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
const arg=k=>(process.argv.find(a=>a.startsWith('--'+k+'='))||'').split('=')[1];
const SUBJ=arg('subj')||'ig', N=+(arg('n')||3), IDS=arg('ids');
(async()=>{
  const {chromium}=require('playwright');
  const srv=await new Promise(r=>{ const s=http.createServer((q,res)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ res.writeHead(404); return res.end(); }
    res.writeHead(200,{'content-type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json'}[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(res); }).listen(0,()=>r(s)); });
  const b=await chromium.launch(), pg=await b.newPage({viewport:{width:700,height:400}});
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/#/prep'); await pg.waitForFunction(()=>window.PREP&&window.PREPIG&&window.IG3,null,{timeout:60000});
  const ids=IDS?IDS.split(','):await pg.evaluate(s=>(s==='ig'?PREPIG:PREPROG).ALL.map(t=>t.id).filter(id=>PREP.TOPICS[id]),SUBJ);
  const rows=[];
  for(const id of ids){
    const keys=await pg.evaluate(id=>Object.keys(PREP.TOPICS[id].traps),id);
    for(const k of keys){ const vals=[];
      for(let i=0;i<N;i++){
        const ok=await pg.evaluate(([id,k])=>{ document.body.innerHTML='<div class="pp" style="display:flex;gap:10px;background:#fff"><svg id="a" width="320" height="320"></svg><svg id="b" width="320" height="320"></svg></div>';
          const p=PREP.pair(PREP.TOPICS[id],k); if(!p) return false; PREP.draw(document.getElementById('a'),p.ok); PREP.draw(document.getElementById('b'),p.bad);
          document.querySelectorAll('.pp-grid').forEach(g=>g.remove()); return true; },[id,k]);
        if(!ok) continue;
        const A=await (await pg.$('#a')).screenshot(), B=await (await pg.$('#b')).screenshot();
        vals.push(await pg.evaluate(async([a,b])=>{ const ld=s=>new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src='data:image/png;base64,'+s; });
          const [ia,ib]=await Promise.all([ld(a),ld(b)]), c=document.createElement('canvas'); c.width=ia.width; c.height=ia.height; const x=c.getContext('2d');
          x.drawImage(ia,0,0); const da=x.getImageData(0,0,c.width,c.height).data; x.clearRect(0,0,c.width,c.height); x.drawImage(ib,0,0); const db=x.getImageData(0,0,c.width,c.height).data;
          let d=0, ink=0; for(let i=0;i<da.length;i+=4){ const sa=da[i]+da[i+1]+da[i+2], sb=db[i]+db[i+1]+db[i+2]; if(sa<600||sb<600) ink++; if(Math.abs(sa-sb)>90) d++; } return d/Math.max(1,ink); },[A.toString('base64'),B.toString('base64')]));
      }
      const v=vals.length?vals.reduce((a,c)=>a+c,0)/vals.length:0; rows.push({id,k,v,n:vals.length}); process.stdout.write('.'); }
  }
  rows.sort((a,b)=>a.v-b.v); console.log('\nтема/ловушка  доля отличающихся пикселей (от рисунка)');
  rows.forEach(r=>console.log(`${(r.id+'/'+r.k).padEnd(10)} ${(r.v*100).toFixed(1).padStart(6)} %  (${r.n})`));
  await b.close(); srv.close();
})().catch(e=>{ console.error(e); process.exit(1); });
