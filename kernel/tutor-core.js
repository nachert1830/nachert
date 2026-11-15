/* ═══ TUTORCORE — геометрическое ядро ИИ-наставника (docs/TUTOR.md) ═══
   Один и тот же код работает в браузере (window.TUTORCORE) и на сервере (require('../../kernel/tutor-core.js')).
   Правило наставника: модель говорит, ядро решает, чертёж показывает. Всё, что наставник утверждает о геометрии,
   проверяет этот файл по чертежу, который вычислил решатель задачи:
     build(part, k, o)   — снимок шага: точки, линии, группы построения (посредники по цвету), текст шага → модель M (JSON)
     facts(M)            — что видит модель-наставник: шаг, подсказки, кто на чём лежит (без координат)
     verify(M, claim)    — проверка одного утверждения о чертеже: {ok: true|false|null, why}
     reply(M, r)         — проверка ответа модели целиком: утверждения, подписи в тексте, действия на чертеже
     ladder(M, level)    — лестница подсказок без модели и без сети: намёк → принцип → показ → 3D → весь шаг
     tapCheck(M, id, xy) — «Решаю сам»: студент отметил на чертеже, где будет точка; ядро говорит, что не так и где
   Координаты — в единицах чертежа (как в DRAW): x вправо, y вниз; ось x эпюра — y = 0, π₂ выше оси, π₁ ниже. */
(function(root,make){ const M=make(); if(typeof module==='object'&&module.exports) module.exports=M; else root.TUTORCORE=M; })(typeof self!=='undefined'?self:this,function(){
'use strict';
const strip=s=>String(s==null?'':s).replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const R2=v=>Math.round(v*100)/100;
const MARKS=/[′″‴]$/;
/* подпись точки «3″≡4″» — две точки в одном месте (конкурирующие) */
const names=l=>strip(l).split(/\s*[≡=]\s*/).map(x=>x.trim()).filter(Boolean);
const base=n=>String(n).replace(MARKS,'');
const isPlane=l=>/^[ΣΦΓΔΘΛΩΠTα-ω][₀-₉0-9]*(′|″)?$/.test(l)&&!/^[a-z]/.test(l);

/* ───── геометрия на плоскости ───── */
const dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
function dSeg(q,a,b){ const dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy; let t=L<1e-12?0:((q[0]-a[0])*dx+(q[1]-a[1])*dy)/L; t=Math.max(0,Math.min(1,t)); return Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy); }
function dPoly(q,p,close){ let d=Infinity; for(let i=1;i<p.length;i++) d=Math.min(d,dSeg(q,p[i-1],p[i])); if(close&&p.length>2) d=Math.min(d,dSeg(q,p[p.length-1],p[0])); return p.length===1?dist(q,p[0]):d; }
function dGeo(q,g){ if(!g) return Infinity; if(g.s) return dSeg(q,g.s[0],g.s[1]); if(g.p) return dPoly(q,g.p,g.z); if(g.c) return Math.abs(dist(q,g.c)-g.r); return Infinity; }
const dirOf=g=>g&&g.s?[g.s[1][0]-g.s[0][0],g.s[1][1]-g.s[0][1]]:null;
const ang=(u,v)=>{ const a=Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]); return Math.abs(a*180/Math.PI); };
function samp(p,n){ if(p.length<=n) return p.map(q=>[R2(q[0]),R2(q[1])]); const out=[]; for(let i=0;i<n;i++) out.push(p[Math.round(i*(p.length-1)/(n-1))]); return out.map(q=>[R2(q[0]),R2(q[1])]); }
const arcPts=(c,r,a1,a2)=>{ const o=[]; let A=a1, B=a2; if(B<A) B+=360; for(let i=0;i<=24;i++){ const t=(A+(B-A)*i/24)*Math.PI/180; o.push([c[0]+r*Math.cos(t),c[1]-r*Math.sin(t)]); } return o; };
const ellPts=(it)=>{ const o=[], rot=(it.rot||0)*Math.PI/180, A=it.a1===undefined?0:it.a1, B=it.a1===undefined?360:it.a2;
  for(let i=0;i<=36;i++){ const t=(A+(B-A)*i/36)*Math.PI/180, x=it.rx*Math.cos(t), y=it.ry*Math.sin(t); o.push([it.c[0]+x*Math.cos(rot)-y*Math.sin(rot),it.c[1]-(x*Math.sin(rot)+y*Math.cos(rot))]); } return o; };
