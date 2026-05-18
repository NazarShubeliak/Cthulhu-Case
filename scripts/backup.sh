#!/usr/bin/env bash
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPTS_DIR")"
BACKUPS_DIR="$SCRIPTS_DIR/backups"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

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

mkdir -p "$BACKUPS_DIR"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUT="$BACKUPS_DIR/backup_${TIMESTAMP}.sql"

echo -e "${CYAN}Backing up '$DB_NAME' → $OUT ...${NC}"
cd "$ROOT"
docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" > "$OUT"

SIZE=$(du -sh "$OUT" | cut -f1)
echo -e "${GREEN}Done. backup_${TIMESTAMP}.sql  ($SIZE)${NC}"
