/* Обучение жестам и контекстная подсказка.
   Обучение: при первом включении камеры — 6 шагов, каждый засчитывается, когда человек действительно
   сделал жест (смотрим на кадры контроллера и вид). Пройдено — запоминается; заново — кнопкой «🎓».
   Подсказка внизу: только жесты, уместные прямо сейчас (рука не видна / рука в кадре / идёт жест). */

const STEPS = [
  { i: '✋', t: 'Подними руку перед камерой', d: 'Ладонью к экрану, в полуметре от камеры.',
    ok: (s, f) => f && f.hands.some(h => h.present && !h.ignored) && (s.seen = (s.seen || 0) + 1) > 12 },
  { i: '✊', t: 'Схвати деталь и поверни', d: 'Сожми кулак (или сомкни большой и указательный) и веди руку. Разожми на ходу — докрутится.',
    ok: (s, f, v) => { if (s.y0 == null) s.y0 = v.yaw; return Math.abs(v.yaw - s.y0) > 1.2; } },
  { i: '🤏🤏', t: 'Приблизь двумя руками', d: 'Сомкни пальцы на обеих руках и разведи руки в стороны.',
    ok: (s, f, v) => { if (s.z0 == null) s.z0 = v.zoom; return Math.abs(Math.log(v.zoom / s.z0)) > 0.25; } },
  { i: '👏', t: 'Хлопни в ладоши', d: 'Деталь разлетится на части. Ещё хлопок — соберётся.',
    ok: (s, f, v, ev) => ev.some(e => e.type === 'clap') },
  { i: '🖐', t: 'Разрежь деталь ребром ладони', d: 'Поставь ладонь ребром к камере, горизонтально, и веди вверх-вниз.',
    ok: (s, f) => f && f.mode === 'section' && (s.n = (s.n || 0) + 1) > 15 },
  { i: '✋', t: 'Верни всё как было', d: 'Держи открытую ладонь полторы секунды.',
    ok: (s, f, v, ev) => ev.some(e => e.type === 'reset') }
];

export function createCoach(root, { store, load, onStep }) {
  const box = document.createElement('div'); box.id = 'coach'; box.setAttribute('role', 'status'); box.hidden = true;
  const hint = document.createElement('div'); hint.id = 'hint'; hint.hidden = true;
  root.appendChild(box); root.appendChild(hint);
  let k = -1, st = {}, doneT = 0;

  function show() {
    if (k < 0) { box.hidden = true; return; }
    if (k >= STEPS.length) {
      box.hidden = false; box.className = 'done';
      box.innerHTML = `<div class="ci">🎉</div><div><b>Готово — ты управляешь голограммой</b><p>Ещё: ☝️ указательный палец — что это за часть; 🫰 щелчок пальцами — стандартные виды;
        ✊✊ два кулака — разобрать плавно. Кнопка «🎓» — пройти снова.</p></div><button type="button" class="cx" aria-label="Закрыть">✕</button>`;
      box.querySelector('.cx').onclick = () => stop(); return;
    }
    const S = STEPS[k];
    box.hidden = false; box.className = '';
    box.innerHTML = `<div class="ci">${S.i}</div><div><small>шаг ${k + 1} из ${STEPS.length}</small><b>${S.t}</b><p>${S.d}</p>
      <div class="dots">${STEPS.map((_, i) => `<i class="${i < k ? 'ok' : i === k ? 'now' : ''}"></i>`).join('')}</div></div>
      <button type="button" class="cx">Пропустить</button>`;
    box.querySelector('.cx').onclick = () => { store('hands.tutor', '1'); stop(); };
  }
  function start() { k = 0; st = {}; show(); }
  function stop() { k = -1; show(); }

  /* кадр контроллера, вид, события — двигаем обучение и обновляем подсказку */
  function update(frame, view, events, camOn) {
    if (k >= 0 && k < STEPS.length && STEPS[k].ok(st, frame, view, events || [])) {
      k++; st = {}; onStep && onStep(k); show();
      if (k >= STEPS.length) { store('hands.tutor', '1'); doneT = performance.now(); }
    }
    if (k >= STEPS.length && performance.now() - doneT > 9000) stop();
    hint.textContent = k >= 0 && k < STEPS.length ? '' : tip(frame, view, camOn);
    hint.hidden = !hint.textContent;
  }
  function tip(f, v, camOn) {
    if (!camOn) return '';
    const n = f ? f.hands.filter(h => h.present).length : 0;
    if (!n) return '✋ Подними руку перед камерой';
    if (f.hands.some(h => h.present && h.ignored)) return '↔ Рука у края кадра — ближе к центру';
    switch (f.mode) {
      case 'rotate': return 'Веди руку — вращение · разожми на ходу — докрутится · вторая рука: 🤏 — зум, ✊ — разобрать';
      case 'zoom': return 'Разводи и своди руки — приближение';
      case 'explode': return 'Разводи кулаки — разбор, своди — сборка';
      case 'section': return 'Веди ребром ладони · убери руку — разрез останется · ✋ 1,5 с — убрать';
      case 'point': return 'Наведи палец на часть — подскажу, что это';
      case 'reset': return 'Держи ладонь — сброс';
      case 'wait': return 'Отпусти и схвати снова';
    }
    return '✊ схвати — вращать · 👏 — разобрать · 🖐 ребро — разрез · ☝️ — что это · 🫰 — виды';
  }
  return { start, stop, update, get active() { return k >= 0 && k < STEPS.length; }, firstRun: () => load('hands.tutor') !== '1' };
}
