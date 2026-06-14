param(
  [string]$VersionCode,
  [string]$VersionName,
  [switch]$SkipPrepare,
  [switch]$SkipAppBuild,
  [switch]$Install,
  [string]$DeviceId = "",
  [switch]$ForceReinstall,
  [switch]$KeepRuntimeData
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
$desktopLogo = "C:\Users\farde\Desktop\logo.png"
$androidPackageName = "cn.intelledu.qiming"

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

function Write-IntellEduLauncherIcon([string]$SourceLogo, [string]$OutputPath, [int]$Size) {
  Add-Type -AssemblyName System.Drawing
  $source = [System.Drawing.Image]::FromFile($SourceLogo)
  try {
    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
        try {
          $graphics.FillRectangle($brush, 0, 0, $Size, $Size)
        } finally {
          $brush.Dispose()
        }

        $padding = [Math]::Max(3, [int]($Size * 0.08))
        $scale = [Math]::Min(
          ($Size - 2 * $padding) / $source.Width,
          ($Size - 2 * $padding) / $source.Height
        )
        $drawWidth = [int]($source.Width * $scale)
        $drawHeight = [int]($source.Height * $scale)
        $x = [int](($Size - $drawWidth) / 2)
        $y = [int](($Size - $drawHeight) / 2)
        $graphics.DrawImage($source, $x, $y, $drawWidth, $drawHeight)
      } finally {
        $graphics.Dispose()
      }
      $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

function Patch-AndroidLabelResource([byte[]]$Bytes) {
  $labelFrom = "HBuilder"
  $labelTo = "IntellEdu"
  $oldBytes = [System.Text.Encoding]::UTF8.GetBytes($labelFrom)
  $newBytes = [System.Text.Encoding]::UTF8.GetBytes($labelTo)
  $delta = $newBytes.Length - $oldBytes.Length
  if ($delta -lt 0) {
    throw "Android label patch only supports equal-or-longer labels."
  }

  $rootSize = [BitConverter]::ToUInt32($Bytes, 4)
  $globalStringPoolOffset = 12
  $stringPoolType = [BitConverter]::ToUInt16($Bytes, $globalStringPoolOffset)
  $stringPoolHeaderSize = [BitConverter]::ToUInt16(
    $Bytes,
    $globalStringPoolOffset + 2
  )
  $stringPoolSize = [BitConverter]::ToUInt32(
    $Bytes,
    $globalStringPoolOffset + 4
  )
  $stringCount = [BitConverter]::ToUInt32($Bytes, $globalStringPoolOffset + 8)
  $flags = [BitConverter]::ToUInt32($Bytes, $globalStringPoolOffset + 16)
  $stringsStart = [BitConverter]::ToUInt32($Bytes, $globalStringPoolOffset + 20)
  $stylesStart = [BitConverter]::ToUInt32($Bytes, $globalStringPoolOffset + 24)

  if ($stringPoolType -ne 0x0001 -or (($flags -band 0x100) -eq 0)) {
    throw "Android label patch expected UTF-8 global string pool."
  }

  function Read-Utf8Length([byte[]]$Data, [int]$Offset) {
    $first = $Data[$Offset]
    if (($first -band 0x80) -ne 0) {
      return @{
        Length = ((($first -band 0x7f) -shl 8) -bor $Data[$Offset + 1])
        Bytes = 2
      }
    }
    return @{ Length = $first; Bytes = 1 }
  }

  $targetIndex = -1
  $targetOffset = 0
  $targetPos = 0
  $targetContentStart = 0
  $targetByteLength = 0

  for ($index = 0; $index -lt $stringCount; $index++) {
    $offsetTablePos = $globalStringPoolOffset + $stringPoolHeaderSize + $index * 4
    $entryOffset = [BitConverter]::ToUInt32($Bytes, $offsetTablePos)
    $pos = $globalStringPoolOffset + $stringsStart + $entryOffset
    $charLen = Read-Utf8Length $Bytes $pos
    $byteLen = Read-Utf8Length $Bytes ($pos + $charLen.Bytes)
    $contentStart = $pos + $charLen.Bytes + $byteLen.Bytes
    $value = [System.Text.Encoding]::UTF8.GetString(
      $Bytes,
      $contentStart,
      $byteLen.Length
    )
    if ($value -eq $labelFrom) {
      $targetIndex = $index
      $targetOffset = $entryOffset
      $targetPos = $pos
      $targetContentStart = $contentStart
      $targetByteLength = $byteLen.Length
      break
    }
  }

  if ($targetIndex -lt 0) {
    throw "Android label patch could not find '$labelFrom' in resources.arsc."
  }

  $lengthByteCount =
    ($targetContentStart - $targetPos) / 2
  if ($lengthByteCount -ne 1) {
    throw "Android label patch expected one-byte UTF-8 string lengths."
  }

  $replacementEnd = $targetContentStart + $targetByteLength
  $globalStringPoolEnd = $globalStringPoolOffset + $stringPoolSize
  $stylesAbsoluteStart = if ($stylesStart -gt 0) {
    $globalStringPoolOffset + $stylesStart
  } else {
    $globalStringPoolEnd
  }
  $padding = (4 - ($delta % 4)) % 4
  $sizeIncrease = $delta + $padding
  $patched = [byte[]]::new($Bytes.Length + $sizeIncrease)

  [Buffer]::BlockCopy($Bytes, 0, $patched, 0, $targetContentStart)
  [Buffer]::BlockCopy($newBytes, 0, $patched, $targetContentStart, $newBytes.Length)
  [Buffer]::BlockCopy(
    $Bytes,
    $replacementEnd,
    $patched,
    $targetContentStart + $newBytes.Length,
    $stylesAbsoluteStart - $replacementEnd
  )
  if ($padding -gt 0) {
    [Array]::Clear(
      $patched,
      $stylesAbsoluteStart + $delta,
      $padding
    )
  }
  [Buffer]::BlockCopy(
    $Bytes,
    $stylesAbsoluteStart,
    $patched,
    $stylesAbsoluteStart + $sizeIncrease,
    $globalStringPoolEnd - $stylesAbsoluteStart
  )
  [Buffer]::BlockCopy(
    $Bytes,
    $globalStringPoolEnd,
    $patched,
    $globalStringPoolEnd + $sizeIncrease,
    $Bytes.Length - $globalStringPoolEnd
  )

  $patched[$targetPos] = [byte]$labelTo.Length
  $patched[$targetPos + 1] = [byte]$newBytes.Length

  for ($index = $targetIndex + 1; $index -lt $stringCount; $index++) {
    $offsetTablePos = $globalStringPoolOffset + $stringPoolHeaderSize + $index * 4
    $entryOffset = [BitConverter]::ToUInt32($patched, $offsetTablePos)
    [BitConverter]::GetBytes([uint32]($entryOffset + $delta)).CopyTo(
      $patched,
      $offsetTablePos
    )
  }

  [BitConverter]::GetBytes([uint32]($rootSize + $sizeIncrease)).CopyTo(
    $patched,
    4
  )
  [BitConverter]::GetBytes([uint32]($stringPoolSize + $sizeIncrease)).CopyTo(
    $patched,
    $globalStringPoolOffset + 4
  )
  if ($stylesStart -gt 0) {
    [BitConverter]::GetBytes([uint32]($stylesStart + $sizeIncrease)).CopyTo(
      $patched,
      $globalStringPoolOffset + 24
    )
  }

  return $patched
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

function ConvertFrom-Utf8Base64([string]$Value) {
  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

Require-File $hbuilderBaseApk "HBuilderX Android base APK not found: $hbuilderBaseApk"
Require-File $zipalign "zipalign not found: $zipalign"
Require-File $apksigner "apksigner not found: $apksigner"
Require-File $keytool "keytool not found: $keytool"
Require-File $desktopLogo "Desktop app logo not found: $desktopLogo"

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
$stagingNative = Join-Path $artifactsDir "apk-staging-current\native"
if (Test-Path -LiteralPath $stagingNative) {
  Remove-Item -LiteralPath $stagingNative -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingNative -Force | Out-Null

$launcherIconMap = @{
  "res/2H.png" = 48
  "res/yj.png" = 48
  "res/8p.png" = 72
  "res/9X.png" = 96
  "res/-t.png" = 144
  "res/2c.png" = 192
}
$launcherIconFiles = @{}
foreach ($entryName in $launcherIconMap.Keys) {
  $iconPath = Join-Path $stagingNative (($entryName -replace "[/\\]", "_"))
  Write-IntellEduLauncherIcon $desktopLogo $iconPath $launcherIconMap[$entryName]
  $launcherIconFiles[$entryName] = $iconPath
}

foreach ($item in Get-ChildItem -LiteralPath $appBuildDir -Force) {
  Copy-Item -LiteralPath $item.FullName -Destination $stagingWww -Recurse -Force
}

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
  name = "IntellEdu"
  version = [ordered]@{
    name = $VersionName
    code = $VersionCode
  }
  description = "IntellEdu Android 11 v1.0 beta"
  icons = [ordered]@{
    "72" = "icon.png"
  }
  launch_path = $launchPath
  developer = [ordered]@{
    name = "IntellEdu"
    email = ""
    url = ""
  }
  orientation = @("portrait-primary", "portrait-secondary")
  permissions = [ordered]@{
    Barcode = @{}
    Camera = @{}
    File = @{}
    Gallery = @{}
    NativeUI = @{}
    Navigator = @{}
    Runtime = @{}
    Uploader = @{}
    Webview = @{}
    XMLHttpRequest = @{}
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

        if ($name -eq "AndroidManifest.xml") {
          $sourceManifestPath = Join-Path $stagingNative "AndroidManifest.source.xml"
          $patchedManifestPath = Join-Path $stagingNative "AndroidManifest.patched.xml"
          $inputStream = $entry.Open()
          try {
            $fileStream = [System.IO.File]::Open(
              $sourceManifestPath,
              [System.IO.FileMode]::Create,
              [System.IO.FileAccess]::Write
            )
            try {
              $inputStream.CopyTo($fileStream)
            } finally {
              $fileStream.Dispose()
            }
          } finally {
            $inputStream.Dispose()
          }

          node (Join-Path $repoRoot "scripts\strip-android-permissions.mjs") `
            $sourceManifestPath `
            $patchedManifestPath `
            $androidPackageName `
            $VersionCode `
            $VersionName
          if ($LASTEXITCODE -ne 0) {
            throw "AndroidManifest permission stripping failed with exit code $LASTEXITCODE"
          }
          Add-FileToZip $destZip $patchedManifestPath $name
          continue
        }

        if ($launcherIconFiles.ContainsKey($name)) {
          Add-FileToZip $destZip $launcherIconFiles[$name] $name
          continue
        }

        if ($name -eq "resources.arsc") {
          $newEntry = $destZip.CreateEntry(
            $name,
            [System.IO.Compression.CompressionLevel]::Optimal
          )
          $newEntry.LastWriteTime = $entry.LastWriteTime
          $inputStream = $entry.Open()
          try {
            $memoryStream = [System.IO.MemoryStream]::new()
            try {
              $inputStream.CopyTo($memoryStream)
              $patchedBytes = Patch-AndroidLabelResource $memoryStream.ToArray()
            } finally {
              $memoryStream.Dispose()
            }
            $outputStream = $newEntry.Open()
            try {
              $outputStream.Write($patchedBytes, 0, $patchedBytes.Length)
            } finally {
              $outputStream.Dispose()
            }
          } finally {
            $inputStream.Dispose()
          }
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
    -dname "CN=IntellEdu Android 11 Beta Local, O=IntellEdu, L=Changchun, ST=Jilin, C=CN" |
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
    & $adb -s $targetDevice shell am force-stop $androidPackageName | Out-Null
    & $adb -s $targetDevice uninstall $androidPackageName | Out-Null
  }
  $installOutput = & $adb -s $targetDevice install -r -d $latestApk 2>&1
  $installText = $installOutput | Out-String
  if ($LASTEXITCODE -ne 0) {
    if ($ForceReinstall -and $installText -match "INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match|incompatible") {
      & $adb -s $targetDevice uninstall $androidPackageName | Out-Null
      & $adb -s $targetDevice install -r -d $latestApk
      if ($LASTEXITCODE -ne 0) {
        throw "ADB reinstall failed with exit code $LASTEXITCODE"
      }
    } else {
      Write-Host $installText
      throw "ADB install failed with exit code $LASTEXITCODE"
    }
  }
  if (-not $KeepRuntimeData) {
    & $adb -s $targetDevice shell am force-stop $androidPackageName | Out-Null
    $clearOutput = & $adb -s $targetDevice shell pm clear $androidPackageName 2>&1
    $clearText = ($clearOutput | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $clearText -notmatch "Success") {
      Write-Host $clearText
      throw "ADB pm clear failed; stale IntellEdu app resources may remain on device."
    }
    Write-Host "Cleared IntellEdu runtime data so this install loads bundled version $VersionCode resources."
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
