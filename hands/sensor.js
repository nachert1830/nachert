/* Телефон — датчик рук для голограммы на ноутбуке.
   1) открыли по QR-коду с ноутбука: в адресе (после #) — предложение соединения;
   2) сразу: камера, ответ соединения — в «почтовый ящик», который слушает ноутбук;
   3) прямой канал WebRTC; дальше сюда только пинги, туда — точки рук.
   Распознавание — в основном потоке, одним экземпляром облегчённой модели: на телефоне нет 3D, которое
   надо беречь, а воркер (динамический import, WebGL в фоновом потоке, два экземпляра wasm по ~14 МБ) на iOS не взлетал.
   Видео никуда не уходит: распознаёт MediaPipe прямо на телефоне. */
import { packSDP, unpackSDP, gathered, STUN, encodeHands, RELAY, relaySend } from './link.js';

const $ = id => document.getElementById(id);
/* что происходит на телефоне — сообщаем и ноутбуку (через тот же ящик): там видно, где застряло */
const tell = text => {                                                /* канал открыт — по нему, иначе — через ящик */
  if (dc && dc.readyState === 'open') { try { dc.send(JSON.stringify({ k: 's', text })); return; } catch (_) {} }
  if (topic) relaySend(base, topic, 'S~' + text).catch(() => {}); };
const say = (t, l) => { $('title').textContent = t; if (l != null) $('lead').textContent = l; };
const HP = new URLSearchParams(location.hash.slice(1)), offer = HP.get('o'), topic = HP.get('r'), base = HP.get('b') || RELAY;
if (!offer) { say('Открой эту страницу по QR-коду', 'На ноутбуке в голограмме нажми «📱 Телефон» и наведи камеру телефона на код.'); $('start').hidden = true; }

let pc = null, dc = null, stream = null, facing = 'user', running = false, busy = false, lastT = -1, lock = null;
let lmk = null, delegate = '', n = 0, t0 = performance.now(), fps = 0, detMs = 0, lastStamp = 0;
const vid = $('vid'), ov = $('ov'), oc = ov.getContext('2d');


/* распознавание — MediaPipe в основном потоке: видеокарта, не вышло — процессор */
async function makeDetector() {
  const { FilesetResolver, HandLandmarker } = await import('./vendor/vision_bundle.mjs');
  const fs = await FilesetResolver.forVisionTasks('./vendor/wasm');
  const mk = d => HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/hand_landmarker_lite.task', delegate: d },
    runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5 });
  try { lmk = await mk('GPU'); delegate = 'GPU'; }
  catch (e) { tell('видеокарта не подошла (' + (e.message || e).slice(0, 120) + ') — пробую процессор'); lmk = await mk('CPU'); delegate = 'CPU'; }
  tell('распознавание готово: ' + delegate);
}
function detect(t) {
  if (t <= lastStamp) t = lastStamp + 1; lastStamp = t;                /* VIDEO-режим требует растущих меток времени */
  const t1 = performance.now(), r = lmk.detectForVideo(vid, t), ms = performance.now() - t1;
  const hands = (r.landmarks || []).map((pts, i) => { const h = r.handedness && r.handedness[i] && r.handedness[i][0];
    return { lm: pts.map(p => ({ x: p.x, y: p.y, z: p.z })), handed: h ? h.categoryName : null, score: h ? h.score : 1 }; });
  return { ms, hands, delegate };
}

async function camera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false });
  vid.srcObject = stream; await vid.play();
  vid.style.transform = ov.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
}

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
async function pump() {
  if (!running) return;
  if (!busy && vid.readyState >= 2 && vid.currentTime !== lastT) {
    lastT = vid.currentTime; busy = true;
    try {
      const W = 480, H = Math.round(W * (vid.videoHeight || 480) / (vid.videoWidth || 640));
      let r;
      try { r = detect(performance.now()); }
      catch (e) {                                                       /* видеокарта упала на кадре — один раз на процессор */
        if (delegate !== 'GPU') throw e; tell('видеокарта упала на кадре — перехожу на процессор'); try { lmk.close(); } catch (_) {}
        const { FilesetResolver, HandLandmarker } = await import('./vendor/vision_bundle.mjs'), fs = await FilesetResolver.forVisionTasks('./vendor/wasm');
        lmk = await HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/hand_landmarker_lite.task', delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 2 });
        delegate = 'CPU'; busy = false; return pump(); }
      detMs = 0.85 * detMs + 0.15 * r.ms; n++;
      /* обе камеры, направленные на человека, дают незеркальный кадр «глазами наблюдателя» — как веб-камера ноутбука;
         зеркалит (как в зеркале) уже ноутбук, отражать здесь не нужно */
      const hands = r.hands;
      if (dc && dc.readyState === 'open' && dc.bufferedAmount < 32768) dc.send(encodeHands(hands, { ms: Math.round(detMs) }));
      ov.width = 320; ov.height = Math.round(320 * H / W); oc.clearRect(0, 0, ov.width, ov.height); oc.strokeStyle = '#35e0ff'; oc.lineWidth = 2;
      r.hands.forEach(({ lm }) => { oc.beginPath(); BONES.forEach(([a, b]) => { oc.moveTo(lm[a].x * ov.width, lm[a].y * ov.height); oc.lineTo(lm[b].x * ov.width, lm[b].y * ov.height); }); oc.stroke(); });
      const now = performance.now(); if (now - t0 > 1000) { fps = n * 1000 / (now - t0); n = 0; t0 = now;
        $('stat').textContent = `руки ${fps.toFixed(0)} кадр/с · ${detMs.toFixed(0)} мс · ${r.delegate}` + (r.hands.length ? ` · вижу ${r.hands.length === 1 ? 'руку' : 'обе руки'}` : ''); }
    } catch (e) { console.warn(e); if (!pump.err) { pump.err = 1; tell('ошибка распознавания: ' + (e.message || e).slice(0, 200)); } }
    busy = false;
  }
  vid.requestVideoFrameCallback ? vid.requestVideoFrameCallback(() => pump()) : requestAnimationFrame(() => pump());
}

