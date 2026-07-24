import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getVideoDuration } from "./utils/course-package.ts";

const readSource = relativePath =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

const sourceBlock = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
};

test("new-chapter videos use real STS records and local metadata", async () => {
  const source = await readSource("./index.vue");
  const handler = sourceBlock(
    source,
    "const handleResourceUpload = async",
    "// 从文件URL中提取文件名"
  );

  assert.match(
    source,
    /import \{ uploadFileWithSts \} from "@\/utils\/sts-upload"/
  );
  assert.match(handler, /await getVideoDuration\(rawFile\)/);
  assert.match(handler, /await uploadFileWithSts\(rawFile/);
  assert.match(handler, /hour\.resourceId = uploaded\.fileId/);
  assert.match(handler, /hour\.fileUrl = uploaded\.url/);
  assert.doesNotMatch(handler, /Math\.random|URL\.createObjectURL|setTimeout/);
});

test("both course forms reject missing duration and pending uploads", async () => {
  const [courseList, courseForm] = await Promise.all([
    readSource("./index.vue"),
    readSource("./components/CourseForm.vue")
  ]);
  const formHandler = sourceBlock(
    courseForm,
    "const handleResourceUpload = async",
    "const removeResource ="
  );

  assert.match(formHandler, /await getVideoDuration\(rawFile\)/);
  assert.match(formHandler, /await uploadWithSts\(rawFile/);
  assert.match(formHandler, /hour\.duration = duration/);
  assert.doesNotMatch(
    formHandler,
    /Math\.random|URL\.createObjectURL|setTimeout/
  );

  assert.match(courseList, /:rules="videoDurationRules"/);
  assert.match(courseList, /hour => hour\.isUploading/);
  assert.match(courseList, /Number\(hour\.duration\) <= 0/);
  assert.equal(courseForm.match(/:rules="videoDurationRules"/g)?.length, 2);
  assert.match(courseForm, /allHours\.some\(hour => hour\.isUploading\)/);
  assert.match(courseForm, /Number\(hour\.duration\) <= 0/);
});

test("video metadata duration is rounded and object URLs are always released", async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const revokedUrls = [];
  let metadataFails = false;

  const video = {
    duration: 125.6,
    load() {},
    removeAttribute() {},
    set src(_value) {
      queueMicrotask(() =>
        metadataFails ? this.onerror() : this.onloadedmetadata()
      );
    }
  };

  try {
    globalThis.document = {
      createElement: () => video
    };
    globalThis.window = {
      clearTimeout,
      setTimeout
    };
    URL.createObjectURL = () => "blob:metadata-test";
    URL.revokeObjectURL = value => revokedUrls.push(value);

    assert.equal(await getVideoDuration({}), 126);
    metadataFails = true;
    assert.equal(await getVideoDuration({}), 0);
    assert.deepEqual(revokedUrls, ["blob:metadata-test", "blob:metadata-test"]);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
