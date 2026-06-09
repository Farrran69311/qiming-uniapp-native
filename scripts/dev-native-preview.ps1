param(
  [ValidateSet("student", "teacher", "admin")]
  [string]$Role = "teacher",
  [int]$H5Port = 8851,
  [int]$ShellPort = 8861
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeProject = Join-Path $repoRoot "native-app"
$h5Out = Join-Path $repoRoot ".dev-server.out.log"
$h5Err = Join-Path $repoRoot ".dev-server.err.log"
$shellOut = Join-Path $repoRoot ".native-dev.out.log"
$shellErr = Join-Path $repoRoot ".native-dev.err.log"

function Test-Port([int]$Port) {
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $connection
}

function Start-PreviewProcess([string]$Name, [string]$WorkingDirectory, [string]$Command, [string]$OutFile, [string]$ErrFile, [int]$Port) {
  if (Test-Port $Port) {
    Write-Host "$Name already appears to be running on port $Port."
    return
  }

  Remove-Item -LiteralPath $OutFile, $ErrFile -ErrorAction SilentlyContinue
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes("Set-Location -LiteralPath '$WorkingDirectory'; $Command"))
  Start-Process -FilePath "powershell" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encoded) `
    -RedirectStandardOutput $OutFile `
    -RedirectStandardError $ErrFile `
    -WindowStyle Hidden | Out-Null
}

Start-PreviewProcess `
  -Name "H5 app" `
  -WorkingDirectory $repoRoot `
  -Command "pnpm dev -- --host 0.0.0.0 --port $H5Port" `
  -OutFile $h5Out `
  -ErrFile $h5Err `
  -Port $H5Port

Start-PreviewProcess `
  -Name "uni-app shell" `
  -WorkingDirectory $nativeProject `
  -Command "pnpm dev:h5 -- --host 0.0.0.0 --port $ShellPort" `
  -OutFile $shellOut `
  -ErrFile $shellErr `
  -Port $ShellPort

Write-Host ""
Write-Host "Live native preview:"
Write-Host "  http://localhost:$ShellPort/?demoRole=$Role"
Write-Host ""
Write-Host "Logs:"
Write-Host "  $h5Out"
Write-Host "  $h5Err"
Write-Host "  $shellOut"
Write-Host "  $shellErr"
