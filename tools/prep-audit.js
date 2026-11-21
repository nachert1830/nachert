#!/usr/bin/env node
/* Придирчивая проверка интерактивных тем подготовки (оба предмета): node tools/prep-audit.js [--subj=ig|ng] [--n=3]
   На каждую тему и ловушку — n пар: подсветка ловушки (hl) находит элементы и в неверной, и в верной карточке; верная и
   неверная различаются именно в подсвечиваемых элементах; нет NaN; рамка не вырождена; шаги «Смотри» не пустые;
   фраза ловушки — с заглавной, без точки в конце, короче 160 символов. */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
const arg=k=>(process.argv.find(a=>a.startsWith('--'+k+'='))||'').split('=')[1];
const SUBJ=arg('subj')||'ig', N=+(arg('n')||3);
(async()=>{ const {chromium}=require('playwright');
  const srv=await new Promise(r=>{ const s=http.createServer((q,res)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
    if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ res.writeHead(404); return res.end(); }
    res.writeHead(200,{'content-type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json'}[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(res); }).listen(0,()=>r(s)); });
  const b=await chromium.launch(), pg=await b.newPage(), errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/#/prep'); await pg.waitForFunction(()=>window.PREP&&window.PREPIG&&window.IG3,null,{timeout:60000});
  const rep=await pg.evaluate(([subj,N])=>{ const G=subj==='ig'?PREPIG:PREPROG, out=[];
    const key=(S,roles)=>JSON.stringify(S.E.filter(e=>roles.includes(e.role)).map(e=>[e.t,e.a,e.p,e.d,e.c,e.dash,e.s,e.size,e.lab]));
    for(const T of G.ALL){ const t=PREP.TOPICS[T.id]; if(!t){ out.push([T.id,'','нет интерактива']); continue; }
      for(const [k,tr] of Object.entries(t.traps)){
        if(!/^[А-ЯЁA-Zα-ωℓ0-9«μ]|^[a-z][′″‴₀-₉\s]/.test(tr.say)) out.push([T.id,k,'фраза ловушки не с заглавной: '+tr.say]);
        if(/\.\s*$/.test(tr.say)) out.push([T.id,k,'фраза ловушки с точкой в конце']);
        if(tr.say.length>160) out.push([T.id,k,'фраза ловушки длиннее 160: '+tr.say.length]);
        if(!tr.hl||!tr.hl.length) out.push([T.id,k,'у ловушки нет hl']);
        for(let i=0;i<N;i++){ let p; try{ p=PREP.pair(t,k); }catch(e){ out.push([T.id,k,'исключение: '+e.message]); break; }
          if(!p){ out.push([T.id,k,'пара не собралась']); break; }
          const rb=new Set(p.bad.E.map(e=>e.role)), ro=new Set(p.ok.E.map(e=>e.role));
          /* движок подсвечивает hl на неверной и рисует «как надо» по hl верной — нужно хоть одно из двух */
          if(!tr.hl.some(r=>rb.has(r)||ro.has(r))) out.push([T.id,k,'подсветке нечего показать ни на одной карточке']);
          if(key(p.ok,tr.hl)===key(p.bad,tr.hl)) out.push([T.id,k,'в подсвечиваемых элементах карточки не различаются']);
          if(/NaN|Infinity/.test(JSON.stringify([p.ok,p.bad]))) out.push([T.id,k,'NaN в сцене']);
          const bx=p.ok.box; if(!(bx[2]>5&&bx[3]>5&&bx[2]<5000&&bx[3]<5000)) out.push([T.id,k,'рамка вырождена: '+bx.map(v=>Math.round(v))]);
        } }
      try{ let V=null; for(let i=0;i<50&&!(V&&t.scene(V,null));i++) V=t.watch.V?t.watch.V.call(t):t.make.call(t); const S=t.scene(V,null), R=new Set(S.E.map(e=>e.role));
        t.watch.steps.forEach((s,i)=>{ if(s.roles.length&&!s.roles.some(r=>R.has(r))) out.push([T.id,'','шаг «Смотри» '+(i+1)+' пустой']);   /* пустой список ролей — «только данные задачи» */ if(!s.cap||s.cap.length<8) out.push([T.id,'','короткая подпись шага '+(i+1)]); });
        const prev=new Set(); t.watch.steps.forEach((s,i)=>{ const add=s.roles.filter(r=>R.has(r)&&!prev.has(r)); if(i&&!add.length) out.push([T.id,'','шаг «Смотри» '+(i+1)+' ничего не добавляет']); s.roles.forEach(r=>prev.add(r)); });
      }catch(e){ out.push([T.id,'','«Смотри» упал: '+e.message]); } }
    return out; },[SUBJ,N]);
  const seen=new Set(); rep.forEach(r=>{ const k=r.join('|'); if(seen.has(k)) return; seen.add(k); console.log(r[0].padEnd(5),(r[1]||'').padEnd(3),r[2]); });
  console.log(`замечаний: ${seen.size}; ошибки страницы: ${errs.length} ${errs.slice(0,3).join(' | ')}`);
  await b.close(); srv.close(); })().catch(e=>{ console.error(e); process.exit(1); });
