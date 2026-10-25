# Реальные фото для замера сканера

Папка на задачу: `lab/photos/47/`, `lab/photos/46/`. В ней — фото листов в **PNG** (JPEG с телефона перевести в PNG
любой программой; в Node декодер JPEG не подключён, в браузере `lab/scan.html` открывает любой формат) и `truth.json`:

```json
{
  "ivanov-1.png": "ok",
  "petrov-2.png": "foot1",
  "sidorov-1.png": "ok+nv-abs"
}
```

Правда — класс вердикта сканера: `ok`, коды ошибок из `core/cp47.js` (`h-par`, `f-hpar`, `foot1`, `foot2`, `12-swap`;
треугольник: `nv-same`, `nv-abs`, `nv-none`) и `core/cp46.js` (`5-EF`, `12-swap`; видимость: `v2-inv`, `v1-inv`,
`v-both`, `v-none`); две ошибки — через `+`; ошибка, которой в библиотеке нет, — `unknown`.
`node lab/eval.js` считает реальные фото отдельной строкой таблицы.
