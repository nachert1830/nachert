/* Проверка проверки для нормоконтроля ИГ (и проверка тренажёра «Нормоконтроль»).
   Тренажёр IGNK подсаживает в настоящий чистовик одно нарушение и говорит, где оно (цели — прямоугольники на листе).
   Здесь каждое такое нарушение прогоняется через нормоконтроль (tests/normo.js + сверка с моделью):
     поймано    — есть замечание нужного правила внутри цели тренажёра;
     лишнее     — замечание вне целей: подсадка задела что-то ещё или проверка шумит.
   Так проверяются сразу обе стороны: нормоконтроль ловит настоящие ошибки, а тренажёр не выдаёт за ошибку то, что ей не является.
   runMutations(page,{per:N}) — N вариантов на тип (по кругу), результат {тип:{поймано, всего, лишнее, пример}}. */
const FAM={link:/проекционная связь/,hidsolid:/модель/,thin:/одна толщина основной линии/,hdir:/наклон штриховки/,hstep:/шаг штриховки/,nohatch:/штриховка — там, где сечение|модель/,
  numline:/размерное число не пересекают/,letter:/обозначение разреза|буква у штриха/,axis:/осевая выходит за контур|штрихпунктирная/,missing:/все рёбра детали|модель/,stamp:/основная надпись/,font:/2\.304|шрифт|размерные числа/,value:/масштаб 1:1/};
const MODEL=new Set(['hidsolid','nohatch','missing']);
async function runMutations(page,o){ o=o||{}; await require('./normo-run.js').inject(page);
  return page.evaluate(async({per,FAM,MODEL,seed})=>{ const fam={}; Object.keys(FAM).forEach(k=>fam[k]=new RegExp(FAM[k])); const out={}, pause=()=>new Promise(r=>setTimeout(r,0));
    for(const T of IGNK.TYPES){ const r=out[T.id]={поймано:0,всего:0,лишнее:0,пример:''}; let tried=0;
      for(let i=0;r.всего<per&&tried<30;i++){ const n=1+((i*7+T.id.length*3+seed)%30); tried++; let P=null; try{ P=IGNK.make(n,seed+i,T.id); }catch(e){ r.пример=r.пример||('ошибка подсадки: '+e); } if(!P) continue;
        r.всего++; const k=3, res=NORMO.check(P.svg,{model:MODEL.includes(T.id)?IG_VARS[n]:null});
        const inT=a=>a&&P.targets.some(b=>a[0]*k>=b[0]-6*k&&a[0]*k<=b[2]+6*k&&a[1]*k>=b[1]-6*k&&a[1]*k<=b[3]+6*k);
        const ok=res.issues.some(x=>fam[T.id].test('ГОСТ '+x.gost+' · '+x.rule)&&(inT(x.at)||!x.at)); if(ok) r.поймано++; else r.пример=r.пример||('вар. '+n+': '+(res.issues.map(x=>x.rule+' '+JSON.stringify(x.at)).join('; ')||'замечаний нет'));
        const extra=res.issues.filter(x=>x.at&&!inT(x.at)); if(extra.length){ r.лишнее++; r.пример=r.пример||('вар. '+n+' лишнее: '+extra.map(x=>x.rule+': '+x.msg).join('; ')); }
        await pause(); } }
    return out; },{per:o.per||3,FAM:Object.fromEntries(Object.entries(FAM).map(([k,v])=>[k,v.source])),MODEL:[...MODEL],seed:o.seed||1}); }
