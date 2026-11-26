/* ═══════════ Методичка задания — только копия /new/ ═══════════
   Студент пришёл «решить ДЗ №4» → попадает не в готовый ответ, а в методичку задания (#/ng4), где в одно касание
   есть и решение своего варианта (кнопка «Решение · вар. N» всегда видна снизу).

   Адреса:  #/ng4          — методичка (с главы, на которой остановился)
            #/ng4/how      — сразу глава «Алгоритм»      (прежняя страница «Как решать»)
            #/ng4/faq      — сразу глава «Типичные ошибки» (прежняя «Ошибки и защита»)
            #/ng4/m/<глава> — любая глава (task, prep, idea, algo, ex, var, sheet, check, err, def)

   Главы идут так, как идёт работа над заданием: ПОНЯТЬ (задание → что нужно уметь → главная мысль) → РЕШИТЬ (алгоритм своего
   типа → пример → свой вариант → оформление) → СДАТЬ (проверь себя → ошибки → тренировка защиты). Методика — docs/learning-methods.md:
   - пример с решением перед своей задачей (worked example), потом «Решаю сам» с подсказкой на каждом шаге (fading);
   - «Почему так?» в шагах алгоритма закрыто — сначала объясни себе сам (self-explanation);
   - защита — карточки: ответь вслух, потом открой ответ, отметь «знал / не знал» (retrieval practice), незнакомые — ещё раз;
   - шаги алгоритма и список «Проверь себя» отмечаются галочками — рабочий чек-лист, пока чертишь.
   Алгоритм показывается только для типа своего варианта (остальные типы — свёрнуто).

   Хранение — только в браузере: localStorage nch_mk = {ng4:{r:{глава:время}, c:{ключ:1}, q:{№:1|0}, last:'глава'}}.
   Глава «прочитана», когда её конец прокручен на экран. Посещения «Метод» / «Самопроверка» для «Пути к сдаче» — dzSeen. */