/* элемент чертежа → геометрия для проверок */
function geoOf(it){ if(!it) return null; const ok=q=>Array.isArray(q)&&isFinite(q[0])&&isFinite(q[1]);
  if(/^(seg|line|conn|hconn|ext|vec|dim|ln)$/.test(it.t)&&ok(it.a)&&ok(it.b)) return {s:[[R2(it.a[0]),R2(it.a[1])],[R2(it.b[0]),R2(it.b[1])]]};
  if(/^(poly|curve|crv)$/.test(it.t)&&Array.isArray(it.p)&&it.p.length&&it.p.every(ok)) return {p:samp(it.p,90),z:!!it.close};
  if(it.t==='circ'&&ok(it.c)&&isFinite(it.r)) return {c:[R2(it.c[0]),R2(it.c[1])],r:R2(it.r)};
  if(it.t==='arc'&&ok(it.c)&&isFinite(it.r)) return {p:samp(arcPts(it.c,it.r,it.a1||0,it.a2==null?360:it.a2),24)};
  if(it.t==='ell'&&ok(it.c)&&isFinite(it.rx)&&isFinite(it.ry)) return {p:samp(ellPts(it),37),z:it.a1===undefined};
  return null; }
const KIND={conn:'линии связи',hconn:'линии связи',ext:'выносные линии',dim:'размер'};
const kindName=it=>KIND[it.t]||(it.k==='res'||it.k==='resd'?'результат':it.k==='hid'?'невидимые линии':it.k==='main'?'обводка':'построения');

/* ───── снимок шага ─────
   part — пункт задачи в формате плеера ({given, steps:[{t,d,why,lad,add}]}), k — номер шага (0 — «Дано»),
   o: {title, q, mode:'watch'|'try', hidden: шаг k ещё не показан (Решаю сам), has3d, n (номер задачи), pi, label}
   → M: всё, что нужно проверкам, — числа и строки, без ссылок на объекты (уходит на сервер как есть).
   Элементы M.items[i] совпадают по номеру с элементами сцены, которую рисует плеер: по ним шторка рисует подсветку. */
function build(part,k,o){ o=o||{}; const st=part.steps||[], n=st.length; k=Math.max(0,Math.min(n,k|0));
  const items=[]; const push=(it,s)=>{ if(!it||typeof it!=='object') return; items.push({it,s}); };
  (part.given||[]).forEach(it=>push(it,0)); st.forEach((s,i)=>(s.add||[]).forEach(it=>push(it,i+1)));
  const M={v:1,n:o.n==null?'':String(o.n),title:strip(o.title||''),q:strip(o.q||'').slice(0,600),mode:o.mode==='try'?'try':'watch',hidden:!!o.hidden,has3d:!!o.has3d,
    k,steps:st.map(s=>strip(s.t).slice(0,90)),step:null,pts:{},lines:{},groups:{},items:[],ans:k===n?strip(part.ans).slice(0,400):''};
  const lad=k>0?(st[k-1].lad||{}):{};
  if(k>0){ const s=st[k-1]; M.step={t:strip(s.t),text:strip(s.d||lad.step||'').slice(0,900),why:strip(s.why||lad.principle||'').slice(0,700),
    hint:strip(lad.hint||'').slice(0,300),check:strip(lad.check||'').slice(0,300),full:strip(lad.full||'').slice(0,1200)}; }
  /* группы построения шага: свой цвет (посредник и всё, что от него) или род линий */
  items.forEach((x,i)=>{ const it=x.it, s=x.s; if(s>k) { M.items.push(null); return; }
    if(/^(axis|axis3|mesh3|txt|note|hatch|paper|sq|tick|ang)$/.test(it.t)||it.k==='ghost'){ M.items.push({s,skip:1}); return; }
    const g=geoOf(it), col=it.col||'', gk=s>0?'g'+s+':'+(col||kindName(it)):'';
    const rec={s,t:it.t,k:it.k||'',col,grp:gk,geo:g}; M.items.push(rec);
    if(gk){ const G=M.groups[gk]||(M.groups[gk]={id:gk,s,col,kind:col?'посредник':kindName(it),name:'',items:[],labels:[]}); G.items.push(i); }
    if(it.t==='pt'&&it.at&&it.l) names(it.l).forEach(nm=>{ rec.l=strip(it.l); const P=M.pts[nm]; if(!P||P.s<=s) M.pts[nm]={id:nm,xy:[R2(it.at[0]),R2(it.at[1])],s,k:it.k||'',grp:gk,item:i}; if(gk) M.groups[gk].labels.push(nm); });
    else if(it.l&&g){ const l=strip(it.l); rec.l=l; if(l&&l.length<=14){ const L=M.lines[l]||(M.lines[l]={id:l,s,k:it.k||'',grp:gk,items:[]}); L.items.push(i); L.geo=g; L.s=Math.min(L.s,s); if(gk) M.groups[gk].labels.push(l); } } });
  /* имя группы: плоскость-посредник (Σ₁, Φ′) или подписи внутри */
  const cnt={}; Object.values(M.groups).forEach(G=>{ const pl=G.labels.find(l=>isPlane(base(l))); cnt[G.s]=(cnt[G.s]||0)+(G.col?1:0);
    G.name=pl?'посредник '+base(pl):G.col?'посредник '+cnt[G.s]:G.kind; G.labels=[...new Set(G.labels)].slice(0,12); });
  const tol=(()=>{ let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity; const put=q=>{ x0=Math.min(x0,q[0]); x1=Math.max(x1,q[0]); y0=Math.min(y0,q[1]); y1=Math.max(y1,q[1]); };
    M.items.forEach(r=>{ if(!r||!r.geo) return; const g=r.geo; if(g.s) g.s.forEach(put); if(g.p) g.p.forEach(put); if(g.c){ put([g.c[0]-g.r,g.c[1]-g.r]); put([g.c[0]+g.r,g.c[1]+g.r]); } });
    Object.values(M.pts).forEach(p=>put(p.xy)); const D=isFinite(x0)?Math.hypot(x1-x0,y1-y0):100; M.box=[R2(x0),R2(y0),R2(x1),R2(y1)]; return Math.max(0.9,Math.min(3,D*0.006)); })();
  M.tol=R2(tol);
  /* какие подписанные точки дал посредник: лежат на его линиях */
  Object.values(M.groups).forEach(G=>{ if(!G.col) return; G.hits=Object.values(M.pts).filter(p=>p.s>=G.s&&p.s<=k&&G.items.some(i=>{ const r=M.items[i]; return r&&r.geo&&r.t!=='pt'&&dGeo(p.xy,r.geo)<=M.tol; })).map(p=>p.id).slice(0,8); });
  return M; }

