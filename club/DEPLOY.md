# Клуб Начерта — развёртывание (что владелец делает руками)

Код в репозитории готов и проверен на локальной эмуляции (`node server/dev.js`). Ниже — всё, что нужно сделать
руками, чтобы клуб заработал на `club.nachert1830.ru`. Секретов в репозитории нет и быть не должно: все ключи живут
в Yandex Lockbox и попадают в функцию как переменные окружения.

Основной сайт `nachert1830.ru` при этом не меняется.

> Порядок важен: сначала облако и база (шаги 1–4), потом бот и почта (5–6), потом домен (7–8), в конце — проверка (9).

---

## 0. Что понадобится

- Аккаунт Telegram владельца — для бота и для входа админом.
- Доступ к DNS домена `nachert1830.ru` (там, где сейчас настроена запись для GitHub Pages).
- Аккаунт в Yandex Cloud с платёжным аккаунтом (для клуба на десятки тестировщиков расходы — в пределах бесплатных
  лимитов Cloud Functions, API Gateway и YDB serverless; Postbox тарифицируется за письма).
- Локально: `yc` (Yandex Cloud CLI), `aws` (AWS CLI — им создаются таблицы YDB через совместимый с DynamoDB API), `zip`, `curl`.

## 1. Каталог и сервисные аккаунты

```sh
yc init                                   # войти, выбрать облако
yc resource-manager folder create --name nachert-club
yc config set folder-name nachert-club

# аккаунт, от имени которого работают функции (база, секреты)
yc iam service-account create --name club-fn
# аккаунт, от имени которого API Gateway вызывает функцию
yc iam service-account create --name club-gw
# аккаунт для отправки писем (Postbox)
yc iam service-account create --name club-mail

FOLDER=$(yc config get folder-id)
for r in ydb.editor lockbox.payloadViewer; do
  yc resource-manager folder add-access-binding $FOLDER --role $r --service-account-name club-fn; done
yc resource-manager folder add-access-binding $FOLDER --role functions.functionInvoker --service-account-name club-gw
yc resource-manager folder add-access-binding $FOLDER --role postbox.sender --service-account-name club-mail
```

Статические ключи (они нужны для подписи запросов к YDB Document API и Postbox; **не сохраняйте их в файлы проекта**):

```sh
yc iam access-key create --service-account-name club-fn     # → YDB_KEY_ID (key_id) и YDB_SECRET (secret)
yc iam access-key create --service-account-name club-mail   # → POSTBOX_KEY_ID и POSTBOX_SECRET
```

## 2. База YDB (serverless, регион ru-central1 — данные в России)

```sh
yc ydb database create --name club --serverless
yc ydb database get club --format json | grep document_api_endpoint
# → https://docapi.serverless.yandexcloud.net/ru-central1/b1g…/etn…   это YDB_DOCAPI_ENDPOINT
```

Таблицы создаются один раз. Настройте AWS CLI ключом `club-fn` (только в своём терминале):

```sh
export AWS_ACCESS_KEY_ID=<key_id club-fn> AWS_SECRET_ACCESS_KEY=<secret club-fn> AWS_DEFAULT_REGION=ru-central1
EP=<YDB_DOCAPI_ENDPOINT>
for t in users identities invites sessions magic progress feedback config ratelimit tgseen remsent; do
  aws dynamodb create-table --endpoint $EP --table-name club_$t \
    --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH; done
aws dynamodb create-table --endpoint $EP --table-name club_loginlog \
  --attribute-definitions AttributeName=h,AttributeType=S AttributeName=r,AttributeType=S \
  --key-schema AttributeName=h,KeyType=HASH AttributeName=r,KeyType=RANGE
aws dynamodb list-tables --endpoint $EP     # 12 таблиц club_*
```

Резервные копии: в консоли YDB → база `club` → «Резервные копии» — включите ежедневные с хранением 30 дней
(срок указан в политике обработки ПД; если выберете другой — поправьте документ).

## 3. Секрет в Lockbox

Сгенерируйте случайные значения:

```sh
openssl rand -base64 48   # → SECRET_KEY (ключ отпечатков почты; не меняйте после запуска — иначе почтовые входы «потеряются»)
openssl rand -hex 32      # → TG_WEBHOOK_SECRET
```

Создайте секрет `club-secrets` (консоль → Lockbox → «Создать секрет») с ключами:

| Ключ | Откуда |
|---|---|
| `SECRET_KEY` | `openssl rand -base64 48` |
| `TG_BOT_TOKEN` | шаг 5 (BotFather) |
| `TG_WEBHOOK_SECRET` | `openssl rand -hex 32` |
| `YDB_KEY_ID`, `YDB_SECRET` | ключ `club-fn` из шага 1 |
| `POSTBOX_KEY_ID`, `POSTBOX_SECRET` | ключ `club-mail` из шага 1 |

