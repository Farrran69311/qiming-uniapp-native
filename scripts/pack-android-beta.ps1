param(
  [string]$VersionCode,
  [string]$VersionName,
  [switch]$SkipPrepare,
  [switch]$SkipAppBuild,
  [switch]$Install,
  [string]$DeviceId = "",
  [switch]$ForceReinstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeProject = Join-Path $repoRoot "native-app"
$artifactsDir = Join-Path $repoRoot "artifacts"
$hbuilderBaseApk = "G:\qiming-uniapp-native-tools\HBuilderX-5.07\HBuilderX\plugins\launcher\base\android_base.apk"
$zipalign = "G:\qiming-uniapp-native-tools\android-sdk\build-tools\35.0.0\zipalign.exe"
$apksigner = "G:\qiming-uniapp-native-tools\android-sdk\build-tools\35.0.0\apksigner.bat"
$adb = "G:\qiming-uniapp-native-tools\android-sdk\platform-tools\adb.exe"
$keytool = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\bin\keytool.exe"

function Require-File([string]$Path, [string]$Message) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw $Message
  }
}

function Normalize-ZipEntryName([string]$Name) {
  return ($Name -replace "\\", "/").TrimStart("/")
}

function Add-FileToZip(
  [System.IO.Compression.ZipArchive]$Zip,
  [string]$FilePath,
  [string]$EntryName
) {
  $normalized = Normalize-ZipEntryName $EntryName
  $entry = $Zip.CreateEntry(
    $normalized,
    [System.IO.Compression.CompressionLevel]::Optimal
  )
  $entry.LastWriteTime = [DateTimeOffset](Get-Item -LiteralPath $FilePath).LastWriteTime
  $inputStream = [System.IO.File]::OpenRead($FilePath)
  try {
    $outputStream = $entry.Open()
    try {
      $inputStream.CopyTo($outputStream)
    } finally {
      $outputStream.Dispose()
    }
  } finally {
    $inputStream.Dispose()
  }
}

function Get-DefaultVersionCode() {
  return Get-Date -Format "yyyyMMddHHmm"
}

function Get-FirstAndroidDevice() {
  Require-File $adb "ADB not found: $adb"
  $devices = & $adb devices |
    Select-String -Pattern "^\S+\s+device$" |
    ForEach-Object { ($_ -split "\s+")[0] }
  return $devices | Select-Object -First 1
}

Require-File $hbuilderBaseApk "HBuilderX Android base APK not found: $hbuilderBaseApk"
Require-File $zipalign "zipalign not found: $zipalign"
Require-File $apksigner "apksigner not found: $apksigner"
Require-File $keytool "keytool not found: $keytool"

if (-not $VersionCode) {
  $VersionCode = Get-DefaultVersionCode
}
if (-not $VersionName) {
  $VersionName = "1.0.0-beta.$VersionCode"
}

New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null

if (-not $SkipPrepare) {
  Push-Location $repoRoot
  try {
    pnpm native:prepare
  } finally {
    Pop-Location
  }
}

if (-not $SkipAppBuild) {
  Push-Location $nativeProject
  try {
    pnpm build:app
  } finally {
    Pop-Location
  }
}

$appBuildDir = Join-Path $nativeProject "dist\build\app"
$h5BuildDir = Join-Path $appBuildDir "hybrid\html"
Require-File (Join-Path $appBuildDir "manifest.json") "uni-app build manifest missing. Run this script without -SkipAppBuild."
Require-File (Join-Path $h5BuildDir "index.html") "H5 index.html missing. Run this script without -SkipPrepare."

$stagingWww = Join-Path $artifactsDir "apk-staging-current\www"
if (Test-Path -LiteralPath $stagingWww) {
  Remove-Item -LiteralPath $stagingWww -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingWww -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $appBuildDir "hybrid") -Destination (Join-Path $stagingWww "hybrid") -Recurse -Force

$logo = Join-Path $h5BuildDir "logo.svg"
if (Test-Path -LiteralPath $logo) {
  Copy-Item -LiteralPath $logo -Destination (Join-Path $stagingWww "logo.svg") -Force
}

