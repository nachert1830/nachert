#!/usr/bin/env python3
"""Пары «до / после» для отчёта: python3 tools/shots/pairs.py <папка до> <папка после> <docs/tutor-shots>
Кадр «после» — подшаг j шага k (номер кадра = 1 + подшаги прошлых шагов + j − 1)."""
import sys, json
from PIL import Image, ImageDraw, ImageFont
B, A, OUT = sys.argv[1:4]
BEATS = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
PICK = [('ng/tasks/46', 2, 1), ('ng/tasks/46', 2, 2), ('ng/tasks/46', 6, 2), ('ng/tasks/45', 3, 1), ('ng/tasks/29', 2, 2), ('ng/tasks/38', 2, 2), ('ng/tasks/44', 3, 1), ('ng2/14', 6, 3)]
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 34)
except Exception: F = ImageFont.load_default()
def frame(route, k, j, dev, tag):
    key = route.replace('/', '_')
    if tag == 'b': n = k
    else: n = 1 + sum(BEATS[route][:k-1]) + j - 1
    return Image.open(f"{B if tag=='b' else A}/{tag}-{key}-c{n:02d}-{dev}.png").convert('RGB')
out = []
for route, k, j in PICK:
    for dev in ('phone', 'pc'):
        if dev == 'pc' and (route, k, j) not in [('ng/tasks/46', 2, 2), ('ng2/14', 6, 3)]: continue
        b, a = frame(route, k, j, dev, 'b'), frame(route, k, j, dev, 'a')
        W = 520 if dev == 'phone' else 900
        b = b.resize((W, int(b.height * W / b.width))); a = a.resize((W, int(a.height * W / a.width)))
        im = Image.new('RGB', (W * 2 + 30, max(b.height, a.height) + 60), 'white'); d = ImageDraw.Draw(im)
        d.text((10, 10), 'ДО', fill=(120, 120, 120), font=F); d.text((W + 40, 10), 'ПОСЛЕ', fill=(26, 90, 224), font=F)
        im.paste(b, (0, 60)); im.paste(a, (W + 30, 60))
        name = f"{route.replace('ng/tasks/','wb').replace('/','-')}-s{k}-{j}-{dev}.jpg"
        im.save(f"{OUT}/{name}", quality=72, optimize=True); out.append(name)
print('\n'.join(out))
