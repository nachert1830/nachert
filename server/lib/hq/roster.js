/* Штаб: каталог моделей (сотрудников) и штатное расписание.
   Все модели — через ProxyAPI (один ключ PROXYAPI_KEY, оплата в рублях), единый OpenAI-совместимый адрес.
   Цены — $ за 1 млн токенов по прайсу производителя (вход / выход / чтение из кэша); рубли = $ × курс ProxyAPI (rate в настройках
   Штаба, по умолчанию 110 — с наценкой ProxyAPI). Это оценка: точная сумма — в личном кабинете ProxyAPI.
   ok:true — имя модели проверено в работе (сканер, Цех); ok:false — имя по каталогу ProxyAPI, проверяется первым запуском
   (если ProxyAPI ответит «нет такой модели», имя меняется в Штабе → «Сотрудники» → «Своя модель»). */
'use strict';

const MODELS = {
  /* Claude — имена проверены сканером (server/lib/eyes.js) */
  'haiku':    {id: 'anthropic/claude-haiku-5-5',  name: 'Claude Haiku 5.5',  vendor: 'Anthropic', in: 0.10, out: 0.50, cache: 0.01, ok: true,
               about: 'самый дешёвый Claude: сортировка, оценка, простые правки'},
  'sonnet':   {id: 'anthropic/claude-sonnet-5-5', name: 'Claude Sonnet 5.5', vendor: 'Anthropic', in: 2, out: 10, cache: 0.10, ok: true,
               about: 'умный и быстрый: диалог, ТЗ, код средней сложности, ревизия'},
  'opus':     {id: 'anthropic/claude-opus-5-5',   name: 'Claude Opus 5.5',   vendor: 'Anthropic', in: 4, out: 20, cache: 0.20, ok: true,
               about: 'самый сильный: сложный код и архитектура — на крайний случай'},
  /* DeepSeek — имя проверено Цехом (tools/agent.js) */
  'deepseek': {id: 'deepseek/deepseek-v3.2',      name: 'DeepSeek V3.2',     vendor: 'DeepSeek', in: 0.28, out: 0.42, cache: 0.028, ok: true,
               about: 'очень дёшево: быстрые простые задачи, тексты, мелкий код'},
  'dsv4':     {id: 'deepseek/deepseek-v4-pro',    name: 'DeepSeek V4 Pro',   vendor: 'DeepSeek', in: 0.55, out: 2.2, cache: 0.07, ok: false,
               about: 'DeepSeek посильнее (имя из документации ProxyAPI): код средней сложности дёшево'},
  /* Gemini — длинный контекст, много текста */
  'flash':    {id: 'google/gemini-2.5-flash',     name: 'Gemini Flash',      vendor: 'Google', in: 0.30, out: 2.50, cache: 0.03, ok: false,
               about: 'дёшево и много текста: разбор длинных монологов, конспекты'},
  'gpro':     {id: 'google/gemini-2.5-pro',       name: 'Gemini Pro',        vendor: 'Google', in: 1.25, out: 10, cache: 0.125, ok: false,
               about: 'длинные тексты и исследования с рассуждением'},
  /* Картинки */
  'qimage':   {id: 'qwen/qwen-image-3',           name: 'Qwen Image 3',      vendor: 'Qwen', image: 'images', perImage: 0.03, ok: false,
               about: 'картинки дёшево (пример из документации ProxyAPI)'},
  'gimage':   {id: 'google/gemini-2.5-flash-image', name: 'Gemini Image',    vendor: 'Google', image: 'images', perImage: 0.04, ok: false,
               about: 'картинки быстро и дёшево: иллюстрации, обложки, схемы'},
  'gptimage': {id: 'openai/gpt-image-1',                 name: 'GPT Image',         vendor: 'OpenAI', image: 'images', perImage: 0.07, ok: false,
               about: 'картинки сложнее: точный текст на картинке, детали'},
  /* Речь → текст для длинных монологов */
  'whisper':  {id: 'openai/gpt-4o-transcribe',    name: 'Распознавание речи', vendor: 'OpenAI', stt: true, perMin: 0.006, ok: false,
               about: 'длинная диктовка файлом: без обрывов, как у диктовки в браузере'}
};

/* виды задач и уровни сложности */
const KINDS = {code: 'Код сайта', text: 'Текст', image: 'Картинка', research: 'Исследование'};
const LEVELS = {simple: 'простая', medium: 'средняя', complex: 'сложная'};

