/* ═══ Кабинет Начерта v3: логика экранов ═══
   Профиль (имя, группа, вариант) → сроки ДЗ/РК к дню пары группы, личные плашки, неделя, плитки, линия семестра.
   Хранилище — lk/store.js (LKS). Сайт и кабинет на одном домене: кабинет читает прогресс сайта (nch2_*),
   а вариант, выбранный здесь, сайт подставляет в «Открой свой вариант». Сканер — lk/drawings/ui.js. */
(function(){
'use strict';
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>Array.from((r||document).querySelectorAll(s));

/* ───── План семестра ─────
   [предмет, вид, номер, неделя крайнего срока]; день — по занятию группы (без группы — понедельник). */
const DAY=864e5, W1='2026-08-31', WEEKS=18;   /* понедельник 1-й учебной недели */
const TABLE=[['ikg','dz',1,4],['ikg','rk',1,5],['ikg','m',1,6],['ikg','dz',2,9],['ikg','rk',2,10],['ikg','m',2,11],['ikg','dz',3,14],['ikg','rk',3,15],['ikg','m',3,16],
             ['ng','dz',1,5],['ng','rk',1,6],['ng','m',1,7],['ng','dz',2,10],['ng','rk',2,11],['ng','m',2,12],['ng','dz',3,14],['ng','rk',3,15],['ng','m',3,16]];
const SUBJ={ikg:'ИКГ',ng:'Начерт'}, SUBJ_FULL={ikg:'Инженерная графика',ng:'Начертательная геометрия'};
/* разборы ДЗ на сайте: #/ng1…#/ng5, #/ig2…#/ig4 (+ /вариант); остальное — общий раздел #/dz */
const SITE_DZ={ng:[1,2,3,4,5],ikg:[2,3,4]};
const PREP={
  ng:[{k:'cheat',t:'Шпаргалка',s:'формулы и правила на одном экране',h:'/#/ng/cheat'},
      {k:'q',t:'Вопросы и билет с разбором',s:'теория РК и готовность 0–100',h:'/#/ng/rk2'},
      {k:'path',t:'Повторить темы',s:'уроки по порядку',h:'/#/ng/path'},
      {k:'mock',t:'Пробный РК на время',s:'три задачи билета с секундомером',h:'/#/ng/rk2/mock'}],
  ikg:[{k:'learn',t:'Виды, разрезы, сечения',s:'один вариант по шагам',h:'/#/ig/learn'},
       {k:'points',t:'Защита точек',s:'две недостающие проекции точки',h:'/#/ig/points'},
       {k:'theory',t:'Теория ЕСКД',s:'форматы, линии, размеры, штриховка',h:'/#/ig/theory'},
       {k:'wb',t:'Рабочая тетрадь',s:'тела с отверстиями',h:'/#/ig/wb'}]
};

const MON=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'], MONF=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const WDN=['','пн','вт','ср','чт','пт','сб','вс'], WDF=['','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const p2=n=>(n<10?'0':'')+n;
const toDay=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/DAY); };
const todayDay=()=>{ const x=new Date(); return Math.round(Date.UTC(x.getFullYear(),x.getMonth(),x.getDate())/DAY); };
const wday=d=>((new Date(d*DAY).getUTCDay()+6)%7)+1;
const human=d=>{ const x=new Date(d*DAY); return WDN[wday(d)]+', '+x.getUTCDate()+' '+MON[x.getUTCMonth()]; };
const plural=(n,a,b,c)=>{ const m=n%10,h=n%100; return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c; };
const dWord=n=>plural(n,'день','дня','дней');
const inWords=k=>k<0?(-k)+' '+dWord(-k)+' назад':k===0?'сегодня':k===1?'завтра':k===2?'послезавтра':'через '+k+' '+dWord(k);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nowHM=()=>{ const x=new Date(); return p2(x.getHours())+':'+p2(x.getMinutes()); };
const ico=(id,cls)=>'<svg class="i'+(cls?' '+cls:'')+'"><use href="#i-'+id+'"/></svg>';

let DB=null, P=LKS.profile(), DONE=LKS.get('lk_done',{})||{}, PREPD=LKS.get('lk_prep',{})||{}, FILTER='all', SELD=null;
const group=()=>P.group||'', variant=()=>+P.variant||0;
const gdata=()=>DB&&group()&&DB.groups[group()]||null;
const curWeek=t=>Math.floor((t-toDay(W1))/7)+1;

function events(){
  const g=gdata(), subs=g?['ikg','ng'].filter(k=>g[k]):['ikg','ng'], w1=toDay(W1);
  return TABLE.filter(r=>subs.indexOf(r[0])>=0).map(r=>{
    const start=w1+7*(r[3]-1), cd=g&&g[r[0]]?g[r[0]].day:1, tm=g&&g[r[0]]?g[r[0]].time:'';
    return {id:r[0]+'-'+r[1]+r[2],subj:r[0],kind:r[1],n:r[2],week:r[3],start,date:start+cd-1,time:tm};
  }).sort((a,b)=>a.date-b.date||a.subj.localeCompare(b.subj));
}
const label=e=>(e.kind==='m'?'М':e.kind==='dz'?'ДЗ':'РК')+' '+e.n;
const isPast=(e,t)=>e.date<t||(e.date===t&&!!e.time&&e.time<nowHM());
const dateText=e=>human(e.date)+(e.time?' до '+e.time.replace(/^0/,''):'');
function siteDz(e){ return e.kind==='dz'&&SITE_DZ[e.subj].indexOf(e.n)>=0; }
function linkOf(e){
  if(e.kind==='dz'){ if(!siteDz(e)) return '/#/dz'; return '/#/'+(e.subj==='ikg'?'ig':'ng')+e.n+(variant()?'/'+variant():''); }
  if(e.kind==='rk') return PREP[e.subj][0].h;
  return null;
}
const doneWord=e=>e.kind==='dz'?'сдано':e.kind==='rk'?'написал':'закрыт';
function hintFor(e,d){
  if(e.kind==='rk') return d>=9?'Время есть: начни со шпаргалки и вопросов — увидишь слабые темы.':d>=3?'По 2–3 задачи в день из слабых тем, вперемешку.':d>=1?'Пробный РК на время и лёгкое повторение.':'РК сегодня. Удачи!';
  if(e.kind==='dz') return d>=14?'Прочитай условие и выбери способ решения.':d>=7?'Сделай черновик, потом чистовик.':d>=3?'Чистовик, сверка по ГОСТ и скан листа — найдёт ошибки до сдачи.':'Оставь запас на проверку: отсканируй лист сейчас.';
  return 'Закрой долги по ДЗ и РК до конца недели.';
}
const heat=d=>d<=3?'hot':d<=7?'warm':'calm';
function countHTML(d,e){
  if(d>=2) return '<div class="cnt"><b>'+d+'</b><span>'+dWord(d)+' до '+esc(human(e.date))+'</span></div>';
  return '<div class="cnt word"><b>'+(d===1?'Завтра':'Сегодня')+'</b><span>'+esc(human(e.date))+(e.time?' · до '+esc(e.time.replace(/^0/,'')):'')+'</span></div>';
}
function prepOf(e){ const st=PREP[e.subj], m=PREPD[e.id]||{}, n=st.filter(s=>m[s.k]).length; return {steps:st,m,n,all:st.length,next:st.filter(s=>!m[s.k])[0]||null}; }
const debts=()=>{ const t=todayDay(); return events().filter(e=>e.kind==='dz'&&!DONE[e.id]&&isPast(e,t)); };
function rkUpcoming(){ const t=todayDay(), seen={}; return events().filter(e=>{ if(e.kind!=='rk'||isPast(e,t)||seen[e.subj]) return false; seen[e.subj]=1; return true; }); }
function lessonsOn(g,d){ const w=wday(d), wk=curWeek(d), par=(wk%2?'чс':'зн'); return g?g.lessons.filter(l=>l.day===w&&(!l.par||l.par===par)).sort((a,b)=>a.t<b.t?-1:1):[]; }
function nextLesson(g){
  const t=todayDay(), hm=nowHM();
  for(let i=0;i<14;i++){ const d=t+i; if(wday(d)>6) continue; const ls=lessonsOn(g,d).filter(l=>i>0||l.t>=hm); if(ls.length) return {l:ls[0],date:d,i}; }
  return null;
}
function initials(){ if(P.name) return P.name.trim().charAt(0).toUpperCase(); const g=group().replace(/[^А-ЯA-Z]/g,''); return g.slice(0,2)||'Н'; }

