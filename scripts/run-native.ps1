param(
  [ValidateSet("android", "ios")]
  [string]$Platform = "android",
  [string]$DeviceId = "",
  [string]$EntryPath = "/home",
  [switch]$SkipPrepare,
  [switch]$NativeLog,
  [switch]$SkipGrantPermissions,
  [switch]$KeepRuntimeData
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeProject = Join-Path $repoRoot "native-app"
$hbuilderCli = "G:\qiming-uniapp-native-tools\HBuilderX-5.07\HBuilderX\cli.exe"
$adb = "G:\qiming-uniapp-native-tools\android-sdk\platform-tools\adb.exe"
$androidBaseApk = "G:\qiming-uniapp-native-tools\HBuilderX-5.07\HBuilderX\plugins\launcher\base\android_base.apk"
$devicesScript = Join-Path $PSScriptRoot "native-devices.ps1"

function Require-File([string]$Path, [string]$Message) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw $Message
  }
}

function Get-AndroidDeviceLines {
  if (-not (Test-Path -LiteralPath $adb)) {
    throw "ADB not found: $adb"
  }
  $adbOutput = & $adb devices -l | Out-String
  return @(($adbOutput -split "`n") | Where-Object {
      $_ -match "\bdevice\b" -and $_ -notmatch "List of devices"
    })
}

function Assert-AndroidDevice([string]$RequestedDeviceId) {
  $deviceLines = Get-AndroidDeviceLines
  if ($deviceLines.Count -eq 0) {
    throw "No Android device attached. Connect a device or emulator, enable USB debugging, then rerun pnpm native:run:android."
  }
  if ($RequestedDeviceId) {
    $escapedDeviceId = [Regex]::Escape($RequestedDeviceId)
    $matched = $deviceLines | Where-Object { $_ -match "^$escapedDeviceId\s+" }
    if (-not $matched) {
      throw "Android device '$RequestedDeviceId' was not found. Run pnpm native:devices to list available devices."
    }
  }
  return $deviceLines.Count
}

function Get-AndroidDeviceId([string]$RequestedDeviceId) {
  $deviceLines = Get-AndroidDeviceLines
  if ($RequestedDeviceId) {
    return $RequestedDeviceId
  }
  $firstLine = $deviceLines | Select-Object -First 1
  return ($firstLine -split "\s+")[0]
}

function Grant-HBuilderPermissions([string]$ResolvedDeviceId) {
  $packageName = "io.dcloud.HBuilder"
  $permissions = @(
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.READ_PHONE_STATE",
    "android.permission.CALL_PHONE",
    "android.permission.PROCESS_OUTGOING_CALLS"
  )

  foreach ($permission in $permissions) {
    & $adb -s $ResolvedDeviceId shell pm grant $packageName $permission 2>$null
  }
  & $adb -s $ResolvedDeviceId shell appops set $packageName MANAGE_EXTERNAL_STORAGE allow 2>$null
}

function Get-HBuilderVersionName([string]$ResolvedDeviceId) {
  $packageName = "io.dcloud.HBuilder"
  $packageInfo = & $adb -s $ResolvedDeviceId shell dumpsys package $packageName 2>$null | Out-String
  if ($packageInfo -match "versionName=([^\s]+)") {
    return $Matches[1]
  }
  return ""
}

function Ensure-HBuilderBase([string]$ResolvedDeviceId) {
  Require-File $androidBaseApk "HBuilderX Android base APK not found: $androidBaseApk"
  $expectedVersion = "15.07"
  $installedVersion = Get-HBuilderVersionName $ResolvedDeviceId

  if ($installedVersion -eq $expectedVersion) {
    Write-Host "HBuilder Android base: $installedVersion"
    return
  }

  if ($installedVersion) {
    Write-Host "HBuilder Android base version is $installedVersion, reinstalling $expectedVersion..."
  } else {
    Write-Host "HBuilder Android base is not installed, installing $expectedVersion..."
  }
  & $adb -s $ResolvedDeviceId install -r -d $androidBaseApk
}

function Reset-HBuilderRuntime([string]$ResolvedDeviceId) {
  $packageName = "io.dcloud.HBuilder"
  & $adb -s $ResolvedDeviceId shell am force-stop $packageName 2>$null
  & $adb -s $ResolvedDeviceId shell pm clear $packageName 2>$null
}

Require-File $hbuilderCli "HBuilderX CLI not found: $hbuilderCli"
Require-File $nativeProject "native app project not found: $nativeProject"
Require-File $devicesScript "Native devices script not found: $devicesScript"

if ($Platform -eq "ios" -and $env:OS -eq "Windows_NT") {
  throw "iOS native launch is not available on this Windows host. Use macOS/HBuilderX iOS tooling for simulator or device launch."
}

if ($Platform -eq "android") {
  & $devicesScript -Platform android
  $androidDeviceCount = Assert-AndroidDevice $DeviceId
  Write-Host "Android device preflight: $androidDeviceCount device(s) available."
  $resolvedAndroidDeviceId = Get-AndroidDeviceId $DeviceId
}

if (-not $SkipPrepare) {
  Push-Location $repoRoot
  try {
    pnpm native:prepare
  } finally {
    Pop-Location
  }
}

if ($Platform -eq "android") {
  if (-not $SkipGrantPermissions) {
    Ensure-HBuilderBase $resolvedAndroidDeviceId
    if (-not $KeepRuntimeData) {
      Reset-HBuilderRuntime $resolvedAndroidDeviceId
    }
    Grant-HBuilderPermissions $resolvedAndroidDeviceId
  }

  $launchArgs = @(
    "launch",
    "app-android",
    "--project",
    $nativeProject,
    "--playground",
    "standard",
    "--cleanCache",
    "true",
    "--pagePath",
    "pages/index/index",
    "--pageQuery",
    "entry=$([Uri]::EscapeDataString($EntryPath))"
  )
  if ($DeviceId) {
    $launchArgs += @("--deviceId", $DeviceId)
  }
  if ($NativeLog) {
    $launchArgs += @("--native-log", "true")
  }
  & $hbuilderCli @launchArgs
} else {
  & $devicesScript -Platform ios-iPhone
  $launchArgs = @(
    "launch",
    "app-ios",
    "--project",
    $nativeProject,
    "--iosTarget",
    "device",
    "--playground",
    "standard",
    "--pagePath",
    "pages/index/index",
    "--pageQuery",
    "entry=$([Uri]::EscapeDataString($EntryPath))"
  )
  if ($DeviceId) {
    $launchArgs += @("--deviceId", $DeviceId)
  }
  & $hbuilderCli @launchArgs
}
