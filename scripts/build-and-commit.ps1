# Script completo: Build + Commit automático do APK
# Uso: powershell -ExecutionPolicy Bypass -File scripts/build-and-commit.ps1 [mensagem_commit]

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$buildScript = Join-Path $PSScriptRoot "build-android-debug.ps1"
$commitScript = Join-Path $PSScriptRoot "commit-release.ps1"

Write-Host "=== Build e Commit Automático - Bilu Shape ===" -ForegroundColor Cyan
Write-Host ""

# Executar build
Write-Host "Passo 1/2: Executando build..." -ForegroundColor Yellow
Write-Host ""
& $buildScript

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build falhou. Abortando processo."
    exit 1
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Executar commit
Write-Host "Passo 2/2: Preparando commit..." -ForegroundColor Yellow
Write-Host ""

# Passar mensagem de commit se fornecida
if ($args.Count -gt 0) {
    & $commitScript $args[0]
} else {
    & $commitScript
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "AVISO: Commit nao foi realizado, mas o build foi concluido com sucesso." -ForegroundColor Yellow
    Write-Host "Execute manualmente: powershell -ExecutionPolicy Bypass -File scripts/commit-release.ps1" -ForegroundColor Cyan
    exit 0
}

Write-Host ""
Write-Host "=== Processo completo! ===" -ForegroundColor Green
