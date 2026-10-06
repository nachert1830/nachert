/* ═══════════ Тренажёр (#/ng/check/gym): работает ли каждый режим на каждой задаче ═══════════
   • «Новый вариант»: для каждой задачи из GEN_OK строится вариант, он проходит проверку;
   • «Построй сам»: на странице ставим точки ровно в верные места → «Верно»; со сдвигом → «Пока не так»;
   • «Найди ошибку»: для каждой задачи готовится задание; нажатие на ошибку → «Нашёл», мимо → «Здесь всё верно». */
async function gymCheck(page,base,opt){
  opt=opt||{}; const bad=[], info={};
  await page.goto(base+'#/ng/check/gym'); await page.waitForTimeout(1500);
  const hideBars=()=>page.addStyleTag({content:'.ckn{display:none!important}'}).catch(()=>{});
  await page.evaluate(()=>GEN.checkers());
  const L=await page.evaluate(()=>GYM.lists());
  /* варианты: каждая задача из GEN_OK, два семени */
  const vr=await page.evaluate(list=>{ const out=[]; list.forEach(n=>[11,503].forEach(sd=>{ const v=GEN.variant(n,sd); if(!v) out.push({n,sd}); })); return out; },L.gen);
  vr.forEach(o=>bad.push({name:'Тренажёр · вариант №'+o.n,rule:'вариант не строится',msg:'семя '+o.sd+': ни один из 14 вариантов не прошёл проверку'}));
  info.var=L.gen.length;
  /* найди ошибку: задание готовится для каждой задачи */
  const bm=await page.evaluate(list=>{ const out={ok:0,miss:[]}; list.forEach(n=>{ const r=GYM.make(n,77); const B=r&&GYM.bugMake(r.task,77); if(B) out.ok++; else out.miss.push(n); }); return out; },L.bug);
  info.bug=bm.ok+' из '+L.bug.length;
  /* UI: «построй сам» и «найди ошибку» — по нескольку задач реальными нажатиями */
  await page.addStyleTag({content:'.tabbar,.ckn,nav.tb,#tabbar{display:none!important}'}).catch(()=>{});
  const tap=async(sel,pt)=>{ const box=await page.$eval(sel,(svg,pt)=>{ let r=svg.getBoundingClientRect(); const vb=svg.viewBox.baseVal;
      const y=r.top+pt[1]*r.height/vb.height; window.scrollBy(0,y-window.innerHeight*0.4); r=svg.getBoundingClientRect();
      return [r.left+(pt[0])*r.width/vb.width, r.top+(pt[1])*r.height/vb.height]; },pt);
    await page.mouse.move(box[0],box[1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(60); };
  for(const n of (opt.all?L.build:L.build.slice(0,8))){
    for(const shift of [0,1]){
      await page.goto(base+'#/ng/check/gym/build/'+n+'-'+(31+shift)); await page.waitForTimeout(700);
      const T=await page.evaluate(()=>{ const m=/build\/(\d+)-(\d+)/.exec(location.hash), r=GYM.make(+m[1],+m[2]); const t=r.task, T=GYM.buildTargets(t);
        const p=(t.parts&&t.parts.length)?t.parts[0]:t, all=[].concat(p.given||t.given||[],...(p.steps||[]).map(s=>s.add||[])).filter(Boolean), fr=GYM.frame(all);
        return T.map(x=>[x.at[0]+10+fr.ox,x.at[1]+10+fr.oy]); });
      for(let i=0;i<T.length;i++){ await page.click('.gy-t[data-i="'+i+'"]'); const q=T[i].slice(); if(shift&&i===0){ const w=await page.$eval('#gySheet svg',e=>e.viewBox.baseVal.width); q[0]+=q[0]+40<w-8?40:-40; } await tap('#gySheet svg',q); }
      if(await page.$eval('#gyCheck',e=>e.disabled)){ bad.push({name:'Тренажёр · построй сам №'+n,rule:'точки не ставятся',msg:JSON.stringify(T)+' '+await page.evaluate(()=>location.hash)}); continue; }
      await page.click('#gyCheck'); await page.waitForTimeout(80);
      const res=await page.$eval('#gyRes',e=>e.textContent);
      if(!shift&&!/Верно/.test(res)) bad.push({name:'Тренажёр · построй сам №'+n,rule:'верный ответ не принят',msg:res.slice(0,140)});
      if(shift&&!/Пока не так/.test(res)) bad.push({name:'Тренажёр · построй сам №'+n,rule:'неверный ответ принят',msg:res.slice(0,140)});
    } }
  info.build=L.build.length;
  for(const n of (opt.all?L.bug:L.bug.slice(0,10))){
    await page.goto(base+'#/ng/check/gym/bug/'+n+'-41'); await page.waitForTimeout(700);
    const at=await page.evaluate(()=>{ const m=/bug\/(\d+)-(\d+)/.exec(location.hash); if(!m) return null; const r=GYM.make(+m[1],+m[2]), B=GYM.bugMake(r.task,+m[2]); if(!B) return null; const fr=GYM.frame(B.items); return [B.at[0]+10+fr.ox,B.at[1]+10+fr.oy]; });
    if(!at||!(await page.$('#gySheet svg'))){ bad.push({name:'Тренажёр · найди ошибку №'+n,rule:'задание не открылось',msg:await page.evaluate(()=>(document.querySelector('#gyHost')||document.body).textContent.slice(0,120))}); continue; }
    const far=await page.$eval('#gySheet svg',(svg,at)=>{ const vb=svg.viewBox.baseVal; const c=[[6,6],[vb.width-6,6],[6,vb.height-6],[vb.width-6,vb.height-6]]; return c.sort((p,q)=>Math.hypot(q[0]-at[0],q[1]-at[1])-Math.hypot(p[0]-at[0],p[1]-at[1]))[0]; },at);
    await tap('#gySheet svg',far);   /* мимо: дальний угол чертежа */
    if(!/Здесь всё верно/.test(await page.$eval('#gyRes',e=>e.textContent))) bad.push({name:'Тренажёр · найди ошибку №'+n,rule:'нажатие мимо засчитано',msg:''});
    await tap('#gySheet svg',at);
    const res=await page.$eval('#gyRes',e=>e.textContent);
    if(!/Нашёл/.test(res)) bad.push({name:'Тренажёр · найди ошибку №'+n,rule:'нажатие на ошибку не засчитано',msg:res.slice(0,140)});
  }
  return {bad,info};
}
module.exports={gymCheck};
