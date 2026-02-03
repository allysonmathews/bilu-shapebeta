# Coloca o build (dist) na raiz do projeto para deploy na Hostinger.
# Execute na raiz do projeto. Requer .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Set-Location $root

Write-Host "Rodando build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Copiando index.html e assets para a raiz..." -ForegroundColor Cyan
Copy-Item -Path "$root\dist\index.html" -Destination "$root\index.html" -Force
Remove-Item "$root\assets\*.js", "$root\assets\*.css" -ErrorAction SilentlyContinue
Copy-Item -Path "$root\dist\assets\*" -Destination "$root\assets\" -Force

Write-Host "Deploy na raiz concluído. Faça commit e push para o GitHub." -ForegroundColor Green