/* ───── отношения, вычисленные ядром ───── */
function ptsOn(M,i){ const r=M.items[i]; if(!r||!r.geo) return []; return Object.values(M.pts).filter(p=>p.item!==i&&dGeo(p.xy,r.geo)<=M.tol).map(p=>p.id); }
/* на каких подписанных линиях и группах лежит точка */
function onWhat(M,nm){ const P=M.pts[nm]; if(!P) return []; const out=[];
  Object.values(M.lines).forEach(L=>{ if(L.geo&&dGeo(P.xy,L.geo)<=M.tol) out.push(L.id); });
  Object.values(M.groups).forEach(G=>{ if(G.id===P.grp||G.s>M.k) return; if(G.items.some(i=>{ const r=M.items[i]; return r&&r.geo&&r.t!=='pt'&&dGeo(P.xy,r.geo)<=M.tol; })) out.push(G.id); });
  return [...new Set(out)]; }
/* на что опирается шаг: уже построенные подписанные точки, через которые проходят новые линии */
function anchors(M,s){ s=s||M.k; const out=new Set(); if(!s) return [];
  M.items.forEach((r,i)=>{ if(!r||r.s!==s||!r.geo) return; ptsOn(M,i).forEach(nm=>{ if(M.pts[nm].s<s) out.add(nm); }); });
  return [...out].sort((a,b)=>M.pts[a].xy[0]-M.pts[b].xy[0]).slice(0,8); }
const groupsOf=(M,s)=>Object.values(M.groups).filter(G=>G.s===s);

