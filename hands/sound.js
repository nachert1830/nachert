/* Тихий звуковой отклик на жесты (Web Audio, синтез — без файлов). По умолчанию выключен.
   AudioContext создаётся по первому включению: браузеры разрешают звук только после действия пользователя. */
let ac = null, master = null, on = false;

function ensure() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ac = new AC(); master = ac.createGain(); master.gain.value = 0.05; master.connect(ac.destination); return ac;
}
/* короткий тон: частота от f0 к f1 за dur с, мягкая атака и затухание */
function blip(f0, f1, dur, type = 'sine', vol = 1) {
  if (!on || !ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
/* шумовой всплеск — для «взял деталь»: белый шум через полосовой фильтр с быстрым затуханием */
function burst(f, dur, vol = 1) {
  if (!on || !ac) return;
  const t = ac.currentTime, n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = b; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.8; g.gain.value = vol;
  src.connect(bp); bp.connect(g); g.connect(master); src.start(t);
}
const SND = {
  'view': () => blip(660, 990, 0.12, 'triangle', 0.5),
  'pinch-on': () => blip(1320, 1760, 0.06, 'sine', 0.9),
  'pinch-off': () => blip(1100, 740, 0.07, 'sine', 0.6),
  'ui-click': () => blip(1700, 2100, 0.05, 'triangle', 0.7),
  'grab': () => { blip(300, 520, 0.09, 'triangle', 0.9); burst(900, 0.05, 0.5); },
  'menu-open': () => blip(520, 780, 0.1, 'triangle', 0.6),
  'menu-sel': () => blip(1900, 1900, 0.025, 'sine', 0.35),
  'menu': () => blip(780, 1170, 0.1, 'triangle', 0.6),
  'explode-step': () => blip(2400, 2600, 0.03, 'square', 0.25),
  'reset': () => { blip(500, 1500, 0.22, 'sine', 0.8); setTimeout(() => blip(1500, 2200, 0.12, 'sine', 0.5), 120); },
  'mode': e => { if (e.mode === 'zoom') blip(880, 990, 0.05, 'triangle', 0.5); }
};
export const sound = {
  get on() { return on; },
  set(v) { on = !!v; if (on && ensure() && ac.state === 'suspended') ac.resume(); },
  play(events) { if (on) events.forEach(e => SND[e.type] && SND[e.type](e)); }
};