/* ───── картинки плашек ───── */
/* однополостный гиперболоид из прямых — как «Как образуются поверхности» на главной сайта */
let HYP=null;
function hypArt(){ if(HYP) return HYP;
  const N=28, R=58, h=62, tw=1.85, pit=0.36, cp=Math.cos(pit), sp=Math.sin(pit), cx=100, cy=100, f=v=>Math.round(v*10)/10;
  const Pt=(th,z)=>{ const x=R*Math.cos(th), y=R*Math.sin(th); return [cx+x, cy-z*cp+y*sp, y*cp+z*sp]; };
  const L=[]; [1,-1].forEach(sg=>{ for(let i=0;i<N;i++){ const a=2*Math.PI*i/N, A=Pt(a,-h), B=Pt(a+sg*tw,h), dz=(A[2]+B[2])/2/R; L.push({A,B,dz,sg}); } });
  L.sort((p,q)=>p.dz-q.dz);
  const ell=z=>{ const q=[]; for(let k=0;k<=72;k++){ const p=Pt(2*Math.PI*k/72,z); q.push(f(p[0])+','+f(p[1])); } return q.join(' '); };
  const hi=L.filter(l=>l.sg===1).reduce((p,q)=>q.dz>p.dz?q:p);
  HYP='<svg class="p-art" viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="hyG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
    +'<ellipse cx="100" cy="104" rx="88" ry="80" fill="url(#hyG)"/><polyline points="'+ell(-h)+'" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".9"/>'
    +L.map((l,k)=>l===hi?'':'<line x1="'+f(l.A[0])+'" y1="'+f(l.A[1])+'" x2="'+f(l.B[0])+'" y2="'+f(l.B[1])+'" stroke="#fff" stroke-opacity="'+(Math.round((0.2+0.75*(l.dz+1)/2)*100)/100)+'" stroke-width="'+(l.dz>0?1:.7)+'" stroke-linecap="round" pathLength="1" style="--d:'+(k*0.022).toFixed(3)+'s"/>').join('')
    +'<polyline points="'+ell(h)+'" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.1"/>'
    +'<line class="g" x1="'+f(hi.A[0])+'" y1="'+f(hi.A[1])+'" x2="'+f(hi.B[0])+'" y2="'+f(hi.B[1])+'" stroke="#ffd34d" stroke-width="2.6" stroke-linecap="round" pathLength="1"/></svg>';
  return HYP; }
const SCAN_ART='<svg class="p-art" viewBox="0 0 160 190" aria-hidden="true" style="max-width:150px"><g transform="rotate(7 80 95)">'
  +'<rect x="22" y="14" width="116" height="156" rx="10" fill="rgba(255,255,255,.95)"/><path d="M34 92h92" stroke="#9dbbe0" stroke-width="2" stroke-dasharray="5 4"/>'
  +'<path d="M48 76l30-34 30 22zM48 108l30 40 30-30z" fill="none" stroke="#15161a" stroke-width="2.6" stroke-linejoin="round"/>'
  +'<path d="M48 76v32M78 42v106M108 64v54" stroke="#3567b5" stroke-width="1.4" stroke-dasharray="3 3"/><circle cx="78" cy="148" r="3.2" fill="#c9302c"/>'
  +'<g class="beam"><rect x="16" y="24" width="128" height="3" rx="1.5" fill="#00e1ff"/><rect x="16" y="27" width="128" height="22" fill="url(#bm)"/></g>'
  +'<path d="M14 34V20a8 8 0 018-8h14M124 12h14a8 8 0 018 8v14M146 158v14a8 8 0 01-8 8h-14M36 180H22a8 8 0 01-8-8v-14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></g>'
  +'<defs><linearGradient id="bm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00e1ff" stop-opacity=".45"/><stop offset="1" stop-color="#00e1ff" stop-opacity="0"/></linearGradient></defs></svg>';
