# Script para fazer commit automático do APK gerado
# Uso: powershell -ExecutionPolicy Bypass -File scripts/commit-release.ps1 [mensagem_commit]

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$releasesDir = Join-Path $root "releases"

# Verificar se estamos em um repositório Git
Push-Location $root
try {
    $gitStatus = git status --porcelain 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Este diretorio nao e um repositorio Git."
        exit 1
    }
    
    # Verificar se há APKs na pasta releases
    if (-not (Test-Path $releasesDir)) {
        Write-Host "Pasta releases nao encontrada. Execute o build primeiro." -ForegroundColor Yellow
        exit 1
    }
    
    $apkFiles = Get-ChildItem -Path $releasesDir -Filter "*.apk" -ErrorAction SilentlyContinue
    
    if (-not $apkFiles -or $apkFiles.Count -eq 0) {
        Write-Host "Nenhum APK encontrado na pasta releases." -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "=== Commit de Release APK ===" -ForegroundColor Cyan
    Write-Host ""
    
    # Mostrar APKs que serão commitados
    Write-Host "APKs encontrados:" -ForegroundColor Yellow
    foreach ($apk in $apkFiles) {
        $versionMatch = $apk.Name -match "BiluShape-v(.+)\.apk"
        $version = if ($versionMatch) { $matches[1] } else { "desconhecida" }
        Write-Host "  - $($apk.Name) (v${version}) - $([math]::Round($apk.Length / 1MB, 2)) MB" -ForegroundColor White
    }
    Write-Host ""
    
    # Verificar status do Git
    $statusOutput = git status --short releases/
    if ([string]::IsNullOrWhiteSpace($statusOutput)) {
        Write-Host "Nenhuma alteracao detectada na pasta releases." -ForegroundColor Yellow
        Write-Host "Os APKs ja estao commitados ou nao foram modificados." -ForegroundColor Yellow
        exit 0
    }
    
    # Adicionar APKs ao staging
    Write-Host "Adicionando APKs ao staging..." -ForegroundColor Yellow
    git add releases/*.apk
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao adicionar arquivos ao staging."
        exit 1
    }
    
    Write-Host "APKs adicionados com sucesso!" -ForegroundColor Green
    Write-Host ""
    
    # Obter mensagem de commit
    $commitMessage = $args[0]
    if ([string]::IsNullOrWhiteSpace($commitMessage)) {
        # Gerar mensagem automática baseada na versão mais recente
        $latestApk = $apkFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        $versionMatch = $latestApk.Name -match "BiluShape-v(.+)\.apk"
        $version = if ($versionMatch) { $matches[1] } else { "unknown" }
        $commitMessage = "chore: adicionar APK de debug v${version}"
    }
    
    Write-Host "Mensagem de commit: $commitMessage" -ForegroundColor Cyan
    Write-Host ""
    
    # Perguntar confirmação (opcional - pode ser removido para automação completa)
    $confirm = Read-Host "Deseja fazer o commit? (S/N)"
    if ($confirm -ne "S" -and $confirm -ne "s" -and $confirm -ne "Y" -and $confirm -ne "y") {
        Write-Host "Commit cancelado pelo usuario." -ForegroundColor Yellow
        git reset HEAD releases/*.apk
        exit 0
    }
    
    # Fazer commit
    Write-Host "Fazendo commit..." -ForegroundColor Yellow
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao fazer commit."
        exit 1
    }
    
    Write-Host ""
    Write-Host "=== Commit realizado com sucesso! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Para enviar ao repositorio remoto, execute:" -ForegroundColor Cyan
    Write-Host "  git push" -ForegroundColor White
    Write-Host ""
    
} finally {
    Pop-Location
}
