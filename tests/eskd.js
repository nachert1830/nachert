/* ═══════════ Реестр норм ЕСКД (window.ESKD в index.html): сверка с ГОСТ ═══════════
   Листы ИГ строятся из реестра, нормоконтроль проверяет по нему же, теория берёт из него числа. Поэтому сам реестр проверяется
   отдельно — по трём сторонам:
     1. Целостность: у каждой нормы есть стандарт, пункт, цитата и статус сверки; профиль листа (ESKD.PR) — внутри норм
        (ESKD.audit()).
     2. Источники: тексты стандартов лежат в docs/gost/ (файл .txt или .pdf, в имени — номер стандарта: «2.303.txt»,
        «ГОСТ 2.303-68.pdf»). Норма со статусом ver:'text' обязана найтись в тексте дословно (без учёта регистра, пробелов,
        вида тире и многоточия), а её числа — в самой цитате. Остальные нормы показываются как «можно подтвердить» или
        «не найдено в тексте» — чтобы перевести их в 'text', поправив цитату.
     3. Текст сайта: числа ЕСКД в формулировках («штрихи 5…30 мм», «выносные … на 1…5 мм», «А3 — 297×420») ищутся по всему
        index.html и сверяются с реестром; расхождение — ошибка. Ссылка на отменённый ГОСТ 2.104 без «Р» — тоже.
   node tests/eskd.js — отчёт; из tests/run.js вызывается check(). Код выхода 1 — есть ошибки. */
const fs=require('fs'), path=require('path'), vm=require('vm'), cp=require('child_process');
const ROOT=path.join(__dirname,'..'), GOST=path.join(ROOT,'docs','gost');

/* реестр — тот самый модуль из index.html, без браузера */
function load(html){ const a=html.indexOf('window.ESKD=(function(){'), b=html.indexOf('\n})();',a); if(a<0||b<0) throw new Error('в index.html нет модуля window.ESKD');
  const ctx={window:{},Math,String,Object,Array,Error,Number}; vm.runInNewContext(html.slice(a,b+6),ctx); return {E:ctx.window.ESKD,a,b:b+6}; }

