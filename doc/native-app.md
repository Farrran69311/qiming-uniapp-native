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
