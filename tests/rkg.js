/* ═══════════ «Сдашь РК2?» (#/rk): билет-игра по начерту и инже ═══════════
   1. Вопросы: у каждого 4 варианта, верный индекс в пределах, у каждого неверного — объяснение ошибки.
   2. Билеты: в каждом режиме на 40 билетах — нужное число заданий, ровно один верный вариант в каждом, задания не
      повторяются, картинки вариантов различимы, есть и начерт, и инжа (в миксе), у каждого задания — тема с адресом.
   3. Чертежи ИГ — независимо от кода видов: деталь записана заново как тело (точка внутри / снаружи) по её размерам,
      виды проверяются лучами. ЕСКД: вид слева — справа от главного, зритель слева (X = −y), вид сверху — под главным
      (Y = y): задняя сторона детали обращена к главному виду.
      • уголок: контур вида слева = силуэт тела вдоль x; штриховые — ровно на границах отверстий (z = zc ± rh в пределах
        стенки, y = yv ± rv в пределах плиты); на виде сверху — уступ стенки y = yIn основной линией, отверстие ⌀2rv при y = yv;
        каждый неверный вариант с верным НЕ совпадает (зеркальный, отверстие не на той глубине, невидимое — сплошной);
      • втулка: штриховка половины разреза = материал в плоскости y = 0 (точка заштрихована ⟺ там тело), разрез справа,
        граница — ось; неверные варианты нарушают ровно это.
   4. Экраны: каждый режим проходится нажатиями до итога без ошибок JS; результат и рекорд сохраняются; превью игры
      на главной больше нет.
   Запуск: из tests/run.js; отдельно — node tests/rkg.js */
