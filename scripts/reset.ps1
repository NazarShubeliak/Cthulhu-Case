# Full reset: stop containers, wipe volumes, rebuild images, start, migrate
param(
    [switch]$NoCache
)

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "=== Cthulhu Case — Full Reset ===" -ForegroundColor Magenta
Write-Host "This will DESTROY all data (DB volumes). Continue? [y/N] " -ForegroundColor Yellow -NoNewline
$confirm = Read-Host
if ($confirm -notmatch '^[Yy]$') { Write-Host "Aborted."; exit 0 }

Write-Host ""
Write-Host "[1/4] Stopping and removing containers + volumes..." -ForegroundColor Cyan
docker compose down -v --remove-orphans

Write-Host ""
Write-Host "[2/4] Building images..." -ForegroundColor Cyan
if ($NoCache) {
    docker compose build --no-cache
} else {
    docker compose build
}

Write-Host ""
Write-Host "[3/4] Starting containers..." -ForegroundColor Cyan
docker compose up -d

Write-Host ""
Write-Host "[4/4] Waiting for DB to be ready..." -ForegroundColor Cyan
$retries = 20
for ($i = 0; $i -lt $retries; $i++) {
    $result = docker compose exec -T db pg_isready 2>&1
    if ($result -match "accepting connections") { break }
    Write-Host "  waiting... ($($i+1)/$retries)"
    Start-Sleep -Seconds 2
}

docker compose exec web python manage.py migrate

Write-Host ""
Write-Host "Reset complete. Frontend: http://localhost:3000  API: http://localhost:8000" -ForegroundColor Green
Write-Host "Create superuser: docker compose exec web python manage.py createsuperuser" -ForegroundColor DarkGray
