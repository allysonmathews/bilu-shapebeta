# Gera icones Android em todas as densidades a partir de icon.png.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/generate-android-icons.ps1
# Requer: icon.png na raiz do projeto.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $root "icon.png"
$resDir = Join-Path $root "android\app\src\main\res"

$mipmaps = @(
    @{ folder = "mipmap-mdpi";     legacy = 48;  foreground = 108 },
    @{ folder = "mipmap-hdpi";     legacy = 72;  foreground = 162 },
    @{ folder = "mipmap-xhdpi";    legacy = 96;  foreground = 216 },
    @{ folder = "mipmap-xxhdpi";   legacy = 144; foreground = 324 },
    @{ folder = "mipmap-xxxhdpi";  legacy = 192; foreground = 432 }
)

if (-not (Test-Path $iconPath)) {
    Write-Error "icon.png nao encontrado em: $iconPath"
    exit 1
}

function Resize-ImageToFile {
    param([System.Drawing.Image]$src, [int]$size, [string]$outPath)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($src, 0, 0, $size, $size)
    $g.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Write-Host "Gerando icones Android a partir de icon.png...`n"
$img = [System.Drawing.Image]::FromFile($iconPath)

try {
    foreach ($m in $mipmaps) {
        $dir = Join-Path $resDir $m.folder
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

        $base = Join-Path $dir "ic_launcher.png"
        $round = Join-Path $dir "ic_launcher_round.png"
        $fg = Join-Path $dir "ic_launcher_foreground.png"

        Resize-ImageToFile -src $img -size $m.legacy -outPath $base
        Resize-ImageToFile -src $img -size $m.legacy -outPath $round
        Resize-ImageToFile -src $img -size $m.foreground -outPath $fg

        Write-Host "  $($m.folder): ic_launcher $($m.legacy)px, ic_launcher_round $($m.legacy)px, ic_launcher_foreground $($m.foreground)px"
    }
    Write-Host "`nIcones gerados com sucesso."
} finally {
    $img.Dispose()
}