(function(){
'use strict';
const KEY='nch_mk';
const load=()=>{ try{ return JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ return {}; } };
function S(id){ const a=load(), o=a[id]||{}; o.r=o.r||{}; o.c=o.c||{}; o.q=o.q||{}; return o; }
function put(id,o){ try{ const a=load(); a[id]=o; localStorage.setItem(KEY,JSON.stringify(a)); }catch(e){} }
const esc=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const plain=h=>String(h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const words=h=>plain(h).split(' ').filter(Boolean).length;
const minOf=h=>Math.max(1,Math.round(words(h)/140));
const plural=(n,a,b,c)=>{ const m=n%10, h=n%100; return n+' '+(m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c); };
const ARR='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
const TOC_IC='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>';
const PH=[['understand','Понять'],['solve','Решить'],['submit','Сдать']];

/* общие правила листа и защиты — те же, что были в «Как оформить и защитить ДЗ» на экране всех ДЗ */
const RULES=[['Лист','Каждая задача — на отдельном листе (обычно А3). Рамка и основная надпись — по ГОСТ 2.301 и 2.104.'],
  ['Построения','Сначала тонко карандашом. Линии построения не стирай: по ним проверяют ход решения.'],
  ['Обводка','Заданное и найденное — сплошной основной линией, построения — сплошной тонкой, невидимое — штриховой (ГОСТ 2.303). Надписи — шрифтом 5 и 3,5 (ГОСТ 2.304).'],
  ['Защита','Объясни каждый шаг: что строишь, зачем и по какой теореме.']];

/* ── контекст задания: мой вариант, его тип и методика этого типа ── */
function ctx(d){
  const types=dzTypesOf(d), m=d.method||{}, T=m.types||{}, n=dzMyN(d), has=!!(n&&DZR.has(d.id,n));
  let type=n?(DZR.typeOf(d.id,n)||null):null;
  if(!type&&types.length===1) type=types[0];
  if(!type){ let pick=''; try{ pick=sessionStorage.getItem('nch_mk_t_'+d.id)||''; }catch(e){} type=types.find(t=>t.code===pick)||null; }
  const x=type&&T[type.code]||(types.length===1?T[types[0].code]:null)||null;
  const P=window.PREP&&PREP.PLANS&&PREP.PLANS[d.id]||null;
  return {d,ng:d.course==='ng',types,m,T,n,has,type,x,P,multi:types.length>1};
}

/* ── главы: {k, ph, t, why, html} — пустые (нечего показать) не выводятся ── */
function chapters(c){
  const {d,m,x,type,P,ng,n,has}=c, L=[];
  /* 1. Задание и что сдать */
  { const ess=m.essence||d.text||'', tt=type&&type.text&&c.multi?type.text:'', sheet=d.sheet||[];
    const given=type&&(type.given||d.given)||d.given||[];
    const html=`${ess?`<p class="mk-lead">${ess}</p>`:''}
      ${tt?`<div class="mk-type"><span>Твой тип · варианты ${type.from}–${type.to}</span><b>${esc(dzTyName(type))}</b><p>${esc(tt)}</p></div>`:''}
      ${given.length?`<p class="mk-given">Дано в таблице варианта: ${given.map(p=>'<b>'+esc(p)+'</b>').join(', ')} — координаты x, y, z, мм.</p>`:''}
      ${sheet.length?`<h3 class="mk-h3">Что должно быть на листе</h3><ul class="mk-ul">${sheet.map(s=>`<li>${s}</li>`).join('')}</ul>`:''}
      ${dzHasSec(d,'cond')&&(d.types||d.text)?`<a class="mk-more" href="${HDZ(d.id,'cond')}">Условия и таблица всех вариантов ${ARR}</a>`:''}`;
    if(plain(html)) L.push({k:'task',ph:'understand',t:'Задание',why:'Сначала — что именно сдать: так видно, к чему идём.',html}); }
  /* 2. Что нужно уметь: навыки подготовки + что повторить */
  { let html='';
    if(P){ const g=PREP.planProg(d.id), nx=P.skills.findIndex((s,i)=>!PREP.stDone(d.id,i));
      html+=`<p>Задание складывается из ${plural(P.skills.length,'навыка','навыков','навыков')}. Каждый — короткий уровень: разбор на маленькой задаче и тест из 6 пар чертежей.</p>
        <ol class="mk-skills">${P.skills.map((s,i)=>{ const ok=PREP.stDone(d.id,i); return `<li class="${ok?'ok':i===nx?'cur':''}"><i aria-hidden="true">${ok?'✓':i+1}</i><span>${esc(s.t)}</span>${i===nx?'<em>следующий</em>':''}</li>`; }).join('')}</ol>
        <div class="mk-prep"><span class="mk-bar"><i style="width:${g.n?Math.round(g.done/g.n*100):0}%"></i></span><small>${g.done} из ${g.n} пройдено</small>
        <a class="mk-btn${g.done===g.n?' ghost':''}" href="#/prep/${d.id}">${g.done===g.n?'Повторить навыки':g.done?'Продолжить подготовку':'Пройти подготовку'} ${ARR}</a></div>`; }
    if(m.theory&&m.theory.length) html+=`<h3 class="mk-h3">Что повторить в теории</h3><ul class="mk-links">${m.theory.map(t=>`<li><a href="${t.h}">${esc(t.t)}</a></li>`).join('')}</ul>`;
    if(html) L.push({k:'prep',ph:'understand',t:'Что нужно уметь',why:'Сначала навыки по отдельности — потом задание целиком. Уже умеешь — листай дальше.',html}); }
  /* 3. Главная мысль */
  { const a=m.idea||'', b=x&&x.idea||'';
    const html=(a?`<div class="mk-key"><span>Запомни</span><p>${a}</p></div>`:'')+(b?`<p class="mk-tidea">${c.multi?`<b>Для твоего типа.</b> `:''}${b}</p>`:'');
    if(html) L.push({k:'idea',ph:'understand',t:'Главная мысль',why:'Одна мысль, на которой держится всё решение.',html}); }
  /* 4. Алгоритм — только своего типа */
  { let html='';
    if(c.multi) html+=typePicker(c);
    if(x&&x.plan){ const st=S(d.id);
      html+=`<p class="mk-hint">Отмечай шаг, когда сделал его на листе. «Почему так?» — сначала ответь себе сам, потом открой.</p>
        <ol class="mk-algo">${x.plan.map((a,i)=>{ const k=type.code+':a'+i, on=!!st.c[k];
          return `<li class="${on?'done':''}"><label class="mk-chk"><input type="checkbox" data-mkc="${esc(k)}"${on?' checked':''}><span class="mk-n" aria-hidden="true">${i+1}</span></label>
          <div class="mk-st"><b>${esc(a.t)}</b><p>${a.d}</p>${a.why?`<details class="mk-why"><summary>Почему так?</summary><p>${a.why}</p></details>`:''}</div></li>`; }).join('')}</ol>
        ${x.answer?`<div class="mk-ans"><b>Что в ответе</b><p>${x.answer}</p></div>`:''}`;
      const other=c.types.filter(t=>t!==type&&c.T[t.code]&&c.T[t.code].plan);
      if(other.length&&type) html+=`<details class="mk-other"><summary>Алгоритм других типов (${other.length})</summary>${other.map(t=>`<div class="mk-ot"><b>${t.from}–${t.to} · ${esc(dzTyName(t))}</b><ol>${c.T[t.code].plan.map(a=>`<li><b>${esc(a.t)}.</b> ${a.d}</li>`).join('')}</ol></div>`).join('')}</details>`; }
    else if(c.multi&&!type) html+=`<p class="mk-hint">Выбери свой вариант или тип выше — покажем порядок построения именно для него.</p>`;
    else if(m.extra) html+=`<div class="mk-extra">${m.extra}</div>`;
    if(html) L.push({k:'algo',ph:'solve',t:'Алгоритм',why:'Порядок действий для твоего типа варианта — рабочий чек-лист, пока чертишь.',html}); }
  /* 5. Пример по шагам */
  { const code=type&&d.examples&&d.examples[type.code]?type.code:null; let html='';
    if(code) html=`<p>Посмотри, как решается похожий вариант твоего типа, — от условия до ответа, по шагам. Потом свой будет решаться заметно легче.</p>
      <a class="mk-card" href="${HDZ(d.id,'ex',code)}"><span class="mk-play" aria-hidden="true">▶</span><span><b>Пример: ${esc(dzTyName(type))}</b><small>разбор по шагам · можно листать назад</small></span>${ARR}</a>`;
    else if(d.examples&&!type) html=`<p>У каждого типа варианта есть пример с разбором по шагам.</p><a class="mk-card" href="${HDZ(d.id,'ex')}"><span class="mk-play" aria-hidden="true">▶</span><span><b>Примеры по типам</b><small>выбери свой тип</small></span>${ARR}</a>`;
    else if(!ng&&d.learn) html=`<p>Тот же ход решения — на одном варианте, по шагам, с 3D-моделью.</p><a class="mk-card" href="#/ig/learn"><span class="mk-play" aria-hidden="true">▶</span><span><b>Виды и разрезы по шагам</b><small>«Учиться с нуля»</small></span>${ARR}</a>`;
    if(dzHasSec(d,'3d')) html+=`<a class="mk-card" href="${HDZ(d.id,'3d')}"><span class="mk-play" aria-hidden="true">3D</span><span><b>Все тела в 3D</b><small>крути модель своего варианта, смотри «спереди» и «сверху»</small></span>${ARR}</a>`;
    if(html) L.push({k:'ex',ph:'solve',t:'Пример',why:'Готовый пример похожего варианта: как это выглядит целиком.',html}); }
  /* 6. Свой вариант */
  { let html='';
    if(has){ html=`<p>${ng?'Перерисуй условие в тетрадь и строй сам: на каждом шаге сначала подумай, потом открой подсказку. Застрял — переключись на «Смотрю».':'Модель детали в 3D, построение видов по шагам и готовый лист — сверяй со своим.'}</p>
      <div class="mk-two">${ng?`<a class="mk-btn" href="${HDZ(d.id,n)}" data-mkgo="try"><span><b>Решаю сам</b><small>подсказка на каждом шаге</small></span>${ARR}</a>`:''}
        <a class="mk-btn${ng?' ghost':''}" href="${HDZ(d.id,n)}" data-mkgo="watch"><span><b>${ng?'Смотреть решение':'Разбор варианта '+n}</b><small>${ng?'вариант '+n+' по шагам':'3D, виды по шагам, лист'}</small></span>${ARR}</a></div>
      ${ng?`<div class="mk-chips"><a href="${HDZ(d.id,n,'draft')}">Черновик листа</a><a href="${HDZ(d.id,n,'list')}">Чистовик листа</a>${d.id==='ng3'?`<a href="${HDZ(d.id,n,'sheet')}">Как на листе</a>`:''}</div>`:''}`; }
    else if(n) html=`<p>Вариант ${n}: разбор этого типа ещё готовится. Пока — алгоритм выше${d.examples?' и пример по шагам':''}.</p>`;
    else html=`<p>Выбери номер своего варианта — он запомнится для всех ДЗ, а методичка покажет алгоритм именно твоего типа.</p>${numsHTML(d)}`;
    L.push({k:'var',ph:'solve',t:'Твой вариант',why:'Сначала попробуй сам — так навык остаётся, а не только картинка.',html}); }
  /* 7. Оформление листа */
  { const sh=m.sheet||[];
    const html=(sh.length?`<ul class="mk-ul">${sh.map(s=>`<li>${s}</li>`).join('')}</ul>`:'')+`<div class="mk-rules">${RULES.map(([a,b])=>`<div><b>${a}</b><p>${b}</p></div>`).join('')}</div>`
      +(!ng?`<a class="mk-more" href="#/ig/theory">Теория ЕСКД: форматы, линии, размеры ${ARR}</a>`:'');
    L.push({k:'sheet',ph:'solve',t:'Оформление листа',why:'Как оформить лист по ГОСТ, чтобы не вернули на нормоконтроле.',html}); }
  /* 8. Проверь себя */
  { const st=S(d.id), ck=(x&&x.check||[]).concat(m.check||[]); let html='';
    if(ck.length) html+=`<p class="mk-hint">Пройди по списку до сдачи. Отмеченное запомнится.</p><ul class="mk-cl">${ck.map((s,i)=>{ const k=(type?type.code:'all')+':c'+i, on=!!st.c[k];
      return `<li class="${on?'done':''}"><label><input type="checkbox" data-mkc="${esc(k)}"${on?' checked':''}><span>${s}</span></label></li>`; }).join('')}</ul>`;
    const tools=[]; if(dzChecks(d).length) tools.push([HDZ(d.id,'my'),'Сверить ответы','впиши свои числа — сайт сверит с условием']);
    if(!ng) tools.push(['#/ig/nk','Нормоконтроль листа','проверка листа по ГОСТ: линии, штриховка, размеры']);
    if(has&&ng) tools.push([HDZ(d.id,n,'list'),'Сравнить с чистовиком','положи свой лист рядом с чистовиком варианта '+n]);
    if(tools.length) html+=tools.map(([h,t,s])=>`<a class="mk-card" href="${h}"><span class="mk-play" aria-hidden="true">✓</span><span><b>${t}</b><small>${s}</small></span>${ARR}</a>`).join('');
    if(html) L.push({k:'check',ph:'submit',t:'Проверь себя',why:'Список того, что проверяют у всех. Свои ошибки дешевле найти самому.',html}); }
  /* 9. Типичные ошибки */
  { const a=(m.mistakes||[]).concat(x&&x.mistakes||[]);
    if(a.length) L.push({k:'err',ph:'submit',t:'Типичные ошибки',why:'Где ошибаются чаще всего — проверь у себя именно эти места.',html:`<ul class="mk-err">${a.map(s=>`<li>${s}</li>`).join('')}</ul>`}); }
  /* 10. Защита — карточки */
  { const q=defOf(c);
    if(q.length) L.push({k:'def',ph:'submit',t:'Защита',why:'Ответь вслух, потом открой ответ. Так запоминается в разы лучше, чем перечитывать.',html:defHTML(c,q)}); }
  return L;
}
function defOf(c){ return (c.m.defense||[]).concat(c.x&&c.x.defense||[]); }

function typePicker(c){ if(c.n&&c.type) return `<div class="mk-type"><span>Вариант ${c.n} · тип ${c.type.from}–${c.type.to}</span><b>${esc(dzTyName(c.type))}</b></div>`;
  return `<div class="mk-tp" role="radiogroup" aria-label="Тип варианта"><span>Твой тип — выбери, или впиши вариант выше</span>${c.types.map(t=>`<button type="button" role="radio" data-mkt="${esc(t.code)}" aria-checked="${t===c.type}" class="${t===c.type?'on':''}">${t.from}–${t.to}<small>${esc(dzTyName(t))}</small></button>`).join('')}</div>`; }
function numsHTML(d){ const N=dzCount(d);
  return `<div class="mk-nums" role="group" aria-label="Номер варианта">${Array.from({length:N},(_,i)=>i+1).map(k=>`<button type="button" data-mkv="${k}"${DZR.has(d.id,k)?'':' class="off" title="разбор этого типа готовится"'}>${k}</button>`).join('')}</div>
    ${d.course==='ig'&&DZR.numbers?`<details class="mk-pics"><summary>Не помнишь номер — найди по картинке</summary><div class="mk-pg">${DZR.numbers(d.id).map(k=>`<button type="button" data-mkv="${k}"><img alt="" loading="lazy" decoding="async" src="${dzThumb(d,k)}"><b>${k}</b></button>`).join('')}</div></details>`:''}`; }

/* защита: по одной карточке; результат каждого вопроса — st.q[i] = 1 знал / 0 не знал */
function defHTML(c,q){ const st=S(c.d.id), known=q.filter((_,i)=>st.q[i]===1).length;
  return `<div class="mk-def" data-n="${q.length}">
    <div class="mk-dsum"><b>${known} из ${q.length}</b> вопросов знаешь${known===q.length?' — к защите готов':''}<span class="mk-dots">${q.map((_,i)=>`<i class="${st.q[i]===1?'y':st.q[i]===0?'n':''}"></i>`).join('')}</span></div>
    <div class="mk-dcard" aria-live="polite"></div>
    <details class="mk-dall"><summary>Все вопросы с ответами</summary>${q.map(x=>`<details><summary>${esc(x.q)}</summary><p>${x.a}</p></details>`).join('')}</details></div>`; }
function defBind(root,c){ const box=root.querySelector('.mk-def'); if(!box) return; const q=defOf(c), id=c.d.id;
  let order=[], i=0;
  const queue=()=>{ const st=S(id); const un=q.map((_,k)=>k).filter(k=>st.q[k]!==1); return un.length?un:q.map((_,k)=>k); };
  const sum=()=>{ const st=S(id), known=q.filter((_,k)=>st.q[k]===1).length;
    box.querySelector('.mk-dsum').innerHTML=`<b>${known} из ${q.length}</b> вопросов знаешь${known===q.length?' — к защите готов':''}<span class="mk-dots">${q.map((_,k)=>`<i class="${st.q[k]===1?'y':st.q[k]===0?'n':''}"></i>`).join('')}</span>`; };
  const card=()=>{ const el=box.querySelector('.mk-dcard');
    if(i>=order.length){ const st=S(id), left=q.filter((_,k)=>st.q[k]!==1).length;
      el.innerHTML=`<div class="mk-dq end"><b>${left?'Круг пройден':'Все вопросы знаешь'}</b><p>${left?'Незнакомых осталось: '+left+'. Повтори их ещё раз — сегодня и завтра, так ответы закрепятся.':'Перед защитой пройди ещё раз — за день до сдачи.'}</p>
        <button type="button" class="mk-btn" data-mkd="again">${left?'Повторить незнакомые':'Пройти заново'}</button></div>`; return; }
    const k=order[i], x=q[k];
    el.innerHTML=`<div class="mk-dq"><span class="mk-dk">Вопрос ${i+1} из ${order.length}</span><b>${esc(x.q)}</b>
      <div class="mk-da" hidden><p>${x.a}</p><span class="mk-dk">Ты ответил так же?</span><div class="mk-dyn"><button type="button" data-mkd="no">Не знал</button><button type="button" data-mkd="yes">Знал</button></div></div>
      <button type="button" class="mk-btn ghost" data-mkd="show">Ответил вслух — показать ответ</button></div>`; };
  order=queue(); card();
  box.addEventListener('click',e=>{ const b=e.target.closest('[data-mkd]'); if(!b) return; const a=b.dataset.mkd;
    if(a==='show'){ b.hidden=true; box.querySelector('.mk-da').hidden=false; return; }
    if(a==='again'){ if(q.every((_,k)=>S(id).q[k]===1)){ const st=S(id); st.q={}; put(id,st); sum(); } order=queue(); i=0; card(); return; }
    const st=S(id); st.q[order[i]]=a==='yes'?1:0; put(id,st); try{ FX.buzz(a==='yes'?'success':'light'); }catch(_){ }
    i++; sum(); card(); }); }

/* ── экран ── */
let IO=null;
function view(v,d,focus){
  if(IO){ try{ IO.disconnect(); }catch(e){} IO=null; }
  const c=ctx(d), L=chapters(c), st=S(d.id), due=dzDue(d), ig=!c.ng;
  const read=k=>!!st.r[k], nRead=L.filter(x=>read(x.k)).length, first=L.find(x=>!read(x.k))||L[0];
  const total=L.reduce((s,x)=>s+minOf(x.html),0);
  const goSol=c.has?`<a class="mk-sol" href="${HDZ(d.id,c.n)}" data-mkgo="watch"><span><small>Сразу решение</small><b>Вариант ${c.n}</b></span>${ARR}</a>`
    :`<button type="button" class="mk-sol" data-mkpick><span><small>Решение</small><b>Выбрать вариант</b></span>${ARR}</button>`;
  const toc=`<nav class="mk-toc" aria-label="Содержание методички">${PH.map(([p,pt])=>{ const xs=L.filter(x=>x.ph===p); if(!xs.length) return '';
      return `<div class="mk-tp-ph"><span>${pt}</span><ol>${xs.map(x=>{ const i=L.indexOf(x); return `<li><a href="#" data-mkto="${x.k}" class="${read(x.k)?'ok':''}"><i aria-hidden="true">${read(x.k)?'✓':i+1}</i><span>${x.t}</span></a></li>`; }).join('')}</ol></div>`; }).join('')}</nav>`;
  const varRow=c.n?`<div class="mk-var"><span class="mk-vn"><small>Твой вариант</small><b>${c.n}</b></span><span class="mk-vt">${c.type&&c.multi?`тип «${esc(dzTyName(c.type))}»<br>`:''}${c.has?'методичка — под твой тип':'разбор этого типа готовится'}</span><button type="button" class="mk-vch" data-mkchange>Сменить</button></div>`
    :`<div class="mk-var no"><span class="mk-vt"><b>Вариант не выбран.</b> Выбери — методичка покажет твой тип, решение откроется в одно касание.</span><button type="button" class="mk-vch" data-mkpick>Выбрать</button></div>`;
  v.innerHTML=pageHTML({crumbs:null,next:null,noBottom:true,cls:'dzx mk'+(ig?' igx':''),body:`
    <div class="mk-top">${dzBackHTML('#/dz/'+d.course)}${dzShareHTML(HDZ(d.id),d.label+' — методичка: алгоритм, пример, разбор своего варианта')}</div>
    <div class="mk-hd"><div class="mk-k">Методичка · ${dzCourse(d.course)} · ${esc(d.label)}${d.beta?'<i class="dzc-beta">бета</i>':''}</div>
      <h1>${esc(d.title)}</h1>
      <div class="dzc-meta">${due?`<span class="dzc-due ${due.st}">${due.st==='past'?'Срок был':'Сдать до'} ${due.txt}</span><span>${due.left>=0?(due.left===0?'сегодня':'через '+due.left+' дн.'):'неделя '+due.w}</span>`:''}<span>${plural(L.length,'глава','главы','глав')} · ≈ ${total} мин</span></div></div>
    ${varRow}
    <div class="mk-pickbox" hidden>${numsHTML(d)}</div>
    <div class="mk-doors">
      <a class="mk-door a" href="#" data-mkto="${first.k}"><span class="mk-dt">${nRead?'Продолжить методичку':'Разобраться по методичке'}</span><span class="mk-ds">${nRead?`прочитано ${nRead} из ${L.length} · дальше «${first.t}»`:'понять → решить → сдать, по главам'}</span><span class="mk-darr">${ARR}</span></a>
      ${c.has?`<a class="mk-door b" href="${HDZ(d.id,c.n)}" data-mkgo="watch"><span class="mk-dt">Сразу решение</span><span class="mk-ds">вариант ${c.n} · ${c.ng?'разбор по шагам и лист':'3D, виды по шагам, лист'}</span><span class="mk-darr">${ARR}</span></a>`
        :`<button type="button" class="mk-door b" data-mkpick><span class="mk-dt">Сразу решение</span><span class="mk-ds">сначала выбери номер варианта</span><span class="mk-darr">${ARR}</span></button>`}
    </div>
    ${d.beta?dzBetaNote():''}
    <div class="mk-grid">
      <aside class="mk-side"><div class="mk-sidein"><div class="mk-prog"><span class="mk-bar"><i style="width:${Math.round(nRead/L.length*100)}%"></i></span><small>Прочитано ${nRead} из ${L.length}</small></div>${toc}${goSol}</div></aside>
      <div class="mk-body">
        <details class="mk-tocm" open><summary>Содержание · прочитано ${nRead} из ${L.length}</summary>${toc}</details>
        ${L.map((x,i)=>`<section class="mk-ch${read(x.k)?' read':''}" id="mk-${x.k}" data-k="${x.k}" aria-labelledby="mkh-${x.k}">
          <div class="mk-chh"><span class="mk-cn" aria-hidden="true">${read(x.k)?'✓':i+1}</span><div><h2 id="mkh-${x.k}">${x.t}</h2><small>${x.why} · ${minOf(x.html)} мин</small></div></div>
          <div class="mk-cb">${x.html}</div><i class="mk-end" aria-hidden="true"></i></section>`).join('')}
        <div class="mk-fin">${nRead===L.length?'<b>Методичка пройдена.</b> Перед защитой — ещё раз карточки «Защита» за день до сдачи.':'<b>Это вся методичка.</b> Что не понял — спроси автора: ответ придёт лично.'}<div><a href="#/ask">Спросить автора</a><a href="#/method">Как мы учим</a></div></div>
      </div>
    </div>
    <div class="mk-dock" role="region" aria-label="Методичка: навигация">
      <button type="button" class="mk-dtoc" data-mktoc aria-expanded="false">${TOC_IC}<span><small>Глава <em class="mk-ci">1</em> из ${L.length}</small><b class="mk-ct">${L[0].t}</b></span></button>
      ${goSol}
    </div>
    <div class="mk-sheet" hidden><div class="mk-sheet-bg" data-mktoc></div><div class="mk-sheet-p" role="dialog" aria-label="Содержание"><b>Содержание</b>${toc}</div></div>`});
  bind(v,c,L);
  setLast({s:d.course,kind:'dz',id:d.id+'/m',href:HDZ(d.id),label:d.label+' · методичка',sub:dzCourse(d.course)+' · ДЗ'});
  const f=focus&&L.find(x=>x.k===focus);
  /* роутер сам прокручивает наверх (через два кадра, при переходе — позже); глава — после него */
  if(f&&!(typeof SCR!=='undefined'&&SCR[location.hash]!=null)){   /* бывал на этом адресе — роутер вернёт, где был */ let touched=false; const stop=()=>{ touched=true; }; ['wheel','touchstart','keydown'].forEach(t=>addEventListener(t,stop,{once:true,passive:true}));
    [100,400,900].forEach(ms=>setTimeout(()=>{ const el=v.querySelector('#mk-'+f.k); if(!touched&&el&&Math.abs(el.getBoundingClientRect().top-(innerWidth>=1080?84:12))>40) to(v,f.k,false); },ms)); }
  return d.label+' · методичка'; }

function to(v,k,smooth){ const el=v.querySelector('#mk-'+k); if(!el) return; const y=el.getBoundingClientRect().top+scrollY-(innerWidth>=1080?84:12);
  try{ scrollTo({top:y,behavior:smooth===false?'auto':'smooth'}); }catch(e){ scrollTo(0,y); } }

function bind(v,c,L){
  const d=c.d, id=d.id;
  const skip=()=>{ try{ window.PREP&&PREP.skipGate&&PREP.skipGate(id); }catch(e){} };
  const setMode=m=>{ if(!c.ng) return; try{ const o=JSON.parse(localStorage.getItem('nch_dzmode')||'{}')||{}; o[id]=m; localStorage.setItem('nch_dzmode',JSON.stringify(o)); }catch(e){} };
  const sheet=v.querySelector('.mk-sheet'), dt=v.querySelector('.mk-dtoc');
  const tocOpen=on=>{ sheet.hidden=!on; dt.setAttribute('aria-expanded',String(on)); document.documentElement.classList.toggle('mk-lock',on); };
  v.addEventListener('click',e=>{
    const t=e.target.closest('[data-mkto]'); if(t){ e.preventDefault(); tocOpen(false); to(v,t.dataset.mkto); return; }
    if(e.target.closest('[data-mktoc]')){ tocOpen(sheet.hidden); return; }
    const g=e.target.closest('[data-mkgo]'); if(g){ skip(); setMode(g.dataset.mkgo); try{ TRACK&&TRACK('mk_go',{task:id,mode:g.dataset.mkgo}); }catch(_){ } return; }
    if(e.target.closest('[data-mkpick],[data-mkchange]')){ const box=v.querySelector('.mk-pickbox'); box.hidden=!box.hidden;
      if(!box.hidden){ const y=box.getBoundingClientRect().top+scrollY-90; try{ scrollTo({top:y,behavior:'smooth'}); }catch(_){ } } return; }
    const nb=e.target.closest('[data-mkv]'); if(nb){ const n=+nb.dataset.mkv; dzSetVar(n); try{ FX.buzz('tick'); FX.note('Вариант '+n+' запомнен для всех ДЗ'); }catch(_){ } view(v,d,null); scrollTo(0,0); return; }
    const tb=e.target.closest('[data-mkt]'); if(tb&&!tb.disabled){ try{ sessionStorage.setItem('nch_mk_t_'+id,tb.dataset.mkt); }catch(_){ } const y=scrollY; view(v,d,null); scrollTo(0,y); return; }
  });
  v.addEventListener('change',e=>{ const cb=e.target.closest('[data-mkc]'); if(!cb) return; const st=S(id); if(cb.checked) st.c[cb.dataset.mkc]=1; else delete st.c[cb.dataset.mkc]; put(id,st);
    const li=cb.closest('li'); if(li) li.classList.toggle('done',cb.checked); try{ FX.buzz('tick'); }catch(_){ } });
  document.addEventListener('keydown',function esc(e){ if(!document.body.contains(sheet)){ document.removeEventListener('keydown',esc); return; } if(e.key==='Escape'&&!sheet.hidden) tocOpen(false); });
  defBind(v,c);
  /* прочитано: конец главы показался на экране */
  const mark=k=>{ const st=S(id); if(st.r[k]) return; st.r[k]=Date.now(); put(id,st);
    if(k==='algo') dzSeen(id,'how'); if(k==='err'||k==='def'||k==='check') dzSeen(id,'faq');
    const sec=v.querySelector('#mk-'+k); if(sec){ sec.classList.add('read'); const cn=sec.querySelector('.mk-cn'); if(cn) cn.textContent='✓'; }
    v.querySelectorAll('[data-mkto="'+k+'"]').forEach(a=>{ if(!a.closest('.mk-doors')){ a.classList.add('ok'); const i=a.querySelector('i'); if(i) i.textContent='✓'; } });
    const n=L.filter(x=>S(id).r[x.k]).length;
    v.querySelectorAll('.mk-prog .mk-bar i').forEach(i=>i.style.width=Math.round(n/L.length*100)+'%');
    v.querySelectorAll('.mk-prog small').forEach(s=>s.textContent='Прочитано '+n+' из '+L.length);
    const sm=v.querySelector('.mk-tocm summary'); if(sm) sm.textContent='Содержание · прочитано '+n+' из '+L.length; };
  if('IntersectionObserver' in window){ IO=new IntersectionObserver(es=>es.forEach(en=>{ if(en.isIntersecting){ const s=en.target.closest('.mk-ch'); if(s&&s.getBoundingClientRect().height>40) mark(s.dataset.k); } }),{rootMargin:'0px 0px -60px 0px'});
    v.querySelectorAll('.mk-end').forEach(e=>IO.observe(e)); }
  /* текущая глава — в нижней панели; панель появляется, когда двери прокручены */
  const secs=[...v.querySelectorAll('.mk-ch')], dock=v.querySelector('.mk-dock'), doors=v.querySelector('.mk-doors');
  let raf=0; const upd=()=>{ raf=0; if(!document.body.contains(dock)){ removeEventListener('scroll',onS); return; }
    const lim=innerHeight*.4; let cur=0; secs.forEach((s,i)=>{ if(s.getBoundingClientRect().top<lim) cur=i; });
    dock.querySelector('.mk-ci').textContent=cur+1; dock.querySelector('.mk-ct').textContent=L[cur].t;
    v.querySelectorAll('.mk-toc [data-mkto]').forEach(a=>a.classList.toggle('cur',a.dataset.mkto===L[cur].k));
    dock.classList.toggle('on',doors.getBoundingClientRect().bottom<0);
    const st=S(id); if(st.last!==L[cur].k&&doors.getBoundingClientRect().bottom<0){ st.last=L[cur].k; put(id,st); } };
  const onS=()=>{ if(!raf) raf=requestAnimationFrame(upd); };
  addEventListener('scroll',onS,{passive:true}); upd();
}

/* ── список ДЗ предмета (экран «ДЗ · Начерт», главная предмета): ДЗ по сроку → методичка; решение — сбоку ── */
function progOf(d){ const st=S(d.id), c=ctx(d), L=chapters(c); return {r:L.filter(x=>st.r[x.k]).length,n:L.length}; }
function dzList(cr){ const L=DZR.list(cr); if(!L.length) return ''; const v=dzVar();
  const due=L.map(d=>({d,due:dzDue(d)})), nx=due.filter(x=>x.due&&x.due.left>=0).sort((a,b)=>a.due.left-b.due.left)[0];
  return `<section class="mkl" data-c="${cr}" aria-label="ДЗ · ${dzCourse(cr)}">
    <div class="mkl-hd"><div><span class="mkl-k">ДЗ · ${dzCourse(cr)}</span><h2>Выбери задание</h2></div>
      <button type="button" class="mkl-v${v?'':' no'}" data-mklv>${v?'<small>Мой вариант</small><b>'+v+'</b>':'<small>Вариант</small><b>?</b>'}</button></div>
    <div class="mkl-pick" hidden><p>Номер варианта — один на все ДЗ:</p><div class="mk-nums">${Array.from({length:30},(_,i)=>i+1).map(k=>`<button type="button" data-mklset="${k}"${k===v?' aria-pressed="true"':''}>${k}</button>`).join('')}</div></div>
    <p class="mkl-note">Каждое ДЗ открывается методичкой: что сдать, алгоритм твоего типа, пример, проверка и защита. Решение своего варианта — кнопкой справа.</p>
    <ul class="mkl-list">${due.map(({d,due:u})=>{ const p=progOf(d), n=dzMyN(d), has=n&&DZR.has(d.id,n), now=nx&&nx.d===d;
      return `<li class="${now?'now':''}${u&&u.st==='past'?' past':''}"><a class="mkl-main" href="${HDZ(d.id)}"><span class="mkl-no">${d.num}</span><span class="mkl-t"><b>${esc(d.title)}${now?'<em>Сейчас</em>':''}</b>
        <small>${u?(u.st==='past'?'срок был '+u.txt:'сдать до '+u.txt+(u.left===0?' · сегодня':' · через '+u.left+' дн.')):''}${p.r?' · методичка '+p.r+'/'+p.n:''}</small></span></a>
        ${has?`<a class="mkl-sol" href="${HDZ(d.id,n)}" data-mklsol="${d.id}" aria-label="${esc(d.label)}: решение варианта ${n}"><small>решение</small><b>вар. ${n}</b></a>`:''}</li>`; }).join('')}</ul></section>`; }
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-mklv]'); if(b){ const s=b.closest('.mkl'), p=s&&s.querySelector('.mkl-pick'); if(p) p.hidden=!p.hidden; return; }
  const k=e.target.closest&&e.target.closest('[data-mklset]'); if(k){ dzSetVar(+k.dataset.mklset); try{ FX.buzz('tick'); }catch(_){ } document.querySelectorAll('.mkl').forEach(s=>{ s.outerHTML=dzList(s.dataset.c); }); return; }
  /* «Решение» со списка, главной, колоды: подготовку уже предложили, режим — «Смотрю» */
  const so=e.target.closest&&e.target.closest('[data-mklsol]'); if(so){ const id=so.dataset.mklsol; try{ window.PREP&&PREP.skipGate&&PREP.skipGate(id); }catch(_){ }
    if(/^ng/.test(id)) try{ const o=JSON.parse(localStorage.getItem('nch_dzmode')||'{}')||{}; o[id]='watch'; localStorage.setItem('nch_dzmode',JSON.stringify(o)); }catch(_){ } }
});