## 4. Функции

Пакет — папки `server/` и `club/` (функция отдаёт и страницу клуба, и API). Из корня репозитория:

```sh
node club/tools/build-core.js --check       # ядро задач совпадает с index.html (иначе: node club/tools/build-core.js)
rm -f club.zip && zip -r club.zip server club -x 'server/.data/*' 'server/test/*' 'club/tests/*' 'club/tools/*' '*.md'
```

Создайте две функции и версии (среда `nodejs22`; `SECRET_ID` — id секрета `club-secrets`):

```sh
yc serverless function create --name nachert-club-api
yc serverless function create --name nachert-club-remind

ENV="ORIGIN=https://club.nachert1830.ru,TG_BOT_NAME=<имя_бота_без_@>,ADMIN_TG_IDS=<ваш_telegram_id>,MAIL_FROM=Клуб Начерта <club@nachert1830.ru>,YDB_DOCAPI_ENDPOINT=<endpoint>,MAIN_URL=https://nachert1830.ru"
SECRETS="--secret id=$SECRET_ID,key=SECRET_KEY,environment-variable=SECRET_KEY \
 --secret id=$SECRET_ID,key=TG_BOT_TOKEN,environment-variable=TG_BOT_TOKEN \
 --secret id=$SECRET_ID,key=TG_WEBHOOK_SECRET,environment-variable=TG_WEBHOOK_SECRET \
 --secret id=$SECRET_ID,key=YDB_KEY_ID,environment-variable=YDB_KEY_ID \
 --secret id=$SECRET_ID,key=YDB_SECRET,environment-variable=YDB_SECRET \
 --secret id=$SECRET_ID,key=POSTBOX_KEY_ID,environment-variable=POSTBOX_KEY_ID \
 --secret id=$SECRET_ID,key=POSTBOX_SECRET,environment-variable=POSTBOX_SECRET"

yc serverless function version create --function-name nachert-club-api --runtime nodejs22 \
  --entrypoint server/index.handler --memory 256m --execution-timeout 10s \
  --service-account-id $(yc iam service-account get club-fn --format json | jq -r .id) \
  --source-path club.zip --environment "$ENV" $SECRETS

yc serverless function version create --function-name nachert-club-remind --runtime nodejs22 \
  --entrypoint server/index.remind --memory 256m --execution-timeout 120s \
  --service-account-id $(yc iam service-account get club-fn --format json | jq -r .id) \
  --source-path club.zip --environment "$ENV" $SECRETS

# напоминания и уборка — каждые 15 минут
yc serverless trigger create timer --name club-remind --cron-expression '0/15 * ? * * *' \
  --invoke-function-name nachert-club-remind \
  --invoke-function-service-account-id $(yc iam service-account get club-gw --format json | jq -r .id)
```

Переменные окружения (полный список — `server/lib/config.js`):

| Переменная | Значение |
|---|---|
| `ORIGIN` | `https://club.nachert1830.ru` — без него функция не стартует (проверка Origin, cookie `__Host-`, HSTS) |
| `ADMIN_TG_IDS` | ваш числовой Telegram id (узнать: бот @userinfobot). Через запятую — несколько владельцев. Владелец входит без приглашения и сразу админ |
| `ADMIN_EMAILS` | необязательно: почта владельца, если хотите входить и по почте |
| `TG_BOT_NAME` | имя бота без `@` (для ссылки «Открыть бота») |
| `MAIL_FROM` | адрес отправителя, подтверждённый в Postbox (шаг 6) |
| `CLUB_WEEK1` | необязательно: понедельник недели 1; можно задать позже в админ-панели («Семестр») |
| `TG_AUTH_MAX_AGE` | необязательно: сколько секунд действительны данные входа Telegram (по умолчанию 600) |

Функция без обязательных переменных не запускается и пишет в лог, чего не хватает (так задумано: лучше отказ, чем вход
без проверки подписи).

## 5. Бот в @BotFather

1. `/newbot` → имя «Клуб Начерта», username, например `nachert_club_bot`. Токен → в Lockbox (`TG_BOT_TOKEN`), создайте
   новую версию функций (шаг 4), чтобы они его подхватили.
2. `/setdomain` → выбрать бота → `club.nachert1830.ru`. Без этого окно входа Telegram не откроется.
3. `/setcommands` →
   ```
   pause - Поставить напоминания на паузу
   resume - Снять с паузы
   stop - Выключить напоминания
   ```
4. `/setdescription` — «Бот закрытого клуба Начерта: вход и напоминания для приглашённых тестировщиков».
5. Подключите вебхук (после шага 8, когда домен работает):
   ```sh
   curl -s "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook" \
     -d url=https://club.nachert1830.ru/api/tg/webhook \
     -d secret_token=<TG_WEBHOOK_SECRET> \
     -d 'allowed_updates=["message","callback_query","my_chat_member"]'
   curl -s "https://api.telegram.org/bot<TG_BOT_TOKEN>/getWebhookInfo"     # url и pending_update_count: 0
   ```

