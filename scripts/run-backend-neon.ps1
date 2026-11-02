# Boots backend with profile prod using backend/.env (Neon).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$envFile = Join-Path $backend '.env'
if (-not (Test-Path $envFile)) {
    throw 'backend/.env missing. Run scripts\map-neon-env.ps1 first.'
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line.Split('=', 2)
    if ($parts.Count -ne 2) { return }
    Set-Item -Path ("Env:" + $parts[0]) -Value $parts[1]
}

if (-not $env:DB_URL -or -not $env:DB_PASSWORD) {
    throw 'DB_URL / DB_PASSWORD not loaded from backend/.env'
}

Write-Host 'Using DB credentials from backend/.env (secrets hidden).'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'stop.ps1') | Out-Null

$candidates = @(
    'C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot',
    'C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot'
)
$javaHome = $candidates | Where-Object { Test-Path (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
if (-not $javaHome) { throw 'JDK 21 not found' }
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"

$outLog = Join-Path $env:TEMP 'nihil-neon-boot.out'
Remove-Item $outLog -ErrorAction SilentlyContinue

$arg = '/c mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=prod" > "' + $outLog + '" 2>&1'
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList $arg -WorkingDirectory $backend -PassThru -WindowStyle Hidden
Write-Host "Started backend PID=$($proc.Id) log=$outLog"

$deadline = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $deadline) {
    if ($proc.HasExited) {
        Write-Host "Backend exited code=$($proc.ExitCode)"
        if (Test-Path $outLog) { Get-Content $outLog -Tail 80 }
        exit 1
    }
    try {
        $r = Invoke-RestMethod -Uri 'http://localhost:8080/actuator/health' -TimeoutSec 2
        if ($r.status -eq 'UP') {
            $r | ConvertTo-Json -Compress
            Set-Content -Path (Join-Path $env:TEMP 'nihil-neon-boot.pid') -Value $proc.Id
            exit 0
        }
    } catch { }
    Start-Sleep -Seconds 4
}

Write-Host 'TIMEOUT waiting for health'
if (Test-Path $outLog) { Get-Content $outLog -Tail 100 }
try { & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null } catch { }
exit 1