/* что видит модель: текст шага и связи, вычисленные ядром (координаты модели не нужны — отношения она спрашивает у verify) */
function facts(M){ const s=M.k, cur=groupsOf(M,s), newPts=Object.values(M.pts).filter(p=>p.s===s).map(p=>p.id);
  const seen=Object.values(M.pts).filter(p=>p.s<=s).map(p=>p.id), lines=Object.values(M.lines).filter(L=>L.s<=s).map(L=>L.id);
  return {task:{n:M.n,title:M.title,q:M.q}, mode:M.mode==='try'?(M.hidden?'Решаю сам: шаг ещё не показан студенту':'Решаю сам: шаг показан'):'Смотрю',
    step:s?Object.assign({k:s,of:M.steps.length},M.step):{k:0,of:M.steps.length,t:'Дано (условие)'},
    plan:M.steps.map((t,i)=>(i+1)+'. '+t),
    points:seen.slice(0,80), lines:lines.slice(0,40),
    newOnStep:{points:newPts.slice(0,30),groups:cur.map(G=>({id:G.id,name:G.name,kind:G.kind,labels:G.labels}))},
    builtOn:anchors(M,s),
    incidence:newPts.slice(0,16).map(nm=>({point:nm,on:onWhat(M,nm).map(id=>M.groups[id]?M.groups[id].name+' ('+id+')':id)})).filter(x=>x.on.length),
    answer:M.ans||undefined, has3d:M.has3d }; }

/* ───── проверка утверждения ─────
   claim: {rel, a, b}; rel —
     same_link  — a и b на одной линии связи (⟂ оси x: одна вертикаль)
     on         — точка a лежит на линии / группе b
     coincide   — проекции a и b совпадают (конкурирующие)
     higher     — точка a выше b в пространстве (по фронтальным проекциям: z больше)
     closer     — точка a ближе к зрителю, чем b (по горизонтальным проекциям: y больше)
     parallel / perp — линии a и b параллельны / перпендикулярны
     parallel_x / perp_x — линия a параллельна / перпендикулярна оси x
     exists     — на чертеже есть точка или линия a */
const REL=['same_link','on','coincide','higher','closer','parallel','perp','parallel_x','perp_x','exists'];
function el(M,id){ id=String(id||'').replace(/^(p|l|g):/,''); return M.pts[id]?{kind:'pt',o:M.pts[id]}:M.lines[id]?{kind:'line',o:M.lines[id]}:M.groups[id]?{kind:'grp',o:M.groups[id]}:null; }
const visible=(M,e)=>e&&e.o.s<=M.k&&!(M.hidden&&e.o.s===M.k);
function proj(M,nm,mark){ const b=base(nm), p=M.pts[b+mark]; return p&&p.s<=M.k?p:null; }
function verify(M,c){ c=c||{}; const rel=c.rel, A=el(M,c.a), B=c.b!=null?el(M,c.b):null, T=M.tol, f=(ok,why)=>({rel,a:c.a,b:c.b,ok,why});
  if(!REL.includes(rel)) return f(null,'такого отношения ядро не знает');
  if(rel==='exists') return f(!!(A&&visible(M,A)),A?(visible(M,A)?'есть':'появится на шаге '+A.o.s):'нет на чертеже');
  if(rel==='higher'||rel==='closer'){ const mk=rel==='higher'?'″':'′', pa=proj(M,c.a,mk), pb=proj(M,c.b,mk);
    if(!pa||!pb) return f(null,'нет '+(rel==='higher'?'фронтальных':'горизонтальных')+' проекций обеих точек');
    const d=rel==='higher'?pb.xy[1]-pa.xy[1]:pa.xy[1]-pb.xy[1]; return f(Math.abs(d)<=T?false:d>0,Math.abs(d)<=T?'на одном уровне':''); }
  if(!A) return f(null,'нет на чертеже: '+c.a);
  if(!visible(M,A)) return f(null,c.a+' ещё не построена');
  if(rel==='parallel_x'||rel==='perp_x'){ const u=A.kind==='line'?dirOf(A.o.geo):null; if(!u) return f(null,'это не прямая'); const a=ang(u,[1,0]);
    return f(rel==='parallel_x'?Math.min(a,180-a)<=2:Math.abs(a-90)<=2,'угол с осью x ≈ '+Math.round(Math.min(a,180-a))+'°'); }
  if(!B) return f(null,'нет на чертеже: '+c.b);
  if(!visible(M,B)) return f(null,c.b+' ещё не построена');
  if(rel==='same_link'){ if(A.kind!=='pt'||B.kind!=='pt') return f(null,'нужны две точки'); const d=Math.abs(A.o.xy[0]-B.o.xy[0]); return f(d<=T,d<=T?'':'сдвиг по x '+R2(d)); }
  if(rel==='coincide'){ if(A.kind!=='pt'||B.kind!=='pt') return f(null,'нужны две точки'); return f(dist(A.o.xy,B.o.xy)<=T,''); }
  if(rel==='on'){ if(A.kind!=='pt') return f(null,'первой должна быть точка');
    if(B.kind==='line') return f(dGeo(A.o.xy,B.o.geo)<=T,'');
    if(B.kind==='grp') return f(B.o.items.some(i=>{ const r=M.items[i]; return r&&r.geo&&r.t!=='pt'&&dGeo(A.o.xy,r.geo)<=T; }),'');
    if(B.kind==='pt') return f(dist(A.o.xy,B.o.xy)<=T,''); }
  if(rel==='parallel'||rel==='perp'){ const u=A.kind==='line'?dirOf(A.o.geo):null, v=B.kind==='line'?dirOf(B.o.geo):null; if(!u||!v) return f(null,'нужны две прямые');
    const a=ang(u,v), m=Math.min(a,180-a); return f(rel==='parallel'?m<=2:Math.abs(m-90)<=2,'угол ≈ '+Math.round(m)+'°'); }
  return f(null,'не проверить'); }

