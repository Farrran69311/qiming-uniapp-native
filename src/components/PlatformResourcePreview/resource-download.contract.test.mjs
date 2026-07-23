import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const nativeRoot = new URL("../../../native-app/src/", import.meta.url);

test("embedded App downloads use a short acknowledged route without forwarding credentials", async () => {
  const runtime = await readFile(
    new URL("./resource-preview.ts", import.meta.url),
    "utf8"
  );
  const routeBuilder = runtime.slice(
    runtime.indexOf("export function buildPlatformNativeDownloadRoute"),
    runtime.indexOf("async function navigateToPlatformNativeDownload")
  );

  assert.match(runtime, /isPlatformNativeResourceRuntime/);
  assert.match(runtime, /bridge\.navigateTo\(\{/);
  assert.match(runtime, /\/pages\/resource-download\/index\?/);
  assert.match(runtime, /!isTrustedResourceUrl\(requestUrl\)/);
  assert.match(routeBuilder, /params\.set\("key", key\)/);
  assert.match(runtime, /platformNativeDownloadPayloadPrefix/);
  assert.match(runtime, /ack === "started"/);
  assert.doesNotMatch(routeBuilder, /params\.set\("(?:url|title|mime)"/);
  assert.doesNotMatch(runtime, /setTimeout\(\(\) => finish\(true\)/);
  assert.doesNotMatch(
    routeBuilder,
    /getToken|Authorization|params\.set\("token"/
  );
});

test("WeChat hands downloads through a destroy-time message and short local key", async () => {
  const [runtime, shell, page, html] = await Promise.all([
    readFile(new URL("./resource-preview.ts", import.meta.url), "utf8"),
    readFile(new URL("pages/index/index.vue", nativeRoot), "utf8"),
    readFile(new URL("pages/resource-download/index.vue", nativeRoot), "utf8"),
    readFile(new URL("../../../index.html", import.meta.url), "utf8")
  ]);

  assert.match(html, /res\.wx\.qq\.com\/open\/js\/jweixin-1\.6\.0\.js/);
  assert.match(runtime, /redirectToPlatformMiniProgramDownload/);
  assert.match(runtime, /type: "resource-download"/);
  assert.match(runtime, /bridge\.postMessage\(\{/);
  assert.match(runtime, /bridge\.redirectTo\(\{ url: route \}\)/);
  assert.match(runtime, /window\.addEventListener\("pagehide"/);
  assert.match(runtime, /params\.delete\("qimingNative"\)/);
  assert.match(runtime, /params\.delete\("qimingMiniProgram"\)/);
  assert.match(
    runtime,
    /isPlatformMiniProgramResourceRuntime\(\) && publicDownloadUrl/
  );
  assert.match(runtime, /const publicDownloadUrl = candidates\.find/);
  assert.doesNotMatch(runtime, /window\.location\.assign\(requestUrl\)/);
  assert.match(shell, /persistMiniProgramDownload\(message\)/);
  assert.match(shell, /uni\.setStorageSync\(/);
  assert.match(page, /uni\.getStorageSync\(payloadKey\)/);
  assert.match(page, /uni\.removeStorageSync\(payloadKey\)/);
  assert.match(page, /uni\.downloadFile\(\{/);
  assert.match(page, /uni\.reLaunch\(\{/);
});

test("mobile office buffers are streamed with a bounded limit", async () => {
  const runtime = await readFile(
    new URL("./resource-preview.ts", import.meta.url),
    "utf8"
  );

  assert.match(runtime, /16 \* 1024 \* 1024/);
  assert.match(runtime, /response\.body\?\.getReader\(\)/);
  assert.match(runtime, /reader\.cancel\("RESOURCE_TOO_LARGE"\)/);
  assert.match(runtime, /readPlatformResponseBuffer\(response, maxBytes\)/);
});

test("native download page covers download, persistence, progress and previews", async () => {
  const [page, pagesJson, manifestJson] = await Promise.all([
    readFile(new URL("pages/resource-download/index.vue", nativeRoot), "utf8"),
    readFile(new URL("pages.json", nativeRoot), "utf8"),
    readFile(new URL("manifest.json", nativeRoot), "utf8")
  ]);
  const pages = JSON.parse(pagesJson);
  const manifest = JSON.parse(manifestJson);

  assert.ok(
    pages.pages.some(
      pageEntry => pageEntry.path === "pages/resource-download/index"
    )
  );
  assert.match(page, /uni\.downloadFile\(\{/);
  assert.match(page, /uni\.getFileSystemManager\(\)/);
  assert.match(page, /fileSystem\.readFile\(\{/);
  assert.match(page, /textKinds: readonly ResourceKind\[\]/);
  assert.match(page, /file\.slice\(0, textPreviewByteLimit\)/);
  assert.match(page, /reader\.onload =/);
  assert.doesNotMatch(page, /reader\.onloadend =/);
  assert.match(page, /uni\.setClipboardData\(\{ data: textPreview\.value \}\)/);
  assert.match(page, /文档内容为空/);
  assert.match(page, /downloadTask\.onProgressUpdate/);
  assert.match(page, /uni\.saveFile\(\{/);
  assert.match(page, /uni\.openDocument\(\{/);
  assert.match(page, /plusApi\.runtime\.openFile/);
  assert.match(page, /readNativeDownloadPayload\(routeOptions\.key\)/);
  assert.match(page, /setItem\?\.\(ackKey, "started"\)/);
  assert.match(page, /uni\.previewImage\(\{/);
  assert.match(page, /phase === 'error'/);
  assert.match(page, />\s*重新下载\s*</);

  assert.deepEqual(manifest["app-plus"].modules.Record, {});
  assert.deepEqual(manifest["app-plus"].modules.Speech, {});
  assert.ok(
    manifest["app-plus"].distribute.android.permissions.includes(
      '<uses-permission android:name="android.permission.RECORD_AUDIO"/>'
    )
  );
});
