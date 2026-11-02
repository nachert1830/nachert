#!/usr/bin/env python3
"""Облегчённая модель рук для MediaPipe Tasks: hands/vendor/hand_landmarker_lite.task.

Зачем: на слабых ноутбуках полная модель руки (hand_landmarks_detector, 5,5 МБ) — основная часть времени
распознавания. У MediaPipe есть облегчённая (hand_landmark_lite.tflite из @mediapipe/hands, 2 МБ, Apache 2.0),
но без TFLite-метаданных, а MediaPipe Tasks без них модель не принимает («requires NormalizationOptions metadata»).
Входы и выходы у полной и облегчённой моделей одинаковые, поэтому метаданные берём из полной.

Как вписываем метаданные, не перестраивая весь flatbuffer: смещения во flatbuffer относительные и смотрят только
вперёд. Новый корневой объект Model кладём В НАЧАЛО файла (старое содержимое сдвигается целиком, кратно 16 байтам —
выравнивание весов не страдает). Новый корень ссылается на старые operator_codes / subgraphs / description
(они дальше по файлу), а векторы buffers и metadata — новые: старые элементы + буфер с метаданными.

Запуск из корня репозитория:
  python3 hands/tools/build-lite-task.py путь/к/hand_landmark_lite.tflite
"""
import struct, sys, zipfile

def u32(b, o): return struct.unpack_from('<I', b, o)[0]
def i32(b, o): return struct.unpack_from('<i', b, o)[0]

