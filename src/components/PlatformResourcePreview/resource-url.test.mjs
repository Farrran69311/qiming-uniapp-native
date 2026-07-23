import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPlatformObjectUrl,
  normalizePlatformResourceUrl,
  uniquePlatformResourceUrls
} from "./resource-url.ts";

const urlOptions = {
  fileBaseUrl: "https://aiedu-file.intelledu.cn",
  pageProtocol: "https:"
};

test("normalizes wrapped, escaped and legacy platform file URLs", () => {
  assert.equal(
    normalizePlatformResourceUrl(
      " <http://aiedu-file.lehinet.com/ai-edu-bucket/lesson%201.md?x=1&amp;y=2> ",
      urlOptions
    ),
    "https://aiedu-file.intelledu.cn/ai-edu-bucket/lesson%201.md?x=1&y=2"
  );
  assert.equal(
    normalizePlatformResourceUrl(
      "//aiedu-file.intelledu.cn/ai-edu-bucket/slides.pptx",
      urlOptions
    ),
    "https://aiedu-file.intelledu.cn/ai-edu-bucket/slides.pptx"
  );
  assert.equal(
    normalizePlatformResourceUrl(
      "&quot;https:\\/\\/aiedu-file.intelledu.cn/ai-edu-bucket/notes.md&quot;",
      urlOptions
    ),
    "https://aiedu-file.intelledu.cn/ai-edu-bucket/notes.md"
  );
});

test("turns COS locations and object keys into canonical HTTPS URLs", () => {
  assert.equal(
    normalizePlatformResourceUrl(
      "cos://ai-edu-bucket/assistant/resources/map.json",
      urlOptions
    ),
    "https://aiedu-file.intelledu.cn/ai-edu-bucket/assistant/resources/map.json"
  );
  assert.equal(
    buildPlatformObjectUrl(
      "ai-edu-bucket/assistant/resources/讲解 文档.md",
      urlOptions
    ),
    "https://aiedu-file.intelledu.cn/ai-edu-bucket/assistant/resources/%E8%AE%B2%E8%A7%A3%20%E6%96%87%E6%A1%A3.md"
  );
});

test("keeps candidate order while removing equivalent URLs", () => {
  assert.deepEqual(
    uniquePlatformResourceUrls(
      [
        "http://aiedu-file.lehinet.com/ai-edu-bucket/resource.pdf",
        "https://aiedu-file.intelledu.cn/ai-edu-bucket/resource.pdf",
        "https://api.example.test/resource/download"
      ],
      urlOptions
    ),
    [
      "https://aiedu-file.intelledu.cn/ai-edu-bucket/resource.pdf",
      "https://api.example.test/resource/download"
    ]
  );
});

test("shared preview retries every file source and covers every direct format", async () => {
  const [runtime, pane, studentWorkbench] = await Promise.all([
    readFile(new URL("./resource-preview.ts", import.meta.url), "utf8"),
    readFile(
      new URL("./PlatformResourcePreviewPane.vue", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../../views/course/student-resource/index.vue", import.meta.url),
      "utf8"
    )
  ]);

  assert.match(runtime, /objectKey:\s*resource\.object_key/);
  assert.match(runtime, /urlCandidates:\s*string\[\]/);
  assert.match(runtime, /downloadUrlCandidates:\s*string\[\]/);
  assert.match(runtime, /for \(const sourceUrl of sourceUrls\)/);
  assert.match(runtime, /if \(!isTrustedResourceUrl\(requestUrl\)\)/);

  assert.match(pane, /resolved\.value\.urlCandidates/);
  for (const element of ["iframe", "video", "audio", "img"]) {
    assert.match(
      pane,
      new RegExp(`<${element}[\\s\\S]*?:src="activePreviewUrl"`)
    );
  }
  for (const kind of [
    "markdown",
    "text",
    "mindmap",
    "json",
    "docx",
    "pptx",
    "spreadsheet",
    "pdf",
    "video",
    "audio",
    "image",
    "html"
  ]) {
    assert.match(runtime, new RegExp(`\\b${kind}:`));
  }

  assert.match(studentWorkbench, /objectKey:\s*resource\.object_key/);
  assert.match(studentWorkbench, /structuredResourceUrls/);
  assert.match(studentWorkbench, /downloadUrlCandidates/);
});