async function rkgCheck(page,URL){
  const bad=[], add=(name,rule,msg)=>bad.push({name,rule,msg:String(msg).slice(0,200)});
  const errs=[]; const onErr=e=>errs.push(String(e)); page.on('pageerror',onErr);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(URL+'#/about'); await page.waitForTimeout(800);
  const r=await page.evaluate(()=>{ const out=[], A=(n,r,m)=>out.push([n,r,m]);
    const {TQ,TOP,MODES,build,_:X}=RKG;
    /* 1. вопросы */
    const ids=new Set();
    TQ.forEach(q=>{ if(ids.has(q.id)) A(q.id,'id','повтор'); ids.add(q.id);
      if(!TOP[q.tag]) A(q.id,'тема','нет темы '+q.tag); if(q.o.length!==4) A(q.id,'варианты','не 4');
      if(!(q.c>=0&&q.c<q.o.length)) A(q.id,'ответ','c вне вариантов');
      q.o.forEach((_,i)=>{ if(i!==q.c&&!(q.w&&q.w[i])) A(q.id,'объяснение','у варианта '+i+' нет объяснения ошибки'); });
      if(new Set(q.o).size!==q.o.length) A(q.id,'варианты','одинаковые'); });
    /* 2. билеты */
    for(const m of Object.keys(MODES)) for(let k=0;k<40;k++){ const qs=build(m), nm=m+' #'+k;
      if(qs.length<MODES[m].n) A(nm,'билет','заданий '+qs.length+' из '+MODES[m].n);
      const gs=qs.map(q=>q.g); if(new Set(gs).size!==gs.length) A(nm,'билет','задание повторяется: '+gs.join());
      if(m==='mix'&&(!qs.some(q=>q.s==='ng')||!qs.some(q=>q.s==='ig'))) A(nm,'билет','нет одного из предметов');
      if(m!=='mix'&&qs.some(q=>q.s!==m)) A(nm,'билет','чужой предмет');
      if(!qs[0].pic) A(nm,'билет','первое задание — без чертежа');
      qs.forEach(q=>{ const okN=q.opts.filter(o=>o.ok).length; if(okN!==1) A(nm+' '+q.g,'варианты','верных '+okN);
        if(!TOP[q.tag]) A(nm+' '+q.g,'тема','нет темы');
        if(q.opts.some(o=>!o.ok&&!o.err)) A(nm+' '+q.g,'варианты','неверный без объяснения');
        if(q.opts[0].svg&&new Set(q.opts.map(o=>o.svg.replace(/rkh\d+/g,''))).size!==q.opts.length) A(nm+' '+q.g,'варианты','одинаковые картинки'); }); }
    /* 3. чертежи ИГ: тело заново, проверка лучами */
    const EPS=.05;
    const pip=(p,P)=>{ let c=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ const [xi,yi]=P[i],[xj,yj]=P[j]; if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi) c=!c; } return c; };
    const dSeg=(p,a,b)=>{ const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy; let t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0; t=Math.max(0,Math.min(1,t)); return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy); };
    const nearB=(p,P,d)=>P.some((q,i)=>dSeg(p,q,P[(i+1)%P.length])<d);
    for(let k=0;k<60;k++){ const B=X.bracket(), M=B.M, nm='уголок s='+M.s+' #'+k;
      const yIn=M.s*(M.W/2-M.T), yOut=M.s*M.W/2, yLo=Math.min(yIn,yOut), yHi=Math.max(yIn,yOut);
      const solid=(x,y,z)=>{ if(Math.abs(x)>M.L/2) return false;
        const base=Math.abs(y)<=M.W/2&&z>=0&&z<=M.H1, wall=y>=yLo&&y<=yHi&&z>=M.H1&&z<=M.Ht;
        if(!base&&!wall) return false;
        if(wall&&x*x+(z-M.zc)**2<M.rh*M.rh) return false;
        if(base&&x*x+(y-M.yv)**2<M.rv*M.rv) return false; return true; };
      const occX=(y,z)=>{ for(let x=-M.L/2;x<=M.L/2;x+=1) if(solid(x,y,z)) return true; return false; };
      /* вид слева: X = −y */
      const chkLeft=it=>{ const P=it.find(e=>e.t==='p').p, fails=[];
        for(let y=-M.W/2-4;y<=M.W/2+4;y+=1.7) for(let z=-4;z<=M.Ht+4;z+=1.7){ const p=[-y,z]; if(nearB(p,P,.6)) continue; if(pip(p,P)!==occX(y,z)) fails.push('силуэт в y='+y.toFixed(1)+', z='+z.toFixed(1)); }
        const hs=it.filter(e=>e.t==='l'&&e.s==='h');
        const onHole=e=>{ const [a,b]=[e.a,e.b];
          if(Math.abs(a[1]-b[1])<EPS){ const z=a[1]; const ys=[-a[0],-b[0]].sort((u,v)=>u-v); return Math.abs(Math.abs(z-M.zc)-M.rh)<EPS&&Math.abs(ys[0]-yLo)<EPS&&Math.abs(ys[1]-yHi)<EPS; }
          if(Math.abs(a[0]-b[0])<EPS){ const y=-a[0]; return Math.abs(Math.abs(y-M.yv)-M.rv)<EPS&&Math.min(a[1],b[1])>=-EPS&&Math.abs(Math.max(a[1],b[1])-M.H1)<EPS; } return false; };
        if(hs.length!==4) fails.push('штриховых '+hs.length+' вместо 4');
        hs.forEach(e=>{ if(!onHole(e)) fails.push('штриховая не на границе отверстия: '+JSON.stringify([e.a,e.b])); });
        return fails; };
      /* вид сверху: Y = y */
      const chkTop=it=>{ const fails=[], ls=it.filter(e=>e.t==='l');
        if(!ls.some(e=>e.s==='m'&&Math.abs(e.a[1]-yIn)<EPS&&Math.abs(e.b[1]-yIn)<EPS&&Math.abs(Math.abs(e.a[0]-e.b[0])-M.L)<EPS)) fails.push('нет уступа стенки y='+yIn);
        const c=it.find(e=>e.t==='c'); if(!c||Math.abs(c.c[1]-M.yv)>EPS||Math.abs(c.r-M.rv)>EPS) fails.push('отверстие не при y='+M.yv);
        const hs=ls.filter(e=>e.s==='h'); if(hs.length!==2) fails.push('штриховых '+hs.length+' вместо 2');
        hs.forEach(e=>{ const ys=[e.a[1],e.b[1]].sort((u,v)=>u-v); if(Math.abs(Math.abs(e.a[0])-M.rh)>EPS||Math.abs(ys[0]-yLo)>EPS||Math.abs(ys[1]-yHi)>EPS) fails.push('штриховая не на отверстии стенки'); });
        return fails; };
      const L0=chkLeft(B.left()); if(L0.length) A(nm,'вид слева',L0.slice(0,2).join('; '));
      ['mirror','vSide','solid'].forEach(d=>{ if(!chkLeft(B.left({[d]:1})).length) A(nm,'вид слева: '+d,'неверный вариант прошёл проверку как верный'); });
      const T0=chkTop(B.top()); if(T0.length) A(nm,'вид сверху',T0.slice(0,2).join('; '));
      ['mirror','vSide','solid'].forEach(d=>{ if(!chkTop(B.top({[d]:1})).length) A(nm,'вид сверху: '+d,'неверный вариант прошёл проверку как верный'); });
      /* главный вид: силуэт — прямоугольник L×Ht, отверстие стенки — окружность при z=zc */
      const F=B.front(), c=F.find(e=>e.t==='c'); if(!c||Math.abs(c.c[1]-M.zc)>EPS||Math.abs(c.r-M.rh)>EPS) A(nm,'главный вид','отверстие стенки не там');
    }
    for(let k=0;k<40;k++){ const S=X.sleeve(), M=S.M, nm='втулка #'+k;
      const mat=(x,z)=>{ const ax=Math.abs(x); if(ax<M.r0) return false;
        const fl=ax<=M.R&&z>=0&&z<=M.h1, hub=ax<=M.r&&z>=M.h1&&z<=M.h2; if(!fl&&!hub) return false;
        if(fl&&!hub&&Math.abs(ax-M.xf)<M.rf) return false; return true; };
      const chk=it=>{ const fails=[], X_=it.filter(e=>e.t==='x').map(e=>e.p);
        for(let x=-M.R-3;x<=M.R+3;x+=1.3) for(let z=-3;z<=M.h2+3;z+=1.3){ const p=[x,z]; if(X_.some(P=>nearB(p,P,.5))) continue;
          const h=X_.some(P=>pip(p,P)), want=x>0&&mat(x,z); if(h!==want){ fails.push((h?'заштриховано':'не заштриховано')+' в x='+x.toFixed(1)+', z='+z.toFixed(1)); break; } }
        const ax=it.find(e=>e.t==='l'&&e.s==='a'&&Math.abs(e.a[0])<EPS&&Math.abs(e.b[0])<EPS); if(!ax) fails.push('граница вида и разреза — не ось');
        if(it.some(e=>e.s==='h')) fails.push('штриховые на половине вида');
        if(it.some(e=>e.t==='l'&&e.s==='m'&&Math.abs(e.a[0])<EPS&&Math.abs(e.b[0])<EPS&&Math.abs(e.a[1]-e.b[1])>M.h1)) fails.push('по оси — основная линия');
        return fails; };
      const s0=chk(S.front()); if(s0.length) A(nm,'половина разреза',s0.slice(0,2).join('; '));
      ['mirror','void','hid','solid'].forEach(d=>{ if(!chk(S.front({[d]:1})).length) A(nm,'половина разреза: '+d,'неверный вариант прошёл проверку как верный'); });
    }
    return out; });
  r.forEach(x=>add(...x));
  /* 4. экраны */
  for(const m of ['mix','ng','ig']){ const before=errs.length;
    const runs0=await page.evaluate(()=>{ location.hash='#/about'; return (ST.get('rkg',{}).runs)||0; }); await page.waitForTimeout(80);
    await page.evaluate(m=>{ location.hash='#/rk/'+m; },m); await page.waitForTimeout(250);
    await page.click('[data-go]'); await page.waitForTimeout(150);
    let n=0; while(await page.$('#rkgPlay')&&n<12){ const o=await page.$$('[data-o]:not([disabled])'); if(!o.length){ add('игра · '+m,'проход','нет вариантов на задании '+(n+1)); break; }
      await o[n%o.length].click(); await page.waitForTimeout(40);
      if(!await page.$('#rkgFb')){ add('игра · '+m,'проход','нет разбора после ответа на задании '+(n+1)); break; }
      await page.click('[data-next-q]'); await page.waitForTimeout(40); n++; }
    if(!await page.$('.rkg-res')) add('игра · '+m,'проход','не дошли до итога за '+n+' заданий');
    else if(n!==({mix:10,ng:8,ig:8})[m]) add('игра · '+m,'проход','заданий '+n);
    const st=await page.evaluate(()=>ST.get('rkg',{}));
    if(!st.last||st.last.n!==n||st.last.m!==m||st.runs!==runs0+1||!(st.best&&st.best[m]!=null)) add('игра · '+m,'сохранение','итог не записан: '+JSON.stringify(st).slice(0,120));
    if(errs.length>before) add('игра · '+m,'ошибка JS',errs.slice(before).join(' / ')); }
  /* время вышло — ответ не засчитан */
  { await page.evaluate(()=>{ location.hash='#/about'; }); await page.waitForTimeout(60); await page.evaluate(()=>{ location.hash='#/rk/ig'; }); await page.waitForTimeout(200);
    await page.click('[data-go]'); await page.waitForTimeout(100);
    await page.evaluate(()=>{ RKG._.G.el=1e7; }); await page.waitForTimeout(300);
    const t=await page.evaluate(()=>{ const q=RKG._.G.qs[0]; return {pick:q.pick,ok:q.ok,fb:!!document.querySelector('#rkgFb')}; });
    if(t.pick!==-1||t.ok||!t.fb) add('игра · время','таймер','по истечении времени ответ не закрыт: '+JSON.stringify(t)); }
  /* тизер на главной убран (РК2 на главной — плашка и плитки); проверяем, что его там нет и главная без ошибок */
  { const before=errs.length; await page.evaluate(()=>{ location.hash='#/'; }); await page.waitForTimeout(300);
    if(await page.$('#rkgTz')) add('главная','тизер','превью игры снова на главной');
    if(errs.length>before) add('главная','ошибка JS',errs.slice(before).join(' / ')); }
  page.off('pageerror',onErr);
  return bad;
}
module.exports={rkgCheck};
if(require.main===module)(async()=>{
  const http=require('http'), fs=require('fs'), path=require('path'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const ROOT=path.join(__dirname,'..');
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.js')?'text/javascript':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const bad=await rkgCheck(page,'http://127.0.0.1:'+srv.address().port+'/');
  bad.forEach(b=>console.log(b.name+' | '+b.rule+' | '+b.msg)); console.log('«Сдашь РК2?»: замечаний '+bad.length);
  await browser.close(); srv.close(); process.exit(bad.length?1:0);
})();
