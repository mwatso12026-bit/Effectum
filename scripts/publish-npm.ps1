# Publish Core to npm from this repo only.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if ((Get-Location).Path -notmatch "Effectum$") {
    throw "Run from Effectum repo (path should end with \Effectum)."
}

$name = (Get-Content package.json -Raw | ConvertFrom-Json).name
if ($name -ne "@effectumcore/effectum") {
    throw "Unexpected package name: $name"
}

Write-Host "npm whoami:"
npm whoami
Write-Host "npm test..."
npm test
Write-Host "npm publish --access public (add --otp=... if 2FA required)"
npm publish --access public @args