#!/usr/bin/env python3
"""Копия сайта для методички: index.html → m/index.html.

Копия живёт в папке /m/ и берёт общие файлы (ядро, данные ДЗ, шрифты, картинки, кабинет) из корня сайта — пути получают
приставку ../ (та же функция, что у копии дизайна new/fork.py). Своё у копии — методический слой:
  • m/metod.js  — модуль METOD: модель знаний, экран «Методичка», приёмы в плеере разбора;
  • точки подключения в плеере и роутере (PATCHES ниже) — маленькие и проверяемые: каждая ищет ровно одно место
    в корневом index.html и падает, если его нет. Поэтому копию можно пересобрать из свежего корня в любой момент,
    методичка не теряется: python3 m/fork.py

Запуск: python3 m/fork.py           — собрать копию заново из корневого index.html
        python3 m/fork.py --check   — только проверить, что все точки подключения находятся
"""
import importlib.util, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('newfork', ROOT / 'new' / 'fork.py')
nf = importlib.util.module_from_spec(spec); spec.loader.exec_module(nf)

# (что найти — ровно один раз, на что заменить, зачем)
PATCHES = [
    ("mode:opt.mode||'watch'",
     "mode:opt.mode||(window.METOD&&METOD.modeFor(t,opt))||'watch'",
     'режим по уровню: новая тема — разобранный пример, знакомая — «Решаю сам» (эффект обратной экспертности)'),
    ("const hidden=(k)=> S.mode==='try' && k>0 && !S.shown[S.pi+':'+k];",
     "const hidden=(k)=> k>0 && !S.shown[S.pi+':'+k] && (S.mode==='try' || !!(S._mx&&S._mx.pend(k)));\n"
     "  S._mx=window.METOD?METOD.attach({S,t,opt,parts,part:()=>part(),N:()=>N(),scene,root,render:()=>render(),"
     "go:k=>go(k),hidden:k=>hidden(k),svgOf:x=>DRAW.svg(x)}):null;",
     'шаг скрыт и в «Смотрю», пока студент не предсказал его; подключение METOD к плееру'),
    ("} else if(tryHid){",
     "} else if(tryHid&&S._mx&&(card=S._mx.card(p,k,pi))){\n    } else if(tryHid){",
     'карточка скрытого шага: выбрать действие, поставить точку'),
    ('card=`<div class="pl-kicker">Шаг ${k} из ${n}</div>',
     "card=(S._mx?S._mx.badge(k,pi):'')+`<div class=\"pl-kicker\">Шаг ${k} из ${n}</div>",
     'итог попытки над текстом шага'),
    ('${st.why?`<div class="pl-why"><span>Почему</span>${chipify(st.why,scene(p,k).items)}</div>`:\'\'}',
     '${st.why?(S._mx?S._mx.why(k,pi,chipify(st.why,scene(p,k).items)):`<div class="pl-why"><span>Почему</span>${chipify(st.why,scene(p,k).items)}</div>`):\'\'}',
     '«Почему» — после самообъяснения'),
    ("const pr=q('.pl-pres'); if(pr)",
     "if(S._mx) S._mx.bind();\n    const pr=q('.pl-pres'); if(pr)",
     'кнопки и касания методички'),
    ("if(S.mode==='try'&&S.rated==null){",
     "if(S.mode==='try'&&S.rated==null&&S._mx) S._mx.autoRate();\n    if(S.mode==='try'&&S.rated==null){",
     'оценка по фактам вместо «как получилось?»'),
    ("${opt.rep?repHTML():''}",
     "${S._mx?S._mx.summary():''}${opt.rep?repHTML():''}",
     'итог разбора и что дальше'),
    ("'live','ask','prep'].includes(p[0])",
     "'live','ask','prep','m'].includes(p[0])",
     'адрес #/m'),
    ("case 'prep': title=",
     "case 'm': title=window.METOD?METOD.view(v,r):viewHome(v); break;\n      case 'prep': title=",
     'экран «Методичка»'),
    ("default: title=viewHome(v);",
     "default: title=(window.METOD&&/^#?\\/?$/.test(location.hash))?METOD.view(v,{s:'m'}):viewHome(v);",
     'главная копии — методичка; прежняя главная — #/home'),
]


def patch(s):
    for old, new, why in PATCHES:
        n = s.count(old)
        if n != 1:
            raise SystemExit(f'точка подключения найдена {n} раз (нужно 1): {why}\n  {old[:90]}')
        s = s.replace(old, new)
    return s


if __name__ == '__main__':
    src = (ROOT / 'index.html').read_text(encoding='utf-8')
    out, n = nf.fork(src)
    # дизайн-шелл копии /new/ здесь не нужен
    out = out.replace('<link rel="stylesheet" href="shell.css?v=1">\n<script src="shell.js?v=1" defer></script>\n', '')
    out = patch(out)
    out = out.replace('<head>', '<head>\n<meta name="robots" content="noindex,nofollow">\n'
                      '<link rel="stylesheet" href="metod.css?v=1">\n<script src="metod.js?v=1"></script>', 1)
    print('пути:', n, '· точек подключения:', len(PATCHES))
    if '--check' not in sys.argv:
        (ROOT / 'm' / 'index.html').write_text(out, encoding='utf-8')
        print('готово: m/index.html')
