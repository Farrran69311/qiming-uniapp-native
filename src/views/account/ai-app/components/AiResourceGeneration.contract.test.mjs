import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./AiResourceGeneration.vue", import.meta.url),
  "utf8"
);

const sourceBlock = (start, end) =>
  source.slice(source.indexOf(start), source.indexOf(end));

test("resource generation creates a real backend task", () => {
  const createBlock = sourceBlock(
    "const handleCreateTask",
    "const openResourceDetail"
  );

  assert.match(createBlock, /await createAssistantResourceTask\(\{/);
  assert.match(createBlock, /data\.accepted !== true/);
  assert.match(createBlock, /await selectTask\(data\.task\.task_id\)/);
  assert.doesNotMatch(createBlock, /createDemoTask\(\)/);
  assert.doesNotMatch(createBlock, /正在模拟生成/);
});

test("task, resource and activity failures expose independent retries", () => {
  for (const state of [
    "taskLoadError",
    "resourceLoadError",
    "taskActivityLoadError"
  ]) {
    assert.match(source, new RegExp(`v-if="${state}"`));
  }
  for (const retry of [
    "retryTaskList",
    "retryResourceList",
    "retryTaskActivity"
  ]) {
    assert.match(source, new RegExp(`@click="${retry}"`));
  }
  assert.match(source, /v-else-if="!resourceLoadError"/);
  assert.match(source, /!tasks\.length && !taskLoadError/);
});

test("required usage writes cannot report success after a failed request", () => {
  const completeBlock = sourceBlock(
    "const handleCompleteResource",
    "const handleSubmitFeedback"
  );
  const feedbackBlock = sourceBlock(
    "const handleSubmitFeedback",
    "const syncSelectedResource"
  );

  for (const block of [completeBlock, feedbackBlock]) {
    assert.match(block, /await submitResourceUsage\(/);
    assert.match(block, /catch \(error\)/);
    assert.match(block, /ElMessage\.error\(/);
  }
});

test("resource deletion is confirmed and protected from duplicate submits", () => {
  const deleteBlock = sourceBlock(
    "const handleDeleteResource",
    "hydrateDemoState\(\)"
  );

  assert.match(deleteBlock, /deleteSubmitting\.value/);
  assert.match(deleteBlock, /await ElMessageBox\.confirm\(/);
  assert.match(
    deleteBlock,
    /await deleteAssistantResource\(resource\.resource_id\)/
  );
  assert.ok(
    deleteBlock.indexOf("ElMessageBox.confirm") <
      deleteBlock.indexOf("deleteAssistantResource")
  );
});

test("phone resource dialogs scroll without clipping action groups", () => {
  assert.match(source, /max-height: calc\(100dvh - 16px\)/);
  assert.match(
    source,
    /assistant-resource-dialog \.el-dialog__body[\s\S]*overflow-y: auto/
  );
  assert.match(
    source,
    /\.resource-dialog__action-group[\s\S]*min-height: 44px/
  );
  assert.match(
    source,
    /assistant-resource-dialog \.el-dialog__footer[\s\S]*overflow-y: auto/
  );
});
