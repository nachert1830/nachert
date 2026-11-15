/* ═══ Проверка ИИ-наставника: ядро (kernel/tutor-core.js) на всех задачах (docs/TUTOR.md) ═══
   Загружается в страницу сайта (как остальные проверки в tests/run.js): TUTOR_CHECK() → {problems, stats}.
   1. Лестница подсказок ядра на КАЖДОМ шаге каждой задачи тетради и ДЗ: все действия на чертеже допустимы,
      в тексте нет ни одной подписи, которой нет на чертеже (то же правило, что для ответа модели).
   2. Истинные отношения чертежа ядро подтверждает: обе проекции точки — на одной линии связи; точка — на своей линии.
   3. Мутации: сдвиг проекции с линии связи, перестановка высот двух точек, выдуманная подпись в ответе,
      ложное утверждение в claims — каждую ядро должно поймать (порог — 99 %).
   4. «Отметь точку» (Решаю сам): касание в верном месте — «верно», мимо линии связи — диагноз «линия связи». */
(function(){
function parts(t){ try{ return PLAYER.partsOf(t); }catch(e){ return []; } }
function* tasks(){
  for(const t of WB3.tasks) yield {name:'Тетрадь № '+t.n,t};
  for(const id of ['ng1','ng2','ng3','ng4','ng5']) for(const n of [1,7,13,16,24,30]){ let r=null; try{ r=DZR.solve(id,n); }catch(e){} if(r&&r.task) yield {name:id+'/'+n,t:r.task}; } }
window.TUTOR_CHECK=function(o){ o=o||{}; const C=TUTORCORE, problems=[], st={steps:0,ladders:0,links:0,linkOk:0,mut:{link:[0,0],height:[0,0],label:[0,0],claim:[0,0],tap:[0,0]}};
  const bad=(name,rule,msg)=>problems.push({name,rule,msg});
  const clone=M=>JSON.parse(JSON.stringify(M));
  for(const {name,t} of tasks()){ parts(t).forEach((p,pi)=>{ const n=(p.steps||[]).length;
    for(let k=0;k<=n;k++){ let M; try{ M=C.build(p,k,{n:t.n,title:name,q:t.q,has3d:true}); }catch(e){ bad(name,'наставник: снимок шага',pi+':'+k+' '+e.message); continue; } st.steps++;
      /* 1. лестница */
      for(let lv=0;lv<=4;lv++){ const L=C.ladder(M,lv), sh=C.checkShow(M,L.show), unk=C.guardText(M,L.say+' '+(L.ask||'')); st.ladders++;
        if(sh.bad.length) bad(name,'наставник: действие на чертеже',`пункт ${pi+1}, шаг ${k}, ступень ${lv}: ${sh.bad.join('; ')}`);
        if(unk.length) bad(name,'наставник: подпись не с чертежа',`пункт ${pi+1}, шаг ${k}, ступень ${lv}: ${unk.join(', ')}`);
        if(!L.say) bad(name,'наставник: пустая подсказка',`пункт ${pi+1}, шаг ${k}, ступень ${lv}`); }
      /* 2–3. пары проекций одной точки на одной линии связи (только на последнем шаге — там все точки) */
      if(k!==n) continue;
      const ids=Object.keys(M.pts).filter(x=>/″$/.test(x)&&M.pts[x.slice(0,-1)+'′']);
      ids.forEach(f=>{ const h=f.slice(0,-1)+'′', a=M.pts[f], b=M.pts[h]; if(a.xy[1]>0||b.xy[1]<0) return;   /* только обычный эпюр: ″ над осью, ′ под ней */
        st.links++; const v=C.verify(M,{rel:'same_link',a:f,b:h}); if(v.ok) st.linkOk++;
        if(!v.ok) return;   /* разрыв линии связи на чертеже ловят другие проверки (geometry.js) */
        const M2=clone(M); M2.pts[h].xy[0]+=M.tol*4; st.mut.link[1]++; if(C.verify(M2,{rel:'same_link',a:f,b:h}).ok===false) st.mut.link[0]++; else bad(name,'наставник: мутация не поймана','сдвиг '+h+' с линии связи');
        /* «Отметь точку»: верное место и мимо линии связи */
        const M3=clone(M); M3.k=Math.max(1,b.s); M3.hidden=true; if(a.s<b.s){ st.mut.tap[1]+=2; const r1=C.tapCheck(M3,h,b.xy), r2=C.tapCheck(M3,h,[b.xy[0]+M.tol*12,b.xy[1]]);
          if(r1.ok) st.mut.tap[0]++; else bad(name,'наставник: «отметь точку»','верное место '+h+' не принято');
          if(!r2.ok&&r2.kind==='link') st.mut.tap[0]++; else bad(name,'наставник: «отметь точку»','мимо линии связи '+h+': '+r2.kind); } });
      /* высоты: две фронтальные проекции на разной высоте — перестановка меняет ответ ядра */
      const fr=ids.filter(f=>M.pts[f].xy[1]<0); for(let i=0;i+1<fr.length&&i<6;i++){ const a=fr[i], b=fr[i+1]; if(Math.abs(M.pts[a].xy[1]-M.pts[b].xy[1])<=M.tol*2) continue;
        const v1=C.verify(M,{rel:'higher',a,b}).ok, M2=clone(M); const y=M2.pts[a].xy[1]; M2.pts[a].xy[1]=M2.pts[b].xy[1]; M2.pts[b].xy[1]=y;
        st.mut.height[1]++; if(C.verify(M2,{rel:'higher',a,b}).ok===!v1) st.mut.height[0]++; else bad(name,'наставник: мутация не поймана','высоты '+a+' и '+b); }
      /* ответ модели с выдуманной точкой и с ложным утверждением */
      if(ids.length){ const f=ids[0], h=f.slice(0,-1)+'′';
        st.mut.label[1]++; if(!C.reply(M,{say:'Посмотри на точку Q₉″ — она на линии связи.'}).ok) st.mut.label[0]++; else bad(name,'наставник: мутация не поймана','выдуманная подпись Q₉″');
        const tr=C.verify(M,{rel:'same_link',a:f,b:h}).ok;
        if(tr){ const M2=clone(M); M2.pts[h].xy[0]+=M.tol*4; st.mut.claim[1]++; if(!C.reply(M2,{say:'Они на одной линии связи.',claims:[{rel:'same_link',a:f,b:h}]}).ok) st.mut.claim[0]++; else bad(name,'наставник: мутация не поймана','ложное утверждение пропущено'); } }
    } }); }
  return {problems,stats:st}; };
})();
