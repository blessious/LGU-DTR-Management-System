param(
  [string]$ReleaseRoot = 'release',
  [string]$PackageName = 'MuniWeb-Deploy'
)

$ErrorActionPreference = 'Stop'

function Ensure-File {
  param(
    [string]$Path,
    [string]$Hint
  )

  if (-not (Test-Path $Path)) {
    throw "Required file missing: $Path. $Hint"
  }
}

function Copy-SafeItem {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (Test-Path $Source) {
    $parent = Split-Path -Parent $Destination
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path $parent)) {
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    Copy-Item -Path $Source -Destination $Destination -Recurse -Force
  }
}

$workspace = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $workspace

Ensure-File -Path 'database.deployment.sql' -Hint 'Run: npm run sanitize:sql'
Ensure-File -Path 'package.json' -Hint 'Run this script from project root'
Ensure-File -Path 'server/package.json' -Hint 'Server package.json is required'

$releaseDir = Join-Path $workspace $ReleaseRoot
if (-not (Test-Path $releaseDir)) {
  New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stagingDir = Join-Path $releaseDir "$PackageName-$timestamp"
$zipPath = "$stagingDir.zip"

if (Test-Path $stagingDir) {
  Remove-Item -Path $stagingDir -Recurse -Force
}
if (Test-Path $zipPath) {
  Remove-Item -Path $zipPath -Force
}

New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

$filesToCopy = @(
  'package.json',
  'package-lock.json',
  'bun.lockb',
  'requirements.txt',
  '.env.example',
  'database.deployment.sql',
  'RUNNING_GUIDE.md',
  'README.md',
  'Installation Instructions.md',
  'Installation Instructions.txt',
  'setup.ps1',
  'generate_deployment_sql.ps1',
  'run.bat',
  'stop_app.bat',
  'START_SYSTEM.vbs',
  'get_ip.bat',
  'components.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'eslint.config.js',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'index.html'
)

$directoriesToCopy = @(
  'src',
  'public',
  'server'
)

foreach ($file in $filesToCopy) {
  $src = Join-Path $workspace $file
  $dst = Join-Path $stagingDir $file
  Copy-SafeItem -Source $src -Destination $dst
}

foreach ($dir in $directoriesToCopy) {
  $src = Join-Path $workspace $dir
  $dst = Join-Path $stagingDir $dir
  Copy-SafeItem -Source $src -Destination $dst
}

# Remove local/runtime artifacts and sensitive machine-specific files from package.
$excludePaths = @(
  '.git',
  '.venv',
  'node_modules',
  'dist',
  'server/node_modules',
  '.env',
  'database.sql',
  'new_dtr (Backup).sql',
  'server/config.json',
  'server/exports',
  'server/uploads',
  'uploads'
)

foreach ($exclude in $excludePaths) {
  $target = Join-Path $stagingDir $exclude
  if (Test-Path $target) {
    Remove-Item -Path $target -Recurse -Force
  }
}

# Ensure safe server-side templates are present for deployment setup.
Copy-SafeItem -Source (Join-Path $workspace 'server/config.example.json') -Destination (Join-Path $stagingDir 'server/config.example.json')

Compress-Archive -Path (Join-Path $stagingDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ''
Write-Host 'Release package created successfully.' -ForegroundColor Green
Write-Host " - Staging folder: $stagingDir"
Write-Host " - ZIP file: $zipPath"
Write-Host ''
Write-Host 'Package safety checks applied:' -ForegroundColor Cyan
Write-Host ' - Included database.deployment.sql (sanitized schema + seed admin)'
Write-Host ' - Excluded .env, server/config.json, database.sql, uploads, exports, node_modules, and .git'
