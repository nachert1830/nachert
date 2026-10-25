/* Ссылка для входа владельца в клуб — без Telegram.
     node server/tools/login.js
   Вызывает функцию клуба напрямую через yc: так можно только с правами в вашем облаке, поэтому ссылку получит лишь владелец.
   Ссылка действует 30 минут и срабатывает один раз. */
'use strict';
const {ownerLink}=require('./deploy');
const link=ownerLink();
if(!link){ console.error('✖ Не получилось. Проверьте, что «yc» работает (yc serverless function list) и клуб развёрнут свежей версией: node server/tools/deploy.js'); process.exit(1); }
console.log('Ссылка для входа (30 минут, один раз, никому не пересылайте):\n\n  '+link+'\n');