const FLAME='<svg class="flame" viewBox="0 0 24 24" fill="#fff"><path d="M12 2.5c.5 3.5 5.5 5.5 5.5 11a5.5 5.5 0 01-11 0c0-2 1-3.5 2-4.5.2 1.5.8 2.3 1.8 2.8C10 8 10.5 5 12 2.5z"/></svg>';
function ring(frac,r){ r=r||24; const c=2*Math.PI*r, s=r*2+10; return '<svg class="ring" viewBox="0 0 '+s+' '+s+'" aria-hidden="true" style="transform:rotate(-90deg)"><circle class="rb" cx="'+s/2+'" cy="'+s/2+'" r="'+r+'"/><circle class="rf" cx="'+s/2+'" cy="'+s/2+'" r="'+r+'" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+(c*(1-Math.max(0,Math.min(1,frac)))).toFixed(1)+'"/></svg>'; }

/* ───── прогресс сайта (тот же домен) ───── */
function site(){
  const t=LKS.today(), rep=LKS.get('nch2_rep',{})||{}, ks=Object.keys(rep);
  const due=ks.filter(k=>rep[k]&&rep[k].d<=t).length;
  const done=LKS.get('nch2_done',{})||{}, lessons=Object.keys(done).filter(k=>done[k]).length;
  const ex=(LKS.get('nch2_exams',[])||[]).filter(e=>e&&typeof e.pct==='number');
  let last=LKS.get('nch2_last',null); if(last&&(!last.href||!last.label)) last=null;
  let step=0; try{ const pp=(JSON.parse(localStorage.getItem('plpos')||'{}')||{})[last&&last.href]; if(pp&&pp.k) step=pp.k; }catch(e){}
  let sheets=0; try{ const a=JSON.parse(localStorage.getItem('lk_sheets')||'[]'); sheets=Array.isArray(a)?a.length:0; }catch(e){}
  return {rep:ks.length,due,lessons,ex,last,step,sheets};
}

/* ═══ Приветствие ═══ */
function renderHello(){
  const t=todayDay(), x=new Date(t*DAY), cw=curWeek(t), h=new Date().getHours();
  $('#helloK').textContent=WDF[wday(t)]+', '+x.getUTCDate()+' '+MONF[x.getUTCMonth()]+(cw>=1&&cw<=WEEKS?' · '+cw+'-я неделя':'');
  $('#helloT').textContent=(h<5?'Доброй ночи':h<12?'Доброе утро':h<18?'Добрый день':'Добрый вечер')+(P.name?', '+P.name:'')+'!';
  const ev=events(), ds=debts(), wk=ev.filter(e=>e.week===cw&&!DONE[e.id]&&!isPast(e,t)&&e.kind!=='m'), s=[];
  if(ds.length) s.push('<b>'+ds.length+' '+plural(ds.length,'долг','долга','долгов')+'</b> — отметь, если уже сдал.');
  if(wk.length) s.push('На этой неделе: '+wk.map(e=>'<b>'+label(e)+' · '+SUBJ[e.subj]+'</b>').join(' и ')+'.');
  else { const n=ev.filter(e=>!DONE[e.id]&&!isPast(e,t)&&e.kind!=='m')[0]; s.push(n?'Ближайшее — <b>'+label(n)+' · '+SUBJ[n.subj]+'</b> '+inWords(n.date-t)+'.':'Несданного в семестре нет — красота.'); }
  const st=LKS.streak(); if(st.n>=2) s.push('Ты занимаешься <b>'+st.n+' '+dWord(st.n)+' подряд</b>.');
  if(!group()) s.push('Выбери группу — сроки встанут по твоим парам.');
  $('#helloS').innerHTML=s.join(' ');
  const g=$('#chG'); g.classList.toggle('need',!group()); g.querySelector('span').innerHTML=group()?'<span class="k">Группа</span> '+esc(group()):'Выбрать группу';
  const v=$('#chV'); v.classList.toggle('need',!!group()&&!variant()); v.querySelector('span').innerHTML=variant()?'<span class="k">Вариант</span> '+variant():'Выбрать вариант';
  $('#topAv').textContent=initials();
}

/* ═══ «Горит» ═══ */
function renderHot(){
  const t=todayDay(), ev=events(), box=$('#hot');
  const cand=ev.filter(e=>e.kind==='dz'&&!DONE[e.id]&&!isPast(e,t));
  const e=cand[0]||ev.filter(x=>!DONE[x.id]&&!isPast(x,t)&&x.kind!=='m')[0];
  if(!e){ box.className='plash ok'; box.innerHTML='<div class="p-top"><span class="pill">'+ico('check')+'Всё сдано</span></div><div style="margin-top:auto"><div class="p-t">Чисто!</div><div class="p-s">Несданных заданий в этом семестре нет. Можно повторить темы к экзамену.</div></div><div class="acts"><a class="btn white" href="/#/ng/learn">Тренировка дня →</a></div>'; return; }
  const d=e.date-t, hz=heat(d), same=ev.filter(x=>x.subj===e.subj&&x.kind===e.kind&&x.date<e.date), from=same.length?same[same.length-1].date:toDay(W1);
  const frac=Math.max(0,Math.min(1,(t-from)/Math.max(1,e.date-from))), nxt=ev.filter(x=>x!==e&&!DONE[x.id]&&!isPast(x,t)&&x.kind!=='m')[0], lk=linkOf(e);
  const pill=hz==='hot'?'<span class="pill live"><i></i>Горит</span>':hz==='warm'?'<span class="pill"><i></i>Скоро</span>':'<span class="pill">'+ico('cal')+'По плану</span>';
  const vtxt=e.kind==='dz'&&variant()&&siteDz(e)?' · <b>вариант '+variant()+'</b>':'';
  box.className='plash '+hz; box.setAttribute('aria-label',label(e)+' '+SUBJ_FULL[e.subj]+', '+inWords(d));
  box.innerHTML='<div class="p-top">'+pill+'<span class="p-meta">'+(group()?'Неделя '+e.week+' · '+esc(group()):'<button data-group style="text-decoration:underline;text-underline-offset:3px">дата по пн · выбрать группу</button>')+'</span></div>'
    +'<div class="p-g"><div><div class="p-t">'+label(e)+'</div><div class="p-s">'+SUBJ_FULL[e.subj]+vtxt+'</div></div>'+countHTML(d,e)+'</div>'
    +'<div class="tbar" role="progressbar" aria-label="Прошло времени до срока" aria-valuenow="'+Math.round(frac*100)+'" aria-valuemin="0" aria-valuemax="100"><i data-w="'+Math.round(frac*100)+'%"></i></div>'
    +'<div class="tlbl"><span>прошло '+Math.round(frac*100)+'% времени</span><span>'+(e.time?'сдать до пары':'')+'</span></div>'
    +'<div class="tip">'+esc(hintFor(e,d))+'</div>'
    +'<div class="acts">'+(lk?'<a class="btn white" href="'+lk+'">'+(e.kind==='dz'&&variant()&&siteDz(e)?'Мой вариант':e.kind==='rk'?'Готовиться':'Разбор на сайте')+' →</a>':'')
    +(e.kind==='dz'&&!variant()&&siteDz(e)?'<button class="btn glass" data-variant>'+ico('hash')+'Мой вариант?</button>':'')
    +'<button class="btn glass" data-done="'+e.id+'">'+ico('check')+(e.kind==='rk'?'Написал':'Сдал')+'</button></div>'
    +(nxt?'<div class="after">Следом: <b>'+label(nxt)+' · '+SUBJ[nxt.subj]+'</b> — '+inWords(nxt.date-t)+', '+esc(human(nxt.date))+'</div>':'');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ const i=$('.tbar i',box); if(i) i.style.width=i.getAttribute('data-w'); }));
}
function renderDebt(){
  const ds=debts(), box=$('#debt'), t=todayDay();
  if(!ds.length){ box.hidden=true; box.innerHTML=''; return; }
  const e=ds[ds.length-1]; box.hidden=false;
  box.innerHTML='<div class="row debt"><span class="chk" style="border-color:var(--red-b);color:var(--red)">'+ico('alert')+'</span><div class="m"><b>'+(ds.length>1?ds.length+' ДЗ без отметки':label(e)+' · '+SUBJ[e.subj]+' — срок прошёл')+'</b><small>'
    +(ds.length>1?'Срок прошёл. Уже сдал? Отметь':'Срок был '+inWords(e.date-t)+'. Уже сдал? Отметь')+'</small></div>'
    +(ds.length>1?'<button class="btn red sm" data-tab-go="cal">Отметить</button>':'<button class="btn red sm" data-done="'+e.id+'">Сдал</button>')+'</div>';
}

