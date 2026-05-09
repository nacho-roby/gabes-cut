Add-Type -AssemblyName System.Drawing

function New-IconBitmap {
    param([int]$Size)

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $s = $Size / 128.0

    # Helper: rounded rect path
    function Get-RoundedRect($x, $y, $w, $h, $r) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc($x, $y, $r*2, $r*2, 180, 90)
        $path.AddArc($x + $w - $r*2, $y, $r*2, $r*2, 270, 90)
        $path.AddArc($x + $w - $r*2, $y + $h - $r*2, $r*2, $r*2, 0, 90)
        $path.AddArc($x, $y + $h - $r*2, $r*2, $r*2, 90, 90)
        $path.CloseFigure()
        return $path
    }

    # Background gradient
    $bgRect = New-Object System.Drawing.RectangleF 0, 0, $Size, $Size
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $bgRect,
        [System.Drawing.Color]::FromArgb(42, 71, 94),
        [System.Drawing.Color]::FromArgb(27, 40, 56),
        45.0)
    $bgPath = Get-RoundedRect 0 0 $Size $Size (22 * $s)
    $g.FillPath($bgBrush, $bgPath)

    # Inner border (sutil)
    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(102, 102, 192, 244)), (1.5 * $s)
    $borderPath = Get-RoundedRect (2 * $s) (2 * $s) ($Size - 4 * $s) ($Size - 4 * $s) (20 * $s)
    $g.DrawPath($borderPen, $borderPath)

    # ===== CALCULADORA (lado izquierdo, x=10..68, y=22..108) =====
    # cuerpo
    $calcBody = Get-RoundedRect (10 * $s) (22 * $s) (58 * $s) (86 * $s) (6 * $s)
    $calcBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(199, 213, 224))
    $g.FillPath($calcBrush, $calcBody)
    $calcStroke = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(102, 192, 244)), (1.5 * $s)
    $g.DrawPath($calcStroke, $calcBody)

    # pantalla
    $screenPath = Get-RoundedRect (15 * $s) (27 * $s) (48 * $s) (20 * $s) (2 * $s)
    $screenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(10, 18, 24))
    $g.FillPath($screenBrush, $screenPath)

    # texto $$$ en pantalla
    $screenFontSize = [Math]::Max(6.0, 14 * $s)
    $screenFont = New-Object System.Drawing.Font 'Consolas', $screenFontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(164, 208, 7))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Far
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $screenRectF = New-Object System.Drawing.RectangleF (15 * $s), (27 * $s), (45 * $s), (20 * $s)
    $g.DrawString('$$$', $screenFont, $greenBrush, $screenRectF, $sf)

    # botones de la calculadora (4x4)
    $btnBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(27, 40, 56))
    $accentBlue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(102, 192, 244))
    $accentGreen = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(164, 208, 7))

    $rows = @(54, 68, 82, 96)
    $cols = @(16, 30, 44)
    foreach ($y in $rows) {
        foreach ($x in $cols) {
            $btn = Get-RoundedRect ($x * $s) ($y * $s) (10 * $s) (10 * $s) (1.5 * $s)
            $g.FillPath($btnBrush, $btn)
        }
        # ultima columna (operaciones) en azul/verde
        $color = if ($y -lt 82) { $accentBlue } else { $accentGreen }
        $btn = Get-RoundedRect (58 * $s) ($y * $s) (6 * $s) (10 * $s) (1.5 * $s)
        $g.FillPath($color, $btn)
    }

    # ===== JOYSTICK (lado derecho, asomando arriba) =====
    # base
    $jsBase = Get-RoundedRect (76 * $s) (82 * $s) (40 * $s) (22 * $s) (4 * $s)
    $jsBaseBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(42, 63, 90))
    $g.FillPath($jsBaseBrush, $jsBase)
    $g.DrawPath($calcStroke, $jsBase)

    # botones de la base
    $jsBtnColors = @(
        @{ x = 83; color = [System.Drawing.Color]::FromArgb(164, 208, 7) },
        @{ x = 90; color = [System.Drawing.Color]::FromArgb(192, 57, 43) },
        @{ x = 102; color = [System.Drawing.Color]::FromArgb(241, 196, 15) },
        @{ x = 109; color = [System.Drawing.Color]::FromArgb(102, 192, 244) }
    )
    foreach ($b in $jsBtnColors) {
        $br = New-Object System.Drawing.SolidBrush $b.color
        $r = 2.5 * $s
        $g.FillEllipse($br, ($b.x * $s - $r), (93 * $s - $r), $r * 2, $r * 2)
    }

    # palanca (rect oscuro)
    $stickRect = New-Object System.Drawing.RectangleF (93 * $s), (38 * $s), (6 * $s), (46 * $s)
    $stickBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(27, 40, 56))
    $g.FillRectangle($stickBrush, $stickRect)
    $g.DrawRectangle($calcStroke, [Math]::Round($stickRect.X), [Math]::Round($stickRect.Y), [Math]::Round($stickRect.Width), [Math]::Round($stickRect.Height))

    # bola roja arriba
    $ballX = 96 * $s
    $ballY = 36 * $s
    $ballR = 13 * $s
    $ballRect = New-Object System.Drawing.RectangleF ($ballX - $ballR), ($ballY - $ballR), ($ballR * 2), ($ballR * 2)
    $ballBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $ballRect,
        [System.Drawing.Color]::FromArgb(255, 107, 91),
        [System.Drawing.Color]::FromArgb(160, 42, 31),
        135.0)
    $g.FillEllipse($ballBrush, $ballRect)
    $whitePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (1.5 * $s)
    $g.DrawEllipse($whitePen, $ballRect)

    # brillo de la bola
    $shineRect = New-Object System.Drawing.RectangleF (($ballX - 6 * $s) - (3 * $s)), (($ballY - 4 * $s) - (3 * $s)), (6 * $s), (6 * $s)
    $shineBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(128, 255, 255, 255))
    $g.FillEllipse($shineBrush, $shineRect)

    $g.Dispose()
    return $bmp
}

function Save-Resized {
    param([System.Drawing.Bitmap]$Source, [int]$Size, [string]$Path)
    $resized = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($Source, 0, 0, $Size, $Size)
    $g.Dispose()
    $resized.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
}

$here = $PSScriptRoot
if (-not $here) { $here = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $here) { $here = (Get-Location).Path }

$source = New-IconBitmap -Size 256
Save-Resized -Source $source -Size 128 -Path (Join-Path $here 'icon128.png')
Save-Resized -Source $source -Size 48  -Path (Join-Path $here 'icon48.png')
Save-Resized -Source $source -Size 16  -Path (Join-Path $here 'icon16.png')
$source.Dispose()

Write-Output "Iconos generados en: $here"
