#!/usr/bin/env bash
# Ідемпотентний деплой: перший запуск ставить Docker, налаштовує фаєрвол
# і генерує .env; кожен наступний — git pull + rebuild + restart.
# На dev-машині, де Docker вже є, кроки встановлення просто пропускаються.
#
# Usage: ./scripts/deploy.sh [--no-cache]
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPTS_DIR")"

MAGENTA='\033[0;35m'; CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; GRAY='\033[0;90m'; NC='\033[0m'

NO_CACHE="${1:-}"

if [ "$EUID" -ne 0 ]; then SUDO="sudo"; else SUDO=""; fi

cd "$ROOT"

echo -e "${MAGENTA}=== Cthulhu Case — Deploy ===${NC}"

# ── Docker ────────────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo -e "${CYAN}Docker не знайдено — встановлюю...${NC}"
    curl -fsSL https://get.docker.com | $SUDO sh
    $SUDO systemctl enable --now docker
fi

if ! docker compose version &> /dev/null; then
    echo -e "${CYAN}Docker Compose plugin не знайдено — встановлюю...${NC}"
    $SUDO apt-get update -qq
    $SUDO apt-get install -y docker-compose-plugin
fi

# ── .env: генерується один раз при першому деплої, далі не чіпається ─────
"$SCRIPTS_DIR/init_env.sh"

SERVER_IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')
HTTP_PORT=$(grep -m1 '^HTTP_PORT=' .env | cut -d= -f2)
HTTP_PORT="${HTTP_PORT:-8080}"

# ── Фаєрвол (тільки IP:port, без домену/SSL поки що) ─────────────────────
# Не чіпає жодних правил, крім SSH і HTTP_PORT — якщо на сервері вже є
# інший стек з власними правилами UFW, вони лишаються як були.
if command -v ufw &> /dev/null; then
    $SUDO ufw allow OpenSSH        > /dev/null 2>&1 || true
    $SUDO ufw allow "${HTTP_PORT}/tcp" > /dev/null 2>&1 || true
    $SUDO ufw --force enable       > /dev/null 2>&1 || true
fi

# ── Код ────────────────────────────────────────────────────────────────
if [ -d .git ]; then
    echo -e "${CYAN}Оновлюю код (git pull)...${NC}"
    git pull --ff-only
fi

# ── Збірка і запуск ────────────────────────────────────────────────────
echo -e "${CYAN}Збираю образи...${NC}"
if [ "$NO_CACHE" = "--no-cache" ]; then
    docker compose build --no-cache
else
    docker compose build
fi

echo -e "${CYAN}Перезапускаю контейнери...${NC}"
docker compose up -d

echo -e "${CYAN}Чекаю поки backend підніметься (міграції + i18n компілюються автоматично)...${NC}"
ready=false
for i in $(seq 1 30); do
    if docker compose logs web 2>/dev/null | grep -q "Listening on TCP address"; then
        ready=true
        break
    fi
    echo "  waiting... ($i/30)"
    sleep 2
done

echo -e "${CYAN}Прибираю старі образи...${NC}"
docker image prune -f > /dev/null

echo ""
if $ready; then
    echo -e "${GREEN}Готово! Сайт доступний на: http://${SERVER_IP}:${HTTP_PORT}${NC}"
else
    echo -e "${YELLOW}Контейнери піднято, але backend не підтвердив готовність вчасно — перевір логи:${NC}"
    echo -e "${GRAY}  ./scripts/logs.sh web${NC}"
    echo -e "${GRAY}Сайт мав би бути на: http://${SERVER_IP}:${HTTP_PORT}${NC}"
fi
docker compose ps