$icon = Join-Path $h5BuildDir "icons\app-192.png"
if (Test-Path -LiteralPath $icon) {
  Copy-Item -LiteralPath $icon -Destination (Join-Path $stagingWww "icon.png") -Force
}

$launchPath = "hybrid/html/index.html?v=$VersionCode#/home?qimingNative=1"
$runtimeManifest = [ordered]@{
  id = "HBuilder"
  name = "启明智教"
  version = [ordered]@{
    name = $VersionName
    code = $VersionCode
  }
  description = "启明智教 Android 11 v1.0 beta"
  icons = [ordered]@{
    "72" = "icon.png"
  }
  launch_path = $launchPath
  developer = [ordered]@{
    name = "Intelledu"
    email = ""
    url = ""
  }
  orientation = @("portrait-primary", "portrait-secondary")
  permissions = [ordered]@{
    Camera = @{}
    File = @{}
    Share = @{}
    Webview = @{}
    Runtime = @{}
    NativeUI = @{}
    Navigator = @{}
    XMLHttpRequest = @{}
    Gallery = @{}
    Uploader = @{}
    Barcode = @{}
    UniNView = @{}
  }
  plus = [ordered]@{
    splashscreen = [ordered]@{
      autoclose = $true
      waiting = $true
    }
    statusbar = [ordered]@{
      immersed = "supportedDevice"
      style = "dark"
      background = "#F7F8FC"
    }
    runmode = "liberate"
  }
}

$runtimeManifest |
  ConvertTo-Json -Depth 8 -Compress |
  Set-Content -LiteralPath (Join-Path $stagingWww "manifest.json") -Encoding UTF8

$unsignedApk = Join-Path $artifactsDir "qiming-android11-v1.0-beta-$VersionCode-unsigned.apk"
$alignedApk = Join-Path $artifactsDir "qiming-android11-v1.0-beta-$VersionCode-aligned.apk"
$signedApk = Join-Path $artifactsDir "qiming-android11-v1.0-beta-$VersionCode.apk"
$latestApk = Join-Path $artifactsDir "qiming-android11-v1.0-beta.apk"