const norm=t=>String(t).toLowerCase().replace(/ё/g,'е').replace(/[‐-―−]/g,'-').replace(/\.\.\.|…/g,'…').replace(/[«»"“”„]/g,'"').replace(/\s+/g,' ').replace(/\s*([,;:.…()-])\s*/g,'$1').trim();

/* тексты стандартов из docs/gost: {'2.303': текст} */
function sources(){ const out={}, skip=[]; if(!fs.existsSync(GOST)) return {out,skip};
  fs.readdirSync(GOST).forEach(f=>{ const m=/(\d\.\d{3})/.exec(f); if(!m) return; const p=path.join(GOST,f); let t=null;
    if(/\.txt$/i.test(f)) t=fs.readFileSync(p,'utf8');
    else if(/\.pdf$/i.test(f)){ try{ t=cp.execFileSync('pdftotext',['-layout',p,'-'],{encoding:'utf8',maxBuffer:64<<20}); }catch(e){ skip.push(f+': не прочитан (нужен pdftotext или .txt рядом)'); } }
    if(t!=null) out[m[1]]=(out[m[1]]||'')+'\n'+t; });
  return {out,skip}; }

/* числа нормы, которые должны стоять в цитате: «0,5», «1,4», «12» */
const numsOf=o=>{ const v=o.v, L=[]; const put=x=>{ if(typeof x==='number'&&o.u!=='s') L.push(String(Math.round(x*1000)/1000).replace('.',',')); };
  if(Array.isArray(v)) v.forEach(put); else if(typeof v==='number') put(v); return L; };

function sourceCheck(E){ const fail=[], info=[], {out,skip}=sources(); skip.forEach(s=>info.push('docs/gost: '+s));
  const ids=Object.keys(E.N); let ok=0, can=0, miss=[], wait=0;
  ids.forEach(id=>{ const o=E.N[id]; if(o.d==='МУ') return; const txt=out[o.d];
    if(!txt){ if(o.ver==='text') fail.push('Реестр ЕСКД · '+id+' помечена «сверено с текстом», а текста '+E.DOC[o.d].n+' в docs/gost нет'); else wait++; return; }
    const T=norm(txt), q=norm(o.q), found=T.includes(q);
    if(o.ver==='text'){ if(!found) fail.push('Реестр ЕСКД · '+id+': цитаты нет в тексте '+E.DOC[o.d].n+' — «'+o.q+'»');
      else { const lost=numsOf(o).filter(n=>!q.includes(n)); if(lost.length) fail.push('Реестр ЕСКД · '+id+': в цитате нет чисел нормы '+lost.join(', ')); else ok++; } }
    else if(found) can++; else miss.push(id); });
  const have=Object.keys(out).sort();
  info.push('Реестр ЕСКД: текстов стандартов в docs/gost — '+(have.length?have.join(', '):'нет')+'; норм сверено с текстом — '+ok+', найдено в тексте, можно отметить «text» — '+can+', не найдено — '+miss.length+(miss.length?' ('+miss.join(', ')+')':'')+', ждут текста стандарта — '+wait);
  return {fail,info}; }

function integrity(E){ const fail=[], VER=['text','web','mem'];
  Object.entries(E.N).forEach(([id,o])=>{ const w='Реестр ЕСКД · '+id+': ';
    if(!E.DOC[o.d]) fail.push(w+'нет стандарта «'+o.d+'» в ESKD.DOC');
    if(o.d!=='МУ'&&!o.p) fail.push(w+'нет пункта стандарта');
    if(!o.q) fail.push(w+'нет цитаты (q)'); if(!VER.includes(o.ver)) fail.push(w+'статус сверки ver — один из '+VER.join(', '));
    if(!o.wh&&Array.isArray(o.v)&&typeof o.v[0]==='number'&&o.v.some((x,i)=>i&&x<o.v[i-1])) fail.push(w+'значения не по возрастанию');
    try{ E.t(id); E.cite(id); }catch(e){ fail.push(w+e.message); } });
  E.LINES.forEach(L=>{ if(!(L.w[0]<=L.w[1])) fail.push('Реестр ЕСКД · линия «'+L.n+'»: толщина'); });
  E.audit().forEach(m=>fail.push('Профиль листа вне ГОСТ: '+m));
  return fail; }

/* ── числа ЕСКД в тексте сайта ── правило: где искать (re — с группами чисел), какая норма, как сравнить */
const R='(\\d+(?:,\\d+)?)\\s*(?:…|\\.\\.\\.|–|—|-|до)\\s*(\\d+(?:,\\d+)?)';
const num=s=>parseFloat(String(s).replace(',','.'));
const CLAIMS=[
 {id:'line.s',re:new RegExp('\\b[sS]\\s*=\\s*'+R+'\\s*мм','g')},
 {id:'axis',re:new RegExp('штрихи\\s+'+R+'(?:\\s*мм)?,\\s*промежутки\\s+'+R,'g'),pair:1},
 {id:'line.open.st',re:new RegExp('[Рр]азомкнут[^.<]{0,60}?штрих\\S*\\s+'+R,'g')},
 {id:'axis.ext',re:new RegExp('за контур[^.<]{0,25}?на\\s+'+R+'\\s*мм','g')},
 {id:'dim.ext',re:new RegExp('[Вв]ыносн\\S*[^.<]{0,60}?(?:на|за стрелк\\S*\\s+на)\\s+'+R+'\\s*мм','g')},
 {id:'dim.contour',re:/(?:ближе|меньше чем на|не ближе)\s+(\d+)\s*мм\s+(?:от|к)\s+контур/g,one:1},
 {id:'hatch.pitch',re:new RegExp('(?:[Шш]аг|[Рр]асстояние между (?:линиями|параллельными))[^.<]{0,30}?\\(?'+R+'\\s*мм','g'),near:/штрих/},
 {id:'axis.small',re:/(?:менее|меньше)\s+(?:Ø\s*)?(\d+)\s*мм[^.<]{0,60}?центров|центров[^.<]{0,80}?(?:менее|меньше)\s+(?:Ø\s*)?(\d+)\s*мм/g,one:1},
 {id:'fmt',re:/А([0-4])\s*(?:—|–|-|:)?\s*(\d{3,4})\s*[×x]\s*(\d{3,4})/g,fmt:1}];
/* какая норма у пары «штрихи…промежутки»: по ближайшему слову перед ней */
const kindBefore=(s,i)=>{ const w=s.slice(Math.max(0,i-160),i), a=Math.max(w.lastIndexOf('штрихпунктир'),w.lastIndexOf('сев'),w.lastIndexOf('центров')), d=Math.max(w.lastIndexOf('Штриховая'),w.lastIndexOf('штриховая'),w.lastIndexOf('штриховой'),w.lastIndexOf('невидим'));
  return a<0&&d<0?null:a>d?'axis':'dash'; };
function textCheck(E,html,mod){ const fail=[]; let n=0;
  /* сам реестр и список изменений (история версий) не проверяем */
  const lines=html.split('\n'), skipTo=mod?html.slice(0,mod.a).split('\n').length-1:-1, skipEnd=mod?html.slice(0,mod.b).split('\n').length:-1;
  const where=i=>'index.html:'+(i+1);
  const eq=(a,b)=>Math.abs(a-b)<1e-6;
  const rng=(id,s)=>E.r(id,s||E.PR.s);
  let inLog=false;
  lines.forEach((L,i)=>{ if(i>=skipTo&&i<skipEnd) return;
    /* список изменений: запись {v:'4.10',d:…,items:[…]} и её продолжения — история, в ней старые числа законны */
    if(/^\s*\{v:'\d+\.\d+',d:'/.test(L)){ inLog=true; return; } if(inLog&&/^\s{3,}'/.test(L)) return; inLog=false;
    CLAIMS.forEach(C=>{ C.re.lastIndex=0; let m; while((m=C.re.exec(L))){ n++;
      const bad=msg=>fail.push('Текст сайта расходится с реестром ЕСКД ('+where(i)+'): «'+m[0].trim()+'» — '+msg);
      if(C.fmt){ const F=E.N.fmt.v['А'+m[1]], a=+m[2], b=+m[3]; if(!F||!(F[0]===Math.min(a,b)&&F[1]===Math.max(a,b))) bad('А'+m[1]+' — '+F.join('×')+' ('+E.cite('fmt')+')'); continue; }
      if(C.one){ const v=+(m[1]||m[2]), want=E.N[C.id].v; if(v!==want) bad('нужно '+E.t(C.id)+' ('+E.cite(C.id)+')'); continue; }
      if(C.near&&!C.near.test(L.slice(Math.max(0,m.index-120),m.index+m[0].length))) { n--; continue; }
      if(C.pair){ const kd=kindBefore(L,m.index); if(!kd){ n--; continue; } const st=rng('line.'+kd+'.st'), gp=rng('line.'+kd+'.gp');
        if(!eq(num(m[1]),st[0])||!eq(num(m[2]),st[1])||!eq(num(m[3]),gp[0])||!eq(num(m[4]),gp[1])) bad((kd==='axis'?'штрихпунктирная':'штриховая')+': штрихи '+E.t('line.'+kd+'.st')+', промежутки '+E.t('line.'+kd+'.gp')+' ('+E.cite('line.'+kd+'.st')+')'); continue; }
      const r=rng(C.id); if(!eq(num(m[1]),r[0])||!eq(num(m[2]),r[1])) bad('нужно '+E.t(C.id)+' ('+E.cite(C.id)+')'); } });
    /* отменённый стандарт: основные надписи — ГОСТ Р 2.104-2023 */
    if(/ГОСТ 2\.104(?!-2006 заменён)/.test(L)&&!/ГОСТ Р 2\.104/.test(L)) fail.push('Текст сайта ('+where(i)+'): «ГОСТ 2.104» — в РФ с 01.03.2024 действует '+E.DOC['2.104'].n); });
  return {fail,n}; }

/* проверка проверки: заведомо неверные формулировки должны ловиться все, верные — ни одна */
const BAD=['Осевые выходят за контур на 3…8 мм.','осевые и центровые (штрихи 5…20, промежутки 3…5 мм)','Штриховая линия: штрихи 2…6 мм, промежутки 1…2 мм.',
 'Выносные линии выходят за размерную на 2…5 мм.','А3 — 297×410','толщина S = 0,6–1,4 мм','Размерную линию не проводят ближе 8 мм от контура.','Разомкнутая линия: штрихи 8…25 мм.',
 'Расстояние между линиями штриховки — 1…12 мм.','центровые линии сплошные, если диаметр менее 10 мм.','основная надпись по ГОСТ 2.104'];
const GOOD=['Осевые выходят за контур на 2…5 мм.','осевые и центровые (штрихи 5…30, промежутки 3…5 мм)','Штриховая линия: штрихи 2…8 мм, промежутки 1…2 мм.',
 'Выносные линии выходят за размерную на 1…5 мм.','А3 — 297×420','толщина S = 0,5–1,4 мм','Размерную линию не проводят ближе 10 мм от контура.','Разомкнутая линия: штрихи 8…20 мм.',
 'Расстояние между линиями штриховки — 1…10 мм.','центровые линии сплошные, если диаметр менее 12 мм.','основная надпись по ГОСТ Р 2.104-2023'];
function selfTest(E){ const run=t=>textCheck(E,t,null).fail.length, fail=[];
  BAD.forEach(t=>{ if(!run(t)) fail.push('Проверка текста ЕСКД пропускает ошибку: «'+t+'»'); });
  GOOD.forEach(t=>{ if(run(t)) fail.push('Проверка текста ЕСКД ругается на верное: «'+t+'»'); });
  return fail; }

function check(){ const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'); const mod=load(html), E=mod.E;
  const fail=integrity(E).concat(selfTest(E)), info=[], S=sourceCheck(E), T=textCheck(E,html,mod);
  const vs={text:0,web:0,mem:0}, mu=Object.values(E.N).filter(o=>o.d==='МУ').length; Object.values(E.N).forEach(o=>vs[o.ver]++);
  info.push('Реестр ЕСКД: норм '+Object.keys(E.N).length+' (из них правил методических указаний — '+mu+'); сверено с текстом стандарта — '+vs.text+', подтверждено открытыми источниками — '+vs.web+', по памяти, ждут текста — '+vs.mem);
  info.push('Текст сайта: проверено чисел ЕСКД — '+T.n+', расхождений — '+T.fail.length+'; проверка проверки — '+BAD.length+' неверных и '+GOOD.length+' верных формулировок');
  return {fail:fail.concat(S.fail,T.fail),info:info.concat(S.info)}; }
module.exports={check,load,norm,textCheck};

if(require.main===module){ const r=check(); r.info.forEach(s=>console.log(s)); r.fail.forEach(s=>console.log('✗ '+s)); console.log(r.fail.length?'\nОшибок: '+r.fail.length:'\nРеестр ЕСКД: ошибок нет'); process.exit(r.fail.length?1:0); }
