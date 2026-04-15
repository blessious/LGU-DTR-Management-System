$ErrorActionPreference = 'Stop'

function Test-Command {
  param(
    [string]$Name,
    [string]$InstallHint
  )

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $cmd) {
    Write-Host "[Missing] $Name - $InstallHint" -ForegroundColor Red
    return $false
  }

  Write-Host "[OK] $Name" -ForegroundColor Green
  return $true
}

function Read-Value {
  param(
    [string]$Prompt,
    [string]$Default = ''
  )

  if ($Default) {
    $value = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) {
      return $Default
    }
    return $value
  }

  while ($true) {
    $value = Read-Host $Prompt
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value
    }
    Write-Host 'Value is required.' -ForegroundColor Yellow
  }
}

Write-Host 'MuniWeb Guided Setup' -ForegroundColor Cyan
Write-Host 'This script generates .env and server/config.json for this machine.'
Write-Host ''

Write-Host 'Preflight checks:' -ForegroundColor Cyan
$checks = @(
  Test-Command -Name 'node' -InstallHint 'Install Node.js 18+ and restart terminal'
  Test-Command -Name 'npm' -InstallHint 'Install Node.js 18+ and restart terminal'
  Test-Command -Name 'python' -InstallHint 'Install Python 3.8+ and add it to PATH'
  Test-Command -Name 'pip' -InstallHint 'Ensure Python pip is available in PATH'
)

if ($checks -contains $false) {
  Write-Host ''
  Write-Host 'One or more required tools are missing. Install missing dependencies and run setup.ps1 again.' -ForegroundColor Yellow
  exit 1
}

Write-Host ''

$workspace = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $workspace

$dbHost = Read-Value -Prompt 'MySQL host' -Default 'localhost'
$dbUser = Read-Value -Prompt 'MySQL user' -Default 'root'
$dbPassword = Read-Host 'MySQL password (can be blank)'
$dbName = Read-Value -Prompt 'MySQL database name' -Default 'bless_dtr_test'
$dbPort = Read-Value -Prompt 'MySQL port' -Default '3306'

$apiHost = Read-Value -Prompt 'API host for frontend URL' -Default 'localhost'
$apiPort = Read-Value -Prompt 'API port' -Default '5000'
$appPort = Read-Value -Prompt 'Backend app port' -Default $apiPort
$webPort = Read-Value -Prompt 'Frontend web port (Vite)' -Default '8080'
$exportPath = Read-Value -Prompt 'Export path (relative or absolute)' -Default 'exports'

$origins = @(
  "http://localhost:$webPort",
  "http://127.0.0.1:$webPort"
)

if ($apiHost -ne 'localhost' -and $apiHost -ne '127.0.0.1') {
  $origins += "http://$apiHost:$webPort"
}

$allowedOrigins = ($origins | Select-Object -Unique) -join ','
$apiUrl = "http://$apiHost:$apiPort"

$envContent = @"
MYSQL_HOST=$dbHost
MYSQL_USER=$dbUser
MYSQL_PASSWORD=$dbPassword
MYSQL_DATABASE=$dbName
MYSQL_PORT=$dbPort
VITE_API_URL=$apiUrl
VITE_PORT=$webPort
PORT=$appPort
ALLOWED_ORIGINS=$allowedOrigins
EXPORT_PATH=$exportPath
"@

Set-Content -Path (Join-Path $workspace '.env') -Value $envContent -Encoding UTF8

$configObject = [ordered]@{
  database = [ordered]@{
    host = $dbHost
    user = $dbUser
    password = $dbPassword
    database = $dbName
    port = [int]$dbPort
  }
  export = [ordered]@{
    path = $exportPath
  }
}

$configPath = Join-Path $workspace 'server\config.json'
$configObject | ConvertTo-Json -Depth 5 | Set-Content -Path $configPath -Encoding UTF8

Write-Host ''
Write-Host 'Configuration written successfully:' -ForegroundColor Green
Write-Host " - $(Join-Path $workspace '.env')"
Write-Host " - $configPath"
Write-Host ''
Write-Host 'Next steps:'
Write-Host ' 1) Run npm install (root and server)'
Write-Host ' 2) Run pip install -r requirements.txt'
Write-Host ' 3) Run npm run dev'
