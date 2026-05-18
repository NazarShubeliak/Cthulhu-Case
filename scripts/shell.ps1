# Open an interactive shell in a container
# Usage: .\shell.ps1           — Django Python shell
#        .\shell.ps1 bash      — bash in web container
#        .\shell.ps1 db        — psql in db container
#        .\shell.ps1 redis     — redis-cli
param(
    [string]$Mode = "django"
)

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# Load .env for DB creds
$envPath = Join-Path $root ".env"
$dbName = "cthulhu_db"
$dbUser = "cthulhu"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.+)$') {
            $k = $matches[1].Trim(); $v = $matches[2].Trim()
            if ($k -eq "DB_NAME") { $dbName = $v }
            if ($k -eq "DB_USER") { $dbUser = $v }
        }
    }
}

switch ($Mode) {
    "django" {
        Write-Host "Opening Django shell..." -ForegroundColor Cyan
        docker compose exec web python manage.py shell
    }
    "bash" {
        Write-Host "Opening bash in web container..." -ForegroundColor Cyan
        docker compose exec web bash
    }
    "db" {
        Write-Host "Opening psql ($dbName)..." -ForegroundColor Cyan
        docker compose exec db psql -U $dbUser $dbName
    }
    "redis" {
        Write-Host "Opening redis-cli..." -ForegroundColor Cyan
        docker compose exec redis redis-cli
    }
    default {
        Write-Host "Unknown mode '$Mode'. Use: django | bash | db | redis" -ForegroundColor Red
        exit 1
    }
}
