"""Сеть глаз: фото листа (серое, уменьшено до длинной стороны 640 px) → тепловая карта на каждую точку условия
   A″ B″ C″ S″ A′ B′ C′ S′ и начало O каждого чертежа (шаг карты — 4 px). Сеть только подсказывает, где точки;
   меряет и судит наша геометрия (eyes.js). Стандартная схема: U-Net + тепловые карты с фокальной потерей (как CenterNet).
   python3 lab/dz/net/train.py --data=d1.bin,d2.bin,… --out=lab/dz/net/eyes.onnx [--steps=6000] [--bs=24]
   python3 lab/dz/net/train.py --eval=lab/dz/net/eyes.onnx --data=t.bin — замер на отложенных листах (ONNX, как в браузере)
   Данные — lab/dz/net/gen.js. Дополнения: масштаб 1…4,5 px/мм, повороты на 90° и ± 12°, яркость, контраст, гамма,
   шум, размытие, блик."""
import sys, struct, time, math, random
import numpy as np

args = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
NP = 9; NAMES = ['A″', 'B″', 'C″', 'S″', 'A′', 'B′', 'C′', 'S′', 'O']; STRIDE = 4; LONG = 640

def load(files):
    out = []
    for f in files:
        b = open(f, 'rb').read(); n = struct.unpack('<I', b[4:8])[0]; p = 8
        for _ in range(n):
            w, h = struct.unpack('<HH', b[p:p+4]); ppm = struct.unpack('<f', b[p+4:p+8])[0]; k = struct.unpack('<H', b[p+8:p+10])[0]; p += 10
            P = np.array([struct.unpack('<Bff', b[p+9*j:p+9*j+9]) for j in range(k)], np.float32).reshape(-1, 3); p += 9*k
            a = np.frombuffer(b[p:p+w*h], np.uint8).reshape(h, w); p += w*h
            out.append((a, ppm, P))
    return out

def peaks(hm, thr=0.3):
    """пики карты: локальный максимум 3×3 выше порога, центр — взвешенное среднее 3×3 (в px входа)"""
    C, H, W = hm.shape; out = []
    for c in range(C):
        m = hm[c]; pad = np.pad(m, 1, constant_values=0)
        mx = np.max(np.stack([pad[dy:dy+H, dx:dx+W] for dy in range(3) for dx in range(3)]), 0)
        for y, x in zip(*np.nonzero((m >= mx) & (m > thr))):
            y0, y1, x0, x1 = max(0, y-1), min(H, y+2), max(0, x-1), min(W, x+2); w = m[y0:y1, x0:x1]
            yy, xx = np.mgrid[y0:y1, x0:x1]; s = w.sum()
            out.append((c, ((xx*w).sum()/s + 0.5)*STRIDE - 0.5, ((yy*w).sum()/s + 0.5)*STRIDE - 0.5, float(m[y, x])))
    return out

def prep(a, long=LONG):
    """лист → вход сети: длинная сторона 640, стороны кратны 32 (дополнение белым)"""
    from PIL import Image
    h, w = a.shape; k = long/max(h, w); W, H = max(32, round(w*k)), max(32, round(h*k))
    im = np.asarray(Image.fromarray(a).resize((W, H), Image.BILINEAR), np.float32)/255
    Wp, Hp = (W+31)//32*32, (H+31)//32*32; x = np.ones((Hp, Wp), np.float32); x[:H, :W] = im
    return x, k

