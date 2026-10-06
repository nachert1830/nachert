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
  /* скрытые функции не видны обычному посетителю; #/me без ключа ведёт на главную */
  if(await page.evaluate(()=>FLAGS.owner())) bad.push({name:'Режим владельца',rule:'включён у посетителя',msg:''});
  if(await page.$$eval('.gy-card',a=>a.length)!==2) bad.push({name:'Тренажёр',rule:'посетитель видит скрытую карточку',msg:''});
  await page.goto(base+'#/me'); await page.waitForTimeout(400);
  if(await page.evaluate(()=>location.hash)!=='#/') bad.push({name:'Режим владельца',rule:'#/me открылся без ключа',msg:''});
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
  /* «Построй сам» временно убран с сайта: адрес …/build/… ведёт на вариант задачи */
  await page.goto(base+'#/ng/check/gym/build/'+(L.gen[0])+'-5'); await page.waitForTimeout(600);
  if(!/\/gym\/var\//.test(await page.evaluate(()=>location.hash))) bad.push({name:'Тренажёр · построй сам',rule:'старый адрес не перенаправлен',msg:''});
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
  /* 3D к задачам — у любого посетителя */
  /* 3D к задачам: кнопка есть, окно открывается, шаги листаются */
  await page.goto(base+'#/ng/tasks/47'); await page.waitForTimeout(900);
  if(!(await page.$('.pl-zb[data-z="3d"]'))) bad.push({name:'3D к задачам №47',rule:'нет кнопки 3D',msg:''});
  else { await page.click('.pl-zb[data-z="3d"]'); await page.waitForTimeout(200); for(let i=0;i<12;i++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100); const n=await page.$$eval('#t3Svg circle',a=>a.length), cap=await page.$eval('#t3Cap',e=>e.textContent);
    const ink=await page.evaluate(()=>{ const e=document.querySelector('.t3d'); const v=e&&getComputedStyle(e).getPropertyValue('--t3ink').trim(); return v; });
    if(!ink) bad.push({name:'3D к задачам',rule:'цвет линий не задан (линии невидимы)',msg:''});
    if(n<8||!/^Шаг \d+ из/.test(cap)) bad.push({name:'3D к задачам №47',rule:'окно пустое',msg:cap});
    await page.keyboard.press('Escape'); if(await page.$('.t3d')) bad.push({name:'3D к задачам',rule:'Esc не закрывает',msg:''}); }
  info.t3=await page.evaluate(()=>{ let a=0,b=0; WB3.tasks.forEach(t=>PLAYER.partsOf(t).forEach(p=>{ b++; if(TASK3D.has(p)) a++; })); return a+' из '+b+' пунктов'; });
  return {bad,info};
}
module.exports={gymCheck};
