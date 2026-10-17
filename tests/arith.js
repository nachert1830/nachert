/* ═══════════ Арифметика текста: каждое вычисление в пояснениях пересчитывается ═══════════
   «R₁ = √(23,6² + 30²) = 38,2 мм», «φ = 90° − 40,4° = 49,6°», «отношение 80/50 = 1,6» — запись вида
   «выражение = число» (или ≈) вычисляется заново по тем числам, что напечатаны. Расхождение больше погрешности
   округления напечатанных чисел — ошибка в тексте (опечатка, число от старых данных, не та формула).
   ARITH_CHECK({tasks, dz}) → [{name, rule, msg, lvl}]; ARITH_SCAN(text) → [{expr, val, shown, ok}]. */
(function(){
const FN={sqrt:Math.sqrt, sin:x=>Math.sin(x*Math.PI/180), cos:x=>Math.cos(x*Math.PI/180), tg:x=>Math.tan(x*Math.PI/180), tan:x=>Math.tan(x*Math.PI/180),
  arcsin:x=>Math.asin(x)*180/Math.PI, arccos:x=>Math.acos(x)*180/Math.PI, arctg:x=>Math.atan(x)*180/Math.PI, arctan:x=>Math.atan(x)*180/Math.PI};
/* разбор: число, + − * / ^, скобки, функции; ошибки синтаксиса → null */
function evalExpr(s){ let i=0; const t=s.replace(/\s+/g,'');
  const peek=()=>t[i], eat=c=>{ if(t[i]===c){ i++; return true; } return false; };
  function num(){ const m=/^\d+(?:\.\d+)?/.exec(t.slice(i)); if(!m) return null; i+=m[0].length; return {v:+m[0],d:(m[0].split('.')[1]||'').length,n:1}; }
  function atom(){ if(eat('(')){ const v=add(); if(v==null||!eat(')')) return null; return v; }
    if(eat('-')){ const v=atom(); return v&&{v:-v.v,d:v.d,n:v.n}; }
    const f=/^(sqrt|arcsin|arccos|arctg|arctan|sin|cos|tg|tan)/.exec(t.slice(i)); if(f){ i+=f[1].length; const a=atom(); return a&&{v:FN[f[1]](a.v),d:a.d,n:a.n,f:1}; }
    return num(); }
  function pow(){ let a=atom(); if(!a) return null; while(eat('^')){ const b=atom(); if(!b) return null; a={v:Math.pow(a.v,b.v),d:a.d,n:a.n,p:1}; } return a; }
  function mul(){ let a=pow(); if(!a) return null; for(;;){ if(eat('*')){ const b=pow(); if(!b) return null; a={v:a.v*b.v,d:Math.max(a.d,b.d),n:a.n+b.n,op:1}; }
      else if(eat('/')){ const b=pow(); if(!b||b.v===0) return null; a={v:a.v/b.v,d:Math.max(a.d,b.d),n:a.n+b.n,op:1}; } else return a; } }
  function add(){ let a=mul(); if(!a) return null; for(;;){ if(eat('+')){ const b=mul(); if(!b) return null; a={v:a.v+b.v,d:Math.max(a.d,b.d),n:a.n+b.n,op:1}; }
      else if(eat('-')){ const b=mul(); if(!b) return null; a={v:a.v-b.v,d:Math.max(a.d,b.d),n:a.n+b.n,op:1}; } else return a; } }
  const r=add(); return r&&i===t.length&&Number.isFinite(r.v)?r:null; }

const norm=s=>String(s).replace(/<sub>[^<]*<\/sub>/g,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/(\d),(\d)/g,'$1.$2').replace(/[−–]/g,'-').replace(/[×·]/g,'*').replace(/÷/g,'/')
  .replace(/²/g,'^2').replace(/³/g,'^3').replace(/√\s*\(/g,'sqrt(').replace(/√\s*(\d+(?:\.\d+)?)/g,'sqrt($1)').replace(/°/g,'').replace(/\s*мм\b/g,'');
/* хвост левой части — максимальный суффикс из знаков арифметики; голова правой — число */
const TAIL=/((?:sqrt|arcsin|arccos|arctg|arctan|sin|cos|tg|tan|[\d.+\-*/^() ])+)$/;
function scan(text){ const s=norm(text), out=[]; const parts=s.split(/(=|≈)/);
  for(let k=0;k+2<parts.length;k+=2){ const L=parts[k], rel=parts[k+1], R=parts[k+2];
    const m=TAIL.exec(L), r=/^\s*(-?\d+(?:\.\d+)?)(?![\d.]*\s*[*/^+]|\s*-\s*\d|\.\d)/.exec(R); if(!m||!r) continue;
    let e=m[1].trim(); if(/^[+*/^)]/.test(e)) continue;   /* «|A″B″|·tg 30°» — хвост символьного выражения, не вычисление */
    if(/^-/.test(e)&&/[\wА-Яа-я|′″)]\s*$/.test(L.slice(0,L.length-m[1].length))) continue;
    /* только настоящие вычисления: есть действие или функция, не дата и не номер */
    if(!/[+\-*/^]|sqrt|sin|cos|tg|tan|arc/.test(e.replace(/^-/,''))) continue;
    if(/^\(?\d+\)?$/.test(e)) continue;
    /* скобки сбалансированы: «(1,2 + 3)» в середине предложения не отрезаем на полуслове */
    let bal=0; for(const c of e){ if(c==='(') bal++; if(c===')') bal--; if(bal<0) break; } if(bal!==0){ e=e.replace(/^[^(]*\)/,''); bal=0; for(const c of e){ if(c==='(') bal++; if(c===')') bal--; } if(bal!==0) continue; }
    const v=evalExpr(e); if(!v||!v.op&&!v.f&&!v.p) continue;
    const shown=+r[1], dec=(r[1].split('.')[1]||'').length;
    /* погрешность: половина последнего разряда ответа + влияние округлённых данных (относительно, по числу операндов) */
    const tol=0.5*Math.pow(10,-dec)+Math.abs(v.v)*0.0015*Math.max(1,v.n)+(rel==='≈'?Math.max(0.5*Math.pow(10,-dec),Math.abs(v.v)*0.01):0)+1e-9;
    out.push({expr:e,val:v.v,shown,ok:Math.abs(v.v-shown)<=tol,rel}); }
  return out; }
window.ARITH_SCAN=scan;
window.ARITH_CHECK=function(opts){ opts=opts||{}; const out=[];
  const one=(name,o)=>{ if(!o) return; ['q','intro','ans','note','d','why','tbl','t'].forEach(k=>{ if(typeof o[k]!=='string') return;
      scan(o[k]).forEach(x=>{ if(!x.ok) out.push({name,rule:'арифметика в тексте',msg:x.expr.replace(/\*/g,'·').replace(/sqrt/g,'√')+' '+x.rel+' '+x.shown+', а по этим числам '+(Math.round(x.val*1000)/1000),lvl:'ошибка'}); }); }); };
  const run=(name,t)=>{ one(name,t); PLAYER.partsOf(t).forEach((p,pi)=>{ const nm=name+(pi?' п.'+(pi+1):''); one(nm,p); (p.steps||[]).forEach((s,k)=>one(nm+' · шаг '+(k+1),s)); }); };
  (opts.tasks||WB3.tasks).forEach(t=>run('Задача №'+t.n,t));
  if(!opts.tasks||opts.dz) (opts.dz||['1','2','2b','2c','3','4a','4b','5']).forEach(id=>{ const d=(opts.get||(i=>window.NGHW&&NGHW.get(i)))(id); if(d&&d.task) run('ДЗ '+id,d.task); });
  return out; };
})();