if 'eval' in args:
    import onnxruntime as ort
    S = ort.InferenceSession(args['eval']); data = load(args['data'].split(','))
    tp = fp = fn = 0; errs = []; t0 = time.time()
    for a, ppm, P in data:
        x, k = prep(a); hm = S.run(None, {'img': x[None, None]})[0][0]; pk = peaks(hm)
        mmpx = 1/(ppm*k); used = set()
        for c, px, py in P:
            best = None
            for j, (cc, qx, qy, v) in enumerate(pk):
                if cc != c or j in used: continue
                d = math.hypot(qx - px*k, qy - py*k)*mmpx
                if best is None or d < best[0]: best = (d, j)
            if best and best[0] <= 5: used.add(best[1]); tp += 1; errs.append(best[0])
            else: fn += 1
        fp += len(pk) - len(used)
    e = np.array(errs) if errs else np.zeros(1)
    print('листов %d: точек найдено %d из %d (%.0f %%), лишних пиков %d; промах медиана %.2f мм, 90 %% — %.2f мм; %.2f с на лист' %
          (len(data), tp, tp+fn, 100*tp/max(1, tp+fn), fp, np.median(e), np.percentile(e, 90), (time.time()-t0)/max(1, len(data))))
    sys.exit(0)

import torch, torch.nn as nn, torch.nn.functional as F
STEPS = int(args.get('steps', 6000)); BS = int(args.get('bs', 24)); CROP = int(args.get('crop', 192)); OUT = args.get('out', 'eyes.onnx')
torch.set_num_threads(int(args.get('threads', 4))); torch.manual_seed(1); np.random.seed(1); random.seed(1)

def cbr(i, o, s=1, d=1): return nn.Sequential(nn.Conv2d(i, o, 3, s, d, d, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True))
class Net(nn.Module):
    def __init__(s, c=(16, 24, 32, 48, 64)):
        super().__init__()
        s.e1 = nn.Sequential(cbr(1, c[0], 2), cbr(c[0], c[0]))            # 1/2
        s.e2 = nn.Sequential(cbr(c[0], c[1], 2), cbr(c[1], c[1]))         # 1/4
        s.e3 = nn.Sequential(cbr(c[1], c[2], 2), cbr(c[2], c[2]))         # 1/8
        s.e4 = nn.Sequential(cbr(c[2], c[3], 2), cbr(c[3], c[3]))         # 1/16
        s.e5 = nn.Sequential(cbr(c[3], c[4], 2), cbr(c[4], c[4], d=2), cbr(c[4], c[4], d=4))  # 1/32, широкий охват
        s.d4 = cbr(c[4]+c[3], c[3]); s.d3 = cbr(c[3]+c[2], c[2]); s.d2 = nn.Sequential(cbr(c[2]+c[1], c[1]), cbr(c[1], c[1]))
        s.head = nn.Conv2d(c[1], NP, 1); nn.init.constant_(s.head.bias, -2.2)
    def forward(s, x):
        x = 1 - x                                                          # линия — 1, бумага — 0
        a1 = s.e1(x); a2 = s.e2(a1); a3 = s.e3(a2); a4 = s.e4(a3); a5 = s.e5(a4)
        up = lambda t, r: F.interpolate(t, size=r.shape[2:], mode='nearest')
        b4 = s.d4(torch.cat([up(a5, a4), a4], 1)); b3 = s.d3(torch.cat([up(b4, a3), a3], 1)); b2 = s.d2(torch.cat([up(b3, a2), a2], 1))
        return torch.sigmoid(s.head(b2))

