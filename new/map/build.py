"""Собирает new/map/index.html из proto.html (proto.html — тело страницы, его же публикуем артефактом)."""
import pathlib
d = pathlib.Path(__file__).parent
body = (d / 'proto.html').read_text(encoding='utf-8')
head = '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
title_end = body.index('</style>') + len('</style>')
(d / 'index.html').write_text(head + body[:title_end] + '\n</head>\n<body>\n' + body[title_end:] + '\n</body>\n</html>\n', encoding='utf-8')
print('ok')