/* ── главная: «Сдаётся скоро» — ближайшее ДЗ каждого предмета: методичка и решение ── */
function homeNow(){ if(!window.DZR) return '';
  const rows=['ng','ig'].map(cr=>DZR.list(cr).map(d=>({d,u:dzDue(d)})).filter(x=>x.u&&x.u.left>=0).sort((a,b)=>a.u.left-b.u.left)[0]).filter(Boolean);
  if(!rows.length) return '';
  return `<section class="mkh" aria-label="Сдаётся скоро"><h2 class="mkh-h">Сдаётся скоро</h2>${rows.map(({d,u})=>{ const n=dzMyN(d), has=n&&DZR.has(d.id,n), p=progOf(d), last=S(d.id).last;
    return `<div class="mkh-c ${d.course}"><a class="mkh-main" href="${HDZ(d.id)}"><span class="mkh-k">${dzCourse(d.course)} · ${esc(d.label)} · <span class="${u.st}">${u.left===0?'сегодня':'через '+u.left+' дн.'}</span></span>
      <b>${esc(d.title)}</b><span class="mkh-p"><span class="mk-bar"><i style="width:${p.n?Math.round(p.r/p.n*100):0}%"></i></span><small>${p.r?'методичка '+p.r+' из '+p.n+(last?' · продолжить':''):'методичка · '+plural(p.n,'глава','главы','глав')}</small></span></a>
      <div class="mkh-a"><a class="mkh-b" href="${HDZ(d.id)}">${p.r?'Продолжить':'Методичка'}</a>${has?`<a class="mkh-b2" href="${HDZ(d.id,n)}" data-mklsol="${d.id}">Решение · вар. ${n}</a>`:`<a class="mkh-b2" href="${HDZ(d.id,'m','var')}">Выбрать вариант</a>`}</div></div>`; }).join('')}</section>`; }

