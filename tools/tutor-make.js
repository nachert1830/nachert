#!/usr/bin/env node
/* ═══════════ Пошаговые данные ИИ-тренера: kb/tutor/<дз>.json ═══════════
   node tools/tutor-make.js            — все ДЗ;   node tools/tutor-make.js ng2   — одно.
   Начерт (ng1–ng5): решатель каждого варианта (DZR.solve — тот же код, что на сайте) даёт шаги с лестницей подсказок;
   отсюда для каждого шага:
     goal   — что делаем (заголовок шага);
     rungs  — ступени: 1 «Намёк», 2 «Почему так?», 3 «Шаг», 4 «Числа», 5 «Проверь себя» (текст сайта);
     labels — словарь: метки, которые уже есть на чертеже к началу шага (их тренеру называть можно);
     secret — метки, которые шаг вводит (их нельзя называть до ступени 3), и числа шага (до ступени 4);
     topics — темы программы подготовки, на которых стоит шаг (по словарю приёмов, только из тех, что нужны этому ДЗ).
   Инжа (ig2–ig6): шаг = элемент детали (база «как строится», kb/ig-dz.json), ступени собираются из данных элемента.
   Читает сайт через браузер для начерта (решатели живут в index.html), инжу — в Node. */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
const OUT=path.join(ROOT,'kb/tutor'); fs.mkdirSync(OUT,{recursive:true});
const ONLY=process.argv[2]||null;
global.self=global; require(path.join(ROOT,'kernel/prep.js')); const NG=self.PREPROG, IG=require(path.join(ROOT,'kernel/prep-ig.js'));
/* приём → тема программы (начерт): первое совпадение по заголовку и тексту шага, только среди тем, нужных этому ДЗ */
const NGRULES=[[/горизонтал|фронтал|h[″′]?α|f[″′]?α/i,['s3']],[/натуральн|прямоугольн\w* треугольн|гипотенуз/i,['l4','l5']],[/угол наклона/i,['s5b','l4u']],
  [/перпендикуляр к плоскост|n′ ⟂ h′|⟂ h′|⟂ f″/i,['m2','m3']],[/прям\w* угол|⟂/i,['l7']],[/нов\w* ос|x₁₄|x₂₄|x₄₅|замен/i,['t2','t3','t4','t5']],
  [/вращ|поворот|совмещ/i,['m7a','m7b','t7','t8']],[/посредник|γ|вспомогательн\w* плоскост/i,['m4','x3','x1','x8']],[/сфер/i,['x5','x6']],
  [/видим|конкурир/i,['p5','x7']],[/параллел(ь|и)\b|окружност/i,['f3']],[/касательн/i,['x9']],[/след/i,['l3','s4','x1']],[/опорн|высш|низш|очерк/i,['x2']],
  [/пересечени\w* плоскост|точк\w* встречи|пересекает плоскост/i,['m4','m5']],[/двугранн/i,['t6']],[/обратн/i,['t9']],[/линии? связи/i,['p1','p2']]];
function ngTopics(dz,text){ const need=NG.need(dz), out=[];
  for(const [re,ids] of NGRULES) if(re.test(text)) ids.forEach(id=>{ if(need.has(id)&&!out.includes(id)) out.push(id); });
  return out.slice(0,4); }
