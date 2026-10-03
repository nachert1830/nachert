/* ═══════════ Проверка самой проверки (мутационное тестирование) ═══════════
   В настоящие чертежи сайта по одной подсаживаются типовые ошибки, и считается, какую долю
   из них ловит GEOM_CHECK. Запуск в браузере: MUTATE_CHECK({n:300, seed:1}) → {тип: {всего, поймано}} */
window.MUTATE_CHECK=function(opts){
  opts=opts||{}; let seed=opts.seed||1; const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
  const pick=a=>a[Math.floor(rnd()*a.length)];
  const MARK=/^(.+?)(′|″)$/;
  /* финальные чертежи всех задач и рисунки уроков */
  const scenes=[];
  const partsOf=t=>(t.parts&&t.parts.length)?t.parts.map(p=>Object.assign({given:t.given||[]},p)):[{given:t.given||[],steps:t.steps||[]}];
  const task=(name,t)=>partsOf(t).forEach((p,pi)=>{ let acc=(p.given||[]).slice(); (p.steps||[]).forEach(s=>acc=acc.concat(s.add||[])); scenes.push({name:name+' п.'+(pi+1),items:acc}); });
  COURSE.forEach(l=>(l.blocks||[]).forEach((b,i)=>{ if(b.t==='fig'&&b.scene) scenes.push({name:'Урок '+l.id+' рис.'+(i+1),items:b.scene.items}); }));
  WB3.tasks.forEach(t=>task('№'+t.n,t));
  ['1','2','3','4a','4b','5'].forEach(id=>{ const d=window.NGHW&&NGHW.get(id); if(d&&d.task) task('ДЗ '+id,d.task); });
  const key=o=>o.rule+'|'+o.msg;
  const base=new Map(scenes.map(s=>[s.name,new Set(GEOM_CHECK({items:s.items}).map(key))]));
  const clone=items=>items.map(it=>it?JSON.parse(JSON.stringify(it)):it);
  const res={};
  const MUT={
    /* сдвинуть одну проекцию точки вбок — разрыв линии связи */
    'линия связи': items=>{ const c=items.map((it,i)=>[it,i]).filter(([it])=>it&&it.t==='pt'&&it.l&&MARK.test(it.l)&&!/≡|=/.test(it.l)&&items.some(o=>o&&o.t==='pt'&&o.l===MARK.exec(it.l)[1]+(MARK.exec(it.l)[2]==='′'?'″':'′')));
      if(!c.length) return null; const [it]=pick(c); const d=(rnd()<.5?-1:1)*(4+rnd()*10); const old=it.at.slice();
      items.forEach(o=>{ if(o&&o.t==='pt'&&o.at&&Math.abs(o.at[0]-old[0])<0.01&&Math.abs(o.at[1]-old[1])<0.01) o.at=[old[0]+d,old[1]]; }); return it.l; },
    /* число на чертеже на 3–9 мм больше */
    'размер': items=>{ const c=items.filter(it=>it&&(it.t==='seg'||it.t==='dim')&&it.l&&/(\d+(?:[.,]\d+)?)\s*мм/.test(it.l)); if(!c.length) return null;
      const it=pick(c); it.l=it.l.replace(/(\d+(?:[.,]\d+)?)(\s*мм)/,(m,v,u)=>String(Math.round(parseFloat(v.replace(',','.'))+3+rnd()*6))+u); return it.l; },
    /* подпись «≡» на точке, где проекции на самом деле разные: переставить подпись одной проекции к соседней точке */
    'подписи местами': items=>{ const c=items.filter(it=>it&&it.t==='pt'&&it.l&&MARK.test(it.l)&&!/≡|=/.test(it.l)); if(c.length<4) return null;
      const a=pick(c), m=MARK.exec(a.l); const same=c.filter(o=>o!==a&&MARK.exec(o.l)[2]===m[2]&&Math.abs(o.at[0]-a.at[0])>8); if(!same.length) return null;
      const b=pick(same); const t=a.l; a.l=b.l; b.l=t; return a.l+'↔'+b.l; },
  };
  const names=Object.keys(MUT); const N=opts.n||300;
  for(let k=0;k<N;k++){ const s=pick(scenes), type=names[k%names.length]; const items=clone(s.items||[]); const what=MUT[type](items); if(what==null) continue;
    const r=res[type]||(res[type]={всего:0,поймано:0,пропуски:[]}); r.всего++;
    const now=GEOM_CHECK({items}).map(key).filter(x=>!base.get(s.name).has(x));
    if(now.length) r.поймано++; else if(r.пропуски.length<8) r.пропуски.push(s.name+': '+what); }
  return res;
};
