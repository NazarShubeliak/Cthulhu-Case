#!/usr/bin/env bash
set -euo pipefail

ROOT="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

cd "$ROOT"

# Usage: ./scripts/test.sh [--be|--fe] [extra pytest/vitest args]
#   ./scripts/test.sh               — backend + frontend
#   ./scripts/test.sh --be          — тільки backend
#   ./scripts/test.sh --fe          — тільки frontend
#   ./scripts/test.sh --be -k login — backend з фільтром по назві
#   ./scripts/test.sh --be apps/game_sessions/tests/ — конкретна папка

RUN_BE=true
RUN_FE=true
EXTRA_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --be) RUN_FE=false ;;
    --fe) RUN_BE=false ;;
    *)    EXTRA_ARGS+=("$arg") ;;
  esac
done

BE_FAILED=false
FE_FAILED=false

if $RUN_BE; then
  echo -e "\n${CYAN}══════════════════════════════════════${NC}"
  echo -e "${CYAN}  Backend tests  (pytest)${NC}"
  echo -e "${CYAN}══════════════════════════════════════${NC}\n"
  if docker compose exec -T -e DEBUG=True web python -m pytest --tb=short "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"; then
    echo -e "\n${GREEN}✓ Backend passed${NC}"
  else
    echo -e "\n${RED}✗ Backend failed${NC}"
    BE_FAILED=true
  fi
fi

if $RUN_FE; then
  echo -e "\n${CYAN}══════════════════════════════════════${NC}"
  echo -e "${CYAN}  Frontend tests  (vitest)${NC}"
  echo -e "${CYAN}══════════════════════════════════════${NC}\n"
  if docker compose exec -T frontend npx vitest run --reporter=verbose; then
    echo -e "\n${GREEN}✓ Frontend passed${NC}"
  else
    echo -e "\n${RED}✗ Frontend failed${NC}"
    FE_FAILED=true
  fi
fi

echo ""
if $BE_FAILED || $FE_FAILED; then
  echo -e "${RED}Some tests failed.${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed.${NC}"
fi
