#!/usr/bin/env python3
"""Новый дизайн для копии сайта: из макета docs/redesign/home-v13/mockup.html собирает new/shell.css и new/shell.js.

Оболочка (главная, экраны предметов, ползунок «добавь иконку», окно входа, вход по коду) встаёт поверх копии
во весь экран на адресе «#/»; любой другой адрес (#/ng/tasks, #/dz, …) — настоящие разделы сайта под ней.
Все классы и id оболочки — внутри #ns и с приставкой ns-, чтобы не задеть стили и скрипты сайта.

Запуск: python3 new/make-shell.py
"""
import re, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
M = (ROOT / 'docs/redesign/home-v13/mockup.html').read_text(encoding='utf-8')

# ── CSS: только телефон и занавеска с кодом ──
css = M[M.index('<style>') + 7:M.index('</style>')]
phone_css = css[css.index('/* ── телефон ── */'):css.index('/* на телефоне — во весь экран')]
gate_css = css[css.index('/* вход по коду */'):css.index('@media (prefers-reduced-motion')]
src_css = phone_css + gate_css

KF = sorted(set(re.findall(r'@keyframes\s+([\w-]+)', src_css)), key=len, reverse=True)

def split_rules(s):
    """верхний уровень: [(prelude, body)]; тело @media разбирается рекурсивно"""
    out, i, n = [], 0, len(s)
    while i < n:
        j = s.find('{', i)
        if j < 0: break
        pre = s[i:j].strip(); depth, k = 1, j + 1
        while depth and k < n:
            depth += {'{': 1, '}': -1}.get(s[k], 0); k += 1
        out.append((pre, s[j + 1:k - 1])); i = k
    return out

def scope_sel(sel, top='#ns'):
    sel = re.sub(r'/\*.*?\*/', '', sel, flags=re.S).strip()
    if not sel: return sel
    if sel.startswith('.phone'): return '#ns' + sel[len('.phone'):]
    if sel.startswith('.gate'): return '#ns-gate' + sel[len('.gate'):]
    return top + ' ' + sel

def scope(s, top='#ns'):
    res = []
    for pre, body in split_rules(s):
        pre = re.sub(r'/\*.*?\*/', '', pre, flags=re.S).strip()
        if pre.startswith('@keyframes'):
            res.append('@keyframes ns-' + pre.split()[1] + '{' + body + '}')
        elif pre.startswith('@media'):
            res.append(pre + '{' + scope(body, top) + '}')
        else:
            res.append(','.join(scope_sel(x, top) for x in pre.split(',')) + '{' + body.strip() + '}')
    return '\n'.join(res)

RESET = ('/* стили сайта внутрь оболочки не проходят: сброс к стилям браузера (специфичность #ns выше любых классов сайта,\n'
         '   а свои правила оболочки «#ns .класс» — выше сброса). SVG не трогаем: у них цвета в атрибутах */\n'
         '#ns :where(*:not(svg,svg *)),#ns :where(*:not(svg,svg *))::before,#ns :where(*:not(svg,svg *))::after,'
         '#ns-gate :where(*:not(svg,svg *)),#ns-gate :where(*:not(svg,svg *))::before,#ns-gate :where(*:not(svg,svg *))::after{all:revert}\n'
         '#ns *,#ns-gate *{box-sizing:border-box}\n')
out_css = RESET + scope(phone_css) + '\n' + scope(gate_css, '#ns-gate')
for k in KF:
    out_css = re.sub(r'(animation:[^;}]*?)\b' + re.escape(k) + r'\b', r'\1ns-' + k, out_css)
# классы оболочки, совпадающие с классом-состоянием (.phone.howon и т. п.) уже под #ns; id → ns-
out_css = re.sub(r'#(?!ns\b|ns-)([a-zA-Z][\w-]*)(?=[\s{.,:\[>)])', lambda m: m.group(0) if re.match(r'[0-9a-fA-F]{3,8}$', m.group(1)) else '#ns-' + m.group(1), out_css)
out_css += '''
/* оболочка поверх сайта: во весь экран на «#/» */
#ns{position:fixed;inset:0;z-index:2147480000;width:auto;height:auto;max-width:none;border-radius:0;box-shadow:none;display:none;font:15px/1.4 'Golos Text',system-ui,-apple-system,'Segoe UI',sans-serif;--o:#fa4b00;--sans:'Golos Text',system-ui,-apple-system,'Segoe UI',sans-serif}
html.ns-on #ns{display:block}
html.ns-on,html.ns-on body{overflow:hidden}
#ns *{box-sizing:border-box}
#ns button,#ns a,#ns input{touch-action:manipulation;font-family:inherit}
#ns button{cursor:pointer}
#ns .hd{padding-top:calc(16px + env(safe-area-inset-top,0px));padding-left:max(16px,calc(50% - 244px),env(safe-area-inset-left,0px));padding-right:max(16px,calc(50% - 244px),env(safe-area-inset-right,0px))}
#ns .view{padding-top:calc(70px + env(safe-area-inset-top,0px));padding-bottom:calc(28px + env(safe-area-inset-bottom,0px));padding-left:max(16px,calc(50% - 244px));padding-right:max(16px,calc(50% - 244px))}
#ns .sheet,#ns .how{left:max(8px,calc(50% - 252px));right:max(8px,calc(50% - 252px));bottom:calc(8px + env(safe-area-inset-bottom,0px))}
#ns-gate{z-index:2147480001}
'''

