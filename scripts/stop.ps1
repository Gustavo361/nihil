# Encerra backend (8080) e frontend (4200) do Nihil — inclusive processos ainda subindo.
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\stop.ps1

$ErrorActionPreference = 'Continue'

function Stop-ListenersOnPort([int]$Port) {
    $pids = @()
    try {
        $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    } catch {
        $lines = netstat -ano | Select-String ":$Port\s+.*LISTENING"
        foreach ($line in $lines) {
            $parts = ($line.ToString() -split '\s+') | Where-Object { $_ }
            if ($parts.Count -ge 5) {
                $pids += [int]$parts[-1]
            }
        }
        $pids = $pids | Select-Object -Unique
    }

    foreach ($procId in $pids) {
        if ($procId -le 0) { continue }
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if (-not $proc) { continue }
        Write-Host "Encerrando PID $procId ($($proc.ProcessName)) na porta $Port..."
        & taskkill.exe /PID $procId /T /F 2>$null | Out-Null
    }
}

function Stop-NihilProcessTree {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and (
                $_.CommandLine -match 'com\.nihil\.NihilApplication' -or
                $_.CommandLine -match 'spring-boot:run' -or
                $_.CommandLine -match 'nihil-backend' -or
                $_.CommandLine -match 'meusProjetos\\Nihil\\backend' -or
                $_.CommandLine -match 'meusProjetos/Nihil/backend' -or
                $_.CommandLine -match 'meusProjetos\\Nihil\\frontend' -or
                $_.CommandLine -match 'meusProjetos/Nihil/frontend' -or
                ($_.CommandLine -match 'ng serve' -and $_.CommandLine -match '4200')
            )
        } |
        ForEach-Object {
            Write-Host "Encerrando PID $($_.ProcessId) ($($_.Name))..."
            & taskkill.exe /PID $_.ProcessId /T /F 2>$null | Out-Null
        }
}

Write-Host '==> Parando Nihil (backend :8080 e frontend :4200)...'
# Mata árvores primeiro (Maven/Java ainda sem bind na porta).
Stop-NihilProcessTree
Stop-ListenersOnPort 8080
Stop-ListenersOnPort 4200
# Segunda passagem por se algum filho reapareceu.
Start-Sleep -Milliseconds 400
Stop-NihilProcessTree
Stop-ListenersOnPort 8080
Stop-ListenersOnPort 4200

Write-Host 'Projeto parado. Portas 8080 e 4200 devem estar livres.'
