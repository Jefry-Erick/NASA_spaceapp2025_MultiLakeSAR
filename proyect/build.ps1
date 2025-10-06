param(
  [string]$OutDir = 'dist'
)

Write-Output "Building production bundle to $OutDir"

if (Test-Path $OutDir) {
  Remove-Item -Recurse -Force $OutDir
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Copiar HTML raíz
Copy-Item -Path 'index.html' -Destination $OutDir

# Copiar vistas y estilos
New-Item -ItemType Directory -Force -Path "$OutDir/views" | Out-Null
Copy-Item -Path 'views/*.html' -Destination "$OutDir/views"
Copy-Item -Path 'views/styles.css' -Destination "$OutDir/views"
Copy-Item -Path 'views/main.js' -Destination "$OutDir/views"

# Copiar controladores y modelos
New-Item -ItemType Directory -Force -Path "$OutDir/controllers" | Out-Null
Copy-Item -Path 'controllers/*.js' -Destination "$OutDir/controllers"

New-Item -ItemType Directory -Force -Path "$OutDir/models" | Out-Null
Copy-Item -Path 'models/*.js' -Destination "$OutDir/models"

# Copiar datasets de ejemplo
Copy-Item -Path '..\datos_simulados.csv' -Destination "$OutDir" -ErrorAction SilentlyContinue
Copy-Item -Path '..\datos simulados.csv' -Destination "$OutDir" -ErrorAction SilentlyContinue

Write-Output "Build completed. Output: $OutDir"