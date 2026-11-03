/* Ноутбук: телефон как датчик рук — один QR, без брокеров и VPN.
   start(): QR-код со ссылкой на страницу-датчик (sensor.html#o=предложение WebRTC&r=канал&s=наша функция). Телефон сканирует —
   и всё: ответ телефона приходит через нашу функцию в Яндекс Облаке (доступна из России), руки — прямым каналом WebRTC.
   Ноутбук и телефон — в одной сети (ноутбук в точке доступа телефона или общий Wi-Fi). Видео остаётся на телефоне. */
import qrcode from './vendor/qr/qrcode.mjs';
import { packSDP, unpackSDP, gathered, STUN, decodeHands } from './link.js';

export function drawQR(canvas, text) {
  const q = qrcode(0, 'L'); q.addData(text); q.make();
  const N = q.getModuleCount(), s = 6, m = 4; canvas.width = canvas.height = (N + 2 * m) * s;
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#000';
  for (let r = 0; r < N; r++) for (let k = 0; k < N; k++) if (q.isDark(r, k)) g.fillRect((k + m) * s, (r + m) * s, s, s);
}
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');

export function createPairing({ onHands, onOpen, onClose, onStatus }) {
  let relaying = '', pc = null, dc = null, mq = null, ping = 0, applied = false, ch = '', lastSeen = 0, watch = 0, scan = null, SIG = '';
  const st = { state: 'idle', path: '', rtt: 0, fps: 0, phoneMs: 0, n: 0, t0: 0, log: [] };      /* path: 'прямо' | 'интернет' */

  const opened = path => {
    stopScan(); st.path = path; lastSeen = performance.now();
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
  /* запасной путь рук — через нашу функцию (?hand=): длинный опрос, пока прямой канал не открылся.
     Нужен, когда прямой не складывается: точка доступа айфона (Safari не ищет путь через неё), разные сети */
  async function relay() {
    if (!SIG || relaying === ch) return; relaying = ch; const my = ch, id = ch.split('/')[1]; let after = 0;
    while (ch === my && st.state !== 'idle' && !(dc && dc.readyState === 'open')) {
      try { const r = await fetch(SIG + (SIG.includes('?') ? '&' : '?') + 'hand=' + id + '&after=' + after, { cache: 'no-store' }); const j = await r.json();
        if (j && j.ok) { if (j.seq < after) after = 0; else { after = j.seq; (j.m || []).forEach(x => onMsg(x, 'интернет')); } } else await new Promise(r => setTimeout(r, 500)); }
      catch (_) { await new Promise(r => setTimeout(r, 500)); }
    }
    if (relaying === my) relaying = '';
  }

  async function start(qrCanvas, video, opt = {}) {
    stop(); st.state = 'pairing'; applied = false; st.path = ''; st.log = []; st.got = false;
    ch = 'nachert/' + newId(); const my = ch;
    const sig = opt.sig !== undefined ? opt.sig : (self.SCAN_API || ''); SIG = sig;
    onStatus('Готовлю код…');
    /* Chrome без разрешения камеры прячет адрес ноутбука за «….local», а Safari такие имена не разрешает —
       прямой канал не сложится. С разрешением камеры адреса настоящие: на миг включаем и сразу гасим */
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); s.getTracks().forEach(t => t.stop()); } catch (_) {}
    let code = '';
    try {
      pc = new RTCPeerConnection({ iceServers: STUN });
      dc = pc.createDataChannel('hands', { ordered: false, maxRetransmits: 0 });   /* старые точки не нужны — без повторов */
      dc.onopen = () => opened('прямо');
      dc.onmessage = e => onMsg(e.data, 'прямо');
      dc.onclose = () => { if (st.state === 'on') { st.path = 'интернет'; onStatus('Прямой канал закрылся — продолжаю через сервер'); relaying = ''; relay(); } };
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc, 2500);
      code = packSDP(pc.localDescription.sdp);
    } catch (e) { console.warn('прямой канал недоступен', e); code = ''; }
    if (ch !== my) return '';
    if (!code || !sig) throw new Error(!code ? 'этот браузер не умеет WebRTC' : 'не задан адрес связи (lk/scan/config.js)');
    const url = new URL('sensor.html', location.href);
    url.hash = (code ? 'o=' + encodeURIComponent(code) + '&' : '') + 'r=' + ch.split('/')[1] + (sig ? '&s=' + encodeURIComponent(sig) : '');
    drawQR(qrCanvas, url.href);
    onStatus('Отсканируй код телефоном.');
    relay();   /* запасной путь слушаем сразу (длинный опрос ~1 раз в секунду, пока ждём) */
    /* ответ телефона — опросом нашей функции (раз в 0,7 с, пока не соединились) */
    (async function poll() {
      const id = ch.split('/')[1];
      while (ch === my && st.state === 'pairing' && !applied) {
        try { const r = await fetch(sig + (sig.includes('?') ? '&' : '?') + 'sig=' + id, { cache: 'no-store' }); const j = await r.json(); if (j && j.a && ch === my) { apply(j.a); break; } } catch (_) {}
        await new Promise(r => setTimeout(r, 700));
      }
    })();
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
      g.drawImage(v, 0, 0, c.width, c.height); const r = window.jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
      if (r && /^1~/.test(r.data)) apply(r.data); }, 150) };
  }
  function stopScan() { if (!scan) return; clearInterval(scan.t); scan.stream.getTracks().forEach(t => t.stop()); scan.v.srcObject = null; scan.v.hidden = true; scan = null; }

  function stop() {
    clearInterval(ping); clearInterval(watch); stopScan();
    const was = st.state; st.state = 'idle';
    const m = mq; mq = null; try { if (m) { m.publish(ch + '/down', JSON.stringify({ k: 'bye' })); m.close(); } } catch (_) {}
    try { dc && dc.close(); pc && pc.close(); } catch (_) {}
    pc = dc = mq = null; if (was === 'on') onClose();
  }
  /* для тестов: ответ строкой */
  async function answer(text) { await apply(text); }
  return { start, stop, answer, scan: v => startScan(v), st, get offerSDP() { return pc && pc.localDescription && pc.localDescription.sdp; } };
}