/* ═══ Синяя: продолжить с места на сайте / сканер ═══ */
function renderCont(){
  const s=site(), box=$('#cont');
  if(s.last){
    const L=s.last, lbl=String(L.label).replace(/^(Тема|Урок|Задача|ДЗ):\s*/,''), href=/^#/.test(L.href)?'/'+L.href:L.href;
    box.innerHTML=hypArt()+'<div class="p-top"><span class="pill">'+ico('play')+'Продолжить</span></div>'
      +'<div style="margin-top:auto"><div class="p-t'+(lbl.length>22?' long':'')+'">'+esc(lbl)+'</div>'+(L.sub?'<div class="p-s">'+esc(L.sub)+'</div>':'')+'</div>'
      +(s.step?'<span class="p-step">'+ico('clock')+'Ты на шаге '+s.step+'</span>':'')
      +'<div class="acts"><a class="btn white" href="'+esc(href)+'">Продолжить →</a><button class="btn glass" data-scan="cam">'+ico('scan')+'Скан</button></div>';
    box.setAttribute('aria-label','Продолжить: '+lbl);
    return;
  }
  box.innerHTML=SCAN_ART+'<div class="p-top"><span class="pill">'+ico('scan')+'Сканер чертежа</span></div>'
    +'<div style="margin-top:auto"><div class="p-t long">Сфоткай лист — получи эпюр и 3D</div><div class="p-s">Копия в мм, ошибки до сдачи, тело по проекциям.</div></div>'
    +'<div class="acts"><button class="btn white" data-scan="cam">'+ico('camera')+'Сканировать</button><button class="btn glass" data-scan="pick">'+ico('image')+'Из галереи</button></div>'
    +'<button class="p-step" data-tab-go="check" id="myCnt" style="cursor:pointer">'+(s.sheets?'Мои чертежи · '+s.sheets:'Мои чертежи и пример')+' →</button>';
  box.setAttribute('aria-label','Сканер чертежа');
}

/* ═══ Неделя ═══ */
function renderWeek(){
  const t=todayDay(), g=gdata(), d0=t-wday(t)+1, cw=curWeek(t), ev=events();
  if(SELD==null||SELD<d0||SELD>d0+6) SELD=t;
  $('#wkS').textContent=(cw>=1&&cw<=WEEKS?cw+'-я неделя · ':'')+(cw%2?'числитель':'знаменатель');
  let h='';
  for(let i=0;i<7;i++){ const d=d0+i, x=new Date(d*DAY), ls=lessonsOn(g,d), es=ev.filter(e=>e.date===d), dots=[];
    if(ls.length) dots.push('l');
    es.forEach(e=>dots.push(DONE[e.id]?'ok':e.kind==='rk'?'r':'d'));
    h+='<button class="day'+(d===t?' today':'')+(d<t?' past':'')+(d===SELD?' sel':'')+'" data-day="'+d+'" aria-label="'+WDF[wday(d)]+', '+x.getUTCDate()+' '+MONF[x.getUTCMonth()]+(ls.length?', есть пара':'')+(es.length?', срок: '+es.map(label).join(', '):'')+'" aria-pressed="'+(d===SELD)+'">'
      +'<small>'+WDN[wday(d)]+'</small><b>'+x.getUTCDate()+'</b><span class="ds">'+dots.slice(0,3).map(c=>'<i class="'+c+'"></i>').join('')+'</span></button>'; }
  $('#days').innerHTML=h;
  const d=SELD, ls=lessonsOn(g,d), es=ev.filter(e=>e.date===d), out=[];
  es.forEach(e=>out.push('<div class="ev"><span class="ic '+(e.kind==='rk'?'r':e.kind==='m'?'m':'d')+'">'+label(e)+'</span><div class="m"><b>'+(e.kind==='m'?'Модуль ':e.kind==='dz'?'Сдать ДЗ ':'Рубежный контроль ')+e.n+' · '+SUBJ[e.subj]+'</b><small>'+(DONE[e.id]?'отмечено — '+doneWord(e):e.time?'до начала пары, '+e.time.replace(/^0/,''):'точный день уточни у преподавателя')+'</small></div>'
    +(e.kind!=='m'?'<button class="chk" data-done="'+e.id+'" aria-pressed="'+!!DONE[e.id]+'" aria-label="'+label(e)+': отметить">'+ico('check')+'</button>':'')+'</div>'));
  ls.forEach(l=>out.push('<div class="ev"><span class="ic l">'+ico('pin')+'</span><div class="m"><b>'+SUBJ_FULL[l.subj]+'</b><small>ауд. '+esc(l.rooms.join(', '))+((l.who&&l.who.length)?' · '+esc(l.who.join('; ')):'')+'</small></div><span class="t">'+esc(l.t.replace(/^0/,''))+'</span></div>'));
  if(!out.length) out.push('<div class="ev none">'+(g?'Пар и сроков нет — свободный день':'Выбери группу — здесь появятся твои пары')+'</div>');
  $('#wkD').innerHTML=out.join('');
}

/* ═══ Плитки ═══ */
function renderBento(){
  const t=todayDay(), s=site(), st=LKS.streak(), rs=rkUpcoming(), out=[];
  /* готовность к ближайшему РК */
  if(rs.length){ const e=rs[0], p=prepOf(e), d=e.date-t;
    out.push('<button class="tile c vio" data-tab-go="rk"><span class="tk">'+ico('target')+label(e)+' · '+SUBJ[e.subj]+'</span><span class="tv">'+Math.round(p.n/p.all*100)+'<small>%</small></span><span class="td">готов · '+inWords(d)+'</span>'+ring(p.n/p.all)+'</button>'); }
  else out.push('<button class="tile c vio" data-tab-go="rk"><span class="tk">'+ico('target')+'РК</span><span class="tv">✓</span><span class="td">РК в семестре позади</span></button>');
  /* повторение задач (сайт: интервальное повторение) */
  out.push('<a class="tile c calm" href="/#/ng/learn"><span class="go">'+ico('chev')+'</span><span class="tk">'+ico('repeat')+'Повторить</span><span class="tv">'+s.due+'</span><span class="td">'+(s.due?plural(s.due,'задача ждёт','задачи ждут','задач ждут')+' — реши по памяти':s.rep?'на сегодня всё · в повторении '+s.rep:'Тренировка дня: задачи возвращаются через 1, 3, 7 дней')+'</span></a>');
  /* серия */
  const bars=[]; for(let i=6;i>=0;i--) bars.push('<i class="'+(st.days[LKS.today()-i]?'on':'')+'"></i>');
  out.push('<div class="tile c warm">'+FLAME+'<span class="tk">'+ico('flame')+'Серия</span><span class="tv">'+st.n+'<small>'+dWord(st.n)+'</small></span><span class="td">'+(st.today?'сегодня засчитано':'зайди на сайт сегодня — не прерывай')+'</span><span class="mini" aria-label="Последние 7 дней">'+bars.join('')+'</span></div>');
  /* пробный РК */
  const ex=s.ex, last=ex[ex.length-1], best=ex.reduce((m,e)=>Math.max(m,e.pct),0);
  out.push('<a class="tile" href="/#/ng/rk2/mock"><span class="go">'+ico('chev')+'</span><span class="tk">'+ico('timer')+'Пробный РК</span>'
    +(last?'<span class="tv">'+last.pct+'<small>%</small></span><span class="td">последний · лучший '+best+'% · попыток '+ex.length+'</span>':'<span class="tv" style="font-size:26px;line-height:1.1">Попробуй</span><span class="td">три задачи билета на время, потом сверка</span>')+'</a>');
  $('#bento').innerHTML=out.join('');
}

