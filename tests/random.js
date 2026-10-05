/* ═══════════ Случайные варианты: проверка метода, а не одного чертежа ═══════════
   Каждая задача тетради на сайте — программа: исходные точки заданы числами, остальное вычисляется
   операциями построения. Здесь исходные числа слегка искажаются (одинаковые значения — одинаково,
   нули остаются нулями, поэтому «горизонталь», «точка на π₁», «профильная прямая» сохраняются),
   блок задач выполняется заново, и полученный чертёж проходит ту же 3D-проверку.
   Верный метод остаётся верным на любых данных; подогнанная вручную точка или число, набранное
   руками, на искажённых данных сразу дают противоречие. */
const fs=require('fs'), path=require('path');
const SRC=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

/* блоки верхнего уровня скриптов страницы, в которых добавляются задачи тетради (разбор — acorn) */
let acorn; try{ acorn=require('acorn'); }catch(e){ acorn=require('/opt/node-tools/node_modules/acorn'); }
function blocks(){
  const out=[], re=/<script>([\s\S]*?)<\/script>/g; let m;
  while((m=re.exec(SRC))){ const code=m[1], base=SRC.slice(0,m.index+8).split('\n').length;
    let ast; try{ ast=acorn.parse(code,{ecmaVersion:'latest'}); }catch(e){ continue; }
    ast.body.forEach(st=>{ const src=code.slice(st.start,st.end); if(/WB3\.add\(/.test(src)&&!/^(const|let|var)\s+WB3\b/.test(src)) out.push({line:base+code.slice(0,st.start).split('\n').length-1,src}); }); }
  return out;
}
/* детерминированный генератор */
function rng(seed){ let x=seed>>>0||1; return ()=>{ x^=x<<13; x>>>=0; x^=x>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
/* монотонное искажение числа: v → v(1+s) + e(sin(v/λ+φ) − sin φ); 0 → 0, равные — равны */
function warp(seed){ const r=rng(seed); const s=(r()-.5)*.12, e=.6+r()*1.6, lam=7+r()*9, ph=r()*6.28;
  return v=>{ if(v===0) return 0; const w=v*(1+s)+e*(Math.sin(v/lam+ph)-Math.sin(ph)); return Math.round(w*100)/100; }; }
const NUM='(-?\\d+(?:\\.\\d+)?)', MUL='((?:\\s*\\*\\s*[A-Za-z_$][\\w$]*)?)';
/* тройки координат: [x,y,z] и [x*s,y*s,z*s] */
const RE=new RegExp('\\[\\s*'+NUM+MUL+'\\s*,\\s*'+NUM+MUL+'\\s*,\\s*'+NUM+MUL+'\\s*\\](?!\\s*\\.)','g');
/* отдельные числа-данные: const X=67.8, kf=0.84, … (в объявлениях) */
const SC=/(\b(?:const|let)\s+|,\s*)([A-Za-z_$][\w$]*)(\s*=\s*)(-?\d+(?:\.\d+)?)(?=\s*[,;\n]|\s*\/[\/*])/g;
function perturb(src,seed){ const f=warp(seed); let n=0;
  let s=src.replace(RE,(m,a,ma,b,mb,c,mc)=>{ n++; return '['+[[a,ma],[b,mb],[c,mc]].map(([v,k])=>f(+v)+(k||'')).join(',')+']'; });
  s=s.replace(SC,(m,pre,name,eq,v,off,all)=>{ if(/for\s*\(\s*(let|const|var)?\s*$/.test(all.slice(Math.max(0,off-12),off)+pre)) return m; if(/^(s|sc|K|scale|SC)$/.test(name)) return m;   /* масштаб чертежа — не данные задачи */ n++; return pre+name+eq+f(+v); });
  return {src:s,n}; }

module.exports={blocks,perturb,warp};
