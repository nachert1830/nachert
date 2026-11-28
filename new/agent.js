/* ИИ-агент на главной (копия /new/): желе + строка вопроса. Строка — поиск сайта (SEARCH): номер задачи, вариант, ДЗ, тема.
   Сверху агент отвечает сам, без модели: термин — из словаря GLOSS, общий вопрос — из заготовок luka-lib.json (where «*»).
   Желе слушает, пока печатаешь, радуется, когда нашёл, и грустит, когда нет.
   AGENT.bind({jelly, say, input, res}) — вызывает главная (viewHome). AGENT.answer(текст) → {t, d} | null. */
(function(){
'use strict';
var LIB={syn:{},replies:[]};
try{fetch('luka-lib.json?v=1').then(function(r){return r.ok?r.json():null;}).then(function(j){if(j) LIB=j;}).catch(function(){});}catch(e){}
var STOP=('что как это такое где почему зачем когда мне мой моя мое для или над под при про так все его она они там тут надо нужно можно '+
  'ли же не на в и а у по из за от до с к о я ты вообще только вот если чем чего кто какой какая какие значит').split(' ');
function words(s){s=String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9π′″‴\s]/g,' ');
  return s.split(/\s+/).filter(Boolean).map(function(w){return LIB.syn&&LIB.syn[w]?String(LIB.syn[w]):w;});}
function stems(s){return words(s).filter(function(w){return w.length>=3&&STOP.indexOf(w)<0;}).map(function(w){return w.length>5?w.slice(0,5):w;});}
var ASK=/(что\s+(такое|значит|это)|это\s+что|зачем|почему|как\s+\S+|определени|объясни|не\s+понима)/i;
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

/* ответ сам: заготовка (≥ 2 общих корня) важнее словаря, словарь — если спросили про термин или запрос короткий */
function answer(q){q=String(q||'').trim();if(q.length<3||/^\d+$/.test(q)) return null;
  var st=stems(q), best=null, bs=0;
  (LIB.replies||[]).forEach(function(r){if([].concat(r.where||'*').indexOf('*')<0) return;
    var rs=stems(r.q+' '+(r.kw||[]).join(' ')), n=0;st.forEach(function(w){if(rs.indexOf(w)>=0) n++;});
    if(n>bs){bs=n;best=r;}});
  if(best&&bs>=2) return {t:best.q,d:best.a,k:'lib'};
  try{var f=window.GLOSS?GLOSS.find(q,1):[];if(f.length&&(ASK.test(q)||st.length<=3)) return {t:f[0].t,d:f[0].d,k:'term'};}catch(e){}
  return null;}

function bind(o){
  var J=o.jelly, say=o.say, api=o.input, t=0, lastLen=0;
  function show(a){if(!a){say.hidden=true;say.innerHTML='';return;}
    say.innerHTML='<b>'+esc(a.t)+'</b><p>'+a.d+'</p>';say.hidden=false;say.classList.remove('in');void say.offsetWidth;say.classList.add('in');}
  function react(){var q=api.val().trim();
    if(!q){show(null);if(J) J.mood('idle');return;}
    var a=answer(q), hits=o.res&&o.res()?o.res().querySelectorAll('a.sr-it').length:0;
    show(a);
    if(!J) return;
    if(a||hits) J.mood('happy',1200); else if(q.length>=4) J.mood('sad',1600); else J.mood('listen');}
  api.input.addEventListener('input',function(){var n=api.val().length;
    if(J){J.mood('listen');J.poke(n>lastLen?0.35:0.2,Math.PI/2);}lastLen=n;
    clearTimeout(t);t=setTimeout(react,450);});
  api.input.addEventListener('focus',function(){if(J&&!api.val()) J.mood('listen');});
  api.input.addEventListener('blur',function(){if(J&&!api.val()) J.mood('idle');});
  return {react:react};
}
window.AGENT={answer:answer,bind:bind};
})();
