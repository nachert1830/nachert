/* ═══════════ Проверка отрисовки: подписи не налезают друг на друга и на точки ═══════════
   Каждый чертёж рисуется так же, как на сайте (DRAW.svg + раскладка подписей), в ширину телефона,
   после чего измеряются прямоугольники подписей. Запуск в браузере: await RENDER_CHECK() */
window.RENDER_CHECK=async function(opts){
  opts=opts||{}; const out=[], W=opts.width||360;
  const host=document.createElement('div'); host.style.cssText='position:absolute;left:0;top:0;width:'+W+'px;background:#fff;z-index:99999';
  document.body.appendChild(host);
  const scenes=[];
  const partsOf=t=>(t.parts&&t.parts.length)?t.parts.map(p=>Object.assign({given:t.given||[]},p)):[{given:t.given||[],steps:t.steps||[]}];
  const task=(name,t)=>partsOf(t).forEach((p,pi)=>{ const nm=name+(pi?' п.'+(pi+1):''); let acc=(p.given||[]).slice(); const all=acc.slice(); (p.steps||[]).forEach(s=>all.push(...(s.add||[])));
    scenes.push({name:nm+' · дано',sc:{items:acc,fitTo:all}});
    (p.steps||[]).forEach((st,k)=>{ acc=acc.concat(st.add||[]); scenes.push({name:nm+' · шаг '+(k+1),sc:{items:acc.slice(),fitTo:all}}); }); });
  if(opts.scenes) scenes.push(...opts.scenes); else {
  COURSE.forEach(l=>(l.blocks||[]).forEach((b,i)=>{ if(b.t==='fig'&&b.scene) scenes.push({name:'Урок '+l.id+' · рисунок '+(i+1),sc:b.scene}); }));
  WB3.tasks.forEach(t=>task('Задача №'+t.n,t));
  (typeof TK3!=='undefined'?TK3:[]).forEach(tk=>tk.tasks.forEach(t=>task(tk.title+' · '+(t.idx||t.key),t)));
  ['1','2','3','4a','4b','5'].forEach(id=>{ const d=window.NGHW&&NGHW.get(id); if(d&&d.task) task('ДЗ '+id,d.task); });
  }
  const inter=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  for(const s of scenes){
    let html=''; try{ html=DRAW.svg(s.sc); }catch(e){ out.push({name:s.name,rule:'сбой отрисовки',msg:String(e)}); continue; }
    host.innerHTML=html; const svg=host.querySelector('svg'); if(!svg) continue;
    svg.classList.add('dwg'); svg.style.width=W+'px'; svg.style.height='auto'; delete svg.dataset.dc;
    try{ window.DECLUTTER&&DECLUTTER(svg); }catch(e){}
    const T=[...svg.querySelectorAll('text.lbl')].map(t=>{ const b=t.getBBox(); return {s:(t.textContent||'').trim(),b:{x:b.x+0.5,y:b.y+b.height*0.18,w:Math.max(0,b.width-1),h:b.height*0.64}}; }).filter(o=>o.s&&o.b.w>0);
    const dots=[...svg.querySelectorAll('circle')].map(c=>{ const r=+c.getAttribute('r')||0; if(!r||r>6) return null; return {x:+c.getAttribute('cx')-r,y:+c.getAttribute('cy')-r,w:2*r,h:2*r}; }).filter(Boolean);
    const vb=svg.viewBox.baseVal;
    for(let i=0;i<T.length;i++){ const a=T[i];
      for(let j=i+1;j<T.length;j++){ const b=T[j]; const ov=inter(a.b,b.b), m=Math.min(a.b.w*a.b.h,b.b.w*b.b.h);
        if(m>0&&ov/m>0.18) out.push({name:s.name,rule:'подписи налезают',msg:'«'+a.s+'» и «'+b.s+'» перекрываются на '+Math.round(100*ov/m)+'%'}); }
      for(const d of dots){ const ov=inter(a.b,d); if(ov/(d.w*d.h)>0.5) { out.push({name:s.name,rule:'подпись на точке',msg:'«'+a.s+'» закрывает точку'}); break; } }
      if(vb&&vb.width&&(a.b.x<vb.x-2||a.b.y<vb.y-2||a.b.x+a.b.w>vb.x+vb.width+2||a.b.y+a.b.h>vb.y+vb.height+2)) out.push({name:s.name,rule:'подпись за краем',msg:'«'+a.s+'» выходит за край чертежа'}); }
  }
  host.remove();
  const seen=new Set();
  return out.filter(o=>{ const k=o.name.replace(/ · (шаг \d+|дано)$/,'')+'|'+o.rule+'|'+o.msg.replace(/ на \d+%$/,''); if(seen.has(k)) return false; seen.add(k); return true; });
};
