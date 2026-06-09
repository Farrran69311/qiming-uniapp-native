# Uni-App Native App Plan

This repo is an isolated G drive copy of the current web project. All native
app work lives here and does not touch the original desktop workspace.

Public repository:

```text
https://github.com/Farrran69311/qiming-uniapp-native
```

## Current Strategy

The first production path is a uni-app App shell plus the existing H5 build in
a local `web-view`.

Reasons:

- The current app depends on Vue 3, Vite, Element Plus, Three.js/VRM, PDF/Office
  preview, rich text, charts, and desktop admin layouts.
- A full native rewrite with uni components would be slower and riskier.
- `web-view` supports local HTML on App, which lets Android/iOS packages run the
  existing product while we gradually add native bridges.

The source baseline is the original `origin/agent` branch of
`Sorkai/vue-pure-admin-max`. The original desktop workspace is not modified;
this public repository is a clean G drive snapshot with native packaging layers
added on top.

Official reference points:

- `web-view` supports local sources on App and can receive `uni.postMessage`
  data from the embedded page.
- CLI can build App resources with `uni build -p app`.
- APK/IPA packaging needs HBuilderX cloud/local packaging.

## Directory Layout

- Repo root: existing Vue/Vite H5 source.
- `native-app`: uni-app shell project.
- `native-app/src/hybrid/html`: generated local H5 payload, created by
  `pnpm native:prepare`.
- `scripts/sync-app-h5.mjs`: copies `dist` into the uni-app shell and injects
  the lightweight native bridge.

## Commands

Install dependencies:

```powershell
pnpm install
pnpm --dir native-app install
```

Local tools prepared on this machine:

- HBuilderX: `G:\qiming-uniapp-native-tools\HBuilderX-5.07\HBuilderX\HBuilderX.exe`
- HBuilderX CLI: `G:\qiming-uniapp-native-tools\HBuilderX-5.07\HBuilderX\cli.exe`
- ADB: `G:\qiming-uniapp-native-tools\android-sdk\platform-tools\adb.exe`
- Java: `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\bin\java.exe`
- Android release keystore:
  `G:\qiming-uniapp-native-tools\certs\qiming-android-release.keystore`

Build and sync local H5 into the App shell:

```powershell
pnpm native:prepare
```

Build uni-app App resources:

```powershell
pnpm --dir native-app build:app
```

Open the HBuilderX project:

```powershell
& "G:\qiming-uniapp-native-tools\HBuilderX-5.07\HBuilderX\cli.exe" open --project "G:\qiming-uniapp-native-public\native-app"
```

Convenience commands:

```powershell
pnpm native:build:android
pnpm native:build:ios
pnpm native:pack:android
pnpm native:pack:ios
pnpm native:pack:all
pnpm native:pack:init
pnpm native:pack:check
pnpm native:doctor
```

The Android/iOS convenience commands currently generate uni-app App resources.
The `native:pack:*` commands call HBuilderX cloud packaging through
`scripts/pack-native.ps1`. Final APK/IPA packaging still requires HBuilderX
DCloud login and local certificate configuration.

Run `pnpm native:doctor` before packaging. It checks the public repo state, the
local `origin/agent` source commit, preview ports, HBuilderX CLI, Java, ADB,
Android keystore, local pack config, iOS certificate files, and generated App
resources. Missing optional packaging inputs are reported as `WARN`; missing
required local tools are reported as `FAIL`.

Run `pnpm native:pack:init` once to create the ignored local
`native-app/pack-config.local.json` skeleton from the public example. Then run
`pnpm native:pack:check` before `native:pack:*`; it strictly validates the
registered DCloud AppID, Android package/certificate fields, iOS bundle/profile/
p12 fields, and manifest/config package consistency.

Cloud packaging config:

- Copy `native-app/pack-config.example.json` to
  `native-app/pack-config.local.json`.
- Fill Android keystore passwords and iOS certificate paths locally.
- Instead of writing certificate passwords into `pack-config.local.json`, set
  `QIMING_ANDROID_CERT_PASSWORD`, `QIMING_ANDROID_STORE_PASSWORD`, and
  `QIMING_IOS_CERT_PASSWORD` in the current PowerShell session. `pack-native`
  writes those values only to an ignored temporary config and deletes it after
  the HBuilderX call.
- Replace `native-app/src/manifest.json` `appid` with the registered DCloud
  AppID before cloud packaging. The current `__UNI__QIMING` value is only a
  local placeholder.
