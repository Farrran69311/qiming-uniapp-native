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
```

The Android/iOS convenience commands currently generate uni-app App resources.
Final APK/IPA packaging still requires HBuilderX packaging credentials.

Cloud packaging config:

- Copy `native-app/pack-config.example.json` to
  `native-app/pack-config.local.json`.
- Fill Android keystore passwords and iOS certificate paths locally.
- `pack-config.local.json`, keystores, `.p12`, and `.mobileprovision` files are
  ignored by Git.

Live browser prototype while developing:

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
