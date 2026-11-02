/* Обучение жестам и контекстная подсказка.
   Обучение: при первом включении камеры — 6 шагов, каждый засчитывается, когда человек действительно
   сделал жест (смотрим на кадры контроллера и вид). Пройдено — запоминается; заново — «Ещё → Обучение жестам».
   Подсказка внизу: только жесты, уместные прямо сейчас (рука не видна / рука в кадре / идёт жест). */

const STEPS = [
  { i: '✋', t: 'Подними руку перед камерой', d: 'Ладонью к экрану, в полуметре от камеры. Кончик указательного — это курсор.',
    ok: (s, f) => f && f.hands.some(h => h.present && !h.ignored) && (s.seen = (s.seen || 0) + 1) > 12 },
  { i: '🤏', t: 'Щипни деталь и поверни', d: 'Сомкни большой и указательный в любом месте над деталью и веди руку. Разожми на ходу — докрутится.',
    ok: (s, f, v) => { if (s.y0 == null) s.y0 = v.yaw; return Math.abs(v.yaw - s.y0) > 1.2; } },
  { i: '🤏🤏', t: 'Приблизь двумя руками', d: 'Щипни обеими руками и разведи их в стороны.',
    ok: (s, f, v) => { if (s.z0 == null) s.z0 = v.zoom; return Math.abs(Math.log(v.zoom / s.z0)) > 0.25; } },
  { i: '👉', t: 'Нажми кнопку на панели', d: 'Наведи курсор на «Фронт.» в разделе «Разрез» справа — кнопка обведётся красным — и щипни.',
    ok: (s, f, v, ev) => ev.some(e => e.type === 'ui-down') },
  { i: '↔', t: 'Потяни ползунок «Разбор»', d: 'Щипни ползунок и веди руку вправо — сборка разойдётся на детали. Разожми — ползунок останется.',
    ok: (s, f, v) => v.explode > 0.5 },
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
      box.innerHTML = `<div class="ci">🎉</div><div><b>Готово — ты управляешь моделью руками</b><p>Всё на панели справа нажимается щипком: разрез, виды, эпюр, открытие вентиля.
        ☝️ Вытяни указательный над деталью — подскажу, что это за часть. «Ещё → Обучение» — пройти снова.</p></div><button type="button" class="cx" aria-label="Закрыть">✕</button>`;
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
    if (f.hands.some(h => h.captured)) return 'Веди руку — ползунок едет за ней · разожми пальцы — отпустить';
    if (f.hands.some(h => h.ui)) return '🤏 Щипни — нажать';
    switch (f.mode) {
      case 'rotate': return 'Веди руку — вращение · разожми на ходу — докрутится · вторая рука 🤏 — зум';
      case 'zoom': return 'Разводи и своди руки — приближение';
      case 'point': return 'Наведи палец на часть — подскажу, что это';
      case 'reset': return 'Держи ладонь — сброс';
      case 'wait': return 'Отпусти и щипни снова';
    }
    return '☝️ курсор — указательный · 🤏 щипок: на панели — нажать, на детали — вращать · 🤏🤏 — зум · ✋ 1,5 с — сброс';
  }
  return { start, stop, update, get active() { return k >= 0 && k < STEPS.length; }, firstRun: () => load('hands.tutor') !== '1' };
}
