# Generates the MSIX visual assets in src-tauri/msstore/assets from src-tauri/icons/icon.png.
#
# Windows draws a packaged app's taskbar and Start icon on an accent-coloured plate unless
# the package has "unplated" target-size variants of Square44x44Logo. Those, and the scale
# variants of the other logos, are resolved through resources.pri, which
# scripts/windows-msstore-package.js builds with makepri. Re-run this after changing the
# app icon:
#
#   pwsh scripts/windows-msstore-icons.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'src-tauri\icons\icon.png'
$outDir = Join-Path $root 'src-tauri\msstore\assets'

if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
New-Item -ItemType Directory -Force $outDir | Out-Null

$src = [System.Drawing.Image]::FromFile($source)

function Save-Resized([int]$size, [string]$name) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $attrs = New-Object System.Drawing.Imaging.ImageAttributes
    $attrs.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $size, $size), 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
    $g.Dispose()
    $bmp.Save((Join-Path $outDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# Taskbar, Start list, title bar, Alt+Tab and Explorer: target sizes, plated and unplated.
foreach ($size in 16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256) {
    Save-Resized $size "Square44x44Logo.targetsize-$size.png"
    Save-Resized $size "Square44x44Logo.targetsize-${size}_altform-unplated.png"
    Save-Resized $size "Square44x44Logo.targetsize-${size}_altform-lightunplated.png"
}

# Tiles and the package logo at each display scale.
$scales = @{ 100 = 1.0; 125 = 1.25; 150 = 1.5; 200 = 2.0; 400 = 4.0 }
foreach ($scale in $scales.Keys) {
    $factor = $scales[$scale]
    Save-Resized ([int][Math]::Round(44 * $factor)) "Square44x44Logo.scale-$scale.png"
    Save-Resized ([int][Math]::Round(150 * $factor)) "Square150x150Logo.scale-$scale.png"
    Save-Resized ([int][Math]::Round(50 * $factor)) "StoreLogo.scale-$scale.png"
}

$src.Dispose()
$count = (Get-ChildItem $outDir -File).Count
Write-Output "Wrote $count assets to $outDir"
