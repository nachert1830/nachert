#!/usr/bin/env python3
"""Лабораторный помощник: JPEG-фото → уменьшенная копия для раскладки / вырезка чертежа с поворотом.
  crop.py small  фото.jpg выход.jpg [--side=800]           → печатает JSON {w,h,k}  (k: px уменьшенного → px фото)
  crop.py cut    фото.jpg выход_без_расширения box=x0,y0,x1,y1 [rot=0|90|180|270] [pad=40] [side=1200]
        → выход.jpg (серый JPEG q85) + выход.pgm (серый растр) + JSON {w,h,A:[a,b,c,d,e,f]}: точка вырезки (u,v) → точка фото (x,y):
          x = a*u + b*v + c,  y = d*u + e*v + f
Фото студентов не копируются никуда, кроме указанных выходных файлов (используйте локальные папки вне git)."""
import sys, json
from PIL import Image, ImageOps
a = sys.argv[1:]; mode = a[0]; src = a[1]; out = a[2]; kv = dict(x.split('=', 1) for x in a[3:] if '=' in x)
im = ImageOps.exif_transpose(Image.open(src)).convert('L'); W, H = im.size
if mode == 'small':
    side = int(kv.get('--side', 800)); k = min(1, side / max(W, H)); s = im.resize((round(W * k), round(H * k)), Image.LANCZOS); s.save(out, quality=85)
    print(json.dumps({'w': s.width, 'h': s.height, 'k': 1 / k, 'W': W, 'H': H}))
else:
    x0, y0, x1, y1 = [float(v) for v in kv['box'].split(',')]; rot = int(kv.get('rot', 0)); pad = float(kv.get('pad', 40)); side = int(kv.get('side', 1200))
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad); c = im.crop((round(X0), round(Y0), round(X1), round(Y1)))
    cw, ch = c.size; ox, oy = round(X0), round(Y0)
    # поворот по часовой стрелке на rot: PIL rotate — против часовой, поэтому -rot; expand
    r = c.rotate(-rot, expand=True) if rot else c; rw, rh = r.size
    k = min(1.0, side / max(rw, rh)); r2 = r.resize((round(rw * k), round(rh * k)), Image.LANCZOS) if k < 1 else r; w2, h2 = r2.size
    # (u,v) итоговой вырезки → повёрнутая без масштаба (u/k, v/k) → вырезка (cw×ch) → фото (+ox, +oy)
    # поворот по часовой на rot: 90: (x,y)→(ch-y, x); 180: (cw-x, ch-y); 270: (y, cw-x). Обратно:
    M = {0: [1, 0, 0, 0, 1, 0], 90: [0, 1, 0, -1, 0, ch], 180: [-1, 0, cw, 0, -1, ch], 270: [0, -1, cw, 1, 0, 0]}[rot]
    A = [M[0] / k, M[1] / k, M[2] + ox, M[3] / k, M[4] / k, M[5] + oy]
    r2.save(out + '.jpg', quality=85)
    open(out + '.pgm', 'wb').write(b'P5\n%d %d\n255\n' % (w2, h2) + r2.tobytes())
    print(json.dumps({'w': w2, 'h': h2, 'A': A, 'k': k, 'rot': rot}))
