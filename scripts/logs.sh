#!/usr/bin/env bash
set -euo pipefail

ROOT="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
CYAN='\033[0;36m'; NC='\033[0m'

SERVICE="${1:-}"
LINES="${2:-50}"

cd "$ROOT"

if [ -n "$SERVICE" ]; then
    echo -e "${CYAN}Tailing logs: $SERVICE (last $LINES lines)${NC}"
    docker compose logs -f --tail="$LINES" "$SERVICE"
else
    echo -e "${CYAN}Tailing logs: all services (last $LINES lines each)${NC}"
    docker compose logs -f --tail="$LINES"
fi
