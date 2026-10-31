/* Распознавание рук в отдельном потоке: рендер голограммы не ждёт MediaPipe.
   Классический (не module) воркер: загрузчик wasm MediaPipe внутри воркера подключается через importScripts,
   а он есть только в классических воркерах; сам пакет — ES-модуль, его берём динамическим import().
   Протокол: → {type:'init', delegate} ← {type:'ready', delegate} | {type:'fail', error}
             → {type:'frame', bitmap, t} ← {type:'hands', t, ms, hands:[{lm, handed, score}]}  (bitmap передаётся и закрывается здесь) */
let lm = null, delegate = '', mod = null;

async function make(d) {
  mod = mod || await import('./vendor/vision_bundle.mjs');
  const fs = await mod.FilesetResolver.forVisionTasks(new URL('./vendor/wasm', self.location.href).href);
  return mod.HandLandmarker.createFromOptions(fs, {
    baseOptions: { modelAssetPath: new URL('./vendor/hand_landmarker.task', self.location.href).href, delegate: d },
    runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5
  });
}

self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'init') {
    try { lm && lm.close(); } catch (_) {}            /* прежний граф (другой делегат) — освободить */
    lm = null;
    try {
      try { lm = await make(m.delegate); delegate = m.delegate; }
      catch (err) { if (m.delegate !== 'GPU') throw err; lm = await make('CPU'); delegate = 'CPU'; }
      self.postMessage({ type: 'ready', delegate });
    } catch (err) { self.postMessage({ type: 'fail', error: String(err && err.message || err) }); }
    return;
  }
  if (m.type === 'frame') {
    const t0 = performance.now(); let r = null, error = null;
    try { r = lm.detectForVideo(m.bitmap, m.t); } catch (err) { error = String(err && err.message || err); }
    m.bitmap.close();
    if (error) { self.postMessage({ type: 'error', error, delegate }); return; }
    const hands = (r.landmarks || []).map((pts, i) => { const h = r.handedness && r.handedness[i] && r.handedness[i][0];
      return { lm: pts.map(p => ({ x: p.x, y: p.y, z: p.z })), handed: h ? h.categoryName : null, score: h ? h.score : 1 }; });
    self.postMessage({ type: 'hands', t: m.t, ms: performance.now() - t0, hands, delegate });
  }
  if (m.type === 'close') { try { lm && lm.close(); } catch (_) {} self.close(); }
};
