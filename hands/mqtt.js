/* Минимальный клиент MQTT 3.1.1 поверх WebSocket — без библиотек.
   Нужен для связи «телефон — ноутбук» через публичный брокер, когда прямое WebRTC-соединение невозможно
   (VPN, мобильный интернет, разные сети): знакомство устройств и пересылка точек рук.
   Только то, что нужно: CONNECT, SUBSCRIBE, PUBLISH (QoS 0), PINGREQ. Сообщения — строки UTF-8. */

/* публичные брокеры: пробуем по очереди, берём первый, что ответил */
export const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];

const enc = new TextEncoder(), dec = new TextDecoder();
const varint = n => { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; o.push(b); } while (n > 0); return o; };
const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
const packet = (type, body) => new Uint8Array([type, ...varint(body.length), ...body]);

function connectOne(url, onMessage, ms) {
  return new Promise((resolve, reject) => {
    let ws; try { ws = new WebSocket(url, 'mqtt'); } catch (e) { reject(e); return; }
    ws.binaryType = 'arraybuffer';
    const id = 'nch-' + Math.random().toString(36).slice(2, 12);
    const timer = setTimeout(() => { try { ws.close(); } catch (_) {} reject(new Error('брокер не ответил: ' + url)); }, ms);
    let buf = new Uint8Array(0), ping = 0, pid = 1, ready = false;
    const send = p => { if (ws.readyState === 1) ws.send(p); };
    ws.onopen = () => send(packet(0x10, [...str('MQTT'), 4, 0x02, 0, 30, ...str(id)]));   /* clean session, keepalive 30 с */
    ws.onerror = () => { if (!ready) { clearTimeout(timer); reject(new Error('нет соединения с брокером: ' + url)); } };
    ws.onclose = () => { clearInterval(ping); api.closed = true; api.onclose && api.onclose(); };
    ws.onmessage = e => {
      const a = new Uint8Array(e.data), b = new Uint8Array(buf.length + a.length); b.set(buf); b.set(a, buf.length); buf = b;
      for (;;) {                                                     /* разбор пакетов: тип, длина-varint, тело */
        if (buf.length < 2) break;
        let len = 0, mul = 1, i = 1, byte;
        do { if (i >= buf.length) return; byte = buf[i++]; len += (byte & 127) * mul; mul *= 128; } while (byte & 128);
        if (buf.length < i + len) break;
        const type = buf[0] & 0xf0, body = buf.subarray(i, i + len); buf = buf.slice(i + len);
        if (type === 0x20) { if (body[1] !== 0) { clearTimeout(timer); reject(new Error('брокер отказал (' + body[1] + ')')); return; }
          ready = true; clearTimeout(timer); ping = setInterval(() => send(new Uint8Array([0xc0, 0])), 20000); resolve(api); }
        else if (type === 0x30) { const tl = (body[0] << 8) | body[1], topic = dec.decode(body.subarray(2, 2 + tl)); onMessage(topic, dec.decode(body.subarray(2 + tl))); }
      }
    };
    const api = {
      url, closed: false, onclose: null,
      subscribe(topic) { const p = pid++; send(packet(0x82, [p >> 8, p & 255, ...str(topic), 0])); },
      publish(topic, text) { const t = str(topic), b = enc.encode(text), body = new Uint8Array(t.length + b.length); body.set(t); body.set(b, t.length); send(packet(0x30, [...body])); },
      get buffered() { return ws.bufferedAmount; },
      close() { clearInterval(ping); try { send(new Uint8Array([0xe0, 0])); ws.close(); } catch (_) {} }
    };
  });
}

/* подключиться к первому доступному брокеру из списка */
export async function connectMqtt(urls, onMessage, ms = 6000) {
  const errs = [];
  for (const u of urls) { try { return await connectOne(u, onMessage, ms); } catch (e) { errs.push(e.message); } }
  throw new Error(errs.join('; '));
}

/* ко ВСЕМ брокерам сразу, каждый со своим переподключением: ноутбук и телефон слушают все — не разойдутся по разным
   брокерам (одному провайдер режет один, другому — другой). onMessage(topic, text, conn) — conn: какой брокер принёс;
   alive() — false, и связь больше не восстанавливаем. onUp(conn) — брокер подключился (в т. ч. заново). */
export function linkAll(urls, onMessage, topic, alive, onUp) {
  const live = new Set();
  urls.forEach(u => (function go(d) { setTimeout(() => {
    if (!alive()) return;
    let me = null;
    connectOne(u, (t, x) => onMessage(t, x, me), 6000).then(c => {
      if (!alive()) { c.close(); return; }
      me = c; live.add(c); c.subscribe(topic);
      c.onclose = () => { live.delete(c); go(1000); };
      if (onUp) onUp(c);
    }).catch(() => go(Math.min(10000, (d || 1000) * 2)));
  }, d || 0); })(0));
  return { live, publish(t, x) { live.forEach(c => c.publish(t, x)); }, close() { const a = [...live]; live.clear(); a.forEach(c => c.close()); } };
}
