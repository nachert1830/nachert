/* Подготовка к ДЗ (#/ng4/prep): мини-задачи проверяются числами, независимо от текста шагов.
   1) каждая построенная точка лежит на поверхностях всех тел, которым принадлежит (|f| < 0,01 мм);
   2) высшая и низшая точки — действительно крайние: линия, найденная заново перебором горизонтальных плоскостей
      (окружность конуса ∩ окружность сферы), не выходит за них по высоте;
   3) у сфер-посредников есть точки (сфера не мимо линии), R_min — вписанная сфера;
   4) экраны: путь, каждый шаг, плеер доходит до ответа, вопрос «проверь себя» засчитывается, без ошибок JS
      и горизонтальной прокрутки на телефоне.
   Отдельно: node tests/prep.js (нужен сервер на :8765 или переменная BASE). */
const {chromium}=require('playwright');
const BASE0=process.env.BASE||'http://localhost:8765/index.html';
async function run(page,base){
  const BASE=base?base.replace(/\/$/,'')+'/index.html':BASE0, fails=[];
  await page.goto(BASE+'#/');
  await page.waitForFunction(()=>window.DZR&&DZR.get('ng4')&&DZR.get('ng4').prep);
  const r=await page.evaluate(()=>{ const P=DZR.get('ng4').prep, out=[];
    const {Cone,Sphere}=P._test;
    P.steps.forEach((s,i)=>{ let t; try{ t=s.task(); }catch(e){ out.push(`шаг ${i+1}: задача не построилась: ${e.message}`); return; }
      const c=t.cert?t.cert():{};
      (c.on||[]).forEach(([p,B],k)=>B.forEach(b=>{ const f=b.f(p); if(!(Math.abs(f)<0.01)) out.push(`шаг ${i+1}: точка ${k} не на поверхности «${b.kind}» (|f| = ${Math.abs(f).toFixed(3)})`); }));
      if(c.nonempty===false) out.push(`шаг ${i+1}: сфера-посредник без точек`);
      if(c.rminT===false) out.push(`шаг ${i+1}: R_min не равна вписанной сфере`);
      (c.ext||[]).forEach((e,k)=>{ /* линия заново: плоскости z через 0,05 мм, окружность ∩ окружность */
        let zmin=1e9, zmax=-1e9; for(let z=0.01;z<e.K.c[2]+e.K.h;z+=0.05){ const r1=e.K.rho(z), r2=Math.sqrt(Math.max(0,e.S.R*e.S.R-(z-e.S.c[2])**2)); if(r2<=0) continue;
          const d=Math.hypot(e.S.c[0]-e.K.c[0],e.S.c[1]-e.K.c[1]); if(d<=r1+r2&&d>=Math.abs(r1-r2)){ zmin=Math.min(zmin,z); zmax=Math.max(zmax,z); } }
        if(Math.abs(zmax-e.top[2])>0.1) out.push(`шаг ${i+1}, ${k?'б':'а'}): высшая точка z = ${e.top[2].toFixed(2)}, а линия доходит до ${zmax.toFixed(2)}`);
        if(Math.abs(zmin-e.bot[2])>0.1) out.push(`шаг ${i+1}, ${k?'б':'а'}): низшая точка z = ${e.bot[2].toFixed(2)}, а линия опускается до ${zmin.toFixed(2)}`); });
      /* линии loop, если есть в замыкании: каждая точка на обеих поверхностях */
      const parts=t.parts||[t]; if(!parts.every(p=>p.steps&&p.steps.length>=3)) out.push(`шаг ${i+1}: меньше трёх шагов разбора`);
      if(!s.check||s.check.o[s.check.c]==null) out.push(`шаг ${i+1}: нет вопроса`); });
    const {D7,D8,LA,BA}=P._test;
    [[LA.loop,BA,'конус ∩ сфера'],[D7.loop,D7.B,'конус ∩ цилиндр'],[D8.loop,D8.B,'тор ∩ конус']].forEach(([L,B,n])=>L.forEach((p,k)=>B.forEach(b=>{ const f=b.f(p); if(!(Math.abs(f)<0.02)) out.push(`${n}: точка линии ${k} не на «${b.kind}» (${f.toFixed(3)})`); })));
    return {out,n:P.steps.length}; });
  fails.push(...r.out);
  /* экраны */
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto(BASE+'#/ng4/prep'); await page.evaluate(()=>{ try{ localStorage.removeItem('nch2_prep_ng4'); }catch(e){} }); await page.goto(BASE+'#/ng4/prep/1'); await page.goto(BASE+'#/ng4/prep'); await page.waitForSelector('.prp-path');
  { const sw=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth); if(sw>2) fails.push(`путь: горизонтальная прокрутка ${sw}px`); }
  const nCards=await page.$$eval('.prp-path a.prp-st',a=>a.length); if(nCards!==r.n) fails.push(`путь: ${nCards} карточек вместо ${r.n}`);
  for(let i=1;i<=r.n;i++){ await page.goto(BASE+'#/ng4/prep/'+i); await page.waitForSelector('#dzPl .pl-paper svg',{timeout:15000}).catch(()=>fails.push(`шаг ${i}: нет чертежа`));
    /* плеер до конца: «Дальше» до последнего шага, последний ведёт на вопрос */
    for(let k=0;k<16&&!await page.$('.pl-nextt');k++){ const bt=await page.$('.pl-ctrl .btn.pl-main'); if(!bt) break; await bt.click(); await page.waitForTimeout(300); }
    const go=await page.waitForSelector('.pl-nextt:not([disabled])',{timeout:8000}).catch(()=>null); if(go){ await go.click(); await page.waitForTimeout(400); }
    if(!/\/q$/.test(page.url())) fails.push(`шаг ${i}: плеер не довёл до вопроса`);
    await page.goto(BASE+'#/ng4/prep/'+i+'/q'); await page.waitForSelector('.prp-q');
    const sw=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth); if(sw>2) fails.push(`шаг ${i}: горизонтальная прокрутка ${sw}px`);
    const c=await page.evaluate(i=>DZR.get('ng4').prep.steps[i-1].check.c,i);
    await page.click(`.prp-q [data-o="${(c+1)%4}"]`); if(await page.$('.prp-q.ok')) fails.push(`шаг ${i}: неверный ответ засчитан`);
    await page.click(`.prp-q [data-o="${c}"]`); if(!await page.$('.prp-q.ok')) fails.push(`шаг ${i}: верный ответ не засчитан`); }
  const prog=await page.evaluate(()=>{ location.hash='#/ng4/prep'; return new Promise(r=>setTimeout(()=>r(document.querySelectorAll('.prp-path .prp-st.done').length),400)); });
  if(prog!==r.n) fails.push(`путь: пройдено ${prog} из ${r.n} после ответов`);
  errs.forEach(e=>fails.push('ошибка JS: '+e));
  return {fails,n:r.n};
}
/* для tests/run.js: замечания в общем формате */
async function prepCheck(page,URL){ const r=await run(page,URL); return r.fails.map(m=>({name:'#/ng4/prep',rule:'подготовка к ДЗ',msg:m})); }
module.exports={run,prepCheck};
if(require.main===module)(async()=>{ const b=await chromium.launch(), p=await b.newPage(); const r=await run(p); await b.close();
  console.log(r.fails.length?'✗ подготовка к ДЗ №4:\n  '+r.fails.join('\n  '):`✓ подготовка к ДЗ №4: ${r.n} шагов — точки на поверхностях, крайние точки, экраны`); process.exit(r.fails.length?1:0); })();