/* тренажёр на странице: лист строится, нажатие в цель засчитывается, мимо — нет; после ответа — объяснение и верный лист */
async function nkUi(page,URL){ const bad=[], add=(n,r,m)=>bad.push({name:'Нормоконтроль '+n,rule:r,msg:m});
  for(const key of ['8-11','3-5']){ await page.goto(URL+'#/ig/nk/'+key); await page.waitForTimeout(400);
    const ok=await page.waitForFunction(()=>{ const s=document.querySelector('#nkSheet svg'); return s&&!document.querySelector('#nkSheet .igx-ld'); },null,{timeout:90000}).catch(()=>null); if(!ok){ add(key,'лист не построился','нет листа за 90 с'); continue; }
    const t=await page.evaluate(()=>{ const m=/^(\d+)-(\d+)$/.exec(location.hash.split('/').pop()); const P=IGNK.make(+m[1],+m[2]); const s=document.querySelector('#nkSheet svg'), M=s.getScreenCTM(), b=P.targets[0];
      const scr=(x,y)=>{ const p=new DOMPoint(x,y).matrixTransform(M); return [p.x,p.y]; }; const vb=s.viewBox.baseVal;
      /* мимо: угол листа далеко от всех целей */ const far=[vb.x+vb.width*0.02,vb.y+vb.height*0.02], tg=[(b[0]+b[2])/2,(b[1]+b[3])/2];
      return {miss:scr(...far),hit:scr(...tg),inT:P.targets.some(q=>far[0]>=q[0]&&far[0]<=q[2]&&far[1]>=q[1]&&far[1]<=q[3])}; });
    const click=async p=>{ await page.evaluate(([x,y])=>{ const s=document.querySelector('#nkSheet svg'); if(s) s.dispatchEvent(new MouseEvent('click',{clientX:x,clientY:y,bubbles:true})); },p); await page.waitForTimeout(120); };
    if(!t.inT){ await page.evaluate(([x,y])=>window.scrollTo(0,0),[0,0]); await click(t.miss); const r=await page.$eval('#nkRes',e=>e.innerText).catch(()=>''); if(!/всё по ГОСТ/.test(r)) add(key,'промах не распознан',r.slice(0,80)); }
    await click(t.hit); const r2=await page.$eval('#nkRes',e=>e.innerText).catch(()=>''); if(!/Нашёл|Нарушение здесь/.test(r2)) add(key,'попадание не засчитано',r2.slice(0,80));
    const cmp=await page.$('#nkCmp:not([hidden])'); if(!cmp) add(key,'нет кнопки «Верный лист»',''); else { await cmp.click(); await page.waitForTimeout(100); }
  }
  return bad; }
