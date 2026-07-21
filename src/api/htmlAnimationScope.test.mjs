import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createHtmlAnimationIdempotencyKey,
  htmlAnimationScopeKey,
  normalizeHtmlAnimationScope,
  normalizeHtmlAnimationTaskStatus
} from "./htmlAnimationScope.ts";

const readSource = relativePath =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("normalizes legacy chapter scope and rejects ambiguous scope inputs", () => {
  assert.deepEqual(
    normalizeHtmlAnimationScope({ courseId: 39, chapterId: 97 }),
    { courseId: 39, chapterId: 97, scopeType: "chapter" }
  );
  assert.deepEqual(
    normalizeHtmlAnimationScope({
      courseId: 39,
      chapterId: 97,
      scopeType: "hour",
      hourId: 251
    }),
    {
      courseId: 39,
      chapterId: 97,
      scopeType: "hour",
      hourId: 251
    }
  );
  assert.throws(
    () =>
      normalizeHtmlAnimationScope({
        courseId: 39,
        chapterId: 97,
        scopeType: "hour"
      }),
    /hourId/
  );
  assert.throws(
    () =>
      normalizeHtmlAnimationScope({
        courseId: 39,
        chapterId: 97,
        scopeType: "chapter",
        hourId: 251
      }),
    /不能携带 hourId/
  );
});

test("scope and idempotency keys isolate chapter and lesson intents", () => {
  const chapter = { courseId: 39, chapterId: 97, scopeType: "chapter" };
  const hour251 = {
    courseId: 39,
    chapterId: 97,
    scopeType: "hour",
    hourId: 251
  };
  const hour252 = { ...hour251, hourId: 252 };

  assert.notEqual(
    htmlAnimationScopeKey(chapter),
    htmlAnimationScopeKey(hour251)
  );
  assert.notEqual(
    htmlAnimationScopeKey(hour251),
    htmlAnimationScopeKey(hour252)
  );
  assert.equal(
    createHtmlAnimationIdempotencyKey(hour251, "user-action-01"),
    createHtmlAnimationIdempotencyKey(hour251, "user-action-01")
  );
});

test("only a complete artifact can become previewable", () => {
  assert.equal(
    normalizeHtmlAnimationTaskStatus({
      status: "completed",
      version: 1,
      fileUrl: "https://files.example.test/animation.html"
    }),
    "completed"
  );
  assert.equal(
    normalizeHtmlAnimationTaskStatus({
      status: "completed",
      version: 0,
      fileUrl: "https://files.example.test/animation.html"
    }),
    "failed"
  );
  assert.equal(
    normalizeHtmlAnimationTaskStatus({ status: "completed", version: 1 }),
    "failed"
  );
  assert.equal(
    normalizeHtmlAnimationTaskStatus({
      status: "completed",
      version: 1,
      fileUrl: "https://files.example.test/animation.html",
      errorCode: "OBJECT_MISSING"
    }),
    "failed"
  );
});

test("all issue 249 surfaces use the new backend contract", async () => {
  const [
    api,
    animationManager,
    virtualLab,
    studentDisplay,
    videoManager,
    videoPanel
  ] = await Promise.all([
    readSource("./htmlAnimation.ts"),
    readSource("../views/course/animation/index.vue"),
    readSource("../views/virtual-lab/index.vue"),
    readSource("../views/account/course-detail/htmlAnimationDisplay.ts"),
    readSource("../views/course/video-analysis/index.vue"),
    readSource("../views/account/course-detail/VideoAnalysisPanel.vue")
  ]);

  assert.match(api, /\/html-animation\/readiness/);
  assert.match(api, /\/html-animation\/batch-generate/);
  for (const field of ["errorCode", "errorStage", "requestId", "retryable"]) {
    assert.match(api, new RegExp(`\\b${field}\\b`));
  }

  for (const manager of [animationManager, virtualLab]) {
    assert.match(manager, /getHtmlAnimationReadiness/);
    assert.match(manager, /createHtmlAnimationIdempotencyKey/);
    assert.match(manager, /scopeType/);
    assert.match(manager, /hourId/);
  }
  assert.match(animationManager, /batchGenerateHtmlAnimation/);
  assert.match(animationManager, /batchResult\.items/);
  assert.match(
    animationManager,
    /selectedScopeType\.value === "chapter"[\s\S]*?openBatchDialog\(\)/
  );
  assert.match(animationManager, /item\.taskId \|\| "-"/);

  assert.match(studentDisplay, /scopeKey: htmlAnimationScopeKey/);
  assert.match(studentDisplay, /scopeType: "hour"/);
  assert.match(videoManager, /hourId: submitForm\.hourId/);
  assert.match(videoPanel, /exactHourMatches/);
});