/* ── колода «ДЗ» (dz/deck.js): раскрытая карточка — методичка первой, решение вторым ── */
window.dzDeckGo=function(d){ const n=dzMyN(d), has=n&&DZR.has(d.id,n), p=progOf(d);
  return `<a class="go" href="${HDZ(d.id)}">${p.r?'Продолжить методичку · '+p.r+'/'+p.n:'Открыть методичку'}</a>`+
    (has?`<a class="go2" href="${HDZ(d.id,n)}" data-mklsol="${d.id}">Сразу решение · вариант ${n}</a>`:''); };

/* ── плашка в разборе варианта: связь с методичкой (алгоритм своего типа, защита) ── */
function strip(d,n){ if(!d.method) return ''; const c=ctx(d), ty=n&&DZR.typeOf(d.id,n)||c.type, x=ty&&c.T[ty.code]||c.x, steps=x&&x.plan?x.plan.length:0, q=defOf({m:c.m,x}).length;
  const P=window.PREP&&PREP.PLANS&&PREP.PLANS[d.id], g=P?PREP.planProg(d.id):null;
  return `<a class="mks" href="${HDZ(d.id,'how')}"><span class="mks-ic" aria-hidden="true">§</span><span><b>Методичка ${esc(d.label)}</b><small>${steps?'алгоритм — '+plural(steps,'шаг','шага','шагов'):'алгоритм'}${q?' · защита — '+plural(q,'вопрос','вопроса','вопросов'):''}${g?' · подготовка '+g.done+'/'+g.n:''}</small></span>${ARR}</a>`; }

self.METHOD={view,dzList,homeNow,strip,progress:progOf};
})();