/* «Читаю чертёж» на листе варианта: нажатие на линию подсвечивает её на всех трёх видах и объясняет, что это */
async function readUi(page,URL){ const bad=[], add=(r,m)=>bad.push({name:'Читаю чертёж',rule:r,msg:m});
  const log=[], t0=Date.now(), onc=m=>{ if(m.type()==='error'||m.type()==='warning') log.push(Math.round((Date.now()-t0)/1000)+'с '+m.type()+': '+m.text().slice(0,160)); }, one=e=>log.push('pageerror: '+String(e).slice(0,160));
  page.on('console',onc); page.on('pageerror',one);
  /* сразу на вкладке «Лист», как страница восстанавливает последнюю вкладку: 3D не запускается (в CI WebGL программный, и лист ждал за ним) */
  await page.evaluate(()=>{ try{ sessionStorage.setItem('igsol:#/ig/hw2/8','1'); sessionStorage.setItem('igsol:#/ig/hw2/8:t','sheet'); }catch(e){} });
  await page.goto(URL+'#/ig/hw2/8'); await page.waitForTimeout(800);
  if(!await page.$('#igSheetBox:not([hidden])')){ await page.click('#igShow').catch(()=>{}); await page.waitForTimeout(200); await page.click('.igx-tabs button[data-t="sheet"]').catch(()=>{}); }
  /* панель загрузки — только у самого листа: вкладка 3D могла ещё считаться (в CI WebGL программный и медленный) */
  const ok=await page.waitForFunction(()=>{ const b=document.querySelector('#igSheetBox'); return b&&b.querySelector('svg')&&!b.parentNode.querySelector('.igx-ld'); },null,{timeout:240000}).catch(()=>null);
  if(!ok){ const st=await page.evaluate(()=>{ const b=document.querySelector('#igSheetBox'), ld=[...document.querySelectorAll('.igx-ld')];
      return {box:!!b,boxHidden:b&&b.hidden,svg:b&&b.querySelector('svg')?b.querySelector('svg').getAttribute('viewBox'):null,boxLen:b?b.innerHTML.length:0,
        ld:ld.map(e=>e.innerText.slice(0,40)+' · полоска '+((e.querySelector('i')||{}).style||{}).transform+(e.classList.contains('out')?' · out':'')).join(' / '),
        tab:[...document.querySelectorAll('.igx-tabs button.on')].map(x=>x.dataset.t).join(','),vis:document.visibilityState,hash:location.hash}; }).catch(e=>({err:String(e)}));
    add('лист не построился',JSON.stringify(st)+' · '+Math.round((Date.now()-t0)/1000)+' с · консоль: '+(log.slice(0,6).join(' | ')||'пусто')); page.off('console',onc); page.off('pageerror',one); return bad; }
  page.off('console',onc); page.off('pageerror',one);
  if(!await page.waitForSelector('#igRd',{timeout:15000}).catch(()=>null)){ add('нет кнопки «Читаю чертёж»',''); return bad; }
  await page.click('#igRd'); await page.waitForTimeout(150);
  for(const dir of ['front','top','left']){ const r=await page.evaluate(dir=>{ const svg=document.querySelector('#igSheetBox svg'), VV=IGREAD.viewsOf(svg,IG_VARS[8]), V=VV.find(V=>V.dir===dir); if(!V) return {err:'нет вида'};
      const s=V.L.filter(s=>!s.l.h).sort((a,b)=>Math.hypot(b.b[0]-b.a[0],b.b[1]-b.a[1])-Math.hypot(a.b[0]-a.a[0],a.b[1]-a.a[1]))[2], q=new DOMPoint((s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2).matrixTransform(svg.getScreenCTM());
      document.querySelector('#igSheetBox').dispatchEvent(new MouseEvent('click',{clientX:q.x,clientY:q.y,bubbles:true}));
      const g=svg.querySelector('.rd-ov'); return {n:g?g.children.length:0,cap:document.querySelector('#igRdCap').innerText}; },dir);
    if(r.err) add(dir,r.err); else { if(r.n<2) add(dir+': нет подсветки на других видах','элементов '+r.n+', подпись: '+r.cap.slice(0,120)); if(!/вид сверху:|главный вид:/.test(r.cap)) add(dir+': нет объяснения','элементов '+r.n+', подпись: '+r.cap.slice(0,120)); } }
  return bad; }
/* Сторона волнистой линии (ГОСТ 2.305): если с осью симметрии совпадает ребро, вид от разреза отделяют волнистой линией,
   смещённой так, чтобы ребро было видно. В каждый лист, где граница волнистая, подсаживаются две ошибки генератора:
   волнистая смещена в другую сторону (flip) и граница — сама ось (axis). Обе должны ловиться нормоконтролем со сверкой
   с моделью; заодно — список мест «для проверки человеком» (волнистая выходит за контур изображения). */
async function wavyMutations(page){ await require('./normo-run.js').inject(page);
  return page.evaluate(()=>{ const res={всего:0,поймано:0,пропуски:[],review:[]};
    for(let n=1;n<=30;n++){ const M=window.IG_VARS&&IG_VARS[n]; if(!M) continue; const sp=IGUI.igSpec(M);
      (NORMO.check(IGS.sheet(n,'clean'),{}).review||[]).forEach(x=>res.review.push('вар. '+n+': '+x.msg));
      ['xb','yb'].filter(k=>sp[k]).forEach(key=>{ const keep=sp[key];
        ['flip','axis'].forEach(mut=>{ sp[key]=mut==='flip'?-keep:0; IGS.forget(n); let r; try{ r=NORMO.check(IGS.sheet(n,'clean'),{model:M,spec:sp}); }catch(e){ r={issues:[]}; }
          sp[key]=keep; IGS.forget(n); res.всего++;
          if(r.issues.some(i=>/ребро на оси|волнистая граница/.test(i.rule))) res.поймано++; else res.пропуски.push('вар. '+n+' '+key+' '+mut); }); }); }
    return res; }); }
module.exports={runMutations,nkUi,readUi,wavyMutations,FAM};
