/* Общее для страниц сканера: тема — та же, что у сайта и кабинета (nch2_theme); внутри кабинета (iframe) заголовок и
   описание показывает кабинет; блоки результата появляются только после первого фото. */
(function(){
  try{ var t=JSON.parse(localStorage.getItem('nch2_theme')); if(t==='light'||t==='dark') document.documentElement.dataset.theme=t; }catch(e){}
  try{ if(window.self!==window.top) document.documentElement.classList.add('embed'); }catch(e){ document.documentElement.classList.add('embed'); }
  function on(){ document.body.classList.add('has-photo'); }
  document.addEventListener('change',function(e){ if(e.target&&e.target.type==='file'&&e.target.files&&e.target.files.length) on(); },true);
  document.addEventListener('click',function(e){ var b=e.target&&e.target.closest&&e.target.closest('[data-photo]'); if(b) on(); },true);
})();
