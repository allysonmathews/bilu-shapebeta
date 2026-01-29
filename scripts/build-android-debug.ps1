# Script para limpar, gerar keystore de debug e construir APK assinado
# Uso: powershell -ExecutionPolicy Bypass -File scripts/build-android-debug.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $root "android"
$appDir = Join-Path $androidDir "app"
$keystorePath = Join-Path $appDir "debug.keystore"
$gradlew = Join-Path $androidDir "gradlew.bat"
$versionPropertiesPath = Join-Path $androidDir "version.properties"

Write-Host "=== Build Android Debug - Bilu Shape ===" -ForegroundColor Cyan
Write-Host ""

# Incrementar versão automaticamente
Write-Host "Atualizando versao..." -ForegroundColor Yellow
if (Test-Path $versionPropertiesPath) {
    # Ler propriedades atuais
    $versionProperties = @{}
    Get-Content $versionPropertiesPath | ForEach-Object {
        if ($_ -match '^\s*([^=]+)\s*=\s*(.+)\s*$') {
            $versionProperties[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    
    # Obter valores atuais
    $major = [int]$versionProperties['VERSION_MAJOR']
    $minor = [int]$versionProperties['VERSION_MINOR']
    $patch = [int]$versionProperties['VERSION_PATCH']
    
    # Incrementar patch
    $patch++
    
    # Salvar propriedades atualizadas
    $newContent = @"
VERSION_MAJOR=$major
VERSION_MINOR=$minor
VERSION_PATCH=$patch
"@
    Set-Content -Path $versionPropertiesPath -Value $newContent -Encoding UTF8
    
    Write-Host "Versao atualizada: $major.$minor.$patch" -ForegroundColor Green
} else {
    Write-Host "AVISO: Arquivo version.properties nao encontrado. Criando com valores padrao..." -ForegroundColor Yellow
    $defaultContent = @"
VERSION_MAJOR=1
VERSION_MINOR=0
VERSION_PATCH=1
"@
    Set-Content -Path $versionPropertiesPath -Value $defaultContent -Encoding UTF8
    Write-Host "Arquivo version.properties criado com versao 1.0.1" -ForegroundColor Green
}

Write-Host ""

# Verificar se o keystore de debug existe ou se existe o keystore padrão do sistema
$defaultKeystorePath = Join-Path $env:USERPROFILE ".android\debug.keystore"
$keystoreExists = (Test-Path $keystorePath) -or (Test-Path $defaultKeystorePath)

if (-not $keystoreExists) {
    Write-Host "Keystore de debug nao encontrado. Criando..." -ForegroundColor Yellow
    
    # Verificar se keytool está disponível (normalmente vem com JDK)
    $keytool = $null
    
    # Tentar encontrar no PATH primeiro
    $keytoolCmd = Get-Command keytool -ErrorAction SilentlyContinue
    if ($keytoolCmd) {
        $keytool = $keytoolCmd.Source
    }
    
    # Se não encontrou, tentar JAVA_HOME
    if (-not $keytool -and $env:JAVA_HOME) {
        $keytoolPath = Join-Path $env:JAVA_HOME "bin\keytool.exe"
        if (Test-Path $keytoolPath) {
            $keytool = $keytoolPath
        }
    }
    
    # Se ainda não encontrou, procurar em locais comuns do Android Studio/JDK
    if (-not $keytool) {
        $commonPaths = @(
            "$env:LOCALAPPDATA\Android\Sdk\jbr\bin\keytool.exe",
            "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe",
            "$env:ProgramFiles\Java\*\bin\keytool.exe",
            "${env:ProgramFiles(x86)}\Java\*\bin\keytool.exe",
            "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr\bin\keytool.exe"
        )
        
        foreach ($pathPattern in $commonPaths) {
            $found = Get-ChildItem -Path $pathPattern -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found -and (Test-Path $found.FullName)) {
                $keytool = $found.FullName
                break
            }
        }
    }
    
    if (-not $keytool -or -not (Test-Path $keytool)) {
        Write-Host ""
        Write-Host "ERRO: keytool nao encontrado." -ForegroundColor Red
        Write-Host "Por favor, certifique-se de que:" -ForegroundColor Yellow
        Write-Host "  1. O JDK esta instalado" -ForegroundColor Yellow
        Write-Host "  2. JAVA_HOME esta configurado, OU" -ForegroundColor Yellow
        Write-Host "  3. O Android Studio esta instalado (que inclui o JDK)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Alternativamente, crie o keystore manualmente executando:" -ForegroundColor Cyan
        Write-Host "  keytool -genkey -v -keystore android\app\debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname `"CN=Android Debug,O=Android,C=US`"" -ForegroundColor White
        Write-Host ""
        exit 1
    }
    
    # Criar o keystore de debug padrão do Android
    & $keytool -genkey -v -keystore $keystorePath -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao criar keystore de debug."
        exit 1
    }
    
    Write-Host "Keystore de debug criado com sucesso!" -ForegroundColor Green
} else {
    if (Test-Path $keystorePath) {
        Write-Host "Keystore de debug local encontrado." -ForegroundColor Green
    } else {
        Write-Host "Usando keystore de debug padrao do sistema." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Limpando projeto..." -ForegroundColor Yellow
Push-Location $androidDir
try {
    & $gradlew clean
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao limpar o projeto."
        exit 1
    }
    Write-Host "Projeto limpo com sucesso!" -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Construindo APK de debug..." -ForegroundColor Yellow
Push-Location $androidDir
try {
    & $gradlew assembleDebug
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao construir APK de debug."
        exit 1
    }
    Write-Host ""
    Write-Host "=== Build concluido com sucesso! ===" -ForegroundColor Green
    Write-Host ""
    
    # Capturar e mover APK para pasta releases
    $apkSourcePath = Join-Path $appDir "build\outputs\apk\debug"
    $releasesDir = Join-Path $root "releases"
    
    if (Test-Path $apkSourcePath) {
        $apkFiles = Get-ChildItem -Path $apkSourcePath -Filter "BiluShape-*.apk"
        
        if ($apkFiles) {
            # Criar pasta releases se não existir
            if (-not (Test-Path $releasesDir)) {
                New-Item -ItemType Directory -Path $releasesDir -Force | Out-Null
                Write-Host "Pasta releases criada." -ForegroundColor Green
            }
            
            foreach ($apk in $apkFiles) {
                # Extrair versão do nome do arquivo (ex: BiluShape-v1.1.21.apk -> 1.1.21)
                $versionMatch = $apk.Name -match "BiluShape-v(.+)\.apk"
                if ($versionMatch) {
                    $version = $matches[1]
                    $targetFileName = "BiluShape-v${version}.apk"
                    $targetPath = Join-Path $releasesDir $targetFileName
                    
                    # Remover APK antigo da mesma versão se existir
                    if (Test-Path $targetPath) {
                        Remove-Item $targetPath -Force
                        Write-Host "APK anterior da versao ${version} removido." -ForegroundColor Yellow
                    }
                    
                    # Copiar APK para releases
                    Copy-Item $apk.FullName $targetPath -Force
                    Write-Host ""
                    Write-Host "APK movido com sucesso!" -ForegroundColor Green
                    Write-Host "  Origem: $($apk.FullName)" -ForegroundColor Gray
                    Write-Host "  Destino: $targetPath" -ForegroundColor Cyan
                    Write-Host ""
                    
                    # Mostrar informações do APK
                    $apkInfo = Get-Item $targetPath
                    Write-Host "Informacoes do APK:" -ForegroundColor Cyan
                    Write-Host "  Nome: $($apkInfo.Name)" -ForegroundColor White
                    Write-Host "  Versao: ${version}" -ForegroundColor White
                    Write-Host "  Tamanho: $([math]::Round($apkInfo.Length / 1MB, 2)) MB" -ForegroundColor White
                    Write-Host ""
                } else {
                    Write-Host "AVISO: Nao foi possivel extrair a versao do arquivo $($apk.Name)" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "AVISO: Nenhum APK encontrado em $apkSourcePath" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ERRO: Pasta de build nao encontrada: $apkSourcePath" -ForegroundColor Red
    }
} finally {
    Pop-Location
}

Write-Host ""