/* ═══ Линия семестра ═══ */
function renderSem(){
  const t=todayDay(), w1=toDay(W1), span=WEEKS*7, ev=events(), main=ev.filter(e=>e.kind!=='m');
  const done=main.filter(e=>DONE[e.id]).length, pos=d=>Math.max(0,Math.min(100,(d-w1)/span*100)), now=pos(t+.5), cw=curWeek(t), left=Math.max(0,WEEKS-cw);
  const subs=gdata()?['ikg','ng'].filter(k=>gdata()[k]):['ikg','ng'];
  const track=sj=>'<div class="trk"><b>'+SUBJ[sj]+'</b><div class="tl">'
    +'<span class="fill" style="width:'+now+'%"></span>'
    +ev.filter(e=>e.subj===sj).map(e=>{ const past=isPast(e,t), dn=!!DONE[e.id], debt=past&&!dn&&e.kind==='dz', near=!past&&e.date-t<=10;
      return '<span class="mk '+e.kind+(dn?' done':'')+(debt?' debt':'')+(!past&&!dn?' up':'')+(near?' near':'')+'" style="left:'+pos(e.date)+'%" title="'+label(e)+' · '+SUBJ[e.subj]+' — '+esc(dateText(e))+(dn?' · '+doneWord(e):debt?' · долг':'')+'">'+(e.kind==='m'?'М':e.kind==='dz'?'Д':'Р')+'</span>'; }).join('')
    +'<span class="now" style="left:'+now+'%"></span></div></div>';
  $('#sem').innerHTML='<div class="sem-h"><div><b>'+done+'<small> из '+main.length+' сдано</small></b></div><span>'+(cw<1?'семестр впереди':cw>WEEKS?'семестр позади':'до конца семестра '+left+' '+plural(left,'неделя','недели','недель'))+'</span></div>'
    +'<div style="display:grid;gap:6px">'+subs.map(track).join('')+'</div>'
    +'<div class="trk"><span></span><div class="tl wks">'+[1,5,9,13,17].map(w=>'<span class="wn" style="left:'+pos(w1+(w-1)*7)+'%">'+w+' нед.</span>').join('')+'</div></div>'
    +'<div class="legend"><span><i style="background:var(--red-b)"></i>ДЗ</span><span><i style="background:#8b4dff"></i>РК</span><span><i style="background:var(--navy2)"></i>модуль</span><span><i style="background:var(--green)"></i>сдано</span></div>';
}

function renderLesson(){
  const box=$('#lessonBox'), g=gdata();
  if(!g){ box.innerHTML='<div class="sec" style="margin-top:14px"><h2>Следующая пара</h2></div><button class="card lesson" data-group style="margin-top:14px;width:100%"><div class="tm">'+ico('pin')+'</div><div class="m"><b>Выбери группу</b><div>и здесь будет твоя ближайшая пара: время, аудитория, преподаватель</div></div></button>'; return; }
  const n=nextLesson(g);
  if(!n){ box.innerHTML='<div class="sec" style="margin-top:14px"><h2>Следующая пара</h2></div><div class="card mut" style="margin-top:14px">В ближайшие две недели занятий нет.</div>'; return; }
  const l=n.l, day=n.i===0?'Сегодня':n.i===1?'Завтра':human(n.date), due=events().filter(e=>e.date===n.date&&!DONE[e.id]&&e.kind!=='m'&&e.subj===l.subj);
  box.innerHTML='<div class="sec" style="margin-top:14px"><h2>Следующая пара</h2></div><div class="card lesson" style="margin-top:14px"><div class="tm"><b>'+esc(l.t.replace(/^0/,''))+'</b><small>'+esc(day)+'</small></div><div class="m"><b>'+SUBJ_FULL[l.subj]+'</b>'
    +'<div>ауд. '+esc(l.rooms.join(', '))+(l.par?' · '+(l.par==='чс'?'числитель':'знаменатель'):'')+((l.who&&l.who.length)?' · '+esc(l.who.join('; ')):'')+(l.unsure?' · сверь с расписанием':'')+'</div>'
    +(due.length?'<div style="color:var(--red);font-weight:700;margin-top:6px">Взять: '+due.map(e=>label(e)).join(', ')+'</div>':'')+'</div></div>';
}

/* ═══ Сдачи ═══ */
function row(e,t){
  const past=isPast(e,t), done=!!DONE[e.id], d=e.date-t, debt=past&&!done&&e.kind==='dz', lk=linkOf(e);
  const right=done?doneWord(e):debt?'долг':past?'прошло':inWords(d);
  return '<div class="row k-'+e.kind+(done?' done':debt?' debt':past?' pastx':d<=7?' near':'')+'">'
    +'<button class="chk" data-done="'+e.id+'" aria-pressed="'+done+'" aria-label="'+label(e)+' '+SUBJ[e.subj]+': '+(done?'снять отметку':'отметить — '+doneWord(e))+'">'+ico('check')+'</button>'
    +'<div class="m"><b><span class="kd">'+label(e)+'</span>'+SUBJ[e.subj]+'</b><small>'+esc(dateText(e))+'</small></div>'
    +'<div class="d">'+right+'</div>'
    +(lk?'<a class="go" href="'+lk+'" aria-label="Открыть на сайте: '+label(e)+' '+SUBJ[e.subj]+'">'+ico('chev')+'</a>':'<span class="go"></span>')+'</div>';
}
function wkName(w,cw){ if(w===cw) return 'Эта неделя'; if(w===cw+1) return 'Следующая неделя'; const s=toDay(W1)+7*(w-1), a=new Date(s*DAY), b=new Date((s+6)*DAY);
  return 'Неделя '+w+' · '+a.getUTCDate()+(a.getUTCMonth()!==b.getUTCMonth()?' '+MON[a.getUTCMonth()]:'')+'–'+b.getUTCDate()+' '+MON[b.getUTCMonth()]; }
