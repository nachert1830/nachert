/* ═══════════ ДЗ-оракул: разборы ДЗ №2 (2а–2в) и №3 проверяются числами, независимо от кода построения ═══════════
   Чертёж читается как набор чисел: подписанные точки (A″, A′, A₄, B₁′…) → координаты в мм. Условие берётся
   из таблицы данных задачи и из текста условия («высота равна 80 мм»). Дальше — только счёт:
     • условие перенесено на чертёж точно (каждая данная точка — в своей проекции, линии связи вертикальны);
     • ответ удовлетворяет каждому условию задачи (S ∈ EF, d(S, ABC) = 80; AB = AC; AB ⟂ AK …);
     • промежуточные точки — там, где их требует метод (N на перпендикуляре, 3 на h_β, ℓ″ через 3″ 4″ S″);
     • замена плоскостей: линия связи ⟂ новой оси, расстояние до новой оси = координата, сохранённая со старого вида;
     • вращение вокруг прямой уровня: точка идёт по следу плоскости вращения, радиус = гипотенуза треугольника;
     • видимость каждого ребра — лучом к наблюдателю, а не тем алгоритмом, которым она нарисована;
     • каждое число в ответе и в тексте шагов (координаты, длины, углы) = вычисленному независимо.
   Формулы здесь написаны заново и не вызывают код сайта (кроме чтения готовой сцены PLAYER.scene).
   DZ_CHECK({get}) → [{name, rule, msg, lvl}]; get(id) — источник задач (по умолчанию NGHW.get, в случайных
   вариантах — пересобранный блок ДЗ). */
(function(){
const SC=()=>L.S;                                      /* единиц чертежа на мм */
const strip=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();
const num=s=>+String(s).replace('−','-').replace(',','.');
const sub=(a,b)=>a.map((v,i)=>v-b[i]), add=(a,b)=>a.map((v,i)=>v+b[i]), mul=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), len=a=>Math.sqrt(dot(a,a)), dist=(a,b)=>len(sub(a,b));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const deg=r=>r*180/Math.PI;
const angle=(u,v)=>deg(Math.atan2(len(cross(u,v)),dot(u,v)));        /* устойчиво и при малых углах */
const d2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
/* расстояние от точки до прямой (2D и 3D) */
const offLine2=(p,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1]; return Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/Math.hypot(dx,dy); };
const offLine3=(p,a,b)=>len(cross(sub(p,a),sub(b,a)))/len(sub(b,a));
const planeDist=(p,a,b,c)=>{ const n=cross(sub(b,a),sub(c,a)); return Math.abs(dot(sub(p,a),n))/len(n); };
const r1=x=>Math.round(x*10)/10;
const TOL=1e-3;                                         /* мм: чертёж посчитан в плавающей точке, а не нарисован рукой */
const TOLD=1e-3;                                        /* градусы */

/* ── чтение чертежа ── */
function readScene(part){
  const items=PLAYER.scene(part,(part.steps||[]).length).items, P={}, lines={}, segs=[];
  items.forEach(it=>{
    if(it.t==='pt'&&it.at&&it.l) strip(it.l).split(/\s*≡\s*/).forEach(n=>{ if(n&&!P[n]) P[n]=it.at.slice(); });
    if((it.t==='line'||it.t==='seg')&&it.a&&it.b){ const l=strip(it.l); if(l) (lines[l]=lines[l]||[]).push([it.a,it.b]); if(it.t==='seg') segs.push({a:it.a,b:it.b,k:it.k||'main'}); } });
  return {items,P,lines,segs};
}
/* координаты точки в пространстве по её проекциям (мм): x — по любой, z — по фронтальной, y — по горизонтальной */
function rec(P,n){ const f=P[n+'″'], h=P[n+'′'], S=SC(); if(!f||!h) return null; return [-f[0]/S,h[1]/S,-f[1]/S]; }
const F2=p=>[-p[0]*SC(),-p[2]*SC()], H1=p=>[-p[0]*SC(),p[1]*SC()];

/* таблица данных задачи → {A:[x,y,z],…} */
function readData(html){ const out={}; String(html||'').replace(/<tr>(.*?)<\/tr>/g,(m,row)=>{ const c=[...row.matchAll(/<td>(.*?)<\/td>/g)].map(x=>strip(x[1]));
  if(c.length===4&&c.slice(1).every(v=>/^[−\-]?\d+(?:[.,]\d+)?$/.test(v))) out[c[0]]=c.slice(1).map(num); return m; }); return out; }

/* видимость ребра лучом: точка ребра скрыта, если луч к наблюдателю (+y — для π₂, +z — для π₁) пересекает грань,
   не содержащую ребро (грани выпуклые, точка внутри грани — по знакам в плоскости грани) */
function hiddenAt(X,faces,view,skip){ const v=view===2?[0,1,0]:[0,0,1];
  return faces.some(f=>{ if(skip(f)) return false; const n=cross(sub(f[1],f[0]),sub(f[2],f[0])), den=dot(n,v); if(Math.abs(den)<1e-12) return false;
    const s=dot(n,sub(f[0],X))/den; if(s<=1e-6) return false; const Y=add(X,mul(v,s));
    let sg=0; for(let i=0;i<f.length;i++){ const a=f[i], b=f[(i+1)%f.length], c=dot(cross(sub(b,a),sub(Y,a)),n); if(Math.abs(c)<1e-9) return false; const t=Math.sign(c); if(sg&&t!==sg) return false; sg=t; }
    return true; }); }

