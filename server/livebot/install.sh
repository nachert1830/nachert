#!/usr/bin/env bash
# Установка бота эфиров на чистый сервер Ubuntu одной командой (запускать от root):
#   curl -fsSL https://raw.githubusercontent.com/nachert1830/nachert/main/server/livebot/install.sh | bash
# Спросит токен от @BotFather и твой Telegram ID, поставит Node.js, скачает код и запустит бота как службу.
# Повторный запуск — обновляет код и перезапускает бота (токен не спрашивает, если он уже есть).
set -euo pipefail
BRANCH="${LIVEBOT_BRANCH:-main}"
REPO="https://github.com/nachert1830/nachert"
DIR=/opt/livebot; ENVF=/etc/livebot.env
say(){ printf '\n\033[1m%s\033[0m\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Запусти от root (или через sudo)."; exit 1; }

say "1/5 Проверяю, открывается ли Telegram с этого сервера…"
if ! curl -sS --max-time 15 -o /dev/null https://api.telegram.org; then
  echo "Telegram с этого сервера не открывается. Возьми сервер у другого хостинга (или в другом регионе) и запусти снова."; exit 1; fi
echo "Открывается."

say "2/5 Ставлю Node.js и git…"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null; fi
command -v git >/dev/null || apt-get install -y git >/dev/null
echo "Node.js $(node -v)"

say "3/5 Скачиваю код бота…"
id livebot >/dev/null 2>&1 || useradd -r -m -d "$DIR" -s /usr/sbin/nologin livebot
install -d -o livebot -m 700 "$DIR/data"
if [ -d "$DIR/nachert/.git" ]; then sudo -u livebot git -C "$DIR/nachert" fetch -q --depth 1 origin "$BRANCH" && sudo -u livebot git -C "$DIR/nachert" reset -q --hard FETCH_HEAD
else sudo -u livebot git clone -q --depth 1 -b "$BRANCH" "$REPO" "$DIR/nachert"; fi
test -f "$DIR/nachert/server/livebot/run.js" || { echo "В ветке $BRANCH нет бота (server/livebot). Нужна ветка с ботом: LIVEBOT_BRANCH=<ветка>."; exit 1; }

if [ ! -s "$ENVF" ]; then
  say "4/5 Настройка"
  while :; do read -rsp "Токен бота от @BotFather (символы не видны — это нормально), затем Enter: " TOKEN </dev/tty; echo
    if [[ "$TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]{30,}$ ]] && curl -sS --max-time 15 "https://api.telegram.org/bot$TOKEN/getMe" | grep -q '"ok":true'; then break; fi
    echo "Telegram не принял токен. Скопируй его из @BotFather ещё раз."; done
  while :; do read -rp "Твой Telegram ID (число от @userinfobot): " ADMIN </dev/tty
    [[ "$ADMIN" =~ ^[0-9]{3,15}$ ]] && break; echo "Нужно только число, например 123456789."; done
  umask 077; printf 'LIVEBOT_TOKEN=%s\nLIVEBOT_ADMINS=%s\nLIVEBOT_DATA=%s\n' "$TOKEN" "$ADMIN" "$DIR/data/live.json" > "$ENVF"; chmod 600 "$ENVF"
else say "4/5 Настройки уже есть ($ENVF) — оставляю"; fi

say "5/5 Запускаю бота…"
cp "$DIR/nachert/server/livebot/livebot.service" /etc/systemd/system/livebot.service
systemctl daemon-reload; systemctl enable -q livebot; systemctl restart livebot; sleep 4
if journalctl -u livebot -n 30 --no-pager | grep -q 'запущен'; then
  journalctl -u livebot -n 30 --no-pager | grep 'запущен' | tail -1
  say "Готово! Напиши своему боту в Telegram /admin — он покажет команды."
else echo "Бот не запустился. Последние строки журнала:"; journalctl -u livebot -n 20 --no-pager; exit 1; fi