- `pack-config.local.json`, keystores, `.p12`, and `.mobileprovision` files are
  ignored by Git.
- Without `pack-config.local.json`, `scripts/pack-native.ps1` exits early with a
  clear setup error instead of attempting packaging.

Live browser prototype while developing:

```powershell
pnpm native:preview
```

Manual equivalent:

```powershell
pnpm dev -- --host 0.0.0.0 --port 8849
pnpm --dir native-app dev:h5 -- --host 0.0.0.0 --port 8861
```

Current preview URLs:

- Teacher: `http://localhost:8861/?demoRole=teacher`
- Student: `http://localhost:8861/?demoRole=student`
- Admin: `http://localhost:8861/?demoRole=admin`

The `demoRole` switch is development-only. It exists so the native shell can be
reviewed live in a browser while code changes hot-reload. Android/iOS packaged
apps still use the normal login flow.

The H5 preview shell also renders a small bottom-right role switcher for
student/teacher/admin review. This switcher is wrapped in H5-only conditional
compilation and is not included in the APP-PLUS build.

By default, the preview shell renders the app inside a 393 x 852 phone canvas so
mobile layout issues are visible while developing. The bottom-right "full
screen" toggle switches back to full browser width when wider layout inspection
is needed.

## Android Packaging Checklist

1. Install HBuilderX and sign in to a DCloud account.
2. Register or replace the placeholder appid in `native-app/src/manifest.json`.
3. Create an Android keystore.
4. Open `native-app` in HBuilderX.
5. Run发行 -> 原生App-云打包.
6. Use package name `cn.intelledu.qiming`.
7. Verify on a physical Android device:
   - login
   - AI streaming
   - student/teacher/admin AI app pages
   - 2D floating digital human
   - file/resource preview
   - back button and network loss state

## iOS Packaging Checklist

1. Apple Developer Program account is required.
2. Prepare Bundle ID `cn.intelledu.qiming`.
3. Prepare iOS distribution certificate `.p12`.
4. Prepare matching provisioning profile `.mobileprovision`.
5. Configure iOS privacy strings in `native-app/src/manifest.json`.
6. Use HBuilderX cloud packaging to create IPA.
7. Upload through Transporter/App Store Connect/TestFlight.
8. Verify on a real iPhone and iPad:
   - safe area
   - keyboard input and streaming chat
   - media permissions
   - web-view cache behavior
   - App Store review risk for WebView-only shell

## Native Bridge

`pnpm native:prepare` injects:

- `uni.webview.1.5.8.js`
- `qiming-native-bridge.js`

The H5 page can call:

```js
window.QimingNativeBridge?.post({
  source: "qiming-h5",
  type: "custom-event"
});
```

The uni-app shell receives messages through the `web-view` `message` event.

## Known Blockers

- The public GitHub repo has been created and pushed from a clean root commit.
- Java, ADB, and HBuilderX are now installed/prepared locally, but no Android
  device was connected during verification.
- HBuilderX CLI publish/cloud packaging currently reports "this feature needs
  login". A DCloud account login is required before APK/IPA cloud packaging can
  run.
- GitHub Actions no longer contains the CNB sync workflow; only the existing
  lint/pages workflows remain.
- iOS IPA packaging cannot be fully finished without Apple certificates.

## Verification Log

2026-06-09:

- `pnpm exec vue-tsc --noEmit --skipLibCheck` passed for the copied H5 app.
- `pnpm native:prepare` passed and generated `native-app/src/hybrid/html`.
- `pnpm --dir native-app type-check` passed.
- `pnpm --dir native-app build:app` passed and generated
  `native-app/dist/build/app`.
- Generated App resources include:
  - `hybrid/html/index.html`
  - `hybrid/html/qiming-native-bridge.js`
  - `hybrid/html/uni.webview.1.5.8.js`
- HBuilderX 5.07 was downloaded from DCloud and opened with the native app
  project.
- ADB 37.0.0 was installed from Android platform-tools; no device was attached.
- Public GitHub repo push succeeded on `main`.
- `.github/workflows/sync-to-cnb.yml` was removed and pushed.
- The native H5 preview shell is running on `http://localhost:8861/` and embeds
  the copied H5 dev server on `http://localhost:8851/`.
- `pnpm exec vue-tsc --noEmit --skipLibCheck` passed after adding the
  development-only `demoRole` preview bootstrap.
