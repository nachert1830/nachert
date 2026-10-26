/* тема до первой отрисовки (тот же ключ, что у основного сайта) — отдельным файлом, потому что CSP не пускает встроенные скрипты */
try{ var t=JSON.parse(localStorage.getItem('nch2_theme')); if(t!=='light'&&t!=='dark') t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'; document.documentElement.dataset.theme=t; }catch(e){}
