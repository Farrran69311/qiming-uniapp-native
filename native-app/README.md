# IntellEdu Native App

Uni-app shell for the existing IntellEdu H5 app.

Run from the repo root:

```powershell
pnpm native:prepare
pnpm --dir native-app build:app
```

`src/hybrid/html` is generated and intentionally ignored by Git. HBuilderX
packaging should be run after `pnpm native:prepare`.
