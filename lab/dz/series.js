/* ═══════════ Серия кадров одного листа → один вердикт (как проверка паспорта: не одно фото, а несколько) ═══════════
   Каждый кадр проверяется отдельно (gridsheet.js), затем кадры голосуют. Один кадр может ошибиться из-за своего
   блика, тени, смаза или угла. Другой кадр того же листа ошибётся иначе. То, что видно на листе, повторяется во
   всех кадрах, а ошибка кадра — нет.
   Правила:
   1. Замер (координата точки, угол на чертеже) — медиана по кадрам. Погрешность — БОЛЬШЕЕ из погрешности модели
      (σ одного кадра) и разброса между кадрами: разброс — это измеренная, а не предсказанная точность.
   2. Утверждение («A z нанесена неточно», «шаг 2 неверен») — только если его делают ≥ ⌈2k/3⌉ из k прочитанных кадров
      (и не меньше двух) и ни один кадр не утверждает обратного. Противоречие кадров — «не могу утверждать» с
      причиной «кадры расходятся».
   3. Последовательная проверка: кадры добавляются, пока вывод не устоялся (enough) — обычно хватает двух-трёх.
   combine(results, {data}) → {ok, verdict, why[], frames:{n, read}, given:{diff, link}, steps, answers, conflicts[]}
   enough(series) → true, если ещё один кадр вывода не изменит */
