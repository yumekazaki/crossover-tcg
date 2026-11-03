param(
  [Parameter(Mandatory = $true)][string]$SourcePath,
  [Parameter(Mandatory = $true)][string]$DestinationPath
)

Add-Type -AssemblyName System.Drawing
$sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourcePath))
$maxWidth = 760
$maxHeight = 1146
$scale = [Math]::Min($maxWidth / $sourceImage.Width, $maxHeight / $sourceImage.Height)
$width = [Math]::Max(1, [int][Math]::Round($sourceImage.Width * $scale))
$height = [Math]::Max(1, [int][Math]::Round($sourceImage.Height * $scale))
$bitmap = [System.Drawing.Bitmap]::new($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.DrawImage($sourceImage, 0, 0, $width, $height)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
$parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]86)
$bitmap.Save($DestinationPath, $codec, $parameters)
$graphics.Dispose()
$bitmap.Dispose()
$sourceImage.Dispose()
