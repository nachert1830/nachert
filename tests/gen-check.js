/* ═══════════ Допуск задач к генератору вариантов (GEN на сайте) ═══════════
   Для каждой задачи строим 12 вариантов тем же кодом, что работает на сайте (GEN.variant), и проверяем:
     • большинство вариантов проходит 3D-проверку и оракул (иначе задача слишком чувствительна к данным);
     • числа в тексте решения меняются вместе с данными. Число, которое не меняется, хотя чертёж изменился, —
       набрано руками и на варианте было бы неверным. Исключения: числа из условия, ссылки «вопрос 11», «стр. 7»,
       «задача 45», «№ 3», и 0, 1, 2, 3, 4, 90, 180, 360.
   Возвращает {ok:[n…], why:{n: причина}} — список ok должен совпадать с GEN_OK в index.html. */
async function genEligibility(page,N){
  N=N||12;
  return page.evaluate(async N=>{
    await GEN.checkers();
    const strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/g,' ');
    const texts=t=>{ const a=[t.intro,t.ans,t.note]; const parts=(t.parts&&t.parts.length)?t.parts:[t];
      parts.forEach(p=>{ if(p!==t) a.push(p.q,p.ans); (p.steps||[]).forEach(s=>a.push(s.t,s.d,s.why)); }); return a.map(strip).join(' ¦ '); };
    const REF=/(вопрос\S*|задач\S*|стр\.|№|рис\.|пункт\S*|п\.)\s*(\d+\s*(,|и)\s*)*$/i;
    const nums=s=>{ const out=[]; s.replace(/\d+(?:[.,]\d+)?/g,(m,off)=>{ const before=s.slice(Math.max(0,off-14),off), after=s.slice(off+m.length,off+m.length+12);
        if(/[₀-₉]$/.test(before)||/[A-Za-zА-Яа-я]$/.test(before)||/^[′″‴₀-₉]/.test(after)) return m;   /* часть имени: A1, x₁₄, 1′ */
        const v=parseFloat(m.replace(',','.')), meas=/^\s*(мм|°|%)/.test(after);
        const label=!meas&&Number.isInteger(v)&&v<=99&&!/[=≈]\s*$/.test(before);                      /* номер точки, прямая «12», счёт */
        const scale=/^\s*раз/.test(after)||/(увеличен\S*|уменьшен\S*|масштаб\S*)\s*(в\s*)?$/.test(before);
        const k45=v===45&&/^\s*°/.test(after);                                                           /* постоянная прямая k, луч под 45° */
        out.push({v,ref:REF.test(before)||label||scale||k45,m,ctx:(before+m+after).replace(/\s+/g,' ')}); return m; }); return out; };
    const SMALL=new Set([0,1,2,3,4,90,180,360]);
    const ok=[], why={};
    for(const t of WB3.tasks){ const n=t.n; if(typeof n!=='number') continue;
      if(t.fixed){ why[n]='условие задано числами'; continue; }
      if(!GEN.blockOf(n)){ why[n]='нет блока'; continue; }
      const pin=GEN.pinOf([t]), base=nums(texts(t)); let pass=0, moved=0; const constant=new Map();
      for(let i=0;i<N;i++){ const v=GEN.variant(n,1000+i*97,1); if(!v) continue; pass++;
        const cur=nums(texts(v.task)); if(cur.length!==base.length) continue; moved++;
        base.forEach((b,k)=>{ if(cur[k].v===b.v) constant.set(k,(constant.get(k)||0)+1); }); }
      if(pass<N/2){ why[n]='проходит '+pass+' из '+N+' вариантов'; continue; }
      const typed=base.filter((b,k)=>moved>=3&&constant.get(k)===moved&&!b.ref&&!pin.has(b.v)&&!SMALL.has(b.v));
      if(typed.length){ why[n]='в тексте не меняются: '+[...new Set(typed.map(b=>'«'+b.ctx.trim()+'»'))].slice(0,4).join('; '); continue; }
      ok.push(n); }
    return {ok,why};
  },N);
}
module.exports={genEligibility};