/* ───── подписи в тексте: наставник называет только то, что есть на чертеже ───── */
const LBL=/(?<![\p{L}\p{N}])([A-ZА-ЯЁa-z0-9ΣΦΓΔΘΛΩ][₀-₉0-9]{0,3}(?:\*)?[′″‴])(?![\p{L}\p{N}′″])/gu;
function labelsIn(text){ const out=[]; String(text||'').replace(LBL,(m,x)=>{ out.push(x); return m; }); return [...new Set(out)]; }
function known(M){ const S=new Set(Object.keys(M.pts).concat(Object.keys(M.lines)));
  /* подписи из текста шага и плана — их написал решатель, это тоже ядро */
  [M.title,M.q,M.ans,(M.step||{}).text,(M.step||{}).why,(M.step||{}).full,(M.step||{}).hint,(M.step||{}).check].concat(M.steps).forEach(t=>labelsIn(t).forEach(x=>S.add(x)));
  Object.keys(M.lines).forEach(l=>labelsIn(l).forEach(x=>S.add(x))); return S; }
function guardText(M,text){ const K=known(M); return labelsIn(text).filter(x=>!K.has(x)); }

/* ───── действия на чертеже ─────
   {do:'highlight', ids:[…], note}  подсветить точки, линии, группы (id — подпись или id группы)
   {do:'link', p}                    провести линию связи через проекцию p (вертикаль — по определению верна)
   {do:'segment', a, b}              соединить две построенные точки (временная линия)
   {do:'reveal', ids}                показать часть построения этого шага (то, что вычислил решатель)
   {do:'replay'}                     проиграть шаг по частям (группа за группой)
   {do:'3d'}                         открыть шаг в пространстве (посредники того же цвета, что на эпюре)
   {do:'goto', k}                    перейти к шагу k
   {do:'tap', p}                     попросить студента отметить на чертеже, где будет точка p */
const DO=['highlight','link','segment','reveal','replay','3d','goto','tap'];
function checkShow(M,list){ const ok=[], bad=[]; (Array.isArray(list)?list:[]).slice(0,6).forEach(a=>{ if(!a||!DO.includes(a.do)) return bad.push('неизвестное действие '+(a&&a.do));
  const ids=(Array.isArray(a.ids)?a.ids:[]).map(String);
  if(a.do==='highlight'||a.do==='reveal'){ const good=ids.filter(id=>{ const e=el(M,id); return e&&(a.do==='reveal'?e.o.s<=M.k:visible(M,e)); }); if(!good.length) return bad.push(a.do+': нет таких элементов: '+ids.join(', '));
    if(good.length<ids.length) bad.push(a.do+': пропущено '+ids.filter(x=>!good.includes(x)).join(', ')); return ok.push({do:a.do,ids:good.slice(0,10),note:strip(a.note||'').slice(0,60)}); }
  if(a.do==='link'){ const e=el(M,a.p); if(!e||e.kind!=='pt'||!visible(M,e)) return bad.push('link: нет точки '+a.p); return ok.push({do:'link',p:e.o.id}); }
  if(a.do==='segment'){ const A=el(M,a.a), B=el(M,a.b); if(!A||!B||A.kind!=='pt'||B.kind!=='pt'||!visible(M,A)||!visible(M,B)) return bad.push('segment: нужны две построенные точки'); return ok.push({do:'segment',a:A.o.id,b:B.o.id}); }
  if(a.do==='tap'){ const e=el(M,a.p); if(!e||e.kind!=='pt'||e.o.s!==M.k) return bad.push('tap: точка '+a.p+' не из этого шага'); return ok.push({do:'tap',p:e.o.id}); }
  if(a.do==='goto'){ const k=a.k|0; if(k<0||k>M.steps.length) return bad.push('goto: нет шага '+a.k); return ok.push({do:'goto',k}); }
  if(a.do==='3d'&&!M.has3d) return bad.push('3d: у этой задачи нет 3D');
  ok.push({do:a.do}); }); return {ok,bad}; }