function renderCal(){
  const t=todayDay(), cw=curWeek(t), all=events(), f=all.filter(e=>FILTER==='all'||e.kind===FILTER);
  const main=all.filter(e=>e.kind!=='m'), dn=main.filter(e=>DONE[e.id]).length, ds=debts(), upNot=all.filter(e=>!isPast(e,t)&&!DONE[e.id]);
  const fr=dn/Math.max(1,main.length), c=2*Math.PI*36;
  $('#calSum').innerHTML='<div class="ring"><svg viewBox="0 0 86 86"><circle cx="43" cy="43" r="36" fill="none" stroke="var(--surf3)" stroke-width="9"/><circle cx="43" cy="43" r="36" fill="none" stroke="var(--green)" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+(c*(1-fr)).toFixed(1)+'"/></svg><b>'+Math.round(fr*100)+'%</b></div>'
    +'<div class="m"><b>'+dn+' из '+main.length+' сдано</b><small>Долгов: <b style="color:'+(ds.length?'var(--red)':'inherit')+'">'+ds.length+'</b> · впереди: <b>'+upNot.length+'</b>'+(upNot[0]?' · ближайшее — '+label(upNot[0])+' · '+SUBJ[upNot[0].subj]+', '+inWords(upNot[0].date-t):'')+'</small>'
    +(group()?'':'<small><a href="#" data-group style="color:var(--blue);font-weight:700">Выбери группу</a> — даты встанут по твоим парам</small>')+'</div>';
  let h=''; const debtF=f.filter(e=>e.kind==='dz'&&!DONE[e.id]&&isPast(e,t));
  if(debtF.length) h+='<div class="wkl" style="color:var(--red)">Долги — отметь, если уже сдал</div>'+debtF.map(e=>row(e,t)).join('')+(debtF.length>1?'<button class="btn flat" data-all-past style="margin-top:2px">Всё прошедшее — сдано</button>':'');
  const up=f.filter(e=>!isPast(e,t)); let lastW=-1;
  up.forEach(e=>{ if(e.week!==lastW){ lastW=e.week; h+='<div class="wkl">'+wkName(e.week,cw)+'</div>'; } h+=row(e,t); });
  if(!up.length) h+='<div class="card mut">Впереди ничего нет.</div>';
  const past=f.filter(e=>isPast(e,t)&&!(e.kind==='dz'&&!DONE[e.id]));
  if(past.length) h+='<details class="past"><summary>Прошедшие ('+past.length+')</summary><div class="rows">'+past.map(e=>row(e,t)).join('')+'</div></details>';
  h+='<p class="note">'+(group()?'Срок — день твоего занятия на этой неделе, до начала пары. Точный день уточни у преподавателя.':'Точный день сдачи уточни у преподавателя.')+'</p>';
  $('#calList').innerHTML=h;
  $$('.seg [data-filter]').forEach(b=>b.classList.toggle('on',b.getAttribute('data-filter')===FILTER));
  const n=ds.length+all.filter(e=>!isPast(e,t)&&!DONE[e.id]&&e.date-t<=7).length, b=$('#calBadge'); b.textContent=n; b.hidden=!n;
}

/* ═══ РК ═══ */
function renderRk(){
  const t=todayDay(), rs=events().filter(e=>e.kind==='rk'&&!isPast(e,t));
  $('#rkDot').hidden=!rs.some(e=>e.date-t<=14);
  if(!rs.length) $('#rkList').innerHTML='<div class="card"><b>РК в этом семестре позади</b></div>';
  else { const first={}, mains=[], later=[]; rs.forEach(e=>{ (first[e.subj]?later:mains).push(e); first[e.subj]=1; });
    $('#rkList').innerHTML=mains.concat(later).map(e=>{ const d=e.date-t, p=prepOf(e), main=mains.indexOf(e)>=0;
      if(!main) return (e===later[0]?'<div class="wkl">Позже</div>':'')+'<div class="row k-rk"><span class="chk" style="border:0"></span><div class="m"><b><span class="kd">'+label(e)+'</span>'+SUBJ[e.subj]+'</b><small>'+esc(dateText(e))+'</small></div><div class="d">'+inWords(d)+'</div><span class="go"></span></div>';
      return '<div class="rkb"><section class="plash vio" aria-label="'+label(e)+' '+SUBJ_FULL[e.subj]+'"><div class="p-top">'+(d<=7?'<span class="pill live"><i></i>Скоро</span>':'<span class="pill">Неделя '+e.week+'</span>')+'<span class="p-meta">готовность '+Math.round(p.n/p.all*100)+'%</span></div>'
        +'<div class="p-g"><div><div class="p-t" style="font-size:38px">'+label(e)+'</div><div class="p-s">'+SUBJ_FULL[e.subj]+'</div></div>'+countHTML(d,e)+'</div><div class="tbar"><i data-w="'+Math.round(p.n/p.all*100)+'%"></i></div>'
        +'<div class="tip">'+esc(hintFor(e,d))+'</div>'
        +(p.next?'<div class="acts"><a class="btn white" href="'+p.next.h+'">Шаг '+(p.n+1)+': '+esc(p.next.t)+' →</a></div>':'<div class="acts"><a class="btn white" href="'+PREP[e.subj][3].h+'">Ещё раз пробный →</a></div>')+'</section>'
        +'<ol class="steps">'+p.steps.map((s,i)=>{ const on=!!p.m[s.k];
          return '<li class="step'+(on?' on':'')+'"><button class="chk" data-prep="'+e.id+'|'+s.k+'" aria-pressed="'+on+'" aria-label="'+esc(s.t)+': '+(on?'снять отметку':'отметить — пройдено')+'">'+ico('check')+'</button>'
            +'<a class="t" href="'+s.h+'"><b>'+(i+1)+'. '+esc(s.t)+'</b><small>'+esc(s.s)+'</small></a><a class="go" href="'+s.h+'" aria-label="Открыть: '+esc(s.t)+'">'+ico('ext')+'</a></li>'; }).join('')+'</ol></div>';
    }).join('');
    requestAnimationFrame(()=>requestAnimationFrame(()=>$$('#rkList .tbar i').forEach(i=>i.style.width=i.getAttribute('data-w')))); }
  const ex=site().ex.slice(-12);
  $('#exBox').innerHTML='<div class="sec"><h2>Пробные РК</h2><a class="more" href="/#/ng/rk2/mock">Пройти →</a></div>'
    +(ex.length?'<div class="card" style="margin-top:14px"><div class="exams" aria-label="Результаты пробных РК">'+ex.map(e=>'<i style="height:'+Math.max(6,e.pct)+'%" title="'+e.pct+'% · '+e.min+' мин"><span>'+e.pct+'</span></i>').join('')+'</div><p class="note" style="margin-top:10px">Последние попытки на сайте: процент по самооценке трёх задач билета.</p></div>'
      :'<div class="card" style="margin-top:14px"><b>Ещё не было</b><p class="note" style="margin:4px 0 0">Пробный РК — три задачи билета на время. Результаты появятся здесь.</p></div>');
}

/* ═══ Профиль ═══ */
function fmtDate(ts){ const x=new Date(ts); return x.getDate()+' '+MONF[x.getMonth()]; }
function renderMe(){
  const s=site(), nd=Object.keys(DONE).filter(k=>DONE[k]).length, np=Object.keys(PREPD).reduce((a,k)=>a+Object.keys(PREPD[k]||{}).filter(x=>PREPD[k][x]).length,0), st=LKS.streak();
  $('#meAv').textContent=initials(); $('#meName').textContent=P.name||'Студент';
  $('#meSince').textContent=(group()?'Группа '+group():'Группа не выбрана')+(P.created?' · в кабинете с '+fmtDate(P.created):'');
  $('#kvN').textContent=P.name||'Указать'; $('#kvG').textContent=group()||'Выбрать'; $('#kvV').textContent=variant()||'Выбрать';
  $('#meStats').innerHTML=[[nd,'сдач отмечено'],[np,'шагов к РК'],[s.rep,plural(s.rep,'задача','задачи','задач')+' в повторении'],[s.lessons,plural(s.lessons,'урок','урока','уроков')+' пройдено'],[s.ex.length,'пробных РК'],[st.n,dWord(st.n)+' — серия']]
    .map(a=>'<div><b>'+a[0]+'</b><small>'+a[1]+'</small></div>').join('');
  const bk=LKS.get('lk_backup_at',0);
  $('#saveP').innerHTML='Всё, что ты делаешь в кабинете и на сайте, хранится в этом браузере ('+LKS.sizeKB()+' КБ). Скачай копию — и перенеси прогресс на другой телефон или ноутбук.'+(bk?' Последняя копия — '+fmtDate(bk)+'.':'');
  renderSync();
  const th=LKS.get('nch2_theme',null); $$('#theme [data-th]').forEach(b=>b.classList.toggle('on',b.getAttribute('data-th')===(th==='light'||th==='dark'?th:'auto')));
}
function renderSync(){
  const S=LKS.sync.state, box=$('#syncBox');
  if(!S.on) return;   /* адрес API не задан — остаётся «Скоро» */
  if(S.user) box.innerHTML='<span class="tag" style="background:var(--green)">Вход</span><span><b>'+esc(S.user.name||'Аккаунт')+'</b> · прогресс синхронизируется'+(S.at?', последний раз '+new Date(S.at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}):'')+(S.err?' · <span style="color:var(--red)">'+esc(S.err)+'</span>':'')+'. <a href="#" data-logout style="color:var(--blue);font-weight:700">Выйти</a></span>';
  else box.innerHTML='<span class="tag">'+ico('cloud')+'</span><span><b>Войди</b> — прогресс будет на всех устройствах. <a href="#" data-login="yandex" style="color:var(--blue);font-weight:700">Яндекс ID</a></span>';
}

