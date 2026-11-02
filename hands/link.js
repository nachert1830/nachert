/* Связь «телефон — датчик рук, ноутбук — экран»: прямое WebRTC-соединение без серверов.
   Знакомство устройств — двумя QR-кодами: ноутбук показывает предложение (offer) в ссылке на страницу-датчик,
   телефон показывает ответ (answer), ноутбук считывает его своей веб-камерой.
   Чтобы описание соединения влезло в QR-код, из SDP берём только существенное — ключи ICE, отпечаток DTLS,
   адреса — и собираем SDP обратно по шаблону канала данных (~200 символов вместо ~1500).
   По каналу идут только координаты точек рук — видео остаётся на телефоне. */

export const STUN = [{ urls: 'stun:stun.l.google.com:19302' }];   /* адрес снаружи — на случай, если локальные адреса не сойдутся */
const PRIO = { host: 2122260223, srflx: 1686052607, prflx: 1845501695, relay: 41885439 };
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));

/* SDP → короткая строка: «1~ufrag~pwd~отпечаток~setup~кандидаты» (кандидаты через «;»: тип,адрес,порт) */
export function packSDP(sdp) {
  const get = re => { const m = sdp.match(re); return m ? m[1].trim() : ''; };
  const ufrag = get(/a=ice-ufrag:(.+)/), pwd = get(/a=ice-pwd:(.+)/), fp = get(/a=fingerprint:sha-256 (.+)/), setup = get(/a=setup:(.+)/);
  if (!ufrag || !pwd || !fp) throw new Error('в описании соединения нет ключей ICE или отпечатка');
  const cands = [], seen = new Set();
  for (const line of sdp.split(/\r?\n/)) {
    const m = line.match(/^a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ (\w+)/i); if (!m) continue;
    const key = m[1] + ':' + m[2]; if (seen.has(key)) continue; seen.add(key);
    cands.push([m[3][0], m[1], m[2]].join(','));                      /* h — host, s — srflx, p — prflx */
  }
  const fpb = b64u(Uint8Array.from(fp.split(':').map(h => parseInt(h, 16))));
  return ['1', ufrag, pwd, fpb, { actpass: 'p', active: 'a', passive: 's' }[setup] || 'p', cands.slice(0, 6).join(';')].join('~');
}

/* короткая строка → SDP канала данных (тот же формат, что дают Chrome и Safari) */
export function unpackSDP(s, type) {
  const [v, ufrag, pwd, fpb, st, cs] = s.split('~');
  if (v !== '1' || !pwd) throw new Error('код соединения не распознан');
  const fp = [...unb64u(fpb)].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const setup = { p: 'actpass', a: 'active', s: 'passive' }[st] || 'actpass';
  const T = { h: 'host', s: 'srflx', p: 'prflx', r: 'relay' };
  const cand = (cs || '').split(';').filter(Boolean).map((c, i) => { const [t, addr, port] = c.split(','), typ = T[t] || 'host';
    return `a=candidate:${i + 1} 1 udp ${PRIO[typ] - i} ${addr} ${port} typ ${typ}` + (typ === 'host' ? '' : ' raddr 0.0.0.0 rport 0'); });
  const sdp = ['v=0', `o=- ${Date.now()} 2 IN IP4 127.0.0.1`, 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
    `a=ice-ufrag:${ufrag}`, `a=ice-pwd:${pwd}`, `a=fingerprint:sha-256 ${fp}`, `a=setup:${setup}`, 'a=mid:0',
    'a=sctp-port:5000', 'a=max-message-size:262144', ...cand, 'a=end-of-candidates', ''].join('\r\n');
  return { type, sdp };
}

/* дождаться, пока соберутся адреса (или 3 с — Safari иногда «молчит» с концом сбора) */
export function gathered(pc, ms = 3000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(res => { const t = setTimeout(res, ms); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
}

/* сообщения канала. Точки — 4 знака после запятой (точнее не нужно, сообщение ~1 КБ на две руки) */
export const encodeHands = (hands, extra) => JSON.stringify(Object.assign({ k: 'h', h: hands.map(h => [h.handed || '', +(+h.score).toFixed(2), h.lm.flatMap(p => [+p.x.toFixed(4), +p.y.toFixed(4), +(p.z || 0).toFixed(4)])]) }, extra || {}));
export const decodeHands = m => m.h.map(([handed, score, a]) => ({ handed: handed || null, score, lm: Array.from({ length: a.length / 3 }, (_, i) => ({ x: a[3 * i], y: a[3 * i + 1], z: a[3 * i + 2] })) }));
