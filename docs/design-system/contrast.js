#!/usr/bin/env node
// Проверка контраста токенов «Связи» по WCAG 2.2: node docs/design-system/contrast.js [--md]
// Пары «текст на фоне», которые реально встречаются в интерфейсе. Текст ≥ 4.5, крупный текст и иконки/границы полей ≥ 3.
'use strict';
const T = require('./tokens.json').color;

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [16, 8, 0].map(s => (n >> s) & 255).map(v => v / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

// [текст, фон, минимум, где]
const PAIRS = [
  ['ink-1', 'bg', 4.5, 'основной текст на фоне'],
  ['ink-1', 'surface-2', 4.5, 'текст в поле агента'],
  ['ink-2', 'surface-1', 4.5, 'вторичный текст в карточке'],
  ['ink-2', 'surface-2', 4.5, 'вторичный текст на чипе'],
  ['ink-3', 'bg', 4.5, 'мета на фоне'],
  ['ink-3', 'surface-1', 4.5, 'мета в карточке'],
  ['ink-3', 'surface-2', 4.5, 'плейсхолдер поля'],
  ['accent-ink', 'accent', 4.5, 'подпись главной кнопки'],
  ['accent-text', 'bg', 4.5, 'ссылка на фоне'],
  ['accent-text', 'surface-1', 4.5, 'ссылка в карточке'],
  ['accent-text', 'accent-soft', 4.5, 'текст на подложке выделения'],
  ['ok', 'surface-1', 4.5, '«верно» в карточке'],
  ['ok', 'ok-soft', 4.5, '«верно» на подложке'],
  ['err', 'surface-1', 4.5, '«ошибка» в карточке'],
  ['err', 'err-soft', 4.5, '«ошибка» на подложке'],
  ['due', 'surface-1', 4.5, '«срок» в карточке'],
  ['due', 'due-soft', 4.5, '«срок» на подложке'],
  ['accent-ink', 'due-fill', 4.5, 'метка срока'],
  ['field', 'surface-1', 3, 'граница поля ввода (внутри)'],
  ['field', 'bg', 3, 'граница поля ввода (снаружи)'],
  ['accent', 'surface-1', 3, 'прогресс, линия построения — не текст'],
  ['accent', 'bg', 3, 'кольцо агента, активная вкладка'],
  ['focus', 'bg', 3, 'кольцо фокуса'],
  ['focus', 'surface-1', 3, 'кольцо фокуса в карточке'],
  ['draw-ink', 'draw-paper', 7, 'основная линия чертежа'],
  ['draw-thin', 'draw-paper', 3, 'тонкие линии чертежа'],
  ['draw-build', 'draw-paper', 3, 'текущее построение'],
  ['err', 'draw-paper', 3, 'ошибка на чертеже'],
];

const md = process.argv.includes('--md');
let fails = 0;
const rows = [];
for (const [fg, bg, min, where] of PAIRS) {
  const r = {};
  for (const th of ['light', 'dark']) {
    r[th] = ratio(T[th][fg].value, T[th][bg].value);
    if (r[th] < min) fails++;
  }
  rows.push({ fg, bg, min, where, ...r });
}
const f = x => x.toFixed(2);
if (md) {
  console.log('| Пара | Где | Светлая | Тёмная | Нужно |\n|---|---|---|---|---|');
  for (const r of rows) console.log(`| \`${r.fg}\` на \`${r.bg}\` | ${r.where} | ${f(r.light)}${r.light < r.min ? ' ✗' : ''} | ${f(r.dark)}${r.dark < r.min ? ' ✗' : ''} | ${r.min} |`);
} else {
  for (const r of rows) console.log(`${(r.fg + ' / ' + r.bg).padEnd(28)} light ${f(r.light).padStart(5)}  dark ${f(r.dark).padStart(5)}  ≥${r.min}  ${r.light < r.min || r.dark < r.min ? 'FAIL' : 'ok'}  ${r.where}`);
}
if (fails) { console.error(`\nНе прошло пар: ${fails}`); process.exit(1); }