async function keepAwake() { try { lock = await navigator.wakeLock.request('screen'); } catch (_) {} }
document.addEventListener('visibilitychange', () => { if (!document.hidden && running) keepAwake(); });

$('start').onclick = async () => {
  $('start').disabled = true; say('Запускаю…', 'Разреши доступ к камере.');
  try {
    if (!navigator.mediaDevices || !window.RTCPeerConnection) throw new Error('браузер не умеет камеру или WebRTC');
    await camera(); keepAwake();
    const ready = makeDetector();                                   /* модель грузится, пока знакомимся */
    ready.catch(err => tell('распознавание не запустилось: ' + String(err && err.message || err).slice(0, 300)));
    pc = new RTCPeerConnection({ iceServers: STUN });
    pc.ondatachannel = e => { dc = e.channel;
      dc.onopen = async () => { say('Подключено — управляй руками', 'Деталь — на экране ноутбука. Держи руки в кадре телефона.');
        $('prev').hidden = false; $('flip').hidden = $('stop').hidden = false; $('tip').hidden = false;
        try { await ready; } catch (err) { say('Не запустилось распознавание', 'Причина: ' + String(err && err.message || err) + '. Её видно и на ноутбуке.'); return; }
        running = true; pump(); };
      dc.onmessage = e => { const m = JSON.parse(e.data); if (m.k === 'p') dc.send(JSON.stringify({ k: 'q', t: m.t })); };
      dc.onclose = () => { running = false; say('Связь закрыта', 'Чтобы подключиться снова — нажми «📱 Телефон» на ноутбуке и отсканируй новый код.'); }; };
    pc.onconnectionstatechange = () => { tell('соединение: ' + pc.connectionState);
      if (pc.connectionState === 'failed') { say('Не соединилось', 'Телефон и ноутбук не видят друг друга. Проверь, что оба в одной сети Wi-Fi (не гостевой, на телефоне выключены мобильные данные), .'); retry(); } };
    pc.oniceconnectionstatechange = () => tell('ICE: ' + pc.iceConnectionState);
    await pc.setRemoteDescription(unpackSDP(decodeURIComponent(offer), 'offer'));
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    const ans = packSDP(pc.localDescription.sdp);
    $('start').hidden = true;
    /* ответ — в «почтовый ящик», который слушает ноутбук. Никаких кодов на экране телефона */
    try {
      if (!topic) throw new Error('в ссылке нет ящика — отсканируй код на ноутбуке ещё раз');
      await relaySend(base, topic, ans);
      tell('ответ отправлен, адреса телефона: ' + (ans.split('~')[5] || 'нет'));
      say('Соединяюсь с ноутбуком…', 'Пара секунд. Телефон и ноутбук должны быть в одной сети Wi-Fi.');
      setTimeout(() => { if (!dc || dc.readyState !== 'open') { say('Не соединилось', 'Телефон и ноутбук не видят друг друга. Проверь одну сеть Wi-Fi (не гостевую; на телефоне выключи мобильные данные).'); retry(); } }, 15000);
    } catch (e) {
      console.warn(e);
      say('Нет связи с сервисом знакомства', 'Не открылся ntfy.sh (' + (e.message || e) + '). Проверь интернет на телефоне.'); retry();
    }
  } catch (e) {
    console.error(e); $('start').disabled = false;
    $('start').hidden = false; $('start').textContent = 'Начать';
    say('Нажми «Начать»', e && e.name === 'NotAllowedError' ? 'Нужен доступ к камере: нажми «Начать» и разреши, либо включи камеру для сайта в настройках Safari.' : String(e.message || e));
  }
};
/* не вышло — новый код на ноутбуке (старое предложение уже использовано) */
function retry() { $('start').hidden = true; $('lead').textContent += ' Потом на ноутбуке нажми «Новый код» и отсканируй его ещё раз.'; }

/* открыли по ссылке с ноутбука — запускаемся сами: нужно только разрешить камеру (кнопка — если браузер не дал без нажатия) */
if (offer) $('start').click();
$('flip').onclick = async () => { facing = facing === 'user' ? 'environment' : 'user'; try { await camera(); } catch (e) { console.warn(e); } };
$('stop').onclick = () => { running = false; try { dc && dc.close(); pc && pc.close(); } catch (_) {} if (stream) stream.getTracks().forEach(t => t.stop()); if (lock) lock.release().catch(() => {});
  say('Остановлено', 'Закрой вкладку или отсканируй новый код с ноутбука.'); $('prev').hidden = $('flip').hidden = $('stop').hidden = $('tip').hidden = true; };
window.__sensor = { get pc() { return pc; }, get dc() { return dc; }, pause() { running = false; } };   /* для автотестов */
