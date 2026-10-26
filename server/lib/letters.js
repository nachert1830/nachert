/* Письма личного кабинета Начерта: тема, текст и HTML (таблицы и встроенные стили — так письмо одинаково выглядит
   в Яндекс Почте, Mail.ru, Gmail и Outlook). Код — в теме, чтобы его было видно прямо в уведомлении. */
'use strict';
const SITE='https://nachert1830.ru';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
function layout({pre,title,lead,code,note,foot}){
  const digits=String(code).split('').map(d=>`<td style="width:44px;height:56px;background:#f1f4fb;border-radius:12px;font:700 28px/56px 'SF Mono',Menlo,Consolas,monospace;color:#0d1530;text-align:center">${esc(d)}</td><td style="width:8px"></td>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f5fa;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5fa"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="padding:0 4px 18px"><a href="${SITE}" style="text-decoration:none;color:#0d1530"><img src="${SITE}/icon-192.png" width="36" height="36" alt="" style="vertical-align:middle;border-radius:10px;border:0"><span style="font:700 19px -apple-system,'Segoe UI',Roboto,Arial,sans-serif;vertical-align:middle;margin-left:10px;letter-spacing:-.2px">Начерт</span></a></td></tr>
<tr><td style="background:#ffffff;border-radius:20px;padding:32px 28px;font:16px/1.55 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#36405c">
<h1 style="margin:0 0 8px;font:700 22px/1.25 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0d1530">${esc(title)}</h1>
<p style="margin:0 0 24px">${esc(lead)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>${digits}</tr></table>
<p style="margin:0;color:#5c6783;font-size:14px">${esc(note)}</p>
</td></tr>
<tr><td style="padding:18px 8px 0;font:13px/1.5 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#8f99b0">${esc(foot)}<br><a href="${SITE}" style="color:#8f99b0">nachert1830.ru</a></td></tr>
</table></td></tr></table></body></html>`; }
function loginCode(code,min){
  const title='Код входа в личный кабинет';
  return {subject:code+' — код входа в личный кабинет Начерта',
    text:`${title}\n\n${code}\n\nВведите код на странице входа. Он действует ${min} минут и срабатывает один раз.\n\nЕсли вы не запрашивали код, просто проигнорируйте письмо — без кода в кабинет никто не войдёт.\n\nНачерт · ${SITE}`,
    html:layout({pre:'Ваш код: '+code+'. Действует '+min+' минут.',title,lead:'Введите этот код на странице входа:',code,
      note:'Код действует '+min+' минут и срабатывает один раз. Никому его не сообщайте.',
      foot:'Если вы не запрашивали код, просто проигнорируйте письмо — без кода в кабинет никто не войдёт.'})}; }
function linkCode(code,min){
  const title='Подтвердите почту';
  return {subject:code+' — код для привязки почты к личному кабинету Начерта',
    text:`${title}\n\n${code}\n\nВведите код в профиле личного кабинета — после этого входить можно будет и по этой почте. Код действует ${min} минут.\n\nЕсли вы ничего не привязывали, просто проигнорируйте письмо.\n\nНачерт · ${SITE}`,
    html:layout({pre:'Код для привязки почты: '+code,title,lead:'Введите код в профиле личного кабинета — после этого входить можно будет и по этой почте:',code,
      note:'Код действует '+min+' минут и срабатывает один раз.',foot:'Если вы ничего не привязывали, просто проигнорируйте письмо.'})}; }
module.exports={loginCode,linkCode};
