/* Ноутбук: телефон как датчик рук.
   start(): QR-код со ссылкой на страницу-датчик (sensor.html#o=предложение&r=канал&q=брокер). Телефон сканирует его —
   и всё. Связь двумя путями сразу:
     • брокер MQTT (публичный, по WebSocket) — знакомство устройств и запасной путь для точек рук: работает через
       любые сети — VPN, мобильный интернет, разные Wi-Fi;
     • прямой канал WebRTC — если устройства видят друг друга (одна сеть, без VPN): быстрее, без посредника.
   Брокер недоступен (провайдер его блокирует, нет интернета; ноутбук в точке доступа телефона) — знакомство без сети:
   телефон показывает ответный QR-код, ноутбук читает его своей камерой (jsQR) — дальше руки идут напрямую.
   Точки рук принимаются с любого пути; телефон сам выбирает прямой, когда он есть.
   Через брокер идут только координаты пальцев (~0,5 КБ на кадр) — видео остаётся на телефоне. */
import qrcode from './vendor/qr/qrcode.mjs';
import { packSDP, unpackSDP, gathered, STUN, decodeHands } from './link.js';
import { connectMqtt, BROKERS } from './mqtt.js';

export function drawQR(canvas, text) {
  const q = qrcode(0, 'L'); q.addData(text); q.make();
  const N = q.getModuleCount(), s = 6, m = 4; canvas.width = canvas.height = (N + 2 * m) * s;
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#000';
  for (let r = 0; r < N; r++) for (let k = 0; k < N; k++) if (q.isDark(r, k)) g.fillRect((k + m) * s, (r + m) * s, s, s);
}
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');

