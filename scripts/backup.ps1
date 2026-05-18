# Backup PostgreSQL database from the running db container
param(
    [string]$OutputDir = "$PSScriptRoot\backups"
)

$root = Split-Path $PSScriptRoot -Parent

# Load .env
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

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$filename  = "backup_${timestamp}.sql"
$outPath   = Join-Path $OutputDir $filename

Write-Host "Backing up '$dbName' → $outPath ..." -ForegroundColor Cyan

Set-Location $root
docker compose exec -T db pg_dump -U $dbUser $dbName | Out-File -FilePath $outPath -Encoding utf8

if ($LASTEXITCODE -eq 0) {
    $size = [math]::Round((Get-Item $outPath).Length / 1KB, 1)
    Write-Host "Done. $filename  ($size KB)" -ForegroundColor Green
} else {
    Write-Host "Backup failed." -ForegroundColor Red
    exit 1
}
