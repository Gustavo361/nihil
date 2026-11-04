# Sobe backend + frontend no Windows, no mesmo terminal (saída enxuta).
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -ProfileName dev
# Ctrl+C encerra a árvore inteira (Job Object + stop.ps1). Sem log persistente.

param(
    [ValidateSet('smoke', 'dev')]
    [string]$ProfileName = 'smoke'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$script:BackendProcess = $null
$script:FrontendProcess = $null
$script:TailJobs = @()
$script:BackendLog = Join-Path $env:TEMP ("nihil-backend-{0}.log" -f $PID)
$script:FrontendLog = Join-Path $env:TEMP ("nihil-frontend-{0}.log" -f $PID)
$script:BackendReady = $false
$script:FrontendReady = $false
$script:BannerShown = $false
$script:SummaryShown = $false
$script:Stopped = $false
$script:StopEvent = New-Object System.Threading.ManualResetEventSlim $false

function Import-NihilEnv([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#') -or -not $trimmed.Contains('=')) { continue }
        $pair = $trimmed.Split('=', 2)
        [Environment]::SetEnvironmentVariable($pair[0].Trim(), $pair[1].Trim(), 'Process')
    }
}

Import-NihilEnv (Join-Path $backend '.env')

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

# Se o PowerShell morrer (Ctrl+C / fechar janela), os filhos no Job são mortos automaticamente.
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class NihilJob {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
  static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool CloseHandle(IntPtr hObject);

  [StructLayout(LayoutKind.Sequential)]
  struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
    public long PerProcessUserTimeLimit;
    public long PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize;
    public UIntPtr MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass;
    public uint SchedulingClass;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct IO_COUNTERS {
    public ulong ReadOperationCount;
    public ulong WriteOperationCount;
    public ulong OtherOperationCount;
    public ulong ReadTransferCount;
    public ulong WriteTransferCount;
    public ulong OtherTransferCount;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
    public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit;
    public UIntPtr JobMemoryLimit;
    public UIntPtr PeakProcessMemoryUsed;
    public UIntPtr PeakJobMemoryUsed;
  }

  const int JobObjectExtendedLimitInformation = 9;
  const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;

  static IntPtr job = IntPtr.Zero;

  public static void Init() {
    if (job != IntPtr.Zero) { return; }
    job = CreateJobObject(IntPtr.Zero, null);
    if (job == IntPtr.Zero) {
      throw new InvalidOperationException("CreateJobObject failed");
    }
    var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
    IntPtr ptr = Marshal.AllocHGlobal(length);
    try {
      Marshal.StructureToPtr(info, ptr, false);
      if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, ptr, (uint)length)) {
        throw new InvalidOperationException("SetInformationJobObject failed");
      }
    } finally {
      Marshal.FreeHGlobal(ptr);
    }
  }

  public static void AddProcess(Process process) {
    if (job == IntPtr.Zero) { Init(); }
    if (!AssignProcessToJobObject(job, process.Handle)) {
      throw new InvalidOperationException("AssignProcessToJobObject failed for PID " + process.Id);
    }
  }

  public static void Close() {
    if (job != IntPtr.Zero) {
      CloseHandle(job);
      job = IntPtr.Zero;
    }
  }
}
'@

function Resolve-JavaHome21 {
    $candidates = @()
    if ($env:JAVA_HOME) { $candidates += $env:JAVA_HOME }
    $candidates += @(
        'C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot',
        'C:\Program Files\Microsoft\jdk-21.0.13.21-hotspot'
    )
    $candidates += @(Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Filter 'jdk-21*' -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
    $candidates += @(Get-ChildItem 'C:\Program Files\Microsoft' -Filter 'jdk-21*' -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })

    foreach ($jdkHome in $candidates) {
        if ($jdkHome -and (Test-Path (Join-Path $jdkHome 'bin\java.exe'))) {
            return $jdkHome
        }
    }

    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if ($javaCmd) {
        return (Split-Path (Split-Path $javaCmd.Source -Parent) -Parent)
    }
    throw 'JDK 21 não encontrado. Instale o Java 21 e tente de novo.'
}

