import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const readSource = path =>
  readFile(new URL(path, import.meta.url), "utf8");

test("WeChat shell exposes a recoverable web-view error state", async () => {
  const shell = await readSource("../native-app/src/pages/index/index.vue");

  assert.match(shell, /miniProgramWebviewSrc && !loadError/);
  assert.match(shell, /loadError\.value \|\| \(!isMiniProgramRuntime/);
  assert.match(shell, /小程序业务域名配置/);
  assert.match(shell, /class="retry-button"/);
});

test("native back handling preserves inner route history", async () => {
  const shell = await readSource("../native-app/src/pages/index/index.vue");

  assert.match(shell, /result === "handled"/);
  assert.doesNotMatch(shell, /setTimeout\(forceFallbackRoot/);
});

test("native safe area accepts modern iOS status bars", async () => {
  const main = await readSource("./main.ts");

  assert.match(main, /Math\.min\(Math\.max\(statusTop, 22\), 64\)/);
});

test("mobile primary controls expose semantic button states", async () => {
  const [navigation, account] = await Promise.all([
    readSource("./layout/components/NavMobile.vue"),
    readSource("./views/account/index.vue")
  ]);

  assert.match(navigation, /<nav[^>]+aria-label="移动端主导航"/);
  assert.match(navigation, /<button[\s\S]+:aria-current=/);
  assert.match(account, /class="theme-toggle-hit-area"/);
  assert.match(account, /role="switch"/);
  assert.match(account, /:aria-checked=/);
});
