/* Ноутбук: телефон как датчик рук. Один путь — поток WebRTC (напрямую, а где прямо нельзя — через TURN, тот же поток).
   start(): QR-код со ссылкой на страницу-датчик (sensor.html#o=предложение WebRTC&r=канал&s=наша функция). Телефон сканирует —
   ответ телефона приходит через нашу функцию в Яндекс Облаке (только знакомство, ~1 КБ), дальше руки — потоком WebRTC.
   Видео остаётся на телефоне. */
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
  let pc = null, dc = null, ping = 0, applied = false, ch = '', lastSeen = 0, watch = 0;
  const st = { state: 'idle', path: '', rtt: 0, fps: 0, phoneMs: 0, n: 0, t0: 0, log: [] };      /* path: 'прямо' — поток WebRTC */

  const opened = () => {
    st.path = 'прямо'; lastSeen = performance.now();
    if (st.state === 'on') return;
    st.state = 'on'; st.t0 = performance.now(); st.n = 0; onOpen();
    clearInterval(ping); ping = setInterval(sendPing, 1000);
    /* сторож — только когда руки уже шли: до этого телефон может долго грузить и прогревать модель */
    clearInterval(watch); watch = setInterval(() => { if (st.state === 'on' && st.got && performance.now() - lastSeen > 10000) { onStatus('Телефон пропал'); stop(); } }, 1500);
  };
  function sendPing() { if (dc && dc.readyState === 'open') dc.send(JSON.stringify({ k: 'p', t: performance.now() })); }
  /* сообщение телефона (поток WebRTC) */
  function onMsg(text) {
    let m; try { m = JSON.parse(text); } catch (_) { return; }
    const now = performance.now(); lastSeen = now;
    if (m.k === 'h') {
      st.got = true; st.n++; st.phoneMs = m.ms || 0; if (now - st.t0 > 1000) { st.fps = st.n * 1000 / (now - st.t0); st.n = 0; st.t0 = now; }
      onHands(decodeHands(m), now);
    } else if (m.k === 'q') st.rtt = 0.7 * st.rtt + 0.3 * (now - m.t);
    else if (m.k === 's') { st.log.push(m.text); onStatus('Телефон: ' + m.text); }
    else if (m.k === 'bye') { onStatus('Телефон отключился'); stop(); }
  }
  async function apply(text) {
    if (applied || !pc) return; applied = true;
    onStatus('Телефон ответил — соединяюсь…');
    try { await pc.setRemoteDescription(unpackSDP(text, 'answer')); } catch (e) { onStatus('Не соединилось (' + e.message + ') — нажми «Новый код»'); }
  }

  async function start(qrCanvas, video, opt = {}) {
    stop(); st.state = 'pairing'; applied = false; st.path = ''; st.log = []; st.got = false;
    ch = newId(); const my = ch;
    const sig = opt.sig !== undefined ? opt.sig : (self.SCAN_API || '');
    if (!sig) throw new Error('не задан адрес связи (lk/scan/config.js)');
    onStatus('Готовлю код…');
    /* Chrome без разрешения камеры прячет адрес ноутбука за «….local», а Safari такие имена не разрешает —
       прямой путь не сложится. С разрешением камеры адреса настоящие: на миг включаем и сразу гасим */
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); s.getTracks().forEach(t => t.stop()); } catch (_) {}
    pc = new RTCPeerConnection({ iceServers: STUN });
    dc = pc.createDataChannel('hands', { ordered: false, maxRetransmits: 0 });   /* старые точки не нужны — без повторов */
    dc.onopen = () => opened();
    dc.onmessage = e => onMsg(e.data);
    dc.onclose = () => { if (st.state === 'on') { onStatus('Связь с телефоном закрылась — нажми «Новый код»'); stop(); } };
    pc.onconnectionstatechange = () => { if (pc && pc.connectionState === 'failed' && st.state === 'pairing') onStatus('Не соединилось — нажми «Новый код»'); };
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc, 2500);
    if (ch !== my) return '';
    const url = new URL('sensor.html', location.href);
    url.hash = 'o=' + encodeURIComponent(packSDP(pc.localDescription.sdp)) + '&r=' + ch + '&s=' + encodeURIComponent(sig);
    drawQR(qrCanvas, url.href);
    onStatus('Отсканируй код телефоном.');
    /* ответ телефона — через нашу функцию (?sig=), опрос раз в 0,4 с, пока не соединились */
    (async function poll() {
      while (ch === my && st.state === 'pairing' && !applied) {
        try { const r = await fetch(sig + (sig.includes('?') ? '&' : '?') + 'sig=' + my, { cache: 'no-store' }); const j = await r.json(); if (j && j.a && ch === my) { apply(j.a); break; } } catch (_) {}
        await new Promise(r => setTimeout(r, 400));
      }
    })();
    return url.href;
  }

  function stop() {
    clearInterval(ping); clearInterval(watch);
    const was = st.state; st.state = 'idle';
    try { if (dc && dc.readyState === 'open') dc.send(JSON.stringify({ k: 'bye' })); dc && dc.close(); pc && pc.close(); } catch (_) {}
    pc = dc = null; if (was === 'on') onClose();
  }
  /* для тестов: ответ строкой */
  async function answer(text) { await apply(text); }
  return { start, stop, answer, st, get offerSDP() { return pc && pc.localDescription && pc.localDescription.sdp; } };
}
