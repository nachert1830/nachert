"""Очиститель карандаша: выпрямленное фото (8 px/мм) → где лежит линия (0…1). Маленькая U-Net под JS в браузере.
   python3 lab/dz/cleaner/train.py --data=p1.bin,p2.bin,… --out=lab/dz/cleaner/weights.json [--steps=20000]
   Данные — lab/dz/cleaner/gen.js (синтетические листы: правда известна). Вес — JSON с массивами (cleaner.js читает его
   и считает то же самое без библиотек). Потеря — BCE + Dice по покрытию линией. Дополнения: повороты на 90°, отражения,
   яркость, контраст, гамма, шум, размытие — чтобы сеть не привыкла к синтетической камере."""
import sys, json, time, math, random
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F

args = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
files = args.get('data', '').split(',')
STEPS = int(args.get('steps', 20000)); BS = int(args.get('bs', 48)); OUT = args.get('out', 'weights.json')
torch.set_num_threads(int(args.get('threads', 4))); torch.manual_seed(1); np.random.seed(1); random.seed(1)

def load(f):
    b = open(f, 'rb').read(); n = int.from_bytes(b[4:8], 'little'); s = int.from_bytes(b[8:12], 'little')
    return np.frombuffer(b[12:12 + n * 2 * s * s], np.uint8).reshape(n, 2, s, s)
D = np.concatenate([load(f) for f in files if f]); N = len(D); idx = np.random.permutation(N); nv = max(200, N // 40)
val, tr = D[idx[:nv]], D[idx[nv:]]
print(f'патчей {N}: обучение {len(tr)}, проверка {len(val)}', flush=True)

class SepConv(nn.Module):
    """поканальная 3×3 + точечная 1×1 (дёшево в JS)"""
    def __init__(s, ci, co): super().__init__(); s.dw = nn.Conv2d(ci, ci, 3, padding=1, groups=ci); s.pw = nn.Conv2d(ci, co, 1)
    def forward(s, x): return s.pw(s.dw(x))
class Net(nn.Module):
    def __init__(s):
        super().__init__()
        s.e1 = nn.Conv2d(1, 8, 3, padding=1)
        s.e2a = nn.Conv2d(8, 16, 3, padding=1); s.e2b = nn.Conv2d(16, 16, 3, padding=1)
        s.e3a = nn.Conv2d(16, 32, 3, padding=1); s.e3b = nn.Conv2d(32, 32, 3, padding=1)
        s.u2 = SepConv(48, 16); s.u1 = SepConv(24, 8); s.out = nn.Conv2d(8, 1, 1)
    def forward(s, x):
        e1 = F.relu(s.e1(x)); e2 = F.relu(s.e2b(F.relu(s.e2a(F.max_pool2d(e1, 2)))))
        e3 = F.relu(s.e3b(F.relu(s.e3a(F.max_pool2d(e2, 2)))))
        d2 = F.relu(s.u2(torch.cat([F.interpolate(e3, scale_factor=2, mode='nearest'), e2], 1)))
        d1 = F.relu(s.u1(torch.cat([F.interpolate(d2, scale_factor=2, mode='nearest'), e1], 1)))
        return s.out(d1)
net = Net(); print('параметров', sum(p.numel() for p in net.parameters()), flush=True)
if args.get('init'):   # продолжить с сохранённых весов (обучение прервалось)
    net.load_state_dict({k: torch.tensor(v, dtype=torch.float32) for k, v in json.load(open(args['init']))['w'].items()}); print('продолжаю с', args['init'], flush=True)

def batch(src, bs, aug=True):
    b = src[np.random.randint(0, len(src), bs)].astype(np.float32) / 255.0
    x, y = b[:, 0], b[:, 1]
    if aug:
        for i in range(bs):
            k = random.randint(0, 3); x[i] = np.rot90(x[i], k); y[i] = np.rot90(y[i], k)
            if random.random() < 0.5: x[i] = x[i][:, ::-1]; y[i] = y[i][:, ::-1]
        g = np.exp(np.random.uniform(-0.4, 0.4, (bs, 1, 1))); x = np.clip(x, 1e-3, 1) ** g
        c = np.random.uniform(0.5, 1.4, (bs, 1, 1)); m = x.mean((1, 2), keepdims=True); x = m + (x - m) * c + np.random.uniform(-0.2, 0.15, (bs, 1, 1))
        x = x + np.random.normal(0, 1, x.shape) * np.random.uniform(0, 0.04, (bs, 1, 1))
    x = torch.from_numpy(np.ascontiguousarray(x)).unsqueeze(1).float(); y = torch.from_numpy(np.ascontiguousarray(y)).unsqueeze(1).float()
    if aug and random.random() < 0.3: x = F.avg_pool2d(F.pad(x, (1, 1, 1, 1), mode='replicate'), 3, 1)
    return x, y

def loss_fn(lo, y):
    p = torch.sigmoid(lo); bce = F.binary_cross_entropy_with_logits(lo, y, pos_weight=torch.tensor(3.0))
    inter = (p * y).sum((1, 2, 3)); dice = 1 - (2 * inter + 1) / (p.sum((1, 2, 3)) + y.sum((1, 2, 3)) + 1)
    return bce + dice.mean()

opt = torch.optim.AdamW(net.parameters(), 3e-3, weight_decay=1e-4)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, 3e-3, total_steps=STEPS, pct_start=0.05)
xv, yv = batch(val, len(val), aug=False)
def evaluate():
    net.eval()
    with torch.no_grad():
        lo = torch.cat([net(xv[i:i + 128]) for i in range(0, len(xv), 128)]); p = torch.sigmoid(lo)
        pr = p > 0.5; gt = yv > 0.5; tp = (pr & gt).sum().item(); fp = (pr & ~gt).sum().item(); fn = (~pr & gt).sum().item()
        l = loss_fn(lo, yv).item()
    net.train(); return l, tp / max(1, tp + fp), tp / max(1, tp + fn)
def export(path):
    W = {k: v.detach().numpy().astype(float).round(6).tolist() for k, v in net.state_dict().items()}
    json.dump({'arch': 'unet-s1', 'ppm': 8, 'note': 'lab/dz/cleaner/train.py', 'w': W}, open(path, 'w'))

t0 = time.time(); best = 1e9
for step in range(1, STEPS + 1):
    x, y = batch(tr, BS); lo = net(x); l = loss_fn(lo, y); opt.zero_grad(); l.backward(); opt.step(); sched.step()
    if step % 500 == 0 or step == STEPS:
        vl, prec, rec = evaluate()
        print(f'шаг {step}: потеря {l.item():.3f}, проверка {vl:.3f}, точность {prec:.3f}, полнота {rec:.3f}, {time.time() - t0:.0f} с', flush=True)
        if vl < best: best = vl; export(OUT)
print('готово, лучшее на проверке', round(best, 4), '→', OUT)
