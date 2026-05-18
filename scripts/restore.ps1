# Restore PostgreSQL database from a .sql backup file
param(
    [string]$BackupFile
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

# If no file given, list available backups
$backupsDir = Join-Path $PSScriptRoot "backups"
if (-not $BackupFile) {
    if (-not (Test-Path $backupsDir)) {
        Write-Host "No backups folder found at $backupsDir" -ForegroundColor Yellow
        exit 1
    }
    $files = Get-ChildItem $backupsDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending
    if ($files.Count -eq 0) {
        Write-Host "No backups found in $backupsDir" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Available backups:" -ForegroundColor Cyan
    $files | ForEach-Object { Write-Host "  $($_.Name)  ($([math]::Round($_.Length/1KB,1)) KB)" }
    Write-Host ""
    $BackupFile = Read-Host "Enter filename (or full path)"
}

# Resolve path
if (-not [System.IO.Path]::IsPathRooted($BackupFile)) {
    $BackupFile = Join-Path $backupsDir $BackupFile
}

if (-not (Test-Path $BackupFile)) {
    Write-Host "File not found: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "This will DROP and recreate '$dbName'. Continue? [y/N] " -ForegroundColor Yellow -NoNewline
$confirm = Read-Host
if ($confirm -notmatch '^[Yy]$') { Write-Host "Aborted."; exit 0 }

Write-Host "Restoring '$dbName' from $(Split-Path $BackupFile -Leaf) ..." -ForegroundColor Cyan

Set-Location $root

# Drop and recreate DB
docker compose exec -T db psql -U $dbUser -c "DROP DATABASE IF EXISTS $dbName;" postgres | Out-Null
docker compose exec -T db psql -U $dbUser -c "CREATE DATABASE $dbName OWNER $dbUser;" postgres | Out-Null

# Restore
Get-Content $BackupFile | docker compose exec -T db psql -U $dbUser $dbName

if ($LASTEXITCODE -eq 0) {
    Write-Host "Restore complete." -ForegroundColor Green
} else {
    Write-Host "Restore failed." -ForegroundColor Red
    exit 1
}
