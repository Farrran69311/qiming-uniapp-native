param(
  [int]$H5Port = 8851,
  [int]$ShellPort = 8861
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeProject = Join-Path $repoRoot "native-app"
$hbuilderCli = "G:\qiming-uniapp-native-tools\HBuilderX-5.07\HBuilderX\cli.exe"
$adb = "G:\qiming-uniapp-native-tools\android-sdk\platform-tools\adb.exe"
$java = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\bin\java.exe"
$keytool = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\bin\keytool.exe"
$androidKeystore = "G:\qiming-uniapp-native-tools\certs\qiming-android-release.keystore"
$packConfig = Join-Path $nativeProject "pack-config.local.json"
$appManifest = Join-Path $nativeProject "dist\build\app\manifest.json"
$sourceManifest = Join-Path $nativeProject "src\manifest.json"

$checks = New-Object System.Collections.Generic.List[object]

function Add-Check([string]$Name, [string]$Status, [string]$Detail) {
  $checks.Add([pscustomobject]@{
    Name = $Name
    Status = $Status
    Detail = $Detail
  })
}

function Test-Port([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Try-Run([scriptblock]$Block) {
  try {
    return (& $Block | Out-String).Trim()
  } catch {
    return "ERROR: $($_.Exception.Message)"
  }
}

$branch = Try-Run { git -C $repoRoot rev-parse --abbrev-ref HEAD }
$status = Try-Run { git -C $repoRoot status --short }
Add-Check "git branch" ($(if ($branch -eq "main") { "OK" } else { "WARN" })) $branch
Add-Check "git clean" ($(if ([string]::IsNullOrWhiteSpace($status)) { "OK" } else { "WARN" })) ($(if ([string]::IsNullOrWhiteSpace($status)) { "clean" } else { $status }))

$agentCommit = Try-Run { git -C "C:\Users\farde\Desktop\vue-pure-admin-max" rev-parse origin/agent }
Add-Check "source origin/agent" ($(if ($agentCommit -match "^[a-f0-9]{40}$") { "OK" } else { "WARN" })) $agentCommit

Add-Check "H5 preview port $H5Port" ($(if (Test-Port $H5Port) { "OK" } else { "WARN" })) ($(if (Test-Port $H5Port) { "listening" } else { "not listening; run pnpm native:preview" }))
Add-Check "uni shell port $ShellPort" ($(if (Test-Port $ShellPort) { "OK" } else { "WARN" })) ($(if (Test-Port $ShellPort) { "listening" } else { "not listening; run pnpm native:preview" }))

Add-Check "HBuilderX CLI" ($(if (Test-Path -LiteralPath $hbuilderCli) { "OK" } else { "FAIL" })) $hbuilderCli
Add-Check "Java" ($(if (Test-Path -LiteralPath $java) { "OK" } else { "FAIL" })) $java
Add-Check "Keytool" ($(if (Test-Path -LiteralPath $keytool) { "OK" } else { "FAIL" })) $keytool
Add-Check "ADB" ($(if (Test-Path -LiteralPath $adb) { "OK" } else { "FAIL" })) $adb

$hbuilderUser = if (Test-Path -LiteralPath $hbuilderCli) { Try-Run { & $hbuilderCli user info } } else { "" }
if ($hbuilderUser -match "user info:OK") {
  Add-Check "DCloud login" "WARN" "CLI user info is OK, but cloud packaging still requested HBuilderX login; verify inside HBuilderX before packaging."
} elseif ([string]::IsNullOrWhiteSpace($hbuilderUser)) {
  Add-Check "DCloud login" "WARN" "not checked because HBuilderX CLI is unavailable"
} else {
  Add-Check "DCloud login" "WARN" $hbuilderUser
}

$adbDevices = if (Test-Path -LiteralPath $adb) { Try-Run { & $adb devices -l } } else { "" }
$deviceCount = (($adbDevices -split "`n") | Where-Object { $_ -match "\bdevice\b" -and $_ -notmatch "List of devices" }).Count
Add-Check "Android device" ($(if ($deviceCount -gt 0) { "OK" } else { "WARN" })) ($(if ($deviceCount -gt 0) { "$deviceCount device(s)" } else { "no device attached" }))

Add-Check "Android keystore" ($(if (Test-Path -LiteralPath $androidKeystore) { "OK" } else { "WARN" })) $androidKeystore
if (Test-Path -LiteralPath $sourceManifest) {
  $manifestAppid = Try-Run { (Get-Content -LiteralPath $sourceManifest -Raw -Encoding UTF8 | ConvertFrom-Json).appid }
  Add-Check "DCloud AppID" ($(if ($manifestAppid -and $manifestAppid -ne "__UNI__QIMING" -and $manifestAppid -match "^__UNI__") { "OK" } else { "WARN" })) ($(if ($manifestAppid) { $manifestAppid } else { "missing manifest appid" }))
} else {
  Add-Check "DCloud AppID" "WARN" "missing native-app/src/manifest.json"
}

if (Test-Path -LiteralPath $packConfig) {
  $packConfigText = Get-Content -LiteralPath $packConfig -Raw -Encoding UTF8
  Add-Check "pack-config.local.json" ($(if ($packConfigText -match "CHANGE_ME") { "WARN" } else { "OK" })) ($(if ($packConfigText -match "CHANGE_ME") { "contains placeholders; run pnpm native:pack:check" } else { $packConfig }))
} else {
  Add-Check "pack-config.local.json" "WARN" "missing; run pnpm native:pack:init"
}

$iosCerts = Get-ChildItem -Path "G:\qiming-uniapp-native-tools" -Recurse -File -Include *.p12,*.mobileprovision -ErrorAction SilentlyContinue
Add-Check "iOS certificates" ($(if ($iosCerts.Count -gt 0) { "OK" } else { "WARN" })) ($(if ($iosCerts.Count -gt 0) { "$($iosCerts.Count) file(s)" } else { "no .p12/.mobileprovision found" }))

Add-Check "App build resource" ($(if (Test-Path -LiteralPath $appManifest) { "OK" } else { "WARN" })) ($(if (Test-Path -LiteralPath $appManifest) { $appManifest } else { "missing; run pnpm --dir native-app build:app" }))

$checks | Format-Table -AutoSize -Wrap

$okCount = ($checks | Where-Object { $_.Status -eq "OK" }).Count
$warnCount = ($checks | Where-Object { $_.Status -eq "WARN" }).Count
$failCount = ($checks | Where-Object { $_.Status -eq "FAIL" }).Count
Write-Host ""
Write-Host "Native doctor summary: $okCount OK, $warnCount WARN, $failCount FAIL"

$failed = $checks | Where-Object { $_.Status -eq "FAIL" }
if ($failed.Count -gt 0) {
  exit 1
}
