/* ═══════════ «РК2 за 9 шагов» (#/ng/rk2): генераторы задач, прогресс, экраны ═══════════
   1. Генераторы: каждая из 9 тем, обычный и усложнённый вариант, 150 номеров. Ответ пересчитывается НЕЗАВИСИМО от кода
      генератора — по координатам из таблицы, которую видит студент (округлённым, как на экране): угол между прямыми,
      угол плоскости с π₁/π₂, углы и радиус описанной окружности треугольника, точка биссектрисы (равные углы и D ∈ AB),
      расстояния (параллельные и скрещивающиеся прямые, точка — плоскость, параллельные плоскости), двугранный угол,
      фигуры на прямой (вершины на a, равные стороны, прямые углы, центр вписанной окружности, касание, 50 мм).
      Все точки — в I четверти; одинаковый номер — одинаковая задача; ответ принимается в допуске и отклоняется за ним.
   2. Прогресс: пусто — 0; «понял» — 3 %; тема закрыта — 10 %; 9 тем — 90 %; пробный РК2 3 из 3 — 100 %.
      Цвет шкалы: 15 % — красный, 90 % — зелёный.
   3. Билет пробного РК2: три задачи, А и Б разных типов, В — фигура на прямой или угол между плоскостями,
      не меньше двух разных способов, варианты усложнённые.
   4. Экраны: путь (9 тем и финал), тема — 3 шага (Как решать → Разбор по шагам → Задачи билета), в задачах только условия и кнопка печати;
      пройденная тема даёт 10 %; пробный РК2 — «сошлось» по всем трём даёт 3 из 3 и 100 %. Без ошибок JS и прокрутки вбок.
   5. Печать условий: по листу на задачу, условие и чертёж «дано» без шагов и ответа, имя автора и ссылка на каждом листе,
      при печати видны только листы, на экране документа нет.
   Запуск: из tests/run.js; отдельно — node tests/rkp.js */