/* ───── проверка ответа модели целиком ─────
   r: {say, ask, options, show, claims} → {ok, errors, reply (то, что можно показать)} */
const MISC=['link','hf','axis','visibility','mediator','belong','nv','rotate','order','reading'];
function reply(M,r){ r=r||{}; const errors=[], say=strip(r.say).slice(0,400), ask=strip(r.ask).slice(0,200);
  const opts=(Array.isArray(r.options)?r.options:[]).map(x=>strip(x).slice(0,60)).filter(Boolean).slice(0,4);
  if(!say&&!ask) errors.push('пустой ответ: нужен say');
  const claims=(Array.isArray(r.claims)?r.claims:[]).slice(0,10).map(c=>verify(M,c));
  claims.forEach(c=>{ if(c.ok!==true) errors.push('утверждение «'+c.rel+'('+c.a+(c.b!=null?', '+c.b:'')+')» '+(c.ok===false?'НЕВЕРНО по чертежу':'не проверить: '+c.why)+(c.why&&c.ok===false?' ('+c.why+')':'')); });
  const unk=guardText(M,[say,ask].concat(opts).join(' ')); if(unk.length) errors.push('на чертеже нет: '+unk.join(', ')+' — называй только существующие точки и линии');
  const sh=checkShow(M,r.show); sh.bad.forEach(b=>errors.push(b));
  if(M.hidden&&(r.show||[]).some(a=>a&&a.do==='reveal')&&!r.reveal_ok) errors.push('шаг не показан студенту («Решаю сам»): не раскрывай построение, наводи вопросом');
  const mis=MISC.includes(r.misconception)?r.misconception:'';
  return {ok:!errors.length,errors,reply:{say,ask,options:opts,show:sh.ok,claims:claims.filter(c=>c.ok===true),misconception:mis,level:r.level|0,author:!!r.author}}; }

/* ───── лестница подсказок без модели ─────
   0 намёк (вопрос + подсветка опор) → 1 принцип → 2 показ на чертеже по частям → 3 в пространстве → 4 весь шаг */
const LEVELS=['Намёк','Почему так','Покажи на чертеже','В пространстве','Весь шаг'];
const list=(a,n)=>{ a=a.slice(0,n||5); return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' и '+a[a.length-1]; };
const lc=s=>s&&/^[А-ЯЁA-Z][а-яёa-z]/.test(s)?s[0].toLowerCase()+s.slice(1):s;   /* «Строим…» → «строим…», но не «A‴ …» */
function sentences(t,n){ return (String(t||'').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)||[]).map(x=>x.trim()).filter(Boolean).slice(0,n).join(' '); }
function ladder(M,level){ const s=M.k, st=M.step; level=Math.max(0,Math.min(4,level|0));
  if(!s){ const g=Object.keys(M.pts).slice(0,6); return {level:0,say:'Это условие. Найди на чертеже, что дано, и скажи своими словами, что нужно построить.',ask:'С какой проекции начнёшь?',show:g.length?[{do:'highlight',ids:g}]:[],levels:LEVELS}; }
  const anc=anchors(M,s), grs=groupsOf(M,s), newP=Object.values(M.pts).filter(p=>p.s===s).map(p=>p.id), res=newP.filter(n=>/^res/.test(M.pts[n].k));
  const target=pickTarget(M);
  let say='', ask='', show=[];
  if(level===0){
    say=st.hint||(anc.length?'Новое построение опирается на '+list(anc)+(anc.length>1?' — они подсвечены.':' — она подсвечена.'):'Посмотри, что добавляется на этом шаге: '+lc(st.t)+'.');
    if(st.hint&&anc.length) say+=' Опоры шага: '+list(anc)+'.';
    ask=M.hidden&&target?'Где, по-твоему, будет '+target+'? Отметь на чертеже.':grs.some(G=>G.col)?'Какая поверхность-посредник режет оба тела по простым линиям?':'Что нужно сделать с подсвеченным, чтобы '+lc(st.t).replace(/^что /,'понять, что ')+'?';
    const med=grs.find(G=>G.col);
    show=anc.length?[{do:'highlight',ids:anc,note:'опоры шага'}]:med&&!M.hidden?[{do:'highlight',ids:[med.id],note:med.name}]:[];
    if(!anc.length&&med&&!M.hidden&&!st.hint) say='Посмотри на подсвеченный '+med.name+': он режет оба тела.';
    if(M.hidden&&target) show.push({do:'tap',p:target}); }
  else if(level===1){ say=sentences(st.why||st.text,3)||'На этом шаге: '+lc(st.t)+'.'; show=anc.length?[{do:'highlight',ids:anc}]:[]; }
  else if(level===2){ const gn=grs.map(G=>G.name).filter((x,i,a)=>a.indexOf(x)===i);
    say='Смотри по частям'+(gn.length?': '+list(gn,4):'')+'. '+(res.length?(()=>{ const b=[...new Set(res.map(base))]; return (b.length>1?'Искомые точки — ':'Искомая точка — ')+list(b,8)+'.'; })():'');
    show=[{do:'replay'}]; }
  else if(level===3){ if(!M.has3d) return ladder(M,4);
    say='То же в пространстве: посредники и сечения того же цвета, что на эпюре. Поверни модель — видно, почему точки общие.'; show=[{do:'3d'}]; }
  else { say=sentences(st.text,4)||st.t; if(st.full) say+=' '+sentences(st.full,3); show=[{do:M.hidden?'reveal':'highlight',ids:grs.map(G=>G.id).concat(newP).slice(0,10)}]; if(st.check) ask='Проверь себя: '+st.check; }
  show=show.filter(a=>!a.ids||a.ids.length);   /* подсвечивать нечего — не подсвечиваем */
  return {level,say:say.slice(0,600),ask,show,levels:LEVELS}; }
