param(
  [ValidateSet("android", "ios", "android,ios")]
  [string]$Platform = "android",
  [switch]$SkipPrepare
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeProject = Join-Path $repoRoot "native-app"
$hbuilderCli = "G:\qiming-uniapp-native-tools\HBuilderX-5.07\HBuilderX\cli.exe"
$configPath = Join-Path $nativeProject "pack-config.local.json"
$examplePath = Join-Path $nativeProject "pack-config.example.json"
$packConfigCheck = Join-Path $PSScriptRoot "native-pack-config.ps1"
$effectiveConfigPath = Join-Path $nativeProject "pack-config.effective.tmp.json"

function Require-File([string]$Path, [string]$Message) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw $Message
  }
}

Require-File $hbuilderCli "HBuilderX CLI not found: $hbuilderCli"
Require-File $nativeProject "native app project not found: $nativeProject"
Require-File $configPath "Missing local pack config: $configPath. Copy $examplePath to pack-config.local.json and fill local certificate values."
Require-File $packConfigCheck "Missing pack config checker: $packConfigCheck"

& $packConfigCheck -Mode check -Platform $Platform -Strict
if ($LASTEXITCODE -ne 0) {
  throw "Native pack config check failed. Fix the WARN/FAIL items above before calling HBuilderX pack."
}

$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
$androidCertPassword = [Environment]::GetEnvironmentVariable("QIMING_ANDROID_CERT_PASSWORD")
$androidStorePassword = [Environment]::GetEnvironmentVariable("QIMING_ANDROID_STORE_PASSWORD")
$iosCertPassword = [Environment]::GetEnvironmentVariable("QIMING_IOS_CERT_PASSWORD")

if ($androidCertPassword) {
  $config.android.certpassword = $androidCertPassword
}
if ($androidStorePassword) {
  $config.android.storepassword = $androidStorePassword
}
if ($iosCertPassword) {
  $config.ios.certpassword = $iosCertPassword
}

try {
  $config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $effectiveConfigPath -Encoding UTF8

  if (-not $SkipPrepare) {
    Push-Location $repoRoot
    try {
      pnpm native:prepare
    } finally {
      Pop-Location
    }
  }

  & $hbuilderCli project open --path $nativeProject

  $platformArg = if ($Platform -eq "android,ios") { "android,ios" } else { $Platform }
  & $hbuilderCli pack --project $nativeProject --platform $platformArg --config $effectiveConfigPath --safemode true --sourceMap false
} finally {
  Remove-Item -LiteralPath $effectiveConfigPath -ErrorAction SilentlyContinue
}
