#!/usr/bin/env bash
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPTS_DIR")"

CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'

# Load .env
DB_NAME="cthulhu_db"; DB_USER="cthulhu"
if [ -f "$ROOT/.env" ]; then
    while IFS='=' read -r key val; do
        [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
        case "$key" in
            DB_NAME) DB_NAME="$val" ;;
            DB_USER) DB_USER="$val" ;;
        esac
    done < "$ROOT/.env"
fi

MODE="${1:-django}"
cd "$ROOT"

case "$MODE" in
    django)
        echo -e "${CYAN}Opening Django shell...${NC}"
        docker compose exec web python manage.py shell
        ;;
    bash)
        echo -e "${CYAN}Opening bash in web container...${NC}"
        docker compose exec web bash
        ;;
    db)
        echo -e "${CYAN}Opening psql ($DB_NAME)...${NC}"
        docker compose exec db psql -U "$DB_USER" "$DB_NAME"
        ;;
    redis)
        echo -e "${CYAN}Opening redis-cli...${NC}"
        docker compose exec redis redis-cli
        ;;
    *)
        echo -e "${RED}Unknown mode '$MODE'. Use: django | bash | db | redis${NC}"
        exit 1
        ;;
esac