Вход: клуб вызывает `Telegram.Login.auth` с `request_access: write` — Telegram сам спросит у студента разрешение
писать ему от имени бота. Если студент отказал, при включении напоминаний клуб попросит открыть бота и нажать «Старт».

## 6. Почта (Yandex Cloud Postbox)

1. Консоль → Postbox → «Создать адрес»: домен `nachert1830.ru` (или поддомен `mail.nachert1830.ru`).
2. Добавьте в DNS записи, которые покажет Postbox (DKIM — TXT/CNAME), дождитесь статуса «Подтверждён».
3. Рекомендуется SPF/DMARC: TXT `v=spf1 include:_spf.yandex.net ~all` (сверьте со справкой Postbox) и
   `_dmarc` TXT `v=DMARC1; p=none`.
4. `MAIL_FROM` — адрес на этом домене, например `Клуб Начерта <club@nachert1830.ru>`.

Пока Postbox не настроен, можно запуститься только с Telegram: не задавайте `MAIL_FROM`, и форма «по почте» не покажется.

## 7. API Gateway

```sh
sed -e "s/\${FUNCTION_ID}/$(yc serverless function get nachert-club-api --format json | jq -r .id)/" \
    -e "s/\${SA_ID}/$(yc iam service-account get club-gw --format json | jq -r .id)/" server/apigw.yaml > /tmp/club-gw.yaml
yc serverless api-gateway create --name nachert-club --spec /tmp/club-gw.yaml
yc serverless api-gateway get nachert-club     # domain: d5d….apigw.yandexcloud.net — откройте, должна быть страница входа
```

Ограничение частоты на уровне шлюза (дополнительно к лимитам в коде) — консоль API Gateway → «Ограничение скорости»,
например 20 запросов в секунду.

## 8. Домен club.nachert1830.ru

1. Certificate Manager → «Добавить сертификат» → Let's Encrypt → домен `club.nachert1830.ru`, проверка DNS.
   Добавьте в DNS CNAME `_acme-challenge.club` → значение из консоли, дождитесь «Выпущен».
2. API Gateway `nachert-club` → «Домены» → подключить `club.nachert1830.ru` с этим сертификатом.
3. DNS: CNAME `club` → `<domain шлюза>.apigw.yandexcloud.net`.
4. Запись для GitHub Pages основного сайта не трогайте.

## 9. Первый запуск и проверка

1. Откройте `https://club.nachert1830.ru` → «Войти через Telegram» под своим аккаунтом (id из `ADMIN_TG_IDS`) →
   примите документы → вы админ.
2. «Ещё» → «Админ-панель» → «Семестр»: проверьте **понедельник недели 1** (по умолчанию 2026-08-31) по расписанию МГТУ.
3. Проверьте таблицу недель ДЗ/РК/М в «Календаре» — она взята из вашего задания (`club/lib/calendar.js`, `TABLE`).
4. «Приглашения» → создайте приглашение себе на второй аккаунт или почту, пройдите регистрацию как тестировщик.
5. «Настройки» → включите напоминания → в Telegram придёт подтверждение.
6. Проверьте заголовки: `curl -sI https://club.nachert1830.ru/ | grep -i -E 'content-security|strict-transport|x-frame'`.
7. Проверьте журнал функций (консоль → Cloud Functions → «Логи»): нет ошибок `YDB …`.

## 10. Юридическое (до приглашения первых тестировщиков)

- Отдать юристу `club/legal/terms.html`, `privacy.html`, `consent.html` (помечены «ЧЕРНОВИК — проверить юристом»),
  заполнить реквизиты оператора, снять пометки.
- Уведомление Роскомнадзора об обработке ПД (ст. 22 152-ФЗ) — если юрист не найдёт исключения; отдельно —
  о трансграничной передаче (напоминания идут через Telegram Bot API, серверы Telegram за рубежом).
- После правок документов поменять `DOCS_VERSION` в `server/lib/app.js` — новые участники будут принимать новую версию.

## Обновление

```sh
node --test server/test/*.test.js club/tests/*.test.js   # всё зелёное
zip … (шаг 4) && yc serverless function version create … (обе функции)
```

Откат — «Версии» функции → сделать предыдущую версию `$latest`.

## Что не входит в развёртывание

- Модуль сканера по фото (`lab/` сканера в этом репозитории нет) — в клубе заглушка с интерфейсом `scan(фото, задача)`.
- Слияние ветки с `main` не требуется и не нужно: GitHub Pages основного сайта опубликовал бы папки `club/` и `server/`
  как статические файлы (секретов там нет, но и пользы тоже).