function Start-NihilLogTail([string]$LogPath, [string]$Prefix) {
    $rs = [runspacefactory]::CreateRunspace()
    $rs.Open()
    $ps = [powershell]::Create()
    $ps.Runspace = $rs
    [void]$ps.AddScript({
        param([string]$Path, [string]$Tag)
        while (-not (Test-Path -LiteralPath $Path)) {
            Start-Sleep -Milliseconds 200
        }
        Get-Content -LiteralPath $Path -Wait -Tail 0 -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object {
            $line = $_
            if ([string]::IsNullOrWhiteSpace($line)) { return }

            $noise = $line -match 'Could not transfer metadata|prefixes\.txt|auto-discovered prefixes|Error while writing new mojo status|Using generated security password|development use only|Global AuthenticationManager|UserDetailsServiceAutoConfiguration|Re-optimizing dependencies|optimizer\] bundling|press h \+ enter|NOTE: Raw file sizes|Watch mode enabled|Initial chunk files|^\s*main\.js|^\s*styles\.css|Initial total|Application bundle generation complete|Building\.\.\.|√ Building|newer than the version Flyway has been verified|latest verified version of H2'
            if ($noise) { return }

            $interesting = $line -match '(?i)\b(error|exception|fatal|failed|failure|caused by:|build failure|application failed|unable to|eaddrinuse|cannot find|not found)\b' `
                -or $line -match 'Flyway.*failed|Migration.*failed'

            if (-not $interesting) { return }

            [Console]::Out.WriteLine("[$Tag] $line")
            [Console]::Out.Flush()
        }
    }).AddArgument($LogPath).AddArgument($Prefix)
    [void]$ps.BeginInvoke()
    $script:TailJobs += @{ Ps = $ps; Rs = $rs }
}

function Stop-NihilDevChildren {
    if ($script:Stopped) { return }
    $script:Stopped = $true

    foreach ($job in $script:TailJobs) {
        try { $job.Ps.Stop() } catch { }
        try { $job.Ps.Dispose() } catch { }
        try { $job.Rs.Close() } catch { }
        try { $job.Rs.Dispose() } catch { }
    }
    $script:TailJobs = @()

    foreach ($proc in @($script:FrontendProcess, $script:BackendProcess)) {
        if ($proc -and -not $proc.HasExited) {
            & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
            try { $proc.WaitForExit(3000) | Out-Null } catch { }
        }
    }
    $script:FrontendProcess = $null
    $script:BackendProcess = $null

    # Fecha o Job → mata qualquer filho restante (java/node netos).
    try { [NihilJob]::Close() } catch { }

    foreach ($tmp in @($script:BackendLog, $script:FrontendLog)) {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }

    # Rede de segurança: portas + padrões de comando.
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'stop.ps1') | Out-Null
}

function Start-HiddenCmd([string]$CommandLine, [string]$WorkingDirectory, [string]$LogPath) {
    Set-Content -Path $LogPath -Value '' -Encoding utf8

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'cmd.exe'
    $psi.Arguments = '/c ' + $CommandLine + ' > "' + $LogPath + '" 2>&1'
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    if (-not $proc.Start()) {
        throw "Falha ao iniciar: $CommandLine"
    }
    [NihilJob]::AddProcess($proc)
    return $proc
}

if ($ProfileName -eq 'dev') {
    foreach ($var in @('DB_URL', 'DB_USERNAME', 'DB_PASSWORD')) {
        if (-not [Environment]::GetEnvironmentVariable($var)) {
            throw "Perfil dev exige a variável de ambiente $var. Veja backend/.env.example e o README."
        }
    }
}

if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    throw "node_modules ausente em $frontend. Rode antes: .\scripts\setup.ps1"
}

$env:NG_CLI_ANALYTICS = 'false'
$angularConfig = Join-Path $env:USERPROFILE '.angular-config.json'
Set-Content -Path $angularConfig -Value (@'
{
  "version": 1,
  "cli": {
    "analytics": false
  }
}
'@) -Encoding utf8

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'stop.ps1') | Out-Null

[NihilJob]::Init()

# Ctrl+C: evita kill abrupto do PowerShell; o loop sai e o finally limpa tudo.
# (Se o CMD matar o PowerShell mesmo assim, o Job Object ainda mata os filhos.)
$stopEvent = $script:StopEvent
[Console]::add_CancelKeyPress({
        param($sender, $eventArgs)
        $eventArgs.Cancel = $true
        $stopEvent.Set()
    }.GetNewClosure())

$javaHome = Resolve-JavaHome21

$backendCmd = 'set "JAVA_HOME=' + $javaHome + '" && set "Path=%JAVA_HOME%\bin;%Path%" && mvnw.cmd -q spring-boot:run "-Dspring-boot.run.profiles=' + $ProfileName + '"'
$script:BackendProcess = Start-HiddenCmd -CommandLine $backendCmd -WorkingDirectory $backend -LogPath $script:BackendLog
Start-NihilLogTail -LogPath $script:BackendLog -Prefix 'backend'

$frontendCmd = 'set NG_CLI_ANALYTICS=false && pnpm.cmd exec ng serve --host 127.0.0.1 --port 4200'
$script:FrontendProcess = Start-HiddenCmd -CommandLine $frontendCmd -WorkingDirectory $frontend -LogPath $script:FrontendLog
Start-NihilLogTail -LogPath $script:FrontendLog -Prefix 'frontend'

function Test-BackendReady {
    try {
        $r = Invoke-RestMethod -Uri 'http://localhost:8080/actuator/health' -TimeoutSec 2
        return ($r.status -eq 'UP')
    } catch {
        return $false
    }
}

function Test-FrontendReady {
    try {
        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:4200/' -UseBasicParsing -TimeoutSec 2
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Show-BackendBannerOnce {
    if ($script:BannerShown) { return }
    if (-not (Test-Path -LiteralPath $script:BackendLog)) { return }

    $raw = $null
    try {
        $raw = Get-Content -LiteralPath $script:BackendLog -Raw -Encoding UTF8 -ErrorAction Stop
    } catch {
        return
    }
    if ([string]::IsNullOrWhiteSpace($raw)) { return }

    $plain = [regex]::Replace($raw, '\x1B\[[0-9;]*m', '')
    $match = [regex]::Match(
        $plain,
        '(?ms)^[ \t]*={8,}[ \t]*\r?\n.*?^[ \t]*HTTP Port[ \t]*:.*?(?=\r?\n)'
    )
    if (-not $match.Success) { return }

    Write-Host ''
    Write-Host ($match.Value.TrimEnd())
    Write-Host ''
    $script:BannerShown = $true
}

function Show-ReadySummaryOnce {
    if ($script:SummaryShown) { return }
    if (-not ($script:FrontendReady -and $script:BackendReady)) { return }

    $dot = [char]0x25CF
    Write-Host ''
    Write-Host ("  {0} " -f $dot) -ForegroundColor Green -NoNewline
    Write-Host 'frontend  http://localhost:4200'
    Write-Host ("  {0} " -f $dot) -ForegroundColor Green -NoNewline
    Write-Host 'backend   http://localhost:8080/actuator/health'
    Write-Host ''
    $script:SummaryShown = $true
}

try {
    while (-not $script:StopEvent.IsSet) {
        Show-BackendBannerOnce

        if (-not $script:FrontendReady -and (Test-FrontendReady)) {
            $script:FrontendReady = $true
        }
        if (-not $script:BackendReady -and (Test-BackendReady)) {
            $script:BackendReady = $true
        }
        Show-ReadySummaryOnce

        if ($script:BackendProcess.HasExited -and $script:FrontendProcess.HasExited) {
            break
        }
        if ($script:BackendProcess.HasExited -and -not $script:BackendReady) {
            Write-Host "[backend] saiu antes de ficar pronto (código $($script:BackendProcess.ExitCode))."
            break
        }
        if ($script:FrontendProcess.HasExited -and -not $script:FrontendReady) {
            Write-Host "[frontend] saiu antes de ficar pronto (código $($script:FrontendProcess.ExitCode))."
            break
        }
        Start-Sleep -Milliseconds 500
    }
}
finally {
    Stop-NihilDevChildren
}
