param(
  [int]$Port = 8080,
  [string]$Root = '.'
)

Add-Type -AssemblyName System.Net
Add-Type -AssemblyName System.IO

$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "Preview running at $prefix"

function Get-MimeType($ext) {
  switch ($ext.ToLower()) {
    '.html' { 'text/html' }
    '.css'  { 'text/css' }
    '.js'   { 'application/javascript' }
    '.json' { 'application/json' }
    '.csv'  { 'text/csv' }
    '.png'  { 'image/png' }
    '.jpg'  { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.svg'  { 'image/svg+xml' }
    default { 'text/plain' }
  }
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $path = $context.Request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }
    $full = Join-Path $Root $path
    if (-not (Test-Path $full)) {
      $context.Response.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
      $context.Response.OutputStream.Write($bytes,0,$bytes.Length)
      $context.Response.Headers.Add('Cache-Control','no-cache')
      $context.Response.Close()
      continue
    }
    $ext = [System.IO.Path]::GetExtension($full)
    $mime = Get-MimeType $ext
    $bytes = [System.IO.File]::ReadAllBytes($full)
    $context.Response.ContentType = $mime
    # Caching: no-cache para HTML, caché para assets
    if ($ext -eq '.html') {
      $context.Response.Headers.Add('Cache-Control','no-cache, no-store, must-revalidate')
    } else {
      $context.Response.Headers.Add('Cache-Control','public, max-age=86400')
    }
    # CORS básico para servir vistas parciales
    $context.Response.Headers.Add('Access-Control-Allow-Origin','*')
    $context.Response.OutputStream.Write($bytes,0,$bytes.Length)
    $context.Response.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}