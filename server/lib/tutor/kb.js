/* Наставник: поиск по базе знаний курса (kb.json — поисковый индекс сайта, собирает tools/tutor-kb.js).
   Чтобы Лука отвечал на любой вопрос по курсу — теория, как строить, оформление по ГОСТ, вопросы РК, — сервер сам находит
   нужные страницы, а модель отвечает по найденному тексту (search_course / read_page); числа из найденного — факты сверщика.
   BM25 по полям (заголовок ×3, ключевые фразы ×2, раздел и текст ×1) с облегчённым стеммингом русских окончаний и
   приоритетом объясняющих страниц (темы, уроки, теория) над задачами и тестами.
   search(q, {limit}) → [{key, title, where, href, type, score, excerpt}]; doc(key); byHref(href); all() */
'use strict';
const KB=require('./kb.json');

const SUB={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
const END=['ировавшись','ированием','ированный','ирования','ировать','иями','ениями','ениях','ением','ениям','ности','ность','остью','остей','остях',
  'ующий','ующая','ующее','ующие','ующих','ающий','ающая','ающие','ающих','енный','енная','енное','енные','енных','анный','анная','анные','анных',
  'ться','тся','ешь','ете','ите','ает','яет','ует','еет','ают','яют','уют','еют','ала','ило','или','ала','ого','его','ому','ему','ыми','ими','ыми',
  'ах','ях','ам','ям','ами','ями','ов','ев','ей','ий','ый','ой','ая','яя','ое','ее','ые','ие','ую','юю','ом','ем','им','ым','ью','ия','ья','ье','ии',
  'ет','ит','ут','ют','ят','ть','ла','ло','ли','ал','ил','а','я','о','е','ы','и','у','ю','ь','й'].sort((a,b)=>b.length-a.length);
const STOP=new Set(('и в во на с со к ко о об от до по из за для при про под над без у же ли бы не ни да нет а но или то это что как так там тут где '+
  'когда какой какая какие какое каком чем чего кто мне меня мой моя я ты он она мы вы они его её их этот эта эти тот та те быть есть был была было '+
  'можно нужно надо очень просто пожалуйста объясни объясните расскажи скажи помоги помогите подскажи ну вот если чтобы почему зачем').split(/\s+/));
function norm(s){ return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[₀-₉]/g,c=>SUB[c]).replace(/[″′‴'"`]/g,''); }
function stem(w){ if(w.length<5||/\d/.test(w)) return w; for(const e of END) if(w.endsWith(e)&&w.length-e.length>=3) return w.slice(0,-e.length); return w; }
function tokens(s){ return (norm(s).match(/[a-zа-я0-9π]+/g)||[]).filter(w=>w.length>1&&!STOP.has(w)||/^π\d$|^[a-z]\d?$/.test(w)).map(stem); }

const PRIOR={topic:1.25,'ng-lesson':1.18,'ig-lesson':1.18,'ig-theory':1.22,'ng-theory':1.12,'ng-cheat':1.06,'ig-ref':1,'ng-ticket':.95,'ig-rk':1,
  'ng-hw':.95,'ig-hw':.95,'ng-task':.88,'ig-task':.9,'ng-quiz':.78,tool:.9,part:.9};
const DOCS=KB.docs, N=DOCS.length, TF=[], LEN=[], DF=new Map(), BYKEY=new Map(), BYHREF=new Map();
DOCS.forEach((d,i)=>{ BYKEY.set(d.key,d); if(!BYHREF.has(d.href)) BYHREF.set(d.href,d); const tf=new Map(), add=(s,w)=>tokens(s).forEach(t=>tf.set(t,(tf.get(t)||0)+w));
  add(d.title,3); add((d.kw||[]).join(' . '),2); add(d.where,1); add(d.text,1);
  TF.push(tf); let L=0; tf.forEach(v=>{ L+=v; }); LEN.push(L); tf.forEach((v,t)=>DF.set(t,(DF.get(t)||0)+1)); });
const AVG=LEN.reduce((a,b)=>a+b,0)/Math.max(1,N);
const idf=t=>{ const n=DF.get(t)||0; return Math.log(1+(N-n+.5)/(n+.5)); };

/* лучший абзац документа под запрос — отрывок для модели */
function excerpt(d,qt,max){ max=max||700; const paras=String(d.text||'').split('\n').filter(Boolean); if(!paras.length) return '';
  let best=paras[0], bs=-1; const Q=new Set(qt);
  paras.forEach((p,i)=>{ const pt=tokens(p); let s=0; pt.forEach(t=>{ if(Q.has(t)) s+=idf(t); }); s=s/Math.sqrt(1+pt.length/40)-i*.01; if(s>bs){ bs=s; best=p; } });
  if(best.length>max) best=best.slice(0,max).replace(/\s\S*$/,'')+'…';
  return best; }

function search(q,o){ o=o||{}; const qt=[...new Set(tokens(q))], lim=Math.max(1,Math.min(8,o.limit||5)); if(!qt.length) return [];
  const k1=1.2, b=.75, sc=[];
  for(let i=0;i<N;i++){ const tf=TF[i]; let s=0, hit=0;
    for(const t of qt){ const f=tf.get(t); if(!f) continue; hit++; s+=idf(t)*f*(k1+1)/(f+k1*(1-b+b*LEN[i]/AVG)); }
    if(!s) continue; s*=(PRIOR[DOCS[i].type]||1)*(.6+.4*hit/qt.length); sc.push([s,i]); }
  sc.sort((a,b)=>b[0]-a[0]);
  return sc.slice(0,lim).map(([s,i])=>{ const d=DOCS[i]; return {key:d.key,title:d.title,where:d.where,href:d.href,type:d.type,score:Math.round(s*100)/100,excerpt:excerpt(d,qt)}; }); }

const doc=k=>BYKEY.get(String(k||''))||null;
const byHref=h=>BYHREF.get(String(h||''))||null;
module.exports={search,doc,byHref,tokens,stem,all:()=>DOCS,size:N};
