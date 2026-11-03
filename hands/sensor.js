/* Телефон — датчик рук для голограммы на ноутбуке.
   1) открыли по QR-коду с ноутбука: в адресе (после #) — канал брокера MQTT и предложение прямого соединения;
   2) сразу: камера, распознавание, связь с брокером; ответ на предложение — через брокер;
   3) точки рук идут прямым каналом WebRTC, если он сложился (одна сеть, без VPN), иначе — через брокер
      (работает с VPN и через мобильный интернет). Сюда — только пинги.
   Распознавание — в основном потоке, одним экземпляром облегчённой модели: на телефоне нет 3D, которое
   надо беречь, а воркер (динамический import, WebGL в фоновом потоке, два экземпляра wasm по ~14 МБ) на iOS не взлетал.
   Видео никуда не уходит: распознаёт MediaPipe прямо на телефоне. */
import { packSDP, unpackSDP, gathered, STUN, encodeHands } from './link.js';
import { connectMqtt, BROKERS } from './mqtt.js';
import { drawQR } from './pair.js';
/* Без брокера (провайдер блокирует сервис связи, ноутбук в точке доступа телефона; в адресе n=1 или брокер не ответил):
   ответ на предложение — QR-кодом на экране телефона, ноутбук читает его своей камерой. Руки — только прямым каналом,
   это и самый быстрый путь: без интернета и посредника. */

const $ = id => document.getElementById(id);
/* отправка ноутбуку: прямой канал, если открыт, иначе — брокер. Сообщения рук не копим: очередь — значит, пропускаем */
function send(text, drop) {
  if (dc && dc.readyState === 'open') { if (!drop || dc.bufferedAmount < 32768) { try { dc.send(text); return 'прямо'; } catch (_) {} } return ''; }
  if (mq && !mq.closed) { if (!drop || mq.buffered < 16384) mq.publish(ch + '/up', text); return 'интернет'; }
  return '';
}
/* что происходит на телефоне — сообщаем и ноутбуку: там видно, где застряло */
const told = [];   /* сказанное до открытия канала (без брокера) — повторим, когда канал откроется */
const tell = text => { const m = JSON.stringify({ k: 's', text }); if (!send(m)) told.push(m); };
const say = (t, l) => { $('title').textContent = t; if (l != null) $('lead').textContent = l; };
const HP = new URLSearchParams(location.hash.slice(1)), offer = HP.get('o'), chId = HP.get('r'), broker = HP.get('q');
let noBroker = HP.get('n') === '1';
const ch = 'nachert/' + chId;
if (!chId) { say('Открой эту страницу по QR-коду', 'На ноутбуке в голограмме нажми «📱 Телефон» и наведи камеру телефона на код.'); $('start').hidden = true; }

let mq = null, linked = '', pc = null, dc = null, stream = null, facing = 'user', running = false, busy = false, lastT = -1, lock = null;
let lmk = null, delegate = '', n = 0, t0 = performance.now(), fps = 0, detMs = 0, lastStamp = 0;
const vid = $('vid'), ov = $('ov'), oc = ov.getContext('2d');


