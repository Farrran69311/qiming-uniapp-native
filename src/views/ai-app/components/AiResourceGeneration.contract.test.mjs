import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./AiResourceGeneration.vue", import.meta.url),
  "utf8"
);

const sourceBlock = (start, end) =>
  source.slice(source.indexOf(start), source.indexOf(end));

test("required resource usage writes validate acceptance before success", () => {
  const completeBlock = sourceBlock(
    "const handleCompleteResource",
    "const handleSubmitFeedback"
  );
  const feedbackBlock = sourceBlock(
    "const handleSubmitFeedback",
    "const syncSelectedResource"
  );

  assert.match(source, /unwrapAssistantResponseData/);
  assert.match(source, /requireAccepted: true/);
  for (const block of [completeBlock, feedbackBlock]) {
    assert.match(block, /await submitResourceUsage\(/);
    assert.match(block, /catch \(error\)/);
    assert.match(block, /ElMessage\.error\(/);
  }
});

test("resource mutations validate business envelopes before success", () => {
  for (const marker of ["保存资源", "审核资源", "发布资源", "删除资源"]) {
    assert.match(
      source,
      new RegExp(`unwrapAssistantResponseData[\\s\\S]{0,160}${marker}`)
    );
  }
  assert.equal(source.match(/requireResource: true/g)?.length, 3);
});

test("resource write handlers reject duplicate submits", () => {
  assert.equal(source.match(/governanceSubmitting\.value \|\|/g)?.length, 4);
  assert.match(source, /completeSubmitting\.value \|\|/);
  assert.match(source, /feedbackSubmitting\.value \|\|/);
});

test("task creation validates acceptance and a stable task id", () => {
  const createBlock = sourceBlock(
    "const handleCreateTask",
    "const openResourceDetail"
  );

  assert.match(createBlock, /unwrapAssistantResponseData/);
  assert.match(createBlock, /requireAccepted: true, requireTask: true/);
  assert.match(createBlock, /await loadTaskLogs\(data\.task!\.task_id\)/);
});

test("task, resource and activity reads show errors instead of false empties", () => {
  assert.ok((source.match(/requireList: true/g) || []).length >= 3);
  assert.match(source, /requireTrace: true/);
  for (const state of [
    "taskLoadError",
    "resourceLoadError",
    "taskActivityLoadError"
  ]) {
    assert.match(source, new RegExp(`v-if="${state}"`));
  }
  assert.match(source, /!tasks\.length && !taskLoadError/);
  assert.match(source, /v-else-if="filteredResources\.length"/);
});
