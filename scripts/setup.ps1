# Instala dependências do backend e do frontend (Windows).
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Require-Command([string]$name, [string]$hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Comando '$name' não encontrado. $hint"
    }
}

Write-Host '==> Checando pré-requisitos...'
Require-Command java 'Instale o JDK 21 (ex.: winget install Microsoft.OpenJDK.21) — somente com sua autorização.'
Require-Command node 'Instale Node.js 22 LTS — somente com sua autorização.'
Require-Command pnpm 'Instale com: npm install -g pnpm — somente com sua autorização.'

# java -version escreve em stderr; com $ErrorActionPreference=Stop isso vira exceção no PowerShell.
$javaVersionText = (cmd /c "java -version 2>&1" | Out-String)
if ($javaVersionText -notmatch 'version "21') {
    Write-Warning "Java 21 é o alvo do projeto. Detectado:`n$javaVersionText"
} else {
    Write-Host 'Java OK (21).'
}

Write-Host '==> Backend: baixando dependências Maven...'
Push-Location (Join-Path $root 'backend')
try {
    & .\mvnw.cmd -DskipTests dependency:resolve
    if ($LASTEXITCODE -ne 0) { throw "Maven falhou com código $LASTEXITCODE" }
}
finally {
    Pop-Location
}

$frontend = Join-Path $root 'frontend'

Write-Host '==> Frontend: instalando pacotes pnpm...'
# pnpm 12: configs de build ficam em .npmrc (kebab-case) + pnpm-workspace.yaml.
Set-Content -Path (Join-Path $frontend '.npmrc') -Value "dangerously-allow-all-builds=true`n" -Encoding ascii

# Evita prompt interativo de analytics do Angular no ng serve.
$env:NG_CLI_ANALYTICS = 'false'
$angularConfig = Join-Path $env:USERPROFILE '.angular-config.json'
$angularConfigBody = @'
{
  "version": 1,
  "cli": {
    "analytics": false
  }
}
'@
if (-not (Test-Path $angularConfig)) {
    Set-Content -Path $angularConfig -Value $angularConfigBody -Encoding utf8
}

Push-Location $frontend
try {
    & pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Tentando aprovar builds pendentes e reinstalar...'
        & pnpm approve-builds --all -y
        & pnpm install
        if ($LASTEXITCODE -ne 0) { throw "pnpm install falhou com código $LASTEXITCODE" }
    }
    & pnpm rebuild esbuild "@parcel/watcher" lmdb msgpackr-extract
}
finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Setup concluído. Para subir o projeto:'
Write-Host '  scripts\dev.cmd'
