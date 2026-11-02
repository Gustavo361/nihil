# Maps Neon .env.local DATABASE_URL_UNPOOLED -> backend/.env (Spring DB_*).
# Does not print secrets.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envLocalPath = Join-Path $root '.env.local'
if (-not (Test-Path $envLocalPath)) {
    throw '.env.local not found. Run: neon deploy'
}

$envLocal = Get-Content $envLocalPath -Raw
if ($envLocal -notmatch 'DATABASE_URL_UNPOOLED="([^"]+)"') {
    throw 'DATABASE_URL_UNPOOLED not found in .env.local'
}

$pgUrl = $Matches[1]
$uri = [Uri]($pgUrl -replace '^postgresql://', 'http://')
$userInfo = $uri.UserInfo.Split(':', 2)
$user = [Uri]::UnescapeDataString($userInfo[0])
$pass = [Uri]::UnescapeDataString($userInfo[1])
$hostName = $uri.Host
$db = $uri.AbsolutePath.TrimStart('/')
$jdbc = "jdbc:postgresql://${hostName}/${db}?sslmode=require"

$backendEnvPath = Join-Path $root 'backend\.env'
@(
    'SERVER_PORT=8080'
    "DB_URL=$jdbc"
    "DB_USERNAME=$user"
    "DB_PASSWORD=$pass"
) | Set-Content -Path $backendEnvPath -Encoding ascii

Write-Host "Wrote backend/.env (DB_URL host=$hostName db=$db user=$user)"
