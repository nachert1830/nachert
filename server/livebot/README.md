# Бот записи на онлайн-разборы

`core.js` — логика (без сети), `run.js` — запуск на своём сервере (long polling), `livebot.service` — служба systemd.
Зависимостей нет, нужен Node.js 20+.

```
LIVEBOT_TOKEN=… LIVEBOT_ADMINS=<твой Telegram ID> node server/livebot/run.js
```

Зачем, как развернуть на VPS, команды владельца и Яндекс Форма — `docs/LIVE.md`. Тесты — `server/test/livebot.test.js`.
