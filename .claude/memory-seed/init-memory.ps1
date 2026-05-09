# Initialises Claude Code project memory from seed files.
# Run once on a new machine from the project root:
#   .\.claude\memory-seed\init-memory.ps1

$projectPath = (Get-Location).Path
$encoded = $projectPath -replace '\\', '-' -replace ':', '-' -replace ' ', '-'
$encoded = $encoded -replace '^-', ''
$dest = "$env:USERPROFILE\.claude\projects\$encoded\memory"

if (Test-Path $dest) {
    Write-Host "Memory directory already exists at: $dest"
    $overwrite = Read-Host "Overwrite? (y/N)"
    if ($overwrite -ne 'y') { exit 0 }
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item "$PSScriptRoot\*.md" $dest -Force
Write-Host "Memory initialised at: $dest"