/* точка, положение которой студент может предсказать: проекция этого шага, вторая проекция которой уже построена */
function pickTarget(M){ const s=M.k, cand=Object.values(M.pts).filter(p=>p.s===s&&MARKS.test(p.id));
  const has2=p=>{ const om=p.id.endsWith('″')?'′':'″', q=M.pts[base(p.id)+om]; return q&&q.s<s; };
  const c=cand.filter(has2).sort((a,b)=>(/^res/.test(b.k)?1:0)-(/^res/.test(a.k)?1:0))[0]||null; return c?c.id:null; }

/* ───── «Решаю сам»: студент отметил, где будет точка ─────
   xy — в координатах чертежа. Диагноз: мимо линии связи / не на той линии / верно */
function tapCheck(M,id,xy){ const P=M.pts[id]; if(!P||!xy) return {ok:false,kind:'none',say:'Не знаю такой точки.'};
  const T=Math.max(M.tol*3,3), d=dist(P.xy,xy), om=id.endsWith('″')?'′':id.endsWith('′')?'″':'', Q=om?M.pts[base(id)+om]:null, q=Q&&Q.s<M.k?Q:null;
  if(d<=T) return {ok:true,kind:'ok',say:'Верно: '+id+' здесь.'+(q?' Она на одной линии связи с '+q.id+'.':''),show:[{do:'highlight',ids:[id]}]};
  const offLink=q&&Math.abs(xy[0]-q.xy[0])>T;
  if(offLink) return {ok:false,kind:'link',misconception:'link',say:'Мимо линии связи: '+id+' и '+q.id+' — проекции одной точки, они на одной вертикали. Провёл её — ищи на ней.',show:[{do:'link',p:q.id}]};
  const on=onWhat(M,id).map(g=>M.groups[g]?{id:g,name:M.groups[g].name}:{id:g,name:g}).filter(x=>!(M.groups[x.id]&&M.groups[x.id].s===M.k&&!M.groups[x.id].col));
  const L=on[0];
  return {ok:false,kind:'where',misconception:'belong',say:(q?'По линии связи верно, но '+(xy[1]<P.xy[1]?'выше':'ниже')+', чем нужно. ':'Не здесь. ')+(L?id+' лежит ещё и на линии «'+L.name+'» — подсветил: где она пересекает линию связи?':'Подумай, какой линии ещё принадлежит точка.'),
    show:[q?{do:'link',p:q.id}:null,L?{do:L.id.startsWith('g')?'reveal':'highlight',ids:[L.id]}:null].filter(Boolean)}; }