/* распознавание — MediaPipe в основном потоке: видеокарта, не вышло — процессор */
async function makeDetector() {
  const { FilesetResolver, HandLandmarker } = await import('./vendor/vision_bundle.mjs');
  const fs = await FilesetResolver.forVisionTasks('./vendor/wasm');
  const mk = d => HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/hand_landmarker_lite.task', delegate: d },
    runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  /* прогрев: первый кадр на видеокарте компилирует шейдеры (может занять секунды) — делаем это сейчас, на пустой
     картинке, пока идёт знакомство, а не на первом живом кадре. Видеокарта упала на прогреве — сразу процессор */
  const warm = () => { const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').fillRect(0, 0, 64, 64); lmk.detectForVideo(c, ++lastStamp); };
  try { lmk = await mk('GPU'); delegate = 'GPU'; warm(); }
  catch (e) { tell('видеокарта не подошла (' + String(e.message || e).slice(0, 120) + ') — пробую процессор'); try { lmk && lmk.close(); } catch (_) {} lmk = await mk('CPU'); delegate = 'CPU'; warm(); }
  tell('распознавание готово: ' + delegate);
}
/* кадр для распознавания — копия видео на 2D-холсте (480 px): на айфоне видеокарта MediaPipe, читая сам <video>,
   временами получает чёрную текстуру и молча не находит рук; с холста — надёжно, и копировать вдвое меньше */
const fc = document.createElement('canvas'), fx = fc.getContext('2d', { willReadFrequently: true });
function grab() {
  const W = 480, H = Math.round(W * (vid.videoHeight || 480) / (vid.videoWidth || 640));
  if (fc.width !== W || fc.height !== H) { fc.width = W; fc.height = H; }
  fx.drawImage(vid, 0, 0, W, H); return fc;
}
/* средняя яркость кадра (по 64 точкам): ≈0 — камера отдаёт чёрное */
function dark() { const d = fx.getImageData(0, 0, fc.width, fc.height).data; let s = 0, k = 0; for (let i = 0; i < d.length; i += Math.floor(d.length / 64 / 4) * 4) { s += d[i] + d[i + 1] + d[i + 2]; k++; } return s / k / 3 < 4; }
let cpu = null;                                                       /* запасной детектор на процессоре — проверка «видеокарта слепа?» */
function detect(t, src) {
  if (t <= lastStamp) t = lastStamp + 1; lastStamp = t;                /* VIDEO-режим требует растущих меток времени */
  const t1 = performance.now(), r = lmk.detectForVideo(src, t), ms = performance.now() - t1;
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
let missT = 0, seeK = '';
async function pump() {
  if (!running) return;
  if (!busy && vid.readyState >= 2 && vid.currentTime !== lastT) {
    lastT = vid.currentTime; busy = true;
    try {
      const W = 480, H = Math.round(W * (vid.videoHeight || 480) / (vid.videoWidth || 640));
      let r;
      const src = grab();
      try { r = detect(performance.now(), src); }
      catch (e) {                                                       /* видеокарта упала на кадре — один раз на процессор */
        if (delegate !== 'GPU') throw e; tell('видеокарта упала на кадре — перехожу на процессор'); try { lmk.close(); } catch (_) {}
        const { FilesetResolver, HandLandmarker } = await import('./vendor/vision_bundle.mjs'), fs = await FilesetResolver.forVisionTasks('./vendor/wasm');
        lmk = await HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/hand_landmarker_lite.task', delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 2 });
        delegate = 'CPU'; busy = false; return pump(); }
      detMs = 0.85 * detMs + 0.15 * r.ms; n++;
      /* видеокарта 3 с не видит рук — раз в 2 с проверяем тот же кадр на процессоре; там рука есть — видеокарта
         «слепая» (бывает на айфоне), насовсем переходим на процессор */
      if (delegate === 'GPU' && !r.hands.length && missT && performance.now() - missT > 3000 && performance.now() - (pump.chk || 0) > 2000) {
        pump.chk = performance.now();
        if (dark()) { if (!pump.dk) { pump.dk = 1; tell('камера телефона отдаёт чёрный кадр — закрой и открой страницу заново'); } }
        else try {
          if (!cpu) { const { FilesetResolver, HandLandmarker } = await import('./vendor/vision_bundle.mjs'), fs = await FilesetResolver.forVisionTasks('./vendor/wasm');
            cpu = await HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/hand_landmarker_lite.task', delegate: 'CPU' }, runningMode: 'IMAGE', numHands: 2 }); }
          const rc = cpu.detect(src);
          if (rc.landmarks && rc.landmarks.length) { tell('видеокарта телефона не видела руку — перехожу на процессор'); try { lmk.close(); } catch (_) {}
            const { FilesetResolver, HandLandmarker } = await import('./vendor/vision_bundle.mjs'), fs = await FilesetResolver.forVisionTasks('./vendor/wasm');
            lmk = await HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/hand_landmarker_lite.task', delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 2 });
            delegate = 'CPU'; cpu.close(); cpu = null; }
        } catch (e) { console.warn(e); }
      }
      /* обе камеры, направленные на человека, дают незеркальный кадр «глазами наблюдателя» — как веб-камера ноутбука;
         зеркалит (как в зеркале) уже ноутбук, отражать здесь не нужно */
      const hands = r.hands;
      /* пустые кадры (рук не видно) — каждый 5-й: ноутбуку хватит как «я на связи», а брокер не забиваем */
      if (hands.length || (n % 5 === 0)) send(encodeHands(hands, { ms: Math.round(detMs) }), true);
      ov.width = 320; ov.height = Math.round(320 * H / W); oc.clearRect(0, 0, ov.width, ov.height); oc.strokeStyle = '#4cd28a'; oc.lineWidth = 3;
      r.hands.forEach(({ lm }) => { oc.beginPath(); BONES.forEach(([a, b]) => { oc.moveTo(lm[a].x * ov.width, lm[a].y * ov.height); oc.lineTo(lm[b].x * ov.width, lm[b].y * ov.height); }); oc.stroke(); });
      const now = performance.now(); if (now - t0 > 1000) { fps = n * 1000 / (now - t0); n = 0; t0 = now;
        $('stat').textContent = `${fps.toFixed(0)} кадр/с · ${detMs.toFixed(0)} мс · ${r.delegate === 'GPU' ? 'видеокарта' : 'процессор'}`; }
      /* главное, что нужно знать человеку: видит ли телефон руку (сразу, без ожидания секунды) */
      const k = r.hands.length ? 'ok' : 'no';
      if (k === 'ok') missT = 0; else if (!missT) missT = performance.now();
      const shown = k === 'ok' || performance.now() - missT > 600 ? k : seeK;          /* «не вижу» — после 0,6 с без руки, не мигает */
      if (shown !== seeK) { seeK = shown; const el = $('see'); el.hidden = false; el.className = shown;
        el.textContent = shown === 'ok' ? (r.hands.length === 2 ? '✋✋ Вижу обе руки' : '✋ Вижу руку') : 'Не вижу руку — подними ладонь перед камерой телефона, в 40–70 см';
        $('prev').className = shown === 'ok' ? 'see' : 'miss'; }
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
    /* брокер — основной путь: через него знакомимся, и через него же идут руки, если прямого канала нет */
    const list = [broker, ...BROKERS].filter((u, i, a) => u && a.indexOf(u) === i);
    if (!noBroker) {
      try { mq = await connectMqtt(list, (topic, text) => onCtl(text, 'интернет'), 3000); }
      catch (e) { if (!offer) { $('start').hidden = true; say('Нет связи с сервисом', 'Телефон не достучался до сервиса связи в интернете. Проверь интернет на телефоне и отсканируй код на ноутбуке ещё раз.'); return; }
        noBroker = true; }
    }
    if (mq) { mq.subscribe(ch + '/down');
      mq.onclose = () => { if (!(dc && dc.readyState === 'open')) say('Связь оборвалась', 'Нажми на ноутбуке «Новый код» и отсканируй его ещё раз.'); };
      tell('телефон на связи'); }
    $('start').hidden = true; say('Соединяюсь…', '');
    ready.then(() => { running = true; pump(); }, err => say('Не запустилось распознавание', 'Причина: ' + String(err && err.message || err) + '. Её видно и на ноутбуке.'));
    /* прямой канал — попытка в фоне: получится (одна сеть, без VPN) — руки пойдут им, быстрее */
    if (offer) direct().catch(e => { tell('прямой канал не сложился: ' + (e.message || e) + ' — работаю через интернет'); if (noBroker) say('Не соединилось', 'Прямой канал не сложился: ' + (e.message || e)); });
    if (!noBroker) setTimeout(() => { if (!linked) say('Ноутбук не отвечает', 'Проверь, что на ноутбуке открыто окно с QR-кодом, и отсканируй его ещё раз (или нажми там «Новый код»).'); }, 15000);
  } catch (e) {
    console.error(e); $('start').disabled = false;
    $('start').hidden = false; $('start').textContent = 'Начать';
    say('Нажми «Начать»', e && e.name === 'NotAllowedError' ? 'Нужен доступ к камере: нажми «Начать» и разреши, либо включи камеру для сайта в настройках Safari.' : String(e.message || e));
  }
};
/* сообщения ноутбука (с любого пути): пинг — отвечаем тем же путём; «пока» — ноутбук закрыл связь */
function onCtl(text, path) {
  let m; try { m = JSON.parse(text); } catch (_) { return; }
  if (m.k === 'p') {
    const pong = JSON.stringify({ k: 'q', t: m.t });
    if (path === 'прямо' && dc && dc.readyState === 'open') dc.send(pong); else if (mq) mq.publish(ch + '/up', pong);
    const via = dc && dc.readyState === 'open' ? 'напрямую' : 'через интернет';
    if (linked !== via) { linked = via; $('ans').hidden = true; say('Подключено — управляй руками', `Деталь — на экране ноутбука. Связь ${via}.`);
      $('prev').hidden = false; $('flip').hidden = $('stop').hidden = false; $('tip').hidden = false; }
  } else if (m.k === 'bye') { running = false; linked = ''; say('Ноутбук закрыл связь', 'Чтобы подключиться снова — «📱 Телефон» на ноутбуке и новый код.'); }
}
async function direct() {
  pc = new RTCPeerConnection({ iceServers: STUN });
  pc.ondatachannel = e => { dc = e.channel;
    dc.onopen = () => { $('ans').hidden = true; told.splice(0).forEach(m => send(m)); tell('прямой канал открыт — руки идут напрямую'); };
    dc.onmessage = e2 => onCtl(e2.data, 'прямо');
    dc.onclose = () => { if (running) tell('прямой канал закрылся — продолжаю через интернет'); }; };
  pc.onconnectionstatechange = () => { if (pc.connectionState !== 'failed') return; tell('прямой канал не сложился (VPN или разные сети) — работаю через интернет');
    if (noBroker) { $('ans').hidden = true; say('Не соединилось напрямую', 'Ноутбук и телефон должны быть в одной сети без VPN: включи на телефоне точку доступа, подключи к ней ноутбук и нажми на ноутбуке «Новый код».'); } };
  await pc.setRemoteDescription(unpackSDP(decodeURIComponent(offer), 'offer'));
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc, 2500);
  const ans = packSDP(pc.localDescription.sdp);                      /* ответ — строкой «1~…» */
  if (mq) mq.publish(ch + '/up', ans);
  /* код показываем всегда, пока не связались: сервис связи мог не дойти до ноутбука */
  if (!linked && !(dc && dc.readyState === 'open')) { drawQR($('ans'), ans); $('ans').hidden = false; say('Покажи камере ноутбука', ''); }
}

/* открыли по ссылке с ноутбука — запускаемся сами: нужно только разрешить камеру (кнопка — если браузер не дал без нажатия) */
if (chId) $('start').click();
$('flip').onclick = async () => { facing = facing === 'user' ? 'environment' : 'user'; try { await camera(); } catch (e) { console.warn(e); } };
$('stop').onclick = () => { running = false; try { send(JSON.stringify({ k: 'bye' })); dc && dc.close(); pc && pc.close(); mq && mq.close(); } catch (_) {} if (stream) stream.getTracks().forEach(t => t.stop()); if (lock) lock.release().catch(() => {});
  say('Остановлено', 'Закрой вкладку или отсканируй новый код с ноутбука.'); $('prev').hidden = $('flip').hidden = $('stop').hidden = $('tip').hidden = true; };
window.__sensor = { get pc() { return pc; }, get dc() { return dc; }, pause() { running = false; }, send: t => send(t), get dbg() { return { running, n, busy, lastT, ready: !!lmk, rs: vid.readyState, ct: vid.currentTime, mq: !!mq, buf: mq && mq.buffered }; } };   /* для автотестов */
