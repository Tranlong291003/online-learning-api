$ErrorActionPreference = "Stop"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  $dockerPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
  if (Test-Path $dockerPath) {
    $docker = @{ Source = $dockerPath }
  } else {
    throw "Docker CLI was not found. Install Docker Desktop, then open a new terminal."
  }
}

& $docker.Source compose up --build
exit $LASTEXITCODE