(function(){
const isNode=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const put=(n,v)=>{ if(isNode) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };
const f1=x=>(Math.round(x*10)/10).toString().replace('.',',');
const med=a=>{ const t=a.slice().sort((x,y)=>x-y), n=t.length; return n?(n%2?t[n>>1]:(t[n/2-1]+t[n/2])/2):null; };
/* разброс между кадрами (оценка σ одного кадра): 3+ кадра — MAD, два — |a − b| / √2 */
const spread=a=>{ if(a.length<2) return 0; if(a.length===2) return Math.abs(a[0]-a[1])/Math.SQRT2; const m=med(a); return 1.4826*med(a.map(v=>Math.abs(v-m))); };
const need=k=>Math.max(2,Math.ceil(2*k/3));
/* голосование по статусам: противоположные — конфликт; иначе статус, набравший need(k) */
function vote(sts,opp,k){ const c={}; sts.forEach(s=>{ if(s!=null) c[s]=(c[s]||0)+1; });
  for(const [a,b] of opp) if(c[a]&&c[b]) return {st:null,conflict:a+' / '+b,c};
  const best=Object.entries(c).sort((x,y)=>y[1]-x[1])[0]; return best&&best[1]>=need(k)?{st:best[0],c}:{st:null,c}; }

function combine(results,o){ o=o||{}; const R=results.filter(r=>r&&r.ok), k=R.length, nAll=results.length, why=[], conflicts=[];
  const out={ok:k>0,frames:{n:nAll,read:k},why,conflicts};
  if(!k){ out.verdict='не могу прочитать'; why.push('ни один из '+nAll+' кадров не прочитан: '+((results[0]&&results[0].why)||[]).join('; ')); return out; }
  if(k===1&&nAll===1) return Object.assign({},R[0],{frames:{n:1,read:1},conflicts:[],single:true});
  why.push('кадров прочитано: '+k+' из '+nAll+(k<2?' — для уверенного вывода нужно хотя бы два, переснимите ещё раз':''));
  /* вариант (узнан по чертежу или указан) — один на все кадры; кадры узнали разные — вывода нет */
  const ns=[...new Set(R.map(r=>r.n).filter(x=>x!=null))]; out.n=ns.length===1?ns[0]:null;
  if(ns.length===1&&R.every(r=>(r.why||[]).some(w=>/^вариант узнан по чертежу/.test(w)))) why.push('вариант узнан по чертежу: '+ns[0]+' — одинаково во всех '+k+' кадрах');
  if(ns.length>1){ out.verdict='не могу утверждать'; why.push('кадры узнали разные варианты ('+ns.join(', ')+') — укажите номер варианта'); conflicts.push('вариант'); return out; }
  /* 1. данные как начерчены: каждая координата каждой точки */
  const diff=[], keys=[...new Set(R.flatMap(r=>r.given.diff.map(d=>d.n+d.c)))];
  keys.forEach(key=>{ const ds=R.map(r=>r.given.diff.find(d=>d.n+d.c===key)).filter(Boolean); if(!ds.length) return;
    const vals=ds.map(d=>d.drawn), m=med(vals), sp=spread(vals), sgM=med(ds.map(d=>d.sg)), sg=Math.max(sgM,sp), was=ds[0].was, d=m-was;
    const strong=ds.filter(x=>Math.sign(x.d)===Math.sign(d)&&Math.abs(x.d)>=1).length, opp=ds.filter(x=>x.sure&&Math.sign(x.d)!==Math.sign(d)).length;
    const sure=k>=2&&ds.length>=need(k)&&Math.abs(d)>=Math.max(1.5,3*sg)&&strong>=need(k)&&!opp;
    if(!sure&&ds.some(x=>x.sure)) conflicts.push(ds[0].n+' '+ds[0].c+': «неточно» в '+ds.filter(x=>x.sure).length+' из '+k+' кадров');
    diff.push({n:ds[0].n,c:ds[0].c,drawn:m,was,d,sg,sgModel:sgM,sgFrames:sp,frames:ds.length,sure,undecided:!sure&&ds.some(x=>x.sure)}); });
  const link=[]; [...new Set(R.flatMap(r=>r.given.link.map(l=>l.n)))].forEach(n=>{ const ls=R.map(r=>r.given.link.find(l=>l.n===n)).filter(Boolean), v=ls.map(l=>l.du), m=med(v), sg=Math.max(med(ls.map(l=>l.sg)),spread(v));
    const sure=k>=2&&ls.filter(l=>l.sure).length>=need(k)&&Math.abs(m)>=Math.max(1.5,3*sg); link.push({n,du:m,sg,sure}); });
  out.given={diff,link};
  const big=diff.filter(d=>d.sure);
  if(big.length) why.push('данные нанесены неточно: '+big.map(d=>d.n+' '+d.c+' = '+f1(d.drawn)+' вместо '+d.was+' (по '+d.frames+' кадрам, ± '+f1(d.sg)+' мм)').join(', '));
  else if(diff.length&&diff.every(d=>Math.abs(d.d)<1.5&&d.sg<=1)&&k>=2) why.push('все точки условия нанесены точно (по '+k+' кадрам каждая координата — в пределах 1,5 мм)');
  const bl=link.filter(l=>l.sure); if(bl.length) why.push('линии связи: '+bl.map(l=>l.n+'″ и '+l.n+'′ разошлись на '+f1(Math.abs(l.du))+' мм по x').join(', '));
  /* 2. эталон для начерченной пирамиды: медиана, σ — большее из модели и разброса кадров */
  const RM=R.filter(r=>r.mine);
  if(RM.length){ out.ref=RM[0].ref; out.mine={}; out.smine={}; Object.keys(RM[0].mine).forEach(q=>{ if(typeof RM[0].mine[q]!=='number') return; const v=RM.map(r=>r.mine[q]); out.mine[q]=med(v); out.smine[q]=Math.max(med(RM.map(r=>(r.smine||{})[q]||0)),spread(v)); });
    if(out.mine.H!=null) why.push('для пирамиды, как она начерчена: H = '+f1(out.mine.H)+' ± '+f1(out.smine.H)+' мм, угол SAB–ABC = '+f1(out.mine.dih)+' ± '+f1(out.smine.dih)+'°, угол SA–ABC = '+f1(out.mine.phi)+' ± '+f1(out.smine.phi)+'°'); }
  /* 3. ответы студента: статус — голосованием; верно ↔ неверное — противоположны */
  const OPPA=[['верно','построение'],['верно','данные'],['верно','неверно'],['данные','построение']];
  out.answers=[]; [...new Set(R.flatMap(r=>(r.answers||[]).map(a=>a.k)))].forEach(q=>{ const as=R.map(r=>(r.answers||[]).find(a=>a.k===q)).filter(Boolean), v=vote(as.map(a=>a.st),OPPA,k);
    const pick=v.st?as.find(a=>a.st===v.st):null; if(v.conflict) conflicts.push('ответ '+q+': кадры расходятся ('+v.conflict+')');
    const a={k:q,a:as[0].a,st:v.st||'не могу утверждать',msg:pick?pick.msg:'ответ '+f1(as[0].a)+': кадры расходятся ('+Object.entries(v.c).map(([s,c])=>s+' — '+c).join(', ')+') — переснимите',ref:as[0].ref,mine:out.mine?out.mine[q]:as[0].mine};
    const ms=as.map(x=>x.measured).filter(x=>x!=null); if(ms.length) a.measured=med(ms); out.answers.push(a); why.push(a.msg); });
  /* 4. ДЗ №3 г) по шагам */
  const RS=R.filter(r=>r.ex3d&&r.ex3d.steps&&r.ex3d.steps.length);
  if(RS.length){ const ks=[...new Set(RS.flatMap(r=>r.ex3d.steps.map(s=>s.k)))]; out.steps=ks.map(q=>{ const ss=RS.map(r=>r.ex3d.steps.find(s=>s.k===q)).filter(Boolean), v=vote(ss.map(s=>s.status==='?'?null:s.status),[['ok','bad']],k);
      if(v.conflict) conflicts.push('шаг '+ss[0].name+': в одних кадрах ✓, в других ✗');
      const st=v.st||'?', pick=ss.find(s=>s.status===st)||ss[0], step={k:q,name:pick.name,status:st,msg:st==='?'&&v.conflict?'кадры расходятся — переснимите этот участок ближе':pick.msg,frames:ss.length,undecided:st==='?'&&ss.some(s=>s.status!=='?')};
      if(q==='psi'){ const ph=ss.filter(s=>s.val&&s.val.phi!=null).map(s=>s.val.phi); if(ph.length){ const sp=spread(ph); step.val={phi:med(ph),spsi:Math.max(med(ss.map(s=>(s.val&&s.val.spsi)||0)),sp),spread:sp}; if(st==='ok') step.msg='на чертеже φ = '+f1(step.val.phi)+' ± '+f1(step.val.spsi)+'° (медиана '+ph.length+' кадров)'; } }
      return step; });
    out.first=out.steps.find(s=>s.status==='bad')||null;
    if(out.steps[0]&&out.steps[0].status==='ok'){ why.push('г) по шагам: '+out.steps.map((s,i)=>(s.status==='ok'?'✓':s.status==='bad'?'✗':'?')+' '+(i+1)+'. '+s.msg).join('; '));
      if(out.first) why.push('г) первая ошибка — шаг '+(out.steps.indexOf(out.first)+1)+' «'+out.first.name+'»'); } }
  if(conflicts.length) why.push('кадры расходятся — об этом ничего не утверждаю: '+conflicts.join('; '));
  /* итог — как у одного кадра, но по согласованным выводам */
  const ans=out.answers, ansBad=ans.some(a=>a.st==='построение'||a.st==='неверно'), ansData=ans.some(a=>a.st==='данные');
  /* «данные нанесены верно» — только если это видно: все координаты в 1,5 мм во всех кадрах и кадры не спорят */
  const dataClean=diff.length>0&&diff.every(d=>Math.abs(d.d)<1.5&&d.sg<=1)&&!diff.some(d=>d.undecided);
  out.verdict=k<2?'не могу утверждать':ansBad||(out.first&&!ans.length)?'ошибка':ansData||big.length?'ошибка в данных':ans.length&&ans.every(a=>a.st==='верно')?'верно':ans.some(a=>a.st==='не могу утверждать')||conflicts.length||!dataClean?'не могу утверждать':'данные нанесены верно';
  return out; }

/* ещё кадр нужен, если: прочитано меньше двух; есть противоречия; какое-то утверждение держится на одном голосе
   сверх порога (ещё один несогласный кадр его снял бы); что-то не решено — один кадр видит, другие нет */
function enough(s,maxFrames){ if(!s||!s.frames) return false; if(s.frames.n>=(maxFrames||5)) return true; if(s.frames.read<2||s.conflicts.length) return false;
  const k=s.frames.read, thin=x=>x.frames!=null&&x.frames<need(k+1);
  if(s.given&&s.given.diff.some(d=>d.sure&&thin(d)||d.undecided)) return false; if(s.steps&&s.steps.some(q=>q.status!=='?'&&thin(q)||q.undecided)) return false;
  return s.frames.read>=3||s.given&&s.given.diff.every(d=>Math.abs(d.d)<1||d.sure&&Math.abs(d.d)>=3); }
put('dzSeries',{combine,enough,med,spread});
})();
