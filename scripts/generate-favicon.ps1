Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class NativeMethods {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool DestroyIcon(IntPtr handle);
}
"@

function New-FaviconBitmap {
  param(
    [int]$Size,
    [string]$Path
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $ring = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.Rectangle]::new(0, 0, $Size, $Size),
    [System.Drawing.Color]::FromArgb(96, 165, 250),
    [System.Drawing.Color]::FromArgb(167, 139, 250),
    45
  )
  $fill = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.Rectangle]::new(0, 0, $Size, $Size),
    [System.Drawing.Color]::FromArgb(15, 23, 42),
    [System.Drawing.Color]::FromArgb(17, 28, 61),
    45
  )

  $graphics.FillEllipse($ring, 1, 1, $Size - 2, $Size - 2)
  $graphics.FillEllipse($fill, 3, 3, $Size - 6, $Size - 6)

  $fontSize = [Math]::Max([int]($Size * 0.34), 8)
  $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(226, 232, 240))
  $graphics.DrawString("PF", $font, $brush, [System.Drawing.RectangleF]::new(0, 0, $Size, $Size), $format)

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $brush.Dispose()
  $format.Dispose()
  $font.Dispose()
  $fill.Dispose()
  $ring.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

function New-FaviconIco {
  param([string]$Path)

  $bitmap = New-Object System.Drawing.Bitmap(32, 32)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $ring = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.Rectangle]::new(0, 0, 32, 32),
    [System.Drawing.Color]::FromArgb(96, 165, 250),
    [System.Drawing.Color]::FromArgb(167, 139, 250),
    45
  )
  $fill = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.Rectangle]::new(0, 0, 32, 32),
    [System.Drawing.Color]::FromArgb(15, 23, 42),
    [System.Drawing.Color]::FromArgb(17, 28, 61),
    45
  )
  $graphics.FillEllipse($ring, 1, 1, 30, 30)
  $graphics.FillEllipse($fill, 3, 3, 26, 26)

  $font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(226, 232, 240))
  $graphics.DrawString("PF", $font, $brush, [System.Drawing.RectangleF]::new(0, 0, 32, 32), $format)

  $handle = $bitmap.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($handle)
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create)
  $icon.Save($stream)
  $stream.Dispose()
  [NativeMethods]::DestroyIcon($handle) | Out-Null

  $icon.Dispose()
  $brush.Dispose()
  $format.Dispose()
  $font.Dispose()
  $fill.Dispose()
  $ring.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-FaviconBitmap -Size 16 -Path "c:\Users\hp\Desktop\Stopwatch\public\favicon-16x16.png"
New-FaviconBitmap -Size 32 -Path "c:\Users\hp\Desktop\Stopwatch\public\favicon-32x32.png"
New-FaviconBitmap -Size 180 -Path "c:\Users\hp\Desktop\Stopwatch\public\apple-touch-icon.png"
New-FaviconIco -Path "c:\Users\hp\Desktop\Stopwatch\public\favicon.ico"
