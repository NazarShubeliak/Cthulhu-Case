#!/usr/bin/env bash
# Run all backend and frontend tests.
# Usage: ./scripts/test.sh [pytest-args]
#   ./scripts/test.sh                     — all tests
#   ./scripts/test.sh apps/campaigns/     — only campaigns
#   ./scripts/test.sh -k test_create      — filter by name

set -e
cd "$(dirname "$0")/.."

echo "══════════════════════════════════════"
echo "  Backend tests (pytest)"
echo "══════════════════════════════════════"
docker compose exec -T -e DEBUG=True web python -m pytest --tb=short "$@"

echo ""
echo "══════════════════════════════════════"
echo "  Frontend tests (vitest)"
echo "══════════════════════════════════════"
docker compose exec -T frontend npx vitest run --reporter=verbose

echo ""
echo "✓ All tests passed"
