/* ═══════════ РК2: банк заданий, генераторы «Вижу», модель готовности, экраны ═══════════
   1. Банк: у каждого задания есть модуль и вопрос, индексы верных ответов в пределах, каждый из 26 вопросов покрыт.
   2. Генераторы: на 200 вариантах каждого — ровно один верный, варианты различимы, верный вариант проверяется
      независимым расчётом (расстояние до новой оси = z, Ā″ на высоте A, m ∥ ABC ⟺ направление ⟂ нормали,
      n ∥ нормали ABC, путь ⟂ h′), каждый неверный — неверен.
   3. Готовность: пусто — «нет данных»; всё идеально — 100; без пробного РК — ≤ 89; уверенная ошибка — ≤ 84;
      провал одного модуля тянет итог вниз (слабое звено); новый верный ответ не снижает готовность.
   4. Экраны: каждый режим проходится нажатиями до итога без ошибок JS; «объясни вслух» и пробный РК сохраняются.
   Запуск: из tests/run.js; отдельно — node tests/rk2.js */
async function rk2Check(page,URL){
  const bad=[], add=(name,rule,msg)=>bad.push({name,rule,msg:String(msg).slice(0,200)});
  const errs=[]; const onErr=e=>errs.push(String(e)); page.on('pageerror',onErr);
  await page.emulateMedia({reducedMotion:'reduce'});   /* анимации «куда нажать» бесконечные — для нажатий в тесте их выключаем, как у пользователей с этой настройкой */
  await page.goto(URL+'#/'); await page.waitForTimeout(800);
  const r=await page.evaluate(()=>{ const out=[], A=(n,r,m)=>out.push([n,r,m]);
    const {MODS,Q,ITEMS,GENS}=RK2;
    /* 1. банк */
    const qs=MODS.flatMap(m=>m.q).sort((a,b)=>a-b); if(qs.join()!==Array.from({length:26},(_,i)=>i+1).join()) A('банк','модули','вопросы модулей не 1…26: '+qs.join());
    Q.forEach(q=>{ if(!q.keys||q.keys.length<2) A('вопрос '+q.n,'ключ','меньше двух пунктов ключа'); if(!ITEMS.some(i=>i.n===q.n)) A('вопрос '+q.n,'покрытие','нет ни одного задания'); });
    const ids=new Set(); ITEMS.forEach(i=>{ if(ids.has(i.id)) A(i.id,'id','повтор'); ids.add(i.id);
      if(!MODS.some(m=>m.id===i.m)) A(i.id,'модуль','нет модуля');
      if((i.k==='p'||i.k==='t')&&!(i.c>=0&&i.c<i.o.length)) A(i.id,'ответ','c вне вариантов');
      if(i.k==='t'&&!(i.rc>=0&&i.rc<i.r.length)) A(i.id,'обоснование','rc вне вариантов');
      if((i.k==='b'&&i.parts.length<3)||(i.k==='s'&&i.steps.length<3)) A(i.id,'фишки','меньше трёх');
      if(i.k==='b'||i.k==='s'){ const src=i.k==='b'?i.parts:i.steps; (i.x||[]).forEach(x=>{ if(src.includes(x[0])) A(i.id,'фишки','лишняя совпадает с нужной'); if(!x[1]) A(i.id,'фишки','у лишней нет объяснения'); }); } });
    MODS.forEach(m=>{ if(!ITEMS.some(i=>i.m===m.id)) A(m.id,'банк','нет заданий'); (RK2.GEN_OF[m.id]||[]).forEach(g=>{ if(!GENS[g]) A(m.id,'генератор','нет '+g); }); });
    /* 2. генераторы */
    const d2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]), sub=(a,b)=>a.map((x,i)=>x-b[i]), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
    const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], un=a=>{ const l=Math.hypot(...a); return a.map(x=>x/l); };
    const S=L.S, F=L.F, H=L.H;
    for(const g of Object.keys(GENS)) for(let k=0;k<200;k++){ const q=GENS[g](); if(!q){ A(g,'генератор','нет варианта'); break; }
      const nm=g+' #'+k;
      if(q.k==='g'){ const okN=q.opts.filter(o=>o.ok).length; if(okN!==1) A(nm,'варианты','верных '+okN);
        if(q.opts.some(o=>!o.ok&&!o.err)) A(nm,'варианты','неверный вариант без объяснения');
        if(q.opts[0].svg&&new Set(q.opts.map(o=>o.svg)).size!==q.opts.length) A(nm,'варианты','одинаковые картинки'); }
      const M=q.meta;
      if(g==='rep'){ const zA=M.A[2]*S, zB=M.B[2]*S, off=(p,P1)=>dot(sub(p,M.o),M.s), al=p=>dot(sub(p,M.o),M.d);
        if(Math.abs(off(M.ok[0])-zA)>.01||Math.abs(off(M.ok[1])-zB)>.01) A(nm,'замена','A₄/B₄ не на высоте z от x₁₄');
        if(Math.abs(al(M.ok[0])-al(H(M.A)))>.01) A(nm,'замена','линия связи A′A₄ не ⟂ x₁₄');
        M.all.forEach(c=>{ if(c!==M.ok&&Math.abs(off(c[0])-zA)<.01&&Math.abs(off(c[1])-zB)<.01&&Math.abs(al(c[0])-al(H(M.A)))<.01) A(nm,'замена','неверный вариант совпал с верным'); }); }
      if(g==='rot'){ const B1=H(M.B), A1=H(M.A), r=d2(A1,B1), Ab1=[M.ok[0],B1[1]];
        if(Math.abs(d2(Ab1,B1)-r)>.01) A(nm,'вращение','Ā′ не на окружности');
        if(Math.abs(M.ok[1]-F(M.A)[1])>.01) A(nm,'вращение','высота Ā″ ≠ высоте A″');
        const nv=Math.hypot(...sub(M.A,M.B))*S; if(Math.abs(d2(M.ok,F(M.B))-nv)>.05) A(nm,'вращение','Ā″B″ ≠ натуральной величине'); }
      if(g==='par'){ const n=un(crs(sub(M.B,M.A),sub(M.C,M.A))), sn=Math.abs(dot(un(M.d),n)); if(M.yes!==(sn<1e-9)) A(nm,'параллельность','ответ не совпал с расчётом: sin='+sn);
        const okI=q.opts.findIndex(o=>o.ok); if((okI===0)!==M.yes) A(nm,'параллельность','верный вариант не тот'); }
      if(g==='perp'){ const n=un(crs(sub(M.B,M.A),sub(M.C,M.A)));
        const to3=c=>{ const u=c[0], v=c[1]; if(Math.abs(u[0])<1e-9||Math.abs(v[0])<1e-9) return null; const k=u[0]/v[0]; return un([-u[0]/S, u[1]/S, -v[1]/S*k]); };   /* n′ и n″ → направление в пространстве: общий x */
        const d=to3(M.ok); if(!d||Math.abs(Math.abs(dot(d,n))-1)>1e-6) A(nm,'перпендикуляр','верный вариант не ⟂ плоскости');
        M.all.forEach(c=>{ if(c===M.ok) return; const e=to3(c); if(e&&Math.abs(Math.abs(dot(e,n))-1)<1e-3) A(nm,'перпендикуляр','неверный вариант тоже ⟂'); }); }
      if(g==='trl'){ const h=sub(H(M.P2),H(M.P1)); if(Math.abs(dot(M.ok,h))>1e-6) A(nm,'вращение вокруг h','путь не ⟂ h′');
        if(Math.abs(M.P1[2]-M.P2[2])>1e-9) A(nm,'вращение вокруг h','h не горизонталь'); }
      if(g==='axis'){ const ang=(a,b)=>{ let x=Math.atan2(-(b[1]-a[1]),b[0]-a[0])*180/Math.PI; return ((x%180)+180)%180; };
        const base=ang(H(q.A),H(q.plane?q.hP:q.B)), want=q.plane?(base+90)%180:base; if(Math.abs(want-q.target)>1e-6) A(nm,'ось','цель не та');
        if(q.plane&&Math.abs(q.hP[2]-q.A[2])>1e-9) A(nm,'ось','h не горизонталь'); }
    }
    /* 3. готовность */
    const t=20000, base=()=>({t,items:{},oral:{},mock:[],wb3:{},rep:{},fac:'main'});
    const R0=RK2.readiness(base()); if(!R0.empty) A('готовность','пусто','без данных — не «нет данных»');
    const full=()=>{ const D=base(); ITEMS.forEach(i=>D.items[i.id]=[[t-3,1,3],[t,1,3]]); Object.values(RK2.GEN_OF).flat().forEach(g=>D.items['g:'+g]=[[t-3,1,3],[t-2,1,3],[t,1,3]]);
      MODS.forEach(m=>m.tasks.concat(m.ticket?[m.ticket]:[]).forEach(k=>D.rep[String(k)]={b:3,l:t,n:2,r:2})); D.mock=[{d:t,r:{A:1,B:1,V:1}}]; return D; };
    const Rf=RK2.readiness(full()); if(Rf.val!==100) A('готовность','максимум','всё идеально, а готовность '+Rf.val);
    const Dn=full(); Dn.mock=[]; if(RK2.readiness(Dn).val>89) A('готовность','потолок','без пробного РК выше 89');
    const Dd=full(); Dd.items[ITEMS[0].id].push([t,0,3]); if(RK2.readiness(Dd).val>84) A('готовность','потолок','с уверенной ошибкой выше 84');
    const Dw=full(); ITEMS.filter(i=>i.m==='rotl').forEach(i=>delete Dw.items[i.id]); delete Dw.items['g:trl']; MODS.find(m=>m.id==='rotl').tasks.concat(['R2-V']).forEach(k=>delete Dw.rep[String(k)]); Dw.mock=[{d:t,r:{A:1,B:1,V:0}}];
    const Rw=RK2.readiness(Dw); if(Rw.val>70) A('готовность','слабое звено','модуль на нуле, а готовность '+Rw.val);
    const Dm=base(); let prev=RK2.readiness(Dm).val||0; ITEMS.slice(0,25).forEach(i=>{ Dm.items[i.id]=[[t,1,2]]; const v=RK2.readiness(Dm).val; if(v<prev) A('готовность','монотонность','верный ответ снизил готовность: '+prev+' → '+v); prev=v; });
    const Dold=full(); Object.values(Dold.items).forEach(a=>a.forEach(x=>x[0]-=200)); Object.values(Dold.rep).forEach(o=>o.l-=200); Dold.mock[0].d-=10; const Ro=RK2.readiness(Dold).val;
    if(!(Ro<Rf.val&&Ro>=55)) A('готовность','забывание','через 200 дней '+Ro+' (ожидалось ниже 100 и не ниже 55)');
    /* просмотр разбора и «не смог» баллов не дают */
    const Dv=base(); MODS.forEach(m=>m.tasks.concat(m.ticket?[m.ticket]:[]).forEach(k=>{ Dv.wb3[k]=1; Dv.rep[String(k)]={b:0,l:t,n:1,r:0}; })); Dv.items['g:rep']=[];
    const Rv=RK2.readiness(Dv); if(Rv.val!==0) A('готовность','ни за что','просмотр разборов и «не смог» дали '+Rv.val);
    const Dg=base(); ITEMS.forEach(i=>Dg.items[i.id]=[[t,1,1]]); const Rg=RK2.readiness(Dg); if(Rg.val>15) A('готовность','наугад','всё «наугад» дало '+Rg.val);
    if(!RK2.readiness(Object.assign(base(),{fac:'sec'})).na) A('готовность','поток','для потока с другим РК2 должно быть «нет»');
    return out; });
  r.forEach(x=>add(x[0],x[1],x[2]));
  /* 4. экраны: проход каждого режима нажатиями */
  const kinds=['zamer','mix','m-par','m-perp','m-zam','m-rotp','m-rotl','v-par','v-perp','v-zam','v-rotp','v-rotl','fix'];
  for(const kind of kinds){ const before=errs.length;
    await page.evaluate(()=>{ try{ ['r2i','r2s','r2m'].forEach(k=>localStorage.removeItem('nch2_'+k)); }catch(e){} });
    await page.evaluate(k=>{ location.hash='#/ng/rk2/t/'+k; },kind); await page.waitForTimeout(250);
    let n=0;
    for(;n<30;n++){ const card=await page.$('.r2-card'); if(!card) break;
      const live=await page.$('.r2-chk'); if(live){ await live.click(); }
      else { const chip=await page.$('.r2-pool .r2-chip');
        if(chip){ for(let k=0;k<8;k++){ const rd=await page.$('[data-rd]'); if(rd){ await rd.click(); break; } const c=await page.$('.r2-pool .r2-chip'); if(!c) break; await c.click(); } }
        else { const o=await page.$('[data-o]:not([disabled])'); if(o) await o.click(); const rr=await page.$('[data-r]:not([disabled])'); if(rr) await rr.click(); }
        const cf=await page.$('[data-cf="'+(1+n%3)+'"]'); if(cf) await cf.click(); }
      const nx=await page.$('[data-sn]'); if(!nx){ add('РК2 · '+kind,'проход','нет кнопки «Дальше» на задании '+(n+1)); break; } await nx.click(); await page.waitForTimeout(40); }
    const fin=await page.$('.lk-res,.r2-empty'); if(!fin) add('РК2 · '+kind,'проход','не дошли до итога за '+n+' заданий');
    if(errs.length>before) add('РК2 · '+kind,'ошибка JS',errs.slice(before).join(' / ')); }
  /* «объясни вслух» и пробный РК сохраняются и меняют готовность */
  await page.evaluate(()=>{ location.hash='#/ng/rk2/q/24'; }); await page.waitForTimeout(250);
  await page.click('[data-show]'); for(const c of await page.$$('[data-k]')) await c.check(); await page.click('[data-save]');
  const oral=await page.evaluate(()=>JSON.parse(localStorage.getItem('nch2_r2s')||'{}')[24]); if(!oral||oral[1]!==1) add('РК2 · вопрос 24','объясни вслух','не сохранилось');
  await page.evaluate(()=>{ location.hash='#/ng/rk2/mock'; }); await page.waitForTimeout(250);
  await page.click('#r2Go'); await page.click('#r2Go'); for(const c of await page.$$('#r2Chk input')) await c.check(); await page.click('#r2Save');
  const mk=await page.evaluate(()=>{ const h=JSON.parse(localStorage.getItem('nch2_r2m')||'[]'); return h[h.length-1]; }); if(!mk||mk.r.A!==1||mk.r.V!==1) add('РК2 · пробный','сохранение','результат не записан');
  page.off('pageerror',onErr);
  return bad;
}
module.exports={rk2Check};
if(require.main===module)(async()=>{
  const http=require('http'), fs=require('fs'), path=require('path'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const ROOT=path.join(__dirname,'..');
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const bad=await rk2Check(page,'http://127.0.0.1:'+srv.address().port+'/');
  bad.forEach(b=>console.log(b.name+' | '+b.rule+' | '+b.msg)); console.log('РК2: замечаний '+bad.length);
  await browser.close(); srv.close(); process.exit(bad.length?1:0);
})();
