#!/usr/bin/env bash
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPTS_DIR")"
BACKUPS_DIR="$SCRIPTS_DIR/backups"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'

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

BACKUP_FILE="${1:-}"

# If no argument — list backups and prompt
if [ -z "$BACKUP_FILE" ]; then
    if [ ! -d "$BACKUPS_DIR" ] || [ -z "$(ls "$BACKUPS_DIR"/*.sql 2>/dev/null)" ]; then
        echo -e "${YELLOW}No backups found in $BACKUPS_DIR${NC}"
        exit 1
    fi
    echo -e "${CYAN}Available backups:${NC}"
    ls -lh "$BACKUPS_DIR"/*.sql | awk '{print "  " $NF, "(" $5 ")"}'
    echo ""
    read -rp "Enter filename (or full path): " BACKUP_FILE
fi

# Resolve relative path — only a bare filename (no "/" in it) is assumed to
# live in $BACKUPS_DIR. Anything with a path separator (./backups/x.sql,
# ../x.sql, an absolute path, ...) is resolved relative to the caller's cwd,
# same as normal shell semantics.
if [[ "$BACKUP_FILE" != /* && "$BACKUP_FILE" != */* ]]; then
    BACKUP_FILE="$BACKUPS_DIR/$BACKUP_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}File not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Resolve to an absolute path now — the "cd $ROOT" below changes the
# working directory, which would silently break a still-relative path.
BACKUP_FILE="$(cd "$(dirname "$BACKUP_FILE")" && pwd)/$(basename "$BACKUP_FILE")"

echo -e "${YELLOW}This will DROP and recreate '$DB_NAME'. Continue? [y/N] ${NC}"
read -rp "" confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

echo -e "${CYAN}Restoring '$DB_NAME' from $(basename "$BACKUP_FILE") ...${NC}"
cd "$ROOT"

docker compose exec -T db psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres
docker compose exec -T db psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" postgres
docker compose exec -T db psql -U "$DB_USER" "$DB_NAME" < "$BACKUP_FILE"

echo -e "${GREEN}Restore complete.${NC}"