const strip=s=>String(s==null?'':s).replace(/<sub>([^<]*)<\/sub>/g,'$1').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const NUM=/(?<![A-Za-zА-Яа-я₀-₉′″‴])-?\d+(?:[,.]\d+)?/g;
async function ng(page,dz){
  const raw=await page.evaluate(dz=>{ const out=[]; for(const n of DZR.numbers(dz)){ let s; try{ s=DZR.solve(dz,n); }catch(e){ out.push({n,err:String(e.message)}); continue; }
      const t=s.task, parts=t.parts||[t], labs=a=>(a||[]).map(e=>e&&e.l).filter(l=>l&&typeof l==='string');
      const given=labs(t.given).concat(...parts.map(p=>labs(p.given)));
      out.push({n,kind:(DZR.typeOf(dz,n)||{}).code||null,q:t.q,ans:parts.map(p=>p.ans||'').join(' '),cert:(s.cert||[]).length,given,
        parts:parts.map(p=>({q:p.q||'',given:labs(p.given),steps:(p.steps||[]).map(st=>{ const d=document.createElement('div'); d.innerHTML=st.tbl||'';
          const R={}; d.querySelectorAll('details.hw-l').forEach(x=>{ const m=/l(\d)/.exec(x.className); const body=x.querySelector('div'); if(m&&body) R[m[1]]=body.innerHTML; });
          return {t:st.t,d:st.d||'',why:st.why||'',R,add:labs(st.add),pts:(st.add||[]).filter(e=>e&&e.t==='pt'&&typeof e.l==='string').map(e=>e.l)}; })}))}); }
    return out; },dz);
  const variants=raw.map(v=>{ if(v.err) return {n:v.n,err:v.err};
    let seen=new Set(v.given);
    const steps=[];
    v.parts.forEach((p,pi)=>{ p.given.forEach(l=>seen.add(l)); p.steps.forEach((st,si)=>{
      const R={}; for(const k of ['1','2','3','4','5']) if(st.R[k]) R[k]=strip(st.R[k]);
      if(!R['3']&&(st.d||st.why)) R['3']=strip(st.d); if(!R['2']&&st.why) R['2']=strip(st.why);
      /* секрет — найденные точки шага (их положение и есть ответ шага); названия прямых и плоскостей и цель шага — не секрет */
      const goal0=strip(st.t), before=[...seen], fresh=[...new Set(st.pts.filter(l=>!seen.has(l)&&!goal0.includes(l)))], intro=[...new Set(st.add.filter(l=>!seen.has(l)&&!fresh.includes(l)))];
      const nums=[...new Set([R['3'],R['4']].join(' ').match(NUM)||[])].filter(x=>!/^[01]$/.test(x));
      const goal=strip(st.t);
      steps.push({id:`${dz}.v${v.n}.p${pi+1}.s${si+1}`,part:pi+1,goal,rungs:R,labels:before.concat(intro),secret:{labels:fresh,numbers:nums},
        topics:ngTopics(dz,goal+' '+(R['3']||'')+' '+(R['2']||''))});
      st.add.forEach(l=>seen.add(l)); }); });
    return {n:v.n,kind:v.kind,q:strip(v.q),ans:strip(v.ans),cert:v.cert,steps}; });
  return {dz,subj:'ng',variants};
}
/* инжа: шаг — элемент детали; ступени из базы «как строится» (только данные элемента) */
function ig(dz,KB){
  const VIEW_IN={F:'на главном виде',T:'на виде сверху',L:'на виде слева'};
  const V=KB.dz[dz]||{}, variants=[];
  for(const n of Object.keys(V).map(Number).sort((a,b)=>a-b)){ const steps=[];
    V[n].feats.forEach((ex,i)=>{ if(ex.kind==='тело'&&!ex.byView.length) return;
      const tops=ex.topics.map(t=>IG.BY[t]).filter(Boolean), main=tops.find(t=>!['v2','v3','v6','r1','r2'].includes(t.id))||tops[0];
      const views=ex.byView.map(b=>VIEW_IN[b.v]).filter(Boolean);
      const nums=[...new Set(ex.byView.flatMap(b=>(b.how.y||[]).map(v=>String(Math.round(v*10)/10).replace('.',','))))];
      const R={1:`${ex.name}: где он дан и на каких видах его ещё нет? ${views.length?'Достраивать — '+views.join(' и ')+'.':''}`.trim(),
        2:main?`Опирайся на правило: ${main.new}.`:'Высоты — с главного вида, глубины — с вида сверху.',
        3:ex.say,
        4:nums.length?`Глубины от оси: ${nums.join('; ')} мм.`:'',
        5:'Каждая точка — на одной линии связи на всех видах; невидимое — штриховыми; в разрезе материал штрихуется, отверстие — нет.'};
      steps.push({id:`${dz}.v${n}.f${i}`,goal:`${ex.name}`,feature:i,rungs:R,labels:['главный вид','вид сверху','вид слева'],secret:{labels:[],numbers:nums},topics:ex.topics}); });
    variants.push({n,q:V[n].title,steps}); }
  return {dz,subj:'ig',variants};
}
(async()=>{
  const want=d=>!ONLY||ONLY===d, stat=[];
  const KB=JSON.parse(fs.readFileSync(path.join(ROOT,'kb/ig-dz.json'),'utf8'));
  for(const d of ['ig2','ig3','ig4','ig5','ig6']) if(want(d)){ const r=ig(d,KB); fs.writeFileSync(path.join(OUT,d+'.json'),JSON.stringify(r)); stat.push(`${d}: ${r.variants.length} вар., ${r.variants.reduce((s,v)=>s+v.steps.length,0)} шагов`); }
  const ngs=['ng1','ng2','ng3','ng4','ng5'].filter(want);
  if(ngs.length){
    const {chromium}=require('playwright');
    const srv=await new Promise(r=>{ const s=http.createServer((q,res)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const p=path.join(ROOT,f);
      if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ res.writeHead(404); return res.end(); }
      res.writeHead(200,{'content-type':{'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json'}[path.extname(p)]||'application/octet-stream'}); fs.createReadStream(p).pipe(res); }).listen(0,()=>r(s)); });
    const b=await chromium.launch(), pg=await b.newPage();
    await pg.goto('http://127.0.0.1:'+srv.address().port+'/#/'); await pg.waitForFunction(()=>window.DZR&&DZR.numbers('ng1').length,null,{timeout:60000});
    for(const d of ngs){ const r=await ng(pg,d); fs.writeFileSync(path.join(OUT,d+'.json'),JSON.stringify(r));
      stat.push(`${d}: ${r.variants.length} вар., ${r.variants.reduce((s,v)=>s+(v.steps||[]).length,0)} шагов${r.variants.some(v=>v.err)?', ошибки: '+r.variants.filter(v=>v.err).map(v=>v.n).join(','):''}`); }
    await b.close(); srv.close(); }
  console.log(stat.join('\n'));
})().catch(e=>{ console.error(e); process.exit(1); });
