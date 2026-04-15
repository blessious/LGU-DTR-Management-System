param(
  [string]$SourceSql = 'database.sql',
  [string]$OutputSql = 'database.deployment.sql',
  [switch]$SeedDefaultAdmin = $true,
  [string]$AdminUsername = 'admin',
  [string]$AdminDisplayName = 'System Administrator',
  [int]$AdminLevel = 3,
  [string]$AdminPasswordHash = '$2b$10$NFqLlKojAtopP.0K5iHty.CyopICENpu0rUQFtBUFhDzhEkjh.nIi'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $SourceSql)) {
  throw "Source SQL file not found: $SourceSql"
}

Write-Host 'Generating sanitized deployment SQL...' -ForegroundColor Cyan
Write-Host " - Source: $SourceSql"
Write-Host " - Output: $OutputSql"

$raw = Get-Content -Path $SourceSql -Raw

# Keep table structures but remove all current data rows.
$sanitized = $raw -replace '(?ms)^INSERT INTO .*?;\r?\n', ''

# Normalize auto-increment metadata for cleaner deployment seed state.
$sanitized = $sanitized -replace 'AUTO_INCREMENT=\d+\s*', ''

# Remove source-environment metadata that may expose internal hostnames/IPs.
$sanitizedLines = $sanitized -split "`r?`n"
$sanitizedLines = $sanitizedLines | Where-Object {
  $_ -notmatch '^--\s*Host:' -and $_ -notmatch '^--\s*Server version'
}
$sanitized = ($sanitizedLines -join "`r`n") + "`r`n"

$header = @"
-- ================================================================
-- MuniWeb Deployment Database (Sanitized)
-- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
-- Notes:
--  1) Operational data rows were removed from this file.
--  2) This file is intended for new customer deployments.
-- ================================================================

"@

$footer = "`r`n-- End of sanitized deployment SQL`r`n"

if ($SeedDefaultAdmin) {
  $escapedUsername = $AdminUsername.Replace("'", "''")
  $escapedName = $AdminDisplayName.Replace("'", "''")
  $escapedHash = $AdminPasswordHash.Replace("'", "''")

  $adminSeed = @"

-- Default deployment admin account
-- Username: $escapedUsername
-- Temporary password (plain): ChangeMe123!
-- IMPORTANT: Change this password immediately after first login.
INSERT INTO `admins` (`username`, `password`, `name`, `level`)
VALUES ('$escapedUsername', '$escapedHash', '$escapedName', $AdminLevel);
"@
} else {
  $adminSeed = @"

-- No default admin was seeded. Ensure at least one admin account is created
-- before handing this deployment to end users.
"@
}

$content = $header + $sanitized + $adminSeed + $footer
Set-Content -Path $OutputSql -Value $content -Encoding UTF8

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host "Created sanitized SQL: $OutputSql"
if ($SeedDefaultAdmin) {
  Write-Host 'Default deployment login:' -ForegroundColor Yellow
  Write-Host " - Username: $AdminUsername"
  Write-Host ' - Password: ChangeMe123!'
  Write-Host 'Change the password immediately after first login.'
}
