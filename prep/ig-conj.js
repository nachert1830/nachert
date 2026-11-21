/* ═══════════ Подготовка по инже: темы геометрических построений (g5–g13) на ядре сопряжений ═══════════
   Источник — dz/ig/1/topics.js (теория как данные: случайные исходные, кадры построения, ловушки, проверка определением).
   Здесь — переходник в формат PREP.topic: кадры → шаги «Смотри», последний кадр каждой ветки → карточка дуэли,
   пара честная только если верное построение проходит проверку ядра, а ловушка — нет (fair).
   Координаты ядра — мм, y вверх; чертёж движка — y вниз. Роль элемента = «f<номер кадра>_<роль ядра>», чтобы шаги открывались по кадрам. */
(function(){
const NODE=typeof module!=='undefined'&&module.exports&&typeof require==='function';
const IG1T=self.IG1T||(NODE?require('../dz/ig/1/topics.js'):null);
if(!self.PREP||!IG1T) return;
const CLS={given:'o',locus:'a',aux:'lk',center:'d',tan:'b',result:'crv',axis:'cl'};
const SEM=['given','locus','aux','center','tan','result','axis'];
const Y=v=>-v;
function els(F){
  const E=[];
  F.forEach((f,i)=>f.els.forEach(e=>{ const role='f'+i+'_'+e.role, c=CLS[e.role]||'o';
    if(e.t==='pt') E.push({t:'pt',a:[e.at[0],Y(e.at[1])],lab:e.l||undefined,c:e.role==='center'?'d':e.role==='tan'?'b':'o',role});
    else if(e.t==='circle') E.push({t:'circ',a:[e.c[0],Y(e.c[1]),e.r],c,dash:e.role==='locus',role});
    else if(e.t==='seg') E.push({t:'line',a:[e.a[0],Y(e.a[1]),e.b[0],Y(e.b[1])],c,role});
    else if(e.t==='line') E.push({t:'line',a:[e.p[0]-e.d[0]*300,Y(e.p[1]-e.d[1]*300),e.p[0]+e.d[0]*300,Y(e.p[1]+e.d[1]*300)],c,dash:e.role==='locus',role});
    else if(e.t==='arc'){ const an=p=>Math.atan2(p[1]-e.c[1],p[0]-e.c[0]); let a0=an(e.from), s=e.ccw?an(e.to)-a0:a0-an(e.to); while(s<=1e-9) s+=2*Math.PI;
      const n=Math.max(8,Math.ceil(s/0.08)), p=[]; for(let k=0;k<=n;k++){ const t=a0+(e.ccw?1:-1)*s*k/n; p.push([e.c[0]+e.r*Math.cos(t),Y(e.c[1]+e.r*Math.sin(t))]); }
      E.push({t:'poly',p,c,role}); } }));
  return E;
}
function box(E){ let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; const P=(x,y,r=0)=>{ x0=Math.min(x0,x-r); x1=Math.max(x1,x+r); y0=Math.min(y0,y-r); y1=Math.max(y1,y+r); };
  E.forEach(e=>{ if(e.t==='pt') P(e.a[0],e.a[1]); else if(e.t==='circ'&&!/^f\d+_(locus|aux)$/.test(e.role)) P(e.a[0],e.a[1],e.a[2]); else if(e.t==='poly') e.p.forEach(q=>P(q[0],q[1])); });
  const w=x1-x0, h=y1-y0, pad=Math.max(w,h)*.14+4; return [x0-pad,y0-pad,w+2*pad,h+2*pad]; }
const roles=(F,upto,sem)=>{ const r=[]; for(let i=0;i<=upto;i++) (sem||SEM).forEach(s=>r.push('f'+i+'_'+s)); return r; };
for(const id of IG1T.ids){
  const t=IG1T.T[id], keys=Object.keys(t.traps);
  const build=(V,k)=>{ V._c=V._c||{}; const key=k||'ok'; if(!(key in V._c)){ let r=null; try{ r=k?t.traps[k].build(V.p):t.build(V.p); }catch(e){ r=null; } V._c[key]=r; } return V._c[key]; };
  const topic={
    make(){ for(let i=0;i<30;i++){ const V={p:t.make(Math.random)}; if(build(V,null)) return V; } return null; },
    scene(V,k){ const r=build(V,k), ok=build(V,null); if(!r||!ok) return null; const E=els(r.F); return {box:box(els(ok.F)),E}; },
    traps:Object.fromEntries(keys.map(k=>[k,{b0:0.2,say:t.traps[k].say,src:'тетрадь, гл. 2',hl:roles(t.traps[k].F||{length:40},40,t.traps[k].hl)}])),
    fair(V,k){ const ok=build(V,null), bad=build(V,k); return !!ok&&!!bad&&t.judge(V.p,ok)&&!t.judge(V.p,bad); },
    watch:{steps:[],V(){ const V=this===topic?topic.make():topic.make(); const r=V&&build(V,null); if(r) topic.watch.steps=r.F.map((f,i)=>({cap:f.cap,roles:roles(r.F,i)})); return V; }}
  };
  /* у темы одна ловушка: вторая — «зеркальная» не нужна; движок повторяет одну ловушку на новых числах */
  PREP.topic(id,topic);
}
})();
