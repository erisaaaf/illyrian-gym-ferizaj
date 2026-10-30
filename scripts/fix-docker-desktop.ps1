# Docker Desktop on Windows sometimes fails to start because stale socket files
# in %LOCALAPPDATA%\Docker\run cannot be deleted ("The file cannot be accessed by
# the system", from its Inference manager). They can't be removed, but the folder
# can be renamed, and Docker recreates it. Run this when `docker ps` hangs or the
# engine never starts. It stops Docker, moves the folder aside, and relaunches.
$ErrorActionPreference = "Stop"
Get-Process | Where-Object { $_.ProcessName -match "docker" } | Stop-Process -Force -ErrorAction SilentlyContinue
wsl --shutdown
Start-Sleep -Seconds 2

$run = Join-Path $env:LOCALAPPDATA "Docker\run"
if (Test-Path $run) {
  $aside = "run_stale_" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  Rename-Item -Path $run -NewName $aside
  Write-Output "Moved $run -> $aside"
}
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Write-Output "Docker Desktop relaunched; give it a minute, then run: docker ps"
