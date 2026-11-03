/* Модель «вентиль угловой запорный» — сборочная единица из 12 позиций (данные — valve-data.js, tools/build-valve.js).
   Раскладка = разборка в порядке, обратном сборке (гайка маховика → маховик → накидная гайка → … → шпильки),
   плюс механизм: «открыть» = маховик со шпинделем поворачиваются, шпиндель по резьбе крышки поднимается
   (шаг 4 мм, ход до 14 мм — 3,5 оборота), клапан отходит от седла, по каналу идёт поток. */
import data from './valve-data.js';

const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const STAGES = 10;

export default {
  key: 'valve', title: 'Вентиль угловой', data, assembly: true, kin: true,
  /* e — разбор 0..1, open — открытие 0..1 */
  layout(e, open = 0) {
    const off = {}, rot = {}, lift = data.lift * open, ang = lift / data.pitch * 2 * Math.PI;
    for (const p of data.parts) {
      const o = [0, 0, 0];
      for (const st of p.ex) { const u = sm((e - st.s / STAGES * 0.72) / 0.28); for (let k = 0; k < 3; k++) o[k] += st.d[k] * u; }
      if (p.kin) { o[2] += lift; if (p.kin === 'rot') rot[p.id] = ang; }   /* разобранный — тоже: механизм в любой фазе */
      off[p.id] = o;
    }
    return { off, rot, plugA: 0 };
  },
  group: id => id,
  /* «вынуть рукой»: направление — первый шаг разборки детали, ход — его длина (корпус не вынимается) */
  pullDir: id => { const p = data.parts.find(q => q.id === id), st = p && p.ex[0]; if (!st) return null;
    const L = Math.hypot(...st.d); return { dir: st.d.map(x => x / L), max: L, at: p.anchor }; },
  /* маховик: центр — на оси шпинделя, на высоте обода; 1 оборот руки = 30 % хода (весь ход — 3,5 оборота шпинделя) */
  wheel: { id: 'wheel', c: [0, 0, data.parts.find(q => q.id === 'wheel').anchor[2]], perTurn: 0.3 },
  /* подписи — позиции, как на сборочном чертеже */
  labels: Object.fromEntries(data.parts.map(p => [p.id, { at: p.anchor, side: p.anchor[0] > 20 ? 1 : -1, s: `${p.pos}. ${p.name.replace(/ \(.*\)/, '')}`, t: `${p.pos}. ${p.name}`, d: p.mat }])),
  quiz: [
    { id: 'body', q: 'Покажи корпус (поз. 1)' },
    { id: 'packing', q: 'Покажи деталь, которая не даёт среде просочиться вдоль шпинделя' },
    { id: 'bonnet', q: 'Покажи деталь, по резьбе которой поднимается шпиндель' },
    { id: 'plug', q: 'Покажи деталь, которая перекрывает поток' },
    { id: 'gasket', q: 'Покажи деталь, которая уплотняет стык корпуса и крышки' },
    { id: 'wheel', q: 'Покажи, за что берутся, чтобы открыть вентиль' }
  ],
  /* путь потока: вход снизу → через седло → камера → выход вбок; радиус — для разброса частиц */
  flow: { path: [[0, 0, -72], [0, 0, -20], [0, 0, -6], [0, 0, 6], [6, 0, 14], [24, 0, 16], [96, 0, 16]], r: 11 }
};
