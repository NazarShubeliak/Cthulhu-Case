#!/usr/bin/env bash
set -euo pipefail

ROOT="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
CYAN='\033[0;36m'; GREEN='\033[0;32m'; NC='\033[0m'

cd "$ROOT"

# Usage: ./migrate.sh [--make [app_name]]
if [ "${1:-}" = "--make" ]; then
    echo -e "${CYAN}Making migrations...${NC}"
    docker compose exec web python manage.py makemigrations "${2:-}"
fi

echo -e "${CYAN}Applying migrations...${NC}"
docker compose exec web python manage.py migrate
echo -e "${GREEN}Done.${NC}"