/* ── проверки одного ДЗ ── */
function checkTask(id,task,out){
  const nm='ДЗ '+({'2':'2а','2b':'2б','2c':'2в','3':'3'}[id]||id), parts=PLAYER.partsOf(task), data=readData(task.data);
  const bad=(part,rule,msg)=>out.push({name:nm+(part?' '+part:''),rule,msg,lvl:'ошибка'});
  const S=SC(), q=strip(task.q);
  if(!Object.keys(data).length){ bad('','условие','нет таблицы данных'); return; }
  parts.forEach(part=>{
    const pl=strip(part.l||''), {P,lines,segs}=readScene(part), ans=strip(part.ans||task.ans||'');
    const text=(part.steps||[]).map(s=>strip([s.t,s.d,s.why,s.tbl].filter(Boolean).join(' '))).join(' ');
    const ck=(ok,rule,msg)=>{ if(!ok) bad(pl,rule,msg); return ok; };
    /* 1. условие на чертеже: каждая данная точка — точно в своих проекциях */
    Object.entries(data).forEach(([n,p])=>{ const f=P[n+'″'], h=P[n+'′'];
      if(!f||!h){ bad(pl,'условие на чертеже','нет проекций точки '+n); return; }
      ck(d2(f,F2(p))<TOL*S&&d2(h,H1(p))<TOL*S,'условие на чертеже',n+' перенесена неверно: на чертеже ('+r1(-f[0]/S)+'; '+r1(h[1]/S)+'; '+r1(-f[1]/S)+'), в таблице ('+p.join('; ')+')'); });
    /* 2. линии связи: обе проекции каждой точки на одной вертикали */
    Object.keys(P).filter(l=>l.endsWith('″')).forEach(l=>{ const h=P[l.slice(0,-1)+'′']; if(h) ck(Math.abs(h[0]-P[l][0])<TOL*S,'линия связи',l+' и '+l.slice(0,-1)+'′ не на одной линии связи ('+(Math.abs(h[0]-P[l][0])/S).toFixed(2)+' мм)'); });
    const R=n=>rec(P,n), need=(...ns)=>ns.every(n=>{ const ok=!!R(n); if(!ok) bad(pl,'чертёж','нет обеих проекций точки '+n); return ok; });
    /* число в ответе = вычисленному: «X(x; y; z)» и именованные величины */
    const coordIn=(txt,n,p,where)=>{ const re=new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\(([−\\-\\d,]+); ([−\\-\\d,]+); ([−\\-\\d,]+)\\)'), m=re.exec(txt); if(!m) return;
      const v=[1,2,3].map(i=>num(m[i])); ck(v.every((x,i)=>Math.abs(x-p[i])<0.0501),'число в тексте',where+': '+n+'('+m.slice(1).join('; ')+'), по чертежу ('+p.map(x=>r1(x)).join('; ')+')'); };
    const valIn=(txt,re,val,what,unit)=>{ const m=re.exec(txt); if(!ck(!!m,'число в тексте','в ответе нет '+what)) return; const v=num(m[1]); ck(Math.abs(v-val)<0.0501,'число в тексте',what+' в ответе '+m[1]+(unit||'')+', вычислено '+r1(val).toString().replace('.',',')+(unit||'')); };
    /* видимость рёбер многогранника на обеих проекциях */
    const visCheck=(V,faces)=>{ const F=faces.map(f=>f.map(n=>V[n])), E=new Set(); faces.forEach(f=>f.forEach((a,i)=>{ const b=f[(i+1)%f.length]; E.add([a,b].sort().join('|')); }));
      let n=0; [2,1].forEach(view=>{ const pr=view===2?F2:H1;
        E.forEach(e=>{ const [a,b]=e.split('|'), A=pr(V[a]), B=pr(V[b]); if(d2(A,B)<1) return;
          const mine=segs.filter(s=>offLine2(s.a,A,B)<TOL*S&&offLine2(s.b,A,B)<TOL*S&&/^(res|resd|main|hid)$/.test(s.k)), L=d2(A,B);
          const tt=p=>((p[0]-A[0])*(B[0]-A[0])+(p[1]-A[1])*(B[1]-A[1]))/(L*L);
          if(!ck(mine.length>0,'ребро не проведено',a+b+' на '+(view===2?'π₂':'π₁'))) return;
          /* по 9 точкам вдоль ребра: последний нарисованный поверх участок (как на экране) — того же вида, что и точная видимость */
          for(let i=1;i<=9;i++){ const t=i/10, X=add(V[a],mul(sub(V[b],V[a]),t)), cov=mine.filter(s=>{ const u=tt(s.a), w=tt(s.b); return t>=Math.min(u,w)-1e-9&&t<=Math.max(u,w)+1e-9; });
            if(!cov.length){ ck(false,'ребро не проведено целиком',a+b+' на '+(view===2?'π₂':'π₁')+' — разрыв у t = '+t.toFixed(1)); break; }
            const top=cov[cov.length-1], hid=hiddenAt(X,F,view,f=>f.includes(V[a])&&f.includes(V[b])); n++;
            if(!ck(hid===/^(resd|hid)$/.test(top.k),'видимость',a+b+' на '+(view===2?'π₂':'π₁')+' у t = '+t.toFixed(1)+': нарисовано '+(/d$|hid/.test(top.k)?'штрихом':'сплошной')+', а по лучу к наблюдателю ребро '+(hid?'закрыто':'видно'))) break; } }); });
      /* на любом шаге: штриховое ребро — только там, где готовое тело его действительно закрывает */
      (part.steps||[]).forEach((st,si)=>(st.add||[]).forEach(it=>{ if(it.t!=='seg'||!/^(resd|hid)$/.test(it.k||'')) return;
        [2,1].forEach(view=>{ const pr=view===2?F2:H1; E.forEach(e=>{ const [a,b]=e.split('|'), A=pr(V[a]), B=pr(V[b]); if(d2(A,B)<1||offLine2(it.a,A,B)>TOL*S||offLine2(it.b,A,B)>TOL*S) return;
          const L=d2(A,B), mid=[(it.a[0]+it.b[0])/2,(it.a[1]+it.b[1])/2], t=((mid[0]-A[0])*(B[0]-A[0])+(mid[1]-A[1])*(B[1]-A[1]))/(L*L); if(t<=0||t>=1) return;
          const X=add(V[a],mul(sub(V[b],V[a]),t)); ck(hiddenAt(X,F,view,f=>f.includes(V[a])&&f.includes(V[b])),'видимость','шаг '+(si+1)+': '+a+b+' на '+(view===2?'π₂':'π₁')+' нарисовано штрихом, а тело его не закрывает'); }); }); }));
      /* данные прямые (EF, AK) рядом с телом: участок за телом — штрих, остальное — сплошная (по лучу к наблюдателю) */
      const GL=Object.keys(data).filter(n=>/^[EFK]$/.test(n)); const pairs=[]; if(data.E&&data.F) pairs.push(['E','F']); if(data.A&&data.K) pairs.push(['A','K']);
      pairs.forEach(([a,b])=>[2,1].forEach(view=>{ const pr=view===2?F2:H1, A=pr(data[a]), B=pr(data[b]), L=d2(A,B); if(L<1) return;
        const on=PLAYER.scene(part,(part.steps||[]).length).items.filter(it=>it.t==='seg'&&offLine2(it.a,A,B)<TOL*S&&offLine2(it.b,A,B)<TOL*S);
        const tt=p=>((p[0]-A[0])*(B[0]-A[0])+(p[1]-A[1])*(B[1]-A[1]))/(L*L);
        for(let i=1;i<40;i++){ const t=i/40, cov=on.filter(s=>{ const u=tt(s.a), w=tt(s.b); return t>Math.min(u,w)+1e-6&&t<Math.max(u,w)-1e-6; }); if(!cov.length) continue;
          const top=cov[cov.length-1], X=add(data[a],mul(sub(data[b],data[a]),t)), hid=hiddenAt(X,F,view,()=>false);
          /* вершина тела на самой прямой (B ∈ EF) — точка не «за» телом; у грани, проходящей через прямую, луч скользит */
          if(F.some(f=>f.some(v=>dist(v,X)<0.6))) continue;
          if(!ck(hid===/^(resd|hid|auxd)$/.test(top.k||''),'видимость',a+b+' на '+(view===2?'π₂':'π₁')+' у t = '+t.toFixed(2)+': нарисовано '+(/d$|hid/.test(top.k||'')?'штрихом':top.k==='paper'?'стёрто':'сплошной')+', а по лучу прямая '+(hid?'закрыта телом':'видна'))) break; } }));
      return n; };

    /* каждое «X(x; y; z)» в тексте шагов и ответа — та точка, что на чертеже (у повёрнутых точек без второй проекции —
       по одной проекции); «точка 1 на уровне z = 20», «на глубине y = 30» — уровень этой точки */
    { const all=text+' '+ans, seen=new Set();
      all.replace(/(^|[^A-Za-zА-Яа-я₀-₉])([A-ZА-Я][₀-₉]*|\d)\((−?-?\d+(?:,\d+)?); (−?-?\d+(?:,\d+)?); (−?-?\d+(?:,\d+)?)\)/g,(m,pre,n,a,b,c)=>{ const k=n+a+b+c; if(seen.has(k)) return m; seen.add(k);
        const v=[a,b,c].map(num), f=P[n+'″'], h=P[n+'′'], idx=f&&h?[0,1,2]:h?[0,1]:f?[0,2]:[];
        if(!idx.length) return m; const p=[-(f||h)[0]/S, h?h[1]/S:NaN, f?-f[1]/S:NaN];
        ck(idx.every(i=>Math.abs(v[i]-p[i])<0.0501),'число в тексте','«'+n+'('+a+'; '+b+'; '+c+')», по чертежу ('+idx.map(i=>['x','y','z'][i]+' = '+r1(p[i]).toString().replace('.',',')).join('; ')+')'); return m; });
      all.replace(/точк[еуаи] (\d+|[A-ZА-Я][₀-₉]*) на [A-Z]{2} \((z|y) = (−?-?\d+(?:,\d+)?)\)/g,(m,n,w,v)=>{ const p=R(n); if(!p) return m; const i=w==='z'?2:1;
        ck(Math.abs(num(v)-p[i])<0.0501,'число в тексте','«точка '+n+' ('+w+' = '+v+')», по чертежу '+r1(p[i]).toString().replace('.',',')); return m; });
      all.replace(/точк[уаи] (\d+|[A-ZА-Я][₀-₉]*) на (уровне z|глубине y) = (−?-?\d+(?:,\d+)?)/g,(m,n,w,v)=>{ const p=R(n); if(!p) return m; const i=w[0]==='у'?2:1;
        ck(Math.abs(num(v)-p[i])<0.0501,'число в тексте','«точка '+n+' на '+w+' = '+v+'», по чертежу '+r1(p[i]).toString().replace('.',',')); return m; }); }

    ck(!/NaN|Infinity|undefined/.test(text+' '+ans),'число в тексте','в тексте «NaN»/«undefined» — величина не посчитана');
    /* «|XY| = v мм»: X, Y — точки чертежа одного вида (A₄B₄) — расстояние на чертеже; точки с обеими проекциями — в пространстве */
    (text+' '+ans).replace(/\|([A-ZА-Я][₀-₉]*)([A-ZА-Я][₀-₉]*)\| = (\d+(?:,\d+)?) мм/g,(m,a,b,v)=>{ let d=null;
      if(P[a]&&P[b]) d=d2(P[a],P[b])/S; else if(R(a)&&R(b)) d=dist(R(a),R(b)); else if(data[a]&&data[b]) d=dist(data[a],data[b]);
      if(d!=null) ck(Math.abs(num(v)-d)<0.0501,'число в тексте','«|'+a+b+'| = '+v+' мм», по чертежу '+r1(d).toString().replace('.',',')); return m; });
    /* координаты элементов — числа; дуга окружности (ломаная на одной окружности) начинается и кончается в построенных точках */
    { const pts=Object.values(P), items=PLAYER.scene(part,(part.steps||[]).length).items;
      items.forEach(it=>{ const cs=[it.at,it.a,it.b,...(it.t==='poly'?it.p||[]:[])].filter(Boolean);
        if(cs.some(q=>!Number.isFinite(q[0])||!Number.isFinite(q[1]))) ck(false,'чертёж','у элемента «'+it.t+(it.l?' '+strip(it.l):'')+'» координата не число'); });
      items.filter(it=>it.t==='poly'&&!it.close&&(it.p||[]).length>=8&&it.p.every(q=>Number.isFinite(q[0])&&Number.isFinite(q[1]))).forEach(it=>{
        const a=it.p[0], m=it.p[it.p.length>>1], b=it.p[it.p.length-1], D=2*(a[0]*(m[1]-b[1])+m[0]*(b[1]-a[1])+b[0]*(a[1]-m[1])); if(Math.abs(D)<1e-6) return;
        const sq=q=>q[0]*q[0]+q[1]*q[1], o=[(sq(a)*(m[1]-b[1])+sq(m)*(b[1]-a[1])+sq(b)*(a[1]-m[1]))/D,(sq(a)*(b[0]-m[0])+sq(m)*(a[0]-b[0])+sq(b)*(m[0]-a[0]))/D], r=d2(o,a);
        if(!it.p.every(q=>Math.abs(d2(o,q)-r)<1e-3*Math.max(1,r))) return;
        const at=q=>pts.some(x=>d2(x,q)<TOL*S);
        ck(at(a)&&at(b),'дуга','дуга радиуса '+r1(r/S).toString().replace('.',',')+' мм не '+(at(a)?'кончается':'начинается')+' в построенной точке'); }); }
    /* штриховая — только невидимое: рёбра тела и данные прямые; у точки не бывает «штрихового» вида */
    { const items=PLAYER.scene(part,(part.steps||[]).length).items;
      items.forEach(it=>{ if((it.t==='pt'||it.t==='sq'||it.t==='ang')&&/d$/.test(it.k||'')) ck(false,'вид линии',(it.t==='pt'?'точка '+strip(it.l):it.t==='sq'?'знак прямого угла':'знак угла')+' нарисован(а) как штриховая ('+it.k+')'); });
      const solid=id!=='3';
      items.filter(it=>it.t==='seg'&&/^(resd|hid|auxd|grnd)$/.test(it.k||'')).forEach(it=>{
        const onGiven=Object.keys(data).some(a=>Object.keys(data).some(b=>a<b&&[[F2,2],[H1,1]].some(([pr])=>offLine2(it.a,pr(data[a]),pr(data[b]))<TOL*S&&offLine2(it.b,pr(data[a]),pr(data[b]))<TOL*S)));
        const VN={'2':['S','A','B','C'],'2b':['A','B','C','A₁','B₁','C₁'],'2c':['A','B','C','D','A₁','B₁','C₁','D₁']}[id]||[];
        const onSolid=solid&&['″','′'].some(mk=>VN.some(a=>VN.some(b=>{ const pa=P[a+mk], pb=P[b+mk]; return a<b&&pa&&pb&&d2(pa,pb)>1&&offLine2(it.a,pa,pb)<TOL*S&&offLine2(it.b,pa,pb)<TOL*S; })));
        ck(onGiven||onSolid,'вид линии','штриховой отрезок там, где закрывать нечему (не ребро тела и не данная прямая)'); }); }

    if(id==='2'){ const Hh=num((/высота равна (\d+(?:,\d+)?) мм/.exec(q)||[])[1]);
      if(!need('S','N','D','1','2','3','4')) return;
      const {A,B,C,E}=data, Fp=data.F, Sx=R('S'), N=R('N'), D=R('D');
      ck(offLine3(Sx,E,Fp)<TOL,'условие задачи','S не на прямой EF: '+offLine3(Sx,E,Fp).toFixed(3)+' мм');
      ck(Math.abs(planeDist(Sx,A,B,C)-Hh)<TOL,'условие задачи','высота пирамиды '+planeDist(Sx,A,B,C).toFixed(3)+' мм, по условию '+Hh);
      const nA=cross(sub(B,A),sub(C,A));
      ck(len(cross(sub(N,A),nA))/len(sub(N,A))/len(nA)<1e-6,'метод','AN не перпендикулярна плоскости ABC');
      ck(Math.abs(dist(A,N)-Hh)<TOL,'метод','|AN| = '+dist(A,N).toFixed(3)+' мм, должно быть '+Hh);
      ck(offLine3(D,A,N)<TOL,'метод','D не на перпендикуляре n');
      /* 1 — на горизонтали плоскости через вершину, 2 — на фронтали: в плоскости ABC, на уровне (глубине) вершины */
      const P1=R('1'), P2=R('2');
      ck(planeDist(P1,A,B,C)<TOL&&[A,B,C].some(v=>Math.abs(v[2]-P1[2])<TOL&&dist(v,P1)>1),'метод','точка 1 — не конец горизонтали плоскости ABC');
      ck(planeDist(P2,A,B,C)<TOL&&[A,B,C].some(v=>Math.abs(v[1]-P2[1])<TOL&&dist(v,P2)>1),'метод','точка 2 — не конец фронтали плоскости ABC');
      /* 3 = γ ∩ h_β, 4 = γ ∩ f_β: в плоскости β (на расстоянии Hh от ABC, по ту же сторону, что N), 3 — на уровне N, 4 — на глубине N, обе — в γ (3′, 4′ на E′F′) */
      const P3=R('3'), P4=R('4'), side=p=>Math.sign(dot(sub(p,A),nA));
      [[P3,'3',2],[P4,'4',1]].forEach(([p,l,ax])=>{ ck(Math.abs(planeDist(p,A,B,C)-Hh)<TOL&&side(p)===side(N),'метод','точка '+l+' не в плоскости β ∥ ABC');
        ck(Math.abs(p[ax]-N[ax])<TOL,'метод','точка '+l+' не на '+(ax===2?'горизонтали':'фронтали')+' плоскости β через N');
        ck(offLine2(H1(p),H1(E),H1(Fp))<TOL*S,'метод',l+'′ не на E′F′ (не в посреднике γ)'); });
      ck(offLine2(F2(Sx),F2(P3),F2(P4))<TOL*S,'метод','S″ не на ℓ″ = 3″4″');
      const tS=dot(sub(Sx,E),sub(Fp,E))/dot(sub(Fp,E),sub(Fp,E));
      if(/на отрезке EF/.test(ans)) ck(tS>=-1e-9&&tS<=1+1e-9,'утверждение в ответе','«на отрезке EF», а S за его пределами (t = '+tS.toFixed(2)+')');
      coordIn(ans,'S',Sx,'ответ'); valIn(ans,/Высота = (\d+(?:,\d+)?) мм/,planeDist(Sx,A,B,C),'высота',' мм');
      /* второе решение S₂ — на EF по другую сторону ABC: d(S₂, ABC) = Hh, считаем заново */
      { const u=nA.map(v=>v/len(nA)), dE=sub(Fp,E), tOf=h=>(h-dot(u,sub(E,A)))/dot(u,dE), S2=add(E,mul(dE,tOf(dot(sub(Sx,A),u)>0?-Hh:Hh)));
        coordIn(text+' '+ans,'S₂',S2,'шаг'); }
      visCheck({S:Sx,A,B,C},[['A','B','C'],['S','A','B'],['S','B','C'],['S','C','A']]);
      coordIn(text,'N',N,'шаг'); coordIn(text,'S',Sx,'шаг'); coordIn(text,'3',P3,'шаг'); coordIn(text,'4',P4,'шаг'); coordIn(text,'1',P1,'шаг'); coordIn(text,'2',P2,'шаг'); }

    if(id==='2b'){ const Hh=num((/высота равна (\d+(?:,\d+)?) мм/.exec(q)||[])[1]);
      if(!need('A','A₁','B₁','C₁','K','1','2','D')) return;
      const {B,C,E}=data, Fp=data.F, A=R('A'), A1=R('A₁'), B1=R('B₁'), C1=R('C₁'), K=R('K'), D=R('D'), h=sub(A1,A);
      ck(offLine3(A,E,Fp)<TOL,'условие задачи','A не на прямой EF');
      ck(Math.abs(dist(A,B)-dist(A,C))<TOL,'условие задачи','AB = '+dist(A,B).toFixed(3)+', AC = '+dist(A,C).toFixed(3)+' — треугольник не равнобедренный');
      const nA=cross(sub(B,A),sub(C,A));
      ck(len(cross(h,nA))/len(h)/len(nA)<1e-6,'условие задачи','боковое ребро AA₁ не перпендикулярно основанию (призма не прямая)');
      ck(Math.abs(len(h)-Hh)<TOL,'условие задачи','высота '+len(h).toFixed(3)+' мм, по условию '+Hh);
      ck(dist(B1,add(B,h))<TOL&&dist(C1,add(C,h))<TOL,'условие задачи','второе основание не получено сдвигом на AA₁');
      ck(dist(K,mul(add(B,C),0.5))<TOL,'метод','K — не середина BC');
      [['1',R('1')],['2',R('2')]].forEach(([l,p])=>{ ck(Math.abs(dot(sub(p,K),sub(C,B)))/len(sub(C,B))<TOL,'метод','точка '+l+' не в плоскости μ ⟂ BC через K');
        ck(offLine2(H1(p),H1(E),H1(Fp))<TOL*S,'метод',l+'′ не на E′F′ (не в посреднике γ)'); });
      ck(offLine2(F2(A),F2(R('1')),F2(R('2')))<TOL*S,'метод','A″ не на ℓ″ = 1″2″');
      ck(offLine3(D,A,A1)<TOL,'метод','D не на перпендикуляре n');
      coordIn(ans,'A',A,'ответ'); coordIn(ans,'A₁',A1,'ответ'); coordIn(ans,'B₁',B1,'ответ'); coordIn(ans,'C₁',C1,'ответ');
      valIn(ans,/AB = AC = (\d+(?:,\d+)?) мм/,dist(A,B),'AB = AC',' мм');
      visCheck({A,B,C,'A₁':A1,'B₁':B1,'C₁':C1},[['A','B','C'],['A₁','B₁','C₁'],['A','B','B₁','A₁'],['B','C','C₁','B₁'],['C','A','A₁','C₁']]);
      coordIn(text,'K',K,'шаг'); coordIn(text,'A',A,'шаг'); coordIn(text,'A₁',A1,'шаг'); }

    if(id==='2c'){
      if(!need('B','C','D','A₁','B₁','C₁','D₁','1','2')) return;
      const {A,K,E}=data, Fp=data.F, B=R('B'), C=R('C'), D=R('D'), A1=R('A₁'), B1=R('B₁'), C1=R('C₁'), D1=R('D₁'), a=dist(A,B), h=sub(A1,A);
      ck(offLine3(B,E,Fp)<TOL,'условие задачи','B не на прямой EF');
      ck(offLine3(D,A,K)<TOL&&dot(sub(D,A),sub(K,A))>0,'условие задачи','D не на луче AK');
      ck(Math.abs(angle(sub(B,A),sub(D,A))-90)<TOLD,'условие задачи','∠BAD = '+angle(sub(B,A),sub(D,A)).toFixed(3)+'°');
      ck(Math.abs(dist(A,D)-a)<TOL,'условие задачи','|AD| = '+dist(A,D).toFixed(3)+' ≠ |AB| = '+a.toFixed(3));
      ck(dist(C,add(B,sub(D,A)))<TOL,'условие задачи','C — не четвёртая вершина квадрата ABCD');
      ck(Math.abs(angle(h,sub(B,A))-90)<TOLD&&Math.abs(angle(h,sub(D,A))-90)<TOLD,'условие задачи','AA₁ не перпендикулярно грани ABCD');
      ck(Math.abs(len(h)-a)<TOL,'условие задачи','|AA₁| = '+len(h).toFixed(3)+' ≠ a = '+a.toFixed(3));
      ck([[B1,B],[C1,C],[D1,D]].every(([x,y])=>dist(x,add(y,h))<TOL),'условие задачи','верхняя грань не получена сдвигом на AA₁');
      [['1',R('1')],['2',R('2')]].forEach(([l,p])=>{ ck(Math.abs(dot(sub(p,A),sub(K,A)))/len(sub(K,A))<TOL,'метод','точка '+l+' не в плоскости μ ⟂ AK через A');
        ck(offLine2(H1(p),H1(E),H1(Fp))<TOL*S,'метод',l+'′ не на E′F′ (не в посреднике γ)'); });
      ck(offLine2(F2(B),F2(R('1')),F2(R('2')))<TOL*S,'метод','B″ не на ℓ″ = 1″2″');
      coordIn(ans,'B',B,'ответ'); coordIn(ans,'D',D,'ответ'); coordIn(ans,'C',C,'ответ'); coordIn(ans,'A₁',A1,'ответ');
      valIn(ans,/a = (\d+(?:,\d+)?) мм/,a,'ребро a',' мм');
      visCheck({A,B,C,D,'A₁':A1,'B₁':B1,'C₁':C1,'D₁':D1},[['A','B','C','D'],['A₁','B₁','C₁','D₁'],['A','B','B₁','A₁'],['B','C','C₁','B₁'],['C','D','D₁','C₁'],['D','A','A₁','D₁']]); }

    if(id==='3'){ const {A,B,C}=data, Sv=data.S, Hn=planeDist(Sv,A,B,C), nA=cross(sub(B,A),sub(C,A));
      /* новая ось — прямая с подписью; проекция на неё и расстояние до неё (ед. чертежа) */
      const ax=l=>{ const s=(lines[l]||[])[0]; return s?{a:s[0],b:s[1],d:p=>offLine2(p,s[0],s[1]),u:(()=>{ const v=sub(s[1],s[0]), L=len(v); return [v[0]/L,v[1]/L]; })()}:null; };
      /* замена плоскостей: X_new на линии связи ⟂ новой оси, на расстоянии keep от неё; X_old и X_new — по разные стороны оси */
      const xfer=(X0,X1,axis,keep,lab)=>{ if(!X0||!X1) return ck(false,'замена плоскостей','нет точки '+lab);
        const v=sub(X1,X0); ck(Math.abs(v[0]*axis.u[0]+v[1]*axis.u[1])<TOL*S,'замена плоскостей',lab+': линия связи не перпендикулярна новой оси');
        /* расстояние со знаком: «+» — по другую сторону оси от старой проекции (точка над плоскостью), «−» — по ту же */
        const sg=p=>Math.sign((p[0]-axis.a[0])*(axis.b[1]-axis.a[1])-(p[1]-axis.a[1])*(axis.b[0]-axis.a[0])), sd=axis.d(X1)*(sg(X1)===sg(X0)?-1:1);
        ck(Math.abs(sd-keep)<TOL*S,'замена плоскостей',lab+': до новой оси '+(sd/S).toFixed(2)+' мм, должно быть '+(keep/S).toFixed(2)+' мм (сохраняемая координата)'); };
      if(/высота/.test(pl)){ const x14=ax('x₁₄'); if(!ck(!!x14,'замена плоскостей','нет оси x₁₄')) return;
        const Dd=R('D'); ck(Dd&&Math.abs(Dd[2]-A[2])<TOL&&offLine3(Dd,B,C)<TOL,'метод','D — не точка BC на уровне A (AD — не горизонталь)');
        ck(Math.abs(dot([x14.u[0],x14.u[1]],sub(P['D′'],P['A′']))/d2(P['D′'],P['A′']))<1e-6,'замена плоскостей','x₁₄ не перпендикулярна A′D′');
        ['A','B','C','S'].forEach(n=>xfer(P[n+'′'],P[n+'₄'],x14,(n==='S'?Sv:data[n])[2]*S,n+'₄'));
        ck(offLine2(P['C₄'],P['A₄'],P['B₄'])<TOL*S,'замена плоскостей','A₄, B₄, C₄ не на одной прямой — плоскость не стала проецирующей');
        const Hd=offLine2(P['S₄'],P['A₄'],P['B₄'])/S; ck(Math.abs(Hd-Hn)<TOL,'ответ','высота на π₄ '+Hd.toFixed(3)+' мм, расстояние S до ABC '+Hn.toFixed(3));
        valIn(ans,/H = (\d+(?:,\d+)?) мм/,Hn,'высота H',' мм'); valIn(text,/H = (\d+(?:,\d+)?) мм/,Hn,'высота H в шаге',' мм'); }
      if(/угол SAB/.test(pl)){ const x14=ax('x₁₄'), x45=ax('x₄₅'); if(!ck(!!x14&&!!x45,'замена плоскостей','нет осей x₁₄, x₄₅')) return;
        ck(Math.abs(x14.u[0]*(P['B′'][1]-P['A′'][1])-x14.u[1]*(P['B′'][0]-P['A′'][0]))/d2(P['A′'],P['B′'])<1e-6,'замена плоскостей','x₁₄ не параллельна A′B′');
        ['A','B','C','S'].forEach(n=>xfer(P[n+'′'],P[n+'₄'],x14,(n==='S'?Sv:data[n])[2]*S,n+'₄'));
        ck(Math.abs(d2(P['A₄'],P['B₄'])/S-dist(A,B))<TOL,'замена плоскостей','A₄B₄ ≠ |AB|');
        ck(Math.abs(dot([x45.u[0],x45.u[1]],sub(P['B₄'],P['A₄']))/d2(P['A₄'],P['B₄']))<1e-6,'замена плоскостей','x₄₅ не перпендикулярна A₄B₄');
        const sg14=p=>Math.sign((p[0]-x14.a[0])*(x14.b[1]-x14.a[1])-(p[1]-x14.a[1])*(x14.b[0]-x14.a[0]));
        ['A','C','S'].forEach(n=>xfer(P[n+'₄'],P[n+'₅'],x45,x14.d(P[n+'′'])*(sg14(P[n+'′'])===sg14(P['C′'])?1:-1),n+'₅'));
        const ab=sub(B,A), pr=p=>{ const w=sub(p,A); return sub(w,mul(ab,dot(w,ab)/dot(ab,ab))); }, dih=angle(pr(C),pr(Sv));
        const dd=deg(Math.acos(Math.max(-1,Math.min(1,dot(sub(P['C₅'],P['A₅']),sub(P['S₅'],P['A₅']))/d2(P['C₅'],P['A₅'])/d2(P['S₅'],P['A₅'])))));
        ck(Math.abs(dd-dih)<TOLD,'ответ','угол на π₅ '+dd.toFixed(3)+'°, двугранный угол '+dih.toFixed(3)+'°');
        valIn(ans,/AB: (\d+(?:,\d+)?)°/,dih,'двугранный угол','°'); }
      if(/истинный вид/.test(pl)){ if(!need('D','O₁','B₁','C₁')) return;
        const Dd=R('D'); ck(Math.abs(Dd[2]-A[2])<TOL&&offLine3(Dd,B,C)<TOL,'метод','D — не точка BC на уровне A');
        const Ah=P['A′'], Dh=P['D′'], O=P['O₁′'], Bh=P['B′'], B0=P['B₁′'], C0=P['C₁′'], hdir=sub(Dh,Ah);
        ck(offLine2(O,Ah,Dh)<TOL*S,'вращение','O₁′ не на оси A′D′');
        ck(Math.abs(dot(sub(Bh,O),hdir))/d2(Bh,O)/len(hdir)<1e-6,'вращение','след плоскости вращения B не ⟂ A′D′');
        ck(offLine2(B0,O,Bh)<TOL*S,'вращение','B₁′ не на следе плоскости вращения');
        const Rr=Math.hypot(d2(O,Bh),(B[2]-A[2])*S); ck(Math.abs(d2(O,B0)-Rr)<TOL*S,'вращение','|O₁′B₁′| ≠ R = √(|O₁′B′|² + Δz²)');
        if(P['B̄']) ck(Math.abs(d2(P['B̄'],Bh)-Math.abs(B[2]-A[2])*S)<TOL*S&&Math.abs(dot(sub(P['B̄'],Bh),sub(Bh,O)))/d2(P['B̄'],Bh)/d2(Bh,O)<1e-6,'вращение','катет B′B̄ — не Δz = |z_B − z_A| ⟂ O₁′B′');
        ck(Math.abs(P['B₁″'][1]-P['A″'][1])<TOL*S&&Math.abs(P['C₁″'][1]-P['A″'][1])<TOL*S,'вращение','B₁″, C₁″ не на уровне оси вращения');
        ck(offLine2(C0,B0,Dh)<TOL*S,'вращение','C₁′ не на прямой B₁′D′');
        ck(Math.abs(dot(sub(C0,P['C′']),hdir))/Math.max(1e-9,d2(C0,P['C′']))/len(hdir)<1e-6,'вращение','C₁′ не на следе плоскости вращения C');
        [[Ah,B0,dist(A,B),'AB'],[B0,C0,dist(B,C),'BC'],[C0,Ah,dist(C,A),'CA']].forEach(([p,s,v,l])=>ck(Math.abs(d2(p,s)/S-v)<TOL,'ответ','сторона '+l+' истинного вида '+(d2(p,s)/S).toFixed(3)+' мм, вычислено '+v.toFixed(3)));
        valIn(ans,/AB = (\d+(?:,\d+)?)/,dist(A,B),'AB',''); valIn(ans,/BC = (\d+(?:,\d+)?)/,dist(B,C),'BC',''); valIn(ans,/CA = (\d+(?:,\d+)?)/,dist(C,A),'CA',''); }
      if(/угол SA с/.test(pl)){ if(!need('D','E','T','O₃')) return;
        const Ee=R('E'), T=R('T'); ck(Math.abs(Ee[1]-B[1])<TOL&&offLine3(Ee,A,C)<TOL,'метод','E — не точка AC на глубине B (BE — не фронталь)');
        ck(len(cross(sub(T,Sv),nA))/dist(T,Sv)/len(nA)<1e-6,'метод','T не на перпендикуляре из S к ABC');
        ck(Math.abs(T[2]-A[2])<TOL,'метод','T не на уровне A (AT — не горизонталь)');
        const Ah=P['A′'], Th=P['T′'], O=P['O₃′'], Sh=P['S′'], S0=P['S₁′'];
        ck(offLine2(O,Ah,Th)<TOL*S&&Math.abs(dot(sub(Sh,O),sub(Th,Ah)))/d2(Sh,O)/d2(Th,Ah)<1e-6,'вращение','O₃′ — не центр вращения S вокруг A′T′');
        ck(offLine2(S0,O,Sh)<TOL*S,'вращение','S₁′ не на следе плоскости вращения');
        if(P['S̄']) ck(Math.abs(d2(P['S̄'],Sh)-Math.abs(Sv[2]-A[2])*S)<TOL*S&&Math.abs(dot(sub(P['S̄'],Sh),sub(Sh,O)))/d2(P['S̄'],Sh)/d2(Sh,O)<1e-6,'вращение','катет S′S̄ — не Δz = |z_S − z_A| ⟂ O₃′S′');
        ck(Math.abs(d2(Ah,S0)/S-dist(A,Sv))<TOL&&Math.abs(d2(Th,S0)/S-dist(T,Sv))<TOL,'вращение','треугольник A′S₁′T′ — не истинный вид AST');
        const phi=deg(Math.asin(Hn/dist(Sv,A))), psi=angle(sub(A,Sv),sub(T,Sv));
        ck(Math.abs(phi-(90-psi))<TOLD,'ответ','φ ≠ 90° − ψ');
        valIn(ans,/φ = (\d+(?:,\d+)?)°/,phi,'угол φ','°'); valIn(ans,/ψ = (\d+(?:,\d+)?)°/,psi,'угол ψ','°');
        const ZS=Sv[2]-A[2]; const m=/Δz = (\d+(?:,\d+)?) − (\d+(?:,\d+)?) = (\d+(?:,\d+)?) мм/.exec(text);
        if(m) ck(Math.abs(num(m[1])-Sv[2])<0.051&&Math.abs(num(m[2])-A[2])<0.051&&Math.abs(num(m[3])-ZS)<0.051,'число в тексте','в шаге «Δz = '+m[1]+' − '+m[2]+' = '+m[3]+' мм», по данным z_S − z_A = '+Sv[2]+' − '+A[2]+' = '+ZS); }
    }
  });
}

window.DZ_IDS=['2','2b','2c','3'];
window.DZ_CHECK=function(opts){ opts=opts||{}; const out=[], get=opts.get||(id=>NGHW.get(id));
  DZ_IDS.forEach(id=>{ let d; try{ d=get(id); }catch(e){ out.push({name:'ДЗ '+id,rule:'сбой',msg:String(e),lvl:'ошибка'}); return; }
    if(!d||!d.task){ out.push({name:'ДЗ '+id,rule:'нет разбора',msg:'',lvl:'ошибка'}); return; }
    try{ checkTask(id,d.task,out); }catch(e){ out.push({name:'ДЗ '+id,rule:'сбой проверки',msg:String(e&&e.stack||e).slice(0,300),lvl:'ошибка'}); } });
  return out; };
})();