function renderAll(){ renderHello(); renderHot(); renderDebt(); renderCont(); renderWeek(); renderBento(); renderSem(); renderLesson(); renderCal(); renderRk(); renderMe(); }

/* ═══ Действия ═══ */
let tt; function toast(s){ const el=$('#toast'); el.textContent=s; el.classList.add('on'); clearTimeout(tt); tt=setTimeout(()=>el.classList.remove('on'),2000); }
const findEv=id=>events().filter(e=>e.id===id)[0];
function setDone(id){ const e=findEv(id); if(DONE[id]) delete DONE[id]; else DONE[id]=Date.now(); LKS.set('lk_done',DONE); LKS.markDay(); renderAll(); if(e) toast(DONE[id]?label(e)+' · '+SUBJ[e.subj]+' — '+doneWord(e)+' ✓':'Отметка снята'); }
document.addEventListener('click',ev=>{
  let b=ev.target.closest('[data-done]');
  if(b){ ev.preventDefault(); setDone(b.getAttribute('data-done')); return; }
  b=ev.target.closest('[data-prep]');
  if(b){ ev.preventDefault(); const pk=b.getAttribute('data-prep').split('|'), m=PREPD[pk[0]]||(PREPD[pk[0]]={}); if(m[pk[1]]) delete m[pk[1]]; else m[pk[1]]=Date.now(); LKS.set('lk_prep',PREPD); LKS.markDay(); renderAll(); if(m[pk[1]]) toast('Шаг пройден ✓'); return; }
  b=ev.target.closest('[data-all-past]');
  if(b){ debts().forEach(e=>{ DONE[e.id]=Date.now(); }); LKS.set('lk_done',DONE); renderAll(); toast('Прошедшие ДЗ отмечены сданными'); return; }
  b=ev.target.closest('[data-filter]');
  if(b){ FILTER=b.getAttribute('data-filter'); renderCal(); return; }
  b=ev.target.closest('[data-day]');
  if(b){ SELD=+b.getAttribute('data-day'); renderWeek(); return; }
  b=ev.target.closest('[data-scan="pick"]');
  if(b){ const p=$('#scPick'); if(p) p.click(); return; }
  b=ev.target.closest('[data-group]'); if(b){ ev.preventDefault(); openSheet('g'); return; }
  b=ev.target.closest('[data-variant]'); if(b){ ev.preventDefault(); openSheet('v'); return; }
  b=ev.target.closest('[data-name]'); if(b){ ev.preventDefault(); openSheet('n'); return; }
  b=ev.target.closest('[data-tab-go]'); if(b){ ev.preventDefault(); goTab(b.getAttribute('data-tab-go')); return; }
  b=ev.target.closest('[data-th]'); if(b){ setTheme(b.getAttribute('data-th')); return; }
  b=ev.target.closest('[data-login]'); if(b){ ev.preventDefault(); LKS.sync.login(b.getAttribute('data-login')); return; }
  b=ev.target.closest('[data-logout]'); if(b){ ev.preventDefault(); LKS.sync.logout().then(renderMe); return; }
});
$('#reset').addEventListener('click',()=>{ if(!confirm('Сбросить все отметки сдач и подготовки к РК?')) return; DONE={}; PREPD={}; LKS.set('lk_done',{}); LKS.set('lk_prep',{}); renderAll(); toast('Отметки сброшены'); });
$('#bkSave').addEventListener('click',()=>{ LKS.download(); renderMe(); toast('Копия прогресса скачана'); });
$('#bkFile').addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return;
  LKS.readFile(f).then(j=>{ const n=Object.keys(j.data||{}).length; if(!confirm('Восстановить прогресс из копии от '+String(j.at||'').slice(0,10)+'? Записей: '+n+'. Текущие отметки заменятся данными из копии.')) return;
    LKS.restore(j); reload(); toast('Прогресс восстановлен'); }).catch(err=>toast(err.message)); });
$('#reOb').addEventListener('click',()=>openOb());
function setTheme(t){ if(t==='light'||t==='dark'){ LKS.set('nch2_theme',t); document.documentElement.dataset.theme=t; } else { LKS.put('nch2_theme',null); delete document.documentElement.dataset.theme; } renderMe(); }
function saveP(){ LKS.saveProfile(P); }
function reload(){ P=LKS.profile(); DONE=LKS.get('lk_done',{})||{}; PREPD=LKS.get('lk_prep',{})||{}; renderAll(); }

/* ═══ Листы: группа, вариант, имя ═══ */
const SHEETS={g:$('#gSheet'),v:$('#vSheet'),n:$('#nSheet')};
function groupsHTML(q,cur){
  if(!DB) return '<p>Расписание загружается… Если долго — проверь интернет.</p>';
  q=String(q||'').replace(/\s+/g,'').toUpperCase();
  const ks=Object.keys(DB.groups).filter(k=>!q||k.toUpperCase().indexOf(q)>=0).slice(0,80);
  return ks.length?ks.map(k=>'<button type="button" data-pick="'+esc(k)+'"'+(k===cur?' class="on"':'')+'>'+esc(k)+'</button>').join(''):'<p>Такой группы нет в расписании кафедры РК-1. Проверь запись, например «АК1-31».</p>';
}
const vHTML=cur=>Array.from({length:30},(_,i)=>'<button type="button" data-v="'+(i+1)+'"'+(i+1===cur?' class="on" aria-pressed="true"':' aria-pressed="false"')+'>'+(i+1)+'</button>').join('');
function openSheet(k){
  const s=SHEETS[k]; s.classList.add('on');
  if(k==='g'){ $('#gq').value=''; $('#glist').innerHTML=groupsHTML('',group()); setTimeout(()=>$('#gq').focus(),60); }
  if(k==='v') $('#vgrid').innerHTML=vHTML(variant());
  if(k==='n'){ $('#nIn').value=P.name||''; setTimeout(()=>$('#nIn').focus(),60); }
}
const closeSheets=()=>Object.keys(SHEETS).forEach(k=>SHEETS[k].classList.remove('on'));
$('#gq').addEventListener('input',()=>{ $('#glist').innerHTML=groupsHTML($('#gq').value,group()); });
Object.keys(SHEETS).forEach(k=>SHEETS[k].addEventListener('click',e=>{
  if(e.target===SHEETS[k]||e.target.closest('[data-close]')){ closeSheets(); return; }
  const g=e.target.closest('[data-pick]'); if(g){ P.group=g.getAttribute('data-pick'); saveP(); closeSheets(); SELD=null; renderAll(); toast('Группа '+P.group+': сроки по твоим парам'); return; }
  const v=e.target.closest('[data-v]'); if(v){ P.variant=+v.getAttribute('data-v'); saveP(); closeSheets(); renderAll(); toast('Вариант '+P.variant+' — сайт откроет его сам'); }
}));
$('#nOk').addEventListener('click',()=>{ P.name=$('#nIn').value.trim().slice(0,40); saveP(); closeSheets(); renderAll(); toast(P.name?'Приятно познакомиться, '+P.name+'!':'Имя убрано'); });
$('#nIn').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#nOk').click(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeSheets(); });

