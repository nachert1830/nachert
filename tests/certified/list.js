/* Перенесено в core/list.js (ядро для тестов и сканера). Здесь — переходник по старому адресу: тесты (Node) и сайт
   (тренажёр подгружает tests/certified/*.js) работают как раньше. На странице код ядра исполняется сразу, до onload
   этого файла (встроенный script разрешён политикой CSP сайта, eval — нет). */
if(typeof module!=='undefined'&&module.exports&&typeof require==='function') module.exports=require('../../core/list.js');
else (function(){ const x=new XMLHttpRequest(); x.open('GET',new URL('../../core/list.js',document.currentScript.src).href,false); x.send();
  if(x.status!==200) throw new Error('core/list.js: '+x.status);
  const s=document.createElement('script'); s.text=x.responseText+'\n//# sourceURL=core/list.js'; document.head.appendChild(s); })();