def table_fields(b, t):
    """поля таблицы flatbuffer: {номер поля: абсолютная позиция значения}"""
    vt = t - i32(b, t); vlen = struct.unpack_from('<H', b, vt)[0]
    out = {}
    for k in range((vlen - 4) // 2):
        off = struct.unpack_from('<H', b, vt + 4 + 2 * k)[0]
        if off: out[k] = t + off
    return out

def deref(b, pos): return pos + u32(b, pos)                       # uoffset → абсолютная позиция

def vector(b, pos):
    """вектор по полю-смещению: (позиция первого элемента, длина)"""
    v = deref(b, pos); return v + 4, u32(b, v)

def model_root(b): return u32(b, 0)

# поля Model (schema.fbs): 0 version, 1 operator_codes, 2 subgraphs, 3 description, 4 buffers,
# 5 metadata_buffer, 6 metadata, 7 signature_defs.  Buffer: 0 data:[ubyte]. Metadata: 0 name:string, 1 buffer:uint
def read_metadata(b):
    m = table_fields(b, model_root(b)); out = {}
    if 6 not in m: return out
    s, n = vector(b, m[6]); bs, bn = vector(b, m[4])
    for i in range(n):
        t = deref(b, s + 4 * i); f = table_fields(b, t)
        ns = deref(b, f[0]); name = b[ns + 4: ns + 4 + u32(b, ns)].decode()
        bi = u32(b, f[1]); bt = deref(b, bs + 4 * bi); bf = table_fields(b, bt)
        data = b''
        if 0 in bf: ds, dn = vector(b, bf[0]); data = bytes(b[ds: ds + dn])
        out[name] = data
    return out

class Prefix:
    """строим новый кусок файла «сверху вниз»: всё, на что ссылаемся, кладём ПОСЛЕ ссылки"""
    def __init__(self): self.b = bytearray()
    def pos(self): return len(self.b)
    def align(self, n):
        while len(self.b) % n: self.b.append(0)
    def put(self, fmt, *v): p = len(self.b); self.b += struct.pack('<' + fmt, *v); return p
    def patch_off(self, at, target): struct.pack_into('<I', self.b, at, target - at)   # target — в абсолютных координатах итогового файла

def inject(lite, meta_bytes):
    b = lite; m = table_fields(b, model_root(b))
    old_bufs = []; bs, bn = vector(b, m[4])
    for i in range(bn): old_bufs.append(deref(b, bs + 4 * i))
    old_meta = []
    if 6 in m:
        ms, mn = vector(b, m[6])
        for i in range(mn): old_meta.append(deref(b, ms + 4 * i))

    # макет префикса: [корень-смещение][«TFL3»][vtable][Model][вектор buffers][вектор metadata][Buffer meta][Metadata][строка][данные]
    P = Prefix(); P.put('I', 0); P.b += b'TFL3'                      # корень — потом; идентификатор файла TFLite — байты 4..7
    fields = [0, 1, 2, 3, 4, 6]                                      # version, operator_codes, subgraphs, description, buffers, metadata
    present = [f for f in fields if f in m or f in (4, 6)]
    nf = max(present) + 1
    P.align(2); vt = P.pos(); P.put('H', 4 + 2 * nf); P.put('H', 0); slots = P.pos()
    for _ in range(nf): P.put('H', 0)
    P.align(4); tbl = P.pos(); P.put('i', 0)                          # soffset на vtable
    struct.pack_into('<i', P.b, tbl, tbl - vt)
    pos = {}
    for f in range(nf):
        if f not in present: continue
        pos[f] = P.put('I', 0); struct.pack_into('<H', P.b, slots + 2 * f, pos[f] - tbl)
    struct.pack_into('<H', P.b, vt + 2, P.pos() - tbl)              # размер объекта
    P.align(4); vbuf = P.put('I', len(old_bufs) + 1); vbuf_el = [P.put('I', 0) for _ in range(len(old_bufs) + 1)]
    vmeta = P.put('I', len(old_meta) + 1); vmeta_el = [P.put('I', 0) for _ in range(len(old_meta) + 1)]
    # новый Buffer {data}
    P.align(4); bvt = P.pos(); P.put('H', 6); P.put('H', 8); P.put('H', 4); P.align(4)
    btb = P.put('i', 0); struct.pack_into('<i', P.b, btb, btb - bvt); bdat = P.put('I', 0)
    # новый Metadata {name, buffer}
    P.align(4); mvt = P.pos(); P.put('H', 8); P.put('H', 12); P.put('H', 4); P.put('H', 8); P.align(4)
    mtb = P.put('i', 0); struct.pack_into('<i', P.b, mtb, mtb - mvt); mname = P.put('I', 0); P.put('I', len(old_bufs))
    P.align(4); sname = P.put('I', len(b'TFLITE_METADATA')); P.b += b'TFLITE_METADATA\0'
    P.align(16); dlen = P.put('I', len(meta_bytes)); P.b += meta_bytes
    P.align(16)
    shift = len(P.b)                                                  # старое содержимое начнётся здесь

    # ссылки внутри префикса
    P.patch_off(0, tbl)
    if 0 in pos: struct.pack_into('<I', P.b, pos[0], u32(b, m[0]))  # version — значение, не смещение
    for f in (1, 2, 3):
        if f in pos: P.patch_off(pos[f], shift + deref(b, m[f]))
    P.patch_off(pos[4], vbuf); P.patch_off(pos[6], vmeta)
    for i, t in enumerate(old_bufs): P.patch_off(vbuf_el[i], shift + t)
    P.patch_off(vbuf_el[-1], btb); P.patch_off(bdat, dlen)
    for i, t in enumerate(old_meta): P.patch_off(vmeta_el[i], shift + t)
    P.patch_off(vmeta_el[-1], mtb); P.patch_off(mname, sname)
    return bytes(P.b) + bytes(b)

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'hand_landmark_lite.tflite'
    full_task = zipfile.ZipFile('hands/vendor/hand_landmarker.task')
    full = full_task.read('hand_landmarks_detector.tflite')
    meta = read_metadata(full)
    if 'TFLITE_METADATA' not in meta: sys.exit('в полной модели нет TFLITE_METADATA')
    lite = open(src, 'rb').read()
    if 'TFLITE_METADATA' in read_metadata(lite): sys.exit('в облегчённой модели метаданные уже есть')
    out = inject(lite, meta['TFLITE_METADATA'])
    chk = read_metadata(out)
    assert chk.get('TFLITE_METADATA') == meta['TFLITE_METADATA'], 'метаданные не читаются обратно'
    with zipfile.ZipFile('hands/vendor/hand_landmarker_lite.task', 'w', zipfile.ZIP_STORED) as z:
        z.writestr('hand_detector.tflite', full_task.read('hand_detector.tflite'))
        z.writestr('hand_landmarks_detector.tflite', out)
    print('hands/vendor/hand_landmarker_lite.task:', len(out), 'байт модели руки; метаданные:', sorted(chk))

if __name__ == '__main__': main()
