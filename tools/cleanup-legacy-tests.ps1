param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $ProjectRoot 'package.json'))) { throw 'Run this script from the stamp-card-app project.' }
# Only explicitly retired experiments and the replaced starter assets.
$Targets = @(
 'animation-storage-test', 'image-trigger-test',
 'app/api/image-trigger', 'app/event-card-fast', 'public/animation-test',
 'public/next.svg', 'public/vercel.svg', 'public/file.svg', 'public/globe.svg', 'public/window.svg'
)
foreach ($Target in $Targets) {
 $FullPath = Join-Path $ProjectRoot $Target
 if (Test-Path -LiteralPath $FullPath) {
  if ($Apply) { Remove-Item -LiteralPath $FullPath -Recurse -Force; Write-Host "Removed: $Target" }
  else { Write-Host "Will remove: $Target" }
 }
}
if (-not $Apply) { Write-Host 'Preview only. Add -Apply to remove the listed paths.' }
