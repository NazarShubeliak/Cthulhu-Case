# Run Django migrations (and optionally makemigrations)
param(
    [switch]$Make,
    [string]$App = ""
)

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if ($Make) {
    Write-Host "Making migrations..." -ForegroundColor Cyan
    if ($App) {
        docker compose exec web python manage.py makemigrations $App
    } else {
        docker compose exec web python manage.py makemigrations
    }
}

Write-Host "Applying migrations..." -ForegroundColor Cyan
docker compose exec web python manage.py migrate

if ($LASTEXITCODE -eq 0) {
    Write-Host "Done." -ForegroundColor Green
} else {
    Write-Host "Migration failed." -ForegroundColor Red
    exit 1
}
