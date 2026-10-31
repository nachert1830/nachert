#!/usr/bin/env node
/* Вырезает из index.html движок 3D-деталей (IG3, IG_VARS, IG_DIMS, IG_WB, IGUI) в hands/models.js.
   Так прототип всегда показывает те же модели, что и сайт, а index.html не трогаем.
   Запуск из корня репозитория: node hands/tools/extract-models.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const a = src.indexOf('window.IG3=(function(){');
const b = src.indexOf('window.IGL=(function(){');
if (a < 0 || b < a) { console.error('не нашёл границы блока моделей в index.html'); process.exit(1); }
/* отрезаем хвост — комментарий перед IGL, чтобы блок кончался на конце IGUI */
let body = src.slice(a, b);
body = body.slice(0, body.lastIndexOf('})();') + 5) + '\n';
/* голограмме нужны внутренности IG3: сетка по дереву (CSG.mesh) и линии рёбер/очерка — дописываем их в экспорт.
   На сайте то же самое — одна правка в строке return блока IG3 (см. hands/README.md). */
const RET = 'return {P,J,jc,viewer,';
if (!body.includes(RET)) { console.error('не нашёл экспорт IG3 — формат index.html изменился'); process.exit(1); }
body = body.replace(RET, 'return {CSG,featLines,silLines,P,J,jc,viewer,');
fs.writeFileSync(path.join(__dirname, '../models.js'),
  '/* АВТОГЕНЕРАЦИЯ: node hands/tools/extract-models.js — не править руками. Источник: index.html (IG3, IG_VARS, IG_DIMS, IG_WB, IGUI); в экспорт IG3 добавлены CSG, featLines, silLines. */\n' + body);
console.log('hands/models.js:', (body.length / 1024).toFixed(0), 'КБ');
