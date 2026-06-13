# Qiming iOS Native Simulator Shell

This is a thin UIKit/WKWebView shell used to validate the existing
`native-app/src/hybrid/html` offline bundle on Apple Silicon iOS simulators.

HBuilderX 5.07 ships an x86_64-only standard iOS simulator base in
`Pandora_simulator.app`, which cannot be installed on arm64 simulators. This
native shell keeps the business UI in the generated uni-app/H5 bundle while
letting Xcode build a real arm64 simulator `.app`.

Run from the repo root:

```bash
pnpm native:prepare
pnpm native:run:ios -- --device-id <SIMULATOR_UDID> --demo-role teacher --entry /welcome/index
```

Screenshots:

```bash
pnpm native:ios:screenshot -- --device-id <SIMULATOR_UDID> --output artifacts/ios-simulator/teacher.png
```
