#!/usr/bin/env bash
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPTS_DIR")"

MAGENTA='\033[0;35m'; CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; GRAY='\033[0;90m'; NC='\033[0m'

NO_CACHE="${1:-}"

echo -e "${MAGENTA}=== Cthulhu Case — Full Reset ===${NC}"
echo -e "${YELLOW}This will DESTROY all data (DB volumes). Continue? [y/N] ${NC}"
read -rp "" confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

cd "$ROOT"

echo -e "\n${CYAN}[1/4] Stopping containers + removing volumes...${NC}"
docker compose down -v --remove-orphans

echo -e "\n${CYAN}[2/4] Building images...${NC}"
if [ "$NO_CACHE" = "--no-cache" ]; then
    docker compose build --no-cache
else
    docker compose build
fi

echo -e "\n${CYAN}[3/4] Starting containers...${NC}"
docker compose up -d

echo -e "\n${CYAN}[4/4] Waiting for DB to be ready...${NC}"
for i in $(seq 1 20); do
    docker compose exec -T db pg_isready 2>/dev/null | grep -q "accepting connections" && break
    echo "  waiting... ($i/20)"
    sleep 2
done

docker compose exec web python manage.py migrate

echo -e "\n${GREEN}Reset complete.${NC}"
echo -e "  Frontend : http://localhost:3000"
echo -e "  API      : http://localhost:8000"
echo -e "${GRAY}  Create superuser: docker compose exec web python manage.py createsuperuser${NC}"