foreach ($path in @($unsignedApk, $alignedApk, $signedApk, "$signedApk.idsig")) {
  Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$sourceZip = [System.IO.Compression.ZipFile]::OpenRead($hbuilderBaseApk)
try {
  $destStream = [System.IO.File]::Open($unsignedApk, [System.IO.FileMode]::CreateNew)
  try {
    $destZip = [System.IO.Compression.ZipArchive]::new(
      $destStream,
      [System.IO.Compression.ZipArchiveMode]::Create
    )
    try {
      foreach ($entry in $sourceZip.Entries) {
        $name = Normalize-ZipEntryName $entry.FullName
        if ([string]::IsNullOrEmpty($name)) {
          continue
        }
        if ($name.StartsWith("META-INF/", [System.StringComparison]::OrdinalIgnoreCase)) {
          continue
        }
        if ($name.StartsWith("assets/apps/HBuilder/www/", [System.StringComparison]::Ordinal)) {
          continue
        }
        if ($name -eq "assets/apps/HBuilder/www") {
          continue
        }

        $newEntry = $destZip.CreateEntry(
          $name,
          [System.IO.Compression.CompressionLevel]::Optimal
        )
        $newEntry.LastWriteTime = $entry.LastWriteTime
        if ($entry.Length -gt 0 -or -not $name.EndsWith("/")) {
          $inputStream = $entry.Open()
          try {
            $outputStream = $newEntry.Open()
            try {
              $inputStream.CopyTo($outputStream)
            } finally {
              $outputStream.Dispose()
            }
          } finally {
            $inputStream.Dispose()
          }
        }
      }

      foreach ($file in Get-ChildItem -LiteralPath $stagingWww -File -Recurse) {
        $relative = $file.FullName.Substring($stagingWww.Length).TrimStart("\", "/")
        $entryName = "assets/apps/HBuilder/www/" + (($relative -replace "\\", "/"))
        Add-FileToZip $destZip $file.FullName $entryName
      }
    } finally {
      $destZip.Dispose()
    }
  } finally {
    $destStream.Dispose()
  }
} finally {
  $sourceZip.Dispose()
}

& $zipalign -f -p 4 $unsignedApk $alignedApk
if ($LASTEXITCODE -ne 0) {
  throw "zipalign failed with exit code $LASTEXITCODE"
}

$keystore = Join-Path $artifactsDir "qiming-android11-beta-local.keystore"
$alias = "qiming-android11-beta-local"
$storePass = "android"
$keyPass = "android"
if (-not (Test-Path -LiteralPath $keystore)) {
  & $keytool -genkeypair -v `
    -keystore $keystore `
    -storepass $storePass `
    -keypass $keyPass `
    -alias $alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 3650 `
    -dname "CN=Qiming Android 11 Beta Local, O=Intelledu, L=Changchun, ST=Jilin, C=CN" |
    Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "keytool failed with exit code $LASTEXITCODE"
  }
}

& $apksigner sign `
  --ks $keystore `
  --ks-key-alias $alias `
  --ks-pass "pass:$storePass" `
  --key-pass "pass:$keyPass" `
  --out $signedApk `
  $alignedApk
if ($LASTEXITCODE -ne 0) {
  throw "apksigner sign failed with exit code $LASTEXITCODE"
}

& $apksigner verify --verbose --print-certs $signedApk
if ($LASTEXITCODE -ne 0) {
  throw "apksigner verify failed with exit code $LASTEXITCODE"
}

Copy-Item -LiteralPath $signedApk -Destination $latestApk -Force
if (Test-Path -LiteralPath "$signedApk.idsig") {
  Copy-Item -LiteralPath "$signedApk.idsig" -Destination "$latestApk.idsig" -Force
}

$zipCheck = [System.IO.Compression.ZipFile]::OpenRead($latestApk)
try {
  $requiredEntries = @(
    "assets/apps/HBuilder/www/manifest.json",
    "assets/apps/HBuilder/www/hybrid/html/index.html",
    "assets/apps/HBuilder/www/hybrid/html/version.json"
  )
  foreach ($entryName in $requiredEntries) {
    if (-not $zipCheck.GetEntry($entryName)) {
      throw "APK missing required entry: $entryName"
    }
  }
  $badEntry = $zipCheck.Entries |
    Where-Object {
      $_.FullName.StartsWith("assets/apps/HBuilder/www/", [System.StringComparison]::Ordinal) -and
      $_.FullName.Contains("\")
    } |
    Select-Object -First 1
  if ($badEntry) {
    throw "APK contains Windows path separator in entry: $($badEntry.FullName)"
  }
} finally {
  $zipCheck.Dispose()
}

$sha256 = (Get-FileHash -LiteralPath $latestApk -Algorithm SHA256).Hash
$apkItem = Get-Item -LiteralPath $latestApk

if ($Install) {
  $targetDevice = if ($DeviceId) { $DeviceId } else { Get-FirstAndroidDevice }
  if (-not $targetDevice) {
    throw "No Android device found for install."
  }
  if ($ForceReinstall) {
    & $adb -s $targetDevice shell am force-stop io.dcloud.HBuilder | Out-Null
    & $adb -s $targetDevice uninstall io.dcloud.HBuilder | Out-Null
  }
  $installOutput = & $adb -s $targetDevice install -r -d $latestApk 2>&1
  $installText = $installOutput | Out-String
  if ($LASTEXITCODE -ne 0) {
    if ($ForceReinstall -and $installText -match "INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match|incompatible") {
      & $adb -s $targetDevice uninstall io.dcloud.HBuilder | Out-Null
      & $adb -s $targetDevice install -r -d $latestApk
      if ($LASTEXITCODE -ne 0) {
        throw "ADB reinstall failed with exit code $LASTEXITCODE"
      }
    } else {
      Write-Host $installText
      throw "ADB install failed with exit code $LASTEXITCODE"
    }
  }
}

[pscustomobject]@{
  Apk = $latestApk
  VersionName = $VersionName
  VersionCode = $VersionCode
  LaunchPath = $launchPath
  SizeMB = [Math]::Round($apkItem.Length / 1MB, 2)
  SHA256 = $sha256
} | Format-List
