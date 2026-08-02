#!/usr/bin/env bash
# Створює .env з .env.example, генерує випадкові SECRET_KEY/DB_PASSWORD
# і підставляє IP сервера в ALLOWED_HOSTS/CORS_ALLOWED_ORIGINS.
# Запускати з кореня репозиторію: bash scripts/init_env.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
    echo ".env вже існує — нічого не роблю (видали файл вручну, якщо хочеш перегенерувати з нуля)."
    exit 0
fi

if [ ! -f .env.example ]; then
    echo ".env.example не знайдено — нема з чого генерувати .env." >&2
    exit 1
fi

echo "Створюю .env з .env.example..."
cp .env.example .env

SECRET_KEY=$(openssl rand -base64 45 | tr -d '\n')
DB_PASSWORD=$(openssl rand -hex 16)
SERVER_IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')
HTTP_PORT=$(grep -m1 '^HTTP_PORT=' .env | cut -d= -f2)
HTTP_PORT="${HTTP_PORT:-8080}"

sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET_KEY}|"                                              .env
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|"                                           .env
sed -i "s|^ALLOWED_HOSTS=.*|ALLOWED_HOSTS=localhost,127.0.0.1,${SERVER_IP}|"                     .env
sed -i "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=http://${SERVER_IP}:${HTTP_PORT}|"       .env

echo ""
echo "Готово! Згенеровано автоматично:"
echo "  SECRET_KEY, DB_PASSWORD                             — випадкові"
echo "  ALLOWED_HOSTS / CORS_ALLOWED_ORIGINS                — під IP: ${SERVER_IP}:${HTTP_PORT}"
echo ""
echo "Сайт слухатиме зовнішній порт ${HTTP_PORT} (не 80) — постав HTTP_PORT=80 в .env,"
echo "якщо порт 80 на цьому сервері вільний і хочеш саме його."
echo ""
echo "DEBUG=True лишається за замовчуванням (з .env.example)."
echo "Постав DEBUG=False в .env, коли перейдеш на постійний прод з доменом."
