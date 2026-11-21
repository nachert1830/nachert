#!/usr/bin/env python3
"""Копия сайта для нового дизайна: index.html → new/index.html.

Копия живёт в папке /new/, а общие файлы (ядро, данные ДЗ, шрифты, картинки, кабинет, views.json) берёт из корня
сайта — поэтому все относительные пути в копии получают приставку ../. Данные и решатели общие с оригиналом,
своя у копии — только страница (вид). Когда копия готова, ею заменяют корневой index.html (пути вернуть: --unfork).

Запуск: python3 new/fork.py            — сделать копию заново из корневого index.html (затрёт правки копии!)
        python3 new/fork.py --check    — только показать, сколько путей будет переписано
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIRS = r'(?:img|fonts|lk|kernel|dz|prep|tests|og|core)/'
FILES = r'(?:manifest\.webmanifest|apple-touch-icon\.png|icon-\d+\.png|views\.json)'

def fork(s):
    n = {}
    def sub(pat, rep, key):
        nonlocal s
        s, k = re.subn(pat, rep, s)
        n[key] = k
    # атрибуты src/href и строки в JS: 'kernel/…', "dz/…", `img/…`, url(fonts/…)
    Q = '["\'`(]'
    sub('(?<=' + Q + ')(?:\\./)?(' + DIRS + ')', r'../\1', 'dirs')
    sub('(?<=' + Q + ')(?:\\./)?(' + FILES + ')(?=["\'`)?])', r'../\1', 'files')
    # превью рисунков ИГ ДЗ №2: 'ig/v01.jpg'
    sub(r"""'ig/v'\+""", "'../ig/v'+", 'ig2thumbs')
    # офлайн-помощник один на весь сайт (корневой sw.js управляет и /new/)
    sub(r"""serviceWorker\.register\('sw\.js'\)""", "serviceWorker.register('../sw.js')", 'sw')
    # картинки вариантов ДЗ заданы в общих файлах данных относительно страницы ('ig/v05.jpg') — в копии к ним ../
    fix = ("<script>/* копия в /new/: пути картинок ДЗ из общих данных — от корня сайта */(function(){try{DZR.all().forEach(function(d){"
           "if(typeof d.img!=='function'||d.__img) return;var f=d.img;d.__img=1;d.img=function(n){var u=f(n);"
           "return u&&!/^(\\.\\.\\/|\\/|https?:|data:|blob:)/.test(u)?'../'+u:u;};});}catch(e){}})();</script>")
    m = list(re.finditer(r'<script src="\.\./dz/[^"]+"[^>]*></script>', s))
    if m:
        i = m[-1].end(); s = s[:i] + '\n' + fix + s[i:]; n['dzimg'] = 1
    # новый дизайн поверх копии (new/shell.css, new/shell.js — собирает new/make-shell.py; экран ДЗ — new/dzdeck.*)
    i = s.rindex('</body>')  # последнее: раньше в файле '</body>' встречается внутри строк скриптов
    s = s[:i] + '<link rel="stylesheet" href="shell.css?v=1">\n<script src="shell.js?v=1" defer></script>\n<link rel="stylesheet" href="dzdeck.css?v=3">\n<script src="dzdeck.js?v=3" defer></script>\n' + s[i:]; n['shell'] = 1
    return s, n

if __name__ == '__main__':
    src = (ROOT / 'index.html').read_text(encoding='utf-8')
    out, n = fork(src)
    print('переписано:', n)
    if '--check' not in sys.argv:
        out = out.replace('<head>', '<head>\n<meta name="robots" content="noindex,nofollow">', 1)
        (ROOT / 'new' / 'index.html').write_text(out, encoding='utf-8')
        print('готово: new/index.html')
