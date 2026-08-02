$ErrorActionPreference = "Continue"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  $dockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
  if (Test-Path $dockerPath) {
    $docker = @{ Source = $dockerPath }
  }
}

if (-not $docker) {
  Write-Host "Docker CLI: NOT FOUND"
  Write-Host "Install Docker Desktop first."
  exit 1
}

Write-Host "Docker CLI:"
& $docker.Source --version

Write-Host ""
Write-Host "Docker Compose:"
& $docker.Source compose version

Write-Host ""
Write-Host "Docker Engine:"
& $docker.Source info
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Docker engine is not ready."
  Write-Host "On Windows, start Docker Desktop and make sure WSL2 is installed/enabled."
  Write-Host "If WSL is missing, open PowerShell as Administrator and run:"
  Write-Host "  wsl --install"
  Write-Host "Then restart Windows."
  exit 1
}

Write-Host ""
Write-Host "Docker is ready."