export function createPairing({ onHands, onOpen, onClose, onStatus }) {
  let pc = null, dc = null, mq = null, ping = 0, applied = false, ch = '', lastSeen = 0, watch = 0, scan = null;
  const st = { state: 'idle', path: '', rtt: 0, fps: 0, phoneMs: 0, n: 0, t0: 0, log: [] };      /* path: 'прямо' | 'интернет' */

  const opened = path => {
    st.path = path; lastSeen = performance.now();
    if (st.state === 'on') { onStatus('Телефон: связь ' + (path === 'прямо' ? 'напрямую' : 'через интернет')); return; }
    st.state = 'on'; st.t0 = performance.now(); st.n = 0; onOpen();
    clearInterval(ping); ping = setInterval(sendPing, 1000);
    /* телефон замолчал на 6 с (закрыли вкладку, ушёл из сети) — считаем отключённым */
    /* сторож — только когда руки уже шли: до этого телефон может долго грузить и прогревать модель */
    clearInterval(watch); watch = setInterval(() => { if (st.state === 'on' && st.got && performance.now() - lastSeen > 10000) { onStatus('Телефон пропал'); stop(); } }, 1500);
  };
  function sendPing() {
    const m = JSON.stringify({ k: 'p', t: performance.now() });
    if (dc && dc.readyState === 'open') dc.send(m); else if (mq) mq.publish(ch + '/down', m);
  }
  /* сообщение телефона — с любого пути */
  function onMsg(text, path) {
    if (/^1~/.test(text)) { apply(text); return; }
    let m; try { m = JSON.parse(text); } catch (_) { return; }
    const now = performance.now(); lastSeen = now;
    if (st.state !== 'on' && m.k !== 'bye') opened(path);                 /* телефон на связи — любое его сообщение */
    if (m.k === 'h') {
      if (st.state !== 'on') opened(path);
      else if (path === 'прямо' && st.path !== 'прямо') opened('прямо');  /* прямой путь появился позже — переходим на него */
      if (path === 'интернет' && st.path === 'прямо') return;           /* прямой путь есть — дубли через брокер не нужны */
      st.got = true; st.n++; st.phoneMs = m.ms || 0; if (now - st.t0 > 1000) { st.fps = st.n * 1000 / (now - st.t0); st.n = 0; st.t0 = now; }
      onHands(decodeHands(m), now);
    } else if (m.k === 'q') st.rtt = 0.7 * st.rtt + 0.3 * (now - m.t);
    else if (m.k === 's') { st.log.push(m.text); onStatus('Телефон: ' + m.text); }
    else if (m.k === 'bye') { onStatus('Телефон отключился'); stop(); }
  }
  async function apply(text) {
    if (applied || !pc) return; applied = true;
    stopScan(); onStatus('Телефон ответил — соединяюсь…');
    try { await pc.setRemoteDescription(unpackSDP(text, 'answer')); } catch (e) { onStatus('Прямой канал не собрался (' + e.message + ') — работаем через интернет'); }
  }

  async function start(qrCanvas, video, opt = {}) {
    stop(); st.state = 'pairing'; applied = false; st.path = ''; st.log = []; st.got = false;
    ch = 'nachert/' + newId();
    const brokers = opt.brokers || BROKERS;
    onStatus('Подключаюсь к сервису связи…');
    /* брокер — первым: через него придёт ответ телефона и, если нужно, точки рук. Не ответил за 3 с — обходимся без него */
    try { mq = await connectMqtt(brokers, (topic, text) => onMsg(text, 'интернет'), opt.brokerMs || 3000);
      mq.subscribe(ch + '/up');
      mq.onclose = () => { if (st.state === 'pairing') onStatus('Связь с сервисом оборвалась — нажми «Новый код»'); }; }
    catch (e) { mq = null; console.warn('брокер недоступен — знакомство через ответный QR', e); }
    if (st.state !== 'pairing') return '';
    /* Chrome без разрешения камеры прячет адрес ноутбука за «….local», а Safari такие имена не разрешает —
       прямой канал не сложится. С разрешением камеры адреса настоящие: на миг включаем и сразу гасим */
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); s.getTracks().forEach(t => t.stop()); } catch (_) {}
    let code = '';
    try {
      pc = new RTCPeerConnection({ iceServers: STUN });
      dc = pc.createDataChannel('hands', { ordered: false, maxRetransmits: 0 });   /* старые точки не нужны — без повторов */
      dc.onopen = () => opened('прямо');
      dc.onmessage = e => onMsg(e.data, 'прямо');
      dc.onclose = () => { if (st.path === 'прямо' && st.state === 'on') { st.path = 'интернет'; onStatus('Прямой канал закрылся — продолжаю через интернет'); } };
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc, 2500);
      code = packSDP(pc.localDescription.sdp);
    } catch (e) { console.warn('прямой канал недоступен', e); code = ''; }
    if (!mq && !code) throw new Error('брокер не ответил, а прямой канал этот браузер не умеет');
    const url = new URL('sensor.html', location.href);
    url.hash = (code ? 'o=' + encodeURIComponent(code) + '&' : '') + 'r=' + ch.split('/')[1] + (mq ? '&q=' + encodeURIComponent(mq.url) : '&n=1');
    drawQR(qrCanvas, url.href);
    if (mq) onStatus('Наведи камеру айфона на код и открой ссылку — дальше всё само. Работает и с VPN, и через мобильный интернет.');
    else { onStatus('Сервис связи недоступен — подключимся напрямую. 1) Отсканируй код телефоном. 2) Телефон покажет свой код — поднеси его к камере ноутбука. Ноутбук и телефон — в одной сети (например, ноутбук в точке доступа телефона).');
      if (!opt.noScan) startScan(video).catch(e => onStatus('Камера ноутбука не включилась (' + (e.message || e) + ') — нужен доступ к камере, чтобы прочитать код телефона.')); }
    return url.href;
  }

  /* ответный QR телефона — камерой ноутбука */
  async function startScan(video) {
    stopScan();
    if (!window.jsQR) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = new URL('vendor/qr/jsQR.js', import.meta.url).href; s.onload = res; s.onerror = () => rej(new Error('jsQR не загрузился')); document.head.appendChild(s); });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    const v = video || document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = stream; v.hidden = false; await v.play();
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    scan = { stream, v, t: setInterval(() => {
      if (v.readyState < 2) return; const k = Math.min(1, 960 / v.videoWidth); c.width = v.videoWidth * k; c.height = v.videoHeight * k;
      g.drawImage(v, 0, 0, c.width, c.height); const r = window.jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' });
      if (r && /^1~/.test(r.data)) apply(r.data); }, 200) };
  }
  function stopScan() { if (!scan) return; clearInterval(scan.t); scan.stream.getTracks().forEach(t => t.stop()); scan.v.srcObject = null; scan.v.hidden = true; scan = null; }

  function stop() {
    clearInterval(ping); clearInterval(watch); stopScan();
    const was = st.state; st.state = 'idle';
    try { if (mq) { mq.publish(ch + '/down', JSON.stringify({ k: 'bye' })); mq.close(); } } catch (_) {}
    try { dc && dc.close(); pc && pc.close(); } catch (_) {}
    pc = dc = mq = null; if (was === 'on') onClose();
  }
  /* для тестов: ответ строкой */
  async function answer(text) { await apply(text); }
  return { start, stop, answer, st, get offerSDP() { return pc && pc.localDescription && pc.localDescription.sdp; } };
}