data = load(args['data'].split(',')); print('листов', len(data), flush=True)
from PIL import Image
def sample():
    a, ppm, P = data[random.randrange(len(data))]
    s = math.exp(random.uniform(math.log(1.0), math.log(4.5))); r = s/ppm        # px сети на px листа
    th = random.uniform(-12, 12)*math.pi/180 + random.randrange(4)*math.pi/2
    if len(P) and random.random() < 0.8: cx, cy = P[random.randrange(len(P)), 1:] + np.random.uniform(-60, 60, 2)/r
    else: cx, cy = random.uniform(0, a.shape[1]), random.uniform(0, a.shape[0])
    # px сети (u,v) → px листа: центр + R(θ)·(u−C/2, v−C/2)/r
    c, sn = math.cos(th)/r, math.sin(th)/r; h = CROP/2
    M = (c, -sn, cx - c*h + sn*h, sn, c, cy - sn*h - c*h)
    im = Image.fromarray(a)
    if r < 0.6: im = im.resize((max(1, round(a.shape[1]*r*1.6)), max(1, round(a.shape[0]*r*1.6))), Image.BILINEAR); f = r*1.6; M = (M[0]*f, M[1]*f, M[2]*f, M[3]*f, M[4]*f, M[5]*f)
    x = np.asarray(im.transform((CROP, CROP), Image.AFFINE, M, Image.BILINEAR, fillcolor=random.randint(60, 255)), np.float32)/255
    # точки → px сети
    tgt = np.zeros((NP, CROP//STRIDE, CROP//STRIDE), np.float32); g = CROP//STRIDE; yy, xx = np.mgrid[0:g, 0:g]
    for k, px, py in P:
        dx, dy = px - cx, py - cy; u = (math.cos(th)*dx + math.sin(th)*dy)*r + h; v = (-math.sin(th)*dx + math.cos(th)*dy)*r + h
        gu, gv = (u + 0.5)/STRIDE - 0.5, (v + 0.5)/STRIDE - 0.5
        if -3 < gu < g+3 and -3 < gv < g+3: tgt[int(k)] = np.maximum(tgt[int(k)], np.exp(-((xx-gu)**2 + (yy-gv)**2)/(2*1.0**2)))
    # фото: яркость, контраст, гамма, блик, размытие, шум
    x = np.clip((x - 0.5)*random.uniform(0.6, 1.3) + 0.5 + random.uniform(-0.2, 0.15), 0, 1)**random.uniform(0.7, 1.5)
    if random.random() < 0.3:
        gx, gy = np.random.uniform(0, CROP, 2); rr = random.uniform(20, 120); m = np.mgrid[0:CROP, 0:CROP]
        x = np.clip(x + random.uniform(0.2, 0.6)*np.exp(-((m[1]-gx)**2 + (m[0]-gy)**2)/(2*rr*rr)), 0, 1)
    if random.random() < 0.3: x = np.asarray(Image.fromarray((x*255).astype(np.uint8)).filter(__import__('PIL.ImageFilter').ImageFilter.GaussianBlur(random.uniform(0.4, 1.2))), np.float32)/255
    x = np.clip(x + np.random.normal(0, random.uniform(0, 0.05), x.shape), 0, 1)
    return x.astype(np.float32), tgt

def focal(p, t):
    """фокальная потеря CenterNet: пик — 1, вокруг — штраф ослаблен (1 − t)⁴"""
    p = p.clamp(1e-4, 1 - 1e-4); pos = t.ge(0.99).float(); neg = 1 - pos
    lp = torch.log(p)*(1 - p)**2*pos; ln = torch.log(1 - p)*p**2*(1 - t)**4*neg
    return -(lp.sum() + ln.sum())/pos.sum().clamp(min=1)

net = Net(); print('весов', sum(p.numel() for p in net.parameters()), flush=True)
opt = torch.optim.AdamW(net.parameters(), 2e-3, weight_decay=1e-4); sch = torch.optim.lr_scheduler.OneCycleLR(opt, 2e-3, total_steps=STEPS, pct_start=0.05)
t0 = time.time(); run = 0
for step in range(1, STEPS+1):
    B = [sample() for _ in range(BS)]; x = torch.from_numpy(np.stack([b[0] for b in B]))[:, None]; t = torch.from_numpy(np.stack([b[1] for b in B]))
    loss = focal(net(x), t); opt.zero_grad(); loss.backward(); opt.step(); sch.step(); run = 0.98*run + 0.02*loss.item() if step > 1 else loss.item()
    if step % 100 == 0: print('шаг %d: потеря %.3f, %.0f с' % (step, run, time.time()-t0), flush=True)
    if step % 2000 == 0 or step == STEPS:
        net.eval(); torch.onnx.export(net, torch.zeros(1, 1, 448, 640), OUT, input_names=['img'], output_names=['hm'],
            dynamic_axes={'img': {2: 'h', 3: 'w'}, 'hm': {2: 'h4', 3: 'w4'}}, opset_version=17); net.train()
print('готово →', OUT)