async function rkpCheck(page,URL){
  const bad=[], add=(name,rule,msg)=>bad.push({name,rule,msg:String(msg).slice(0,220)});
  const errs=[]; const onErr=e=>errs.push(String(e)); page.on('pageerror',onErr);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(URL+'#/'); await page.waitForTimeout(800);
  await page.evaluate(()=>{ try{ localStorage.removeItem('nch2_rkp'); }catch(e){} });
  const r=await page.evaluate(()=>{ const out=[], A=(n,r,m)=>out.push([n,r,m]);
    /* своя линейная алгебра — не из сайта */
    const sub=(a,b)=>a.map((x,i)=>x-b[i]), addv=(a,b)=>a.map((x,i)=>x+b[i]), mul=(a,k)=>a.map(x=>x*k), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
    const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], nrm=a=>Math.hypot(...a), un=a=>mul(a,1/nrm(a));
    const ang=(u,w)=>Math.acos(Math.max(-1,Math.min(1,dot(u,w)/(nrm(u)*nrm(w)))))*180/Math.PI, dst=(a,b)=>nrm(sub(a,b));
    const dLine=(p,a,b)=>nrm(crs(sub(p,a),sub(b,a)))/nrm(sub(b,a));
    const rnd=p=>p.map(x=>Math.round(x*10)/10);   /* как в таблице на экране */
    const C=q=>{ const o={}; Object.keys(q.coords).forEach(k=>o[k]=rnd(q.coords[k])); return o; };
    const near=(a,b,e)=>Math.abs(a-b)<=e;
    for(const type of Object.keys(RKP.GEN)) for(const hard of [false,true]) for(let s=1;s<=150;s++){
      const nm=type+(hard?'*':'')+' #'+s, q=RKP.make(type,s,hard);
      if(!q){ A(nm,'генератор','нет задачи'); continue; }
      const q2=RKP.make(type,s,hard); if(JSON.stringify(q2.coords)!==JSON.stringify(q.coords)||q2.ans!==q.ans) A(nm,'номер','один номер — разные задачи');
      if(!(isFinite(q.ans)&&q.ans>0)) { A(nm,'ответ','не число: '+q.ans); continue; }
      Object.keys(q.coords).forEach(k=>{ const p=q.coords[k]; if(p[0]<3||p[1]<2.9||p[2]<2.9) A(nm,'четверть',k+' = '+p.join('; ')); });
      if(q.sol) Object.keys(q.sol.pts).forEach(k=>{ const p=q.sol.pts[k]; if(p[1]<2||p[2]<2) A(nm,'четверть','точка решения '+k+' вне I четверти'); });
      const c=C(q), E=q.u==='°'?.6:.4;   /* округление координат до 0,1 мм */
      let want=null;
      if(type==='ang'){ want=c.K?ang(sub(c['A ∈ a'],c.K),sub(c['B ∈ b'],c.K)):ang(sub(c['a: 2'],c['a: 1']),sub(c['b: 4'],c['b: 3'])); want=Math.min(want,180-want); }
      if(type==='incl'){ const M=q.meta; const n=crs(sub(M.B,M.A),sub(M.C,M.A)); want=Math.acos(Math.abs(un(n)[q.to===1?2:1]))*180/Math.PI;
        /* плоскость действительно задана тем, что нарисовано */
        const pts=Object.values(c); pts.forEach(p=>{ if(Math.abs(dot(sub(p,M.A),un(n)))>.2) A(nm,'плоскость','точка условия не в плоскости'); }); }
      if(type==='nv'){ if(q.kind==='R'){ const O=q.sol.pts.O; [c.A,c.B,c.C].forEach(p=>{ if(!near(dst(O,p),q.ans,.2)) A(nm,'описанная','|OX| ≠ R'); });
          if(Math.abs(dot(sub(O,c.A),un(crs(sub(c.B,c.A),sub(c.C,c.A)))))>.2) A(nm,'описанная','O не в плоскости'); want=dst(O,c.A); }
        else { const P={A:c.A,B:c.B,C:c.C}, o=['A','B','C'].filter(x=>x!==q.V); want=ang(sub(P[o[0]],P[q.V]),sub(P[o[1]],P[q.V])); } }
      if(type==='bis'){ const D=q.meta.D; if(!near(ang(sub(c.A,c.K),sub(D,c.K)),ang(sub(D,c.K),sub(c.B,c.K)),.5)) A(nm,'биссектриса','углы AKD и DKB не равны');
        if(dLine(D,c.A,c.B)>.1) A(nm,'биссектриса','D не на AB'); const ax=q.ax==='h'?2:1; if(c.A[ax]!==c.B[ax]) A(nm,'биссектриса','AB — не линия уровня');
        want=D[0]; }
      if(type==='dll'){ const P1=c['a: 1'],P2=c['a: 2'],Q1=c['b: 3'],Q2=c['b: 4'], d=sub(P2,P1), e=sub(Q2,Q1), n=crs(d,e);
        want=nrm(n)<1e-6*nrm(d)*nrm(e)||q.meta.skew==null?dLine(Q1,P1,P2):Math.abs(dot(sub(Q1,P1),n))/nrm(n);
        if(!q.meta.skew&&ang(d,e)>.5&&ang(d,e)<179.5) A(nm,'параллельность','a и b не параллельны: '+ang(d,e)); }
      if(type==='dpp'){ const n=un(crs(sub(c.B,c.A||c.B),sub(c.C,c.B)));
        if(q.kind==='pt'){ const nn=un(crs(sub(c.C,c.B),sub(c.D,c.B))); want=Math.abs(dot(sub(c.A,c.B),nn)); }
        else { const nn=un(crs(sub(c.B,c.A),sub(c.C,c.A))); const ds=[c.D,c.E,c.F].map(p=>Math.abs(dot(sub(p,c.A),nn))); if(Math.max(...ds)-Math.min(...ds)>.5) A(nm,'параллельность','плоскости не параллельны'); want=ds[0]; } }
      if(type==='dih'){ if(c.A&&c.D){ const e=sub(c.B,c.A), pr=p=>{ const w=sub(p,c.A); return sub(w,mul(e,dot(w,e)/dot(e,e))); }; want=ang(pr(c.C),pr(c.D)); }
        else { const na=crs(sub(c['a: 2'],c['a: 1']),sub(c['b: 3'],c['a: 1'])), nb=crs(sub(c['C ∈ c'],c.K),sub(c['D ∈ d'],c.K)); want=ang(na,nb); want=Math.min(want,180-want); } }
      if(type==='tri'||type==='sq'){ const P1=c['a: 1'],P2=c['a: 2'],S=q.sol.pts, Ap=c.A, onA=p=>dLine(p,P1,P2)<.25;
        const P=Object.assign({A:Ap},S), L=(x,y)=>dst(P[x],P[y]), rt=(x,y,z)=>near(ang(sub(P[x],P[y]),sub(P[z],P[y])),90,.6);
        const k=q.kind, chk=(ok,m)=>{ if(!ok) A(nm,k,m); };
        if(k==='eq'){ chk(onA(S.B)&&onA(S.C),'B, C не на a'); chk(near(L('A','B'),L('B','C'),.3)&&near(L('A','C'),L('B','C'),.3),'не равносторонний'); want=L('B','C'); }
        if(k==='iso'){ chk(onA(S.B)&&onA(S.C),'B, C не на a'); chk(near(L('A','B'),40,.3)&&near(L('A','C'),40,.3),'боковые ≠ 40'); want=L('B','C'); }
        if(k==='rt'){ chk(onA(S.B)&&onA(S.C),'B, C не на a'); chk(rt('A','B','C'),'угол B ≠ 90°'); chk(near(L('A','B'),L('B','C'),.3),'катеты не равны'); want=L('A','C'); }
        if(k==='eqIn'){ chk(onA(S.B)&&onA(S.C),'B, C не на a'); chk(near(L('B','D'),L('B','C'),.3)&&near(L('C','D'),L('B','C'),.3),'BCD не равносторонний');
          const G=mul(addv(addv(S.B,S.C),S.D),1/3); chk(dst(G,Ap)<.3,'A — не центр вписанной окружности'); want=L('B','C'); }
        if(k==='sq'){ chk(onA(S.B)&&onA(S.C),'B, C не на a'); chk(rt('A','B','C')&&rt('B','C','D')&&rt('C','D','A'),'не квадрат: углы'); chk(near(L('A','B'),L('B','C'),.3)&&near(L('C','D'),L('D','A'),.3),'не квадрат: стороны'); want=L('A','B'); }
        if(k==='sqD'){ chk(onA(S.B)&&onA(S.D),'B, D не на a'); chk(rt('D','A','B')&&rt('A','B','C')&&rt('B','C','D'),'не квадрат: углы'); chk(near(L('A','B'),L('B','C'),.3),'не квадрат: стороны'); want=L('A','B'); }
        if(k==='sqIn'){ chk(onA(S.B)&&onA(S.C),'B, C не на a'); chk(rt('E','B','C')&&rt('B','C','D')&&rt('C','D','E'),'не квадрат'); const G=mul(addv(S.B,S.D),.5); chk(dst(G,Ap)<.3,'A — не центр квадрата'); want=L('B','C'); }
        if(k==='cir'){ chk(onA(S.K),'K не на a'); chk(near(ang(sub(Ap,S.K),sub(P2,P1)),90,.6),'AK не ⟂ a'); want=L('A','K'); }
        if(k==='p50'){ chk(onA(S.M)&&onA(S.N),'точки не на a'); chk(near(L('A','M'),50,.3)&&near(L('A','N'),50,.3),'не 50 мм'); want=L('M','N'); } }
      if(want==null) A(nm,'проверка','тип без независимой проверки');
      else if(!near(want,q.ans,E)) A(nm,'ответ','по координатам '+want.toFixed(2)+', на сайте '+q.ans.toFixed(2));
      /* допуск: верный принимается, промах на 3 допуска — нет */
      if(!RKP.check(q,q.ans+q.tol*.9).ok) A(nm,'допуск','верный ответ в допуске не принят');
      if(RKP.check(q,q.ans+q.tol*3).ok&&!(q.alt||[]).some(a=>Math.abs(a-q.ans-q.tol*3)<=q.tol)) A(nm,'допуск','промах на 3 допуска принят');
    }
    if(RKP.parseNum('42,5')!==42.5||RKP.parseNum('17 мм')!==17||RKP.parseNum('abc')!==null) A('ввод','число','разбор числа');
    /* 2. прогресс */
    const T=RKP.TOPICS, P=s=>RKP.progress(s), full=()=>({t:Object.fromEntries(T.map(x=>[x.id,{u:1,ok:Object.keys(x.m),n:2,w:0}])),x:{best:0,h:[]}});
    if(T.length!==9) A('прогресс','темы','тем '+T.length);
    if(P({t:{},x:{best:0,h:[]}}).val!==0) A('прогресс','пусто','не 0');
    if(P({t:{ang:{u:1,h:1}},x:{best:0,h:[]}}).val!==0) A('прогресс','способ','прочитать способ — ещё не пройдена тема');
    if(P({t:{ang:{h:1,sol:1}},x:{best:0,h:[]}}).val!==10) A('прогресс','разбор','досмотренный разбор не закрывает тему (10 %)');
    if(P({t:{ang:{u:1,ok:['zam'],n:1,w:0}},x:{best:0,h:[]}}).val!==10) A('прогресс','старые записи','решённая раньше задача не засчитана');
    if(P({t:{ang:{u:1,h:1,sol:1,d:1}},x:{best:0,h:[]}}).val!==10) A('прогресс','тема','пройденная по шагам тема не 10 %');
    if(P(full()).val!==90) A('прогресс','9 тем','не 90 %: '+P(full()).val);
    const f3=full(); f3.x.best=3; if(P(f3).val!==100) A('прогресс','финал','не 100 %');
    if(RKP.hue(15)!==0||RKP.hue(90)!==130) A('прогресс','цвет','15 % не красный или 90 % не зелёный');
    /* 3. билеты */
    for(let s=1;s<=60;s++){ const tk=RKP.ticket(s); if(tk.length!==3){ A('билет #'+s,'состав','задач '+tk.length); continue; }
      if(tk[0].type===tk[1].type) A('билет #'+s,'состав','А и Б одного типа'); if(!['tri','sq','dih'].includes(tk[2].type)) A('билет #'+s,'состав','В — '+tk[2].type);
      if(new Set(tk.map(q=>q.method)).size<2) A('билет #'+s,'способы','один способ на весь билет'); if(tk.some(q=>!q.hard)) A('билет #'+s,'сложность','не усложнённый вариант'); }
    return out; });
  r.forEach(x=>add(x[0],x[1],x[2]));
  /* 4. экраны */
  const wide=async nm=>{ const w=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth); if(w>1) add(nm,'ширина','прокрутка вбок на '+w+' px'); };
  /* ссылки страницы ведут по адресам сайта (H, перекрытая проекцией L.H, давала href="NaN,NaN" — кнопки не работали) */
  const links=async nm=>{ const b=await page.evaluate(()=>[...document.querySelectorAll('.rkp-page a[href]')].map(a=>a.getAttribute('href')).filter(h=>!/^#\/[\w\/%.-]*$/.test(h)));
    if(b.length) add(nm,'ссылки','не адрес: '+b.slice(0,3).join(' · ')); };
  await page.evaluate(()=>{ location.hash='#/ng/rk2'; }); await page.waitForTimeout(400); await links('путь');
  const nodes=await page.$$eval('.rkp-path .rkp-n',x=>x.length); if(nodes!==10) add('путь','узлы','узлов '+nodes+' вместо 10'); await wide('путь');
  for(const T of await page.evaluate(()=>RKP.TOPICS.map(t=>({id:t.id,ms:Object.keys(t.m)})))){
    await page.evaluate(id=>{ location.hash='#/ng/rk2/p/'+id; },T.id); await page.waitForTimeout(250); await wide('тема '+T.id); await links('тема '+T.id);
    /* тема по шагам: 3 вкладки (Как решать → Разбор по шагам → Задачи билета), «Дальше» ведёт к следующей; ввода чисел нет */
    const tabs=await page.$$eval('.rkp-stp [data-go]',x=>x.length); if(tabs!==3) add('тема '+T.id,'шаги','вкладок '+tabs);
    if(await page.$('[data-ans]')) add('тема '+T.id,'ввод','на странице темы осталось поле ввода ответа');
    await page.click('.rkp-stp [data-go="0"]'); await page.waitForTimeout(80);
    for(let k=1;k<3;k++){ await page.click('.rkp-fwd [data-go="'+k+'"]'); await page.waitForTimeout(150);
      const on=await page.$eval('.rkp-stp button.on',b=>+b.dataset.go); if(on!==k) add('тема '+T.id,'дальше','после «Дальше» открыт шаг '+(on+1)+' вместо '+(k+1)); }
    const nm=await page.$$eval('#rkpMore .rkp-mt-c',x=>x.length), nk=await page.evaluate(id=>RKP.RK2V[id].length,T.id);
    if(nm!==nk) add('тема '+T.id,'решить ещё','задач '+nm+' из '+nk+' видов');
    if(await page.$('[data-ans]')) add('тема '+T.id,'ввод','в «Задачах билета» поле ввода ответа');
    if(await page.$('#rkpMore details, #rkpMore .rkp-ans')) add('тема '+T.id,'задачи билета','остались ответы или координаты');
    if(!await page.$('[data-rkmore]')) add('тема '+T.id,'задачи билета','нет кнопки печати');
    await page.click('[data-fin]'); await page.waitForTimeout(250);
    const st=await page.evaluate(id=>{ const s=JSON.parse(localStorage.getItem('nch2_rkp')||'{}'); return s.t&&s.t[id]; },T.id);
    if(!st||!st.h||!st.sol||!st.d) add('тема '+T.id,'сохранение',JSON.stringify(st));
  }
  const pv=await page.evaluate(()=>RKP.progress().topics); if(pv!==90) add('путь','все темы','после прохождения всех тем '+pv+' %');
  await page.evaluate(()=>{ location.hash='#/ng/rk2/x'; }); await page.waitForTimeout(250); await page.click('[data-go]'); await page.waitForTimeout(200); await wide('пробный РК2'); await links('пробный РК2');
  const seed=await page.evaluate(()=>+document.querySelector('.rkp-xh h1').textContent.replace(/\D/g,''));
  const ans=await page.evaluate(sd=>RKP.ticket(sd).map(q=>q.ans),seed);
  if(ans.length!==3) add('пробный РК2','билет','задач '+ans.length);
  await page.click('[data-open]'); await page.waitForTimeout(200);
  for(const L of ['А','Б','В']){ await page.click('[data-q="'+L+'"] [data-self="1"]'); await page.waitForTimeout(150); }
  const x=await page.evaluate(()=>({t:(document.querySelector('.rkp-xres b')||{}).textContent,v:RKP.progress().val}));
  if(x.t!=='3 из 3'||x.v!==100) add('пробный РК2','итог',JSON.stringify(x));
  await page.evaluate(()=>{ location.hash='#/ng/rk2'; }); await page.waitForTimeout(300);
  const meter=await page.evaluate(()=>(document.querySelector('.rkp-mt b')||{}).textContent); if(!/^100/.test(meter||'')) add('путь','шкала','после всего '+meter);
  /* 5. Печать условий: по листу на задачу RK2 9 тем, на листе — условие и чертёж «дано», без шагов и ответа; имя автора и ссылка */
  await page.evaluate(()=>{ location.hash='#/ng/rk2'; }); await page.waitForTimeout(300);
  await page.evaluate(()=>{ window.__print=window.print; window.print=()=>{ window.__printed=(window.__printed||0)+1; }; });
  await page.click('[data-rkprint]'); await page.waitForTimeout(300);
  await page.emulateMedia({media:'print'});
  const pr=await page.evaluate(()=>{ const out=[], L=RKP.prnTasks(), pg=[...document.querySelectorAll('#prnOut .prn-pg')];
    if(!window.__printed) out.push('кнопка не вызвала печать');
    if(pg.length!==L.length||L.length<9) out.push('листов '+pg.length+', задач '+L.length);
    pg.forEach((g,i)=>{ const t=L[i]&&L[i].t, tx=g.textContent, cs=e=>e&&getComputedStyle(e).display!=='none';
      if(!/Матханов Андрей Михайлович/.test(tx)) out.push('лист '+(i+1)+': нет имени автора');
      if(!/nachert1830\.ru\/#\/ng\/rk2\/p\//.test(tx)) out.push('лист '+(i+1)+': нет ссылки на тему');
      if(!cs(g.querySelector('.prn-f'))||!cs(g.querySelector('.prn-h'))) out.push('лист '+(i+1)+': шапка или подпись скрыты при печати');
      if(!g.querySelector('.prn-fig svg path')) out.push('лист '+(i+1)+': нет чертежа');
      if(g.scrollHeight>g.clientHeight+1) out.push('лист '+(i+1)+': не влезает в А4');
      const fb=g.querySelector('.prn-fig').getBoundingClientRect(), sb=g.querySelector('.prn-fig svg').getBoundingClientRect(); if(sb.right>fb.right+1||sb.bottom>fb.bottom+1) out.push('лист '+(i+1)+': чертёж за рамкой');
      if(t){ const ans=String(t.ans||'').replace(/<[^>]+>/g,'').trim(); if(ans&&tx.includes(ans)) out.push('лист '+(i+1)+': в документе ответ «'+ans+'»');
        (t.steps||[]).forEach(st=>{ if(st.v&&st.v.length>12&&tx.includes(st.v)) out.push('лист '+(i+1)+': в документе шаг решения «'+st.t+'»'); }); } });
    if([...document.body.children].some(e=>e.id!=='prnOut'&&e.tagName!=='SCRIPT'&&e.tagName!=='STYLE'&&getComputedStyle(e).display!=='none')) out.push('при печати видна страница сайта');
    return out; });
  pr.forEach(m=>add('печать условий','документ',m));
  await page.emulateMedia({media:'screen'});
  if(await page.evaluate(()=>{ const e=document.getElementById('prnOut'); return !!e&&getComputedStyle(e).display!=='none'; })) add('печать условий','экран','документ виден на экране');
  await page.evaluate(()=>{ window.print=window.__print; location.hash='#/ng/rk2/p/ang'; }); await page.waitForTimeout(300);
  if(await page.evaluate(()=>!!document.getElementById('prnOut')||document.body.classList.contains('prn-on'))) add('печать условий','выход','документ остался после перехода');
  for(let k=0;k<4&&!(await page.$('[data-rkprint="ang"]'));k++){ await page.evaluate(()=>{ const b=[...document.querySelectorAll('[data-go]')].find(x=>x.dataset.go==='1')||document.querySelector('.rkp-fw[data-go]'); if(b) b.click(); }); await page.waitForTimeout(250); }
  if(!(await page.$('[data-rkprint="ang"]'))) add('печать условий','тема','нет кнопки «Распечатать условие» на странице темы');
  await page.evaluate(()=>{ try{ localStorage.removeItem('nch2_rkp'); }catch(e){} });
  if(errs.length) add('РК2 за 9 шагов','ошибка JS',errs.join(' / '));
  page.off('pageerror',onErr);
  return bad;
}
module.exports={rkpCheck};
if(require.main===module)(async()=>{
  const http=require('http'), fs=require('fs'), path=require('path'); let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const ROOT=path.join(__dirname,'..');
  const srv=await new Promise(res=>{ const s=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0,'127.0.0.1',()=>res(s)); });
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const bad=await rkpCheck(page,'http://127.0.0.1:'+srv.address().port+'/');
  bad.slice(0,60).forEach(b=>console.log(b.name+' | '+b.rule+' | '+b.msg)); console.log('РК2 за 9 шагов: замечаний '+bad.length);
  await browser.close(); srv.close(); process.exit(bad.length?1:0);
})();
