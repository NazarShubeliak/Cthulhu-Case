# Tail logs from one or all services
# Usage: .\logs.ps1            — all services
#        .\logs.ps1 web        — Django only
#        .\logs.ps1 frontend   — Vite only
#        .\logs.ps1 db         — PostgreSQL only
param(
    [string]$Service = "",
    [int]$Lines = 50
)

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if ($Service) {
    Write-Host "Tailing logs: $Service (last $Lines lines)" -ForegroundColor Cyan
    docker compose logs -f --tail=$Lines $Service
} else {
    Write-Host "Tailing logs: all services (last $Lines lines each)" -ForegroundColor Cyan
    docker compose logs -f --tail=$Lines
}