- `pnpm --dir native-app type-check` passed after simplifying the native shell.
- `pnpm native:prepare` passed again and regenerated the local App H5 payload.
- `pnpm --dir native-app build:app` passed again and generated App resources.
- Build warnings remain for legacy unresolved image/font references and large
  chunks in the original web app; they do not block App resource generation.
- HBuilderX CLI project import succeeded for
  `G:\qiming-uniapp-native-public\native-app`.
- `cli publish app-android --type appResource` and
  `cli publish app-ios --type appResource` were attempted; both stopped at the
  DCloud login requirement.
- A local Android release keystore was generated outside the repo. SHA256:
  `4D:70:6E:E2:2E:88:3F:46:AB:B6:9C:C7:12:F6:BA:7A:3D:17:CC:4C:8F:8B:DD:0C:92:29:18:06:2B:44:FF:6D`.
- The live native H5 preview now includes a bottom-right student/teacher/admin
  switcher for visual review while developing. `pnpm --dir native-app
  type-check` and `pnpm --dir native-app build:app` passed after this change.
- The live preview shell now defaults to a 393 x 852 phone canvas with a
  full-screen toggle. Browser inspection confirmed the iframe and device frame
  are `393x852` at `http://localhost:8861/?demoRole=teacher`.
- `pnpm --dir native-app type-check` passed after the phone-canvas preview
  change.
- `pnpm --dir native-app build:app` passed after the phone-canvas preview
  change.
- `scripts/pack-native.ps1 -Platform android -SkipPrepare` was tested without a
  local config and correctly stopped at the missing `pack-config.local.json`
  setup requirement.
- `pnpm native:preview` was added and tested. When the H5 and uni-app shell
  preview servers are already running, it reuses ports `8851` and `8861` and
  prints `http://localhost:8861/?demoRole=teacher`.
- `pnpm exec vue-tsc --noEmit --skipLibCheck`, `pnpm --dir native-app
  type-check`, and `pnpm --dir native-app build:app` passed after adding the
  preview launcher.
- `pnpm native:doctor` was added and tested. The first run during this
  documentation update reported `10 OK`, `5 WARN`, `0 FAIL`: HBuilderX/Java/
  Keytool/ADB, preview ports, Android keystore, source `origin/agent`, and App
  resources are ready. The dirty working tree WARN is temporary during edits;
  the real packaging WARNs are DCloud login verification, no Android device
  attached, missing `pack-config.local.json`, and missing iOS
  `.p12`/`.mobileprovision`.
- `pnpm --dir native-app type-check` and `pnpm --dir native-app build:app`
  passed after adding the native doctor diagnostics.
- Browser inspection confirmed `http://localhost:8861/?demoRole=teacher`
  renders the phone preview shell, with a `395x854` device frame and a `393x852`
  iframe loading `http://localhost:8851/#/account/ai-app?demoRole=teacher`.
- `pnpm native:pack:init` was tested and created the ignored local
  `native-app/pack-config.local.json`; `git check-ignore` confirmed the file is
  ignored by `native-app/.gitignore`.
- `pnpm native:pack:check` was tested in strict mode and correctly fails before
  packaging while the registered DCloud AppID, Android keystore passwords, and
  iOS profile/p12/password are still missing.
- `scripts/pack-native.ps1 -Platform android -SkipPrepare` now runs the strict
  pack config check first and stops before HBuilderX packaging when WARN/FAIL
  items remain.
- `pnpm --dir native-app type-check` and `pnpm --dir native-app build:app`
  passed after adding the pack config lifecycle scripts.
- `pnpm native:doctor` reports `10 OK`, `6 WARN`, `0 FAIL` during this update.
  After the temporary dirty working tree WARN is removed by commit, the real
  remaining WARNs are DCloud/HBuilderX login verification, no Android device,
  placeholder DCloud AppID, placeholder local pack config values, and missing
  iOS certificate/profile files.
- Android certificate passwords can now be supplied through
  `QIMING_ANDROID_CERT_PASSWORD` and `QIMING_ANDROID_STORE_PASSWORD` without
  writing secrets into `pack-config.local.json`. Android-only pack config
  validation with those temporary environment variables reports the password
  field as `configured via env` and leaves only the DCloud AppID WARN.
- `pack-native` now uses an ignored `pack-config.effective.tmp.json` only for
  the HBuilderX call and removes it in `finally`; verification confirmed the
  temporary file does not remain after a blocked packaging attempt.
- Browser inspection confirmed the live preview still renders the teacher phone
  shell at `http://localhost:8861/?demoRole=teacher`, with a `395x854` device
  frame and `393x852` iframe.
