param(
  [ValidateSet("init", "check")]
  [string]$Mode = "check",
  [ValidateSet("android", "ios", "android,ios")]
  [string]$Platform = "android,ios",
  [switch]$Force,
  [switch]$Strict
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeProject = Join-Path $repoRoot "native-app"
$examplePath = Join-Path $nativeProject "pack-config.example.json"
$configPath = Join-Path $nativeProject "pack-config.local.json"
$manifestPath = Join-Path $nativeProject "src\manifest.json"

$results = New-Object System.Collections.Generic.List[object]

function Add-Result([string]$Name, [string]$Status, [string]$Detail) {
  $results.Add([pscustomobject]@{
    Name = $Name
    Status = $Status
    Detail = $Detail
  })
}

function Read-Json([string]$Path) {
  return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
}

function Test-MissingValue($Value) {
  if ($null -eq $Value) {
    return $true
  }
  $text = [string]$Value
  return [string]::IsNullOrWhiteSpace($text) -or $text -match "CHANGE_ME"
}

function Add-ValueCheck([string]$Name, $Value, [string]$OkDetail, [string]$WarnDetail) {
  if (Test-MissingValue $Value) {
    Add-Result $Name "WARN" $WarnDetail
  } else {
    Add-Result $Name "OK" $OkDetail
  }
}

function Add-FileCheck([string]$Name, $Path, [string]$MissingDetail) {
  if (Test-MissingValue $Path) {
    Add-Result $Name "WARN" $MissingDetail
    return
  }
  if (Test-Path -LiteralPath ([string]$Path)) {
    Add-Result $Name "OK" ([string]$Path)
  } else {
    Add-Result $Name "WARN" "file not found: $Path"
  }
}

function Get-PlatformList([string]$Value) {
  return $Value.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

if ($Mode -eq "init") {
  if (-not (Test-Path -LiteralPath $examplePath)) {
    throw "Missing example pack config: $examplePath"
  }

  if ((Test-Path -LiteralPath $configPath) -and -not $Force) {
    Write-Host "Local pack config already exists: $configPath"
  } else {
    Copy-Item -LiteralPath $examplePath -Destination $configPath -Force:$Force
    Write-Host "Created local pack config: $configPath"
  }
}

if (-not (Test-Path -LiteralPath $configPath)) {
  Add-Result "pack config file" "WARN" "missing; run pnpm native:pack:init"
  $results | Format-Table -AutoSize -Wrap
  Write-Host ""
  Write-Host "Pack config summary: 0 OK, 1 WARN, 0 FAIL"
  if ($Strict) {
    exit 1
  }
  exit 0
}

Add-Result "pack config file" "OK" $configPath

try {
  $config = Read-Json $configPath
} catch {
  Add-Result "pack config JSON" "FAIL" $_.Exception.Message
}

try {
  $manifest = Read-Json $manifestPath
} catch {
  Add-Result "manifest JSON" "FAIL" $_.Exception.Message
}

if ($config) {
  Add-Result "pack config JSON" "OK" "valid JSON"
}

if ($manifest) {
  $appid = [string]$manifest.appid
  if ((Test-MissingValue $appid) -or $appid -eq "__UNI__QIMING" -or $appid -notmatch "^__UNI__") {
    Add-Result "DCloud AppID" "WARN" "replace manifest appid with a registered DCloud __UNI__ appid"
  } else {
    Add-Result "DCloud AppID" "OK" $appid
  }
}

if ($config -and $manifest) {
  $platforms = Get-PlatformList $Platform

  if ($platforms -contains "android") {
    $android = $config.android
    $manifestAndroid = $manifest."app-plus".distribute.android
    if ($null -eq $android) {
      Add-Result "android config" "FAIL" "missing android config block"
    } else {
      $packageName = [string]$android.packagename
      Add-ValueCheck "android package" $packageName $packageName "android.packagename is required"

      $manifestPackage = [string]$manifestAndroid.packagename
      if (-not (Test-MissingValue $packageName) -and -not (Test-MissingValue $manifestPackage)) {
        if ($packageName -eq $manifestPackage) {
          Add-Result "android package match" "OK" $manifestPackage
        } else {
          Add-Result "android package match" "WARN" "config $packageName differs from manifest $manifestPackage"
        }
      }

      if ([int]$android.androidpacktype -eq 0) {
        Add-Result "android cert mode" "OK" "own certificate"
      } else {
        Add-Result "android cert mode" "WARN" "expected androidpacktype 0 for own release certificate"
      }

      Add-FileCheck "android certfile" $android.certfile "android.certfile is required"
      Add-ValueCheck "android certalias" $android.certalias ([string]$android.certalias) "android.certalias is required"

      if ((Test-MissingValue $android.certpassword) -or (Test-MissingValue $android.storepassword)) {
        Add-Result "android passwords" "WARN" "android certpassword/storepassword are missing or placeholders"
      } else {
        Add-Result "android passwords" "OK" "configured"
      }
    }
  }

  if ($platforms -contains "ios") {
    $ios = $config.ios
    $manifestIos = $manifest."app-plus".distribute.ios
    if ($null -eq $ios) {
      Add-Result "ios config" "FAIL" "missing ios config block"
    } else {
      $bundle = [string]$ios.bundle
      Add-ValueCheck "ios bundle" $bundle $bundle "ios.bundle is required"

      $manifestBundle = [string]$manifestIos.bundleIdentifier
      if (-not (Test-MissingValue $bundle) -and -not (Test-MissingValue $manifestBundle)) {
        if ($bundle -eq $manifestBundle) {
          Add-Result "ios bundle match" "OK" $manifestBundle
        } else {
          Add-Result "ios bundle match" "WARN" "config $bundle differs from manifest $manifestBundle"
        }
      }

      Add-FileCheck "ios profile" $ios.profile "ios.profile .mobileprovision path is required"
      Add-FileCheck "ios certfile" $ios.certfile "ios.certfile .p12 path is required"
      Add-ValueCheck "ios certpassword" $ios.certpassword "configured" "ios.certpassword is missing or placeholder"
    }
  }
}

$results | Format-Table -AutoSize -Wrap

$okCount = ($results | Where-Object { $_.Status -eq "OK" }).Count
$warnCount = ($results | Where-Object { $_.Status -eq "WARN" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
Write-Host ""
Write-Host "Pack config summary: $okCount OK, $warnCount WARN, $failCount FAIL"

if ($failCount -gt 0 -or ($Strict -and $warnCount -gt 0)) {
  exit 1
}