# ── HTML ──
gate_html = M[M.index('<div class="gate" id="gate"'):M.index('<main class="wrap">')].strip()
ph = M[M.index('<div class="phone" id="phone">'):M.index('</main>')].strip()
inner = ph[len('<div class="phone" id="phone">'):ph.rindex('</div>')].strip()

def prefix_ids(h):
    h = re.sub(r'\bid="([\w-]+)"', r'id="ns-\1"', h)
    return h

gate_html = prefix_ids(gate_html).replace('class="gate"', 'class="gate" hidden')
inner = prefix_ids(inner)
# у сайта на теге header свои стили с !important — у оболочки шапка обычным div
inner = inner.replace('<header class="hd">', '<div class="hd">', 1).replace('</header>', '</div>', 1)

# ── JS ──
scripts = re.findall(r'<script>(.*?)</script>', M, flags=re.S)
gate_js, main_js = scripts[0], scripts[1]
main_js = main_js[main_js.index('(function(){'):]  # без своей кошки: у сайта есть CAT
for k in ['gate', 'pin', 'pad']:
    gate_js = gate_js.replace("getElementById('" + k + "')", "getElementById('ns-" + k + "')")
gate_js = gate_js.replace("try{if(localStorage.getItem(OK)==='1'){g.hidden=true;}}catch(e){}",
                          "try{if(localStorage.getItem(OK)!=='1'){g.hidden=false;}}catch(e){g.hidden=false;}")

main_js = main_js.replace("var $=function(id){return document.getElementById(id);}", "var $=function(id){return document.getElementById('ns-'+id);}")
main_js = re.sub(r'''\bid="([\w-]+)"''', r'id="ns-\1"', main_js)
main_js = re.sub(r"""\.id==='([\w-]+)'""", r".id==='ns-\1'", main_js)
main_js = main_js.replace("phone=$('phone')", "phone=document.getElementById('ns')")
# ссылки — по копии, в той же вкладке
main_js = main_js.replace("var SITE='https://nachert1830.ru/';", "var SITE='';")
main_js = main_js.replace("""var tag=T.h?'a href="'+SITE+T.h+'" target="_blank" rel="noopener"':'button type="button"'""",
                          """var tag=T.h?'a href="'+SITE+T.h+'"':'button type="button"'""")
main_js = main_js.replace("""var a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();};}""",
                          """location.hash=url.replace(/^.*#/,'#');};}""")
# вход — кабинет сайта, возврат в копию
main_js = main_js.replace("var ON=/nachert1830\\.ru$/.test(location.hostname);", "var ON=true;")
main_js = main_js.replace("var url=(ON?'/':'https://nachert1830.ru/')+path;", "var url='/'+path;")
# тема — как у сайта (html[data-theme])
main_js = main_js.replace("function paint(){phone.classList.toggle('dark',S.t==='dark');seg('theme','t',S.t);}",
                          "function paint(){phone.classList.toggle('dark',document.documentElement.getAttribute('data-theme')==='dark');}")
main_js = main_js.replace("  $('theme').addEventListener('click',function(e){var b=e.target.closest('button');if(!b) return;S.t=b.dataset.t;save();paint();});\n", "")
main_js = main_js.replace("  $('pop').addEventListener('click',function(){openLogin('Войди — сроки сдачи будут по твоей группе');});\n", "")
main_js = main_js.replace("  paint();fillHome();paintNav();",
  "  paint();fillHome();paintNav();\n  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});\n  window.NS_GO=go;")

shell_js = '''/* Новый дизайн копии сайта (/new/). Собирает new/make-shell.py из docs/redesign/home-v13/mockup.html — правки делать там. */
(function(){
  var root=document.createElement('div');root.id='ns';root.innerHTML=%s;
  var gw=document.createElement('div');gw.innerHTML=%s;
  document.body.appendChild(root);document.body.appendChild(gw.firstElementChild);
  function onHome(){var h=location.hash;return !h||h==='#'||h==='#/';}
  function sync(){document.documentElement.classList.toggle('ns-on',onHome());}
  window.addEventListener('hashchange',function(){sync();if(onHome()&&window.NS_GO) window.NS_GO('home');});
  sync();
})();
%s
%s
''' % (json.dumps(inner, ensure_ascii=False), json.dumps(gate_html, ensure_ascii=False), gate_js.strip(), main_js.strip())

(ROOT / 'new/shell.css').write_text(out_css, encoding='utf-8')
(ROOT / 'new/shell.js').write_text(shell_js, encoding='utf-8')
print('shell.css', len(out_css), 'shell.js', len(shell_js))
