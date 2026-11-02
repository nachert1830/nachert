/* Ноутбук: телефон как датчик рук.
   start(): предложение соединения → QR-код со ссылкой на страницу-датчик (sensor.html#o=…) → веб-камера ноутбука
   ищет в кадре ответный QR-код с экрана телефона → прямой канал WebRTC. Дальше с телефона приходят только точки рук.
   Распознаватель QR (jsQR, 250 КБ) грузится только здесь, при сопряжении. */
import qrcode from './vendor/qr/qrcode.mjs';
import { packSDP, unpackSDP, gathered, STUN, decodeHands } from './link.js';

let jsqrP = null;
const loadJsQR = () => jsqrP || (jsqrP = new Promise((res, rej) => {
  if (window.jsQR) return res(window.jsQR);
  const s = document.createElement('script'); s.src = 'vendor/qr/jsQR.js'; s.onload = () => res(window.jsQR); s.onerror = () => rej(new Error('не загрузился распознаватель QR')); document.head.appendChild(s);
}));

export function drawQR(canvas, text) {
  const q = qrcode(0, 'L'); q.addData(text); q.make();
  const N = q.getModuleCount(), s = 6, m = 4; canvas.width = canvas.height = (N + 2 * m) * s;
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#000';
  for (let r = 0; r < N; r++) for (let k = 0; k < N; k++) if (q.isDark(r, k)) g.fillRect((k + m) * s, (r + m) * s, s, s);
}

export function createPairing({ onHands, onOpen, onClose, onStatus }) {
  let pc = null, dc = null, scan = null, ping = 0;
  const st = { state: 'idle', rtt: 0, fps: 0, phoneMs: 0, n: 0, t0: 0 };

  async function stopScan() { if (!scan) return; scan.stop = true; scan.stream && scan.stream.getTracks().forEach(t => t.stop()); scan = null; }

  /* ответ телефона — QR-кодом на экране телефона перед веб-камерой ноутбука */
  async function scanAnswer(video, apply) {
    const jsQR = await loadJsQR();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    scan = { stream, stop: false }; const my = scan;
    video.srcObject = stream; await video.play();
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    const tick = async () => {
      if (my.stop) return;
      const W = video.videoWidth, H = video.videoHeight;
      if (W) { c.width = W; c.height = H; g.drawImage(video, 0, 0);
        const code = jsQR(g.getImageData(0, 0, W, H).data, W, H, { inversionAttempts: 'dontInvert' });
        if (code && /^1~/.test(code.data)) { my.stop = true; try { await apply(code.data); } catch (e) { onStatus('Код считан, но не подошёл: ' + e.message + '. Нажми «Новый код».'); } return; } }
      setTimeout(tick, 120);
    };
    tick();
  }

  async function start(qrCanvas, video, opt = {}) {
    stop(); st.state = 'pairing';
    pc = new RTCPeerConnection({ iceServers: STUN });
    dc = pc.createDataChannel('hands', { ordered: false, maxRetransmits: 0 });   /* старые точки не нужны — без повторов */
    dc.onopen = () => { st.state = 'on'; st.t0 = performance.now(); st.n = 0; stopScan(); onOpen();
      ping = setInterval(() => { if (dc && dc.readyState === 'open') dc.send(JSON.stringify({ k: 'p', t: performance.now() })); }, 1000); };
    dc.onmessage = e => { const m = JSON.parse(e.data), now = performance.now();
      if (m.k === 'h') { st.n++; st.phoneMs = m.ms || 0; if (now - st.t0 > 1000) { st.fps = st.n * 1000 / (now - st.t0); st.n = 0; st.t0 = now; } onHands(decodeHands(m), now); }
      else if (m.k === 'q') st.rtt = 0.7 * st.rtt + 0.3 * (now - m.t); };
    dc.onclose = () => { if (st.state !== 'idle') { st.state = 'idle'; clearInterval(ping); onClose(); } };
    pc.onconnectionstatechange = () => { if (pc && pc.connectionState === 'failed') { onStatus('Не соединилось. Телефон и ноутбук должны быть в одной сети Wi-Fi (не гостевой). Нажми «Новый код».'); } };
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const code = packSDP(pc.localDescription.sdp);
    const url = new URL('sensor.html', location.href); url.hash = 'o=' + encodeURIComponent(code);
    drawQR(qrCanvas, url.href);
    onStatus('1. Наведи камеру айфона на код и открой ссылку. 2. Нажми там «Начать». 3. Поднеси экран телефона к веб-камере ноутбука.');
    if (opt.scan !== false) await scanAnswer(video, async text => { onStatus('Код телефона считан — соединяюсь…'); await pc.setRemoteDescription(unpackSDP(text, 'answer')); });
    return url.href;
  }

  function stop() {
    stopScan(); clearInterval(ping);
    const was = st.state; st.state = 'idle';
    try { dc && dc.close(); pc && pc.close(); } catch (_) {}
    pc = dc = null; if (was === 'on') onClose();
  }
  /* для тестов: ответ строкой, без камеры */
  async function answer(text) { await stopScan(); await pc.setRemoteDescription(unpackSDP(text, 'answer')); }
  return { start, stop, answer, st, get offerSDP() { return pc && pc.localDescription && pc.localDescription.sdp; } };
}
