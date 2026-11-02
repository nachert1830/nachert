/* Обучение жестам и контекстная подсказка.
   Обучение: при первом включении камеры — 6 шагов за ~60 с, каждый засчитывается, когда человек действительно
   сделал жест (смотрим на кадры контроллера, вид и события). Порядок — от простого к сложному:
   курсор → наведение → вращение → маховик (или ползунок) → меню ладонью → зум двумя руками.
   Пройдено — запоминается; заново — «Ещё → Обучение жестам».
   Подсказка внизу: только то, что уместно прямо сейчас (рука не видна / у края / над деталью / идёт жест). */

const STEPS = [
  { i: '✋', t: 'Подними руку, локоть на столе', d: 'Ладонью к экрану, в полуметре от камеры. Курсор — у основания указательного пальца: веди кистью, а не всей рукой.',
    ok: (s, f) => f && f.hands.some(h => h.present && !h.ignored) && (s.seen = (s.seen || 0) + 1) > 12 },
  { i: '👆', t: 'Наведи курсор на деталь', d: 'Задержи курсор на любой детали — появится её название.',
    ok: (s, f, v, ev, x) => !!(x && x.hover) },
  { i: '🤏', t: 'Щипни и поверни', d: 'Сомкни большой и указательный над моделью и сразу веди руку. Разожми на ходу — докрутится.',
    ok: (s, f, v) => { if (s.y0 == null) s.y0 = v.yaw; return Math.abs(v.yaw - s.y0) > 0.8; } },
  { i: '🔧', t: 'Открой вентиль', d: 'Наведи на маховик, щипни и крути руку кругом против часовой стрелки — шпиндель поднимется, пойдёт поток. (На детали без механизма — потяни щипком ползунок «Разбор».)',
    ok: (s, f, v) => (v.open || 0) > 0.3 || v.explode > 0.5 },
  { i: '✋', t: 'Открой меню ладонью', d: 'Покажи открытую ладонь и подержи полсекунды. Поведи руку к пункту «Разрез» и щипни, затем выбери вид разреза.',
    ok: (s, f, v, ev) => ev.some(e => e.type === 'menu' && e.key !== 'reset') },
  { i: '🤏🤏', t: 'Приблизь двумя руками', d: 'Щипни обеими руками и разведи их в стороны. Руки не сводить ближе ладони друг к другу.',
    ok: (s, f, v) => { if (s.z0 == null) s.z0 = v.zoom; return Math.abs(Math.log(v.zoom / s.z0)) > 0.25; } }
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
      box.innerHTML = `<div class="ci">🎉</div><div><b>Готово — ты управляешь моделью руками</b><p>Щипни деталь и подержи — она вынется. Всё на панели справа нажимается щипком;
        ✋ ладонь — меню, его центр — сброс (отменяется кнопкой «Вернуть»). «Ещё → Обучение» — пройти снова.</p></div><button type="button" class="cx" aria-label="Закрыть">✕</button>`;
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
  function update(frame, view, events, camOn, extra) {
    if (k >= 0 && k < STEPS.length && STEPS[k].ok(st, frame, view, events || [], extra || {})) {
      k++; st = {}; onStep && onStep(k); show();
      if (k >= STEPS.length) { store('hands.tutor', '1'); doneT = performance.now(); }
    }
    if (k >= STEPS.length && performance.now() - doneT > 9000) stop();
    hint.textContent = k >= 0 && k < STEPS.length ? '' : tip(frame, view, camOn, extra || {});
    hint.hidden = !hint.textContent;
  }
  /* подсказки по контексту; бездействие 8 с — напомнить про меню */
  let idleT = 0;
  function tip(f, v, camOn, x) {
    if (!camOn) return '';
    const n = f ? f.hands.filter(h => h.present).length : 0, now = f ? f.t : 0;
    if (!n) return '✋ Подними руку перед камерой';
    if (f.hands.some(h => h.present && h.ignored)) return '↔ Рука у края кадра или далеко — ближе к центру';
    if (f.mode !== 'idle') idleT = now; else if (!idleT) idleT = now;
    if (f.menu) return '✋ Веди к пункту и щипни · центр — сброс · кулак — закрыть';
    if (f.drag) return ({ slider: 'Веди руку — ползунок едет · разожми — отпустить', wheel: 'Крути рукой по кругу: против часовой — открыть', plane: 'Веди вдоль стрелок — плоскость движется', part: 'Тяни — деталь вынимается · отпусти: больше 40 % — останется' })[f.drag.kind] || '';
    if (f.hands.some(h => h.ui)) return '🤏 Щипни и отпусти — нажать';
    if (x.hover === 'wheel') return '🤏 Щипни маховик и крути — открыть вентиль';
    if (x.hover) return '🤏 Щипни и подержи — вынуть деталь · щипни и веди — вращать';
    switch (f.mode) {
      case 'rotate': return 'Веди руку — вращение · разожми на ходу — докрутится · вторая рука 🤏 — зум';
      case 'zoom': return 'Разводи и своди — зум · веди обе руки — сдвиг';
      case 'arm': return '✋ Держи ладонь — откроется меню';
      case 'wait': return 'Отпусти и щипни снова';
    }
    if (now - idleT > 8000) return '✋ Покажи ладонь на полсекунды — откроется меню: вид, разрез, эпюр, сброс';
    return '🤏 щипок: по кнопке — нажать, по детали — вращать или вынуть · 🤏🤏 — зум · ✋ — меню';
  }
  return { start, stop, update, get active() { return k >= 0 && k < STEPS.length; }, firstRun: () => load('hands.tutor') !== '1' };
}