/* роли конвейера (шаги, где думает модель) */
const ROLES = {
  secretary:  {name: 'Секретарь',  step: 'понимает, что ты сказал в разговоре: мысли, ответ, команда, вопрос', def: 'haiku'},
  analyst:    {name: 'Аналитик',   step: 'разбирает монолог: стратегия, цели, задачи, идеи, балабольство', def: 'flash'},
  product:    {name: 'Продакт',    step: 'обсуждает с тобой задачу и пишет ТЗ',                         def: 'sonnet'},
  dispatcher: {name: 'Диспетчер',  step: 'оценивает вид и сложность задачи, выбирает исполнителя',        def: 'haiku'},
  stenographer: {name: 'Стенограф', step: 'превращает длинную диктовку (файл) в текст', def: 'whisper'},
  reviewer:   {name: 'Ревизор',    step: 'проверяет результат перед выкаткой',                          def: 'sonnet'}
};

/* персонал по умолчанию: вид × сложность → модель */
const STAFF = {
  code:     {simple: 'deepseek', medium: 'sonnet', complex: 'opus'},
  text:     {simple: 'deepseek', medium: 'flash',  complex: 'sonnet'},
  image:    {simple: 'qimage',   medium: 'gimage', complex: 'gptimage'},
  research: {simple: 'flash',    medium: 'gpro',   complex: 'opus'}
};

/* Цех: если тесты красные — следующий по силе */
const ESCALATE = {deepseek: 'dsv4', dsv4: 'sonnet', haiku: 'sonnet', flash: 'sonnet', gpro: 'opus', sonnet: 'opus', opus: null};

const DEFAULTS = () => ({
  roles: Object.fromEntries(Object.keys(ROLES).map(k => [k, ROLES[k].def])),
  staff: JSON.parse(JSON.stringify(STAFF)),
  custom: {},            /* свои модели: ключ → {id, name, in, out, image?} */
  budgetRub: 1000,       /* потолок трат за месяц */
  rate: 110,             /* ₽ за $ с наценкой ProxyAPI */
  autoMerge: true        /* Цех: зелёные тесты + ревизор → сразу в main */
});

/* настройки из базы поверх умолчаний; неизвестные ключи моделей отбрасываются */
function settings(saved) {
  const d = DEFAULTS(), s = saved || {};
  const custom = {};
  Object.entries(s.custom || {}).forEach(([k, m]) => {
    if (/^[a-z0-9_-]{2,24}$/.test(k) && m && typeof m.id === 'string' && /^[\w.\/:-]{2,80}$/.test(m.id) && !MODELS[k])
      custom[k] = {id: m.id, name: String(m.name || m.id).slice(0, 40), vendor: 'своя', in: +m.in || 0, out: +m.out || 0, cache: +m.cache || 0,
        image: m.image === 'chat' || m.image === 'images' ? m.image : undefined, perImage: +m.perImage || 0, ok: false, about: 'своя модель'};
  });
  const all = Object.assign({}, MODELS, custom), known = k => !!all[k];
  Object.keys(ROLES).forEach(r => { if (s.roles && known(s.roles[r])) d.roles[r] = s.roles[r]; });
  Object.keys(STAFF).forEach(kind => Object.keys(LEVELS).forEach(l => {
    const v = s.staff && s.staff[kind] && s.staff[kind][l]; if (known(v)) d.staff[kind][l] = v; }));
  d.custom = custom;
  if (+s.budgetRub >= 0 && +s.budgetRub <= 1e6) d.budgetRub = +s.budgetRub;
  if (+s.rate > 0 && +s.rate < 1000) d.rate = +s.rate;
  if (typeof s.autoMerge === 'boolean') d.autoMerge = s.autoMerge;
  return d;
}

const catalog = st => Object.assign({}, MODELS, (st && st.custom) || {});
const model = (st, key) => catalog(st)[key] || null;

/* стоимость вызова в рублях по usage ответа (OpenAI-формат) */
function cost(m, usage, rate) {
  if (!m || !usage) return 0;
  const inTok = +usage.prompt_tokens || 0, outTok = +usage.completion_tokens || 0;
  const cached = +((usage.prompt_tokens_details && usage.prompt_tokens_details.cached_tokens) || usage.cache_read_input_tokens || 0);
  const usd = ((inTok - cached) * (m.in || 0) + cached * (m.cache != null ? m.cache : m.in || 0) + outTok * (m.out || 0)) / 1e6;
  return Math.round(usd * (rate || 110) * 100) / 100;
}

module.exports = {MODELS, KINDS, LEVELS, ROLES, STAFF, ESCALATE, DEFAULTS, settings, catalog, model, cost};
