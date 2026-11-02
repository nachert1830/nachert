/* Распознавание рук в отдельном потоке: рендер голограммы не ждёт MediaPipe.
   Классический (не module) воркер: загрузчик wasm MediaPipe внутри воркера подключается через importScripts,
   а он есть только в классических воркерах; сам пакет — ES-модуль, его берём динамическим import().
   Протокол: → {type:'init', delegate} ← {type:'ready', delegate} | {type:'fail', error}
             → {type:'frame', bitmap, t} ← {type:'hands', t, ms, hands:[{lm, handed, score}], two}  (bitmap закрывается здесь)

   Скорость. Замер на фото рук (CPU, режим отслеживания): полная модель на 2 руки — 124 мс на кадр, облегчённая
   на 1 руку — 36 мс. Причины две: (1) если ждём 2 руки, а в кадре одна, MediaPipe на каждом кадре заново ищет
   ладонь по всему кадру — это половина времени; (2) полная модель руки в 2–3 раза дороже облегчённой
   (облегчённая — ошибка точек ~3 px на кадре 480 px, на пороги жестов не влияет).
   Поэтому два экземпляра облегчённой модели: «один» (numHands 1) — каждый кадр, и «два» (numHands 2) —
   раз в PROBE кадров ищет вторую руку; нашёл — работаем «двумя», пока вторая рука в кадре (после MISS
   кадров без неё — снова «один»). Двуручные жесты (зум, хлопок, разбор) — без постоянной цены второй руки. */
const MODEL = './vendor/hand_landmarker_lite.task', PROBE = 6, MISS = 8;
let one = null, two = null, delegate = '', mod = null, mode = 1, n = 0, miss = 0;

async function make(d, hands) {
  mod = mod || await import('./vendor/vision_bundle.mjs');
  const fs = await mod.FilesetResolver.forVisionTasks(new URL('./vendor/wasm', self.location.href).href);
  return mod.HandLandmarker.createFromOptions(fs, {
    baseOptions: { modelAssetPath: new URL(MODEL, self.location.href).href, delegate: d },
    runningMode: 'VIDEO', numHands: hands, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5
  });
}
const closeAll = () => { for (const l of [one, two]) { try { l && l.close(); } catch (_) {} } one = two = null; };

self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'init') {
    closeAll();                                          /* прежние графы (другой делегат) — освободить */
    try {
      let d = m.delegate;
      try { one = await make(d, 1); } catch (err) { if (d !== 'GPU') throw err; d = 'CPU'; one = await make(d, 1); }
      two = await make(d, 2); delegate = d; mode = 1; n = 0; miss = 0;
      self.postMessage({ type: 'ready', delegate });
    } catch (err) { self.postMessage({ type: 'fail', error: String(err && err.message || err) }); }
    return;
  }
  if (m.type === 'frame') {
    const t0 = performance.now(); let r = null, error = null;
    n++;
    const useTwo = mode === 2 || n % PROBE === 0;
    try { r = (useTwo ? two : one).detectForVideo(m.bitmap, m.t); } catch (err) { error = String(err && err.message || err); }
    m.bitmap.close();
    if (error) { self.postMessage({ type: 'error', error, delegate }); return; }
    const k = (r.landmarks || []).length;
    if (useTwo) {
      if (k >= 2) { mode = 2; miss = 0; }
      else if (mode === 2 && ++miss >= MISS) mode = 1;
    }
    const hands = (r.landmarks || []).map((pts, i) => { const h = r.handedness && r.handedness[i] && r.handedness[i][0];
      return { lm: pts.map(p => ({ x: p.x, y: p.y, z: p.z })), handed: h ? h.categoryName : null, score: h ? h.score : 1 }; });
    self.postMessage({ type: 'hands', t: m.t, ms: performance.now() - t0, hands, delegate, two: mode === 2, probe: useTwo && mode !== 2 });
  }
  if (m.type === 'close') { closeAll(); self.close(); }
};