/* ═══ Знакомство ═══ */
const OB={el:$('#ob'),st:0,d:{}};
function openOb(){ OB.d={name:P.name||'',group:P.group||'',variant:variant()}; OB.st=0; $('#obName').value=OB.d.name; $('#obG').value=''; $('#obHero').insertAdjacentHTML('afterbegin',$('#obHero .p-art')?'':hypArt()); OB.el.classList.add('on'); document.body.style.overflow='hidden'; obShow(); }
function obShow(){
  $$('.ob-st').forEach(s=>s.classList.toggle('on',+s.getAttribute('data-st')===OB.st));
  $$('.ob-dots i').forEach((d,i)=>d.classList.toggle('on',i<=OB.st));
  $('#obBack').hidden=OB.st===0||OB.st===3;
  const nx=$('#obNext');
  if(OB.st===0){ nx.textContent=$('#obName').value.trim()?'Дальше':'Пропустить'; setTimeout(()=>$('#obName').focus(),80); }
  if(OB.st===1){ $('#obGl').innerHTML=groupsHTML($('#obG').value,OB.d.group); nx.textContent=OB.d.group?'Дальше · '+OB.d.group:'Пропустить'; }
  if(OB.st===2){ $('#obV').innerHTML=vHTML(OB.d.variant); nx.textContent=OB.d.variant?'Дальше · вариант '+OB.d.variant:'Пока не знаю'; }
  if(OB.st===3){ obFinish(); nx.textContent='В кабинет →'; }
}
function obFinish(){
  P.name=OB.d.name; P.group=OB.d.group; P.variant=OB.d.variant||0; P.onb=1; saveP();
  const t=todayDay(), ev=events(), n=ev.filter(e=>!DONE[e.id]&&!isPast(e,t)&&e.kind!=='m')[0], g=gdata(), nl=g&&nextLesson(g);
  $('#obDoneT').textContent=P.name?'Готово, '+P.name+'!':'Готово!';
  $('#obDoneS').textContent='Кабинет собран под тебя. Всё сохраняется само.';
  const it=[];
  if(n) it.push('Ближайшее — <b>'+label(n)+' · '+SUBJ[n.subj]+'</b>, '+inWords(n.date-t)+' ('+esc(human(n.date))+')');
  if(nl) it.push('Следующая пара — <b>'+SUBJ_FULL[nl.l.subj]+'</b>, '+(nl.i===0?'сегодня':nl.i===1?'завтра':human(nl.date))+' в '+esc(nl.l.t.replace(/^0/,'')));
  if(P.variant) it.push('Разборы на сайте откроются на <b>варианте '+P.variant+'</b>');
  it.push('Отмечай сдачи и шаги к РК — кабинет посчитает готовность');
  $('#obSum').innerHTML=it.map(s=>'<div>'+ico('check')+'<span>'+s+'</span></div>').join('');
}
$('#obNext').addEventListener('click',()=>{
  if(OB.st===0) OB.d.name=$('#obName').value.trim().slice(0,40);
  if(OB.st===3){ OB.el.classList.remove('on'); document.body.style.overflow=''; SELD=null; renderAll(); return; }
  OB.st++; obShow();
});
$('#obBack').addEventListener('click',()=>{ if(OB.st>0){ OB.st--; obShow(); } });
$('#obName').addEventListener('input',()=>{ $('#obNext').textContent=$('#obName').value.trim()?'Дальше':'Пропустить'; });
$('#obName').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#obNext').click(); });
$('#obG').addEventListener('input',()=>{ $('#obGl').innerHTML=groupsHTML($('#obG').value,OB.d.group); });
$('#obGl').addEventListener('click',e=>{ const b=e.target.closest('[data-pick]'); if(!b) return; OB.d.group=b.getAttribute('data-pick'); OB.st=2; obShow(); });
$('#obV').addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(!b) return; OB.d.variant=+b.getAttribute('data-v'); $('#obV').innerHTML=vHTML(OB.d.variant); $('#obNext').textContent='Дальше · вариант '+OB.d.variant; });

/* ═══ Вкладки ═══ */
function goTab(id){ const t=$('.tab[data-tab="'+id+'"]'); if(t) t.click(); }
$$('.tab').forEach(t=>t.addEventListener('click',()=>{
  const id=t.getAttribute('data-tab');
  $$('.tab').forEach(x=>{ x.classList.toggle('on',x===t); if(x===t) x.setAttribute('aria-current','page'); else x.removeAttribute('aria-current'); });
  $$('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+id));
  $('#hello').hidden=id!=='home';
  if(id==='home') renderCont();
  if(id==='me') renderMe();
  window.scrollTo(0,0);
}));

LKS.onChange(k=>{
  if(k==='lk_sheets'){ renderCont(); renderMe(); }
  if(k==='*'||k==='lk_done'||k==='lk_prep'||k==='lk_profile'){ const nd=LKS.get('lk_done',{})||{}, np=LKS.get('lk_prep',{})||{}, pp=LKS.profile();
    if(k==='*'||JSON.stringify(nd)!==JSON.stringify(DONE)||JSON.stringify(np)!==JSON.stringify(PREPD)||JSON.stringify(pp)!==JSON.stringify(P)){ P=pp; DONE=nd; PREPD=np; renderAll(); } }
  if(k==='lk_sync_state') renderSync();
});
/* вернулся с сайта — «Продолжить», повторение и серия могли измениться */
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ renderHello(); renderCont(); renderBento(); renderMe(); } });

LKS.markDay();
renderAll();
/* знакомство — не во фрейме (пульт владельца встраивает кабинет) и не по прямой ссылке на сканер */
let framed=false; try{ framed=window.top!==window; }catch(e){ framed=true; }
if(!P.onb&&!framed&&!/^#scan/.test(location.hash)) openOb();
fetch('data/groups.json').then(r=>r.json()).then(j=>{ DB=j; if(group()&&!j.groups[group()]){ P.group=''; saveP(); } SELD=null; renderAll(); if(OB.el.classList.contains('on')&&OB.st===1) obShow(); }).catch(()=>renderAll());
LKS.sync.start().then(()=>renderSync());
self.LKHOME={events,render:renderAll,profile:()=>P};
})();