/* ───── для модели: инструкция и инструменты ───── */
const SYSTEM=`Ты — «Ассистент Андрея», наставник по начертательной геометрии и инженерной графике (студенты 1 курса МГТУ им. Баумана).
Ты учишь пространственному мышлению НА САМОМ ЧЕРТЕЖЕ: подсвечиваешь линии, достраиваешь, поворачиваешь 3D — и задаёшь вопрос.

Главное правило: о геометрии ты не утверждаешь ничего, что не пришло из ядра сайта. Ядро — это решатель задачи и проверки
чертежа; его данные — в сообщении «Чертёж» (точки, линии, группы построения, кто на чём лежит, текст шага от решателя).
• Любое утверждение об отношении на чертеже (на одной линии связи, лежит на, выше/ниже, ближе, параллельно, перпендикулярно,
  совпадают) — сначала проверь инструментом verify или положи в claims ответа: ядро проверит. Неверное не говори никогда.
• Называй только точки и линии, которые есть на чертеже, в их обозначениях: A″ — фронтальная проекция (π₂), A′ —
  горизонтальная (π₁), новые плоскости π₄, π₅, посредники Σ, Φ. Не выдумывай чисел: числа — только из текста шага.
• Если ядро не может проверить то, о чём спрашивают, — так и скажи и предложи спросить автора (author: true).

Педагогика (сократический метод):
• Отвечай коротко: 1–2 предложения в say, главное — на чертеже (show). Один шаг за раз.
• Сначала наводящий вопрос (ask, можно с 2–4 вариантами options), не готовый ответ. Подсказки — лестницей:
  намёк → принцип → показ на чертеже → показ в 3D → весь шаг. Весь шаг — только если студент прямо просит.
• В «Решаю сам», пока шаг не показан, не раскрывай построение (reveal нельзя): наводи, попроси отметить точку (tap).
• Не решай за студента всё ДЗ и не выдавай итоговый лист: цель — чтобы он сдал сам.
• По ответам студента определи, ЧТО он понимает неверно (misconception: link — линии связи, hf — путает горизонталь и
  фронталь, axis — координата не с той оси, visibility — видимость, mediator — выбор посредника, belong — принадлежность
  точки поверхности/линии, nv — натуральная величина, rotate — вращение/замена плоскостей, order — порядок соединения точек,
  reading — чтение чертежа).
• На «ты», просто, без воды, без лести и без «отличный вопрос». Язык — русский.
• Студенту не говори про «ядро», инструменты и проверки — говори «по чертежу», «на чертеже видно».

Ответ — всегда инструментом reply (один раз в конце). Перед ним можно вызвать verify.`;
const S_STR={type:'string'};
const CLAIM={type:'object',properties:{rel:{type:'string',enum:REL},a:S_STR,b:S_STR},required:['rel','a'],additionalProperties:false};
const ACT={type:'object',properties:{do:{type:'string',enum:DO},ids:{type:'array',items:S_STR},note:S_STR,p:S_STR,a:S_STR,b:S_STR,k:{type:'integer'}},required:['do'],additionalProperties:false};
const TOOLS=[
  {name:'verify',description:'Проверить утверждения о чертеже геометрическим ядром сайта. Возвращает для каждого ok: true (верно), false (неверно) или null (не проверить). a, b — подписи точек/линий (A″, h′) или id групп (g2:#117788).',
   input_schema:{type:'object',properties:{claims:{type:'array',items:CLAIM,minItems:1,maxItems:10}},required:['claims'],additionalProperties:false}},
  {name:'reply',description:'Ответ студенту: одна-две фразы и то, что показать на чертеже. Утверждения о геометрии из say положи в claims — ядро проверит их; если что-то неверно, ответ вернётся с ошибкой.',
   input_schema:{type:'object',properties:{
     say:{type:'string',description:'1–2 коротких предложения'},
     ask:{type:'string',description:'наводящий вопрос студенту (необязательно)'},
     options:{type:'array',items:S_STR,maxItems:4,description:'варианты ответа на вопрос — кнопками'},
     show:{type:'array',items:ACT,maxItems:6,description:'действия на чертеже: highlight, link, segment, reveal, replay, 3d, goto, tap'},
     claims:{type:'array',items:CLAIM,maxItems:10},
     level:{type:'integer',description:'ступень лестницы 0–4'},
     misconception:{type:'string',enum:MISC.concat([''])},
     author:{type:'boolean',description:'ядро не может проверить — предложить спросить автора'}},
   required:['say'],additionalProperties:false}}];

return {build,facts,verify,reply,ladder,tapCheck,pickTarget,anchors,onWhat,guardText,labelsIn,checkShow,el,strip,geoOf,dGeo,SYSTEM,TOOLS,REL,DO,MISC,LEVELS};
});
