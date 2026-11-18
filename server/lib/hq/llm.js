/* Штаб: вызовы моделей через ProxyAPI (OpenAI-совместимый /chat/completions и /images/generations).
   Экономия: системный промпт неизменный и стоит первым — повторные вызовы попадают в кэш провайдера (DeepSeek и Gemini
   кэшируют сами); max_completion_tokens обязателен — по нему ProxyAPI заранее сверяет цену с балансом (см. lib/eyes.js). */
'use strict';
const PX = 'https://api.proxyapi.ru';
const CHAT = PX + '/v1/chat/completions', IMAGES = PX + '/v1/images/generations', STT = PX + '/v1/audio/transcriptions';

class LlmError extends Error { constructor(msg, status) { super(msg); this.status = status || 502; } }

async function post(http, url, key, body, timeout) {
  const r = await http(url, {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + key},
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeout || 50000)});
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) {
    const why = j && (j.error ? j.error.message || j.error : j.detail || j.message);
    const s = String(typeof why === 'string' ? why : why ? JSON.stringify(why) : t).slice(0, 240);
    throw new LlmError('Модель ' + body.model + ' ответила ' + r.status + (s ? ': ' + s : '') +
      (r.status === 402 ? ' (на балансе ProxyAPI мало денег)' : r.status === 404 || /model/i.test(s) && r.status === 400 ? ' (проверьте имя модели в «Сотрудниках»)' : ''), r.status === 402 ? 402 : 502);
  }
  return j || {};
}

/* chat({key, http}, model{id}, {system, messages, max, timeout}) → {text, usage, ms} */
async function chat(o, m, q) {
  const think = /gemini|gpt-5|\/o\d/.test(m.id);
  const body = {model: m.id, max_completion_tokens: q.max || 4000,
    messages: [{role: 'system', content: q.system}].concat(q.messages)};
  if (think) body.reasoning_effort = q.effort || 'low';
  const t0 = Date.now(), j = await post(o.http, CHAT, o.key, body, q.timeout);
  const c = j.choices && j.choices[0] || {}, raw = c.message && c.message.content;
  const text = (typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(p => p.text || '').join('') : '').replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
  if (!text) throw new LlmError('Модель ' + m.id + ' вернула пустой ответ' + (c.finish_reason === 'length' ? ' (не хватило лимита ответа)' : ''));
  return {text, usage: j.usage || null, ms: Date.now() - t0};
}

/* первый JSON-объект в тексте ответа (модели иногда оборачивают его в ```json … ```) */
function json(text) {
  const t = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{');
  for (let b = t.lastIndexOf('}'); a >= 0 && b > a; b = t.lastIndexOf('}', b - 1)) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  throw new LlmError('Модель ответила не в формате JSON');
}

/* image(o, model{id, image}, prompt) → {b64, usage} — PNG в base64 */
async function image(o, m, prompt) {
  if (m.image === 'images') {
    const j = await post(o.http, IMAGES, o.key, {model: m.id, prompt, n: 1, size: '1024x1024'}, 55000);
    const d = j.data && j.data[0] || {};
    if (!d.b64_json) throw new LlmError('Генератор картинок не вернул изображение');
    return {b64: d.b64_json, usage: j.usage || null};
  }
  /* картинка в ответе чата (модели Gemini Image): data:image/png;base64,… в content или в images */
  const j = await post(o.http, CHAT, o.key, {model: m.id, max_completion_tokens: 4000, modalities: ['image', 'text'],
    messages: [{role: 'user', content: prompt}]}, 55000);
  const msg = j.choices && j.choices[0] && j.choices[0].message || {};
  const parts = [].concat(msg.images || [], Array.isArray(msg.content) ? msg.content : [], typeof msg.content === 'string' ? [{url: msg.content}] : []);
  for (const p of parts) {
    const u = p && (p.image_url && (p.image_url.url || p.image_url) || p.url || p.b64_json || '');
    const mm = /data:image\/\w+;base64,([A-Za-z0-9+\/=]+)/.exec(String(u));
    if (mm) return {b64: mm[1], usage: j.usage || null};
    if (p && p.b64_json) return {b64: p.b64_json, usage: j.usage || null};
  }
  throw new LlmError('Модель ' + m.id + ' не вернула картинку');
}

/* speech(o, model{id}, {b64, mime}) → {text} — распознавание длинной диктовки (файл из браузера) */
async function speech(o, m, q) {
  const ext = /webm/.test(q.mime) ? 'webm' : /ogg/.test(q.mime) ? 'ogg' : /mp4|m4a|aac/.test(q.mime) ? 'm4a' : /wav/.test(q.mime) ? 'wav' : 'mp3';
  const fd = new FormData();
  fd.append('model', m.id); fd.append('language', 'ru');
  fd.append('file', new Blob([Buffer.from(q.b64, 'base64')], {type: q.mime || 'audio/webm'}), 'dictation.' + ext);
  const r = await o.http(STT, {method: 'POST', headers: {authorization: 'Bearer ' + o.key}, body: fd, signal: AbortSignal.timeout(55000)});
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) throw new LlmError('Распознавание речи ответило ' + r.status + ': ' + String(j && j.error && (j.error.message || j.error) || t).slice(0, 200), r.status === 402 ? 402 : 502);
  return {text: String(j && j.text || '').trim()};
}

module.exports = {chat, json, image, speech, LlmError, CHAT, IMAGES, STT};
